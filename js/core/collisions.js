import * as THREE from 'three';

/**
 * Collision System - Centralized collision detection for all game objects
 * 
 * Usage:
 *   import { CollisionManager, BoxCollider, CylinderCollider } from './collisions.js';
 *   
 *   // Add colliders
 *   CollisionManager.addBox({ name: 'wall1', centerX: 0, centerZ: -25, width: 50, depth: 1, height: 10 });
 *   CollisionManager.addCylinder({ name: 'pillar1', x: 10, z: 10, radius: 0.5, height: 10 });
 *   
 *   // Check collision
 *   const result = CollisionManager.checkPlayerCollision(x, y, z, radius, velocity);
 *   if (result.collided) {
 *       x = result.x;
 *       z = result.z;
 *       velocity.x = result.velocityX;
 *       velocity.z = result.velocityZ;
 *   }
 */

// ============================================
// COLLISION PRIMITIVES
// ============================================

/**
 * Box Collider - for walls, platforms, etc.
 */
export class BoxCollider {
    constructor(config) {
        this.type = 'box';
        this.name = config.name || 'unnamed_box';
        this.centerX = config.centerX;
        this.centerZ = config.centerZ;
        this.width = config.width;
        this.depth = config.depth;
        this.height = config.height;
        this.baseY = config.baseY || 0;

        // Pre-calculate bounds
        this.minX = this.centerX - this.width / 2;
        this.maxX = this.centerX + this.width / 2;
        this.minZ = this.centerZ - this.depth / 2;
        this.maxZ = this.centerZ + this.depth / 2;
        this.maxY = this.baseY + this.height;
    }

    /**
     * Check collision with a sphere (player/vehicle)
     * @returns {Object|null} Push-out result or null if no collision
     */
    checkCollision(x, y, z, radius) {
        // Height check - can jump over OR walk under (for high floating platforms)
        // NOTE: y is camera/eye position
        const feetY = y - 1.7; // Player feet (works for standing or crouching)
        const headY = y + 0.2; // Top of player

        // Skip if above the box (with step tolerance logic)
        // We use -0.5 tolerance to match getFloorHeight, preventing
        // the player from being pushed off when gravity pulls them slightly into the floor
        if (feetY >= this.maxY - 0.5) return null;

        // Skip if completely below the box ONLY if it's a high floating platform
        // (baseY > 2 means it's elevated, like a tabletop - player can walk under)
        // For walls that start at ground level (baseY near 0), always collide
        if (this.baseY > 2.0 && headY <= this.baseY) return null;

        // Expand bounds by radius
        const minX = this.minX - radius;
        const maxX = this.maxX + radius;
        const minZ = this.minZ - radius;
        const maxZ = this.maxZ + radius;

        // Check if inside bounds
        if (x < minX || x > maxX || z < minZ || z > maxZ) {
            return null;
        }

        // Collision! Calculate push-out
        const distToMinX = x - minX;
        const distToMaxX = maxX - x;
        const distToMinZ = z - minZ;
        const distToMaxZ = maxZ - z;

        const minDist = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);

        let pushX = 0, pushZ = 0;
        let zeroVelX = false, zeroVelZ = false;

        if (minDist === distToMinX) {
            pushX = minX - 0.01 - x;
            zeroVelX = true;
        } else if (minDist === distToMaxX) {
            pushX = maxX + 0.01 - x;
            zeroVelX = true;
        } else if (minDist === distToMinZ) {
            pushZ = minZ - 0.01 - z;
            zeroVelZ = true;
        } else {
            pushZ = maxZ + 0.01 - z;
            zeroVelZ = true;
        }

        return { pushX, pushZ, zeroVelX, zeroVelZ, collider: this };
    }
}

/**
 * Rotated Box Collider - for OBB (Oriented Bounding Box)
 * Supports full rotation.
 */
export class RotatedBoxCollider {
    constructor(config) {
        this.type = 'rotated_box';
        this.name = config.name || 'unnamed_rotated_box';

        // Transform data
        // config.rotation should be {x, y, z} in radians or degrees?
        // Standard THREE usage is usually radians, but let's assume input matches usage.
        // If the user passes degrees, we convert. If radians, we use.
        // The dirt-jumps file uses degrees constants, but converts to radians before stored in `rot`.
        // We will assume the config passed here receives radians for consistency with THREE.Euler default?
        // OR we just take an Euler object.
        // Let's assume standard Euler (radians) for config.rotation.

        this.position = new THREE.Vector3(config.centerX, config.baseY + config.height / 2, config.centerZ);

        const rot = config.rotation || { x: 0, y: 0, z: 0 };
        this.rotation = new THREE.Euler(rot.x, rot.y, rot.z);
        this.quaternion = new THREE.Quaternion().setFromEuler(this.rotation);

        // Dimensions (Full width/height/depth)
        this.size = new THREE.Vector3(config.width, config.height, config.depth);
        this.halfSize = this.size.clone().multiplyScalar(0.5);

        // Pre-calculate inverse transformation for worldToLocal
        this.inverseQuaternion = this.quaternion.clone().invert();

        this.baseY = config.baseY; // For fast rejection if needed
    }

    /**
     * Convert World Point to Local Space (centered at box origin, aligned with axes)
     */
    worldToLocal(x, y, z) {
        const v = new THREE.Vector3(x, y, z);
        v.sub(this.position); // Translate to origin
        v.applyQuaternion(this.inverseQuaternion); // Undo rotation
        return v;
    }

    /**
     * Convert Local Vector to World Space (Rotate only)
     */
    localToWorldVector(x, y, z) {
        const v = new THREE.Vector3(x, y, z);
        v.applyQuaternion(this.quaternion);
        return v;
    }

    /**
     * Check collision with a sphere
     */
    checkCollision(x, y, z, radius) {
        // 1. Transform sphere center to local space
        const local = this.worldToLocal(x, y, z);

        // 2. AABB Check in local space (box is from -halfSize to +halfSize)

        // Expand bounds by radius
        const minX = -this.halfSize.x - radius;
        const maxX = this.halfSize.x + radius;
        const minY = -this.halfSize.y - radius;
        const maxY = this.halfSize.y + radius;
        const minZ = -this.halfSize.z - radius;
        const maxZ = this.halfSize.z + radius;

        if (local.x < minX || local.x > maxX ||
            local.y < minY || local.y > maxY ||
            local.z < minZ || local.z > maxZ) {
            return null;
        }

        // 3. Collision detected. Calculate push out in local space.

        // Calculate penetration depths
        const dMinX = local.x - minX;
        const dMaxX = maxX - local.x;
        const dMinY = local.y - minY;
        const dMaxY = maxY - local.y;
        const dMinZ = local.z - minZ;
        const dMaxZ = maxZ - local.z;

        const dists = [
            { d: dMinX, push: -dMinX - 0.01, axis: 'x' }, // Push towards minX (Left)
            { d: dMaxX, push: dMaxX + 0.01, axis: 'x' },  // Push towards maxX (Right)
            { d: dMinY, push: -dMinY - 0.01, axis: 'y' },
            { d: dMaxY, push: dMaxY + 0.01, axis: 'y' },
            { d: dMinZ, push: -dMinZ - 0.01, axis: 'z' },
            { d: dMaxZ, push: dMaxZ + 0.01, axis: 'z' }
        ];

        // Find smallest distance (shallowest penetration)
        let best = dists[0];
        for (let i = 1; i < dists.length; i++) {
            if (dists[i].d < best.d) best = dists[i];
        }

        // Create local push vector
        const pushLocal = new THREE.Vector3(0, 0, 0);
        let zeroVelX = false;
        let zeroVelZ = false;

        // If pushing vertically (floor/ceiling)
        // For generic collisions, we strictly push out.
        // getFloorHeight handles walking. This is for "hitting" things.
        if (best.axis === 'x') pushLocal.x = best.push;
        if (best.axis === 'y') pushLocal.y = best.push;
        if (best.axis === 'z') pushLocal.z = best.push;

        // 4. Transform push vector using localToWorldVector (rotate only)
        // WARNING: The push value calculation above was:
        // "Push towards minX": We need to move coordinate X by (minX - local.x).
        // My math: `push: -dMinX`.
        // dMinX = local.x - (minX).
        // So -dMinX = minX - local.x. Correct. 
        // We move the player TO the boundary.

        const pushWorld = this.localToWorldVector(pushLocal.x, pushLocal.y, pushLocal.z);

        // Determine velocity damping based on World Direction of push
        const normal = pushWorld.clone().normalize();

        // Stop velocity against wall normal
        if (Math.abs(normal.x) > 0.5) zeroVelX = true;
        if (Math.abs(normal.z) > 0.5) zeroVelZ = true;

        return {
            pushX: pushWorld.x,
            pushZ: pushWorld.z,
            zeroVelX: zeroVelX,
            zeroVelZ: zeroVelZ,
            collider: this
        };
    }
}

/**
 * Cylinder Collider - for pillars, poles, trees, etc.
 */
export class CylinderCollider {
    constructor(config) {
        this.type = 'cylinder';
        this.name = config.name || 'unnamed_cylinder';
        this.x = config.x;
        this.z = config.z;
        this.radius = config.radius;
        this.height = config.height;
        this.baseY = config.baseY || 0;
        this.maxY = this.baseY + this.height;
    }

    /**
     * Check collision with a sphere (player/vehicle)
     * @returns {Object|null} Push-out result or null if no collision
     */
    checkCollision(x, y, z, sphereRadius) {
        // Height check
        if (y > this.maxY || y < this.baseY) return null;

        // Distance check
        const dx = x - this.x;
        const dz = z - this.z;
        const distSq = dx * dx + dz * dz;
        const minDist = this.radius + sphereRadius;

        if (distSq >= minDist * minDist) return null;

        // Collision! Push out
        const dist = Math.sqrt(distSq);

        if (dist < 0.001) {
            // At center - push in arbitrary direction
            return { pushX: minDist, pushZ: 0, zeroVelX: true, zeroVelZ: true, collider: this };
        }

        const pushDist = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        return {
            pushX: nx * pushDist,
            pushZ: nz * pushDist,
            zeroVelX: true,
            zeroVelZ: true,
            collider: this
        };
    }
}

/**
 * Sphere Collider - for balls, targets, etc.
 */
export class SphereCollider {
    constructor(config) {
        this.type = 'sphere';
        this.name = config.name || 'unnamed_sphere';
        this.x = config.x;
        this.y = config.y || 1.0;
        this.z = config.z;
        this.radius = config.radius;
    }

    /**
     * Check collision with another sphere
     * @returns {Object|null} Push-out result or null if no collision
     */
    checkCollision(x, y, z, sphereRadius) {
        const dx = x - this.x;
        const dy = y - this.y;
        const dz = z - this.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = this.radius + sphereRadius;

        if (distSq >= minDist * minDist) return null;

        const dist = Math.sqrt(distSq);

        if (dist < 0.001) {
            return { pushX: minDist, pushZ: 0, zeroVelX: true, zeroVelZ: true, collider: this };
        }

        const pushDist = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        return {
            pushX: nx * pushDist,
            pushZ: nz * pushDist,
            zeroVelX: true,
            zeroVelZ: true,
            collider: this
        };
    }
}

// ============================================
// COLLISION MANAGER
// ============================================

class CollisionManagerClass {
    constructor() {
        this.colliders = [];
        this.debug = false;
    }

    /**
     * Clear all colliders (for level reset)
     */
    clear() {
        this.colliders = [];
    }

    /**
     * Add a box collider (walls, platforms)
     */
    addBox(config) {
        const collider = new BoxCollider(config);
        this.colliders.push(collider);
        if (this.debug) console.log(`📦 Added box collider: ${collider.name}`);
        return collider;
    }

    /**
     * Add a rotated box collider
     * config: { name, centerX, centerZ, baseY, width, height, depth, rotation: {x,y,z} }
     */
    addRotatedBox(config) {
        const collider = new RotatedBoxCollider(config);
        this.colliders.push(collider);
        if (this.debug) console.log(`🔄 Added rotated box collider: ${collider.name}`);
        return collider;
    }

    /**
     * Add a cylinder collider (pillars, poles)
     */
    addCylinder(config) {
        const collider = new CylinderCollider(config);
        this.colliders.push(collider);
        if (this.debug) console.log(`🏛️ Added cylinder collider: ${collider.name}`);
        return collider;
    }

    /**
     * Add a sphere collider (targets, balls)
     */
    addSphere(config) {
        const collider = new SphereCollider(config);
        this.colliders.push(collider);
        if (this.debug) console.log(`⚽ Added sphere collider: ${collider.name}`);
        return collider;
    }

    /**
     * Remove a collider by name
     */
    remove(name) {
        const index = this.colliders.findIndex(c => c.name === name);
        if (index !== -1) {
            this.colliders.splice(index, 1);
            if (this.debug) console.log(`🗑️ Removed collider: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * Check player collision against all colliders
     * @param {number} x - Player X position
     * @param {number} y - Player Y position (eye level)
     * @param {number} z - Player Z position
     * @param {number} radius - Player collision radius
     * @param {Object} velocity - Player velocity {x, y, z}
     * @returns {Object} Result with final position and velocity
     */
    checkPlayerCollision(x, y, z, radius, velocity) {
        let finalX = x;
        let finalZ = z;
        let collided = false;
        const hitColliders = [];

        for (const collider of this.colliders) {
            const result = collider.checkCollision(finalX, y, finalZ, radius);

            if (result) {
                collided = true;
                hitColliders.push(result.collider);

                // Apply push-out
                finalX += result.pushX;
                finalZ += result.pushZ;

                // Zero velocity if needed
                if (result.zeroVelX) velocity.x = 0;
                if (result.zeroVelZ) velocity.z = 0;
            }
        }

        return {
            x: finalX,
            z: finalZ,
            velocityX: velocity.x,
            velocityZ: velocity.z,
            collided,
            hitColliders
        };
    }

    /**
     * Get count of colliders
     */
    get count() {
        return this.colliders.length;
    }

    /**
     * Get all colliders of a specific type
     */
    getByType(type) {
        return this.colliders.filter(c => c.type === type);
    }

    /**
     * Enable/disable debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    /**
     * Get the floor height at a given position
     * Checks all box/rotated_box colliders to find walkable surfaces
     * @param {number} x - X position
     * @param {number} z - Z position  
     * @param {number} playerY - Current player Y position (eye level)
     * @param {number} playerHeight - Player height (default 1.7 for eye level)
     * @returns {Object|null} {height: number, onFloor: boolean} or null if no floor
     */
    getFloorHeight(x, z, playerY, playerHeight = 1.7) {
        let highestFloor = null;
        const feetY = playerY - playerHeight;

        for (const collider of this.colliders) {

            // 1. Box Collider (AABB)
            if (collider.type === 'box') {
                if (x < collider.minX || x > collider.maxX) continue;
                if (z < collider.minZ || z > collider.maxZ) continue;

                const floorTop = collider.maxY;
                const distAboveFloor = feetY - floorTop;

                // Allow landing if within reasonable range above the floor
                // or slightly below (snap up for small steps)
                if (distAboveFloor >= -0.5 && distAboveFloor < 10) {
                    if (highestFloor === null || floorTop > highestFloor) {
                        highestFloor = floorTop;
                    }
                }
            }

            // 2. Rotated Box Collider (OBB)
            else if (collider.type === 'rotated_box') {
                // Transform to local space
                // Note: We need Y coordinate for correct transformation if rotated on X/Z
                const local = collider.worldToLocal(x, feetY, z);

                // Check if within localized X/Z bounds (+/- halfSize)
                // We use loose bounds check to see if we are "over" it
                if (Math.abs(local.x) > collider.halfSize.x) continue;
                if (Math.abs(local.z) > collider.halfSize.z) continue;

                // Determine floor height at this X/Z
                // If it's pure Y-rotation, the top surface is flat in world space.
                const isFlat = Math.abs(collider.rotation.x) < 0.01 && Math.abs(collider.rotation.z) < 0.01;

                if (isFlat) {
                    const floorTop = collider.position.y + collider.halfSize.y;
                    const distAboveFloor = feetY - floorTop;

                    if (distAboveFloor >= -0.5 && distAboveFloor < 10) {
                        if (highestFloor === null || floorTop > highestFloor) {
                            highestFloor = floorTop;
                        }
                    }
                } else {
                    // For tilted boxes (ramps), we need to calculate the Y at this local X,Z on the top face.
                    // Top face in local space is Y = +halfSize.y.
                    // We need to find World Y such that WorldToLocal(X, WorldY, Z).y = halfSize.y
                    // This is complex algebra or raycasting.
                    // For now, skipping tilted platform walkable logic in generic collider 
                    // (Use custom physics for ramps like dirt-jumps.js, or add 'slopes' later)
                    continue;
                }
            }
        }

        if (highestFloor !== null) {
            return {
                height: highestFloor,
                onFloor: true
            };
        }

        return null;
    }
}

// Singleton instance
export const CollisionManager = new CollisionManagerClass();

// Also export for backwards compatibility
export default CollisionManager;
