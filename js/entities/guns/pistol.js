import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { DEFAULT_FP_ANIM, DEFAULT_TP_ANIM } from '../weapon-constants.js';

const textureLoader = new THREE.TextureLoader();
const fbxLoader = new FBXLoader();

const PISTOL_FBX_PATH = 'assets/FBXgun/source/Lowpoly%20New.fbx';
const PISTOL_TEXTURE_ROOT = 'assets/FBXgun/textures/';
const PISTOL_TEXTURE_SETS = {
    barrel: {
        map: 'Barrel_albedo.jpg',
        normalMap: 'Barrel_normal.png',
        roughnessMap: 'Barrel_roughness.jpg',
        metalnessMap: 'Barrel_metallic.jpg',
        aoMap: 'Barrel_AO.jpg'
    },
    frame: {
        map: 'Frame_albedo.jpg',
        normalMap: 'Frame_normal.png',
        roughnessMap: 'Frame_roughness.jpg',
        metalnessMap: 'Frame_metallic.jpg',
        aoMap: 'Frame_AO.jpg'
    },
    slide: {
        map: 'Slide_albedo.jpg',
        normalMap: 'Slide_normal.png',
        roughnessMap: 'Slide_roughness.jpg',
        metalnessMap: 'Slide_metallic.jpg',
        aoMap: 'Slide_AO.jpg'
    },
    magazine: {
        map: 'Magazine_albedo.jpg',
        normalMap: 'Magazine_normal.png',
        roughnessMap: 'Magazine_roughness.jpg',
        metalnessMap: 'Magazine_metallic.jpg',
        aoMap: 'Magazine_AO.jpg'
    }
};

const PISTOL_MODEL_ADJUST = {
    scale: 0.005,
    rotation: new THREE.Euler(0, 0, 0), // Pistol faces forward
    position: new THREE.Vector3(0.1, -0.12, -0.25)
};

let pistolFbxTemplate = null;
const pistolTextureCache = new Map();

// --- DATA ---
export const PISTOL_DATA = {
    name: 'Pistol',
    damage: 20,
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 2.0,
    fireRate: 100,
    hipPosition: new THREE.Vector3(0.2, -0.3, -0.8),
    adsPosition: new THREE.Vector3(0, -0.05, -0.6),
    barrelLength: 0.3,
    zoomFOV: 50,
    recoil: { hip: 0.03, ads: 0.01 },
    spread: { hip: 0.02, ads: 0.005 }
};

export const PISTOL_ANIM = {
    fp: {
        hipPosition: PISTOL_DATA.hipPosition.clone(),
        adsPosition: PISTOL_DATA.adsPosition.clone(),
        sprintPosition: new THREE.Vector3(0.4, -0.5, -0.9),
        sprintRotation: new THREE.Euler(-0.25, 0.4, 0.3),
        reloadPosition: new THREE.Vector3(0.3, -0.5, -0.7),
        reloadRotation: new THREE.Euler(-0.4, 0, 0.25),
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
            walk: new THREE.Vector3(0, 0, 0),
            sprint: new THREE.Vector3(0, 0, 0)
        },
        bobSway: {
            walk: { sway: 0.001, bob: 0.018 },
            sprint: { sway: 0.06, bob: 0.04 },
            ads: { sway: 0.0025, bob: 0.006 }
        }
    },
    tp: { ...DEFAULT_TP_ANIM }
};


// --- ASSET LOADING HELPERS ---

function loadPistolTexture(fileName, isColor = false) {
    const path = `${PISTOL_TEXTURE_ROOT}${fileName}`;
    if (pistolTextureCache.has(path)) {
        return pistolTextureCache.get(path);
    }
    const tex = textureLoader.load(path);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    pistolTextureCache.set(path, tex);
    return tex;
}

function preloadPistolTexture(fileName, isColor = false) {
    const path = `${PISTOL_TEXTURE_ROOT}${fileName}`;
    if (pistolTextureCache.has(path)) {
        const cached = pistolTextureCache.get(path);
        if (cached.image && cached.image.complete !== false) return Promise.resolve(cached);
    }
    return new Promise((resolve, reject) => {
        const tex = textureLoader.load(
            path,
            (loaded) => resolve(loaded),
            undefined,
            (err) => reject(err)
        );
        if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
        pistolTextureCache.set(path, tex);
    });
}

function applyPistolTextures(material) {
    const name = material.name ? material.name.toLowerCase() : '';
    const setKey = Object.keys(PISTOL_TEXTURE_SETS).find(key => name.includes(key));
    if (!setKey) return;

    const maps = PISTOL_TEXTURE_SETS[setKey];
    if (maps.map) material.map = loadPistolTexture(maps.map, true);
    if (maps.normalMap) material.normalMap = loadPistolTexture(maps.normalMap);
    if (maps.roughnessMap) material.roughnessMap = loadPistolTexture(maps.roughnessMap);
    if (maps.metalnessMap) material.metalnessMap = loadPistolTexture(maps.metalnessMap);
    if (maps.aoMap) material.aoMap = loadPistolTexture(maps.aoMap);
    material.needsUpdate = true;
}

function loadPistolModelFBX() {
    if (pistolFbxTemplate) {
        return Promise.resolve(pistolFbxTemplate);
    }

    return new Promise((resolve, reject) => {
        // Set resource path to textures folder to prevent 404s on relative paths
        fbxLoader.setResourcePath(PISTOL_TEXTURE_ROOT);
        fbxLoader.load(
            PISTOL_FBX_PATH,
            (fbx) => {
                fbx.scale.setScalar(PISTOL_MODEL_ADJUST.scale);
                fbx.rotation.copy(PISTOL_MODEL_ADJUST.rotation);
                fbx.position.copy(PISTOL_MODEL_ADJUST.position);

                fbx.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            applyPistolTextures(child.material);
                        }
                    }
                });

                pistolFbxTemplate = fbx;
                resolve(fbx);
            },
            undefined,
            (err) => reject(err)
        );
    });
}

export function preloadPistolAssets() {
    const pistolMaps = Object.values(PISTOL_TEXTURE_SETS).flatMap((maps) => [
        maps.map ? preloadPistolTexture(maps.map, true) : null,
        maps.normalMap ? preloadPistolTexture(maps.normalMap) : null,
        maps.roughnessMap ? preloadPistolTexture(maps.roughnessMap) : null,
        maps.metalnessMap ? preloadPistolTexture(maps.metalnessMap) : null,
        maps.aoMap ? preloadPistolTexture(maps.aoMap) : null
    ]).filter(Boolean);

    const tasks = [
        loadPistolModelFBX()
            .then((fbx) => {
                pistolFbxTemplate = fbx;
                return fbx;
            })
            .catch((err) => {
                console.warn('[Weapons] Pistol FBX preload failed:', err);
                return null;
            }),
        ...pistolMaps
    ];

    return Promise.all(tasks);
}


// --- BUILDER (Primitive Version) ---
export function buildPistolModel() {
    const gunGroup = new THREE.Group();

    // Global adjustments
    gunGroup.scale.setScalar(2.1);
    gunGroup.position.set(0, -0.17, -0.19);

    const slideGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
    const slideMat = new THREE.MeshStandardMaterial({ color: 0xd0c8c8, roughness: 0.55, metalness: 0.45 });
    const slide = new THREE.Mesh(slideGeo, slideMat);
    slide.position.set(0, 0.07, 0);
    gunGroup.add(slide);

    const gripGeo = new THREE.BoxGeometry(0.03, 0.15, 0.05);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.5 });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.02, 0.08);
    gunGroup.add(grip);

    const frontsightGeo = new THREE.BoxGeometry(0.005, 0.03, 0.01);
    const frontsightMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const frontsight = new THREE.Mesh(frontsightGeo, frontsightMat);
    frontsight.position.set(0, 0.09, -0.14);
    gunGroup.add(frontsight);

    const barrelGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0.07, -0.08);
    barrel.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(barrel);

    const shroudGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.17, 16);
    const shroudMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const shroud = new THREE.Mesh(shroudGeo, shroudMat);
    shroud.position.set(0, 0.08, 0);
    shroud.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(shroud);

    const leftrailGeo = new THREE.BoxGeometry(0.005, 0.03, 0.1);
    const leftrailMat = new THREE.MeshStandardMaterial({ color: 0x525252, roughness: 0.5, metalness: 0.5 });
    const leftrail = new THREE.Mesh(leftrailGeo, leftrailMat);
    leftrail.position.set(0.01, 0.09, 0.11);
    gunGroup.add(leftrail);

    const rightrailGeo = new THREE.BoxGeometry(0.005, 0.03, 0.1);
    const rightrailMat = new THREE.MeshStandardMaterial({ color: 0x525252, roughness: 0.5, metalness: 0.5 });
    const rightrail = new THREE.Mesh(rightrailGeo, rightrailMat);
    rightrail.position.set(-0.01, 0.09, 0.11);
    gunGroup.add(rightrail);

    const frameGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.17, 16);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x9a8d8d, roughness: 0.5, metalness: 0.5 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 0.06, 0);
    frame.rotation.set(Math.PI / 2, 0.0000, 0.0000);
    gunGroup.add(frame);

    const triggerguardGeo = new THREE.BoxGeometry(0.02, 0.01, 0.03);
    const triggerguardMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const triggerguard = new THREE.Mesh(triggerguardGeo, triggerguardMat);
    triggerguard.position.set(0, 0.01, 0.04);
    gunGroup.add(triggerguard);

    const triggerGeo = new THREE.BoxGeometry(0.02, 0.01, 0.05);
    const triggerMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.5 });
    const trigger = new THREE.Mesh(triggerGeo, triggerMat);
    trigger.position.set(0, 0.03, 0.01);
    trigger.rotation.set(0.7854, 0.0000, 0.0000);
    gunGroup.add(trigger);

    return gunGroup;
}
