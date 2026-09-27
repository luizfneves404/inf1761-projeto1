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
import { TextureSet } from "./textureset";
import { Texture } from "./texture";
import { Sampler } from "./sampler";
import { Quad } from "./quad";

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

class EarthRotation extends Engine {
  trf: Transform;

  constructor(trf: Transform) {
    super();
    this.trf = trf;
  }

  update(dt: number): void {
    this.trf.rotate(500 * dt, 0, 0, -1);
  }
}

class MercuryOrbit extends Engine {
  trf: Transform;

  constructor(trf: Transform) {
    super();
    this.trf = trf;
  }

  update(dt: number): void {
    this.trf.rotate(20 * dt, 0, 0, -1);
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
  // Untextured shader (the original 2D one): only backs the root node now -
  // every body below is drawn under pipelineTex instead.
  const shader = await Shader.load(device, "/shaders/2d/shader.wgsl");
  shader.setVertexBuffers([
    {
      arrayStride: 2 * 4,
      stepMode: "vertex",
      attributes: [{ format: "float32x2", offset: 0, varName: "pos" }],
    },
  ]);
  const pipeline = new Pipeline(shader, targetFormat, { depthStencil: null });

  // Textured shader (like main_3d's lit/textured pair): every body - multiplies
  // the material color by decal_texture at @group(3), so every node drawn
  // under this pipeline must bind a TextureSet.
  const shdTex = await Shader.load(device, "/shaders/2d/textured.wgsl");
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
  const pipelineTex = new Pipeline(shdTex, targetFormat, { depthStencil: null });

  camera = new Camera2D(0, 10, 0, 10);

  const disk = new Disk(device, 60);
  const quad = new Quad(device);

  const sunPos = new Transform();
  sunPos.translate(5, 5, 0);
  const sunPosNode = new Node({ trf: sunPos });

  const sunScale = new Transform();
  sunScale.scale(0.7, 0.7, 1);

  const sunTex = await Texture.load(device, "decal_texture", "/images/wikiimages-sun-11582.jpg");
  const sunSampler = new Sampler(device, "decal_sampler");

  const sunTextures = new TextureSet([sunTex, sunSampler]);
  shdTex.addTextureSet(sunTextures);

  const sunMaterial = new ColorMaterial(1, 1, 1);
  shdTex.addMaterial(sunMaterial);

  const sun = new Node({
    trf: sunScale,
    pipeline: pipelineTex,
    apps: [sunMaterial, sunTextures],
    shps: [disk],
  });

  sunPosNode.addNode(sun);

  const earthTranslation = new Transform();

  const earthTrf = new Transform();
  earthTrf.translate(3, 0, 0);
  const earthScale = new Transform();
  earthScale.scale(0.2, 0.2, 1);

  const earthTex = await Texture.load(
    device,
    "decal_texture",
    "/images/Terrestrial_03-128x128.png",
  );
  const earthSampler = new Sampler(device, "decal_sampler");

  const earthTextures = new TextureSet([earthTex, earthSampler]);
  shdTex.addTextureSet(earthTextures);

  // The textured shader still declares a "material" group (@group(1)) and
  // reads material.color, so textured nodes need a material too - white,
  // so the texture shows through unmodified (like main_3d's `white`).
  const earthMaterial = new ColorMaterial(1, 1, 1);
  shdTex.addMaterial(earthMaterial);

  const earthRotation = new Transform();

  const earthPosNode = new Node({
    trf: earthTrf,
    nodes: [
      new Node({
        trf: earthRotation,
        nodes: [
          new Node({
            trf: earthScale,
            pipeline: pipelineTex,
            apps: [earthMaterial, earthTextures],
            shps: [disk],
          }),
        ],
      }),
    ],
  });

  const earth = new Node({
    trf: earthTranslation,
    nodes: [earthPosNode],
  });

  sunPosNode.addNode(earth);

  const moonRotation = new Transform();

  const moonTrf = new Transform();
  moonTrf.translate(1, 0, 0);
  const moonScale = new Transform();
  moonScale.scale(0.15, 0.15, 1);

  const moonTex = await Texture.load(
    device,
    "decal_texture",
    "/images/pexels-full-moon-1869760.jpg",
  );
  const moonSampler = new Sampler(device, "decal_sampler");

  const moonTextures = new TextureSet([moonTex, moonSampler]);
  shdTex.addTextureSet(moonTextures);

  const moonMaterial = new ColorMaterial(1, 1, 1);
  shdTex.addMaterial(moonMaterial);

  const moon = new Node({
    trf: moonRotation,
    nodes: [
      new Node({
        trf: moonTrf,
        nodes: [
          new Node({
            trf: moonScale,
            pipeline: pipelineTex,
            apps: [moonMaterial, moonTextures],
            shps: [disk],
          }),
        ],
      }),
    ],
  });

  earthPosNode.addNode(moon);

  const mercuryTrf = new Transform();
  mercuryTrf.translate(1.5, 0, 0);
  const mercuryScale = new Transform();
  mercuryScale.scale(0.1, 0.1, 1);

  const mercuryTex = await Texture.load(
    device,
    "decal_texture",
    "/images/wikiimages-mercury-11591_640.png",
  );
  const mercurySampler = new Sampler(device, "decal_sampler");

  const mercuryTextures = new TextureSet([mercuryTex, mercurySampler]);
  shdTex.addTextureSet(mercuryTextures);

  const mercuryMaterial = new ColorMaterial(1, 1, 1);
  shdTex.addMaterial(mercuryMaterial);

  const mercuryTranslation = new Transform();

  const mercuryPosNode = new Node({
    trf: mercuryTrf,
    nodes: [
      new Node({
        trf: mercuryScale,
        pipeline: pipelineTex,
        apps: [mercuryMaterial, mercuryTextures],
        shps: [disk],
      }),
    ],
  });

  const mercury = new Node({
    trf: mercuryTranslation,
    nodes: [mercuryPosNode],
  });

  sunPosNode.addNode(mercury);

  const spaceTex = await Texture.load(device, "decal_texture", "/images/universe-2947500_1280.jpg");
  const spaceSampler = new Sampler(device, "decal_sampler");

  const spaceTextures = new TextureSet([spaceTex, spaceSampler]);
  shdTex.addTextureSet(spaceTextures);

  const spaceMaterial = new ColorMaterial(1, 1, 1);
  shdTex.addMaterial(spaceMaterial);

  const spaceScale = new Transform();
  spaceScale.scale(10, 10, 1);

  const spaceBackground = new Node({
    trf: spaceScale,
    pipeline: pipelineTex,
    apps: [spaceTextures, spaceMaterial],
    shps: [quad],
  });

  const root = new Node({ pipeline, nodes: [spaceBackground, sunPosNode] });
  scene = new Scene(root);
  scene.addEngine(new EarthOrbit(earthTranslation));
  scene.addEngine(new EarthRotation(earthRotation));
  scene.addEngine(new MercuryOrbit(mercuryTranslation));
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
