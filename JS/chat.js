import { remove, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from "./firebase-init.js";
import { ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");

let username = "Anonymous";

// Load saved username on startup
const savedName = localStorage.getItem("username");
if (savedName) {
    username = savedName;
    document.getElementById("username").textContent = username;
}

// Gear icon click → change username
document.getElementById("gear").addEventListener("click", () => {
    const name = prompt("Username:");

    if (name && name.trim() !== "") {
        username = name.trim();

        // Update sidebar display
        document.getElementById("username").textContent = username;

        // Save locally so it persists
        localStorage.setItem("username", username);
    }
});



const messagesRef = ref(db, "messages");

// SEND MESSAGE ON ENTER
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

function sendMessage() {
    const text = input.value.trim();
    if (text === "") return;

    push(messagesRef, {
        text: text,
        username: username,
        timestamp: Date.now()
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
    name.textContent = msg.username || "Anonymous";

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
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

