// contentScript.js
(function() {
  // Lắng nghe tin nhắn từ background để hiển thị tooltip
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "CRYPTO_PEEK_SHOW") {
      const text = msg.text || msg.error || "Không có dữ liệu.";
      const isError = !!msg.error;
      const coinId = msg.coinId || null;
      showTooltipNearSelection(text, isError, coinId);
    }
  });

  // Tạo tooltip tại vị trí selection hiện tại
  function showTooltipNearSelection(text, isError=false, coinId=null) {
    
    const sel = window.getSelection();
    let rect = null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      if (range.getBoundingClientRect) {
        rect = range.getBoundingClientRect();
      }
    }
    
    // Fallback position nếu không có selection
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
    
    // Thêm icon và styling cho error message
    if (isError) {
      const icon = document.createElement("span");
      icon.textContent = "⚠️ ";
      icon.style.marginRight = "6px";
      icon.style.fontSize = "14px";
      wrapper.appendChild(icon);
      
      // Thêm border highlight cho error
      wrapper.style.border = "2px solid #fbbf24";
      wrapper.style.boxShadow = "0 0 0 1px #f59e0b";
    }
    
    const textNode = document.createElement("span");
    textNode.textContent = text;
    wrapper.appendChild(textNode);

    // Add CoinGecko link (only for successful price lookups with coinId, not errors)
    if (!isError && coinId) {
      const coingeckoLink = document.createElement("a");
      coingeckoLink.className = "cpp-coingecko-link";
      coingeckoLink.href = `https://www.coingecko.com/en/coins/${coinId}`;
      coingeckoLink.target = "_blank";
      coingeckoLink.rel = "noopener noreferrer";
      coingeckoLink.textContent = "View on CoinGecko";
      coingeckoLink.title = `Open ${coinId} page on CoinGecko`;
      coingeckoLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(coingeckoLink.href, "_blank");
      });
      wrapper.appendChild(coingeckoLink);
    }

    // Add "Buy this ticker" button (only for successful price lookups, not errors)
    if (!isError) {
      const buyButton = document.createElement("button");
      buyButton.className = "cpp-buy-btn";
      buyButton.textContent = "Buy this ticker";
      buyButton.title = "Open Binance registration";
      buyButton.addEventListener("click", () => {
        window.open("https://accounts.binance.com/register?ref=342403929", "_blank");
      });
      wrapper.appendChild(buyButton);
    }

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
        padding: 10px 35px 10px 12px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,.25);
        max-width: 320px;
        line-height: 1.35;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cpp-tooltip.cpp-error { 
        background: #dc2626; 
        border: 2px solid #b91c1c;
        box-shadow: 0 8px 30px rgba(220, 38, 38, 0.4);
        animation: cpp-error-pulse 0.5s ease-in-out;
      }
      @keyframes cpp-error-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      .cpp-buy-btn {
        background: #f0b90b;
        color: #000;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
        align-self: flex-start;
        margin-top: 4px;
      }
      .cpp-buy-btn:hover {
        background: #d4a10a;
      }
      .cpp-buy-btn:active {
        background: #b8940f;
      }
      .cpp-coingecko-link {
        color: #8b9dc3;
        text-decoration: none;
        font-size: 12px;
        opacity: 0.9;
        transition: opacity 0.2s ease, color 0.2s ease;
        align-self: flex-start;
        margin-top: 2px;
        border-bottom: 1px solid rgba(139, 157, 195, 0.4);
      }
      .cpp-coingecko-link:hover {
        opacity: 1;
        color: #a8bbd8;
        border-bottom-color: rgba(168, 187, 216, 0.6);
      }
      .cpp-close {
        position: absolute;
        top: 6px;
        right: 8px;
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: rgba(255,255,255,.7);
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
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
      .cpp-error::after { 
        border-bottom-color: #b91c1c; 
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 6px solid #b91c1c;
      }
    `;

    wrapper.appendChild(closeBtn);
    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    document.documentElement.appendChild(host);

    // Tự động đóng sau 6 giây (8 giây cho error để user có thời gian đọc)
    setTimeout(() => { host.remove(); }, isError ? 8000 : 6000);
  }
})();
