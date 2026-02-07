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

let myChats = JSON.parse(localStorage.getItem("myChats") || "[]");

// Admin credentials
const ADMIN_KEY = "Ky3xQ3#Ftw53$";
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
    setupNotificationListener("public");
    checkAdminStatus();

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
};


// LOAD USER + CHATS 
function loadSavedUser() {
    const savedName = localStorage.getItem("username");
    if (savedName) {
        username = savedName;
        usernameEl.textContent = username;
    }
    
    set(ref(db, `usernames/${userId}`), username);
}

async function loadSavedChats() {
    const upgraded = [];

    for (const chat of myChats) {
        // Old format: "abc123"
        const code = typeof chat === "string" ? chat : chat.code;

        const snap = await get(ref(db, `chats/${code}/name`));
        let name = snap.exists() ? snap.val() : null;

        if (!name) {
            name = `Chat ${code}`;
            await set(ref(db, `chats/${code}/name`), name);
        }

        // Upgrade localStorage entry
        upgraded.push({ code, name });

        addChatToSidebar(code, name);
    }

    myChats = upgraded;
    localStorage.setItem("myChats", JSON.stringify(myChats));
}

async function validateSavedChats() {
    const validChats = [];

    for (const chat of myChats) {
        const code = chat.code;  
        const name = chat.name;

        const chatRef = ref(db, `chats/${code}`);
        const snapshot = await get(chatRef);

        if (snapshot.exists()) {
            // Keep the chat with both code + name
            validChats.push({ code, name });
        } else {
            console.log(`Removing deleted server: ${code}`);
            remove(ref(db, `chatMembers/${code}/${userId}`));
        }
    }

    myChats = validChats;
    localStorage.setItem("myChats", JSON.stringify(myChats));

    myChatsContainer.innerHTML = "";

    // Rebuild sidebar with names
    myChats.forEach(chat => {
        addChatToSidebar(chat.code, chat.name);
    });

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
    myChats.forEach(chat => {
    const userRef = ref(db, `chats/${chat.code}/activeUsers/${userId}`);
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
            set(ref(db, `admins/${userId}`), true);
            activateAdminUI();
            document.getElementById("adminPanelBtn").style.display = "block";
        } else {
            alert("Invalid credentials.");
        }
    } else {
        isAdmin = false;
        remove(ref(db, `admins/${userId}`));
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

    const data = snapshot.val();
    const chatName = data.name || chatId;

    updatePlaceholder(chatName);
    currentChat = chatId;
    setupPresence(chatId);

    highlightActiveChat(chatId);

    if (unsubscribe) unsubscribe();

    messagesRef = ref(db, `chats/${currentChat}/messages`);
    messagesDiv.innerHTML = "";

    unsubscribe = onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        displayMessage(msg);
        maybeNotify(msg, currentChat);
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

    const name = prompt("Enter a name for your chat:");
    if (!name) return;

    const code = Math.random().toString(36).substring(2, 8);

    set(ref(db, `chats/${code}`), {
        name,
        createdAt: Date.now()
    });

    addChatToSidebar(code, name);
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

    // Prevent joining twice
    if (myChats.some(c => c.code === code)) {
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

    const data = snapshot.val();

    let name = data.name;
    if (!name) {
        name = `Chat ${code}`; // or any fallback you like
        await set(ref(db, `chats/${code}/name`), name);
    }

    // Add user to chatMembers
    set(ref(db, `chatMembers/${code}/${userId}`), true);

    // Add to sidebar using the NAME
    addChatToSidebar(code, name);

    switchChat(code);

    setupNotificationListener(code);
}

function addChatToSidebar(code, name) {
    if (!myChats.some(c => c.code === code)) {
        myChats.push({ code, name });
        localStorage.setItem("myChats", JSON.stringify(myChats));
    }

    const row = document.createElement("div");
    row.classList.add("chatRow");
    row.dataset.chat = code;
    row.title = code;

    const btn = document.createElement("button");
    btn.textContent = name; // show the chat NAME
    btn.classList.add("chatButton");
    btn.dataset.chat = code;
    btn.addEventListener("click", () => switchChat(code));

    const leave = document.createElement("span");
    leave.textContent = "";
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

    myChats = myChats.filter(c => c.code !== code);
    localStorage.setItem("myChats", JSON.stringify(myChats));

    // Remove from sidebar
    const rows = [...myChatsContainer.children];
    const row = rows.find(r => r.dataset.chat === code);
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

    messagesRef = ref(db, `chats/${currentChat}/messages`);

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

function isTabActive() {
    return document.visibilityState === "visible";
}

function maybeNotify(msg, chatId) {
    // Don't notify if tab is active
    if (isTabActive()) return;

    // Don't notify for your own messages
    if (msg.username === username) return;

    // Don't notify for system messages
    if (msg.isSystem) return;

    const title = `${msg.username} sent a message`;
    const body = `on server ${chatId}`;

    new Notification(title, {body, requireInteraction: true});
    console.log("maybeNotify triggered:", msg, chatId);
}

const notificationListeners = new Set();

function setupNotificationListener(chatId) {
    if (notificationListeners.has(chatId)) return;
    notificationListeners.add(chatId);

    const refMessages = ref(db, `chats/${chatId}/messages`);

    onChildAdded(refMessages, (snapshot) => {
        const msg = snapshot.val();
        maybeNotify(msg, chatId);
    });
}


// ADMIN PANEL
// Open
document.getElementById("adminPanelBtn").addEventListener("click", () => {
    document.getElementById("adminPanel").classList.remove("hidden");
    wireAdminButtons();
});

// Close
document.getElementsByClassName("leaveChat")[0].addEventListener("click", () => {
    document.getElementById("adminPanel").classList.add("hidden");
});

const adminPanelBtn = document.getElementById("adminPanelBtn");

async function checkAdminStatus() {
    const adminRef = ref(db, `admins/${userId}`);
    const snap = await get(adminRef);

    if (snap.exists()) {
        isAdmin = true;
        activateAdminUI();
        document.getElementById("adminPanelBtn").style.display = "block";
    }
}

function wireAdminButtons() {
    document.getElementById("clearMessagesBtn").onclick = () => clearMessages(currentChat);
    document.getElementById("deleteChatBtn").onclick = () => deleteChat(currentChat);
    document.getElementById("deletePrivateChatsBtn").onclick = deleteAllPrivateChats;
    document.getElementById("deleteEmptyChatsBtn").onclick = deleteEmptyChats;
    document.getElementById("resetActiveUsersBtn").onclick = resetActiveUsers;
}









