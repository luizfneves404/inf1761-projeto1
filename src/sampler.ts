// Sampling rule (addressing/filter), independent of any Texture class. A
// pure resource-holder - no load/unload of its own, see TextureSet.
// Ported from python/sampler.py.

export interface SamplerOptions {
  addressModeU?: GPUAddressMode;
  addressModeV?: GPUAddressMode;
  magFilter?: GPUFilterMode;
  minFilter?: GPUFilterMode;
  mipmapFilter?: GPUFilterMode;
  compare?: GPUCompareFunction | null;
}

export class Sampler {
  varname: string;
  sampler: GPUSampler;

  // Creates a regular filtering sampler, or a comparison sampler (usable
  // with texture_depth types, e.g. shadow map PCF) when `compare` is given.
  constructor(device: GPUDevice, varname: string, options: SamplerOptions = {}) {
    this.varname = varname;
    const {
      addressModeU = "repeat",
      addressModeV = "repeat",
      magFilter = "linear",
      minFilter = "linear",
      mipmapFilter = "linear",
      compare = null,
    } = options;
    const desc: GPUSamplerDescriptor = {
      addressModeU,
      addressModeV,
      magFilter,
      minFilter,
      mipmapFilter,
    };
    if (compare !== null) desc.compare = compare;
    this.sampler = device.createSampler(desc);
  }

  // The GPU resource TextureSet/Shader.addTextureSet binds - this sampler
  // itself.
  get resource(): GPUSampler {
    return this.sampler;
  }
}
