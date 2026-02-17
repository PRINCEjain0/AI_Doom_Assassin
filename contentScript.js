
console.log("[AI Doom Assassin] content script loaded (Step 4)");


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
  "🚨 AI doom detected. Your feed is now 100% less panicky. Click to see the chaos anyway.",
  "Another 'AI will take your job' post? We don't do that here. Click if you're brave.",
  "This post tried to scare you about AI. We said no. Click to reveal anyway.",
  "AI fear-mongering blocked. Your mental health thanks you. Click to un-peace.",
  "This post was too doom-y. We spared you. Click to un-spare.",
  "Fear-mongering detected. Peace restored. Click to see what you're missing.",
  "AI doom post blocked. Your serotonin is safe. Click to risk it.",
  "This post violated the 'no fear-mongering' rule. Click to see why.",
  "AI panic post filtered. Your feed is now certified chill. Click to un-chill.",
  "Doom post detected. We took care of it. Click to see what we saved you from."
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
  console.log(`[AI Doom Assassin] Initial scan: ${articles.length} tweets`);
  articles.forEach((article, i) => {
    processArticle(article);
    if (i < 2) {
      const text = getTweetText(article);
      console.log(`--- Tweet ${i + 1} ---`, text.substring(0, 150) + (text.length > 150 ? "..." : ""));
    }
  });
  return true;
}

function waitForTweets(maxAttempts = 10, delayMs = 500) {
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (scanExistingTweets()) {
      clearInterval(checkInterval);
      console.log("[AI Doom Assassin] Initial scan done. Observer is watching for new tweets.");
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.log("[AI Doom Assassin] No tweets found yet. Scroll or refresh.");
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
  console.log("[AI Doom Assassin] MutationObserver active: new tweets will be processed.");
}


injectStyles();
waitForTweets();
setupMutationObserver();