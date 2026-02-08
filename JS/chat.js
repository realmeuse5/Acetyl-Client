// AUTO-CLEANUP
if (localStorage.getItem("userId")) {
    console.log("Old localStorage userId found — removing automatically.");
    localStorage.removeItem("userId");
}
if (localStorage.getItem("isAdmin")) {
    console.log("Old localStorage isAdmin found — removing automatically.");
    localStorage.removeItem("isAdmin");
}


// IMPORTS
import { db, auth } from "./firebase-init.js";
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


// GLOBAL STATE
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

// We always use auth.currentUser.uid once Auth is ready.
let uid = null;


// ONLOAD
window.onload = () => {
    messagesDiv = document.getElementById("messages");
    input = document.getElementById("messageInput");
    usernameEl = document.getElementById("username");
    adminBtn = document.getElementById("adminLogin");
    myChatsContainer = document.getElementById("myChats");
    msg = document.getElementById("noServersMsg");

    waitForAuthReady();
};

function waitForAuthReady() {
    const unsub = auth.onAuthStateChanged(async (user) => {
        if (!user) return; // firebase-init will sign in

        uid = user.uid;
        console.log("Auth ready, UID:", uid);

        unsub();

        await migrateOldIdentityIfNeeded(uid);

        await loadSavedUser(uid);
        await loadSavedChats();
        await validateSavedChats();

        attachUIListeners();
        switchChat("public");
        setupNotificationListener("public");
        checkAdminStatus();

        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    });
}

// MIGRATION: from old localStorage userId → UID
async function migrateOldIdentityIfNeeded(newUid) {
    const oldId = localStorage.getItem("userId");
    if (!oldId || oldId === newUid) return;

    console.log("Found oldId, migrating:", oldId, "→", newUid);

    // 1) Migrate username: usernames/<oldId> → users/<newUid>/username
    const oldUsernameRef = ref(db, `usernames/${oldId}`);
    const oldUsernameSnap = await get(oldUsernameRef);

    if (oldUsernameSnap.exists()) {
        const oldName = oldUsernameSnap.val();
        await set(ref(db, `users/${newUid}/username`), oldName);
        await remove(oldUsernameRef);
        localStorage.setItem("username", oldName);
        console.log("Migrated username:", oldName);
    }

    // 2) Migrate chat membership: chatMembers/<chat>/<oldId> → chatMembers/<chat>/<newUid>
    const chatMembersRoot = ref(db, "chatMembers");
    const chatMembersSnap = await get(chatMembersRoot);

    if (chatMembersSnap.exists()) {
        const allChats = chatMembersSnap.val();
        for (const chatCode of Object.keys(allChats)) {
            const members = allChats[chatCode];
            if (members && members[oldId]) {
                await set(ref(db, `chatMembers/${chatCode}/${newUid}`), true);
                await remove(ref(db, `chatMembers/${chatCode}/${oldId}`));
                console.log(`Migrated chat membership in ${chatCode}`);
            }
        }
    }

    // Remove old local ID
    localStorage.removeItem("userId");
    console.log("Migration complete for", oldId);
}


// LOAD USER + CHATS 
async function loadSavedUser(currentUid) {
    const savedName = localStorage.getItem("username");

    if (savedName) {
        username = savedName;
        usernameEl.textContent = username;
        await set(ref(db, `users/${currentUid}/username`), username);
    } else {
        // Try to load from DB if exists
        const userRef = ref(db, `users/${currentUid}/username`);
        const snap = await get(userRef);
        if (snap.exists()) {
            username = snap.val();
            usernameEl.textContent = username;
            localStorage.setItem("username", username);
        } else {
            username = "Anonymous";
            usernameEl.textContent = username;
            await set(userRef, username);
        }
    }
}

async function loadSavedChats() {
    const upgraded = [];

    for (const chat of myChats) {
        const code = typeof chat === "string" ? chat : chat.code;

        const snap = await get(ref(db, `chats/${code}/name`));
        let name = snap.exists() ? snap.val() : null;

        if (!name) {
            name = `Chat ${code}`;
            await set(ref(db, `chats/${code}/name`), name);
        }

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
            validChats.push({ code, name });
        } else {
            console.log(`Removing deleted server: ${code}`);
            if (uid) {
                remove(ref(db, `chatMembers/${code}/${uid}`));
            }
        }
    }

    myChats = validChats;
    localStorage.setItem("myChats", JSON.stringify(myChats));

    myChatsContainer.innerHTML = "";
    myChats.forEach(chat => addChatToSidebar(chat.code, chat.name));
    updateNoServersMessage();
}


// UI EVENT LISTENERS
function attachUIListeners() {
    document.getElementById("gear").addEventListener("click", changeUsername);
    document.getElementById("publicChatBtn").addEventListener("click", () => switchChat("public"));
    document.getElementById("createChatBtn").addEventListener("click", createChat);
    document.getElementById("joinChatBtn").addEventListener("click", joinChat);

    adminBtn.addEventListener("click", () => {
        alert("Admin login is now managed by UID.\nAsk realmeuseDev to make you an admin.");
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}

// USERNAME MANAGEMENT
async function changeUsername() {
    const name = prompt("Username:");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 24 || /[.#$\[\]]/.test(cleaned)) return;

    username = cleaned;
    usernameEl.textContent = username;
    localStorage.setItem("username", username);

    if (!uid) return;

    await set(ref(db, `users/${uid}/username`), username);

    // Update presence username in all joined chats
    myChats.forEach(chat => {
        const userRef = ref(db, `chats/${chat.code}/activeUsers/${uid}`);
        set(userRef, {
            username: username,
            lastSeen: Date.now()
        });
    });
}


// ADMIN STATUS
async function checkAdminStatus() {
    if (!uid) return;

    const adminRef = ref(db, `admins/${uid}`);
    const snap = await get(adminRef);

    if (snap.exists()) {
        isAdmin = true;
        activateAdminUI();
        document.getElementById("adminPanelBtn").style.display = "block";
    } else {
        isAdmin = false;
        deactivateAdminUI();
        document.getElementById("adminPanelBtn").style.display = "none";
    }
}

function activateAdminUI() {
    usernameEl.innerHTML = `<span class="admin-badge">[ADMIN]</span><span class="admin-username">${username}</span>`;
    document.getElementById("adminPanelBtn").style.display = "block";
}

function deactivateAdminUI() {
    document.getElementById("adminPanelBtn").style.display = "none";
    usernameEl.textContent = username;
}


// CHAT SWITCHING
async function switchChat(chatId) {
    const chatRef = ref(db, `chats/${chatId}`);
    const snapshot = await get(chatRef);

    if (!snapshot.exists()) {
        alert("Server not found.");
        validateSavedChats();
        if (chatId !== "public") switchChat("public");
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
async function createChat() {
    if (myChats.length >= 5) {
        alert("Server limit reached");
        return;
    }

    const name = prompt("Enter a name for your chat:");
    if (!name) return;

    const code = Math.random().toString(36).substring(2, 8);

    await set(ref(db, `chats/${code}`), {
        name,
        createdAt: Date.now()
    });

    // Add creator as member
    if (uid) {
        await set(ref(db, `chatMembers/${code}/${uid}`), true);
    }

    addChatToSidebar(code, name);
    switchChat(code);

    push(ref(db, `chats/${code}/messages`), {
        text: `Server created. Your server code is: ${code}`,
        username: "Server Bot",
        uid: "system",
        timestamp: Date.now(),
        isAdmin: false,
        isSystem: true
    });
}

async function joinChat() {
    const code = prompt("Enter server code:");
    if (!code) return;

    if (myChats.some(c => c.code === code)) {
        switchChat(code);
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
        name = `Chat ${code}`;
        await set(ref(db, `chats/${code}/name`), name);
    }

    if (uid) {
        await set(ref(db, `chatMembers/${code}/${uid}`), true);
    }

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
    btn.textContent = name;
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

    const rows = [...myChatsContainer.children];
    const row = rows.find(r => r.dataset.chat === code);
    if (row) row.remove();

    const uid = auth.currentUser.uid;

    await remove(ref(db, `chats/${code}/activeUsers/${uid}`));
    await remove(ref(db, `chatMembers/${code}/${uid}`));

    switchChat("public");
    updateNoServersMessage();

    const membersRef = ref(db, `chatMembers/${code}`);
    const snapshot = await get(membersRef);

    if (!snapshot.exists()) {
        await remove(ref(db, `chats/${code}`));
        await remove(ref(db, `chatMembers/${code}`));
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
async function sendMessage() {
    const text = input.value.trim();
    if (!text || text.length > 500) return;
    if (!uid) return;

    messagesRef = ref(db, `chats/${currentChat}/messages`);

    await push(messagesRef, {
        text,
        username,
        uid,
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
    if (!uid) return;

    presenceUnsubs.forEach(unsub => unsub());
    presenceUnsubs = [];

    if (presenceRef) {
        const oldUserRef = child(presenceRef, uid);
        remove(oldUserRef);
    }

    presenceRef = ref(db, `chats/${chatId}/activeUsers`);
    const userRef = child(presenceRef, uid);

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


// NOTIFICATIONS
function isNearBottom() {
    const threshold = 200;
    const distance = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
    return distance < threshold;
}

function isTabActive() {
    return document.visibilityState === "visible";
}

function maybeNotify(msg, chatId) {
    if (isTabActive()) return;
    if (msg.uid === uid) return;
    if (msg.isSystem) return;

    const title = `${msg.username} sent a message`;
    const body = `on server ${chatId}`;

    new Notification(title, { body, requireInteraction: true });
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


// ADMIN PANEL (UI only for now)
document.getElementById("adminPanelBtn").addEventListener("click", () => {
    document.getElementById("adminPanel").classList.remove("hidden");
});

document.getElementsByClassName("leaveChat")[0].addEventListener("click", () => {
    document.getElementById("adminPanel").classList.add("hidden");
});


