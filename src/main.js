// ===================== TAURI BRIDGE =====================
const TAURI = window.__TAURI__;
const invoke = TAURI && TAURI.tauri ? TAURI.tauri.invoke : async () => { throw new Error("Not running inside Tauri"); };
const tauriEmit = TAURI && TAURI.event ? TAURI.event.emit : async () => {};
const tauriListen = TAURI && TAURI.event ? TAURI.event.listen : async () => () => {};
const currentWindow = TAURI && TAURI.window ? TAURI.window.getCurrent() : null;

const STATE_EVENT = "bufi://state";
const ACTION_EVENT = "bufi://action";
const REQUEST_STATE_EVENT = "bufi://request-state";

// ===================== DOM =====================
const el = (id) => document.getElementById(id);
const myLocationText = el("myLocationText");
const myIpText = el("myIpText");
const statusPill = el("statusPill");
const statusText = el("statusText");
const connectBtn = el("connectBtn");
const openListBtn = el("openListBtn");
const closeListBtn = el("closeListBtn");
const serverListOverlay = el("serverListOverlay");
const regionTabs = el("regionTabs");
const serverItemsEl = el("serverItems");
const selectedFlag = el("selectedFlag");
const selectedServerText = el("selectedServerText");
const locationCard = el("locationCard");
const connectedCard = el("connectedCard");
const connServerName = el("connServerName");
const statTime = el("statTime");
const statDown = el("statDown");
const statUp = el("statUp");
const statPing = el("statPing");
const statNewIp = el("statNewIp");
const mapWrap = el("mapWrap");
const mapCountries = el("mapCountries");
const mapPins = el("mapPins");
const mapViewport = el("mapViewport");
const pinsViewport = el("pinsViewport");
const worldMap = el("worldMap");
const zoomInBtn = el("zoomInBtn");
const zoomOutBtn = el("zoomOutBtn");
const zoomResetBtn = el("zoomResetBtn");

// ===================== STATE =====================
let selectedServer = null;
let connected = false;
let connecting = false;
let myLocation = { city: "Unknown", country: "", lat: 21.0, lng: 105.8, ip: "—" };
let timerInterval = null;
let statsInterval = null;
let connectSeconds = 0;

// ===================== MAP: load country borders =====================
if (typeof WORLD_MAP_SVG_PATHS !== "undefined") {
  mapCountries.innerHTML = WORLD_MAP_SVG_PATHS;
}

// ===================== PROJECTION (equirectangular, viewBox 1000x500) =====================
function project(lat, lng) {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x, y };
}

function svgEl(tag, attrs) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// ===================== MAP: pan / zoom =====================
const view = { scale: 1, tx: 0, ty: 0 };
const MIN_SCALE = 1;
const MAX_SCALE = 10;

function setViewportTransition(ms) {
  const t = ms > 0 ? `transform ${ms}ms cubic-bezier(.4,0,.2,1)` : "none";
  mapViewport.style.transition = t;
  pinsViewport.style.transition = t;
  // statusPin compensates zoom with its own transform (see renderPin), so it must
  // ease in lockstep with pinsViewport/mapViewport — otherwise it snaps to its new
  // scaled position instantly while the parent is still easing, making it look
  // like it flies in from the edge on every zoom/scroll.
  statusPin.style.transition = t;
}

function applyView() {
  mapViewport.setAttribute("transform", `translate(${view.tx},${view.ty}) scale(${view.scale})`);
  pinsViewport.setAttribute("transform", `translate(${view.tx},${view.ty})`);
  renderPin();
}

function currentCenter() {
  return { x: (500 - view.tx) / view.scale, y: (250 - view.ty) / view.scale };
}

function centerOn(x, y, scale) {
  view.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  view.tx = 500 - view.scale * x;
  view.ty = 250 - view.scale * y;
  applyView();
}

function zoomBy(factor) {
  const c = currentCenter();
  setViewportTransition(300);
  centerOn(c.x, c.y, view.scale * factor);
}

zoomInBtn.onclick = () => zoomBy(1.5);
zoomOutBtn.onclick = () => zoomBy(1 / 1.5);
zoomResetBtn.onclick = () => {
  setViewportTransition(500);
  if (connected && selectedServer) {
    const p = project(selectedServer.lat, selectedServer.lng);
    centerOn(p.x, p.y, 4);
  } else {
    const p = project(myLocation.lat, myLocation.lng);
    centerOn(p.x, p.y, 4);
  }
};

// mouse-wheel zoom (centered on current view center, kept simple)
mapWrap.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    setViewportTransition(150);
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  },
  { passive: false }
);

// drag to pan
let dragging = false;
let dragStart = { x: 0, y: 0 };
let dragStartView = { tx: 0, ty: 0 };

mapWrap.addEventListener("pointerdown", (e) => {
  dragging = true;
  mapWrap.classList.add("dragging");
  dragStart = { x: e.clientX, y: e.clientY };
  dragStartView = { tx: view.tx, ty: view.ty };
  setViewportTransition(0);
  mapWrap.setPointerCapture(e.pointerId);
});

mapWrap.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const rect = worldMap.getBoundingClientRect();
  const pxToUnitX = 1000 / rect.width;
  const pxToUnitY = 500 / rect.height;
  const dx = (e.clientX - dragStart.x) * pxToUnitX;
  const dy = (e.clientY - dragStart.y) * pxToUnitY;
  view.tx = dragStartView.tx + dx;
  view.ty = dragStartView.ty + dy;
  applyView();
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  mapWrap.classList.remove("dragging");
}
mapWrap.addEventListener("pointerup", endDrag);
mapWrap.addEventListener("pointerleave", endDrag);

// ===================== MAP: status pin (moves + changes color, fixed on-screen size) =====================
const statusPin = svgEl("g", { id: "statusPin", class: "status-pin" });
statusPin.appendChild(svgEl("circle", { class: "pulse-ring", r: 5, fill: "none", "stroke-width": 2 }));
statusPin.appendChild(svgEl("circle", { class: "loading-ring", r: 11 }));
statusPin.appendChild(svgEl("circle", { class: "core dot", r: 5 }));
mapPins.appendChild(statusPin);

// pinWorldPos holds the pin's position in *unscaled* map/world coordinates
// (same space as project()). The pin lives in #pinsViewport, which only ever
// translates (never scales), so we multiply by the current zoom level
// ourselves — this keeps the pin's visual size constant no matter how far
// the user has zoomed in/out, instead of ballooning with the map.
let pinWorldPos = { x: 0, y: 0 };

function renderPin() {
  statusPin.setAttribute("transform", `translate(${pinWorldPos.x * view.scale},${pinWorldPos.y * view.scale})`);
}

function setPinTransform(x, y) {
  pinWorldPos = { x, y };
  renderPin();
}

function setPinState(mode) {
  // mode: "idle" (red, at home) | "flying" (loading ring visible) | "connected" (green, at server)
  statusPin.classList.remove("idle", "flying", "connected");
  statusPin.classList.add(mode);
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function animatePin(from, to, durationMs, onDone) {
  // This animation drives statusPin's transform manually every frame via rAF.
  // If a CSS transition is still active on it (left over from a prior zoom/pan),
  // the two animation systems fight each other and the flight looks laggy/jerky.
  // Disable it here; setViewportTransition() will re-enable it for the next
  // zoom/pan interaction.
  statusPin.style.transition = "none";
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const e = easeInOutQuad(t);
    const x = from.x + (to.x - from.x) * e;
    const y = from.y + (to.y - from.y) * e;
    setPinTransform(x, y);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else if (onDone) {
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

// ===================== GEOLOCATION (via Rust backend) =====================
async function fetchMyLocation() {
  try {
    const loc = await invoke("get_my_location");
    myLocation = {
      city: loc.city || "Unknown",
      country: loc.country || "",
      lat: loc.lat,
      lng: loc.lng,
      ip: loc.ip || "—",
    };
  } catch (e) {
    console.error("get_my_location failed:", e);
    // keep the built-in fallback coordinates already set in myLocation
  }

  myLocationText.textContent = `${myLocation.city}, ${myLocation.country}`;
  myIpText.textContent = `IP: ${myLocation.ip}`;

  const p = project(myLocation.lat, myLocation.lng);
  setPinTransform(p.x, p.y);
  setPinState("idle");
  setViewportTransition(700);
  centerOn(p.x, p.y, 4);
  broadcastState();
}

// ===================== SERVER LIST UI =====================
let activeRegion = "asia";

function renderRegionTabs() {
  regionTabs.innerHTML = "";
  Object.keys(REGION_LABELS).forEach((region) => {
    const btn = document.createElement("button");
    btn.className = "region-tab" + (region === activeRegion ? " active" : "");
    btn.textContent = REGION_LABELS[region];
    btn.onclick = () => {
      activeRegion = region;
      renderRegionTabs();
      renderServerItems();
    };
    regionTabs.appendChild(btn);
  });
}

function renderServerItems() {
  serverItemsEl.innerHTML = "";
  SERVERS.filter((s) => s.region === activeRegion).forEach((s) => {
    const item = document.createElement("div");
    item.className = "server-item" + (selectedServer === s ? " selected" : "");
    item.innerHTML = `
      <span class="flag">${s.flag}</span>
      <div class="server-info">
        <span class="server-city">${s.country} - ${s.city}</span>
        <span class="server-tag">${s.tag || ""}</span>
      </div>
    `;
    item.onclick = () => {
      selectServer(s);
      closeServerList();
    };
    serverItemsEl.appendChild(item);
  });
}

function selectServer(s) {
  selectedServer = s;
  selectedFlag.textContent = s.flag;
  selectedServerText.textContent = `${s.country} - ${s.city}`;
  renderServerItems();
  broadcastState();
}

function selectServerById(id) {
  const s = SERVERS.find((srv) => srv.id === id);
  if (s) selectServer(s);
}

function openServerList() {
  serverListOverlay.classList.remove("hidden");
}
function closeServerList() {
  serverListOverlay.classList.add("hidden");
}

// ===================== CONNECT / DISCONNECT =====================
function randomFakeIp(server) {
  const seedBase = Math.abs(Math.round(server.lat * 7 + server.lng * 13));
  const a = 20 + (seedBase % 180);
  const b = Math.floor(Math.random() * 255);
  const c = Math.floor(Math.random() * 255);
  const d = Math.floor(Math.random() * 255);
  return `${a}.${b}.${c}.${d}`;
}

function setStatus(mode) {
  statusPill.classList.remove("connected", "connecting");
  connectBtn.classList.remove("connected", "connecting");
  if (mode === "connected") {
    statusPill.classList.add("connected");
    connectBtn.classList.add("connected");
    statusText.textContent = "CONNECTED";
    connectBtn.textContent = "DISCONNECT";
  } else if (mode === "connecting") {
    statusPill.classList.add("connecting");
    connectBtn.classList.add("connecting");
    statusText.textContent = "CONNECTING...";
    connectBtn.textContent = "CONNECTING...";
  } else {
    statusText.textContent = "NOT CONNECTED";
    connectBtn.textContent = "CONNECT";
  }
}

function startStatsSimulation(server) {
  connectSeconds = 0;
  statNewIp.textContent = randomFakeIp(server);
  statPing.textContent = `${8 + Math.floor(Math.random() * 40)} ms`;

  timerInterval = setInterval(() => {
    connectSeconds++;
    const h = String(Math.floor(connectSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((connectSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(connectSeconds % 60).padStart(2, "0");
    statTime.textContent = `${h}:${m}:${s}`;
    broadcastState();
  }, 1000);

  statsInterval = setInterval(() => {
    const down = (Math.random() * 80 + 20).toFixed(1);
    const up = (Math.random() * 20 + 3).toFixed(1);
    statDown.textContent = `${down} Mb/s`;
    statUp.textContent = `${up} Mb/s`;
    broadcastState();
  }, 1200);
}

function stopStatsSimulation() {
  clearInterval(timerInterval);
  clearInterval(statsInterval);
  statTime.textContent = "00:00:00";
  statDown.textContent = "0.0 Mb/s";
  statUp.textContent = "0.0 Mb/s";
}

const FLIGHT_DURATION = 1400;

async function handleConnect() {
  if (!selectedServer) {
    openServerList();
    return;
  }
  if (connecting) return;

  if (connected) {
    // ---- Disconnect: fly pin back home ----
    connecting = true;
    setStatus("connecting");
    statusText.textContent = "DISCONNECTING...";
    setPinState("flying");
    broadcastState();

    const from = project(selectedServer.lat, selectedServer.lng);
    const to = project(myLocation.lat, myLocation.lng);
    setViewportTransition(FLIGHT_DURATION);
    centerOn(to.x, to.y, 4);
    animatePin(from, to, FLIGHT_DURATION, async () => {
      try {
        await invoke("reset_dns");
      } catch (e) {
        console.error(e);
      }
      connected = false;
      connecting = false;
      setStatus("idle");
      setPinState("idle");
      connectedCard.classList.add("hidden");
      locationCard.classList.remove("hidden");
      stopStatsSimulation();
      broadcastState();
    });
    return;
  }

  // ---- Connect: fly pin to destination ----
  connecting = true;
  setStatus("connecting");
  setPinState("flying");
  broadcastState();

  const from = project(myLocation.lat, myLocation.lng);
  const to = project(selectedServer.lat, selectedServer.lng);
  setViewportTransition(FLIGHT_DURATION);
  centerOn(to.x, to.y, 4);

  const dns = REGION_DNS[selectedServer.region];

  animatePin(from, to, FLIGHT_DURATION, async () => {
    try {
      await invoke("set_dns", { primary: dns.primary, secondary: dns.secondary });
    } catch (e) {
      console.error(e);
      alert("Could not change DNS. Make sure the app is running as Administrator.\n" + e);
      connecting = false;
      setStatus("idle");
      setPinState("idle");
      setPinTransform(from.x, from.y);
      broadcastState();
      return;
    }

    connected = true;
    connecting = false;
    setStatus("connected");
    setPinState("connected");

    connServerName.textContent = `${selectedServer.flag} ${selectedServer.country} - ${selectedServer.city}`;
    locationCard.classList.add("hidden");
    connectedCard.classList.remove("hidden");
    startStatsSimulation(selectedServer);
    broadcastState();
  });
}

// ===================== CROSS-WINDOW STATE SYNC (tray popup) =====================
function buildStatePayload() {
  return {
    connected,
    connecting,
    selectedServerId: selectedServer ? selectedServer.id : null,
    myLocation: { city: myLocation.city, country: myLocation.country, ip: myLocation.ip },
    stats: connected
      ? {
          time: statTime.textContent,
          down: statDown.textContent,
          up: statUp.textContent,
          ping: statPing.textContent,
          newIp: statNewIp.textContent,
        }
      : null,
  };
}

function broadcastState() {
  tauriEmit(STATE_EVENT, buildStatePayload());
}

async function showThisWindow() {
  if (!currentWindow) return;
  try {
    await currentWindow.show();
    await currentWindow.unminimize();
    await currentWindow.setFocus();
  } catch (e) {
    console.error(e);
  }
}

async function initEventBridge() {
  await tauriListen(ACTION_EVENT, (event) => {
    const payload = event.payload || {};
    if (payload.type === "connect" || payload.type === "disconnect") {
      if (payload.type === "connect" && payload.serverId) {
        selectServerById(payload.serverId);
      }
      handleConnect();
    } else if (payload.type === "open-server-list") {
      showThisWindow();
      openServerList();
    } else if (payload.type === "open-main") {
      showThisWindow();
    }
  });

  await tauriListen(REQUEST_STATE_EVENT, () => broadcastState());
}

// ===================== INIT =====================
function init() {
  renderRegionTabs();
  renderServerItems();

  openListBtn.onclick = openServerList;
  closeListBtn.onclick = closeServerList;
  serverListOverlay.onclick = (e) => {
    if (e.target === serverListOverlay) closeServerList();
  };
  connectBtn.onclick = handleConnect;

  setPinState("idle");
  fetchMyLocation();
  initEventBridge();

  // pre-select a default server just for fun (Hanoi)
  const defaultServer = SERVERS.find((s) => s.id === "vn-han");
  if (defaultServer) selectServer(defaultServer);
}

document.addEventListener("DOMContentLoaded", init);
