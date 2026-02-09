import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
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

export const db = getDatabase(app);
export const auth = getAuth(app);

// --- Hybrid mode flag
export let noAuthMode = false;

// Detect if IndexedDB is blocked (restricted environment → no-auth mode)
async function isIndexedDBBlocked() {
    return new Promise(resolve => {
        let dbTest;
        try {
            const request = indexedDB.open("test-db-for-auth-check");
            request.onerror = () => resolve(true);   // blocked
            request.onsuccess = () => {
                dbTest = request.result;
                dbTest.close();
                resolve(false); // allowed
            };
        } catch (e) {
            resolve(true); // blocked
        }
    });
}

export async function initAuthMode() {
    const blocked = await isIndexedDBBlocked();
    noAuthMode = blocked;

    if (noAuthMode) {
        console.warn("Running in NO-AUTH MODE (restricted device detected).");
        return;
    }

    console.log("Running in FIREBASE AUTH MODE.");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            await signInAnonymously(auth);
            return;
        }

        console.log("Firebase Auth UID:", user.uid);
    });
}
