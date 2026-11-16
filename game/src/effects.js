// Visual effects: tracers, muzzle flash, impact sparks, blood, explosions, shake. Pooled, no per-frame allocs in hot loops.
import * as THREE from 'three';

const MAX_TRACERS = 64, MAX_PARTICLES = 256, MAX_FLASH = 8;

export function createEffects(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracers = [];
  for (let i = 0; i < MAX_TRACERS; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, tracerMat.clone());
    line.visible = false; line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, t: 0 });
  }
  let tracerIdx = 0;

  const pGeo = new THREE.SphereGeometry(0.045, 5, 4);
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffcf6e, transparent: true }));
    m.visible = false; scene.add(m);
    particles.push({ m, vx: 0, vy: 0, vz: 0, t: 0, life: 0, grav: 0 });
  }
  let pIdx = 0;

  const flashes = [];
  for (let i = 0; i < MAX_FLASH; i++) {
    const l = new THREE.PointLight(0xffc46e, 0, 18, 2);
    scene.add(l);
    flashes.push(l);
  }
  let fIdx = 0;
  const muzzleSpriteMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.95 });
  const muzzles = [];
  for (let i = 0; i < MAX_FLASH; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), muzzleSpriteMat.clone());
    s.visible = false; scene.add(s);
    muzzles.push(s);
  }

  const boomLight = new THREE.PointLight(0xff9a5c, 0, 60, 1.6);
  scene.add(boomLight);
  const boomMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.85 }));
  boomMesh.visible = false; scene.add(boomMesh);
  let boomT = 0;

  let shake = 0;
  const sparks = (x, y, z, n, color, speed = 4, life = 0.5, grav = 9) => {
    for (let i = 0; i < n; i++) {
      const p = particles[pIdx]; pIdx = (pIdx + 1) % MAX_PARTICLES;
      p.m.visible = true;
      p.m.material.color.setHex(color);
      p.m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * Math.cos(b) * s; p.vy = Math.sin(b) * s + 2; p.vz = Math.sin(a) * Math.cos(b) * s;
      p.t = 0; p.life = life * (0.6 + Math.random() * 0.7); p.grav = grav;
    }
  };

  return {
    tracer(x1, y1, z1, x2, y2, z2) {
      const t = tracers[tracerIdx]; tracerIdx = (tracerIdx + 1) % MAX_TRACERS;
      const a = t.line.geometry.attributes.position;
      a.setXYZ(0, x1, y1, z1); a.setXYZ(1, x2, y2, z2); a.needsUpdate = true;
      t.line.visible = true; t.t = 0.09;
    },
    muzzle(x, y, z, dirX, dirY, dirZ, yaw) {
      const f = flashes[fIdx]; const s = muzzles[fIdx]; fIdx = (fIdx + 1) % MAX_FLASH;
      f.position.set(x + dirX * 0.7, y + dirY * 0.7, z + dirZ * 0.7);
      f.intensity = 260;
      s.position.set(x + dirX * 0.8, y, z + dirZ * 0.8);
      s.rotation.z = Math.random() * Math.PI;
      s.lookAt(s.position.x + dirX, s.position.y + dirY, s.position.z + dirZ);
      s.visible = true; s.material.opacity = 0.95;
      s.userData.t = 0.05;
    },
    impact(x, y, z, color = 0xffcf6e) { sparks(x, y, z, 7, color, 3.4, 0.4); },
    blood(x, y, z) { sparks(x, y, z, 9, 0xa31621, 2.6, 0.5); },
    explode(x, y, z) {
      boomLight.position.set(x, y + 1, z); boomLight.intensity = 2600;
      boomMesh.position.set(x, y + 0.6, z); boomMesh.visible = true; boomT = 0.5;
      sparks(x, y + 0.5, z, 60, 0xffb066, 9, 0.9, 7);
      sparks(x, y + 0.5, z, 30, 0xff5470, 5, 1.1, 6);
      shake = Math.min(1.2, shake + 0.9);
    },
    shakeAdd(v) { shake = Math.min(1.2, shake + v); },
    get shake() { return shake; },
    update(dt, cam) {
      for (const t of tracers) if (t.line.visible) { t.t -= dt; if (t.t <= 0) t.line.visible = false; else t.line.material.opacity = t.t / 0.09 * 0.9; }
      for (const p of particles) if (p.m.visible) {
        p.t += dt;
        if (p.t >= p.life) { p.m.visible = false; continue; }
        p.vy -= p.grav * dt;
        p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        if (p.m.position.y < 0.03) { p.m.position.y = 0.03; p.vy *= -0.3; }
        p.m.material.opacity = 1 - p.t / p.life;
      }
      for (let i = 0; i < MAX_FLASH; i++) {
        if (flashes[i].intensity > 0) flashes[i].intensity = Math.max(0, flashes[i].intensity - dt * 2600);
        if (muzzles[i].visible) { muzzles[i].userData.t -= dt; if (muzzles[i].userData.t <= 0) muzzles[i].visible = false; }
      }
      if (boomT > 0) {
        boomT -= dt;
        const k = 1 - boomT / 0.5;
        boomMesh.scale.setScalar(1 + k * 9);
        boomMesh.material.opacity = 0.85 * (1 - k);
        boomLight.intensity = Math.max(0, boomLight.intensity - dt * 6000);
        if (boomT <= 0) { boomMesh.visible = false; boomLight.intensity = 0; }
      }
      shake = Math.max(0, shake - dt * 2.2);
      if (cam && shake > 0) {
        cam.position.x += (Math.random() - 0.5) * shake * 0.12;
        cam.position.y += (Math.random() - 0.5) * shake * 0.12;
        cam.rotation.z += (Math.random() - 0.5) * shake * 0.02;
      }
    },
  };
}
