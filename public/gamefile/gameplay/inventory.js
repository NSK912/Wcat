// === SEEDPLANET MODULE: JS/INVENTORY.JS ===

      // ============================================
      // ระบบกระเป๋า (Inventory System)
      // ============================================
      const TOTAL_SLOTS = 20;
      const UNLOCKED_SLOTS = 10;

      let inventory = [];
      for (let i = 0; i < TOTAL_SLOTS; i++) {
        inventory.push(null);
      }
      let actionSlotsItems = new Array(8).fill(null);
      let isMoveModeEnabled = false;
      let selectedActionSlotIndex = -1;

      // ============================================
      // ระบบพลังงานแบตเตอรี่หินเรืองแสง (Glow Battery Energy Points System)
      // ============================================
      // ใช้ระบบแต้มพลังงาน (Energy Points) เช่นเดียวกับระบบแต้ม HP ของผู้เล่น
      // ความจุเต็ม = 72,000 แต้ม (ใช้งานขับขี่ได้เต็ม 20 นาที ที่ 60 ticks/วินาที)
      // แต้มรีเจนเต็ม = 18,000 แต้ม (ใช้เวลารีเจน 5 นาที ที่ 60 ticks/วินาที)
      // แบตเตอรี่ที่หมดพลังงาน = รอรีเจนสะสมแต้มจนเต็ม 18,000 แต้ม แล้วจะกลับมา 72,000 แต้มพร้อมใช้งาน
      window.BatterySystem = {
        MAX_CHARGE: 72000,     // 72,000 แต้มพลังงาน (เทียบเท่าขับต่อเนื่อง 20 นาที)
        REGEN_TIME: 18000,     // 18,000 แต้มรีเจน (เทียบเท่ารีเจน 5 นาที)
        activeCharge: 72000,
        _lastNoticeTime: 0,

        getTotalBatteryCount() {
          let count = 0;
          if (typeof inventory !== "undefined" && Array.isArray(inventory)) {
            for (let item of inventory) {
              if (item && (item.name === "GLOW_BATTERY" || item.label === "GLOW_BATTERY")) count += (item.count || 1);
            }
          }
          if (typeof actionSlotsItems !== "undefined" && Array.isArray(actionSlotsItems)) {
            for (let item of actionSlotsItems) {
              if (item && (item.name === "GLOW_BATTERY" || item.label === "GLOW_BATTERY")) count += (item.count || 1);
            }
          }
          return count;
        },

        getTotalEmptyBatteryCount() {
          let count = 0;
          if (typeof inventory !== "undefined" && Array.isArray(inventory)) {
            for (let item of inventory) {
              if (item && item.name === "GLOW_BATTERY_EMPTY") count += (item.count || 1);
            }
          }
          if (typeof actionSlotsItems !== "undefined" && Array.isArray(actionSlotsItems)) {
            for (let item of actionSlotsItems) {
              if (item && item.name === "GLOW_BATTERY_EMPTY") count += (item.count || 1);
            }
          }
          return count;
        },

        getActiveBattery() {
          if (this.getTotalBatteryCount() > 0) {
            return { charge: this.activeCharge, isRecharging: false, rechargeTime: 0 };
          }
          return null;
        },

        hasActiveBattery() {
          return this.getTotalBatteryCount() > 0;
        },

        getStats() {
          let readyCount = this.getTotalBatteryCount();
          let rechargingCount = this.getTotalEmptyBatteryCount();
          let activeBattery = readyCount > 0 ? { charge: this.activeCharge } : null;
          let minRechargePointsRemaining = Infinity;

          // Find the empty battery with the most recharge time
          const scanForRecharge = (arr) => {
            if (!arr || !Array.isArray(arr)) return;
            for (let item of arr) {
              if (item && item.name === "GLOW_BATTERY_EMPTY" && item.rechargeTime !== undefined) {
                const rem = Math.max(0, this.REGEN_TIME - item.rechargeTime);
                if (rem < minRechargePointsRemaining) minRechargePointsRemaining = rem;
              }
            }
          };
          scanForRecharge(typeof inventory !== "undefined" ? inventory : []);
          scanForRecharge(typeof actionSlotsItems !== "undefined" ? actionSlotsItems : []);

          if (rechargingCount > 0 && minRechargePointsRemaining === Infinity) {
             minRechargePointsRemaining = this.REGEN_TIME; // Default if not started yet
          }

          const minSecRemaining = minRechargePointsRemaining === Infinity ? 0 : (minRechargePointsRemaining / 60);

          return {
            total: readyCount + rechargingCount,
            readyCount,
            rechargingCount,
            activeBattery,
            minRechargeTimeRemaining: minSecRemaining
          };
        },

        consumePower(amount = 1) {
          if (this.getTotalBatteryCount() <= 0) return false;

          let deduct = 1;
          if (typeof amount === "number" && !isNaN(amount) && amount > 0) {
            deduct = amount < 0.2 ? (amount * 60) : amount;
          }

          this.activeCharge -= deduct;
          if (this.activeCharge <= 0) {
             // 1. Remove 1 GLOW_BATTERY
             let removed = false;
             if (typeof consumeItem === "function") {
               consumeItem("GLOW_BATTERY", 1);
               removed = true;
             }

             if (removed) {
               // 2. Add 1 GLOW_BATTERY_EMPTY
               if (typeof addItemToInventory === "function") {
                 addItemToInventory({ name: "GLOW_BATTERY_EMPTY", count: 1 }, false, false);
               }
               
               // Initialize rechargeTime for the newly added empty battery
               const initRecharge = (arr) => {
                  if (!arr || !Array.isArray(arr)) return;
                  for (let item of arr) {
                    if (item && item.name === "GLOW_BATTERY_EMPTY" && item.rechargeTime === undefined) {
                       item.rechargeTime = 0;
                    }
                  }
               };
               initRecharge(typeof inventory !== "undefined" ? inventory : []);
               initRecharge(typeof actionSlotsItems !== "undefined" ? actionSlotsItems : []);

               this.activeCharge = this.MAX_CHARGE;
               
               if (this.getTotalBatteryCount() > 0) {
                 if (typeof showNotice === "function") {
                   showNotice("🔋 แบตเตอรี่หมด 1 ก้อน (เริ่มรีเจน 5 นาที) ➔ สลับไปใช้ก้อนถัดไปอัตโนมัติ!");
                 }
               } else {
                 if (typeof showNotice === "function") {
                   showNotice("⚠️ แบตเตอรี่ในกระเป๋าหมดพลังงานทั้งหมดแล้ว! (กำลังรอรีเจน 5 นาที)");
                 }
               }
               if (typeof renderInventory === "function" && document.getElementById("inventoryOverlay")?.classList.contains("open")) {
                 renderInventory();
               }
             }
          }
          return true;
        },

        update(dt = 1) {
          let addPoints = 1;
          if (typeof dt === "number" && !isNaN(dt) && dt > 0) {
            addPoints = dt < 0.2 ? (dt * 60) : dt;
          }

          let hasRechargedAny = false;
          
          const processRecharge = (arr) => {
            if (!arr || !Array.isArray(arr)) return;
            for (let item of arr) {
              if (item && item.name === "GLOW_BATTERY_EMPTY") {
                if (item.rechargeTime === undefined) item.rechargeTime = 0;
                item.rechargeTime += addPoints;
                if (item.rechargeTime >= this.REGEN_TIME) {
                   // Convert to GLOW_BATTERY
                   item.name = "GLOW_BATTERY";
                   item.label = window.Language ? (window.Language.current === "en" ? "Glowing Battery Rod" : "หินเรืองแสงอัดแท่ง(แบต)") : "GLOW_BATTERY";
                   item.icon = "🔋";
                   delete item.rechargeTime;
                   hasRechargedAny = true;
                }
              }
            }
          };
          
          processRecharge(typeof inventory !== "undefined" ? inventory : []);
          processRecharge(typeof actionSlotsItems !== "undefined" ? actionSlotsItems : []);

          if (hasRechargedAny) {
            if (typeof window.mergeInventory === "function") window.mergeInventory(); // group stacked items back together
            
            if (typeof showNotice === "function") {
              showNotice("⚡ แบตเตอรี่หินเรืองแสงรีเจนพลังงานเต็ม 100% แล้ว! (Battery Fully Recharged)");
            }
            if (typeof renderInventory === "function" && document.getElementById("inventoryOverlay")?.classList.contains("open")) {
              renderInventory();
            }
          }
        },

        showEmptyNotice() {
          const now = Date.now();
          if (now - this._lastNoticeTime > 3500) {
            this._lastNoticeTime = now;
            const total = this.getTotalBatteryCount();
            if (total === 0) {
              if (typeof showNotice === "function") {
                showNotice("⚠️ เครื่องยนต์ไฟฟ้าต้องการไอเทม [หินเรืองแสงอัดแท่ง(แบต)] ในกระเป๋าเพื่อทำงาน!");
              }
            } else {
              const stats = this.getStats();
              if (stats.minRechargeTimeRemaining > 0) {
                const remSec = Math.ceil(stats.minRechargeTimeRemaining);
                const mins = Math.floor(remSec / 60);
                const secs = remSec % 60;
                const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                if (typeof showNotice === "function") {
                  showNotice(`🔋 แบตเตอรี่กำลังรีเจนพลังงาน... เหลืออีก ${timeStr} นาที (รอรีเจนครบ 5 นาที)`);
                }
              }
            }
          }
        },

        exportState() {
          return {
            activeCharge: this.activeCharge
          };
        },

        importState(data) {
          if (data && typeof data === "object") {
            if (typeof data.activeCharge === "number") {
              this.activeCharge = data.activeCharge;
            } else if (Array.isArray(data)) { // Support old save format
              const active = data.find(b => !b.isRecharging && b.charge > 0);
              this.activeCharge = active ? active.charge : this.MAX_CHARGE;
            }
          }
        }
      };

      const ALL_ITEMS = [
        { name: "ROCK", icon: "🪨" },
        { name: "BIG_ROCK", icon: "🪨" },
        { name: "IRON_ORE", icon: "🟥" },
        { name: "GOLD_ORE", icon: "🪙" },
        { name: "GLOW_ORE", icon: "✨" },
        { name: "GLOW_BATTERY", icon: "🔋" },
        { name: "GLOW_BATTERY_EMPTY", icon: "🪫" },
        { name: "BRANCH", icon: "🌿" },
        { name: "AXE", icon: "🪓" },
        { name: "PICKAXE", icon: "⛏️" },
        { name: "LOG", icon: "🪵" },
        { name: "BOW", icon: "🏹" },
        { name: "ARROW", icon: "🏹" },
        { name: "WOODEN_ARM_CANNON", icon: "🪵🦾" },
        { name: "WOOD_FLOOR", icon: "🪵" },
        { name: "THIN_WOOD_FLOOR", icon: "🪵" },
        { name: "STONE_FLOOR", icon: "🪨" },
        { name: "WOOD_STAIRS", icon: "🪜" },
        { name: "FOLDING_LADDER", icon: "🪜" },
        { name: "CAMPFIRE", icon: "🔥" },
        { name: "WOOD_BOAT", icon: "🛶" },
        { name: "WOOD_WHEEL", icon: "🛞" },
        { name: "BOAT_WING", icon: "🪽" },
        { name: "ELECTRIC_ENGINE", icon: "🔋" },
        { name: "WOOD_WALL", icon: "🧱" },
        { name: "WOOD_WINDOW", icon: "🪟" },
        { name: "WOOD_DOOR", icon: "🚪" },
        { name: "WOOD_ROOF", icon: "🛖" },
        { name: "WOOD_CHEST", icon: "📦" },
        { name: "MEGANEURA", icon: "🦟" },
        { name: "ISOPOD", icon: "🦐" },
        { name: "FRIED_BUG", icon: "🍤" },
        { name: "SHOVEL", icon: "🥄" },
        { name: "ROBOT_STAND", icon: "🏗️" },
        { name: "ROBOT_COCKPIT", icon: "🤖" },
        { name: "ROBOT_LEFT_ARM", icon: "🦾" },
        { name: "ROBOT_RIGHT_ARM", icon: "🦾" },
        { name: "ROBOT_LEFT_LEG", icon: "🦿" },
        { name: "ROBOT_RIGHT_LEG", icon: "🦿" },
      ];

      const icon3DCache = new Map();

      function create3DIconCanvas(item, width, height) {
        if (!item) return null;
        let name = "";
        if (typeof item === "string") {
          name = item.toUpperCase();
        } else if (item && item.name) {
          name = item.name.toUpperCase();
        } else if (item && item.type) {
          name = item.type.toUpperCase();
        }
        if (name === "CHEST") name = "WOOD_CHEST";
        if (name === "MEGANEURA_ITEM") name = "MEGANEURA";
        if (name === "ISOPOD_ITEM") name = "ISOPOD";
        if (name === "BASE") name = "WOOD_WALL";
        if (!name) return null;

        const dpr = window.devicePixelRatio || 1;
        
        let stateKey = "";
        if (name === "GLOW_BATTERY") {
           if (window.BatterySystem) {
             const stats = window.BatterySystem.getStats();
             const pct = (stats.activeBattery && stats.activeBattery.charge) ? Math.floor((stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100) : 100;
             stateKey = `_${pct}`;
           }
        } else if (name === "GLOW_BATTERY_EMPTY") {
           if (item && typeof item.rechargeTime === "number" && window.BatterySystem) {
             const pct = Math.floor((item.rechargeTime / window.BatterySystem.REGEN_TIME) * 100);
             stateKey = `_${pct}`;
           }
        }

        const cacheKey = `${name}_${width}_${height}_${dpr}${stateKey}`;
        
        if (icon3DCache.has(cacheKey)) {
          const cachedSrc = icon3DCache.get(cacheKey);
          const img = document.createElement("img");
          img.src = cachedSrc;
          img.style.width = width + "px";
          img.style.height = height + "px";
          img.style.display = "block";
          img.style.margin = "0 auto";
          return img;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        canvas.style.display = "block";
        canvas.style.background = "transparent";
        canvas.style.margin = "0 auto";
        
        const rawVertices = [];
        const rawColors = [];
        const rawIndices = [];
        
        let scaleFactor = 1.0;
        let yOffset = 0.0;
        
        const p = [0, 0, 0];
        const r = [1, 0, 0];
        const f = [0, 0, 1];
        const n = [0, 1, 0];
        
        let isRegistryRendered = false;
        const isExcluded = (name === "IRON_ORE" || name === "GOLD_ORE" || name === "GLOW_ORE" || name === "GLOW_BATTERY" || name === "GLOW_BATTERY_EMPTY" || name === "FRIED_BUG");
        let registryKey = name.toLowerCase();
        if (registryKey === "meganeura") registryKey = "meganeura_item";
        if (registryKey === "isopod") registryKey = "isopod_item";

        const handler = !isExcluded && window.ItemRegistry && window.ItemRegistry[registryKey];
        if (handler && typeof handler.render === "function") {
          // Guard and override fallback globals (temporarily force context to preview-safe values)
          const savedGlobals = {};
          const globalsToGuard = {
            getHeightOnSphere: (theta, phi, seed) => 0,
            globalSeed: 12345,
            RADIUS: 0.0, // Force to 0.0 so stone floor support legs don't get clamped underground
            HEIGHT_SCALE: 1.0,
            waterLevel: 0.0,
            waterEnabled: false,
            playerScale: 0.1,
            waterRadius: 10.0,
            collectibles: []
          };
          for (let key in globalsToGuard) {
            savedGlobals[key] = window[key];
            window[key] = globalsToGuard[key];
          }

          const mockItem = {
            position: [0, 0, 0],
            R: [1, 0, 0],
            F: [0, 0, 1],
            normal: [0, 1, 0],
            size: 0.25,
            seed: 123.45,
            color: [0.65, 0.45, 0.25],
            type: registryKey,
            isPreview: false,
            isValidPlacement: true,
            angle: 0
          };

          // Customize properties for beautiful UI framing (natural sizes)
          if (name === "ROCK") {
            scaleFactor = 1.35;
            mockItem.size = 0.33;
            mockItem.color = [0.55, 0.55, 0.55];
          } else if (name === "BIG_ROCK") {
            scaleFactor = 1.0;
            mockItem.size = 0.4;
            mockItem.color = [0.5, 0.5, 0.5];
            mockItem.seed = 678.9;
          } else if (name === "BRANCH") {
            scaleFactor = 1.4;
            mockItem.size = 0.45;
            mockItem.color = [0.45, 0.3, 0.15];
            mockItem.seed = 0;
          } else if (name === "LOG") {
            scaleFactor = 1.25;
            mockItem.size = 0.5;
            mockItem.color = [0.45, 0.3, 0.15];
            mockItem.seed = 0;
          } else if (name === "AXE") {
            scaleFactor = 1.2;
            mockItem.size = 0.5;
            mockItem.seed = 0;
          } else if (name === "PICKAXE") {
            scaleFactor = 1.2;
            mockItem.size = 0.5;
            mockItem.seed = 0;
          } else if (name === "ARROW") {
            scaleFactor = 1.35;
          } else if (name === "WOOD_FLOOR" || name === "THIN_WOOD_FLOOR") {
            scaleFactor = 1.1;
            mockItem.size = 0.75;
          } else if (name === "STONE_FLOOR") {
            scaleFactor = 1.1;
            mockItem.size = 0.08;
            mockItem.width = 0.75;
            mockItem.depth = 0.75;
            mockItem.isIconPreview = true;
          } else if (name === "WOOD_STAIRS" || name === "FOLDING_LADDER") {
            scaleFactor = 1.05;
            mockItem.type = name === "FOLDING_LADDER" ? "folding_ladder" : "wood_stairs";
            mockItem.stairTop = [-0.175, 0.175, -0.175];
            mockItem.stairBottom = [0.175, -0.175, 0.175];
          } else if (name === "WOOD_WALL" || name === "WOOD_WINDOW") {
            scaleFactor = 1.05;
            mockItem.type = name === "WOOD_WINDOW" ? "wood_window" : "wood_wall";
          } else if (name === "WOOD_DOOR") {
            scaleFactor = 1.05;
          } else if (name === "WOOD_ROOF") {
            scaleFactor = 1.05;
            mockItem.type = "wood_roof";
            mockItem.size = 0.25;
            mockItem.angle = 0.0;
          } else if (name === "WOOD_CHEST") {
            scaleFactor = 1.1;
          } else if (name === "CAMPFIRE") {
            scaleFactor = 1.15;
          } else if (name === "WOOD_BOAT") {
            scaleFactor = 1.05;
          } else if (name === "WOOD_WHEEL") {
            scaleFactor = 1.2;
          } else if (name === "BOAT_WING") {
            scaleFactor = 1.35;
          } else if (name === "MEGANEURA") {
            scaleFactor = 2.5;
            mockItem.seed = 1234;
          } else if (name === "ISOPOD") {
            scaleFactor = 2.0;
            mockItem.seed = 1234;
          }

          try {
            handler.render(mockItem, rawVertices, rawColors, rawIndices, 'preview');
            isRegistryRendered = true;
          } catch (err) {
            console.error("Error rendering item from registry:", name, err);
          }

          // Restore guarded globals safely to original state
          for (let key in savedGlobals) {
            if (savedGlobals[key] === undefined) {
              delete window[key];
            } else {
              window[key] = savedGlobals[key];
            }
          }
        }

        if (!isRegistryRendered) {
          if (name === "ROCK") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.5, [0.55, 0.55, 0.55], 123.45, rawVertices, rawColors, rawIndices);
          } else if (name === "BIG_ROCK") {
            scaleFactor = 1.0;
            buildRockFormation(p, 0.8, [0.5, 0.5, 0.5], 678.9, rawVertices, rawColors, rawIndices);
          } else if (name === "IRON_ORE") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.55, [0.45, 0.22, 0.18], 111.11, rawVertices, rawColors, rawIndices);
          } else if (name === "GOLD_ORE") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.55, [0.85, 0.68, 0.12], 222.22, rawVertices, rawColors, rawIndices);
          } else if (name === "GLOW_ORE") {
            scaleFactor = 1.35;
            buildRockFormation(p, 0.55, [0.22, 0.95, 0.88], 333.33, rawVertices, rawColors, rawIndices);
          } else if (name === "GLOW_BATTERY" || name === "GLOW_BATTERY_EMPTY") {
            scaleFactor = 1.35;
            
            let fillPercent = 0;
            if (name === "GLOW_BATTERY") {
              if (window.BatterySystem) {
                 const stats = window.BatterySystem.getStats();
                 fillPercent = (stats.activeBattery && stats.activeBattery.charge) ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100 : 100;
              } else {
                 fillPercent = 100;
              }
            } else {
               // Empty battery is recharging
               if (item && typeof item.rechargeTime === "number" && window.BatterySystem) {
                  fillPercent = (item.rechargeTime / window.BatterySystem.REGEN_TIME) * 100;
               } else {
                  fillPercent = 0;
               }
            }

            const isLow = fillPercent <= 20;
            const fullColor = isLow ? [0.88, 0.1, 0.1] : [0.22, 0.95, 0.88];
            const emptyColor = [0.3, 0.3, 0.3];
            
            const totalHeight = 0.64;
            const fillHeight = totalHeight * (fillPercent / 100);
            
            // Empty part (top)
            if (fillPercent < 100) {
              const emptyBot = -0.32 + fillHeight;
              buildTaperedSegment([0, emptyBot, 0], [0, 0.32, 0], 0.13, 0.13, 4, emptyColor, rawVertices, rawColors, rawIndices, true);
            }
            // Filled part (bottom)
            if (fillPercent > 0) {
              const fillTop = -0.32 + fillHeight;
              buildTaperedSegment([0, -0.32, 0], [0, fillTop, 0], 0.13, 0.13, 4, fullColor, rawVertices, rawColors, rawIndices, true);
            }
          } else if (name === "BRANCH") {
            scaleFactor = 1.4;
            buildTaperedSegment([-0.35, -0.1, 0], [0.35, 0.1, 0], 0.04, 0.02, 5, [0.45, 0.3, 0.15], rawVertices, rawColors, rawIndices);
          } else if (name === "LOG") {
            scaleFactor = 1.25;
            buildTaperedSegment([-0.4, 0, 0], [0.4, 0, 0], 0.15, 0.13, 6, [0.45, 0.3, 0.15], rawVertices, rawColors, rawIndices, true);
          } else if (name === "AXE") {
            scaleFactor = 1.2;
            buildTaperedSegment([0, -0.4, 0], [0, 0.3, 0], 0.03, 0.03, 5, [0.4, 0.25, 0.15], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([-0.1, 0.15, 0], [0.25, 0.15, 0], 0.06, 0.015, 4, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
          } else if (name === "PICKAXE") {
            scaleFactor = 1.2;
            buildTaperedSegment([0, -0.4, 0], [0, 0.3, 0], 0.03, 0.03, 5, [0.4, 0.25, 0.15], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([-0.25, 0.15, 0], [0, 0.15, 0], 0.05, 0.01, 4, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0.15, 0], [0.25, 0.15, 0], 0.05, 0.01, 4, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
          } else if (name === "SHOVEL") {
            scaleFactor = 1.25;
            // Shovel Handle: brown stick
            buildTaperedSegment([0, -0.3, 0], [0, 0.18, 0], 0.02, 0.02, 5, [0.4, 0.25, 0.15], rawVertices, rawColors, rawIndices);
            
            // Shovel Blade (scoop): silver gray, continuous at the end of the handle!
            // Socket
            buildTaperedSegment([0, 0.18, 0], [0, 0.22, 0], 0.025, 0.025, 5, [0.55, 0.55, 0.55], rawVertices, rawColors, rawIndices);
            // Scoop body
            buildTaperedSegment([0, 0.22, 0], [0, 0.38, 0], 0.07, 0.065, 5, [0.65, 0.65, 0.65], rawVertices, rawColors, rawIndices);
            // Scoop tip (pointy)
            buildTaperedSegment([0, 0.38, 0], [0, 0.46, 0], 0.065, 0.01, 5, [0.6, 0.6, 0.6], rawVertices, rawColors, rawIndices);
            
            // Shovel D-Handle at the back: Y = -0.3
            const partsColor = [0.25, 0.25, 0.25]; // Dark charcoal
            // Stem of D-handle
            buildTaperedSegment([0, -0.3, 0], [0, -0.35, 0], 0.02, 0.02, 5, partsColor, rawVertices, rawColors, rawIndices);
            // Left loop arm
            buildTaperedSegment([0, -0.35, 0], [-0.05, -0.42, 0], 0.015, 0.015, 4, partsColor, rawVertices, rawColors, rawIndices);
            // Right loop arm
            buildTaperedSegment([0, -0.35, 0], [0.05, -0.42, 0], 0.015, 0.015, 4, partsColor, rawVertices, rawColors, rawIndices);
            // Horizontal grip
            buildTaperedSegment([-0.05, -0.42, 0], [0.05, -0.42, 0], 0.016, 0.016, 5, partsColor, rawVertices, rawColors, rawIndices);
          } else if (name === "BOW") {
            scaleFactor = 1.25;
            const wGrip = [0, 0, 0];
            const wUpperTip = [0, 0.45, -0.05];
            const wLowerTip = [0, -0.45, -0.05];
            const wNock = [0, 0, -0.22];
            const bendMag = 0.08;
            const wUpperMid = [0, 0.225, bendMag];
            const wLowerMid = [0, -0.225, bendMag];
            buildTaperedSegment(wGrip, wUpperMid, 0.012, 0.009, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wUpperMid, wUpperTip, 0.009, 0.005, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wGrip, wLowerMid, 0.012, 0.009, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wLowerMid, wLowerTip, 0.009, 0.005, 5, [0.55, 0.38, 0.22], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wUpperTip, wNock, 0.002, 0.002, 4, [0.95, 0.95, 0.95], rawVertices, rawColors, rawIndices);
            buildTaperedSegment(wLowerTip, wNock, 0.002, 0.002, 4, [0.95, 0.95, 0.95], rawVertices, rawColors, rawIndices);
          } else if (name === "ARROW") {
            scaleFactor = 1.35;
            buildTaperedSegment([0, -0.3, 0], [0, 0.3, 0], 0.005, 0.005, 4, [0.55, 0.4, 0.25], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, -0.3, 0], [0, -0.2, 0], 0.015, 0.006, 4, [0.9, 0.2, 0.2], rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0.3, 0], [0, 0.34, 0], 0.012, 0.001, 4, [0.35, 0.35, 0.35], rawVertices, rawColors, rawIndices);
          } else if (name === "WOODEN_ARM_CANNON" || name === "ARM_CANNON") {
            scaleFactor = 1.2;
            const woodColor = [0.55, 0.38, 0.22];
            const woodDark = [0.42, 0.28, 0.15];
            const ironColor = [0.28, 0.28, 0.30];
            const boreColor = [0.10, 0.10, 0.10];
            // Rear to front cylinder
            buildTaperedSegment([0, -0.25, 0], [0, 0, 0], 0.09, 0.08, 6, woodColor, rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0, 0], [0, 0.28, 0], 0.08, 0.085, 6, woodDark, rawVertices, rawColors, rawIndices);
            // Iron bands
            buildTaperedSegment([0, -0.25, 0], [0, -0.21, 0], 0.096, 0.096, 6, ironColor, rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, -0.02, 0], [0, 0.02, 0], 0.088, 0.088, 6, ironColor, rawVertices, rawColors, rawIndices);
            buildTaperedSegment([0, 0.25, 0], [0, 0.28, 0], 0.092, 0.092, 6, ironColor, rawVertices, rawColors, rawIndices);
            // Muzzle bore
            buildTaperedSegment([0, 0.22, 0], [0, 0.28, 0], 0.05, 0.055, 6, boreColor, rawVertices, rawColors, rawIndices);
          } else if (name === "STONE_FLOOR") {
            scaleFactor = 1.1;
            addBox(p, 0.9, 0.1, 0.9, [0.6, 0.6, 0.6], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, 0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, -0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, 0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, -0.38], 0.12, 0.4, 0.12, [0.45, 0.45, 0.45], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_FLOOR" || name === "THIN_WOOD_FLOOR") {
            scaleFactor = 1.1;
            const th = (name === "THIN_WOOD_FLOOR") ? 0.05 : 0.15;
            addBox(p, 0.9, th, 0.9, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, 0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.38, -0.2, -0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, 0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.38, -0.2, -0.38], 0.1, 0.4, 0.1, [0.5, 0.33, 0.17], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_STAIRS" || name === "FOLDING_LADDER") {
            scaleFactor = 1.05;
            const ladderCol = name === "FOLDING_LADDER" ? [0.4, 0.42, 0.45] : [0.65, 0.45, 0.25];
            addBox([0, -0.15, 0.15], 0.9, 0.15, 0.3, ladderCol, r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.0, 0.0], 0.9, 0.15, 0.3, [ladderCol[0]*0.85, ladderCol[1]*0.85, ladderCol[2]*0.85], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.15, -0.15], 0.9, 0.15, 0.3, [ladderCol[0]*0.7, ladderCol[1]*0.7, ladderCol[2]*0.7], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_WALL") {
            scaleFactor = 1.05;
            addBox(p, 0.9, 0.9, 0.1, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_WINDOW") {
            scaleFactor = 1.05;
            addBox(p, 0.9, 0.9, 0.1, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox(p, 0.6, 0.6, 0.04, [0.4, 0.75, 0.95], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_DOOR") {
            scaleFactor = 1.05;
            addBox(p, 0.5, 0.9, 0.08, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.15, 0, 0.05], 0.05, 0.05, 0.03, [0.95, 0.8, 0.2], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_ROOF") {
            scaleFactor = 1.05;
            addBox(p, 0.9, 0.08, 0.9, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.15, 0.2], 0.92, 0.12, 0.5, [0.55, 0.38, 0.2], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_CHEST") {
            scaleFactor = 1.1;
            addBox([0, -0.08, 0], 0.8, 0.45, 0.5, [0.5, 0.3, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.2, 0], 0.8, 0.15, 0.5, [0.65, 0.45, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.1, 0.26], 0.1, 0.1, 0.02, [0.85, 0.7, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "CAMPFIRE") {
            scaleFactor = 1.15;
            const numRocks = 8;
            const rockRadius = 0.28;
            for (let i = 0; i < numRocks; i++) {
              const angle = (i / numRocks) * Math.PI * 2;
              const rPos = [Math.cos(angle) * rockRadius, -0.15, Math.sin(angle) * rockRadius];
              const rSize = 0.08;
              const rCol = [0.42 + Math.sin(i)*0.05, 0.42 + Math.sin(i)*0.05, 0.42 + Math.sin(i)*0.05];
              addBox(rPos, rSize, rSize, rSize, rCol, r, n, f, rawVertices, rawColors, rawIndices);
            }
            const numLogs = 4;
            for (let i = 0; i < numLogs; i++) {
              const angle = (i / numLogs) * Math.PI;
              const cosA = Math.cos(angle), sinA = Math.sin(angle);
              const r_dir = [cosA, 0, sinA];
              const f_dir = [-sinA, 0, cosA];
              addBox([0, -0.08, 0], 0.5, 0.06, 0.06, [0.45, 0.3, 0.15], r_dir, n, f_dir, rawVertices, rawColors, rawIndices);
            }
            addBox([0, 0.02, 0], 0.12, 0.24, 0.12, [0.95, 0.45, 0.1], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.04, 0.08, 0.04], 0.08, 0.3, 0.08, [0.95, 0.2, 0.1], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.04, 0.05, -0.04], 0.1, 0.2, 0.1, [0.95, 0.8, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
          } else if (name === "WOOD_BOAT") {
            scaleFactor = 1.05;
            addBox([0, -0.12, 0], 0.5, 0.08, 0.9, [0.55, 0.4, 0.25], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([-0.26, 0.05, 0], 0.04, 0.25, 0.9, [0.45, 0.3, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0.26, 0.05, 0], 0.04, 0.25, 0.9, [0.45, 0.3, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, 0.05, 0.48], 0.42, 0.25, 0.08, [0.38, 0.26, 0.15], r, n, f, rawVertices, rawColors, rawIndices);
            addBox([0, -0.02, -0.08], 0.48, 0.04, 0.15, [0.65, 0.5, 0.35], r, n, f, rawVertices, rawColors, rawIndices);
          
          } else if (name === "FRIED_BUG") {
            buildFriedBugModel(
              1234,
              4.0,
              [0,0,0],
              r, n, f,
              rawVertices, rawColors, rawIndices
            );

          } else if (name === "MEGANEURA") {
            buildMeganeuraModel(
              1234,
              0,
              false,
              false,
              4.0,
              [0,0,0],
              r, n, f,
              rawVertices, rawColors, rawIndices
            );
          } else if (name === "ISOPOD") {
            if (typeof buildIsopodModel === "function") {
              buildIsopodModel(
                1234,
                0,
                false,
                false,
                2.5,
                [0,0,0],
                r, n, f,
                rawVertices, rawColors, rawIndices
              );
            }
          } else {
            return null; // Return null if not a 3D item
          }
        }
        
        // Auto-center and auto-scale ALL generated 3D models to fit beautifully inside the inventory slot
        if (rawVertices.length > 0) {
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let minZ = Infinity, maxZ = -Infinity;
          
          for (let i = 0; i < rawVertices.length; i += 3) {
            const x = rawVertices[i];
            const y = rawVertices[i+1];
            const z = rawVertices[i+2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
          
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const centerZ = (minZ + maxZ) / 2;
          
          const sizeX = maxX - minX;
          const sizeY = maxY - minY;
          const sizeZ = maxZ - minZ;
          const maxDim = Math.max(sizeX, sizeY, sizeZ);
          
          let targetSize = 0.80; // Standard size to occupy about 80% of the canvas height/width
          
          // Fine-tuned target sizes for select item layouts to make them look uniform and visually outstanding
          if (name === "ARROW" || name === "BRANCH") {
            targetSize = 0.75;
          } else if (name === "WOOD_FLOOR" || name === "THIN_WOOD_FLOOR" || name === "STONE_FLOOR") {
            targetSize = 0.85;
          } else if (name === "WOOD_BOAT") {
            targetSize = 0.90; // Give the boat maximum visibility inside the slot
          } else if (name === "BOAT_WING") {
            targetSize = 0.85;
          }
          
          const scale = maxDim > 0.0001 ? (targetSize / maxDim) : 1.0;
          
          for (let i = 0; i < rawVertices.length; i += 3) {
            rawVertices[i] = (rawVertices[i] - centerX) * scale;
            rawVertices[i+1] = (rawVertices[i+1] - centerY) * scale;
            rawVertices[i+2] = (rawVertices[i+2] - centerZ) * scale;
          }
          
          // Overwrite the manual tweaks since bounding normalization handles all scales and offsets perfectly
          scaleFactor = 1.0;
          yOffset = 0.0;
        }

        let vertices = [];
        let faces = [];
        
        // Convert to face lists
        for (let i = 0; i < rawVertices.length; i += 3) {
          vertices.push([rawVertices[i], rawVertices[i+1], rawVertices[i+2]]);
        }
        
        for (let i = 0; i < rawIndices.length; i += 3) {
          const idx0 = rawIndices[i];
          const idx1 = rawIndices[i+1];
          const idx2 = rawIndices[i+2];
          
          const rVal = rawColors[idx0 * 3];
          const gVal = rawColors[idx0 * 3 + 1];
          const bVal = rawColors[idx0 * 3 + 2];
          
          function rgbToHex(rVal, gVal, bVal) {
            const hex = (x) => {
              const h = Math.max(0, Math.min(255, Math.floor(x * 255))).toString(16);
              return h.length === 1 ? "0" + h : h;
            };
            return "#" + hex(rVal) + hex(gVal) + hex(bVal);
          }
          
          faces.push({
            indices: [idx0, idx1, idx2],
            color: rgbToHex(rVal, gVal, bVal)
          });
        }
        
        const ctx = canvas.getContext("2d");
        let startTime = Date.now() + Math.random() * 5000;
        let autoRotateSpeed = 1.0;
        
        function drawFrame() {

          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const time = 2.0; // fixed angle for static preview
          
          const ry = time;
          const rx = 0.45 + Math.sin(time * 0.5) * 0.1;
          
          const projected = [];
          const cx = canvas.width / 2;
          const cy = canvas.height / 2 + yOffset * dpr;
          const screenScale = Math.min(canvas.width, canvas.height) * 1.0 * scaleFactor;
          
          for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            const x = v[0];
            const y = v[1];
            const z = v[2];
            
            const x1 = x * Math.cos(ry) - z * Math.sin(ry);
            const z1 = x * Math.sin(ry) + z * Math.cos(ry);
            
            const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
            const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
            
            const sx = cx + x1 * screenScale;
            const sy = cy - y2 * screenScale;
            
            projected.push({ x: sx, y: sy, z: z2 });
          }
          
          const sortedFaces = faces.map((face, index) => {
            let avgZ = 0;
            face.indices.forEach(idx => {
              avgZ += projected[idx].z;
            });
            avgZ /= face.indices.length;
            return { face, avgZ, index };
          });
          
          sortedFaces.sort((a, b) => b.avgZ - a.avgZ);
          
          sortedFaces.forEach(({ face }) => {
            ctx.beginPath();
            const p0 = projected[face.indices[0]];
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < face.indices.length; i++) {
              const p = projected[face.indices[i]];
              ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            
            const v0 = vertices[face.indices[0]];
            const v1 = vertices[face.indices[1]];
            const v2 = vertices[face.indices[2] || face.indices[0]];
            
            const ux = v1[0] - v0[0];
            const uy = v1[1] - v0[1];
            const uz = v1[2] - v0[2];
            
            const vx = v2[0] - v0[0];
            const vy = v2[1] - v0[1];
            const vz = v2[2] - v0[2];
            
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
            nx /= len;
            ny /= len;
            nz /= len;
            
            const nx1 = nx * Math.cos(ry) - nz * Math.sin(ry);
            const nz1 = nx * Math.sin(ry) + nz * Math.cos(ry);
            const ny2 = ny * Math.cos(rx) - nz1 * Math.sin(rx);
            
            const dot = nx1 * 0.42 + ny2 * 0.84 + nz1 * 0.32;
            const lightIntensity = Math.max(0.0, dot);
            
            ctx.fillStyle = shadeColor(face.color, lightIntensity);
            ctx.fill();
          });
          
        }
        
        function shadeColor(colorStr, intensity) {
          if (colorStr.startsWith("rgba")) return colorStr;
          
          let hex = colorStr.replace("#", "");
          if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          }
          
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          
          const factor = 0.45 + intensity * 0.55;
          const sr = Math.min(255, Math.floor(r * factor));
          const sg = Math.min(255, Math.floor(g * factor));
          const sb = Math.min(255, Math.floor(b * factor));
          
          return `rgb(${sr}, ${sg}, ${sb})`;
        }
        
        drawFrame();
        try {
          const dataUrl = canvas.toDataURL();
          icon3DCache.set(cacheKey, dataUrl);
          const img = document.createElement("img");
          img.src = dataUrl;
          img.style.width = width + "px";
          img.style.height = height + "px";
          img.style.display = "block";
          img.style.margin = "0 auto";
          return img;
        } catch (e) {
          return canvas;
        }
      }
      window.create3DIconCanvas = create3DIconCanvas;

      let activeTab = "inventory";
      window.getActiveTab = () => activeTab;
      window.setActiveTab = (tab) => {
        activeTab = tab;
        const bottomBtns = document.getElementById("inventoryBottomButtons");
        if (bottomBtns) {
          const tabInv = document.getElementById("tabInventory");
          const isTabActive = tabInv ? tabInv.classList.contains("active") : (tab === "inventory");
          bottomBtns.style.display = (tab === "inventory" && isTabActive) ? "flex" : "none";
        }
        if (tab !== "inventory") {
          window.selectedInventorySlot = null;
          if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
          if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
        }
        if (typeof updateCustomScrollbar === "function") {
          setTimeout(updateCustomScrollbar, 30);
        }
      };

      function updateBadge() {
        const badge = document.getElementById("inventoryBadge");
        if (!badge) return;
        if (!isDevMode) {
          badge.style.display = "none";
          return;
        } else {
          badge.style.display = "flex";
        }
        const count = inventory
          .slice(0, UNLOCKED_SLOTS)
          .reduce((acc, item) => acc + (item ? item.count || 1 : 0), 0);
        badge.textContent = count;
      }

      function updateActionSlotsPosition() {
        const actionSlotsWrapper = document.getElementById("actionSlots");
        if (!actionSlotsWrapper) return;
        
        if (actionSlotsWrapper.classList.contains("move-mode") && window.innerWidth > 768) {
          const panel = document.querySelector("#inventoryOverlay .inventory-panel");
          if (panel) {
            const rect = panel.getBoundingClientRect();
            // Position action slots exactly adjacent to the right edge of the inventory panel with a 16px gap
            actionSlotsWrapper.style.left = `${rect.right + 16}px`;
            actionSlotsWrapper.style.top = `${rect.top + rect.height / 2}px`;
            actionSlotsWrapper.style.transform = "translateY(-50%)";
            actionSlotsWrapper.style.bottom = "auto";
            actionSlotsWrapper.style.right = "auto";
          }
        } else {
          // Reset custom inline styles so the CSS handles normal layout
          actionSlotsWrapper.style.left = "";
          actionSlotsWrapper.style.top = "";
          actionSlotsWrapper.style.transform = "";
          actionSlotsWrapper.style.bottom = "";
          actionSlotsWrapper.style.right = "";
        }
      }

      
      function closeInventoryActually() {
        const qBtn = document.getElementById("quitGameBtn");
        if (qBtn) qBtn.style.display = "none";
        const overlay = document.getElementById("inventoryOverlay");
        overlay.classList.remove("open");
        
        // Hide cooking tab when closed
        if (document.getElementById("tabCooking").classList.contains("active")) {
          activeTab = "inventory";
          document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
          document.getElementById("tabInventory").classList.add("active");
          document.getElementById("cookingList").style.display = "none";
          document.getElementById("inventoryGrid").style.display = "grid";
          
          const mainLayout = document.getElementById("inventoryMainLayout");
          if (mainLayout) {
            mainLayout.style.display = "flex";
            mainLayout.style.maxWidth = "none";
          }
          const divider = document.getElementById("inventoryVerticalDivider");
          if (divider) divider.style.display = "block";
          const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "flex";
        }
        document.getElementById("tabCooking").style.display = "none";


        if (gameStarted) {
          requestPointerLockSafe();
        }

        closeTrashConfirm();

        if (isMoveModeEnabled) {
          isMoveModeEnabled = false;
          const actionSlotsWrapper = document.getElementById("actionSlots");
          if (actionSlotsWrapper) {
            actionSlotsWrapper.classList.remove("move-mode");
          }
          renderInventory();
          renderActionSlots();
        }
        updateActionSlotsPosition();
      }
      window.closeInventoryActually = closeInventoryActually;

      function openChest(chestItem) {
        // Close inventory first if open
        const invOverlay = document.getElementById("inventoryOverlay");
        if (invOverlay && invOverlay.classList.contains("open")) {
          invOverlay.classList.remove("open");
        }
        
        currentOpenChest = chestItem;
        if (!currentOpenChest.storage) {
          currentOpenChest.storage = Array(20).fill(null);
        }
        
        const overlay = document.getElementById("chestOverlay");
        if (overlay) {
          overlay.classList.add("open");
        }
        
        renderChest();

      }

      function closeChest() {
        currentOpenChest = null;
        const overlay = document.getElementById("chestOverlay");
        if (overlay) {
          overlay.classList.remove("open");
        }
        if (gameStarted) {
          requestPointerLockSafe();
        }
        closeTrashConfirm();
      }

      function addItemToChest(item) {
        if (!currentOpenChest) return false;
        const itemName = item.name || item.label;

        // Check if item already exists and can be stacked
        for (let i = 0; i < 20; i++) {
          if (
            currentOpenChest.storage[i] !== null &&
            (currentOpenChest.storage[i].name === itemName ||
             currentOpenChest.storage[i].label === itemName)
          ) {
            currentOpenChest.storage[i].count += 1;
            renderChest();
            saveSettingsToLocalStorage();
            return true;
          }
        }

        // Add to new slot in chest
        for (let i = 0; i < 20; i++) {
          if (currentOpenChest.storage[i] === null) {
            currentOpenChest.storage[i] = { ...item, count: 1 };
            currentOpenChest.storage[i].name = itemName;
            renderChest();
            saveSettingsToLocalStorage();
            return true;
          }
        }
        return false;
      }

      
      function getSlotItem(source, index) {
        if (source === "inventory" || source === "chestPlayerInventory") {
          return inventory[index];
        } else if (source === "action") {
          return actionSlotsItems[index];
        } else if (source === "chest") {
          return (currentOpenChest && currentOpenChest.storage) ? currentOpenChest.storage[index] : null;
        }
        return null;
      }

      function setSlotItem(source, index, item) {
        if (source === "inventory" || source === "chestPlayerInventory") {
          inventory[index] = item;
        } else if (source === "action") {
          actionSlotsItems[index] = item;
        } else if (source === "chest") {
          if (currentOpenChest && currentOpenChest.storage) {
            currentOpenChest.storage[index] = item;
          }
        }
      }

      function populateSlotElement(slotEl, {
        source,
        index,
        item = null,
        isLocked = false,
        isDraggable = true,
        isDropTarget = true,
        keyLabel = null,
        cursor = null,
        onClick = null,
        onRightClick = null,
        labelStyle = null,
        labelColor = null
      }) {
        slotEl.innerHTML = "";
        slotEl.dataset.source = source;
        slotEl.dataset.index = index;

        if (isLocked) {
          slotEl.classList.add("locked");
          slotEl.draggable = false;
          slotEl.onclick = null;
          slotEl.ondragstart = null;
          slotEl.ondragend = null;
          slotEl.ondragover = null;
          slotEl.ondragleave = null;
          slotEl.ondrop = null;
          return slotEl;
        } else {
          slotEl.classList.remove("locked");
        }

        // Setup Drag & Drop
        if (isDropTarget) {
          slotEl.ondragover = handleDragOver;
          slotEl.ondragleave = handleDragLeave;
          slotEl.ondrop = (e) => handleDrop(e, source, index);
        } else {
          slotEl.ondragover = null;
          slotEl.ondragleave = null;
          slotEl.ondrop = null;
        }

        // Key label for Action Slots (1, 2, 3, 4)
        if (keyLabel) {
          const keyBadge = document.createElement("span");
          keyBadge.style.position = "absolute";
          keyBadge.style.top = "2px";
          keyBadge.style.right = "4px";
          keyBadge.style.fontSize = "10px";
          keyBadge.style.color = "rgba(255,255,255,0.5)";
          keyBadge.style.fontFamily = "'Google Sans', sans-serif";
          keyBadge.textContent = keyLabel;
          slotEl.appendChild(keyBadge);
        }

        if (item) {
          slotEl.classList.remove("empty");
          slotEl.style.position = "relative";
          slotEl.style.cursor = cursor || "pointer";

          if (isDraggable) {
            slotEl.draggable = true;
            slotEl.ondragstart = (e) => handleDragStart(e, source, index);
            slotEl.ondragend = handleDragEnd;
          } else {
            slotEl.draggable = false;
            slotEl.ondragstart = null;
            slotEl.ondragend = null;
          }

          const content = document.createElement("span");
          content.className = "slot-content";
          const canvas3D = create3DIconCanvas(item, 48, 48);
          if (canvas3D) {
            content.appendChild(canvas3D);
          } else {
            content.textContent = item.icon || "📦";
          }
          slotEl.appendChild(content);

          const label = document.createElement("span");
          label.className = "slot-label";
          if (labelStyle) {
            Object.assign(label.style, labelStyle);
          } else if (labelColor) {
            label.style.color = labelColor;
          }
          const rawName = item.name || item.label || "ITEM";
          const displayName = typeof getItemDisplayName === "function" ? getItemDisplayName(rawName) : rawName;
          if (typeof window.setElementTextOrHTML === "function") {
            window.setElementTextOrHTML(label, displayName);
          } else if (typeof displayName === "string" && (displayName.includes("<svg") || displayName.includes("<span"))) {
            label.innerHTML = displayName;
          } else {
            label.textContent = displayName;
          }
          slotEl.appendChild(label);

          if (item.count > 1) {
            const countBadge = document.createElement("span");
            countBadge.style.position = "absolute";
            countBadge.style.top = "2px";
            countBadge.style.left = "4px";
            countBadge.style.fontSize = "11px";
            countBadge.style.fontWeight = "bold";
            countBadge.style.color = "#fff";
            countBadge.style.textShadow = "1px 1px 2px #000";
            countBadge.textContent = "x" + item.count;
            slotEl.appendChild(countBadge);
          }

          if (item.name === "GLOW_BATTERY" || item.label === "GLOW_BATTERY") {
            const stats = window.BatterySystem ? window.BatterySystem.getStats() : null;
            if (stats && stats.readyCount > 0 && stats.activeBattery) {
              const pct = Math.round((stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100);
              const totalSecs = Math.floor(stats.activeBattery.charge / 60);
              const m = Math.floor(totalSecs / 60);
              const s = Math.floor(totalSecs % 60);
              slotEl.title = `🔋 หินเรืองแสงอัดแท่ง(แบต)\n• พร้อมใช้งาน: ${stats.readyCount} ก้อน\n• พลังงานก้อนหลัก: ${pct}% (${m}:${s < 10 ? '0' : ''}${s} นาที)\n• 1 ก้อนใช้ได้ 20 นาที / รีเจนอัตโนมัติ 5 นาทีเมื่อหมด`;
            } else {
              slotEl.title = `🔋 หินเรืองแสงอัดแท่ง(แบต)\n• พร้อมใช้งาน (20 นาที)\n• รีเจนอัตโนมัติ 5 นาทีเมื่อหมด`;
            }
          } else if (item.name === "GLOW_BATTERY_EMPTY") {
            const pct = Math.round((item.rechargeTime / 18000) * 100);
            const rem = Math.max(0, (18000 - item.rechargeTime) / 60);
            const m = Math.floor(rem / 60);
            const s = Math.ceil(rem % 60);
            slotEl.title = `⏳ แบตเตอรี่เรืองแสง(หมดพลังงาน)\n• กำลังรีเจน: ${pct}%\n• เหลือเวลารีเจน: ${m}:${s < 10 ? '0' : ''}${s} นาที`;
          } else {
            const def = (typeof getItemDefinition === "function") ? getItemDefinition(item) : (window.getItemDefinition ? window.getItemDefinition(item) : null);
            if (def) {
              const isPrePlace = window.hasItemCategory ? window.hasItemCategory(item, "PRE_PLACE") : (def.category === "PRE_PLACE");
              const isHoldable = window.hasItemCategory ? window.hasItemCategory(item, "HOLDABLE") : (def.category === "HOLDABLE");
              const isVehicle = window.hasItemCategory ? window.hasItemCategory(item, "VEHICLE") : (Array.isArray(def.category) ? def.category.includes("VEHICLE") : def.category === "VEHICLE");
              
              let catLabel = "📦 ไอเทมวัตถุดิบ/ทั่วไป (NONE)";
              if (isVehicle) catLabel = "🚙 ยานพาหนะ (VEHICLE)";
              else if (isPrePlace) catLabel = "🏗️ ไอเทม พรี-วาง (PRE_PLACE)";
              else if (isHoldable) catLabel = "⚔️ ไอเทมถือ (HOLDABLE)";

              slotEl.title = `${def.icon || ""} ${def.name_th} (${def.name_en})\n• หมวดหมู่: ${catLabel}\n• การใช้งาน: ${def.usage_th}`;
            }
          }

          slotEl.oncontextmenu = (e) => { e.preventDefault(); };
          slotEl.onmousedown = (e) => {
            if (e.button === 2) {
              e.preventDefault();
              e.stopPropagation();
              if (typeof onRightClick === "function") {
                onRightClick(e);
              } else {
                handleSplitItem(source, index);
              }
            }
          };

          if (window.selectedInventorySlot && window.selectedInventorySlot.source === source && window.selectedInventorySlot.index === index) {
            slotEl.classList.add("item-selected");
          } else {
            slotEl.classList.remove("item-selected");
          }

          slotEl.onclick = (e) => {
            if (source === "itemsList") {
              window.selectedInventorySlot = null;
              if (onClick) onClick(e);
              return;
            }
            if (window.selectedInventorySlot) {
              const prev = window.selectedInventorySlot;
              if (prev.source === source && prev.index === index) {
                // Clicked same slot: deselect
                window.selectedInventorySlot = null;
              } else {
                // Move/swap/stack from prev to target slot
                const fromItem = getSlotItem(prev.source, prev.index);
                if (fromItem) {
                  const toItem = getSlotItem(source, index);
                  const fromName = fromItem.name || fromItem.label;
                  const toName = toItem ? (toItem.name || toItem.label) : null;

                  if (toItem && fromName === toName) {
                    toItem.count = (toItem.count || 1) + (fromItem.count || 1);
                    setSlotItem(prev.source, prev.index, null);
                  } else {
                    setSlotItem(prev.source, prev.index, toItem);
                    setSlotItem(source, index, fromItem);
                  }

                  window.selectedInventorySlot = null;
                  if (currentOpenChest) renderChest();
                  renderInventory();
                  renderActionSlots();
                  updateBadge();
                  saveSettingsToLocalStorage();
                  if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
                  if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
                  if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(err){}
                  if (window.GamepadController && typeof window.GamepadController.applyUIFocus === "function") {
                    window.GamepadController.applyUIFocus();
                  }
                  if (onClick) onClick(e);
                  return;
                }
              }
            } else {
              const cur = getSlotItem(source, index);
              if (cur) {
                window.selectedInventorySlot = { source, index, item: cur };
              }
            }
            if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
            if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();

            if (onClick) onClick(e);
          };

          // Track hovered slot for bottom inventory action buttons
          slotEl.addEventListener("mouseenter", () => {
            window.lastHoveredSlot = { slotEl, source, index, item };
          });
          slotEl.addEventListener("mouseleave", () => {
            if (window.lastHoveredSlot && window.lastHoveredSlot.slotEl === slotEl) {
              window.lastHoveredSlot = null;
            }
          });
        } else {
          slotEl.classList.add("empty");
          slotEl.classList.remove("item-selected");
          slotEl.draggable = false;
          slotEl.ondragstart = null;
          slotEl.ondragend = null;
          if (cursor) slotEl.style.cursor = cursor;
          slotEl.onclick = (e) => {
            if (window.selectedInventorySlot) {
              const prev = window.selectedInventorySlot;
              const fromItem = getSlotItem(prev.source, prev.index);
              if (fromItem) {
                setSlotItem(source, index, fromItem);
                setSlotItem(prev.source, prev.index, null);
                window.selectedInventorySlot = null;
                if (currentOpenChest) renderChest();
                renderInventory();
                renderActionSlots();
                updateBadge();
                saveSettingsToLocalStorage();
                if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
                if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
                if (typeof playPlaceSound === "function") try { playPlaceSound(); } catch(err){}
                if (window.GamepadController && typeof window.GamepadController.applyUIFocus === "function") {
                  window.GamepadController.applyUIFocus();
                }
                if (onClick) onClick(e);
                return;
              }
            }
            window.selectedInventorySlot = null;
            if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
            if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
            if (onClick) onClick(e);
          };

          const emptyText = document.createElement("span");
          emptyText.style.fontSize = "10px";
          emptyText.style.color = "rgba(255,255,255,0.05)";
          emptyText.textContent = "□";
          slotEl.appendChild(emptyText);
        }

        return slotEl;
      }

      function createSlotElement(options) {
        const slot = document.createElement("div");
        slot.className = options.className || "inventory-slot";
        return populateSlotElement(slot, options);
      }

      function renderChest() {
        if (!currentOpenChest) return;
        const chestGrid = document.getElementById("chestGrid");
        if (!chestGrid) return;
        chestGrid.innerHTML = "";

        // 1. Render Chest Storage slots (20 slots)
        for (let i = 0; i < 20; i++) {
          const item = currentOpenChest.storage[i];
          const slot = createSlotElement({
            source: "chest",
            index: i,
            item: item,
            onClick: item ? () => {
              // Click to take item to player inventory
              if (addItemToInventory(item, true)) {
                if (item.count > 1) {
                  item.count -= 1;
                } else {
                  currentOpenChest.storage[i] = null;
                }
                renderChest();
                renderInventory();
                renderActionSlots();
                updateBadge();
                saveSettingsToLocalStorage();
              } else {
                showNotice("กระเป๋าเต็มแล้ว! (Inventory Full)");
              }
            } : null
          });
          chestGrid.appendChild(slot);
        }

        // 2. Render Player Inventory slots inside Chest UI (20 slots)
        const playerGrid = document.getElementById("chestPlayerInventoryGrid");
        if (!playerGrid) return;
        playerGrid.innerHTML = "";

        for (let i = 0; i < TOTAL_SLOTS; i++) {
          const item = inventory[i];
          const isLocked = i >= UNLOCKED_SLOTS;
          const slot = createSlotElement({
            source: "chestPlayerInventory",
            index: i,
            item: item,
            isLocked: isLocked,
            onClick: (item && !isLocked) ? () => {
              // Click to put item into chest storage
              if (addItemToChest(item)) {
                if (item.count > 1) {
                  item.count -= 1;
                } else {
                  inventory[i] = null;
                }
                renderChest();
                renderInventory();
                renderActionSlots();
                updateBadge();
                saveSettingsToLocalStorage();
              } else {
                showNotice("กล่องเต็มแล้ว! (Chest Full)");
              }
            } : null
          });
          playerGrid.appendChild(slot);
        }
      }

      // Initialize chest event listeners once elements are ready
      document.addEventListener("DOMContentLoaded", () => {
        const inventoryOverlay = document.getElementById("inventoryOverlay");
        if (inventoryOverlay) {
          inventoryOverlay?.addEventListener("dragover", (e) => {
            if (e.target === inventoryOverlay) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          });
          inventoryOverlay?.addEventListener("drop", (e) => {
            if (e.target === inventoryOverlay) {
              handleTrashDrop(e);
            }
          });
        }
        
        const chestOverlay = document.getElementById("chestOverlay");
        if (chestOverlay) {
          chestOverlay?.addEventListener("dragover", (e) => {
            if (e.target === chestOverlay) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          });
          chestOverlay?.addEventListener("drop", (e) => {
            if (e.target === chestOverlay) {
              handleTrashDrop(e);
            }
          });
        }

        const chestClose = document.getElementById("chestClose");
        if (chestClose) {
          chestClose.onclick = () => {
            closeChest();
          };
        }

        const chestTakeAll = document.getElementById("chestTakeAllBtn");
        if (chestTakeAll) {
          chestTakeAll.onclick = () => {
            if (!currentOpenChest) return;
            let anyMoved = false;
            let isFull = false;

            for (let i = 0; i < 20; i++) {
              const item = currentOpenChest.storage[i];
              if (item) {
                let count = item.count;
                let successCount = 0;
                for (let c = 0; c < count; c++) {
                  if (addItemToInventory(item, false, false)) {
                    successCount++;
                  } else {
                    isFull = true;
                    break;
                  }
                }
                if (successCount > 0) {
                  anyMoved = true;
                  if (successCount === count) {
                    currentOpenChest.storage[i] = null;
                  } else {
                    item.count -= successCount;
                  }
                }
                if (isFull) break;
              }
            }

            if (anyMoved) {
              playCollectSound();
              renderChest();
              renderInventory();
              renderActionSlots();
              updateBadge();
            }

            if (isFull) {
              showNotice("กระเป๋าเต็มแล้ว! (Inventory Full)");
            }
          };
        }
      });

      function toggleInventory() {
        const overlay = document.getElementById("inventoryOverlay");
        const isCurrentlyOpen = overlay.classList.contains("open");

        if (isCurrentlyOpen) {
          saveSettingsToLocalStorage();
          closeInventoryActually();
        } else {
          overlay.classList.add("open");
          const qBtn = document.getElementById("quitGameBtn");
          if (qBtn) qBtn.style.display = "none";
          // คืนค่าการแสดงผลแท็บและปุ่มออกไปหน้าหลัก
          document.getElementById("tabInventory").style.display = "inline-flex";
          document.getElementById("tabCrafting").style.display = "inline-flex";
          document.getElementById("tabSettings").style.display = "inline-flex";
          document.getElementById("tabItemsList").style.display = isDevMode ? "inline-flex" : "none";
          document.getElementById("btnExitToMenu").style.display = "block";

          // รีเซ็ตแท็บแอคทีฟเป็น กระเป๋า (Inventory) เสมอตอนเปิดครั้งแรก
          activeTab = "inventory";
          document.getElementById("tabInventory").classList.add("active");
          document.getElementById("tabCrafting").classList.remove("active");
          document.getElementById("tabItemsList").classList.remove("active");
          document.getElementById("tabSettings").classList.remove("active");
          
          
        document.getElementById("tabCooking").classList.remove("active");
          document.getElementById("tabCooking").style.display = "none";
        document.getElementById("cookingList").style.display = "none";

        document.getElementById("inventoryGrid").style.display = "grid";
          document.getElementById("inventorySettings").style.display = "none";
          document.getElementById("craftingList").style.display = "none";
          
          const mainLayout = document.getElementById("inventoryMainLayout");
          if (mainLayout) {
            mainLayout.style.display = "flex";
            mainLayout.style.maxWidth = "none";
          }
          const divider = document.getElementById("inventoryVerticalDivider");
          if (divider) divider.style.display = "block";
          const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "flex";

          // Auto-enable move mode when inventory opens
          isMoveModeEnabled = true;

          renderInventory();
          renderActionSlots();

        }
      }

      function checkNpcMeleeHit(dmg = 1) {
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);

        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;
        
        const gSeed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : (typeof globalSeed !== "undefined" ? globalSeed : 0);
        const height = (typeof getHeightOnSphere === "function") ? getHeightOnSphere(charTheta, charPhi, gSeed) : 0;
        const terrainRadius = RADIUS + height * HEIGHT_SCALE;
        const charPos = [terrainRadius * nx, terrainRadius * ny, terrainRadius * nz];
        
        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
        const cosH = Math.cos(charHeading);
        const sinH = Math.sin(charHeading);
        const F = [
          North[0] * cosH + East[0] * sinH,
          North[1] * cosH + East[1] * sinH,
          North[2] * cosH + East[2] * sinH,
        ];

        const hitCenter = [charPos[0], charPos[1], charPos[2]];
        let hitTarget = null;
        let minScore = Infinity;

        // 1. Check amphibians (NPCs: Meganeura, Isopod, Placoderm, etc.) using exact axe/pickaxe reach calculation
        if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
          for (let npc of amphibians) {
            if (npc.ragdollEnabled || (npc.hp !== undefined && npc.hp <= 0)) continue;
            let nPos = npc.position || [0, 0, 0];
            if (npc.ragdollPos && npc.ragdollInitialized) {
              nPos = npc.ragdollPos;
            }

            const dx = nPos[0] - hitCenter[0];
            const dy = nPos[1] - hitCenter[1];
            const dz = nPos[2] - hitCenter[2];

            const h = dx * nx + dy * ny + dz * nz;
            const t = dx * F[0] + dy * F[1] + dz * F[2];

            const rx = dx - t * F[0];
            const ry = dy - t * F[1];
            const rz = dz - t * F[2];
            const distToRaySq = rx * rx + ry * ry + rz * rz;

            const physicalRadius = (typeof npc.radius === "number" ? npc.radius : (npc.type === "meganeura" ? 0.25 : (npc.type === "isopod" ? 0.35 : (npc.type === "placoderm" ? 0.65 : 0.3))));
            const hitRadius = physicalRadius;
            const hitRadiusSq = hitRadius * hitRadius;

            let isHit = false;
            let score = Infinity;

            if (actionReachMode === 1) {
              // Line Mode
              if (distToRaySq <= hitRadiusSq) {
                const distanceToSurface = Math.max(0, t - physicalRadius);
                if (t > 0.0 && distanceToSurface <= actionReachDistance && h >= -15.0 && h <= 15.0) {
                  isHit = true;
                  score = distToRaySq * 2.0 + t;
                }
              }
            } else {
              // Circle or Capsule Mode (matches checkMeleeHit with actionReachDistance + physicalRadius)
              const reachInfo = (typeof isTargetWithinReach === "function") ? isTargetWithinReach(nPos, actionReachDistance + physicalRadius) : null;
              if (reachInfo && reachInfo.valid) {
                isHit = true;
                score = reachInfo.perpSq;
              }
            }

            if (isHit && score < minScore) {
              minScore = score;
              hitTarget = { type: "amphibian", entity: npc };
            }
          }
        }

        // 2. Check Player Clones using exact reach calculation
        if (!hitTarget && typeof window !== "undefined" && Array.isArray(window.playerClonesState)) {
          for (let clone of window.playerClonesState) {
            if (!clone || (clone.hp !== undefined && clone.hp <= 0)) continue;
            let cPos = clone.position;
            if (!cPos && typeof clone.theta === "number" && typeof clone.phi === "number") {
              const cSinT = Math.sin(clone.theta);
              const cCosT = Math.cos(clone.theta);
              const cSinP = Math.sin(clone.phi);
              const cCosP = Math.cos(clone.phi);
              const cR = RADIUS + ((typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(clone.theta, clone.phi, gSeed) : 0) * HEIGHT_SCALE);
              cPos = [cR * cSinT * cCosP, cR * cCosT, cR * cSinT * cSinP];
            }
            if (!cPos) continue;

            const dx = cPos[0] - hitCenter[0];
            const dy = cPos[1] - hitCenter[1];
            const dz = cPos[2] - hitCenter[2];

            const h = dx * nx + dy * ny + dz * nz;
            const t = dx * F[0] + dy * F[1] + dz * F[2];

            const rx = dx - t * F[0];
            const ry = dy - t * F[1];
            const rz = dz - t * F[2];
            const distToRaySq = rx * rx + ry * ry + rz * rz;

            const physicalRadius = 0.25 * ((typeof playerScale === "number" ? playerScale : 0.1) / 0.1);
            const hitRadius = physicalRadius;
            const hitRadiusSq = hitRadius * hitRadius;

            let isHit = false;
            let score = Infinity;

            if (actionReachMode === 1) {
              if (distToRaySq <= hitRadiusSq) {
                const distanceToSurface = Math.max(0, t - physicalRadius);
                if (t > 0.0 && distanceToSurface <= actionReachDistance && h >= -15.0 && h <= 15.0) {
                  isHit = true;
                  score = distToRaySq * 2.0 + t;
                }
              }
            } else {
              const reachInfo = (typeof isTargetWithinReach === "function") ? isTargetWithinReach(cPos, actionReachDistance + physicalRadius) : null;
              if (reachInfo && reachInfo.valid) {
                isHit = true;
                score = reachInfo.perpSq;
              }
            }

            if (isHit && score < minScore) {
              minScore = score;
              hitTarget = { type: "clone", entity: clone };
            }
          }
        }

        if (hitTarget) {
          if (hitTarget.type === "amphibian") {
            const npc = hitTarget.entity;
            if (npc.hp === undefined) {
              const regHp = (window.NpcRegistry && window.NpcRegistry[npc.type]) ? window.NpcRegistry[npc.type].maxHp : 1;
              npc.hp = regHp;
              npc.maxHp = regHp;
            }
            npc.hp -= dmg;
            let hpHearts = "";
            for (let i = 0; i < npc.maxHp; i++) {
              hpHearts += i < npc.hp ? "🔴" : "⚪";
            }
            if (typeof showNotice === "function") {
              showNotice(`🌿💥 ฟาดด้วยกิ่งไม้! ทำดาเมจ ${dmg} จุด (Hit target! -${dmg} DMG) ${hpHearts}`);
            }
            if (npc.hp <= 0) {
              npc.ragdollEnabled = true;
              if (typeof showNotice === "function") {
                showNotice("💀 กำจัดเป้าหมายสำเร็จ! (Target eliminated!)");
              }
            } else {
              npc.ragdollEnabled = false;
            }

            npc.ragdollVel = [
              F[0] * 0.14,
              F[1] * 0.14,
              F[2] * 0.14
            ];
          } else if (hitTarget.type === "clone") {
            const clone = hitTarget.entity;
            if (clone.hp === undefined) {
              clone.hp = 3;
              clone.maxHp = 3;
            }
            clone.hp -= dmg;
            let hpHearts = "";
            for (let i = 0; i < clone.maxHp; i++) {
              hpHearts += i < clone.hp ? "🔴" : "⚪";
            }
            clone.emoji = "😵";
            clone.emojiTimer = 3.0;
            if (typeof showNotice === "function") {
              showNotice(`🌿💥 ฟาดโคลนด้วยกิ่งไม้! ทำดาเมจ ${dmg} จุด (Hit clone! -${dmg} DMG) ${hpHearts}`);
            }
          }

          if (typeof playSplashSound === "function") {
            playSplashSound(0.8);
          } else if (typeof playChopSound === "function") {
            playChopSound();
          }
          return hitTarget;
        }
        return null;
      }
      window.checkNpcMeleeHit = checkNpcMeleeHit;

      // Shared Tool Target Validation rule (Used by both player checkMeleeHit and PlayerClones)
      window.checkToolTargetValid = function(toolType, targetType) {
        if (!toolType || !targetType) return false;
        const normTool = String(toolType).toUpperCase();
        if (normTool === "AXE") {
          return targetType === "tree";
        }
        if (normTool === "PICKAXE") {
          return targetType === "rock" || targetType === "iron_ore" || targetType === "gold_ore" || targetType === "glow_ore";
        }
        if (normTool === "HAND") {
          return true;
        }
        return false;
      };

      // Shared Food Healing Rules
      window.getFoodItemHealAmount = function(itemName) {
        if (!itemName) return 0;
        const norm = String(itemName).toUpperCase();
        if (norm === "FRIED_BUG") return 5;
        if (norm === "BREAD") return 10;
        if (norm === "MEAT" || norm === "COOKED_MEAT") return 15;
        if (norm === "APPLE") return 4;
        return 0;
      };

      function checkMeleeHit(toolType) {
    const sinTheta = Math.sin(charTheta);
    const cosTheta = Math.cos(charTheta);
    const sinPhi = Math.sin(charPhi);
    const cosPhi = Math.cos(charPhi);

    const nx = sinTheta * cosPhi;
    const ny = cosTheta;
    const nz = sinTheta * sinPhi;
    
    const height = getHeightOnSphere(charTheta, charPhi, globalSeed);
    const terrainRadius = RADIUS + height * HEIGHT_SCALE;
    
    const charPos = [terrainRadius * nx, terrainRadius * ny, terrainRadius * nz];
    
    const East = [-sinPhi, 0, cosPhi];
    const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
    const cosH = Math.cos(charHeading);
    const sinH = Math.sin(charHeading);
    const F = [
      North[0] * cosH + East[0] * sinH,
      North[1] * cosH + East[1] * sinH,
      North[2] * cosH + East[2] * sinH,
    ];
    
    const hitCenter = [charPos[0], charPos[1], charPos[2]];
    
    let bestIndex = -1;
    let bestType = null;
    let minScore = Infinity;
    
    for (let i = 0; i < natureObstacles.length; i++) {
       const obs = natureObstacles[i];
       if (obs.type === "tree" || obs.type === "rock" || obs.type === "iron_ore" || obs.type === "gold_ore" || obs.type === "glow_ore") {
          if (toolType === "AXE" && obs.type !== "tree") continue;
          if (toolType === "PICKAXE" && obs.type === "tree") continue;
          
          const dx = obs.position[0] - hitCenter[0];
          const dy = obs.position[1] - hitCenter[1];
          const dz = obs.position[2] - hitCenter[2];
          
          const h = dx * obs.normal[0] + dy * obs.normal[1] + dz * obs.normal[2];
          const perpX = dx - h * obs.normal[0];
          const perpY = dy - h * obs.normal[1];
          const perpZ = dz - h * obs.normal[2];
          
          const t = dx * F[0] + dy * F[1] + dz * F[2];
          
          // Calculate perpendicular distance from object center to the ray
          const rx = dx - t * F[0];
          const ry = dy - t * F[1];
          const rz = dz - t * F[2];
          const distToRaySq = rx * rx + ry * ry + rz * rz;
          
          // Use exact object radius for hit detection (use physical trunk radius for trees to match action reach)
          const physicalRadius = obs.type === "tree" ? (obs.radius / 5.0) : obs.radius;
          const hitRadius = obs.radius; // still allow aiming at the full tree/rock volume
          const hitRadiusSq = hitRadius * hitRadius;
          
          let isHit = false;
          let score = Infinity;
          
          if (actionReachMode === 1) {
              if (distToRaySq <= hitRadiusSq) {
                  const distanceToSurface = Math.max(0, t - physicalRadius);
                  // Only hit if the object is in front of the character within the action reach distance
                  if (t > 0.0 && distanceToSurface <= actionReachDistance && h >= -15.0 && h <= 15.0) {
                      isHit = true;
                      score = distToRaySq * 2.0 + t;
                  }
              }
          } else {
              // Circle or Capsule Mode
              // The reach of the player to hit the obstacle includes the physical radius of the tree/rock
              const reachInfo = isTargetWithinReach(obs.position, actionReachDistance + physicalRadius);
              if (reachInfo.valid) {
                  isHit = true;
                  score = reachInfo.perpSq;
              }
          }
          
          if (isHit) {
              if (score < minScore) {
                  minScore = score;
                  bestIndex = i;
                  bestType = obs.type;
              }
          }
       }
    }
    
    if (bestIndex !== -1) {
       const obs = natureObstacles[bestIndex];
       const hitType = bestType;
       const hitIndex = bestIndex;
       
       if (toolType !== "HAND") { obs.hits = (obs.hits || 0) + 1; } else { obs.handHits = (obs.handHits || 0) + 1; }
       const requiredHits = 3;
       
       if (toolType === "AXE" && hitType === "tree" && typeof playChopSound === "function") playChopSound(obs.position);
       else if (toolType === "PICKAXE" && (hitType === "rock" || hitType === "iron_ore" || hitType === "gold_ore" || hitType === "glow_ore") && typeof playRockHitSound === "function") playRockHitSound(obs.position);
       else if (toolType === "HAND") { if (hitType === "tree" && typeof playChopSound === "function") playChopSound(obs.position); else if (hitType === "rock" && typeof playRockHitSound === "function") playRockHitSound(obs.position); if (obs.handHits >= 4) { obs.handHits = 0; const tNormal = obs.normal || [0, 1, 0]; let tTangent = [1, 0, 0]; if (Math.abs(tNormal[0]) > 0.9) tTangent = [0, 1, 0]; let tBitangent = [ tNormal[1] * tTangent[2] - tNormal[2] * tTangent[1], tNormal[2] * tTangent[0] - tNormal[0] * tTangent[2], tNormal[0] * tTangent[1] - tNormal[1] * tTangent[0] ]; const tBLen = Math.sqrt(tBitangent[0]*tBitangent[0] + tBitangent[1]*tBitangent[1] + tBitangent[2]*tBitangent[2]); tBitangent = [tBitangent[0]/tBLen, tBitangent[1]/tBLen, tBitangent[2]/tBLen]; tTangent = [ tBitangent[1] * tNormal[2] - tBitangent[2] * tNormal[1], tBitangent[2] * tNormal[0] - tBitangent[0] * tNormal[2], tBitangent[0] * tNormal[1] - tBitangent[1] * tNormal[0] ]; const dropType = hitType === "tree" ? "branch" : "rock"; const numDrops = 1 + Math.floor(Math.random() * 2); const dropColor = dropType === "rock" ? [0.5, 0.5, 0.5] : [0.5, 0.3, 0.15]; for (let i = 0; i < numDrops; i++) spawnDrop(obs.position, dropType, tNormal, tTangent, tBitangent, dropColor, 0.015 + Math.random() * 0.02, true); } }
       
       if (toolType !== "HAND" && obs.hits >= requiredHits) {
           console.log(toolType + " destroyed " + hitType + "!");
           
           const tNormal = obs.normal || [0, 1, 0];
           let tTangent = [1, 0, 0];
           if (Math.abs(tNormal[0]) > 0.9) tTangent = [0, 1, 0];
           let tBitangent = [
               tNormal[1] * tTangent[2] - tNormal[2] * tTangent[1],
               tNormal[2] * tTangent[0] - tNormal[0] * tTangent[2],
               tNormal[0] * tTangent[1] - tNormal[1] * tTangent[0]
           ];
           const tBLen = Math.sqrt(tBitangent[0]*tBitangent[0] + tBitangent[1]*tBitangent[1] + tBitangent[2]*tBitangent[2]);
           tBitangent = [tBitangent[0]/tBLen, tBitangent[1]/tBLen, tBitangent[2]/tBLen];
           tTangent = [
               tBitangent[1] * tNormal[2] - tBitangent[2] * tNormal[1],
               tBitangent[2] * tNormal[0] - tBitangent[0] * tNormal[2],
               tBitangent[0] * tNormal[1] - tBitangent[1] * tNormal[0]
           ];

           if (toolType === "AXE" && hitType === "tree") {
               const numLogs = 2 + Math.floor(Math.random() * 2);
               for (let i = 0; i < numLogs; i++) spawnDrop(obs.position, "log", tNormal, tTangent, tBitangent, [0.5, 0.3, 0.15], 0.075 + Math.random() * 0.025);
               const numBranches = 1 + Math.floor(Math.random() * 2);
               for (let i = 0; i < numBranches; i++) spawnDrop(obs.position, "branch", tNormal, tTangent, tBitangent, [0.4 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15], 0.015 + Math.random() * 0.02);
           } else if (toolType === "PICKAXE" && (hitType === "rock" || hitType === "iron_ore" || hitType === "gold_ore" || hitType === "glow_ore")) {
               if (hitType === "iron_ore") {
                   const numBig = 3 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numBig; i++) spawnDrop(obs.position, "iron_ore", tNormal, tTangent, tBitangent, [0.45, 0.22, 0.18], 0.045 + Math.random() * 0.02);
                   const numSmall = 1 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numSmall; i++) spawnDrop(obs.position, "rock", tNormal, tTangent, tBitangent, [0.4, 0.4, 0.4], 0.02 + Math.random() * 0.02);
               } else if (hitType === "gold_ore") {
                   const numBig = 2 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numBig; i++) spawnDrop(obs.position, "gold_ore", tNormal, tTangent, tBitangent, [0.85, 0.68, 0.12], 0.045 + Math.random() * 0.02);
                   const numSmall = 1 + Math.floor(Math.random() * 1);
                   for (let i = 0; i < numSmall; i++) spawnDrop(obs.position, "rock", tNormal, tTangent, tBitangent, [0.4, 0.4, 0.4], 0.02 + Math.random() * 0.02);
               } else if (hitType === "glow_ore") {
                   const numBig = 2 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numBig; i++) spawnDrop(obs.position, "glow_ore", tNormal, tTangent, tBitangent, [0.22, 0.95, 0.88], 0.045 + Math.random() * 0.02);
                   const numSmall = 1 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numSmall; i++) spawnDrop(obs.position, "rock", tNormal, tTangent, tBitangent, [0.4, 0.4, 0.4], 0.02 + Math.random() * 0.02);
               } else {
                   const numBig = 2 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numBig; i++) spawnDrop(obs.position, "big_rock", tNormal, tTangent, tBitangent, [0.5, 0.5, 0.5], 0.05 + Math.random() * 0.03);
                   const numSmall = 2 + Math.floor(Math.random() * 2);
                   for (let i = 0; i < numSmall; i++) spawnDrop(obs.position, "rock", tNormal, tTangent, tBitangent, [0.4, 0.4, 0.4], 0.02 + Math.random() * 0.02);
               }
           } else if (toolType === "HAND") {
               const dropType = hitType === "tree" ? "branch" : "rock";
               const numDrops = 1 + Math.floor(Math.random() * 2);
               const dropColor = dropType === "rock" ? [0.5, 0.5, 0.5] : [0.5, 0.3, 0.15];
               for (let i = 0; i < numDrops; i++) spawnDrop(obs.position, dropType, tNormal, tTangent, tBitangent, dropColor, 0.015 + Math.random() * 0.02, true);
           }
           
           if (hitType === "tree") choppedTrees.push(obs.id);
           else destroyedRocks.push(obs.id);
           
           natureObstacles.splice(hitIndex, 1);
           
           if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
               const startF = obs.meshStart * 3;
               const endF = obs.meshEnd * 3;
               for (let j = startF; j < endF; j++) {
                   natureRawVertices[j] = 0;
               }
               gl.bindBuffer(gl.ARRAY_BUFFER, natureVertexBuffer);
               gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(natureRawVertices.slice(startF, endF)));
           }
           // refreshCollectiblesVBO();
       }
    }
    return (bestIndex !== -1);
}

function spawnDrop(pos, type, normal, tangent, bitangent, color, size, isHand=false) {
   const offsetRadius = 0.002 + Math.random() * 0.005;
   const offsetAngle = Math.random() * Math.PI * 2;
   const hOffset = 0.005 + Math.random() * 0.01;
   
   const dx = tangent[0]*offsetRadius*Math.cos(offsetAngle) + bitangent[0]*offsetRadius*Math.sin(offsetAngle) + normal[0]*hOffset;
   const dy = tangent[1]*offsetRadius*Math.cos(offsetAngle) + bitangent[1]*offsetRadius*Math.sin(offsetAngle) + normal[1]*hOffset;
   const dz = tangent[2]*offsetRadius*Math.cos(offsetAngle) + bitangent[2]*offsetRadius*Math.sin(offsetAngle) + normal[2]*hOffset;

   const collectible = {
       type: type,
       position: [pos[0] + dx, pos[1] + dy, pos[2] + dz],
       normal: normal,
       R: tangent,
       F: bitangent,
       U: normal,
       color: color,
       size: size,
       active: true,
       isDynamic: true,
       seed: Math.random()
   };
   
   if (isHand) {
       collectible.vel = [dx*0.01 + (Math.random()-0.5)*0.001, dy*0.01 + (Math.random()-0.5)*0.001, dz*0.01 + (Math.random()-0.5)*0.001];
       collectible.spin = [(Math.random()-0.5)*0.05, (Math.random()-0.5)*0.05, (Math.random()-0.5)*0.05];
       collectible.spinSpeed = 0.01 + Math.random()*0.02;
   }
   
   collectibles.push(collectible);
   if (typeof window !== "undefined") window.pendingDynamicCollectibleRefresh = true;
}

function cancelFloorPlacement() {
        if (isPlacingFloor) {
          isPlacingFloor = false;
          floorPlacementInfo = null;
          if (floorPreviewCollectible) {
            const idx = collectibles.indexOf(floorPreviewCollectible);
            if (idx !== -1) {
              collectibles.splice(idx, 1);
            }
            floorPreviewCollectible = null;
            pendingCollectibleRefresh = true;
            if (typeof refreshCollectiblesVBO === 'function') refreshCollectiblesVBO('preview');
          }
        }
      }

      function getSuppressRadius(type, size) {
          const t = (type || "").toLowerCase();
          const s = typeof size === "number" ? size : 0.25;
          if (t === "stone_floor") {
              return s * 10.0;
          }
          if (t === "wood_floor" || t === "thin_wood_floor") {
              return s * 2.4;
          }
          if (t === "campfire") {
              return s * 1.6;
          }
          return s * 2.4;
      }

      function suppressGrassUnder(pos, radius) {
          console.log('suppressGrassUnder', pos, radius);

          if (typeof grassChunks === 'undefined' || !natureRawVertices) return;
          let modified = false;
          let minStartF = Infinity;
          let maxEndF = 0;
          const rSq = radius * radius;
          
          for (let i = 0; i < grassChunks.length; i++) {
              const chunk = grassChunks[i];
              const dx = chunk.pos[0] - pos[0];
              const dy = chunk.pos[1] - pos[1];
              const dz = chunk.pos[2] - pos[2];
              
              if (dx*dx + dy*dy + dz*dz > (chunk.radius + radius) * (chunk.radius + radius)) {
                  continue; // Chunk is too far
              }
              
              // Check individual triangles in the chunk
              const startF = chunk.start * 3;
              const endF = (chunk.start + chunk.count) * 3;
              let chunkModified = false;
              let chunkMin = Infinity;
              let chunkMax = 0;
              
              for (let j = startF; j < endF; j += 9) {
                  // Triangle center
                  const cx = (natureRawVertices[j] + natureRawVertices[j+3] + natureRawVertices[j+6]) / 3;
                  const cy = (natureRawVertices[j+1] + natureRawVertices[j+4] + natureRawVertices[j+7]) / 3;
                  const cz = (natureRawVertices[j+2] + natureRawVertices[j+5] + natureRawVertices[j+8]) / 3;
                  
                  const vx = cx - pos[0];
                  const vy = cy - pos[1];
                  const vz = cz - pos[2];
                  
                  if (vx*vx + vy*vy + vz*vz < rSq) {
                      natureRawVertices[j] = 0; natureRawVertices[j+1] = 0; natureRawVertices[j+2] = 0;
                      natureRawVertices[j+3] = 0; natureRawVertices[j+4] = 0; natureRawVertices[j+5] = 0;
                      natureRawVertices[j+6] = 0; natureRawVertices[j+7] = 0; natureRawVertices[j+8] = 0;
                      chunkModified = true;
                      if (j < chunkMin) chunkMin = j;
                      if (j + 9 > chunkMax) chunkMax = j + 9;
                  }
              }
              
              if (chunkModified) {
                  console.log('Modified grass chunk, zeroed triangles!');
                  modified = true;
                  gl.bindBuffer(gl.ARRAY_BUFFER, natureVertexBuffer);
                  gl.bufferSubData(gl.ARRAY_BUFFER, chunkMin * 4, new Float32Array(natureRawVertices.slice(chunkMin, chunkMax)));
              }
          }
      }
      
      function placeFloor() {
        if (!isPlacingFloor || !floorPreviewCollectible) return;
        
        if (floorPreviewCollectible.isValidPlacement === false) {
           if (floorPreviewCollectible.type === "folding_ladder") {
             showNotice("ส่วนหัวและท้ายของบันไดต้องติดพื้นทั้ง 2 ด้าน และห้ามวางบนน้ำ! (Both ends must touch ground and cannot be placed on water)");
           } else {
             showNotice("พื้นที่ไม่เหมาะสมสำหรับการวาง! (Invalid placement)");
           }
           return;
        }

        // Play wood place sound
        playPlaceSound();

        const placingItemName = floorPlacementInfo && floorPlacementInfo.item ? floorPlacementInfo.item.name : "";

        // Convert preview to a static placed structure!
        floorPreviewCollectible.isPreview = false;
        floorPreviewCollectible.isDynamic = false;
        floorPreviewCollectible.color = placingItemName === "STONE_FLOOR" ? [0.6, 0.6, 0.6] : [0.65, 0.45, 0.25]; // beautiful wood color
        
        // Remove grass under placed structure & destroy overlapping trees/rocks for stone floor without drops
        if (placingItemName === "STONE_FLOOR" || placingItemName === "WOOD_FLOOR" || placingItemName === "THIN_WOOD_FLOOR" || placingItemName === "WOOD_ROOF" || placingItemName === "WOOD_WALL" || placingItemName === "WOOD_WINDOW" || placingItemName === "WOOD_DOOR" || placingItemName === "CAMPFIRE") {
            const rad = getSuppressRadius(placingItemName, floorPreviewCollectible.size);
            suppressGrassUnder(floorPreviewCollectible.position, rad);
        }

        if (placingItemName === "STONE_FLOOR") {
            const fpPos = floorPreviewCollectible.position;
            const clearRadSq = 3.2 * 3.2; // Destroy trees and rocks within stone floor area
            let obstaclesChanged = false;

            const nObs = (typeof natureObstacles !== "undefined" && natureObstacles) ? natureObstacles : (window.natureObstacles || []);
            for (let i = nObs.length - 1; i >= 0; i--) {
                const obs = nObs[i];
                if (!obs || !obs.position) continue;
                const dx = obs.position[0] - fpPos[0];
                const dy = obs.position[1] - fpPos[1];
                const dz = obs.position[2] - fpPos[2];
                if (dx * dx + dy * dy + dz * dz <= clearRadSq) {
                    if (obs.type === "tree") {
                        if (typeof choppedTrees !== "undefined") choppedTrees.push(obs.id);
                        else if (window.choppedTrees) window.choppedTrees.push(obs.id);
                    } else {
                        if (typeof destroyedRocks !== "undefined") destroyedRocks.push(obs.id);
                        else if (window.destroyedRocks) window.destroyedRocks.push(obs.id);
                    }

                    const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;
                    const vBuffer = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : window.natureVertexBuffer;
                    if (obs.meshStart !== undefined && obs.meshEnd !== undefined && rawVerts) {
                        const startF = obs.meshStart * 3;
                        const endF = obs.meshEnd * 3;
                        for (let j = startF; j < endF; j++) {
                            rawVerts[j] = 0;
                        }
                        if (typeof gl !== "undefined" && gl && vBuffer) {
                            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
                            gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(rawVerts.slice(startF, endF)));
                        }
                    }

                    nObs.splice(i, 1);
                    obstaclesChanged = true;
                }
            }

            // if (obstaclesChanged && typeof refreshCollectiblesVBO === "function") {
            //    refreshCollectiblesVBO();
            // }
        }
        
        if (placingItemName === "WOOD_BOAT") {
            floorPreviewCollectible.isDynamic = true;
            floorPreviewCollectible.vel = [0, 0, 0];
            floorPreviewCollectible.spinAxis = [0, 1, 0];
            floorPreviewCollectible.spinSpeed = 0;
            // If placed in water, slightly above water so it can drop and float into buoyancy
            let isWaterPlacement = (typeof waterEnabled !== "undefined" && waterEnabled);
            let pR_len = Math.sqrt(floorPreviewCollectible.position[0]**2 + floorPreviewCollectible.position[1]**2 + floorPreviewCollectible.position[2]**2) || 1;
            let pTheta = Math.acos(Math.max(-1.0, Math.min(1.0, floorPreviewCollectible.position[1] / pR_len)));
            let pPhi = Math.atan2(floorPreviewCollectible.position[2], floorPreviewCollectible.position[0]);
            let pHeight = getHeightOnSphere(pTheta, pPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            let pTerrainR = RADIUS + pHeight * HEIGHT_SCALE;
            let pWaterR = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel : 0) * 0.15;
            if (isWaterPlacement && pTerrainR < pWaterR) {
                floorPreviewCollectible.position[0] += floorPreviewCollectible.normal[0] * 0.05;
                floorPreviewCollectible.position[1] += floorPreviewCollectible.normal[1] * 0.05;
                floorPreviewCollectible.position[2] += floorPreviewCollectible.normal[2] * 0.05;
            }
        }
        
        if (placingItemName === "WOOD_STAIRS" || placingItemName === "FOLDING_LADDER") {
          floorPreviewCollectible.type = placingItemName === "FOLDING_LADDER" ? "folding_ladder" : "wood_stairs";
          // Copy top and bottom points and orientation vectors so they are permanently saved
          if (floorPreviewCollectible.stairTop) {
            floorPreviewCollectible.stairTop = [...floorPreviewCollectible.stairTop];
          }
          if (floorPreviewCollectible.stairBottom) {
            floorPreviewCollectible.stairBottom = [...floorPreviewCollectible.stairBottom];
          }
          if (floorPreviewCollectible.normal) {
            floorPreviewCollectible.normal = [...floorPreviewCollectible.normal];
          }
          if (floorPreviewCollectible.R) {
            floorPreviewCollectible.R = [...floorPreviewCollectible.R];
          }
          if (floorPreviewCollectible.F) {
            floorPreviewCollectible.F = [...floorPreviewCollectible.F];
          }
        } else if (placingItemName === "CAMPFIRE") {
          floorPreviewCollectible.type = "campfire";
          floorPreviewCollectible.size = campfireSize; // Use dynamic size from devtool
          // Set exact ground-flush position (0.002 offset) for the placed campfire
          const n = floorPreviewCollectible.normal;
          const len = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]) || 1;
          const pnx = n[0]/len, pny = n[1]/len, pnz = n[2]/len;
          
          let previewTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pny)));
          let previewPhi = Math.atan2(pnz, pnx);
          let groundRad = RADIUS + getHeightOnSphere(previewTheta, previewPhi, globalSeed) * HEIGHT_SCALE;
          const waterRadius = RADIUS + waterLevel * 0.15;
          if (waterEnabled && groundRad < waterRadius) groundRad = waterRadius;
          const exactGroundRad = groundRad + 0.002;
          floorPreviewCollectible.position = [pnx * exactGroundRad, pny * exactGroundRad, pnz * exactGroundRad];
        } else if (placingItemName === "WOOD_BOAT") {
          floorPreviewCollectible.type = "wood_boat";
          floorPreviewCollectible.angle = placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "ELECTRIC_ENGINE" || placingItemName === "WOOD_WHEEL" || placingItemName === "BOAT_WING") {
          floorPreviewCollectible.type = placingItemName === "ELECTRIC_ENGINE" ? "electric_engine" : (placingItemName === "BOAT_WING" ? "boat_wing" : "wood_wheel");
          floorPreviewCollectible.angle = placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;

          let nearestBoat = null;
          let bestDist = Infinity;
          for (let c of collectibles) {
            if (c.active && !c.isPreview && c.type === "wood_boat") {
              const dx = c.position[0] - floorPreviewCollectible.position[0];
              const dy = c.position[1] - floorPreviewCollectible.position[1];
              const dz = c.position[2] - floorPreviewCollectible.position[2];
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (dist < bestDist) {
                bestDist = dist;
                nearestBoat = c;
              }
            }
          }
          if (nearestBoat && bestDist < 3.5) {
            if (placingItemName === "WOOD_WHEEL") {
              nearestBoat.hasWheel = true;
              nearestBoat.hasWheels = true;
              floorPreviewCollectible.active = false;
              if (typeof showNotice === "function") {
                showNotice("⚙️ ติดล้อไม้กับเรือเรียบร้อย! เรือสามารถขับบนบกได้แล้ว (Wooden Wheel attached! Boat can now drive on land)");
              }
            } else if (placingItemName === "ELECTRIC_ENGINE") {
              nearestBoat.hasEngine = true;
              floorPreviewCollectible.active = false;
              if (typeof showNotice === "function") {
                showNotice("🔋 ติดตั้งเครื่องยนต์ไฟฟ้าเรียบร้อย! เรือมีความเร็วและแรงบิดสูงขึ้น (Electric Engine attached!)");
              }
            } else if (placingItemName === "BOAT_WING") {
              nearestBoat.hasWing = true;
              nearestBoat.hasWings = true;
              floorPreviewCollectible.active = false;
              if (typeof showNotice === "function") {
                if (nearestBoat.hasEngine) {
                  showNotice("🪽 ติดตั้งปีกกับเรือเรียบร้อย! กด Shift เพื่อเปิดโหมดบิน | กด W บินไปข้างหน้า | กด Z ดิ่งลง");
                } else {
                  showNotice("🪽 ติดตั้งปีกกับเรือเรียบร้อย! (ต้องติดตั้งเครื่องยนต์ไฟฟ้าก่อนจึงจะบินได้)");
                }
              }
            }
          }
        } else if (placingItemName === "WOOD_WALL") {
          floorPreviewCollectible.type = "wood_wall";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_WINDOW") {
          floorPreviewCollectible.type = "wood_window";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_DOOR") {
          floorPreviewCollectible.type = "wood_door";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.doorAngle = 0.0;
          floorPreviewCollectible.doorVel = 0.0;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_CHEST") {
          floorPreviewCollectible.type = "wood_chest";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
          floorPreviewCollectible.storage = Array(20).fill(null);
        } else if (placingItemName === "MEGANEURA") {
          floorPreviewCollectible.type = "meganeura_item";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "ISOPOD") {
          floorPreviewCollectible.type = "isopod_item";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName.startsWith("ROBOT_")) {
          floorPreviewCollectible.type = placingItemName.toLowerCase();
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
        } else if (placingItemName === "WOOD_ROOF") {
          floorPreviewCollectible.type = "wood_roof";
          floorPreviewCollectible.angle = (typeof floorPreviewCollectible.angle === "number") ? floorPreviewCollectible.angle : placementRotationAngle;
          floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
        } else {
          floorPreviewCollectible.type = placingItemName === "STONE_FLOOR" ? "stone_floor" : (placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor" : "wood_floor");
          floorPreviewCollectible.layer = placingItemName === "STONE_FLOOR" ? COLLISION_LAYERS.STONE_FLOOR : COLLISION_LAYERS.WOOD_FLOOR;
        }

        floorPreviewCollectible.isPreview = false;
        floorPreviewCollectible.isPlayerPlaced = true;
        floorPreviewCollectible.isWorldGenerated = false;
        floorPreviewCollectible.hideFromCompass = false;
        floorPreviewCollectible.isHouse = false;
        floorPreviewCollectible.isProceduralHouse = false;
        floorPreviewCollectible.isRuin = false;

        collectibles.push(floorPreviewCollectible);
        
        // Remove 1 item from player's inventory or action slot
        const info = floorPlacementInfo;
        if (info && info.item) {
          if (info.item.count > 1) {
            info.item.count--;
          } else {
            if (info.source === "inventory") inventory[info.index] = null;
            else actionSlotsItems[info.index] = null;
            
            // Clear selection if slot is empty
            if (info.source === "action" && selectedActionSlotIndex === info.index) {
              selectedActionSlotIndex = -1;
            }
          }
        }

        // Refresh UI
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderActionSlots === "function") renderActionSlots();
        if (typeof updateBadge === "function") updateBadge();

        // Check if player still has items in the active slot/inventory
        let stillHasItems = false;
        if (info && info.item && info.item.count > 0 && info.item.name === placingItemName) {
          stillHasItems = true;
        }

        if (stillHasItems) {
          // Keep placing, spawn a new preview of the same type
          const typeToPlace = placingItemName.startsWith("ROBOT_") ? placingItemName.toLowerCase() : (placingItemName === "STONE_FLOOR" ? "stone_floor" : (placingItemName === "WOOD_STAIRS" ? "wood_stairs" : (placingItemName === "FOLDING_LADDER" ? "folding_ladder" : (placingItemName === "CAMPFIRE" ? "campfire" : (placingItemName === "WOOD_BOAT" ? "wood_boat" : (placingItemName === "ELECTRIC_ENGINE" ? "electric_engine" : (placingItemName === "BOAT_WING" ? "boat_wing" : (placingItemName === "WOOD_WHEEL" ? "wood_wheel" : (placingItemName === "WOOD_WALL" ? "wood_wall" : (placingItemName === "WOOD_WINDOW" ? "wood_window" : (placingItemName === "WOOD_DOOR" ? "wood_door" : (placingItemName === "WOOD_ROOF" ? "wood_roof" : (placingItemName === "WOOD_CHEST" ? "wood_chest" : (placingItemName === "MEGANEURA" ? "meganeura_item" : (placingItemName === "ISOPOD" ? "isopod_item" : (placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor" : "wood_floor"))))))))))))))));
          floorPreviewCollectible = {
            type: typeToPlace,
            position: [0, 0, 0],
            normal: [0, 1, 0],
            R: [1, 0, 0],
            F: [0, 0, 1],
            U: [0, 1, 0],
            color: [0.95, 0.85, 0.45], // preview color
            size: typeToPlace === "campfire" ? campfireSize : 0.25,
            active: true,
            isDynamic: false,
            isPreview: true,
            seed: Math.random(),
            angle: placementRotationAngle
          };
          if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "wood_boat" || typeToPlace === "wood_wheel" || typeToPlace === "electric_engine" || typeToPlace === "boat_wing" || typeToPlace.startsWith("robot_")) {
            floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
          } else if (typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_roof") {
            floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
          } else if (typeToPlace === "stone_floor") {
            floorPreviewCollectible.layer = COLLISION_LAYERS.STONE_FLOOR;
          }
        } else {
          // Out of items, exit placement
          isPlacingFloor = false;
          floorPlacementInfo = null;
          floorPreviewCollectible = null;
        }

        // Force WebGL buffer refresh
        pendingCollectibleRefresh = true;
      }

      function findArrowInInventory() {
        for (let i = 0; i < actionSlotsItems.length; i++) {
          const slot = actionSlotsItems[i];
          if (slot && slot.name === "ARROW" && slot.count > 0) {
            return { type: "action", index: i, item: slot };
          }
        }
        for (let i = 0; i < inventory.length; i++) {
          const slot = inventory[i];
          if (slot && slot.name === "ARROW" && slot.count > 0) {
            return { type: "inventory", index: i, item: slot };
          }
        }
        return null;
      }

      function consumeArrow(arrowRef) {
        if (arrowRef.type === "action") {
          const slot = actionSlotsItems[arrowRef.index];
          slot.count--;
          if (slot.count <= 0) {
            actionSlotsItems[arrowRef.index] = null;
          }
        } else {
          const slot = inventory[arrowRef.index];
          slot.count--;
          if (slot.count <= 0) {
            inventory[arrowRef.index] = null;
          }
        }
        renderInventory();
        renderActionSlots();
        updateBadge();
        saveSettingsToLocalStorage();
      }

      function shootArrowProjectile(drawPower = 1.0) {
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);
        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;
        
        let height = getHeightOnSphere(charTheta, charPhi, globalSeed);
        let terrainRadius = RADIUS + height * HEIGHT_SCALE;
        let groundRadius = terrainRadius;
        const waterRadius = RADIUS + waterLevel * 0.15;
        if (waterEnabled && terrainRadius < waterRadius) {
            groundRadius = waterRadius;
        }
        
        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
        const cosH = Math.cos(charHeading);
        const sinH = Math.sin(charHeading);
        
        const F_char = [
          North[0] * cosH + East[0] * sinH,
          North[1] * cosH + East[1] * sinH,
          North[2] * cosH + East[2] * sinH,
        ];
        
        const headOffset = 0.6 * playerScale;
        let startPos = [
          nx * (groundRadius + headOffset) + F_char[0] * 0.2 * playerScale,
          ny * (groundRadius + headOffset) + F_char[1] * 0.2 * playerScale,
          nz * (groundRadius + headOffset) + F_char[2] * 0.2 * playerScale
        ];
        
        let arrowDir = [];
        if (typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps")) {
            let targetPoint = null;
            if (activeTargetNPC && activeTargetNPC.position) {
                const npc = activeTargetNPC;
                const npc_pos = npc.position;
                const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
                const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [nx, ny, nz];
                const N = npc.N || n_npc;
                const F = npc.F || [0, 0, 0];
                let upOffset = 0.0;
                let forwardOffset = 0.0;
                if (npc.type === "meganeura") {
                    upOffset = 0.0;
                    forwardOffset = -0.06;
                } else {
                    upOffset = -0.02;
                    forwardOffset = -0.12;
                }
                targetPoint = [
                    npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
                    npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
                    npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
                ];
            } else {
                const clampedPitch = Math.max(-0.5, Math.min(1.2, rotationX));
                const cosP = Math.cos(clampedPitch);
                const sinP = Math.sin(clampedPitch);
                const cosY = Math.cos(rotationY);
                const sinY = Math.sin(rotationY);

                const camDirOnPlane = [
                    -North[0] * cosY - East[0] * sinY,
                    -North[1] * cosY - East[1] * sinY,
                    -North[2] * cosY - East[2] * sinY,
                ];
                const camDir = [
                    camDirOnPlane[0] * cosP + nx * sinP,
                    camDirOnPlane[1] * cosP + ny * sinP,
                    camDirOnPlane[2] * cosP + nz * sinP,
                ];
                const lookDir = [-camDir[0], -camDir[1], -camDir[2]];
                
                const headHeight = 0.45 * playerScale;
                const basePlayerHeadPos = [
                    nx * groundRadius + nx * headHeight,
                    ny * groundRadius + ny * headHeight,
                    nz * groundRadius + nz * headHeight,
                ];
                const shoulderOffset = -0.9 * playerScale;
                const camRight = [
                    East[0] * cosY - North[0] * sinY,
                    East[1] * cosY - North[1] * sinY,
                    East[2] * cosY - North[2] * sinY
                ];
                const playerHeadPos = [
                    basePlayerHeadPos[0] + camRight[0] * shoulderOffset,
                    basePlayerHeadPos[1] + camRight[1] * shoulderOffset,
                    basePlayerHeadPos[2] + camRight[2] * shoulderOffset
                ];
                
                // Use actual camera distance if available, to match exactly what the user sees
                const actualCamDist = typeof currentSmoothDistance !== "undefined" ? currentSmoothDistance : (1.0 + (zoom - 3.5) * 0.4) * (playerScale / 0.22);
                const eyePos = [
                    playerHeadPos[0] + camDir[0] * actualCamDist,
                    playerHeadPos[1] + camDir[1] * actualCamDist,
                    playerHeadPos[2] + camDir[2] * actualCamDist,
                ];
                
                // Raymarch from eyePos along lookDir to find what the crosshair is pointing at
                let currentDist = 1.0;
                const maxDist = 50.0;
                const step = 0.5;
                
                while (currentDist < maxDist) {
                    const testPos = [
                        eyePos[0] + lookDir[0] * currentDist,
                        eyePos[1] + lookDir[1] * currentDist,
                        eyePos[2] + lookDir[2] * currentDist,
                    ];
                    
                    const distToCenter = Math.sqrt(testPos[0]**2 + testPos[1]**2 + testPos[2]**2);
                    if (distToCenter > 0.001) {
                        const ux = testPos[0] / distToCenter;
                        const uy = testPos[1] / distToCenter;
                        const uz = testPos[2] / distToCenter;
                        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
                        const phi = Math.atan2(uz, ux);
                        const h = getHeightOnSphere(theta, phi, globalSeed);
                        const terrainRadius = RADIUS + h * HEIGHT_SCALE;
                        
                        const wRadius = RADIUS + waterLevel * 0.15;
                        const checkRad = waterEnabled ? Math.max(terrainRadius, wRadius) : terrainRadius;
                        
                        if (distToCenter <= checkRad + 0.1) {
                            targetPoint = testPos;
                            break;
                        }
                    }
                    currentDist += step;
                }
                
                if (!targetPoint) {
                    targetPoint = [
                        eyePos[0] + lookDir[0] * maxDist,
                        eyePos[1] + lookDir[1] * maxDist,
                        eyePos[2] + lookDir[2] * maxDist,
                    ];
                }
            }
            
            arrowDir = [
                targetPoint[0] - startPos[0],
                targetPoint[1] - startPos[1],
                targetPoint[2] - startPos[2],
            ];
        } else {
            const aimPitch = -rotationX * 0.5 + 0.15;
            arrowDir = [
              F_char[0] * Math.cos(aimPitch) + nx * Math.sin(aimPitch),
              F_char[1] * Math.cos(aimPitch) + ny * Math.sin(aimPitch),
              F_char[2] * Math.cos(aimPitch) + nz * Math.sin(aimPitch)
            ];
        }

        const isCannon = activeItem && (activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON");

        if (window.lastBowGripPos && window.lastBowAimDir && (window.lastBowAimDir[0] !== 0 || window.lastBowAimDir[1] !== 0 || window.lastBowAimDir[2] !== 0)) {
            const clearance = isCannon ? 0.09 * (playerScale / 0.1) : 0.05;
            startPos = [
                window.lastBowGripPos[0] + window.lastBowAimDir[0] * clearance,
                window.lastBowGripPos[1] + window.lastBowAimDir[1] * clearance,
                window.lastBowGripPos[2] + window.lastBowAimDir[2] * clearance
            ];
            arrowDir = [
                window.lastBowAimDir[0],
                window.lastBowAimDir[1],
                window.lastBowAimDir[2]
            ];
        } else {
            let dLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
            if (dLen > 0) {
              arrowDir[0] /= dLen;
              arrowDir[1] /= dLen;
              arrowDir[2] /= dLen;
            }
        }

        // Direct arrow trajectory exactly towards currentAimTargetPos
        if (window.currentAimTargetPos) {
            const toTarget = [
                window.currentAimTargetPos[0] - startPos[0],
                window.currentAimTargetPos[1] - startPos[1],
                window.currentAimTargetPos[2] - startPos[2]
            ];
            const tLen = Math.hypot(toTarget[0], toTarget[1], toTarget[2]);
            if (tLen > 0.001) {
                arrowDir = [toTarget[0] / tLen, toTarget[1] / tLen, toTarget[2] / tLen];
            }
        }

        // Only bows not locked add slight upward arc pitch angle; cannon fires 100% straight
        if (!isCannon && !window.isAimTargetLocked) {
            const pitchUpAngle = 0.05 * (1.0 - drawPower) + 0.01;
            arrowDir[0] += nx * pitchUpAngle;
            arrowDir[1] += ny * pitchUpAngle;
            arrowDir[2] += nz * pitchUpAngle;
        }
        
        let dLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
        if (dLen > 0) {
          arrowDir[0] /= dLen;
          arrowDir[1] /= dLen;
          arrowDir[2] /= dLen;
        }
        
        // Base speed for full draw (cannon has higher initial muzzle velocity)
        const speed = (isCannon ? 1.15 : (0.2 + (0.6 * drawPower))) * playerScale; 
        const arrowVel = [
          arrowDir[0] * speed,
          arrowDir[1] * speed,
          arrowDir[2] * speed
        ];
        
        const f_arrow = [arrowDir[0], arrowDir[1], arrowDir[2]];
        let r_arrow = [
          f_arrow[1]*nx - f_arrow[2]*ny,
          f_arrow[2]*nx - f_arrow[0]*nz,
          f_arrow[0]*ny - f_arrow[1]*nx
        ];
        const lenR = Math.sqrt(r_arrow[0]**2 + r_arrow[1]**2 + r_arrow[2]**2);
        if (lenR > 0.001) {
          r_arrow = [r_arrow[0]/lenR, r_arrow[1]/lenR, r_arrow[2]/lenR];
        } else {
          r_arrow = [1, 0, 0];
        }
        const u_arrow = [
          r_arrow[1]*f_arrow[2] - r_arrow[2]*f_arrow[1],
          r_arrow[2]*f_arrow[0] - r_arrow[0]*f_arrow[2],
          r_arrow[0]*f_arrow[1] - r_arrow[1]*f_arrow[0]
        ];
        
        const arrowCollectible = {
          type: "arrow",
          position: [startPos[0], startPos[1], startPos[2]],
          vel: arrowVel,
          normal: u_arrow,
          R: r_arrow,
          F: f_arrow,
          U: u_arrow,
          color: isCannon ? [0.62, 0.44, 0.26] : [0.55, 0.4, 0.25],
          size: 0.1,
          active: true,
          isDynamic: true,
          seed: Math.random(),
          // Hybrid Animation + Physics parameters
          sourceWeapon: isCannon ? "WOODEN_ARM_CANNON" : "BOW",
          isCannonShot: !!isCannon,
          animPhaseActive: !!isCannon,
          animElapsed: 0,
          animMaxTime: 0.25, // Pure animated barrel exit phase
          animOrigin: [startPos[0], startPos[1], startPos[2]],
          animDir: [arrowDir[0], arrowDir[1], arrowDir[2]],
          animSpeed: speed,
          ignorePlayer: true
        };
        
        collectibles.push(arrowCollectible);
        window.pendingDynamicCollectibleRefresh = true;
        
        if (typeof playPlaceSound === "function") {
          playPlaceSound();
        }
      }

      function useItem(item, index, source, isAltAction = false) {
        if (!item) return;
        console.log("Using item:", item);
        const itemName = item.name || item.label || "";
        const itemDef = (typeof getItemDefinition === "function") ? getItemDefinition(itemName) : (window.getItemDefinition ? window.getItemDefinition(itemName) : null);
        
        let isPlaceable = false;
        if (typeof isPlaceableItem === "function") {
          isPlaceable = isPlaceableItem(itemName);
        } else if (window.isPlaceableItem) {
          isPlaceable = window.isPlaceableItem(itemName);
        } else if (itemDef) {
          const checkCat = Array.isArray(itemDef.category) ? itemDef.category.includes("PRE_PLACE") : itemDef.category === "PRE_PLACE";
          let isValid = checkCat;
          if (checkCat) {
             if ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) ||
                 (typeof activeRidingMech !== "undefined" && activeRidingMech)) {
                 isValid = false;
             }
          }
          isPlaceable = isValid;
        }

        if (itemName === "FRIED_BUG") {
          activeItem = item;
          isUsingItem = true;
          if (playerHP < playerMaxHP) {
            playerHP = Math.min(playerMaxHP, playerHP + 5);
            updatePlayerHPUI();
            showNotice("กินแมลงทอด! ฟื้นฟู HP 5 ช่อง (Ate fried bug! HP +5)");
            consumeItem("FRIED_BUG", 1);
            if (source === "action") renderActionSlots();
            else renderInventory();
            if (typeof playCollectSound === "function") playCollectSound();
          } else {
            showNotice("HP เต็มแล้ว! (HP is full!)");
          }
          setTimeout(() => {
            isUsingItem = false;
            activeItem = null;
          }, 300);
        } else if (itemName === "AXE") {
          activeItem = item;
          useAnimTimer = 1.0;
          isUsingItem = true;
          checkMeleeHit("AXE");
        } else if (itemName === "PICKAXE") {
          activeItem = item;
          useAnimTimer = 1.0;
          isUsingItem = true;
          checkMeleeHit("PICKAXE");
        } else if (itemName === "SHOVEL") {
          activeItem = item;
          useAnimTimer = 1.0;
          isUsingItem = true;
          checkMeleeHit("SHOVEL");
          
          if (isAltAction) {
              const forwardPoint = calculateForwardTarget();
              // Use a reasonable radius (0.05 rad = 40cm) to cleanly expand and connect with the existing hole (0.08 rad = 64cm)
              if (forwardPoint) {
                  modTerrainAtPlayer(-0.35, true, forwardPoint, 0.05, "trench");
              }
          } else {
              // Trigger the digging terrain modifications (dig down)!
              modTerrainAtPlayer(-0.35, true);
          }
        } else if (itemName === "BOW") {
          showNotice("🚫 คันธนูถูกปิดใช้งาน กรุณาใช้ปืนไม้ติดแขน (ARM CANNON) แทน!");
          return;
        } else if (itemName === "WOODEN_ARM_CANNON" || itemName === "ARM_CANNON") {
          const arrowRef = findArrowInInventory();
          if (!arrowRef) {
            showNotice("🏹 ลูกธนูไม่เพียงพอ! (No arrows!)");
            return;
          }
          // Animation 01a09186-787b-771f-b4ee-5b234572bcef trimmed 1.40s to 2.47s (total 1.07s)
          useAnimTimer = 1.07;
          bowComboActive = false;
          activeItem = item;
          isUsingItem = true;
          arrowShotInCurrentAnim = false;
        } else if (isPlaceable || itemName.startsWith("ROBOT_")) {
          if ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech)) {
            showNotice("🚫 ไม่สามารถวางไอเทมขณะอยู่บนพาหนะได้ (Cannot place items while riding)");
            return;
          }
          // ไอเทมหมวดหมู่ พรี-วาง (PRE_PLACE) เข้าสู่โหมดพรีวิววางสิ่งปลูกสร้าง
          isPlacingFloor = true;
          placementRotationAngle = 0.0;
          floorPlacementInfo = { item, index, source };
          closeInventoryActually();
          if (source === "action") {
            selectedActionSlotIndex = index;
            renderActionSlots();
          }
        } else if (itemName === "LOG") {
          // Remove 1 item
          if (item.count > 1) {
            item.count--;
          } else {
            if (source === "inventory") inventory[index] = null;
            else actionSlotsItems[index] = null;
            // Clear selection if slot is empty
            if (source === "action" && selectedActionSlotIndex === index) {
                selectedActionSlotIndex = -1;
            }
          }
          if (typeof renderInventory === "function") renderInventory();
          if (typeof renderActionSlots === "function") renderActionSlots();
          if (typeof updateBadge === "function") updateBadge();
          
          spawnLogInFront();
        } else if (itemName === "BRANCH" || itemName === "branch") {
          // Trigger basic swing animation with the branch held in hand
          activeItem = { ...item, name: "BRANCH" };
          useAnimTimer = 1.0;
          isUsingItem = true;

          if (typeof playChopSound === "function") {
            playChopSound();
          }

          // Deal 1 damage ONLY when melee hit connects with an NPC within reach (using axe/pickaxe reach system)
          const hitTarget = (typeof checkNpcMeleeHit === "function") ? checkNpcMeleeHit(1) : null;

          // Branch only breaks and disappears upon successfully hitting an NPC!
          if (hitTarget) {
            if (item.count > 1) {
              item.count--;
            } else {
              if (source === "inventory") {
                inventory[index] = null;
              } else {
                actionSlotsItems[index] = null;
              }
              if (source === "action" && selectedActionSlotIndex === index) {
                selectedActionSlotIndex = -1;
              }
            }

            if (typeof renderInventory === "function") renderInventory();
            if (typeof renderActionSlots === "function") renderActionSlots();
            if (typeof updateBadge === "function") updateBadge();

            if (typeof showNotice === "function") {
              showNotice("🌿 กิ่งไม้ฟาดโดนเป้าหมายจนหักพังแล้ว! (Branch hit target and broke!)");
            }
          }
        } else {
          // ไอเทมประเภทวัตถุดิบ/ทั่วไป (NONE) ที่ไม่ได้มีฟังก์ชันกดใช้โดยตรง
          if (itemDef) {
            const usageText = itemDef.usage_th || "ใช้เป็นวัตถุดิบคราฟต์และอื่นๆ";
            showNotice(`📦 [${itemDef.name_th}] เป็นไอเทมประเภทวัตถุดิบ (NONE): ${usageText}`);
          }
        }
      }

      function performSmashActionLogic() {
        checkMeleeHit("HAND");
        setTimeout(() => {
          isUsingItem = false;
          isSmashing = false; 
          activeItem = originalItem;
        }, 500);
      }

      function performSmashAction() {
        console.log("Performing smash action...");
        useAnimTimer = 1.0;
        isUsingItem = true;
        isSmashing = true; 
        
        originalItem = activeItem; 
        activeItem = { name: "HAND" }; 
        
        performSmashActionLogic();
      }
      
      let originalItem = null;

      function handleDragStart(e, source, index) {
        let item = getSlotItem(source, index);

        if (!item) {
          e.preventDefault();
          return;
        }

        e.dataTransfer.setData("source", source);
        e.dataTransfer.setData("index", index);
        e.dataTransfer.setData("text/plain", JSON.stringify({ source, index }));
        e.dataTransfer.effectAllowed = "move";

        const target = e.currentTarget;
        target.classList.add("dragging");

        if (e.dataTransfer && typeof e.dataTransfer.setDragImage === "function") {
          const offsetX = target.offsetWidth ? target.offsetWidth / 2 : 28;
          const offsetY = target.offsetHeight ? target.offsetHeight / 2 : 28;
          e.dataTransfer.setDragImage(target, offsetX, offsetY);
        }

        setTimeout(() => {
          target.classList.add("dragging-active");
          target.classList.remove("dragging");
        }, 0);
      }

      function handleDragEnd(e) {
        e.currentTarget.classList.remove("dragging");
        e.currentTarget.classList.remove("dragging-active");
        
        // Remove dragover class from all slots just in case
        document.querySelectorAll(".inventory-slot, .action-slot").forEach(slot => {
          slot.classList.remove("dragover");
        });
      }

      function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("dragover");
      }

      function handleDragLeave(e) {
        e.currentTarget.classList.remove("dragover");
      }

      function handleDrop(e, targetSource, targetIndex) {
        e.preventDefault();
        e.currentTarget.classList.remove("dragover");

        try {
          let source = e.dataTransfer.getData("source");
          let sourceIndex = parseInt(e.dataTransfer.getData("index"), 10);
          if (!source) {
            const dataStr = e.dataTransfer.getData("text/plain");
            if (dataStr) {
              const data = JSON.parse(dataStr);
              source = data.source;
              sourceIndex = data.index;
            }
          }

          if (!source || isNaN(sourceIndex)) return;
          if (source === targetSource && sourceIndex === targetIndex) return;

          let fromItem = getSlotItem(source, sourceIndex);
          let toItem = getSlotItem(targetSource, targetIndex);

          if (!fromItem) return;

          const fromName = fromItem.name || fromItem.label;
          const toName = toItem ? (toItem.name || toItem.label) : null;

          // Stacking if dropping onto same item type
          if (toItem && fromName === toName) {
            toItem.count = (toItem.count || 1) + (fromItem.count || 1);
            setSlotItem(source, sourceIndex, null);
          } else {
            // Swap/Move items
            setSlotItem(source, sourceIndex, toItem);
            setSlotItem(targetSource, targetIndex, fromItem);
          }

          if (currentOpenChest) renderChest();
          renderInventory();
          renderActionSlots();
          updateBadge();
          saveSettingsToLocalStorage();
        } catch (err) {
          console.error("Drop error", err);
        }
      }

      let _activeNoticeToast = null;
      let _activeNoticeTimer = null;
      let _activeNoticeFadeTimer = null;
      let _lastNoticeMsg = "";
      let _lastNoticeTime = 0;

      function showNotice(msg) {
        // Essential gamepad connection and flight notices should always be displayed to players
        const isEssentialNotice = typeof msg === "string" && (msg.includes("🎮") || msg.includes("🪽"));
        if (!isDevMode && !isEssentialNotice) {
          return; // ซ่อนการแจ้งเตือนทั้งหมดในโหมดเซฟ
        }
        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        if (msg === _lastNoticeMsg && now - _lastNoticeTime < 1500) {
          return; // ป้องกันการเรียกซ้ำรัวๆ จาก game loop / render loop
        }
        _lastNoticeMsg = msg;
        _lastNoticeTime = now;

        if (!_activeNoticeToast) {
          _activeNoticeToast = document.createElement("div");
          _activeNoticeToast.style.position = "fixed";
          _activeNoticeToast.style.bottom = "100px";
          _activeNoticeToast.style.left = "50%";
          _activeNoticeToast.style.transform = "translateX(-50%)";
          _activeNoticeToast.style.background = "rgba(10, 10, 15, 0.9)";
          _activeNoticeToast.style.color = "#34d399";
          _activeNoticeToast.style.border = "1px solid rgba(52, 211, 153, 0.4)";
          _activeNoticeToast.style.padding = "10px 20px";
          _activeNoticeToast.style.borderRadius = "8px";
          _activeNoticeToast.style.fontFamily = "'Google Sans', sans-serif";
          _activeNoticeToast.style.fontSize = "13px";
          _activeNoticeToast.style.zIndex = "999999";
          _activeNoticeToast.style.pointerEvents = "none";
          _activeNoticeToast.style.boxShadow = "0 8px 32px rgba(0,0,0,0.6)";
          _activeNoticeToast.style.transition = "opacity 0.25s, transform 0.25s";
          document.body.appendChild(_activeNoticeToast);
        }

        if (_activeNoticeTimer) clearTimeout(_activeNoticeTimer);
        if (_activeNoticeFadeTimer) clearTimeout(_activeNoticeFadeTimer);

        let finalMsg = msg;
        if (window.GamepadController && typeof window.GamepadController.formatPromptText === "function") {
          finalMsg = window.GamepadController.formatPromptText(finalMsg);
        }
        const curLang = typeof getGameLanguage === "function" ? getGameLanguage() : (window.gameLanguage || "en");
        if (curLang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") {
          finalMsg = window.Seedian.toSeedian(msg);
        }

        if (typeof window.setElementTextOrHTML === "function") {
          window.setElementTextOrHTML(_activeNoticeToast, finalMsg);
        } else if (typeof finalMsg === "string" && (finalMsg.includes("<svg") || finalMsg.includes("<span"))) {
          _activeNoticeToast.innerHTML = finalMsg;
        } else {
          _activeNoticeToast.textContent = finalMsg;
        }

        _activeNoticeToast.style.opacity = "1";
        _activeNoticeToast.style.transform = "translateX(-50%) translateY(0)";

        _activeNoticeTimer = setTimeout(() => {
          if (_activeNoticeToast) {
            _activeNoticeToast.style.opacity = "0";
            _activeNoticeToast.style.transform = "translateX(-50%) translateY(10px)";
            _activeNoticeFadeTimer = setTimeout(() => {
              if (_activeNoticeToast) {
                _activeNoticeToast.remove();
                _activeNoticeToast = null;
              }
            }, 300);
          }
        }, 2500);
      }

      function getItemCount(name) {
        let total = 0;
        // Check inventory (unlocked slots)
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          const item = inventory[i];
          if (item && (item.name === name || item.label === name)) {
            total += item.count || 1;
          }
        }
        // Check action slots
        for (let i = 0; i < actionSlotsItems.length; i++) {
          const item = actionSlotsItems[i];
          if (item && (item.name === name || item.label === name)) {
            total += item.count || 1;
          }
        }
        return total;
      }

      function consumeItem(name, count) {
        let remaining = count;
        
        // Consume from inventory first
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          if (remaining <= 0) break;
          const item = inventory[i];
          if (item && (item.name === name || item.label === name)) {
            if (item.count > remaining) {
              item.count -= remaining;
              remaining = 0;
            } else {
              remaining -= item.count;
              inventory[i] = null;
            }
          }
        }
        
        // Consume from action slots
        for (let i = 0; i < actionSlotsItems.length; i++) {
          if (remaining <= 0) break;
          const item = actionSlotsItems[i];
          if (item && (item.name === name || item.label === name)) {
            if (item.count > remaining) {
              item.count -= remaining;
              remaining = 0;
            } else {
              remaining -= item.count;
              actionSlotsItems[i] = null;
              if (selectedActionSlotIndex === i) {
                selectedActionSlotIndex = -1;
              }
            }
          }
        }
      }

      
      const COOKING_RECIPES = [
        {
          id: "fried_bug",
          output: { name: "FRIED_BUG", icon: "🍤", count: 1, label: "แมลงทอด (FRIED BUG) x1" },
          ingredients: [
            { name: "MEGANEURA", icon: "🦟", count: 1, label: "แมลงยักษ์ (MEGANEURA)" }
          ]
        }
      ];

            function openCookingUI() {
        document.getElementById("inventoryOverlay").classList.add("open");
        document.getElementById("tabCooking").style.display = "inline-flex";
        
        // Hide other tabs
        document.getElementById("tabInventory").style.display = "none";
        document.getElementById("tabItemsList").style.display = "none";
        document.getElementById("tabSettings").style.display = "none";
        document.getElementById("tabCrafting").style.display = "none";
        document.getElementById("quitGameBtn").style.display = "none";
        
        activeTab = "cooking";
        document.getElementById("tabInventory").classList.remove("active");
        document.getElementById("tabItemsList").classList.remove("active");
        document.getElementById("tabSettings").classList.remove("active");
        document.getElementById("tabCrafting").classList.remove("active");
        document.getElementById("tabCooking").classList.add("active");
        
        document.getElementById("inventoryGrid").style.display = "none";
        document.getElementById("inventorySettings").style.display = "none";
        document.getElementById("craftingList").style.display = "none";
        document.getElementById("cookingList").style.display = "flex";
        
        renderCooking();
      }

      function renderCooking() {
        window.renderCooking = renderCooking;
        const list = document.getElementById("cookingList");
        list.innerHTML = "";
        
        COOKING_RECIPES.forEach(recipe => {
          const card = document.createElement("div");
          card.style.background = "rgba(255, 255, 255, 0.03)";
          card.style.border = "1px solid rgba(255, 255, 255, 0.08)";
          card.style.borderRadius = "0px";
          card.style.padding = "12px";
          card.style.display = "flex";
          card.style.flexDirection = "column";
          card.style.gap = "8px";

          const cardHeader = document.createElement("div");
          cardHeader.style.display = "flex";
          cardHeader.style.alignItems = "center";
          cardHeader.style.justifyContent = "space-between";

          const itemInfo = document.createElement("div");
          itemInfo.style.display = "flex";
          itemInfo.style.alignItems = "center";
          itemInfo.style.gap = "8px";

          const itemIcon = document.createElement("span");
          itemIcon.style.fontSize = "24px";
          itemIcon.style.display = "inline-flex";
          itemIcon.style.alignItems = "center";
          itemIcon.style.justifyContent = "center";

          const canvas3D = create3DIconCanvas(recipe.output, 40, 40);
          if (canvas3D) {
            itemIcon.appendChild(canvas3D);
          } else {
            itemIcon.textContent = recipe.output.icon;
          }

          const itemName = document.createElement("span");
          itemName.style.fontFamily = "'Google Sans', sans-serif";
          itemName.style.fontWeight = "bold";
          itemName.style.fontSize = "14px";
          itemName.style.color = "#df6c6c";
          const outName = typeof getItemDisplayName === "function" ? getItemDisplayName(recipe.output.name) : recipe.output.name;
          const outNameStr = outName + (recipe.output.count > 1 ? ` x${recipe.output.count}` : "");
          if (typeof window.setElementTextOrHTML === "function") {
            window.setElementTextOrHTML(itemName, outNameStr);
          } else {
            itemName.textContent = outNameStr;
          }

          itemInfo.appendChild(itemIcon);
          itemInfo.appendChild(itemName);
          cardHeader.appendChild(itemInfo);

          const ingContainer = document.createElement("div");
          ingContainer.style.display = "flex";
          ingContainer.style.flexDirection = "column";
          ingContainer.style.gap = "4px";
          ingContainer.style.background = "rgba(0, 0, 0, 0.2)";
          ingContainer.style.padding = "6px 10px";
          ingContainer.style.borderRadius = "0px";

          let canCraft = true;
          recipe.ingredients.forEach(ing => {
            const currentCount = getItemCount(ing.name);
            const isEnough = currentCount >= ing.count;
            if (!isEnough) {
              canCraft = false;
            }
            const ingLine = document.createElement("div");
            ingLine.style.display = "flex";
            ingLine.style.justifyContent = "space-between";
            ingLine.style.alignItems = "center";
            ingLine.style.fontSize = "12px";
            ingLine.style.fontFamily = "'Google Sans', sans-serif";

            const ingLeft = document.createElement("span");
            ingLeft.style.display = "flex";
            ingLeft.style.alignItems = "center";
            ingLeft.style.gap = "6px";
            
            const ingIconSpan = document.createElement("span");
            ingIconSpan.style.display = "inline-flex";
            ingIconSpan.style.alignItems = "center";
            ingIconSpan.style.justifyContent = "center";

            const canvas3D = create3DIconCanvas(ing, 22, 22);
            if (canvas3D) {
              ingIconSpan.appendChild(canvas3D);
            } else {
              ingIconSpan.textContent = ing.icon;
            }
            
            const ingLabelSpan = document.createElement("span");
            const ingDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(ing.name) : (ing.label || ing.name);
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(ingLabelSpan, ingDispName);
            } else {
              ingLabelSpan.textContent = ingDispName;
            }
            
            ingLeft.appendChild(ingIconSpan);
            ingLeft.appendChild(ingLabelSpan);

            const ingRight = document.createElement("span");
            ingRight.style.color = isEnough ? "#34d399" : "#f87171";
            ingRight.textContent = `${currentCount} / ${ing.count}`;

            ingLine.appendChild(ingLeft);
            ingLine.appendChild(ingRight);
            ingContainer.appendChild(ingLine);
          });

          card.appendChild(cardHeader);
          card.appendChild(ingContainer);

          const btn = document.createElement("button");
          btn.style.width = "100%";
          btn.style.padding = "8px 0";
          btn.style.fontFamily = "'Google Sans', sans-serif";
          btn.style.fontWeight = "bold";
          btn.style.fontSize = "12px";
          btn.style.cursor = canCraft ? "pointer" : "not-allowed";
          btn.style.transition = "all 0.2s";
          btn.style.clipPath = "polygon(0% 0%, 96% 0%, 100% 8px, 100% 100%, 4% 100%, 0% calc(100% - 8px))";
          if (canCraft) {
            btn.style.background = "rgba(223, 108, 108, 0.15)";
            btn.style.border = "1px solid #df6c6c";
            btn.style.color = "#df6c6c";
            btn.style.textShadow = "0 0 6px rgba(223, 108, 108, 0.4)";
            const cookLabel = typeof t === "function" ? t("cook_btn") : "ทำอาหาร (Cook)";
            btn.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <span>${cookLabel}</span>
              </div>
            `;
            
            btn.onmouseenter = () => {
              btn.style.background = "rgba(223, 108, 108, 0.3)";
              btn.style.boxShadow = "0 0 12px rgba(223, 108, 108, 0.15)";
            };
            btn.onmouseleave = () => {
              btn.style.background = "rgba(223, 108, 108, 0.15)";
              btn.style.boxShadow = "none";
            };
            btn.onclick = () => {
              recipe.ingredients.forEach(ing => {
                consumeItem(ing.name, ing.count);
              });
              addItemToInventory({
                name: recipe.output.name,
                label: recipe.output.name,
                icon: recipe.output.icon,
                count: recipe.output.count || 1
              });
              renderCooking();
              renderInventory();
              if (typeof playCollectSound === "function") {
                playCollectSound();
              }
            };
          } else {
            btn.style.background = "rgba(255, 255, 255, 0.05)";
            btn.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            btn.style.color = "rgba(255, 255, 255, 0.3)";
            const insufficientLabel = typeof t === "function" ? t("insufficient_materials") : "วัตถุดิบไม่เพียงพอ (Insufficient Materials)";
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(btn, insufficientLabel);
            } else {
              btn.textContent = insufficientLabel;
            }
            btn.disabled = true;
          }

          card.appendChild(btn);
          list.appendChild(card);
        });
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.renderCooking = renderCooking;

      function renderCrafting() {
        window.renderCrafting = renderCrafting;
        const craftingList = document.getElementById("craftingList");
        if (!craftingList) return;
        craftingList.innerHTML = "";

        const CRAFTING_RECIPES = [
          {
            id: "axe",
            output: { name: "AXE", icon: "🪓", label: "ขวาน (AXE)" },
            ingredients: [
              { name: "ROCK", icon: "🪨", count: 1, label: "หิน (ROCK)" },
              { name: "BRANCH", icon: "🌿", count: 3, label: "กิ่งไม้ (BRANCH)" }
            ]
          },
          {
            id: "wood_chest",
            output: { name: "WOOD_CHEST", icon: "📦", count: 1, label: "กล่องไม้ (WOODEN CHEST) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 2, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "shovel",
            output: { name: "SHOVEL", icon: "🥄", count: 1, label: "พลั่ว (SHOVEL) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" },
              { name: "BIG_ROCK", icon: "🪨", count: 1, label: "หินใหญ่ (BIG ROCK)" }
            ]
          },
          {
            id: "pickaxe",
            output: { name: "PICKAXE", icon: "⛏️", label: "อีเตอร์ (PICKAXE)" },
            ingredients: [
              { name: "ROCK", icon: "🪨", count: 2, label: "หิน (ROCK)" },
              { name: "BRANCH", icon: "🌿", count: 3, label: "กิ่งไม้ (BRANCH)" }
            ]
          },
          {
            id: "campfire",
            output: { name: "CAMPFIRE", icon: "🔥", label: "กองไฟ (CAMPFIRE)" },
            ingredients: [
              { name: "BRANCH", icon: "🌿", count: 5, label: "กิ่งไม้ (BRANCH)" },
              { name: "ROCK", icon: "🪨", count: 5, label: "หิน (ROCK)" }
            ]
          },
          {
            id: "wood_boat",
            output: { name: "WOOD_BOAT", icon: "🛶", label: "เรือไม้ (WOOD BOAT)" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 3, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_wheel",
            output: { name: "WOOD_WHEEL", icon: "🛞", count: 1, label: "ล้อไม้ (WOODEN WHEEL) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 4, label: "ท่อนไม้ (LOG)" },
              { name: "IRON_ORE", icon: "🟥", count: 5, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "electric_engine",
            output: { name: "ELECTRIC_ENGINE", icon: "🔋", count: 1, label: "เครื่องยนต์ไฟฟ้า (ELECTRIC ENGINE) x1" },
            ingredients: [
              { name: "IRON_ORE", icon: "🟥", count: 10, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "boat_wing",
            output: { name: "BOAT_WING", icon: "🪽", count: 1, label: "ปีกเรือ (BOAT WING) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 4, label: "ท่อนไม้ (LOG)" },
              { name: "BRANCH", icon: "🌿", count: 6, label: "กิ่งไม้ (BRANCH)" }
            ]
          },
          {
            id: "glow_battery",
            output: { name: "GLOW_BATTERY", icon: "🔋", count: 1, label: "หินเรืองแสงอัดแท่ง(แบต) (GLOWING BATTERY ROD) x1" },
            ingredients: [
              { name: "GLOW_ORE", icon: "✨", count: 1, label: "แร่หินเรืองแสง (GLOWING ORE)" }
            ]
          },
          {
            id: "stone_floor", output: { name: "STONE_FLOOR", icon: "🪨", count: 1, label: "พื้นหิน (STONE FLOOR) x1" }, ingredients: [ { name: "BIG_ROCK", icon: "🪨", count: 10, label: "หินใหญ่ (BIG ROCK)" } ]
          },
          {
            id: "wood_floor",
            output: { name: "WOOD_FLOOR", icon: "🪵", count: 4, label: "พื้นไม้ (WOOD FLOOR) x4" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_stairs",
            output: { name: "WOOD_STAIRS", icon: "🪜", count: 2, label: "บันไดไม้ (WOOD STAIRS) x2" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "folding_ladder",
            output: { name: "FOLDING_LADDER", icon: "🪜", count: 2, label: "บันไดพับ (FOLDING LADDER) x2" },
            ingredients: [
              { name: "IRON_ORE", icon: "🟥", count: 1, label: "แร่เหล็ก (IRON ORE)" }
            ]
          },
          {
            id: "wood_wall",
            output: { name: "WOOD_WALL", icon: "🧱", count: 3, label: "กำแพงไม้ (WOOD WALL) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_window",
            output: { name: "WOOD_WINDOW", icon: "🪟", count: 3, label: "หน้าต่างไม้ (WOOD WINDOW) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "thin_wood_floor",
            output: { name: "THIN_WOOD_FLOOR", icon: "🪵", count: 3, label: "พื้นบาง (THIN WOOD FLOOR) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_door",
            output: { name: "WOOD_DOOR", icon: "🚪", count: 1, label: "ประตูไม้ (WOOD DOOR) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "wood_roof",
            output: { name: "WOOD_ROOF", icon: "🛖", count: 3, label: "หลังคาไม้ (WOOD ROOF) x3" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "arrow",
            output: { name: "ARROW", icon: "🏹", count: 30, label: "ลูกธนู (ARROW) x30" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 1, label: "ท่อนไม้ (LOG)" },
              { name: "BIG_ROCK", icon: "🪨", count: 1, label: "หินใหญ่ (BIG ROCK)" }
            ]
          },
          {
            id: "wooden_arm_cannon",
            output: { name: "WOODEN_ARM_CANNON", icon: "🪵🦾", count: 1, label: "ปืนไม้ติดแขน (ARM CANNON) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 2, label: "ท่อนไม้ (LOG)" },
              { name: "BIG_ROCK", icon: "🪨", count: 1, label: "หินใหญ่ (BIG ROCK)" }
            ]
          },
          {
            id: "robot_stand",
            output: { name: "ROBOT_STAND", icon: "🏗️", count: 1, label: "ฐานตั้งหุ่นยนต์ (ROBOT STAND) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 3, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_cockpit",
            output: { name: "ROBOT_COCKPIT", icon: "🤖", count: 1, label: "ห้องนักบินหุ่นยนต์ (COCKPIT) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_left_arm",
            output: { name: "ROBOT_LEFT_ARM", icon: "🦾", count: 1, label: "แขนซ้ายหุ่นยนต์ (LEFT ARM) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_right_arm",
            output: { name: "ROBOT_RIGHT_ARM", icon: "🦾", count: 1, label: "แขนขวาหุ่นยนต์ (RIGHT ARM) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_left_leg",
            output: { name: "ROBOT_LEFT_LEG", icon: "🦿", count: 1, label: "ขาซ้ายหุ่นยนต์ (LEFT LEG) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          },
          {
            id: "robot_right_leg",
            output: { name: "ROBOT_RIGHT_LEG", icon: "🦿", count: 1, label: "ขาขวาหุ่นยนต์ (RIGHT LEG) x1" },
            ingredients: [
              { name: "LOG", icon: "🪵", count: 10, label: "ท่อนไม้ (LOG)" }
            ]
          }
        ];

        CRAFTING_RECIPES.forEach(recipe => {
          const card = document.createElement("div");
          card.style.background = "rgba(255, 255, 255, 0.03)";
          card.style.border = "1px solid rgba(255, 255, 255, 0.08)";
          card.style.borderRadius = "0px";
          card.style.padding = "12px";
          card.style.display = "flex";
          card.style.flexDirection = "column";
          card.style.gap = "8px";

          // Header: Item to craft
          const cardHeader = document.createElement("div");
          cardHeader.style.display = "flex";
          cardHeader.style.alignItems = "center";
          cardHeader.style.justifyContent = "space-between";

          const itemInfo = document.createElement("div");
          itemInfo.style.display = "flex";
          itemInfo.style.alignItems = "center";
          itemInfo.style.gap = "8px";

          const itemIcon = document.createElement("span");
          itemIcon.style.fontSize = "24px";
          itemIcon.style.display = "inline-flex";
          itemIcon.style.alignItems = "center";
          itemIcon.style.justifyContent = "center";
          const canvas3D = create3DIconCanvas(recipe.output, 40, 40);
          if (canvas3D) {
            itemIcon.appendChild(canvas3D);
          } else {
            itemIcon.textContent = recipe.output.icon;
          }

          const itemName = document.createElement("span");
          itemName.style.fontFamily = "'Google Sans', sans-serif";
          itemName.style.fontWeight = "bold";
          itemName.style.fontSize = "14px";
          itemName.style.color = "#dfb76c";
          const outName = typeof getItemDisplayName === "function" ? getItemDisplayName(recipe.output.name) : recipe.output.name;
          const outNameStr = outName + (recipe.output.count > 1 ? ` x${recipe.output.count}` : "");
          if (typeof window.setElementTextOrHTML === "function") {
            window.setElementTextOrHTML(itemName, outNameStr);
          } else {
            itemName.textContent = outNameStr;
          }

          itemInfo.appendChild(itemIcon);
          itemInfo.appendChild(itemName);

          cardHeader.appendChild(itemInfo);

          // Ingredients list
          const ingContainer = document.createElement("div");
          ingContainer.style.display = "flex";
          ingContainer.style.flexDirection = "column";
          ingContainer.style.gap = "4px";
          ingContainer.style.background = "rgba(0, 0, 0, 0.2)";
          ingContainer.style.padding = "6px 10px";
          ingContainer.style.borderRadius = "0px";

          let canCraft = true;

          recipe.ingredients.forEach(ing => {
            const currentCount = getItemCount(ing.name);
            const isEnough = currentCount >= ing.count;
            if (!isEnough) {
              canCraft = false;
            }

            const ingLine = document.createElement("div");
            ingLine.style.display = "flex";
            ingLine.style.justifyContent = "space-between";
            ingLine.style.alignItems = "center";
            ingLine.style.fontSize = "12px";
            ingLine.style.fontFamily = "'Google Sans', sans-serif";

            const ingLeft = document.createElement("span");
            ingLeft.style.display = "flex";
            ingLeft.style.alignItems = "center";
            ingLeft.style.gap = "6px";
            const ingIconSpan = document.createElement("span");
            ingIconSpan.style.display = "inline-flex";
            ingIconSpan.style.alignItems = "center";
            ingIconSpan.style.justifyContent = "center";
            const canvas3D = create3DIconCanvas(ing, 22, 22);
            if (canvas3D) {
              ingIconSpan.appendChild(canvas3D);
            } else {
              ingIconSpan.textContent = ing.icon;
            }
            
            const ingLabelSpan = document.createElement("span");
            const ingDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(ing.name) : (ing.label || ing.name);
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(ingLabelSpan, ingDispName);
            } else {
              ingLabelSpan.textContent = ingDispName;
            }
            
            ingLeft.innerHTML = "";
            ingLeft.appendChild(ingIconSpan);
            ingLeft.appendChild(ingLabelSpan);

            const ingRight = document.createElement("span");
            ingRight.style.color = isEnough ? "#34d399" : "#f87171";
            ingRight.textContent = `${currentCount} / ${ing.count}`;

            ingLine.appendChild(ingLeft);
            ingLine.appendChild(ingRight);
            ingContainer.appendChild(ingLine);
          });

          card.appendChild(cardHeader);
          card.appendChild(ingContainer);

          // Craft button
          const btn = document.createElement("button");
          btn.style.width = "100%";
          btn.style.padding = "8px 0";
          btn.style.fontFamily = "'Google Sans', sans-serif";
          btn.style.fontWeight = "bold";
          btn.style.fontSize = "12px";
          btn.style.cursor = canCraft ? "pointer" : "not-allowed";
          btn.style.transition = "all 0.2s";
          btn.style.clipPath = "polygon(0% 0%, 96% 0%, 100% 8px, 100% 100%, 4% 100%, 0% calc(100% - 8px))";
          

          if (canCraft) {
            btn.style.background = "rgba(223, 183, 108, 0.15)";
            btn.style.border = "1px solid #dfb76c";
            btn.style.color = "#dfb76c";
            btn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
            const craftLabel = typeof t === "function" ? t("craft_btn") : "คราฟไอเทม (Craft)";
            btn.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                  <path d="m15 12-8.5 8.5a2.1 2.1 0 1 1-3-3L12 9" />
                  <path d="M17.64 15 22 10.64a2.41 2.41 0 0 0 0-3.41L16.77 2.3a2.41 2.41 0 0 0-3.41 0L9 6.64" />
                  <path d="m20 8-5 5" />
                </svg>
                <span>${craftLabel}</span>
              </div>
            `;
            
            btn.onmouseenter = () => {
              btn.style.background = "rgba(223, 183, 108, 0.3)";
              btn.style.boxShadow = "0 0 12px rgba(223, 183, 108, 0.15)";
            };
            btn.onmouseleave = () => {
              btn.style.background = "rgba(223, 183, 108, 0.15)";
              btn.style.boxShadow = "none";
            };
            
            btn.onclick = () => {
              craftItem(recipe.id);
            };
          } else {
            btn.style.background = "rgba(255, 255, 255, 0.05)";
            btn.style.border = "1px solid rgba(255, 255, 255, 0.15)";
            btn.style.color = "rgba(255, 255, 255, 0.3)";
            btn.style.textShadow = "none";
            const insufficientLabel = typeof t === "function" ? t("insufficient_materials") : "วัตถุดิบไม่เพียงพอ (Insufficient Materials)";
            if (typeof window.setElementTextOrHTML === "function") {
              window.setElementTextOrHTML(btn, insufficientLabel);
            } else {
              btn.textContent = insufficientLabel;
            }
            btn.disabled = true;
          }

          card.appendChild(btn);
          craftingList.appendChild(card);
        });
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.renderCrafting = renderCrafting;

      function craftItem(recipeId) {
        const CRAFTING_RECIPES = [
          {
            id: "axe",
            output: { name: "AXE", icon: "🪓" },
            ingredients: [
              { name: "ROCK", count: 1 },
              { name: "BRANCH", count: 3 }
            ]
          },
          {
            id: "wood_chest",
            output: { name: "WOOD_CHEST", icon: "📦", count: 1 },
            ingredients: [
              { name: "LOG", count: 2 }
            ]
          },
          {
            id: "pickaxe",
            output: { name: "PICKAXE", icon: "⛏️", count: 1 },
            ingredients: [
              { name: "ROCK", count: 2 },
              { name: "BRANCH", count: 3 }
            ]
          },
          {
            id: "campfire",
            output: { name: "CAMPFIRE", icon: "🔥", count: 1 },
            ingredients: [
              { name: "BRANCH", count: 5 },
              { name: "ROCK", count: 5 }
            ]
          },
          {
            id: "wood_boat",
            output: { name: "WOOD_BOAT", icon: "🛶", count: 1 },
            ingredients: [
              { name: "LOG", count: 3 }
            ]
          },
          {
            id: "wood_wheel",
            output: { name: "WOOD_WHEEL", icon: "🛞", count: 1 },
            ingredients: [
              { name: "LOG", count: 4 },
              { name: "IRON_ORE", count: 5 }
            ]
          },
          {
            id: "electric_engine",
            output: { name: "ELECTRIC_ENGINE", icon: "🔋", count: 1 },
            ingredients: [
              { name: "IRON_ORE", count: 10 }
            ]
          },
          {
            id: "boat_wing",
            output: { name: "BOAT_WING", icon: "🪽", count: 1 },
            ingredients: [
              { name: "LOG", count: 4 },
              { name: "BRANCH", count: 6 }
            ]
          },
          {
            id: "glow_battery",
            output: { name: "GLOW_BATTERY", icon: "🔋", count: 1 },
            ingredients: [
              { name: "GLOW_ORE", count: 1 }
            ]
          },
          {
            id: "stone_floor", output: { name: "STONE_FLOOR", icon: "🪨", count: 1 }, ingredients: [ { name: "BIG_ROCK", count: 10 } ]
          },
          {
            id: "wood_floor",
            output: { name: "WOOD_FLOOR", icon: "🪵", count: 4 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_stairs",
            output: { name: "WOOD_STAIRS", icon: "🪜", count: 2 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "folding_ladder",
            output: { name: "FOLDING_LADDER", icon: "🪜", count: 2 },
            ingredients: [
              { name: "IRON_ORE", count: 1 }
            ]
          },
          {
            id: "wood_wall",
            output: { name: "WOOD_WALL", icon: "🧱", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_window",
            output: { name: "WOOD_WINDOW", icon: "🪟", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "thin_wood_floor",
            output: { name: "THIN_WOOD_FLOOR", icon: "🪵", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_door",
            output: { name: "WOOD_DOOR", icon: "🚪", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "wood_roof",
            output: { name: "WOOD_ROOF", icon: "🛖", count: 3 },
            ingredients: [
              { name: "LOG", count: 1 }
            ]
          },
          {
            id: "arrow",
            output: { name: "ARROW", icon: "🏹", count: 30 },
            ingredients: [
              { name: "LOG", count: 1 },
              { name: "BIG_ROCK", count: 1 }
            ]
          },
          {
            id: "wooden_arm_cannon",
            output: { name: "WOODEN_ARM_CANNON", icon: "🪵🦾", count: 1 },
            ingredients: [
              { name: "LOG", count: 2 },
              { name: "BIG_ROCK", count: 1 }
            ]
          },
          {
            id: "shovel",
            output: { name: "SHOVEL", icon: "🥄", count: 1 },
            ingredients: [
              { name: "LOG", count: 1 },
              { name: "BIG_ROCK", count: 1 }
            ]
          },
          {
            id: "robot_stand",
            output: { name: "ROBOT_STAND", icon: "🏗️", count: 1 },
            ingredients: [
              { name: "LOG", count: 3 }
            ]
          },
          {
            id: "robot_cockpit",
            output: { name: "ROBOT_COCKPIT", icon: "🤖", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_left_arm",
            output: { name: "ROBOT_LEFT_ARM", icon: "🦾", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_right_arm",
            output: { name: "ROBOT_RIGHT_ARM", icon: "🦾", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_left_leg",
            output: { name: "ROBOT_LEFT_LEG", icon: "🦿", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          },
          {
            id: "robot_right_leg",
            output: { name: "ROBOT_RIGHT_LEG", icon: "🦿", count: 1 },
            ingredients: [
              { name: "LOG", count: 10 }
            ]
          }
        ];

        const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
        if (!recipe) return;
        
        // Double check ingredients
        let canCraft = true;
        for (let ing of recipe.ingredients) {
          if (getItemCount(ing.name) < ing.count) {
            canCraft = false;
            break;
          }
        }
        
        if (!canCraft) return;
        
        // Consume ingredients
        for (let ing of recipe.ingredients) {
          consumeItem(ing.name, ing.count);
        }
        
        // Add output item
        const outputCount = recipe.output.count || 1;
        addItemToInventory({
          name: recipe.output.name,
          label: recipe.output.name,
          icon: recipe.output.icon,
          count: outputCount
        });
        
        // Refresh UI
        renderInventory();
        renderActionSlots();
        renderCrafting();
        updateBadge();
        saveSettingsToLocalStorage();
        
        // Play sound
        if (typeof playCollectSound === "function") {
          playCollectSound();
        }
        
        // Notice
        const outDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(recipe.output.name) : recipe.output.name;
        const craftSuccessText = typeof t === "function" ? t("craft_success") : "คราฟไอเทมสำเร็จ";
        showNotice(`🔨 ${craftSuccessText}: ${recipe.output.icon} ${outDispName} x${outputCount}`);
      }

      function toggleCrafting() {
        const overlay = document.getElementById("craftingOverlay");
        const isCurrentlyOpen = overlay.classList.contains("open");

        // Close inventory if open
        const invOverlay = document.getElementById("inventoryOverlay");
        if (invOverlay && invOverlay.classList.contains("open")) {
          invOverlay.classList.remove("open");
        }

        if (isCurrentlyOpen) {
          overlay.classList.remove("open");
          if (gameStarted) {
            requestPointerLockSafe();
            }
          } else {
          overlay.classList.add("open");
          renderCrafting();

        }
      }

            function handleSplitItem(source, index) {
        let item = null;
        let sourceArray = null;
        if (source === "inventory") {
          item = inventory[index];
          sourceArray = inventory;
        } else if (source === "action") {
          item = actionSlotsItems[index];
          sourceArray = actionSlotsItems;
        } else if (source === "chest") {
          if (!currentOpenChest) return;
          item = currentOpenChest.storage[index];
          sourceArray = currentOpenChest.storage;
        } else if (source === "chestPlayerInventory") {
          item = inventory[index];
          sourceArray = inventory;
        }

        if (!item || item.count <= 1) return;
        
        const splitAmount = Math.floor(item.count / 2);
        if (splitAmount <= 0) return;

        let targetArray = sourceArray;
        let limit = targetArray.length;
        if (source === "inventory" || source === "chestPlayerInventory") limit = UNLOCKED_SLOTS;

        const emptyIndex = targetArray.findIndex((i, idx) => idx < limit && i === null);
        if (emptyIndex !== -1) {
          targetArray[emptyIndex] = { ...item, count: splitAmount };
          item.count -= splitAmount;
          
          if (source === "chest" || source === "chestPlayerInventory") {
            renderChest();
            renderInventory();
            renderActionSlots();
          } else {
            renderInventory();
            renderActionSlots();
          }
          updateBadge();
          saveSettingsToLocalStorage();
        } else {
          showNotice(source === "chest" ? "กล่องเต็มแล้ว! (Chest Full)" : "กระเป๋าเต็มแล้ว! (Inventory Full)");
        }
      }

      let trashPendingData = null; // { source, index, item }
      let trashHoldTimer = null;
      let trashHoldProgress = 0;
      let trashHoldInterval = null;

      function openTrashConfirm(source, index, item) {
        window.isConfirmOverlayOpen = true; if (window.clearKeysPressed) window.clearKeysPressed();
        trashPendingData = { source, index, item };
        const rawName = item.name || item.label || "ITEM";
        const displayName = typeof getItemDisplayName === "function" ? getItemDisplayName(rawName) : rawName;
        document.getElementById("trashConfirmText").textContent = displayName + (item.count > 1 ? " x" + item.count : "");
        const iconEl = document.getElementById("trashConfirmIcon");
        if (iconEl) {
          iconEl.innerHTML = "";
          let canvas3D = null;
          if (typeof create3DIconCanvas === "function") {
            canvas3D = create3DIconCanvas(item, 56, 56);
          }
          if (canvas3D) {
            iconEl.appendChild(canvas3D);
          } else {
            iconEl.textContent = item.icon || "📦";
          }
        }
        
        const overlay = document.getElementById("trashConfirmOverlay");
        
        // Append strictly inside the active panel to keep it contained within the inventory / chest UI window
        const chestOverlay = document.getElementById("chestOverlay");
        let targetPanel = null;
        if (source === "chest" || source === "chestPlayerInventory" || (chestOverlay && chestOverlay.classList.contains("open"))) {
           targetPanel = document.querySelector("#chestOverlay .inventory-panel");
           if (targetPanel) targetPanel.style.overflow = "hidden";
        } else {
           targetPanel = document.querySelector("#inventoryOverlay .inventory-panel");
           if (targetPanel) targetPanel.style.overflow = "hidden";
        }

        if (targetPanel && overlay && overlay.parentElement !== targetPanel) {
           targetPanel.appendChild(overlay);
        }
        
        if (overlay) overlay.style.setProperty("display", "flex", "important");
        
        // Reset progress
        clearInterval(trashHoldInterval);
        trashHoldProgress = 0;
        const progressEl = document.getElementById("trashConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }

        // Setup Gamepad navigation to focus trashConfirmBtn
        if (window.GamepadController) {
          window.GamepadController.uiNav.area = "trashConfirm";
          window.GamepadController.uiNav.index = 1; // Default focus to HOLD TO DELETE button
          setTimeout(() => {
            if (window.GamepadController.applyUIFocus) window.GamepadController.applyUIFocus();
          }, 30);
        }
      }

      function closeTrashConfirm() {
        window.isConfirmOverlayOpen = false;
        trashPendingData = null;
        const iconEl = document.getElementById("trashConfirmIcon");
        if (iconEl) iconEl.innerHTML = "";
        document.getElementById("trashConfirmOverlay").style.setProperty("display", "none", "important");
        const chestPanel = document.querySelector("#chestOverlay .inventory-panel");
        if (chestPanel) chestPanel.style.overflow = "";
        const invPanel = document.querySelector("#inventoryOverlay .inventory-panel");
        if (invPanel) invPanel.style.overflow = "";
        clearInterval(trashHoldInterval);
        trashHoldProgress = 0;
        const progressEl = document.getElementById("trashConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }

        // Restore gamepad navigation back to bottom action buttons or grid
        if (window.GamepadController) {
          window.GamepadController.uiNav.area = "bottom";
          window.GamepadController.uiNav.index = 2; // back on Destroy button
          setTimeout(() => {
            if (window.GamepadController.applyUIFocus) window.GamepadController.applyUIFocus();
          }, 30);
        }
      }
      window.openTrashConfirm = openTrashConfirm;
      window.closeTrashConfirm = closeTrashConfirm;

      document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("trashCancelBtn")?.addEventListener("click", closeTrashConfirm);

        const trashConfirmBtn = document.getElementById("trashConfirmBtn");
        const trashConfirmProgress = document.getElementById("trashConfirmProgress");

        function startTrashHold(e) {
          if (e) e.preventDefault();
          trashHoldProgress = 0;
          trashConfirmProgress.style.transition = "none";
          trashConfirmProgress.style.width = "0%";

          clearInterval(trashHoldInterval);
          trashHoldInterval = setInterval(() => {
            trashHoldProgress += 5;
            trashConfirmProgress.style.width = trashHoldProgress + "%";
            if (trashHoldProgress >= 100) {
              clearInterval(trashHoldInterval);
              executeTrash();
            }
          }, 30);
        }

        function cancelTrashHold(e) {
          clearInterval(trashHoldInterval);
          trashHoldProgress = 0;
          trashConfirmProgress.style.transition = "width 0.2s";
          trashConfirmProgress.style.width = "0%";
        }
        window.startTrashHold = startTrashHold;
        window.cancelTrashHold = cancelTrashHold;

        trashConfirmBtn?.addEventListener("mousedown", startTrashHold);
        trashConfirmBtn?.addEventListener("touchstart", startTrashHold, { passive: false });
        trashConfirmBtn?.addEventListener("contextmenu", (e) => e.preventDefault());
        trashConfirmBtn?.addEventListener("mouseup", cancelTrashHold);
        trashConfirmBtn?.addEventListener("mouseleave", cancelTrashHold);
        trashConfirmBtn?.addEventListener("touchend", cancelTrashHold);
        trashConfirmBtn?.addEventListener("touchcancel", cancelTrashHold);

        // Setup 3 Bottom Inventory Buttons (Action UI, Split, Destroy)
        const btnActionUI = document.getElementById("btnInventoryActionUI");
        const btnSplit = document.getElementById("btnInventorySplit");
        const btnDestroy = document.getElementById("btnInventoryDestroy");

        window.selectedInventorySlot = null; // { source, index, item }

        if (!document.getElementById("inventorySelectedSlotStyles")) {
          const st = document.createElement("style");
          st.id = "inventorySelectedSlotStyles";
          st.textContent = `
            .inventory-slot.item-selected, .action-slot.item-selected {
              border-color: #dfb76c !important;
              box-shadow: inset 0 0 0 2px #dfb76c, inset 0 0 12px rgba(223, 183, 108, 0.4) !important;
              background: rgba(223, 183, 108, 0.16) !important;
            }
          `;
          document.head.appendChild(st);
        }

        window.updateSelectedSlotVisuals = function() {
          document.querySelectorAll(".inventory-slot, .action-slot").forEach(el => {
            const s = el.dataset.source;
            const idx = parseInt(el.dataset.index, 10);
            if (window.selectedInventorySlot && window.selectedInventorySlot.source === s && window.selectedInventorySlot.index === idx) {
              el.classList.add("item-selected");
            } else {
              el.classList.remove("item-selected");
            }
          });
        };

        window.updateBottomButtonsState = function() {
          const selected = window.selectedInventorySlot;

          if (selected && selected.item) {
            const curItem = getSlotItem(selected.source, selected.index);
            if (!curItem) {
              window.selectedInventorySlot = null;
              window.updateSelectedSlotVisuals();
              window.updateBottomButtonsState();
              return;
            }
            selected.item = curItem;

            if (btnActionUI) {
              btnActionUI.style.opacity = "1";
              btnActionUI.style.cursor = "pointer";
              btnActionUI.style.boxShadow = "0 0 10px rgba(223, 183, 108, 0.35)";
            }
            if (btnSplit) {
              const canSplit = (curItem.count > 1);
              btnSplit.style.opacity = canSplit ? "1" : "0.45";
              btnSplit.style.cursor = canSplit ? "pointer" : "not-allowed";
              btnSplit.style.boxShadow = canSplit ? "0 0 10px rgba(56, 189, 248, 0.35)" : "none";
            }
            if (btnDestroy) {
              btnDestroy.style.opacity = "1";
              btnDestroy.style.cursor = "pointer";
              btnDestroy.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.35)";
            }
          } else {
            if (btnActionUI) {
              btnActionUI.style.opacity = "0.38";
              btnActionUI.style.cursor = "not-allowed";
              btnActionUI.style.boxShadow = "none";
            }
            if (btnSplit) {
              btnSplit.style.opacity = "0.38";
              btnSplit.style.cursor = "not-allowed";
              btnSplit.style.boxShadow = "none";
            }
            if (btnDestroy) {
              btnDestroy.style.opacity = "0.38";
              btnDestroy.style.cursor = "not-allowed";
              btnDestroy.style.boxShadow = "none";
            }
          }
        };

        // Initialize button states as disabled until item is selected
        window.updateBottomButtonsState();

        btnActionUI?.addEventListener("click", () => {
          if (!window.selectedInventorySlot || !window.selectedInventorySlot.item) {
            if (typeof showNotice === "function") {
              showNotice("⚠️ กรุณาคลิกเลือกไอเทมในกระเป๋าก่อนใช้งาน");
            }
            return;
          }
          const { source, index, item } = window.selectedInventorySlot;
          if (source === "action") {
            if (typeof showNotice === "function") {
              showNotice(`ℹ️ ไอเทมอยู่ในช่องแอคชั่น [ช่อง ${index + 1}] อยู่แล้ว`);
            }
          } else {
            let targetSlot = actionSlotsItems.findIndex(s => s === null);
            if (targetSlot === -1) targetSlot = (selectedActionSlotIndex !== -1 ? selectedActionSlotIndex : 0);
            
            const toItem = actionSlotsItems[targetSlot];
            setSlotItem(source, index, toItem);
            setSlotItem("action", targetSlot, item);
            selectedActionSlotIndex = targetSlot;

            window.selectedInventorySlot = { source: "action", index: targetSlot, item: item };

            if (typeof renderChest === "function" && currentOpenChest) renderChest();
            renderInventory();
            renderActionSlots();
            updateBadge();
            saveSettingsToLocalStorage();
            if (typeof playCollectSound === "function") playCollectSound();

            const dName = typeof getItemDisplayName === "function" ? getItemDisplayName(item.name || item.label) : (item.name || item.label);
            if (typeof showNotice === "function") {
              showNotice(`⚡ ย้าย ${item.icon || "📦"} ${dName} ไปยังช่องแอคชั่น [ช่อง ${targetSlot + 1}] แล้ว`);
            }
          }
        });

        btnSplit?.addEventListener("click", () => {
          if (!window.selectedInventorySlot || !window.selectedInventorySlot.item) {
            if (typeof showNotice === "function") {
              showNotice("⚠️ กรุณาคลิกเลือกไอเทมในกระเป๋าก่อนแบ่งจำนวน");
            }
            return;
          }
          const { source, index, item } = window.selectedInventorySlot;
          if ((item.count || 1) <= 1) {
            if (typeof showNotice === "function") {
              showNotice("❌ ไอเทมนี้มีเพียง 1 ชิ้น ไม่สามารถแบ่งได้");
            }
            return;
          }
          handleSplitItem(source, index);
          if (typeof playCollectSound === "function") playCollectSound();
          window.updateSelectedSlotVisuals();
          window.updateBottomButtonsState();
        });

        btnDestroy?.addEventListener("click", () => {
          if (!window.selectedInventorySlot || !window.selectedInventorySlot.item) {
            if (typeof showNotice === "function") {
              showNotice("⚠️ กรุณาคลิกเลือกไอเทมในกระเป๋าก่อนทำลาย");
            }
            return;
          }
          const { source, index, item } = window.selectedInventorySlot;
          openTrashConfirm(source, index, item);
        });

        if (btnDestroy) {
          btnDestroy.addEventListener("dragover", (e) => {
            e.preventDefault();
            btnDestroy.style.background = "rgba(239, 68, 68, 0.35)";
            btnDestroy.style.borderColor = "#ef4444";
          });
          btnDestroy.addEventListener("dragleave", () => {
            btnDestroy.style.background = "rgba(239, 68, 68, 0.12)";
            btnDestroy.style.borderColor = "rgba(239, 68, 68, 0.4)";
          });
          btnDestroy.addEventListener("drop", (e) => {
            btnDestroy.style.background = "rgba(239, 68, 68, 0.12)";
            btnDestroy.style.borderColor = "rgba(239, 68, 68, 0.4)";
            handleTrashDrop(e);
          });
        }
      });

      // ============================================
      // Custom Sci-Fi DOM Virtual Scrollbar Controller
      // ============================================
      function getActiveScrollableContainer() {
        const overlay = document.getElementById("inventoryOverlay");
        if (!overlay || !overlay.classList.contains("open")) return null;

        const activeTabName = typeof window.getActiveTab === "function" ? window.getActiveTab() : (typeof activeTab !== "undefined" ? activeTab : "inventory");

        if (activeTabName === "settings") {
          const el = document.getElementById("inventorySettings");
          if (el && el.style.display !== "none") return el;
        } else if (activeTabName === "crafting") {
          const el = document.getElementById("craftingList");
          if (el && el.style.display !== "none") return el;
        } else if (activeTabName === "cooking") {
          const el = document.getElementById("cookingList");
          if (el && el.style.display !== "none") return el;
        } else if (activeTabName === "itemsList" || activeTabName === "inventory") {
          const mainLayout = document.getElementById("inventoryMainLayout");
          if (mainLayout && mainLayout.style.display !== "none") return mainLayout;
          const grid = document.getElementById("inventoryGrid");
          if (grid && grid.style.display !== "none") return grid;
        }

        const candidates = [
          document.getElementById("inventorySettings"),
          document.getElementById("craftingList"),
          document.getElementById("cookingList"),
          document.getElementById("inventoryMainLayout"),
          document.getElementById("inventoryGrid")
        ];
        for (const el of candidates) {
          if (el && el.style.display !== "none" && window.getComputedStyle(el).display !== "none") {
            return el;
          }
        }
        return null;
      }

      function updateCustomScrollbar() {
        const saveSelect = document.getElementById("saveSelectOverlay");
        if (saveSelect && saveSelect.classList.contains("open")) {
          const track = document.getElementById("saveSelectCustomScrollbar");
          const thumb = document.getElementById("saveSelectCustomScrollbarThumb");
          const container = document.getElementById("saveSlotsList");
          if (!track || !thumb || !container) return;

          const scrollHeight = container.scrollHeight;
          const clientHeight = container.clientHeight;
          const scrollTop = container.scrollTop;

          if (scrollHeight <= clientHeight + 4) {
            track.style.display = "none";
            return;
          }

          track.style.display = "block";
          const trackHeight = track.clientHeight;
          if (trackHeight <= 0) return;

          const thumbHeight = Math.max(36, Math.min(trackHeight - 4, (clientHeight / scrollHeight) * trackHeight));
          thumb.style.height = `${thumbHeight}px`;

          const maxScroll = scrollHeight - clientHeight;
          const maxThumbTop = trackHeight - thumbHeight;
          const scrollRatio = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
          const thumbTop = Math.max(0, Math.min(maxThumbTop, scrollRatio * maxThumbTop));

          thumb.style.transform = `translateY(${thumbTop}px)`;
          return;
        }

        const track = document.getElementById("panelCustomScrollbar");
        const thumb = document.getElementById("panelCustomScrollbarThumb");
        if (!track || !thumb) return;

        const container = getActiveScrollableContainer();
        if (!container) {
          track.style.display = "none";
          return;
        }

        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const scrollTop = container.scrollTop;

        // Display scrollbar whenever content overflows client area
        if (scrollHeight <= clientHeight + 4) {
          track.style.display = "none";
          return;
        }

        track.style.display = "block";
        const trackHeight = track.clientHeight;
        if (trackHeight <= 0) return;

        const thumbHeight = Math.max(36, Math.min(trackHeight - 4, (clientHeight / scrollHeight) * trackHeight));
        thumb.style.height = `${thumbHeight}px`;

        const maxScroll = scrollHeight - clientHeight;
        const maxThumbTop = trackHeight - thumbHeight;
        const scrollRatio = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
        const thumbTop = Math.max(0, Math.min(maxThumbTop, scrollRatio * maxThumbTop));

        thumb.style.transform = `translateY(${thumbTop}px)`;
      }
      window.getActiveScrollableContainer = getActiveScrollableContainer;
      window.updateCustomScrollbar = updateCustomScrollbar;

      window.updateCustomScrollbarFromPosition = function(cursorY) {
        const saveSelect = document.getElementById("saveSelectOverlay");
        let track, thumb, container;
        if (saveSelect && saveSelect.classList.contains("open")) {
          track = document.getElementById("saveSelectCustomScrollbar");
          thumb = document.getElementById("saveSelectCustomScrollbarThumb");
          container = document.getElementById("saveSlotsList");
        } else {
          track = document.getElementById("panelCustomScrollbar");
          thumb = document.getElementById("panelCustomScrollbarThumb");
          container = getActiveScrollableContainer();
        }
        if (!track || !thumb || !container) return;

        const trackRect = track.getBoundingClientRect();
        const trackHeight = trackRect.height;
        if (trackHeight <= 0) return;

        const thumbHeight = thumb.offsetHeight || 36;
        const maxThumbTop = trackHeight - thumbHeight;
        if (maxThumbTop <= 0) return;

        const relativeY = cursorY - trackRect.top - (thumbHeight / 2);
        const clampedTop = Math.max(0, Math.min(maxThumbTop, relativeY));
        const ratio = clampedTop / maxThumbTop;

        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = ratio * maxScroll;
        thumb.style.transform = `translateY(${clampedTop}px)`;
      };

      let isCustomScrollbarDragging = false;
      let isCustomScrollbarInitialized = false;
      function setupCustomScrollbarListeners() {
        if (isCustomScrollbarInitialized) return;
        isCustomScrollbarInitialized = true;

        const tracks = [
          document.getElementById("panelCustomScrollbar"),
          document.getElementById("saveSelectCustomScrollbar")
        ];
        const thumbs = [
          document.getElementById("panelCustomScrollbarThumb"),
          document.getElementById("saveSelectCustomScrollbarThumb")
        ];

        thumbs.forEach(thumb => {
          if (!thumb) return;
          thumb.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            isCustomScrollbarDragging = true;
            thumb.classList.add("dragging");
          });
        });

        tracks.forEach(track => {
          if (!track) return;
          track.addEventListener("mousedown", (e) => {
            const thumb = track.querySelector(".custom-scrollbar-thumb");
            if (e.target === thumb) return;
            e.preventDefault();
            e.stopPropagation();
            isCustomScrollbarDragging = true;
            if (thumb) thumb.classList.add("dragging");
            window.updateCustomScrollbarFromPosition(e.clientY);
          });
        });

        window.addEventListener("mousemove", (e) => {
          if (!isCustomScrollbarDragging) return;
          window.updateCustomScrollbarFromPosition(e.clientY);
        });

        window.addEventListener("mouseup", () => {
          if (isCustomScrollbarDragging) {
            isCustomScrollbarDragging = false;
            document.querySelectorAll(".custom-scrollbar-thumb.dragging").forEach(t => t.classList.remove("dragging"));
          }
        });

        const scrollables = [
          document.getElementById("inventorySettings"),
          document.getElementById("craftingList"),
          document.getElementById("cookingList"),
          document.getElementById("inventoryMainLayout"),
          document.getElementById("inventoryGrid"),
          document.getElementById("saveSlotsList")
        ];
        scrollables.forEach(el => {
          if (el) {
            el.addEventListener("scroll", () => {
              updateCustomScrollbar();
            }, { passive: true });
          }
        });

        window.addEventListener("resize", updateCustomScrollbar);
      }
      setupCustomScrollbarListeners();

      function executeTrash() {
        if (!trashPendingData) return;
        const { source, index } = trashPendingData;
        
        if (source === "inventory") {
          inventory[index] = null;
        } else if (source === "action") {
          actionSlotsItems[index] = null;
        } else if (source === "chest") {
          if (currentOpenChest) currentOpenChest.storage[index] = null;
        } else if (source === "chestPlayerInventory") {
          inventory[index] = null;
        }
        
        if (source === "chest" || source === "chestPlayerInventory") {
          renderChest();
          renderInventory();
          renderActionSlots();
        } else {
          renderInventory();
          renderActionSlots();
        }
        updateBadge();
        saveSettingsToLocalStorage();
        
        closeTrashConfirm();
      }

      function handleTrashDrop(e) {
        e.preventDefault();
        try {
          let source = e.dataTransfer.getData("source");
          let sourceIndex = parseInt(e.dataTransfer.getData("index"), 10);
          
          if (!source) {
            const dataStr = e.dataTransfer.getData("text/plain");
            if (dataStr) {
               const data = JSON.parse(dataStr);
               source = data.source;
               sourceIndex = data.index;
            }
          }

          if (!source || isNaN(sourceIndex)) return;

          let item = null;
          if (source === "inventory") {
            item = inventory[sourceIndex];
          } else if (source === "action") {
            item = actionSlotsItems[sourceIndex];
          } else if (source === "chest") {
            item = currentOpenChest ? currentOpenChest.storage[sourceIndex] : null;
          } else if (source === "chestPlayerInventory") {
            item = inventory[sourceIndex];
          }

          if (item) {
            openTrashConfirm(source, sourceIndex, item);
          }

        } catch(err) {
          console.error("Trash drop error", err);
        }
      }

      function renderInventory() {
        window.renderInventory = renderInventory;
        const grid = document.getElementById("inventoryGrid");
        if (!grid) return;
        grid.innerHTML = "";

        if (activeTab === "inventory") {
          for (let i = 0; i < TOTAL_SLOTS; i++) {
            const item = inventory[i];
            const isLocked = i >= UNLOCKED_SLOTS;
            const slot = createSlotElement({
              source: "inventory",
              index: i,
              item: item,
              isLocked: isLocked,
              cursor: isMoveModeEnabled ? "grab" : "pointer",
              onClick: (item && !isLocked) ? (isMoveModeEnabled ? null : () => useItem(item, i, "inventory")) : null
            });
            grid.appendChild(slot);
          }
        } else if (activeTab === "itemsList") {
          for (let i = 0; i < Math.max(TOTAL_SLOTS, ALL_ITEMS.length); i++) {
            const item = ALL_ITEMS[i];
            const slot = createSlotElement({
              source: "itemsList",
              index: i,
              item: item,
              isDraggable: false,
              isDropTarget: false,
              onClick: item ? () => {
                if (!isDevMode) return; // ปิดระบบเสกของในโหมดเซฟ
                let successCount = 0;
                for (let j = 0; j < 50; j++) {
                  const added = addItemToInventory({ name: item.name, icon: item.icon, label: item.name }, false, false);
                  if (added) {
                    successCount++;
                  } else {
                    break;
                  }
                }
                if (successCount > 0) {
                  renderInventory();
                  updateBadge();
                  const itemDispName = typeof getItemDisplayName === "function" ? getItemDisplayName(item.name) : item.name;
                  const summonText = typeof t === "function" ? t("summon_success") : "เสกสำเร็จ: ได้รับ";
                  showNotice(`${summonText} ${item.icon} ${itemDispName} x${successCount} !`);
                  slot.style.transform = "scale(0.9)";
                  setTimeout(() => { slot.style.transform = ""; }, 100);
                } else {
                  const fullText = typeof t === "function" ? t("inventory_full") : "❌ กระเป๋าเต็มแล้ว! (Inventory is full)";
                  showNotice(fullText);
                }
              } : null
            });
            grid.appendChild(slot);
          }
        }

        updateBadge();
        const tabInv = document.getElementById("tabInventory");
        const isTabInventoryActive = tabInv ? tabInv.classList.contains("active") : (activeTab === "inventory");
        const bottomBtns = document.getElementById("inventoryBottomButtons");
        if (bottomBtns) {
          bottomBtns.style.display = (isTabInventoryActive && activeTab === "inventory") ? "flex" : "none";
        }
        if (typeof updateSelectedSlotVisuals === "function") updateSelectedSlotVisuals();
        if (typeof updateBottomButtonsState === "function") updateBottomButtonsState();
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.renderInventory = renderInventory;

      function renderActionSlots() {
        window.renderActionSlots = renderActionSlots;
        const containers = [
          document.querySelectorAll(".action-slots .action-slot"),
          document.querySelectorAll(".inventory-action-slots .action-slot")
        ];

        containers.forEach(slots => {
          for (let i = 0; i < slots.length; i++) {
            const slotEl = slots[i];
            if (!slotEl) continue;

            if (i === selectedActionSlotIndex) {
              slotEl.classList.add("selected");
            } else {
              slotEl.classList.remove("selected");
            }

            let keyLabel = null;
            if (i < 4) {
              const keyMap = { 0: "action1", 1: "action2", 2: "action3", 3: "action4" };
              const rawKey = currentKeyBindings[keyMap[i]] || "";
              keyLabel = rawKey.replace("Key", "").replace("Digit", "");
            }

            const item = actionSlotsItems[i];

            populateSlotElement(slotEl, {
              source: "action",
              index: i,
              item: item,
              keyLabel: keyLabel,
              cursor: isMoveModeEnabled ? "grab" : "pointer",
              labelStyle: {
                fontSize: "8px",
                position: "absolute",
                bottom: "2px",
                color: "rgba(223, 183, 108, 0.7)",
                fontFamily: "'Google Sans', sans-serif"
              },
              onClick: isMoveModeEnabled ? null : () => {
                if (selectedActionSlotIndex === i) {
                  selectedActionSlotIndex = -1;
                  renderActionSlots();
                  if (activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON")) {
                    useAnimTimer = 0;
                    isUsingItem = false;
                    activeItem = null;
                  }
                  wasUsingBowBeforeSwimming = false;
                } else {
                  selectedActionSlotIndex = i;
                  renderActionSlots();
                }
              }
            });
          }
        });
      }

      function addItemToInventory(item, playAudio = true, shouldRender = true) {
        const itemName = item.name || item.label;
        const addCount = item.count || 1;
        // Check if item already exists and can be stacked
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          if (
            inventory[i] !== null &&
            (inventory[i].name === itemName || inventory[i].label === itemName)
          ) {
            inventory[i].count += addCount;
            if (shouldRender) {
              renderInventory();
              updateBadge();
            }
            if (playAudio) playCollectSound();
            saveSettingsToLocalStorage();
            return true;
          }
        }

        // Add to new slot
        for (let i = 0; i < UNLOCKED_SLOTS; i++) {
          if (inventory[i] === null) {
            inventory[i] = { ...item, count: addCount };
            inventory[i].name = itemName; // Ensure name is set for future stacking
            if (shouldRender) {
              renderInventory();
              updateBadge();
            }
            if (playAudio) playCollectSound();
            saveSettingsToLocalStorage();
            return true;
          }
        }
        return false;
      }

      function simulateDemolishStorage(closestDemolishItem, structureItemData) {
        // Create a list of single-count items we need to insert.
        const flatItems = [];
        
        // 1. The structure itself
        flatItems.push({ name: structureItemData.name, icon: structureItemData.icon, label: structureItemData.label });

        // If it's a boat with attached items, return those too!
        if (closestDemolishItem.type === "wood_boat") {
          if (closestDemolishItem.hasWheel || closestDemolishItem.hasWheels) {
            flatItems.push({ name: "WOOD_WHEEL", icon: "🛞", label: "WOOD_WHEEL" });
          }
          if (closestDemolishItem.hasEngine) {
            flatItems.push({ name: "ELECTRIC_ENGINE", icon: "🔋", label: "ELECTRIC_ENGINE" });
          }
          if (closestDemolishItem.hasWing || closestDemolishItem.hasWings) {
            flatItems.push({ name: "BOAT_WING", icon: "🪽", label: "BOAT_WING" });
          }
        }
        
        // 2. If it's a chest, add all its stored items
        if (closestDemolishItem.type === "wood_chest" && closestDemolishItem.storage) {
          for (let i = 0; i < closestDemolishItem.storage.length; i++) {
            const stItem = closestDemolishItem.storage[i];
            if (stItem) {
              const count = stItem.count || 1;
              for (let c = 0; c < count; c++) {
                flatItems.push({ name: stItem.name || stItem.label, icon: stItem.icon, label: stItem.label || stItem.name });
              }
            }
          }
        }
        
        // Simulate inserting flatItems into a copy of inventory
        const tempInventory = inventory.map(item => item ? { ...item } : null);
        
        for (const flatItem of flatItems) {
          let placed = false;
          // Try to stack
          for (let i = 0; i < UNLOCKED_SLOTS; i++) {
            if (
              tempInventory[i] !== null &&
              (tempInventory[i].name === flatItem.name || tempInventory[i].label === flatItem.name)
            ) {
              tempInventory[i].count += 1;
              placed = true;
              break;
            }
          }
          // If not stacked, find empty slot
          if (!placed) {
            for (let i = 0; i < UNLOCKED_SLOTS; i++) {
              if (tempInventory[i] === null) {
                tempInventory[i] = { name: flatItem.name, icon: flatItem.icon, label: flatItem.label, count: 1 };
                placed = true;
                break;
              }
            }
          }
          // If we couldn't place it, return null (inventory full)
          if (!placed) {
            return null;
          }
        }
        
        return tempInventory;
      }

      function tryDemolishItem(closestDemolishItem) {
        if (!closestDemolishItem) return false;

        let itemData = null;
        if (closestDemolishItem.type === "stone_floor") {
          itemData = { name: "STONE_FLOOR", icon: "🪨", label: "STONE_FLOOR" };
        } else if (closestDemolishItem.type === "wood_floor") {
          itemData = { name: "WOOD_FLOOR", icon: "🪵", label: "WOOD_FLOOR" };
        } else if (closestDemolishItem.type === "thin_wood_floor") {
          itemData = { name: "THIN_WOOD_FLOOR", icon: "������", label: "THIN_WOOD_FLOOR" };
        } else if (closestDemolishItem.type === "wood_stairs") {
          itemData = { name: "WOOD_STAIRS", icon: "🪜", label: "WOOD_STAIRS" };
        } else if (closestDemolishItem.type === "folding_ladder") {
          itemData = { name: "FOLDING_LADDER", icon: "🪜", label: "FOLDING_LADDER" };
        } else if (closestDemolishItem.type === "campfire") {
          itemData = { name: "CAMPFIRE", icon: "🔥", label: "CAMPFIRE" };
        } else if (closestDemolishItem.type === "wood_boat") {
          itemData = { name: "WOOD_BOAT", icon: "🛶", label: "WOOD_BOAT" };
        } else if (closestDemolishItem.type === "wood_wheel") {
          itemData = { name: "WOOD_WHEEL", icon: "🛞", label: "WOOD_WHEEL" };
        } else if (closestDemolishItem.type === "electric_engine") {
          itemData = { name: "ELECTRIC_ENGINE", icon: "🔋", label: "ELECTRIC_ENGINE" };
        } else if (closestDemolishItem.type === "boat_wing") {
          itemData = { name: "BOAT_WING", icon: "🪽", label: "BOAT_WING" };
        } else if (closestDemolishItem.type === "wood_wall") {
          itemData = { name: "WOOD_WALL", icon: "🧱", label: "WOOD_WALL" };
        } else if (closestDemolishItem.type === "wood_window") {
          itemData = { name: "WOOD_WINDOW", icon: "🪟", label: "WOOD_WINDOW" };
        } else if (closestDemolishItem.type === "wood_door") {
          itemData = { name: "WOOD_DOOR", icon: "🚪", label: "WOOD_DOOR" };
        } else if (closestDemolishItem.type === "wood_roof") {
          itemData = { name: "WOOD_ROOF", icon: "🛖", label: "WOOD_ROOF" };
        } else if (closestDemolishItem.type === "wood_chest") {
          itemData = { name: "WOOD_CHEST", icon: "📦", label: "WOOD_CHEST" };
        } else if (closestDemolishItem.type === "meganeura_item") {
          itemData = { name: "MEGANEURA", icon: "🦟", label: "MEGANEURA" };
        } else if (closestDemolishItem.type === "isopod_item") {
          itemData = { name: "ISOPOD", icon: "🦐", label: "ISOPOD" };
        } else if (closestDemolishItem.type === "robot_stand") {
          itemData = { name: "ROBOT_STAND", icon: "🏗️", label: "ROBOT_STAND" };
        } else if (closestDemolishItem.type === "robot_cockpit") {
          itemData = { name: "ROBOT_COCKPIT", icon: "🤖", label: "ROBOT_COCKPIT" };
        } else if (closestDemolishItem.type === "robot_left_arm") {
          itemData = { name: "ROBOT_LEFT_ARM", icon: "🦾", label: "ROBOT_LEFT_ARM" };
        } else if (closestDemolishItem.type === "robot_right_arm") {
          itemData = { name: "ROBOT_RIGHT_ARM", icon: "🦾", label: "ROBOT_RIGHT_ARM" };
        } else if (closestDemolishItem.type === "robot_left_leg") {
          itemData = { name: "ROBOT_LEFT_LEG", icon: "🦿", label: "ROBOT_LEFT_LEG" };
        } else if (closestDemolishItem.type === "robot_right_leg") {
          itemData = { name: "ROBOT_RIGHT_LEG", icon: "🦿", label: "ROBOT_RIGHT_LEG" };
        }

        if (itemData) {
          const simulatedInventory = simulateDemolishStorage(closestDemolishItem, itemData);
          if (simulatedInventory) {
            for (let i = 0; i < UNLOCKED_SLOTS; i++) {
              inventory[i] = simulatedInventory[i];
            }
            closestDemolishItem.active = false;
            if (typeof refreshCollectiblesVBO === "function") {
              refreshCollectiblesVBO();
            }
            renderInventory();
            renderActionSlots();
            updateBadge();
            saveSettingsToLocalStorage();
            playCollectSound();
            showNotice("รื้อถอน " + itemData.name + " แล้ว!");
            return true;
          } else {
            showNotice("กระเป๋าเต็ม! ไม่สามารถรื้อถอนได้");
            return false;
          }
        }
        return false;
      }

      // Robot Stand 8-Slot UI Manager
      window.updateMechStandUI = function(activeStand, attachedCollectibles) {
        const uiContainer = document.getElementById("mechStandUI");
        const gridContainer = document.getElementById("mechStandGrid");
        const statusBadge = document.getElementById("mechStandStatusBadge");

        if (!uiContainer || !gridContainer) return;

        if (!activeStand) {
          if (uiContainer.classList.contains("visible")) {
            uiContainer.classList.remove("visible");
          }
          window._lastMechStandStateKey = null;
          return;
        }

        if (!uiContainer.classList.contains("visible")) {
          uiContainer.classList.add("visible");
        }

        window._lastActiveStand = activeStand;
        window._lastAttachedCollectibles = attachedCollectibles;

        function getRobotPartLabel(typeOrName) {
          const tKey = (typeOrName || "").toLowerCase();
          if (tKey.includes("cockpit")) return (typeof t === "function") ? t("mech_part_cockpit") : "Cockpit";
          if (tKey.includes("left_arm")) return (typeof t === "function") ? t("mech_part_left_arm") : "Left Arm";
          if (tKey.includes("right_arm")) return (typeof t === "function") ? t("mech_part_right_arm") : "Right Arm";
          if (tKey.includes("left_leg")) return (typeof t === "function") ? t("mech_part_left_leg") : "Left Leg";
          if (tKey.includes("right_leg")) return (typeof t === "function") ? t("mech_part_right_leg") : "Right Leg";
          if (tKey.includes("stand")) return (typeof t === "function") ? t("mech_part_stand") : "Stand";
          if (tKey.includes("core")) return (typeof t === "function") ? t("mech_part_core") : "Power Core";
          if (tKey.includes("module")) return (typeof t === "function") ? t("mech_part_module") : "Module";
          if (typeof getItemDisplayName === "function") return getItemDisplayName(typeOrName);
          return typeOrName || ((typeof t === "function") ? t("mech_part_generic") : "Robot Part");
        }

        const equippedItems = [];
        if (activeStand) {
          equippedItems.push({
            item: activeStand,
            type: "robot_stand",
            itemName: "ROBOT_STAND",
            label: getRobotPartLabel("robot_stand")
          });
        }

        const listToSearch = Array.isArray(attachedCollectibles) ? attachedCollectibles : [];
        listToSearch.forEach(c => {
          if (c && c.active && !c.isPreview && c.type && c.type !== "robot_stand") {
            equippedItems.push({
              item: c,
              type: c.type,
              itemName: c.type.toUpperCase(),
              label: getRobotPartLabel(c.type)
            });
          }
        });

        // Prevent unnecessary DOM teardowns every frame if state key has not changed
        const curLang = typeof getGameLanguage === "function" ? getGameLanguage() : (window.gameLanguage || "en");
        const standId = activeStand.id || (activeStand.position ? activeStand.position.map(n => n.toFixed(2)).join(",") : "stand");
        const itemsKey = equippedItems.map(eq => eq.type).join("|");
        const currentStateKey = `${standId}_${itemsKey}_${curLang}`;

        if (window._lastMechStandStateKey === currentStateKey && gridContainer.children.length > 0) {
          return;
        }
        window._lastMechStandStateKey = currentStateKey;

        gridContainer.innerHTML = "";

        const renderMechStandUI = (stand, parts) => {
          window._lastMechStandStateKey = null;
          window.updateMechStandUI(stand, parts);
        };
        window.renderMechStandUI = renderMechStandUI;

        // Global action trigger for Mech Stand slots (supports both 3D World Raycast and HTML click)
        window.triggerMechStandSlotAction = function(slotIndex) {
          const activeStand = window._lastActiveStand;
          const listToSearch = window._lastAttachedCollectibles || [];
          if (!activeStand) return false;

          const equippedList = [];
          equippedList.push({
            item: activeStand,
            type: "robot_stand",
            itemName: "ROBOT_STAND",
            label: getRobotPartLabel("robot_stand")
          });
          listToSearch.forEach(c => {
            if (c && c.active && !c.isPreview && c.type && c.type !== "robot_stand") {
              equippedList.push({
                item: c,
                type: c.type,
                itemName: c.type.toUpperCase(),
                label: getRobotPartLabel(c.type)
              });
            }
          });

          const eqData = equippedList[slotIndex] || null;
          const targetCol = eqData ? eqData.item : null;

          if (targetCol) {
            if (eqData.type === "robot_stand") {
              showNotice((typeof t === "function") ? t("mech_cannot_remove_stand") : "Cannot remove stand while active!");
              return false;
            }
            const itemData = { name: eqData.itemName, icon: "🤖", label: eqData.label, count: 1 };
            if (addItemToInventory(itemData)) {
              targetCol.active = false;
              const idx = collectibles.indexOf(targetCol);
              if (idx !== -1) collectibles.splice(idx, 1);
              const attIdx = listToSearch.indexOf(targetCol);
              if (attIdx !== -1) listToSearch.splice(attIdx, 1);

              if (typeof activeRidingMech !== "undefined" && activeRidingMech && activeRidingMech.attachedParts) {
                activeRidingMech.attachedParts = activeRidingMech.attachedParts.filter(e => e.item !== targetCol);
              }

              pendingCollectibleRefresh = true;
              if (typeof refreshCollectiblesVBO === "function") refreshCollectiblesVBO("demolish");
              showNotice((typeof t === "function") ? t("mech_dismantle_success", { part: eqData.label }) : `Dismantled ${eqData.label} successfully!`);
              if (typeof playCollectSound === "function") playCollectSound();
              if (typeof World3DUI !== "undefined" && World3DUI.backend) {
                const sign = World3DUI.signs.get("mech_stand_world_sign");
                if (sign) sign.needsTextureUpdate = true;
              }
              renderMechStandUI(activeStand, listToSearch);
              return true;
            } else {
              showNotice((typeof t === "function") ? t("mech_inventory_full") : "Inventory full! Cannot dismantle");
              return false;
            }
          } else {
            // Equip next available robot part
            const cockpitItem = listToSearch.find(c => c && c.active && !c.isPreview && c.type === "robot_cockpit");
            const equippedTypes = listToSearch.map(c => c.type ? c.type.toLowerCase() : "");
            
            const invIndex = inventory.findIndex(i => {
              if (!i || !i.name || !i.name.startsWith("ROBOT_") || i.name === "ROBOT_STAND") return false;
              const typeName = i.name.toLowerCase();
              if (equippedTypes.includes(typeName)) return false;
              if ((typeName.includes("arm") || typeName.includes("leg")) && !cockpitItem) return false;
              return true;
            });

            if (invIndex === -1) {
              const hasArmsLegs = inventory.some(i => i && i.name && (i.name.includes("ARM") || i.name.includes("LEG")));
              if (hasArmsLegs && !cockpitItem) {
                showNotice((typeof t === "function") ? t("mech_require_cockpit") : "Must equip Cockpit before arms or legs!");
              } else {
                showNotice((typeof t === "function") ? t("mech_no_parts_to_equip") : "No new parts to equip!");
              }
              return false;
            }

            const itemToEquip = inventory[invIndex];
            itemToEquip.count--;
            if (itemToEquip.count <= 0) inventory[invIndex] = null;
            renderInventory();
            renderActionSlots();

            let pN = activeStand.normal || activeStand.U || [0,1,0];
            let pR = activeStand.R || [1,0,0];
            let pF = activeStand.F || [0,0,1];

            let basePos = cockpitItem ? cockpitItem.position : activeStand.position;
            let baseN = cockpitItem ? (cockpitItem.normal || pN) : pN;
            let baseR = cockpitItem ? (cockpitItem.R || pR) : pR;
            let baseF = cockpitItem ? (cockpitItem.F || pF) : pF;

            const itemType = itemToEquip.name.toLowerCase();
            let rOff = 0, nOff = 0, fOff = 0;
            if (itemType === "robot_cockpit") {
              nOff = 0.66;
            } else if (itemType === "robot_left_leg") {
              rOff = -0.030;
              nOff = cockpitItem ? -0.5025 : (0.66 - 0.5025);
            } else if (itemType === "robot_right_leg") {
              rOff = 0.030;
              nOff = cockpitItem ? -0.5025 : (0.66 - 0.5025);
            } else if (itemType === "robot_left_arm") {
              rOff = -0.1875;
              nOff = cockpitItem ? -0.16875 : (0.66 - 0.16875);
            } else if (itemType === "robot_right_arm") {
              rOff = 0.1875;
              nOff = cockpitItem ? -0.16875 : (0.66 - 0.16875);
            } else {
              nOff = 0.35;
            }

            let newPos = [
              basePos[0] + baseR[0]*rOff + baseN[0]*nOff + baseF[0]*fOff,
              basePos[1] + baseR[1]*rOff + baseN[1]*nOff + baseF[1]*fOff,
              basePos[2] + baseR[2]*rOff + baseN[2]*nOff + baseF[2]*fOff
            ];

            const newCol = {
              type: itemType,
              position: newPos,
              normal: [...baseN],
              R: [...baseR],
              F: [...baseF],
              active: true,
              size: 0.25,
              color: [1, 1, 1],
              isDynamic: false
            };
            collectibles.push(newCol);
            if (Array.isArray(listToSearch)) {
              listToSearch.push(newCol);
            }

            if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
              if (!activeRidingMech.attachedParts) activeRidingMech.attachedParts = [];
              activeRidingMech.attachedParts.push({
                item: newCol,
                localR: rOff,
                localN: nOff,
                localF: fOff
              });
            }

            pendingCollectibleRefresh = true;
            if (typeof refreshCollectiblesVBO === "function") refreshCollectiblesVBO("place");
            showNotice((typeof t === "function") ? t("mech_equip_success", { part: getRobotPartLabel(itemType) }) : `Equipped ${getRobotPartLabel(itemType)} successfully!`);
            if (typeof playCollectSound === "function") playCollectSound();
            if (typeof World3DUI !== "undefined" && World3DUI.backend) {
              const sign = World3DUI.signs.get("mech_stand_world_sign");
              if (sign) sign.needsTextureUpdate = true;
            }
            renderMechStandUI(activeStand, listToSearch);
            return true;
          }
        };

        // 8 Dynamic slots
        for (let i = 0; i < 8; i++) {
          const slotId = i + 1;
          const equippedData = equippedItems[i] || null;
          const matchingItem = equippedData ? equippedData.item : null;

          const slotEl = document.createElement("div");
          slotEl.className = "mech-stand-slot" + (matchingItem ? " equipped" : "");
          const dismantleTitle = (typeof t === "function" && equippedData) ? t("mech_slot_dismantle_title", { part: equippedData.label }) : `Click to dismantle ${equippedData ? equippedData.label : ''}`;
          const emptySlotTitle = (typeof t === "function") ? t("mech_slot_empty_title") : "Empty Slot (Click to Equip Part)";
          slotEl.title = matchingItem ? dismantleTitle : emptySlotTitle;

          const equippedText = (typeof t === "function") ? t("mech_slot_equipped") : "✔ EQUIPPED";
          const emptyText = (typeof t === "function") ? t("mech_slot_empty") : "✚ EMPTY";

          slotEl.innerHTML = `
            <span class="mech-slot-number">#0${slotId}</span>
            <div class="mech-slot-icon"></div>
            <span class="mech-slot-label">${matchingItem ? equippedData.label : ''}</span>
            <span class="mech-slot-status ${matchingItem ? '' : 'empty'}">${matchingItem ? equippedText : emptyText}</span>
          `;

          const iconContainer = slotEl.querySelector(".mech-slot-icon");
          if (matchingItem && iconContainer && typeof create3DIconCanvas === "function") {
            const icon3D = create3DIconCanvas(matchingItem.type || equippedData.itemName, 38, 38);
            if (icon3D) {
              iconContainer.appendChild(icon3D);
            }
          }

          slotEl.onclick = () => {
            window.triggerMechStandSlotAction(i);
          };

          gridContainer.appendChild(slotEl);
        }

        if (statusBadge) {
          statusBadge.style.display = "none";
        }
      };


