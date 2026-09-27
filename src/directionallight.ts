// Directional light whose direction ignores translation and is
// normalized. Ported from python/directionallight.py.

import * as gm from "./graphicsmath";
import type { Mat4 } from "./graphicsmath";
import { Light, type LightSpace } from "./light";
import type { MaterialValues } from "./material";

export class DirectionalLight extends Light {
  constructor(
    x: number,
    y: number,
    z: number,
    space: LightSpace = "world",
    values: MaterialValues = {},
  ) {
    super(space, values);
    this.setDirection(x, y, z);
  }

  setDirection(x: number, y: number, z: number): void {
    this.set("light_direction", gm.vec3(x, y, z));
  }

  map(matrix: Mat4): MaterialValues {
    const d = this.get("light_direction");
    if (!(d instanceof Float32Array)) throw new Error("light_direction must be a vec3");
    const direction = gm.mat4MulVec4(matrix, gm.vec4(d[0], d[1], d[2], 0.0));
    return { light_direction: gm.normalize(gm.vec3(direction[0], direction[1], direction[2])) };
  }
}
