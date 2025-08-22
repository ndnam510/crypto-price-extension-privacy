// background.js
const MENU_ID = "crypto-price-peek";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Xem giá (CoinGecko): \"%s\"",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  const symbolRaw = (info.selectionText || "").trim();
  if (!symbolRaw) {
    chrome.tabs.sendMessage(tab.id, { type: "CRYPTO_PEEK_SHOW", error: "Không có lựa chọn văn bản." });
    return;
  }
  const symbol = symbolRaw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (symbol.length < 2 || symbol.length > 8) {
    chrome.tabs.sendMessage(tab.id, { type: "CRYPTO_PEEK_SHOW", error: `Ký hiệu không hợp lệ: "${symbolRaw}"` });
    return;
  }

  try {
    const { priceUSD, coinId, coinName } = await fetchPriceFromCoingecko(symbol);
    const text = priceUSD !== null
      ? `${coinName || coinId} (${symbol}): $${priceUSD.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
      : `Không tìm thấy giá cho "${symbol}"`;
    chrome.tabs.sendMessage(tab.id, { type: "CRYPTO_PEEK_SHOW", text });
  } catch (err) {
    chrome.tabs.sendMessage(tab.id, { type: "CRYPTO_PEEK_SHOW", error: `Lỗi khi lấy giá: ${err.message || err}` });
  }
});

async function fetchPriceFromCoingecko(symbol) {
  // Một số map nhanh cho ký hiệu phổ biến
  const quickMap = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "WLD": "worldcoin",
    "USDT": "tether",
    "USDC": "usd-coin",
    "BNB": "binancecoin",
    "SOL": "solana",
    "ARB": "arbitrum",
    "OP": "optimism",
    "TON": "the-open-network",
  };

  let coinId = quickMap[symbol] || null;

  // Nếu chưa có coinId, dùng /search của CoinGecko để dò theo symbol
  if (!coinId) {
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} khi gọi /search`);
    const data = await res.json();

    // Ưu tiên khớp symbol chính xác (không phân biệt hoa/thường)
    const exact = (data.coins || []).filter(c => (c.symbol || "").toUpperCase() === symbol);
    const best = (exact[0] || data.coins?.[0]);
    if (best?.id) {
      coinId = best.id;
    }
  }

  if (!coinId) {
    return { priceUSD: null, coinId: null, coinName: null };
  }

  const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
  const priceRes = await fetch(priceUrl);
  if (!priceRes.ok) throw new Error(`HTTP ${priceRes.status} khi gọi /simple/price`);
  const priceData = await priceRes.json();
  const priceUSD = priceData?.[coinId]?.usd ?? null;

  // Lấy tên coin để hiển thị đẹp hơn (không bắt buộc)
  let coinName = null;
  try {
    const coinRes = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}`);
    if (coinRes.ok) {
      const c = await coinRes.json();
      coinName = c?.name || null;
    }
  } catch (e) { /* optional */ }

  return { priceUSD, coinId, coinName };
}
