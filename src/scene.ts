// Top-level container: a root Node plus the Engines (simulation/logic
// updated once per frame, e.g. animation or physics) that drive it.
// Ported from python/scene.py.

import type { Node } from "./node";
import type { Engine } from "./engine";
import type { State } from "./state";

export class Scene {
  root: Node;
  engines: Engine[];

  constructor(root: Node) {
    this.root = root;
    this.engines = [];
  }

  getRoot(): Node {
    return this.root;
  }

  addEngine(engine: Engine): void {
    this.engines.push(engine);
  }

  // Advances every registered Engine by `dt` seconds. Call once per
  // frame, before render.
  update(dt: number): void {
    for (const e of this.engines) e.update(dt);
  }

  // Walks the scene graph from the root, issuing draw calls through
  // `state`. Call once per render pass/camera, after update.
  render(state: State): void {
    this.root.render(state);
  }
}
