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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'classify' || typeof msg.text !== 'string') {
    sendResponse({ isFearMongering: false, reason: '' });
    return true;
  }

  (async () => {
    const { groqApiKey } = await chrome.storage.local.get(['groqApiKey']);
    if (!groqApiKey || !groqApiKey.trim()) {
      sendResponse({ isFearMongering: false, reason: '', error: 'no_api_key' });
      return;
    }

    const now = Date.now();
    if (now < rateLimitUntil) {
      sendResponse({ isFearMongering: false, reason: '', error: 'rate_limited', retryAfterMs: rateLimitUntil - now });
      return;
    }

    const wait = Math.max(0, lastRequestTime + MIN_DELAY_MS - now);
    if (wait > 0) await sleep(wait);

    lastRequestTime = Date.now();
    const text = msg.text.slice(0, 2000);
    const apiKey = groqApiKey.trim();

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: CLASSIFY_SYSTEM },
            { role: 'user', content: `Tweet to classify:\n\n${text}` },
          ],
          max_tokens: 80,
          temperature: 0.1,
        }),
      });

      const bodyText = await res.text();

      if (res.status === 429) {
        rateLimitUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        sendResponse({ isFearMongering: false, reason: '', error: 'rate_limited', retryAfterMs: RATE_LIMIT_COOLDOWN_MS });
        return;
      }

      if (!res.ok) {
        sendResponse({ isFearMongering: false, reason: '', error: 'api_error', details: bodyText });
        return;
      }

      let data;
      try {
        data = JSON.parse(bodyText);
      } catch (_) {
        sendResponse({ isFearMongering: false, reason: '', error: 'api_error', details: bodyText });
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
    } catch (e) {
      sendResponse({ isFearMongering: false, reason: '', error: 'network', details: String(e.message) });
    }
  })();

  return true;
});
