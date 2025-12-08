import * as THREE from 'three';

const BASE_SPEED_RANGE = [1, 3];
const BASE_BOB_RANGE = [0.2, 0.6];

export function createTarget(scene) {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0x550000,
        metalness: 0.5,
        roughness: 0.2
    });
    const target = new THREE.Mesh(geometry, material);

    target.position.set(
        (Math.random() - 0.5) * 40,
        1 + Math.random() * 5,
        -10 - Math.random() * 10
    );

    scene.add(target);

    return {
        mesh: target,
        speed: (Math.random() * (BASE_SPEED_RANGE[1] - BASE_SPEED_RANGE[0]) + BASE_SPEED_RANGE[0]) * (Math.random() < 0.5 ? 1 : -1),
        bobSpeed: Math.random() * (BASE_BOB_RANGE[1] - BASE_BOB_RANGE[0]) + BASE_BOB_RANGE[0],
        bobPhase: Math.random() * Math.PI * 2
    };
}

export function spawnTargets(scene, existingTargets = [], count = 5) {
    existingTargets.forEach(t => scene.remove(t.mesh));
    const newTargets = [];
    for (let i = 0; i < count; i++) {
        newTargets.push(createTarget(scene));
    }
    return newTargets;
}

export function updateTargets(targets, delta) {
    targets.forEach(t => {
        t.mesh.position.x += t.speed * delta;
        if (t.mesh.position.x > 20 || t.mesh.position.x < -20) {
            t.speed *= -1;
        }
        t.mesh.position.y = 1 + Math.sin(t.bobPhase) * 0.5;
        t.bobPhase += t.bobSpeed * delta;
    });
}
