// NEON BREACH — global tuning constants.
export const FIELD = { w: 60, d: 60, h: 7 };          // map bounds in metres
export const SIM = { STEP: 1 / 60, MAX_FRAME: 0.25 };
export const PLAYER = {
  radius: 0.42, height: 1.72, crouchHeight: 1.15, eye: 1.62, crouchEye: 1.02,
  accel: 42, walkSpeed: 5.2, crouchSpeed: 2.6, airControl: 0.25,
  friction: 11, hp: 100, armor: 100,
};
export const ROUND = { time: 105, plantTime: 3.2, fuse: 35, defuseTime: 5.0, freeze: 12, firstTo: 8 };
export const ECON = {
  start: 800, win: 3500, lossBase: 1900, lossStep: 400, lossMax: 3400, kill: 300, plant: 800, defuse: 300,
};
export const BOTS = { count: 5, hp: 100, reactMs: [280, 520], accuracy: 0.62 };
export const WEAPONS = {
  knife:   { name: 'Combat Knife', slot: 0, dmg: 34, headMult: 2, rate: 2.2, mag: Infinity, reserve: Infinity, spread: 0, recoil: 0, auto: false, range: 2.2, pellets: 1, price: 0,   auto_: false },
  p9:      { name: 'P9 Sidearm',    slot: 1, dmg: 26, headMult: 3, rate: 3.1, mag: 12, reserve: 48, spread: 0.012, recoil: 0.011, auto: false, range: 60, pellets: 1, price: 300 },
  hornet:  { name: 'Hornet SMG',    slot: 1, dmg: 22, headMult: 2.5, rate: 9.5, mag: 30, reserve: 90, spread: 0.028, recoil: 0.008, auto: true, range: 45, pellets: 1, price: 1500 },
  longsword:{ name: 'Longsword AR', slot: 2, dmg: 33, headMult: 2.6, rate: 7.5, mag: 30, reserve: 90, spread: 0.011, recoil: 0.013, auto: true, range: 90, pellets: 1, price: 2900, zoom: 1.6 },
  mastiff: { name: 'Mastiff-12',    slot: 2, dmg: 11, headMult: 1.8, rate: 1.1, mag: 6, reserve: 24, spread: 0.075, recoil: 0.05, auto: false, range: 22, pellets: 8, price: 1800 },
};
export const GRENADES = {
  flash: { name: 'Dazzler', price: 200, type: 'flash' },
  he:    { name: 'Blast Charge', price: 300, type: 'he', dmg: 92, radius: 7 },
};
export const ARMOR_PRICE = 650, KIT_PRICE = 400;
export const SHOT = { w: 1280, h: 720 };
