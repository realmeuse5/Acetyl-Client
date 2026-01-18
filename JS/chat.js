import { remove, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from "./firebase-init.js";
import { ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");

let username = "Anonymous";

// Admin credentials
const ADMIN_KEY = "Ky3{*OxQ3#S*tFIw53$8ZJjjT"
const ADMIN_PIN = "4123"

let isAdmin = false;

document.getElementById("adminLogin").addEventListener("click", () => {
    if (!isAdmin) {
        // Login
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
        // Logout
        isAdmin = false;
        localStorage.removeItem("isAdmin");
        deactivateAdminUI();
    }
});

function activateAdminUI() {
    const usernameEl = document.getElementById("username");
    const adminBtn = document.getElementById("adminLogin");

    adminBtn.textContent = "Logout";

    const name = usernameEl.textContent;
    usernameEl.innerHTML = `<span class="admin-badge">[ADMIN]</span><span class="admin-username">${name}</span>`;
}

function deactivateAdminUI() {
    const usernameEl = document.getElementById("username");
    const adminBtn = document.getElementById("adminLogin");

    adminBtn.textContent = "Admin Login";

    const rawName = usernameEl.textContent.replace("[ADMIN]", "").trim();
    usernameEl.textContent = rawName;
}

// Load saved username on startup
const savedName = localStorage.getItem("username");
if (savedName) {
    username = savedName;
    document.getElementById("username").textContent = username;
}

if (localStorage.getItem("isAdmin") === "true") {
    isAdmin = true;
    activateAdminUI();
}

// Gear icon click → change username
document.getElementById("gear").addEventListener("click", () => {
    const name = prompt("Username:");
    if (name === null) return; // user hit cancel

    const cleaned = name.trim();

    if (cleaned.length === 0) {
        return;
    }

    if (cleaned.length > 24) {
        return;
    }

    if (/[.#$\[\]]/.test(cleaned)) {
        alert("Illegal Username");
        return;
    }

    // Passed all checks → save it
    username = cleaned;
    document.getElementById("username").textContent = username;
    localStorage.setItem("username", username);
});

function isNearBottom() {
    const threshold = 200;
    const distance = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    return distance < threshold;
}

const messagesRef = ref(db, "messages");

// SEND MESSAGE ON ENTER
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

function sendMessage() {
    const text = input.value.trim();
    if (text.length === 0) return;

    if (text.length > 500) { 
        alert("Nobody likes a spammer.");
        return;
    }

    push(messagesRef, {
        text: text,
        username: username,
        timestamp: Date.now(),
        isAdmin: isAdmin
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
            const keyToDelete = keys[i];
            await remove(child(messagesRef, keyToDelete));
        }
    }
}

// DISPLAY MESSAGES
onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();

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

    const shouldScroll = isNearBottom();

    messagesDiv.appendChild(wrapper);

    if (shouldScroll) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

});

