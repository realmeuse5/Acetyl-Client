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
    onDisconnect,
    onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


// CONSTANTS
const UPLOAD_URL = "https://acetyl-file-server.onrender.com/upload";

// GLOBALS
let uid = null;
let username = "";
let isAdmin = false; 
let currentServer = "public";
let messagesRef = null;
let unsubscribe = null;
let myServers = JSON.parse(localStorage.getItem("myServers") || "[]");
let attachedFile = null;

// UI ELEMENTS
let messagesListEl;
let messageInputEl;
let usernameEl;
let adminBtnEl;
let serverListEl;
let noServersMsgEl;
let fileInputEl;
let attachBtnEl;
let attachedFileLabelEl;
let publicServerBtnEl;
let createServerBtnEl;
let joinServerBtnEl;
let bannedMsgEl;
let webContainerEl;

function writeOptions() {
    return { auth: { uid } };
}


// ONLOAD
window.onload = async () => {
    messagesListEl = document.getElementById("messages");
    messageInputEl = document.getElementById("messageInput");
    usernameEl = document.getElementById("username");
    adminBtnEl = document.getElementById("adminBtn");
    serverListEl = document.getElementById("serverList");
    noServersMsgEl = document.getElementById("noServersMsg");
    fileInputEl = document.getElementById("fileInput");
    attachBtnEl = document.getElementById("attachBtn");
    publicServerBtnEl = document.getElementById("publicServerBtn");
    createServerBtnEl = document.getElementById("createServerBtn");
    joinServerBtnEl = document.getElementById("joinServerBtn");
    attachedFileLabelEl = document.getElementById("attachedFileLabel");
    bannedMsgEl = document.getElementById("banned");
    webContainerEl = document.getElementById("webContainer");

    await initAuthMode();

    if (noAuthMode) {
        uid = localStorage.getItem("fakeUid");
        if (!uid) {
            uid = crypto.randomUUID();
            localStorage.setItem("fakeUid", uid);
        }

        await finishAppLoad();
        return;
    }

    // Firebase Auth Mode
    auth.onAuthStateChanged(async (user) => {
        if (!user) return;

        uid = user.uid;
        await checkBanStatus(uid)
        await finishAppLoad();
    });
};

async function finishAppLoad() {
    await loadSavedUser(uid);
    await loadSavedServers();
    await validateSavedServers();

    attachUIListeners();
    switchServer("public");
    setupNotificationListener("public");
    checkAdminStatus();

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}


// LOAD USER + SERVERS
async function loadSavedUser(currentUid) {
    const savedName = localStorage.getItem("username");

    if (savedName) {
        username = savedName;
        usernameEl.textContent = username;
        await set(ref(db, `users/${currentUid}/username`), username, writeOptions());
        return;
    }

    const userRef = ref(db, `users/${currentUid}/username`);
    const snap = await get(userRef);

    if (snap.exists()) {
        username = snap.val();
        usernameEl.textContent = username;
        localStorage.setItem("username", username);
        return;
    }

    // Generate random username
    const num = Math.floor(1000 + Math.random() * 9000); 
    username = `user${num}`;
    usernameEl.textContent = username;

    await set(userRef, username, writeOptions());
    localStorage.setItem("username", username);
}

async function loadSavedServers() {
    const upgraded = [];

    for (const server of myServers) {
        const code = typeof server === "string" ? server : server.code;

        const snap = await get(ref(db, `servers/${code}/name`));
        let name = snap.exists() ? snap.val() : null;

        if (!name) {
            name = `Server ${code}`;
            await set(ref(db, `servers/${code}/name`), name, writeOptions());
        }

        upgraded.push({ code, name });
        addServerToSidebar(code, name);
    }

    myServers = upgraded;
    localStorage.setItem("myServers", JSON.stringify(myServers));
}

async function validateSavedServers() {
    const validServers = [];

    for (const server of myServers) {
        const { code, name } = server;
        const serverRef = ref(db, `servers/${code}`);
        const snapshot = await get(serverRef);

        if (snapshot.exists()) {
            validServers.push({ code, name });
        } else {
            console.log(`Removing deleted server: ${code}`);
            if (uid) {
                await remove(ref(db, `serverMembers/${code}/${uid}`), writeOptions());
            }
        }
    }

    myServers = validServers;
    localStorage.setItem("myServers", JSON.stringify(myServers));

    serverListEl.innerHTML = "";
    myServers.forEach(server => addServerToSidebar(server.code, server.name));
    updateNoServersMessage();
}


// UI EVENT LISTENERS
function attachUIListeners() {
    publicServerBtnEl.addEventListener("click", () => switchServer("public"));
    createServerBtnEl.addEventListener("click", createServer);
    joinServerBtnEl.addEventListener("click", joinServer);
    usernameEl.addEventListener("click", changeUsername);

    adminBtnEl.addEventListener("click", async () => {
        const command = prompt("Enter admin command:");
        if (!command) return;

        switch (command.toLowerCase()) {
            case "/ban": {
                const targetUsername = prompt("Enter username to ban:");
                if (!targetUsername) return;

                const durationHours = prompt("Ban duration (hours):");
                if (!durationHours) return;

                const reason = prompt("Reason for ban:");
                if (!reason) return;

                const usersSnap = await get(ref(db, "users"));
                const users = usersSnap.val();
                let targetUid = null;

                for (const uidKey in users) {
                    if (users[uidKey].username === targetUsername) {
                        targetUid = uidKey;
                        break;
                    }
                }

                if (!targetUid) {
                    alert("User not found.");
                    return;
                }

                const adminSnap = await get(ref(db, `admins/${targetUid}`));
                if (adminSnap.exists()) {
                    alert("You cannot ban another admin.");
                    return;
                }

                await set(ref(db, `bans/${targetUid}`), {
                    username: targetUsername,
                    reason,
                    duration: Number(durationHours) * 3600,
                    timestamp: Date.now(),
                    bannedBy: uid
                });

                alert(`User ${targetUsername} has been banned.`);
                break;
            }

            default:
                alert("Invalid command.");
        }
    });

    messageInputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    attachBtnEl.addEventListener("click", () => fileInputEl.click());

    fileInputEl.addEventListener("change", () => {
        const file = fileInputEl.files[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5 MB
        if (file.size > maxSize) {
            alert("File too large (max 5 MB).");
            fileInputEl.value = "";
            attachedFile = null;
            attachedFileLabelEl.classList.add("hidden");
            return;
        }

        attachedFile = file;
        attachedFileLabelEl.textContent = `Attached: ${file.name}`;
        attachedFileLabelEl.classList.remove("hidden");
    });
}


// USERNAME MANAGEMENT
async function changeUsername() {
    const name = prompt("Enter new username:");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 24 || /[.#$\[\]]/.test(cleaned)) {
        alert("Invalid username.");
        return;
    }

    if (cleaned === username) return;

    // Check if username is already taken
    const usersSnap = await get(ref(db, "users"));
    if (usersSnap.exists()) {
        const users = usersSnap.val();
        for (const uidKey in users) {
            if (users[uidKey].username === cleaned) {
                alert("Username already taken.");
                return;
            }
        }
    }

    // Apply new username
    username = cleaned;
    usernameEl.textContent = username;
    localStorage.setItem("username", username);

    if (!uid) return;

    await set(ref(db, `users/${uid}/username`), username, writeOptions());

    // Update presence username in all joined servers
    myServers.forEach(server => {
        const userRef = ref(db, `servers/${server.code}/activeUsers/${uid}`);
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
        adminBtnEl.style.display = "block";
    } else {
        isAdmin = false;
        adminBtnEl.style.display = "none";
    }
}


// BAN STATUS
async function checkBanStatus(userUid) {
    const banRef = ref(db, `bans/${userUid}`);

    onValue(banRef, (banSnap) => {
        if (!banSnap.exists()) {
            // Not banned
            webContainerEl.style.display = "flex";
            bannedMsgEl.style.display = "none";
            return;
        }

        const banData = banSnap.val();

        if (banData.duration && banData.timestamp) {
            const banEndTime = banData.timestamp + banData.duration * 1000; // duration stored in seconds
            const remainingMs = banEndTime - Date.now();

            if (remainingMs > 0) {
                const remainingMinutes = Math.floor(remainingMs / 60000);
                bannedMsgEl.innerHTML = `
                    You have been banned<br>
                    Reason: ${banData.reason || "unspecified"}<br>
                    Remaining time: ${remainingMinutes} minutes
                `;
                webContainerEl.style.display = "none";
                bannedMsgEl.style.display = "block";
            } else {
                // Ban expired
                remove(banRef);
                webContainerEl.style.display = "flex";
                bannedMsgEl.style.display = "none";
            }
        } else {
            // Permanent ban
            bannedMsgEl.innerHTML = `
                You have been banned<br>
                Reason: ${banData.reason || "unspecified"}
            `;
            webContainerEl.style.display = "none";
            bannedMsgEl.style.display = "block";
        }
    });
}


// SERVER SWITCHING
async function switchServer(serverId) {
    const serverRef = ref(db, `servers/${serverId}`);
    const serverSnap = await get(serverRef);

    if (!serverSnap.exists()) {
        alert("Server not found.");
        await validateSavedServers();
        if (serverId !== "public") switchServer("public");
        return;
    }

    const data = serverSnap.val();
    const serverName = data.name || serverId;

    updatePlaceholder(serverName);
    currentServer = serverId;
    setupPresence(serverId);

    highlightActiveServer(serverId);

    if (unsubscribe) unsubscribe();

    messagesRef = ref(db, `servers/${serverId}/messages`);
    messagesListEl.innerHTML = "";

    unsubscribe = onChildAdded(messagesRef, (snap) => {
        const msg = snap.val();
        displayMessage(msg);
        maybeNotify(msg, serverId);
    });
}

function highlightActiveServer(serverId) {
    document.querySelectorAll(".serverRow").forEach(row => {
        if (row.dataset.server === serverId) {
            row.classList.add("active");
        } else {
            row.classList.remove("active");
        }
    });

    if (serverId === "public") {
        publicServerBtnEl.classList.add("active");
    } else {
        publicServerBtnEl.classList.remove("active");
    }
}

function updatePlaceholder(serverName) {
    messageInputEl.placeholder = `Message #${serverName}`;
}


// CREATE SERVER
async function createServer() {
    if (myServers.length >= 5) {
        alert("Server limit reached");
        return;
    }

    const name = prompt("Enter a name for your server:");
    if (!name) return;

    const code = Math.random().toString(36).substring(2, 8);

    // Create server
    await set(ref(db, `servers/${code}`), {
        name,
        createdAt: Date.now()
    }, writeOptions());

    // Add creator as member
    if (uid) {
        await set(ref(db, `serverMembers/${code}/${uid}`), true, writeOptions());
    }

    addServerToSidebar(code, name);
    switchServer(code);

    // System message
    await push(ref(db, `servers/${code}/messages`), {
        text: `Server created. Your server code is: ${code}`,
        username: "Server Bot",
        uid: "system",
        timestamp: Date.now(),
        isAdmin: false,
        isSystem: true
    }, writeOptions());
}

// JOIN SERVER
async function joinServer() {
    const code = prompt("Enter server code:");
    if (!code) return;

    if (myServers.some(s => s.code === code)) {
        switchServer(code);
        return;
    }

    if (code === "public") {
        switchServer("public");
        return;
    }

    const serverRef = ref(db, `servers/${code}`);
    const snapshot = await get(serverRef);

    if (!snapshot.exists()) {
        alert("Server not found.");
        return;
    }

    let name = snapshot.val().name;
    if (!name) {
        name = `Server ${code}`;
        await set(ref(db, `servers/${code}/name`), name, writeOptions());
    }

    if (uid) {
        await set(ref(db, `serverMembers/${code}/${uid}`), true, writeOptions());
    }

    addServerToSidebar(code, name);
    switchServer(code);
    setupNotificationListener(code);
}

// ADD SERVER TO SIDEBAR
function addServerToSidebar(code, name) {
    if (!myServers.some(s => s.code === code)) {
        myServers.push({ code, name });
        localStorage.setItem("myServers", JSON.stringify(myServers));
    }

    const rowEl = document.createElement("div");
    rowEl.classList.add("serverRow");
    rowEl.dataset.server = code;
    rowEl.title = code;

    const buttonEl = document.createElement("button");
    buttonEl.classList.add("serverButton");
    buttonEl.dataset.server = code;
    buttonEl.addEventListener("click", () => switchServer(code));

    const hashEl = document.createElement("span");
    hashEl.classList.add("serverHash");
    hashEl.textContent = "#";

    const nameEl = document.createElement("span");
    nameEl.classList.add("serverName");
    nameEl.textContent = name;

    buttonEl.appendChild(hashEl);
    buttonEl.appendChild(nameEl);

    const leaveEl = document.createElement("span");
    leaveEl.classList.add("leaveServer");
    leaveEl.addEventListener("click", (e) => {
        e.stopPropagation();
        leaveServer(code);
    });

    rowEl.appendChild(buttonEl);
    rowEl.appendChild(leaveEl);
    serverListEl.appendChild(rowEl);

    updateNoServersMessage();
}

// LEAVE SERVER
async function leaveServer(code) {
    if (!confirm("Are you sure you want to leave this server?")) return;
    if (code === "public") {
        alert("You cannot leave the public server.");
        return;
    }

    myServers = myServers.filter(s => s.code !== code);
    localStorage.setItem("myServers", JSON.stringify(myServers));

    const row = [...serverListEl.children].find(r => r.dataset.server === code);
    if (row) row.remove();

    await remove(ref(db, `servers/${code}/activeUsers/${uid}`), writeOptions());
    await remove(ref(db, `serverMembers/${code}/${uid}`), writeOptions());

    switchServer("public");
    updateNoServersMessage();

    const membersRef = ref(db, `serverMembers/${code}`);
    const snapshot = await get(membersRef);

    if (!snapshot.exists()) {
        await remove(ref(db, `servers/${code}`), writeOptions());
        await remove(ref(db, `serverMembers/${code}`), writeOptions());
    }
}

function updateNoServersMessage() {
    if (myServers.length === 0) {
        noServersMsgEl.style.display = "block";
    } else {
        noServersMsgEl.style.display = "none";
    }
}


// FILE UPLOAD
async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData
    });

    if (!res.ok) throw new Error("Upload failed");

    const data = await res.json(); 
    const base = UPLOAD_URL.replace("/upload", "");
    return base + data.url; // full public URL
}


// MESSAGE SENDING
async function sendMessage() {
    const text = messageInputEl.value.trim();
    const file = attachedFile;

    // Validation
    if (!text && !file) return;
    if (text.length > 500) return;
    if (!noAuthMode && !uid) return;

    let fileUrl = null;
    let fileName = null;
    let fileType = null;

    // File upload
    if (file) {
        try {
            fileUrl = await uploadFile(file);
            fileName = file.name;
            fileType = file.type;
        } catch (err) {
            console.error(err);
            alert("File upload failed.");
            return;
        }
    }

    // Build message object
    const messageData = {
        text: text || null,
        username,
        uid: uid || "no-auth",
        timestamp: Date.now(),
        isAdmin: isAdmin || false,
        fileUrl,
        fileName,
        fileType
    };

    // Push to Firebase
    await push(messagesRef, messageData, writeOptions());
    enforceMessageLimit();

    // Reset UI
    messageInputEl.value = "";
    attachedFile = null;
    fileInputEl.value = "";
    attachedFileLabelEl.textContent = "";
    attachedFileLabelEl.classList.add("hidden");
}


// MESSAGE LIMIT ENFORCEMENT
async function enforceMessageLimit() {
    if (!messagesRef) return;

    const snapshot = await get(messagesRef);
    if (!snapshot.exists()) return;

    const messages = snapshot.val();
    const keys = Object.keys(messages);

    if (keys.length > 50) {
        const excess = keys.length - 50;
        const toDelete = keys.slice(0, excess);

        for (const key of toDelete) {
            const msgData = messages[key];

            // Delete file from server if attached
            if (msgData.fileUrl) {
                const filename = msgData.fileUrl.split("/").pop();
                const deleteUrl = UPLOAD_URL.replace("/upload", "") + "/delete-file?name=" + filename;

                fetch(deleteUrl, { method: "DELETE" })
                    .catch(err => console.error("File delete failed:", err));
            }

            // Delete message from Firebase
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

    const nameEl = document.createElement("span");
    nameEl.classList.add("username");

    if (msg.isSystem) {
        nameEl.textContent = msg.username;
        nameEl.classList.add("system-username");
    } else if (msg.isAdmin) {
        nameEl.innerHTML = `
            <span class="admin-username">${msg.username}</span>
            <i class="fa-solid fa-circle-check admin-badge" title="Admin"></i>
        `;
    } else {
        nameEl.textContent = msg.username;
    }

    const timeEl = document.createElement("span");
    timeEl.classList.add("timestamp");
    timeEl.textContent = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    header.appendChild(nameEl);
    header.appendChild(timeEl);
    wrapper.appendChild(header);

    // Text Content
    if (msg.text) {
        const textEl = document.createElement("span");
        textEl.classList.add("text");
        textEl.textContent = msg.text;
        wrapper.appendChild(textEl);
    }

    // File Content
    if (msg.fileUrl) {
        const fileWrapper = document.createElement("div");
        fileWrapper.classList.add("file-message");

        if (msg.fileType && msg.fileType.startsWith("image/")) {
            // Image
            const imgEl = document.createElement("img");
            imgEl.src = msg.fileUrl;
            imgEl.classList.add("server-image");

            imgEl.onerror = () => {
                imgEl.remove();
                const placeholder = document.createElement("div");
                placeholder.className = "image-placeholder";
                placeholder.textContent = "Image failed to load :(";
                fileWrapper.appendChild(placeholder);
            };

            fileWrapper.appendChild(imgEl);
        } else {
            // File box
            const fileBox = document.createElement("div");
            fileBox.classList.add("file-box");

            const iconEl = document.createElement("div");
            iconEl.classList.add("file-icon");
            iconEl.textContent = "📄";

            const filenameEl = document.createElement("span");
            filenameEl.classList.add("file-name");
            filenameEl.textContent = msg.fileName || "Download file";

            fileBox.appendChild(iconEl);
            fileBox.appendChild(filenameEl);

            fileBox.onclick = () => window.open(msg.fileUrl, "_blank");

            fileWrapper.appendChild(fileBox);
        }

        wrapper.appendChild(fileWrapper);
    }

    messagesListEl.appendChild(wrapper);

    if (isNearBottom()) {
        messagesListEl.scrollTop = messagesListEl.scrollHeight;
    }
}


// ACTIVE USERS PRESENCE
let presenceRef = null;
let presenceUnsubs = [];

function setupPresence(serverId) {
    if (!uid) return;

    presenceUnsubs.forEach(unsub => unsub());
    presenceUnsubs = [];

    if (presenceRef) {
        const oldUserRef = child(presenceRef, uid);
        remove(oldUserRef, writeOptions());
    }

    presenceRef = ref(db, `servers/${serverId}/activeUsers`);
    const userRef = child(presenceRef, uid);

    onDisconnect(userRef).remove(writeOptions());

    set(userRef, {
        username,
        lastSeen: Date.now()
    }, writeOptions());
}


// UTILITY
function isNearBottom() {
    const threshold = 200;
    const distance = messagesListEl.scrollHeight - messagesListEl.scrollTop - messagesListEl.clientHeight;
    return distance < threshold;
}

function isTabActive() {
    return document.visibilityState === "visible";
}

function maybeNotify(msg, serverId) {
    if (isTabActive()) return;
    if (msg.uid === uid) return;
    if (msg.isSystem) return;

    const title = `${msg.username} sent a message`;
    const body = `on server ${serverId}`;

    new Notification(title, { body });
}

const notificationListeners = new Set();

function setupNotificationListener(serverId) {
    if (notificationListeners.has(serverId)) return;
    notificationListeners.add(serverId);

    const refMessages = ref(db, `servers/${serverId}/messages`);

    onChildAdded(refMessages, (snapshot) => {
        const msg = snapshot.val();
        maybeNotify(msg, serverId);
    });
}
