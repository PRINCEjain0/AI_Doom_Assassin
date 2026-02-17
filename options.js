document.getElementById('apiKey').value = '';
document.getElementById('save').onclick = save;

chrome.storage.local.get(['groqApiKey'], (data) => {
  if (data.groqApiKey) {
    document.getElementById('apiKey').value = data.groqApiKey;
  }
});

function save() {
  const key = document.getElementById('apiKey').value.trim();
  chrome.storage.local.set({ groqApiKey: key }, () => {
    const el = document.getElementById('saved');
    el.textContent = 'Saved.';
    setTimeout(() => { el.textContent = ''; }, 2000);
  });
}
