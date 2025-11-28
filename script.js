
import * as THREE from 'three';

// --- Global Variables ---
let camera, scene, renderer;
let lastTime = 0;
let gamepadIndex = null;

// Movement & Aiming settings
const WALK_SPEED = 10.0; // Increased base speed
const SLIDE_SPEED = 20.0;
const SLIDE_DURATION = 1.0; // Seconds
const JUMP_FORCE = 8.0;
const GRAVITY = 20.0;
const BASE_HEIGHT = 1.6;
const SLIDE_HEIGHT = 0.8;

const BASE_LOOK_SPEED = 2.0;
const ADS_LOOK_SPEED = 0.5;
let currentLookSpeed = BASE_LOOK_SPEED;

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

// --- Initialization ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 10, 50);

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

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    createEnvironment();
    createGun();
    spawnTargets();

    window.addEventListener('resize', onWindowResize);

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

    renderer.setAnimationLoop(animate);
}

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

function createGun() {
    gunGroup = new THREE.Group();

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

    const sightGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const sight = new THREE.Mesh(sightGeo, bodyMat);
    sight.position.y = 0.095;
    sight.position.z = 0.18;
    gunGroup.add(sight);

    const frontSightGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
    const frontSight = new THREE.Mesh(frontSightGeo, bodyMat);
    frontSight.position.y = 0.095;
    frontSight.position.z = -0.4;
    gunGroup.add(frontSight);

    camera.add(gunGroup);
    scene.add(camera);

    gunGroup.position.copy(hipPosition);
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

    const debugPanel = document.getElementById('debug-panel');

    if (activeGamepad) {
        debugPanel.style.display = 'block';
        let debugText = `ID: ${activeGamepad.id}<br>`;
        debugText += `Axes: ${activeGamepad.axes.map(a => a.toFixed(2)).join(', ')}<br>`;
        debugText += `Buttons: ${activeGamepad.buttons.map((b, i) => i + ':' + b.value.toFixed(1)).join(', ')}`;
        debugPanel.innerHTML = debugText;

        if (isGameOver) {
            if (activeGamepad.buttons[0].pressed) {
                resetGame();
            }
            return;
        }

        const applyDeadzone = (value, threshold = 0.1) => {
            return Math.abs(value) < threshold ? 0 : value;
        };

        const l2Value = activeGamepad.buttons[6] ? activeGamepad.buttons[6].value : 0;
        isADS = l2Value > 0.1;
        currentLookSpeed = isADS ? ADS_LOOK_SPEED : BASE_LOOK_SPEED;

        const moveX = applyDeadzone(activeGamepad.axes[0]);
        const moveZ = applyDeadzone(activeGamepad.axes[1]);

        // Jump (X / Button 0)
        if (activeGamepad.buttons[0].pressed && isGrounded) {
            velocity.y = JUMP_FORCE;
            isGrounded = false;
        }

        // Slide (Circle / Button 1)
        if (activeGamepad.buttons[1].pressed && isGrounded && !isSliding && moveZ < -0.5) {
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

        const lookX = applyDeadzone(activeGamepad.axes[2]);
        const lookY = applyDeadzone(activeGamepad.axes[3]);

        if (lookX !== 0 || lookY !== 0) {
            yaw -= lookX * currentLookSpeed * delta;

            const invertY = document.getElementById('invert-look').checked ? -1 : 1;
            pitch -= lookY * currentLookSpeed * delta * invertY;

            pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));

            const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
            camera.quaternion.setFromEuler(euler);
        }

        const r2Value = activeGamepad.buttons[7] ? activeGamepad.buttons[7].value : 0;
        if (r2Value > 0.1) {
            shoot(r2Value);
        }
    } else {
        debugPanel.style.display = 'block';
        debugPanel.innerHTML = "No Gamepad Detected. Press buttons to wake up.";
    }
}

let lastShootTime = 0;
function shoot(intensity) {
    const now = performance.now();
    if (now - lastShootTime > 100) {
        lastShootTime = now;

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
    const delta = (time - lastTime) / 1000;
    lastTime = time;

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
            const targetPos = isADS ? adsPosition : hipPosition;
            gunGroup.position.lerp(targetPos, 10 * delta);
            gunGroup.position.z = THREE.MathUtils.lerp(gunGroup.position.z, targetPos.z, 5 * delta);
            gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, 0, 5 * delta);
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
}

function showHitMarker() {
    const marker = document.getElementById('hit-marker');
    marker.style.display = 'block';
    setTimeout(() => { marker.style.display = 'none'; }, 100);
}

init();
