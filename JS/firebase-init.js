import { initializeApp} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCkGeSLChYMN6GsJSKDKvqgFEfvm7UjKQ",
  authDomain: "discord-gg-abd53.firebaseapp.com",
  databaseURL: "https://discord-gg-abd53-default-rtdb.firebaseio.com",
  projectId: "discord-gg-abd53",
  storageBucket: "discord-gg-abd53.firebasestorage.app",
  messagingSenderId: "29132435438",
  appId: "1:29132435438:web:6602c5cd4cbb853a8128ff"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
