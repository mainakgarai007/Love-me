import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, query, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
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
  let app = null, auth = null, db = null, currentUser = null, campaignId = null, campaign = null, visitorId = null, yesSubmitted = false;
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
  }
  function showRecipient() {
    $("#brand").hidden = true; $("#footer").hidden = true;
    creatorView.hidden = true; recipientView.hidden = false; invalidView.hidden = true;
    document.body.classList.add("recipient-mode");
  }
  function showInvalid() {
    $("#brand").hidden = false; $("#footer").hidden = false;
    creatorView.hidden = true; recipientView.hidden = true; invalidView.hidden = false;
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
        ...event, isRepeat, createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
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
    if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate().getTime() <= Date.now()) { showInvalid(); return; }
    campaignId = id; campaign = data; visitorId = browserVisitorId(id).id;
    showRecipient();
    $("#recipient-question").textContent = data.question || "Do You Love Me?";
    $("#recipient-caption").textContent = "A tiny question, just for " + (data.loveName || "you") + ".";
    await recordEvent("visit");
    startOldMusic();
  }
  async function createCampaign(creatorName, loveName, question) {
    if (!auth || !db || !currentUser) {
      message(creatorMessage, "Connecting your temporary account… Please try again in a moment.", "error");
      return;
    }
    const id = safeId().replaceAll("-", "").slice(0, 18);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const item = { id, creatorName, loveName, question, createdAt: new Date().toISOString(), expiresAt: expiresAt.toDate().toISOString() };
    await setDoc(doc(db, "campaigns", id), {
      ownerUid: currentUser.uid, creatorName, loveName, question, active: true,
      createdAt: serverTimestamp(), expiresAt
    });
    saveLocalCampaign(item);
    try { localStorage.setItem("love-me-last-campaign-id", id); } catch (_) {}
    const url = new URL(window.location.href);
    url.search = ""; url.searchParams.set("love", id);
    shareUrl.value = url.toString(); shareCard.hidden = false;
    dashboard.dataset.campaignId = id; dashboard.hidden = false;
    dashboardNote.textContent = "Temporary account: " + creatorName + ". Link expires in 7 days. This browser keeps a local copy.";
    message(creatorMessage, "Your love link is ready. Copy it and share it ❤️", "success");
    await refreshDashboard();
  }
  async function refreshDashboard() {
    const id = dashboard.dataset.campaignId || campaignId;
    if (!id || !db || !currentUser) return;
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

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const creatorName = $("#creator-name").value.trim(), loveName = $("#love-name").value.trim(), question = $("#question-choice").value;
    if (!creatorName || !loveName) return;
    try {
      localStorage.setItem("love-me-creator-name", creatorName);
      await createCampaign(creatorName, loveName, question);
    } catch (error) { console.error(error); message(creatorMessage, "Could not create the link. Check Firebase Authentication and Firestore rules.", "error"); }
  });
  try { $("#creator-name").value = localStorage.getItem("love-me-creator-name") || ""; } catch (_) {}
  $("#copy-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl.value); message(creatorMessage, "Link copied! Share it with care ❤️", "success"); }
    catch (_) { shareUrl.focus(); shareUrl.select(); message(creatorMessage, "Select and copy the link from the box above.", "error"); }
  });
  $("#refresh-dashboard").addEventListener("click", () => refreshDashboard().catch(console.error));
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
        dashboardNote.textContent = "Local saved link for " + local.loveName + ". Cloud link expires: " + new Date(local.expiresAt).toLocaleString() + ".";
        if (currentUser) await refreshDashboard();
      }
    }).catch((error) => { console.error(error); message(creatorMessage, "Firebase could not start. Check the config file.", "error"); });
  }
})();