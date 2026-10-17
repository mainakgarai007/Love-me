import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const creatorView = $("#creator-view");
  const recipientView = $("#recipient-view");
  const invalidView = $("#invalid-view");
  const createForm = $("#create-form");
  const creatorMessage = $("#creator-message");
  const shareCard = $("#share-card");
  const shareUrl = $("#share-url");
  const dashboard = $("#dashboard");
  const signInButton = $("#sign-in");
  const signOutButton = $("#sign-out");
  const dashboardNote = $("#dashboard-note");
  const stats = $("#stats");
  const historyWrap = $("#history-wrap");
  const music = $("#background-music");
  const noButton = $("#no-button");
  const yesButton = $("#yes-button");
  const stage = $("#button-stage");
  const result = $("#recipient-result");
  const detailsForm = $("#recipient-details");
  let app = null, auth = null, db = null, currentUser = null;
  let campaignId = null, campaign = null, visitorId = null, yesSubmitted = false, noAttempts = 0;
  let firebaseReady = Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== "YOUR_API_KEY");

  function message(element, text, kind = "") {
    if (!element) return;
    element.textContent = text;
    element.className = "message" + (kind ? " " + kind : "");
  }
  function safeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
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
    creatorView.hidden = false;
    recipientView.hidden = true;
    invalidView.hidden = true;
    dashboard.hidden = false;
  }
  function showRecipient() {
    creatorView.hidden = true;
    recipientView.hidden = false;
    invalidView.hidden = true;
  }
  function showInvalid() {
    creatorView.hidden = true;
    recipientView.hidden = true;
    invalidView.hidden = false;
  }
  function setMusic() {
    if (!music) return;
    music.volume = 0.3;
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
  }
  function moveNoButton() {
    const box = stage.getBoundingClientRect();
    const button = noButton.getBoundingClientRect();
    const pad = 4;
    const maxX = Math.max(pad, box.width - button.width - pad);
    const maxY = Math.max(pad, box.height - button.height - pad);
    noButton.style.position = "absolute";
    noButton.style.left = (pad + Math.random() * Math.max(0, maxX - pad)) + "px";
    noButton.style.top = (pad + Math.random() * Math.max(0, maxY - pad)) + "px";
  }
  async function recordEvent(type, extra = {}) {
    if (!db || !campaignId || !visitorId) return;
    try {
      await addDoc(collection(db, "campaigns", campaignId, "events"), {
        type, visitorId, isRepeat: Boolean(browserVisitorId(campaignId).returning),
        createdAt: serverTimestamp(),
        recipientName: extra.recipientName || "",
        contact: extra.contact || ""
      });
    } catch (error) {
      console.error("Could not save response event", error);
      if (type === "yes") message($("#recipient-message"), "Your answer showed, but it couldn't be saved. The creator may need to check Firebase setup.", "error");
    }
  }
  async function loadCampaign(id) {
    if (!db) { showInvalid(); message(creatorMessage, "Firebase isn't configured yet. Add your Firebase Web App config to firebase-config.js first.", "error"); return; }
    const snap = await getDoc(doc(db, "campaigns", id));
    if (!snap.exists() || snap.data().active === false) { showInvalid(); return; }
    campaignId = id;
    campaign = snap.data();
    const visitor = browserVisitorId(id);
    visitorId = visitor.id;
    showRecipient();
    $("#recipient-question").textContent = "Do you love " + campaign.loveName + "?";
    $("#recipient-caption").textContent = "A tiny question, just for " + campaign.loveName + ".";
    await recordEvent("visit");
  }
  async function createCampaign(name) {
    if (!auth || !db) {
      message(creatorMessage, "First connect your Firebase Web App in firebase-config.js. Then this can create a shareable link.", "error");
      return;
    }
    if (!currentUser) {
      message(creatorMessage, "Sign in with Google first, then create your link.", "error");
      signInButton.focus();
      return;
    }
    const id = safeId().replaceAll("-", "").slice(0, 18);
    await setDoc(doc(db, "campaigns", id), {
      ownerUid: currentUser.uid,
      loveName: name,
      active: true,
      createdAt: serverTimestamp()
    });
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("love", id);
    shareUrl.value = url.toString();
    shareCard.hidden = false;
    dashboard.dataset.campaignId = id;
    dashboard.hidden = false;
    message(creatorMessage, "Your love link is ready. Copy it and share it ❤️", "success");
    await refreshDashboard();
  }
  async function refreshDashboard() {
    const id = dashboard.dataset.campaignId || campaignId;
    if (!id || !db || !currentUser) return;
    const campaignSnap = await getDoc(doc(db, "campaigns", id));
    if (!campaignSnap.exists() || campaignSnap.data().ownerUid !== currentUser.uid) {
      dashboardNote.textContent = "Sign in with the account that created this link to view its responses.";
      stats.hidden = true; historyWrap.hidden = true; return;
    }
    const eventSnap = await getDocs(query(collection(db, "campaigns", id, "events"), orderBy("createdAt", "desc")));
    const events = eventSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const visitorSet = new Set(events.filter(e => e.type === "visit").map(e => e.visitorId));
    const yesEvents = events.filter(e => e.type === "yes");
    const noEvents = events.filter(e => e.type === "no_attempt");
    const repeatEvents = events.filter(e => e.isRepeat);
    $("#unique-count").textContent = visitorSet.size;
    $("#yes-count").textContent = yesEvents.length;
    $("#no-count").textContent = noEvents.length;
    $("#repeat-count").textContent = repeatEvents.length;
    stats.hidden = false; historyWrap.hidden = false; $("#stats-footnote").hidden = false;
    dashboardNote.textContent = "Link for " + campaignSnap.data().loveName + " · responses update when you refresh.";
    const history = $("#history");
    history.replaceChildren();
    if (!events.length) history.innerHTML = '<p class="empty-state">No activity yet. Share the link to start receiving responses.</p>';
    events.forEach((event) => {
      const row = document.createElement("article");
      row.className = "history-item";
      const title = document.createElement("strong");
      const labels = { visit: "Opened the link", yes: "Tapped Yes 💗", no_attempt: "Tried to tap No 🙈", details: "Shared optional details" };
      title.textContent = labels[event.type] || "Activity";
      const sub = document.createElement("p");
      const bits = [];
      if (event.recipientName) bits.push("Name: " + event.recipientName);
      if (event.contact) bits.push("Contact shared: " + event.contact);
      if (event.isRepeat) bits.push("Repeat visit / attempt");
      if (event.createdAt && event.createdAt.toDate) bits.push(event.createdAt.toDate().toLocaleString());
      sub.textContent = bits.join(" · ") || "Anonymous visitor";
      row.append(title, sub);
      history.append(row);
    });
  }
  async function startApp() {
    if (!firebaseReady) {
      message(creatorMessage, "Firebase setup needed before share links and cross-device dashboard can work. The interface is ready for your project config.", "error");
      signInButton.disabled = true;
      signInButton.textContent = "Firebase setup required";
      return;
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      signInButton.hidden = Boolean(user);
      signOutButton.hidden = !user;
      dashboardNote.textContent = user ? "Signed in. Only the link creator can view saved history." : "Sign in with the Google account connected to your Firebase project to view saved responses.";
      if (user && dashboard.dataset.campaignId) await refreshDashboard();
    });
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#love-name").value.trim();
    if (!name) return;
    try { await createCampaign(name); }
    catch (error) { console.error(error); message(creatorMessage, "Could not create the link. Check Firebase Auth, Firestore, and the security rules.", "error"); }
  });
  $("#copy-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl.value); message(creatorMessage, "Link copied! Share it with care ❤️", "success"); }
    catch (_) { shareUrl.focus(); shareUrl.select(); message(creatorMessage, "Select and copy the link from the box above.", "error"); }
  });
  signInButton.addEventListener("click", async () => {
    if (!auth) return;
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (error) { console.error(error); message(creatorMessage, "Sign-in didn't finish. Check that Google sign-in is enabled in Firebase Authentication.", "error"); }
  });
  signOutButton.addEventListener("click", () => auth && signOut(auth));
  $("#refresh-dashboard").addEventListener("click", () => refreshDashboard().catch(console.error));

  noButton.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") { noAttempts++; recordEvent("no_attempt"); moveNoButton(); } });
  noButton.addEventListener("pointerdown", (event) => { event.preventDefault(); noAttempts++; recordEvent("no_attempt"); moveNoButton(); });
  noButton.addEventListener("touchstart", (event) => { event.preventDefault(); noAttempts++; recordEvent("no_attempt"); moveNoButton(); }, { passive: false });
  noButton.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); noAttempts++; recordEvent("no_attempt"); moveNoButton(); });
  yesButton.addEventListener("click", async () => {
    if (yesSubmitted) { await recordEvent("yes"); return; }
    yesSubmitted = true;
    stage.hidden = true;
    setMusic();
    result.hidden = false;
    const video = result.querySelector("video");
    if (video) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    await recordEvent("yes");
  });
  detailsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const recipientName = $("#recipient-name").value.trim();
    const contact = $("#recipient-contact").value.trim();
    if (!recipientName && !contact) { message($("#recipient-message"), "Nothing to submit—you're welcome to leave everything blank.", ""); return; }
    await recordEvent("details", { recipientName, contact });
    message($("#recipient-message"), "Thanks! Your optional details have been submitted.", "success");
    detailsForm.querySelector('button[type="submit"]').disabled = true;
  });

  const params = new URLSearchParams(window.location.search);
  const linkId = params.get("love");
  if (linkId) {
    creatorView.hidden = true;
    startApp().then(() => loadCampaign(linkId)).catch((error) => { console.error(error); showInvalid(); });
  } else {
    showCreator();
    startApp().catch((error) => { console.error(error); message(creatorMessage, "Firebase could not start. Check the config file.", "error"); });
  }
})();