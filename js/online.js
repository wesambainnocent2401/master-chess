import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm";
import { requireAuth, showToast } from "./auth.js";
import { ChessBoard, glyph } from "./board.js";
import { initBoardThemes } from "./themes.js";
import {
  TIME_CONTROLS, createGame, joinGame, watchGame, sendMove,
  resignGame, offerDraw, acceptDraw, flagTimeout, myColor
} from "./games.js";

const $ = (id) => document.getElementById(id);

document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
initBoardThemes($("board-theme"));

const params = new URLSearchParams(window.location.search);
const gameId = params.get("game");

let data = null;          // latest game data from Firestore
let me = null;            // "w", "b", or null (spectator)
let uid = null;
let firstLoad = true;
let started = false;
let turnKey = null;       // changes whenever the clock restarts
let turnStartedLocal = Date.now();
let lastFlagTry = 0;

const board = new ChessBoard($("board"), {
  onMove: handleMove,
  canMove: (color) => !!data && data.status === "active" && color === me
});

/* ---------- Lobby ---------- */
function startLobby() {
  $("lobby").classList.remove("hidden");

  TIME_CONTROLS.forEach((tc) => {
    const option = document.createElement("option");
    option.value = tc.id;
    option.textContent = tc.label;
    $("time-select").appendChild(option);
  });
  $("time-select").value = "10+0";

  $("btn-create").addEventListener("click", async () => {
    const btn = $("btn-create");
    btn.disabled = true;
    btn.textContent = "Creating...";
    try {
      const tc = TIME_CONTROLS.find((t) => t.id === $("time-select").value) || TIME_CONTROLS[0];
      const id = await createGame($("color-choice").value, tc);
      window.location.href = "online.html?game=" + id;
    } catch (err) {
      showToast("Could not create the game.", "error");
      btn.disabled = false;
      btn.textContent = "Create game";
    }
  });
}

/* ---------- Game ---------- */
async function startGame() {
  $("game-view").classList.remove("hidden");
  try {
    await joinGame(gameId);
  } catch (err) {
    if (err.message === "game-not-found") {
      showToast("Game not found.", "error");
      $("status").textContent = "Game not found.";
      return;
    }
    if (err.message === "game-full") {
      showToast("This game is full. You are watching.");
    } else {
      showToast("Could not join the game.", "error");
      return;
    }
  }
  watchGame(gameId, onGameData, () => showToast("Lost connection to the game.", "error"));
  setInterval(tick, 250);
}

async function handleMove(from, to, promotion) {
  if (!data || data.status !== "active") return;
  if (data.timeBase > 0 && remaining(me) <= 0) {
    showToast("Your time is up.", "error");
    return;
  }
  const elapsed = Date.now() - turnStartedLocal;
  try {
    await sendMove(gameId, data, from, to, promotion, elapsed);
  } catch (err) {
    showToast("Move failed. Try again.", "error");
  }
}

function onGameData(d) {
  data = d;
  me = myColor(d, uid);

  // Work out when the current turn's clock started
  const key = d.clockStart
    ? String(d.clockStart.toMillis())
    : "pending-" + d.moves.length + "-" + d.status;
  if (key !== turnKey) {
    turnKey = key;
    let offset = 0;
    if (firstLoad && d.clockStart) {
      offset = Math.min(Math.max(Date.now() - d.clockStart.toMillis(), 0), 6 * 3600 * 1000);
    }
    turnStartedLocal = Date.now() - offset;
  }

  const chess = new Chess(d.fen);
  board.setGame(chess);
  board.clearSelection();
  board.setLastMove(d.lastMove);
  board.setLocked(d.status !== "active");

  if (firstLoad) {
    firstLoad = false;
    if (me === "b") board.flipped = true;
  }

  board.render();
  renderStatus(chess);
  renderPlayers();
  renderMoves();
  renderCaptured();
  renderBoxes();
  renderClocks();
}

/* ---------- Clocks ---------- */
function remaining(color) {
  const base = color === "w" ? data.whiteTime : data.blackTime;
  if (data.status === "active" && data.turn === color && data.timeBase > 0) {
    return base - (Date.now() - turnStartedLocal);
  }
  return base;
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function setClock(el, color) {
  const ms = remaining(color);
  const active = data.status === "active" && data.turn === color;
  el.textContent = formatTime(ms);
  el.classList.toggle("active", active);
  el.classList.toggle("low", active && ms < 20000);
}

function renderClocks() {
  if (!data || !(data.timeBase > 0)) {
    $("opponent-clock").textContent = "";
    $("me-clock").textContent = "";
    return;
  }
  const topColor = board.flipped ? "w" : "b";
  const bottomColor = topColor === "w" ? "b" : "w";
  setClock($("opponent-clock"), topColor);
  setClock($("me-clock"), bottomColor);
}

function tick() {
  if (!data) return;
  renderClocks();
  if (data.status === "active" && data.timeBase > 0 && me && remaining(data.turn) <= 0) {
    if (Date.now() - lastFlagTry > 1500) {
      lastFlagTry = Date.now();
      flagTimeout(gameId, data).catch(() => {});
    }
  }
}

/* ---------- Screen updates ---------- */
function resultText() {
  if (data.result === "1/2-1/2") return "Draw (" + data.reason + ").";
  const whiteWon = data.result === "1-0";
  let text = (whiteWon ? "White" : "Black") + " wins by " + data.reason + ".";
  if (me) {
    const iWon = (whiteWon && me === "w") || (!whiteWon && me === "b");
    text += iWon ? " You won!" : " You lost.";
  }
  return text;
}

function renderStatus(chess) {
  const el = $("status");
  el.classList.remove("over");

  if (data.status === "waiting") {
    el.textContent = "Waiting for an opponent...";
    return;
  }
  if (data.status === "finished") {
    el.textContent = resultText();
    el.classList.add("over");
    return;
  }

  const turn = chess.turn();
  let text;
  if (me) text = turn === me ? "Your turn" : "Opponent's turn";
  else text = (turn === "w" ? "White" : "Black") + " to move";
  if (chess.inCheck()) text += " (check!)";
  el.textContent = text;
}

function nameOf(color) {
  const n = color === "w" ? data.whiteName : data.blackName;
  return (color === "w" ? "White: " : "Black: ") + (n || "waiting...");
}

function renderPlayers() {
  const topColor = board.flipped ? "w" : "b";
  const bottomColor = topColor === "w" ? "b" : "w";
  $("opponent-name").textContent = nameOf(topColor);
  $("me-name").textContent = nameOf(bottomColor);
}

function renderMoves() {
  const list = $("move-list");
  const moves = data.moves || [];
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

/* Captured pieces are worked out from the board position */
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const ORDER = ["q", "r", "b", "n", "p"];

function missingPieces(color) {
  const placement = data.fen.split(" ")[0];
  const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const ch of placement) {
    const lower = ch.toLowerCase();
    if (counts[lower] === undefined) continue;
    const pieceColor = ch === ch.toUpperCase() ? "w" : "b";
    if (pieceColor === color) counts[lower]++;
  }
  const result = [];
  ORDER.forEach((type) => {
    const gone = Math.max(0, START_COUNT[type] - counts[type]);
    for (let i = 0; i < gone; i++) result.push(type);
  });
  return result;
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
  const topColor = board.flipped ? "w" : "b";
  const bottomColor = topColor === "w" ? "b" : "w";
  fillCaptured($("captured-top"), missingPieces(bottomColor), bottomColor);
  fillCaptured($("captured-bottom"), missingPieces(topColor), topColor);
}

function renderBoxes() {
  const waiting = data.status === "waiting";
  $("share-box").classList.toggle("hidden", !waiting);
  if (waiting) {
    $("share-link").value =
      window.location.origin + window.location.pathname + "?game=" + gameId;
  }

  const offered = data.status === "active" && !!me && data.drawOffer && data.drawOffer !== me;
  $("draw-box").classList.toggle("hidden", !offered);
  if (offered) $("draw-text").textContent = "Your opponent offers a draw.";

  const active = data.status === "active" && !!me;
  $("btn-resign").disabled = !active;
  $("btn-draw").disabled = !active || data.drawOffer === me;
  $("btn-draw").textContent = data.drawOffer === me ? "Draw offered" : "Offer draw";
}

/* ---------- Buttons ---------- */
$("btn-flip").addEventListener("click", () => {
  board.flip();
  if (data) {
    renderPlayers();
    renderCaptured();
    renderClocks();
  }
});

$("btn-copy").addEventListener("click", async () => {
  const input = $("share-link");
  try {
    await navigator.clipboard.writeText(input.value);
    showToast("Link copied!", "success");
  } catch (err) {
    input.select();
    showToast("Press and hold the link to copy it.");
  }
});

$("btn-resign").addEventListener("click", async () => {
  if (!data || data.status !== "active") return;
  if (!confirm("Do you want to resign?")) return;
  try {
    await resignGame(gameId, data);
  } catch (err) {
    showToast("Could not resign. Try again.", "error");
  }
});

$("btn-draw").addEventListener("click", async () => {
  try {
    await offerDraw(gameId, data);
    showToast("Draw offered.");
  } catch (err) {
    showToast("Could not offer a draw.", "error");
  }
});

$("btn-accept-draw").addEventListener("click", async () => {
  try {
    await acceptDraw(gameId);
  } catch (err) {
    showToast("Could not accept the draw.", "error");
  }
});

/* ---------- Start (logged-in players only) ---------- */
requireAuth((user) => {
  if (started) return;
  started = true;
  uid = user.uid;
  if (gameId) startGame();
  else startLobby();
});
