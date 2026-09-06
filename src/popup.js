const TAURI = window.__TAURI__;
const tauriEmit = TAURI && TAURI.event ? TAURI.event.emit : async () => {};
const tauriListen = TAURI && TAURI.event ? TAURI.event.listen : async () => () => {};
const currentWindow = TAURI && TAURI.window ? TAURI.window.getCurrent() : null;

const STATE_EVENT = "bufi://state";
const ACTION_EVENT = "bufi://action";
const REQUEST_STATE_EVENT = "bufi://request-state";

const el = (id) => document.getElementById(id);
const statusPill = el("statusPill");
const statusText = el("statusText");
const connectBtn = el("connectBtn");
const popupServerRow = el("popupServerRow");
const popupServerLabel = el("popupServerLabel");
const selectedFlag = el("selectedFlag");
const selectedServerText = el("selectedServerText");
const popupStats = el("popupStats");
const statTime = el("statTime");
const statDown = el("statDown");
const statUp = el("statUp");
const statPing = el("statPing");
const statNewIp = el("statNewIp");
const popupCloseBtn = el("popupCloseBtn");
const openFullBtn = el("openFullBtn");

let last = { connected: false, connecting: false, selectedServerId: null, stats: null };

function render(state) {
  last = state;

  statusPill.classList.remove("connected", "connecting");
  connectBtn.classList.remove("connected", "connecting");
  if (state.connecting) {
    statusPill.classList.add("connecting");
    connectBtn.classList.add("connecting");
    statusText.textContent = state.connected ? "DISCONNECTING..." : "CONNECTING...";
    connectBtn.textContent = state.connected ? "DISCONNECTING..." : "CONNECTING...";
  } else if (state.connected) {
    statusPill.classList.add("connected");
    connectBtn.classList.add("connected");
    statusText.textContent = "CONNECTED";
    connectBtn.textContent = "DISCONNECT";
  } else {
    statusText.textContent = "NOT CONNECTED";
    connectBtn.textContent = "CONNECT";
  }

  const server = typeof SERVERS !== "undefined" ? SERVERS.find((s) => s.id === state.selectedServerId) : null;
  if (server) {
    selectedFlag.textContent = server.flag;
    selectedServerText.textContent = `${server.country} - ${server.city}`;
    popupServerLabel.textContent = state.connected ? "Connected to" : "Selected server";
  } else {
    selectedFlag.textContent = "🌍";
    selectedServerText.textContent = "Choose a location";
    popupServerLabel.textContent = "Select server";
  }

  if (state.stats) {
    popupStats.classList.remove("hidden");
    statTime.textContent = state.stats.time;
    statDown.textContent = state.stats.down;
    statUp.textContent = state.stats.up;
    statPing.textContent = state.stats.ping;
    statNewIp.textContent = state.stats.newIp;
  } else {
    popupStats.classList.add("hidden");
  }
}

connectBtn.onclick = () => {
  if (last.connecting) return;
  tauriEmit(ACTION_EVENT, { type: last.connected ? "disconnect" : "connect" });
};

popupServerRow.onclick = () => {
  tauriEmit(ACTION_EVENT, { type: "open-server-list" });
};

openFullBtn.onclick = () => {
  tauriEmit(ACTION_EVENT, { type: "open-main" });
};

popupCloseBtn.onclick = () => {
  if (currentWindow) currentWindow.hide();
};

async function init() {
  await tauriListen(STATE_EVENT, (event) => render(event.payload || {}));
  await tauriEmit(REQUEST_STATE_EVENT, {});
}

document.addEventListener("DOMContentLoaded", init);
