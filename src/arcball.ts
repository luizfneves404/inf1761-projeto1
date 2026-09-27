// Virtual trackball: maps mouse drags to a rotation matrix around a
// pivot `distance` in front of the camera. Accumulates rotations across
// drags; getMatrix returns the result to compose into the camera's view.
// Ported from python/arcball.py.

import * as gm from "./graphicsmath";
import type { Mat4 } from "./graphicsmath";

export class Arcball {
  distance: number;
  x0: number;
  y0: number;
  mat: Mat4;
  _dragging: boolean;

  // Stores the pivot distance and initializes the accumulated rotation to identity.
  constructor(distance: number) {
    this.distance = distance;
    this.x0 = 0;
    this.y0 = 0;
    this.mat = gm.mat4(1);
    this._dragging = false;
  }

  // Wires up pointerdown/up/move handlers on a DOM canvas so dragging
  // with the mouse drives the arcball rotation.
  attach(canvas: HTMLCanvasElement): void {
    const onDown = (event: PointerEvent): void => {
      // Pointer-event coordinates are expressed in logical (CSS) pixels.
      // Using the physical framebuffer size here breaks the sphere
      // mapping on HiDPI displays.
      const h = canvas.clientHeight;
      this.initMouseMotion(event.offsetX, h - event.offsetY);
    };
    const onUp = (): void => {
      this._dragging = false;
    };
    const onMove = (event: PointerEvent): void => {
      if (this._dragging) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        this.accumulateMouseMotion(event.offsetX, h - event.offsetY, w, h);
      }
    };
    canvas.addEventListener("pointerdown", (event: PointerEvent) => {
      this._dragging = true;
      onDown(event);
    });
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointermove", onMove);
  }

  // Records the drag start position, in canvas pixel coordinates with y
  // measured from the bottom.
  initMouseMotion(x0: number, y0: number): void {
    this.x0 = x0;
    this.y0 = y0;
  }

  // Projects the previous and current mouse positions onto the unit
  // sphere and composes the rotation between them into the accumulated
  // matrix. width/height give the canvas size used for that mapping.
  accumulateMouseMotion(x: number, y: number, width: number, height: number): void {
    if (x === this.x0 && y === this.y0) return;
    const [ux, uy, uz] = mapToSphere(width, height, this.x0, this.y0);
    const [vx, vy, vz] = mapToSphere(width, height, x, y);
    this.x0 = x;
    this.y0 = y;
    const ax = uy * vz - uz * vy;
    const ay = uz * vx - ux * vz;
    const az = ux * vy - uy * vx;
    const crossLen = Math.sqrt(ax * ax + ay * ay + az * az);
    if (crossLen < 1e-9) return; // u/v are (anti-)parallel - no meaningful axis, nothing to rotate
    // atan2, not asin(crossLen): u,v are unit vectors, so crossLen is
    // sin(theta) and dot is cos(theta). The factor 2 is intentional: a
    // drag across the full sphere diameter should produce a 360-degree
    // rotation rather than merely 180 degrees.
    const dot = ux * vx + uy * vy + uz * vz;
    const theta = 2 * Math.atan2(crossLen, dot);
    // self.mat = T * R * -T
    let m = gm.mat4(1);
    m = gm.translate(m, gm.vec3(0, 0, -this.distance));
    m = gm.rotate(m, theta, gm.vec3(ax, ay, az));
    m = gm.translate(m, gm.vec3(0, 0, this.distance));
    this.mat = gm.multiply(m, this.mat);
  }

  // Returns the accumulated rotation/pan matrix, meant to be composed
  // into the camera's view matrix.
  getMatrix(): Mat4 {
    return this.mat;
  }

  // Pans the arcball's accumulated matrix by an offset scaled by
  // `distance`, so pan speed stays proportional to the current zoom.
  translate(dx: number, dy: number, dz: number): void {
    let m = gm.mat4(1);
    m = gm.translate(m, gm.vec3(dx * this.distance, dy * this.distance, dz * this.distance));
    this.mat = gm.multiply(m, this.mat);
  }
}

// Projects a screen point (x,y) onto the arcball's unit sphere, returning
// its [px,py,pz] coordinates. Points outside the sphere are clamped to
// its equator (pz=0).
function mapToSphere(
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number] {
  const r = width < height ? width / 2 : height / 2;
  let X = (x - width / 2) / r;
  let Y = (y - height / 2) / r;
  const l = Math.sqrt(X * X + Y * Y);
  let Z: number;
  if (l <= 1) {
    Z = Math.sqrt(1 - l * l);
  } else {
    X /= l;
    Y /= l;
    Z = 0;
  }
  return [X, Y, Z];
}
