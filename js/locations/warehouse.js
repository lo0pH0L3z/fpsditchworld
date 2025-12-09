import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CollisionManager } from '../core/collisions.js';

// Warehouse configuration
const WAREHOUSE_PATH = 'extras/old_warehouse/old_warehouse01_upgrade.fbx';
const WAREHOUSE_POSITION = { x: 152.06, y: -3.00, z: 23.70 };
const WAREHOUSE_ROTATION = { x: 0.0, y: -79.2, z: 0.0 };
const WAREHOUSE_SCALE = .05; // Larger scale - FBX units vary

// Texture paths - map material names to textures
const TEXTURE_BASE = 'extras/old_warehouse/';
const TEXTURES = {
    main: 'old_warehouse01_upgrade.jpg',
    upgrade: 'upgrade.jpg',
    upgrade1: 'upgrade1.jpg',
    metalPlates: 'MetalPlates.jpg',
    metalRollup: 'MetalRollup.jpg',
    rustMetal: 'rustmetal.jpg',
    rustyMetal: 'rusty-metal-texture_COLOR.png',
    window: 'window_wit_holes01.png',
    window2: 'window_wit_holes_part02.png'
};

let loadedWarehouse = null;
let loadedTextures = {};

/**
 * Preload the warehouse asset
 */
export async function preloadWarehouse() {
    console.log('🏭 [Warehouse] Preloading assets...');

    const textureLoader = new THREE.TextureLoader();
    const fbxLoader = new FBXLoader();
    fbxLoader.setResourcePath(TEXTURE_BASE);
    // Remap missing FBX references (e.g., "Image") to a known texture to avoid 404 spam
    const fallbackTexture = TEXTURE_BASE + TEXTURES.metalPlates;
    fbxLoader.manager.setURLModifier((url) => {
        if (url.endsWith('/Image') || url.endsWith('\\Image') || url === 'Image') {
            return fallbackTexture;
        }
        return url;
    });

    // Load all textures first
    const texturePromises = Object.entries(TEXTURES).map(([key, filename]) => {
        return new Promise((resolve) => {
            textureLoader.load(
                TEXTURE_BASE + filename,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    loadedTextures[key] = texture;
                    console.log(`🏭 [Warehouse] Loaded texture: ${filename}`);
                    resolve(texture);
                },
                undefined,
                (err) => {
                    console.warn(`⚠️ [Warehouse] Failed to load texture ${filename}:`, err);
                    resolve(null);
                }
            );
        });
    });

    await Promise.all(texturePromises);
    console.log('🏭 [Warehouse] All textures loaded:', Object.keys(loadedTextures));

    return new Promise((resolve) => {
        fbxLoader.load(WAREHOUSE_PATH, (object) => {
            console.log('🏭 [Warehouse] Loaded FBX object:', object);

            object.scale.setScalar(WAREHOUSE_SCALE);

            object.traverse((child) => {
                if (child.isMesh) {
                    console.log('🏭 [Warehouse] Found mesh:', child.name, 'Material:', child.material);
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Apply textures to materials
                    if (child.material) {
                        const applyTexture = (mat) => {
                            const matName = (mat.name || '').toLowerCase();
                            console.log('🏭 [Warehouse] Processing material:', mat.name);

                            // Try to match material name to texture
                            let texture = null;

                            if (matName.includes('metal') && matName.includes('plate')) {
                                texture = loadedTextures.metalPlates;
                            } else if (matName.includes('rollup') || matName.includes('door')) {
                                texture = loadedTextures.metalRollup;
                            } else if (matName.includes('rust')) {
                                texture = loadedTextures.rustMetal || loadedTextures.rustyMetal;
                            } else if (matName.includes('window')) {
                                texture = loadedTextures.window;
                            } else if (matName.includes('upgrade')) {
                                texture = loadedTextures.upgrade;
                            } else {
                                // Default to metal plates as requested
                                texture = loadedTextures.metalPlates;
                            }

                            if (texture) {
                                mat.map = texture;
                                console.log(`🏭 [Warehouse] Applied texture to ${mat.name}`);
                            }

                            // Ensure material renders properly
                            mat.side = THREE.DoubleSide;
                            mat.needsUpdate = true;
                        };

                        if (Array.isArray(child.material)) {
                            child.material.forEach(applyTexture);
                        } else {
                            applyTexture(child.material);
                        }
                    }
                }
            });

            // Debug bounding box
            const box = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            box.getSize(size);
            console.log('🏭 [Warehouse] Bounding box size:', size);

            loadedWarehouse = object;
            console.log('✅ [Warehouse] Preload complete.');
            resolve(object);
        },
            (progress) => {
                if (progress.total > 0) {
                    console.log('🏭 [Warehouse] Loading progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
                }
            },
            (err) => {
                console.error('❌ [Warehouse] Failed to load:', err);
                resolve(null);
            });
    });
}


/**
 * Create the warehouse in the scene
 */
export function createWarehouse(scene) {
    if (!loadedWarehouse) {
        console.warn('⚠️ [Warehouse] No warehouse asset loaded. Did you call preloadWarehouse()?');
        return null;
    }

    console.log('🏭 [Warehouse] Placing warehouse at', WAREHOUSE_POSITION);

    const warehouse = loadedWarehouse.clone();
    warehouse.position.set(WAREHOUSE_POSITION.x, WAREHOUSE_POSITION.y, WAREHOUSE_POSITION.z);

    // Apply rotation (degrees to radians)
    warehouse.rotation.set(
        THREE.MathUtils.degToRad(WAREHOUSE_ROTATION.x),
        THREE.MathUtils.degToRad(WAREHOUSE_ROTATION.y),
        THREE.MathUtils.degToRad(WAREHOUSE_ROTATION.z)
    );

    scene.add(warehouse);

    // Force update matrix before calculating bounding box
    warehouse.updateMatrixWorld(true);

    // Generate collisions for each mesh part
    let colliderCount = 0;
    warehouse.traverse((child) => {
        if (child.isMesh) {
            // Get world bounding box for this specific mesh
            const box = new THREE.Box3().setFromObject(child);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            // Skip very small meshes (optional optimization)
            if (size.x < 0.1 && size.z < 0.1) return;

            CollisionManager.addBox({
                name: `warehouse_${child.name}_${colliderCount++}`,
                centerX: center.x,
                centerZ: center.z,
                width: size.x,
                depth: size.z,
                height: size.y,
                baseY: box.min.y
            });
        }
    });

    console.log(`🏭 [Warehouse] Added ${colliderCount} collision boxes.`);

    return warehouse;
}
