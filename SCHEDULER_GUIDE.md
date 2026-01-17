# 📅 Scheduled Actions System - User Guide

## 🎯 What Is This?

The Scheduled Actions System allows you to automate NFT operations with time-triggered actions. Schedule mints, transfers, drops, and burns to execute automatically at specific times!

---

## 🚀 Quick Start

### 1. Access the Admin Panel

Navigate to: **https://claim.futuresrelic.com/admin-scheduler.html**

Login with your admin password (same as other admin panels).

### 2. Create Your First Scheduled Mint

1. Click **"+ Create Action"**
2. Fill in the form:
   - **Name**: "Test Mint in 5 Minutes"
   - **Type**: "Mint NFTs"
   - **Execution Time**: Click "+5min" preset button
   - **To Wallet**: Enter a wallet address (e.g., `czkua.wam`)
   - **Template ID**: Enter a template ID (e.g., `391378`)
   - **Quantity**: `1`
3. Click **"Save Action"**
4. Wait 5 minutes and check the execution history!

---

## 📋 Features

### ⏰ Time Presets

Quick buttons to schedule actions:
- **+5min**: Perfect for testing
- **+30min**: Short delay
- **+1hr**: One hour from now
- **+24hr**: Tomorrow at this time
- **+7days**: One week from now

### 🔨 Mint Action (Available Now!)

**What it does:** Automatically mints NFTs at the scheduled time

**Parameters:**
- **To Wallet**: Wallet that receives the NFTs
- **Template ID**: Template to mint
- **Quantity**: Number of NFTs to mint (default: 1)
- **Authorized Minter**: Wallet with minting permissions (default: `futuresrelic`)

**Example Use Cases:**
- Daily login rewards at midnight
- Scheduled giveaways
- Time-delayed rewards after crafting
- Automated airdrops

### 📤 Transfer Action (Coming Soon)

Transfer NFTs from one wallet to another at scheduled time.

### 🎁 Drop Action (Coming Soon)

Create claim windows with start/end times and limits.

### 🔥 Burn Action (Coming Soon)

Automatically burn NFTs at scheduled time.

---

## 🎛️ Admin Panel Guide

### Actions Tab

**View All Scheduled Actions:**
- See ID, name, type, execution time, and status
- ⚠️ **Overdue** label if action is past due but not executed

**Action Statuses:**
- 🟡 **Pending**: Waiting to execute
- 🟢 **Completed**: Successfully executed
- 🔴 **Failed**: Execution failed (check error)
- ⚪ **Cancelled**: Manually cancelled

**Buttons:**
- **👁️ View**: See full action details and parameters
- **🚫 Cancel**: Cancel a pending action (can't undo!)
- **🗑️ Delete**: Permanently delete an action

**Top Buttons:**
- **🔄 Refresh**: Reload actions list
- **▶️ Run Now**: Manually trigger scheduler to check pending actions
- **+ Create Action**: Open create form

### Executions Tab

**View Execution History:**
- See all past executions (success and failures)
- Transaction IDs link to WAX Block Explorer
- Error messages for failed executions

---

## 🔧 How It Works

### The Scheduler

**Background Worker:**
- Runs automatically every **60 seconds**
- Checks for pending actions where `execution_time <= NOW`
- Executes actions and logs results
- Starts automatically when server starts

**Execution Flow:**
1. Scheduler finds pending action
2. Validates parameters
3. Executes action (e.g., mints NFT)
4. Logs transaction ID on success
5. Marks action as completed or failed
6. Saves execution history

### Database Tables

**`scheduled_actions`:**
- Stores all scheduled actions
- Fields: name, type, params, execution_time, status

**`action_executions`:**
- Logs every execution attempt
- Fields: action_id, status, transaction_id, error_message

---

## 💡 Pro Tips

### Testing

1. **Start with +5min preset** - Quick feedback loop
2. **Check server logs** - See detailed execution logs
3. **Use "Run Now"** - Manually trigger scheduler for immediate testing
4. **Monitor execution tab** - Track all attempts and results

### Production Use

1. **Set execution times in the future** - System validates this
2. **Double-check wallet addresses** - No undo for mints!
3. **Test with small quantities first** - Verify everything works
4. **Monitor execution history** - Catch failures early

### Debugging

**Action not executing?**
- Check execution time is in the past
- Verify action status is "pending"
- Click "Run Now" to force check
- Check server logs for errors

**Execution failed?**
- View execution history for error message
- Verify wallet has permissions
- Check template ID exists
- Ensure FUTURESRELIC_PRIVATE_KEY is set

---

## 🔐 Security

**Environment Variables Required:**
- `FUTURESRELIC_PRIVATE_KEY` - For minting (already configured)
- `POOL_FR_PRIVATE_KEY` - For pool transfers (if using transfer actions)

**Admin Only:**
- All scheduler endpoints require admin authentication
- Users cannot see or interact with scheduled actions

---

## 📊 Monitoring

### Server Logs

The scheduler logs detailed information:

```
⏰ Scheduler: Found 1 pending action(s)
⏰ Executing action #1: Test Mint (mint)
   🔨 Minting 1x Template 391378 to czkua.wam
   ✅ Minted 1/1 - TX: abc123...
   ✅ Action completed! TX: abc123...
✅ Scheduler: Completed 1 action(s)
```

### Execution History

Every execution is logged in the database:
- Success/failure status
- Transaction IDs (clickable links to blockchain)
- Error messages for debugging
- Timestamp of execution

---

## 🎓 Example Scenarios

### 1. Daily Login Reward

**Goal:** Mint 1 crEDIT daily at midnight

**Setup:**
1. Name: "Daily crEDIT Reward"
2. Type: Mint
3. Time: Tomorrow at 00:00
4. To Wallet: `userwalletname.wam`
5. Template: `391378`
6. Quantity: `1`

**Note:** This is a one-time action. For recurring, you'd need to create multiple actions or add recurring feature later.

### 2. Delayed Craft Reward

**Goal:** After user crafts, reward them 24 hours later

**Setup:**
1. After craft completes, create action via API
2. Execution Time: +24 hours from now
3. Mint reward to user's wallet

### 3. Scheduled Giveaway

**Goal:** Mint 100 NFTs to winners on Friday at 5 PM

**Setup:**
1. Name: "Friday Giveaway - Winner #1"
2. Time: This Friday 17:00
3. Quantity: `100`
4. Create one action per winner

---

## 🐛 Troubleshooting

### "Action not found or already executed/cancelled"

- Action was already processed or cancelled
- Refresh the page to see current status

### "execution_time must be in the future"

- You tried to schedule an action in the past
- Select a future time

### "Mint action requires: to_wallet, template_id"

- Missing required parameters
- Fill in all required fields

### "FUTURESRELIC_PRIVATE_KEY not configured"

- Environment variable not set in Railway
- Add it to your Railway environment variables

### Scheduler not running

- Check server logs for startup message: "🚀 Starting Action Scheduler"
- Restart the server if needed

---

## 📞 Support

**Check These First:**
1. Server logs (Railway dashboard)
2. Execution history (admin panel)
3. Action status (should be "pending")

**Common Issues:**
- Execution time in the past: Won't execute, must be future
- Wrong wallet name: Transaction fails, check spelling
- Template doesn't exist: Mint fails, verify template ID
- Private key not set: Action fails, check environment variables

---

## 🎯 What's Next?

**Phase 2 - Transfer Actions:**
- Transfer NFTs between wallets
- Support for template-based transfers
- Asset ID-based transfers

**Phase 3 - Drop Actions:**
- Create time-limited claim windows
- Set max claims and per-user limits
- Whitelist support

**Phase 4 - Burn Actions:**
- Schedule asset burns
- Deflationary mechanics

**Future:**
- Recurring actions (cron-like)
- Conditional execution
- Action chains (do X then Y)
- Webhook notifications

---

**🎉 You're all set! Start scheduling some actions and make me proud!**
