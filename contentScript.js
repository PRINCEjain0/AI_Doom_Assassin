
console.log("[AI Doom Assassin] content script loaded on X (Step 2)");

function getTweetText(articleEl) {
  const textNodes = [];

  const walker = document.createTreeWalker(
    articleEl,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        if (parent.getAttribute("aria-hidden") === "true") {
          return NodeFilter.FILTER_REJECT;
        }

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

function scanTweetsOnce() {
  const articles = document.querySelectorAll('article[role="article"]');
  console.log(`[AI Doom Assassin] Found ${articles.length} tweet articles using 'article[role="article"]'`);

  const allArticles = document.querySelectorAll('article');
  console.log(`[AI Doom Assassin] Total <article> elements on page: ${allArticles.length}`);

  if (articles.length === 0) {
    console.log("[AI Doom Assassin] No tweets found yet. Waiting for page to load...");
    return false;
  }

  articles.forEach((article, index) => {
    
      const text = getTweetText(article);
      console.log(`--- Tweet ${index + 1} ---`);
      console.log(text.substring(0, 200) + (text.length > 200 ? "..." : ""));
    
  });

  return true;
}

function waitForTweets(maxAttempts = 10, delayMs = 500) {
  let attempts = 0;

  const checkInterval = setInterval(() => {
    attempts++;
    console.log(`[AI Doom Assassin] Attempt ${attempts}/${maxAttempts} to find tweets...`);

    if (scanTweetsOnce()) {
      clearInterval(checkInterval);
      console.log("[AI Doom Assassin] Successfully found tweets!");
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.log("[AI Doom Assassin] Max attempts reached. Tweets may not be loaded yet.");
      console.log("[AI Doom Assassin] Try scrolling down or refreshing the page.");
    }
  }, delayMs);
}

waitForTweets();