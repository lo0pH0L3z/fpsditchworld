export function createInputState() {
    return {
        keys: {
            w: false, a: false, s: false, d: false,
            space: false, c: false, r: false, q: false,
            shift: false, ctrl: false,
            e: false, v: false  // Vehicle interaction and camera toggle
        },
        mouse: {
            left: false,
            right: false,
            x: 0,
            y: 0,
            dx: 0,
            dy: 0
        }
    };
}

export function registerInputListeners({ keys, mouse }, { reload, switchWeapon }) {
    document.body.addEventListener('click', () => {
        document.body.requestPointerLock().catch(() => {
            // Suppress pointer lock errors (normal when clicking before page loads or exiting lock)
        });
    });

    window.addEventListener('keydown', (e) => {
        if (!e.key) return; // Guard against undefined key
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = true;
        if (e.code === 'Space') keys.space = true;
        if (e.shiftKey) keys.shift = true;
        if (e.ctrlKey) keys.ctrl = true;

        if (key === 'r') reload();
        if (key === 'q') switchWeapon();
    });

    window.addEventListener('keyup', (e) => {
        if (!e.key) return; // Guard against undefined key
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
        if (e.code === 'Space') keys.space = false;
        if (!e.shiftKey) keys.shift = false;
        if (!e.ctrlKey) keys.ctrl = false;
    });

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
        // console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
        //     e.gamepad.index, e.gamepad.id,
        //     e.gamepad.buttons.length, e.gamepad.axes.length);
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.innerText = `Controller Connected: ${e.gamepad.id}`;
            instructions.style.color = '#0f0';
        }
    });

    window.addEventListener("gamepaddisconnected", (e) => {
        // console.log("Gamepad disconnected from index %d: %s",
        //     e.gamepad.index, e.gamepad.id);
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.innerText = "Controller Disconnected. Press any button to reconnect.";
            instructions.style.color = 'rgba(0, 255, 255, 0.7)';
        }
    });
}
