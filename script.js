import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const creatorView = $("#creator-view"), recipientView = $("#recipient-view"), invalidView = $("#invalid-view");
  const createForm = $("#create-form"), creatorMessage = $("#creator-message"), shareCard = $("#share-card"), shareUrl = $("#share-url");
  const dashboard = $("#dashboard"), signInButton = $("#sign-in"), signOutButton = $("#sign-out"), dashboardNote = $("#dashboard-note");
  const stats = $("#stats"), historyWrap = $("#history-wrap"), music = $("#background-music");
  const noButton = $("#no-button"), yesButton = $("#yes-button"), stage = $("#button-stage"), result = $("#recipient-result");
  const detailsForm = $("#recipient-details");
  const quickMenu = $("#quick-menu"), quickMenuToggle = $("#quick-menu-toggle"), quickMenuPanel = $("#quick-menu-panel"), feedbackModal = $("#feedback-modal");
  const accountNoticeModal = $("#account-notice-modal");
  const accountNotice = $("#account-notice-backdrop");
  let pendingCreate = null;
  let app = null, auth = null, db = null, currentUser = null, campaignId = null, campaign = null, visitorId = null, yesSubmitted = false, pendingCampaign = null;
  const LOCAL_CAMPAIGNS_KEY = "love-me-local-campaigns-v2";
  const firebaseReady = Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && !["YOUR_API_KEY", "YOUR_FIREBASE_API_KEY"].includes(firebaseConfig.apiKey));

  function message(element, text, kind = "") {
    if (!element) return;
    element.textContent = text;
    element.className = "message" + (kind ? " " + kind : "");
  }
  function safeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
  function readLocalCampaigns() {
    try { return JSON.parse(localStorage.getItem(LOCAL_CAMPAIGNS_KEY) || "[]"); } catch (_) { return []; }
  }
  function saveLocalCampaign(item) {
    try {
      const items = readLocalCampaigns().filter((old) => old.id !== item.id);
      items.unshift(item);
      localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(items.slice(0, 30)));
    } catch (_) {}
  }
  function cacheLocalEvent(id, event) {
    try {
      const key = "love-me-local-events-" + id;
      const events = JSON.parse(localStorage.getItem(key) || "[]");
      events.unshift({ ...event, localTime: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(events.slice(0, 300)));
    } catch (_) {}
  }
  function browserVisitorId(id) {
    const key = "love-me-visitor-" + id;
    let value = localStorage.getItem(key);
    const returning = Boolean(value);
    if (!value) {
      value = safeId();
      try { localStorage.setItem(key, value); } catch (_) {}
    }
    return { id: value, returning };
  }
  function showCreator() {
    $("#brand").hidden = false; $("#footer").hidden = false;
    creatorView.hidden = false; recipientView.hidden = true; invalidView.hidden = true; dashboard.hidden = false;
    quickMenu.hidden = false;
  }
  function showRecipient() {
    $("#brand").hidden = true; $("#footer").hidden = true;
    creatorView.hidden = true; recipientView.hidden = false; invalidView.hidden = true;
    document.body.classList.add("recipient-mode");
    quickMenu.hidden = false;
  }
  function showInvalid() {
    $("#brand").hidden = false; $("#footer").hidden = false;
    creatorView.hidden = true; recipientView.hidden = true; invalidView.hidden = false;
    quickMenu.hidden = true;
  }
  function startOldMusic() {
    if (!music) return;
    music.volume = 0.3;
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
  }
  function moveNoButton() {
    const box = stage.getBoundingClientRect(), button = noButton.getBoundingClientRect(), pad = 4;
    const maxX = Math.max(pad, box.width - button.width - pad);
    const maxY = Math.max(pad, box.height - button.height - pad);
    noButton.style.position = "absolute";
    noButton.style.left = (pad + Math.random() * Math.max(0, maxX - pad)) + "px";
    noButton.style.top = (pad + Math.random() * Math.max(0, maxY - pad)) + "px";
  }
  async function recordEvent(type, extra = {}) {
    if (!campaignId || !visitorId) return;
    const event = { type, visitorId, recipientName: extra.recipientName || "", contact: extra.contact || "", campaignId };
    cacheLocalEvent(campaignId, event);
    if (!db) return;
    try {
      const interactionKey = "love-me-interacted-" + campaignId + "-" + visitorId;
      let isRepeat = false;
      try {
        isRepeat = localStorage.getItem(interactionKey) === "1";
        if (["yes", "no_attempt", "details"].includes(type)) localStorage.setItem(interactionKey, "1");
      } catch (_) {}
      await addDoc(collection(db, "campaigns", campaignId, "events"), {
        ...event, isRepeat, createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Could not save response event", error);
      if (type === "yes") message($("#recipient-message"), "Your answer is saved on this phone, but cloud saving failed.", "error");
    }
  }
  async function loadCampaign(id) {
    if (!db) { showInvalid(); return; }
    const snap = await getDoc(doc(db, "campaigns", id));
    if (!snap.exists() || snap.data().active === false) { showInvalid(); return; }
    const data = snap.data();
    campaignId = id; campaign = data; visitorId = browserVisitorId(id).id;
    showRecipient();
    $("#recipient-question").textContent = data.question || "Do You Love Me?";
    $("#recipient-caption").textContent = "A tiny question, just for " + (data.loveName || "you") + ".";
    await recordEvent("visit");
    startOldMusic();
  }
  async function getUserCampaigns() {
    if (!db || !currentUser) return readLocalCampaigns();
    const campaignsQuery = query(collection(db, "campaigns"), where("ownerUid", "==", currentUser.uid));
    const snapshot = await getDocs(campaignsQuery);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return ta - tb;
      });
  }
  async function refreshUserLinks() {
    const list = $("#user-links"), count = $("#link-count");
    if (!list || !count) return;
    let items = [];
    try { items = await getUserCampaigns(); }
    catch (error) { console.error("Could not load link list", error); }
    count.textContent = Math.min(items.length, 3) + "/3";
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "You haven't created any links yet.";
      list.append(empty); return;
    }
    items.slice(0, 3).forEach((item, index) => {
      const row = document.createElement("div"); row.className = "user-link-row" + (item.id === (dashboard.dataset.campaignId || campaignId) ? " is-selected" : "");
      const select = document.createElement("button"); select.type = "button"; select.className = "user-link-select";
      select.textContent = (index + 1) + " link · " + (item.loveName || "Special person");
      select.addEventListener("click", async () => {
        dashboard.dataset.campaignId = item.id;
        campaignId = item.id;
        const url = new URL(window.location.href); url.search = ""; url.searchParams.set("love", item.id);
        shareUrl.value = url.toString(); shareCard.hidden = false; dashboard.hidden = false; $("#delete-link").hidden = false;
        await refreshDashboard(); await refreshUserLinks();
      });
      const open = document.createElement("button"); open.type = "button"; open.className = "user-link-open"; open.textContent = "↗";
      open.setAttribute("aria-label", "Open link " + (index + 1));
      open.addEventListener("click", () => {
        const url = new URL(window.location.href); url.search = ""; url.searchParams.set("love", item.id);
        window.open(url.toString(), "_blank", "noopener,noreferrer");
      });
      row.append(select, open); list.append(row);
    });
  }
  async function createCampaign(creatorName, loveName, question) {
    if (!auth || !db || !currentUser) {
      message(creatorMessage, "Connecting your temporary account… Please try again in a moment.", "error");
      return;
    }
    const existingCampaigns = await getUserCampaigns();
    const activeCount = existingCampaigns.length;
    if (activeCount >= 3) {
      message(creatorMessage, "You already have 3 active links. Delete one of your existing links before creating another.", "error");
      return;
    }
    const id = safeId().replaceAll("-", "").slice(0, 18);
    const item = { id, creatorName, loveName, question, createdAt: new Date().toISOString() };
    await setDoc(doc(db, "campaigns", id), {
      ownerUid: currentUser.uid, creatorName, loveName, question, active: true,
      createdAt: serverTimestamp()
    });
    saveLocalCampaign(item);
    try { localStorage.setItem("love-me-last-campaign-id", id); } catch (_) {}
    const url = new URL(window.location.href);
    url.search = ""; url.searchParams.set("love", id);
    shareUrl.value = url.toString(); shareCard.hidden = false;
    dashboard.dataset.campaignId = id; dashboard.hidden = false; $("#delete-link").hidden = false;
    dashboardNote.textContent = "Temporary account: " + creatorName + ". This link has no automatic 7-day expiry. Keep this browser data safe.";
    message(creatorMessage, "Your love link is ready. Copy it and share it ❤️", "success");
    await refreshDashboard();
    await refreshUserLinks();
  }
  async function refreshDashboard() {
    const id = dashboard.dataset.campaignId || campaignId;\n    if (!id || !db || !currentUser) { await refreshUserLinks(); return; }
    await refreshUserLinks();
    const campaignSnap = await getDoc(doc(db, "campaigns", id));
    if (!campaignSnap.exists() || campaignSnap.data().ownerUid !== currentUser.uid) {
      dashboardNote.textContent = "This dashboard is available only in the browser that created the link.";
      stats.hidden = true; historyWrap.hidden = true; return;
    }
    const eventSnap = await getDocs(query(collection(db, "campaigns", id, "events"), orderBy("createdAt", "desc")));
    const events = eventSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    try { localStorage.setItem("love-me-local-events-" + id, JSON.stringify(events.map((event) => ({ ...event, createdAt: event.createdAt && event.createdAt.toDate ? event.createdAt.toDate().toISOString() : null })))); } catch (_) {}
    const visitorSet = new Set(events.filter(e => e.type === "visit").map(e => e.visitorId));
    const yesEvents = events.filter(e => e.type === "yes"), noEvents = events.filter(e => e.type === "no_attempt"), repeatEvents = events.filter(e => e.isRepeat);
    $("#unique-count").textContent = visitorSet.size; $("#yes-count").textContent = yesEvents.length;
    $("#no-count").textContent = noEvents.length; $("#repeat-count").textContent = repeatEvents.length;
    stats.hidden = false; historyWrap.hidden = false; $("#stats-footnote").hidden = false;
    dashboardNote.textContent = "Link for " + campaignSnap.data().loveName + " · responses update when you refresh.";
    const history = $("#history"); history.replaceChildren();
    if (!events.length) history.innerHTML = '<p class="empty-state">No activity yet. Share the link to start receiving responses.</p>';
    events.forEach((event) => {
      const row = document.createElement("article"); row.className = "history-item";
      const title = document.createElement("strong");
      title.textContent = ({ visit: "Opened the link", yes: "Tapped Yes 💗", no_attempt: "Tried to tap No 🙈", details: "Shared optional details" })[event.type] || "Activity";
      const sub = document.createElement("p"), bits = [];
      if (event.recipientName) bits.push("Name: " + event.recipientName);
      if (event.contact) bits.push("Contact shared: " + event.contact);
      if (event.isRepeat) bits.push("Repeat visit / attempt");
      if (event.createdAt && event.createdAt.toDate) bits.push(event.createdAt.toDate().toLocaleString());
      sub.textContent = bits.join(" · ") || "Anonymous visitor"; row.append(title, sub); history.append(row);
    });
  }
  async function startApp() {
    if (!firebaseReady) {
      message(creatorMessage, "Firebase setup is needed before share links and cross-device responses can work.", "error");
      return;
    }
    app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      signInButton.hidden = true; signOutButton.hidden = true;
      dashboardNote.textContent = user ? "Connected using a temporary account; no login screen is shown." : "Creating your temporary account…";
    });
    if (!auth.currentUser) {
      try { await signInAnonymously(auth); }
      catch (error) {
        console.error("Anonymous sign-in failed", error);
        message(creatorMessage, "Could not create a temporary account. Enable Anonymous sign-in in Firebase Authentication.", "error");
      }
    }
  }

  createForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const creatorName = $("#creator-name").value.trim(), loveName = $("#love-name").value.trim(), question = $("#question-choice").value;
    if (!creatorName || !loveName) return;
    pendingCreate = { creatorName, loveName, question };
    accountNotice.hidden = false;
    $("#account-notice-ok").focus();
  });
  $("#account-notice-cancel").addEventListener("click", () => { pendingCreate = null; accountNotice.hidden = true; });
  $("#account-notice-ok").addEventListener("click", async () => {
    if (!pendingCreate) { accountNotice.hidden = true; return; }
    const data = pendingCreate;
    pendingCreate = null;
    accountNotice.hidden = true;
    try {
      localStorage.setItem("love-me-creator-name", data.creatorName);
      await createCampaign(data.creatorName, data.loveName, data.question);
    } catch (error) {
      console.error(error);
      message(creatorMessage, "Could not create link (" + (error.code || error.message || "unknown error") + "). Check Firebase config, Anonymous Authentication, and published Firestore rules.", "error");
    }
  });
  accountNotice.addEventListener("click", (event) => { if (event.target === accountNotice) { pendingCreate = null; accountNotice.hidden = true; } });
  try { $("#creator-name").value = localStorage.getItem("love-me-creator-name") || ""; } catch (_) {}
  $("#copy-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl.value); message(creatorMessage, "Link copied! Share it with care ❤️", "success"); }
    catch (_) { shareUrl.focus(); shareUrl.select(); message(creatorMessage, "Select and copy the link from the box above.", "error"); }
  });
  async function confirmCreateCampaign() {
    if (!pendingCampaign) { accountNoticeModal.hidden = true; return; }
    const details = pendingCampaign;
    pendingCampaign = null;
    accountNoticeModal.hidden = true;
    try { await createCampaign(details.creatorName, details.loveName, details.question); }
    catch (error) {
      console.error(error);
      message(creatorMessage, "Could not create link (" + (error.code || error.message || "unknown error") + "). Check Firebase Authentication and Firestore rules.", "error");
    }
  }
  $("#account-notice-ok").addEventListener("click", confirmCreateCampaign);
  $("#account-notice-cancel").addEventListener("click", () => { pendingCampaign = null; accountNoticeModal.hidden = true; });
  $("#account-notice-close").addEventListener("click", () => { pendingCampaign = null; accountNoticeModal.hidden = true; });
  accountNoticeModal.addEventListener("click", (event) => { if (event.target === accountNoticeModal) { pendingCampaign = null; accountNoticeModal.hidden = true; } });

  $("#refresh-dashboard").addEventListener("click", () => refreshDashboard().catch((error) => {
    console.error(error);
    dashboardNote.textContent = "Could not refresh: " + (error.code || error.message || "unknown error");
  }));
  $("#delete-link").addEventListener("click", async () => {
    const id = dashboard.dataset.campaignId || campaignId;
    if (!id) return;
    if (!window.confirm("Delete this love link from Firebase and this phone? Anyone using the link will no longer be able to open it.")) return;
    try {
      if (db && currentUser) {
        const ref = doc(db, "campaigns", id);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().ownerUid === currentUser.uid) {
          const eventsSnap = await getDocs(collection(db, "campaigns", id, "events"));
          for (const eventDoc of eventsSnap.docs) await deleteDoc(eventDoc.ref);
          await deleteDoc(ref);
        }
      }
      const remaining = readLocalCampaigns().filter(item => item.id !== id);
      try {
        localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(remaining));
        localStorage.removeItem("love-me-local-events-" + id);
        if (localStorage.getItem("love-me-last-campaign-id") === id) localStorage.removeItem("love-me-last-campaign-id");
      } catch (_) {}
      dashboard.dataset.campaignId = ""; campaignId = null;
      shareCard.hidden = true; dashboard.hidden = false; $("#delete-link").hidden = true;
      await refreshUserLinks();
      message(creatorMessage, "Link deleted from this phone. If Firebase deletion was blocked, cloud data may still remain.", "success");
    } catch (error) {
      console.error("Delete link failed", error);
      message(creatorMessage, "Could not delete from Firebase (" + (error.code || error.message || "unknown error") + "). Check published Firestore rules; local data was kept.", "error");
    }
  });

  function setQuickMenuOpen(open) {
    quickMenu.classList.toggle("is-open", open);
    quickMenuPanel.hidden = !open;
    quickMenuToggle.setAttribute("aria-expanded", String(open));
    quickMenuToggle.setAttribute("aria-label", open ? "Close quick menu" : "Open quick menu");
  }
  quickMenuToggle.addEventListener("click", () => setQuickMenuOpen(quickMenuPanel.hidden));
  $("#quick-menu-close").addEventListener("click", () => setQuickMenuOpen(false));
  $("#create-own-link").addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.search = "";
    window.location.href = url.toString();
  });
  $("#open-feedback").addEventListener("click", () => {
    setQuickMenuOpen(false);
    feedbackModal.hidden = false;
    $("#feedback-message").focus();
  });
  $("#feedback-close").addEventListener("click", () => { feedbackModal.hidden = true; });
  feedbackModal.addEventListener("click", (event) => { if (event.target === feedbackModal) feedbackModal.hidden = true; });
  $("#feedback-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const feedback = $("#feedback-message").value.trim();
    const contact = $("#feedback-contact").value.trim();
    if (!feedback) return;
    const title = "Love-me feedback";
    const body = feedback + (contact ? "\\n\\nOptional contact/social link: " + contact : "") + "\\n\\nSent from Love-me website.";
    const url = "https://github.com/mainakgarai007/Love-me/issues/new?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
    window.open(url, "_blank", "noopener,noreferrer");
    feedbackModal.hidden = true;
  });
  noButton.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") moveNoButton(); });
  noButton.addEventListener("pointerdown", (event) => { event.preventDefault(); recordEvent("no_attempt"); moveNoButton(); });
  noButton.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); if (event.detail === 0) recordEvent("no_attempt"); moveNoButton(); });
  yesButton.addEventListener("click", async () => {
    if (yesSubmitted) return;
    yesSubmitted = true; stage.hidden = true;
    if (music) { music.pause(); music.currentTime = 0; }
    const loveMusic = new Audio("Love-me.mp3");
    loveMusic.loop = true;
    loveMusic.volume = 0.45;
    window.__loveMeResultMusic = loveMusic;
    const musicPromise = loveMusic.play();
    if (musicPromise && musicPromise.catch) musicPromise.catch((error) => console.warn("Love-me.mp3 playback was blocked or the file was unavailable", error));
    result.hidden = false;
    $("#question-card").hidden = true;
    const video = result.querySelector("video");
    if (video) { video.muted = false; const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    await recordEvent("yes");
  });
  detailsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const recipientName = $("#recipient-name").value.trim(), contact = $("#recipient-contact").value.trim();
    if (!recipientName && !contact) { message($("#recipient-message"), "Nothing to submit—you're welcome to leave everything blank."); return; }
    await recordEvent("details", { recipientName, contact });
    message($("#recipient-message"), "Thanks! Your optional details have been submitted.", "success");
    detailsForm.querySelector('button[type="submit"]').disabled = true;
  });

  const params = new URLSearchParams(window.location.search), linkId = params.get("love");
  if (linkId) {
    creatorView.hidden = true;
    startApp().then(() => loadCampaign(linkId)).catch((error) => { console.error(error); showInvalid(); });
  } else {
    showCreator();
    startApp().then(async () => {
      const lastId = (() => { try { return localStorage.getItem("love-me-last-campaign-id"); } catch (_) { return null; } })();
      const local = readLocalCampaigns().find((item) => item.id === lastId);
      if (local) {
        dashboard.dataset.campaignId = local.id;
        shareUrl.value = new URL("?love=" + encodeURIComponent(local.id), window.location.href).toString();
        shareCard.hidden = false;
        dashboard.hidden = false;
        $("#creator-name").value = local.creatorName || $("#creator-name").value;
        $("#love-name").value = local.loveName || "";
        $("#question-choice").value = local.question || "Do You Love Me?";
  dashboardNote.textContent = "Local saved link for " + local.loveName + ". This link has no automatic 7-day expiry.";
        if (currentUser) await refreshDashboard();
      } else { await refreshUserLinks(); }
    }).catch((error) => { console.error(error); message(creatorMessage, "Firebase could not start. Check the config file.", "error"); });
  }
})();