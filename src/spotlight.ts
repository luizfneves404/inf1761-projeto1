// Point light whose position is translated by coordinate mappings.
// Ported from python/pointlight.py.

import * as gm from "./graphicsmath";
import type { Mat4 } from "./graphicsmath";
import { Light, type LightSpace } from "./light";
import type { MaterialValues } from "./material";

export class SpotLight extends Light {
  constructor(
    pos: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    cone_angle: number,
    focus_exponent: number,
    space: LightSpace = "world",
    values: MaterialValues = {},
  ) {
    super(space, values);
    this.setPosition(pos.x, pos.y, pos.z);
    this.set("light_direction", gm.vec4(dir.x, dir.y, dir.z, 0.0));
    this.set("cone_angle", cone_angle);
    this.set("focus_exponent", focus_exponent);
  }

  setPosition(x: number, y: number, z: number): void {
    this.set("light_position", gm.vec4(x, y, z, 1.0));
  }

  map(matrix: Mat4): MaterialValues {
    const position = this.get("light_position");
    if (!(position instanceof Float32Array)) throw new Error("light_position must be a vec4");
    const direction = this.get("light_direction");
    if (!(direction instanceof Float32Array)) throw new Error("light_direction must be a vec4");
    return { light_position: gm.mat4MulVec4(matrix, position),light_direction: gm.normalize(gm.mat4MulVec4(matrix, gm.vec4(direction[0],direction[1],direction[2],0.0))) };
  }
}
