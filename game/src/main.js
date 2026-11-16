// NEON BREACH — boot, renderer, fixed-step simulation loop, screenshot autopilot (?shot=&seed=).
import * as THREE from 'three';
import { SIM, SHOT, WEAPONS } from './config.js';
import { makeRng } from './rng.js';
import { createInput } from './input.js';
import { initAudio, resumeAudio } from './audio.js';
import { buildMap } from './map.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createGame } from './game.js';
import { runShotScene } from './shots.js';
import { createViewModel } from './viewmodel.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '123456789', 10);
const shotMode = params.get('shot'); // null | 'start' | 'play' | 'buy' | 'plant'
const rng = makeRng(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 220);
scene.add(camera);

buildMap(scene);
const effects = createEffects(scene);
const hud = createHud();
const game = createGame({ scene, effects, hud, rng });
const input = createInput(canvas);
const viewmodel = createViewModel(camera);
{
  const origOnShots = game.onShots;
  game.onShots = (shooter, res, wkey) => {
    if (shooter && shooter.isPlayer) viewmodel.onFire();
    origOnShots(shooter, res, wkey);
  };
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// menu buttons
document.getElementById('play-btn').addEventListener('click', () => {
  initAudio(); resumeAudio();
  hud.hideStart();
  canvas.requestPointerLock();
  if (game.phase === 'menu') game.startMatch();
});
document.getElementById('spectate-btn').addEventListener('click', () => {
  hud.hideDead();
  canvas.requestPointerLock();
});

input.listeners.action.push((a) => {
  if (a === 'buy' && game.phase === 'freeze' && game.player && !game.player.dead) {
    if (hud.buyOpen) hud.hideBuy();
    else { hud.showBuy(game.player); hud.renderBuyFull(game.player, game.buyItems(), (id) => { game.buy(id); hud.renderBuyFull(game.player, game.buyItems(), (id2) => game.buy(id2)); }); }
  }
  if (a === 'start' && game.phase === 'freeze') { game.freezeT = 0; }
});

// buy menu clicks are handled via renderBuyFull; also any key closes buy when open
window.addEventListener('keydown', (e) => {
  if (hud.buyOpen && game.phase === 'freeze') {
    if (e.code !== 'KeyB') { /* stay open during freeze; B toggles */ }
  }
});

// ---- fixed-step loop ----
let last = performance.now();
let acc = 0;
let shotT = 0;
let shotDone = false;

function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now();
  let frameDt = (nowMs - last) / 1000;
  last = nowMs;
  if (frameDt > SIM.MAX_FRAME) frameDt = SIM.MAX_FRAME;

  // screenshot autopilot drives input/game directly
  if (shotMode && !shotDone) {
    shotT += frameDt;
    const done = runShotScene(shotMode, shotT, { game, input, hud, rng, camera });
    if (done) { shotDone = true; window.__shotReady = true; }
  }

  if (game.phase !== 'menu') {
    acc += frameDt;
    while (acc >= SIM.STEP) {
      game.update(SIM.STEP, input);
      input.endStep();
      acc -= SIM.STEP;
    }
  }

  // camera from player (or spectate)
  const p = game.player;
  if (p) {
    const eyeY = p.y + (p.crouched ? 1.02 : 1.62);
    camera.position.set(p.x, eyeY, p.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(p.yaw);
    camera.rotateX(p.pitch);
  }
  effects.update(frameDt, camera);
  if (p) {
    const moving = input.keys.has('KeyW') || input.keys.has('KeyA') || input.keys.has('KeyS') || input.keys.has('KeyD');
    viewmodel.update(frameDt, p, moving && !p.dead);
  }
  if (p && game.phase !== 'menu') {
    const spreadPx = (WEAPONS[p.current]?.spread || 0) * 900 + p.state.bloom * 22;
    hud.update(p, game, spreadPx);
  }
  renderer.render(scene, camera);
}
frame();

// expose for autopilot / debugging
window.__game = game;
window.__input = input;
if (shotMode && shotMode !== 'start') {
  // auto-start the match for screenshots
  setTimeout(() => {
    if (game.phase === 'menu') {
      hud.hideStart();
      game.startMatch();
      game.freezeT = 0.01;
    }
  }, 300);
}
