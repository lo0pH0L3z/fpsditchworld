import * as THREE from 'three';
import { DEFAULT_FP_ANIM, DEFAULT_TP_ANIM } from '../weapon-constants.js';

export const CHLOBANATOR_DATA = {
    name: 'CHLOBANATOR',
    damage: 100,
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 2.0,
    fireRate: 100,
    hipPosition: new THREE.Vector3(0.2, -0.3, -0.8),
    adsPosition: new THREE.Vector3(0, -0.105, -0.7),
    barrelLength: 0.3,
    zoomFOV: 50,
    recoil: { hip: 0.03, ads: 0.01 },
    spread: { hip: 0.02, ads: 0.005 }
};

export const CHLOBANATOR_ANIM = {
    fp: {
        hipPosition: CHLOBANATOR_DATA.hipPosition.clone(),
        adsPosition: CHLOBANATOR_DATA.adsPosition.clone(),
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

export function buildChlobanatorModel() {
    const gunGroup = new THREE.Group();

    // Global adjustments
    gunGroup.scale.setScalar(1.55);
    gunGroup.position.set(0, 0.02, -0.38);

    const cylinder1Geo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 16);
    const cylinder1Mat = new THREE.MeshStandardMaterial({ color: 0x15c1be, roughness: 0.5, metalness: 0.5 });
    const cylinder1 = new THREE.Mesh(cylinder1Geo, cylinder1Mat);
    cylinder1.position.set(-0.02, 0, -0.32);
    cylinder1.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(cylinder1);

    const cylinder1copyGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 16);
    const cylinder1copyMat = new THREE.MeshStandardMaterial({ color: 0x15c1be, roughness: 0.5, metalness: 0.5 });
    const cylinder1copy = new THREE.Mesh(cylinder1copyGeo, cylinder1copyMat);
    cylinder1copy.position.set(0.02, 0, -0.32);
    cylinder1copy.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(cylinder1copy);

    const box3Geo = new THREE.BoxGeometry(0.1, 0.07, 0.42);
    const box3Mat = new THREE.MeshStandardMaterial({ color: 0xca56d2, roughness: 0.5, metalness: 0.5 });
    const box3 = new THREE.Mesh(box3Geo, box3Mat);
    box3.position.set(0, 0, 0.04);
    gunGroup.add(box3);

    const box4Geo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
    const box4Mat = new THREE.MeshStandardMaterial({ color: 0x854ab5, roughness: 0.5, metalness: 0.5 });
    const box4 = new THREE.Mesh(box4Geo, box4Mat);
    box4.position.set(0, -0.09, 0.18);
    box4.rotation.set(-0.2618, 0.0000, 0.0000);
    gunGroup.add(box4);

    const cylinder1copy2Geo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16);
    const cylinder1copy2Mat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5, metalness: 0.5 });
    const cylinder1copy2 = new THREE.Mesh(cylinder1copy2Geo, cylinder1copy2Mat);
    cylinder1copy2.position.set(-0.02, 0, -0.32);
    cylinder1copy2.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(cylinder1copy2);

    const cylinder1copycopyGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 16);
    const cylinder1copycopyMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5, metalness: 0.5 });
    const cylinder1copycopy = new THREE.Mesh(cylinder1copycopyGeo, cylinder1copycopyMat);
    cylinder1copycopy.position.set(0.02, 0, -0.32);
    cylinder1copycopy.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(cylinder1copycopy);

    const frontgripGeo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
    const frontgripMat = new THREE.MeshStandardMaterial({ color: 0xc7a6e2, roughness: 0.5, metalness: 0.5 });
    const frontgrip = new THREE.Mesh(frontgripGeo, frontgripMat);
    frontgrip.position.set(0, -0.08, -0.14);
    gunGroup.add(frontgrip);

    const box4copycopyGeo = new THREE.BoxGeometry(0.03, 0.02, 0.32);
    const box4copycopyMat = new THREE.MeshStandardMaterial({ color: 0x3680ce, roughness: 0.5, metalness: 0.5 });
    const box4copycopy = new THREE.Mesh(box4copycopyGeo, box4copycopyMat);
    box4copycopy.position.set(0, 0.03, 0.11);
    gunGroup.add(box4copycopy);

    const rail2Geo = new THREE.BoxGeometry(0.01, 0.03, 0.32);
    const rail2Mat = new THREE.MeshStandardMaterial({ color: 0x3680ce, roughness: 0.5, metalness: 0.5 });
    const rail2 = new THREE.Mesh(rail2Geo, rail2Mat);
    rail2.position.set(-0.03, 0.04, 0.11);
    gunGroup.add(rail2);

    const rail1Geo = new THREE.BoxGeometry(0.01, 0.03, 0.32);
    const rail1Mat = new THREE.MeshStandardMaterial({ color: 0x3680ce, roughness: 0.5, metalness: 0.5 });
    const rail1 = new THREE.Mesh(rail1Geo, rail1Mat);
    rail1.position.set(0.03, 0.04, 0.11);
    gunGroup.add(rail1);

    const sraillbGeo = new THREE.BoxGeometry(0.01, 0.01, 0.6);
    const sraillbMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const sraillb = new THREE.Mesh(sraillbGeo, sraillbMat);
    sraillb.position.set(-0.05, 0, 0.08);
    sraillb.rotation.set(0.0000, -0.0175, 0.0000);
    gunGroup.add(sraillb);

    const srailltGeo = new THREE.BoxGeometry(0.005, 0.005, 0.44);
    const srailltMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const sraillt = new THREE.Mesh(srailltGeo, srailltMat);
    sraillt.position.set(-0.05, 0.02, 0);
    gunGroup.add(sraillt);

    const srailrtGeo = new THREE.BoxGeometry(0.005, 0.005, 0.44);
    const srailrtMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const srailrt = new THREE.Mesh(srailrtGeo, srailrtMat);
    srailrt.position.set(0.05, 0.02, 0);
    gunGroup.add(srailrt);

    const srailrbGeo = new THREE.BoxGeometry(0.01, 0.01, 0.6);
    const srailrbMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const srailrb = new THREE.Mesh(srailrbGeo, srailrbMat);
    srailrb.position.set(0.05, 0, 0.08);
    srailrb.rotation.set(0.0000, 0.0175, 0.0000);
    gunGroup.add(srailrb);

    const bodyback1Geo = new THREE.BoxGeometry(0.05, 0.02, 0.24);
    const bodyback1Mat = new THREE.MeshStandardMaterial({ color: 0xca56d2, roughness: 0.5, metalness: 0.5 });
    const bodyback1 = new THREE.Mesh(bodyback1Geo, bodyback1Mat);
    bodyback1.position.set(0, 0.01, 0.38);
    gunGroup.add(bodyback1);

    const sraillbcopyGeo = new THREE.BoxGeometry(0.01, 0.01, 0.7);
    const sraillbcopyMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const sraillbcopy = new THREE.Mesh(sraillbcopyGeo, sraillbcopyMat);
    sraillbcopy.position.set(-0.06, -0.02, 0.16);
    sraillbcopy.rotation.set(0.0000, -0.0349, 0.0000);
    gunGroup.add(sraillbcopy);

    const sraillbcopycopyGeo = new THREE.BoxGeometry(0.01, 0.01, 0.7);
    const sraillbcopycopyMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const sraillbcopycopy = new THREE.Mesh(sraillbcopycopyGeo, sraillbcopycopyMat);
    sraillbcopycopy.position.set(0.06, -0.02, 0.16);
    sraillbcopycopy.rotation.set(0.0000, 0.0349, 0.0000);
    gunGroup.add(sraillbcopycopy);

    const bodyback1copyGeo = new THREE.BoxGeometry(0.04, 0.02, 0.1);
    const bodyback1copyMat = new THREE.MeshStandardMaterial({ color: 0xca56d2, roughness: 0.5, metalness: 0.5 });
    const bodyback1copy = new THREE.Mesh(bodyback1copyGeo, bodyback1copyMat);
    bodyback1copy.position.set(0, -0.01, 0.45);
    gunGroup.add(bodyback1copy);

    const rail1copyGeo = new THREE.BoxGeometry(0.01, 0.01, 0.32);
    const rail1copyMat = new THREE.MeshStandardMaterial({ color: 0x15c1be, roughness: 0.5, metalness: 0.5 });
    const rail1copy = new THREE.Mesh(rail1copyGeo, rail1copyMat);
    rail1copy.position.set(0.02, 0.02, 0.35);
    gunGroup.add(rail1copy);

    const rail1copycopyGeo = new THREE.BoxGeometry(0.01, 0.01, 0.32);
    const rail1copycopyMat = new THREE.MeshStandardMaterial({ color: 0x15c1be, roughness: 0.5, metalness: 0.5 });
    const rail1copycopy = new THREE.Mesh(rail1copycopyGeo, rail1copycopyMat);
    rail1copycopy.position.set(-0.02, 0.02, 0.35);
    gunGroup.add(rail1copycopy);

    return gunGroup;
}
