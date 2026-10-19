// Global references declared early to avoid load-time reference errors in other modules
var canvas = null;
var gl = null;
var isWebGL2 = false;
var supportUint32 = false;
var RADIUS = 8.0;
var HEIGHT_SCALE = 0.6;
var globalSeed = 0;

var currentGridSize = 400;

var PLANET_CORE_POS = [0, 0, 0];
function getPlanetCorePosition() {
  return window.PLANET_CORE_POS || PLANET_CORE_POS;
}
function setPlanetCorePosition(x, y, z) {
  if (Array.isArray(x)) {
    window.PLANET_CORE_POS = [x[0], x[1], x[2]];
  } else {
    window.PLANET_CORE_POS = [x, y, z];
  }
  PLANET_CORE_POS = window.PLANET_CORE_POS;
  return window.PLANET_CORE_POS;
}

function updatePlanetRadiusAndHeightScale(newRadius) {
  const r = Math.max(1.0, parseFloat(newRadius) || 8.0);
  RADIUS = r;
  // Dynamic height scaling (8.0 is 0.6 baseline, larger radius has proportionate mountains)
  HEIGHT_SCALE = 0.6 * Math.pow(r / 8.0, 0.70);
  currentGridSize = Math.max(100, Math.min(1600, Math.round(r * 12.5)));
  if (typeof window !== 'undefined') {
    window.RADIUS = r;
    window.HEIGHT_SCALE = HEIGHT_SCALE;
    window.currentGridSize = currentGridSize;
    if (typeof window.clearCache === 'function') {
      window.clearCache();
    }
  }
  return { radius: RADIUS, heightScale: HEIGHT_SCALE, gridSize: currentGridSize };
}

if (typeof window !== 'undefined') {
  window.RADIUS = 8.0;
  window.HEIGHT_SCALE = 0.6;
  window.currentGridSize = 400;
  window.globalSeed = 0;
  window.PLANET_CORE_POS = PLANET_CORE_POS;
  window.getPlanetCorePosition = getPlanetCorePosition;
  window.setPlanetCorePosition = setPlanetCorePosition;
  window.updatePlanetRadiusAndHeightScale = updatePlanetRadiusAndHeightScale;
}

// === SEEDPLANET MODULE: JS/UTILS.JS ===

// ============================================
// Global Custom Simulated Pointer Lock & Cursor System
// ============================================
var simulatedPointerLock = false;
var customCursorEl = null;
var virtualCursorX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
var virtualCursorY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
var hasVirtualCursorInitialized = false;
var isSyntheticEvent = false;
var lastHoveredEl = null;

// Helper to check if any UI overlay is open
function isUIOpen() {
  const inv = document.getElementById("inventoryOverlay");
  if (inv && inv.classList.contains("open")) return true;
  
  const chest = document.getElementById("chestOverlay");
  if (chest && chest.classList.contains("open")) return true;

  const warp = document.getElementById("warpOverlay");
  if (warp && warp.classList.contains("open")) return true;
  
  const isStarted = (typeof gameStarted !== "undefined" && gameStarted) || (typeof window.gameStarted !== "undefined" && window.gameStarted);
  if (!isStarted) {
    const start = document.getElementById("gameStartOverlay");
    if (start && start.style.display !== "none" && !start.classList.contains("fade-out")) return true;
  }
  
  const saveSelect = document.getElementById("saveSelectOverlay");
  if (saveSelect && saveSelect.classList.contains("open")) return true;

  const trash = document.getElementById("trashConfirmOverlay");
  if (trash && trash.style.display !== "none" && trash.style.display !== "") return true;

  const antialias = document.getElementById("antialiasConfirmOverlay");
  if (antialias && antialias.style.display !== "none" && antialias.style.display !== "") return true;

  return false;
}

// Helper to check if element is interactive (button, slot, clickable UI control, slider, tab)
function getInteractiveTarget(el) {
  if (!el || el === document.body || el === document.documentElement || el === canvas) return null;
  return el.closest("button, a, input, select, textarea, [onclick], .inventory-slot, .action-slot, .close-btn, .inventory-btn, .touch-btn, .tab-btn, .clickable, [role='button'], .item-card, .save-slot-card, .save-card, .btn, [draggable='true'], .slider, .range-slider, .setting-slider, .tab, [id^='tab'], .recipe-item, .craft-tab, .quick-slot, [data-action], [data-clickable]");
}

// Ensure custom circular cursor exists with high-precision center dot and gold hover feedback
function ensureCustomCursor() {
  if (customCursorEl && document.body && document.body.contains(customCursorEl)) return customCursorEl;
  let cursor = document.getElementById("customGameCursor");
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = "customGameCursor";
    cursor.innerHTML = '<div class="custom-cursor-dot"></div>';
    if (document.body) document.body.appendChild(cursor);

    if (!document.getElementById("customCursorStyles")) {
      const style = document.createElement("style");
      style.id = "customCursorStyles";
      style.textContent = `
        #customGameCursor {
          position: fixed;
          top: 0; left: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.95);
          background-color: rgba(10, 10, 15, 0.7);
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.6);
          pointer-events: none !important;
          z-index: 2147483647;
          transform: translate3d(-50%, -50%, 0);
          will-change: transform;
          display: block;
          box-sizing: border-box;
          transition: border-color 0.1s ease, box-shadow 0.1s ease, opacity 0.15s ease;
        }
        #customGameCursor.hovering {
          border-color: #dfb76c !important;
          box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.9), 0 0 12px rgba(223, 183, 108, 0.75) !important;
        }
        #customGameCursor.clicking {
          box-shadow: 0 0 0 2px #dfb76c, 0 0 14px rgba(223, 183, 108, 0.9) !important;
        }
        #customGameCursor * {
          pointer-events: none !important;
        }
        #customGameCursor .custom-cursor-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 4px;
          background-color: #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none !important;
          transition: background-color 0.1s ease;
        }
        #customGameCursor.hovering .custom-cursor-dot {
          background-color: #dfb76c !important;
        }
        #customGameCursor.clicking .custom-cursor-dot {
          background-color: #ffffff !important;
        }
        body.custom-cursor-active,
        body.custom-cursor-active canvas,
        body.custom-cursor-active * {
          cursor: none !important;
        }
        .virtual-hover {
          filter: brightness(1.25) !important;
          outline: 2px solid rgba(223, 183, 108, 0.85) !important;
          outline-offset: -1px;
        }
      `;
      if (document.head) document.head.appendChild(style);
    }
  }
  customCursorEl = cursor;
  if (document.body) document.body.classList.add("custom-cursor-active");
  return cursor;
}

// Intercept document.pointerLockElement
(function setupSimulatedPointerLock() {
  const originalPointerLockElementDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement');

  try {
    Object.defineProperty(document, 'pointerLockElement', {
      get() {
        const nativeEl = originalPointerLockElementDesc ? originalPointerLockElementDesc.get.call(document) : null;
        if (nativeEl) return nativeEl;
        if (simulatedPointerLock) return canvas || document.body;
        return null;
      },
      configurable: true
    });
  } catch (e) {
    console.warn("Could not override pointerLockElement getter:", e);
  }

  const originalExitPointerLock = Document.prototype.exitPointerLock;
  document.exitPointerLock = function() {
    // Only allow exit pointer lock if requested during window blur / switching app
    if (!window.isSwitchingApp) {
      return; // Ignore internal exit calls from game menus so pointer lock stays locked!
    }
    simulatedPointerLock = false;
    const nativeEl = originalPointerLockElementDesc ? originalPointerLockElementDesc.get.call(document) : null;
    if (nativeEl && originalExitPointerLock) {
      try { originalExitPointerLock.call(document); } catch(err){}
    }
    document.dispatchEvent(new Event('pointerlockchange'));
  };
})();

function requestPointerLockSafe() {
  ensureCustomCursor();
  simulatedPointerLock = true;

  if (typeof canvas !== 'undefined' && canvas && typeof canvas.requestPointerLock === 'function') {
    try {
      const promise = canvas.requestPointerLock();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch (e) {}
  }

  if (document.body) document.body.classList.add("custom-cursor-active");
  document.dispatchEvent(new Event('pointerlockchange'));
}

function requestPointerLockSafeLegacy() {
  requestPointerLockSafe();
}

// Lock on first click from start screen or page
window.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") return;
  requestPointerLockSafe();
}, { capture: true });

// App Switching Unlock Behavior (unlock real mouse ONLY when switching to another app/tab)
window.isSwitchingApp = false;
window.addEventListener("blur", () => {
  window.isSwitchingApp = true;
  simulatedPointerLock = false;
  if (document.body) document.body.classList.remove("custom-cursor-active");
  if (typeof document.exitPointerLock === "function") {
    try { document.exitPointerLock(); } catch(e){}
  }
  window.isSwitchingApp = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.isSwitchingApp = true;
    simulatedPointerLock = false;
    if (document.body) document.body.classList.remove("custom-cursor-active");
    if (typeof document.exitPointerLock === "function") {
      try { document.exitPointerLock(); } catch(e){}
    }
    window.isSwitchingApp = false;
  }
});

// Synthetic DataTransfer for Virtual Drag and Drop
class SyntheticDataTransfer {
  constructor() {
    this.data = {};
    this.effectAllowed = "all";
    this.dropEffect = "move";
    this.types = [];
  }
  setData(format, val) {
    this.data[format] = String(val);
    if (!this.types.includes(format)) this.types.push(format);
  }
  getData(format) {
    return this.data[format] || "";
  }
  clearData(format) {
    if (format) {
      delete this.data[format];
      this.types = this.types.filter(t => t !== format);
    } else {
      this.data = {};
      this.types = [];
    }
  }
  setDragImage(img, x, y) {}
}

var isVirtualMouseDown = false;
var virtualMouseDownX = 0;
var virtualMouseDownY = 0;
var activeVirtualDragTarget = null;
var activeVirtualDragInput = null;
var activeVirtualCustomScrollbar = null;
var isVirtualDraggingSlot = false;
var didVirtualDrag = false;
var virtualDragSource = null;
var virtualDataTransfer = null;
var virtualDragGhost = null;
var virtualDragLastOver = null;

function createVirtualDragGhost(sourceEl) {
  if (virtualDragGhost && virtualDragGhost.parentNode) {
    virtualDragGhost.parentNode.removeChild(virtualDragGhost);
  }
  if (!sourceEl) return null;

  const rect = sourceEl.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 56;
  const height = rect.height > 0 ? rect.height : 56;

  // Deep clone the source slot element so its exact borders, cut corners (--slot-cut), badge, icon & text are preserved
  const ghost = sourceEl.cloneNode(true);
  ghost.id = "virtualDragGhost";

  // Strip state classes from clone so it renders in its full pristine appearance
  ghost.classList.remove("dragging", "dragging-active", "dragover", "selected", "hover");

  // Style the cloned ghost element for fixed positioning under the virtual cursor
  ghost.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: ${width}px !important;
    height: ${height}px !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    transform: translate3d(-50%, -50%, 0) !important;
    will-change: transform !important;
    opacity: 0.95 !important;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.75)) !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    transition: none !important;
    animation: none !important;
  `;

  // Preserve clipPath if defined via inline style or computed CSS
  const computed = window.getComputedStyle(sourceEl);
  if (computed.clipPath && computed.clipPath !== "none") {
    ghost.style.clipPath = computed.clipPath;
  }

  if (document.body) document.body.appendChild(ghost);
  return ghost;
}

// Calculate and update range input value from virtual cursor X position
function updateRangeInputFromVirtualCursor(inputEl, clientX) {
  if (!inputEl) return;
  const input = (inputEl.tagName === "INPUT" && inputEl.type === "range") ? inputEl : inputEl.closest("input[type='range']");
  if (!input) return;

  const rect = input.getBoundingClientRect();
  if (rect.width <= 0) return;

  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const step = parseFloat(input.step) || 1;

  let ratio = (clientX - rect.left) / rect.width;
  ratio = Math.max(0, Math.min(1, ratio));

  let rawValue = min + ratio * (max - min);
  let snappedValue = rawValue;
  if (step > 0) {
    snappedValue = Math.round((rawValue - min) / step) * step + min;
  }
  snappedValue = Math.max(min, Math.min(max, snappedValue));

  const stepDecimals = (String(step).split(".")[1] || "").length;
  const formattedValue = snappedValue.toFixed(stepDecimals);

  if (String(input.value) !== formattedValue) {
    input.value = formattedValue;
    input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  }
}

// Virtual cursor visibility manager (toggled manually via Alt)
window.isVirtualCursorManualHidden = false;

function updateVirtualCursorVisibility() {
  const cursor = ensureCustomCursor();
  if (!cursor) return;

  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
  
  const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);

  let targetDisplay = "block";
  let targetOpacity = "1";

  if (isTouch && !isDev) {
    targetDisplay = "none";
    targetOpacity = "0";
  } else if (uiOpen) {
    if (window.isGamepadUINavActive) {
      targetDisplay = "none";
      targetOpacity = "0";
    } else {
      targetDisplay = "block";
      targetOpacity = "1";
    }
  } else if (window.isVirtualCursorManualHidden) {
    targetDisplay = "block";
    targetOpacity = "0";
  } else {
    targetDisplay = "block";
    targetOpacity = "1";
  }

  if (cursor.style.display !== targetDisplay) cursor.style.display = targetDisplay;
  if (cursor.style.opacity !== targetOpacity) cursor.style.opacity = targetOpacity;
}
window.updateVirtualCursorVisibility = updateVirtualCursorVisibility;

// Observe UI overlay changes to update cursor visibility dynamically
if (typeof window !== "undefined") {
  const initUIObserver = () => {
    if (document.body && typeof MutationObserver !== "undefined") {
      let lastUIOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
      const observer = new MutationObserver(() => {
        const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
        
        if (uiOpen !== lastUIOpen) {
          lastUIOpen = uiOpen;
          if (uiOpen) {
            if (typeof window.resetVirtualCursorToCenter === "function") window.resetVirtualCursorToCenter();
          } else {
            if (window.isVirtualCursorManualHidden) {
              if (typeof requestPointerLockSafe === "function") requestPointerLockSafe();
            }
          }
          updateVirtualCursorVisibility();
        }
      });

      // Target only the specific overlay containers instead of the whole page subtree to prevent mutation thrashing
      const overlayIds = ["inventoryOverlay", "chestOverlay", "warpOverlay", "saveSelectOverlay"];
      overlayIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          observer.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
        }
      });
      // Fallback observation on body for class changes only (no subtree style churn)
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUIObserver);
  } else {
    initUIObserver();
  }
}

window.resetVirtualCursorToCenter = function() {
  virtualCursorX = window.innerWidth / 2;
  virtualCursorY = window.innerHeight / 2;
  const cursor = typeof ensureCustomCursor === "function" ? ensureCustomCursor() : document.getElementById("customGameCursor");
  if (cursor) {
    const newT = `translate3d(${virtualCursorX}px, ${virtualCursorY}px, 0) translate(-50%, -50%)`;
    if (cursor._lastT !== newT) { cursor.style.transform = newT; cursor._lastT = newT; }
  }
};

function toggleVirtualCursorVisibility() {
  window.isVirtualCursorManualHidden = !window.isVirtualCursorManualHidden;
  if (!window.isVirtualCursorManualHidden) {
    if (typeof window.resetVirtualCursorToCenter === "function") window.resetVirtualCursorToCenter();
  } else {
    // When hiding the virtual cursor, we MUST request native pointer lock so the user can look around!
    if (typeof requestPointerLockSafe === "function") requestPointerLockSafe();
  }
  updateVirtualCursorVisibility();
}
window.toggleVirtualCursorVisibility = toggleVirtualCursorVisibility;

// RequestAnimationFrame throttling for virtual hover and dragover detection to eliminate CPU stutter
let lastPointerMoveTime = 0;
let hoverRafId = null;
let pendingHoverX = 0;
let pendingHoverY = 0;

function scheduleHoverUpdate(x, y) {
  pendingHoverX = x;
  pendingHoverY = y;
  if (hoverRafId !== null) return;
  hoverRafId = requestAnimationFrame(runHoverUpdate);
}

function runHoverUpdate() {
  hoverRafId = null;
  const cursor = ensureCustomCursor();
  if (!cursor) return;

  const hx = pendingHoverX;
  const hy = pendingHoverY;

  // Virtual hover state dispatch - ONLY for interactive elements
  const rawHoverEl = document.elementFromPoint(hx, hy);
  const interactiveTarget = getInteractiveTarget(rawHoverEl);

  if (interactiveTarget !== lastHoveredEl) {
    if (lastHoveredEl) {
      try { lastHoveredEl.classList.remove("virtual-hover"); } catch(err){}
      try {
        lastHoveredEl.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: false, clientX: hx, clientY: hy }));
        lastHoveredEl.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true, clientX: hx, clientY: hy }));
      } catch(err){}
    }
    if (interactiveTarget) {
      try { interactiveTarget.classList.add("virtual-hover"); } catch(err){}
      try {
        interactiveTarget.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: false, clientX: hx, clientY: hy }));
        interactiveTarget.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, clientX: hx, clientY: hy }));
      } catch(err){}
      cursor.classList.add("hovering");
    } else {
      cursor.classList.remove("hovering");
    }
    lastHoveredEl = interactiveTarget;
  }

  // Handle slot dragover / dragenter / dragleave during dragging
  if (isVirtualDraggingSlot && virtualDragSource) {
    const currOver = document.elementFromPoint(hx, hy);
    if (currOver !== virtualDragLastOver) {
      if (virtualDragLastOver) {
        const leaveEvt = new Event("dragleave", { bubbles: true, cancelable: true });
        leaveEvt.dataTransfer = virtualDataTransfer;
        virtualDragLastOver.dispatchEvent(leaveEvt);
        if (typeof virtualDragLastOver.ondragleave === "function") {
          try { virtualDragLastOver.ondragleave(leaveEvt); } catch(err){}
        }
      }
      if (currOver) {
        const enterEvt = new Event("dragenter", { bubbles: true, cancelable: true });
        enterEvt.dataTransfer = virtualDataTransfer;
        currOver.dispatchEvent(enterEvt);
        if (typeof currOver.ondragenter === "function") {
          try { currOver.ondragenter(enterEvt); } catch(err){}
        }
      }
      virtualDragLastOver = currOver;
    }

    if (currOver) {
      const overEvt = new Event("dragover", { bubbles: true, cancelable: true });
      overEvt.dataTransfer = virtualDataTransfer;
      overEvt.clientX = hx;
      overEvt.clientY = hy;
      currOver.dispatchEvent(overEvt);
      if (typeof currOver.ondragover === "function") {
        try { currOver.ondragover(overEvt); } catch(err){}
      }
    }
  }

  // Dispatch mousemove only on active drag target if dragging or mouse is down
  if (isVirtualMouseDown && activeVirtualDragTarget) {
    isSyntheticEvent = true;
    try {
      activeVirtualDragTarget.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: hx,
        clientY: hy,
        screenX: hx,
        screenY: hy,
        buttons: 1,
        button: 0
      }));
    } catch(err){}
    isSyntheticEvent = false;
  }
}

// Update mouse coordinates, virtual cursor, hover, movement, and drag
function handleVirtualMouseMove(e) {
  if (isSyntheticEvent) return;

  const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);
  if (isTouch && !isDev) return;

  // De-duplicate: If pointermove was just handled, ignore duplicate mousemove event fired by the browser
  const now = performance.now();
  if (e.type === "pointermove") {
    lastPointerMoveTime = now;
  } else if (e.type === "mousemove" && (now - lastPointerMoveTime < 16)) {
    return;
  }

  const cursor = ensureCustomCursor();
  if (!cursor) return;

  if (!hasVirtualCursorInitialized) {
    virtualCursorX = (typeof e.clientX === "number" && !isNaN(e.clientX)) ? e.clientX : window.innerWidth / 2;
    virtualCursorY = (typeof e.clientY === "number" && !isNaN(e.clientY)) ? e.clientY : window.innerHeight / 2;
    hasVirtualCursorInitialized = true;
  }

  const isNativeLocked = !!(Object.getOwnPropertyDescriptor(Document.prototype, 'pointerLockElement')?.get?.call(document));
  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;

  if (window.isGamepadUINavActive && uiOpen && (Math.abs(e.movementX || 0) > 2 || Math.abs(e.movementY || 0) > 2)) {
    window.isGamepadUINavActive = false;
    document.querySelectorAll(".gamepad-focused").forEach(el => el.classList.remove("gamepad-focused"));
  }

  if (window.isVirtualCursorManualHidden && !uiOpen) {
    virtualCursorX = window.innerWidth / 2;
    virtualCursorY = window.innerHeight / 2;
  } else {
    if (isNativeLocked) {
      if (e.movementX !== undefined && e.movementY !== undefined) {
        const sens = (typeof mouseSensitivity === "number" && mouseSensitivity > 0) ? mouseSensitivity : 1.0;
        virtualCursorX += e.movementX * sens;
        virtualCursorY += e.movementY * sens;
      }
    } else if (typeof e.clientX === "number" && !isNaN(e.clientX)) {
      virtualCursorX = e.clientX;
      virtualCursorY = e.clientY;
    }
    virtualCursorX = Math.max(0, Math.min(window.innerWidth, virtualCursorX));
    virtualCursorY = Math.max(0, Math.min(window.innerHeight, virtualCursorY));
  }

  // Instant visual update on GPU hardware-accelerated layer with pixel-perfect center alignment
  const newT = `translate3d(${virtualCursorX}px, ${virtualCursorY}px, 0) translate(-50%, -50%)`;
  if (cursor._lastT !== newT) {
    cursor.style.transform = newT;
    cursor._lastT = newT;
  }

  updateVirtualCursorVisibility();

  // Instant drag updates
  if (isVirtualMouseDown) {
    // 1. Dragging range sliders
    if (activeVirtualDragInput) {
      didVirtualDrag = true;
      updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
    }

    // 2. Dragging custom scrollbars
    if (activeVirtualCustomScrollbar) {
      didVirtualDrag = true;
      if (typeof window.updateCustomScrollbarFromPosition === "function") {
        window.updateCustomScrollbarFromPosition(virtualCursorY);
      }
    }

    // 3. Dragging inventory/action slots
    if (activeVirtualDragTarget) {
      const dist = Math.hypot(virtualCursorX - virtualMouseDownX, virtualCursorY - virtualMouseDownY);
      if (!isVirtualDraggingSlot && dist > 5) {
        const slotEl = activeVirtualDragTarget.closest("[draggable='true'], .inventory-slot, .action-slot, .chest-slot, .item-card");
        if (slotEl) {
          isVirtualDraggingSlot = true;
          didVirtualDrag = true;
          virtualDragSource = slotEl;
          virtualDataTransfer = new SyntheticDataTransfer();
          virtualDragGhost = createVirtualDragGhost(slotEl);

          isSyntheticEvent = true;
          const startEvt = new Event("dragstart", { bubbles: true, cancelable: true });
          startEvt.dataTransfer = virtualDataTransfer;
          startEvt.clientX = virtualCursorX;
          startEvt.clientY = virtualCursorY;
          slotEl.dispatchEvent(startEvt);
          if (typeof slotEl.ondragstart === "function") {
            try { slotEl.ondragstart(startEvt); } catch(err){}
          }
          isSyntheticEvent = false;
        }
      }

      if (isVirtualDraggingSlot && virtualDragSource && virtualDragGhost) {
        const ghostT = `translate3d(${virtualCursorX}px, ${virtualCursorY}px, 0) translate(-50%, -50%)`;
        if (virtualDragGhost._lastT !== ghostT) {
          virtualDragGhost.style.setProperty('transform', ghostT, 'important');
          virtualDragGhost._lastT = ghostT;
        }
      }
    }
  }

  // Schedule lightweight hover detection on next animation frame
  scheduleHoverUpdate(virtualCursorX, virtualCursorY);
}

window.addEventListener("mousemove", handleVirtualMouseMove, { capture: true, passive: true });
window.addEventListener("pointermove", handleVirtualMouseMove, { capture: true, passive: true });

let lastVirtualMouseUpTime = 0;

// Setup click listener for toggleControlsBtn if present
function setupToggleControlsBtnListener() {
  const toggleBtn = document.getElementById("toggleControlsBtn");
  if (toggleBtn && !toggleBtn.dataset.hasToggleListener) {
    toggleBtn.dataset.hasToggleListener = "true";
    toggleBtn.style.zIndex = "20";
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mainControls = document.getElementById("mainControls");
      if (!mainControls) return;
      const isHidden = mainControls.style.display === "none" || (window.getComputedStyle && window.getComputedStyle(mainControls).display === "none");
      if (isHidden) {
        mainControls.style.display = "flex";
        toggleBtn.textContent = "⚙️ ซ่อนเมนู";
      } else {
        mainControls.style.display = "none";
        toggleBtn.textContent = "⚙️ แสดงเมนู";
      }
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupToggleControlsBtnListener);
} else {
  setupToggleControlsBtnListener();
}

// Redirect mouse clicks/events to virtual cursor target when UI is open or locked
function redirectMouseEventToVirtualCursor(e) {
  if (isSyntheticEvent) return;

  const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
  const isTouch = window.devInputMode === "touch" || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || 
                  (window.devInputMode === "auto" && typeof isAndroidProfile !== "undefined" && isAndroidProfile);
  if (isTouch && !isDev) return;

  // Ensure toggleControlsBtn listener is active
  setupToggleControlsBtnListener();

  // Keep window focused for keyboard events
  if (window.focus) {
    try { window.focus(); } catch(err){}
  }

  // Allow simulated and synthetic events (from gamepad, touch buttons, or programmatic dispatch) to pass through untouched
  if (e.simulated || isSyntheticEvent || window.isGamepadTriggeringClick || (e.isTrusted === false && !e.fromVirtualCursor)) return;
  if (window.isGamepadUINavActive) return;

  const uiOpen = typeof isUIOpen === "function" ? isUIOpen() : false;
  if (window.isVirtualCursorManualHidden && !uiOpen) {
    if (e.target !== canvas) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    return;
  }
  const isLocked = !!document.pointerLockElement || simulatedPointerLock;
  if (!isLocked && !isUIOpen()) return;

  // Flush any pending hover update to ensure fresh state at moment of click
  if (hoverRafId !== null) {
    cancelAnimationFrame(hoverRafId);
    hoverRafId = null;
  }

  const targetEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
  if (!targetEl) return;

  const cursor = ensureCustomCursor();

  // Record virtual mouse down / up for dragging and slider manipulation
  if (e.type === "mousedown" || e.type === "pointerdown") {
    isVirtualMouseDown = true;
    virtualMouseDownX = virtualCursorX;
    virtualMouseDownY = virtualCursorY;
    activeVirtualDragTarget = targetEl;
    didVirtualDrag = false;

    if (cursor) cursor.classList.add("clicking");

    const rangeInput = (targetEl.tagName === "INPUT" && targetEl.type === "range") ? targetEl : targetEl.closest("input[type='range']");
    if (rangeInput) {
      activeVirtualDragInput = rangeInput;
      updateRangeInputFromVirtualCursor(rangeInput, virtualCursorX);
    } else {
      activeVirtualDragInput = null;
    }

    const scrollbarThumb = targetEl.closest(".custom-scrollbar-thumb, #panelCustomScrollbarThumb");
    const scrollbarTrack = targetEl.closest(".custom-scrollbar-track, #panelCustomScrollbar");
    if (scrollbarThumb || scrollbarTrack) {
      activeVirtualCustomScrollbar = scrollbarThumb || scrollbarTrack;
      if (typeof window.updateCustomScrollbarFromPosition === "function") {
        window.updateCustomScrollbarFromPosition(virtualCursorY);
      }
    } else {
      activeVirtualCustomScrollbar = null;
    }
  }

  const clickable = getInteractiveTarget(targetEl);
  const isTargetUI = targetEl !== canvas && targetEl !== document.body && targetEl !== document.documentElement;

  if (uiOpen || isTargetUI || clickable || activeVirtualDragInput) {
    // Only preventDefault on elements that are not text inputs
    const isTextInput = (targetEl.tagName === "INPUT" && (targetEl.type === "text" || targetEl.type === "number" || targetEl.type === "search" || targetEl.type === "password")) || targetEl.tagName === "TEXTAREA";
    if (targetEl.tagName !== "SELECT" && targetEl.tagName !== "OPTION" && !isTextInput) {
      e.preventDefault();
    }
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }

    if (didVirtualDrag && (e.type === "click" || e.type === "mouseup" || e.type === "pointerup")) {
      isVirtualMouseDown = false;
      activeVirtualDragTarget = null;
      didVirtualDrag = false;
      if (cursor) cursor.classList.remove("clicking");
      return;
    }

    isSyntheticEvent = true;
    try {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: e.detail || 1,
        clientX: virtualCursorX,
        clientY: virtualCursorY,
        screenX: virtualCursorX,
        screenY: virtualCursorY,
        button: e.button !== undefined ? e.button : 0,
        buttons: (e.type === "mouseup" || e.type === "pointerup") ? 0 : (e.buttons || 1),
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey
      };

      let syntheticEvent;
      if (e.type.startsWith("pointer") && typeof PointerEvent === "function") {
        syntheticEvent = new PointerEvent(e.type, {
          ...eventInit,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true
        });
      } else {
        syntheticEvent = new MouseEvent(e.type, eventInit);
      }

      targetEl.dispatchEvent(syntheticEvent);

      if (e.type === "mouseup" || e.type === "pointerup") {
        if (cursor) cursor.classList.remove("clicking");
        lastVirtualMouseUpTime = Date.now();
        if (activeVirtualDragInput) {
          updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
          activeVirtualDragInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          activeVirtualDragInput = null;
        }
        if (activeVirtualCustomScrollbar) {
          activeVirtualCustomScrollbar = null;
        }

        if (isVirtualDraggingSlot) {
          const dropTarget = document.elementFromPoint(virtualCursorX, virtualCursorY);
          if (dropTarget) {
            const dropEvt = new Event("drop", { bubbles: true, cancelable: true });
            dropEvt.dataTransfer = virtualDataTransfer;
            dropEvt.clientX = virtualCursorX;
            dropEvt.clientY = virtualCursorY;
            dropTarget.dispatchEvent(dropEvt);
            if (typeof dropTarget.ondrop === "function") {
              try { dropTarget.ondrop(dropEvt); } catch(err){}
            }
          }
          if (virtualDragSource) {
            const endEvt = new Event("dragend", { bubbles: true, cancelable: true });
            endEvt.dataTransfer = virtualDataTransfer;
            virtualDragSource.dispatchEvent(endEvt);
            if (typeof virtualDragSource.ondragend === "function") {
              try { virtualDragSource.ondragend(endEvt); } catch(err){}
            }
          }
          if (virtualDragGhost && virtualDragGhost.parentNode) {
            virtualDragGhost.parentNode.removeChild(virtualDragGhost);
          }
          virtualDragGhost = null;
          isVirtualDraggingSlot = false;
          virtualDragSource = null;
          virtualDataTransfer = null;
          virtualDragLastOver = null;
        }

        isVirtualMouseDown = false;
        activeVirtualDragTarget = null;
        didVirtualDrag = false;
      }

      if (e.type === "click") {
        didVirtualDrag = false;
        if (isTextInput) {
          try { targetEl.focus(); } catch(err){}
        } else {
          try { targetEl.blur(); } catch(err){}
        }

        // Toggle checkbox/radio if synthetic click didn't toggle native state
        if (targetEl.tagName === "INPUT" && (targetEl.type === "checkbox" || targetEl.type === "radio")) {
          if (!syntheticEvent.defaultPrevented) {
            if (targetEl.type === "checkbox") targetEl.checked = !targetEl.checked;
            else targetEl.checked = true;
            targetEl.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }
    } catch (err) {
      console.warn("Error dispatching virtual mouse event:", err);
    } finally {
      isSyntheticEvent = false;
    }
  } else {
    if (e.type === "mouseup" || e.type === "pointerup") {
      if (cursor) cursor.classList.remove("clicking");
      if (activeVirtualDragInput) {
        updateRangeInputFromVirtualCursor(activeVirtualDragInput, virtualCursorX);
        activeVirtualDragInput.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        activeVirtualDragInput = null;
      }
      isVirtualMouseDown = false;
      activeVirtualDragTarget = null;
      if (isVirtualDraggingSlot) {
        if (virtualDragGhost && virtualDragGhost.parentNode) {
          virtualDragGhost.parentNode.removeChild(virtualDragGhost);
        }
        virtualDragGhost = null;
        isVirtualDraggingSlot = false;
        virtualDragSource = null;
        virtualDataTransfer = null;
        virtualDragLastOver = null;
      }
      didVirtualDrag = false;
    }

    // Gameplay click on canvas: blur active element so keyboard inputs work
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== canvas) {
      if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        try { document.activeElement.blur(); } catch(err){}
      }
    }
  }
}

// Automatically blur focused buttons on keydown in gameplay so controls don't get trapped
window.addEventListener("keydown", (e) => {
  if (window.isWaitingForKey) return;
  if (!isUIOpen()) {
    if (document.activeElement && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      if (document.activeElement !== document.body) {
        try { document.activeElement.blur(); } catch(err){}
      }
    }
  }
}, true);

["mousedown", "mouseup", "click", "contextmenu", "pointerdown", "pointerup", "dblclick"].forEach(eventType => {
  window.addEventListener(eventType, redirectMouseEventToVirtualCursor, { capture: true });
});

window.addEventListener("mouseup", () => {
  isVirtualMouseDown = false;
  window.isCameraDragging = false;
  const cursor = document.getElementById("customGameCursor");
  if (cursor) cursor.classList.remove("clicking");
  updateVirtualCursorVisibility();
}, { capture: true, passive: true });

window.addEventListener("pointerup", () => {
  isVirtualMouseDown = false;
  window.isCameraDragging = false;
  const cursor = document.getElementById("customGameCursor");
  if (cursor) cursor.classList.remove("clicking");
  updateVirtualCursorVisibility();
}, { capture: true, passive: true });

// Scroll wheel handler for virtual cursor
window.addEventListener("wheel", (e) => {
  if (isSyntheticEvent) return;

  let targetEl = null;
  if (typeof virtualCursorX !== "undefined" && typeof virtualCursorY !== "undefined") {
    targetEl = document.elementFromPoint(virtualCursorX, virtualCursorY);
  }
  if (!targetEl) {
    targetEl = e.target;
  }

  function findScrollContainer(el) {
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr.classList && (curr.classList.contains("inventory-panel") || curr.classList.contains("settings-panel") || curr.classList.contains("custom-select-list"))) {
        return curr;
      }
      if (curr.scrollHeight > curr.clientHeight) {
        const overflowY = window.getComputedStyle(curr).overflowY;
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
          return curr;
        }
      }
      curr = curr.parentElement;
    }
    return null;
  }

  let scrollContainer = findScrollContainer(targetEl) || findScrollContainer(e.target);

  if (scrollContainer) {
    e.preventDefault();
    e.stopPropagation();
    scrollContainer.scrollTop += e.deltaY;
  } else if (!isUIOpen()) {
    // If no scrollable UI and in gameplay, switch hotbar action slot with mouse wheel
    if (typeof selectedActionSlotIndex !== "undefined" && typeof renderActionSlots === "function") {
      const delta = e.deltaY > 0 ? 1 : -1;
      let nextIdx = selectedActionSlotIndex + delta;
      if (nextIdx > 8) nextIdx = 0;
      if (nextIdx < 0) nextIdx = 8;
      selectedActionSlotIndex = nextIdx;
      renderActionSlots();
    }
  }
}, { capture: true, passive: false });

      // Disable context menu for game
      document.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("selectstart", (e) => e.preventDefault());

      // Prevent accidental browser hotkeys (like Ctrl+W, Ctrl+R, F5) and DevTools (F12, Ctrl+Shift+I) from interrupting the game
      window.addEventListener("keydown", (e) => {
        // Block F12
        if (e.key === "F12" || e.keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+I or Cmd+Option+I (Inspect element / DevTools)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.key === "i" || e.key === "I" || e.keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+J or Cmd+Option+J (DevTools Console)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.key === "j" || e.key === "J" || e.keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+C or Cmd+Option+C (Inspect element selection tool)
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey) && (e.key === "c" || e.key === "C" || e.keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+U or Cmd+U (View Source)
        if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U" || e.keyCode === 85)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+W or Cmd+W (close window)
        if ((e.ctrlKey || e.metaKey) && (e.key === "w" || e.key === "W")) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+R or Cmd+R (reload page)
        if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+Shift+R or Cmd+Shift+R (hard reload)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "r" || e.key === "R")) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block F5 (reload page)
        if (e.key === "F5" || e.keyCode === 116) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Ctrl+F5
        if ((e.ctrlKey || e.metaKey) && (e.key === "F5" || e.keyCode === 116)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Block Alt+Left Arrow / Alt+Right Arrow (browser history navigation)
        if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true); // Use capturing phase (true) to intercept before default actions or other handlers run


      // ============================================
      // Hash & Noise functions (Optimized 3D bitwise integer hash)
      // ============================================
      function hash3D(x, y, z, seed) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        let h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (Math.floor(seed) * 1597334677);
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2.0 - 1.0;
      }

      function smoothNoise(x, y, z, seed) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;

        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const sz = fz * fz * (3 - 2 * fz);

        const om_sx = 1 - sx;
        const om_sy = 1 - sy;
        const om_sz = 1 - sz;

        const s = (Math.floor(seed) * 1597334677) | 0;

        // Fast inlined 3D integer hash (zero trig, zero modulo)
        const getHash = (x0, y0, z0) => {
          let h = (x0 * 73856093) ^ (y0 * 19349663) ^ (z0 * 83492791) ^ s;
          h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
          h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
          return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2.0 - 1.0;
        };

        const h000 = getHash(ix, iy, iz);
        const h001 = getHash(ix, iy, iz + 1);
        const h010 = getHash(ix, iy + 1, iz);
        const h011 = getHash(ix, iy + 1, iz + 1);
        const h100 = getHash(ix + 1, iy, iz);
        const h101 = getHash(ix + 1, iy, iz + 1);
        const h110 = getHash(ix + 1, iy + 1, iz);
        const h111 = getHash(ix + 1, iy + 1, iz + 1);

        return h000 * (om_sx * om_sy * om_sz) +
               h001 * (om_sx * om_sy * sz) +
               h010 * (om_sx * sy * om_sz) +
               h011 * (om_sx * sy * sz) +
               h100 * (sx * om_sy * om_sz) +
               h101 * (sx * om_sy * sz) +
               h110 * (sx * sy * om_sz) +
               h111 * (sx * sy * sz);
      }

      function fbmNoise(x, y, z, seed, octaves = 5) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxVal = 0;
        for (let i = 0; i < octaves; i++) {
          value +=
            amplitude *
            smoothNoise(
              x * frequency,
              y * frequency,
              z * frequency,
              seed + i * 1000,
            );
          maxVal += amplitude;
          amplitude *= 0.5;
          frequency *= 2.1 + i * 0.1;
        }
        return value / maxVal;
      }

      let prngState = 12345;
      function mulberry32(a) {
        return function () {
          var t = (a += 0x6d2b79f5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      let customRandom = Math.random;


      // ============================================
      // เมทริกซ์
      // ============================================
      function createIdentity() {
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      }

      function createTranslation(x, y, z) {
        return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
      }

      function createScale(sx, sy, sz) {
        return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
      }
      if (typeof window !== "undefined") {
        window.createIdentity = createIdentity;
        window.createTranslation = createTranslation;
        window.createScale = createScale;
      }

      function multiplyMatrices(a, b) {
        const result = new Array(16);
        for (let col = 0; col < 4; col++) {
          for (let row = 0; row < 4; row++) {
            result[col * 4 + row] =
              a[0 * 4 + row] * b[col * 4 + 0] +
              a[1 * 4 + row] * b[col * 4 + 1] +
              a[2 * 4 + row] * b[col * 4 + 2] +
              a[3 * 4 + row] * b[col * 4 + 3];
          }
        }
        return result;
      }

      function createPerspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const nf = 1.0 / (near - far);
        return [
          f / aspect,
          0,
          0,
          0,
          0,
          f,
          0,
          0,
          0,
          0,
          (far + near) * nf,
          -1,
          0,
          0,
          2 * far * near * nf,
          0,
        ];
      }

      function createOrtho(left, right, bottom, top, near, far) {
        const lr = 1.0 / (left - right);
        const bt = 1.0 / (bottom - top);
        const nf = 1.0 / (near - far);
        return [
          -2.0 * lr,
          0,
          0,
          0,
          0,
          -2.0 * bt,
          0,
          0,
          0,
          0,
          2.0 * nf,
          0,
          (left + right) * lr,
          (top + bottom) * bt,
          (far + near) * nf,
          1,
        ];
      }

      function createLookAt(eye, target, up) {
        const [ex, ey, ez] = eye;
        const [tx, ty, tz] = target;
        const [ux, uy, uz] = up;

        const zx = ex - tx,
          zy = ey - ty,
          zz = ez - tz;
        const lenZ = Math.sqrt(zx * zx + zy * zy + zz * zz);
        const fzx = zx / lenZ,
          fzy = zy / lenZ,
          fzz = zz / lenZ;

        const xx = uy * fzz - uz * fzy;
        const xy = uz * fzx - ux * fzz;
        const xz = ux * fzy - uy * fzx;
        const lenX = Math.sqrt(xx * xx + xy * xy + xz * xz);
        const fxx = xx / lenX,
          fxy = xy / lenX,
          fxz = xz / lenX;

        const yx = fzy * fxz - fzz * fxy;
        const yy = fzz * fxx - fzx * fxz;
        const yz = fzx * fxy - fzy * fxx;

        return [
          fxx,
          yx,
          fzx,
          0,
          fxy,
          yy,
          fzy,
          0,
          fxz,
          yz,
          fzz,
          0,
          -(fxx * ex + fxy * ey + fxz * ez),
          -(yx * ex + yy * ey + yz * ez),
          -(fzx * ex + fzy * ey + fzz * ez),
          1,
        ];
      }

      // ============================================
      // ควบคุม
      // ============================================
      let isDragging = false;
      let prevX = 0,
        prevY = 0;
      let isDemolishModeEnabled = false;
      let isTerrainModModeEnabled = false;
      var rotationX = 0.5;
      var rotationY = 0.8;
      let smashInterval = null;

// Missing global declarations
var activeInteractNPC = null;
var activeTargetNPC = null;
var bowComboActive = false;
var cameraSpringArm = null;
var currentCampfires = [];
var keepLoadedTunnels = false;
var lastBowDrawPower = 0;
var lastBowShootTime = 0;
var playerControlsLocked = false;
var terrainMods = [];
var terrainRawVertices = [];
var tunnels3D = [];
var wasUsingBowBeforeSwimming = false;
var globalSeed = 0;

// === VIRTUAL CURSOR SELECT FIX ===
// Native <select> elements cannot be opened by synthetic clicks from the virtual cursor.
// We convert them into custom HTML dropdowns that work perfectly with virtual clicks.
function convertAllSelectsToCustomDropdowns() {
  document.querySelectorAll('select').forEach(selectElement => {
    if (selectElement.dataset.customized) return;
    selectElement.dataset.customized = "true";

    selectElement.style.display = 'none';

    const container = document.createElement('div');
    container.className = "custom-select-container game-ui";
    container.style.position = "relative";
    container.style.width = selectElement.style.width || "100%";
    container.style.marginTop = selectElement.style.marginTop || "0";
    container.style.marginBottom = selectElement.style.marginBottom || "0";
    
    const display = document.createElement('div');
    display.className = "custom-select-display clickable game-ui";
    display.style.cssText = selectElement.style.cssText;
    display.style.display = "flex";
    display.style.alignItems = "center";
    display.style.justifyContent = "space-between";
    display.style.cursor = "pointer";
    display.style.boxSizing = "border-box";
    display.style.userSelect = "none";
    
    const displayText = document.createElement('span');
    displayText.style.overflow = "hidden";
    displayText.style.textOverflow = "ellipsis";
    displayText.style.whiteSpace = "nowrap";

    const arrow = document.createElement('span');
    arrow.innerHTML = "▼";
    arrow.style.fontSize = "10px";
    arrow.style.marginLeft = "8px";
    
    display.appendChild(displayText);
    display.appendChild(arrow);
    
    const list = document.createElement('div');
    list.className = "custom-select-list game-ui";
    list.style.position = "absolute";
    list.style.top = "100%";
    list.style.left = "0";
    list.style.width = "100%";
    list.style.maxHeight = "200px";
    list.style.overflowY = "auto";
    list.style.background = "#1a1a1a";
    list.style.border = "1px solid #dfb76c";
    list.style.zIndex = "10050";
    list.style.display = "none";
    list.style.boxSizing = "border-box";
    list.style.boxShadow = "0 4px 12px rgba(0,0,0,0.8)";
    
    const updateDisplay = () => {
      const selectedOption = selectElement.options[selectElement.selectedIndex];
      if (selectedOption) {
        displayText.textContent = selectedOption.textContent;
      } else {
        displayText.textContent = "Select...";
      }
    };
    
    const populateList = () => {
      list.innerHTML = "";
      Array.from(selectElement.options).forEach((opt, index) => {
        const item = document.createElement('div');
        item.className = "custom-select-item clickable game-ui";
        item.textContent = opt.textContent;
        item.style.padding = "8px";
        item.style.cursor = "pointer";
        item.style.color = "#fff";
        item.style.borderBottom = "1px solid #333";
        item.style.fontSize = "12px";
        item.style.fontFamily = "'Google Sans', sans-serif";
        
        item.addEventListener("mouseenter", () => item.style.background = "rgba(223, 183, 108, 0.2)");
        item.addEventListener("mouseleave", () => item.style.background = "transparent");
        
        item.addEventListener("click", (e) => {
          selectElement.selectedIndex = index;
          selectElement.dispatchEvent(new Event("change", { bubbles: true }));
          updateDisplay();
          list.style.display = "none";
          e.stopPropagation();
        });
        
        list.appendChild(item);
      });
    };
    
    selectElement.addEventListener("change", updateDisplay);
    
    display.addEventListener("click", (e) => {
      populateList();
      const isOpen = list.style.display === "block";
      document.querySelectorAll(".custom-select-list").forEach(el => el.style.display = "none");
      if (!isOpen) {
        list.style.display = "block";
        list.scrollTop = 0;
      }
      e.stopPropagation();
    });
    
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        list.style.display = "none";
      }
    });

    const observer = new MutationObserver(() => {
      updateDisplay();
    });
    observer.observe(selectElement, { childList: true });

    container.appendChild(display);
    container.appendChild(list);
    
    selectElement.parentNode.insertBefore(container, selectElement.nextSibling);
    updateDisplay();
  });
}

document.addEventListener("DOMContentLoaded", convertAllSelectsToCustomDropdowns);
if (document.readyState === "complete" || document.readyState === "interactive") {
  convertAllSelectsToCustomDropdowns();
}
