import * as THREE from 'three';

export class LootManager {
    constructor(scene, camera, uiUpdateCallback) {
        this.scene = scene;
        this.camera = camera;
        this.uiUpdateCallback = uiUpdateCallback;

        this.lootItems = [];
        this.raycaster = new THREE.Raycaster();
        this.interactionRadius = 3.0; // Distance to interact

        // Settings
        this.rotateSpeed = 1.0;
        this.floatSpeed = 1.5;
        this.floatHeight = 0.2;
    }

    /**
     * Create an armor plate bundle (resupply station)
     */
    createArmorBox(position) {
        const group = new THREE.Group();
        group.position.copy(position);

        // Box visual
        const geometry = new THREE.BoxGeometry(0.8, 0.4, 0.5);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00aaff, // Blue for armor
            roughness: 0.3,
            metalness: 0.7,
            emissive: 0x0044aa,
            emissiveIntensity: 0.2
        });
        const box = new THREE.Mesh(geometry, material);
        box.castShadow = true;
        group.add(box);

        // Label/Icon (Simple floating plane)
        const iconGeo = new THREE.PlaneGeometry(0.5, 0.5);
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 64;
        iconCanvas.height = 64;
        const ctx = iconCanvas.getContext('2d');
        ctx.fillStyle = '#00aaff';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        // Draw Shield icon
        ctx.beginPath();
        ctx.moveTo(32, 10);
        ctx.lineTo(54, 20);
        ctx.lineTo(54, 40);
        ctx.quadraticCurveTo(32, 60, 32, 60);
        ctx.quadraticCurveTo(10, 40, 10, 40);
        ctx.lineTo(10, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const iconTex = new THREE.CanvasTexture(iconCanvas);
        const iconMat = new THREE.MeshBasicMaterial({ map: iconTex, transparent: true, side: THREE.DoubleSide });
        const icon = new THREE.Mesh(iconGeo, iconMat);
        icon.position.y = 0.8;
        // Make icon look at camera always in update
        group.userData.icon = icon;
        group.add(icon);

        // Light
        const light = new THREE.PointLight(0x00aaff, 1, 3);
        light.position.y = 0.5;
        group.add(light);

        group.userData = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'armor',
            amount: 3, // Refill 3 plates
            startY: position.y
        };

        this.scene.add(group);
        this.lootItems.push(group);

        return group;
    }

    update(delta, playerPosition) {
        const now = performance.now() / 1000;
        let closestDist = Infinity;
        let showPrompt = false;

        // Ensure UI Element exists (lazy init)
        if (!this.prompt) {
            this.prompt = document.getElementById('loot-prompt');
            if (!this.prompt) {
                this.prompt = document.createElement('div');
                this.prompt.id = 'loot-prompt';
                this.prompt.style.position = 'fixed';
                this.prompt.style.bottom = '150px';
                this.prompt.style.left = '50%';
                this.prompt.style.transform = 'translate(-50%, 0)';
                this.prompt.style.color = 'white';
                this.prompt.style.background = 'rgba(0,0,0,0.5)';
                this.prompt.style.padding = '10px';
                this.prompt.style.border = '2px solid #00aaff';
                this.prompt.style.borderRadius = '8px';
                this.prompt.style.fontFamily = 'Arial';
                this.prompt.style.fontWeight = 'bold';
                this.prompt.style.display = 'none';
                this.prompt.innerHTML = `🛡️ RESUPPLY ARMOR <br><span style="font-size:0.8em; color:#ccc">Press [SQUARE] or [E]</span>`;
                document.body.appendChild(this.prompt);
            }
        }

        for (const item of this.lootItems) {
            // Float and Rotate
            item.rotation.y += this.rotateSpeed * delta;
            item.position.y = item.userData.startY + Math.sin(now * this.floatSpeed) * this.floatHeight;

            // Icon lookup
            if (item.userData.icon) {
                item.userData.icon.lookAt(this.camera.position);
            }

            // Check distance
            const dist = playerPosition.distanceTo(item.position);
            if (dist < this.interactionRadius) {
                showPrompt = true;
            }
        }

        if (this.prompt) {
            this.prompt.style.display = showPrompt ? 'block' : 'none';
        }
    }

    /**
     * Check if player tries to interact (e.g. presses E)
     */
    checkInteraction(playerPosition) {
        let interactedItem = null;

        // Find closest item within radius
        let minDist = Infinity;

        for (const item of this.lootItems) {
            const dist = playerPosition.distanceTo(item.position);
            if (dist < this.interactionRadius && dist < minDist) {
                minDist = dist;
                interactedItem = item;
            }
        }

        if (interactedItem && interactedItem.userData.type === 'armor') {
            return { type: 'armor', amount: interactedItem.userData.amount };
        }

        return null;
    }
}
