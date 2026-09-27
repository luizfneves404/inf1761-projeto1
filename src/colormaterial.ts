// Flat, unlit color appearance: an RGB color plus opacity, written into
// the shader's "material" group. Ported from python/colormaterial.py.

import * as gm from "./graphicsmath";
import { Material } from "./material";

export class ColorMaterial extends Material {
  constructor(r: number, g: number, b: number, opacity = 1) {
    super({ color: gm.vec3(r, g, b), opacity });
  }

  setColor(r: number, g: number, b: number): void {
    this.set("color", gm.vec3(r, g, b));
  }

  setOpacity(opacity: number): void {
    this.set("opacity", opacity);
  }
}
