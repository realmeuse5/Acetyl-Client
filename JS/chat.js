// IMPORTS
import { db } from "./firebase-init.js";
import { ref, push, onChildAdded, remove, get, child, set } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


// VARIABLES   
let messagesDiv;
let input;
let usernameEl;
let adminBtn;
let myChatsContainer;

let username = "Anonymous";
let isAdmin = false;

let currentChat = "public";
let messagesRef = null;
let unsubscribe = null;

let myChats = [];

// Admin credentials
const ADMIN_KEY = "Ky3{*OxQ3#S*tFIw53$8ZJjjT";
const ADMIN_PIN = "4123";


// ONLOAD
window.onload = () => {
    // DOM elements
    messagesDiv = document.getElementById("messages");
    input = document.getElementById("messageInput");
    usernameEl = document.getElementById("username");
    adminBtn = document.getElementById("adminLogin");
    myChatsContainer = document.getElementById("myChats");

    loadSavedUser();

    loadSavedChats();

    validateSavedChats();

    attachUIListeners();

    switchChat("public");
};


// LOAD USER + CHATS 
function loadSavedUser() {
    const savedName = localStorage.getItem("username");
    if (savedName) {
        username = savedName;
        usernameEl.textContent = username;
    }

    if (localStorage.getItem("isAdmin") === "true") {
        isAdmin = true;
        activateAdminUI();
    }
}

function loadSavedChats() {
    const saved = localStorage.getItem("myChats");
    if (saved) {
        myChats = JSON.parse(saved);
        myChats.forEach(code => addChatToSidebar(code));
    }
}

async function validateSavedChats() {
    const validChats = [];

    for (const code of myChats) {
        const chatRef = ref(db, `chats/${code}`);
        const snapshot = await get(chatRef);

        if (snapshot.exists()) {
            validChats.push(code);
        } else {
            console.log(`Removing deleted server: ${code}`);
        }
    }

    myChats = validChats;
    localStorage.setItem("myChats", JSON.stringify(myChats));

    myChatsContainer.innerHTML = "";
    myChats.forEach(code => addChatToSidebar(code));
}


// UI EVENT LISTENERS
function attachUIListeners() {
    document.getElementById("gear").addEventListener("click", changeUsername);
    document.getElementById("publicChatBtn").addEventListener("click", () => switchChat("public"));
    document.getElementById("createChatBtn").addEventListener("click", createChat);
    document.getElementById("joinChatBtn").addEventListener("click", joinChat);

    adminBtn.addEventListener("click", toggleAdmin);

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}


// USERNAME MANAGEMENT
function changeUsername() {
    const name = prompt("Username:");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 24 || /[.#$\[\]]/.test(cleaned)) return;

    username = cleaned;
    usernameEl.textContent = username;
    localStorage.setItem("username", username);
}


// ADMIN LOGIN/LOGOUT
function toggleAdmin() {
    if (!isAdmin) {
        const key = prompt("Admin Key:");
        if (!key) return;

        const pin = prompt("Admin PIN:");
        if (!pin) return;

        if (key === ADMIN_KEY && pin === ADMIN_PIN) {
            isAdmin = true;
            localStorage.setItem("isAdmin", "true");
            activateAdminUI();
        } else {
            alert("Invalid credentials.");
        }
    } else {
        isAdmin = false;
        localStorage.removeItem("isAdmin");
        deactivateAdminUI();
    }
}

function activateAdminUI() {
    adminBtn.textContent = "Logout";
    usernameEl.innerHTML = `<span class="admin-badge">[ADMIN]</span><span class="admin-username">${username}</span>`;
}

function deactivateAdminUI() {
    adminBtn.textContent = "Admin Login";
    usernameEl.textContent = username;
}


// CHAT SWITCHING
async function switchChat(chatId) {
    const chatRef = ref(db, `chats/${chatId}`);
    const snapshot = await get(chatRef);

    if (!snapshot.exists()) {
        alert("Server not found.");
        validateSavedChats();
        switchChat("public");
        return;
    }
    
    currentChat = chatId;

    if (unsubscribe) unsubscribe();

    messagesRef = ref(db, `chats/${currentChat}/messages`);
    messagesDiv.innerHTML = "";

    unsubscribe = onChildAdded(messagesRef, (snapshot) => {
        displayMessage(snapshot.val());
    });
}


// CREATE/JOIN CHATS
function createChat() {
    const code = Math.random().toString(36).substring(2, 8);

    set(ref(db, `chats/${code}`), { createdAt: Date.now() });

    addChatToSidebar(code);
    switchChat(code);
}

async function joinChat() {
    const code = prompt("Enter server code:");
    if (!code) return;

    // NEW: prevent joining twice
    if (myChats.includes(code)) {
        return;
    }

    const chatRef = ref(db, `chats/${code}`);
    const snapshot = await get(chatRef);

    if (!snapshot.exists()) {
        alert("Server not found.");
        return;
    }

    addChatToSidebar(code);
    switchChat(code);
}

function addChatToSidebar(code) {
    if (!myChats.includes(code)) {
        myChats.push(code);
        localStorage.setItem("myChats", JSON.stringify(myChats));
    }

    const btn = document.createElement("button");
    btn.textContent = code;
    btn.classList.add("chatButton");
    btn.addEventListener("click", () => switchChat(code));

    myChatsContainer.appendChild(btn);
}


// MESSAGE SENDING
function sendMessage() {
    const text = input.value.trim();
    if (!text || text.length > 500) return;

    push(messagesRef, {
        text,
        username,
        timestamp: Date.now(),
        isAdmin
    });

    enforceMessageLimit();
    input.value = "";
}

async function enforceMessageLimit() {
    const snapshot = await get(messagesRef);
    if (!snapshot.exists()) return;

    const messages = snapshot.val();
    const keys = Object.keys(messages);

    if (keys.length > 50) {
        const excess = keys.length - 50;
        for (let i = 0; i < excess; i++) {
            await remove(child(messagesRef, keys[i]));
        }
    }
}


// MESSAGE DISPLAY
function displayMessage(msg) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message");

    const header = document.createElement("div");
    header.classList.add("message-header");

    const name = document.createElement("span");
    name.classList.add("username");

    if (msg.isAdmin) {
        name.innerHTML = `
            <span class="admin-badge">[ADMIN]</span>
            <span class="admin-username">${msg.username}</span>
        `;
    } else {
        name.textContent = msg.username || "Anonymous";
    }

    const time = document.createElement("span");
    time.classList.add("timestamp");
    time.textContent = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    header.appendChild(name);
    header.appendChild(time);

    const text = document.createElement("span");
    text.classList.add("text");
    text.textContent = msg.text;

    wrapper.appendChild(header);
    wrapper.appendChild(text);

    messagesDiv.appendChild(wrapper);
}


// UTILITY FUNCTIONS
function isNearBottom() {
    const threshold = 200;
    const distance = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    return distance < threshold;
}
