/**
 * Network Manager - Client-side multiplayer handler
 * Manages connection to server and synchronizes player state
 */

import { VoiceChat } from './voice-chat.js';

export class NetworkManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.voiceChat = new VoiceChat(this); // Initialize VoiceChat
        this.playerId = null;
        this.remotePlayers = new Map();
        this.initialPosition = { x: 0, y: 1.6, z: 0 };
        // Use current origin in production; fallback to localhost for local dev
        const host = window.location.hostname;
        const isLocalhost = ['localhost', '127.0.0.1'].includes(host);
        const params = new URLSearchParams(window.location.search);

        // Override sources: query (?mpServer=...), then global (for manual dev/testing)
        const override = params.get('mpServer') || window.MULTIPLAYER_SERVER;

        const prodUrl = 'https://fps.ditchworld.com';
        const devUrl = 'http://localhost:3000';

        // If we’re on the public domain, always use the public server.
        // If we’re served from a file/other host, prefer the public server unless explicitly overridden.
        // Only use localhost when explicitly requested or when running on localhost.
        this.serverUrl = override
            ? override
            : host.endsWith('ditchworld.com')
                ? prodUrl
                : isLocalhost
                    ? devUrl
                    : prodUrl;
        console.log('🌐 Multiplayer server URL:', this.serverUrl);
        this.roomId = 'default';
        this.playerName = 'Player' + Math.floor(Math.random() * 1000);

        // Update rate (20 updates per second)
        this.updateInterval = 50; // ms
        this.lastUpdate = 0;

        // Event handlers
        this.eventHandlers = {
            'connected': [],
            'disconnected': [],
            'player-joined': [],
            'player-left': [],
            'player-moved': [],
            'player-fired': [],
            'player-damaged': [],
            'player-killed': [],
            'player-respawned': [],
            'chat-message': [],
            'voice-connected': [],
            'cinema-url': []
        };
    }

    /**
     * Connect to the multiplayer server
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Load Socket.io client library
                const script = document.createElement('script');
                script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
                script.onload = () => {
                    this.initializeSocket();
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Initialize Voice Chat
     */
    async initVoiceChat() {
        const success = await this.voiceChat.init();
        if (success) {
            console.log('🎙️ Voice chat initialized');
            this.trigger('voice-connected', true);

            // Now connect to any pending peers that were waiting for voice to initialize
            if (this.pendingVoicePeers && this.pendingVoicePeers.length > 0) {
                console.log(`📞 Connecting voice to ${this.pendingVoicePeers.length} pending peers...`);
                for (const peerId of this.pendingVoicePeers) {
                    this.voiceChat.connectToPeer(peerId);
                }
                this.pendingVoicePeers = [];
            }

            // Process any pending signaling messages (offers, answers, ICE candidates)
            if (this.pendingSignals && this.pendingSignals.length > 0) {
                console.log(`📞 Processing ${this.pendingSignals.length} pending voice signals...`);
                for (const signal of this.pendingSignals) {
                    if (signal.type === 'offer') {
                        await this.voiceChat.handleOffer(signal.senderId, signal.offer);
                    } else if (signal.type === 'answer') {
                        await this.voiceChat.handleAnswer(signal.senderId, signal.answer);
                    } else if (signal.type === 'ice') {
                        await this.voiceChat.handleCandidate(signal.senderId, signal.candidate);
                    }
                }
                this.pendingSignals = [];
            }
        } else {
            console.warn('⚠️ Voice chat initialization failed');
            this.trigger('voice-connected', false);
        }
        return success;
    }

    /**
     * Initialize Socket.io connection
     */
    initializeSocket() {
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling']
        });

        // Connection established
        this.socket.on('connect', () => {
            console.log('🌐 Connected to server');
            this.connected = true;

            // Join game
            this.socket.emit('player-join', {
                name: this.playerName,
                roomId: this.roomId,
                position: this.initialPosition
            });
        });

        // Player assigned (receive your ID and existing players)
        this.socket.on('player-assigned', (data) => {
            this.playerId = data.id;
            console.log(`✅ Assigned player ID: ${this.playerId}`);
            console.log(`📋 Existing players:`, data.players.length);

            // Add existing players
            data.players.forEach(player => {
                this.remotePlayers.set(player.id, player);
            });

            this.trigger('connected', {
                playerId: this.playerId,
                players: data.players
            });

            // Connect voice to existing players
            // If voice is already ready, connect immediately; otherwise queue for later
            if (this.voiceChat && this.voiceChat.localStream) {
                console.log(`📞 Voice ready - connecting to ${data.players.length} existing peers immediately`);
                data.players.forEach(player => {
                    this.voiceChat.connectToPeer(player.id);
                });
            } else {
                // Queue for when voice is initialized
                this.pendingVoicePeers = data.players.map(p => p.id);
                console.log(`📋 ${this.pendingVoicePeers.length} peers pending voice connection`);
            }
        });

        // New player joined
        this.socket.on('player-joined', (player) => {
            console.log(`👋 Player joined: ${player.name}`);
            this.remotePlayers.set(player.id, player);
            this.trigger('player-joined', player);

            // Only connect voice if voice chat is initialized
            if (this.voiceChat && this.voiceChat.localStream) {
                this.voiceChat.connectToPeer(player.id);
            } else {
                // Add to pending if voice not ready yet
                if (!this.pendingVoicePeers) this.pendingVoicePeers = [];
                this.pendingVoicePeers.push(player.id);
                console.log(`📋 Added ${player.name} to pending voice peers`);
            }
        });

        // Player left
        this.socket.on('player-left', (data) => {
            console.log(`👋 Player left: ${data.name}`);
            this.remotePlayers.delete(data.id);
            this.trigger('player-left', data);

            // Cleanup voice connection
            this.voiceChat.removePeer(data.id);
        });

        // Player moved
        this.socket.on('player-moved', (data) => {
            const player = this.remotePlayers.get(data.id);
            if (player) {
                player.position = data.position;
                player.rotation = data.rotation;
                player.weapon = data.weapon;
                player.health = data.health;
            }
            this.trigger('player-moved', data);
        });

        // Player fired weapon
        this.socket.on('player-fired', (data) => {
            this.trigger('player-fired', data);
        });

        // Player took damage
        this.socket.on('player-damaged', (data) => {
            const player = this.remotePlayers.get(data.targetId);
            if (player) {
                player.health = data.health;
            }
            this.trigger('player-damaged', data);
        });

        // Player killed
        this.socket.on('player-killed', (data) => {
            this.trigger('player-killed', data);
        });

        // Player respawned
        this.socket.on('player-respawned', (data) => {
            const player = this.remotePlayers.get(data.id);
            if (player) {
                player.health = 100;
                player.isAlive = true;
            }
            this.trigger('player-respawned', data);
        });

        // Chat message
        this.socket.on('chat-message', (data) => {
            this.trigger('chat-message', data);
        });

        // Disconnected
        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnected from server');
            this.connected = false;
            this.remotePlayers.clear();
            this.trigger('disconnected');
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
        });

        // --- Voice Chat Signaling ---

        // Queue for signaling messages received before voice is ready
        this.pendingSignals = [];

        this.socket.on('voice-offer', (data) => {
            if (this.voiceChat && this.voiceChat.localStream) {
                this.voiceChat.handleOffer(data.senderId, data.offer);
            } else {
                console.log(`📋 Queuing voice offer from ${data.senderId} (voice not ready)`);
                this.pendingSignals.push({ type: 'offer', ...data });
            }
        });

        this.socket.on('voice-answer', (data) => {
            if (this.voiceChat && this.voiceChat.localStream) {
                this.voiceChat.handleAnswer(data.senderId, data.answer);
            } else {
                console.log(`📋 Queuing voice answer from ${data.senderId} (voice not ready)`);
                this.pendingSignals.push({ type: 'answer', ...data });
            }
        });

        this.socket.on('ice-candidate', (data) => {
            if (this.voiceChat) {
                this.voiceChat.handleCandidate(data.senderId, data.candidate);
            } else {
                this.pendingSignals.push({ type: 'ice', ...data });
            }
        });

        // --- Cinema URL Sync ---
        this.socket.on('cinema-url', (data) => {
            console.log(`🎬 Received cinema URL from ${data.playerName}: ${data.url}`);
            this.trigger('cinema-url', data);
            // Call the cinema handler if set
            if (this.onCinemaUrl) {
                this.onCinemaUrl(data.url);
            }
        });
    }

    /**
     * Send player position update to server
     */
    sendPlayerUpdate(position, rotation, weapon, health) {
        if (!this.connected || !this.socket) return;

        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) return;

        this.socket.emit('player-update', {
            position: position,
            rotation: rotation,
            weapon: weapon,
            health: health
        });

        this.lastUpdate = now;
    }

    /**
     * Notify server that player fired weapon
     */
    sendPlayerFired(position, direction) {
        if (!this.connected || !this.socket) return;

        this.socket.emit('player-fired', {
            position: position,
            direction: direction
        });
    }

    /**
     * Notify server that player hit another player
     */
    sendPlayerHit(targetId, damage) {
        if (!this.connected || !this.socket) return;

        this.socket.emit('player-hit', {
            targetId: targetId,
            damage: damage
        });
    }

    /**
     * Notify server that player respawned
     */
    sendPlayerRespawn() {
        if (!this.connected || !this.socket) return;

        this.socket.emit('player-respawn');
    }

    /**
     * Send chat message
     */
    sendChatMessage(message) {
        if (!this.connected || !this.socket) return;

        this.socket.emit('chat-message', {
            message: message
        });
    }

    /**
     * Send voice signaling message
     */
    sendVoiceSignal(type, data) {
        if (!this.connected || !this.socket) return;
        this.socket.emit(type, data);
    }

    /**
     * Send cinema URL to all players
     */
    sendCinemaUrl(url) {
        if (!this.connected || !this.socket) return;
        console.log('🎬 Broadcasting cinema URL:', url);
        this.socket.emit('cinema-url', {
            url: url,
            playerName: this.playerName
        });
    }

    /**
     * Register event handler
     */
    on(event, callback) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(callback);
        }
    }

    /**
     * Trigger event handlers
     */
    trigger(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(callback => callback(data));
        }
    }

    /**
     * Get all remote players
     */
    getRemotePlayers() {
        return Array.from(this.remotePlayers.values());
    }

    /**
     * Get specific remote player
     */
    getRemotePlayer(id) {
        return this.remotePlayers.get(id);
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
            this.remotePlayers.clear();
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Get player ID
     */
    getPlayerId() {
        return this.playerId;
    }

    /**
     * Set initial spawn position to send on join
     */
    setInitialPosition(pos) {
        if (!pos) return;
        this.initialPosition = {
            x: pos.x ?? this.initialPosition.x,
            y: pos.y ?? this.initialPosition.y,
            z: pos.z ?? this.initialPosition.z
        };
    }

    /**
     * Set player name
     */
    setPlayerName(name) {
        this.playerName = name;
    }

    /**
     * Set room ID
     */
    setRoomId(roomId) {
        this.roomId = roomId;
    }
}
