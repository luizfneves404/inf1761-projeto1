// Manual WGSL uniform/storage buffer layout + packing, ported from
// python/uniformbuffer.py. Implements WGSL's layout rules by hand
// (WebGPU's std140/std430-equivalent): each field is placed at the next
// offset that's a multiple of its own type's alignment (not just its size
// - e.g. vec3 is 12 bytes but aligns to 16, leaving a 4-byte hole after it
// whenever something follows it), fields are laid out in declaration order
// with no reordering/repacking, and the overall element size is rounded up
// to a multiple of 16 bytes.

import * as gm from "./graphicsmath";
import type { MaterialValue } from "./material";

// A WGSL scalar/vector/matrix primitive this engine's layout code supports.
export type WgslPrimitive = "i32" | "f32" | "vec2" | "vec3" | "vec4" | "mat4x4";

// A field's type: a primitive, or - for a struct-typed field - the nested
// struct's own schema (as wgslreflect's normalizeType resolves it).
export type WgslType = WgslPrimitive | readonly (readonly [name: string, type: WgslType])[];

// A schema: an ordered list of [fieldName, wgslType] pairs.
export type Schema = readonly (readonly [name: string, WgslType])[];

// Flat layout of one schema: every leaf field's byte offset (dotted names
// for leaves reached through a nested struct) and WGSL type, plus the
// struct's natural (unrounded) size and its own alignment.
export type FieldLayout = {
  offsets: Record<string, number>;
  types: Record<string, WgslPrimitive>;
  naturalSize: number;
  alignment: number;
};

// A flat record of leaf values keyed by (dotted) field name, as
// StorageArray.append accepts.
export type StorageValue = Record<string, MaterialValue>;

// Everything pack() may receive: a MaterialValue, or a plain numeric array
// where a vector type is expected (plain-JS callers).
type PackValue = MaterialValue | readonly number[];

// [align, size] in bytes.
const ALIGN_SIZE = {
  i32: [4, 4],
  f32: [4, 4],
  vec2: [8, 8],
  vec3: [16, 12],
  vec4: [16, 16],
  mat4x4: [16, 64],
} as const satisfies Readonly<Record<WgslPrimitive, readonly [number, number]>>;

const COMPONENT_COUNT = {
  vec2: 2,
  vec3: 3,
  vec4: 4,
  mat4x4: 16,
} as const satisfies Readonly<Record<Exclude<WgslPrimitive, "i32" | "f32">, number>>;

function zeroFor(wgslType: WgslPrimitive): MaterialValue {
  switch (wgslType) {
    case "i32":
      return 0;
    case "f32":
      return 0.0;
    case "vec2":
      return gm.vec2(0);
    case "vec3":
      return gm.vec3(0);
    case "vec4":
      return gm.vec4(0);
    case "mat4x4":
      return gm.mat4(0);
    default:
      throw new TypeError("Unsupported wgsl_type in uniformbuffer: " + wgslType);
  }
}

function align(offset: number, alignment: number): number {
  return Math.ceil(offset / alignment) * alignment;
}

function pack(value: PackValue, wgslType: WgslPrimitive): Uint8Array {
  switch (wgslType) {
    case "i32": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setInt32(0, Math.trunc(typeof value === "number" ? value : NaN), true);
      return new Uint8Array(buf);
    }
    case "f32": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, typeof value === "number" ? value : NaN, true);
      return new Uint8Array(buf);
    }
    case "mat4x4": {
      const matrix = value instanceof Float32Array ? value : new Float32Array(0);
      return new Uint8Array(gm.mat4Bytes(matrix).buffer);
    }
    case "vec2":
    case "vec3":
    case "vec4": {
      const n = COMPONENT_COUNT[wgslType];
      const vec =
        value instanceof Float32Array
          ? value
          : Float32Array.from(typeof value === "number" ? [] : value);
      if (vec.length !== n)
        throw new Error(`${wgslType} value must have length ${n}, got ${vec.length}`);
      return new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
    }
    default:
      throw new TypeError("Unsupported wgsl_type in uniformbuffer: " + wgslType);
  }
}

// [align, size] for one field's type: a direct table lookup for a
// primitive, or - recursively, for a nested struct schema - align is the
// max alignment among its own members and size is that alignment rounded
// up from the unrounded end of its last member (WGSL's own struct layout
// rule; distinct from the 16-byte rounding computeLayout applies to the
// outermost buffer/stride, which nothing but the top level gets).
function typeAlignSize(wgslType: WgslType): readonly [number, number] {
  if (typeof wgslType !== "string") {
    const { naturalSize, alignment } = layoutSchema(wgslType);
    return [alignment, align(naturalSize, alignment)];
  }
  return ALIGN_SIZE[wgslType];
}

// Lays out `schema`'s own fields starting at offset 0, recursing into any
// nested struct field so the returned offsets/types are flat, with a
// dotted name ("light.color") for every leaf reached through a nested
// struct. Returns {offsets, types, naturalSize, align}: naturalSize is the
// unrounded offset just past the last member (rounding it to this
// struct's own alignment, or to 16 for the outermost buffer, is the
// caller's job); align is the max alignment among schema's own members.
function layoutSchema(schema: Schema): FieldLayout {
  const offsets: Record<string, number> = {};
  const types: Record<string, WgslPrimitive> = {};
  let offset = 0;
  let a = 1;
  for (const [name, wgslType] of schema) {
    const [fieldAlign, size] = typeAlignSize(wgslType);
    a = Math.max(a, fieldAlign);
    offset = align(offset, fieldAlign);
    if (typeof wgslType !== "string") {
      const sub = layoutSchema(wgslType);
      for (const subName in sub.offsets) {
        offsets[`${name}.${subName}`] = offset + sub.offsets[subName];
        types[`${name}.${subName}`] = sub.types[subName];
      }
    } else {
      offsets[name] = offset;
      types[name] = wgslType;
    }
    offset += size;
  }
  return { offsets, types, naturalSize: offset, alignment: a };
}

// Computes every leaf field's byte offset and WGSL type (flat, with a
// dotted name for one nested inside a struct field) and the overall
// (16-byte-rounded) element size - shared by StorageArray (one element's
// stride) and UniformBlock (the whole buffer's size).
function computeLayout(schema: Schema): {
  offsets: Record<string, number>;
  types: Record<string, WgslPrimitive>;
  size: number;
} {
  const { offsets, types, naturalSize } = layoutSchema(schema);
  return { offsets, types, size: align(naturalSize, 16) };
}

// Packs `values` (missing fields default to a type-appropriate zero) into
// one `stride`-sized row, fields placed at their precomputed offsets.
// `types` is the flat, dotted-leaf mapping computeLayout returns.
function packRow(
  values: StorageValue,
  types: Record<string, WgslPrimitive>,
  offsets: Record<string, number>,
  stride: number,
): Uint8Array {
  const row = new Uint8Array(stride);
  for (const name in types) {
    const wgslType = types[name];
    const value: MaterialValue = name in values ? values[name] : zeroFor(wgslType);
    const data = pack(value, wgslType);
    row.set(data, offsets[name]);
  }
  return row;
}

// A growable `var<storage, read> name: array<StructType>` buffer - used
// for the "matrix" group, where every draw call needs its own row (many
// transforms per frame, appended rather than overwritten so writeBuffer
// timing relative to a single per-frame submit() doesn't matter - see
// Shader.commitMatrix). Pre-allocated to `maxRows`; append throws if that
// capacity is exceeded rather than silently corrupting or growing
// unbounded.
export class StorageArray {
  device: GPUDevice;
  schema: Schema;
  groupIndex: number;
  maxRows: number;
  offsets: Record<string, number>;
  stride: number;
  count: number;
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  _types: Record<string, WgslPrimitive>;
  _staging: Uint8Array | undefined;

  constructor(
    device: GPUDevice,
    schema: Schema,
    layout: GPUBindGroupLayout,
    groupIndex: number,
    maxRows: number,
    binding = 0,
  ) {
    this.device = device;
    this.schema = schema;
    this.groupIndex = groupIndex;
    this.maxRows = maxRows;
    const computed = computeLayout(schema);
    this.offsets = computed.offsets;
    this._types = computed.types;
    this.stride = computed.size;
    this.count = 0;
    this.buffer = device.createBuffer({
      size: this.stride * maxRows,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      layout,
      entries: [
        { binding, resource: { buffer: this.buffer, offset: 0, size: this.stride * maxRows } },
      ],
    });
  }

  // Packs `values` into the next free row and writes it, returning that
  // row's index (the value to pass as firstInstance).
  append(values: StorageValue): number {
    if (this.count >= this.maxRows) {
      throw new Error(
        `StorageArray for group ${this.groupIndex} exceeded its ${this.maxRows}-row capacity ` +
          "(see Shader's maxInstances) - raise it or draw fewer distinct instances per frame",
      );
    }
    const row = this.count;
    const packed = packRow(values, this._types, this.offsets, this.stride);
    if (this._staging === undefined) this._staging = new Uint8Array(this.maxRows * this.stride);
    this._staging.set(new Uint8Array(packed.buffer), row * this.stride);
    this.count += 1;
    return row;
  }

  // Uploads every row appended since the last reset in one writeBuffer.
  // Must run before the pass's submit - anywhere before it works, since
  // writeBuffer is on the queue timeline. No-op when nothing was appended.
  flush(): void {
    const staging = this._staging;
    if (this.count === 0 || staging === undefined) return;
    this.device.queue.writeBuffer(this.buffer, 0, staging.subarray(0, this.count * this.stride));
  }

  // Starts a fresh frame: every previously-appended row becomes
  // unreachable and capacity is reclaimed from row 0.
  reset(): void {
    this.count = 0;
  }
}

// A single-instance `var<uniform> name: StructType` buffer + bind group,
// built once and reused for its owner's whole lifetime - Shader builds one
// per registered Material (see addMaterial) and one for its own "global"
// group (see commitGlobal), both eagerly, so createBuffer/createBindGroup
// never happen during traversal.
//
// Written via begin/set/end: set(name, value) throws on a name this
// block's schema doesn't declare - callers that want to skip an optional
// field check hasField first. A field nested inside a struct-typed field
// is named with a dot ("light.color").
export class UniformBlock {
  device: GPUDevice;
  schema: Schema;
  groupIndex: number;
  offsets: Record<string, number>;
  size: number;
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  _types: Record<string, WgslPrimitive>;
  _pending: Uint8Array | null;

  constructor(
    device: GPUDevice,
    schema: Schema,
    layout: GPUBindGroupLayout,
    groupIndex: number,
    binding = 0,
  ) {
    this.device = device;
    this.schema = schema;
    this.groupIndex = groupIndex;
    const computed = computeLayout(schema);
    this.offsets = computed.offsets;
    this._types = computed.types;
    this.size = computed.size;
    this._pending = null;
    this.buffer = device.createBuffer({
      size: this.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      layout,
      entries: [{ binding, resource: { buffer: this.buffer, offset: 0, size: this.size } }],
    });
  }

  hasField(name: string): boolean {
    return name in this.offsets;
  }

  // Starts a fresh write pass: a zeroed staging row, so any field never
  // set this pass stays zero. Pairs with end.
  begin(): void {
    this._pending = new Uint8Array(this.size);
  }

  // Packs `value` into field `name` of the row started by begin. Throws
  // if `name` isn't declared in this block's schema.
  set(name: string, value: MaterialValue): void {
    if (!(name in this.offsets)) throw new Error(`'${name}' is not a field of this shader's group`);
    if (this._pending === null) throw new Error("set() called without begin()");
    const data = pack(value, this._types[name]);
    this._pending.set(data, this.offsets[name]);
  }

  // Writes the row accumulated since begin to the GPU buffer in one call.
  end(): void {
    if (this._pending === null) throw new Error("end() called without begin()");
    this.device.queue.writeBuffer(this.buffer, 0, this._pending);
    this._pending = null;
  }
}
