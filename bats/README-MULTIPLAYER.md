# 🎮 PS5 FPS Range - Multiplayer Setup

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 3. Play the Game
Open your browser and navigate to:
```
http://localhost:3000
```

Multiple players can connect by opening multiple browser tabs or connecting from different devices on the same network.

---

## 🏗️ Architecture

### Server (`server.js`)
- **Express** - Serves static files (your game)
- **Socket.io** - Real-time WebSocket communication
- **Room System** - Players can join different rooms
- **State Management** - Tracks all player positions, health, scores

### Client Files

#### `network-manager.js`
- Handles connection to server
- Sends/receives player updates
- Event-based API for easy integration
- Automatic reconnection

#### `player-manager.js`
- Creates 3D representations of other players
- Smooth position interpolation
- Nametags and health bars
- Muzzle flash effects

---

## 🔧 Integration with Your Game

### Step 1: Import the Managers
Add to your `script.js`:

```javascript
import { NetworkManager } from './network-manager.js';
import { PlayerManager } from './player-manager.js';

// Create instances
const networkManager = new NetworkManager();
const playerManager = new PlayerManager(scene); // Pass your Three.js scene
```

### Step 2: Connect to Server
```javascript
// Connect when game starts
networkManager.connect().then(() => {
    console.log('Multiplayer enabled!');
}).catch(err => {
    console.error('Failed to connect:', err);
    // Game still works in single-player mode
});
```

### Step 3: Handle Events
```javascript
// When a new player joins
networkManager.on('player-joined', (player) => {
    playerManager.addPlayer(player);
});

// When a player leaves
networkManager.on('player-left', (data) => {
    playerManager.removePlayer(data.id);
});

// When a player moves
networkManager.on('player-moved', (data) => {
    playerManager.updatePlayerPosition(data.id, data.position, data.rotation);
});

// When a player fires
networkManager.on('player-fired', (data) => {
    playerManager.showMuzzleFlash(data.id);
    // Play shoot sound, show effects, etc.
});
```

### Step 4: Send Your Updates
In your game loop:

```javascript
function animate() {
    // Your existing game logic...
    
    // Send your position to other players
    if (networkManager.isConnected()) {
        networkManager.sendPlayerUpdate(
            { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
            currentWeapon,
            playerHealth
        );
        
        // Update remote players
        playerManager.update(camera, deltaTime);
    }
    
    requestAnimationFrame(animate);
}
```

### Step 5: Sync Weapon Fire
When player shoots:

```javascript
function shoot() {
    // Your existing shoot logic...
    
    // Notify other players
    if (networkManager.isConnected()) {
        networkManager.sendPlayerFired(
            { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            { x: direction.x, y: direction.y, z: direction.z }
        );
    }
}
```

---

## 🌐 Network Events

### Send Events
- `sendPlayerUpdate(position, rotation, weapon, health)` - Update your state
- `sendPlayerFired(position, direction)` - Fired weapon
- `sendPlayerHit(targetId, damage)` - Hit another player
- `sendPlayerRespawn()` - Respawned after death
- `sendChatMessage(message)` - Send chat message

### Receive Events
- `connected` - Successfully connected to server
- `disconnected` - Lost connection
- `player-joined` - New player joined
- `player-left` - Player disconnected
- `player-moved` - Player position updated
- `player-fired` - Player fired weapon
- `player-damaged` - Player took damage
- `player-killed` - Player was eliminated
- `player-respawned` - Player respawned
- `chat-message` - Chat message received

---

## 🎯 Features Already Implemented

✅ Real-time player synchronization  
✅ Smooth position interpolation  
✅ Room system for multiple matches  
✅ Player nametags and health bars  
✅ Weapon fire synchronization  
✅ Hit detection and damage  
✅ Kill/death tracking  
✅ Text chat system  
✅ Automatic reconnection  

---

## 🚀 Next Steps

### For You (Backend/Technical):
1. **Voice Chat** - Add WebRTC voice implementation
2. **Latency Compensation** - Client-side prediction for smoother gameplay
3. **Anti-cheat** - Server-side validation of player actions
4. **Matchmaking** - Auto-assign players to rooms based on skill

### For Your Housemate (Visuals):
1. **Better Player Models** - Replace capsules with actual character models
2. **Animation System** - Running, jumping, shooting animations
3. **Hit Effects** - Blood splatter, impact effects
4. **Kill Cam** - Replay of how you died

---

## 🔍 Testing Multiplayer

### Local Testing (Same Computer)
1. Start the server: `npm start`
2. Open multiple browser tabs: `http://localhost:3000`
3. Each tab is a separate player

### LAN Testing (Same Network)
1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Start server on your machine
3. Other players connect to: `http://YOUR_IP:3000`
4. Example: `http://192.168.1.100:3000`

### Public Testing (Internet)
1. Port forward port 3000 on your router
2. Players connect to: `http://YOUR_PUBLIC_IP:3000`
3. Find public IP: https://whatismyipaddress.com/

---

## 🛠️ Configuration

### Change Server URL
In `network-manager.js`:
```javascript
this.serverUrl = 'http://localhost:3000'; // Change this for production
```

### Change Port
In `server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change default port
```

Or set environment variable:
```bash
PORT=8080 npm start
```

### Change Room
In `network-manager.js`:
```javascript
this.roomId = 'default'; // Change room name
```

---

## 📊 Performance Tips

1. **Update Rate**: Currently 20 updates/sec (50ms). Adjust in `network-manager.js`:
   ```javascript
   this.updateInterval = 50; // Lower = more updates, higher bandwidth
   ```

2. **Interpolation**: Smooth movement at 60 FPS even with 20 updates/sec
   ```javascript
   playerMesh.position.lerp(targetPosition, 0.2); // Adjust smoothness
   ```

3. **Network Optimization**: Only send deltas (changes), not full state

---

## 🐛 Troubleshooting

### "Cannot find module 'express'"
Run: `npm install`

### "Port 3000 already in use"
Change port in server.js or kill existing process

### Players not seeing each other
- Check firewall settings
- Make sure all players connect to same server URL
- Check browser console for errors

### Laggy movement
- Reduce update interval (more bandwidth)
- Improve interpolation smoothing
- Check network latency

---

## 📝 License
MIT - Feel free to modify and use for your project!

---

**Need Help?** Check the console logs - both server and client log detailed connection info! 🎮
