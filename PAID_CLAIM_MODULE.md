# 💰 Paid Claim Module

## Overview

The Paid Claim module enables **direct NFT sales with WAX token payments** on your platform. Users pay WAX tokens, the system verifies the payment on-chain, and automatically mints the NFT to their wallet.

**No NeftyBlocks. No embeds. Full control.**

---

## Quick Start

### 1. Add Module to Your Page

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <!-- Your Paid NFT Sale -->
  <div id="nft-sale" data-module="paid-claim" data-config='{
    "template_id": 251276,
    "price_wax": "10.00000000",
    "payment_wallet": "your.wallet",
    "template_name": "Cool NFT",
    "template_image": "https://example.com/nft.png"
  }'></div>

  <!-- Load Module System -->
  <script src="/modules/module-loader.js"></script>
</body>
</html>
```

### 2. Access Your Page

Visit: `http://localhost:3000/paid-claim-example.html` to see it in action!

---

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `template_id` | Number | ✅ Yes | NFT template ID to mint |
| `price_wax` | String | ✅ Yes | Price in WAX (8 decimals: "10.00000000") |
| `payment_wallet` | String | ✅ Yes | Wallet that receives payments |
| `collection_name` | String | No | Collection name (default: "futuresrelic") |
| `template_name` | String | No | Display name for NFT |
| `template_image` | String | No | URL to NFT image/video |
| `max_supply` | Number | No | Max available (for display only) |
| `per_wallet_limit` | Number | No | Max per wallet (for display only) |
| `auto_connect` | Boolean | No | Auto-connect wallet (default: false) |
| `show_purchase_history` | Boolean | No | Show purchase history (default: true) |

---

## How It Works

### User Flow

1. **Connect Wallet** → User connects WAX Cloud Wallet or Anchor
2. **View NFT** → Module displays NFT details and price
3. **Click Purchase** → User clicks "Purchase for X WAX" button
4. **Sign Transaction** → Wallet prompts user to sign WAX token transfer
5. **Payment Sent** → Transaction broadcasts to blockchain
6. **Verification** → Backend verifies payment on-chain
7. **NFT Minted** → Backend mints NFT to user's wallet
8. **Success!** → User sees confirmation with transaction links

### Backend Flow

```
┌─────────────────┐
│  User Payment   │  WAX Token Transfer (signed by user)
│   Transaction   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /api/user/ │  Frontend sends payment TX ID
│    purchase     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Verify Payment │  Query blockchain RPC
│   On-Chain      │  ✓ Correct amount?
│                 │  ✓ Correct recipient?
│                 │  ✓ Correct sender?
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Mint NFT       │  Server mints with mint wallet
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Record Purchase │  Save to database
│   in Database   │
└─────────────────┘
```

---

## API Endpoints

### POST /api/user/purchase

Process an NFT purchase with WAX payment.

**Request:**
```json
{
  "account": "user.wam",
  "template_id": 251276,
  "payment_transaction_id": "abc123...",
  "price_wax": "10.00000000 WAX",
  "payment_wallet": "your.wallet"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Purchase completed successfully!",
  "payment_transaction_id": "abc123...",
  "mint_transaction_id": "def456...",
  "template_id": 251276,
  "price_paid": "10.00000000 WAX"
}
```

### GET /api/user/purchases/:account

Get purchase history for a wallet.

**Response:**
```json
{
  "success": true,
  "account": "user.wam",
  "purchases": [
    {
      "id": 1,
      "wallet_account": "user.wam",
      "template_id": 251276,
      "price_wax": "10.00000000 WAX",
      "payment_transaction_id": "abc123...",
      "mint_transaction_id": "def456...",
      "status": "completed",
      "purchased_at": "2026-01-22T10:30:00Z",
      "minted_at": "2026-01-22T10:30:05Z"
    }
  ]
}
```

---

## Database Schema

### `purchases` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `wallet_account` | TEXT | Buyer's wallet |
| `template_id` | INTEGER | NFT template purchased |
| `price_wax` | TEXT | Price paid in WAX |
| `payment_transaction_id` | TEXT | Payment TX ID (UNIQUE) |
| `mint_transaction_id` | TEXT | Mint TX ID |
| `status` | TEXT | pending / completed / failed |
| `error_message` | TEXT | Error if failed |
| `purchased_at` | TIMESTAMP | Purchase time |
| `minted_at` | TIMESTAMP | Mint time |

---

## Security Features

### ✅ Payment Verification

- **On-Chain Verification**: Backend queries blockchain to verify payment
- **Amount Check**: Ensures exact WAX amount was paid
- **Recipient Check**: Confirms payment went to correct wallet
- **Sender Check**: Validates payment came from requesting user

### ✅ Duplicate Prevention

- **Transaction Uniqueness**: Payment TX ID must be unique
- **Idempotency**: Same payment can't mint multiple NFTs
- **Status Tracking**: Prevents re-processing pending/completed purchases

### ✅ Error Handling

- **CPU Exhaustion**: Graceful handling of low server resources
- **Failed Payments**: Records failures with error messages
- **Network Errors**: Retries with multiple RPC endpoints
- **User Feedback**: Clear error messages to user

---

## Advanced Use Cases

### 1. Multiple Price Tiers

Create different modules for different rarities:

```html
<!-- Common NFT - 5 WAX -->
<div data-module="paid-claim" data-config='{
  "template_id": 100001,
  "price_wax": "5.00000000",
  "template_name": "Common Card"
}'></div>

<!-- Rare NFT - 25 WAX -->
<div data-module="paid-claim" data-config='{
  "template_id": 100002,
  "price_wax": "25.00000000",
  "template_name": "Rare Card"
}'></div>

<!-- Legendary NFT - 100 WAX -->
<div data-module="paid-claim" data-config='{
  "template_id": 100003,
  "price_wax": "100.00000000",
  "template_name": "Legendary Card"
}'></div>
```

### 2. Limited Supply Tracking

Query database to enforce supply limits:

```javascript
// In server.js - add to /api/user/purchase endpoint
const purchaseCount = db.purchases.getTemplateStats(template_id);
if (purchaseCount.completed >= MAX_SUPPLY) {
  return res.status(400).json({ error: 'Sold out!' });
}
```

### 3. Per-Wallet Limits

Track purchases per user:

```javascript
// In server.js - add to /api/user/purchase endpoint
const userPurchases = db.purchases.getByAccount(account)
  .filter(p => p.template_id === template_id && p.status === 'completed');

if (userPurchases.length >= PER_WALLET_LIMIT) {
  return res.status(400).json({ error: 'Purchase limit reached' });
}
```

### 4. Time-Limited Sales

Add time restrictions:

```javascript
const saleStart = new Date('2026-02-01T00:00:00Z');
const saleEnd = new Date('2026-02-07T23:59:59Z');
const now = new Date();

if (now < saleStart || now > saleEnd) {
  return res.status(400).json({ error: 'Sale not active' });
}
```

---

## Troubleshooting

### Issue: "Payment verification failed"

**Cause**: Payment details don't match expected values

**Solutions**:
- Check price_wax has exactly 8 decimals and " WAX" suffix
- Verify payment_wallet matches your receiving wallet
- Ensure user actually sent the transaction

### Issue: "This payment has already been processed"

**Cause**: Duplicate purchase attempt with same TX ID

**Solutions**:
- This is normal - prevents double-minting
- User should create a new payment transaction

### Issue: "Server temporarily unavailable - insufficient CPU"

**Cause**: Mint wallet is low on CPU resources

**Solutions**:
- Wait a few minutes for CPU to regenerate
- Stake more WAX to mint wallet for CPU
- User's payment is safe - retry will work

### Issue: Module not loading

**Cause**: Module loader or dependencies not loaded

**Solutions**:
- Ensure `/modules/module-loader.js` is included
- Check browser console for errors
- Verify file paths are correct

---

## Files Structure

```
/home/user/fr-rewards/
├── wax.js                              # Added verifyTokenPayment()
├── database.js                         # Added purchases table & methods
├── server.js                           # Added purchase endpoints
└── public/
    ├── modules/
    │   ├── paid-claim.html            # Module HTML template
    │   ├── paid-claim.js              # Module JavaScript
    │   └── module-loader.js           # Module system (existing)
    └── paid-claim-example.html        # Example usage page
```

---

## Advantages Over NeftyBlocks

| Feature | Paid Claim Module | NeftyBlocks |
|---------|-------------------|-------------|
| **Hosting** | Your platform | External embed |
| **Customization** | 100% control | Limited |
| **Branding** | Your branding | NeftyBlocks branding |
| **Data** | Your database | NeftyBlocks database |
| **Speed** | Fast (no iframe) | Slower (iframe) |
| **Reliability** | Your uptime | Depends on NeftyBlocks |
| **Integration** | Seamless | External |
| **Fees** | None (just WAX fees) | Possible fees |
| **Features** | Add anything | Limited to their features |

---

## Next Steps

1. **Test It**: Visit `/paid-claim-example.html` to see it working
2. **Customize**: Adjust styling in `/styles.css`
3. **Integrate**: Add to your existing pages
4. **Extend**: Add supply limits, discounts, bundles, etc.
5. **Launch**: Start selling NFTs directly to your community!

---

## Support

If you need help or want to add features:

1. Check the example page: `/paid-claim-example.html`
2. Review the code comments in `paid-claim.js`
3. Test with small WAX amounts first
4. Monitor purchases in database: `purchases` table

---

**Built with ❤️ for the Future's Relic community**

*Now you can bypass NeftyBlocks and sell NFTs directly on your platform!*
