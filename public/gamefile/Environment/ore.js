(function (global) {
  function generateOres({
    seed,
    oreRand,
    tunnels3D,
    RADIUS,
    HEIGHT_SCALE,
    getHeightOnSphere,
    snapToCaveWallOrAdjust,
    destroyedRocks,
    vertices,
    colors,
    indices,
    buildRockFormation,
    natureObstacles,
    COLLISION_LAYERS
  }, onProgress, checkYield) {
    return new Promise(async (resolve) => {
      const rRatio = Math.max(1.0, (RADIUS / 8.0));
      const numOres = Math.min(2400, Math.floor((350 + Math.floor(oreRand() * 150)) * Math.pow(rRatio, 1.3))); // rich distribution across planetary crust
      for (let k = 0; k < numOres; k++) {
        if (k % 50 === 0 && checkYield) {
          await checkYield();
        }

        // Determine depth category and factor
        let depthCategory; // 'shallow', 'mid', 'deep'
        const randDepthType = oreRand();
        let depthFactor;
        if (randDepthType < 0.3) {
          depthCategory = 'shallow';
          depthFactor = 0.8 + oreRand() * 0.18; // 80% to 98% of surfRad (near surface)
        } else if (randDepthType < 0.7) {
          depthCategory = 'mid';
          depthFactor = 0.4 + oreRand() * 0.4; // 40% to 80% of surfRad (mantle)
        } else {
          depthCategory = 'deep';
          depthFactor = 0.05 + oreRand() * 0.35; // 5% to 40% of surfRad (all the way to the core!)
        }

        // Choose ore type based on depth: deeper = more gold and glowing ores!
        let oreType;
        const typeRoll = oreRand();
        if (depthCategory === 'deep') {
          if (typeRoll < 0.40) oreType = "gold_ore"; // 40% gold in core
          else if (typeRoll < 0.75) oreType = "glow_ore"; // 35% glowing ore in core
          else oreType = "iron_ore"; // 25% iron in core
        } else if (depthCategory === 'mid') {
          if (typeRoll < 0.30) oreType = "gold_ore"; // 30% gold in mantle/caves
          else if (typeRoll < 0.60) oreType = "glow_ore"; // 30% glowing ore in mantle/caves
          else oreType = "iron_ore"; // 40% iron in mantle/caves
        } else {
          if (typeRoll < 0.15) oreType = "gold_ore"; // 15% gold in shallow crust
          else if (typeRoll < 0.35) oreType = "glow_ore"; // 20% glowing ore in shallow crust
          else oreType = "iron_ore"; // 65% iron in shallow crust
        }
        let oreColor;
        if (oreType === "iron_ore") {
          oreColor = [0.45, 0.22, 0.18];
        } else if (oreType === "gold_ore") {
          oreColor = [0.85, 0.68, 0.12];
        } else {
          oreColor = [0.22, 0.95, 0.88]; // Luminous cyan-emerald glowing crystal
        }

        // Position variables
        let ox = 0, oy = 0, oz = 0;
        let onx = 0, ony = 1, onz = 0;
        let foundPosition = false;
        let isInCave = false;

        // Attempt 1: Align with a cave tunnel sphere to ensure it is beautifully visible in caves
        // Cave systems are mostly shallow/mid, so we only align shallow/mid ores sometimes
        if (tunnels3D && tunnels3D.length > 0 && depthCategory !== 'deep' && oreRand() > 0.2) {
          const tIdx = Math.floor(oreRand() * tunnels3D.length);
          const t = tunnels3D[tIdx];
          
          // Spawn on the surface/bottom of the tunnel sphere
          const u = oreRand();
          const v = oreRand();
          const tTheta = Math.acos(2 * u - 1);
          const tPhi = 2 * Math.PI * v;
          let sx = Math.sin(tTheta) * Math.cos(tPhi);
          let sy = Math.cos(tTheta);
          let sz = Math.sin(tTheta) * Math.sin(tPhi);

          // Bias direction downwards/sideways relative to gravity vector (pointing away from the sky)
          const tLen = Math.sqrt(t.x*t.x + t.y*t.y + t.z*t.z) || 1;
          const ux = t.x / tLen;
          const uy = t.y / tLen;
          const uz = t.z / tLen;

          const dotVal = sx * ux + sy * uy + sz * uz;
          if (dotVal > 0.1) {
            // Flip across the plane of tangent to bias towards floor/side-walls
            sx -= 1.8 * dotVal * ux;
            sy -= 1.8 * dotVal * uy;
            sz -= 1.8 * dotVal * uz;
            const lenS = Math.sqrt(sx*sx + sy*sy + sz*sz) || 1;
            sx /= lenS;
            sy /= lenS;
            sz /= lenS;
          }

          // Place it exactly on the tunnel sphere boundary (t.r)
          const offsetDist = t.r;
          const px = t.x + sx * offsetDist;
          const py = t.y + sy * offsetDist;
          const pz = t.z + sz * offsetDist;

          // Apply snapping and blending to align it perfectly on the rendered tunnel geometry
          const [snappedX, snappedY, snappedZ] = snapToCaveWallOrAdjust(px, py, pz, seed);
          ox = snappedX;
          oy = snappedY;
          oz = snappedZ;

          // Normal vector pointing away from planet center for standard rock axis calculations
          const lenO = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
          onx = ox / lenO;
          ony = oy / lenO;
          onz = oz / lenO;

          foundPosition = true;
          isInCave = true;
        }

        // Attempt 2: Fallback to a random subterranean position (any depth!)
        if (!foundPosition) {
          const u = oreRand();
          const v = oreRand();
          const tTheta = Math.acos(2 * u - 1);
          const tPhi = 2 * Math.PI * v;
          onx = Math.sin(tTheta) * Math.cos(tPhi);
          ony = Math.cos(tTheta);
          onz = Math.sin(tTheta) * Math.sin(tPhi);

          const h = getHeightOnSphere(tTheta, tPhi, seed);
          const surfRad = RADIUS + h * HEIGHT_SCALE;
          
          const targetRad = surfRad * depthFactor;
          const px = onx * targetRad;
          const py = ony * targetRad;
          const pz = onz * targetRad;

          // Check if this random subterranean position ended up inside a cave, and if so, snap it to the cave wall!
          const [snappedX, snappedY, snappedZ, snapped] = snapToCaveWallOrAdjust(px, py, pz, seed);
          if (snapped) {
            isInCave = true;
            ox = snappedX;
            oy = snappedY;
            oz = snappedZ;
            // Align normal to point out from planet center
            const lenO = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
            onx = ox / lenO;
            ony = oy / lenO;
            onz = oz / lenO;
          } else {
            ox = px;
            oy = py;
            oz = pz;
          }
        }

        // Check if this ore was already mined (using destroyedRocks array)
        const oreId = 990000 + k;
        if (destroyedRocks.includes(oreId)) continue;

        // Generate rock-like mesh formation for the ore (core gold and glowing ore can be slightly larger!)
        const oreRadius = (depthCategory === 'deep' && (oreType === "gold_ore" || oreType === "glow_ore"))
          ? 0.05 + oreRand() * 0.06 
          : 0.035 + oreRand() * 0.045;

        const startIdx = indices.length;
        buildRockFormation(
          [ox, oy, oz],
          oreRadius,
          oreColor,
          seed + k * 87,
          vertices,
          colors,
          indices
        );
        const endIdx = indices.length;

        // Add to nature obstacles so it can be targeted and mined with Pickaxe
        natureObstacles.push({
          id: oreId,
          type: oreType,
          layer: COLLISION_LAYERS.ROCK,
          normal: [onx, ony, onz],
          position: [ox, oy, oz],
          radius: oreRadius * 2.2, // exact coverage
          inCave: isInCave,
          meshStart: startIdx,
          meshEnd: endIdx
        });
      }
      resolve();
    });
  }

  global.OreSystem = { generateOres };
})(typeof window !== 'undefined' ? window : this);
