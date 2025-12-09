import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CollisionManager } from '../core/collisions.js';

// Lookout tower configuration
const LOOKOUT_PATH = 'extras/tower/wooden watch tower2.fbx';
const LOOKOUT_TEXTURE_PATH = 'extras/tower/textures/Wood_Tower_Col.jpg';
const LOOKOUT_NORMAL_PATH = 'extras/tower/textures/Wood_Tower_Nor.jpg';
const LOOKOUT_POSITION = { x: -181.8, y: 15.7, z: 124.9 };
const LOOKOUT_SCALE = 0.05; // Adjust if needed

// Collision vertical offset - adjust this if collisions don't align with the model
// Positive = move collisions UP, Negative = move collisions DOWN
const COLLISION_Y_OFFSET = 5; // Tweak this value to align collisions with the tower

// Debug: Set to true to see collision boxes as semi-transparent shapes
const SHOW_DEBUG_COLLISIONS = true;

// Collision shapes for the lookout tower (relative to LOOKOUT_POSITION)
// These define walkable floors, stairs, and blocking walls
// Generated with collision-editor.html
const LOOKOUT_COLLISIONS = [
    {
        type: 'box',
        offset: { x: 6, y: 0, z: 6 },
        size: { width: 0.5, height: 38, depth: 0.5 },
        name: 'box_3',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -6, y: 0, z: 6 },
        size: { width: 0.5, height: 38, depth: 0.5 },
        name: 'box_4',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -6, y: 0, z: -6 },
        size: { width: 0.5, height: 38, depth: 0.5 },
        name: 'box_5',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 6, y: 0, z: -6 },
        size: { width: 0.5, height: 38, depth: 0.5 },
        name: 'box_6',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 8.5, y: 0, z: 8.5 },
        size: { width: 1, height: 38, depth: 1 },
        name: 'box_7',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 8.5, y: 0, z: -8.5 },
        size: { width: 1, height: 38, depth: 1 },
        name: 'box_8',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -8.5, y: 0, z: 8.5 },
        size: { width: 1, height: 38, depth: 1 },
        name: 'box_9',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -8.5, y: 0, z: -8.5 },
        size: { width: 1, height: 38, depth: 1 },
        name: 'box_10',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 8.5, y: 29, z: 1.5 },
        size: { width: 0.5, height: 2, depth: 14 },
        name: 'box_11',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -8.5, y: 29, z: 0 },
        size: { width: 0.5, height: 2, depth: 16 },
        name: 'box_12',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 0, y: 29, z: 8.5 },
        size: { width: 16, height: 2, depth: 0.5 },
        name: 'box_13',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 1.5, y: 29, z: -5.5 },
        size: { width: 14.5, height: 2, depth: 0.5 },
        name: 'box_14',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -5.5, y: 29, z: 4 },
        size: { width: 0.5, height: 9, depth: 4 },
        name: 'box_15',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: -5.5, y: 29, z: -4 },
        size: { width: 0.5, height: 9, depth: 4 },
        name: 'box_16',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 5.5, y: 29, z: -4 },
        size: { width: 0.5, height: 9, depth: 4 },
        name: 'box_17',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 5.5, y: 29, z: 4 },
        size: { width: 0.5, height: 9, depth: 4 },
        name: 'box_18',
        color: 0xff0000
    },
    {
        type: 'box',
        offset: { x: 0, y: 38, z: 0 },
        size: { width: 21, height: 0.5, depth: 21 },
        name: 'box_19',
        color: 0x00ff00
    },
    {
        type: 'box',
        offset: { x: 0, y: 29, z: 1.5 },
        size: { width: 18, height: 0.5, depth: 15 },
        name: 'box_20',
        color: 0x00ff00
    },
    {
        type: 'box',
        offset: { x: -1, y: 0, z: -7 },
        size: { width: 1, height: 0.5, depth: 3.5 },
        name: 'stairs_1',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -2, y: 0.5, z: -7 },
        size: { width: 1, height: 0.5, depth: 3.5 },
        name: 'stairs_2',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -3, y: 1, z: -7 },
        size: { width: 1, height: 0.5, depth: 3.5 },
        name: 'stairs_3',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -4, y: 1.5, z: -7 },
        size: { width: 1, height: 0.5, depth: 3.5 },
        name: 'stairs_4',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -5, y: 2, z: -7 },
        size: { width: 1, height: 0.5, depth: 3.5 },
        name: 'stairs_5',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 2.5, z: -7 },
        size: { width: 4, height: 0.5, depth: 3.5 },
        name: 'stairs_landing_1',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 3.5, z: -4 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_6',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 3, z: -5 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_7',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 4, z: -3 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_8',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 4.5, z: -2 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_9',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 5, z: -1 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_10',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 6, z: 1 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_11',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 5.5, z: 0 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_12',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 6.5, z: 2 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_13',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 7, z: 3 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_14',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 7.5, z: 4 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_15',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 8, z: 5 },
        size: { width: 4, height: 0.5, depth: 1 },
        name: 'stairs_16',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 8.5, z: 7.5 },
        size: { width: 4, height: 0.5, depth: 4 },
        name: 'stairs_landing_2',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 7.5, y: 15.5, z: 7.5 },
        size: { width: 4, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_mirrorX',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 7.5, y: 22, z: -7.5 },
        size: { width: 4, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_mirrorX_mirrorZ',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -7.5, y: 28.5, z: -7.5 },
        size: { width: 4, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_mirrorX_mirrorZ_mirrorX',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -5, y: 9, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -4, y: 9.5, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -3, y: 10, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -2, y: 10.5, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: -1, y: 11, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 0, y: 11.5, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 1, y: 12, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 2, y: 12.5, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 3, y: 13, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 4, y: 13.5, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy_copy_copy_copy_copy_copy',
        color: 0xffff00
    },
    {
        type: 'box',
        offset: { x: 5, y: 14, z: 7.5 },
        size: { width: 1, height: 0.5, depth: 4 },
        name: 'stairs_landing_2_copy_copy_copy_copy_copy_copy_copy_copy_copy_copy_copy',
        color: 0xffff00
    }
];

let loadedLookout = null;
let debugMeshes = []; // Store debug meshes for cleanup

/**
 * Preload the lookout tower asset
 */
export async function preloadLookout() {
    console.log('🏗️ [Lookout] Preloading asset...');

    const textureLoader = new THREE.TextureLoader();
    const fbxLoader = new FBXLoader();
    fbxLoader.setResourcePath('extras/tower/textures/'); // ensure FBX texture lookups hit the textures folder

    return new Promise((resolve) => {
        // Load textures
        Promise.all([
            new Promise(r => textureLoader.load(LOOKOUT_TEXTURE_PATH, r, undefined, () => r(null))),
            new Promise(r => textureLoader.load(LOOKOUT_NORMAL_PATH, r, undefined, () => r(null)))
        ]).then(([colorTexture, normalTexture]) => {
            if (colorTexture) {
                colorTexture.colorSpace = THREE.SRGBColorSpace;
            }

            fbxLoader.load(LOOKOUT_PATH, (object) => {
                object.scale.setScalar(LOOKOUT_SCALE);

                // Debug: log what we got
                console.log('🏗️ [Lookout] Loaded object:', object);

                object.traverse((child) => {
                    if (child.isMesh) {
                        console.log('🏗️ [Lookout] Found mesh:', child.name);
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material) {
                            const applyTextures = (mat) => {
                                if (colorTexture) mat.map = colorTexture;
                                if (normalTexture) mat.normalMap = normalTexture;
                                mat.side = THREE.DoubleSide;
                                mat.needsUpdate = true;
                            };

                            if (Array.isArray(child.material)) {
                                child.material.forEach(applyTextures);
                            } else {
                                applyTextures(child.material);
                            }
                        }
                    }
                });

                // Debug bounding box
                const box = new THREE.Box3().setFromObject(object);
                const size = new THREE.Vector3();
                box.getSize(size);
                console.log('🏗️ [Lookout] Bounding box size:', size);

                loadedLookout = object;
                console.log('✅ [Lookout] Preload complete.');
                resolve(object);
            }, undefined, (err) => {
                console.warn('⚠️ Failed to load Lookout:', err);
                resolve(null);
            });
        });
    });
}

/**
 * Create a debug visualization mesh for a collision shape
 */
function createDebugMesh(collisionDef, worldPos) {
    let geometry;

    if (collisionDef.type === 'box') {
        geometry = new THREE.BoxGeometry(
            collisionDef.size.width,
            collisionDef.size.height,
            collisionDef.size.depth
        );
    } else if (collisionDef.type === 'cylinder') {
        geometry = new THREE.CylinderGeometry(
            collisionDef.size.radius,
            collisionDef.size.radius,
            collisionDef.size.height,
            16
        );
    }

    // Use bright emissive material that renders on top of everything
    const material = new THREE.MeshBasicMaterial({
        color: collisionDef.color || 0x00ff00,
        transparent: true,
        opacity: 0.6,
        depthTest: false,  // Always visible on top
        depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 999;  // Render last (on top)

    // Position at world coordinates
    mesh.position.set(
        worldPos.x + collisionDef.offset.x,
        worldPos.y + collisionDef.offset.y + COLLISION_Y_OFFSET + (collisionDef.size.height / 2),
        worldPos.z + collisionDef.offset.z
    );

    // Add bright wireframe overlay
    const wireframeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        depthTest: false,
        depthWrite: false
    });
    const wireframe = new THREE.Mesh(geometry.clone(), wireframeMat);
    wireframe.position.copy(mesh.position);
    wireframe.renderOrder = 1000;

    console.log(`🔍 [Debug] Created mesh at: ${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)}`);

    return { solid: mesh, wireframe };
}

/**
 * Create the lookout tower in the scene
 */
export function createLookout(scene) {
    if (!loadedLookout) {
        console.warn('⚠️ [Lookout] No asset loaded. Did you call preloadLookout()?');
        return null;
    }

    console.log('🏗️ [Lookout] Placing tower...');

    const lookout = loadedLookout.clone();
    lookout.position.set(LOOKOUT_POSITION.x, LOOKOUT_POSITION.y, LOOKOUT_POSITION.z);
    scene.add(lookout);

    // Force update matrix before calculating bounding box
    lookout.updateMatrixWorld(true);

    // Get bounding box for reference
    const box = new THREE.Box3().setFromObject(lookout);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    console.log('🏗️ [Lookout] Bounding box size:', size, 'Center:', center);
    console.log('🏗️ [Lookout] Adding', LOOKOUT_COLLISIONS.length, 'collision shapes...');

    // Add collision shapes
    LOOKOUT_COLLISIONS.forEach((collisionDef, index) => {
        const worldX = LOOKOUT_POSITION.x + collisionDef.offset.x;
        const worldY = LOOKOUT_POSITION.y + collisionDef.offset.y + COLLISION_Y_OFFSET;
        const worldZ = LOOKOUT_POSITION.z + collisionDef.offset.z;

        if (collisionDef.type === 'box') {
            CollisionManager.addBox({
                name: `lookout_${collisionDef.name}`,
                centerX: worldX,
                centerZ: worldZ,
                width: collisionDef.size.width,
                depth: collisionDef.size.depth,
                height: collisionDef.size.height,
                baseY: worldY
            });
        } else if (collisionDef.type === 'cylinder') {
            CollisionManager.addCylinder({
                name: `lookout_${collisionDef.name}`,
                x: worldX,
                z: worldZ,
                radius: collisionDef.size.radius,
                height: collisionDef.size.height,
                baseY: worldY
            });
        }

        console.log(`🏗️ [Lookout] Added collision: ${collisionDef.name} at (${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ.toFixed(1)})`);

        // Create debug visualization
        if (SHOW_DEBUG_COLLISIONS) {
            const debugMesh = createDebugMesh(collisionDef, LOOKOUT_POSITION);
            scene.add(debugMesh.solid);
            scene.add(debugMesh.wireframe);
            debugMeshes.push(debugMesh.solid, debugMesh.wireframe);
        }
    });

    if (SHOW_DEBUG_COLLISIONS) {
        console.log('🔍 [Lookout] Debug collision meshes visible - set SHOW_DEBUG_COLLISIONS to false to hide');
    }

    console.log(`🏗️ [Lookout] Placed at (${LOOKOUT_POSITION.x}, ${LOOKOUT_POSITION.y}, ${LOOKOUT_POSITION.z})`);

    return lookout;
}

/**
 * Remove debug meshes (call if you want to hide them at runtime)
 */
export function hideDebugCollisions(scene) {
    debugMeshes.forEach(mesh => scene.remove(mesh));
    debugMeshes = [];
    console.log('🔍 [Lookout] Debug collision meshes hidden');
}

