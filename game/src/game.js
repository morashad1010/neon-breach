// Match state machine: rounds, freeze/buy, bomb objective, money, damage, grenades, killfeed.
import { ROUND, ECON, PLAYER, WEAPONS, GRENADES, ARMOR_PRICE, KIT_PRICE, BOTS } from './config.js';
import { sites, colliders, collideCircle, spawns, nearestWp } from './map.js';
import { rayLevel } from './weapons.js';
import { makeCombatant, buildBodyMesh, updateBot, updateBodyMesh } from './bots.js';
import { updatePlayer } from './player.js';
import * as sfx from './audio.js';

export function createGame({ scene, effects, hud, rng }) {
  const game = {
    scene, effects, hud, rng,
    phase: 'menu',
    round: 0, scoreAtt: 0, scoreDef: 0,
    timer: ROUND.time, freezeT: ROUND.freeze,
    combatants: [],
    player: null,
    noise: { x: 0, z: 0, r: 0, t: -99 },
    grenades: [],
    bomb: { planted: false, site: null, fuseT: 0, planter: null, defusing: null, defuseT: 0, plantedAt: 0 },
    siteTarget: sites.A,
    planting: null, plantT: 0,
    roundEndT: 0, roundEndReason: '',
    matchOver: false,
    events: [], // {type:'kill'|'round'|..., ...} for hud
  };

  game.sfxAt = (name, vol = 1) => sfx.sfx(name, { vol });
  game.audioStep = (x, z) => {
    const d = Math.hypot(x - game.player.x, z - game.player.z);
    sfx.sfx('step', { vol: Math.max(0, 1 - d / 30) * 0.7 });
    // bots hear footsteps too
    if (d < 9) game.noise = { x, z, r: 9, t: game.now };
  };

  game.now = 0;

  game.spawnTeams = () => {
    for (const c of game.combatants) { if (c.mesh) { game.scene.remove(c.mesh); c.mesh = null; } }
    game.combatants = [];
    game.grenades = [];
    game.bomb = { planted: false, site: null, fuseT: 0, planter: null, defusing: null, defuseT: 0, plantedAt: 0 };
    game.planting = null;
    const attSpots = [...spawns.att], defSpots = [...spawns.def];
    // player + 4 friendly bots
    const p = makeCombatant('att', 'You', true, attSpots[0][0], attSpots[0][1], Math.PI);
    p.weapons = { 0: 'knife', 1: 'p9', 2: null };
    p.current = 'p9';
    p.money = game.playerMoney ?? ECON.start;
    game.player = p;
    game.combatants.push(p);
    for (let i = 1; i < 5; i++) {
      const s = attSpots[i % attSpots.length];
      const b = makeCombatant('att', 'Kestrel-' + i, false, s[0] + rng() - 0.5, s[1] + rng() - 0.5, Math.PI);
      b.weapons = { 0: 'knife', 1: rng() < 0.5 ? 'hornet' : 'p9', 2: rng() < 0.4 ? 'longsword' : null };
      b.current = b.weapons[2] || b.weapons[1];
      game.combatants.push(b);
    }
    for (let i = 0; i < 5; i++) {
      const s = defSpots[i % defSpots.length];
      const b = makeCombatant('def', 'Vulture-' + i, false, s[0] + rng() - 0.5, s[1] + rng() - 0.5, 0);
      b.weapons = { 0: 'knife', 1: 'p9', 2: rng() < 0.55 ? 'longsword' : (rng() < 0.5 ? 'mastiff' : null) };
      b.current = b.weapons[2] || b.weapons[1];
      b.grenades = rng() < 0.5 ? ['flash'] : (rng() < 0.3 ? ['he'] : []);
      game.combatants.push(b);
    }
    for (const c of game.combatants) {
      c.mesh = buildBodyMesh(c);
      game.scene.add(c.mesh);
      updateBodyMesh(c);
    }
    // attackers carry the charge
    if (game.round % 2 === 0) game.siteTarget = sites.A; else game.siteTarget = sites.B;
    game.chargeCarrier = game.combatants[0 + Math.floor(rng() * 5)];
  };

  game.startMatch = () => {
    game.round = 0; game.scoreAtt = 0; game.scoreDef = 0;
    game.playerMoney = ECON.start;
    game.matchOver = false;
    game.startRound();
  };

  game.startRound = () => {
    game.round++;
    game.spawnTeams();
    game.phase = 'freeze';
    game.freezeT = ROUND.freeze;
    game.timer = ROUND.time;
    game.roundEndT = 0;
    hud.showBuy(game.player);
    hud.banner('ROUND ' + game.round, game.round % 2 === 0 ? 'Plant at site A' : 'Plant at site B');
    sfx.sfx('beep');
  };

  game.endRound = (attWon, reason) => {
    if (game.phase !== 'round') return;
    game.phase = 'roundEnd';
    game.roundEndT = 5;
    game.roundEndReason = reason;
    if (attWon) { game.scoreAtt++; } else { game.scoreDef++; }
    // money
    for (const c of game.combatants) {
      if (c.team === 'att') {
        c.money = (c.isPlayer ? game.playerMoney : 0) + (attWon ? ECON.win : Math.min(ECON.lossMax, ECON.lossBase + game.lossStreak * ECON.lossStep));
      }
    }
    game.lossStreak = attWon ? 0 : (game.lossStreak || 0) + 1;
    if (game.player) game.playerMoney = game.player.money = attWon ? game.player.money + ECON.win : Math.min(ECON.lossMax, game.player.money + ECON.lossBase + (game.lossStreak - 1) * ECON.lossStep);
    hud.banner(attWon ? 'KESTRELS WIN THE ROUND' : 'VULTURES WIN THE ROUND', reason);
    sfx.sfx(attWon ? 'roundwin' : 'roundlose');
    game.events.push({ type: 'round', attWon, reason });
    if (game.scoreAtt >= ROUND.firstTo || game.scoreDef >= ROUND.firstTo) {
      game.matchOver = true;
    }
  };

  game.onShots = (shooter, res, wkey) => {
    const w = res.weapon;
    const eyeY = shooter.y + (shooter.crouched ? 1.02 : 1.62);
    // muzzle + noise
    const fx = -Math.sin(shooter.yaw), fz = -Math.cos(shooter.yaw);
    effects.muzzle(shooter.x + fx * 0.5, eyeY - 0.12, shooter.z + fz * 0.5, fx, 0, fz);
    game.noise = { x: shooter.x, z: shooter.z, r: wkey === 'knife' ? 4 : 34, t: game.now };
    const far = game.player && Math.hypot(shooter.x - game.player.x, shooter.z - game.player.z) > 22;
    sfx.sfx(far ? 'shotFar' : 'shot', { vol: shooter.isPlayer ? 1 : Math.max(0.15, 1 - Math.hypot(shooter.x - game.player.x, shooter.z - game.player.z) / 40) });
    effects.shakeAdd(shooter.isPlayer ? 0.12 : 0.03);

    for (const ev of res.events) {
      const ex = ev.from.x + ev.dir.x * ev.dist, ey = ev.from.y + ev.dir.y * ev.dist, ez = ev.from.z + ev.dir.z * ev.dist;
      effects.tracer(ev.from.x + fx * 0.6, ev.from.y - 0.1, ev.from.z + fz * 0.6, ex, ey, ez);
      if (ev.target) {
        effects.impact(ex, ey, ez, ev.head ? 0xff5470 : 0xffcf6e);
        if (!ev.target.isPlayer) effects.blood(ex, ey, ez);
        let dmg = w.dmg * (ev.head ? w.headMult : 1);
        // falloff
        const fall = Math.max(0.35, 1 - ev.dist / (w.range * 1.4));
        dmg *= fall;
        if (wkey === 'knife') dmg = w.dmg;
        game.damage(ev.target, dmg, shooter, ev.head);
        if (shooter.isPlayer) { hud.hitmarker(ev.head); sfx.sfx('hit'); }
      } else if (ev.wall) {
        effects.impact(ex, ey, ez, 0x9fb2d0);
      }
    }
  };

  game.damage = (target, dmg, attacker, head) => {
    if (target.dead) return;
    let d = dmg;
    if (target.armor > 0) {
      const absorbed = Math.min(target.armor, d * 0.5);
      target.armor -= absorbed; d -= absorbed;
    }
    target.hp -= d;
    if (target.isPlayer) {
      hud.damageFlash();
      sfx.sfx('hurt', { vol: Math.min(1, d / 30) });
      effects.shakeAdd(0.18);
    }
    if (target.hp <= 0) {
      target.dead = true;
      target.hp = 0;
      if (target.mesh) { target.mesh.rotation.z = Math.PI / 2; target.mesh.position.y = 0.25; }
      game.events.push({ type: 'kill', attacker, victim: target, head });
      hud.killfeed(attacker, target, head);
      if (attacker && attacker.isPlayer) {
        attacker.money += ECON.kill;
        if (game.player) game.playerMoney = game.player.money = attacker.money;
        sfx.sfx('kill');
      }
      if (attacker && !attacker.isPlayer && target.isPlayer) sfx.sfx('roundlose', { vol: 0.4 });
      // check round end by elimination
      const attAlive = game.combatants.filter((c) => c.team === 'att' && !c.dead).length;
      const defAlive = game.combatants.filter((c) => c.team === 'def' && !c.dead).length;
      if (game.phase === 'round') {
        if (defAlive === 0) game.endRound(true, 'Enemy team eliminated');
        else if (attAlive === 0) game.endRound(false, 'Your team was eliminated');
      }
    }
  };

  game.throwGrenade = (owner, key, eyeY) => {
    const def = GRENADES[key];
    const fx = -Math.sin(owner.yaw), fz = -Math.cos(owner.yaw);
    const cp = Math.cos(owner.pitch);
    game.grenades.push({
      type: def.type, x: owner.x + fx * 0.5, y: eyeY, z: owner.z + fz * 0.5,
      vx: fx * cp * 11 + owner.vx * 0.5, vy: Math.sin(owner.pitch) * 11 + 2.4, vz: fz * cp * 11 + owner.vz * 0.5,
      fuse: def.type === 'flash' ? 1.6 : 2.2, owner,
    });
    sfx.sfx('beep', { vol: 0.4 });
  };

  game.tryUse = (p, dt) => {
    if (game.phase !== 'round') return;
    const b = game.bomb;
    // plant: attacker with charge inside a site
    if (p.team === 'att' && !b.planted && p === game.chargeCarrier) {
      const inA = Math.hypot(p.x - sites.A.x, p.z - sites.A.z) < sites.A.r;
      const inB = Math.hypot(p.x - sites.B.x, p.z - sites.B.z) < sites.B.r;
      if (inA || inB) {
        game.planting = { site: inA ? 'A' : 'B', t: ROUND.plantTime };
        game.plantT += dt;
        hud.chatMsg('Planting at site ' + game.planting.site + '… ' + Math.max(0, ROUND.plantTime - game.plantT).toFixed(1) + 's');
        if (game.plantT >= ROUND.plantTime) {
          b.planted = true; b.site = game.planting.site; b.fuseT = ROUND.fuse; b.planter = p; b.plantedAt = game.now;
          game.planting = null;
          hud.chatMsg('');
          hud.banner('CHARGE PLANTED — SITE ' + b.site, 'Vultures have ' + ROUND.fuse + 's to defuse');
          sfx.sfx('plant');
          if (p.isPlayer) { p.money += ECON.plant; game.playerMoney = p.money; }
          game.events.push({ type: 'plant', site: b.site });
        }
        return;
      }
    }
    // defuse: defender near planted bomb
    if (p.team === 'def' && b.planted) {
      const s = b.site === 'A' ? sites.A : sites.B;
      if (Math.hypot(p.x - s.x, p.z - s.z) < s.r + 1) {
        if (!b.defusing) { b.defusing = p; b.defuseT = 0; }
        b.defuseT += dt;
        hud.chatMsg('Defusing… ' + Math.max(0, ROUND.defuseTime - b.defuseT).toFixed(1) + 's');
        if (b.defuseT >= ROUND.defuseTime) {
          hud.chatMsg('');
          game.endRound(false, 'Charge defused');
          if (p.isPlayer) { p.money += ECON.defuse; game.playerMoney = p.money; }
          b.defusing = null;
        }
        return;
      }
    }
    game.planting = null; game.plantT = 0;
    if (b.defusing === p) b.defusing = null;
  };
  game.cancelUse = (p) => {
    if (game.planting) { game.planting = null; game.plantT = 0; hud.chatMsg(''); }
    if (game.bomb.defusing === p) game.bomb.defusing = null;
  };

  // buy menu
  game.buyItems = () => ([
    { cat: 'Sidearms', items: [
      { id: 'p9', name: WEAPONS.p9.name, price: WEAPONS.p9.price },
      { id: 'hornet', name: WEAPONS.hornet.name, price: WEAPONS.hornet.price },
    ]},
    { cat: 'Rifles', items: [
      { id: 'mastiff', name: WEAPONS.mastiff.name, price: WEAPONS.mastiff.price },
      { id: 'longsword', name: WEAPONS.longsword.name, price: WEAPONS.longsword.price },
    ]},
    { cat: 'Gear', items: [
      { id: 'armor', name: 'Breach Armor', price: ARMOR_PRICE },
      { id: 'flash', name: 'Dazzler (flash)', price: GRENADES.flash.price },
      { id: 'he', name: 'Blast Charge (HE)', price: GRENADES.he.price },
      { id: 'kit', name: 'Defuse Kit', price: KIT_PRICE, defOnly: true },
    ]},
  ]);
  game.buy = (itemId) => {
    const p = game.player;
    if (!p || p.dead) return false;
    const all = game.buyItems().flatMap((c) => c.items);
    const item = all.find((i) => i.id === itemId);
    if (!item || p.money < item.price) return false;
    if (item.defOnly && p.team !== 'def') return false;
    p.money -= item.price; game.playerMoney = p.money;
    if (item.id === 'armor') { p.armor = 100; }
    else if (item.id === 'flash' || item.id === 'he') { p.grenades.push(item.id); }
    else if (item.id === 'kit') { p.hasKit = true; }
    else {
      const w = WEAPONS[item.id];
      p.weapons[w.slot] = item.id;
      p.ammo[item.id] = { mag: w.mag, reserve: w.reserve };
      p.current = item.id;
    }
    sfx.sfx('buy');
    return true;
  };

  game.update = (dt, input) => {
    game.now += dt;
    const now = game.now;
    if (game.phase === 'freeze') {
      game.freezeT -= dt;
      if (game.freezeT <= 0 || input.wasPressed('Enter')) {
        game.phase = 'round';
        hud.hideBuy();
      }
      // still simulate bots idly
    }
    if (game.phase === 'round') {
      game.timer -= dt;
      if (game.timer <= 0) {
        game.timer = 0;
        if (game.bomb.planted) game.endRound(false, 'Time expired — charge still live'); // defenders win on time unless bomb goes off
        else game.endRound(false, 'Time expired');
      }
      // bomb fuse
      if (game.bomb.planted && !game.bomb.defusing) {
        game.bomb.fuseT -= dt;
        if (Math.ceil(game.bomb.fuseT) !== Math.ceil(game.bomb.fuseT + dt) && game.bomb.fuseT < 10) sfx.sfx('beep', { vol: 0.5 });
        if (game.bomb.fuseT <= 0) {
          const s = game.bomb.site === 'A' ? sites.A : sites.B;
          effects.explode(s.x, 0.5, s.z);
          sfx.sfx('boom');
          for (const c of game.combatants) {
            const d = Math.hypot(c.x - s.x, c.z - s.z);
            if (d < 8.5) game.damage(c, 120 * (1 - d / 9), game.bomb.planter, false);
          }
          game.endRound(true, 'Charge detonated at site ' + game.bomb.site);
        }
      }
    }
    if (game.phase === 'roundEnd') {
      game.roundEndT -= dt;
      if (game.roundEndT <= 0) {
        if (game.matchOver) { game.phase = 'matchEnd'; hud.matchEnd(game.scoreAtt >= ROUND.firstTo); }
        else game.startRound();
      }
    }

    // simulate combatants
    for (const c of game.combatants) {
      if (c.dead) continue;
      if (c.isPlayer) updatePlayer(c, input, dt, game, rng, now);
      else updateBot(c, dt, game, rng, now);
    }

    // grenades
    for (let i = game.grenades.length - 1; i >= 0; i--) {
      const g = game.grenades[i];
      g.fuse -= dt;
      g.vy -= 22 * dt;
      let nx = g.x + g.vx * dt, ny = g.y + g.vy * dt, nz = g.z + g.vz * dt;
      if (ny < 0.12) { ny = 0.12; g.vy *= -0.42; g.vx *= 0.7; g.vz *= 0.7; }
      // wall bounce
      const t = rayLevel(g.x, g.y, g.z, Math.sign(g.vx) || 1, 0, Math.sign(g.vz) || 1, 0.4);
      g.x = nx; g.y = ny; g.z = nz;
      if (g.fuse <= 0) {
        game.grenades.splice(i, 1);
        if (g.type === 'he') {
          effects.explode(g.x, g.y, g.z);
          sfx.sfx('boom', { vol: Math.max(0.2, 1 - Math.hypot(g.x - game.player.x, g.z - game.player.z) / 50) });
          for (const c of game.combatants) {
            if (c.dead) continue;
            const d = Math.hypot(c.x - g.x, c.z - g.z);
            if (d < GRENADES.he.radius) game.damage(c, GRENADES.he.dmg * (1 - d / (GRENADES.he.radius + 1)), g.owner, false);
          }
        } else {
          sfx.sfx('flash');
          effects.explode(g.x, g.y, g.z);
          // blind player if looking
          const p = game.player;
          if (p && !p.dead) {
            const d = Math.hypot(p.x - g.x, p.z - g.z);
            if (d < 12) {
              const toP = Math.atan2(-(p.x - g.x), -(p.z - g.z));
              let dy = toP - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
              if (Math.abs(dy) < 1.2) hud.flash(Math.max(0.4, 2.6 - d * 0.2));
            }
          }
        }
      }
    }
  };

  return game;
}
