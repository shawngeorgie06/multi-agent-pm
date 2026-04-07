import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ParticleSystem } from './particle-system.js';
import { NeuralNetworkVisualization } from './neural-network.js';
import { createBackgroundGeometries, createParticleGeometry } from './geometry-utils.js';

export class BackgroundScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.mouse = { x: 0, y: 0 };
    this.scroll = 0;
    this.time = 0;
    this.particleSystem = null;
    this.neuralNetwork = null;
    this.composer = null;
    this.particlesPoints = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Renderer setup
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060912, 1);
    this.container.appendChild(this.renderer.domElement);

    // Camera
    this.camera.position.z = 60;

    // Neural Network Visualization
    this.neuralNetwork = new NeuralNetworkVisualization(this.scene, this.camera);

    // Subtle particles background
    this.particleSystem = new ParticleSystem(300);
    this.createParticleLayer();

    // Post-processing (Bloom)
    this.setupBloom();

    // Animation loop
    this.animate();
  }

  createBackgroundLayer() {
    const geometries = createBackgroundGeometries();

    geometries.forEach((geo, idx) => {
      const material = new THREE.MeshPhongMaterial({
        color: geo.color,
        wireframe: true,
        emissive: geo.color,
        emissiveIntensity: 0.2,
        opacity: geo.opacity,
        transparent: true
      });

      const mesh = new THREE.Mesh(geo.geometry, material);
      mesh.scale.set(geo.scale, geo.scale, geo.scale);
      mesh.userData.rotationSpeed = geo.speed;
      mesh.position.z = -20 - idx * 10;

      this.scene.add(mesh);
    });
  }

  createParticleLayer() {
    const geometry = createParticleGeometry(300);
    const material = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.18,
    });

    this.particlesPoints = new THREE.Points(geometry, material);
    this.scene.add(this.particlesPoints);
  }

  setupBloom() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.95, // strength — reduced so it doesn't bleed into page content
      0.65, // radius — wider but softer
      0.78  // threshold — slightly lower so more elements catch glow
    );
    this.composer.addPass(bloomPass);
  }

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('scroll', () => {
      this.scroll = window.scrollY;
    });

    window.addEventListener('resize', () => {
      this.onWindowResize();
    });
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    this.time += 1;

    // Update neural network with scroll + mouse
    if (this.neuralNetwork) {
      this.neuralNetwork.update(this.scroll, this.mouse.x, this.mouse.y, this.time);
    }

    // Camera: gentle parallax — slower scroll drift so network stays visible longer
    this.camera.position.y = -(this.scroll * 0.003);
    this.camera.position.x = this.mouse.x * 2;

    // Update particles (simplified - just keep them drifting)
    this.particleSystem.update(this.scroll, this.mouse.x, this.mouse.y, this.time);

    // Update particle positions in geometry
    if (this.particlesPoints) {
      this.particlesPoints.geometry.attributes.position.array = this.particleSystem.getPositions();
      this.particlesPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Render with bloom
    this.composer.render();
  }

  dispose() {
    if (this.neuralNetwork) {
      this.neuralNetwork.dispose();
    }
    this.renderer.dispose();
    this.composer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
