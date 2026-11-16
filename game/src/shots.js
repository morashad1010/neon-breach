// Deterministic autopilot scenes for screenshots (?shot=start|play|buy|plant&seed=N).
// runShotScene returns true when the scene is done and window.__shotReady should be set.
import { sites } from './map.js';

function aimAt(input, from, to, eyeH, targetH) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2((to.y + targetH) - (from.y + eyeH), Math.hypot(dx, dz));
  input.setView(yaw, pitch);
}

export function runShotScene(mode, t, ctx) {
  const { game, input, hud, camera } = ctx;
  const p = game.player;
  if (!p && mode !== 'start') return false; // wait for auto-start

  if (mode === 'start') {
    // menu over a cinematic camera drift
    if (t < 0.1 && game.phase === 'menu') {
      hud.showStart();
    }
    const a = t * 0.08;
    camera.position.set(Math.sin(a) * 16, 7 + Math.sin(t * 0.3) * 1.5, 20 + Math.cos(a) * 6);
    camera.lookAt(0, 1.5, -6);
    return t > 2.5;
  }

  if (mode === 'buy') {
    if (!ctx._armed) { ctx._armed = true; p.armor = 50; p.money = 4750; }
    // keep freeze + menu open for the whole shot
    if (game.phase === 'freeze') {
      game.freezeT = 99;
      if (!hud.buyOpen) hud.showBuy(p);
      hud.renderBuyFull(p, game.buyItems(), () => {});
      if (game.phase === 'freeze') input.setView(Math.PI * 0.95, -0.04);
    }
    return t > 5;
  }

  if (mode === 'play') {
    if (!ctx._armed) {
      ctx._armed = true;
      // arm the player
      p.weapons[2] = 'longsword'; p.ammo.longsword = { mag: 30, reserve: 90 };
      p.current = 'longsword'; p.armor = 100; p.money = 9000;
      game.freezeT = 0.01;
      // stage the scene: player in the clear west lane looking north, one enemy bot in the open ahead
      p.x = -14; p.z = 8; p.yaw = 0; input.setView(0, -0.02);
      const enemy = game.combatants.find((c) => c.team === 'def' && !c.dead);
      if (enemy) {
        enemy.x = -14; enemy.z = -9; enemy.hp = 100;
        enemy.bot.mode = 'hunt'; enemy.bot.wpPath = []; enemy.bot.hearX = p.x; enemy.bot.hearZ = p.z; enemy.bot.react = 0.1;
      }
    }
    // slight strafe for life, aim at the staged enemy and fire in bursts
    if (Math.floor(t * 1.4) % 2 === 1) { input.keys.delete('KeyA'); input.keys.add('KeyD'); }
    else { input.keys.delete('KeyD'); input.keys.add('KeyA'); }
    const enemy = game.combatants.find((c) => c.team === 'def' && !c.dead);
    if (enemy) aimAt(input, p, enemy, 1.62, 1.3);
    input.debugFire = (Math.floor(t * 3) % 3) !== 2;
    return t > 9;
  }

  if (mode === 'plant') {
    if (!ctx._armed) {
      ctx._armed = true;
      game.freezeT = 0.01;
      game.chargeCarrier = p;
      p.armor = 100; p.weapons[2] = 'longsword'; p.ammo.longsword = { mag: 30, reserve: 90 }; p.current = 'longsword';
      p.x = sites.A.x; p.z = sites.A.z + 2.2; p.hp = 100;
    }
    // walk into site and hold E
    input.keys.add('KeyE');
    input.keys.delete('KeyW');
    input.setView(Math.atan2(-(sites.A.x - p.x), -(sites.A.z - p.z)), -0.08);
    // god-mode the player for the shot; enemies converge for drama
    p.hp = 100; p.armor = 100; p.dead = false;
    for (const c of game.combatants) {
      if (c.team === 'def' && !c.dead && c.bot) { c.bot.hearX = p.x; c.bot.hearZ = p.z; c.bot.hearT = t; c.bot.mode = 'hunt'; c.bot.wpPath = []; }
    }
    return t > 8;
  }

  return true;
}
