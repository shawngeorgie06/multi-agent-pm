import * as THREE from 'three';

export class Particle {
  constructor(x, y, z) {
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5
    );
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.energy = Math.random();
    this.baseEnergy = this.energy;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.multiplyScalar(0.99); // Damping
    this.position.add(this.velocity);
    this.acceleration.multiplyScalar(0);

    // Keep particles in bounds
    const bounds = 50;
    if (Math.abs(this.position.x) > bounds) this.position.x *= -0.9;
    if (Math.abs(this.position.y) > bounds) this.position.y *= -0.9;
    if (Math.abs(this.position.z) > bounds) this.position.z *= -0.9;
  }

  pulse(time) {
    this.energy = this.baseEnergy + Math.sin(time * 0.003) * 0.3;
  }
}

export class ParticleSystem {
  constructor(count = 1000) {
    this.particles = [];
    this.forceFields = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 80;
      const y = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      this.particles.push(new Particle(x, y, z));
    }
  }

  addForceField(position, radius, strength) {
    this.forceFields.push({ position, radius, strength });
  }

  update(scrollY, mouseX, mouseY, time) {
    // Apply force fields
    this.particles.forEach(particle => {
      this.forceFields.forEach(field => {
        const distance = particle.position.distanceTo(field.position);
        if (distance < field.radius) {
          const force = new THREE.Vector3()
            .subVectors(field.position, particle.position)
            .normalize()
            .multiplyScalar(field.strength / (distance + 1));
          particle.applyForce(force);
        }
      });

      particle.update();
      particle.pulse(time);
    });
  }

  getPositions() {
    const positions = new Float32Array(this.particles.length * 3);
    this.particles.forEach((p, i) => {
      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
    });
    return positions;
  }

  getEnergies() {
    const energies = new Float32Array(this.particles.length);
    this.particles.forEach((p, i) => {
      energies[i] = Math.max(0, Math.min(1, p.energy));
    });
    return energies;
  }
}
