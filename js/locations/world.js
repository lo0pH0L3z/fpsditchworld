import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const textureLoader = new THREE.TextureLoader();
let floorTextureCache = null;
let hdrEnvPromise = null;
let hdrEnvTexture = null;

function getFloorTexture() {
    if (!floorTextureCache) {
        floorTextureCache = textureLoader.load('assets/textures/sand.jpg');
        floorTextureCache.wrapS = floorTextureCache.wrapT = THREE.RepeatWrapping;
        floorTextureCache.repeat.set(32, 32);
        floorTextureCache.anisotropy = 12;
        floorTextureCache.colorSpace = THREE.SRGBColorSpace;
    }
    return floorTextureCache;
}

function preloadFloorTexture() {
    if (floorTextureCache && floorTextureCache.image && floorTextureCache.image.complete !== false) {
        return Promise.resolve(floorTextureCache);
    }
    return new Promise((resolve, reject) => {
        floorTextureCache = textureLoader.load(
            'assets/textures/sand.jpg',
            (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(32, 32);
                tex.anisotropy = 12;
                tex.colorSpace = THREE.SRGBColorSpace;
                resolve(tex);
            },
            undefined,
            (err) => reject(err)
        );
    });
}


export function buildLights(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 12, 7.5);
    scene.add(dirLight);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.9);
    scene.add(hemi);

    const rimLight = new THREE.PointLight(0xffffff, 0.4, 30);
    rimLight.position.set(0, 6, -15);
    scene.add(rimLight);
}

function loadHdrEnvironment(renderer) {
    if (hdrEnvPromise) return hdrEnvPromise;

    hdrEnvPromise = new Promise((resolve, reject) => {
        new RGBELoader().load('test.hdr', (hdrTexture) => {
            hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

            if (renderer) {
                const pmremGenerator = new THREE.PMREMGenerator(renderer);
                pmremGenerator.compileEquirectangularShader();
                const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
                hdrTexture.dispose();
                pmremGenerator.dispose();
                hdrEnvTexture = envMap;
                resolve(envMap);
            } else {
                hdrEnvTexture = hdrTexture;
                resolve(hdrTexture);
            }
        }, undefined, (error) => {
            hdrEnvTexture = null;
            reject(error);
        });
    });

    return hdrEnvPromise;
}

export function preloadEnvironmentAssets(renderer) {
    const tasks = [preloadFloorTexture()];
    tasks.push(loadHdrEnvironment(renderer).catch((err) => {
        console.warn('HDR preload failed:', err);
        return null;
    }));
    return Promise.all(tasks);
}

export function createEnvironment(scene, renderer) {
    // Floor removed - replaced by mountains.js terrain to avoid z-fighting and texture mismatch

    // NOTE: Walls and pillars are now created by firing-range.js
    // This keeps each "place" on the map self-contained in its own module

    // Apply HDR environment lighting if available.
    loadHdrEnvironment(renderer)
        .then((envMap) => {
            if (envMap) {
                scene.environment = envMap;
                scene.background = envMap;
                // floorMaterial was removed when we switched to mountains.js
                // floorMaterial.envMap = envMap;
                // floorMaterial.envMapIntensity = 1.35;
                // floorMaterial.needsUpdate = true;
            }
        })
        .catch((error) => {
            console.error('Failed to load HDR environment:', error);
        });
}

