import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ---------- Toast messages ---------- */
export function showToast(message, type = "info") {
  let box = document.getElementById("toast-container");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-container";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ---------- Validation ---------- */
export function validateRegistration({ username, email, password, confirm }) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return "Username must be 3-20 characters: letters, numbers, underscore.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email address.";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password needs 8+ characters with letters and numbers.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

function friendlyError(err) {
  const map = {
    "auth/email-already-in-use": "That email is already registered.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your internet.",
    "auth/weak-password": "Password is too weak.",
    "username-taken": "That username is already taken."
  };
  return map[err.code || err.message] || "Something went wrong. Try again.";
}

/* ---------- Register ---------- */
export async function registerUser({ username, email, password, confirm }) {
  const problem = validateRegistration({ username, email, password, confirm });
  if (problem) throw { message: problem, custom: true };

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const lower = username.toLowerCase();

  try {
    // Reserve the username and create the public profile together
    await runTransaction(db, async (tx) => {
      const nameRef = doc(db, "usernames", lower);
      const taken = await tx.get(nameRef);
      if (taken.exists()) throw { code: "username-taken" };

      tx.set(nameRef, { uid: user.uid });
      tx.set(doc(db, "users", user.uid), {
        username,
        usernameLower: lower,
        country: "",
        avatar: "",
        rating: 1200,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: serverTimestamp()
      });
    });
    await updateProfile(user, { displayName: username });
    await sendEmailVerification(user);
  } catch (err) {
    await user.delete(); // undo the account if the profile failed
    throw err;
  }
  return user;
}

/* ---------- Login / Logout / Reset ---------- */
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = "login.html";
}

export async function resetPassword(email) {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw { message: "Enter a valid email address.", custom: true };
  await sendPasswordResetEmail(auth, email);
}

/* ---------- Page guards ---------- */
export function requireAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
    else callback(user);
  });
}

export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "dashboard.html";
  });
}

export function errorText(err) {
  return err.custom ? err.message : friendlyError(err);
}
