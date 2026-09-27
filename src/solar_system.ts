// Ported from python/main_2d.py: a 2D scene with a colored "face" quad
// and a rotating triangle "pointer", driven by a per-frame Engine.

import { Camera2D } from "./camera2d";
import { ColorMaterial } from "./colormaterial";
import { Transform } from "./transform";
import { Node } from "./node";
import { Shader } from "./shader";
import { Pipeline } from "./pipeline";
import { Scene } from "./scene";
import { Renderer } from "./renderer";
import { Engine } from "./engine";
import { Disk } from "./disk";

let device: GPUDevice,
  context: GPUCanvasContext | null = null,
  renderer: Renderer | null = null,
  camera: Camera2D | null = null,
  scene: Scene | null = null;
let lastT = 0.0;

class EarthOrbit extends Engine {
  trf: Transform;

  constructor(trf: Transform) {
    super();
    this.trf = trf;
  }

  update(dt: number): void {
    this.trf.rotate(6 * dt, 0, 0, -1);
  }
}

class MoonOrbit extends Engine {
  trf: Transform;

  constructor(trf: Transform) {
    super();
    this.trf = trf;
  }

  update(dt: number): void {
    this.trf.rotate(70 * dt, 0, 0, -1);
  }
}

async function initialize(device: GPUDevice, targetFormat: GPUTextureFormat): Promise<void> {
  camera = new Camera2D(0, 10, 0, 10);

  const disk = new Disk(device, 60);

  const sunPos = new Transform();
  sunPos.translate(5, 5, 0);
  const sunPosNode = new Node({ trf: sunPos });

  const sunScale = new Transform();
  sunScale.scale(0.7, 0.7, 1);

  const sunMaterial = new ColorMaterial(1, 1, 0);

  const sun = new Node({
    trf: sunScale,
    apps: [sunMaterial],
    shps: [disk],
  });

  sunPosNode.addNode(sun);

  const earthRotation = new Transform();

  const earthTrf = new Transform();
  earthTrf.translate(3, 0, 0);
  const earthScale = new Transform();
  earthScale.scale(0.2, 0.2, 1);

  const earthMaterial = new ColorMaterial(0, 0, 1);

  const earthPosNode = new Node({
    trf: earthTrf,
    nodes: [new Node({ trf: earthScale, apps: [earthMaterial], shps: [disk] })],
  });

  const earth = new Node({
    trf: earthRotation,
    nodes: [earthPosNode],
  });

  sunPosNode.addNode(earth);

  const moonRotation = new Transform();

  const moonTrf = new Transform();
  moonTrf.translate(0.5, 0, 0);
  const moonScale = new Transform();
  moonScale.scale(0.15, 0.15, 1);

  const moonMaterial = new ColorMaterial(0.5, 0.5, 0.5);

  const moon = new Node({
    trf: moonRotation,
    nodes: [
      new Node({
        trf: moonTrf,
        nodes: [new Node({ trf: moonScale, apps: [moonMaterial], shps: [disk] })],
      }),
    ],
  });

  earthPosNode.addNode(moon);

  const shader = await Shader.load(device, "/shaders/2d/shader.wgsl");
  shader.setVertexBuffers([
    {
      arrayStride: 2 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x2", offset: 0, varName: "pos" }],
    },
  ]);
  const pipeline = new Pipeline(shader, targetFormat, { depthStencil: null });
  shader.addMaterial(sunMaterial);
  shader.addMaterial(earthMaterial);
  shader.addMaterial(moonMaterial);

  const root = new Node({ pipeline, nodes: [sunPosNode] });
  scene = new Scene(root);
  scene.addEngine(new EarthOrbit(earthRotation));
  scene.addEngine(new MoonOrbit(moonRotation));
}

function update(dt: number): void {
  if (scene === null) throw new Error("scene not initialized");
  scene.update(dt);
}

function draw(): void {
  if (context === null || renderer === null || camera === null || scene === null)
    throw new Error("context not initialized");
  const t = performance.now() / 1000;
  update(t - lastT);
  lastT = t;

  const targetTexture = context.getCurrentTexture();
  renderer.render(targetTexture, scene, camera);
  requestAnimationFrame(draw);
}

function onKey(_event: KeyboardEvent): void {
  // "q" quitting a window doesn't map to a browser tab - left as a no-op.
}

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
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

  renderer = new Renderer(device, { clearValue: [0.8, 1.0, 1.0, 1.0] });

  await initialize(device, targetFormat);

  window.addEventListener("keydown", onKey);
  lastT = performance.now() / 1000;
  requestAnimationFrame(draw);
}

void main();
