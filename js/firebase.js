import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);

// Email/password only: no popup helper script is loaded
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});
export const db = getFirestore(app);
