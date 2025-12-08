import * as THREE from 'three';
import { CollisionManager } from '../core/collisions.js';

/**
 * Dirt Jump System - Simple ramps with tabletop
 * 
 * Refactored to support full position and rotation.
 * Physics logic transforms Player (World) -> Local space for simplified checks.
 */

// ========================================
// CONFIGURATION
// ========================================

const DIRT_JUMPS_POSITION = { x: -60, y: 0, z: 0 };
const DIRT_JUMPS_ROTATION = { x: 0, y: 0, z: 0 }; // Rotation in degrees

let jumpData = null; // Stores processed config + transforms

// Materials
function createMaterials() {
    // Load wood texture
    const textureLoader = new THREE.TextureLoader();
    const woodTexture = textureLoader.load('extras/old_warehouse/metalPlates.jpg');
    woodTexture.colorSpace = THREE.SRGBColorSpace;
    woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
    // Adjust repeat if needed, start with 1x1 or maybe 4x4 depending on UVs
    // woodTexture.repeat.set(1, 1); 

    // Load metal texture for ramps
    const metalTexture = textureLoader.load('extras/old_warehouse/metalPlates.jpg');
    metalTexture.colorSpace = THREE.SRGBColorSpace;
    metalTexture.wrapS = metalTexture.wrapT = THREE.RepeatWrapping;
    metalTexture.repeat.set(2, 2); // Tiling for better look

    return {
        ramp: new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, // White to let texture show true colors
            roughness: 0.4,
            metalness: 0.8,
            map: metalTexture,
            side: THREE.DoubleSide
        }),
        wood: new THREE.MeshStandardMaterial({
            map: woodTexture,
            roughness: 0.8,
            metalness: 0.1
        }),
        beam: new THREE.MeshStandardMaterial({
            map: woodTexture,
            roughness: 0.8,
            metalness: 0.0
        })
    };
}

// ========================================
// PHYSICS HELPERS (Local Space)
// ========================================


/**
 * Transform World Point -> Local Space
 */
function worldToLocal(wx, wz) {

    return { x: wx, z: wz }; // Placeholder, this function is being replaced by new Matrix logic below
}

// Helper to get Matrix transforms
function updateJumpDataTransforms() {
    if (!jumpData) return;

    const pos = new THREE.Vector3(jumpData.pos.x, jumpData.pos.y, jumpData.pos.z);
    const rot = new THREE.Euler(jumpData.rot.x, jumpData.rot.y, jumpData.rot.z); // stored in radians
    const quat = new THREE.Quaternion().setFromEuler(rot);
    const scale = new THREE.Vector3(1, 1, 1);

    jumpData.matrixWorld = new THREE.Matrix4().compose(pos, quat, scale);
    jumpData.matrixWorldInverse = jumpData.matrixWorld.clone().invert();
}

/**
 * Transform World (x, y, z) -> Local Vector3
 */
function getLocalPoint(wx, wy, wz) {
    if (!jumpData) return new THREE.Vector3(wx, wy, wz);
    // If matrix not ready, init it (should be init in create)
    if (!jumpData.matrixWorld) updateJumpDataTransforms();

    const v = new THREE.Vector3(wx, wy, wz);
    v.applyMatrix4(jumpData.matrixWorldInverse);
    return v;
}

/**
 * Transform Local Vector3 -> World Vector3 (Point)
 */
function getWorldPoint(lx, ly, lz) {
    if (!jumpData) return new THREE.Vector3(lx, ly, lz);
    if (!jumpData.matrixWorld) updateJumpDataTransforms();

    const v = new THREE.Vector3(lx, ly, lz);
    v.applyMatrix4(jumpData.matrixWorld);
    return v;
}

/**
 * Transform Local Direction -> World Direction (Rotation only)
 */
function getWorldDirection(lx, ly, lz) {
    if (!jumpData) return new THREE.Vector3(lx, ly, lz);
    if (!jumpData.matrixWorld) updateJumpDataTransforms();

    const v = new THREE.Vector3(lx, ly, lz);
    v.transformDirection(jumpData.matrixWorld);
    return v;
}



// ========================================
// PHYSICS EXPORTS
// ========================================

/**
 * Get ground height for PLAYER (eye height currentY, feet ~1.7 below)
 */
export function getDirtJumpGroundHeight(x, z, currentY) {
    const feetY = currentY - 1.7;
    return getGroundHeightInternal(x, z, feetY);
}

/**
 * Get ground height for VEHICLE (currentY is at wheel level)
 */
export function getDirtJumpGroundHeightVehicle(x, z, currentY) {
    return getGroundHeightInternal(x, z, currentY);
}

/**
 * Internal ground height calculation
 */

/**
 * Internal ground height calculation
 */
function getGroundHeightInternal(x, z, feetY) {
    if (!jumpData) return null;

    // Convert to local space using full 3D transform
    const local = getLocalPoint(x, feetY, z);
    const lx = local.x;
    const ly = local.y; // Local height relative to floor of the object
    const lz = local.z;

    // NOTE: In local space, the object's "floor" is at y=0 (relative to its origin node).
    // The ramps go UP from y=0 to y=rampHeight.
    // If the whole object is tilted, 'ly' is the distance perpendicular to the object's base plane.

    // Bounds check
    const { rampWidth, frontStart, frontEnd, backStart, backEnd,
        rampHeight, tabletopStart, tabletopEnd, tabletopWidth } = jumpData;

    const halfWidth = rampWidth / 2;
    const halfTabletopWidth = tabletopWidth / 2;

    const inRampX = Math.abs(lx) <= halfWidth;
    const inTabletopX = Math.abs(lx) <= halfTabletopWidth;

    // Tolerance for snapping
    const tolerance = 4.0; // Standard jump tolerance

    // Helper: Check Surface
    // Return world height if match
    const checkSurface = (targetLocalY, slope) => {
        // If feet are close to the target surface height (in local space)
        if (ly >= targetLocalY - tolerance && ly <= targetLocalY + 2.0) {
            // Calculate world alignment
            // We know the LOCAL contact point is (lx, targetLocalY, lz).
            // We transform this back to world to get the exact World Y height the player should be at.
            const worldContact = getWorldPoint(lx, targetLocalY, lz);

            // The return object expects 'height' (world Y)
            return {
                height: worldContact.y,
                slope: slope,
                onRamp: true,
                type: 'generic'
            };
        }
        return null;
    };

    // Front ramp
    if (inRampX && lz >= frontStart && lz <= frontEnd) {
        const t = (lz - frontStart) / (frontEnd - frontStart);
        const surfaceHeight = rampHeight * t;
        const res = checkSurface(surfaceHeight, rampHeight / (frontEnd - frontStart));
        if (res) { res.type = 'front'; return res; }
    }

    // Tabletop
    if (inTabletopX && lz >= tabletopStart && lz <= tabletopEnd) {
        const surfaceHeight = rampHeight;
        const res = checkSurface(surfaceHeight, 0);
        if (res) { res.type = 'tabletop'; return res; }
    }

    // Back ramp
    if (inRampX && lz >= backStart && lz <= backEnd) {
        const t = (lz - backStart) / (backEnd - backStart);
        const surfaceHeight = rampHeight * (1 - t);
        const res = checkSurface(surfaceHeight, -rampHeight / (backEnd - backStart));
        if (res) { res.type = 'back'; return res; }
    }

    return null;
}


/**
 * Check collision with ramp sides
 */

/**
 * Check collision with ramp sides
 */
export function checkRampSideCollision(x, z, feetY, radius) {
    if (!jumpData) return null;

    const local = getLocalPoint(x, feetY, z);
    const lx = local.x;
    const ly = local.y; // Local height
    const lz = local.z;

    const { rampWidth, frontStart, frontEnd, backStart, backEnd, rampHeight } = jumpData;
    const halfWidth = rampWidth / 2;

    // Helper: Side check in local space
    const checkSide = (tStart, tEnd, isFront) => {
        if (lz >= tStart && lz <= tEnd) {
            const t = (lz - tStart) / (tEnd - tStart);
            const surfaceHeight = isFront ? (rampHeight * t) : (rampHeight * (1 - t));

            // Collision Check: Only if BELOW the ramp surface (hitting the side)
            // If ly is < surfaceHeight - tolerance
            if (ly < surfaceHeight - 0.5) { // tighter tolerance for side hit
                const playerMinX = lx - radius;
                const playerMaxX = lx + radius;

                // Ramp bounds in local space
                const rampMinX = -halfWidth;
                const rampMaxX = halfWidth;

                if (playerMaxX > rampMinX && playerMinX < rampMaxX) {
                    const distToLeft = playerMaxX - rampMinX; // penetrating left side
                    const distToRight = rampMaxX - playerMinX; // penetrating right side

                    let pushLocal = new THREE.Vector3(0, 0, 0);

                    if (distToLeft < distToRight) {
                        pushLocal.x = -distToLeft - 0.1; // Push Left
                    } else {
                        pushLocal.x = distToRight + 0.1; // Push Right
                    }

                    // Rotate push vector back to world space
                    const worldPush = getWorldDirection(pushLocal.x, 0, 0);
                    return { x: worldPush.x, z: worldPush.z };
                }
            }
        }
        return null;
    };

    // Check Front
    const resFront = checkSide(frontStart, frontEnd, true);
    if (resFront) return resFront;

    // Check Back
    const resBack = checkSide(backStart, backEnd, false);
    if (resBack) return resBack;

    return null;
}


// ========================================
// INITIALIZATION
// ========================================

/**
 * Create the dirt jump area
 */
export function createDirtJumps(scene) {
    const materials = createMaterials();

    // Use constants
    const pos = DIRT_JUMPS_POSITION;
    const rot = DIRT_JUMPS_ROTATION;
    const radY = rot.y * (Math.PI / 180);

    // Dimensions
    const rampWidth = 20;
    const rampLength = 25;
    const rampHeight = 8;
    const tabletopLength = 30;
    const tabletopWidth = 16;

    // Local Z coordinates
    const frontStart = -30;
    const frontEnd = frontStart + rampLength;
    const tabletopStart = frontEnd;
    const tabletopEnd = tabletopStart + tabletopLength;
    const backStart = tabletopEnd;
    const backEnd = backStart + rampLength;


    // Store config for physics
    jumpData = {
        pos,
        rot: { // Radian storage for internal math
            x: rot.x * (Math.PI / 180),
            y: rot.y * (Math.PI / 180),
            z: rot.z * (Math.PI / 180)
        },
        rampWidth, rampHeight,
        frontStart, frontEnd, backStart, backEnd,
        tabletopStart, tabletopEnd, tabletopWidth
    };
    updateJumpDataTransforms(); // Init matrices

    // Create Group
    const jumpGroup = new THREE.Group();
    jumpGroup.position.set(pos.x, pos.y, pos.z);
    jumpGroup.rotation.set(
        jumpData.rot.x,
        jumpData.rot.y,
        jumpData.rot.z
    );
    scene.add(jumpGroup);


    // ========================================
    // VISUALS (Added to Group)
    // ========================================

    // Front Ramp
    const frontRampGeo = createRampGeometry(rampWidth, rampLength, rampHeight, 'up');
    const frontRamp = new THREE.Mesh(frontRampGeo, materials.ramp);
    frontRamp.position.set(0, 0, frontStart);
    jumpGroup.add(frontRamp);

    // Tabletop
    const platformGeo = new THREE.BoxGeometry(tabletopWidth, 0.5, tabletopLength);
    const platform = new THREE.Mesh(platformGeo, materials.wood);
    platform.position.set(0, rampHeight - 0.25, (tabletopStart + tabletopEnd) / 2);
    jumpGroup.add(platform);

    // Legs
    const legRadius = 0.4;
    const legHeight = rampHeight - 0.5;
    const legGeo = new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 8);

    const legLocalPositions = [
        { x: -tabletopWidth / 2 + 1.5, z: tabletopStart + 3 },
        { x: tabletopWidth / 2 - 1.5, z: tabletopStart + 3 },
        { x: -tabletopWidth / 2 + 1.5, z: tabletopEnd - 3 },
        { x: tabletopWidth / 2 - 1.5, z: tabletopEnd - 3 }
    ];

    legLocalPositions.forEach((lPos, i) => {
        const leg = new THREE.Mesh(legGeo, materials.beam);
        leg.position.set(lPos.x, legHeight / 2, lPos.z);
        jumpGroup.add(leg);

        // Solid collider for leg
        // Use getWorldPoint to match visual position
        const worldPos = getWorldPoint(lPos.x, legHeight / 2, lPos.z);


        CollisionManager.addCylinder({
            name: `tabletop_leg_${i}`,
            x: worldPos.x,
            z: worldPos.z,
            radius: legRadius,
            height: legHeight,
            baseY: pos.y
        });
    });

    // Back Ramp
    const backRampGeo = createRampGeometry(rampWidth, rampLength, rampHeight, 'down');
    const backRamp = new THREE.Mesh(backRampGeo, materials.ramp);
    backRamp.position.set(0, 0, backStart);
    jumpGroup.add(backRamp);

    // ========================================
    // SOLID WALLS (Rotated Box Colliders)
    // ========================================

    const wallWidth = rampWidth - 2;
    const wallDepth = 0.5;
    const wallHeight = 3;

    // 1. Front Ramp Back Wall
    // Local Pos:
    const frontWallLocal = new THREE.Vector3(0, wallHeight / 2, frontEnd + 0.25);
    const frontWallWorld = getWorldPoint(frontWallLocal.x, frontWallLocal.y, frontWallLocal.z);

    // Rotation is same as group
    CollisionManager.addRotatedBox({
        name: 'frontRamp_backWall',
        centerX: frontWallWorld.x,
        centerZ: frontWallWorld.z,
        baseY: frontWallWorld.y - wallHeight / 2, // Calculate base from center
        width: wallWidth,
        height: wallHeight,
        depth: wallDepth,
        rotation: jumpData.rot // {x,y,z} in radians
    });

    // 2. Back Ramp Front Wall
    const backWallLocal = new THREE.Vector3(0, wallHeight / 2, backStart - 0.25);
    const backWallWorld = getWorldPoint(backWallLocal.x, backWallLocal.y, backWallLocal.z);

    CollisionManager.addRotatedBox({
        name: 'backRamp_frontWall',
        centerX: backWallWorld.x,
        centerZ: backWallWorld.z,
        baseY: backWallWorld.y - wallHeight / 2,
        width: wallWidth,
        height: wallHeight,
        depth: wallDepth,
        rotation: jumpData.rot
    });


    window.dirtJumpCollisions = [];

    console.log('');
    console.log('🏔️ === DIRT JUMPS INITIALIZED (Refactored) ===');
    console.log(`📍 Pos: ${pos.x}, ${pos.y}, ${pos.z}`);
    console.log(`🔄 Rot: ${rot.y}°`);
    console.log('');
}

function createRampGeometry(width, length, height, direction) {
    const hw = width / 2;
    const geometry = new THREE.BufferGeometry();

    // Arrays to store vertex data
    const positions = [];
    const uvs = [];
    const indices = [];

    let vOffset = 0;


    const addQuad = (p1, p2, p3, p4, uvMin, uvMax) => {
        positions.push(
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z,
            p3.x, p3.y, p3.z,
            p4.x, p4.y, p4.z
        );

        uvs.push(
            uvMin.x, uvMax.y, // p1 (Top-Left in UV space usually, but dep on mapping)
            uvMax.x, uvMax.y, // p2
            uvMin.x, uvMin.y, // p3
            uvMax.x, uvMin.y  // p4
        );

        // Standard winding
        indices.push(
            vOffset + 0, vOffset + 2, vOffset + 1,
            vOffset + 2, vOffset + 3, vOffset + 1
        );

        vOffset += 4;
    };

    // Helper for triangles
    const addTriangle = (p1, p2, p3, uv1, uv2, uv3) => {
        positions.push(
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z,
            p3.x, p3.y, p3.z
        );
        uvs.push(
            uv1.x, uv1.y,
            uv2.x, uv2.y,
            uv3.x, uv3.y
        );
        indices.push(vOffset, vOffset + 1, vOffset + 2);
        vOffset += 3;
    };

    // Common Texture scaling factor (e.g. 1 UV unit per 5 world units)
    const uvScale = 0.2;


    let p0, p1, p2, p3; // Top surface corners
    let b0, b1, b2, b3; // Bottom surface corners

    // Bottom corners are always at Y=0
    b0 = new THREE.Vector3(-hw, 0, 0);
    b1 = new THREE.Vector3(hw, 0, 0);
    b2 = new THREE.Vector3(-hw, 0, length);
    b3 = new THREE.Vector3(hw, 0, length);

    if (direction === 'up') {
        // Starts at 0, goes up to height
        p0 = new THREE.Vector3(-hw, 0, 0);
        p1 = new THREE.Vector3(hw, 0, 0);
        p2 = new THREE.Vector3(-hw, height, length);
        p3 = new THREE.Vector3(hw, height, length);

        // 1. Slope Face (p0-p1-p2-p3)
        // Calculate slope length for proper UV aspect ratio
        const slopeLen = Math.hypot(length, height);
        addQuad(p0, p2, p1, p3,
            { x: 0, y: 0 },
            { x: width * uvScale, y: slopeLen * uvScale }
        );


        addQuad(p2, b2, p3, b3,
            { x: 0, y: height * uvScale },
            { x: width * uvScale, y: 0 }
        );


        addTriangle(p0, b2, p2,
            { x: 0, y: 0 },                 // p0
            { x: length * uvScale, y: 0 },  // b2
            { x: length * uvScale, y: height * uvScale } // p2
        );


        addTriangle(p1, p3, b3,
            { x: 0, y: 0 },
            { x: length * uvScale, y: height * uvScale },
            { x: length * uvScale, y: 0 }
        );

    } else {
        // 'down' - Starts at height, goes down to 0
        p0 = new THREE.Vector3(-hw, height, 0);
        p1 = new THREE.Vector3(hw, height, 0);
        p2 = new THREE.Vector3(-hw, 0, length);
        p3 = new THREE.Vector3(hw, 0, length);

        // 1. Slope Face
        const slopeLen = Math.hypot(length, height);
        addQuad(p0, p2, p1, p3,
            { x: 0, y: slopeLen * uvScale },
            { x: width * uvScale, y: 0 }
        );

        // 2. Front Vertical Face (at Z=0) : p0-p1-b0-b1
        addQuad(p0, b0, p1, b1,
            { x: 0, y: height * uvScale },
            { x: width * uvScale, y: 0 }
        );

        // 3. Side Left (x = -hw)
        addTriangle(p0, b2, b0,
            { x: 0, y: height * uvScale },
            { x: length * uvScale, y: 0 },
            { x: 0, y: 0 }
        );

        // 4. Side Right (x = hw)
        addTriangle(p1, b1, b3,
            { x: 0, y: height * uvScale },
            { x: 0, y: 0 },
            { x: length * uvScale, y: 0 }
        );
    }

    // Bottom Face (for completeness, though often hidden)
    addQuad(b2, b0, b3, b1,
        { x: 0, y: length * uvScale },
        { x: width * uvScale, y: 0 }
    );

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals(); // Generates specific normals for each face (flat shading)

    return geometry;
}
