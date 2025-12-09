import * as THREE from 'three';

export const HIP_POSITION = new THREE.Vector3(0.3, -0.3, -0.5);
export const ADS_POSITION = new THREE.Vector3(0, -0.21, -0.4);

// Default Animation Profile
export const DEFAULT_FP_ANIM = {
    hipPosition: HIP_POSITION.clone(),
    adsPosition: ADS_POSITION.clone(),
    sprintPosition: new THREE.Vector3(0, 0, 0),
    reloadPosition: new THREE.Vector3(HIP_POSITION.x, HIP_POSITION.y - 0.25, HIP_POSITION.z),
    reloadRotation: new THREE.Euler(-0.5, 0, 0.2),
    armsOffset: new THREE.Vector3(0, 0.05, 0.05),
    forearms: {
        left: {
            position: new THREE.Vector3(-0.2, -0.4, -0.2),
            rotation: new THREE.Euler(-Math.PI / 2, 0, -0.5)
        },
        right: {
            position: new THREE.Vector3(0.0, -0.2, 0.6),
            rotation: new THREE.Euler(-Math.PI / 2, 0, 0)
        }
    },
    hands: {
        left: {
            position: new THREE.Vector3(0.0, -0.3, -0.5),
            rotation: new THREE.Euler(0, 0, 0)
        },
        right: {
            position: new THREE.Vector3(0.0, -0.2, 0.0),
            rotation: new THREE.Euler(0, 0, 0)
        }
    },
    moveOffsets: {
        walk: new THREE.Vector3(0, 0, 0),
        sprint: new THREE.Vector3(0, 0, 0)
    },
    bobSway: {
        walk: { sway: 0.006, bob: 0.012 },
        sprint: { sway: 0.008, bob: 0.016 },
        ads: { sway: 0.002, bob: 0.004 }
    }
};

export const DEFAULT_TP_ANIM = {
    handSocket: {
        position: new THREE.Vector3(0.25, -0.2, -0.15),
        rotation: new THREE.Euler(0, Math.PI, 0)
    },
    aimOffset: new THREE.Euler(0, 0, 0),
    idleWeaponRotation: new THREE.Euler(0, 0, 0)
};
