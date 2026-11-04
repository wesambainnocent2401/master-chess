import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const TIME_CONTROLS = [
  { id: "none", label: "No clock", base: 0, inc: 0 },
  { id: "1+0", label: "Bullet: 1 min", base: 60, inc: 0 },
  { id: "3+0", label: "Blitz: 3 min", base: 180, inc: 0 },
  { id: "5+0", label: "Blitz: 5 min", base: 300, inc: 0 },
  { id: "10+0", label: "Rapid: 10 min", base: 600, inc: 0 },
  { id: "15+10", label: "Rapid: 15 min + 10s", base: 900, inc: 10 },
  { id: "30+0", label: "Classical: 30 min", base: 1800, inc: 0 }
];

function currentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("not-signed-in");
  return user;
}

export function myColor(game, uid) {
  if (game.white === uid) return "w";
  if (game.black === uid) return "b";
  return null;
}

/* ---------- Create a game and get its id ---------- */
export async function createGame(colorChoice, timeControl) {
  const user = currentUser();
  const tc = timeControl || TIME_CONTROLS[0];
  let color = colorChoice;
  if (color === "random") color = Math.random() < 0.5 ? "w" : "b";
  const name = user.displayName || "Player";

  const ref = await addDoc(collection(db, "games"), {
    white: color === "w" ? user.uid : null,
    black: color === "b" ? user.uid : null,
    whiteName: color === "w" ? name : null,
    blackName: color === "b" ? name : null,
    creator: user.uid,
    fen: START_FEN,
    turn: "w",
    moves: [],
    lastMove: null,
    status: "waiting",
    result: "",
    reason: "",
    drawOffer: "",
    timeBase: tc.base,
    timeInc: tc.inc,
    whiteTime: tc.base * 1000,
    blackTime: tc.base * 1000,
    clockStart: null,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/* ---------- Join an existing game (this also starts the clock) ---------- */
export async function joinGame(gameId) {
  const user = currentUser();
  const ref = doc(db, "games", gameId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("game-not-found");

  const game = snap.data();
  if (game.white === user.uid || game.black === user.uid) return; // already seated
  if (game.status !== "waiting") throw new Error("game-full");

  const name = user.displayName || "Player";
  if (game.black === null) {
    await updateDoc(ref, {
      black: user.uid,
      blackName: name,
      status: "active",
      clockStart: serverTimestamp()
    });
  } else {
    await updateDoc(ref, {
      white: user.uid,
      whiteName: name,
      status: "active",
      clockStart: serverTimestamp()
    });
  }
}

/* ---------- Live updates ---------- */
export function watchGame(gameId, onData, onError) {
  return onSnapshot(
    doc(db, "games", gameId),
    (snap) => {
      if (snap.exists()) onData(snap.data());
      else onError(new Error("game-not-found"));
    },
    onError
  );
}

/* ---------- Make a move ---------- */
// elapsedMs = how long the mover thought (measured on this phone)
export async function sendMove(gameId, game, from, to, promotion, elapsedMs) {
  const user = currentUser();
  const color = myColor(game, user.uid);
  if (!color || color !== game.turn || game.status !== "active") {
    throw new Error("not-your-turn");
  }

  const chess = new Chess(game.fen);
  const move = chess.move({ from: from, to: to, promotion: promotion });

  const base = {
    fen: chess.fen(),
    turn: chess.turn(),
    moves: game.moves.concat(move.san),
    lastMove: { from: move.from, to: move.to },
    drawOffer: ""
  };

  if (chess.isCheckmate()) {
    base.status = "finished";
    base.result = color === "w" ? "1-0" : "0-1";
    base.reason = "checkmate";
  } else if (chess.isStalemate()) {
    base.status = "finished";
    base.result = "1/2-1/2";
    base.reason = "stalemate";
  } else if (chess.isInsufficientMaterial()) {
    base.status = "finished";
    base.result = "1/2-1/2";
    base.reason = "insufficient material";
  } else if (chess.isThreefoldRepetition()) {
    base.status = "finished";
    base.result = "1/2-1/2";
    base.reason = "repetition";
  } else if (chess.isDraw()) {
    base.status = "finished";
    base.result = "1/2-1/2";
    base.reason = "fifty-move rule";
  }

  const timed = game.timeBase > 0;
  // The first try keeps a small safety margin for network delay.
  // If the server says no, we retry claiming a little less time.
  const margins = timed ? [600, 3000, 8000] : [0];
  let lastError = null;

  for (const margin of margins) {
    const update = Object.assign({}, base);
    if (timed) {
      const key = color === "w" ? "whiteTime" : "blackTime";
      const left = game[key] - elapsedMs - margin + game.timeInc * 1000;
      update[key] = Math.max(1, Math.round(left));
      update.clockStart = serverTimestamp();
    }
    try {
      await updateDoc(doc(db, "games", gameId), update);
      return;
    } catch (err) {
      lastError = err;
      if (!(timed && err.code === "permission-denied")) throw err;
    }
  }
  throw lastError;
}

/* ---------- Resign, draw offers, timeout ---------- */
export async function resignGame(gameId, game) {
  const color = myColor(game, currentUser().uid);
  if (!color) throw new Error("not-a-player");
  await updateDoc(doc(db, "games", gameId), {
    status: "finished",
    result: color === "w" ? "0-1" : "1-0",
    reason: "resignation"
  });
}

export async function offerDraw(gameId, game) {
  const color = myColor(game, currentUser().uid);
  if (!color) throw new Error("not-a-player");
  await updateDoc(doc(db, "games", gameId), { drawOffer: color });
}

export async function acceptDraw(gameId) {
  await updateDoc(doc(db, "games", gameId), {
    status: "finished",
    result: "1/2-1/2",
    reason: "agreement",
    drawOffer: ""
  });
}

// Ends the game when the side to move has run out of time
export async function flagTimeout(gameId, game) {
  await updateDoc(doc(db, "games", gameId), {
    status: "finished",
    result: game.turn === "w" ? "0-1" : "1-0",
    reason: "timeout"
  });
                                 }
