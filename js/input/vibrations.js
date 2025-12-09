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
    }

    // Helper to get raw DS instance safely
    get ds() {
        if (!this.haptic.connected || !this.haptic.ds) {
            console.warn("VibrationPatterns: Controller not connected");
            return null;
        }
        return this.haptic.ds;
    }

    // Clear all running rhythmic effects
    async stop() {
        this.activeIntervals.forEach(i => clearInterval(i));
        this.activeIntervals = [];

        if (this.ds) {
            await this.ds.setVibrationL.setVibration(0);
            await this.ds.setVibrationR.setVibration(0);
        }
    }

    /**
     * Footsteps: Alternating low-intensity pulses
     * @param {number} duration Total duration in ms
     * @param {number} interval Time between steps in ms
     */
    async footsteps(duration = 1000, interval = 300) {
        if (!this.ds) return;
        const pulses = Math.floor(duration / interval);

        for (let i = 0; i < pulses; i++) {
            if (!this.haptic.connected) break;

            // Left foot (heavier)
            await this.ds.setVibrationL.setVibration(100);
            await new Promise(r => setTimeout(r, 100));
            await this.ds.setVibrationL.setVibration(0);

            // Wait for next step
            await new Promise(r => setTimeout(r, interval - 100));
        }
    }

    /**
     * Motorcycle: Continuous rumble with pulsing engine revs
     */
    async motorcycle(intensity = 150, pulseFreq = 200) {
        if (!this.ds) return;

        // Base rumble
        await this.ds.setVibrationL.setVibration(intensity);
        await this.ds.setVibrationR.setVibration(intensity * 0.7);

        const id = setInterval(async () => {
            if (!this.haptic.connected) return clearInterval(id);
            // Rev pulse
            await this.ds.setVibrationL.setVibration(Math.min(255, intensity + 20));
            setTimeout(() => {
                if (this.haptic.connected) this.ds.setVibrationL.setVibration(intensity);
            }, 50);
        }, pulseFreq);

        this.activeIntervals.push(id);
    }

    /**
     * Helicopter: High-freq buzz + low rumble + oscillation
     */
    async helicopter(intensity = 120, oscillation = 500) {
        if (!this.ds) return;

        await this.ds.setVibrationR.setVibration(intensity);
        await this.ds.setVibrationL.setVibration(intensity / 2);

        const id = setInterval(async () => {
            if (!this.haptic.connected) return clearInterval(id);
            // Blade whoosh effect
            await this.ds.setVibrationR.setVibration(Math.min(255, intensity + 30));
            setTimeout(() => {
                if (this.haptic.connected) this.ds.setVibrationR.setVibration(intensity);
            }, 200);
        }, oscillation);

        this.activeIntervals.push(id);
    }

    /**
     * Sniper: Sharp single recoil pulse
     */
    async sniper() {
        if (!this.ds) return;
        await this.ds.setVibrationR.setVibration(255);
        setTimeout(() => {
            if (this.haptic.connected) this.ds.setVibrationR.setVibration(0);
        }, 150);
    }

    /**
     * SMG: Rapid repeating burst chatter
     */
    async smg(bursts = 10, delay = 40) {
        if (!this.ds) return;
        for (let i = 0; i < bursts; i++) {
            if (!this.haptic.connected) break;

            await this.ds.setVibrationR.setVibration(180);
            await this.ds.setVibrationL.setVibration(120);

            await new Promise(r => setTimeout(r, delay));

            await this.ds.setVibrationR.setVibration(0);
            await this.ds.setVibrationL.setVibration(0);

            await new Promise(r => setTimeout(r, delay / 2));
        }
    }

    /**
     * Pistol: Punchy pulse with slight echo
     */
    async pistol() {
        if (!this.ds) return;
        await this.ds.setVibrationR.setVibration(200);

        setTimeout(async () => {
            if (!this.haptic.connected) return;
            await this.ds.setVibrationL.setVibration(100);

            setTimeout(() => {
                if (this.haptic.connected) {
                    this.ds.setVibrationR.setVibration(0);
                    this.ds.setVibrationL.setVibration(0);
                }
            }, 100);
        }, 50);
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

    /**
     * Environmental Rumble: Sustained variable background
     */
    async envRumble(intensity = 80, duration = 5000) {
        if (!this.ds) return;
        await this.ds.setVibrationL.setVibration(intensity);

        const id = setInterval(async () => {
            if (!this.haptic.connected) return clearInterval(id);
            // Random variation
            const varInt = Math.max(0, Math.min(255, intensity + (Math.random() * 40 - 20)));
            await this.ds.setVibrationL.setVibration(varInt);
        }, 200);

        this.activeIntervals.push(id);

        setTimeout(() => {
            clearInterval(id);
            // remove from active list if possible, or just let stop() handle it
            if (this.haptic.connected) this.ds.setVibrationL.setVibration(0);
        }, duration);
    }
}
