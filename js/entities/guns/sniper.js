import * as THREE from 'three';
import { DEFAULT_FP_ANIM, DEFAULT_TP_ANIM } from '../weapon-constants.js';

export const SNIPER_DATA = {
    name: 'Sniper',
    damage: 90,
    magSize: 5,
    reserveAmmo: 20,
    reloadTime: 3.0,
    fireRate: 800,
    hipPosition: new THREE.Vector3(0.2, -0.3, -.8),
    adsPosition: new THREE.Vector3(0, -0.095, -0.3),
    barrelLength: 0.6,
    zoomFOV: 20,
    recoil: { hip: 0.08, ads: 0.02 },
    spread: { hip: 0.0, ads: 0.0 }
};

export const SNIPER_ANIM = {
    fp: {
        hipPosition: SNIPER_DATA.hipPosition.clone(),
        adsPosition: SNIPER_DATA.adsPosition.clone(),
        sprintPosition: new THREE.Vector3(0.65, -0.55, -0.9),
        sprintRotation: new THREE.Euler(-0.45, 0.25, 0.2),
        reloadPosition: new THREE.Vector3(0.5, -0.5, -0.75),
        reloadRotation: new THREE.Euler(-0.55, 0, 0.25),
        armsOffset: DEFAULT_FP_ANIM.armsOffset.clone(),
        forearms: {
            left: DEFAULT_FP_ANIM.forearms.left,
            right: DEFAULT_FP_ANIM.forearms.right
        },
        hands: {
            left: DEFAULT_FP_ANIM.hands.left,
            right: DEFAULT_FP_ANIM.hands.right
        },
        moveOffsets: {
            walk: new THREE.Vector3(0.05, 0, 0),
            sprint: new THREE.Vector3(0.1, -0.02, 0)
        },
        bobSway: {
            walk: { sway: 0.004, bob: 0.01 },
            sprint: { sway: 0.06, bob: 0.04 },
            ads: { sway: 0.001, bob: 0.0025 }
        }
    },
    tp: { ...DEFAULT_TP_ANIM }
};

export function buildSniperModel() {
    const gunGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.12, 0.12, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.z = -0.1;
    gunGroup.add(body);

    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.95 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.5;
    barrel.position.y = 0.04;
    gunGroup.add(barrel);

    const boltGeo = new THREE.BoxGeometry(0.08, 0.08, 0.15);
    const bolt = new THREE.Mesh(boltGeo, bodyMat);
    bolt.position.z = 0.2;
    bolt.position.y = 0.02;
    gunGroup.add(bolt);

    const magGeo = new THREE.BoxGeometry(0.04, 0.15, 0.06);
    const magMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const mag = new THREE.Mesh(magGeo, magMat);
    mag.position.y = -0.12;
    mag.position.z = 0.0;
    gunGroup.add(mag);

    const scopeRingGeo = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    const scopeRing1 = new THREE.Mesh(scopeRingGeo, scopeMat);
    scopeRing1.rotation.y = Math.PI / 2;
    scopeRing1.position.y = 0.095;
    scopeRing1.position.z = 0.1;
    gunGroup.add(scopeRing1);

    const scopeRing2 = new THREE.Mesh(scopeRingGeo, scopeMat);
    scopeRing2.rotation.y = Math.PI / 2;
    scopeRing2.position.y = 0.095;
    scopeRing2.position.z = -0.2;
    gunGroup.add(scopeRing2);

    const scopeTubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.35, 16);
    const scopeTube = new THREE.Mesh(scopeTubeGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6 }));
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.y = 0.095;
    scopeTube.position.z = -0.05;
    gunGroup.add(scopeTube);

    const stockGeo = new THREE.BoxGeometry(0.1, 0.15, 0.2);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8, metalness: 0.1 });
    const stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.z = 0.4;
    stock.position.y = -0.02;
    gunGroup.add(stock);

    return gunGroup;
}
