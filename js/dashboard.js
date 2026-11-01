import { db } from "./firebase.js";
import { requireAuth, logoutUser, showToast } from "./auth.js";
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

/* Load the signed-in player's profile */
requireAuth(async (user) => {
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
    document.getElementById("record").textContent = `${p.wins} / ${p.losses} / ${p.draws}`;
    document.getElementById("winrate").textContent =
      (played ? Math.round((p.wins / played) * 100) : 0) + "%";

    if (!user.emailVerified) {
      document.getElementById("verify-banner").classList.remove("hidden");
    }
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
  } catch (err) {
    showToast("Could not load your profile. Check your connection.", "error");
  }
});
