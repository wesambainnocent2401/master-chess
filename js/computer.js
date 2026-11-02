import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm";
import { requireAuth, showToast } from "./auth.js";
import { ChessBoard, glyph } from "./board.js";
import { Engine, LEVELS } from "./engine.js";
import { initBoardThemes } from "./themes.js";

document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
initBoardThemes(document.getElementById("board-theme"));

const $ = (id) => document.getElementById(id);

let game = new Chess();
let engine = null;
let level = LEVELS[0];
let human = "w";
let thinking = false;
let gameOver = false;
let resultText = "";
let lastMove = null;
let session = 0;

const board = new ChessBoard($("board"), {
  onMove: handleMove,
  canMove: (color) => color === human && !thinking && !gameOver
});

/* ---------- Setup screen ---------- */
LEVELS.forEach((l) => {
  const option = document.createElement("option");
  option.value = l.id;
  option.textContent = l.id + ". " + l.name;
  $("level-select").appendChild(option);
});

$("btn-start").addEventListener("click", () => {
  level = LEVELS.find((l) => String(l.id) === $("level-select").value) || LEVELS[0];
  const choice = $("color-select").value;
  human = choice === "random" ? (Math.random() < 0.5 ? "w" : "b") : choice;
  $("setup").classList.add("hidden");
  $("game-view").classList.remove("hidden");
  begin();
});

/* ---------- Game flow ---------- */
function abortThinking() {
  session++;
  thinking = false;
  if (engine) {
    engine.stop();
    engine = null;
  }
}

function begin() {
  abortThinking();
  game = new Chess();
  lastMove = null;
  gameOver = false;
  resultText = "";
  board.setGame(game);
  board.clearSelection();
  board.flipped = human === "b";
  engine = new Engine();
  engine.ready.then(() => engine && engine.newGame()).catch(() => {});

  $("opponent-bar").textContent = "Computer: " + level.name;
  $("me-bar").textContent = "You (" + (human === "w" ? "White" : "Black") + ")";

  refresh();
  if (game.turn() !== human) computerMove();
}

async function handleMove(from, to, promotion) {
  if (gameOver || thinking || game.turn() !== human) return;
  try {
    lastMove = game.move({ from: from, to: to, promotion: promotion });
  } catch (err) {
    showToast("Illegal move.", "error");
    return;
  }
  refresh();
  if (!gameOver) computerMove();
}

async function computerMove() {
  if (gameOver) return;
  const mySession = session;
  if (!engine) engine = new Engine();
  thinking = true;
  refresh();

  try {
    const m = await engine.bestMove(game.fen(), level);
    if (mySession !== session) return;
    if (m) {
      lastMove = game.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
  } catch (err) {
    if (mySession !== session) return;
    showToast("The computer could not move. Check your connection and try again.", "error");
    if (engine) {
      engine.stop();
      engine = null;
    }
  }
  thinking = false;
  refresh();
}

/* ---------- Results ---------- */
function finish(text) {
  gameOver = true;
  resultText = text;
}

function checkGameEnd() {
  if (gameOver) return;
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    finish(winner === human ? "Checkmate! You win!" : "Checkmate. The computer wins.");
  } else if (game.isStalemate()) {
    finish("Draw by stalemate.");
  } else if (game.isInsufficientMaterial()) {
    finish("Draw: insufficient material.");
  } else if (game.isThreefoldRepetition()) {
    finish("Draw by threefold repetition.");
  } else if (game.isDraw()) {
    finish("Draw by the fifty-move rule.");
  }
}

/* ---------- Screen updates ---------- */
function refresh() {
  checkGameEnd();
  board.setLastMove(lastMove);
  board.setLocked(thinking || gameOver);
  board.render();
  renderStatus();
  renderMoves();
  renderCaptured();
  $("btn-retry").classList.toggle("hidden", gameOver || thinking || game.turn() === human);
}

function renderStatus() {
  const el = $("status");
  el.classList.remove("over");
  if (gameOver) {
    el.textContent = resultText;
    el.classList.add("over");
    return;
  }
  if (thinking) {
    el.textContent = "Computer is thinking...";
    return;
  }
  const mine = game.turn() === human;
  el.textContent = (mine ? "Your turn" : "Computer's turn") + (game.inCheck() ? " (check!)" : "");
}

function renderMoves() {
  const list = $("move-list");
  const moves = game.history();
  if (moves.length === 0) {
    list.innerHTML = '<div class="empty">No moves yet.</div>';
    return;
  }
  list.innerHTML = "";
  for (let i = 0; i < moves.length; i += 2) {
    const row = document.createElement("div");
    row.className = "move-row";

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = i / 2 + 1 + ".";

    const white = document.createElement("span");
    white.textContent = moves[i];

    const black = document.createElement("span");
    black.textContent = moves[i + 1] || "";

    row.append(num, white, black);
    list.appendChild(row);
  }
  list.scrollTop = list.scrollHeight;
}

const ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };

function capturedBy(color) {
  return game
    .history({ verbose: true })
    .filter((m) => m.color === color && m.captured)
    .map((m) => m.captured)
    .sort((a, b) => ORDER[a] - ORDER[b]);
}

function fillCaptured(el, pieces, pieceColor) {
  el.innerHTML = "";
  pieces.forEach((type) => {
    const span = document.createElement("span");
    span.className = pieceColor;
    span.textContent = glyph(type);
    el.appendChild(span);
  });
}

function renderCaptured() {
  const byWhite = capturedBy("w");
  const byBlack = capturedBy("b");
  if (board.flipped) {
    fillCaptured($("captured-top"), byWhite, "b");
    fillCaptured($("captured-bottom"), byBlack, "w");
  } else {
    fillCaptured($("captured-top"), byBlack, "w");
    fillCaptured($("captured-bottom"), byWhite, "b");
  }
}

/* ---------- Buttons ---------- */
$("btn-flip").addEventListener("click", () => {
  board.flip();
  renderCaptured();
});

$("btn-undo").addEventListener("click", () => {
  if (thinking) return;
  const needed = game.turn() === human ? 2 : 1;
  if (game.history().length < needed) return;
  for (let i = 0; i < needed; i++) game.undo();
  const history = game.history({ verbose: true });
  lastMove = history.length ? history[history.length - 1] : null;
  gameOver = false;
  resultText = "";
  board.clearSelection();
  refresh();
});

$("btn-resign").addEventListener("click", () => {
  if (gameOver || game.history().length === 0) return;
  if (!confirm("Do you want to resign?")) return;
  abortThinking();
  finish("You resigned. The computer wins.");
  refresh();
});

$("btn-retry").addEventListener("click", () => {
  computerMove();
});

/* ---------- Start (logged-in players only) ---------- */
let started = false;
requireAuth(() => {
  if (started) return;
  started = true;
  $("setup").classList.remove("hidden");
});
