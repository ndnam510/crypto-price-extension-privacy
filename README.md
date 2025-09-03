# Crypto Price Peek Extension

A Chrome extension that provides quick and easy access to cryptocurrency prices using the CoinGecko API.

## Features

### 🎯 **Dual Price Checking Methods:**

1. **Context Menu (Right-click)**
   - Select any coin ticker text on any webpage
   - Right-click and choose "Price (CoinGecko): [ticker]"
   - Get instant price display in a beautiful tooltip

2. **Manual Input (Popup)**
   - Click the extension icon to open popup
   - Type any coin ticker (BTC, ETH, SOL, etc.)
   - Click OK or press Enter to fetch real-time price
   - View formatted price with coin name and symbol

### ✨ **Key Features:**
- **Real-time prices** from CoinGecko API
- **Smart ticker recognition** with quick mapping for popular coins
- **Beautiful tooltips** with Shadow DOM (no CSS conflicts)
- **Privacy policy** page included
- **Vietnamese language** support in UI
- **Responsive design** with modern gradient styling
- **Auto-close tooltips** after 6 seconds
- **Direct CoinGecko link** in footer

### 🪙 **Supported Coins:**
Popular coins with instant lookup: BTC, ETH, WLD, USDT, USDC, BNB, SOL, ARB, OP, TON, and many more through CoinGecko search.

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your toolbar

## Usage

### Method 1: Context Menu
1. Select any coin ticker text on any webpage
2. Right-click and choose "Price (CoinGecko): [ticker]"
3. Price appears in a tooltip near your selection

### Method 2: Popup Interface
1. Click the extension icon in your toolbar
2. Type a coin ticker in the input field
3. Click OK or press Enter
4. View the real-time price below

## Technical Details

- **Manifest V3** compatible
- **Service Worker** background script
- **Content Script** with Shadow DOM tooltips
- **Direct API calls** to CoinGecko (no background messaging)
- **Responsive popup** interface
- **Privacy-focused** design

## Privacy

This extension only fetches public cryptocurrency data from CoinGecko API. No personal data is collected or stored. See `privacy.html` for full details.

## Data Source

All price data comes from [CoinGecko](https://www.coingecko.com/vi) - a trusted cryptocurrency data provider.

## License

This project is open source and available under the MIT License.
