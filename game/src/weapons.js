// Weapons: hitscan firing with spread/recoil/falloff, headshots, grenades.
import { WEAPONS, GRENADES, PLAYER } from './config.js';
import { colliders, losBlocked } from './map.js';

// ray vs sphere; returns t or -1
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}
// ray vs vertical capsule (segment from feet to h at x,z, radius r); returns t or -1
export function rayCapsule(ox, oy, oz, dx, dy, dz, x, z, h, r) {
  // test against cylinder part in XZ then spheres at ends
  let best = -1;
  // solve 2D ray-circle in XZ
  const oxz = ox - x, ozz = oz - z;
  const a = dx * dx + dz * dz;
  if (a > 1e-9) {
    const b = 2 * (oxz * dx + ozz * dz);
    const c = oxz * oxz + ozz * ozz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t > 0) {
        const y = oy + dy * t;
        if (y >= 0 && y <= h) best = t;
      }
    }
  }
  const tHead = raySphere(ox, oy, oz, dx, dy, dz, x, h - 0.18, z, r + 0.06);
  const tFeet = raySphere(ox, oy, oz, dx, dy, dz, x, 0, z, r);
  for (const t of [tHead, tFeet]) if (t > 0 && (best < 0 || t < best)) best = t;
  return best;
}
// ray vs level (walls); returns distance or Infinity
export function rayLevel(ox, oy, oz, dx, dy, dz, maxDist) {
  let best = maxDist;
  for (const c of colliders) {
    // slab test in 3D against box [minX,maxX]x[0,h]x[minZ,maxZ]
    let t0 = 0, t1 = best;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    const mn = [c.minX, 0, c.minZ], mx = [c.maxX, c.h, c.maxZ];
    let ok = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) { ok = false; break; } }
      else {
        let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok && t0 > 0 && t0 < best) best = t0;
  }
  return best;
}

export function makeShooterState() {
  return { bloom: 0, recoil: 0, lastShot: -10 };
}

// Fire a weapon from a combatant. shooter: {x,y(eye),z, yaw, pitch, team, name, isPlayer, state}
// targets: array of combatants. Returns array of hit events.
export function fireWeapon(shooter, key, targets, rng, now) {
  const w = WEAPONS[key];
  const st = shooter.state;
  const spreadBase = w.spread + st.bloom * 0.02 + (shooter.moving ? 0.02 : 0) + (shooter.crouched ? -0.006 : 0);
  const events = [];
  const pellets = w.pellets;
  for (let p = 0; p < pellets; p++) {
    const sp = Math.max(0, spreadBase);
    const a1 = rng() * Math.PI * 2, a2 = (rng() - 0.5) * sp * 2;
    const cp = Math.cos(shooter.pitch), sp2 = Math.sin(shooter.pitch);
    let dx = -Math.sin(shooter.yaw) * cp, dy = sp2, dz = -Math.cos(shooter.yaw) * cp;
    // apply small random spread
    const rx = (rng() - 0.5) * sp, ry = (rng() - 0.5) * sp;
    const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
    const nx = dx + rx * 0.5, ny = dy + ry * 0.5, nz = dz + (rng() - 0.5) * sp * 0.5;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / nl, uy = ny / nl, uz = nz / nl;

    const wallT = rayLevel(shooter.x, shooter.y, shooter.z, ux, uy, uz, w.range);
    let bestT = wallT, bestTarget = null, bestHead = false;
    for (const tgt of targets) {
      if (tgt === shooter || tgt.dead || tgt.team === shooter.team) continue;
      const tHead = raySphere(shooter.x, shooter.y, shooter.z, ux, uy, uz, tgt.x, tgt.height - 0.18, tgt.z, 0.34);
      const tBody = rayCapsule(shooter.x, shooter.y, shooter.z, ux, uy, uz, tgt.x, tgt.z, tgt.height, tgt.radius);
      let hitT = -1, head = false;
      if (tHead > 0 && (tBody < 0 || tHead <= tBody + 0.05)) { hitT = tHead; head = true; }
      else if (tBody > 0) { hitT = tBody; }
      if (hitT > 0 && hitT < bestT) { bestT = hitT; bestTarget = tgt; bestHead = head; }
    }
    events.push({ from: { x: shooter.x, y: shooter.y, z: shooter.z }, dir: { x: ux, y: uy, z: uz }, dist: bestT, target: bestTarget, head: bestHead, wall: bestTarget === null });
  }
  st.bloom = Math.min(1.6, st.bloom + 0.22);
  st.recoil = Math.min(0.09, st.recoil + w.recoil);
  st.lastShot = now;
  return { weapon: w, events };
}

export function grenadeDef(key) { return GRENADES[key]; }
