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

function processArticle(articleEl) {
  if (!articleEl || processedArticles.has(articleEl)) return;
  processedArticles.add(articleEl);

  if (!isEnabled) return; 

  const text = getTweetText(articleEl);
  if (!text || text.length < 10) return;
  if (!mightBeAIRelated(text)) return;

  chrome.runtime.sendMessage({ type: "classify", text }, (response) => {
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
      return;
    }
    if (response?.error) {
      console.warn("[AI Doom Assassin]", response.error, response.details || "");
      return;
    }
    if (response?.isFearMongering) {
      markAsDoom(articleEl, response.reason || "AI fear-mongering");
    }
  });
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

  const overlay = document.createElement("div");
  overlay.className = "ai-doom-assassin-overlay";
  overlay.innerHTML = `<div style="max-width: 280px;">${getRandomMessage()}</div>`;

  overlay.addEventListener("click", () => {
    articleEl.classList.remove("ai-doom-assassin-hidden");
    overlay.remove();
  });

  articleEl.style.position = articleEl.style.position || "relative";
  articleEl.appendChild(overlay);

  chrome.storage.local.get(['hiddenCount'], (data) => {
    const count = (data.hiddenCount || 0) + 1;
    chrome.storage.local.set({ hiddenCount: count });
    chrome.runtime.sendMessage({ type: 'hiddenCountUpdate', count });
  });
}

function injectStyles() {
  if (document.getElementById("ai-doom-assassin-styles")) return;
  const style = document.createElement("style");
  style.id = "ai-doom-assassin-styles";
  style.textContent = `
    article.ai-doom-assassin-hidden { 
      position: relative; 
      pointer-events: none; 
    }
    article.ai-doom-assassin-hidden > *:not(.ai-doom-assassin-overlay) {
      filter: blur(10px);
    }
    article.ai-doom-assassin-hidden .ai-doom-assassin-overlay { 
      pointer-events: auto; 
      filter: blur(0) !important;
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 16px;
      background: rgba(15,23,42,0.95);
      color: #e5e7eb;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      z-index: 9999;
      border-radius: 12px;
      line-height: 1.5;
    }
    .ai-doom-assassin-overlay:hover { background: rgba(30,64,175,0.95); color: #f9fafb; }
    .ai-doom-assassin-overlay div { margin: 0 auto; }
  `;
  document.documentElement.appendChild(style);
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