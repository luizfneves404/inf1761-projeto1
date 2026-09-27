// Generic named-value "material" appearance plus a revision counter.
// Ported from python/material.py. It can be used directly for an
// arbitrary shader material block, or as the base of a semantic
// convenience class such as PhongMaterial.
//
// Material has no Shader/GPU knowledge. Each Shader owns the actual
// UniformBlock *and* tracks the last revision it uploaded (see
// Shader.addMaterial/bindMaterial) - two different shaders each get their
// own, independently validated, written, and revision-tracked copy, so
// the same Material instance can be used under more than one shader
// safely. Values not declared by a particular shader are ignored.

import { Appearance } from "./appearance";
import type { Shader } from "./shader";
import type { State } from "./state";
import type { UniformBlock } from "./uniformbuffer";

export type MaterialValue = number | Float32Array;
export type MaterialValues = Record<string, MaterialValue>;

export class Material extends Appearance {
  _values: MaterialValues;
  _revision: number;

  constructor(values: MaterialValues = {}) {
    super();
    this._values = { ...values };
    this._revision = 0;
  }

  // Writes the intersection of this material's named values and the
  // shader's reflected material fields.
  writeFields(block: UniformBlock): void {
    for (const name in this._values) {
      if (block.hasField(name)) block.set(name, this._values[name]);
    }
  }

  // Sets an arbitrary material value and invalidates every shader's
  // cached GPU copy of this material.
  set(name: string, value: MaterialValue): void {
    this._values[name] = value;
    this._markDirty();
  }

  // Returns a named material value, or `defaultValue` when absent.
  get(name: string, defaultValue: MaterialValue | null = null): MaterialValue | null {
    return name in this._values ? this._values[name] : defaultValue;
  }

  // Returns a shallow copy so callers cannot replace entries without
  // incrementing the material revision via set().
  getValues(): MaterialValues {
    return { ...this._values };
  }

  // Called by every setter - bumps the revision, so every shader this
  // instance is registered with will rewrite its own block before its
  // next bind (see Shader.bindMaterial).
  _markDirty(): void {
    this._revision += 1;
  }

  getRevision(): number {
    return this._revision;
  }

  // Delegates to the active shader - see Shader.bindMaterial.
  load(st: State): void {
    const shader: Shader = st.getShader();
    shader.bindMaterial(st, this);
  }

  // Delegates to the active shader - see Shader.unbindMaterial.
  unload(st: State): void {
    st.getShader().unbindMaterial(st);
  }
}
