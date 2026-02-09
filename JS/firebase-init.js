// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getStorage, 
    ref as storageRef, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCkGeSLChYMN6GsJSKDKvqgFEfvm7UjKQ",
  authDomain: "discord-gg-abd53.firebaseapp.com",
  databaseURL: "https://discord-gg-abd53-default-rtdb.firebaseio.com",
  projectId: "discord-gg-abd53",
  storageBucket: "discord-gg-abd53.firebasestorage.app",
  messagingSenderId: "29132435438",
  appId: "1:29132435438:web:6602c5cd4cbb853a8128ff"
};

const supabase = window.supabase.createClient(
  "https://eitasikltwqslftycwwm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdGFzaWtsdHdxc2xmdHljd3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1OTczMzUsImV4cCI6MjA4NjE3MzMzNX0.sddj2Dc4iPHo4A04YRGCI5aJPyTDkXW8lk07iTdQeXM"
);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

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
        return; // do NOT set persistence, do NOT sign in
    }

    console.log("Running in FIREBASE AUTH MODE.");

    // Auto sign-in (normal devices)
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            await signInAnonymously(auth);
            return;
        }

        console.log("Firebase Auth UID:", user.uid);
    });
}

export async function uploadFileToSupabase(file, chatId) {
  const filePath = `${chatId}/${Date.now()}_${file.name}`;

  const { data, error } = await supabase.storage
    .from("chat-files")
    .upload(filePath, file);

  if (error) {
    console.error("Supabase upload failed:", error);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from("chat-files")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

