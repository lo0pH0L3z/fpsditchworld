/**
 * VibrationPatterns - Custom vibration effects for DualSense
 * usage:
 * const vibes = new VibrationPatterns(hapticController);
 * await vibes.helicopter();
 */
export class VibrationPatterns {
    constructor(hapticController) {
        this.haptic = hapticController;
        this.activeIntervals = []; // Track intervals to stop them later
        this.engineInterval = null; // Specific handle for engine
        this.engineIntensity = 0;   // Current engine intensity
    }

    // Helper to get raw DS instance safely
    get ds() {
        if (!this.haptic.connected || !this.haptic.ds) {
            // console.warn("VibrationPatterns: Controller not connected");
            return null;
        }
        return this.haptic.ds;
    }

    // Clear all running rhythmic effects
    async stop() {
        this.activeIntervals.forEach(i => clearInterval(i));
        this.activeIntervals = [];
        this.stopEngine();

        if (this.ds) {
            await this.ds.setVibrationL.setVibration(0);
            await this.ds.setVibrationR.setVibration(0);
        }
    }

    // === FOOTSTEPS ===

    /**
     * Single Footstep: Quick low-intensity thud
     * Call this on the "down" phase of head bob
     */
    async playFootstep(isSprinting = false) {
        if (!this.ds) return;

        // Sprinting = sharper, harder step
        const intensity = isSprinting ? 50 : 20;
        const duration = isSprinting ? 40 : 60;

        try {
            // Left motor for weight
            this.ds.setVibrationL.setVibration(intensity);
            // Tiny right for snap
            if (isSprinting) this.ds.setVibrationR.setVibration(intensity * 0.5);

            setTimeout(() => {
                if (this.haptic.connected) {
                    this.ds.setVibrationL.setVibration(0);
                    this.ds.setVibrationR.setVibration(0);
                }
            }, duration);
        } catch (e) {
            // ignore
        }
    }


    // === VEHICLES ===

    /**
     * Start Motorbike Engine Loop
     * Call updateEngine(intensity) to change rumble on the fly
     */
    async startEngine() {
        if (!this.ds || this.engineInterval) return;

        // Start a loop that just applies the current `this.engineIntensity`
        // We pulse it slightly to feel like an engine

        this.engineInterval = setInterval(async () => {
            if (!this.haptic.connected) return this.stopEngine();

            // Base Rumble
            const base = this.engineIntensity;
            // Pulse added to base
            const pulse = base + (Math.random() * 20 - 10);

            // Left heavier (engine block), Right lighter (vibration)
            this.ds.setVibrationL.setVibration(Math.max(0, Math.min(255, pulse)));
            this.ds.setVibrationR.setVibration(Math.max(0, Math.min(255, pulse * 0.6)));

        }, 50); // 20hz update
    }

    stopEngine() {
        if (this.engineInterval) {
            clearInterval(this.engineInterval);
            this.engineInterval = null;
        }
        if (this.ds) {
            this.ds.setVibrationL.setVibration(0);
            this.ds.setVibrationR.setVibration(0);
        }
    }

    /**
     * Update current engine intensity
     * @param {number} intensity 0-255
     */
    updateEngine(intensity) {
        this.engineIntensity = intensity;
    }


    // === WEAPONS ===

    /**
     * Sniper: Sharp single recoil pulse
     */
    async sniper() {
        if (!this.ds) return;
        await this.ds.setVibrationR.setVibration(255);
        await this.ds.setVibrationL.setVibration(200); // Add left for heft
        setTimeout(() => {
            if (this.haptic.connected) {
                this.ds.setVibrationR.setVibration(0);
                this.ds.setVibrationL.setVibration(0);
            }
        }, 150);
    }

    /**
     * SMG: Rapid repeating burst chatter
     */
    async smg() {
        // Just a single shot ping, assuming game loop calls this rapidly
        if (!this.ds) return;

        await this.ds.setVibrationR.setVibration(150);
        await this.ds.setVibrationL.setVibration(80);

        setTimeout(() => {
            if (this.haptic.connected) {
                this.ds.setVibrationR.setVibration(0);
                this.ds.setVibrationL.setVibration(0);
            }
        }, 40); // very short for high ROF
    }

    /**
     * Pistol: Punchy pulse
     */
    async pistol() {
        if (!this.ds) return;
        await this.ds.setVibrationR.setVibration(200);

        setTimeout(async () => {
            if (!this.haptic.connected) return;
            await this.ds.setVibrationL.setVibration(100); // Echo

            setTimeout(() => {
                if (this.haptic.connected) {
                    this.ds.setVibrationR.setVibration(0);
                    this.ds.setVibrationL.setVibration(0);
                }
            }, 80);
        }, 20);
    }

    /**
     * Reload: Mechanical clicks
     */
    async reload() {
        if (!this.ds) return;
        // Mag out
        this.ds.setVibrationR.setVibration(50);
        setTimeout(() => this.haptic.connected && this.ds.setVibrationR.setVibration(0), 100);

        // Mag in (delayed) - hard to sync perfectly without events, but we can do a generic "clunk"
        // Actually, better to just let the game call specific events if we had them.
        // For now, just a small "start reload" feedback
    }

    /**
     * Impact: Sudden max intensity fade
     */
    async impact() {
        if (!this.ds) return;
        await this.ds.setVibrationL.setVibration(255);
        await this.ds.setVibrationR.setVibration(255);

        // Manual fade out loop
        for (let i = 255; i > 0; i -= 20) { // sped up fade for responsiveness
            if (!this.haptic.connected) break;
            await new Promise(r => setTimeout(r, 20)); // faster updates
            await this.ds.setVibrationL.setVibration(i);
            await this.ds.setVibrationR.setVibration(i);
        }

        await this.ds.setVibrationL.setVibration(0);
        await this.ds.setVibrationR.setVibration(0);
    }
}
