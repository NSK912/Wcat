// === SEEDPLANET MODULE: JS/SETTINGS.JS ===

// ============================================
// Global Settings & Keybindings
// ============================================

let sfxVolume = 0.5;
let playerFootstepVolume = 0.0;
let playerSwimVolume = 0.09;
let collectSfxVolume = 0.2;
let npcSfxVolume = 0.5;
let sfxMuted = false;

let isCurrentFullscreen = false;
const isAndroidProfile = /Android/i.test(navigator.userAgent);
let showScreenModeUI = !isAndroidProfile;
let renderScale = isAndroidProfile ? 0.25 : 1.0;
let mouseSensitivity = 1.0;
let uiMargin = 10;
let showFps = true;
let targetFps = isAndroidProfile ? 30 : 120;
let frameTime = 1000 / targetFps;

let shadowMapQuality = isAndroidProfile ? 1 : 2;
let shadowMapEnabled = shadowMapQuality > 0;
let antialiasEnabled = false;
let fxaaEnabled = true;
let taauEnabled = fxaaEnabled;

// Pre-load from localStorage immediately so they are available for WebGL initialization
try {
  const savedOptions = localStorage.getItem("seedplanet_options_config");
  if (savedOptions) {
    const parsedOptions = JSON.parse(savedOptions);
    if (parsedOptions) {
      if (typeof parsedOptions.shadowMapEnabled === "boolean") {
        shadowMapEnabled = parsedOptions.shadowMapEnabled; if(typeof parsedOptions.shadowMapQuality === "number") { shadowMapQuality = Math.max(1, parsedOptions.shadowMapQuality); }
        shadowMapEnabled = true;
      }
      if (typeof parsedOptions.antialiasEnabled === "boolean") {
        antialiasEnabled = parsedOptions.antialiasEnabled;
      }
      if (typeof parsedOptions.fxaaEnabled === "boolean") {
        fxaaEnabled = parsedOptions.fxaaEnabled;
        taauEnabled = fxaaEnabled;
      } else if (typeof parsedOptions.taauEnabled === "boolean") {
        fxaaEnabled = parsedOptions.taauEnabled;
        taauEnabled = fxaaEnabled;
      }
    }
  } else {
    const savedSettings = localStorage.getItem("seedplanet_settings");
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      if (parsedSettings) {
        if (typeof parsedSettings.shadowMapEnabled === "boolean") {
          shadowMapEnabled = parsedSettings.shadowMapEnabled;
        }
        if (typeof parsedSettings.antialiasEnabled === "boolean") {
          antialiasEnabled = parsedSettings.antialiasEnabled;
        }
        if (typeof parsedSettings.fxaaEnabled === "boolean") {
          fxaaEnabled = parsedSettings.fxaaEnabled;
          taauEnabled = fxaaEnabled;
        } else if (typeof parsedSettings.taauEnabled === "boolean") {
          fxaaEnabled = parsedSettings.taauEnabled;
          taauEnabled = fxaaEnabled;
        }
      }
    }
  }
} catch (e) {
  console.error("Failed to pre-load settings in settings.js:", e);
}

window.fxaaEnabled = fxaaEnabled;
window.taauEnabled = fxaaEnabled;
window.antialiasEnabled = antialiasEnabled;

let cameraMode = "tps";
var zoomLimitEnabled = true;
let cameraCollisionEnabled = true;
let ragdollEnabled = false;

let currentKeyBindings = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  interact: "KeyE",
  inventory: "Tab",
  diveDown: "KeyZ",
  diveUp: "ShiftLeft",
  toggleMouse: "AltLeft",
  action1: "Digit1",
  action2: "Digit2",
  action3: "Digit3",
  action4: "Digit4",
  rotate: "KeyQ",
  demolish: "CapsLock",
};

const DEFAULT_GAMEPAD_BINDINGS = {
  attack: 5,         // RB / R1 / R
  terrainMod: 7,     // RT / R2 / ZR
  flightThrottle: 7, // RT / R2 / ZR
  interact: 4,       // LB / L1 / L
  rotate: 6,         // LT / L2 / ZL
  jump: 0,           // A / Cross / B
  cancel: 1,         // B / Circle / A
  demolish: 2,       // X / Square / Y
  bottomShortcut: 3, // Y / Triangle / X
  inventory: 9,      // Menu / Options / +
  action1: 12,       // D-Pad Up
  action2: 15,       // D-Pad Right
  action3: 13,       // D-Pad Down
  action4: 14,       // D-Pad Left
  sprint: 10,        // LS / L3
  resetCam: 11,      // RS / R3
};

let currentGamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };

// Pre-load saved bindings if present
try {
  const savedCfg = localStorage.getItem("seedplanet_options_config");
  if (savedCfg) {
    const parsed = JSON.parse(savedCfg);
    if (parsed && parsed.gamepadBindings) {
      currentGamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS, ...parsed.gamepadBindings };
    }
  }
} catch (e) {}

window.currentGamepadBindings = currentGamepadBindings;
window.currentKeyBindings = currentKeyBindings;

let isWaitingForKey = false;
let bindingKeyToSet = null;
let currentBindingViewMode = "auto"; // "auto", "keyboard", "gamepad"
window.isWaitingForKey = false;

function isCurrentlyGamepadMode() {
  if (currentBindingViewMode === "gamepad") return true;
  if (currentBindingViewMode === "keyboard") return false;
  return !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected);
}
window.isCurrentlyGamepadMode = isCurrentlyGamepadMode;

function getGamepadButtonName(btnIdx, brand) {
  const isPS = brand === "playstation";
  const isSwitch = brand === "switch";

  const labels = {
    0: isPS ? "✕ (Cross)" : (isSwitch ? "B" : "A"),
    1: isPS ? "◯ (Circle)" : (isSwitch ? "A" : "B"),
    2: isPS ? "■ (Square)" : (isSwitch ? "Y" : "X"),
    3: isPS ? "▲ (Triangle)" : (isSwitch ? "X" : "Y"),
    4: isPS ? "L1" : (isSwitch ? "L" : "LB"),
    5: isPS ? "R1" : (isSwitch ? "R" : "RB"),
    6: isPS ? "L2" : (isSwitch ? "ZL" : "LT"),
    7: isPS ? "R2" : (isSwitch ? "ZR" : "RT"),
    8: isPS ? "Share" : (isSwitch ? "-" : "Back / View"),
    9: isPS ? "Options" : (isSwitch ? "+" : "Menu"),
    10: isPS ? "L3 (กดอนาล็อกซ้าย)" : (isSwitch ? "L-Stick (กด)" : "LS (กดอนาล็อกซ้าย)"),
    11: isPS ? "R3 (กดอนาล็อกขวา)" : (isSwitch ? "R-Stick (กด)" : "RS (กดอนาล็อกขวา)"),
    12: "D-Pad ↑ (ขึ้น)",
    13: "D-Pad ↓ (ลง)",
    14: "D-Pad ← (ซ้าย)",
    15: "D-Pad → (ขวา)"
  };

  return labels[btnIdx] || `ปุ่ม ${btnIdx}`;
}

function syncInputDeviceSettingsUI() {
  const isGp = isCurrentlyGamepadMode();

  // 1. Update Mouse / Right-Stick Sensitivity Label
  const mouseLabel = document.getElementById("mouseSensitivityLabel");
  if (mouseLabel) {
    if (isGp) {
      const brand = (window.GamepadController && typeof window.GamepadController.getBrand === "function") 
        ? window.GamepadController.getBrand() 
        : ((window.GamepadController && window.GamepadController.isPlayStation) ? "playstation" : "xbox");
      const rStickText = brand === "playstation" ? "ความไวอนาล็อกขวา (R-Stick / R3)" : (brand === "switch" ? "ความไวอนาล็อกขวา (R-Stick)" : "ความไวอนาล็อกขวา (RS / R3)");
      mouseLabel.textContent = typeof t === "function" ? t("rstick_sensitivity") : rStickText;
    } else {
      mouseLabel.textContent = typeof t === "function" ? t("mouse_sensitivity") : "ความไวเมาส์";
    }
  }

  // 2. Update Key / Gamepad Bindings Header
  const headerLabel = document.getElementById("keyBindingsHeaderLabel");
  if (headerLabel) {
    if (isGp) {
      const cName = window.GamepadController ? window.GamepadController.controllerName : "Gamepad";
      headerLabel.textContent = typeof t === "function" ? t("gamepad_bindings") : `ตั้งค่าปุ่มจอย (${cName})`;
    } else {
      headerLabel.textContent = typeof t === "function" ? t("key_bindings") : "ตั้งค่าปุ่มควบคุม";
    }
  }

  // 3. Update Toggle Buttons Styling
  const btnKb = document.getElementById("btnBindingModeKb");
  const btnGp = document.getElementById("btnBindingModeGp");
  if (btnKb && btnGp) {
    btnKb.style.borderRadius = "0px";
    btnGp.style.borderRadius = "0px";
    if (isGp) {
      btnGp.style.background = "rgba(223, 183, 108, 0.22)";
      btnGp.style.borderColor = "#dfb76c";
      btnGp.style.color = "#dfb76c";
      btnGp.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

      btnKb.style.background = "rgba(255, 255, 255, 0.05)";
      btnKb.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btnKb.style.color = "rgba(255, 255, 255, 0.6)";
      btnKb.style.textShadow = "none";
    } else {
      btnKb.style.background = "rgba(223, 183, 108, 0.22)";
      btnKb.style.borderColor = "#dfb76c";
      btnKb.style.color = "#dfb76c";
      btnKb.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

      btnGp.style.background = "rgba(255, 255, 255, 0.05)";
      btnGp.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btnGp.style.color = "rgba(255, 255, 255, 0.6)";
      btnGp.style.textShadow = "none";
    }
  }

  renderKeyBindingsUI();
}
window.syncInputDeviceSettingsUI = syncInputDeviceSettingsUI;

function renderKeyBindingsUI() {
  const container = document.getElementById("keyBindingsContainer");
  if (!container) return;

  const isGp = isCurrentlyGamepadMode();

  if (isGp) {
    const brand = (window.GamepadController && typeof window.GamepadController.getBrand === "function")
      ? window.GamepadController.getBrand()
      : ((window.GamepadController && window.GamepadController.isPlayStation) ? "playstation" : "xbox");
    const isPS = brand === "playstation";
    const isSwitch = brand === "switch";

    const gpBindings = [
      { id: "move", label: "เดิน / เคลื่อนที่ (Move)", fixed: true, fixedBtn: isPS ? "L-Stick (อนาล็อกซ้าย)" : (isSwitch ? "L-Stick (อนาล็อกซ้าย)" : "LS (อนาล็อกซ้าย)") },
      { id: "camera", label: "หมุนมุมกล้อง (Camera Look)", fixed: true, fixedBtn: isPS ? "R-Stick (อนาล็อกขวา)" : (isSwitch ? "R-Stick (อนาล็อกขวา)" : "RS (อนาล็อกขวา)") },
      { id: "attack", label: "โจมตี / ใช้อาวุธ / วางของ (Attack / Place)" },
      { id: "terrainMod", label: "ขุดดิน / ถมดิน (Dig / Fill Terrain)" },
      { id: "flightThrottle", label: "เรือติดปีก: เร่งเครื่อง (Flight Throttle)" },
      { id: "flightPitch", label: "เรือติดปีก: บินขึ้น / บินลง (Flight Pitch)", fixed: true, fixedBtn: "L-Stick ↑ (ขึ้น) / ↓ (ลง)" },
      { id: "interact", label: "สำรวจ / เก็บของ / ขี่ (Interact / Ride)" },
      { id: "rotate", label: "หมุนโครงสร้าง / ว่ายขึ้น (Rotate / Swim Up)" },
      { id: "jump", label: "กระโดด (Jump)" },
      { id: "cancel", label: "ยกเลิก / ปิดเมนู (Cancel / Close)" },
      { id: "demolish", label: "แอคชั่นด่วน / รื้อถอน (Quick Action / Demolish)" },
      { id: "bottomShortcut", label: "ลัดไป 3 ปุ่มล่างในกระเป๋า (Bottom Shortcut)" },
      { id: "inventory", label: "กระเป๋า / เมนู (Inventory / Menu)" },
      { id: "action1", label: "ช่องแอคชั่น 1 (Action Slot 1)" },
      { id: "action2", label: "ช่องแอคชั่น 2 (Action Slot 2)" },
      { id: "action3", label: "ช่องแอคชั่น 3 (Action Slot 3)" },
      { id: "action4", label: "ช่องแอคชั่น 4 (Action Slot 4)" },
      { id: "sprint", label: "วิ่งเร็ว / บูสต์ (Sprint / Boost)" },
      { id: "resetCam", label: "รีเซ็ตมุมกล้อง (Center Camera View)" },
    ];

    let html = "";
    for (const item of gpBindings) {
      const isFixed = !!item.fixed;
      const btnText = isFixed ? item.fixedBtn : getGamepadButtonName(currentGamepadBindings[item.id] !== undefined ? currentGamepadBindings[item.id] : DEFAULT_GAMEPAD_BINDINGS[item.id], brand);
      const itemLabel = (typeof t === "function") ? t("key_" + item.id) : item.label;
      html += `
        <div class="key-bind-row-wrapper" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 5px 8px; border: 1px solid rgba(223, 183, 108, 0.15); border-radius: 0px; transition: all 0.2s;">
            <span style="font-size: 11px; font-family: 'Google Sans', 'Kanit', sans-serif; color: #f1f5f9; pointer-events: none;">${itemLabel}</span>
            ${isFixed ? `
              <div class="fixed-bind-badge" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.45); padding: 4px 10px; font-size: 10px; font-family: 'Google Sans', 'Kanit', sans-serif; min-width: 60px; text-align: center; font-weight: bold; border-radius: 0px; user-select: none;">
                ${btnText}
              </div>
            ` : `
              <button type="button" class="key-bind-btn game-ui gp-bind-btn" data-gpaction="${item.id}" style="background: rgba(223, 183, 108, 0.15); border: 1px solid #dfb76c; color: #dfb76c; padding: 4px 12px; font-size: 10px; font-family: 'Google Sans', 'Kanit', sans-serif; min-width: 60px; text-align: center; font-weight: bold; text-shadow: 0 0 6px rgba(223, 183, 108, 0.3); border-radius: 0px; cursor: pointer; transition: all 0.2s; outline: none;">
                ${btnText}
              </button>
            `}
        </div>
      `;
    }
    container.innerHTML = html;

    const btns = container.querySelectorAll(".gp-bind-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.dataset.gpaction;
        if (!action) return;
        startBindingAction(action, true, e.currentTarget);
      });
    });
    return;
  }

  // Keyboard Mode
  const getLabel = (key) => {
    if (typeof t === "function") {
      const translated = t("key_" + key);
      if (translated && translated !== "key_" + key) return translated;
    }
    const defaultLabels = {
      forward: "เดินหน้า (Forward)",
      backward: "ถอยหลัง (Backward)",
      left: "เดินซ้าย (Left)",
      right: "เดินขวา (Right)",
      interact: "สำรวจ (Interact)",
      inventory: "กระเป๋า (Inventory)",
      diveDown: "ดำน้ำ (Dive Down)",
      diveUp: "ว่ายขึ้น (Swim Up)",
      toggleMouse: "ซ่อน/แสดง เมาส์จำลอง (Toggle Virtual Cursor)",
      action1: "ช่องแอคชั่น 1 (Action Slot 1)",
      action2: "ช่องแอคชั่น 2 (Action Slot 2)",
      action3: "ช่องแอคชั่น 3 (Action Slot 3)",
      action4: "ช่องแอคชั่น 4 (Action Slot 4)",
      rotate: "หมุนโครงสร้างตอนวาง (Rotate Structure)",
      demolish: "รื้อถอนสิ่งก่อสร้าง (Demolish)",
    };
    return defaultLabels[key] || key;
  };

  let html = "";
  for (const [key, value] of Object.entries(currentKeyBindings)) {
    const label = getLabel(key);
    const isLocked = key === "toggleMouse";
    const displayVal = value.replace("Key", "").replace("Arrow", "").replace("Left", "").replace("Right", "");
    html += `
        <div class="key-bind-row-wrapper" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 4px 8px; border: 1px solid rgba(255,255,255,0.05); border-radius: 0px; transition: all 0.2s;">
            <span style="font-size: 11px; font-family: 'Google Sans', 'Kanit', sans-serif; pointer-events: none;">${label}</span>
            ${isLocked ? `
              <div class="fixed-bind-badge" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.45); padding: 4px 10px; font-size: 10px; font-family: 'Google Sans', 'Kanit', sans-serif; min-width: 60px; text-align: center; font-weight: bold; border-radius: 0px; user-select: none;">
                ${displayVal}
              </div>
            ` : `
              <button class="key-bind-btn game-ui" data-key="${key}" style="background: rgba(223,183,108,0.15); border: 1px solid #dfb76c; color: #dfb76c; padding: 4px 12px; font-size: 11px; font-family: 'Google Sans', 'Kanit', sans-serif; cursor: pointer; min-width: 60px; text-align: center; border-radius: 0px; transition: all 0.2s; outline: none;">
                ${displayVal}
              </button>
            `}
        </div>
    `;
  }

  container.innerHTML = html;

  const btns = container.querySelectorAll(".key-bind-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.currentTarget.dataset.key;
      if (!key) return;
      startBindingAction(key, false, e.currentTarget);
    });
  });
}

function startBindingAction(actionKey, isGamepadAction, btnElement) {
  if (isWaitingForKey) return;
  isWaitingForKey = true;
  window.isWaitingForKey = true;
  window.isWaitingForGamepadMode = isGamepadAction;
  bindingKeyToSet = actionKey;
  window.bindingKeyToSet = actionKey;
  window.keyBindingStartTime = Date.now();

  if (typeof window.clearKeysPressed === "function") {
    try { window.clearKeysPressed(); } catch(e){}
  }

  btnElement.style.background = "rgba(239, 68, 68, 0.25)";
  btnElement.style.borderColor = "#ef4444";
  btnElement.style.color = "#ef4444";
  btnElement.style.boxShadow = "0 0 12px rgba(239, 68, 68, 0.6)";
  btnElement.textContent = typeof t === "function" ? t("key_press_key") : "กดปุ่ม...";

  const finish = () => {
    isWaitingForKey = false;
    window.isWaitingForKey = false;
    window.lastRebindFinishTime = Date.now();
    if (window.GamepadController) {
      window.GamepadController.lastRebindFinishTime = Date.now();
      window.GamepadController.rebindDebounceUntil = Date.now() + 350;
      window.GamepadController.prevADown = true;
      window.GamepadController.prevBDown = true;
      window.GamepadController.prevXDown = true;
      window.GamepadController.prevYDown = true;
      window.GamepadController.prevRBDown = true;
      window.GamepadController.prevLBDown = true;
      window.GamepadController.prevRTDown = true;
      window.GamepadController.prevLTDown = true;
    }
    bindingKeyToSet = null;
    window.bindingKeyToSet = null;
    window.setKeyFromGamepadButton = null;
    window.removeEventListener("keydown", keyHandler, true);
    window.removeEventListener("keyup", keyupHandler, true);
    window.removeEventListener("keypress", keypressHandler, true);
    if (typeof window.clearKeysPressed === "function") {
      try { window.clearKeysPressed(); } catch(e){}
    }
    if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(e){}
    renderKeyBindingsUI();
    if (typeof saveSettingsToLocalStorage === "function") {
      saveSettingsToLocalStorage();
    } else if (typeof window.saveSettingsToLocalStorage === "function") {
      window.saveSettingsToLocalStorage();
    }
  };

  const keyHandler = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") {
      ev.stopImmediatePropagation();
    }
    if (isGamepadAction) {
      if (ev.code === "Escape") {
        finish();
      }
      return;
    } else {
      currentKeyBindings[actionKey] = ev.code;
      window.currentKeyBindings = currentKeyBindings;
      finish();
    }
  };

  const keyupHandler = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") {
      ev.stopImmediatePropagation();
    }
  };

  const keypressHandler = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") {
      ev.stopImmediatePropagation();
    }
  };

  window.addEventListener("keydown", keyHandler, true);
  window.addEventListener("keyup", keyupHandler, true);
  window.addEventListener("keypress", keypressHandler, true);

  window.setKeyFromGamepadButton = function(btnIndex, btnLabel) {
    if (Date.now() - (window.keyBindingStartTime || 0) < 180) {
      return false; // Still within debounce time from activating button
    }

    if (isGamepadAction) {
      currentGamepadBindings[actionKey] = btnIndex;
      window.currentGamepadBindings = currentGamepadBindings;
    } else {
      const gpToKeyMap = {
        0: "Space",
        1: "Escape",
        2: "CapsLock",
        3: "KeyY",
        4: "KeyE",
        5: "Mouse0",
        6: "KeyQ",
        7: "Mouse2",
        8: "Tab",
        9: "Tab",
        10: "ShiftLeft",
        11: "KeyR",
        12: "Digit1",
        13: "Digit3",
        14: "Digit4",
        15: "Digit2"
      };
      currentKeyBindings[actionKey] = gpToKeyMap[btnIndex] || ("Button" + btnIndex);
      window.currentKeyBindings = currentKeyBindings;
    }

    finish();
    return true;
  };
}

function syncInventorySettingsUI() {
  const sfxSlider = document.getElementById("sfxVolumeSlider");
  const sfxVal = document.getElementById("sfxVolumeVal");
  if (sfxSlider && sfxVal) {
    sfxSlider.value = Math.round(sfxVolume * 100);
    sfxVal.textContent = Math.round(sfxVolume * 100) + "%";
  }

  const pfSlider = document.getElementById("playerFootstepVolumeSlider");
  const pfVal = document.getElementById("playerFootstepVolumeVal");
  if (pfSlider && pfVal) {
    pfSlider.value = Math.round(playerFootstepVolume * 100);
    pfVal.textContent = Math.round(playerFootstepVolume * 100) + "%";
  }

  const psSlider = document.getElementById("playerSwimVolumeSlider");
  const psVal = document.getElementById("playerSwimVolumeVal");
  if (psSlider && psVal) {
    psSlider.value = Math.round(playerSwimVolume * 100);
    psVal.textContent = Math.round(playerSwimVolume * 100) + "%";
  }

  const cSlider = document.getElementById("collectSfxVolumeSlider");
  const cVal = document.getElementById("collectSfxVolumeVal");
  if (cSlider && cVal) {
    cSlider.value = Math.round(collectSfxVolume * 100);
    cVal.textContent = Math.round(collectSfxVolume * 100) + "%";
  }

  const nSlider = document.getElementById("npcSfxVolumeSlider");
  const nVal = document.getElementById("npcSfxVolumeVal");
  if (nSlider && nVal) {
    nSlider.value = Math.round(npcSfxVolume * 100);
    nVal.textContent = Math.round(npcSfxVolume * 100) + "%";
  }

  if (typeof setSFXMuted === 'function') {
    setSFXMuted(sfxMuted);
  }

  const scaleSlider = document.getElementById("renderScaleSlider");
  const scaleVal = document.getElementById("renderScaleVal");
  if (scaleSlider && scaleVal) {
    scaleSlider.value = Math.round(renderScale * 100);
    scaleVal.textContent = Math.round(renderScale * 100) + "%";
  }

  const sensSlider = document.getElementById("mouseSensitivitySlider");
  const sensVal = document.getElementById("mouseSensitivityVal");
  if (sensSlider && sensVal) {
    sensSlider.value = Math.round(mouseSensitivity * 100);
    sensVal.textContent = mouseSensitivity.toFixed(2) + "x";
  }

  function updateFxaaUI() {
    const btnOn = document.getElementById("fxaaToggleOn") || document.getElementById("taauToggleOn");
    const btnOff = document.getElementById("fxaaToggleOff") || document.getElementById("taauToggleOff");
    if (!btnOn || !btnOff) return;
    const isEnabled = typeof window.fxaaEnabled !== "undefined" ? window.fxaaEnabled : (typeof fxaaEnabled !== "undefined" ? fxaaEnabled : true);
    if (isEnabled) {
      btnOn.style.background = "rgba(223, 183, 108, 0.15)";
      btnOn.style.borderColor = "#dfb76c";
      btnOn.style.color = "#dfb76c";
      btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

      btnOff.style.background = "rgba(255, 255, 255, 0.05)";
      btnOff.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btnOff.style.color = "rgba(255, 255, 255, 0.6)";
      btnOff.style.textShadow = "none";
    } else {
      btnOff.style.background = "rgba(223, 183, 108, 0.15)";
      btnOff.style.borderColor = "#dfb76c";
      btnOff.style.color = "#dfb76c";
      btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

      btnOn.style.background = "rgba(255, 255, 255, 0.05)";
      btnOn.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btnOn.style.color = "rgba(255, 255, 255, 0.6)";
      btnOn.style.textShadow = "none";
    }
  }
  window.updateFxaaUI = updateFxaaUI;
  window.updateTaauUI = updateFxaaUI;

  if (typeof syncScreenModeUI === 'function') syncScreenModeUI();
  if (typeof updateFpsToggleUI === 'function') updateFpsToggleUI();
  if (typeof updateFpsLimitUI === 'function') updateFpsLimitUI();
  if (typeof updateShadowMapUI === 'function') updateShadowMapUI();
  if (typeof updateAntialiasUI === 'function') updateAntialiasUI();
  updateFxaaUI();

  renderKeyBindingsUI();
  if (typeof window.updateCustomScrollbar === "function") setTimeout(window.updateCustomScrollbar, 30);
}

function initSettingsEventListeners() {
  const fxaaOn = document.getElementById("fxaaToggleOn") || document.getElementById("taauToggleOn");
  if (fxaaOn) {
    fxaaOn.addEventListener("click", () => {
      fxaaEnabled = true;
      taauEnabled = true;
      window.fxaaEnabled = true;
      window.taauEnabled = true;
      try {
        const opt = JSON.parse(localStorage.getItem("seedplanet_options_config") || "{}");
        opt.fxaaEnabled = true;
        opt.taauEnabled = true;
        localStorage.setItem("seedplanet_options_config", JSON.stringify(opt));
      } catch(err) {}
      if (typeof updateFxaaUI === "function") updateFxaaUI();
      if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
      else if (typeof window.saveSettingsToLocalStorage === "function") window.saveSettingsToLocalStorage();
    });
  }
  const fxaaOff = document.getElementById("fxaaToggleOff") || document.getElementById("taauToggleOff");
  if (fxaaOff) {
    fxaaOff.addEventListener("click", () => {
      fxaaEnabled = false;
      taauEnabled = false;
      window.fxaaEnabled = false;
      window.taauEnabled = false;
      try {
        const opt = JSON.parse(localStorage.getItem("seedplanet_options_config") || "{}");
        opt.fxaaEnabled = false;
        opt.taauEnabled = false;
        localStorage.setItem("seedplanet_options_config", JSON.stringify(opt));
      } catch(err) {}
      if (typeof updateFxaaUI === "function") updateFxaaUI();
      if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
      else if (typeof window.saveSettingsToLocalStorage === "function") window.saveSettingsToLocalStorage();
    });
  }

  const sfxSlider = document.getElementById("sfxVolumeSlider");
  if (sfxSlider) {
    sfxSlider?.addEventListener("input", (e) => {
      sfxVolume = parseInt(e.target.value) / 100;
      document.getElementById("sfxVolumeVal").textContent = e.target.value + "%";
    });
    sfxSlider?.addEventListener("change", () => {
      if (typeof playCollectSound === 'function') playCollectSound();
    });
  }

  const muteBtn = document.getElementById("sfxMuteToggle");
  if (muteBtn) {
    muteBtn?.addEventListener("click", () => {
      sfxMuted = !sfxMuted;
      if (typeof setSFXMuted === 'function') setSFXMuted(sfxMuted);
      if (typeof playCollectSound === 'function') playCollectSound();
    });
  }

  const renderSlider = document.getElementById("renderScaleSlider");
  if (renderSlider) {
    renderSlider?.addEventListener("input", (e) => {
      let val = Math.round(parseInt(e.target.value) / 10) * 10;
      val = Math.max(10, Math.min(100, val));
      e.target.value = val;
      renderScale = val / 100;
      document.getElementById("renderScaleVal").textContent = val + "%";
      if (typeof resizeCanvas === 'function') {
        resizeCanvas();
      }
    });
  }

  const sensSlider = document.getElementById("mouseSensitivitySlider");
  if (sensSlider) {
    sensSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      mouseSensitivity = val / 100;
      document.getElementById("mouseSensitivityVal").textContent = mouseSensitivity.toFixed(2) + "x";
    });
  }

  // Binding view mode buttons (Keyboard vs Gamepad)
  const btnKb = document.getElementById("btnBindingModeKb");
  if (btnKb) {
    btnKb.addEventListener("click", () => {
      currentBindingViewMode = "keyboard";
      syncInputDeviceSettingsUI();
    });
  }
  const btnGp = document.getElementById("btnBindingModeGp");
  if (btnGp) {
    btnGp.addEventListener("click", () => {
      currentBindingViewMode = "gamepad";
      syncInputDeviceSettingsUI();
    });
  }

  // Auto detect input switch
  window.addEventListener("keydown", (e) => {
    if (e && e.isTrusted === false) return;
    if (currentBindingViewMode === "auto" && window.isUsingGamepad) {
      if (window.GamepadController && typeof window.GamepadController.setInputDeviceMode === "function") {
        window.GamepadController.setInputDeviceMode(false);
      } else {
        window.isUsingGamepad = false;
        syncInputDeviceSettingsUI();
      }
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (e && (e.isTrusted === false || e.simulated)) return;
    const dx = Math.abs(e.movementX || 0);
    const dy = Math.abs(e.movementY || 0);
    if ((dx > 2 || dy > 2) && currentBindingViewMode === "auto" && window.isUsingGamepad) {
      if (window.GamepadController && typeof window.GamepadController.setInputDeviceMode === "function") {
        window.GamepadController.setInputDeviceMode(false);
      } else {
        window.isUsingGamepad = false;
        syncInputDeviceSettingsUI();
      }
    }
  });

  const pfSlider = document.getElementById("playerFootstepVolumeSlider");
  if (pfSlider) {
    pfSlider?.addEventListener("input", (e) => {
      playerFootstepVolume = parseInt(e.target.value) / 100;
      document.getElementById("playerFootstepVolumeVal").textContent = e.target.value + "%";
    });
  }

  const psSlider = document.getElementById("playerSwimVolumeSlider");
  if (psSlider) {
    psSlider?.addEventListener("input", (e) => {
      playerSwimVolume = parseInt(e.target.value) / 100;
      document.getElementById("playerSwimVolumeVal").textContent = e.target.value + "%";
    });
  }

  const cSlider = document.getElementById("collectSfxVolumeSlider");
  if (cSlider) {
    cSlider?.addEventListener("input", (e) => {
      collectSfxVolume = parseInt(e.target.value) / 100;
      document.getElementById("collectSfxVolumeVal").textContent = e.target.value + "%";
    });
  }

  const nSlider = document.getElementById("npcSfxVolumeSlider");
  if (nSlider) {
    nSlider?.addEventListener("input", (e) => {
      npcSfxVolume = parseInt(e.target.value) / 100;
      document.getElementById("npcSfxVolumeVal").textContent = e.target.value + "%";
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsEventListeners);
} else {
  initSettingsEventListeners();
}
