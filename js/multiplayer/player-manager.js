/**
 * Player Manager - Handles remote player visualization
 * Creates and updates 3D representations of other players
 */

import * as THREE from 'three';

export class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.players = new Map();
        this.nameTagDistance = 50; // Distance at which nametags are visible
    }

    /**
     * Create a simple player mesh (can be replaced with more detailed model later)
     */
    createPlayerMesh(playerData) {
        const group = new THREE.Group();

        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.25, 4, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.getPlayerColor(playerData.id),
            roughness: 0.7,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, -0.5, 0);
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            roughness: 0.8,
            metalness: 0.2
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 0, 0);
        head.castShadow = true;
        group.add(head);

        // LeftArm
        const leftarmGeometry = new THREE.CapsuleGeometry(0.15, 0.7, 4, 16);
        const leftarmMaterial = new THREE.MeshStandardMaterial({
            color: this.getPlayerColor(playerData.id),
            roughness: 0.7,
            metalness: 0.3
        });
        const leftarm = new THREE.Mesh(leftarmGeometry, leftarmMaterial);
        leftarm.position.set(0.4, -0.8, 0);
        leftarm.rotation.z = 0.16;
        leftarm.castShadow = true;
        group.add(leftarm);

        // RightArm
        const rightarmGeometry = new THREE.CapsuleGeometry(0.15, 0.7, 4, 16);
        const rightarmMaterial = new THREE.MeshStandardMaterial({
            color: this.getPlayerColor(playerData.id),
            roughness: 0.7,
            metalness: 0.3
        });
        const rightarm = new THREE.Mesh(rightarmGeometry, rightarmMaterial);
        rightarm.position.set(-0.4, -0.8, 0);
        rightarm.rotation.z = -0.16;
        rightarm.castShadow = true;
        group.add(rightarm);

        // LeftLeg Pivot (for animation)
        const leftLegPivot = new THREE.Group();
        leftLegPivot.position.set(0.25, -0.55, 0); // Hip position
        group.add(leftLegPivot);

        const leftlegGeometry = new THREE.CapsuleGeometry(0.18, 0.9, 4, 16);
        const leftlegMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.7,
            metalness: 0.3
        });
        const leftleg = new THREE.Mesh(leftlegGeometry, leftlegMaterial);
        leftleg.position.set(0, -0.45, 0); // Offset: center is 0.45 down from hip
        leftleg.castShadow = true;
        leftLegPivot.add(leftleg);

        // RightLeg Pivot (for animation)
        const rightLegPivot = new THREE.Group();
        rightLegPivot.position.set(-0.25, -0.55, 0); // Hip position
        group.add(rightLegPivot);

        const rightlegGeometry = new THREE.CapsuleGeometry(0.18, 0.9, 4, 16);
        const rightlegMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.7,
            metalness: 0.3
        });
        const rightleg = new THREE.Mesh(rightlegGeometry, rightlegMaterial);
        rightleg.position.set(0, -0.45, 0); // Offset: center is 0.45 down from hip
        rightleg.castShadow = true;
        rightLegPivot.add(rightleg);

        // Simple weapon indicator (box)
        const weaponGeometry = new THREE.BoxGeometry(0.2, 0.2, 1);
        const weaponMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.5,
            metalness: 0.8
        });
        const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
        // Position relative to "RightArm" (which is at -0.4, 1.0)
        // Arms are rotated, so hand is lower.
        // Let's place it roughly where the hand would be.
        weapon.position.set(-0.5, 1.0, -0.5);
        weapon.rotation.y = -Math.PI / 4;
        weapon.castShadow = true;
        group.add(weapon);

        // Nametag (sprite with text)
        const nameTag = this.createNameTag(playerData.name);
        nameTag.position.y = 1.5;
        group.add(nameTag);

        // Health bar
        const healthBar = this.createHealthBar();
        healthBar.position.y = 1.0;
        group.add(healthBar);

        // Store references
        group.userData = {
            id: playerData.id,
            body: body,
            head: head,
            weapon: weapon,
            leftLegPivot: leftLegPivot,
            rightLegPivot: rightLegPivot,
            nameTag: nameTag,
            healthBar: healthBar,
            targetPosition: new THREE.Vector3(),
            targetRotation: new THREE.Euler(),
            velocity: new THREE.Vector3(),
            walkTimer: 0,
            lastPosition: new THREE.Vector3(),
            isMoving: false
        };

        return group;
    }

    /**
     * Create a nametag sprite
     */
    createNameTag(name) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        // Draw background
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw text
        context.font = 'Bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 0.5, 1);

        return sprite;
    }

    /**
     * Create a health bar
     */
    createHealthBar() {
        const group = new THREE.Group();

        // Background
        const bgGeometry = new THREE.PlaneGeometry(1, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const bg = new THREE.Mesh(bgGeometry, bgMaterial);
        group.add(bg);

        // Health bar (green)
        const healthGeometry = new THREE.PlaneGeometry(1, 0.1);
        const healthMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const health = new THREE.Mesh(healthGeometry, healthMaterial);
        health.position.z = 0.01;
        group.add(health);

        group.userData = { healthBar: health };

        return group;
    }

    /**
     * Generate a unique color for each player based on their ID
     */
    getPlayerColor(playerId) {
        const hash = playerId.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);

        const hue = Math.abs(hash) % 360;
        return new THREE.Color().setHSL(hue / 360, 0.7, 0.5);
    }

    /**
     * Add a new player to the scene
     */
    addPlayer(playerData) {
        if (this.players.has(playerData.id)) {
            console.warn(`Player ${playerData.id} already exists`);
            return;
        }

        const playerMesh = this.createPlayerMesh(playerData);

        // Set initial position
        if (playerData.position) {
            playerMesh.position.set(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
            if (playerMesh.userData.lastPosition) {
                playerMesh.userData.lastPosition.copy(playerMesh.position);
            }
        }

        // Set initial rotation
        if (playerData.rotation) {
            playerMesh.rotation.set(
                playerData.rotation.x,
                playerData.rotation.y,
                playerData.rotation.z
            );
        }

        this.scene.add(playerMesh);
        this.players.set(playerData.id, playerMesh);

        console.log(`✅ Added player to scene: ${playerData.name} (${playerData.id})`);
    }

    /**
     * Remove a player from the scene
     */
    removePlayer(playerId) {
        const playerMesh = this.players.get(playerId);
        if (playerMesh) {
            this.scene.remove(playerMesh);
            this.players.delete(playerId);
            console.log(`🗑️ Removed player from scene: ${playerId}`);
        }
    }

    /**
     * Update player position with interpolation
     */
    updatePlayerPosition(playerId, position, rotation) {
        const playerMesh = this.players.get(playerId);
        if (!playerMesh) return;

        // Store target position and rotation
        playerMesh.userData.targetPosition.set(position.x, position.y, position.z);
        playerMesh.userData.targetRotation.set(rotation.x, rotation.y, rotation.z);
    }

    /**
     * Update player health bar
     */
    updatePlayerHealth(playerId, health) {
        const playerMesh = this.players.get(playerId);
        if (!playerMesh) return;

        // Reset damage visuals if fully healed
        if (health >= 100) {
            this.resetDamageVisuals(playerMesh);
        } else {
            // Fade damage intensity based on health (Low health = Bright Red)
            const damageIntensity = Math.max(0, (100 - health) / 100); // 0 to 1
            playerMesh.traverse((child) => {
                if (child.userData.isDamaged && child.material && child.material.emissive) {
                    child.material.emissiveIntensity = damageIntensity;
                }
            });
        }

        const healthBar = playerMesh.userData.healthBar;
        if (healthBar && healthBar.userData.healthBar) {
            const healthPercent = Math.max(0, Math.min(1, health / 100));
            healthBar.userData.healthBar.scale.x = healthPercent;
            healthBar.userData.healthBar.position.x = -(1 - healthPercent) / 2;

            // Change color based on health
            if (healthPercent > 0.6) {
                healthBar.userData.healthBar.material.color.set(0x00ff00); // Green
            } else if (healthPercent > 0.3) {
                healthBar.userData.healthBar.material.color.set(0xffff00); // Yellow
            } else {
                healthBar.userData.healthBar.material.color.set(0xff0000); // Red
            }
        }
    }

    /**
     * Set a specific body part to look damaged (red)
     */
    setPartDamaged(mesh) {
        if (mesh && mesh.material) {
            // Permanent red until healed
            // check if it has emissive property (Standard material does)
            if (mesh.material.emissive) {
                mesh.material.emissive.setHex(0xff0000);
            } else {
                // Fallback for basic materials?
                mesh.material.color.setHex(0xff0000);
            }

            // Mark as damaged for fading logic
            mesh.userData.isDamaged = true;
            mesh.material.emissiveIntensity = 1; // Start full bright
        }
    }

    /**
     * Reset all damage visuals for a player
     */
    resetDamageVisuals(playerMesh) {
        playerMesh.traverse((child) => {
            if (child.isMesh && child.material) {
                // Reset emissive to black
                if (child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                    child.material.emissiveIntensity = 1; // Reset default
                }
                child.userData.isDamaged = false;
            }
        });
    }

    /**
     * Update all players (call this in animation loop)
     */
    update(camera, deltaTime) {
        this.players.forEach((playerMesh, playerId) => {
            // Disable updates if dead (keep corpse still)
            if (playerMesh.userData.isDead) return;

            // Smooth interpolation to target position
            playerMesh.position.lerp(playerMesh.userData.targetPosition, 0.2);

            // Smooth rotation
            playerMesh.rotation.x += (playerMesh.userData.targetRotation.x - playerMesh.rotation.x) * 0.2;
            playerMesh.rotation.y += (playerMesh.userData.targetRotation.y - playerMesh.rotation.y) * 0.2;
            playerMesh.rotation.z += (playerMesh.userData.targetRotation.z - playerMesh.rotation.z) * 0.2;

            // Calculate movement speed for animation
            const positionDelta = playerMesh.position.distanceTo(playerMesh.userData.lastPosition || playerMesh.position);
            const speed = positionDelta / deltaTime; // Units per second approx
            playerMesh.userData.lastPosition.copy(playerMesh.position);

            const isMoving = speed > 1.0; // Threshold for movement
            const walkSpeedInfo = 10; // Animation speed multiplier

            if (isMoving) {
                playerMesh.userData.walkTimer += deltaTime * walkSpeedInfo;
                playerMesh.userData.isMoving = true;
            } else {
                // Decay timer to nearest zero crossing or just stop? 
                // Better: Lerp rotation to 0
                playerMesh.userData.isMoving = false;
            }

            // Animate Legs
            if (playerMesh.userData.leftLegPivot && playerMesh.userData.rightLegPivot) {
                let targetLegAngle = 0;

                if (playerMesh.userData.isMoving) {
                    // Sine wave for walking: Max rotation ~ 45 degrees (0.8 rad)
                    targetLegAngle = Math.sin(playerMesh.userData.walkTimer) * 0.8;
                } else {
                    // Try to complete the step or return to 0
                    // For "stuck" prevention, simply lerping to 0 is safest and looks fine for stopping.
                    targetLegAngle = 0;

                    // Reset timer so next walk starts fresh? Or keep continuity? 
                    // Keeping continuity is better.
                }

                // Apply rotation with smoothing
                // Left leg
                playerMesh.userData.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
                    playerMesh.userData.leftLegPivot.rotation.x,
                    targetLegAngle,
                    10 * deltaTime
                );

                // Right leg (opposite phase)
                playerMesh.userData.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
                    playerMesh.userData.rightLegPivot.rotation.x,
                    -targetLegAngle,
                    10 * deltaTime
                );
            }

            // Make nametag always face camera
            if (playerMesh.userData.nameTag) {
                playerMesh.userData.nameTag.lookAt(camera.position);
            }

            // Make health bar face camera
            if (playerMesh.userData.healthBar) {
                playerMesh.userData.healthBar.lookAt(camera.position);
            }

            // Hide nametag if too far away
            const distance = camera.position.distanceTo(playerMesh.position);
            if (playerMesh.userData.nameTag) {
                playerMesh.userData.nameTag.visible = distance < this.nameTagDistance;
            }
            if (playerMesh.userData.healthBar) {
                playerMesh.userData.healthBar.visible = distance < this.nameTagDistance;
            }
        });
    }

    /**
     * Set player dead state (corpse visual)
     */
    setPlayerDead(playerId, isDead) {
        const playerMesh = this.players.get(playerId);
        if (playerMesh) {
            // Don't hide, make it look dead
            playerMesh.userData.isDead = isDead;

            if (isDead) {
                console.log(`💀 Player ${playerId} visual death`);
                // Lay flat
                playerMesh.rotation.x = -Math.PI / 2;
                playerMesh.position.y = 0.5; // Lower to ground
                // Optional: Change color to grey/dark
                if (playerMesh.userData.body) {
                    playerMesh.userData.body.material.color.setHex(0x555555);
                }
            } else {
                console.log(`♻️ Player ${playerId} visual respawn`);
                // Reset
                playerMesh.rotation.x = 0;
                playerMesh.position.y = 0; // Will be corrected by position update
                // Restore color
                if (playerMesh.userData.body) {
                    playerMesh.userData.body.material.color.set(this.getPlayerColor(playerId));
                }
                playerMesh.visible = true;
            }
        }
    }

    /**
     * Show muzzle flash effect for player
     */
    showMuzzleFlash(playerId) {
        const playerMesh = this.players.get(playerId);
        if (!playerMesh) return;

        // Create a simple flash effect
        const flashGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);

        // Position at weapon tip
        flash.position.copy(playerMesh.userData.weapon.position);
        flash.position.z -= 0.5;
        playerMesh.add(flash);

        // Animate and remove
        let opacity = 1;
        const fadeOut = setInterval(() => {
            opacity -= 0.1;
            flash.material.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fadeOut);
                playerMesh.remove(flash);
            }
        }, 30);
    }

    /**
     * Get all player meshes
     */
    getPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * Get specific player mesh
     */
    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    /**
     * Clear all players
     */
    clear() {
        this.players.forEach((playerMesh) => {
            this.scene.remove(playerMesh);
        });
        this.players.clear();
    }
}
