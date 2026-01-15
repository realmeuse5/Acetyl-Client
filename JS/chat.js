import { remove, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from "./firebase-init.js";
import { ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let username = "Anonymous";

const messagesRef = ref(db, "messages");

sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (text === "") return;

    push(messagesRef, {
        text: text,
        username: username,
        timestamp: Date.now()
    });

    enforceMessageLimit();
    input.value = "";
});

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

onChildAdded(messagesRef, (snapshot) => {
  const msg = snapshot.val();

  const wrapper = document.createElement("div");
  wrapper.classList.add("message");

  const name = document.createElement("span");
  name.classList.add("username");
  name.textContent = msg.username || "Anonymous";

  const text = document.createElement("span");
  text.classList.add("text");
  text.textContent = msg.text;

  wrapper.appendChild(name);
  wrapper.appendChild(text);

  messagesDiv.appendChild(wrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

document.getElementById("setUsernameBtn").addEventListener("click", () => {
  const name = prompt("Enter username:");
  if (name && name.trim() !== "") {
    username = name.trim();
  }
});

document.getElementById("copyrightBtn").addEventListener("click", () => {
  const name = alert("Not affiliated with, endorsed by, or connected to Discord Inc. in any way. All trademarks and brand names belong to their respective owners.");
});
