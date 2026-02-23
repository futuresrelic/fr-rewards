# WAX Wallet Viewer — Deployment Guide

## What This Is

A standalone Next.js 14 web app that lets you:
- View any WAX wallet's AtomicAssets NFT collection
- Log in with WAX Cloud Wallet (WCW) or Anchor wallet
- Filter, sort, search your NFTs
- See images, videos, and all on-chain attributes
- Admin panel at `/admin` for health checks and config

---

## Deploy to Railway (Recommended — Free tier available)

### Step 1: Push to GitHub

Your code is in the `wax-wallet-viewer/` folder. You can either:
- Use this branch in the existing repo, **or**
- Create a new GitHub repo and push just the `wax-wallet-viewer/` folder

For a new repo:
```bash
# Copy wax-wallet-viewer to its own folder somewhere
cp -r wax-wallet-viewer /tmp/my-wax-viewer
cd /tmp/my-wax-viewer
git init
git add .
git commit -m "Initial WAX wallet viewer"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/wax-wallet-viewer.git
git push -u origin main
```

### Step 2: Set up Railway

1. Go to **https://railway.app** and sign up (or log in)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your GitHub repo
4. Railway will auto-detect it's a Next.js app (via nixpacks)

### Step 3: Set Environment Variables in Railway

In your Railway project, go to **Variables** tab and add:

| Variable | Value | Required? |
|----------|-------|-----------|
| `ADMIN_PASSWORD` | Your chosen admin password | **YES** |
| `JWT_SECRET` | Random 32+ char string | **YES** |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.up.railway.app` | **YES for WCW** |
| `NEXT_PUBLIC_APP_NAME` | `WAX Wallet Viewer` | Optional |
| `NEXT_PUBLIC_WAX_RPC` | `https://wax.greymass.com` | Optional |
| `NEXT_PUBLIC_ATOMICASSETS_API` | `https://wax.api.atomicassets.io` | Optional |
| `NEXT_PUBLIC_IPFS_GATEWAY` | `https://atomichub-ipfs.com/ipfs` | Optional |

To generate a JWT secret, run this in any terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Deploy

Railway will automatically build and deploy when you push to the repo.
Your app will be live at `https://your-app.up.railway.app`.

> **Important**: After deploying, copy your Railway URL and update `NEXT_PUBLIC_APP_URL`
> to that exact URL. This is needed for WAX Cloud Wallet to redirect back properly.

---

## Run Locally

```bash
cd wax-wallet-viewer
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
# Open http://localhost:3000
```

---

## Wallet Connection Troubleshooting

### WAX Cloud Wallet (WCW)
- Opens a **popup window** for login
- If popup is blocked: allow popups for your domain in browser settings
- Works on localhost and HTTPS
- Requires `NEXT_PUBLIC_APP_URL` to match exactly (no trailing slash)

### Anchor Wallet
- Opens a **QR code** or deep-link to Anchor app
- You need [Anchor wallet](https://www.greymass.com/anchor) installed on desktop or mobile
- On desktop: Anchor browser extension or desktop app must be open
- On mobile: scan QR code with Anchor mobile app

### Debug
- All wallet/API events are logged to **browser console** (F12 → Console)
- Look for `[INFO]`, `[OK]`, `[WARN]`, `[ERROR]` prefixed lines
- Admin panel at `/admin` → "API Health Check" tests connectivity

---

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home / search
│   ├── my-wallet/          # My wallet (requires login)
│   ├── wallet/[account]/   # Any public wallet viewer
│   ├── admin/              # Admin panel (password protected)
│   └── api/                # API routes
│       ├── admin/auth/     # Login endpoint
│       └── debug/          # Health check endpoint
├── components/
│   ├── assets/             # AssetCard, AssetGrid, AssetModal, Filters
│   ├── wallet/             # WalletButton, WalletModal
│   ├── layout/             # Navbar, Footer
│   └── ui/                 # Button, Badge, Modal, Spinner
├── context/
│   └── WalletContext.tsx   # WharfKit wallet state
├── hooks/
│   └── useAssets.ts        # TanStack Query hooks for AtomicAssets API
├── lib/
│   ├── atomicassets.ts     # AtomicAssets API client
│   ├── types.ts            # TypeScript types
│   ├── constants.ts        # API URLs, config
│   └── utils.ts            # IPFS resolver, formatters
├── store/
│   └── filterStore.ts      # Zustand store for filters/sort
└── middleware.ts           # Admin route protection
```

---

## Wallet Libraries Used

| Library | Purpose |
|---------|---------|
| `@wharfkit/session` | Core WharfKit session management |
| `@wharfkit/web-renderer` | Browser UI for wallet selection dialogs |
| `@wharfkit/wallet-plugin-wax-cloud-wallet` | WAX Cloud Wallet support |
| `@wharfkit/wallet-plugin-anchor` | Anchor wallet support |

---

## Common Issues

**"Wallet kit not initialized"**
→ Refresh the page. WharfKit loads async on first render.

**"Connection cancelled or failed"**
→ Check browser console. WAX Cloud Wallet popup may have been blocked.

**Images not loading**
→ IPFS gateway may be slow. Admin panel shows which gateway is configured.
→ Try changing `NEXT_PUBLIC_IPFS_GATEWAY` to `https://ipfs.io/ipfs`

**API errors (429 / rate limit)**
→ The AtomicAssets API has rate limits. Wait a moment and try again.
→ Consider setting up your own AtomicAssets API node for heavy usage.

**Admin panel shows "Admin password not configured"**
→ Set `ADMIN_PASSWORD` in Railway environment variables.
