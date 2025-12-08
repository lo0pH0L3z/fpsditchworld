/**
 * Voice Chat Module
 * Handles WebRTC peer connections for real-time audio
 */

export class VoiceChat {
    constructor(networkManager) {
        this.networkManager = networkManager;
        this.localStream = null;
        this.peers = new Map(); // peerId -> RTCPeerConnection
        this.remoteAudioElements = new Map(); // peerId -> AudioElement
        this.isMuted = false;
        this.isDeafened = false;
        this.volume = 1.0;
        this.inputDeviceId = null; // Selected input device
        this.outputDeviceId = null; // Selected output device

        // Voice activity detection
        this.audioContext = null;
        this.localAnalyser = null;
        this.remoteAnalysers = new Map(); // peerId -> AnalyserNode
        this.speakingThreshold = 15; // Adjust for sensitivity
        this.speakingPlayers = new Map(); // peerId -> {name, isSpeaking, timeout}

        // ICE servers (STUN)
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // Create voice activity UI container
        this.createVoiceActivityUI();
    }

    /**
     * Create the voice activity UI container (COD-style)
     */
    createVoiceActivityUI() {
        let container = document.getElementById('voice-activity-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'voice-activity-container';
            document.body.appendChild(container);
        }
        this.voiceActivityContainer = container;
    }

    /**
     * Initialize voice chat (request mic access)
     */
    async init() {
        try {
            const audioConstraints = this.inputDeviceId
                ? { deviceId: { exact: this.inputDeviceId } }
                : true;

            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
                video: false
            });

            // Setup voice activity detection for local mic
            this.setupLocalVoiceActivityDetection();

            // Apply initial mute state
            this.setMute(this.isMuted);

            console.log('🎙️ Microphone access granted');
            return true;
        } catch (err) {
            console.error('❌ Microphone access denied:', err);
            return false;
        }
    }

    /**
     * Setup voice activity detection for local microphone
     */
    setupLocalVoiceActivityDetection() {
        if (!this.localStream) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            this.localAnalyser = this.audioContext.createAnalyser();
            this.localAnalyser.fftSize = 256;
            source.connect(this.localAnalyser);

            // Start monitoring local voice activity
            this.monitorLocalVoiceActivity();
        } catch (err) {
            console.warn('⚠️ Could not setup voice activity detection:', err);
        }
    }

    /**
     * Monitor local microphone for voice activity
     * Throttled to 100ms intervals to prevent performance issues
     */
    monitorLocalVoiceActivity() {
        if (!this.localAnalyser) return;

        // Clear any existing interval
        if (this.localVoiceMonitorInterval) {
            clearInterval(this.localVoiceMonitorInterval);
        }

        const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);
        let wasSpeak = false;

        const checkLevel = () => {
            if (!this.localAnalyser) {
                clearInterval(this.localVoiceMonitorInterval);
                return;
            }

            this.localAnalyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            const isSpeaking = average > this.speakingThreshold && !this.isMuted;

            if (isSpeaking !== wasSpeak) {
                wasSpeak = isSpeaking;
                this.updateSpeakingIndicator('local', 'YOU', isSpeaking);
            }
        };

        // Run every 100ms instead of every animation frame (60fps -> 10fps)
        this.localVoiceMonitorInterval = setInterval(checkLevel, 100);
    }

    /**
     * Connect to a new peer (initiator)
     */
    async connectToPeer(peerId) {
        if (!this.localStream) {
            console.warn('⚠️ Cannot connect to peer - no local stream');
            return;
        }
        if (this.peers.has(peerId)) {
            console.log(`⏭️ Already connected to peer ${peerId}`);
            return;
        }

        console.log(`📞 Initiating voice connection to ${peerId}`);
        const peerConnection = this.createPeerConnection(peerId);

        // Add local stream tracks
        this.localStream.getTracks().forEach(track => {
            console.log(`📤 Adding local track to peer ${peerId}:`, track.kind, track.label);
            peerConnection.addTrack(track, this.localStream);
        });

        // Create offer
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log(`📨 Sending voice offer to ${peerId}`);

            this.networkManager.sendVoiceSignal('voice-offer', {
                targetId: peerId,
                offer: offer
            });
        } catch (err) {
            console.error('❌ Error creating offer:', err);
        }
    }

    /**
     * Handle incoming offer (responder)
     */
    async handleOffer(peerId, offer) {
        if (!this.localStream) {
            console.warn('⚠️ Cannot handle offer - no local stream');
            return;
        }

        console.log(`📞 Received voice offer from ${peerId}`);

        // If we already have a connection to this peer, close it first
        if (this.peers.has(peerId)) {
            console.log(`🔄 Replacing existing peer connection for ${peerId}`);
            this.removePeer(peerId);
        }

        const peerConnection = this.createPeerConnection(peerId);

        // Add local stream tracks
        this.localStream.getTracks().forEach(track => {
            console.log(`📤 Adding local track for response to ${peerId}:`, track.kind, track.label);
            peerConnection.addTrack(track, this.localStream);
        });

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log(`📨 Sending voice answer to ${peerId}`);

            this.networkManager.sendVoiceSignal('voice-answer', {
                targetId: peerId,
                answer: answer
            });
        } catch (err) {
            console.error('❌ Error handling offer:', err);
        }
    }

    /**
     * Handle incoming answer
     */
    async handleAnswer(peerId, answer) {
        console.log(`📞 Received voice answer from ${peerId}`);
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`✅ Voice connection established with ${peerId}`);
            } catch (err) {
                console.error('❌ Error handling answer:', err);
            }
        } else {
            console.warn(`⚠️ No peer connection found for ${peerId} when handling answer`);
        }
    }

    /**
     * Handle incoming ICE candidate
     */
    async handleCandidate(peerId, candidate) {
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                // console.log(`🧊 Added ICE candidate from ${peerId}`);
            } catch (err) {
                console.error('❌ Error adding ICE candidate:', err);
            }
        } else {
            // console.warn(`⚠️ No peer connection found for ${peerId} when adding ICE candidate`);
        }
    }

    /**
     * Create and configure RTCPeerConnection
     */
    createPeerConnection(peerId) {
        console.log(`🔧 Creating RTCPeerConnection for ${peerId}`);
        const peerConnection = new RTCPeerConnection(this.iceServers);
        this.peers.set(peerId, peerConnection);

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // console.log(`🧊 Sending ICE candidate to ${peerId}`);
                this.networkManager.sendVoiceSignal('ice-candidate', {
                    targetId: peerId,
                    candidate: event.candidate
                });
            }
        };

        // Handle ICE gathering state
        peerConnection.onicegatheringstatechange = () => {
            // console.log(`🧊 ICE gathering state with ${peerId}: ${peerConnection.iceGatheringState}`);
        };

        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            // console.log(`🧊 ICE connection state with ${peerId}: ${peerConnection.iceConnectionState}`);
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log(`🔊 Received remote audio track from ${peerId}:`, event.track.kind, event.track.label);
            console.log(`🔊 Stream has ${event.streams[0]?.getTracks().length || 0} tracks`);
            this.createAudioElement(peerId, event.streams[0]);
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`🔄 Connection state with ${peerId}: ${peerConnection.connectionState}`);
            if (peerConnection.connectionState === 'connected') {
                console.log(`✅ VOICE CONNECTED with ${peerId}!`);
            } else if (peerConnection.connectionState === 'disconnected' ||
                peerConnection.connectionState === 'failed' ||
                peerConnection.connectionState === 'closed') {
                this.removePeer(peerId);
            }
        };

        return peerConnection;
    }

    /**
     * Create audio element for remote stream
     */
    createAudioElement(peerId, stream) {
        if (this.remoteAudioElements.has(peerId)) return;

        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = this.isDeafened ? 0 : this.volume;

        // Apply selected output device if set
        if (this.outputDeviceId && typeof audio.setSinkId === 'function') {
            audio.setSinkId(this.outputDeviceId).catch(err => {
                console.warn('⚠️ Could not set output device:', err);
            });
        }

        // Append to body (hidden) to ensure playback
        audio.style.display = 'none';
        document.body.appendChild(audio);

        this.remoteAudioElements.set(peerId, audio);

        // Setup voice activity detection for this remote stream
        this.setupRemoteVoiceActivityDetection(peerId, stream);
    }

    /**
     * Setup voice activity detection for a remote stream
     */
    setupRemoteVoiceActivityDetection(peerId, stream) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            const source = this.audioContext.createMediaStreamSource(stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            this.remoteAnalysers.set(peerId, analyser);

            // Get player name from network manager
            const playerName = this.getPlayerName(peerId);

            // Start monitoring
            this.monitorRemoteVoiceActivity(peerId, analyser, playerName);
        } catch (err) {
            console.warn('⚠️ Could not setup remote voice activity detection:', err);
        }
    }

    /**
     * Get player name from network manager
     */
    getPlayerName(peerId) {
        if (this.networkManager && this.networkManager.remotePlayers) {
            const player = this.networkManager.remotePlayers.get(peerId);
            return player ? player.name : `Player ${peerId.slice(0, 6)}`;
        }
        return `Player ${peerId.slice(0, 6)}`;
    }

    /**
     * Monitor remote stream for voice activity
     * Throttled to 100ms intervals to prevent performance issues
     */
    monitorRemoteVoiceActivity(peerId, analyser, playerName) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let wasSpeak = false;

        // Initialize interval storage if needed
        if (!this.remoteVoiceMonitorIntervals) {
            this.remoteVoiceMonitorIntervals = new Map();
        }

        // Clear any existing interval for this peer
        if (this.remoteVoiceMonitorIntervals.has(peerId)) {
            clearInterval(this.remoteVoiceMonitorIntervals.get(peerId));
        }

        const checkLevel = () => {
            // Stop if peer was removed
            if (!this.remoteAnalysers.has(peerId)) {
                const intervalId = this.remoteVoiceMonitorIntervals.get(peerId);
                if (intervalId) {
                    clearInterval(intervalId);
                    this.remoteVoiceMonitorIntervals.delete(peerId);
                }
                return;
            }

            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            const isSpeaking = average > this.speakingThreshold && !this.isDeafened;

            if (isSpeaking !== wasSpeak) {
                wasSpeak = isSpeaking;
                this.updateSpeakingIndicator(peerId, playerName, isSpeaking);
            }
        };

        // Run every 100ms instead of every animation frame (60fps -> 10fps)
        const intervalId = setInterval(checkLevel, 100);
        this.remoteVoiceMonitorIntervals.set(peerId, intervalId);
    }

    /**
     * Update the speaking indicator UI (COD-style)
     */
    updateSpeakingIndicator(id, name, isSpeaking) {
        if (!this.voiceActivityContainer) return;

        let indicator = document.getElementById(`voice-indicator-${id}`);

        if (isSpeaking) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = `voice-indicator-${id}`;
                indicator.className = 'voice-indicator';
                indicator.innerHTML = `
                    
                    <span class="voice-name">${name}</span>
                `;
                this.voiceActivityContainer.appendChild(indicator);
                // Trigger animation
                requestAnimationFrame(() => indicator.classList.add('active'));
            }
        } else {
            if (indicator) {
                indicator.classList.remove('active');
                // Remove after fade out
                setTimeout(() => {
                    if (indicator && indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }
        }
    }

    /**
     * Remove peer connection and cleanup
     */
    removePeer(peerId) {
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peers.delete(peerId);
        }

        const audio = this.remoteAudioElements.get(peerId);
        if (audio) {
            audio.srcObject = null;
            audio.remove();
            this.remoteAudioElements.delete(peerId);
        }

        // Clean up voice activity monitoring interval
        if (this.remoteVoiceMonitorIntervals && this.remoteVoiceMonitorIntervals.has(peerId)) {
            clearInterval(this.remoteVoiceMonitorIntervals.get(peerId));
            this.remoteVoiceMonitorIntervals.delete(peerId);
        }

        // Clean up analyser
        if (this.remoteAnalysers) {
            this.remoteAnalysers.delete(peerId);
        }
    }

    /**
     * Mute/Unmute local microphone
     */
    setMute(muted) {
        this.isMuted = muted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
    }

    /**
     * Deafen/Undeafen (mute all remote audio)
     */
    setDeafen(deafened) {
        this.isDeafened = deafened;
        this.remoteAudioElements.forEach(audio => {
            audio.volume = deafened ? 0 : this.volume;
        });
    }

    /**
     * Set output volume
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (!this.isDeafened) {
            this.remoteAudioElements.forEach(audio => {
                audio.volume = this.volume;
            });
        }
    }

    /**
     * Get available audio output devices
     */
    async getAudioOutputDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audiooutput');
        } catch (err) {
            console.error('❌ Error enumerating devices:', err);
            return [];
        }
    }

    /**
     * Get available audio input devices (microphones)
     */
    async getAudioInputDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (err) {
            console.error('❌ Error enumerating input devices:', err);
            return [];
        }
    }

    /**
     * Set audio input device (microphone)
     */
    async setAudioInputDevice(deviceId) {
        this.inputDeviceId = deviceId;

        // Need to reinitialize the stream with new device
        if (this.localStream) {
            // Stop current tracks
            this.localStream.getTracks().forEach(track => track.stop());

            try {
                const audioConstraints = deviceId
                    ? { deviceId: { exact: deviceId } }
                    : true;

                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: audioConstraints,
                    video: false
                });

                // Re-setup voice activity detection
                this.setupLocalVoiceActivityDetection();

                // Apply mute state
                this.setMute(this.isMuted);

                // Update all peer connections with new stream
                for (const [peerId, peerConnection] of this.peers) {
                    const senders = peerConnection.getSenders();
                    const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                    if (audioSender) {
                        const newTrack = this.localStream.getAudioTracks()[0];
                        await audioSender.replaceTrack(newTrack);
                    }
                }

                console.log(`🎙️ Audio input device changed to: ${deviceId}`);
            } catch (err) {
                console.error('❌ Error changing audio input device:', err);
            }
        }
    }

    /**
     * Set audio output device for all remote audio elements
     */
    async setAudioOutputDevice(deviceId) {
        this.outputDeviceId = deviceId;

        for (const audio of this.remoteAudioElements.values()) {
            try {
                if (typeof audio.setSinkId === 'function') {
                    await audio.setSinkId(deviceId);
                    console.log(`🔊 Audio output set to device: ${deviceId}`);
                } else {
                    console.warn('⚠️ setSinkId not supported in this browser');
                }
            } catch (err) {
                console.error('❌ Error setting audio output device:', err);
            }
        }
    }
}
