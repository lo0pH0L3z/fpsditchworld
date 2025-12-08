# 🎮 PS5 FPS Range - Quick Start

## 🚀 Start Server

**Double-click:** `start-server.bat`

Server starts on: `http://localhost:3000`

---

## 👥 Connect Players

### Same Computer (Testing)
Open multiple browser tabs:
- Tab 1: `http://localhost:3000`
- Tab 2: `http://localhost:3000`
- Tab 3: `http://localhost:3000`

### Different Computers (Real Multiplayer)

**On the server computer:**
1. Run `start-server.bat`
2. Run `show-ip.bat` ← Shows the URL to share

**On other computers:**
1. Connect to the URL shown by `show-ip.bat`
2. Example: `http://192.168.1.100:3000`

---

## 🎮 Controls

| Action | Keyboard | Gamepad | DualSense Motion |
|--------|----------|---------|------------------|
| Move | WASD | Left Stick | - |
| Look | Mouse | Right Stick | ✅ Gyro |
| Shoot | Left Click | R2 | - |
| Aim (ADS) | Right Click | L2 | - |
| Jump | Space | X (Cross) | - |
| Slide | C | Circle | - |
| Reload | R | Square | - |
| Switch Weapon (cycle SMG -> Pistol -> Sniper) | Q | Triangle | - |
| Settings | Esc | Options | - |

---

## ✅ What You'll See

### HUD (Top)
- **SCORE**: Points from hitting targets
- **TIME**: Countdown timer
- **AMMO**: Current mag / Reserve
- **ONLINE (X)**: Multiplayer status & player count

### In Game
- **Red spheres**: AI targets (shoot these!)
- **Colored capsules**: Other players
  - Nametags above their heads
  - Health bars (green/yellow/red)
  - See them move in real-time

### Multiplayer Events
- Other players appear when they join
- See their movements & shooting
- Get +500 points for eliminating players (when PvP is added)

---

## 🔧 Troubleshooting

### "Cannot connect to server"
- Make sure `start-server.bat` is running
- Check the URL is correct
- Try refreshing the page

### "Other players can't connect"
- Run `show-ip.bat` to get the correct URL
- Make sure Windows Firewall allows Node.js
- Both computers must be on the same WiFi

### "I don't see other players"
- Check browser console (F12) for errors
- Make sure you're connecting to the same server
- Check HUD shows "ONLINE (X)" not "OFFLINE"

### "Game is laggy"
- Too many players on slow WiFi
- Close other tabs/programs
- Check network connection

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `start-server.bat` | Start the multiplayer server |
| `show-ip.bat` | Find your connection URL |
| `index.html` | Open this in browser (when server running) |
| `server.js` | Backend server code |
| `script.js` | Main game code |

---

## 🎯 Next Features Coming

- 🎤 Voice chat (proximity-based)
- 🎯 Player vs Player combat
- 🗺️ Multiple maps
- 🏆 Leaderboards
- 🎨 Better player models

---

## 💡 Tips

1. **DualSense Gyro**: Press "Connect DualSense" in settings, then "Calibrate"
2. **Sensitivity**: Adjust in settings (separate H/V sensitivity)
3. **Multiple Rooms**: Edit `roomId` in network-manager.js to create private matches
4. **LAN Party**: Use `show-ip.bat` to get your URL, share with friends on same WiFi

---

**Need Help?** Check the full docs:
- `INTEGRATION-COMPLETE.md` - Full feature list
- `README-MULTIPLAYER.md` - Technical details
- `ARCHITECTURE.txt` - How it all works

---

**Have fun! 🎮🎯**
