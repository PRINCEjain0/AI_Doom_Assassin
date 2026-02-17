function getTweetText(articleEl) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    articleEl,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.getAttribute("aria-hidden") === "true") return NodeFilter.FILTER_REJECT;
        const trimmed = node.textContent.trim();
        if (!trimmed) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  let current;
  while ((current = walker.nextNode())) {
    textNodes.push(current.textContent.trim());
  }
  return textNodes.join(" ");
}

function mightBeAIRelated(text) {
  const lower = text.toLowerCase();
  return /\b(ai|llm|gpt|chatgpt|artificial intelligence|machine learning|ml)\b/.test(lower);
}

const processedArticles = new WeakSet();
let isEnabled = true; 

chrome.storage.local.get(['enabled'], (data) => {
  isEnabled = data.enabled !== false; 
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'toggle') {
    isEnabled = msg.enabled;
  }
});

const BATCH_SIZE = 8;
const FLUSH_INTERVAL_MS = 1200;

const queue = [];
const inFlight = new Set(); 
const keyToArticle = new Map(); 
let flushTimer = null;

function hashText(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

function ensureKey(articleEl, text) {
  if (articleEl.dataset.aiDoomAssassinKey) return articleEl.dataset.aiDoomAssassinKey;
  const key = `${Date.now().toString(36)}-${hashText(text.slice(0, 500))}`;
  articleEl.dataset.aiDoomAssassinKey = key;
  return key;
}

function enqueueForBatch(articleEl, text) {
  const key = ensureKey(articleEl, text);
  if (inFlight.has(key)) return;
  if (keyToArticle.has(key)) return; 

  keyToArticle.set(key, articleEl);
  queue.push({ key, text: text.replace(/\s+/g, ' ').slice(0, 900) });
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBatch();
  }, FLUSH_INTERVAL_MS);
}

function flushBatch() {
  if (!isEnabled) {
    queue.length = 0;
    keyToArticle.clear();
    inFlight.clear();
    return;
  }
  if (queue.length === 0) return;

  const items = queue.splice(0, BATCH_SIZE);
  items.forEach((it) => inFlight.add(it.key));

  try {
    chrome.runtime.sendMessage({ type: "classify_batch", items }, (response) => {
      items.forEach((it) => inFlight.delete(it.key));

      if (chrome.runtime.lastError) {
        console.warn("[AI Doom Assassin]", chrome.runtime.lastError.message);
        return;
      }
      if (response?.error === "rate_limited") {
        if (!window._aiDoomRateLimitLogged) {
          window._aiDoomRateLimitLogged = true;
          console.warn("[AI Doom Assassin] Quota exceeded. Pausing for ~1 min. Then only a few tweets/min will be checked.");
          setTimeout(() => { window._aiDoomRateLimitLogged = false; }, 60000);
        }
        items.forEach((it) => {
          if (!keyToArticle.has(it.key)) return; // article may be gone
          queue.push(it);
        });
        scheduleFlush();
        return;
      }
      if (response?.error) {
        console.warn("[AI Doom Assassin]", response.error, response.details || "");
        return;
      }

      const results = Array.isArray(response?.results) ? response.results : [];
      for (const r of results) {
        if (!r || typeof r.key !== "string") continue;
        const articleEl = keyToArticle.get(r.key);
        keyToArticle.delete(r.key);
        if (!articleEl || !articleEl.isConnected) continue;
        if (r.isFearMongering) {
          markAsDoom(articleEl, r.reason || "AI fear-mongering");
        }
      }

      if (queue.length > 0) scheduleFlush();
    });
  } catch (_) {
  }
}

function processArticle(articleEl) {
  if (!articleEl || processedArticles.has(articleEl)) return;
  processedArticles.add(articleEl);

  if (!isEnabled) return; 

  const text = getTweetText(articleEl);
  if (!text || text.length < 10) return;
  if (!mightBeAIRelated(text)) return;
  enqueueForBatch(articleEl, text);
}

const VIRAL_MESSAGES = [
  "🌱 Touch grass instead of reading this doom post. Click if you must.",
  "This post was too doom-y. Maybe go touch grass? Click to see it anyway.",
  "AI fear-mongering blocked. Time to get off scrolling. Click to un-block.",
  "Doom post filtered. Your scroll time is better spent elsewhere. Click to reveal.",
  "This post tried to doom you. Go touch grass instead. Click if you're still here.",
  "Bro really posted 'AI will take your job' unironically. Touch grass. Click to see it.",
  "Another 'learn to code' doomer? My guy, go outside. Click if you're still scrolling.",
  "This post is giving 'I doom-scroll for 6 hours a day' energy. Click to join them.",
  "AI doom post detected. Your screen time is already too high. Click to make it worse.",
  "Someone's really out here fear-mongering about AI. Go touch grass, king. Click to see.",
  "This post violated the 'no doom-scrolling' rule. You're welcome. Click to doom-scroll anyway.",
  "AI panic post blocked. Your therapist would be proud. Click to disappoint them.",
  "Doom post filtered. You're on X at 2am reading this. Go to bed. Click to keep scrolling.",
  "This post tried to make you panic about AI. We said no. Touch grass. Click if you must.",
  "Another 'AI will replace devs' post? My brother in Christ, go outside. Click to see it."
];

function getRandomMessage() {
  return VIRAL_MESSAGES[Math.floor(Math.random() * VIRAL_MESSAGES.length)];
}

function markAsDoom(articleEl, reason) {
  articleEl.classList.add("ai-doom-assassin-hidden");
  if (articleEl.querySelector(".ai-doom-assassin-overlay")) return;


  const originalChildren = Array.from(articleEl.children);
  for (const child of originalChildren) {
    if (child.classList?.contains("ai-doom-assassin-overlay")) continue;
    if (child.classList?.contains("ai-doom-assassin-scrim")) continue;
    if (child.dataset.aiDoomAssassinBlurred === "1") continue;

    child.dataset.aiDoomAssassinBlurred = "1";
    child.dataset.aiDoomAssassinPrevFilter = child.style.filter || "";
    child.dataset.aiDoomAssassinPrevOpacity = child.style.opacity || "";
    child.dataset.aiDoomAssassinPrevPointerEvents = child.style.pointerEvents || "";
    child.dataset.aiDoomAssassinPrevTransition = child.style.transition || "";

    child.style.filter = "blur(10px)";
    child.style.opacity = "0.18";
    child.style.pointerEvents = "none";
    child.style.transition = "filter 120ms linear, opacity 120ms linear";
  }

  const scrim = document.createElement("div");
  scrim.className = "ai-doom-assassin-scrim";
  scrim.style.position = "absolute";
  scrim.style.inset = "0";
  scrim.style.zIndex = "999998";
  scrim.style.pointerEvents = "auto";

  const overlay = document.createElement("div");
  overlay.className = "ai-doom-assassin-overlay";
  overlay.innerHTML = `
    <div class="ai-doom-assassin-card">
      <div class="ai-doom-assassin-msg">${getRandomMessage()}</div>
      <div class="ai-doom-assassin-sub">Click to reveal (at your own risk).</div>
    </div>
  `;
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.zIndex = "999999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "18px";
  overlay.style.boxSizing = "border-box";

  overlay.addEventListener("click", () => {
    articleEl.classList.remove("ai-doom-assassin-hidden");
    scrim.remove();
    overlay.remove();

    const childrenNow = Array.from(articleEl.children);
    for (const child of childrenNow) {
      if (child.dataset?.aiDoomAssassinBlurred !== "1") continue;
      child.style.filter = child.dataset.aiDoomAssassinPrevFilter || "";
      child.style.opacity = child.dataset.aiDoomAssassinPrevOpacity || "";
      child.style.pointerEvents = child.dataset.aiDoomAssassinPrevPointerEvents || "";
      child.style.transition = child.dataset.aiDoomAssassinPrevTransition || "";

      delete child.dataset.aiDoomAssassinBlurred;
      delete child.dataset.aiDoomAssassinPrevFilter;
      delete child.dataset.aiDoomAssassinPrevOpacity;
      delete child.dataset.aiDoomAssassinPrevPointerEvents;
      delete child.dataset.aiDoomAssassinPrevTransition;
    }
  });

  articleEl.style.position = articleEl.style.position || "relative";
  articleEl.style.overflow = "hidden";
  articleEl.appendChild(scrim);
  articleEl.appendChild(overlay);

  chrome.storage.local.get(['hiddenCount'], (data) => {
    const count = (data.hiddenCount || 0) + 1;
    chrome.storage.local.set({ hiddenCount: count });
    chrome.runtime.sendMessage({ type: 'hiddenCountUpdate', count });
  });
}

function injectStyles() {
  let style = document.getElementById("ai-doom-assassin-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "ai-doom-assassin-styles";
    document.documentElement.appendChild(style);
  }

  style.textContent = `
    article.ai-doom-assassin-hidden {
      position: relative;
      overflow: hidden;
      border-radius: 12px;
    }

    article.ai-doom-assassin-hidden .ai-doom-assassin-scrim {
      position: absolute;
      inset: 0;
      z-index: 999998;
      background: rgba(2, 6, 23, 0.70);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    article.ai-doom-assassin-hidden .ai-doom-assassin-overlay {
      cursor: pointer;
    }

    article.ai-doom-assassin-hidden .ai-doom-assassin-overlay:hover {
      background: rgba(30, 64, 175, 0.12);
    }

    .ai-doom-assassin-card {
      max-width: 340px;
      width: 100%;
      text-align: center;
      color: #f9fafb;
      background: rgba(2, 6, 23, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 14px;
      padding: 14px 14px 12px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.35);
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
    }

    .ai-doom-assassin-msg {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.4;
    }

    .ai-doom-assassin-sub {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 500;
      color: rgba(226, 232, 240, 0.85);
    }
  `;
}


function scanExistingTweets() {
  const articles = document.querySelectorAll('article[role="article"]');
  if (articles.length === 0) return false;
  articles.forEach((article) => {
    processArticle(article);
  });
  return true;
}

function waitForTweets(maxAttempts = 10, delayMs = 500) {
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (scanExistingTweets()) {
      clearInterval(checkInterval);
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
    }
  }, delayMs);
}


function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node;
        if (el.matches && el.matches('article[role="article"]')) {
          processArticle(el);
        }
        const nested = el.querySelectorAll ? el.querySelectorAll('article[role="article"]') : [];
        nested.forEach(processArticle);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}


injectStyles();
waitForTweets();
setupMutationObserver();