(() => {
  "use strict";

  // ---------- Config ----------
  const LIME = "#d6ff2f";
  const LIME_DARK = "#9fd600";
  const BG_TOP = "#0a0f08";
  const BG_BOTTOM = "#05070a";
  const PEAR_BODY = "#c7e81c";
  const PEAR_BODY_DARK = "#9fbf10";
  const STEM_BROWN = "#5a3c1a";
  const LEAF_GREEN = "#4fae2e";

  const GRAVITY = 1500; // px/s^2
  const FLAP_VELOCITY = -430; // px/s
  const MAX_FALL_SPEED = 900;
  const PIPE_SPEED = 190; // px/s
  const PIPE_GAP_RATIO = 0.28; // fraction of canvas height
  const PIPE_WIDTH_RATIO = 0.14;
  const PIPE_INTERVAL = 1.45; // seconds between pipes
  const GROUND_HEIGHT_RATIO = 0.09;
  const PEAR_RADIUS_RATIO = 0.045;

  const BEST_KEY = "flappypera_best_score";

  // ---------- Canvas setup ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const BASE_W = 480;
  const BASE_H = 720;
  let scale = 1;

  function resize() {
    const targetRatio = BASE_W / BASE_H;
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (w / h > targetRatio) {
      w = h * targetRatio;
    } else {
      h = w / targetRatio;
    }
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const dpr = window.devicePixelRatio || 1;
    canvas.width = BASE_W * dpr;
    canvas.height = BASE_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = 1;
  }
  window.addEventListener("resize", resize);
  resize();

  const W = BASE_W;
  const H = BASE_H;
  const GROUND_Y = H * (1 - GROUND_HEIGHT_RATIO);
  const PEAR_R = H * PEAR_RADIUS_RATIO;
  const PIPE_W = W * PIPE_WIDTH_RATIO;
  const PIPE_GAP = H * PIPE_GAP_RATIO;

  // ---------- Audio (simple WebAudio beeps, no external files) ----------
  let audioCtx = null;
  function beep(freq, dur, type = "square", vol = 0.05) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {
      /* audio not available */
    }
  }
  const sfx = {
    flap: () => beep(520, 0.08, "square", 0.04),
    score: () => beep(880, 0.12, "triangle", 0.05),
    hit: () => beep(120, 0.35, "sawtooth", 0.07),
  };

  // ---------- State ----------
  const STATE = { READY: "ready", PLAYING: "playing", DEAD: "dead" };
  let state = STATE.READY;

  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let score = 0;

  const pear = {
    x: W * 0.28,
    y: H * 0.45,
    vy: 0,
    rotation: 0,
  };

  // "La Pera" — Pablo, the birthday boy, as a pear-plane (from the party flyer).
  const pearImg = new Image();
  let pearImgLoaded = false;
  pearImg.onload = () => {
    pearImgLoaded = true;
  };
  pearImg.src = "assets/pera-pablo.png";

  let pipes = []; // {x, gapY, passed}
  let timeSincePipe = 0;
  let groundOffset = 0;
  let elapsed = 0;

  // Disco ball / background particles (decorative)
  const stars = Array.from({ length: 40 }, () => ({
    x: Math.random() * W,
    y: Math.random() * GROUND_Y,
    r: Math.random() * 1.6 + 0.4,
    twinkle: Math.random() * Math.PI * 2,
  }));

  function resetGame() {
    pear.y = H * 0.45;
    pear.vy = 0;
    pear.rotation = 0;
    pipes = [];
    timeSincePipe = 0;
    score = 0;
    elapsed = 0;
  }

  function spawnPipe() {
    const margin = 60;
    const minGapY = margin + PIPE_GAP / 2;
    const maxGapY = GROUND_Y - margin - PIPE_GAP / 2;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);
    pipes.push({ x: W + PIPE_W, gapY, passed: false });
  }

  function flap() {
    if (state === STATE.READY || state === STATE.DEAD) {
      state = STATE.PLAYING;
      resetGame();
      pear.vy = FLAP_VELOCITY;
      sfx.flap();
    } else if (state === STATE.PLAYING) {
      pear.vy = FLAP_VELOCITY;
      sfx.flap();
    }
  }

  // ---------- Input ----------
  function onInput(e) {
    if (e) e.preventDefault();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    flap();
  }
  canvas.addEventListener("pointerdown", onInput);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") onInput(e);
  });

  // ---------- Drawing ----------
  function drawBackground(dt) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // twinkling stars / disco specks
    for (const s of stars) {
      s.twinkle += dt * 2;
      const alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(s.twinkle));
      ctx.fillStyle = `rgba(214,255,47,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // disco ball top-right
    drawDiscoBall(W - 60, 50, 26, elapsed);
  }

  function drawDiscoBall(cx, cy, r, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.6);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#cfcfcf");
    grad.addColorStop(1, "#8a8a8a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r, i * (r / 4));
      ctx.lineTo(r, i * (r / 4));
      ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(r * Math.cos((i * Math.PI) / 8)) || 0.1, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // hanging line
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - r);
    ctx.stroke();
  }

  function drawGround(dt) {
    groundOffset -= PIPE_SPEED * dt;
    if (groundOffset < -40) groundOffset += 40;

    ctx.fillStyle = "#0d1207";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    ctx.strokeStyle = LIME;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    ctx.fillStyle = LIME_DARK;
    for (let x = groundOffset; x < W; x += 40) {
      ctx.fillRect(x, GROUND_Y + 6, 20, 6);
    }
  }

  function drawPipe(pipe) {
    const topH = pipe.gapY - PIPE_GAP / 2;
    const bottomY = pipe.gapY + PIPE_GAP / 2;
    const bottomH = GROUND_Y - bottomY;
    const capH = 22;

    ctx.fillStyle = "#0f1a0a";
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 3;

    // top pipe
    ctx.fillRect(pipe.x, 0, PIPE_W, topH);
    ctx.strokeRect(pipe.x, 0, PIPE_W, topH);
    ctx.fillRect(pipe.x - 5, topH - capH, PIPE_W + 10, capH);
    ctx.strokeRect(pipe.x - 5, topH - capH, PIPE_W + 10, capH);

    // bottom pipe
    ctx.fillRect(pipe.x, bottomY, PIPE_W, bottomH);
    ctx.strokeRect(pipe.x, bottomY, PIPE_W, bottomH);
    ctx.fillRect(pipe.x - 5, bottomY, PIPE_W + 10, capH);
    ctx.strokeRect(pipe.x - 5, bottomY, PIPE_W + 10, capH);
  }

  function drawPear() {
    ctx.save();
    ctx.translate(pear.x, pear.y);
    ctx.rotate(pear.rotation);
    if (pearImgLoaded) {
      const targetH = PEAR_R * 3.1;
      const targetW = targetH * (pearImg.naturalWidth / pearImg.naturalHeight);
      ctx.drawImage(pearImg, -targetW / 2, -targetH / 2, targetW, targetH);
    } else {
      drawPearPlaceholder();
    }
    ctx.restore();
  }

  // Fallback placeholder, used only if the real sprite fails to load.
  // Assumes the caller has already translated/rotated into pear space.
  function drawPearPlaceholder() {
    const r = PEAR_R;

    // leaf
    ctx.fillStyle = LEAF_GREEN;
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -r * 1.55, r * 0.5, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // stem
    ctx.strokeStyle = STEM_BROWN;
    ctx.lineWidth = r * 0.18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.lineTo(r * 0.15, -r * 1.6);
    ctx.stroke();

    // pear body (two stacked circles for classic pear silhouette)
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 1.4);
    grad.addColorStop(0, PEAR_BODY);
    grad.addColorStop(1, PEAR_BODY_DARK);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.35, r * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // outline
    ctx.strokeStyle = "#3f4f08";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -r * 0.35, r * 0.7, Math.PI, Math.PI * 2);
    ctx.moveTo(-r * 1.05, r * 0.35);
    ctx.arc(0, r * 0.35, r * 1.05, Math.PI * 0.15, Math.PI * 0.85, false);
    ctx.stroke();

    // face (cartoon placeholder)
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-r * 0.28, r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.28, r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, r * 0.35, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // ---------- Text helpers ----------
  function drawTitleText() {
    ctx.textAlign = "center";
    ctx.save();
    ctx.font = "700 42px 'Bangers', 'Anton', sans-serif";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000";
    const title1 = "FLAPPY";
    const title2 = "PERA";
    ctx.strokeText(title1, W / 2 + 2, H * 0.22 + 2);
    ctx.fillStyle = LIME;
    ctx.fillText(title1, W / 2, H * 0.22);

    ctx.font = "700 64px 'Bangers', 'Anton', sans-serif";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 7;
    ctx.strokeText(title2, W / 2, H * 0.22 + 58);
    ctx.fillStyle = "#fff";
    ctx.fillText(title2, W / 2, H * 0.22 + 58);
    ctx.restore();
  }

  function drawReadyOverlay() {
    drawTitleText();
    ctx.save();
    ctx.font = "600 18px 'Anton', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    const pulse = 0.6 + 0.4 * Math.sin(elapsed * 4);
    ctx.globalAlpha = pulse;
    ctx.fillText("TOCA O PULSA ESPACIO PARA VOLAR", W / 2, H * 0.62);
    ctx.restore();

    if (best > 0) {
      ctx.save();
      ctx.font = "500 14px sans-serif";
      ctx.fillStyle = LIME;
      ctx.textAlign = "center";
      ctx.fillText(`Mejor puntuación: ${best}`, W / 2, H * 0.68);
      ctx.restore();
    }
  }

  function drawScore() {
    ctx.save();
    ctx.font = "700 40px 'Anton', sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000";
    ctx.strokeText(String(score), W / 2, 70);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(score), W / 2, 70);
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 40px 'Bangers', 'Anton', sans-serif";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6;
    ctx.strokeText("¡PLOF!", W / 2, H * 0.38);
    ctx.fillStyle = LIME;
    ctx.fillText("¡PLOF!", W / 2, H * 0.38);

    ctx.font = "600 20px 'Anton', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Puntuación: ${score}`, W / 2, H * 0.46);
    ctx.fillStyle = LIME;
    ctx.fillText(`Mejor: ${best}`, W / 2, H * 0.51);

    ctx.font = "500 16px sans-serif";
    ctx.fillStyle = "#cfcfcf";
    const pulse = 0.6 + 0.4 * Math.sin(elapsed * 4);
    ctx.globalAlpha = pulse;
    ctx.fillText("Toca para volver a intentarlo", W / 2, H * 0.58);
    ctx.restore();
  }

  // ---------- Update ----------
  function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < r * r;
  }

  function updatePlaying(dt) {
    elapsed += dt;

    pear.vy += GRAVITY * dt;
    if (pear.vy > MAX_FALL_SPEED) pear.vy = MAX_FALL_SPEED;
    pear.y += pear.vy * dt;

    const targetRot = Math.max(-0.5, Math.min(1.1, pear.vy / 500));
    pear.rotation += (targetRot - pear.rotation) * Math.min(1, dt * 10);

    timeSincePipe += dt;
    if (timeSincePipe >= PIPE_INTERVAL) {
      timeSincePipe = 0;
      spawnPipe();
    }

    for (const pipe of pipes) {
      pipe.x -= PIPE_SPEED * dt;
      if (!pipe.passed && pipe.x + PIPE_W < pear.x - PEAR_R) {
        pipe.passed = true;
        score++;
        sfx.score();
      }
    }
    pipes = pipes.filter((p) => p.x > -PIPE_W - 10);

    // collisions
    let dead = false;
    if (pear.y + PEAR_R >= GROUND_Y || pear.y - PEAR_R <= 0) {
      dead = true;
    }
    for (const pipe of pipes) {
      const topH = pipe.gapY - PIPE_GAP / 2;
      const bottomY = pipe.gapY + PIPE_GAP / 2;
      if (
        circleRectCollide(pear.x, pear.y, PEAR_R * 0.85, pipe.x, 0, PIPE_W, topH) ||
        circleRectCollide(pear.x, pear.y, PEAR_R * 0.85, pipe.x, bottomY, PIPE_W, GROUND_Y - bottomY)
      ) {
        dead = true;
      }
    }

    if (dead) {
      state = STATE.DEAD;
      sfx.hit();
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
    }
  }

  // ---------- Main loop ----------
  let lastTime = null;
  function loop(ts) {
    if (lastTime === null) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    dt = Math.min(dt, 0.035);
    lastTime = ts;

    if (state === STATE.READY) {
      elapsed += dt;
      pear.y = H * 0.45 + Math.sin(elapsed * 3) * 10;
      pear.rotation = Math.sin(elapsed * 3) * 0.08;
    } else if (state === STATE.PLAYING) {
      updatePlaying(dt);
    }

    drawBackground(dt);
    for (const pipe of pipes) drawPipe(pipe);
    drawGround(dt);
    drawPear();

    if (state === STATE.READY) {
      drawReadyOverlay();
    } else if (state === STATE.PLAYING) {
      drawScore();
    } else if (state === STATE.DEAD) {
      drawScore();
      drawGameOver();
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
