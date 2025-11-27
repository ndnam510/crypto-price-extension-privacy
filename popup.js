document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('ticker-input');
  const button = document.getElementById('check-btn');
  const resultEl = document.getElementById('result');



  function setResult(text, coinId = null) {
    if (resultEl) {
      // Use innerHTML to preserve line breaks and add CoinGecko link
      // First escape HTML to prevent XSS, then convert newlines to <br>
      let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      escaped = escaped.replace(/\n/g, '<br>');
      
      // Add CoinGecko link if coinId is provided
      if (coinId) {
        const linkHtml = `<br><a href="https://www.coingecko.com/en/coins/${coinId}" target="_blank" rel="noopener noreferrer" style="color: #8b9dc3; text-decoration: none; font-size: 12px; opacity: 0.9; transition: opacity 0.2s ease, color 0.2s ease; border-bottom: 1px solid rgba(139, 157, 195, 0.4);" onmouseover="this.style.opacity='1'; this.style.color='#a8bbd8'; this.style.borderBottomColor='rgba(168, 187, 216, 0.6)'" onmouseout="this.style.opacity='0.9'; this.style.color='#8b9dc3'; this.style.borderBottomColor='rgba(139, 157, 195, 0.4)'">View on CoinGecko</a>`;
        escaped += linkHtml;
      }
      
      resultEl.innerHTML = escaped;
    }
  }

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

  // Helper: fetch với retry + backoff
async function retryFetch(url, options = {}, retries = 3, delay = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.ok) {
        return res;
      }

      // Nếu bị rate limit (429) hoặc lỗi server (5xx) thì thử lại
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt < retries) {
          // Exponential backoff + jitter
          const backoff = delay * Math.pow(2, attempt) + Math.random() * 300;
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
      }

      // Nếu không phải lỗi retry-able → throw luôn
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      if (attempt < retries) {
        const backoff = delay * Math.pow(2, attempt) + Math.random() * 300;
        await new Promise(r => setTimeout(r, backoff));
      } else {
        throw err;
      }
    }
  }
}

const quickMap = {
  BTC: { id: 'bitcoin', name: 'Bitcoin' },
  ETH: { id: 'ethereum', name: 'Ethereum' },
  WLD: { id: 'worldcoin', name: 'Worldcoin' },
  USDT: { id: 'tether', name: 'Tether' },
  USDC: { id: 'usd-coin', name: 'USD Coin' },
  BNB: { id: 'binancecoin', name: 'BNB' },
  SOL: { id: 'solana', name: 'Solana' },
  ARB: { id: 'arbitrum', name: 'Arbitrum' },
  OP: { id: 'optimism', name: 'Optimism' },
  TON: { id: 'the-open-network', name: 'Toncoin' },
};

const cache = {};

// Lightweight CSV search - streams through file line-by-line without caching everything
// Uses minimal RAM (only one line in memory at a time)
async function searchCoinIdInCSV(symbol) {
  try {
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

async function fetchPriceFromCoingecko(symbolInput) {
  
  const symbol = (symbolInput || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  if (!symbol) {
    throw new Error('Please enter a symbol.');
  }
  if (symbol.length < 2 || symbol.length > 8) {
    throw new Error(`Invalid symbol: "${symbolInput}"`);
  }

  // Check cache trước
  if (cache[symbol]) {
    return cache[symbol];
  }

  let coinId, coinName;

  if (quickMap[symbol]) {
    ({ id: coinId, name: coinName } = quickMap[symbol]);
  } else {
    // Lightweight search in CSV (streams line-by-line, minimal RAM)
    try {
      const csvEntry = await searchCoinIdInCSV(symbol);
      
      if (csvEntry) {
        coinId = csvEntry.id;
        coinName = csvEntry.name;
      } else {
        // Fallback: Nếu không có trong CSV, dùng /search của CoinGecko
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
        
        const res = await retryFetch(searchUrl);
        
        const data = await res.json();
        
        const exact = (data.coins || []).find(c => (c.symbol || '').toUpperCase() === symbol);
        const best = exact || data.coins?.[0];
        coinId = best?.id;
        coinName = best?.name;
      }
    } catch (error) {
      throw error;
    }
  }

  if (!coinId) {
    return { priceUSD: null, coinId: null, coinName: null, symbol };
  }

  try {
    // Lấy giá (có retry/backoff)
    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_vol=true`;
    
    const priceRes = await retryFetch(priceUrl);
    
    const priceData = await priceRes.json();
    
    const priceUSD = priceData?.[coinId]?.usd ?? null;
    const volume24h = priceData?.[coinId]?.usd_24h_vol ?? null;

    const result = { priceUSD, volume24h, coinId, coinName, symbol };
    cache[symbol] = result; // cache lại
    return result;
  } catch (error) {
    throw error;
  }
}


  async function handleCheck() {
    
    const raw = (input?.value || '').trim();
    
    if (!raw) {
      setResult('Input crypto ticker.');
      return;
    }

    setResult('Loading...');

    try {
      const { priceUSD, volume24h, coinName, coinId, symbol } = await fetchPriceFromCoingecko(raw);
      
      
      if (priceUSD == null) {
        setResult(`No price found for "${symbol || raw}"`);
        return;
      }
      
      const text = `${coinName || coinId} (${symbol}): $${Number(priceUSD).toLocaleString(undefined, { maximumFractionDigits: 8 })}${volume24h ? `\n24h Vol: $${formatLargeNumber(volume24h)}` : ''}`;
      setResult(text, coinId);
    } catch (e) {
      setResult(`Error: ${e.message || e}`);
    }
  }

  button?.addEventListener('click', handleCheck);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  });

  const footer = document.querySelector('.footer');
  if (footer) {
    footer.style.cursor = 'pointer';
    footer.addEventListener('click', () => {
      window.open('https://www.coingecko.com/vi', '_blank');
    });
  }

  // Handle popular ticker button clicks
  document.querySelectorAll('.ticker-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const symbol = btn.dataset.symbol;
      if (!symbol) return;
      
      // Update input field with the clicked symbol
      if (input) {
        input.value = symbol;
      }
      
      // Show loading state
      setResult('Loading...');
      
      try {
        const { priceUSD, volume24h, coinName, coinId } = await fetchPriceFromCoingecko(symbol);
        
        if (priceUSD == null) {
          setResult(`No price found for "${symbol}"`);
          return;
        }
        
        const text = `${coinName || coinId} (${symbol}): $${Number(priceUSD).toLocaleString(undefined, { maximumFractionDigits: 8 })}${volume24h ? `\n24h Vol: $${formatLargeNumber(volume24h)}` : ''}`;
        setResult(text, coinId);
      } catch (e) {
        setResult(`Error: ${e.message || e}`);
      }
    });
  });
}); 