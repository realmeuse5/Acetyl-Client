// IMPORTS
import { db, auth, noAuthMode, initAuthMode } from "./firebase-init.js";
import { 
    ref, push, onChildAdded, onChildRemoved, onChildChanged, 
    remove, get, child, set, onDisconnect, onValue,
    serverTimestamp, query, orderByChild
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
let unreadCounts = {};
let lastRead = JSON.parse(localStorage.getItem("lastRead") || "{}");
let contextMenuTargetServer = null;
let targetContextMenuMsg
let currentKickUnsub = null;
let currentVoiceServer = null;
let voiceUsersUnsub = null;
let localAudioStream = null;
let signalUnsub = null;
let isMuted = false;


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
let bannedEl;
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
let feedbackCharCountEl;
let submitFeedbackBtnEl;
let announcementsBtnEl;
let contextMenuEl;
let contextLeaveBtnEl
let contextCopyCodeBtnEl;
let rightSidebarEl;
let closeRightSidebarBtnEl;
let contextServerMembersBtnEl;
let activeMembersListEl;
let allMembersListEl;
let allMembersHeaderEl;
let contextInviteBtnEl;
let contextKickBtnEl;
let newMessage;
let messageContextMenu;
let msgContextGetUid;
let msgContextBan;
let msgContextDelete;
let msgContextKick;
let kickedMembersHeaderEl
let kickedMembersListEl
let contextJoinVoiceBtnEl
let voiceContainerEl
let voiceBackBtnEl
let voiceMuteBtnEl

function writeOptions() { return { auth: { uid } }; }


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
    bannedEl = document.getElementById("banned");
    bannedMsgEl = document.getElementById("bannedMsg");
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
    feedbackCharCountEl = document.getElementById("feedbackCharCount");
    submitFeedbackBtnEl = document.getElementById("submitFeedbackBtn");
    announcementsBtnEl = document.getElementById("announcementsBtn");
    contextMenuEl = document.getElementById("serverContextMenu");
    contextLeaveBtnEl = document.getElementById("contextLeaveServer");
    contextCopyCodeBtnEl = document.getElementById("contextCopyCode");
    rightSidebarEl = document.getElementById("rightSidebar");
    closeRightSidebarBtnEl = document.getElementById("closeRightSidebar");
    contextServerMembersBtnEl = document.getElementById("contextServerMembers");
    activeMembersListEl = document.getElementById("activeMembersList");
    allMembersListEl = document.getElementById("allMembersList");
    allMembersHeaderEl = document.getElementById("allMembersHeader");
    contextInviteBtnEl = document.getElementById("contextInvite");
    contextKickBtnEl = document.getElementById("contextKick");
    newMessage = new Audio('/client/Assets/newMessage.mp3')
    await initAuthMode();
    messageContextMenu = document.getElementById("messageContextMenu");
    msgContextGetUid = document.getElementById("msgContextGetUid");
    msgContextBan = document.getElementById("msgContextBan");
    msgContextDelete = document.getElementById("msgContextDelete");
    msgContextKick = document.getElementById("msgContextKick");
    kickedMembersHeaderEl = document.getElementById("kickedMembersHeader");
    kickedMembersListEl = document.getElementById("kickedMembersList");
    contextJoinVoiceBtnEl = document.getElementById("contextJoinVoice")
    voiceContainerEl = document.getElementById("voice-container")
    voiceBackBtnEl = document.getElementById("voiceBackBtn");
    voiceMuteBtnEl = document.getElementById("voiceMuteBtn");

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
        window.uid = user.uid;
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
            "After that, you can head to the Public server and start chatting. " +
            "Note: Acetyl is designed for personal and community use. Some schools restrict chat apps, so please follow your school’s technology policies."
        );
        await set(ref(db, `users/${uid}/username`), username, writeOptions());
        localStorage.setItem("username", username);
        showGuidelines();
    } else {
        const handledInvite = await handleInvite();
        if (!handledInvite) switchServer("public");
        setupNotificationListener("public");
        checkAdminStatus();
    }

    if (Notification.permission !== "granted") Notification.requestPermission();

    myServers.forEach(server => {
        setupNotificationListener(server.code);
    });
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
            const serverData = snapshot.val();
            const memberRef = ref(db, `servers/${code}/members/${uid}`);
            const memberSnap = await get(memberRef);

            if (!memberSnap.exists() && uid) {
                console.log(`Migrating membership for server: ${code}`);
                await set(memberRef, true, writeOptions());
                validServers.push({ code, name });
            } else if (memberSnap.exists() || (serverData && serverData.createdBy === uid)) {
                validServers.push({ code, name });
            } else {
                console.log(`User is no longer a member of server: ${code}`);
                await remove(ref(db, `servers/${code}/activeUsers/${uid}`), writeOptions());
            }
        } else {
            console.log(`Removing deleted server record: ${code}`);
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

        const command = prompt("Enter admin command:\nUse /cmds for all admin commands");
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

            case "/feedback": 
                showFeedbackViewer();
                loadFeedback();
                break;

            case "/admins": {
                const adminsSnap = await get(ref(db, "admins"));
                if (!adminsSnap.exists()) {
                    alert("No admins found.");
                    break;
                }

                const adminUids = Object.keys(adminsSnap.val());
                const usersSnap = await get(ref(db, "users"));
                const users = usersSnap.exists() ? usersSnap.val() : {};

                const adminUsernames = adminUids.map(adminUid => {
                    return users[adminUid]?.username || adminUid;
                });

                alert(`Admins:\n${adminUsernames.join("\n")}`);
                break;
            }

            case "/cmds":
                alert("Admin commands:\n/ban 🡒 ban a user\n/feedback 🡒 view feedback submitted by users\n/admins 🡒 view all admins\nMore coming soon, contact @𝙍乇𝘼𝙇𝙈𝙀𝙐𝙎𝙀 with ideas")
                break;
            default:
                alert("Invalid command.");
        }
    });

    messageInputEl.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault(); 

            if (currentServer === "announcements") {
                if (!isAdmin) return;
                await postAnnouncement();
                return;
            }

            await sendMessage();
        }
    });

    messageInputEl.addEventListener("blur", () => {
        if (!messageInputEl.innerText.trim()) messageInputEl.innerHTML = ""
    });

    messageInputEl.addEventListener("input", () => {
        if (!messageInputEl.innerText.trim()) {
            messageInputEl.innerHTML = "";
            return;
        }

        const text = messageInputEl.innerText;
        const atIndex = text.indexOf("@");
        const commaIndex = text.indexOf(",");

        if (atIndex !== -1 && commaIndex > atIndex) {
            const beforeMention = text.substring(0, atIndex);
            const mentionPart = text.substring(atIndex, commaIndex + 1);
            const restOfText = text.substring(commaIndex + 1);

            messageInputEl.innerHTML = `${beforeMention}<span class="input-mention" contenteditable="false">${mentionPart}</span>${restOfText}`;

            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(messageInputEl);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
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

    feedbackMessage.addEventListener("input", () => {
        feedbackCharCount.textContent =
            `${feedbackMessage.value.length} / 2000`;
    });

    submitFeedbackBtnEl.addEventListener("click", submitFeedback);

    document.addEventListener("click", hideContextMenu);
    document.addEventListener("scroll", hideContextMenu, true);

    if (contextLeaveBtnEl) {
        contextLeaveBtnEl.addEventListener("click", (e) => {
            e.stopPropagation(); 
            if (contextMenuTargetServer) {
                leaveServer(contextMenuTargetServer);
            }
            hideContextMenu();
        });
    }

    if (contextCopyCodeBtnEl) {
        contextCopyCodeBtnEl.addEventListener("click", async (e) => {
            e.stopPropagation();

            if (contextMenuTargetServer) {
                const codeToCopy = contextMenuTargetServer;

                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(codeToCopy);
                    } else {
                        const textarea = document.createElement("textarea");
                        textarea.value = codeToCopy;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                    }
                } catch (err) {
                    console.error("Failed to copy code: ", err);
                }
            }

            hideContextMenu(); 
        });
    }

    if (contextServerMembersBtnEl) {
        contextServerMembersBtnEl.addEventListener('click', () => {
            if (contextMenuTargetServer) {
                if (rightSidebarEl) {
                    rightSidebarEl.style.display = 'flex';
                }

                if (currentServer !== contextMenuTargetServer) {
                    switchServer(contextMenuTargetServer);
                } else {
                    setupActiveUserListener(contextMenuTargetServer);
                    loadAllMembers(contextMenuTargetServer);
                }
            }
            hideContextMenu();
        });
    }

    if (closeRightSidebarBtnEl) {
        closeRightSidebarBtnEl.addEventListener('click', () => {
            rightSidebarEl.style.display = 'none';
        });
    }

    if (contextInviteBtnEl) {
        contextInviteBtnEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (contextMenuTargetServer) {
                const inviteUrl = `${window.location.origin}/client/#${contextMenuTargetServer}`;
                alert(`Invite link:\n${inviteUrl}`);
            }
            hideContextMenu();
        });
    }

    if (contextKickBtnEl) {
        contextKickBtnEl.addEventListener("click", async (e) => {
            e.stopPropagation();

            if (contextKickBtnEl.classList.contains("disabled")) {
                e.preventDefault();
                return;
            }

            const targetServerId = contextMenuTargetServer;
            hideContextMenu();

            if (!targetServerId) {
                return;
            }

            const targetUser = prompt("Enter username to kick:");
            if (!targetUser) return;

            const targetName = targetUser.trim();

            try {
                const usersSnap = await get(ref(db, "users"));
                let targetUid = null;

                if (usersSnap.exists()) {
                    const users = usersSnap.val();
                    for (const uidKey in users) {
                        if (users[uidKey].username === targetName) {
                            targetUid = uidKey;
                            break;
                        }
                    }
                }

                if (!targetUid) {
                    alert(`User @${targetName} was not found.`);
                    return;
                }

                await toggleKickUser(targetServerId, targetUid, targetName);
            } catch (err) {
                console.error("Kick/unkick toggle failed:", err);
            }
        });
    }

    msgContextGetUid.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!targetContextMenuMsg) {
            hideContextMenu();
            return;
        }

        const targetUid = targetContextMenuMsg.uid;
        hideContextMenu();

        await navigator.clipboard.writeText(targetUid);
    });

    msgContextBan.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!targetContextMenuMsg) {
            hideContextMenu();
            return;
        }

        const { uid: targetUid, username: targetUsername } = targetContextMenuMsg;

        if (targetUid === uid) {
            alert("You cannot ban yourself.");
            hideContextMenu();
            return;
        }

        const durationHours = prompt(`Ban duration (hours):`);
        if (!durationHours) {
            hideContextMenu();
            return;
        }

        const reason = prompt(`Reason for ban:`);
        if (!reason) {
            hideContextMenu();
            return;
        }

        const adminSnap = await get(ref(db, `admins/${targetUid}`));
        if (adminSnap.exists()) {
            alert("You cannot ban another admin.");
            hideContextMenu();
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
        hideContextMenu();
    });

    msgContextDelete.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!targetContextMenuMsg || !targetContextMenuMsg.id) {
            hideContextMenu();
            return;
        }

        const targetMsg = targetContextMenuMsg;
        hideContextMenu();

        if (targetMsg.fileUrl) {
            const filename = targetMsg.fileUrl.split("/").pop();
            const deleteUrl = `${UPLOAD_URL.replace("/upload", "")}/delete-file?name=${filename}`;
            fetch(deleteUrl, { method: "DELETE" }).catch(err => console.error("File removal failed:", err));
        }

        await remove(ref(db, `servers/${currentServer}/messages/${targetMsg.id}`), writeOptions());
    });

    msgContextKick.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!targetContextMenuMsg) {
            hideContextMenu();
            return;
        }

        const targetUid = targetContextMenuMsg.uid;
        const targetUsername = targetContextMenuMsg.username;

        hideContextMenu();
        await toggleKickUser(currentServer, targetUid, targetUsername);
    });

    if (contextJoinVoiceBtnEl) {
        contextJoinVoiceBtnEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (contextMenuTargetServer) {
                joinVoiceChat(contextMenuTargetServer);
            }
            hideContextMenu();
        });
    }

    if (voiceBackBtnEl) {
        voiceBackBtnEl.addEventListener("click", () => leaveVoiceChat());
    }

    if (voiceMuteBtnEl) {
        voiceMuteBtnEl.addEventListener("click", async () => {
            if (!localAudioStream) return;

            isMuted = !isMuted;

            localAudioStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });

            const iconEl = voiceMuteBtnEl.querySelector("i");
            if (isMuted) {
                iconEl.className = "fa-solid fa-microphone-slash";
                voiceMuteBtnEl.classList.add("muted");
                voiceMuteBtnEl.title = 'Unmute'
            } else {
                iconEl.className = "fa-solid fa-microphone";
                voiceMuteBtnEl.classList.remove("muted");
                voiceMuteBtnEl.title = 'Mute'
            }

            if (currentVoiceServer && uid) {
                const voiceUserRef = ref(db, `servers/${currentVoiceServer}/voice/${uid}`);
                await set(voiceUserRef, {
                    username: username || "Anonymous",
                    joinedAt: serverTimestamp(),
                    isMuted: isMuted
                });
            }
        });
    }
}


// USERNAME MANAGEMENT
async function changeUsername() {
    const name = prompt("Enter new username:");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 24 || /[.#$\[\]",]/.test(cleaned)) {
        alert("Invalid username.");
        return;
    }

    if (cleaned === username) return;

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

    username = cleaned;
    usernameEl.textContent = username;
    localStorage.setItem("username", username);

    if (!uid) return;

    await set(ref(db, `users/${uid}/username`), username, writeOptions());

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
            bannedEl.style.display = "none";
            return;
        }

        const banData = banSnap.val();

        if (banData.duration && banData.timestamp) {
            const banEndTime = banData.timestamp + banData.duration * 1000; // duration stored in seconds
            const remainingMs = banEndTime - Date.now();

            if (remainingMs > 0) {
                const remainingMinutes = Math.floor(remainingMs / 60000);
                bannedMsgEl.innerHTML = `
                    Due to community guideline violations, you have been banned by an admin.<br>
                    Reason: <span>${banData.reason || "unspecified"}</span><br>
                    Remaining time: <span>${remainingMinutes} minutes</span><br>
                    If you believe this is a mistake or want to appeal, please contact us at <span>support@acetyl.cc</span>
                `;
                webContainerEl.style.display = "none";
                bannedEl.style.display = "block";
            } else {
                // Ban expired
                remove(banRef);
                webContainerEl.style.display = "flex";
                bannedEl.style.display = "none";
            }
        } else {
            // Permanent ban
            bannedMsgEl.innerHTML = `
                You have been permanently banned and have lost access to Acetyl Client.<br>
                Reason: ${banData.reason || "unspecified"}
            `;
            webContainerEl.style.display = "none";
            bannedEl.style.display = "block";
        }
    });
}

// KICKING USERS
async function toggleKickUser(serverId, targetUid, targetUsername) {
    if (serverId === "public" || serverId === "announcements") {
        alert("You cannot kick users from public or announcements servers.");
        return;
    }

    const serverSnap = await get(ref(db, `servers/${serverId}`));
    if (!serverSnap.exists()) {
        alert("Server not found.");
        return;
    }
    const serverData = serverSnap.val();

    const isOwner = serverData.createdBy === uid;
    if (!isOwner && !isAdmin) {
        alert("Only the server owner or an admin can kick users.");
        return;
    }

    if (targetUid === uid) {
        alert("You cannot kick yourself. Use 'Leave Server' instead.");
        return;
    }

    const targetAdminSnap = await get(ref(db, `admins/${targetUid}`));
    if (targetAdminSnap.exists()) {
        alert("You cannot kick an admin.");
        return;
    }

    const kickedRef = ref(db, `servers/${serverId}/kicked/${targetUid}`);
    const kickedSnap = await get(kickedRef);

    if (kickedSnap.exists()) {
        const confirmUnkick = confirm(`User @${targetUsername} is currently kicked. Do you want to unkick them?`);
        if (!confirmUnkick) return;

        await remove(kickedRef, writeOptions());
        alert(`User @${targetUsername} has been unkicked from the server.`);
    } else {
        await set(kickedRef, {
            username: targetUsername,
            kickedBy: uid,
            timestamp: Date.now()
        }, writeOptions());

        await remove(ref(db, `servers/${serverId}/members/${targetUid}`), writeOptions());
        await remove(ref(db, `servers/${serverId}/activeUsers/${targetUid}`), writeOptions());

        alert(`User @${targetUsername} has been kicked from the server.`);
    }

    if (rightSidebarEl && getComputedStyle(rightSidebarEl).display !== "none") {
        loadAllMembers(serverId);
    }
}


// SERVER SWITCHING
async function switchServer(serverId) {
    if (serverId === "announcements") {
        currentServer = "announcements";
        highlightActiveServer("announcements");

        if (isAdmin) {
            messageInputEl.disabled = false;
            messageInputEl.setAttribute("data-placeholder", "Post in #announcements");
            fileInputEl.disabled = false;
        } else {
            messageInputEl.disabled = true;
            messageInputEl.setAttribute("data-placeholder", "You do not have permission to post in #announcements");
            fileInputEl.disabled = true;
        }

        if (unsubscribe) unsubscribe();

        messagesRef = ref(db, "servers/announcements/messages");
        
        const announcementsQuery = query(messagesRef, orderByChild("timestamp"));
        
        messagesListEl.innerHTML = "";
        lastMessage = null;

        unsubscribe = onChildAdded(announcementsQuery, (snap) => {
            const msg = snap.val();
            displayAnnouncement(msg);
        });

        showChat();
        return;
    }

    if (activeUsersUnsub) activeUsersUnsub();

    if (currentKickUnsub) {
        currentKickUnsub();
        currentKickUnsub = null;
    }

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

    if (serverId !== "public" && serverId !== "announcements") {
        const myKickRef = ref(db, `servers/${serverId}/kicked/${uid}`);
        currentKickUnsub = onValue(myKickRef, (snap) => {
            if (snap.exists()) {
                alert("You have been kicked from this server.");

                if (currentKickUnsub) {
                    currentKickUnsub();
                    currentKickUnsub = null;
                }

                myServers = myServers.filter(s => s.code !== serverId);
                localStorage.setItem("myServers", JSON.stringify(myServers));

                const row = [...serverListEl.children].find(r => r.dataset.server === serverId);
                if (row) row.remove();

                switchServer("public");
            }
        });
    }

    setupPresence(serverId);
    highlightActiveServer(serverId);
    if (unsubscribe) unsubscribe();

    unreadCounts[serverId] = 0;
    const activeRow = document.querySelector(`.serverRow[data-server="${serverId}"]`);
    if (activeRow) {
        const badge = activeRow.querySelector(".unreadBadge");
        if (badge) {
            badge.textContent = "0";
            badge.style.display = "none";
        }
    }

    messagesRef = ref(db, `servers/${serverId}/messages`);
    
    const messagesQuery = query(messagesRef, orderByChild("timestamp"));
    
    messagesListEl.innerHTML = "";
    lastMessage = null;

    unsubscribe = onChildAdded(messagesQuery, (snap) => {
        const msg = { id: snap.key, ...snap.val() };

        if (msg.isDM) {
            const isSender = msg.uid === uid;
            const isReceiver = msg.dmToUid === uid;

            if (!isSender && !isReceiver) {
                return; 
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

    onChildRemoved(messagesQuery, (snap) => {
        const deletedId = snap.key;
        const msgEl = messagesListEl.querySelector(`[data-id="${deletedId}"]`);
        if (msgEl) {
            msgEl.remove();
        }
    });

    if (currentVoiceServer === serverId) {
        joinVoiceChat(serverId);
    } else {
        showChat();
    }

    setupActiveUserListener(serverId);
    if (rightSidebarEl && getComputedStyle(rightSidebarEl).display !== "none") {
        loadAllMembers(serverId);
    }
    markServerAsRead(serverId);
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
    messageInputEl.setAttribute("data-placeholder", `Message #${serverName}`);
}

function showChat() {
    chatContainerEl.style.display = "flex";
    messageBarEl.style.display = "flex";
    guidelinesContainerEl.classList.add("hidden");
    guidelinesContainerEl.style.display = "none";
    voiceContainerEl.classList.add("hidden");
    guidelinesBtnEl.classList.remove("active");
}

function showGuidelines() {
    guidelinesContainerEl.classList.remove("hidden");
    guidelinesContainerEl.style.display = "block";
    chatContainerEl.style.display = "none";
    messageBarEl.style.display = "none";
    guidelinesEl.style.display = "block";
    feedbackFormEl.style.display = "none";
    feedbackViewerEl.style.display = "none";
    document.querySelectorAll(".tabBtn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".serverRow").forEach(btn => btn.classList.remove("active"));
    guidelinesBtnEl.classList.add("active");
    voiceContainerEl.classList.add("hidden");
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
    voiceContainerEl.classList.add("hidden");
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
    voiceContainerEl.classList.add("hidden");
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
                <div class="feedback-body">${fb.message}</div>
                <div class="feedback-footer">Submitted by: ${fb.username}</div>
            </div>
        `;
    });

    feedbackViewerEl.innerHTML = html;
}

function markServerAsRead(serverId) {
    unreadCounts[serverId] = 0;
    lastRead[serverId] = Date.now();
    localStorage.setItem("lastRead", JSON.stringify(lastRead));

    const activeRow = document.querySelector(`.serverRow[data-server="${serverId}"]`);
    if (activeRow) {
        const badge = activeRow.querySelector(".unreadBadge");
        if (badge) {
            badge.textContent = "0";
            badge.style.display = "none";
        }
    }
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

    await set(ref(db, `servers/${code}`), {
        name,
        createdBy: uid,
        createdAt: Date.now()
    }, writeOptions());

    if (uid) {
        await set(ref(db, `servers/${code}/members/${uid}`), true, writeOptions());
    }

    addServerToSidebar(code, name);
    switchServer(code);

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

    const kickSnap = await get(ref(db, `servers/${code}/kicked/${uid}`));
    if (kickSnap.exists()) {
        alert("You have been kicked from this server.");
        return;
    }

    const serverRef = ref(db, `servers/${code}`);
    const snapshot = await get(serverRef);

    if (!snapshot.exists()) {
        alert("Server not found.");
        return;
    }

    let name = snapshot.val().name || `Server ${code}`;
    await set(ref(db, `servers/${code}/members/${uid}`), true, writeOptions());

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

    if (!(code in unreadCounts)) {
        unreadCounts[code] = 0;
    }

    const rowEl = document.createElement("div");
    rowEl.classList.add("serverRow");
    rowEl.dataset.server = code;
    rowEl.title = code;

    const buttonEl = document.createElement("button");
    buttonEl.classList.add("serverButton");
    buttonEl.dataset.server = code;
    buttonEl.addEventListener("click", () => switchServer(code));

    rowEl.addEventListener("contextmenu", (e) => showServerContextMenu(e, code));
    buttonEl.addEventListener("contextmenu", (e) => showServerContextMenu(e, code));

    const hashEl = document.createElement("span");
    hashEl.classList.add("serverHash");
    if (code === currentVoiceServer) {
        hashEl.innerHTML = `<i class="fa-solid fa-volume"></i>`;
    } else {
        hashEl.textContent = "#";
    }

    const nameEl = document.createElement("span");
    nameEl.classList.add("serverName");
    nameEl.textContent = name;

    const badgeEl = document.createElement("span");
    badgeEl.classList.add("unreadBadge");
    badgeEl.textContent = "0";
    badgeEl.style.display = "none";

    buttonEl.appendChild(hashEl);
    buttonEl.appendChild(nameEl);

    rowEl.appendChild(buttonEl);
    rowEl.appendChild(badgeEl);
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

    const membersRef = ref(db, `servers/${code}/members`);
    const membersSnap = await get(membersRef);
    const members = membersSnap.exists() ? Object.keys(membersSnap.val()) : [];
    const isLastMember = members.length === 0 || (members.length === 1 && members[0] === uid);

    if (isLastMember) {
        await remove(ref(db, `servers/${code}`), writeOptions());
    } else {
        await remove(ref(db, `servers/${code}/activeUsers/${uid}`), writeOptions());
        await remove(ref(db, `servers/${code}/members/${uid}`), writeOptions());
    }

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


// KICK FROM SERVER
async function updateKickButton(serverCode) {
    if (!contextKickBtnEl) return;

    if (serverCode === "public" || serverCode === "announcements") {
        contextKickBtnEl.classList.add("disabled");
        return;
    }

    try {
        const serverSnap = await get(ref(db, `servers/${serverCode}`));
        const serverData = serverSnap.exists() ? serverSnap.val() : null;
        const isOwner = serverData && serverData.createdBy === uid;
        const canKick = isOwner || isAdmin;

        if (canKick) {
            contextKickBtnEl.classList.remove("disabled");
        } else {
            contextKickBtnEl.classList.add("disabled");
            contextKickBtnEl.title = "Only the server owner or an admin can kick users";
        }
    } catch (err) {
        contextKickBtnEl.classList.add("disabled");
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
    const text = messageInputEl.innerText.trim();
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
            alert(`User @${dm.mention} does not exist.`);
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
            timestamp: serverTimestamp(),
            isAdmin: isAdmin || false,
            fileUrl,
            fileName,
            fileType
        };

        await push(messagesRef, messageData, writeOptions());
        enforceMessageLimit();
    }

    // Reset UI
    messageInputEl.innerHTML = "";
    attachedFile = null;
    fileInputEl.value = "";
    attachedFileLabelEl.textContent = "";
    attachedFileLabelEl.classList.add("hidden");
}

function parseDM(text) {
    if (!text.startsWith("@")) return null;

    const commaIndex = text.indexOf(",");

    if (commaIndex === -1) return null; 

    const mention = text.substring(1, commaIndex).trim();
    const messageBody = text.substring(commaIndex + 1).trim();

    if (!mention || !messageBody) return null;
    return { mention, messageBody };
}

async function postAnnouncement() {
    const body = messageInputEl.innerText.trim();
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

    messageInputEl.innerHTML = "";
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
    if (msg.id) wrapper.dataset.id = msg.id;
    if (isGrouped) wrapper.classList.add("grouped");
    if (msg.isDM) wrapper.classList.add("dm-message");

    wrapper.addEventListener("contextmenu", (e) => {
        if (isAdmin) {
            showMessageContextMenu(e, msg);
        }
    });

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
                dmTag.textContent = `[DM to ${msg.dmTo}] `;
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

        if (!msg.isSystem) {
            nameEl.style.cursor = "pointer";
            nameEl.title = "Click to DM this user";

            nameEl.addEventListener("click", () => {
                if (msg.username === username) return;

                messageInputEl.innerHTML = `<span class="input-mention" contenteditable="false">@${msg.username},</span>&nbsp;`;
                messageInputEl.focus();
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(messageInputEl);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            });
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
        textEl.innerHTML = formatMessage(msg.text);
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
    timeEl.textContent = new Date(msg.timestamp ?? Date.now()).toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short"
    });

    header.appendChild(titleEl);
    header.appendChild(timeEl);
    wrapper.appendChild(header);

    if (msg.body) {
        const bodyEl = document.createElement("span");
        bodyEl.classList.add("announcement-body");
        bodyEl.innerHTML = formatMessage(msg.body);
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

function formatMessage(text) {
    if (!text) return;

    const urlRegex = /(https?:\/\/[^\s<]+)/g;

    return text.replace(urlRegex, (url) => {
        const cleanUrl = url.replace(/[.,;!?]+$/, "");
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="chat-link">${cleanUrl}</a>`;
    });
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
    if (activeUsersUnsub) {
        activeUsersUnsub();
        activeUsersUnsub = null;
    }

    if (!activeMembersListEl) return;
    activeMembersListEl.innerHTML = "";

    const activeRef = ref(db, `servers/${code}/activeUsers`);

    activeUsersUnsub = onValue(activeRef, (snap) => {
        activeMembersListEl.innerHTML = "";

        if (!snap.exists()) {
            activeMembersListEl.innerHTML = "<li>No active users</li>";
            return;
        }

        snap.forEach((childSnap) => {
            const userData = childSnap.val();
            const li = document.createElement("li");
            li.textContent = userData.username;
            activeMembersListEl.appendChild(li);
        });
    });
}

async function loadAllMembers(code) {
    if (!allMembersListEl || !kickedMembersListEl) return;

    const isPublic = (code === "public" || code === "announcements");

    if (allMembersHeaderEl) {
        allMembersHeaderEl.style.display = isPublic ? "none" : "block";
    }
    if (kickedMembersHeaderEl) {
        kickedMembersHeaderEl.style.display = isPublic ? "none" : "block";
    }

    allMembersListEl.style.display = isPublic ? "none" : "block";
    kickedMembersListEl.style.display = isPublic ? "none" : "block";

    if (isPublic) {
        allMembersListEl.innerHTML = "";
        kickedMembersListEl.innerHTML = "";
        return;
    }

    allMembersListEl.innerHTML = "<li>Loading members...</li>";
    kickedMembersListEl.innerHTML = "";

    try {
        const [membersSnap, kickedSnap, serverSnap] = await Promise.all([
            get(ref(db, `servers/${code}/members`)),
            get(ref(db, `servers/${code}/kicked`)),
            get(ref(db, `servers/${code}`))
        ]);

        allMembersListEl.innerHTML = "";

        const serverData = serverSnap.exists() ? serverSnap.val() : null;
        const isOwner = serverData && serverData.createdBy === uid;
        const canManageKicks = isOwner || isAdmin;

        if (membersSnap.exists()) {
            const memberUids = Object.keys(membersSnap.val());

            for (const memberUid of memberUids) {
                const userSnap = await get(ref(db, `users/${memberUid}/username`));

                if (!userSnap.exists()) {
                    await remove(ref(db, `servers/${code}/members/${memberUid}`), writeOptions());
                    continue;
                }

                const li = document.createElement("li");
                li.textContent = userSnap.val();
                allMembersListEl.appendChild(li);
            }
        }

        if (allMembersListEl.children.length === 0) {
            allMembersListEl.innerHTML = "<li>No members found</li>";
        }

        if (kickedSnap.exists()) {
            if (kickedMembersHeaderEl) kickedMembersHeaderEl.style.display = "block";
            kickedMembersListEl.style.display = "block";

            kickedSnap.forEach((childSnap) => {
                const kickedData = childSnap.val();
                const targetUid = childSnap.key;
                const targetUsername = kickedData.username || targetUid;

                const li = document.createElement("li");
                li.textContent = targetUsername;
                li.style.color = "#e57573";

                if (canManageKicks) {
                    li.style.cursor = "pointer";
                    li.title = "Click to unkick user";
                    li.addEventListener("click", async () => {
                        await toggleKickUser(code, targetUid, targetUsername);
                    });
                }

                kickedMembersListEl.appendChild(li);
            });
        } else {
            if (kickedMembersHeaderEl) kickedMembersHeaderEl.style.display = "none";
            kickedMembersListEl.style.display = "none";
        }

    } catch (err) {
        console.error("Failed to load members:", err);
        allMembersListEl.innerHTML = "<li>Error loading members</li>";
    }
}


// VOICECHAT
const peerConnections = {};
const iceCandidateQueues = {};
const processedCandidates = {}; 
const activeAnalysers = {};

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { 
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        { 
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        { 
            urls: "turns:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],
    iceCandidatePoolSize: 10
};

async function joinVoiceChat(serverCode) {
    if (!uid) {
        uid = auth?.currentUser?.uid || window.uid;
    }
    
    if (!uid) {
        console.error("[VoiceChat] Cannot join voice chat: UID is undefined.");
        return;
    }

    try {
        const voiceSnapshot = await get(ref(db, `servers/${serverCode}/voice`));
        if (voiceSnapshot.exists()) {
            const users = voiceSnapshot.val();
            const userCount = Object.keys(users).length;
            if (!users[uid] && userCount >= 6) {
                alert("This voice channel is full (maximum 6 people).");
                return;
            }
        }
    } catch (err) {
        console.error("Error checking voice channel participant limit:", err);
    }

    if (currentVoiceServer && currentVoiceServer !== serverCode) {
        await leaveVoiceChat(currentVoiceServer, uid);
    }

    const audioSuccess = await initLocalAudio();
    if (!audioSuccess) return;

    currentVoiceServer = serverCode;
    updateServerVoiceIcons();

    try {
        await remove(ref(db, `servers/${serverCode}/signal/${uid}`));
    } catch (err) {
        console.warn("[VoiceChat] Signal inbox clear warning:", err);
    }

    if (chatContainerEl) chatContainerEl.style.display = "none";
    if (messageBarEl) messageBarEl.style.display = "none";
    if (guidelinesContainerEl) guidelinesContainerEl.style.display = "none";
    if (voiceContainerEl) voiceContainerEl.classList.remove("hidden");

    const voiceUserRef = ref(db, `servers/${serverCode}/voice/${uid}`);
    if (typeof onDisconnect === "function") {
        onDisconnect(voiceUserRef).remove().catch(() => {});
    }

    await set(voiceUserRef, {
        username: username || "Anonymous",
        joinedAt: serverTimestamp(),
        isMuted: false
    });
    setupSpeakingIndicator(localAudioStream, uid);

    listenToVoiceUsers(serverCode);
}

async function leaveVoiceChat(serverCode, myUid) {
    if (typeof serverCode !== "string") {
        serverCode = currentVoiceServer;
    }
    if (typeof myUid !== "string") {
        myUid = uid;
    }

    const activeServer = serverCode || currentVoiceServer;
    const activeUid = myUid || uid;

    if (voiceUsersUnsub) {
        voiceUsersUnsub();
        voiceUsersUnsub = null;
    }

    Object.keys(peerConnections).forEach((remoteUid) => {
        cleanupPeerConnection(remoteUid);
    });

    if (localAudioStream) {
        localAudioStream.getTracks().forEach((track) => track.stop());
        localAudioStream = null;
    }

    if (activeServer && activeUid) {
        try {
            await remove(ref(db, `servers/${activeServer}/voice/${activeUid}`));
            await remove(ref(db, `servers/${activeServer}/signal/${activeUid}`));
        } catch (err) {
            console.error("Error clearing signaling data from Firebase:", err);
        }
    }

    currentVoiceServer = null;
    updateServerVoiceIcons();

    if (voiceContainerEl) voiceContainerEl.classList.add("hidden");
    if (currentServer) {
        showChat();
    }
}

async function initLocalAudio() {
    try {
        localAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        return true;
    } catch (err) {
        console.error("Microphone access denied or unavailable:", err);
        alert("Could not access microphone.");
        return false;
    }
}

function listenToVoiceUsers(serverCode) {
    if (voiceUsersUnsub) voiceUsersUnsub();

    const voiceRef = ref(db, `servers/${serverCode}/voice`);

    voiceUsersUnsub = onValue(voiceRef, (snapshot) => {
        const gridEl = document.querySelector(".voice-grid");
        if (!gridEl) return;

        gridEl.innerHTML = "";
        if (!snapshot.exists()) return;

        const users = snapshot.val();
        const activeUids = Object.keys(users);

        Object.keys(peerConnections).forEach((remoteUid) => {
            if (!activeUids.includes(remoteUid)) {
                cleanupPeerConnection(remoteUid);
            }
        });

        activeUids.forEach((userUid) => {
            const userData = users[userUid];
            const isSelf = userUid === uid;

            if (!isSelf && !peerConnections[userUid]) {
                const isInitiator = uid < userUid;
                createPeerConnection(userUid, isInitiator, serverCode);
            }

            const displayName = userData.username || "Anonymous";

            const card = document.createElement("div");
            card.className = "voice-card";
            card.id = `voice-card-${userUid}`;
            card.innerHTML = `
                <div class="username">${displayName}${isSelf ? " (You)" : ""}</div>
            `;

            gridEl.appendChild(card);
        });
    });
}

function createPeerConnection(remoteUid, isInitiator, serverCode) {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[remoteUid] = pc;

    if (localAudioStream) {
        localAudioStream.getTracks().forEach((track) => {
            pc.addTrack(track, localAudioStream);
        });
    }

    pc.ontrack = (event) => {
        let audioEl = document.getElementById(`audio-${remoteUid}`);
        if (!audioEl) {
            audioEl = document.createElement("audio");
            audioEl.id = `audio-${remoteUid}`;
            audioEl.autoplay = true;
            audioEl.playsInline = true; 
            document.body.appendChild(audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch((err) => console.warn("Autoplay blocked:", err));

        setupSpeakingIndicator(event.streams[0], remoteUid);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const candidateRef = ref(db, `servers/${serverCode}/signal/${remoteUid}/${uid}/candidates`);
            push(candidateRef, {
                candidate: event.candidate.toJSON(),
                fromUid: uid
            });
        }
    };

    listenForSignals(serverCode, remoteUid, pc);

    if (isInitiator) {
        pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
                const offerRef = ref(db, `servers/${serverCode}/signal/${remoteUid}/${uid}/offers`);
                push(offerRef, {
                    sdp: pc.localDescription.sdp,
                    type: pc.localDescription.type,
                    fromUid: uid
                });
            })
            .catch((err) => console.error("Error creating offer:", err));
    }

    return pc;
}

function listenForSignals(serverCode, remoteUid, pc) {
    const candidatesRef = ref(db, `servers/${serverCode}/signal/${uid}/${remoteUid}/candidates`);
    const candUnsub = onChildAdded(candidatesRef, async (snapshot) => {
        if (pc.signalingState === "closed") return;
        
        const candidateData = snapshot.val();
        if (candidateData) {
            const cand = candidateData.candidate;
            if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {
                    console.warn("[WebRTC] Candidate error:", err);
                }
            } else {
                if (!iceCandidateQueues[remoteUid]) iceCandidateQueues[remoteUid] = [];
                iceCandidateQueues[remoteUid].push(cand);
            }
        }
    });

    const offerRef = ref(db, `servers/${serverCode}/signal/${uid}/${remoteUid}/offers`);
    const offerUnsub = onChildAdded(offerRef, async (snapshot) => {
        if (pc.signalingState === "closed") return;

        const offerData = snapshot.val();
        if (offerData) {
            if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") return;
            if (pc.currentRemoteDescription) return;

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offerData));
                await processQueuedCandidates(pc, remoteUid);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                const answerRef = ref(db, `servers/${serverCode}/signal/${remoteUid}/${uid}/answers`);
                push(answerRef, {
                    sdp: pc.localDescription.sdp,
                    type: pc.localDescription.type,
                    fromUid: uid
                });
            } catch (err) {
                console.warn("[WebRTC] Offer processing error:", err);
            }
        }
    });

    const answerRef = ref(db, `servers/${serverCode}/signal/${uid}/${remoteUid}/answers`);
    const answerUnsub = onChildAdded(answerRef, async (snapshot) => {
        if (pc.signalingState === "closed") return;

        const answerData = snapshot.val();
        if (answerData) {
            if (pc.signalingState !== "have-local-offer") return;

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answerData));
                await processQueuedCandidates(pc, remoteUid);
            } catch (err) {
                console.warn("[WebRTC] Answer processing error:", err);
            }
        }
    });

    pc._signalUnsubs = [candUnsub, offerUnsub, answerUnsub];
}

async function processQueuedCandidates(pc, senderUid) {
    if (pc.signalingState === "closed") return;

    if (iceCandidateQueues[senderUid] && iceCandidateQueues[senderUid].length > 0) {
        while (iceCandidateQueues[senderUid].length > 0) {
            const candObj = iceCandidateQueues[senderUid].shift();
            try {
                if (pc.signalingState !== "closed") {
                    await pc.addIceCandidate(new RTCIceCandidate(candObj));
                }
            } catch (err) {
                console.warn("[WebRTC] Queued candidate error:", err);
            }
        }
    }
}

function cleanupPeerConnection(targetUid) {
    if (peerConnections[targetUid]) {
        const pc = peerConnections[targetUid];
        
        if (pc._signalUnsubs) {
            pc._signalUnsubs.forEach(unsub => {
                if (typeof unsub === "function") unsub();
            });
        }

        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
        delete peerConnections[targetUid];
    }
    delete iceCandidateQueues[targetUid];
    delete processedCandidates[targetUid];
    
    delete activeAnalysers[targetUid];

    const audioEl = document.getElementById(`audio-${targetUid}`);
    if (audioEl) audioEl.remove();
}

function updateServerVoiceIcons() {
    const serverRows = serverListEl.querySelectorAll(".serverRow");
    serverRows.forEach(row => {
        const code = row.dataset.server;
        const hashEl = row.querySelector(".serverButton .serverHash") || row.querySelector(".serverButton span:first-child");
        if (!hashEl) return;

        if (code === currentVoiceServer) {
            hashEl.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
        } else {
            hashEl.textContent = "#";
        }
    });
}

function setupSpeakingIndicator(stream, userUid) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        activeAnalysers[userUid] = { 
            analyser, 
            dataArray: new Uint8Array(analyser.frequencyBinCount) 
        };
    } catch (err) {
        console.warn("Web Audio API setup failed:", err);
    }
}

function updateSpeakingIndicators() {
    requestAnimationFrame(updateSpeakingIndicators);

    for (const [userUid, data] of Object.entries(activeAnalysers)) {
        const { analyser, dataArray } = data;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        let average = sum / dataArray.length; // Range: 0 - 255
        
        const card = document.getElementById(`voice-card-${userUid}`);
        if (card) {
            if (average > 15) {
                card.classList.add("speaking");
            } else {
                card.classList.remove("speaking");
            }
        }
    }
}

requestAnimationFrame(updateSpeakingIndicators);


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
    if (msg.uid === uid) return;
    if (msg.isSystem) return;
    if (msg.isDM && msg.dmToUid !== uid && msg.uid !== uid) return;

    if (isTabActive() && serverId === currentServer) return;

    if (newMessage) {
        newMessage.currentTime = 0;
        newMessage.play().catch(err => {
            console.warn("Autoplay blocked sound until first user interaction:", err);
        });
    }

    if (!isTabActive() && Notification.permission === "granted") {
        let serverName = serverId;
        if (serverId === "public") serverName = "public";
        else if (serverId === "announcements") serverName = "announcements";
        else {
            const found = myServers.find(s => s.code === serverId);
            if (found) serverName = found.name;
        }

        const title = `${msg.username} sent a message`;
        const body = `on #${serverName}`;

        new Notification(title, { body });
    }
}

const notificationUnsubs = {};
const appStartTime = Date.now();

function setupNotificationListener(serverId) {
    if (notificationUnsubs[serverId]) return;

    const refMessages = ref(db, `servers/${serverId}/messages`);
    let isInitialNotificationLoad = true;
    
    notificationUnsubs[serverId] = onChildAdded(refMessages, (snapshot) => {
        const msg = snapshot.val();
        if (!msg || !msg.timestamp) return;

        const serverLastRead = lastRead[serverId] || 0;

        if (msg.timestamp <= serverLastRead) return;

        if (serverId !== currentServer && msg.uid !== uid && !msg.isSystem) {
            if (msg.isDM && msg.dmToUid !== uid) return;

            unreadCounts[serverId] = (unreadCounts[serverId] || 0) + 1;

            const row = document.querySelector(`.serverRow[data-server="${serverId}"]`);
            if (row) {
                const badge = row.querySelector(".unreadBadge");
                if (badge) {
                    badge.textContent = unreadCounts[serverId];
                    badge.style.display = "inline-block";
                }
            }

            if (!isInitialNotificationLoad) {
                maybeNotify(msg, serverId);
            }
        }
    });

    onValue(refMessages, () => {
        isInitialNotificationLoad = false;
    }, { onlyOnce: true });
}

function showServerContextMenu(e, serverCode) {
    e.preventDefault(); 
    e.stopPropagation();

    if (serverCode === "public" || serverCode === "announcements") return;

    contextMenuTargetServer = serverCode;
    updateKickButton(serverCode);
    contextMenuEl.classList.remove("hidden");

    const menuHeight = contextMenuEl.offsetHeight;
    const menuWidth = contextMenuEl.offsetWidth;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    let top = e.clientY;
    let left = e.clientX;

    if (e.clientY + menuHeight > windowHeight) {
        top = e.clientY - menuHeight;
        contextMenuEl.classList.add("open-up");
    } else {
        contextMenuEl.classList.remove("open-up");
    }

    if (e.clientX + menuWidth > windowWidth) {
        left = e.clientX - menuWidth;
    }

    contextMenuEl.style.top = `${top}px`;
    contextMenuEl.style.left = `${left}px`;
}

function hideContextMenu(e) {
    if (e && (
        (contextMenuEl && contextMenuEl.contains(e.target)) ||
        (messageContextMenu && messageContextMenu.contains(e.target))
    )) {
        return;
    }

    if (contextMenuEl) {
        contextMenuEl.classList.add("hidden");
    }
    contextMenuTargetServer = null;

    if (messageContextMenu) {
        messageContextMenu.classList.add("hidden");
    }
    targetContextMenuMsg = null;
}

async function showMessageContextMenu(e, msg) {
    e.preventDefault();
    e.stopPropagation();

    targetContextMenuMsg = msg;

    const serverSnap = await get(ref(db, `servers/${currentServer}`));
    const serverData = serverSnap.exists() ? serverSnap.val() : null;
    const isOwner = serverData && serverData.createdBy === uid;
    const canKick = (isOwner || isAdmin) && currentServer !== "public" && currentServer !== "announcements";

    if (msgContextKick) {
        if (canKick) {
            msgContextKick.classList.remove("disabled");
            msgContextKick.style.display = "block";
        } else {
            msgContextKick.classList.add("disabled");
            msgContextKick.style.display = "none";
        }
    }

    if (contextMenuEl) contextMenuEl.classList.add("hidden");

    messageContextMenu.classList.remove("hidden");

    const menuHeight = messageContextMenu.offsetHeight;
    const menuWidth = messageContextMenu.offsetWidth;
    let top = e.clientY;
    let left = e.clientX;

    if (e.clientY + menuHeight > window.innerHeight) top = e.clientY - menuHeight;
    if (e.clientX + menuWidth > window.innerWidth) left = e.clientX - menuWidth;

    messageContextMenu.style.top = `${top}px`;
    messageContextMenu.style.left = `${left}px`;
}

async function handleInvite() {
    const rawHash = window.location.hash;
    if (!rawHash || rawHash.length <= 1) return false;

    const joinCode = rawHash.substring(1).trim();
    if (!joinCode) return false;

    history.replaceState("", document.title, window.location.pathname + window.location.search);

    if (joinCode === "public" || joinCode === "announcements" || myServers.some(s => s.code === joinCode)) {
        switchServer(joinCode);
        return true;
    }

    const kickSnap = await get(ref(db, `servers/${joinCode}/kicked/${uid}`));
    if (kickSnap.exists()) {
        alert("You have been kicked from this server.");
        return false;
    }

    try {
        const serverRef = ref(db, `servers/${joinCode}`);
        const snapshot = await get(serverRef);

        if (!snapshot.exists()) {
            alert("Invalid invite link.");
            return false;
        }

        const serverData = snapshot.val();
        const serverName = serverData.name || `Server ${joinCode}`;

        if (uid) {
            await set(ref(db, `servers/${joinCode}/members/${uid}`), true, writeOptions());
        }

        addServerToSidebar(joinCode, serverName);
        switchServer(joinCode);
        setupNotificationListener(joinCode);
        
        return true;
    } catch (err) {
        return false;
    }
}