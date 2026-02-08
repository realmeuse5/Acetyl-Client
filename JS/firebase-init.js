// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    setPersistence,
    inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCkGeSLChYMN6GsJSKDKvqgFEfvm7UjKQ",
  authDomain: "discord-gg-abd53.firebaseapp.com",
  databaseURL: "https://discord-gg-abd53-default-rtdb.firebaseio.com",
  projectId: "discord-gg-abd53",
  storageBucket: "discord-gg-abd53.firebasestorage.app",
  messagingSenderId: "29132435438",
  appId: "1:29132435438:web:6602c5cd4cbb853a8128ff"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export database + auth
export const db = getDatabase(app);
export const auth = getAuth(app);

// FIX FOR SCHOOL CHROMEBOOKS — force RAM-only auth persistence
setPersistence(auth, inMemoryPersistence);

// Auto sign-in
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // await signInAnonymously(auth); <-------------------RIGHT HERE
        return;
    }

    // User is signed in with a real UID now
    console.log("Firebase Auth UID:", user.uid);
});
