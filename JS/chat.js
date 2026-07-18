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
let lastMessage = null;
let activeUsersUnsub = null;

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
let guidelinesBtnEl;
let chatContainerEl;
let guidelinesContainerEl;
let messageBarEl
let guidelinesEl;
let feedbackFormEl;
let feedbackViewerEl;
let feedbackFormLinkEl;
let feedbackFormLink2El;
let feedbackCategoryEl;
let feedbackMessageEl;
let submitFeedbackBtnEl;
let announcementsBtnEl;

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
    guidelinesBtnEl = document.getElementById("guidelinesBtn");
    chatContainerEl = document.getElementById("chatContainer");
    guidelinesContainerEl = document.getElementById("guidelinesContainer");
    guidelinesEl = document.getElementById("guidelines");
    feedbackFormEl = document.getElementById("feedbackForm");
    feedbackViewerEl = document.getElementById("feedbackViewer");
    feedbackFormLinkEl = document.getElementById("feedbackFormLink");
    feedbackFormLink2El = document.getElementById("feedbackFormLink2");
    messageBarEl = document.getElementById("messageBar");
    feedbackCategoryEl = document.getElementById("feedbackCategory");
    feedbackMessageEl = document.getElementById("feedbackMessage");
    submitFeedbackBtnEl = document.getElementById("submitFeedbackBtn");
    announcementsBtnEl = document.getElementById("announcementsBtn");
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
    const newUser = await loadSavedUser(uid);

    await loadSavedServers();
    await validateSavedServers();

    attachUIListeners();

    if (newUser) {
        console.log("Detected new user");
        alert(
            "Welcome! Since this is your first time using Acetyl Client, " +
            "please take a moment to read the Community Guidelines. " +
            "After that, you can head to the Public server and start chatting." +
            "Note: Acetyl is designed for personal and community use. Some schools restrict chat apps, so please follow your school’s technology policies."
        );
        showGuidelines();
    } else {
        switchServer("public");
        setupNotificationListener("public");
        checkAdminStatus();
    }

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
        return false;
    }

    const userRef = ref(db, `users/${currentUid}/username`);
    const snap = await get(userRef);

    if (snap.exists()) {
        username = snap.val();
        usernameEl.textContent = username;
        localStorage.setItem("username", username);
        return false;
    }

    // Generate random username
    const num = Math.floor(1000 + Math.random() * 9000); 
    username = `user${num}`;
    usernameEl.textContent = username;

    await set(userRef, username, writeOptions());
    localStorage.setItem("username", username);
    return true;
}

async function loadSavedServers() {
    // Migration
    const oldData = localStorage.getItem("myChats");
    if (oldData) {
        try {
            const parsed = JSON.parse(oldData);
            const upgradedOld = parsed.map(chat =>
                typeof chat === "string"
                    ? { code: chat, name: `Server ${chat}` }
                    : chat
            );

            localStorage.setItem("myServers", JSON.stringify(upgradedOld));
            localStorage.removeItem("myChats");
            console.log("Migrated localStorage from myChats → myServers");

            myServers = upgradedOld;
        } catch (err) {
            console.error("Migration failed:", err);
            myServers = [];
        }
    } else {
        // No migration needed, load directly
        const data = localStorage.getItem("myServers");
        myServers = data ? JSON.parse(data) : [];
    }

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
    announcementsBtnEl.addEventListener("click", () => switchServer("announcements"));

    adminBtnEl.addEventListener("click", async () => {
        const isAdmin = await get(ref(db, `admins/${uid}`));
        if (!isAdmin.exists()) {
            alert("You are not an admin.");
            return;
        }

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

            case "/viewfeedback": 
                showFeedbackViewer();
                loadFeedback();
                break;

            default:
                alert("Invalid command.");
        }
    });

    messageInputEl.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;

        if (currentServer === "announcements") {
            if (!isAdmin) return;
            e.preventDefault();
            await postAnnouncement();
            return;
        }

        await sendMessage();
    });

    attachBtnEl.addEventListener("click", () => fileInputEl.click());

    fileInputEl.addEventListener("change", () => {
        const file = fileInputEl.files[0];
        if (!file) return;

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert("File too large (max 10 MB).");
            fileInputEl.value = "";
            attachedFile = null;
            attachedFileLabelEl.classList.add("hidden");
            return;
        }

        attachedFile = file;
        attachedFileLabelEl.textContent = `Attached: ${file.name}`;
        attachedFileLabelEl.classList.remove("hidden");
    });

    guidelinesBtnEl.addEventListener("click", () => {
        showGuidelines();
    });

    feedbackFormLinkEl.addEventListener("click", (e) => {
        e.preventDefault();
        showFeedbackForm();
    });

    feedbackFormLink2El.addEventListener("click", (e) => {
        e.preventDefault();
        showFeedbackForm();
    });

    submitFeedbackBtnEl.addEventListener("click", submitFeedback);
}


// USERNAME MANAGEMENT
async function changeUsername() {
    const name = prompt("Enter new username:");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 24 || /[.#$\[\]"]/.test(cleaned)) {
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
    if (serverId === "announcements") {
        currentServer = "announcements";
        highlightActiveServer("announcements");

        if (isAdmin) {
            messageInputEl.disabled = false;
            messageInputEl.placeholder = "Post in #announcements";
            fileInputEl.disabled = false;
        } else {
            messageInputEl.disabled = true;
            messageInputEl.placeholder = "You do not have permission to post in #announcements";
            fileInputEl.disabled = true;
        }

        if (unsubscribe) unsubscribe();

        messagesRef = ref(db, "servers/announcements/messages");
        messagesListEl.innerHTML = "";
        lastMessage = null;

        unsubscribe = onChildAdded(messagesRef, (snap) => {
            const msg = snap.val();
            displayAnnouncement(msg);
        });

        showChat();
        return;
    }

    if (activeUsersUnsub) activeUsersUnsub();

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

    document.querySelectorAll(".serverRow").forEach(row => {
        const badge = row.querySelector(".activeBadge");
        const leave = row.querySelector(".leaveServer");
        const rowCode = row.dataset.server;
        const count = parseInt(row.dataset.count || "0", 10);

        if (rowCode === serverId) {
            leave.style.display = "inline-block";
            badge.style.display = "none";
        } else {
            leave.style.display = "none";
            if (count > 0) badge.style.display = "inline-block";
            else badge.style.display = "none";
        }
    });

    messagesRef = ref(db, `servers/${serverId}/messages`);
    messagesListEl.innerHTML = "";
    lastMessage = null;

    unsubscribe = onChildAdded(messagesRef, (snap) => {
        const msg = snap.val();

        if (msg.isDM) {
            const isSender = msg.uid === uid;
            const isReceiver = msg.dmToUid === uid;

            if (!isSender && !isReceiver) {
                return; // hide DM from everyone else
            }
        }

        const isGrouped =
            !msg.isDM &&
            lastMessage &&
            lastMessage.uid === msg.uid &&
            Math.abs(msg.timestamp - lastMessage.timestamp) < 5 * 60 * 1000;
        displayMessage(msg, isGrouped);
        lastMessage = msg;
        maybeNotify(msg, serverId);
    });

    showChat();
    setupActiveUserListener(serverId);
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

    if (serverId === "announcements") {
        announcementsBtnEl.classList.add("active");
    } else {
        announcementsBtnEl.classList.remove("active");
    }
}

function updatePlaceholder(serverName) {
    messageInputEl.placeholder = `Message #${serverName}`;
}

function showChat() {
    chatContainer.style.display = "flex";
    messageBar.style.display = "flex";
    guidelinesContainer.style.display = "none";
    guidelinesBtnEl.classList.remove("active");
}

function showGuidelines() {
    guidelinesContainerEl.style.display = "block";
    chatContainerEl.style.display = "none";
    messageBarEl.style.display = "none";
    guidelinesEl.style.display = "block";
    feedbackFormEl.style.display = "none";
    feedbackViewerEl.style.display = "none";
    document.querySelectorAll(".tabBtn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".serverRow").forEach(btn => btn.classList.remove("active"));
    guidelinesBtnEl.classList.add("active");
}

function showFeedbackForm() {
    guidelinesContainerEl.style.display = "block";
    chatContainerEl.style.display = "none";
    messageBarEl.style.display = "none";
    guidelinesEl.style.display = "none";
    feedbackFormEl.style.display = "block";
    feedbackViewerEl.style.display = "none";
    document.querySelectorAll(".tabBtn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".serverRow").forEach(btn => btn.classList.remove("active"));
    guidelinesBtnEl.classList.add("active");
    feedbackMessageEl.value = "";
    feedbackCategoryEl.value = "general";
}

function showFeedbackViewer() {
    guidelinesContainerEl.style.display = "block";
    chatContainerEl.style.display = "none";
    messageBarEl.style.display = "none";
    guidelinesEl.style.display = "none";
    feedbackFormEl.style.display = "none";
    feedbackViewerEl.style.display = "block";
    document.querySelectorAll(".tabBtn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".serverRow").forEach(btn => btn.classList.remove("active"));
    guidelinesBtnEl.classList.add("active");
}

async function submitFeedback() {
    const category = feedbackCategoryEl.value;
    const message = feedbackMessageEl.value.trim();

    if (!category) {
        alert("Please select a feedback category.");
        return;
    }

    if (message.length < 5) {
        alert("Please provide more details in your feedback.");
        return;
    }

    const user = auth.currentUser;
    const feedbackRef = push(ref(db, "feedback"));
    const feedbackData = {
        uid: user.uid,
        username: usernameEl.innerText,
        category: category,
        message: message,
        timestamp: Date.now()
    };

    await set(feedbackRef, feedbackData);

    alert("Thank you! Your feedback has been submitted.");
    showGuidelines();
}

async function loadFeedback() {
    feedbackViewerEl.innerHTML = "<p>Loading feedback...</p>";
    const feedbackRef = ref(db, "feedback");
    const snapshot = await get(feedbackRef);
    if (!snapshot.exists()) {
        feedbackViewerEl.innerHTML = "<p>No feedback available.</p>";
        return;
    }

    const feedbackArray = []

    snapshot.forEach(child => {
        const data = child.val();
        feedbackArray.push({ id: child.key, ...data });
    })

    feedbackArray.sort((a, b) => b.timestamp - a.timestamp);

    let html = ""
    feedbackArray.forEach(fb => {
        const date = new Date(fb.timestamp).toLocaleString([], {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric"
        });

        html += `
            <div class="feedbackMessage">
                <div class="feedback-header">
                    <span class="feedback-category">${fb.category.toUpperCase()}</span>
                    <span class="feedback-timestamp">${date}</span>
                </div>

                <div class="feedback-body">
                    ${fb.message}
                </div>

                <div class="feedback-footer">
                    Submitted by: ${fb.username}
                </div>
            </div>
        `;
    });

    feedbackViewerEl.innerHTML = html;
}

// CREATE SERVER
async function createServer() {
    if (myServers.length >= 5) {
        alert("Server limit reached");
        return;
    }

    const name = prompt("Enter a name for your server:");
    if (!name) return;
    if (name.length > 24) { 
        alert("Server name must be under 24 characters")
        return
    }

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

    const badgeEl = document.createElement("span");
    badgeEl.classList.add("activeBadge");
    badgeEl.textContent = "0";
    badgeEl.style.display = "none";

    const leaveEl = document.createElement("span");
    leaveEl.classList.add("leaveServer");
    leaveEl.addEventListener("click", (e) => {
        e.stopPropagation();
        leaveServer(code);
    });

    buttonEl.appendChild(hashEl);
    buttonEl.appendChild(nameEl);

    rowEl.appendChild(buttonEl);
    rowEl.appendChild(leaveEl);
    rowEl.appendChild(badgeEl);
    serverListEl.appendChild(rowEl);

    rowEl.addEventListener("mouseenter", () => {
        leaveEl.style.display = "inline-block";
        badgeEl.style.display = "none";
    });

    rowEl.addEventListener("mouseleave", () => {
        leaveEl.style.display = "none";
        const count = parseInt(rowEl.dataset.count || "0", 10);

        if (code !== currentServer && count > 0) {
            badgeEl.style.display = "inline-block";
        } else {
            badgeEl.style.display = "none";
        }
    });

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

    const membersRef = ref(db, `serverMembers/${code}`);
    const membersSnap = await get(membersRef);
    const members = membersSnap.exists() ? Object.keys(membersSnap.val()) : [];
    const isLastMember = members.length === 1 && members[0] === uid;

    if (isLastMember) {
        await remove(ref(db, `servers/${code}`), writeOptions());
        await remove(ref(db, `serverMembers/${code}`), writeOptions());
    }

    await remove(ref(db, `servers/${code}/activeUsers/${uid}`), writeOptions());
    await remove(ref(db, `serverMembers/${code}/${uid}`), writeOptions());

    if (notificationUnsubs[code]) {
        notificationUnsubs[code]();
        delete notificationUnsubs[code];
    }

    switchServer("public");
    updateNoServersMessage();
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

    if (!noAuthMode && !uid) return;

    const dm = parseDM(text);

    // Validation
    if (!text && !file) return;
    if (text && text.length > 1000) return;

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

    if (dm) {
        const usersSnap = await get(ref(db, "users"));
        if (!usersSnap.exists()) {
            alert("No users found.");
            return;
        }

        let targetUid = null;

        usersSnap.forEach(child => {
            const userData = child.val();
            if (userData.username === dm.mention) {
                targetUid = child.key;
            }
        });

        if (!targetUid) {
            alert(`User @"${dm.mention}" does not exist.`);
            return;
        }

        // DM message object
        const dmMessage = {
            text: dm.messageBody || null,
            username,
            uid: uid || "no-auth",
            timestamp: Date.now(),
            isAdmin: isAdmin || false,
            isDM: true,
            dmToUid: targetUid,
            dmTo: dm.mention,
            fileUrl,
            fileName,
            fileType
        };

        await push(messagesRef, dmMessage, writeOptions());
        enforceMessageLimit();
    } else {
        // Normal message object
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

        await push(messagesRef, messageData, writeOptions());
        enforceMessageLimit();
    }

    // Reset UI
    messageInputEl.value = "";
    attachedFile = null;
    fileInputEl.value = "";
    attachedFileLabelEl.textContent = "";
    attachedFileLabelEl.classList.add("hidden");
}

function parseDM(text) {
    if (!text.startsWith('@\"')) return null;

    const closingQuote = text.indexOf('"', 2);
    if (closingQuote === -1) return null;

    const mention = text.substring(2, closingQuote).trim();
    const messageBody = text.substring(closingQuote + 1).trim();

    if (!mention || !messageBody) return null;

    return { mention, messageBody };
}

async function postAnnouncement() {
    const body = messageInputEl.value.trim();
    const file = attachedFile;

    if (!noAuthMode && !uid) return;

    if (!body && !file) return;
    if (body && body.length > 2000) return; // announcements can be longer

    let fileUrl = null;
    let fileName = null;
    let fileType = null;

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

    const title = prompt("Enter announcement title (It is always a good idea to check with @𝙍乇𝘼𝙇𝙈𝙀𝙐𝙎𝙀 before posting an announcement):");
    if (!title || !title.trim()) return;

    const announcementData = {
        title: title.trim(),
        body: body || null,
        timestamp: Date.now(),
        postedByUid: uid || "no-auth",
        postedByName: username,
        fileUrl,
        fileName,
        fileType
    };

    await push(messagesRef, announcementData, writeOptions());

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

    if (keys.length > 100) {
        const excess = keys.length - 100;
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
function displayMessage(msg, isGrouped) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message");
    if (isGrouped) wrapper.classList.add("grouped");
    if (msg.isDM) wrapper.classList.add("dm-message");

    if (!isGrouped) {
        const header = document.createElement("div");
        header.classList.add("message-header");

        const nameEl = document.createElement("span");
        nameEl.classList.add("username");

        if (msg.isDM) {
            const dmTag = document.createElement("span");
            dmTag.classList.add("dm-tag");

            if (msg.uid === uid) {
                // You sent the DM
                dmTag.textContent = `[DM to @${msg.dmTo}] `;
            } else {
                // You received the DM
                dmTag.textContent = `[DM] `;
            }

            header.prepend(dmTag);
            nameEl.classList.add("dm-username");
        }

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
    }

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

function displayAnnouncement(msg) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("message", "announcementMessage");

    const header = document.createElement("div");
    header.classList.add("message-header");

    const titleEl = document.createElement("span");
    titleEl.classList.add("announcement-title");
    titleEl.textContent = msg.title || "📢 Announcement";

    const timeEl = document.createElement("span");
    timeEl.classList.add("timestamp");
    timeEl.textContent = new Date(msg.timestamp ?? Date.now()).toLocaleString();

    header.appendChild(titleEl);
    header.appendChild(timeEl);
    wrapper.appendChild(header);

    if (msg.body) {
        const bodyEl = document.createElement("span");
        bodyEl.classList.add("announcement-body");
        bodyEl.textContent = msg.body;
        wrapper.appendChild(bodyEl);
    }

    if (msg.fileUrl) {
        const fileWrapper = document.createElement("div");
        fileWrapper.classList.add("file-message");

        if (msg.fileType && msg.fileType.startsWith("image/")) {
            // Image preview
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

function setupActiveUserListener(code) {
    if (code === "public") {
        activeUsersUnsub = null;
        return;
    }

    const activeRef = ref(db, `servers/${code}/activeUsers`);

    activeUsersUnsub = onValue(activeRef, snap => {
        let count = 0;

        snap.forEach(child => {
            if (child.key !== uid) count++;
        });

        const row = document.querySelector(`.serverRow[data-server="${code}"]`);
        if (!row) return;

        const badge = row.querySelector(".activeBadge");
        row.dataset.count = count;
        badge.textContent = count;

        if (code !== currentServer && count > 0 && !row.matches(":hover")) {
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    });
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

const notificationUnsubs = {};

function setupNotificationListener(serverId) {
    if (notificationUnsubs[serverId]) return; // Already listening

    const refMessages = ref(db, `servers/${serverId}/messages`);
    
    notificationUnsubs[serverId] = onChildAdded(refMessages, (snapshot) => {
        const msg = snapshot.val();
        maybeNotify(msg, serverId);
    });
}
