import * as THREE from 'three';

export class DamageSystem {
    constructor(scene, camera, playerManager, networkManager, uiElements) {
        this.scene = scene;
        this.camera = camera;
        this.playerManager = playerManager;
        this.networkManager = networkManager;

        // UI Elements
        this.deathScreen = document.getElementById('death-screen');
        this.killerNameEl = document.getElementById('killer-name');

        // State
        this.isDead = false;

        this.setupNetworkListeners();
        this.setupUIListeners();
    }

    setupUIListeners() {
        const respawnBtn = document.getElementById('respawn-btn');
        if (respawnBtn) {
            respawnBtn.addEventListener('click', () => {
                if (this.isDead) this.respawn();
            });
        }

        // MnK Respawn support (Space or Enter)
        document.addEventListener('keydown', (e) => {
            if (this.isDead && (e.code === 'Space' || e.code === 'Enter')) {
                this.respawn();
            }
        });
    }

    setupNetworkListeners() {
        if (!this.networkManager) {
            console.error("❌ DamageSystem: networkManager is MISSING!");
            return;
        }
        console.log("✅ DamageSystem: Network Listeners Setup");

        // Handle incoming damage
        this.networkManager.on('player-damaged', (data) => {
            const myId = this.networkManager.getPlayerId();
            console.log(`📩 Client Received 'player-damaged': Target=${data.targetId} Shooter=${data.shooterId} Dmg=${data.damage} MyId=${myId}`);

            if (data.targetId === myId) {
                console.log("➡️ IS LOCAL PLAYER! Processing damage...");
                this.handleLocalPlayerDamaged(data.damage, data.shooterId, data.health, data.armor);
            } else {
                // Update other player's health bar
                console.log("➡️ IS REMOTE PLAYER. Updating name/health tag...");
                this.playerManager.updatePlayerHealth(data.targetId, data.health);
            }
        });

        // Handle kill events
        this.networkManager.on('player-killed', (data) => {
            const myId = this.networkManager.getPlayerId();

            // Show Kill Feed for EVERYONE
            // If server sends names (which we added), use them. Fallback to lookup.
            let vName = data.victimName;
            let kName = data.killerName;

            if (!vName) {
                const v = this.networkManager.getRemotePlayer(data.victimId);
                vName = v ? v.name : (data.victimId === myId ? "You" : "Unknown");
            }
            if (!kName) {
                const k = this.networkManager.getRemotePlayer(data.killerId);
                kName = k ? k.name : (data.killerId === myId ? "You" : "Unknown");
            }

            this.addKillFeedMessage(kName, vName);

            if (data.victimId === myId) {
                this.handleLocalPlayerKilled(data.killerId, kName);
            } else {
                console.log(`💀 Player ${data.victimId} killed by ${data.killerId}`);
                // Hide remote player
                this.playerManager.setPlayerDead(data.victimId, true);
            }
        });

        // Handle respawns
        this.networkManager.on('player-respawned', (data) => {
            if (data.id !== this.networkManager.getPlayerId()) {
                this.playerManager.setPlayerDead(data.id, false); // Show player
                this.playerManager.updatePlayerHealth(data.id, 100);
            }
        });
    }

    addKillFeedMessage(killer, victim) {
        const feed = document.getElementById('kill-feed');
        if (!feed) return;

        const msg = document.createElement('div');
        msg.className = 'kill-msg';
        msg.innerHTML = `<strong>${killer}</strong> <span style="color:#ccc; font-size: 0.8em">🔫</span> ${victim}`;

        // Add to top (flex-direction is column-reverse so prepending adds to "bottom" visual if aligned right? 
        // actually standard flex column puts first item at top.
        // We want new items to appear at the bottom or top? 
        // Standard FPS is top-right, flowing down. Newest at bottom.

        feed.appendChild(msg);

        // Remove after 5 seconds (matched with CSS animation)
        setTimeout(() => {
            if (msg.parentElement) msg.remove();
        }, 5000);
    }

    /**
     * Check if a shot hit any remote players
     * @param {THREE.Raycaster} raycaster 
     * @param {number} damage 
     * @returns {boolean} True if a player was hit
     */
    checkShooting(raycaster, damage) {
        if (!this.playerManager || !this.networkManager) return false;

        const remotePlayers = this.playerManager.getPlayers();
        // Intersect recursive to hit body parts
        const intersects = raycaster.intersectObjects(remotePlayers, true);

        // Find the first valid player hit
        const hit = intersects.find(intersect => {
            return this.findPlayerRoot(intersect.object) !== null;
        });

        if (hit) {
            const playerGroup = this.findPlayerRoot(hit.object);
            if (playerGroup && playerGroup.userData.id) {

                // Headshot check
                let finalDamage = damage;
                let isHeadshot = false;

                // Check if the hit object matches the head mesh stored in userData
                if (playerGroup.userData.head === hit.object) {
                    finalDamage *= 2.0;
                    isHeadshot = true;
                    console.log("HEADSHOT!");
                }

                // Send hit event
                this.networkManager.sendPlayerHit(playerGroup.userData.id, finalDamage);

                // Visual feedback
                this.playerManager.setPartDamaged(hit.object);

                // Return hit info for crosshair feedback
                return {
                    hit: true,
                    isHeadshot: isHeadshot,
                    point: hit.point,
                    object: hit.object
                };
            }
        }
        return null;
    }

    findPlayerRoot(obj) {
        while (obj) {
            if (obj.userData && obj.userData.id) return obj;
            obj = obj.parent;
        }
        return null;
    }



    handleLocalPlayerDamaged(damage, shooterId, serverHealth = null, serverArmor = null) {
        // Dispatch event for script.js to handle state update
        const event = new CustomEvent('local-player-damaged', {
            detail: {
                damage: damage,
                shooterId: shooterId,
                serverHealth: serverHealth,
                serverArmor: serverArmor
            }
        });
        document.dispatchEvent(event);

        // Visual flash (Blood effect)
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.background = 'radial-gradient(circle, transparent 50%, rgba(200, 0, 0, 0.4) 90%)'; // More of a vignette
        flash.style.opacity = '0.8';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '99';
        document.body.appendChild(flash);

        let op = 0.8;
        const timer = setInterval(() => {
            op -= 0.05;
            flash.style.opacity = op;
            if (op <= 0) {
                clearInterval(timer);
                flash.remove();
            }
        }, 50);
    }

    handleLocalPlayerKilled(killerId, killerName) {
        this.isDead = true;
        const event = new CustomEvent('local-player-killed', {
            detail: { killerId: killerId }
        });
        document.dispatchEvent(event);

        if (this.deathScreen) {
            this.deathScreen.style.display = 'flex';
            document.exitPointerLock();
        }

        // Get killer name
        // prefer passed name, otherwise lookup
        if (this.killerNameEl) {
            let name = killerName;
            if (!name) {
                const killerData = this.networkManager.getRemotePlayer(killerId);
                name = killerData ? killerData.name : 'Unknown';
            }
            this.killerNameEl.innerText = name;
        }
    }

    respawn() {
        this.isDead = false;

        // Force hide death screen
        if (this.deathScreen) {
            this.deathScreen.style.display = 'none';
        }
        document.getElementById('death-screen').style.display = 'none'; // Double tap

        console.log("🔄 Triggering Local Respawn...");

        // Dispatch local event for script.js to reset variables
        document.dispatchEvent(new CustomEvent('local-player-respawn'));

        // Notify server
        if (this.networkManager) {
            this.networkManager.sendPlayerRespawn();
        }
    }
}
