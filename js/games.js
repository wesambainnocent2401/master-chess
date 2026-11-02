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
export async function createGame(colorChoice) {
  const user = currentUser();
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
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/* ---------- Join an existing game ---------- */
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
    await updateDoc(ref, { black: user.uid, blackName: name, status: "active" });
  } else {
    await updateDoc(ref, { white: user.uid, whiteName: name, status: "active" });
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
export async function sendMove(gameId, game, from, to, promotion) {
  const user = currentUser();
  const color = myColor(game, user.uid);
  if (!color || color !== game.turn || game.status !== "active") {
    throw new Error("not-your-turn");
  }

  const chess = new Chess(game.fen);
  const move = chess.move({ from: from, to: to, promotion: promotion });

  const update = {
    fen: chess.fen(),
    turn: chess.turn(),
    moves: game.moves.concat(move.san),
    lastMove: { from: move.from, to: move.to },
    drawOffer: ""
  };

  if (chess.isCheckmate()) {
    update.status = "finished";
    update.result = color === "w" ? "1-0" : "0-1";
    update.reason = "checkmate";
  } else if (chess.isStalemate()) {
    update.status = "finished";
    update.result = "1/2-1/2";
    update.reason = "stalemate";
  } else if (chess.isInsufficientMaterial()) {
    update.status = "finished";
    update.result = "1/2-1/2";
    update.reason = "insufficient material";
  } else if (chess.isThreefoldRepetition()) {
    update.status = "finished";
    update.result = "1/2-1/2";
    update.reason = "repetition";
  } else if (chess.isDraw()) {
    update.status = "finished";
    update.result = "1/2-1/2";
    update.reason = "fifty-move rule";
  }

  await updateDoc(doc(db, "games", gameId), update);
}

/* ---------- Resign and draw offers ---------- */
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
