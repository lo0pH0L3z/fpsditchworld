/**
 * Vehicle System - Complete rewrite with improved collision and physics
 * 
 * Key improvements:
 * - Smooth ground following with lerp (no hard snaps)
 * - Proper edge detection (can drive off ramp sides)
 * - Better airborne physics with terminal velocity
 * - Soft landing system (minimal speed loss on smooth landings)
 * - Improved collision response
 */

import * as THREE from 'three';
import { CollisionManager } from '../core/collisions.js';
import { getDirtJumpGroundHeightVehicle, checkRampSideCollision } from '../locations/dirt-jumps.js';
import { getTerrainHeight, getTerrainNormal } from '../locations/mountains.js';

// Vehicle interaction constants
const INTERACTION_DISTANCE = 3.0;
const HOLD_DURATION = 0.5;

/**
 * Base Vehicle class - common functionality for all vehicles
 */
class Vehicle {
    constructor(scene, position = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        this.mesh.rotation.order = 'YXZ'; // Important for independent yaw (spin)
        this.mesh.position.copy(position);

        // State
        this.isOccupied = false;
        this.isCrashing = false;
        this.cameraMode = '1st'; // Force 1st person

        // Movement physics
        this.speed = 0;
        this.momentum = new THREE.Vector3(); // For airborne movement
        this.maxSpeed = 30;
        this.maxReverseSpeed = 10;
        this.acceleration = 25; // Increased from 15 for easier ramp climbing
        this.brakeForce = 25;
        this.reverseAccel = 8;
        this.handling = 2.5;
        this.friction = 0.98;

        // Collision
        this.collisionRadius = 0.8;
        this.groundOffset = 0.35; // Height above ground when riding

        // Airborne physics
        this.isAirborne = false;
        this.verticalVelocity = 0;
        this.gravity = 25; // Slightly increased for snappier feel
        this.terminalVelocity = 50;
        this.launchMinSpeed = 8;
        this.softLandingThreshold = 15; // Below this impact speed, no slowdown
        this.jumpForce = 18; // Bunnyhop force (Increased)
        this.airControlSpeed = 12.0; // Max rotation speed in air
        this.airControlAccel = 8.0; // How fast rotation ramps up
        this.rotationVelocity = { pitch: 0, yaw: 0, roll: 0 }; // Current rotation speeds

        // Ground following
        this.groundSnapSpeed = 25; // Increased from 15 for faster/smoother ramp following
        this.maxBumpHeight = 2.0;  // Can climb steps/bumps up to this height instantly
        this.lastGroundHeight = 0;
        this.lastGroundHeight = 0;
        this.lastOnRamp = false;
        this.lastJumpPressed = false;

        // Bunnyhop charge system (hold X to charge, release to hop)
        this.jumpHoldTime = 0;
        this.bunnyHopChargeTime = 0.3; // Seconds to fully charge
        this.bunnyHopMaxMultiplier = 1.5; // Max jump force multiplier

        // Camera offsets
        this.firstPersonOffset = new THREE.Vector3(0, 1.8, -0.3);
        this.thirdPersonOffset = new THREE.Vector3(0, 3, 8);

        // Automatic gear system
        this.currentGear = 1;
        this.maxGears = 6;
        this.gearSpeedLimits = [0, 12, 24, 36, 42, 47, 147]; // Speed limits per gear (169 km/h max)
        this.isAutomatic = true; // Automatic transmission
    }

    setGravity(val) {
        this.gravity = val;
    }

    enter() {
        this.isOccupied = true;

        if (this.vibes) {
            this.vibes.startEngine();
            // Set Triggers to resistance for throttle/brake?
            if (this.haptic && this.haptic.connected) {
                // Throttle (R2) - Soft spring
                // Brake (L2) - Soft spring
                // Actually library might not support independent settings yet easily with this helper, 
                // but let's leave triggers standard or set to "Rigid" 
                // this.haptic.ds.setTriggerR.setEffect(this.haptic.effects.Resistance);
            }
        }
    }

    exit() {
        this.isOccupied = false;
        this.speed = 0;
        this.verticalVelocity = 0;
        this.isAirborne = false;

        if (this.vibes) {
            this.vibes.stopEngine();
        }
    }

    toggleCameraMode() {
        // Forced 1st person
        this.cameraMode = '1st';
        // console.log(`📷 Camera mode: ${this.cameraMode} person`);
    }
    update(delta, input) {
        if (!this.isOccupied) return;

        // === CRASH RECOVERY ===
        if (this.isCrashing) {
            // "Smart Recovery": Find nearest upright angle
            const twoPi = Math.PI * 2;
            const targetX = Math.round(this.mesh.rotation.x / twoPi) * twoPi;
            const targetZ = Math.round(this.mesh.rotation.z / twoPi) * twoPi;

            // Smoothly lerp back to upright (Speed 5.0 for smooth animation)
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetX, 5.0 * delta);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetZ, 5.0 * delta);

            // Stop movement
            this.speed = THREE.MathUtils.lerp(this.speed, 0, 5.0 * delta);

            // Check if recovered
            if (Math.abs(this.mesh.rotation.x - targetX) < 0.05 && Math.abs(this.mesh.rotation.z - targetZ) < 0.05) {
                this.isCrashing = false;
                this.mesh.rotation.x = 0;
                this.mesh.rotation.z = 0;
            }
            return; // Skip normal input/movement while crashing
        }

        // === INPUT HANDLING ===
        this.handleInput(input, delta);

        // === CALCULATE NEW POSITION ===
        // === CALCULATE NEW POSITION ===
        let moveX = 0;
        let moveZ = 0;

        if (this.isAirborne) {
            // AIRBORNE: Use momentum (decoupled from facing)
            moveX = this.momentum.x * delta;
            moveZ = this.momentum.z * delta;

            // Apply air drag to momentum
            this.momentum.multiplyScalar(0.998);
        } else {
            // GROUNDED: Move forward based on facing
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);

            moveX = forward.x * this.speed * delta;
            moveZ = forward.z * this.speed * delta;

            // Update momentum to match current ground velocity (for when we jump)
            this.momentum.set(forward.x * this.speed, 0, forward.z * this.speed);
        }

        const newX = this.mesh.position.x + moveX;
        const newZ = this.mesh.position.z + moveZ;

        // === COLLISION DETECTION ===
        const collisionResult = this.checkCollisions(newX, newZ, delta);

        // Apply horizontal movement
        this.mesh.position.x = collisionResult.x;
        this.mesh.position.z = collisionResult.z;

        // === GROUND AND AIRBORNE PHYSICS ===
        this.updateGroundPhysics(delta);

        // Boundary limits
        this.mesh.position.x = Math.max(-500, Math.min(500, this.mesh.position.x));
        this.mesh.position.z = Math.max(-500, Math.min(500, this.mesh.position.z));
    }

    handleInput(input, delta) {
        // === BUNNYHOP (Hold X to charge, release to hop) ===
        if (!this.isAirborne) {
            if (input.jumpPressed) {
                // Charging the hop
                this.jumpHoldTime += delta;
            } else if (this.lastJumpPressed && this.jumpHoldTime > 0) {
                // Released - do the hop!
                const chargePercent = Math.min(1, this.jumpHoldTime / this.bunnyHopChargeTime);
                const jumpMultiplier = 1 + (chargePercent * (this.bunnyHopMaxMultiplier - 1));
                this.verticalVelocity = this.jumpForce * jumpMultiplier;
                this.isAirborne = true;

                this.jumpHoldTime = 0;
            }
        } else {
            // Reset hold time when airborne
            this.jumpHoldTime = 0;
        }
        this.lastJumpPressed = input.jumpPressed;

        // Acceleration (R2) - only when grounded
        if (input.accelerate > 0.1 && !this.isAirborne) {
            this.speed += this.acceleration * input.accelerate * delta;
        }

        // Brake/Reverse (L2) - only when grounded
        if (input.brake > 0.1 && !this.isAirborne) {
            if (this.speed > 0.5) {
                this.speed -= this.brakeForce * input.brake * delta;
            } else {
                this.speed -= this.reverseAccel * input.brake * delta;
            }
        }

        // Natural friction
        if (input.accelerate < 0.1 && input.brake < 0.1) {
            this.speed *= this.isAirborne ? 0.998 : this.friction;
        }

        // Handbrake
        if (input.handbrake && !this.isAirborne) {
            this.speed *= 0.92;
        }

        // === AUTOMATIC GEAR SHIFTING (before speed clamp) ===
        if (this.isAutomatic) {
            // Shift UP when near current gear's limit and accelerating
            const gearLimit = this.gearSpeedLimits[this.currentGear];
            if (Math.abs(this.speed) >= gearLimit * 0.9 && this.currentGear < this.maxGears && input.accelerate > 0.1) {
                this.currentGear++;
            }

            // Shift DOWN when speed drops well below previous gear's limit
            if (this.currentGear > 1) {
                const lowerLimit = this.gearSpeedLimits[this.currentGear - 1];
                if (Math.abs(this.speed) < lowerLimit * 0.6) {
                    this.currentGear--;
                }
            }
        }

        // Clamp speed based on current gear
        const gearMaxSpeed = this.gearSpeedLimits[this.currentGear];
        this.speed = Math.max(-this.maxReverseSpeed, Math.min(gearMaxSpeed, this.speed));

        // Stop if very slow
        if (Math.abs(this.speed) < 0.1) {
            this.speed = 0;
        }

        // HAPTIC ENGINE UPDATE
        if (this.vibes) {
            // Calculate "RPM" roughly based on gear and speed ratio
            const gearMax = this.gearSpeedLimits[this.currentGear];
            const gearMin = this.gearSpeedLimits[this.currentGear - 1] || 0;
            const range = gearMax - gearMin;
            const speedInGear = Math.abs(this.speed) - gearMin;

            let rpmPercent = speedInGear / range;
            if (this.isAirborne) rpmPercent *= 1.2; // Rev high in air

            // Base rumble intensity (idle = 20, max = 150)
            let rumble = 20 + (Math.min(1, rpmPercent) * 130);
            if (Math.abs(this.speed) < 0.5) rumble = 10; // Idle

            this.vibes.updateEngine(Math.floor(rumble));
        }

        // Steering & Air Control
        if (this.isAirborne) {
            // ROTATION MOMENTUM SYSTEM - rotations ramp up over time
            const accel = this.airControlAccel;
            const maxSpeed = this.airControlSpeed;
            const drag = 0.92; // How fast rotation slows when not pressing

            // ADVANCED AIR CONTROL (Hold Jump/X)
            if (input.jumpPressed) {
                // "OMNI-DIRECTIONAL" / BARREL ROLL MODE
                // Left Stick Y = Pitch (Flip)
                // Left Stick X = Roll (Barrel Roll)

                if (Math.abs(input.pitch) > 0.1) {
                    // Accelerate pitch rotation
                    this.rotationVelocity.pitch += input.pitch * accel * delta;
                } else {
                    this.rotationVelocity.pitch *= drag;
                }

                if (Math.abs(input.steer) > 0.1) {
                    // Accelerate roll rotation
                    this.rotationVelocity.roll += -input.steer * accel * delta;
                } else {
                    this.rotationVelocity.roll *= drag;
                }

                // Reset yaw in this mode
                this.rotationVelocity.yaw *= drag;

            } else {
                // STANDARD MODE (T-Grid + Flat Spin)
                let pitchInput = input.pitch;
                let yawInput = input.steer;

                // Deadzone
                if (Math.abs(pitchInput) < 0.2) pitchInput = 0;
                if (Math.abs(yawInput) < 0.2) yawInput = 0;

                // Dominant Axis Check
                if (Math.abs(pitchInput) > Math.abs(yawInput) + 0.1) {
                    yawInput = 0;
                } else if (Math.abs(yawInput) > Math.abs(pitchInput) + 0.1) {
                    pitchInput = 0;
                }

                // Accelerate pitch (flip)
                if (Math.abs(pitchInput) > 0.01) {
                    this.rotationVelocity.pitch += pitchInput * accel * delta;
                } else {
                    this.rotationVelocity.pitch *= drag;
                }

                // Accelerate yaw (spin)
                if (Math.abs(yawInput) > 0.01) {
                    this.rotationVelocity.yaw += -yawInput * accel * delta;
                } else {
                    this.rotationVelocity.yaw *= drag;
                }

                // Dampen roll in standard mode
                this.rotationVelocity.roll *= drag;
            }

            // Clamp rotation velocities to max speed
            this.rotationVelocity.pitch = THREE.MathUtils.clamp(this.rotationVelocity.pitch, -maxSpeed, maxSpeed);
            this.rotationVelocity.yaw = THREE.MathUtils.clamp(this.rotationVelocity.yaw, -maxSpeed, maxSpeed);
            this.rotationVelocity.roll = THREE.MathUtils.clamp(this.rotationVelocity.roll, -maxSpeed, maxSpeed);

            // Apply rotation velocities
            if (Math.abs(this.rotationVelocity.pitch) > 0.01) {
                this.mesh.rotateX(this.rotationVelocity.pitch * delta);
            }
            if (Math.abs(this.rotationVelocity.yaw) > 0.01) {
                this.mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), this.rotationVelocity.yaw * delta);
            }
            if (Math.abs(this.rotationVelocity.roll) > 0.01) {
                this.mesh.rotateZ(this.rotationVelocity.roll * delta);
            }

        } else {
            // GROUND - reset rotation velocity and do steering
            this.rotationVelocity.pitch = 0;
            this.rotationVelocity.yaw = 0;
            this.rotationVelocity.roll = 0;

            if (Math.abs(this.speed) > 0.5) {
                const steerAmount = input.steer * this.handling * delta;
                this.mesh.rotation.y -= steerAmount * Math.sign(this.speed);
            }
        }
    }

    /**
     * Check collisions with world geometry
     */
    checkCollisions(newX, newZ, delta) {
        let finalX = newX;
        let finalZ = newZ;
        let collided = false;

        // Use CollisionManager for wall and pillar collisions
        const velocity = { x: this.speed, z: this.speed }; // Dummy velocity for collision check
        const collisionResult = CollisionManager.checkPlayerCollision(
            finalX, this.mesh.position.y, finalZ, this.collisionRadius, velocity
        );

        if (collisionResult.collided) {
            finalX = collisionResult.x;
            finalZ = collisionResult.z;
            collided = true;
        }

        // === RAMP SIDE COLLISIONS ===
        // Ramps have special physics (ground following), handled separately
        // === RAMP SIDE COLLISIONS ===
        // Check for ramp side collisions (prevents clipping through sides from below)
        const rampSideCollision = checkRampSideCollision(
            finalX, finalZ, this.mesh.position.y, this.collisionRadius
        );

        if (rampSideCollision) {
            finalX += rampSideCollision.x;
            finalZ += rampSideCollision.z;
            // Reduce speed on side collision
            this.speed *= 0.6;
            collided = true;
        }

        // Bounce effect on collision
        if (collided) {
            this.speed *= -0.2;
            if (this.vibes && Math.abs(this.speed) > 5) { // Only heavy hits
                this.vibes.impact();
            }
        }

        return { x: finalX, z: finalZ };
    }

    /**
     * Handle ground detection, ramp physics, and airborne state
     */
    updateGroundPhysics(delta) {
        const currentX = this.mesh.position.x;
        const currentZ = this.mesh.position.z;
        const currentY = this.mesh.position.y;

        // Find ground info at current position using vehicle-specific function
        const rampInfo = getDirtJumpGroundHeightVehicle(currentX, currentZ, currentY);

        // Get mountain terrain height
        const mountainY = getTerrainHeight(currentX, currentZ);
        const mountainGroundHeight = mountainY + this.groundOffset;

        let targetGroundHeight = mountainGroundHeight;
        let onRamp = false;
        let rampData = null;

        // Check if ramp overrides mountain
        if (rampInfo) {
            const rampHeight = rampInfo.height + this.groundOffset;
            if (rampHeight > mountainGroundHeight) {
                targetGroundHeight = rampHeight;
                onRamp = true;
                rampData = rampInfo;
            }
        }

        // No artificial launch boost - physics handles everything naturally

        // === EDGE FALL DETECTION ===
        // If we were on a ramp and now we're not (lateral movement), start falling
        if (this.lastOnRamp && !onRamp && !this.isAirborne && currentY > 1) {
            this.isAirborne = true;
            this.verticalVelocity = 0;
        }

        // === AIRBORNE PHYSICS ===
        if (this.isAirborne) {
            // Apply gravity
            this.verticalVelocity -= this.gravity * delta;
            this.verticalVelocity = Math.max(this.verticalVelocity, -this.terminalVelocity);

            // Apply vertical movement
            this.mesh.position.y += this.verticalVelocity * delta;

            // Check for landing
            if (this.mesh.position.y <= targetGroundHeight) {
                this.handleLanding(targetGroundHeight, rampData);
            }
        } else if (onRamp) {
            // === ON RAMP - FOLLOW SURFACE ===
            // Smooth interpolation to ground height
            const heightDiff = targetGroundHeight - currentY;

            if (Math.abs(heightDiff) > 0.01) {
                // Check if this is a small bump we can climb
                if (heightDiff > 0 && heightDiff <= this.maxBumpHeight) {
                    // Small step/bump - INSTANT climb for smooth transitions
                    this.mesh.position.y = targetGroundHeight;
                } else if (heightDiff > 0) {
                    // Ascending ramp - normal smooth follow
                    this.mesh.position.y = THREE.MathUtils.lerp(
                        currentY, targetGroundHeight, this.groundSnapSpeed * delta
                    );

                    // Transfer some horizontal speed to vertical
                    if (rampData && rampData.slope > 0 && Math.abs(this.speed) > 2) {
                        const slopeForce = Math.abs(this.speed) * rampData.slope * delta * 0.5;
                        this.verticalVelocity = Math.max(this.verticalVelocity || 0, slopeForce);
                    }
                } else {
                    // Descending - follow ground
                    // SNAP DOWN if close enough (prevents flying off ramp start)
                    if (heightDiff > -2.0) {
                        this.mesh.position.y = targetGroundHeight;
                    } else {
                        this.mesh.position.y = THREE.MathUtils.lerp(
                            currentY, targetGroundHeight, this.groundSnapSpeed * delta * 0.5
                        );
                    }
                }
            } else {
                this.mesh.position.y = targetGroundHeight;
            }

            // Align to Ramp Normal (if available)
            // Uses simple pitch alignment for ramps based on slope
            if (rampData && rampData.slope !== undefined) {
                // Convert slope to pitch
                // This is a simplification; ideally we'd use the normal
                const targetPitch = -Math.atan(rampData.slope);
                this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, 5 * delta);
                this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, 5 * delta);
            }

        } else {
            // === ON MOUNTAIN (or flat ground) ===
            // We treated mountain as base, so targetGroundHeight IS the ground.

            // Terrain Alignment
            const normal = getTerrainNormal(currentX, currentZ);

            // Convert World Normal to Local Space (relative to Yaw)
            // Code: localNormal = normal.applyAxisAngle(Y_Up, -yaw)
            const localNormal = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.mesh.rotation.y);

            // Clac target Pitch (X) and Roll (Z)
            // localNormal.z = sin(pitch)
            // localNormal.y = cos(pitch) * cos(roll)
            // localNormal.x = -cos(pitch) * sin(roll)

            const targetPitch = Math.asin(THREE.MathUtils.clamp(localNormal.z, -1, 1));
            const targetRoll = Math.atan2(-localNormal.x, localNormal.y);

            // Smoothly interpolate rotation
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, targetPitch, 10 * delta);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, 10 * delta);


            // If we are significantly above the mountain surface, fall.
            const snapDistance = 1.0; // Distance to snap down

            if (currentY > targetGroundHeight + 0.1) {
                // Check if we should snap down or fall
                if (currentY - targetGroundHeight < snapDistance && this.verticalVelocity <= 0) {
                    // Snap down (Smooth Terrain Traversal)
                    this.mesh.position.y = targetGroundHeight;
                    this.isAirborne = false;
                    this.verticalVelocity = 0;
                } else {
                    // Too high - Fall
                    this.isAirborne = true;
                    this.verticalVelocity = 0;
                }
            } else {
                // On ground
                this.mesh.position.y = targetGroundHeight;
                this.isAirborne = false;
                this.verticalVelocity = 0;
            }
        }

        // Store state for next frame
        this.lastGroundHeight = targetGroundHeight;
        this.lastOnRamp = onRamp;

        // === LANDING ASSIST ===
        // If falling and close to ground, gently align to upright to help landing
        if (this.isAirborne && this.verticalVelocity < 0) {
            const distToGround = currentY - targetGroundHeight;
            if (distToGround < 4.0) {
                // Strength increases as we get closer
                const assistStrength = 4.0 * delta * (1.0 - (distToGround / 4.0));

                // Align Pitch (X) to 0 (flat) or slope if we had it
                // For now, just try to land flat-ish
                this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, assistStrength);

                // Align Roll (Z) to 0 (upright)
                this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, assistStrength);
            }
        }
    }

    /**
     * Handle landing impact
     */
    handleLanding(groundHeight, groundInfo) {
        const impactSpeed = Math.abs(this.verticalVelocity);
        this.lastImpactSpeed = impactSpeed;

        // Check orientation
        // Normalize angles to -PI...PI
        const normalizeAngle = (a) => {
            a = a % (Math.PI * 2);
            if (a > Math.PI) a -= Math.PI * 2;
            if (a < -Math.PI) a += Math.PI * 2;
            return a;
        };

        const pitch = normalizeAngle(this.mesh.rotation.x);
        const roll = normalizeAngle(this.mesh.rotation.z);

        // Crash if landing > 60 degrees off
        if (Math.abs(pitch) > Math.PI / 3 || Math.abs(roll) > Math.PI / 3) {
            this.isCrashing = true;
            this.isAirborne = false;
            this.verticalVelocity = 0;
            this.currentGear = 1;
            return;
        }

        this.mesh.position.y = groundHeight;
        this.isAirborne = false;
        this.verticalVelocity = 0;

        // Landing on a ramp (especially landing ramp) should be smooth
        const isLandingRamp = groundInfo && groundInfo.type === 'landing';
        const effectiveThreshold = isLandingRamp ?
            this.softLandingThreshold * 1.5 : // More forgiving on landing ramps
            this.softLandingThreshold;

        if (impactSpeed > effectiveThreshold) {
            // Hard landing - reduce speed
            const reduction = 0.6 + (0.3 * (effectiveThreshold / impactSpeed));
            this.speed *= reduction;
        } else {
            // Soft landing - minimal speed loss
            this.speed *= 0.95;
        }
    }

    updateCamera(camera) {
        if (!this.isOccupied) return;

        if (this.cameraMode === '1st') {
            this.updateFirstPersonCamera(camera);
        } else {
            this.updateThirdPersonCamera(camera);
        }
    }

    updateFirstPersonCamera(camera) {
        // Override in subclass
    }

    updateThirdPersonCamera(camera) {
        const offset = this.thirdPersonOffset.clone();
        // Raise camera when airborne
        if (this.isAirborne) {
            offset.y += 2;
            offset.z += 3;
        }
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);

        camera.position.copy(this.mesh.position).add(offset);
        camera.lookAt(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
    }

    getPosition() {
        return this.mesh.position.clone();
    }

    getExitPosition() {
        const exitOffset = new THREE.Vector3(-2, 0, 0);
        exitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        return this.mesh.position.clone().add(exitOffset);
    }

    // Getters for HUD
    getSpeed() {
        return Math.abs(this.speed);
    }

    getCurrentGear() {
        return this.currentGear;
    }
}

/**
 * Motorbike - First vehicle implementation
 */
class Motorbike extends Vehicle {
    constructor(scene, position) {
        super(scene, position);

        // Motorbike-specific settings
        this.maxSpeed = 47; // 169 km/h
        this.acceleration = 22;
        this.handling = 3.0;
        this.name = 'Motorbike';
        this.groundOffset = 0.35;
        this.launchMinSpeed = 10;

        this.createModel();
        scene.add(this.mesh);
    }

    createModel() {
        // Materials
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.3,
            metalness: 0.8
        });

        const chromeMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.1,
            metalness: 1.0
        });

        const seatMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d2d2d,
            roughness: 0.8,
            metalness: 0.1
        });

        const tireMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.0
        });

        const accentMaterial = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            roughness: 0.4,
            metalness: 0.6,
            emissive: 0xff3366,
            emissiveIntensity: 0.2
        });

        // Create Chassis Group (for suspension movement)
        this.chassis = new THREE.Group();
        this.mesh.add(this.chassis);

        // Main body frame
        const bodyGeometry = new THREE.BoxGeometry(0.4, 0.5, 2.0);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, 0.6, 0);
        this.chassis.add(body);

        // Fuel tank
        const tankGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.8);
        const tank = new THREE.Mesh(tankGeometry, accentMaterial);
        tank.position.set(0, 0.95, -0.2);
        this.chassis.add(tank);

        // Seat
        const seatGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.7);
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.set(0, 1.0, 0.5);
        this.chassis.add(seat);

        // Front fork (attached to chassis for now, though technically moves with wheel)
        // For simple suspension, we'll move the whole body up/down
        const forkGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
        const leftFork = new THREE.Mesh(forkGeometry, chromeMaterial);
        leftFork.position.set(-0.15, 0.6, -0.9);
        leftFork.rotation.x = 0.3;
        this.chassis.add(leftFork);

        const rightFork = new THREE.Mesh(forkGeometry, chromeMaterial);
        rightFork.position.set(0.15, 0.6, -0.9);
        rightFork.rotation.x = 0.3;
        this.chassis.add(rightFork);

        // Handlebars
        this.handlebars = new THREE.Group();

        const handlebarStem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.5),
            chromeMaterial
        );
        handlebarStem.position.set(0, 1.15, -0.7);
        this.handlebars.add(handlebarStem);

        const handlebarCross = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.8),
            chromeMaterial
        );
        handlebarCross.rotation.z = Math.PI / 2;
        handlebarCross.position.set(0, 1.35, -0.7);
        this.handlebars.add(handlebarCross);

        // Grips
        const gripGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.15);
        const leftGrip = new THREE.Mesh(gripGeometry, seatMaterial);
        leftGrip.rotation.z = Math.PI / 2;
        leftGrip.position.set(-0.45, 1.35, -0.7);
        this.handlebars.add(leftGrip);

        const rightGrip = new THREE.Mesh(gripGeometry, seatMaterial);
        rightGrip.rotation.z = Math.PI / 2;
        rightGrip.position.set(0.45, 1.35, -0.7);
        this.handlebars.add(rightGrip);

        this.chassis.add(this.handlebars);

        // Headlight
        const headlightGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffee,
            emissive: 0xffffee,
            emissiveIntensity: 0.5
        });
        const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlight.position.set(0, 0.9, -1.15);
        this.chassis.add(headlight);

        // Exhaust pipes
        const exhaustGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.8);
        const exhaust = new THREE.Mesh(exhaustGeometry, chromeMaterial);
        exhaust.rotation.x = Math.PI / 2;
        exhaust.position.set(0.25, 0.4, 0.6);
        this.chassis.add(exhaust);

        // Rear fender
        const fenderGeometry = new THREE.BoxGeometry(0.35, 0.1, 0.5);
        const fender = new THREE.Mesh(fenderGeometry, bodyMaterial);
        fender.position.set(0, 0.55, 1.1);
        this.chassis.add(fender);

        // Tail light
        const taillightGeometry = new THREE.BoxGeometry(0.2, 0.08, 0.05);
        const taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.3
        });
        const taillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
        taillight.position.set(0, 0.65, 1.35);
        this.chassis.add(taillight);

        // WHEELS (Separate from chassis, attached to main mesh)
        // Front wheel
        this.frontWheel = this.createWheel(tireMaterial, chromeMaterial);
        this.frontWheel.position.set(0, 0.35, -1.0);
        this.mesh.add(this.frontWheel);

        // Rear wheel
        this.rearWheel = this.createWheel(tireMaterial, chromeMaterial);
        this.rearWheel.position.set(0, 0.35, 0.9);
        this.mesh.add(this.rearWheel);
    }

    createWheel(tireMaterial, hubMaterial) {
        const wheelGroup = new THREE.Group();

        // Tire
        const tireGeometry = new THREE.TorusGeometry(0.3, 0.1, 8, 16);
        const tire = new THREE.Mesh(tireGeometry, tireMaterial);
        tire.rotation.y = Math.PI / 2;
        wheelGroup.add(tire);

        // Hub
        const hubGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15);
        const hub = new THREE.Mesh(hubGeometry, hubMaterial);
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(hub);

        // Spokes
        const spokeGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.25);
        for (let i = 0; i < 6; i++) {
            const spoke = new THREE.Mesh(spokeGeometry, hubMaterial);
            spoke.rotation.z = Math.PI / 2;
            spoke.rotation.y = (i / 6) * Math.PI;
            wheelGroup.add(spoke);
        }

        return wheelGroup;
    }

    update(delta, input) {
        super.update(delta, input);

        if (!this.isOccupied) return;

        // Animate wheels based on speed
        const wheelRotation = this.speed * delta * 3;
        if (this.frontWheel) {
            this.frontWheel.rotation.x += wheelRotation;
        }
        if (this.rearWheel) {
            this.rearWheel.rotation.x += wheelRotation;
        }

        // Lean the bike based on steering (only when grounded)
        if (!this.isAirborne) {
            const targetLean = -input.steer * 0.15 * Math.min(1, Math.abs(this.speed) / 10);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetLean, 0.1);
        }

        // Pitch based on acceleration/airborne
        if (!this.isAirborne) {
            // When grounded, level out (or we could align to ground normal later)
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, 0.1);
            // Reset roll when grounded
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, 0.1);
        } else {
            // In air: Manual control (handled in handleInput), no auto-leveling
            // Just apply a tiny bit of drag to rotation? No, user wants full control.
        }

        // === SUSPENSION ANIMATION ===
        if (!this.suspensionY) this.suspensionY = 0;

        // Target suspension compression
        let targetSuspension = 0;

        if (!this.isAirborne) {
            // Compress based on speed/bumps (simple noise)
            if (Math.abs(this.speed) > 1) {
                targetSuspension = -0.02 * Math.sin(Date.now() * 0.02);
            }
        } else {
            // Extend suspension in air
            targetSuspension = 0.05;
        }

        // Smoothly interpolate
        this.suspensionY = THREE.MathUtils.lerp(this.suspensionY, targetSuspension, 0.2);

        // Apply to chassis
        if (this.chassis) {
            this.chassis.position.y = this.suspensionY;
        }
    }

    // Override handleLanding to add suspension impact
    handleLanding(groundHeight, groundInfo) {
        super.handleLanding(groundHeight, groundInfo);

        // Dynamic compression based on impact speed
        // impactSpeed usually 0-50. 
        // Small jump ~10 -> -0.1
        // Big jump ~30 -> -0.3
        const compression = Math.min(0.4, (this.lastImpactSpeed || 0) * 0.015);
        this.suspensionY = -compression;
    }

    updateFirstPersonCamera(camera) {
        // Position: Relative to bike
        const eyeOffset = new THREE.Vector3(0, 1.6, -0.4);
        eyeOffset.applyQuaternion(this.mesh.quaternion); // Rotate offset by bike rotation
        camera.position.copy(this.mesh.position).add(eyeOffset);

        // Rotation: Match bike rotation exactly
        // We might want to add a slight offset or smoothing, but for now lock it
        camera.quaternion.copy(this.mesh.quaternion);

        // Rotate camera 180 deg around Y if the model is backward? 
        // No, model forward is -Z. Camera forward is -Z. Should be fine.
        // But wait, if we want to "look" around while driving?
        // User said "when looking up... flip". This implies looking IS flipping.
        // So we don't need independent camera look.
    }
}

/**
 * VehicleManager - Manages all vehicles in the game
 */
export class VehicleManager {
    constructor(scene, vibes, haptic) {
        this.scene = scene;
        this.vehicles = [];
        this.vibes = vibes;
        this.haptic = haptic;
    }

    createMotorbike(position) {
        const motorbike = new Motorbike(this.scene, position);
        // Inject haptics into vehicle
        motorbike.vibes = this.vibes;
        motorbike.haptic = this.haptic;

        this.vehicles.push(motorbike);
        return motorbike;
    }


    getNearestVehicle(playerPosition) {
        let nearest = null;
        let nearestDistance = Infinity;

        for (const vehicle of this.vehicles) {
            if (vehicle.isOccupied) continue;

            const distance = playerPosition.distanceTo(vehicle.getPosition());
            if (distance < INTERACTION_DISTANCE && distance < nearestDistance) {
                nearest = vehicle;
                nearestDistance = distance;
            }
        }

        return nearest;
    }

    isPlayerNearVehicle(playerPosition) {
        return this.getNearestVehicle(playerPosition) !== null;
    }

    enterVehicle(playerPosition) {
        const vehicle = this.getNearestVehicle(playerPosition);
        if (vehicle) {
            vehicle.enter();
            this.currentVehicle = vehicle;
            return vehicle;
        }
        return null;
    }

    exitVehicle() {
        if (this.currentVehicle) {
            const exitPos = this.currentVehicle.getExitPosition();
            this.currentVehicle.exit();
            this.currentVehicle = null;
            return exitPos;
        }
        return null;
    }

    getCurrentVehicle() {
        return this.currentVehicle;
    }

    isInVehicle() {
        return this.currentVehicle !== null && this.currentVehicle.isOccupied;
    }

    update(delta, input) {
        if (this.currentVehicle && this.currentVehicle.isOccupied) {
            this.currentVehicle.update(delta, input);
        }
    }

    updateCamera(camera) {
        if (this.currentVehicle && this.currentVehicle.isOccupied) {
            this.currentVehicle.updateCamera(camera);
        }
    }

    toggleCameraMode() {
        if (this.currentVehicle) {
            this.currentVehicle.toggleCameraMode();
        }
    }

    setGravity(val) {
        this.vehicles.forEach(v => v.setGravity(val));
    }
}

export { INTERACTION_DISTANCE, HOLD_DURATION };
