import * as THREE from 'three';

const LAYER_COLORS = [
  0x00E5FF, // Cyan   — input
  0x0088FF, // Blue   — hidden 1
  0x4455FF, // Indigo — hidden 2
  0x00CCAA, // Teal   — output
];

export class NeuralNetworkVisualization {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.layers = [];
    this.connections = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.signals = [];
    this.signalTimer = 0;

    this.init();
  }

  init() {
    const layerSizes = [8, 12, 10, 8];
    const layerSpacing = 28;
    const layerStartX = -42;

    layerSizes.forEach((nodeCount, layerIndex) => {
      const layer = [];
      const layerX = layerStartX + layerIndex * layerSpacing;
      const vertSpacing = 56 / nodeCount;

      for (let i = 0; i < nodeCount; i++) {
        const y = (i - nodeCount / 2 + 0.5) * vertSpacing;
        const z = Math.sin(layerIndex * 1.1) * 8;

        const color = LAYER_COLORS[layerIndex];
        const geometry = new THREE.SphereGeometry(1.0, 12, 12);
        const material = new THREE.MeshPhongMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0,
          transparent: true,
          opacity: 0,
        });

        const node = new THREE.Mesh(geometry, material);
        node.position.set(layerX, y, z);
        node.scale.setScalar(0);
        node.userData = {
          phaseOffset: i * 0.62 + layerIndex * 1.1,
          flashDecay: 0,
        };

        this.group.add(node);
        layer.push(node);
      }

      this.layers.push(layer);
    });

    // Connections
    for (let li = 0; li < this.layers.length - 1; li++) {
      const current = this.layers[li];
      const next = this.layers[li + 1];
      current.forEach((fromNode) => {
        const count = Math.min(3, next.length);
        for (let k = 0; k < count; k++) {
          const targetIdx = Math.floor((k / count) * next.length);
          this.createConnection(fromNode, next[targetIdx], li);
        }
      });
    }
  }

  createConnection(startNode, endNode, layerIndex) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      startNode.position.clone(),
      endNode.position.clone(),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: LAYER_COLORS[layerIndex],
      transparent: true,
      opacity: 0,
    });
    const line = new THREE.Line(geometry, material);
    line.userData = { startNode, endNode, layerIndex };
    this.group.add(line);
    this.connections.push(line);
  }

  spawnSignal() {
    const visible = this.connections.filter(c => c.material.opacity > 0.12);
    if (!visible.length) return;

    const connection = visible[Math.floor(Math.random() * visible.length)];
    const color = LAYER_COLORS[connection.userData.layerIndex];

    const geo = new THREE.SphereGeometry(0.6, 8, 8);
    const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 2.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(connection.userData.startNode.position);
    this.group.add(mesh);

    this.signals.push({
      connection,
      progress: 0,
      speed: 0.02 + Math.random() * 0.018,
      mesh,
    });
  }

  update(scrollY, mouseX = 0, mouseY = 0, time = 0) {
    // ── Load-in: staggered by layer over first ~3 seconds ──
    // Independent of scroll — network is always visible on page load
    const loadProgress = Math.min(time / 190, 1); // ~3.2s at 60fps

    this.layers.forEach((layer, li) => {
      const layerLoadStart = li * 0.2;
      const lp = Math.max(0, Math.min(1, (loadProgress - layerLoadStart) / 0.35));

      layer.forEach((node) => {
        node.scale.setScalar(lp);
        node.material.opacity = lp;

        const pulse = Math.sin(time * 0.018 + node.userData.phaseOffset) * 0.1;
        node.userData.flashDecay = Math.max(0, node.userData.flashDecay - 0.04);
        node.material.emissiveIntensity = 0.25 + lp * 0.25 + pulse + node.userData.flashDecay;
      });
    });

    // Connection reveal — slightly after their source layer
    this.connections.forEach((conn) => {
      const connLoadStart = conn.userData.layerIndex * 0.2 + 0.18;
      const cp = Math.max(0, Math.min(1, (loadProgress - connLoadStart) / 0.35));
      conn.material.opacity = cp * 0.26;
    });

    // ── Scroll-driven X pan: left→right as you scroll down ──
    // scrollY 0→900 drives group.position.x from +48 → -48
    // Scrolling back up reverses it automatically
    const panProgress = Math.min(scrollY / 900, 1);
    this.group.position.x = THREE.MathUtils.lerp(48, -48, panProgress);

    // ── Rotation: slow idle + mouse tilt only (no scroll rotation — it fights the pan) ──
    this.group.rotation.y = time * 0.00035 + mouseX * 0.10;
    this.group.rotation.x = Math.sin(time * 0.0008) * 0.06 - mouseY * 0.05;

    // ── Signal propagation ──
    this.signalTimer++;
    if (this.signalTimer % 28 === 0 && this.signals.length < 10 && loadProgress > 0.45) {
      this.spawnSignal();
    }

    this.signals = this.signals.filter((s) => {
      s.progress += s.speed;
      s.mesh.position.lerpVectors(
        s.connection.userData.startNode.position,
        s.connection.userData.endNode.position,
        Math.min(s.progress, 1),
      );

      if (s.progress >= 1) {
        s.connection.userData.endNode.userData.flashDecay = 1.1;
        this.group.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        return false;
      }
      return true;
    });
  }

  dispose() {
    this.signals.forEach(s => {
      this.group.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    });
    this.signals = [];
    this.layers = [];
    this.connections = [];
    this.scene.remove(this.group);
  }
}
