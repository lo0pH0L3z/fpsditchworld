/**
 * Public Cinema System - Outdoor movie screen for watching videos together
 * 
 * Uses CSS3DRenderer for true 3D perspective + Raycast Occlusion for visibility
 * 
 * Features:
 * - CSS3DRenderer: Video is a 3D object in the world (correct perspective/skew)
 * - Occlusion Culling: Hides video when blocked by walls
 * - Multiplayer sync (broadcasts URL to all players)
 */

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CollisionManager } from '../core/collisions.js';

// Constants
const CINEMA_INTERACTION_DISTANCE = 15.0; // Show prompt only when close to screen
const SCREEN_WIDTH = 36;  // 1.5x original (was 24) - good balance of size/performance
const SCREEN_HEIGHT = 20.25; // 1.5x original (was 13.5) - 16:9 aspect ratio
const SCREEN_POSITION = { x: 0, y: 15, z: -90 }; // 1.5x further (was z: -60)
const CSS_SCALE = 20; // ~720p equivalent (36*20=720, 20.25*20=405)

// Viewing Platform - invisible platform for optimal viewing without fullscreen
// Positioned at half the screen height for perfect eye-level view
const VIEWING_PLATFORM = {
    x: 0,                           // X position (centered)
    y: 7,                           // Y position - lower platform
    z: -60,                         // Z position - 30 units from screen (screen is at -90)
    width: SCREEN_WIDTH,            // Full screen width
    depth: 8,                       // Platform depth (front to back)
    height: 1                       // Platform thickness
};

/**
 * Get ground height for the cinema viewing platform
 * Used by player physics to stand on the invisible platform
 * @param {number} x - Player X position
 * @param {number} z - Player Z position
 * @param {number} currentY - Player current Y (eye height)
 * @returns {Object|null} Ground info or null if not on platform
 */
export function getCinemaViewingPlatformHeight(x, z, currentY) {
    const feetY = currentY - 1.7; // Player feet are ~1.7 below eye level

    const halfWidth = VIEWING_PLATFORM.width / 2;
    const halfDepth = VIEWING_PLATFORM.depth / 2;

    // Check if player is within platform bounds (X and Z)
    const inPlatformX = Math.abs(x - VIEWING_PLATFORM.x) <= halfWidth;
    const inPlatformZ = Math.abs(z - VIEWING_PLATFORM.z) <= halfDepth;

    if (!inPlatformX || !inPlatformZ) return null;

    // Platform surface height (top of the platform)
    const surfaceHeight = VIEWING_PLATFORM.y + VIEWING_PLATFORM.height / 2;

    // Only register ground if feet are close to or above the surface
    // This prevents snapping to platform from far below
    if (feetY >= surfaceHeight - 2 && feetY <= surfaceHeight + 4) {
        return {
            height: surfaceHeight,
            slope: 0,
            onRamp: true,
            type: 'viewing_platform'
        };
    }

    return null;
}

/**
 * PublicCinema class - manages the cinema screen and playback
 */
export class PublicCinema {
    constructor(scene, networkManager = null) {
        this.scene = scene;
        this.networkManager = networkManager;
        this.screenMesh = null;
        this.isNearScreen = false;
        this.isModalOpen = false;
        this.isPlaying = false;
        this.currentUrl = '';

        // CSS3D
        this.css3dRenderer = null;
        this.css3dScene = null;
        this.iframeObject = null;
        this.raycaster = new THREE.Raycaster();

        this.createCinemaStructure();
        this.setupCSS3DRenderer();

        // Setup UI after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupUI());
        } else {
            setTimeout(() => this.setupUI(), 100);
        }

        this.setupNetworkSync();

        console.log('?? Public Cinema initialized with CSS3D + Occlusion');
    }

    /**
     * Setup CSS3D Renderer for rendering iframe on 3D screen
     */
    setupCSS3DRenderer() {
        try {
            console.log('?? Setting up CSS3D Renderer...');

            // Create CSS3D scene
            this.css3dScene = new THREE.Scene();

            // Create CSS3D renderer
            this.css3dRenderer = new CSS3DRenderer();
            this.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
            this.css3dRenderer.domElement.style.position = 'absolute';
            this.css3dRenderer.domElement.style.top = '0';
            this.css3dRenderer.domElement.style.left = '0';
            this.css3dRenderer.domElement.style.pointerEvents = 'auto'; // Needed for iframe interaction
            this.css3dRenderer.domElement.style.zIndex = '0'; // Render BEHIND WebGL canvas
            this.css3dRenderer.domElement.id = 'css3d-renderer';

            // Insert after canvas so it renders on top
            document.body.appendChild(this.css3dRenderer.domElement);
            console.log('?? CSS3D Renderer DOM element added:', this.css3dRenderer.domElement);

            // Create iframe element for video
            this.createIframeObject();

            // Handle window resize
            window.addEventListener('resize', () => {
                this.css3dRenderer.setSize(window.innerWidth, window.innerHeight);
            });

            console.log('?? CSS3D Renderer setup complete!');
        } catch (error) {
            console.error('?? ERROR setting up CSS3D Renderer:', error);
        }
    }

    /**
     * Create the iframe as a CSS3D object positioned on the screen
     */
    createIframeObject() {
        // Create container div
        const container = document.createElement('div');
        container.style.width = `${SCREEN_WIDTH * CSS_SCALE}px`;
        container.style.height = `${SCREEN_HEIGHT * CSS_SCALE}px`;
        container.style.backgroundColor = '#000';
        container.id = 'cinema-3d-container';

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'cinema-3d-iframe';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.pointerEvents = 'auto'; // Enable clicking on video
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        container.appendChild(iframe);

        // Create CSS3D object
        this.iframeObject = new CSS3DObject(container);

        // Position exactly matching the screen mesh world position
        this.iframeObject.position.set(SCREEN_POSITION.x, SCREEN_POSITION.y, SCREEN_POSITION.z);

        // Move slightly forward to avoid z-fighting
        this.iframeObject.position.z += 0.1;

        // Scale down (CSS3D works in pixels, we need to map to world units)
        const scale = 1 / CSS_SCALE;
        this.iframeObject.scale.set(scale, scale, scale);

        // Keep visible - CSS3DRenderer handles visibility via container opacity
        // this.iframeObject.visible = false;

        // Add to CSS3D scene
        this.css3dScene.add(this.iframeObject);
    }

    /**
     * Create the 3D cinema screen and surrounding structure
     */
    createCinemaStructure() {
        const cinemaGroup = new THREE.Group();
        cinemaGroup.position.set(SCREEN_POSITION.x, 0, SCREEN_POSITION.z);

        // === SCREEN ===
        // We need a mesh for raycast occlusion testing
        const screenGeometry = new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT);
        const screenMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            side: THREE.DoubleSide,
            emissive: 0x000000
        });

        this.holeMaterial = new THREE.MeshBasicMaterial({
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.ZeroFactor,
            blendDst: THREE.ZeroFactor,
            colorWrite: true // Write 0,0,0,0
        });

        // Save initial material
        this.blackMaterial = screenMaterial;

        this.screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
        this.screenMesh.position.set(0, SCREEN_POSITION.y, 0);
        // Important: Add to group but keep world position logical
        cinemaGroup.add(this.screenMesh);

        // Screen frame/border
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x6633ff,
            emissive: 0x6633ff,
            emissiveIntensity: 0.3,
            roughness: 0.5,
            metalness: 0.7
        });

        // Frame pieces...
        const thickness = 0.5;
        const depth = 0.5;

        // Top
        const topFrame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_WIDTH + thickness * 2, thickness, depth), frameMaterial);
        topFrame.position.set(0, SCREEN_POSITION.y + SCREEN_HEIGHT / 2 + thickness / 2, depth / 2);
        cinemaGroup.add(topFrame);

        // Bottom
        const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_WIDTH + thickness * 2, thickness, depth), frameMaterial);
        bottomFrame.position.set(0, SCREEN_POSITION.y - SCREEN_HEIGHT / 2 - thickness / 2, depth / 2);
        cinemaGroup.add(bottomFrame);

        // Left
        const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(thickness, SCREEN_HEIGHT + thickness * 2, depth), frameMaterial);
        leftFrame.position.set(-SCREEN_WIDTH / 2 - thickness / 2, SCREEN_POSITION.y, depth / 2);
        cinemaGroup.add(leftFrame);

        // Right
        const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(thickness, SCREEN_HEIGHT + thickness * 2, depth), frameMaterial);
        rightFrame.position.set(SCREEN_WIDTH / 2 + thickness / 2, SCREEN_POSITION.y, depth / 2);
        cinemaGroup.add(rightFrame);

        // Support pillars and stage (simplified for cleaner code)
        const supportMat = new THREE.MeshStandardMaterial({ color: 0x444444 });

        const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, SCREEN_POSITION.y, 8), supportMat);
        leftPillar.position.set(-SCREEN_WIDTH / 2 - 2, SCREEN_POSITION.y / 2, 0);
        cinemaGroup.add(leftPillar);

        const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, SCREEN_POSITION.y, 8), supportMat);
        rightPillar.position.set(SCREEN_WIDTH / 2 + 2, SCREEN_POSITION.y / 2, 0);
        cinemaGroup.add(rightPillar);

        // Stage
        const stage = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_WIDTH + 10, 1, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        stage.position.set(0, 0.5, 2);
        cinemaGroup.add(stage);

        // "CINEMA" sign
        const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xff3366 }));
        sign.position.set(0, SCREEN_POSITION.y + SCREEN_HEIGHT / 2 + 3, 0);
        cinemaGroup.add(sign);

        // === INVISIBLE VIEWING PLATFORM ===
        // A platform for optimal viewing - invisible but with ground collision
        // The platform mesh is fully transparent (invisible)
        const platformGeometry = new THREE.BoxGeometry(VIEWING_PLATFORM.width, VIEWING_PLATFORM.height, VIEWING_PLATFORM.depth);
        const platformMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.1,     // DEBUG: Translucent to judge height
            depthWrite: false,
            side: THREE.DoubleSide // Visible from inside/below
        });

        const viewingPlatform = new THREE.Mesh(platformGeometry, platformMaterial);
        // Position in world coordinates (not relative to cinemaGroup)
        viewingPlatform.position.set(
            VIEWING_PLATFORM.x - SCREEN_POSITION.x, // Offset from cinema group origin
            VIEWING_PLATFORM.y,
            VIEWING_PLATFORM.z - SCREEN_POSITION.z  // Offset from cinema group origin
        );
        cinemaGroup.add(viewingPlatform);

        // Register collision with CollisionManager so players bump into the sides
        // The baseY is the bottom of the platform (y - height/2)
        CollisionManager.addBox({
            name: 'cinema_viewing_platform',
            centerX: VIEWING_PLATFORM.x,
            centerZ: VIEWING_PLATFORM.z,
            width: VIEWING_PLATFORM.width,
            depth: VIEWING_PLATFORM.depth,
            height: VIEWING_PLATFORM.height,
            baseY: VIEWING_PLATFORM.y - VIEWING_PLATFORM.height / 2
        });

        console.log(`🎬 Cinema viewing platform created at (${VIEWING_PLATFORM.x}, ${VIEWING_PLATFORM.y}, ${VIEWING_PLATFORM.z})`);

        this.scene.add(cinemaGroup);
        this.cinemaGroup = cinemaGroup;
    }

    /**
     * Setup UI listeners
            */
    setupUI() {
        console.log('?? Setting up cinema UI...');

        // Play button
        const playBtn = document.getElementById('cinema-play');
        if (playBtn) playBtn.onclick = (e) => { e.preventDefault(); this.playVideo(); };

        // Fullscreen button
        const fullscreenBtn = document.getElementById('cinema-fullscreen');
        if (fullscreenBtn) fullscreenBtn.onclick = (e) => { e.preventDefault(); this.toggleFullscreen(); };

        // Close modal
        const closeBtn = document.getElementById('cinema-close');
        if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); this.closeModal(); };

        // Minimize overlay (Stop)
        const minimizeBtn = document.getElementById('cinema-minimize');
        if (minimizeBtn) minimizeBtn.onclick = (e) => { e.preventDefault(); this.stopVideo(); };

        // Pause/Play toggle button
        const pauseBtn = document.getElementById('cinema-pause-toggle');
        if (pauseBtn) pauseBtn.onclick = (e) => { e.preventDefault(); this.togglePause(); };

        // Stop button
        const stopBtn = document.getElementById('cinema-stop');
        if (stopBtn) stopBtn.onclick = (e) => { e.preventDefault(); this.stopVideo(); };

        // Volume slider
        const volumeSlider = document.getElementById('cinema-volume');
        const volumeVal = document.getElementById('cinema-volume-val');
        if (volumeSlider) {
            volumeSlider.oninput = (e) => {
                const volume = e.target.value;
                if (volumeVal) volumeVal.textContent = volume + '%';
                this.setVolume(volume / 100);
            };
        }

        // URL Input
        const urlInput = document.getElementById('cinema-url');
        if (urlInput) urlInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.playVideo(); } };

        // Click outside
        const modal = document.getElementById('cinema-modal');
        if (modal) modal.onclick = (e) => { if (e.target === modal) this.closeModal(); };
    }

    setupNetworkSync() {
        if (!this.networkManager) return;
        this.networkManager.onCinemaUrl = (url) => {
            console.log('?? Received cinema URL:', url);
            this.loadVideo(url, false);
        };
    }

    convertToEmbedUrl(url) {
        if (!url) return null;
        // Local File (MP4)
        if (url.toLowerCase().endsWith('.mp4')) {
            // Resolve full URL (relative paths won't work in data URI)
            const fullUrl = new URL(url, window.location.href).href;

            // Use a data URI to force autoplay and proper styling
            // Added 'muted' to ensure autoplay policies are met
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { margin: 0; padding: 0; background: red; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
                        video { width: 100%; height: 100%; object-fit: contain; }
                    </style>
                </head>
                <body>
                    <video src="${fullUrl}" autoplay loop playsinline muted controls></video>
                </body>
                </html>
            `;
            return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        }

        // YouTube
        let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        const origin = window.location.origin;

        if (match) {
            return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=0&rel=0&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
        }

        match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=0&rel=0&origin=${encodeURIComponent(origin)}`;
        }

        if (url.includes('youtube.com/embed/')) {
            let newUrl = url;
            if (!newUrl.includes('autoplay')) newUrl += '?autoplay=1';
            if (!newUrl.includes('origin')) newUrl += `&origin=${encodeURIComponent(origin)}`;
            if (!newUrl.includes('enablejsapi')) newUrl += `&enablejsapi=1`;
            return newUrl;
        }

        // Vimeo / Twitch / Other
        match = url.match(/vimeo\.com\/(\d+)/);
        if (match) return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;

        match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)$/);
        if (match) return `https://player.twitch.tv/?channel=${match[1]}&parent=${window.location.hostname}`;

        return url;
    }

    playVideo() {
        const urlInput = document.getElementById('cinema-url');
        if (!urlInput) return;
        const url = urlInput.value.trim();
        if (url) {
            this.loadVideo(url, true);
            this.closeModal();
        }
    }

    loadVideo(url, broadcast = true) {
        const embedUrl = this.convertToEmbedUrl(url);
        if (!embedUrl) return;

        this.currentUrl = url;
        this.isPaused = false;
        console.log('?? Loading video:', embedUrl);

        // Update 3D iframe ONLY (not overlay - that would cause double audio)
        const iframe3d = document.getElementById('cinema-3d-iframe');
        if (iframe3d) iframe3d.src = embedUrl;

        // Don't load overlay iframe - it causes audio echo
        // The overlay is only used for fullscreen mode, loaded on demand

        if (this.iframeObject) this.iframeObject.visible = true;
        this.isPlaying = true;

        // Show playback controls
        const playbackControls = document.getElementById('cinema-playback-controls');
        if (playbackControls) playbackControls.style.display = 'block';

        // Reset pause button text
        const pauseBtn = document.getElementById('cinema-pause-toggle');
        if (pauseBtn) pauseBtn.textContent = '? PAUSE';

        // Use Hole Material to see through canvas to CSS3D underneath
        if (this.screenMesh) {
            this.screenMesh.visible = true;
            this.screenMesh.material = this.holeMaterial;
        }

        // Hide overlay initially (we use 3D screen by default)
        const overlay = document.getElementById('cinema-overlay');
        if (overlay) overlay.style.display = 'none';

        if (broadcast && this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.sendCinemaUrl(url);
        }
    }

    toggleFullscreen() {
        const overlay = document.getElementById('cinema-overlay');
        if (!overlay) return;

        // Toggle between overlay (fullscreen) and 3D mode
        if (overlay.style.display === 'block') {
            overlay.style.display = 'none'; // Back to 3D
        } else {
            overlay.style.display = 'block'; // Show overlay
            overlay.classList.add('fullscreen');
        }
    }

    openModal() {
        const modal = document.getElementById('cinema-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.isModalOpen = true;
            setTimeout(() => {
                const urlInput = document.getElementById('cinema-url');
                if (urlInput) urlInput.focus();
            }, 100);
        }
    }

    closeModal() {
        const modal = document.getElementById('cinema-modal');
        if (modal) {
            modal.style.display = 'none';
            this.isModalOpen = false;
        }
    }

    stopVideo() {
        if (this.iframeObject) this.iframeObject.visible = false;

        const iframe3d = document.getElementById('cinema-3d-iframe');
        if (iframe3d) iframe3d.src = '';

        const overlay = document.getElementById('cinema-overlay');
        if (overlay) overlay.style.display = 'none';

        // Hide playback controls
        const playbackControls = document.getElementById('cinema-playback-controls');
        if (playbackControls) playbackControls.style.display = 'none';

        this.isPlaying = false;
        this.isPaused = false;
        this.currentUrl = '';

        // Update pause button text
        const pauseBtn = document.getElementById('cinema-pause-toggle');
        if (pauseBtn) pauseBtn.textContent = '? PAUSE';

        // Restore black screen
        if (this.screenMesh) {
            this.screenMesh.visible = true;
            this.screenMesh.material = this.blackMaterial;
            this.screenMesh.material.emissive.setHex(0x000000);
        }
    }

    togglePause() {
        const iframe = document.getElementById('cinema-3d-iframe');
        const pauseBtn = document.getElementById('cinema-pause-toggle');
        if (!iframe || !iframe.contentWindow) return;

        this.isPaused = !this.isPaused;

        // Send YouTube postMessage command
        const command = this.isPaused ? 'pauseVideo' : 'playVideo';
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: command,
            args: []
        }), '*');

        // Update button text
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? '? PLAY' : '? PAUSE';
        }
    }

    setVolume(volume) {
        const iframe = document.getElementById('cinema-3d-iframe');
        if (!iframe || !iframe.contentWindow) return;

        // Volume is 0-100 for YouTube
        const volumePercent = Math.round(volume * 100);

        // Send YouTube postMessage command
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [volumePercent]
        }), '*');
    }

    isPlayerNear(playerPosition) {
        const screenPos = new THREE.Vector3(SCREEN_POSITION.x, playerPosition.y, SCREEN_POSITION.z);
        return playerPosition.distanceTo(screenPos) < CINEMA_INTERACTION_DISTANCE;
    }

    /**
     * Update loop: handles CSS3D rendering and Occlusion Culling
     */
    update(playerPosition, camera = null) {
        // Render CSS3D when camera exists
        if (camera && this.css3dRenderer && this.css3dScene) {
            // Sync position/rotation with the screen mesh
            if (this.screenMesh && this.iframeObject) {
                const worldPos = this.screenMesh.getWorldPosition(new THREE.Vector3());
                const worldQuat = this.screenMesh.getWorldQuaternion(new THREE.Quaternion());

                // Offset slightly forward (toward camera)
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);
                worldPos.add(forward.multiplyScalar(0.1));

                this.iframeObject.position.copy(worldPos);
                this.iframeObject.quaternion.copy(worldQuat);
            }

            // NOTE: Raycast occlusion is no longer needed because we use proper Depth Sorting!
            // The WebGL canvas (z-index 1) covers the CSS3D (z-index 0).
            // The screenMesh punches a hole in WebGL to reveal CSS3D.
            // Any other WebGL object (walls) will naturally render on top of the hole, occluding it.

            // Ensure container is visible and interactive
            const container = document.getElementById('cinema-3d-container');
            if (container) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto'; // Enable interaction for local files
            }

            // Render CSS3D
            this.css3dRenderer.render(this.css3dScene, camera);
        }

        // Logic updates
        const wasNear = this.isNearScreen;
        this.isNearScreen = this.isPlayerNear(playerPosition);

        const prompt = document.getElementById('cinema-prompt');
        if (prompt) prompt.style.display = (this.isNearScreen && !this.isModalOpen) ? 'block' : 'none';
    }

    interact() {
        if (this.isNearScreen && !this.isModalOpen) {
            this.openModal();
            return true;
        }
        return false;
    }

    isBlockingInput() {
        return this.isModalOpen;
    }
}

export { CINEMA_INTERACTION_DISTANCE };
