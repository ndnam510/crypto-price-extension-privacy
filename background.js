// background.js
const MENU_ID = "crypto-price-peek";

// Format large numbers with abbreviations (K, M, B, T)
function formatLargeNumber(num) {
  if (num == null || num === 0) return '0';
  
  const absNum = Math.abs(num);
  let value, suffix;
  
  if (absNum >= 1e12) {
    value = num / 1e12;
    suffix = 'T';
  } else if (absNum >= 1e9) {
    value = num / 1e9;
    suffix = 'B';
  } else if (absNum >= 1e6) {
    value = num / 1e6;
    suffix = 'M';
  } else if (absNum >= 1e3) {
    value = num / 1e3;
    suffix = 'K';
  } else {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  
  // Format to 1-2 decimal places if needed, remove unnecessary zeros
  const formatted = value.toFixed(2).replace(/\.?0+$/, '');
  return formatted + suffix;
}

// Lightweight CSV search - streams through file line-by-line without caching everything
// Uses minimal RAM (only one line in memory at a time)
// Reads from local CSV file (part of extension package, updated automatically via Chrome Web Store)
async function searchCoinIdInCSV(symbol) {
  try {
    // Use local CSV file (always available, part of extension package)
    // Chrome Web Store automatically updates this file when you publish new extension versions
    const csvUrl = chrome.runtime.getURL('coingeckoid.csv');
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let isFirstLine = true;
    
    // Stream through CSV line by line
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (isFirstLine) {
          isFirstLine = false;
          continue; // Skip header
        }
        
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Parse CSV line (handle quoted fields)
        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < trimmed.length; j++) {
          const char = trimmed[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current);
        
        if (parts.length >= 3) {
          const id = parts[0].trim();
          const lineSymbol = parts[1].trim().toUpperCase();
          const name = parts[2].trim();
          
          // Found match - stop searching and return
          if (lineSymbol === symbol && id) {
            reader.cancel(); // Stop reading
            return { id, name };
          }
        }
      }
    }
    
    // Handle last line in buffer
    if (buffer && !isFirstLine) {
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < buffer.length; j++) {
        const char = buffer[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);
      
      if (parts.length >= 3) {
        const id = parts[0].trim();
        const lineSymbol = parts[1].trim().toUpperCase();
        const name = parts[2].trim();
        
        if (lineSymbol === symbol && id) {
          return { id, name };
        }
      }
    }
    
    return null; // Not found
  } catch (error) {
    return null;
  }
}

// CSV version tracking - update this whenever you update the CSV file
// This helps track which version of the CSV is being used
// Chrome Web Store will automatically update the extension (including CSV) when you publish a new version
const CSV_VERSION = "1.0.0";

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Fetch price (CoinGecko): \"%s\"",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  
  const symbolRaw = (info.selectionText || "").trim();
  if (!symbolRaw) {
    await sendMessageSafely(tab.id, { type: "CRYPTO_PEEK_SHOW", error: "Không có lựa chọn văn bản." });
    return;
  }
  
  const symbol = symbolRaw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (symbol.length < 2 || symbol.length > 8) {
    await sendMessageSafely(tab.id, { type: "CRYPTO_PEEK_SHOW", error: `Ký hiệu không hợp lệ: "${symbolRaw}"` });
    return;
  }

  try {
    const { priceUSD, volume24h, coinId, coinName } = await fetchPriceFromCoingecko(symbol);
    const text = priceUSD !== null
      ? `${coinName || coinId} (${symbol}): $${priceUSD.toLocaleString(undefined, { maximumFractionDigits: 8 })}${volume24h ? `\n24hVol: $${formatLargeNumber(volume24h)}` : ''}`
      : `Không tìm thấy giá cho "${symbol}"`;
    // Pass coinId để content script có thể tạo CoinGecko URL
    await sendMessageSafely(tab.id, { 
      type: "CRYPTO_PEEK_SHOW", 
      text,
      coinId: priceUSD !== null ? coinId : null // Only pass coinId if we have a valid result
    });
  } catch (err) {
    await sendMessageSafely(tab.id, { type: "CRYPTO_PEEK_SHOW", error: `Lỗi khi lấy giá: ${err.message || err}` });
  }
});

// Helper function để gửi message an toàn
async function sendMessageSafely(tabId, message) {
  try {
    // Kiểm tra tab có tồn tại không
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      return;
    }
    
    
    // Gửi message bình thường cho các trang khác
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Nếu content script chưa load, thử inject lại
    if (error.message.includes('Receiving end does not exist')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['contentScript.js']
        });
        
        // Chờ một chút rồi thử gửi lại
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, message);
          } catch (retryError) {
            // Silent fail
          }
        }, 100);
      } catch (injectError) {
        // Silent fail
      }
    }
  }
}

async function fetchPriceFromCoingecko(symbol) {
  // Một số map nhanh cho ký hiệu phổ biến
  const quickMap = {
    "BTC": { id: "bitcoin", name: "Bitcoin" },
    "ETH": { id: "ethereum", name: "Ethereum" },
    "WLD": { id: "worldcoin", name: "Worldcoin" },
    "USDT": { id: "tether", name: "Tether" },
    "USDC": { id: "usd-coin", name: "USD Coin" },
    "BNB": { id: "binancecoin", name: "BNB" },
    "SOL": { id: "solana", name: "Solana" },
    "ARB": { id: "arbitrum", name: "Arbitrum" },
    "OP": { id: "optimism", name: "Optimism" },
    "TON": { id: "the-open-network", name: "Toncoin" },
  };

  let coinId = null;
  let coinName = null;

  // Kiểm tra quickMap trước (fast, no RAM used)
  if (quickMap[symbol]) {
    coinId = quickMap[symbol].id;
    coinName = quickMap[symbol].name;
  } else {
    // Lightweight search in CSV (streams line-by-line, minimal RAM)
    const csvEntry = await searchCoinIdInCSV(symbol);
    
    if (csvEntry) {
      coinId = csvEntry.id;
      coinName = csvEntry.name;
    } else {
      // Fallback: Nếu không có trong CSV, dùng /search của CoinGecko
      const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
      
      const res = await fetch(searchUrl);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} khi gọi /search`);
      }
      
      const data = await res.json();

      // Ưu tiên khớp symbol chính xác (không phân biệt hoa/thường)
      const exact = (data.coins || []).filter(c => (c.symbol || "").toUpperCase() === symbol);
      const best = (exact[0] || data.coins?.[0]);
      
      if (best?.id) {
        coinId = best.id;
        coinName = best.name || null;
      }
    }
  }

  if (!coinId) {
    return { priceUSD: null, coinId: null, coinName: null };
  }

  const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_vol=true`;
  
  const priceRes = await fetch(priceUrl);
  
  if (!priceRes.ok) {
    throw new Error(`HTTP ${priceRes.status} khi gọi /simple/price`);
  }
  
  const priceData = await priceRes.json();
  const priceUSD = priceData?.[coinId]?.usd ?? null;
  const volume24h = priceData?.[coinId]?.usd_24h_vol ?? null;

  // Không cần gọi API /coins/{coinId} nữa vì đã có coinName từ search API hoặc quickMap
  const result = { priceUSD, volume24h, coinId, coinName };
  return result;
}
