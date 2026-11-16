// Combatants (player + bots) share this shape; bot AI lives here.
import * as THREE from 'three';
import { PLAYER, BOTS, WEAPONS } from './config.js';
import { collideCircle, losBlocked, nearestWp, routePath, waypoints } from './map.js';
import { fireWeapon, makeShooterState } from './weapons.js';

let nextId = 1;
export function makeCombatant(team, name, isPlayer, x, z, yaw) {
  return {
    id: nextId++, team, name, isPlayer,
    x, z, y: 0, yaw, pitch: 0,
    vx: 0, vz: 0,
    height: PLAYER.height, radius: PLAYER.radius,
    hp: PLAYER.hp, armor: 0, dead: false,
    weapons: { 0: 'knife', 1: 'p9', 2: null },
    current: 'p9',
    ammo: { p9: { mag: 12, reserve: 48 }, hornet: { mag: 30, reserve: 90 }, longsword: { mag: 30, reserve: 90 }, mastiff: { mag: 6, reserve: 24 } },
    grenades: [],
    money: 800,
    state: makeShooterState(),
    moving: false, crouched: false,
    mesh: null,
    bot: isPlayer ? null : {
      mode: 'route', wpPath: [], wpIdx: 0, targetWp: -1, homeWp: -1,
      enemy: null, lastSeenX: 0, lastSeenZ: 0, lastSeenT: -99, reactAt: 0,
      aimYaw: 0, aimPitch: 0, nextShot: 0, burst: 0, burstLeft: 0,
      hearX: 0, hearZ: 0, hearT: -99, strafe: 0, strafeT: 0, speedMul: 1,
      holdT: 0, peekT: 0,
    },
  };
}

// ---- bot visual ----
const bodyMatYou = new THREE.MeshStandardMaterial({ color: 0x2f6fb2, roughness: 0.7 });
const bodyMatFoe = new THREE.MeshStandardMaterial({ color: 0xb23a48, roughness: 0.7 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xd9b48f, roughness: 0.8 });
const gunMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.4, metalness: 0.6 });
export function buildBodyMesh(c) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.85, 4, 10), c.team === 'att' ? bodyMatYou : bodyMatFoe);
  body.position.y = 0.95; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), headMat);
  head.position.y = 1.62; head.castShadow = true;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.75), gunMat);
  gun.position.set(0.22, 1.25, -0.35);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05),
    new THREE.MeshBasicMaterial({ color: c.team === 'att' ? 0x7dffb0 : 0xff5470 }));
  visor.position.set(0, 1.64, -0.2);
  g.add(body, head, gun, visor);
  g.position.set(c.x, c.y, c.z);
  return g;
}

export function updateBodyMesh(c) {
  if (!c.mesh) return;
  c.mesh.position.set(c.x, c.y, c.z);
  c.mesh.rotation.y = c.yaw + Math.PI;
  const crouch = c.crouched ? 0.72 : 1;
  c.mesh.scale.set(1, crouch, 1);
}

// ---- bot perception ----
function canSee(bot, t, now) {
  const eyeY = bot.y + (bot.crouched ? 1.02 : 1.62);
  const tEye = t.y + (t.crouched ? 1.02 : 1.55);
  const dx = t.x - bot.x, dz = t.z - bot.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 55) return false;
  const ang = Math.atan2(-dx, -dz); // yaw convention: forward = (-sin yaw, -cos yaw)
  let d = ang - bot.yaw;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const fov = 1.9; // ~109 deg half? use abs
  if (Math.abs(d) > fov * 0.62 && dist > 4) {
    // outside FOV unless very close
    if (Math.abs(d) > 1.75) return false;
  }
  if (t.crouched && dist > 14) return false;
  if (losBlocked(bot.x, bot.z, eyeY, t.x, t.z, tEye)) return false;
  return true;
}

// ---- bot update ----
export function updateBot(bot, dt, game, rng, now) {
  const b = bot.bot;
  if (bot.dead) return;
  const enemies = game.combatants.filter((c) => c.team !== bot.team && !c.dead);

  // perception
  let seen = null, seenDist = 1e9;
  for (const e of enemies) {
    if (canSee(bot, e, now)) {
      const d = Math.hypot(e.x - bot.x, e.z - bot.z);
      if (d < seenDist) { seen = e; seenDist = d; }
    }
  }
  // hearing
  if (game.noise && game.noise.t > b.hearT && Math.hypot(game.noise.x - bot.x, game.noise.z - bot.z) < game.noise.r) {
    b.hearX = game.noise.x; b.hearZ = game.noise.z; b.hearT = game.noise.t;
    if (b.mode !== 'engage') { b.mode = 'hunt'; b.wpPath = []; }
  }
  if (seen) {
    b.enemy = seen;
    b.lastSeenX = seen.x; b.lastSeenZ = seen.z; b.lastSeenT = now;
    if (b.mode !== 'engage') {
      b.mode = 'engage';
      b.reactAt = now + (rng() * (BOTS.reactMs[1] - BOTS.reactMs[0]) + BOTS.reactMs[0]) / 1000;
    }
  } else if (b.mode === 'engage' && now - b.lastSeenT > 2.6) {
    b.mode = 'hunt'; b.wpPath = [];
  }

  const eyeY = bot.y + (bot.crouched ? 1.02 : 1.62);

  if (b.mode === 'engage' && b.enemy && !b.enemy.dead) {
    const e = b.enemy;
    // aim with error that shrinks while engaging
    const aimSkill = BOTS.accuracy;
    const err = (1 - aimSkill) * 0.09 + (e.moving ? 0.05 : 0) + seenDist * 0.0012;
    const tYaw = Math.atan2(-(e.x - bot.x), -(e.z - bot.z));
    const tPitch = Math.atan2((e.y + (e.crouched ? 1.0 : 1.35)) - eyeY, Math.hypot(e.x - bot.x, e.z - bot.z));
    // smooth aim
    let dy = tYaw - b.aimYaw;
    while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const lerp = Math.min(1, dt * 6);
    b.aimYaw += dy * lerp;
    b.aimPitch += (tPitch - b.aimPitch) * lerp;
    bot.yaw = b.aimYaw; bot.pitch = b.aimPitch;

    // movement: strafe while engaging
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafe = rng() < 0.5 ? -1 : 1; b.strafeT = 0.7 + rng() * 0.9; }
    const sp = 3.4 * b.speedMul;
    const fx = -Math.sin(b.aimYaw), fz = -Math.cos(b.aimYaw);
    let mx = fx * 0.4 + (-fz) * b.strafe, mz = fz * 0.4 + (fx) * b.strafe;
    // keep some distance
    if (seenDist < 7) { mx = -fx * 0.8; mz = -fz * 0.8; }
    if (seenDist > 26) { mx = fx; mz = fz; }
    const ml = Math.hypot(mx, mz) || 1;
    bot.vx = (mx / ml) * sp; bot.vz = (mz / ml) * sp;
    bot.moving = true;
    const nc = collideCircle(bot.x + bot.vx * dt, bot.z + bot.vz * dt, bot.radius);
    bot.x = nc.x; bot.z = nc.z;

    // shooting
    const wkey = bot.weapons[bot.current] ? bot.current : (bot.weapons[2] || bot.weapons[1]);
    const w = WEAPONS[wkey];
    const ammo = bot.ammo[wkey];
    if (now >= b.reactAt && now >= b.nextShot && ammo && ammo.mag > 0 && seenDist < w.range) {
      if (b.burstLeft <= 0) {
        b.burstLeft = w.auto ? 2 + Math.floor(rng() * 4) : 1;
        b.burst = b.burstLeft;
      }
      if (b.burstLeft > 0) {
        b.burstLeft--;
        // aim error applied through pitch/yaw jitter
        const jy = (rng() - 0.5) * err * 2, jp = (rng() - 0.5) * err;
        const sy = bot.yaw + jy, sp2 = Math.max(-1.4, Math.min(1.4, bot.pitch + jp));
        const res = fireWeapon({ ...bot, y: eyeY, yaw: sy, pitch: sp2, moving: true, state: bot.state }, wkey, game.combatants, rng, now);
        game.onShots(bot, res, wkey);
        ammo.mag--;
        b.nextShot = now + 1 / w.rate + (rng() * 0.05);
        if (!w.auto) b.nextShot = now + 1 / w.rate;
        if (b.burstLeft === 0 && w.auto) b.nextShot = now + 0.35 + rng() * 0.3;
      }
    }
    if (ammo && ammo.mag === 0) {
      // reload
      const reserve = ammo.reserve;
      if (reserve > 0) {
        const need = w.mag - ammo.mag;
        const take = Math.min(need, reserve);
        ammo.mag += take; ammo.reserve -= take;
        b.nextShot = now + 1.6;
      } else { bot.current = bot.weapons[2] ? 2 : 1; }
    }
  } else {
    // route / hunt / hold: follow waypoints
    bot.moving = false;
    if (b.mode === 'hunt') {
      if (!b.wpPath.length) {
        const from = nearestWp(bot.x, bot.z);
        const to = nearestWp(b.hearT > -90 ? b.hearX : b.lastSeenX, b.hearT > -90 ? b.hearZ : b.lastSeenZ);
        b.wpPath = routePath(from, to); b.wpIdx = 0;
      }
    } else if (b.mode === 'route') {
      if (b.targetWp < 0 || b.wpIdx >= b.wpPath.length) {
        // pick objective: attackers go to a site, defenders hold near sites/mid
        const obj = bot.team === 'att'
          ? nearestWp(game.siteTarget.x, game.siteTarget.z)
          : [nearestWp(0, -10), nearestWp(-12, 2), nearestWp(12, 2), nearestWp(-21, -12), nearestWp(21, -12)][Math.floor(rng() * 5)];
        const from = nearestWp(bot.x, bot.z);
        b.wpPath = routePath(from, obj); b.wpIdx = 0; b.targetWp = obj;
        if (bot.team === 'def') b.mode = 'hold';
      }
    }
    if (b.mode === 'hold') {
      b.holdT -= dt;
      // scan around
      bot.yaw += Math.sin(now * 0.7 + bot.id) * dt * 0.8;
      if (b.holdT <= 0) { b.mode = 'route'; b.targetWp = -1; }
      bot.vx = 0; bot.vz = 0;
    } else if (b.wpPath.length && b.wpIdx < b.wpPath.length) {
      const wp = waypoints[b.wpPath[b.wpIdx]];
      const dx = wp[0] - bot.x, dz = wp[1] - bot.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.1) { b.wpIdx++; }
      else {
        const sp = (bot.team === 'att' ? 4.6 : 4.2) * b.speedMul;
        bot.vx = (dx / d) * sp; bot.vz = (dz / d) * sp;
        bot.yaw = Math.atan2(-(dx / d), -(dz / d));
        bot.moving = true;
        const nc = collideCircle(bot.x + bot.vx * dt, bot.z + bot.vz * dt, bot.radius);
        bot.x = nc.x; bot.z = nc.z;
      }
    }
    bot.pitch = 0;
  }

  // decay bloom/recoil
  bot.state.bloom = Math.max(0, bot.state.bloom - dt * 1.8);
  bot.state.recoil = Math.max(0, bot.state.recoil - dt * 0.35);
  updateBodyMesh(bot);
}
