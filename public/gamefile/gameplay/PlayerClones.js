// === SEEDPLANET MODULE: JS/PLAYERCLONES.JS ===
// Independent Player Clones System (Spawned at procedural houses)

(function() {
  const f32_cloneModel = new Float32Array(16);
  const f32_cloneMV = new Float32Array(16);

  // Rich collection of cute expressive anime / kaomoji / emoji faces
  const CLONE_EMOJI_FACES = [
    "(^_^)",    // Happy smile
    "(o_o)",    // Curious wide-eyed
    "(^o^)",    // Big cheering smile
    "(¬_¬)",    // Sassy side-eye
    "(*_*)",    // Star-struck
    "(•‿•)",    // Sweet gentle smile
    "(^_-)",    // Playful wink
    "(◕‿◕)",    // Big anime sparkle eyes
    "(>_<)",    // Cute scrunched eyes
    "(≧◡≦)",    // Blushing glee
    "(•ω•)",    // Chibi cat mouth
    "(•̀ᴗ•́)",    // Determined hero grin
    "(♥_♥)",    // Heart eyes
    "(^з^)",    // Whistle kiss
    "(UwU)",    // Classic UwU
    "(OwO)",    // Surprised OwO
    "(^人^)",    // Polite thank-you
    "(•_•)",    // Cool stoic look
    "(¬‿¬)",    // Cheeky sly grin
    "(ᵔᴥᵔ)",    // Cute puppy / bear
    "(⌒‿⌒)",    // Serene closed-eyes smile
    "(★‿★)",    // Starry eyes grin
    "(◕ω◕)",    // Shiny chibi kitty
    "(ʘ‿ʘ)",    // Excited round eyes
    "(•ө•)",    // Cute chick face
    "(´∀｀)",    // Cozy happy warmth
    "(✿◠‿◠)",   // Flower maiden smile
    "(¬o¬)",    // Pouting eyebrow
    "(^Д^)",    // Joyful laughing
    "(｡♥‿♥｡)",  // Romantic heart chibi
    "(=^･ω･^=)",// Little kitty with whiskers
    "(•̀o•́)",    // Brave little face
    "( ˘ ³˘)",   // Whistling tune
    "(∩_∩)",    // Shy cute hands up
    "(ﾟヮﾟ)",    // Retro anime happy
    "(~_~)"     // Sleepy cozy
  ];

  function getCloneVectors(cState, charScale, planetRadius) {
    const cSinT = Math.sin(cState.theta);
    const cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi);
    const cCosP = Math.cos(cState.phi);

    const cNx = cSinT * cCosP;
    const cNy = cCosT;
    const cNz = cSinT * cSinP;

    const heightScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const cHeight = (typeof getVisualHeightOnSphere === "function")
      ? getVisualHeightOnSphere(cState.theta, cState.phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0))
      : 0;
    const terrainRad = planetRadius + cHeight * heightScale;
    const baseGroundRad = terrainRad + 0.46 * charScale;
    let finalGroundRad = baseGroundRad;
    const isSwimming = (cState.currentSwimFactor || 0) > 0.0;

    const cEast = [-cSinP, 0, cCosP];
    const cNorth = [-cCosT * cCosP, cSinT, -cCosT * cSinP];

    const cCosH = Math.cos(cState.heading);
    const cSinH = Math.sin(cState.heading);

    const cR = [
      cEast[0] * cCosH - cNorth[0] * cSinH,
      cEast[1] * cCosH - cNorth[1] * cSinH,
      cEast[2] * cCosH - cNorth[2] * cSinH
    ];
    const cF = [
      cNorth[0] * cCosH + cEast[0] * cSinH,
      cNorth[1] * cCosH + cEast[1] * cSinH,
      cNorth[2] * cCosH + cEast[2] * cSinH
    ];
    let cN = [cNx, cNy, cNz];
    let finalR = [cR[0], cR[1], cR[2]];
    let finalF = [cF[0], cF[1], cF[2]];

    if (isSwimming && typeof window.computeSwimmingTransform === "function") {
      const waterRadius = planetRadius + (typeof waterLevel !== "undefined" ? waterLevel : 0.0) * 0.15;
      const swimRes = window.computeSwimmingTransform({
        swimFactor: cState.currentSwimFactor,
        swimMovementFactor: cState.swimMovementFactor || 0.0,
        diveDepth: cState.diveDepth || 0.0,
        waterRadius,
        terrainRadius: terrainRad,
        charScale,
        isWalking: !cState.isIdle,
        waterTime: typeof waterAnimTime !== "undefined" ? waterAnimTime : (window.performance.now() * 0.001),
        N: cN,
        F: finalF,
        R: finalR,
        baseGroundRadius: baseGroundRad
      });
      finalGroundRad = swimRes.groundRadius;
      cN = swimRes.finalN;
      finalF = swimRes.finalF;
      finalR = swimRes.finalR;
    }

    let finalCPos = [finalGroundRad * cNx, finalGroundRad * cNy, finalGroundRad * cNz];
    if (cState.ridingBoat && cState.ridingBoat.position && cState.ridingBoat.active) {
      const bp = cState.ridingBoat.position;
      const bn = cState.ridingBoat.normal || cN;
      finalCPos = [
        bp[0] + bn[0] * (0.04 + 0.12 * charScale),
        bp[1] + bn[1] * (0.04 + 0.12 * charScale),
        bp[2] + bn[2] * (0.04 + 0.12 * charScale)
      ];
    }

    return { cPos: finalCPos, cR: finalR, cF: finalF, cN };
  }

  function clearOldCloneFaceSigns() {
    if (typeof World3DUI !== "undefined" && typeof World3DUI.removeSign === "function") {
      for (let i = 0; i < 40; i++) {
        const sid = "clone_face_" + i;
        if (typeof World3DUI.hasSign === "function" ? World3DUI.hasSign(sid) : true) {
          World3DUI.removeSign(sid);
        }
      }
    }
  }

  const cloneFaceTextureCache = new Map();

  function getCloneFaceTexture(gl, faceText) {
    if (cloneFaceTextureCache.has(faceText)) {
      return cloneFaceTextureCache.get(faceText);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 512, 256);

    // Soft rosy chibi blush cheeks on left and right
    const drawCheek = (cx, cy) => {
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 42);
      grad.addColorStop(0, "rgba(255, 110, 145, 0.75)");
      grad.addColorStop(0.55, "rgba(255, 110, 145, 0.35)");
      grad.addColorStop(1, "rgba(255, 110, 145, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCheek(102, 162);
    drawCheek(410, 162);

    // Dynamic font sizing based on emoji string length
    let fontSize = 84;
    if (faceText.length >= 9) fontSize = 56;
    else if (faceText.length >= 7) fontSize = 66;
    else if (faceText.length >= 5) fontSize = 76;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#161616";
    ctx.font = "900 " + fontSize + "px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', monospace, 'Courier New', sans-serif";

    // Auto-scale if text exceeds available head face width
    const maxTextWidth = 360;
    const measuredWidth = ctx.measureText(faceText).width;
    if (measuredWidth > maxTextWidth && measuredWidth > 0) {
      fontSize = Math.floor(fontSize * (maxTextWidth / measuredWidth));
      ctx.font = "900 " + fontSize + "px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', monospace, 'Courier New', sans-serif";
    }

    ctx.fillText(faceText, 256, 126);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

    cloneFaceTextureCache.set(faceText, tex);
    return tex;
  }

  // Helper to retrieve spawn location near a specific house (matching player's house spawn system)
  function getCloneHouseSpawn(hIdx, houses, seed, planetRadius) {
    if (typeof window.getHouseSpawnLocation === "function") {
      const loc = window.getHouseSpawnLocation(hIdx);
      if (loc && loc.success && typeof loc.theta === "number") {
        return loc;
      }
    }

    const house = (houses && houses[hIdx]) ? houses[hIdx] : null;
    if (!house) return null;

    const hx = house.x, hy = house.y, hz = house.z;
    const hR = house.R || [1, 0, 0];
    const hF = house.F || [0, 0, 1];
    const wfW = house.wfW || 0.30;
    const totalW = house.totalW || 0.6;
    const totalD = house.totalD || 0.6;
    const door = house.entranceDoor;
    const safeClearance = 0.65;

    let offR = 0, offF = 0;
    if (door) {
      const cellCx = -totalW / 2 + wfW / 2 + door.gx * wfW;
      const cellCy = -totalD / 2 + wfW / 2 + door.gy * wfW;
      if (door.side === "bottom") { offR = cellCx; offF = cellCy - wfW / 2 - safeClearance; }
      else if (door.side === "top") { offR = cellCx; offF = cellCy + wfW / 2 + safeClearance; }
      else if (door.side === "left") { offR = cellCx - wfW / 2 - safeClearance; offF = cellCy; }
      else if (door.side === "right") { offR = cellCx + wfW / 2 + safeClearance; offF = cellCy; }
    } else {
      offR = (totalW / 2 + safeClearance) * (Math.random() > 0.5 ? 1 : -1);
      offF = (totalD / 2 + safeClearance) * (Math.random() > 0.5 ? 1 : -1);
    }

    const candWx = hx + hR[0] * offR + hF[0] * offF;
    const candWy = hy + hR[1] * offR + hF[1] * offF;
    const candWz = hz + hR[2] * offR + hF[2] * offF;
    const dist = Math.sqrt(candWx * candWx + candWy * candWy + candWz * candWz) || 1;
    const theta = Math.acos(Math.max(-1.0, Math.min(1.0, candWy / dist)));
    let phi = Math.atan2(candWz, candWx);
    if (phi < 0) phi += Math.PI * 2;

    return { theta, phi, house, houseIndex: hIdx, x: candWx, y: candWy, z: candWz, success: true };
  }

  let lastTrackedHousesRef = null;
  let lastTrackedHousesCount = -1;

  function getResourceIcon(name) {
    if (name === "AXE") return "🪓";
    if (name === "PICKAXE") return "⛏️";
    if (name === "WOOD_BOAT") return "🛶";
    if (name === "LOG") return "🪵";
    if (name === "BRANCH") return "🌿";
    if (name === "ROCK" || name === "BIG_ROCK") return "🪨";
    if (name === "IRON_ORE") return "🟥";
    if (name === "GOLD_ORE") return "🪙";
    if (name === "GLOW_ORE") return "✨";
    if (name === "ISOPOD") return "🦐";
    if (name === "MEGANEURA") return "🦟";
    if (name === "MEAT" || name === "RAW_MEAT") return "🥩";
    return "📦";
  }

  function getCloneItemCount(cState, itemName) {
    if (!cState || !cState.inventory) return 0;
    let count = 0;
    for (let i = 0; i < cState.inventory.length; i++) {
      const it = cState.inventory[i];
      if (it && it.name === itemName) {
        count += (it.count || 1);
      }
    }
    return count;
  }

  function removeCloneItem(cState, itemName, removeCount) {
    if (!cState || !cState.inventory) return false;
    let needed = removeCount;
    for (let i = 0; i < cState.inventory.length && needed > 0; i++) {
      const it = cState.inventory[i];
      if (it && it.name === itemName) {
        const cur = it.count || 1;
        if (cur > needed) {
          it.count = cur - needed;
          needed = 0;
        } else {
          needed -= cur;
          cState.inventory.splice(i, 1);
          i--;
        }
      }
    }
    return needed === 0;
  }

  function addCloneItem(cState, name, icon, count = 1) {
    if (!cState) return;
    if (!cState.inventory) cState.inventory = [];
    for (let i = 0; i < cState.inventory.length; i++) {
      const it = cState.inventory[i];
      if (it && it.name === name) {
        it.count = (it.count || 1) + count;
        return;
      }
    }
    cState.inventory.push({ name, icon: icon || getResourceIcon(name), count });
  }

  // Ensures every procedural house has a wood_chest inside for clone storage,
  // snapped directly on top of the house's wood floor using the building grid snap system.
  function ensureHouseChests() {
    const houses = (typeof window !== "undefined" && window.placedHouses && Array.isArray(window.placedHouses))
      ? window.placedHouses
      : [];
    if (!houses || houses.length === 0) return;

    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles && Array.isArray(window.collectibles)) ? window.collectibles : []);
    if (!colList) return;

    let modifiedChests = false;

    for (let hIdx = 0; hIdx < houses.length; hIdx++) {
      const house = houses[hIdx];
      if (!house) continue;

      // Find all wood floors belonging to this house
      const houseFloors = colList.filter(c => {
        if (!c || !c.active || c.type !== "wood_floor") return false;
        if (c.houseIndex !== undefined && c.houseIndex === hIdx) return true;
        const dx = c.position[0] - house.x;
        const dy = c.position[1] - house.y;
        const dz = c.position[2] - house.z;
        const maxRad = (house.radius || Math.max(house.totalW || 0.6, house.totalD || 0.6)) + 0.3;
        return (dx * dx + dy * dy + dz * dz) <= maxRad * maxRad;
      });

      // Pick the best floor to snap the chest to (away from entrance door)
      let targetFloor = null;
      if (houseFloors.length > 0) {
        if (house.entranceDoor) {
          const ed = house.entranceDoor;
          let maxDoorDistSq = -1;
          for (const f of houseFloors) {
            const fgx = f.gx !== undefined ? f.gx : 0;
            const fgy = f.gy !== undefined ? f.gy : 0;
            const dgx = fgx - ed.gx;
            const dgy = fgy - ed.gy;
            const distSq = dgx * dgx + dgy * dgy;
            if (distSq > maxDoorDistSq) {
              maxDoorDistSq = distSq;
              targetFloor = f;
            }
          }
        }
        if (!targetFloor) {
          targetFloor = houseFloors[0];
        }
      }

      // Compute snapped position using the floor's grid snap and top surface
      let chestPos, chestN, chestR, chestF;

      if (targetFloor) {
        // Use the existing grid snap logic on top of the wood floor!
        const floorHH = (typeof window !== "undefined" && typeof window.getFloorThickness === "function")
          ? window.getFloorThickness(targetFloor)
          : (((typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05) + (targetFloor.size || 0.25) * 0.12);

        const fP = targetFloor.position;
        const fN = targetFloor.normal || [house.nx || 0, house.ny || 1, house.nz || 0];
        const fR = targetFloor.R || house.R || [1, 0, 0];
        const fF = targetFloor.F || house.F || [0, 0, 1];

        // The top surface of this wood_floor is exactly: fP + fN * (floorHH / 2)
        // With grid snap offset 0, 0 (centered on the floor tile)
        const topOfFloor = floorHH / 2;
        chestPos = [
          fP[0] + fN[0] * topOfFloor,
          fP[1] + fN[1] * topOfFloor,
          fP[2] + fN[2] * topOfFloor
        ];
        chestN = fN;
        chestR = fR;
        chestF = fF;
      } else {
        // Fallback: full calculation of foundation stone + wood floor thickness
        const hx = house.x, hy = house.y, hz = house.z;
        const hR = house.R || [1, 0, 0];
        const hF = house.F || [0, 0, 1];
        const hN = [house.nx || 0, house.ny || 1, house.nz || 0];
        const totalW = house.totalW || 0.6;
        const totalD = house.totalD || 0.6;

        const stoneH = 0.25 * 0.15; // 0.0375
        const baseWfH = (typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05;
        const actualWfThickness = baseWfH + 0.25 * 0.12; // 0.08
        const floorTopElev = stoneH + actualWfThickness; // ~0.1175m

        const cx = -totalW * 0.25;
        const cy = -totalD * 0.25;
        chestPos = [
          hx + hR[0] * cx + hF[0] * cy + hN[0] * floorTopElev,
          hy + hR[1] * cx + hF[1] * cy + hN[1] * floorTopElev,
          hz + hR[2] * cx + hF[2] * cy + hN[2] * floorTopElev
        ];
        chestN = hN;
        chestR = hR;
        chestF = hF;
      }

      let chest = house.chest;
      if (!chest || !chest.active) {
        chest = colList.find(c => c && c.active && c.type === "wood_chest" && (c.houseIndex === hIdx || (c.isHouseChest && c.houseIndex === hIdx)));
      }

      if (!chest || !chest.active) {
        chest = {
          type: "wood_chest",
          position: chestPos,
          normal: chestN,
          R: chestR,
          F: chestF,
          active: true,
          storage: Array(20).fill(null),
          isHouse: true,
          isProceduralHouse: true,
          isHouseChest: true,
          houseIndex: hIdx,
          hideFromCompass: false
        };
        colList.push(chest);
        modifiedChests = true;
      } else {
        // If chest exists but is sunken or misaligned, snap it up to the wood floor surface!
        const cP = chest.position;
        const distSq = (cP[0] - chestPos[0])**2 + (cP[1] - chestPos[1])**2 + (cP[2] - chestPos[2])**2;
        if (distSq > 0.0004) { // more than 2cm difference (e.g. old sunken 0.08 vs 0.1175)
          chest.position = chestPos;
          chest.normal = chestN;
          chest.R = chestR;
          chest.F = chestF;
          modifiedChests = true;
        }
      }

      if (!chest.storage || !Array.isArray(chest.storage)) {
        chest.storage = Array(20).fill(null);
      }
      house.chest = chest;
    }

    if (modifiedChests) {
      if (typeof refreshCollectiblesVBO === "function") {
        refreshCollectiblesVBO();
      }
      if (typeof window !== "undefined") {
        window.pendingCollectibleRefresh = true;
        window.pendingDynamicCollectibleRefresh = true;
      }
    }
  }

  // Spawns a plain, unequipped boat in water near the clone's house
  function spawnPlainBoatNearHouse(hIdx, planetRadius) {
    const houses = (typeof window !== "undefined" && window.placedHouses) ? window.placedHouses : [];
    const house = houses[hIdx];
    if (!house) return null;

    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles) ? window.collectibles : []);

    const hTheta = Math.acos(Math.max(-1, Math.min(1, house.y / (planetRadius || 8.0))));
    const hPhi = Math.atan2(house.z, house.x);
    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const heightScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const wLevel = (typeof waterLevel !== "undefined") ? waterLevel : 1.0;
    const waterRadius = planetRadius + wLevel * (heightScale * 0.25);

    let boatTheta = hTheta, boatPhi = hPhi;
    for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 4) {
      const candT = Math.max(0.1, Math.min(Math.PI - 0.1, hTheta + Math.cos(ang) * (0.8 / planetRadius)));
      const candP = hPhi + Math.sin(ang) * (0.8 / (planetRadius * Math.sin(hTheta)));
      const h = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(candT, candP, seed) : 0;
      const gRad = planetRadius + h * heightScale;
      if (gRad < waterRadius - 0.02) {
        boatTheta = candT;
        boatPhi = candP;
        break;
      }
    }

    const sinT = Math.sin(boatTheta), cosT = Math.cos(boatTheta);
    const sinP = Math.sin(boatPhi), cosP = Math.cos(boatPhi);
    const nx = sinT * cosP, ny = cosT, nz = sinT * sinP;
    const pos = [waterRadius * nx, waterRadius * ny, waterRadius * nz];
    const east = [-sinP, 0, cosP];
    const north = [-cosT * cosP, sinT, -cosT * sinP];

    // Plain empty boat: NO wheels, NO wings, NO engines
    const boat = {
      type: "wood_boat",
      position: pos,
      normal: [nx, ny, nz],
      R: east,
      F: north,
      active: true,
      isDynamic: true,
      hasWheel: false,
      hasWheels: false,
      wheelCount: 0,
      hasWing: false,
      hasWings: false,
      wingCount: 0,
      hasEngine: false,
      isCloneCrafted: true,
      houseIndex: hIdx
    };

    colList.push(boat);
    if (typeof window !== "undefined") {
      window.pendingDynamicCollectibleRefresh = true;
    }
    return boat;
  }

  // =========================================================================
  // AUTONOMOUS CRAFTING SYSTEM:
  // Clones craft tools, boats, wheels, electric engines, and batteries!
  // =========================================================================
  function tryCloneCrafting(cState, planetRadius) {
    if (!cState) return null;

    // 1. Axe: 1 Rock + 3 Branch
    const rockCount = getCloneItemCount(cState, "ROCK") + getCloneItemCount(cState, "BIG_ROCK");
    const branchCount = getCloneItemCount(cState, "BRANCH");
    const hasAxe = getCloneItemCount(cState, "AXE") > 0 || cState.equippedTool === "AXE";

    if (!hasAxe && rockCount >= 1 && branchCount >= 3) {
      if (removeCloneItem(cState, "ROCK", 1) || removeCloneItem(cState, "BIG_ROCK", 1)) {
        removeCloneItem(cState, "BRANCH", 3);
        addCloneItem(cState, "AXE", "🪓", 1);
        cState.equippedTool = "AXE";
        cState.faceText = "(•̀ᴗ•́)";
        return "axe";
      }
    }

    // 2. Pickaxe (อีเตอร์): 2 Rock + 3 Branch
    const hasPick = getCloneItemCount(cState, "PICKAXE") > 0 || cState.equippedTool === "PICKAXE";
    const curRocks = getCloneItemCount(cState, "ROCK") + getCloneItemCount(cState, "BIG_ROCK");
    const curBranches = getCloneItemCount(cState, "BRANCH");

    if (!hasPick && curRocks >= 2 && curBranches >= 3) {
      const removedRock1 = removeCloneItem(cState, "ROCK", 1) || removeCloneItem(cState, "BIG_ROCK", 1);
      const removedRock2 = removeCloneItem(cState, "ROCK", 1) || removeCloneItem(cState, "BIG_ROCK", 1);
      if (removedRock1 && removedRock2) {
        removeCloneItem(cState, "BRANCH", 3);
        addCloneItem(cState, "PICKAXE", "⛏️", 1);
        cState.equippedTool = "PICKAXE";
        cState.faceText = "(★‿★)";
        return "pickaxe";
      }
    }

    // 3. Glow Battery (หินเรืองแสงอัดแท่ง/แบตเตอรี่): 1 Glow Ore
    const glowOreCount = getCloneItemCount(cState, "GLOW_ORE");
    const batteryCount = getCloneItemCount(cState, "GLOW_BATTERY");
    if (glowOreCount >= 1 && batteryCount < 3) {
      if (removeCloneItem(cState, "GLOW_ORE", 1)) {
        addCloneItem(cState, "GLOW_BATTERY", "🔋", 1);
        cState.faceText = "(✨‿✨)";
        return "glow_battery";
      }
    }

    // 4. Plain Boat (เรือไม้): 3 Log
    const logCount = getCloneItemCount(cState, "LOG");
    if (logCount >= 3 && (!cState.ownedBoat || !cState.ownedBoat.active)) {
      if (removeCloneItem(cState, "LOG", 3)) {
        const newBoat = spawnPlainBoatNearHouse(cState.houseIndex, planetRadius);
        if (newBoat) {
          cState.ownedBoat = newBoat;
          cState.faceText = "(^o^)";
          return "wood_boat";
        }
      }
    }

    // 5. Wood Wheels (ล้อไม้ติดเรือ): 4 Log + 5 Iron Ore
    const ironCount = getCloneItemCount(cState, "IRON_ORE");
    if (cState.ownedBoat && cState.ownedBoat.active && !cState.ownedBoat.hasWheel && !cState.ownedBoat.hasWheels) {
      if (logCount >= 4 && ironCount >= 5) {
        if (removeCloneItem(cState, "LOG", 4) && removeCloneItem(cState, "IRON_ORE", 5)) {
          cState.ownedBoat.hasWheel = true;
          cState.ownedBoat.hasWheels = true;
          cState.ownedBoat.wheelCount = 4;
          cState.faceText = "(🛞‿🛞)";
          if (typeof window !== "undefined") {
            window.pendingDynamicCollectibleRefresh = true;
          }
          return "wood_wheel";
        }
      }
    }

    // 6. Electric Engine (เครื่องยนต์ไฟฟ้าติดเรือ): 10 Iron Ore
    if (cState.ownedBoat && cState.ownedBoat.active && !cState.ownedBoat.hasEngine) {
      if (ironCount >= 10) {
        if (removeCloneItem(cState, "IRON_ORE", 10)) {
          cState.ownedBoat.hasEngine = true;
          cState.faceText = "(⚙️‿⚙️)";
          if (typeof window !== "undefined") {
            window.pendingDynamicCollectibleRefresh = true;
          }
          return "electric_engine";
        }
      }
    }

    // 7. Wooden Arm Cannon (ปืนไม้ติดแขน): 2 Log + 1 Rock/Big Rock
    const hasCannon = getCloneItemCount(cState, "WOODEN_ARM_CANNON") > 0 || getCloneItemCount(cState, "ARM_CANNON") > 0 || cState.equippedTool === "WOODEN_ARM_CANNON";
    const cannonRockCount = getCloneItemCount(cState, "BIG_ROCK") + getCloneItemCount(cState, "ROCK");
    if (!hasCannon && logCount >= 2 && cannonRockCount >= 1) {
      if (removeCloneItem(cState, "LOG", 2)) {
        if (removeCloneItem(cState, "BIG_ROCK", 1) || removeCloneItem(cState, "ROCK", 1)) {
          addCloneItem(cState, "WOODEN_ARM_CANNON", "🪵🦾", 1);
          cState.faceText = "(🪵🦾‿🦾)";
          return "wooden_arm_cannon";
        } else {
          addCloneItem(cState, "LOG", "🪵", 2);
        }
      }
    }

    // 8. Arrows (ลูกศรสำหรับปืนไม้): 1 Log + 1 Rock/Big Rock -> 30 Arrows
    const curArrows = getCloneItemCount(cState, "ARROW");
    if (curArrows < 30 && logCount >= 1 && cannonRockCount >= 1) {
      if (removeCloneItem(cState, "LOG", 1)) {
        if (removeCloneItem(cState, "BIG_ROCK", 1) || removeCloneItem(cState, "ROCK", 1)) {
          addCloneItem(cState, "ARROW", "🏹", 30);
          cState.faceText = "(🏹‿🏹)";
          return "arrow";
        } else {
          addCloneItem(cState, "LOG", "🪵", 1);
        }
      }
    }

    return null;
  }

  // =========================================================================
  // SHARED BOAT USABILITY & DRIVEABILITY RULES (100% Shared with Player Rules)
  // - Wheeled boat: MUST have Engine to drive
  // - Plain boat: MUST be in Water to drive
  // - Winged boat: Prohibited for clones (Clone-specific AI restriction)
  // =========================================================================
  function checkCloneBoatWaterContact(theta, phi, planetRadius) {
    if (typeof waterEnabled !== "undefined" && !waterEnabled) return false;
    const wl = (typeof waterLevel !== "undefined") ? waterLevel : 0.0;
    const waterRad = (typeof minDryRadius !== "undefined") ? minDryRadius : (planetRadius + wl * 0.15);
    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const hs = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const bHeight = (typeof getVisualHeightOnSphere === "function")
      ? getVisualHeightOnSphere(theta, phi, seed)
      : 0;
    const terrainRad = planetRadius + bHeight * hs;
    const depth = waterRad - terrainRad;
    const pScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
    return depth > 0.35 * pScale;
  }

  function isBoatUsableByClone(b, planetRadius, cState) {
    if (!b || !b.active || b.isPreview || b.type !== "wood_boat") return false;
    // Strict prohibition on winged / flying boats for clones
    if (b.hasWing || b.hasWings || (b.wingCount && b.wingCount > 0)) {
      return false;
    }
    // Player currently driving? Do not steal while occupied
    if (typeof window !== "undefined" && window.activeRidingBoat === b) {
      return false;
    }
    // Another clone currently driving?
    if (window.playerClonesState && window.playerClonesState.some(cl => cl !== cState && cl.ridingBoat === b)) {
      return false;
    }

    const pRad = planetRadius || (typeof RADIUS !== "undefined" ? RADIUS : 20.0);
    let inWater = false;
    if (b.position) {
      const rLen = Math.sqrt(b.position[0]**2 + b.position[1]**2 + b.position[2]**2) || 1;
      const bTheta = Math.acos(Math.max(-1, Math.min(1, b.position[1] / rLen)));
      const bPhi = Math.atan2(b.position[2], b.position[0]);
      inWater = checkCloneBoatWaterContact(bTheta, bPhi, pRad);
    }

    const hasWheels = !!(b.hasWheel || b.hasWheels || (b.wheelCount && b.wheelCount > 0));
    const hasBattery = cState ? (getCloneItemCount(cState, "GLOW_BATTERY") > 0) : true;

    // Call Central Shared Vehicle Rule
    if (typeof window !== "undefined" && typeof window.isVehicleDriveable === "function") {
      return window.isVehicleDriveable(b, inWater, hasBattery);
    }

    return hasWheels ? (!!b.hasEngine && hasBattery) : inWater;
  }

  // Deposits farmed items into the clone's house chest
  function depositItemsIntoHouseChest(cState, houses) {
    const house = (houses && houses[cState.houseIndex]) ? houses[cState.houseIndex] : null;
    if (!house || !house.chest) return 0;
    const chest = house.chest;
    if (!chest.storage) chest.storage = Array(20).fill(null);

    let depositedCount = 0;

    for (let i = 0; i < cState.inventory.length; i++) {
      const it = cState.inventory[i];
      if (!it) continue;
      // Keep working tools (AXE, PICKAXE) and weapons/ammo (WOODEN_ARM_CANNON, ARROW, IRON_BULLET) equipped
      if (it.name === "AXE" || it.name === "PICKAXE" || it.name === "WOODEN_ARM_CANNON" || it.name === "ARM_CANNON" || it.name === "ARROW" || it.name === "IRON_BULLET") continue;

      const itemName = it.name;
      const count = it.count || 1;
      let placed = false;

      // Try stacking into existing slot
      for (let s = 0; s < chest.storage.length; s++) {
        const slot = chest.storage[s];
        if (slot && (slot.name === itemName || slot.label === itemName)) {
          slot.count = (slot.count || 1) + count;
          placed = true;
          break;
        }
      }

      // Or place into first empty slot
      if (!placed) {
        for (let s = 0; s < chest.storage.length; s++) {
          if (chest.storage[s] === null) {
            chest.storage[s] = {
              name: itemName,
              label: it.label || itemName,
              icon: it.icon || getResourceIcon(itemName),
              count: count
            };
            placed = true;
            break;
          }
        }
      }

      if (placed) {
        depositedCount += count;
        cState.inventory.splice(i, 1);
        i--;
      }
    }

    if (depositedCount > 0) {
      cState.faceText = "(^人^)";
    }
    return depositedCount;
  }

  function setCloneTargetPos(cState, tx, ty, tz, planetRadius) {
    const dist = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    cState.targetTheta = Math.acos(Math.max(-1.0, Math.min(1.0, ty / dist)));
    let phi = Math.atan2(tz, tx);
    if (phi < 0) phi += Math.PI * 2;
    cState.targetPhi = phi;
  }

  function findTargetTree(cState, planetRadius) {
    const natureObs = (typeof natureObstacles !== "undefined" && Array.isArray(natureObstacles))
      ? natureObstacles
      : ((typeof window !== "undefined" && window.natureObstacles) ? window.natureObstacles : []);
    if (!natureObs || natureObs.length === 0) return null;

    const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
    const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];

    let bestTree = null;
    let minD = 12.0;

    for (let i = 0; i < natureObs.length; i++) {
      const obs = natureObs[i];
      if (!obs || !obs.position || obs.type !== "tree") continue;
      const dx = obs.position[0] - cPos[0];
      const dy = obs.position[1] - cPos[1];
      const dz = obs.position[2] - cPos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minD) {
        minD = d;
        bestTree = obs;
      }
    }
    return bestTree;
  }

  function findTargetOre(cState, planetRadius, preferredType = null) {
    const natureObs = (typeof natureObstacles !== "undefined" && Array.isArray(natureObstacles))
      ? natureObstacles
      : ((typeof window !== "undefined" && window.natureObstacles) ? window.natureObstacles : []);
    if (!natureObs || natureObs.length === 0) return null;

    const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
    const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];

    let bestOre = null;
    let minD = 14.0;

    for (let i = 0; i < natureObs.length; i++) {
      const obs = natureObs[i];
      if (!obs || !obs.position) continue;
      const isOre = obs.type === "iron_ore" || obs.type === "gold_ore" || obs.type === "glow_ore";
      const isRock = obs.type === "rock";
      if (!isOre && !isRock) continue;

      const dx = obs.position[0] - cPos[0];
      const dy = obs.position[1] - cPos[1];
      const dz = obs.position[2] - cPos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Prioritize preferred ore type if requested by quantum goal evaluation
      let prefBonus = 0;
      if (preferredType && obs.type === preferredType) prefBonus = 4.5;
      else if (isOre) prefBonus = 2.5;

      const score = d - prefBonus;
      if (score < minD) {
        minD = score;
        bestOre = obs;
      }
    }
    return bestOre;
  }

  function findTargetAnimal(cState, planetRadius) {
    const amphibs = (typeof amphibians !== "undefined" && Array.isArray(amphibians))
      ? amphibians
      : ((typeof window !== "undefined" && window.amphibians && Array.isArray(window.amphibians)) ? window.amphibians : []);
    if (!amphibs || amphibs.length === 0) return null;

    const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
    const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];

    let bestAnimal = null;
    let minD = 12.0;

    for (let i = 0; i < amphibs.length; i++) {
      const npc = amphibs[i];
      if (!npc || npc.ragdollEnabled || (npc.hp !== undefined && npc.hp <= 0)) continue;
      let nPos = npc.position;
      if (npc.ragdollPos && npc.ragdollInitialized) nPos = npc.ragdollPos;
      if (!nPos) continue;

      const dx = nPos[0] - cPos[0];
      const dy = nPos[1] - cPos[1];
      const dz = nPos[2] - cPos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minD) {
        minD = d;
        bestAnimal = npc;
      }
    }
    return bestAnimal;
  }

  function findTargetDrop(cState, planetRadius) {
    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles) ? window.collectibles : []);
    if (!colList || colList.length === 0) return null;

    const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
    const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];

    let bestDrop = null;
    let minD = 8.0;

    for (let i = 0; i < colList.length; i++) {
      const it = colList[i];
      if (!it || !it.active || it.isPreview || !it.position) continue;
      const isResourceDrop = (it.type === "log" || it.type === "branch" || it.type === "rock" || it.type === "big_rock" || it.type === "iron_ore" || it.type === "gold_ore" || it.type === "glow_ore" || it.type === "isopod_item" || it.type === "meganeura_item");
      if (!isResourceDrop) continue;

      const dx = it.position[0] - cPos[0];
      const dy = it.position[1] - cPos[1];
      const dz = it.position[2] - cPos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minD) {
        minD = d;
        bestDrop = it;
      }
    }
    return bestDrop;
  }

  function findStealableBoat(cState, planetRadius) {
    const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles))
      ? collectibles
      : ((typeof window !== "undefined" && window.collectibles) ? window.collectibles : []);
    if (!colList || colList.length === 0) return null;

    const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
    const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
    const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];

    // If clone already owns a boat and it's usable, prioritize their own boat!
    if (cState.ownedBoat && cState.ownedBoat.active && isBoatUsableByClone(cState.ownedBoat, planetRadius, cState)) {
      return cState.ownedBoat;
    }

    let bestBoat = null;
    let minD = 18.0;

    for (let i = 0; i < colList.length; i++) {
      const b = colList[i];
      if (!isBoatUsableByClone(b, planetRadius, cState) || !b.position) continue;
      const dx = b.position[0] - cPos[0];
      const dy = b.position[1] - cPos[1];
      const dz = b.position[2] - cPos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minD) {
        minD = d;
        bestBoat = b;
      }
    }
    return bestBoat;
  }

  // =========================================================================
  // ON-SIGHT QUANTUM SUPERPOSITION DECISION ENGINE ("เห็นค่อยคิด ค่อยทำ")
  // Using TheCube to evaluate needs and collapse wavefunction dynamically
  // =========================================================================
  function decideCloneActionOnSight(cState, planetRadius, houses) {
    const candidates = [];

    // Analyze current goal & missing parts:
    const hasAxe = getCloneItemCount(cState, "AXE") > 0 || cState.equippedTool === "AXE";
    const hasPick = getCloneItemCount(cState, "PICKAXE") > 0 || cState.equippedTool === "PICKAXE";
    const rockCount = getCloneItemCount(cState, "ROCK") + getCloneItemCount(cState, "BIG_ROCK");
    const branchCount = getCloneItemCount(cState, "BRANCH");
    const logCount = getCloneItemCount(cState, "LOG");
    const ironCount = getCloneItemCount(cState, "IRON_ORE");
    const glowCount = getCloneItemCount(cState, "GLOW_ORE");
    const batteryCount = getCloneItemCount(cState, "GLOW_BATTERY");

    const hasOwnedBoat = !!(cState.ownedBoat && cState.ownedBoat.active);
    const boatHasWheels = hasOwnedBoat && !!(cState.ownedBoat.hasWheel || cState.ownedBoat.hasWheels);
    const boatHasEngine = hasOwnedBoat && !!cState.ownedBoat.hasEngine;
    const hasBattery = batteryCount > 0;

    // Missing needs:
    const needsAxe = !hasAxe;
    const needsPick = !hasPick;
    const needsBoat = !hasOwnedBoat;
    const needsWheels = hasOwnedBoat && !boatHasWheels;
    const needsEngine = hasOwnedBoat && !boatHasEngine;
    const needsBattery = !hasBattery;

    // 1. เห็นหีบของบ้านตัวเอง (House Chest) เมื่อมีไอเทมจากการทำงาน
    const house = (houses && houses[cState.houseIndex]) ? houses[cState.houseIndex] : null;
    const chest = (house && house.chest && house.chest.active) ? house.chest : null;
    const hasFarmedLoot = cState.inventory && cState.inventory.some(it => it && it.name !== "AXE" && it.name !== "PICKAXE" && it.name !== "GLOW_BATTERY");
    if (hasFarmedLoot && chest && chest.position) {
      const invCount = cState.inventory.length;
      const workCycles = cState.workCycles || 0;
      const depositWeight = 0.45 + invCount * 0.35 + workCycles * 0.3;
      candidates.push({
        action: "DEPOSIT_CHEST",
        target: chest,
        weight: depositWeight
      });
    }

    // 2. เห็นไอเทมตกบนพื้นใกล้ๆ (Loose Drops)
    const drop = findTargetDrop(cState, planetRadius);
    if (drop && drop.position) {
      const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
      const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
      const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];
      const dx = drop.position[0] - cPos[0];
      const dy = drop.position[1] - cPos[1];
      const dz = drop.position[2] - cPos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      candidates.push({
        action: "PICKUP_DROPS",
        target: drop,
        weight: Math.max(0.2, 2.4 / (dist + 0.3))
      });
    }

    // 3. เห็นเรือเปล่า/เรือติดล้อที่ขับได้ (Driveable Boat)
    const isFullyUpgraded = hasOwnedBoat && boatHasWheels && boatHasEngine && hasBattery;
    let driveWeight = 0.38;
    if (isFullyUpgraded) {
      driveWeight = 1.6; // High urge to enjoy driving fully completed motorized vehicle!
    } else if (hasOwnedBoat && isBoatUsableByClone(cState.ownedBoat, planetRadius, cState)) {
      driveWeight = 0.85;
    }

    const boat = findStealableBoat(cState, planetRadius);
    if (boat && boat.position) {
      candidates.push({
        action: "STEAL_BOAT",
        target: boat,
        weight: driveWeight
      });
    }

    // 4. เห็นต้นไม้สำหรับตัดไม้ (Tree)
    let chopWeight = hasAxe ? 0.78 : 0.38;
    if (needsBoat && logCount < 3) chopWeight += 0.85;
    if (needsWheels && logCount < 4) chopWeight += 0.65;
    if (needsAxe && branchCount < 3) chopWeight += 0.50;

    const tree = findTargetTree(cState, planetRadius);
    if (tree && tree.position) {
      candidates.push({
        action: "CHOP_WOOD",
        target: tree,
        weight: chopWeight
      });
    }

    // 5. เห็นแร่หรือก้อนหินสำหรับขุด (Ore / Rock)
    let preferredOre = null;
    if (needsBattery && glowCount < 1) preferredOre = "glow_ore";
    else if ((needsEngine || needsWheels) && ironCount < 10) preferredOre = "iron_ore";

    let mineWeight = hasPick ? 0.70 : 0.30;
    if (needsBattery && glowCount < 1) mineWeight += 1.15;
    if (needsEngine && ironCount < 10) mineWeight += 0.95;
    if (needsWheels && ironCount < 5) mineWeight += 0.75;
    if (needsPick && rockCount < 2) mineWeight += 0.55;

    const ore = findTargetOre(cState, planetRadius, preferredOre);
    if (ore && ore.position) {
      const isRare = (ore.type === "iron_ore" || ore.type === "gold_ore" || ore.type === "glow_ore");
      candidates.push({
        action: "MINE_ORE",
        target: ore,
        weight: hasPick ? (isRare ? (mineWeight + 0.2) : mineWeight) : (mineWeight * 0.5)
      });
    }

    // 6. เห็นสัตว์มีชีวิต (Animal hunting)
    const animal = findTargetAnimal(cState, planetRadius);
    if (animal) {
      const hasCannon = getCloneItemCount(cState, "WOODEN_ARM_CANNON") > 0 || getCloneItemCount(cState, "ARM_CANNON") > 0;
      const arrowCount = getCloneItemCount(cState, "ARROW");
      candidates.push({
        action: "HUNT_ANIMAL",
        target: animal,
        weight: (hasCannon && arrowCount > 0) ? 0.9 : (hasAxe ? 0.6 : 0.3)
      });
    }

    // 7. ทางเลือกพื้นฐาน: เดินเล่นผ่อนคลายรอบบ้าน (Wander yard stroll)
    candidates.push({
      action: "WANDER",
      target: null,
      weight: 0.30
    });

    // ค่อยคิด: ประมวลผล Qubit Wavefunction Collapse (Born Rule) จาก TheCube.js
    const solver = (typeof Qubit === "function")
      ? Qubit
      : ((typeof window !== "undefined" && window.Qubit)
        ? window.Qubit
        : ((typeof computeQuantumSuperpositionAI === "function") ? computeQuantumSuperpositionAI : null));

    let chosen = null;
    if (solver) {
      chosen = solver(candidates, {
        agentPhase: (cState.agentPhase || 0) + (cState.workCycles || 0) * 0.4,
        temperature: 0.12,
        interferencePower: 0.28
      });
    } else {
      let totalW = 0;
      for (let i = 0; i < candidates.length; i++) totalW += candidates[i].weight;
      let r = Math.random() * totalW;
      for (let i = 0; i < candidates.length; i++) {
        r -= candidates[i].weight;
        if (r <= 0) { chosen = candidates[i]; break; }
      }
      if (!chosen) chosen = candidates[candidates.length - 1];
    }

    return chosen;
  }

  function executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius) {
    const chosen = decideCloneActionOnSight(cState, planetRadius, houses);
    if (!chosen) return;

    cState.thinkTimer = 1.2 + Math.random() * 0.8;
    cState.isIdle = false;

    if (chosen.action === "DEPOSIT_CHEST") {
      cState.currentActivity = "DEPOSIT_CHEST";
      setCloneTargetPos(cState, chosen.target.position[0], chosen.target.position[1], chosen.target.position[2], planetRadius);
      cState.equippedTool = null;
      cState.faceText = "(^人^)";
      cState.timer = 6.0;
    } else if (chosen.action === "PICKUP_DROPS") {
      cState.currentActivity = "PICKUP_DROPS";
      cState.targetDrop = chosen.target;
      setCloneTargetPos(cState, chosen.target.position[0], chosen.target.position[1], chosen.target.position[2], planetRadius);
      cState.faceText = "(ʘ‿ʘ)";
      cState.timer = 5.0;
    } else if (chosen.action === "STEAL_BOAT") {
      cState.currentActivity = "STEAL_BOAT";
      cState.targetBoat = chosen.target;
      setCloneTargetPos(cState, chosen.target.position[0], chosen.target.position[1], chosen.target.position[2], planetRadius);
      cState.faceText = "(¬‿¬)";
      cState.equippedTool = null;
      cState.timer = 8.0;
    } else if (chosen.action === "CHOP_WOOD") {
      cState.currentActivity = "CHOP_WOOD";
      cState.targetObstacle = chosen.target;
      setCloneTargetPos(cState, chosen.target.position[0], chosen.target.position[1], chosen.target.position[2], planetRadius);
      cState.equippedTool = "AXE";
      cState.faceText = "(•̀o•́)";
      cState.timer = 8.0;
    } else if (chosen.action === "MINE_ORE") {
      cState.currentActivity = "MINE_ORE";
      cState.targetObstacle = chosen.target;
      setCloneTargetPos(cState, chosen.target.position[0], chosen.target.position[1], chosen.target.position[2], planetRadius);
      cState.equippedTool = "PICKAXE";
      cState.faceText = "(•̀ᴗ•́)";
      cState.timer = 8.0;
    } else if (chosen.action === "HUNT_ANIMAL") {
      cState.currentActivity = "HUNT_ANIMAL";
      cState.targetAnimal = chosen.target;
      let aPos = chosen.target.position;
      if (chosen.target.ragdollPos && chosen.target.ragdollInitialized) aPos = chosen.target.ragdollPos;
      if (aPos) setCloneTargetPos(cState, aPos[0], aPos[1], aPos[2], planetRadius);
      cState.equippedTool = "AXE";
      cState.faceText = "(•̀ᴗ•́)";
      cState.timer = 7.0;
    } else {
      // WANDER (Stroll around assigned house yard)
      cState.currentActivity = "WANDER";
      cState.equippedTool = null;
      cState.faceText = cState.baseFaceText || "(•‿•)";
      cState.timer = 2.0 + Math.random() * 3.5;

      const rAngle = Math.random() * Math.PI * 2;
      const rDist = 0.35 + Math.random() * 1.25;
      const dNorth = Math.cos(rAngle) * rDist;
      const dEast = Math.sin(rAngle) * rDist;
      const candTheta = Math.max(0.08, Math.min(Math.PI - 0.08, cState.baseTheta - dNorth / planetRadius));
      const sinBaseT = Math.max(0.05, Math.sin(cState.baseTheta));
      const candPhi = cState.basePhi + dEast / (planetRadius * sinBaseT);

      const hVal = (typeof getVisualHeightOnSphere === "function")
        ? getVisualHeightOnSphere(candTheta, candPhi, seed)
        : 0;
      const candRadius = planetRadius + hVal * heightScale;

      if (candRadius >= minDryRadius) {
        cState.targetTheta = candTheta;
        cState.targetPhi = candPhi;
      } else {
        cState.targetTheta = cState.baseTheta;
        cState.targetPhi = cState.basePhi;
      }
    }
  }

  window.initPlayerClonesIfNeeded = function(forceRespawn = false) {
    clearOldCloneFaceSigns();

    const houses = (typeof window !== "undefined" && window.placedHouses && Array.isArray(window.placedHouses))
      ? window.placedHouses
      : [];
    const numHouses = houses.length;

    // Check if we already have valid clones and houses haven't changed
    if (!forceRespawn && window.playerClonesState && window.playerClonesState.length > 0 && typeof window.playerClonesState[0].theta === "number") {
      if (numHouses > 0 && lastTrackedHousesCount === 0) {
        // Proceed to spawn at houses
      } else if (lastTrackedHousesRef === houses && lastTrackedHousesCount === numHouses) {
        ensureHouseChests();
        return;
      }
    }

    lastTrackedHousesRef = houses;
    lastTrackedHousesCount = numHouses;

    // Target clone count: half of the procedural houses count (at least 1 if houses exist)
    const cloneCount = numHouses > 0 ? Math.max(1, Math.floor(numHouses / 2)) : 0;
    if (cloneCount === 0) {
      window.playerClonesState = [];
      return;
    }

    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;

    ensureHouseChests();

    // Shuffle house indices so clones are placed at distinct random houses
    const shuffledHouseIndices = [];
    for (let i = 0; i < numHouses; i++) shuffledHouseIndices.push(i);
    for (let i = shuffledHouseIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffledHouseIndices[i];
      shuffledHouseIndices[i] = shuffledHouseIndices[j];
      shuffledHouseIndices[j] = tmp;
    }

    // Shuffle emoji faces for diverse, unique expressions
    const shuffledFaces = CLONE_EMOJI_FACES.slice();
    for (let i = shuffledFaces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffledFaces[i];
      shuffledFaces[i] = shuffledFaces[j];
      shuffledFaces[j] = tmp;
    }

    const clones = [];
    for (let i = 0; i < cloneCount; i++) {
      const hIdx = shuffledHouseIndices[i % numHouses];
      const spawnLoc = getCloneHouseSpawn(hIdx, houses, seed, planetRadius);

      let cTheta = 0.6;
      let cPhi = 0.0;
      let heading = Math.random() * Math.PI * 2;

      if (spawnLoc && typeof spawnLoc.theta === "number") {
        cTheta = spawnLoc.theta;
        cPhi = spawnLoc.phi;

        if (spawnLoc.house && typeof spawnLoc.x === "number") {
          const dx = spawnLoc.x - spawnLoc.house.x;
          const dy = spawnLoc.y - spawnLoc.house.y;
          const dz = spawnLoc.z - spawnLoc.house.z;
          const sinT = Math.sin(cTheta);
          const cosT = Math.cos(cTheta);
          const sinP = Math.sin(cPhi);
          const cosP = Math.cos(cPhi);
          const east = [-sinP, 0, cosP];
          const north = [-cosT * cosP, sinT, -cosT * sinP];
          const dEast = dx * east[0] + dy * east[1] + dz * east[2];
          const dNorth = dx * north[0] + dy * north[1] + dz * north[2];
          if (dEast * dEast + dNorth * dNorth > 0.0001) {
            heading = Math.atan2(dEast, dNorth) + (Math.random() - 0.5) * 0.4;
          }
        }
      } else {
        const pTheta = (typeof charTheta !== "undefined") ? charTheta : 0.6;
        const pPhi = (typeof charPhi !== "undefined") ? charPhi : 0.0;
        const pHeading = (typeof charHeading !== "undefined") ? charHeading : 0.0;
        const angle = (i / cloneCount) * Math.PI * 2;
        const dist = 1.0 + (i % 3) * 0.3;
        const dNorth = Math.cos(angle) * dist;
        const dEast = Math.sin(angle) * dist;
        const sinT = Math.max(0.05, Math.sin(pTheta));
        cTheta = Math.max(0.08, Math.min(Math.PI - 0.08, pTheta - dNorth / planetRadius));
        cPhi = pPhi + dEast / (planetRadius * sinT);
        heading = pHeading + (i - cloneCount / 2) * 0.3;
      }

      const face = shuffledFaces[i % shuffledFaces.length];

      clones.push({
        houseIndex: hIdx,
        theta: cTheta,
        phi: cPhi,
        baseTheta: cTheta,
        basePhi: cPhi,
        targetTheta: cTheta,
        targetPhi: cPhi,
        heading: heading,
        timer: 1.0 + (i % 4) * 0.4,
        isIdle: true,
        moveSpeed: 0.24 + (i % 3) * 0.03,
        speedInitialized: true,
        animPhase: i * 1.3,
        walkBlend: 0.0,
        faceText: face,
        baseFaceText: face,
        // LIFE SYSTEM ATTRIBUTES:
        hp: 5,
        maxHp: 5,
        inventory: [],
        equippedTool: null, // "AXE", "PICKAXE"
        currentActivity: "WANDER",
        activityTimer: 2.0 + Math.random() * 3.0,
        actionAnim: 0.0,
        actionSwingTimer: 0.0,
        targetObstacle: null,
        targetAnimal: null,
        targetDrop: null,
        targetBoat: null,
        ownedBoat: null,
        ridingBoat: null,
        boatDriveTimer: 0,
        workCycles: 0,
        thinkTimer: 0.1 + (i % 6) * 0.15,
        agentPhase: Math.random() * Math.PI * 2,
        jumpY: 0.0,
        jumpVy: 0.0
      });
    }

    window.playerClonesState = clones;
    console.log("👥 สปอนตัวโคลนระบบชีวิตรอบบ้านสำเร็จ:", clones.length, "ตัว จากบ้านทั้งหมด:", numHouses, "หลัง");
  };

  window.respawnPlayerClonesNearHouses = function() {
    window.playerClonesState = null;
    window.initPlayerClonesIfNeeded(true);
  };

  window.respawnPlayerClonesNearPlayer = function() {
    window.respawnPlayerClonesNearHouses();
  };

  window.updatePlayerClones = function(dt) {
    if (typeof window.initPlayerClonesIfNeeded === "function") {
      window.initPlayerClonesIfNeeded();
    }
    if (!window.playerClonesState || window.playerClonesState.length === 0) return;

    ensureHouseChests();

    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;
    const heightScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
    const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
    const wLevel = (typeof waterLevel !== "undefined") ? waterLevel : 1.0;
    const minDryRadius = planetRadius + wLevel * (heightScale * 0.25) + 0.05;
    const dtClamped = Math.min(0.05, Math.max(0.001, dt || 0.016));
    const houses = (typeof window !== "undefined" && window.placedHouses) ? window.placedHouses : [];

    for (let i = 0; i < window.playerClonesState.length; i++) {
      const cState = window.playerClonesState[i];

      // Normalize speed if clone was initialized with legacy high speed (> 0.35)
      if (!cState.speedInitialized || cState.moveSpeed > 0.35) {
        cState.moveSpeed = 0.24 + (i % 3) * 0.03;
        cState.speedInitialized = true;
      }

      // Update action swing animation timer
      if (cState.actionAnim > 0) {
        cState.actionAnim = Math.max(0, cState.actionAnim - dtClamped * 2.5);
      }

      // Simple jump physics along surface normal
      if (cState.jumpY > 0 || cState.jumpVy !== 0) {
        const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
        cState.jumpVy = (cState.jumpVy || 0) - 9.8 * charScale * dtClamped;
        cState.jumpY = Math.max(0, (cState.jumpY || 0) + cState.jumpVy * dtClamped);
        if (cState.jumpY <= 0) { cState.jumpY = 0; cState.jumpVy = 0; }
      }

      // Check Crafting automatically whenever clone has farmed materials
      tryCloneCrafting(cState, planetRadius);

      // =========================================================================
      // SWIMMING & WATER PHYSICS (EXACT SAME SHARED CODE AS PLAYER)
      // =========================================================================
      const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
      const cSinT = Math.sin(cState.theta);
      const cCosT = Math.cos(cState.theta);
      const cSinP = Math.sin(cState.phi);
      const cCosP = Math.cos(cState.phi);
      const cNx = cSinT * cCosP;
      const cNy = cCosT;
      const cNz = cSinT * cSinP;

      const cHeight = (typeof getVisualHeightOnSphere === "function")
        ? getVisualHeightOnSphere(cState.theta, cState.phi, seed)
        : 0;
      const terrainRad = planetRadius + cHeight * heightScale;
      const cWaterRad = planetRadius + (typeof waterLevel !== "undefined" ? waterLevel : 0.0) * 0.15;
      const cFeetRad = terrainRad;
      const wRadiusLocal = (typeof getWaterRadiusAt === "function")
        ? getWaterRadiusAt(cNx * cFeetRad, cNy * cFeetRad, cNz * cFeetRad)
        : cWaterRad;

      const isRiding = !!(cState.ridingBoat && cState.ridingBoat.active);
      const isMovingInput = !cState.isIdle ? 1.0 : 0.0;

      if (typeof window.updateEntitySwimmingAndDiving === "function") {
        window.updateEntitySwimmingAndDiving(
          cState,
          cFeetRad,
          wRadiusLocal,
          cWaterRad,
          terrainRad,
          charScale,
          0.0,
          isMovingInput,
          isRiding,
          dtClamped
        );
      }

      // If swimming, cancel airborne jump velocity
      if ((cState.currentSwimFactor || 0) > 0.1) {
        cState.jumpY = 0;
        cState.jumpVy = 0;
        if (cState.currentActivity !== "DRIVE_BOAT") {
          cState.faceText = cState.isIdle ? "(~˘▾˘)~" : "(o˘◡˘o)";
        }
      }

      // =========================================================================
      // STATE 1: DRIVING / RIDING A BOAT (PLAIN OR WHEELED)
      // =========================================================================
      if (cState.currentActivity === "DRIVE_BOAT" && cState.ridingBoat && cState.ridingBoat.active) {
        const boat = cState.ridingBoat;

        // Shared Vehicle Driveability Check (Identical to player rules)
        const canDrive = isBoatUsableByClone(boat, planetRadius, cState);
        if (!canDrive) {
          cState.ridingBoat = null;
          cState.currentActivity = "WANDER";
          cState.timer = 1.0;
          cState.thinkTimer = 0.0;
          cState.faceText = cState.baseFaceText || "(^_-)";
          continue;
        }

        cState.boatDriveTimer -= dtClamped;

        // Clone drives the boat forward smoothly
        const boatSpeed = boat.hasEngine ? 1.4 : 0.95;
        cState.walkBlend = 0.0;
        cState.isIdle = false;
        cState.faceText = "(¬‿¬)"; // Cheeky grin while joyriding!

        const sinT = Math.max(0.05, Math.sin(cState.theta));
        const step = boatSpeed * dtClamped;

        // Cruise around and turn smoothly
        cState.heading += Math.sin(cState.animPhase * 0.5) * 0.4 * dtClamped;
        cState.theta = Math.max(0.08, Math.min(Math.PI - 0.08, cState.theta - (Math.cos(cState.heading) * step) / planetRadius));
        cState.phi += (Math.sin(cState.heading) * step) / (planetRadius * sinT);

        // Update boat transformation directly on water/terrain surface (same as player)
        const nSinT = Math.sin(cState.theta);
        const nCosT = Math.cos(cState.theta);
        const nSinP = Math.sin(cState.phi);
        const nCosP = Math.cos(cState.phi);

        const bNx = nSinT * nCosP;
        const bNy = nCosT;
        const bNz = nSinT * nSinP;

        const bHeight = (typeof getVisualHeightOnSphere === "function")
          ? getVisualHeightOnSphere(cState.theta, cState.phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0))
          : 0;
        const hs = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
        const minWaterRad = (typeof minDryRadius !== "undefined") ? minDryRadius : planetRadius;
        const isWheeled = !!(boat.hasWheel || boat.hasWheels);
        const bRadius = isWheeled ? (planetRadius + bHeight * hs) : Math.max(minWaterRad, planetRadius + bHeight * hs);

        const bEast = [-nSinP, 0, nCosP];
        const bNorth = [-nCosT * nCosP, nSinT, -nCosT * nSinP];
        const cosH = Math.cos(cState.heading);
        const sinH = Math.sin(cState.heading);

        boat.position = [bRadius * bNx, bRadius * bNy, bRadius * bNz];
        boat.normal = [bNx, bNy, bNz];
        boat.R = [
          bEast[0] * cosH - bNorth[0] * sinH,
          bEast[1] * cosH - bNorth[1] * sinH,
          bEast[2] * cosH - bNorth[2] * sinH
        ];
        boat.F = [
          bNorth[0] * cosH + bEast[0] * sinH,
          bNorth[1] * cosH + bEast[1] * sinH,
          bNorth[2] * cosH + bEast[2] * sinH
        ];
        boat.isDynamic = true;

        if (boat.hasWheel || boat.hasWheels) {
          boat.spinAngle = (boat.spinAngle || 0) + (step / 0.16);
        }
        if (typeof window !== "undefined") {
          window.pendingDynamicCollectibleRefresh = true;
        }

        // Time to park at home coast and disembark?
        if (cState.boatDriveTimer <= 0) {
          cState.ridingBoat = null;
          cState.currentActivity = "WANDER";
          cState.timer = 1.0;
          cState.thinkTimer = 0.0;
          cState.faceText = cState.baseFaceText || "(^_-)";
        }
        continue;
      }

      // =========================================================================
      // STATE 2: STEALING A BOAT
      // =========================================================================
      if (cState.currentActivity === "STEAL_BOAT") {
        const targetBoat = cState.targetBoat;
        if (!isBoatUsableByClone(targetBoat, planetRadius, cState)) {
          cState.targetBoat = null;
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        } else {
          setCloneTargetPos(cState, targetBoat.position[0], targetBoat.position[1], targetBoat.position[2], planetRadius);
          cState.faceText = "(¬‿¬)";
          cState.equippedTool = null;

          const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
          const sinT = Math.max(0.05, Math.sin(cState.theta));
          let dPhi = cState.targetPhi - cState.phi;
          while (dPhi > Math.PI) dPhi -= Math.PI * 2;
          while (dPhi < -Math.PI) dPhi += Math.PI * 2;
          const dEast = dPhi * (planetRadius * sinT);
          const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

          if (distToTarget <= 0.7) {
            // Successfully board and steal the boat!
            if (isBoatUsableByClone(targetBoat, planetRadius, cState)) {
              cState.ridingBoat = targetBoat;
              cState.currentActivity = "DRIVE_BOAT";
              cState.boatDriveTimer = 16.0 + Math.random() * 8.0;
            }
            cState.targetBoat = null;
            continue;
          }
        }
      }

      // =========================================================================
      // STATE 3: CHOPPING TREES (WOOD GATHERING)
      // =========================================================================
      if (cState.currentActivity === "CHOP_WOOD") {
        const tree = cState.targetObstacle;
        const natureObs = (typeof natureObstacles !== "undefined") ? natureObstacles : (window.natureObstacles || []);
        const isValidTree = tree && natureObs.includes(tree) && (typeof window.checkToolTargetValid !== "function" || window.checkToolTargetValid("AXE", tree.type));
        if (!isValidTree) {
          cState.targetObstacle = null;
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        } else {
          setCloneTargetPos(cState, tree.position[0], tree.position[1], tree.position[2], planetRadius);
          cState.equippedTool = "AXE";
          cState.faceText = "(•̀o•́)";

          const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
          const sinT = Math.max(0.05, Math.sin(cState.theta));
          let dPhi = cState.targetPhi - cState.phi;
          while (dPhi > Math.PI) dPhi -= Math.PI * 2;
          while (dPhi < -Math.PI) dPhi += Math.PI * 2;
          const dEast = dPhi * (planetRadius * sinT);
          const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

          if (distToTarget <= 0.75) {
            // At tree: chop repeatedly
            cState.walkBlend = 0.0;
            cState.actionAnim = 0.6;
            cState.actionSwingTimer = (cState.actionSwingTimer || 0) + dtClamped;

            if (cState.actionSwingTimer >= 0.75) {
              cState.actionSwingTimer = 0.0;
              tree.hits = (tree.hits || 0) + 1;
              if (typeof playChopSound === "function") playChopSound(tree.position);

              if (tree.hits >= 3) {
                // Tree felled! Clone acquires logs and branches
                addCloneItem(cState, "LOG", "🪵", 2);
                addCloneItem(cState, "BRANCH", "🌿", 2 + Math.floor(Math.random() * 2));

                const hitIdx = natureObs.indexOf(tree);
                if (hitIdx !== -1) natureObs.splice(hitIdx, 1);

                if (tree.meshStart !== undefined && tree.meshEnd !== undefined) {
                  const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;
                  const vBuf = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : window.natureVertexBuffer;
                  if (rawVerts && vBuf && typeof gl !== "undefined" && gl) {
                    const startF = tree.meshStart * 3;
                    const endF = tree.meshEnd * 3;
                    for (let j = startF; j < endF; j++) rawVerts[j] = 0;
                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
                    gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(rawVerts.slice(startF, endF)));
                  }
                }

                cState.faceText = "(^o^)";
                cState.targetObstacle = null;
                cState.workCycles = (cState.workCycles || 0) + 1;
                tryCloneCrafting(cState, planetRadius);
                executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
              }
            }
          }
        }
      }

      // =========================================================================
      // STATE 4: MINING ORE & ROCKS
      // =========================================================================
      if (cState.currentActivity === "MINE_ORE") {
        const ore = cState.targetObstacle;
        const natureObs = (typeof natureObstacles !== "undefined") ? natureObstacles : (window.natureObstacles || []);
        const isValidOre = ore && natureObs.includes(ore) && (typeof window.checkToolTargetValid !== "function" || window.checkToolTargetValid("PICKAXE", ore.type));
        if (!isValidOre) {
          cState.targetObstacle = null;
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        } else {
          setCloneTargetPos(cState, ore.position[0], ore.position[1], ore.position[2], planetRadius);
          cState.equippedTool = "PICKAXE";
          cState.faceText = "(•̀ᴗ•́)";

          const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
          const sinT = Math.max(0.05, Math.sin(cState.theta));
          let dPhi = cState.targetPhi - cState.phi;
          while (dPhi > Math.PI) dPhi -= Math.PI * 2;
          while (dPhi < -Math.PI) dPhi += Math.PI * 2;
          const dEast = dPhi * (planetRadius * sinT);
          const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

          if (distToTarget <= 0.75) {
            // At ore/rock: mine repeatedly
            cState.walkBlend = 0.0;
            cState.actionAnim = 0.6;
            cState.actionSwingTimer = (cState.actionSwingTimer || 0) + dtClamped;

            if (cState.actionSwingTimer >= 0.75) {
              cState.actionSwingTimer = 0.0;
              ore.hits = (ore.hits || 0) + 1;
              if (typeof playRockHitSound === "function") playRockHitSound(ore.position);
              else if (typeof playPlaceSound === "function") playPlaceSound(ore.position);

              if (ore.hits >= 3) {
                // Rock/ore broken! Drops gathered
                if (ore.type === "iron_ore") {
                  addCloneItem(cState, "IRON_ORE", "🟥", 2 + Math.floor(Math.random() * 2));
                  addCloneItem(cState, "ROCK", "🪨", 1);
                } else if (ore.type === "gold_ore") {
                  addCloneItem(cState, "GOLD_ORE", "🪙", 2);
                  addCloneItem(cState, "ROCK", "🪨", 1);
                } else if (ore.type === "glow_ore") {
                  addCloneItem(cState, "GLOW_ORE", "✨", 2);
                  addCloneItem(cState, "ROCK", "🪨", 1);
                } else {
                  addCloneItem(cState, "ROCK", "🪨", 2);
                }

                const hitIdx = natureObs.indexOf(ore);
                if (hitIdx !== -1) natureObs.splice(hitIdx, 1);

                if (ore.meshStart !== undefined && ore.meshEnd !== undefined) {
                  const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;
                  const vBuf = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : window.natureVertexBuffer;
                  if (rawVerts && vBuf && typeof gl !== "undefined" && gl) {
                    const startF = ore.meshStart * 3;
                    const endF = ore.meshEnd * 3;
                    for (let j = startF; j < endF; j++) rawVerts[j] = 0;
                    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
                    gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(rawVerts.slice(startF, endF)));
                  }
                }

                cState.faceText = "(★‿★)";
                cState.targetObstacle = null;
                cState.workCycles = (cState.workCycles || 0) + 1;
                tryCloneCrafting(cState, planetRadius);
                executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
              }
            }
          }
        }
      }

      // =========================================================================
      // STATE 5: HUNTING ANIMALS (ISOPOD, MEGANEURA, AMPHIBIANS)
      // =========================================================================
      if (cState.currentActivity === "HUNT_ANIMAL") {
        const animal = cState.targetAnimal;
        if (!animal || animal.ragdollEnabled || (animal.hp !== undefined && animal.hp <= 0)) {
          cState.targetAnimal = null;
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        } else {
          let aPos = animal.position;
          if (animal.ragdollPos && animal.ragdollInitialized) aPos = animal.ragdollPos;
          if (aPos) {
            setCloneTargetPos(cState, aPos[0], aPos[1], aPos[2], planetRadius);
          }
          
          const hasCannon = getCloneItemCount(cState, "WOODEN_ARM_CANNON") > 0 || getCloneItemCount(cState, "ARM_CANNON") > 0;
          const arrowCount = getCloneItemCount(cState, "ARROW") + getCloneItemCount(cState, "IRON_BULLET");
          if (hasCannon && arrowCount > 0) {
            cState.equippedTool = "WOODEN_ARM_CANNON";
            cState.faceText = "(🪵🦾‿🦾)";
          } else {
            cState.equippedTool = "AXE";
            cState.faceText = "(•̀ᴗ•́)";
          }

          const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
          const sinT = Math.max(0.05, Math.sin(cState.theta));
          let dPhi = cState.targetPhi - cState.phi;
          while (dPhi > Math.PI) dPhi -= Math.PI * 2;
          while (dPhi < -Math.PI) dPhi += Math.PI * 2;
          const dEast = dPhi * (planetRadius * sinT);
          const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

          // Ranged cannon attack from distance (<= 3.2m) or melee attack (<= 0.8m)
          if (cState.equippedTool === "WOODEN_ARM_CANNON" && distToTarget <= 3.2 && arrowCount > 0) {
            cState.actionAnim = 0.6;
            cState.actionSwingTimer = (cState.actionSwingTimer || 0) + dtClamped;

            if (cState.actionSwingTimer >= 0.75) {
              cState.actionSwingTimer = 0.0;
              if (getCloneItemCount(cState, "ARROW") > 0) {
                removeCloneItem(cState, "ARROW", 1);
              } else {
                removeCloneItem(cState, "IRON_BULLET", 1);
              }
              if (typeof playPlaceSound === "function") playPlaceSound();

              // Spawn arrow projectile from clone towards animal
              const cSinT = Math.sin(cState.theta), cCosT = Math.cos(cState.theta);
              const cSinP = Math.sin(cState.phi), cCosP = Math.cos(cState.phi);
              const cPos = [planetRadius * cSinT * cCosP, planetRadius * cCosT, planetRadius * cSinT * cSinP];
              if (aPos) {
                const aDir = [aPos[0] - cPos[0], aPos[1] - cPos[1], aPos[2] - cPos[2]];
                const aDist = Math.hypot(aDir[0], aDir[1], aDir[2]) || 1;
                aDir[0] /= aDist; aDir[1] /= aDist; aDir[2] /= aDist;
                const spd = 1.15 * (typeof playerScale !== "undefined" ? playerScale : 0.1);
                const colList = (typeof collectibles !== "undefined" && Array.isArray(collectibles)) ? collectibles : [];
                colList.push({
                  type: "arrow",
                  position: [cPos[0] + aDir[0] * 0.1, cPos[1] + aDir[1] * 0.1, cPos[2] + aDir[2] * 0.1],
                  vel: [aDir[0] * spd, aDir[1] * spd, aDir[2] * spd],
                  F: aDir,
                  R: [1, 0, 0],
                  normal: [0, 1, 0],
                  color: [0.62, 0.44, 0.26],
                  size: 0.1,
                  active: true,
                  isDynamic: true,
                  sourceWeapon: "WOODEN_ARM_CANNON",
                  isCannonShot: true,
                  animPhaseActive: true,
                  animElapsed: 0,
                  animMaxTime: 0.25,
                  animOrigin: [cPos[0] + aDir[0] * 0.1, cPos[1] + aDir[1] * 0.1, cPos[2] + aDir[2] * 0.1],
                  animDir: aDir,
                  animSpeed: spd,
                  ignorePlayer: true
                });
                if (typeof window !== "undefined") window.pendingDynamicCollectibleRefresh = true;
              }

              const dmg = 1;
              if (animal.hp === undefined) {
                const regHp = (window.NpcRegistry && window.NpcRegistry[animal.type]) ? window.NpcRegistry[animal.type].maxHp : 2;
                animal.hp = regHp;
              }
              animal.hp -= dmg;
              if (animal.hp <= 0) {
                animal.hp = 0;
                animal.ragdollEnabled = true;
                if (animal.type === "isopod") addCloneItem(cState, "ISOPOD", "🦐", 1);
                else if (animal.type === "meganeura") addCloneItem(cState, "MEGANEURA", "🦟", 1);
                else addCloneItem(cState, "ISOPOD", "🦐", 1);
                cState.faceText = "(^o^)";
                cState.targetAnimal = null;
                cState.workCycles = (cState.workCycles || 0) + 1;
                executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
              }
            }
          } else if (distToTarget <= 0.8) {
            // Attack animal!
            cState.actionAnim = 0.6;
            cState.actionSwingTimer = (cState.actionSwingTimer || 0) + dtClamped;

            if (cState.actionSwingTimer >= 0.65) {
              cState.actionSwingTimer = 0.0;
              const dmg = (cState.equippedTool === "AXE") ? 2 : 1;
              if (animal.hp === undefined) {
                const regHp = (window.NpcRegistry && window.NpcRegistry[animal.type]) ? window.NpcRegistry[animal.type].maxHp : 2;
                animal.hp = regHp;
              }
              animal.hp -= dmg;
              if (typeof playChopSound === "function") playChopSound();

              if (animal.hp <= 0) {
                animal.hp = 0;
                animal.ragdollEnabled = true;

                if (animal.type === "isopod") {
                  addCloneItem(cState, "ISOPOD", "🦐", 1);
                } else if (animal.type === "meganeura") {
                  addCloneItem(cState, "MEGANEURA", "🦟", 1);
                } else {
                  addCloneItem(cState, "ISOPOD", "🦐", 1);
                }

                cState.faceText = "(^o^)";
                cState.targetAnimal = null;
                cState.workCycles = (cState.workCycles || 0) + 1;
                executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
              }
            }
          }
        }
      }

      // =========================================================================
      // STATE 6: PICKING UP GROUND DROPS
      // =========================================================================
      if (cState.currentActivity === "PICKUP_DROPS") {
        const drop = cState.targetDrop;
        if (!drop || !drop.active || drop.isPreview) {
          cState.targetDrop = null;
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        } else {
          setCloneTargetPos(cState, drop.position[0], drop.position[1], drop.position[2], planetRadius);
          cState.faceText = "(ʘ‿ʘ)";

          const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
          const sinT = Math.max(0.05, Math.sin(cState.theta));
          let dPhi = cState.targetPhi - cState.phi;
          while (dPhi > Math.PI) dPhi -= Math.PI * 2;
          while (dPhi < -Math.PI) dPhi += Math.PI * 2;
          const dEast = dPhi * (planetRadius * sinT);
          const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

          if (distToTarget <= 0.6) {
            drop.active = false;
            const dropType = (drop.type || "").toUpperCase();
            addCloneItem(cState, dropType, getResourceIcon(dropType), 1);
            if (typeof window !== "undefined") {
              window.pendingDynamicCollectibleRefresh = true;
            }
            cState.targetDrop = null;
            executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
          }
        }
      }

      // =========================================================================
      // STATE 7: STORING FARMED LOOT INTO HOUSE CHEST
      // =========================================================================
      if (cState.currentActivity === "DEPOSIT_CHEST") {
        const house = houses[cState.houseIndex];
        const chest = house ? house.chest : null;
        if (!chest || !chest.position) {
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        } else {
          setCloneTargetPos(cState, chest.position[0], chest.position[1], chest.position[2], planetRadius);
          cState.equippedTool = null;
          cState.faceText = "(^人^)";

          const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
          const sinT = Math.max(0.05, Math.sin(cState.theta));
          let dPhi = cState.targetPhi - cState.phi;
          while (dPhi > Math.PI) dPhi -= Math.PI * 2;
          while (dPhi < -Math.PI) dPhi += Math.PI * 2;
          const dEast = dPhi * (planetRadius * sinT);
          const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

          if (distToTarget <= 0.65) {
            depositItemsIntoHouseChest(cState, houses);
            cState.workCycles = 0;
            cState.currentActivity = "IDLE";
            cState.timer = 2.5;
            cState.isIdle = true;
          }
        }
      }

      // =========================================================================
      // STATE 8: WANDERING / DECIDING NEXT LIFE ACTION ("เห็นค่อยคิด ค่อยทำ")
      // =========================================================================
      cState.timer -= dtClamped;
      if (cState.thinkTimer !== undefined) {
        cState.thinkTimer -= dtClamped;
      }

      if (cState.isIdle) {
        cState.walkBlend = Math.max(0.0, cState.walkBlend - dtClamped * 4.0);
        if (cState.timer <= 0 || cState.thinkTimer <= 0) {
          executeCloneActionOnSight(cState, planetRadius, houses, seed, heightScale, minDryRadius);
        }
      } else {
        // Walking towards current waypoint / target
        cState.walkBlend = Math.min(1.0, cState.walkBlend + dtClamped * 4.0);
        cState.animPhase += dtClamped * 5.0;

        const dNorth = -(cState.targetTheta - cState.theta) * planetRadius;
        const sinT = Math.max(0.05, Math.sin(cState.theta));
        let dPhi = cState.targetPhi - cState.phi;
        while (dPhi > Math.PI) dPhi -= Math.PI * 2;
        while (dPhi < -Math.PI) dPhi += Math.PI * 2;
        const dEast = dPhi * (planetRadius * sinT);
        const distToTarget = Math.sqrt(dNorth * dNorth + dEast * dEast);

        if (distToTarget > 0.04) {
          cState.heading = Math.atan2(dEast, dNorth);

          // เมื่อเดินติดขอบ (เช่น ขอบพื้นไม้ หรือเนินต่างระดับข้างหน้า) และจำเป็นต้องเดินไป -> กระโดดข้ามขอบ (ยกเว้นกำลังว่ายน้ำ)
          if ((cState.jumpY || 0) <= 0.001 && (cState.currentSwimFactor || 0) <= 0.1) {
            const probeDist = 0.20;
            const probeT = Math.max(0.08, Math.min(Math.PI - 0.08, cState.theta - (Math.cos(cState.heading) * probeDist) / planetRadius));
            const sinTprobe = Math.max(0.05, Math.sin(cState.theta));
            const probeP = cState.phi + (Math.sin(cState.heading) * probeDist) / (planetRadius * sinTprobe);
            const curH = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(cState.theta, cState.phi, seed) : 0;
            const aheadH = (typeof getVisualHeightOnSphere === "function") ? getVisualHeightOnSphere(probeT, probeP, seed) : 0;
            const diffH = (aheadH - curH) * heightScale;
            if (diffH > 0.035 && diffH < 0.35) {
              const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
              cState.jumpVy = 2.0 * charScale;
            }
          }

          const speedMultiplier = (cState.currentSwimFactor > 0.4) ? 0.65 : 1.0;
          const step = Math.min(cState.moveSpeed * speedMultiplier * dtClamped, distToTarget);
          cState.theta = Math.max(0.08, Math.min(Math.PI - 0.08, cState.theta - (Math.cos(cState.heading) * step) / planetRadius));
          cState.phi += (Math.sin(cState.heading) * step) / (planetRadius * sinT);
        }

        if (distToTarget <= 0.04 || cState.timer <= 0) {
          if (cState.currentActivity === "WANDER") {
            cState.isIdle = true;
            cState.timer = 1.0 + Math.random() * 2.0;
            cState.thinkTimer = cState.timer * 0.8;
          }
        }
      }
    }
  };

  window.renderPlayerClones = function(gl, opts) {
    if (!window.playerClonesState || window.playerClonesState.length === 0) return;
    
    const {
      viewMatrix,
      eyePos,
      charMVLoc,
      charModelMatrixLoc,
      charPosLoc,
      charNormLoc,
      charColorLoc,
      charLocalPosLoc,
      charFaceTexLoc,
      charUseFaceTexLoc,
      charIndicesLength: originalCharIndicesLength,
      supportUint32
    } = opts;

    const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;

    const minCameraDistToCloneSq = (0.04 * (charScale / 0.22)) * (0.04 * (charScale / 0.22));

    let currentIndicesLen = originalCharIndicesLength;
    let useCloneBuffers = false;

    if (window.cloneMeshBuffers && window.cloneMeshBuffers.vertexBuffer) {
      const cb = window.cloneMeshBuffers;
      useCloneBuffers = true;
      currentIndicesLen = cb.indicesLength;
      
      if (typeof charPosLoc !== "undefined" && charPosLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.vertexBuffer);
        gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charLocalPosLoc !== "undefined" && charLocalPosLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.localVertexBuffer);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charNormLoc !== "undefined" && charNormLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.normalBuffer);
        gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charColorLoc !== "undefined" && charColorLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cb.colorBuffer);
        gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cb.indexBuffer);
    } else {
      if (charLocalPosLoc !== -1 && typeof charLocalVertexBuffer !== "undefined" && charLocalVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.enableVertexAttribArray(charLocalPosLoc);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
    }

    if (charUseFaceTexLoc) {
      // Clones use the classic model, so disable GLB texture (0.0)
      gl.uniform1f(charUseFaceTexLoc, 0.0);
    }
    const charHasMainTexLoc = gl.getUniformLocation(charProgram, "uHasMainTex");
    if (charHasMainTexLoc) {
      gl.uniform1f(charHasMainTexLoc, 0.0);
    }
    if (charFaceTexLoc) {
      gl.uniform1i(charFaceTexLoc, 3);
    }

    const mulMat = (typeof multiplyMatrices === "function") ? multiplyMatrices : function(a, b) {
      const r = new Array(16);
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          r[col * 4 + row] =
            a[0 * 4 + row] * b[col * 4 + 0] +
            a[1 * 4 + row] * b[col * 4 + 1] +
            a[2 * 4 + row] * b[col * 4 + 2] +
            a[3 * 4 + row] * b[col * 4 + 3];
        }
      }
      return r;
    };

    for (let i = 0; i < window.playerClonesState.length; i++) {
      const cState = window.playerClonesState[i];
      const { cPos, cR, cF, cN } = getCloneVectors(cState, charScale, planetRadius);

      const actionBob = (cState.actionAnim && cState.actionAnim > 0)
        ? Math.sin(cState.actionAnim * Math.PI * 6) * 0.015 * charScale
        : 0;
      const walkBob = Math.sin(cState.animPhase) * 0.010 * cState.walkBlend * charScale;
      const idleBob = Math.sin((cState.timer || 0) * 2.5) * 0.003 * (1.0 - cState.walkBlend) * charScale;
      const jumpOffset = (cState.jumpY || 0);
      const finalPos = [
        cPos[0] + (walkBob + idleBob + actionBob + jumpOffset) * cN[0],
        cPos[1] + (walkBob + idleBob + actionBob + jumpOffset) * cN[1],
        cPos[2] + (walkBob + idleBob + actionBob + jumpOffset) * cN[2]
      ];

      if (eyePos) {
        const dx = finalPos[0] - eyePos[0];
        const dy = finalPos[1] - eyePos[1];
        const dz = finalPos[2] - eyePos[2];
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < minCameraDistToCloneSq) {
          continue; 
        }
      }

      f32_cloneModel[0] = cR[0] * charScale; f32_cloneModel[1] = cR[1] * charScale; f32_cloneModel[2] = cR[2] * charScale; f32_cloneModel[3] = 0;
      f32_cloneModel[4] = cN[0] * charScale; f32_cloneModel[5] = cN[1] * charScale; f32_cloneModel[6] = cN[2] * charScale; f32_cloneModel[7] = 0;
      f32_cloneModel[8] = cF[0] * charScale; f32_cloneModel[9] = cF[1] * charScale; f32_cloneModel[10] = cF[2] * charScale; f32_cloneModel[11] = 0;
      f32_cloneModel[12] = finalPos[0]; f32_cloneModel[13] = finalPos[1]; f32_cloneModel[14] = finalPos[2]; f32_cloneModel[15] = 1;

      const cloneMV = mulMat(viewMatrix, f32_cloneModel);
      for (let mi = 0; mi < 16; mi++) f32_cloneMV[mi] = cloneMV[mi];

      gl.uniformMatrix4fv(charMVLoc, false, f32_cloneMV);
      if (charModelMatrixLoc) {
        gl.uniformMatrix4fv(charModelMatrixLoc, false, f32_cloneModel);
      }

      if (charFaceTexLoc) {
        gl.activeTexture(gl.TEXTURE3);
        const faceTex = getCloneFaceTexture(gl, cState.faceText || "(^_^)");
        gl.bindTexture(gl.TEXTURE_2D, faceTex);
      }

      if (supportUint32 && currentIndicesLen > 65535) {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_INT, 0);
      } else {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_SHORT, 0);
      }
    }

    if (charUseFaceTexLoc) {
      gl.uniform1f(charUseFaceTexLoc, 0.0);
    }
    gl.activeTexture(gl.TEXTURE0);

    if (useCloneBuffers) {
      if (typeof charPosLoc !== "undefined" && charPosLoc !== -1 && typeof charVertexBuffer !== "undefined" && charVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
        gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charLocalPosLoc !== "undefined" && charLocalPosLoc !== -1 && typeof charLocalVertexBuffer !== "undefined" && charLocalVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charNormLoc !== "undefined" && charNormLoc !== -1 && typeof charNormalBuffer !== "undefined" && charNormalBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
        gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charColorLoc !== "undefined" && charColorLoc !== -1 && typeof charColorBuffer !== "undefined" && charColorBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
        gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charIndexBuffer !== "undefined" && charIndexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
      }
    } else {
      if (charLocalPosLoc !== -1 && typeof charLocalVertexBuffer !== "undefined" && charLocalVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
        gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
    }
  };

  window.renderPlayerClonesShadow = function(gl, depthModelLoc, charIndicesLengthArg, supportUint32, depthPosLoc) {
    if (!window.playerClonesState || window.playerClonesState.length === 0) return;
    const charScale = (typeof playerScale !== "undefined") ? playerScale : 0.1;
    const planetRadius = (typeof RADIUS !== "undefined") ? RADIUS : 8.0;
    
    let currentIndicesLen = charIndicesLengthArg;
    let useCloneBuffers = false;
    
    if (window.cloneMeshBuffers && window.cloneMeshBuffers.vertexBuffer) {
      useCloneBuffers = true;
      currentIndicesLen = window.cloneMeshBuffers.indicesLength;
      
      if (typeof depthPosLoc !== "undefined" && depthPosLoc !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, window.cloneMeshBuffers.vertexBuffer);
        gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, window.cloneMeshBuffers.indexBuffer);
    }

    for (let i = 0; i < window.playerClonesState.length; i++) {
      const cState = window.playerClonesState[i];
      const { cPos, cR, cF, cN } = getCloneVectors(cState, charScale, planetRadius);

      const actionBob = (cState.actionAnim && cState.actionAnim > 0)
        ? Math.sin(cState.actionAnim * Math.PI * 6) * 0.015 * charScale
        : 0;
      const walkBob = Math.sin(cState.animPhase) * 0.010 * cState.walkBlend * charScale;
      const idleBob = Math.sin((cState.timer || 0) * 2.5) * 0.003 * (1.0 - cState.walkBlend) * charScale;
      const jumpOffset = (cState.jumpY || 0);
      const finalPos = [
        cPos[0] + (walkBob + idleBob + actionBob + jumpOffset) * cN[0],
        cPos[1] + (walkBob + idleBob + actionBob + jumpOffset) * cN[1],
        cPos[2] + (walkBob + idleBob + actionBob + jumpOffset) * cN[2]
      ];

      f32_cloneModel[0] = cR[0] * charScale; f32_cloneModel[1] = cR[1] * charScale; f32_cloneModel[2] = cR[2] * charScale; f32_cloneModel[3] = 0;
      f32_cloneModel[4] = cN[0] * charScale; f32_cloneModel[5] = cN[1] * charScale; f32_cloneModel[6] = cN[2] * charScale; f32_cloneModel[7] = 0;
      f32_cloneModel[8] = cF[0] * charScale; f32_cloneModel[9] = cF[1] * charScale; f32_cloneModel[10] = cF[2] * charScale; f32_cloneModel[11] = 0;
      f32_cloneModel[12] = finalPos[0]; f32_cloneModel[13] = finalPos[1]; f32_cloneModel[14] = finalPos[2]; f32_cloneModel[15] = 1;

      gl.uniformMatrix4fv(depthModelLoc, false, f32_cloneModel);

      if (supportUint32 && currentIndicesLen > 65535) {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_INT, 0);
      } else {
        gl.drawElements(gl.TRIANGLES, currentIndicesLen, gl.UNSIGNED_SHORT, 0);
      }
    }
    
    if (useCloneBuffers) {
      if (typeof depthPosLoc !== "undefined" && depthPosLoc !== -1 && typeof charVertexBuffer !== "undefined" && charVertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
        gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (typeof charIndexBuffer !== "undefined" && charIndexBuffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
      }
    }
  };

  // Expose PlayerClones namespace object
  window.PlayerClones = {
    getVectors: getCloneVectors,
    getFaceTexture: getCloneFaceTexture,
    init: window.initPlayerClonesIfNeeded,
    respawn: window.respawnPlayerClonesNearHouses,
    respawnNearPlayer: window.respawnPlayerClonesNearHouses,
    update: window.updatePlayerClones,
    render: window.renderPlayerClones,
    renderShadow: window.renderPlayerClonesShadow,
    EMOJI_FACES: CLONE_EMOJI_FACES
  };
})();
