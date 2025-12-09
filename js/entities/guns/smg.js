import * as THREE from 'three';
import { DEFAULT_FP_ANIM, DEFAULT_TP_ANIM } from '../weapon-constants.js';

const textureLoader = new THREE.TextureLoader();
let smgMetalTexture = null;

function getSmgMetalTexture() {
    if (!smgMetalTexture) {
        smgMetalTexture = textureLoader.load('assets/textures/smg-metal.jpg');
        smgMetalTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return smgMetalTexture;
}

export const SMG_DATA = {
    name: 'SMG',
    damage: 12,
    magSize: 50,
    reserveAmmo: 150,
    reloadTime: 1.5,
    fireRate: 100,
    hipPosition: new THREE.Vector3(0.2, -0.3, -.8),
    adsPosition: new THREE.Vector3(0, -0.1, -0.4),
    barrelLength: 0.3,
    zoomFOV: 60,
    recoil: { hip: 0.03, ads: 0.01 },
    spread: { hip: 0.015, ads: 0.005 }
};

export const SMG_ANIM = {
    fp: {
        hipPosition: SMG_DATA.hipPosition.clone(),
        adsPosition: SMG_DATA.adsPosition.clone(),
        sprintPosition: new THREE.Vector3(0, 0, 0),
        reloadPosition: new THREE.Vector3(.2, 0.0, -0.65),
        reloadRotation: new THREE.Euler(.55, 0, -0.75),
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
            walk: new THREE.Vector3(.1, -.1, 0),
            sprint: new THREE.Vector3(.1, -.2, 0)
        },
        bobSway: {
            walk: { sway: .02, bob: .05 },
            sprint: { sway: .04, bob: 0.1 },
            ads: { sway: 0.01, bob: 0.01 }
        }
    },
    tp: { ...DEFAULT_TP_ANIM }
};

export function buildSmgModel() {
    const gunGroup = new THREE.Group();
    const metalTex = getSmgMetalTexture();

    const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({
        map: metalTex,
        roughness: 0.35,
        metalness: 0.85
    });
    gunGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

    const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16);
    const barrelMat = new THREE.MeshStandardMaterial({
        map: metalTex,
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.95
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.3;
    barrel.position.y = 0.05;
    gunGroup.add(barrel);

    const magGeo = new THREE.BoxGeometry(0.05, 0.2, 0.08);
    const magMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const mag = new THREE.Mesh(magGeo, magMat);
    mag.position.y = -0.15;
    mag.position.z = 0.05;
    gunGroup.add(mag);

    const sightGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const sightMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.5,
        metalness: 0.8,
        transparent: true,
        opacity: 0.3
    });
    const sight = new THREE.Mesh(sightGeo, sightMat);
    sight.position.y = 0.095;
    sight.position.z = 0.18;
    gunGroup.add(sight);

    const frontSightGeo = new THREE.BoxGeometry(0.01, 0.05, 0.02);
    const frontSightMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 1
    });
    const frontSight = new THREE.Mesh(frontSightGeo, frontSightMat);
    frontSight.position.y = 0.080;
    frontSight.position.z = -0.44;
    gunGroup.add(frontSight);

    return gunGroup;
}
