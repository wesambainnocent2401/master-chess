import { db } from "./firebase.js";
import { requireAuth, logoutUser, showToast } from "./auth.js";
import { listMyGames } from "./games.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* Theme toggle (remembers your choice) */
const root = document.documentElement;
root.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
document.getElementById("theme-btn").addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

document.getElementById("logout-btn").addEventListener("click", logoutUser);

/* ---------- Game history ---------- */
function describe(g, uid) {
  const iAmWhite = g.white === uid;
  const opponent = (iAmWhite ? g.blackName : g.whiteName) || "Waiting for opponent";

  let outcome = "";
  let css = "";
  if (g.status === "finished") {
    if (g.result === "1/2-1/2") {
      outcome = "Draw";
      css = "result-draw";
    } else {
      const whiteWon = g.result === "1-0";
      const won = whiteWon === iAmWhite;
      outcome = won ? "Won" : "Lost";
      css = won ? "result-won" : "result-lost";
    }
  } else if (g.status === "active") {
    outcome = "In progress";
  } else {
    outcome = "Waiting";
  }

  const clock = g.timeBase > 0
    ? Math.round(g.timeBase / 60) + "+" + g.timeInc
    : "No clock";
  const date = g.createdAt ? g.createdAt.toDate().toLocaleDateString() : "";

  return { opponent: opponent, outcome: outcome, css: css, meta: [clock, date].filter(Boolean).join(" · ") };
}

async function renderHistory(uid) {
  const box = document.getElementById("history");
  try {
    const games = (await listMyGames(uid)).filter((g) => g.status !== "cancelled");
    if (games.length === 0) {
      box.innerHTML = '<p class="muted">No games yet. Start one above!</p>';
      return;
    }
    box.innerHTML = "";
    games.slice(0, 10).forEach((g) => {
      const info = describe(g, uid);

      const row = document.createElement("a");
      row.className = "history-row";
      row.href = "online.html?game=" + g.id;

      const left = document.createElement("div");
      const who = document.createElement("div");
      who.className = "who";
      who.textContent = "vs " + info.opponent;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = info.meta;
      left.append(who, meta);

      const right = document.createElement("div");
      right.className = "outcome " + info.css;
      right.textContent = info.outcome;

      row.append(left, right);
      box.appendChild(row);
    });
  } catch (err) {
    box.innerHTML = '<p class="muted">Could not load your games.</p>';
  }
}

/* ---------- Load the signed-in player's profile ---------- */
let loaded = false;
requireAuth(async (user) => {
  if (loaded) return;
  loaded = true;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      showToast("Profile not found. Please register again.", "error");
      return;
    }
    const p = snap.data();
    const played = p.gamesPlayed || 0;

    document.getElementById("welcome").textContent = "Welcome, " + p.username + "!";
    document.getElementById("rating").textContent = p.rating;
    document.getElementById("played").textContent = played;
    document.getElementById("record").textContent = p.wins + " / " + p.losses + " / " + p.draws;
    document.getElementById("winrate").textContent =
      (played ? Math.round((p.wins / played) * 100) : 0) + "%";

    if (!user.emailVerified) {
      document.getElementById("verify-banner").classList.remove("hidden");
    }
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");

    renderHistory(user.uid);
  } catch (err) {
    showToast("Could not load your profile. Check your connection.", "error");
  }
});
