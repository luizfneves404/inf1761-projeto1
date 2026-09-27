// WGSL reflection, ported from python/wgslreflect.py: regex-based (not a
// full parser), extracts bind group layouts, uniform/storage-array field
// schemas, and vertex input locations from WGSL source text. Missing-name
// queries throw; some callers catch for silent-skip semantics, others let
// it surface as a validation error.

import type { Schema, WgslPrimitive, WgslType } from "./uniformbuffer";

// A struct's fields as parsed straight from the source text: raw,
// unresolved [fieldName, typeText] pairs.
type RawStructFields = [name: string, type: string][];

// All structs declared in one file, keyed by struct name.
type StructsTable = Record<string, RawStructFields>;

// One bind group's accumulated reflection data.
interface GroupData {
  entries: GPUBindGroupLayoutEntry[];
  uniformFields: Schema | null;
  storageArrayFields: Schema | null;
}

// Everything one ShaderReflection parse produces, cached for the query
// methods below.
interface ReflectionData {
  groups: Map<number, GroupData>;
  fields: Map<string, number>;
  textures: Map<string, [number, number]>;
  samplers: Map<string, [number, number]>;
  vertexInputs: Map<string, number>;
  uniformVars: Map<string, number>;
  groupVarNames: Map<number, string>;
}

// Subset of WGSL types this project supports (see uniformbuffer.js _ALIGN_SIZE).
const NORMALIZABLE: ReadonlySet<string> = new Set<WgslPrimitive>([
  "i32",
  "f32",
  "vec2",
  "vec3",
  "vec4",
  "mat4x4",
]);

const STRUCT_RE = /struct\s+(\w+)\s*\{([^}]*)\}/gs;

// WGSL comments, stripped before any parsing: a trailing "// ..." on a struct
// field line would otherwise be glued onto the *next* field's name (fields are
// split on ","), silently making hasField() miss it - and a miss means the
// field is never written, so it reads as zero on the GPU.
const COMMENT_RE = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;

// Removes line and block comments, keeping newlines so anything reported by
// line number still lines up.
function stripComments(code: string): string {
  return code.replace(COMMENT_RE, (match) => "\n".repeat((match.match(/\n/g) || []).length));
}
const ATTR_PREFIX_RE = /@\w+(?:\([^)]*\))?\s*/g;
// group 3 captures whatever's inside var<...> (e.g. "uniform" or
// "storage, read") - undefined for a bare `var` (textures/samplers).
const BINDING_RE =
  /@group\(\s*(\d+)\s*\)\s*@binding\(\s*(\d+)\s*\)\s*var(?:<([^>]*)>)?\s+(\w+)\s*:\s*([^;]+);/g;
const STORAGE_ARRAY_RE = /^array<\s*(\w+)\s*>$/;
const VERTEX_MAIN_START_RE = /fn\s+vs_main\s*\(/;
const VERTEX_PARAM_RE = /@location\(\s*(\d+)\s*\)\s*(\w+)\s*:\s*([^,]+)/g;

const TEXTURE_VIEW_DIM: Readonly<Record<string, GPUTextureViewDimension>> = {
  texture_1d: "1d",
  texture_2d: "2d",
  texture_2d_array: "2d-array",
  texture_cube: "cube",
  texture_cube_array: "cube-array",
  texture_3d: "3d",
  texture_depth_2d: "2d",
  texture_depth_2d_array: "2d-array",
  texture_depth_cube: "cube",
  texture_depth_cube_array: "cube-array",
};

// exec() returns `RegExpExecArray | null`; callers that rely on the match
// being present go through this instead of a non-null assertion.
function m(re: RegExp, s: string): RegExpExecArray {
  const result = re.exec(s);
  if (result === null) throw new Error(`no match for ${re} in: ${s}`);
  return result;
}

// Returns vs_main's parameter list text, or null if there's no vs_main.
// Tracks paren depth manually since the params themselves contain parens
// (@location(0)).
function extractVsMainParams(code: string): string | null {
  if (!VERTEX_MAIN_START_RE.test(code)) return null;
  const match = m(VERTEX_MAIN_START_RE, code);
  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < code.length && depth > 0) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")") depth--;
    i++;
  }
  return code.slice(start, i - 1);
}

// Resolves one raw field type to either a primitive name (one of
// NORMALIZABLE) or, for a reference to another struct declared in this
// same file, a nested schema - an array of [name, resolvedType] pairs,
// each resolved the same way. `stack` is the chain of struct names being
// resolved, to throw instead of recursing forever on a cyclic struct
// reference.
function normalizeType(
  wgslType: string,
  structs: StructsTable,
  stack: readonly string[] = [],
): WgslType {
  const base = wgslType.split("<")[0].trim();
  if (NORMALIZABLE.has(base)) return base as WgslPrimitive;
  if (base in structs) {
    if (stack.includes(base)) {
      throw new Error(`Recursive struct definition: ${[...stack, base].join(" -> ")}`);
    }
    const fields = structs[base];
    return fields.map(([fname, ftype]): readonly [string, WgslType] => [
      fname,
      normalizeType(ftype, structs, [...stack, base]),
    ]);
  }
  throw new Error(
    `Unsupported WGSL type in uniform block: '${wgslType}' ` +
      `(supported: ${[...NORMALIZABLE].sort().join(", ")}, or another struct declared in this file)`,
  );
}

function parseStructs(code: string): StructsTable {
  const structs: StructsTable = {};
  for (const match of code.matchAll(STRUCT_RE)) {
    const name = match[1];
    const fields: RawStructFields = [];
    for (let part of match[2].split(",")) {
      part = part.replace(ATTR_PREFIX_RE, "").trim();
      if (!part) continue;
      const colon = part.indexOf(":");
      if (colon === -1) continue;
      const fname = part.slice(0, colon).trim();
      const ftype = part.slice(colon + 1).trim();
      if (fname && ftype) fields.push([fname, ftype]);
    }
    structs[name] = fields;
  }
  return structs;
}

function textureEntry(binding: number, wgslType: string): GPUBindGroupLayoutEntry {
  const base = wgslType.split("<")[0].trim();
  const sampleType: GPUTextureSampleType = base.startsWith("texture_depth") ? "depth" : "float";
  const viewDimension = base in TEXTURE_VIEW_DIM ? TEXTURE_VIEW_DIM[base] : "2d";
  return { binding, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType, viewDimension } };
}

function samplerEntry(binding: number, wgslType: string): GPUBindGroupLayoutEntry {
  const kind: GPUSamplerBindingType =
    wgslType === "sampler_comparison" ? "comparison" : "filtering";
  return { binding, visibility: GPUShaderStage.FRAGMENT, sampler: { type: kind } };
}

function uniformEntry(binding: number): GPUBindGroupLayoutEntry {
  return {
    binding,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: "uniform" },
  };
}

function storageArrayEntry(binding: number): GPUBindGroupLayoutEntry {
  return {
    binding,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: "read-only-storage" },
  };
}

export class ShaderReflection {
  // Parses WGSL source `code` once, caching the result for the query
  // methods below.
  _data: ReflectionData;

  constructor(code: string) {
    this._data = this._parse(stripComments(code));
  }

  _parse(code: string): ReflectionData {
    const structs = parseStructs(code);
    const groups = new Map<number, GroupData>();
    const fields = new Map<string, number>();
    const textures = new Map<string, [number, number]>();
    const samplers = new Map<string, [number, number]>();
    const uniformVars = new Map<string, number>();

    const group = (index: number): GroupData => {
      const existing = groups.get(index);
      if (existing !== undefined) return existing;
      const fresh: GroupData = { entries: [], uniformFields: null, storageArrayFields: null };
      groups.set(index, fresh);
      return fresh;
    };

    const registerFields = (idx: number, varname: string, rawFields: RawStructFields): Schema => {
      const normalized: Schema = rawFields.map(([fname, ftype]): readonly [string, WgslType] => [
        fname,
        normalizeType(ftype, structs),
      ]);
      uniformVars.set(varname, idx);
      for (const [fname] of normalized) {
        const existing = fields.get(fname);
        if (existing !== undefined && existing !== idx) {
          throw new Error(
            `Field '${fname}' declared in more than one group (${existing} and ${idx}) - ` +
              "field names must be unique across a shader's uniform blocks",
          );
        }
        fields.set(fname, idx);
      }
      return normalized;
    };

    for (const match of code.matchAll(BINDING_RE)) {
      const idx = parseInt(match[1], 10);
      const binding = parseInt(match[2], 10);
      const addrSpace = (match[3] ?? "").trim();
      const varname = match[4];
      const typeExpr = match[5].trim();
      const g = group(idx);

      if (typeExpr.startsWith("texture")) {
        g.entries.push(textureEntry(binding, typeExpr));
        textures.set(varname, [idx, binding]);
        continue;
      }

      if (typeExpr === "sampler" || typeExpr === "sampler_comparison") {
        g.entries.push(samplerEntry(binding, typeExpr));
        samplers.set(varname, [idx, binding]);
        continue;
      }

      const arrayMatch = STORAGE_ARRAY_RE.exec(typeExpr);
      if (addrSpace.startsWith("storage") && arrayMatch !== null) {
        // var<storage, read> varname: array<StructType>
        const structName = arrayMatch[1];
        const rawFields = structFields(structs, structName);
        if (rawFields === undefined) {
          throw new Error(
            `Storage array '${varname}' (group ${idx}) references undeclared struct: '${structName}'`,
          );
        }
        g.entries.push(storageArrayEntry(binding));
        g.storageArrayFields = registerFields(idx, varname, rawFields);
        continue;
      }

      // var<uniform> varname: StructType
      const rawFields = structFields(structs, typeExpr);
      if (rawFields === undefined) {
        throw new Error(
          `Uniform '${varname}' (group ${idx}) references undeclared struct: '${typeExpr}'`,
        );
      }
      g.entries.push(uniformEntry(binding));
      g.uniformFields = registerFields(idx, varname, rawFields);
    }

    const indices = [...groups.keys()].sort((a, b) => a - b);
    if (indices.some((v, i) => v !== i)) {
      throw new Error(
        `Bind group indices must be contiguous starting at 0; found: ${indices.join(", ")}. ` +
          "WebGPU doesn't allow 'skipping' a group index.",
      );
    }

    // name -> location; format/size aren't reflected at all - WebGPU lets an
    // application's buffer supply a smaller vector format than vs_main
    // declares, so only the application (via Shader.setVertexBuffers)
    // knows the actual packing, never reflection.
    const vertexInputs = new Map<string, number>();
    const vsMainParams = extractVsMainParams(code);
    if (vsMainParams !== null) {
      for (const param of vsMainParams.matchAll(VERTEX_PARAM_RE)) {
        vertexInputs.set(param[2], parseInt(param[1], 10));
      }
    }

    const groupVarNames = new Map<number, string>();
    for (const [varname, idx] of uniformVars) groupVarNames.set(idx, varname);

    return { groups, fields, textures, samplers, vertexInputs, uniformVars, groupVarNames };
  }

  // The group record for `group` - Map.get() is `| undefined`, so callers
  // go through this; a missing group throws like the other missing-name
  // queries below.
  _group(group: number): GroupData {
    const g = this._data.groups.get(group);
    if (g === undefined) throw new Error(`KeyError: ${group}`);
    return g;
  }

  // --- bind group queries, used by Shader to build GPUBindGroupLayouts ---

  // Every declared @group index, sorted ascending; contiguous from 0.
  groupIndices(): number[] {
    return [...this._data.groups.keys()].sort((a, b) => a - b);
  }

  // GPUBindGroupLayoutEntry objects for `group`, in WGSL declaration order.
  layoutEntries(group: number): GPUBindGroupLayoutEntry[] {
    return this._group(group).entries;
  }

  // [fieldName, wgslType] pairs for the uniform struct bound in `group`, in
  // declaration order. wgslType is a primitive type name, or - for a field
  // whose type is itself a struct declared in this file - a nested array of
  // the same shape (see normalizeType); uniformbuffer.js's layout code is
  // what flattens that into dotted leaf fields.
  uniformFields(group: number): Schema | null {
    return this._group(group).uniformFields;
  }

  // Same as uniformFields but for the element struct of the
  // `var<storage, read> name: array<StructType>` bound in `group`; null if
  // `group` isn't a storage array.
  storageArrayFields(group: number): Schema | null {
    return this._group(group).storageArrayFields;
  }

  // Bind group index of the uniform variable literally named `varname`
  // (e.g. "material", "global", "matrix"); throws if undeclared.
  uniformVarGroup(varname: string): number {
    const idx = this._data.uniformVars.get(varname);
    if (idx === undefined) throw new Error(`KeyError: ${varname}`);
    return idx;
  }

  // Uniform variable name bound in `group` - inverse of uniformVarGroup;
  // throws if `group` has no uniform var (e.g. a texture/sampler-only group).
  groupVarName(group: number): string {
    const varname = this._data.groupVarNames.get(group);
    if (varname === undefined) throw new Error(`KeyError: ${group}`);
    return varname;
  }

  // --- named-field queries ---

  // Bind group index of the uniform field `name`; throws if undeclared.
  // `name` is the top-level field name only.
  fieldGroup(name: string): number {
    const idx = this._data.fields.get(name);
    if (idx === undefined) throw new Error(`KeyError: ${name}`);
    return idx;
  }

  // [group, binding] for the texture variable `name`.
  textureBinding(name: string): [number, number] {
    const entry = this._data.textures.get(name);
    if (entry === undefined) throw new Error(`KeyError: ${name}`);
    return entry;
  }

  // [group, binding] for the sampler variable `name`.
  samplerBinding(name: string): [number, number] {
    const entry = this._data.samplers.get(name);
    if (entry === undefined) throw new Error(`KeyError: ${name}`);
    return entry;
  }

  // --- vertex input queries, used by Shader to resolve setVertexBuffers' varName ---

  // @location vs_main declares for input `name`; throws if not found.
  vertexLocation(name: string): number {
    const location = this._data.vertexInputs.get(name);
    if (location === undefined) throw new Error(`KeyError: ${name}`);
    return location;
  }

  // Every @location this shader's vs_main declares, for Shader to verify coverage.
  vertexLocations(): Set<number> {
    return new Set(this._data.vertexInputs.values());
  }
}

// Record lookup that keeps `undefined` in the type: `structs[name]` on a
// Record<string, T> is typed T even when the key is absent, so callers
// needing a real null check go through this instead.
function structFields(structs: StructsTable, name: string): RawStructFields | undefined {
  return name in structs ? structs[name] : undefined;
}
