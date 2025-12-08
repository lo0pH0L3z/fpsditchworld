import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

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

let smgMetalTexture = null;
let pistolFbxTemplate = null;
const pistolTextureCache = new Map();

// Weapon model cache for instant switching
const weaponModelCache = {
    SMG: null,
    PISTOL: null,
    SNIPER: null
};

function getSmgMetalTexture() {
    if (!smgMetalTexture) {
        smgMetalTexture = textureLoader.load('assets/textures/smg-metal.jpg');
        smgMetalTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return smgMetalTexture;
}

export const hipPosition = new THREE.Vector3(0.3, -0.3, -0.5);
export const adsPosition = new THREE.Vector3(0, -0.21, -0.4);
export const hipRotation = new THREE.Euler(0, 0, 0);
export const adsRotation = new THREE.Euler(0, 0, 0);

export const WEAPONS = {
    SMG: {
        name: 'SMG',
        damage: 12,
        magSize: 50,
        reserveAmmo: 150,
        reloadTime: 1.5,
        fireRate: 100,
        hipPosition: new THREE.Vector3(0.3, -0.25, -0.5),
        adsPosition: new THREE.Vector3(0, -0.1, -0.4),
        barrelLength: 0.3,
        zoomFOV: 60,
        recoil: { hip: 0.03, ads: 0.01 },
        spread: { hip: 0.015, ads: 0.005 }
    },
    PISTOL: {
        name: 'Pistol',
        damage: 25,
        magSize: 12,
        reserveAmmo: 60,
        reloadTime: 1,
        fireRate: 250,
        hipPosition: new THREE.Vector3(0.75, -2.28, -1.38), // user-tuned offsets
        adsPosition: new THREE.Vector3(-0.10, -1.7, -1.30),
        barrelLength: 0.22,
        zoomFOV: 60,
        recoil: { hip: 0.02, ads: 0.01 },
        spread: { hip: 0.02, ads: 0.01 }
    },
    SNIPER: {
        name: 'Sniper',
        damage: 90,
        magSize: 5,
        reserveAmmo: 20,
        reloadTime: 3.0,
        fireRate: 800,
        hipPosition: new THREE.Vector3(0.4, -0.3, -0.6),
        adsPosition: new THREE.Vector3(0, -0.095, -0.3),
        barrelLength: 0.6,
        zoomFOV: 20,
        recoil: { hip: 0.08, ads: 0.02 },
        spread: { hip: 0.0, ads: 0.0 }
    }
};

export function getWeapon(name) {
    return WEAPONS[name];
}

export function getDefaultAmmo(name) {
    const weapon = getWeapon(name);
    return {
        currentAmmo: weapon ? weapon.magSize : 0,
        reserveAmmo: weapon ? weapon.reserveAmmo : 0
    };
}

function buildPrimitiveSmg() {
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

function buildPrimitivePistol() {
    const gunGroup = new THREE.Group();

    const frameGeo = new THREE.BoxGeometry(0.08, 0.1, 0.2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.6, metalness: 0.4 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, -0.03, 0);
    gunGroup.add(frame);

    const slideGeo = new THREE.BoxGeometry(0.08, 0.04, 0.22);
    const slideMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.7 });
    const slide = new THREE.Mesh(slideGeo, slideMat);
    slide.position.set(0, 0.04, -0.02);
    gunGroup.add(slide);

    const barrelGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.18);
    gunGroup.add(barrel);

    const gripGeo = new THREE.BoxGeometry(0.05, 0.12, 0.06);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.7, metalness: 0.2 });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.1, 0.05);
    grip.rotation.x = 0.2;
    gunGroup.add(grip);

    return gunGroup;
}

function buildPrimitiveSniper() {
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

function preloadSmgTexture() {
    if (smgMetalTexture && smgMetalTexture.image && smgMetalTexture.image.complete !== false) {
        return Promise.resolve(smgMetalTexture);
    }
    return new Promise((resolve, reject) => {
        smgMetalTexture = textureLoader.load(
            'assets/textures/smg-metal.jpg',
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                resolve(tex);
            },
            undefined,
            (err) => reject(err)
        );
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

function loadPistolModel() {
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

export function preloadWeaponAssets() {
    const pistolMaps = Object.values(PISTOL_TEXTURE_SETS).flatMap((maps) => [
        maps.map ? preloadPistolTexture(maps.map, true) : null,
        maps.normalMap ? preloadPistolTexture(maps.normalMap) : null,
        maps.roughnessMap ? preloadPistolTexture(maps.roughnessMap) : null,
        maps.metalnessMap ? preloadPistolTexture(maps.metalnessMap) : null,
        maps.aoMap ? preloadPistolTexture(maps.aoMap) : null
    ]).filter(Boolean);

    const tasks = [
        preloadSmgTexture(),
        loadPistolModel()
            .then((fbx) => {
                // Clone once to validate the model is ready (helps surface load errors early)
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

export async function prebuildWeaponModels() {
    const startTime = performance.now();
    console.log('[Weapons] 🔧 Pre-building weapon models...');

    // Build SMG
    const smgStart = performance.now();
    const smgGroup = new THREE.Group();
    smgGroup.add(buildPrimitiveSmg());
    weaponModelCache.SMG = smgGroup;
    console.log(`[Weapons] ✅ SMG model built (${(performance.now() - smgStart).toFixed(2)}ms)`);

    // Build Pistol (wait for FBX if available)
    const pistolStart = performance.now();
    const pistolGroup = new THREE.Group();
    if (pistolFbxTemplate) {
        console.log('[Weapons] 🔫 Cloning pistol FBX template...');
        const model = pistolFbxTemplate.clone(true);
        console.log('[Weapons] 📦 Pistol FBX cloned, adding to group...');
        pistolGroup.add(model);
        console.log(`[Weapons] ✅ Pistol model built (FBX) (${(performance.now() - pistolStart).toFixed(2)}ms)`);
    } else {
        pistolGroup.add(buildPrimitivePistol());
        console.log(`[Weapons] ⚠️ Pistol model built (primitive fallback) (${(performance.now() - pistolStart).toFixed(2)}ms)`);
    }
    weaponModelCache.PISTOL = pistolGroup;
    console.log('[Weapons] 💾 Pistol cached:', weaponModelCache.PISTOL ? 'YES' : 'NO');

    // Build Sniper
    const sniperStart = performance.now();
    const sniperGroup = new THREE.Group();
    sniperGroup.add(buildPrimitiveSniper());
    weaponModelCache.SNIPER = sniperGroup;
    console.log(`[Weapons] ✅ Sniper model built (${(performance.now() - sniperStart).toFixed(2)}ms)`);

    const totalTime = performance.now() - startTime;
    console.log(`[Weapons] 🎮 All weapon models cached and ready (Total: ${totalTime.toFixed(2)}ms)`);

    // Return the models for GPU prewarming
    return {
        SMG: smgGroup,
        PISTOL: pistolGroup,
        SNIPER: sniperGroup
    };
}

export function createGun(scene, camera, weaponType = 'SMG', existingGunGroup = null) {
    const startTime = performance.now();
    // console.log(`[Weapons] 🔄 createGun called for ${weaponType}`);

    if (existingGunGroup) {
        camera.remove(existingGunGroup);
        // console.log('[Weapons] 🗑️ Removed existing gun group');
    }

    let gunGroup;

    // Check cache status
    /*
    console.log('[Weapons] 💾 Cache status:', {
        SMG: weaponModelCache.SMG ? 'CACHED' : 'MISSING',
        PISTOL: weaponModelCache.PISTOL ? 'CACHED' : 'MISSING',
        SNIPER: weaponModelCache.SNIPER ? 'CACHED' : 'MISSING'
    });
    */

    // Use cached weapon model if available (instant switching)
    if (weaponModelCache[weaponType]) {
        const cloneStart = performance.now();
        // console.log(`[Weapons] ✅ Found cached ${weaponType} model, cloning...`);
        gunGroup = weaponModelCache[weaponType].clone(true);
        // console.log(`[Weapons] 📋 Cloned ${weaponType} from cache (${(performance.now() - cloneStart).toFixed(2)}ms)`);
    } else {
        // Fallback: build on-the-fly (shouldn't happen if prebuild was called)
        console.warn(`[Weapons] ⚠️ NO CACHED MODEL for ${weaponType}, building on-the-fly!`);
        const buildStart = performance.now();
        gunGroup = new THREE.Group();

        if (weaponType === 'SMG') {
            gunGroup.add(buildPrimitiveSmg());
        } else if (weaponType === 'PISTOL') {
            console.warn('[Weapons] 🔫 Building pistol on-the-fly!');
            if (pistolFbxTemplate) {
                console.log('[Weapons] Cloning pistol FBX template...');
                const model = pistolFbxTemplate.clone(true);
                console.log('[Weapons] Adding pistol model to group...');
                gunGroup.add(model);
            } else {
                console.warn('[Weapons] No FBX template, using primitive!');
                gunGroup.add(buildPrimitivePistol());
            }
        } else if (weaponType === 'SNIPER') {
            gunGroup.add(buildPrimitiveSniper());
        }
        console.log(`[Weapons] Built ${weaponType} on-the-fly (${(performance.now() - buildStart).toFixed(2)}ms)`);
    }

    const addStart = performance.now();
    camera.add(gunGroup);
    scene.add(camera);
    // console.log(`[Weapons] Added to scene (${(performance.now() - addStart).toFixed(2)}ms)`);

    gunGroup.position.copy(WEAPONS[weaponType].hipPosition);

    const totalTime = performance.now() - startTime;
    // console.log(`[Weapons] ✨ createGun complete for ${weaponType} (Total: ${totalTime.toFixed(2)}ms)`);
    return gunGroup;
}
