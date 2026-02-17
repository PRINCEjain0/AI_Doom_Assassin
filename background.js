// Groq free tier –  Get key at console.groq.com

const CLASSIFY_SYSTEM = `You classify tweets for SERIOUS AI fear-mongering only. Output ONLY valid JSON.

Set "isFearMongering": true ONLY when BOTH are true:
1. The tweet is ABOUT AI (jobs, devs, humanity, etc.).
2. The tone is SERIOUSLY spreading fear/panic/doom – the author genuinely wants people to be afraid (e.g. "you will be jobless", "we're doomed", "AI is coming for your job" as a serious warning, not a joke).

ALWAYS set "isFearMongering": false for:
- Humour, jokes, satire, sarcasm, irony, memes, shitposting.
- Exaggeration or doom said clearly for comedic effect.
- "Learn to code" style jokes, dev humour, tech Twitter banter.
- Any post where the tone is playful, mocking, or not meant to scare people seriously.
- Normal criticism of AI, news, or balanced discussion.
When in doubt, choose false. Only blur genuine fear-mongering.

"reason": one short phrase when true (e.g. "serious job-loss panic"); empty string when false.

Reply with exactly: {"isFearMongering": true or false, "reason": "..."}`;

const GROQ_MODEL = 'llama-3.1-8b-instant';  
const MIN_DELAY_MS = 2200;   
const RATE_LIMIT_COOLDOWN_MS = 60000;

let lastRequestTime = 0;
let rateLimitUntil = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tryParseJsonArray(text) {
  // Groq is usually clean, but this makes us resilient to extra text.
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

async function callGroqChat({ apiKey, messages, maxTokens }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });
  const bodyText = await res.text();
  return { res, bodyText };
}

async function rateLimitedGate(sendResponse) {
  const now = Date.now();
  if (now < rateLimitUntil) {
    sendResponse({ error: 'rate_limited', retryAfterMs: rateLimitUntil - now });
    return false;
  }
  const wait = Math.max(0, lastRequestTime + MIN_DELAY_MS - now);
  if (wait > 0) await sleep(wait);
  lastRequestTime = Date.now();
  return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const isSingle = msg.type === 'classify' && typeof msg.text === 'string';
  const isBatch = msg.type === 'classify_batch' && Array.isArray(msg.items);
  if (!isSingle && !isBatch) {
    sendResponse({ error: 'bad_request' });
    return true;
  }

  (async () => {
    const { groqApiKey } = await chrome.storage.local.get(['groqApiKey']);
    if (!groqApiKey || !groqApiKey.trim()) {
      sendResponse({ error: 'no_api_key' });
      return;
    }

    const apiKey = groqApiKey.trim();

    try {
      const okToCall = await rateLimitedGate(sendResponse);
      if (!okToCall) return;

      // --- Single tweet classification (backwards compatible) ---
      if (isSingle) {
        const text = msg.text.slice(0, 2000);
        const { res, bodyText } = await callGroqChat({
          apiKey,
          messages: [
            { role: 'system', content: CLASSIFY_SYSTEM },
            { role: 'user', content: `Tweet to classify:\n\n${text}` },
          ],
          maxTokens: 80,
        });

        if (res.status === 429) {
          rateLimitUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          sendResponse({ error: 'rate_limited', retryAfterMs: RATE_LIMIT_COOLDOWN_MS });
          return;
        }

        if (!res.ok) {
          sendResponse({ error: 'api_error', details: bodyText });
          return;
        }

        let data;
        try {
          data = JSON.parse(bodyText);
        } catch (_) {
          sendResponse({ error: 'api_error', details: bodyText });
          return;
        }

        const content = data.choices?.[0]?.message?.content?.trim() || '';
        let isFearMongering = false;
        let reason = '';
        try {
          const parsed = JSON.parse(content);
          isFearMongering = !!parsed.isFearMongering;
          reason = typeof parsed.reason === 'string' ? parsed.reason : '';
        } catch (_) {}
        sendResponse({ isFearMongering, reason });
        return;
      }

      // --- Batch classification ---
      const items = msg.items
        .filter((it) => it && typeof it.key === 'string' && typeof it.text === 'string')
        .slice(0, 10); // hard cap for safety

      if (items.length === 0) {
        sendResponse({ results: [] });
        return;
      }

      const batchPrompt = [
        `Classify each tweet item below. Return ONLY a JSON array.`,
        `Each array element must be: {"key":"<same key>","isFearMongering":true/false,"reason":"..."}.`,
        `If not fear-mongering, reason MUST be "".`,
        ``,
        `Items:`,
        ...items.map((it) => `- key: ${it.key}\n  text: ${it.text.replace(/\s+/g, ' ').slice(0, 800)}`),
      ].join('\n');

      const { res, bodyText } = await callGroqChat({
        apiKey,
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM },
          { role: 'user', content: batchPrompt },
        ],
        maxTokens: 500,
      });

      if (res.status === 429) {
        rateLimitUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        sendResponse({ error: 'rate_limited', retryAfterMs: RATE_LIMIT_COOLDOWN_MS });
        return;
      }

      if (!res.ok) {
        sendResponse({ error: 'api_error', details: bodyText });
        return;
      }

      let data;
      try {
        data = JSON.parse(bodyText);
      } catch (_) {
        sendResponse({ error: 'api_error', details: bodyText });
        return;
      }

      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const arr = tryParseJsonArray(content);
      if (!arr) {
        sendResponse({ error: 'api_error', details: content });
        return;
      }

      const results = arr
        .filter((r) => r && typeof r.key === 'string')
        .map((r) => ({
          key: r.key,
          isFearMongering: !!r.isFearMongering,
          reason: typeof r.reason === 'string' ? r.reason : '',
        }));

      sendResponse({ results });
    } catch (e) {
      sendResponse({ error: 'network', details: String(e.message) });
    }
  })();

  return true;
});
