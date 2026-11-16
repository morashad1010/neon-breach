// Keyboard + mouse input with pointer lock.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();       // cleared each sim step
  let yaw = 0, pitch = 0;
  let firing = false, fireClicked = false;
  let locked = false;
  const listeners = { action: [] }; // action names: reload, buy, grenade, use, score, weapon1..3, start

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    const map = {
      KeyR: 'reload', KeyB: 'buy', KeyG: 'grenade', KeyE: 'use', Tab: 'score',
      Digit1: 'weapon0', Digit2: 'weapon1', Digit3: 'weapon2', Enter: 'start',
    };
    const a = map[e.code];
    if (a) { listeners.action.forEach((f) => f(a)); e.preventDefault(); }
    if (e.code === 'Tab') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); firing = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!locked) { canvas.requestPointerLock(); return; }
    if (e.button === 0) { firing = true; fireClicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; });
  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    yaw -= (e.movementX || 0) * 0.0023;
    pitch -= (e.movementY || 0) * 0.0023;
    const lim = Math.PI / 2 - 0.01;
    pitch = Math.max(-lim, Math.min(lim, pitch));
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    listeners.lockChange && listeners.lockChange.forEach((f) => f(locked));
  });

  return {
    keys, pressed, listeners,
    debugFire: false,
    get yaw() { return yaw; }, get pitch() { return pitch; },
    get firing() { return firing || this.debugFire; }, get fireClicked() { return fireClicked || this.debugFire; },
    get locked() { return locked; },
    setView(y, p) { yaw = y; pitch = p; },
    consumeFire() { const v = fireClicked; fireClicked = false; return v; },
    endStep() { pressed.clear(); fireClicked = false; },
    axis() {
      let f = 0, s = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      return { f, s };
    },
    get crouch() { return keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC'); },
    get walk() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    wasPressed(code) { return pressed.has(code); },
  };
}
