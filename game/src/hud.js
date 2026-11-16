// HUD + menus: DOM updates, buy menu, banners, killfeed, hitmarker, flash.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hp: $('hp'), hpBar: document.querySelector('#hp-bar i'),
    ap: $('ap'), apBar: document.querySelector('#ap-bar i'),
    ammo: $('ammo'), money: $('money'), weaponName: $('weapon-name'),
    score: $('score'), timer: $('timer'), roundLabel: $('round-label'),
    killfeed: $('killfeed'), banner: $('banner'), chat: $('chat-msg'),
    hitmarker: $('hitmarker'), dmg: $('dmg'),
    startMenu: $('start-menu'), buyMenu: $('buy'), buyCols: $('buy-cols'), buyMoney: $('buy-money'),
    dead: $('dead'), deadSub: $('dead-sub'),
    crosshair: $('crosshair'),
  };
  let bannerT = 0, feedN = 0, flashT = 0, hmT = 0;

  return {
    els: el,
    showStart() { el.startMenu.style.display = 'flex'; },
    hideStart() { el.startMenu.style.display = 'none'; },
    showDead(sub) { el.dead.style.display = 'flex'; el.deadSub.textContent = sub; },
    hideDead() { el.dead.style.display = 'none'; },
    banner(text, sub = '') {
      el.banner.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
      el.banner.style.opacity = '1';
      bannerT = 2.6;
    },
    chatMsg(t) { el.chat.textContent = t; },
    killfeed(attacker, victim, head) {
      const div = document.createElement('div');
      const aCls = attacker && attacker.team === 'att' ? 'you' : 'foe';
      const vCls = victim.team === 'att' ? 'you' : 'foe';
      div.innerHTML = `<b class="${aCls}">${attacker ? attacker.name : '?'}</b> ${head ? '🎯' : ' ▸ '} <b class="${vCls}">${victim.name}</b>`;
      el.killfeed.prepend(div);
      if (++feedN > 6) el.killfeed.lastChild.remove();
    },
    hitmarker(head) {
      el.hitmarker.style.opacity = '1';
      el.hitmarker.style.transform = `translate(-50%,-50%) rotate(45deg) scale(${head ? 1.35 : 1})`;
      hmT = 0.12;
    },
    damageFlash() { el.dmg.style.opacity = '0.9'; },
    flash(t) { flashT = Math.max(flashT, t); },
    showBuy(p) {
      el.buyMenu.style.display = 'flex';
      this.renderBuy(p);
    },
    hideBuy() { el.buyMenu.style.display = 'none'; },
    get buyOpen() { return el.buyMenu.style.display === 'flex'; },
    renderBuy(p) {
      el.buyMoney.textContent = '$' + p.money;
      // filled by game via buyItems
    },
    renderBuyFull(p, items, onBuy) {
      el.buyCols.innerHTML = '';
      for (const col of items) {
        const div = document.createElement('div');
        div.className = 'col';
        div.innerHTML = `<h3>${col.cat}</h3>`;
        for (const it of col.items) {
          const row = document.createElement('div');
          row.className = 'item';
          const owned = (it.id === 'armor' && p.armor >= 100) || (it.id !== 'armor' && it.id !== 'flash' && it.id !== 'he' && it.id !== 'kit' && p.weapons[2] === it.id) || ((it.id === 'flash' || it.id === 'he') && p.grenades.includes(it.id));
          if (owned) row.classList.add('owned');
          row.innerHTML = `<span>${it.name}</span><span class="price">$${it.price}</span>`;
          row.onclick = () => onBuy(it.id);
          div.appendChild(row);
        }
        el.buyCols.appendChild(div);
      }
      el.buyMoney.textContent = '$' + p.money;
    },
    matchEnd(attWon) {
      el.startMenu.style.display = 'flex';
      el.startMenu.querySelector('h1').textContent = attWon ? 'VICTORY' : 'DEFEAT';
      el.startMenu.querySelector('h2').textContent = `Final score ${document.querySelector('#score .you').textContent} : ${document.querySelector('#score .foe').textContent} — reload to play again`;
      document.getElementById('play-btn').textContent = 'PLAY AGAIN';
    },
    update(p, game, spreadPx) {
      el.hp.textContent = Math.max(0, Math.ceil(p.hp));
      el.hpBar.style.width = Math.max(0, p.hp) + '%';
      el.ap.textContent = Math.max(0, Math.round(p.armor));
      el.apBar.style.width = Math.max(0, p.armor) + '%';
      const w = game.combatants.find((c) => c.isPlayer);
      const wkey = p.current;
      const ammo = p.ammo[wkey];
      el.weaponName.textContent = (window.__wname || '') + '';
      el.weaponName.textContent = wkey === 'knife' ? 'Combat Knife' : ({ p9: 'P9 Sidearm', hornet: 'Hornet SMG', longsword: 'Longsword AR', mastiff: 'Mastiff-12' })[wkey] || wkey;
      el.ammo.textContent = ammo ? `${ammo.mag} / ${ammo.reserve}` : '—';
      el.money.textContent = '$' + p.money;
      const m = Math.ceil(game.timer);
      el.timer.textContent = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
      el.timer.style.color = m < 20 && game.phase === 'round' ? '#ff5470' : '#ffd166';
      el.roundLabel.textContent = `Round ${game.round} · ${game.phase === 'freeze' ? 'BUY PHASE' : game.phase === 'round' ? (game.bomb.planted ? 'CHARGE LIVE' : 'LIVE') : game.phase}`;
      el.score.innerHTML = `<span class="you">${game.scoreAtt}</span> : <span class="foe">${game.scoreDef}</span>`;
      // crosshair spread
      const gap = 6 + spreadPx;
      el.crosshair.children[0].style.top = `${-gap - 6}px`;
      el.crosshair.children[1].style.bottom = `${-gap - 6}px`;
      el.crosshair.children[2].style.left = `${-gap - 6}px`;
      el.crosshair.children[3].style.right = `${-gap - 6}px`;
      // timers
      if (bannerT > 0) { bannerT -= 1 / 60; if (bannerT <= 0) el.banner.style.opacity = '0'; }
      if (hmT > 0) { hmT -= 1 / 60; if (hmT <= 0) el.hitmarker.style.opacity = '0'; }
      if (el.dmg.style.opacity !== '0') {
        const o = parseFloat(el.dmg.style.opacity || '0') - 0.03;
        el.dmg.style.opacity = String(Math.max(0, o));
      }
      if (flashT > 0) {
        flashT -= 1 / 60;
        const o = flashT > 1.6 ? 1 : flashT / 1.6 * 0.85;
        el.dmg.style.background = `radial-gradient(ellipse at center, rgba(255,255,255,${o}) 0%, rgba(255,255,255,${o * 0.9}) 100%)`;
        el.dmg.style.opacity = '1';
        if (flashT <= 0) { el.dmg.style.opacity = '0'; el.dmg.style.background = ''; }
      }
    },
  };
}
