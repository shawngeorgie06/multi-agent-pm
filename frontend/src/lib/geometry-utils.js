import * as THREE from 'three';

export function createBackgroundGeometries() {
  const geometries = [];

  // Wireframe icosahedron
  const icoGeo = new THREE.IcosahedronGeometry(1.5, 2);
  geometries.push({
    geometry: icoGeo,
    color: 0x2d1b4e,
    opacity: 0.4,
    scale: 2,
    speed: 0.0001
  });

  // Wireframe cube
  const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
  geometries.push({
    geometry: cubeGeo,
    color: 0x1a0f3f,
    opacity: 0.3,
    scale: 1.5,
    speed: 0.00008
  });

  return geometries;
}

export function createParticleGeometry(count = 1000) {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorOptions = [
    new THREE.Color(0x00ffff),      // Cyan
    new THREE.Color(0xb700ff),      // Electric purple
    new THREE.Color(0xff00ff)       // Magenta
  ];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}
