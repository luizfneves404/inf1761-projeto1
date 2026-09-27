// Owns the per-frame WebGPU mechanics for a single render pass: the
// encoder/renderPass/submit dance and the depth-texture lifecycle. The
// depth texture (when depthTest=true) is created lazily and resized to
// match `targetTexture`, so no separate resize call is needed. Ported
// from python/renderer.py.

import type { Camera, CanvasSize } from "./camera";
import type { Scene } from "./scene";
import { State } from "./state";

// Options Renderer's constructor accepts: depth/clear configuration; the
// depth texture itself is created lazily on the first render call.
export interface RendererOptions {
  depthTest?: boolean;
  clearValue?: GPUColor;
  depthFormat?: GPUTextureFormat;
}

export class Renderer {
  device: GPUDevice;
  depthTest: boolean;
  clearValue: GPUColor;
  depthFormat: GPUTextureFormat;
  _depthTexture: GPUTexture | null;
  _depthView: GPUTextureView | null;

  // Stores the depth/clear configuration; the depth texture itself is
  // created lazily on the first render call.
  constructor(
    device: GPUDevice,
    {
      depthTest = false,
      clearValue = [0, 0, 0, 1],
      depthFormat = "depth24plus",
    }: RendererOptions = {},
  ) {
    this.device = device;
    this.depthTest = depthTest;
    this.clearValue = clearValue;
    this.depthFormat = depthFormat;
    this._depthTexture = null;
    this._depthView = null;
  }

  _ensureDepthTexture(size: CanvasSize): void {
    if (!this.depthTest) return;
    if (
      this._depthTexture !== null &&
      this._depthTexture.width === size[0] &&
      this._depthTexture.height === size[1]
    )
      return;
    if (this._depthTexture !== null) this._depthTexture.destroy();
    this._depthTexture = this.device.createTexture({
      size: [size[0], size[1], 1],
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this._depthView = this._depthTexture.createView();
  }

  // Encodes and submits one render pass into `targetTexture` (clearing
  // it, and the depth buffer if depthTest is set), rendering `scene`
  // through `camera`. Resizes the depth texture as needed to match
  // `targetTexture` - call once per frame, no separate resize wiring
  // needed.
  render(targetTexture: GPUTexture, scene: Scene, camera: Camera): void {
    const size: CanvasSize = [targetTexture.width, targetTexture.height];
    this._ensureDepthTexture(size);

    const encoder = this.device.createCommandEncoder();

    const passDesc: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: targetTexture.createView(),
          clearValue: this.clearValue,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };
    // WebGPU's dictionary members reject an explicit null - "absent" means
    // the key must be omitted entirely, not set to null.
    if (this.depthTest) {
      const depthView = this._depthView; // just ensured non-null by _ensureDepthTexture above
      if (depthView !== null) {
        passDesc.depthStencilAttachment = {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        };
      }
    }

    const renderPass = encoder.beginRenderPass(passDesc);
    const st = new State(camera, this.device, renderPass, size);
    scene.render(st);
    // the traversal only packed rows on the CPU; one write per shader here,
    // before submit (writeBuffer is on the queue, draws are in the encoder)
    for (const shd of st.getMatrixShaders()) shd.flushMatrices();
    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
