// === SEEDPLANET MODULE: JS/COLLECTIBLES.JS ===

var collectibles = window.collectibles || [];
window.collectibles = collectibles;

// Initialize ItemRegistry
window.ItemRegistry = window.ItemRegistry || window.ITEM_DEFINITIONS || {};

// Register "log" item 3D renderer
window.ItemRegistry["log"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    // Log (thicker branch)
    const lColor = item.color; // brown
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;
    const s = item.size;

    const thickness = s * 0.28;
    const length = s * 0.55;

    if (item.seed === undefined) item.seed = Math.random();
    const rotAngle = item.seed * Math.PI * 2;
    const cosA = Math.cos(rotAngle);
    const sinA = Math.sin(rotAngle);

    const dirX = r[0] * cosA + f[0] * sinA;
    const dirY = r[1] * cosA + f[1] * sinA;
    const dirZ = r[2] * cosA + f[2] * sinA;

    // Elevation equals radius so the log cylinder rests flush on the ground surface
    const elevation = thickness * 0.5;
    const center = [
      p[0] + n[0] * elevation,
      p[1] + n[1] * elevation,
      p[2] + n[2] * elevation,
    ];

    const pStart = [
      center[0] - dirX * length,
      center[1] - dirY * length,
      center[2] - dirZ * length,
    ];
    const pEnd = [
      center[0] + dirX * length,
      center[1] + dirY * length,
      center[2] + dirZ * length,
    ];

    buildTaperedSegment(
      pStart,
      pEnd,
      thickness,
      thickness * 0.9,
      6,
      lColor,
      vertices,
      colors,
      indices,
      true // add caps to make it solid
    );
  }
};

// Register "planet_core" item 3D renderer
window.ItemRegistry["planet_core"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    buildLowPolySphere(
      item.position,
      item.radius,
      item.segs,
      item.color,
      item.noiseStrength,
      item.seed,
      vertices,
      colors,
      indices
    );
  }
};

function buildCollectibles(count, seed) {
        const _origRandom = Math.random;

        // 1) Find original tree and rock positions deterministically so chopping trees doesn't shift collectible generation
        const originalTrees = [];
        const originalRocks = [];
        const minLandHeight = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15) + 0.02;
        const totalNature = typeof currentNatureCount !== 'undefined' ? currentNatureCount : 80;
        for (let i = 0; i < totalNature; i++) {
          Math.random = mulberry32(seed + i * 11235);
          const u = Math.random();
          const v = Math.random();
          const theta = Math.acos(2 * u - 1);
          const phi = 2 * Math.PI * v;
          const height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
          
          if (height >= minLandHeight) {
            const forestDensity = fbmNoise(
              Math.sin(theta) * Math.cos(phi) * 2.8,
              Math.cos(theta) * 2.8,
              Math.sin(theta) * Math.sin(phi) * 2.8,
              seed + 1234,
              3,
            );
            const nx = Math.sin(theta) * Math.cos(phi);
            const ny = Math.cos(theta);
            const nz = Math.sin(theta) * Math.sin(phi);
            const r = RADIUS + height * HEIGHT_SCALE;
            const wx = r * nx;
            const wy = r * ny;
            const wz = r * nz;

            if (isPositionInsideCave(wx, wy, wz, 0.25)) continue;
            
            if (forestDensity > -0.05) {
               originalTrees.push({ position: [wx, wy, wz], normal: [nx, ny, nz] });
            } else {
               originalRocks.push({ position: [wx, wy, wz], normal: [nx, ny, nz] });
            }
          }
        }

        collectibles = [];
        window.collectibles = collectibles;
        for (let i = 0; i < count; i++) {
          Math.random = mulberry32(seed + i * 24680); // Seed per iteration
          
          const type = Math.random() > 0.4 ? "branch" : "rock"; // More branches

          let theta, phi, height, r, nx, ny, nz, x, y, z;
          let rx, ry, rz, fx, fy, fz;

          if (type === "branch" && originalTrees.length > 0) {
            // Spawn near a deterministic random tree
            const treeIdx = Math.floor(Math.random() * originalTrees.length);
            const chosenTree = originalTrees[treeIdx];
            const tPos = chosenTree.position;
            const tNorm = chosenTree.normal;

            let txR, txY, txZ;
            if (Math.abs(tNorm[0]) < 0.9 && Math.abs(tNorm[2]) < 0.9) {
              txR = -tNorm[2]; txY = 0; txZ = tNorm[0];
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            txR /= lenTxR; txY /= lenTxR; txZ /= lenTxR;

            const txFx = tNorm[1] * txZ - tNorm[2] * txY;
            const txFy = tNorm[2] * txR - tNorm[0] * txZ;
            const txFz = tNorm[0] * txY - tNorm[1] * txR;

            const dist = 0.04 + Math.random() * 0.15; // Spread around tree
            const angle = Math.random() * Math.PI * 2;

            const px = tPos[0] + (Math.cos(angle) * txR + Math.sin(angle) * txFx) * dist;
            const py = tPos[1] + (Math.cos(angle) * txY + Math.sin(angle) * txFy) * dist;
            const pz = tPos[2] + (Math.cos(angle) * txZ + Math.sin(angle) * txFz) * dist;

            const pDist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            nx = px / pDist; ny = py / pDist; nz = pz / pDist;

            theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            phi = Math.atan2(nz, nx);
            height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            r = RADIUS + height * HEIGHT_SCALE;

            x = r * nx; y = r * ny; z = r * nz;
          } else if (type === "rock" && originalRocks.length > 0 && Math.random() > 0.3) {
            // Spawn near a deterministic random rock
            const rockIdx = Math.floor(Math.random() * originalRocks.length);
            const chosenRock = originalRocks[rockIdx];
            const tPos = chosenRock.position;
            const tNorm = chosenRock.normal;

            let txR, txY, txZ;
            if (Math.abs(tNorm[0]) < 0.9 && Math.abs(tNorm[2]) < 0.9) {
              txR = -tNorm[2]; txY = 0; txZ = tNorm[0];
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            txR /= lenTxR; txY /= lenTxR; txZ /= lenTxR;

            const txFx = tNorm[1] * txZ - tNorm[2] * txY;
            const txFy = tNorm[2] * txR - tNorm[0] * txZ;
            const txFz = tNorm[0] * txY - tNorm[1] * txR;

            const dist = 0.05 + Math.random() * 0.2; // Spread around rock
            const angle = Math.random() * Math.PI * 2;

            const px = tPos[0] + (Math.cos(angle) * txR + Math.sin(angle) * txFx) * dist;
            const py = tPos[1] + (Math.cos(angle) * txY + Math.sin(angle) * txFy) * dist;
            const pz = tPos[2] + (Math.cos(angle) * txZ + Math.sin(angle) * txFz) * dist;

            const pDist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            nx = px / pDist; ny = py / pDist; nz = pz / pDist;

            theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            phi = Math.atan2(nz, nx);
            height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            r = RADIUS + height * HEIGHT_SCALE;

            x = r * nx; y = r * ny; z = r * nz;
          } else {
            // Standard random spawn for rocks (or branches if no trees)
            theta = Math.random() * Math.PI;
            phi = Math.random() * Math.PI * 2;
            height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            
            if (type === "branch") {
              const minLandHeight = waterLevel * 0.15 + 0.05;
              if (height < minLandHeight) continue;
            }

            r = RADIUS + height * HEIGHT_SCALE;
            nx = Math.sin(theta) * Math.cos(phi);
            ny = Math.cos(theta);
            nz = Math.sin(theta) * Math.sin(phi);
            x = r * nx; y = r * ny; z = r * nz;
          }

          if (Math.abs(nx) < 0.9 && Math.abs(nz) < 0.9) {
            rx = -nz; ry = 0; rz = nx;
          } else {
            rx = 1; ry = 0; rz = 0;
          }
          const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
          rx /= lenR; ry /= lenR; rz /= lenR;

          fx = ry * nz - rz * ny;
          fy = rz * nx - rx * nz;
          fz = rx * ny - ry * nx;

          const color = type === "rock"
              ? [ 0.4 + Math.random() * 0.1, 0.4 + Math.random() * 0.1, 0.4 + Math.random() * 0.1 ]
              : [ 0.4 + Math.random() * 0.1, 0.25 + Math.random() * 0.05, 0.15 ];

          let overlapCave = false;
          if (tunnels3D) {
            for (let t of tunnels3D) {
              const dx = x - t.x;
              const dy = y - t.y;
              const dz = z - t.z;
              const checkR = t.r + 0.15;
              if (dx*dx + dy*dy + dz*dz < checkR * checkR) {
                overlapCave = true;
                break;
              }
            }
          }
          if (overlapCave) continue;

          collectibles.push({
            type: type,
            position: [x, y, z],
            normal: [nx, ny, nz],
            R: [rx, ry, rz],
            F: [fx, fy, fz],
            active: true,
            size: 0.015 + Math.random() * 0.02,
            seed: seed + i * 200,
            color: color,
          });
        }

        collectibles.push({
          type: "planet_core",
          position: [0, 0, 0],
          radius: 2.0,
          segs: 128,
          color: [0.0, 0.0, 0.0],
          noiseStrength: 0.0,
          seed: 123,
          active: true,
          isDynamic: false
        });
        const rBase = (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);
        const numStoneFloors = Math.min(18, Math.max(4, Math.round(3 + Math.sqrt(rBase))));
        const placedHouses = [];
        const natureObsList = (typeof natureObstacles !== "undefined" && natureObstacles) ? natureObstacles : (typeof window !== "undefined" && window.natureObstacles ? window.natureObstacles : []);

        for (let i = 0; i < numStoneFloors; i++) {
          let foundFlatSpot = false;
          let wx = 0, wy = 0, wz = 0;
          let nx = 0, ny = 0, nz = 0;
          let R = [1, 0, 0], F = [0, 0, 1];
          const wfSize = 0.25;
          const wfW = wfSize * 1.2;
          const gridX = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
          const gridY = 2 + Math.floor(Math.random() * 3); // 2, 3, 4
          const totalW = gridX * wfW;
          const totalD = gridY * wfW;
          const halfW = totalW / 2;
          const halfD = totalD / 2;
          const houseRadius = Math.sqrt(halfW * halfW + halfD * halfD);

          // Attempt up to 80 times to find a clear, flat location avoiding trees, rocks, holes/caves, and cliffs
          for (let attempt = 0; attempt < 80; attempt++) {
            const u = Math.random();
            const v = Math.random();
            const theta = Math.acos(2 * u - 1);
            const phi = 2 * Math.PI * v;
            const h = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
            const minLandHeight = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15) + 0.05;
            
            if (h < minLandHeight) continue;

            const candNx = Math.sin(theta) * Math.cos(phi);
            const candNy = Math.cos(theta);
            const candNz = Math.sin(theta) * Math.sin(phi);
            const r = RADIUS + h * HEIGHT_SCALE;
            const candWx = r * candNx;
            const candWy = r * candNy;
            const candWz = r * candNz;

            // Frame basis
            let txR, txY, txZ;
            if (Math.abs(candNy) < 0.9) {
              txR = -candNz; txY = 0; txZ = candNx;
            } else {
              txR = 1; txY = 0; txZ = 0;
            }
            const lenTxR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
            const candR = [txR / lenTxR, txY / lenTxR, txZ / lenTxR];
            const candF = [
              candNy * candR[2] - candNz * candR[1],
              candNz * candR[0] - candNx * candR[2],
              candNx * candR[1] - candNy * candR[0]
            ];
            const lenF = Math.sqrt(candF[0]*candF[0] + candF[1]*candF[1] + candF[2]*candF[2]) || 1;
            candF[0] /= lenF; candF[1] /= lenF; candF[2] /= lenF;

            // ============================================
            // 1. Check distance to already placed houses
            // ============================================
            let overlapsHouse = false;
            for (let ph = 0; ph < placedHouses.length; ph++) {
              const prevH = placedHouses[ph];
              const pdx = candWx - prevH.x;
              const pdy = candWy - prevH.y;
              const pdz = candWz - prevH.z;
              const minAllowedDist = houseRadius + prevH.radius + 1.2;
              if (pdx*pdx + pdy*pdy + pdz*pdz < minAllowedDist * minAllowedDist) {
                overlapsHouse = true;
                break;
              }
            }
            if (overlapsHouse) continue;

            // ============================================
            // 2. Check HOLES: Cave tunnels, openings, pits ("หลุม" / "หลุ่ม")
            // ============================================
            let overlapsHole = false;

            // A) Direct check against all 3D cave tunnel spheres
            const tunnels = (typeof window !== "undefined" && window.tunnels3D) ? window.tunnels3D : (typeof tunnels3D !== "undefined" ? tunnels3D : []);
            if (tunnels && tunnels.length > 0) {
              const maxCaveClearance = houseRadius + 0.65;
              for (let tIdx = 0; tIdx < tunnels.length; tIdx++) {
                const tun = tunnels[tIdx];
                const tdx = candWx - tun.x;
                const tdy = candWy - tun.y;
                const tdz = candWz - tun.z;
                const safeDist = tun.r + maxCaveClearance;
                if (tdx*tdx + tdy*tdy + tdz*tdz < safeDist * safeDist) {
                  overlapsHole = true;
                  break;
                }
              }
            }
            if (overlapsHole) continue;

            // B) Sample points across the house footprint checking isPositionInsideCave
            // Test 9 sample points: center, 4 corners, 4 edge midpoints
            const sampleOffsets = [
              [0, 0],
              [-halfW, -halfD],
              [halfW, -halfD],
              [-halfW, halfD],
              [halfW, halfD],
              [0, -halfD],
              [0, halfD],
              [-halfW, 0],
              [halfW, 0]
            ];

            if (typeof isPositionInsideCave === "function") {
              for (let sIdx = 0; sIdx < sampleOffsets.length; sIdx++) {
                const [sx, sy] = sampleOffsets[sIdx];
                const spX = candWx + candR[0]*sx + candF[0]*sy;
                const spY = candWy + candR[1]*sx + candF[1]*sy;
                const spZ = candWz + candR[2]*sx + candF[2]*sy;
                if (isPositionInsideCave(spX, spY, spZ, 0.45)) {
                  overlapsHole = true;
                  break;
                }
              }
            }
            if (overlapsHole) continue;

            // C) Check terrain surface for depressions, craters, dips, or steep slopes ("หลุมภูมิประเทศ")
            let terrainOk = true;
            let minH = h;
            let maxH = h;
            const sampleHeights = [];
            for (let sIdx = 0; sIdx < sampleOffsets.length; sIdx++) {
              const [sx, sy] = sampleOffsets[sIdx];
              const spX = candWx + candR[0]*(sx * 1.15) + candF[0]*(sy * 1.15);
              const spY = candWy + candR[1]*(sx * 1.15) + candF[1]*(sy * 1.15);
              const spZ = candWz + candR[2]*(sx * 1.15) + candF[2]*(sy * 1.15);
              const cDist = Math.sqrt(spX*spX + spY*spY + spZ*spZ) || 1;
              const cny = spY / cDist;
              const cnx = spX / cDist;
              const cnz = spZ / cDist;
              const cTheta = Math.acos(Math.max(-1.0, Math.min(1.0, cny)));
              const cPhi = Math.atan2(cnz, cnx);
              const cH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(cTheta, cPhi, seed) : getHeightOnSphere(cTheta, cPhi, seed);

              sampleHeights.push(cH);
              if (cH < minLandHeight) {
                terrainOk = false;
                break;
              }
              if (cH < minH) minH = cH;
              if (cH > maxH) maxH = cH;

              // House footprint must be level: maximum 0.016 elevation deviation from center
              if (Math.abs(cH - h) > 0.016) {
                terrainOk = false;
                break;
              }
            }

            // Height delta across footprint must not exceed 0.022 (~1.8% slope)
            if (!terrainOk || (maxH - minH) > 0.022) continue;

            // ============================================
            // D) Calculate true local terrain normal to prevent tilted houses (ป้องกันบ้านสุ่มเอียง)
            // Calculate gradients along local candR and candF axes
            // ============================================
            const deltaProbe = 0.15;
            const probeRx = candWx + candR[0] * deltaProbe;
            const probeRy = candWy + candR[1] * deltaProbe;
            const probeRz = candWz + candR[2] * deltaProbe;
            const distPrR = Math.sqrt(probeRx*probeRx + probeRy*probeRy + probeRz*probeRz) || 1;
            const hProbeR = typeof getVisualHeightOnSphere === "function" 
              ? getVisualHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, probeRy / distPrR))), Math.atan2(probeRz, probeRx), seed)
              : getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, probeRy / distPrR))), Math.atan2(probeRz, probeRx), seed);

            const probeFx = candWx + candF[0] * deltaProbe;
            const probeFy = candWy + candF[1] * deltaProbe;
            const probeFz = candWz + candF[2] * deltaProbe;
            const distPrF = Math.sqrt(probeFx*probeFx + probeFy*probeFy + probeFz*probeFz) || 1;
            const hProbeF = typeof getVisualHeightOnSphere === "function"
              ? getVisualHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, probeFy / distPrF))), Math.atan2(probeFz, probeFx), seed)
              : getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, probeFy / distPrF))), Math.atan2(probeFz, probeFx), seed);

            const slopeR = ((hProbeR - h) * HEIGHT_SCALE) / deltaProbe;
            const slopeF = ((hProbeF - h) * HEIGHT_SCALE) / deltaProbe;

            // Discard locations with surface gradient/slope > 0.08 (strictly ~4.5 degrees)
            if (Math.abs(slopeR) > 0.08 || Math.abs(slopeF) > 0.08) continue;

            // Compute exact terrain surface normal
            let terrNx = candNx - candR[0] * slopeR - candF[0] * slopeF;
            let terrNy = candNy - candR[1] * slopeR - candF[1] * slopeF;
            let terrNz = candNz - candR[2] * slopeR - candF[2] * slopeF;
            const lenTerrN = Math.sqrt(terrNx*terrNx + terrNy*terrNy + terrNz*terrNz) || 1;
            terrNx /= lenTerrN; terrNy /= lenTerrN; terrNz /= lenTerrN;

            // If normal tilts by more than 5 degrees away from spherical up, skip to guarantee perfectly upright houses
            const dotUp = terrNx * candNx + terrNy * candNy + terrNz * candNz;
            if (dotUp < 0.994) continue; // cos(6.3 deg) ~ 0.994

            // Re-orthogonalize candR and candF against the true surface normal
            let adjR = [
              candR[0] - terrNx * (candR[0]*terrNx + candR[1]*terrNy + candR[2]*terrNz),
              candR[1] - terrNy * (candR[0]*terrNx + candR[1]*terrNy + candR[2]*terrNz),
              candR[2] - terrNz * (candR[0]*terrNx + candR[1]*terrNy + candR[2]*terrNz)
            ];
            const lenAdjR = Math.sqrt(adjR[0]*adjR[0] + adjR[1]*adjR[1] + adjR[2]*adjR[2]) || 1;
            adjR[0] /= lenAdjR; adjR[1] /= lenAdjR; adjR[2] /= lenAdjR;

            let adjF = [
              terrNy * adjR[2] - terrNz * adjR[1],
              terrNz * adjR[0] - terrNx * adjR[2],
              terrNx * adjR[1] - terrNy * adjR[0]
            ];
            const lenAdjF = Math.sqrt(adjF[0]*adjF[0] + adjF[1]*adjF[1] + adjF[2]*adjF[2]) || 1;
            adjF[0] /= lenAdjF; adjF[1] /= lenAdjF; adjF[2] /= lenAdjF;

            // ============================================
            // 3. Check TREES ("ต้นไม้") & ROCKS ("หิน") in natureObstacles
            // ============================================
            let overlapsNature = false;
            const treeClearance = 0.55;
            const rockClearance = 0.45;

            for (let oIdx = 0; oIdx < natureObsList.length; oIdx++) {
              const obs = natureObsList[oIdx];
              if (!obs || !obs.position) continue;
              const ox = obs.position[0];
              const oy = obs.position[1];
              const oz = obs.position[2];
              
              const odx = ox - candWx;
              const ody = oy - candWy;
              const odz = oz - candWz;
              const distSq = odx*odx + ody*ody + odz*odz;

              if (distSq > (houseRadius + 3.0) * (houseRadius + 3.0)) continue;

              const localR = odx * candR[0] + ody * candR[1] + odz * candR[2];
              const localF = odx * candF[0] + ody * candF[1] + odz * candF[2];
              const localN = odx * candNx + ody * candNy + odz * candNz;

              if (Math.abs(localN) > 2.5) continue;

              const isTree = (obs.type === "tree" || (typeof COLLISION_LAYERS !== "undefined" && obs.layer === COLLISION_LAYERS.TREE));
              const isRock = (obs.type === "rock" || obs.type === "big_rock" || obs.type === "iron_ore" || obs.type === "gold_ore" || obs.type === "glow_ore" || obs.type === "copper_ore" || obs.type === "coal_ore" || (typeof COLLISION_LAYERS !== "undefined" && obs.layer === COLLISION_LAYERS.ROCK));

              if (isTree) {
                const rad = obs.trunkBaseRadius ? Math.max(0.2, obs.trunkBaseRadius) : 0.25;
                const allowedW = halfW + treeClearance + rad;
                const allowedD = halfD + treeClearance + rad;
                if (Math.abs(localR) < allowedW && Math.abs(localF) < allowedD) {
                  overlapsNature = true;
                  break;
                }
              } else if (isRock) {
                const rad = obs.radius ? Math.min(0.5, obs.radius * 0.5) : 0.25;
                const allowedW = halfW + rockClearance + rad;
                const allowedD = halfD + rockClearance + rad;
                if (Math.abs(localR) < allowedW && Math.abs(localF) < allowedD) {
                  overlapsNature = true;
                  break;
                }
              }
            }

            if (overlapsNature) continue;

            // ============================================
            // 4. Check items already in collectibles (branches, rock items)
            // ============================================
            let overlapsCollectible = false;
            for (let cIdx = 0; cIdx < collectibles.length; cIdx++) {
              const c = collectibles[cIdx];
              if (!c.active || !c.position) continue;
              if (c.type === "rock" || c.type === "big_rock" || c.type === "branch" || c.type === "stone_floor") {
                const cdx = c.position[0] - candWx;
                const cdy = c.position[1] - candWy;
                const cdz = c.position[2] - candWz;
                if (cdx*cdx + cdy*cdy + cdz*cdz < (houseRadius + 0.45) * (houseRadius + 0.45)) {
                  overlapsCollectible = true;
                  break;
                }
              }
            }
            if (overlapsCollectible) continue;

            // All checks passed! Valid spot found.
            wx = candWx; wy = candWy; wz = candWz;
            nx = terrNx; ny = terrNy; nz = terrNz;
            R = adjR; F = adjF;
            foundFlatSpot = true;
            placedHouses.push({
              x: wx,
              y: wy,
              z: wz,
              nx: nx,
              ny: ny,
              nz: nz,
              R: R,
              F: F,
              radius: houseRadius,
              totalW: totalW,
              totalD: totalD,
              gridX: gridX,
              gridY: gridY,
              wfW: wfW,
              entranceDoor: null
            });
            break;
          }

          if (!foundFlatSpot) continue;

          // Extra safety clearance for surrounding border
          const houseClearRadSq = (Math.max(totalW, totalD) * 0.65) * (Math.max(totalW, totalD) * 0.65);
          for (let cIdx = 0; cIdx < collectibles.length; cIdx++) {
            const c = collectibles[cIdx];
            if (!c || !c.active || c.isHouse || c.isProceduralHouse || !c.position) continue;
            if (c.type === "rock" || c.type === "big_rock" || c.type === "branch") {
              const cdx = c.position[0] - wx;
              const cdy = c.position[1] - wy;
              const cdz = c.position[2] - wz;
              if (cdx*cdx + cdy*cdy + cdz*cdz <= houseClearRadSq) {
                c.active = false;
              }
            }
          }

          for (let oIdx = 0; oIdx < natureObsList.length; oIdx++) {
            const obs = natureObsList[oIdx];
            if (!obs || !obs.position) continue;
            const odx = obs.position[0] - wx;
            const ody = obs.position[1] - wy;
            const odz = obs.position[2] - wz;
            if (odx*odx + ody*ody + odz*odz <= houseClearRadSq) {
              if (obs.type === "tree") {
                if (typeof choppedTrees !== "undefined" && !choppedTrees.includes(obs.id)) choppedTrees.push(obs.id);
                else if (window.choppedTrees && !window.choppedTrees.includes(obs.id)) window.choppedTrees.push(obs.id);
              } else {
                if (typeof destroyedRocks !== "undefined" && !destroyedRocks.includes(obs.id)) destroyedRocks.push(obs.id);
                else if (window.destroyedRocks && !window.destroyedRocks.includes(obs.id)) window.destroyedRocks.push(obs.id);
              }
              const rawVerts = (typeof natureRawVertices !== "undefined") ? natureRawVertices : window.natureRawVertices;
              const vBuffer = (typeof natureVertexBuffer !== "undefined") ? natureVertexBuffer : window.natureVertexBuffer;
              if (obs.meshStart !== undefined && obs.meshEnd !== undefined && rawVerts) {
                const startF = obs.meshStart * 3;
                const endF = obs.meshEnd * 3;
                for (let j = startF; j < endF; j++) rawVerts[j] = 0;
                if (typeof gl !== "undefined" && gl && vBuffer) {
                  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
                  gl.bufferSubData(gl.ARRAY_BUFFER, startF * 4, new Float32Array(rawVerts.slice(startF, endF)));
                }
              }
            }
          }

          collectibles.push({
            type: "stone_floor",
            position: [wx, wy, wz],
            normal: [nx, ny, nz],
            R: R,
            F: F,
            active: true,
            size: 0.25,
            width: totalW,
            depth: totalD,
            angle: 0.0,
            seed: seed + i * 5000,
            isHouse: true,
            isProceduralHouse: true,
            hideFromCompass: true
          });

          const stoneH = wfSize * 0.15;
          const baseWfH = (typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05;
          const actualWfThickness = baseWfH + wfSize * 0.12;
          
          const floorCenterHeight = stoneH + actualWfThickness / 2;
          const wallBaseHeight = stoneH + actualWfThickness;
          
          const roofStyle = Math.random() > 0.3 ? "gable" : "flat";
          const roofAxis = Math.random() > 0.5 ? "X" : "Y";
          
          const isPerfect = Math.random() < 0.4;
          const missingWallProb = isPerfect ? 0 : 0.15;
          const missingRoofProb = isPerfect ? 0 : 0.20;
          const missingFloorProb = isPerfect ? 0 : 0.08;
          
          const cells = [];
          for (let gx = 0; gx < gridX; gx++) {
            cells[gx] = [];
            for (let gy = 0; gy < gridY; gy++) {
              const hasFloor = Math.random() >= missingFloorProb;
              cells[gx][gy] = {
                hasFloor: hasFloor,
                // CRITICAL: Walls and roofs can ONLY exist on a cell that has a floor! No mid-air floating structures!
                hasRoof: hasFloor && (Math.random() >= missingRoofProb),
                wallLeft: (hasFloor && gx === 0) ? (Math.random() >= missingWallProb) : false,
                wallRight: (hasFloor && gx === gridX - 1) ? (Math.random() >= missingWallProb) : false,
                wallBottom: (hasFloor && gy === 0) ? (Math.random() >= missingWallProb) : false,
                wallTop: (hasFloor && gy === gridY - 1) ? (Math.random() >= missingWallProb) : false
              };
            }
          }

          // Enforce structural support rule: A roof must be supported by its perimeter wall
          for (let gx = 0; gx < gridX; gx++) {
            for (let gy = 0; gy < gridY; gy++) {
              const c = cells[gx][gy];
              if (c.hasRoof) {
                if (!c.hasFloor) { c.hasRoof = false; continue; }
                if (gx === 0 && !c.wallLeft) c.hasRoof = false;
                if (gx === gridX - 1 && !c.wallRight) c.hasRoof = false;
                if (gy === 0 && !c.wallBottom) c.hasRoof = false;
                if (gy === gridY - 1 && !c.wallTop) c.hasRoof = false;
              }
            }
          }

          // Choose at most ONE entrance door candidate for the entire house
          const doorCandidates = [];
          for (let gx = 0; gx < gridX; gx++) {
            for (let gy = 0; gy < gridY; gy++) {
              const c = cells[gx][gy];
              if (!c.hasFloor) continue;
              if (c.wallBottom && gy === 0) doorCandidates.push({ gx, gy, side: "bottom" });
              if (c.wallTop && gy === gridY - 1) doorCandidates.push({ gx, gy, side: "top" });
              if (c.wallLeft && gx === 0) doorCandidates.push({ gx, gy, side: "left" });
              if (c.wallRight && gx === gridX - 1) doorCandidates.push({ gx, gy, side: "right" });
            }
          }

          let entranceDoor = null;
          if (doorCandidates.length > 0 && (isPerfect || Math.random() < 0.75)) {
            entranceDoor = doorCandidates[Math.floor(Math.random() * doorCandidates.length)];
          }
          if (placedHouses.length > 0) {
            placedHouses[placedHouses.length - 1].entranceDoor = entranceDoor;
          }
          
          for (let gx = 0; gx < gridX; gx++) {
            for (let gy = 0; gy < gridY; gy++) {
               const c = cells[gx][gy];
               const cx = -totalW/2 + wfW/2 + gx * wfW;
               const cy = -totalD/2 + wfW/2 + gy * wfW;
               
               const localPos = [
                 wx + R[0]*cx + F[0]*cy,
                 wy + R[1]*cx + F[1]*cy,
                 wz + R[2]*cx + F[2]*cy
               ];
               
               if (c.hasFloor) {
                 const fPos = [
                   localPos[0] + nx*floorCenterHeight,
                   localPos[1] + ny*floorCenterHeight,
                   localPos[2] + nz*floorCenterHeight
                 ];
                 collectibles.push({
                   type: "wood_floor",
                   position: fPos,
                   normal: [nx, ny, nz],
                   R: R,
                   F: F,
                   active: true,
                   size: wfSize,
                   seed: seed + i*1000 + gx*10 + gy,
                   isHouse: true,
                   isProceduralHouse: true,
                   houseIndex: placedHouses.length - 1,
                   gx: gx,
                   gy: gy,
                   hideFromCompass: true,
                   isWorldGenerated: true
                 });
               }
               
               if (c.hasRoof && c.hasFloor) {
                 if (roofStyle === "flat") {
                   const roofHeight = floorCenterHeight + 0.25;
                   const roofPos = [
                     localPos[0] + nx*roofHeight,
                     localPos[1] + ny*roofHeight,
                     localPos[2] + nz*roofHeight
                   ];
                   collectibles.push({
                     type: "thin_wood_floor",
                     position: roofPos,
                     normal: [nx, ny, nz],
                     R: R,
                     F: F,
                     active: true,
                     size: wfSize,
                     seed: seed + i*2000 + gx*10 + gy,
                     isHouse: true,
                     isProceduralHouse: true,
                     hideFromCompass: true,
                     isWorldGenerated: true
                   });
                 } else {
                   // Gable roof logic
                   let isSlope = false;
                   let isFlatTop = false;
                   let roofRDir = R;
                   let roofFDir = F;
                   
                   if (roofAxis === "X") {
                     // ridge along Y-axis, slopes down along X-axis
                     if (gx === 0) {
                       isSlope = true;
                       roofFDir = R; 
                       roofRDir = [-F[0], -F[1], -F[2]];
                     } else if (gx === gridX - 1) {
                       isSlope = true;
                       roofFDir = [-R[0], -R[1], -R[2]];
                       roofRDir = F;
                     } else {
                       isFlatTop = true;
                     }
                   } else {
                     // ridge along X-axis, slopes down along Y-axis
                     if (gy === 0) {
                       isSlope = true;
                       roofFDir = F; 
                       roofRDir = R;
                     } else if (gy === gridY - 1) {
                       isSlope = true;
                       roofFDir = [-F[0], -F[1], -F[2]];
                       roofRDir = [-R[0], -R[1], -R[2]];
                     } else {
                       isFlatTop = true;
                     }
                   }

                   if (isFlatTop) {
                     const peakHeight = wallBaseHeight + 0.50; // top of slopes
                     const roofPos = [
                       localPos[0] + nx*peakHeight,
                       localPos[1] + ny*peakHeight,
                       localPos[2] + nz*peakHeight
                     ];
                     collectibles.push({
                       type: "thin_wood_floor",
                       position: roofPos,
                       normal: [nx, ny, nz],
                       R: R,
                       F: F,
                       active: true,
                       size: wfSize,
                       seed: seed + i*2000 + gx*10 + gy,
                       isHouse: true,
                       isProceduralHouse: true,
                       hideFromCompass: true,
                       isWorldGenerated: true
                     });
                   } else if (isSlope) {
                     const roofHeight = wallBaseHeight + 0.25;
                     const roofPos = [
                       localPos[0] + nx*roofHeight,
                       localPos[1] + ny*roofHeight,
                       localPos[2] + nz*roofHeight
                     ];
                     collectibles.push({
                       type: "wood_roof",
                       position: roofPos,
                       normal: [nx, ny, nz],
                       R: roofRDir,
                       F: roofFDir,
                       active: true,
                       size: wfSize,
                       angle: 0,
                       seed: seed + i*2000 + gx*10 + gy,
                       isHouse: true,
                       isProceduralHouse: true,
                       hideFromCompass: true,
                       isWorldGenerated: true
                     });
                   }
                 }
               }

               // Only spawn walls if the cell has a floor beneath it!
               if (c.hasFloor) {
                 const wallPosBase = [
                   localPos[0] + nx*wallBaseHeight,
                   localPos[1] + ny*wallBaseHeight,
                   localPos[2] + nz*wallBaseHeight
                 ];

                 // CRITICAL ENGINE RULE: wood_door and wood_window are fixtures that MUST CO-LOCATE with a wood_wall.
                 // wood_wall renders the framing and side planks; wood_door / wood_window renders the door leaf / window frame inside.
                 // Never spawn wood_door or wood_window alone in mid-air without wood_wall!
                 const addWall = (wOffset, wR, wF, seedOffset, fixtureType = null, elevOffset = 0) => {
                   const wPos = [
                     wallPosBase[0] + wOffset[0] + nx * elevOffset,
                     wallPosBase[1] + wOffset[1] + ny * elevOffset,
                     wallPosBase[2] + wOffset[2] + nz * elevOffset
                   ];

                   // Always place the base structural wood_wall
                   collectibles.push({
                     type: "wood_wall",
                     position: wPos,
                     normal: [nx, ny, nz],
                     R: wR,
                     F: wF,
                     active: true,
                     size: wfSize,
                     seed: seed + i*3000 + seedOffset,
                     isHouse: true,
                     isProceduralHouse: true,
                     hideFromCompass: true,
                     isWorldGenerated: true
                   });

                   // If this wall has a door or window fixture, co-locate it with the wall
                   if (elevOffset === 0 && (fixtureType === "wood_door" || fixtureType === "wood_window")) {
                     collectibles.push({
                       type: fixtureType,
                       position: [wPos[0], wPos[1], wPos[2]],
                       normal: [nx, ny, nz],
                       R: wR,
                       F: wF,
                       active: true,
                       size: wfSize,
                       angle: 0.0,
                       seed: seed + i*3000 + seedOffset + 500,
                       isHouse: true,
                       isProceduralHouse: true,
                       hideFromCompass: true,
                       isWorldGenerated: true
                     });
                   }
                 };

                 const getFixtureType = (side) => {
                   if (entranceDoor && entranceDoor.gx === gx && entranceDoor.gy === gy && entranceDoor.side === side) {
                     return "wood_door";
                   }
                   // 25% chance of a window on perimeter walls
                   if (Math.random() < 0.25) {
                     return "wood_window";
                   }
                   return null; // solid wood_wall
                 };

                 if (c.wallLeft) addWall([-R[0]*(wfW/2), -R[1]*(wfW/2), -R[2]*(wfW/2)], F, [-R[0], -R[1], -R[2]], gy, getFixtureType("left"));
                 if (c.wallRight) addWall([R[0]*(wfW/2), R[1]*(wfW/2), R[2]*(wfW/2)], F, R, gy + 100, getFixtureType("right"));
                 if (c.wallBottom) addWall([-F[0]*(wfW/2), -F[1]*(wfW/2), -F[2]*(wfW/2)], R, [-F[0], -F[1], -F[2]], gx + 200, getFixtureType("bottom"));
                 if (c.wallTop) addWall([F[0]*(wfW/2), F[1]*(wfW/2), F[2]*(wfW/2)], R, F, gx + 300, getFixtureType("top"));
                 
                 // Gable ends (triangular upper walls to fill peak gap)
                 // ONLY add if roof exists, floor exists, and the lower wall below it exists!
                 if (c.hasRoof && roofStyle === "gable") {
                   if (roofAxis === "X") {
                     if (gy === 0 && c.wallBottom) addWall([-F[0]*(wfW/2), -F[1]*(wfW/2), -F[2]*(wfW/2)], R, [-F[0], -F[1], -F[2]], gx + 1200, null, 0.25);
                     if (gy === gridY - 1 && c.wallTop) addWall([F[0]*(wfW/2), F[1]*(wfW/2), F[2]*(wfW/2)], R, F, gx + 1300, null, 0.25);
                   } else {
                     if (gx === 0 && c.wallLeft) addWall([-R[0]*(wfW/2), -R[1]*(wfW/2), -R[2]*(wfW/2)], F, [-R[0], -R[1], -R[2]], gy + 1000, null, 0.25);
                     if (gx === gridX - 1 && c.wallRight) addWall([R[0]*(wfW/2), R[1]*(wfW/2), R[2]*(wfW/2)], F, R, gy + 1100, null, 0.25);
                   }
                 }
               }
            }
          }
        }

        // =========================================================
        // PROCEDURAL BOATS (WOOD_BOAT ONLY - สุ่มวางตามบ้านสุ่ม และชายหาด)
        // Rule: Pure boats only (no wheels/engines).
        // House count: strictly less than half of the procedural houses count.
        // =========================================================
        const numPlacedHouses = placedHouses.length;
        // Strictly less than half of total placed houses
        const maxHouseBoats = Math.max(0, Math.floor((numPlacedHouses - 1) / 2));
        const houseBoatCount = Math.min(maxHouseBoats, Math.max(0, Math.floor(numPlacedHouses * 0.35)));
        
        const placedBoatPositions = [];

        if (houseBoatCount > 0 && numPlacedHouses > 0) {
          // Shuffle house indices deterministically
          const houseIndices = [];
          for (let h = 0; h < numPlacedHouses; h++) houseIndices.push(h);
          Math.random = mulberry32(seed + 94321);
          for (let h = houseIndices.length - 1; h > 0; h--) {
            const j = Math.floor(Math.random() * (h + 1));
            const tmp = houseIndices[h];
            houseIndices[h] = houseIndices[j];
            houseIndices[j] = tmp;
          }

          for (let b = 0; b < houseBoatCount; b++) {
            const house = placedHouses[houseIndices[b]];
            if (!house) continue;

            const hx = house.x, hy = house.y, hz = house.z;
            const hR = house.R || [1, 0, 0], hF = house.F || [0, 0, 1];
            const hRad = house.radius || 0.6;

            // Try placing outside the house (e.g. near entrance or side yard)
            const angleOffsets = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
            for (let aIdx = 0; aIdx < angleOffsets.length; aIdx++) {
              const ang = angleOffsets[aIdx];
              const dist = hRad + 0.38 + Math.random() * 0.15;
              const offX = (Math.cos(ang) * hR[0] + Math.sin(ang) * hF[0]) * dist;
              const offY = (Math.cos(ang) * hR[1] + Math.sin(ang) * hF[1]) * dist;
              const offZ = (Math.cos(ang) * hR[2] + Math.sin(ang) * hF[2]) * dist;

              const candX = hx + offX;
              const candY = hy + offY;
              const candZ = hz + offZ;
              const cDist = Math.sqrt(candX*candX + candY*candY + candZ*candZ) || 1;
              const bnx = candX / cDist;
              const bny = candY / cDist;
              const bnz = candZ / cDist;

              const bTheta = Math.acos(Math.max(-1.0, Math.min(1.0, bny)));
              const bPhi = Math.atan2(bnz, bnx);
              const bH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(bTheta, bPhi, seed) : getHeightOnSphere(bTheta, bPhi, seed);
              const bRad = RADIUS + bH * HEIGHT_SCALE;
              const bPos = [bnx * (bRad + 0.002), bny * (bRad + 0.002), bnz * (bRad + 0.002)];

              if (typeof isPositionInsideCave === "function" && isPositionInsideCave(bPos[0], bPos[1], bPos[2], 0.35)) {
                continue;
              }

              // Compute orthogonal tangent vectors
              let txR, txY, txZ;
              if (Math.abs(bny) < 0.9) {
                txR = -bnz; txY = 0; txZ = bnx;
              } else {
                txR = 1; txY = 0; txZ = 0;
              }
              const lenR = Math.sqrt(txR*txR + txY*txY + txZ*txZ) || 1;
              const bR_vec = [txR / lenR, txY / lenR, txZ / lenR];
              const bF_vec = [
                bR_vec[1] * bnz - bR_vec[2] * bny,
                bR_vec[2] * bnx - bR_vec[0] * bnz,
                bR_vec[0] * bny - bR_vec[1] * bnx
              ];
              const lenF = Math.sqrt(bF_vec[0]*bF_vec[0] + bF_vec[1]*bF_vec[1] + bF_vec[2]*bF_vec[2]) || 1;
              bF_vec[0] /= lenF; bF_vec[1] /= lenF; bF_vec[2] /= lenF;

              collectibles.push({
                type: "wood_boat",
                position: bPos,
                normal: [bnx, bny, bnz],
                R: bR_vec,
                F: bF_vec,
                active: true,
                isDynamic: true,
                size: 0.25,
                isPreview: false,
                hasWheel: false,
                hasWheels: false,
                wheelCount: 0,
                hasEngine: false,
                angle: Math.random() * Math.PI * 2,
                seed: seed + 50000 + b * 777,
                isWorldGenerated: true,
                isRandomBoat: true,
                isPlayerPlaced: false,
                hideFromCompass: true
              });

              placedBoatPositions.push(bPos);
              break;
            }
          }
        }

        // =========================================================
        // 2. BEACH BOATS (เรือสุ่มตามชายหาด)
        // =========================================================
        const waterRad = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * 0.15;
        const targetBeachBoats = Math.min(6, Math.max(3, Math.round(2 + Math.sqrt(rBase))));
        let beachBoatsSpawned = 0;

        for (let attempt = 0; attempt < 160 && beachBoatsSpawned < targetBeachBoats; attempt++) {
          Math.random = mulberry32(seed + 65432 + attempt * 997);
          const u = Math.random();
          const v = Math.random();
          const theta = Math.acos(2 * u - 1);
          const phi = 2 * Math.PI * v;
          const h = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
          const terrainRad = RADIUS + h * HEIGHT_SCALE;
          const hDiff = terrainRad - waterRad;

          // Beach shoreline zone: from shallow shoreline (-0.035) up to dry beach sand (+0.075)
          if (hDiff < -0.035 || hDiff > 0.075) continue;

          const candNx = Math.sin(theta) * Math.cos(phi);
          const candNy = Math.cos(theta);
          const candNz = Math.sin(theta) * Math.sin(phi);

          // Check for steep terrain / cliffs dropping into water (ensure gentle beach slope)
          const testOffset = 0.03;
          const tH1 = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta + testOffset, phi, seed) : getHeightOnSphere(theta + testOffset, phi, seed);
          const tH2 = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi + testOffset, seed) : getHeightOnSphere(theta, phi + testOffset, seed);
          if (Math.abs(tH1 - h) > 0.045 || Math.abs(tH2 - h) > 0.045) continue;

          const spawnRad = terrainRad < waterRad ? (waterRad - 0.02) : (terrainRad + 0.002);
          const candWx = spawnRad * candNx;
          const candWy = spawnRad * candNy;
          const candWz = spawnRad * candNz;

          if (typeof isPositionInsideCave === "function" && isPositionInsideCave(candWx, candWy, candWz, 0.35)) {
            continue;
          }

          // Check distance from existing placed houses
          let tooCloseHouse = false;
          for (let ph = 0; ph < placedHouses.length; ph++) {
            const hItem = placedHouses[ph];
            const dx = candWx - hItem.x, dy = candWy - hItem.y, dz = candWz - hItem.z;
            if (dx*dx + dy*dy + dz*dz < (hItem.radius + 1.0) * (hItem.radius + 1.0)) {
              tooCloseHouse = true;
              break;
            }
          }
          if (tooCloseHouse) continue;

          // Check distance from already spawned boats
          let tooCloseBoat = false;
          for (let pb = 0; pb < placedBoatPositions.length; pb++) {
            const bP = placedBoatPositions[pb];
            const dx = candWx - bP[0], dy = candWy - bP[1], dz = candWz - bP[2];
            if (dx*dx + dy*dy + dz*dz < 1.44) { // at least 1.2m apart
              tooCloseBoat = true;
              break;
            }
          }
          if (tooCloseBoat) continue;

          // Tangent coordinate system
          let txR, txY, txZ;
          if (Math.abs(candNy) < 0.9) {
            txR = -candNz; txY = 0; txZ = candNx;
          } else {
            txR = 1; txY = 0; txZ = 0;
          }
          const lenR = Math.sqrt(txR * txR + txY * txY + txZ * txZ) || 1;
          const bR = [txR / lenR, txY / lenR, txZ / lenR];
          const bF = [
            bR[1] * candNz - bR[2] * candNy,
            bR[2] * candNx - bR[0] * candNz,
            bR[0] * candNy - bR[1] * candNx
          ];
          const lenF = Math.sqrt(bF[0]*bF[0] + bF[1]*bF[1] + bF[2]*bF[2]) || 1;
          bF[0] /= lenF; bF[1] /= lenF; bF[2] /= lenF;

          collectibles.push({
            type: "wood_boat",
            position: [candWx, candWy, candWz],
            normal: [candNx, candNy, candNz],
            R: bR,
            F: bF,
            active: true,
            isDynamic: true,
            size: 0.25,
            isPreview: false,
            hasWheel: false,
            hasWheels: false,
            wheelCount: 0,
            hasEngine: false,
            angle: Math.random() * Math.PI * 2,
            seed: seed + 80000 + beachBoatsSpawned * 331,
            isWorldGenerated: true,
            isRandomBoat: true,
            isPlayerPlaced: false,
            hideFromCompass: true
          });

          placedBoatPositions.push([candWx, candWy, candWz]);
          beachBoatsSpawned++;
        }

        Math.random = _origRandom;

        if (
          savedCollectiblesState &&
          savedCollectiblesState.length === collectibles.length
        ) {
          for (let i = 0; i < collectibles.length; i++) {
            collectibles[i].active = savedCollectiblesState[i];
          }
        }

        refreshCollectiblesVBO();
        if (typeof SpatialGrid !== "undefined") {
          SpatialGrid.rebuild(collectibles);
        }

        window.placedHouses = placedHouses;
        if (typeof window.respawnPlayerClonesNearHouses === "function") {
          window.respawnPlayerClonesNearHouses();
        }
      }

      function getHouseSpawnLocation(preferredHouseIndex = -1) {
        const houses = (typeof window !== "undefined" && window.placedHouses && window.placedHouses.length > 0)
          ? window.placedHouses
          : [];

        const seed = (typeof window !== "undefined" && typeof window.globalSeed !== "undefined") ? window.globalSeed : 0;
        const pRad = (typeof RADIUS !== "undefined") ? RADIUS : 32;
        const hScale = (typeof HEIGHT_SCALE !== "undefined") ? HEIGHT_SCALE : 1.0;
        const wLevel = (typeof waterLevel !== "undefined") ? waterLevel : 1.0;
        const effectiveWaterRad = pRad + wLevel * (hScale * 0.25) + 0.05;

        if (houses.length > 0) {
          const indices = [];
          for (let i = 0; i < houses.length; i++) indices.push(i);
          if (preferredHouseIndex >= 0 && preferredHouseIndex < houses.length) {
            indices.unshift(indices.splice(preferredHouseIndex, 1)[0]);
          } else {
            for (let i = indices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const temp = indices[i];
              indices[i] = indices[j];
              indices[j] = temp;
            }
          }

          for (const hIdx of indices) {
            const house = houses[hIdx];
            if (!house) continue;

            const hx = house.x, hy = house.y, hz = house.z;
            const hR = house.R || [1, 0, 0];
            const hF = house.F || [0, 0, 1];
            const wfW = house.wfW || 0.30;
            const totalW = house.totalW || 0.6;
            const totalD = house.totalD || 0.6;
            const door = house.entranceDoor;

            // Safe clearance distance (เว้นระยะห่างหน้าประตู / หน้าระเบียงบ้าน 0.55 - 0.80 เมตร อย่างสวยงาม ไม่ติดกำแพง)
            const safeClearance = 0.60;

            const candidateOffsets = [];
            if (door) {
              const cellCx = -totalW / 2 + wfW / 2 + door.gx * wfW;
              const cellCy = -totalD / 2 + wfW / 2 + door.gy * wfW;
              if (door.side === "bottom") {
                candidateOffsets.push({ offR: cellCx, offF: cellCy - wfW / 2 - safeClearance });
                candidateOffsets.push({ offR: cellCx, offF: cellCy - wfW / 2 - (safeClearance + 0.35) });
              } else if (door.side === "top") {
                candidateOffsets.push({ offR: cellCx, offF: cellCy + wfW / 2 + safeClearance });
                candidateOffsets.push({ offR: cellCx, offF: cellCy + wfW / 2 + (safeClearance + 0.35) });
              } else if (door.side === "left") {
                candidateOffsets.push({ offR: cellCx - wfW / 2 - safeClearance, offF: cellCy });
                candidateOffsets.push({ offR: cellCx - wfW / 2 - (safeClearance + 0.35), offF: cellCy });
              } else if (door.side === "right") {
                candidateOffsets.push({ offR: cellCx + wfW / 2 + safeClearance, offF: cellCy });
                candidateOffsets.push({ offR: cellCx + wfW / 2 + (safeClearance + 0.35), offF: cellCy });
              }
            }

            // เพิ่มจุดรอบๆ ตัวบ้านกรณีไม่มีประตู หรือหน้าประตูมีสิ่งกีดขวาง
            const houseRad = house.radius || Math.sqrt((totalW / 2) * (totalW / 2) + (totalD / 2) * (totalD / 2));
            const testAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
            for (const ang of testAngles) {
              candidateOffsets.push({
                offR: Math.cos(ang) * (houseRad + safeClearance),
                offF: Math.sin(ang) * (houseRad + safeClearance)
              });
            }

            for (const offset of candidateOffsets) {
              const candWx = hx + hR[0] * offset.offR + hF[0] * offset.offF;
              const candWy = hy + hR[1] * offset.offR + hF[1] * offset.offF;
              const candWz = hz + hR[2] * offset.offR + hF[2] * offset.offF;

              const candDist = Math.sqrt(candWx * candWx + candWy * candWy + candWz * candWz) || 1;
              const candNx = candWx / candDist;
              const candNy = candWy / candDist;
              const candNz = candWz / candDist;

              const theta = Math.acos(Math.max(-1.0, Math.min(1.0, candNy)));
              let phi = Math.atan2(candNz, candNx);
              if (phi < 0) phi += Math.PI * 2;

              const hVal = typeof getVisualHeightOnSphere === "function"
                ? getVisualHeightOnSphere(theta, phi, seed)
                : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, seed) : 0);
              const surfaceRad = pRad + hVal * hScale;

              // ข้ามหากจมน้ำ
              if (surfaceRad < effectiveWaterRad) continue;

              // ข้ามหากอยู่ในถ้ำ
              if (typeof isPositionInsideCave === "function" && isPositionInsideCave(candWx, candWy, candWz, 0.3)) {
                continue;
              }

              return {
                theta: theta,
                phi: phi,
                house: house,
                houseIndex: hIdx,
                x: candWx,
                y: candWy,
                z: candWz,
                success: true
              };
            }
          }
        }

        // Fallback: หากไม่มีบ้านที่เหมาะสม ให้สุ่มหาพิกัดบนบกที่ไม่จมน้ำ
        let fallbackTheta = Math.PI / 2;
        let fallbackPhi = 0;
        for (let attempt = 0; attempt < 50; attempt++) {
          const u = Math.random();
          const v = Math.random();
          const testTheta = Math.acos(2 * u - 1);
          const testPhi = 2 * Math.PI * v;
          const hVal = typeof getVisualHeightOnSphere === "function"
            ? getVisualHeightOnSphere(testTheta, testPhi, seed)
            : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(testTheta, testPhi, seed) : 0);
          const surfaceRad = pRad + hVal * hScale;
          if (surfaceRad >= effectiveWaterRad) {
            fallbackTheta = testTheta;
            fallbackPhi = testPhi;
            break;
          }
        }

        return {
          theta: fallbackTheta,
          phi: fallbackPhi,
          house: null,
          houseIndex: -1,
          success: false
        };
      }
      window.getHouseSpawnLocation = getHouseSpawnLocation;
      window.getRandomHouseSpawn = getHouseSpawnLocation;

      window.addBox = addBox;
      function addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;
        
        let r = right, u = up, f = forward;
        if (r && u && f) {
          const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
          if (det < 0) {
            r = [-r[0], -r[1], -r[2]];
          }
        }

        const cubeVerts = [
          [-hw, -hh, -hd],
          [hw, -hh, -hd],
          [hw, -hh, hd],
          [-hw, -hh, hd],
          [-hw, hh, -hd],
          [hw, hh, -hd],
          [hw, hh, hd],
          [-hw, hh, hd],
        ];
        
        const cubeIndices = [
          0, 2, 1, 0, 3, 2, // bottom (CW outward)
          4, 5, 6, 4, 6, 7, // top (CW outward)
          0, 1, 5, 0, 5, 4, // back (CW outward)
          2, 3, 7, 2, 7, 6, // front (CW outward)
          0, 7, 3, 0, 4, 7, // left (CW outward)
          1, 2, 6, 1, 6, 5, // right (CW outward)
        ];
        
        const baseIdx = outVertices.length / 3;
        
        for (let i = 0; i < 8; i++) {
           const v = cubeVerts[i];
           const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
           const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
           const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
           
           outVertices.push(center[0]+rx, center[1]+ry, center[2]+rz);
           outColors.push(color[0], color[1], color[2]);
        }
        
        for (let i = 0; i < cubeIndices.length; i++) {
            outIndices.push(baseIdx + cubeIndices[i]);
        }
      }

      function buildHitboxes() {
        const vertices = [];
        const colors = [];
        const indices = [];
        
        if (showHitboxes) {
            const allObstacles = [
              ...natureObstacles,
              ...cubeObstacles,
              ...amphibians,
            ];
            
            for (let i = 0; i < allObstacles.length; i++) {
                const obs = allObstacles[i];
                let color = [1.0, 0.0, 0.0]; // Red for hitboxes
                
                if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
                    const baseIdx = vertices.length / 3;
                    const count = obs.meshEnd - obs.meshStart;
                    for (let j = 0; j < count; j++) {
                        const vIdx = obs.meshStart + j;
                        vertices.push(
                            natureRawVertices[vIdx*3],
                            natureRawVertices[vIdx*3+1],
                            natureRawVertices[vIdx*3+2]
                        );
                        colors.push(color[0], color[1], color[2]);
                        indices.push(baseIdx + j);
                    }
                } else if (obs.colliders && obs.colliders.length > 0) {
                    for (let col of obs.colliders) {
                        const r = col.radius;
                        if (!obs.position) continue;
                        
                        const cx = obs.position[0] + (col.offset[0] || 0);
                        const cy = obs.position[1] + (col.offset[1] || 0);
                        const cz = obs.position[2] + (col.offset[2] || 0);
                        
                        const h = r * 2;
                        
                        const up = [0, 1, 0];
                        if (obs.normal) {
                           up[0] = obs.normal[0]; up[1] = obs.normal[1]; up[2] = obs.normal[2];
                        }
                        
                        let ref = [0, 1, 0];
                        if (Math.abs(up[1]) > 0.9) ref = [1, 0, 0];
                        
                        let right = [
                            up[1]*ref[2] - up[2]*ref[1],
                            up[2]*ref[0] - up[0]*ref[2],
                            up[0]*ref[1] - up[1]*ref[0]
                        ];
                        let rLen = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]);
                        right = [right[0]/rLen, right[1]/rLen, right[2]/rLen];
                        
                        let fwd = [
                            right[1]*up[2] - right[2]*up[1],
                            right[2]*up[0] - right[0]*up[2],
                            right[0]*up[1] - right[1]*up[0]
                        ];
                        
                        const boxCenter = [cx, cy, cz];
                        
                        addBox(boxCenter, r*2, r*2, r*2, color, right, up, fwd, vertices, colors, indices);
                    }
                }
            }
        }
        
        hitboxIndicesLength = indices.length;
        if (hitboxIndicesLength > 0) {
            if (!hitboxVertexBuffer) hitboxVertexBuffer = gl.createBuffer();
            if (!hitboxColorBuffer) hitboxColorBuffer = gl.createBuffer();
            if (!hitboxIndexBuffer) hitboxIndexBuffer = gl.createBuffer();

            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

            const isUint32 = supportUint32 && indices.length > 65535;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hitboxIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, isUint32 ? new Uint32Array(indices) : new Uint16Array(indices), gl.STATIC_DRAW);
        }
      }

      let cachedRawBoatHull = null;
      function getOrCreateRawBoatHull() {
        if (cachedRawBoatHull) return cachedRawBoatHull;
        
        const tempVerts = [];
        const tempColors = [];
        const tempIndices = [];
        
        const p = [0, 0, 0];
        const n = [0, 1, 0];
        const r = [1, 0, 0];
        const f = [0, 0, 1];
        
        const bs = 0.4;
        const w = 0.5 * bs;
        const l = 1.2 * bs;
        const h = 0.2 * bs;
        const t = 0.04 * bs;
        
        const bCol = [0.55, 0.4, 0.25];
        const darkCol = [0.38, 0.26, 0.15];
        const lightCol = [0.65, 0.5, 0.35];
        const bottomShade = [0.46, 0.32, 0.18];
        
        const drawPartLocal = (localCenter, size, color, rotX = 0, rotY = 0, rotZ = 0) => {
          let currR = [...r];
          let currN = [...n];
          let currF = [...f];
          
          if (rotX !== 0) {
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const ny = [
              currN[0]*cosX - currF[0]*sinX,
              currN[1]*cosX - currF[1]*sinX,
              currN[2]*cosX - currF[2]*sinX
            ];
            const fz = [
              currN[0]*sinX + currF[0]*cosX,
              currN[1]*sinX + currF[1]*cosX,
              currN[2]*sinX + currF[2]*cosX
            ];
            currN = ny;
            currF = fz;
          }
          if (rotY !== 0) {
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
            const rx = [
              currR[0]*cosY + currF[0]*sinY,
              currR[1]*cosY + currF[1]*sinY,
              currR[2]*cosY + currF[2]*sinY
            ];
            const fz = [
              -currR[0]*sinY + currF[0]*cosY,
              -currR[1]*sinY + currF[1]*cosY,
              -currR[2]*sinY + currF[2]*cosY
            ];
            currR = rx;
            currF = fz;
          }
          if (rotZ !== 0) {
            const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
            const rx = [
              currR[0]*cosZ + currN[0]*sinZ,
              currR[1]*cosZ + currN[1]*sinZ,
              currR[2]*cosZ + currN[2]*sinZ
            ];
            const ny = [
              -currR[0]*sinZ + currN[0]*cosZ,
              -currR[1]*sinZ + currN[1]*cosZ,
              -currR[2]*sinZ + currN[2]*cosZ
            ];
            currR = rx;
            currN = ny;
          }
          
          const cx = p[0] + r[0]*localCenter[0] + n[0]*localCenter[1] + f[0]*localCenter[2];
          const cy = p[1] + r[1]*localCenter[0] + n[1]*localCenter[1] + f[1]*localCenter[2];
          const cz = p[2] + r[2]*localCenter[0] + n[2]*localCenter[1] + f[2]*localCenter[2];
          
          addBox([cx, cy, cz], size[0], size[1], size[2], color, currR, currN, currF, tempVerts, tempColors, tempIndices);
        };

        const segments = [
          { f: 0.0,       len: 0.12, pitch: 0.0,   y: 0.002, wf: 1.0,   sideTilt: 0.35 },
          { f: 0.10,      len: 0.10, pitch: 0.16,  y: 0.010, wf: 0.88,  sideTilt: 0.32 },
          { f: 0.19,      len: 0.10, pitch: 0.44,  y: 0.034, wf: 0.60,  sideTilt: 0.26 },
          { f: -0.10,     len: 0.10, pitch: -0.14, y: 0.008, wf: 0.92,  sideTilt: 0.32 },
          { f: -0.19,     len: 0.10, pitch: -0.38, y: 0.028, wf: 0.68,  sideTilt: 0.26 }
        ];

        for (let seg of segments) {
          const W_seg = w * seg.wf;
          drawPartLocal([0, seg.y, seg.f], [W_seg * 0.7, t, seg.len], bottomShade, seg.pitch, 0, 0);
          drawPartLocal([-W_seg * 0.32, seg.y + 0.003, seg.f], [W_seg * 0.35, t * 0.8, seg.len], bottomShade, seg.pitch, 0, -0.4);
          drawPartLocal([W_seg * 0.32, seg.y + 0.003, seg.f], [W_seg * 0.35, t * 0.8, seg.len], bottomShade, seg.pitch, 0, 0.4);

          const leftWallX = -W_seg * 0.52 - Math.sin(seg.sideTilt) * h * 0.5;
          const rightWallX = W_seg * 0.52 + Math.sin(seg.sideTilt) * h * 0.5;
          const wallY = seg.y + h * 0.45;
          drawPartLocal([leftWallX, wallY, seg.f], [t, h, seg.len], bCol, seg.pitch, 0, -seg.sideTilt);
          drawPartLocal([rightWallX, wallY, seg.f], [t, h, seg.len], bCol, seg.pitch, 0, seg.sideTilt);

          const railY = seg.y + h * 0.95;
          const leftRailX = leftWallX - Math.sin(seg.sideTilt) * h * 0.45;
          const rightRailX = rightWallX + Math.sin(seg.sideTilt) * h * 0.45;
          drawPartLocal([leftRailX, railY, seg.f], [t * 1.3, t * 0.7, seg.len * 1.04], darkCol, seg.pitch, 0, -seg.sideTilt);
          drawPartLocal([rightRailX, railY, seg.f], [t * 1.3, t * 0.7, seg.len * 1.04], darkCol, seg.pitch, 0, seg.sideTilt);
        }

        drawPartLocal([0, h * 0.38, 0.05], [w * 0.85, h * 0.72, t * 0.8], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.38, -0.05], [w * 0.88, h * 0.72, t * 0.8], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.55, 0.0], [w * 1.02, t * 0.6, 0.06], lightCol, 0, 0, 0);
        drawPartLocal([0, h * 0.95, 0.21], [w * 0.56, t * 0.7, 0.08], darkCol, 0.44, 0, 0);
        drawPartLocal([0, h * 0.7, 0.25], [t * 1.3, h * 0.8, t * 1.3], darkCol, 0.55, 0, 0);
        drawPartLocal([0, h * 0.48, -0.23], [w * 0.66, h * 0.95, t * 1.2], darkCol, -0.38, 0, 0);

        cachedRawBoatHull = {
          vertices: tempVerts,
          colors: tempColors,
          indices: tempIndices
        };
        return cachedRawBoatHull;
      }

      function refreshCollectiblesVBO(targetBuffer = 'all') {
        if (targetBuffer === 'all') {
          refreshCollectiblesVBO('main');
          refreshCollectiblesVBO('dynamic');
          return;
        }

        const vertices = [];
        const colors = [];
        const indices = [];

        let itemsToProcess = [];
        if (targetBuffer === 'main') {
          for (let item of collectibles) {
            if (!item.isDynamic && item.type !== "wood_door" && item.type !== "wood_window") {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          const currentActiveBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat);
          itemsToProcess = collectibles.filter(c => !c.isDynamic && c.type !== "wood_door" && c.type !== "wood_window" && c !== currentActiveBoat);
        } else if (targetBuffer === 'dynamic') {
          for (let item of collectibles) {
            if (item.isDynamic || item.type === "wood_door" || item.type === "wood_window") {
              delete item.meshStart;
              delete item.meshEnd;
            }
          }
          const currentActiveBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat);
          itemsToProcess = collectibles.filter(c => (c.isDynamic || c.type === "wood_door" || c.type === "wood_window") && c !== currentActiveBoat);
        } else {
          itemsToProcess = (typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible ? [floorPreviewCollectible] : []);
        }

        // Build spatial acceleration grids for doors, windows, and roofs
        // Eliminates O(N^2) cross-item calculations in wood_wall and wood_roof!
        const spatialDoors = new Map();
        const spatialWindows = new Map();
        const spatialRoofs = new Map();

        for (let i = 0; i < collectibles.length; i++) {
          const c = collectibles[i];
          if (!c.active || !c.position) continue;
          const px = c.position[0], py = c.position[1], pz = c.position[2];
          if (c.type === "wood_door") {
            const key = Math.floor(px / 0.5) + "_" + Math.floor(py / 0.5) + "_" + Math.floor(pz / 0.5);
            let arr = spatialDoors.get(key);
            if (!arr) { arr = []; spatialDoors.set(key, arr); }
            arr.push(c);
          } else if (c.type === "wood_window") {
            const key = Math.floor(px / 0.5) + "_" + Math.floor(py / 0.5) + "_" + Math.floor(pz / 0.5);
            let arr = spatialWindows.get(key);
            if (!arr) { arr = []; spatialWindows.set(key, arr); }
            arr.push(c);
          } else if (c.type === "wood_roof") {
            const key = Math.floor(px / 2.0) + "_" + Math.floor(py / 2.0) + "_" + Math.floor(pz / 2.0);
            let arr = spatialRoofs.get(key);
            if (!arr) { arr = []; spatialRoofs.set(key, arr); }
            arr.push(c);
          }
        }
        window._spatialDoors = spatialDoors;
        window._spatialWindows = spatialWindows;
        window._spatialRoofs = spatialRoofs;

        const activeProcessedItems = [];
        for (let item of itemsToProcess) {
          if (!item.active) continue;
          if (targetBuffer !== 'preview' && item.isPreview) continue;

          const startIdx = indices.length;

          const handler = window.ItemRegistry[item.type];
          if (handler && typeof handler.render === "function") {
            handler.render(item, vertices, colors, indices, targetBuffer);
          }
          if (targetBuffer === 'main' || targetBuffer === 'dynamic') {
            item.meshStart = startIdx;
            item.meshEnd = indices.length;
            if (indices.length > startIdx) {
              activeProcessedItems.push(item);
            }
          }
        }

        if (targetBuffer === 'dynamic') {
          window.dynamicCollectiblesList = activeProcessedItems;
        }

        if (indices.length === 0) {
          if (targetBuffer === 'main') collectibleIndicesLength = 0;
          else if (targetBuffer === 'dynamic') dynamicCollectibleIndicesLength = 0;
          else previewIndicesLength = 0;
          return;
        }

        const DYNAMIC_TYPED_ARRAYS = window._DYNAMIC_TYPED_ARRAYS || (window._DYNAMIC_TYPED_ARRAYS = {});
        function getReusableTypedArray(key, Ctor, arr) {
            let buf = DYNAMIC_TYPED_ARRAYS[key];
            if (!buf || buf.length < arr.length) {
                buf = new Ctor(Math.max(arr.length * 1.5, 2048));
                DYNAMIC_TYPED_ARRAYS[key] = buf;
            }
            buf.set(arr);
            return buf.subarray(0, arr.length);
        }

        const flatGeom = makeFlatShadedGeometry(vertices, colors, indices, targetBuffer === 'dynamic' || targetBuffer === 'preview');
        const isUint32 = supportUint32 && flatGeom && flatGeom.indices && flatGeom.indices.length > 65535;

        if (targetBuffer === 'main') {
            collectibleIndicesLength = flatGeom.indices.length;

            if (!collectibleVertexBuffer)
              collectibleVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.vertices),
              gl.STATIC_DRAW,
            );

            if (!collectibleColorBuffer) collectibleColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.colors),
              gl.STATIC_DRAW,
            );

            if (!collectibleNormalBuffer)
              collectibleNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.normals),
              gl.STATIC_DRAW,
            );

            if (!collectibleIndexBuffer) collectibleIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? new Uint32Array(flatGeom.indices) : new Uint16Array(flatGeom.indices),
              gl.STATIC_DRAW,
            );
        } else if (targetBuffer === 'dynamic') {
            dynamicCollectibleIndicesLength = flatGeom.indices.length;

            if (!dynamicCollectibleVertexBuffer)
              dynamicCollectibleVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynVerts', Float32Array, flatGeom.vertices),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleColorBuffer) dynamicCollectibleColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynCols', Float32Array, flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleNormalBuffer)
              dynamicCollectibleNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              getReusableTypedArray('dynNorms', Float32Array, flatGeom.normals),
              gl.DYNAMIC_DRAW,
            );

            if (!dynamicCollectibleIndexBuffer) dynamicCollectibleIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? getReusableTypedArray('dynInds32', Uint32Array, flatGeom.indices) : getReusableTypedArray('dynInds16', Uint16Array, flatGeom.indices),
              gl.DYNAMIC_DRAW,
            );
        } else {
            previewIndicesLength = flatGeom.indices.length;

            if (!previewVertexBuffer)
              previewVertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewVertexBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.vertices),
              gl.DYNAMIC_DRAW,
            );

            if (!previewColorBuffer) previewColorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewColorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.colors),
              gl.DYNAMIC_DRAW,
            );

            if (!previewNormalBuffer)
              previewNormalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, previewNormalBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(flatGeom.normals),
              gl.DYNAMIC_DRAW,
            );

            if (!previewIndexBuffer) previewIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previewIndexBuffer);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              isUint32 ? new Uint32Array(flatGeom.indices) : new Uint16Array(flatGeom.indices),
              gl.DYNAMIC_DRAW,
            );
        }
      }

      // === AUTHORITATIVE CENTRALIZED WHEELED BOAT CONTROLLER ===
      window.updateWheeledBoatControls = function(boat, inputState, dt) {
        if (!boat) return null;
        dt = (typeof dt === "number" && dt > 0) ? dt : 1.0;
        const moveForwardInput = (typeof inputState.moveForwardInput === "number") ? inputState.moveForwardInput : 0;
        const moveSidewaysInput = (typeof inputState.moveSidewaysInput === "number") ? inputState.moveSidewaysInput : 0;
        const isShiftHeld = !!inputState.isShiftHeld;
        const isHandbrake = !!inputState.isHandbrake;
        const pSpeed = (typeof inputState.playerSpeed === "number" && inputState.playerSpeed > 0) ? inputState.playerSpeed : 0.005;
        const isInWater = !!inputState.isInWater;
        const waterEnabled = !!inputState.waterEnabled;
        const charScale = (typeof inputState.charScale === "number") ? inputState.charScale : 1.0;
        let heading = (typeof inputState.charHeading === "number") ? inputState.charHeading : 0;
        const pitchGrade = (typeof inputState.pitchGrade === "number") ? inputState.pitchGrade : (boat.pitchGrade || 0);

        const hasWing = !!(boat.hasWing || boat.hasWings);
        const hasWheels = !!(boat.hasWheel || boat.hasWheels || (boat.wheelCount && boat.wheelCount > 0));
        const isLandBoat = hasWheels || hasWing;
        const hasEngine = !!boat.hasEngine;
        const hasBattery = typeof window.BatterySystem !== "undefined" && window.BatterySystem.hasActiveBattery();
        const isAirborne = !!(boat.isAirborne && !isInWater);
        const isControlledFlight = !!(boat.isFlying && hasWing);

        let moveNorthFactor = 0;
        let moveEastFactor = 0;
        let currentSpeedVal = 0;

        if (isLandBoat) {
            // === 1. FRONT WHEEL STEERING ANGLE ===
            // Left (A, moveSidewaysInput = -1) -> targetSteer = +0.52 (wheels point Left along +R)
            // Right (D, moveSidewaysInput = +1) -> targetSteer = -0.52 (wheels point Right along -R)
            const maxSteerRad = 0.52; // ~30 degrees
            const targetSteer = -moveSidewaysInput * maxSteerRad;
            let currentSteer = boat.steerAngle || 0;
            currentSteer += (targetSteer - currentSteer) * Math.min(1.0, 0.25 * dt);
            boat.steerAngle = currentSteer;

            // === 2. ACCELERATION, BRAKING, REVERSING & HANDBRAKE ===
            let vehSpeed = boat.vehicleSpeed || 0;
            let topFwdSpeed = (hasEngine && hasBattery) ? pSpeed * 5.0 : (hasEngine ? pSpeed * 0.5 : (!hasWheels && isInWater ? pSpeed * 1.5 : 0));
            let topRevSpeed = (hasEngine && hasBattery) ? pSpeed * 2.0 : (hasEngine ? pSpeed * 0.2 : (!hasWheels && isInWater ? pSpeed * 0.8 : 0));
            let accelPower = (hasEngine && hasBattery) ? pSpeed * 0.16 * dt : (!hasWheels && isInWater && !hasEngine ? pSpeed * 0.08 * dt : 0);
            let brakePower = pSpeed * 0.30 * dt;
            let coastFriction = Math.pow(isInWater ? 0.96 : ((isAirborne || boat.isFlying) && hasWing ? 0.995 : 0.985), dt);

            if (hasWing && hasEngine && hasBattery && (boat.isFlying || isShiftHeld)) {
                topFwdSpeed = Math.max(topFwdSpeed, pSpeed * 4.5);
                accelPower = Math.max(accelPower, pSpeed * 0.16 * dt);
            }

            const canAccelerate = (hasEngine && hasBattery) || (!hasWheels && isInWater && !hasEngine);

            // Feedback notices
            if (!hasEngine && hasWheels && (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1)) {
                const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                if (typeof showNotice === "function" && (!boat._lastEngineNotice || nowTime - boat._lastEngineNotice > 3000)) {
                    boat._lastEngineNotice = nowTime;
                    showNotice("เรือติดล้อต้องติดตั้งเครื่องยนต์ไฟฟ้าก่อนจึงจะขับเคลื่อนได้! (Attach Electric Engine to drive wheeled boat)");
                }
            } else if (hasEngine && !hasBattery && (Math.abs(moveForwardInput) > 0.1 || (boat.isFlying && isShiftHeld))) {
                if (typeof window.BatterySystem !== "undefined") {
                    window.BatterySystem.showEmptyNotice();
                }
            }

            const isUsingPower = Math.abs(moveForwardInput) > 0.1 || (boat.isFlying && isShiftHeld);
            if (hasEngine && hasBattery && isUsingPower) {
                if (typeof window.BatterySystem !== "undefined") {
                    window.BatterySystem.consumePower(dt);
                }
            }

            boat.isHandbraking = isHandbrake && !boat.isFlying;

            // Slope gravity roll
            const gravityRollPower = pitchGrade * pSpeed * 0.4 * dt * (isInWater ? 0.2 : 1.0);
            if (!boat.isHandbraking) {
                vehSpeed -= gravityRollPower;
            }

            // Slope angle limit (Cliffs steeper than 45 degrees / pitchGrade > 1.0 cannot be driven up)
            // 45-degree angle condition ONLY works on land/ground, NEVER on water or in flight!
            const isSlopeTooSteep = !isInWater && !boat.isFlying && !isAirborne && (pitchGrade > 1.0);

            if (boat.isHandbraking) {
                vehSpeed *= Math.pow(0.85, dt);
            } else if (moveForwardInput > 0.1 && canAccelerate) {
                if (vehSpeed < -0.01) {
                    vehSpeed += brakePower; // Braking while moving backwards
                } else if (!isSlopeTooSteep) {
                    vehSpeed = Math.min(topFwdSpeed, vehSpeed + accelPower);
                } else {
                    // GTA Style Inertia & Slope Traction Slip:
                    // Does NOT abruptly freeze to 0. Existing inertia smoothly carries momentum,
                    // while drive traction slips (wheels spin without full grip).
                    // Gravity rollback smoothly decelerates and slips the vehicle back down.
                    const tractionGrip = Math.max(0.0, 1.0 - (pitchGrade - 1.0) * 3.0);
                    vehSpeed = Math.min(topFwdSpeed, vehSpeed + accelPower * tractionGrip);
                    vehSpeed -= (pitchGrade * pSpeed * 0.25 * dt);
                }
            } else if (!boat.isFlying && moveForwardInput < -0.1 && canAccelerate) {
                if (vehSpeed > 0.01) {
                    vehSpeed -= brakePower; // Braking while moving forward
                } else {
                    vehSpeed = Math.max(-topRevSpeed, vehSpeed - accelPower); // Reversing backwards
                }
            } else {
                vehSpeed *= coastFriction;
                if (Math.abs(vehSpeed) < 0.00001) vehSpeed = 0;
            }

            boat.vehicleSpeed = vehSpeed;

            // === 3. VEHICLE STEERING / HEADING (UNIFIED REALISTIC FLATOUT / ARCADE CONTROLS) ===
            const refMaxSpeed = pSpeed * 5.0;
            if (!isAirborne && !boat.isFlying) {
                // Forward (W / vehSpeed >= 0):
                //   Press Left (A, currentSteer > 0) -> turnDir = +1 -> heading increases -> turns Left!
                //   Press Right (D, currentSteer < 0) -> turnDir = +1 -> heading decreases -> turns Right!
                // Reverse (S / vehSpeed < 0):
                //   Press Left (A, currentSteer > 0) -> turnDir = -1 -> heading decreases -> rear curves Left, backs up Left!
                //   Press Right (D, currentSteer < 0) -> turnDir = -1 -> heading increases -> rear curves Right, backs up Right!
                const isReversing = (vehSpeed < -0.001 || (moveForwardInput < -0.1 && vehSpeed <= 0.001));
                const turnDir = isReversing ? -1 : 1;
                const driftMultiplier = boat.isHandbraking ? 2.4 : 1.0;

                if (Math.abs(vehSpeed) > 0.001) {
                    const turnRate = currentSteer * (Math.abs(vehSpeed) / refMaxSpeed) * 0.035 * turnDir * driftMultiplier;
                    heading += turnRate * dt;
                }
                if (Math.abs(moveSidewaysInput) > 0.05) {
                    const lowSpeedTurning = Math.max(0.0, 1.0 - Math.abs(vehSpeed) / refMaxSpeed);
                    if (canAccelerate || Math.abs(vehSpeed) > 0.0005 || isInWater) {
                        heading += currentSteer * 0.025 * dt * lowSpeedTurning * turnDir;
                    }
                }
            } else if (isControlledFlight) {
                // Controlled wing flight: bank & steer
                heading += currentSteer * 0.045 * dt;
            }

            // === 4. WHEEL SPIN ANGLE ===
            const isFlyingInAir = !!(isAirborne || boat.isFlying);
            if (!isFlyingInAir) {
                const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
                const wheelRadius = 0.16 * wheelScale;
                const distTraveled = vehSpeed * dt;
                boat.spinAngle = (boat.spinAngle || 0) + (distTraveled / wheelRadius);
                boat.frozenSpinAngle = boat.spinAngle;
            } else {
                if (boat.frozenSpinAngle === undefined) {
                    boat.frozenSpinAngle = boat.spinAngle || 0;
                }
                boat.spinAngle = boat.frozenSpinAngle;
            }

            // === 5. MOVEMENT VECTORS ===
            let speedRatio = vehSpeed / pSpeed;
            if (Math.abs(speedRatio) > 0.001) {
                moveNorthFactor = Math.cos(heading) * Math.sign(speedRatio);
                moveEastFactor  = Math.sin(heading) * Math.sign(speedRatio);
            } else if (moveForwardInput !== 0) {
                moveNorthFactor = Math.cos(heading) * moveForwardInput;
                moveEastFactor  = Math.sin(heading) * moveForwardInput;
            }
            currentSpeedVal = Math.abs(vehSpeed);
        } else {
            // Water-only boat (no wheels and no wings)
            let canRow = isInWater;
            if (canRow) {
                heading += -moveSidewaysInput * 0.05 * dt;
                moveNorthFactor = Math.cos(heading) * moveForwardInput;
                moveEastFactor  = Math.sin(heading) * moveForwardInput;
                const hasEngineActive = hasEngine && hasBattery;
                currentSpeedVal = hasEngineActive ? pSpeed * 5.0 : pSpeed * 1.5;
            } else {
                moveNorthFactor = 0;
                moveEastFactor = 0;
                currentSpeedVal = 0;
                if (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1) {
                    const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                    if (typeof showNotice === "function" && (!boat._lastLandNotice || nowTime - boat._lastLandNotice > 3000)) {
                        boat._lastLandNotice = nowTime;
                        showNotice("เรือต้องอยู่บนน้ำ หรือติดล้อไม้เพื่อวิ่งบนบก! (Attach Wooden Wheel to drive on land)");
                    }
                }
            }
        }

        return {
            heading,
            moveNorthFactor,
            moveEastFactor,
            currentSpeedVal
        };
      };

      function updateCollectibles(dt) {
        if (!collectibles || collectibles.length === 0) return;
        
        let needRefresh = false;
        let needMainRefresh = false;
        const gravityAccel = Physics.gravityAccel;

        // --- Active Floor Placement Preview Update ---
        const isInventoryOpen = document.getElementById("inventoryOverlay")?.classList.contains("open");
        if (isPlacingFloor && !isInventoryOpen) {
          const placingItemName = floorPlacementInfo && floorPlacementInfo.item ? floorPlacementInfo.item.name : "";
          const typeToPlace = placingItemName.startsWith("ROBOT_") ? placingItemName.toLowerCase() : (placingItemName === "STONE_FLOOR" ? "stone_floor" : (placingItemName === "WOOD_STAIRS" ? "wood_stairs" : (placingItemName === "FOLDING_LADDER" ? "folding_ladder" : (placingItemName === "CAMPFIRE" ? "campfire" : (placingItemName === "WOOD_BOAT" ? "wood_boat" : (placingItemName === "ELECTRIC_ENGINE" ? "electric_engine" : (placingItemName === "BOAT_WING" ? "boat_wing" : (placingItemName === "WOOD_WHEEL" ? "wood_wheel" : (placingItemName === "WOOD_WALL" ? "wood_wall" : (placingItemName === "WOOD_WINDOW" ? "wood_window" : (placingItemName === "WOOD_DOOR" ? "wood_door" : (placingItemName === "WOOD_ROOF" ? "wood_roof" : (placingItemName === "WOOD_CHEST" ? "wood_chest" : (placingItemName === "MEGANEURA" ? "meganeura_item" : (placingItemName === "ISOPOD" ? "isopod_item" : (placingItemName === "OBSIDIAN_PAD_WARP" || placingItemName === "OBSIDIAN_COMPASS_PAD" ? "obsidian_pad_warp_item" : (placingItemName === "THIN_WOOD_FLOOR" ? "thin_wood_floor" : "wood_floor")))))))))))))))));

          if (!floorPreviewCollectible || floorPreviewCollectible.type !== typeToPlace) {
            // Remove mismatched preview if it exists
            if (floorPreviewCollectible) {
              const idx = collectibles.indexOf(floorPreviewCollectible);
              if (idx !== -1) collectibles.splice(idx, 1);
            }
            floorPreviewCollectible = {
              type: typeToPlace,
              position: [0, 0, 0],
              normal: [0, 1, 0],
              R: [1, 0, 0],
              F: [0, 0, 1],
              U: [0, 1, 0],
              color: [0.95, 0.85, 0.45], // preview highlight color
              size: typeToPlace === "campfire" ? campfireSize : 0.25,
              active: true,
              isDynamic: false,
              isPreview: true,
              seed: Math.random()
            };
            collectibles.push(floorPreviewCollectible);
            floorPreviewCollectible = collectibles[collectibles.length - 1];
            if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace === "wood_boat" || typeToPlace === "wood_wheel" || typeToPlace === "electric_engine" || typeToPlace === "boat_wing" || typeToPlace.startsWith("robot_")) {
              floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_WALL;
            } else if (typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_roof" || typeToPlace === "folding_ladder") {
              floorPreviewCollectible.layer = COLLISION_LAYERS.WOOD_FLOOR;
            } else if (typeToPlace === "stone_floor") {
              floorPreviewCollectible.layer = COLLISION_LAYERS.STONE_FLOOR;
            }
          }

          // Update position to float in front of player, conforming to the terrain/ground surface
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
          
          const charScaleVal = (typeof playerScale !== 'undefined') ? playerScale : 0.1;
          const currentFeetRad = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null)
            ? (playerCenterRadius - 0.46 * charScaleVal)
            : terrainRadius;

          let playerCaveInfo = null;
          let isPlayerInCave = false;
          if (typeof getTerrainSurfaceAndCeiling === "function") {
            playerCaveInfo = getTerrainSurfaceAndCeiling(nx, ny, nz, currentFeetRad);
            if (playerCaveInfo && (playerCaveInfo.insideTunnel || currentFeetRad < playerCaveInfo.surfaceRadius - 0.35)) {
              isPlayerInCave = true;
              groundRadius = playerCaveInfo.ground;
              terrainRadius = playerCaveInfo.ground;
            }
          }

          const waterRadius = RADIUS + waterLevel * 0.15;
          if (!isPlayerInCave && waterEnabled && terrainRadius < waterRadius) {
              groundRadius = waterRadius;
          }

          const East = [-sinPhi, 0, cosPhi];
          const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

          const snappedHeading = Math.round(charHeading / (Math.PI / 2)) * (Math.PI / 2);
          const cosH = Math.cos(snappedHeading);
          const sinH = Math.sin(snappedHeading);

          const F = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH,
          ];

          // Set a close forward offset in actual meters (using actionReachDistance with a minimum safety fallback to prevent clipping)
          const baseOffset = typeToPlace === "campfire" ? 0.20 : 0.35;
          const forwardOffset = (typeToPlace === "campfire" || typeToPlace === "wood_chest" || typeToPlace.startsWith("robot_")) 
            ? Math.max(baseOffset, actionReachDistance) 
            : baseOffset; 
          const playerPt = [nx * groundRadius, ny * groundRadius, nz * groundRadius];
          const previewDir = [
            playerPt[0] + F[0] * forwardOffset,
            playerPt[1] + F[1] * forwardOffset,
            playerPt[2] + F[2] * forwardOffset
          ];
          const len = Math.sqrt(previewDir[0]*previewDir[0] + previewDir[1]*previewDir[1] + previewDir[2]*previewDir[2]);
          const pnx = previewDir[0] / (len || 1);
          const pny = previewDir[1] / (len || 1);
          const pnz = previewDir[2] / (len || 1);

          // Get exact height/ground radius at the preview position (so it floats along/conforms to the ground)
          let previewTheta = Math.acos(Math.max(-1.0, Math.min(1.0, pny)));
          let previewPhi = Math.atan2(pnz, pnx);

          let previewHeight = getHeightOnSphere(previewTheta, previewPhi, globalSeed);
          let previewTerrainRadius = RADIUS + previewHeight * HEIGHT_SCALE;
          
          let isInCave = isPlayerInCave;
          if (typeof getTerrainSurfaceAndCeiling === "function") {
              const queryRad = isPlayerInCave ? groundRadius : (previewTerrainRadius - 0.2);
              const caveInfo = getTerrainSurfaceAndCeiling(pnx, pny, pnz, queryRad);
              if (caveInfo && (caveInfo.insideTunnel || isPlayerInCave || caveInfo.ground < previewTerrainRadius - 0.35)) {
                  previewTerrainRadius = caveInfo.ground;
                  isInCave = true;
              }
          }
          
          let previewGroundRadius = previewTerrainRadius;
          let isUnderWater = !isInCave && waterEnabled && previewTerrainRadius < waterRadius;
          if (isUnderWater) {
              previewGroundRadius = waterRadius;
          }
          
          // Calculate slope to prevent placing on too steep ground
          const eps = 0.01;
          const h1 = getHeightOnSphere(previewTheta + eps, previewPhi, globalSeed);
          const h2 = getHeightOnSphere(previewTheta, previewPhi + eps, globalSeed);
          const dhScale = HEIGHT_SCALE / (eps * Math.max(1, previewTerrainRadius));
          const slopeTheta = Math.abs(h1 - previewHeight) * dhScale;
          const slopePhi = Math.abs(h2 - previewHeight) * dhScale;
          const slopeVal = Math.sqrt(slopeTheta*slopeTheta + slopePhi*slopePhi);
          
          // Valid placement if not on water and not too steep (Stone Floor is valid everywhere)
          const maxSlope = typeToPlace === "campfire" ? 2.0 : 0.8;
          floorPreviewCollectible.isValidPlacement = (typeToPlace === "stone_floor") ? true : (!isUnderWater && (slopeVal < maxSlope));
          
          const previewEast = [-Math.sin(previewPhi), 0, Math.cos(previewPhi)];
          const previewNorth = [-Math.cos(previewTheta) * Math.cos(previewPhi), Math.sin(previewTheta), -Math.cos(previewTheta) * Math.sin(previewPhi)];

          let pF = [
            previewNorth[0] * cosH + previewEast[0] * sinH,
            previewNorth[1] * cosH + previewEast[1] * sinH,
            previewNorth[2] * cosH + previewEast[2] * sinH,
          ];

          let pR = [
            previewEast[0] * cosH - previewNorth[0] * sinH,
            previewEast[1] * cosH - previewNorth[1] * sinH,
            previewEast[2] * cosH - previewNorth[2] * sinH,
          ];

          if (typeToPlace === "wood_roof") {
            // Roof rotation is manual via the Q key (placementRotationAngle), independent of camera heading
            const rotA = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
            const cosRot = Math.cos(rotA);
            const sinRot = Math.sin(rotA);
            pR = [
              previewEast[0] * cosRot + previewNorth[0] * sinRot,
              previewEast[1] * cosRot + previewNorth[1] * sinRot,
              previewEast[2] * cosRot + previewNorth[2] * sinRot,
            ];
            pF = [
              previewNorth[0] * cosRot - previewEast[0] * sinRot,
              previewNorth[1] * cosRot - previewEast[1] * sinRot,
              previewNorth[2] * cosRot - previewEast[2] * sinRot,
            ];
            floorPreviewCollectible.angle = 0.0;
          }

          let pN = [pnx, pny, pnz];

          // "ลอยสูงจากพื้นเสมอ" -> float slightly above the ground at the preview location
          const bobAmt = typeToPlace === "campfire" ? 0.005 : (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" ? 0.015 : ((typeToPlace === "stone_floor") ? 0.03 : ((typeToPlace === "wood_floor" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_roof") ? 0.05 : 0.12)));
          let bob = typeToPlace === "campfire" ? 0.005 : (Math.sin(Date.now() * 0.003) * 0.01 + bobAmt); 
          if (typeToPlace === "robot_cockpit") bob = 0.14;
          else if (typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") bob = 0.14;
          else if (typeToPlace === "robot_stand") bob = 0.0;
          else if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") bob = 0.002;
          else if (typeToPlace.startsWith("robot_")) bob = 0.35;

          let targetPos = [
              (previewGroundRadius + bob) * pnx,
              (previewGroundRadius + bob) * pny,
              (previewGroundRadius + bob) * pnz
          ];

          // --- SNAPPING LOGIC ---
          let isSnapped = false;
          let bestSnapPos = null;
          let bestSnapDist = Infinity;
          let snapParent = null;
          let bestP_top = null;
          let bestP_bottom = null;
          let bestW_dir = null;
          let bestSlope_dir = null;

          const floorWidth = 0.3;
          const floorDepth = 0.3;

          if (typeToPlace === "wood_stairs") {
            // Snapping wood stairs to wood/stone floor edges
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                const odx = other.position[0] - targetPos[0];
                const ody = other.position[1] - targetPos[1];
                const odz = other.position[2] - targetPos[2];
                if (odx*odx + ody*ody + odz*odz > 36.0) continue; // Skip distant floors (>6m)

                const isStone = other.type === "stone_floor";
                const w = isStone ? other.size * 12.0 : other.size * 1.2;
                const d = isStone ? other.size * 12.0 : other.size * 1.2;
                const hw = w / 2;
                const hd = d / 2;
                
                let rBase = other.R;
                let fBase = other.F;
                
                // Define the edges
                let edges = [];
                let floorHH = 0;
                if (other.type === "stone_floor") floorHH = other.size * 0.15 / 2;
                else if (other.type === "wood_floor") floorHH = (woodFloorHeight + other.size * 0.12) / 2;
                else if (other.type === "thin_wood_floor") floorHH = other.size * 0.04 / 2;
                
                const nx = other.normal[0] * floorHH;
                const ny = other.normal[1] * floorHH;
                const nz = other.normal[2] * floorHH;
                
                edges = [
                  { center: [other.position[0] + rBase[0] * hw + nx, other.position[1] + rBase[1] * hw + ny, other.position[2] + rBase[2] * hw + nz], T: [fBase[0], fBase[1], fBase[2]], slope: [rBase[0], rBase[1], rBase[2]], halfL: hd },
                  { center: [other.position[0] - rBase[0] * hw + nx, other.position[1] - rBase[1] * hw + ny, other.position[2] - rBase[2] * hw + nz], T: [fBase[0], fBase[1], fBase[2]], slope: [-rBase[0], -rBase[1], -rBase[2]], halfL: hd },
                  { center: [other.position[0] + fBase[0] * hd + nx, other.position[1] + fBase[1] * hd + ny, other.position[2] + fBase[2] * hd + nz], T: [rBase[0], rBase[1], rBase[2]], slope: [fBase[0], fBase[1], fBase[2]], halfL: hw },
                  { center: [other.position[0] - fBase[0] * hd + nx, other.position[1] - fBase[1] * hd + ny, other.position[2] - fBase[2] * hd + nz], T: [rBase[0], rBase[1], rBase[2]], slope: [-fBase[0], -fBase[1], -fBase[2]], halfL: hw }
                ];

                for (let edge of edges) {
                  let isOccupied = false;
                  for (let c of collectibles) {
                      if (!c.active || c.isPreview) continue;
                      if (c === other) continue;
                      
                      const dx = c.position[0] - edge.center[0];
                      const dy = c.position[1] - edge.center[1];
                      const dz = c.position[2] - edge.center[2];
                      if (dx*dx + dy*dy + dz*dz > 4.0) continue; // Skip distant collectibles (>2m)
                      
                      const outwardDist = dx * edge.slope[0] + dy * edge.slope[1] + dz * edge.slope[2];
                      const sidewaysDist = dx * edge.T[0] + dy * edge.T[1] + dz * edge.T[2];
                      const verticalDist = dx * other.normal[0] + dy * other.normal[1] + dz * other.normal[2];
                      
                      if (c.type === "wood_floor" || c.type === "thin_wood_floor") {
                          if (outwardDist > 0.05 && outwardDist < 0.25 && Math.abs(sidewaysDist) < 0.1 && Math.abs(verticalDist) < 0.1) {
                              isOccupied = true;
                              break;
                          }
                      } else if (c.type === "wood_stairs") {
                          if (outwardDist > 0.05 && outwardDist < 0.25 && Math.abs(sidewaysDist) < 0.1 && Math.abs(verticalDist) < 0.25) {
                              isOccupied = true;
                              break;
                          }
                      }
                  }
                  if (isOccupied) continue;
                  
                  // Find closest point on segment
                  const dx_vec = [
                    targetPos[0] - edge.center[0],
                    targetPos[1] - edge.center[1],
                    targetPos[2] - edge.center[2]
                  ];
                  const t = dx_vec[0] * edge.T[0] + dx_vec[1] * edge.T[1] + dx_vec[2] * edge.T[2];
                  let clampedT = Math.max(-edge.halfL + 0.05, Math.min(edge.halfL - 0.05, t));
                  // Snap the horizontal offset along the edge to a multiple of 0.3 for grid alignment
                  clampedT = Math.round(clampedT / 0.3) * 0.3;
                  
                  const P_top = [
                    edge.center[0] + edge.T[0] * clampedT,
                    edge.center[1] + edge.T[1] * clampedT,
                    edge.center[2] + edge.T[2] * clampedT
                  ];
                  const slope_dir = edge.slope;
                  const W_dir = edge.T;

                  // Calculate P_bottom along the slope direction on the planet ground
                  const L_horizontal = 0.3;
                  const P_temp = [
                    P_top[0] + slope_dir[0] * L_horizontal,
                    P_top[1] + slope_dir[1] * L_horizontal,
                    P_top[2] + slope_dir[2] * L_horizontal
                  ];
                  const len_temp = Math.sqrt(P_temp[0]*P_temp[0] + P_temp[1]*P_temp[1] + P_temp[2]*P_temp[2]) || 1;
                  const n_temp = [P_temp[0] / len_temp, P_temp[1] / len_temp, P_temp[2] / len_temp];
                  
                  const theta_temp = Math.acos(Math.max(-1.0, Math.min(1.0, n_temp[1])));
                  const phi_temp = Math.atan2(n_temp[2], n_temp[0]);
                  const height_temp = getHeightOnSphere(theta_temp, phi_temp, globalSeed);
                  let r_temp = RADIUS + height_temp * HEIGHT_SCALE;
                  
                  const top_r = P_top[0]*n_temp[0] + P_top[1]*n_temp[1] + P_top[2]*n_temp[2];
                  let maxFloorRadius = r_temp;
                  
                  for (let other of collectibles) {
                    if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "stone_wall" || other.type === "wood_wall") && !other.isPreview) {
                      const ox = other.position[0];
                      const oy = other.position[1];
                      const oz = other.position[2];
                      const fdx = ox - P_temp[0];
                      const fdy = oy - P_temp[1];
                      const fdz = oz - P_temp[2];
                      if (fdx*fdx + fdy*fdy + fdz*fdz > 36.0) continue; // Skip distant structures (>6m)
                      
                      const verticalDist = ox*n_temp[0] + oy*n_temp[1] + oz*n_temp[2];
                      
                      let hw = 0.15;
                      if (other.type === "stone_floor") hw = 1.5;
                      
                      const dx = P_temp[0] - ox;
                      const dy = P_temp[1] - oy;
                      const dz = P_temp[2] - oz;
                      const localX = dx * other.R[0] + dy * other.R[1] + dz * other.R[2];
                      const localZ = dx * other.F[0] + dy * other.F[1] + dz * other.F[2];
                      
                      if (Math.abs(localX) <= hw + 0.05 && Math.abs(localZ) <= hw + 0.05 && verticalDist >= r_temp) {
                         let surface_r = verticalDist;
                         if (other.type.includes("wall")) {
                            surface_r += 0.125; 
                         } else if (other.type === "stone_floor") {
                            surface_r += other.size * 0.15 / 2;
                         } else if (other.type === "wood_floor") {
                            surface_r += (woodFloorHeight + other.size * 0.12) / 2;
                         } else if (other.type === "thin_wood_floor") {
                            surface_r += other.size * 0.04 / 2;
                         }
                         
                         if (surface_r > maxFloorRadius && surface_r < top_r - 0.05) {
                            maxFloorRadius = surface_r;
                         }
                      }
                    }
                  }
                  
                  r_temp = maxFloorRadius;
                  // Enforce a minimum vertical drop to ensure the stairs are never flat
                  if (top_r - r_temp < 0.22) {
                      r_temp = top_r - 0.25;
                  }
                  const P_bottom = [n_temp[0] * r_temp, n_temp[1] * r_temp, n_temp[2] * r_temp];

                  // Stair midpoint center
                  const P_mid = [
                    (P_top[0] + P_bottom[0]) / 2,
                    (P_top[1] + P_bottom[1]) / 2,
                    (P_top[2] + P_bottom[2]) / 2
                  ];

                  const dx = P_mid[0] - targetPos[0];
                  const dy = P_mid[1] - targetPos[1];
                  const dz = P_mid[2] - targetPos[2];
                  
                  // For stairs, give less weight to the vertical difference (distance from ground)
                  // since targetPos is constrained to the ground, but stairs can be snapped to 2nd floors.
                  const verticalDiff = dx * pN[0] + dy * pN[1] + dz * pN[2];
                  const horizontalDistSq = (dx*dx + dy*dy + dz*dz) - verticalDiff*verticalDiff;
                  let dist = Math.sqrt(horizontalDistSq + verticalDiff*verticalDiff * 0.1);

                  if (dist < bestSnapDist) {
                    bestSnapDist = dist;
                    bestSnapPos = P_mid;
                    snapParent = other;
                    bestP_top = P_top;
                    bestP_bottom = P_bottom;
                    bestW_dir = W_dir;
                    bestSlope_dir = slope_dir;
                  }
                }
              }
            }

            if (bestSnapPos && bestSnapDist < 0.6) {
              targetPos = bestSnapPos;
              pN = [snapParent.normal[0], snapParent.normal[1], snapParent.normal[2]];
              pR = [bestW_dir[0], bestW_dir[1], bestW_dir[2]];
              pF = [bestSlope_dir[0], bestSlope_dir[1], bestSlope_dir[2]];
              isSnapped = true;
              floorPreviewCollectible.isValidPlacement = true;

                            floorPreviewCollectible.stairTop = bestP_top;
              floorPreviewCollectible.stairBottom = bestP_bottom;
            } else {
              let snappedToCave = false;
              let cx = playerPt[0];
              let cy = playerPt[1];
              let cz = playerPt[2];
              let bestTunnelRadius = 0.4;
              
              // Apply hysteresis based on previous frame's snapped-to-cave state to prevent rapid snapping/unsnapping flicker
              let wasSnapped = (typeof floorPreviewCollectible !== 'undefined' && floorPreviewCollectible && floorPreviewCollectible.wasSnappedToCave);
              
              if (typeof tunnels3D !== 'undefined' && tunnels3D) {
                  let minDist = Infinity;
                  let closestTunnel = null;
                  
                  for (let t of tunnels3D) {
                      let dx = t.x - targetPos[0];
                      let dy = t.y - targetPos[1];
                      let dz = t.z - targetPos[2];
                      let distSq = dx*dx + dy*dy + dz*dz;
                      
                      let t_len = Math.sqrt(t.x*t.x + t.y*t.y + t.z*t.z) || 1;
                      const theta_t = Math.acos(Math.max(-1.0, Math.min(1.0, t.y/t_len)));
                      const phi_t = Math.atan2(t.z, t.x);
                      const height_t = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_t, phi_t, typeof globalSeed !== 'undefined' ? globalSeed : 0) : 0;
                      let maxTerrainRadius = RADIUS + height_t * HEIGHT_SCALE;
                      
                      let isMouth = (t_len + t.r * 1.25 >= maxTerrainRadius);
                      let limitRadius = t.r * (wasSnapped ? 3.0 : 2.0);
                      if (isMouth && distSq < limitRadius * limitRadius && distSq < minDist) {
                          minDist = distSq;
                          closestTunnel = t;
                      }
                  }
                  
                  if (closestTunnel) {
                      snappedToCave = true;
                      if (floorPreviewCollectible) {
                          floorPreviewCollectible.wasSnappedToCave = true;
                      }
                      
                      // Snap directly to the closest tunnel mouth's static position to avoid any cursor-based center jitter
                      cx = closestTunnel.x;
                      cy = closestTunnel.y;
                      cz = closestTunnel.z;
                      bestTunnelRadius = closestTunnel.r;
                      
                      let t_len = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
                      let n_t = [cx/t_len, cy/t_len, cz/t_len];
                      
                      // Calculate the surface height of the cave mouth center
                      const theta_t = Math.acos(Math.max(-1.0, Math.min(1.0, n_t[1])));
                      const phi_t = Math.atan2(n_t[2], n_t[0]);
                      const height_t = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_t, phi_t, typeof globalSeed !== 'undefined' ? globalSeed : 0) : 0;
                      let maxTerrainRadius = RADIUS + height_t * HEIGHT_SCALE;
                      
                      const P_surf_center = [n_t[0] * maxTerrainRadius, n_t[1] * maxTerrainRadius, n_t[2] * maxTerrainRadius];
                      
                      // Project player forward direction onto cave tangent plane to determine stair climb direction.
                      // This avoids any spinning singularities at the center of the mouth and makes the stair follow the player's look direction.
                      const dot_F_t = pF[0]*n_t[0] + pF[1]*n_t[1] + pF[2]*n_t[2];
                      let forwardDir_t = [pF[0] - n_t[0]*dot_F_t, pF[1] - n_t[1]*dot_F_t, pF[2] - n_t[2]*dot_F_t];
                      let forwardLen_t = Math.sqrt(forwardDir_t[0]*forwardDir_t[0] + forwardDir_t[1]*forwardDir_t[1] + forwardDir_t[2]*forwardDir_t[2]) || 1;
                      const slope_dir = [forwardDir_t[0]/forwardLen_t, forwardDir_t[1]/forwardLen_t, forwardDir_t[2]/forwardLen_t];
                      
                      // Position top of stair exactly on the cave mouth rim / lip in the direction closest to the player
                      // (opposite of the inward slope direction)
                      const P_lip = [
                          P_surf_center[0] - slope_dir[0] * (bestTunnelRadius * 1.02),
                          P_surf_center[1] - slope_dir[1] * (bestTunnelRadius * 1.02),
                          P_surf_center[2] - slope_dir[2] * (bestTunnelRadius * 1.02)
                      ];
                      
                      const len_lip = Math.sqrt(P_lip[0]*P_lip[0] + P_lip[1]*P_lip[1] + P_lip[2]*P_lip[2]) || 1;
                      const n_lip = [P_lip[0]/len_lip, P_lip[1]/len_lip, P_lip[2]/len_lip];
                      const theta_lip = Math.acos(Math.max(-1.0, Math.min(1.0, n_lip[1])));
                      const phi_lip = Math.atan2(n_lip[2], n_lip[0]);
                      const height_lip = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_lip, phi_lip, typeof globalSeed !== 'undefined' ? globalSeed : 0) : 0;
                      let r_lip = RADIUS + height_lip * HEIGHT_SCALE;
                      const P_top = [n_lip[0]*r_lip, n_lip[1]*r_lip, n_lip[2]*r_lip];
                      
                      // Project bottom position on the cave floor inside the cave mouth
                      const L_horizontal = 0.35;
                      const P_inward = [
                          P_top[0] + slope_dir[0] * L_horizontal,
                          P_top[1] + slope_dir[1] * L_horizontal,
                          P_top[2] + slope_dir[2] * L_horizontal
                      ];
                      const len_inward = Math.sqrt(P_inward[0]*P_inward[0] + P_inward[1]*P_inward[1] + P_inward[2]*P_inward[2]) || 1;
                      const n_inward = [P_inward[0]/len_inward, P_inward[1]/len_inward, P_inward[2]/len_inward];
                      
                      // Query height at a query radius inside the tunnel (r_lip - 0.5) to guarantee we are physically inside the 3D tunnel segment
                      let r_floor = r_lip - 1.2;
                      if (typeof getTerrainSurfaceAndCeiling === "function") {
                          const caveInfoTemp = getTerrainSurfaceAndCeiling(n_inward[0], n_inward[1], n_inward[2], r_lip - 0.5);
                          if (caveInfoTemp) {
                              r_floor = caveInfoTemp.ground;
                          }
                      }
                      
                      // Crucial: Enforce a minimum slope/vertical drop to guarantee the stairs are never horizontal/flat.
                      const minDrop = Math.max(0.6, bestTunnelRadius * 1.5);
                      if (r_floor > r_lip - minDrop) {
                          r_floor = r_lip - minDrop;
                      }
                      
                      const P_bottom = [n_inward[0] * r_floor, n_inward[1] * r_floor, n_inward[2] * r_floor];
                      
                      // Lateral orthogonal vector for stair rungs
                      let W_dir = [
                          n_t[1]*slope_dir[2] - n_t[2]*slope_dir[1],
                          n_t[2]*slope_dir[0] - n_t[0]*slope_dir[2],
                          n_t[0]*slope_dir[1] - n_t[1]*slope_dir[0]
                      ];
                      const lenW = Math.sqrt(W_dir[0]*W_dir[0] + W_dir[1]*W_dir[1] + W_dir[2]*W_dir[2]) || 1;
                      W_dir = [W_dir[0]/lenW, W_dir[1]/lenW, W_dir[2]/lenW];
                      
                      // Apply snapped position and axes
                      targetPos = [
                          (P_top[0] + P_bottom[0]) / 2,
                          (P_top[1] + P_bottom[1]) / 2,
                          (P_top[2] + P_bottom[2]) / 2
                      ];
                      pN = [n_t[0], n_t[1], n_t[2]];
                      pR = [W_dir[0], W_dir[1], W_dir[2]];
                      pF = [slope_dir[0], slope_dir[1], slope_dir[2]];
                      
                      floorPreviewCollectible.stairTop = P_top;
                      floorPreviewCollectible.stairBottom = P_bottom;
                      floorPreviewCollectible.isValidPlacement = true;
                  }
              }

              if (!snappedToCave) {
                  if (floorPreviewCollectible) {
                      floorPreviewCollectible.wasSnappedToCave = false;
                  }
              // Not snapped: place stairs in front of player on the ground, going UP and AWAY.
              const L_horizontal = 0.3;
              
              const dx = targetPos[0] - cx;
              const dy = targetPos[1] - cy;
              const dz = targetPos[2] - cz;
              
              const localX = dx * pR[0] + dy * pR[1] + dz * pR[2];
              const localZ = dx * pF[0] + dy * pF[1] + dz * pF[2];
              
              let gridX = Math.round(localX / 0.3);
              let gridZ = Math.round(localZ / 0.3);
              
              if (!snappedToCave) {
                  gridX = Math.max(-1, Math.min(1, gridX));
                  gridZ = Math.max(1, Math.min(2, gridZ)); // Force it to be in front
              }
              
              const P_bottom_start = [
                cx + pR[0] * (gridX * 0.3) + pF[0] * (gridZ * 0.3),
                cy + pR[1] * (gridX * 0.3) + pF[1] * (gridZ * 0.3),
                cz + pR[2] * (gridX * 0.3) + pF[2] * (gridZ * 0.3)
              ];

              const slope_dir = [pF[0], pF[1], pF[2]];
              const W_dir = [pR[0], pR[1], pR[2]];

              // Calculate true ground height for P_bottom
              const len_b = Math.sqrt(P_bottom_start[0]*P_bottom_start[0] + P_bottom_start[1]*P_bottom_start[1] + P_bottom_start[2]*P_bottom_start[2]) || 1;
              const n_b = [P_bottom_start[0] / len_b, P_bottom_start[1] / len_b, P_bottom_start[2] / len_b];
              const theta_b = Math.acos(Math.max(-1.0, Math.min(1.0, n_b[1])));
              const phi_b = Math.atan2(n_b[2], n_b[0]);
              const height_b = getHeightOnSphere(theta_b, phi_b, globalSeed);
              let r_b = RADIUS + height_b * HEIGHT_SCALE;
              if (typeof getTerrainSurfaceAndCeiling === "function") {
                  const caveInfoB = getTerrainSurfaceAndCeiling(n_b[0], n_b[1], n_b[2], RADIUS - 0.5);
                  if (caveInfoB && caveInfoB.ground < r_b - 0.5) {
                      r_b = caveInfoB.ground;
                  }
              }
              
              for (let other of collectibles) {
                if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "stone_wall" || other.type === "wood_wall") && !other.isPreview) {
                  const ox = other.position[0], oy = other.position[1], oz = other.position[2];
                  const verticalDist = ox*n_b[0] + oy*n_b[1] + oz*n_b[2];
                  
                  let hw = 0.15;
                  if (other.type === "stone_floor") hw = 1.5;
                  
                  const dx = P_bottom_start[0] - ox;
                  const dy = P_bottom_start[1] - oy;
                  const dz = P_bottom_start[2] - oz;
                  const localX = dx * other.R[0] + dy * other.R[1] + dz * other.R[2];
                  const localZ = dx * other.F[0] + dy * other.F[1] + dz * other.F[2];
                  
                  if (Math.abs(localX) <= hw + 0.05 && Math.abs(localZ) <= hw + 0.05 && verticalDist >= r_b) {
                     let surface_r = verticalDist;
                     if (other.type.includes("wall")) surface_r += 0.125; 
                     else if (other.type === "stone_floor") surface_r += other.size * 0.15 / 2;
                     else if (other.type === "wood_floor") surface_r += (woodFloorHeight + other.size * 0.12) / 2;
                     else if (other.type === "thin_wood_floor") surface_r += other.size * 0.04 / 2;
                     
                     if (surface_r > r_b) r_b = surface_r;
                  }
                }
              }
              const P_bottom = [n_b[0] * r_b, n_b[1] * r_b, n_b[2] * r_b];

              // Make stairs rigid and of a fixed size by default.
              let H_vertical = 0.25;
              let L_actual = L_horizontal;
              
              // If aiming downwards slightly, flip the stair so it builds down.
              const lookDownAngle = pnx*n_b[0] + pny*n_b[1] + pnz*n_b[2];
              if (lookDownAngle < -0.2) {
                 H_vertical = -0.25;
              }

              // Check terrain at P_temp to see if we're bridging a cave drop-off
              const P_temp = [
                P_bottom[0] + slope_dir[0] * L_horizontal,
                P_bottom[1] + slope_dir[1] * L_horizontal,
                P_bottom[2] + slope_dir[2] * L_horizontal
              ];
              const len_temp = Math.sqrt(P_temp[0]*P_temp[0] + P_temp[1]*P_temp[1] + P_temp[2]*P_temp[2]) || 1;
              const n_temp = [P_temp[0] / len_temp, P_temp[1] / len_temp, P_temp[2] / len_temp];
              
              let r_temp = 0;
              let r_surface = 0;
              let caveInfoTemp = null;
              
              // Raycast slightly forward to find the true crater rim, as the slope might be wide.
              let max_r_surface = -Infinity;
              let foundCaveBoundary = false;
              let boundary_r_temp = 0;
              let boundary_caveInfo = null;
              
              for (let step = 1; step <= 5; step++) {
                  let test_L = L_horizontal * step;
                  const P_test = [
                    P_bottom[0] + slope_dir[0] * test_L,
                    P_bottom[1] + slope_dir[1] * test_L,
                    P_bottom[2] + slope_dir[2] * test_L
                  ];
                  const len_test = Math.sqrt(P_test[0]*P_test[0] + P_test[1]*P_test[1] + P_test[2]*P_test[2]) || 1;
                  const n_test = [P_test[0] / len_test, P_test[1] / len_test, P_test[2] / len_test];
                  
                  const theta_test = Math.acos(Math.max(-1.0, Math.min(1.0, n_test[1])));
                  const phi_test = Math.atan2(n_test[2], n_test[0]);
                  let height_test = 0;
                  if (typeof getHeightOnSphere === "function") height_test = getHeightOnSphere(theta_test, phi_test, typeof globalSeed !== "undefined" ? globalSeed : 0);
                  let test_r_temp = RADIUS + height_test * HEIGHT_SCALE;
                  let test_r_surface = test_r_temp;
                  
                  let testCaveInfo = null;
                  if (typeof getTerrainSurfaceAndCeiling === "function") {
                      testCaveInfo = getTerrainSurfaceAndCeiling(n_test[0], n_test[1], n_test[2], RADIUS - 0.5);
                      if (testCaveInfo) {
                          test_r_surface = testCaveInfo.surfaceRadius;
                          if (testCaveInfo.ground < test_r_temp - 0.5) {
                              test_r_temp = testCaveInfo.ground;
                          }
                      }
                  }
                  
                  if (test_r_surface > max_r_surface) {
                      max_r_surface = test_r_surface;
                  }
                  
                  if (step === 1) {
                      r_temp = test_r_temp;
                      r_surface = test_r_surface;
                      caveInfoTemp = testCaveInfo;
                  }
                  
                  // Check if we found a boundary at this step or previous
                  if (Math.abs(r_b - test_r_temp) > 0.5 || (testCaveInfo && testCaveInfo.isEntrance)) {
                      foundCaveBoundary = true;
                  }
              }
              
              // If there's a huge drop-off between P_bottom and P_temp (like a cave entrance boundary), bridge it!
              if (foundCaveBoundary || snappedToCave) {
                  let targetSurface = Math.max(max_r_surface, RADIUS - 0.2);
                  let min_ground = Math.min(r_temp, r_b);
                  
                  if (lookDownAngle < -0.2 || snappedToCave) {
                      // Aiming down into the cave. P_bottom should be lifted to the surface lip.
                      let adjust_H = targetSurface - r_b + 0.15;
                      if (adjust_H > 0) {
                          P_bottom[0] += n_b[0] * adjust_H;
                          P_bottom[1] += n_b[1] * adjust_H;
                          P_bottom[2] += n_b[2] * adjust_H;
                      }
                      
                      H_vertical = min_ground - targetSurface - 0.15;
                      L_actual = Math.max(L_horizontal, Math.abs(H_vertical) * 0.6);
                  } else {
                      // Aiming up out of the cave. P_top should reach the surface lip.
                      if (targetSurface - r_b > 0.5) {
                          H_vertical = targetSurface - r_b + 0.15;
                          L_actual = Math.max(L_horizontal, H_vertical * 0.6);
                      }
                  }
              }

              // Crucial: Enforce a minimum absolute height difference to guarantee the stairs are never horizontal/flat.
              if (Math.abs(H_vertical) < 0.22) {
                  H_vertical = (H_vertical >= 0) ? 0.22 : -0.22;
                  L_actual = Math.max(L_actual, Math.abs(H_vertical) * 0.6);
              }

              let P_top = [
                P_bottom[0] + slope_dir[0] * L_actual + n_b[0] * H_vertical,
                P_bottom[1] + slope_dir[1] * L_actual + n_b[1] * H_vertical,
                P_bottom[2] + slope_dir[2] * L_actual + n_b[2] * H_vertical
              ];
              
              // Ensure P_top is always treated as the far point regardless of height.
              // The rendering code now safely handles negative slopes.

              targetPos = [
                (P_top[0] + P_bottom[0]) / 2,
                (P_top[1] + P_bottom[1]) / 2,
                (P_top[2] + P_bottom[2]) / 2
              ];

                            floorPreviewCollectible.stairTop = P_top;
              floorPreviewCollectible.stairBottom = P_bottom;
              floorPreviewCollectible.isValidPlacement = isInCave;
              }
            }
          } else if (typeToPlace === "folding_ladder") {
            // DEATH STRANDING EXTENDABLE FOLDING LADDER PLACEMENT
            // Requirement: Firmly anchored at player's feet, conforming naturally to terrain, slopes, cliffs, caves & holes
            // Descending down into drops/cave mouths naturally ("ตั้งลงไปตามธรรมชาติ")
            // Both ends (Head and Tail) MUST be anchored to solid ground/structure/rock.
            // Under NO circumstance can it be placed on water, underwater, or floating in empty air!

            const isPlayerInWater = (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.05) ||
                                    (typeof isDivingMode !== "undefined" && isDivingMode);

            // Use continuous charHeading (not 90-degree snapped) so ladder faces player's look direction
            const hCos = Math.cos(charHeading);
            const hSin = Math.sin(charHeading);
            const forwardUnsnapped = [
              North[0] * hCos + East[0] * hSin,
              North[1] * hCos + East[1] * hSin,
              North[2] * hCos + East[2] * hSin,
            ];
            const rightUnsnapped = [
              East[0] * hCos - North[0] * hSin,
              East[1] * hCos - North[1] * hSin,
              East[2] * hCos - North[2] * hSin,
            ];

            const rotA = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
            const cosRot = Math.cos(rotA);
            const sinRot = Math.sin(rotA);

            let ladderF = [
              forwardUnsnapped[0] * cosRot - rightUnsnapped[0] * sinRot,
              forwardUnsnapped[1] * cosRot - rightUnsnapped[1] * sinRot,
              forwardUnsnapped[2] * cosRot - rightUnsnapped[2] * sinRot,
            ];
            let ladderR = [
              rightUnsnapped[0] * cosRot + forwardUnsnapped[0] * sinRot,
              rightUnsnapped[1] * cosRot + forwardUnsnapped[1] * sinRot,
              rightUnsnapped[2] * cosRot + forwardUnsnapped[2] * sinRot,
            ];

            const lenF = Math.hypot(ladderF[0], ladderF[1], ladderF[2]) || 1;
            ladderF = [ladderF[0]/lenF, ladderF[1]/lenF, ladderF[2]/lenF];
            const lenR = Math.hypot(ladderR[0], ladderR[1], ladderR[2]) || 1;
            ladderR = [ladderR[0]/lenR, ladderR[1]/lenR, ladderR[2]/lenR];

            // Camera pitch detection: looking down into hole/slope vs looking forward/up
            const camPitch = (typeof rotationX === "number") ? rotationX : (typeof window.freeCamPitch === "number" ? window.freeCamPitch : 0.0);
            const isLookingDown = (camPitch > 0.05);
            const isLookingUp = (camPitch < -0.05);

            // 1. EXACT Player Feet Position in World Space
            const charScaleVal = (typeof playerScale !== 'undefined') ? playerScale : 0.1;
            const seedVal = (typeof globalSeed !== "undefined") ? globalSeed : ((typeof window !== "undefined" && window.globalSeed !== "undefined") ? window.globalSeed : 0);
            const pUp = [nx, ny, nz];

            const playerFeetRad = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null)
              ? (playerCenterRadius - 0.46 * charScaleVal)
              : groundRadius;
            const playerFeetPos = [nx * playerFeetRad, ny * playerFeetRad, nz * playerFeetRad];

            // Surface terrain radius directly at player
            const pTheta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
            const pPhi = Math.atan2(nz, nx);
            const pSurfH = typeof getHeightOnSphere === "function" ? getHeightOnSphere(pTheta, pPhi, seedVal) : 0;
            const pSurfRad = RADIUS + pSurfH * HEIGHT_SCALE;
            const isPlayerUnderground = (playerFeetRad < pSurfRad - 0.35);

            // 2. Anchor 1 (Tail / Player Footing): firmly on the solid ground right at player's feet
            let testA1 = [
              playerFeetPos[0] + ladderF[0] * 0.16,
              playerFeetPos[1] + ladderF[1] * 0.16,
              playerFeetPos[2] + ladderF[2] * 0.16
            ];
            let lenA1 = Math.hypot(testA1[0], testA1[1], testA1[2]) || 1;
            let nA1 = [testA1[0]/lenA1, testA1[1]/lenA1, testA1[2]/lenA1];

            let rA1 = playerFeetRad;
            if (typeof getFloorTopRadiusAt === "function") {
              const fRad = getFloorTopRadiusAt(nA1[0], nA1[1], nA1[2], playerFeetRad);
              if (fRad > -Infinity && Math.abs(fRad - playerFeetRad) < 0.4) {
                rA1 = fRad;
              }
            } else if (!isPlayerUnderground) {
              const tA1 = Math.acos(Math.max(-1.0, Math.min(1.0, nA1[1])));
              const phiA1 = Math.atan2(nA1[2], nA1[0]);
              rA1 = RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(tA1, phiA1, seedVal) : 0) * HEIGHT_SCALE;
            } else if (typeof getTerrainSurfaceAndCeiling === "function") {
              const cData = getTerrainSurfaceAndCeiling(nA1[0], nA1[1], nA1[2], playerFeetRad);
              if (cData && cData.insideTunnel && cData.ground < pSurfRad - 0.15) {
                rA1 = cData.ground;
              }
            }
            const P_anchor1 = [nA1[0] * rA1, nA1[1] * rA1, nA1[2] * rA1];

            // Helper to test if a 3D point is submerged in water
            const wRadius = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel : 0) * 0.15;
            function isPointInWater(pt) {
              if (typeof waterEnabled === "undefined" || !waterEnabled) return false;
              if (isPlayerUnderground) return false;
              const r = Math.hypot(pt[0], pt[1], pt[2]);
              return (r <= wRadius + 0.02);
            }

            // Helper to query solid surface radius at a unit normal direction
            function getSolidRadAt(nVec, approxR) {
              if (typeof getFloorTopRadiusAt === "function") {
                const fR = getFloorTopRadiusAt(nVec[0], nVec[1], nVec[2], approxR);
                if (fR > -Infinity) return fR;
              }
              const th = Math.acos(Math.max(-1.0, Math.min(1.0, nVec[1])));
              const ph = Math.atan2(nVec[2], nVec[0]);
              const sH = typeof getHeightOnSphere === "function" ? getHeightOnSphere(th, ph, seedVal) : 0;
              const sR = RADIUS + sH * HEIGHT_SCALE;

              if (typeof tunnels3D !== "undefined" && tunnels3D && tunnels3D.length > 0) {
                for (let ti = 0; ti < tunnels3D.length; ti++) {
                  const t = tunnels3D[ti];
                  const testP = [nVec[0] * approxR, nVec[1] * approxR, nVec[2] * approxR];
                  const dx = testP[0] - t.x, dy = testP[1] - t.y, dz = testP[2] - t.z;
                  if (dx*dx + dy*dy + dz*dz < (t.r * 2.5)*(t.r * 2.5)) {
                    const dot = nVec[0]*t.x + nVec[1]*t.y + nVec[2]*t.z;
                    const tSq = t.x*t.x + t.y*t.y + t.z*t.z;
                    const dSq = dot*dot - tSq + t.r*t.r*0.96;
                    if (dSq > 0) {
                      const cFloor = dot - Math.sqrt(dSq);
                      if (cFloor < sR - 0.2) {
                        return cFloor;
                      }
                    }
                  }
                }
              }
              return sR;
            }

            // 3. Probing for Anchor 2 (Landing end) with Fast Directional Raymarching & Transform Caching
            const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            const cache = floorPreviewCollectible._ladderCache;
            const timeDiff = cache ? (nowTime - (cache.time || 0)) : 999;
            const movedDist = cache ? Math.hypot(playerFeetPos[0]-cache.px, playerFeetPos[1]-cache.py, playerFeetPos[2]-cache.pz) : 999;
            const rotDiff = cache ? (Math.abs(charHeading - cache.heading) + Math.abs(camPitch - cache.pitch) + Math.abs(rotA - cache.rotA)) : 999;

            let P_anchor2 = null;
            let isValid = false;

            if (cache && ((timeDiff < 60 && movedDist < 0.12 && rotDiff < 0.12) || (movedDist < 0.04 && rotDiff < 0.04))) {
              P_anchor2 = cache.P_anchor2;
              isValid = cache.isValid;
            } else {
              const candidates = [];

              // Case A: DOWNWARD RAYS (Descent into hole, cave mouth, cliff face, ravine, steep drop)
              if (!isLookingUp) {
                const downAnglesDeg = isLookingDown ? [30, 58, 80] : [36, 65];
                for (let deg of downAnglesDeg) {
                  const rad = deg * (Math.PI / 180);
                  const dirDown = [
                    ladderF[0] * Math.cos(rad) - pUp[0] * Math.sin(rad),
                    ladderF[1] * Math.cos(rad) - pUp[1] * Math.sin(rad),
                    ladderF[2] * Math.cos(rad) - pUp[2] * Math.sin(rad)
                  ];
                  const lenD = Math.hypot(dirDown[0], dirDown[1], dirDown[2]) || 1;
                  dirDown[0] /= lenD; dirDown[1] /= lenD; dirDown[2] /= lenD;

                  let prevPt = [
                    P_anchor1[0] + dirDown[0] * 0.45,
                    P_anchor1[1] + dirDown[1] * 0.45,
                    P_anchor1[2] + dirDown[2] * 0.45
                  ];
                  let prevDens = -1.0;

                  // 6 lightweight steps (0.6m to 3.2m) with skipNoise=true
                  for (let st = 1; st <= 6; st++) {
                    const distT = 0.6 + (st - 1) * 0.52;
                    const pMarch = [
                      P_anchor1[0] + dirDown[0] * distT,
                      P_anchor1[1] + dirDown[1] * distT,
                      P_anchor1[2] + dirDown[2] * distT
                    ];
                    let dens = 0;
                    if (typeof getTerrainDensity === "function") {
                      dens = getTerrainDensity(pMarch[0], pMarch[1], pMarch[2], true);
                    } else {
                      const mR = Math.hypot(pMarch[0], pMarch[1], pMarch[2]);
                      const mN = [pMarch[0]/mR, pMarch[1]/mR, pMarch[2]/mR];
                      const sR = getSolidRadAt(mN, mR);
                      dens = sR - mR;
                    }

                    if (prevDens < 0.01 && dens >= 0.0) {
                      let pA = prevPt || P_anchor1;
                      let pB = pMarch;
                      for (let bi = 0; bi < 2; bi++) {
                        const pMid = [(pA[0]+pB[0])*0.5, (pA[1]+pB[1])*0.5, (pA[2]+pB[2])*0.5];
                        const dMid = (typeof getTerrainDensity === "function")
                          ? getTerrainDensity(pMid[0], pMid[1], pMid[2], true)
                          : (getSolidRadAt([pMid[0]/Math.hypot(pMid[0],pMid[1],pMid[2]), pMid[1]/Math.hypot(pMid[0],pMid[1],pMid[2]), pMid[2]/Math.hypot(pMid[0],pMid[1],pMid[2])], Math.hypot(pMid[0],pMid[1],pMid[2])) - Math.hypot(pMid[0],pMid[1],pMid[2]));
                        if (dMid >= 0) pB = pMid; else pA = pMid;
                      }
                      const hitPt = pB;
                      const hitDist = Math.hypot(hitPt[0]-P_anchor1[0], hitPt[1]-P_anchor1[1], hitPt[2]-P_anchor1[2]);
                      if (hitDist >= 0.85 && hitDist <= 3.5 && !isPointInWater(hitPt)) {
                        const vertDiff = (hitPt[0]-P_anchor1[0])*pUp[0] + (hitPt[1]-P_anchor1[1])*pUp[1] + (hitPt[2]-P_anchor1[2])*pUp[2];
                        candidates.push({
                          point: hitPt,
                          dist: hitDist,
                          type: 'downward',
                          vertDiff: vertDiff,
                          angleDeg: deg
                        });
                        break;
                      }
                    }
                    prevPt = pMarch;
                    prevDens = dens;
                  }
                }
              }

              // Case B: SURFACE / FORWARD SLOPE / BRIDGING RAYS
              const forwardDists = [1.5, 2.3, 3.1];
              for (let d of forwardDists) {
                const hPt = [
                  P_anchor1[0] + ladderF[0] * d,
                  P_anchor1[1] + ladderF[1] * d,
                  P_anchor1[2] + ladderF[2] * d
                ];
                const hLen = Math.hypot(hPt[0], hPt[1], hPt[2]) || 1;
                const hn = [hPt[0]/hLen, hPt[1]/hLen, hPt[2]/hLen];
                const solidRad = getSolidRadAt(hn, hLen);
                const surfacePt = [hn[0] * solidRad, hn[1] * solidRad, hn[2] * solidRad];

                let isSolid = true;
                if (typeof getTerrainDensity === "function") {
                  const dens = getTerrainDensity(surfacePt[0], surfacePt[1], surfacePt[2], true);
                  if (dens < -0.06) isSolid = false;
                }

                if (isSolid && !isPointInWater(surfacePt)) {
                  const sDist = Math.hypot(surfacePt[0]-P_anchor1[0], surfacePt[1]-P_anchor1[1], surfacePt[2]-P_anchor1[2]);
                  if (sDist >= 0.8 && sDist <= 3.5) {
                    const vertDiff = (surfacePt[0]-P_anchor1[0])*pUp[0] + (surfacePt[1]-P_anchor1[1])*pUp[1] + (surfacePt[2]-P_anchor1[2])*pUp[2];
                    candidates.push({
                      point: surfacePt,
                      dist: sDist,
                      type: 'slope',
                      vertDiff: vertDiff
                    });
                  }
                }
              }

              // Case C: UPWARD WALL / CLIFF RAYS (Leaning up against rock, cliff, or high ledge)
              if (!isLookingDown) {
                const upAnglesDeg = isLookingUp ? [30, 60] : [35];
                for (let deg of upAnglesDeg) {
                  const rad = deg * (Math.PI / 180);
                  const dirUp = [
                    ladderF[0] * Math.cos(rad) + pUp[0] * Math.sin(rad),
                    ladderF[1] * Math.cos(rad) + pUp[1] * Math.sin(rad),
                    ladderF[2] * Math.cos(rad) + pUp[2] * Math.sin(rad)
                  ];
                  const lenU = Math.hypot(dirUp[0], dirUp[1], dirUp[2]) || 1;
                  dirUp[0] /= lenU; dirUp[1] /= lenU; dirUp[2] /= lenU;

                  let prevPt = [
                    P_anchor1[0] + dirUp[0] * 0.45,
                    P_anchor1[1] + dirUp[1] * 0.45,
                    P_anchor1[2] + dirUp[2] * 0.45
                  ];
                  let prevDens = -1.0;
                  for (let st = 1; st <= 6; st++) {
                    const distT = 0.6 + (st - 1) * 0.52;
                    const pMarch = [
                      P_anchor1[0] + dirUp[0] * distT,
                      P_anchor1[1] + dirUp[1] * distT,
                      P_anchor1[2] + dirUp[2] * distT
                    ];
                    let dens = -1;
                    if (typeof getTerrainDensity === "function") {
                      dens = getTerrainDensity(pMarch[0], pMarch[1], pMarch[2], true);
                    }
                    if (prevDens < 0.01 && dens >= 0.0) {
                      let pA = prevPt || P_anchor1;
                      let pB = pMarch;
                      for (let bi = 0; bi < 2; bi++) {
                        const pMid = [(pA[0]+pB[0])*0.5, (pA[1]+pB[1])*0.5, (pA[2]+pB[2])*0.5];
                        const dMid = getTerrainDensity(pMid[0], pMid[1], pMid[2], true);
                        if (dMid >= 0) pB = pMid; else pA = pMid;
                      }
                      const hitPt = pB;
                      const hitDist = Math.hypot(hitPt[0]-P_anchor1[0], hitPt[1]-P_anchor1[1], hitPt[2]-P_anchor1[2]);
                      const vertDiff = (hitPt[0]-P_anchor1[0])*pUp[0] + (hitPt[1]-P_anchor1[1])*pUp[1] + (hitPt[2]-P_anchor1[2])*pUp[2];
                      if (hitDist >= 0.85 && hitDist <= 3.5 && vertDiff > 0.25 && !isPointInWater(hitPt)) {
                        candidates.push({
                          point: hitPt,
                          dist: hitDist,
                          type: 'wall',
                          vertDiff: vertDiff,
                          angleDeg: deg
                        });
                        break;
                      }
                    }
                    prevPt = pMarch;
                    prevDens = dens;
                  }
                }
              }

              // Check if terrain in front drops off sharply (cliff edge / hole mouth)
              let isAtCliffEdge = false;
              if (!isLookingUp && typeof getTerrainDensity === "function") {
                const testDropPt = [
                  P_anchor1[0] + ladderF[0] * 0.7 - pUp[0] * 0.35,
                  P_anchor1[1] + ladderF[1] * 0.7 - pUp[1] * 0.35,
                  P_anchor1[2] + ladderF[2] * 0.7 - pUp[2] * 0.35
                ];
                if (getTerrainDensity(testDropPt[0], testDropPt[1], testDropPt[2], true) < -0.05) {
                  isAtCliffEdge = true;
                }
              }

              // Candidate Scoring: Select the most natural landing point
              let bestCandidate = null;
              let bestScore = Infinity;
              const idealDist = 2.2;

              for (let c of candidates) {
                let score = Math.abs(c.dist - idealDist) * 1.5;

                if (c.type === 'downward') {
                  if (isLookingDown) {
                    score -= 10.0 * Math.min(2.0, camPitch * 3.5);
                  } else if (isAtCliffEdge) {
                    score -= 5.0;
                  } else {
                    score += 1.0;
                  }
                } else if (c.type === 'wall') {
                  if (isLookingUp) {
                    score -= 10.0 * Math.min(2.0, -camPitch * 3.5);
                  } else {
                    score -= 2.0;
                  }
                } else if (c.type === 'slope') {
                  if (isLookingDown && isAtCliffEdge) {
                    score += 5.0;
                  } else if (Math.abs(c.vertDiff) < 0.3) {
                    score -= 1.5;
                  }
                }

                if (score < bestScore) {
                  bestScore = score;
                  bestCandidate = c;
                }
              }

              if (bestCandidate) {
                P_anchor2 = bestCandidate.point;
                isValid = true;
              } else {
                // Natural fallback: rests angled downward from the player's feet (NEVER floating in mid-air!)
                const fallbackPitch = isLookingUp ? 0.6 : (isLookingDown ? -0.9 : -0.6);
                const fbDir = [
                  ladderF[0] * Math.cos(fallbackPitch) + pUp[0] * Math.sin(fallbackPitch),
                  ladderF[1] * Math.cos(fallbackPitch) + pUp[1] * Math.sin(fallbackPitch),
                  ladderF[2] * Math.cos(fallbackPitch) + pUp[2] * Math.sin(fallbackPitch)
                ];
                const fbLen = Math.hypot(fbDir[0], fbDir[1], fbDir[2]) || 1;
                P_anchor2 = [
                  P_anchor1[0] + (fbDir[0]/fbLen) * idealDist,
                  P_anchor1[1] + (fbDir[1]/fbLen) * idealDist,
                  P_anchor1[2] + (fbDir[2]/fbLen) * idealDist
                ];
                isValid = false; // Red hologram warning: no solid ground support reached
              }

              floorPreviewCollectible._ladderCache = {
                time: nowTime,
                px: playerFeetPos[0],
                py: playerFeetPos[1],
                pz: playerFeetPos[2],
                heading: charHeading,
                pitch: camPitch,
                rotA: rotA,
                P_anchor2: P_anchor2,
                isValid: isValid
              };
            }

            // Assign P_top and P_bottom by elevation
            const r1 = Math.hypot(P_anchor1[0], P_anchor1[1], P_anchor1[2]);
            const r2 = Math.hypot(P_anchor2[0], P_anchor2[1], P_anchor2[2]);

            let P_top, P_bottom;
            if (r1 >= r2) {
              P_top = P_anchor1;
              P_bottom = P_anchor2;
            } else {
              P_top = P_anchor2;
              P_bottom = P_anchor1;
            }

            targetPos = [
              (P_top[0] + P_bottom[0]) * 0.5,
              (P_top[1] + P_bottom[1]) * 0.5,
              (P_top[2] + P_bottom[2]) * 0.5
            ];

            const dir_v = [P_top[0] - P_bottom[0], P_top[1] - P_bottom[1], P_top[2] - P_bottom[2]];
            const len_v = Math.hypot(dir_v[0], dir_v[1], dir_v[2]) || 1;
            const dir_un = [dir_v[0]/len_v, dir_v[1]/len_v, dir_v[2]/len_v];

            // Lateral rung axis (orthogonal to dir_un)
            let calcR = [
              ladderR[0] - dir_un[0] * (ladderR[0]*dir_un[0] + ladderR[1]*dir_un[1] + ladderR[2]*dir_un[2]),
              ladderR[1] - dir_un[1] * (ladderR[0]*dir_un[0] + ladderR[1]*dir_un[1] + ladderR[2]*dir_un[2]),
              ladderR[2] - dir_un[2] * (ladderR[0]*dir_un[0] + ladderR[1]*dir_un[1] + ladderR[2]*dir_un[2])
            ];
            const lenCalcR = Math.hypot(calcR[0], calcR[1], calcR[2]) || 1;
            calcR = [calcR[0]/lenCalcR, calcR[1]/lenCalcR, calcR[2]/lenCalcR];

            let calcN = [
              dir_un[1]*calcR[2] - dir_un[2]*calcR[1],
              dir_un[2]*calcR[0] - dir_un[0]*calcR[2],
              dir_un[0]*calcR[1] - dir_un[1]*calcR[0]
            ];
            const lenCalcN = Math.hypot(calcN[0], calcN[1], calcN[2]) || 1;
            calcN = [calcN[0]/lenCalcN, calcN[1]/lenCalcN, calcN[2]/lenCalcN];
            if (calcN[0]*pUp[0] + calcN[1]*pUp[1] + calcN[2]*pUp[2] < 0) {
              calcN = [-calcN[0], -calcN[1], -calcN[2]];
              calcR = [-calcR[0], -calcR[1], -calcR[2]];
            }

            floorPreviewCollectible.stairTop = P_top;
            floorPreviewCollectible.stairBottom = P_bottom;
            floorPreviewCollectible.normal = calcN;
            floorPreviewCollectible.R = calcR;
            floorPreviewCollectible.F = dir_un;

            pN = calcN;
            pR = calcR;
            pF = dir_un;
            isSnapped = true;

            const isWater = isPointInWater(P_bottom) || isPointInWater(P_top) || isPlayerInWater;
            floorPreviewCollectible.isValidPlacement = isValid && !isWater;
          } else if (typeToPlace === "wood_boat") {
             floorPreviewCollectible.size = 0.25;
             pN = [pnx, pny, pnz];
             pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
             pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];

             if (isUnderWater) {
               floorPreviewCollectible.isValidPlacement = !isDivingMode;
               targetPos = [
                   pnx * (waterRadius - 0.04),
                   pny * (waterRadius - 0.04),
                   pnz * (waterRadius - 0.04)
               ];
             } else {
               // Land / Ground placement allowed!
               let boatRad = previewGroundRadius + 0.002;

               // Check if sitting on a constructed floor (stone_floor, wood_floor, thin_wood_floor)
               let nearestFloor = null;
               let nearestDist = Infinity;
               for (let other of collectibles) {
                 if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                   const dx = other.position[0] - (pnx * previewGroundRadius);
                   const dy = other.position[1] - (pny * previewGroundRadius);
                   const dz = other.position[2] - (pnz * previewGroundRadius);
                   const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                   if (dist < nearestDist) {
                     nearestDist = dist;
                     nearestFloor = other;
                   }
                 }
               }
               if (nearestFloor && nearestDist < 0.6) {
                 let floorHH = 0;
                 if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                 else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                 else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;
                 const fLen = Math.sqrt(nearestFloor.position[0]**2 + nearestFloor.position[1]**2 + nearestFloor.position[2]**2);
                 if (fLen > 0) {
                   boatRad = Math.max(boatRad, fLen + floorHH / 2 + 0.002);
                 }
               }

               floorPreviewCollectible.isValidPlacement = !isDivingMode && (slopeVal < 1.5);
               targetPos = [
                   pnx * boatRad,
                   pny * boatRad,
                   pnz * boatRad
               ];
             }
          } else if (typeToPlace === "wood_wheel" || typeToPlace === "electric_engine" || typeToPlace === "boat_wing") {
             let nearestBoat = null;
             let bestDist = Infinity;
             for (let other of collectibles) {
               if (other.active && other.type === "wood_boat" && !other.isPreview) {
                 const dx = other.position[0] - targetPos[0];
                 const dy = other.position[1] - targetPos[1];
                 const dz = other.position[2] - targetPos[2];
                 const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                 if (dist < bestDist) {
                   bestDist = dist;
                   nearestBoat = other;
                 }
               }
             }

             if (nearestBoat && bestDist < 0.6) {
               const bP = nearestBoat.position;
               const bN = nearestBoat.normal || [0, 1, 0];
               const bR = nearestBoat.R || [1, 0, 0];
               const bF = nearestBoat.F || [0, 0, 1];

               targetPos = [bP[0], bP[1], bP[2]];
               pN = [bN[0], bN[1], bN[2]];
               pR = [bR[0], bR[1], bR[2]];
               pF = [bF[0], bF[1], bF[2]];
               isSnapped = true;
               floorPreviewCollectible.isValidPlacement = true;
               floorPreviewCollectible.isBoatSnapped = true;
               floorPreviewCollectible.targetBoat = nearestBoat;
               floorPreviewCollectible.size = 0.25;
             } else {
               floorPreviewCollectible.isValidPlacement = false;
               floorPreviewCollectible.isBoatSnapped = false;
               floorPreviewCollectible.size = 0.25;
               pN = [pnx, pny, pnz];
               pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
               pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
             }
          } else if (typeToPlace === "stone_floor") {
            const w = 0.25 * 12.0;
            const d = 0.25 * 12.0;
            const floorH = 0.25 * 0.15;
            
            // --- 0. Snap to nearby stone floors ---
            let nearestStone = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestStone = other;
                    }
                }
            }
            if (nearestStone && nearestDist < 5.0) { // Snap if close
                const sR = nearestStone.R;
                const sF = nearestStone.F;
                const sN = nearestStone.normal;
                const sP = nearestStone.position;
                
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];
                
                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];
                
                let gridX = Math.round(localX / 3.0);
                let gridZ = Math.round(localZ / 3.0);
                
                // Snap to closest adjacent grid
                if (gridX > 1) gridX = 1; if (gridX < -1) gridX = -1;
                if (gridZ > 1) gridZ = 1; if (gridZ < -1) gridZ = -1;
                
                if (Math.abs(gridX) === 1 || Math.abs(gridZ) === 1) {
                    targetPos = [
                        sP[0] + gridX * 3.0 * sR[0] + gridZ * 3.0 * sF[0],
                        sP[1] + gridX * 3.0 * sR[1] + gridZ * 3.0 * sF[1],
                        sP[2] + gridX * 3.0 * sR[2] + gridZ * 3.0 * sF[2]
                    ];
                    floorPreviewCollectible.normal = [sN[0], sN[1], sN[2]];
                    floorPreviewCollectible.R = [sR[0], sR[1], sR[2]];
                    floorPreviewCollectible.F = [sF[0], sF[1], sF[2]];
                    if (nearestStone.angle !== undefined) {
                        floorPreviewCollectible.angle = nearestStone.angle;
                        placementRotationAngle = nearestStone.angle;
                    }
                    isSnapped = true;
                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                }
            }
            
            // Ensure floorPreviewCollectible orientation vectors are updated for current frame
            floorPreviewCollectible.normal = [pN[0], pN[1], pN[2]];
            floorPreviewCollectible.R = [pR[0], pR[1], pR[2]];
            floorPreviewCollectible.F = [pF[0], pF[1], pF[2]];
            
            // Stone floor can be placed anywhere (terrain/slope/trees/rocks do not block it).
            floorPreviewCollectible.isValidPlacement = true;

            // Prevent overlapping with another stone floor placed at the exact same location
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const ox = other.position[0] - targetPos[0];
                    const oy = other.position[1] - targetPos[1];
                    const oz = other.position[2] - targetPos[2];
                    if (ox*ox + oy*oy + oz*oz < 0.2) {
                        floorPreviewCollectible.isValidPlacement = false;
                        break;
                    }
                }
            }
            
            floorPreviewCollectible.size = 0.25;
          } else if (typeToPlace === "wood_floor") {
            // Find nearest stone_floor for grid snapping (Only placeable on stone floors)
            let nearestStone = null;
            let nearestDist = Infinity;
            for (let other of collectibles) {
                if (other.active && other.type === "stone_floor" && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestStone = other;
                    }
                }
            }

            if (nearestStone) {
                const sW = typeof nearestStone.width === "number" ? nearestStone.width : 3.0;
                const sD = typeof nearestStone.depth === "number" ? nearestStone.depth : 3.0;
                const maxReachDist = Math.max(sW, sD) / 2 + 1.5;

                if (nearestDist < maxReachDist) {
                    const sR = nearestStone.R || [1, 0, 0];
                    const sF = nearestStone.F || [0, 0, 1];
                    const sN = nearestStone.normal || [0, 1, 0];
                    const sP = nearestStone.position;

                    // Project targetPos onto stone floor's plane
                    const dx = targetPos[0] - sP[0];
                    const dy = targetPos[1] - sP[1];
                    const dz = targetPos[2] - sP[2];

                    const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                    const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                    // Check if projected point is within the bounds of stone floor
                    const halfW = sW / 2;
                    const halfD = sD / 2;
                    if (Math.abs(localX) <= halfW + 0.15 && Math.abs(localZ) <= halfD + 0.15) {
                        // Snap to 0.3 grid
                        let gridX = Math.round(localX / 0.3);
                        let gridZ = Math.round(localZ / 0.3);

                        const maxGridX = Math.round(halfW / 0.3);
                        const maxGridZ = Math.round(halfD / 0.3);
                        gridX = Math.max(-maxGridX, Math.min(maxGridX, gridX));
                        gridZ = Math.max(-maxGridZ, Math.min(maxGridZ, gridZ));

                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;

                        const sH = nearestStone.size * 0.15; // stone floor height
                        const wH = woodFloorHeight + 0.25 * 0.12;       // wood floor height

                        targetPos = [
                            sP[0] + sR[0] * (gridX * 0.3) + sF[0] * (gridZ * 0.3) + sN[0] * (sH/2 + wH/2),
                            sP[1] + sR[1] * (gridX * 0.3) + sF[1] * (gridZ * 0.3) + sN[1] * (sH/2 + wH/2),
                            sP[2] + sR[2] * (gridX * 0.3) + sF[2] * (gridZ * 0.3) + sN[2] * (sH/2 + wH/2)
                        ];

                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;

                        // Check if another wood_floor is already at this exact snapped position
                        for (let other of collectibles) {
                            if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor") && !other.isPreview) {
                                const ox = other.position[0] - targetPos[0];
                                const oy = other.position[1] - targetPos[1];
                                const oz = other.position[2] - targetPos[2];
                                if (ox*ox + oy*oy + oz*oz < 0.01) {
                                    floorPreviewCollectible.isValidPlacement = false;
                                }
                            }
                        }
                    } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                    }
                } else {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
                }
            } else {
                // No stone floor found nearby or too far
                floorPreviewCollectible.isValidPlacement = false;
                floorPreviewCollectible.size = 0.25;
            }
          } else if (typeToPlace.startsWith("robot_")) {
            let robotSnapFound = false;

            if (typeToPlace === "robot_stand") {
              // Placing Robot Stand -> Snap directly under an unmounted Robot Cockpit
              let nearestCockpit = null;
              let bestCDist = Infinity;
              for (let c of collectibles) {
                if (c.active && !c.isPreview && c.type === "robot_cockpit") {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestCDist) {
                    bestCDist = dist;
                    nearestCockpit = c;
                  }
                }
              }

              if (nearestCockpit && bestCDist < 0.6) {
                const updatedCPos = nearestCockpit.position;
                const cR = nearestCockpit.R || [1, 0, 0];
                const cN = nearestCockpit.normal || nearestCockpit.U || [0, 1, 0];
                const cF = nearestCockpit.F || [0, 0, 1];
                const clampOffsetN = 0.66;
                const clampOffsetF = 0.0;
                targetPos = [
                  updatedCPos[0] - cN[0] * clampOffsetN - cF[0] * clampOffsetF,
                  updatedCPos[1] - cN[1] * clampOffsetN - cF[1] * clampOffsetF,
                  updatedCPos[2] - cN[2] * clampOffsetN - cF[2] * clampOffsetF
                ];
                pN = [cN[0], cN[1], cN[2]];
                pR = [cR[0], cR[1], cR[2]];
                pF = [cF[0], cF[1], cF[2]];
                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            } else if (typeToPlace !== "robot_cockpit") {
              // Placing Leg, Arm, or other Robot Part -> Snap ONLY to Cockpit that is mounted on a Robot Stand
              let nearestCockpit = null;
              let bestCDist = Infinity;
              for (let c of collectibles) {
                if (c.active && !c.isPreview && c.type === "robot_cockpit") {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestCDist) {
                    bestCDist = dist;
                    nearestCockpit = c;
                  }
                }
              }

              // Check if nearestCockpit is mounted on a Robot Stand
              let cockpitOnStand = false;
              if (nearestCockpit && bestCDist < 0.6) {
                for (let s of collectibles) {
                  if (s.active && !s.isPreview && s.type === "robot_stand") {
                    const sdx = s.position[0] - nearestCockpit.position[0];
                    const sdy = s.position[1] - nearestCockpit.position[1];
                    const sdz = s.position[2] - nearestCockpit.position[2];
                    const sdist = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz);
                    if (sdist < 1.2) {
                      cockpitOnStand = true;
                      break;
                    }
                  }
                }
              }

              if (nearestCockpit && bestCDist < 0.6 && cockpitOnStand) {
                const updatedCPos = nearestCockpit.position;
                const cR = nearestCockpit.R || [1, 0, 0];
                const cN = nearestCockpit.normal || nearestCockpit.U || [0, 1, 0];
                const cF = nearestCockpit.F || [0, 0, 1];

                let rOff = 0, nOff = 0, fOff = 0;
                if (typeToPlace === "robot_left_leg") {
                  rOff = -0.030; nOff = -0.5025; fOff = 0.0;
                } else if (typeToPlace === "robot_right_leg") {
                  rOff = 0.030; nOff = -0.5025; fOff = 0.0;
                } else if (typeToPlace === "robot_left_arm") {
                  rOff = -0.1875; nOff = -0.16875; fOff = 0.0;
                } else if (typeToPlace === "robot_right_arm") {
                  rOff = 0.1875; nOff = -0.16875; fOff = 0.0;
                }

                targetPos = [
                  updatedCPos[0] + cR[0]*rOff + cN[0]*nOff + cF[0]*fOff,
                  updatedCPos[1] + cR[1]*rOff + cN[1]*nOff + cF[1]*fOff,
                  updatedCPos[2] + cR[2]*rOff + cN[2]*nOff + cF[2]*fOff
                ];

                pN = [cN[0], cN[1], cN[2]];
                pR = [cR[0], cR[1], cR[2]];
                pF = [cF[0], cF[1], cF[2]];

                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            } else {
              // Placing Cockpit -> Snap ONLY to placed Stand
              let nearestStand = null;
              let bestSDist = Infinity;
              for (let c of collectibles) {
                if (c.active && !c.isPreview && c.type === "robot_stand") {
                  const dx = c.position[0] - targetPos[0];
                  const dy = c.position[1] - targetPos[1];
                  const dz = c.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < bestSDist) {
                    bestSDist = dist;
                    nearestStand = c;
                  }
                }
              }

              if (nearestStand && bestSDist < 0.6) {
                const sPos = nearestStand.position;
                const sR = nearestStand.R || [1, 0, 0];
                const sN = nearestStand.normal || nearestStand.U || [0, 1, 0];
                const sF = nearestStand.F || [0, 0, 1];
                const clampOffsetN = 0.66;
                const clampOffsetF = 0.0;
                targetPos = [
                  sPos[0] + sN[0] * clampOffsetN + sF[0] * clampOffsetF,
                  sPos[1] + sN[1] * clampOffsetN + sF[1] * clampOffsetF,
                  sPos[2] + sN[2] * clampOffsetN + sF[2] * clampOffsetF
                ];
                pN = [sN[0], sN[1], sN[2]];
                pR = [sR[0], sR[1], sR[2]];
                pF = [sF[0], sF[1], sF[2]];
                floorPreviewCollectible.isValidPlacement = true;
                floorPreviewCollectible.size = 0.25;
                isSnapped = true;
                robotSnapFound = true;
              }
            }

            if (!robotSnapFound) {
              if (typeToPlace !== "robot_stand") {
                floorPreviewCollectible.isValidPlacement = false;
                floorPreviewCollectible.size = 0.25;
              } else {
                // Standalone ground/floor placement
                let nearestFloor = null;
                let nearestDist = Infinity;
                for (let other of collectibles) {
                  if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                    const dx = other.position[0] - targetPos[0];
                    const dy = other.position[1] - targetPos[1];
                    const dz = other.position[2] - targetPos[2];
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist < nearestDist) {
                      nearestDist = dist;
                      nearestFloor = other;
                    }
                  }
                }

                if (nearestFloor && nearestDist < 0.6) {
                  const sR = nearestFloor.R || [1, 0, 0];
                  const sF = nearestFloor.F || [0, 0, 1];
                  const sN = nearestFloor.normal || [0, 1, 0];
                  const sP = nearestFloor.position;

                  const dx = targetPos[0] - sP[0];
                  const dy = targetPos[1] - sP[1];
                  const dz = targetPos[2] - sP[2];

                  const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                  const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                  if (Math.abs(localX) <= 0.35 && Math.abs(localZ) <= 0.35) {
                    let gridX = Math.round(localX / 0.15);
                    let gridZ = Math.round(localZ / 0.15);

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    let floorHH = 0;
                    if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                    else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                    else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;

                    let floatOffset = typeToPlace === "robot_cockpit" ? 0.14 : ((typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") ? 0.14 : (typeToPlace === "robot_stand" ? 0.0 : 0.35));

                    targetPos = [
                      sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorHH / 2 + floatOffset),
                      sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorHH / 2 + floatOffset),
                      sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorHH / 2 + floatOffset)
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    isSnapped = true;
                  } else {
                    floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                    floorPreviewCollectible.size = 0.25;
                  }
                } else {
                  floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                  floorPreviewCollectible.size = 0.25;
                }
              }
            }
          } else if (typeToPlace === "wood_roof") {
            floorPreviewCollectible.size = 0.25;
            floorPreviewCollectible.isValidPlacement = false;

            const curAngle = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : (floorPreviewCollectible.angle || 0.0);

            // Compute camera eye position and look direction for true 3D crosshair line-of-sight snapping
            let eyePos = null;
            let lookDir = null;
            if (typeof window !== "undefined" && window.cameraSpringArm && window.cameraSpringArm.eyePos && window.cameraSpringArm.targetPos) {
              eyePos = window.cameraSpringArm.eyePos;
              const tP = window.cameraSpringArm.targetPos;
              const ldx = tP[0] - eyePos[0];
              const ldy = tP[1] - eyePos[1];
              const ldz = tP[2] - eyePos[2];
              const lLen = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz);
              if (lLen > 0.0001) {
                lookDir = [ldx / lLen, ldy / lLen, ldz / lLen];
              }
            }
            if (!eyePos || !lookDir) {
              eyePos = [playerPt[0] + (pN ? pN[0] * 0.2 : 0), playerPt[1] + (pN ? pN[1] * 0.2 : 0), playerPt[2] + (pN ? pN[2] * 0.2 : 0)];
              lookDir = pF || [0, 0, 1];
            }

            const maxReach = Math.max(6.5, (typeof actionReachDistance === "number" ? actionReachDistance * 4.0 : 6.5));

            // Roofs snap strictly to:
            // 1. Existing roofs (tile-to-tile / แผ่นต่อแผ่น: Slope Up, Slope Down, Left, Right, Ridge Peak, Gutter, Corners)
            // 2. Walls (wood_wall, wood_window, wood_door on top of the wall)

            const candidates = [];

            // 1. ROOF-TO-ROOF CANDIDATES (แผ่นต่อแผ่น)
            for (let other of collectibles) {
              if (other.active && other.type === "wood_roof" && !other.isPreview) {
                const oP = other.position;
                const oR = other.R || [1, 0, 0];
                const oF = other.F || [0, 0, 1];
                const oN = other.normal || [0, 1, 0];
                const oAngle = other.angle || 0.0;

                // Check player reach distance
                const rodx = oP[0] - playerPt[0];
                const rody = oP[1] - playerPt[1];
                const rodz = oP[2] - playerPt[2];
                if (rodx * rodx + rody * rody + rodz * rodz > (maxReach + 1.2) * (maxReach + 1.2)) continue;

                const cosOA = Math.cos(oAngle);
                const sinOA = Math.sin(oAngle);
                const roofR = [
                  oR[0] * cosOA + oF[0] * sinOA,
                  oR[1] * cosOA + oF[1] * sinOA,
                  oR[2] * cosOA + oF[2] * sinOA
                ];
                const roofF = [
                  oF[0] * cosOA - oR[0] * sinOA,
                  oF[1] * cosOA - oR[1] * sinOA,
                  oF[2] * cosOA - oR[2] * sinOA
                ];
                const roofN = oN;

                const addRotatedCandidates = (pos, step, type, baseAngle) => {
                  for (let rotStep = 0; rotStep < 4; rotStep++) {
                    const angle = (baseAngle + rotStep * Math.PI / 2) % (Math.PI * 2);
                    const cosA = Math.cos(angle);
                    const sinA = Math.sin(angle);
                    const wF = [
                      oF[0] * cosA - oR[0] * sinA,
                      oF[1] * cosA - oR[1] * sinA,
                      oF[2] * cosA - oR[2] * sinA
                    ];
                    candidates.push({
                      pos: [pos[0], pos[1], pos[2]],
                      R: oR, F: oF, normal: oN,
                      angle: angle,
                      worldF: wF,
                      step: step,
                      type: type,
                      rotStep: rotStep
                    });
                  }
                };

                // Angle difference between player's held rotation and this existing roof

                // a) Slope Up (+F, height +0.25 per step) -> ต่อลาดขึ้นไปเรื่อยๆ สูงขึ้นไปเรื่อยๆ ทะลุได้
                for (let step = 1; step <= 4; step++) {
                  addRotatedCandidates(
                    [
                      oP[0] + roofF[0] * (0.30 * step) + roofN[0] * (0.25 * step),
                      oP[1] + roofF[1] * (0.30 * step) + roofN[1] * (0.25 * step),
                      oP[2] + roofF[2] * (0.30 * step) + roofN[2] * (0.25 * step)
                    ],
                    step, 'roof_slope_up', oAngle
                  );
                }

                // b) Slope Down (-F, height -0.25 per step) -> ต่อลาดลงมาตามแนวเดิม
                for (let step = 1; step <= 2; step++) {
                  addRotatedCandidates(
                    [
                      oP[0] - roofF[0] * (0.30 * step) - roofN[0] * (0.25 * step),
                      oP[1] - roofF[1] * (0.30 * step) - roofN[1] * (0.25 * step),
                      oP[2] - roofF[2] * (0.30 * step) - roofN[2] * (0.25 * step)
                    ],
                    step, 'roof_slope_down', oAngle
                  );
                }

                // c) Side Extension Left/Right (+/- R) -> ขยายแผ่นข้างตามแนวเดิม
                for (let s of [-1, 1]) {
                  addRotatedCandidates(
                    [
                      oP[0] + roofR[0] * (0.30 * s),
                      oP[1] + roofR[1] * (0.30 * s),
                      oP[2] + roofR[2] * (0.30 * s)
                    ],
                    1, 'roof_side', oAngle
                  );
                }

                // d) A-Frame Ridge Peak (+F, opposing 180 deg angle, height 0.0) -> ประกบจั่วที่ยอด
                const oppAngle = (oAngle + Math.PI) % (Math.PI * 2);
                addRotatedCandidates(
                  [
                    oP[0] + roofF[0] * 0.30,
                    oP[1] + roofF[1] * 0.30,
                    oP[2] + roofF[2] * 0.30
                  ],
                  1, 'roof_peak', oppAngle
                );
              }
            }

            // 2. WALL TOP CANDIDATES (วางบนขอบบนของกำแพง)
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") && !other.isPreview) {
                const wP = other.position;
                const wN = other.normal || [0, 1, 0];

                // Check player reach distance
                const wodx = wP[0] - playerPt[0];
                const wody = wP[1] - playerPt[1];
                const wodz = wP[2] - playerPt[2];
                if (wodx * wodx + wody * wody + wodz * wodz > (maxReach + 1.2) * (maxReach + 1.2)) continue;

                // Check if this wall has another wall directly above it (if so, it is not the top wall of the column)
                let hasWallAbove = false;
                for (let aboveCheck of collectibles) {
                  if (aboveCheck.active && (aboveCheck.type === "wood_wall" || aboveCheck.type === "wood_window" || aboveCheck.type === "wood_door") && !aboveCheck.isPreview && aboveCheck !== other) {
                    const adx = aboveCheck.position[0] - (wP[0] + wN[0] * 0.25);
                    const ady = aboveCheck.position[1] - (wP[1] + wN[1] * 0.25);
                    const adz = aboveCheck.position[2] - (wP[2] + wN[2] * 0.25);
                    if (adx * adx + ady * ady + adz * adz < 0.015) {
                      hasWallAbove = true;
                      break;
                    }
                  }
                }
                if (hasWallAbove) continue; // Only process the top-most wall in each column

                const wallTopCenter = [
                  wP[0] + wN[0] * 0.25,
                  wP[1] + wN[1] * 0.25,
                  wP[2] + wN[2] * 0.25
                ];

                const wR = other.R || [1, 0, 0];
                const wF = other.F || [0, 0, 1];
                const wAngle = other.angle || 0.0;
                const cosWA = Math.cos(wAngle);
                const sinWA = Math.sin(wAngle);
                const wallR_act = [
                  wR[0] * cosWA + wF[0] * sinWA,
                  wR[1] * cosWA + wF[1] * sinWA,
                  wR[2] * cosWA + wF[2] * sinWA
                ];
                const wallF_act = [
                  wF[0] * cosWA - wR[0] * sinWA,
                  wF[1] * cosWA - wR[1] * sinWA,
                  wF[2] * cosWA - wR[2] * sinWA
                ];

                // 4 orthogonal orientations on wall top:
                // 1) Eave on Wall: bottom eave sits flush on wallTopCenter, roof slopes up
                // 2) Ridge on Wall: top ridge sits flush on wallTopCenter, roof slopes down
                for (let rotStep = 0; rotStep < 4; rotStep++) {
                  const a = rotStep * (Math.PI / 2);
                  const cosA = Math.cos(a);
                  const sinA = Math.sin(a);
                  const dirF = [
                    wallF_act[0] * cosA - wallR_act[0] * sinA,
                    wallF_act[1] * cosA - wallR_act[1] * sinA,
                    wallF_act[2] * cosA - wallR_act[2] * sinA
                  ];

                  // 1. Eave on Wall: pos offset horizontally by +dirF * 0.15 so eave (pos - dirF*0.15) == wallTopCenter!
                  // No vertical offset, sits directly on wallTopCenter with zero gap!
                  candidates.push({
                    pos: [
                      wallTopCenter[0] + dirF[0] * 0.15,
                      wallTopCenter[1] + dirF[1] * 0.15,
                      wallTopCenter[2] + dirF[2] * 0.15
                    ],
                    R: wallR_act,
                    F: wallF_act,
                    normal: wN,
                    angle: a,
                    worldF: dirF,
                    rotStep: rotStep,
                    type: 'wall_eave'
                  });

                  // 2. Ridge on Wall: pos offset by -dirF * 0.15 and -wN * 0.25 so ridge (pos + dirF*0.15 + wN*0.25) == wallTopCenter!
                  candidates.push({
                    pos: [
                      wallTopCenter[0] - dirF[0] * 0.15 - wN[0] * 0.25,
                      wallTopCenter[1] - dirF[1] * 0.15 - wN[1] * 0.25,
                      wallTopCenter[2] - dirF[2] * 0.15 - wN[2] * 0.25
                    ],
                    R: wallR_act,
                    F: wallF_act,
                    normal: wN,
                    angle: a,
                    worldF: dirF,
                    rotStep: rotStep,
                    type: 'wall_ridge'
                  });
                }
              }
            }

            // 3. FLOOR CANDIDATES (วางบนพื้น ขอบล่างแนบพื้น 100% ไม่มีช่องว่าง)
            for (let other of collectibles) {
              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                const fP = other.position;
                const fN = other.normal || [0, 1, 0];

                const fodx = fP[0] - playerPt[0];
                const fody = fP[1] - playerPt[1];
                const fodz = fP[2] - playerPt[2];
                if (fodx * fodx + fody * fody + fodz * fodz > (maxReach + 1.2) * (maxReach + 1.2)) continue;

                let floorHH = 0;
                if (other.type === "stone_floor") floorHH = (other.size * 0.15) / 2;
                else if (other.type === "thin_wood_floor") floorHH = (other.size * 0.04) / 2;
                else floorHH = (woodFloorHeight + (other.size || 0.25) * 0.12) / 2;

                const floorTopCenter = [
                  fP[0] + fN[0] * floorHH,
                  fP[1] + fN[1] * floorHH,
                  fP[2] + fN[2] * floorHH
                ];

                const fR = other.R || [1, 0, 0];
                const fF = other.F || [0, 0, 1];
                const fAngle = other.angle || 0.0;
                const cosFA = Math.cos(fAngle);
                const sinFA = Math.sin(fAngle);
                const floorR_act = [
                  fR[0] * cosFA + fF[0] * sinFA,
                  fR[1] * cosFA + fF[1] * sinFA,
                  fR[2] * cosFA + fF[2] * sinFA
                ];
                const floorF_act = [
                  fF[0] * cosFA - fR[0] * sinFA,
                  fF[1] * cosFA - fR[1] * sinFA,
                  fF[2] * cosFA - fR[2] * sinFA
                ];

                for (let rotStep = 0; rotStep < 4; rotStep++) {
                  const a = rotStep * (Math.PI / 2);
                  const cosA = Math.cos(a);
                  const sinA = Math.sin(a);
                  const dirF = [
                    floorF_act[0] * cosA - floorR_act[0] * sinA,
                    floorF_act[1] * cosA - floorR_act[1] * sinA,
                    floorF_act[2] * cosA - floorR_act[2] * sinA
                  ];

                  candidates.push({
                    pos: [
                      floorTopCenter[0],
                      floorTopCenter[1],
                      floorTopCenter[2]
                    ],
                    R: floorR_act,
                    F: floorF_act,
                    normal: fN,
                    angle: a,
                    worldF: dirF,
                    rotStep: rotStep,
                    type: 'floor'
                  });
                }
              }
            }

            // Filter out candidates that are already occupied by an identical roof (same pos AND same direction)
            // Piercing / opposing / intersecting roofs are ALLOWED!
            const nonOccupiedCandidates = [];
            for (let cand of candidates) {
              let isOccupied = false;
              const cWF = cand.worldF;
              for (let other of collectibles) {
                if (other.active && other.type === "wood_roof" && !other.isPreview) {
                  const dx = other.position[0] - cand.pos[0];
                  const dy = other.position[1] - cand.pos[1];
                  const dz = other.position[2] - cand.pos[2];
                  const distSq = dx * dx + dy * dy + dz * dz;

                  if (distSq < 0.008) {
                    const oAngle = other.angle || 0.0;
                    const cosO = Math.cos(oAngle);
                    const sinO = Math.sin(oAngle);
                    const oR = other.R || [1, 0, 0];
                    const oF = other.F || [0, 0, 1];
                    const oWF = [
                      oF[0] * cosO - oR[0] * sinO,
                      oF[1] * cosO - oR[1] * sinO,
                      oF[2] * cosO - oR[2] * sinO
                    ];
                    const dotF = cWF[0] * oWF[0] + cWF[1] * oWF[1] + cWF[2] * oWF[2];
                    // Only occupied if already filled by a roof facing the exact same direction
                    if (dotF > 0.8) {
                      isOccupied = true;
                      break;
                    }
                  }
                }
              }
              if (!isOccupied) {
                nonOccupiedCandidates.push(cand);
              }
            }

            // Score candidates based on camera crosshair line-of-sight & reach
            const currentQRotStep = Math.round(((curAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4;

            const validCandidates = [];
            for (let cand of nonOccupiedCandidates) {
              const pdx = cand.pos[0] - playerPt[0];
              const pdy = cand.pos[1] - playerPt[1];
              const pdz = cand.pos[2] - playerPt[2];
              const pDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
              if (pDist > maxReach) continue;

              const vx = cand.pos[0] - eyePos[0];
              const vy = cand.pos[1] - eyePos[1];
              const vz = cand.pos[2] - eyePos[2];
              const proj = vx * lookDir[0] + vy * lookDir[1] + vz * lookDir[2];

              if (proj > 0.05) {
                const closeX = eyePos[0] + lookDir[0] * proj;
                const closeY = eyePos[1] + lookDir[1] * proj;
                const closeZ = eyePos[2] + lookDir[2] * proj;
                const rayDist = Math.sqrt((cand.pos[0] - closeX)**2 + (cand.pos[1] - closeY)**2 + (cand.pos[2] - closeZ)**2);
                const angularDist = rayDist / (proj * 0.6 + 0.4);

                if (rayDist <= 2.2 || angularDist <= 0.8) {
                  // Type prioritization: step 1 slope-up and lateral extension take natural priority
                  let typeBonus = 1.0;
                  
                  if (cand.rotStep !== undefined) {
                    const rotDiff = Math.abs(cand.rotStep - currentQRotStep);
                    const minRotDiff = Math.min(rotDiff, 4 - rotDiff);
                    if (minRotDiff !== 0) continue;
                  }

                  if (cand.type === 'roof_slope_up') {
                    typeBonus = 0.5 + (cand.step || 1) * 0.15; // Closer slope steps take priority
                  } else if (cand.type === 'roof_side') {
                    typeBonus = 0.65;
                  } else if (cand.type === 'roof_slope_down') {
                    typeBonus = 0.75 + (cand.step || 1) * 0.2;
                  } else if (cand.type === 'roof_peak') {
                    typeBonus = 0.8;
                  } else if (cand.type.startsWith('wall') || cand.type === 'floor') {
                    const roleBonus = (cand.type === 'wall_eave') ? 1.0 : (cand.type === 'floor' ? 1.1 : 1.25);
                    typeBonus = 0.8 * roleBonus;
                  }

                  const score = (angularDist * 2.5 + (pDist / maxReach) * 0.5) * typeBonus;
                  validCandidates.push({
                    ...cand,
                    score,
                    rayDist,
                    pDist
                  });
                }
              }
            }

            // Fallback: If camera ray didn't hit within angular threshold, check distance to targetPos
            if (validCandidates.length === 0) {
              for (let cand of nonOccupiedCandidates) {
                const cdx = targetPos[0] - cand.pos[0];
                const cdy = targetPos[1] - cand.pos[1];
                const cdz = targetPos[2] - cand.pos[2];
                const dist = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz);
                if (dist < 1.4) {
                  if (cand.rotStep !== undefined) {
                    const rotDiff = Math.abs(cand.rotStep - currentQRotStep);
                    const minRotDiff = Math.min(rotDiff, 4 - rotDiff);
                    if (minRotDiff !== 0) continue;
                  }
                  
                  let typeBonus = 1.0;
                  if (cand.type.startsWith('wall') || cand.type === 'floor') {
                    typeBonus = 1.0;
                  }
                  validCandidates.push({
                    ...cand,
                    score: dist * 2.0 * typeBonus,
                    rayDist: dist,
                    pDist: dist
                  });
                }
              }
            }

            // Find best candidate with lowest score
            let bestCand = null;
            let bestScore = Infinity;
            for (let c of validCandidates) {
              if (c.score < bestScore) {
                bestScore = c.score;
                bestCand = c;
              }
            }

            // Snap if a valid candidate slot on wall or roof was selected
            if (bestCand) {
              targetPos = [bestCand.pos[0], bestCand.pos[1], bestCand.pos[2]];
              pN = [bestCand.normal[0], bestCand.normal[1], bestCand.normal[2]];
              pR = [bestCand.R[0], bestCand.R[1], bestCand.R[2]];
              pF = [bestCand.F[0], bestCand.F[1], bestCand.F[2]];
              floorPreviewCollectible.angle = bestCand.angle;
              isSnapped = true;
              floorPreviewCollectible.isValidPlacement = true;
            } else {
              isSnapped = false;
              floorPreviewCollectible.isValidPlacement = false;
            }

            // Final duplicate collision check: only reject if duplicate roof facing identical direction exists
            if (isSnapped && floorPreviewCollectible.isValidPlacement) {
              const curCos = Math.cos(floorPreviewCollectible.angle);
              const curSin = Math.sin(floorPreviewCollectible.angle);
              const curWF = [
                pF[0] * curCos - pR[0] * curSin,
                pF[1] * curCos - pR[1] * curSin,
                pF[2] * curCos - pR[2] * curSin
              ];

              for (let other of collectibles) {
                if (other.active && other.type === "wood_roof" && !other.isPreview) {
                  const ox = other.position[0] - targetPos[0];
                  const oy = other.position[1] - targetPos[1];
                  const oz = other.position[2] - targetPos[2];
                  const distSq = ox * ox + oy * oy + oz * oz;

                  if (distSq < 0.008) {
                    const oAngle = other.angle || 0.0;
                    const cosO = Math.cos(oAngle);
                    const sinO = Math.sin(oAngle);
                    const oR = other.R || [1, 0, 0];
                    const oF = other.F || [0, 0, 1];
                    const oWF = [
                      oF[0] * cosO - oR[0] * sinO,
                      oF[1] * cosO - oR[1] * sinO,
                      oF[2] * cosO - oR[2] * sinO
                    ];
                    const dot = curWF[0] * oWF[0] + curWF[1] * oWF[1] + curWF[2] * oWF[2];

                    if (dot > 0.8) {
                      floorPreviewCollectible.isValidPlacement = false;
                      break;
                    }
                  }
                }
              }
            }
          } else if (typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door" || typeToPlace === "thin_wood_floor" || typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") {
            // Direct wall snap for wood_window and wood_door
            if (typeToPlace === "wood_window" || typeToPlace === "wood_door") {
              let nearestWall = null;
              let nearestWallDist = Infinity;
              for (let other of collectibles) {
                if (other.active && other.type === "wood_wall" && !other.isPreview) {
                  const dx = other.position[0] - targetPos[0];
                  const dy = other.position[1] - targetPos[1];
                  const dz = other.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  if (dist < nearestWallDist && dist < 2.0) {
                    nearestWallDist = dist;
                    nearestWall = other;
                  }
                }
              }

              if (nearestWall) {
                let hasFixture = false;
                for (let other of collectibles) {
                  if (other.active && (other.type === "wood_window" || other.type === "wood_door") && !other.isPreview) {
                    const ox = other.position[0] - nearestWall.position[0];
                    const oy = other.position[1] - nearestWall.position[1];
                    const oz = other.position[2] - nearestWall.position[2];
                    if (ox * ox + oy * oy + oz * oz < 0.02) {
                      hasFixture = true;
                      break;
                    }
                  }
                }

                floorPreviewCollectible.isValidPlacement = !hasFixture;
                floorPreviewCollectible.size = 0.25;

                targetPos = [
                  nearestWall.position[0],
                  nearestWall.position[1],
                  nearestWall.position[2]
                ];

                pN = [nearestWall.normal[0], nearestWall.normal[1], nearestWall.normal[2]];
                pR = [nearestWall.R[0], nearestWall.R[1], nearestWall.R[2]];
                pF = [nearestWall.F[0], nearestWall.F[1], nearestWall.F[2]];

                const baseAngle = (nearestWall.angle !== undefined) ? nearestWall.angle : 0.0;
                const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                const flipAngle = Math.round(rotQ / Math.PI) * Math.PI;
                floorPreviewCollectible.angle = baseAngle + flipAngle;
                isSnapped = true;
              }
            }

            // Find nearest wood_floor for grid snapping (Only placeable on wood floors)
            let nearestFloor = null;
            let nearestDist = Infinity;
            if (!isSnapped) {
              for (let other of collectibles) {
                if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor") && !other.isPreview) {
                  const dx = other.position[0] - targetPos[0];
                  const dy = other.position[1] - targetPos[1];
                  const dz = other.position[2] - targetPos[2];
                  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestFloor = other;
                  }
                }
              }
            }

            const maxFloorDist = (typeToPlace === "thin_wood_floor" || typeToPlace === "wood_wall" || typeToPlace === "wood_window" || typeToPlace === "wood_door") ? 2.5 : 0.6;
            if (nearestFloor && nearestDist < maxFloorDist) {
                const sR = nearestFloor.R || [1, 0, 0];
                const sF = nearestFloor.F || [0, 0, 1];
                const sN = nearestFloor.normal || [0, 1, 0];
                const sP = nearestFloor.position;

                // Project targetPos onto wood floor plane
                const dx = targetPos[0] - sP[0];
                const dy = targetPos[1] - sP[1];
                const dz = targetPos[2] - sP[2];

                const localX = dx * sR[0] + dy * sR[1] + dz * sR[2];
                const localZ = dx * sF[0] + dy * sF[1] + dz * sF[2];

                // If within expanded wood_floor bounds (generous snapping)
                let snapBound = (typeToPlace === "thin_wood_floor" && (nearestFloor.type === "thin_wood_floor" || nearestFloor.type === "wood_floor")) ? 0.65 : 0.35;
                if (Math.abs(localX) <= snapBound && Math.abs(localZ) <= snapBound) {
                    // Snap localX and localZ to 0.15 grid (-0.15, 0.0, 0.15)
                    let gridX = Math.round(localX / 0.15);
                    let gridZ = Math.round(localZ / 0.15);

                    // Prevent center and corner placement for walls to avoid overlapping side-by-side, unless placing on thin_wood_floor which allows center placement, or if placing thin_wood_floor itself.
                    if (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace.startsWith("robot_")) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;

                        let floorHH = 0;
                        if (nearestFloor.type === "stone_floor") floorHH = nearestFloor.size * 0.15;
                        else if (nearestFloor.type === "wood_floor") floorHH = woodFloorHeight + nearestFloor.size * 0.12;
                        else if (nearestFloor.type === "thin_wood_floor") floorHH = nearestFloor.size * 0.04;

                        let floatOffset = 0;
                        if (typeToPlace === "robot_cockpit") floatOffset = 0.14;
                        else if (typeToPlace === "robot_left_leg" || typeToPlace === "robot_right_leg") floatOffset = 0.14;
                        else if (typeToPlace === "robot_stand") floatOffset = 0.0;
                        else if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") floatOffset = 0.002;
                        else if (typeToPlace.startsWith("robot_")) floatOffset = 0.35;
                        targetPos = [
                            sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorHH / 2 + floatOffset),
                            sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorHH / 2 + floatOffset),
                            sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorHH / 2 + floatOffset)
                        ];

                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                    } else {
                        if (gridX === 0 && gridZ === 0) {
                        if (nearestFloor.type !== "thin_wood_floor" && typeToPlace !== "thin_wood_floor") {
                            if (Math.abs(localX) > Math.abs(localZ)) {
                                gridX = localX > 0 ? 1 : -1;
                            } else {
                                gridZ = localZ > 0 ? 1 : -1;
                            }
            }
          } else {
                        if (typeToPlace === "thin_wood_floor") {
                            // Thin wood floor must align with full tiles (0 or +/-2)
                            gridX = Math.round(gridX / 2) * 2;
                            gridZ = Math.round(gridZ / 2) * 2;
                            gridX = Math.max(-2, Math.min(2, gridX));
                            gridZ = Math.max(-2, Math.min(2, gridZ));
                        } else {
                            gridX = Math.max(-1, Math.min(1, gridX));
                            gridZ = Math.max(-1, Math.min(1, gridZ));
                        }
                        
                        if (Math.abs(gridX) >= 1 && Math.abs(gridZ) >= 1) {
                            if (Math.abs(localX) > Math.abs(localZ)) {
                                gridZ = 0;
                            } else {
                                gridX = 0;
                            }
                        }
                    }

                    floorPreviewCollectible.isValidPlacement = true;
                    floorPreviewCollectible.size = 0.25;

                    const floorThickness = (typeof window !== "undefined" && window.getFloorThickness) 
                      ? window.getFloorThickness(nearestFloor) 
                      : (nearestFloor.type === "stone_floor" 
                        ? (nearestFloor.size || 0.25) * 0.15 
                        : (nearestFloor.type === "thin_wood_floor" 
                          ? (nearestFloor.size || 0.25) * 0.04 
                          : ((typeof window !== "undefined" && window.woodFloorHeight !== undefined ? window.woodFloorHeight : 0.05) + (nearestFloor.size || 0.25) * 0.12)));
                    const floorTopOffset = floorThickness / 2;

                    // Center the wall relative to the floor plane but offset up on the floor normal
                    targetPos = [
                        sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * floorTopOffset,
                        sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * floorTopOffset,
                        sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * floorTopOffset
                    ];

                    pN = [sN[0], sN[1], sN[2]];
                    pR = [sR[0], sR[1], sR[2]];
                    pF = [sF[0], sF[1], sF[2]];
                    floorPreviewCollectible.angle = (gridX !== 0) ? Math.PI / 2 : 0.0;
                    isSnapped = true;

                    // Clean column structures collection
                    const columnStructures = [];
                    
                    for (let other of collectibles) {
                      if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door" || other.type === "thin_wood_floor") && !other.isPreview) {
                        const odx = other.position[0] - sP[0];
                        const ody = other.position[1] - sP[1];
                        const odz = other.position[2] - sP[2];
                        
                        const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                        const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                        const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                        
                        if (Math.abs(olX) <= 0.35 && Math.abs(olZ) <= 0.35) {
                          const ogX = Math.round(olX / 0.15);
                          const ogZ = Math.round(olZ / 0.15);
                          if (ogX === gridX && ogZ === gridZ) {
                            const oLevel = Math.round((olN - floorTopOffset) / 0.25);
                            columnStructures.push({
                              type: other.type,
                              level: oLevel,
                              item: other
                            });
                          }
                        }
                      }
                    }

                    if (typeToPlace === "wood_wall") {
                      // Stacking: find first level >= 0 that does NOT have a wood_wall, wood_window, or wood_door
                      let targetLevel = 0;
                      while (true) {
                        const hasWallAtLevel = columnStructures.some(s => (s.type === "wood_wall" || s.type === "wood_window" || s.type === "wood_door") && s.level === targetLevel);
                        if (!hasWallAtLevel) {
                          break;
                        }
                        targetLevel++;
                      }

                      if (targetLevel < 10) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorTopOffset + targetLevel * 0.25),
                          sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorTopOffset + targetLevel * 0.25),
                          sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorTopOffset + targetLevel * 0.25)
                        ];
                        
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];

                        const lowerWall = columnStructures.find(s => (s.type === "wood_wall" || s.type === "wood_window" || s.type === "wood_door") && s.level === targetLevel - 1);
                        if (lowerWall && lowerWall.item && lowerWall.item.angle !== undefined) {
                          floorPreviewCollectible.angle = lowerWall.item.angle;
                        } else {
                          floorPreviewCollectible.angle = (gridX !== 0) ? Math.PI / 2 : 0.0;
                        }

                        isSnapped = true;
                      } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                      }
                    } else if (typeToPlace === "thin_wood_floor") {
                      // Floor grid coordinates (multiples of 2 for 0.15 grid = 0.3 steps)
                      let fgX = Math.round(localX / 0.3) * 2;
                      let fgZ = Math.round(localZ / 0.3) * 2;
                      
                      // Find if there's a wall under this fgX, fgZ
                      let maxWallLevel = -1;
                      
                      for (let other of collectibles) {
                          if (other.active && (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") && !other.isPreview) {
                              const odx = other.position[0] - sP[0];
                              const ody = other.position[1] - sP[1];
                              const odz = other.position[2] - sP[2];
                              
                              const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                              const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                              const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];
                              
                              const ogX = Math.round(olX / 0.15);
                              const ogZ = Math.round(olZ / 0.15);
                              
                              // Check if this wall is on the edge of our fgX, fgZ floor tile
                              if ((ogX === fgX - 1 && ogZ === fgZ) ||
                                  (ogX === fgX + 1 && ogZ === fgZ) ||
                                  (ogX === fgX && ogZ === fgZ - 1) ||
                                  (ogX === fgX && ogZ === fgZ + 1) ||
                                  (ogX === fgX && ogZ === fgZ)) {
                                  
                                  const oLevel = Math.round((olN - floorTopOffset) / 0.25);
                                  if (oLevel > maxWallLevel) maxWallLevel = oLevel;
                              }
                          }
                      }
                      
                      if (maxWallLevel >= 0) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        // Centered on full floor grid, elevated to top of wall
                        const targetLevel = maxWallLevel + 1;
                        targetPos = [
                          sP[0] + sR[0] * (fgX * 0.15) + sF[0] * (fgZ * 0.15) + sN[0] * (floorTopOffset + targetLevel * 0.25),
                          sP[1] + sR[1] * (fgX * 0.15) + sF[1] * (fgZ * 0.15) + sN[1] * (floorTopOffset + targetLevel * 0.25),
                          sP[2] + sR[2] * (fgX * 0.15) + sF[2] * (fgZ * 0.15) + sN[2] * (floorTopOffset + targetLevel * 0.25)
                        ];
                        pN = [sN[0], sN[1], sN[2]];
                        pR = [sR[0], sR[1], sR[2]];
                        pF = [sF[0], sF[1], sF[2]];
                        isSnapped = true;
                      } else {
                        // Allow extending horizontally from an adjacent thin_wood_floor or wood_roof
                        let adjacentThinFloor = null;
                        for (let other of collectibles) {
                          if (other.active && (other.type === "thin_wood_floor" || other.type === "wood_roof") && !other.isPreview) {
                             const odx = other.position[0] - sP[0];
                             const ody = other.position[1] - sP[1];
                             const odz = other.position[2] - sP[2];
                             const olX = odx * sR[0] + ody * sR[1] + odz * sR[2];
                             const olZ = odx * sF[0] + ody * sF[1] + odz * sF[2];
                             const ogX = Math.round(olX / 0.15);
                             const ogZ = Math.round(olZ / 0.15);
                             
                             if ((ogX === fgX - 2 && ogZ === fgZ) ||
                                 (ogX === fgX + 2 && ogZ === fgZ) ||
                                 (ogX === fgX && ogZ === fgZ - 2) ||
                                 (ogX === fgX && ogZ === fgZ + 2) ||
                                 (ogX === fgX && ogZ === fgZ)) {
                                 adjacentThinFloor = other;
                                 break;
                             }
                          }
                        }
                        
                        if (adjacentThinFloor) {
                            floorPreviewCollectible.isValidPlacement = true;
                            floorPreviewCollectible.size = 0.25;
                            
                            const odx = adjacentThinFloor.position[0] - sP[0];
                            const ody = adjacentThinFloor.position[1] - sP[1];
                            const odz = adjacentThinFloor.position[2] - sP[2];
                            const olN = odx * sN[0] + ody * sN[1] + odz * sN[2];

                            targetPos = [
                              sP[0] + sR[0] * (fgX * 0.15) + sF[0] * (fgZ * 0.15) + sN[0] * olN,
                              sP[1] + sR[1] * (fgX * 0.15) + sF[1] * (fgZ * 0.15) + sN[1] * olN,
                              sP[2] + sR[2] * (fgX * 0.15) + sF[2] * (fgZ * 0.15) + sN[2] * olN
                            ];
                            pN = [sN[0], sN[1], sN[2]];
                            pR = [sR[0], sR[1], sR[2]];
                            pF = [sF[0], sF[1], sF[2]];
                            isSnapped = true;
                            
                            // Check if another floor is already here
                            for (let other of collectibles) {
                              if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor") && !other.isPreview) {
                                  const ox = other.position[0] - targetPos[0];
                                  const oy = other.position[1] - targetPos[1];
                                  const oz = other.position[2] - targetPos[2];
                                  if (ox*ox + oy*oy + oz*oz < 0.005) {
                                      floorPreviewCollectible.isValidPlacement = false;
                                  }
                              }
                            }
                        } else {
                            floorPreviewCollectible.isValidPlacement = false;
                        }
                      }
                    } else {
                      // For wood_window or wood_door: must co-locate with a wood_wall at the targeted aim level
                      const localN = dx * sN[0] + dy * sN[1] + dz * sN[2];
                      const aimLevel = Math.max(0, Math.round((localN - floorTopOffset) / 0.25));
                      
                      const targetWall = columnStructures.find(s => s.type === "wood_wall" && s.level === aimLevel);
                      const hasFixtureAtAimLevel = columnStructures.some(s => (s.type === "wood_window" || s.type === "wood_door") && s.level === aimLevel);
                      
                      if (targetWall && !hasFixtureAtAimLevel) {
                        floorPreviewCollectible.isValidPlacement = true;
                        floorPreviewCollectible.size = 0.25;
                        
                        targetPos = [
                          targetWall.item.position[0],
                          targetWall.item.position[1],
                          targetWall.item.position[2]
                        ];
                        
                        pN = [targetWall.item.normal[0], targetWall.item.normal[1], targetWall.item.normal[2]];
                        pR = [targetWall.item.R[0], targetWall.item.R[1], targetWall.item.R[2]];
                        pF = [targetWall.item.F[0], targetWall.item.F[1], targetWall.item.F[2]];
                        const baseAngle = (targetWall.item.angle !== undefined) ? targetWall.item.angle : 0.0;
                        const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                        const flipAngle = Math.round(rotQ / Math.PI) * Math.PI;
                        floorPreviewCollectible.angle = baseAngle + flipAngle;
                        isSnapped = true;
                      } else {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                        
                        if (targetWall) {
                          targetPos = [
                            targetWall.item.position[0],
                            targetWall.item.position[1],
                            targetWall.item.position[2]
                          ];
                          pN = [targetWall.item.normal[0], targetWall.item.normal[1], targetWall.item.normal[2]];
                          pR = [targetWall.item.R[0], targetWall.item.R[1], targetWall.item.R[2]];
                          pF = [targetWall.item.F[0], targetWall.item.F[1], targetWall.item.F[2]];
                          const baseAngle = (targetWall.item.angle !== undefined) ? targetWall.item.angle : 0.0;
                          const rotQ = (typeof placementRotationAngle !== "undefined") ? placementRotationAngle : 0.0;
                          const flipAngle = Math.round(rotQ / Math.PI) * Math.PI;
                          floorPreviewCollectible.angle = baseAngle + flipAngle;
                        } else {
                          targetPos = [
                            sP[0] + sR[0] * (gridX * 0.15) + sF[0] * (gridZ * 0.15) + sN[0] * (floorTopOffset + aimLevel * 0.25),
                            sP[1] + sR[1] * (gridX * 0.15) + sF[1] * (gridZ * 0.15) + sN[1] * (floorTopOffset + aimLevel * 0.25),
                            sP[2] + sR[2] * (gridX * 0.15) + sF[2] * (gridZ * 0.15) + sN[2] * (floorTopOffset + aimLevel * 0.25)
                          ];
                          pN = [sN[0], sN[1], sN[2]];
                          pR = [sR[0], sR[1], sR[2]];
                          pF = [sF[0], sF[1], sF[2]];
                          floorPreviewCollectible.angle = (gridX !== 0) ? Math.PI / 2 : 0.0;
                        }
                        isSnapped = true;
                      }
                    }
            }
          } else {
                    if (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace.startsWith("robot_")) {
                        floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                        floorPreviewCollectible.size = 0.25;
                        pN = [pnx, pny, pnz];
                        pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
                        pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
                    } else if (!isSnapped) {
                        floorPreviewCollectible.isValidPlacement = false;
                        floorPreviewCollectible.size = 0.25;
                    }
            }
          } else {
                // No wood floor found nearby or too far
                if (typeToPlace === "wood_chest" || typeToPlace === "meganeura_item" || typeToPlace === "isopod_item" || typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item" || typeToPlace.startsWith("robot_")) {
                    floorPreviewCollectible.isValidPlacement = !isUnderWater && (slopeVal < 0.6);
                    floorPreviewCollectible.size = 0.25;
                    pN = [pnx, pny, pnz];
                    pR = [previewEast[0] * cosH - previewNorth[0] * sinH, previewEast[1] * cosH - previewNorth[1] * sinH, previewEast[2] * cosH - previewNorth[2] * sinH];
                    pF = [previewNorth[0] * cosH + previewEast[0] * sinH, previewNorth[1] * cosH + previewEast[1] * sinH, previewNorth[2] * cosH + previewEast[2] * sinH];
                } else if (!isSnapped) {
                    floorPreviewCollectible.isValidPlacement = false;
                    floorPreviewCollectible.size = 0.25;
                }
            }
          }

          // Smooth interpolation (instant if snapped or placing ladder to prevent lag/misalignment)
          const interpSpeed = (isSnapped || typeToPlace === "folding_ladder") ? 1.0 : 0.3;
          floorPreviewCollectible.position[0] = floorPreviewCollectible.position[0] * (1 - interpSpeed) + targetPos[0] * interpSpeed;
          floorPreviewCollectible.position[1] = floorPreviewCollectible.position[1] * (1 - interpSpeed) + targetPos[1] * interpSpeed;
          floorPreviewCollectible.position[2] = floorPreviewCollectible.position[2] * (1 - interpSpeed) + targetPos[2] * interpSpeed;

          if (typeToPlace !== "folding_ladder") {
            floorPreviewCollectible.normal[0] = pN[0];
            floorPreviewCollectible.normal[1] = pN[1];
            floorPreviewCollectible.normal[2] = pN[2];

            floorPreviewCollectible.R[0] = pR[0];
            floorPreviewCollectible.R[1] = pR[1];
            floorPreviewCollectible.R[2] = pR[2];

            floorPreviewCollectible.F[0] = pF[0];
            floorPreviewCollectible.F[1] = pF[1];
            floorPreviewCollectible.F[2] = pF[2];
          }

          if (typeToPlace === "obsidian_pad_warp_item" || typeToPlace === "obsidian_compass_pad_item") {
            const maxPads = (typeof window !== "undefined" && typeof window.MAX_OBSIDIAN_PADS === "number") ? window.MAX_OBSIDIAN_PADS : 5;
            if (typeof window !== "undefined" && typeof window.getPlacedObsidianPadsInOrder === "function") {
              if (window.getPlacedObsidianPadsInOrder().length >= maxPads) {
                floorPreviewCollectible.isValidPlacement = false;
              }
            }
          }

          if (floorPreviewCollectible.isValidPlacement === false) {
              floorPreviewCollectible.color = [0.8, 0.2, 0.2]; // red if invalid
          } else {
              floorPreviewCollectible.color = [0.95, 0.85, 0.45]; // yellow if valid
          }

          refreshCollectiblesVBO('preview');
        } else {
          // If NOT placing or inventory is open, hide/remove preview
          if (floorPreviewCollectible) {
            const idx = collectibles.indexOf(floorPreviewCollectible);
            if (idx !== -1) collectibles.splice(idx, 1);
            floorPreviewCollectible = null;
            refreshCollectiblesVBO('preview');
          }
        }

        // Player reference position for render distance checks
        let pPos = (typeof window !== "undefined" && window.player3DPos && window.player3DPos.length >= 3)
          ? window.player3DPos
          : (typeof eyePos !== "undefined" && eyePos && eyePos.length >= 3 ? eyePos : null);

        if (!pPos && typeof charTheta !== "undefined" && typeof charPhi !== "undefined") {
          const sT = Math.sin(charTheta), cT = Math.cos(charTheta);
          const sP = Math.sin(charPhi), cP = Math.cos(charPhi);
          const rBase = (typeof RADIUS !== "undefined" ? RADIUS : 8.0);
          pPos = [rBase * sT * cP, rBase * cT, rBase * sT * sP];
        }

        const isRenderDistOn = (typeof renderDistEnabled !== "undefined"
          ? renderDistEnabled
          : (typeof window !== "undefined" && typeof window.renderDistEnabled !== "undefined" ? window.renderDistEnabled : true));

        const curObjectDist = typeof objectRenderDistValue !== "undefined"
          ? objectRenderDistValue
          : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
            ? window.objectRenderDistValue
            : 5.0);

        const maxDistLimit = curObjectDist + 1.0;
        const maxDistSq = maxDistLimit * maxDistLimit;

        for (let c of collectibles) {
          if (!c.active || !c.isDynamic) continue;

          // Check if dynamic collectible is outside the object render distance
          let isOutOfRenderDist = false;
          if (isRenderDistOn && pPos && c.position) {
            const dx = c.position[0] - pPos[0];
            const dy = c.position[1] - pPos[1];
            const dz = c.position[2] - pPos[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > maxDistSq) {
              isOutOfRenderDist = true;
            }
          }

          if ((typeof activeRidingBoat !== "undefined" && c === activeRidingBoat) || 
              (typeof activeRidingMech !== "undefined" && activeRidingMech && (c === activeRidingMech || (activeRidingMech.attachedParts && activeRidingMech.attachedParts.some(ep => ep.item === c))))) {
            isOutOfRenderDist = false;
            c.vel = [0, 0, 0];
            continue;
          }

          // If outside render distance, put simulation to sleep and do not trigger dynamic VBO refresh
          if (isOutOfRenderDist) {
            c._wasOutOfRange = true;
            continue;
          } else {
            // If entering range, refresh once to ensure up-to-date position in dynamic buffer
            if (c._wasOutOfRange) {
              c._wasOutOfRange = false;
              needRefresh = true;
            }
          }

          const _oldP = c.position ? [c.position[0], c.position[1], c.position[2]] : null;
          const _oldR = c.R ? [c.R[0], c.R[1], c.R[2]] : null;

          if (c.type === "arrow") {
             if (c.attachedToNPC) {
                 const npc = c.attachedToNPC;
                 const isNpcValid = typeof amphibians !== "undefined" && amphibians && amphibians.includes(npc);
                 if (!isNpcValid) {
                     c.attachedToNPC = null;
                     c.active = false;
                 } else {
                     const tf = (typeof window.getNPCTransform === "function") ? window.getNPCTransform(npc) : {
                         pos: (npc.ragdollEnabled && npc.ragdollPos) ? npc.ragdollPos : (npc.position || [0,0,0]),
                         R: npc.R || [1, 0, 0],
                         N: npc.N || [0, 1, 0],
                         F: npc.F || [0, 0, 1]
                     };
                     const nPos = tf.pos;
                     const nR = tf.R;
                     const nN = tf.N;
                     const nF = tf.F;
                     
                     if (c.relLocal) {
                         c.position[0] = nPos[0] + nR[0] * c.relLocal[0] + nN[0] * c.relLocal[1] + nF[0] * c.relLocal[2];
                         c.position[1] = nPos[1] + nR[1] * c.relLocal[0] + nN[1] * c.relLocal[1] + nF[1] * c.relLocal[2];
                         c.position[2] = nPos[2] + nR[2] * c.relLocal[0] + nN[2] * c.relLocal[1] + nF[2] * c.relLocal[2];
                         
                         if (c.relLocalF) {
                             c.F = [
                                 nR[0] * c.relLocalF[0] + nN[0] * c.relLocalF[1] + nF[0] * c.relLocalF[2],
                                 nR[1] * c.relLocalF[0] + nN[1] * c.relLocalF[1] + nF[1] * c.relLocalF[2],
                                 nR[2] * c.relLocalF[0] + nN[2] * c.relLocalF[1] + nF[2] * c.relLocalF[2]
                             ];
                         }
                         if (c.relLocalR) {
                             c.R = [
                                 nR[0] * c.relLocalR[0] + nN[0] * c.relLocalR[1] + nF[0] * c.relLocalR[2],
                                 nR[1] * c.relLocalR[0] + nN[1] * c.relLocalR[1] + nF[1] * c.relLocalR[2],
                                 nR[2] * c.relLocalR[0] + nN[2] * c.relLocalR[1] + nF[2] * c.relLocalR[2]
                             ];
                         }
                         if (c.relLocalNormal) {
                             c.normal = [
                                 nR[0] * c.relLocalNormal[0] + nN[0] * c.relLocalNormal[1] + nF[0] * c.relLocalNormal[2],
                                 nR[1] * c.relLocalNormal[0] + nN[1] * c.relLocalNormal[1] + nF[1] * c.relLocalNormal[2],
                                 nR[2] * c.relLocalNormal[0] + nN[2] * c.relLocalNormal[1] + nF[2] * c.relLocalNormal[2]
                             ];
                         }
                     }
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }

             if (c.isStuck) {
                 continue;
             }

             const p = c.position;
             const r_dist = Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2);
             const nx = p[0] / (r_dist || 1);
             const ny = p[1] / (r_dist || 1);
             const nz = p[2] / (r_dist || 1);
             let speed = Math.sqrt(c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2);
             
             // HYBRID ANIMATION + PHYSICS SYSTEM:
             // 1) Animation launch phase: Straight barrel clearance without gravity or player snag
             if (c.animPhaseActive) {
                 c.animElapsed = (c.animElapsed || 0) + (1.0 / 60.0);
                 p[0] += c.animDir[0] * c.animSpeed;
                 p[1] += c.animDir[1] * c.animSpeed;
                 p[2] += c.animDir[2] * c.animSpeed;
                 
                 c.F = [c.animDir[0], c.animDir[1], c.animDir[2]];
                 c.vel = [c.animDir[0] * c.animSpeed, c.animDir[1] * c.animSpeed, c.animDir[2] * c.animSpeed];
                 speed = c.animSpeed;
                 
                 const localUp = [nx, ny, nz];
                 let right = [
                     c.F[1]*localUp[2] - c.F[2]*localUp[1],
                     c.F[2]*localUp[0] - c.F[0]*localUp[2],
                     c.F[0]*localUp[1] - c.F[1]*localUp[0]
                 ];
                 const lenR = Math.sqrt(right[0]**2 + right[1]**2 + right[2]**2);
                 c.R = (lenR > 0.001) ? [right[0]/lenR, right[1]/lenR, right[2]/lenR] : [1, 0, 0];
                 c.normal = [
                     c.R[1]*c.F[2] - c.R[2]*c.F[1],
                     c.R[2]*c.F[0] - c.R[0]*c.F[2],
                     c.R[0]*c.F[1] - c.R[1]*c.F[0]
                 ];
                 
                 // If animation exit duration reached, seamlessly switch to full physics
                 if (c.animElapsed >= (c.animMaxTime || 0.25)) {
                     c.animPhaseActive = false;
                 }
             } else {
                 // 2) Physics phase: Gravity towards planet center + velocity integration
                 const gravityPower = 0.0008 * (typeof playerScale !== 'undefined' ? playerScale : 0.1); 
                 Physics.applyGravity(c.vel, nx, ny, nz, 1.0, gravityPower);
                 
                 p[0] += c.vel[0];
                 p[1] += c.vel[1];
                 p[2] += c.vel[2];
                 
                 speed = Math.sqrt(c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2);
                 if (speed > 0.0001) {
                     c.F = [c.vel[0] / speed, c.vel[1] / speed, c.vel[2] / speed];
                     const localUp = [nx, ny, nz];
                     let right = [
                         c.F[1]*localUp[2] - c.F[2]*localUp[1],
                         c.F[2]*localUp[0] - c.F[0]*localUp[2],
                         c.F[0]*localUp[1] - c.F[1]*localUp[0]
                     ];
                     const lenR = Math.sqrt(right[0]**2 + right[1]**2 + right[2]**2);
                     if (lenR > 0.001) {
                         c.R = [right[0]/lenR, right[1]/lenR, right[2]/lenR];
                     } else {
                         c.R = [1, 0, 0];
                     }
                     c.normal = [
                         c.R[1]*c.F[2] - c.R[2]*c.F[1],
                         c.R[2]*c.F[0] - c.R[0]*c.F[2],
                         c.R[0]*c.F[1] - c.R[1]*c.F[0]
                     ];
                 }
             }
             
             // 4) Check collision with amphibians (NPCs) - Universal Mesh-Direct Sticking System
             let hitNPC = false;
             if (typeof amphibians !== "undefined" && amphibians) {
                 const sScale = typeof playerScale !== "undefined" ? playerScale : 0.1;
                 const arrowL = 1.12 * sScale; // 0.112m
                 const halfL = arrowL * 0.5;   // 0.056m
                 const arrowTipOffset = halfL + 0.04 * sScale; // Tip is ~0.060m forward from arrow center

                 let arrowF = c.F ? [c.F[0], c.F[1], c.F[2]] : (c.vel ? [c.vel[0], c.vel[1], c.vel[2]] : [0, 0, 1]);
                 const fLen = Math.hypot(arrowF[0], arrowF[1], arrowF[2]);
                 if (fLen > 0.001) {
                     arrowF[0] /= fLen; arrowF[1] /= fLen; arrowF[2] /= fLen;
                 } else {
                     arrowF = [0, 0, 1];
                 }

                 const currTip = [p[0] + arrowF[0] * arrowTipOffset, p[1] + arrowF[1] * arrowTipOffset, p[2] + arrowF[2] * arrowTipOffset];
                 const prevP = _oldP || [p[0] - arrowF[0] * speed, p[1] - arrowF[1] * speed, p[2] - arrowF[2] * speed];
                 const prevTip = [prevP[0] + arrowF[0] * arrowTipOffset, prevP[1] + arrowF[1] * arrowTipOffset, prevP[2] + arrowF[2] * arrowTipOffset];

                 for (let npc of amphibians) {
                     // Get NPC position and orthonormal orientation basis
                     const tf = (typeof window.getNPCTransform === "function") ? window.getNPCTransform(npc) : {
                         pos: (npc.ragdollEnabled && npc.ragdollPos) ? npc.ragdollPos : (npc.position || [0, 0, 0]),
                         R: npc.R || [1, 0, 0],
                         N: npc.N || [0, 1, 0],
                         F: npc.F || [0, 0, 1]
                     };
                     const nPos = tf.pos;
                     const nR = tf.R;
                     const nN = tf.N;
                     const nF = tf.F;

                     const npcCenter = (typeof window.getNPCTargetPoint === "function" ? window.getNPCTargetPoint(npc) : null) || nPos;
                     const hitRadius = npc.type === "meganeura" ? 0.25 : (npc.type === "isopod" ? 0.20 : (npc.type === "placoderm" ? 0.45 : (npc.type === "georgiacetus" ? 0.55 : (npc.type === "human" ? 0.35 : 0.35))));

                     // Find closest point on arrow trajectory segment to the NPC model center
                     const segX = currTip[0] - prevTip[0];
                     const segY = currTip[1] - prevTip[1];
                     const segZ = currTip[2] - prevTip[2];
                     const segLenSq = segX * segX + segY * segY + segZ * segZ;

                     const toNpcX = npcCenter[0] - prevTip[0];
                     const toNpcY = npcCenter[1] - prevTip[1];
                     const toNpcZ = npcCenter[2] - prevTip[2];

                     let tSeg = segLenSq > 0.00001 ? (toNpcX * segX + toNpcY * segY + toNpcZ * segZ) / segLenSq : 0;
                     tSeg = Math.max(0, Math.min(1, tSeg));

                     const closestX = prevTip[0] + segX * tSeg;
                     const closestY = prevTip[1] + segY * tSeg;
                     const closestZ = prevTip[2] + segZ * tSeg;

                     const distSq = (closestX - npcCenter[0]) ** 2 + (closestY - npcCenter[1]) ** 2 + (closestZ - npcCenter[2]) ** 2;

                     if (distSq <= hitRadius * hitRadius) {
                         c.animPhaseActive = false;
                         const isIronBullet = (c.ammoType === "IRON_BULLET");
                         // Arrow Immunity Check: Arrows cannot damage obsidian_cube, but Spherical Iron Bullet CAN damage obsidian_cube!
                         const isImmuneToArrows = (!isIronBullet) && ((npc.type === "obsidian_cube") || (npc.immuneToArrows) || (window.NpcRegistry && window.NpcRegistry[npc.type] && window.NpcRegistry[npc.type].immuneToArrows));
                         if (isImmuneToArrows) {
                             if (typeof showNotice === "function") {
                                 showNotice("🛡️ ลูกธนูเด้งสะท้อน! ศิลาออบซิเดียนทนทานต่อธนู 100% (Immune to arrows!)");
                             }
                             c.vel[0] = -c.vel[0] * 0.45 + (Math.random() - 0.5) * 0.04;
                             c.vel[1] = -c.vel[1] * 0.45 + (Math.random() - 0.5) * 0.04;
                             c.vel[2] = -c.vel[2] * 0.45 + (Math.random() - 0.5) * 0.04;
                             hitNPC = true;
                             break;
                         }

                         // Spherical Iron Bullet deals 3 HP damage, Arrow deals 1 HP!
                         const damage = isIronBullet ? 3 : 1;
                         if (npc.hp === undefined) {
                             const regHp = (window.NpcRegistry && window.NpcRegistry[npc.type]) ? window.NpcRegistry[npc.type].maxHp : 1;
                             npc.hp = regHp;
                             npc.maxHp = regHp;
                         }

                         if (npc.hp > 0) {
                             npc.hp = Math.max(0, npc.hp - damage);
                             let hpHearts = "";
                             for (let i = 0; i < npc.maxHp; i++) {
                                 hpHearts += i < npc.hp ? "🔴" : "⚪";
                             }
                             const weaponName = isObsidianBall ? "⚫ ลูกบอลออบซิเดียน" : (isIronBullet ? "⚪ กระสุนเหล็กทรงกลม" : ((c.isCannonShot || c.sourceWeapon === "WOODEN_ARM_CANNON") ? "🪵🦾 ปืนไม้ติดแขน" : "🏹 ลูกธนู"));
                             showNotice("🎯 " + weaponName + " ยิงเข้าเป้า! ลดดาเมจ -" + damage + " " + hpHearts + " [HP: " + npc.hp + "/" + npc.maxHp + "]");
                             
                             if (npc.hp <= 0) {
                                 npc.ragdollEnabled = true;
                                 showNotice("💀 กำจัดเป้าหมายสำเร็จ! (Target eliminated!)");
                             }
                         } else {
                             const weaponName = isObsidianBall ? "ลูกบอลออบซิเดียน" : (isIronBullet ? "กระสุนเหล็ก" : "ลูกธนู");
                             showNotice("🎯 " + weaponName + "ปักโดนร่างเป้าหมาย!");
                         }
                         
                         if (npc.ragdollEnabled && npc.ragdollVel) {
                             npc.ragdollVel[0] = (c.vel[0] || 0) * 0.25;
                             npc.ragdollVel[1] = (c.vel[1] || 0) * 0.25;
                             npc.ragdollVel[2] = (c.vel[2] || 0) * 0.25;
                         }
                         
                         if (typeof playSplashSound === "function") {
                             playSplashSound(1.0);
                         }
                         
                         // Transform impact point into NPC local coordinate space
                         const toImpact = [closestX - nPos[0], closestY - nPos[1], closestZ - nPos[2]];
                         let lx = toImpact[0] * nR[0] + toImpact[1] * nR[1] + toImpact[2] * nR[2];
                         let ly = toImpact[0] * nN[0] + toImpact[1] * nN[1] + toImpact[2] * nN[2];
                         let lz = toImpact[0] * nF[0] + toImpact[1] * nF[1] + toImpact[2] * nF[2];

                         let ldx = arrowF[0] * nR[0] + arrowF[1] * nR[1] + arrowF[2] * nR[2];
                         let ldy = arrowF[0] * nN[0] + arrowF[1] * nN[1] + arrowF[2] * nN[2];
                         let ldz = arrowF[0] * nF[0] + arrowF[1] * nF[1] + arrowF[2] * nF[2];
                         const ldLen = Math.hypot(ldx, ldy, ldz) || 1;
                         ldx /= ldLen; ldy /= ldLen; ldz /= ldLen;

                         // Snap impact point directly onto the true 3D surface of the model mesh
                         if (npc.type === "human") {
                             ly = Math.max(-0.16, Math.min(0.16, ly));
                             const rBody = ly > 0.08 ? 0.055 : (ly >= -0.03 ? 0.075 : 0.055);
                             const dHoriz = Math.hypot(lx, lz);
                             if (dHoriz > rBody && dHoriz > 0.001) {
                                 lx = (lx / dHoriz) * rBody;
                                 lz = (lz / dHoriz) * rBody;
                             }
                         } else if (npc.type === "isopod") {
                             lz = Math.max(-0.10, Math.min(0.10, lz));
                             const dShell = Math.hypot(lx, ly);
                             if (dShell > 0.07 && dShell > 0.001) {
                                 lx = (lx / dShell) * 0.07;
                                 ly = (ly / dShell) * 0.07;
                             }
                         } else if (npc.type === "placoderm") {
                             lz = Math.max(-0.40, Math.min(0.18, lz));
                             const rFish = Math.max(0.04, 0.12 * (1.0 - Math.abs(lz + 0.1) / 0.35));
                             const dFish = Math.hypot(lx, ly);
                             if (dFish > rFish && dFish > 0.001) {
                                 lx = (lx / dFish) * rFish;
                                 ly = (ly / dFish) * rFish;
                             }
                         } else if (npc.type === "georgiacetus") {
                             lz = Math.max(-0.48, Math.min(0.25, lz));
                             const rGeo = Math.max(0.05, 0.14 * (1.0 - Math.abs(lz + 0.1) / 0.40));
                             const dGeo = Math.hypot(lx, ly);
                             if (dGeo > rGeo && dGeo > 0.001) {
                                 lx = (lx / dGeo) * rGeo;
                                 ly = (ly / dGeo) * rGeo;
                             }
                         } else if (npc.type === "meganeura") {
                             lz = Math.max(-0.12, Math.min(0.08, lz));
                             const dBug = Math.hypot(lx, ly);
                             if (dBug > 0.05 && dBug > 0.001) {
                                 lx = (lx / dBug) * 0.05;
                                 ly = (ly / dBug) * 0.05;
                             }
                         }

                         // User requirement: Embed arrow deep, half of the arrow length (50%) buried into mesh
                         const penetration = halfL; // 0.056m
                         const centerOffset = arrowTipOffset - penetration; // 0.004m

                         c.relLocal = [
                             lx - ldx * centerOffset,
                             ly - ldy * centerOffset,
                             lz - ldz * centerOffset
                         ];

                         c.relLocalF = [ldx, ldy, ldz];

                         const cR = (c.R && Math.hypot(c.R[0], c.R[1], c.R[2]) > 0.5) ? c.R : [1, 0, 0];
                         c.relLocalR = [
                             cR[0] * nR[0] + cR[1] * nR[1] + cR[2] * nR[2],
                             cR[0] * nN[0] + cR[1] * nN[1] + cR[2] * nN[2],
                             cR[0] * nF[0] + cR[1] * nF[1] + cR[2] * nF[2]
                         ];

                         const cN = (c.normal && Math.hypot(c.normal[0], c.normal[1], c.normal[2]) > 0.5) ? c.normal : [0, 1, 0];
                         c.relLocalNormal = [
                             cN[0] * nR[0] + cN[1] * nR[1] + cN[2] * nR[2],
                             cN[0] * nN[0] + cN[1] * nN[1] + cN[2] * nN[2],
                             cN[0] * nF[0] + cN[1] * nF[1] + cN[2] * nF[2]
                         ];

                         c.attachedToNPC = npc;
                         c.vel = [0, 0, 0];
                         c.animPhaseActive = false;
                         c.isDynamic = true;
                         c.active = true;
                         c.isStuck = false;

                         // Compute and update immediate world coordinates
                         c.position = [
                             nPos[0] + nR[0] * c.relLocal[0] + nN[0] * c.relLocal[1] + nF[0] * c.relLocal[2],
                             nPos[1] + nR[1] * c.relLocal[0] + nN[1] * c.relLocal[1] + nF[1] * c.relLocal[2],
                             nPos[2] + nR[2] * c.relLocal[0] + nN[2] * c.relLocal[1] + nF[2] * c.relLocal[2]
                         ];
                         c.F = [
                             nR[0] * c.relLocalF[0] + nN[0] * c.relLocalF[1] + nF[0] * c.relLocalF[2],
                             nR[1] * c.relLocalF[0] + nN[1] * c.relLocalF[1] + nF[1] * c.relLocalF[2],
                             nR[2] * c.relLocalF[0] + nN[2] * c.relLocalF[1] + nF[2] * c.relLocalF[2]
                         ];
                         c.R = [
                             nR[0] * c.relLocalR[0] + nN[0] * c.relLocalR[1] + nF[0] * c.relLocalR[2],
                             nR[1] * c.relLocalR[0] + nN[1] * c.relLocalR[1] + nF[1] * c.relLocalR[2],
                             nR[2] * c.relLocalR[0] + nN[2] * c.relLocalR[1] + nF[2] * c.relLocalR[2]
                         ];
                         c.normal = [
                             nR[0] * c.relLocalNormal[0] + nN[0] * c.relLocalNormal[1] + nF[0] * c.relLocalNormal[2],
                             nR[1] * c.relLocalNormal[0] + nN[1] * c.relLocalNormal[1] + nF[1] * c.relLocalNormal[2],
                             nR[2] * c.relLocalNormal[0] + nN[2] * c.relLocalNormal[1] + nF[2] * c.relLocalNormal[2]
                         ];

                         window.pendingDynamicCollectibleRefresh = true;
                         hitNPC = true;
                         break;
                     }
                 }
             }
             
             if (hitNPC) {
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             // 5) Check ground/terrain collision
             const theta_coords = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
             const phi_coords = Math.atan2(p[2], p[0]);
             const terrainH = getHeightOnSphere(theta_coords, phi_coords, globalSeed);
             const terrainRad = RADIUS + terrainH * HEIGHT_SCALE;
             
             const current_dist = Math.sqrt(p[0]**2 + p[1]**2 + p[2]**2);
             const coreCollectible = collectibles.find(c => c.type === "planet_core");
             const coreRadius = coreCollectible ? coreCollectible.radius : 2.0;
             if (current_dist <= coreRadius) {
                 c.animPhaseActive = false;
                 p[0] = nx * (coreRadius + 0.001);
                 p[1] = ny * (coreRadius + 0.001);
                 p[2] = nz * (coreRadius + 0.001);
                 c.vel = [0, 0, 0];
                 c.isStuck = true;
                 
                 if (typeof playPlaceSound === "function") {
                     playPlaceSound();
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             if (current_dist <= terrainRad) {
                 // Stick into ground
                 c.animPhaseActive = false;
                 p[0] = nx * (terrainRad + 0.001);
                 p[1] = ny * (terrainRad + 0.001);
                 p[2] = nz * (terrainRad + 0.001);
                 
                 c.vel = [0, 0, 0];
                 c.isStuck = true;
                 
                 if (typeof playPlaceSound === "function") {
                     playPlaceSound();
                 }
                 window.pendingDynamicCollectibleRefresh = true;
                 continue;
             }
             
             if (c.isDynamic !== false) {
                 window.pendingDynamicCollectibleRefresh = true;
             }
             continue;
          }

          if (c.type === "plank") {
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

            const F = [
              North[0] * cosH + East[0] * sinH,
              North[1] * cosH + East[1] * sinH,
              North[2] * cosH + East[2] * sinH,
            ];

            const R = [
              East[0] * cosH - North[0] * sinH,
              East[1] * cosH - North[1] * sinH,
              East[2] * cosH - North[2] * sinH,
            ];

            const dropDist = 0.5; // distance in front
            const bob = Math.sin(Date.now() * 0.003) * 0.05 + 0.15; // float above ground
            const targetPos = [
                (groundRadius + bob) * nx + F[0] * dropDist,
                (groundRadius + bob) * ny + F[1] * dropDist,
                (groundRadius + bob) * nz + F[2] * dropDist
            ];

            c.position[0] = c.position[0] * 0.85 + targetPos[0] * 0.15;
            c.position[1] = c.position[1] * 0.85 + targetPos[1] * 0.15;
            c.position[2] = c.position[2] * 0.85 + targetPos[2] * 0.15;

            c.normal[0] = c.normal[0] * 0.85 + nx * 0.15;
            c.normal[1] = c.normal[1] * 0.85 + ny * 0.15;
            c.normal[2] = c.normal[2] * 0.85 + nz * 0.15;

            c.R[0] = c.R[0] * 0.85 + R[0] * 0.15;
            c.R[1] = c.R[1] * 0.85 + R[1] * 0.15;
            c.R[2] = c.R[2] * 0.85 + R[2] * 0.15;

            c.F[0] = c.F[0] * 0.85 + F[0] * 0.15;
            c.F[1] = c.F[1] * 0.85 + F[1] * 0.15;
            c.F[2] = c.F[2] * 0.85 + F[2] * 0.15;

            needRefresh = true;
            continue;
          }
          
          if (!c.vel) {
            // initial velocity outward from the tree (greatly reduced to stay in the same spot)
            const vOut = 0.002 + Math.random() * 0.003;
            const vUp = 0.003 + Math.random() * 0.005;
            c.vel = [
              c.F[0] * vOut + c.normal[0] * vUp,
              c.F[1] * vOut + c.normal[1] * vUp,
              c.F[2] * vOut + c.normal[2] * vUp,
            ];
          }

          const r = Math.sqrt(
            c.position[0] ** 2 + c.position[1] ** 2 + c.position[2] ** 2,
          );
          
          let isAirborneWingedBoat = false;
          
          if (r > 0.001) {
            const nx = c.position[0] / r;
            const ny = c.position[1] / r;
            const nz = c.position[2] / r;

            let force = gravityAccel;
            
            // Check if collectible is in water
            let theta = Math.acos(Math.max(-1.0, Math.min(1.0, c.position[1] / (r || 1))));
            let phi = Math.atan2(c.position[2], c.position[0]);
            let height = (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, globalSeed) : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, globalSeed) : 0));
            let caveDataForCol = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(c.position[0]/(r||1), c.position[1]/(r||1), c.position[2]/(r||1), r) : null;
            let terrainRadius = caveDataForCol ? caveDataForCol.ground : (RADIUS + height * HEIGHT_SCALE);
            const waterRadius = RADIUS + waterLevel * 0.15;
            
            let inWater = false;
            if (waterEnabled && terrainRadius < waterRadius) {
                if (caveDataForCol.insideTunnel) {
                    let wRadiusLocal = typeof getWaterRadiusAt === "function" ? getWaterRadiusAt(c.position[0], c.position[1], c.position[2]) : waterRadius;
                    if (wRadiusLocal === 0) wRadiusLocal = waterRadius;
                    inWater = (wRadiusLocal > terrainRadius);
                } else {
                    inWater = true;
                }
            }
            
            let isLogFloat = ((c.type === "log" || c.type === "branch" || c.type === "plank" || c.type === "wood_floor" || c.type === "thin_wood_floor" || c.type === "wood_boat") && inWater && r <= waterRadius + 0.1);

            const hasWingBoat = (c.type === "wood_boat") && !!(c.hasWing || c.hasWings);
            const isWheeledBoat = (c.type === "wood_boat") && !!(c.hasWheel || c.hasWheels || (c.wheelCount && c.wheelCount > 0));
            const groundRadCheck = inWater ? (waterRadius - 0.04) : terrainRadius;
            isAirborneWingedBoat = hasWingBoat && !inWater && (c.isFlying || c.isGliding || (r - groundRadCheck > 0.15));

            if (isLogFloat) {
                // Buoyant force counters gravity and pushes it up to the surface
                const depth = waterRadius - r;
                // Target radius for the log to float is slightly below the water surface so it looks half-submerged
                let targetR = waterRadius - 0.005; 
                if (c.type === "wood_boat") {
                    let wpx = c.position[0], wpy = c.position[1], wpz = c.position[2];
                    let rLen = Math.sqrt(wpx*wpx + wpy*wpy + wpz*wpz) || 1;
                    const wave = getWaterWave(wpx/rLen*waterRadius, wpy/rLen*waterRadius, wpz/rLen*waterRadius, waterAnimTime, waveStrength);
                    // The boat has gravity pulling it down. Under the spring force, it settles at targetR - 0.07.
                    // To make it float properly we adjust the targetR slightly below the water surface.
                    targetR = waterRadius + wave - 0.02;
                }
                const bobOffset = Math.sin(Date.now() * 0.002 + c.seed * 100) * 0.0003;
                force = gravityAccel - (targetR - r) * 0.05 - bobOffset;
                
                // Extra damping for water
                Physics.applyFriction(c.vel, 0.90);
                c.spinSpeed *= 0.85;

                // Gradually align normal to point up so the log lies flat on the water
                c.normal[0] = c.normal[0] * 0.9 + nx * 0.1;
                c.normal[1] = c.normal[1] * 0.9 + ny * 0.1;
                c.normal[2] = c.normal[2] * 0.9 + nz * 0.1;
                const nLen = Math.sqrt(c.normal[0]**2 + c.normal[1]**2 + c.normal[2]**2);
                c.normal[0] /= nLen;
                c.normal[1] /= nLen;
                c.normal[2] /= nLen;

                // Re-orthogonalize R and F
                let dot = c.R[0]*c.normal[0] + c.R[1]*c.normal[1] + c.R[2]*c.normal[2];
                c.R[0] -= dot * c.normal[0];
                c.R[1] -= dot * c.normal[1];
                c.R[2] -= dot * c.normal[2];
                let rLen = Math.sqrt(c.R[0]**2 + c.R[1]**2 + c.R[2]**2);
                if (rLen > 0.001) {
                    c.R[0] /= rLen; c.R[1] /= rLen; c.R[2] /= rLen;
                } else {
                    // Fallback
                    c.R = [c.normal[1], -c.normal[0], 0];
                }
                c.F = [
                  c.R[1]*c.normal[2] - c.R[2]*c.normal[1],
                  c.R[2]*c.normal[0] - c.R[0]*c.normal[2],
                  c.R[0]*c.normal[1] - c.R[1]*c.normal[0]
                ];
            } else if (isAirborneWingedBoat) {
                // === Realistically glide & sink down just like the condition when not pressing W ===
                const dt = typeof window.timeScale !== "undefined" ? window.timeScale : 1.0;
                const glideSinkRate = -0.010;
                c.verticalVel = Math.max(glideSinkRate, (c.verticalVel || -0.002) - 0.0008 * dt);
                c.pitchGrade = (c.pitchGrade || 0) * 0.95 - 0.04 * Math.min(1.0, 0.06 * dt);
                const coastFriction = Math.pow(0.995, dt);
                c.vehicleSpeed = (typeof c.vehicleSpeed === "number" ? c.vehicleSpeed : 0) * coastFriction;
                if (Math.abs(c.vehicleSpeed) < 0.00001) c.vehicleSpeed = 0;

                // Gradually level bank angle back to 0
                if (c.bankAngle) {
                    c.bankAngle *= Math.pow(0.92, dt);
                    if (Math.abs(c.bankAngle) < 0.001) c.bankAngle = 0;
                }

                // Aerodynamic attitude stabilization relative to sphere normal
                let currN = c.normal || [nx, ny, nz];
                let airNx = currN[0] + (nx - currN[0]) * Math.min(1.0, 0.06 * dt);
                let airNy = currN[1] + (ny - currN[1]) * Math.min(1.0, 0.06 * dt);
                let airNz = currN[2] + (nz - currN[2]) * Math.min(1.0, 0.06 * dt);
                let airLen = Math.sqrt(airNx*airNx + airNy*airNy + airNz*airNz) || 1;
                c.normal = [airNx / airLen, airNy / airLen, airNz / airLen];

                // Ensure F and R remain strictly orthonormal
                if (!c.F) c.F = [1, 0, 0];
                let fDot = c.F[0]*c.normal[0] + c.F[1]*c.normal[1] + c.F[2]*c.normal[2];
                let newF = [c.F[0] - fDot*c.normal[0], c.F[1] - fDot*c.normal[1], c.F[2] - fDot*c.normal[2]];
                let lenF = Math.sqrt(newF[0]**2 + newF[1]**2 + newF[2]**2);
                if (lenF > 0.001) { c.F = [newF[0]/lenF, newF[1]/lenF, newF[2]/lenF]; }
                if (!c.R) c.R = [0, 1, 0];
                c.R = [c.normal[1]*c.F[2] - c.normal[2]*c.F[1], c.normal[2]*c.F[0] - c.normal[0]*c.F[2], c.normal[0]*c.F[1] - c.normal[1]*c.F[0]];
                let lenR = Math.sqrt(c.R[0]**2 + c.R[1]**2 + c.R[2]**2);
                if (lenR > 0.001) { c.R = [c.R[0]/lenR, c.R[1]/lenR, c.R[2]/lenR]; }

                // Velocity vector: forward along F + sinking along normal (towards core)
                c.vel[0] = c.F[0] * c.vehicleSpeed + nx * c.verticalVel;
                c.vel[1] = c.F[1] * c.vehicleSpeed + ny * c.verticalVel;
                c.vel[2] = c.F[2] * c.vehicleSpeed + nz * c.verticalVel;

                c.spinSpeed = 0;
            } else {
                // Air friction (dampen quickly to land smoothly)
                Physics.applyFriction(c.vel, 0.82);
                c.vel[0] -= nx * force;
                c.vel[1] -= ny * force;
                c.vel[2] -= nz * force;
            }
          }

          c.position[0] += c.vel[0];
          c.position[1] += c.vel[1];
          c.position[2] += c.vel[2];
          
          // Random tumbling rotation logic for the logs
          if (!c.spinAxis) {
              if (c.type === "wood_boat") {
                  c.spinAxis = [0, 1, 0];
                  c.spinSpeed = 0;
              } else {
                  const ax = Math.random() - 0.5;
                  const ay = Math.random() - 0.5;
                  const az = Math.random() - 0.5;
                  const alen = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
                  c.spinAxis = [ax/alen, ay/alen, az/alen];
                  c.spinSpeed = (Math.random() - 0.5) * 0.2;
              }
          }
          
          // Ground collision
          let nx_c = c.position[0] / (r || 1);
          let ny_c = c.position[1] / (r || 1);
          let nz_c = c.position[2] / (r || 1);
          
          let caveDataForCol = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx_c, ny_c, nz_c, r) : null;
          let terrainRadius;
          if (caveDataForCol) {
            terrainRadius = caveDataForCol.ground;
          } else {
            let theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny_c)));
            let phi = Math.atan2(nz_c, nx_c);
            let height = (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, globalSeed) : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, globalSeed) : 0));
            terrainRadius = RADIUS + height * HEIGHT_SCALE;
          }
          
          const waterRadius = RADIUS + waterLevel * 0.15;
          
          let groundRadius = terrainRadius;
          let isInWater = false;
          if (waterEnabled && terrainRadius < waterRadius) {
              if (caveDataForCol && caveDataForCol.insideTunnel) {
                  let wRadiusLocal = typeof getWaterRadiusAt === "function" ? getWaterRadiusAt(c.position[0], c.position[1], c.position[2]) : waterRadius;
                  if (wRadiusLocal === 0) wRadiusLocal = waterRadius;
                  if (wRadiusLocal > terrainRadius) {
                      groundRadius = waterRadius;
                      isInWater = true;
                  }
              } else {
                  groundRadius = waterRadius;
                  isInWater = true;
              }
          }
          
          const isItemDrop = (c.type === "log" || c.type === "branch" || c.type === "rock" || c.type === "big_rock" || c.type === "iron_ore" || c.type === "gold_ore" || c.type === "glow_ore");
          let collisionRadius = groundRadius + (c.type === "wood_boat" ? (isInWater ? -0.04 : 0.002) : (isItemDrop ? 0.001 : (c.size ? c.size * 0.5 : 0)));
          if (c.type === "wood_boat" && !isInWater) {
             const cPos = c.position;
             if (typeof Physics !== "undefined" && typeof Physics.getFloorSurfaceRadiusAt === "function") {
               collisionRadius = Physics.getFloorSurfaceRadiusAt(cPos[0], cPos[1], cPos[2], collisionRadius);
             }
          }
          let pitchGrade = 0;
          let rollGrade = 0;
          
          let isWoodBoat = c.type === "wood_boat";
          let isWheeledBoat = isWoodBoat && (c.hasWheel || c.hasWheels || (c.wheelCount && c.wheelCount > 0));

          if (isWheeledBoat && !isInWater) {
              const nx = c.position[0] / (r || 1);
              const ny = c.position[1] / (r || 1);
              const nz = c.position[2] / (r || 1);

              const isRidden = (typeof activeRidingBoat !== "undefined" && activeRidingBoat === c);

              if (c._isSleeping && !isRidden) {
                  collisionRadius = c._cachedCollisionRadius || groundRadius;
                  pitchGrade = 0;
                  rollGrade = 0;
              } else {
                  const vehicleTransform = Physics.calculateLandBoatTransform({
                      position: c.position,
                      nx, ny, nz,
                      F: c.F,
                      R: c.R,
                      baseRadius: groundRadius,
                      waterEnabled,
                      waterLevel,
                      waterAnimTime,
                      waveStrength,
                      hasWheels: true,
                      isInWater: false
                  });

                  collisionRadius = vehicleTransform.targetGroundRadius;
                  c._cachedCollisionRadius = collisionRadius;
                  if (!isAirborneWingedBoat) {
                      pitchGrade = vehicleTransform.pitchGrade;
                      rollGrade = vehicleTransform.rollGrade;
                      c.normal = vehicleTransform.normal;
                      c.F = vehicleTransform.F;
                      c.R = vehicleTransform.R;
                  }
              }
          } else if (isInWater) {
              // Wood boat keeps exact original water depth (-0.04), item drops settle at ground/water
              collisionRadius = (c.type === "wood_boat") ? (waterRadius - 0.04) : (terrainRadius + (isItemDrop ? 0.001 : (c.size ? c.size * 0.5 : 0)));
          }
          
          if (r < collisionRadius) {
            // Hit ground/water
            const nx = c.position[0] / r;
            const ny = c.position[1] / r;
            const nz = c.position[2] / r;
            
            c.position[0] = nx * collisionRadius;
            c.position[1] = ny * collisionRadius;
            c.position[2] = nz * collisionRadius;
            c.isFlying = false;
            c.isGliding = false;
            c.verticalVel = 0;
            
            // bounce and friction
            const dot = c.vel[0] * nx + c.vel[1] * ny + c.vel[2] * nz;
            if (dot < 0) {
                let restitution = (isWheeledBoat || c.type === "wood_boat") ? 0.0 : 1.3;
                c.vel[0] -= dot * nx * (1.0 + restitution);
                c.vel[1] -= dot * ny * (1.0 + restitution);
                c.vel[2] -= dot * nz * (1.0 + restitution);
            }
            let friction = 0.6;
            if (isWheeledBoat && !isInWater) {
                friction = 1.0; // Speed is handled by vehSpeed instead of c.vel friction
                c.spinSpeed = 0; // Wheeled boats align to terrain instead of spinning

                const bF = c.F, bR_vec = c.R;
                
                let pSpeed = typeof window.playerSpeed !== "undefined" ? window.playerSpeed : 0.005;
                let vehSpeed = typeof c.vehicleSpeed !== "undefined" ? c.vehicleSpeed : 0;
                let dt = typeof window.timeScale !== "undefined" ? window.timeScale : 1.0;

                const isRidden = (typeof activeRidingBoat !== "undefined" && activeRidingBoat === c) || (typeof window !== "undefined" && window.activeRidingBoat === c);

                if (!isRidden) {
                    if (c._isSleeping) {
                        vehSpeed = 0;
                        c.vehicleSpeed = 0;
                        c.vel[0] = 0; c.vel[1] = 0; c.vel[2] = 0;
                    } else {
                        // 1. Apply gravity to vehSpeed
                        const pitchGrade = c.pitchGrade || 0;
                        let gravityRollPower = pitchGrade * pSpeed * 0.5 * dt;
                        vehSpeed -= gravityRollPower;

                        // 2. Apply coast friction
                        vehSpeed *= Math.pow(0.96, dt);
                        if (Math.abs(vehSpeed) < 0.0005) {
                            vehSpeed = 0;
                            c._isSleeping = true;
                        }
                        c.vehicleSpeed = vehSpeed;

                        // 3. Move along forward vector
                        c.vel[0] = (bF ? bF[0] : 0) * vehSpeed;
                        c.vel[1] = (bF ? bF[1] : 0) * vehSpeed;
                        c.vel[2] = (bF ? bF[2] : 0) * vehSpeed;

                        // 4. Update wheel spin visually
                        if (Math.abs(vehSpeed) > 0.0001) {
                            const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
                            const wheelRadius = 0.16 * wheelScale;
                            const distTraveled = vehSpeed * dt;
                            c.spinAngle = (c.spinAngle || 0) + (distTraveled / wheelRadius);
                        }
                    }
                }
            }
            Physics.applyFriction(c.vel, friction);
            
            c.spinSpeed *= friction;

            // Stop moving if very slow
            const speedSq = c.vel[0]**2 + c.vel[1]**2 + c.vel[2]**2;
            if (c.type === "wood_boat" && !isInWater && !isWheeledBoat) {
                // Non-wheeled boat on land cannot move (completely static and stable)
                c.vel[0] = 0;
                c.vel[1] = 0;
                c.vel[2] = 0;
                c.spinSpeed = 0;
            } else if (isWheeledBoat && !isInWater && (!activeRidingBoat || activeRidingBoat !== c)) {
                if (speedSq < 0.0004 && Math.abs(c.vehicleSpeed || 0) < 0.0005) {
                    c.vel[0] = 0;
                    c.vel[1] = 0;
                    c.vel[2] = 0;
                    c.spinSpeed = 0;
                    c.vehicleSpeed = 0;
                    c._isSleeping = true;
                }
            } else if (speedSq < 0.0001 && Math.abs(c.spinSpeed) < 0.02 && c.type !== "wood_boat") {
                
                
                
                // Align normal to the surface
                c.normal = [nx, ny, nz];
                
                // Preserve original forward direction as much as possible
                let fDot = c.F[0]*nx + c.F[1]*ny + c.F[2]*nz;
                let newF = [c.F[0] - fDot*nx, c.F[1] - fDot*ny, c.F[2] - fDot*nz];
                let lenF = Math.sqrt(newF[0]**2 + newF[1]**2 + newF[2]**2);
                if (lenF > 0.001) {
                  c.F = [newF[0]/lenF, newF[1]/lenF, newF[2]/lenF];
                } else {
                  if (Math.abs(ny) < 0.9) {
                    c.F = [-nz, 0, nx];
                  } else {
                    c.F = [1, 0, 0];
                  }
                  let len = Math.sqrt(c.F[0]**2 + c.F[1]**2 + c.F[2]**2);
                  c.F = [c.F[0]/len, c.F[1]/len, c.F[2]/len];
                }
                
                c.R = [
                  c.normal[1]*c.F[2] - c.normal[2]*c.F[1],
                  c.normal[2]*c.F[0] - c.normal[0]*c.F[2],
                  c.normal[0]*c.F[1] - c.normal[1]*c.F[0]
                ];
            }
          } else {
             // apply spin
             if (c.type !== "wood_boat") {
                 const sAngle = c.spinSpeed;
                 const sCos = Math.cos(sAngle);
                 const sSin = Math.sin(sAngle);
                 const ax = c.spinAxis[0], ay = c.spinAxis[1], az = c.spinAxis[2];
                 
                 const rotateVec = (v) => {
                     const dot = v[0]*ax + v[1]*ay + v[2]*az;
                     return [
                         v[0]*sCos + (ay*v[2] - az*v[1])*sSin + ax*dot*(1-sCos),
                         v[1]*sCos + (az*v[0] - ax*v[2])*sSin + ay*dot*(1-sCos),
                         v[2]*sCos + (ax*v[1] - ay*v[0])*sSin + az*dot*(1-sCos)
                     ];
                 };
                 
                 c.R = rotateVec(c.R);
                 c.F = rotateVec(c.F);
                 c.normal = rotateVec(c.normal);
             } else {
                 // Keep boat upright towards planet normal
                 const upN = [nx_c, ny_c, nz_c];
                 c.normal = upN;
                 if (c.F) {
                     const dotF = c.F[0]*upN[0] + c.F[1]*upN[1] + c.F[2]*upN[2];
                     c.F = [c.F[0] - dotF*upN[0], c.F[1] - dotF*upN[1], c.F[2] - dotF*upN[2]];
                     const fLen = Math.sqrt(c.F[0]*c.F[0] + c.F[1]*c.F[1] + c.F[2]*c.F[2]) || 1;
                     c.F = [c.F[0]/fLen, c.F[1]/fLen, c.F[2]/fLen];
                     c.R = [
                         c.normal[1]*c.F[2] - c.normal[2]*c.F[1],
                         c.normal[2]*c.F[0] - c.normal[0]*c.F[2],
                         c.normal[0]*c.F[1] - c.normal[1]*c.F[0]
                     ];
                 }
             }
          }
          
          if (_oldP && (Math.abs(c.position[0]-_oldP[0])>1e-6 || Math.abs(c.position[1]-_oldP[1])>1e-6 || Math.abs(c.position[2]-_oldP[2])>1e-6)) needRefresh = true;
          if (_oldR && c.R && (Math.abs(c.R[0]-_oldR[0])>1e-6 || Math.abs(c.R[1]-_oldR[1])>1e-6 || Math.abs(c.R[2]-_oldR[2])>1e-6)) needRefresh = true;
        }
        
        if (activeRidingBoat) {
            const bSpeed = Math.abs(activeRidingBoat.vehicleSpeed || 0);
            if (bSpeed > 0.0001 || activeRidingBoat._moved) {
                needRefresh = true;
                activeRidingBoat._moved = false;
            }
        }

        if (needMainRefresh) {
            window.pendingCollectibleRefresh = true;
        }
        if (needRefresh) {
            window.pendingDynamicCollectibleRefresh = true;
        }
      }

      function clearActiveCollectibles() {
        collectibles.length = 0;
        if (window.collectibles) window.collectibles.length = 0;
        if (typeof SpatialGrid !== "undefined") SpatialGrid.clear();
        window.pendingCollectibleRefresh = true;
        window.pendingDynamicCollectibleRefresh = true;
      }
      window.clearActiveCollectibles = clearActiveCollectibles;
      window.buildCollectibles = buildCollectibles;
      window.rebuildCollectibles = function(count, seed) {
        buildCollectibles(count || 50, seed || (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345));
      };

      // ============================================
      // ระบบข้อมูลไอเทมหลังบ้าน (Backend Item System & Registry)
      // แบ่งไอเทมออกเป็น 3 หมวดหมู่หลัก:
      // 1. PRE_PLACE : ไอเทม พรี-วาง (สิ่งก่อสร้าง/กล่อง/เรือ/กองไฟ/ชิ้นส่วนหุ่นยนต์)
      // 2. HOLDABLE  : ไอเทมถือ (อาวุธ/เครื่องมือ/ของกิน/ของถือในมือ)
      // 3. NONE      : ไอเทมที่ไม่ใช่ทั้งพรี-วางและถือ (วัตถุดิบ/แร่/ทรัพยากร/ลูกธนู/แบตเตอรี่)
      // ============================================

      const ITEM_CATEGORIES = {
        PRE_PLACE: "PRE_PLACE", // ไอเทม พรี-วาง
        HOLDABLE: "HOLDABLE",   // ไอเทมถือ
        NONE: "NONE",            // ไม่ใช่ทั้ง พรี-วาง และ ถือ
        VEHICLE: "VEHICLE"      // ยานพาหนะ
      };
      window.ITEM_CATEGORIES = ITEM_CATEGORIES;

      const ITEM_DEFINITIONS = {
        // --- 1. หมวดไอเทม พรี-วาง (PRE_PLACE) ---
        "STONE_FLOOR": {
          id: "STONE_FLOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "พื้นหิน",
          name_en: "Stone Floor",
          icon: "🪨",
          actionType: "PLACE_STRUCTURE",
          placeType: "stone_floor",
          usage_th: "พรี-วางเป็นแผ่นพื้นหินแข็งแรงทนทาน ใช้เป็นฐานรากสิ่งปลูกสร้าง",
          usage_en: "Pre-place on terrain to build durable stone foundation.",
          maxStack: 99
        },
        "WOOD_FLOOR": {
          id: "WOOD_FLOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "พื้นไม้",
          name_en: "Wood Floor",
          icon: "🪵",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_floor",
          usage_th: "พรี-วางเป็นแผ่นพื้นไม้สำหรับสร้างบ้าน ทางเดิน และระเบียง",
          usage_en: "Pre-place to construct wooden floors, paths, and decks.",
          maxStack: 99
        },
        "THIN_WOOD_FLOOR": {
          id: "THIN_WOOD_FLOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "พื้นไม้บาง",
          name_en: "Thin Wood Floor",
          icon: "🪵",
          actionType: "PLACE_STRUCTURE",
          placeType: "thin_wood_floor",
          usage_th: "พรี-วางเป็นแผ่นไม้แบบบาง สำหรับปูพื้นเพดานหรือตกแต่งภายใน",
          usage_en: "Pre-place as thin wooden plank for ceilings or interior flooring.",
          maxStack: 99
        },
        "WOOD_STAIRS": {
          id: "WOOD_STAIRS",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "บันไดไม้",
          name_en: "Wood Stairs",
          icon: "🪜",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_stairs",
          usage_th: "พรี-วางเป็นบันไดไม้สำหรับเชื่อมต่อต่างระดับและปีนขึ้นที่สูง",
          usage_en: "Pre-place to construct wooden stairs connecting heights and floors.",
          maxStack: 99
        },
        "FOLDING_LADDER": {
          id: "FOLDING_LADDER",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "บันไดพับ",
          name_en: "Folding Ladder",
          icon: "🪜",
          actionType: "PLACE_STRUCTURE",
          placeType: "folding_ladder",
          usage_th: "บันไดพับสไตล์ Death Stranding สำหรับวางพาดได้อย่างอิสระ ทั้งบนพื้นและในถ้ำ พาดขึ้นหน้าผา ผนังถ้ำ ปากถ้ำ หรือพาดข้ามเหว",
          usage_en: "Death Stranding style extendable folding ladder to lean on cliffs, cave walls, cave entrances, or bridge chasms freely.",
          maxStack: 99
        },
        "WOOD_WALL": {
          id: "WOOD_WALL",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กำแพงไม้",
          name_en: "Wood Wall",
          icon: "🧱",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_wall",
          usage_th: "พรี-วางเป็นผนังห้อง กำแพงบ้าน หรือแนวป้องกัน",
          usage_en: "Pre-place to build wooden walls and room enclosures.",
          maxStack: 99
        },
        "WOOD_WINDOW": {
          id: "WOOD_WINDOW",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "หน้าต่างไม้",
          name_en: "Wood Window",
          icon: "🪟",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_window",
          usage_th: "พรี-วางเป็นผนังไม้พร้อมช่องกระจกหน้าต่างรับแสง",
          usage_en: "Pre-place to build wooden wall with glass window opening.",
          maxStack: 99
        },
        "WOOD_DOOR": {
          id: "WOOD_DOOR",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ประตูไม้",
          name_en: "Wood Door",
          icon: "🚪",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_door",
          usage_th: "พรี-วางเป็นบานประตูไม้สำหรับเข้าออกบ้าน สามารถเปิด-ปิดได้",
          usage_en: "Pre-place as functional openable/closeable wooden door.",
          maxStack: 99
        },
        "WOOD_ROOF": {
          id: "WOOD_ROOF",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "หลังคาไม้",
          name_en: "Wood Roof",
          icon: "🛖",
          actionType: "PLACE_STRUCTURE",
          placeType: "wood_roof",
          usage_th: "พรี-วางเป็นหลังคาทรงจั่วด้านบนสิ่งปลูกสร้าง",
          usage_en: "Pre-place to build sloped wooden roof atop structures.",
          maxStack: 99
        },
        "WOOD_CHEST": {
          id: "WOOD_CHEST",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กล่องไม้",
          name_en: "Wooden Chest",
          icon: "📦",
          actionType: "PLACE_FURNITURE",
          placeType: "wood_chest",
          usage_th: "พรี-วางเป็นหีบเก็บของความจุ 20 ช่องสำหรับเก็บไอเทมถาวร",
          usage_en: "Pre-place as a 20-slot storage chest to store items safely.",
          maxStack: 99
        },
        "CAMPFIRE": {
          id: "CAMPFIRE",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "กองไฟ",
          name_en: "Campfire",
          icon: "🔥",
          actionType: "PLACE_FURNITURE",
          placeType: "campfire",
          usage_th: "พรี-วางบนพื้นเพื่อให้แสงสว่างและเปิดเมนูปรุงอาหาร (Cooking)",
          usage_en: "Pre-place to provide light and open campfire cooking menu.",
          maxStack: 99
        },
        "WOOD_BOAT": {
          id: "WOOD_BOAT",
          category: [ITEM_CATEGORIES.PRE_PLACE, ITEM_CATEGORIES.VEHICLE],
          name_th: "เรือไม้",
          name_en: "Wood Boat",
          icon: "🛶",
          actionType: "PLACE_VEHICLE",
          placeType: "wood_boat",
          usage_th: "พรี-วางลงบนน้ำหรือพื้นดินเพื่อใช้เป็นยานพาหนะขับขี่เดินทาง",
          usage_en: "Pre-place on water or land to drive and explore the planet.",
          maxStack: 99
        },
        "WOOD_WHEEL": {
          id: "WOOD_WHEEL",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ล้อไม้",
          name_en: "Wooden Wheel",
          icon: "🛞",
          actionType: "PLACE_COMPONENT",
          placeType: "wood_wheel",
          usage_th: "พรี-วางติดตั้งประกอบเข้ากับเรือไม้ ทำให้เรือวิ่งบนบกได้อย่างคล่องตัว",
          usage_en: "Pre-place to attach wheels to boat, enabling land traversal.",
          maxStack: 99
        },
        "ELECTRIC_ENGINE": {
          id: "ELECTRIC_ENGINE",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "เครื่องยนต์ไฟฟ้า",
          name_en: "Electric Engine",
          icon: "🔋",
          actionType: "PLACE_COMPONENT",
          placeType: "electric_engine",
          usage_th: "พรี-วางติดตั้งประกอบเข้ากับเรือไม้ เพิ่มความเร็วและแรงบิด (ใช้ไฟจากแบตเตอรี่)",
          usage_en: "Pre-place to attach motor engine to boat for high-speed propulsion.",
          maxStack: 99
        },
        "BOAT_WING": {
          id: "BOAT_WING",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ปีกเรือ (Boat Wing)",
          name_en: "Boat Wing",
          icon: "🪽",
          actionType: "PLACE_COMPONENT",
          placeType: "boat_wing",
          usage_th: "พรี-วางติดตั้งประกอบเข้ากับเรือไม้เพื่อปลดล็อกการบิน (ต้องมีเครื่องยนต์ไฟฟ้า, กด Shift เพื่อเปิดโหมดบิน)",
          usage_en: "Attach biplane wings to boat to enable flight mode (Requires Electric Engine, press Shift to fly).",
          maxStack: 99
        },
        "MEGANEURA": {
          id: "MEGANEURA",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แมลงยักษ์",
          name_en: "Meganeura",
          icon: "🦟",
          actionType: "MATERIAL",
          usage_th: "ใช้เป็นวัตถุดิบปรุงอาหาร (เช่น แมลงทอด FRIED_BUG) หรือคราฟต์",
          usage_en: "Used as cooking ingredient (e.g. Fried Bug) and crafting material.",
          maxStack: 99
        },
        "ISOPOD": {
          id: "ISOPOD",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ไอโซพอด",
          name_en: "Isopod",
          icon: "🦐",
          actionType: "MATERIAL",
          usage_th: "ใช้เป็นวัตถุดิบและอาหาร หรือคราฟต์",
          usage_en: "Used as food ingredient and crafting material.",
          maxStack: 99
        },
        "OBSIDIAN_CUBE": {
          id: "OBSIDIAN_CUBE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ศิลาออบซิเดียน",
          name_en: "Obsidian Cube",
          icon: "🔶",
          actionType: "MATERIAL",
          usage_th: "ศิลาออบซิเดียนลายทองคำที่เก็บได้จากซากศิลาออบซิเดียน ใช้เป็นวัตถุดิบหรือไอเทมสะสม",
          usage_en: "Gilded obsidian stone collected from defeated Obsidian Monolith. Used as material or collectible.",
          maxStack: 99
        },
        "OBSIDIAN_PAD_WARP": {
          id: "OBSIDIAN_PAD_WARP",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "แท่นวาร์ปออบซิเดียน",
          name_en: "OBSIDIAN PAD Warp",
          icon: "🧭",
          actionType: "PLACE_STRUCTURE",
          placeType: "obsidian_pad_warp_item",
          usage_th: "แท่นวาร์ปออบซิเดียนลายทองคำสกัดพลังงานหินเรืองแสง สามารถวางประดับบนพื้นโลกได้",
          usage_en: "Gilded obsidian warp pad platform infused with Glow Ore energy. Can be placed on planet ground.",
          maxStack: 99
        },
        "ROBOT_STAND": {
          id: "ROBOT_STAND",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ฐานตั้งหุ่นยนต์",
          name_en: "Robot Stand",
          icon: "🏗️",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_stand",
          usage_th: "พรี-วางเป็นแท่นโครงสร้างสำหรับประกอบชิ้นส่วนหุ่นยนต์",
          usage_en: "Pre-place as assembly stand platform for modular robot parts.",
          maxStack: 99
        },
        "ROBOT_COCKPIT": {
          id: "ROBOT_COCKPIT",
          category: [ITEM_CATEGORIES.PRE_PLACE, ITEM_CATEGORIES.VEHICLE],
          name_th: "ห้องนักบินหุ่นยนต์",
          name_en: "Robot Cockpit",
          icon: "🤖",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_cockpit",
          usage_th: "พรี-วางประกอบเป็นห้องควบคุมหุ่นยนต์บนแท่นประกอบ",
          usage_en: "Pre-place as central cockpit module on robot frame.",
          maxStack: 99
        },
        "ROBOT_LEFT_ARM": {
          id: "ROBOT_LEFT_ARM",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "แขนซ้ายหุ่นยนต์",
          name_en: "Robot Left Arm",
          icon: "🦾",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_left_arm",
          usage_th: "พรี-วางประกอบเป็นแขนซ้ายของหุ่นยนต์",
          usage_en: "Pre-place to attach left arm module to robot cockpit.",
          maxStack: 99
        },
        "ROBOT_RIGHT_ARM": {
          id: "ROBOT_RIGHT_ARM",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "แขนขวาหุ่นยนต์",
          name_en: "Robot Right Arm",
          icon: "🦾",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_right_arm",
          usage_th: "พรี-วางประกอบเป็นแขนขวาของหุ่นยนต์",
          usage_en: "Pre-place to attach right arm module to robot cockpit.",
          maxStack: 99
        },
        "ROBOT_LEFT_LEG": {
          id: "ROBOT_LEFT_LEG",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ขาซ้ายหุ่นยนต์",
          name_en: "Robot Left Leg",
          icon: "🦿",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_left_leg",
          usage_th: "พรี-วางประกอบเป็นขาซ้ายของหุ่นยนต์",
          usage_en: "Pre-place to attach left leg module to robot frame.",
          maxStack: 99
        },
        "ROBOT_RIGHT_LEG": {
          id: "ROBOT_RIGHT_LEG",
          category: ITEM_CATEGORIES.PRE_PLACE,
          name_th: "ขาขวาหุ่นยนต์",
          name_en: "Robot Right Leg",
          icon: "🦿",
          actionType: "PLACE_STRUCTURE",
          placeType: "robot_right_leg",
          usage_th: "พรี-วางประกอบเป็นขาขวาของหุ่นยนต์",
          usage_en: "Pre-place to attach right leg module to robot frame.",
          maxStack: 99
        },

        // --- 2. หมวดไอเทมถือ (HOLDABLE) ---
        "AXE": {
          id: "AXE",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ขวาน",
          name_en: "Axe",
          icon: "🪓",
          actionType: "TOOL_CHOP",
          damage: 2,
          usage_th: "ถือในมือ คลิกซ้ายใช้ตัดต้นไม้เพื่อเก็บท่อนไม้ และใช้โจมตีทำดาเมจ 2 จุด",
          usage_en: "Hold in hand. Left-click to chop trees for logs and attack for 2 DMG.",
          maxStack: 1
        },
        "PICKAXE": {
          id: "PICKAXE",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "อีเตอร์",
          name_en: "Pickaxe",
          icon: "⛏️",
          actionType: "TOOL_MINE",
          damage: 2,
          usage_th: "ถือในมือ คลิกซ้ายใช้ขุดเจาะหินและแร่ธาตุ และใช้โจมตีทำดาเมจ 2 จุด",
          usage_en: "Hold in hand. Left-click to mine rocks and ores, and attack for 2 DMG.",
          maxStack: 1
        },
        "SHOVEL": {
          id: "SHOVEL",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "พลั่ว",
          name_en: "Shovel",
          icon: "🥄",
          actionType: "TOOL_DIG",
          damage: 1,
          usage_th: "ถือในมือ คลิกซ้ายขุดปรับแต่งระดับภูมิประเทศหลุม/คูน้ำ และใช้โจมตีทำดาเมจ 1 จุด",
          usage_en: "Hold in hand. Left-click to dig/terraform terrain and attack for 1 DMG.",
          maxStack: 1
        },
        "BOW": {
          id: "BOW",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ธนู",
          name_en: "Bow",
          icon: "🏹",
          actionType: "WEAPON_RANGED",
          damage: 1.5,
          usage_th: "ถือในมือ เล็งและคลิกซ้ายยิงลูกธนูระยะไกล (ต้องมีลูกธนู ARROW ในกระเป๋า)",
          usage_en: "Hold in hand. Aim and left-click to shoot arrows (requires ARROW in inventory).",
          maxStack: 1
        },
        "WOODEN_ARM_CANNON": {
          id: "WOODEN_ARM_CANNON",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ปืนไม้ติดแขน",
          name_en: "Wooden Arm Cannon",
          icon: "🪵🦾",
          actionType: "WEAPON_RANGED",
          damage: 2.5,
          usage_th: "สวมครอบแขน เล็งและคลิกซ้ายยิงลูกธนูพลังสูง (ต้องมีลูกธนู ARROW ในกระเป๋า)",
          usage_en: "Mounted on arm. Aim and left-click to shoot high-velocity arrows (requires ARROW in inventory).",
          maxStack: 1
        },
        "ARM_CANNON": {
          id: "WOODEN_ARM_CANNON",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ปืนไม้ติดแขน",
          name_en: "Wooden Arm Cannon",
          icon: "🪵🦾",
          actionType: "WEAPON_RANGED",
          damage: 2.5,
          usage_th: "สวมครอบแขน เล็งและคลิกซ้ายยิงลูกธนูพลังสูง (ต้องมีลูกธนู ARROW ในกระเป๋า)",
          usage_en: "Mounted on arm. Aim and left-click to shoot high-velocity arrows (requires ARROW in inventory).",
          maxStack: 1
        },
        "BRANCH": {
          id: "BRANCH",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "กิ่งไม้",
          name_en: "Branch",
          icon: "🌿",
          actionType: "WEAPON_MELEE",
          damage: 1,
          usage_th: "ถือในมือ ใช้ฟาดโจมตีระยะประชิด ทำดาเมจ 1 จุด (กิ่งไม้จะหักเมื่อฟาดโดนเป้าหมาย)",
          usage_en: "Hold in hand. Swing to melee attack for 1 DMG (breaks upon successful hit).",
          maxStack: 99
        },
        "FRIED_BUG": {
          id: "FRIED_BUG",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "แมลงทอด",
          name_en: "Fried Bug",
          icon: "🍤",
          actionType: "CONSUMABLE_FOOD",
          healHP: 5,
          usage_th: "ถือในมือ/คลิกใช้ รับประทานเพื่อฟื้นฟูพลังชีวิตผู้เล่น HP +5 ช่อง",
          usage_en: "Hold or use to eat and restore 5 Player HP points.",
          maxStack: 99
        },

        // --- 3. หมวดไอเทมที่ไม่ใช่ทั้ง พรี-วาง และ ถือ (NONE) ---
        "ROCK": {
          id: "ROCK",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หิน",
          name_en: "Rock",
          icon: "🪨",
          actionType: "RAW_MATERIAL",
          usage_th: "วัตถุดิบธรรมชาติ เก็บจากพื้น ใช้สำหรับคราฟต์ขวาน อีเตอร์ และกองไฟ",
          usage_en: "Natural material picked from ground. Used to craft Axe, Pickaxe, and Campfire.",
          maxStack: 99
        },
        "BIG_ROCK": {
          id: "BIG_ROCK",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หินใหญ่",
          name_en: "Big Rock",
          icon: "🪨",
          actionType: "RAW_MATERIAL",
          usage_th: "วัตถุดิบก้อนหิน ได้จากการขุดหิน ใช้สำหรับคราฟต์พลั่ว ลูกธนู และพื้นหิน",
          usage_en: "Large rock mined from stone nodes. Used to craft Shovel, Arrows, and Stone Floor.",
          maxStack: 99
        },
        "LOG": {
          id: "LOG",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ท่อนไม้",
          name_en: "Wood Log",
          icon: "🪵",
          actionType: "RAW_MATERIAL",
          usage_th: "วัตถุดิบท่อนไม้หลักจากการตัดต้นไม้ ใช้สำหรับคราฟต์สิ่งปลูกสร้าง โครงสร้าง และเรือ",
          usage_en: "Primary wood resource from trees. Used to craft structures, buildings, and boats.",
          maxStack: 99
        },
        "IRON_ORE": {
          id: "IRON_ORE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แร่เหล็ก",
          name_en: "Iron Ore",
          icon: "🟥",
          actionType: "ORE_RESOURCE",
          usage_th: "วัตถุดิบแร่เหล็ก ได้จากการขุดสายแร่ ใช้สำหรับคราฟต์ล้อไม้และเครื่องยนต์ไฟฟ้า",
          usage_en: "Iron mineral ore. Used to craft Wooden Wheels and Electric Engines.",
          maxStack: 99
        },
        "GOLD_ORE": {
          id: "GOLD_ORE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แร่ทองคำ",
          name_en: "Gold Ore",
          icon: "🪙",
          actionType: "ORE_RESOURCE",
          usage_th: "วัตถุดิบแร่ทองคำมีค่า หายาก ได้จากการขุดสายแร่ทองคำ ใช้สำหรับงานประดิษฐ์ชั้นสูง",
          usage_en: "Precious gold ore mined from veins. Used for advanced crafting and technology.",
          maxStack: 99
        },
        "GLOW_ORE": {
          id: "GLOW_ORE",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แร่หินเรืองแสง",
          name_en: "Glow Ore",
          icon: "✨",
          actionType: "ORE_RESOURCE",
          usage_th: "วัตถุดิบแร่หินเรืองแสงพลังงานสูง ได้จากการขุดสายแร่ ใช้คราฟต์แบตเตอรี่เรืองแสง",
          usage_en: "Luminescent energy ore. Used to craft Glowing Battery rods.",
          maxStack: 99
        },
        "GLOW_BATTERY": {
          id: "GLOW_BATTERY",
          category: ITEM_CATEGORIES.NONE,
          name_th: "หินเรืองแสงอัดแท่ง(แบต)",
          name_en: "Glowing Battery Rod",
          icon: "🔋",
          actionType: "ENERGY_SOURCE",
          usage_th: "แหล่งพลังงานไฟฟ้าสำหรับขับเคลื่อนเครื่องยนต์เรือ (จ่ายไฟอัตโนมัติจากในกระเป๋า)",
          usage_en: "Automated power cell stored in inventory to power electric boat engines.",
          maxStack: 99
        },
        "GLOW_BATTERY_EMPTY": {
          id: "GLOW_BATTERY_EMPTY",
          category: ITEM_CATEGORIES.NONE,
          name_th: "แบตเตอรี่เรืองแสง(หมดพลังงาน)",
          name_en: "Empty Glowing Battery",
          icon: "🪫",
          actionType: "ENERGY_SOURCE_EMPTY",
          usage_th: "แบตเตอรี่ที่หมดพลังงานแล้ว จะทำการชาร์จไฟอัตโนมัติเมื่ออยู่ในกระเป๋า (ใช้เวลา 5 นาที)",
          usage_en: "Empty power cell. It will automatically recharge while in your inventory (takes 5 mins).",
          maxStack: 99
        },
        "ARROW": {
          id: "ARROW",
          category: ITEM_CATEGORIES.NONE,
          name_th: "ลูกธนู",
          name_en: "Arrow",
          icon: "🏹",
          actionType: "AMMO",
          usage_th: "กระสุนลูกธนูในกระเป๋า สำหรับใช้งานยิงร่วมกับธนู (BOW)",
          usage_en: "Ammunition stored in inventory, consumed when firing the Bow.",
          maxStack: 99
        },
        "IRON_BULLET": {
          id: "IRON_BULLET",
          category: ITEM_CATEGORIES.NONE,
          name_th: "กระสุนเหล็ก ทรงกลม",
          name_en: "Spherical Iron Bullet",
          icon: "⚪",
          actionType: "AMMO",
          usage_th: "กระสุนเหล็กทรงกลมสำหรับใช้เป็นเครื่องกระสุนยิงปืน/ปืนติดแขน (สร้างดาเมจ 3 HP / เจาะทำลายศิลาออบซิเดียนได้) คราฟต์จากแร่เหล็ก 1 อันได้ 5 นัด",
          usage_en: "Spherical iron ammunition dealing 3 HP damage (capable of damaging Obsidian Cubes). Crafted from 1 Iron Ore = 5 Bullets.",
          maxStack: 99
        },
        "OBSIDIAN_FLUX": {
          id: "OBSIDIAN_FLUX",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ออบซิเดียนฟลักซ์ (Obsidian Flux)",
          name_en: "Obsidian Flux",
          icon: "⚫",
          actionType: "WARP_ITEM",
          usage_th: "ไอเทมวาร์ปออบซิเดียนฟลักซ์ ใส่ในช่อง UI แอคชั่นแล้วกดใช้งานเพื่อเปิดหน้าต่างวาร์ปไปยังแท่นวาร์ป (Obsidian Pad) ที่วางไว้ตามลำดับ (การวาร์ป 1 ครั้งจะทำลาย Obsidian Flux 1 อัน)",
          usage_en: "Obsidian Flux warp item. Equip in Action UI and use to open the Warp UI and teleport to any placed Obsidian Pad in placement order (consumes 1 Obsidian Flux per warp).",
          maxStack: 99
        },
        "OBSIDIAN_BALL": {
          id: "OBSIDIAN_FLUX",
          category: ITEM_CATEGORIES.HOLDABLE,
          name_th: "ออบซิเดียนฟลักซ์ (Obsidian Flux)",
          name_en: "Obsidian Flux",
          icon: "⚫",
          actionType: "WARP_ITEM",
          usage_th: "ไอเทมวาร์ปออบซิเดียนฟลักซ์ ใส่ในช่อง UI แอคชั่นแล้วกดใช้งานเพื่อเปิดหน้าต่างวาร์ปไปยังแท่นวาร์ป (Obsidian Pad) ที่วางไว้ตามลำดับ (การวาร์ป 1 ครั้งจะทำลาย Obsidian Flux 1 อัน)",
          usage_en: "Obsidian Flux warp item. Equip in Action UI and use to open the Warp UI and teleport to any placed Obsidian Pad in placement order (consumes 1 Obsidian Flux per warp).",
          maxStack: 99
        }
      };
      window.ITEM_DEFINITIONS = ITEM_DEFINITIONS;
      if (window.ItemRegistry && typeof window.ItemRegistry === "object") {
        Object.assign(window.ItemRegistry, ITEM_DEFINITIONS);
      } else {
        window.ItemRegistry = Object.assign({}, ITEM_DEFINITIONS);
      }

      window.ItemRegistry["iron_bullet"] = {
        render: function(item, vertices, colors, indices, targetBuffer) {
          const p = item.position || [0, 0, 0];
          const s = typeof playerScale !== 'undefined' ? playerScale : 0.1;
          const radius = (item.radius || 0.18) * s;
          const segsLat = 12;
          const segsLong = 16;
          const ironColor = [0.75, 0.78, 0.82];

          if (typeof buildLowPolySphere === "function") {
            buildLowPolySphere(p, radius, segsLat, ironColor, 0, 0, vertices, colors, indices);
          } else {
            const startIdx = vertices.length / 3;
            for (let lat = 0; lat <= segsLat; lat++) {
              const theta = (lat / segsLat) * Math.PI;
              const sinTheta = Math.sin(theta);
              const cosTheta = Math.cos(theta);

              for (let lon = 0; lon <= segsLong; lon++) {
                const phi = (lon / segsLong) * Math.PI * 2;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const dx = sinTheta * cosPhi;
                const dy = cosTheta;
                const dz = sinTheta * sinPhi;

                vertices.push(p[0] + radius * dx, p[1] + radius * dy, p[2] + radius * dz);

                const light = Math.max(0.3, dx * 0.35 + dy * 0.75 + dz * 0.55);
                const spec = Math.pow(Math.max(0, dy * 0.65 + dz * 0.7), 6) * 0.35;
                colors.push(
                  Math.min(1.0, ironColor[0] * light + spec),
                  Math.min(1.0, ironColor[1] * light + spec),
                  Math.min(1.0, ironColor[2] * light + spec)
                );
              }
            }

            for (let lat = 0; lat < segsLat; lat++) {
              for (let lon = 0; lon < segsLong; lon++) {
                const first = startIdx + lat * (segsLong + 1) + lon;
                const second = first + segsLong + 1;
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
              }
            }
          }
        }
      };
      window.ItemRegistry["IRON_BULLET"] = window.ItemRegistry["iron_bullet"];

      // Helper functions for Backend Item System
      function getItemDefinition(itemOrName) {
        if (!itemOrName) return null;
        let key = typeof itemOrName === "string" ? itemOrName : (itemOrName.name || itemOrName.id || itemOrName.label || itemOrName.type || "");
        key = key.toUpperCase();
        if (key === "CHEST") key = "WOOD_CHEST";
        if (key === "MEGANEURA_ITEM") key = "MEGANEURA";
        if (key === "ISOPOD_ITEM") key = "ISOPOD";
        return ITEM_DEFINITIONS[key] || null;
      }
      window.getItemDefinition = getItemDefinition;

      function getItemCategory(itemOrName) {
        const def = getItemDefinition(itemOrName);
        let cat = def ? def.category : ITEM_CATEGORIES.NONE;
        
        // ถ้ากำลังขับขี่ยานพาหนะ ไอเทมที่เป็น PRE_PLACE จะถูกปรับสภาพเป็น NONE ชั่วคราวทั้งหมด
        const isRiding = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) ||
                         (typeof activeRidingMech !== "undefined" && activeRidingMech);
                         
        if (isRiding) {
          const isPrePlace = Array.isArray(cat) ? cat.includes(ITEM_CATEGORIES.PRE_PLACE) : (cat === ITEM_CATEGORIES.PRE_PLACE);
          if (isPrePlace) {
            return ITEM_CATEGORIES.NONE;
          }
        }
        
        return cat;
      }
      window.getItemCategory = getItemCategory;
      
      function hasItemCategory(itemOrName, targetCategory) {
        const cat = getItemCategory(itemOrName);
        if (Array.isArray(cat)) {
          return cat.includes(targetCategory);
        }
        return cat === targetCategory;
      }
      window.hasItemCategory = hasItemCategory;

      function isPlaceableItem(itemOrName) {
        return hasItemCategory(itemOrName, ITEM_CATEGORIES.PRE_PLACE);
      }
      window.isPlaceableItem = isPlaceableItem;

      function isHoldableItem(itemOrName) {
        return hasItemCategory(itemOrName, ITEM_CATEGORIES.HOLDABLE);
      }
      window.isHoldableItem = isHoldableItem;

      function isNoneItem(itemOrName) {
        return hasItemCategory(itemOrName, ITEM_CATEGORIES.NONE);
      }
      window.isNoneItem = isNoneItem;

      function getStoredLanguageFallback() {
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            const raw = window.localStorage.getItem("seedplanet_options_config");
            if (raw) {
              const obj = JSON.parse(raw);
              if (obj && obj.language) return obj.language;
            }
          }
        } catch (_) {}
        return "en";
      }

      function getItemDisplayName(itemOrName, lang) {
        const curLang = lang || (typeof window.getGameLanguage === "function" ? window.getGameLanguage() : (window.gameLanguage || getStoredLanguageFallback()));
        const def = getItemDefinition(itemOrName);
        if (def) {
          if (curLang === "th") return def.name_th || def.name_en;
          if (curLang === "seedian") {
            const raw = def.name_th || def.name_en;
            return (window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(raw) : raw;
          }
          return def.name_en || def.name_th;
        }
        if (typeof window.t === "function") {
          const rawName = typeof itemOrName === "string" ? itemOrName : (itemOrName?.name || itemOrName?.type || "");
          const cleanKey = "item_" + String(rawName).toUpperCase();
          const translated = window.t(cleanKey);
          if (translated && translated !== cleanKey) return translated;
        }
        if (typeof itemOrName === "string") {
          return (curLang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(itemOrName) : itemOrName;
        }
        const fallback = itemOrName?.label || itemOrName?.name || "ITEM";
        return (curLang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(fallback) : fallback;
      }
      window.getItemDisplayName = getItemDisplayName;

      function getItemUsage(itemOrName, lang) {
        const curLang = lang || (typeof window.getGameLanguage === "function" ? window.getGameLanguage() : (window.gameLanguage || getStoredLanguageFallback()));
        const def = getItemDefinition(itemOrName);
        if (def) {
          if (curLang === "th") return def.usage_th || def.usage_en;
          if (curLang === "seedian") {
            const raw = def.usage_th || def.usage_en;
            return (window.Seedian && typeof window.Seedian.toSeedian === "function") ? window.Seedian.toSeedian(raw) : raw;
          }
          return def.usage_en || def.usage_th;
        }
        return "";
      }
      window.getItemUsage = getItemUsage;