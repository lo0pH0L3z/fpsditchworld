import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { getTerrainHeight } from './mountains.js';
import { CollisionManager } from '../core/collisions.js';

// Tree 1 (FBX)
const TREE1_PATH = 'assets/trees/tree1/Tree.fbx';
const TREE1_SCALE = 10; // ~9m tall

// Tree 2 (OBJ)
const TREE2_PATH_OBJ = 'assets/trees/tree2/Tree.obj';
const TREE2_PATH_MTL = 'assets/trees/tree2/Tree.mtl';

let loadedAssets = {
    tree1: null,
    tree2: null
};

// --- Deterministic RNG ---
// Simple seeded random number generator (Linear Congruential Generator)
// Ensures trees spawn in the exact same place every time.
class RNG {
    constructor(seed) {
        this.seed = seed;
    }
    // Returns number between 0 and 1
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    // Returns number between min and max
    range(min, max) {
        return min + this.next() * (max - min);
    }
}
const rng = new RNG(12345); // Fixed seed

// --- Fixed Tree Clusters ---
// Define "bunches" of trees with fixed central coordinates
const TREE_CLUSTERS = [
    { x: 80, z: 80, radius: 25, count: 2 },   // North East Grove
    { x: -80, z: 80, radius: 30, count: 1 },  // North West Grove
    { x: 80, z: -80, radius: 30, count: 7 },  // South East Grove
    { x: -80, z: -80, radius: 25, count: 3 }, // South West Grove
    { x: 0, z: 130, radius: 40, count: 1 },   // Far North Forest
    { x: 0, z: -270, radius: 180, count: 40 },  // Far South Forest aka behind CINEMA
    { x: 150, z: 0, radius: 40, count: 2 }    // Far East Forest
    // Center (0,0) is kept clear by design (no clusters there)
];

function loadTree1() {
    return new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        loader.load(TREE1_PATH, (object) => {
            object.scale.setScalar(TREE1_SCALE);
            object.userData.collisionRadius = 0.5; // Default radius for ~9m tree
            object.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        const applyMaterialFix = (m) => {
                            // Removing conflicting maps to fix "outline" issue
                            // console.log(`🌲 [Tree1] Fixing Mat: ${m.name}`);

                            m.side = THREE.DoubleSide;

                            // DISCONNECT POTENTIALLY BROKEN MAPS
                            // The user logs showed AlphaMap: YES and SpecularMap: YES.
                            // One of these is likely causing the "invisible" or "outline only" look.
                            // We force them off to rely on the main Diffuse Map.
                            m.alphaMap = null;
                            m.specularMap = null;

                            // RESET to reliable Cutout settings:
                            m.transparent = false;
                            m.alphaTest = 0.5; // Standard threshold

                            // REMOVE SHINE/SPECULAR
                            if (m.specular) m.specular.setHex(0x000000);
                            if (m.shininess) m.shininess = 0;

                            // FORCE COLOR
                            if (m.color) m.color.setHex(0xffffff);

                            m.needsUpdate = true;
                        };

                        if (Array.isArray(child.material)) {
                            child.material.forEach(applyMaterialFix);
                        } else {
                            applyMaterialFix(child.material);
                        }
                    }
                }
            });
            loadedAssets.tree1 = object;
            resolve(object);
        }, undefined, (err) => {
            console.warn('⚠️ Failed to load Tree 1:', err);
            resolve(null);
        });
    });
}

function loadTree2() {
    return new Promise((resolve, reject) => {
        const mtlLoader = new MTLLoader();
        mtlLoader.load(TREE2_PATH_MTL, (materials) => {
            materials.preload();
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.load(TREE2_PATH_OBJ, (object) => {
                const box = new THREE.Box3().setFromObject(object);
                const size = new THREE.Vector3();
                box.getSize(size);

                // Auto-scale to ~50m
                const targetHeight = 50.0;
                const scale = size.y > 0 ? targetHeight / size.y : 1.0;
                object.scale.setScalar(scale);

                // Increase collision radius for the massive 50m tree

                object.userData.collisionRadius = 1.5;

                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => {
                                m.side = THREE.DoubleSide;
                                m.transparent = false;
                                m.alphaTest = 0.3;
                            });
                        } else if (child.material) {
                            child.material.side = THREE.DoubleSide;
                            child.material.transparent = false;
                            child.material.alphaTest = 0.3;
                        }
                    }
                });
                loadedAssets.tree2 = object;
                resolve(object);
            }, undefined, (err) => {
                console.warn('⚠️ Failed to load Tree 2 (OBJ):', err);
                resolve(null);
            });
        }, undefined, (err) => {
            console.warn('⚠️ Failed to load Tree 2 (MTL):', err);
            resolve(null);
        });
    });
}

export async function preloadTrees() {
    console.log('🌲 [Trees] Preloading assets...');
    await Promise.all([loadTree1(), loadTree2()]);
    console.log('✅ [Trees] Preload complete.');
}

export function createTrees(scene) {
    const assets = [];
    if (loadedAssets.tree1) assets.push(loadedAssets.tree1);
    if (loadedAssets.tree2) assets.push(loadedAssets.tree2);

    if (assets.length === 0) {
        console.warn('⚠️ [Trees] No assets loaded. Did you call preloadTrees()?');
        return;
    }

    console.log(`🌲 [Trees] Spawning Clusters (Instanced + Chunked + Material Opt)...`);

    let totalPlanted = 0;

    TREE_CLUSTERS.forEach((cluster, index) => {
        // PER-CLUSTER PROCESSING
        // We create a separate batch of InstancedMeshes for EACH cluster.
        // This enables Frustum Culling to work per-cluster (skipping distant/behind clusters entirely).

        // Data bucket for this specific cluster
        // Map<Asset, Matrix4[]>
        const clusterInstanceData = new Map();
        assets.forEach(asset => clusterInstanceData.set(asset, []));

        // Quality Check
        const dist = Math.sqrt(cluster.x * cluster.x + cluster.z * cluster.z);
        // Distant clusters get: No Shadows, Simple Materials (FrontSide only)
        const isLowQuality = dist > 250 || cluster.quality === 'low';

        for (let i = 0; i < cluster.count; i++) {
            const assetIndex = Math.floor(rng.next() * assets.length);
            const template = assets[assetIndex];

            const r = rng.next() * cluster.radius;
            const theta = rng.next() * Math.PI * 2;

            const x = cluster.x + r * Math.cos(theta);
            const z = cluster.z + r * Math.sin(theta);
            const y = getTerrainHeight(x, z);

            const rotY = rng.next() * Math.PI * 2;
            const scaleVar = 0.75 + (rng.next() * 0.5);

            const position = new THREE.Vector3(x, y, z);
            const rotation = new THREE.Euler(0, rotY, 0);
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);
            const scale = new THREE.Vector3(scaleVar, scaleVar, scaleVar);

            const baseScale = template.scale.clone();
            scale.multiply(baseScale);

            const matrix = new THREE.Matrix4().compose(position, quaternion, scale);

            // Add to this cluster's batch
            clusterInstanceData.get(template).push(matrix);

            totalPlanted++;

            // Collision (Global)
            CollisionManager.addCylinder({
                name: `tree_${index}_${i}`,
                x: x,
                z: z,
                radius: (template.userData.collisionRadius || 0.5) * scaleVar,
                height: 10 * scaleVar,
                baseY: y
            });
        }

        // Generate Meshes for THIS Cluster
        clusterInstanceData.forEach((matrices, template) => {
            if (matrices.length > 0) {
                createInstancedMeshesFromTemplate(scene, template, matrices, isLowQuality);
            }
        });
    });

    console.log(`🌲 [Trees] Planted ${totalPlanted} trees in ${TREE_CLUSTERS.length} clusters.`);
}

/**
 * Creates InstancedMesh objects for a given template and list of world matrices.
 * Handles templates that are Groups of multiple Meshes.
 */
function createInstancedMeshesFromTemplate(scene, template, matrices, isLowQuality) {
    const count = matrices.length;

    template.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(template.matrixWorld).invert();

    template.traverse((child) => {
        if (child.isMesh) {
            const offsetMatrix = child.matrixWorld.clone();
            offsetMatrix.premultiply(rootInverse);

            // Material Optimization
            // If Low Quality, use FrontSide only (halves pixel cost) and ensure no transparency quirks.
            // We MUST clone the material to avoid modifying the High Quality trees.
            let material = child.material;
            if (isLowQuality) {
                if (Array.isArray(material)) {
                    material = material.map(m => {
                        const clone = m.clone();
                        clone.side = THREE.FrontSide; // Optimization: Don't render backfaces
                        return clone;
                    });
                } else {
                    material = material.clone();
                    material.side = THREE.FrontSide;
                }
            }

            // Create Instanced Mesh
            const instancedMesh = new THREE.InstancedMesh(child.geometry, material, count);

            // Shadow Optimization
            instancedMesh.castShadow = !isLowQuality;
            instancedMesh.receiveShadow = true;

            for (let i = 0; i < count; i++) {
                const instanceMatrix = matrices[i];
                const finalMatrix = new THREE.Matrix4();
                finalMatrix.multiplyMatrices(instanceMatrix, offsetMatrix);
                instancedMesh.setMatrixAt(i, finalMatrix);
            }

            instancedMesh.instanceMatrix.needsUpdate = true;
            scene.add(instancedMesh);
        }
    });
}
