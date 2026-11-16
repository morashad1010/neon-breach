// Kestrel Yard — map geometry, colliders, nav graph, spawns, bomb sites, three.js scene builder.
import * as THREE from 'three';
import { FIELD } from './config.js';

// ---- colliders (AABBs, metres). h = height. ----
export const colliders = [];
function box(cx, cz, w, d, h, opts = {}) {
  const c = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h, ...opts };
  colliders.push(c);
  return c;
}

// perimeter walls
box(0, -30, 62, 2, FIELD.h); box(0, 30, 62, 2, FIELD.h);
box(-30, 0, 2, 62, FIELD.h); box(30, 0, 2, 62, FIELD.h);

// site A warehouse (NW room), walls with openings
const A = { x0: -28, x1: -13, z0: -28, z1: -15 };
box((A.x0 - 1), (A.z0 + A.z1) / 2, 2, A.z1 - A.z0, FIELD.h);            // west outer (part of perimeter)
box((A.x0 + A.x1) / 2, A.z0 - 1, A.x1 - A.x0, 2, FIELD.h);            // north wall of A
box(A.x1 + 1, (A.z0 + A.z1) / 2, 2, A.z1 - A.z0 - 6, FIELD.h);        // east wall with gap (z in [-21.5,-15])
box((A.x0 + A.x1) / 2, A.z1 + 1, A.x1 - A.x0 - 8, 2, FIELD.h);        // south wall with gap (x in [-28,-20])
// site B garage (NE room), mirrored
const B = { x0: 13, x1: 28, z0: -28, z1: -15 };
box(B.x0 - 1, (B.z0 + B.z1) / 2, 2, B.z1 - B.z0 - 6, FIELD.h);        // west wall with gap
box((B.x0 + B.x1) / 2, B.z0 - 1, B.x1 - B.x0, 2, FIELD.h);            // north wall
box(B.x1 + 1, (B.z0 + B.z1) / 2, 2, B.z1 - B.z0, FIELD.h);            // east outer
box((B.x0 + B.x1) / 2, B.z1 + 1, B.x1 - B.x0 - 8, 2, FIELD.h);        // south wall with gap (x in [20,28])

// mid containers shaping the central lane
box(-8.5, -6, 2.2, 10, 2.6, { kind: 'container', color: 0x1d4e6b });
box(8.5, -6, 2.2, 10, 2.6, { kind: 'container', color: 0x6b1d3f });
box(-8.5, 10, 2.2, 8, 2.6, { kind: 'container', color: 0x1d6b4e });
box(8.5, 12, 2.2, 8, 2.6, { kind: 'container', color: 0x5c4a12 });
box(0, 2, 7, 2.4, 2.6, { kind: 'container', color: 0x274a72 });       // mid block
box(0, -16, 9, 2.4, 2.6, { kind: 'container', color: 0x72273f });     // north mid block

// east lane cover (x ~ 14..26, z -14..20)
box(18, -10, 6, 2.4, 2.6, { kind: 'container', color: 0x1d6b4e });
box(24, 0, 2.4, 8, 2.6, { kind: 'container', color: 0x1d4e6b });
box(18, 10, 6, 2.4, 2.6, { kind: 'container', color: 0x6b1d3f });
box(24, 18, 2.4, 6, 2.6, { kind: 'container', color: 0x5c4a12 });
// west lane cover (mirrored)
box(-18, -10, 6, 2.4, 2.6, { kind: 'container', color: 0x5c4a12 });
box(-24, 0, 2.4, 8, 2.6, { kind: 'container', color: 0x6b1d3f });
box(-18, 10, 6, 2.4, 2.6, { kind: 'container', color: 0x1d4e6b });
box(-24, 18, 2.4, 6, 2.6, { kind: 'container', color: 0x274a72 });

// connector walls (north mid corridor z=-14..-8 and south z=8..14)
box(-4, -11, 8, 2, 2.6, { kind: 'container', color: 0x274a72 });
box(14, -13.5, 2, 3, 2.6, { kind: 'container', color: 0x1d6b4e });
box(-14, -13.5, 2, 3, 2.6, { kind: 'container', color: 0x6b1d3f });

// crates (low cover, h 1.15 — block movement, not LOS when standing)
const crateSpots = [
  [-3, -4], [3, 6], [-5, 14], [5, -12], [0, 14], [-12, 2], [12, 2],
  [-20, -6], [20, -2], [-16, 16], [16, 16], [10, -18], [-10, -20], [22, 8], [-22, 8],
];
for (const [cx, cz] of crateSpots) box(cx, cz, 1.6, 1.6, 1.15, { kind: 'crate' });

// ---- nav graph (waypoints) ----
export const waypoints = [
  [0, 26], [0, 20], [0, 14], [-5, 8], [5, 8], [0, 2], [0, -4], [0, -10], [0, -16], [0, -22],
  [-8, -20], [8, -20], [-14, -18], [14, -18], [-21, -12], [21, -12], [-21, 2], [21, 2],
  [-21, 14], [21, 14], [-12, 20], [12, 20], [-20, -22], [-24, -21], [20, -22], [24, -21],
  [-20, -24.5], [20, -24.5], [-6, -24], [6, -24], [-16, -8], [16, -8], [-26, -6], [26, -6],
];
export const edges = [
  [0,1],[1,2],[2,3],[2,4],[2,5],[3,4],[4,7],[5,6],[6,7],[7,8],[8,9],[9,10],
  [10,11],[10,12],[9,13],[9,14],[11,15],[12,16],[13,15],[14,16],[15,17],[16,18],
  [17,19],[18,20],[19,21],[20,22],[5,23],[5,24],[8,25],[8,26],[13,27],[14,28],
  [27,29],[28,30],[29,31],[30,31],[10,32],[10,33],[32,3],[33,4],[15,32],[16,33],
];
export const spawns = {
  att: [[-3, 27], [0, 27.5], [3, 27], [-1.5, 25.5], [1.5, 25.5]],
  def: [[-3, -27], [0, -27.5], [3, -27], [-1.5, -25.5], [1.5, -25.5]],
};
export const sites = {
  A: { x: -20.5, z: -21.5, r: 3.2, label: 'A' },
  B: { x: 20.5, z: -21.5, r: 3.2, label: 'B' },
};

// nearest waypoint index to a point
export function nearestWp(x, z) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < waypoints.length; i++) {
    const dx = waypoints[i][0] - x, dz = waypoints[i][1] - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// BFS route between waypoint indices; returns array of indices
export function routePath(fromI, toI) {
  if (fromI === toI) return [fromI];
  const prev = new Array(waypoints.length).fill(-1);
  const q = [fromI]; prev[fromI] = fromI;
  while (q.length) {
    const n = q.shift();
    for (const [a, b] of edges) {
      const m = a === n ? b : b === n ? a : -1;
      if (m >= 0 && prev[m] === -1) { prev[m] = n; if (m === toI) { q.length = 0; break; } q.push(m); }
    }
  }
  if (prev[toI] === -1) return [fromI, toI];
  const path = [toI]; let cur = toI;
  while (cur !== fromI) { cur = prev[cur]; path.push(cur); }
  return path.reverse();
}

// ---- collision: circle (x,z,r) vs AABBs ----
export function collideCircle(x, z, r) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; z = nz + (dz / d) * r;
      } else {
        // centre inside the box: push out along smallest penetration axis
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
      }
    }
  }
  const hw = FIELD.w / 2 - 1;
  x = Math.max(-hw, Math.min(hw, x));
  z = Math.max(-hw, Math.min(hw, z));
  return { x, z };
}

// ---- LOS: segment (x1,z1,y1)-(x2,z2,y2) blocked by colliders with h >= 2 (crates don't block standing sight) ----
export function losBlocked(x1, z1, y1, x2, z2, y2) {
  for (const c of colliders) {
    if (c.h < 2) continue;
    // 2D segment vs AABB in XZ
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
    if (maxX < c.minX || minX > c.maxX || maxZ < c.minZ || minZ > c.maxZ) continue;
    // slab test
    const dx = x2 - x1, dz = z2 - z1;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (x1 < c.minX || x1 > c.maxX) continue; }
    else {
      let ta = (c.minX - x1) / dx, tb = (c.maxX - x1) / dx;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (z1 < c.minZ || z1 > c.maxZ) continue; }
    else {
      let ta = (c.minZ - z1) / dz, tb = (c.maxZ - z1) / dz;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // height at intersection
    const t = t0;
    const y = y1 + (y2 - y1) * t;
    if (y < c.h) return true;
  }
  return false;
}

// ---- three.js scene ----
export function buildMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ground: procedural asphalt grid texture
  const gc = document.createElement('canvas'); gc.width = gc.height = 512;
  const g = gc.getContext('2d');
  g.fillStyle = '#141821'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#1d2330'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke();
  }
  g.fillStyle = '#232b3d';
  for (let i = 0; i < 260; i++) g.fillRect(Math.random() * 512, Math.random() * 512, 3, 2);
  const gtex = new THREE.CanvasTexture(gc);
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(10, 10);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.w + 4, FIELD.d + 4),
    new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95, metalness: 0.05, color: 0x8a93a8 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  // painted lane markings
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5 });
  for (const z of [-2, 22]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, FIELD.d), markMat.clone());
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, z - FIELD.d / 4 + 0.5); group.add(m);
  }

  const contGeo = new THREE.BoxGeometry(1, 1, 1);
  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const c of colliders) {
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ, cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    let mesh;
    if (c.kind === 'crate') {
      mesh = new THREE.Mesh(crateGeo, new THREE.MeshStandardMaterial({ color: 0x6e5a33, roughness: 0.9 }));
      mesh.scale.set(w, c.h, d);
    } else if (c.kind === 'container') {
      mesh = new THREE.Mesh(contGeo, new THREE.MeshStandardMaterial({
        color: c.color ?? 0x3a4a66, roughness: 0.6, metalness: 0.35,
      }));
      mesh.scale.set(w, c.h, d);
      // emissive top edge strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06),
        new THREE.MeshBasicMaterial({ color: 0x59c2ff }));
      strip.position.y = c.h / 2 + 0.02;
      mesh.add(strip);
    } else {
      mesh = new THREE.Mesh(contGeo, new THREE.MeshStandardMaterial({ color: 0x232a3a, roughness: 0.85 }));
      mesh.scale.set(w, c.h, d);
    }
    mesh.position.set(cx, c.h / 2, cz);
    mesh.castShadow = c.h > 2; mesh.receiveShadow = true;
    group.add(mesh);
  }

  // site markers: glowing circles + letter
  for (const key of ['A', 'B']) {
    const s = sites[key];
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.4, s.r, 40),
      new THREE.MeshBasicMaterial({ color: key === 'A' ? 0xffd166 : 0x59c2ff, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.03, s.z);
    group.add(ring);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c2 = cv.getContext('2d');
    c2.fillStyle = key === 'A' ? '#ffd166' : '#59c2ff'; c2.font = '900 90px sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(key, 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.rotation.x = -Math.PI / 2; sign.position.set(s.x, 0.05, s.z);
    group.add(sign);
  }

  // neon signs on walls
  const neon = (text, color, x, y, z, ry) => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const c2 = cv.getContext('2d');
    c2.font = '900 64px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.shadowColor = color; c2.shadowBlur = 24; c2.fillStyle = color;
    c2.fillText(text, 256, 52);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
    m.position.set(x, y, z); m.rotation.y = ry; group.add(m);
  };
  neon('KESTREL YARD', '#59c2ff', 0, 4.6, -29.8, 0);
  neon('SITE A', '#ffd166', -20.5, 3.4, -27.8, 0);
  neon('SITE B', '#59c2ff', 20.5, 3.4, -27.8, 0);
  neon('NEON BREACH', '#ff4fa3', 0, 5.2, 29.8, Math.PI);

  // floodlight poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a3244, roughness: 0.7, metalness: 0.5 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xdfeaff });
  const lights = [];
  const poleSpots = [[-26, -26], [26, -26], [-26, 26], [26, 26], [0, -24], [0, 24]];
  for (const [px, pz] of poleSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8.5, 8), poleMat);
    pole.position.set(px, 4.25, pz); group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), headMat);
    head.position.set(px, 8.5, pz); group.add(head);
    const spot = new THREE.SpotLight(0xcfe4ff, 900, 60, Math.PI / 3.4, 0.45, 1.6);
    spot.position.set(px, 8.4, pz);
    spot.target.position.set(px * 0.4, 0, pz * 0.4);
    group.add(spot); group.add(spot.target);
    lights.push(spot);
  }

  // ambient + hemisphere
  scene.add(new THREE.HemisphereLight(0x4a5f8a, 0x11141d, 1.35));
  const amb = new THREE.AmbientLight(0x334, 0.85); scene.add(amb);
  scene.fog = new THREE.FogExp2(0x05070d, 0.011);
  scene.background = new THREE.Color(0x05070d);

  // stars
  {
    const n = 500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      const r = 120;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 6;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbcd2ff, size: 0.55, sizeAttenuation: false, fog: false }));
    group.add(stars);
  }

  return { group, lights };
}
