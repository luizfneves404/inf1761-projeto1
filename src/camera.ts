// Base interface for cameras: projection matrix, view matrix, and
// uniform upload. Defaults return identity; Camera2D/Camera3D override
// them. Ported from python/camera.py.

import { mat4 } from "./graphicsmath";
import type { Mat4 } from "./graphicsmath";
import type { State } from "./state";

export type CanvasSize = [width: number, height: number];

export class Camera {
  // Projection matrix mapping camera space to clip space, for the given
  // canvas size [width, height] in pixels. Recompute every frame -
  // depends on canvasSize.
  getProjMatrix(_canvasSize: CanvasSize): Mat4 {
    return mat4(1.0);
  }

  // View matrix mapping world space into camera (eye) space. Recomputed
  // every frame since subclasses may derive it from interactive state.
  getViewMatrix(): Mat4 {
    return mat4(1.0);
  }

  // Pushes this camera's per-frame uniforms onto State's per-field value
  // stacks. Base default pushes nothing; pair any override with a
  // matching unload.
  load(_st: State): void {}

  // Pops whatever load pushed. Pairs with load.
  unload(_st: State): void {}
}
