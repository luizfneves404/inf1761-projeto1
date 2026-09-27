// Base for drawable geometry. Ported from python/shape.py.
import type { State } from "./state";

export class Shape {
  draw(_st: State): void {
    throw new Error("not implemented");
  }
}
