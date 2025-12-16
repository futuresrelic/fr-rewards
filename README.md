# WAX NFT Holder Rewards System

A web-based NFT rewards claiming system where users can connect their WAX wallet, verify NFT holdings, and claim reward NFTs on a time-based cooldown.

## Features

- 🔐 Wallet Authentication (Wax Cloud Wallet + Anchor)
- ✅ NFT Holder Verification
- 🎁 Time-Based Reward Claiming
- ⏰ Cooldown Management
- 🛠️ Admin Configuration Panel
- 📱 Mobile Responsive Design

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your WAX account details:
- `WAX_PRIVATE_KEY`: Your minting account's private key
- `WAX_ACCOUNT`: Your WAX account name
- `WHITELIST_TEMPLATES`: Comma-separated template IDs
- `REWARD_TEMPLATE`: Template ID to mint as reward

### 3. Initialize Database

```bash
npm run init-db
```

### 4. Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Visit `http://localhost:3000`

## User Guide

### For Users:

1. **Connect Wallet**: Click "Connect Wallet" and choose Wax Cloud Wallet or Anchor
2. **Check Eligibility**: System automatically checks if you hold whitelisted NFTs
3. **Claim Rewards**: Click "Claim Reward" when cooldown expires
4. **Track Claims**: View your claim history and countdown timers

### For Admins:

1. Navigate to `/admin`
2. Login with admin password
3. Configure:
   - Whitelist template IDs
   - Reward template ID
   - Cooldown duration
   - Collection name
4. View statistics and claim history

## API Endpoints

### User Endpoints
- `GET /api/user/holdings/:account` - Get user's NFT holdings
- `GET /api/user/eligibility/:account` - Check eligibility
- `GET /api/user/claims/:account` - Get claim history
- `POST /api/user/claim` - Claim reward
- `GET /api/user/cooldowns/:account` - Get cooldown status

### Admin Endpoints (Protected)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/config` - Get configuration
- `POST /api/admin/config` - Update configuration
- `GET /api/admin/stats` - Get statistics
- `GET /api/admin/claims` - Get all claims

## Database Schema

### config
- Stores system configuration (whitelist, rewards, cooldown)

### claims
- Tracks all reward claims and cooldown timestamps

### admin_accounts
- Stores authorized admin wallet accounts

## Security

- All wallet operations use official WAX APIs
- Server-side verification of holdings and cooldowns
- Rate limiting on API endpoints
- Admin authentication required for configuration
- No private keys stored or transmitted

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite
- **Blockchain**: WAX, AtomicAssets API, EOSJS
- **Frontend**: HTML, CSS, JavaScript
- **Wallet Integration**: WaxJS, Anchor Link

## Deployment

### Environment Variables

Ensure all required environment variables are set in production:
- `NODE_ENV=production`
- `WAX_PRIVATE_KEY` (keep secure!)
- `ADMIN_PASSWORD` (use strong password)
- `JWT_SECRET` (generate random secret)

### Deployment Platforms

Compatible with:
- Railway
- Vercel
- Netlify
- Heroku
- Any Node.js hosting

## License

MIT
