// Point light whose position is translated by coordinate mappings.
// Ported from python/pointlight.py.

import * as gm from "./graphicsmath";
import type { Mat4 } from "./graphicsmath";
import { Light, type LightSpace } from "./light";
import type { MaterialValues } from "./material";

export class PointLight extends Light {
  constructor(
    x: number,
    y: number,
    z: number,
    space: LightSpace = "world",
    values: MaterialValues = {},
  ) {
    super(space, values);
    this.setPosition(x, y, z);
  }

  setPosition(x: number, y: number, z: number): void {
    this.set("light_position", gm.vec4(x, y, z, 1.0));
  }

  map(matrix: Mat4): MaterialValues {
    const position = this.get("light_position");
    if (!(position instanceof Float32Array)) throw new Error("light_position must be a vec4");
    return { light_position: gm.mat4MulVec4(matrix, position) };
  }
}
