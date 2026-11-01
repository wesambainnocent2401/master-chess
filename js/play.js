import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm";
import { requireAuth, showToast } from "./auth.js";
import { ChessBoard, glyph } from "./board.js";

document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");

const game = new Chess();
let lastMove = null;
let gameOver = false;

const statusEl = document.getElementById("status");
const listEl = document.getElementById("move-list");
const topEl = document.getElementById("captured-top");
const bottomEl = document.getElementById("captured-bottom");

const board = new ChessBoard(document.getElementById("board"), {
  onMove: handleMove
});
board.setGame(game);

/* ---------- Moves ---------- */
async function handleMove(from, to, promotion) {
  if (gameOver) return;
  let move;
  try {
    move = game.move({ from: from, to: to, promotion: promotion });
  } catch (err) {
    showToast("Illegal move.", "error");
    return;
  }
  lastMove = move;
  refresh();
}

/* ---------- Screen updates ---------- */
function refresh() {
  checkGameEnd();
  board.setLastMove(lastMove);
  board.setLocked(gameOver);
  board.render();
  renderStatus();
  renderMoves();
  renderCaptured();
}

function checkGameEnd() {
  if (gameOver) return;
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    finish("Checkmate! " + winner + " wins.");
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

let resultText = "";
function finish(text) {
  gameOver = true;
  resultText = text;
}

function renderStatus() {
  if (gameOver) {
    statusEl.textContent = resultText;
    statusEl.classList.add("over");
    return;
  }
  statusEl.classList.remove("over");
  const side = game.turn() === "w" ? "White" : "Black";
  statusEl.textContent = side + " to move" + (game.inCheck() ? " (check!)" : "");
}

function renderMoves() {
  const moves = game.history();
  if (moves.length === 0) {
    listEl.innerHTML = '<div class="empty">No moves yet.</div>';
    return;
  }
  listEl.innerHTML = "";
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
    listEl.appendChild(row);
  }
  listEl.scrollTop = listEl.scrollHeight;
}

const ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };

function capturedBy(color) {
  const pieces = game
    .history({ verbose: true })
    .filter((m) => m.color === color && m.captured)
    .map((m) => m.captured)
    .sort((a, b) => ORDER[a] - ORDER[b]);
  return pieces;
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
  const byWhite = capturedBy("w"); // black pieces taken by White
  const byBlack = capturedBy("b"); // white pieces taken by Black
  if (board.flipped) {
    fillCaptured(topEl, byWhite, "b");
    fillCaptured(bottomEl, byBlack, "w");
  } else {
    fillCaptured(topEl, byBlack, "w");
    fillCaptured(bottomEl, byWhite, "b");
  }
}

/* ---------- Buttons ---------- */
document.getElementById("btn-new").addEventListener("click", () => {
  if (game.history().length > 0 && !gameOver && !confirm("Start a new game?")) return;
  game.reset();
  lastMove = null;
  gameOver = false;
  resultText = "";
  board.clearSelection();
  refresh();
});

document.getElementById("btn-undo").addEventListener("click", () => {
  if (game.history().length === 0) return;
  game.undo();
  const history = game.history({ verbose: true });
  lastMove = history.length ? history[history.length - 1] : null;
  gameOver = false;
  resultText = "";
  board.clearSelection();
  refresh();
});

document.getElementById("btn-flip").addEventListener("click", () => {
  board.flip();
  renderCaptured();
});

document.getElementById("btn-full").addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen();
  } else {
    showToast("Full screen is not supported on this browser.", "error");
  }
});

document.getElementById("btn-resign").addEventListener("click", () => {
  if (gameOver || game.history().length === 0) return;
  const side = game.turn() === "w" ? "White" : "Black";
  const other = game.turn() === "w" ? "Black" : "White";
  if (!confirm(side + " resigns?")) return;
  finish(side + " resigned. " + other + " wins.");
  refresh();
});

/* ---------- Start (logged-in players only) ---------- */
requireAuth(() => {
  refresh();
});
