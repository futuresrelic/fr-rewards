# Setup Guide - WAX NFT Rewards System

Complete setup guide for deploying the NFT rewards system.

## Prerequisites

- Node.js 16+ installed
- WAX wallet account with minting permissions
- NFT collection on WAX with templates created

## Step 1: Installation

```bash
# Clone or download the repository
cd fr-rewards

# Install dependencies
npm install
```

## Step 2: Configuration

### Create `.env` file

```bash
cp .env.example .env
```

### Configure Environment Variables

Edit `.env` with your settings:

```bash
# WAX Configuration
WAX_PRIVATE_KEY=5KYourPrivateKeyHere
WAX_ACCOUNT=futuresrelic
WAX_RPC_ENDPOINT=https://api.waxsweden.org

# AtomicAssets API
ATOMIC_API=https://wax.api.atomicassets.io

# Collection Configuration
COLLECTION_NAME=futuresrelic
WHITELIST_TEMPLATES=217679,217680,217682
REWARD_TEMPLATE=251276
COOLDOWN_HOURS=24

# Admin Configuration
ADMIN_PASSWORD=YourSecurePasswordHere
ADMIN_ACCOUNTS=futuresrelic

# Server
PORT=3000
NODE_ENV=production
JWT_SECRET=generate-a-random-secret-here
```

### Important Configuration Notes

**WAX_PRIVATE_KEY**:
- This is the private key for the account that will mint NFTs
- Keep this secret and never commit to version control
- The account must have `active` permission for the collection

**WAX_ACCOUNT**:
- The account name that owns the collection
- Must have authorization to mint templates

**WHITELIST_TEMPLATES**:
- Comma-separated list of template IDs that are eligible
- Users holding any of these templates can claim rewards

**REWARD_TEMPLATE**:
- The template ID that will be minted as a reward
- Must exist in your collection

**JWT_SECRET**:
- Generate a random string for token signing
- Example: `openssl rand -base64 32`

## Step 3: Setup WAX Account

### Get Minting Permission

1. Log into your WAX account
2. Go to AtomicHub: https://wax.atomichub.io/creator
3. Navigate to your collection
4. Ensure the account has `active` permission for minting

### Create Templates

1. Create your NFT templates on AtomicHub
2. Note the template IDs
3. Add eligible template IDs to `WHITELIST_TEMPLATES`
4. Add reward template ID to `REWARD_TEMPLATE`

## Step 4: Initialize Database

```bash
npm run init-db
```

This will:
- Create SQLite database
- Set up tables
- Insert default configuration
- Add admin accounts

## Step 5: Test Locally

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Visit: http://localhost:3000

## Step 6: Deploy to Production

### Option A: Railway

1. Create account at https://railway.app
2. Create new project
3. Connect GitHub repository (or deploy from CLI)
4. Add environment variables in Railway dashboard
5. Deploy!

Railway will automatically:
- Detect Node.js
- Install dependencies
- Run the application

### Option B: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables
vercel env add WAX_PRIVATE_KEY
vercel env add WAX_ACCOUNT
# ... add all env vars

# Deploy to production
vercel --prod
```

### Option C: Docker

```bash
# Build image
docker build -t wax-nft-rewards .

# Run container
docker run -p 3000:3000 \
  -e WAX_PRIVATE_KEY="your_key" \
  -e WAX_ACCOUNT="your_account" \
  -e ADMIN_PASSWORD="your_password" \
  -e JWT_SECRET="your_secret" \
  -v $(pwd)/data:/app/data \
  wax-nft-rewards
```

### Option D: Traditional VPS (DigitalOcean, AWS, etc.)

```bash
# On your server
git clone <your-repo>
cd fr-rewards
npm install
cp .env.example .env
# Edit .env with your configuration
npm run init-db
npm start

# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name wax-rewards
pm2 save
pm2 startup
```

## Step 7: Configure Domain (Optional)

### With Railway:
- Go to Settings > Domains
- Add custom domain
- Update DNS records

### With Vercel:
- Go to Project Settings > Domains
- Add custom domain
- Follow DNS configuration instructions

### With Nginx (VPS):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 8: SSL/HTTPS

### With Railway/Vercel:
- Automatic SSL included!

### With VPS:
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

## Troubleshooting

### Database Issues

```bash
# Reset database
rm database.sqlite
npm run init-db
```

### WAX Connection Issues

- Verify `WAX_PRIVATE_KEY` is correct
- Check `WAX_ACCOUNT` has minting permissions
- Test RPC endpoint: `curl https://api.waxsweden.org/v1/chain/get_info`

### AtomicAssets API Issues

- Verify collection exists: https://wax.api.atomicassets.io/atomicassets/v1/collections/YOUR_COLLECTION
- Verify templates exist: https://wax.api.atomicassets.io/atomicassets/v1/templates/YOUR_COLLECTION/TEMPLATE_ID

### Port Already in Use

```bash
# Change PORT in .env
PORT=3001
```

## Security Checklist

- [ ] Strong `ADMIN_PASSWORD` set
- [ ] Random `JWT_SECRET` generated
- [ ] `WAX_PRIVATE_KEY` kept secure
- [ ] `.env` file not committed to git
- [ ] Rate limiting enabled (included by default)
- [ ] HTTPS enabled in production
- [ ] Database backups configured

## Next Steps

1. Test wallet connection
2. Test NFT verification
3. Test reward claiming
4. Configure admin panel
5. Invite users to test

## Support

For issues or questions:
- Check the logs: `npm start` output
- Review API responses in browser console
- Test API endpoints directly with curl/Postman

## Maintenance

### Backup Database

```bash
# Create backup
cp database.sqlite database.backup.sqlite

# Or with date
cp database.sqlite "database.$(date +%Y%m%d).sqlite"
```

### Update Configuration

1. Login to admin panel: `/admin`
2. Update settings
3. Changes take effect immediately

### Monitor Claims

- Check admin dashboard for statistics
- Review recent claims table
- Monitor server logs
