// Player controller: movement with accel/friction, crouch, collision, weapons, grenades, plant/defuse.
import { PLAYER, WEAPONS, ROUND } from './config.js';
import { collideCircle } from './map.js';
import { fireWeapon } from './weapons.js';

export function updatePlayer(p, input, dt, game, rng, now) {
  if (p.dead) return;
  const axis = input.axis();
  const crouched = input.crouch;
  p.crouched = crouched;
  const targetH = crouched ? PLAYER.crouchHeight : PLAYER.height;
  p.height += (targetH - p.height) * Math.min(1, dt * 10);
  const speed = crouched ? PLAYER.crouchSpeed : input.walk ? PLAYER.walkSpeed * 0.55 : PLAYER.walkSpeed;

  // wish dir in world space from yaw
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let wx = (-sy) * axis.f + cy * axis.s * -1;
  let wz = (-cy) * axis.f + (-sy) * axis.s * -1;
  // rotate: forward = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw)
  wx = (-sy) * axis.f + cy * axis.s;
  wz = (-cy) * axis.f - sy * axis.s;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; } else { wx = 0; wz = 0; }

  const accel = p.moving || wl > 0 ? PLAYER.accel : PLAYER.friction * 4;
  p.vx += (wx * speed - p.vx) * Math.min(1, accel * dt / Math.max(1, speed * 0.22));
  p.vz += (wz * speed - p.vz) * Math.min(1, accel * dt / Math.max(1, speed * 0.22));
  if (wl === 0) {
    const f = Math.max(0, 1 - PLAYER.friction * dt);
    p.vx *= f; p.vz *= f;
  }
  p.moving = Math.hypot(p.vx, p.vz) > 0.6;
  const nc = collideCircle(p.x + p.vx * dt, p.z + p.vz * dt, p.radius);
  p.x = nc.x; p.z = nc.z;
  p.y = 0;

  // steps audio
  if (p.moving && (now - (p.lastStep || 0)) > (crouched ? 0.62 : 0.42)) {
    p.lastStep = now;
    game.audioStep(p.x, p.z);
  }

  // view
  p.yaw = input.yaw; p.pitch = input.pitch + p.state.recoil * 0.6;

  // weapon switching
  if (input.wasPressed('Digit1') && p.weapons[0]) p.current = 'knife';
  if (input.wasPressed('Digit2') && p.weapons[1]) p.current = 'p9';
  if (input.wasPressed('Digit3') && p.weapons[2]) p.current = p.weapons[2];

  const wkey = p.current;
  const w = WEAPONS[wkey];
  const ammo = p.ammo[wkey];
  const eyeY = p.y + (crouched ? 1.02 : 1.62);

  // firing
  const wantFire = wkey === 'knife' ? input.consumeFire() : (w.auto ? input.firing : input.consumeFire());
  if (wantFire && now - p.state.lastShot >= 1 / w.rate && ammo && ammo.mag > 0 && game.phase === 'round') {
    if (wkey === 'knife') {
      // melee: short range arc
      const range = w.range;
      let hitAny = null, bestD = range;
      for (const t of game.combatants) {
        if (t === p || t.dead || t.team === p.team) continue;
        const dx = t.x - p.x, dz = t.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > bestD) continue;
        const ang = Math.atan2(-dx, -dz);
        let dy = ang - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        if (Math.abs(dy) < 0.7 && d < range) { bestD = d; hitAny = t; }
      }
      const res = { weapon: w, events: [] };
      if (hitAny) res.events.push({ dist: bestD, target: hitAny, head: false, wall: false, from: { x: p.x, y: eyeY, z: p.z }, dir: { x: -Math.sin(p.yaw), y: p.pitch, z: -Math.cos(p.yaw) } });
      game.onShots(p, res, wkey);
      p.state.lastShot = now;
    } else {
      const res = fireWeapon({ ...p, y: eyeY, moving: p.moving, crouched, state: p.state }, wkey, game.combatants, rng, now);
      game.onShots(p, res, wkey);
    }
  }

  // reload
  if (input.wasPressed('KeyR') && ammo && ammo.mag < w.mag && ammo.reserve > 0 && w.mag !== Infinity) {
    p.reloading = 1.6;
    game.sfxAt('reload', 0.15);
  }
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0 && ammo) {
      const need = w.mag - ammo.mag;
      const take = Math.min(need, ammo.reserve);
      ammo.mag += take; ammo.reserve -= take;
      p.reloading = 0;
    }
  }

  // grenade throw
  if (input.wasPressed('KeyG') && p.grenades.length && game.phase === 'round') {
    const key = p.grenades.shift();
    game.throwGrenade(p, key, eyeY);
  }

  // plant / defuse (hold E)
  if (input.keys.has('KeyE') && game.phase === 'round') {
    game.tryUse(p, dt);
  } else {
    game.cancelUse(p);
  }

  // decay
  p.state.bloom = Math.max(0, p.state.bloom - dt * 1.8);
  p.state.recoil = Math.max(0, p.state.recoil - dt * 0.35);
}
