// IMPORTS
import { db, auth, noAuthMode, initAuthMode } from "./firebase-init.js";
import { 
    ref, push, onChildAdded, onChildRemoved, onChildChanged, 
    remove, get, child, set, onDisconnect, onValue,
    serverTimestamp, query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInAnonymously, 
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// CONSTANTS
const UPLOAD_URL = "https://acetyl-files.realmeuse.workers.dev/upload";
const HASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="channel-glyph"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"></path></svg>`;
const VOICE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="channel-glyph voice-glyph"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
const DEFAULT_SETTINGS = {
  highContrast: false,
  messageSound: true,
  notifications: true,
  unreadBadge: true,
  showPfp: true,
  startupServer: 'public',
  startupSidebar: false,
};
const userCache = {};


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
let vcMuted = false;
let currentVoiceMsgKey = null;
let views;
let appSettings = JSON.parse(localStorage.getItem('settings')) || { ...DEFAULT_SETTINGS };
let isMuted = false;
let muteUnsub = null;
let lastUploadTimestamp = 0;
let isHandlingSignup = false;


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
let announcementsBtnEl;
let contextMenuEl;
let contextLeaveBtnEl
let rightSidebarEl;
let closeRightSidebarBtnEl;
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
let voiceContainerEl
let voiceBackBtnEl
let voiceMuteBtnEl
let systemContainerEl;
let msgContextMuteBtnEl;
let loadingScreenEl;
let headerReadOnlyBtnEl;
let headerVoicechatBtnEl;
let headerMembersBtnEl;
let chatHeaderNameEl;
let profilePicEl;
let voiceHeaderNameEl;
let authScreenEl;
let logoutBtnEl;

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
    messageBarEl = document.getElementById("messageBar");
    announcementsBtnEl = document.getElementById("announcementsBtn");
    contextMenuEl = document.getElementById("serverContextMenu");
    contextLeaveBtnEl = document.getElementById("contextLeaveServer");
    rightSidebarEl = document.getElementById("rightSidebar");
    closeRightSidebarBtnEl = document.getElementById("closeRightSidebar");
    activeMembersListEl = document.getElementById("activeMembersList");
    allMembersListEl = document.getElementById("allMembersList");
    allMembersHeaderEl = document.getElementById("allMembersHeader");
    contextInviteBtnEl = document.getElementById("contextInvite");
    contextKickBtnEl = document.getElementById("contextKick");
    newMessage = new Audio('/client/Assets/newMessage.mp3')
    messageContextMenu = document.getElementById("messageContextMenu");
    msgContextGetUid = document.getElementById("msgContextGetUid");
    msgContextBan = document.getElementById("msgContextBan");
    msgContextDelete = document.getElementById("msgContextDelete");
    msgContextKick = document.getElementById("msgContextKick");
    kickedMembersHeaderEl = document.getElementById("kickedMembersHeader");
    kickedMembersListEl = document.getElementById("kickedMembersList");
    voiceContainerEl = document.getElementById("voice-container")
    voiceBackBtnEl = document.getElementById("voiceBackBtn");
    voiceMuteBtnEl = document.getElementById("voiceMuteBtn");
    systemContainerEl = document.getElementById("systemContainer")
    msgContextMuteBtnEl = document.getElementById("msgContextMute");
    loadingScreenEl = document.getElementById("loadingScreen");
    headerReadOnlyBtnEl = document.getElementById("headerReadOnly");
    headerVoicechatBtnEl = document.getElementById("headerVoicechatBtn");
    headerMembersBtnEl = document.getElementById("headerMembersBtn");
    chatHeaderNameEl = document.getElementById("chatHeaderName");
    profilePicEl = document.getElementById("profilePicture")
    voiceHeaderNameEl = document.getElementById("voiceHeaderName")
    authScreenEl = document.getElementById("authScreen");
    logoutBtnEl = document.getElementById("logOut");

    await initAuthMode();
    initSettingsUI();
    initAuthScreenUI();
    applySettings();

    views = {
        chat: [chatContainerEl, messageBarEl],
        guidelines: [guidelinesContainerEl, guidelinesEl],
        voice: [voiceContainerEl],
        system: [systemContainerEl]
    };

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
        if (isHandlingSignup) return;

        username = "";
        if (usernameEl) usernameEl.textContent = "";
        myServers = [];
        if (serverListEl) serverListEl.innerHTML = "";
        const noServersMsg = document.getElementById("noServersMsg");
        if (noServersMsg) noServersMsg.style.display = "block";

        if (!user) {
            console.log("%cStatus: No user signed in (Logged Out)", "color: #e74c3c;");
            
            if (webContainerEl) webContainerEl.style.display = "none";
            if (authScreenEl) authScreenEl.style.display = "flex";
            if (loadingScreenEl) loadingScreenEl.classList.add("fade-out");
            return;
        }

        if (!user.isAnonymous && !user.emailVerified) {
            console.log("%cStatus: Email user is NOT verified. Forcing sign-out.", "color: #e74c3c;");

            await signOut(auth);

            if (webContainerEl) webContainerEl.style.display = "none";
            if (authScreenEl) authScreenEl.style.display = "flex";
            if (loadingScreenEl) loadingScreenEl.classList.add("fade-out");

            alert("Your email address has not been verified yet. Please check your inbox for the verification link before logging in.");
            return;
        }

        console.log(`%cStatus: User Authenticated`, "color: #2ecc71; font-weight: bold;");
        console.log(`- UID: ${user.uid}`);
        console.log(`- Is Anonymous: ${user.isAnonymous}`);

        if (authScreenEl) authScreenEl.style.display = "none";
        if (webContainerEl) webContainerEl.style.display = "flex";

        uid = user.uid;
        window.uid = user.uid;
        
        await checkBanStatus(uid);
        await finishAppLoad();
    });
};

async function finishAppLoad() {
    listenToMuteStatus();
    const newUser = await loadSavedUser(uid);

    await loadUserServers();
    await validateSavedServers();
    initSettingsUI();

    attachUIListeners();

    if (newUser) {
        console.log("Detected new user");
        await set(ref(db, `users/${uid}/username`), username, writeOptions());
        localStorage.setItem("username", username);
        switchView("guidelines");

        loadingScreenEl.classList.add("fade-out");
    } else {
        const handledInvite = await handleInvite();
        if (!handledInvite) {
            const targetServer = appSettings.startupServer || "public";
            
            const serverExists = targetServer === "public" || 
                                targetServer === "announcements" || 
                                targetServer === "system" || 
                                myServers.some(s => s.code === targetServer);

            if (serverExists) {
                switchServer(targetServer);
            } else {
                switchServer("public"); 
            }
        }
        setupNotificationListener("public");
        checkAdminStatus();

        loadingScreenEl.classList.add("fade-out");
    }

    if (appSettings.startupSidebar && currentServer !== "announcements" && currentServer !== "system") {
        rightSidebarEl.style.display = 'flex';
        if (headerMembersBtnEl) headerMembersBtnEl.classList.add("active");
        setupActiveUserListener(currentServer);
        loadAllMembers(currentServer);
    } else {
        rightSidebarEl.style.display = 'none';
    }

    myServers.forEach(server => {
        setupNotificationListener(server.code);
    });
}

async function handleEmailLogin(email, password) {
    console.log(`[Action] Attempting Email Login for: ${email}`);

    try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("%c[Action] Email login successful.", "color: #2ecc71;");
    } catch (error) {
        console.error("[Action Error] Email login failed:", error);

        let errorMsg = "Login failed.";
        if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
            errorMsg = "Invalid email or password.";
        } else if (error.code === "auth/invalid-email") {
            errorMsg = "Please enter a valid email address.";
        } else if (error.code === "auth/too-many-requests") {
            errorMsg = "Access temporarily disabled due to too many failed login attempts. Try again later.";
        }
        alert(errorMsg);
    }
}

async function handleEmailSignup(email, password, usernameInput) {
    console.log(`[Action] Attempting Email Signup for: ${email}`);

    const cleanedUsername = usernameInput.trim();
    if (!cleanedUsername || cleanedUsername.length > 24 || /[.#$\[\]",]/.test(cleanedUsername)) {
        alert("Invalid username. Please keep it under 24 characters and avoid special characters.");
        return;
    }

    isHandlingSignup = true;

    try {
        const usersSnap = await get(ref(db, "users"));
        if (usersSnap.exists()) {
            const users = usersSnap.val();
            for (const uidKey in users) {
                if (users[uidKey].username && users[uidKey].username.toLowerCase() === cleanedUsername.toLowerCase()) {
                    alert("That username is already taken. Please choose another one.");
                    isHandlingSignup = false; 
                    return;
                }
            }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("%c[Action] Email signup successful. User created with UID:", "color: #2ecc71;", user.uid);

        await set(ref(db, `users/${user.uid}/username`), cleanedUsername, writeOptions());

        await sendEmailVerification(user);
        console.log("%c[Action] Verification email sent.", "color: #2ecc71;");

        await signOut(auth);

        alert("Account created successfully! A verification email has been sent to your inbox. Please verify your email before logging in.");
        
        const loginView = document.getElementById("login-view");
        const signupView = document.getElementById("signup-view");
        if (signupView) signupView.style.display = "none";
        if (loginView) loginView.style.display = "block";

    } catch (error) {
        console.error("[Action Error] Email signup failed:", error);

        let errorMsg = "Sign up error: " + error.message;
        if (error.code === "auth/email-already-in-use") {
            errorMsg = "An account with this email address already exists.";
        } else if (error.code === "auth/invalid-email") {
            errorMsg = "Please enter a valid email address.";
        } else if (error.code === "auth/weak-password") {
            errorMsg = "Your password is too weak. Please use at least 6 characters.";
        }
        alert(errorMsg);
    } finally {
        isHandlingSignup = false;
    }
}

async function handleAnonymousLogin() {
    console.log("[Action] Attempting Anonymous Sign-In...");
    try {
        localStorage.removeItem("guest_logged_out");

        if (auth.currentUser && auth.currentUser.isAnonymous) {
            console.log("%c[Action] Reusing active anonymous Firebase session.", "color: #2ecc71;");
            if (authScreenEl) authScreenEl.style.display = "none";
            if (webContainerEl) webContainerEl.style.display = "flex";
            uid = auth.currentUser.uid;
            window.uid = auth.currentUser.uid;
            await checkBanStatus(uid);
            await finishAppLoad();
        } else {
            console.log("%c[Action] Creating anonymous session via Firebase Auth.", "color: #2ecc71;");
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("[Action Error] Anonymous sign-in failed:", error);
        alert("Anonymous sign-in error: " + error.message);
    }
}

async function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out? There's no going back.");
    if (!confirmLogout) return;

    console.log("[Action] Logout requested...");
    try {
        if (uid && currentServer && currentServer !== "system" && currentServer !== "announcements") {
            const activeUserRef = ref(db, `servers/${currentServer}/activeUsers/${uid}`);
            await remove(activeUserRef, writeOptions());
        }
        localStorage.removeItem("username");
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("[Action Error] Logout failed:", error);
        alert("Logout error: " + error.message);
    }
}

function initAuthScreenUI() {
    const loginView = document.getElementById("login-view");
    const signupView = document.getElementById("signup-view");
    const showSignupBtn = document.getElementById("show-signup-btn");
    const showLoginBtn = document.getElementById("show-login-btn");
    
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const anonymousBtn = document.getElementById("anonymous-continue-btn");

    if (showSignupBtn) {
        showSignupBtn.addEventListener("click", (e) => {
            e.preventDefault();
            loginView.style.display = "none";
            signupView.style.display = "block";
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener("click", (e) => {
            e.preventDefault();
            signupView.style.display = "none";
            loginView.style.display = "block";
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const pass = document.getElementById("login-password").value;
            handleEmailLogin(email, pass);
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("signup-email").value;
            const usernameInput = document.getElementById("signup-username").value;
            const pass = document.getElementById("signup-password").value;
            handleEmailSignup(email, pass, usernameInput);
        });
    }

    if (anonymousBtn) {
        anonymousBtn.addEventListener("click", (e) => {
            e.preventDefault();
            handleAnonymousLogin();
        });
    }
}


// LOAD USER + SERVERS
async function loadSavedUser(currentUid) {
    const pfpSnap = await get(ref(db, `users/${currentUid}/pfpUrl`));

    if (pfpSnap.exists() && profilePicEl) {
        profilePicEl.src = pfpSnap.val();
    }

    const userRef = ref(db, `users/${currentUid}/username`);
    const snap = await get(userRef);

    if (snap.exists()) {
        username = snap.val();
        usernameEl.textContent = username;
        localStorage.setItem(`username_${currentUid}`, username);
        return false;
    }

    const savedName = localStorage.getItem(`username_${currentUid}`);
    if (savedName && auth.currentUser && auth.currentUser.isAnonymous) {
        username = savedName;
        usernameEl.textContent = username;
        await set(ref(db, `users/${currentUid}/username`), username, writeOptions());
        return false;
    }

    const num = Math.floor(1000 + Math.random() * 9000); 
    username = `user${num}`;
    usernameEl.textContent = username;
    localStorage.setItem(`username_${currentUid}`, username);

    return true;
}

async function loadUserServers() {
    myServers = [];
    if (serverListEl) serverListEl.innerHTML = "";
    
    const serversRef = ref(db, `users/${uid}/joinedServers`);
    const snap = await get(serversRef);

    if (!snap.exists()) {
        updateNoServersMessage();
        return;
    }

    const joinedObj = snap.val();
    for (const code of Object.keys(joinedObj)) {
        if (code === "system") {
            myServers.push({ code: "system", name: "System" });
            addServerToSidebar("system", "System");
            continue;
        }

        const nameSnap = await get(ref(db, `servers/${code}/name`));
        const name = nameSnap.exists() ? nameSnap.val() : `Server ${code}`;

        myServers.push({ code, name });
        addServerToSidebar(code, name);
    }

    updateNoServersMessage();
}

async function validateSavedServers() {
    const validServers = [];

    for (const server of myServers) {
        const { code, name } = server;

        if (code === "system") {
            validServers.push({ code: "system", name: server.name || "System" });
            continue;
        }

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
                const targetUsername = prompt("Enter username to ban/unban:");
                if (!targetUsername) return;

                const usersSnap = await get(ref(db, "users"));
                if (!usersSnap.exists()) {
                    alert("No users found.");
                    return;
                }

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

                if (targetUid === uid) {
                    alert("You cannot ban yourself.");
                    return;
                }

                const banSnap = await get(ref(db, `bans/${targetUid}`));
                if (banSnap.exists()) {
                    const confirmUnban = confirm(`User @${targetUsername} is currently banned. Do you want to unban them?`);
                    if (!confirmUnban) return;

                    await remove(ref(db, `bans/${targetUid}`));
                    alert(`User @${targetUsername} has been unbanned.`);
                    return;
                }

                const durationHours = prompt("Ban duration (hours):");
                if (!durationHours) return;

                const reason = prompt("Reason for ban:");
                if (!reason) return;

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

                await sendBotMessage("public", `🫡 Farewell, @${targetUsername}. Your journey on Acetyl has come to an end (u got banned lol).`);

                alert(`User ${targetUsername} has been banned.`);
                break;
            }

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

            case "/mute": {
                const targetUsername = prompt("Enter username to mute/unmute:");
                if (!targetUsername) return;

                const usersSnap = await get(ref(db, "users"));
                if (!usersSnap.exists()) {
                    alert("No users found.");
                    return;
                }

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

                if (targetUid === uid) {
                    alert("You cannot mute yourself.");
                    return;
                }

                const adminSnap = await get(ref(db, `admins/${targetUid}`));
                if (adminSnap.exists()) {
                    alert("You cannot mute another admin.");
                    return;
                }

                await toggleMuteUser(targetUid, targetUsername);
                break;
            }

            case "/cmds":
                alert("Admin commands:\n/ban 🡒 ban a user\n/mute 🡒 mute a user\n/admins 🡒 view all admins\nMore coming soon, contact @𝙍乇𝘼𝙇𝙈𝙀𝙐𝙎𝙀 with ideas")
                break;
            default:
                alert("Invalid command.");
        }
    });

    messageInputEl.addEventListener("keydown", async (e) => {
        if (!messageInputEl.hasAttribute("contenteditable") || messageInputEl.classList.contains("disabled")) {
            e.preventDefault();
            return;
        }

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
        handleFileSelection(file);
    });

    messageInputEl.addEventListener("paste", (e) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData || !clipboardData.files) return;

        if (clipboardData.files.length > 0) {
            const file = clipboardData.files[0];
            
            e.preventDefault();
            
            handleFileSelection(file);
        }
    });

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        webContainerEl.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    webContainerEl.addEventListener("dragover", () => {
        webContainerEl.classList.add("drag-over");
    });

    ["dragleave", "drop"].forEach((eventName) => {
        webContainerEl.addEventListener(eventName, () => {
            webContainerEl.classList.remove("drag-over");
        });
    });

    webContainerEl.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
            const file = dt.files[0];
            handleFileSelection(file);
        }
    });

    guidelinesBtnEl.addEventListener("click", () => {
        switchView("guidelines");
    });

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

    if (headerMembersBtnEl) {
        headerMembersBtnEl.addEventListener("click", () => {
            if (!rightSidebarEl) return;
            const isHidden = getComputedStyle(rightSidebarEl).display === "none";
            if (isHidden) {
                rightSidebarEl.style.display = "flex";
                headerMembersBtnEl.classList.add("active");
                setupActiveUserListener(currentServer);
                loadAllMembers(currentServer);
            } else {
                rightSidebarEl.style.display = "none";
                headerMembersBtnEl.classList.remove("active");
            }
        });
    }

    if (closeRightSidebarBtnEl) {
        closeRightSidebarBtnEl.addEventListener('click', () => {
            rightSidebarEl.style.display = 'none';
            if (headerMembersBtnEl) headerMembersBtnEl.classList.remove("active");
        });
    }

    if (contextInviteBtnEl) {
        contextInviteBtnEl.addEventListener("click", (e) => {
            e.stopPropagation();
            if (contextMenuTargetServer) {
                const inviteUrl = `${window.location.origin}/invite/${contextMenuTargetServer}`;
                alert(`Server Code: ${contextMenuTargetServer}\n\nOr use this invite link:\n${inviteUrl}`);
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

    if (headerReadOnlyBtnEl) {
        headerReadOnlyBtnEl.addEventListener("click", async () => {
            if (!currentServer || currentServer === "public" || currentServer === "announcements") return;
            try {
                const serverRef = ref(db, `servers/${currentServer}`);
                const snap = await get(serverRef);
                if (!snap.exists()) return;

                const serverData = snap.val();
                if (serverData.createdBy !== uid) return;

                const newReadOnly = !serverData.readOnly;
                await set(ref(db, `servers/${currentServer}/readOnly`), newReadOnly, writeOptions());
                headerReadOnlyBtnEl.textContent = `Read-Only Mode: ${newReadOnly ? "On" : "Off"}`;
                
                const botMessageText = newReadOnly 
                    ? "🔒 Server Read-Only mode is now ON. Only the owner can send messages."
                    : "🔓 Server Read-Only mode is now OFF. Everyone can send messages again.";

                await sendBotMessage(currentServer, botMessageText, null, true);
            } catch (err) {
                console.error("Failed to toggle read-only:", err);
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
        hideContextMenu();

        if (targetUid === uid) {
            alert("You cannot ban yourself.");
            return;
        }

        const banSnap = await get(ref(db, `bans/${targetUid}`));
        if (banSnap.exists()) {
            const confirmUnban = confirm(`User @${targetUsername} is currently banned. Do you want to unban them?`);
            if (!confirmUnban) return;

            await remove(ref(db, `bans/${targetUid}`));
            alert(`User @${targetUsername} has been unbanned.`);
            return;
        }

        const durationHours = prompt(`Ban duration (hours):`);
        if (!durationHours) return;

        const reason = prompt(`Reason for ban:`);
        if (!reason) return;

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

        await sendBotMessage("public", `🫡 Farewell, @${targetUsername}. Your journey on Acetyl has come to an end (u got banned lol).`);

        alert(`User ${targetUsername} has been banned.`);
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

    if (msgContextMuteBtnEl) {
        msgContextMuteBtnEl.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!targetContextMenuMsg) {
                hideContextMenu();
                return;
            }

            const { uid: targetUid, username: targetUsername } = targetContextMenuMsg;
            hideContextMenu();

            if (targetUid === uid) {
                alert("You cannot mute yourself.");
                return;
            }

            const targetAdminSnap = await get(ref(db, `admins/${targetUid}`));
            if (targetAdminSnap.exists()) {
                alert("You cannot mute another admin.");
                return;
            }

            await toggleMuteUser(targetUid, targetUsername);
        });
    }

    if (headerVoicechatBtnEl) {
        headerVoicechatBtnEl.addEventListener("click", () => {
            if (currentServer && currentServer !== "public" && currentServer !== "announcements") {
                joinVoiceChat(currentServer);
            }
        });
    }

    if (voiceBackBtnEl) {
        voiceBackBtnEl.addEventListener("click", () => leaveVoiceChat());
    }

    if (voiceMuteBtnEl) {
        voiceMuteBtnEl.addEventListener("click", async () => {
            if (!localAudioStream) return;

            vcMuted = !vcMuted;

            localAudioStream.getAudioTracks().forEach(track => {
                track.enabled = !vcMuted;
            });

            const iconEl = voiceMuteBtnEl.querySelector("i");
            if (vcMuted) {
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
                    vcMuted: vcMuted,
                    msgKey: currentVoiceMsgKey
                });
            }
        });
    }  
    
    if (profilePicEl) {
        const pfpInput = document.createElement("input");
        pfpInput.type = "file";
        pfpInput.accept = "image/*";
        pfpInput.style.display = "none";
        document.body.appendChild(pfpInput);

        profilePicEl.style.cursor = "pointer";
        profilePicEl.title = "Change profile picture";

        profilePicEl.addEventListener("click", () => {
            pfpInput.click();
        });

        pfpInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                handlePfpUpload(file);
            }
            pfpInput.value = "";
        });
    }

    if (logoutBtnEl) {
        logoutBtnEl.addEventListener("click", (e) => {
            e.preventDefault();
            handleLogout();
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
            if (users[uidKey].username && users[uidKey].username.toLowerCase() === cleaned.toLowerCase()) {
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
            const banEndTime = banData.timestamp + banData.duration * 1000;
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


// MUTE STATUS
function listenToMuteStatus() {
    if (muteUnsub) muteUnsub();

    const myMuteRef = ref(db, `mutes/${uid}`);
    muteUnsub = onValue(myMuteRef, (snap) => {
        isMuted = snap.exists();

        if (currentServer && currentServer !== "system") {
            if (isMuted && !isAdmin) {
                setInputDisabledState(true, "You do not have permission to message in Acetyl Client");
            } else {
                switchServer(currentServer);
            }
        }
    });
}

async function toggleMuteUser(targetUid, targetUsername) {
    const muteRef = ref(db, `mutes/${targetUid}`);
    const muteSnap = await get(muteRef);

    if (muteSnap.exists()) {
        const confirmUnmute = confirm(`User @${targetUsername} is currently muted. Do you want to unmute them?`);
        if (!confirmUnmute) return;

        await remove(muteRef);
        alert(`User @${targetUsername} has been unmuted.`);
    } else {
        await set(muteRef, {
            username: targetUsername,
            mutedBy: uid,
            timestamp: Date.now()
        });

        alert(`User @${targetUsername} has been muted.`);
    }
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

        await sendBotMessage(serverId, `👋 See you later! @${targetUsername} was kicked from the server.`);

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

        if (headerMembersBtnEl) headerMembersBtnEl.classList.add("hidden");
        if (headerVoicechatBtnEl) headerVoicechatBtnEl.classList.add("hidden");
        if (headerReadOnlyBtnEl) headerReadOnlyBtnEl.classList.add("hidden");
        if (rightSidebarEl) rightSidebarEl.style.display = "none";
        if (chatHeaderNameEl) chatHeaderNameEl.textContent = "Announcements";

        if (isAdmin) {
            setInputDisabledState(false, "Post in #Announcements");
        } else {
            setInputDisabledState(true, "You do not have permission to post in #Announcements");
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

        switchView("chat");
        highlightActiveServer("announcements");
        return;
    }

    if (serverId === "system") {
        if (activeUsersUnsub) activeUsersUnsub();
        if (currentKickUnsub) {
            currentKickUnsub();
            currentKickUnsub = null;
        }
        if (unsubscribe) unsubscribe();

        currentServer = "system";
        switchView("system");
        highlightActiveServer("system");

        if (rightSidebarEl) {
            rightSidebarEl.style.display = "none";
        }

        return;
    }

    if (serverId === "public") {
        if (headerMembersBtnEl) headerMembersBtnEl.classList.remove("hidden");
        if (headerVoicechatBtnEl) headerVoicechatBtnEl.classList.add("hidden");
        if (headerReadOnlyBtnEl) headerReadOnlyBtnEl.classList.add("hidden");
    } else {
        if (headerMembersBtnEl) headerMembersBtnEl.classList.remove("hidden");
        if (headerVoicechatBtnEl) headerVoicechatBtnEl.classList.remove("hidden");
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
    const serverName = serverId === "public" ? "Public" : (data.name || serverId);
    const isOwner = data.createdBy === uid;
    const isReadOnly = !!data.readOnly;

    if (chatHeaderNameEl) {
        if (isOwner && serverId !== "public" && serverId !== "announcements") {
            chatHeaderNameEl.textContent = serverName + "  - 👑";
            chatHeaderNameEl.style.whiteSpace = "pre-wrap";
        } else {
            chatHeaderNameEl.textContent = serverName;
        }
    }

    if (headerReadOnlyBtnEl) {
        if (isOwner && serverId !== "public" && serverId !== "announcements") {
            headerReadOnlyBtnEl.classList.remove("hidden");
            headerReadOnlyBtnEl.textContent = `Read-Only Mode: ${data.readOnly ? "On" : "Off"}`;
        } else {
            headerReadOnlyBtnEl.classList.add("hidden");
        }
    }

    if (isReadOnly && !isOwner) {
        setInputDisabledState(true, `You do not have permission to message in #${serverName}`);
    } else if (isMuted && !isAdmin) {
        setInputDisabledState(true, "You do not have permission to message in Acetyl Client");
    } else {
        setInputDisabledState(false, `Message #${serverName}`);
    }
    
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
            if (!isSender && !isReceiver) return; 
        }

        const isGrouped =
            !msg.isDM &&
            !msg.isSystem &&
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
        switchView("chat");
    }
    highlightActiveServer(serverId);

    setupActiveUserListener(serverId);
    if (rightSidebarEl && getComputedStyle(rightSidebarEl).display !== "none") {
        loadAllMembers(serverId);
    }
    markServerAsRead(serverId);
}

function highlightActiveServer(serverId) {
    document.querySelectorAll(".serverRow").forEach(row => {
        if (serverId && row.dataset.server === serverId) {
            row.classList.add("active");
        } else {
            row.classList.remove("active");
        }
    });

    publicServerBtnEl?.classList.toggle("active", serverId === "public");
    announcementsBtnEl?.classList.toggle("active", serverId === "announcements");
}

function switchView(targetView) {
    if (!views || !views[targetView]) {
        console.warn(`[View] Unknown view: ${targetView}`);
        return;
    }

    Object.values(views).forEach(elements => {
        elements.forEach(el => {
            if (!el) return;
            el.classList.remove("active");
            el.classList.add("hidden");
        });
    });

    views[targetView].forEach(el => {
        if (!el) return;
        el.classList.remove("hidden");
        el.classList.add("active");
    });

    document
        .querySelectorAll(".tabBtn")
        .forEach(btn => btn.classList.remove("active"));

    if (["guidelines"].includes(targetView)) {
        guidelinesBtnEl?.classList.add("active");
        highlightActiveServer(null);
    }
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
        alert("Server name must be under 24 characters");
        return;
    }

    const code = Math.random().toString(36).substring(2, 8);

    // 1. Create server metadata & membership
    await set(ref(db, `servers/${code}`), {
        name,
        createdBy: uid,
        createdAt: Date.now()
    }, writeOptions());

    await set(ref(db, `servers/${code}/members/${uid}`), true, writeOptions());

    // 2. Save to user's joined servers list in Firebase
    await set(ref(db, `users/${uid}/joinedServers/${code}`), true, writeOptions());

    addServerToSidebar(code, name);
    switchServer(code);

    await sendBotMessage(code, `Server created. Your server code is: ${code}`);
}


// JOIN SERVER
async function joinServer() {
    const code = prompt("Enter server code:");
    if (!code) return;

    if (myServers.some(s => s.code === code)) {
        switchServer(code);
        return;
    }

    if (code === "system") {
        await set(ref(db, `users/${uid}/joinedServers/system`), true, writeOptions());
        addServerToSidebar("system", "System");
        switchServer("system");
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
    
    // UPDATE BOTH PATHS:
    await Promise.all([
        set(ref(db, `servers/${code}/members/${uid}`), true, writeOptions()),
        set(ref(db, `users/${uid}/joinedServers/${code}`), true, writeOptions())
    ]);

    await sendBotMessage(code, `👋 @${username} joined the server!`);

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

    const buttonEl = document.createElement("button");
    buttonEl.classList.add("serverButton");
    buttonEl.dataset.server = code;
    buttonEl.addEventListener("click", () => switchServer(code));

    rowEl.addEventListener("contextmenu", (e) => showServerContextMenu(e, code));
    buttonEl.addEventListener("contextmenu", (e) => showServerContextMenu(e, code));

    const hashEl = document.createElement("span");
    hashEl.classList.add("serverHash");
    if (code === "system") {
        hashEl.classList.add("systemGear");
        hashEl.innerHTML = `<i class="fa-solid fa-gear"></i>`;
    } else if (code === currentVoiceServer) {
        hashEl.innerHTML = VOICE_ICON;
    } else {
        hashEl.innerHTML = HASH_ICON;
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
    if (code === "public") {
        alert("You cannot leave the public server.");
        return;
    }

    if (code === "system") {
        await remove(ref(db, `users/${uid}/joinedServers/system`), writeOptions());
        myServers = myServers.filter(s => s.code !== "system");

        const row = [...serverListEl.children].find(r => r.dataset.server === "system");
        if (row) row.remove();

        if (notificationUnsubs["system"]) {
            notificationUnsubs["system"]();
            delete notificationUnsubs["system"];
        }

        switchServer("public");
        updateNoServersMessage();
        return;
    }

    let isOwner = false;
    try {
        const serverSnap = await get(ref(db, `servers/${code}`));
        const serverData = serverSnap.exists() ? serverSnap.val() : null;
        isOwner = serverData && serverData.createdBy === uid;
    } catch (err) {
        console.error("Failed to check server ownership:", err);
    }

    const actionText = isOwner ? "delete this server entirely" : "leave this server";
    if (!confirm(`Are you sure you want to ${actionText}?`)) return;

    if (isOwner) {
        await remove(ref(db, `servers/${code}`), writeOptions());
    } else {
        // REMOVE FROM BOTH PATHS:
        await Promise.all([
            remove(ref(db, `servers/${code}/activeUsers/${uid}`), writeOptions()),
            remove(ref(db, `servers/${code}/members/${uid}`), writeOptions()),
            remove(ref(db, `users/${uid}/joinedServers/${code}`), writeOptions())
        ]);
    }

    myServers = myServers.filter(s => s.code !== code);

    const row = [...serverListEl.children].find(r => r.dataset.server === code);
    if (row) row.remove();

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
    if (!auth.currentUser) {
        throw new Error("You must be logged in to upload files.");
    }

    const cooldown = 30 * 1000; 
    const timeSinceLastUpload = Date.now() - lastUploadTimestamp;
    if (timeSinceLastUpload < cooldown) {
        const remainingSecs = Math.ceil((cooldown - timeSinceLastUpload) / 1000);
        alert(`Please wait ${remainingSecs} seconds before uploading another file.`)
        throw new Error(`Please wait ${remainingSecs} seconds before uploading another file.`);
    }

    const token = await auth.currentUser.getIdToken();

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(UPLOAD_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
    }

    lastUploadTimestamp = Date.now();

    const data = await res.json(); 
    return data.url;
}

function handleFileSelection(file) {
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
}


// MESSAGE SENDING
async function sendMessage() {
    const text = messageInputEl.innerText.trim();
    const file = attachedFile;

    if (!noAuthMode && !uid) return;

    if (isMuted && !isAdmin) return;

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

        const dmMessage = {
            text: dm.messageBody || null,
            uid: uid || "no-auth",
            timestamp: serverTimestamp(),
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
        const messageData = {
            text: text || null,
            uid: uid || "no-auth",
            timestamp: serverTimestamp(),
            fileUrl,
            fileName,
            fileType
        };

        await push(messagesRef, messageData, writeOptions());
        enforceMessageLimit();
    }

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
    if (body && body.length > 2000) return;

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

    const title = prompt("Enter announcement title:");
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

async function sendBotMessage(serverId, text, action = null, bypassReadOnly = false) {
    if (!serverId) return null;
    try {
        const serverRef = ref(db, `servers/${serverId}`);
        const serverSnap = await get(serverRef);

        if (!bypassReadOnly && serverSnap.exists() && serverSnap.val().readOnly) {
            return null;
        }

        const messagesRef = ref(db, `servers/${serverId}/messages`);
        const newMsgRef = push(messagesRef);

        await set(newMsgRef, {
            text, 
            username: "Server Bot",
            uid: "system",
            timestamp: serverTimestamp(),
            isAdmin: false,
            isSystem: true,
            action
        });

        return newMsgRef;
    } catch (err) {
        console.error("Failed to send server bot message:", err);
        return null;
    }
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

            if (msgData.fileUrl) {
                const filename = msgData.fileUrl.split("/").pop();
                const deleteUrl = UPLOAD_URL.replace("/upload", "") + "/delete-file?name=" + filename;

                fetch(deleteUrl, { method: "DELETE" })
                    .catch(err => console.error("File delete failed:", err));
            }

            await remove(child(messagesRef, key), writeOptions());
        }
    }
}


// MESSAGE DISPLAY
function displayMessage(msg, isGrouped) {
    let nameEl = null;
    let avatarEl = null;

    const profile = getProfile(msg.uid, (freshProfile) => {
        if (nameEl) updateNameElement(nameEl, freshProfile, msg);
        if (avatarEl) avatarEl.src = freshProfile.pfpUrl;
    });

    const wrapper = document.createElement("div");
    wrapper.classList.add("message");
    if (msg.id) wrapper.dataset.id = msg.id;
    if (isGrouped) wrapper.classList.add("grouped");
    if (msg.isDM) wrapper.classList.add("dm-message");

    wrapper.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        if (isAdmin) {
            showMessageContextMenu(e, msg);
            return;
        }
        if (currentServer !== "public") {
            try {
                const serverSnap = await get(ref(db, `servers/${currentServer}`));
                const serverData = serverSnap.exists() ? serverSnap.val() : null;
                if (serverData && serverData.createdBy === uid) {
                    showMessageContextMenu(e, msg);
                }
            } catch (err) {
                console.error("Owner permission check failed:", err);
            }
        }
    });

    if (!isGrouped) {
        avatarEl = document.createElement("img");
        avatarEl.classList.add("message-avatar");
        avatarEl.src = profile.pfpUrl;
        avatarEl.alt = "Avatar";
        wrapper.appendChild(avatarEl);

        const header = document.createElement("div");
        header.classList.add("message-header");

        nameEl = document.createElement("span");
        nameEl.classList.add("username");

        if (msg.isDM) {
            const dmTag = document.createElement("span");
            dmTag.classList.add("dm-tag");

            if (msg.uid === uid) {
                dmTag.textContent = `[DM to ${msg.dmTo}] `;
            } else {
                dmTag.textContent = `[DM] `;
            }

            header.prepend(dmTag);
            nameEl.classList.add("dm-username");
        }

        updateNameElement(nameEl, profile, msg);

        if (!msg.isSystem) {
            nameEl.style.cursor = "pointer";
            nameEl.title = "Click to DM this user";

            nameEl.addEventListener("click", () => {
                const currentName = nameEl.textContent.trim();
                if (currentName === username || currentName === "Loading...") return;

                messageInputEl.innerHTML = `<span class="input-mention" contenteditable="false">@${currentName},</span>&nbsp;`;
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

        const msgDate = new Date(msg.timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const timeStr = msgDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });

        if (msgDate >= today) {
            timeEl.textContent = timeStr;
        } else if (msgDate >= yesterday) {
            timeEl.textContent = `Yesterday at ${timeStr}`;
        } else {
            const dateStr = msgDate.toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
            timeEl.textContent = `${dateStr} ${timeStr}`;
        }

        header.appendChild(nameEl);
        header.appendChild(timeEl);
        wrapper.appendChild(header);
    }

    if (msg.text) {
        const textEl = document.createElement("span");
        textEl.classList.add("text");
        textEl.innerHTML = formatMessage(msg.text);
        wrapper.appendChild(textEl);
    }

    if (msg.action && msg.action.type === "JOIN_VOICE") {
        const joinVoiceBtn = document.createElement("button");
        joinVoiceBtn.classList.add("msg-join-voice-btn");
        joinVoiceBtn.innerHTML = `Join Voice Chat <span class="joinVoiceArrow">▶</span>`;

        joinVoiceBtn.addEventListener("click", () => {
            joinVoiceChat(msg.action.serverCode);
        });

        wrapper.appendChild(joinVoiceBtn);
    }

    // File Content
    if (msg.fileUrl) {
        const fileWrapper = document.createElement("div");
        fileWrapper.classList.add("file-message");

        if (msg.fileType && msg.fileType.startsWith("image/")) {
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

function updateNameElement(nameEl, profile, msg) {
    const displayUsername = msg.isSystem ? msg.username : profile.username;
    const displayIsAdmin = msg.isSystem ? false : profile.isAdmin;

    if (msg.isSystem) {
        nameEl.textContent = displayUsername;
        nameEl.classList.add("system-username");
    } else if (displayIsAdmin) {
        nameEl.innerHTML = `
            <span class="admin-username">${displayUsername}</span>
            <i class="fa-solid fa-circle-check admin-badge" title="Admin"></i>
        `;
    } else {
        nameEl.textContent = displayUsername;
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

function getProfile(targetUid, onUpdate) {
    if (targetUid === "system" || targetUid === "no-auth") {
        return { username: "Server Bot", isAdmin: false, pfpUrl: "/client/Assets/botPfp.png" };
    }
    
    if (userCache[targetUid]) {
        return userCache[targetUid];
    }

    const fallback = { username: "Loading...", isAdmin: false, pfpUrl: "/client/Assets/pfp.png" };

    Promise.all([
        get(ref(db, `users/${targetUid}`)),
        get(ref(db, `admins/${targetUid}`))
    ]).then(([userSnap, adminSnap]) => {
        const userData = userSnap.exists() ? userSnap.val() : {};
        const profile = {
            username: userData.username || "Unknown User",
            pfpUrl: userData.pfpUrl || "/client/Assets/pfp.png", // Fallback to default asset
            isAdmin: adminSnap.exists() && adminSnap.val() === true
        };

        userCache[targetUid] = profile;
        if (onUpdate) onUpdate(profile);
    }).catch(err => console.error("Profile resolution failed:", err));

    return fallback;
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

    const isPublic = (code === "public" || code === "announcements");
    const activeRef = ref(db, `servers/${code}/activeUsers`);
    const serverRef = ref(db, `servers/${code}`);

    activeUsersUnsub = onValue(activeRef, (snap) => {
        activeMembersListEl.innerHTML = "";

        if (!snap.exists()) {
            activeMembersListEl.innerHTML = "<li>No active users</li>";
            return;
        }

        const fetchOwner = isPublic ? Promise.resolve(null) : get(serverRef);

        fetchOwner.then((serverSnap) => {
            let ownerUid = null;
            if (serverSnap && serverSnap.exists()) {
                ownerUid = serverSnap.val().createdBy;
            }

            snap.forEach((childSnap) => {
                const userData = childSnap.val();
                const username = userData.username;
                const userUid = userData.uid || childSnap.key;
                const isOwner = !isPublic && (userUid === ownerUid);

                const li = document.createElement("li");

                get(ref(db, `admins/${userUid}`)).then((adminSnap) => {
                    const isUserAdmin = adminSnap.exists() && adminSnap.val() === true;

                    if (isOwner && isUserAdmin) {
                        li.innerHTML = `<span class="member-list-admin">${username}</span> <i class="fa-solid fa-circle-check admin-badge" title="Admin"></i> <span title="Server owner">👑</span>`;
                    } else if (isOwner && !isUserAdmin) {
                        li.innerHTML = `${username} <span title="Server owner">👑</span>`;
                    } else if (isUserAdmin && !isOwner) {
                        li.innerHTML = `<span class="member-list-admin">${username}</span> <i class="fa-solid fa-circle-check admin-badge" title="Admin"></i>`;
                    } else {
                        li.textContent = username;
                    }
                }).catch(() => {
                    li.textContent = username;
                });

                activeMembersListEl.appendChild(li);
            });
        }).catch((err) => {
            console.error("Failed to load server owner:", err);
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
        const ownerUid = serverData ? serverData.createdBy : null;
        const isOwnerForKicks = serverData && serverData.createdBy === uid;
        const canManageKicks = isOwnerForKicks || isAdmin;

        if (membersSnap.exists()) {
            const memberUids = Object.keys(membersSnap.val());

            for (const memberUid of memberUids) {
                const [userSnap, adminSnap] = await Promise.all([
                    get(ref(db, `users/${memberUid}/username`)),
                    get(ref(db, `admins/${memberUid}`))
                ]);

                if (!userSnap.exists()) {
                    await remove(ref(db, `servers/${code}/members/${memberUid}`), writeOptions());
                    continue;
                }

                const username = userSnap.val();
                const isUserAdmin = adminSnap.exists() && adminSnap.val() === true;
                const isOwner = !isPublic && (memberUid === ownerUid);

                const li = document.createElement("li");

                if (isOwner && isUserAdmin) {
                    li.innerHTML = `<span class="member-list-admin">${username}</span> <i class="fa-solid fa-circle-check admin-badge" title="Admin"></i> <span title="Server owner">👑</span>`;
                } else if (isOwner && !isUserAdmin) {
                    li.innerHTML = `${username} <span title="Server owner">👑</span>`;
                } else if (isUserAdmin && !isOwner) {
                    li.innerHTML = `<span class="member-list-admin">${username}</span> <i class="fa-solid fa-circle-check admin-badge" title="Admin"></i>`;
                } else {
                    li.textContent = username;
                }

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


// PROFILE PICTURE
async function resizeImage(file, size = 256, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                let cropX = 0, cropY = 0, cropSize = 0;

                if (width === height) {
                    cropSize = width;
                } else if (width > height) {
                    cropSize = height;
                    cropX = (width - height) / 2; 
                    cropY = 0;
                } else {
                    cropSize = width; 
                    cropX = 0;
                    cropY = (height - width) / 2; 
                }

                const canvas = document.createElement("canvas");
                canvas.width = size; 
                canvas.height = size; 
                const ctx = canvas.getContext("2d");

                ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, size, size);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Canvas to Blob conversion failed"));
                        return;
                    }
                    const resizedFile = new File([blob], "avatar.webp", {
                        type: "image/webp",
                        lastModified: Date.now()
                    });
                    resolve(resizedFile);
                }, "image/webp", quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

async function handlePfpUpload(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("Please select a valid image file.");
        return;
    }

    try {
        if (!uid) return;

        const userRef = ref(db, `users/${uid}`);
        const userSnap = await get(userRef);
        const userData = userSnap.exists() ? userSnap.val() : {};
        
        const lastChange = userData.lastPfpChange || 0;
        const cooldown = 60 * 1000; 
        const timeElapsed = Date.now() - lastChange;

        if (timeElapsed < cooldown) {
            const remainingSecs = Math.ceil((cooldown - timeElapsed) / 1000);
            alert(`Please wait ${remainingSecs} seconds before changing your profile picture again.`);
            return;
        }

        console.log("Resizing profile picture...");
        const resizedFile = await resizeImage(file, 256, 256, 0.85);

        const oldPfpUrl = userData.pfpUrl;

        console.log(`Uploading resized PFP (${Math.round(resizedFile.size / 1024)} KB)...`);
        const pfpUrl = await uploadFile(resizedFile);

        if (oldPfpUrl && oldPfpUrl.includes("cdn.acetyl.cc")) {
            const oldFileName = oldPfpUrl.split("/").pop();
            if (oldFileName) {
                const deleteUrl = `${UPLOAD_URL.replace("/upload", "")}/delete-file?name=${oldFileName}`;
                fetch(deleteUrl, { method: "DELETE" }).catch(err => console.error("Old PFP cleanup failed:", err));
            }
        }

        await set(userRef, {
            ...userData,
            pfpUrl: pfpUrl,
            username: username,
            lastPfpChange: Date.now()
        }, writeOptions());

        const pfpEl = document.getElementById("profilePicture");
        if (pfpEl) pfpEl.src = pfpUrl;

        alert("Profile picture updated successfully!");
    } catch (err) {
        console.error("PFP upload failed:", err);
        alert("Failed to update profile picture. Try again.");
    }
}


// VOICECHAT
const peerConnections = {};
const iceCandidateQueues = {};
const processedCandidates = {}; 
const activeAnalysers = {};

let rtcConfig = null;
let globalAudioCtx = null;

async function getRtcConfig() {
    try {
        const response = await fetch(
            "https://acetyl-turn.realmeuse.workers.dev",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(`TURN Worker returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.iceServers || !Array.isArray(data.iceServers)) {
            throw new Error("Worker response does not contain valid iceServers.");
        }

        rtcConfig = {
            iceServers: data.iceServers,
            iceCandidatePoolSize: 10
        };

        console.log("[VoiceChat] Cloudflare TURN credentials loaded.");

        return rtcConfig;
    } catch (err) {
        console.error("[VoiceChat] Failed to get Cloudflare TURN credentials:", err);
        return null;
    }
}

async function joinVoiceChat(serverCode) {
    if (!uid) {
        uid = auth?.currentUser?.uid || window.uid;
    }
    
    if (!uid) {
        console.error("[VoiceChat] Cannot join voice chat: UID is undefined.");
        return;
    }

    if (voiceHeaderNameEl) {
        const serverName = serverCode === "public" ? "Public" : (myServers.find(s => s.code === serverCode)?.name || serverCode);
        voiceHeaderNameEl.textContent = serverName;
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

    const config = await getRtcConfig();

    if (!config) {
        alert("Could not connect to the voice server. Please try again.");
        return;
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

    switchView("voice");

    const voiceUserRef = ref(db, `servers/${serverCode}/voice/${uid}`);
    const existingSnap = await get(voiceUserRef);

    if (existingSnap.exists() && existingSnap.val().msgKey) {
        currentVoiceMsgKey = existingSnap.val().msgKey;
    } else {
        const botMsgRef = await sendBotMessage(serverCode, `🔊 @${username} is currently in voice chat`, {
            type: "JOIN_VOICE",
            serverCode: serverCode
        });
        currentVoiceMsgKey = botMsgRef ? botMsgRef.key : null;
    }

    await set(voiceUserRef, {
        username: username,
        joinedAt: serverTimestamp(),
        vcMuted: false,
        msgKey: currentVoiceMsgKey
    });

    onDisconnect(voiceUserRef).remove(writeOptions());
    if (currentVoiceMsgKey) {
        const botMsgRef = ref(db, `servers/${serverCode}/messages/${currentVoiceMsgKey}`);
        onDisconnect(botMsgRef).remove(writeOptions());
    }

    rightSidebarEl.style.display = 'none';

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

    if (activeUid && activeAnalysers[activeUid]) {
        try {
            if (activeAnalysers[activeUid].source) {
                activeAnalysers[activeUid].source.disconnect();
            }
        } catch (err) {
            console.warn("[VoiceChat] Error disconnecting local Web Audio source:", err);
        }
        delete activeAnalysers[activeUid];
    }

    if (localAudioStream) {
        localAudioStream.getTracks().forEach((track) => track.stop());
        localAudioStream = null;
    }

    if (activeServer && activeUid) {
        try {
            const userVoiceRef = ref(db, `servers/${activeServer}/voice/${activeUid}`);
            const userVoiceSnap = await get(userVoiceRef);

            if (userVoiceSnap.exists()) {
                const voiceData = userVoiceSnap.val();
                if (voiceData.msgKey) {
                    await remove(ref(db, `servers/${activeServer}/messages/${voiceData.msgKey}`));
                }
            }

            await remove(userVoiceRef);
            await remove(ref(db, `servers/${activeServer}/signal/${activeUid}`));
        } catch (err) {
            console.error("Error clearing voice session & message data from Firebase:", err);
        }
    }

    currentVoiceServer = null;
    currentVoiceMsgKey = null;
    updateServerVoiceIcons();

    if (voiceContainerEl) voiceContainerEl.classList.add("hidden");
    if (currentServer) {
        switchView("chat");
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
            const isMuted = userData.vcMuted === true;

            if (!isSelf && !peerConnections[userUid]) {
                const isInitiator = uid < userUid;
                createPeerConnection(userUid, isInitiator, serverCode);
            }

            const displayName = userData.username;

            const card = document.createElement("div");
            card.className = "voice-card";
            card.id = `voice-card-${userUid}`;

            const profile = getProfile(userUid, (freshProfile) => {
                const imgEl = card.querySelector(".voice-avatar");
                if (imgEl) imgEl.src = freshProfile.pfpUrl;
            });

            card.innerHTML = `
                <img class="voice-avatar" src="${profile.pfpUrl}" alt="Avatar">
                <div class="voiceUsername">
                    <span>${displayName}</span>
                    ${isMuted ? '<i class="fa-solid fa-microphone-slash voice-muted-icon" title="Muted"></i>' : ''}
                </div>
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

    if (activeAnalysers[targetUid]) {
        try {
            if (activeAnalysers[targetUid].source) {
                activeAnalysers[targetUid].source.disconnect();
            }
        } catch (err) {
            console.warn("[VoiceChat] Error disconnecting Web Audio source:", err);
        }
        delete activeAnalysers[targetUid];
    }

    delete iceCandidateQueues[targetUid];
    delete processedCandidates[targetUid];

    const audioEl = document.getElementById(`audio-${targetUid}`);
    if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove();
    }
}

function updateServerVoiceIcons() {
    const serverRows = serverListEl.querySelectorAll(".serverRow");
    serverRows.forEach(row => {
        const code = row.dataset.server;
        const hashEl = row.querySelector(".serverButton .serverHash") || row.querySelector(".serverButton span:first-child");
        if (!hashEl) return;

        if (code === currentVoiceServer) {
            hashEl.innerHTML = VOICE_ICON;
        } else if (code === "system") {
            hashEl.innerHTML = `<i class="fa-solid fa-gear"></i>`;
        } else {
            hashEl.innerHTML = HASH_ICON;
        }
    });
}

function setupSpeakingIndicator(stream, userUid) {
    try {
        if (!globalAudioCtx) {
            globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (globalAudioCtx.state === "suspended") {
            globalAudioCtx.resume();
        }
        const analyser = globalAudioCtx.createAnalyser();
        analyser.fftSize = 64;
        
        const source = globalAudioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        activeAnalysers[userUid] = { 
            analyser, 
            dataArray: new Uint8Array(analyser.frequencyBinCount),
            source 
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
        let average = sum / dataArray.length;
        
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


// SETTINGS
function initSettingsUI() {
    const checkboxMap = {
        'setting-high-contrast': 'highContrast',
        'setting-message-sound': 'messageSound',
        'setting-notifications': 'notifications',
        'setting-unread-badge': 'unreadBadge',
        'setting-pfp': 'showPfp',
        'setting-startup-sidebar': 'startupSidebar',
    };

    Object.keys(checkboxMap).forEach(id => {
        const el = document.getElementById(id);
        const key = checkboxMap[id];

        if (el) {
        el.checked = appSettings[key];

        el.addEventListener('change', (e) => {
            appSettings[key] = e.target.checked;
            localStorage.setItem('settings', JSON.stringify(appSettings));
            applySettings(key);
        });
        }
    });

    populateStartupServerOptions();

    const serverSelect = document.getElementById('setting-startup-server');
    if (serverSelect) {
        serverSelect.addEventListener('change', (e) => {
        appSettings.startupServer = e.target.value;
        localStorage.setItem('settings', JSON.stringify(appSettings));
        });
    }
}

function applySettings(changedKey = null) {
    if (!changedKey || changedKey === 'highContrast') {
        document.documentElement.classList.toggle('high-contrast', !!appSettings.highContrast);
    }

    if (changedKey === 'notifications' && appSettings.notifications) {
        if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
        }
    }

    if (!changedKey || changedKey === 'unreadBadge') {
        if (!appSettings.unreadBadge) {
            const badges = document.querySelectorAll('.unreadBadge');
            badges.forEach(badge => badge.style.display = 'none');
        }
    }

    if (!changedKey || changedKey === 'showPfp') {
        document.documentElement.classList.toggle('hide-pfp', !appSettings.showPfp);
    }
}

function populateStartupServerOptions() {
    const serverSelect = document.getElementById('setting-startup-server');
    if (!serverSelect) return;

    serverSelect.innerHTML = '';

    const defaultServers = [
        { code: 'public', name: '# Public' },
        { code: 'announcements', name: '# Announcements' }
    ];

    defaultServers.forEach(server => {
        const opt = document.createElement('option');
        opt.value = server.code;
        opt.textContent = server.name;
        serverSelect.appendChild(opt);
    });

    if (Array.isArray(myServers)) {
        myServers.forEach(server => {
        if (!defaultServers.some(ds => ds.code === server.code)) {
            const opt = document.createElement('option');
            opt.value = server.code;
            opt.textContent = "# " + server.name || server.code;
            serverSelect.appendChild(opt);
        }
        });
    }

    serverSelect.value = appSettings.startupServer || 'public';
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
    if (msg.uid === uid) return;
    if (msg.isSystem) return;
    if (msg.isDM && msg.dmToUid !== uid && msg.uid !== uid) return;

    if (isTabActive() && serverId === currentServer) return;

    if (appSettings.messageSound && newMessage) {
        newMessage.currentTime = 0;
        newMessage.play().catch(err => {
        console.warn("Autoplay blocked sound until first user interaction:", err);
        });
    }

    if (!isTabActive() && Notification.permission === "granted" && appSettings.notifications) {
        let serverName = serverId;
        if (serverId === "public") serverName = "public";
        else if (serverId === "announcements") serverName = "announcements";
        else {
            const found = myServers.find(s => s.code === serverId);
            if (found) serverName = found.name;
        }

        const profile = getProfile(msg.uid, (freshProfile) => {});

        const senderName = profile.username && profile.username !== "Loading..." ? profile.username : "Someone";
        const senderIcon = profile.pfpUrl || "/client/Assets/pfp.png";

        const title = `${senderName} sent a message`;
        const body = `on #${serverName}`;

        new Notification(title, { 
            body, 
            icon: senderIcon 
        });
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
                if (badge && appSettings.unreadBadge) {
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

async function showServerContextMenu(e, serverCode) {
    e.preventDefault(); 
    e.stopPropagation();

    if (serverCode === "public" || serverCode === "announcements") return;

    contextMenuTargetServer = serverCode;
    updateKickButton(serverCode);

    const isSystem = serverCode === "system";
    if (contextInviteBtnEl) contextInviteBtnEl.style.display = isSystem ? "none" : "block";
    if (contextKickBtnEl) contextKickBtnEl.style.display = isSystem ? "none" : "block";

    if (contextLeaveBtnEl) {
        try {
            const serverSnap = await get(ref(db, `servers/${serverCode}`));
            const serverData = serverSnap.exists() ? serverSnap.val() : null;
            const isOwner = serverData && serverData.createdBy === uid;

            if (isOwner) {
                contextLeaveBtnEl.textContent = "Delete Server";
                contextLeaveBtnEl.classList.add("danger");
            } else {
                contextLeaveBtnEl.textContent = "Leave Server";
                contextLeaveBtnEl.classList.add("danger");
            }
        } catch (err) {
            contextLeaveBtnEl.textContent = "Leave Server";
            contextLeaveBtnEl.classList.add("danger");
        }
    }

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

    document.querySelectorAll(".message.right-clicked").forEach(el => {
        el.classList.remove("right-clicked");
    });
}

async function showMessageContextMenu(e, msg) {
    e.preventDefault();
    e.stopPropagation();

    document.querySelectorAll(".message.right-clicked").forEach(el => {
        el.classList.remove("right-clicked");
    });

    targetContextMenuMsg = msg;

    const msgEl = messagesListEl.querySelector(`[data-id="${msg.id}"]`);
    if (msgEl) {
        msgEl.classList.add("right-clicked");
    }

    const serverSnap = await get(ref(db, `servers/${currentServer}`));
    const serverData = serverSnap.exists() ? serverSnap.val() : null;
    const isOwner = serverData && serverData.createdBy === uid;
    const targetAdminSnap = await get(ref(db, `admins/${msg.uid}`));
    const isTargetAdmin = targetAdminSnap.exists() && targetAdminSnap.val() === true;

    const canDelete = isAdmin || isOwner;
    if (msgContextDelete) {
        if (canDelete) {
            msgContextDelete.classList.remove("disabled");
            msgContextDelete.style.display = "block";
        } else {
            msgContextDelete.classList.add("disabled");
            msgContextDelete.style.display = "none";
        }
    }

    const canKick = (isAdmin && currentServer !== "public") || (isOwner && currentServer !== "public");
    if (msgContextKick) {
        if (canKick) {
            msgContextKick.classList.remove("disabled");
            msgContextKick.style.display = "block";
        } else {
            msgContextKick.classList.add("disabled");
            msgContextKick.style.display = "none";
        }
    }

    if (msgContextGetUid) {
        msgContextGetUid.style.display = isAdmin ? "block" : "none";
    }

    if (msgContextBan) {
        msgContextBan.style.display = isAdmin ? "block" : "none";
    }

    if (msgContextMuteBtnEl) {
        if (isAdmin && msg.uid !== uid) {
            try {
                if (!isTargetAdmin) {
                    const muteSnap = await get(ref(db, `mutes/${msg.uid}`));
                    msgContextMuteBtnEl.textContent = muteSnap.exists() ? "Unmute User" : "Mute User";
                    msgContextMuteBtnEl.classList.remove("disabled");
                    msgContextMuteBtnEl.style.display = "block";
                } else {
                    msgContextMuteBtnEl.style.display = "none";
                }
            } catch (err) {
                msgContextMuteBtnEl.style.display = "none";
            }
        } else {
            msgContextMuteBtnEl.style.display = "none";
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
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('invite');
    
    if (!joinCode) return false;

    history.replaceState("", document.title, window.location.pathname);

    if (joinCode === "public" || joinCode === "announcements" || myServers.some(s => s.code === joinCode)) {
        switchServer(joinCode);
        return true;
    }

    try {
        const kickSnap = await get(ref(db, `servers/${joinCode}/kicked/${uid}`));
        if (kickSnap.exists()) {
            alert("You have been kicked from this server.");
            return false;
        }

        const serverRef = ref(db, `servers/${joinCode}`);
        const snapshot = await get(serverRef);

        if (!snapshot.exists()) {
            alert("Invalid invite link.");
            return false;
        }

        const serverData = snapshot.val();
        const serverName = serverData.name || `Server ${joinCode}`;

        if (uid) {
            await Promise.all([
                set(ref(db, `servers/${joinCode}/members/${uid}`), true, writeOptions()),
                set(ref(db, `users/${uid}/joinedServers/${joinCode}`), true, writeOptions())
            ]);
        }

        await sendBotMessage(joinCode, `👋 @${username} joined the server!`);

        addServerToSidebar(joinCode, serverName);
        switchServer(joinCode);
        setupNotificationListener(joinCode);
        
        return true;
    } catch (err) {
        console.error("Failed to handle invite:", err);
        return false;
    }
}

function setInputDisabledState(isDisabled, placeholderText) {
    if (!messageInputEl) return;

    if (isDisabled) {
        messageInputEl.removeAttribute("contenteditable");
        messageInputEl.classList.add("disabled");
        messageInputEl.setAttribute("data-placeholder", placeholderText);
        messageInputEl.textContent = "";

        if (fileInputEl) fileInputEl.disabled = true;
        if (typeof attachBtnEl !== "undefined" && attachBtnEl) attachBtnEl.disabled = true;
    } else {
        messageInputEl.setAttribute("contenteditable", "plaintext-only");
        messageInputEl.classList.remove("disabled");
        messageInputEl.setAttribute("data-placeholder", placeholderText);

        if (fileInputEl) fileInputEl.disabled = false;
        if (typeof attachBtnEl !== "undefined" && attachBtnEl) attachBtnEl.disabled = false;
    }
}