# Chatlaxy: Render Frontend + Local Cloudflare Tunnel Architecture

This guide explains how to connect your Render-hosted Chatlaxy frontend to your local backend and SQLite database using Cloudflare Tunnel.

---

## 🏗️ Architecture

```
User's Browser
      ↓
Render Static Frontend (HTML/JS/CSS)
      ↓ (HTTPS REST + WSS WebSockets)
Cloudflare Tunnel (https://your-tunnel.trycloudflare.com)
      ↓ (Local Loopback)
Your Local Computer (server.js on port 3000)
      ↓
SQLite Database (chatlaxy.sqlite)
```

---

## 🚀 Step 1: Start Your Local Backend

On your local machine:

```bash
# Start the local backend + SQLite database
npm run dev
# or: node server.js
```

Verify your local backend is running:
- Open `http://localhost:3000/health`
- You should see:
```json
{
  "status": "ok",
  "service": "chatlaxy",
  "database": "sqlite",
  "port": 3000
}
```

---

## 🌐 Step 2: Start Cloudflare Tunnel

### Option A: Free Quick Tunnel (No Cloudflare account needed)

Download `cloudflared` (if not already installed) from [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

Run:
```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will output a public HTTPS URL like:
```
https://random-words-1234.trycloudflare.com
```

### Option B: Named Cloudflare Tunnel (Custom Domain)

If you have a Cloudflare account with your own domain:
```bash
cloudflared tunnel run <YOUR_TUNNEL_NAME>
```

---

## ⚙️ Step 3: Connect Render Frontend to Your Tunnel

1. Go to your **Render Dashboard** → Your **Chatlaxy Static Site**.
2. Click **Environment**.
3. Add or update the environment variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-tunnel-url.trycloudflare.com` (e.g. `https://random-words-1234.trycloudflare.com` without a trailing slash)
4. Trigger a deploy on Render.

When the Render site builds, Vite will bake `VITE_API_URL` into the frontend bundle.

---

## 🔒 Security & Persistence Notes

1. **Zero Database Exposure**: The SQLite database file (`chatlaxy.sqlite`) is never exposed to the public. Only valid REST endpoints and WebSockets on `server.js` are reachable.
2. **Realtime WebSockets**: WebSockets automatically connect to `wss://your-tunnel-url.trycloudflare.com/ws` for instant message delivery and presence detection.
3. **Data Persistence**: All users, wallets, ranks, channels, roles, messages, and daily rewards are stored in `./chatlaxy.sqlite` on your local computer.
4. **Media Storage**: Avatars, banners, and audio files continue uploading directly to Cloudinary.
