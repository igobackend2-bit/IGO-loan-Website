# Hostinger Deployment Guide for IGO Website

## Prerequisites

1. Node.js 18+ installed on Hostinger
2. Access to SSH/Terminal (for VPS/Cloud plans)
3. Supabase project with tables created

## Environment Variables Required

Create a `.env` file on Hostinger with these variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Email (SMTP)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password

# Server
PORT=3000
NODE_ENV=production
```

## Deployment Steps (VPS/Cloud Hosting)

### 1. Upload Files
Upload all files to your Hostinger server (via FTP or Git):
```bash
# Exclude these folders:
- node_modules/
- .git/
- .netlify/
- .vercel/
```

### 2. Install Dependencies
```bash
cd /path/to/your/project
npm install --production
```

### 3. Start with PM2 (Recommended)
```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start the server
pm2 start server.js --name "igo-website"

# Save PM2 config
pm2 save
pm2 startup
```

### 4. Configure Nginx (if using reverse proxy)
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

### 5. Update API Endpoints in Frontend

Change all API calls from `/.netlify/functions/` to `/api/`:

**Before:**
```javascript
fetch('/.netlify/functions/farm-loan-application', ...)
```

**After:**
```javascript
fetch('/api/farm-loan-application', ...)
```

## Alternative: Client-Side Only (Shared Hosting)

If using Hostinger Shared Hosting without Node.js support:

1. Upload only HTML/CSS/JS files (no server.js)
2. Use Supabase client-side SDK directly
3. Update `assets/app.js` to call Supabase directly instead of API endpoints

## Troubleshooting

### Build Failed Error
- Check Node.js version: `node --version` (needs 16+)
- Check all dependencies are installed: `npm list`
- Verify environment variables are set

### API Not Working
- Ensure `server.js` is running (check with `pm2 status`)
- Check firewall allows the PORT
- Verify Supabase URL and keys are correct

### CORS Errors
- Add your domain to CORS whitelist in `server.js`
- Check Supabase CORS settings

## File Structure on Hostinger

```
public_html/
├── index.html
├── agri-projects.html
├── farm-loan-form.html
├── portal.html
├── procurement.html
├── assets/
│   ├── style.css
│   ├── app.js
│   └── navbar.css
├── server.js          # (if using VPS)
├── package.json
├── .env               # (environment variables)
└── node_modules/      # (installed dependencies)
```

## Quick Checklist

- [ ] All files uploaded (excluding node_modules, .git)
- [ ] `npm install` executed on server
- [ ] `.env` file created with correct values
- [ ] `server.js` started with PM2
- [ ] Nginx configured (if needed)
- [ ] Domain DNS pointing to server
- [ ] SSL certificate installed
