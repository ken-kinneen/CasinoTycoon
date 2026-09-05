import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05040a);
  scene.fog = new THREE.FogExp2(0x0a0610, 0.018);

  // a faint environment map gives every glossy surface (floors, chrome, gold) a sheen
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0x4a3a8a, 0x1a0a14, 0.9);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x8060a0, 0.18));
  const moon = new THREE.DirectionalLight(0x7080ff, 1.4);
  moon.position.set(25, 40, 15);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -45; moon.shadow.camera.right = 45;
  moon.shadow.camera.top = 45; moon.shadow.camera.bottom = -45;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 140;
  moon.shadow.bias = -0.0008;
  scene.add(moon);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const pts = [], cols = [];
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.08, r = 180;
    pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    const c = 0.6 + Math.random() * 0.4; cols.push(c, c, c + Math.random() * 0.2);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  starGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.7, vertexColors: true, fog: false })));

  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 6, 12);
  return camera;
}
