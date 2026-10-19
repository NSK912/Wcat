// === SEEDPLANET MODULE: JS/COLLISION.JS ===

const COLLISION_LAYERS = {
  DEFAULT: 1,
  PLAYER: 2,
  CAMERA: 4,
  TREE: 8,
  ROCK: 16,
  WOOD_WALL: 32,
  WOOD_FLOOR: 64,
  STONE_FLOOR: 128
};


const CollisionCore = {
  layers: COLLISION_LAYERS,
  
  // Helpers
  closestPointOnTriangle: function(p, a, b, c) {
    const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const ap = [p[0]-a[0], p[1]-a[1], p[2]-a[2]];

    const d1 = ab[0]*ap[0] + ab[1]*ap[1] + ab[2]*ap[2];
    const d2 = ac[0]*ap[0] + ac[1]*ap[1] + ac[2]*ap[2];
    if (d1 <= 0.0 && d2 <= 0.0) return a;

    const bp = [p[0]-b[0], p[1]-b[1], p[2]-b[2]];
    const d3 = ab[0]*bp[0] + ab[1]*bp[1] + ab[2]*bp[2];
    const d4 = ac[0]*bp[0] + ac[1]*bp[1] + ac[2]*bp[2];
    if (d3 >= 0.0 && d4 <= d3) return b;

    const vc = d1*d4 - d3*d2;
    if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
        const v = d1 / (d1 - d3);
        return [a[0] + v*ab[0], a[1] + v*ab[1], a[2] + v*ab[2]];
    }

    const cp = [p[0]-c[0], p[1]-c[1], p[2]-c[2]];
    const d5 = ab[0]*cp[0] + ab[1]*cp[1] + ab[2]*cp[2];
    const d6 = ac[0]*cp[0] + ac[1]*cp[1] + ac[2]*cp[2];
    if (d6 >= 0.0 && d5 <= d6) return c;

    const vb = d5*d2 - d1*d6;
    if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
        const w = d2 / (d2 - d6);
        return [a[0] + w*ac[0], a[1] + w*ac[1], a[2] + w*ac[2]];
    }

    const va = d3*d6 - d5*d4;
    if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0) {
        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return [b[0] + w*(c[0]-b[0]), b[1] + w*(c[1]-b[1]), b[2] + w*(c[2]-b[2])];
    }

    const denom = 1.0 / (va + vb + vc);
    const v = vb * denom;
    const w = vc * denom;
    return [a[0] + ab[0]*v + ac[0]*w, a[1] + ab[1]*v + ac[1]*w, a[2] + ab[2]*v + ac[2]*w];
  },

  // Layered / Structured Collision Check Functions
  
  // Layer: Camera
  checkCameraCollision: function(p, playerHeadPos, waterRadius, prefiltered = null, customCushion = null) {
    const distToCenter = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
    if (distToCenter < 0.001) return true;

    // 1. Terrain surface height
    const ux = p[0] / distToCenter;
    const uy = p[1] / distToCenter;
    const uz = p[2] / distToCenter;
    const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
    const phi = Math.atan2(uz, ux);
    
    // 1. Terrain surface height & Mesh-Equivalent Cave Collision
    const r_planet = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
    const h_scale = typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 0.6;
    const seed = typeof globalSeed !== "undefined" ? globalSeed : 0;
    const charScale = typeof playerScale !== "undefined" ? playerScale : 0.22;
    
    // Get raw terrain height
    const h = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, seed) : 0;
    const baseTerrainRadius = r_planet + h * h_scale;

    const tunnels = tunnels3D || [];
    const heightmapBumper = 0.35 * (charScale / 0.22);
    const cameraCushion = 0.16 * charScale;
    
    // Dynamically adjust camera cushion to perfectly match screen aspect ratio and prevent near-plane clipping
    const minCushion = window.dynamicCameraCushion || Math.max(0.06, cameraCushion);
    const actualCamCushion = customCushion !== null ? customCushion : Math.max(minCushion, cameraCushion);
    const actualHeightmapBumper = customCushion !== null ? customCushion : Math.max(heightmapBumper, actualCamCushion);
    
    let isColliding = false;
    let collisionPart = "None";
    let densityValue = undefined;
    let camCaveData = null;
    let details = "";

    // 0. Visual Mesh Precision Check (Prevent Mountain Clipping)
    const visualH = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere(theta, phi, seed) : h;
    let visualTerrainRadius = r_planet + visualH * h_scale;
    if (typeof getFloorTopRadiusAt === "function") {
        visualTerrainRadius = getFloorTopRadiusAt(ux, uy, uz, visualTerrainRadius);
    }
    
    let inCaveForCam = false;
    if (tunnels && tunnels.length > 0) {
        for (let i = 0; i < tunnels.length; i++) {
            const dx = p[0] - tunnels[i].x, dy = p[1] - tunnels[i].y, dz = p[2] - tunnels[i].z;
            if (dx*dx + dy*dy + dz*dz < (tunnels[i].rSq || tunnels[i].r * tunnels[i].r)) {
                inCaveForCam = true;
                break;
            }
        }
    }

    if (!inCaveForCam && distToCenter < visualTerrainRadius + actualCamCushion) {
        isColliding = true;
        collisionPart = "Visual Mountain Mesh";
        details = `Camera distance ${distToCenter.toFixed(3)} < visual mesh radius ${visualTerrainRadius.toFixed(3)} + cushion ${actualCamCushion.toFixed(3)}`;
    }

    if (!isColliding) {
        // 1. Voxel 3D Cave (getTerrainDensity) Check
        if (typeof getTerrainDensity === "function") {
           densityValue = getTerrainDensity(p[0], p[1], p[2], false);
           if (densityValue > -actualCamCushion) {
               isColliding = true;
               collisionPart = "Voxel 3D Cave (Density)";
               details = `Camera density ${densityValue.toFixed(4)} > threshold ${(-actualCamCushion).toFixed(4)}`;
           }
        } else if (typeof getTerrainSurfaceAndCeiling === "function") {
           // 2. Heightmap Cave (getTerrainSurfaceAndCeiling) Check
           camCaveData = getTerrainSurfaceAndCeiling(ux, uy, uz, distToCenter);
           if (camCaveData && camCaveData.insideTunnel) {
               if (distToCenter < camCaveData.ground + actualCamCushion) {
                   isColliding = true;
                   collisionPart = "Heightmap Cave (Ground Bounds)";
                   details = `Camera distance ${distToCenter.toFixed(3)} < ground ${camCaveData.ground.toFixed(3)} + cushion ${actualCamCushion.toFixed(3)}`;
               } else if (camCaveData.ceiling !== Infinity && distToCenter > camCaveData.ceiling - actualCamCushion) {
                   isColliding = true;
                   collisionPart = "Heightmap Cave (Ceiling Bounds)";
                   details = `Camera distance ${distToCenter.toFixed(3)} > ceiling ${camCaveData.ceiling.toFixed(3)} - cushion ${actualCamCushion.toFixed(3)}`;
               }
           } else if (camCaveData) {
               if (distToCenter < camCaveData.ground + actualHeightmapBumper) {
                   isColliding = true;
                   collisionPart = "Heightmap Planet Surface";
                   details = `Camera distance ${distToCenter.toFixed(3)} < ground ${camCaveData.ground.toFixed(3)} + bumper ${actualHeightmapBumper.toFixed(3)}`;
               }
           }
        } else {
           // 3. Fallback Planet Sphere Check (when neither voxel nor heightmap APIs exist/fire)
           if (distToCenter < baseTerrainRadius + actualHeightmapBumper) {
               isColliding = true;
               collisionPart = "Fallback Planet Sphere";
               details = `Camera distance ${distToCenter.toFixed(3)} < base radius ${baseTerrainRadius.toFixed(3)} + bumper ${actualHeightmapBumper.toFixed(3)}`;
           }
        }
    }

    // --- CAVE DETECTION FOR PLAYER ---
    let playerIn3DTunnel = false;
    let playerInHeightmapTunnel = false;
    let closestTunnelToPlayer = null;
    let minPlayerTunnelDist = Infinity;

    if (playerHeadPos) {
      if (typeof tunnels3D !== "undefined" && tunnels3D && tunnels3D.length > 0) {
        for (let i = 0; i < tunnels3D.length; i++) {
          const t = tunnels3D[i];
          const dx = playerHeadPos[0] - t.x;
          const dy = playerHeadPos[1] - t.y;
          const dz = playerHeadPos[2] - t.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
          if (dist < minPlayerTunnelDist) {
            minPlayerTunnelDist = dist;
            closestTunnelToPlayer = t;
          }
        }
        if (closestTunnelToPlayer && minPlayerTunnelDist < closestTunnelToPlayer.r * 1.5) {
          playerIn3DTunnel = true;
        }
      }

      if (typeof getTerrainSurfaceAndCeiling === "function") {
        const pDist = Math.sqrt(playerHeadPos[0]*playerHeadPos[0] + playerHeadPos[1]*playerHeadPos[1] + playerHeadPos[2]*playerHeadPos[2]);
        if (pDist > 0.001) {
          const playerCaveData = getTerrainSurfaceAndCeiling(playerHeadPos[0]/pDist, playerHeadPos[1]/pDist, playerHeadPos[2]/pDist, pDist);
          if (playerCaveData && playerCaveData.insideTunnel) {
            playerInHeightmapTunnel = true;
          }
        }
      }
    }

    if (isColliding) return true;

    // 2. Water surface collision (Removed by request)

    // 3. Obstacle & Objects collision
    const checkObstacleCollisions = (obstacles, extraCushion, mask) => {
      
      const maxDistSq = maxColliderDistance * maxColliderDistance;
      
      for (let obs of obstacles) {
        if (mask !== undefined && obs.layer !== undefined && !(mask & obs.layer)) continue;
        if (!obs.position) continue;
        
        const dx = p[0] - obs.position[0];
        const dy = p[1] - obs.position[1];
        const dz = p[2] - obs.position[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > maxDistSq) continue;

        if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
          const checkDist = obs.radius + extraCushion;
          if (distSq > checkDist * checkDist) continue;
          
          const collisionEnd = obs.collisionMeshEnd !== undefined ? obs.collisionMeshEnd : obs.meshEnd;
          const count = collisionEnd - obs.meshStart;
          let hit = false;

          for (let j = 0; j < count; j += 3) {
            const vIdx = obs.meshStart + j;
            if (!natureRawVertices || (vIdx+2)*3+2 >= natureRawVertices.length) continue;
            const a = [natureRawVertices[vIdx*3], natureRawVertices[vIdx*3+1], natureRawVertices[vIdx*3+2]];
            const b = [natureRawVertices[(vIdx+1)*3], natureRawVertices[(vIdx+1)*3+1], natureRawVertices[(vIdx+1)*3+2]];
            const c = [natureRawVertices[(vIdx+2)*3], natureRawVertices[(vIdx+2)*3+1], natureRawVertices[(vIdx+2)*3+2]];
            const closest = CollisionCore.closestPointOnTriangle(p, a, b, c);
            const ctx = p[0] - closest[0];
            const cty = p[1] - closest[1];
            const ctz = p[2] - closest[2];
            if (ctx*ctx + cty*cty + ctz*ctz < extraCushion * extraCushion) {
                hit = true;
                break;
            }
          }
          if (hit) return true;
        } else if (obs.colliders && obs.colliders.length > 0) {
          for (let col of obs.colliders) {
            const cx = obs.position[0] + (col.offset[0] || 0);
            const cy = obs.position[1] + (col.offset[1] || 0);
            const cz = obs.position[2] + (col.offset[2] || 0);
            const cdx = p[0] - cx;
            const cdy = p[1] - cy;
            const cdz = p[2] - cz;
            const cdistSq = cdx * cdx + cdy * cdy + cdz * cdz;
            const colRad = col.radius + extraCushion;
            if (cdistSq < colRad * colRad) return true;
          }
        } else {
          const collisionRadius = obs.radius + extraCushion;
          if (distSq < collisionRadius * collisionRadius) {
            return true;
          }
        }
      }
      return false;
    };

    const excludeLayers = COLLISION_LAYERS.TREE | COLLISION_LAYERS.ROCK;

    if (prefiltered) {
      if (checkObstacleCollisions(prefiltered.nature, 0.12, ~excludeLayers)) return true;
      if (checkObstacleCollisions(prefiltered.cubes, 0.12, ~excludeLayers)) return true;
      if (checkObstacleCollisions(prefiltered.amphibians, 0.12, ~excludeLayers)) return true;
    } else {
      if (checkObstacleCollisions(natureObstacles, 0.12, ~excludeLayers)) return true;
      if (checkObstacleCollisions(cubeObstacles, 0.12, ~excludeLayers)) return true;
      if (checkObstacleCollisions(amphibians, 0.12, ~excludeLayers)) return true;
    }

    // 4. Custom Player-Built Structure Collisions (Wood wall, Wood window, Wood door, Floors, Stairs)
    const itemsToCheck = prefiltered ? prefiltered.collectibles : (collectibles || []);
    

    for (let other of itemsToCheck) {
      if (other.active && !other.isPreview) {
        if (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") {
          const wallCenterRadius = Math.sqrt(
            other.position[0] * other.position[0] +
            other.position[1] * other.position[1] +
            other.position[2] * other.position[2]
          );
          
          const wallHeight = 0.25;
          const camRadius = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
          const cushionHeight = 0.05;
          
          if (camRadius > wallCenterRadius - cushionHeight && camRadius < wallCenterRadius + wallHeight + cushionHeight) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            const wallR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const wallF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            const wallN = other.normal || [0, 1, 0];
            
            const dx_vec = [
              p[0] - other.position[0],
              p[1] - other.position[1],
              p[2] - other.position[2]
            ];
            
            const dx = dx_vec[0] * wallR[0] + dx_vec[1] * wallR[1] + dx_vec[2] * wallR[2];
            const dz = dx_vec[0] * wallF[0] + dx_vec[1] * wallF[1] + dx_vec[2] * wallF[2];
            const dy = dx_vec[0] * wallN[0] + dx_vec[1] * wallN[1] + dx_vec[2] * wallN[2];
            
            const halfD = 0.025; // half wall thickness

            let hasCoLocatedDoor = (other.type === "wood_door");
            let hasCoLocatedWindow = (other.type === "wood_window");
            if (other.type === "wood_wall") {
              for (let d of itemsToCheck) {
                if (d.active && (d.type === "wood_door" || d.type === "wood_window")) {
                  const ox = d.position[0] - other.position[0];
                  const oy = d.position[1] - other.position[1];
                  const oz = d.position[2] - other.position[2];
                  if (ox*ox + oy*oy + oz*oz < 0.005) {
                    if (d.type === "wood_door") hasCoLocatedDoor = true;
                    if (d.type === "wood_window") hasCoLocatedWindow = true;
                  }
                }
              }
            }

            // Door opening is in center (|dx| < 0.065) - camera passes freely through doorway
            if (hasCoLocatedDoor && Math.abs(dx) < 0.065) {
              continue;
            }

            let segments = [];
            if (hasCoLocatedDoor) {
              segments.push({ cx: -0.12, hw: 0.03 });
              segments.push({ cx: 0.12, hw: 0.03 });
            } else if (hasCoLocatedWindow) {
              if (dy >= 0.075 && dy < 0.185) {
                segments.push({ cx: -0.1175, hw: 0.0325 });
                segments.push({ cx: 0.1175, hw: 0.0325 });
              } else {
                segments.push({ cx: 0.0, hw: 0.15 });
              }
            } else {
              segments.push({ cx: 0.0, hw: 0.15 });
            }

            let inCollision = false;
            for (let seg of segments) {
              const ldx = dx - seg.cx;
              const cushionR = seg.hw + 0.1;
              const cushionF = halfD + 0.1;
              const cushionUp = 0.10;

              if (Math.abs(ldx) < cushionR && Math.abs(dz) < cushionF && dy >= -cushionUp && dy <= wallHeight + cushionUp) {
                inCollision = true;
                break;
              }
            }

            if (inCollision) {
              return true;
            }
          }
        } else if (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item") {
          const dx_vec = [
            p[0] - other.position[0],
            p[1] - other.position[1],
            p[2] - other.position[2]
          ];
          
          const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
          const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
          const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];
          
          const isStone = other.type === "stone_floor";
          const isObsidianPad = other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item";
          const floorW = typeof other.width === "number" ? other.width : (isStone ? other.size * 12.0 : 0.3);
          const floorD = typeof other.depth === "number" ? other.depth : (isStone ? other.size * 12.0 : 0.3);
          const hw = floorW / 2;
          const hd = floorD / 2;
          const h = isObsidianPad ? 0.033 : (isStone ? other.size * 0.15 : (other.type === "wood_floor" ? woodFloorHeight + 0.25 * 0.12 : 0.25 * 0.04));
          
          const cushionW = hw + 0.1;
          const cushionD = hd + 0.1;
          const cushionUp = 0.1;
          
          if (Math.abs(dx) < cushionW && Math.abs(dz) < cushionD && dy >= -h/2 - cushionUp && dy <= h/2 + cushionUp) {
            return true;
          }
        } else if (other.type === "wood_roof") {
          const angle = other.angle || 0.0;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const roofR = [
            other.R[0] * cosA + other.F[0] * sinA,
            other.R[1] * cosA + other.F[1] * sinA,
            other.R[2] * cosA + other.F[2] * sinA
          ];
          const roofF = [
            other.F[0] * cosA - other.R[0] * sinA,
            other.F[1] * cosA - other.R[1] * sinA,
            other.F[2] * cosA - other.R[2] * sinA
          ];
          const roofN = other.normal || [0, 1, 0];
          const dx_vec = [
            p[0] - other.position[0],
            p[1] - other.position[1],
            p[2] - other.position[2]
          ];
          const lx = dx_vec[0] * roofR[0] + dx_vec[1] * roofR[1] + dx_vec[2] * roofR[2];
          const lz = dx_vec[0] * roofF[0] + dx_vec[1] * roofF[1] + dx_vec[2] * roofF[2];
          const ly = dx_vec[0] * roofN[0] + dx_vec[1] * roofN[1] + dx_vec[2] * roofN[2];
          const cushion = 0.08;
          if (Math.abs(lx) < 0.15 + cushion && lz > -0.15 - cushion && lz < 0.15 + cushion) {
            const clampedZ = Math.max(-0.15, Math.min(0.15, lz));
            const surfH = 0.125 + (clampedZ / 0.30) * 0.25;
            if (ly >= -cushion && ly <= surfH + 0.04 + cushion) {
              return true;
            }
          }
        } else if (other.type === "robot_stand") {
          const standCenterRadius = Math.sqrt(
            other.position[0] * other.position[0] +
            other.position[1] * other.position[1] +
            other.position[2] * other.position[2]
          );
          
          const standHeight = 0.70;
          const camRadius = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
          const cushionHeight = 0.05;
          
          if (camRadius > standCenterRadius - cushionHeight && camRadius < standCenterRadius + standHeight + cushionHeight) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            const standR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const standF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            
            const dx_vec = [
              p[0] - other.position[0],
              p[1] - other.position[1],
              p[2] - other.position[2]
            ];
            
            const dx = dx_vec[0] * standR[0] + dx_vec[1] * standR[1] + dx_vec[2] * standR[2];
            const dz = dx_vec[0] * standF[0] + dx_vec[1] * standF[1] + dx_vec[2] * standF[2] - (-0.10);
            
            const hw = 0.12;
            const hd = 0.12;
            
            if (Math.abs(dx) < hw + 0.1 && Math.abs(dz) < hd + 0.1) {
              return true;
            }
          }
        }
      }
    }

    return false;
  },

  resolveCameraCollision: function(p, playerHeadPos, waterRadius, prefiltered = null) {
    let currentP = [p[0], p[1], p[2]];
    const maxIterations = 3;
    const charScale = typeof playerScale !== "undefined" ? playerScale : 0.22;
    const cameraCushion = 0.16 * charScale;
    const minCushion = window.dynamicCameraCushion || Math.max(0.06, cameraCushion);
    const actualCamCushion = Math.max(minCushion, cameraCushion);
    const heightmapBumper = 0.35 * (charScale / 0.22);
    const actualHeightmapBumper = Math.max(heightmapBumper, actualCamCushion);
    const woodFloorHeight = typeof typeofWoodFloorHeight !== "undefined" ? typeofWoodFloorHeight : 0.04;

    for (let iter = 0; iter < maxIterations; iter++) {
      let moved = false;
      const distToCenter = Math.sqrt(currentP[0] * currentP[0] + currentP[1] * currentP[1] + currentP[2] * currentP[2]);
      if (distToCenter < 0.001) break;

      const ux = currentP[0] / distToCenter;
      const uy = currentP[1] / distToCenter;
      const uz = currentP[2] / distToCenter;

      // 1. Voxel 3D Cave Check (getTerrainDensity)
      if (typeof getTerrainDensity === "function") {
        const densityValue = getTerrainDensity(currentP[0], currentP[1], currentP[2], false);
        if (densityValue > -actualCamCushion) {
          // Calculate safe interior direction pointing AWAY from the solid rock wall using a continuous finite-difference gradient.
          // This eliminates the discrete Voronoi jumping of pointing directly to the closest tunnel center segment, 
          // providing perfectly smooth, jitter-free camera sliding along cave ceilings and walls.
          let normal = null;
          const eps = 0.04; // Small delta step for gradient calculation
          
          const d_px = getTerrainDensity(currentP[0] + eps, currentP[1], currentP[2], false);
          const d_mx = getTerrainDensity(currentP[0] - eps, currentP[1], currentP[2], false);
          const d_py = getTerrainDensity(currentP[0], currentP[1] + eps, currentP[2], false);
          const d_my = getTerrainDensity(currentP[0], currentP[1] - eps, currentP[2], false);
          const d_pz = getTerrainDensity(currentP[0], currentP[1], currentP[2] + eps, false);
          const d_mz = getTerrainDensity(currentP[0], currentP[1], currentP[2] - eps, false);
          
          const gradX = d_px - d_mx;
          const gradY = d_py - d_my;
          const gradZ = d_pz - d_mz;
          
          const gradLenSq = gradX * gradX + gradY * gradY + gradZ * gradZ;
          if (gradLenSq > 0.000001) {
            const gradLen = Math.sqrt(gradLenSq);
            // Normal points opposite to the density gradient (towards negative density / air interior)
            normal = [-gradX / gradLen, -gradY / gradLen, -gradZ / gradLen];
          }

          // Fallback to player's head direction if gradient is too small or flat
          if (!normal && playerHeadPos) {
            const dx = playerHeadPos[0] - currentP[0];
            const dy = playerHeadPos[1] - currentP[1];
            const dz = playerHeadPos[2] - currentP[2];
            const dDist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.001;
            normal = [dx / dDist, dy / dDist, dz / dDist];
          }

          // Ultimate fallback: pointing outwards/upwards from planet center
          if (!normal) {
            normal = [ux, uy, uz];
          }

          const len = Math.sqrt(normal[0]*normal[0] + normal[1]*normal[1] + normal[2]*normal[2]);
          if (len > 0.0001) {
            normal[0] /= len;
            normal[1] /= len;
            normal[2] /= len;

            const penetration = densityValue - (-actualCamCushion);
            // Cap maximum single-frame push to prevent wild camera teleportation/jitter
            const cappedPenetration = Math.min(2.5 * charScale, penetration);
            currentP[0] += normal[0] * (cappedPenetration + 0.015);
            currentP[1] += normal[1] * (cappedPenetration + 0.015);
            currentP[2] += normal[2] * (cappedPenetration + 0.015);
            moved = true;
          }
        }
      } 
      // 2. Heightmap Cave Check
      else if (typeof getTerrainSurfaceAndCeiling === "function") {
        const camCaveData = getTerrainSurfaceAndCeiling(ux, uy, uz, distToCenter);
        if (camCaveData && camCaveData.insideTunnel) {
          if (distToCenter < camCaveData.ground + actualCamCushion) {
            const penetration = (camCaveData.ground + actualCamCushion) - distToCenter;
            currentP[0] += ux * (penetration + 0.015);
            currentP[1] += uy * (penetration + 0.015);
            currentP[2] += uz * (penetration + 0.015);
            moved = true;
          } else if (camCaveData.ceiling !== Infinity && distToCenter > camCaveData.ceiling - actualCamCushion) {
            const penetration = distToCenter - (camCaveData.ceiling - actualCamCushion);
            currentP[0] -= ux * (penetration + 0.015);
            currentP[1] -= uy * (penetration + 0.015);
            currentP[2] -= uz * (penetration + 0.015);
            moved = true;
          }
        } else if (camCaveData) {
          if (distToCenter < camCaveData.ground + actualHeightmapBumper) {
            const penetration = (camCaveData.ground + actualHeightmapBumper) - distToCenter;
            currentP[0] += ux * (penetration + 0.015);
            currentP[1] += uy * (penetration + 0.015);
            currentP[2] += uz * (penetration + 0.015);
            moved = true;
          }
        }
      } 
      // 3. Fallback Planet Sphere Check
      else {
        const r_planet = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
        const h_scale = typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 0.6;
        const seed = typeof globalSeed !== "undefined" ? globalSeed : 0;
        const h = typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, uy))), Math.atan2(uz, ux), seed) : 0;
        const baseTerrainRadius = r_planet + h * h_scale;

        if (distToCenter < baseTerrainRadius + actualHeightmapBumper) {
          const penetration = (baseTerrainRadius + actualHeightmapBumper) - distToCenter;
          currentP[0] += ux * (penetration + 0.015);
          currentP[1] += uy * (penetration + 0.015);
          currentP[2] += uz * (penetration + 0.015);
          moved = true;
        }
      }

      // 4. Obstacle collisions
      const resolveObstacleCollisions = (obstacles, extraCushion, mask) => {
        let obsMoved = false;
        const maxDistLimit = typeof maxColliderDistance !== "undefined" ? maxColliderDistance : 20.0;
        const maxDistSq = maxDistLimit * maxDistLimit;
        for (let obs of obstacles) {
          if (mask !== undefined && obs.layer !== undefined && !(mask & obs.layer)) continue;
          if (!obs.position) continue;
          
          const dx = currentP[0] - obs.position[0];
          const dy = currentP[1] - obs.position[1];
          const dz = currentP[2] - obs.position[2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq > maxDistSq) continue;

          if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
            const checkDist = obs.radius + extraCushion;
            if (distSq > checkDist * checkDist) continue;
            
            const collisionEnd = obs.collisionMeshEnd !== undefined ? obs.collisionMeshEnd : obs.meshEnd;
            const count = collisionEnd - obs.meshStart;

            for (let j = 0; j < count; j += 3) {
              const vIdx = obs.meshStart + j;
              if (!natureRawVertices || (vIdx+2)*3+2 >= natureRawVertices.length) continue;
              const a = [natureRawVertices[vIdx*3], natureRawVertices[vIdx*3+1], natureRawVertices[vIdx*3+2]];
              const b = [natureRawVertices[(vIdx+1)*3], natureRawVertices[(vIdx+1)*3+1], natureRawVertices[(vIdx+1)*3+2]];
              const c = [natureRawVertices[(vIdx+2)*3], natureRawVertices[(vIdx+2)*3+1], natureRawVertices[(vIdx+2)*3+2]];
              const closest = CollisionCore.closestPointOnTriangle(currentP, a, b, c);
              const ctx = currentP[0] - closest[0];
              const cty = currentP[1] - closest[1];
              const ctz = currentP[2] - closest[2];
              const d2 = ctx*ctx + cty*cty + ctz*ctz;
              if (d2 < extraCushion * extraCushion) {
                const d = Math.sqrt(d2) || 0.001;
                const normal = [ctx / d, cty / d, ctz / d];
                const penetration = extraCushion - d;
                currentP[0] += normal[0] * (penetration + 0.015);
                currentP[1] += normal[1] * (penetration + 0.015);
                currentP[2] += normal[2] * (penetration + 0.015);
                obsMoved = true;
              }
            }
          } else if (obs.colliders && obs.colliders.length > 0) {
            for (let col of obs.colliders) {
              const cx = obs.position[0] + (col.offset[0] || 0);
              const cy = obs.position[1] + (col.offset[1] || 0);
              const cz = obs.position[2] + (col.offset[2] || 0);
              const cdx = currentP[0] - cx;
              const cdy = currentP[1] - cy;
              const cdz = currentP[2] - cz;
              const cdistSq = cdx * cdx + cdy * cdy + cdz * cdz;
              const colRad = col.radius + extraCushion;
              if (cdistSq < colRad * colRad) {
                const d = Math.sqrt(cdistSq) || 0.001;
                const normal = [cdx / d, cdy / d, cdz / d];
                const penetration = colRad - d;
                currentP[0] += normal[0] * (penetration + 0.015);
                currentP[1] += normal[1] * (penetration + 0.015);
                currentP[2] += normal[2] * (penetration + 0.015);
                obsMoved = true;
              }
            }
          } else {
            const collisionRadius = obs.radius + extraCushion;
            if (distSq < collisionRadius * collisionRadius) {
              const d = Math.sqrt(distSq) || 0.001;
              const normal = [dx / d, dy / d, dz / d];
              const penetration = collisionRadius - d;
              currentP[0] += normal[0] * (penetration + 0.015);
              currentP[1] += normal[1] * (penetration + 0.015);
              currentP[2] += normal[2] * (penetration + 0.015);
              obsMoved = true;
            }
          }
        }
        return obsMoved;
      };

      const excludeLayers = COLLISION_LAYERS.TREE | COLLISION_LAYERS.ROCK;
      let obstacleMoved = false;
      if (prefiltered) {
        if (resolveObstacleCollisions(prefiltered.nature, 0.12, ~excludeLayers)) obstacleMoved = true;
        if (resolveObstacleCollisions(prefiltered.cubes, 0.12, ~excludeLayers)) obstacleMoved = true;
        if (resolveObstacleCollisions(prefiltered.amphibians, 0.12, ~excludeLayers)) obstacleMoved = true;
      } else {
        if (resolveObstacleCollisions(natureObstacles, 0.12, ~excludeLayers)) obstacleMoved = true;
        if (resolveObstacleCollisions(cubeObstacles, 0.12, ~excludeLayers)) obstacleMoved = true;
        if (resolveObstacleCollisions(amphibians, 0.12, ~excludeLayers)) obstacleMoved = true;
      }

      if (obstacleMoved) moved = true;

      // 5. Structure Collisions
      const itemsToCheck = prefiltered ? prefiltered.collectibles : (typeof collectibles !== "undefined" ? collectibles : []);
      let structureMoved = false;
      for (let other of itemsToCheck) {
        if (other.active && !other.isPreview) {
          if (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") {
            const wallCenterRadius = Math.sqrt(
              other.position[0] * other.position[0] +
              other.position[1] * other.position[1] +
              other.position[2] * other.position[2]
            );
            
            const wallHeight = 0.25;
            const camRadius = distToCenter;
            const cushionHeight = 0.05;
            
            if (camRadius > wallCenterRadius - cushionHeight && camRadius < wallCenterRadius + wallHeight + cushionHeight) {
              const angle = other.angle || 0.0;
              const cosA = Math.cos(angle);
              const sinA = Math.sin(angle);
              
              const wallR = [
                other.R[0] * cosA + other.F[0] * sinA,
                other.R[1] * cosA + other.F[1] * sinA,
                other.R[2] * cosA + other.F[2] * sinA
              ];
              const wallF = [
                other.F[0] * cosA - other.R[0] * sinA,
                other.F[1] * cosA - other.R[1] * sinA,
                other.F[2] * cosA - other.R[2] * sinA
              ];
              const wallN = other.normal || [0, 1, 0];
              
              const dx_vec = [
                currentP[0] - other.position[0],
                currentP[1] - other.position[1],
                currentP[2] - other.position[2]
              ];
              
              const dx = dx_vec[0] * wallR[0] + dx_vec[1] * wallR[1] + dx_vec[2] * wallR[2];
              const dz = dx_vec[0] * wallF[0] + dx_vec[1] * wallF[1] + dx_vec[2] * wallF[2];
              const dy = dx_vec[0] * wallN[0] + dx_vec[1] * wallN[1] + dx_vec[2] * wallN[2];
              
              const halfD = 0.025; // half wall thickness

              let hasCoLocatedDoor = (other.type === "wood_door");
              let hasCoLocatedWindow = (other.type === "wood_window");
              if (other.type === "wood_wall") {
                for (let d of itemsToCheck) {
                  if (d.active && (d.type === "wood_door" || d.type === "wood_window")) {
                    const ox = d.position[0] - other.position[0];
                    const oy = d.position[1] - other.position[1];
                    const oz = d.position[2] - other.position[2];
                    if (ox*ox + oy*oy + oz*oz < 0.005) {
                      if (d.type === "wood_door") hasCoLocatedDoor = true;
                      if (d.type === "wood_window") hasCoLocatedWindow = true;
                    }
                  }
                }
              }

              // Door opening is in center (|dx| < 0.065) - camera passes freely through doorway
              if (hasCoLocatedDoor && Math.abs(dx) < 0.065) {
                continue;
              }

              let segments = [];
              if (hasCoLocatedDoor) {
                segments.push({ cx: -0.12, hw: 0.03 });
                segments.push({ cx: 0.12, hw: 0.03 });
              } else if (hasCoLocatedWindow) {
                if (dy >= 0.075 && dy < 0.185) {
                  segments.push({ cx: -0.1175, hw: 0.0325 });
                  segments.push({ cx: 0.1175, hw: 0.0325 });
                } else {
                  segments.push({ cx: 0.0, hw: 0.15 });
                }
              } else {
                segments.push({ cx: 0.0, hw: 0.15 });
              }

              for (let seg of segments) {
                const ldx = dx - seg.cx;
                const cushionR = seg.hw + 0.1;
                const cushionF = halfD + 0.1;
                const cushionUp = 0.10;

                if (Math.abs(ldx) < cushionR && Math.abs(dz) < cushionF && dy >= -cushionUp && dy <= wallHeight + cushionUp) {
                  const pushDir = dz >= 0 ? 1 : -1;
                  const penetration = cushionF - Math.abs(dz);
                  currentP[0] += wallF[0] * pushDir * (penetration + 0.015);
                  currentP[1] += wallF[1] * pushDir * (penetration + 0.015);
                  currentP[2] += wallF[2] * pushDir * (penetration + 0.015);
                  structureMoved = true;
                  break;
                }
              }
            }
          } else if (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item") {
            const dx_vec = [
              currentP[0] - other.position[0],
              currentP[1] - other.position[1],
              currentP[2] - other.position[2]
            ];
            
            const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
            const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
            const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];
            
            const isStone = other.type === "stone_floor";
            const isObsidianPad = other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item";
            const floorW = typeof other.width === "number" ? other.width : (isStone ? other.size * 12.0 : 0.3);
            const floorD = typeof other.depth === "number" ? other.depth : (isStone ? other.size * 12.0 : 0.3);
            const hw = floorW / 2;
            const hd = floorD / 2;
            const h = isObsidianPad ? 0.033 : (isStone ? other.size * 0.15 : (other.type === "wood_floor" ? woodFloorHeight + 0.25 * 0.12 : 0.25 * 0.04));
            
            const cushionW = hw + 0.1;
            const cushionD = hd + 0.1;
            const cushionUp = 0.1;
            
            if (Math.abs(dx) < cushionW && Math.abs(dz) < cushionD && dy >= -h/2 - cushionUp && dy <= h/2 + cushionUp) {
              const pushDir = dy >= 0 ? 1 : -1;
              const penetration = (h/2 + cushionUp) - Math.abs(dy);
              currentP[0] += other.normal[0] * pushDir * (penetration + 0.015);
              currentP[1] += other.normal[1] * pushDir * (penetration + 0.015);
              currentP[2] += other.normal[2] * pushDir * (penetration + 0.015);
              structureMoved = true;
            }
          } else if (other.type === "wood_roof") {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const roofR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const roofF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            const roofN = other.normal || [0, 1, 0];
            const dx_vec = [
              currentP[0] - other.position[0],
              currentP[1] - other.position[1],
              currentP[2] - other.position[2]
            ];
            const lx = dx_vec[0] * roofR[0] + dx_vec[1] * roofR[1] + dx_vec[2] * roofR[2];
            const lz = dx_vec[0] * roofF[0] + dx_vec[1] * roofF[1] + dx_vec[2] * roofF[2];
            const ly = dx_vec[0] * roofN[0] + dx_vec[1] * roofN[1] + dx_vec[2] * roofN[2];
            const cushion = 0.08;
            if (Math.abs(lx) < 0.15 + cushion && lz > -0.15 - cushion && lz < 0.15 + cushion) {
              const clampedZ = Math.max(-0.15, Math.min(0.15, lz));
              const surfH = 0.125 + (clampedZ / 0.30) * 0.25;
              if (ly >= -cushion && ly <= surfH + 0.04 + cushion) {
                const pen = (surfH + 0.04 + cushion) - ly;
                currentP[0] += roofN[0] * (pen + 0.02);
                currentP[1] += roofN[1] * (pen + 0.02);
                currentP[2] += roofN[2] * (pen + 0.02);
                structureMoved = true;
              }
            }
          } else if (other.type === "robot_stand") {
            const standCenterRadius = Math.sqrt(
              other.position[0] * other.position[0] +
              other.position[1] * other.position[1] +
              other.position[2] * other.position[2]
            );
            
            const standHeight = 0.70;
            const camRadius = distToCenter;
            const cushionHeight = 0.05;
            
            if (camRadius > standCenterRadius - cushionHeight && camRadius < standCenterRadius + standHeight + cushionHeight) {
              const angle = other.angle || 0.0;
              const cosA = Math.cos(angle);
              const sinA = Math.sin(angle);
              
              const standR = [
                other.R[0] * cosA + other.F[0] * sinA,
                other.R[1] * cosA + other.F[1] * sinA,
                other.R[2] * cosA + other.F[2] * sinA
              ];
              const standF = [
                other.F[0] * cosA - other.R[0] * sinA,
                other.F[1] * cosA - other.R[1] * sinA,
                other.F[2] * cosA - other.R[2] * sinA
              ];
              
              const dx_vec = [
                currentP[0] - other.position[0],
                currentP[1] - other.position[1],
                currentP[2] - other.position[2]
              ];
              
              const dx = dx_vec[0] * standR[0] + dx_vec[1] * standR[1] + dx_vec[2] * standR[2];
              const dz = dx_vec[0] * standF[0] + dx_vec[1] * standF[1] + dx_vec[2] * standF[2] - (-0.10);
              
              const hw = 0.12;
              const hd = 0.12;
              const cushionR = hw + 0.1;
              const cushionF = hd + 0.1;

              if (Math.abs(dx) < cushionR && Math.abs(dz) < cushionF) {
                const penX = cushionR - Math.abs(dx);
                const penZ = cushionF - Math.abs(dz);
                const signX = Math.sign(dx) || 1;
                const signZ = Math.sign(dz) || 1;
                
                if (penX < penZ) {
                  currentP[0] += standR[0] * signX * (penX + 0.015);
                  currentP[1] += standR[1] * signX * (penX + 0.015);
                  currentP[2] += standR[2] * signX * (penX + 0.015);
                } else {
                  currentP[0] += standF[0] * signZ * (penZ + 0.015);
                  currentP[1] += standF[1] * signZ * (penZ + 0.015);
                  currentP[2] += standF[2] * signZ * (penZ + 0.015);
                }
                structureMoved = true;
              }
            }
          }
        }
      }

      if (structureMoved) moved = true;

      if (!moved) break;
    }

    return currentP;
  },

  // Layer: Player/Characters (Walking and Swimming on Terrain)
  checkCaveAndTerrainCollision: function(P_new, P_curr, centerRadius, charScale, swimFactor, wRadius, diveDepth, swimMoveFactor, charHeight) {
    const r_planet = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
    const h_scale = typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 0.6;
    
    const maxStepUp = Math.max(0.20, 0.35 * charScale);
    
    const isMech = (typeof activeRidingMech !== "undefined" && activeRidingMech) || (typeof window !== "undefined" && window.activeRidingMech);
    const playerFootOffset = isMech ? ((typeof window !== "undefined" && typeof window.mechSeatOffset !== "undefined") ? window.mechSeatOffset : 0.71) : 0.46 * charScale;

    // Check standard terrain surface and cave system mathematically
    const feetRadiusBefore = (centerRadius !== null) ? (centerRadius - playerFootOffset) : (r_planet + charHeight * h_scale);
    const caveData = typeof getTerrainSurfaceAndCeiling === "function"
      ? getTerrainSurfaceAndCeiling(P_new[0], P_new[1], P_new[2], feetRadiusBefore)
      : { ground: r_planet + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1, Math.min(1, P_new[1]))), Math.atan2(P_new[2], P_new[0]), typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined' ? window.globalSeed : 0) : 0) * h_scale, ceiling: Infinity, insideTunnel: false };

    const bodyCushion = 0.46 * charScale;
    let isPushed = false;
    let pushP = [P_new[0], P_new[1], P_new[2]];
    let pushR = centerRadius;

    // 1. Resolve 3D Cave Collision using Cave Density Gradient
    if (typeof getTerrainDensity === "function" && typeof tunnels3D !== "undefined" && tunnels3D.length > 0 && caveData.insideTunnel) {
        let p3x = pushP[0] * pushR;
        let p3y = pushP[1] * pushR;
        let p3z = pushP[2] * pushR;
        
        // Helper to get ONLY the cave density (continuous function)
        const getCaveDensity = (px, py, pz) => {
            // Trim/clip cave density above the heightmap surface
            const dist = Math.sqrt(px*px + py*py + pz*pz) || 1;
            const ux = px / dist, uy = py / dist, uz = pz / dist;
            const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
            const phi = Math.atan2(uz, ux);
            const h = typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0) : 0;
            const terrainRadius = r_planet + h * h_scale;
            if (false) {
                return -Infinity; // Above the terrain is always air/inside the cave (density -Infinity means extremely open air, so no collision push)
            }

            let maxCaveDensity = -Infinity;
            for (let i = 0; i < tunnels3D.length; i++) {
                const t = tunnels3D[i];
                const dx = px - t.x, dy = py - t.y, dz = pz - t.z;
                const tDist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
                let currentR = t.r;
                // Exclude fbmNoise from player physics collision so the wall is smooth and prevents violent vertical bouncing
                const caveDensity = currentR - tDist;
                if (caveDensity > maxCaveDensity) {
                    maxCaveDensity = caveDensity;
                }
            }
            // maxCaveDensity is POSITIVE inside the cave, NEGATIVE outside.
            // We want distance INTO the solid wall, so we invert it:
            return Math.min(terrainRadius - dist, -maxCaveDensity); 
        };

        for (let iter = 0; iter < 4; iter++) {
            let d = getCaveDensity(p3x, p3y, p3z);
            let pen = d - (-bodyCushion * 0.8);
            if (pen > 0) {
                let eps = 0.05;
                let dx = getCaveDensity(p3x+eps, p3y, p3z) - getCaveDensity(p3x-eps, p3y, p3z);
                let dy = getCaveDensity(p3x, p3y+eps, p3z) - getCaveDensity(p3x, p3y-eps, p3z);
                let dz = getCaveDensity(p3x, p3y, p3z+eps) - getCaveDensity(p3x, p3y, p3z-eps);
                let glensq = dx*dx + dy*dy + dz*dz;
                
                if (glensq > 0.000001) {
                    let glen = Math.sqrt(glensq);
                    // Move in direction of -gradient
                    p3x -= (dx / glen) * pen;
                    p3y -= (dy / glen) * pen;
                    p3z -= (dz / glen) * pen;
                } else {
                    let bestDist = Infinity;
                    let closestT = null;
                    for (let t of tunnels3D) {
                        let tdist = (p3x-t.x)*(p3x-t.x) + (p3y-t.y)*(p3y-t.y) + (p3z-t.z)*(p3z-t.z);
                        if (tdist < bestDist) { bestDist = tdist; closestT = t; }
                    }
                    if (closestT) {
                        let tdist = Math.sqrt(bestDist);
                        p3x += ((closestT.x - p3x) / tdist) * pen;
                        p3y += ((closestT.y - p3y) / tdist) * pen;
                        p3z += ((closestT.z - p3z) / tdist) * pen;
                    }
                }
            } else {
                break;
            }
        }
        const newLen = Math.sqrt(p3x*p3x + p3y*p3y + p3z*p3z) || 1;
        pushP[0] = p3x / newLen;
        pushP[1] = p3y / newLen;
        pushP[2] = p3z / newLen;
        pushR = newLen;
    }

    

    // 2. Real-time Cave Boundary Resolution
    // Inside the cave tunnels, we use 3D sliding mesh collision and also enforce mathematical floor/ceiling limits.
    // This allows smooth movement and guarantees the player can NEVER clip through the cave floor/ceiling!

    // Re-evaluate caveData since P_new/pushP might have been constrained by the wall collision!
    const updatedFeetRadius = (pushR !== null) ? (pushR - 0.46 * charScale) : (r_planet + charHeight * h_scale);
    let updatedCaveData = typeof getTerrainSurfaceAndCeiling === "function" 
        ? getTerrainSurfaceAndCeiling(pushP[0], pushP[1], pushP[2], updatedFeetRadius) 
        : caveData;
    
    // Fallback: If we just forced them inside the math boundary and they are underground inside a real cave tunnel, treat them as inside!
    const thetaFinal = Math.acos(Math.max(-1, Math.min(1, pushP[1])));
    const phiFinal = Math.atan2(pushP[2], pushP[0]);
    const heightFinal = typeof getHeightOnSphere === "function" ? getHeightOnSphere(thetaFinal, phiFinal, typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined' ? window.globalSeed : 0) : 0;
    const finalTerrainRadius = r_planet + heightFinal * h_scale;
    if (caveData && caveData.insideTunnel && pushR < finalTerrainRadius - 0.2 * charScale && (!updatedCaveData || !updatedCaveData.insideTunnel)) {
        // We know they are underground inside a real cave tunnel, ensure they stay in cave space
        if (!updatedCaveData) {
            updatedCaveData = { ground: pushR - playerFootOffset, ceiling: Infinity, insideTunnel: true };
        } else {
            updatedCaveData.insideTunnel = true;
        }
    }

    if (updatedCaveData.insideTunnel) {
        caveData.ground = updatedCaveData.ground;
        caveData.ceiling = updatedCaveData.ceiling;

      let testDiveDepth = diveDepth;
      
      const minCenter = caveData.ground + 0.46 * charScale;
      const maxCenter = (caveData.ceiling !== Infinity) ? (caveData.ceiling - 0.46 * charScale) : Infinity;
      const safeMaxCenter = Math.max(maxCenter, minCenter);
      
      // Clamp the player's center radius to stay strictly between the floor and ceiling
      let testCenterRadius = Math.max(minCenter, Math.min(safeMaxCenter, pushR));

      if (swimFactor > 0.0) {
        const targetSwimRadius = wRadius + (-0.22 + swimMoveFactor * 0.27) * charScale;
        testDiveDepth = Math.max(0.0, targetSwimRadius - testCenterRadius);
      }

      return {
        P_new: [pushP[0], pushP[1], pushP[2]],
        playerCenterRadius: testCenterRadius,
        playerDiveDepth: testDiveDepth,
        isDivingMode: testDiveDepth > 0.015 * charScale,
        shouldBlock: false // 3D sliding handles blocking, never block player inputs completely
      };
    }

    // 3. Standard Surface Collision (When outside of cave tunnels)
    const currFeetRadius = (centerRadius !== null) ? (centerRadius - playerFootOffset) : (r_planet + charHeight * h_scale);
    const thetaCurr = Math.acos(Math.max(-1, Math.min(1, P_curr[1])));
    const phiCurr = Math.atan2(P_curr[2], P_curr[0]);
    const getH_fn = typeof getVisualHeightOnSphere === "function" ? getVisualHeightOnSphere : (typeof getHeightOnSphere === "function" ? getHeightOnSphere : () => 0);
    const seedVal = (typeof window !== 'undefined' && typeof window.globalSeed !== 'undefined') ? window.globalSeed : 0;
    const heightCurr = getH_fn(thetaCurr, phiCurr, seedVal);
    const currCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(P_curr[0], P_curr[1], P_curr[2], currFeetRadius) : null;
    const currTerrainRadius = (currCaveData && currCaveData.insideTunnel) ? currCaveData.ground : (r_planet + heightCurr * h_scale);

    function evaluatePosition(P, currentR) {
      let testCenterRadius = currentR;
      let testDiveDepth = diveDepth;
      let testIsDiving = testDiveDepth > 0.01 * charScale;

      const thetaP = Math.acos(Math.max(-1, Math.min(1, P[1])));
      const phiP = Math.atan2(P[2], P[0]);
      const heightP = getH_fn(thetaP, phiP, seedVal);
      const pFeetRadius = currentR - playerFootOffset;
      const caveDataP = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(P[0], P[1], P[2], pFeetRadius) : null;
      let terrainRadius = (caveDataP && caveDataP.insideTunnel) ? caveDataP.ground : (r_planet + heightP * h_scale);

      // Check whether target position is supported by constructed stairs or folding ladders
      let isStairOrLadder = false;
      if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
        const testFeet = currentR - playerFootOffset;
        for (let itm of collectibles) {
          if (itm.active && (itm.type === "wood_stairs" || itm.type === "folding_ladder") && !itm.isPreview && itm.position) {
            const dxStair = P[0] * testFeet - itm.position[0];
            const dyStair = P[1] * testFeet - itm.position[1];
            const dzStair = P[2] * testFeet - itm.position[2];
            const reachLim = itm.type === "folding_ladder" ? 5.5 : 4.0;
            if (dxStair*dxStair + dyStair*dyStair + dzStair*dzStair < reachLim*reachLim) {
              isStairOrLadder = true;
              break;
            }
          }
        }
      }

      // Calculate terrain slope angle using spherical surface arc distance and visual map noise height
      const dotPP = Math.max(-1.0, Math.min(1.0, P[0] * P_curr[0] + P[1] * P_curr[1] + P[2] * P_curr[2]));
      const arcAngle = Math.acos(dotPP);
      const groundDistance = arcAngle * r_planet;
      const elevationDiff = terrainRadius - currTerrainRadius;
      
      // Check whether target is on water surface or submerged under water
      const hasWater = (typeof waterEnabled !== "undefined" && waterEnabled && wRadius > 0);
      const isTargetUnderWater = hasWater && (terrainRadius < wRadius - 0.02);
      const isCurrUnderWater = hasWater && (currTerrainRadius < wRadius - 0.02);

      const activeBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat);
      const isBoatInWater = !!(activeBoat && (activeBoat.isInWater || (hasWater && currTerrainRadius < wRadius)));
      const isBoatFlying = !!(activeBoat && (activeBoat.isFlying || activeBoat.isAirborne));

      // Calculate slope ratio:
      // 1. When on water (both current and target in water), there is NO 45-degree slope limit (water surface is flat/navigable).
      // 2. When encountering dry ground/land (> 45 degrees), whether walking on land or transitioning from water onto land ("กึ่งบกกึ่งน้ำ"),
      //    the 45-degree slope restriction and GTA-style tangential slip MUST work!
      let isTooSteep = false;
      if (!isTargetUnderWater && !isBoatFlying && !isStairOrLadder) {
        if (!isCurrUnderWater && swimFactor <= 0.0 && !isBoatInWater) {
          // Both current and target are on dry land
          const elevationDiff = terrainRadius - currTerrainRadius;
          const slopeRatio = groundDistance > 0.0001 ? (elevationDiff / groundDistance) : 0.0;
          isTooSteep = (elevationDiff > 0.01) && (slopeRatio > 1.0);
        } else {
          // Transitioning from water up onto emergent dry land (amphibious / กึ่งบกกึ่งน้ำ)
          // 1) Elevation climb from the water surface up onto the emergent land:
          const climbFromWater = terrainRadius - wRadius;
          const climbRatio = groundDistance > 0.0001 ? (climbFromWater / groundDistance) : 0.0;
          // 2) Terrain elevation difference between land and underwater floor:
          const elevationFromTerrain = terrainRadius - currTerrainRadius;
          const terrainSlopeRatio = groundDistance > 0.0001 ? (elevationFromTerrain / groundDistance) : 0.0;

          // Slope > 45 degrees (slope ratio > 1.0, tan 45° = 1.0)
          isTooSteep = (climbFromWater > 0.005 && climbRatio > 1.0) ||
                       (terrainRadius > wRadius + 0.02 && elevationFromTerrain > 0.005 && terrainSlopeRatio > 1.0);
        }

        // Additional probe: sample local terrain slope gradient ahead along movement direction
        if (!isTooSteep) {
          const dispP = [P[0] - P_curr[0], P[1] - P_curr[1], P[2] - P_curr[2]];
          const dispPLen = Math.sqrt(dispP[0]*dispP[0] + dispP[1]*dispP[1] + dispP[2]*dispP[2]);
          if (dispPLen > 1e-6) {
            const stepLen = 0.03;
            const dirP = [dispP[0] / dispPLen, dispP[1] / dispPLen, dispP[2] / dispPLen];
            let probeP = [P[0] + dirP[0] * stepLen, P[1] + dirP[1] * stepLen, P[2] + dirP[2] * stepLen];
            const prLen = Math.sqrt(probeP[0]*probeP[0] + probeP[1]*probeP[1] + probeP[2]*probeP[2]) || 1;
            probeP = [probeP[0] / prLen, probeP[1] / prLen, probeP[2] / prLen];
            const thetaPr = Math.acos(Math.max(-1, Math.min(1, probeP[1])));
            const phiPr = Math.atan2(probeP[2], probeP[0]);
            const heightPr = getH_fn(thetaPr, phiPr, seedVal);
            const probeRadius = r_planet + heightPr * h_scale;
            const probeDist = stepLen * r_planet;
            const localSlope = (probeRadius - terrainRadius) / probeDist;
            if (probeRadius > terrainRadius + 0.005 && localSlope > 1.0) {
              isTooSteep = true;
            }
          }
        }
      }
      
      if (swimFactor > 0.0 || isBoatInWater) {
        const targetSwimRadius = wRadius + (-0.22 + swimMoveFactor * 0.27) * charScale;
        testCenterRadius = isBoatInWater ? Math.max(targetSwimRadius, currentR) : (targetSwimRadius - testDiveDepth);

        const testFeetRadius = testCenterRadius - playerFootOffset;

        // If target is a steep cliff or slope (> 45 degrees) rising out of water (กึ่งบกกึ่งน้ำ),
        // trigger steep collision so GTA-style contour tangential slip / inertia activates!
        if (isTooSteep) {
          return { colliding: true, isTooSteep: true, centerRadius: testCenterRadius, diveDepth: testDiveDepth, isDiving: testIsDiving };
        }

        // Terrain Wall Block in water (Blocks vertical cliffs/docks rising higher than maxStepUp above water surface)
        const isEmergentLand = (terrainRadius > wRadius - 0.05);
        const effectiveBase = hasWater ? Math.max(currTerrainRadius, wRadius) : currTerrainRadius;
        if (isEmergentLand && (terrainRadius > effectiveBase + maxStepUp)) {
          if (testFeetRadius < terrainRadius) {
            return { colliding: true, isTooSteep: false, centerRadius: testCenterRadius, diveDepth: testDiveDepth, isDiving: testIsDiving };
          }
        }

        // Terrain Floor Adjustment (Gentle beach / shallow water step up)
        if (testFeetRadius < terrainRadius) {
          if (terrainRadius <= effectiveBase + maxStepUp && !isTooSteep) {
            testCenterRadius = terrainRadius + playerFootOffset;
            testDiveDepth = Math.max(0.0, targetSwimRadius - testCenterRadius);
            testIsDiving = testDiveDepth > 0.015 * charScale;
          } else {
            return { colliding: true, isTooSteep: isTooSteep, centerRadius: testCenterRadius, diveDepth: testDiveDepth, isDiving: testIsDiving };
          }
        }
      } else {
        // Walking logic on surface
        let testFeetRadius = testCenterRadius - playerFootOffset;
        
        // Wall collision & Steep slope / Vertical cliff blocking (> 45 degrees)
        if (terrainRadius > currTerrainRadius + maxStepUp || isTooSteep) {
          if (testFeetRadius < terrainRadius || isTooSteep) {
            return { colliding: true, isTooSteep: isTooSteep, centerRadius: testCenterRadius, diveDepth: testDiveDepth, isDiving: testIsDiving };
          }
        }
        
        // Step up
        if (testFeetRadius < terrainRadius && terrainRadius <= currTerrainRadius + maxStepUp && !isTooSteep) {
          testCenterRadius = terrainRadius + playerFootOffset;
          testFeetRadius = testCenterRadius - playerFootOffset;
        }

        // Check solid stone floor legs/foundation collision from the side at ground level
        const testPos3D = [P[0] * testFeetRadius, P[1] * testFeetRadius, P[2] * testFeetRadius];
        const itemsList = (typeof SpatialGrid !== "undefined")
          ? SpatialGrid.queryRadius(testPos3D[0], testPos3D[1], testPos3D[2], 9.0, other => !other.isPreview && other.type === "stone_floor")
          : (typeof collectibles !== "undefined" ? collectibles : []);
        const charRad = 0.18 * charScale;

        for (let other of itemsList) {
          if (!other.active || other.isPreview || !other.position) continue;
          
          if (other.type === "stone_floor") {
            const dx_vec = [
              testPos3D[0] - other.position[0],
              testPos3D[1] - other.position[1],
              testPos3D[2] - other.position[2]
            ];
            const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
            const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
            const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];

            const sizeVal = other.size || 0.25;
            const floorW = typeof other.width === "number" ? other.width : sizeVal * 12.0;
            const floorD = typeof other.depth === "number" ? other.depth : sizeVal * 12.0;
            const hw = floorW / 2 + charRad - 0.02; // inside margin for smooth sliding
            const hd = floorD / 2 + charRad - 0.02;

            if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
              // Only block from side if top slab is higher than maxStepUp above player's feet (e.g. high pillar/wall)
              if (dy < -maxStepUp - 0.05 && dy > -10.0) {
                return { colliding: true };
              }
            }
          }
        }
      }

      return {
        colliding: false,
        centerRadius: testCenterRadius,
        diveDepth: testDiveDepth,
        isDiving: testIsDiving
      };
    }

    // Smooth sliding push out for stone floor foundation box at ground level
    let feetR_init = pushR - 0.46 * charScale;
    let p3D_init = [pushP[0] * feetR_init, pushP[1] * feetR_init, pushP[2] * feetR_init];
    const itemsList = (typeof SpatialGrid !== "undefined")
      ? SpatialGrid.queryRadius(p3D_init[0], p3D_init[1], p3D_init[2], 9.0, other => !other.isPreview && other.type === "stone_floor")
      : (typeof collectibles !== "undefined" ? collectibles : []);
    const charRad = 0.18 * charScale;

    for (let pass = 0; pass < 2; pass++) {
      let feetR = pushR - 0.46 * charScale;
      let p3D = [pushP[0] * feetR, pushP[1] * feetR, pushP[2] * feetR];
      let stonePushed = false;

      for (let other of itemsList) {
        if (!other.active || other.isPreview || !other.position) continue;
        if (other.type === "stone_floor") {
          const dx_vec = [
            p3D[0] - other.position[0],
            p3D[1] - other.position[1],
            p3D[2] - other.position[2]
          ];
          const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
          const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
          const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];

          const sizeVal = other.size || 0.25;
          const floorW = typeof other.width === "number" ? other.width : sizeVal * 12.0;
          const floorD = typeof other.depth === "number" ? other.depth : sizeVal * 12.0;
          const hw = floorW / 2 + charRad;
          const hd = floorD / 2 + charRad;

          if (dy < -0.05 && dy > -2.0) {
            if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
              const penX = hw - Math.abs(dx);
              const penZ = hd - Math.abs(dz);

              if (penX < penZ) {
                const shift = (dx >= 0 ? 1 : -1) * (penX + 0.005);
                p3D[0] += other.R[0] * shift;
                p3D[1] += other.R[1] * shift;
                p3D[2] += other.R[2] * shift;
              } else {
                const shift = (dz >= 0 ? 1 : -1) * (penZ + 0.005);
                p3D[0] += other.F[0] * shift;
                p3D[1] += other.F[1] * shift;
                p3D[2] += other.F[2] * shift;
              }
              stonePushed = true;
            }
          }
        }
      }

      if (stonePushed) {
        const pLen = Math.sqrt(p3D[0]*p3D[0] + p3D[1]*p3D[1] + p3D[2]*p3D[2]) || 1;
        pushP = [p3D[0] / pLen, p3D[1] / pLen, p3D[2] / pLen];
        isPushed = true;
      } else {
        break;
      }
    }

    const targetEval = evaluatePosition(pushP, pushR);

    // GTA-style Tangential Slip / Inertia handling on steep slopes (> 45 degrees):
    // If movement collides with a steep slope, do NOT freeze abruptly to [P_curr]!
    // Instead, try sliding tangentially along the slope contour where the slope is manageable,
    // keeping momentum fluid like GTA.
    if (targetEval.isTooSteep) {
      if (typeof activeRidingBoat !== "undefined" && activeRidingBoat && typeof activeRidingBoat.vehicleSpeed === "number") {
        activeRidingBoat.vehicleSpeed *= 0.8;
      }

      const disp = [pushP[0] - P_curr[0], pushP[1] - P_curr[1], pushP[2] - P_curr[2]];
      const dispLen = Math.sqrt(disp[0]*disp[0] + disp[1]*disp[1] + disp[2]*disp[2]);

      if (dispLen > 0.000001) {
        const dir = [disp[0] / dispLen, disp[1] / dispLen, disp[2] / dispLen];
        // Tangent perpendicular (contour vector along the mountain / slope)
        let cross = [
          P_curr[1] * dir[2] - P_curr[2] * dir[1],
          P_curr[2] * dir[0] - P_curr[0] * dir[2],
          P_curr[0] * dir[1] - P_curr[1] * dir[0]
        ];
        const crossLen = Math.sqrt(cross[0]*cross[0] + cross[1]*cross[1] + cross[2]*cross[2]) || 1;
        cross = [cross[0] / crossLen, cross[1] / crossLen, cross[2] / crossLen];

        // Candidate directions: glancing deflection (contour tangential slide with inertia)
        const candidateVecs = [
          [dir[0] * 0.25 + cross[0] * 0.9, dir[1] * 0.25 + cross[1] * 0.9, dir[2] * 0.25 + cross[2] * 0.9],
          [dir[0] * 0.25 - cross[0] * 0.9, dir[1] * 0.25 - cross[1] * 0.9, dir[2] * 0.25 - cross[2] * 0.9],
          [cross[0] * 0.95, cross[1] * 0.95, cross[2] * 0.95],
          [-cross[0] * 0.95, -cross[1] * 0.95, -cross[2] * 0.95],
          [-dir[0] * 0.2 + cross[0] * 0.8, -dir[1] * 0.2 + cross[0] * 0.8, -dir[2] * 0.2 + cross[0] * 0.8],
          [-dir[0] * 0.2 - cross[0] * 0.8, -dir[1] * 0.2 - cross[0] * 0.8, -dir[2] * 0.2 - cross[0] * 0.8]
        ];

        for (let cVec of candidateVecs) {
          const P_cand = [
            P_curr[0] + cVec[0] * dispLen,
            P_curr[1] + cVec[1] * dispLen,
            P_curr[2] + cVec[2] * dispLen
          ];
          const cLen = Math.sqrt(P_cand[0]*P_cand[0] + P_cand[1]*P_cand[1] + P_cand[2]*P_cand[2]) || 1;
          P_cand[0] /= cLen; P_cand[1] /= cLen; P_cand[2] /= cLen;

          const evalCand = evaluatePosition(P_cand, pushR);
          if (!evalCand.isTooSteep && !evalCand.colliding) {
            return {
              P_new: P_cand,
              playerCenterRadius: evalCand.centerRadius,
              playerDiveDepth: evalCand.diveDepth,
              isDivingMode: evalCand.isDiving,
              shouldBlock: false
            };
          }
        }
      }

      // If directly facing cliff and contour slide is not clear, stay at P_curr
      return {
        P_new: [P_curr[0], P_curr[1], P_curr[2]],
        playerCenterRadius: centerRadius,
        playerDiveDepth: diveDepth,
        isDivingMode: diveDepth > 0.015 * charScale,
        shouldBlock: true
      };
    }

    if (!targetEval.colliding) {
      return {
        P_new: [pushP[0], pushP[1], pushP[2]],
        playerCenterRadius: isPushed ? pushR : targetEval.centerRadius,
        playerDiveDepth: targetEval.diveDepth,
        isDivingMode: targetEval.isDiving,
        shouldBlock: false
      };
    }

    // Try sliding along tangential axes if full move collides
    const P_slideX = [pushP[0], P_curr[1], P_curr[2]];
    const lenX = Math.sqrt(P_slideX[0]*P_slideX[0] + P_slideX[1]*P_slideX[1] + P_slideX[2]*P_slideX[2]) || 1;
    P_slideX[0] /= lenX; P_slideX[1] /= lenX; P_slideX[2] /= lenX;
    const evalX = evaluatePosition(P_slideX, pushR);
    if (!evalX.colliding) {
      return {
        P_new: P_slideX,
        playerCenterRadius: evalX.centerRadius,
        playerDiveDepth: evalX.diveDepth,
        isDivingMode: evalX.isDiving,
        shouldBlock: false
      };
    }

    const P_slideY = [P_curr[0], pushP[1], P_curr[2]];
    const lenY = Math.sqrt(P_slideY[0]*P_slideY[0] + P_slideY[1]*P_slideY[1] + P_slideY[2]*P_slideY[2]) || 1;
    P_slideY[0] /= lenY; P_slideY[1] /= lenY; P_slideY[2] /= lenY;
    const evalY = evaluatePosition(P_slideY, pushR);
    if (!evalY.colliding) {
      return {
        P_new: P_slideY,
        playerCenterRadius: evalY.centerRadius,
        playerDiveDepth: evalY.diveDepth,
        isDivingMode: evalY.isDiving,
        shouldBlock: false
      };
    }

    const P_slideZ = [P_curr[0], P_curr[1], pushP[2]];
    const lenZ = Math.sqrt(P_slideZ[0]*P_slideZ[0] + P_slideZ[1]*P_slideZ[1] + P_slideZ[2]*P_slideZ[2]) || 1;
    P_slideZ[0] /= lenZ; P_slideZ[1] /= lenZ; P_slideZ[2] /= lenZ;
    const evalZ = evaluatePosition(P_slideZ, pushR);
    if (!evalZ.colliding) {
      return {
        P_new: P_slideZ,
        playerCenterRadius: evalZ.centerRadius,
        playerDiveDepth: evalZ.diveDepth,
        isDivingMode: evalZ.isDiving,
        shouldBlock: false
      };
    }

    return {
      P_new: [P_curr[0], P_curr[1], P_curr[2]],
      playerCenterRadius: centerRadius,
      playerDiveDepth: diveDepth,
      isDivingMode: diveDepth > 0.015 * charScale,
      shouldBlock: true
    };
  },

  // Layer: Structures (Wood Walls, Wood Roofs, Wood Windows, Wood Doors) for both Player and Wheeled Boat
  resolveStructureCollisions: function(params) {
    const P_new = params.P_new;
    const P_curr = params.P_curr;
    const groundRadius = params.groundRadius;
    const playerScale = params.playerScale;
    const activeRidingBoat = params.activeRidingBoat;
    const collectibles = params.collectibles;
    const F_3d = params.F_3d;
    const East = params.East;
    const North = params.North;
    const charTheta = params.charTheta;
    const charPhi = params.charPhi;
    const charHeading = params.charHeading;

    if (!collectibles || !collectibles.length) return false;

    const currentPlayPos3D = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
    const nearbyCollectibles = [];
    const collFilterDistSq = 4.0 * 4.0;
    for (let i = 0; i < collectibles.length; i++) {
      const item = collectibles[i];
      if (item.active && !item.isPreview && (item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door" || item.type === "wood_roof" || item.type === "robot_stand")) {
        const dx = currentPlayPos3D[0] - item.position[0];
        const dy = currentPlayPos3D[1] - item.position[1];
        const dz = currentPlayPos3D[2] - item.position[2];
        if (dx*dx + dy*dy + dz*dz < collFilterDistSq) {
          nearbyCollectibles.push(item);
        }
      }
    }

    if (!nearbyCollectibles.length) return false;

    const isRidingBoat = !!activeRidingBoat;
    let vehicleCollidedWithStructure = false;

    let boatF = null;
    let boatR = null;
    if (isRidingBoat) {
      boatF = (typeof F_3d !== "undefined" && F_3d) ? [F_3d[0], F_3d[1], F_3d[2]] : (activeRidingBoat.F || [0, 0, 1]);
      const eastVec = (typeof East !== "undefined" && East) ? East : [-Math.sin(charPhi), 0, Math.cos(charPhi)];
      const northVec = (typeof North !== "undefined" && North) ? North : [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
      boatR = [
        eastVec[0] * Math.cos(charHeading) - northVec[0] * Math.sin(charHeading),
        eastVec[1] * Math.cos(charHeading) - northVec[1] * Math.sin(charHeading),
        eastVec[2] * Math.cos(charHeading) - northVec[2] * Math.sin(charHeading)
      ];
      const rLen = Math.sqrt(boatR[0]*boatR[0] + boatR[1]*boatR[1] + boatR[2]*boatR[2]) || 1;
      boatR = [boatR[0] / rLen, boatR[1] / rLen, boatR[2] / rLen];
    }

    const structTestPoints = isRidingBoat ? [
      { fwd: 0.22, side: 0.0, rad: 0.10 },    // Bow
      { fwd: -0.20, side: 0.0, rad: 0.10 },   // Stern
      { fwd: 0.0, side: 0.17, rad: 0.09 },    // Right hull
      { fwd: 0.0, side: -0.17, rad: 0.09 },   // Left hull
      { fwd: 0.18, side: 0.15, rad: 0.08 },   // Front-Right wheel
      { fwd: 0.18, side: -0.15, rad: 0.08 },  // Front-Left wheel
      { fwd: -0.16, side: 0.15, rad: 0.08 },  // Rear-Right wheel
      { fwd: -0.16, side: -0.15, rad: 0.08 }, // Rear-Left wheel
      { fwd: 0.0, side: 0.0, rad: 0.12 }      // Boat center
    ] : [
      { fwd: 0.0, side: 0.0, rad: playerScale * 0.38 }
    ];

    const numStructPasses = isRidingBoat ? 3 : 2;

    for (let pass = 0; pass < numStructPasses; pass++) {
      // 1. COLLISION WITH WOOD WALLS
      for (let other of nearbyCollectibles) {
        if (other.active && other.type === "wood_wall" && !other.isPreview) {
          const wallCenterRadius = Math.sqrt(
            other.position[0] * other.position[0] +
            other.position[1] * other.position[1] +
            other.position[2] * other.position[2]
          );
          
          const wallHeight = 0.25;
          const feetRadius = isRidingBoat ? (groundRadius - 0.22) : (groundRadius - 0.46 * playerScale);
          const headRadius = isRidingBoat ? (groundRadius + 0.42) : (groundRadius + 0.46 * playerScale);
          
          if (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            const wallR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const wallF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            
            let segments = [];
            let hasCoLocatedDoor = (other.type === "wood_door");
            let hasCoLocatedWindow = (other.type === "wood_window");
            if (isRidingBoat) {
              segments.push({ cx: 0.0, hw: 0.15 });
            } else {
              for (let d of nearbyCollectibles) {
                if (d.active && !d.isPreview) {
                  const ox = d.position[0] - other.position[0];
                  const oy = d.position[1] - other.position[1];
                  const oz = d.position[2] - other.position[2];
                  if (ox*ox + oy*oy + oz*oz < 0.005) {
                    if (d.type === "wood_door") hasCoLocatedDoor = true;
                    else if (d.type === "wood_window") hasCoLocatedWindow = true;
                  }
                }
              }
              if (hasCoLocatedDoor) {
                segments.push({ cx: -0.12, hw: 0.03 });
                segments.push({ cx: 0.12, hw: 0.03 });
              } else if (hasCoLocatedWindow) {
                const feetHeight = feetRadius - wallCenterRadius;
                if (feetHeight >= 0.075 && feetHeight < 0.185) {
                  segments.push({ cx: -0.1175, hw: 0.0325 });
                  segments.push({ cx: 0.1175, hw: 0.0325 });
                } else {
                  segments.push({ cx: 0.0, hw: 0.15 });
                }
              } else {
                segments.push({ cx: 0.0, hw: 0.15 });
              }
            }

            const hd = 0.02;

            for (let tp of structTestPoints) {
              const tpOff = isRidingBoat ? [
                boatF[0] * tp.fwd + boatR[0] * tp.side,
                boatF[1] * tp.fwd + boatR[1] * tp.side,
                boatF[2] * tp.fwd + boatR[2] * tp.side
              ] : [0, 0, 0];

              const curPt = [
                P_new[0] * groundRadius + tpOff[0],
                P_new[1] * groundRadius + tpOff[1],
                P_new[2] * groundRadius + tpOff[2]
              ];
              const prevPt = [
                P_curr[0] * groundRadius + tpOff[0],
                P_curr[1] * groundRadius + tpOff[1],
                P_curr[2] * groundRadius + tpOff[2]
              ];

              const cur_dx = (curPt[0] - other.position[0]) * wallR[0] + (curPt[1] - other.position[1]) * wallR[1] + (curPt[2] - other.position[2]) * wallR[2];
              const cur_dz = (curPt[0] - other.position[0]) * wallF[0] + (curPt[1] - other.position[1]) * wallF[1] + (curPt[2] - other.position[2]) * wallF[2];

              // If wall has a door and player is walking within doorway opening, do not block!
              if (hasCoLocatedDoor && Math.abs(cur_dx) < 0.065) {
                continue;
              }

              const prev_dz = (prevPt[0] - other.position[0]) * wallF[0] + (prevPt[1] - other.position[1]) * wallF[1] + (prevPt[2] - other.position[2]) * wallF[2];
              const prev_dx = (prevPt[0] - other.position[0]) * wallR[0] + (prevPt[1] - other.position[1]) * wallR[1] + (prevPt[2] - other.position[2]) * wallR[2];

              for (let seg of segments) {
                const ldx = cur_dx - seg.cx;
                const prev_ldx = prev_dx - seg.cx;
                const limitX = seg.hw + tp.rad;
                const limitZ = hd + tp.rad;

                if (Math.abs(ldx) < limitX && Math.abs(cur_dz) < limitZ) {
                  const penX = limitX - Math.abs(ldx);
                  const penZ = limitZ - Math.abs(cur_dz);

                  const signZ = (Math.abs(prev_dz) > 0.002 ? Math.sign(prev_dz) : Math.sign(cur_dz)) || 1;
                  const signX = (Math.abs(prev_ldx) > 0.002 ? Math.sign(prev_ldx) : Math.sign(ldx)) || 1;

                  let pushVec;
                  if (penX < penZ && Math.abs(ldx) > seg.hw * 0.75) {
                    const pushAmt = penX * signX;
                    pushVec = [wallR[0] * pushAmt, wallR[1] * pushAmt, wallR[2] * pushAmt];
                  } else {
                    const pushAmt = penZ * signZ;
                    pushVec = [wallF[0] * pushAmt, wallF[1] * pushAmt, wallF[2] * pushAmt];
                  }

                  P_new[0] += pushVec[0] / groundRadius;
                  P_new[1] += pushVec[1] / groundRadius;
                  P_new[2] += pushVec[2] / groundRadius;

                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp;
                  P_new[1] /= pLenTemp;
                  P_new[2] /= pLenTemp;

                  if (isRidingBoat) vehicleCollidedWithStructure = true;
                }
              }
            }
          }
        }
      }

      // 2. COLLISION WITH WOOD ROOFS
      for (let other of nearbyCollectibles) {
        if (other.active && other.type === "wood_roof" && !other.isPreview) {
          const roofCenterRadius = Math.sqrt(
            other.position[0] * other.position[0] +
            other.position[1] * other.position[1] +
            other.position[2] * other.position[2]
          );
          const roofHeight = 0.30;
          const feetRadius = isRidingBoat ? (groundRadius - 0.22) : (groundRadius - 0.46 * playerScale);
          const headRadius = isRidingBoat ? (groundRadius + 0.42) : (groundRadius + 0.46 * playerScale);

          if (headRadius > roofCenterRadius - 0.08 && feetRadius < roofCenterRadius + roofHeight + 0.08) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const roofR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const roofF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            const roofN = other.normal || [0, 1, 0];

            const d = 0.30;
            const rise = 0.25;
            const slopeLen = Math.sqrt(d * d + rise * rise);
            const normSlope = [
              (roofN[0] * d - roofF[0] * rise) / slopeLen,
              (roofN[1] * d - roofF[1] * rise) / slopeLen,
              (roofN[2] * d - roofF[2] * rise) / slopeLen
            ];
            const slopeOffset = (rise / 2) * (d / slopeLen);

            for (let tp of structTestPoints) {
              const tpOff = isRidingBoat ? [
                boatF[0] * tp.fwd + boatR[0] * tp.side,
                boatF[1] * tp.fwd + boatR[1] * tp.side,
                boatF[2] * tp.fwd + boatR[2] * tp.side
              ] : [0, 0, 0];

              const curPt = [
                P_new[0] * groundRadius + tpOff[0],
                P_new[1] * groundRadius + tpOff[1],
                P_new[2] * groundRadius + tpOff[2]
              ];
              const prevPt = [
                P_curr[0] * groundRadius + tpOff[0],
                P_curr[1] * groundRadius + tpOff[1],
                P_curr[2] * groundRadius + tpOff[2]
              ];

              const lx = (curPt[0] - other.position[0]) * roofR[0] + (curPt[1] - other.position[1]) * roofR[1] + (curPt[2] - other.position[2]) * roofR[2];
              const lz = (curPt[0] - other.position[0]) * roofF[0] + (curPt[1] - other.position[1]) * roofF[1] + (curPt[2] - other.position[2]) * roofF[2];
              const ly = (curPt[0] - other.position[0]) * roofN[0] + (curPt[1] - other.position[1]) * roofN[1] + (curPt[2] - other.position[2]) * roofN[2];

              const prev_lx = (prevPt[0] - other.position[0]) * roofR[0] + (prevPt[1] - other.position[1]) * roofR[1] + (prevPt[2] - other.position[2]) * roofR[2];
              const prev_lz = (prevPt[0] - other.position[0]) * roofF[0] + (prevPt[1] - other.position[1]) * roofF[1] + (prevPt[2] - other.position[2]) * roofF[2];
              const prev_ly = (prevPt[0] - other.position[0]) * roofN[0] + (prevPt[1] - other.position[1]) * roofN[1] + (prevPt[2] - other.position[2]) * roofN[2];

              const limitX = 0.15 + tp.rad;
              const limitZ = 0.15 + tp.rad;

              if (Math.abs(lx) < limitX && Math.abs(lz) < limitZ) {
                const clampedZ = Math.max(-0.15, Math.min(0.15, lz));
                const surfH = 0.125 + (clampedZ / 0.30) * 0.25;

                if (ly >= -tp.rad - 0.05 && ly <= surfH + tp.rad + 0.06) {
                  const distSlope = (ly * d - lz * rise) / slopeLen - slopeOffset;
                  const prev_distSlope = (prev_ly * d - prev_lz * rise) / slopeLen - slopeOffset;

                  let pushVec = null;
                  if (prev_distSlope >= -0.02 || distSlope >= -0.04) {
                    const penSlope = (0.04 + tp.rad) - distSlope;
                    if (penSlope > 0) {
                      pushVec = [normSlope[0] * penSlope, normSlope[1] * penSlope, normSlope[2] * penSlope];
                    }
                  } else {
                    const penX = limitX - Math.abs(lx);
                    const penEave = lz - (-limitZ);
                    const penRidge = limitZ - lz;

                    if (prev_lz <= -0.12 || (penEave < penX && lz < 0)) {
                      const pushAmt = penEave;
                      pushVec = [-roofF[0] * pushAmt, -roofF[1] * pushAmt, -roofF[2] * pushAmt];
                    } else if (prev_lz >= 0.12 || (penRidge < penX && lz > 0)) {
                      const pushAmt = penRidge;
                      pushVec = [roofF[0] * pushAmt, roofF[1] * pushAmt, roofF[2] * pushAmt];
                    } else {
                      const signX = (Math.abs(prev_lx) > 0.01 ? Math.sign(prev_lx) : Math.sign(lx)) || 1;
                      const pushAmt = penX * signX;
                      pushVec = [roofR[0] * pushAmt, roofR[1] * pushAmt, roofR[2] * pushAmt];
                    }
                  }

                  if (pushVec) {
                    P_new[0] += pushVec[0] / groundRadius;
                    P_new[1] += pushVec[1] / groundRadius;
                    P_new[2] += pushVec[2] / groundRadius;

                    const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                    P_new[0] /= pLenTemp;
                    P_new[1] /= pLenTemp;
                    P_new[2] /= pLenTemp;

                    if (isRidingBoat) vehicleCollidedWithStructure = true;
                  }
                }
              }
            }
          }
        }
      }

      // 3. COLLISION WITH WOOD WINDOWS
      for (let other of nearbyCollectibles) {
        if (other.active && other.type === "wood_window" && !other.isPreview) {
          const wallCenterRadius = Math.sqrt(
            other.position[0] * other.position[0] +
            other.position[1] * other.position[1] +
            other.position[2] * other.position[2]
          );
          const wallHeight = 0.25;
          const feetRadius = isRidingBoat ? (groundRadius - 0.22) : (groundRadius - 0.46 * playerScale);
          const headRadius = isRidingBoat ? (groundRadius + 0.42) : (groundRadius + 0.46 * playerScale);

          if (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const wallR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const wallF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];

            if (isRidingBoat) {
              for (let tp of structTestPoints) {
                const tpOff = [
                  boatF[0] * tp.fwd + boatR[0] * tp.side,
                  boatF[1] * tp.fwd + boatR[1] * tp.side,
                  boatF[2] * tp.fwd + boatR[2] * tp.side
                ];
                const curPt = [P_new[0] * groundRadius + tpOff[0], P_new[1] * groundRadius + tpOff[1], P_new[2] * groundRadius + tpOff[2]];
                const prevPt = [P_curr[0] * groundRadius + tpOff[0], P_curr[1] * groundRadius + tpOff[1], P_curr[2] * groundRadius + tpOff[2]];

                const cur_dx = (curPt[0]-other.position[0])*wallR[0] + (curPt[1]-other.position[1])*wallR[1] + (curPt[2]-other.position[2])*wallR[2];
                const cur_dz = (curPt[0]-other.position[0])*wallF[0] + (curPt[1]-other.position[1])*wallF[1] + (curPt[2]-other.position[2])*wallF[2];
                const prev_dz = (prevPt[0]-other.position[0])*wallF[0] + (prevPt[1]-other.position[1])*wallF[1] + (prevPt[2]-other.position[2])*wallF[2];
                const limitX = 0.15 + tp.rad;
                const limitZ = 0.02 + tp.rad;

                if (Math.abs(cur_dx) < limitX && Math.abs(cur_dz) < limitZ) {
                  const penX = limitX - Math.abs(cur_dx);
                  const penZ = limitZ - Math.abs(cur_dz);
                  const signZ = (Math.abs(prev_dz) > 0.002 ? Math.sign(prev_dz) : Math.sign(cur_dz)) || 1;
                  const signX = Math.sign(cur_dx) || 1;

                  let pushVec;
                  if (penX < penZ && Math.abs(cur_dx) > 0.12) {
                    pushVec = [wallR[0] * penX * signX, wallR[1] * penX * signX, wallR[2] * penX * signX];
                  } else {
                    pushVec = [wallF[0] * penZ * signZ, wallF[1] * penZ * signZ, wallF[2] * penZ * signZ];
                  }

                  P_new[0] += pushVec[0] / groundRadius;
                  P_new[1] += pushVec[1] / groundRadius;
                  P_new[2] += pushVec[2] / groundRadius;

                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
                  vehicleCollidedWithStructure = true;
                }
              }
            } else {
              const cur_dx_vec = [
                P_new[0] * groundRadius - other.position[0],
                P_new[1] * groundRadius - other.position[1],
                P_new[2] * groundRadius - other.position[2]
              ];
              const dx = cur_dx_vec[0] * wallR[0] + cur_dx_vec[1] * wallR[1] + cur_dx_vec[2] * wallR[2];
              const dz = cur_dx_vec[0] * wallF[0] + cur_dx_vec[1] * wallF[1] + cur_dx_vec[2] * wallF[2];

              const segments = [
                { cx: -0.1175, hw: 0.0325 },
                { cx: 0.1175, hw: 0.0325 }
              ];
              const feetHeight = feetRadius - wallCenterRadius;
              const headHeight = headRadius - wallCenterRadius;
              if (!(feetHeight >= 0.075 && feetHeight < 0.185)) {
                segments.push({ cx: 0.0, hw: 0.085 });
              }
              const hd = 0.02;
              for (let seg of segments) {
                const cur_dx = (P_new[0]*groundRadius-other.position[0])*wallR[0] + (P_new[1]*groundRadius-other.position[1])*wallR[1] + (P_new[2]*groundRadius-other.position[2])*wallR[2];
                const cur_dz = (P_new[0]*groundRadius-other.position[0])*wallF[0] + (P_new[1]*groundRadius-other.position[1])*wallF[1] + (P_new[2]*groundRadius-other.position[2])*wallF[2];
                const ldx = cur_dx - seg.cx;
                const limitX = seg.hw + playerScale * 0.38;
                const limitZ = hd + playerScale * 0.38;
                if (Math.abs(ldx) < limitX && Math.abs(cur_dz) < limitZ) {
                  const penX = limitX - Math.abs(ldx);
                  const penZ = limitZ - Math.abs(cur_dz);
                  let pushVec;
                  if (penX < penZ) {
                    const pushAmt = penX * Math.sign(ldx);
                    pushVec = [wallR[0] * pushAmt, wallR[1] * pushAmt, wallR[2] * pushAmt];
                  } else {
                    const pushAmt = penZ * Math.sign(cur_dz);
                    pushVec = [wallF[0] * pushAmt, wallF[1] * pushAmt, wallF[2] * pushAmt];
                  }
                  P_new[0] += pushVec[0] / groundRadius;
                  P_new[1] += pushVec[1] / groundRadius;
                  P_new[2] += pushVec[2] / groundRadius;
                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
                }
              }

              const A = other.windowAngle || 0.0;
              if (feetHeight < 0.17 && headHeight > 0.08) {
                const shutterLen = 0.085;
                const shutterThickness = 0.012;
                const colZ = shutterThickness / 2 + playerScale * 0.38;
                const hingeLeft = [other.position[0] - wallR[0] * 0.085, other.position[1] - wallR[1] * 0.085, other.position[2] - wallR[2] * 0.085];
                const p_rel_left = [P_new[0] * groundRadius - hingeLeft[0], P_new[1] * groundRadius - hingeLeft[1], P_new[2] * groundRadius - hingeLeft[2]];
                const R_left = [wallR[0] * Math.cos(A) + wallF[0] * Math.sin(A), wallR[1] * Math.cos(A) + wallF[1] * Math.sin(A), wallR[2] * Math.cos(A) + wallF[2] * Math.sin(A)];
                const F_left = [wallF[0] * Math.cos(A) - wallR[0] * Math.sin(A), wallF[1] * Math.cos(A) - wallR[1] * Math.sin(A), wallF[2] * Math.cos(A) - wallR[2] * Math.sin(A)];
                const leftX = p_rel_left[0] * R_left[0] + p_rel_left[1] * R_left[1] + p_rel_left[2] * R_left[2];
                const leftZ = p_rel_left[0] * F_left[0] + p_rel_left[1] * F_left[1] + p_rel_left[2] * F_left[2];
                if (leftX >= 0 && leftX <= shutterLen && Math.abs(leftZ) < colZ) {
                  const penZ = colZ - Math.abs(leftZ);
                  const pushAmt = penZ * (Math.sign(leftZ) || 1);
                  P_new[0] += (F_left[0] * pushAmt) / groundRadius;
                  P_new[1] += (F_left[1] * pushAmt) / groundRadius;
                  P_new[2] += (F_left[2] * pushAmt) / groundRadius;
                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
                }
                const hingeRight = [other.position[0] + wallR[0] * 0.085, other.position[1] + wallR[1] * 0.085, other.position[2] + wallR[2] * 0.085];
                const p_rel_right = [P_new[0] * groundRadius - hingeRight[0], P_new[1] * groundRadius - hingeRight[1], P_new[2] * groundRadius - hingeRight[2]];
                const leafR_right = [-wallR[0] * Math.cos(A) + wallF[0] * Math.sin(A), -wallR[1] * Math.cos(A) + wallF[1] * Math.sin(A), -wallR[2] * Math.cos(A) + wallF[2] * Math.sin(A)];
                const leafF_right = [wallF[0] * Math.cos(A) + wallR[0] * Math.sin(A), wallF[1] * Math.cos(A) + wallR[0] * Math.sin(A), wallF[2] * Math.cos(A) + wallR[2] * Math.sin(A)];
                const rightX = p_rel_right[0] * leafR_right[0] + p_rel_right[1] * leafR_right[1] + p_rel_right[2] * leafR_right[2];
                const rightZ = p_rel_right[0] * leafF_right[0] + p_rel_right[1] * leafF_right[1] + p_rel_right[2] * leafF_right[2];
                if (rightX >= 0 && rightX <= shutterLen && Math.abs(rightZ) < colZ) {
                  const penZ = colZ - Math.abs(rightZ);
                  const pushAmt = penZ * (Math.sign(rightZ) || 1);
                  P_new[0] += (leafF_right[0] * pushAmt) / groundRadius;
                  P_new[1] += (leafF_right[1] * pushAmt) / groundRadius;
                  P_new[2] += (leafF_right[2] * pushAmt) / groundRadius;
                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
                }
              }
            }
          }
        }
      }

      // 4. COLLISION WITH WOOD DOORS
      for (let other of nearbyCollectibles) {
        if (other.active && other.type === "wood_door" && !other.isPreview) {
          const p3x = P_new[0] * groundRadius;
          const p3y = P_new[1] * groundRadius;
          const p3z = P_new[2] * groundRadius;
          
          const dx_vec_x = p3x - other.position[0];
          const dx_vec_y = p3y - other.position[1];
          const dx_vec_z = p3z - other.position[2];
          const distSq = dx_vec_x * dx_vec_x + dx_vec_y * dx_vec_y + dx_vec_z * dx_vec_z;
          if (distSq > 0.40) continue;

          if (other._wallR === undefined) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            other._wallR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            other._wallF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            other._centerRadius = Math.sqrt(
              other.position[0] * other.position[0] +
              other.position[1] * other.position[1] +
              other.position[2] * other.position[2]
            );
          }
          const wallCenterRadius = other._centerRadius;
          const wallR = other._wallR;
          const wallF = other._wallF;
          
          const wallHeight = 0.25;
          const feetRadius = isRidingBoat ? (groundRadius - 0.22) : (groundRadius - 0.46 * playerScale);
          const headRadius = isRidingBoat ? (groundRadius + 0.42) : (groundRadius + 0.46 * playerScale);
          
          if (headRadius > wallCenterRadius && feetRadius < wallCenterRadius + wallHeight) {
            if (isRidingBoat) {
              for (let tp of structTestPoints) {
                const tpOff = [
                  boatF[0] * tp.fwd + boatR[0] * tp.side,
                  boatF[1] * tp.fwd + boatR[1] * tp.side,
                  boatF[2] * tp.fwd + boatR[2] * tp.side
                ];
                const curPt = [P_new[0] * groundRadius + tpOff[0], P_new[1] * groundRadius + tpOff[1], P_new[2] * groundRadius + tpOff[2]];
                const prevPt = [P_curr[0] * groundRadius + tpOff[0], P_curr[1] * groundRadius + tpOff[1], P_curr[2] * groundRadius + tpOff[2]];

                const cur_dx = (curPt[0]-other.position[0])*wallR[0] + (curPt[1]-other.position[1])*wallR[1] + (curPt[2]-other.position[2])*wallR[2];
                const cur_dz = (curPt[0]-other.position[0])*wallF[0] + (curPt[1]-other.position[1])*wallF[1] + (curPt[2]-other.position[2])*wallF[2];
                const prev_dz = (prevPt[0]-other.position[0])*wallF[0] + (prevPt[1]-other.position[1])*wallF[1] + (prevPt[2]-other.position[2])*wallF[2];
                const limitX = 0.15 + tp.rad;
                const limitZ = 0.025 + tp.rad;

                if (Math.abs(cur_dx) < limitX && Math.abs(cur_dz) < limitZ) {
                  const penX = limitX - Math.abs(cur_dx);
                  const penZ = limitZ - Math.abs(cur_dz);
                  const signZ = (Math.abs(prev_dz) > 0.002 ? Math.sign(prev_dz) : Math.sign(cur_dz)) || 1;
                  const signX = Math.sign(cur_dx) || 1;

                  let pushVec;
                  if (penX < penZ && Math.abs(cur_dx) > 0.12) {
                    pushVec = [wallR[0] * penX * signX, wallR[1] * penX * signX, wallR[2] * penX * signX];
                  } else {
                    pushVec = [wallF[0] * penZ * signZ, wallF[1] * penZ * signZ, wallF[2] * penZ * signZ];
                  }

                  P_new[0] += pushVec[0] / groundRadius;
                  P_new[1] += pushVec[1] / groundRadius;
                  P_new[2] += pushVec[2] / groundRadius;

                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
                  vehicleCollidedWithStructure = true;
                }
              }
            } else {
              const dx = dx_vec_x * wallR[0] + dx_vec_y * wallR[1] + dx_vec_z * wallR[2];
              const dz = dx_vec_x * wallF[0] + dx_vec_y * wallF[1] + dx_vec_z * wallF[2];

              const isInsideDoorway = Math.abs(dx) < 0.065;
              const doorAngle = other.doorAngle || 0.0;
              const isDoorOpen = Math.abs(doorAngle) > 0.4 || (other.doorTargetAngle !== undefined && Math.abs(other.doorTargetAngle) > 0.4);

              // 1. Side post collisions (only block when player is walking into the outer frame/wall posts, NOT in the doorway)
              if (!isInsideDoorway && Math.abs(dz) < 0.04) {
                const postRadius = 0.012;
                const leftPostDx = dx - (-0.076);
                const rightPostDx = dx - 0.076;
                const collRad = postRadius + playerScale * 0.38;

                if (dx < 0) {
                  const leftDistSq = leftPostDx * leftPostDx + dz * dz;
                  if (leftDistSq < collRad * collRad) {
                    const dist = Math.sqrt(leftDistSq) || 1.0;
                    const pen = collRad - dist;
                    const pushX = (leftPostDx / dist) * pen;
                    const pushZ = (dz / dist) * pen;
                    const pushVec = [wallR[0] * pushX + wallF[0] * pushZ, wallR[1] * pushX + wallF[1] * pushZ, wallR[2] * pushX + wallF[2] * pushZ];
                    P_new[0] += pushVec[0] / groundRadius;
                    P_new[1] += pushVec[1] / groundRadius;
                    P_new[2] += pushVec[2] / groundRadius;
                  }
                } else {
                  const rightDistSq = rightPostDx * rightPostDx + dz * dz;
                  if (rightDistSq < collRad * collRad) {
                    const dist = Math.sqrt(rightDistSq) || 1.0;
                    const pen = collRad - dist;
                    const pushX = (rightPostDx / dist) * pen;
                    const pushZ = (dz / dist) * pen;
                    const pushVec = [wallR[0] * pushX + wallF[0] * pushZ, wallR[1] * pushX + wallF[1] * pushZ, wallR[2] * pushX + wallF[2] * pushZ];
                    P_new[0] += pushVec[0] / groundRadius;
                    P_new[1] += pushVec[1] / groundRadius;
                    P_new[2] += pushVec[2] / groundRadius;
                  }
                }
              }

              // 2. Door leaf interaction & collision
              if (!isDoorOpen) {
                // If player is walking towards / touching the closed door inside the doorway
                if (isInsideDoorway && Math.abs(dz) < 0.10) {
                  if (!other.isLocked) {
                    // Auto swing open in walking direction!
                    const openDir = (dz >= 0) ? -1.57 : 1.57;
                    other.doorTargetAngle = openDir;
                    other.doorOpenTimer = 1.0;
                    if (Math.abs(other.doorAngle) < 0.4) {
                      other.doorAngle = openDir * 0.45;
                    }
                    if (window._activeSwingingDoors) window._activeSwingingDoors.add(other);
                  }
                }
              }

              const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
              P_new[0] /= pLenTemp;
              P_new[1] /= pLenTemp;
              P_new[2] /= pLenTemp;
            }
          }
        }
      }
      // 5. COLLISION WITH ROBOT STAND PILLAR
      for (let other of nearbyCollectibles) {
        if (other.active && other.type === "robot_stand" && !other.isPreview) {
          if (other._centerRadius === undefined) {
            other._centerRadius = Math.sqrt(
              other.position[0] * other.position[0] +
              other.position[1] * other.position[1] +
              other.position[2] * other.position[2]
            );
          }
          const standCenterRadius = other._centerRadius;
          
          const standHeight = 0.70;
          const feetRadius = isRidingBoat ? (groundRadius - 0.22) : (groundRadius - 0.46 * playerScale);
          const headRadius = isRidingBoat ? (groundRadius + 0.42) : (groundRadius + 0.46 * playerScale);
          
          if (headRadius > standCenterRadius && feetRadius < standCenterRadius + standHeight) {
            const angle = other.angle || 0.0;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            
            const standR = [
              other.R[0] * cosA + other.F[0] * sinA,
              other.R[1] * cosA + other.F[1] * sinA,
              other.R[2] * cosA + other.F[2] * sinA
            ];
            const standF = [
              other.F[0] * cosA - other.R[0] * sinA,
              other.F[1] * cosA - other.R[1] * sinA,
              other.F[2] * cosA - other.R[2] * sinA
            ];
            
            // The pillar is at offset R: 0, F: -0.10 approx.
            const hw = 0.12;
            const hd = 0.12;
            const offsetF = -0.10;
            
            if (isRidingBoat) {
              for (let tp of structTestPoints) {
                const tpOff = [
                  boatF[0] * tp.fwd + boatR[0] * tp.side,
                  boatF[1] * tp.fwd + boatR[1] * tp.side,
                  boatF[2] * tp.fwd + boatR[2] * tp.side
                ];
                const curPt = [P_new[0] * groundRadius + tpOff[0], P_new[1] * groundRadius + tpOff[1], P_new[2] * groundRadius + tpOff[2]];
                const prevPt = [P_curr[0] * groundRadius + tpOff[0], P_curr[1] * groundRadius + tpOff[1], P_curr[2] * groundRadius + tpOff[2]];

                const cur_dx = (curPt[0]-other.position[0])*standR[0] + (curPt[1]-other.position[1])*standR[1] + (curPt[2]-other.position[2])*standR[2];
                const cur_dz = (curPt[0]-other.position[0])*standF[0] + (curPt[1]-other.position[1])*standF[1] + (curPt[2]-other.position[2])*standF[2] - offsetF;
                const prev_dz = (prevPt[0]-other.position[0])*standF[0] + (prevPt[1]-other.position[1])*standF[1] + (prevPt[2]-other.position[2])*standF[2] - offsetF;
                
                const limitX = hw + tp.rad;
                const limitZ = hd + tp.rad;

                if (Math.abs(cur_dx) < limitX && Math.abs(cur_dz) < limitZ) {
                  const penX = limitX - Math.abs(cur_dx);
                  const penZ = limitZ - Math.abs(cur_dz);
                  const signZ = (Math.abs(prev_dz) > 0.002 ? Math.sign(prev_dz) : Math.sign(cur_dz)) || 1;
                  const signX = Math.sign(cur_dx) || 1;

                  let pushVec;
                  if (penX < penZ) {
                    pushVec = [standR[0] * penX * signX, standR[1] * penX * signX, standR[2] * penX * signX];
                  } else {
                    pushVec = [standF[0] * penZ * signZ, standF[1] * penZ * signZ, standF[2] * penZ * signZ];
                  }

                  P_new[0] += pushVec[0] / groundRadius;
                  P_new[1] += pushVec[1] / groundRadius;
                  P_new[2] += pushVec[2] / groundRadius;

                  const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                  P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
                  vehicleCollidedWithStructure = true;
                }
              }
            } else {
              const p3x = P_new[0] * groundRadius;
              const p3y = P_new[1] * groundRadius;
              const p3z = P_new[2] * groundRadius;
              
              const dx_vec_x = p3x - other.position[0];
              const dx_vec_y = p3y - other.position[1];
              const dx_vec_z = p3z - other.position[2];
              
              const dx = dx_vec_x * standR[0] + dx_vec_y * standR[1] + dx_vec_z * standR[2];
              const dz = dx_vec_x * standF[0] + dx_vec_y * standF[1] + dx_vec_z * standF[2] - offsetF;
              
              const limitX = hw + playerScale * 0.38;
              const limitZ = hd + playerScale * 0.38;
              
              if (Math.abs(dx) < limitX && Math.abs(dz) < limitZ) {
                const penX = limitX - Math.abs(dx);
                const penZ = limitZ - Math.abs(dz);
                
                let pushVec;
                if (penX < penZ) {
                  const signX = Math.sign(dx) || 1;
                  pushVec = [standR[0] * penX * signX, standR[1] * penX * signX, standR[2] * penX * signX];
                } else {
                  const signZ = Math.sign(dz) || 1;
                  pushVec = [standF[0] * penZ * signZ, standF[1] * penZ * signZ, standF[2] * penZ * signZ];
                }
                
                P_new[0] += pushVec[0] / groundRadius;
                P_new[1] += pushVec[1] / groundRadius;
                P_new[2] += pushVec[2] / groundRadius;
                
                const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
                P_new[0] /= pLenTemp; P_new[1] /= pLenTemp; P_new[2] /= pLenTemp;
              }
            }
          }
        }
      }
    }

    if (vehicleCollidedWithStructure && isRidingBoat && activeRidingBoat) {
      if (activeRidingBoat.vehicleSpeed !== undefined) {
        activeRidingBoat.vehicleSpeed = 0;
      }
    }

    return vehicleCollidedWithStructure;
  }
};


// Maintain global function references for backward compatibility
checkCameraCollision = CollisionCore.checkCameraCollision;
resolveCameraCollision = CollisionCore.resolveCameraCollision;
checkCaveAndTerrainCollision = CollisionCore.checkCaveAndTerrainCollision;
closestPointOnTriangle = CollisionCore.closestPointOnTriangle;
resolveStructureCollisions = CollisionCore.resolveStructureCollisions;