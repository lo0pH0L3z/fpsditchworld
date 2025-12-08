# Quick Fix - Manual Steps

## Step 1: Edit the Caddyfile

1. Open in Notepad: `C:\Users\jucid\Documents\DITCHFLIX\caddy\Caddyfile`

2. Find this section:
   ```
   fps.ditchworld.com {
       reverse_proxy localhost:3000
   }
   ```

3. Replace it with:
   ```
   fps.ditchworld.com {
       reverse_proxy localhost:3000 {
           header_up Upgrade {http.request.header.Upgrade}
           header_up Connection {http.request.header.Connection}
           header_up Host {http.request.host}
           header_up X-Real-IP {http.request.remote.host}
           header_up X-Forwarded-For {http.request.header.X-Forwarded-For}
           header_up X-Forwarded-Proto {http.request.scheme}
       }
   }
   ```

4. Save and close

## Step 2: Restart Caddy

Open PowerShell and run:

```powershell
cd C:\Users\jucid\Documents\DITCHFLIX
docker-compose restart caddy
```

## Step 3: Test

1. Open: `https://fps.ditchworld.com` (no :3000!)
2. Open second tab: `https://fps.ditchworld.com`
3. Both should show "ONLINE (2)"

Done! 🎉
