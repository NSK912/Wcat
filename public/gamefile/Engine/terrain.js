// === SEEDPLANET MODULE: JS/TERRAIN.JS ===

      // ============================================
      // ตัวแปร
      // ============================================
      let vertexBuffer, colorBuffer, indexBuffer;
      let wireframeBuffer, wireColorBuffer;
      let dotBuffer, dotColorBuffer;
      let waterVertexBuffer, waterIndexBuffer;
      let indicesLength = 0;
      let waterIndicesLength = 0;
      let currentNatureCount = 60;
      let wireframePointCount = 0;
      let targetLineBuffer, targetLineColorBuffer;
      let actionReachLineBuffer, actionReachColorBuffer;

      let cubeVertexBuffer, cubeColorBuffer, cubeNormalBuffer, cubeIndexBuffer;
      let cubeIndicesLength = 0;

      let natureVertexBuffer,
        natureColorBuffer,
        natureNormalBuffer,
        natureIndexBuffer;
      let natureIndicesLength = 0;
      let natureGrassStartIndex = 0;
      let natureGrassIndexCount = 0;
      window.grassChunks = window.grassChunks || [];
      var grassChunks = window.grassChunks;

      let collectibleVertexBuffer,
        collectibleColorBuffer,
        collectibleNormalBuffer,
        collectibleIndexBuffer;
      let collectibleIndicesLength = 0;
      var collectibles = window.collectibles || [];
      window.collectibles = collectibles;
      let dynamicCollectibleVertexBuffer,
        dynamicCollectibleColorBuffer,
        dynamicCollectibleNormalBuffer,
        dynamicCollectibleIndexBuffer;
      let dynamicCollectibleIndicesLength = 0;

      let amphibians = [];
      let amphibianVertexBuffer,
        amphibianColorBuffer,
        amphibianNormalBuffer,
        amphibianIndexBuffer;
      let amphibianIndicesLength = 0;

      let fireVertexBuffer,
        fireColorBuffer,
        fireNormalBuffer,
        fireIndexBuffer;
      let fireIndicesLength = 0;

      let windowGlassVertexBuffer, windowGlassIndexBuffer;

      let collectedCount = { rock: 0, branch: 0, big_rock: 0 };
      let pendingCollectibleRefresh = false;
      let savedCollectiblesState = null;
      let savedAmphibiansState = null;

      let shadowVertexBuffer, shadowColorBuffer, shadowIndexBuffer;
      let shadowIndicesLength = 0;
      let previewVertexBuffer, previewColorBuffer, previewNormalBuffer, previewIndexBuffer;
      let previewIndicesLength = 0;
      let hitboxVertexBuffer, hitboxColorBuffer, hitboxIndexBuffer;
      let hitboxIndicesLength = 0;
      let natureRawVertices = [];
      let cubeRawVertices = [];
      let charRawVertices = [];
      let tunnelRawVertices = [];
      let tunnelRawIndices = [];
      let natureObstacles = [];
      window.natureObstacles = natureObstacles;
      let cubeObstacles = [];
      window.cubeObstacles = cubeObstacles;
      let choppedTrees = [];
      window.choppedTrees = choppedTrees;
      let destroyedRocks = [];
      window.destroyedRocks = destroyedRocks;

      let charVertexBuffer,
        charNormalBuffer,
        charIndexBuffer,
        charLocalVertexBuffer,
        charColorBuffer;
      let charIndicesLength = 0;
      
      let equipVertexBuffer, equipColorBuffer, equipIndexBuffer, equipNormalBuffer;
      let equipIndicesLength = 0;

      let sunVertexBuffer, sunColorBuffer, sunIndexBuffer;
      let sunIndicesLength = 0;

      let charTheta = Math.PI / 2;
      let charPhi = Math.PI / 2;
      let charHeading = 0.0;
      let walkPhase = 0.0;
      let lastFootstepPhase = 0.0;
      let isWalking = false;
      let isJumping = false;
      let jumpVelocity = 0.0;
      let charHeightOffset = 0.0;
      let jumpPhase = 0.0;
      let jumpBlend = 0.0;
      let currentSwimFactor = 0.0;
      let lastSwimFactor = 0.0;
      let swimMovementFactor = 0.0;
      let playerDiveDepth = 0.0;
      let lastMoveForwardInput = 0.0;
      let isDivingMode = false;
      let lastIsCameraUnderwater = false;
      let activeRidingBoat = null;
      let activeRidingMech = null;
      let boatRowTimer = 0.0;
      let playerSpeed = 0.005;

      // Player HP state and functions
      let playerHP = 5;
      let playerMaxHP = 5;
      let playerDamageCooldown = 0.0;
      playerControlsLocked = false;


      // ============================================
      // ฟังก์ชันสร้างภูมิประเทศ
      // ============================================





      function isTargetWithinReach(itemPos, maxReach = actionReachDistance) {
        if (!itemPos) return { valid: false, t: Infinity, perpSq: Infinity };

        if (actionReachMode === 1) {
          // Mode 1: Line-based Action Reach
          return isTargetWithinActionLine(itemPos, maxReach);
        } else if (actionReachMode === 2) {
          // Mode 2: Circular-based Action Reach (around the feet)
          const sinTheta = Math.sin(charTheta);
          const cosTheta = Math.cos(charTheta);
          const sinPhi = Math.sin(charPhi);
          const cosPhi = Math.cos(charPhi);
          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;

          const r_terrain = RADIUS + (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : getHeightOnSphere)(charTheta, charPhi, window.globalSeed) * HEIGHT_SCALE;
          const r_feet = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : r_terrain;
          const feetPos = [nx * r_feet, ny * r_feet, nz * r_feet];

          const dx = itemPos[0] - feetPos[0];
          const dy = itemPos[1] - feetPos[1];
          const dz = itemPos[2] - feetPos[2];

          const d_normal = dx * nx + dy * ny + dz * nz;
          const dx_tangent = dx - d_normal * nx;
          const dy_tangent = dy - d_normal * ny;
          const dz_tangent = dz - d_normal * nz;
          const distSq = dx_tangent * dx_tangent + dy_tangent * dy_tangent + dz_tangent * dz_tangent;

          // within the reach cylinder and within character's vertical space
          const heightDiff = Math.abs(d_normal);
          const heightValid = heightDiff <= 1.2 * playerScale;

          const valid = distSq <= maxReach * maxReach && heightValid;
          return { valid, t: Math.sqrt(distSq), perpSq: distSq };
        } else {
          // Mode 3: Capsule-based Action Reach (covering/around the character)
          const sinTheta = Math.sin(charTheta);
          const cosTheta = Math.cos(charTheta);
          const sinPhi = Math.sin(charPhi);
          const cosPhi = Math.cos(charPhi);
          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;

          const r_terrain = RADIUS + (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : getHeightOnSphere)(charTheta, charPhi, window.globalSeed) * HEIGHT_SCALE;
          const r_feet = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : r_terrain;
          const r_head = (playerCenterRadius !== null) ? (playerCenterRadius + 0.46 * playerScale) : (r_terrain + 1.16 * playerScale);

          const A = [nx * r_feet, ny * r_feet, nz * r_feet];
          const B = [nx * r_head, ny * r_head, nz * r_head];
          const L = r_head - r_feet;

          const AP = [itemPos[0] - A[0], itemPos[1] - A[1], itemPos[2] - A[2]];
          const dot = AP[0] * nx + AP[1] * ny + AP[2] * nz;
          const t_proj = Math.max(0.0, Math.min(1.0, dot / (L || 1.0)));

          const C = [
            A[0] + t_proj * nx * L,
            A[1] + t_proj * ny * L,
            A[2] + t_proj * nz * L
          ];

          const dx = itemPos[0] - C[0];
          const dy = itemPos[1] - C[1];
          const dz = itemPos[2] - C[2];
          const distSq = dx * dx + dy * dy + dz * dz;

          const valid = distSq <= maxReach * maxReach;
          return { valid, t: Math.sqrt(distSq), perpSq: distSq };
        }
      }

      function calculateForwardTarget() {
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);
        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;
        
        const playerRadius = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) 
          ? playerCenterRadius 
          : (RADIUS + (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : getHeightOnSphere)(charTheta, charPhi, window.globalSeed) * HEIGHT_SCALE);
          
        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
        
        const cosH = Math.cos(charHeading);
        const sinH = Math.sin(charHeading);
        const flatAimDir = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH,
        ];
        
        // Pitch the aim direction based on camera rotationX
        const pitch = typeof rotationX !== 'undefined' ? rotationX : 0;
        const cp = Math.cos(-pitch);
        const sp = Math.sin(-pitch);
        const aimDir = [
            flatAimDir[0] * cp + nx * sp,
            flatAimDir[1] * cp + ny * sp,
            flatAimDir[2] * cp + nz * sp
        ];
        
        // Raymarch forward to find the wall/cliff of the existing hole
        // This ensures right-click digging targets the wall of the hole to expand it, rather than empty air or the floor
        let bestReach = -1;
        const maxSearch = actionReachDistance * 1.5; // Limit search/dig distance for right-click to prevent infinite chaining
        const stepSize = 0.02;
        
        for (let d = 0.03; d <= maxSearch; d += stepSize) {
            const px = nx * playerRadius + aimDir[0] * d;
            const py = ny * playerRadius + aimDir[1] * d;
            const pz = nz * playerRadius + aimDir[2] * d;
            
            const distToCenter = Math.sqrt(px*px + py*py + pz*pz);
            if (distToCenter < 0.001) continue;
            
            const sx = px / distToCenter;
            const sy = py / distToCenter;
            const sz = pz / distToCenter;
            
            const targetTheta = Math.acos(sy);
            const targetPhi = Math.atan2(sz, sx);
            
            const tHeight = getHeightOnSphere(targetTheta, targetPhi, window.globalSeed);
            const tRadius = RADIUS + tHeight * HEIGHT_SCALE;
            const floorTopRadius = getFloorTopRadiusAt(sx, sy, sz, tRadius);
            
            // Check if inside any 3D tunnel sphere (hollow space)
            const insideTunnel = isPositionInsideCave(px, py, pz);
            
            // It's a hit if inside the solid terrain / floor and NOT inside a hollow tunnel
            if (!insideTunnel && floorTopRadius >= distToCenter) {
                bestReach = d;
                break;
            }
        }
        
        if (bestReach < 0) return null; // Didn't hit anything
        
        return [
            nx * playerRadius + aimDir[0] * bestReach,
            ny * playerRadius + aimDir[1] * bestReach,
            nz * playerRadius + aimDir[2] * bestReach
        ];
      }

      function isTargetWithinActionLine(itemPos, maxReach = actionReachDistance) {
        if (!itemPos) return { valid: false, t: Infinity, perpSq: Infinity };

        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);

        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;

        const height = (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : getHeightOnSphere)(charTheta, charPhi, window.globalSeed);
        const terrainRadius = RADIUS + height * HEIGHT_SCALE;

        const start = [
          terrainRadius * nx + nx * 0.05,
          terrainRadius * ny + ny * 0.05,
          terrainRadius * nz + nz * 0.05
        ];

        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
        const cosH = Math.cos(charHeading);
        const sinH = Math.sin(charHeading);
        const F = [
          North[0] * cosH + East[0] * sinH,
          North[1] * cosH + East[1] * sinH,
          North[2] * cosH + East[2] * sinH,
        ];

        const dx = itemPos[0] - start[0];
        const dy = itemPos[1] - start[1];
        const dz = itemPos[2] - start[2];

        // Project the difference vector onto the horizontal tangent plane of the sphere
        const d_normal = dx * nx + dy * ny + dz * nz;
        const dx_tangent = dx - d_normal * nx;
        const dy_tangent = dy - d_normal * ny;
        const dz_tangent = dz - d_normal * nz;
        const distTangent = Math.sqrt(dx_tangent * dx_tangent + dy_tangent * dy_tangent + dz_tangent * dz_tangent);

        const t = dx * F[0] + dy * F[1] + dz * F[2];

        const rx = dx_tangent - t * F[0];
        const ry = dy_tangent - t * F[1];
        const rz = dz_tangent - t * F[2];
        const perpSqTangent = rx * rx + ry * ry + rz * rz;

        // Tighter cylinder radius of 0.2 meters (perpSqTangent <= 0.04)
        const inCylinder = perpSqTangent <= 0.04 * (playerScale / 0.1);

        // Horizontal angle check: must face/aim within 35 degrees of the item center (cosAngleTangent >= 0.819)
        // Bypassed if player is extremely close (distTangent <= 0.25 * (playerScale / 0.1))
        let angleValid = true;
        if (distTangent > 0.25 * (playerScale / 0.1)) {
          const cosAngleTangent = t / (distTangent || 1.0);
          angleValid = cosAngleTangent >= 0.819;
        }

        const valid = t >= 0.0 && t <= maxReach && inCylinder && angleValid;

        return { valid, t, perpSq: perpSqTangent };
      }

      function getFloorTopRadiusAt(nx, ny, nz, baseTerrainRadius) {
        let maxRadius = baseTerrainRadius;
        
        // The player's feet radius is:
        const currentFeetRadius = (playerCenterRadius !== null) 
          ? (playerCenterRadius - 0.46 * playerScale) 
          : baseTerrainRadius;
          
        const playerPos = [nx * currentFeetRadius, ny * currentFeetRadius, nz * currentFeetRadius];
          
        for (let other of collectibles) {
          if (other.active && (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "robot_stand") && !other.isPreview) {
            const dx_dist = playerPos[0] - other.position[0];
            const dy_dist = playerPos[1] - other.position[1];
            const dz_dist = playerPos[2] - other.position[2];
            const maxReach = (other.width !== undefined || other.depth !== undefined)
              ? (Math.max(other.width || 3.0, other.depth || 3.0) * 0.75 + 2.0)
              : 6.0;
            if (dx_dist * dx_dist + dy_dist * dy_dist + dz_dist * dz_dist > maxReach * maxReach) {
              continue;
            }
            // Project the direction vector [nx, ny, nz] onto the flat floor's plane
            const u_dot_n = nx * other.normal[0] + ny * other.normal[1] + nz * other.normal[2];
            if (u_dot_n > 0.01) {
              const pos_dot_n = other.position[0] * other.normal[0] +
                                other.position[1] * other.normal[1] +
                                other.position[2] * other.normal[2];
              const isStone = other.type === "stone_floor";
              const isStand = other.type === "robot_stand";
              const sizeVal = other.size || 0.25;
              const w = isStand ? 0.72 : (isStone ? (typeof other.width === "number" ? other.width : sizeVal * 12.0) : sizeVal * 1.2);
              const d = isStand ? 0.72 : (isStone ? (typeof other.depth === "number" ? other.depth : sizeVal * 12.0) : sizeVal * 1.2);
              const h = isStand ? 0.06 : (isStone ? sizeVal * 0.15 : (other.type === "wood_floor" ? (woodFloorHeight + 0.25 * 0.12) : (other.type === "thin_wood_floor" ? 0.25 * 0.04 : 0.25 * 0.08)));
              
              const hh = isStand ? 0.06 : (isStone ? h * 0.9 : h * 0.5);
              
              // The exact flat top collision radius in this direction is:
              const topRadius = (pos_dot_n + hh) / u_dot_n;
              
              // Project the 3D collision point onto the floor's local horizontal axes
              const collPos = [nx * topRadius, ny * topRadius, nz * topRadius];
              const dx_vec = [
                collPos[0] - other.position[0],
                collPos[1] - other.position[1],
                collPos[2] - other.position[2]
              ];
              
              const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
              const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
              
              const charMargin = 0.18 * (typeof playerScale !== 'undefined' ? playerScale : 0.1);
              const hw = w/2 + charMargin; // slightly larger for smooth transitions and boundaries
              const hd = d/2 + charMargin;
              
              if (Math.abs(dx) <= hw && Math.abs(dz) <= hd) {
                // Only stand on this floor if our feet are above it, OR only slightly below it (step-up threshold).
                // For stone floors or robot stands, require feet to be close to topRadius so player on ground doesn't snap up unnaturally.
                const stepUpLimit = (isStone || isStand) ? 0.12 * (playerScale / 0.1) : 0.15 * (playerScale / 0.1); 
                if (currentFeetRadius >= topRadius - stepUpLimit) {
                  if (topRadius > maxRadius) {
                    maxRadius = topRadius;
                  }
                }
              }
            }
          } else if (other.active && (other.type === "wood_stairs" || other.type === "folding_ladder") && !other.isPreview && other.stairTop && other.stairBottom) {
            const dx_dist = playerPos[0] - other.position[0];
            const dy_dist = playerPos[1] - other.position[1];
            const dz_dist = playerPos[2] - other.position[2];
            const maxLadderReachSq = other.type === "folding_ladder" ? 25.0 : 36.0;
            if (dx_dist * dx_dist + dy_dist * dy_dist + dz_dist * dz_dist > maxLadderReachSq) {
              continue;
            }

            const P_top = other.stairTop;
            const P_bottom = other.stairBottom;
            const dir_v = [P_top[0] - P_bottom[0], P_top[1] - P_bottom[1], P_top[2] - P_bottom[2]];
            const len_v = Math.sqrt(dir_v[0]*dir_v[0] + dir_v[1]*dir_v[1] + dir_v[2]*dir_v[2]) || 1;
            const dir_un = [dir_v[0] / len_v, dir_v[1] / len_v, dir_v[2] / len_v];

            const v_p = [
              playerPos[0] - P_bottom[0],
              playerPos[1] - P_bottom[1],
              playerPos[2] - P_bottom[2]
            ];

            const t_proj = v_p[0] * dir_un[0] + v_p[1] * dir_un[1] + v_p[2] * dir_un[2];
            // Extend slightly past ends for smooth transition
            const endMargin = other.type === "folding_ladder" ? 0.35 : 0.20;
            if (t_proj >= -endMargin && t_proj <= len_v + endMargin) {
              // Project sideways along stair/ladder tangent
              const stairR = (other.R && typeof other.R[0] === 'number') ? other.R : [1, 0, 0];
              const w_proj = v_p[0] * stairR[0] + v_p[1] * stairR[1] + v_p[2] * stairR[2];
              const maxW = other.type === "folding_ladder" ? 0.45 : 0.35;
              if (Math.abs(w_proj) <= maxW) {
                const clampedT = Math.max(0, Math.min(len_v, t_proj));
                const P_on_stair = [
                  P_bottom[0] + dir_un[0] * clampedT,
                  P_bottom[1] + dir_un[1] * clampedT,
                  P_bottom[2] + dir_un[2] * clampedT
                ];
                const r_stair = Math.sqrt(P_on_stair[0]*P_on_stair[0] + P_on_stair[1]*P_on_stair[1] + P_on_stair[2]*P_on_stair[2]);
                
                const stepUpLimit = (other.type === "folding_ladder" ? 0.60 : 0.35) * (typeof playerScale !== 'undefined' ? playerScale / 0.1 : 1.0);
                if (currentFeetRadius >= r_stair - stepUpLimit) {
                  if (r_stair > maxRadius) {
                    maxRadius = r_stair;
                  } else if (t_proj >= 0.1 && t_proj <= len_v - 0.1 && currentFeetRadius <= r_stair + 0.35) {
                    // Smoothly descend along ladder when entering caves or descending steep drops
                    maxRadius = r_stair;
                  }
                }
              }
            }
          }
        }
        return maxRadius;
      }



      if (!tunnels3D) tunnels3D = [];
      let lastGeneratedSeed = null;
      let lastGeneratedRadius = null;


      function getDensity(px, py, pz, skipNoise = false) {
        const len = Math.sqrt(px*px + py*py + pz*pz) || 1;
        const ux = px / len;
        const uy = py / len;
        const uz = pz / len;

        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        const phi = Math.atan2(uz, ux);
        const seed = typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined' ? window.globalSeed : 0;
        const h = typeof getHeightOnSphere === 'function' ? getHeightOnSphere(theta, phi, seed) : 0;
        let r_planet = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
        let h_scale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6;
        let terrainRadius = r_planet + h * h_scale;
        
        if (!skipNoise && typeof getFloorTopRadiusAt === "function") {
          terrainRadius = getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
        }

        // Base density: positive = solid ground, negative = air
        let density = terrainRadius - len;

        // Cave density subtraction
        if (typeof tunnels3D !== 'undefined' && tunnels3D && tunnels3D.length > 0) {
           let maxCaveDensity = -Infinity;
           for (let i = 0; i < tunnels3D.length; i++) {
              const t = tunnels3D[i];
              const dx = px - t.x, dy = py - t.y, dz = pz - t.z;
              const tDist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
              let currentR = t.r;
              if (skipNoise) {
                 // For a smooth collision boundary that is guaranteed to contain all bumpy peaks and prevent clipping,
                 // we reduce the smooth collision tunnel radius by the maximum fbmNoise deform factor (15%) with a safe buffer, leaving it at 88% of full radius
                 currentR *= 0.88;
              } else {
                 // Optimize by skipping expensive multi-octave fbmNoise if we are far from the tunnel boundary (where noise details do not affect density sign/boundary)
                 if (Math.abs(tDist - t.r) < t.r * 0.25 && typeof fbmNoise === "function") {
                    currentR += t.r * (fbmNoise((dx/tDist)*3.5, (dy/tDist)*3.5, (dz/tDist)*3.5, seed + 721, 3) * 0.15);
                 }
              }
              // caveDensity: positive inside the cave (air), negative outside
              const caveDensity = currentR - tDist;
              if (caveDensity > maxCaveDensity) {
                 maxCaveDensity = caveDensity;
              }
           }
           
           // If we are inside the cave volume, we carve out the solid terrain
           // But caves only carve underground. We use a smooth min/max or direct subtraction.
           // Apply continuous carving of terrain density both inside and outside cave tunnels
           density = Math.min(density, -maxCaveDensity);
        }
        
        return density;
      }
      
      // Export to window so collision and items can use it
      window.getTerrainDensity = getDensity;

      function getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadius) {
        const height = (typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : getHeightOnSphere)(Math.acos(Math.max(-1, Math.min(1, ny))), Math.atan2(nz, nx), typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined' ? window.globalSeed : 0);
        const maxTerrainRadius = (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) + height * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6);

        let ground = maxTerrainRadius;
        let ceiling = Infinity;
        let insideTunnel = false; let isEntrance = false;

        if (typeof tunnels3D !== 'undefined' && tunnels3D && tunnels3D.length > 0) {
          let bestTunnel = null;
          let bestDist = Infinity; let anyInside = false;
          let bestFloor = maxTerrainRadius;
          let bestCeiling = Infinity; 
          // isEntrance moved

          const px = nx * feetRadius;
          const py = ny * feetRadius;
          const pz = nz * feetRadius;

          for (let i = 0; i < tunnels3D.length; i++) {
            const t = tunnels3D[i];
            
            // 1. Check 3D distance to tunnel center (to see if we are inside the tunnel sphere in 3D)
            const dx = px - t.x;
            const dy = py - t.y;
            const dz = pz - t.z;
            const dist3D = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // 2. Check 1D intersection along the ray (for ground/ceiling calculation)
            const dot = nx * t.x + ny * t.y + nz * t.z;
            const tLenSq = t.x * t.x + t.y * t.y + t.z * t.z;
            const tRadius = t.r * 0.96;
            const d = dot * dot - tLenSq + tRadius * tRadius;

            if (d > 0) {
              let r_p1 = dot - Math.sqrt(d);
              let r_p2 = dot + Math.sqrt(d);

              if (typeof fbmNoise === "function") {
                  const seed = (typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined') ? window.globalSeed : 0;
                  
                  // Calculate deformed floor (r_p1)
                  const p1x = nx * r_p1 - t.x;
                  const p1y = ny * r_p1 - t.y;
                  const p1z = nz * r_p1 - t.z;
                  const dist1 = Math.sqrt(p1x*p1x + p1y*p1y + p1z*p1z) || 1;
                  const deform1 = fbmNoise((p1x/dist1) * 3.5, (p1y/dist1) * 3.5, (p1z/dist1) * 3.5, seed + 721, 3) * 0.15;
                  const r1_def = t.r * (1.0 + deform1);
                  const d1_def = dot * dot - tLenSq + r1_def * r1_def;
                  if (d1_def > 0) r_p1 = dot - Math.sqrt(d1_def);
                  
                  // Calculate deformed ceiling (r_p2)
                  const p2x = nx * r_p2 - t.x;
                  const p2y = ny * r_p2 - t.y;
                  const p2z = nz * r_p2 - t.z;
                  const dist2 = Math.sqrt(p2x*p2x + p2y*p2y + p2z*p2z) || 1;
                  const deform2 = fbmNoise((p2x/dist2) * 3.5, (p2y/dist2) * 3.5, (p2z/dist2) * 3.5, seed + 721, 3) * 0.15;
                  const r2_def = t.r * (1.0 + deform2);
                  const d2_def = dot * dot - tLenSq + r2_def * r2_def;
                  if (d2_def > 0) r_p2 = dot + Math.sqrt(d2_def);
              }

              // A segment is a cave mouth/entrance if its ceiling (r_p2) is near or above the surface terrain
              const isSegmentEntrance = (r_p2 >= maxTerrainRadius - t.r * 1.25);

              // Determine if player/character is physically inside the 3D sphere of the cave tunnel
              const isInsideSegment = (dist3D < t.r * 1.15) && (feetRadius < maxTerrainRadius || isSegmentEntrance); // Match visual hole radius and allow entrance from surface
              if (isInsideSegment) {
                anyInside = true;
                bestFloor = Math.min(bestFloor, r_p1);
                bestCeiling = Math.max(bestCeiling, r_p2);
                if (isSegmentEntrance) isEntrance = true;
              }
            }
          }

          if (anyInside) {
            ground = bestFloor;
            // For an entrance, we never block the player with a low ceiling at the mouth
            if (isEntrance) {
              ceiling = Infinity;
            } else {
              ceiling = bestCeiling;
            }
            insideTunnel = true;
          }
        }

        if (typeof getFloorTopRadiusAt === "function") {
          let floorGround = getFloorTopRadiusAt(nx, ny, nz, ground);
          if (floorGround !== -Infinity && floorGround > ground) ground = floorGround;
        }

        return { ground: ground, ceiling: ceiling, insideTunnel: insideTunnel, isEntrance: isEntrance, surfaceRadius: maxTerrainRadius };
      }
      window.getTerrainSurfaceAndCeiling = getTerrainSurfaceAndCeiling;

      function checkCaveAndTerrainCollision(P_new, P_curr, centerRadius, charScale, swimFactor, wRadius, diveDepth, swimMoveFactor, charHeight) {
        return CollisionCore.checkCaveAndTerrainCollision(P_new, P_curr, centerRadius, charScale, swimFactor, wRadius, diveDepth, swimMoveFactor, charHeight);
      }

      let tunnelVertexBuffer = null;
      let tunnelColorBuffer = null;
      let tunnelTerrainRadiusBuffer = null;
      let tunnelCenterBuffer = null;
      let tunnelIndexBuffer = null;
      let tunnelIndicesCount = 0;
      let tunnelWireframeIndexBuffer = null;
      let tunnelWireframeIndicesCount = 0;
      
      let tunnelShellVertexBuffer = null;
      let tunnelShellTerrainRadiusBuffer = null;
      let tunnelShellCenterBuffer = null;
      let tunnelShellIndexBuffer = null;
      let tunnelShellIndicesCount = 0;


      function buildPlanetAsync(gridSize, seed, onProgress) {
        return new Promise((resolve) => {
          currentCampfires = (typeof collectibles !== 'undefined' ? collectibles : []).filter(c => c.active && c.type === "campfire" && !c.isPreview);
          
          const rPlanet = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
          const calculatedGrid = gridSize || (typeof currentGridSize !== 'undefined' ? currentGridSize : Math.max(100, Math.min(1600, Math.round(rPlanet * 12.5))));
          const effGridSize = Math.max(50, Math.min(calculatedGrid, 1600));
          currentGridSize = effGridSize;
          if (typeof window !== 'undefined') window.currentGridSize = effGridSize;
          const latSeg = effGridSize;
          const longSeg = effGridSize;

          const vertexCount = (latSeg + 1) * (longSeg + 1);
          const vertices = new Float32Array(vertexCount * 3);
          const colors = new Float32Array(vertexCount * 3);
          const indexCount = latSeg * longSeg * 6;
          const isUint32 = supportUint32 && indexCount > 65535;
          const indices = isUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

          let lat = 0;
          const reusedResult = { height: 0, color: new Float32Array(3) };

          // Phase 1: Subterranean caves (async deferred)
          requestAnimationFrame(() => {
            if (onProgress) onProgress(5, "Surveying subterranean crust...", "[SYS_OK] Seed Planet Core Loaded");
            
            const currentRadius = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
            if (keepLoadedTunnels && tunnels3D && tunnels3D.length > 0) {
              keepLoadedTunnels = false;
              lastGeneratedSeed = seed;
              lastGeneratedRadius = currentRadius;
            } else if (!tunnels3D || tunnels3D.length === 0 || seed !== lastGeneratedSeed || lastGeneratedRadius !== currentRadius) {
              tunnels3D = [];
              generateSubterraneanCaves(seed);
              lastGeneratedSeed = seed;
              lastGeneratedRadius = currentRadius;
              rebuildTunnelBuffers();
              keepLoadedTunnels = false;
            }

            // Move to Phase 2: Terrain generation
            setTimeout(startTerrainGeneration, 0);
          });

          function startTerrainGeneration() {
            requestAnimationFrame(generateTerrainSlice);
          }

          function generateTerrainSlice() {
            const startTime = performance.now();
            
            while (lat <= latSeg) {
              const theta = (lat / latSeg) * Math.PI;
              const sinTheta = Math.sin(theta);
              const cosTheta = Math.cos(theta);

              let vIdx = (lat * (longSeg + 1)) * 3;
              for (let long = 0; long <= longSeg; long++) {
                const phi = (long / longSeg) * Math.PI * 2;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                getTerrainHeightAndColor(
                  theta,
                  phi,
                  seed,
                  reusedResult,
                );

                const height = reusedResult.height;
                const color = reusedResult.color;

                const r = RADIUS + height * HEIGHT_SCALE;
                let x = r * sinTheta * cosPhi;
                let y = r * cosTheta;
                let z = r * sinTheta * sinPhi;

                vertices[vIdx] = x;
                vertices[vIdx+1] = y;
                vertices[vIdx+2] = z;
                colors[vIdx] = color[0];
                colors[vIdx+1] = color[1];
                colors[vIdx+2] = color[2];
                vIdx += 3;
              }
              lat++;

              // Limit main thread usage to ~8ms to prevent any interface lag and preserve 60 FPS
              if (performance.now() - startTime > 8) {
                break;
              }
            }

            const percent = Math.floor((lat / latSeg) * 70);
            if (onProgress) {
              onProgress(
                percent, 
                `Generating planetary terrain (${lat}/${latSeg} rows)...`, 
                `[THREAD] Compiled row ${lat} with FBM noise octaves`
              );
            }

            if (lat <= latSeg) {
              requestAnimationFrame(generateTerrainSlice);
            } else {
              setTimeout(generateIndicesSlice, 0);
            }
          }

          let currentIndexL = 0;
          let iIdx = 0;
          function generateIndicesSlice() {
            const startTime = performance.now();
            
            while (currentIndexL < latSeg) {
              for (let long = 0; long < longSeg; long++) {
                const a = currentIndexL * (longSeg + 1) + long;
                const b = a + longSeg + 1;
                const c = a + 1;
                const d = b + 1;
                indices[iIdx++] = a;
                indices[iIdx++] = b;
                indices[iIdx++] = c;
                indices[iIdx++] = c;
                indices[iIdx++] = b;
                indices[iIdx++] = d;
              }
              currentIndexL++;
              
              // Limit main thread usage to ~8ms to keep loading responsive
              if (performance.now() - startTime > 8) {
                break;
              }
            }

            const progressPercent = 70 + Math.floor((currentIndexL / latSeg) * 5);
            if (onProgress) {
              onProgress(
                progressPercent, 
                "Compiling planetary index buffers...", 
                `[GPU] Calculated ${currentIndexL}/${latSeg} mesh rows`
              );
            }

            if (currentIndexL < latSeg) {
              requestAnimationFrame(generateIndicesSlice);
            } else {
              setTimeout(uploadBuffersAndBuildAux, 0);
            }
          }

          function uploadBuffersAndBuildAux() {
            indicesLength = indices.length;

            if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
            if (colorBuffer) gl.deleteBuffer(colorBuffer);
            if (indexBuffer) gl.deleteBuffer(indexBuffer);

            vertexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            terrainRawVertices = vertices;
            if (window.Graphics && Graphics.webgpu && Graphics.webgpu.device) {
              const device = Graphics.webgpu.device;
              
              if (Graphics.webgpu.terrainVertexBuffer) Graphics.webgpu.terrainVertexBuffer.destroy();
              Graphics.webgpu.terrainVertexBuffer = device.createBuffer({
                  size: vertices.byteLength,
                  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
              });
              device.queue.writeBuffer(Graphics.webgpu.terrainVertexBuffer, 0, vertices);
              
              if (Graphics.webgpu.terrainColorBuffer) Graphics.webgpu.terrainColorBuffer.destroy();
              Graphics.webgpu.terrainColorBuffer = device.createBuffer({
                  size: colors.byteLength,
                  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
              });
              device.queue.writeBuffer(Graphics.webgpu.terrainColorBuffer, 0, colors);
              
              if (Graphics.webgpu.terrainIndexBuffer) Graphics.webgpu.terrainIndexBuffer.destroy();
              Graphics.webgpu.terrainIndexBuffer = device.createBuffer({
                  size: indices.byteLength,
                  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
              });
              device.queue.writeBuffer(Graphics.webgpu.terrainIndexBuffer, 0, indices);
              
              Graphics.webgpu.terrainIndicesLength = indices.length;
              Graphics.webgpu.terrainUseUint32 = (indices instanceof Uint32Array);
            }

            gl.bufferData(
              gl.ARRAY_BUFFER,
              terrainRawVertices,
              gl.DYNAMIC_DRAW,
            );

            colorBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              colors,
              gl.STATIC_DRAW,
            );

            indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              indices,
              gl.STATIC_DRAW,
            );

            if (onProgress) onProgress(80, "Assembling auxiliary sphere systems...", "[VBO] Wireframe, water & skies uploading to VRAM...");
            
            buildWireframe(gridSize);
            buildWaterSphere(gridSize);
            
            setTimeout(() => {
              buildAtmosphereSphere(gridSize);
              buildSkySphere(gridSize);
              cubeObstacles = [];
              setTimeout(generateFloraAndFauna, 0);
            }, 0);
          }

          async function generateFloraAndFauna() {
            const activePlanet = (window.SpacesMap && typeof window.SpacesMap.getActivePlanet === "function") ? window.SpacesMap.getActivePlanet() : null;
            const systems = (activePlanet && activePlanet.systems) ? activePlanet.systems : ["terrain", "nature", "water", "caves", "clouds", "npcs", "physics", "player", "collectibles"];

            if (onProgress) onProgress(85, "Spawning natural forests and vegetation...", "[BIO] Simulating biosphere ecosystems...");
            
            const planetRadius = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
            const sampleRatio = Math.max(0.35, Math.pow(planetRadius / 8.0, 1.25));

            if (systems.includes("nature")) {
              const treeCount = window.globalTreeCountOverride !== undefined ? window.globalTreeCountOverride : Math.min(1000, Math.floor(sampleRatio * (130 + Math.floor(Math.random() * 41))));
              await buildNature(treeCount, seed);
            } else {
              if (typeof natureIndicesLength !== "undefined") natureIndicesLength = 0;
              natureRawVertices = [];
              natureObstacles = [];
              window.natureObstacles = natureObstacles;
            }

            if (onProgress) onProgress(92, "Assembling ancient ruins and collectibles...", "[OBJ] Generating procedural structures & VBOs...");
            await new Promise(r => setTimeout(r, 0));

            if (systems.includes("collectibles")) {
              buildCollectibles(Math.min(160, Math.floor(30 * sampleRatio)), seed);
            } else {
              if (typeof collectibleIndicesLength !== "undefined") collectibleIndicesLength = 0;
              collectibles = [];
              window.collectibles = [];
            }

            if (onProgress) onProgress(96, "Simulating planetary atmosphere and fauna...", "[ATM] Generating 3D clouds & amphibian life...");
            await new Promise(r => setTimeout(r, 0));

            if (systems.includes("clouds") || systems.includes("atmosphere")) {
              if (typeof window.generateClouds3D === "function") {
                  window.cloud3DData = window.generateClouds3D(seed, RADIUS, 12.0);
              }
            }

            if (systems.includes("npcs")) {
              const npcCount = (typeof window.calculatePlanetNpcCount === "function")
                ? window.calculatePlanetNpcCount(planetRadius)
                : Math.min(72, Math.max(8, Math.round(16 * Math.pow(planetRadius / 8.0, 1.35))));
              initAmphibians(npcCount, seed);
            } else {
              amphibians = [];
            }

            // buildSatellitePlanet creates the real Satellite Sun at [0,0,0]
            buildSatellitePlanet(seed);
            // buildExtraPlanets creates the 5 empty planets (planets 6 to 10)
            buildExtraPlanets(seed);
            updateCharacterMesh(0.0);

            if (onProgress) onProgress(100, "Synchronizing WebGL pipelines...", "[SYS] Compilation completed successfully!");
            resolve();
          }
        });
      }

      // ============================================
      // สร้างดาว
      // ============================================
      async function buildPlanet(gridSize, seed) {
        if (typeof window !== 'undefined' && typeof window.clearCache === 'function') {
          window.clearCache();
        }
        currentCampfires = (typeof collectibles !== 'undefined' ? collectibles : []).filter(c => c.active && c.type === "campfire" && !c.isPreview);
        
        const rPlanet = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
        if (keepLoadedTunnels && tunnels3D && tunnels3D.length > 0) {
          keepLoadedTunnels = false;
          lastGeneratedSeed = seed;
          lastGeneratedRadius = rPlanet;
        } else if (!tunnels3D || tunnels3D.length === 0 || seed !== lastGeneratedSeed || lastGeneratedRadius !== rPlanet) {
          tunnels3D = [];
          generateSubterraneanCaves(seed);
          lastGeneratedSeed = seed;
          lastGeneratedRadius = rPlanet;
          rebuildTunnelBuffers();
          keepLoadedTunnels = false;
        }
        const calculatedGrid = gridSize || (typeof currentGridSize !== 'undefined' ? currentGridSize : Math.max(100, Math.min(1600, Math.round(rPlanet * 12.5))));
        const effGridSize = Math.max(50, Math.min(calculatedGrid, 1600));
        currentGridSize = effGridSize;
        if (typeof window !== 'undefined') {
          window.currentGridSize = effGridSize;
          window.RADIUS = rPlanet;
          window.HEIGHT_SCALE = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6;
          window.globalSeed = seed;
        }
        const latSeg = effGridSize;
        const longSeg = effGridSize;

        const vertexCount = (latSeg + 1) * (longSeg + 1);
        const vertices = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 3);
        const indexCount = latSeg * longSeg * 6;
        const isUint32 = supportUint32 && indexCount > 65535;
        const indices = isUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

        if (gridSize > 300) {
          console.warn(
            `⚠️ ขนาด ${gridSize}x${gridSize} ใหญ่มาก อาจทำให้เครื่องช้าลง`,
          );
        }

        let vIdx = 0;
        const reusedResult = { height: 0, color: new Float32Array(3) };
        for (let lat = 0; lat <= latSeg; lat++) {
          const theta = (lat / latSeg) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let long = 0; long <= longSeg; long++) {
            const phi = (long / longSeg) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            getTerrainHeightAndColor(
              theta,
              phi,
              seed,
              reusedResult,
            );

            const height = reusedResult.height;
            const color = reusedResult.color;

            const r = RADIUS + height * HEIGHT_SCALE;
            let x = r * sinTheta * cosPhi;
            let y = r * cosTheta;
            let z = r * sinTheta * sinPhi;

            if (tunnels3D && tunnels3D.length > 0) {
              for (let t of tunnels3D) {
                const dx = x - t.x;
                const dy = y - t.y;
                const dz = z - t.z;
                if (dx*dx + dy*dy + dz*dz < t.rSq) {
                  x = 0;
                  y = 0;
                  z = 0;
                  break;
                }
              }
            }

            vertices[vIdx] = x;
            vertices[vIdx+1] = y;
            vertices[vIdx+2] = z;
            colors[vIdx] = color[0];
            colors[vIdx+1] = color[1];
            colors[vIdx+2] = color[2];
            vIdx += 3;
          }
        }

        let iIdx = 0;
        for (let lat = 0; lat < latSeg; lat++) {
          for (let long = 0; long < longSeg; long++) {
            const a = lat * (longSeg + 1) + long;
            const b = a + longSeg + 1;
            const c = a + 1;
            const d = b + 1;
            indices[iIdx++] = a;
            indices[iIdx++] = b;
            indices[iIdx++] = c;
            indices[iIdx++] = c;
            indices[iIdx++] = b;
            indices[iIdx++] = d;
          }
        }

        indicesLength = indices.length;

        if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
        if (colorBuffer) gl.deleteBuffer(colorBuffer);
        if (indexBuffer) gl.deleteBuffer(indexBuffer);

        vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        terrainRawVertices = vertices;
            if (window.Graphics && Graphics.webgpu && Graphics.webgpu.device) {
              const device = Graphics.webgpu.device;
              
              if (Graphics.webgpu.terrainVertexBuffer) Graphics.webgpu.terrainVertexBuffer.destroy();
              Graphics.webgpu.terrainVertexBuffer = device.createBuffer({
                  size: vertices.byteLength,
                  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
              });
              device.queue.writeBuffer(Graphics.webgpu.terrainVertexBuffer, 0, vertices);
              
              if (Graphics.webgpu.terrainColorBuffer) Graphics.webgpu.terrainColorBuffer.destroy();
              Graphics.webgpu.terrainColorBuffer = device.createBuffer({
                  size: colors.byteLength,
                  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
              });
              device.queue.writeBuffer(Graphics.webgpu.terrainColorBuffer, 0, colors);
              
              if (Graphics.webgpu.terrainIndexBuffer) Graphics.webgpu.terrainIndexBuffer.destroy();
              Graphics.webgpu.terrainIndexBuffer = device.createBuffer({
                  size: indices.byteLength,
                  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
              });
              device.queue.writeBuffer(Graphics.webgpu.terrainIndexBuffer, 0, indices);
              
              Graphics.webgpu.terrainIndicesLength = indices.length;
              Graphics.webgpu.terrainUseUint32 = (indices instanceof Uint32Array);
            }

        gl.bufferData(
          gl.ARRAY_BUFFER,
          terrainRawVertices,
          gl.DYNAMIC_DRAW,
        );

        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          colors,
          gl.STATIC_DRAW,
        );

        indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          indices,
          gl.STATIC_DRAW,
        );

        buildWireframe(gridSize);
        buildWaterSphere(gridSize);
        buildAtmosphereSphere(gridSize);
        buildSkySphere(gridSize);
        cubeObstacles = [];
        // buildCubes(50, seed); // ปิดสุ่มวัตถุ 50 ชิ้นเป็นค่าเริ่มต้นตามความต้องการของผู้ใช้
        const planetRadius = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
        const sampleRatio = Math.max(0.35, Math.pow(planetRadius / 8.0, 1.25));
        const treeCount = window.globalTreeCountOverride !== undefined ? window.globalTreeCountOverride : Math.min(1000, Math.floor(sampleRatio * (130 + Math.floor(Math.random() * 41))));
        await buildNature(treeCount, seed);
        buildCollectibles(Math.min(160, Math.floor(30 * sampleRatio)), seed);
        const npcCount = (typeof window.calculatePlanetNpcCount === "function")
          ? window.calculatePlanetNpcCount(planetRadius)
          : Math.min(72, Math.max(8, Math.round(16 * Math.pow(planetRadius / 8.0, 1.35))));
        initAmphibians(npcCount, seed);
        buildSun();
        if (typeof initBackgroundPlanets === "function") initBackgroundPlanets();
        updateCharacterMesh(0.0);
      }


      // ============================================
      // สร้างดาวอาทิตย์ขนาดใหญ่ (Sun) อิงระยะห่างและขนาดสัดส่วนจริง
      // ============================================
      function buildSun() {
        const latSeg = 32;
        const longSeg = 32;

        const vertices = [];
        const colors = [];
        const indices = [];

        // สัดส่วนจริง: รัศมีดาวอาทิตย์ประมาณ 109.3 เท่าของโลก, ระยะห่างประมาณ 23,481 เท่าของรัศมีโลก
        const sunRadius = RADIUS * 109.3;

        for (let lat = 0; lat <= latSeg; lat++) {
          const theta = (lat / latSeg) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let long = 0; long <= longSeg; long++) {
            const phi = (long / longSeg) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = sunRadius * sinTheta * cosPhi;
            const y = sunRadius * cosTheta;
            const z = sunRadius * sinTheta * sinPhi;

            vertices.push(x, y, z);

            // ไล่สีขาวแกนกลางส้มสว่างระเรื่อที่ขอบให้มีมิติสวยงามเหมือนจริง
            const t = Math.abs(lat / latSeg - 0.5) * 2.0;
            const r = 1.0;
            const g = 0.98 - t * 0.12;
            const b = 0.85 - t * 0.45;
            colors.push(r, g, b);
          }
        }

        for (let lat = 0; lat < latSeg; lat++) {
          for (let long = 0; long < longSeg; long++) {
            const a = lat * (longSeg + 1) + long;
            const b = a + longSeg + 1;
            const c = a + 1;
            const d = b + 1;
            indices.push(a, b, c);
            indices.push(c, b, d);
          }
        }

        sunIndicesLength = indices.length;
        window.sunIndicesLength = sunIndicesLength;

        if (sunVertexBuffer) gl.deleteBuffer(sunVertexBuffer);
        if (sunColorBuffer) gl.deleteBuffer(sunColorBuffer);
        if (sunIndexBuffer) gl.deleteBuffer(sunIndexBuffer);

        sunVertexBuffer = gl.createBuffer();
        window.sunVertexBuffer = sunVertexBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, sunVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(vertices),
          gl.STATIC_DRAW,
        );

        sunColorBuffer = gl.createBuffer();
        window.sunColorBuffer = sunColorBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, sunColorBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(colors),
          gl.STATIC_DRAW,
        );

        sunIndexBuffer = gl.createBuffer();
        window.sunIndexBuffer = sunIndexBuffer;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sunIndexBuffer);
        if (supportUint32 && sunIndicesLength > 65535) {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint32Array(indices),
            gl.STATIC_DRAW,
          );
        } else {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(indices),
            gl.STATIC_DRAW,
          );
        }
      }
      window.buildSun = buildSun;

      // ============================================
      // สร้างโมเดลดวงอาทิตย์ (Satellite Sun) & ดาวเคราะห์บริวาร (SpacesMap System)
      // ============================================
      function buildSatellitePlanet(seed = 12345) {
        if (window.SpacesMap && typeof window.SpacesMap.buildSatelliteSun === "function") {
          window.SpacesMap.buildSatelliteSun(seed);
        }
      }
      window.buildSatellitePlanet = buildSatellitePlanet;

      function buildExtraPlanets(seed = 12345) {
        if (window.SpacesMap && typeof window.SpacesMap.buildExtraPlanets === "function") {
          window.SpacesMap.buildExtraPlanets(seed);
        }
      }
      window.buildExtraPlanets = buildExtraPlanets;

      // Reusable buffer arrays to prevent GC thrashing in high-frequency rendering loops
      const REUSABLE_FLAT_VERTICES = [];
      const REUSABLE_FLAT_COLORS = [];
      const REUSABLE_FLAT_NORMALS = [];
      const REUSABLE_FLAT_INDICES = [];

      let reusableFloatArray1 = new Float32Array(1024);
      let reusableFloatArray2 = new Float32Array(1024);
      let reusableFloatArray3 = new Float32Array(1024);
      let reusableUint16Array = new Uint16Array(1024);
      let reusableUint32Array = new Uint32Array(1024);

      function getReusableFloat32Array(idx, size) {
        let arr = idx === 1 ? reusableFloatArray1 : idx === 2 ? reusableFloatArray2 : reusableFloatArray3;
        if (arr.length < size) {
          const newSize = Math.max(arr.length * 2, size);
          arr = new Float32Array(newSize);
          if (idx === 1) reusableFloatArray1 = arr;
          else if (idx === 2) reusableFloatArray2 = arr;
          else reusableFloatArray3 = arr;
        }
        return arr;
      }

      function getReusableUint16Array(size) {
        if (reusableUint16Array.length < size) {
          reusableUint16Array = new Uint16Array(Math.max(reusableUint16Array.length * 2, size));
        }
        return reusableUint16Array;
      }

      function getReusableUint32Array(size) {
        if (reusableUint32Array.length < size) {
          reusableUint32Array = new Uint32Array(Math.max(reusableUint32Array.length * 2, size));
        }
        return reusableUint32Array;
      }

      // Cache for Float32Arrays of length 3, 4, 16 to avoid garbage collection
      const float32ArrayCache3 = new Float32Array(3);
      const float32ArrayCache4 = new Float32Array(4);
      const float32ArrayCache16 = new Float32Array(16);

      function getCachedFloat32Array3(arr) {
        float32ArrayCache3[0] = arr[0];
        float32ArrayCache3[1] = arr[1];
        float32ArrayCache3[2] = arr[2];
        return float32ArrayCache3;
      }

      function getCachedFloat32Array4(arr) {
        float32ArrayCache4[0] = arr[0];
        float32ArrayCache4[1] = arr[1];
        float32ArrayCache4[2] = arr[2];
        float32ArrayCache4[3] = arr[3];
        return float32ArrayCache4;
      }

      function getCachedFloat32Array16(arr) {
        for (let i = 0; i < 16; i++) {
          float32ArrayCache16[i] = arr[i];
        }
        return float32ArrayCache16;
      }

      // ============================================
      // ฟังก์ชันสร้าง Flat Shaded Geometry แบบ Asynchronous ป้องกันการค้างบนมือถือ
      // ============================================
      async function asyncMakeFlatShadedGeometry(rawVertices, rawColors, rawIndices, checkYield) {
        const numTriangles = rawIndices.length / 3;
        const numVertices = rawIndices.length;
        const flatVertices = new Float32Array(numVertices * 3);
        const flatColors = new Float32Array(numVertices * 3);
        const flatNormals = new Float32Array(numVertices * 3);
        const isUint32 = supportUint32 && numVertices > 65535;
        const flatIndices = isUint32 ? new Uint32Array(numVertices) : new Uint16Array(numVertices);

        let vIdx = 0;
        let iIdx = 0;
        for (let i = 0; i < rawIndices.length; i += 3) {
          if (i % 3000 === 0 && checkYield) {
            await checkYield();
          }
          const i0 = rawIndices[i];
          const i1 = rawIndices[i + 1];
          const i2 = rawIndices[i + 2];
          const x0 = rawVertices[i0 * 3], y0 = rawVertices[i0 * 3 + 1], z0 = rawVertices[i0 * 3 + 2];
          const x1 = rawVertices[i1 * 3], y1 = rawVertices[i1 * 3 + 1], z1 = rawVertices[i1 * 3 + 2];
          const x2 = rawVertices[i2 * 3], y2 = rawVertices[i2 * 3 + 1], z2 = rawVertices[i2 * 3 + 2];

          const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
          const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
          let nx = uy * vz - uz * vy;
          let ny = uz * vx - ux * vz;
          let nz = ux * vy - uy * vx;
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (len > 0.0001) {
            nx /= len; ny /= len; nz /= len;
          } else {
            nx = 0; ny = 1; nz = 0;
          }

          const baseIdx = iIdx;
          flatVertices[vIdx] = x0; flatVertices[vIdx+1] = y0; flatVertices[vIdx+2] = z0;
          flatVertices[vIdx+3] = x1; flatVertices[vIdx+4] = y1; flatVertices[vIdx+5] = z1;
          flatVertices[vIdx+6] = x2; flatVertices[vIdx+7] = y2; flatVertices[vIdx+8] = z2;

          flatColors[vIdx] = rawColors[i0 * 3]; flatColors[vIdx+1] = rawColors[i0 * 3 + 1]; flatColors[vIdx+2] = rawColors[i0 * 3 + 2];
          flatColors[vIdx+3] = rawColors[i1 * 3]; flatColors[vIdx+4] = rawColors[i1 * 3 + 1]; flatColors[vIdx+5] = rawColors[i1 * 3 + 2];
          flatColors[vIdx+6] = rawColors[i2 * 3]; flatColors[vIdx+7] = rawColors[i2 * 3 + 1]; flatColors[vIdx+8] = rawColors[i2 * 3 + 2];

          flatNormals[vIdx] = nx; flatNormals[vIdx+1] = ny; flatNormals[vIdx+2] = nz;
          flatNormals[vIdx+3] = nx; flatNormals[vIdx+4] = ny; flatNormals[vIdx+5] = nz;
          flatNormals[vIdx+6] = nx; flatNormals[vIdx+7] = ny; flatNormals[vIdx+8] = nz;

          flatIndices[iIdx++] = baseIdx;
          flatIndices[iIdx++] = baseIdx + 1;
          flatIndices[iIdx++] = baseIdx + 2;
          vIdx += 9;
        }
        return {
          vertices: flatVertices,
          colors: flatColors,
          normals: flatNormals,
          indices: flatIndices,
        };
      }

      // ============================================
      // ฟังก์ชันสร้าง Flat Shaded Geometry (ตำแหน่ง, สี, Normal, และ Index สำหรับ WebGL)
      // ============================================
      function makeFlatShadedGeometry(rawVertices, rawColors, rawIndices, useCache = false) {
        const triCount = Math.floor(rawIndices.length / 3);
        const vertFloatCount = triCount * 9;
        const indCount = triCount * 3;

        let flatVertices, flatColors, flatNormals, flatIndices;

        if (useCache) {
          flatVertices = getReusableFloat32Array(1, vertFloatCount).subarray(0, vertFloatCount);
          flatColors = getReusableFloat32Array(2, vertFloatCount).subarray(0, vertFloatCount);
          flatNormals = getReusableFloat32Array(3, vertFloatCount).subarray(0, vertFloatCount);
          const isUint32 = (typeof supportUint32 !== 'undefined' && supportUint32) && indCount > 65535;
          flatIndices = isUint32 ? getReusableUint32Array(indCount).subarray(0, indCount) : getReusableUint16Array(indCount).subarray(0, indCount);
        } else {
          flatVertices = new Float32Array(vertFloatCount);
          flatColors = new Float32Array(vertFloatCount);
          flatNormals = new Float32Array(vertFloatCount);
          const isUint32 = (typeof supportUint32 !== 'undefined' && supportUint32) && indCount > 65535;
          flatIndices = isUint32 ? new Uint32Array(indCount) : new Uint16Array(indCount);
        }

        let vPtr = 0;
        let cPtr = 0;
        let nPtr = 0;
        let iPtr = 0;
        let baseIdx = 0;

        for (let i = 0; i < rawIndices.length; i += 3) {
          const i0 = rawIndices[i];
          const i1 = rawIndices[i + 1];
          const i2 = rawIndices[i + 2];

          const i0x3 = i0 * 3;
          const i1x3 = i1 * 3;
          const i2x3 = i2 * 3;

          const x0 = rawVertices[i0x3],
            y0 = rawVertices[i0x3 + 1],
            z0 = rawVertices[i0x3 + 2];
          const x1 = rawVertices[i1x3],
            y1 = rawVertices[i1x3 + 1],
            z1 = rawVertices[i1x3 + 2];
          const x2 = rawVertices[i2x3],
            y2 = rawVertices[i2x3 + 1],
            z2 = rawVertices[i2x3 + 2];

          // Face normal
          const ux = x1 - x0,
            uy = y1 - y0,
            uz = z1 - z0;
          const vx = x2 - x0,
            vy = y2 - y0,
            vz = z2 - z0;

          let nx = uy * vz - uz * vy;
          let ny = uz * vx - ux * vz;
          let nz = ux * vy - uy * vx;

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (len > 0.0001) {
            const invLen = 1.0 / len;
            nx *= invLen;
            ny *= invLen;
            nz *= invLen;
          } else {
            nx = 0;
            ny = 1;
            nz = 0;
          }

          flatVertices[vPtr++] = x0; flatVertices[vPtr++] = y0; flatVertices[vPtr++] = z0;
          flatVertices[vPtr++] = x1; flatVertices[vPtr++] = y1; flatVertices[vPtr++] = z1;
          flatVertices[vPtr++] = x2; flatVertices[vPtr++] = y2; flatVertices[vPtr++] = z2;

          flatColors[cPtr++] = rawColors[i0x3]; flatColors[cPtr++] = rawColors[i0x3 + 1]; flatColors[cPtr++] = rawColors[i0x3 + 2];
          flatColors[cPtr++] = rawColors[i1x3]; flatColors[cPtr++] = rawColors[i1x3 + 1]; flatColors[cPtr++] = rawColors[i1x3 + 2];
          flatColors[cPtr++] = rawColors[i2x3]; flatColors[cPtr++] = rawColors[i2x3 + 1]; flatColors[cPtr++] = rawColors[i2x3 + 2];

          flatNormals[nPtr++] = nx; flatNormals[nPtr++] = ny; flatNormals[nPtr++] = nz;
          flatNormals[nPtr++] = nx; flatNormals[nPtr++] = ny; flatNormals[nPtr++] = nz;
          flatNormals[nPtr++] = nx; flatNormals[nPtr++] = ny; flatNormals[nPtr++] = nz;

          flatIndices[iPtr++] = baseIdx;
          flatIndices[iPtr++] = baseIdx + 1;
          flatIndices[iPtr++] = baseIdx + 2;
          baseIdx += 3;
        }

        return {
          vertices: flatVertices,
          colors: flatColors,
          normals: flatNormals,
          indices: flatIndices,
        };
      }
      window.makeFlatShadedGeometry = makeFlatShadedGeometry;

      // ============================================
      // สร้างวัตถุสี่เหลี่ยมบนดาว
      // ============================================
      function buildCubes(count, seed) {
        const _origRandom = Math.random;
        Math.random = mulberry32(seed);

        cubeObstacles = [];
        const cubeSize = 0.06 + Math.random() * 0.08;
        const rawVertices = [];
        const rawColors = [];
        const rawIndices = [];

        const cubeVerts = [
          [-1, -1, -1],
          [1, -1, -1],
          [1, -1, 1],
          [-1, -1, 1],
          [-1, 1, -1],
          [1, 1, -1],
          [1, 1, 1],
          [-1, 1, 1],
        ];
        const cubeIndices = [
          0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7,
          6, 0, 3, 7, 0, 7, 4, 1, 2, 6, 1, 6, 5,
        ];

        for (let i = 0; i < count; i++) {
          const u = Math.random();
          const v = Math.random();
          const theta = Math.acos(2 * u - 1);
          const phi = 2 * Math.PI * v;

          const height = getHeightOnSphere(theta, phi, seed);
          const r = RADIUS + height * HEIGHT_SCALE;

          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          const x = r * sinTheta * cosPhi;
          const y = r * cosTheta;
          const z = r * sinTheta * sinPhi;

          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;

          const rCol = 0.3 + Math.random() * 0.7;
          const gCol = 0.3 + Math.random() * 0.7;
          const bCol = 0.3 + Math.random() * 0.7;

          const baseIdx = rawVertices.length / 3;

          const worldUp = [0, 1, 0];
          let rightX, rightY, rightZ;
          if (Math.abs(nx) < 0.9 && Math.abs(nz) < 0.9) {
            rightX = ny * 0 - nz * 1;
            rightY = nz * 0 - nx * 0;
            rightZ = nx * 1 - ny * 0;
          } else {
            rightX = 1;
            rightY = 0;
            rightZ = 0;
          }
          const lenR = Math.sqrt(
            rightX * rightX + rightY * rightY + rightZ * rightZ,
          );
          rightX /= lenR;
          rightY /= lenR;
          rightZ /= lenR;

          const fwdX = rightY * nz - rightZ * ny;
          const fwdY = rightZ * nx - rightX * nz;
          const fwdZ = rightX * ny - rightY * nx;

          const startIdx = rawIndices.length;
          const size = cubeSize * (0.8 + Math.random() * 0.4);

          const localVerts = cubeVerts.map((v) => {
            const lx = v[0] * size;
            const ly = v[1] * size;
            const lz = v[2] * size;
            return [
              x + lx * rightX + ly * nx + lz * fwdX,
              y + lx * rightY + ly * ny + lz * fwdY,
              z + lx * rightZ + ly * nz + lz * fwdZ,
            ];
          });

          for (let v of localVerts) {
            rawVertices.push(v[0], v[1], v[2]);
            rawColors.push(rCol, gCol, bCol);
          }

          for (let idx of cubeIndices) {
            rawIndices.push(baseIdx + idx);
          }

          const endIdx = rawIndices.length;

          cubeObstacles.push({
            normal: [nx, ny, nz],
            position: [x, y, z],
            radius: size * 2.5,
            colliders: [{ offset: [0, 0, 0], radius: size * 0.85 }],
            meshStart: startIdx,
            meshEnd: endIdx
          });
        }

        // แปลงเป็น flat shaded
        const flatGeom = makeFlatShadedGeometry(
          rawVertices,
          rawColors,
          rawIndices,
        );
        cubeIndicesLength = flatGeom.indices.length;
        cubeRawVertices = new Float32Array(flatGeom.vertices);

        if (cubeVertexBuffer) gl.deleteBuffer(cubeVertexBuffer);
        if (cubeColorBuffer) gl.deleteBuffer(cubeColorBuffer);
        if (cubeNormalBuffer) gl.deleteBuffer(cubeNormalBuffer);
        if (cubeIndexBuffer) gl.deleteBuffer(cubeIndexBuffer);

        cubeVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(flatGeom.vertices),
          gl.STATIC_DRAW,
        );

        cubeColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeColorBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(flatGeom.colors),
          gl.STATIC_DRAW,
        );

        cubeNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(flatGeom.normals),
          gl.STATIC_DRAW,
        );

        cubeIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
        if (supportUint32 && cubeIndicesLength > 65535) {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            flatGeom.indices,
            gl.STATIC_DRAW,
          );
        } else {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            flatGeom.indices,
            gl.STATIC_DRAW,
          );
        }
        Math.random = _origRandom;
      }

      function buildContinuousSpine(
        points,
        radii,
        radialSegs,
        baseColor,
        vertices,
        colors,
        indices,
        upVector = [0, 1, 0],
      ) {
        const numPoints = points.length;
        if (numPoints < 2) return;

        const baseIdx = vertices.length / 3;

        // For each point, create a ring of vertices
        let lastR, lastF, lastDir;

        for (let i = 0; i < numPoints; i++) {
          const p = points[i];
          const r = radii[i];

          // Determine direction (tangent)
          let dir = [0, 0, 0];
          if (i === 0) {
            dir = [
              points[1][0] - points[0][0],
              points[1][1] - points[0][1],
              points[1][2] - points[0][2],
            ];
          } else if (i === numPoints - 1) {
            dir = [
              points[i][0] - points[i - 1][0],
              points[i][1] - points[i - 1][1],
              points[i][2] - points[i - 1][2],
            ];
          } else {
            dir = [
              points[i + 1][0] - points[i - 1][0],
              points[i + 1][1] - points[i - 1][1],
              points[i + 1][2] - points[i - 1][2],
            ];
          }

          let len = Math.sqrt(
            dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2],
          );
          if (len > 0.0001) {
            dir[0] /= len;
            dir[1] /= len;
            dir[2] /= len;
          } else {
            dir = [0, 1, 0];
          }

          // Coordinate frame for the ring
          const up = upVector;
          let rx = up[1] * dir[2] - up[2] * dir[1];
          let ry = up[2] * dir[0] - up[0] * dir[2];
          let rz = up[0] * dir[1] - up[1] * dir[0];
          let lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);

          // If direction is too close to up vector, use another vector
          if (lenR < 0.001) {
            const up2 = Math.abs(up[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
            rx = up2[1] * dir[2] - up2[2] * dir[1];
            ry = up2[2] * dir[0] - up2[0] * dir[2];
            rz = up2[0] * dir[1] - up2[1] * dir[0];
            lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
          }
          rx /= lenR;
          ry /= lenR;
          rz /= lenR;

          let fx = ry * dir[2] - rz * dir[1];
          let fy = rz * dir[0] - rx * dir[2];
          let fz = rx * dir[1] - ry * dir[0];

          lastR = [rx, ry, rz];
          lastF = [fx, fy, fz];
          lastDir = [dir[0], dir[1], dir[2]];

          const lenF = Math.sqrt(fx * fx + fy * fy + fz * fz);
          fx /= lenF;
          fy /= lenF;
          fz /= lenF;

          for (let j = 0; j < radialSegs; j++) {
            const angle = (j / radialSegs) * Math.PI * 2;
            const ca = Math.cos(angle) * r;
            const sa = Math.sin(angle) * r;

            const vx = p[0] + rx * ca + fx * sa;
            const vy = p[1] + ry * ca + fy * sa;
            const vz = p[2] + rz * ca + fz * sa;

            vertices.push(vx, vy, vz);

            // Simple lighting variation
            const colorFactor = 0.8 + 0.2 * Math.cos(angle);
            const activeColor = (Array.isArray(baseColor[0])) ? (baseColor[i] || baseColor[baseColor.length - 1]) : baseColor;
            colors.push(
              activeColor[0] * colorFactor,
              activeColor[1] * colorFactor,
              activeColor[2] * colorFactor,
            );
          }
        }

        // Connect rings
        for (let i = 0; i < numPoints - 1; i++) {
          const ringStart = baseIdx + i * radialSegs;
          const nextRingStart = baseIdx + (i + 1) * radialSegs;

          for (let j = 0; j < radialSegs; j++) {
            const nextJ = (j + 1) % radialSegs;
            const v1 = ringStart + j;
            const v2 = ringStart + nextJ;
            const v3 = nextRingStart + j;
            const v4 = nextRingStart + nextJ;

            indices.push(v1, v2, v3);
            indices.push(v2, v4, v3);
          }
        }

        // Front Cap
        const frontCenter = vertices.length / 3;
        vertices.push(points[0][0], points[0][1], points[0][2]);
        colors.push(baseColor[0], baseColor[1], baseColor[2]);
        for (let j = 0; j < radialSegs; j++) {
          indices.push(
            frontCenter,
            baseIdx + j,
            baseIdx + ((j + 1) % radialSegs),
          );
        }

        // Back Cap
        const backCenter = vertices.length / 3;
        vertices.push(
          points[numPoints - 1][0],
          points[numPoints - 1][1],
          points[numPoints - 1][2],
        );
        colors.push(baseColor[0], baseColor[1], baseColor[2]);
        const backRing = baseIdx + (numPoints - 1) * radialSegs;
        for (let j = 0; j < radialSegs; j++) {
          indices.push(
            backCenter,
            backRing + ((j + 1) % radialSegs),
            backRing + j,
          );
        }
      }

      // ============================================
      function buildTaperedSegment(
        pStart,
        pEnd,
        rStart,
        rEnd,
        radialSegs,
        baseColor,
        vertices,
        colors,
        indices,
        addCaps = false,
        swayStart = null,
        swayEnd = null
      ) {
        const dx = pEnd[0] - pStart[0];
        const dy = pEnd[1] - pStart[1];
        const dz = pEnd[2] - pStart[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 0.0001) return;

        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        let rx, ry, rz;
        if (Math.abs(ny) < 0.9) {
          rx = -nz;
          ry = 0;
          rz = nx;
        } else {
          rx = 1;
          ry = 0;
          rz = 0;
        }
        const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
        rx /= lenR;
        ry /= lenR;
        rz /= lenR;

        let fx = ry * nz - rz * ny;
        let fy = rz * nx - rx * nz;
        let fz = rx * ny - ry * nx;
        const lenF = Math.sqrt(fx * fx + fy * fy + fz * fz);
        fx /= lenF;
        fy /= lenF;
        fz /= lenF;

        const baseIdx = vertices.length / 3;

        let startColor = baseColor;
        let endColor = baseColor;
        let isTreeSegment = false;
        let isLeafSegment = false;
        let startSwayWeight = 0.0;
        let endSwayWeight = 0.0;
        
        if (swayStart !== null && swayStart !== undefined) {
          isTreeSegment = true;
          if (typeof swayStart === "string") {
            isLeafSegment = (swayStart === "leaf");
            startSwayWeight = 0.0;
          } else if (typeof swayStart === "number") {
            startSwayWeight = swayStart;
          } else if (typeof swayStart === "object") {
            isLeafSegment = (swayStart.leaf > 0.0);
            startSwayWeight = swayStart.branch || 0.0;
          }
        }
        
        if (swayEnd !== null && swayEnd !== undefined) {
          isTreeSegment = true;
          if (typeof swayEnd === "string") {
            isLeafSegment = (swayEnd === "leaf");
            endSwayWeight = 0.0;
          } else if (typeof swayEnd === "number") {
            endSwayWeight = swayEnd;
          } else if (typeof swayEnd === "object") {
            isLeafSegment = (swayEnd.leaf > 0.0);
            endSwayWeight = swayEnd.branch || 0.0;
          }
        } else {
          endSwayWeight = startSwayWeight;
        }
        
        if (isTreeSegment && typeof encodeTreeColor === "function") {
          startColor = encodeTreeColor(baseColor, isLeafSegment, startSwayWeight);
          endColor = encodeTreeColor(baseColor, isLeafSegment, endSwayWeight);
        }

        for (let s = 0; s < radialSegs; s++) {
          const angle = (s / radialSegs) * Math.PI * 2;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const sx = pStart[0] + rStart * (cosA * rx + sinA * fx);
          const sy = pStart[1] + rStart * (cosA * ry + sinA * fy);
          const sz = pStart[2] + rStart * (cosA * rz + sinA * fz);

          vertices.push(sx, sy, sz);
          colors.push(startColor[0], startColor[1], startColor[2]);
        }

        for (let s = 0; s < radialSegs; s++) {
          const angle = (s / radialSegs) * Math.PI * 2;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);

          const ex = pEnd[0] + rEnd * (cosA * rx + sinA * fx);
          const ey = pEnd[1] + rEnd * (cosA * ry + sinA * fy);
          const ez = pEnd[2] + rEnd * (cosA * rz + sinA * fz);

          vertices.push(ex, ey, ez);
          colors.push(endColor[0], endColor[1], endColor[2]);
        }

        for (let s = 0; s < radialSegs; s++) {
          const nextS = (s + 1) % radialSegs;
          const p0 = baseIdx + s;
          const p1 = baseIdx + nextS;
          const p2 = baseIdx + radialSegs + s;
          const p3 = baseIdx + radialSegs + nextS;

          indices.push(p0, p1, p3);
          indices.push(p0, p3, p2);
        }

        if (addCaps) {
          // Bottom cap (center at pStart)
          const bottomCenterIdx = vertices.length / 3;
          vertices.push(pStart[0], pStart[1], pStart[2]);
          const darkColor = [baseColor[0] * 0.8, baseColor[1] * 0.8, baseColor[2] * 0.8];
          let startCapColor = darkColor;
          if (isTreeSegment && typeof encodeTreeColor === "function") {
            startCapColor = encodeTreeColor(darkColor, isLeafSegment, startSwayWeight);
          }
          colors.push(startCapColor[0], startCapColor[1], startCapColor[2]);
          
          for (let s = 0; s < radialSegs; s++) {
            const nextS = (s + 1) % radialSegs;
            const p0 = baseIdx + s;
            const p1 = baseIdx + nextS;
            indices.push(bottomCenterIdx, p1, p0); // reverse order for facing outward
          }

          // Top cap (center at pEnd)
          const topCenterIdx = vertices.length / 3;
          vertices.push(pEnd[0], pEnd[1], pEnd[2]);
          let endCapColor = darkColor;
          if (isTreeSegment && typeof encodeTreeColor === "function") {
            endCapColor = encodeTreeColor(darkColor, isLeafSegment, endSwayWeight);
          }
          colors.push(endCapColor[0], endCapColor[1], endCapColor[2]);
          
          for (let s = 0; s < radialSegs; s++) {
            const nextS = (s + 1) % radialSegs;
            const p0 = baseIdx + radialSegs + s;
            const p1 = baseIdx + radialSegs + nextS;
            indices.push(topCenterIdx, p0, p1);
          }
        }
      }

      function buildUnderwaterPlant(
        wx,
        wy,
        wz,
        nx,
        ny,
        nz,
        R,
        F,
        N,
        seed,
        vertices,
        colors,
        indices,
      ) {
        if (typeof window !== "undefined" && window.UnderwaterPlantSystem && window.UnderwaterPlantSystem.buildUnderwaterPlant) {
          window.UnderwaterPlantSystem.buildUnderwaterPlant(
            wx, wy, wz, nx, ny, nz, R, F, N, seed, vertices, colors, indices, buildTaperedSegment
          );
        } else if (typeof window !== "undefined" && typeof window.buildUnderwaterPlant === "function" && window.buildUnderwaterPlant !== buildUnderwaterPlant) {
          window.buildUnderwaterPlant(
            wx, wy, wz, nx, ny, nz, R, F, N, seed, vertices, colors, indices, buildTaperedSegment
          );
        }
      }

      function buildLowPolySphere(
        center,
        radius,
        segs,
        baseColor,
        noiseStrength,
        seed,
        vertices,
        colors,
        indices,
      ) {
        const baseIdx = vertices.length / 3;

        for (let lat = 0; lat <= segs; lat++) {
          const theta = (lat / segs) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let long = 0; long <= segs; long++) {
            const phi = (long / segs) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const dx = sinTheta * cosPhi;
            const dy = cosTheta;
            const dz = sinTheta * sinPhi;

            const nVal = fbmNoise(dx * 4, dy * 4, dz * 4, seed, 2);
            const deformedRadius = radius * (1.0 + nVal * noiseStrength);

            const vx = center[0] + deformedRadius * dx;
            const vy = center[1] + deformedRadius * dy;
            const vz = center[2] + deformedRadius * dz;

            vertices.push(vx, vy, vz);

            const cVar =
              fbmNoise(vx * 15, vy * 15, vz * 15, seed + 100, 1) * 0.08;
            const finalCol = [
              Math.max(0.05, Math.min(1.0, baseColor[0] + cVar)),
              Math.max(0.05, Math.min(1.0, baseColor[1] + cVar * 0.8)),
              Math.max(0.05, Math.min(1.0, baseColor[2] + cVar * 0.5)),
            ];
            colors.push(finalCol[0], finalCol[1], finalCol[2]);
          }
        }

        for (let lat = 0; lat < segs; lat++) {
          for (let long = 0; long < segs; long++) {
            const a = baseIdx + lat * (segs + 1) + long;
            const b = a + segs + 1;
            const c = a + 1;
            const d = b + 1;

            indices.push(a, b, c);
            indices.push(c, b, d);
          }
        }
      }

      function encodeTreeColor(color, isLeaf, swayWeight = 0.0) {
        const r = color[0];
        const g = color[1];
        const b = color[2];
        
        const cR = Math.max(0.0, Math.min(1.0, r));
        const cG = Math.max(0.0, Math.min(1.0, g));
        const cB = Math.max(0.0, Math.min(1.0, b));
        
        let swayWeightInt = Math.round(Math.max(0.0, Math.min(1.0, swayWeight)) * 100.0);
        if (isLeaf) {
          swayWeightInt += 1000;
        }
        const encoded = cB + (swayWeightInt + 10.0) * 2.0;
        
        return [
          cR,
          cG,
          -encoded
        ];
      }

      // ฟังก์ชันสร้างใบไม้เรียงตัวตามแนวกิ่งเล็ก (Leaves along Twig)
      // เพื่อลบกระจุกแบบ spiky และกระจายความสวยงามอย่างมีระเบียบตามธรรมชาติ
      function buildLeavesAlongTwig(
        tStart,
        tEnd,
        startRadius,
        endRadius,
        leafColor,
        seed,
        vertices,
        colors,
        indices,
        branchSwayStart = 0.5,
        branchSwayEnd = 1.0
      ) {
        let prng = (function (s) {
          return function () {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
          };
        })(seed);

        // วาดตัวกิ่งเล็ก (The Twig itself)
        const twigColor = [0.3, 0.2, 0.12];
        buildTaperedSegment(
          tStart,
          tEnd,
          startRadius,
          endRadius,
          3,
          twigColor,
          vertices,
          colors,
          indices,
          false,
          branchSwayStart,
          branchSwayEnd
        );

        // ทิศทางกิ่งเล็ก
        const dx = tEnd[0] - tStart[0];
        const dy = tEnd[1] - tStart[1];
        const dz = tEnd[2] - tStart[2];
        const lenD = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (lenD < 0.001) return;
        const D_twig = [dx / lenD, dy / lenD, dz / lenD];

        // สร้างระนาบตั้งฉากกับกิ่งเพื่อหามุมยื่นใบไม้
        let T1 = [0, 0, 0];
        if (Math.abs(D_twig[0]) < 0.9) {
          T1 = [0, -D_twig[2], D_twig[1]];
        } else {
          T1 = [-D_twig[1], D_twig[0], 0];
        }
        const lenT1 = Math.sqrt(T1[0] * T1[0] + T1[1] * T1[1] + T1[2] * T1[2]);
        T1 = [T1[0] / (lenT1 || 1), T1[1] / (lenT1 || 1), T1[2] / (lenT1 || 1)];

        const T2 = [
          D_twig[1] * T1[2] - D_twig[2] * T1[1],
          D_twig[2] * T1[0] - D_twig[0] * T1[2],
          D_twig[0] * T1[1] - D_twig[1] * T1[0],
        ];

        // จำนวนใบไม้เรียงสลับตลอดแนวกิ่ง (3 - 4 ใบเพื่อความสม่ำเสมอสวยงามและน้ำหนักเบาเป็นพิเศษ)
        const numLeaves = 8 + Math.floor(prng() * 6); // Increased for fuller look

        for (let i = 0; i < numLeaves; i++) {
          // อัตราการกระจายตัวตามแนวกิ่ง (ละเว้นโคนกิ่งเล็กน้อยเพื่อความเหมือนจริง)
          const t = 0.25 + 0.72 * (i / (numLeaves - 1 || 1));
          const p_t = [
            tStart[0] + dx * t,
            tStart[1] + dy * t,
            tStart[2] + dz * t,
          ];

          // สลับซ้ายขวากลุ่มใบไม้ (Alternating leaf arrangements)
          const angle = i * Math.PI + (prng() - 0.5) * 0.4;
          const S = [
            Math.cos(angle) * T1[0] + Math.sin(angle) * T2[0],
            Math.cos(angle) * T1[1] + Math.sin(angle) * T2[1],
            Math.cos(angle) * T1[2] + Math.sin(angle) * T2[2],
          ];

          // เวกเตอร์ Up ทิศทางแรงดึงดูดของผิวโลก (Planet normal) เพื่อดัดใบชี้ขึ้นรับแสง
          const distCenter = Math.sqrt(
            p_t[0] * p_t[0] + p_t[1] * p_t[1] + p_t[2] * p_t[2],
          );
          const N_up = [
            p_t[0] / (distCenter || 1),
            p_t[1] / (distCenter || 1),
            p_t[2] / (distCenter || 1),
          ];

          // ทิศทางการยื่นและเติบโตของใบไม้
          let rx = S[0] * 0.75 + D_twig[0] * 0.25 + N_up[0] * 0.25;
          let ry = S[1] * 0.75 + D_twig[1] * 0.25 + N_up[1] * 0.25;
          let rz = S[2] * 0.75 + D_twig[2] * 0.25 + N_up[2] * 0.25;
          const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
          const D_leaf = [rx / (lenR || 1), ry / (lenR || 1), rz / (lenR || 1)];

          // สร้าง "ก้านใบเล็กๆ (Small Leafstalk)" จากตัวกิ่งย่อย (p_t) ไปยังโคนใบไม้ (v0)
          const stalkLength = startRadius * (2.8 + prng() * 2.2);
          const v0 = [
            p_t[0] + D_leaf[0] * stalkLength,
            p_t[1] + D_leaf[1] * stalkLength,
            p_t[2] + D_leaf[2] * stalkLength,
          ];

          // Interpolate branch sway weight for this leaf's base
          const leafBranchSway = branchSwayStart + (branchSwayEnd - branchSwayStart) * t;

          // เพื่อความเบาสบายและไม่โหลด GPU เราจะละเว้นการวาดก้านใบไม้แบบ 3D cylinder
          // แต่ใบจะยังถูกจัดวางมีระยะห่าง v0 ลอยตัวห่างจากก้านเล็กน้อยอย่างมีสัดส่วนสมจริงเหมือนเดิม

          // ขนาดของตัวใบไม้ใบย่อย (Leaf blades)
          const leafLength = startRadius * (12.5 + prng() * 8.5);
          const leafWidth = leafLength * (0.54 + prng() * 0.16);
          const leafThickness = leafWidth * 0.24;

          // คำนวณแกนหมุนของตัวใบเพื่อพับมุม (Leaf blade geometry)
          let bx = D_leaf[1] * D_twig[2] - D_leaf[2] * D_twig[1];
          let by = D_leaf[2] * D_twig[0] - D_leaf[0] * D_twig[2];
          let bz = D_leaf[0] * D_twig[1] - D_leaf[1] * D_twig[0];
          const lenB = Math.sqrt(bx * bx + by * by + bz * bz);
          const L_side = [bx / (lenB || 1), by / (lenB || 1), bz / (lenB || 1)];

          const L_up = [
            D_leaf[1] * L_side[2] - D_leaf[2] * L_side[1],
            D_leaf[2] * L_side[0] - D_leaf[0] * L_side[2],
            D_leaf[0] * L_side[1] - D_leaf[1] * L_side[0],
          ];

          const v3 = [
            v0[0] + D_leaf[0] * leafLength,
            v0[1] + D_leaf[1] * leafLength,
            v0[2] + D_leaf[2] * leafLength,
          ];

          const v1 = [
            v0[0] +
              D_leaf[0] * (leafLength * 0.45) -
              L_side[0] * (leafWidth * 0.5) +
              L_up[0] * leafThickness,
            v0[1] +
              D_leaf[1] * (leafLength * 0.45) -
              L_side[1] * (leafWidth * 0.5) +
              L_up[1] * leafThickness,
            v0[2] +
              D_leaf[2] * (leafLength * 0.45) -
              L_side[2] * (leafWidth * 0.5) +
              L_up[2] * leafThickness,
          ];

          const v2 = [
            v0[0] +
              D_leaf[0] * (leafLength * 0.45) +
              L_side[0] * (leafWidth * 0.5) +
              L_up[0] * leafThickness,
            v0[1] +
              D_leaf[1] * (leafLength * 0.45) +
              L_side[1] * (leafWidth * 0.5) +
              L_up[1] * leafThickness,
            v0[2] +
              D_leaf[2] * (leafLength * 0.45) +
              L_side[2] * (leafWidth * 0.5) +
              L_up[2] * leafThickness,
          ];

          // ไล่เฉดสีสุ่มของใบ
          const shade = (prng() - 0.5) * 0.16;
          const finalLeafColor = [
            Math.max(0.04, Math.min(0.98, leafColor[0] + shade)),
            Math.max(0.04, Math.min(0.98, leafColor[1] + shade * 0.7)),
            Math.max(0.04, Math.min(0.98, leafColor[2] + shade * 0.4)),
          ];

          const bIdx = vertices.length / 3;
          vertices.push(v0[0], v0[1], v0[2]);
          vertices.push(v1[0], v1[1], v1[2]);
          vertices.push(v2[0], v2[1], v2[2]);
          vertices.push(v3[0], v3[1], v3[2]);

          const c0 = encodeTreeColor(finalLeafColor, true, leafBranchSway);
          const c1 = encodeTreeColor(finalLeafColor, true, leafBranchSway);
          const c2 = encodeTreeColor(finalLeafColor, true, leafBranchSway);
          const c3 = encodeTreeColor(finalLeafColor, true, leafBranchSway);

          colors.push(c0[0], c0[1], c0[2]);
          colors.push(c1[0], c1[1], c1[2]);
          colors.push(c2[0], c2[1], c2[2]);
          colors.push(c3[0], c3[1], c3[2]);

          indices.push(
            bIdx,
            bIdx + 1,
            bIdx + 3,
            bIdx,
            bIdx + 3,
            bIdx + 2,
            bIdx,
            bIdx + 3,
            bIdx + 1,
            bIdx,
            bIdx + 2,
            bIdx + 3,
          );
        }
      }

      // เชื่อมโยงเพื่อให้เรียกใช้ง่ายในสถาปัตยกรรมเดิม โดยปรับปรุงให้แตกกิ่งเล็กพร้อมใบงามๆ แทนทรงพุ่มกระจุกเดิม
      function buildFoliageCluster(
        center,
        radius,
        baseColor,
        seed,
        vertices,
        colors,
        indices,
        centerSway = 1.0,
        endSway = 1.1
      ) {
        let prng = (function (s) {
          return function () {
            s = Math.sin(s) * 10000;
            return s - Math.floor(s);
          };
        })(seed);

        const numTwigs = 5 + Math.floor(prng() * 5); // Increased twigs per cluster
        for (let t = 0; t < numTwigs; t++) {
          const theta = prng() * Math.PI;
          const phi = prng() * Math.PI * 2;

          // แผ่กิ่งเล็กกระจายในทรงพุ่ม
          const twigLength = radius * (0.8 + prng() * 0.4);

          const tEnd = [
            center[0] + Math.sin(theta) * Math.cos(phi) * twigLength,
            center[1] + Math.cos(theta) * twigLength,
            center[2] + Math.sin(theta) * Math.sin(phi) * twigLength,
          ];

          // ความหนาที่เหมาะสมสอดรับกับขนาดพุ่มใบไม้
          const tStartRad = radius * 0.08;
          const tEndRad = radius * 0.02;

          buildLeavesAlongTwig(
            center,
            tEnd,
            tStartRad,
            tEndRad,
            baseColor,
            seed + t * 400,
            vertices,
            colors,
            indices,
            centerSway,
            endSway
          );
        }
      }

      function pseudoRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      }

      // สร้างกลุ่มก้อนหินธรรมชาติ (Rock Formation)
      function buildRockFormation(
        center,
        radius,
        baseColor,
        seed,
        vertices,
        colors,
        indices,
      ) {
        // หินก้อนหลัก ย่นให้แบนทางตั้งเล็กน้อยเพื่อความเหมือนหินจริง
        buildLowPolySphere(
          center,
          radius,
          4,
          baseColor,
          0.38,
          seed,
          vertices,
          colors,
          indices,
        );

        // เพิ่มเศษหินเล็ก ๆ สุ่มรอบ ๆ 1-2 ก้อน
        let currentSeed = seed;
        const numSubRocks = 1 + Math.floor(pseudoRandom(currentSeed++) * 2);
        for (let r = 0; r < numSubRocks; r++) {
          const angle = pseudoRandom(currentSeed++) * Math.PI * 2;
          const offsetDist = radius * (0.7 + pseudoRandom(currentSeed++) * 0.4);
          const subRadius = radius * (0.35 + pseudoRandom(currentSeed++) * 0.3);

          // วางฐานฝังลึกลงไปเล็กน้อย
          const ox = Math.cos(angle) * offsetDist;
          const oy = (pseudoRandom(currentSeed++) - 0.7) * radius * 0.25;
          const oz = Math.sin(angle) * offsetDist;

          const subCenter = [center[0] + ox, center[1] + oy, center[2] + oz];

          const subColor = [
            Math.max(
              0.1,
              Math.min(
                1.0,
                baseColor[0] + (pseudoRandom(currentSeed++) - 0.5) * 0.05,
              ),
            ),
            Math.max(
              0.1,
              Math.min(
                1.0,
                baseColor[1] + (pseudoRandom(currentSeed++) - 0.5) * 0.05,
              ),
            ),
            Math.max(
              0.1,
              Math.min(
                1.0,
                baseColor[2] + (pseudoRandom(currentSeed++) - 0.5) * 0.05,
              ),
            ),
          ];

          buildLowPolySphere(
            subCenter,
            subRadius,
            3,
            subColor,
            0.45,
            currentSeed++,
            vertices,
            colors,
            indices,
          );
        }
      }

      class FastFloat32Array {
        constructor(cap) {
          this.data = new Float32Array(cap);
          this.length = 0;
        }
        push() {
          let l = this.length;
          const aLen = arguments.length;
          if (l + aLen > this.data.length) {
            let newCap = Math.max(this.data.length + 100000, Math.floor(this.data.length * 1.5) + aLen);
            let n = new Float32Array(newCap);
            n.set(this.data);
            this.data = n;
          }
          if (aLen === 3) {
            this.data[l] = arguments[0];
            this.data[l + 1] = arguments[1];
            this.data[l + 2] = arguments[2];
          } else if (aLen === 1) {
            this.data[l] = arguments[0];
          } else if (aLen === 6) {
            this.data[l] = arguments[0];
            this.data[l + 1] = arguments[1];
            this.data[l + 2] = arguments[2];
            this.data[l + 3] = arguments[3];
            this.data[l + 4] = arguments[4];
            this.data[l + 5] = arguments[5];
          } else {
            for (let i = 0; i < aLen; i++) this.data[l + i] = arguments[i];
          }
          this.length = l + aLen;
        }
      }
      class FastUint32Array {
        constructor(cap) {
          this.data = new Uint32Array(cap);
          this.length = 0;
        }
        push() {
          let l = this.length;
          const aLen = arguments.length;
          if (l + aLen > this.data.length) {
            let newCap = Math.max(this.data.length + 100000, Math.floor(this.data.length * 1.5) + aLen);
            let n = new Uint32Array(newCap);
            n.set(this.data);
            this.data = n;
          }
          if (aLen === 3) {
            this.data[l] = arguments[0];
            this.data[l + 1] = arguments[1];
            this.data[l + 2] = arguments[2];
          } else if (aLen === 1) {
            this.data[l] = arguments[0];
          } else if (aLen === 6) {
            this.data[l] = arguments[0];
            this.data[l + 1] = arguments[1];
            this.data[l + 2] = arguments[2];
            this.data[l + 3] = arguments[3];
            this.data[l + 4] = arguments[4];
            this.data[l + 5] = arguments[5];
          } else {
            for (let i = 0; i < aLen; i++) this.data[l + i] = arguments[i];
          }
          this.length = l + aLen;
        }
      }

      async function buildNature(count, seed) {
        if (window.DISABLE_ENVIRONMENT) {
            count = 0;
        }
        const _origRandom = Math.random;

        const vertices = new FastFloat32Array(150000);
        const colors = new FastFloat32Array(150000);
        const indices = new FastUint32Array(150000);
        natureObstacles = [];
        window.natureObstacles = natureObstacles;
        const treePositions = [];

        let lastYieldTime = performance.now();
        const checkYield = async () => {
          if (performance.now() - lastYieldTime > 12) {
            await new Promise(r => setTimeout(r, 0));
            lastYieldTime = performance.now();
          }
        };

        // สุ่มกระจายแบบอิง Noise เพื่อให้เกิดการรวมกลุ่มเป็นป่า และทุ่งหินธรรมชาติ
        for (let i = 0; i < count; i++) {
          await checkYield();
          Math.random = mulberry32(seed + i * 11235);
          const u = Math.random();
          const v = Math.random();
          const theta = Math.acos(2 * u - 1);
          const phi = 2 * Math.PI * v;

          const height = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : getHeightOnSphere(theta, phi, seed);
          const minLandHeight = waterLevel * 0.15 + 0.02;
          const r = RADIUS + height * HEIGHT_SCALE;

          const nx = Math.sin(theta) * Math.cos(phi);
          const ny = Math.cos(theta);
          const nz = Math.sin(theta) * Math.sin(phi);

          const wx = r * nx;
          const wy = r * ny;
          const wz = r * nz;

          // ทิศทางออร์โธโกนัลเพื่อใช้เป็นกรอบพิกัดเฉพาะจุด (Local Orthonormal Basis) แบบ Gram-Schmidt มิติสมบูรณ์ 3D จริง
          let rx, ry, rz;
          if (Math.abs(ny) < 0.9) {
            rx = -nz;
            ry = 0;
            rz = nx;
          } else {
            rx = 1;
            ry = 0;
            rz = 0;
          }
          const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz);
          rx /= (lenR || 1);
          ry /= (lenR || 1);
          rz /= (lenR || 1);

          let fx = ry * nz - rz * ny;
          let fy = rz * nx - rx * nz;
          let fz = rx * ny - ry * nx;
          const lenF = Math.sqrt(fx * fx + fy * fy + fz * fz);
          fx /= (lenF || 1);
          fy /= (lenF || 1);
          fz /= (lenF || 1);

          // ออร์โธนอร์มัลไลซ์ R อีกครั้งเพื่อให้ตั้งฉากกันอย่างสมบูรณ์แบบ 100%
          rx = fy * nz - fz * ny;
          ry = fz * nx - fx * nz;
          rz = fx * ny - fy * nx;
          const lenR2 = Math.sqrt(rx * rx + ry * ry + rz * rz);
          rx /= (lenR2 || 1);
          ry /= (lenR2 || 1);
          rz /= (lenR2 || 1);

          const R = [rx, ry, rz];
          const F = [fx, fy, fz];
          const N = [nx, ny, nz];

          // หากต่ำกว่าระดับน้ำ ให้สร้างพืชใต้น้ำเป็นกลุ่มแนวปะการัง (Coral Reef Clusters)
          if (height < minLandHeight) {
            // คำนวณความหนาแน่นด้วย 3D Noise เพื่อแบ่งพื้นที่เป็นกลุ่มแนวปะการัง
            const reefDensity = typeof fbmNoise === "function"
              ? fbmNoise(nx * 2.8, ny * 2.8, nz * 2.8, seed + 8888, 3)
              : (Math.random() * 2 - 1);

            // ข้ามบริเวณที่ Noise ต่ำ เพื่อให้เกิดกลุ่มปะการังเด่นชัดสลับกับพื้นทราย
            if (reefDensity < 0.15) {
              continue;
            }

            const clusterStartIdx = indices.length;
            // คำนวณจำนวนปะการัง/พืชใต้น้ำในกลุ่ม (ยิ่งกลางกลุ่ม ยิ่งแน่น 8 ถึง 18 ต้นต่อกลุ่ม)
            const normalizedDensity = Math.min(1.0, Math.max(0, (reefDensity - 0.15) / 0.65));
            const areaScale = Math.max(1.0, (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) / 8.0);
            const plantClusterCount = Math.min(30, Math.floor((8 + normalizedDensity * 8) * Math.pow(areaScale, 0.6)));

            for (let p = 0; p < plantClusterCount; p++) {
              await checkYield();
              // สุ่มตำแหน่งกระจายรอบศูนย์กลางกลุ่มในรัศมี 0.3 ถึง 3.5 หน่วย
              const angle = (p / plantClusterCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
              const distRadius = (0.3 + Math.pow(Math.random(), 0.7) * 2.8) * Math.min(areaScale, 2.5);
              const offX = Math.cos(angle) * distRadius;
              const offZ = Math.sin(angle) * distRadius;

              let pWx = wx + offX * R[0] + offZ * F[0];
              let pWy = wy + offX * R[1] + offZ * F[1];
              let pWz = wz + offX * R[2] + offZ * F[2];

              const pLen = Math.sqrt(pWx * pWx + pWy * pWy + pWz * pWz) || 1;
              const pNx = pWx / pLen;
              const pNy = pWy / pLen;
              const pNz = pWz / pLen;

              const pTheta = Math.acos(Math.max(-1, Math.min(1, pNy)));
              const pPhi = Math.atan2(pNz, pNx);
              const pHeight = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(pTheta, pPhi, seed) : getHeightOnSphere(pTheta, pPhi, seed);

              // ถ้าโผล่ขึ้นเหนือน้ำ ไม่สร้าง
              if (pHeight >= minLandHeight) continue;

              const pR = RADIUS + pHeight * HEIGHT_SCALE;
              pWx = pR * pNx;
              pWy = pR * pNy;
              pWz = pR * pNz;

              buildUnderwaterPlant(
                pWx,
                pWy,
                pWz,
                pNx,
                pNy,
                pNz,
                R,
                F,
                N,
                seed + i * 37 + p * 19,
                vertices,
                colors,
                indices,
              );
            }
            const clusterEndIdx = indices.length;
            if (clusterEndIdx > clusterStartIdx) {
              natureObstacles.push({
                id: i * 1000,
                type: "underwater_plant",
                layer: 0, // Layer 0: ไม่ชนผู้เล่น/กล้อง ลดภาระ raycast collision
                normal: [nx, ny, nz],
                position: [wx, wy, wz],
                radius: 4.0,
                meshStart: clusterStartIdx,
                meshEnd: clusterEndIdx
              });
            }
            continue;
          }

          // ตรวจสอบความหนาแน่นป่าด้วย Noise
          const forestDensity = fbmNoise(
            nx * 2.8,
            ny * 2.8,
            nz * 2.8,
            seed + 1234,
            3,
          );

          if (forestDensity > -0.05) {
            
            const treeCount = Math.floor(Math.random() * 9) + 2; // 2 to 10 trees per zone
            for (let t = 0; t < treeCount; t++) {
                await checkYield();
                if (choppedTrees.includes(i * 1000 + t)) continue;
                const offX = (Math.random() - 0.5) * 2.2;
                const offZ = (Math.random() - 0.5) * 2.2;
                
                const rawWx = wx + offX * R[0] + offZ * F[0];
                const rawWy = wy + offX * R[1] + offZ * F[1];
                const rawWz = wz + offX * R[2] + offZ * F[2];

                const lenLocalW = Math.sqrt(rawWx * rawWx + rawWy * rawWy + rawWz * rawWz) || 1;
                const treeNx = rawWx / lenLocalW;
                const treeNy = rawWy / lenLocalW;
                const treeNz = rawWz / lenLocalW;

                const treeTheta = Math.acos(Math.max(-1.0, Math.min(1.0, treeNy)));
                const treePhi = Math.atan2(treeNz, treeNx);
                const treeH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(treeTheta, treePhi, seed) : getHeightOnSphere(treeTheta, treePhi, seed);
                if (treeH < minLandHeight) continue;

                const treeSurfR = RADIUS + treeH * HEIGHT_SCALE;
                const localWx = treeNx * treeSurfR;
                const localWy = treeNy * treeSurfR;
                const localWz = treeNz * treeSurfR;

                // Skip tree if too close to a cave tunnel (prevents floating on top of cave openings)
                if (isPositionInsideCave(localWx, localWy, localWz, 0.40)) continue;

                const startIdx = indices.length;
                // ============================================
                // สร้างต้นไม้ (TREE) มี ลำต้น ราก กิ่งก้าน และใบ
                // ============================================
                const scale = 0.06 + Math.random() * 0.14; // Natural proportion
                const trunkHeight = scale * (2.6 + Math.random() * 1.5);
                const treeYaw = Math.random() * Math.PI * 2; // สุ่มทิศทางการหันของต้นไม้แต่ละต้นให้ไม่เหมือนกัน 360 องศา

                // Local normal for this specific tree
                const tN = [treeNx, treeNy, treeNz];
                let tRx, tRy, tRz;
                if (Math.abs(treeNy) < 0.9) {
                  tRx = -treeNz; tRy = 0; tRz = treeNx;
                } else {
                  tRx = 1; tRy = 0; tRz = 0;
                }
                const lenTR = Math.sqrt(tRx*tRx + tRy*tRy + tRz*tRz) || 1;
                tRx /= lenTR; tRy /= lenTR; tRz /= lenTR;
                const tFx = tRy*treeNz - tRz*treeNy;
                const tFy = tRz*treeNx - tRx*treeNz;
                const tFz = tRx*treeNy - tRy*treeNx;
                const lenTF = Math.sqrt(tFx*tFx + tFy*tFy + tFz*tFz) || 1;
                const tF = [tFx/lenTF, tFy/lenTF, tFz/lenTF];
                const tR = [tF[1]*treeNz - tF[2]*treeNy, tF[2]*treeNx - tF[0]*treeNz, tF[0]*treeNy - tF[1]*treeNx];

            const branchCountNoise = (fbmNoise(localWx, localWy, localWz, seed + 888) + 1.0) / 2.0;
            const branchCount = 10 + Math.floor(branchCountNoise * 5); // 10 ถึง 14 กิ่งก้านใหญ่กระจายตัว 3D ทั่วลำต้น
            const numTrunkSegs = 3;
            
            // เลือกสีของใบไม้แบบสุ่มตามโทนธรรมชาติ
            const leafType = Math.random();
            let leafColor = [0.15, 0.48, 0.18]; // เขียวขจีปกติ
            if (leafType > 0.8) {
              leafColor = [0.85, 0.42, 0.12]; // ส้มฤดูใบไม้ร่วงอบอุ่น
            } else if (leafType > 0.65) {
              leafColor = [0.42, 0.72, 0.15]; // เขียวอ่อนสว่างไสว
            } else if (leafType > 0.5) {
              leafColor = [0.88, 0.52, 0.65]; // ชมพูพาสเทลซากุระสวรรค์
            }

            // 1. สร้างลำต้น (Trunk) - แบ่งเป็น 3 ส่วนเพื่อความโค้งงอด้วย Noise อย่างเป็นธรรมชาติ
            const T = [[localWx, localWy, localWz]];
            for (let k = 1; k <= numTrunkSegs; k++) {
              const bx = fbmNoise(localWx + k, localWy, localWz, seed + k * 12) * 0.15 * scale;
              const bz = fbmNoise(localWx, localWy, localWz + k, seed + k * 23) * 0.15 * scale;

              const stepX =
                (trunkHeight / numTrunkSegs) * tN[0] + bx * tR[0] + bz * tF[0];
              const stepY =
                (trunkHeight / numTrunkSegs) * tN[1] + bx * tR[1] + bz * tF[1];
              const stepZ =
                (trunkHeight / numTrunkSegs) * tN[2] + bx * tR[2] + bz * tF[2];

              T.push([
                T[k - 1][0] + stepX,
                T[k - 1][1] + stepY,
                T[k - 1][2] + stepZ,
              ]);
            }

            const trunkBaseRadius = scale * 0.16;
            const trunkTopRadius = scale * 0.04;
            const barkColor = [
              0.38 + Math.random() * 0.05,
              0.25 + Math.random() * 0.03,
              0.15 + Math.random() * 0.02,
            ];

            for (let k = 1; k <= numTrunkSegs; k++) {
              const rStart =
                trunkBaseRadius * (1.0 - (0.7 * (k - 1)) / numTrunkSegs);
              const rEnd = trunkBaseRadius * (1.0 - (0.7 * k) / numTrunkSegs);
              buildTaperedSegment(
                T[k - 1],
                T[k],
                rStart,
                rEnd,
                5,
                barkColor,
                vertices,
                colors,
                indices,
                false,
                "bark"
              );
            }

            // ============================================
            // ============================================
            // ============================================
            // ============================================
            // ============================================
            // 2. สร้างราก (Roots) - แบบสุ่มสมจริง
            // ============================================
            const rootCount = 5 + Math.floor(Math.random() * 5); // 5-10 ราก
            const rootLength = scale * (0.8 + Math.random() * 0.8);
            const rootBaseRadius =
              trunkBaseRadius * (0.5 + Math.random() * 0.5);
            const rootColor = [
              barkColor[0] * (0.7 + Math.random() * 0.2),
              barkColor[1] * (0.7 + Math.random() * 0.2),
              barkColor[2] * (0.7 + Math.random() * 0.2),
            ];

            for (let rIdx = 0; rIdx < rootCount; rIdx++) {
              // สุ่มมุมรอบลำต้น + เผื่อความเบี่ยงเบน
              const angleOffset = (Math.random() - 0.5) * 0.6;
              const angle = (rIdx / rootCount) * Math.PI * 2 + angleOffset;

              // สุ่มทิศทางราก (ชี้ลงเล็กน้อย)
              const downFactor = 0.1 + Math.random() * 0.2;
              const rDirX =
                Math.cos(angle) * tR[0] +
                Math.sin(angle) * tF[0] -
                tN[0] * downFactor;
              const rDirY =
                Math.cos(angle) * tR[1] +
                Math.sin(angle) * tF[1] -
                tN[1] * downFactor;
              const rDirZ =
                Math.cos(angle) * tR[2] +
                Math.sin(angle) * tF[2] -
                tN[2] * downFactor;

              // Normalize ทิศทางราก
              const lenDir = Math.sqrt(
                rDirX * rDirX + rDirY * rDirY + rDirZ * rDirZ,
              );
              const normDirX = rDirX / lenDir;
              const normDirY = rDirY / lenDir;
              const normDirZ = rDirZ / lenDir;

              let rp = [T[0][0], T[0][1], T[0][2]];
              const numRootSegs = 3 + Math.floor(Math.random() * 3); // 3-5 segments

              for (let j = 1; j <= numRootSegs; j++) {
                const t = j / numRootSegs;

                // สุ่มความโค้งงอของรากแต่ละsegment
                const wiggleStrength = (Math.random() - 0.5) * 0.15 * scale;
                const wiggleX =
                  Math.sin(rIdx * 2.3 + j * 1.7 + seed) * wiggleStrength;
                const wiggleZ =
                  Math.cos(rIdx * 1.9 + j * 2.3 + seed + 50) * wiggleStrength;

                const stepDist = rootLength / numRootSegs;
                const nextRaw = [
                  rp[0] +
                    normDirX * stepDist +
                    tR[0] * wiggleX +
                    tF[0] * wiggleZ * 0.5,
                  rp[1] +
                    normDirY * stepDist +
                    tR[1] * wiggleX +
                    tF[1] * wiggleZ * 0.5,
                  rp[2] +
                    normDirZ * stepDist +
                    tR[2] * wiggleX +
                    tF[2] * wiggleZ * 0.5,
                ];

                const lenRaw = Math.sqrt(
                  nextRaw[0] * nextRaw[0] +
                    nextRaw[1] * nextRaw[1] +
                    nextRaw[2] * nextRaw[2],
                );
                if (lenRaw < 0.001) continue;

                const ux = nextRaw[0] / lenRaw;
                const uy = nextRaw[1] / lenRaw;
                const uz = nextRaw[2] / lenRaw;

                const theta_pt = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
                const phi_pt = Math.atan2(uz, ux);
                const h_pt = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta_pt, phi_pt, seed) : getHeightOnSphere(theta_pt, phi_pt, seed);
                const r_surf = RADIUS + h_pt * HEIGHT_SCALE;

                // สุ่มความเรียวของราก (ไม่ให้ติด 0)
                const taperPower = 1.5 + Math.random() * 1.0;
                const rStart = Math.max(
                  0.005,
                  rootBaseRadius *
                    Math.pow(1.0 - (j - 1) / numRootSegs, taperPower),
                );
                const rEnd = Math.max(
                  0.003,
                  rootBaseRadius * Math.pow(1.0 - j / numRootSegs, taperPower),
                );

                // ยกขึ้นจากผิว (สุ่มเล็กน้อย)
                const liftFactor = 0.05 + Math.random() * 0.1;
                const r_root = r_surf + rEnd * liftFactor;

                const nextRp = [ux * r_root, uy * r_root, uz * r_root];

                const dx = nextRp[0] - rp[0];
                const dy = nextRp[1] - rp[1];
                const dz = nextRp[2] - rp[2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist > 0.001 && rStart > 0.001 && rEnd > 0.001) {
                  // สุ่มสีรากตาม segment
                  const segmentColor = [
                    rootColor[0] * (0.8 + 0.2 * (1 - t)),
                    rootColor[1] * (0.8 + 0.2 * (1 - t)),
                    rootColor[2] * (0.8 + 0.2 * (1 - t)),
                  ];
                  const radialSegs = 4 + Math.floor(Math.random() * 3); // 4-6
                  buildTaperedSegment(
                    rp,
                    nextRp,
                    rStart,
                    rEnd,
                    radialSegs,
                    segmentColor,
                    vertices,
                    colors,
                    indices,
                  );
                }

                rp = nextRp;
              }
            }

            const trunkRootMeshEnd = indices.length;

            // 3. สร้างกิ่งก้านใหญ่ (Large Branches) - แตกออกจากลำต้นหลายระดับและกระจายทิศทาง 360 องศาอย่างสมบูรณ์แบบ
            const branchLength = scale * (1.1 + Math.random() * 0.3);
            const branchBaseRadius = trunkBaseRadius * 0.38; // ปรับลดขนาดเล็กน้อยเพื่อให้เข้ากับจำนวนกิ่งที่เพิ่มขึ้นอย่างสวยงาม

            for (let bIdx = 0; bIdx < branchCount; bIdx++) {
              if (bIdx % 2 === 0) {
                await checkYield();
              }
              // กระจายกิ่งก้านใหญ่ตามความสูงลำต้น (30% - 100%) เพื่อไม่ให้กระจุกตัว และให้พุ่มไม้ดูอวบอิ่มสมดุล
              const fraction = 0.3 + 0.7 * (bIdx / (branchCount - 1 || 1));
              const tVal = fraction * numTrunkSegs;
              const idx = Math.min(numTrunkSegs - 1, Math.floor(tVal));
              const frac = tVal - idx;
              const p0 = T[idx];
              const p1 = T[idx + 1];
              const bOrigin = [
                p0[0] + (p1[0] - p0[0]) * frac,
                p0[1] + (p1[1] - p0[1]) * frac,
                p0[2] + (p1[2] - p0[2]) * frac
              ];

              // ใช้ Golden Angle (2.399963) ในการกระจายทิศทาง 360 องศาอย่างเป็นธรรมชาติสูงสุด ป้องกันกิ่งก้านขึ้นซ้อนทับหรือเอียงไปทางเดียว
              const bAngle =
                treeYaw +
                bIdx * 2.399963 +
                (Math.random() - 0.5) * 0.2;
              const bTilt = 0.32 + Math.random() * 0.24; // สุ่มมุมเอียงกิ่งชี้ขึ้นฟ้าอย่างสวยงาม
              const bDirX =
                Math.cos(bAngle) * tR[0] + Math.sin(bAngle) * tF[0] + bTilt * tN[0];
              const bDirY =
                Math.cos(bAngle) * tR[1] + Math.sin(bAngle) * tF[1] + bTilt * tN[1];
              const bDirZ =
                Math.cos(bAngle) * tR[2] + Math.sin(bAngle) * tF[2] + bTilt * tN[2];

              const lenB = Math.sqrt(
                bDirX * bDirX + bDirY * bDirY + bDirZ * bDirZ,
              );
              const bDirNorm = [bDirX / (lenB || 1), bDirY / (lenB || 1), bDirZ / (lenB || 1)];

              let bp = bOrigin;
              const numBranchSegs = 3; // แบ่งกิ่งใหญ่เป็น 3 ส่วนเพื่อให้มีจุดแตกกิ่งย่อยได้ตลอดแนวอย่างสวยงาม
              const branchPts = [bOrigin];
              const branchRadii = [branchBaseRadius];

              for (let j = 1; j <= numBranchSegs; j++) {
                const bxNoise =
                  fbmNoise(bp[0], bp[1], bp[2], seed + bIdx * 8 + j) *
                  0.045 *
                  scale;
                const bzNoise =
                  fbmNoise(bp[1], bp[2], bp[0], seed + bIdx * 8 + j + 25) *
                  0.045 *
                  scale;

                const nextBp = [
                  bp[0] +
                    (branchLength / numBranchSegs) * bDirNorm[0] +
                    bxNoise,
                  bp[1] +
                    (branchLength / numBranchSegs) * bDirNorm[1] +
                    bzNoise,
                  bp[2] +
                    (branchLength / numBranchSegs) * bDirNorm[2] +
                    bxNoise,
                ];

                const rStart =
                  branchBaseRadius * (1.0 - (0.65 * (j - 1)) / numBranchSegs);
                const rEnd =
                  branchBaseRadius * (1.0 - (0.65 * j) / numBranchSegs);

                const bSwayStart = (j - 1) / numBranchSegs;
                const bSwayEnd = j / numBranchSegs;

                // วาดกิ่งก้านส่วนหลัก (ก้านใหญ่)
                buildTaperedSegment(
                  bp,
                  nextBp,
                  rStart,
                  rEnd,
                  4,
                  barkColor,
                  vertices,
                  colors,
                  indices,
                  false,
                  bSwayStart,
                  bSwayEnd
                );

                branchPts.push(nextBp);
                branchRadii.push(rEnd);
                bp = nextBp;
              }

              // สุ่มจำนวนกิ่งเล็ก (numTwigs) ในช่วง 4-11 กิ่งต่อหนึ่งกิ่งก้านใหญ่ มีน้ำหนักเบาและสัดส่วนสมจริง
              const twigNoiseVal = (fbmNoise(bOrigin[0], bOrigin[1], bOrigin[2], seed + bIdx * 333) + 1.0) / 2.0;
              const numTwigs = 4 + Math.floor(twigNoiseVal * 8); // 4 ถึง 11 กิ่งก้านเล็ก

              // แตกกิ่งก้านเล็ก (Small Twigs) ออกจากกิ่งใหญ่โดยตรงเพื่อเชื่อมสู่พุ่มใบไม้
              for (let tIdx = 0; tIdx < numTwigs; tIdx++) {
                // เฉลี่ยตำแหน่งแตกกิ่งย่อยตลอดความยาวกิ่งใหญ่ (ตั้งแต่ 15% ถึง 90%)
                const fraction = 0.15 + 0.75 * (tIdx / (numTwigs - 1 || 1));
                
                // หาพิกัด tStart และความหนา rStart โดยการ interpolate บน 3 segments ของกิ่งใหญ่
                const tIdxFraction = fraction * numBranchSegs;
                const segIdx = Math.min(numBranchSegs - 1, Math.floor(tIdxFraction));
                const segFraction = tIdxFraction - segIdx;

                const p0 = branchPts[segIdx];
                const p1 = branchPts[segIdx + 1];

                const tStart = [
                  p0[0] + (p1[0] - p0[0]) * segFraction,
                  p0[1] + (p1[1] - p0[1]) * segFraction,
                  p0[2] + (p1[2] - p0[2]) * segFraction,
                ];

                const rStartVal = branchRadii[segIdx] + (branchRadii[segIdx + 1] - branchRadii[segIdx]) * segFraction;
                const rEndVal = rStartVal * 0.35;

                const twigBranchSwayStart = fraction;
                const twigBranchSwayEnd = 1.0;

                // สลับฝั่งกิ่งเล็กสลับซ้ายขวาอย่างสมดุลเป็นระเบียบตามธรรมชาติ ไม่เอียงไปข้างใดข้างหนึ่ง
                const alternateFactor = (tIdx % 2 === 0) ? 1.0 : -1.0;
                const tAngle = bAngle + alternateFactor * (0.55 + Math.random() * 0.35);

                const tTilt = 0.25 + Math.random() * 0.25; // สุ่มทิศทางมุมชี้ขึ้นของกิ่งเล็กเพื่อความเหมือนจริง
                const tDirX = Math.cos(tAngle) * R[0] + Math.sin(tAngle) * F[0] + tTilt * N[0];
                const tDirY = Math.cos(tAngle) * R[1] + Math.sin(tAngle) * F[1] + tTilt * N[1];
                const tDirZ = Math.cos(tAngle) * R[2] + Math.sin(tAngle) * F[2] + tTilt * N[2];

                const lenT = Math.sqrt(tDirX * tDirX + tDirY * tDirY + tDirZ * tDirZ);
                const tDirNorm = [
                  tDirX / (lenT || 1),
                  tDirY / (lenT || 1),
                  tDirZ / (lenT || 1),
                ];

                // ความยาวก้านย่อยปรับสุ่มรับกับค่า fbmNoise อย่างสวยงามมีสเกลเป็นเอกลักษณ์
                const lengthNoise = (fbmNoise(tStart[1], tStart[2], tStart[0], seed + bIdx * 70 + tIdx) + 1.0) / 2.0;
                const twigLength = branchLength * (0.35 + lengthNoise * 0.15);

                const tEnd = [
                  tStart[0] + tDirNorm[0] * twigLength,
                  tStart[1] + tDirNorm[1] * twigLength,
                  tStart[2] + tDirNorm[2] * twigLength,
                ];

                // ก้านเล็กมีความเรียวบางสวยงามสมสัดส่วน
                const tStartRad = rStartVal * 0.42;
                const tEndRad = rEndVal * 0.15;

                // วาดกิ่งเล็ก (Small twig) และสร้างใบไม้สลับกันเรียงตัวบนกิ่งเล็กโดยตรง (Leaves along twig)
                buildLeavesAlongTwig(
                  tStart,
                  tEnd,
                  tStartRad,
                  tEndRad,
                  leafColor,
                  seed + bIdx * 250 + tIdx * 12,
                  vertices,
                  colors,
                  indices,
                  twigBranchSwayStart,
                  twigBranchSwayEnd
                );
              }

              // และที่ปลายสุดของกิ่งใหญ่ (bp) ให้มีพุ่มใบย่อยตกแต่งรับแสงเพื่อความสวยงามสมจริง
              const leafRadius = scale * (0.44 + Math.random() * 0.18); // Increased cluster size
              buildFoliageCluster(
                bp,
                leafRadius,
                leafColor,
                seed + bIdx * 100,
                vertices,
                colors,
                indices,
                1.0,
                1.1
              );
            }

            const topLeafRadius = scale * (0.6 + Math.random() * 0.2); // Increased top cluster size
            buildFoliageCluster(
              T[3],
              topLeafRadius,
              leafColor,
              seed + 888,
              vertices,
              colors,
              indices,
              0.0,
              0.3
            );
            const endIdx = indices.length;

            natureObstacles.push({
              id: i * 1000 + t,
              type: "tree",
              layer: COLLISION_LAYERS.TREE,
              partsCount: numTrunkSegs + branchCount,
              branchCount: branchCount,
              normal: [treeNx, treeNy, treeNz],
              position: [localWx, localWy, localWz],
              radius: scale * 12.0, // Large safe radius to fully cover tree height and branches
              meshStart: startIdx,
              meshEnd: endIdx,
              collisionMeshEnd: trunkRootMeshEnd,
              trunkHeight: trunkHeight,
              trunkBaseRadius: trunkBaseRadius
            });

            treePositions.push({ theta: treeTheta, phi: treePhi });
            }
            
          } else {
            if (destroyedRocks.includes(i)) continue;
            const startIdx = indices.length;
            // ============================================
            // สร้างก้อนหิน (ROCK) แบบกลุ่มก้อน
            // ============================================
            const scale = 0.06 + Math.random() * 0.12;
            const rockRadius = scale * (0.8 + Math.random() * 0.5);

            const rockType = Math.random();
            let rockColor = [0.46, 0.46, 0.46];
            if (rockType > 0.7) {
              rockColor = [0.42, 0.36, 0.32];
            } else if (rockType < 0.25) {
              rockColor = [0.32, 0.34, 0.36];
            }

            const rockCenter = [
              wx - N[0] * (rockRadius * 0.15),
              wy - N[1] * (rockRadius * 0.15),
              wz - N[2] * (rockRadius * 0.15),
            ];

            // Skip rock if too close to a cave tunnel (prevents spawning over cave openings)
            if (isPositionInsideCave(rockCenter[0], rockCenter[1], rockCenter[2], 0.25)) continue;

            buildRockFormation(
              rockCenter,
              rockRadius,
              rockColor,
              seed + i * 15,
              vertices,
              colors,
              indices,
            );

            const endIdx = indices.length;
            natureObstacles.push({
              id: i,
              type: "rock",
              layer: COLLISION_LAYERS.ROCK,
              normal: [nx, ny, nz],
              position: rockCenter,
              radius: rockRadius * 2.5, // Cover all scattered sub-rocks safely
              meshStart: startIdx,
              meshEnd: endIdx
            });
          }
        }

        // ============================================
        // สร้างแร่เหล็ก และทอง ใต้ดิน (UNDERGROUND ORE GENERATION)
        // ============================================
        let oreSeed = seed + 77123;
        function oreRand() {
          const x = Math.sin(oreSeed++) * 10000;
          return x - Math.floor(x);
        }
        
        // Helper to snap coordinates to the blended/sculpted cave wall
        function snapToCaveWallOrAdjust(px, py, pz, seedVal) {
          if (!tunnels3D || tunnels3D.length === 0) {
            return [px, py, pz, false];
          }

          const lenP = Math.sqrt(px*px + py*py + pz*pz) || 1;
          const ux = px / lenP;
          const uy = py / lenP;
          const uz = pz / lenP;

          const terrainRadius = RADIUS + getHeightOnSphere(Math.acos(uy), Math.atan2(uz, ux), seedVal) * HEIGHT_SCALE;
          const distToCenter = lenP;

          let inCave = false;
          for (let i = 0; i < tunnels3D.length; i++) {
            const t = tunnels3D[i];
            const dx = px - t.x;
            const dy = py - t.y;
            const dz = pz - t.z;
            const dSq = dx*dx + dy*dy + dz*dz;
            if (dSq < t.r * t.r) {
              inCave = true;
              break;
            }
          }

          if (inCave) {
            let currentX = px;
            let currentY = py;
            let currentZ = pz;
            let snappedAny = false;
            
            for (let iter = 0; iter < 3; iter++) {
              let closestT = null;
              let minDist = Infinity;
              for (let i = 0; i < tunnels3D.length; i++) {
                const t = tunnels3D[i];
                const dx = currentX - t.x;
                const dy = currentY - t.y;
                const dz = currentZ - t.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                // We want to push it to the boundary of the sphere it's currently inside of
                if (dist < t.r * 1.05 && dist < minDist) {
                  minDist = dist;
                  closestT = t;
                }
              }
              if (closestT) {
                const dx = currentX - closestT.x;
                const dy = currentY - closestT.y;
                const dz = currentZ - closestT.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
                // Project out to the boundary of this tunnel sphere
                currentX = closestT.x + (dx / dist) * closestT.r;
                currentY = closestT.y + (dy / dist) * closestT.r;
                currentZ = closestT.z + (dz / dist) * closestT.r;
                snappedAny = true;
              }
            }
            
            // Check if snapping pushed it above the terrain surface!
            const lenFinal = Math.sqrt(currentX*currentX + currentY*currentY + currentZ*currentZ) || 1;
            if (lenFinal > terrainRadius) {
              currentX = ux * terrainRadius;
              currentY = uy * terrainRadius;
              currentZ = uz * terrainRadius;
            }

            return [currentX, currentY, currentZ, true];
          }

          // Handle solid ground blending naturally if not inside cave
          if (distToCenter > terrainRadius) {
            let currentX = px;
            let currentY = py;
            let currentZ = pz;
            let closestT = null;
            let minDist = Infinity;
            for (let i = 0; i < tunnels3D.length; i++) {
              const t = tunnels3D[i];
              const dx = currentX - t.x;
              const dy = currentY - t.y;
              const dz = currentZ - t.z;
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (dist < t.r * 1.5 && dist < minDist) {
                minDist = dist;
                closestT = t;
              }
            }
            if (closestT) {
              const depth = terrainRadius - distToCenter;
              const blendRange = closestT.r * 0.45;
              if (depth <= 0.0) {
                currentX = ux * terrainRadius;
                currentY = uy * terrainRadius;
                currentZ = uz * terrainRadius;
              } else if (depth < blendRange) {
                const blend_t = depth / blendRange;
                const smooth_t = blend_t * blend_t * (3 - 2 * blend_t);
                const blendedRadius = terrainRadius * (1 - smooth_t) + distToCenter * smooth_t;
                currentX = ux * blendedRadius;
                currentY = uy * blendedRadius;
                currentZ = uz * blendedRadius;
              }
            }
            return [currentX, currentY, currentZ, true];
          }

          return [px, py, pz, false];
        }

        if (typeof window.OreSystem !== "undefined" && window.OreSystem.generateOres) {
          await window.OreSystem.generateOres({
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
            COLLISION_LAYERS: COLLISION_LAYERS
          }, undefined, checkYield);
        }

        
        // ============================================
        // สร้างหญ้า (GRASS) อัตโนมัติ - พื้นเขียว/ป่าเป็นหลัก, โซนอื่นประปรายแต่น้อย, โคนต้นไม้คงไว้แบบเดิม
        // ============================================
        const currentBiome = typeof window !== "undefined" ? (window.CURRENT_BIOME || (RADIUS < 8.0 ? 'moon' : 'normal')) : 'normal';
        const hScaleVal = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow((typeof RADIUS !== 'undefined' ? RADIUS : 8.0) / 8.0, 0.70));
        const isWaterOn = typeof waterEnabled !== 'undefined' ? waterEnabled : true;
        const waterH = isWaterOn ? (((typeof waterLevel !== 'undefined' ? waterLevel : 0) * 0.15) / hScaleVal) : -999.0;
        
        natureGrassStartIndex = indices.length;
        const isGrassEnabled = typeof window.globalGrassEnabled !== 'undefined' ? window.globalGrassEnabled : true;
        const userGrassDensity = typeof window.globalGrassDensity !== 'undefined' ? window.globalGrassDensity : 1.0;
        
        // Base grass density based on planet biome
        let isGrassBiome = true;
        if (currentBiome === 'moon' || currentBiome === 'desert') isGrassBiome = false;
        
        // ฟังก์ชันประเมินการงอกของหญ้าตามผืนดิน
        function getGrassSpawnProfile(surfColor, h_pt) {
            if (!isGrassBiome) return { count: 0, scale: 0, isLush: false };
            if (h_pt <= waterH + 0.03) return { count: 0, scale: 0, isLush: false }; // ไม่เกิดใต้น้ำ
            if (h_pt >= 1.55) return { count: 0, scale: 0, isLush: false }; // ไม่เกิดบนยอดเขาหิมะ
            
            if (!surfColor) {
                if (h_pt >= 0.48 && h_pt <= 1.15) return { count: 6, scale: 1.35, isLush: true };
                if (h_pt >= 0.46 && h_pt <= 1.45) return { count: (Math.random() < 0.12 ? 1 : 0), scale: 0.90, isLush: false };
                return { count: 0, scale: 0, isLush: false };
            }
            
            const r = surfColor[0];
            const g = surfColor[1];
            const b = surfColor[2];
            
            // หาดทราย (Sand Beach): ขาว/ทองริมทะเล ไม่มีหญ้าขึ้นมั่ว
            const isSand = (h_pt < 0.46) || (r > 0.65 && g > 0.58 && b > 0.45 && (r >= g * 0.90 || h_pt < 0.50));
            if (isSand) {
                return { count: 0, scale: 0, isLush: false };
            }
            
            // 1. โซนพื้นเขียว / ป่าดงดิบ / ทุ่งหญ้า (Lush Green Zone & Forests) -> หญ้าหนาแน่นเป็นกลุ่มธรรมชาติ
            const isLush = (currentBiome === 'jungle' && g >= 0.26 && g > b * 0.88) ||
                           (g >= 0.30 && g > r * 1.05 && g > b * 1.05 && r < 0.66) ||
                           (currentBiome === 'normal' && h_pt >= 0.48 && h_pt <= 1.12 && g > 0.30 && g >= r * 0.92);
                           
            if (isLush) {
                // หญ้าขึ้นชิดแน่นหนาเต็มผืนดินเขียว (3-5 กอต่อจุด)
                const tufts = Math.floor((3 + Math.floor(Math.random() * 3)) * userGrassDensity);
                return { count: Math.max(2, tufts), scale: 1.3, isLush: true };
            }
            
            // 2. โซนอื่นๆ เช่น เนินเขาหิน โขดหิน ดินแห้ง -> มีหญ้าประปรายแต่น้อย (Sparse)
            if (h_pt >= 0.48 && h_pt <= 1.45) {
                if (Math.random() < 0.06 * userGrassDensity) {
                    return { count: 1, scale: 0.85, isLush: false };
                }
            }
            
            return { count: 0, scale: 0, isLush: false };
        }

        // ฟังก์ชันตรวจเช็คสำหรับโคนต้นไม้ (คงไว้แบบเดิม)
        function isTreeBaseGround(surfColor, h_pt) {
            if (!isGrassBiome) return false;
            if (h_pt <= waterH + 0.02) return false;
            if (h_pt > 1.55) return false;
            if (!surfColor) return true;
            const r = surfColor[0];
            const g = surfColor[1];
            const b = surfColor[2];
            if (h_pt < 0.46 && r > 0.70 && g > 0.65) return false; // ไม่เกิดบนหาดทรายริมน้ำ
            return true;
        }

        function addGrassTuft(gX, gY, gZ, h_pt, r_surf, groundColor, densityMult = 1.0) {
            if (!isGrassEnabled || userGrassDensity <= 0.001 || !isGrassBiome) return;
            const gCenter = [gX * r_surf, gY * r_surf, gZ * r_surf];
            const numBlades = Math.max(3, Math.floor((4 + Math.floor(Math.random() * 3)) * Math.max(0.8, densityMult)));
            
            const baseN = [gX, gY, gZ];
            let baseRX, baseRY, baseRZ;
            if (Math.abs(baseN[0]) < 0.9 && Math.abs(baseN[2]) < 0.9) {
                baseRX = -baseN[2]; baseRY = 0; baseRZ = baseN[0];
            } else {
                baseRX = 1; baseRY = 0; baseRZ = 0;
            }
            const lr = Math.sqrt(baseRX*baseRX + baseRY*baseRY + baseRZ*baseRZ);
            const bR = [baseRX/lr, baseRY/lr, baseRZ/lr];
            const bF = [
                bR[1]*baseN[2] - bR[2]*baseN[1],
                bR[2]*baseN[0] - bR[0]*baseN[2],
                bR[0]*baseN[1] - bR[1]*baseN[0]
            ];
            
            const tuftHeightScale = 1.0 + Math.random() * 0.35;
            
            for(let b=0; b<numBlades; b++) {
                // กิ่งใบหญ้ากระจายตัวเป็นพุ่มใบแน่นสวยงาม
                const baseAngle = (b / numBlades) * Math.PI * 2;
                const gAngle = baseAngle + (Math.random() - 0.5) * 0.50;
                
                const styleRoll = Math.random();
                let lean, gHeight, gWidth, curve;
                
                if (styleRoll < 0.35) {
                    // หญ้าเตี้ยแน่นชิดพื้น
                    lean = 0.18 + Math.random() * 0.25;
                    gHeight = (0.080 + Math.random() * 0.035) * tuftHeightScale;
                    gWidth = 0.013 + Math.random() * 0.004;
                    curve = (Math.random() - 0.5) * 0.45;
                } else if (styleRoll < 0.75) {
                    // หญ้าขนาดกลาง กวัดแกว่งธรรมชาติ
                    lean = 0.14 + Math.random() * 0.22;
                    gHeight = (0.120 + Math.random() * 0.045) * tuftHeightScale;
                    gWidth = 0.015 + Math.random() * 0.005;
                    curve = (Math.random() - 0.5) * 0.55;
                } else {
                    // หญ้ายอดสูง
                    lean = 0.08 + Math.random() * 0.18;
                    gHeight = (0.170 + Math.random() * 0.055) * tuftHeightScale;
                    gWidth = 0.017 + Math.random() * 0.005;
                    curve = (Math.random() - 0.5) * 0.65;
                }
                
                const gDirX = Math.cos(gAngle) * bR[0] + Math.sin(gAngle) * bF[0] + baseN[0] * (2.0 - lean);
                const gDirY = Math.cos(gAngle) * bR[1] + Math.sin(gAngle) * bF[1] + baseN[1] * (2.0 - lean);
                const gDirZ = Math.cos(gAngle) * bR[2] + Math.sin(gAngle) * bF[2] + baseN[2] * (2.0 - lean);
                
                const lDir = Math.sqrt(gDirX*gDirX + gDirY*gDirY + gDirZ*gDirZ);
                const dir = [gDirX/lDir, gDirY/lDir, gDirZ/lDir];
                
                let cX = dir[1]*baseN[2] - dir[2]*baseN[1];
                let cY = dir[2]*baseN[0] - dir[0]*baseN[2];
                let cZ = dir[0]*baseN[1] - dir[1]*baseN[0];
                let lC = Math.sqrt(cX*cX + cY*cY + cZ*cZ);
                if (lC < 0.0001) { cX = bR[0]; cY = bR[1]; cZ = bR[2]; lC = 1; }
                const wDir = [cX/lC, cY/lC, cZ/lC];

                const topSimple = [
                    gCenter[0] + dir[0]*gHeight + wDir[0]*gWidth*curve,
                    gCenter[1] + dir[1]*gHeight + wDir[1]*gWidth*curve,
                    gCenter[2] + dir[2]*gHeight + wDir[2]*gWidth*curve
                ];
                
                const p1 = [gCenter[0] + wDir[0]*gWidth, gCenter[1] + wDir[1]*gWidth, gCenter[2] + wDir[2]*gWidth];
                const p2 = [gCenter[0] - wDir[0]*gWidth, gCenter[1] - wDir[1]*gWidth, gCenter[2] - wDir[2]*gWidth];
                
                let baseToneR = 0.10 + Math.random() * 0.06;
                let baseToneG = (currentBiome === 'jungle' ? 0.65 : 0.58) + Math.random() * 0.12;
                let baseToneB = 0.12 + Math.random() * 0.06;
                
                if (groundColor && groundColor[1] > 0.20) {
                    baseToneR = Math.max(0.04, groundColor[0] * 0.85 + (Math.random() - 0.5) * 0.04);
                    baseToneG = Math.max(0.48, groundColor[1] * 1.12 + (Math.random() - 0.5) * 0.06);
                    baseToneB = Math.max(0.05, groundColor[2] * 0.85 + (Math.random() - 0.5) * 0.04);
                }
                
                const topColor = [
                    Math.max(0.02, Math.min(1.0, baseToneR)),
                    Math.max(0.35, Math.min(1.0, baseToneG)),
                    Math.max(0.02, Math.min(1.0, baseToneB))
                ];
                const botColor = [topColor[0]*0.35, topColor[1]*0.42, topColor[2]*0.35];
                
                const vOff = vertices.length / 3;
                vertices.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], topSimple[0], topSimple[1], topSimple[2]);
                colors.push(-botColor[0] - 10.0, botColor[1], botColor[2], -botColor[0] - 10.0, botColor[1], botColor[2], -topColor[0], topColor[1], topColor[2]);
                indices.push(vOff, vOff+1, vOff+2);
            }
        }
        
        window.grassChunks = [];
        grassChunks = window.grassChunks;
        
        // 1. หญ้าที่โคนต้นไม้ (คงไว้แบบเดิมตามที่ผู้เล่นต้องการ + ปรับเพิ่มตามขนาดดาว)
        if (isGrassBiome && isGrassEnabled && userGrassDensity > 0) {
            const radiusScaleRatio = Math.max(1.0, RADIUS / 8.0);
            for (let i = 0; i < treePositions.length; i++) {
                if (i % 10 === 0) await checkYield();
                const chunkStart = indices.length;
                const tp = treePositions[i];
                const numGrassNearTree = Math.floor(40 * userGrassDensity * Math.min(2.0, Math.max(1.0, radiusScaleRatio)));
                const sinTheta = Math.max(0.15, Math.sin(tp.theta));

                for (let j = 0; j < numGrassNearTree; j++) {
                    const spread = 0.14 / radiusScaleRatio;
                    const gTheta = tp.theta + (Math.random() - 0.5) * spread;
                    const gPhi = tp.phi + (Math.random() - 0.5) * spread / sinTheta;
                    const gX = Math.sin(gTheta) * Math.cos(gPhi);
                    const gY = Math.cos(gTheta);
                    const gZ = Math.sin(gTheta) * Math.sin(gPhi);
                    
                    const surfData = typeof getTerrainHeightAndColor === "function" 
                        ? getTerrainHeightAndColor(gTheta, gPhi, seed) 
                        : { height: getHeightOnSphere(gTheta, gPhi, seed), color: [0.3, 0.6, 0.2] };
                    const h_pt = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(gTheta, gPhi, seed) : surfData.height;
                    const gColor = surfData.color;
                    
                    if (h_pt <= waterH + 0.02) continue;
                    
                    const r_surf = RADIUS + h_pt * HEIGHT_SCALE;
                    const gx_world = gX * r_surf;
                    const gy_world = gY * r_surf;
                    const gz_world = gZ * r_surf;
                    if (isPositionInsideCave(gx_world, gy_world, gz_world, 0.15)) continue;

                    addGrassTuft(gX, gY, gZ, h_pt, r_surf, gColor, 1.35);
                }

                const chunkEnd = indices.length;
                if (chunkEnd > chunkStart) {
                    const treeH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(tp.theta, tp.phi, seed) : (typeof getHeightOnSphere === "function" ? getHeightOnSphere(tp.theta, tp.phi, seed) : 0);
                    const r_treeSurf = RADIUS + treeH * HEIGHT_SCALE;
                    const gX = Math.sin(tp.theta) * Math.cos(tp.phi) * r_treeSurf;
                    const gY = Math.cos(tp.theta) * r_treeSurf;
                    const gZ = Math.sin(tp.theta) * Math.sin(tp.phi) * r_treeSurf;
                    grassChunks.push({ start: chunkStart, count: chunkEnd - chunkStart, pos: [gX, gY, gZ], radius: Math.max(6.0, RADIUS * 0.25) });
                }
            }
        }
        
        // 2. หญ้าในทุ่งกว้างทั่วดาว (หนาแน่นสวยงาม กระจายตัวเต็มผืนดินแบบสมดุลหน่วยความจำ)
        if (isGrassBiome && isGrassEnabled && userGrassDensity > 0) {
            const rRatio = Math.max(0.5, RADIUS / 8.0);
            
            const latBands = Math.max(16, Math.min(32, Math.round(18 * rRatio)));
            const lonBands = Math.max(32, Math.min(64, Math.round(36 * rRatio)));
            const samplesPerCell = Math.max(12, Math.floor(22 * userGrassDensity * Math.min(2.0, Math.max(1.0, rRatio))));
            
            for (let lat = 0; lat < latBands; lat++) {
                for (let lon = 0; lon < lonBands; lon++) {
                    if ((lat * lonBands + lon) % 4 === 0) await checkYield();
                    
                    const chunkStart = indices.length;
                    const latMin = (lat / latBands) * Math.PI;
                    const latMax = ((lat + 1) / latBands) * Math.PI;
                    const lonMin = (lon / lonBands) * Math.PI * 2;
                    const lonMax = ((lon + 1) / lonBands) * Math.PI * 2;
                    
                    const minCos = Math.cos(latMax);
                    const maxCos = Math.cos(latMin);
                    
                    let cxAcc = 0, cyAcc = 0, czAcc = 0, validTufts = 0;
                    
                    for (let g = 0; g < samplesPerCell; g++) {
                        const uCos = minCos + (maxCos - minCos) * Math.random();
                        const gTheta = Math.acos(Math.max(-1.0, Math.min(1.0, uCos)));
                        const gPhi = lonMin + (lonMax - lonMin) * Math.random();
                        
                        const gX = Math.sin(gTheta) * Math.cos(gPhi);
                        const gY = Math.cos(gTheta);
                        const gZ = Math.sin(gTheta) * Math.sin(gPhi);
                        
                        const surfData = typeof getTerrainHeightAndColor === "function" 
                            ? getTerrainHeightAndColor(gTheta, gPhi, seed) 
                            : { height: getHeightOnSphere(gTheta, gPhi, seed), color: [0.3, 0.6, 0.2] };
                        
                        const h_pt = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(gTheta, gPhi, seed) : surfData.height;
                        const gColor = surfData.color;
                        
                        // ประเมินโปรไฟล์การเกิดของหญ้าตามสีและความสูง
                        const profile = getGrassSpawnProfile(gColor, h_pt);
                        if (profile.count <= 0) continue;
                        
                        const r_surf = RADIUS + h_pt * HEIGHT_SCALE;
                        const gx_world = gX * r_surf;
                        const gy_world = gY * r_surf;
                        const gz_world = gZ * r_surf;
                        if (isPositionInsideCave(gx_world, gy_world, gz_world, 0.15)) continue;
                        
                        // ปลูกกอหญ้าตามโปรไฟล์ (พื้นเขียว: กลุ่มแน่น 3-5 กอ, พื้นอื่น: 1 กอเล็กประปราย)
                        if (profile.isLush) {
                            addGrassTuft(gX, gY, gZ, h_pt, r_surf, gColor, profile.scale);
                            cxAcc += gx_world; cyAcc += gy_world; czAcc += gz_world; validTufts++;
                            
                            const clusterSpread = 0.040 / rRatio;
                            const clusterCount = Math.round(profile.count * Math.min(2.0, Math.max(1.0, rRatio)));
                            for (let c = 1; c < clusterCount; c++) {
                                const cTheta = gTheta + (Math.random() - 0.5) * clusterSpread;
                                const cPhi = gPhi + (Math.random() - 0.5) * clusterSpread;
                                const cX = Math.sin(cTheta) * Math.cos(cPhi);
                                const cY = Math.cos(cTheta);
                                const cZ = Math.sin(cTheta) * Math.sin(cPhi);
                                
                                const cSurf = typeof getTerrainHeightAndColor === "function"
                                    ? getTerrainHeightAndColor(cTheta, cPhi, seed)
                                    : surfData;
                                
                                const cH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(cTheta, cPhi, seed) : cSurf.height;
                                const cProfile = getGrassSpawnProfile(cSurf.color, cH);
                                if (cProfile.count <= 0) continue;
                                
                                const cR = RADIUS + cH * HEIGHT_SCALE;
                                const cgx = cX * cR;
                                const cgy = cY * cR;
                                const cgz = cZ * cR;
                                if (isPositionInsideCave(cgx, cgy, cgz, 0.15)) continue;
                                
                                addGrassTuft(cX, cY, cZ, cH, cR, cSurf.color, profile.scale);
                                cxAcc += cgx; cyAcc += cgy; czAcc += cgz; validTufts++;
                            }
                        } else {
                            // โซนอื่นๆ: หญ้าประปราย 1 กอเดี่ยวขนาดเล็ก
                            addGrassTuft(gX, gY, gZ, h_pt, r_surf, gColor, profile.scale);
                            cxAcc += gx_world; cyAcc += gy_world; czAcc += gz_world; validTufts++;
                        }
                    }
                    
                    const chunkEnd = indices.length;
                    if (chunkEnd > chunkStart && validTufts > 0) {
                        const patchRadius = Math.max(6.0, (Math.PI * RADIUS / latBands) * 1.8);
                        grassChunks.push({
                            start: chunkStart,
                            count: chunkEnd - chunkStart,
                            pos: [cxAcc / validTufts, cyAcc / validTufts, czAcc / validTufts],
                            radius: patchRadius
                        });
                    }
                }
            }
        }
        
        const flatGeom = await asyncMakeFlatShadedGeometry(
            vertices.data ? vertices.data.subarray(0, vertices.length) : vertices,
            colors.data ? colors.data.subarray(0, colors.length) : colors,
            indices.data ? indices.data.subarray(0, indices.length) : indices,
            checkYield
        );
        if (vertices.data) vertices.data = null;
        if (colors.data) colors.data = null;
        if (indices.data) indices.data = null;

        natureIndicesLength = flatGeom.indices.length;
        natureGrassIndexCount = natureIndicesLength - natureGrassStartIndex;
        natureRawVertices = flatGeom.vertices;

        if (natureVertexBuffer) gl.deleteBuffer(natureVertexBuffer);
        if (natureColorBuffer) gl.deleteBuffer(natureColorBuffer);
        if (natureNormalBuffer) gl.deleteBuffer(natureNormalBuffer);
        if (natureIndexBuffer) gl.deleteBuffer(natureIndexBuffer);

        natureVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, natureVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          flatGeom.vertices,
          gl.STATIC_DRAW,
        );

        natureColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, natureColorBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          flatGeom.colors,
          gl.STATIC_DRAW,
        );

        natureNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, natureNormalBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          flatGeom.normals,
          gl.STATIC_DRAW,
        );

        natureIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, natureIndexBuffer);
        if (supportUint32 && natureIndicesLength > 65535) {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            flatGeom.indices,
            gl.STATIC_DRAW,
          );
        } else {
          gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            flatGeom.indices,
            gl.STATIC_DRAW,
          );
        }
        if (typeof buildHitboxes === "function") {
          buildHitboxes();
        }
        Math.random = _origRandom;
      }

      
      

      function updateFireParticles(time) {
        let allVertices = [];
        let allColors = [];
        let allIndices = [];

        let hasFire = false;
        
        for (let item of collectibles) {
          if (item.active && item.type === "campfire" && !item.isPreview) {
            if (typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && typeof frustumPlanes !== 'undefined' && frustumPlanes && typeof isSphereInFrustum === 'function') {
              if (!isSphereInFrustum(frustumPlanes, item.position, 1.0)) {
                continue;
              }
            }
            hasFire = true;
            const p = item.position;
            const r = item.R, f = item.F, n = item.normal;
            const s = item.size || 1.0;
            const seedVal = item.seed || 123.4;
            
            // Generate multiple fire particles based on time and seed
            for (let i = 0; i < 5; i++) {
               const pTime = time + i * 2.13 + seedVal;
               const life = pTime % 1.0; // 0 to 1
               
               // Rise up
               const h = 0.04 + life * 0.15;
               const offsetR = Math.sin(pTime * 5.0) * 0.05 * (1.0 - life);
               const offsetF = Math.cos(pTime * 4.3) * 0.05 * (1.0 - life);
               
               const firePos = [
                 p[0] + n[0] * h * s + r[0] * offsetR * s + f[0] * offsetF * s,
                 p[1] + n[1] * h * s + r[1] * offsetR * s + f[1] * offsetF * s,
                 p[2] + n[2] * h * s + r[2] * offsetR * s + f[2] * offsetF * s
               ];
               
               const fireSize = (0.05 * (1.0 - life) + 0.02) * s;
               
               // Color goes from yellow/white -> orange -> red -> grey
               let fireCol;
               if (life < 0.2) {
                 fireCol = [1.0, 0.9, 0.2];
               } else if (life < 0.6) {
                 const t = (life - 0.2) / 0.4;
                 fireCol = [1.0, 0.9 - t*0.5, 0.2 - t*0.2];
               } else {
                 const t = (life - 0.6) / 0.4;
                 fireCol = [1.0 - t*0.3, 0.4 - t*0.4, 0.0];
               }
               
               addBox(firePos, fireSize, fireSize, fireSize, fireCol, r, n, f, allVertices, allColors, allIndices);
            }
          }
        }
        
        if (!hasFire) {
          fireIndicesLength = 0;
          return;
        }

        if (allIndices.length > 0) {
          const flatGeom = makeFlatShadedGeometry(
            allVertices,
            allColors,
            allIndices,
            true
          );
          fireIndicesLength = flatGeom.indices.length;

          if (!fireVertexBuffer) fireVertexBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
          const vCount = new Float32Array(flatGeom.vertices).length;
          const vertTyped = getReusableFloat32Array(1, vCount).subarray(0, vCount);
          vertTyped.set(new Float32Array(flatGeom.vertices));
          gl.bufferData(
            gl.ARRAY_BUFFER,
            vertTyped,
            gl.DYNAMIC_DRAW,
          );

          if (!fireColorBuffer) fireColorBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, fireColorBuffer);
          const cCount = new Float32Array(flatGeom.colors).length;
          const colTyped = getReusableFloat32Array(2, cCount).subarray(0, cCount);
          colTyped.set(new Float32Array(flatGeom.colors));
          gl.bufferData(
            gl.ARRAY_BUFFER,
            colTyped,
            gl.DYNAMIC_DRAW,
          );

          if (!fireNormalBuffer) fireNormalBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, fireNormalBuffer);
          const nCount = new Float32Array(flatGeom.normals).length;
          const normTyped = getReusableFloat32Array(3, nCount).subarray(0, nCount);
          normTyped.set(new Float32Array(flatGeom.normals));
          gl.bufferData(
            gl.ARRAY_BUFFER,
            normTyped,
            gl.DYNAMIC_DRAW,
          );

          if (!fireIndexBuffer) fireIndexBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);
          const iCount = flatGeom.indices.length;
          if (supportUint32 && iCount > 65535) {
            const indTyped = getReusableUint32Array(iCount).subarray(0, iCount);
            indTyped.set(flatGeom.indices);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              indTyped,
              gl.DYNAMIC_DRAW,
            );
          } else {
            const indTyped = getReusableUint16Array(iCount).subarray(0, iCount);
            indTyped.set(flatGeom.indices);
            gl.bufferData(
              gl.ELEMENT_ARRAY_BUFFER,
              indTyped,
              gl.DYNAMIC_DRAW,
            );
            }
          } else {
            fireIndicesLength = 0;
        }
      }

      // ============================================
      // สร้างทรงกลมน้ำ
      // ============================================

      // ============================================
      // สร้างทรงกลมท้องฟ้า (Cosmic Deep Space Skybox)
      // ============================================
      function buildSkySphere(gridSize) {
        const maxSkySize = 40;
        const latSeg = maxSkySize;
        const longSeg = maxSkySize;

        const vertexCount = (latSeg + 1) * (longSeg + 1);
        const vertices = new Float32Array(vertexCount * 3);
        const indexCount = latSeg * longSeg * 6;
        const isUint32 = supportUint32 && indexCount > 65535;
        const indices = isUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

        // ทรงกลมท้องฟ้าอวกาศมาตรฐาน (Normalized Unit Sphere สำหรับ Infinite Projection)
        const skyRadius = 1.0;

        const sinPhiTable = new Float64Array(longSeg + 1);
        const cosPhiTable = new Float64Array(longSeg + 1);
        for (let long = 0; long <= longSeg; long++) {
          const phi = (long / longSeg) * Math.PI * 2;
          sinPhiTable[long] = Math.sin(phi);
          cosPhiTable[long] = Math.cos(phi);
        }

        let vIdx = 0;
        for (let lat = 0; lat <= latSeg; lat++) {
          const theta = (lat / latSeg) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          const rSin = skyRadius * sinTheta;
          const rCos = skyRadius * cosTheta;

          for (let long = 0; long <= longSeg; long++) {
            vertices[vIdx++] = rSin * cosPhiTable[long];
            vertices[vIdx++] = rCos;
            vertices[vIdx++] = rSin * sinPhiTable[long];
          }
        }

        let iIdx = 0;
        for (let lat = 0; lat < latSeg; lat++) {
          for (let long = 0; long < longSeg; long++) {
            const a = lat * (longSeg + 1) + long;
            const b = a + longSeg + 1;
            const c = a + 1;
            const d = b + 1;
            indices[iIdx++] = a;
            indices[iIdx++] = c;
            indices[iIdx++] = b;
            indices[iIdx++] = c;
            indices[iIdx++] = d;
            indices[iIdx++] = b;
          }
        }

        skyIndicesLength = indices.length;

        if (skyVertexBuffer) gl.deleteBuffer(skyVertexBuffer);
        if (skyIndexBuffer) gl.deleteBuffer(skyIndexBuffer);

        skyVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, skyVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          vertices,
          gl.STATIC_DRAW,
        );

        skyIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          indices,
          gl.STATIC_DRAW,
        );
      }

      // ============================================
      // สร้างทรงกลมชั้นบรรยากาศ
      // ============================================
      let _lastAtmSize = -1;
      let _lastAtmRadius = -1;

      function buildAtmosphereSphere(gridSize) {
        const maxAtmSize = Math.min(gridSize || 60, 60);
        const latSeg = maxAtmSize;
        const longSeg = maxAtmSize;

        const atmScale = typeof atmosphereScale !== "undefined" ? atmosphereScale : 1.05;
        const atmRadius = RADIUS + Math.max(RADIUS * (atmScale - 1.0), (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE * 2.0 : 1.2) + 2.0);

        if (maxAtmSize === _lastAtmSize && atmRadius === _lastAtmRadius && atmosphereVertexBuffer) {
          return;
        }
        _lastAtmSize = maxAtmSize;
        _lastAtmRadius = atmRadius;

        const vertexCount = (latSeg + 1) * (longSeg + 1);
        const vertices = new Float32Array(vertexCount * 3);
        const indexCount = latSeg * longSeg * 6;
        const isUint32 = supportUint32 && indexCount > 65535;
        const indices = isUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

        const sinPhiTable = new Float64Array(longSeg + 1);
        const cosPhiTable = new Float64Array(longSeg + 1);
        for (let long = 0; long <= longSeg; long++) {
          const phi = (long / longSeg) * Math.PI * 2;
          sinPhiTable[long] = Math.sin(phi);
          cosPhiTable[long] = Math.cos(phi);
        }

        let vIdx = 0;
        for (let lat = 0; lat <= latSeg; lat++) {
          const theta = (lat / latSeg) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          const rSin = atmRadius * sinTheta;
          const rCos = atmRadius * cosTheta;

          for (let long = 0; long <= longSeg; long++) {
            vertices[vIdx++] = rSin * cosPhiTable[long];
            vertices[vIdx++] = rCos;
            vertices[vIdx++] = rSin * sinPhiTable[long];
          }
        }

        let iIdx = 0;
        for (let lat = 0; lat < latSeg; lat++) {
          for (let long = 0; long < longSeg; long++) {
            const a = lat * (longSeg + 1) + long;
            const b = a + longSeg + 1;
            const c = a + 1;
            const d = b + 1;
            indices[iIdx++] = a;
            indices[iIdx++] = b;
            indices[iIdx++] = c;
            indices[iIdx++] = c;
            indices[iIdx++] = b;
            indices[iIdx++] = d;
          }
        }

        atmosphereIndicesLength = indices.length;

        if (atmosphereVertexBuffer) gl.deleteBuffer(atmosphereVertexBuffer);
        if (atmosphereIndexBuffer) gl.deleteBuffer(atmosphereIndexBuffer);

        atmosphereVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, atmosphereVertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          vertices,
          gl.STATIC_DRAW,
        );

        atmosphereIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, atmosphereIndexBuffer);
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          indices,
          gl.STATIC_DRAW,
        );
      }

      // ============================================
      // God Rays Buffer (Safely disabled / no-op)
      // ============================================
      function buildGodRaysBuffer() {
        // Disabled
      }


      // ============================================
      // อัปเดต vertex น้ำ
      // ============================================
      let waterMask = null;
      let waterMaskTex = null;
      let waterTerrainHeights = null;
      let lastTerrainModCount = -1;
      




// --- Nature & Environment Management Exports ---
function clearActiveNature() {
    if (typeof natureObstacles !== "undefined" && Array.isArray(natureObstacles)) natureObstacles.length = 0;
    if (typeof cubeObstacles !== "undefined" && Array.isArray(cubeObstacles)) cubeObstacles.length = 0;
    if (typeof choppedTrees !== "undefined" && Array.isArray(choppedTrees)) choppedTrees.length = 0;
    if (typeof destroyedRocks !== "undefined" && Array.isArray(destroyedRocks)) destroyedRocks.length = 0;
    if (typeof natureRawVertices !== "undefined") natureRawVertices = [];
    if (typeof natureIndexLength !== "undefined") natureIndexLength = 0;
}
function clearActiveAtmosphere() {
    if (typeof atmosphereIndicesLength !== "undefined") atmosphereIndicesLength = 0;
}
function clearActiveCaves() {
    if (typeof tunnels3D !== "undefined" && Array.isArray(tunnels3D)) tunnels3D.length = 0;
    if (typeof tunnels3DGrid !== "undefined" && tunnels3DGrid && typeof tunnels3DGrid.clear === "function") tunnels3DGrid.clear();
}

window.clearActiveNature = clearActiveNature;
window.clearActiveAtmosphere = clearActiveAtmosphere;
window.clearActiveCaves = clearActiveCaves;
window.buildAtmosphereSphere = buildAtmosphereSphere;
window.buildNature = buildNature;
window.rebuildNature = async function() {
    if (typeof buildNature === "function") {
        await buildNature(typeof natureCount !== "undefined" ? natureCount : 1500, typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345);
    }
};
