import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CollisionManager } from '../core/collisions.js';

// Tower configuration
const TOWER_PATH = 'extras/tower/tower.fbx';
const TOWER_TEXTURE_PATH = 'extras/tower/TowerTexture.png';
const TOWER_POSITION = { x: 179.5, y: 24.7, z: 181.1 };
const TOWER_SCALE = 0.1; // Adjust if needed

// Fence configuration - Add more positions to extend the fence
const FENCE_PATH = 'extras/fence/fence.fbx';
const FENCE_TEXTURE_PATH = 'extras/fence/fence_composite01.png';
const FENCE_ALPHA_PATH = 'extras/fence/fence_alpha.png';
const FENCE_POSITIONS = [
    { x: 200, y: 24.7, z: 180 },      // First fence segment
    { x: 200, y: 24.7, z: 186.1 },
    { x: 200, y: 24.7, z: 192.2 },

    { x: 160, y: 24.7, z: 180 },      // Second fence segment
    { x: 160, y: 24.7, z: 186.1 },
    { x: 160, y: 24.7, z: 192.2 },

];
const FENCE_SCALE = 0.05; // Adjust if needed

let loadedTower = null;
let loadedFence = null;

/**
 * Preload the radio tower asset
 */
export async function preloadRadioTower() {
    console.log('📡 [RadioTower] Preloading assets...');

    const textureLoader = new THREE.TextureLoader();
    const fbxLoader = new FBXLoader();

    // Load tower
    const towerPromise = new Promise((resolve) => {
        textureLoader.load(TOWER_TEXTURE_PATH, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;

            fbxLoader.load(TOWER_PATH, (object) => {
                object.scale.setScalar(TOWER_SCALE);

                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material) {
                            const applyMaterial = (mat) => {
                                mat.map = texture;
                                mat.needsUpdate = true;
                            };

                            if (Array.isArray(child.material)) {
                                child.material.forEach(applyMaterial);
                            } else {
                                applyMaterial(child.material);
                            }
                        }
                    }
                });

                loadedTower = object;
                console.log('✅ [RadioTower] Tower preload complete.');
                resolve(object);
            }, undefined, (err) => {
                console.warn('⚠️ Failed to load Radio Tower:', err);
                resolve(null);
            });
        }, undefined, (err) => {
            console.warn('⚠️ Failed to load Radio Tower texture:', err);
            resolve(null);
        });
    });

    // Load fence
    const fencePromise = new Promise((resolve) => {
        fbxLoader.load(FENCE_PATH, (object) => {
            object.scale.setScalar(FENCE_SCALE);

            // Debug: log what we got
            console.log('🚧 [Fence] Loaded object:', object);

            object.traverse((child) => {
                if (child.isMesh) {
                    console.log('🚧 [Fence] Found mesh:', child.name, 'Material:', child.material);
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Keep the FBX's embedded materials but ensure they render properly
                    if (child.material) {
                        const fixMaterial = (mat) => {
                            mat.side = THREE.DoubleSide;
                            mat.transparent = true;
                            mat.alphaTest = 0.5;
                            mat.depthWrite = true;
                            mat.needsUpdate = true;
                            console.log('🚧 [Fence] Material fixed:', mat.name, 'Has map:', !!mat.map);
                        };

                        if (Array.isArray(child.material)) {
                            child.material.forEach(fixMaterial);
                        } else {
                            fixMaterial(child.material);
                        }
                    }
                }
            });

            // Debug bounding box
            const box = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            box.getSize(size);
            console.log('🚧 [Fence] Bounding box size:', size);

            loadedFence = object;
            console.log('✅ [RadioTower] Fence preload complete.');
            resolve(object);
        }, undefined, (err) => {
            console.warn('⚠️ Failed to load Fence:', err);
            resolve(null);
        });
    });

    await Promise.all([towerPromise, fencePromise]);
    console.log('✅ [RadioTower] All assets preloaded.');
}

/**
 * Create the radio tower and fence in the scene
 */
export function createRadioTower(scene) {
    const results = { tower: null, fence: null };

    // Place tower
    if (loadedTower) {
        console.log('📡 [RadioTower] Placing tower...');

        const tower = loadedTower.clone();
        tower.position.set(TOWER_POSITION.x, TOWER_POSITION.y, TOWER_POSITION.z);
        scene.add(tower);

        // Force update matrix before calculating bounding box
        tower.updateMatrixWorld(true);

        // Get bounding box for collision
        const box = new THREE.Box3().setFromObject(tower);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        console.log('📡 [Tower] Bounding box size:', size, 'Center:', center);

        // Add collision cylinder for the tower base
        // Use a reasonable collision radius based on actual size
        const collisionRadius = Math.max(size.x, size.z) * 0.5;
        CollisionManager.addCylinder({
            name: 'radiotower_base',
            x: center.x,
            z: center.z,
            radius: Math.max(collisionRadius, 1), // Minimum 1 unit radius
            height: size.y,
            baseY: box.min.y
        });

        console.log(`📡 [Tower] Collision: radius=${Math.max(collisionRadius, 1).toFixed(2)}, height=${size.y.toFixed(2)}, baseY=${box.min.y.toFixed(2)}`);
        results.tower = tower;
    } else {
        console.warn('⚠️ [RadioTower] No tower asset loaded. Did you call preloadRadioTower()?');
    }

    // Place fences
    if (loadedFence) {
        console.log(`🚧 [RadioTower] Placing ${FENCE_POSITIONS.length} fence segment(s)...`);
        results.fences = [];

        FENCE_POSITIONS.forEach((pos, index) => {
            const fence = loadedFence.clone();
            fence.position.set(pos.x, pos.y, pos.z);
            scene.add(fence);

            // Force update matrix before calculating bounding box
            fence.updateMatrixWorld(true);

            // Get bounding box for collision
            const fenceBox = new THREE.Box3().setFromObject(fence);
            const fenceSize = new THREE.Vector3();
            const fenceCenter = new THREE.Vector3();
            fenceBox.getSize(fenceSize);
            fenceBox.getCenter(fenceCenter);

            // Use box collider for fence
            CollisionManager.addBox({
                name: `radiotower_fence_${index}`,
                centerX: fenceCenter.x,
                centerZ: fenceCenter.z,
                width: Math.max(fenceSize.x, 1),
                depth: Math.max(fenceSize.z, 1),
                height: fenceSize.y,
                baseY: fenceBox.min.y
            });

            console.log(`🚧 [Fence ${index}] Placed at (${pos.x}, ${pos.y}, ${pos.z})`);
            results.fences.push(fence);
        });
    } else {
        console.warn('⚠️ [RadioTower] No fence asset loaded.');
    }

    return results;
}

