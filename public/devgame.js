// === SEEDPLANET MODULE: JS/DEVTOOL.JS ===

// ============================================
// ระบบเครื่องมือพัฒนาเสกของ (Dev Tool Spawn Items) - Don't use LocalStorage
// ============================================
(function() {
  const listEl = document.getElementById("devSpawnItemList");
  if (listEl) {
    listEl.innerHTML = "";
    ALL_ITEMS.forEach(item => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "4px";
      
      const btn1 = document.createElement("button");
      btn1.className = "btn-random";
      btn1.style.flex = "1";
      btn1.style.margin = "0";
      btn1.style.padding = "4px";
      btn1.style.fontSize = "11px";
      btn1.style.backgroundImage = "linear-gradient(135deg, #e65100, #ff9800)";
      btn1.style.textAlign = "left";
      btn1.innerHTML = `${item.icon} ${item.name}`;
      
      const btn50 = document.createElement("button");
      btn50.className = "btn-random";
      btn50.style.flex = "0 0 40px";
      btn50.style.margin = "0";
      btn50.style.padding = "4px";
      btn50.style.fontSize = "11px";
      btn50.style.backgroundImage = "linear-gradient(135deg, #bf360c, #ff5722)";
      btn50.textContent = "x50";

      btn1.addEventListener("click", () => {
        if (!isDevMode) return;
        const added = addItemToInventory({ name: item.name, icon: item.icon, label: item.name }, false);
        if (added) {
          showNotice(`เสกสำเร็จ: ได้รับ ${item.icon} ${item.name} x1 !`);
        } else {
          showNotice("❌ กระเป๋าเต็มแล้ว! (Inventory is full)");
        }
      });

      btn50.addEventListener("click", () => {
        if (!isDevMode) return;
        let successCount = 0;
        for (let i = 0; i < 50; i++) {
          const added = addItemToInventory({ name: item.name, icon: item.icon, label: item.name }, false, false);
          if (added) {
            successCount++;
          } else {
            break;
          }
        }
        if (successCount > 0) {
          if (typeof renderInventory === "function") renderInventory();
          showNotice(`เสกสำเร็จ: ได้รับ ${item.icon} ${item.name} x${successCount} !`);
        } else {
          showNotice("❌ กระเป๋าเต็มแล้ว! (Inventory is full)");
        }
      });
      
      row.appendChild(btn1);
      row.appendChild(btn50);
      listEl.appendChild(row);
    });
  }
})();

function modTerrainAtPlayer(delta, bypassDevCheck = false, customTargetPoint = null, customR = null, mode = "normal") {
  if (!isDevMode && !bypassDevCheck) return;
  
  let x, y, z;
  if (customTargetPoint) {
      const len = Math.sqrt(customTargetPoint[0]**2 + customTargetPoint[1]**2 + customTargetPoint[2]**2);
      if (len > 0.001) {
          x = customTargetPoint[0] / len;
          y = customTargetPoint[1] / len;
          z = customTargetPoint[2] / len;
      } else {
          const sinT = Math.sin(charTheta);
          const cosT = Math.cos(charTheta);
          const sinP = Math.sin(charPhi);
          const cosP = Math.cos(charPhi);
          x = sinT * cosP;
          y = cosT;
          z = sinT * sinP;
      }
  } else {
      const sinT = Math.sin(charTheta);
      const cosT = Math.cos(charTheta);
      const sinP = Math.sin(charPhi);
      const cosP = Math.cos(charPhi);
      x = sinT * cosP;
      y = cosT;
      z = sinT * sinP;
  }
  
  if (mode === "trench" && delta < 0) {
      const targetTheta = Math.acos(y);
      const targetPhi = Math.atan2(z, x);
      const currentTargetHeight = getHeightOnSphere(targetTheta, targetPhi, globalSeed);
      const playerHeight = getHeightOnSphere(charTheta, charPhi, globalSeed);
      
      // We want the target terrain to match the player's ground level minus a tiny bit
      const hs = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6;
      const rad = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
      const desiredHeight = playerHeight - (0.02 / hs); 
      const neededDelta = desiredHeight - currentTargetHeight;
      
      // If the target is significantly higher than the player, we carve it down to the player's level
      if (neededDelta < 0) {
          delta = Math.max(neededDelta, -20.0);
      } else {
          // Otherwise, we perform a normal dig of -0.35 to continue expanding the hole
          delta = -0.35;
      }
  }
  
  // If digging (delta < 0), add a 3D tunnel sphere at the target
  if (delta < 0) {
      if (!tunnels3D) tunnels3D = [];
      
      let tx, ty, tz;
      if (customTargetPoint) {
          tx = customTargetPoint[0];
          ty = customTargetPoint[1];
          tz = customTargetPoint[2];
      } else {
          const currentFeetRadius = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) 
            ? (playerCenterRadius - 0.46 * playerScale) 
            : (rad + getHeightOnSphere(charTheta, charPhi, globalSeed) * hs);
          
          // Center the digging sphere slightly below player's feet so they dig downwards
          const tRadius = currentFeetRadius - 0.02;
          tx = x * tRadius;
          ty = y * tRadius;
          tz = z * tRadius;
      }
      
            // Prevent creating holes in the sky
      const tLen = Math.sqrt(tx*tx + ty*ty + tz*tz);
      if (tLen > 0.001) {
          const ux = tx / tLen;
          const uy = ty / tLen;
          const uz = tz / tLen;
          const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
          const phi = Math.atan2(uz, ux);
          const surfaceRadius = (typeof RADIUS !== 'undefined' ? RADIUS : 1.0) + (typeof getHeightOnSphere !== 'undefined' ? getHeightOnSphere(theta, phi, globalSeed) * HEIGHT_SCALE : 0);
          if (tLen > surfaceRadius + 0.05) {
              tx = ux * (surfaceRadius - 0.02);
              ty = uy * (surfaceRadius - 0.02);
              tz = uz * (surfaceRadius - 0.02);
          }
      }
      
      const tr = (customR !== null ? customR * 1.5 : 0.09) * voxelHoleRadiusMultiplier;
      
      let exists = false;
      for (let t of tunnels3D) {
          const dx = tx - t.x;
          const dy = ty - t.y;
          const dz = tz - t.z;
          if (dx*dx + dy*dy + dz*dz < 0.001) {
              exists = true;
              break;
          }
      }
      if (!exists) {
          tunnels3D.push({
              x: tx, y: ty, z: tz, r: tr, rSq: tr * tr
          });
          rebuildTunnelBuffers();

          // Play 3D Digging Sound ONLY when a new hole is actually carved into the terrain
          if (typeof playDigSound === "function") {
              playDigSound([tx, ty, tz]);
          } else if (typeof window !== "undefined" && typeof window.playDigSound === "function") {
              window.playDigSound([tx, ty, tz]);
          }
      }
  }

  // 1. Add to terrain mods so physics updates correctly, ONLY if delta >= 0 (building up)
  if (delta >= 0 && mode !== "trench") {
      if (!terrainMods) terrainMods = [];
      const r = customR !== null ? customR : 0.08;
      const rSq = r * r;
      terrainMods.push({
        x, y, z, r: r, rSq: rSq, delta: delta
      });
  }
  
  // 2. Invalidate terrain collision cache (ONLY if building/adding terrain)
  if (delta >= 0 && mode !== "trench") {
      if (typeof SurfaceSystem !== 'undefined' && SurfaceSystem.clearCache) {
        SurfaceSystem.clearCache();
      } else if (typeof terrainCacheValid !== 'undefined') {
        terrainCacheValid.fill(0);
      }
  }
  
  // 3. Update the mesh directly for real-time visualization without loading (ONLY if building/adding terrain)
  if (delta >= 0 && mode !== "trench" && terrainRawVertices && typeof vertexBuffer !== 'undefined') {
    const verts = terrainRawVertices;
    let changed = false;
    
    const r = customR !== null ? customR : 0.08;
    const rSq = r * r;
    
    for (let i = 0; i < verts.length; i += 3) {
        const vx = verts[i], vy = verts[i+1], vz = verts[i+2];
        if (vx === 0 && vy === 0 && vz === 0) continue;
        
        // compute length
        const len = Math.sqrt(vx*vx + vy*vy + vz*vz);
        if (len === 0) continue;
        
        // normalized dir
        const nx = vx / len;
        const ny = vy / len;
        const nz = vz / len;
        
        const dx = nx - x;
        const dy = ny - y;
        const dz = nz - z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < rSq) {
            const dist = Math.sqrt(distSq);
            const factor = 1.0 - (dist / r);
            const smoothFactor = factor * factor * (3 - 2 * factor);
            
            const newDist = len + (delta * smoothFactor * HEIGHT_SCALE);
            const scale = newDist / len;
            
            verts[i] = vx * scale;
            verts[i+1] = vy * scale;
            verts[i+2] = vz * scale;
            changed = true;
        }
    }
    
    if (changed) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
    }
  }
  
  // No need to close the inventory, let the user spam the button!
  // Just update the mesh!
  
  showNotice(delta < 0 ? "⛏️ ขุดสำเร็จ!" : "⛰️ ถมดินสำเร็จ!");
  
  // Play a sound effect if available
  if (typeof playSplashSound === 'function') {
     playSplashSound(0.5); // use splash as temp SFX
  }
}

const digBtn = document.getElementById("devDigTerrainBtn");
if (digBtn) {
  digBtn?.addEventListener("click", () => modTerrainAtPlayer(-0.35));
}

const raiseBtn = document.getElementById("devRaiseTerrainBtn");
if (raiseBtn) {
  raiseBtn?.addEventListener("click", () => modTerrainAtPlayer(0.35));
}

const classicModelBtn = document.getElementById("devCharModelClassicBtn");
if (classicModelBtn) {
  classicModelBtn.addEventListener("click", () => {
    if (typeof window.switchCharacterModel === "function") window.switchCharacterModel("classic");
  });
}

const chibiModelBtn = document.getElementById("devCharModelChibiBtn");
if (chibiModelBtn) {
  chibiModelBtn.addEventListener("click", () => {
    if (typeof window.switchCharacterModel === "function") window.switchCharacterModel("chibi");
  });
}

window.devForceAnimation = "Auto";
window.devAnimIsPlaying = true;
window.devAnimCurrentTime = 0.0;
window.devAnimStartTime = 0.0;
window.devAnimEndTime = 0.0;
window.devAnimDuration = 0.0;

// Animation Mixer State
window.devMixMode = false;
window.devMixLowerAnim = "Walking";
window.devMixUpperAnim = "01a090f8-8c8f-75dc-8693-155f9574dac7";
window.devMixUpperWeight = 1.0;

document.addEventListener("click", (e) => {
  if (e.target.id === "devAnimMixToggleBtn") {
    window.devMixMode = !window.devMixMode;
    const btn = document.getElementById("devAnimMixToggleBtn");
    const panel = document.getElementById("devAnimMixControls");
    if (window.devMixMode) {
      if (btn) {
        btn.innerText = "โหมดผสม: ON";
        btn.style.background = "#2e7d32";
        btn.style.border = "1px solid #4caf50";
        btn.style.color = "white";
      }
      if (panel) panel.style.display = "flex";
      if (typeof showNotice === "function") {
        showNotice("🎭 เปิดโหมดผสมอนิเมชั่น (Upper/Lower Mix)");
      }
    } else {
      if (btn) {
        btn.innerText = "โหมดผสม: OFF";
        btn.style.background = "#333";
        btn.style.border = "1px solid #555";
        btn.style.color = "#eee";
      }
      if (panel) panel.style.display = "none";
      if (typeof showNotice === "function") {
        showNotice("🎭 ปิดโหมดผสมอนิเมชั่น (กลับสู่ปกติ)");
      }
    }
    return;
  }

  if (e.target.classList && e.target.classList.contains("dev-anim-btn")) {
    window.devForceAnimation = e.target.getAttribute("data-anim");
    
    // Update button styles
    document.querySelectorAll(".dev-anim-btn").forEach(btn => {
      if (btn.getAttribute("data-anim") === window.devForceAnimation) {
        btn.style.background = "#2384c3";
        btn.style.border = "1px solid #3ba5e9";
      } else {
        btn.style.background = "#333";
        btn.style.border = "1px solid rgba(255,255,255,0.2)";
      }
    });

    const controls = document.getElementById("devAnimControls");
    const startInp = document.getElementById("devAnimStartInput");
    const endInp = document.getElementById("devAnimEndInput");
    const sldr = document.getElementById("devAnimScrubSlider");
    const lbl = document.getElementById("devAnimTimeLabel");
    
    if (window.devForceAnimation === "Auto") {
      if (controls) controls.style.display = "none";
    } else {
      if (controls) controls.style.display = "flex";
      if (window.chibiGlbModel && window.chibiGlbModel.animations) {
        const anim = window.chibiGlbModel.animations.find(a => a.name === window.devForceAnimation);
        if (anim) {
          window.devAnimDuration = anim.duration || 1.0;
          window.devAnimStartTime = 0.0;
          window.devAnimEndTime = window.devAnimDuration;
          window.devAnimCurrentTime = 0.0;
          window.devAnimIsPlaying = true;
          
          const playBtn = document.getElementById("devAnimPlayBtn");
          if (playBtn) playBtn.innerText = "⏸️ Pause";
          
          if (startInp) startInp.value = window.devAnimStartTime.toFixed(2);
          if (endInp) endInp.value = window.devAnimEndTime.toFixed(2);
          if (sldr) sldr.value = 0;
          
          const startSlider = document.getElementById("devAnimStartSlider");
          const endSlider = document.getElementById("devAnimEndSlider");
          if (startSlider) startSlider.value = 0;
          if (endSlider) endSlider.value = 1000;
          
          if (lbl) lbl.innerText = `0.00s / ${window.devAnimDuration.toFixed(2)}s`;
        }
      }
    }
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "devAnimSelect_deprecated") {
    window.devForceAnimation = e.target.value;
    const controls = document.getElementById("devAnimControls");
    const startInp = document.getElementById("devAnimStartInput");
    const endInp = document.getElementById("devAnimEndInput");
    const sldr = document.getElementById("devAnimScrubSlider");
    const lbl = document.getElementById("devAnimTimeLabel");
    
    if (window.devForceAnimation === "Auto") {
      if (controls) controls.style.display = "none";
    } else {
      if (controls) controls.style.display = "flex";
      if (window.chibiGlbModel && window.chibiGlbModel.animations) {
        const anim = window.chibiGlbModel.animations.find(a => a.name === window.devForceAnimation);
        if (anim) {
          window.devAnimDuration = anim.duration || 1.0;
          window.devAnimStartTime = 0.0;
          window.devAnimEndTime = window.devAnimDuration;
          window.devAnimCurrentTime = 0.0;
          
          if (startInp) startInp.value = window.devAnimStartTime.toFixed(2);
          if (endInp) endInp.value = window.devAnimEndTime.toFixed(2);
          if (sldr) sldr.value = 0;
          if (lbl) lbl.innerText = `0.00s / ${window.devAnimDuration.toFixed(2)}s`;
        }
      }
    }
  }
  
  if (e.target.id === "devAnimStartInput") {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val >= window.devAnimEndTime) val = window.devAnimEndTime - 0.01;
    window.devAnimStartTime = val;
    e.target.value = val.toFixed(2);
    if (window.devAnimCurrentTime < val) window.devAnimCurrentTime = val;
    
    const slider = document.getElementById("devAnimStartSlider");
    if (slider && window.devAnimDuration) slider.value = (val / window.devAnimDuration) * 1000;
  }
  
  if (e.target.id === "devAnimEndInput") {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val > window.devAnimDuration) val = window.devAnimDuration;
    if (val <= window.devAnimStartTime) val = window.devAnimStartTime + 0.01;
    window.devAnimEndTime = val;
    e.target.value = val.toFixed(2);
    if (window.devAnimCurrentTime > val) window.devAnimCurrentTime = val;
    
    const slider = document.getElementById("devAnimEndSlider");
    if (slider && window.devAnimDuration) slider.value = (val / window.devAnimDuration) * 1000;
  }
});

document.addEventListener("click", (e) => {
  if (e.target.id === "devAnimPlayBtn") {
    window.devAnimIsPlaying = !window.devAnimIsPlaying;
    e.target.innerText = window.devAnimIsPlaying ? "⏸️ Pause" : "▶️ Play";
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "devAnimScrubSlider") {
    window.devAnimIsPlaying = false;
    const playBtn = document.getElementById("devAnimPlayBtn");
    if (playBtn) playBtn.innerText = "▶️ Play";
    
    const progress = parseFloat(e.target.value) / 1000.0;
    window.devAnimCurrentTime = progress * window.devAnimDuration;
    
    const lbl = document.getElementById("devAnimTimeLabel");
    if (lbl) lbl.innerText = `${window.devAnimCurrentTime.toFixed(2)}s / ${window.devAnimDuration.toFixed(2)}s`;
  }
  else if (e.target.id === "devAnimStartSlider") {
    window.devAnimIsPlaying = false;
    const playBtn = document.getElementById("devAnimPlayBtn");
    if (playBtn) playBtn.innerText = "▶️ Play";

    const progress = parseFloat(e.target.value) / 1000.0;
    window.devAnimStartTime = progress * window.devAnimDuration;
    
    if (window.devAnimStartTime >= window.devAnimEndTime) {
      window.devAnimStartTime = window.devAnimEndTime - 0.01;
      e.target.value = (window.devAnimStartTime / window.devAnimDuration) * 1000.0;
    }
    
    const inp = document.getElementById("devAnimStartInput");
    if (inp) inp.value = window.devAnimStartTime.toFixed(2);
    
    window.devAnimCurrentTime = window.devAnimStartTime;
    const scrub = document.getElementById("devAnimScrubSlider");
    if (scrub) scrub.value = e.target.value;
  }
  else if (e.target.id === "devAnimEndSlider") {
    window.devAnimIsPlaying = false;
    const playBtn = document.getElementById("devAnimPlayBtn");
    if (playBtn) playBtn.innerText = "▶️ Play";

    const progress = parseFloat(e.target.value) / 1000.0;
    window.devAnimEndTime = progress * window.devAnimDuration;
    
    if (window.devAnimEndTime <= window.devAnimStartTime) {
      window.devAnimEndTime = window.devAnimStartTime + 0.01;
      e.target.value = (window.devAnimEndTime / window.devAnimDuration) * 1000.0;
    }
    
    const inp = document.getElementById("devAnimEndInput");
    if (inp) inp.value = window.devAnimEndTime.toFixed(2);
    
    window.devAnimCurrentTime = window.devAnimEndTime;
    const scrub = document.getElementById("devAnimScrubSlider");
    if (scrub) scrub.value = e.target.value;
  }
  else if (e.target.id === "devAnimMixWeightSlider") {
    const val = parseInt(e.target.value, 10);
    window.devMixUpperWeight = val / 100.0;
    const lbl = document.getElementById("devAnimMixWeightLabel");
    if (lbl) lbl.innerText = val + "%";
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "devAnimMixLowerSelect") {
    window.devMixLowerAnim = e.target.value;
    if (typeof showNotice === "function") {
      showNotice("🦵 เปลี่ยนท่าส่วนล่าง: " + e.target.options[e.target.selectedIndex].text);
    }
  }
  else if (e.target.id === "devAnimMixUpperSelect") {
    window.devMixUpperAnim = e.target.value;
    if (typeof showNotice === "function") {
      showNotice("💪 เปลี่ยนท่าส่วนบน: " + e.target.options[e.target.selectedIndex].text);
    }
  }
});

window.updateDevAnimationList = function() {
  try {
    const list = document.getElementById("devAnimList");
    if (!list) return;
    
    // Clear loader text if exists
    const loaderTxt = document.getElementById("devAnimListLoader");
    if (loaderTxt) loaderTxt.remove();
    
    // Check if we already populated (has more than just Auto and Loader)
    if (list.children.length > 2) return; 
    
    if (window.chibiGlbModel && window.chibiGlbModel.animations) {
      // Clear all and rebuild
      list.innerHTML = '';
      
      // Auto button
      const autoBtn = document.createElement("button");
      autoBtn.className = "dev-anim-btn";
      autoBtn.setAttribute("data-anim", "Auto");
      autoBtn.style.cssText = "width:100%; text-align:left; padding: 4px 6px; font-size: 11px; border-radius: 4px; border: 1px solid #3ba5e9; background: #2384c3; color: white; cursor: pointer;";
      autoBtn.innerText = "🤖 Auto (ตามการเดิน/วิ่ง)";
      list.appendChild(autoBtn);
      
      // Populate animations directly with GLB animation names
      window.chibiGlbModel.animations.forEach(a => {
        const btn = document.createElement("button");
        btn.className = "dev-anim-btn";
        btn.setAttribute("data-anim", a.name);
        btn.style.cssText = "width:100%; text-align:left; padding: 4px 6px; font-size: 11px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: #333; color: #fff; cursor: pointer;";
        btn.innerText = "🎬 " + a.name;
        list.appendChild(btn);
      });
      
      // Select current
      const currentVal = window.devForceAnimation || "Auto";
      document.querySelectorAll(".dev-anim-btn").forEach(btn => {
        if (btn.getAttribute("data-anim") === currentVal) {
          btn.style.background = "#2384c3";
          btn.style.border = "1px solid #3ba5e9";
        } else {
          btn.style.background = "#333";
          btn.style.border = "1px solid rgba(255,255,255,0.2)";
        }
      });
    }
  } catch (e) {
    console.error("Error updating anim list:", e);
  }
};


// Add a function to update UI button state
window.updateDevCharacterModelUI = function() {
  const cBtn = document.getElementById("devCharModelClassicBtn");
  const chBtn = document.getElementById("devCharModelChibiBtn");
  const animContainer = document.getElementById("devAnimContainer");
  const skeletonContainer = document.getElementById("devSkeletonContainer");
  if (cBtn && chBtn) {
    if (window.characterModel === "chibi") {
      chBtn.style.border = "2px solid white";
      cBtn.style.border = "none";
      if (animContainer) animContainer.style.display = "block";
      if (skeletonContainer) skeletonContainer.style.display = "block";
      if (typeof window.updateDevBonesAndParts === "function") {
        window.updateDevBonesAndParts();
      }
    } else {
      cBtn.style.border = "2px solid white";
      chBtn.style.border = "none";
      if (animContainer) animContainer.style.display = "none";
      if (skeletonContainer) skeletonContainer.style.display = "none";
    }
  }
};
// init UI immediately and on readiness
try {
  if (typeof window.updateDevCharacterModelUI === "function") {
    window.updateDevCharacterModelUI();
  }
} catch (e) {}

let _devCharUIInitCount = 0;
const _devCharUIInitTimer = setInterval(() => {
  _devCharUIInitCount++;
  if (typeof window.updateDevCharacterModelUI === "function") {
    window.updateDevCharacterModelUI();
  }
  if (_devCharUIInitCount > 10 || (document.getElementById("devSkeletonContainer") && window.chibiGlbModel)) {
    clearInterval(_devCharUIInitTimer);
  }
}, 300);

  const toggleControlsBtn = document.getElementById("toggleControlsBtn");
  const mainControls = document.getElementById("mainControls");
  let controlsVisible = true;
  
  
  if (toggleControlsBtn) {
    toggleControlsBtn.style.setProperty('top', 'auto', 'important');
    toggleControlsBtn.style.setProperty('right', '50%', 'important');
    toggleControlsBtn.style.setProperty('bottom', '20px', 'important');
    toggleControlsBtn.style.setProperty('transform', 'translateX(50%)', 'important');
    toggleControlsBtn.style.setProperty('z-index', '9999', 'important');
  }
  
  if (mainControls) {
    mainControls.style.setProperty('top', '50%', 'important');
    mainControls.style.setProperty('right', '50%', 'important');
    mainControls.style.setProperty('transform', 'translate(50%, -50%)', 'important');
    mainControls.style.setProperty('width', '90vw', 'important');
    mainControls.style.setProperty('max-width', 'calc(80vh * 16 / 9)', 'important');
    mainControls.style.setProperty('aspect-ratio', '16/9', 'important');
    mainControls.style.setProperty('height', 'auto', 'important');
    mainControls.style.setProperty('max-height', '90vh', 'important');
    mainControls.style.setProperty('overflow-y', 'auto', 'important');
    mainControls.style.setProperty('padding', '24px', 'important');
    mainControls.style.setProperty('box-sizing', 'border-box', 'important');
    mainControls.style.setProperty('background', 'rgba(10, 10, 15, 0.95)', 'important');
    mainControls.style.setProperty('border', '2px solid #dfb76c', 'important');
    mainControls.style.setProperty('border-radius', '12px', 'important');
    mainControls.style.setProperty('z-index', '9998', 'important');
    
    // CSS Grid layout for perfect responsive wrapping without empty spaces
    // Flex layout for perfect responsive wrapping without empty spaces
    mainControls.style.setProperty('display', 'flex', 'important');
    mainControls.style.setProperty('flex-direction', 'row', 'important');
    mainControls.style.setProperty('flex-wrap', 'wrap', 'important');
    mainControls.style.setProperty('gap', '16px', 'important');
    mainControls.style.setProperty('align-content', 'flex-start', 'important');
    mainControls.style.setProperty('align-items', 'flex-start', 'important');
    
    // Clean up grid properties
    mainControls.style.removeProperty('grid-template-columns');
    mainControls.style.removeProperty('grid-auto-rows');

    // Fix the distanceInfo empty box issue by moving it into the distanceToggle group
    const distanceToggle = document.getElementById("distanceToggle");
    const distanceInfo = document.getElementById("distanceInfo");
    if (distanceToggle && distanceInfo) {
      const toggleGroup = distanceToggle.closest('.control-group');
      const infoGroup = distanceInfo.closest('.control-group');
      if (toggleGroup && infoGroup && toggleGroup !== infoGroup) {
        toggleGroup.appendChild(distanceInfo);
        infoGroup.remove(); // Completely remove the empty group
      }
    }

    // Inject CSS to fix control group sizes
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      #mainControls .control-group {
        width: 240px !important;
        flex: 1 1 240px !important;
        max-width: calc(25% - 12px) !important; /* Max 4 per row */
        height: 320px !important; /* Fixed height for uniformity */
        overflow-y: auto;
        box-sizing: border-box;
        margin: 0 !important;
        padding: 16px !important;
      }
      /* Hide any genuinely empty control groups */
      #mainControls .control-group:empty {
        display: none !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    // Add a close button specifically for this new layout
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "❌ ปิด";
    closeBtn.style.cssText = "position: absolute; top: 10px; right: 10px; background: #333; border: 1px solid #555; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; z-index: 10000;";
    closeBtn.addEventListener("click", () => {
      controlsVisible = false;
      mainControls.style.display = "none";
      toggleControlsBtn.textContent = "⚙️ แสดงเมนู";
    });
    mainControls.appendChild(closeBtn);
  }
if (toggleControlsBtn && mainControls) {
    toggleControlsBtn?.addEventListener("click", () => {
      controlsVisible = !controlsVisible;
      if (controlsVisible) {
        mainControls.style.display = "flex";
        toggleControlsBtn.textContent = "⚙️ ซ่อนเมนู";
        if (typeof window.updateDevCharacterModelUI === "function") {
          window.updateDevCharacterModelUI();
        }
      } else {
        mainControls.style.display = "none";
        toggleControlsBtn.textContent = "⚙️ แสดงเมนู";
      }
    });
  }

// --- ระบบย้ายกล้องไปหา NPC (Teleport to NPC) ---
(function initDevNpcTeleport() {
  const updateNpcList = () => {
    const listEl = document.getElementById("devNpcList");
    if (!listEl) return;
    if (typeof amphibians === 'undefined' || !Array.isArray(amphibians)) {
      listEl.innerHTML = "<div style='color:#ccc; font-size:11px; padding:4px;'>กำลังโหลด NPC...</div>";
      return;
    }
    
    let aliveCount = 0;
    amphibians.forEach(npc => {
      if (npc.hp === undefined || npc.hp > 0) aliveCount++;
    });

    listEl.innerHTML = "";
    
    if (amphibians.length === 0 || aliveCount === 0) {
      listEl.innerHTML = "<div style='color:#ccc; font-size:11px; padding:4px;'>ไม่มี NPC ในขณะนี้</div>";
      return;
    }
    
    amphibians.forEach((npc, index) => {
      if (npc.hp !== undefined && npc.hp <= 0) return;
      
      const btn = document.createElement("button");
      btn.className = "btn-random";
      btn.style.width = "100%";
      btn.style.margin = "0";
      btn.style.padding = "4px";
      btn.style.fontSize = "11px";
      btn.style.backgroundImage = "linear-gradient(135deg, #0288d1, #29b6f6)";
      btn.style.textAlign = "left";
      btn.style.display = "block";
      
      const icon = npc.type === 'human' ? '👨' : (npc.type === 'meganeura' ? '🪰' : (npc.type === 'obsidian_cube' ? '🔶' : '🦎'));
      btn.innerHTML = `${icon} ${npc.type} #${index} 🚀`;
      
      btn.addEventListener("click", () => {
        let targetTheta = npc.theta;
        let targetPhi = npc.phi;

        // Extract exact coordinates if NPC has a 3D position vector
        const pos = (npc.ragdollEnabled && npc.ragdollPos && Array.isArray(npc.ragdollPos))
          ? npc.ragdollPos
          : (npc.position || null);

        if (pos && Array.isArray(pos) && pos.length >= 3) {
          const x = pos[0], y = pos[1], z = pos[2];
          const r = Math.sqrt(x * x + y * y + z * z);
          if (r > 0.001) {
            targetTheta = Math.acos(Math.max(-1.0, Math.min(1.0, y / r)));
            targetPhi = Math.atan2(z, x);
          }
        }

        if (typeof targetTheta === 'number' && !isNaN(targetTheta)) charTheta = targetTheta;
        if (typeof targetPhi === 'number' && !isNaN(targetPhi)) charPhi = targetPhi;

        if (typeof playerCenterRadius !== 'undefined') playerCenterRadius = null;
        if (typeof playerVelocityX !== 'undefined') playerVelocityX = 0;
        if (typeof playerVelocityY !== 'undefined') playerVelocityY = 0;
        if (typeof playerVelocityZ !== 'undefined') playerVelocityZ = 0;

        if (typeof showNotice === "function") {
          showNotice(`🚀 วาร์ปไปหา ${npc.type} #${index} เรียบร้อย!`);
        } else if (typeof showNotification === "function") {
          showNotification(`🚀 วาร์ปไปหา ${npc.type} #${index} เรียบร้อย!`);
        }
      });
      
      listEl.appendChild(btn);
    });
  };

  window.updateDevNpcList = updateNpcList;

  // Update periodically
  setInterval(() => {
    const listEl = document.getElementById("devNpcList");
    if (listEl && typeof amphibians !== 'undefined') {
      let aliveCount = 0;
      amphibians.forEach(npc => {
        if (npc.hp === undefined || npc.hp > 0) aliveCount++;
      });
      if (listEl.children.length !== aliveCount && !(listEl.children.length === 1 && aliveCount === 0)) {
        updateNpcList();
      }
    }
  }, 2000);
  
  setTimeout(updateNpcList, 1000);
  setTimeout(updateNpcList, 3000);
})();

// --- ระบบปรับระยะห่าง Clouds3D จากดาว (Clouds3D Distance System) ---
(function initDevCloud3DDistance() {
  const sliderEl = document.getElementById("devCloud3DDistanceSlider");
  const labelEl = document.getElementById("devCloud3DDistanceLabel");
  
  if (!sliderEl) return;

  function updateCloudDistance(val) {
    const dist = val / 100;
    if (labelEl) labelEl.textContent = dist.toFixed(2);
    
    // Sync with main cloudsHeight slider & label if exists
    const mainSlider = document.getElementById("cloudsHeight");
    const mainLabel = document.getElementById("cloudsHeightLabel");
    if (mainSlider && mainSlider.value != val) mainSlider.value = val;
    if (mainLabel) mainLabel.textContent = dist.toFixed(2);
    
    if (typeof window.rebuildClouds3D === "function") {
      window.rebuildClouds3D(dist);
    } else if (typeof window.generateClouds3D === "function") {
      if (typeof cloudsHeight !== "undefined") cloudsHeight = dist;
      const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof globalSeed !== "undefined" ? globalSeed : 12345);
      const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
      window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, dist);
      if (typeof window.resetCloud3DBuffers === "function") {
        window.resetCloud3DBuffers();
      }
    }
  }

  sliderEl?.addEventListener("input", (e) => {
    updateCloudDistance(parseInt(e.target.value, 10));
  });
})();

// --- ระบบปรับความเร็วอนิเมชั่น และการเคลื่อนที่ของ Clouds3D ---
(function initDevCloud3DSpeedControls() {
  if (typeof window.cloud3DAnimSpeed !== "number") window.cloud3DAnimSpeed = 0.1;
  if (typeof window.cloud3DOrbitSpeed !== "number") window.cloud3DOrbitSpeed = 0.1;

  const animSlider = document.getElementById("devCloud3DAnimSpeedSlider");
  const animLabel = document.getElementById("devCloud3DAnimSpeedLabel");
  const orbitSlider = document.getElementById("devCloud3DOrbitSpeedSlider");
  const orbitLabel = document.getElementById("devCloud3DOrbitSpeedLabel");

  if (animSlider) {
    animSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.cloud3DAnimSpeed = val;
      if (animLabel) animLabel.textContent = val.toFixed(2);
    });
  }

  if (orbitSlider) {
    orbitSlider?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.cloud3DOrbitSpeed = val;
      if (orbitLabel) orbitLabel.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับระยะที่นั่งตัวละครในหุ่น (Mech Seat Offset System) ---
(function initDevMechSeatOffset() {
  if (typeof window.mechSeatOffset !== "number") window.mechSeatOffset = 0.71;

  const slider = document.getElementById("devMechSeatHeightSlider");
  const label = document.getElementById("devMechSeatHeightLabel");

  if (slider) {
    slider.value = Math.round(window.mechSeatOffset * 100);
    if (label) label.textContent = window.mechSeatOffset.toFixed(2);

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.mechSeatOffset = val;
      if (label) label.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับระยะกล้องขับหุ่น (Mech Camera Distance System) ---
(function initDevMechCameraDistance() {
  if (typeof window.mechCameraDistance !== "number") window.mechCameraDistance = 0.5;

  const slider = document.getElementById("devMechCameraDistSlider");
  const label = document.getElementById("devMechCameraDistLabel");

  if (slider) {
    slider.value = Math.round(window.mechCameraDistance * 100);
    if (label) label.textContent = window.mechCameraDistance.toFixed(2);

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.mechCameraDistance = val;
      if (label) label.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับระยะกล้องขับเรือ (Boat Camera Distance System) ---
(function initDevBoatCameraDistance() {
  if (typeof window.boatCameraDistance !== "number") window.boatCameraDistance = 0.37;

  const slider = document.getElementById("devBoatCameraDistSlider");
  const label = document.getElementById("devBoatCameraDistLabel");

  if (slider) {
    slider.value = Math.round(window.boatCameraDistance * 100);
    if (label) label.textContent = window.boatCameraDistance.toFixed(2);

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      window.boatCameraDistance = val;
      if (label) label.textContent = val.toFixed(2);
    });
  }
})();

// --- ระบบปรับความยาวเพาล้อและตำแหน่งล้อเรือ แยกคู่หน้า-หลัง (Front/Rear Wheel Pair Controls) ---
(function initDevWheelAxleControls() {
  if (typeof window.wheelScaleMultiplier !== "number") window.wheelScaleMultiplier = 0.56;

  if (typeof window.electricEngineScaleMultiplier !== "number") window.electricEngineScaleMultiplier = 0.36;
  if (typeof window.electricEngineFwdOffset !== "number") window.electricEngineFwdOffset = -0.11;
  if (typeof window.electricEngineUpOffset !== "number") window.electricEngineUpOffset = 0.05;
  if (typeof window.electricEnginePitch !== "number") window.electricEnginePitch = 0.0;
  if (typeof window.electricEngineYaw !== "number") window.electricEngineYaw = 1.5708;
  if (typeof window.electricEngineRoll !== "number") window.electricEngineRoll = 0.0;

  if (typeof window.wheelFrontAxleLength !== "number") window.wheelFrontAxleLength = 0.28;
  if (typeof window.wheelFrontSideOffset !== "number") window.wheelFrontSideOffset = 0.14;
  if (typeof window.wheelFrontFwdOffset !== "number") window.wheelFrontFwdOffset = 0.16;
  if (typeof window.wheelFrontUpOffset !== "number") window.wheelFrontUpOffset = 0.01;

  if (typeof window.wheelRearAxleLength !== "number") window.wheelRearAxleLength = 0.28;
  if (typeof window.wheelRearSideOffset !== "number") window.wheelRearSideOffset = 0.14;
  if (typeof window.wheelRearFwdOffset !== "number") window.wheelRearFwdOffset = 0.16;
  if (typeof window.wheelRearUpOffset !== "number") window.wheelRearUpOffset = 0.01;

  function bindSlider(sliderId, labelId, getVal, setVal, isUpOffset = false) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider) return;

    if (isUpOffset) {
      slider.value = Math.round((getVal() + 0.5) * 100);
    } else {
      slider.value = Math.round(getVal() * 100);
    }
    if (label) label.textContent = getVal().toFixed(2);

    slider.addEventListener("input", (e) => {
      let val;
      if (isUpOffset) {
        val = (parseInt(e.target.value, 10) / 100) - 0.5;
      } else {
        val = parseInt(e.target.value, 10) / 100;
      }
      setVal(val);
      if (label) label.textContent = val.toFixed(2);
    });
  }

  // Scale
  bindSlider("devWheelScaleSlider", "devWheelScaleLabel", () => window.wheelScaleMultiplier, v => window.wheelScaleMultiplier = v);

  // Electric Engine
  bindSlider("devElectricEngineScaleSlider", "devElectricEngineScaleLabel", () => window.electricEngineScaleMultiplier, v => window.electricEngineScaleMultiplier = v);
  bindSlider("devElectricEngineFwdOffsetSlider", "devElectricEngineFwdOffsetLabel", () => window.electricEngineFwdOffset, v => window.electricEngineFwdOffset = v, true);
  bindSlider("devElectricEngineUpOffsetSlider", "devElectricEngineUpOffsetLabel", () => window.electricEngineUpOffset, v => window.electricEngineUpOffset = v, true);
  bindSlider("devElectricEnginePitchSlider", "devElectricEnginePitchLabel", () => window.electricEnginePitch, v => window.electricEnginePitch = v);
  bindSlider("devElectricEngineYawSlider", "devElectricEngineYawLabel", () => window.electricEngineYaw, v => window.electricEngineYaw = v);
  bindSlider("devElectricEngineRollSlider", "devElectricEngineRollLabel", () => window.electricEngineRoll, v => window.electricEngineRoll = v);

  // Front Pair
  bindSlider("devWheelFrontAxleLengthSlider", "devWheelFrontAxleLengthLabel", () => window.wheelFrontAxleLength, v => window.wheelFrontAxleLength = v);
  bindSlider("devWheelFrontSideOffsetSlider", "devWheelFrontSideOffsetLabel", () => window.wheelFrontSideOffset, v => window.wheelFrontSideOffset = v);
  bindSlider("devWheelFrontFwdOffsetSlider", "devWheelFrontFwdOffsetLabel", () => window.wheelFrontFwdOffset, v => window.wheelFrontFwdOffset = v);
  bindSlider("devWheelFrontUpOffsetSlider", "devWheelFrontUpOffsetLabel", () => window.wheelFrontUpOffset, v => window.wheelFrontUpOffset = v, true);

  // Rear Pair
  bindSlider("devWheelRearAxleLengthSlider", "devWheelRearAxleLengthLabel", () => window.wheelRearAxleLength, v => window.wheelRearAxleLength = v);
  bindSlider("devWheelRearSideOffsetSlider", "devWheelRearSideOffsetLabel", () => window.wheelRearSideOffset, v => window.wheelRearSideOffset = v);
  bindSlider("devWheelRearFwdOffsetSlider", "devWheelRearFwdOffsetLabel", () => window.wheelRearFwdOffset, v => window.wheelRearFwdOffset = v);
  bindSlider("devWheelRearUpOffsetSlider", "devWheelRearUpOffsetLabel", () => window.wheelRearUpOffset, v => window.wheelRearUpOffset = v, true);
})();

// --- ระบบปรับแต่งช่วงเสียงล้อไม้ (Wooden Wheel Sound Trim & Loop Controller) ---
(function initDevWheelSoundControl() {
  if (typeof window.woodenWheelSoundLoopStart === "undefined") window.woodenWheelSoundLoopStart = 0.88;
  if (typeof window.woodenWheelSoundLoopEnd === "undefined") window.woodenWheelSoundLoopEnd = 1.12;

  function mountGroup() {
    const mainControls = document.getElementById("mainControls");
    if (!mainControls) return false;
    if (document.getElementById("devWheelSoundControlGroup")) return true;

    const group = document.createElement("div");
    group.className = "control-group";
    group.id = "devWheelSoundControlGroup";
    group.style.border = "1.5px solid #ffca28";
    group.style.borderRadius = "8px";
    group.style.background = "rgba(22, 20, 15, 0.95)";
    group.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
    group.style.padding = "10px";

    group.innerHTML = `
      <div style="font-weight: bold; color: #ffca28; font-size: 13px; margin-bottom: 6px;">
        🔊 ปรับช่วงเสียงล้อไม้ (Wheel Sound Loop)
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #dfb76c; margin-bottom: 8px; background: rgba(0,0,0,0.4); padding: 5px 8px; border-radius: 4px; border: 1px solid rgba(223, 183, 108, 0.2);">
        <span>ความยาวไฟล์เสียงทั้งหมด:</span>
        <span id="devWheelSoundTotalDurationLabel" style="font-weight: bold; color: #ffffff;">-- s</span>
      </div>

      <!-- สไลเดอร์ช่วงเริ่มเสียง (หน้า) -->
      <div style="margin-top: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #eee;">
          <span>▶ ช่วงเริ่มเสียง (Start Time / Loop Start):</span>
          <span style="font-weight: bold; color: #81c784;"><span id="devWheelSoundStartLabel">0.88</span>s</span>
        </div>
        <input type="range" id="devWheelSoundStartSlider" min="0" max="861" value="88" style="width: 100%; margin-top: 3px; cursor: pointer;" />
      </div>

      <!-- สไลเดอร์ช่วงท้ายเสียง (หลัง) -->
      <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #eee;">
          <span>⏹ ช่วงท้ายเสียง (End Time / Loop End):</span>
          <span style="font-weight: bold; color: #ffb74d;"><span id="devWheelSoundEndLabel">1.12</span>s</span>
        </div>
        <input type="range" id="devWheelSoundEndSlider" min="0" max="861" value="112" style="width: 100%; margin-top: 3px; cursor: pointer;" />
      </div>

      <!-- แถบแสดงช่วงการเล่นวนลูป (Visual Range Bar) -->
      <div style="margin-top: 10px; background: rgba(0,0,0,0.6); border-radius: 4px; height: 12px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.15);">
        <div id="devWheelSoundVisualBar" style="position: absolute; top: 0; left: 0%; width: 100%; height: 100%; background: linear-gradient(90deg, #43a047, #fbc02d); opacity: 0.85; border-radius: 3px; transition: left 0.05s, width 0.05s;"></div>
      </div>

      <!-- ปุ่มทดสอบและปุ่มรีเซ็ต -->
      <div style="display: flex; gap: 6px; margin-top: 12px; align-items: stretch;">
        <button id="devWheelSoundTestBtn" class="btn-random" style="flex: 1; margin: 0; padding: 7px 6px; font-size: 11px; font-weight: bold; color: #fff; background-image: linear-gradient(135deg, #2e7d32, #4caf50); border-radius: 5px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer; line-height: 1.3; text-align: center;">
          ▶ ทดลองฟังเสียงล้อ (Preview)
        </button>
        <button id="devWheelSoundResetBtn" class="btn-random" style="flex: 0 0 65px; margin: 0; padding: 7px 4px; font-size: 11px; color: #fff; background-image: linear-gradient(135deg, #424242, #616161); border-radius: 5px; cursor: pointer; line-height: 1.3; text-align: center;">
          🔄 รีเซ็ต
        </button>
      </div>
    `;

    mainControls.appendChild(group);

    const startSlider = group.querySelector("#devWheelSoundStartSlider");
    const startLabel = group.querySelector("#devWheelSoundStartLabel");
    const endSlider = group.querySelector("#devWheelSoundEndSlider");
    const endLabel = group.querySelector("#devWheelSoundEndLabel");
    const durLabel = group.querySelector("#devWheelSoundTotalDurationLabel");
    const visualBar = group.querySelector("#devWheelSoundVisualBar");
    const testBtn = group.querySelector("#devWheelSoundTestBtn");
    const resetBtn = group.querySelector("#devWheelSoundResetBtn");

    const updateVisualBar = (start, end, dur) => {
      if (!visualBar || !dur || dur <= 0) return;
      const leftPercent = Math.max(0, Math.min(100, (start / dur) * 100));
      const widthPercent = Math.max(0, Math.min(100 - leftPercent, ((end - start) / dur) * 100));
      visualBar.style.left = leftPercent.toFixed(1) + "%";
      visualBar.style.width = widthPercent.toFixed(1) + "%";
    };

    const syncBufferDuration = (dur) => {
      if (!dur || isNaN(dur) || dur <= 0) return;
      window.woodenWheelSoundBufferDuration = dur;
      if (durLabel) durLabel.textContent = dur.toFixed(2) + " s";
      
      const maxVal = Math.ceil(dur * 100);
      if (startSlider) {
        startSlider.max = maxVal;
        const curStart = (typeof window.woodenWheelSoundLoopStart === "number") ? window.woodenWheelSoundLoopStart : 0.88;
        startSlider.value = Math.round(curStart * 100);
      }
      if (endSlider) {
        endSlider.max = maxVal;
        const curEnd = (typeof window.woodenWheelSoundLoopEnd === "number") ? window.woodenWheelSoundLoopEnd : Math.min(1.12, dur);
        endSlider.value = Math.round(curEnd * 100);
      }
      const actualStart = (typeof window.woodenWheelSoundLoopStart === "number") ? window.woodenWheelSoundLoopStart : 0.88;
      const actualEnd = (typeof window.woodenWheelSoundLoopEnd === "number") ? window.woodenWheelSoundLoopEnd : Math.min(1.12, dur);
      if (startLabel) startLabel.textContent = actualStart.toFixed(2);
      if (endLabel) endLabel.textContent = actualEnd.toFixed(2);
      updateVisualBar(actualStart, actualEnd, dur);
    };

    const tryLoadAudioInfo = async () => {
      try {
        if (typeof window.getWoodenWheelsAudioBuffer === "function") {
          const ctx = (typeof audioCtx !== "undefined" && audioCtx) || (typeof window !== "undefined" && (window.audioCtx || window.audioContext)) || new (window.AudioContext || window.webkitAudioContext)();
          const buf = await window.getWoodenWheelsAudioBuffer(ctx);
          if (buf) syncBufferDuration(buf.duration);
        }
      } catch(e) {}
    };
    tryLoadAudioInfo();

    if (startSlider) {
      startSlider.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10) / 100;
        const dur = window.woodenWheelSoundBufferDuration || 8.61;
        const endVal = endSlider ? (parseInt(endSlider.value, 10) / 100) : dur;
        if (val >= endVal) {
          val = Math.max(0, endVal - 0.05);
          startSlider.value = Math.round(val * 100);
        }
        window.woodenWheelSoundLoopStart = val;
        if (startLabel) startLabel.textContent = val.toFixed(2);
        updateVisualBar(val, endVal, dur);
      });
    }

    if (endSlider) {
      endSlider.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10) / 100;
        const dur = window.woodenWheelSoundBufferDuration || 8.61;
        const startVal = startSlider ? (parseInt(startSlider.value, 10) / 100) : 0;
        if (val <= startVal) {
          val = startVal + 0.05;
          endSlider.value = Math.round(val * 100);
        }
        window.woodenWheelSoundLoopEnd = val;
        if (endLabel) endLabel.textContent = val.toFixed(2);
        updateVisualBar(startVal, val, dur);
      });
    }

    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        await tryLoadAudioInfo();
        if (typeof window.previewWoodenWheelSound === "function") {
          if (window.isPreviewWoodenWheelSoundActive && window.isPreviewWoodenWheelSoundActive()) {
            window.stopPreviewWoodenWheelSound();
            testBtn.innerHTML = "▶ ทดลองฟังเสียงล้อ (Preview)";
            testBtn.style.backgroundImage = "linear-gradient(135deg, #2e7d32, #4caf50)";
          } else {
            const started = await window.previewWoodenWheelSound(true);
            if (started) {
              testBtn.innerHTML = "⏹ หยุดเสียงทดลอง (Stop)";
              testBtn.style.backgroundImage = "linear-gradient(135deg, #c62828, #e53935)";
            }
          }
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const dur = window.woodenWheelSoundBufferDuration || 8.61;
        window.woodenWheelSoundLoopStart = 0.88;
        window.woodenWheelSoundLoopEnd = Math.min(1.12, dur);
        if (startSlider) startSlider.value = 669;
        if (endSlider) endSlider.value = Math.round(Math.min(7.48, dur) * 100);
        if (startLabel) startLabel.textContent = "6.69";
        if (endLabel) endLabel.textContent = Math.min(7.48, dur).toFixed(2);
        updateVisualBar(6.69, Math.min(7.48, dur), dur);
        if (typeof showNotice === "function") showNotice("รีเซ็ตช่วงเสียงล้อไม้เป็น 0.88s - 1.12s แล้ว");
      });
    }

    return true;
  }

  // Try immediate mount or listen for DOM load
  if (!mountGroup()) {
    window.addEventListener("DOMContentLoaded", mountGroup);
    setTimeout(mountGroup, 500);
    setTimeout(mountGroup, 1500);
  }
})();

// --- ระบบปิด/เปิดการสร้าง NPCs และ Environment (Generation Toggles) ---
(function initDevGenerationToggles() {
  const npcBtn = document.getElementById("devToggleNpcBtn");
  const envBtn = document.getElementById("devToggleEnvBtn");

  if (typeof window.DISABLE_NPCS === "undefined") window.DISABLE_NPCS = false;
  if (typeof window.DISABLE_ENVIRONMENT === "undefined") window.DISABLE_ENVIRONMENT = false;

  const updateNpcBtnState = () => {
    if (npcBtn) {
      if (window.DISABLE_NPCS) {
        npcBtn.textContent = "🤖 NPCs: OFF";
        npcBtn.style.backgroundImage = "linear-gradient(135deg, #757575, #9e9e9e)";
      } else {
        npcBtn.textContent = "🤖 NPCs: ON";
        npcBtn.style.backgroundImage = "linear-gradient(135deg, #0288d1, #29b6f6)";
      }
    }
  };

  const updateEnvBtnState = () => {
    if (envBtn) {
      if (window.DISABLE_ENVIRONMENT) {
        envBtn.textContent = "🌲 Env: OFF";
        envBtn.style.backgroundImage = "linear-gradient(135deg, #757575, #9e9e9e)";
      } else {
        envBtn.textContent = "🌲 Env: ON";
        envBtn.style.backgroundImage = "linear-gradient(135deg, #43a047, #66bb6a)";
      }
    }
  };

  updateNpcBtnState();
  updateEnvBtnState();

  if (npcBtn) {
    npcBtn.addEventListener("click", () => {
      window.DISABLE_NPCS = !window.DISABLE_NPCS;
      updateNpcBtnState();
      if (typeof showNotice === "function") {
        showNotice(window.DISABLE_NPCS ? "❌ ปิดการสร้าง NPCs (รอเปลี่ยนดาว)" : "✅ เปิดการสร้าง NPCs (รอเปลี่ยนดาว)");
      }
    });
  }

  if (envBtn) {
    envBtn.addEventListener("click", () => {
      window.DISABLE_ENVIRONMENT = !window.DISABLE_ENVIRONMENT;
      updateEnvBtnState();
      if (typeof showNotice === "function") {
        showNotice(window.DISABLE_ENVIRONMENT ? "❌ ปิดการสร้าง Env (รอเปลี่ยนดาว)" : "✅ เปิดการสร้าง Env (รอเปลี่ยนดาว)");
      }
    });
  }
})();

// --- ระบบควบคุมระยะเรนเดอร์แยก 2 ระยะ: 1. พื้น (Terrain: 15.0) 2. วัตถุทุกชนิด (Objects: 5.0) ---
(function initDevSplitRenderDistance() {
  if (typeof window.terrainRenderDistValue !== "number") window.terrainRenderDistValue = 15.0;
  if (typeof window.objectRenderDistValue !== "number") window.objectRenderDistValue = 5.0;
  if (typeof window.renderDistValue !== "number") window.renderDistValue = 15.0;
  if (typeof window.renderDistEnabled !== "boolean") window.renderDistEnabled = true;

  window.setTerrainRenderDist = function(val) {
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return;
    window.terrainRenderDistValue = num;
    if (typeof terrainRenderDistValue !== "undefined") {
      terrainRenderDistValue = num;
    }
    
    // Sync main input & label
    const mainInput = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
    const mainLabel = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
    if (mainInput && Math.round(parseFloat(mainInput.value)) !== Math.round(num * 10)) {
      mainInput.value = Math.round(num * 10);
    }
    if (mainLabel) mainLabel.textContent = num.toFixed(2);

    // Sync dev input & label
    const devInput = document.getElementById("devTerrainRenderDistSlider");
    const devLabel = document.getElementById("devTerrainRenderDistLabel");
    if (devInput && Math.round(parseFloat(devInput.value)) !== Math.round(num * 10)) {
      devInput.value = Math.round(num * 10);
    }
    if (devLabel) devLabel.textContent = num.toFixed(2);
  };

  window.setObjectRenderDist = function(val) {
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num)) return;
    window.objectRenderDistValue = num;
    if (typeof objectRenderDistValue !== "undefined") {
      objectRenderDistValue = num;
    }
    
    // Sync main input & label
    const mainInput = document.getElementById("objectRenderDist");
    const mainLabel = document.getElementById("objectRenderDistLabel");
    if (mainInput && Math.round(parseFloat(mainInput.value)) !== Math.round(num * 10)) {
      mainInput.value = Math.round(num * 10);
    }
    if (mainLabel) mainLabel.textContent = num.toFixed(2);

    // Sync dev input & label
    const devInput = document.getElementById("devObjectRenderDistSlider");
    const devLabel = document.getElementById("devObjectRenderDistLabel");
    if (devInput && Math.round(parseFloat(devInput.value)) !== Math.round(num * 10)) {
      devInput.value = Math.round(num * 10);
    }
    if (devLabel) devLabel.textContent = num.toFixed(2);
  };

  const devTerrainSlider = document.getElementById("devTerrainRenderDistSlider");
  const devObjectSlider = document.getElementById("devObjectRenderDistSlider");

  if (devTerrainSlider) {
    devTerrainSlider.value = Math.round(window.terrainRenderDistValue * 10);
    devTerrainSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 10;
      window.setTerrainRenderDist(val);
    });
  }

  if (devObjectSlider) {
    devObjectSlider.value = Math.round(window.objectRenderDistValue * 10);
    devObjectSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) / 10;
      window.setObjectRenderDist(val);
    });
  }
})();

// --- ระบบกล้องตัวละครมุมมองที่ 3 และกล้องฟรี (3rd-Person Camera & FreeCam Controller) ---
(function initDevFreeCameraController() {
  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devFreeCamControlGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devFreeCamControlGroup";
  group.innerHTML = `
    <label>🎥 โหมดกล้องตัวละคร & กล้องฟรี (Camera & FreeCam)</label>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
      <!-- ปุ่มเปิด/ปิด กล้องฟรี (Free Camera) ขนาดใหญ่ -->
      <button id="devToggleFreeCamBtn" class="btn-random" style="background-image: linear-gradient(135deg, #1565c0, #1e88e5); margin: 0; padding: 10px 8px; font-size: 13px; text-align: center; font-weight: bold; color: #fff; cursor: pointer; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">
        🚁 เปิดโหมดกล้องฟรี (FreeCam)
      </button>

      <!-- ปุ่มสลับโหมดกล้องตัวละคร 3 มุมมอง -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px;">
        <button id="devCamThirdPersonBtn" class="btn-random" style="background-image: linear-gradient(135deg, #2e7d32, #43a047); margin: 0; padding: 6px 2px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          มุมมองที่ 3
        </button>
        <button id="devCamTPSBtn" class="btn-random" style="background-image: linear-gradient(135deg, #00695c, #00897b); margin: 0; padding: 6px 2px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          TPS ข้างไหล่
        </button>
        <button id="devCamFPSBtn" class="btn-random" style="background-image: linear-gradient(135deg, #37474f, #546e7a); margin: 0; padding: 6px 2px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          FPS ที่ 1
        </button>
      </div>

      <!-- ปุ่มฟังก์ชันเสริมกล้องฟรี -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
        <button id="devTeleportFreeCamBtn" class="btn-random" style="background-image: linear-gradient(135deg, #e65100, #f57c00); margin: 0; padding: 6px 4px; font-size: 10px; text-align: center; font-weight: bold; color: #fff;">
          📍 วาร์ปกล้องหาผู้เล่น
        </button>
        <button id="devResetCamAngleBtn" class="btn-random" style="background-image: linear-gradient(135deg, #424242, #616161); margin: 0; padding: 6px 4px; font-size: 10px; text-align: center; color: #fff;">
          🔄 รีเซ็ตมุมมอง
        </button>
      </div>

      <!-- ปุ่มสลับกล้องไปหา Satellite Sun -->
      <button id="devCamToSunBtn" class="btn-random" style="background-image: linear-gradient(135deg, #ff6f00, #ff8f00); margin: 0; padding: 8px 4px; font-size: 11px; text-align: center; font-weight: bold; color: #fff;">
        ☀️ สลับกล้องไปหา Satellite Sun
      </button>

      <!-- สไลเดอร์ปรับความเร็วการบินของกล้องฟรี -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #bbb;">
          <span>🚀 ความเร็วบินกล้องฟรี (Speed):</span>
          <span id="devFreeCamSpeedLabel">15.0 m/s</span>
        </div>
        <input type="range" id="devFreeCamSpeedSlider" min="1" max="100" step="1" value="15" style="width: 100%; cursor: pointer;" />
      </div>

      <!-- คำแนะนำการควบคุมและสถานะพิกัด -->
      <div id="devFreeCamInfoBox" style="font-size: 10px; color: #90caf9; line-height: 1.4; background: rgba(0,0,0,0.4); padding: 7px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
        <div>🎮 <b>วิธีบังคับกล้องฟรี:</b></div>
        <div style="color: #e0e0e0; font-size: 9.5px; margin-top: 2px;">
          • <b>W/A/S/D</b> : บินเคลื่อนที่ 4 ทิศทาง<br/>
          • <b>Q / E (หรือ Space)</b> : บินลด / เพิ่มระดับความสูง<br/>
          • <b>Shift</b> : บินเร่งความเร็ว x3<br/>
          • <b>ลากเมาส์</b> : หมุนหันมุมมองรอบทิศทาง 360°<br/>
          • <b>ล้อเมาส์</b> : ปรับความเร็วการบินแบบสด
        </div>
        <div id="devFreeCamPosText" style="margin-top: 4px; font-weight: bold; color: #80cbc4; font-size: 9.5px;">
          สถานะ: มุมมองที่ 3 (Third Person)
        </div>
      </div>
    </div>
  `;
  mainControls.appendChild(group);

  // Element References
  const toggleBtn = group.querySelector("#devToggleFreeCamBtn");
  const tpsBtn = group.querySelector("#devCamTPSBtn");
  const thirdPersonBtn = group.querySelector("#devCamThirdPersonBtn");
  const fpsBtn = group.querySelector("#devCamFPSBtn");
  const teleportBtn = group.querySelector("#devTeleportFreeCamBtn");
  const resetBtn = group.querySelector("#devResetCamAngleBtn");
  const speedSlider = group.querySelector("#devFreeCamSpeedSlider");
  const speedLabel = group.querySelector("#devFreeCamSpeedLabel");
  const posText = group.querySelector("#devFreeCamPosText");

  function updateCamUI() {
    const mode = window.cameraMode || (typeof cameraMode !== "undefined" ? cameraMode : "thirdperson");
    const isFree = (mode === "freecam");

    if (toggleBtn) {
      if (isFree) {
        toggleBtn.textContent = "🟢 ปิดกล้องฟรี (กลับสู่มุมมองตัวละคร)";
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #c62828, #e53935)";
      } else {
        toggleBtn.textContent = "🚁 เปิดโหมดกล้องฟรี (FreeCam)";
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #1565c0, #1e88e5)";
      }
    }

    if (speedSlider && typeof window.freeCamSpeed === "number") {
      speedSlider.value = Math.round(window.freeCamSpeed);
      if (speedLabel) speedLabel.textContent = `${window.freeCamSpeed.toFixed(1)} m/s`;
    }

    if (posText) {
      if (isFree && window.freeCamPos) {
        posText.innerHTML = `🚁 กล้องฟรี: [X: ${window.freeCamPos[0].toFixed(1)}, Y: ${window.freeCamPos[1].toFixed(1)}, Z: ${window.freeCamPos[2].toFixed(1)}]`;
        posText.style.color = "#80cbc4";
      } else {
        let label = "มุมมองที่ 3 (ตรงกลาง)";
        if (mode === "tps") label = "TPS (ข้างไหล่)";
        else if (mode === "fps") label = "FPS (บุคคลที่ 1)";
        else if (mode === "sun") label = "☀️ Satellite Sun (ดวงอาทิตย์)";
        posText.innerHTML = `📷 โหมดปัจจุบัน: <b>${label}</b>`;
        posText.style.color = mode === "sun" ? "#ffd54f" : "#90caf9";
      }
    }
  }

  // Event Listeners
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (typeof window.toggleFreeCamera === "function") {
        window.toggleFreeCamera();
      } else {
        const cur = window.cameraMode || "thirdperson";
        window.setCameraMode(cur === "freecam" ? "thirdperson" : "freecam");
      }
      updateCamUI();
    });
  }

  if (thirdPersonBtn) {
    thirdPersonBtn.addEventListener("click", () => {
      if (typeof window.setCameraMode === "function") window.setCameraMode("thirdperson");
      updateCamUI();
    });
  }

  if (tpsBtn) {
    tpsBtn.addEventListener("click", () => {
      if (typeof window.setCameraMode === "function") window.setCameraMode("tps");
      updateCamUI();
    });
  }

  if (fpsBtn) {
    fpsBtn.addEventListener("click", () => {
      if (typeof window.setCameraMode === "function") window.setCameraMode("fps");
      updateCamUI();
    });
  }

  const camToSunBtn = group.querySelector("#devCamToSunBtn");
  if (camToSunBtn) {
    camToSunBtn.addEventListener("click", () => {
      // สลับเป็นโหมดกล้องดาวส่อง Satellite Sun (ใช้ macroPosition [0, 0, 0] จาก SpacesMap)
      if (typeof window.setCameraMode === "function") {
        window.setCameraMode("sun");
      } else {
        window.cameraMode = "sun";
        if (window.cameraSpringArm) window.cameraSpringArm.setMode("sun");
      }

      if (typeof showNotice === "function") {
        showNotice("☀️ สลับกล้องจับ Satellite Sun (พิกัดจำลอง macroPosition: [0, 0, 0]) เรียบร้อยแล้ว");
      }
      updateCamUI();
    });
  }

  if (teleportBtn) {
    teleportBtn.addEventListener("click", () => {
      if (typeof window.teleportFreeCamToPlayer === "function") {
        window.teleportFreeCamToPlayer();
      }
      updateCamUI();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (window.cameraMode === "freecam") {
        if (typeof rotationY === "number") window.freeCamYaw = rotationY;
        if (typeof rotationX === "number") window.freeCamPitch = rotationX;
      } else {
        if (typeof rotationX !== "undefined") rotationX = 0.2;
      }
      if (typeof showNotice === "function") showNotice("🔄 รีเซ็ตมุมมองกล้องแล้ว");
      updateCamUI();
    });
  }

  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      window.freeCamSpeed = val;
      if (speedLabel) speedLabel.textContent = `${val.toFixed(1)} m/s`;
    });
  }

  // Update real-time loop for status text
  setInterval(() => {
    if (group.offsetParent !== null) {
      updateCamUI();
    }
  }, 400);
})();

// --- ระบบสลับดาวเคราะห์ (SpacesMap Active Planet Switcher) ---
(function initDevPlanetSwitcher() {
  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devPlanetSwitchGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devPlanetSwitchGroup";
  group.innerHTML = `
    <label>🪐 ระบบสลับดาวเคราะห์ (SpacesMap Planet Switcher)</label>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
      <!-- สถานะดาวปัจจุบัน -->
      <div id="devActivePlanetBanner" style="font-size: 11px; padding: 6px 8px; background: rgba(0, 20, 40, 0.7); border: 1px solid rgba(0, 200, 255, 0.4); border-radius: 4px; color: #80d8ff;">
        ดาวปัจจุบัน: <b id="devActivePlanetName">🌱 ดาวแม่พันธุ์พืชหลัก (Genesis)</b>
      </div>

      <!-- ปุ่มสลับดาว 1 - 5 -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <button id="devSwitchPlanet1" class="btn-random" style="background-image: linear-gradient(135deg, #1b5e20, #2e7d32); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌱 ดาว 1 (Genesis)
        </button>
        <button id="devSwitchPlanet2" class="btn-random" style="background-image: linear-gradient(135deg, #01579b, #0288d1); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌊 ดาว 2 (Oceania)
        </button>
        <button id="devSwitchPlanet3" class="btn-random" style="background-image: linear-gradient(135deg, #33691e, #558b2f); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌲 ดาว 3 (Verdant)
        </button>
        <button id="devSwitchPlanet4" class="btn-random" style="background-image: linear-gradient(135deg, #880e4f, #ad1457); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
          🌸 ดาว 4 (Botanical)
        </button>
      </div>

      <button id="devSwitchPlanet5" class="btn-random" style="background-image: linear-gradient(135deg, #e65100, #f57c00); margin: 0; padding: 7px 4px; font-size: 11px; font-weight: bold; color: #fff; text-align: center;">
        ⚡ ดาว 5 (Bio-Flux)
      </button>

      <div style="font-size: 10px; color: #90a4ae; line-height: 1.4;">
        ℹ️ <i>เมื่อสลับดาว SpacesMap จะสร้างผิวดาวดวงใหม่มาวางที่ [0, 0, 0] เพื่อให้ระบบฟิสิกส์และการเดินทำงานได้อย่างสมบูรณ์</i>
      </div>
    </div>
  `;

  mainControls.appendChild(group);

  const bannerName = group.querySelector("#devActivePlanetName");

  function updateActiveUI() {
    if (window.SpacesMap && bannerName) {
      const active = window.SpacesMap.getActivePlanet();
      if (active) {
        bannerName.textContent = active.name;
      }
    }
  }

  function handleSwitch(id) {
    if (window.SpacesMap && typeof window.SpacesMap.switchActivePlanet === "function") {
      window.SpacesMap.switchActivePlanet(id);
      updateActiveUI();
    }
  }

  const p1Btn = group.querySelector("#devSwitchPlanet1");
  const p2Btn = group.querySelector("#devSwitchPlanet2");
  const p3Btn = group.querySelector("#devSwitchPlanet3");
  const p4Btn = group.querySelector("#devSwitchPlanet4");
  const p5Btn = group.querySelector("#devSwitchPlanet5");

  if (p1Btn) p1Btn.addEventListener("click", () => handleSwitch("planet_1"));
  if (p2Btn) p2Btn.addEventListener("click", () => handleSwitch("planet_2"));
  if (p3Btn) p3Btn.addEventListener("click", () => handleSwitch("planet_3"));
  if (p4Btn) p4Btn.addEventListener("click", () => handleSwitch("planet_4"));
  if (p5Btn) p5Btn.addEventListener("click", () => handleSwitch("planet_5"));

  setInterval(() => {
    if (group.offsetParent !== null) {
      updateActiveUI();
    }
  }, 800);
})();



// --- ระบบปรับตำแหน่งและสเกล UI ลอยของเรือ (Boat UI Offset & Scale System) ---
(function initDevBoatUiOffset() {
  if (typeof window.boatUiBackOffset !== "number") window.boatUiBackOffset = 2.47;
  if (typeof window.boatUiUpOffset !== "number") window.boatUiUpOffset = 0.43;
  if (typeof window.boatUiRightOffset !== "number") window.boatUiRightOffset = 0.0;
  if (typeof window.boatUiYawOffset !== "number") window.boatUiYawOffset = 0.0;
  if (typeof window.boatUiPitchOffset !== "number") window.boatUiPitchOffset = -22.0;
  if (typeof window.boatUiScale !== "number") window.boatUiScale = 0.47;

  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devBoatUiOffsetGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devBoatUiOffsetGroup";
  group.innerHTML = `
    <label>🚤 ระยะห่าง & สเกล UI เรือ (Boat UI Settings)</label>
    
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">ย่อ/ขยายสเกล UI (Scale):</label>
            <span id="devBoatUiScaleLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.boatUiScale * 100)}%</span>
        </div>
        <input type="range" id="devBoatUiScaleSlider" min="20" max="300" value="${Math.round(window.boatUiScale * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนไปด้านหลัง (Back):</label>
            <span id="devBoatUiBackLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.boatUiBackOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devBoatUiBackSlider" min="-200" max="500" value="${Math.round(window.boatUiBackOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนขึ้น/ลง (Up):</label>
            <span id="devBoatUiUpLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.boatUiUpOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devBoatUiUpSlider" min="-200" max="500" value="${Math.round(window.boatUiUpOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนซ้าย/ขวา (Right):</label>
            <span id="devBoatUiRightLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.boatUiRightOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devBoatUiRightSlider" min="-500" max="500" value="${Math.round(window.boatUiRightOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนซ้าย/ขวา (Yaw):</label>
            <span id="devBoatUiYawLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.boatUiYawOffset)}°</span>
        </div>
        <input type="range" id="devBoatUiYawSlider" min="-180" max="180" value="${Math.round(window.boatUiYawOffset)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนขึ้น/ลง (Pitch):</label>
            <span id="devBoatUiPitchLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.boatUiPitchOffset)}°</span>
        </div>
        <input type="range" id="devBoatUiPitchSlider" min="-180" max="180" value="${Math.round(window.boatUiPitchOffset)}" style="width: 100%;">
    </div>

    <div style="margin-top: 10px; text-align: right;">
        <button id="devBoatUiResetBtn" style="font-size: 11px; padding: 4px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(223, 183, 108, 0.4); border-radius: 4px; color: #dfb76c; cursor: pointer;">↺ รีเซ็ตค่าเริ่มต้น (Reset)</button>
    </div>
  `;
  mainControls.appendChild(group);

  const scaleSlider = document.getElementById("devBoatUiScaleSlider");
  const scaleLabel = document.getElementById("devBoatUiScaleLabel");
  const backSlider = document.getElementById("devBoatUiBackSlider");
  const backLabel = document.getElementById("devBoatUiBackLabel");
  const upSlider = document.getElementById("devBoatUiUpSlider");
  const upLabel = document.getElementById("devBoatUiUpLabel");
  const rightSlider = document.getElementById("devBoatUiRightSlider");
  const rightLabel = document.getElementById("devBoatUiRightLabel");
  const yawSlider = document.getElementById("devBoatUiYawSlider");
  const yawLabel = document.getElementById("devBoatUiYawLabel");
  const pitchSlider = document.getElementById("devBoatUiPitchSlider");
  const pitchLabel = document.getElementById("devBoatUiPitchLabel");
  const resetBtn = document.getElementById("devBoatUiResetBtn");

  if (scaleSlider) {
    scaleSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.boatUiScale = val;
      if (scaleLabel) scaleLabel.textContent = `${pct}%`;
    });
  }
  if (backSlider) {
    backSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.boatUiBackOffset = val;
      if (backLabel) backLabel.textContent = `${val.toFixed(2)}`;
    });
  }
  if (upSlider) {
    upSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.boatUiUpOffset = val;
      if (upLabel) upLabel.textContent = `${val.toFixed(2)}`;
    });
  }
  if (rightSlider) {
    rightSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.boatUiRightOffset = val;
      if (rightLabel) rightLabel.textContent = `${val.toFixed(2)}`;
    });
  }
  if (yawSlider) {
    yawSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      window.boatUiYawOffset = val;
      if (yawLabel) yawLabel.textContent = `${val}°`;
    });
  }
  if (pitchSlider) {
    pitchSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      window.boatUiPitchOffset = val;
      if (pitchLabel) pitchLabel.textContent = `${val}°`;
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      window.boatUiScale = 0.47;
      window.boatUiBackOffset = 2.47;
      window.boatUiUpOffset = 0.43;
      window.boatUiRightOffset = 0.0;
      window.boatUiYawOffset = 0.0;
      window.boatUiPitchOffset = -22.0;

      if (scaleSlider) scaleSlider.value = "47";
      if (scaleLabel) scaleLabel.textContent = "47%";
      if (backSlider) backSlider.value = "247";
      if (backLabel) backLabel.textContent = "2.47";
      if (upSlider) upSlider.value = "43";
      if (upLabel) upLabel.textContent = "0.43";
      if (rightSlider) rightSlider.value = "0";
      if (rightLabel) rightLabel.textContent = "0.00";
      if (yawSlider) yawSlider.value = "0";
      if (yawLabel) yawLabel.textContent = "0°";
      if (pitchSlider) pitchSlider.value = "-22";
      if (pitchLabel) pitchLabel.textContent = "-22°";
    });
  }
})();

// --- ระบบปรับตำแหน่งและสเกล UI ลอยของฐานตั้งหุ่น (Mech Stand UI Offset & Scale System) ---
(function initDevMechStandUiOffset() {
  if (typeof window.mechStandUiUpOffset !== "number") window.mechStandUiUpOffset = 0.16;
  if (typeof window.mechStandUiRightOffset !== "number") window.mechStandUiRightOffset = 0.0;
  if (typeof window.mechStandUiForwardOffset !== "number") window.mechStandUiForwardOffset = 0.22;
  if (typeof window.mechStandUiYawOffset !== "number") window.mechStandUiYawOffset = 180.0;
  if (typeof window.mechStandUiPitchOffset !== "number") window.mechStandUiPitchOffset = 0.0;
  if (typeof window.mechStandUiScale !== "number") window.mechStandUiScale = 0.34;

  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devMechStandUiOffsetGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devMechStandUiOffsetGroup";
  group.innerHTML = `
    <label>🏗️ ระยะห่าง & สเกล UI ฐานตั้งหุ่น (Mech Stand UI 3D Settings)</label>
    
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">ย่อ/ขยายสเกล UI (Scale):</label>
            <span id="devMechStandUiScaleLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.mechStandUiScale * 100)}%</span>
        </div>
        <input type="range" id="devMechStandUiScaleSlider" min="20" max="300" value="${Math.round(window.mechStandUiScale * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนขึ้น/ลง (Up/Down):</label>
            <span id="devMechStandUiUpLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.mechStandUiUpOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechStandUiUpSlider" min="-200" max="500" value="${Math.round(window.mechStandUiUpOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนซ้าย/ขวา (Right/Left):</label>
            <span id="devMechStandUiRightLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.mechStandUiRightOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechStandUiRightSlider" min="-300" max="300" value="${Math.round(window.mechStandUiRightOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนหน้า/หลัง (Forward/Back):</label>
            <span id="devMechStandUiForwardLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.mechStandUiForwardOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechStandUiForwardSlider" min="-300" max="300" value="${Math.round(window.mechStandUiForwardOffset * 100)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนซ้าย/ขวา องศา (Yaw):</label>
            <span id="devMechStandUiYawLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.mechStandUiYawOffset)}°</span>
        </div>
        <input type="range" id="devMechStandUiYawSlider" min="-180" max="180" value="${Math.round(window.mechStandUiYawOffset)}" style="width: 100%;">
    </div>

    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">ก้ม/เงย องศา (Pitch):</label>
            <span id="devMechStandUiPitchLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.mechStandUiPitchOffset)}°</span>
        </div>
        <input type="range" id="devMechStandUiPitchSlider" min="-180" max="180" value="${Math.round(window.mechStandUiPitchOffset)}" style="width: 100%;">
    </div>

    <div style="margin-top: 10px; text-align: right;">
        <button id="devMechStandUiResetBtn" style="font-size: 11px; padding: 4px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(223, 183, 108, 0.4); border-radius: 4px; color: #dfb76c; cursor: pointer;">↺ รีเซ็ตค่าเริ่มต้น (Reset)</button>
    </div>
  `;
  mainControls.appendChild(group);

  const scaleSlider = document.getElementById("devMechStandUiScaleSlider");
  const scaleLabel = document.getElementById("devMechStandUiScaleLabel");
  const upSlider = document.getElementById("devMechStandUiUpSlider");
  const upLabel = document.getElementById("devMechStandUiUpLabel");
  const rightSlider = document.getElementById("devMechStandUiRightSlider");
  const rightLabel = document.getElementById("devMechStandUiRightLabel");
  const forwardSlider = document.getElementById("devMechStandUiForwardSlider");
  const forwardLabel = document.getElementById("devMechStandUiForwardLabel");
  const yawSlider = document.getElementById("devMechStandUiYawSlider");
  const yawLabel = document.getElementById("devMechStandUiYawLabel");
  const pitchSlider = document.getElementById("devMechStandUiPitchSlider");
  const pitchLabel = document.getElementById("devMechStandUiPitchLabel");
  const resetBtn = document.getElementById("devMechStandUiResetBtn");

  if (scaleSlider) {
    scaleSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.mechStandUiScale = val;
      if (scaleLabel) scaleLabel.textContent = `${pct}%`;
    });
  }
  if (upSlider) {
    upSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.mechStandUiUpOffset = val;
      if (upLabel) upLabel.textContent = `${val.toFixed(2)}`;
    });
  }
  if (rightSlider) {
    rightSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.mechStandUiRightOffset = val;
      if (rightLabel) rightLabel.textContent = `${val.toFixed(2)}`;
    });
  }
  if (forwardSlider) {
    forwardSlider.addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      const val = pct / 100;
      window.mechStandUiForwardOffset = val;
      if (forwardLabel) forwardLabel.textContent = `${val.toFixed(2)}`;
    });
  }
  if (yawSlider) {
    yawSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      window.mechStandUiYawOffset = val;
      if (yawLabel) yawLabel.textContent = `${Math.round(val)}°`;
    });
  }
  if (pitchSlider) {
    pitchSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      window.mechStandUiPitchOffset = val;
      if (pitchLabel) pitchLabel.textContent = `${Math.round(val)}°`;
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      window.mechStandUiScale = 0.34;
      window.mechStandUiUpOffset = 0.16;
      window.mechStandUiRightOffset = 0.0;
      window.mechStandUiForwardOffset = 0.22;
      window.mechStandUiYawOffset = 180.0;
      window.mechStandUiPitchOffset = 0.0;

      if (scaleSlider) scaleSlider.value = "34";
      if (scaleLabel) scaleLabel.textContent = "34%";
      if (upSlider) upSlider.value = "16";
      if (upLabel) upLabel.textContent = "0.16";
      if (rightSlider) rightSlider.value = "0";
      if (rightLabel) rightLabel.textContent = "0.00";
      if (forwardSlider) forwardSlider.value = "22";
      if (forwardLabel) forwardLabel.textContent = "0.22";
      if (yawSlider) yawSlider.value = "180";
      if (yawLabel) yawLabel.textContent = "180°";
      if (pitchSlider) pitchSlider.value = "0";
      if (pitchLabel) pitchLabel.textContent = "0°";
    });
  }
})();

// --- ระบบโหมด NPC ไม่สนใจตัวละคร (NPC Ignore Player Mode Controller) ---
(function initDevNpcIgnorePlayerControl() {
  if (typeof window.npcIgnorePlayer === "undefined") {
    window.npcIgnorePlayer = false;
  }

  function mountGroup() {
    const mainControls = document.getElementById("mainControls");
    if (!mainControls) return false;
    if (document.getElementById("devNpcIgnoreControlGroup")) return true;

    const group = document.createElement("div");
    group.className = "control-group";
    group.id = "devNpcIgnoreControlGroup";
    group.style.border = "1.5px solid #00bcd4";
    group.style.borderRadius = "8px";
    group.style.background = "rgba(10, 24, 30, 0.95)";
    group.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
    group.style.padding = "10px";

    group.innerHTML = `
      <div style="font-weight: bold; color: #00e5ff; font-size: 13px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>🦎 โหมด NPC (NPC Behavior Control)</span>
        <span id="devNpcIgnoreStatusBadge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #888; font-weight: normal;">ปกติ (Normal)</span>
      </div>
      
      <div style="font-size: 11px; color: #b2ebf2; margin-bottom: 8px; line-height: 1.4;">
        เมื่อเปิดโหมดนี้ NPC ทุกชนิด (เช่น ปลาดึกดำบรรพ์ Placoderm, วาฬ Georgiacetus, แมลง Meganeura) จะไม่ไล่ตาม ไม่โจมตี และไม่เกาะตัวละคร
      </div>

      <button id="devToggleNpcIgnoreBtn" class="btn-random" style="width: 100%; margin: 0; padding: 9px 8px; font-size: 12px; font-weight: bold; color: #fff; background-image: linear-gradient(135deg, #00838f, #00acc1); border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: all 0.2s ease;">
        🛡️ เปิดโหมด: NPC ไม่สนใจตัวละคร
      </button>
    `;

    mainControls.appendChild(group);

    const toggleBtn = document.getElementById("devToggleNpcIgnoreBtn");
    const statusBadge = document.getElementById("devNpcIgnoreStatusBadge");

    function updateUI() {
      if (!toggleBtn || !statusBadge) return;
      if (window.npcIgnorePlayer) {
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #2e7d32, #43a047)";
        toggleBtn.innerHTML = "✅ NPC ไม่สนใจตัวละคร (กำลังเปิดใช้งาน)";
        statusBadge.textContent = "ไม่สนใจตัวละคร (Ignored)";
        statusBadge.style.background = "rgba(76, 175, 80, 0.25)";
        statusBadge.style.color = "#81c784";
      } else {
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #00838f, #00acc1)";
        toggleBtn.innerHTML = "🛡️ เปิดโหมด: NPC ไม่สนใจตัวละคร";
        statusBadge.textContent = "ปกติ (Normal)";
        statusBadge.style.background = "rgba(255,255,255,0.1)";
        statusBadge.style.color = "#888";
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        window.npcIgnorePlayer = !window.npcIgnorePlayer;
        updateUI();
        if (typeof showNotice === "function") {
          showNotice(window.npcIgnorePlayer ? "เปิดโหมด NPC ไม่สนใจตัวละครแล้ว" : "ปิดโหมด NPC ไม่สนใจตัวละคร (NPC กลับมามีพฤติกรรมปกติ)");
        }
      });
    }

    updateUI();
    return true;
  }

  if (!mountGroup()) {
    const timer = setInterval(() => {
      if (mountGroup()) clearInterval(timer);
    }, 500);
  }
})();

// --- ระบบเส้นแสงเลเซอร์สีแดงเล็งเป้า (Bow & Cannon Red Laser Beam Guide) ---
(function initDevLaserGuideControl() {
  if (typeof window.devLaserGuideEnabled === "undefined") {
    // Default ON for devmode as requested by user
    window.devLaserGuideEnabled = (typeof window.isDevMode !== "undefined") ? window.isDevMode : true;
  }

  function mountGroup() {
    const mainControls = document.getElementById("mainControls");
    if (!mainControls) return false;
    if (document.getElementById("devLaserGuideControlGroup")) return true;

    const group = document.createElement("div");
    group.className = "control-group";
    group.id = "devLaserGuideControlGroup";
    group.style.border = "1.5px solid #ff1744";
    group.style.borderRadius = "8px";
    group.style.background = "rgba(35, 10, 15, 0.95)";
    group.style.boxShadow = "0 4px 12px rgba(255,23,68,0.25)";
    group.style.padding = "10px";

    group.innerHTML = `
      <div style="font-weight: bold; color: #ff5252; font-size: 13px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <span>🎯 เส้นเลเซอร์เล็งเป้า 3D (Laser Aim Guide)</span>
        <span id="devLaserGuideStatusBadge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,23,68,0.25); color: #ff8a80; font-weight: normal;">เปิด (ON)</span>
      </div>
      
      <div style="font-size: 11px; color: #ffcdd2; margin-bottom: 8px; line-height: 1.4;">
        เส้นแสงสีแดง 3D ลากจากปากกระบอกปืนไม้ / คันธนู พุ่งตรงไปหาเป้าหมาย NPC ในโลก 3D ช่วยตรวจสอบแนวการเล็งและการยิง (เปิดอัตโนมัติใน Dev Mode)
      </div>

      <button id="devToggleLaserGuideBtn" class="btn-random" style="width: 100%; margin: 0; padding: 9px 8px; font-size: 12px; font-weight: bold; color: #fff; background-image: linear-gradient(135deg, #d50000, #ff1744); border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: all 0.2s ease;">
        🔴 เส้นเลเซอร์เล็ง: เปิด (ON)
      </button>
    `;

    mainControls.appendChild(group);

    const toggleBtn = document.getElementById("devToggleLaserGuideBtn");
    const statusBadge = document.getElementById("devLaserGuideStatusBadge");

    function updateUI() {
      if (!toggleBtn || !statusBadge) return;
      if (window.devLaserGuideEnabled) {
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #b71c1c, #f44336)";
        toggleBtn.innerHTML = "🔴 เส้นเลเซอร์เล็ง: เปิด (ON)";
        statusBadge.textContent = "เปิด (ON)";
        statusBadge.style.background = "rgba(255,23,68,0.35)";
        statusBadge.style.color = "#ff8a80";
      } else {
        toggleBtn.style.backgroundImage = "linear-gradient(135deg, #424242, #616161)";
        toggleBtn.innerHTML = "⚪ เส้นเลเซอร์เล็ง: ปิด (OFF)";
        statusBadge.textContent = "ปิด (OFF)";
        statusBadge.style.background = "rgba(255,255,255,0.1)";
        statusBadge.style.color = "#aaa";
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        window.devLaserGuideEnabled = !window.devLaserGuideEnabled;
        updateUI();
        if (typeof showNotice === "function") {
          showNotice(window.devLaserGuideEnabled ? "เปิดเส้นเลเซอร์เล็งเป้า 3D แล้ว" : "ปิดเส้นเลเซอร์เล็งเป้า 3D แล้ว");
        }
      });
    }

    updateUI();
    return true;
  }

  if (!mountGroup()) {
    const timer = setInterval(() => {
      if (mountGroup()) clearInterval(timer);
    }, 500);
  }
})();


// Helper function to test spawning in-world 3D signs (non-screen-aligned)
if (typeof window !== "undefined") {
  window.testSpawn3DSign = function(text = "🚩 จุดปักป้าย 3D (In-World Sign)", offsetForward = 0.5) {
    if (!window.World3DUI) return null;
    const sinT = Math.sin(charTheta), cosT = Math.cos(charTheta);
    const sinP = Math.sin(charPhi), cosP = Math.cos(charPhi);
    const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;

    // Up and forward vectors
    const fwd = [
      -Math.cos(charTheta) * Math.cos(charPhi),
      Math.sin(charTheta),
      -Math.cos(charTheta) * Math.sin(charPhi)
    ];

    const r_ground = (typeof RADIUS !== "undefined" ? RADIUS : 1.0) + (typeof charScale !== "undefined" ? charScale * 0.1 : 0.05);
    const spawnPos = [
      nx * r_ground + fwd[0] * offsetForward,
      ny * r_ground + fwd[1] * offsetForward,
      nz * r_ground + fwd[2] * offsetForward
    ];

    const signId = window.World3DUI.createSign({
      position: spawnPos,
      normal: fwd,
      up: [nx, ny, nz],
      size: [0.35, 0.18],
      resolution: [512, 128],
      drawFn: (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(18, 20, 26, 0.9)';
        ctx.strokeStyle = '#dfb76c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(4, 4, w-8, h-8, 16);
        else ctx.rect(4,4,w-8,h-8);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#dfb76c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 32px "Google Sans", sans-serif';
        ctx.fillText(text, w/2, h/2);
      }
    });

    if (typeof showNotice === "function") {
      showNotice("สร้างป้าย 3D แบบยึดติดพื้นโลกเรียบร้อย!");
    }
    return signId;
  };
}

/* ==========================================================================
   GLB Skeleton Bones & Mesh Parts Inspector System (โชว์กระดูก & ชิ้นส่วนโมเดล GLB)
   ========================================================================== */
(function() {
  // Global Dev States
  window.devShowBones = false;
  window.devShowBoneLabels = false;
  window.devColorByParts = false;
  window.devWireframeMode = false;
  window.devSelectedBone = null;
  window.devPartVisibility = {
    head: true,
    torso: true,
    left_arm: true,
    right_arm: true,
    left_leg: true,
    right_leg: true,
    hair: true
  };

  // Reusable WebGL Buffers for Skeleton & Wireframe
  let devBoneLineBuf = null;
  let devBoneColBuf = null;
  let devWireframeLineBuf = null;
  let devWireframeColBuf = null;
  let lastWireframeVertexCount = 0;

  // Cached Screen Coordinates for Bone Labels
  const cachedBoneWorldPos = {};

  // Colors Palette per body part (RGB 0.0 - 1.0)
  const PART_COLORS = {
    head:      [1.0, 0.43, 0.25], // Coral
    torso:     [0.0, 0.69, 1.0],  // Cyan
    left_arm:  [0.0, 0.90, 0.46], // Lime/Green
    right_arm: [1.0, 0.67, 0.0],  // Amber/Gold
    left_leg:  [0.83, 0.0, 0.98], // Purple
    right_leg: [1.0, 0.09, 0.27], // Pink/Crimson
    hair:      [0.88, 0.25, 0.98]  // Ponytail (Magenta)
  };

  function getPartFromBoneName(name) {
    const n = (name || "").toLowerCase();
    if (n.includes("head") || n.includes("neck")) return "head";
    if (n.includes("spine") || n.includes("hips") || n.includes("pelvis")) return "torso";
    if (n.includes("left") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) return "left_arm";
    if (n.includes("right") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) return "right_arm";
    if (n.includes("left") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) return "left_leg";
    if (n.includes("right") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) return "right_leg";
    return "torso";
  }

  // Transform a point [x, y, z] with a column-major 4x4 matrix
  function transformPoint(m, x, y, z) {
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    ];
  }

  // Multiply 4x4 matrix with vector4 [x, y, z, w]
  function multMat4Vec4(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
      m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]
    ];
  }

  /**
   * Public API: Toggle 3D Skeleton Bones
   */
  window.devToggleBones = function(forceVal) {
    window.devShowBones = (typeof forceVal === "boolean") ? forceVal : !window.devShowBones;
    const btn = document.getElementById("devToggleBonesBtn");
    if (btn) {
      btn.innerText = "🦴 โครงกระดูก: " + (window.devShowBones ? "ON" : "OFF");
      btn.style.background = window.devShowBones ? "linear-gradient(135deg, #f57c00, #ff9800)" : "#333";
      btn.style.border = window.devShowBones ? "1px solid #ffa726" : "1px solid #555";
    }
    if (typeof showNotice === "function") {
      showNotice("โครงกระดูก 3D: " + (window.devShowBones ? "เปิดใช้งาน" : "ปิด"));
    }
    return window.devShowBones;
  };

  /**
   * Public API: Toggle Bone Name Labels
   */
  window.devToggleBoneLabels = function(forceVal) {
    window.devShowBoneLabels = (typeof forceVal === "boolean") ? forceVal : !window.devShowBoneLabels;
    const btn = document.getElementById("devToggleBoneLabelsBtn");
    if (btn) {
      btn.innerText = "🏷️ ป้ายชื่อกระดูก: " + (window.devShowBoneLabels ? "ON" : "OFF");
      btn.style.background = window.devShowBoneLabels ? "linear-gradient(135deg, #0288d1, #29b6f6)" : "#333";
      btn.style.border = window.devShowBoneLabels ? "1px solid #4fc3f7" : "1px solid #555";
    }
    const overlay = document.getElementById("devBoneLabelsOverlay");
    if (overlay && !window.devShowBoneLabels) {
      overlay.style.display = "none";
    }
    if (typeof showNotice === "function") {
      showNotice("ป้ายชื่อกระดูก 3D: " + (window.devShowBoneLabels ? "เปิดใช้งาน" : "ปิด"));
    }
    return window.devShowBoneLabels;
  };

  /**
   * Public API: Toggle Color by Parts
   */
  window.devToggleColorByParts = function(forceVal) {
    window.devColorByParts = (typeof forceVal === "boolean") ? forceVal : !window.devColorByParts;
    const btn = document.getElementById("devToggleColorByPartsBtn");
    if (btn) {
      btn.innerText = "🎨 แยกสีชิ้นส่วน: " + (window.devColorByParts ? "ON" : "OFF");
      btn.style.background = window.devColorByParts ? "linear-gradient(135deg, #7b1fa2, #ab47bc)" : "#333";
      btn.style.border = window.devColorByParts ? "1px solid #ba68c8" : "1px solid #555";
    }
    if (typeof window.updateCharacterMesh === "function") {
      window.updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
    }
    if (typeof showNotice === "function") {
      showNotice("แยกสีตามชิ้นส่วนโมเดล: " + (window.devColorByParts ? "เปิดใช้งาน" : "ปิด"));
    }
    return window.devColorByParts;
  };

  /**
   * Public API: Toggle Wireframe Overlay
   */
  window.devToggleWireframe = function(forceVal) {
    window.devWireframeMode = (typeof forceVal === "boolean") ? forceVal : !window.devWireframeMode;
    const btn = document.getElementById("devToggleWireframeBtn");
    if (btn) {
      btn.innerText = "🕸️ ตาข่าย Wireframe: " + (window.devWireframeMode ? "ON" : "OFF");
      btn.style.background = window.devWireframeMode ? "linear-gradient(135deg, #00897b, #26a69a)" : "#333";
      btn.style.border = window.devWireframeMode ? "1px solid #4db6ac" : "1px solid #555";
    }
    if (typeof showNotice === "function") {
      showNotice("โครงลวดโมเดล Wireframe: " + (window.devWireframeMode ? "เปิดใช้งาน" : "ปิด"));
    }
    return window.devWireframeMode;
  };

  /**
   * Public API: Set Part Visibility (head, torso, left_arm, right_arm, left_leg, right_leg)
   */
  window.devSetPartVisibility = function(partKey, isVisible) {
    if (!window.devPartVisibility) {
      window.devPartVisibility = { head: true, torso: true, left_arm: true, right_arm: true, left_leg: true, right_leg: true, hair: true };
    }
    window.devPartVisibility[partKey] = !!isVisible;
    const idMap = {
      head: "devPartHead",
      torso: "devPartTorso",
      left_arm: "devPartLeftArm",
      right_arm: "devPartRightArm",
      left_leg: "devPartLeftLeg",
      right_leg: "devPartRightLeg",
      hair: "devPartHair"
    };
    const chk = document.getElementById(idMap[partKey]);
    if (chk) chk.checked = !!isVisible;

    if (typeof window.updateCharacterMesh === "function") {
      window.updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
    }
    if (typeof showNotice === "function") {
      showNotice("ชิ้นส่วน " + partKey + ": " + (isVisible ? "เปิดแสดง" : "ซ่อน"));
    }
    return window.devPartVisibility[partKey];
  };

  /**
   * Public API: Toggle Part Visibility
   */
  window.devTogglePart = function(partKey) {
    const current = (window.devPartVisibility && window.devPartVisibility[partKey] !== undefined) ? window.devPartVisibility[partKey] : true;
    return window.devSetPartVisibility(partKey, !current);
  };

  /**
   * Public API: Reset all parts to visible
   */
  window.devResetPartsVisibility = function() {
    window.devPartVisibility = {
      head: true,
      torso: true,
      left_arm: true,
      right_arm: true,
      left_leg: true,
      right_leg: true,
      hair: true
    };
    ["devPartHead", "devPartTorso", "devPartLeftArm", "devPartRightArm", "devPartLeftLeg", "devPartRightLeg", "devPartHair"].forEach(id => {
      const chk = document.getElementById(id);
      if (chk) chk.checked = true;
    });
    if (typeof window.updateCharacterMesh === "function") {
      window.updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
    }
    if (typeof showNotice === "function") {
      showNotice("เปิดการแสดงผลชิ้นส่วนโมเดลทั้งหมดแล้ว");
    }
  };

  /**
   * Main 3D Skeleton and GLB Parts Render Pass
   * Called inside renderer.js inside the unlit lines/debug pipeline
   */
  window.renderDevSkeletonAndParts = function(gl, params) {
    if (!gl || window.characterModel !== "chibi" || !window.chibiGlbModel) {
      const overlay = document.getElementById("devBoneLabelsOverlay");
      if (overlay && overlay.style.display !== "none") overlay.style.display = "none";
      return;
    }

    const model = window.chibiGlbModel;
    if (!model.skin || !model.skin.joints || !model.nodes) return;

    const charModelMatrix = params.charModelMatrix || (typeof window.getCharacterMatrix === "function" ? window.getCharacterMatrix() : null);
    if (!charModelMatrix) return;

    const scale = 0.59;
    let yOffset = -0.46;
    if (typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
      yOffset = -0.15;
    } else if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
      yOffset = -0.15;
    } else if (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) {
      yOffset = -0.46 - currentSwimFactor * 0.12;
    }
    const now = Date.now() * 0.005;

    // 1. Calculate World Coordinates of all joints in the skeleton
    const jointWorldPositions = {};
    const skinJoints = model.skin.joints;

    for (let i = 0; i < skinJoints.length; i++) {
      const nodeIdx = skinJoints[i];
      const node = model.nodes[nodeIdx];
      if (!node || !node.matrix) continue;

      // Local GLB position inside model space
      const lx = node.matrix[12] * scale;
      const ly = node.matrix[13] * scale + yOffset;
      const lz = node.matrix[14] * scale;

      // Transform by character world matrix
      const wPos = transformPoint(charModelMatrix, lx, ly, lz);
      jointWorldPositions[nodeIdx] = wPos;
      cachedBoneWorldPos[node.name] = wPos;
    }

    // 2. Render 3D Bone Lines & Joint Diamonds
    if (window.devShowBones) {
      const lineVerts = [];
      const lineCols = [];

      const addLine = (p1, p2, col1, col2) => {
        lineVerts.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
        lineCols.push(col1[0], col1[1], col1[2], col2[0], col2[1], col2[2]);
      };

      // Add small 3D diamond/octahedron at joint
      const addJointDiamond = (pos, size, col) => {
        const x = pos[0], y = pos[1], z = pos[2];
        const s = size;
        const top = [x, y + s, z], btm = [x, y - s, z];
        const left = [x - s, y, z], right = [x + s, y, z];
        const fwd = [x, y, z + s], back = [x, y, z - s];

        // Top pyramid edges
        addLine(top, left, col, col);
        addLine(top, right, col, col);
        addLine(top, fwd, col, col);
        addLine(top, back, col, col);
        // Bottom pyramid edges
        addLine(btm, left, col, col);
        addLine(btm, right, col, col);
        addLine(btm, fwd, col, col);
        addLine(btm, back, col, col);
        // Equatorial ring
        addLine(left, fwd, col, col);
        addLine(fwd, right, col, col);
        addLine(right, back, col, col);
        addLine(back, left, col, col);
      };

      for (let i = 0; i < skinJoints.length; i++) {
        const nodeIdx = skinJoints[i];
        const node = model.nodes[nodeIdx];
        if (!node) continue;
        const pChild = jointWorldPositions[nodeIdx];
        if (!pChild) continue;

        const partKey = getPartFromBoneName(node.name);
        const baseCol = PART_COLORS[partKey] || [0.9, 0.9, 0.2];
        const isSelected = (window.devSelectedBone === node.name);

        // Draw bone stick from parent to child
        if (node.parent !== undefined) {
          const parentNode = model.nodes[node.parent];
          if (parentNode && parentNode.name !== "Armature" && jointWorldPositions[node.parent]) {
            const pParent = jointWorldPositions[node.parent];
            const pPartKey = getPartFromBoneName(parentNode.name);
            const parentCol = PART_COLORS[pPartKey] || baseCol;
            addLine(pParent, pChild, parentCol, baseCol);
          }
        }

        // Draw joint marker
        if (isSelected) {
          // Pulsing highlighted diamond with bounding rings for selected bone
          const pulseSize = 0.038 + Math.sin(now) * 0.01;
          const selectCol = [1.0, 1.0, 0.1];
          addJointDiamond(pChild, pulseSize, selectCol);
          // Highlight crosshair
          addLine([pChild[0] - 0.08, pChild[1], pChild[2]], [pChild[0] + 0.08, pChild[1], pChild[2]], selectCol, selectCol);
          addLine([pChild[0], pChild[1] - 0.08, pChild[2]], [pChild[0], pChild[1] + 0.08, pChild[2]], selectCol, selectCol);
          addLine([pChild[0], pChild[1], pChild[2] - 0.08], [pChild[0], pChild[1], pChild[2] + 0.08], selectCol, selectCol);
        } else {
          addJointDiamond(pChild, 0.016, baseCol);
        }
      }

      if (lineVerts.length > 0) {
        if (!devBoneLineBuf) devBoneLineBuf = gl.createBuffer();
        if (!devBoneColBuf) devBoneColBuf = gl.createBuffer();

        // X-ray pass for bones (always visible over character surface)
        gl.disable(gl.DEPTH_TEST);

        gl.bindBuffer(gl.ARRAY_BUFFER, devBoneLineBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineVerts), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(params.positionLoc);
        gl.vertexAttribPointer(params.positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, devBoneColBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineCols), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(params.colorLoc);
        gl.vertexAttribPointer(params.colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.LINES, 0, lineVerts.length / 3);

        gl.enable(gl.DEPTH_TEST);
      }
    }

    // 3. Render Mesh Wireframe
    if (window.devWireframeMode && model.indices && (model.outPositions || model.basePositions)) {
      const positions = model.outPositions || model.basePositions;
      const indices = model.indices;
      const wfVerts = [];
      const wfCols = [];

      const colWire = [0.0, 0.95, 1.0];
      const triangleCount = indices.length / 3;

      // Sample triangles cleanly for performance
      const step = triangleCount > 4000 ? 2 : 1;
      const partGroups = model.vertexPartGroups;
      const partKeys = ["head", "torso", "left_arm", "right_arm", "left_leg", "right_leg", "hair"];
      const partVis = window.devPartVisibility;

      for (let t = 0; t < triangleCount; t += step) {
        const i0 = indices[t * 3] * 3;
        const i1 = indices[t * 3 + 1] * 3;
        const i2 = indices[t * 3 + 2] * 3;

        if (partVis && partGroups) {
          const pGroup = partGroups[indices[t * 3]];
          const pKey = partKeys[pGroup] || "torso";
          if (partVis[pKey] === false) continue;
        }

        // Model space to world space
        const p0 = transformPoint(charModelMatrix, positions[i0] * scale, positions[i0 + 1] * scale + yOffset, positions[i0 + 2] * scale);
        const p1 = transformPoint(charModelMatrix, positions[i1] * scale, positions[i1 + 1] * scale + yOffset, positions[i1 + 2] * scale);
        const p2 = transformPoint(charModelMatrix, positions[i2] * scale, positions[i2 + 1] * scale + yOffset, positions[i2 + 2] * scale);

        // Edge 0-1
        wfVerts.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
        wfCols.push(colWire[0], colWire[1], colWire[2], colWire[0], colWire[1], colWire[2]);
        // Edge 1-2
        wfVerts.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
        wfCols.push(colWire[0], colWire[1], colWire[2], colWire[0], colWire[1], colWire[2]);
        // Edge 2-0
        wfVerts.push(p2[0], p2[1], p2[2], p0[0], p0[1], p0[2]);
        wfCols.push(colWire[0], colWire[1], colWire[2], colWire[0], colWire[1], colWire[2]);
      }

      if (wfVerts.length > 0) {
        if (!devWireframeLineBuf) devWireframeLineBuf = gl.createBuffer();
        if (!devWireframeColBuf) devWireframeColBuf = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, devWireframeLineBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wfVerts), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(params.positionLoc);
        gl.vertexAttribPointer(params.positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, devWireframeColBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(wfCols), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(params.colorLoc);
        gl.vertexAttribPointer(params.colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.LINES, 0, wfVerts.length / 3);
      }
    }

    // 4. Update Screen-Space Bone Labels Overlay
    const overlay = document.getElementById("devBoneLabelsOverlay");
    if (overlay) {
      if (!window.devShowBoneLabels) {
        if (overlay.style.display !== "none") {
          overlay.style.display = "none";
          overlay.innerHTML = "";
        }
      } else {
        overlay.style.display = "block";
        const viewM = params.viewMatrix;
        const projM = params.projMatrix;
        const w = window.innerWidth;
        const h = window.innerHeight;

        let html = "";
        for (let i = 0; i < skinJoints.length; i++) {
          const nodeIdx = skinJoints[i];
          const node = model.nodes[nodeIdx];
          if (!node) continue;
          const pos = jointWorldPositions[nodeIdx];
          if (!pos) continue;

          // View transform
          const vView = multMat4Vec4(viewM, [pos[0], pos[1], pos[2], 1.0]);
          // Projection transform
          const vClip = multMat4Vec4(projM, vView);

          // Check if in front of camera
          if (vClip[3] <= 0.05) continue;

          const ndcX = vClip[0] / vClip[3];
          const ndcY = vClip[1] / vClip[3];

          // Check viewport bounds
          if (ndcX < -1.1 || ndcX > 1.1 || ndcY < -1.1 || ndcY > 1.1) continue;

          const screenX = (ndcX * 0.5 + 0.5) * w;
          const screenY = (-ndcY * 0.5 + 0.5) * h;

          const isSelected = (window.devSelectedBone === node.name);
          const partKey = getPartFromBoneName(node.name);
          const borderColor = isSelected ? "#ffd600" : "rgba(255, 255, 255, 0.4)";
          const bg = isSelected ? "rgba(255, 214, 0, 0.3)" : "rgba(10, 15, 25, 0.75)";
          const scaleBadge = isSelected ? "transform: translate(-50%, -50%) scale(1.15);" : "transform: translate(-50%, -50%);";

          html += `<div class="dev-bone-badge" data-bone="${node.name}" style="position: absolute; left: ${screenX.toFixed(1)}px; top: ${screenY.toFixed(1)}px; background: ${bg}; color: #fff; border: 1px solid ${borderColor}; border-radius: 4px; padding: 1px 5px; font-size: 9px; font-family: 'Google Sans', sans-serif; white-space: nowrap; pointer-events: auto; cursor: pointer; user-select: none; box-shadow: 0 2px 5px rgba(0,0,0,0.5); ${scaleBadge}">🦴 ${node.name}</div>`;
        }
        overlay.innerHTML = html;
      }
    }
  };

  /**
   * Update Bone Hierarchy Tree and Inspector UI
   */
  window.updateDevBonesAndParts = function() {
    try {
      const model = window.chibiGlbModel;
      if (!model || !model.nodes || !model.skin || !model.skin.joints) return;

      const badge = document.getElementById("devBonesCountBadge");
      if (badge) badge.innerText = model.skin.joints.length + " Bones";

      const treeContainer = document.getElementById("devBoneTreeList");
      if (treeContainer && typeof model.getBonesInfo === "function") {
        const bones = model.getBonesInfo();
        let html = "";

        // Build hierarchy map
        const bonesByName = {};
        bones.forEach(b => { bonesByName[b.name] = b; });

        // Recursive tree rendering
        const renderBoneNode = (bone, depth) => {
          const indent = depth * 14;
          const isSelected = (window.devSelectedBone === bone.name);
          const bg = isSelected ? "rgba(33, 150, 243, 0.25)" : "transparent";
          const border = isSelected ? "1px solid #2196f3" : "1px solid transparent";

          html += `
            <div class="dev-bone-item" data-bone="${bone.name}" style="padding: 2px 4px; margin-left: ${indent}px; background: ${bg}; border: ${border}; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
              <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span style="color: ${bone.partColor}; font-size: 11px;">🦴</span>
                <span style="color: #fff; font-weight: ${isSelected ? 'bold' : 'normal'};">${bone.name}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 8px; color: ${bone.partColor}; background: rgba(0,0,0,0.4); padding: 1px 4px; border-radius: 3px;">${bone.part}</span>
                <span style="font-size: 8px; color: #888;">${bone.dominantVertexCount}v</span>
              </div>
            </div>
          `;

          if (bone.childNames && bone.childNames.length > 0) {
            bone.childNames.forEach(cName => {
              if (bonesByName[cName]) {
                renderBoneNode(bonesByName[cName], depth + 1);
              }
            });
          }
        };

        // Render from Root bone 'Hips'
        const rootBone = bonesByName["Hips"] || bones[0];
        if (rootBone) renderBoneNode(rootBone, 0);

        treeContainer.innerHTML = html;
      }

      // Update Inspector Card for Selected Bone
      window.refreshSelectedBoneCard();
    } catch (e) {
      console.warn("DevBones UI update warning:", e);
    }
  };

  /**
   * Select a specific bone for inspection and 3D highlighting
   */
  window.selectDevBone = function(boneName) {
    window.devSelectedBone = boneName;
    window.refreshSelectedBoneCard();

    // Re-render tree selection highlight
    document.querySelectorAll(".dev-bone-item").forEach(item => {
      const b = item.getAttribute("data-bone");
      if (b === boneName) {
        item.style.background = "rgba(33, 150, 243, 0.25)";
        item.style.border = "1px solid #2196f3";
      } else {
        item.style.background = "transparent";
        item.style.border = "1px solid transparent";
      }
    });

    if (typeof window.updateCharacterMesh === "function") {
      window.updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
    }

    if (typeof showNotice === "function" && boneName) {
      showNotice("🔍 ส่องกระดูก: " + boneName);
    }
  };

  /**
   * Refresh Selected Bone Card Details
   */
  window.refreshSelectedBoneCard = function() {
    const card = document.getElementById("devSelectedBoneCard");
    const nameEl = document.getElementById("devSelectedBoneName");
    const detailsEl = document.getElementById("devSelectedBoneDetails");
    if (!card || !nameEl || !detailsEl) return;

    if (!window.devSelectedBone) {
      card.style.display = "none";
      return;
    }

    const model = window.chibiGlbModel;
    if (!model || typeof model.getBonesInfo !== "function") return;

    const bones = model.getBonesInfo();
    const bone = bones.find(b => b.name === window.devSelectedBone);
    if (!bone) {
      card.style.display = "none";
      return;
    }

    card.style.display = "block";
    nameEl.innerHTML = `🦴 ${bone.name} <span style="font-size: 9px; color: ${bone.partColor};">(${bone.partTh})</span>`;

    const vTotal = model.vertexCount || 12035;
    const vPercent = ((bone.dominantVertexCount / vTotal) * 100).toFixed(1);
    const t = bone.translation || [0, 0, 0];
    const r = bone.rotation || [0, 0, 0, 1];
    const s = bone.scale || [1, 1, 1];

    detailsEl.innerHTML = `
      <div><strong>Dominant Vertices:</strong> <span style="color: #ffd54f;">${bone.dominantVertexCount} verts (${vPercent}%)</span></div>
      <div><strong>Parent Bone:</strong> <span style="color: #4fc3f7;">${bone.parentName || 'Root (None)'}</span></div>
      <div><strong>Children (${bone.childCount}):</strong> <span style="color: #aed581;">${bone.childNames.join(', ') || 'None'}</span></div>
      <div style="margin-top: 4px; color: #aaa; border-top: 1px dotted rgba(255,255,255,0.1); padding-top: 2px;">
        <div>Pos: [${t[0].toFixed(3)}, ${t[1].toFixed(3)}, ${t[2].toFixed(3)}]</div>
        <div>Rot: [${r[0].toFixed(3)}, ${r[1].toFixed(3)}, ${r[2].toFixed(3)}, ${r[3].toFixed(3)}]</div>
        <div>Scale: [${s[0].toFixed(2)}, ${s[1].toFixed(2)}, ${s[2].toFixed(2)}]</div>
      </div>
    `;
  };

  // Wire up Event Listeners
  document.addEventListener("click", function(e) {
    // 1. Toggle 3D Skeleton
    if (e.target.closest("#devToggleBonesBtn")) {
      window.devToggleBones();
    }
    // 2. Toggle Bone Labels
    else if (e.target.closest("#devToggleBoneLabelsBtn")) {
      window.devToggleBoneLabels();
    }
    // 3. Toggle Color by Parts
    else if (e.target.closest("#devToggleColorByPartsBtn")) {
      window.devToggleColorByParts();
    }
    // 4. Toggle Wireframe
    else if (e.target.closest("#devToggleWireframeBtn")) {
      window.devToggleWireframe();
    }
    // 5. Reset Parts Visibility
    else if (e.target.closest("#devResetPartsVisibilityBtn")) {
      window.devResetPartsVisibility();
    }
    // 6. Clear Selected Bone
    else if (e.target.closest("#devClearSelectedBoneBtn")) {
      window.selectDevBone(null);
    }
    // 7. Click on Bone Tree item
    else {
      const boneItem = e.target.closest(".dev-bone-item");
      if (boneItem) {
        const b = boneItem.getAttribute("data-bone");
        if (b) window.selectDevBone(b);
        return;
      }
      // Click on Screen Bone Badge
      const boneBadge = e.target.closest(".dev-bone-badge");
      if (boneBadge) {
        const b = boneBadge.getAttribute("data-bone");
        if (b) window.selectDevBone(b);
        return;
      }
    }
  });

  // Wire up Checkbox change events for parts visibility
  document.addEventListener("change", function(e) {
    const map = {
      "devPartHead": "head",
      "devPartTorso": "torso",
      "devPartLeftArm": "left_arm",
      "devPartRightArm": "right_arm",
      "devPartLeftLeg": "left_leg",
      "devPartRightLeg": "right_leg",
      "devPartHair": "hair"
    };
    if (map[e.target.id]) {
      const key = map[e.target.id];
      window.devSetPartVisibility(key, e.target.checked);
    }
  });

  // Wire up Hair Spring Physics UI Controls
  document.addEventListener("click", function(e) {
    if (e.target && e.target.id === "devToggleHairPhysicsBtn") {
      if (window.chibiHairPhysics) {
        window.chibiHairPhysics.enabled = !window.chibiHairPhysics.enabled;
        const btn = document.getElementById("devToggleHairPhysicsBtn");
        if (btn) {
          btn.innerText = "✨ ฟิสิกส์ผม: " + (window.chibiHairPhysics.enabled ? "ON" : "OFF");
          btn.style.background = window.chibiHairPhysics.enabled ? "linear-gradient(135deg, #aa00ff, #ea80fc)" : "#333";
          btn.style.border = window.chibiHairPhysics.enabled ? "1px solid #e040fb" : "1px solid #555";
        }
        if (typeof showNotice === "function") {
          showNotice("ฟิสิกส์ผมรวบ: " + (window.chibiHairPhysics.enabled ? "เปิดใช้งาน" : "ปิด"));
        }
      }
    } else if (e.target && e.target.id === "devTestHairJiggleBtn") {
      if (typeof window.triggerHairJiggle === "function") {
        window.triggerHairJiggle(45.0, 60.0, 30.0);
        if (typeof showNotice === "function") {
          showNotice("💫 สะบัดผมรวบทดสอบ!");
        }
      }
    }
  });

  document.addEventListener("input", function(e) {
    if (!window.chibiHairPhysics) return;
    if (e.target.id === "devHairStiffnessSlider") {
      const val = parseFloat(e.target.value);
      window.chibiHairPhysics.stiffness = val;
      const lbl = document.getElementById("devHairStiffnessVal");
      if (lbl) lbl.innerText = Math.round(val);
      if (typeof window.triggerHairJiggle === "function") window.triggerHairJiggle(15.0, 20.0, 10.0);
    } else if (e.target.id === "devHairDampingSlider") {
      const val = parseFloat(e.target.value);
      window.chibiHairPhysics.damping = val;
      const lbl = document.getElementById("devHairDampingVal");
      if (lbl) lbl.innerText = Math.round(val);
      if (typeof window.triggerHairJiggle === "function") window.triggerHairJiggle(15.0, 20.0, 10.0);
    } else if (e.target.id === "devHairInertiaSlider") {
      const val = parseFloat(e.target.value) / 10.0;
      window.chibiHairPhysics.inertia = val;
      const lbl = document.getElementById("devHairInertiaVal");
      if (lbl) lbl.innerText = val.toFixed(1);
      if (typeof window.triggerHairJiggle === "function") window.triggerHairJiggle(25.0, 35.0, 15.0);
    }
  });

  // Wire up Hand & Finger Pose UI Controls (กำมือ, แบมือ, แยกนิ้ว)
  let activeHandTarget = "both"; // "both", "right", "left"

  function updateHandTargetUI(target) {
    activeHandTarget = target;
    const badge = document.getElementById("devHandPoseTargetBadge");
    const bBoth = document.getElementById("devHandTargetBothBtn");
    const bRight = document.getElementById("devHandTargetRightBtn");
    const bLeft = document.getElementById("devHandTargetLeftBtn");

    if (badge) {
      badge.innerText = target === "both" ? "สองข้าง (Both)" : (target === "right" ? "มือขวา (Right)" : "มือซ้าย (Left)");
    }
    const setBtnStyle = (btn, active) => {
      if (!btn) return;
      btn.style.background = active ? "#ffb300" : "#333";
      btn.style.color = active ? "#000" : "#ccc";
      btn.style.fontWeight = active ? "bold" : "normal";
      btn.style.border = active ? "1px solid #ffca28" : "1px solid #555";
    };
    setBtnStyle(bBoth, target === "both");
    setBtnStyle(bRight, target === "right");
    setBtnStyle(bLeft, target === "left");

    // Sync sliders to reflect current values of selected target
    if (window.chibiHandState) {
      const curlVal = target === "left" ? window.chibiHandState.leftCurl : window.chibiHandState.rightCurl;
      const spreadVal = target === "left" ? window.chibiHandState.leftSpread : window.chibiHandState.rightSpread;
      const curlSlider = document.getElementById("devHandCurlSlider");
      const spreadSlider = document.getElementById("devHandSpreadSlider");
      if (curlSlider) curlSlider.value = Math.round(curlVal * 100);
      if (spreadSlider) spreadSlider.value = Math.round(spreadVal * 100);
      updateHandCurlLabel(curlVal);
      updateHandSpreadLabel(spreadVal);
    }
  }

  function updateHandCurlLabel(val) {
    const lbl = document.getElementById("devHandCurlVal");
    if (!lbl) return;
    const pct = Math.round(val * 100);
    if (pct === 0) lbl.innerText = "0% (ผ่อนคลาย)";
    else if (pct > 0) lbl.innerText = `+${pct}% (กำมือ✊)`;
    else lbl.innerText = `${pct}% (แบมือ✋)`;
  }

  function updateHandSpreadLabel(val) {
    const lbl = document.getElementById("devHandSpreadVal");
    if (!lbl) return;
    const pct = Math.round(val * 100);
    if (pct === 0) lbl.innerText = "0% (ปกติ)";
    else if (pct > 0) lbl.innerText = `+${pct}% (กางแยกนิ้ว🖐️)`;
    else lbl.innerText = `${pct}% (หุบนิ้วชิด🤏)`;
  }

  function applyHandPose(curl, spread) {
    if (typeof window.setChibiHandCurl === "function") {
      window.setChibiHandCurl(curl, activeHandTarget);
    }
    if (typeof window.setChibiHandSpread === "function") {
      window.setChibiHandSpread(spread, activeHandTarget);
    }
    const cSlider = document.getElementById("devHandCurlSlider");
    const sSlider = document.getElementById("devHandSpreadSlider");
    if (cSlider) cSlider.value = Math.round(curl * 100);
    if (sSlider) sSlider.value = Math.round(spread * 100);
    updateHandCurlLabel(curl);
    updateHandSpreadLabel(spread);
  }

  document.addEventListener("click", function(e) {
    if (!e.target) return;
    const id = e.target.id;
    if (id === "devHandTargetBothBtn") updateHandTargetUI("both");
    else if (id === "devHandTargetRightBtn") updateHandTargetUI("right");
    else if (id === "devHandTargetLeftBtn") updateHandTargetUI("left");
    else if (id === "devHandPresetRelaxed") {
      applyHandPose(0.0, 0.0);
      if (typeof showNotice === "function") showNotice("🖐️ ผ่อนคลายมือ (Relaxed)");
    } else if (id === "devHandPresetFist") {
      applyHandPose(1.0, -0.2);
      if (typeof showNotice === "function") showNotice("✊ กำมือแน่น (Closed Fist)");
    } else if (id === "devHandPresetOpen") {
      applyHandPose(-0.35, 0.0);
      if (typeof showNotice === "function") showNotice("✋ แบมือตรง (Flat Open Hand)");
    } else if (id === "devHandPresetSpread") {
      applyHandPose(-0.15, 0.95);
      if (typeof showNotice === "function") showNotice("🖐️ กางแยกนิ้วกว้าง (Finger Spread)");
    }
  });

  document.addEventListener("input", function(e) {
    if (!e.target) return;
    if (e.target.id === "devHandCurlSlider") {
      const val = parseFloat(e.target.value) / 100.0;
      updateHandCurlLabel(val);
      if (typeof window.setChibiHandCurl === "function") {
        window.setChibiHandCurl(val, activeHandTarget);
      }
    } else if (e.target.id === "devHandSpreadSlider") {
      const val = parseFloat(e.target.value) / 100.0;
      updateHandSpreadLabel(val);
      if (typeof window.setChibiHandSpread === "function") {
        window.setChibiHandSpread(val, activeHandTarget);
      }
    }
  });

  // Auto-init bone list and UI when model is loaded or ready
  const checkInterval = setInterval(() => {
    if (typeof window.updateDevCharacterModelUI === "function") {
      window.updateDevCharacterModelUI();
    }
    if (window.chibiGlbModel && window.chibiGlbModel.nodes) {
      window.updateDevBonesAndParts();
      clearInterval(checkInterval);
    }
  }, 800);

})();



// --- ระบบปรับตำแหน่งและสเกลปุ่ม E ของหุ่นยนต์ (Mech Ride UI Settings) ---
(function initDevMechRideUiSettings() {
  window.devgame = window.devgame || {};
  
  // Default values
  if (typeof window.devgame.mechRideUiFpsForwardOffset !== "number") window.devgame.mechRideUiFpsForwardOffset = 1.41;
  if (typeof window.devgame.mechRideUiFpsUpOffset !== "number") window.devgame.mechRideUiFpsUpOffset = 1.10;
  if (typeof window.devgame.mechRideUiFpsRightOffset !== "number") window.devgame.mechRideUiFpsRightOffset = 0.0;
  if (typeof window.devgame.mechRideUiFpsScale !== "number") window.devgame.mechRideUiFpsScale = 0.47;
  
  if (typeof window.devgame.mechRideUiTpsForwardOffset !== "number") window.devgame.mechRideUiTpsForwardOffset = -2.01;
  if (typeof window.devgame.mechRideUiTpsUpOffset !== "number") window.devgame.mechRideUiTpsUpOffset = 1.68;
  if (typeof window.devgame.mechRideUiTpsRightOffset !== "number") window.devgame.mechRideUiTpsRightOffset = 0.0;
  if (typeof window.devgame.mechRideUiTpsScale !== "number") window.devgame.mechRideUiTpsScale = 0.47;
  if (typeof window.devgame.mechRideUiOutForwardOffset !== "number") window.devgame.mechRideUiOutForwardOffset = 0.30;
  if (typeof window.devgame.mechRideUiOutUpOffset !== "number") window.devgame.mechRideUiOutUpOffset = 0.26;
  if (typeof window.devgame.mechRideUiOutRightOffset !== "number") window.devgame.mechRideUiOutRightOffset = 1.52;
  if (typeof window.devgame.mechRideUiOutScale !== "number") window.devgame.mechRideUiOutScale = 0.47;

  const mainControls = document.getElementById("mainControls");
  if (!mainControls || document.getElementById("devMechRideUiGroup")) return;

  const group = document.createElement("div");
  group.className = "control-group";
  group.id = "devMechRideUiGroup";
  group.innerHTML = `
    <label>🤖 ปุ่ม E หุ่นยนต์ (Mech Ride UI Settings)</label>
    
    <div style="margin-top: 8px; font-weight: bold; font-size: 11px; color: #aaa;">[ 1. ขณะขับหุ่น (มุมมอง FPS) ]</div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">ย่อ/ขยายสเกล UI (Scale):</label>
            <span id="devMechRideFpsScaleLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.devgame.mechRideUiFpsScale * 100)}%</span>
        </div>
        <input type="range" id="devMechRideFpsScaleSlider" min="10" max="300" value="${Math.round(window.devgame.mechRideUiFpsScale * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนหน้า/หลัง (Forward):</label>
            <span id="devMechRideFpsForwardLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiFpsForwardOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideFpsForwardSlider" min="-500" max="500" value="${Math.round(window.devgame.mechRideUiFpsForwardOffset * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนขึ้น/ลง (Up):</label>
            <span id="devMechRideFpsUpLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiFpsUpOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideFpsUpSlider" min="-200" max="500" value="${Math.round(window.devgame.mechRideUiFpsUpOffset * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนซ้าย/ขวา (Right):</label>
            <span id="devMechRideFpsRightLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${(window.devgame.mechRideUiFpsRightOffset || 0).toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideFpsRightSlider" min="-500" max="500" value="${Math.round((window.devgame.mechRideUiFpsRightOffset || 0) * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนซ้าย/ขวา (Yaw):</label>
            <span id="devMechRideFpsYawLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiFpsYawOffset || 0}°</span>
        </div>
        <input type="range" id="devMechRideFpsYawSlider" min="-180" max="180" value="${window.devgame.mechRideUiFpsYawOffset || 0}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนขึ้น/ลง (Pitch):</label>
            <span id="devMechRideFpsPitchLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiFpsPitchOffset !== undefined ? window.devgame.mechRideUiFpsPitchOffset : -22}°</span>
        </div>
        <input type="range" id="devMechRideFpsPitchSlider" min="-180" max="180" value="${window.devgame.mechRideUiFpsPitchOffset !== undefined ? window.devgame.mechRideUiFpsPitchOffset : -22}" style="width: 100%;">
    </div>

    <div style="margin-top: 16px; font-weight: bold; font-size: 11px; color: #aaa;">[ 3. ก่อนขึ้นหุ่น (ยังไม่ได้ขับ) ]</div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">ย่อ/ขยายสเกล UI (Scale):</label>
            <span id="devMechRideOutScaleLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.devgame.mechRideUiOutScale * 100)}%</span>
        </div>
        <input type="range" id="devMechRideOutScaleSlider" min="10" max="300" value="${Math.round(window.devgame.mechRideUiOutScale * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนหน้า/หลัง (Forward):</label>
            <span id="devMechRideOutForwardLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiOutForwardOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideOutForwardSlider" min="-500" max="500" value="${Math.round(window.devgame.mechRideUiOutForwardOffset * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนขึ้น/ลง (Up):</label>
            <span id="devMechRideOutUpLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiOutUpOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideOutUpSlider" min="-200" max="800" value="${Math.round(window.devgame.mechRideUiOutUpOffset * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนซ้าย/ขวา (Right):</label>
            <span id="devMechRideOutRightLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${(window.devgame.mechRideUiOutRightOffset || 0).toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideOutRightSlider" min="-500" max="500" value="${Math.round((window.devgame.mechRideUiOutRightOffset || 0) * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนซ้าย/ขวา (Yaw):</label>
            <span id="devMechRideOutYawLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiOutYawOffset || 0}°</span>
        </div>
        <input type="range" id="devMechRideOutYawSlider" min="-180" max="180" value="${window.devgame.mechRideUiOutYawOffset || 0}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนขึ้น/ลง (Pitch):</label>
            <span id="devMechRideOutPitchLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiOutPitchOffset !== undefined ? window.devgame.mechRideUiOutPitchOffset : -22}°</span>
        </div>
        <input type="range" id="devMechRideOutPitchSlider" min="-180" max="180" value="${window.devgame.mechRideUiOutPitchOffset !== undefined ? window.devgame.mechRideUiOutPitchOffset : -22}" style="width: 100%;">
    </div>
    <div style="margin-top: 16px; font-weight: bold; font-size: 11px; color: #aaa;">[ 2. ขณะขับหุ่น (มุมมอง TPS) ]</div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">ย่อ/ขยายสเกล UI (Scale):</label>
            <span id="devMechRideTpsScaleLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${Math.round(window.devgame.mechRideUiTpsScale * 100)}%</span>
        </div>
        <input type="range" id="devMechRideTpsScaleSlider" min="10" max="300" value="${Math.round(window.devgame.mechRideUiTpsScale * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนหน้า/หลัง (Forward):</label>
            <span id="devMechRideTpsForwardLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiTpsForwardOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideTpsForwardSlider" min="-500" max="500" value="${Math.round(window.devgame.mechRideUiTpsForwardOffset * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนขึ้น/ลง (Up):</label>
            <span id="devMechRideTpsUpLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiTpsUpOffset.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideTpsUpSlider" min="-200" max="800" value="${Math.round(window.devgame.mechRideUiTpsUpOffset * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">เลื่อนซ้าย/ขวา (Right):</label>
            <span id="devMechRideTpsRightLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${(window.devgame.mechRideUiTpsRightOffset || 0).toFixed(2)}</span>
        </div>
        <input type="range" id="devMechRideTpsRightSlider" min="-500" max="500" value="${Math.round((window.devgame.mechRideUiTpsRightOffset || 0) * 100)}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนซ้าย/ขวา (Yaw):</label>
            <span id="devMechRideTpsYawLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiTpsYawOffset || 0}°</span>
        </div>
        <input type="range" id="devMechRideTpsYawSlider" min="-180" max="180" value="${window.devgame.mechRideUiTpsYawOffset || 0}" style="width: 100%;">
    </div>
    <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px;">หมุนขึ้น/ลง (Pitch):</label>
            <span id="devMechRideTpsPitchLabel" style="font-size: 11px; font-weight: bold; color: #dfb76c;">${window.devgame.mechRideUiTpsPitchOffset !== undefined ? window.devgame.mechRideUiTpsPitchOffset : -22}°</span>
        </div>
        <input type="range" id="devMechRideTpsPitchSlider" min="-180" max="180" value="${window.devgame.mechRideUiTpsPitchOffset !== undefined ? window.devgame.mechRideUiTpsPitchOffset : -22}" style="width: 100%;">
    </div>
  `;
  mainControls.appendChild(group);

  if(typeof window.devgame.mechRideUiFpsYawOffset !== "number") window.devgame.mechRideUiFpsYawOffset = 0;
  if(typeof window.devgame.mechRideUiFpsPitchOffset !== "number") window.devgame.mechRideUiFpsPitchOffset = 0;
  if(typeof window.devgame.mechRideUiTpsYawOffset !== "number") window.devgame.mechRideUiTpsYawOffset = 0;
  if(typeof window.devgame.mechRideUiTpsPitchOffset !== "number") window.devgame.mechRideUiTpsPitchOffset = 0;
  if(typeof window.devgame.mechRideUiOutYawOffset !== "number") window.devgame.mechRideUiOutYawOffset = -90;
  if(typeof window.devgame.mechRideUiOutPitchOffset !== "number") window.devgame.mechRideUiOutPitchOffset = 0;

  // FPS Listeners
  document.getElementById("devMechRideFpsScaleSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiFpsScale = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideFpsScaleLabel").textContent = e.target.value + "%";
  });
  document.getElementById("devMechRideFpsForwardSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiFpsForwardOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideFpsForwardLabel").textContent = window.devgame.mechRideUiFpsForwardOffset.toFixed(2);
  });
  document.getElementById("devMechRideFpsUpSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiFpsUpOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideFpsUpLabel").textContent = window.devgame.mechRideUiFpsUpOffset.toFixed(2);
  });
  document.getElementById("devMechRideFpsRightSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiFpsRightOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideFpsRightLabel").textContent = window.devgame.mechRideUiFpsRightOffset.toFixed(2);
  });
  document.getElementById("devMechRideFpsYawSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiFpsYawOffset = parseInt(e.target.value);
    document.getElementById("devMechRideFpsYawLabel").textContent = window.devgame.mechRideUiFpsYawOffset + "°";
  });
  document.getElementById("devMechRideFpsPitchSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiFpsPitchOffset = parseInt(e.target.value);
    document.getElementById("devMechRideFpsPitchLabel").textContent = window.devgame.mechRideUiFpsPitchOffset + "°";
  });

  // TPS Listeners
  document.getElementById("devMechRideTpsScaleSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiTpsScale = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideTpsScaleLabel").textContent = e.target.value + "%";
  });
  document.getElementById("devMechRideTpsForwardSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiTpsForwardOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideTpsForwardLabel").textContent = window.devgame.mechRideUiTpsForwardOffset.toFixed(2);
  });
  document.getElementById("devMechRideTpsUpSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiTpsUpOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideTpsUpLabel").textContent = window.devgame.mechRideUiTpsUpOffset.toFixed(2);
  });
  document.getElementById("devMechRideTpsRightSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiTpsRightOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideTpsRightLabel").textContent = window.devgame.mechRideUiTpsRightOffset.toFixed(2);
  });
  document.getElementById("devMechRideTpsYawSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiTpsYawOffset = parseInt(e.target.value);
    document.getElementById("devMechRideTpsYawLabel").textContent = window.devgame.mechRideUiTpsYawOffset + "°";
  });
  document.getElementById("devMechRideTpsPitchSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiTpsPitchOffset = parseInt(e.target.value);
    document.getElementById("devMechRideTpsPitchLabel").textContent = window.devgame.mechRideUiTpsPitchOffset + "°";
  });
  // OUT Listeners
  document.getElementById("devMechRideOutScaleSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiOutScale = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideOutScaleLabel").textContent = e.target.value + "%";
  });
  document.getElementById("devMechRideOutForwardSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiOutForwardOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideOutForwardLabel").textContent = window.devgame.mechRideUiOutForwardOffset.toFixed(2);
  });
  document.getElementById("devMechRideOutUpSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiOutUpOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideOutUpLabel").textContent = window.devgame.mechRideUiOutUpOffset.toFixed(2);
  });
  document.getElementById("devMechRideOutRightSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiOutRightOffset = parseInt(e.target.value) / 100;
    document.getElementById("devMechRideOutRightLabel").textContent = window.devgame.mechRideUiOutRightOffset.toFixed(2);
  });
  document.getElementById("devMechRideOutYawSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiOutYawOffset = parseInt(e.target.value);
    document.getElementById("devMechRideOutYawLabel").textContent = window.devgame.mechRideUiOutYawOffset + "°";
  });
  document.getElementById("devMechRideOutPitchSlider").addEventListener("input", (e) => {
    window.devgame.mechRideUiOutPitchOffset = parseInt(e.target.value);
    document.getElementById("devMechRideOutPitchLabel").textContent = window.devgame.mechRideUiOutPitchOffset + "°";
  });


})();


// --- ระบบปรับช่วงเสียงของหุ่นยนต์ (Mech Walk Sound Settings) ---
(function initDevMechSoundControl() {
  if (typeof window.mechWalkSoundLoopStart === "undefined") window.mechWalkSoundLoopStart = 6.69;
  if (typeof window.mechWalkSoundLoopEnd === "undefined") window.mechWalkSoundLoopEnd = 7.48;

  function mountGroup() {
    const mainControls = document.getElementById("mainControls");
    if (!mainControls) return false;
    if (document.getElementById("devMechSoundControlGroup")) return true;

    const group = document.createElement("div");
    group.className = "control-group";
    group.id = "devMechSoundControlGroup";
    group.style.border = "1.5px solid #28a745";
    group.style.borderRadius = "8px";
    group.style.background = "rgba(15, 22, 18, 0.95)";
    group.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
    group.style.padding = "10px";

    group.innerHTML = `
      <div style="font-weight: bold; color: #28a745; font-size: 13px; margin-bottom: 6px;">
        🤖 ปรับช่วงเสียงหุ่นเดิน (Mech Walk Sound Loop)
      </div>
      
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #dfb76c; margin-bottom: 8px; background: rgba(0,0,0,0.4); padding: 5px 8px; border-radius: 4px; border: 1px solid rgba(40, 167, 69, 0.2);">
        <span>ความยาวไฟล์เสียงทั้งหมด:</span>
        <span id="devMechSoundTotalDurationLabel" style="font-weight: bold; color: #ffffff;">-- s</span>
      </div>

      <!-- สไลเดอร์ช่วงเริ่มเสียง (หน้า) -->
      <div style="margin-top: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #eee;">
          <span>▶ ช่วงเริ่มเสียง (Start Time / Loop Start):</span>
          <span id="devMechSoundStartLabel" style="font-weight: bold; color: #28a745;">${window.mechWalkSoundLoopStart.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechSoundStartSlider" min="0" max="1000" value="${Math.round(window.mechWalkSoundLoopStart * 100)}" style="width: 100%; accent-color: #28a745;">
      </div>

      <!-- สไลเดอร์ช่วงสิ้นสุดเสียง (หลัง) -->
      <div style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #eee;">
          <span>⏹ ช่วงหยุดเล่นและวนซ้ำ (End Time / Loop End):</span>
          <span id="devMechSoundEndLabel" style="font-weight: bold; color: #dc3545;">${window.mechWalkSoundLoopEnd.toFixed(2)}</span>
        </div>
        <input type="range" id="devMechSoundEndSlider" min="0" max="1000" value="${Math.round(window.mechWalkSoundLoopEnd * 100)}" style="width: 100%; accent-color: #dc3545;">
      </div>

      <!-- Visual Progress Bar -->
      <div style="margin-top: 10px; height: 16px; background: rgba(0,0,0,0.6); border-radius: 8px; position: relative; overflow: hidden; border: 1px solid #333;">
         <div id="devMechSoundPlayRegion" style="position: absolute; height: 100%; background: linear-gradient(90deg, #28a745, #dc3545); opacity: 0.8; transition: all 0.1s ease;"></div>
      </div>

      <div style="margin-top: 12px; display: flex; justify-content: space-between;">
        <button id="devMechSoundTestBtn" style="flex: 1; padding: 6px; font-size: 11px; background: linear-gradient(135deg, #17a2b8, #138496); color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          ▶ ทดลองฟังเสียงหุ่น (Preview)
        </button>
        <button id="devMechSoundResetBtn" style="padding: 6px 10px; font-size: 11px; background: transparent; color: #28a745; border: 1px solid #28a745; border-radius: 4px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          ↺ รีเซ็ต (Reset)
        </button>
      </div>
    `;

    mainControls.appendChild(group);

    const startSlider = document.getElementById("devMechSoundStartSlider");
    const endSlider = document.getElementById("devMechSoundEndSlider");
    const startLabel = document.getElementById("devMechSoundStartLabel");
    const endLabel = document.getElementById("devMechSoundEndLabel");
    const durLabel = document.getElementById("devMechSoundTotalDurationLabel");
    const playRegion = document.getElementById("devMechSoundPlayRegion");
    const testBtn = document.getElementById("devMechSoundTestBtn");
    const resetBtn = document.getElementById("devMechSoundResetBtn");

    const updateVisualBar = (start, end, maxDur) => {
      if (!playRegion || maxDur <= 0) return;
      const startPct = (start / maxDur) * 100;
      const widthPct = ((end - start) / maxDur) * 100;
      playRegion.style.left = startPct + "%";
      playRegion.style.width = widthPct + "%";
    };

    const syncBufferDuration = (dur) => {
      window.mechWalkSoundBufferDuration = dur;
      if (durLabel) durLabel.textContent = dur.toFixed(2) + " s";
      
      const maxVal = Math.round(dur * 100);
      if (startSlider) {
        startSlider.max = maxVal;
        const curStart = (typeof window.mechWalkSoundLoopStart === "number") ? window.mechWalkSoundLoopStart : 6.69;
        startSlider.value = Math.round(curStart * 100);
      }
      if (endSlider) {
        endSlider.max = maxVal;
        const curEnd = (typeof window.mechWalkSoundLoopEnd === "number") ? window.mechWalkSoundLoopEnd : Math.min(7.48, dur);
        endSlider.value = Math.round(curEnd * 100);
      }
      const actualStart = (typeof window.mechWalkSoundLoopStart === "number") ? window.mechWalkSoundLoopStart : 6.69;
      const actualEnd = (typeof window.mechWalkSoundLoopEnd === "number") ? window.mechWalkSoundLoopEnd : Math.min(7.48, dur);
      if (startLabel) startLabel.textContent = actualStart.toFixed(2);
      if (endLabel) endLabel.textContent = actualEnd.toFixed(2);
      updateVisualBar(actualStart, actualEnd, dur);
    };

    const tryLoadAudioInfo = async () => {
      try {
        if (typeof window.getWoodenWheelsAudioBuffer === "function") {
          const ctx = (typeof audioCtx !== "undefined" && audioCtx) || (typeof window !== "undefined" && (window.audioCtx || window.audioContext)) || new (window.AudioContext || window.webkitAudioContext)();
          const buf = await window.getWoodenWheelsAudioBuffer(ctx);
          if (buf) syncBufferDuration(buf.duration);
        }
      } catch(e) {}
    };
    tryLoadAudioInfo();

    if (startSlider) {
      startSlider.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10) / 100;
        const dur = window.mechWalkSoundBufferDuration || 8.61;
        const endVal = endSlider ? (parseInt(endSlider.value, 10) / 100) : dur;
        if (val >= endVal) {
          val = Math.max(0, endVal - 0.05);
          startSlider.value = Math.round(val * 100);
        }
        window.mechWalkSoundLoopStart = val;
        if (startLabel) startLabel.textContent = val.toFixed(2);
        updateVisualBar(val, endVal, dur);
      });
    }

    if (endSlider) {
      endSlider.addEventListener("input", (e) => {
        let val = parseInt(e.target.value, 10) / 100;
        const dur = window.mechWalkSoundBufferDuration || 8.61;
        const startVal = startSlider ? (parseInt(startSlider.value, 10) / 100) : 0;
        if (val <= startVal) {
          val = startVal + 0.05;
          endSlider.value = Math.round(val * 100);
        }
        window.mechWalkSoundLoopEnd = val;
        if (endLabel) endLabel.textContent = val.toFixed(2);
        updateVisualBar(startVal, val, dur);
      });
    }

    if (testBtn) {
      testBtn.addEventListener("click", async () => {
        await tryLoadAudioInfo();
        if (typeof window.previewMechWalkSound === "function") {
          if (window.isMechPreviewWalkSoundActive && window.isMechPreviewWalkSoundActive()) {
            window.stopPreviewMechWalkSound();
            testBtn.innerHTML = "▶ ทดลองฟังเสียงหุ่น (Preview)";
            testBtn.style.backgroundImage = "linear-gradient(135deg, #17a2b8, #138496)";
          } else {
            const started = await window.previewMechWalkSound(true);
            if (started) {
              testBtn.innerHTML = "⏹ หยุดฟัง (Stop)";
              testBtn.style.backgroundImage = "linear-gradient(135deg, #dc3545, #c82333)";
            }
          }
        } else {
          if (typeof showNotice === "function") showNotice("ระบบเสียงกำลังโหลด...");
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const dur = window.mechWalkSoundBufferDuration || 8.61;
        window.mechWalkSoundLoopStart = 6.69;
        window.mechWalkSoundLoopEnd = Math.min(7.48, dur);
        if (startSlider) startSlider.value = 669;
        if (endSlider) endSlider.value = Math.round(Math.min(7.48, dur) * 100);
        if (startLabel) startLabel.textContent = "6.69";
        if (endLabel) endLabel.textContent = Math.min(7.48, dur).toFixed(2);
        updateVisualBar(6.69, Math.min(7.48, dur), dur);
        if (typeof showNotice === "function") showNotice("รีเซ็ตช่วงเสียงหุ่นเดินเป็น 6.69s - 7.48s แล้ว");
      });
    }

    return true;
  }

  if (!mountGroup()) {
    window.addEventListener("DOMContentLoaded", mountGroup);
    setTimeout(mountGroup, 500);
    setTimeout(mountGroup, 1500);
  }
})();
