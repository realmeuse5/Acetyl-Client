// IMPORTS
import { db } from "./firebase-init.js";
import { 
    ref, 
    push, 
    onChildAdded, 
    onChildRemoved, 
    onChildChanged, 
    remove, 
    get, 
    child, 
    set,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// VARIABLES   
let messagesDiv;
let input;
let usernameEl;
let adminBtn;
let myChatsContainer;
let msg;

let username = "Anonymous";
let isAdmin = false;

let currentChat = "public";
let messagesRef = null;
let unsubscribe = null;

let myChats = [];

// Admin credentials
const ADMIN_KEY = "Ky3{*OxQ3#S*tFIw53$8ZJjjT";
const ADMIN_PIN = "4123";

// User ID
let userId = localStorage.getItem("userId");
if (!userId) {
    userId = "u_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("userId", userId);
}


// ONLOAD
window.onload = () => {
    // DOM elements
    messagesDiv = document.getElementById("messages");
    input = document.getElementById("messageInput");
    usernameEl = document.getElementById("username");
    adminBtn = document.getElementById("adminLogin");
    myChatsContainer = document.getElementById("myChats");
    msg = document.getElementById("noServersMsg");


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
    
    set(ref(db, `usernames/${userId}`), username);

    if (localStorage.getItem("isAdmin") === "true") {
        isAdmin = true;
        activateAdminUI();
    }

    if (localStorage.getItem("isAdmin") === "true") {
        document.getElementById("adminPanelBtn").style.display = "block";
    }
}

function loadSavedChats() {
    const saved = localStorage.getItem("myChats");
    if (saved) {
        myChats = JSON.parse(saved);
        myChats.forEach(code => addChatToSidebar(code));
    }
    updateNoServersMessage();
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
            remove(ref(db, `chatMembers/${code}/${userId}`));
        }
    }

    myChats = validChats;
    localStorage.setItem("myChats", JSON.stringify(myChats));

    myChatsContainer.innerHTML = "";
    myChats.forEach(code => addChatToSidebar(code));
    updateNoServersMessage();
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
    set(ref(db, `usernames/${userId}`), username);
    myChats.forEach(code => {
        const userRef = ref(db, `chats/${code}/activeUsers/${userId}`);
        set(userRef, {
            username: username,
            lastSeen: Date.now()
        });
    });
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
            document.getElementById("adminPanelBtn").style.display = "block";
        } else {
            alert("Invalid credentials.");
        }
    } else {
        isAdmin = false;
        localStorage.removeItem("isAdmin");
        deactivateAdminUI();
        document.getElementById("adminPanelBtn").style.display = "none";
    }
}

function activateAdminUI() {
    adminBtn.textContent = "Logout";
    usernameEl.innerHTML = `<span class="admin-badge">[ADMIN]</span><span class="admin-username">${username}</span>`;
    document.getElementById("adminPanelBtn").style.display = "block";
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
    
    updatePlaceholder(chatId === "public" ? "Public" : chatId);
    currentChat = chatId;
    setupPresence(chatId);

    // Highlight active chat
    highlightActiveChat(chatId);

    if (unsubscribe) unsubscribe();

    messagesRef = ref(db, `chats/${currentChat}/messages`);
    messagesDiv.innerHTML = "";

    unsubscribe = onChildAdded(messagesRef, (snapshot) => {
        displayMessage(snapshot.val());
    });
}

function highlightActiveChat(chatId) {
    const rows = document.querySelectorAll(".chatRow");
    const publicBtn = document.getElementById("publicChatBtn");

    rows.forEach(row => {
        if (row.dataset.chat === chatId) {
            row.classList.add("active");
        } else {
            row.classList.remove("active");
        }
    });

    // Handle public chat separately
    if (chatId === "public") {
        publicBtn.classList.add("active");
    } else {
        publicBtn.classList.remove("active");
    }
}

function updatePlaceholder(chatName) {
    input.placeholder = `Message @${chatName}`;
}


// CREATE/JOIN CHATS
function createChat() {
    if (myChats.length >= 5) {
        alert("Server limit reached");
        return;
    }
    const code = Math.random().toString(36).substring(2, 8);

    set(ref(db, `chats/${code}`), { createdAt: Date.now() });
    set(ref(db, `chatMembers/${code}/${userId}`), true);

    addChatToSidebar(code);
    switchChat(code);

    // Auto message
    push(ref(db, `chats/${code}/messages`), {
    text: `Server created. Your server code is: ${code}`,
    username: "Server Bot",
    timestamp: Date.now(),
    isAdmin: false,
    isSystem: true
});

}

async function joinChat() {
    const code = prompt("Enter server code:");
    if (!code) return;

    // NEW: prevent joining twice
    if (myChats.includes(code)) {
        return;
    }

    if (code === "public") {
        switchChat("public");
        return;
    }

    const chatRef = ref(db, `chats/${code}`);
    const snapshot = await get(chatRef);

    if (!snapshot.exists()) {
        alert("Server not found.");
        return;
    }

    set(ref(db, `chatMembers/${code}/${userId}`), true);
    addChatToSidebar(code);
    switchChat(code);
}

function addChatToSidebar(code) {
    if (!myChats.includes(code)) {
        myChats.push(code);
        localStorage.setItem("myChats", JSON.stringify(myChats));
    }

    const row = document.createElement("div");
    row.classList.add("chatRow");
    row.dataset.chat = code;

    // Create the chat button
    const btn = document.createElement("button");
    btn.textContent = code;
    btn.classList.add("chatButton");
    btn.dataset.chat = code;
    btn.addEventListener("click", () => switchChat(code));

    // Create the leave (X) button
    const leave = document.createElement("span");
    leave.textContent = "✖";
    leave.classList.add("leaveChat");

    leave.addEventListener("click", (e) => {
        e.stopPropagation();
        leaveServer(code);
    });

    row.appendChild(btn);
    row.appendChild(leave);

    myChatsContainer.appendChild(row);
    updateNoServersMessage();
}

async function leaveServer(code) {
    if (!confirm("Are you sure you want to leave this server?")) return;
    if (code === "public") {
        alert("You cannot leave the public chat.");
        return;
    }

    myChats = myChats.filter(c => c !== code);
    localStorage.setItem("myChats", JSON.stringify(myChats));

    // Remove from sidebar
    const rows = [...myChatsContainer.children];
    const row = rows.find(r => r.querySelector("button").textContent === code);
    if (row) row.remove();

    remove(ref(db, `chats/${code}/activeUsers/${userId}`));
    remove(ref(db, `chatMembers/${code}/${userId}`));

    switchChat("public");
    updateNoServersMessage();

    // If chat is empty, delete
    const membersRef = ref(db, `chatMembers/${code}`);
    const snapshot = await get(membersRef);

    if (!snapshot.exists()) {
    remove(ref(db, `chats/${code}`));
        remove(ref(db, `chatMembers/${code}`));
    }
}

function updateNoServersMessage() {
    if (myChats.length === 0) {
        msg.style.display = "block";
    } else {
        msg.style.display = "none";
    }
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
    const keys = Object.keys(messages).sort();

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

    if (msg.isSystem) {
        name.textContent = msg.username;
        name.classList.add("system-username");
    } else if (msg.isAdmin) {
        name.innerHTML = `<span class="admin-badge">[ADMIN]</span><span class="admin-username">${msg.username}</span>`;
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

    if (isNearBottom()) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}


// ACTIVE USERS PRESENCE
let presenceRef = null;
let presenceUnsubs = [];

function setupPresence(chatId) {
    console.log("setupPresence called for", chatId);

    presenceUnsubs.forEach(unsub => unsub());
    presenceUnsubs = [];

    // Remove presence from previous chat
    if (presenceRef) {
        const oldUserRef = child(presenceRef, userId);
        remove(oldUserRef);
    }

    presenceRef = ref(db, `chats/${chatId}/activeUsers`);
    const userRef = child(presenceRef, userId);

    // Auto-remove on disconnect
    onDisconnect(userRef).remove();

    set(userRef, {
        username: username,
        lastSeen: Date.now()
    });

    presenceUnsubs.push(onChildAdded(presenceRef, updateActiveUsersList));
    presenceUnsubs.push(onChildRemoved(presenceRef, updateActiveUsersList));
    presenceUnsubs.push(onChildChanged(presenceRef, updateActiveUsersList));

    updateActiveUsersList();
}

async function updateActiveUsersList() {
    const container = document.getElementById("activeUsers");
    const emptyMsg = document.getElementById("noActiveUsersMsg");

    if (!presenceRef) return;

    const snapshot = await get(presenceRef);
    container.innerHTML = "";

    if (!snapshot.exists()) {
        emptyMsg.style.display = "block";
        return;
    }

    emptyMsg.style.display = "none";

    const users = snapshot.val();

    const sorted = Object.values(users).sort((a, b) =>
        a.username.localeCompare(b.username)
    );

    sorted.forEach(u => {
        const el = document.createElement("div");
        el.classList.add("activeUser");
        el.textContent = u.username;
        container.appendChild(el);
    });
}


// UTILITY FUNCTIONS
function isNearBottom() {
    const threshold = 200;
    const distance = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    return distance < threshold;
}

// ADMIN PANEL
// Open
document.getElementById("adminPanelBtn").addEventListener("click", () => {
    document.getElementById("adminPanel").classList.remove("hidden");
    wireAdminButtons();
});

// Close
document.getElementById("adminClose").addEventListener("click", () => {
    document.getElementById("adminPanel").classList.add("hidden");
});

const adminPanelBtn = document.getElementById("adminPanelBtn");

if (localStorage.getItem("isAdmin") === "true") {
    adminPanelBtn.style.display = "block";
}

function wireAdminButtons() {
    document.getElementById("clearMessagesBtn").onclick = () => clearMessages(currentChat);
    document.getElementById("deleteChatBtn").onclick = () => deleteChat(currentChat);
    document.getElementById("deletePrivateChatsBtn").onclick = deleteAllPrivateChats;
    document.getElementById("deleteEmptyChatsBtn").onclick = deleteEmptyChats;
    document.getElementById("resetActiveUsersBtn").onclick = resetActiveUsers;
}








