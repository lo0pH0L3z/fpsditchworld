import * as THREE from 'three';
import { DEFAULT_FP_ANIM, DEFAULT_TP_ANIM } from '../weapon-constants.js';

export const SMG2_DATA = {
    name: 'SMG Type 2',
    damage: 12,
    magSize: 35,
    reserveAmmo: 150,
    reloadTime: 1.2,
    fireRate: 150,
    hipPosition: new THREE.Vector3(0.2, -0.25, -0.85),
    adsPosition: new THREE.Vector3(0, -0.1, -0.75),
    barrelLength: 0.3,
    zoomFOV: 60,
    recoil: { hip: 0.04, ads: 0.01 },
    spread: { hip: 0.02, ads: 0.01 }
};

export const SMG2_ANIM = {
    fp: {
        hipPosition: SMG2_DATA.hipPosition.clone(),
        adsPosition: SMG2_DATA.adsPosition.clone(),
        sprintPosition: new THREE.Vector3(0, 0, 0),
        reloadPosition: new THREE.Vector3(.2, 0.0, -0.65),
        reloadRotation: new THREE.Euler(.55, 0, -0.75),
        armsOffset: DEFAULT_FP_ANIM.armsOffset.clone(),
        forearms: {
            left: {
                position: new THREE.Vector3(-0.2, -0.4, -0.2),
                rotation: new THREE.Euler(-Math.PI / 2, 0, -0.5)
            },
            right: DEFAULT_FP_ANIM.forearms.right
        },
        hands: {
            left: {
                position: new THREE.Vector3(0.0, -0.3, -0.5),
                rotation: new THREE.Euler(0, 0, 0)
            },
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

export function buildSmg2Model() {
    const gunGroup = new THREE.Group();

    // Global adjustments
    gunGroup.scale.setScalar(1.65);
    gunGroup.position.set(0, 0.175, 0.78);

    const handleGeo = new THREE.BoxGeometry(0.03, 0.17, 0.05);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0, -0.17, -0.46);
    handle.rotation.set(-0.3491, 0.0000, 0.0000);
    gunGroup.add(handle);

    const mainbodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.43, 16);
    const mainbodyMat = new THREE.MeshStandardMaterial({ color: 0xc9c9c9, roughness: 0.25, metalness: 1 });
    const mainbody = new THREE.Mesh(mainbodyGeo, mainbodyMat);
    mainbody.position.set(0, -0.1, -0.57);
    mainbody.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(mainbody);

    const maghousingGeo = new THREE.BoxGeometry(0.03, 0.17, 0.03);
    const maghousingMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const maghousing = new THREE.Mesh(maghousingGeo, maghousingMat);
    maghousing.position.set(0, -0.19, -0.68);
    gunGroup.add(maghousing);

    const barrelbaseGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16);
    const barrelbaseMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const barrelbase = new THREE.Mesh(barrelbaseGeo, barrelbaseMat);
    barrelbase.position.set(0, -0.1, -0.59);
    barrelbase.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(barrelbase);

    const barreltipGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.57, 16);
    const barreltipMat = new THREE.MeshStandardMaterial({ color: 0xc7c7c7, roughness: 0.35, metalness: 1 });
    const barreltip = new THREE.Mesh(barreltipGeo, barreltipMat);
    barreltip.position.set(0, -0.1, -0.61);
    barreltip.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(barreltip);

    const stockconnectGeo = new THREE.BoxGeometry(0.02, 0.17, 0.03);
    const stockconnectMat = new THREE.MeshStandardMaterial({ color: 0x9c9c9c, roughness: 0.75, metalness: 0.5 });
    const stockconnect = new THREE.Mesh(stockconnectGeo, stockconnectMat);
    stockconnect.position.set(0, -0.13, -0.72);
    stockconnect.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(stockconnect);

    const stockbarGeo = new THREE.BoxGeometry(0.01, 0.07, 0.01);
    const stockbarMat = new THREE.MeshStandardMaterial({ color: 0xc7c7c7, roughness: 0.5, metalness: 0.5 });
    const stockbar = new THREE.Mesh(stockbarGeo, stockbarMat);
    stockbar.position.set(0, -0.07, -0.79);
    stockbar.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(stockbar);

    const stockendGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16);
    const stockendMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const stockend = new THREE.Mesh(stockendGeo, stockendMat);
    stockend.position.set(0, -0.1, -0.82);
    stockend.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(stockend);

    const backcapGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const backcapMat = new THREE.MeshStandardMaterial({ color: 0x9c9c9c, roughness: 0.25, metalness: 1 });
    const backcap = new THREE.Mesh(backcapGeo, backcapMat);
    backcap.position.set(0, -0.1, -0.37);
    gunGroup.add(backcap);

    const detailboxGeo = new THREE.BoxGeometry(0.01, 0.11, 0.02);
    const detailboxMat = new THREE.MeshStandardMaterial({ color: 0xd6d6d6, roughness: 1, metalness: 1 });
    const detailbox = new THREE.Mesh(detailboxGeo, detailboxMat);
    detailbox.position.set(0, -0.1, -0.76);
    gunGroup.add(detailbox);

    return gunGroup;
}
