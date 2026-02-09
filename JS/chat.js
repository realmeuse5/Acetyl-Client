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
import { db, auth, noAuthMode, initAuthMode } from "./firebase-init.js";
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

// Always use a UID
let uid = null;

function writeOptions() {
    if (noAuthMode) {
        return { auth: { uid } };
    }
    return {}; // Firebase Auth mode
}

let attachedFile = null;


// ONLOAD
window.onload = async () => {
    messagesDiv = document.getElementById("messages");
    input = document.getElementById("messageInput");
    usernameEl = document.getElementById("username");
    adminBtn = document.getElementById("adminLogin");
    myChatsContainer = document.getElementById("myChats");
    msg = document.getElementById("noServersMsg");
    const fileInput = document.getElementById("fileInput");
    const attachBtn = document.getElementById("attachBtn");
    const attachedFileLabel = document.getElementById("attachedFileLabel");

    await initAuthMode(); 

    if (noAuthMode) {
        // No-Auth Mode: generate or reuse our own UID
        uid = localStorage.getItem("fakeUid");
        if (!uid) {
            uid = crypto.randomUUID();
            localStorage.setItem("fakeUid", uid);
        }
        console.log("NO-AUTH MODE UID:", uid);
        await finishAppLoad();
    } else {
        // Firebase Auth Mode
        waitForAuthReady();
    }
};

function waitForAuthReady() {
    const unsub = auth.onAuthStateChanged(async (user) => {
        if (!user) {
            return;
        }

        uid = user.uid;
        console.log("Auth ready, UID:", uid);

        unsub();
        await finishAppLoad();
    });
}

async function finishAppLoad() {
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
}


// LOAD USER + CHATS 
async function loadSavedUser(currentUid) {
    const savedName = localStorage.getItem("username");

    if (savedName) {
        username = savedName;
        usernameEl.textContent = username;
        await set(ref(db, `users/${currentUid}/username`), username, writeOptions());
    } else {
        const userRef = ref(db, `users/${currentUid}/username`);
        const snap = await get(userRef);
        if (snap.exists()) {
            username = snap.val();
            usernameEl.textContent = username;
            localStorage.setItem("username", username);
        } else {
            username = "Anonymous";
            usernameEl.textContent = username;
            await set(userRef, username, writeOptions());
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
            await set(ref(db, `chats/${code}/name`), name, writeOptions());
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
                await remove(ref(db, `chatMembers/${code}/${uid}`), writeOptions());
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

    adminBtn.addEventListener("click", () => {alert("Admin login is now managed by UID.\nAsk realmeuseDev to make you an admin.");});

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    attachBtn.addEventListener("click", () => {fileInput.click();});

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5 MB

        if (file.size > maxSize) {
            alert("File too large (max 5 MB).");
            fileInput.value = "";
            attachedFile = null;
            attachedFileLabel.classList.add("hidden");
            return;
        }

        attachedFile = file;
        attachedFileLabel.textContent = `Attached: ${file.name}`;
        attachedFileLabel.classList.remove("hidden");
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

    await set(ref(db, `users/${uid}/username`), username, writeOptions());

    // Update presence username in all joined chats
    myChats.forEach(chat => {
        const userRef = ref(db, `chats/${chat.code}/activeUsers/${uid}`);
        set(userRef, {
            username,
            lastSeen: Date.now()
            }, writeOptions());
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

    // Create chat
    await set(ref(db, `chats/${code}`), {
        name,
        createdAt: Date.now()
    }, writeOptions());  

    // Add creator as member
    if (uid) {
        await set(ref(db, `chatMembers/${code}/${uid}`), true, writeOptions());  
    }

    addChatToSidebar(code, name);
    switchChat(code);

    // System message
    await push(ref(db, `chats/${code}/messages`), {
        text: `Server created. Your server code is: ${code}`,
        username: "Server Bot",
        uid: "system",
        timestamp: Date.now(),
        isAdmin: false,
        isSystem: true
    }, writeOptions());  
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
        await set(ref(db, `chats/${code}/name`), name, writeOptions()); 
    }

    if (uid) {
        await set(ref(db, `chatMembers/${code}/${uid}`), true, writeOptions());  
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

    // Remove from local list
    myChats = myChats.filter(c => c.code !== code);
    localStorage.setItem("myChats", JSON.stringify(myChats));

    // Remove from sidebar UI
    const rows = [...myChatsContainer.children];
    const row = rows.find(r => r.dataset.chat === code);
    if (row) row.remove();

    await remove(ref(db, `chats/${code}/activeUsers/${uid}`), writeOptions());
    await remove(ref(db, `chatMembers/${code}/${uid}`), writeOptions());

    // Switch back to public
    switchChat("public");
    updateNoServersMessage();

    // If no members remain, delete the chat entirely
    const membersRef = ref(db, `chatMembers/${code}`);
    const snapshot = await get(membersRef);

    if (!snapshot.exists()) {
        await remove(ref(db, `chats/${code}`), writeOptions());
        await remove(ref(db, `chatMembers/${code}`), writeOptions());
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
    const text = messageInput.value.trim();

    if (!text && !attachedFile) return;
    if (!uid) return;

    const messagesRef = ref(db, `chats/${currentChat}/messages`);

    let fileData = null;

    // If a file is attached, upload it
    if (attachedFile) {
        const path = `chatFiles/${currentChat}/${Date.now()}_${attachedFile.name}`;
        const fileRef = storageRef(storage, path);

        // Upload file to Firebase Storage
        await uploadBytes(fileRef, attachedFile);

        // Get public download URL
        const url = await getDownloadURL(fileRef);

        // Store metadata to save in the message
        fileData = {
            fileUrl: url,
            fileName: attachedFile.name,
            fileType: attachedFile.type || "application/octet-stream",
            fileSize: attachedFile.size,
            storagePath: path
        };
    }

    // Build message object
    const messageData = {
        text: text || null,
        username,
        uid,
        timestamp: Date.now(),
        isAdmin,
        ...fileData
    };

    await push(messagesRef, messageData, writeOptions());

    enforceMessageLimit();

    messageInput.value = "";
    attachedFile = null;
    fileInput.value = "";
    attachedFileLabel.textContent = "";
    attachedFileLabel.classList.add("hidden");
}

async function enforceMessageLimit() {
    const snapshot = await get(messagesRef);
    if (!snapshot.exists()) return;

    const messages = snapshot.val();
    const keys = Object.keys(messages).sort();

    if (keys.length > 50) {
        const excess = keys.length - 50;
        for (let i = 0; i < excess; i++) {
            const key = keys[i];
            const msg = messages[key];

            // Delete file from Storage if it exists
            if (msg.storagePath) {
                try {
                    const fileRef = storageRef(storage, msg.storagePath);
                    await deleteObject(fileRef);
                } catch (e) {
                    console.warn("Failed to delete file:", e);
                }
            }

            await remove(child(messagesRef, key), writeOptions());
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
    wrapper.appendChild(header);

    // Text Content
    if (msg.text) {
        const text = document.createElement("span");
        text.classList.add("text");
        text.textContent = msg.text;
        wrapper.appendChild(text);
    }

    // File content
    if (msg.fileUrl) {
        const fileContainer = document.createElement("div");
        fileContainer.classList.add("file-attachment");

        const isImage = msg.fileType && msg.fileType.startsWith("image/");

        if (isImage) {
            const img = document.createElement("img");
            img.src = msg.fileUrl;
            img.alt = msg.fileName || "image";
            img.classList.add("attached-image");
            fileContainer.appendChild(img);
        } else {
            const link = document.createElement("a");
            link.href = msg.fileUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = msg.fileName || "Download file";
            link.classList.add("file-link");
            fileContainer.appendChild(link);
        }

        wrapper.appendChild(fileContainer);
    }

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
        remove(oldUserRef, writeOptions());
    }

    presenceRef = ref(db, `chats/${chatId}/activeUsers`);
    const userRef = child(presenceRef, uid);

    onDisconnect(userRef).remove(writeOptions());

    set(userRef, {
        username: username,
        lastSeen: Date.now()
    }, writeOptions() );

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


