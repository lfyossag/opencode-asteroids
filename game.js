'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

const SPEED_BOOST_DURATION = 5;
const SPEED_ITEM_THRESHOLD = 20;

// ── Skins ─────────────────────────────────────────────────────────────────────
const SKINS = [
  { name: 'CLASICA',
    body: [[20,0],[-12,-9],[-7,0],[-12,9]],
    stroke: '#fff', fill: null,
    thrust: 'rgba(255,130,0,0.85)', thrustShape: [[-8,-4],[-22,0],[-8,4]] },
  { name: 'CAZA',
    body: [[18,0],[-10,-7],[-14,-3],[-6,0],[-14,3],[-10,7]],
    stroke: '#4cf', fill: 'rgba(80,200,255,0.12)',
    thrust: 'rgba(120,255,255,0.85)', thrustShape: [[-10,-3],[-24,0],[-10,3]] },
  { name: 'OVNI',
    body: [[14,-5],[-14,-5],[-10,0],[-14,5],[14,5],[10,0]],
    stroke: '#9f6', fill: 'rgba(160,255,100,0.15)',
    thrust: 'rgba(160,255,100,0.8)', thrustShape: [[-7,-4],[-16,0],[-7,4]] },
  { name: 'FLECHA',
    body: [[20,0],[-8,-11],[-2,0],[-8,11]],
    stroke: '#f44', fill: 'rgba(255,80,80,0.15)',
    thrust: 'rgba(255,200,80,0.85)', thrustShape: [[-6,-5],[-20,0],[-6,5]] },
];
let currentSkin = 0;
try {
  const saved = parseInt(localStorage.getItem('asteroids.skin'), 10);
  if (Number.isInteger(saved) && saved >= 0 && saved < SKINS.length) currentSkin = saved;
} catch (e) { /* localStorage no disponible */ }

const SHOOTING_STAR_SPEED = 180;
const SHOOTING_STAR_TTL   = 6;
const SHOOTING_STAR_POINTS = 250;
const SHOOTING_STAR_INTERVAL_MIN = 10;
const SHOOTING_STAR_INTERVAL_MAX = 20;

// ── Escudo ───────────────────────────────────────────────────────────────────
const SHIELD_MAX_ENERGY     = 5;     // capacidad total en segundos
const SHIELD_REGEN          = 0.6;   // energía regenerada por segundo
const SHIELD_MIN_RESTART    = 1.5;   // mínimo para reactivar tras agotarse
const SHIELD_IMPACT_COST    = 1;     // gasto por impacto absorbido
const SHIELD_DRAIN          = 1;     // consumo continuo por segundo activo
const SHIELD_RADIUS         = 26;    // radio de colisión/dibujo del escudo

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
    this.shieldEnergy  = SHIELD_MAX_ENERGY;
    this.shieldActive  = false;
    this.shieldDepleted = false;
    this.shieldNeedsRelease = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

// Escudo: activo mientras se mantenga ShiftLeft y haya energía
this.shieldActive = keys['ShiftLeft'] && this.shieldEnergy > 0
  && !this.shieldDepleted && !this.shieldNeedsRelease;
// Energía: drena cuando activo, regenera cuando inactivo
if (this.shieldActive)
  this.shieldEnergy = Math.max(0, this.shieldEnergy - SHIELD_DRAIN * dt);
else if (this.shieldEnergy < SHIELD_MAX_ENERGY)
  this.shieldEnergy = Math.min(SHIELD_MAX_ENERGY, this.shieldEnergy + SHIELD_REGEN * dt);
if (this.shieldEnergy === 0) this.shieldDepleted = true;
if (this.shieldDepleted && this.shieldEnergy >= SHIELD_MIN_RESTART)
  this.shieldDepleted = false;
// Requiere soltar Shift tras agotamiento antes de permitir reactivar
if (!keys['ShiftLeft']) this.shieldNeedsRelease = false;
else if (this.shieldDepleted) this.shieldNeedsRelease = true;

    const ROT   = 3.5;   // rad/s
    const THRUST = boostTimer > 0 ? 520 : 260;  // px/s² (duplica con boost)
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = SKINS[currentSkin].body[0][0];
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = SKINS[currentSkin];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.stroke;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    ctx.beginPath();
    ctx.moveTo(skin.body[0][0], skin.body[0][1]);
    for (let i = 1; i < skin.body.length; i++)
      ctx.lineTo(skin.body[i][0], skin.body[i][1]);
    ctx.closePath();
    ctx.stroke();
    if (skin.fill) { ctx.fillStyle = skin.fill; ctx.fill(); }

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const t = skin.thrustShape;
      ctx.beginPath();
      ctx.moveTo(t[0][0], t[0][1]);
      for (let i = 1; i < t.length; i++) ctx.lineTo(t[i][0], t[i][1]);
      ctx.closePath();
      ctx.strokeStyle = skin.thrust;
      ctx.stroke();
    }

    ctx.restore();

    // Escudo: arco cian pulsante alrededor de la nave
    if (this.shieldActive) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 0.6 + 0.25 * Math.sin(performance.now() / 90);
      ctx.strokeStyle = this.shieldDepleted
        ? 'rgba(255,90,90,0.5)'
        : `rgba(120,200,255,${pulse.toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Speed Item ───────────────────────────────────────────────────────────────
class SpeedItem {
  constructor() {
    let x, y;
    const cx = (typeof ship !== 'undefined' && ship && !ship.dead) ? ship.x : W / 2;
    const cy = (typeof ship !== 'undefined' && ship && !ship.dead) ? ship.y : H / 2;
    const SAFE = 130;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - cx, y - cy) < SAFE);
    this.x = x;
    this.y = y;
    this.vx = rand(-25, 25);
    this.vy = rand(-25, 25);
    this.radius = 10;
    this.rot = 0;
    this.rotSpeed = rand(-1, 1);
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  draw() {
    // Parpadeo sutil
    if (Math.sin(performance.now() / 120) < -0.55) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Shooting Star (estrella fugaz) ───────────────────────────────────────────
class ShootingStar {
  constructor() {
    // Aparece desde un borde aleatorio viajando hacia el campo
    const side = randInt(0, 3);
    let x, y, angle;
    if (side === 0)      { x = rand(0, W); y = 0;     angle = rand(Math.PI * 0.15, Math.PI * 0.85); }
    else if (side === 1) { x = W;          y = rand(0, H); angle = rand(Math.PI * 0.65, Math.PI * 1.35); }
    else if (side === 2) { x = rand(0, W); y = H;     angle = rand(Math.PI * 1.15, Math.PI * 1.85); }
    else                { x = 0;          y = rand(0, H); angle = rand(-Math.PI * 0.35, Math.PI * 0.35); }
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SHOOTING_STAR_SPEED;
    this.vy = Math.sin(angle) * SHOOTING_STAR_SPEED;
    this.radius = 14;
    this.rot = 0;
    this.rotSpeed = rand(-3, 3);
    this.ttl  = SHOOTING_STAR_TTL;
    this.life = SHOOTING_STAR_TTL;
    this.trail = [];
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
    this.trail.push([this.x, this.y]);
    if (this.trail.length > 12) this.trail.shift();
  }

  draw() {
    const alpha = Math.max(0, this.ttl / this.life);
    // Cola
    for (let i = 1; i < this.trail.length; i++) {
      const t = i / this.trail.length;
      ctx.strokeStyle = `rgba(120,255,255,${(t * alpha * 0.6).toFixed(2)})`;
      ctx.lineWidth = t * 2.5;
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1][0], this.trail[i - 1][1]);
      ctx.lineTo(this.trail[i][0], this.trail[i][1]);
      ctx.stroke();
    }
    // Estrella de 5 puntas
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = `rgba(120,255,255,${alpha.toFixed(2)})`;
    ctx.fillStyle = `rgba(120,255,255,${(alpha * 0.25).toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? this.radius : this.radius * 0.45;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let speedItem, boostTimer, asteroidsDestroyed;
let shootingStar, shootingStarTimer;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
  speedItem          = null;
  boostTimer         = 0;
  asteroidsDestroyed = 0;
  shootingStar       = null;
  shootingStarTimer  = rand(SHOOTING_STAR_INTERVAL_MIN, SHOOTING_STAR_INTERVAL_MAX);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  boostTimer = 0;
  speedItem = null;
  shootingStar = null;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Cambiar skin con teclas 1..N
  for (let i = 0; i < SKINS.length; i++) {
    if (pressed('Digit' + (i + 1))) {
      currentSkin = i;
      try { localStorage.setItem('asteroids.skin', String(i)); } catch (e) {}
    }
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide / estrella fugaz
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        asteroidsDestroyed++;
        if (!speedItem && asteroidsDestroyed % SPEED_ITEM_THRESHOLD === 0)
          speedItem = new SpeedItem();
      }
    }
    if (shootingStar && !b.dead && !shootingStar.dead && dist(b, shootingStar) < shootingStar.radius) {
      b.dead = true;
      shootingStar.dead = true;
      score += SHOOTING_STAR_POINTS;
      explode(shootingStar.x, shootingStar.y, 16);
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Speed item: mover, recoger, boost
  if (boostTimer > 0) boostTimer -= dt;
  if (speedItem) {
    speedItem.update(dt);
    if (!ship.dead && dist(ship, speedItem) < ship.radius + speedItem.radius) {
      speedItem.dead = true;
      boostTimer = SPEED_BOOST_DURATION;
    }
  }
  if (speedItem && speedItem.dead) speedItem = null;

  // Estrella fugaz: spawn por temporizador aleatorio
  shootingStarTimer -= dt;
  if (!shootingStar && shootingStarTimer <= 0) {
    shootingStar = new ShootingStar();
    shootingStarTimer = rand(SHOOTING_STAR_INTERVAL_MIN, SHOOTING_STAR_INTERVAL_MAX);
  }
  if (shootingStar) {
    shootingStar.update(dt);
    if (shootingStar.dead) shootingStar = null;
  }

  // Nave vs asteroide / estrella fugaz
  if (ship.invincible <= 0 && !ship.dead) {
    if (ship.shieldActive) {
      // Escudo activo: absorbe impactos, fragmenta asteroides sin puntos
      const newAsteroids = [];
      for (const a of asteroids) {
        if (!a.dead && dist(ship, a) < SHIELD_RADIUS + a.radius * 0.82) {
          a.dead = true;
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
      if (newAsteroids.length > 0) {
        asteroids = asteroids.concat(newAsteroids);
        ship.shieldEnergy = Math.max(0, ship.shieldEnergy - newAsteroids.length * SHIELD_IMPACT_COST);
        if (ship.shieldEnergy === 0) { ship.shieldDepleted = true; ship.shieldNeedsRelease = true; }
      }
      if (shootingStar && !shootingStar.dead &&
          dist(ship, shootingStar) < SHIELD_RADIUS + shootingStar.radius * 0.82) {
        shootingStar.dead = true;
        explode(shootingStar.x, shootingStar.y, 16);
        ship.shieldEnergy = Math.max(0, ship.shieldEnergy - SHIELD_IMPACT_COST);
        if (ship.shieldEnergy === 0) { ship.shieldDepleted = true; ship.shieldNeedsRelease = true; }
      }
    } else {
      // Sin escudo: comportamiento original
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
      if (!ship.dead && shootingStar &&
          dist(ship, shootingStar) < ship.radius + shootingStar.radius * 0.82) {
        killShip();
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  const skin = SKINS[currentSkin];
  const s = 0.42;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = skin.stroke;
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(skin.body[0][0] * s, skin.body[0][1] * s);
  for (let i = 1; i < skin.body.length; i++)
    ctx.lineTo(skin.body[i][0] * s, skin.body[i][1] * s);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  ctx.textAlign = 'left';
  ctx.font = '13px monospace';
  ctx.fillText(`SKIN: <${SKINS[currentSkin].name}>  [1-${SKINS.length}]`, 14, H - 16);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (boostTimer > 0) {
    const w = 140 * (boostTimer / SPEED_BOOST_DURATION);
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 70, 34, 140, 8);
    ctx.fillStyle = '#ff0';
    ctx.fillRect(W / 2 - 70, 34, w, 8);
  }

  // Barra del escudo: visible cuando hay actividad relevante
  if (ship && !ship.dead && (ship.shieldActive || ship.shieldDepleted ||
      ship.shieldEnergy < SHIELD_MAX_ENERGY)) {
    const w = 140 * (ship.shieldEnergy / SHIELD_MAX_ENERGY);
    const color = ship.shieldDepleted ? '#f55' : '#7cf';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 70, 46, 140, 8);
    ctx.fillStyle = color;
    ctx.fillRect(W / 2 - 70, 46, w, 8);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  if (shootingStar) shootingStar.draw();
  if (speedItem) speedItem.draw();
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
