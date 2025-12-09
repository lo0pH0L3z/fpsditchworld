import { jsDualsense, TrigerEffects as BaseEffects, TriggerModes } from 'https://cdn.skypack.dev/jsdualsense';

// Extended Effects Map
// We polyfill the missing effects using the library's primitives (Rigid/Pulse)
// Params based on reverse-engineering standard DualSense behaviors supported by this lib version.
const ExtendedTrigerEffects = {
    ...BaseEffects,

    // Core Overrides/Aliases
    Off: BaseEffects.Off,
    Vibration: BaseEffects.Vibration,
    Weapon: BaseEffects.Weapon,
    Rigid: BaseEffects.Rigid,

    // Legacy Alias if needed
    Resistance: BaseEffects.Rigid,

    // Custom Implementations / Polyfills for v1.2+ keys

    // Bow: Progressive resistance. 
    // Uses Rigid mode with a stepped force array to simulate increasing tension.
    Bow: {
        Mode: TriggerModes.Rigid,
        Force: [0, 4, 8, 12, 16, 20, 24] // Increasing resistance
    },

    // Galloping: Rhythmic pulsing.
    // Uses Pulse_AB mode (Right+Left vibration in trigger motor) with rhythmic/low-freq settings.
    Galloping: {
        Mode: TriggerModes.Pulse_AB,
        Force: [30, 200, 255, 20, 255, 0, 0] // Custom pulse params
    },

    // SemiAutomatic: Soft click. 
    // Distinct from Weapon (which is full auto feel).
    SemiAutomaticGun: {
        Mode: TriggerModes.Rigid_AB,
        Force: [20, 255, 0, 0, 0, 0, 0] // Sharp initial resistance then break
    },

    // Automatic: Rapid fire feel (similar to Weapon but tuned differently if desired).
    AutomaticGun: {
        Mode: TriggerModes.Rigid_AB,
        Force: [0, 10, 255, 10, 0, 0, 0]
    },

    // Machine: High frequency vibration + resistance (Minigun).
    Machine: {
        Mode: TriggerModes.Pulse_AB,
        Force: [10, 255, 255, 255, 255, 0, 0] // Max frequency/power
    },

    // Sci-Fi Pulses
    PulseA: {
        Mode: TriggerModes.Pulse_A,
        Force: [100, 100, 255, 255, 0, 0, 0]
    },

    PulseB: {
        Mode: TriggerModes.Pulse_B,
        Force: [200, 50, 128, 128, 0, 0, 0]
    },

    // Custom Vibrations
    VibrationA: {
        Mode: TriggerModes.Pulse_AB,
        Force: [255, 128, 128, 0, 0, 0, 0]
    },

    VibrationB: {
        Mode: TriggerModes.Pulse_AB,
        Force: [128, 255, 0, 128, 0, 0, 0]
    }
};

// Export the extended version as 'TrigerEffects'
export { ExtendedTrigerEffects as TrigerEffects };

export class HapticController {
    constructor() {
        this.ds = new jsDualsense();
        this.connected = false;
    }

    async connect() {
        try {
            await this.ds.start();
            this.connected = true;
            await this.ds.setLight.setColorI([0, 100, 255]); // Blue LED
            // Use our extended effect definition
            await this.ds.setTriggerR.setEffect(ExtendedTrigerEffects.Weapon);
            return true;
        } catch (e) {
            console.error('Connection failed:', e);
            throw e;
        }
    }

    async triggerPulse(intensity = 255, duration = 200) {
        if (!this.connected) return;
        try {
            await this.ds.setVibrationL.setVibration(intensity);
            await this.ds.setVibrationR.setVibration(intensity * 0.5);
            setTimeout(async () => {
                if (this.connected) {
                    await this.ds.setVibrationL.setVibration(0);
                    await this.ds.setVibrationR.setVibration(0);
                }
            }, duration);
        } catch (e) {
            console.error('Haptic error:', e);
        }
    }

    async gameOverEffect() {
        if (!this.connected) return;
        try {
            await this.ds.setVibrationL.setVibration(255);
            await this.ds.setVibrationR.setVibration(255);
            await this.ds.setTriggerR.setEffect(ExtendedTrigerEffects.Resistance); // Strong resistance
            setTimeout(async () => {
                if (this.connected) {
                    await this.ds.setVibrationL.setVibration(0);
                    await this.ds.setVibrationR.setVibration(0);
                    await this.ds.setTriggerR.setEffect(ExtendedTrigerEffects.Weapon);
                }
            }, 500);
        } catch (e) {
            console.error('Haptic error:', e);
        }
    }

    // Allow direct access if needed, though methods are preferred
    get instance() {
        return this.ds;
    }
}
