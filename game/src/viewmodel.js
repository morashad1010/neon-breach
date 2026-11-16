// First-person weapon viewmodel attached to the camera, with bob, recoil and muzzle flash.
import * as THREE from 'three';

export function createViewModel(camera) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 0.45, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0d1017, roughness: 0.6, metalness: 0.5 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x59c2ff });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    group.add(m); return m;
  };

  // receiver + barrel (rifle silhouette)
  add(new THREE.BoxGeometry(0.055, 0.09, 0.42), metal, 0, 0, -0.1);
  const barrel = add(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 10), dark, 0, 0.02, -0.42, Math.PI / 2);
  add(new THREE.BoxGeometry(0.04, 0.1, 0.12), dark, 0, -0.09, 0.02);          // mag
  add(new THREE.BoxGeometry(0.03, 0.05, 0.1), dark, 0, 0.07, -0.05);           // stock/sight
  add(new THREE.BoxGeometry(0.02, 0.02, 0.2), glow, 0, 0.012, -0.3);          // emissive rail
  const tip = new THREE.Object3D(); tip.position.set(0, 0.02, -0.6); group.add(tip);

  // muzzle flash
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
  flash.position.copy(tip.position); group.add(flash);
  const flashLight = new THREE.PointLight(0xffc46b, 0, 9, 2);
  flashLight.position.copy(tip.position); group.add(flashLight);

  group.position.set(0.26, -0.24, -0.5);
  group.rotation.y = -0.04;
  camera.add(group);

  let recoil = 0, flashT = 0, bobT = 0;

  return {
    group,
    onFire() { recoil = Math.min(recoil + 0.05, 0.12); flashT = 0.05; flash.rotation.z = Math.random() * Math.PI; },
    update(dt, p, moving) {
      if (!p) { group.visible = false; return; }
      group.visible = !p.dead && !p.crouched || !p.dead;
      if (moving) bobT += dt * 9; else bobT += dt * 2;
      const bob = Math.sin(bobT) * (moving ? 0.012 : 0.004);
      const bob2 = Math.abs(Math.cos(bobT)) * (moving ? 0.008 : 0.003);
      recoil = Math.max(0, recoil - dt * 0.5);
      flashT = Math.max(0, flashT - dt);
      group.position.set(0.26 + bob * 0.4, -0.24 + bob2, -0.5 + recoil);
      group.rotation.x = recoil * 0.9;
      flashMat.opacity = flashT > 0 ? flashT / 0.05 : 0;
      flashLight.intensity = flashT > 0 ? 30 * (flashT / 0.05) : 0;
    },
  };
}
