document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('ticker-input');
  const button = document.getElementById('check-btn');
  const resultEl = document.getElementById('result');

  function setResult(text) {
    if (resultEl) resultEl.textContent = text;
  }

  async function fetchPriceFromCoingecko(symbolInput) {
    const symbol = (symbolInput || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!symbol) throw new Error('Vui lòng nhập ký hiệu.');
    if (symbol.length < 2 || symbol.length > 8) throw new Error(`Ký hiệu không hợp lệ: "${symbolInput}"`);

    const quickMap = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      WLD: 'worldcoin',
      USDT: 'tether',
      USDC: 'usd-coin',
      BNB: 'binancecoin',
      SOL: 'solana',
      ARB: 'arbitrum',
      OP: 'optimism',
      TON: 'the-open-network',
    };

    let coinId = quickMap[symbol] || null;

    if (!coinId) {
      const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
      const res = await fetch(searchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} khi gọi /search`);
      const data = await res.json();
      const exact = (data.coins || []).filter(c => (c.symbol || '').toUpperCase() === symbol);
      const best = (exact[0] || data.coins?.[0]);
      if (best?.id) coinId = best.id;
    }

    if (!coinId) return { priceUSD: null, coinId: null, coinName: null, symbol };

    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
    const priceRes = await fetch(priceUrl);
    if (!priceRes.ok) throw new Error(`HTTP ${priceRes.status} khi gọi /simple/price`);
    const priceData = await priceRes.json();
    const priceUSD = priceData?.[coinId]?.usd ?? null;

    let coinName = null;
    try {
      const coinRes = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}`);
      if (coinRes.ok) {
        const c = await coinRes.json();
        coinName = c?.name || null;
      }
    } catch (e) {}

    return { priceUSD, coinId, coinName, symbol };
  }

  async function handleCheck() {
    const raw = (input?.value || '').trim();
    if (!raw) {
      setResult('Vui lòng nhập ký hiệu coin.');
      return;
    }

    setResult('Đang tải...');

    try {
      const { priceUSD, coinName, coinId, symbol } = await fetchPriceFromCoingecko(raw);
      if (priceUSD == null) {
        setResult(`Không tìm thấy giá cho "${symbol || raw}"`);
        return;
      }
      const text = `${coinName || coinId} (${symbol}): $${Number(priceUSD).toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
      setResult(text);
    } catch (e) {
      setResult(`Lỗi: ${e.message || e}`);
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
}); 