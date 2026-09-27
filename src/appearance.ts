// Base for Node-loaded state (materials, texture sets, ...). Ported from
// python/appearance.py.
import type { State } from "./state";

export class Appearance {
  load(_st: State): void {
    throw new Error("not implemented");
  }

  unload(_st: State): void {}
}
