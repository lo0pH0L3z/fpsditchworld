const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 1;
masterGain.connect(audioCtx.destination);
let muted = false;

// Basic sample loader/cache for MP3-based gun sounds
const SOUND_FILES = {
    smg: new URL('../../assets/sfx/smg.mp3', import.meta.url).href,
    rifle: new URL('../../assets/sfx/rifle.mp3', import.meta.url).href,
    sniper: new URL('../../assets/sfx/rifle.mp3', import.meta.url).href, // alias for convenience
    reload: new URL('../../assets/sfx/reload.mp3', import.meta.url).href,
    empty: new URL('../../assets/sfx/empty.mp3', import.meta.url).href
};
const bufferCache = {};
const bufferPromises = {};

function resumeIfSuspended() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { /* ignore resume errors until user gesture */ });
    }
}

function routeSound(source, gain) {
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
}

function preloadSound(key) {
    if (bufferPromises[key]) return bufferPromises[key];
    const url = SOUND_FILES[key];
    if (!url) return null;
    bufferPromises[key] = fetch(url)
        .then(res => res.arrayBuffer())
        .then(data => audioCtx.decodeAudioData(data))
        .then(buffer => {
            bufferCache[key] = buffer;
            return buffer;
        })
        .catch((err) => {
            console.warn(`Failed to load sound "${key}":`, err);
            delete bufferPromises[key];
            return null;
        });
    return bufferPromises[key];
}

function playCachedSound(key, { volume = 0.5, playbackRate = 1 } = {}) {
    const buffer = bufferCache[key];
    if (!buffer) {
        const promise = preloadSound(key);
        if (promise) {
            promise.then((loaded) => {
                if (loaded) playCachedSound(key, { volume, playbackRate });
            });
        }
        return false;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    routeSound(source, gain);
    return true;
}

export function setMasterVolume(value) {
    masterGain.gain.value = Math.max(0, Math.min(1, value));
}

export function setMuted(state) {
    muted = state;
    masterGain.gain.value = muted ? 0 : masterGain.gain.value || 1;
}

export function warmupAudio() {
    resumeIfSuspended();
    const tasks = [
        preloadSound('smg'),
        preloadSound('rifle'),
        preloadSound('reload'),
        preloadSound('empty')
    ].filter(Boolean);

    return Promise.all(tasks).then((buffers) => {
        // Force-play all buffers at 0 volume to ensure mixer is primed
        buffers.forEach(buffer => {
            if (buffer) {
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                const gain = audioCtx.createGain();
                gain.gain.value = 0.0001; // Non-zero to prevent certain browser optimizations from skipping mixing
                source.connect(gain);
                gain.connect(masterGain);
                source.start();
                source.stop(audioCtx.currentTime + 0.1);
            }
        });
        return buffers;
    });
}

function pickSampleKey(weaponKey) {
    const normalized = (weaponKey || '').toLowerCase();
    if (SOUND_FILES[normalized]) return normalized;
    if (normalized === 'sniper') return 'rifle';
    return 'smg';
}

export function playShootSound(weaponKey = 'smg') {
    resumeIfSuspended();
    if (muted) return;

    const sampleKey = pickSampleKey(weaponKey);
    const isRifle = sampleKey === 'rifle' || sampleKey === 'sniper';

    // Try the MP3 sample first; if not ready, fall back to the synth blip.
    const playedSample = playCachedSound(sampleKey, {
        volume: isRifle ? 1.0 : 0.95,
        playbackRate: isRifle ? 0.92 + Math.random() * 0.06 : 0.95 + Math.random() * 0.1
    });
    if (playedSample) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    routeSound(osc, gain);
    osc.stop(audioCtx.currentTime + 0.15);
}

export function playHitSound() {
    resumeIfSuspended();
    if (muted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    routeSound(osc, gain);
    osc.stop(audioCtx.currentTime + 0.1);
}

export function playEmptyClickSound() {
    resumeIfSuspended();
    if (muted) return;

    const playedSample = playCachedSound('empty', { volume: 0.3, playbackRate: 1.0 });
    if (playedSample) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    routeSound(osc, gain);
    osc.stop(audioCtx.currentTime + 0.1);
}

export function playMagEjectSound() {
    resumeIfSuspended();
    if (muted) return;

    const playedSample = playCachedSound('reload', { volume: 0.1, playbackRate: 5.0 });
    if (playedSample) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    routeSound(osc, gain);
    osc.stop(audioCtx.currentTime + 0.15);
}

export function playMagInsertSound() {
    resumeIfSuspended();
    if (muted) return;

    const playedSample = playCachedSound('reload', { volume: 0.3, playbackRate: 1.0 });
    if (playedSample) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    routeSound(osc, gain);
    osc.stop(audioCtx.currentTime + 0.15);
}
