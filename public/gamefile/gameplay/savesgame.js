// === SEEDPLANET MODULE: JS/SAVE.JS ===

      // ============================================
      // ระบบบันทึกและโหลดการตั้งค่า (Settings Save & Load System)
      // ============================================

      function rgbToHex(r, g, b) {
        const toHex = (c) => {
          const hex = Math.max(0, Math.min(255, Math.round(c * 255))).toString(
            16,
          );
          return hex.length === 1 ? "0" + hex : hex;
        };
        return "#" + toHex(r) + toHex(g) + toHex(b);
      }


      function saveSettingsToLocalStorage() {
        const currentFxaa = typeof window.fxaaEnabled !== "undefined"
          ? window.fxaaEnabled
          : (typeof fxaaEnabled !== "undefined"
            ? fxaaEnabled
            : (typeof window.taauEnabled !== "undefined"
              ? window.taauEnabled
              : (typeof taauEnabled !== "undefined" ? taauEnabled : true)));

        // บันทึกการตั้งค่าระบบ (Options Config เช่น เสียง, FXAA, Resolution) ลง LocalStorage เสมอ
        // เพื่อให้การตั้งค่าคงอยู่ไม่ว่าจะเล่นในโหมดปกติหรือโหมดผู้พัฒนา
        try {
          const optionsConfig = {
            sfxVolume,
            playerFootstepVolume,
            playerSwimVolume,
            collectSfxVolume,
            npcSfxVolume,
            sfxMuted,
            keyBindings: currentKeyBindings,
            gamepadBindings: (typeof currentGamepadBindings !== "undefined" ? currentGamepadBindings : (window.currentGamepadBindings || {})),
            renderScale,
            mouseSensitivity,
            showFps,
            targetFps,
            shadowMapEnabled,
            shadowMapQuality,
            antialiasEnabled,
            fxaaEnabled: currentFxaa,
            taauEnabled: currentFxaa,
            cameraMode,
            cameraCollisionEnabled,
            zoomLimitEnabled,
            ragdollEnabled,
            fullscreen: isCurrentFullscreen
          };
          localStorage.setItem("seedplanet_options_config", JSON.stringify(optionsConfig));
        } catch (e) {
          console.error("Failed to save options to localStorage:", e);
        }

        // ห้ามเซฟตัวเกม (ผู้เล่น/โลก) ลง LocalStorage โดยเด็ดขาด หากอยู่ในโหมดผู้พัฒนา (isDevMode = true)
        // Dev mode will NEVER save any player progress or world state to avoid overwriting normal player progress!
        if (typeof isDevMode !== 'undefined' && isDevMode) {
          if (!window.hasShownDevSaveWarning) {
            console.log("⚠️ โหมดผู้พัฒนาเปิดอยู่: ปิดระบบการบันทึกสถานะผู้เล่น/โลก (Dev mode is active: world progress saving is disabled)");
            window.hasShownDevSaveWarning = true;
          }
          return;
        }

        try {
          const settings = {
            sfxVolume,
            playerFootstepVolume,
            playerSwimVolume,
            collectSfxVolume,
            npcSfxVolume,
            sfxMuted,
            keyBindings: currentKeyBindings,
            renderScale,
            mouseSensitivity,
            showFps,
            targetFps,
            shadowMapEnabled,
            shadowMapQuality,
            antialiasEnabled,
            fxaaEnabled: currentFxaa,
            taauEnabled: currentFxaa,
            cameraMode,
            cameraCollisionEnabled,
            zoomLimitEnabled,
            ragdollEnabled,
            fullscreen: isCurrentFullscreen,

            // Planet parameters
            currentGridSize,
            RADIUS,
            globalSeed,

            waterEnabled,
            caveWaterEnabled,
            waterLevel,
            waterOpacity,
            waveStrength,
            waterColor,

            atmosphereEnabled,
            atmosphereAlpha,
            atmosphereScale,
            atmosphereColor,

            godRaysEnabled,
            godRaysAlpha,
            godRaysCount,
            godRaysColor,

            skyEnabled,
            skyGasIntensity,

            cloudsEnabled,
            cloudsAlpha,
            cloudsHeight,
            cloudsThickness,
            cloudsSpeed,
            cloudsShape,
            cloudsColor,

            playerSpeed,
            playerScale,
            natureSway,
            waterPlantSway,
            renderDistEnabled,
            renderDistValue,
            terrainRenderDistValue: typeof terrainRenderDistValue !== "undefined" ? terrainRenderDistValue : renderDistValue,
            objectRenderDistValue: typeof objectRenderDistValue !== "undefined" ? objectRenderDistValue : renderDistValue,

            charAnimFps,
            waterAnimFps,
            leafAnimFps,
            cloudAnimFps,

            // Player State
            inventory,
            actionSlotsItems,
            charTheta,
            charPhi,
            collectedCount,
            choppedTrees,
            destroyedRocks,
            playerHP,
            playerMaxHP,
            batteryStates: (typeof window.BatterySystem !== "undefined" && window.BatterySystem.exportState) ? window.BatterySystem.exportState() : null,
            collectiblesState: collectibles.filter(c => !c.isDynamic).map((c) => c.active),
            placedStructures: collectibles.filter(c => c.active && !c.isPreview && !c.isDynamic && (c.type === "wood_floor" || c.type === "thin_wood_floor" || c.type === "stone_floor" || c.type === "wood_stairs" || c.type === "folding_ladder" || c.type === "campfire" || c.type === "wood_wall" || c.type === "wood_window" || c.type === "wood_door" || c.type === "wood_roof" || c.type === "wood_chest" || c.type === "meganeura_item" || c.type === "isopod_item" || c.type === "wood_boat" || c.type === "wood_wheel" || c.type === "electric_engine" || c.type === "boat_wing")),
            dynamicCollectibles: collectibles.filter(c => c.isDynamic),
            amphibiansState: amphibians.map((a) => ({
              theta: a.theta,
              phi: a.phi,
              heading: a.heading,
              animPhase: a.animPhase,
              ragdollEnabled: a.ragdollEnabled,
              ragdollInitialized: a.ragdollInitialized,
              ragdollAxis: a.ragdollAxis,
              ragdollAngle: a.ragdollAngle,
              ragdollAngularSpeed: a.ragdollAngularSpeed,
              isSwimming: a.isSwimming,
              seed: a.seed,
              hp: a.hp,
              maxHp: a.maxHp,
            })),
            tunnels3D: tunnels3D,
            voxelHoleRadiusMultiplier,
          };

          if (activeSaveSlotId && typeof gameStarted !== "undefined" && gameStarted) {
            localStorage.setItem(activeSaveSlotId, JSON.stringify(settings));
          }
          localStorage.setItem("seedplanet_settings", JSON.stringify(settings));
        } catch (e) {
          console.error("Failed to save settings to localStorage:", e);
        }
      }
      window.saveSettingsToLocalStorage = saveSettingsToLocalStorage;

      function applySettings(settings, applySystemSettings = true, rebuildPlanet = false) {
        if (!settings) return;

        if (applySystemSettings) {
          // System & Audio
          if (typeof settings.sfxVolume === "number")
            sfxVolume = settings.sfxVolume;
          if (typeof settings.playerFootstepVolume === "number")
            playerFootstepVolume = settings.playerFootstepVolume;
          if (typeof settings.playerSwimVolume === "number")
            playerSwimVolume = settings.playerSwimVolume;
          if (typeof settings.collectSfxVolume === "number")
            collectSfxVolume = settings.collectSfxVolume;
          if (typeof settings.npcSfxVolume === "number")
            npcSfxVolume = settings.npcSfxVolume;
          if (typeof settings.sfxMuted === "boolean")
            sfxMuted = settings.sfxMuted;
          if (settings.keyBindings) {
            currentKeyBindings = {
              ...currentKeyBindings,
              ...settings.keyBindings,
            };
            renderKeyBindingsUI();
            if (typeof renderActionSlots === "function") renderActionSlots();
          }
          if (typeof settings.renderScale === "number") {
            renderScale = settings.renderScale;
            if (typeof resizeCanvas === 'function') {
              resizeCanvas();
            }
          }
          if (typeof settings.mouseSensitivity === "number") {
            mouseSensitivity = settings.mouseSensitivity;
            const sensSlider = document.getElementById("mouseSensitivitySlider");
            const sensVal = document.getElementById("mouseSensitivityVal");
            if (sensSlider && sensVal) {
              sensSlider.value = Math.round(mouseSensitivity * 100);
              sensVal.textContent = mouseSensitivity.toFixed(2) + "x";
            }
          }
          if (typeof settings.showFps === "boolean") {
            showFps = settings.showFps;
            if (typeof updateFpsToggleUI === 'function') updateFpsToggleUI();
          }
          if (typeof settings.targetFps === "number") {
            targetFps = settings.targetFps;
            frameTime = 1000 / targetFps;
            if (typeof updateFpsLimitUI === 'function') updateFpsLimitUI();
          }
          if (typeof settings.shadowMapEnabled === "boolean") {
            shadowMapEnabled = settings.shadowMapEnabled;
            if (typeof updateShadowMapUI === 'function') updateShadowMapUI(); if(typeof window.resizeShadowMap === 'function') window.resizeShadowMap();
          }
          if (typeof settings.shadowMapQuality === "number") {
            shadowMapQuality = Math.max(1, settings.shadowMapQuality);
            shadowMapEnabled = true;
            if (typeof updateShadowMapUI === 'function') updateShadowMapUI(); if(typeof window.resizeShadowMap === 'function') window.resizeShadowMap();
          }
          if (typeof settings.antialiasEnabled === "boolean") {
            antialiasEnabled = settings.antialiasEnabled;
            if (typeof window !== "undefined") window.antialiasEnabled = antialiasEnabled;
            if (typeof updateAntialiasUI === 'function') updateAntialiasUI();
          }
          if (typeof settings.fxaaEnabled === "boolean" || typeof settings.taauEnabled === "boolean") {
            const val = typeof settings.fxaaEnabled === "boolean" ? settings.fxaaEnabled : settings.taauEnabled;
            if (typeof fxaaEnabled !== "undefined") fxaaEnabled = val;
            if (typeof taauEnabled !== "undefined") taauEnabled = val;
            if (typeof window !== "undefined") {
              window.fxaaEnabled = val;
              window.taauEnabled = val;
            }
            if (typeof updateFxaaUI === 'function') updateFxaaUI();
            else if (typeof window.updateFxaaUI === 'function') window.updateFxaaUI();
            else if (typeof updateTaauUI === 'function') updateTaauUI();
            else if (typeof window.updateTaauUI === 'function') window.updateTaauUI();
          }
          if (typeof settings.fullscreen === "boolean") {
            isCurrentFullscreen = settings.fullscreen;
            if (isCurrentFullscreen) {
              setTimeout(enterFullscreen, 300);
            } else {
              const doc = document;
              const isFull = !!(
                doc.fullscreenElement ||
                doc.mozFullScreenElement ||
                doc.webkitFullscreenElement ||
                doc.msFullscreenElement
              );
              if (isFull) {
                setTimeout(exitFullscreen, 300);
              }
            }
          }
        }

        // Camera / Character Modes
        if (typeof settings.cameraMode === "string") {
          cameraMode = settings.cameraMode;
          if (cameraMode !== "tps" && cameraMode !== "thirdperson" && cameraMode !== "fps" && cameraMode !== "planet" && cameraMode !== "sun" && cameraMode !== "satellite" && !(cameraMode && cameraMode.startsWith("extra_planet_"))) {
            cameraMode = "thirdperson";
          }
          if (typeof setCameraMode === "function") {
            setCameraMode(cameraMode);
          } else {
            const toggleBtn = document.getElementById("cameraFollowToggle");
            const previewBtn = document.getElementById("cameraPreviewToggle");
            const fpsBtn = document.getElementById("devCameraFpsToggle");
            if (toggleBtn && previewBtn) {
              toggleBtn.classList.remove("active");
              previewBtn.classList.remove("active");
              if (fpsBtn) fpsBtn.classList.remove("active");
              
              if (cameraMode === "tps") {
                toggleBtn.classList.add("active");
              } else if (cameraMode === "fps") {
                if (fpsBtn) fpsBtn.classList.add("active");
              } else {
                previewBtn.classList.add("active");
              }
            }
          }
        }
        if (typeof settings.cameraCollisionEnabled === "boolean") {
          cameraCollisionEnabled = settings.cameraCollisionEnabled;
          const toggleBtn = document.getElementById("cameraCollisionToggle");
          if (toggleBtn) {
            toggleBtn.textContent = cameraCollisionEnabled
              ? "🛡️ ระบบกันกล้องชนวัตถุ: เปิด"
              : "🛡️ ระบบกันกล้องชนวัตถุ: ปิด";
            toggleBtn.classList.toggle("active", cameraCollisionEnabled);
          }
        }
        if (typeof settings.zoomLimitEnabled === "boolean") {
          zoomLimitEnabled = settings.zoomLimitEnabled;
          const toggleBtn = document.getElementById("zoomLimitToggle");
          if (toggleBtn) {
            toggleBtn.textContent = zoomLimitEnabled
              ? "🔍 จำกัดระยะซูมออก: เปิด"
              : "🔍 จำกัดระยะซูมออก: ปิด";
            toggleBtn.classList.toggle("active", zoomLimitEnabled);
          }
        }
        if (typeof settings.ragdollEnabled === "boolean") {
          ragdollEnabled = settings.ragdollEnabled;
          const toggleBtn = document.getElementById("ragdollToggle");
          if (toggleBtn) {
            toggleBtn.textContent = ragdollEnabled
              ? "🦴 โหมด Ragdoll: เปิด"
              : "🦴 โหมด Ragdoll: ปิด";
            toggleBtn.classList.toggle("active", ragdollEnabled);
          }
        }

        // Planet parameters
        let loadedRadius = 32.0;
        if (typeof settings.radius === "number" && settings.radius >= 4.0) {
          loadedRadius = settings.radius;
        } else if (typeof settings.currentGridSize === "number") {
          loadedRadius = Math.max(8.0, settings.currentGridSize / 12.5);
        }
        
        if (typeof window.updatePlanetRadiusAndHeightScale === "function") {
          window.updatePlanetRadiusAndHeightScale(loadedRadius);
        } else {
          RADIUS = loadedRadius;
          HEIGHT_SCALE = 0.6 * Math.pow(loadedRadius / 8.0, 0.7);
          if (typeof window !== "undefined") {
            window.RADIUS = RADIUS;
            window.HEIGHT_SCALE = HEIGHT_SCALE;
          }
        }

        if (typeof settings.currentGridSize === "number") {
          currentGridSize = settings.currentGridSize;
        } else {
          currentGridSize = Math.max(100, Math.min(1600, Math.round(RADIUS * 12.5)));
        }

        const input = document.getElementById("sizeInput");
        const display = document.getElementById("sizeDisplay");
        if (input) input.value = currentGridSize;
        if (display)
          display.textContent = currentGridSize + " x " + currentGridSize;
        
        const rInput = document.getElementById("radiusInput");
        const rDisplay = document.getElementById("radiusDisplay");
        if (rInput) rInput.value = RADIUS.toFixed(2);
        if (rDisplay) rDisplay.textContent = RADIUS.toFixed(2);
        if (typeof updateRadiusButtonStates === "function") updateRadiusButtonStates();
        
        if (typeof settings.globalSeed === "number") {
          window.globalSeed = settings.globalSeed; globalSeed = window.globalSeed;
        }

        // Water
        if (typeof settings.waterEnabled === "boolean") {
          waterEnabled = settings.waterEnabled;
          const toggleBtn = document.getElementById("waterToggle");
          if (toggleBtn) {
            toggleBtn.textContent = waterEnabled ? "🌊 น้ำ เปิด" : "🌊 น้ำ ปิด";
            toggleBtn.classList.toggle("active", waterEnabled);
          }
        }
        if (typeof settings.caveWaterEnabled === "boolean") {
          caveWaterEnabled = settings.caveWaterEnabled;
          const toggleBtn = document.getElementById("caveWaterToggle");
          if (toggleBtn) {
            toggleBtn.textContent = caveWaterEnabled ? "💧 น้ำในถ้ำ (Cave Water) เปิด" : "💧 น้ำในถ้ำ (Cave Water) ปิด";
            toggleBtn.classList.toggle("active", caveWaterEnabled);
          }
        }
        if (typeof settings.waterLevel === "number") {
          waterLevel = settings.waterLevel;
          const input = document.getElementById("waterLevel");
          const label = document.getElementById("waterLevelLabel");
          if (input) input.value = Math.round(waterLevel * 10);
          if (label) label.textContent = waterLevel.toFixed(2);
        }
        if (typeof settings.waterOpacity === "number") {
          waterOpacity = settings.waterOpacity;
          const input = document.getElementById("waterOpacity");
          const label = document.getElementById("waterOpacityLabel");
          if (input) input.value = Math.round(waterOpacity * 100);
          if (label) label.textContent = waterOpacity.toFixed(2);
        }
        if (typeof settings.waveStrength === "number") {
          waveStrength = settings.waveStrength;
          const input = document.getElementById("waveStrength");
          const label = document.getElementById("waveStrengthLabel");
          if (input) input.value = Math.round(waveStrength * 200);
          if (label) label.textContent = waveStrength.toFixed(3);
        }
        if (Array.isArray(settings.waterColor)) {
          waterColor = settings.waterColor;
          const picker = document.getElementById("waterColor");
          if (picker)
            picker.value = rgbToHex(
              waterColor[0],
              waterColor[1],
              waterColor[2],
            );
        }

        // Atmosphere
        if (typeof settings.atmosphereEnabled === "boolean") {
          atmosphereEnabled = settings.atmosphereEnabled;
          const toggleBtn = document.getElementById("atmosphereToggle");
          if (toggleBtn) {
            toggleBtn.textContent = atmosphereEnabled
              ? "✨ บรรยากาศ เปิด"
              : "✨ บรรยากาศ ปิด";
            toggleBtn.classList.toggle("active", atmosphereEnabled);
          }
        }
        if (typeof settings.atmosphereAlpha === "number") {
          atmosphereAlpha = settings.atmosphereAlpha;
          const input = document.getElementById("atmosphereAlpha");
          const label = document.getElementById("atmosphereAlphaLabel");
          if (input) input.value = Math.round(atmosphereAlpha * 100);
          if (label) label.textContent = atmosphereAlpha.toFixed(2);
        }
        if (typeof settings.atmosphereScale === "number") {
          atmosphereScale = settings.atmosphereScale;
          const input = document.getElementById("atmosphereScale");
          const label = document.getElementById("atmosphereScaleLabel");
          if (input) input.value = Math.round(atmosphereScale * 100);
          if (label) label.textContent = atmosphereScale.toFixed(2);
        }
        if (Array.isArray(settings.atmosphereColor)) {
          atmosphereColor = settings.atmosphereColor;
          const picker = document.getElementById("atmosphereColor");
          if (picker)
            picker.value = rgbToHex(
              atmosphereColor[0],
              atmosphereColor[1],
              atmosphereColor[2],
            );
        }

        // God Rays
        if (typeof settings.godRaysEnabled === "boolean") {
          godRaysEnabled = settings.godRaysEnabled;
          const toggleBtn = document.getElementById("godRaysToggle");
          if (toggleBtn) {
            toggleBtn.textContent = godRaysEnabled
              ? "☀️ ลำแสงเทวทูต (God Rays) เปิด"
              : "☀️ ลำแสงเทวทูต (God Rays) ปิด";
            toggleBtn.classList.toggle("active", godRaysEnabled);
          }
        }
        if (typeof settings.godRaysAlpha === "number") {
          godRaysAlpha = settings.godRaysAlpha;
          const input = document.getElementById("godRaysAlpha");
          const label = document.getElementById("godRaysAlphaLabel");
          if (input) input.value = Math.round(godRaysAlpha * 100);
          if (label) label.textContent = godRaysAlpha.toFixed(2);
        }
        if (typeof settings.godRaysCount === "number") {
          godRaysCount = settings.godRaysCount;
          const input = document.getElementById("godRaysCount");
          const label = document.getElementById("godRaysCountLabel");
          if (input) input.value = godRaysCount;
          if (label) label.textContent = godRaysCount;
        }
        if (Array.isArray(settings.godRaysColor)) {
          godRaysColor = settings.godRaysColor;
          const picker = document.getElementById("godRaysColor");
          if (picker)
            picker.value = rgbToHex(
              godRaysColor[0],
              godRaysColor[1],
              godRaysColor[2],
            );
        }

        // Sky
        if (typeof settings.skyEnabled === "boolean") {
          skyEnabled = settings.skyEnabled;
          const toggleBtn = document.getElementById("skyToggle");
          if (toggleBtn) {
            toggleBtn.textContent = skyEnabled
              ? "🌌 ท้องฟ้าอวกาศ เปิด"
              : "🌌 ท้องฟ้าอวกาศ ปิด";
            toggleBtn.classList.toggle("active", skyEnabled);
          }
        }
        if (typeof settings.skyGasIntensity === "number") {
          skyGasIntensity = settings.skyGasIntensity;
          const input = document.getElementById("skyGasIntensity");
          const label = document.getElementById("skyGasIntensityLabel");
          if (input) input.value = Math.round(skyGasIntensity * 100);
          if (label) label.textContent = skyGasIntensity.toFixed(2);
        }

        // Clouds
        if (typeof settings.cloudsEnabled === "boolean") {
          cloudsEnabled = settings.cloudsEnabled;
          const toggleBtn = document.getElementById("cloudsToggle");
          if (toggleBtn) {
            toggleBtn.textContent = cloudsEnabled
              ? "☁️ เมฆกลุ่มก๊าซ เปิด"
              : "☁️ เมฆกลุ่มก๊าซ ปิด";
            toggleBtn.classList.toggle("active", cloudsEnabled);
          }
        }
        if (typeof settings.cloudsAlpha === "number") {
          cloudsAlpha = settings.cloudsAlpha;
          const input = document.getElementById("cloudsAlpha");
          const label = document.getElementById("cloudsAlphaLabel");
          if (input) input.value = Math.round(cloudsAlpha * 100);
          if (label) label.textContent = cloudsAlpha.toFixed(2);
        }
        if (typeof settings.cloudsHeight === "number") {
          cloudsHeight = settings.cloudsHeight;
          const input = document.getElementById("cloudsHeight");
          const label = document.getElementById("cloudsHeightLabel");
          if (input) input.value = Math.round(cloudsHeight * 100);
          if (label) label.textContent = cloudsHeight.toFixed(2);
        }
        if (typeof settings.cloudsThickness === "number") {
          cloudsThickness = settings.cloudsThickness;
          const input = document.getElementById("cloudsThickness");
          const label = document.getElementById("cloudsThicknessLabel");
          if (input) input.value = Math.round(cloudsThickness * 100);
          if (label) label.textContent = cloudsThickness.toFixed(2);
        }
        if (typeof settings.cloudsSpeed === "number") {
          cloudsSpeed = settings.cloudsSpeed;
          const input = document.getElementById("cloudsSpeed");
          const label = document.getElementById("cloudsSpeedLabel");
          if (input) input.value = Math.round(cloudsSpeed * 100);
          if (label) label.textContent = cloudsSpeed.toFixed(2);
        }
        if (typeof settings.cloudsShape === "number") {
          cloudsShape = settings.cloudsShape;
          const input = document.getElementById("cloudsShape");
          const label = document.getElementById("cloudsShapeLabel");
          if (input) input.value = Math.round(cloudsShape * 100);
          if (label) label.textContent = cloudsShape.toFixed(2);
        }
        if (Array.isArray(settings.cloudsColor)) {
          cloudsColor = settings.cloudsColor;
          const picker = document.getElementById("cloudsColor");
          if (picker)
            picker.value = rgbToHex(
              cloudsColor[0],
              cloudsColor[1],
              cloudsColor[2],
            );
        }

        // Player Speed/Scale
        if (typeof settings.playerSpeed === "number") {
          playerSpeed = settings.playerSpeed;
          const input = document.getElementById("charSpeed");
          const label = document.getElementById("charSpeedLabel");
          if (input) input.value = Math.round(playerSpeed * 1000);
          if (label) label.textContent = playerSpeed.toFixed(4);
        }
        if (typeof settings.playerScale === "number") {
          playerScale = settings.playerScale;
          const input = document.getElementById("charScale");
          const label = document.getElementById("charScaleLabel");
          if (input) input.value = Math.round(playerScale * 100);
          if (label) label.textContent = playerScale.toFixed(2);
          
          // Auto-adjust action reach distance based on loaded playerScale
          actionReachDistance = playerScale * 1.5;
          const reachInput = document.getElementById("actionReachDist");
          const reachLabel = document.getElementById("actionReachLabel");
          if (reachInput) reachInput.value = actionReachDistance;
          if (reachLabel) reachLabel.textContent = actionReachDistance.toFixed(2);
        }

        // Sway/Wind
        if (typeof settings.natureSway === "number") {
          natureSway = settings.natureSway;
          const input = document.getElementById("leafSway");
          const label = document.getElementById("leafSwayLabel");
          if (input) input.value = Math.round(natureSway * 100);
          if (label) label.textContent = natureSway.toFixed(2);
        }
        if (typeof settings.waterPlantSway === "number") {
          waterPlantSway = settings.waterPlantSway;
          const input = document.getElementById("waterSway");
          const label = document.getElementById("waterSwayLabel");
          if (input) input.value = Math.round(waterPlantSway * 100);
          if (label) label.textContent = waterPlantSway.toFixed(2);
        }

        // Render Distance
        if (typeof settings.renderDistEnabled === "boolean") {
          renderDistEnabled = settings.renderDistEnabled;
          if (typeof window !== "undefined") window.renderDistEnabled = renderDistEnabled;
          const toggleBtn = document.getElementById("renderDistToggle");
          if (toggleBtn) {
            toggleBtn.textContent = renderDistEnabled
              ? "🛡️ จำกัดระยะเรนเดอร์: เปิด"
              : "🛡️ จำกัดระยะเรนเดอร์: ปิด";
            toggleBtn.classList.toggle("active", renderDistEnabled);
          }
        }
        if (typeof settings.terrainRenderDistValue === "number") {
          terrainRenderDistValue = settings.terrainRenderDistValue;
          renderDistValue = terrainRenderDistValue;
          if (typeof window !== "undefined" && typeof window.setTerrainRenderDist === "function") {
            window.setTerrainRenderDist(terrainRenderDistValue);
          } else {
            const input = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
            const label = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
            if (input) input.value = Math.round(terrainRenderDistValue * 10);
            if (label) label.textContent = terrainRenderDistValue.toFixed(2);
          }
        } else if (typeof settings.renderDistValue === "number") {
          terrainRenderDistValue = settings.renderDistValue;
          renderDistValue = settings.renderDistValue;
          const input = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
          const label = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
          if (input) input.value = Math.round(renderDistValue * 10);
          if (label) label.textContent = renderDistValue.toFixed(2);
        }

        if (typeof settings.objectRenderDistValue === "number") {
          objectRenderDistValue = settings.objectRenderDistValue;
          if (typeof window !== "undefined" && typeof window.setObjectRenderDist === "function") {
            window.setObjectRenderDist(objectRenderDistValue);
          } else {
            const input = document.getElementById("objectRenderDist");
            const label = document.getElementById("objectRenderDistLabel");
            if (input) input.value = Math.round(objectRenderDistValue * 10);
            if (label) label.textContent = objectRenderDistValue.toFixed(2);
          }
        } else if (typeof settings.renderDistValue === "number") {
          objectRenderDistValue = settings.renderDistValue;
          const input = document.getElementById("objectRenderDist");
          const label = document.getElementById("objectRenderDistLabel");
          if (input) input.value = Math.round(objectRenderDistValue * 10);
          if (label) label.textContent = objectRenderDistValue.toFixed(2);
        }

        if (typeof settings.voxelHoleRadiusMultiplier === "number") {
          voxelHoleRadiusMultiplier = settings.voxelHoleRadiusMultiplier;
          // If the loaded setting is exactly 1.0 (the old default), upgrade it to 2.0 once to match the new default!
          if (voxelHoleRadiusMultiplier === 1.0) {
            voxelHoleRadiusMultiplier = 2.0;
          }
          const input = document.getElementById("voxelHoleRadiusSlider");
          const label = document.getElementById("voxelHoleRadiusLabel");
          if (input) input.value = voxelHoleRadiusMultiplier;
          if (label) label.textContent = voxelHoleRadiusMultiplier.toFixed(1);
        }

        // Animation FPS
        if (typeof settings.charAnimFps === "number") {
          charAnimFps = settings.charAnimFps;
          const input = document.getElementById("charFps");
          const label = document.getElementById("charFpsLabel");
          if (input) input.value = charAnimFps;
          if (label) label.textContent = charAnimFps + " FPS";
        }
        if (typeof settings.waterAnimFps === "number") {
          waterAnimFps = settings.waterAnimFps;
          const input = document.getElementById("waterFps");
          const label = document.getElementById("waterFpsLabel");
          if (input) input.value = waterAnimFps;
          if (label) label.textContent = waterAnimFps + " FPS";
        }
        if (typeof settings.leafAnimFps === "number") {
          leafAnimFps = settings.leafAnimFps;
          const input = document.getElementById("leafFps");
          const label = document.getElementById("leafFpsLabel");
          if (input) input.value = leafAnimFps;
          if (label) label.textContent = leafAnimFps + " FPS";
        }
        if (typeof settings.cloudAnimFps === "number") {
          cloudAnimFps = settings.cloudAnimFps;
          const input = document.getElementById("cloudFps");
          const label = document.getElementById("cloudFpsLabel");
          if (input) input.value = cloudAnimFps;
          if (label) label.textContent = cloudAnimFps + " FPS";
        }

        // Sync Inventory Settings tab UI inputs
        syncInventorySettingsUI();

        // Player state
        if (Array.isArray(settings.inventory)) {
          inventory = settings.inventory;
          while (inventory.length < TOTAL_SLOTS) {
            inventory.push(null);
          }
          if (typeof renderInventory === "function") renderInventory();
          if (typeof updateBadge === "function") updateBadge();
        }
        if (Array.isArray(settings.actionSlotsItems)) {
          actionSlotsItems = settings.actionSlotsItems;
          while (actionSlotsItems.length < 8) {
            actionSlotsItems.push(null);
          }
          if (typeof renderActionSlots === "function") renderActionSlots();
        }
        if (typeof settings.charTheta === "number")
          charTheta = settings.charTheta;
        if (typeof settings.charPhi === "number") charPhi = settings.charPhi;
        
        if (typeof settings.playerHP === "number") {
          playerHP = settings.playerHP;
          if (typeof updatePlayerHPUI === "function") updatePlayerHPUI();
        }
        if (typeof settings.playerMaxHP === "number") {
          playerMaxHP = settings.playerMaxHP;
        }
        if (settings.collectedCount) {
          collectedCount = { ...settings.collectedCount };
        }

        if (settings.batteryStates && typeof window.BatterySystem !== "undefined" && window.BatterySystem.importState) {
          window.BatterySystem.importState(settings.batteryStates);
        }

        if (settings.choppedTrees !== undefined) {
          choppedTrees = settings.choppedTrees;
        }

        if (settings.destroyedRocks !== undefined) {
          destroyedRocks = settings.destroyedRocks;
        }

        if (settings.collectiblesState !== undefined) {
          savedCollectiblesState = settings.collectiblesState;
        }

        let dynamicCollectibles = settings.dynamicCollectibles;
        let placedStructures = settings.placedStructures;

        if (settings.amphibiansState !== undefined) {
          savedAmphibiansState = settings.amphibiansState;
        }

        if (Array.isArray(settings.tunnels3D)) {
          tunnels3D = settings.tunnels3D;
          tunnels3DGrid = null;
          keepLoadedTunnels = true;
          rebuildTunnelBuffers();
        }

        // Rebuild planet with settings
        if (gameStarted && rebuildPlanet === true) {
          buildPlanet(currentGridSize, globalSeed);
          if (waterEnabled) buildWaterSphere(currentGridSize);
          buildAtmosphereSphere(currentGridSize);
          
          if (Array.isArray(placedStructures) && placedStructures.length > 0) {
            placedStructures.forEach(p => {
              p.isPreview = false;
              if (p.type === "wood_boat") {
                  p.isDynamic = true;
              } else {
                  p.isDynamic = false;
              }
              const type = p.type;
              if (type === "stone_floor" || type === "wood_floor" || type === "thin_wood_floor" || type === "wood_wall" || type === "wood_window" || type === "wood_door" || type === "campfire") {
                  const rad = getSuppressRadius(type, p.size);
                  suppressGrassUnder(p.position, rad);
              }
            });
            collectibles = collectibles.concat(placedStructures);
          }
          
          if (Array.isArray(dynamicCollectibles) && dynamicCollectibles.length > 0) {
            collectibles = collectibles.concat(dynamicCollectibles);
          }

          window.collectibles = collectibles;
          
          refreshCollectiblesVBO();
        }
      }

      const DEFAULT_SETTINGS = {
        sfxVolume: 0.5,
        playerFootstepVolume: 0.0,
        playerSwimVolume: 0.09,
        collectSfxVolume: 0.2,
        npcSfxVolume: 0.5,
        sfxMuted: false,
        keyBindings: {
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
        },
        renderScale: /Android/i.test(navigator.userAgent) ? 0.25 : 1.0,
        mouseSensitivity: 1,
        showFps: true,
        targetFps: /Android/i.test(navigator.userAgent) ? 30 : 120,
        shadowMapEnabled: true,
        shadowMapQuality: /Android/i.test(navigator.userAgent) ? 1 : 2,
        antialiasEnabled: false,
        fxaaEnabled: true,
        taauEnabled: true,
        cameraMode: "tps",
        cameraCollisionEnabled: true,
        zoomLimitEnabled: true,
        ragdollEnabled: false,
        currentGridSize: 400,
        RADIUS: 8.0,
        globalSeed: 13585,
        waterEnabled: true,
        caveWaterEnabled: true,
        waterLevel: 0,
        waterOpacity: 0.4,
        waveStrength: 0.02,
        waterColor: [0, 0.4, 0.667],
        atmosphereEnabled: true,
        atmosphereAlpha: 0.6,
        atmosphereScale: 2.5,
        atmosphereColor: [0.3, 0.58, 1],
        skyEnabled: true,
        skyGasIntensity: 0.75,
        cloudsEnabled: true,
        cloudsAlpha: 0.55,
        cloudsHeight: 12.0,
        cloudsThickness: 0.93,
        cloudsSpeed: 0.2,
        cloudsShape: 1,
        cloudsColor: [1, 1, 1],
        godRaysEnabled: false,
        godRaysAlpha: 0.0,
        godRaysCount: 0,
        godRaysColor: [1.0, 0.92, 0.75],
        playerSpeed: 0.005,
        playerScale: 0.1,
        natureSway: 1,
        waterPlantSway: 1,
        renderDistEnabled: true,
        renderDistValue: 15.0,
        terrainRenderDistValue: 15.0,
        objectRenderDistValue: 5.0,
        charAnimFps: 30,
        waterAnimFps: 30,
        leafAnimFps: 30,
        cloudAnimFps: 30,
        voxelHoleRadiusMultiplier: 2.0, // ค่าเริ่มต้นขนาดหลุมสร้างอุโมงค์เมื่อเข้าเกมใหม่หรือโหมด Dev
      };

      async function tryLoadSettingsOnStartup() {
        try {
          let settingsObj = {};
          const saved = localStorage.getItem("seedplanet_settings");
          if (saved) {
            settingsObj = JSON.parse(saved);
            if (settingsObj) {
              if (settingsObj.RADIUS === 2.5 || settingsObj.RADIUS === 3.6 || settingsObj.RADIUS === 32.0) {
                settingsObj.RADIUS = 8.0;
              }
              if (settingsObj.currentGridSize === 180 || settingsObj.currentGridSize === 1600 || settingsObj.currentGridSize === 500) {
                settingsObj.currentGridSize = 400;
              }
            }
          } else {
            settingsObj = { ...DEFAULT_SETTINGS };
          }

          // โหลดเฉพาะตัวเลือกตั้งค่าระบบที่บันทึกแยกไว้มาทับ (เพื่อให้ตั้งค่าต่างๆ คงอยู่แม้จะปิด/เปิดใหม่ หรือเล่นใน Dev mode)
          const savedOptions = localStorage.getItem("seedplanet_options_config");
          if (savedOptions) {
            try {
              const parsedOptions = JSON.parse(savedOptions);
              if (parsedOptions) {
                settingsObj = {
                  ...settingsObj,
                  ...parsedOptions
                };
              }
            } catch (e) {
              console.error("Failed to parse seedplanet_options_config:", e);
            }
          }

          applySettings(settingsObj);
          return true;
        } catch (e) {
          console.error(
            "Failed to load settings from localStorage on startup:",
            e,
          );
        }
        return false;
      }

      // Hook saving to UI inputs
      function initSettingsAutoSaveHooks() {
        const inputIds = [
          "sfxVolumeSlider",
          "playerFootstepVolumeSlider",
          "playerSwimVolumeSlider",
          "collectSfxVolumeSlider",
          "npcSfxVolumeSlider",
          "renderScaleSlider",
          "mouseSensitivitySlider",
          "sizeInput",
          "radiusInput",
          "waterLevel",
          "waterOpacity",
          "waveStrength",
          "waterColor",
          "atmosphereAlpha",
          "atmosphereScale",
          "atmosphereColor",
          "skyGasIntensity",
          "cloudsAlpha",
          "cloudsHeight",
          "cloudsThickness",
          "cloudsSpeed",
          "cloudsShape",
          "cloudsColor",
          "charSpeed",
          "charScale",
          "leafSway",
          "waterSway",
          "renderDist",
          "terrainRenderDist",
          "objectRenderDist",
          "devTerrainRenderDistSlider",
          "devObjectRenderDistSlider",
          "charFps",
          "waterFps",
          "leafFps",
          "cloudFps",
        ];

        const clickIds = [
          "sfxMuteToggle",
          "setModeWindowed",
          "setModeFullscreen",
          "fpsToggleOn",
          "fpsToggleOff",
          "fxaaToggleOn",
          "fxaaToggleOff",
          "taauToggleOn",
          "taauToggleOff",
          "antialiasToggleOn",
          "antialiasToggleOff",
          "cameraFollowToggle",
          "cameraCollisionToggle",
          "zoomLimitToggle",
          "ragdollToggle",
          "waterToggle",
          "atmosphereToggle",
          "skyToggle",
          "cloudsToggle",
          "renderDistToggle",
        ];

        inputIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el?.addEventListener("change", saveSettingsToLocalStorage);
            el?.addEventListener("input", saveSettingsToLocalStorage);
          }
        });

        clickIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el?.addEventListener("click", () => {
              // Small timeout to let original click handler finish state changes
              setTimeout(saveSettingsToLocalStorage, 50);
            });
          }
        });
      }

      // Export settings to JSON file
      function exportSettingsToFile() {
        try {
          const settings = {
            sfxVolume,
            sfxMuted,
            renderScale,
            mouseSensitivity,
            showFps,
            targetFps,
            cameraMode,
            cameraCollisionEnabled,
            zoomLimitEnabled,
            ragdollEnabled,
            currentGridSize,
            RADIUS,
            globalSeed,
            waterEnabled,
            waterLevel,
            waterOpacity,
            waveStrength,
            waterColor,
            atmosphereEnabled,
            atmosphereAlpha,
            atmosphereScale,
            atmosphereColor,
            godRaysEnabled,
            godRaysAlpha,
            godRaysCount,
            godRaysColor,
            skyEnabled,
            skyGasIntensity,
            cloudsEnabled,
            cloudsAlpha,
            cloudsHeight,
            cloudsThickness,
            cloudsSpeed,
            cloudsShape,
            cloudsColor,
            playerSpeed,
            playerScale,
            natureSway,
            waterPlantSway,
            renderDistEnabled,
            renderDistValue,
            terrainRenderDistValue: typeof terrainRenderDistValue !== "undefined" ? terrainRenderDistValue : renderDistValue,
            objectRenderDistValue: typeof objectRenderDistValue !== "undefined" ? objectRenderDistValue : renderDistValue,
            charAnimFps,
            waterAnimFps,
            leafAnimFps,
            cloudAnimFps,
          };
          const dataStr =
            "data:text/json;charset=utf-8," +
            encodeURIComponent(JSON.stringify(settings, null, 4));
          const downloadAnchor = document.createElement("a");
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute(
            "download",
            `seedplanet_settings_profile_${globalSeed}.json`,
          );
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        } catch (e) {
          alert("เกิดข้อผิดพลาดในการส่งออกไฟล์: " + e.message);
        }
      }

      const SAVE_SLOTS = [
        { id: "seedplanet_save_1", label: "เซฟช่องที่ 1 (Save Slot 1)" },
        { id: "seedplanet_save_2", label: "เซฟช่องที่ 2 (Save Slot 2)" },
        { id: "seedplanet_save_3", label: "เซฟช่องที่ 3 (Save Slot 3)" },
        { id: "seedplanet_save_4", label: "เซฟช่องที่ 4 (Save Slot 4)" },
      ];

      function getSlotData(slotId) {
        try {
          const saved = localStorage.getItem(slotId);
          if (saved) {
            return JSON.parse(saved);
          }
        } catch (e) {
          console.error("Failed to parse save data for " + slotId, e);
        }
        return null;
      }

      let lastSaveSelectorOpenedTime = 0;

      function openSaveSelector() {
        lastSaveSelectorOpenedTime = Date.now();
        const selectOverlay = document.getElementById("saveSelectOverlay");
        if (selectOverlay) {
          selectOverlay.classList.add("open");
        }
        renderSaveSlots();
        if (typeof updateCustomScrollbar === "function") {
          setTimeout(updateCustomScrollbar, 30);
        } else if (typeof window.updateCustomScrollbar === "function") {
          setTimeout(window.updateCustomScrollbar, 30);
        }
      }
      window.openSaveSelector = openSaveSelector;

      function closeSaveSelector() {
        const selectOverlay = document.getElementById("saveSelectOverlay");
        if (selectOverlay) {
          selectOverlay.classList.remove("open");
        }
        const track = document.getElementById("saveSelectCustomScrollbar");
        if (track) track.style.display = "none";
      }
      window.closeSaveSelector = closeSaveSelector;

      function renderSaveSlots() {
        const listContainer = document.getElementById("saveSlotsList");
        if (!listContainer) return;

        let html = "";
        for (let i = 0; i < SAVE_SLOTS.length; i++) {
          const slot = SAVE_SLOTS[i];
          const data = getSlotData(slot.id);
          const isEmpty = data === null;

          const slotTitle = (typeof t === "function" && t("save_slot_n")) 
            ? t("save_slot_n").replace("{n}", i + 1)
            : `เซฟช่องที่ ${i + 1} (Save Slot ${i + 1})`;

          const emptyText = typeof t === "function" ? t("slot_empty") : "[ ว่าง / New Game ]";
          const loadedText = typeof t === "function" ? t("slot_loaded") : "[ มีข้อมูล / Loaded ]";

          const statusText = isEmpty
            ? `<span style="color: #fca5a5; font-weight: bold;">${emptyText}</span>`
            : `<span style="color: #86efac; font-weight: bold;">${loadedText}</span>`;

          let description = "";
          if (isEmpty) {
            description = typeof t === "function" ? t("slot_empty_desc") : "สร้างดวงดาวใหม่ด้วยขนาดและข้อมูลเริ่มต้น";
          } else {
            const gridSize = data.currentGridSize || 400;
            const seed = data.globalSeed || 13585;
            const rock =
              data.collectedCount && data.collectedCount.rock !== undefined
                ? data.collectedCount.rock
                : 0;
            const branch =
              data.collectedCount && data.collectedCount.branch !== undefined
                ? data.collectedCount.branch
                : 0;
            if (typeof t === "function" && t("slot_loaded_desc")) {
              description = t("slot_loaded_desc")
                .replace("{size}", gridSize)
                .replace("{seed}", seed)
                .replace("{rock}", rock)
                .replace("{branch}", branch);
            } else {
              description = `ขนาด: ${gridSize} | Seed: ${seed} | หิน: ${rock}, กิ่งไม้: ${branch}`;
            }
          }

          const deleteBtnText = typeof t === "function" ? t("delete_save") || "ลบเซฟ" : "ลบเซฟ (Delete)";

          html += `
            <div class="save-slot-row" data-slot-id="${slot.id}" style="display: flex; align-items: stretch; gap: 8px; width: 100%;">
              <div class="save-slot-card game-ui"  
                   data-slot-id="${slot.id}"
                   onmouseover="this.style.background='rgba(223, 183, 108, 0.15)'; this.style.borderColor='#dfb76c'; this.style.boxShadow='0 0 12px rgba(223, 183, 108, 0.15)';" 
                   onmouseout="this.style.background='rgba(223, 183, 108, 0.05)'; this.style.borderColor='rgba(223, 183, 108, 0.25)'; this.style.boxShadow='none';"
                   onclick="selectSaveSlotAndStart('${slot.id}')" 
                   style="flex: 1; min-width: 0; background: rgba(223, 183, 108, 0.05); border: 1px solid rgba(223, 183, 108, 0.25); padding: 12px 14px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: auto;">
                  <span style="color: #dfb76c; font-weight: bold; font-size: 14px; text-shadow: 0 0 4px rgba(223, 183, 108, 0.3); font-family: 'Google Sans', sans-serif;">${slotTitle}</span>
                  <span style="font-size: 11px; font-family: 'Google Sans', sans-serif;">${statusText}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; color: rgba(255,255,255,0.7); font-size: 11px; font-family: 'Google Sans', sans-serif;">
                  <span style="color: rgba(255,255,255,0.45); font-size: 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px; margin-top: -2px;"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg> LocalStorage KEY: ${slot.id}</span>
                  <span style="color: rgba(255,255,255,0.8);">${description}</span>
                </div>
              </div>
              ${!isEmpty ? `
                <button class="save-slot-delete-btn game-ui"
                        id="btnDeleteSave_${slot.id}"
                        data-slot-id="${slot.id}"
                        onclick="event.preventDefault(); event.stopPropagation(); deleteSaveSlot('${slot.id}', this, event)"
                        title="${deleteBtnText}"
                        style="width: 76px; flex-shrink: 0; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 6px; font-size: 10px; font-family: 'Google Sans', sans-serif; cursor: pointer; transition: all 0.2s; font-weight: bold;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>${deleteBtnText}</span>
                </button>
              ` : ''}
            </div>
          `;
        }
        listContainer.innerHTML = html;

        if (typeof updateCustomScrollbar === "function") {
          setTimeout(updateCustomScrollbar, 20);
        } else if (typeof window.updateCustomScrollbar === "function") {
          setTimeout(window.updateCustomScrollbar, 20);
        }
      }

      function deleteSaveSlot(slotId, buttonElement, e) {
        if (e) {
          if (typeof e.preventDefault === "function") e.preventDefault();
          if (typeof e.stopPropagation === "function") e.stopPropagation();
          if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        }
        window.lastDeleteSaveSlotTime = Date.now();
        if (!buttonElement) return;
        if (buttonElement.dataset.confirm === "true") {
          localStorage.removeItem(slotId);
          renderSaveSlots();
          if (window.GamepadController && typeof window.GamepadController.applyUIFocus === "function") {
            window.GamepadController.uiNav.saveCol = 0;
            setTimeout(() => {
              window.GamepadController.applyUIFocus();
            }, 50);
          }
        } else {
          buttonElement.dataset.confirm = "true";
          buttonElement.textContent = typeof t === "function" ? (t("confirm_delete") || "ยืนยันลบ?") : "ยืนยันลบ? (Confirm)";
          buttonElement.style.background = "rgba(239, 68, 68, 0.4)";
          buttonElement.style.borderColor = "#ef4444";
          buttonElement.style.color = "#ffffff";

          setTimeout(() => {
            if (buttonElement && buttonElement.dataset.confirm === "true") {
              buttonElement.dataset.confirm = "false";
              buttonElement.textContent = typeof t === "function" ? (t("delete_save") || "ลบเซฟ") : "ลบเซฟ (Delete)";
              buttonElement.style.background = "rgba(239, 68, 68, 0.15)";
              buttonElement.style.borderColor = "rgba(239, 68, 68, 0.4)";
              buttonElement.style.color = "#fca5a5";
            }
          }, 3000);
        }
      }
      deleteSaveSlot = deleteSaveSlot;

      function selectSaveSlotAndStart(slotId) {
        if (window.lastDeleteSaveSlotTime && Date.now() - window.lastDeleteSaveSlotTime < 500) {
          return;
        }
        if (Date.now() - lastSaveSelectorOpenedTime < 350) {
          return;
        }
        activeSaveSlotId = slotId;
        const data = getSlotData(slotId);

        closeSaveSelector();
        startGameWithSlot(data);
      }
      selectSaveSlotAndStart = selectSaveSlotAndStart;

      // คืนค่าเริ่มต้น (Restore Defaults)
      function initRestoreDefaultsHandler() {
        const btnRestore = document.getElementById("btnRestoreDefaults");
        if (btnRestore) {
          btnRestore?.addEventListener("click", () => {
            // คืนค่าเฉพาะการตั้งค่าระบบ ปุ่มควบคุม กราฟิก และเสียง โดยไม่แตะต้องโลกหรือข้อมูลการเล่น (ไม่มีการเรียก buildPlanet)
            sfxVolume = DEFAULT_SETTINGS.sfxVolume;
            playerFootstepVolume = DEFAULT_SETTINGS.playerFootstepVolume;
            playerSwimVolume = DEFAULT_SETTINGS.playerSwimVolume;
            collectSfxVolume = DEFAULT_SETTINGS.collectSfxVolume;
            npcSfxVolume = DEFAULT_SETTINGS.npcSfxVolume;
            sfxMuted = DEFAULT_SETTINGS.sfxMuted;

            currentKeyBindings = { ...DEFAULT_SETTINGS.keyBindings };
            renderKeyBindingsUI();
            if (typeof renderActionSlots === "function") renderActionSlots();

            renderScale = DEFAULT_SETTINGS.renderScale;
            if (typeof resizeCanvas === "function") resizeCanvas();

            mouseSensitivity = DEFAULT_SETTINGS.mouseSensitivity;
            const sensSlider = document.getElementById("mouseSensitivitySlider");
            const sensVal = document.getElementById("mouseSensitivityVal");
            if (sensSlider && sensVal) {
              sensSlider.value = Math.round(mouseSensitivity * 100);
              sensVal.textContent = mouseSensitivity.toFixed(2) + "x";
            }

            showFps = DEFAULT_SETTINGS.showFps;
            if (typeof updateFpsToggleUI === "function") updateFpsToggleUI();

            targetFps = DEFAULT_SETTINGS.targetFps;
            frameTime = 1000 / targetFps;
            if (typeof updateFpsLimitUI === "function") updateFpsLimitUI();

            shadowMapEnabled = DEFAULT_SETTINGS.shadowMapEnabled;
            shadowMapQuality = DEFAULT_SETTINGS.shadowMapQuality;
            if (typeof updateShadowMapUI === "function") updateShadowMapUI();
            if (typeof window.resizeShadowMap === "function") window.resizeShadowMap();

            antialiasEnabled = DEFAULT_SETTINGS.antialiasEnabled;
            if (typeof window !== "undefined") window.antialiasEnabled = antialiasEnabled;
            if (typeof updateAntialiasUI === "function") updateAntialiasUI();

            const defaultFxaa = typeof DEFAULT_SETTINGS.fxaaEnabled !== "undefined" ? DEFAULT_SETTINGS.fxaaEnabled : (typeof DEFAULT_SETTINGS.taauEnabled !== "undefined" ? DEFAULT_SETTINGS.taauEnabled : true);
            if (typeof fxaaEnabled !== "undefined") fxaaEnabled = defaultFxaa;
            if (typeof taauEnabled !== "undefined") taauEnabled = defaultFxaa;
            if (typeof window !== "undefined") {
              window.fxaaEnabled = defaultFxaa;
              window.taauEnabled = defaultFxaa;
            }
            if (typeof updateFxaaUI === "function") updateFxaaUI();
            else if (typeof updateTaauUI === "function") updateTaauUI();

            cameraMode = DEFAULT_SETTINGS.cameraMode;
            if (typeof setCameraMode === "function") {
              setCameraMode(cameraMode);
            }
            cameraCollisionEnabled = DEFAULT_SETTINGS.cameraCollisionEnabled;
            const colBtn = document.getElementById("cameraCollisionToggle");
            if (colBtn) {
              colBtn.textContent = cameraCollisionEnabled
                ? "🛡️ ระบบกันกล้องชนวัตถุ: เปิด"
                : "🛡️ ระบบกันกล้องชนวัตถุ: ปิด";
              colBtn.classList.toggle("active", cameraCollisionEnabled);
            }

            zoomLimitEnabled = DEFAULT_SETTINGS.zoomLimitEnabled;
            const zoomBtn = document.getElementById("zoomLimitToggle");
            if (zoomBtn) {
              zoomBtn.textContent = zoomLimitEnabled
                ? "🔍 จำกัดระยะซูมออก: เปิด"
                : "🔍 จำกัดระยะซูมออก: ปิด";
              zoomBtn.classList.toggle("active", zoomLimitEnabled);
            }

            ragdollEnabled = DEFAULT_SETTINGS.ragdollEnabled;
            const ragBtn = document.getElementById("ragdollToggle");
            if (ragBtn) {
              ragBtn.textContent = ragdollEnabled
                ? "🦴 โหมด Ragdoll: เปิด"
                : "🦴 โหมด Ragdoll: ปิด";
              ragBtn.classList.toggle("active", ragdollEnabled);
            }

            natureSway = DEFAULT_SETTINGS.natureSway;
            const leafInput = document.getElementById("leafSway");
            const leafLabel = document.getElementById("leafSwayLabel");
            if (leafInput) leafInput.value = Math.round(natureSway * 100);
            if (leafLabel) leafLabel.textContent = natureSway.toFixed(2);

            waterPlantSway = DEFAULT_SETTINGS.waterPlantSway;
            const waterInput = document.getElementById("waterSway");
            const waterLabel = document.getElementById("waterSwayLabel");
            if (waterInput) waterInput.value = Math.round(waterPlantSway * 100);
            if (waterLabel) waterLabel.textContent = waterPlantSway.toFixed(2);

            renderDistEnabled = DEFAULT_SETTINGS.renderDistEnabled;
            if (typeof window !== "undefined") window.renderDistEnabled = renderDistEnabled;
            const rdToggle = document.getElementById("renderDistToggle");
            if (rdToggle) {
              rdToggle.textContent = renderDistEnabled
                ? "🛡️ จำกัดระยะเรนเดอร์: เปิด"
                : "🛡️ จำกัดระยะเรนเดอร์: ปิด";
              rdToggle.classList.toggle("active", renderDistEnabled);
            }

            terrainRenderDistValue = DEFAULT_SETTINGS.terrainRenderDistValue;
            renderDistValue = terrainRenderDistValue;
            if (typeof window !== "undefined" && typeof window.setTerrainRenderDist === "function") {
              window.setTerrainRenderDist(terrainRenderDistValue);
            }
            const trInput = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
            const trLabel = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
            if (trInput) trInput.value = Math.round(terrainRenderDistValue * 10);
            if (trLabel) trLabel.textContent = terrainRenderDistValue.toFixed(2);

            objectRenderDistValue = DEFAULT_SETTINGS.objectRenderDistValue;
            if (typeof window !== "undefined" && typeof window.setObjectRenderDist === "function") {
              window.setObjectRenderDist(objectRenderDistValue);
            }
            const objInput = document.getElementById("objectRenderDist");
            const objLabel = document.getElementById("objectRenderDistLabel");
            if (objInput) objInput.value = Math.round(objectRenderDistValue * 10);
            if (objLabel) objLabel.textContent = objectRenderDistValue.toFixed(2);

            charAnimFps = DEFAULT_SETTINGS.charAnimFps;
            waterAnimFps = DEFAULT_SETTINGS.waterAnimFps;
            leafAnimFps = DEFAULT_SETTINGS.leafAnimFps;
            cloudAnimFps = DEFAULT_SETTINGS.cloudAnimFps;
            const cFps = document.getElementById("charFps"); if (cFps) cFps.value = charAnimFps;
            const cFpsLbl = document.getElementById("charFpsLabel"); if (cFpsLbl) cFpsLbl.textContent = charAnimFps + " FPS";
            const wFps = document.getElementById("waterFps"); if (wFps) wFps.value = waterAnimFps;
            const wFpsLbl = document.getElementById("waterFpsLabel"); if (wFpsLbl) wFpsLbl.textContent = waterAnimFps + " FPS";
            const lFps = document.getElementById("leafFps"); if (lFps) lFps.value = leafAnimFps;
            const lFpsLbl = document.getElementById("leafFpsLabel"); if (lFpsLbl) lFpsLbl.textContent = leafAnimFps + " FPS";
            const clFps = document.getElementById("cloudFps"); if (clFps) clFps.value = cloudAnimFps;
            const clFpsLbl = document.getElementById("cloudFpsLabel"); if (clFpsLbl) clFpsLbl.textContent = cloudAnimFps + " FPS";

            if (typeof syncInventorySettingsUI === "function") syncInventorySettingsUI();
            if (typeof updateSettingsTogglesUI === "function") updateSettingsTogglesUI();
            if (typeof updateUIMargins === "function") {
              if (typeof uiMargin !== "undefined") uiMargin = 10;
              const uiMarginDistSlider = document.getElementById("uiMarginDist");
              const uiMarginLabel = document.getElementById("uiMarginLabel");
              if (uiMarginDistSlider) uiMarginDistSlider.value = 10;
              if (uiMarginLabel) uiMarginLabel.textContent = "10";
              updateUIMargins();
            }

            saveSettingsToLocalStorage();

            // Visual feedback
            const originalText = btnRestore.innerHTML;
            btnRestore.innerHTML = "🔄 คืนค่าเริ่มต้นเรียบร้อยแล้ว!";
            btnRestore.style.color = "#34d399";
            setTimeout(() => {
              btnRestore.innerHTML = originalText;
              btnRestore.style.color = "#fca5a5";
            }, 2000);
          });
        }

        const btnExitToMenu = document.getElementById("btnExitToMenu");
        if (btnExitToMenu) {
          btnExitToMenu?.addEventListener("click", () => {
            saveSettingsToLocalStorage();

            const fade = document.getElementById("fadeToBlack");
            if (fade) fade.style.opacity = "1";

            setTimeout(() => {
              window.location.reload();
            }, 1500); // Wait for fade out
          });
        }
      }


