// contentScript.js
(function() {
  // Lắng nghe tin nhắn từ background để hiển thị tooltip
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "CRYPTO_PEEK_SHOW") {
      const text = msg.text || msg.error || "Không có dữ liệu.";
      showTooltipNearSelection(text, !!msg.error);
    }
  });

  // Tạo tooltip tại vị trí selection hiện tại
  function showTooltipNearSelection(text, isError=false) {
    const sel = window.getSelection();
    let rect = null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      if (range.getBoundingClientRect) {
        rect = range.getBoundingClientRect();
      }
    }
    const x = (rect ? rect.left : 20) + window.scrollX;
    const y = (rect ? rect.bottom : 20) + window.scrollY;

    const host = document.createElement("div");
    host.setAttribute("data-crypto-peek", "1");
    host.style.position = "absolute";
    host.style.left = `${Math.max(8, x)}px`;
    host.style.top = `${Math.max(8, y + 6)}px`;
    host.style.zIndex = 2147483647;

    // Shadow DOM để tránh xung đột CSS
    const shadow = host.attachShadow({ mode: "open" });
    const wrapper = document.createElement("div");
    wrapper.className = "cpp-tooltip " + (isError ? "cpp-error" : "");
    wrapper.textContent = text;

    const closeBtn = document.createElement("button");
    closeBtn.className = "cpp-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Đóng";
    closeBtn.addEventListener("click", () => host.remove());

    const style = document.createElement("style");
    style.textContent = `
      .cpp-tooltip {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        background: #111;
        color: #fff;
        padding: 10px 12px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,.25);
        max-width: 320px;
        line-height: 1.35;
        position: relative;
      }
      .cpp-tooltip.cpp-error { background: #b91c1c; }
      .cpp-close {
        position: absolute;
        top: 4px;
        right: 6px;
        width: 22px;
        height: 22px;
        border: none;
        background: transparent;
        color: rgba(255,255,255,.85);
        font-size: 18px;
        cursor: pointer;
      }
      .cpp-tooltip::after {
        content: "";
        position: absolute;
        top: -6px;
        left: 16px;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #111;
      }
      .cpp-error::after { border-bottom-color: #b91c1c; }
    `;

    wrapper.appendChild(closeBtn);
    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    document.documentElement.appendChild(host);

    // Tự động đóng sau 6 giây
    setTimeout(() => { host.remove(); }, 6000);
  }
})();
