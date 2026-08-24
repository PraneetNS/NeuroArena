/**
 * Advanced Unified Input Manager for NeuroArena.
 * Supports Gamepad API with dual-stick deadzones, keyboard/mouse remapping,
 * DualShock / Xbox dual-motor haptics vibration, and action buffering.
 */
export class UnifiedInputManager {
  constructor(options = {}) {
    this.deadzone = options.deadzone || 0.15;
    this.keyBindings = {
      forward: ['KeyW', 'ArrowUp'],
      backward: ['KeyS', 'ArrowDown'],
      strafeLeft: ['KeyA', 'ArrowLeft'],
      strafeRight: ['KeyD', 'ArrowRight'],
      fireLaser: ['Space', 'Mouse0'],
      boost: ['ShiftLeft', 'ShiftRight'],
      interact: ['KeyE'],
      trainModel: ['KeyT'],
      inspectWeights: ['KeyI'],
      ...(options.customBindings || {})
    };

    this.rawKeys = new Set();
    this.mouseButtons = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.gamepadIndex = null;
    this.actionBuffer = [];
    this.BUFFER_WINDOW_MS = 200;

    this.setupListeners();
  }

  setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      this.rawKeys.add(e.code);
      this.bufferAction(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.rawKeys.delete(e.code);
    });

    window.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(`Mouse${e.button}`);
    });

    window.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(`Mouse${e.button}`);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseDelta.x += e.movementX || 0;
      this.mouseDelta.y += e.movementY || 0;
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      console.log(`🎮 Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
      }
    });
  }

  rebindKey(action, keyCode) {
    if (!this.keyBindings[action]) {
      this.keyBindings[action] = [];
    }
    if (!this.keyBindings[action].includes(keyCode)) {
      this.keyBindings[action].push(keyCode);
    }
  }

  bufferAction(code) {
    const now = performance.now();
    this.actionBuffer.push({ code, time: now });
    this.actionBuffer = this.actionBuffer.filter(a => now - a.time < this.BUFFER_WINDOW_MS);
  }

  isActionActive(action) {
    const bindings = this.keyBindings[action] || [];
    for (const bind of bindings) {
      if (bind.startsWith('Mouse')) {
        if (this.mouseButtons.has(bind)) return true;
      } else {
        if (this.rawKeys.has(bind)) return true;
      }
    }

    // Check Gamepad buttons
    const pad = this.getGamepad();
    if (pad) {
      if (action === 'fireLaser' && pad.buttons[0]?.pressed) return true; // A / Cross
      if (action === 'boost' && pad.buttons[7]?.pressed) return true; // R2 / RT
      if (action === 'interact' && pad.buttons[2]?.pressed) return true; // X / Square
      if (action === 'trainModel' && pad.buttons[3]?.pressed) return true; // Y / Triangle
    }

    return false;
  }

  getMovementVector() {
    let x = 0;
    let y = 0;

    if (this.isActionActive('strafeLeft')) x -= 1;
    if (this.isActionActive('strafeRight')) x += 1;
    if (this.isActionActive('forward')) y += 1;
    if (this.isActionActive('backward')) y -= 1;

    // Check Gamepad Stick (Left Stick: axes 0 & 1)
    const pad = this.getGamepad();
    if (pad && pad.axes.length >= 2) {
      let stickX = pad.axes[0];
      let stickY = -pad.axes[1]; // invert Y axis for game coordinates

      // Apply radial deadzone
      const mag = Math.hypot(stickX, stickY);
      if (mag > this.deadzone) {
        const scaledMag = (mag - this.deadzone) / (1 - this.deadzone);
        x += (stickX / mag) * scaledMag;
        y += (stickY / mag) * scaledMag;
      }
    }

    // Normalize if > 1
    const len = Math.hypot(x, y);
    if (len > 1.0) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  getGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
      return gamepads[this.gamepadIndex];
    }
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) return gamepads[i];
    }
    return null;
  }

  /**
   * Triggers dual-motor controller rumble haptics
   */
  async triggerHapticFeedback(durationMs = 150, weakMagnitude = 0.4, strongMagnitude = 0.6) {
    const pad = this.getGamepad();
    if (pad && pad.vibrationActuator && typeof pad.vibrationActuator.playEffect === 'function') {
      try {
        await pad.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1, Math.max(0, weakMagnitude)),
          strongMagnitude: Math.min(1, Math.max(0, strongMagnitude))
        });
      } catch (err) {
        // Gamepad vibration not supported or busy
      }
    }
  }

  consumeMouseDelta() {
    const delta = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return delta;
  }
}
