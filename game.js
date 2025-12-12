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
  bird: 'FB_IMG_1761575220463-pica.png', // Make sure this file exists
  topPipe: 'toppipe.png',
  bottomPipe: 'bottompipe.png',
  fartSound: document.getElementById('fartSound'),
  hitSound: document.getElementById('hitSound') // NEW LONG SOUND
};

// Check if HTML elements exist for sounds
if (!ASSETS.fartSound) console.error("Element with id 'fartSound' not found in HTML");
if (!ASSETS.hitSound) console.error("Element with id 'hitSound' not found in HTML");

let images = {};
let imagesToLoad = Object.keys(ASSETS).filter(k => k !== 'fartSound' && k !== 'hitSound').length;
let loadedCount = 0;
let debug = true;
let soundLockedAfterHit = false; // ADD THIS - prevents fart sound after collision

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
  y: CANVAS_H / 2, // CHANGED from /1 to /2 (center vertically)
  width: 82.5,
  height: 82.5,
  velY: 0
};

const GRAVITY = 0.35;
const JUMP_V = -7.0;
const VELOCITY_X = -2.0;

let pipes = [];
let pipeWidth = 50;
let pipeHeight = 400;
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
    if (!a) return;
    a.play().then(() => {
      a.pause();
      a.currentTime = 0;
    }).catch(() => { });
  }

  if (ASSETS.fartSound) unlock(ASSETS.fartSound);
  if (ASSETS.hitSound) unlock(ASSETS.hitSound);

  audioEnabled = true;
  log("Audio enabled");
}

window.addEventListener('touchstart', enableAudioOnGesture, { once: true });
window.addEventListener('mousedown', enableAudioOnGesture, { once: true });

function onAllAssetsLoaded() {
  log("All images loaded, starting game.");
  // Initialize the game
  startGame();
}

function placePipes() {
  if (gameOver) return;
  
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
  log(`Placed pipes at y=${randomPipeY}, total pipes: ${pipes.length}`);
}

function resetGame() {
  bird.y = CANVAS_H / 2;
  bird.velY = 0;
  pipes = [];
  score = 0;
  gameOver = false;
  soundLockedAfterHit = false; // Reset the sound lock
  
  // Stop the hit sound if it's playing
  try {
    ASSETS.hitSound.pause();
    ASSETS.hitSound.currentTime = 0;
  } catch(e) {}

  clearInterval(placePipeInterval);
  placePipeInterval = setInterval(() => {
    if (!gameOver) placePipes();
  }, 1500);

  log("Game reset");
}

function playFart() {
  if (!audioEnabled) enableAudioOnGesture();
  if (soundLockedAfterHit) return; // Don't play fart after collision

  try {
    ASSETS.fartSound.currentTime = 0;
    ASSETS.fartSound.play().catch(e => console.log("Fart sound play failed:", e));
  } catch (e) { 
    console.log("Fart sound error:", e);
  }
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
    ASSETS.hitSound.play().catch(e => console.log("Hit sound play failed:", e));
  } catch (e) {
    console.log("Hit sound error:", e);
  }
}

function jumpHandler(evt) {
  if (evt && evt.type === 'touchstart') evt.preventDefault();

  // Enable audio on first interaction
  enableAudioOnGesture();

  if (gameOver) {
    resetGame();
    return;
  }
  
  // Play fart sound and make bird jump
  playFart();
  bird.velY = JUMP_V;
  log("Jump! Velocity set to:", JUMP_V);
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
  // Check if bird hits bottom of canvas (bird.y is top of bird)
  if (bird.y + bird.height > CANVAS_H) {
    gameOver = true;
    if (!soundLockedAfterHit) {
      soundLockedAfterHit = true;
      playHitSound();
    }
  }

  for (let p of pipes) {
    p.x += VELOCITY_X;

    if (!p.passed && bird.x > p.x + p.width) {
      score += 0.5;
      p.passed = true;
      log("Score:", score);
    }

    if (collision(bird, p) && !gameOver) {
      gameOver = true;
      soundLockedAfterHit = true; // Lock all sounds so fart cannot play again

      // Stop fart immediately
      try {
        ASSETS.fartSound.pause();
        ASSETS.fartSound.currentTime = 0;
      } catch(e){}

      // Play long collision sound
      playHitSound();
      log("Collision detected! Game over.");
    }
  }

  pipes = pipes.filter(p => p.x + p.width > -50);
}

// Draw everything
function draw() {
  // Clear canvas
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  
  if (images.bg) {
    ctx.drawImage(images.bg, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    // Draw background color if image not loaded
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  if (images.bird) {
    ctx.drawImage(images.bird, bird.x, bird.y, bird.width, bird.height);
  } else {
    // Draw placeholder bird
    ctx.fillStyle = 'yellow';
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
  }

  for (let p of pipes) {
    if (p.img) {
      ctx.drawImage(p.img, p.x, p.y, p.width, p.height);
    } else {
      // Draw placeholder pipes
      ctx.fillStyle = p.img === images.topPipe ? 'green' : 'red';
      ctx.fillRect(p.x, p.y, p.width, p.height);
    }
  }

  ctx.fillStyle = 'white';
  ctx.font = '32px Arial';
  ctx.textBaseline = 'top';

  if (gameOver) {
    ctx.fillText('Game Over: ' + Math.floor(score), 10, 40);
    ctx.font = '20px Arial';
    ctx.fillText('Click/Tap to restart', 10, 80);
  } else {
    ctx.fillText(Math.floor(score), 10, 40);
  }
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
  // Start placing pipes
  placePipeInterval = setInterval(() => { 
    if (!gameOver) placePipes(); 
  }, 1500);
  
  // Start game loop
  requestAnimationFrame(loop);
}

// Event listeners
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    jumpHandler(e);
  }
});
window.addEventListener('mousedown', jumpHandler);
window.addEventListener('touchstart', jumpHandler, { passive: false });

log("Required files: flappybirdbg.png, FB_IMG_1761575220463-pica.png, toppipe.png, bottompipe.png");
log("Also needed in HTML: <audio id='fartSound' src='fart-83471.mp3'></audio>");
log("And: <audio id='hitSound' src='hit.mp3'></audio>");

// Check if canvas element exists
if (!canvas) {
  console.error("Canvas element with id 'gameCanvas' not found!");
}