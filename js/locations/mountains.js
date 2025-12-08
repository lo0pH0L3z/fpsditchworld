import * as THREE from 'three';
import { CollisionManager } from '../core/collisions.js';

// ==========================================
// CONFIGURATION & FEATURES
// ==========================================

// List of mountain features to shape the world
// x, z: Center position
// height: Peak height
// radius: Base radius (how wide it spreads)
// type: 'peak' (sharp), 'dome' (round), or 'mesa' (flat top)
const MOUNTAIN_FEATURES = [
    // Distant mountains to frame the scene (pushed out to ~300-400 range)
    { x: 350, z: 350, height: 50, radius: 500, type: 'peak' },
    { x: -350, z: 350, height: 25, radius: 200, type: 'peak' },
    { x: 350, z: -350, height: 20, radius: 300, type: 'dome' },
    { x: -400, z: -300, height: 110, radius: 500, type: 'peak' },

    // Rolling hills closer to play area (but pushed back from <100 to >150 range)
    { x: 180, z: 180, height: 25, radius: 80, type: 'dome' },
    { x: -180, z: 120, height: 20, radius: 70, type: 'dome' },
    { x: 0, z: -200, height: 20, radius: 80, type: 'mesa' },  // behind cinema
];

// Grid settings for the visual mesh
const GRID_SIZE = 1000; // Expanded to full map size to replace floor
const GRID_SEGMENTS = 28; // Aggressive optimization (128x128 = ~16k polys, extremely fast)

// ==========================================
// MATH FUNCTIONS
// ==========================================

// Cache for the generated terrain heights to ensure physics matches visuals 1:1
let heightMapCache = null;
let meshConfig = {
    halfSize: GRID_SIZE / 1,
    segmentSize: GRID_SIZE / GRID_SEGMENTS,
    segments: GRID_SEGMENTS
};

/**
 * RAW Mathematical height calculation
 * Used ONLY during generation to populate the cache/mesh.
 */
function computeRawHeight(x, z) {
    let y = 0;

    for (const feature of MOUNTAIN_FEATURES) {
        const dx = x - feature.x;
        const dz = z - feature.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > feature.radius) continue;

        const t = dist / feature.radius;
        let influence = 0;

        if (feature.type === 'peak') {
            influence = 0.5 * (1 + Math.cos(Math.PI * t));
            influence = Math.pow(influence, 2);
        } else if (feature.type === 'dome') {
            influence = Math.sqrt(1 - t * t);
        } else if (feature.type === 'mesa') {
            if (t < 0.5) influence = 1;
            else influence = 0.5 * (1 + Math.cos(Math.PI * (t - 0.5) * 2));
        }

        const featureHeight = feature.height * influence;
        y = Math.max(y, featureHeight);
    }
    return y;
}

/**
 * Public physics function: Gets height from the discretised mesh cache.
 * Performs Barycentric/Bilinear interpolation to match the low-poly visual mesh exactly.
 */
export function getTerrainHeight(x, z) {
    if (!heightMapCache) return computeRawHeight(x, z); // Fallback if called before init

    const { halfSize, segmentSize, segments } = meshConfig;

    // Convert world coord to grid coord (float)
    // Grid starts at -halfSize (index 0)
    const gridX = (x + halfSize) / segmentSize;
    const gridZ = (z + halfSize) / segmentSize;

    // Check bounds
    if (gridX < 0 || gridX >= segments || gridZ < 0 || gridZ >= segments) {
        return 0; // Off map
    }

    // Integer indices (top-left of the cell)
    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);

    // Fractional part (local coordinates within the square 0..1)
    const fx = gridX - ix;
    const fz = gridZ - iz;

    // Get indices for the 4 corners of this cell
    // Row-major order: index = iz * (segments + 1) + ix
    const rowLength = segments + 1;
    const idxTL = iz * rowLength + ix;       // Top-Left
    const idxTR = iz * rowLength + (ix + 1); // Top-Right
    const idxBL = (iz + 1) * rowLength + ix;     // Bottom-Left
    const idxBR = (iz + 1) * rowLength + (ix + 1); // Bottom-Right

    const hTL = heightMapCache[idxTL];
    const hTR = heightMapCache[idxTR];
    const hBL = heightMapCache[idxBL];
    const hBR = heightMapCache[idxBR];

    // Barycentric interpolation matching the mesh triangulation
    // Triangle 1 (TL, BL, TR) if fx + fz < 1
    // Triangle 2 (TR, BL, BR) if fx + fz >= 1
    let groundY = 0;

    if (fx + fz < 1) {
        // Triangle 1: TL + fz*(BL-TL) + fx*(TR-TL)
        groundY = hTL + fz * (hBL - hTL) + fx * (hTR - hTL);
    } else {
        // Triangle 2: BR + (1-fx)*(BL-BR) + (1-fz)*(TR-BR)
        groundY = hBR + (1 - fx) * (hBL - hBR) + (1 - fz) * (hTR - hBR);
    }

    return groundY;
}

/**
 * Get terrain normal vector at x, z
 * Used for aligning vehicles to the ground
 */
export function getTerrainNormal(x, z) {
    if (!heightMapCache) return new THREE.Vector3(0, 1, 0);

    const { halfSize, segmentSize, segments } = meshConfig;

    // Convert world coord to grid coord (float)
    const gridX = (x + halfSize) / segmentSize;
    const gridZ = (z + halfSize) / segmentSize;

    // Check bounds
    if (gridX < 0 || gridX >= segments || gridZ < 0 || gridZ >= segments) {
        return new THREE.Vector3(0, 1, 0);
    }

    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    const rowLength = segments + 1;
    const idxTL = iz * rowLength + ix;
    const idxTR = iz * rowLength + (ix + 1);
    const idxBL = (iz + 1) * rowLength + ix;
    const idxBR = (iz + 1) * rowLength + (ix + 1);

    const hTL = heightMapCache[idxTL];
    const hTR = heightMapCache[idxTR];
    const hBL = heightMapCache[idxBL];
    const hBR = heightMapCache[idxBR];

    const normal = new THREE.Vector3(0, 1, 0);

    if (fx + fz < 1) {
        // Triangle 1: TL is the corner
        // Slope X = (hTR - hTL)
        // Slope Z = (hBL - hTL)
        // Normal = (-SlopeX, segmentSize, -SlopeZ)
        normal.set(hTL - hTR, segmentSize, hTL - hBL);
    } else {
        // Triangle 2: BR is the corner
        // Slope X = (hBR - hBL)
        // Slope Z = (hBR - hTR)
        // Normal = (-SlopeX, segmentSize, -SlopeZ)
        // Vector = (-(hBR-hBL), s, -(hBR-hTR)) = (hBL-hBR, s, hTR-hBR)
        normal.set(hBL - hBR, segmentSize, hTR - hBR);
    }

    return normal.normalize();
}

// ...

/**
 * Generate the custom mesh for the terrain
 */
export function createMountains(scene, texture = null) {
    const geometry = new THREE.BufferGeometry();

    // Initialize Cache & Mesh Config
    const vertexCount = (GRID_SEGMENTS + 1) * (GRID_SEGMENTS + 1);
    heightMapCache = new Float32Array(vertexCount);

    const halfSize = GRID_SIZE / 2;
    const segmentSize = GRID_SIZE / GRID_SEGMENTS;

    // Update config for runtime lookups used by getTerrainHeight
    meshConfig = { halfSize, segmentSize, segments: GRID_SEGMENTS };

    // Arrays for Geometry
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = [];

    let posIdx = 0;
    let uvIdx = 0;
    let hIdx = 0; // Index for height map cache

    // 1. Generate Vertices and UVs
    for (let i = 0; i <= GRID_SEGMENTS; i++) {
        const z = -halfSize + i * segmentSize;

        for (let j = 0; j <= GRID_SEGMENTS; j++) {
            const x = -halfSize + j * segmentSize;

            // Calculate Height using RAW math
            const y = computeRawHeight(x, z);

            // Store in Cache
            heightMapCache[hIdx++] = y;

            positions[posIdx++] = x;
            positions[posIdx++] = y;
            positions[posIdx++] = z;

            // UV Mapping
            const uvScale = 0.005;
            uvs[uvIdx++] = (x + halfSize) * uvScale;
            uvs[uvIdx++] = (z + halfSize) * uvScale;
        }
    }

    // 2. Generate Indices (Triangles)
    for (let i = 0; i < GRID_SEGMENTS; i++) {
        for (let j = 0; j < GRID_SEGMENTS; j++) {
            const a = i * (GRID_SEGMENTS + 1) + j;
            const b = i * (GRID_SEGMENTS + 1) + (j + 1);
            const c = (i + 1) * (GRID_SEGMENTS + 1) + j;
            const d = (i + 1) * (GRID_SEGMENTS + 1) + (j + 1);

            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // 3. Create Material
    let sandTexture = texture;
    if (!sandTexture) {
        const textureLoader = new THREE.TextureLoader();
        sandTexture = textureLoader.load('assets/textures/sand.jpg');
        sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping;
        sandTexture.colorSpace = THREE.SRGBColorSpace;
    } else {
        // Ensure properties are set on preloaded texture
        sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping;
        sandTexture.colorSpace = THREE.SRGBColorSpace;
    }

    // Match the original floor material settings roughly
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0xd1c19a, // Use the lighter sand color from world.js
        map: sandTexture,
        roughness: 0.8,
        metalness: 0.0,
        flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, mountainMaterial);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);

    console.log('🏔️ Mountains generated');
    return mesh;
}
