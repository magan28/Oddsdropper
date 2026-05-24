// Service Worker per POD - mantiene il polling anche con pagina chiusa

const CACHE_NAME = "pod-v1";
const POLL_INTERVAL = 60000; // 60 secondi
const DB_NAME = "pod-db";
const DB_STORE = "config";

let pollInterval = null;
let prevOdds = {};
let notificationLog = {};
let currentConfig = {};

// IndexedDB helper
const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onerror = () => reject(req.error);
  req.onsuccess = () => resolve(req.result);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(DB_STORE)) {
      db.createObjectStore(DB_STORE);
    }
  };
});

const saveConfig = async (key, value) => {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.put(value, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[POD SW] DB save error:", e);
  }
};

const loadConfig = async (key) => {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("[POD SW] DB load error:", e);
    return null;
  }
};

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
  // Load config from DB on activation
  loadConfig("telegramCfg").then(cfg => {
    if (cfg) {
      currentConfig = cfg;
      console.log("[POD SW] Loaded config from DB on activation");
    }
  });
});

// Ricevi messaggi dal client (main app)
self.addEventListener("message", (e) => {
  const { type, payload } = e.data;

  if (type === "START_POLLING") {
    const { token, chatId, bookmakers, minEv, cooldownMins, activeFrom, activeTo, oddsApiKey } = payload;
    currentConfig = payload;
    saveConfig("telegramCfg", payload);
    startPolling(token, chatId, bookmakers, minEv, cooldownMins, activeFrom, activeTo, oddsApiKey);
  }

  if (type === "STOP_POLLING") {
    stopPolling();
  }

  if (type === "SAVE_CONFIG") {
    const { telegramCfg, bets, alertCfgs } = payload;
    saveConfig("telegramCfg", telegramCfg);
    saveConfig("bets", bets);
    saveConfig("alertCfgs", alertCfgs);
    console.log("[POD SW] Saved config to IndexedDB");
  }

function startPolling(token, chatId, bookmakers, minEv, cooldownMins, activeFrom, activeTo, oddsApiKey) {
  if (pollInterval) clearInterval(pollInterval);

  console.log("[POD SW] Starting polling with:", { token: token?.slice(0, 10) + "...", chatId, bookmakers });

  // Poll subito
  pollOdds(token, chatId, bookmakers, minEv, cooldownMins, activeFrom, activeTo, oddsApiKey);

  // Poi ogni 60 secondi
  pollInterval = setInterval(() => {
    pollOdds(token, chatId, bookmakers, minEv, cooldownMins, activeFrom, activeTo, oddsApiKey);
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[POD SW] Polling stopped");
  }
}

async function pollOdds(token, chatId, bookmakers, minEv, cooldownMins, activeFrom, activeTo, oddsApiKey) {
  try {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Check active hours
    if (hhmm < activeFrom || hhmm > activeTo) {
      console.log("[POD SW] Outside active hours");
      return;
    }

    const sportKeys = ["soccer_italy_serie_a", "soccer_epl", "basketball_nba", "tennis_atp_french_open", "baseball_mlb", "icehockey_nhl"];
    const bookmakerString = ["pinnacle", ...bookmakers].join(",");

    let allGames = [];

    // Fetch odds for each sport
    for (const sport of sportKeys.slice(0, 3)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h&bookmakers=${bookmakerString}&oddsFormat=decimal`;

      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[POD SW] Failed to fetch ${sport}:`, res.status);
        continue;
      }

      const data = await res.json();
      if (Array.isArray(data)) allGames.push(...data);
    }

    console.log(`[POD SW] Fetched ${allGames.length} games`);

    // Analizza ogni game
    for (const game of allGames) {
      const pinnBk = game.bookmakers?.find((b) => b.key === "pinnacle");
      if (!pinnBk) continue;

      const h2h = pinnBk.markets?.find((m) => m.key === "h2h");
      if (!h2h?.outcomes || h2h.outcomes.length < 2) continue;

      const homeOutcome = h2h.outcomes.find((o) => o.name === game.home_team);
      const awayOutcome = h2h.outcomes.find((o) => o.name === game.away_team);

      if (!homeOutcome?.price || !awayOutcome?.price) continue;

      const homeOdds = homeOutcome.price;
      const awayOdds = awayOutcome.price;
      const gameKey = `${game.id}_home`;

      // Check se c'è un drop rispetto alla precedente lettura
      const prevHomeOdds = prevOdds[gameKey];
      prevOdds[gameKey] = homeOdds;
      prevOdds[`${game.id}_away`] = awayOdds;

      if (!prevHomeOdds) continue; // First read, no comparison

      const dropPct = prevHomeOdds > homeOdds ? ((prevHomeOdds - homeOdds) / prevHomeOdds) * 100 : 0;
      if (dropPct < 1) continue; // Only notify on >1% drop

      // Calcola NVP (Power devig)
      const nvp = calcNvp(homeOdds, awayOdds);

      // Controlla ogni bookmaker configurato
      for (const bookieId of bookmakers) {
        const bookieBk = game.bookmakers?.find((b) => b.key === bookieId);
        if (!bookieBk) continue;

        const bookieH2h = bookieBk.markets?.find((m) => m.key === "h2h");
        if (!bookieH2h?.outcomes) continue;

        const cooldownKey = `${game.id}_${bookieId}`;
        const lastNotified = notificationLog[cooldownKey];

        // Check cooldown
        if (lastNotified && Date.now() - lastNotified < cooldownMins * 60 * 1000) continue;

        for (const outcome of bookieH2h.outcomes) {
          const bookieOdds = outcome.price;
          const isSide = outcome.name === game.home_team ? "home" : "away";
          const nvpForSide = isSide === "home" ? nvp.h : nvp.a;
          const ev = ((bookieOdds / nvpForSide - 1) * 100).toFixed(1);

          if (parseFloat(ev) < minEv) continue; // Non abbastanza valore

          // INVIA NOTIFICA TELEGRAM
          notificationLog[cooldownKey] = Date.now();

          const bookieName = { bet365: "Bet365", betfair_ex_eu: "Betfair", betflag: "Betflag" }[bookieId] || bookieId;
          const message = [
            `[+] <b>VALUE BET</b>`,
            ``,
            `<b>${game.home_team} vs ${game.away_team}</b>`,
            `${game.sport_title}`,
            `Match`,
            `Bet on: <b>${isSide === "home" ? game.home_team : game.away_team}</b>`,
            ``,
            `Pinnacle: <b>${homeOdds.toFixed(3)} / ${awayOdds.toFixed(3)}</b>`,
            `NVP: <b>${nvpForSide.toFixed(3)}</b>`,
            `${bookieName}: <b>${bookieOdds.toFixed(3)}</b>`,
            `EV: <b>+${ev}%</b>`,
            ``,
            `Kickoff: ${Math.round((new Date(game.commence_time).getTime() - now.getTime()) / 60000)}m`,
            `Act fast!`,
          ].join("\n");

          sendTelegramFromWorker(token, chatId, message);

          console.log(`[POD SW] Sent: ${game.home_team} vs ${game.away_team} on ${bookieName} (+${ev}% EV)`);
        }
      }
    }
  } catch (error) {
    console.error("[POD SW] Polling error:", error);
  }
}

async function sendTelegramFromWorker(token, chatId, message) {
  try {
    const params = new URLSearchParams({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: "true",
    });

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage?${params}`);
    const data = await res.json();

    if (!data.ok) {
      console.warn("[POD SW] Telegram error:", data.description);
    }
  } catch (error) {
    console.error("[POD SW] Telegram send error:", error);
  }
}

// Power devig - stesso algoritmo della app
function calcNvp(o1, o2) {
  const r1 = 1 / o1;
  const r2 = 1 / o2;

  let k = 1;
  let iter = 0;
  while (iter++ < 60) {
    const f = Math.pow(r1, k) + Math.pow(r2, k) - 1;
    const df = Math.pow(r1, k) * Math.log(r1) + Math.pow(r2, k) * Math.log(r2);
    const dk = -f / df;
    k += dk;
    if (Math.abs(dk) < 1e-9) break;
  }

  return {
    h: +Number(1 / Math.pow(r1, k)).toFixed(3),
    a: +Number(1 / Math.pow(r2, k)).toFixed(3),
  };
}
