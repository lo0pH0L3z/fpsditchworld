const settingsItems = [
    { id: 'walk-speed', type: 'slider', min: 5, max: 20, step: 1 },
    { id: 'sprint-speed', type: 'slider', min: 10, max: 30, step: 1 },
    { id: 'crouch-speed', type: 'slider', min: 2, max: 10, step: 0.5 },
    { id: 'slide-speed', type: 'slider', min: 10, max: 40, step: 1 },
    { id: 'jump-force', type: 'slider', min: 4, max: 15, step: 0.5 },
    { id: 'air-control', type: 'slider', min: 0, max: 1, step: 0.1 },
    { id: 'gravity', type: 'slider', min: 5, max: 100, step: 1 },
    { id: 'head-bob-enabled', type: 'checkbox' },
    { id: 'head-bob-amount', type: 'slider', min: 0, max: 2, step: 0.1 },
    { id: 'look-speed-h', type: 'slider', min: 0.5, max: 5, step: 0.1 },
    { id: 'look-speed-v', type: 'slider', min: 0.5, max: 5, step: 0.1 },
    { id: 'ads-speed', type: 'slider', min: 0.1, max: 2, step: 0.1 },
    { id: 'ads-multiplier-h', type: 'slider', min: 0.1, max: 2, step: 0.05 },
    { id: 'ads-multiplier-v', type: 'slider', min: 0.1, max: 2, step: 0.05 },
    { id: 'mouse-sens-mult', type: 'slider', min: 0.1, max: 3, step: 0.1 },
    { id: 'ads-transition-speed', type: 'slider', min: 1, max: 20, step: 0.5 },
    { id: 'invert-look-modal', type: 'checkbox' },
    { id: 'fov-scale-sticks', type: 'checkbox' },
    { id: 'fov-scale-sticks-strength', type: 'slider', min: 0, max: 1, step: 0.05 },
    { id: 'motion-enabled', type: 'checkbox' },
    { id: 'motion-sens-h', type: 'slider', min: 0.1, max: 500, step: 0.1 },
    { id: 'motion-sens-v', type: 'slider', min: 0.1, max: 500, step: 0.1 },
    { id: 'motion-invert-y', type: 'checkbox' },
    { id: 'motion-ads-multiplier-h', type: 'slider', min: 0.1, max: 2, step: 0.05 },
    { id: 'motion-ads-multiplier-v', type: 'slider', min: 0.1, max: 2, step: 0.05 },
    { id: 'motion-fov-scale', type: 'checkbox' },
    { id: 'motion-fov-scale-strength', type: 'slider', min: 0, max: 1, step: 0.05 },
    { id: 'motion-deadzone', type: 'slider', min: 0, max: 1, step: 0.001 },
    { id: 'voice-mute-mic', type: 'checkbox' },
    { id: 'voice-deafen', type: 'checkbox' },
    { id: 'voice-volume', type: 'slider', min: 0, max: 1, step: 0.05 }
];

let currentSettingIndex = 0;
let lastDpadTime = 0;
let lastAdjustTime = 0;
const SETTINGS_STORAGE_KEY = 'ps5-fps-range-settings';

export function toggleSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (!settingsModal) return;

    if (settingsModal.style.display === 'none' || settingsModal.style.display === '') {
        settingsModal.style.display = 'block';
        document.exitPointerLock();
        const invertCheckbox = document.getElementById('invert-look');
        const invertModal = document.getElementById('invert-look-modal');
        if (invertCheckbox && invertModal) {
            invertModal.checked = invertCheckbox.checked;
        }
    } else {
        settingsModal.style.display = 'none';
        try {
            document.body.requestPointerLock();
        } catch (e) {
            // Ignore pointer lock errors (e.g. not user triggered)
        }
    }
}

function highlightCurrentSetting() {
    settingsItems.forEach(item => {
        const element = document.getElementById(item.id);
        if (element && element.parentElement) {
            element.parentElement.style.background = '';
            element.parentElement.style.border = '';
            element.parentElement.style.padding = '';
        }
    });

    const currentItem = settingsItems[currentSettingIndex];
    const element = document.getElementById(currentItem.id);
    if (element && element.parentElement) {
        element.parentElement.style.background = 'rgba(0, 255, 255, 0.2)';
        element.parentElement.style.border = '2px solid #0ff';
        element.parentElement.style.padding = '8px';

        // Auto-scroll to keep selected setting visible
        element.parentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    }
}

export function setupSettingsUI({
    onWalkSpeedChange,
    onSlideSpeedChange,
    onJumpForceChange,
    onSprintSpeedChange,
    onCrouchSpeedChange,
    onAirControlChange,
    onGravityChange,
    onHeadBobEnabledChange,
    onHeadBobAmountChange,
    onLookSpeedHChange,
    onLookSpeedVChange,
    onAdsSpeedChange,
    onAdsMultiplierHChange,
    onAdsMultiplierVChange,
    onMouseSensMultiplierChange,
    onAdsTransitionSpeedChange,
    onInvertChange,
    onFovScaleSticksChange,
    onFovScaleSticksStrengthChange,
    onMotionToggle,
    onMotionSensitivityHChange,
    onMotionSensitivityVChange,
    onMotionInvertYChange,
    onMotionAdsMultiplierHChange,
    onMotionAdsMultiplierVChange,
    onMotionFovScaleChange,
    onMotionFovScaleStrengthChange,
    onMotionDeadzoneChange,
    onMotionConnect,
    onMotionCalibrate,
    onVoiceMuteMicChange,
    onVoiceDeafenChange,
    onVoiceVolumeChange
}) {
    const defaultSettings = {
        walkSpeed: 10,
        slideSpeed: 20,
        jumpForce: 8,
        sprintSpeed: 15,
        crouchSpeed: 5,
        airControl: 0.5,
        gravity: 20,
        headBobEnabled: true,
        headBobAmount: 1.0,
        lookH: 2,
        lookV: 2,
        adsSpeed: 0.5,
        adsMultiplierH: 1.0,
        adsMultiplierV: 1.0,
        mouseSensMultiplier: 1.0,
        adsTransitionSpeed: 10.0,
        invert: false,
        fovScaleSticks: true,
        fovScaleSticksStrength: 1.0,
        motionEnabled: false,
        motionSensitivityH: 1,
        motionSensitivityV: 1,
        motionInvertY: false,
        motionAdsMultiplierH: 1.0,
        motionAdsMultiplierV: 1.0,
        motionFovScale: true,
        motionFovScaleStrength: 1.0,
        motionDeadzone: 0,
        voiceMuteMic: false,
        voiceDeafen: false,
        voiceVolume: 1.0
    };

    const loadSettings = () => {
        try {
            const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...defaultSettings, ...parsed };
            }
        } catch (_) {
            // ignore parse/storage errors
        }
        return { ...defaultSettings };
    };

    const saveSettings = (settings) => {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (_) {
            // ignore storage errors
        }
    };

    const settingsState = loadSettings();

    const settingsBtn = document.getElementById('settings-btn');
    const closeSettings = document.getElementById('close-settings');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            toggleSettings();
        });
    }

    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            toggleSettings();
        });
    }

    window.handleSettingsInput = function (gamepad) {
        const now = performance.now();

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
                element.dispatchEvent(new Event('input'));
            }
        } else if (currentItem.type === 'checkbox') {
            const xButton = gamepad.buttons[0] && gamepad.buttons[0].pressed;
            if (xButton && now - lastAdjustTime > 300) {
                lastAdjustTime = now;
                element.checked = !element.checked;
                element.dispatchEvent(new Event('change'));
            }
        }

        const circleButton = gamepad.buttons[1] && gamepad.buttons[1].pressed;
        if (circleButton && now - lastDpadTime > 300) {
            toggleSettings();
        }
    };

    setTimeout(() => highlightCurrentSetting(), 100);

    const applySetting = (id, value, displayEl, formatter = (v) => v) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
        }
        if (displayEl) {
            displayEl.textContent = formatter(value);
        }
    };

    const walkSlider = document.getElementById('walk-speed');
    if (walkSlider) {
        applySetting('walk-speed', settingsState.walkSpeed, document.getElementById('walk-speed-val'));
        walkSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.walkSpeed = val;
            onWalkSpeedChange(val);
            document.getElementById('walk-speed-val').textContent = val;
            saveSettings(settingsState);
        });
    }

    const slideSlider = document.getElementById('slide-speed');
    if (slideSlider) {
        applySetting('slide-speed', settingsState.slideSpeed, document.getElementById('slide-speed-val'));
        slideSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.slideSpeed = val;
            onSlideSpeedChange(val);
            document.getElementById('slide-speed-val').textContent = val;
            saveSettings(settingsState);
        });
    }

    const jumpSlider = document.getElementById('jump-force');
    if (jumpSlider) {
        applySetting('jump-force', settingsState.jumpForce, document.getElementById('jump-force-val'));
        jumpSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.jumpForce = val;
            onJumpForceChange(val);
            document.getElementById('jump-force-val').textContent = val;
            saveSettings(settingsState);
        });
    }

    const sprintSlider = document.getElementById('sprint-speed');
    if (sprintSlider) {
        applySetting('sprint-speed', settingsState.sprintSpeed, document.getElementById('sprint-speed-val'));
        sprintSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.sprintSpeed = val;
            onSprintSpeedChange(val);
            document.getElementById('sprint-speed-val').textContent = val;
            saveSettings(settingsState);
        });
    }

    const crouchSlider = document.getElementById('crouch-speed');
    if (crouchSlider) {
        applySetting('crouch-speed', settingsState.crouchSpeed, document.getElementById('crouch-speed-val'), (v) => parseFloat(v).toFixed(1));
        crouchSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.crouchSpeed = val;
            onCrouchSpeedChange(val);
            document.getElementById('crouch-speed-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const airControlSlider = document.getElementById('air-control');
    if (airControlSlider) {
        applySetting('air-control', settingsState.airControl, document.getElementById('air-control-val'), (v) => parseFloat(v).toFixed(1));
        airControlSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.airControl = val;
            onAirControlChange(val);
            document.getElementById('air-control-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const gravitySlider = document.getElementById('gravity');
    if (gravitySlider) {
        applySetting('gravity', settingsState.gravity, document.getElementById('gravity-val'));
        gravitySlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.gravity = val;
            onGravityChange(val);
            document.getElementById('gravity-val').textContent = val;
            saveSettings(settingsState);
        });
    }

    const headBobToggle = document.getElementById('head-bob-enabled');
    if (headBobToggle) {
        headBobToggle.checked = settingsState.headBobEnabled;
        headBobToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            settingsState.headBobEnabled = enabled;
            onHeadBobEnabledChange(enabled);
            saveSettings(settingsState);
        });
    }

    const headBobAmountSlider = document.getElementById('head-bob-amount');
    if (headBobAmountSlider) {
        applySetting('head-bob-amount', settingsState.headBobAmount, document.getElementById('head-bob-amount-val'), (v) => parseFloat(v).toFixed(1));
        headBobAmountSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.headBobAmount = val;
            onHeadBobAmountChange(val);
            document.getElementById('head-bob-amount-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const lookHSlider = document.getElementById('look-speed-h');
    if (lookHSlider) {
        applySetting('look-speed-h', settingsState.lookH, document.getElementById('look-speed-h-val'), (v) => parseFloat(v).toFixed(1));
        lookHSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.lookH = val;
            onLookSpeedHChange(val);
            document.getElementById('look-speed-h-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const lookVSlider = document.getElementById('look-speed-v');
    if (lookVSlider) {
        applySetting('look-speed-v', settingsState.lookV, document.getElementById('look-speed-v-val'), (v) => parseFloat(v).toFixed(1));
        lookVSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.lookV = val;
            onLookSpeedVChange(val);
            document.getElementById('look-speed-v-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const adsSlider = document.getElementById('ads-speed');
    if (adsSlider) {
        applySetting('ads-speed', settingsState.adsSpeed, document.getElementById('ads-speed-val'), (v) => parseFloat(v).toFixed(1));
        adsSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.adsSpeed = val;
            onAdsSpeedChange(val);
            document.getElementById('ads-speed-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const adsMultiplierHSlider = document.getElementById('ads-multiplier-h');
    if (adsMultiplierHSlider) {
        applySetting('ads-multiplier-h', settingsState.adsMultiplierH, document.getElementById('ads-multiplier-h-val'), (v) => parseFloat(v).toFixed(2));
        adsMultiplierHSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.adsMultiplierH = val;
            onAdsMultiplierHChange(val);
            document.getElementById('ads-multiplier-h-val').textContent = parseFloat(val).toFixed(2);
            saveSettings(settingsState);
        });
    }

    const adsMultiplierVSlider = document.getElementById('ads-multiplier-v');
    if (adsMultiplierVSlider) {
        applySetting('ads-multiplier-v', settingsState.adsMultiplierV, document.getElementById('ads-multiplier-v-val'), (v) => parseFloat(v).toFixed(2));
        adsMultiplierVSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.adsMultiplierV = val;
            onAdsMultiplierVChange(val);
            document.getElementById('ads-multiplier-v-val').textContent = parseFloat(val).toFixed(2);
            saveSettings(settingsState);
        });
    }

    const mouseSensMultSlider = document.getElementById('mouse-sens-mult');
    if (mouseSensMultSlider) {
        applySetting('mouse-sens-mult', settingsState.mouseSensMultiplier, document.getElementById('mouse-sens-mult-val'), (v) => parseFloat(v).toFixed(1));
        mouseSensMultSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.mouseSensMultiplier = val;
            onMouseSensMultiplierChange(val);
            document.getElementById('mouse-sens-mult-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const adsTransitionSlider = document.getElementById('ads-transition-speed');
    if (adsTransitionSlider) {
        applySetting('ads-transition-speed', settingsState.adsTransitionSpeed, document.getElementById('ads-transition-speed-val'), (v) => parseFloat(v).toFixed(1));
        adsTransitionSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.adsTransitionSpeed = val;
            onAdsTransitionSpeedChange(val);
            document.getElementById('ads-transition-speed-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const invertCheckbox = document.getElementById('invert-look');
    const invertModal = document.getElementById('invert-look-modal');

    if (invertCheckbox && invertModal) {
        invertCheckbox.checked = settingsState.invert;
        invertModal.checked = settingsState.invert;
        invertCheckbox.addEventListener('change', (e) => {
            invertModal.checked = e.target.checked;
            onInvertChange(e.target.checked);
            settingsState.invert = e.target.checked;
            saveSettings(settingsState);
        });

        invertModal.addEventListener('change', (e) => {
            invertCheckbox.checked = e.target.checked;
            onInvertChange(e.target.checked);
            settingsState.invert = e.target.checked;
            saveSettings(settingsState);
        });
    }

    const fovScaleSticksToggle = document.getElementById('fov-scale-sticks');
    if (fovScaleSticksToggle) {
        fovScaleSticksToggle.checked = settingsState.fovScaleSticks;
        fovScaleSticksToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            settingsState.fovScaleSticks = enabled;
            onFovScaleSticksChange(enabled);
            saveSettings(settingsState);
        });
    }

    const fovScaleSticksStrength = document.getElementById('fov-scale-sticks-strength');
    if (fovScaleSticksStrength) {
        applySetting('fov-scale-sticks-strength', settingsState.fovScaleSticksStrength, document.getElementById('fov-scale-sticks-strength-val'), (v) => parseFloat(v).toFixed(2));
        fovScaleSticksStrength.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.fovScaleSticksStrength = val;
            onFovScaleSticksStrengthChange(val);
            document.getElementById('fov-scale-sticks-strength-val').textContent = parseFloat(val).toFixed(2);
            saveSettings(settingsState);
        });
    }

    const motionToggle = document.getElementById('motion-enabled');
    if (motionToggle) {
        motionToggle.checked = settingsState.motionEnabled;
        motionToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            settingsState.motionEnabled = enabled;
            onMotionToggle(enabled);
            saveSettings(settingsState);
        });
    }

    const motionSensH = document.getElementById('motion-sens-h');
    if (motionSensH) {
        applySetting('motion-sens-h', settingsState.motionSensitivityH, document.getElementById('motion-sens-h-val'), (v) => parseFloat(v).toFixed(1));
        motionSensH.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.motionSensitivityH = val;
            onMotionSensitivityHChange(val);
            document.getElementById('motion-sens-h-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const motionSensV = document.getElementById('motion-sens-v');
    if (motionSensV) {
        applySetting('motion-sens-v', settingsState.motionSensitivityV, document.getElementById('motion-sens-v-val'), (v) => parseFloat(v).toFixed(1));
        motionSensV.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.motionSensitivityV = val;
            onMotionSensitivityVChange(val);
            document.getElementById('motion-sens-v-val').textContent = parseFloat(val).toFixed(1);
            saveSettings(settingsState);
        });
    }

    const motionInvertY = document.getElementById('motion-invert-y');
    if (motionInvertY) {
        motionInvertY.checked = settingsState.motionInvertY;
        motionInvertY.addEventListener('change', (e) => {
            const checked = e.target.checked;
            settingsState.motionInvertY = checked;
            onMotionInvertYChange(checked);
            saveSettings(settingsState);
        });
    }

    const motionAdsMultH = document.getElementById('motion-ads-multiplier-h');
    if (motionAdsMultH) {
        applySetting('motion-ads-multiplier-h', settingsState.motionAdsMultiplierH, document.getElementById('motion-ads-multiplier-h-val'), (v) => parseFloat(v).toFixed(2));
        motionAdsMultH.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.motionAdsMultiplierH = val;
            onMotionAdsMultiplierHChange(val);
            document.getElementById('motion-ads-multiplier-h-val').textContent = parseFloat(val).toFixed(2);
            saveSettings(settingsState);
        });
    }

    const motionAdsMultV = document.getElementById('motion-ads-multiplier-v');
    if (motionAdsMultV) {
        applySetting('motion-ads-multiplier-v', settingsState.motionAdsMultiplierV, document.getElementById('motion-ads-multiplier-v-val'), (v) => parseFloat(v).toFixed(2));
        motionAdsMultV.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.motionAdsMultiplierV = val;
            onMotionAdsMultiplierVChange(val);
            document.getElementById('motion-ads-multiplier-v-val').textContent = parseFloat(val).toFixed(2);
            saveSettings(settingsState);
        });
    }

    const motionFovScaleToggle = document.getElementById('motion-fov-scale');
    if (motionFovScaleToggle) {
        motionFovScaleToggle.checked = settingsState.motionFovScale;
        motionFovScaleToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            settingsState.motionFovScale = enabled;
            onMotionFovScaleChange(enabled);
            saveSettings(settingsState);
        });
    }

    const motionFovScaleStrength = document.getElementById('motion-fov-scale-strength');
    if (motionFovScaleStrength) {
        applySetting('motion-fov-scale-strength', settingsState.motionFovScaleStrength, document.getElementById('motion-fov-scale-strength-val'), (v) => parseFloat(v).toFixed(2));
        motionFovScaleStrength.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.motionFovScaleStrength = val;
            onMotionFovScaleStrengthChange(val);
            document.getElementById('motion-fov-scale-strength-val').textContent = parseFloat(val).toFixed(2);
            saveSettings(settingsState);
        });
    }

    const motionDeadzone = document.getElementById('motion-deadzone');
    if (motionDeadzone) {
        applySetting('motion-deadzone', settingsState.motionDeadzone, document.getElementById('motion-deadzone-val'), (v) => parseFloat(v).toFixed(3));
        motionDeadzone.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.motionDeadzone = val;
            onMotionDeadzoneChange(val);
            document.getElementById('motion-deadzone-val').textContent = parseFloat(val).toFixed(3);
            saveSettings(settingsState);
        });
    }

    const voiceMuteMic = document.getElementById('voice-mute-mic');
    if (voiceMuteMic) {
        voiceMuteMic.checked = settingsState.voiceMuteMic;
        voiceMuteMic.addEventListener('change', (e) => {
            const checked = e.target.checked;
            settingsState.voiceMuteMic = checked;
            onVoiceMuteMicChange(checked);
            saveSettings(settingsState);
        });
    }

    const voiceDeafen = document.getElementById('voice-deafen');
    if (voiceDeafen) {
        voiceDeafen.checked = settingsState.voiceDeafen;
        voiceDeafen.addEventListener('change', (e) => {
            const checked = e.target.checked;
            settingsState.voiceDeafen = checked;
            onVoiceDeafenChange(checked);
            saveSettings(settingsState);
        });
    }

    const voiceVolume = document.getElementById('voice-volume');
    if (voiceVolume) {
        applySetting('voice-volume', settingsState.voiceVolume, document.getElementById('voice-volume-val'), (v) => Math.round(parseFloat(v) * 100) + '%');
        voiceVolume.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            settingsState.voiceVolume = val;
            onVoiceVolumeChange(val);
            document.getElementById('voice-volume-val').textContent = Math.round(val * 100) + '%';
            saveSettings(settingsState);
        });
    }

    const motionConnect = document.getElementById('motion-connect');
    if (motionConnect) {
        motionConnect.addEventListener('click', () => {
            if (typeof onMotionConnect === 'function') {
                onMotionConnect();
            }
        });
    }

    const motionCalibrate = document.getElementById('motion-calibrate');
    if (motionCalibrate) {
        motionCalibrate.addEventListener('click', () => {
            if (typeof onMotionCalibrate === 'function') {
                onMotionCalibrate();
            }
        });
    }

    // Apply initial settings to game state
    onWalkSpeedChange(settingsState.walkSpeed);
    onSlideSpeedChange(settingsState.slideSpeed);
    onJumpForceChange(settingsState.jumpForce);
    onSprintSpeedChange(settingsState.sprintSpeed);
    onCrouchSpeedChange(settingsState.crouchSpeed);
    onAirControlChange(settingsState.airControl);
    onGravityChange(settingsState.gravity);
    onHeadBobEnabledChange(settingsState.headBobEnabled);
    onHeadBobAmountChange(settingsState.headBobAmount);
    onLookSpeedHChange(settingsState.lookH);
    onLookSpeedVChange(settingsState.lookV);
    onAdsSpeedChange(settingsState.adsSpeed);
    onAdsMultiplierHChange(settingsState.adsMultiplierH);
    onAdsMultiplierVChange(settingsState.adsMultiplierV);
    onMouseSensMultiplierChange(settingsState.mouseSensMultiplier);
    onAdsTransitionSpeedChange(settingsState.adsTransitionSpeed);
    onInvertChange(settingsState.invert);
    onFovScaleSticksChange(settingsState.fovScaleSticks);
    onFovScaleSticksStrengthChange(settingsState.fovScaleSticksStrength);
    onMotionToggle(settingsState.motionEnabled);
    onMotionSensitivityHChange(settingsState.motionSensitivityH);
    onMotionSensitivityVChange(settingsState.motionSensitivityV);
    onMotionInvertYChange(settingsState.motionInvertY);
    onMotionAdsMultiplierHChange(settingsState.motionAdsMultiplierH);
    onMotionAdsMultiplierVChange(settingsState.motionAdsMultiplierV);
    onMotionFovScaleChange(settingsState.motionFovScale);
    onMotionFovScaleStrengthChange(settingsState.motionFovScaleStrength);
    onMotionDeadzoneChange(settingsState.motionDeadzone);
    onVoiceMuteMicChange(settingsState.voiceMuteMic);
    onVoiceDeafenChange(settingsState.voiceDeafen);
    onVoiceVolumeChange(settingsState.voiceVolume);
}
