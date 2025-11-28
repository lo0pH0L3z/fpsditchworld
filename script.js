
import * as THREE from 'three';

// --- Global Variables ---
let camera, scene, renderer;
let lastTime = 0;
let gamepadIndex = null;

// Movement & Aiming settings (will be updated from settings)
let WALK_SPEED = 10.0;
let SLIDE_SPEED = 20.0;
const SLIDE_DURATION = 1.0;
let JUMP_FORCE = 8.0;
const GRAVITY = 20.0;
const BASE_HEIGHT = 1.6;
const SLIDE_HEIGHT = 0.8;

let BASE_LOOK_SPEED_H = 2.0;  // Horizontal sensitivity
let BASE_LOOK_SPEED_V = 2.0;  // Vertical sensitivity  
let ADS_LOOK_SPEED = 0.5;
let currentLookSpeedH = BASE_LOOK_SPEED_H;
let currentLookSpeedV = BASE_LOOK_SPEED_V;

let pitch = 0;
let yaw = 0;

// Physics State
let velocity = new THREE.Vector3();
let isGrounded = true;
let isSliding = false;
let slideTimer = 0;

// Gun & ADS State
let gunGroup;
let isADS = false;
const hipPosition = new THREE.Vector3(0.3, -0.3, -0.5);
const adsPosition = new THREE.Vector3(0, -0.21, -0.4);
const hipRotation = new THREE.Euler(0, 0, 0);
const adsRotation = new THREE.Euler(0, 0, 0);

// Weapon System
const WEAPONS = {
    SMG: {
        name: 'SMG',
        magSize: 50,
        reserveAmmo: 150,
        reloadTime: 1.5,
        fireRate: 100,
        hipPosition: new THREE.Vector3(0.3, -0.25, -0.5),
        adsPosition: new THREE.Vector3(0, -0.095, -0.4), // Aligned: -0.095 + 0.095 (sight height) = 0
        barrelLength: 0.3,
        zoomFOV: 60
    },
    SNIPER: {
        name: 'Sniper',
        magSize: 5,
        reserveAmmo: 20,
        reloadTime: 3.0,
        fireRate: 800,
        hipPosition: new THREE.Vector3(0.4, -0.3, -0.6),
        adsPosition: new THREE.Vector3(0, -0.095, -0.3), // Aligned
        barrelLength: 0.6,
        zoomFOV: 20
    }
};

let currentWeapon = 'SMG';
let currentAmmo = WEAPONS.SMG.magSize;
let reserveAmmo = WEAPONS.SMG.reserveAmmo;
let isReloading = false;
let reloadProgress = 0;

// Game State
let score = 0;
let timeLeft = 60;
let isGameOver = false;
let targets = [];
const raycaster = new THREE.Raycaster();

// --- Sound Manager (Procedural Audio) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function playHitSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playEmptyClickSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function playMagEjectSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playMagInsertSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}


// Input State
const keys = {
    w: false, a: false, s: false, d: false,
    space: false, c: false, r: false, q: false,
    shift: false
};
const mouse = {
    left: false,
    right: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0
};

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = BASE_HEIGHT;
    camera.position.z = 5;

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    yaw = euler.y;
    pitch = euler.x;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Pointer Lock for Mouse Look
    document.body.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    createEnvironment();
    createGun('SMG');
    spawnTargets();
    updateAmmoDisplay();

    window.addEventListener('resize', onWindowResize);

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = true;
        if (e.code === 'Space') keys.space = true;
        if (e.shiftKey) keys.shift = true;

        if (key === 'r') reload();
        if (key === 'q') switchWeapon();
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
        if (e.code === 'Space') keys.space = false;
        if (!e.shiftKey) keys.shift = false;
    });

    // Mouse Listeners
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) mouse.left = true;
        if (e.button === 2) mouse.right = true;
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouse.left = false;
        if (e.button === 2) mouse.right = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body) {
            mouse.dx = e.movementX;
            mouse.dy = e.movementY;
        }
    });

    window.addEventListener("gamepadconnected", (e) => {
        console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
            e.gamepad.index, e.gamepad.id,
            e.gamepad.buttons.length, e.gamepad.axes.length);
        document.getElementById('instructions').innerText = `Controller Connected: ${e.gamepad.id}`;
        document.getElementById('instructions').style.color = '#0f0';
    });

    window.addEventListener("gamepaddisconnected", (e) => {
        console.log("Gamepad disconnected from index %d: %s",
            e.gamepad.index, e.gamepad.id);
        document.getElementById('instructions').innerText = "Controller Disconnected. Press any button to reconnect.";
        document.getElementById('instructions').style.color = 'rgba(0, 255, 255, 0.7)';
    });

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');

    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
        document.exitPointerLock(); // Release mouse when opening settings
        // Sync checkbox state
        document.getElementById('invert-look-modal').checked = document.getElementById('invert-look').checked;
    });

    closeSettings.addEventListener('click', () => {
        toggleSettings();
    });

    // Settings navigation state
    const settingsItems = [
        { id: 'walk-speed', type: 'slider', min: 5, max: 20, step: 1 },
        { id: 'slide-speed', type: 'slider', min: 10, max: 40, step: 1 },
        { id: 'jump-force', type: 'slider', min: 4, max: 15, step: 0.5 },
        { id: 'look-speed-h', type: 'slider', min: 0.5, max: 5, step: 0.1 },
        { id: 'look-speed-v', type: 'slider', min: 0.5, max: 5, step: 0.1 },
        { id: 'ads-speed', type: 'slider', min: 0.1, max: 2, step: 0.1 },
        { id: 'invert-look-modal', type: 'checkbox' }
    ];
    let currentSettingIndex = 0;
    let lastDpadTime = 0;
    let lastAdjustTime = 0;

    // Highlight current setting
    function highlightCurrentSetting() {
        // Remove all highlights
        settingsItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (element && element.parentElement) {
                element.parentElement.style.background = '';
                element.parentElement.style.border = '';
                element.parentElement.style.padding = '';
            }
        });

        // Highlight current
        const currentItem = settingsItems[currentSettingIndex];
        const element = document.getElementById(currentItem.id);
        if (element && element.parentElement) {
            element.parentElement.style.background = 'rgba(0, 255, 255, 0.2)';
            element.parentElement.style.border = '2px solid #0ff';
            element.parentElement.style.padding = '8px';
        }
    }

    // Controller settings navigation (called from handleInput when settings open)
    window.handleSettingsInput = function (gamepad) {
        const now = performance.now();

        // D-Pad Up/Down navigation (buttons 12 and 13, or axes 9)
        const dpadUp = gamepad.buttons[12] && gamepad.buttons[12].pressed;
        const dpadDown = gamepad.buttons[13] && gamepad.buttons[13].pressed;

        if ((dpadUp || dpadDown) && now - lastDpadTime > 300) {
            lastDpadTime = now;
            if (dpadUp && currentSettingIndex > 0) {
                currentSettingIndex--;
            } else if (dpadDown && currentSettingIndex < settingsItems.length - 1) {
                currentSettingIndex++;
            }
            highlightCurrentSetting();
        }

        // Adjust current setting using left stick X-axis or D-Pad Left/Right
        const currentItem = settingsItems[currentSettingIndex];
        const element = document.getElementById(currentItem.id);

        if (currentItem.type === 'slider') {
            const leftStickX = Math.abs(gamepad.axes[0]) > 0.2 ? gamepad.axes[0] : 0;
            const dpadLeft = gamepad.buttons[14] && gamepad.buttons[14].pressed;
            const dpadRight = gamepad.buttons[15] && gamepad.buttons[15].pressed;

            let adjustDirection = 0;
            if (dpadLeft) adjustDirection = -1;
            else if (dpadRight) adjustDirection = 1;
            else if (leftStickX !== 0) adjustDirection = leftStickX;

            if (adjustDirection !== 0 && now - lastAdjustTime > 100) {
                lastAdjustTime = now;
                const currentValue = parseFloat(element.value);
                const newValue = Math.max(
                    parseFloat(element.min),
                    Math.min(
                        parseFloat(element.max),
                        currentValue + (adjustDirection > 0 ? currentItem.step : -currentItem.step)
                    )
                );
                element.value = newValue;
                // Trigger the input event to update the game values
                element.dispatchEvent(new Event('input'));
            }
        } else if (currentItem.type === 'checkbox') {
            // Toggle with X button
            const xButton = gamepad.buttons[0] && gamepad.buttons[0].pressed;
            if (xButton && now - lastAdjustTime > 300) {
                lastAdjustTime = now;
                element.checked = !element.checked;
                element.dispatchEvent(new Event('change'));
            }
        }

        // Close settings with Circle button
        const circleButton = gamepad.buttons[1] && gamepad.buttons[1].pressed;
        if (circleButton && now - lastDpadTime > 300) {
            toggleSettings();
        }
    };

    // Initialize highlight
    setTimeout(() => highlightCurrentSetting(), 100);

    // Settings controls
    document.getElementById('walk-speed').addEventListener('input', (e) => {
        WALK_SPEED = parseFloat(e.target.value);
        document.getElementById('walk-speed-val').textContent = e.target.value;
    });

    document.getElementById('slide-speed').addEventListener('input', (e) => {
        SLIDE_SPEED = parseFloat(e.target.value);
        document.getElementById('slide-speed-val').textContent = e.target.value;
    });

    document.getElementById('jump-force').addEventListener('input', (e) => {
        JUMP_FORCE = parseFloat(e.target.value);
        document.getElementById('jump-force-val').textContent = e.target.value;
    });

    document.getElementById('look-speed-h').addEventListener('input', (e) => {
        BASE_LOOK_SPEED_H = parseFloat(e.target.value);
        document.getElementById('look-speed-h-val').textContent = parseFloat(e.target.value).toFixed(1);
    });

    document.getElementById('look-speed-v').addEventListener('input', (e) => {
        BASE_LOOK_SPEED_V = parseFloat(e.target.value);
        document.getElementById('look-speed-v-val').textContent = parseFloat(e.target.value).toFixed(1);
    });

    document.getElementById('ads-speed').addEventListener('input', (e) => {
        ADS_LOOK_SPEED = parseFloat(e.target.value);
        document.getElementById('ads-speed-val').textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Sync invert checkboxes
    document.getElementById('invert-look').addEventListener('change', (e) => {
        document.getElementById('invert-look-modal').checked = e.target.checked;
    });

    document.getElementById('invert-look-modal').addEventListener('change', (e) => {
        document.getElementById('invert-look').checked = e.target.checked;
    });

    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';

    renderer.setAnimationLoop(animate);
}

// ... (createEnvironment, createGun, spawnTargets, onWindowResize restored) ...

function createEnvironment() {
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(100, 100, 0x00ffff, 0x1a1a1a);
    scene.add(gridHelper);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(50, 10, 1), wallMaterial);
    backWall.position.set(0, 5, -25);
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 50), wallMaterial);
    leftWall.position.set(-25, 5, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 50), wallMaterial);
    rightWall.position.set(25, 5, 0);
    scene.add(rightWall);
}

function createGun(weaponType = 'SMG') {
    // Remove old gun if it exists
    if (gunGroup) {
        camera.remove(gunGroup);
    }

    gunGroup = new THREE.Group();

    if (weaponType === 'SMG') {
        // --- SMG Model (Compact, Boxy) ---
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        gunGroup.add(body);

        const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.9 });
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

        // Transparent rear sight
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

        // Transparent front sight
        const frontSightGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
        const frontSightMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3
        });
        const frontSight = new THREE.Mesh(frontSightGeo, frontSightMat);
        frontSight.position.y = 0.095;
        frontSight.position.z = -0.4;
        gunGroup.add(frontSight);

    } else if (weaponType === 'SNIPER') {
        // --- Sniper Model (Long, Sleek) ---
        const bodyGeo = new THREE.BoxGeometry(0.12, 0.12, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.z = -0.1; // Shift body back
        gunGroup.add(body);

        // Long barrel
        const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 16);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.95 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.5;
        barrel.position.y = 0.04;
        gunGroup.add(barrel);

        // Bolt/chamber
        const boltGeo = new THREE.BoxGeometry(0.08, 0.08, 0.15);
        const bolt = new THREE.Mesh(boltGeo, bodyMat);
        bolt.position.z = 0.2;
        bolt.position.y = 0.02;
        gunGroup.add(bolt);

        // Magazine (smaller for sniper)
        const magGeo = new THREE.BoxGeometry(0.04, 0.15, 0.06);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const mag = new THREE.Mesh(magGeo, magMat);
        mag.position.y = -0.12;
        mag.position.z = 0.0;
        gunGroup.add(mag);

        // Scope ring (rear)
        const scopeRingGeo = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
        const scopeMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
        const scopeRing1 = new THREE.Mesh(scopeRingGeo, scopeMat);
        scopeRing1.rotation.y = Math.PI / 2;
        scopeRing1.position.y = 0.095;
        scopeRing1.position.z = 0.1;
        gunGroup.add(scopeRing1);

        // Scope ring (front)
        const scopeRing2 = new THREE.Mesh(scopeRingGeo, scopeMat);
        scopeRing2.rotation.y = Math.PI / 2;
        scopeRing2.position.y = 0.095;
        scopeRing2.position.z = -0.2;
        gunGroup.add(scopeRing2);

        // Scope tube
        const scopeTubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.35, 16);
        const scopeTube = new THREE.Mesh(scopeTubeGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6 }));
        scopeTube.rotation.x = Math.PI / 2; // Rotate to align horizontally along barrel
        scopeTube.position.y = 0.095;
        scopeTube.position.z = -0.05;
        gunGroup.add(scopeTube);

        // Stock (butt of rifle)
        const stockGeo = new THREE.BoxGeometry(0.1, 0.15, 0.2);
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8, metalness: 0.1 });
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.z = 0.4;
        stock.position.y = -0.02;
        gunGroup.add(stock);
    }

    camera.add(gunGroup);
    scene.add(camera);

    gunGroup.position.copy(WEAPONS[weaponType].hipPosition);
}

function spawnTargets() {
    targets.forEach(t => scene.remove(t.mesh));
    targets = [];

    for (let i = 0; i < 5; i++) {
        createTarget();
    }
}

function createTarget() {
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0x550000,
        metalness: 0.5,
        roughness: 0.2
    });
    const target = new THREE.Mesh(geometry, material);

    target.position.set(
        (Math.random() - 0.5) * 40,
        1 + Math.random() * 5,
        -10 - Math.random() * 10
    );

    scene.add(target);

    targets.push({
        mesh: target,
        speed: (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1),
        rangeX: 20
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleInput(delta) {
    const gamepads = navigator.getGamepads();
    let activeGamepad = null;

    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            activeGamepad = gamepads[i];
            break;
        }
    }

    // Check if settings modal is open
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal && settingsModal.style.display === 'block') {
        // Route controller input to settings navigation
        if (activeGamepad && window.handleSettingsInput) {
            window.handleSettingsInput(activeGamepad);
        }
        return; // Don't process game input while in settings
    }

    const debugPanel = document.getElementById('debug-panel');
    let inputSource = 'None';

    // --- Input Gathering ---
    let moveX = 0;
    let moveZ = 0;
    let lookX = 0;
    let lookY = 0;
    let jumpPressed = false;
    let slidePressed = false;
    let shootValue = 0;
    let adsValue = 0;

    // 1. Gamepad Input
    if (activeGamepad) {
        inputSource = `Gamepad (${activeGamepad.id})`;

        const applyDeadzone = (value, threshold = 0.1) => {
            return Math.abs(value) < threshold ? 0 : value;
        };

        moveX = applyDeadzone(activeGamepad.axes[0]);
        moveZ = applyDeadzone(activeGamepad.axes[1]);
        lookX = applyDeadzone(activeGamepad.axes[2]);
        lookY = applyDeadzone(activeGamepad.axes[3]);

        jumpPressed = activeGamepad.buttons[0].pressed; // X
        slidePressed = activeGamepad.buttons[1].pressed; // Circle

        adsValue = activeGamepad.buttons[6] ? activeGamepad.buttons[6].value : 0; // L2
        shootValue = activeGamepad.buttons[7] ? activeGamepad.buttons[7].value : 0; // R2

        // Gamepad specific actions (Reload/Switch handled in event loop or here?)
        // We'll keep the original gamepad button checks for one-off actions in the loop if needed, 
        // but for continuous state, we map to variables.

        if (activeGamepad.buttons[3].pressed) { // Triangle - Switch
            const now = performance.now();
            if (now - lastWeaponSwitchTime > 500) {
                lastWeaponSwitchTime = now;
                switchWeapon();
            }
        }
        if (activeGamepad.buttons[2].pressed) { // Square - Reload
            reload();
        }
        if (activeGamepad.buttons[9] && activeGamepad.buttons[9].pressed) { // Options - Settings
            const now = performance.now();
            if (now - lastSettingsToggleTime > 500) {
                lastSettingsToggleTime = now;
                toggleSettings();
            }
        }
    }

    // 2. Keyboard/Mouse Input (Additive)
    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    if (keys.space) jumpPressed = true;
    if (keys.c) slidePressed = true;

    if (mouse.right) adsValue = 1.0;
    if (mouse.left) shootValue = 1.0;

    // Mouse Look (using delta movement)
    // Scale mouse movement to match joystick feel
    const mouseSensitivity = 0.05;
    lookX += mouse.dx * mouseSensitivity;
    lookY += mouse.dy * mouseSensitivity;

    // Reset mouse delta after consuming
    mouse.dx = 0;
    mouse.dy = 0;

    // --- Logic ---

    if (inputSource === 'None' && (moveX || moveZ || lookX || lookY || jumpPressed || shootValue)) {
        inputSource = 'Keyboard/Mouse';
    }

    if (debugPanel) {
        debugPanel.style.display = 'block';
        debugPanel.innerHTML = `Input: ${inputSource}<br>ADS: ${adsValue.toFixed(2)}`;

        if (isGameOver && jumpPressed) {
            resetGame();
            return;
        }
    }

    isADS = adsValue > 0.1;
    currentLookSpeedH = isADS ? ADS_LOOK_SPEED : BASE_LOOK_SPEED_H;
    currentLookSpeedV = isADS ? ADS_LOOK_SPEED : BASE_LOOK_SPEED_V;

    // Normalize movement vector if using keyboard (diagonal speed fix)
    if (Math.abs(moveX) + Math.abs(moveZ) > 1) {
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= len;
        moveZ /= len;
    }

    // Jump
    if (jumpPressed && isGrounded) {
        velocity.y = JUMP_FORCE;
        isGrounded = false;
    }

    // Slide
    if (slidePressed && isGrounded && !isSliding && moveZ < -0.5) {
        isSliding = true;
        slideTimer = SLIDE_DURATION;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    let speed = WALK_SPEED;

    if (isSliding) {
        speed = SLIDE_SPEED;
        slideTimer -= delta;
        if (slideTimer <= 0) {
            isSliding = false;
        }
    }

    if (isSliding) {
        velocity.x = forward.x * speed;
        velocity.z = forward.z * speed;
    } else {
        const moveVector = new THREE.Vector3()
            .addScaledVector(right, moveX)
            .addScaledVector(forward, -moveZ);

        velocity.x = moveVector.x * speed;
        velocity.z = moveVector.z * speed;
    }

    if (lookX !== 0 || lookY !== 0) {
        yaw -= lookX * currentLookSpeedH * delta;

        const invertY = document.getElementById('invert-look').checked ? -1 : 1;
        pitch -= lookY * currentLookSpeedV * delta * invertY;

        pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));

        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);
    }

    if (shootValue > 0.1) {
        shoot(shootValue);
    }
}

let lastShootTime = 0;
let lastWeaponSwitchTime = 0;
let lastSettingsToggleTime = 0;
function shoot(intensity) {
    // Check ammo
    if (currentAmmo <= 0) {
        playEmptyClickSound();
        return;
    }

    const weapon = WEAPONS[currentWeapon];
    const now = performance.now();
    if (now - lastShootTime > weapon.fireRate) {
        lastShootTime = now;

        // Decrement ammo
        currentAmmo--;
        updateAmmoDisplay();

        playShootSound();

        if (gunGroup) {
            gunGroup.position.z += 0.05;
            gunGroup.rotation.x += 0.05;
        }

        const recoilAmount = isADS ? 0.01 : 0.03;
        pitch += recoilAmount;
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        createMuzzleFlash();

        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

        const targetMeshes = targets.map(t => t.mesh);
        const intersects = raycaster.intersectObjects(targetMeshes);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const hitPoint = intersects[0].point;

            playHitSound();
            showHitMarker();

            createImpact(hitPoint);

            hitObject.material.emissive.setHex(0xffffff);
            setTimeout(() => { hitObject.material.emissive.setHex(0x550000); }, 100);

            scene.remove(hitObject);
            targets = targets.filter(t => t.mesh !== hitObject);
            createTarget();

            score += 100;
            document.getElementById('score').innerText = `SCORE: ${score}`;
        }
    }
}

function createMuzzleFlash() {
    const flash = new THREE.PointLight(0xffff00, 1, 5);
    if (gunGroup) {
        const barrelEnd = new THREE.Vector3(0, 0.05, -0.5);
        barrelEnd.applyMatrix4(gunGroup.matrixWorld);
        flash.position.copy(barrelEnd);
    } else {
        flash.position.copy(camera.position);
        flash.position.add(new THREE.Vector3(0.2, -0.2, -0.5).applyQuaternion(camera.quaternion));
    }

    scene.add(flash);
    setTimeout(() => { scene.remove(flash); }, 50);
}

function createImpact(position) {
    const particleCount = 10;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
        positions.push(position.x, position.y, position.z);
        velocities.push(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffaa00, size: 0.1 });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const startTime = performance.now();
    function animateParticles() {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;

        if (elapsed > 0.5) {
            scene.remove(particles);
            return;
        }

        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i * 3] * 0.1;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.1;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.1;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

function resetGame() {
    score = 0;
    timeLeft = 60;
    isGameOver = false;
    document.getElementById('score').innerText = `SCORE: ${score}`;
    document.getElementById('timer').innerText = `TIME: ${timeLeft}`;
    document.getElementById('game-over').style.display = 'none';
    spawnTargets();
}

function animate(time) {
    try {
        const rawDelta = (time - lastTime) / 1000;
        lastTime = time;
        // Clamp delta to prevent explosions (max 0.1s)
        const delta = Math.min(rawDelta, 0.1);

        if (!isGameOver) {
            handleInput(delta);

            velocity.y -= GRAVITY * delta;

            camera.position.x += velocity.x * delta;
            camera.position.z += velocity.z * delta;
            camera.position.y += velocity.y * delta;

            const targetHeight = isSliding ? SLIDE_HEIGHT : BASE_HEIGHT;

            if (camera.position.y < targetHeight) {
                camera.position.y = targetHeight;
                velocity.y = 0;
                isGrounded = true;
            } else if (camera.position.y > targetHeight + 0.1 && isGrounded) {
                isGrounded = false;
            }

            if (isSliding && isGrounded) {
                camera.position.y = THREE.MathUtils.lerp(camera.position.y, SLIDE_HEIGHT, 10 * delta);
            } else if (isGrounded) {
                camera.position.y = THREE.MathUtils.lerp(camera.position.y, BASE_HEIGHT, 10 * delta);
            }

            camera.position.x = Math.max(-24, Math.min(24, camera.position.x));
            camera.position.z = Math.max(-24, Math.min(24, camera.position.z));

            targets.forEach(t => {
                t.mesh.position.x += t.speed * delta;
                if (t.mesh.position.x > 20 || t.mesh.position.x < -20) {
                    t.speed *= -1;
                }
            });

            if (gunGroup) {
                let targetPos = isADS ? adsPosition : hipPosition;
                let targetRotX = 0;
                let targetRotZ = 0;

                // Reload Animation
                if (isReloading) {
                    // Dip gun down and rotate slightly
                    targetPos = new THREE.Vector3(hipPosition.x, hipPosition.y - 0.2, hipPosition.z);
                    targetRotX = -0.5; // Tilt down
                    targetRotZ = 0.2;  // Tilt side
                } else if (isADS) {
                    targetPos = WEAPONS[currentWeapon].adsPosition;
                } else {
                    targetPos = WEAPONS[currentWeapon].hipPosition;
                }

                gunGroup.position.lerp(targetPos, 10 * delta);

                // Smooth rotation
                gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, targetRotX, 10 * delta);
                gunGroup.rotation.z = THREE.MathUtils.lerp(gunGroup.rotation.z, targetRotZ, 10 * delta);

                // Recoil recovery (if not reloading)
                if (!isReloading) {
                    gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, 0, 5 * delta);
                }
            }

            // FOV Zoom & Scope Overlay
            const targetFOV = isADS ? WEAPONS[currentWeapon].zoomFOV : 75;
            if (Math.abs(camera.fov - targetFOV) > 0.1) {
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 10 * delta);
                camera.updateProjectionMatrix();
            }

            const scopeOverlay = document.getElementById('scope-overlay');
            if (currentWeapon === 'SNIPER' && isADS && !isReloading) {
                scopeOverlay.style.display = 'block';
                // Hide gun when scoped fully
                if (gunGroup && camera.fov < 30) {
                    gunGroup.visible = false;
                }
            } else {
                scopeOverlay.style.display = 'none';
                if (gunGroup) gunGroup.visible = true;
            }

            if (timeLeft > 0) {
                timeLeft -= delta;
                if (timeLeft <= 0) {
                    timeLeft = 0;
                    isGameOver = true;
                    document.getElementById('game-over').style.display = 'block';
                    document.getElementById('final-score').innerText = `Final Score: ${score}`;
                }
                document.getElementById('timer').innerText = `TIME: ${Math.ceil(timeLeft)}`;
            }
        } else {
            handleInput(delta);
        }

        renderer.render(scene, camera);
    } catch (e) {
        console.error("Game Loop Error:", e);
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.style.display = 'block';
            debugPanel.innerHTML = `ERROR: ${e.message}`;
        }
    }
}

function updateAmmoDisplay() {
    const ammoText = isReloading ?
        `RELOADING...` :
        `${currentAmmo} / ${reserveAmmo} [${WEAPONS[currentWeapon].name}]`;
    document.getElementById('ammo').innerText = ammoText;
}

function switchWeapon() {
    // Toggle between SMG and SNIPER
    currentWeapon = currentWeapon === 'SMG' ? 'SNIPER' : 'SMG';

    // Reset ammo to the new weapon's stats
    const weapon = WEAPONS[currentWeapon];
    currentAmmo = weapon.magSize;
    reserveAmmo = weapon.reserveAmmo;

    // Update the ammo display
    updateAmmoDisplay();

    // Rebuild the gun model for the new weapon
    createGun(currentWeapon);
}

function reload() {
    if (isReloading || currentAmmo === WEAPONS[currentWeapon].magSize || reserveAmmo <= 0) return;

    isReloading = true;
    updateAmmoDisplay(); // Shows "RELOADING..."

    playMagEjectSound();

    // Schedule mag insertion sound
    setTimeout(() => {
        playMagInsertSound();
    }, WEAPONS[currentWeapon].reloadTime * 1000 * 0.6); // Play insert sound at 60% of reload time

    // Complete reload
    setTimeout(() => {
        const weapon = WEAPONS[currentWeapon];
        const ammoNeeded = weapon.magSize - currentAmmo;
        const ammoToLoad = Math.min(ammoNeeded, reserveAmmo);

        currentAmmo += ammoToLoad;
        reserveAmmo -= ammoToLoad;
        isReloading = false;
        updateAmmoDisplay();
    }, WEAPONS[currentWeapon].reloadTime * 1000);
}

function showHitMarker() {
    const marker = document.getElementById('hit-marker');
    marker.style.display = 'block';
    setTimeout(() => { marker.style.display = 'none'; }, 100);
}

function toggleSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal.style.display === 'none' || settingsModal.style.display === '') {
        // Open settings
        settingsModal.style.display = 'block';
        document.exitPointerLock();
    } else {
        // Close settings
        settingsModal.style.display = 'none';
        document.body.requestPointerLock();
    }
}

init();
