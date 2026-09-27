// Base class for an animation curve between two keyframe values.
// Subclasses store their keyframe data and implement interpolate.
// Ported from python/luxor/interpolator.py.

import type { Vec3 } from "../graphicsmath";

export class Interpolator {
  // Maps t in [0,1] to the interpolated Vec3 value. Subclasses override.
  interpolate(_t: number): Vec3 {
    throw new Error("not implemented");
  }
}
