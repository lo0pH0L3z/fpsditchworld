const SONY_VENDOR_ID = 0x054c; // DualSense vendor
const DPS_PER_COUNT = 1 / 1024; // Gyro scale for DualSense (counts to deg/s)
const STICK_SCALE = 0.005; // Map deg/s to virtual stick range

// When motion is idle, the accelerometer should read about 1g.
const EXPECTED_ACCEL_MAG = 8192;
// Updated defaults based on USB DualSense: gyro starts at byte 16, accel at byte 22
const DEFAULT_SENSOR_OFFSETS = { gyro: 16, accel: 22 };

// Axis mapping for DualSense gyroscope.
// Standard orientation: controller held normally, analog sticks facing you
// - Y-axis: rotation around vertical (yaw/turning left-right)
// - X-axis: rotation around horizontal (pitch/tilting forward-back)
// - Z-axis: rotation around depth (roll/tilting left-right sides)
const axisMap = {
    yaw: { axis: 'y', sign: -1 },    // left/right turn (negative because controller convention)
    pitch: { axis: 'x', sign: -1 }   // up/down look (negative for natural feel)
    // roll (z-axis) intentionally unused
};

const state = {
    supported: typeof navigator !== 'undefined' && !!navigator.hid,
    enabled: false,
    sensitivityH: 100,
    sensitivityV: 100,
    invertY: false,
    adsMultiplierH: 1.0,
    adsMultiplierV: 1.0,
    isADS: false, // tracked from main script
    fovScale: 1.0, // FOV-based sensitivity scaling (calculated by main script)
    fovScaleEnabled: true, // whether to apply FOV scaling
    fovScaleStrength: 1.0, // 0-1 strength of FOV scaling
    deadzone: 0, // deg/s (reduced for better responsiveness)
    device: null,
    connected: false,
    status: 'WebHID idle',
    lastGyro: { x: 0, y: 0, z: 0 },
    lastAccel: { x: 0, y: 0, z: 0 },
    sensorOffsets: null, // { gyro, accel, detected: bool }
    bias: { x: 0, y: 0, z: 0 },
    smoothed: { x: 0, y: 0, z: 0 }, // Smoothed gyro for jitter reduction
    lastRawData: [], // Array of bytes for debugging
    lastSample: 0
};

let statusListener = () => { };

export function initMotion({ onStatus } = {}) {
    if (typeof onStatus === 'function') {
        statusListener = onStatus;
    }

    emitStatus();

    if (!state.supported) {
        state.status = 'WebHID unsupported in this browser';
        emitStatus();
        return;
    }

    navigator.hid.addEventListener('disconnect', handleDisconnect);

    navigator.hid.getDevices()
        .then((devices) => {
            const match = devices.find((d) => d.vendorId === SONY_VENDOR_ID);
            if (match) {
                attachDevice(match);
            }
        })
        .catch((err) => {
            state.status = `HID query failed: ${err.message}`;
            emitStatus();
        });
}

export function setMotionEnabled(enabled) {
    state.enabled = !!enabled;
    if (state.enabled && !state.connected) {
        state.status = 'Waiting for DualSense...';
    }
    emitStatus();
}

export function setMotionSensitivityH(value) {
    state.sensitivityH = value;
}

export function setMotionSensitivityV(value) {
    state.sensitivityV = value;
}

export function setMotionInvertY(value) {
    state.invertY = !!value;
}

export function setMotionAdsMultiplierH(value) {
    state.adsMultiplierH = value;
}

export function setMotionAdsMultiplierV(value) {
    state.adsMultiplierV = value;
}

export function setMotionADS(isADS) {
    state.isADS = !!isADS;
}

export function setMotionFovScale(scale) {
    state.fovScale = scale;
}

export function setMotionFovScaleEnabled(enabled) {
    state.fovScaleEnabled = !!enabled;
}

export function setMotionFovScaleStrength(strength) {
    state.fovScaleStrength = strength;
}

export function setMotionDeadzone(value) {
    state.deadzone = value;
}

export function calibrateMotion() {
    if (!state.connected) return;
    // Capture current raw values as bias
    // Note: We need the raw values, but lastGyro is already raw from handleInputReport
    state.bias = { ...state.lastGyro };
    state.status = 'Calibrated';
    emitStatus();
}

export function getMotionState() {
    return {
        supported: state.supported,
        connected: state.connected,
        enabled: state.enabled,
        status: state.status,
        sensitivityH: state.sensitivityH,
        sensitivityV: state.sensitivityV,
        invertY: state.invertY,
        adsMultiplierH: state.adsMultiplierH,
        adsMultiplierV: state.adsMultiplierV,
        deadzone: state.deadzone
    };
}

export function getMotionDebug() {
    const dps = {
        x: state.lastGyro.x * DPS_PER_COUNT,
        y: state.lastGyro.y * DPS_PER_COUNT,
        z: state.lastGyro.z * DPS_PER_COUNT
    };

    // Also show smoothed values for comparison
    const smoothedDps = {
        x: state.smoothed.x,
        y: state.smoothed.y,
        z: state.smoothed.z
    };

    return {
        ...getMotionState(),
        lastGyro: { ...state.lastGyro },
        bias: { ...state.bias },
        lastRawData: state.lastRawData,
        dps,
        smoothedDps,
        lastSample: state.lastSample,
        axisMap: {
            yaw: { ...axisMap.yaw },
            pitch: { ...axisMap.pitch }
        },
        accel: { ...state.lastAccel },
        sensorOffsets: state.sensorOffsets ? { ...state.sensorOffsets } : null
    };
}

export async function requestMotionDevice() {
    if (!state.supported) {
        state.status = 'WebHID not available';
        emitStatus();
        throw new Error('WebHID not available');
    }

    try {
        const devices = await navigator.hid.requestDevice({
            filters: [{ vendorId: SONY_VENDOR_ID }]
        });

        if (!devices || devices.length === 0) {
            state.status = 'No device selected';
            emitStatus();
            return null;
        }

        return attachDevice(devices[0]);
    } catch (err) {
        state.status = `Motion permission blocked: ${err.message}`;
        emitStatus();
        throw err;
    }
}

export function consumeMotionLook() {
    if (!state.enabled || !state.connected || !state.lastSample) {
        return { lookX: 0, lookY: 0 };
    }

    // Map DualSense: yaw = left/right, pitch = up/down; roll is ignored/disabled.
    // Subtract bias before mapping
    const correctedGyro = {
        x: state.lastGyro.x - state.bias.x,
        y: state.lastGyro.y - state.bias.y,
        z: state.lastGyro.z - state.bias.z
    };

    const yawRateDps = axisToDps(correctedGyro, axisMap.yaw);
    const pitchRateDps = axisToDps(correctedGyro, axisMap.pitch);

    // Low-pass filter: smooth out jitter with exponential moving average
    const SMOOTHING = 0; // 0 = no smoothing, 1 = max smoothing (reduced for responsiveness)
    state.smoothed.x = state.smoothed.x * SMOOTHING + yawRateDps * (1 - SMOOTHING);
    state.smoothed.y = state.smoothed.y * SMOOTHING + pitchRateDps * (1 - SMOOTHING);

    // Snap-to-zero: if smoothed value is very small, clamp to zero to prevent drift
    const SNAP_THRESHOLD = 0; // deg/s (reduced for better response)
    if (Math.abs(state.smoothed.x) < SNAP_THRESHOLD) state.smoothed.x = 0;
    if (Math.abs(state.smoothed.y) < SNAP_THRESHOLD) state.smoothed.y = 0;

    // Apply separate H/V sensitivity
    let sensH = state.sensitivityH;
    let sensV = state.sensitivityV;

    // Apply motion-specific ADS multipliers when aiming down sights
    if (state.isADS) {
        sensH *= state.adsMultiplierH;
        sensV *= state.adsMultiplierV;
    }

    // Apply FOV scaling (scales down sensitivity when zoomed in)
    // Use strength to blend between no scaling (1.0) and full scaling (state.fovScale)
    let fovScale = 1.0;
    if (state.fovScaleEnabled) {
        fovScale = 1.0 + (state.fovScale - 1.0) * state.fovScaleStrength;
    }

    const yaw = applyDeadzone(state.smoothed.x) * sensH * fovScale * STICK_SCALE;
    let pitch = applyDeadzone(state.smoothed.y) * sensV * fovScale * STICK_SCALE;

    // Apply invert Y
    if (state.invertY) {
        pitch = -pitch;
    }

    return { lookX: yaw, lookY: pitch };
}

export function cycleYawAxis() {
    axisMap.yaw.axis = nextAxis(axisMap.yaw.axis);
    emitStatus();
}

export function flipYawSign() {
    axisMap.yaw.sign = -axisMap.yaw.sign;
    emitStatus();
}

export function cyclePitchAxis() {
    axisMap.pitch.axis = nextAxis(axisMap.pitch.axis);
    emitStatus();
}

export function flipPitchSign() {
    axisMap.pitch.sign = -axisMap.pitch.sign;
    emitStatus();
}

function nextAxis(current = 'x') {
    if (current === 'x') return 'y';
    if (current === 'y') return 'z';
    return 'x';
}

function axisToDps(gyro, { axis, sign }) {
    const val = gyro[axis] || 0;
    return val * DPS_PER_COUNT * (sign || 1);
}

function readVec3(data, offset) {
    if (offset == null || offset + 4 >= data.byteLength) {
        return { x: 0, y: 0, z: 0 };
    }
    return {
        x: data.getInt16(offset, true),
        y: data.getInt16(offset + 2, true),
        z: data.getInt16(offset + 4, true)
    };
}

function vecMag(vec) {
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
}

function detectSensorOffsets(data) {
    // Try to infer where gyro and accel live by looking for:
    //  - one block near zero (gyro at rest)
    //  - the following block around 1g (accel)
    if (!(data instanceof DataView) || data.byteLength < 24) return null;

    let best = null;
    const minStart = 8;
    const maxStart = Math.max(0, data.byteLength - 12);

    for (let start = minStart; start <= maxStart; start++) {
        const blockA = readVec3(data, start);
        const blockB = readVec3(data, start + 6);
        const magA = vecMag(blockA);
        const magB = vecMag(blockB);

        const scoreAB = magA + Math.abs(magB - EXPECTED_ACCEL_MAG); // A gyro, B accel
        const scoreBA = magB + Math.abs(magA - EXPECTED_ACCEL_MAG); // B gyro, A accel

        const gyroFirst = scoreAB <= scoreBA;
        const score = gyroFirst ? scoreAB : scoreBA;
        const candidate = gyroFirst
            ? { gyro: start, accel: start + 6, score, gyroMag: magA, accelMag: magB }
            : { gyro: start + 6, accel: start, score, gyroMag: magB, accelMag: magA };

        if (!best || candidate.score < best.score) {
            best = candidate;
        }
    }

    if (!best) return null;
    // If the best score is wildly off (no accel near 1g), fall back to defaults.
    const accelDelta = Math.abs((best.accelMag || 0) - EXPECTED_ACCEL_MAG);
    if (accelDelta > EXPECTED_ACCEL_MAG) return null;
    return { gyro: best.gyro, accel: best.accel, detected: true };
}

export async function attachDevice(device) {
    try {
        state.device = device;
        if (!device.opened) {
            await device.open();
        }
        device.addEventListener('inputreport', handleInputReport);
        state.connected = true;
        state.status = 'Motion ready';
    } catch (err) {
        state.connected = false;
        state.status = `Failed to open device: ${err.message}`;
        console.error('Failed to open DualSense motion device', err);
    }
    emitStatus();
    return state.device;
}

function handleInputReport(event) {
    const { data } = event;
    if (!(data instanceof DataView)) return;

    // debug: capture first 32 bytes
    const rawBytes = [];
    for (let i = 0; i < Math.min(data.byteLength, 32); i++) {
        rawBytes.push(data.getUint8(i));
    }
    state.lastRawData = rawBytes;

    if (!state.sensorOffsets) {
        state.sensorOffsets = detectSensorOffsets(data) || { ...DEFAULT_SENSOR_OFFSETS, detected: false };
    }

    const gyroOffset = state.sensorOffsets.gyro ?? DEFAULT_SENSOR_OFFSETS.gyro;
    const accelOffset = state.sensorOffsets.accel ?? DEFAULT_SENSOR_OFFSETS.accel;

    if (data.byteLength < gyroOffset + 6) return;

    const gyro = readVec3(data, gyroOffset);
    const accel = data.byteLength >= accelOffset + 6 ? readVec3(data, accelOffset) : { x: 0, y: 0, z: 0 };

    state.lastGyro = gyro;
    state.lastAccel = accel;
    state.lastSample = performance.now();
}

function handleDisconnect(event) {
    if (state.device && event.device === state.device) {
        state.device.removeEventListener('inputreport', handleInputReport);
        state.device = null;
    }
    state.connected = false;
    state.status = 'Controller disconnected';
    emitStatus();
}

function applyDeadzone(rateDps) {
    return Math.abs(rateDps) < state.deadzone ? 0 : rateDps;
}

export async function detachDevice() {
    if (state.device) {
        if (state.device.opened) {
            try {
                await state.device.close();
            } catch (e) { console.warn("Error closing device:", e); }
        }
        state.device.removeEventListener('inputreport', handleInputReport);
        state.device = null;
    }
    state.connected = false;
    state.status = 'Disconnected';
    emitStatus();
}

function emitStatus() {
    try {
        statusListener(getMotionState());
    } catch (err) {
        console.error('Motion status listener failed', err);
    }
}
