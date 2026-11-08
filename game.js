(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const COLORS = {
    I: '#58d7e8', O: '#f5d45f', T: '#b58af6', S: '#8de36b',
    Z: '#fa7188', J: '#7195f5', L: '#f3a45d'
  };
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  const boardCanvas = document.querySelector('#board');
  const ctx = boardCanvas.getContext('2d');
  const nextCanvas = document.querySelector('#next');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.querySelector('#score');
  const bestEl = document.querySelector('#best');
  const linesEl = document.querySelector('#lines');
  const levelEl = document.querySelector('#level');
  const statusEl = document.querySelector('#status');
  const overlay = document.querySelector('#overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const startButton = document.querySelector('#start-button');
  const pauseButton = document.querySelector('#pause-button');

  let board;
  let piece;
  let nextType;
  let bag = [];
  let score = 0;
  let lines = 0;
  let level = 1;
  let best = readBest();
  let running = false;
  let paused = false;
  let lastTime = 0;
  let dropCounter = 0;
  let animationId = null;

  function readBest() {
    try { return Number(localStorage.getItem('blocks-best')) || 0; }
    catch (_) { return 0; }
  }

  function refillBag() {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  function takeType() {
    if (!bag.length) refillBag();
    return bag.pop();
  }

  function newPiece(type) {
    const matrix = SHAPES[type].map(row => row.slice());
    return { type, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: -1 };
  }

  function initGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    nextType = takeType();
    spawnPiece();
    running = true;
    paused = false;
    dropCounter = 0;
    lastTime = 0;
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    pauseButton.innerHTML = 'Pausar <kbd>P</kbd>';
    statusEl.textContent = 'EN JUEGO';
    updateStats();
    draw();
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(update);
  }

  function spawnPiece() {
    piece = newPiece(nextType);
    nextType = takeType();
    drawNext();
    if (collides(piece, 0, 0, piece.matrix)) endGame();
  }

  function collides(candidate, dx, dy, matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = candidate.x + x + dx;
        const ny = candidate.y + y + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(matrix) {
    return matrix[0].map((_, x) => matrix.map(row => row[x]).reverse());
  }

  function rotate() {
    if (!running || paused) return;
    const rotated = rotateMatrix(piece.matrix);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(piece, kick, 0, rotated)) {
        piece.x += kick;
        piece.matrix = rotated;
        draw();
        return;
      }
    }
  }

  function move(dx, dy) {
    if (!running || paused) return false;
    if (!collides(piece, dx, dy, piece.matrix)) {
      piece.x += dx;
      piece.y += dy;
      if (dy > 0) dropCounter = 0;
      draw();
      return true;
    }
    if (dy > 0) lockPiece();
    return false;
  }

  function hardDrop() {
    if (!running || paused) return;
    let distance = 0;
    while (!collides(piece, 0, 1, piece.matrix)) {
      piece.y++;
      distance++;
    }
    score += distance * 2;
    lockPiece();
  }

  function lockPiece() {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const by = piece.y + y;
        const bx = piece.x + x;
        if (by < 0) { endGame(); return; }
        board[by][bx] = piece.type;
      }
    }
    clearLines();
    if (running) spawnPiece();
    updateStats();
    draw();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      score += ([0, 100, 300, 500, 800][cleared] || cleared * 300) * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      updateStats();
    }
  }

  function updateStats() {
    scoreEl.textContent = score.toLocaleString('es-ES');
    linesEl.textContent = lines;
    levelEl.textContent = level;
    if (score > best) {
      best = score;
      bestEl.textContent = best.toLocaleString('es-ES');
      try { localStorage.setItem('blocks-best', String(best)); } catch (_) { /* storage may be disabled */ }
    } else {
      bestEl.textContent = best.toLocaleString('es-ES');
    }
  }

  function drawCell(context, x, y, color, size, alpha = 1) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = 'rgba(255,255,255,.2)';
    context.fillRect(x * size + 2, y * size + 2, size - 4, 2);
    context.fillStyle = 'rgba(0,0,0,.16)';
    context.fillRect(x * size + 2, (y + 1) * size - 4, size - 4, 2);
    context.globalAlpha = 1;
  }

  function draw() {
    if (!board) return;
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = '#111522';
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.strokeStyle = 'rgba(138,151,183,.09)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * BLOCK + .5, 0); ctx.lineTo(x * BLOCK + .5, boardCanvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * BLOCK + .5); ctx.lineTo(boardCanvas.width, y * BLOCK + .5); ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (board[y][x]) drawCell(ctx, x, y, COLORS[board[y][x]], BLOCK);
    }
    if (!piece) return;
    let ghostY = piece.y;
    while (!collides(piece, 0, ghostY - piece.y + 1, piece.matrix)) ghostY++;
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        if (ghostY + y >= 0) drawCell(ctx, piece.x + x, ghostY + y, COLORS[piece.type], BLOCK, .2);
      }
    }
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (piece.matrix[y][x] && piece.y + y >= 0) drawCell(ctx, piece.x + x, piece.y + y, COLORS[piece.type], BLOCK);
      }
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const matrix = SHAPES[nextType];
    const size = 20;
    const width = matrix[0].length * size;
    const height = matrix.length * size;
    const offsetX = (nextCanvas.width - width) / 2;
    const offsetY = (nextCanvas.height - height) / 2;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        nextCtx.fillStyle = COLORS[nextType];
        nextCtx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
        nextCtx.fillStyle = 'rgba(255,255,255,.2)';
        nextCtx.fillRect(offsetX + x * size + 2, offsetY + y * size + 2, size - 4, 2);
      }
    }
  }

  function update(time = 0) {
    if (!running) { animationId = null; return; }
    if (!paused) {
      const delta = time - lastTime;
      lastTime = time;
      dropCounter += delta;
      if (dropCounter > Math.max(90, 750 - (level - 1) * 55)) move(0, 1);
    } else {
      lastTime = time;
    }
    animationId = requestAnimationFrame(update);
  }

  function showOverlay(title, copy, buttonText) {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startButton.textContent = buttonText;
    overlay.classList.remove('hidden');
  }

  function endGame() {
    running = false;
    paused = false;
    pauseButton.disabled = true;
    statusEl.textContent = 'FIN DE PARTIDA';
    showOverlay('Fin de partida', `Puntuación: ${score.toLocaleString('es-ES')}. ¡Una más?`, 'Jugar de nuevo');
    updateStats();
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    statusEl.textContent = paused ? 'EN PAUSA' : 'EN JUEGO';
    pauseButton.innerHTML = paused ? 'Continuar <kbd>P</kbd>' : 'Pausar <kbd>P</kbd>';
    if (paused) showOverlay('Pausa', 'La partida está en pausa.', 'Continuar');
    else overlay.classList.add('hidden');
  }

  startButton.addEventListener('click', () => {
    if (running && paused) togglePause();
    else initGame();
  });
  pauseButton.addEventListener('click', togglePause);
  document.querySelector('#restart-button').addEventListener('click', initGame);
  document.querySelectorAll('.control-button').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      const action = button.dataset.action;
      if (action === 'left') move(-1, 0);
      if (action === 'right') move(1, 0);
      if (action === 'down') move(0, 1);
      if (action === 'rotate') rotate();
      if (action === 'drop') hardDrop();
    });
  });
  document.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'];
    if (keys.includes(event.key)) event.preventDefault();
    if (event.key === 'p' || event.key === 'P') { togglePause(); return; }
    if (event.key === 'r' || event.key === 'R') { initGame(); return; }
    if (!running || paused) return;
    if (event.key === 'ArrowLeft') move(-1, 0);
    else if (event.key === 'ArrowRight') move(1, 0);
    else if (event.key === 'ArrowUp') rotate();
    else if (event.key === 'ArrowDown') { if (move(0, 1)) score++; updateStats(); }
    else if (event.key === ' ' || event.key === 'Spacebar') hardDrop();
  });

  bestEl.textContent = best.toLocaleString('es-ES');
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  ctx.fillStyle = '#111522';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  ctx.strokeStyle = 'rgba(138,151,183,.09)';
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * BLOCK + .5, 0); ctx.lineTo(x * BLOCK + .5, boardCanvas.height); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * BLOCK + .5); ctx.lineTo(boardCanvas.width, y * BLOCK + .5); ctx.stroke(); }
})();
