import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ParticleSystem } from './particle-system.js';
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
    this.composer = null;
    this.particlesPoints = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Renderer setup
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x0a0e27, 1);
    this.container.appendChild(this.renderer.domElement);

    // Camera
    this.camera.position.z = 40;

    // Background shapes
    this.createBackgroundLayer();

    // Particles
    this.particleSystem = new ParticleSystem(1000);
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
    const geometry = createParticleGeometry(1000);
    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
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
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
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

    // Update background shapes
    this.scene.children.forEach(child => {
      if (child.userData.rotationSpeed) {
        child.rotation.x += child.userData.rotationSpeed;
        child.rotation.y += child.userData.rotationSpeed;
      }
    });

    // Update camera with scroll parallax
    this.camera.position.y = -(this.scroll * 0.01);
    this.camera.position.x = this.mouse.x * 5;

    // Update particles
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
    this.renderer.dispose();
    this.composer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
