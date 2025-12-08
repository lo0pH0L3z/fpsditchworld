import * as THREE from 'three';
import { CollisionManager } from '../core/collisions.js';

/**
 * Firing Range System - Self-contained module for the firing range area
 * 
 * All collision detection is handled by CollisionManager
 */

// Materials shared across firing range elements
function createMaterials() {
    // Create wall texture procedurally
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.fillStyle = '#888888';
    ctx.fillRect(8, 8, 984, 984);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 496, 1000, 8);

    const wallTexture = new THREE.CanvasTexture(canvas);
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(2, 1);
    wallTexture.anisotropy = 4;
    wallTexture.colorSpace = THREE.SRGBColorSpace;

    return {
        wall: new THREE.MeshStandardMaterial({
            color: 0xCBBD93,
            emissive: 0x000000,
            roughness: 0,
            metalness: 0,
            map: wallTexture,
            emissiveMap: wallTexture,
            emissiveIntensity: 0
        }),
        pillar: new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x002233,
            roughness: 0.6,
            metalness: 0.5
        }),
        strip: new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            metalness: 0.6,
            roughness: 0.2,
            side: THREE.DoubleSide
        }),
        stripBlue: new THREE.MeshStandardMaterial({
            color: 0x0066ff,
            emissive: 0x0066ff,
            emissiveIntensity: 0.8,
            metalness: 0.6,
            roughness: 0.2,
            side: THREE.DoubleSide
        })
    };
}

/**
 * Main export: Create the firing range with proper collision
 */
export function createFiringRange(scene) {
    const materials = createMaterials();

    // ========================================
    // FLOOR - 50x50 concrete slab
    // ========================================
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        materials.wall
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, 0); // Slight offset to avoid z-fighting with terrain
    scene.add(floor);

    // ========================================
    // WALLS - Visual meshes + CollisionManager registration
    // ========================================

    // Back Wall (tall, can't jump over)
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(50, 10, 1),
        materials.wall
    );
    backWall.position.set(0, 5, -25);
    scene.add(backWall);

    // Add glowing strips to back wall
    const addStrip = (parent, width, height, material, offsetY, offsetZ) => {
        const stripGeo = new THREE.PlaneGeometry(width, height);
        const strip = new THREE.Mesh(stripGeo, material);
        strip.position.set(0, offsetY, offsetZ);
        parent.add(strip);
    };
    addStrip(backWall, 20, 0.4, materials.strip, -3, 0.51);
    addStrip(backWall, 20, 0.4, materials.stripBlue, 3, 0.51);

    CollisionManager.addBox({
        name: 'backWall',
        centerX: 0,
        centerZ: -25,
        width: 50,
        depth: 1,
        height: 10,
        baseY: 0
    });

    // Left Wall (shorter, can jump over)
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 50),
        materials.wall
    );
    leftWall.position.set(-25, 1, 0);
    scene.add(leftWall);

    CollisionManager.addBox({
        name: 'leftWall',
        centerX: -25,
        centerZ: 0,
        width: 1,
        depth: 50,
        height: 2,
        baseY: 0
    });

    // Right Wall (shorter, can jump over)
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 50),
        materials.wall
    );
    rightWall.position.set(25, 1, 0);
    scene.add(rightWall);

    CollisionManager.addBox({
        name: 'rightWall',
        centerX: 25,
        centerZ: 0,
        width: 1,
        depth: 50,
        height: 2,
        baseY: 0
    });

    // ========================================
    // PILLARS - Visual meshes + CollisionManager registration
    // ========================================

    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 60, 12);
    const pillarPositions = [
        { name: 'pillar_NW', x: -22, z: -20 },
        { name: 'pillar_NE', x: 22, z: -20 },
        { name: 'pillar_SW', x: -22, z: 20 },
        { name: 'pillar_SE', x: 22, z: 20 }
    ];

    for (const pos of pillarPositions) {
        // Visual pillar
        const pillar = new THREE.Mesh(pillarGeo, materials.pillar);
        pillar.position.set(pos.x, 30, pos.z);
        scene.add(pillar);

        // Glow light
        const glow = new THREE.PointLight(0x00ccff, 0.4, 12);
        glow.position.set(pos.x, 5, pos.z);
        scene.add(glow);

        // Register collision with CollisionManager
        CollisionManager.addCylinder({
            name: pos.name,
            x: pos.x,
            z: pos.z,
            radius: 0.5,
            height: 10,
            baseY: 0
        });
    }

    console.log('');
    console.log('🎯 === FIRING RANGE INITIALIZED ===');
    console.log(`🧱 Walls: 3 (back, left, right)`);
    console.log(`🏛️ Pillars: 4 (corners)`);
    console.log(`📍 Location: Center of map (0, 0)`);
    console.log(`✅ Registered ${CollisionManager.count} colliders with CollisionManager`);
    console.log('');
}
