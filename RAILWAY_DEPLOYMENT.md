# 🚂 Railway Deployment - Simple Step-by-Step Guide

Follow these steps exactly - no coding required! Just clicking and copying/pasting.

---

## ✅ STEP 1: Create Railway Account

1. Open your web browser
2. Go to: **https://railway.app**
3. Click the **"Login"** button (top right corner)
4. Click **"Login with GitHub"**
5. Enter your GitHub username and password
6. Click **"Authorize Railway"** when asked
7. ✅ You're now logged into Railway!

---

## ✅ STEP 2: Create New Project

1. You'll see the Railway dashboard
2. Click the big **"+ New Project"** button
3. Select **"Deploy from GitHub repo"**
4. You'll see a list of your GitHub repositories
5. Find **"futuresrelic/fr-rewards"** in the list
6. Click on it
7. Railway will start building your project
8. Wait 30 seconds...
9. ✅ Project created!

---

## ✅ STEP 3: Add Environment Variables

This is where you configure your WAX account. **This is the most important step!**

### How to Add Variables:

1. In your Railway project, click on your service (the box that says "fr-rewards")
2. Click the **"Variables"** tab at the top
3. Click **"+ New Variable"** button
4. Enter the variable name in the first box
5. Enter the value in the second box
6. Click outside the boxes or press Enter to save
7. Repeat for each variable below

### Variables to Add:

Copy these exactly (click "+ New Variable" for each one):

---

**Variable #1:**
```
Name: WAX_PRIVATE_KEY
Value: [Your WAX private key here]
```
⚠️ **Get this from:** Your WAX wallet's private key export
⚠️ **KEEP SECRET!** Never share this!

---

**Variable #2:**
```
Name: WAX_ACCOUNT
Value: futuresrelic
```
(Or your actual WAX account name)

---

**Variable #3:**
```
Name: COLLECTION_NAME
Value: futuresrelic
```
(Your NFT collection name on AtomicHub)

---

**Variable #4:**
```
Name: WHITELIST_TEMPLATES
Value: 217679,217680,217682
```
(Your eligible template IDs - change these to your actual template IDs)

---

**Variable #5:**
```
Name: REWARD_TEMPLATE
Value: 251276
```
(The template ID you want to mint as a reward)

---

**Variable #6:**
```
Name: COOLDOWN_HOURS
Value: 24
```
(How many hours between claims - 24 = once per day)

---

**Variable #7:**
```
Name: ADMIN_PASSWORD
Value: YourSecurePassword123!
```
(Make this a STRONG password - you'll use this to login to /admin)

---

**Variable #8:**
```
Name: JWT_SECRET
Value: RandomSecret789XYZ456ABC
```
(Any random text - just make it long and random)

---

**Variable #9:**
```
Name: NODE_ENV
Value: production
```
(Type this exactly)

---

**Variable #10:**
```
Name: PORT
Value: 3000
```
(Type this exactly)

---

### After Adding All Variables:

1. Railway will automatically redeploy
2. You'll see "Deploying..." at the top
3. Wait 2-3 minutes
4. ✅ Deployment complete when you see "Active" with a green dot!

---

## ✅ STEP 4: Get Your Website URL

1. Still in your Railway project
2. Click the **"Settings"** tab
3. Scroll down to the **"Networking"** section
4. Under "Public Networking", click **"Generate Domain"**
5. Railway creates a URL like: `fr-rewards-production-abc123.up.railway.app`
6. **COPY THIS URL** - this is your website!
7. ✅ Your site is now live!

---

## ✅ STEP 5: Test Your Website

1. Open a new browser tab
2. Paste your Railway URL
3. You should see the **"NFT Holder Rewards"** page with:
   - Title: "🎨 NFT Holder Rewards"
   - Connect Wallet buttons
   - Purple gradient background
4. ✅ If you see this, it's working!

---

## ✅ STEP 6: Test Admin Panel

1. Add `/admin` to your URL
   - Example: `https://your-app.up.railway.app/admin`
2. You should see the **"Admin Panel"** login page
3. Enter the password you set in `ADMIN_PASSWORD`
4. Click **"Login"**
5. You should see:
   - Statistics (will be all zeros at first)
   - Configuration form with your settings
   - Recent claims table
6. ✅ Admin panel working!

---

## 🎉 YOU'RE DONE!

Your NFT Rewards System is now live on Railway!

### What You Can Do Now:

✅ **Share your URL** with NFT holders
✅ **Connect your wallet** and test claiming
✅ **Access admin panel** to monitor activity
✅ **Update configuration** anytime through admin panel

---

## 📝 Important URLs to Save:

**Main App:** `https://your-app.up.railway.app`
**Admin Panel:** `https://your-app.up.railway.app/admin`
**Railway Dashboard:** `https://railway.app/project/[your-project-id]`

---

## 🔧 Making Changes Later

### To Update Configuration:

1. Go to your website `/admin`
2. Login with admin password
3. Change settings in the Configuration form
4. Click "Save Configuration"
5. Changes apply immediately!

### To Update Code:

1. Any changes pushed to GitHub will auto-deploy
2. Railway watches your GitHub repo
3. Automatic deployments on every push!

---

## 🆘 Troubleshooting

### Site Not Loading?

1. Go to Railway dashboard
2. Click on your project
3. Check deployment logs (click "View Logs")
4. Look for errors in red text

### "Database error" message?

1. Go to Railway dashboard
2. Click your service
3. Go to Variables tab
4. Make sure ALL 10 variables are added correctly
5. Check for typos

### Can't login to admin?

1. Check your `ADMIN_PASSWORD` variable in Railway
2. Make sure it matches what you're typing
3. It's case-sensitive!

### Wallet not connecting?

1. Try refreshing the page
2. Check you have Wax Cloud Wallet or Anchor installed
3. Try the other wallet option

### Need to see logs?

1. Railway dashboard → Your project
2. Click "Deployments" tab
3. Click latest deployment
4. Click "View Logs"
5. You'll see all server activity

---

## 💡 Pro Tips

- **Bookmark your URLs** (main app and admin panel)
- **Save your environment variables** somewhere safe (encrypted note)
- **Check admin panel daily** to monitor claims
- **Railway is free tier** for small projects (great for testing!)
- **Upgrade Railway** if you get lots of traffic

---

## 🎯 Next Steps

1. ✅ Share your app URL with NFT holders
2. ✅ Announce in your Discord/Twitter
3. ✅ Test claiming with your own wallet first
4. ✅ Monitor admin panel for activity
5. ✅ Adjust settings as needed

---

## 📞 Need Help?

**Railway Issues:**
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

**App Issues:**
- Check the logs in Railway
- Review the USER_GUIDE.md
- Review the ADMIN_GUIDE.md

---

## ✨ You Did It!

Congratulations! Your NFT Rewards System is live! 🎉

No coding required - you just deployed a full blockchain application! 🚀
