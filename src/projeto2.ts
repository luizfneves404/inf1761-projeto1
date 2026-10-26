// Ported from python/main_3d.py: a lit cube/sphere plus a textured
// decal quad over a floor, with an arcball-controlled camera.

import * as gm from "./graphicsmath";
import { Camera3D } from "./camera3d";
import { SpotLight } from "./spotlight";
import { TextureSet } from "./textureset";
import { Shader } from "./shader";
import { Texture } from "./texture";
import { Sampler } from "./sampler";
import { Pipeline } from "./pipeline";
import { PhongMaterial } from "./phongmaterial";
import { Transform } from "./transform";
import { Node } from "./node";
import { Scene } from "./scene";
import { Renderer } from "./renderer";
import { Cube } from "./cube";
import { Sphere } from "./sphere";
import { Quad } from "./quad";
import { ClipPlane } from "./clipplane";
import { PointLight } from "./pointlight";

let canvas: HTMLCanvasElement | null = null;
let device: GPUDevice | null = null;
let context: GPUCanvasContext | null = null;
let renderer: Renderer | null = null;
let camera: Camera3D | null = null;
let scene: Scene | null = null;

let animationFrameId: number | null = null;
let disposed = false;

function cleanup(): void {
  if (disposed) return;
  disposed = true;

  // Stop the render loop.
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Remove global event listeners.
  window.removeEventListener("keydown", onKey);

  // Release the canvas context configuration.
  context?.unconfigure();
  context = null;

  // Release the GPU device and its resources.
  device?.destroy();
  device = null;

  renderer = null;
  camera = null;
  scene = null;
  canvas = null;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanup();
  });
}

const viewerPos = gm.vec3(2.0, 3.5, 4.0);

async function initialize(device: GPUDevice, targetFormat: GPUTextureFormat): Promise<void> {
  if (canvas === null) throw new Error("canvas not found");
  camera = new Camera3D(viewerPos[0], viewerPos[1], viewerPos[2]);
  const arcball = camera.createArcball();
  arcball.attach(canvas);

  const light = new SpotLight(
    { x: 3.0, y: 5.0, z: 3.0 },
    {
      x: -1.0,
      y: -1.7,
      z: -1.0,
    },
    0.174,
    20,
    "world",
  );
  const pointlight = new PointLight(3.0, 5.0, 3.0, "world");

  const white = new PhongMaterial(1.0, 1.0, 1.0);
  const green = new PhongMaterial(0.5, 1.0, 0.5);
  const red = new PhongMaterial(1.0, 0.5, 0.5);
  const yellow = new PhongMaterial(1.0, 1.0, 0.5);
  const paper = await Texture.load(device, "decal_texture", "/images/paper.jpg");
  const paperSampler = new Sampler(device, "decal_sampler");
  const ball = await Texture.load(device, "decal_texture", "/images/soccer_ball.jpg");
  const ballSampler = new Sampler(device, "decal_sampler");

  const trf1 = new Transform();
  trf1.scale(3.0, 0.3, 3.0);
  trf1.translate(0.0, -1.0, 0.0);
  const trf2 = new Transform();
  trf2.scale(0.3, 0.3, 0.3);
  trf2.translate(0.0, 2.7, 0.0);
  const trf3 = new Transform();
  trf3.translate(0.8, 0.0, 0.8);
  trf3.rotate(30.0, 0.0, 1.0, 0.0);
  trf3.rotate(90.0, -1.0, 0.0, 0.0);
  trf3.scale(0.5, 0.7, 1.0);

  const cube = new Cube(device);
  const quad = new Quad(device);
  const sphere = new Sphere(device);

  const shader = await Shader.load(device, "/shaders/ilum_frag/lit_spot_fog.wgsl", {
    light,
    space: "world",
  });
  shader.setVertexBuffers([
    {
      arrayStride: 3 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x3", offset: 0, varName: "coord" }],
    },
    {
      arrayStride: 3 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x3", offset: 0, varName: "normal" }],
    },
  ]);
  const pipeline = new Pipeline(shader, targetFormat, { primitive: { cullMode: "none" } });

  // depthBias/depthBiasSlopeScale replace the old dynamic PolygonOffset
  // (avoids z-fighting between the paper decal and the "floor" right below it)
  const shdTex = await Shader.load(device, "/shaders/ilum_frag/textured_fog.wgsl", {
    light,
    space: "world",
  });
  shdTex.setVertexBuffers([
    {
      arrayStride: 2 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x2", offset: 0, varName: "coord" }],
    },
    {
      arrayStride: 2 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x2", offset: 0, varName: "texcoord" }],
    },
  ]);
  const pipelineTex = new Pipeline(shdTex, targetFormat, {
    primitive: { cullMode: "none" },
    depthStencil: { depthBias: -1, depthBiasSlopeScale: -1 },
  });

  const shdTex3D = await Shader.load(device, "/shaders/ilum_frag/lit_spot_textured.wgsl", {
    light,
    space: "world",
  });

  shdTex3D.setVertexBuffers([
    {
      arrayStride: 3 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x3", offset: 0, varName: "coord" }],
    },
    {
      arrayStride: 3 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x3", offset: 0, varName: "normal" }],
    },
    { arrayStride: 3 * 4, stepMode: "vertex", attributes: [] },
    {
      arrayStride: 2 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x2", offset: 0, varName: "texcoord" }],
    },
  ]);
  shdTex3D.setValue("fog_color", new Float32Array([1.0, 1.0, 1.0, 1.0]));
  shader.setValue("fog_color", new Float32Array([1.0, 1.0, 1.0, 1.0]));
  shdTex.setValue("fog_color", new Float32Array([1.0, 1.0, 1.0, 1.0]));
  const clip_plane: [number, number, number, number] = [1.0, 0.5, 1.0, 0.0];
  new ClipPlane(shader, clip_plane[0], clip_plane[1], clip_plane[2], clip_plane[3]);
  new ClipPlane(shdTex, clip_plane[0], clip_plane[1], clip_plane[2], clip_plane[3]);
  new ClipPlane(shdTex3D, clip_plane[0], clip_plane[1], clip_plane[2], clip_plane[3]);

  const pipelineTex3D = new Pipeline(shdTex3D, targetFormat, {
    primitive: { cullMode: "none" },
    depthStencil: { depthBias: -1, depthBiasSlopeScale: -1 },
  });

  // white is used under both shaders (the plain sphere and the
  // textured quad), so it's registered on each independently.
  shader.addMaterial(white);
  shader.addMaterial(green);
  shader.addMaterial(red);
  shader.addMaterial(yellow);
  shdTex.addMaterial(white);
  shdTex3D.addMaterial(green);
  const paperTextures = new TextureSet([paper, paperSampler]);
  shdTex.addTextureSet(paperTextures);
  const ballTextures = new TextureSet([ball, ballSampler]);
  shdTex3D.addTextureSet(ballTextures);

  function treeLeg(translateX: number, translateY: number, translateZ: number) {
    const trf4 = new Transform();
    trf4.scale(0.3, 1.5, 0.3);
    trf4.translate(translateX, translateY, translateZ);

    return new Node({ trf: trf4, apps: [white], shps: [cube] });
  }

  const trf5 = new Transform();
  trf5.scale(1.0, 0.5, 1.0);
  trf5.translate(0, 0.001, 0.0);

  const trf6 = new Transform();
  trf6.scale(0.4, 0.4, 0.4);
  trf6.translate(2.5, 1.0, -2.5);

  const root = new Node({
    pipeline,
    nodes: [
      new Node({ trf: trf1, apps: [white], shps: [cube] }),
      new Node({ trf: trf5, apps: [yellow], shps: [cube] }),
      treeLeg(4.5, -1.2 - 0.001, 4.5),
      treeLeg(-4.5, -1.2 - 0.001, 4.5),
      treeLeg(4.5, -1.2 - 0.001, -4.5),
      treeLeg(-4.5, -1.2 - 0.001, -4.5),
      new Node({ pipeline: pipelineTex, trf: trf3, apps: [white, paperTextures], shps: [quad] }),
      new Node({ pipeline: pipelineTex3D, trf: trf2, apps: [green, ballTextures], shps: [sphere] }),
      new Node({ trf: trf6, apps: [red], shps: [sphere] }),
    ],
  });
  scene = new Scene(root);
}

function draw(): void {
  if (disposed || context === null || renderer === null || camera === null || scene === null) {
    return;
  }
  if (context === null || renderer === null || camera === null || scene === null)
    throw new Error("context not initialized");
  const targetTexture = context.getCurrentTexture();

  renderer.render(targetTexture, scene, camera);
  animationFrameId = requestAnimationFrame(draw);
}

function onKey(_event: KeyboardEvent): void {
  // "q" quitting a window doesn't map to a browser tab - left as a no-op.
}

async function main(): Promise<void> {
  canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (canvas === null) throw new Error("canvas not found");
  const adapter = await navigator.gpu.requestAdapter();
  if (adapter === null) throw new Error("no GPU adapter");
  device = await adapter.requestDevice();
  context = canvas.getContext("webgpu");
  if (context === null) throw new Error("webgpu context unavailable");
  // Preferred format WITH "-srgb": the GPU encodes linear->sRGB
  // automatically on output - correct as long as the shader does its
  // lighting math in linear space.
  const targetFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format: targetFormat });

  renderer = new Renderer(device, { depthTest: true, clearValue: [1.0, 1.0, 1.0, 1.0] });

  await initialize(device, targetFormat);

  window.addEventListener("keydown", onKey);
  animationFrameId = requestAnimationFrame(draw);
}

void main();
