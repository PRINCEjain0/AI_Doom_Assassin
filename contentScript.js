
console.log("[AI Doom Assassin] content script loaded (Step 3)");


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

const processedArticles = new WeakSet();

function processArticle(articleEl) {
  if (!articleEl || processedArticles.has(articleEl)) return;
  processedArticles.add(articleEl);

  const text = getTweetText(articleEl);
  if (!text || text.length < 10) return;

  console.log("[AI Doom Assassin] Tweet text:", text.substring(0, 120) + (text.length > 120 ? "..." : ""));
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


waitForTweets();
setupMutationObserver();