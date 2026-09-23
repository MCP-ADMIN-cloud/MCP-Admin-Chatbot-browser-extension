chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Fallback message proxy for non-streaming network requests (e.g. model fetching)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "BG_FETCH") {
    fetch(message.url, message.options)
      .then(async (res) => {
        const text = await res.text();
        sendResponse({
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          data: text,
        });
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          status: 0,
          error: err.message,
        });
      });
    return true; // Keep channel open for async sendResponse
  }
});
