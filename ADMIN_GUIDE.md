# Admin Guide - WAX NFT Rewards System

Complete guide for administrators to manage the rewards system.

## Accessing the Admin Panel

### URL

Navigate to: `your-domain.com/admin`

### Login

**Method 1: Password Authentication**
1. Enter the `ADMIN_PASSWORD` set in your `.env` file
2. Click "Login"
3. Session lasts 24 hours

**Method 2: Wallet Authentication** (if configured)
1. Wallet accounts listed in `ADMIN_ACCOUNTS` can login
2. Connect wallet to authenticate
3. No password needed

## Admin Dashboard Overview

The dashboard has three main sections:
1. **Statistics** - Real-time metrics
2. **Configuration** - System settings
3. **Recent Claims** - Activity log

## Statistics Section

### Key Metrics

**Total Claims**
- All-time number of reward claims
- Increases with each successful claim

**Active Users**
- Unique wallet accounts that have claimed
- Useful for engagement tracking

**Claims (24h)**
- Number of claims in last 24 hours
- Shows current activity level

**Last Claim**
- Time since last claim (e.g., "5m ago")
- Auto-refreshes every 30 seconds

### Using Statistics

- Monitor daily activity trends
- Identify peak usage times
- Track growth over time
- Estimate reward distribution costs

## Configuration Section

### Collection Name

**Field**: `Collection Name`
**Example**: `futuresrelic`

- The WAX collection to check for NFTs
- Must exactly match your AtomicAssets collection name
- Case-sensitive
- Change this if you create a new collection

### Whitelist Template IDs

**Field**: `Whitelist Template IDs`
**Format**: Comma-separated numbers
**Example**: `217679,217680,217682,217683`

**What it does:**
- Defines which NFT templates are eligible for rewards
- Users must hold at least ONE of these templates
- Multiple templates can be whitelisted

**How to add templates:**
1. Find template IDs on AtomicHub
2. Enter as comma-separated list
3. No spaces needed (but allowed)
4. Click "Save Configuration"

**Example use cases:**
- Whitelist rare NFTs only: `217679,217680`
- Whitelist entire series: `217679,217680,217681,217682,217683`
- Single template: `217679`

### Reward Template ID

**Field**: `Reward Template ID`
**Format**: Single number
**Example**: `251276`

**What it does:**
- The template ID that will be minted as a reward
- This NFT is minted to users when they claim
- Must have minting authorization for this template

**Important:**
- Your `WAX_ACCOUNT` must have minting rights
- Template must exist in your collection
- Ensure sufficient mint supply (if limited)

### Cooldown Period

**Field**: `Cooldown Period (hours)`
**Format**: Number (hours)
**Example**: `24`

**What it does:**
- Hours users must wait between claims
- Applied per template
- Starts after successful claim

**Common values:**
- `24` - Once per day (typical)
- `12` - Twice per day
- `48` - Once every two days
- `168` - Once per week

### Saving Configuration

1. Make your changes
2. Click "Save Configuration"
3. Success message appears
4. Changes take effect immediately
5. All users will see new settings on next page load

## Recent Claims Table

Shows the last 20 claims with:

**Account**: User's wallet name
**Template ID**: Which template was used to claim
**Transaction**: Link to block explorer (click to view)
**Claimed At**: When the claim occurred
**Next Claim**: When user can claim again

### Using the Claims Table

- Monitor real-time activity
- Verify claims are working
- Investigate user issues
- Track which templates are popular
- Check transaction IDs if users report problems

## Common Admin Tasks

### Adding New Eligible Templates

1. Create templates on AtomicHub
2. Note the template IDs
3. Go to admin panel
4. Add IDs to "Whitelist Template IDs"
5. Save configuration
6. Announce to users!

**Example:**
- Current: `217679,217680`
- New template: `217685`
- Updated: `217679,217680,217685`

### Changing Reward Template

1. Create or choose new reward template
2. Ensure minting permissions
3. Go to admin panel
4. Update "Reward Template ID"
5. Save configuration
6. New claims will use new template

### Adjusting Cooldown

**Making it stricter:**
- Change from `24` to `48` hours
- Users must wait longer
- Reduces reward distribution rate

**Making it more generous:**
- Change from `24` to `12` hours
- Users can claim more often
- Increases reward distribution rate

**Effect on existing cooldowns:**
- Already-running cooldowns continue with old duration
- New claims use new duration

### Removing a Template from Whitelist

1. Identify template to remove
2. Edit whitelist string
3. Remove the template ID
4. Save configuration

**Example:**
- Before: `217679,217680,217682`
- Remove 217680
- After: `217679,217682`

**Effect:**
- Users with only removed template become ineligible
- Users with other whitelisted templates unaffected
- Existing cooldowns still apply if template re-added

## Monitoring & Maintenance

### Daily Checks

- [ ] Review statistics for anomalies
- [ ] Check recent claims for issues
- [ ] Verify transaction IDs are valid
- [ ] Monitor active user count

### Weekly Tasks

- [ ] Backup database (`database.sqlite`)
- [ ] Review total claims trend
- [ ] Check template mint supply (if limited)
- [ ] Plan any configuration updates

### Monthly Tasks

- [ ] Analyze user engagement
- [ ] Consider adjusting cooldowns
- [ ] Evaluate adding new templates
- [ ] Review system performance

## Troubleshooting

### User Can't Claim (But Should Be Eligible)

**Check:**
1. Verify they own a whitelisted template
2. Check their cooldown hasn't expired yet
3. Review recent claims table for their account
4. Verify template ID is in whitelist

**Solutions:**
- Wait for cooldown to expire
- Confirm correct wallet connected
- Check blockchain for ownership

### Minting Fails

**Possible causes:**
- Insufficient minting authorization
- Template doesn't exist
- WAX account resources low
- Private key incorrect

**Solutions:**
1. Verify `WAX_PRIVATE_KEY` is correct
2. Check minting permissions on AtomicHub
3. Ensure WAX account has CPU/NET
4. Test minting manually on AtomicHub

### Configuration Not Saving

**Check:**
- Admin session valid (not expired)
- Input format correct (commas, numbers)
- No special characters
- Browser console for errors

**Solutions:**
- Logout and login again
- Refresh page
- Check server logs
- Verify database permissions

### Statistics Not Updating

**Possible causes:**
- Page not refreshing
- Database locked
- No recent activity

**Solutions:**
- Refresh the page (manual)
- Auto-refresh every 30 seconds (automatic)
- Check server is running
- Verify database is accessible

## Security Best Practices

### Protect Admin Access

- [ ] Use strong admin password (20+ characters)
- [ ] Change default password immediately
- [ ] Don't share admin credentials
- [ ] Logout when finished
- [ ] Use HTTPS in production

### Protect WAX Account

- [ ] Never commit `.env` to git
- [ ] Use dedicated minting account
- [ ] Limit permissions to minting only
- [ ] Regularly rotate private keys
- [ ] Monitor account activity

### Monitor for Abuse

**Watch for:**
- Abnormally high claim rate from single user
- Unusual claiming patterns
- Rapid cooldown exploitation attempts

**Rate limiting** (included):
- 100 requests per 15 minutes (general)
- 10 requests per 15 minutes (claim endpoint)

### Backup Strategy

**Daily:**
```bash
cp database.sqlite "backups/db-$(date +%Y%m%d).sqlite"
```

**Before config changes:**
```bash
cp database.sqlite database.backup.sqlite
```

**Automated:**
```bash
# Add to crontab
0 2 * * * cp /path/to/database.sqlite /path/to/backups/db-$(date +%Y%m%d).sqlite
```

## Advanced Configuration

### Multiple Admin Accounts

Edit `.env`:
```bash
ADMIN_ACCOUNTS=futuresrelic,admin2,admin3
```

Re-initialize database:
```bash
npm run init-db
```

### Custom Port

Edit `.env`:
```bash
PORT=3001
```

Restart server.

### Database Location

Edit `.env`:
```bash
DATABASE_FILE=/custom/path/database.sqlite
```

### Custom RPC Endpoint

Edit `.env`:
```bash
WAX_RPC_ENDPOINT=https://your-custom-rpc.com
```

## API Access (Advanced)

Admins can access API directly:

### Get Auth Token

```bash
curl -X POST http://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your_password"}'
```

Returns: `{"success":true,"token":"jwt_token_here"}`

### Use Token

```bash
curl http://your-domain.com/api/admin/stats \
  -H "Authorization: Bearer jwt_token_here"
```

### Available Endpoints

- `GET /api/admin/config` - Get configuration
- `POST /api/admin/config` - Update configuration
- `GET /api/admin/stats` - Get statistics
- `GET /api/admin/claims?limit=100` - Get claims

## Performance Optimization

### For High Traffic

1. **Use PostgreSQL** instead of SQLite
   - Edit `database.js` to use PostgreSQL
   - Better concurrency

2. **Add Caching**
   - Cache AtomicAssets API responses
   - Reduce blockchain queries

3. **Load Balancing**
   - Run multiple instances
   - Use reverse proxy (Nginx)

### Database Maintenance

```bash
# Check database size
ls -lh database.sqlite

# Vacuum database (optimize)
sqlite3 database.sqlite "VACUUM;"

# Check integrity
sqlite3 database.sqlite "PRAGMA integrity_check;"
```

## Getting Help

### Check Logs

```bash
# Development
npm run dev

# Production
npm start

# PM2 (if used)
pm2 logs wax-rewards
```

### Common Log Messages

- `Minting reward NFT to [account]` - Normal claim
- `Error minting NFT` - Check permissions
- `Failed to load config` - Database issue

### Support Resources

- Check SETUP.md for deployment issues
- Review USER_GUIDE.md to understand user experience
- Check server logs for error details
- Test API endpoints with Postman/curl

## Recommended Workflow

### Initial Launch

1. Deploy system with conservative settings (24h cooldown)
2. Announce to community
3. Monitor first few claims closely
4. Adjust based on feedback

### Ongoing Management

1. Check admin panel 1-2x daily
2. Respond to user issues promptly
3. Update whitelist as new templates release
4. Rotate reward templates periodically
5. Keep system updated and secure

## Pro Tips

- Set up monitoring/alerts for server downtime
- Create a changelog for configuration updates
- Announce changes to users in advance
- Test configuration changes on testnet first
- Keep backup of original template lists
- Document your specific setup/customizations

## Conclusion

The admin panel provides complete control over the rewards system. Regular monitoring and maintenance will ensure smooth operation and happy users!
