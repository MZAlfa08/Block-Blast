/* =====================================================
   BLOCK BLAST - LOGIC
   Daftar isi:
   1. Pengaturan (ukuran, warna, bentuk blok)
   2. State game
   3. Papan (buat & gambar)
   4. Blok pilihan
   5. Aturan menaruh blok & preview
   6. Menaruh blok, hapus baris, skor
   7. Game over, mulai, ulang
   8. Event (tombol & input)
===================================================== */


/* =====================================================
   1. PENGATURAN
===================================================== */

const SIZE = 8;

const COLORS = [
  "#ff365c", "#248cff", "#19d879", "#ffc928",
  "#a75cff", "#16cde5", "#ff7a24", "#ec3cff"
];

const SHAPES = [
  [[1]],
  [[1, 1]],
  [[1], [1]],
  [[1, 1, 1]],
  [[1], [1], [1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 0], [1, 1]],
  [[0, 1], [1, 1]],
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 1, 1], [1, 1, 0]]
];

const BEST_KEY = "bb_best";

/* ----- PENGATURAN WAKTU (silakan ubah) ----- */

/* Detik untuk menaruh blok di awal permainan */
const START_SECONDS = 12;

/* Waktu paling sedikit (makin tinggi skor, makin cepat) */
const MIN_SECONDS = 5;

/* Waktu berkurang 1 detik setiap skor naik sekian poin */
const SCORE_PER_SPEEDUP = 150;

/* Jika waktu habis, berapa kotak "batu" abu-abu muncul di papan.
   Ini yang membuat papan lama-lama penuh sampai game over.
   Isi 0 untuk mematikan. */
const TIMEOUT_PENALTY_CELLS = 3;

const PENALTY_COLOR = "#5f6d64";


/* =====================================================
   2. STATE GAME
===================================================== */

let board = [];
let pieces = [];
let selectedPiece = -1;
let score = 0;
let best = 0;
let gameBusy = false;
let playing = false;
let cellEls = [];
let previewCell = null;   // posisi tap terakhir yang sedang di-highlight
let timerId = null;
let timeLeft = 0;
let turnTotal = 0;
let lastTickSecond = -1;
const TICK_MS = 100;

const $ = id => document.getElementById(id);


/* =====================================================
   3. PAPAN
===================================================== */

function createBoardData() {
  board = [];
  for (let r = 0; r < SIZE; r++) {
    board.push(new Array(SIZE).fill(null));
  }
}

/* Membuat 64 kotak (hanya sekali) */
function buildBoard() {
  const el = $("board");
  el.innerHTML = "";
  cellEls = [];

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;

      /* Mouse: tampilkan preview saat hover */
      cell.addEventListener("pointerenter", e => {
        if (e.pointerType === "mouse" && selectedPiece !== -1 && !gameBusy && playing) {
          showPreview(row, col);
        }
      });

      /* Sentuh / klik: taruh blok */
      cell.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (!playing || gameBusy) return;

        if (selectedPiece === -1) {
          showMessage("Pilih blok terlebih dahulu.");
          return;
        }

        handleBoardTap(row, col);
      });

      el.appendChild(cell);
      cellEls.push(cell);
    }
  }

  /* Hanya mouse yang menghapus highlight saat keluar papan.
     Pada layar sentuh, highlight tetap ada setelah jari diangkat. */
  el.addEventListener("pointerleave", e => {
    if (e.pointerType === "mouse" && !gameBusy) {
      previewCell = null;
      paintBoard();
    }
  });
}

/* Menggambar ulang warna semua kotak sesuai data board */
function paintBoard() {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = cellEls[row * SIZE + col];
      const color = board[row][col];

      if (color) {
        cell.className = "cell filled";
        cell.style.background = makeGradient(color);
      } else {
        cell.className = "cell";
        cell.style.background = "";
      }
    }
  }
}

function makeGradient(color) {
  return `linear-gradient(145deg, ${shade(color, 35)}, ${color} 52%, ${shade(color, -25)})`;
}

/* amount positif = lebih terang, negatif = lebih gelap */
function shade(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = v => Math.max(0, Math.min(255, v));

  const r = clamp(((num >> 16) & 255) + amount);
  const g = clamp(((num >> 8) & 255) + amount);
  const b = clamp((num & 255) + amount);

  return `rgb(${r},${g},${b})`;
}


/* =====================================================
   4. BLOK PILIHAN
===================================================== */

function randomPiece() {
  return {
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)]
  };
}

function generatePieces() {
  pieces = [];

  for (let i = 0; i < 3; i++) {
    pieces.push(randomPiece());
  }
}

function renderPieces() {
  const container = $("pieces");
  container.innerHTML = "";

  pieces.forEach((piece, index) => {
    const box = document.createElement("div");
    box.className = "piece";

    if (!piece) {
      box.classList.add("used");
      container.appendChild(box);
      return;
    }

    if (selectedPiece === index) {
      box.classList.add("selected");
    }

    box.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (gameBusy || !playing) return;

      selectedPiece = index;
      previewCell = null;
      GameAudio.select();
      showMessage("Tap kotak tujuan untuk melihat posisi, tap lagi untuk menaruh.");
      paintBoard();
      renderPieces();
    });

    const grid = document.createElement("div");
    grid.className = "mini-grid";
    grid.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, auto)`;

    piece.shape.forEach(row => {
      row.forEach(value => {
        const mini = document.createElement("div");
        mini.className = "mini-cell";

        if (value) {
          mini.style.background = makeGradient(piece.color);
        } else {
          mini.style.visibility = "hidden";
        }

        grid.appendChild(mini);
      });
    });

    box.appendChild(grid);
    container.appendChild(box);
  });
}


/* =====================================================
   5. ATURAN MENARUH & PREVIEW
===================================================== */

/*
 * Titik yang di-tap menjadi PUSAT blok (bukan pojok kiri atas),
 * supaya jari tidak menutupi blok saat dimainkan di HP.
 */
function anchor(piece, row, col) {
  return {
    row: row - Math.floor((piece.shape.length - 1) / 2),
    col: col - Math.floor((piece.shape[0].length - 1) / 2)
  };
}

function canPlace(piece, startRow, startCol) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;

      const rr = startRow + r;
      const cc = startCol + c;

      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return false;
      if (board[rr][cc]) return false;
    }
  }
  return true;
}

function showPreview(row, col) {
  previewCell = { row, col };
  paintBoard();

  const piece = pieces[selectedPiece];
  if (!piece) return;

  const a = anchor(piece, row, col);
  const valid = canPlace(piece, a.row, a.col);

  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;

      const rr = a.row + r;
      const cc = a.col + c;

      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;

      const cell = cellEls[rr * SIZE + cc];

      if (valid) {
        cell.classList.add("preview-valid");
        cell.style.background = makeGradient(piece.color);
      } else {
        cell.classList.add("preview-invalid");
      }
    }
  }
}

/*
 * Tap pertama  -> tampilkan highlight (hijau/putih = pas, merah = tidak muat)
 * Tap kedua di kotak yang sama -> taruh blok
 * Tap di kotak lain -> highlight pindah
 */
function handleBoardTap(row, col) {
  const same = previewCell && previewCell.row === row && previewCell.col === col;

  if (same) {
    placePiece(row, col);
    return;
  }

  showPreview(row, col);

  const piece = pieces[selectedPiece];
  if (!piece) return;

  const a = anchor(piece, row, col);

  if (canPlace(piece, a.row, a.col)) {
    showMessage("✅ Pas! Tap lagi di kotak yang sama untuk menaruh.");
  } else {
    showMessage("❌ Belum muat. Tap kotak lain untuk menggeser.");
  }
}

function hasAnyMove() {
  for (const piece of pieces) {
    if (!piece) continue;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (canPlace(piece, row, col)) return true;
      }
    }
  }
  return false;
}


/* =====================================================
   6. MENARUH BLOK, HAPUS BARIS, SKOR
===================================================== */

function placePiece(tapRow, tapCol) {
  if (gameBusy || selectedPiece === -1) return;

  const piece = pieces[selectedPiece];
  if (!piece) return;

  const a = anchor(piece, tapRow, tapCol);

  if (!canPlace(piece, a.row, a.col)) {
    GameAudio.invalid();
    showMessage("❌ Blok tidak muat di posisi itu.");
    return;
  }

  gameBusy = true;
  previewCell = null;

  /* Taruh blok ke data papan */
  const placed = [];
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        board[a.row + r][a.col + c] = piece.color;
        placed.push(cellEls[(a.row + r) * SIZE + (a.col + c)]);
      }
    }
  }

  score += placed.length;
  pieces[selectedPiece] = null;
  selectedPiece = -1;

  paintBoard();
  placed.forEach(cell => cell.classList.add("place-pop"));
  updateScore();
  GameAudio.place();

  /* Cek baris & kolom penuh */
  setTimeout(() => {
    const full = findFullLines();

    if (full.count > 0) {
      full.indexes.forEach(i => cellEls[i].classList.add("clear-animation"));
      GameAudio.clear(full.count);
      showCombo(full.count);

      score += full.count * 10 + full.indexes.size * 2;
      updateScore();

      setTimeout(() => {
        full.rows.forEach(r => { for (let c = 0; c < SIZE; c++) board[r][c] = null; });
        full.cols.forEach(c => { for (let r = 0; r < SIZE; r++) board[r][c] = null; });
        finishTurn();
      }, 400);

    } else {
      finishTurn();
      showMessage("Bagus! Pilih blok berikutnya.");
    }
  }, 180);
}

function findFullLines() {
  const rows = [];
  const cols = [];
  const indexes = new Set();

  for (let r = 0; r < SIZE; r++) {
    if (board[r].every(v => v !== null)) rows.push(r);
  }

  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) {
      if (!board[r][c]) { full = false; break; }
    }
    if (full) cols.push(c);
  }

  rows.forEach(r => { for (let c = 0; c < SIZE; c++) indexes.add(r * SIZE + c); });
  cols.forEach(c => { for (let r = 0; r < SIZE; r++) indexes.add(r * SIZE + c); });

  return { rows, cols, indexes, count: rows.length + cols.length };
}

/* Dipanggil setelah blok ditaruh & baris dibersihkan */
function finishTurn() {
  if (pieces.every(p => p === null)) {
    generatePieces();
  }

  paintBoard();
  renderPieces();
  updateScore();

  if (!hasAnyMove()) {
    stopTimer();
    setTimeout(endGame, 450);
    return;
  }

  gameBusy = false;
  resetTurnTimer();
}

function showCombo(lines) {
  let text = "💥 LINE CLEAR!";
  if (lines === 2) text = "🔥 DOUBLE COMBO!";
  if (lines === 3) text = "⚡ TRIPLE COMBO!";
  if (lines >= 4) text = "👑 MEGA COMBO!";

  const popup = document.createElement("div");
  popup.className = "combo-popup";
  popup.textContent = text;
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 800);

  showMessage("💥 " + lines + " garis dihancurkan!");
}

function updateScore() {
  $("score").textContent = score;

  if (score > best) {
    best = score;
    $("best").textContent = best;
  }
}

function showMessage(text) {
  const el = $("message");
  el.style.opacity = "0";

  setTimeout(() => {
    el.textContent = text;
    el.style.opacity = "1";
  }, 60);
}


/* =====================================================
   6B. TIMER
   Waktu habis -> semua blok yang tersisa berubah bentuk
   (+ kotak penalti muncul). Berulang sampai blok baru
   tidak muat lagi -> game over.
===================================================== */

function turnSeconds() {
  const faster = Math.floor(score / SCORE_PER_SPEEDUP);
  return Math.max(MIN_SECONDS, START_SECONDS - faster);
}

function resetTurnTimer() {
  turnTotal = turnSeconds() * 1000;
  timeLeft = turnTotal;
  lastTickSecond = -1;
  renderTimer();
}

function startTimer() {
  stopTimer();
  resetTurnTimer();
  timerId = setInterval(tickTimer, TICK_MS);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function tickTimer() {
  /* Waktu berhenti saat animasi berjalan */
  if (!playing || gameBusy) return;

  timeLeft -= TICK_MS;

  const sec = Math.ceil(timeLeft / 1000);
  if (sec <= 3 && sec > 0 && sec !== lastTickSecond) {
    lastTickSecond = sec;
    GameAudio.tick();
  }

  if (timeLeft <= 0) {
    timeLeft = 0;
    renderTimer();
    onTimeout();
    return;
  }

  renderTimer();
}

function renderTimer() {
  const pct = turnTotal > 0 ? (timeLeft / turnTotal) * 100 : 0;
  $("timerFill").style.width = pct + "%";
  $("timerText").textContent = "⏱ " + Math.ceil(timeLeft / 1000);
  $("timer").classList.toggle("warning", timeLeft <= 3000);
}

function onTimeout() {
  gameBusy = true;
  selectedPiece = -1;
  previewCell = null;

  GameAudio.timeout();

  /* Blok yang tersisa berubah bentuk */
  pieces = pieces.map(p => p ? randomPiece() : null);

  /* Penalti: kotak abu-abu muncul di papan */
  addPenaltyCells(TIMEOUT_PENALTY_CELLS);

  paintBoard();
  renderPieces();
  updateScore();

  const boardEl = $("board");
  boardEl.classList.remove("shake");
  void boardEl.offsetWidth;
  boardEl.classList.add("shake");

  showMessage("⏰ Waktu habis! Bentuk blok berubah.");

  if (!hasAnyMove()) {
    stopTimer();
    setTimeout(endGame, 600);
    return;
  }

  setTimeout(() => {
    gameBusy = false;
    resetTurnTimer();
  }, 450);
}

function addPenaltyCells(count) {
  const empty = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) empty.push([r, c]);
    }
  }

  for (let i = 0; i < count && empty.length > 0; i++) {
    const k = Math.floor(Math.random() * empty.length);
    const [r, c] = empty.splice(k, 1)[0];
    board[r][c] = PENALTY_COLOR;
  }
}


/* =====================================================
   7. GAME OVER, MULAI, ULANG
===================================================== */

function startGame() {
  gameBusy = false;
  playing = true;
  score = 0;
  selectedPiece = -1;
  previewCell = null;

  createBoardData();
  generatePieces();
  paintBoard();
  renderPieces();
  updateScore();
  showMessage("Pilih salah satu blok.");

  $("startOverlay").classList.add("hidden");
  $("gameOverOverlay").classList.add("hidden");

  GameAudio.start();
  GameAudio.startMusic();
  startTimer();
}

function endGame() {
  gameBusy = false;
  playing = false;
  stopTimer();

  const isNewRecord = score > 0 && score >= best && score > loadBest();
  saveBest(best);

  $("finalScore").textContent = score;

  const bestEl = $("finalBest");
  bestEl.textContent = isNewRecord ? "🏆 Rekor baru!" : "Rekor: " + best;
  bestEl.classList.toggle("new-record", isNewRecord);

  GameAudio.stopMusic();
  GameAudio.gameOver();

  $("gameOverOverlay").classList.remove("hidden");
}

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (e) { /* abaikan */ }
}


/* Kembali ke halaman home (layar MULAI MAIN) dengan papan bersih */
function goHome() {
  playing = false;
  gameBusy = false;
  selectedPiece = -1;
  previewCell = null;
  score = 0;

  stopTimer();
  GameAudio.stopMusic();

  createBoardData();
  generatePieces();
  paintBoard();
  renderPieces();
  updateScore();

  turnTotal = START_SECONDS * 1000;
  timeLeft = turnTotal;
  renderTimer();

  showMessage("Pilih salah satu blok.");

  $("exitOverlay").classList.add("hidden");
  $("gameOverOverlay").classList.add("hidden");
  $("startOverlay").classList.remove("hidden");
}


/* =====================================================
   8. EVENT (TOMBOL & INPUT)
===================================================== */

function updateSoundButton() {
  $("btnSound").textContent = GameAudio.isMuted() ? "🔇 MATI" : "🔊 SUARA";
}

function init() {
  best = loadBest();
  $("best").textContent = best;

  createBoardData();
  buildBoard();
  paintBoard();
  generatePieces();
  renderPieces();
  updateSoundButton();

  /* Audio hanya boleh aktif setelah pengguna menyentuh layar,
     jadi init dipanggil dari tombol MULAI. */
  $("btnStart").addEventListener("click", () => {
    GameAudio.init();
    startGame();
  });

  $("btnPlayAgain").addEventListener("click", () => {
    GameAudio.init();
    startGame();
  });

  $("btnRestart").addEventListener("click", () => {
    if (!playing) return;
    GameAudio.init();
    startGame();
  });

  /* Tombol HOME: minta konfirmasi dulu, game dijeda selama konfirmasi */
  $("btnHome").addEventListener("click", () => {
    if (!playing) return;
    playing = false;               // menjeda timer & input
    $("exitOverlay").classList.remove("hidden");
  });

  $("btnExitCancel").addEventListener("click", () => {
    $("exitOverlay").classList.add("hidden");
    playing = true;
  });

  $("btnExitConfirm").addEventListener("click", goHome);

  $("btnGameOverHome").addEventListener("click", goHome);

  $("btnSound").addEventListener("click", () => {
    GameAudio.init();
    GameAudio.toggleMute();
    updateSoundButton();
  });

  /* Klik di luar papan membatalkan preview (mouse) */
  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse" || selectedPiece === -1 || gameBusy || !playing) return;

    const rect = $("board").getBoundingClientRect();
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;

    if (!inside) {
      previewCell = null;
      paintBoard();
    }
  });
}

init();
