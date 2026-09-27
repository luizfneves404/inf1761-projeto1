struct Matrix {
    vertex: mat4x4<f32>,       // objeto -> espaco global (2D nao ilumina)
}
@group(0) @binding(0) var<storage, read> matrix: array<Matrix>;

struct Global {
    projection: mat4x4<f32>,   // espaco de iluminacao -> NDC
}
@group(2) @binding(0) var<uniform> global: Global;

struct ColorBlock {
    color: vec3<f32>,
    opacity: f32,
}
@group(1) @binding(0) var<uniform> material: ColorBlock;

@group(3) @binding(0) var decal_texture: texture_2d<f32>;
@group(3) @binding(1) var decal_sampler: sampler;

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(2) view: vec3<f32>,
    @location(3) texcoord: vec2<f32>,
}

@vertex
fn vs_main(@builtin(instance_index) instance_index: u32, @location(0) coord: vec2<f32>, @location(1) texcoord: vec2<f32>) -> VertexOutput {
    var out: VertexOutput;
    out.texcoord = texcoord;
    out.clip_position = global.projection * (matrix[instance_index].vertex * vec4<f32>(coord, 0.0, 1.0));
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(material.color, 1.0) * textureSample(decal_texture, decal_sampler, in.texcoord);
}
