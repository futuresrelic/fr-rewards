# Railway Volume Setup for Data Persistence

This guide will help you set up Railway Volume so your database and templates persist across deployments.

## Problem

Without a volume, your SQLite database is stored in the container's filesystem. When Railway redeploys:
- Container is destroyed ❌
- Database file is lost ❌
- All your templates are gone ❌

## Solution: Railway Volume

Railway Volumes are persistent storage that survives deployments.

## Setup Steps

### 1. Create a Volume

1. Go to your Railway project: https://railway.app/project/YOUR_PROJECT_ID
2. Click on your `fr-rewards` service
3. Go to the **"Variables"** tab
4. Scroll down to **"Volumes"** section
5. Click **"+ New Volume"**
6. Configure:
   - **Mount Path**: `/app/data`
   - **Name**: `fr-rewards-data` (or any name you like)
7. Click **"Add"**

### 2. Verify Environment Variable

Make sure this environment variable is set (should already be there from Dockerfile):

```
DATABASE_FILE=/app/data/database.sqlite
```

Check in **Variables** tab. If not there, add it.

### 3. Redeploy

After adding the volume:
1. Railway will automatically redeploy
2. Watch the deploy logs
3. You should see:
   ```
   🌱 Checking default templates...
   ✅ Seeded template: 247050 (Apprentice Editor Card)
   ✅ Seeded template: 247051 (2nd Assistant Editor Card)
   ✅ Seeded template: 247052 (1st Assistant Editor Card)
   ✅ Seeded template: 247053 (Associate Editor Card)
   ```

### 4. Test Persistence

1. Go to admin panel and add a new template
2. Trigger a redeploy (push a commit or restart service)
3. Check admin panel again - your template should still be there! ✅

## Backup & Restore

Even with persistence, always backup your data:

### Export (Backup)
1. Go to admin panel
2. Click **"📥 Export Settings"**
3. Save the JSON file somewhere safe
4. Do this before major changes!

### Import (Restore)
1. Go to admin panel
2. Click **"📤 Import Settings"**
3. Select your backup JSON file
4. Check "Replace existing templates" if you want to overwrite
5. Click import

## Troubleshooting

### Database Not Persisting

**Check volume is mounted:**
```bash
# In Railway's deployment logs, look for:
Mounting volume on: /var/lib/containers/railwayapp/bind-mounts/.../vol_XXXXX
```

**Check environment variable:**
```bash
DATABASE_FILE=/app/data/database.sqlite
```

**Check database location in logs:**
```bash
✅ Database initialized successfully!
   Location: /app/data/database.sqlite
```

If it says `/app/database.sqlite` (without `/data`), the env var isn't set correctly.

### Templates Not Showing

1. Check Railway logs for seeding messages
2. Export your settings as backup
3. Delete the volume
4. Create a new volume at `/app/data`
5. Redeploy
6. Import your backup

### Multiple Databases

If you have templates in the admin panel but users can't claim:
- You might have two databases (one in container, one in volume)
- Fix: Delete the volume, create new one, redeploy
- Use export/import to migrate data

## Volume Details

**What's stored in the volume:**
- `database.sqlite` - Main database
- `database.sqlite-wal` - Write-ahead log (SQLite performance)
- `database.sqlite-shm` - Shared memory (SQLite performance)

**Volume survives:**
- ✅ Deployments
- ✅ Code updates
- ✅ Service restarts
- ✅ Railway maintenance

**Volume does NOT survive:**
- ❌ Volume deletion (obviously!)
- ❌ Service deletion
- ❌ Project deletion

## Best Practices

1. **Always export before major changes**
   - Before deleting templates
   - Before modifying database code
   - Weekly backups

2. **Test in development first**
   - Use export from production
   - Test in local development
   - Import to production when ready

3. **Monitor your data**
   - Check Railway logs after deploy
   - Verify templates load correctly
   - Test a claim to ensure database is working

4. **Volume backups**
   - Railway doesn't automatically backup volumes
   - Use Export feature regularly
   - Save JSON backups in version control or cloud storage

## Need Help?

If data persistence still isn't working:

1. Check Railway logs for errors
2. Verify volume mount path matches `DATABASE_FILE`
3. Export your current data
4. Ask for help with logs + export file
