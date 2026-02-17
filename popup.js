// Popup UI for AI Doom Assassin

const toggle = document.getElementById('toggle');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');
const apiStatus = document.getElementById('apiStatus');
const optionsBtn = document.getElementById('optionsBtn');
const hiddenCountEl = document.getElementById('hiddenCount');

// Load saved state
function loadState() {
  chrome.storage.local.get(['enabled', 'groqApiKey', 'hiddenCount'], (data) => {
    const isEnabled = data.enabled !== false; // default to true
    updateToggle(isEnabled);
    updateApiStatus(data.groqApiKey);
    updateHiddenCount(data.hiddenCount || 0);
  });
}

loadState();

// Toggle enable/disable
toggle.addEventListener('click', () => {
  chrome.storage.local.get(['enabled'], (data) => {
    const newState = data.enabled === false; // toggle
    chrome.storage.local.set({ enabled: newState }, () => {
      updateToggle(newState);
      // Notify content script if on X
      chrome.tabs.query({ url: 'https://x.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'toggle', enabled: newState });
        });
      });
    });
  });
});

// Open options page
optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function updateToggle(enabled) {
  if (enabled) {
    toggle.classList.add('active');
    status.classList.remove('disabled');
    status.classList.add('enabled');
    statusText.textContent = 'Active on X';
  } else {
    toggle.classList.remove('active');
    status.classList.remove('enabled');
    status.classList.add('disabled');
    statusText.textContent = 'Disabled';
  }
}

function updateApiStatus(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    apiStatus.textContent = '⚠ No API key. Click Settings to add Groq API key.';
    apiStatus.className = 'api-status';
  } else {
    apiStatus.textContent = '✓ API key configured';
    apiStatus.className = 'api-status ok';
  }
}

function updateHiddenCount(count) {
  hiddenCountEl.textContent = count || 0;
}

// Listen for updates from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'hiddenCountUpdate') {
    updateHiddenCount(msg.count);
  }
});
