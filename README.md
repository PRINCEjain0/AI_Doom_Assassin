# 🎯 AI Doom Assassin

**Automatically filter out AI fear-mongering posts on X/Twitter** – because your feed doesn't need that energy.

Blurs doom posts with hilarious viral messages. Each hidden post gets a random funny overlay. Your mental health will thank you.

## ✨ Features

- 🤖 **AI-Powered Detection** – Uses Groq's free LLM to identify serious AI fear-mongering
- 😂 **Viral Overlay Messages** – 10 random funny messages when posts are hidden
- 🎭 **Smart Filtering** – Distinguishes humour/satire from genuine doom-posting
- 🚀 **Auto-Runs** – Starts automatically when you visit X, no clicks needed
- 💚 **100% Free** – Uses Groq free tier (no credit card required)
- ⚡ **Rate Limited** – Stays under free tier limits, auto-resumes after cooldown
- 🎛️ **Popup Control** – Toggle on/off, see stats, manage API key

## 🎬 Demo

When a doom post is detected, it gets blurred with a random message like:

- 🚨 *"AI doom detected. Your feed is now 100% less panicky. Click to see the chaos anyway."*
- *"Another 'AI will take your job' post? We don't do that here. Click if you're brave."*
- *"This post tried to scare you about AI. We said no. Click to reveal anyway."*

And 7 more variations!

## 🚀 Installation

### Step 1: Get a Groq API Key (Free)

1. Go to **[console.groq.com](https://console.groq.com)**
2. Sign up (free, no credit card)
3. Navigate to **API Keys** → **Create API Key**
4. Copy your key (starts with `gsk_...`)

### Step 2: Install Extension

1. **Download/Clone** this repo
2. Open your browser:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
3. **Enable Developer mode** (toggle in top right)
4. Click **"Load unpacked"**
5. Select the `AI_Doom_Assassin` folder

### Step 3: Configure

1. Click the extension icon → **Settings** (or right-click → Options)
2. Paste your **Groq API key**
3. Click **Save**

### Step 4: Use It

1. Visit **[x.com](https://x.com)** or **[twitter.com](https://twitter.com)**
2. Scroll your feed – doom posts will be automatically blurred
3. Click the blurred overlay to reveal if you want to see it anyway

## 🎛️ Controls

**Popup Menu** (click extension icon):
- **Toggle** – Enable/disable filtering
- **Status** – Shows if extension is active
- **Stats** – Count of posts hidden
- **Settings** – Manage API key

## 🔧 How It Works

1. **Scrapes tweets** from your X feed as you scroll
2. **Pre-filters** – Only sends AI-related tweets to the LLM (saves API calls)
3. **Classifies** – Groq LLM determines if it's serious fear-mongering or just humour
4. **Blurs** – Serious doom posts get blurred with a random viral message
5. **Rate limits** – Stays under Groq free tier (30 req/min)

## 💡 Tips

- **Free Tier Limits**: Groq free tier = 30 requests/min. Extension throttles to ~27/min automatically.
- **If you hit limits**: Extension pauses for 1 minute, then resumes automatically.
- **Toggle off**: Use the popup toggle if you want to see everything unfiltered temporarily.
- **Reveal posts**: Click any blurred overlay to see the original post.

## 🛠️ Tech Stack

- **Manifest V3** – Modern Chrome extension format
- **Groq API** – Free LLM (llama-3.1-8b-instant)
- **Content Scripts** – Runs on X/Twitter pages
- **Background Service Worker** – Handles API calls
- **Chrome Storage** – Stores API key and settings locally

## 📝 Privacy

- **100% Local** – API key stored only in your browser
- **No Tracking** – Extension doesn't collect or send any data except tweet text to Groq for classification
- **No Server** – Everything runs client-side, no backend needed

## 🐛 Troubleshooting

**Extension not working?**
- Check if API key is set (popup → Settings)
- Reload extension (Extensions page → Reload)
- Refresh X/Twitter page

**Posts not being hidden?**
- Make sure extension is enabled (popup toggle should be ON)
- Check console (F12) for errors
- Verify API key is valid

**Rate limit errors?**
- Normal on free tier – extension auto-pauses and resumes
- Wait 1 minute, then it continues automatically

## 📄 License

Free to use, modify, and share. Go viral with it! 🚀

## 🙏 Credits

Built with:
- [Groq](https://groq.com) – Free LLM API
- Chrome Extension APIs
- Lots of coffee ☕

---

**Made to make your X feed less doom-y**
