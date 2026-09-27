import type { State } from "./state";
import { Shape } from "./shape";
import { createBufferWithData } from "./gpuutil";

const radius = 1;

function getCircleCoords(n: number, radius: number): number[] {
  return [
    0,
    0,
    ...Array.from({ length: n }, (_: number, i: number) => [
      radius * Math.cos((i / n) * 2 * Math.PI),
      radius * Math.sin((i / n) * 2 * Math.PI),
    ]).flat(),
  ];
}

function getCircleIndexes(n: number): number[] {
  return Array.from({ length: n }, (_: number, i: number) => {
    const current = i + 1;
    const next = current + 1 > n ? 1 : current + 1;
    return [0, current, next];
  }).flat();
}

function getCircleTexCoords(n: number, radius: number): number[] {
  return [
    0.5,
    0.5,
    ...Array.from({ length: n }, (_: number, i: number) => [
      0.5 + 0.5 * radius * Math.cos((i / n) * 2 * Math.PI),
      0.5 - 0.5 * radius * Math.sin((i / n) * 2 * Math.PI),
    ]).flat(),
  ];
}

export class Disk extends Shape {
  coordVbo: GPUBuffer;
  texcoordVbo: GPUBuffer;
  ibo: GPUBuffer;
  triangleCount: number;

  constructor(device: GPUDevice, triangleCount: number) {
    super();
    const coord = new Float32Array(getCircleCoords(triangleCount, radius));
    const texcoord = new Float32Array(getCircleTexCoords(triangleCount, radius));
    const index = new Uint32Array(getCircleIndexes(triangleCount));
    this.coordVbo = createBufferWithData(device, coord, GPUBufferUsage.VERTEX);
    this.texcoordVbo = createBufferWithData(device, texcoord, GPUBufferUsage.VERTEX);
    this.ibo = createBufferWithData(device, index, GPUBufferUsage.INDEX);
    this.triangleCount = triangleCount;
  }

  draw(st: State): void {
    const firstInstance = st.getShader().commitMatrix(st);
    st.renderPass.setVertexBuffer(0, this.coordVbo);
    st.renderPass.setVertexBuffer(1, this.texcoordVbo);
    st.renderPass.setIndexBuffer(this.ibo, "uint32");
    st.renderPass.drawIndexed(3 * this.triangleCount, 1, 0, 0, firstInstance);
  }
}
