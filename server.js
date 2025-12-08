/**
 * PS5 FPS Range - Multiplayer Server
 * Simple Socket.io server for real-time multiplayer
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files from the game directory
app.use(express.static(path.join(__dirname)));

// Game state
const players = new Map();
const rooms = new Map();

// Helper functions
function generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
}

function getPlayerCount() {
    return players.size;
}

function getRoomPlayers(roomId) {
    const room = rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.players.values());
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`✅ Player connected: ${socket.id}`);

    // Handle player join
    socket.on('player-join', (data) => {
        const playerId = socket.id;
        const playerData = {
            id: playerId,
            name: data.name || `Player${getPlayerCount() + 1}`,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            health: 100,

            armor: 150, // Start with full armor
            weapon: 'smg',
            isAlive: true,
            score: 0,
            roomId: data.roomId || 'default'
        };

        players.set(playerId, playerData);

        // Join room
        const roomId = playerData.roomId;
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                players: new Map()
            });
        }
        rooms.get(roomId).players.set(playerId, playerData);

        console.log(`👤 ${playerData.name} joined room: ${roomId}`);
        console.log(`📊 Total players: ${getPlayerCount()}`);

        // Send current player their ID and existing players
        socket.emit('player-assigned', {
            id: playerId,
            players: getRoomPlayers(roomId).filter(p => p.id !== playerId)
        });

        // Notify others in the room about new player
        socket.to(roomId).emit('player-joined', playerData);
    });

    // Handle player position updates
    socket.on('player-update', (data) => {
        const playerId = socket.id;
        const player = players.get(playerId);

        if (player) {
            // Update player data
            player.position = data.position;
            player.rotation = data.rotation;
            player.weapon = data.weapon;
            // player.health = data.health; // SERVER AUTHORITY: Ignore client health updates

            // Broadcast to others in the same room (but not to sender)
            socket.to(player.roomId).emit('player-moved', {
                id: playerId,
                position: data.position,
                rotation: data.rotation,
                weapon: data.weapon,
                health: data.health,
                timestamp: Date.now()
            });
        }
    });

    // Handle weapon firing
    socket.on('player-fired', (data) => {
        const playerId = socket.id;
        const player = players.get(playerId);

        if (player) {
            // Broadcast to others in the room
            socket.to(player.roomId).emit('player-fired', {
                id: playerId,
                position: data.position,
                direction: data.direction,
                weapon: player.weapon,
                timestamp: Date.now()
            });
        }
    });

    // Handle player hit
    socket.on('player-hit', (data) => {
        const targetPlayer = players.get(data.targetId);
        const shooterPlayer = players.get(socket.id);

        console.log(`🔫 Hit Event: Shooter=${socket.id} Target=${data.targetId} Dmg=${data.damage}`);

        if (targetPlayer && shooterPlayer) {
            console.log(`   Before: HP=${targetPlayer.health} Armor=${targetPlayer.armor}`);
            // Apply damage to Armor first
            let remainingDamage = data.damage;

            if (targetPlayer.armor > 0) {
                const armorAbsorb = Math.min(targetPlayer.armor, remainingDamage);
                targetPlayer.armor -= armorAbsorb;
                remainingDamage -= armorAbsorb;
            }

            if (remainingDamage > 0) {
                targetPlayer.health = Math.max(0, targetPlayer.health - remainingDamage);
            }
            console.log(`   After: HP=${targetPlayer.health} Armor=${targetPlayer.armor} RemDmg=${remainingDamage}`);

            // Notify all players about the hit
            io.to(targetPlayer.roomId).emit('player-damaged', {
                targetId: data.targetId,
                shooterId: socket.id,
                damage: data.damage,
                health: targetPlayer.health,
                armor: targetPlayer.armor, // Send armor status
                timestamp: Date.now()
            });

            // Check if player died
            if (targetPlayer.health <= 0 && targetPlayer.isAlive) {
                targetPlayer.isAlive = false;
                shooterPlayer.score += 1;

                io.to(targetPlayer.roomId).emit('player-killed', {
                    victimId: data.targetId,
                    victimName: targetPlayer.name,
                    killerId: socket.id,
                    killerName: shooterPlayer.name,
                    killerScore: shooterPlayer.score,
                    timestamp: Date.now()
                });

                console.log(`💀 ${shooterPlayer.name} eliminated ${targetPlayer.name}`);
            }
        }
    });

    // Handle player respawn
    socket.on('player-respawn', () => {
        const player = players.get(socket.id);
        if (player) {
            player.health = 100;
            player.armor = 150;
            player.isAlive = true;

            io.to(player.roomId).emit('player-respawned', {
                id: socket.id,
                timestamp: Date.now()
            });
        }
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
        const player = players.get(socket.id);
        if (player) {
            io.to(player.roomId).emit('chat-message', {
                playerId: socket.id,
                playerName: player.name,
                message: data.message,
                timestamp: Date.now()
            });
        }
    });

    // --- Voice Chat Signaling ---

    // Relay voice offer
    socket.on('voice-offer', (data) => {
        io.to(data.targetId).emit('voice-offer', {
            senderId: socket.id,
            offer: data.offer
        });
    });

    // Relay voice answer
    socket.on('voice-answer', (data) => {
        io.to(data.targetId).emit('voice-answer', {
            senderId: socket.id,
            answer: data.answer
        });
    });

    // Relay ICE candidate
    socket.on('ice-candidate', (data) => {
        io.to(data.targetId).emit('ice-candidate', {
            senderId: socket.id,
            candidate: data.candidate
        });
    });

    // --- Cinema URL Sync ---
    socket.on('cinema-url', (data) => {
        const player = players.get(socket.id);
        if (player) {
            console.log(`🎬 ${player.name} set cinema URL: ${data.url}`);
            // Broadcast to all others in the room
            socket.to(player.roomId).emit('cinema-url', {
                url: data.url,
                playerName: player.name,
                playerId: socket.id
            });
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        const player = players.get(socket.id);

        if (player) {
            console.log(`❌ ${player.name} disconnected`);

            // Remove from room
            const room = rooms.get(player.roomId);
            if (room) {
                room.players.delete(socket.id);
                if (room.players.size === 0) {
                    rooms.delete(player.roomId);
                }
            }

            // Notify others
            socket.to(player.roomId).emit('player-left', {
                id: socket.id,
                name: player.name
            });

            players.delete(socket.id);
            console.log(`📊 Remaining players: ${getPlayerCount()}`);
        }
    });
});

// Start server (listen on all interfaces for Tailscale/LAN access)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   🎮 PS5 FPS Range - Server Running   ║
╟────────────────────────────────────────╢
║   Port: ${PORT}                        ║
║   Local: http://localhost:${PORT}      ║
║   Network: http://0.0.0.0:${PORT}      ║
╚════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
