// Conservative, robust version with loading and debug info  
const CANVAS_W = 360;
const CANVAS_H = 660;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Asset names (place these files beside HTML)
const ASSETS = {
  bg: 'flappybirdbg.png',
  bird: 'FB_IMG_1761575220463-pica.png  ',
  topPipe: 'toppipe.png',
  bottomPipe: 'bottompipe.png',
  fartSound: document.getElementById('fartSound'),
  hitSound: document.getElementById('hitSound') // NEW LONG SOUND
};

let images = {};
let imagesToLoad = Object.keys(ASSETS).filter(k => k !== 'fartSound' && k !== 'hitSound').length;
let loadedCount = 0;
let debug = true;

function log(...args) { if (debug) console.log(...args); }

// Load images
for (let key of Object.keys(ASSETS)) {
  if (key === 'fartSound' || key === 'hitSound') continue;

  const img = new Image();
  img.src = ASSETS[key];
  img.onload = () => {
    images[key] = img;
    loadedCount++;
    log(`Loaded ${key} (${loadedCount}/${imagesToLoad})`);

    if (loadedCount === imagesToLoad) onAllAssetsLoaded();
  };
  img.onerror = () => console.error(`Failed to load: ${ASSETS[key]}`);
}

// Game state
let bird = {
  x: CANVAS_W / 6,
  y: CANVAS_H / 1,
  width: 82.5,
  height: 82.5,
  velY: 0
};

const GRAVITY = 0.35;
const JUMP_V = -7.0;
const VELOCITY_X = -2.0;

let pipes = [];
let pipeWidth = 42;
let pipeHeight = 380;
let placePipeInterval = null;

let score = 0;
let gameOver = false;

let showFart = false;
let fartStart = 0;
const FART_DURATION = 120;

// Unlock audio on first touch
let audioEnabled = false;
function enableAudioOnGesture() {
  if (audioEnabled) return;

  function unlock(a) {
    a.play().then(() => {
      a.pause();
      a.currentTime = 0;
    }).catch(() => { });
  }

  unlock(ASSETS.fartSound);
  unlock(ASSETS.hitSound);

  audioEnabled = true;
}

window.addEventListener('touchstart', enableAudioOnGesture, { once: true });
window.addEventListener('mousedown', enableAudioOnGesture, { once: true });

function onAllAssetsLoaded() {
  log("All images loaded, starting game.");
  startGame();
}

function placePipes() {
  const randomPipeY = Math.floor(-pipeHeight / 4 - Math.random() * (pipeHeight / 2));
  const openingSpace = Math.floor(CANVAS_H / 3.3);

  const top = {
    img: images.topPipe,
    x: CANVAS_W,
    y: randomPipeY,
    width: pipeWidth,
    height: pipeHeight,
    passed: false
  };

  const bottom = {
    img: images.bottomPipe,
    x: CANVAS_W,
    y: top.y + pipeHeight + openingSpace,
    width: pipeWidth,
    height: pipeHeight,
    passed: false
  };

  pipes.push(top, bottom);
}

function resetGame() {
  bird.y = CANVAS_H / 2;
  bird.velY = 0;
  pipes = [];
  score = 0;
  gameOver = false;

  clearInterval(placePipeInterval);
  placePipeInterval = setInterval(() => {
    if (!gameOver) placePipes();
  }, 1500);

  log("Game reset");
}

function playFart() {
  if (!audioEnabled) enableAudioOnGesture();

  try {
    ASSETS.fartSound.currentTime = 0;
    ASSETS.fartSound.play();
  } catch (e) { }
}

function playHitSound() {
  if (!audioEnabled) enableAudioOnGesture();

  // STOP fart sound immediately
  try {
    ASSETS.fartSound.pause();
    ASSETS.fartSound.currentTime = 0;
  } catch (e) {}
  
  // PLAY the long hit sound
  try {
    ASSETS.hitSound.currentTime = 0;
    ASSETS.hitSound.play();
  } catch (e) {}
}
  

function jumpHandler(evt) {
  if (evt && evt.type === 'touchstart') evt.preventDefault();

  // NEW: stop hit sound when tapping after collision
  try {
    ASSETS.hitSound.pause();
    ASSETS.hitSound.currentTime = 0;
  } catch (e) {}

  if (gameOver) {
    resetGame();
    return;
  }

  bird.velY = JUMP_V;

  showFart = true;
  fartStart = Date.now();

  playFart();
}
// Collision detection
function collision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Update loop
function update(delta) {
  if (gameOver) return;

  bird.velY += GRAVITY;
  bird.y += bird.velY;

  if (bird.y < 0) bird.y = 0;
  if (bird.y > CANVAS_H) gameOver = true;

  for (let p of pipes) {
    p.x += VELOCITY_X;

    if (!p.passed && bird.x > p.x + p.width) {
      score += 0.5;
      p.passed = true;
    }

   if (collision(bird, p) && !gameOver) {
    gameOver = true;

    // Lock all sounds so fart cannot play again
    soundLockedAfterHit = true;

    // stop fart immediately
    try {
        ASSETS.fartSound.pause();
        ASSETS.fartSound.currentTime = 0;
    } catch(e){}

    // play long collision sound
    playHitSound();
}

  }

  pipes = pipes.filter(p => p.x + p.width > -50);
}

// Draw everything
function draw() {
  if (images.bg) ctx.drawImage(images.bg, 0, 0, CANVAS_W, CANVAS_H);

  if (images.bird) ctx.drawImage(images.bird, bird.x, bird.y, bird.width, bird.height);

  for (let p of pipes) {
    ctx.drawImage(p.img, p.x, p.y, p.width, p.height);
  }

  if (showFart && Date.now() - fartStart < FART_DURATION) {
    if (images.fart) ctx.drawImage(images.fart, CANVAS_W - 80, CANVAS_H - 80, 60, 60);
  } else {
    showFart = false;
  }

  ctx.fillStyle = 'white';
  ctx.font = '32px Arial';

  if (gameOver) ctx.fillText('Game Over: ' + Math.floor(score), 10, 40);
  else ctx.fillText(Math.floor(score), 10, 40);
}

// Main loop
let lastTime = performance.now();
function loop(now) {
  const delta = now - lastTime;
  lastTime = now;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}

function startGame() {
  log("Starting main loop.");
  placePipeInterval = setInterval(() => { if (!gameOver) placePipes(); }, 1500);
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => {
  if (e.code === 'Space') jumpHandler(e);
});
window.addEventListener('mousedown', jumpHandler);
window.addEventListener('touchstart', jumpHandler, { passive: false });

log("Required: flappybirdbg.png, toppipe.png, bottompipe.png, bird.png, fart.mp3, hit.mp3");

