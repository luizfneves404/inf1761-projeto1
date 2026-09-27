// A named bundle of already-constructed Texture/Sampler/TexCube/TexDepth
// resources, freely combined - the only thing a Node's `apps` holds for
// texturing. Must be registered with a shader via Shader.addTextureSet
// before use. Ported from python/textureset.py.

import { Appearance } from "./appearance";
import type { State } from "./state";
import type { Sampler } from "./sampler";
import type { Texture } from "./texture";
import type { TexCube } from "./texcube";
import type { TexDepth } from "./texdepth";

export type TextureSetItem = Texture | Sampler | TexCube | TexDepth;

export class TextureSet extends Appearance {
  // `items` is an array of Texture/Sampler/TexCube/TexDepth objects, each
  // already built - this class doesn't create GPU resources itself, it
  // just bundles references to them.
  items: TextureSetItem[];

  constructor(items: TextureSetItem[]) {
    super();
    this.items = items;
  }

  // Delegates to the active shader - see Shader.bindTextureSet.
  load(st: State): void {
    st.getShader().bindTextureSet(st, this);
  }

  // Delegates to the active shader - see Shader.unbindTextureSet.
  unload(st: State): void {
    st.getShader().unbindTextureSet(st);
  }
}
