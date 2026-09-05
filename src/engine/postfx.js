// Post-processing: bloom for the neon, then a grade pass with vignette,
// film grain, a touch of chromatic aberration and a teal/magenta split-tone.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.55 },
    grain: { value: 0.045 },
    aberration: { value: 0.0018 },
    warmth: { value: 0.06 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain, aberration, warmth; uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 d = (uv - 0.5);
      float r2 = dot(d, d);
      // chromatic aberration toward the edges
      vec2 off = d * r2 * aberration * 40.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      // split tone: warm highlights, cool shadows
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col += (vec3(1.0, 0.85, 0.6) - 1.0) * warmth * lum;
      col += (vec3(0.6, 0.75, 1.0) - 1.0) * warmth * (1.0 - lum) * 0.8;
      // contrast
      col = (col - 0.5) * 1.06 + 0.5;
      // vignette
      float v = smoothstep(0.9, 0.2, r2 * 1.6);
      col *= mix(1.0 - vignette, 1.0, v);
      // grain
      float g = hash(uv * resolution + fract(time) * 100.0) - 0.5;
      col += g * grain * (1.0 - lum * 0.6);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPostFX(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.7, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.resolution.value.set(size.x, size.y);
  composer.addPass(grade);

  return {
    composer, bloom, grade,
    render(dt) { grade.uniforms.time.value += dt; composer.render(); },
    resize(w, h) { composer.setSize(w, h); bloom.setSize(w / 2, h / 2); grade.uniforms.resolution.value.set(w, h); },
    setMood({ bloomStrength, vignette, warmth }) {
      if (bloomStrength !== undefined) bloom.strength = bloomStrength;
      if (vignette !== undefined) grade.uniforms.vignette.value = vignette;
      if (warmth !== undefined) grade.uniforms.warmth.value = warmth;
    },
  };
}
