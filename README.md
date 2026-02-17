# AI Doom Assassin

Browser extension that automatically filters out AI fear-mongering posts on X/Twitter. Blurs doom posts with funny messages. Your feed will thank you.

## What It Does

When someone posts "AI will take your job" or similar doom-posting, the extension blurs it and shows a random funny message like:

- "Bro really posted 'AI will take your job' unironically. Touch grass. Click to see it."
- "Another 'learn to code' doomer? My guy, go outside. Click if you're still scrolling."
- "This post is giving 'I doom-scroll for 6 hours a day' energy. Click to join them."

And 12 more variations. Each hidden post gets a random one.

## Installation

### 1. Get a Groq API Key

Go to [console.groq.com](https://console.groq.com), sign up (free, no credit card), create an API key, copy it.

### 2. Install the Extension

1. Download/clone this repo
2. Open `chrome://extensions/` (or `edge://extensions/` / `brave://extensions/`)
3. Turn on Developer mode (top right)
4. Click "Load unpacked"
5. Select this folder

### 3. Add Your API Key

Click the extension icon → Settings, paste your Groq API key, save.

### 4. Use It

Go to x.com and scroll. It runs automatically. Doom posts get blurred. Click the overlay if you want to see them anyway.

## How It Works

1. Scrapes tweets as you scroll
2. Only sends AI-related tweets to the LLM (saves API calls)
3. Groq LLM checks if it's serious fear-mongering or just humour
4. Blurs serious doom posts with a random message
5. Rate limits to stay under Groq free tier (30 req/min)

## Controls

Click the extension icon to see:
- Toggle to enable/disable
- Status indicator
- Count of posts hidden
- Settings button

## Notes

- Uses Groq free tier (30 requests/min). Extension throttles to ~27/min automatically.
- If you hit the limit, it pauses for 1 minute then resumes.
- API key is stored only in your browser, never sent anywhere except Groq.
- No backend server needed, everything runs client-side.

## Troubleshooting

**Not working?**
- Check if API key is set (popup → Settings)
- Reload the extension
- Refresh x.com

**Posts not being hidden?**
- Make sure toggle is ON in popup
- Check console (F12) for errors
- Verify API key is valid

**Rate limit errors?**
- Normal on free tier. Extension auto-pauses for 1 min then continues.

## Tech Stuff

- Manifest V3 extension
- Groq API (llama-3.1-8b-instant)
- Content scripts for X/Twitter
- Background service worker for API calls
- Chrome storage for settings

Built with Groq's free API and Chrome extension APIs.

---

Made to make your X feed less doom-y, one blur at a time.
