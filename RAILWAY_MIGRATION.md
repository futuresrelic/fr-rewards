# 🚂 Railway Migration Instructions

## Run the Database Migration on Railway

Your production site at `claim.futuresrelic.com` needs a database migration to add the story tabs feature.

### Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Link to your project:**
   ```bash
   railway link
   ```
   - Select your `fr-rewards` project

4. **Run the migration:**
   ```bash
   railway run npm run migrate
   ```

Done! The migration will run on your production database.

---

### Option 2: Using Railway Dashboard (SSH Shell)

1. **Go to Railway Dashboard:**
   - Visit https://railway.app
   - Open your `fr-rewards` project

2. **Open Shell:**
   - Click on your service
   - Click the "**Shell**" tab at the top
   - You'll see a terminal

3. **Run the migration:**
   ```bash
   npm run migrate
   ```

4. **Restart your service:**
   - Click on the "Settings" tab
   - Scroll down and click "Restart"

Done! Your production site now has story tabs!

---

### Option 3: Trigger via Code Deploy

The easiest way is to just push this migration update to GitHub:

1. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add database migration script"
   git push
   ```

2. **After Railway deploys, open Railway Shell and run:**
   ```bash
   npm run migrate
   ```

---

## Verify Migration Success

After running the migration, check these URLs:

1. **Admin Story Tabs:**
   - https://claim.futuresrelic.com/admin-story-tabs.html
   - Login with your admin password
   - You should see the story tabs manager

2. **Story Page:**
   - https://claim.futuresrelic.com/story.html
   - Connect your wallet
   - Tab filters should appear if you have tabs configured

---

## Troubleshooting

### "Error: no such column: nav_config"
- Migration hasn't run yet
- Follow Option 1 or 2 above

### Railway CLI not working?
- Use Option 2 (Dashboard Shell) instead

### Still getting errors?
- Check Railway logs in the dashboard
- Ensure the migration completed successfully
- Try restarting the service in Railway settings

---

## What This Migration Does

✅ Adds `story_tabs` table for custom story tabs
✅ Adds `tab_id` column to `workflow_actions`
✅ Adds `nav_config` column to `config` for navigation settings
✅ Safe to run multiple times (uses IF NOT EXISTS)

---

## Need Help?

Check the Railway logs for detailed error messages:
1. Railway Dashboard → Your Project
2. Click "Deployments"
3. Click latest deployment
4. Click "View Logs"
