
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// Import game assets
import { createEnvironment, buildLights, preloadEnvironmentAssets } from '../locations/world.js';
import { createMountains } from '../locations/mountains.js';
import { createTrees, preloadTrees } from '../locations/trees.js';
import { preloadRadioTower, createRadioTower } from '../locations/radiotower.js';
import { preloadLookout, createLookout } from '../locations/lookout.js';
import { preloadWarehouse, createWarehouse } from '../locations/warehouse.js';
import { createFiringRange } from '../locations/firing-range.js';
import { PublicCinema } from '../locations/public-cinema.js';
import { createDirtJumps } from '../locations/dirt-jumps.js';
import { CollisionManager } from '../core/collisions.js';

let scene, camera, renderer;
let orbitControls, transformControls;
let raycaster;
let mouse = new THREE.Vector2();
let selectedObject = null;
let selectionBox = null;

// Track loaded objects for selection
const editorObjects = [];

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(200, 200, 0x555555, 0x333333);
    scene.add(gridHelper);

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Selection Box Helper
    selectionBox = new THREE.BoxHelper();
    selectionBox.material.depthTest = false;
    selectionBox.material.transparent = true;
    selectionBox.visible = false;
    scene.add(selectionBox);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 50);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', function (event) {
        orbitControls.enabled = !event.value;
    });
    transformControls.addEventListener('change', () => {
        updateUIFromSelection();
    });
    scene.add(transformControls);

    raycaster = new THREE.Raycaster();

    // Lights
    buildLights(scene);

    // 2. Load World
    loadWorld();

    // 3. Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    // UI Listeners
    setupUI();

    // Animation Loop
    renderer.setAnimationLoop(animate);
}

async function loadWorld() {
    const loadingOverlay = document.getElementById('loading-overlay');

    try {
        console.log('🌍 Loading world assets...');

        // Disable collision debugging visuals by default
        CollisionManager.setDebug(false);

        // Preload everything
        const texLoader = new THREE.TextureLoader();
        const sandTex = await new Promise(r => texLoader.load('assets/textures/sand.jpg', r));

        await Promise.all([
            preloadEnvironmentAssets(renderer),
            preloadTrees(),
            preloadRadioTower(),
            preloadLookout(),
            preloadWarehouse()
        ]);

        // Create Environment
        createEnvironment(scene, renderer);
        createMountains(scene, sandTex);

        // Create Interactive Objects
        const treesGroup = new THREE.Group();
        treesGroup.name = "Trees_Group";
        scene.add(treesGroup);
        createTrees(scene);

        const tower = createRadioTower(scene);
        if (tower) {
            tower.name = "Radio_Tower";
            editorObjects.push(tower);
        }

        const lookout = createLookout(scene);
        if (lookout) {
            lookout.name = "Lookout_Tower";
            editorObjects.push(lookout);
        }

        const warehouse = createWarehouse(scene);
        if (warehouse) {
            warehouse.name = "Warehouse";
            editorObjects.push(warehouse);
        }

        createFiringRange(scene);

        // Mock socket for Cinema
        const mockSocket = { on: () => { }, emit: () => { } };
        const cinema = new PublicCinema(scene, mockSocket);

        // Fix: CSS3DRenderer blocks OrbitControls, so we disable pointer events on its container
        if (cinema.css3dRenderer) {
            cinema.css3dRenderer.domElement.style.pointerEvents = 'none';
        }

        editorObjects.push(cinema.cinemaGroup); // Make cinema selectable (it exposes .cinemaGroup)

        createDirtJumps(scene);

        console.log('✅ World Loaded!');
        loadingOverlay.style.display = 'none';

    } catch (err) {
        console.error('Failed to load world:', err);
        loadingOverlay.innerHTML = `Error: ${err.message}`;
    }
}

function onPointerDown(event) {
    // Ignore clicks on UI elements
    if (event.target.closest('#toolbar') || event.target.closest('#properties-panel')) {
        return;
    }

    // Ignore clicks while dragging gizmo
    if (transformControls.dragging) {
        return;
    }

    // Calculate mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Raycast against everything in scene
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        let validTarget = null;

        // Filter out helpers
        for (const hit of intersects) {
            let obj = hit.object;
            let isHelper = false;
            let traverse = obj;

            // Check ancestry for helpers
            while (traverse) {
                if (traverse === transformControls ||
                    traverse === selectionBox ||
                    traverse.type === 'GridHelper' ||
                    traverse.type === 'AxesHelper') {
                    isHelper = true;
                    break;
                }
                traverse = traverse.parent;
            }

            if (!isHelper) {
                validTarget = obj;
                break; // Found first valid non-helper object
            }
        }

        if (validTarget) {
            // Traverse up to find root editable object
            let root = validTarget;
            while (root.parent && root.parent !== scene) {
                if (editorObjects.includes(root)) {
                    break;
                }
                root = root.parent;
            }

            // Prefer editor objects, otherwise just select the group/mesh
            if (editorObjects.includes(root)) {
                selectObject(root);
            } else {
                selectObject(root);
            }
        } else {
            return;
        }
    } else {
        // Clicked empty space
        selectObject(null);
    }
}

function selectObject(object) {
    if (selectedObject === object) return;

    selectedObject = object;

    if (object) {
        transformControls.attach(object);
        selectionBox.setFromObject(object);
        selectionBox.visible = true;
        document.getElementById('properties-panel').style.display = 'block';
        updateUIFromSelection();
    } else {
        transformControls.detach();
        selectionBox.visible = false;
        document.getElementById('properties-panel').style.display = 'none';
    }
}

function updateUIFromSelection() {
    if (!selectedObject) return;

    // Update box helper
    if (selectionBox.visible) selectionBox.update();

    const els = {
        name: document.getElementById('obj-name'),
        posX: document.getElementById('pos-x'),
        posY: document.getElementById('pos-y'),
        posZ: document.getElementById('pos-z'),
        rotX: document.getElementById('rot-x'),
        rotY: document.getElementById('rot-y'),
        rotZ: document.getElementById('rot-z'),
        scaleX: document.getElementById('scale-x'),
        scaleY: document.getElementById('scale-y'),
        scaleZ: document.getElementById('scale-z'),
        code: document.getElementById('code-snippet')
    };

    // Update UI values only if NOT currently focused (to prevent overwriting user typing)
    // Actually typically we want 2-way binding. 
    // Ideally we check if activeElement is one of the inputs.
    const active = document.activeElement;

    els.name.value = selectedObject.name || 'Unnamed Object';

    if (active !== els.posX) els.posX.value = selectedObject.position.x.toFixed(2);
    if (active !== els.posY) els.posY.value = selectedObject.position.y.toFixed(2);
    if (active !== els.posZ) els.posZ.value = selectedObject.position.z.toFixed(2);

    if (active !== els.rotX) els.rotX.value = (selectedObject.rotation.x * 180 / Math.PI).toFixed(1);
    if (active !== els.rotY) els.rotY.value = (selectedObject.rotation.y * 180 / Math.PI).toFixed(1);
    if (active !== els.rotZ) els.rotZ.value = (selectedObject.rotation.z * 180 / Math.PI).toFixed(1);

    if (active !== els.scaleX) els.scaleX.value = selectedObject.scale.x.toFixed(2);
    if (active !== els.scaleY) els.scaleY.value = selectedObject.scale.y.toFixed(2);
    if (active !== els.scaleZ) els.scaleZ.value = selectedObject.scale.z.toFixed(2);

    // Generate Code Snippet
    const nameSanitized = (selectedObject.name || 'Object').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const code = `const ${nameSanitized}_POSITION = { x: ${els.posX.value}, y: ${els.posY.value}, z: ${els.posZ.value} };\nconst ${nameSanitized}_ROTATION = { x: ${els.rotX.value}, y: ${els.rotY.value}, z: ${els.rotZ.value} };`;
    els.code.value = code;
}

function applyTransformFromUI() {
    if (!selectedObject) return;

    const els = {
        posX: document.getElementById('pos-x'),
        posY: document.getElementById('pos-y'),
        posZ: document.getElementById('pos-z'),
        rotX: document.getElementById('rot-x'),
        rotY: document.getElementById('rot-y'),
        rotZ: document.getElementById('rot-z'),
        scaleX: document.getElementById('scale-x'),
        scaleY: document.getElementById('scale-y'),
        scaleZ: document.getElementById('scale-z')
    };

    selectedObject.position.set(
        parseFloat(els.posX.value),
        parseFloat(els.posY.value),
        parseFloat(els.posZ.value)
    );

    selectedObject.rotation.set(
        parseFloat(els.rotX.value) * Math.PI / 180,
        parseFloat(els.rotY.value) * Math.PI / 180,
        parseFloat(els.rotZ.value) * Math.PI / 180
    );

    selectedObject.scale.set(
        parseFloat(els.scaleX.value),
        parseFloat(els.scaleY.value),
        parseFloat(els.scaleZ.value)
    );

    updateUIFromSelection(); // Refresh code snippet and box helper
}

function onKeyDown(event) {
    if (!selectedObject) return;

    // Ignore if typing in input
    if (event.target.tagName === 'INPUT') return;

    switch (event.key.toLowerCase()) {
        case 'q': transformControls.setMode('translate'); updateActiveBtn('btn-translate'); break;
        case 'w': transformControls.setMode('translate'); updateActiveBtn('btn-translate'); break;
        case 'e': transformControls.setMode('rotate'); updateActiveBtn('btn-rotate'); break;
        case 'r': transformControls.setMode('scale'); updateActiveBtn('btn-scale'); break;
        case 'escape': selectObject(null); break;
    }
}

function setupUI() {
    document.getElementById('btn-select').onclick = () => { transformControls.enabled = false; updateActiveBtn('btn-select'); };
    document.getElementById('btn-translate').onclick = () => { transformControls.enabled = true; transformControls.setMode('translate'); updateActiveBtn('btn-translate'); };
    document.getElementById('btn-rotate').onclick = () => { transformControls.enabled = true; transformControls.setMode('rotate'); updateActiveBtn('btn-rotate'); };
    document.getElementById('btn-scale').onclick = () => { transformControls.enabled = true; transformControls.setMode('scale'); updateActiveBtn('btn-scale'); };
    document.getElementById('btn-reset').onclick = () => { camera.position.set(0, 50, 50); camera.lookAt(0, 0, 0); };

    // Inputs
    const inputs = document.querySelectorAll('#properties-panel input');
    inputs.forEach(input => {
        input.addEventListener('change', applyTransformFromUI);
        input.addEventListener('input', applyTransformFromUI); // Real-time update
    });

    document.getElementById('btn-copy-code').onclick = () => {
        const code = document.getElementById('code-snippet');
        code.select();
        navigator.clipboard.writeText(code.value);
    };
}

function updateActiveBtn(id) {
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    orbitControls.update();
    renderer.render(scene, camera);
}

init();
