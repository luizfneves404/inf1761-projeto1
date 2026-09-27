// A timed keyframe transition, lasting T seconds, applied to one or more
// Transforms in parallel. Each advance call nudges every registered
// Transform by the delta between the previous and current interpolated
// value, so it composes with existing transform state; rotations apply
// as Euler-degree deltas in X/Y/Z order. Ported from
// python/luxor/movement.py.

import type { Transform } from "../transform";
import { Interpolator } from "./interpolator";

export class Movement {
  t: number;
  T: number;
  trlTrf: Transform[];
  rotTrf: Transform[];
  trlInterp: Interpolator[];
  rotInterp: Interpolator[];

  // Sets up an empty Movement lasting T seconds with its clock at 0.
  // Throws if T <= 0 - t0/t1 divide by T, and a zero-length movement can
  // never actually finish advancing.
  constructor(T: number) {
    if (T <= 0) throw new Error(`Movement T must be > 0, got ${T}`);
    this.t = 0;
    this.T = T;
    this.trlTrf = [];
    this.rotTrf = [];
    this.trlInterp = [];
    this.rotInterp = [];
  }

  // Registers a translation channel: interp's output is applied to trf
  // as position deltas on each advance.
  addTranslation(trf: Transform, interp: Interpolator): void {
    this.trlTrf.push(trf);
    this.trlInterp.push(interp);
  }

  // Registers a rotation channel: interp's output is treated as
  // Euler-degree deltas applied to trf in X/Y/Z order on each advance.
  addRotation(trf: Transform, interp: Interpolator): void {
    this.rotTrf.push(trf);
    this.rotInterp.push(interp);
  }

  // Steps by dt seconds (backward if reverse), applying deltas to all
  // registered Transforms. Returns null if the movement doesn't finish
  // this step; otherwise resets the clock to 0 and returns however much
  // of dt was left over beyond what this movement needed to finish (>=
  // 0), for the caller (Animation) to feed into the next Movement
  // instead of silently dropping it.
  advance(dt: number, reverse: boolean): number | null {
    let t = this.t + dt;
    let leftover: number | null = null;
    if (t >= this.T) {
      leftover = t - this.T;
      t = this.T;
    }
    let t0: number, t1: number;
    if (reverse) {
      t0 = (this.T - this.t) / this.T;
      t1 = (this.T - t) / this.T;
    } else {
      t0 = this.t / this.T;
      t1 = t / this.T;
    }
    // perform translations
    for (let i = 0; i < this.trlTrf.length; i++) {
      const v0 = this.trlInterp[i].interpolate(t0);
      const v1 = this.trlInterp[i].interpolate(t1);
      this.trlTrf[i].translate(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]);
    }
    // perform rotations
    for (let i = 0; i < this.rotTrf.length; i++) {
      const v0 = this.rotInterp[i].interpolate(t0);
      const v1 = this.rotInterp[i].interpolate(t1);
      this.rotTrf[i].rotate(v1[0] - v0[0], 1.0, 0.0, 0.0);
      this.rotTrf[i].rotate(v1[1] - v0[1], 0.0, 1.0, 0.0);
      this.rotTrf[i].rotate(v1[2] - v0[2], 0.0, 0.0, 1.0);
    }
    if (leftover !== null) {
      this.t = 0.0; // reset internal clock for reuse
      return leftover;
    } else {
      this.t = t;
      return null; // signal the movement continues
    }
  }
}
