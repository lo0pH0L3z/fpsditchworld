import * as THREE from 'three';
import { HIP_POSITION, ADS_POSITION, DEFAULT_FP_ANIM, DEFAULT_TP_ANIM } from './weapon-constants.js';

// Import Gun Modules
import { SMG_DATA, SMG_ANIM, buildSmgModel } from './guns/smg.js';
import { SMG2_DATA, SMG2_ANIM, buildSmg2Model } from './guns/smg2.js';
import { PISTOL_DATA, PISTOL_ANIM, buildPistolModel, preloadPistolAssets } from './guns/pistol.js';
import { SNIPER_DATA, SNIPER_ANIM, buildSniperModel } from './guns/sniper.js';
import { CHLOBANATOR_DATA, CHLOBANATOR_ANIM, buildChlobanatorModel } from './guns/chlobanator.js';

// Re-export shared constants for script.js compatibility
export const hipPosition = HIP_POSITION;
export const adsPosition = ADS_POSITION;
export const hipRotation = new THREE.Euler(0, 0, 0);
export const adsRotation = new THREE.Euler(0, 0, 0);

// --- WEAPON DATA REGISTRY ---
export const WEAPONS = {
    SMG: SMG_DATA,
    SMG2: SMG2_DATA,
    PISTOL: PISTOL_DATA,
    SNIPER: SNIPER_DATA,
    CHLOBANATOR: CHLOBANATOR_DATA
};

export const WEAPON_ANIMATIONS = {
    SMG: SMG_ANIM,
    SMG2: SMG2_ANIM,
    PISTOL: PISTOL_ANIM,
    SNIPER: SNIPER_ANIM,
    CHLOBANATOR: CHLOBANATOR_ANIM,
    DEFAULT: {
        fp: DEFAULT_FP_ANIM,
        tp: DEFAULT_TP_ANIM
    }
};

// --- DATA ACCESSORS ---
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

// --- ANIMATION CLONING ---
function cloneVec3(v) {
    return v ? new THREE.Vector3(v.x, v.y, v.z) : null;
}

function cloneEuler(e) {
    return e ? new THREE.Euler(e.x, e.y, e.z, e.order) : null;
}

function cloneAnimProfile(profile) {
    if (!profile) return cloneAnimProfile(WEAPON_ANIMATIONS.DEFAULT);
    const bobSway = profile.fp?.bobSway || DEFAULT_FP_ANIM.bobSway;
    return {
        fp: {
            hipPosition: cloneVec3(profile.fp?.hipPosition) || cloneVec3(DEFAULT_FP_ANIM.hipPosition),
            adsPosition: cloneVec3(profile.fp?.adsPosition) || cloneVec3(DEFAULT_FP_ANIM.adsPosition),
            sprintPosition: cloneVec3(profile.fp?.sprintPosition) || cloneVec3(DEFAULT_FP_ANIM.sprintPosition),
            sprintRotation: cloneEuler(profile.fp?.sprintRotation) || cloneEuler(DEFAULT_FP_ANIM.sprintRotation),
            reloadPosition: cloneVec3(profile.fp?.reloadPosition) || cloneVec3(DEFAULT_FP_ANIM.reloadPosition),
            reloadRotation: cloneEuler(profile.fp?.reloadRotation) || cloneEuler(DEFAULT_FP_ANIM.reloadRotation),
            armsOffset: cloneVec3(profile.fp?.armsOffset) || cloneVec3(DEFAULT_FP_ANIM.armsOffset),
            forearms: {
                left: {
                    position: cloneVec3(profile.fp?.forearms?.left?.position) || cloneVec3(DEFAULT_FP_ANIM.forearms.left.position),
                    rotation: cloneEuler(profile.fp?.forearms?.left?.rotation) || cloneEuler(DEFAULT_FP_ANIM.forearms.left.rotation)
                },
                right: {
                    position: cloneVec3(profile.fp?.forearms?.right?.position) || cloneVec3(DEFAULT_FP_ANIM.forearms.right.position),
                    rotation: cloneEuler(profile.fp?.forearms?.right?.rotation) || cloneEuler(DEFAULT_FP_ANIM.forearms.right.rotation)
                }
            },
            hands: {
                left: {
                    position: cloneVec3(profile.fp?.hands?.left?.position) || cloneVec3(DEFAULT_FP_ANIM.hands.left.position),
                    rotation: cloneEuler(profile.fp?.hands?.left?.rotation) || cloneEuler(DEFAULT_FP_ANIM.hands.left.rotation)
                },
                right: {
                    position: cloneVec3(profile.fp?.hands?.right?.position) || cloneVec3(DEFAULT_FP_ANIM.hands.right.position),
                    rotation: cloneEuler(profile.fp?.hands?.right?.rotation) || cloneEuler(DEFAULT_FP_ANIM.hands.right.rotation)
                }
            },
            moveOffsets: {
                walk: cloneVec3(profile.fp?.moveOffsets?.walk) || cloneVec3(DEFAULT_FP_ANIM.moveOffsets.walk),
                sprint: cloneVec3(profile.fp?.moveOffsets?.sprint) || cloneVec3(DEFAULT_FP_ANIM.moveOffsets.sprint)
            },
            bobSway: {
                walk: { ...DEFAULT_FP_ANIM.bobSway.walk, ...(bobSway.walk || {}) },
                sprint: { ...DEFAULT_FP_ANIM.bobSway.sprint, ...(bobSway.sprint || {}) },
                ads: { ...DEFAULT_FP_ANIM.bobSway.ads, ...(bobSway.ads || {}) }
            }
        },
        tp: {
            handSocket: {
                position: cloneVec3(profile.tp?.handSocket?.position) || cloneVec3(DEFAULT_TP_ANIM.handSocket.position),
                rotation: cloneEuler(profile.tp?.handSocket?.rotation) || cloneEuler(DEFAULT_TP_ANIM.handSocket.rotation)
            },
            aimOffset: cloneEuler(profile.tp?.aimOffset) || cloneEuler(DEFAULT_TP_ANIM.aimOffset),
            idleWeaponRotation: cloneEuler(profile.tp?.idleWeaponRotation) || cloneEuler(DEFAULT_TP_ANIM.idleWeaponRotation)
        }
    };
}

export function getWeaponAnimConfig(name) {
    return cloneAnimProfile(WEAPON_ANIMATIONS[name] || WEAPON_ANIMATIONS.DEFAULT);
}

// --- MODEL CACHE ---
const weaponModelCache = {
    SMG: null,
    SMG2: null,
    PISTOL: null,
    SNIPER: null,
    CHLOBANATOR: null
};

// --- ASSET PRELOADING ---
export function preloadWeaponAssets() {
    // Only Pistol currently has external assets (FBX/Textures) that need async loading
    // SMG metal texture is handled internally in buildSmgModel's first call or we could export a preloader from there if we wanted strictly parallel loading.
    // For now, let's just make sure Pistol is ready.
    return preloadPistolAssets();
}

// --- MODEL PRE-BUILDING ---
export async function prebuildWeaponModels() {
    const startTime = performance.now();
    console.log('[Weapons] 🔧 Pre-building weapon models...');

    // SMG
    const smgStart = performance.now();
    const smgGroup = new THREE.Group();
    smgGroup.add(buildSmgModel());
    weaponModelCache.SMG = smgGroup;
    console.log(`[Weapons] ✅ SMG model built (${(performance.now() - smgStart).toFixed(2)}ms)`);

    // SMG2
    const smg2Start = performance.now();
    const smg2Group = new THREE.Group();
    smg2Group.add(buildSmg2Model());
    weaponModelCache.SMG2 = smg2Group;
    console.log(`[Weapons] ✅ SMG2 model built (${(performance.now() - smg2Start).toFixed(2)}ms)`);

    // PISTOL
    const pistolStart = performance.now();
    const pistolGroup = new THREE.Group();
    pistolGroup.add(buildPistolModel());
    weaponModelCache.PISTOL = pistolGroup;
    console.log(`[Weapons] ✅ Pistol model built (${(performance.now() - pistolStart).toFixed(2)}ms)`);

    // SNIPER
    const sniperStart = performance.now();
    const sniperGroup = new THREE.Group();
    sniperGroup.add(buildSniperModel());
    weaponModelCache.SNIPER = sniperGroup;
    console.log(`[Weapons] ✅ Sniper model built (${(performance.now() - sniperStart).toFixed(2)}ms)`);

    // CHLOBANATOR
    const chloStart = performance.now();
    const chloGroup = new THREE.Group();
    chloGroup.add(buildChlobanatorModel());
    weaponModelCache.CHLOBANATOR = chloGroup;
    console.log(`[Weapons] ✅ CHLOBANATOR model built (${(performance.now() - chloStart).toFixed(2)}ms)`);

    const totalTime = performance.now() - startTime;
    console.log(`[Weapons] 🎮 All weapon models cached and ready (Total: ${totalTime.toFixed(2)}ms)`);

    return weaponModelCache;
}

// --- FACTORY ---
export function createGun(scene, camera, weaponType = 'SMG', existingGunGroup = null) {
    const startTime = performance.now();

    if (existingGunGroup) {
        camera.remove(existingGunGroup);
    }

    let gunGroup;

    if (weaponModelCache[weaponType]) {
        gunGroup = weaponModelCache[weaponType].clone(true);
    } else {
        console.warn(`[Weapons] ⚠️ NO CACHED MODEL for ${weaponType}, building on-the-fly!`);
        gunGroup = new THREE.Group();
        switch (weaponType) {
            case 'SMG': gunGroup.add(buildSmgModel()); break;
            case 'SMG2': gunGroup.add(buildSmg2Model()); break;
            case 'PISTOL': gunGroup.add(buildPistolModel()); break;
            case 'SNIPER': gunGroup.add(buildSniperModel()); break;
            case 'CHLOBANATOR': gunGroup.add(buildChlobanatorModel()); break;
            default: gunGroup.add(buildSmgModel()); break;
        }
    }

    camera.add(gunGroup);
    scene.add(camera);

    const animConfig = getWeaponAnimConfig(weaponType);
    const initialPos = animConfig.fp?.hipPosition || WEAPONS[weaponType]?.hipPosition || hipPosition;
    gunGroup.position.copy(initialPos);

    return gunGroup;
}
