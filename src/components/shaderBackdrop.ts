/*
 * The looks LpShaderBackdrop can draw, and the small decisions around them
 * that are worth testing without a GPU.
 *
 * Every look is a fragment shader over one full-screen triangle, fed the same
 * uniforms: size, time, pixel ratio, intensity, and five theme colours read
 * from the kit's tokens (surface, brand, accent, action, ink). A look never
 * names a colour of its own, so it follows any theme, light or dark.
 *
 * Every look also has a CSS fallback built from the same tokens through
 * `var()`, shown where WebGL is missing, too slow, or unwanted (reduced
 * motion). It is a still that resembles the look, so a page reads the same
 * with or without the GPU, and it is also what shows under the canvas while
 * the first frame is being drawn.
 *
 * The shaders are WebGL 1 / GLSL ES 1.00 and deliberately cheap: a handful of
 * sines and exponentials per pixel, no loops over octaves, no textures. The
 * kit runs inside WebKitGTK, where WebGL may be software-rendered; the soft
 * looks are drawn at half resolution for the same reason.
 */

export type ShaderPreset = "aurora" | "silk" | "grain" | "dots" | "dither" | "contours" | "drift" | "vortex"

export interface PresetDef {
  /** Body of the fragment shader, after the shared header. */
  fragment: string
  /** Rendering resolution relative to CSS pixels × pixel ratio. Soft looks lose nothing at half. */
  scale: number
  /** CSS `background` of the still that stands in for the look. */
  fallback: string
}

export const VERTEX_SHADER = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

/* Uniforms every look receives. u_bg..u_ink are the theme, in 0–1 sRGB. */
export const FRAGMENT_HEADER = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_px;
uniform float u_k;
uniform vec3 u_bg;
uniform vec3 u_brand;
uniform vec3 u_accent;
uniform vec3 u_action;
uniform vec3 u_ink;
`

const mix = (token: string, share: number) => `color-mix(in oklab, var(--color-${token}) ${share}%, transparent)`

/*
 * Film grain for the CSS still: SVG turbulence, rendered once by the engine
 * as an image. Grey, at low opacity, so it textures any surface colour.
 */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export const PRESETS: Record<ShaderPreset, PresetDef> = {
  /*
   * Curtains of light across the upper part: each band has a sharp upper
   * edge and a long fall-off below it, waves sideways, and is striated by
   * fine vertical rays that drift.
   */
  aurora: {
    scale: 0.5,
    fragment: `
float band(vec2 uv, float x, float off, float sp) {
  float y = 0.66 + off + 0.09 * sin(x * 1.9 + u_time * sp + off * 9.0) + 0.04 * sin(x * 4.7 - u_time * sp * 1.7 + off * 4.0);
  float d = uv.y - y;
  float body = exp(-d * d * (d > 0.0 ? 160.0 : 22.0));
  float rays = 0.86 + 0.14 * sin(x * 70.0 + 6.0 * sin(x * 2.3 + u_time * 0.4));
  return body * rays;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float x = gl_FragCoord.x / u_res.y;
  vec3 col = u_bg;
  col = mix(col, u_brand, band(uv, x, 0.0, 0.35) * 0.7 * u_k);
  col = mix(col, u_accent, band(uv, x, -0.18, 0.27) * 0.45 * u_k);
  col = mix(col, u_action, band(uv, x, 0.12, 0.43) * 0.45 * u_k);
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      `radial-gradient(70% 38% at 30% 28%, ${mix("brand", 42)}, transparent 70%)`,
      `radial-gradient(55% 30% at 72% 44%, ${mix("accent", 30)}, transparent 70%)`,
      `radial-gradient(50% 26% at 55% 18%, ${mix("action", 26)}, transparent 70%)`,
    ].join(", "),
  },

  /*
   * A sheet of fabric: diagonal folds that slowly ripple, the brand colour
   * in the body and a narrow highlight running along each crest.
   */
  silk: {
    scale: 0.5,
    fragment: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * 2.2;
  float t = u_time * 0.6;
  float f = p.x * 0.9 + p.y * 0.5 + 0.6 * sin(p.y * 1.7 + t) + 0.35 * sin(p.x * 2.3 - t * 0.8 + p.y);
  float fold = sin(f * 3.4);
  float sheen = pow(0.5 + 0.5 * fold, 6.0);
  vec3 tint = mix(u_brand, u_accent, clamp(uv.x * 0.7 + 0.15 * sin(t * 0.5), 0.0, 1.0));
  vec3 col = mix(u_bg, tint, (0.22 + 0.14 * fold) * u_k);
  col += sheen * mix(u_brand, vec3(1.0), 0.4) * 0.28 * u_k;
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      `linear-gradient(115deg, transparent 12%, ${mix("brand", 30)} 30%, transparent 46%, ${mix("accent", 22)} 64%, transparent 80%)`,
      `linear-gradient(160deg, ${mix("brand", 16)}, transparent 70%)`,
    ].join(", "),
  },

  /*
   * Two soft colour pools drifting over the surface, under moving film
   * grain. The grain is per device pixel and refreshes a dozen-odd times a
   * second, like film, rather than every frame, which would read as static.
   */
  grain: {
    scale: 1,
    fragment: `
float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time * 0.25;
  vec2 a = vec2((0.3 + 0.2 * sin(t)) * aspect, 0.7 + 0.15 * cos(t * 1.3));
  vec2 b = vec2((0.75 + 0.15 * cos(t * 0.8)) * aspect, 0.3 + 0.2 * sin(t * 1.1));
  float da = exp(-dot(p - a, p - a) * 3.0);
  float db = exp(-dot(p - b, p - b) * 4.0);
  vec3 col = mix(u_bg, u_brand, da * 0.6 * u_k);
  col = mix(col, u_accent, db * 0.5 * u_k);
  col = mix(col, u_action, (1.0 - uv.y) * 0.12 * u_k);
  vec2 cell = floor(gl_FragCoord.xy / max(1.0, u_px));
  float g = hash(cell + vec2(floor(u_time * 14.0) * 17.31, 0.0)) - 0.5;
  col += g * 0.09;
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      NOISE,
      `radial-gradient(55% 55% at 28% 30%, ${mix("brand", 40)}, transparent 70%)`,
      `radial-gradient(50% 50% at 76% 72%, ${mix("accent", 32)}, transparent 70%)`,
      `linear-gradient(to top, ${mix("action", 10)}, transparent 60%)`,
    ].join(", "),
  },

  /*
   * A dot grid with a slow ripple travelling out from the middle: dots on
   * the crest swell and take the brand colour, the rest stay small and quiet.
   */
  dots: {
    scale: 1,
    fragment: `
void main() {
  float cell = 22.0 * u_px;
  vec2 g = gl_FragCoord.xy / cell;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float dist = length(id + 0.5 - 0.5 * u_res / cell);
  float wave = pow(0.5 + 0.5 * sin(dist * 0.5 - u_time * 1.6), 3.0);
  float r = 0.08 + 0.07 * wave * u_k;
  float aa = 1.0 / cell;
  float dotMask = 1.0 - smoothstep(r - aa, r + aa, length(f));
  vec3 rest = mix(u_bg, u_ink, 0.2);
  vec3 col = mix(u_bg, u_brand, wave * 0.03 * u_k);
  col = mix(col, mix(rest, u_brand, wave * u_k), dotMask);
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      `radial-gradient(circle, ${mix("ink", 22)} 1.5px, transparent 2.2px) center / 22px 22px`,
      `radial-gradient(45% 45% at 50% 50%, ${mix("brand", 16)}, transparent 75%)`,
    ].join(", "),
  },
  /*
   * Rolling hills drawn in dots, the retro terminal look: a few layered
   * ridges drift sideways, each crest lit and fading downward, and the shade
   * is made of on/off dots thresholded by a 4×4 Bayer matrix rather than a
   * smooth gradient. Bayer is built from fract arithmetic: GLSL ES 1.00 has
   * neither integer bit operations nor dynamically indexed constant arrays.
   * The cell index is reduced mod 2 before it is squared: in mediump a large
   * index squared loses its fraction, and the top of the screen turned to noise.
   */
  dither: {
    scale: 1,
    fragment: `
float bayer2(vec2 a) { a = mod(floor(a), 2.0); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float ridge(float x, float base, float off, float sp) {
  return base + 0.11 * sin(x * 1.5 + off + u_time * sp) + 0.05 * sin(x * 3.7 - off * 1.7 + u_time * sp * 1.6) + 0.015 * sin(x * 9.0 + off * 3.0);
}
void main() {
  float cell = 4.0 * u_px;
  vec2 c = floor(gl_FragCoord.xy / cell);
  vec2 uv = (c + 0.5) * cell / u_res;
  float x = uv.x * u_res.x / u_res.y;
  float shade = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float d = ridge(x, 0.72 - fi * 0.17, fi * 2.3, 0.05 + fi * 0.03) - uv.y;
    float glow = d > 0.0 ? exp(-d * 16.0) : 0.0;
    shade = max(shade, glow * (0.35 + fi * 0.15));
  }
  float on = step(bayer4(c) + 0.03125, shade * u_k);
  vec2 f = fract(gl_FragCoord.xy / cell);
  float dotMask = step(f.x, 0.55) * step(f.y, 0.55);
  vec3 lit = mix(u_bg, mix(u_ink, u_brand, 0.2), 0.42);
  gl_FragColor = vec4(mix(u_bg, lit, on * dotMask), 1.0);
}`,
    fallback: [
      `radial-gradient(circle, ${mix("ink", 16)} 1px, transparent 1.4px) 0 0 / 4px 4px`,
      `radial-gradient(120% 60% at 30% 110%, var(--color-surface) 40%, transparent 70%)`,
    ].join(", "),
  },

  contours: {
    scale: 1,
    fragment: `
float height(vec2 p) {
  float t = u_time * 0.08;
  return 0.5 * sin(p.x * 1.3 + t) * cos(p.y * 1.1 - t * 0.7)
    + 0.3 * sin(p.x * 2.7 - p.y * 1.9 + t * 1.3)
    + 0.2 * cos(length(p - vec2(0.6, -0.4)) * 3.1 - t * 1.6);
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y * 3.0;
  float e = 3.0 / u_res.y;
  float h = height(p);
  vec2 grad = vec2(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h) / e;
  float steps = 9.0;
  float v = h * steps;
  float d = abs(fract(v + 0.5) - 0.5) / max(length(grad) * steps * e, 1e-4);
  float major = step(4.5, mod(floor(v + 0.5), 5.0));
  float line = 1.0 - smoothstep(0.6, 1.4 + major * 0.6, d);
  vec3 tint = mix(u_ink, u_brand, smoothstep(-0.2, 0.8, h));
  vec3 col = mix(u_bg, tint, line * (0.16 + major * 0.12) * u_k);
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      `repeating-radial-gradient(circle at 35% 60%, transparent 0 22px, ${mix("ink", 14)} 22px 23px)`,
      `repeating-radial-gradient(circle at 78% 30%, transparent 0 26px, ${mix("brand", 12)} 26px 27px)`,
    ].join(", "),
  },

  /*
   * Banks of mist drifting sideways at three depths: the far layer slow and
   * faint, the near one faster and stronger, so the parallax reads as depth.
   * Each bank is a soft horizontal ribbon whose edge is broken by a few sines.
   */
  drift: {
    scale: 0.5,
    fragment: `
float bank(vec2 uv, float y, float sp, float seed) {
  float x = uv.x * u_res.x / u_res.y;
  float edge = y + 0.05 * sin(x * 3.1 + u_time * sp + seed) + 0.03 * sin(x * 7.7 - u_time * sp * 1.4 + seed * 2.0);
  float body = exp(-pow((uv.y - edge) * 7.0, 2.0));
  float puffs = 0.7 + 0.3 * sin(x * 4.3 - u_time * sp * 2.0 + seed * 5.0);
  return body * puffs;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = u_bg;
  col = mix(col, u_ink, bank(uv, 0.7, 0.05, 1.0) * 0.14 * u_k);
  col = mix(col, u_accent, bank(uv, 0.45, 0.09, 4.0) * 0.3 * u_k);
  col = mix(col, u_brand, bank(uv, 0.2, 0.15, 9.0) * 0.42 * u_k);
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      `radial-gradient(90% 18% at 40% 30%, ${mix("ink", 8)}, transparent 70%)`,
      `radial-gradient(100% 20% at 65% 55%, ${mix("accent", 16)}, transparent 70%)`,
      `radial-gradient(110% 22% at 35% 80%, ${mix("brand", 22)}, transparent 70%)`,
    ].join(", "),
  },

  /*
   * A slow whirlpool: logarithmic spiral arms turning around the middle,
   * brand on the arms and accent between them, fading out toward the centre
   * and the edges so content placed over it stays readable.
   */
  vortex: {
    scale: 0.5,
    fragment: `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  float t = u_time * 0.35;
  float arms = 0.5 + 0.5 * sin(a * 4.0 + log(r) * 6.0 - t * 2.0);
  float fine = 0.5 + 0.5 * sin(a * 9.0 + log(r) * 11.0 - t * 3.1);
  float fade = smoothstep(0.02, 0.18, r) * (1.0 - smoothstep(0.45, 0.95, r));
  vec3 col = mix(u_bg, u_accent, (1.0 - arms) * 0.10 * fade * u_k);
  col = mix(col, u_brand, pow(arms, 3.0) * (0.3 + 0.15 * fine) * fade * u_k);
  gl_FragColor = vec4(col, 1.0);
}`,
    fallback: [
      `conic-gradient(from 0deg at 50% 50%, ${mix("brand", 18)}, transparent 12%, ${mix("accent", 12)} 25%, transparent 37%, ${mix("brand", 18)} 50%, transparent 62%, ${mix("accent", 12)} 75%, transparent 87%, ${mix("brand", 18)})`,
      `radial-gradient(circle at 50% 50%, var(--color-surface) 6%, transparent 45%)`,
    ].join(", "),
  },
}

export const PRESET_NAMES = Object.keys(PRESETS) as ShaderPreset[]

/** Whether enough time has passed for the next frame at `fps`. Frames land on the display's beat, so allow a little early. */
export function frameDue(now: number, last: number, fps: number): boolean {
  return now - last >= 1000 / Math.max(1, fps) - 2
}

/*
 * Whether the engine is failing to keep up. Judged on the median interval
 * between drawn frames, not the mean: a single hitch (a tab switch the
 * visibility event missed, a GC) must not cost the backdrop its motion.
 * Too slow means the frames come at under half the asked rate and slower
 * than about 12 a second: a choppy aurora is worse than a still one.
 */
export function tooSlow(intervals: readonly number[], fps: number): boolean {
  if (intervals.length < 20) return false
  const sorted = [...intervals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return median > Math.max((2 * 1000) / Math.max(1, fps), 80)
}

/** A colour in 0–1 sRGB channels, as a shader takes it. */
export type Vec3 = [number, number, number]

/** Move `from` toward `to` by share `k` (0–1): theme changes blend over a few frames instead of snapping. */
export function approach(from: Vec3, to: Vec3, k: number): Vec3 {
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k]
}
