struct Matrix {
    vertex: mat4x4<f32>,
    normal: mat4x4<f32>,
}
@group(1) @binding(0)
var<storage, read> matrix: array<Matrix>;

struct Global {
    projection: mat4x4<f32>, // espaco de iluminacao -> NDC
    light_ambient: vec3<f32>,
    light_diffuse: vec3<f32>,
    light_specular: vec3<f32>,
    light_position: vec4<f32>,
    light_direction: vec4<f32>,
    cone_angle: f32,
    focus_exponent: f32,
    camera_position: vec4<
        f32,
    >, // posição da câmera no espaço de iluminação (não usada nesta fórmula)
    fog_color: vec4<f32>,
}
@group(0) @binding(0)
var<uniform> global: Global;

struct Material {
    base_color: vec3<f32>,
    opacity: f32,

    specular_color: vec3<f32>,
    shininess: f32,
}
@group(2) @binding(0)
var<uniform> material: Material;

@group(3) @binding(0)
var decal_texture: texture_2d<f32>;
@group(3) @binding(1)
var decal_sampler: sampler;

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) light: vec3<f32>,
    @location(2) view: vec3<f32>,
    @location(3) position: vec3<f32>,
    @location(4) texcoord: vec2<f32>,
}

// Iluminacao por fragmento (Phong shading): vs_main so transforma
// posicao/normal e entrega normal/luz/vista interpoladas; toda a formula
// de Blinn-Phong (ambiente+difusa+especular) e calculada em fs_main, por
// pixel - ao contrario de ilum_vert/lit.wgsl, que calcula a cor inteira
// por vertice (Gouraud shading) e so interpola a cor final.
@vertex
fn vs_main(
    @builtin(instance_index) instance_index: u32,
    @location(0) coord: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) texcoord: vec2<f32>,
) -> VertexOutput {
    let m = matrix[instance_index];
    var out: VertexOutput;
    let ilum_space_pos = (m.vertex * vec4<f32>(coord, 1.0)).xyz;
    var light: vec3<f32>;
    if global.light_position.w == 0.0 {
        light = normalize(global.light_position.xyz);
    } else {
        light = normalize(global.light_position.xyz - ilum_space_pos);
    }
    out.normal = (m.normal * vec4<f32>(normal, 0.0)).xyz;
    out.light = light;
    out.view = global.camera_position.xyz - ilum_space_pos;
    out.clip_position = global.projection * (m.vertex * vec4<f32>(coord, 1.0));
    out.position = ilum_space_pos;
    out.texcoord = texcoord;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // renormaliza: a interpolacao entre vertices desnormaliza normal/luz/vista
    let normal = normalize(in.normal);
    // interpolate the position, not the light direction: the direction isn't linear across a triangle"
    let light = normalize(global.light_position.xyz - in.position);
    let view = normalize(in.view);

    var color = material.base_color * global.light_ambient.rgb;
    let ndotl = dot(normal, light);
    let c = dot(-light, global.light_direction.xyz);
    var k_spot: f32;
    if c > cos(global.cone_angle) {
        k_spot = pow(max(c, 0.0), global.focus_exponent);
    } else {
        k_spot = 0.0;
    }

    if ndotl > 0.0 {
        color += material.base_color * k_spot * global.light_diffuse.rgb * ndotl;
        let refl = normalize(reflect(-light, normal));
        color += material.specular_color * k_spot * global.light_specular.rgb
            * pow(max(0.0, dot(refl, view)), material.shininess);
    }
    var final_color = vec4<f32>(color, 1.0)
        * textureSample(decal_texture, decal_sampler, in.texcoord);
    var s_fim = 7.0;
    var s_ini = 5.0;
    var f: f32 = clamp(((s_fim - length(in.view)) / (s_fim - s_ini)), 0.0, 1.0);
    var fogged_color = f * final_color + (1 - f) * global.fog_color;
    return fogged_color;
}
