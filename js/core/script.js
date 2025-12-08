
import * as THREE from 'three';
import { playShootSound, playHitSound, playEmptyClickSound, playMagEjectSound, playMagInsertSound, warmupAudio } from '../input/audio.js';
import { WEAPONS, hipPosition, adsPosition, createGun, preloadWeaponAssets, prebuildWeaponModels } from '../entities/weapons.js';
import { createEnvironment, buildLights, preloadEnvironmentAssets } from '../locations/world.js';
import { createFiringRange } from '../locations/firing-range.js';
import { CollisionManager } from './collisions.js';
import { createDirtJumps, getDirtJumpGroundHeight, checkRampSideCollision } from '../locations/dirt-jumps.js';
import { spawnTargets, createTarget, updateTargets as updateTargetPositions } from '../entities/targets.js';
import { createInputState, registerInputListeners } from '../input/input.js';
import { setupSettingsUI, toggleSettings } from './settings.js';
import { initMotion, setMotionEnabled, setMotionSensitivityH, setMotionSensitivityV, setMotionInvertY, setMotionAdsMultiplierH, setMotionAdsMultiplierV, setMotionADS, setMotionFovScale, setMotionFovScaleEnabled, setMotionFovScaleStrength, setMotionDeadzone, requestMotionDevice, calibrateMotion, consumeMotionLook, getMotionState, getMotionDebug, cycleYawAxis, flipYawSign, cyclePitchAxis, flipPitchSign } from '../input/motion.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { NetworkManager } from '../multiplayer/network-manager.js';
import { PlayerManager } from '../multiplayer/player-manager.js';
import { VehicleManager, HOLD_DURATION } from '../entities/vehicles.js';
import { PublicCinema, getCinemaViewingPlatformHeight } from '../locations/public-cinema.js';
import { DamageSystem } from './damage.js';

import { LootManager } from '../entities/loot.js';
import { createMountains, getTerrainHeight } from '../locations/mountains.js';
import { createTrees, preloadTrees } from '../locations/trees.js';
import { preloadRadioTower, createRadioTower } from '../locations/radiotower.js';
import { preloadLookout, createLookout } from '../locations/lookout.js';
import { preloadWarehouse, createWarehouse } from '../locations/warehouse.js';

// --- Config & State ---
const CONFIG = {
    movement: {
        walkSpeed: 10,
        slideSpeed: 20,
        slideDuration: 1.0,
        jumpForce: 12, // Increased from 8 for backflips
        sprintSpeed: 15,
        crouchSpeed: 5,
        airControl: 0.5
    },
    physics: { gravity: 20, baseHeight: 1.6, slideHeight: 0.8 },
    gravityMin: 5,
    gravityMax: 100,
    look: {
        baseH: 2.0,
        baseV: 2.0,
        airMultiplier: 2.0, // Faster rotation in air for flips
        ads: 0.5,
        adsMultiplierH: 1.0,
        adsMultiplierV: 1.0,
        mouseSensitivity: 0.05,
        mouseSensitivityMultiplier: 1.0,
        fovScaleSticks: true,
        fovScaleSticksStrength: 1.0
    },
    view: { baseFov: 75, adsTransitionSpeed: 10.0 },
    gameplay: { timeLimit: 60 }
};

const GameState = {
    PLAYING: 'PLAYING',
    SETTINGS: 'SETTINGS',
    IN_VEHICLE: 'IN_VEHICLE'
};

// Health Regen State
let lastDamageTime = 0;
const REGEN_DELAY = 10000; // 10 seconds
const REGEN_RATE = 10; // health per second

let camera, scene, renderer;
let gunScene, gunCamera;
let composer;
let lastTime = 0;
let gameState = GameState.PLAYING;

let currentLookSpeedH = CONFIG.look.baseH;
let currentLookSpeedV = CONFIG.look.baseV;
let pitch = 0;
let yaw = 0;

// Physics State
let velocity = new THREE.Vector3();
let isGrounded = true;
let isSliding = false;
let slideTimer = 0;
// Landing recovery state - ONLY for pitch (front/backflips)
// Landing recovery state - ONLY for pitch (front/backflips)
let isLandingRecovery = false;
let targetRecoveryPitch = 0; // Saved target - calculated once at landing
let landingDip = 0; // Visual dip amount when landing (crouch effect)

// Gun & ADS State
let gunGroup;
let isADS = false;

// Weapon System
const WEAPON_ORDER = ['SMG', 'PISTOL', 'SNIPER'];
let currentWeaponIndex = 0;
let currentWeapon = WEAPON_ORDER[currentWeaponIndex];
let currentAmmo = WEAPONS[currentWeapon].magSize;
let reserveAmmo = WEAPONS[currentWeapon].reserveAmmo;
let isReloading = false;
let emptyClickLocked = false;

// Game State
let targets = [];
const raycaster = new THREE.Raycaster();

// Multiplayer State
let networkManager = null;
let playerManager = null;
let multiplayerEnabled = false;
let playerHealth = 100;
let playerArmor = 150; // Max 150 = 3 plates
const MAX_ARMOR = 150;

// Input State
const { keys, mouse } = createInputState();
let lastGamepadButtons = [];
let wasSquarePressed = false; // For generic interact/reload detection (Keyboard + Gamepad)
let lastShootTime = 0;

// Vehicle State
let vehicleManager = null;
let squareHoldTime = 0;
let walkTimer = 0;

// Cinema State
let publicCinema = null;

// Loot State
let lootManager = null;

// Ping/Debug Marker State
let pingMarkers = [];
let lastPingTime = 0;
let lastSquarePressed = false;

// Mega-Jump State (on-foot)
let jumpHoldTime = 0;
let lastJumpPressed = false;
const MEGA_JUMP_CHARGE_TIME = 0.5; // Seconds to fully charge
const MEGA_JUMP_MULTIPLIER = 2.5; // Max jump force multiplier

function updateMotionStatusUI(status) {
    const statusEl = document.getElementById('motion-status');
    if (!statusEl) return;

    if (!status.supported) {
        statusEl.textContent = 'WebHID not supported';
        statusEl.style.color = '#f55';
        return;
    }

    let label = status.status;
    if (status.connected) {
        label += status.enabled ? ' (ON)' : ' (OFF)';
    }
    statusEl.textContent = label;
    statusEl.style.color = status.connected ? '#0f0' : 'rgba(255, 255, 255, 0.6)';
}

function registerMotionDebugHotkeys() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'F6') {
            cycleYawAxis();
            console.log('[Motion] Yaw axis ->', getMotionDebug().axisMap.yaw);
        } else if (e.code === 'F7') {
            flipYawSign();
            console.log('[Motion] Yaw sign ->', getMotionDebug().axisMap.yaw.sign);
        } else if (e.code === 'F8') {
            cyclePitchAxis();
            console.log('[Motion] Pitch axis ->', getMotionDebug().axisMap.pitch);
        } else if (e.code === 'F9') {
            flipPitchSign();
            console.log('[Motion] Pitch sign ->', getMotionDebug().axisMap.pitch.sign);
        } else {
            return;
        }
        e.preventDefault();
    });
}

const STATIC_IMAGE_ASSETS = [
    'DW_LOGO.png',
    'DW_LOGO.webp',
    'nunya.png',
    'favicon.svg',
    'assets/textures/sand.jpg'
    // 'textures/floor.jpg' // Removed seeing as it 404s and isn't used (we use mountains now)
];

// Listen for local player damage to reset regen timer
document.addEventListener('local-player-damaged', (e) => {
    lastDamageTime = performance.now();
    // Update local health from damage event
    if (e.detail && e.detail.damage) {
        playerHealth = Math.max(0, playerHealth - e.detail.damage);
        updateHealthUI();
    }
});

document.addEventListener('local-player-respawn', () => {
    respawnPlayer();
});

function preloadImages(urls = []) {
    return Promise.all(urls.map((url) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(url); // Resolve even on error to avoid blocking
        img.src = url;
    })));
}

// Helper to update the loading screen
function updateLoadingProgress(message) {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = `    <div id="logo"><img src="DW_LOGO.png"></div>
    <div id="logo2"><img src="nunya.png" width="100px"></div><br><span style="font-size: 14px; opacity: 0.8;">${message}</span>`;
    }
}

async function preloadResources(renderer) {
    try {
        updateLoadingProgress('Loading audio...');
        await warmupAudio();
        console.log('✅ Audio preloaded');

        updateLoadingProgress('Loading environment...');
        // Preload sand texture explicitly for mountains
        const texLoader = new THREE.TextureLoader();
        const sandTex = await new Promise((resolve) => {
            texLoader.load('assets/textures/sand.jpg', (tex) => resolve(tex), undefined, () => resolve(null));
        });

        await Promise.all([
            preloadEnvironmentAssets(renderer),
            preloadTrees(),
            preloadRadioTower(),
            preloadLookout(),
            preloadWarehouse()
        ]).catch((err) => {
            console.warn('⚠️ Preload environment/trees failed (continuing):', err);
            return null;
        });

        // Generate heavy geometry during preload
        createEnvironment(scene, renderer);
        createMountains(scene, sandTex);
        createTrees(scene);
        createRadioTower(scene);
        createLookout(scene);
        createWarehouse(scene);
        console.log('✅ Environment, Mountains, Trees, Radio Tower, Lookout & Warehouse preloaded');

        updateLoadingProgress('Loading weapons...');
        await preloadWeaponAssets().catch((err) => {
            console.warn('⚠️ Preload weapon assets failed (continuing):', err);
            return null;
        });
        console.log('✅ Weapon assets preloaded');

        updateLoadingProgress('Building weapons...');
        const weaponModels = await prebuildWeaponModels();
        console.log('✅ Weapon models built');

        updateLoadingProgress('Warming up GPU...');
        const gpuStart = performance.now();

        // Helper: force upload texture by rendering 1x1 pixel
        const warmupWeapon = (weapon) => {
            const originalSize = new THREE.Vector2();
            renderer.getSize(originalSize);
            renderer.setScissor(0, 0, 1, 1);
            renderer.setScissorTest(true);

            const clone = weapon.clone(true);
            clone.position.copy(hipPosition);
            clone.position.z = -1; // Frustum check
            camera.add(clone);
            scene.add(camera);
            renderer.render(scene, camera);
            camera.remove(clone);

            renderer.setScissorTest(false);
            renderer.setSize(originalSize.width, originalSize.height);
        };

        // 1. Warmup SMG IMMEDIATELY (Critical for startup)
        if (weaponModels.SMG) warmupWeapon(weaponModels.SMG);

        // 2. Warmup others in background (Staggered to unblock main thread/INP)
        setTimeout(() => {
            if (weaponModels.PISTOL) warmupWeapon(weaponModels.PISTOL);
            console.log('✅ Background: Pistol warmed up');
        }, 500); // 0.5s later

        setTimeout(() => {
            if (weaponModels.SNIPER) warmupWeapon(weaponModels.SNIPER);
            console.log('✅ Background: Sniper warmed up');
        }, 1000); // 1.0s later

        console.log(`✅ GPU warmed up (SMG Only) (${(performance.now() - gpuStart).toFixed(2)}ms)`);

        updateLoadingProgress('Loading images...');
        await preloadImages(STATIC_IMAGE_ASSETS);
        console.log('✅ Static images preloaded');

        // Note: We do NOT hide the overlay here anymore. 
        // We wait for subsystems (vehicles, etc.) in init()

    } catch (err) {
        console.warn('⚠️ Preload issue (continuing):', err);
    }
}

async function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(CONFIG.view.baseFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = CONFIG.physics.baseHeight;
    camera.position.z = 5;
    scene.fog = new THREE.FogExp2(0xbba780, 0.003); // sandy fog to blend with HDR ground

    // --- Gun Scene Setup ---
    gunScene = new THREE.Scene();
    gunCamera = new THREE.PerspectiveCamera(CONFIG.view.baseFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    gunCamera.position.y = CONFIG.physics.baseHeight;
    gunCamera.position.z = 5;
    // No fog for the gun scene so it stays crisp

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    yaw = euler.y;
    pitch = euler.x;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Optimization: Cap pixel ratio to 1.5 to prevent massive GPU load on 4k/Retina screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0xbba780, 1); // Alpha 1 ensures background is opaque except where we punched holes
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6; // Reduce from default 1.0 to fix overexposure
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '1'; // Render on top of CSS3D
    renderer.domElement.style.pointerEvents = 'none'; // Pass events through (handled by input listeners on window)
    document.body.appendChild(renderer.domElement);

    // --- 1. PRELOAD ASSETS & HEAVY GEOMETRY ---
    // This creates Environment, Mountains, Trees, and preloads Audio/Weapons
    await preloadResources(renderer);

    // --- 2. SETUP POST-PROCESSING ---
    composer = new EffectComposer(renderer);

    const renderPassWorld = new RenderPass(scene, camera);
    renderPassWorld.clear = true; // Clear everything before drawing world

    const renderPassGun = new RenderPass(gunScene, gunCamera);
    renderPassGun.clear = false; // Don't clear color
    renderPassGun.clearDepth = true; // Clear depth so gun draws on top

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.1, 0.0);

    composer.addPass(renderPassWorld);
    composer.addPass(renderPassGun);
    composer.addPass(bloomPass);

    buildLights(scene);
    buildLights(gunScene); // Replicate lights for the gun

    // --- 3. INITIALIZE GAME SYSTEMS ---
    updateLoadingProgress('Initializing game systems...');

    // Create Firing Range (Walls/Pillars) - Instant but good to group
    createFiringRange(scene);

    // Initialize multiplayer (optional - game works offline too)
    // We instantiate it, but connection happens async. We don't await connection to avoid freezing.
    initMultiplayer();

    // Initialize vehicle system
    vehicleManager = new VehicleManager(scene);
    vehicleManager.createMotorbike(new THREE.Vector3(8, 0, -5)); // Spawn motorbike near start

    // Create dirt jump ramps around the map perimeter
    createDirtJumps(scene);

    // Initialize public cinema (behind firing range)
    publicCinema = new PublicCinema(scene, networkManager);

    // Initialize Loot Manager
    lootManager = new LootManager(scene, camera);
    // Create some armor stations
    lootManager.createArmorBox(new THREE.Vector3(5, 1, 5));
    lootManager.createArmorBox(new THREE.Vector3(-5, 1, 5));
    lootManager.createArmorBox(new THREE.Vector3(0, 1, 10));

    // Consolidate Gun Group
    gunGroup = createGun(gunScene, gunCamera, currentWeapon, gunGroup);
    targets = spawnTargets(scene, targets);
    updateAmmoDisplay();
    updateHealthUI();
    updateArmorUI(); // CRITICAL: Ensure armor is visible on load!

    window.addEventListener('resize', onWindowResize);

    registerInputListeners({ keys, mouse }, { reload, switchWeapon });

    initMotion({ onStatus: updateMotionStatusUI });
    registerMotionDebugHotkeys();

    setupSettingsUI({
        onWalkSpeedChange: (value) => { CONFIG.movement.walkSpeed = value; },
        onSlideSpeedChange: (value) => { CONFIG.movement.slideSpeed = value; },
        onJumpForceChange: (value) => { CONFIG.movement.jumpForce = value; },
        onSprintSpeedChange: (value) => { CONFIG.movement.sprintSpeed = value; },
        onCrouchSpeedChange: (val) => { CONFIG.movement.crouchSpeed = val; },
        onAirControlChange: (val) => { CONFIG.movement.airControl = val; },
        onGravityChange: (val) => {
            CONFIG.physics.gravity = val;
            if (vehicleManager) {
                vehicleManager.setGravity(val);
            }
        },
        onHeadBobEnabledChange: (enabled) => { CONFIG.movement.headBob = enabled; },
        onHeadBobAmountChange: (value) => { CONFIG.movement.headBobAmount = value; },
        onLookSpeedHChange: (value) => { CONFIG.look.baseH = value; currentLookSpeedH = value; },
        onLookSpeedVChange: (value) => { CONFIG.look.baseV = value; currentLookSpeedV = value; },
        onAdsSpeedChange: (value) => { CONFIG.look.ads = value; },
        onAdsMultiplierHChange: (value) => { CONFIG.look.adsMultiplierH = value; },
        onAdsMultiplierVChange: (value) => { CONFIG.look.adsMultiplierV = value; },
        onMouseSensMultiplierChange: (value) => { CONFIG.look.mouseSensitivityMultiplier = value; },
        onAdsTransitionSpeedChange: (value) => { CONFIG.view.adsTransitionSpeed = value; },
        onInvertChange: () => { /* state lives on checkbox */ },
        onFovScaleSticksChange: (enabled) => { CONFIG.look.fovScaleSticks = enabled; },
        onFovScaleSticksStrengthChange: (value) => { CONFIG.look.fovScaleSticksStrength = value; },
        onMotionToggle: (enabled) => { setMotionEnabled(enabled); },
        onMotionSensitivityHChange: (value) => { setMotionSensitivityH(value); },
        onMotionSensitivityVChange: (value) => { setMotionSensitivityV(value); },
        onMotionInvertYChange: (value) => { setMotionInvertY(value); },
        onMotionAdsMultiplierHChange: (value) => { setMotionAdsMultiplierH(value); },
        onMotionAdsMultiplierVChange: (value) => { setMotionAdsMultiplierV(value); },
        onMotionFovScaleChange: (enabled) => { setMotionFovScaleEnabled(enabled); },
        onMotionFovScaleStrengthChange: (value) => { setMotionFovScaleStrength(value); },
        onMotionDeadzoneChange: (value) => { setMotionDeadzone(value); },
        onMotionConnect: async () => {
            try {
                await requestMotionDevice();
            } catch (err) {
                console.error('Motion connect failed', err);
            }
        },
        onMotionCalibrate: () => { calibrateMotion(); },
        onVoiceMuteMicChange: (muted) => {
            if (networkManager && networkManager.voiceChat) {
                networkManager.voiceChat.setMute(muted);
            }
        },
        onVoiceDeafenChange: (deafened) => {
            if (networkManager && networkManager.voiceChat) {
                networkManager.voiceChat.setDeafen(deafened);
            }
        },
        onVoiceVolumeChange: (volume) => {
            if (networkManager && networkManager.voiceChat) {
                networkManager.voiceChat.setVolume(volume);
            }
        }
    });

    // Respawn button listener
    const respawnBtn = document.getElementById('respawn-btn');
    if (respawnBtn) {
        respawnBtn.addEventListener('click', respawnPlayer);
    }

    // Initial UI Update
    updateHealthUI();
    updateArmorUI(); // CRITICAL: Ensure armor is visible on load!
    updateAmmoDisplay();

    // --- 4. FINISH LOADING ---
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        updateLoadingProgress('Ready!');
        // Allow a brief moment to see "Ready!" then fade out
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }, 300);
    }
    console.log('🎮 All systems initialized & assets preloaded');

    renderer.setAnimationLoop(animate);
}

/**
 * Create a ping marker at the given position with coordinate label
 * Used for debugging - shows XYZ coordinates to help place objects
 */
function createPingMarker() {
    // Raycast from camera to find where player is looking
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    raycaster.set(camera.position, direction);

    // Raycast against the actual scene geometry (mountains, etc.)
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length === 0) {
        console.log('❌ Ping missed (sky or too far)');
        return;
    }

    const hit = intersects[0];
    const target = hit.point;

    // Add small offset so it sits ON surface, not half-buried
    target.y += 0.2;

    // Create visual marker (tall pillar)
    const markerGroup = new THREE.Group();

    // Pillar
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 15, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 7.5;
    markerGroup.add(pillar);

    // Top sphere beacon
    const beaconGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 1.0
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 15;
    markerGroup.add(beacon);

    // Ground ring
    const ringGeo = new THREE.RingGeometry(1, 2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    markerGroup.add(ring);

    markerGroup.position.copy(target);
    scene.add(markerGroup);
    pingMarkers.push(markerGroup);

    // Create coordinate label (CSS2D-style via HTML overlay)
    const coordText = `📍 PING\nX: ${target.x.toFixed(1)}\nY: ${target.y.toFixed(1)}\nZ: ${target.z.toFixed(1)}`;

    // Create HTML label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'ping-label';
    labelDiv.innerHTML = coordText.replace(/\n/g, '<br>');
    labelDiv.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.85);
        color: #ff00ff;
        padding: 10px 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 16px;
        font-weight: bold;
        border: 2px solid #ff00ff;
        pointer-events: none;
        z-index: 9999;
        text-shadow: 0 0 10px #ff00ff;
        box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
    `;
    document.body.appendChild(labelDiv);

    // Store label reference for updating position
    markerGroup.userData.label = labelDiv;
    markerGroup.userData.worldPos = target.clone();

    // Console log for easy copy-paste
    console.log('');
    console.log('📍 ===== PING MARKER PLACED =====');
    console.log(`   X: ${target.x.toFixed(1)}`);
    console.log(`   Y: ${target.y.toFixed(1)}`);
    console.log(`   Z: ${target.z.toFixed(1)}`);
    console.log(`   Copy: { x: ${target.x.toFixed(1)}, z: ${target.z.toFixed(1)} }`);
    console.log('=================================');
    console.log('');

    return markerGroup;
}

/**
 * Update ping label positions to follow 3D markers
 */
function updatePingLabels() {
    for (const marker of pingMarkers) {
        if (marker.userData.label) {
            const worldPos = marker.userData.worldPos;
            const screenPos = worldPos.clone().project(camera);

            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

            // Only show if in front of camera
            if (screenPos.z < 1) {
                marker.userData.label.style.left = `${x}px`;
                marker.userData.label.style.top = `${y - 100}px`;
                marker.userData.label.style.display = 'block';
            } else {
                marker.userData.label.style.display = 'none';
            }
        }
    }
}

/**
 * Clear all ping markers
 */
function clearPingMarkers() {
    for (const marker of pingMarkers) {
        scene.remove(marker);
        if (marker.userData.label) {
            marker.userData.label.remove();
        }
    }
    pingMarkers = [];
    console.log('🧹 Ping markers cleared');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    gunCamera.aspect = window.innerWidth / window.innerHeight;
    gunCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

function handleInput(delta) {
    const gamepads = navigator.getGamepads();
    let activeGamepad = null;

    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            activeGamepad = gamepads[i];
            break;
        }
    }

    const settingsModal = document.getElementById('settings-modal');
    const settingsOpen = settingsModal && settingsModal.style.display === 'block';
    if (settingsOpen) {
        gameState = GameState.SETTINGS;
        if (activeGamepad && window.handleSettingsInput) {
            window.handleSettingsInput(activeGamepad);
        }
        lastGamepadButtons = activeGamepad ? activeGamepad.buttons.map(b => b && b.pressed) : [];
        return null;
    } else if (gameState === GameState.SETTINGS) {
        gameState = GameState.PLAYING;
    }

    const debugPanel = document.getElementById('debug-panel');
    let inputSource = 'None';

    const input = {
        moveX: 0,
        moveZ: 0,
        lookX: 0,
        lookY: 0,
        jumpPressed: false,
        slidePressed: false,
        sprintPressed: false,
        crouchPressed: false,
        shootValue: 0,
        adsValue: 0,
        // Vehicle-specific inputs
        accelerate: 0,
        brake: 0,
        handbrake: false,
        steer: 0,
        pitch: 0, // Added for air control
        squarePressed: false,
        trianglePressed: false,
        squareHeldForExit: false,
        toggleCamera: false
    };

    // 1. Gamepad Input
    if (activeGamepad) {
        inputSource = `Gamepad (${activeGamepad.id})`;

        // Improved deadzone: zeros small values AND scales remaining values
        // This prevents drift by ensuring 0 input when near center
        const applyDeadzone = (value, threshold = 0.15) => {
            if (Math.abs(value) < threshold) return 0;
            // Scale the remaining range so it starts from 0
            const sign = value > 0 ? 1 : -1;
            return sign * ((Math.abs(value) - threshold) / (1.0 - threshold));
        };

        input.moveX = applyDeadzone(activeGamepad.axes[0]);
        input.moveZ = applyDeadzone(activeGamepad.axes[1]);

        // Higher deadzone for look axes (DualSense sticks are known for drift)
        const rawLookX = activeGamepad.axes[2];
        const rawLookY = activeGamepad.axes[3];
        input.lookX = applyDeadzone(rawLookX, 0.2);
        input.lookY = applyDeadzone(rawLookY, 0.2);

        // Debug: detect and log potential stick drift
        if (!window._lastDriftLog) window._lastDriftLog = 0;
        if (!window._driftCounter) window._driftCounter = 0;
        const now = performance.now();

        // If we're getting small but non-zero values consistently, it's drift
        if (Math.abs(rawLookX) > 0.05 && Math.abs(rawLookX) < 0.3) {
            window._driftCounter++;
            if (window._driftCounter > 60 && now - window._lastDriftLog > 3000) {
                console.warn(`🎮 Possible stick drift detected! Raw lookX: ${rawLookX.toFixed(4)} (after deadzone: ${input.lookX.toFixed(4)})`);
                window._lastDriftLog = now;
                window._driftCounter = 0;
            }
        } else {
            window._driftCounter = 0;
        }

        input.jumpPressed = activeGamepad.buttons[0].pressed; // X
        input.slidePressed = activeGamepad.buttons[1].pressed; // Circle
        input.crouchPressed = activeGamepad.buttons[1].pressed; // Circle
        input.sprintPressed = activeGamepad.buttons[10].pressed; // L3

        input.adsValue = activeGamepad.buttons[6] ? activeGamepad.buttons[6].value : 0; // L2
        input.shootValue = activeGamepad.buttons[7] ? activeGamepad.buttons[7].value : 0; // R2

        // Respawn Dead with X (Cross)
        if (activeGamepad.buttons[0].pressed && window.damageSystem && window.damageSystem.isDead) {
            window.damageSystem.respawn();
        }

        // Vehicle controls
        input.accelerate = activeGamepad.buttons[7] ? activeGamepad.buttons[7].value : 0; // R2
        input.brake = activeGamepad.buttons[6] ? activeGamepad.buttons[6].value : 0; // L2
        input.handbrake = activeGamepad.buttons[4] ? activeGamepad.buttons[4].pressed : false; // L1
        input.steer = applyDeadzone(activeGamepad.axes[0]); // Left stick X
        input.pitch = applyDeadzone(activeGamepad.axes[1]); // Left stick Y
        input.squarePressed = activeGamepad.buttons[2] ? activeGamepad.buttons[2].pressed : false; // Square
        input.trianglePressed = activeGamepad.buttons[3] ? activeGamepad.buttons[3].pressed : false; // Triangle
        // Mark when square is held long enough for exit (so vehicle knows not to shift down)
        input.squareHeldForExit = squareHoldTime >= HOLD_DURATION;

        const currentButtons = activeGamepad.buttons.map(b => b && b.pressed);
        const pressedOnce = (index) => currentButtons[index] && !lastGamepadButtons[index];

        // Toggle vehicle camera with Right D-Pad
        if (pressedOnce(15)) { // D-Pad Right
            input.toggleCamera = true;
        }

        if (gameState !== GameState.IN_VEHICLE) {
            if (pressedOnce(3)) { // Triangle - Switch
                switchWeapon();
            }
        }
        if (pressedOnce(9)) { // Options - Settings
            toggleSettings();
        }

        // D-Pad UP - Create ping marker with coordinates
        if (pressedOnce(12)) {
            createPingMarker();
        }

        // D-Pad DOWN - Clear all ping markers
        if (pressedOnce(13)) {
            clearPingMarkers();
        }

        lastGamepadButtons = currentButtons;
    } else {
        lastGamepadButtons = [];
    }

    // 2. Keyboard/Mouse Input (Additive)
    if (keys.w) input.moveZ -= 1;
    if (keys.s) input.moveZ += 1;
    if (keys.a) input.moveX -= 1;
    if (keys.d) input.moveX += 1;

    if (keys.space) input.jumpPressed = true;
    if (keys.c || keys.ctrl) {
        input.slidePressed = true;
        input.crouchPressed = true;
    }
    if (keys.shift) input.sprintPressed = true;

    if (mouse.right) input.adsValue = 1.0;
    if (mouse.left) input.shootValue = 1.0;

    // Keyboard vehicle controls (when in vehicle, WASD controls the vehicle)
    if (gameState === GameState.IN_VEHICLE) {
        if (keys.w) { input.accelerate = 1.0; input.pitch = -1.0; }
        if (keys.s) { input.brake = 1.0; input.pitch = 1.0; }
        if (keys.a) input.steer = -1.0;
        if (keys.d) input.steer = 1.0;
        if (keys.space) input.handbrake = true;
        if (keys.v) input.toggleCamera = true;
    }

    // E key acts as square button for vehicle entry/exit
    if (keys.e) input.squarePressed = true;

    const mouseSensitivity = CONFIG.look.mouseSensitivity * CONFIG.look.mouseSensitivityMultiplier;
    input.lookX += mouse.dx * mouseSensitivity;
    input.lookY += mouse.dy * mouseSensitivity;

    mouse.dx = 0;
    mouse.dy = 0;

    const motionLook = consumeMotionLook();
    const hasMotionInput = motionLook.lookX !== 0 || motionLook.lookY !== 0;
    if (hasMotionInput) {
        input.lookX += motionLook.lookX;
        input.lookY += motionLook.lookY;
    }

    if (inputSource === 'None' && hasMotionInput) {
        inputSource = 'DualSense Motion';
    } else if (inputSource === 'None' && (input.moveX || input.moveZ || input.lookX || input.lookY || input.jumpPressed || input.shootValue)) {
        inputSource = 'Keyboard/Mouse';
    }

    // Generic Interact / Reload Logic (Keyboard + Gamepad)
    if (input.squarePressed && !wasSquarePressed) {
        if (gameState !== GameState.IN_VEHICLE) {
            let interacted = false;
            if (lootManager) {
                const loot = lootManager.checkInteraction(camera.position);
                if (loot && loot.type === 'armor') {
                    playerArmor = Math.min(MAX_ARMOR, playerArmor + 150);
                    updateArmorUI();
                    console.log("🛡️ Armor Resupplied!");
                    // Play pickup sound?
                    interacted = true;
                }
            }
            if (!interacted) reload();
        }
    }
    wasSquarePressed = input.squarePressed;

    if (debugPanel) {
        debugPanel.style.display = 'block';
        const motionState = getMotionState();
        let debugText = `Input: ${inputSource}<br>Motion: ${motionState.connected ? 'connected' : 'idle'} ${motionState.enabled ? 'ON' : 'OFF'}<br>ADS: ${input.adsValue.toFixed(2)}`;
        if (motionState.connected) {
            const motionDebug = getMotionDebug();
            debugText += `<br>Gyro raw: x ${motionDebug.lastGyro.x} y ${motionDebug.lastGyro.y} z ${motionDebug.lastGyro.z}`;
            debugText += `<br>Gyro dps: x ${motionDebug.dps.x.toFixed(1)} y ${motionDebug.dps.y.toFixed(1)} z ${motionDebug.dps.z.toFixed(1)}`;
            debugText += `<br>Smoothed: x ${motionDebug.smoothedDps.x.toFixed(1)} y ${motionDebug.smoothedDps.y.toFixed(1)} z ${motionDebug.smoothedDps.z.toFixed(1)}`;
            debugText += `<br>Map yaw: ${motionDebug.axisMap.yaw.axis}*${motionDebug.axisMap.yaw.sign} | pitch: ${motionDebug.axisMap.pitch.axis}*${motionDebug.axisMap.pitch.sign}`;
            debugText += `<br>Output: lookX=${motionLook.lookX.toFixed(4)} lookY=${motionLook.lookY.toFixed(4)}`;
            if (motionDebug.accel) {
                debugText += `<br>Accel raw: x ${motionDebug.accel.x} y ${motionDebug.accel.y} z ${motionDebug.accel.z}`;
            }
            if (motionDebug.sensorOffsets) {
                const offsets = motionDebug.sensorOffsets;
                const detectedLabel = offsets.detected ? 'auto' : 'default';
                debugText += `<br>Offsets: gyro@${offsets.gyro} accel@${offsets.accel} (${detectedLabel})`;
            }

            if (motionDebug.lastRawData && motionDebug.lastRawData.length > 0) {
                debugText += '<br><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;font-size:5px;margin-top:5px;">';
                motionDebug.lastRawData.forEach((byte, i) => {
                    const offsets = motionDebug.sensorOffsets;
                    const gyroStart = offsets ? offsets.gyro : 13;
                    const accelStart = offsets ? offsets.accel : 19;
                    const isGyro = i >= gyroStart && i < gyroStart + 6;
                    const isAccel = i >= accelStart && i < accelStart + 6;
                    const color = isGyro ? '#0ff' : isAccel ? '#8f8' : '#888';
                    debugText += `<span style="color:${color}">${i}:${byte.toString(16).padStart(2, '0')}</span>`;
                });
                debugText += '</div>';
            }
        }
        debugPanel.innerHTML = debugText;
    }

    // === HEALTH REGENERATION ===
    if (playerHealth < 100 && playerHealth > 0) { // Don't regen if dead (0 health is dead state usually)
        const now = performance.now();
        if (now - lastDamageTime > REGEN_DELAY) {
            // Regen
            playerHealth += REGEN_RATE * delta;
            if (playerHealth > 100) playerHealth = 100;
            updateHealthUI();

            // Broadcast health for visual updates on other clients
            if (multiplayerEnabled && networkManager && networkManager.isConnected()) {
                // We don't have a dedicated "sendHealth" but sendPlayerUpdate includes it
                // sendPlayerUpdate is called in animate loop every frame anyway.
                // So adjusting playerHealth variable here is enough!
            }
        }
    }

    return input;
}

function updateAimState(adsValue) {
    isADS = adsValue > 0.1;
    // Update motion module's ADS state so it can apply motion-specific ADS multipliers
    setMotionADS(isADS);
    if (isADS) {
        currentLookSpeedH = CONFIG.look.ads * CONFIG.look.adsMultiplierH;
        currentLookSpeedV = CONFIG.look.ads * CONFIG.look.adsMultiplierV;
    } else {
        currentLookSpeedH = CONFIG.look.baseH;
        currentLookSpeedV = CONFIG.look.baseV;
    }
}

function updateLook(input, delta) {
    // Run if there is input OR if we are in the middle of a recovery animation
    if (input.lookX === 0 && input.lookY === 0 && !isLandingRecovery) return;

    // FOV scaling: reduce sensitivity proportionally when zoomed in
    // Using tangent ratio for accurate angular scaling (common in FPS games)
    const baseFovRad = (CONFIG.view.baseFov * Math.PI) / 360; // half-angle in radians
    const currentFovRad = (camera.fov * Math.PI) / 360;
    const rawFovScale = Math.tan(currentFovRad) / Math.tan(baseFovRad);

    // Apply FOV scaling with enabled toggle and strength blending
    let fovScale = 1.0;
    if (CONFIG.look.fovScaleSticks) {
        // Blend between no scaling (1.0) and full scaling (rawFovScale) based on strength
        fovScale = 1.0 + (rawFovScale - 1.0) * CONFIG.look.fovScaleSticksStrength;
    }

    // Update motion module with the raw FOV scale (it handles its own enabled/strength)
    setMotionFovScale(rawFovScale);

    // === FLIP RECOVERY (Exactly like vehicle crash recovery) ===
    if (isLandingRecovery) {
        // Lerp toward the saved target (calculated once when recovery started)
        pitch = THREE.MathUtils.lerp(pitch, targetRecoveryPitch, 5.0 * delta);

        // Check if recovered (close to target)
        if (Math.abs(pitch - targetRecoveryPitch) < 0.05) {
            pitch = 0; // Reset to 0 (clean horizon)
            isLandingRecovery = false;
            console.log('✅ Flip recovery complete');
        }

        // During recovery: DON'T modify yaw at all, just apply current state
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
        return;
    }

    // Update yaw (we track this ourselves, never read from quaternion)
    yaw -= input.lookX * currentLookSpeedH * fovScale * delta;

    const invertY = document.getElementById('invert-look').checked ? -1 : 1;

    // Faster pitch control in air for flips
    const airMult = isGrounded ? 1.0 : CONFIG.look.airMultiplier;

    pitch -= input.lookY * currentLookSpeedV * fovScale * delta * invertY * airMult;

    // Only clamp pitch when grounded (standard FPS limits)
    // When airborne, allow full rotation for flips
    if (isGrounded) {
        // Fix: Normalize pitch to -PI...PI range before clamping
        // This prevents the camera from snapping to 90 degrees if you land a full 360 flip (2PI)
        const twoPi = Math.PI * 2;
        pitch = pitch % twoPi;
        if (pitch > Math.PI) pitch -= twoPi;
        if (pitch < -Math.PI) pitch += twoPi;

        pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    }

    // Apply rotation
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
}

function updateMovement(input, delta) {
    let { moveX, moveZ } = input;

    if (Math.abs(moveX) + Math.abs(moveZ) > 1) {
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= len;
        moveZ /= len;
    }

    // Decay landing dip (smooth recovery)
    landingDip = THREE.MathUtils.lerp(landingDip, 0, 5 * delta); // Slower decay for "heavy" feel

    // NOTE: Landing is instant now, no movement lock needed

    // === MEGA-JUMP SYSTEM ===
    // Hold jump to charge, release for mega-jump
    if (isGrounded) {
        if (input.jumpPressed) {
            // Charging
            jumpHoldTime += delta;
        } else if (lastJumpPressed && jumpHoldTime > 0) {
            // Released - execute jump
            const chargeRatio = Math.min(jumpHoldTime / MEGA_JUMP_CHARGE_TIME, 1.0);
            const jumpMultiplier = 1.0 + (MEGA_JUMP_MULTIPLIER - 1.0) * chargeRatio;
            velocity.y = CONFIG.movement.jumpForce * jumpMultiplier;
            isGrounded = false;

            if (chargeRatio > 0.3) {
                console.log(`🚀 Mega-jump! (${(chargeRatio * 100).toFixed(0)}% charge, ${jumpMultiplier.toFixed(1)}x force)`);
            }
            jumpHoldTime = 0;
        }
    } else {
        jumpHoldTime = 0;
    }
    lastJumpPressed = input.jumpPressed;

    if (input.slidePressed && isGrounded && !isSliding && moveZ < -0.5) {
        isSliding = true;
        slideTimer = CONFIG.movement.slideDuration;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    let speed = CONFIG.movement.walkSpeed;
    let targetHeight = CONFIG.physics.baseHeight;

    if (isSliding) {
        speed = CONFIG.movement.slideSpeed;
        targetHeight = CONFIG.physics.slideHeight;
        slideTimer -= delta;
        if (slideTimer <= 0) {
            isSliding = false;
        }
    } else if (input.crouchPressed) {
        speed = CONFIG.movement.crouchSpeed;
        targetHeight = CONFIG.physics.slideHeight; // Reuse slide height for crouch
    } else if (input.sprintPressed && isGrounded && !isADS) {
        speed = CONFIG.movement.sprintSpeed;
    }

    // Head Bobbing
    if (isGrounded && !isSliding && (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1)) {
        // Frequency and amplitude based on speed (Running vs Walking)
        const isSprinting = speed > CONFIG.movement.walkSpeed;
        const bobFreq = isSprinting ? 14 : 9;
        const baseAmp = isSprinting ? 0.25 : 0.12;
        const bobAmp = baseAmp * CONFIG.movement.headBobAmount;

        walkTimer += delta * bobFreq;

        // Apply Sine wave to target height
        // We use Math.sin for standard up/down bob
        const bobOffset = Math.sin(walkTimer) * bobAmp;
        targetHeight += bobOffset;
    } else {
        // Reset timer when stopped so we always start distinct step
        walkTimer = 0;
    }

    if (isSliding) {
        velocity.x = forward.x * speed;
        velocity.z = forward.z * speed;
    } else {
        const moveVector = new THREE.Vector3()
            .addScaledVector(right, moveX)
            .addScaledVector(forward, -moveZ);

        if (isGrounded) {
            velocity.x = moveVector.x * speed;
            velocity.z = moveVector.z * speed;
        } else {
            // Air Control
            velocity.x = THREE.MathUtils.lerp(velocity.x, moveVector.x * speed, CONFIG.movement.airControl * delta * 5);
            velocity.z = THREE.MathUtils.lerp(velocity.z, moveVector.z * speed, CONFIG.movement.airControl * delta * 5);
        }
    }

    velocity.y -= CONFIG.physics.gravity * delta;

    // Calculate new position
    const newX = camera.position.x + velocity.x * delta;
    const newZ = camera.position.z + velocity.z * delta;

    // Check pillar collisions
    let finalX = newX;
    let finalZ = newZ;
    const playerRadius = 0.5; // Player collision radius (increased to prevent clipping)

    // Use CollisionManager for automatic collision detection against all registered colliders
    const collisionResult = CollisionManager.checkPlayerCollision(
        finalX, camera.position.y, finalZ, playerRadius, velocity
    );

    if (collisionResult.collided) {
        finalX = collisionResult.x;
        finalZ = collisionResult.z;
        velocity.x = collisionResult.velocityX;
        velocity.z = collisionResult.velocityZ;
    }

    // Check target collisions (targets are dynamic, so not in CollisionManager)
    if (targets && targets.length > 0) {
        for (const target of targets) {
            const targetRadius = 1.0; // Match sphere geometry radius
            const dx = finalX - target.mesh.position.x;
            const dz = finalZ - target.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minDistance = playerRadius + targetRadius;

            if (distance < minDistance) {
                // Collision detected - push player out
                const angle = Math.atan2(dz, dx);
                finalX = target.mesh.position.x + Math.cos(angle) * minDistance;
                finalZ = target.mesh.position.z + Math.sin(angle) * minDistance;

                // Zero out velocity in collision direction
                velocity.x = 0;
                velocity.z = 0;
            }
        }
    }

    camera.position.x = finalX;
    camera.position.z = finalZ;
    camera.position.y += velocity.y * delta;

    // Check dirt jump ramps for ground height
    let onRamp = false;
    let rampHeight = 0;
    let currentSlope = 0;

    const rampInfo = getDirtJumpGroundHeight(finalX, finalZ, camera.position.y);
    if (rampInfo && rampInfo.onRamp) {
        onRamp = true;
        rampHeight = rampInfo.height + targetHeight; // Add player height to ramp surface
        currentSlope = rampInfo.slope || 0;
    }

    // Check cinema viewing platform for ground height
    if (!onRamp) {
        const platformInfo = getCinemaViewingPlatformHeight(finalX, finalZ, camera.position.y);
        if (platformInfo && platformInfo.onRamp) {
            onRamp = true;
            rampHeight = platformInfo.height + targetHeight; // Add player height to platform surface
            currentSlope = 0;
        }
    }


    // Check mountains for ground height
    // Only check if we are NOT on a ramp or cinema platform to avoid conflict
    // But actually, we should check max height to allow blending? 
    // For now, let's treat mountains as base terrain that can be overridden by ramps if ramps are higher.
    // Or simpler: Check mountain height always, and if it's higher than current effectively ground, use it.
    if (!onRamp) {
        // We use camera x/z.
        const mountainY = getTerrainHeight(finalX, finalZ);
        // Mountain height is the surface Y. Player needs targetHeight above it.
        const mountainSurfaceHeight = mountainY + targetHeight;

        // Compare against current known ground height. 
        // Since onRamp is false here, the current ground is just the base targetHeight.
        const currentGround = targetHeight;

        if (mountainSurfaceHeight > currentGround) {
            // We are on a mountain
            rampHeight = mountainSurfaceHeight;
            onRamp = true; // Use logic for "on surface"
            // Slope calculation?
            // Simple finite difference for slope approx if needed, but for now just height is enough to walk.
        }
    }

    // Check box collider floors (tower platforms, etc.)
    const floorInfo = CollisionManager.getFloorHeight(finalX, finalZ, camera.position.y, 1.7);
    if (floorInfo && floorInfo.onFloor) {
        const floorSurfaceHeight = floorInfo.height + targetHeight;
        // Use this floor if it's higher than current ground
        if (!onRamp || floorSurfaceHeight > rampHeight) {
            rampHeight = floorSurfaceHeight;
            onRamp = true;
        }
    }

    // Check for ramp side collisions (prevents clipping through sides from below)
    const feetY = camera.position.y - 1.7;
    const rampSideCollision = checkRampSideCollision(finalX, finalZ, feetY, playerRadius);
    if (rampSideCollision) {
        finalX += rampSideCollision.x;
        finalZ += rampSideCollision.z;
        velocity.x = 0;
        velocity.z = 0;
    }

    // Update final position after collision resolution
    camera.position.x = finalX;
    camera.position.z = finalZ;

    // Ground collision (modified to account for ramps)
    const effectiveGroundHeight = onRamp ? rampHeight : targetHeight;
    if (camera.position.y < effectiveGroundHeight) {
        // === LANDING DETECTED ===
        // Capture impact speed before zeroing velocity
        const impactSpeed = Math.abs(velocity.y);

        // Trigger Landing Bob if impact is significant
        if (impactSpeed > 2.0 && !onRamp) { // Don't bob on ramps to avoid jitter
            // Calculated dip: stronger impact = deeper dip, max clamped
            // 0.03 multiplier feels "heavy" but not disorienting
            const dipAmount = Math.min(0.6, impactSpeed * 0.035);
            landingDip += dipAmount;
            // console.log(`🛬 Landed! Impact: ${impactSpeed.toFixed(1)}, Dip: ${landingDip.toFixed(2)}`);
        }

        camera.position.y = effectiveGroundHeight;
        velocity.y = 0;

        // When landing or while grounded, check if we need flip recovery
        if (!isLandingRecovery) {
            // Check if pitch is beyond normal looking range
            let checkPitch = pitch;
            while (checkPitch > Math.PI) checkPitch -= Math.PI * 2;
            while (checkPitch < -Math.PI) checkPitch += Math.PI * 2;

            // 95° threshold - trigger for any significant flip
            const flipThreshold = Math.PI * 95 / 180; // 95°
            const needsRecovery = Math.abs(checkPitch) > flipThreshold;

            if (needsRecovery) {
                // Calculate target - "Roll Out" logic
                // Instead of finding nearest upright (which might unwind the flip using round),
                // we want to complete the flip in the direction of rotation.
                // If pitch > 0 (backflip), go to next multiple (ceil)
                // If pitch < 0 (frontflip), go to previous multiple (floor)
                const twoPi = Math.PI * 2;
                if (pitch > 0) {
                    targetRecoveryPitch = Math.ceil(pitch / twoPi) * twoPi;
                } else {
                    targetRecoveryPitch = Math.floor(pitch / twoPi) * twoPi;
                }

                isLandingRecovery = true;
                console.log(`🛬 Flip recovery (Roll Out): ${(pitch * 180 / Math.PI).toFixed(0)}° → ${(targetRecoveryPitch * 180 / Math.PI).toFixed(0)}°`);
            }
        }

        isGrounded = true;
    } else if (camera.position.y > effectiveGroundHeight + 0.1 && isGrounded && !onRamp) {
        // Snap down if the drop is small (walking down a slope), otherwise fall
        const snapDistance = 0.8;
        if (camera.position.y - effectiveGroundHeight < snapDistance && velocity.y <= 0) {
            camera.position.y = effectiveGroundHeight;
            velocity.y = 0;
        } else {
            isGrounded = false;
        }
    }

    // Keep grounded while on ramp
    // Keep grounded while on ramp and snap to surface
    if (onRamp) {
        // Snap down if close enough to prevent "stepping" effect on slopes
        // FIXED: Reduced snap distance from 1.5 to 0.5 to prevent "magnet" effect when jumping
        // FIXED: Only snap if velocity is not too negative (falling fast = don't snap)
        const distToGround = camera.position.y - effectiveGroundHeight;

        // If walking down slope (low negative velocity) OR very close to ground
        const isWalkingDown = velocity.y > -10.0; // Don't snap if falling faster than 10m/s

        if (velocity.y <= 0 && isWalkingDown && distToGround < 0.5 && distToGround > -0.5) {
            camera.position.y = effectiveGroundHeight;
            velocity.y = 0;
            isGrounded = true;
        } else {
            // If we are high above (jumping or falling), ensure we are not marked as grounded
            if (distToGround > 0.1) {
                isGrounded = false;
            }
        }
    }

    // Smooth height transition (only when grounded and not on ramp)
    if (isGrounded && !onRamp) {
        // Apply landingDip to target height (temporarily crouch)
        const smoothedHeight = targetHeight - landingDip;
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, smoothedHeight, 10 * delta);
    }

    camera.position.x = Math.max(-1000, Math.min(1000, camera.position.x));
    camera.position.z = Math.max(-1000, Math.min(1000, camera.position.z));
}

function updateGunRig(delta) {
    if (!gunGroup) return;

    const weaponHip = WEAPONS[currentWeapon]?.hipPosition || hipPosition;
    const weaponAds = WEAPONS[currentWeapon]?.adsPosition || adsPosition;

    let targetPos = isADS ? weaponAds : weaponHip;
    let targetRotX = 0;
    let targetRotZ = 0;

    if (isReloading) {
        targetPos = new THREE.Vector3(weaponHip.x, weaponHip.y - 0.2, weaponHip.z);
        targetRotX = -0.5;
        targetRotZ = 0.2;
    }

    gunGroup.position.lerp(targetPos, 10 * delta);
    gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, targetRotX, 10 * delta);
    gunGroup.rotation.z = THREE.MathUtils.lerp(gunGroup.rotation.z, targetRotZ, 10 * delta);

    if (!isReloading) {
        gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, 0, 5 * delta);
    }
}

function updateCameraFov(delta) {
    const targetFOV = isADS ? WEAPONS[currentWeapon].zoomFOV : CONFIG.view.baseFov;
    if (Math.abs(camera.fov - targetFOV) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, CONFIG.view.adsTransitionSpeed * delta);
        camera.updateProjectionMatrix();

        gunCamera.fov = camera.fov;
        gunCamera.updateProjectionMatrix();
    }
}

function updateScopeOverlay() {
    const scopeOverlay = document.getElementById('scope-overlay');
    if (!scopeOverlay) return;

    if (currentWeapon === 'SNIPER' && isADS && !isReloading) {
        scopeOverlay.style.display = 'block';
        // Hide gun immediately when sniper ADS starts to prevent barrel blocking scope
        if (gunGroup) {
            gunGroup.visible = false;
        }
    } else {
        scopeOverlay.style.display = 'none';
        if (gunGroup) gunGroup.visible = true;
    }
}



function updateHealthUI() {
    const healthFill = document.getElementById('health-fill');
    if (healthFill) {
        healthFill.style.width = `${playerHealth}%`;

        // Remove inline color to allow CSS gradients to work
        healthFill.style.backgroundColor = '';

        // Toggle classes for styling
        healthFill.classList.toggle('critical', playerHealth < 30);
        healthFill.classList.toggle('warning', playerHealth >= 30 && playerHealth < 60);
    }
}

function updateArmorUI() {
    // Max Armor = 150 (3 plates x 50)
    // Plate 1: 0-50, Plate 2: 51-100, Plate 3: 101-150
    const p1 = document.getElementById('plate-1');
    const p2 = document.getElementById('plate-2');
    const p3 = document.getElementById('plate-3');

    if (p1) p1.classList.toggle('active', playerArmor > 0);
    if (p2) p2.classList.toggle('active', playerArmor > 50);
    if (p3) p3.classList.toggle('active', playerArmor > 100);


}

function respawnPlayer() {
    playerHealth = 100;
    playerArmor = 150;
    updateHealthUI();
    updateArmorUI();
    camera.position.set(0, CONFIG.physics.baseHeight, 0); // Reset position
    velocity.set(0, 0, 0); // Reset velocity
    isGrounded = true;
    isSliding = false;
    isLandingRecovery = false;
    pitch = 0;
    yaw = 0;
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    console.log("Player respawned!");
}

function shoot(intensity) {
    if (isReloading) return;
    // Check ammo
    if (currentAmmo <= 0) {
        if (!emptyClickLocked) {
            playEmptyClickSound();
            emptyClickLocked = true;
        }
        return;
    }

    const weapon = WEAPONS[currentWeapon];
    const now = performance.now();
    if (now - lastShootTime > weapon.fireRate) {
        lastShootTime = now;

        // Decrement ammo
        currentAmmo--;
        updateAmmoDisplay();

        playShootSound(currentWeapon);

        // Notify other players
        if (multiplayerEnabled && networkManager && networkManager.isConnected()) {
            const direction = raycaster.ray.direction;
            networkManager.sendPlayerFired(
                { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                { x: direction.x, y: direction.y, z: direction.z }
            );

            // Send Health Update occasionally or on change?
            // Actually, we should send it when damage happens or via heartbeat.
            // But for regen, we need to broadcast it.
        }

        if (gunGroup) {
            gunGroup.position.z += 0.05;
            gunGroup.rotation.x += 0.05;
        }

        const recoilAmount = isADS ? 0.01 : 0.03;
        pitch += recoilAmount;
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        createMuzzleFlash();

        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

        const muzzleWorldPos = getMuzzleWorldPosition();
        const missPoint = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(50));

        let intersectObjects = targets.map(t => t.mesh);
        const intersects = raycaster.intersectObjects(intersectObjects);

        const tracerEnd = intersects.length > 0 ? intersects[0].point : missPoint;
        createTracer(muzzleWorldPos, tracerEnd);

        // 1. Check PvP Hits via DamageSystem
        if (window.damageSystem) {
            const weaponDamage = WEAPONS[currentWeapon].damage;
            const pvpResult = window.damageSystem.checkShooting(raycaster, weaponDamage);

            if (pvpResult && pvpResult.hit) {
                playHitSound();
                showHitMarker();
                createImpact(pvpResult.point, new THREE.Vector3(0, 1, 0)); // Approx normal
                // Don't create bullet hole on players (meshes move)

                // Apply damage to local player if hit (for testing)
                if (pvpResult.targetId === 'localPlayer') {
                    takeDamage(pvpResult.damage);
                }
            }
        }

        // 2. Check Target Hits
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const hitPoint = intersects[0].point;
            const hitNormal = intersects[0].face ?
                intersects[0].face.normal.clone().transformDirection(hitObject.matrixWorld).normalize() :
                new THREE.Vector3(0, 0, 1);

            playHitSound();
            showHitMarker();
            createImpact(hitPoint, hitNormal);
            createBulletHole(hitPoint, hitNormal);

            // Check if it is a Target
            const targetIndex = targets.findIndex(t => t.mesh === hitObject);
            if (targetIndex !== -1) {
                hitObject.material.emissive.setHex(0xffffff);
                setTimeout(() => { hitObject.material.emissive.setHex(0x550000); }, 100);

                scene.remove(hitObject);
                targets.splice(targetIndex, 1);
                const newTarget = createTarget(scene);
                targets.push(newTarget);
            }
        }
    }
}

function createMuzzleFlash() {
    const flash = new THREE.PointLight(0xffff00, 1, 5);
    flash.position.copy(getMuzzleWorldPosition());

    scene.add(flash);
    setTimeout(() => { scene.remove(flash); }, 50);
}

function createTracer(start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0x88e0ff, transparent: true, opacity: 0.1 });
    const tracer = new THREE.Line(geometry, material);
    scene.add(tracer);

    const startTime = performance.now();
    function fade() {
        const t = (performance.now() - startTime) / 1000; // bullet trails
        if (t >= 1) {
            scene.remove(tracer);
            geometry.dispose();
            material.dispose();
            return;
        }
        material.opacity = 0.03 * (1 - t);
        requestAnimationFrame(fade);
    }
    fade();
}

function createBulletHole(position, normal) {
    const size = 0.18;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const hole = new THREE.Mesh(geometry, material);
    hole.position.copy(position).addScaledVector(normal, 0.01);
    hole.lookAt(position.clone().add(normal));
    scene.add(hole);
    setTimeout(() => {
        scene.remove(hole);
        geometry.dispose();
        material.dispose();
    }, 10000);
}

function getMuzzleWorldPosition() {
    if (gunGroup) {
        const barrelLength = WEAPONS[currentWeapon]?.barrelLength || 0.5;
        return new THREE.Vector3(0, 0.05, -barrelLength).applyMatrix4(gunGroup.matrixWorld);
    }
    const fallback = new THREE.Vector3(0.2, -0.2, -0.5).applyQuaternion(camera.quaternion);
    return camera.position.clone().add(fallback);
}

function createImpact(position, normal = new THREE.Vector3(0, 0, 1)) {
    const particleCount = 10;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        positions.push(position.x, position.y, position.z);
        velocities.push(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffaa00, size: 0.08 });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const sparkLines = [];
    const sparkVelocities = [];
    const baseNormal = normal.clone().normalize();
    for (let i = 0; i < 6; i++) {
        const jitter = new THREE.Vector3(
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6
        );
        const sparkDir = baseNormal.clone().add(jitter).normalize();
        const speed = 6 + Math.random() * 4;
        const velocity = sparkDir.multiplyScalar(speed);
        sparkVelocities.push(velocity);
        const sparkGeometry = new THREE.BufferGeometry().setFromPoints([
            position.clone(),
            position.clone().addScaledVector(velocity, 0.05)
        ]);
        const sparkMaterial = new THREE.LineBasicMaterial({ color: 0xffe6aa, transparent: true, opacity: 0.9 });
        const sparkLine = new THREE.Line(sparkGeometry, sparkMaterial);
        scene.add(sparkLine);
        sparkLines.push({ line: sparkLine, geometry: sparkGeometry, material: sparkMaterial });
    }

    const startTime = performance.now();
    let lastTime = startTime;
    function animateParticles() {
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        const elapsed = (now - startTime) / 1000;

        if (elapsed > 0.5) {
            scene.remove(particles);
            geometry.dispose();
            material.dispose();
            sparkLines.forEach(({ line, geometry: sparkGeo, material: sparkMat }) => {
                scene.remove(line);
                sparkGeo.dispose();
                sparkMat.dispose();
            });
            return;
        }

        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i * 3] * delta * 6;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 6;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 6;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        material.opacity = 0.8 * (1 - elapsed / 0.5);

        sparkLines.forEach(({ line, geometry: sparkGeo, material: sparkMat }, idx) => {
            const arr = sparkGeo.attributes.position.array;
            arr[0] += sparkVelocities[idx].x * delta;
            arr[1] += sparkVelocities[idx].y * delta;
            arr[2] += sparkVelocities[idx].z * delta;
            arr[3] += sparkVelocities[idx].x * delta;
            arr[4] += sparkVelocities[idx].y * delta;
            arr[5] += sparkVelocities[idx].z * delta;
            sparkGeo.attributes.position.needsUpdate = true;
            sparkMat.opacity = 0.9 * (1 - elapsed / 0.5);
        });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

function resetGame() {
    gameState = GameState.PLAYING;
    isSliding = false;
    isReloading = false;
    emptyClickLocked = false;
    velocity.set(0, 0, 0);
    updateAmmoDisplay();
    targets = spawnTargets(scene, targets);
    respawnPlayer(); // Reset health and armor
}

// === VEHICLE FUNCTIONS ===

function handleVehicleInteraction(input, delta) {
    if (!vehicleManager) return;

    const squarePressed = input.squarePressed;

    // Track square button hold time
    if (squarePressed) {
        squareHoldTime += delta;
    } else {
        squareHoldTime = 0;
    }

    // Check if hold duration met
    if (squareHoldTime >= HOLD_DURATION && squarePressed && !lastSquarePressed) {
        // Prevent retriggering while held
        lastSquarePressed = true;

        if (gameState === GameState.IN_VEHICLE) {
            // Exit vehicle
            const exitPos = vehicleManager.exitVehicle();
            if (exitPos) {
                camera.position.copy(exitPos);

                // Check if exiting on a ramp - use ramp height instead of ground
                const rampInfo = getDirtJumpGroundHeight(exitPos.x, exitPos.z, exitPos.y + 1.7);
                if (rampInfo && rampInfo.onRamp) {
                    camera.position.y = rampInfo.height + CONFIG.physics.baseHeight;
                } else {
                    camera.position.y = CONFIG.physics.baseHeight;
                }

                gameState = GameState.PLAYING;
                console.log('🚶 Exited vehicle');
            }
        } else if (gameState === GameState.PLAYING) {
            // Try to enter vehicle
            const vehicle = vehicleManager.enterVehicle(camera.position);
            if (vehicle) {
                gameState = GameState.IN_VEHICLE;
                console.log('🏍️ Entered vehicle');
            }
        }
    }

    // Reset trigger when square is released
    if (!squarePressed) {
        lastSquarePressed = false;
    }
}

function updateVehiclePrompt() {
    const prompt = document.getElementById('vehicle-prompt');
    if (!prompt || !vehicleManager) return;

    if (gameState === GameState.IN_VEHICLE) {
        // Show exit prompt
        prompt.style.display = 'block';
        prompt.innerHTML = 'Hold <span class="button-icon">□</span> to Exit Vehicle';
    } else if (gameState === GameState.PLAYING && vehicleManager.isPlayerNearVehicle(camera.position)) {
        // Show enter prompt
        prompt.style.display = 'block';
        prompt.innerHTML = 'Hold <span class="button-icon">□</span> to Enter Vehicle';
    } else {
        prompt.style.display = 'none';
    }
}

/**
 * Update the vehicle HUD (speedometer & gear indicator)
 */
function updateVehicleHUD() {
    const hudEl = document.getElementById('vehicle-hud');
    if (!hudEl) return;

    if (gameState === GameState.IN_VEHICLE && vehicleManager) {
        const vehicle = vehicleManager.getCurrentVehicle();
        if (vehicle) {
            hudEl.style.display = 'flex';

            // Speed in km/h (multiply m/s by 3.6)
            const speedKmh = Math.round(vehicle.getSpeed() * 3.6);
            document.getElementById('speed-value').textContent = speedKmh;
            document.getElementById('gear-value').textContent = vehicle.getCurrentGear();
        }
    } else {
        hudEl.style.display = 'none';
    }
}

function animate(time) {
    try {
        const rawDelta = (time - lastTime) / 1000;
        lastTime = time;
        // Clamp delta to prevent explosions (max 0.1s)
        const delta = Math.min(rawDelta, 0.1);

        const input = handleInput(delta);

        // Sync environment if needed (do this every frame or check)
        if (scene.environment && !gunScene.environment) {
            gunScene.environment = scene.environment;
            gunScene.background = null;
        }

        // Sync gun camera to main camera
        gunCamera.position.copy(camera.position);
        gunCamera.quaternion.copy(camera.quaternion);

        if (!input) {
            renderScene();
            return;
        }



        // Handle vehicle entry/exit (Square button hold)
        handleVehicleInteraction(input, delta);

        // Update based on game state
        if (gameState === GameState.IN_VEHICLE) {
            // Vehicle mode
            vehicleManager.update(delta, input);
            vehicleManager.updateCamera(camera);

            // Toggle camera with right d-pad
            if (input.toggleCamera) {
                vehicleManager.toggleCameraMode();
            }

            // Hide gun when in vehicle
            if (gunGroup) gunGroup.visible = false;
        } else {
            // Normal on-foot mode
            updateAimState(input.adsValue);
            updateLook(input, delta);
            updateMovement(input, delta);
            updateGunRig(delta);
            updateCameraFov(delta);
            updateScopeOverlay();

            // Show gun when on foot (unless sniper scope overlay is active)
            const scopeActive = currentWeapon === 'SNIPER' && isADS && !isReloading;
            if (gunGroup && !scopeActive) gunGroup.visible = true;

            if (input.shootValue <= 0.1) {
                emptyClickLocked = false;
            }

            if (input.shootValue > 0.1) {
                shoot(input.shootValue);
            }
        }

        updateTargetPositions(targets, delta);
        updateVehiclePrompt();
        updateVehicleHUD();

        // Update cinema (proximity detection + overlay positioning)
        if (publicCinema) {
            publicCinema.update(camera.position, camera, renderer);

            // Handle cinema interaction (Triangle when not in vehicle)
            if (gameState !== GameState.IN_VEHICLE && input.trianglePressed && !publicCinema.isBlockingInput()) {
                publicCinema.interact();
            }
        }

        if (lootManager) {
            lootManager.update(delta, camera.position);
        }

        // Multiplayer sync
        if (multiplayerEnabled && networkManager && networkManager.isConnected()) {
            // Send your position to other players
            networkManager.sendPlayerUpdate(
                { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
                currentWeapon,
                playerHealth
            );

            // Update remote players
            playerManager.update(camera, delta);
        }

        // Update ping marker labels
        updatePingLabels();

        renderScene();
    } catch (e) {
        console.error("Game Loop Error:", e);
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = 'block';
            debugPanel.innerHTML = `ERROR: ${e.message}`;
        }
    }
}

function renderScene() {
    // if (composer) {
    //     composer.render();
    // } else {
    renderer.render(scene, camera);
    // Also render gunScene on top manually since composer isn't doing it
    renderer.autoClear = false;
    renderer.clearDepth(); // Ensure gun renders on top of everything
    renderer.render(gunScene, gunCamera);
    renderer.autoClear = true;
    // }
}

function updateAmmoDisplay() {
    const ammoText = isReloading ?
        `RELOADING...` :
        `${currentAmmo} / ${reserveAmmo} [${WEAPONS[currentWeapon].name}]`;
    document.getElementById('ammo').innerText = ammoText;
}

function switchWeapon() {
    // Cycle through available weapons (SMG -> PISTOL -> SNIPER)
    currentWeaponIndex = (currentWeaponIndex + 1) % WEAPON_ORDER.length;
    currentWeapon = WEAPON_ORDER[currentWeaponIndex];
    isADS = false;

    // Reset ammo to the new weapon's stats
    const weapon = WEAPONS[currentWeapon];
    currentAmmo = weapon.magSize;
    reserveAmmo = weapon.reserveAmmo;
    emptyClickLocked = false;

    // Update the ammo display
    updateAmmoDisplay();

    // Rebuild the gun model for the new weapon
    gunGroup = createGun(gunScene, gunCamera, currentWeapon, gunGroup);
}

function reload() {
    if (isReloading || currentAmmo === WEAPONS[currentWeapon].magSize || reserveAmmo <= 0) return;

    isReloading = true;
    updateAmmoDisplay(); // Shows "RELOADING..."

    playMagEjectSound();

    // Schedule mag insertion sound
    setTimeout(() => {
        playMagInsertSound();
    }, WEAPONS[currentWeapon].reloadTime * 1000 * 0.6); // Play insert sound at 60% of reload time

    // Complete reload
    setTimeout(() => {
        const weapon = WEAPONS[currentWeapon];
        const ammoNeeded = weapon.magSize - currentAmmo;
        const ammoToLoad = Math.min(ammoNeeded, reserveAmmo);

        currentAmmo += ammoToLoad;
        reserveAmmo -= ammoToLoad;
        isReloading = false;
        emptyClickLocked = false;
        updateAmmoDisplay();
    }, WEAPONS[currentWeapon].reloadTime * 1000);
}

function showHitMarker() {
    const marker = document.getElementById('hit-marker');
    marker.style.display = 'block';
    setTimeout(() => { marker.style.display = 'none'; }, 100);
}

// === MULTIPLAYER FUNCTIONS ===

async function initMultiplayer() {
    try {
        console.log('🌐 Initializing multiplayer...');
        networkManager = new NetworkManager();
        await networkManager.connect();
        await networkManager.initVoiceChat();

        // Populate audio device dropdowns
        populateAudioOutputDevices();
        populateAudioInputDevices();

        playerManager = new PlayerManager(scene);
        multiplayerEnabled = true;

        console.log('✅ Multiplayer enabled!');
        updateMultiplayerStatus();

        setupMultiplayerEvents();
    } catch (error) {
        console.warn('⚠️ Multiplayer not available, running in offline mode:', error.message);
        multiplayerEnabled = false;
        updateMultiplayerStatus();
    }
}

async function populateAudioOutputDevices() {
    if (!networkManager || !networkManager.voiceChat) return;

    const dropdown = document.getElementById('voice-output-device');
    if (!dropdown) return;

    const devices = await networkManager.voiceChat.getAudioOutputDevices();

    // Clear existing options except default
    dropdown.innerHTML = '<option value="">Default</option>';

    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Speaker ${device.deviceId.slice(0, 8)}`;
        dropdown.appendChild(option);
    });

    // Wire up change event
    dropdown.addEventListener('change', async (e) => {
        const deviceId = e.target.value;
        await networkManager.voiceChat.setAudioOutputDevice(deviceId);
    });
}

async function populateAudioInputDevices() {
    if (!networkManager || !networkManager.voiceChat) return;

    const dropdown = document.getElementById('voice-input-device');
    if (!dropdown) return;

    const devices = await networkManager.voiceChat.getAudioInputDevices();

    // Clear existing options except default
    dropdown.innerHTML = '<option value="">Default</option>';

    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
        dropdown.appendChild(option);
    });

    // Wire up change event
    dropdown.addEventListener('change', async (e) => {
        const deviceId = e.target.value;
        console.log(`🎙️ Switching to input device: ${deviceId || 'Default'}`);
        await networkManager.voiceChat.setAudioInputDevice(deviceId);
    });
}

function setupMultiplayerEvents() {
    // When connected
    networkManager.on('connected', (data) => {
        console.log('✅ Connected! Player ID:', data.playerId);
        updateMultiplayerStatus();

        // Add all existing players
        data.players.forEach(player => {
            playerManager.addPlayer(player);
        });
    });

    // When a new player joins
    networkManager.on('player-joined', (player) => {
        console.log('👋 New player joined:', player.name);
        playerManager.addPlayer(player);
        updateMultiplayerStatus();
    });

    // When a player leaves
    networkManager.on('player-left', (data) => {
        console.log('👋 Player left:', data.name);
        playerManager.removePlayer(data.id);
        updateMultiplayerStatus();
    });

    // When a player moves
    networkManager.on('player-moved', (data) => {
        if (data.id !== networkManager.getPlayerId()) {
            playerManager.updatePlayerPosition(data.id, data.position, data.rotation);
            if (data.health !== undefined) {
                playerManager.updatePlayerHealth(data.id, data.health);
            }
        }
    });

    networkManager.on('player-fired', (data) => {
        if (data.id !== networkManager.getPlayerId()) {
            playerManager.showMuzzleFlash(data.id);
        }
    });

    // Initialize Damage System
    window.damageSystem = new DamageSystem(scene, camera, playerManager, networkManager);

    // Listen for local damage events dispatched by DamageSystem
    document.addEventListener('local-player-damaged', (e) => {
        const damage = e.detail.damage || 0;
        const serverHealth = e.detail.serverHealth;
        const serverArmor = e.detail.serverArmor;

        // 1. Force Local Update (Client Prediction) for immediate feedback
        // This ensures the UI *always* reacts instantly to the red flash.
        let predictedArmor = playerArmor;
        let predictedHealth = playerHealth;
        let actualDamage = damage;

        if (isNaN(predictedArmor)) predictedArmor = MAX_ARMOR;

        // Armor absorbs damage first
        if (predictedArmor > 0) {
            const absorbed = Math.min(predictedArmor, damage);
            predictedArmor -= absorbed;
            actualDamage -= absorbed;
        }

        // Remaining damage hits health
        if (actualDamage > 0) {
            predictedHealth = Math.max(0, predictedHealth - actualDamage);
        }

        // Apply prediction immediately
        playerArmor = predictedArmor;
        playerHealth = predictedHealth;
        updateArmorUI();
        updateHealthUI();

        // Sync with Server ONLY if server is properly tracking armor
        // If serverArmor is null/undefined, server is outdated - trust local prediction
        const serverProvidedArmor = typeof serverArmor === 'number';
        const serverProvidedHealth = typeof serverHealth === 'number';

        if (serverProvidedArmor && serverProvidedHealth) {
            // Server is tracking armor correctly - sync with it
            const diffHealth = Math.abs(playerHealth - serverHealth);
            const diffArmor = Math.abs(playerArmor - serverArmor);

            if (diffHealth > 1 || diffArmor > 1) {
                playerHealth = serverHealth;
                playerArmor = serverArmor;
                updateHealthUI();
                updateArmorUI();
            }
        }
        // If server doesn't provide armor, we trust local prediction (already applied above)
    });

    document.addEventListener('local-player-killed', (e) => {
        console.log("💀 YOU DIED");
        playerHealth = 0;
        playerArmor = 0;
        updateHealthUI();
        updateArmorUI();
    });

    document.addEventListener('local-player-respawn', () => {
        console.log("♻️ Respawing: Resetting Health/Armor");
        respawnPlayer();
    });
    // When disconnected
    networkManager.on('disconnected', () => {
        console.log('🔌 Disconnected from server');
        multiplayerEnabled = false;
        updateMultiplayerStatus();
    });
}


function updateMultiplayerStatus() {
    const mpStatus = document.getElementById('mp-status');
    if (!mpStatus) return;

    if (multiplayerEnabled && networkManager && networkManager.isConnected()) {
        const playerCount = networkManager.getRemotePlayers().length + 1;
        mpStatus.innerText = `ONLINE (${playerCount})`;
        mpStatus.style.color = '#0f0';
    } else {
        mpStatus.innerText = 'OFFLINE';
        mpStatus.style.color = '#888';
    }
}

init();
