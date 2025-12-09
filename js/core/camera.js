/**
 * Camera Module - Unified camera control for FPS game
 * Handles camera state, look controls, FOV transitions, and camera sync
 */

import * as THREE from 'three';
import { setMotionFovScale } from '../input/motion.js';

// --- Camera State ---
let camera = null;
let gunCamera = null;
let pitch = 0;
let yaw = 0;

// Landing recovery state - ONLY for pitch (front/backflips)
let isLandingRecovery = false;
let targetRecoveryPitch = 0;

// Look speed (can be modified by settings)
let currentLookSpeedH = 2.0;
let currentLookSpeedV = 2.0;

/**
 * Initialize the camera system
 * @param {object} config - Configuration object with view settings
 * @returns {{camera: THREE.PerspectiveCamera, gunCamera: THREE.PerspectiveCamera}}
 */
export function initCamera(config) {
    const baseFov = config.view?.baseFov || 75;
    const baseHeight = config.physics?.baseHeight || 1.6;

    // Main world camera
    camera = new THREE.PerspectiveCamera(baseFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = baseHeight;
    camera.position.z = 5;

    // Gun scene camera (synced to main camera)
    gunCamera = new THREE.PerspectiveCamera(baseFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    gunCamera.position.y = baseHeight;
    gunCamera.position.z = 5;

    // Initialize yaw/pitch from camera quaternion
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    yaw = euler.y;
    pitch = euler.x;

    // Set initial look speeds from config
    currentLookSpeedH = config.look?.baseH || 2.0;
    currentLookSpeedV = config.look?.baseV || 2.0;

    return { camera, gunCamera };
}

/**
 * Get the main camera
 * @returns {THREE.PerspectiveCamera}
 */
export function getCamera() {
    return camera;
}

/**
 * Get the gun camera
 * @returns {THREE.PerspectiveCamera}
 */
export function getGunCamera() {
    return gunCamera;
}

/**
 * Get current pitch angle
 * @returns {number}
 */
export function getPitch() {
    return pitch;
}

/**
 * Get current yaw angle
 * @returns {number}
 */
export function getYaw() {
    return yaw;
}

/**
 * Set look speeds (called from settings)
 * @param {number} h - Horizontal look speed
 * @param {number} v - Vertical look speed
 */
export function setLookSpeeds(h, v) {
    if (h !== undefined) currentLookSpeedH = h;
    if (v !== undefined) currentLookSpeedV = v;
}

/**
 * Check if camera is in landing recovery mode
 * @returns {boolean}
 */
export function isInLandingRecovery() {
    return isLandingRecovery;
}

/**
 * Start landing recovery (called when landing from a flip)
 * @param {number} currentPitch - Current pitch value
 */
export function startLandingRecovery(currentPitch) {
    const twoPi = Math.PI * 2;
    if (currentPitch > 0) {
        targetRecoveryPitch = Math.ceil(currentPitch / twoPi) * twoPi;
    } else {
        targetRecoveryPitch = Math.floor(currentPitch / twoPi) * twoPi;
    }
    isLandingRecovery = true;
    console.log(`🛬 Flip recovery (Roll Out): ${(currentPitch * 180 / Math.PI).toFixed(0)}° → ${(targetRecoveryPitch * 180 / Math.PI).toFixed(0)}°`);
}

/**
 * Update camera look based on input
 * @param {object} input - Input state with lookX, lookY
 * @param {number} delta - Frame delta time
 * @param {object} config - Config with look settings
 * @param {boolean} isGrounded - Whether player is on ground
 */
export function updateLook(input, delta, config, isGrounded) {
    // Run if there is input OR if we are in the middle of a recovery animation
    if (input.lookX === 0 && input.lookY === 0 && !isLandingRecovery) return;

    // FOV scaling: reduce sensitivity proportionally when zoomed in
    const baseFovRad = (config.view.baseFov * Math.PI) / 360;
    const currentFovRad = (camera.fov * Math.PI) / 360;
    const rawFovScale = Math.tan(currentFovRad) / Math.tan(baseFovRad);

    // Apply FOV scaling with enabled toggle and strength blending
    let fovScale = 1.0;
    if (config.look.fovScaleSticks) {
        fovScale = 1.0 + (rawFovScale - 1.0) * config.look.fovScaleSticksStrength;
    }

    // Update motion module with the raw FOV scale
    setMotionFovScale(rawFovScale);

    // === FLIP RECOVERY ===
    if (isLandingRecovery) {
        pitch = THREE.MathUtils.lerp(pitch, targetRecoveryPitch, 5.0 * delta);

        if (Math.abs(pitch - targetRecoveryPitch) < 0.05) {
            pitch = 0;
            isLandingRecovery = false;
            console.log('✅ Flip recovery complete');
        }

        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
        return;
    }

    // Update yaw
    yaw -= input.lookX * currentLookSpeedH * fovScale * delta;

    const invertY = document.getElementById('invert-look')?.checked ? -1 : 1;

    // Faster pitch control in air for flips
    const airMult = isGrounded ? 1.0 : config.look.airMultiplier;

    pitch -= input.lookY * currentLookSpeedV * fovScale * delta * invertY * airMult;

    // Only clamp pitch when grounded
    if (isGrounded) {
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

/**
 * Update camera FOV for ADS transitions
 * @param {number} delta - Frame delta time
 * @param {object} config - Config with view settings
 * @param {boolean} isADS - Whether aiming down sights
 * @param {object} currentWeaponData - Current weapon stats (needs zoomFOV)
 */
export function updateCameraFov(delta, config, isADS, currentWeaponData) {
    const targetFOV = isADS ? currentWeaponData.zoomFOV : config.view.baseFov;
    if (Math.abs(camera.fov - targetFOV) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, config.view.adsTransitionSpeed * delta);
        camera.updateProjectionMatrix();

        gunCamera.fov = camera.fov;
        gunCamera.updateProjectionMatrix();
    }
}

/**
 * Sync gun camera to main camera (call every frame)
 */
export function syncGunCamera() {
    if (camera && gunCamera) {
        gunCamera.position.copy(camera.position);
        gunCamera.quaternion.copy(camera.quaternion);
    }
}

/**
 * Handle window resize
 */
export function onCameraResize() {
    if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    if (gunCamera) {
        gunCamera.aspect = window.innerWidth / window.innerHeight;
        gunCamera.updateProjectionMatrix();
    }
}

/**
 * Set pitch value directly (for external control)
 * @param {number} value
 */
export function setPitch(value) {
    pitch = value;
}

/**
 * Set yaw value directly (for external control)
 * @param {number} value
 */
export function setYaw(value) {
    yaw = value;
}

/**
 * Apply recoil to camera (modifies pitch/yaw and updates immediately)
 * @param {number} pitchAmount - Amount to add to pitch (usually positive for up)
 * @param {number} yawAmount - Amount to add to yaw
 */
export function applyRecoil(pitchAmount, yawAmount = 0) {
    pitch += pitchAmount;
    yaw += yawAmount;

    if (camera) {
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
    }
}
