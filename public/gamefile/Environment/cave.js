// === SEEDPLANET MODULE: JS/ENVIRONMENT/CAVE.JS ===

(function(global) {
  // WebGL context and capabilities reference
  let _gl = null;
  let _supportUint32 = false;

  // Buffer references
  let tunnelVertexBuffer = null;
  let tunnelColorBuffer = null;
  let tunnelTerrainRadiusBuffer = null;
  let tunnelCenterBuffer = null;
  let tunnelIndexBuffer = null;
  let tunnelWireframeIndexBuffer = null;

  let tunnelShellVertexBuffer = null;
  let tunnelShellColorBuffer = null;
  let tunnelShellTerrainRadiusBuffer = null;
  let tunnelShellCenterBuffer = null;
  let tunnelShellIndexBuffer = null;

  let tunnelIndicesCount = 0;
  let tunnelWireframeIndicesCount = 0;
  let tunnelShellIndicesCount = 0;

  // Spatial Index Grid
  let tunnels3DGrid = null;
  let tunnels3DGridCellSize = 1.5;

  // Reusable Float32Array for shader uniform calculations
  const f32_tunnelsData = new Float32Array(64 * 4);
  const tunnelsWithDistPool = [];

  function buildTunnelsGrid() {
    tunnels3DGrid = new Map();
    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) return;
    
    const cellSize = tunnels3DGridCellSize;
    const maxBuffer = 0.5; // safe margin
    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const maxR = t.r + maxBuffer;
      const minX = Math.floor((t.x - maxR) / cellSize);
      const maxX = Math.floor((t.x + maxR) / cellSize);
      const minY = Math.floor((t.y - maxR) / cellSize);
      const maxY = Math.floor((t.y + maxR) / cellSize);
      const minZ = Math.floor((t.z - maxR) / cellSize);
      const maxZ = Math.floor((t.z + maxR) / cellSize);
      
      for (let ix = minX; ix <= maxX; ix++) {
        for (let iy = minY; iy <= maxY; iy++) {
          for (let iz = minZ; iz <= maxZ; iz++) {
            const key = ix + "," + iy + "," + iz;
            if (!tunnels3DGrid.has(key)) {
              tunnels3DGrid.set(key, []);
            }
            tunnels3DGrid.get(key).push(t);
          }
        }
      }
    }
  }

  function isPositionInsideCave(x, y, z, buffer = 0) {
    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) return false;

    const dist = Math.sqrt(x*x + y*y + z*z);
    if (dist > 0.001) {
      const ux = x / dist;
      const uy = y / dist;
      const uz = z / dist;
      const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
      const phi = Math.atan2(uz, ux);
      
      let h = 0;
      if (typeof global.getHeightOnSphere === "function") {
        const seed = typeof global.globalSeed !== "undefined" ? global.globalSeed : 0;
        h = global.getHeightOnSphere(theta, phi, seed);
      }
      const r_planet = typeof global.RADIUS !== "undefined" ? global.RADIUS : 8.0;
      const h_scale = typeof global.HEIGHT_SCALE !== "undefined" ? global.HEIGHT_SCALE : 0.6;
      const terrainRadius = r_planet + h * h_scale;
      
      if (dist > terrainRadius + 1.0) {
        return false;
      }
    }

    if (!tunnels3DGrid) {
      buildTunnelsGrid();
    }

    if (tunnels3DGrid) {
      const cellSize = tunnels3DGridCellSize;
      const ix = Math.floor(x / cellSize);
      const iy = Math.floor(y / cellSize);
      const iz = Math.floor(z / cellSize);
      const key = ix + "," + iy + "," + iz;
      const list = tunnels3DGrid.get(key);
      if (list) {
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          const dx = x - t.x;
          const dy = y - t.y;
          const dz = z - t.z;
          const limit = t.r + buffer;
          if (dx * dx + dy * dy + dz * dz < limit * limit) {
            return true;
          }
        }
      }
      return false;
    }

    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const dx = x - t.x;
      const dy = y - t.y;
      const dz = z - t.z;
      const limit = t.r + buffer;
      if (dx * dx + dy * dy + dz * dz < limit * limit) {
        return true;
      }
    }
    return false;
  }

  function generateSubterraneanCaves(seed) {
    if (!global.tunnels3D) global.tunnels3D = [];
    if (global.tunnels3D.length > 0) return;

    let currentSeed = seed + 48123;
    function sRand() {
      const x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    }

    const planetRadius = typeof global.RADIUS !== "undefined" ? global.RADIUS : 8.0;
    const heightScale = typeof global.HEIGHT_SCALE !== "undefined" ? global.HEIGHT_SCALE : (0.6 * Math.pow(planetRadius / 8.0, 0.70));
    const rRatio = Math.max(0.4, planetRadius / 8.0);
    
    // Scale number of caves with planet surface area (from small moons to giant planets)
    const numCaveSystems = Math.min(60, Math.max(3, Math.floor((5 + Math.floor(sRand() * 3)) * Math.pow(rRatio, 1.25))));
    const waterH = typeof global.waterLevel !== "undefined" ? (global.waterLevel * 0.15) : 0.05;

    // Use Fibonacci spiral for uniform spherical distribution around the planet
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let sys = 0; sys < numCaveSystems; sys++) {
      // Human-scale entrance and interior sizes (playable across any planet radius)
      const entranceSize = 0.36 + sRand() * 0.16;
      const interiorSize = 0.46 + sRand() * 0.22;

      const i = sys + 0.5;
      const phi_dist = 2 * Math.PI * i / goldenRatio;
      const cosTheta_dist = 1 - (2 * i) / numCaveSystems;
      const theta_dist = Math.acos(Math.max(-1.0, Math.min(1.0, cosTheta_dist)));

      // Add gentle random angular offset
      const theta = Math.max(0.08, Math.min(Math.PI - 0.08, theta_dist + (sRand() - 0.5) * 0.25));
      const phi = phi_dist + (sRand() - 0.5) * 0.35;

      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);

      const h = typeof global.getHeightOnSphere === "function" ? global.getHeightOnSphere(theta, phi, seed) : 0.5;
      
      // Ensure cave entrance is generated on dry land / hills (above ocean water level)
      if (h < waterH + 0.03) {
        continue;
      }

      const surfRad = planetRadius + h * heightScale;

      let rx, ry, rz;
      if (Math.abs(ny) < 0.9) {
        rx = -nz; ry = 0; rz = nx;
      } else {
        rx = 1; ry = 0; rz = 0;
      }
      const lenR = Math.sqrt(rx*rx + ry*ry + rz*rz) || 1;
      const tx_u = rx / lenR, ty_u = ry / lenR, tz_u = rz / lenR;

      const bx_u = ty_u * nz - tz_u * ny;
      const by_u = tz_u * nx - tx_u * nz;
      const bz_u = tx_u * ny - ty_u * nx;

      const numSteps = 26 + Math.floor(sRand() * 22);
      const stepDist = 0.15 + sRand() * 0.08;

      let px = nx * (surfRad + 0.02);
      let py = ny * (surfRad + 0.02);
      let pz = nz * (surfRad + 0.02);
      let walkTheta = sRand() * Math.PI * 2;

      for (let step = 0; step < numSteps; step++) {
        const lenP = Math.sqrt(px*px + py*py + pz*pz) || 1;
        const upX = px / lenP;
        const upY = py / lenP;
        const upZ = pz / lenP;

        let r_walk_x, r_walk_y, r_walk_z;
        if (Math.abs(upY) < 0.9) {
          r_walk_x = -upZ; r_walk_y = 0; r_walk_z = upX;
        } else {
          r_walk_x = 1; r_walk_y = 0; r_walk_z = 0;
        }
        const lenW = Math.sqrt(r_walk_x*r_walk_x + r_walk_y*r_walk_y + r_walk_z*r_walk_z) || 1;
        const t_x = r_walk_x / lenW, t_y = r_walk_y / lenW, t_z = r_walk_z / lenW;

        const b_x = t_y * upZ - t_z * upY;
        const b_y = t_z * upX - t_x * upZ;
        const b_z = t_x * upY - t_y * upX;

        walkTheta += (sRand() - 0.5) * 1.1;

        const stepX = t_x * Math.cos(walkTheta) + b_x * Math.sin(walkTheta);
        const stepY = t_y * Math.cos(walkTheta) + b_y * Math.sin(walkTheta);
        const stepZ = t_z * Math.cos(walkTheta) + b_z * Math.sin(walkTheta);
        const targetDepthFraction = step / (numSteps - 1 || 1);
        
        let targetSubDepth;
        if (targetDepthFraction < 0.22) {
            targetSubDepth = 0.02 + (targetDepthFraction / 0.22) * 0.75;
        } else {
            const midFrac = (targetDepthFraction - 0.22) / 0.78;
            targetSubDepth = 0.77 + Math.sin(midFrac * Math.PI) * 0.55;
        }

        const currTheta = Math.acos(Math.max(-1.0, Math.min(1.0, upY)));
        const currPhi = Math.atan2(upZ, upX);
        const currSurfHeight = typeof global.getHeightOnSphere === "function" ? global.getHeightOnSphere(currTheta, currPhi, seed) : 0.5;
        const currSurfRad = planetRadius + currSurfHeight * heightScale;
        const targetRad = Math.max(planetRadius * 0.5, currSurfRad - targetSubDepth);

        let nextPx = px + stepX * stepDist;
        let nextPy = py + stepY * stepDist;
        let nextPz = pz + stepZ * stepDist;
        const nextLen = Math.sqrt(nextPx*nextPx + nextPy*nextPy + nextPz*nextPz) || 1;
        const nextUpX = nextPx / nextLen;
        const nextUpY = nextPy / nextLen;
        const nextUpZ = nextPz / nextLen;

        px = nextUpX * targetRad;
        py = nextUpY * targetRad;
        pz = nextUpZ * targetRad;

        let baseR;
        if (targetDepthFraction < 0.18) {
            const t = targetDepthFraction / 0.18;
            baseR = entranceSize + (interiorSize - entranceSize) * Math.sin(t * Math.PI / 2);
        } else {
            const t = (targetDepthFraction - 0.18) / 0.82;
            baseR = interiorSize - (t * 0.08);
        }
        const mult = (typeof global.voxelHoleRadiusMultiplier === "number") ? global.voxelHoleRadiusMultiplier : 1.0;
        const sphereR = (baseR + (sRand() - 0.5) * 0.06) * mult;

        global.tunnels3D.push({
          x: px,
          y: py,
          z: pz,
          r: sphereR,
          rSq: sphereR * sphereR
        });
      }
    }
    buildTunnelsGrid();
    rebuildTunnelBuffers();
  }

  // --- Precomputed Static Index Templates ---
  const LAT_SEG = 14;
  const LONG_SEG = 14;
  const N_COLLAR = 32;

  // Base sphere indices (length = 14 * 14 * 6 = 1176)
  const baseSphereIndices = new Uint16Array(LAT_SEG * LONG_SEG * 6);
  let bIdx = 0;
  for (let lat = 0; lat < LAT_SEG; lat++) {
    for (let lon = 0; lon < LONG_SEG; lon++) {
      const first = lat * (LONG_SEG + 1) + lon;
      const second = first + LONG_SEG + 1;
      baseSphereIndices[bIdx++] = first;
      baseSphereIndices[bIdx++] = first + 1;
      baseSphereIndices[bIdx++] = second;
      baseSphereIndices[bIdx++] = first + 1;
      baseSphereIndices[bIdx++] = second + 1;
      baseSphereIndices[bIdx++] = second;
    }
  }

  // Base shell indices (length = 14 * 14 * 6 = 1176)
  const baseShellIndices = new Uint16Array(LAT_SEG * LONG_SEG * 6);
  let bsIdx = 0;
  for (let lat = 0; lat < LAT_SEG; lat++) {
    for (let lon = 0; lon < LONG_SEG; lon++) {
      const first = lat * (LONG_SEG + 1) + lon;
      const second = first + LONG_SEG + 1;
      baseShellIndices[bsIdx++] = first;
      baseShellIndices[bsIdx++] = second;
      baseShellIndices[bsIdx++] = first + 1;
      baseShellIndices[bsIdx++] = first + 1;
      baseShellIndices[bsIdx++] = second;
      baseShellIndices[bsIdx++] = second + 1;
    }
  }

  // Base collar indices (length = 32 * 6 = 192)
  const baseCollarIndices = new Uint16Array(N_COLLAR * 6);
  let bcIdx = 0;
  for (let i = 0; i < N_COLLAR; i++) {
    const next_i = (i + 1) % N_COLLAR;
    const outer_curr = 2 * i;
    const inner_curr = 2 * i + 1;
    const outer_next = 2 * next_i;
    const inner_next = 2 * next_i + 1;
    baseCollarIndices[bcIdx++] = outer_curr;
    baseCollarIndices[bcIdx++] = outer_next;
    baseCollarIndices[bcIdx++] = inner_curr;
    baseCollarIndices[bcIdx++] = outer_next;
    baseCollarIndices[bcIdx++] = inner_next;
    baseCollarIndices[bcIdx++] = inner_curr;
  }

  // Memoized Unit Sphere Template (depends on globalSeed for FBM deformation)
  let cachedSeedForDeforms = null;
  let cachedTempVerts = null;
  let cachedTempDeforms = null;

  function getBaseUnitSphere() {
    const seed = global.globalSeed;
    if (cachedTempVerts && cachedSeedForDeforms === seed) {
      return { tempVerts: cachedTempVerts, tempDeforms: cachedTempDeforms };
    }
    const tempVerts = [];
    const tempDeforms = [];
    for (let lat = 0; lat <= LAT_SEG; lat++) {
      const theta = (lat / LAT_SEG) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let lon = 0; lon <= LONG_SEG; lon++) {
        const phi = (lon / LONG_SEG) * Math.PI * 2;
        const sinP = Math.sin(phi);
        const cosP = Math.cos(phi);
        const x = sinT * cosP;
        const y = cosT;
        const z = sinT * sinP;
        tempVerts.push([x, y, z]);
        const deform = global.fbmNoise(x * 3.5, y * 3.5, z * 3.5, seed + 721, 3) * 0.15;
        tempDeforms.push(deform);
      }
    }
    cachedSeedForDeforms = seed;
    cachedTempVerts = tempVerts;
    cachedTempDeforms = tempDeforms;
    return { tempVerts, tempDeforms };
  }

  // --- Per-Tunnel Mesh Cache ---
  // Using WeakMap avoids any memory leak and prevents JSON.stringify issues during savegame
  let lastMeshCacheSeed = null;
  let tunnelMeshCache = new WeakMap();

  function clearTunnelMeshCache() {
    tunnelMeshCache = new WeakMap();
    lastMeshCacheSeed = null;
  }

  function getCaveStrataColor(px, py, pz, strataDepth = null) {
    let depth = strataDepth;
    if (depth === null) {
      const len = Math.sqrt(px * px + py * py + pz * pz) || 1;
      const ux = px / len;
      const uy = py / len;
      const uz = pz / len;
      const theta = Math.acos(Math.max(-1, Math.min(1, uy)));
      const phi = Math.atan2(uz, ux);
      const surfHeight = global.getHeightOnSphere(theta, phi, global.globalSeed);
      const surfRad = global.RADIUS + surfHeight * global.HEIGHT_SCALE;
      depth = surfRad - len;
    }

    const warp = global.fbmNoise(px * 1.8, py * 1.8, pz * 1.8, global.globalSeed + 99, 2) * 0.04;
    const warpedDepth = depth + warp;

    const cSoil = [0.24, 0.16, 0.11];
    const cSand = [0.83, 0.70, 0.49];
    const cStone = [0.49, 0.55, 0.57];
    const cDeep  = [0.81, 0.63, 0.57];

    const d1 = 0.08;
    const d2 = 0.13;
    const d3 = 0.22;
    const d4 = 0.28;
    const d5 = 0.42;
    const d6 = 0.48;

    let rVal, gVal, bVal;

    if (warpedDepth <= d1) {
      rVal = cSoil[0]; gVal = cSoil[1]; bVal = cSoil[2];
    } else if (warpedDepth < d2) {
      const t = (warpedDepth - d1) / (d2 - d1);
      const st = t * t * (3 - 2 * t);
      rVal = cSoil[0] * (1 - st) + cSand[0] * st;
      gVal = cSoil[1] * (1 - st) + cSand[1] * st;
      bVal = cSoil[2] * (1 - st) + cSand[2] * st;
    } else if (warpedDepth <= d3) {
      rVal = cSand[0]; gVal = cSand[1]; bVal = cSand[2];
    } else if (warpedDepth < d4) {
      const t = (warpedDepth - d3) / (d4 - d3);
      const st = t * t * (3 - 2 * t);
      rVal = cSand[0] * (1 - st) + cStone[0] * st;
      gVal = cSand[1] * (1 - st) + cStone[1] * st;
      bVal = cSand[2] * (1 - st) + cStone[2] * st;
    } else if (warpedDepth <= d5) {
      rVal = cStone[0]; gVal = cStone[1]; bVal = cStone[2];
    } else {
      const t = Math.max(0, Math.min(1, (warpedDepth - d5) / (d6 - d5)));
      const st = t * t * (3 - 2 * t);
      rVal = cStone[0] * (1 - st) + cDeep[0] * st;
      gVal = cStone[1] * (1 - st) + cDeep[1] * st;
      bVal = cStone[2] * (1 - st) + cDeep[2] * st;
    }

    const grain = (global.fbmNoise(px * 150, py * 150, pz * 150, global.globalSeed + 99, 1) + 1.0) * 0.5;
    const grainFactor = 0.90 + grain * 0.16;

    return [
      Math.max(0.02, Math.min(1.0, rVal * grainFactor)),
      Math.max(0.02, Math.min(1.0, gVal * grainFactor)),
      Math.max(0.02, Math.min(1.0, bVal * grainFactor))
    ];
  }

  function computeTunnelGeometry(t, tempVerts, tempDeforms) {
    const cx = t.x;
    const cy = t.y;
    const cz = t.z;
    const r = t.r;
    const vertsCount = tempVerts.length; // 225

    const vertices = new Float32Array(vertsCount * 3);
    const colors = new Float32Array(vertsCount * 3);
    const terrainRadii = new Float32Array(vertsCount);
    const centers = new Float32Array(vertsCount * 3);
    const localIsLid = new Uint8Array(vertsCount);

    const rPlanet = typeof global.RADIUS !== 'undefined' ? global.RADIUS : 8.0;
    const hScale = typeof global.HEIGHT_SCALE !== 'undefined' ? global.HEIGHT_SCALE : 0.6;
    const gSeed = global.globalSeed;
    const blendRange = r * 0.45;
    const hasFloorTopRadius = typeof global.getFloorTopRadiusAt === "function";

    for (let vIdx = 0; vIdx < vertsCount; vIdx++) {
      const v = tempVerts[vIdx];
      const deform = tempDeforms[vIdx];
      const deformedR = r * (1.0 + deform);

      let px = cx + v[0] * deformedR;
      let py = cy + v[1] * deformedR;
      let pz = cz + v[2] * deformedR;

      const distToCenter = Math.sqrt(px * px + py * py + pz * pz) || 1;
      const ux = px / distToCenter;
      const uy = py / distToCenter;
      const uz = pz / distToCenter;

      const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
      const phi = Math.atan2(uz, ux);
      const { height, color: terrainColor } = global.getTerrainHeightAndColor(theta, phi, gSeed);
      let terrainRadius = rPlanet + height * hScale;
      if (hasFloorTopRadius) {
        terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
      }

      const depth = terrainRadius - distToCenter;
      let finalPx = px;
      let finalPy = py;
      let finalPz = pz;
      let finalDistToCenter = distToCenter;

      if (depth <= 0.0) {
        finalPx = ux * terrainRadius;
        finalPy = uy * terrainRadius;
        finalPz = uz * terrainRadius;
        finalDistToCenter = terrainRadius;
      } else if (depth < blendRange) {
        const blendT = depth / blendRange;
        const smooth_t = blendT * blendT * (3 - 2 * blendT);
        const blendedRadius = terrainRadius * (1 - smooth_t) + distToCenter * smooth_t;
        finalPx = ux * blendedRadius;
        finalPy = uy * blendedRadius;
        finalPz = uz * blendedRadius;
        finalDistToCenter = blendedRadius;
      }

      const baseIdx3 = vIdx * 3;
      vertices[baseIdx3] = finalPx;
      vertices[baseIdx3 + 1] = finalPy;
      vertices[baseIdx3 + 2] = finalPz;

      localIsLid[vIdx] = depth <= 0.0 ? 1 : 0;
      terrainRadii[vIdx] = terrainRadius;

      centers[baseIdx3] = cx;
      centers[baseIdx3 + 1] = cy;
      centers[baseIdx3 + 2] = cz;

      const shadowFactor = Math.max(0.12, Math.min(1.0, 1.0 - (Math.max(0.0, depth) / (r * 1.5))));
      const strataDepth = (rPlanet + height * hScale) - finalDistToCenter;
      const caveColor = getCaveStrataColor(finalPx, finalPy, finalPz, strataDepth);

      let colorWeight = 1.0;
      if (depth < blendRange) {
        const c_t = Math.max(0.0, depth / blendRange);
        colorWeight = c_t * c_t * (3 - 2 * c_t);
      }

      const noiseVal = (Math.sin(finalPx * 35) * Math.cos(finalPy * 35) + Math.cos(finalPz * 35)) * 0.04;
      const blendedR = terrainColor[0] * (1 - colorWeight) + caveColor[0] * colorWeight;
      const blendedG = terrainColor[1] * (1 - colorWeight) + caveColor[1] * colorWeight;
      const blendedB = terrainColor[2] * (1 - colorWeight) + caveColor[2] * colorWeight;

      colors[baseIdx3] = Math.max(0.02, Math.min(0.8, (blendedR + noiseVal) * shadowFactor));
      colors[baseIdx3 + 1] = Math.max(0.02, Math.min(0.8, (blendedG + noiseVal) * shadowFactor));
      colors[baseIdx3 + 2] = Math.max(0.02, Math.min(0.8, (blendedB + noiseVal) * shadowFactor));
    }

    // Local collision indices
    const localColIndices = [];
    for (let lat = 0; lat < LAT_SEG; lat++) {
      for (let lon = 0; lon < LONG_SEG; lon++) {
        const first = lat * (LONG_SEG + 1) + lon;
        const second = first + LONG_SEG + 1;
        if (!localIsLid[first] || !localIsLid[second] || !localIsLid[first + 1]) {
          localColIndices.push(first, first + 1, second);
        }
        if (!localIsLid[first + 1] || !localIsLid[second] || !localIsLid[second + 1]) {
          localColIndices.push(first + 1, second + 1, second);
        }
      }
    }
    const localCollisionIndices = new Uint16Array(localColIndices);

    // Collar check
    const d = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    const ux = cx / d;
    const uy = cy / d;
    const uz = cz / d;
    const thetaCollar = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
    const phiCollar = Math.atan2(uz, ux);
    const heightCollar = global.getHeightOnSphere(thetaCollar, phiCollar, gSeed);
    let terrainRadiusCollar = rPlanet + heightCollar * hScale;
    if (hasFloorTopRadius) {
      terrainRadiusCollar = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadiusCollar);
    }

    const depthCollar = terrainRadiusCollar - d;
    let exposed = false;
    if (Math.abs(depthCollar) < r * 2.5) exposed = true;

    if (!exposed) {
      const r_sample = r * 1.5;
      const samples = [
        { x: cx + r_sample, y: cy, z: cz },
        { x: cx - r_sample, y: cy, z: cz },
        { x: cx, y: cy + r_sample, z: cz },
        { x: cx, y: cy - r_sample, z: cz },
        { x: cx, y: cy, z: cz + r_sample },
        { x: cx, y: cy, z: cz - r_sample }
      ];
      for (let s of samples) {
        const sd = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) || 1;
        const sux = s.x / sd;
        const suy = s.y / sd;
        const suz = s.z / sd;
        const stheta = Math.acos(Math.max(-1.0, Math.min(1.0, suy)));
        const sphi = Math.atan2(suz, sux);
        let sh = rPlanet + global.getHeightOnSphere(stheta, sphi, gSeed) * hScale;
        if (hasFloorTopRadius) sh = global.getFloorTopRadiusAt(sux, suy, suz, sh);
        if (sh < sd || Math.abs(sh - sd) < r * 1.5) {
          exposed = true;
          break;
        }
      }
    }

    let collarVertices = null;
    let collarColors = null;
    let collarRadii = null;
    let collarCenters = null;

    if (exposed) {
      const N = N_COLLAR;
      collarVertices = new Float32Array(2 * N * 3);
      collarColors = new Float32Array(2 * N * 3);
      collarRadii = new Float32Array(2 * N);
      collarCenters = new Float32Array(2 * N * 3);

      let rx, ry, rz;
      if (Math.abs(uy) < 0.9) {
        rx = -uz; ry = 0; rz = ux;
      } else {
        rx = 1; ry = 0; rz = 0;
      }
      const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
      const rX = rx / lenR;
      const rY = ry / lenR;
      const rZ = rz / lenR;

      const fX = rY * uz - rZ * uy;
      const fY = rZ * ux - rX * uz;
      const fZ = rX * uy - rY * ux;

      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const dx = rX * cosA + fX * sinA;
        const dy = rY * cosA + fY * sinA;
        const dz = rZ * cosA + fZ * sinA;

        const px_outer = cx + dx * (r * 1.08);
        const py_outer = cy + dy * (r * 1.08);
        const pz_outer = cz + dz * (r * 1.08);

        const d_outer = Math.sqrt(px_outer * px_outer + py_outer * py_outer + pz_outer * pz_outer) || 1;
        const ux_outer = px_outer / d_outer;
        const uy_outer = py_outer / d_outer;
        const uz_outer = pz_outer / d_outer;

        const theta_outer = Math.acos(Math.max(-1.0, Math.min(1.0, uy_outer)));
        const phi_outer = Math.atan2(uz_outer, ux_outer);
        const h_outer = global.getHeightOnSphere(theta_outer, phi_outer, gSeed);
        let r_outer = rPlanet + h_outer * hScale;
        if (hasFloorTopRadius) {
          r_outer = global.getFloorTopRadiusAt(ux_outer, uy_outer, uz_outer, r_outer);
        }

        const V_outer_x = ux_outer * r_outer;
        const V_outer_y = uy_outer * r_outer;
        const V_outer_z = uz_outer * r_outer;

        const V_inner_x = cx + dx * (r * 0.85) - ux * (r * 0.3);
        const V_inner_y = cy + dy * (r * 0.85) - uy * (r * 0.3);
        const V_inner_z = cz + dz * (r * 0.85) - uz * (r * 0.3);

        const distToCenter_inner = Math.sqrt(V_inner_x * V_inner_x + V_inner_y * V_inner_y + V_inner_z * V_inner_z) || 1;

        const outerIdx = 2 * i;
        const innerIdx = 2 * i + 1;
        const outerIdx3 = outerIdx * 3;
        const innerIdx3 = innerIdx * 3;

        collarVertices[outerIdx3] = V_outer_x;
        collarVertices[outerIdx3 + 1] = V_outer_y;
        collarVertices[outerIdx3 + 2] = V_outer_z;
        collarRadii[outerIdx] = -r_outer;
        collarCenters[outerIdx3] = cx;
        collarCenters[outerIdx3 + 1] = cy;
        collarCenters[outerIdx3 + 2] = cz;

        const { color: terrainColor } = global.getTerrainHeightAndColor(theta_outer, phi_outer, gSeed);
        collarColors[outerIdx3] = terrainColor[0];
        collarColors[outerIdx3 + 1] = terrainColor[1];
        collarColors[outerIdx3 + 2] = terrainColor[2];

        collarVertices[innerIdx3] = V_inner_x;
        collarVertices[innerIdx3 + 1] = V_inner_y;
        collarVertices[innerIdx3 + 2] = V_inner_z;
        collarRadii[innerIdx] = -terrainRadiusCollar;
        collarCenters[innerIdx3] = cx;
        collarCenters[innerIdx3 + 1] = cy;
        collarCenters[innerIdx3 + 2] = cz;

        const shadowFactor = Math.max(0.12, Math.min(1.0, 1.0 - (Math.max(0.0, terrainRadiusCollar - distToCenter_inner) / (r * 1.5))));
        const innerStrataDepth = (rPlanet + h_outer * hScale) - distToCenter_inner;
        const strataColorInner = getCaveStrataColor(V_inner_x, V_inner_y, V_inner_z, innerStrataDepth);
        const noise = (Math.sin(V_inner_x * 35) * Math.cos(V_inner_y * 35) + Math.cos(V_inner_z * 35)) * 0.04;

        collarColors[innerIdx3] = Math.max(0.02, Math.min(0.8, (strataColorInner[0] + noise) * shadowFactor));
        collarColors[innerIdx3 + 1] = Math.max(0.02, Math.min(0.8, (strataColorInner[1] + noise) * shadowFactor));
        collarColors[innerIdx3 + 2] = Math.max(0.02, Math.min(0.8, (strataColorInner[2] + noise) * shadowFactor));
      }
    }

    // Shell Geometry
    const shellVertices = new Float32Array(vertsCount * 3);
    const shellColors = new Float32Array(vertsCount * 3);
    const shellTerrainRadii = new Float32Array(vertsCount);
    const shellCenters = new Float32Array(vertsCount * 3);
    const shellR = r * 1.32;

    for (let vIdx = 0; vIdx < vertsCount; vIdx++) {
      const v = tempVerts[vIdx];
      const deform = tempDeforms[vIdx];
      const deformedR = shellR * (1.0 + deform);

      let px = cx + v[0] * deformedR;
      let py = cy + v[1] * deformedR;
      let pz = cz + v[2] * deformedR;

      const distToCenter = Math.sqrt(px * px + py * py + pz * pz) || 1;
      const ux = px / distToCenter;
      const uy = py / distToCenter;
      const uz = pz / distToCenter;

      const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
      const phi = Math.atan2(uz, ux);
      const { height, color: terrainColor } = global.getTerrainHeightAndColor(theta, phi, gSeed);
      let terrainRadius = rPlanet + height * hScale;
      if (hasFloorTopRadius) {
        terrainRadius = global.getFloorTopRadiusAt(ux, uy, uz, terrainRadius);
      }

      const depth = terrainRadius - distToCenter;
      let finalPx = px;
      let finalPy = py;
      let finalPz = pz;
      if (depth <= 0.0) {
        finalPx = ux * terrainRadius;
        finalPy = uy * terrainRadius;
        finalPz = uz * terrainRadius;
      }

      const baseIdx3 = vIdx * 3;
      shellVertices[baseIdx3] = finalPx;
      shellVertices[baseIdx3 + 1] = finalPy;
      shellVertices[baseIdx3 + 2] = finalPz;

      const strataDepth = (rPlanet + height * hScale) - distToCenter;
      const strataColor = getCaveStrataColor(finalPx, finalPy, finalPz, strataDepth);
      const blendT = Math.max(0.0, Math.min(1.0, Math.max(0.0, depth) / (r * 0.6)));
      const smoothBlend = blendT * blendT * (3 - 2 * blendT);
      const noiseVal = (Math.sin(finalPx * 35) * Math.cos(finalPy * 35) + Math.cos(finalPz * 35)) * 0.04;

      shellColors[baseIdx3] = Math.max(0.02, Math.min(0.85, (terrainColor[0] * (1 - smoothBlend) + strataColor[0] * smoothBlend + noiseVal)));
      shellColors[baseIdx3 + 1] = Math.max(0.02, Math.min(0.85, (terrainColor[1] * (1 - smoothBlend) + strataColor[1] * smoothBlend + noiseVal)));
      shellColors[baseIdx3 + 2] = Math.max(0.02, Math.min(0.85, (terrainColor[2] * (1 - smoothBlend) + strataColor[2] * smoothBlend + noiseVal)));

      shellTerrainRadii[vIdx] = -terrainRadius;
      shellCenters[baseIdx3] = cx;
      shellCenters[baseIdx3 + 1] = cy;
      shellCenters[baseIdx3 + 2] = cz;
    }

    return {
      vertices,
      colors,
      terrainRadii,
      centers,
      localCollisionIndices,
      hasCollar: exposed,
      collarVertices,
      collarColors,
      collarRadii,
      collarCenters,
      shellVertices,
      shellColors,
      shellTerrainRadii,
      shellCenters
    };
  }

  function rebuildTunnelBuffers(gl, supportUint32) {
    const glCtx = gl || _gl || global.gl;
    const uint32Supported = (typeof supportUint32 !== 'undefined') ? supportUint32 : ((typeof _supportUint32 !== 'undefined' ? _supportUint32 : false) || global.supportUint32);

    const tunnels = global.tunnels3D || [];
    if (!tunnels || tunnels.length === 0) {
      tunnelIndicesCount = 0;
      tunnelWireframeIndicesCount = 0;
      tunnelShellIndicesCount = 0;
      return;
    }

    // Seed change invalidates cache
    if (lastMeshCacheSeed !== global.globalSeed) {
      clearTunnelMeshCache();
      lastMeshCacheSeed = global.globalSeed;
    }

    const { tempVerts, tempDeforms } = getBaseUnitSphere();

    // 1. Ensure all tunnels have cached mesh data (when digging, only 1 new tunnel is computed!)
    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      if (!tunnelMeshCache.has(t)) {
        const mesh = computeTunnelGeometry(t, tempVerts, tempDeforms);
        tunnelMeshCache.set(t, mesh);
      }
    }

    // 2. Pre-calculate total sizes for flat TypedArrays
    const totalSphereVerts = tunnels.length * 225;
    let totalCollarCount = 0;
    let totalCollarVerts = 0;
    let totalCollisionIndicesCount = 0;

    for (let i = 0; i < tunnels.length; i++) {
      const m = tunnelMeshCache.get(tunnels[i]);
      totalCollisionIndicesCount += m.localCollisionIndices.length;
      if (m.hasCollar) {
        totalCollarCount++;
        totalCollarVerts += 2 * N_COLLAR;
        totalCollisionIndicesCount += N_COLLAR * 6;
      }
    }

    const totalMainVerts = totalSphereVerts + totalCollarVerts;
    const totalMainIndices = tunnels.length * (LAT_SEG * LONG_SEG * 6) + totalCollarCount * (N_COLLAR * 6);
    const totalShellVerts = tunnels.length * 225;
    const totalShellIndices = tunnels.length * (LAT_SEG * LONG_SEG * 6);

    const vertices = new Float32Array(totalMainVerts * 3);
    const colors = new Float32Array(totalMainVerts * 3);
    const terrainRadii = new Float32Array(totalMainVerts);
    const centers = new Float32Array(totalMainVerts * 3);
    const useUint32 = uint32Supported && totalMainIndices > 65535;
    const indices = useUint32 ? new Uint32Array(totalMainIndices) : new Uint16Array(totalMainIndices);
    const useUint32Col = uint32Supported && totalCollisionIndicesCount > 65535;
    const collisionIndices = useUint32Col ? new Uint32Array(totalCollisionIndicesCount) : new Uint16Array(totalCollisionIndicesCount);

    let vOffset = 0;
    let idxOffset = 0;
    let colIdxOffset = 0;
    let baseVIdx = 0;

    // 3. Assemble Sphere Geometry
    const sphereIndicesLen = LAT_SEG * LONG_SEG * 6;
    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      t.startIndex = idxOffset;
      const m = tunnelMeshCache.get(t);

      vertices.set(m.vertices, vOffset * 3);
      colors.set(m.colors, vOffset * 3);
      terrainRadii.set(m.terrainRadii, vOffset);
      centers.set(m.centers, vOffset * 3);

      for (let k = 0; k < sphereIndicesLen; k++) {
        indices[idxOffset++] = baseVIdx + baseSphereIndices[k];
      }

      const lci = m.localCollisionIndices;
      const lciLen = lci.length;
      for (let k = 0; k < lciLen; k++) {
        collisionIndices[colIdxOffset++] = baseVIdx + lci[k];
      }

      t.endIndex = colIdxOffset;
      baseVIdx += 225;
      vOffset += 225;
    }

    // 4. Assemble Collar Geometry
    const collarIndicesLen = N_COLLAR * 6;
    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const m = tunnelMeshCache.get(t);
      if (m.hasCollar) {
        const collarStartIdx = baseVIdx;

        vertices.set(m.collarVertices, vOffset * 3);
        colors.set(m.collarColors, vOffset * 3);
        terrainRadii.set(m.collarRadii, vOffset);
        centers.set(m.collarCenters, vOffset * 3);

        for (let k = 0; k < collarIndicesLen; k++) {
          const idx = collarStartIdx + baseCollarIndices[k];
          indices[idxOffset++] = idx;
          collisionIndices[colIdxOffset++] = idx;
        }

        baseVIdx += 2 * N_COLLAR;
        vOffset += 2 * N_COLLAR;
      }
    }

    // 5. Assemble Shell Geometry
    const shellVertices = new Float32Array(totalShellVerts * 3);
    const shellColors = new Float32Array(totalShellVerts * 3);
    const shellTerrainRadii = new Float32Array(totalShellVerts);
    const shellCenters = new Float32Array(totalShellVerts * 3);
    const useUint32Shell = uint32Supported && totalShellVerts > 65535;
    const shellIndices = useUint32Shell ? new Uint32Array(totalShellIndices) : new Uint16Array(totalShellIndices);

    let sVOffset = 0;
    let sIdxOffset = 0;
    let sBaseVIdx = 0;

    for (let i = 0; i < tunnels.length; i++) {
      const t = tunnels[i];
      const m = tunnelMeshCache.get(t);

      shellVertices.set(m.shellVertices, sVOffset * 3);
      shellColors.set(m.shellColors, sVOffset * 3);
      shellTerrainRadii.set(m.shellTerrainRadii, sVOffset);
      shellCenters.set(m.shellCenters, sVOffset * 3);

      for (let k = 0; k < sphereIndicesLen; k++) {
        shellIndices[sIdxOffset++] = sBaseVIdx + baseShellIndices[k];
      }

      sBaseVIdx += 225;
      sVOffset += 225;
    }

    // 6. Fast WebGL Buffer Uploads
    if (glCtx) {
      if (tunnelVertexBuffer) glCtx.deleteBuffer(tunnelVertexBuffer);
      if (tunnelColorBuffer) glCtx.deleteBuffer(tunnelColorBuffer);
      if (tunnelTerrainRadiusBuffer) glCtx.deleteBuffer(tunnelTerrainRadiusBuffer);
      if (tunnelCenterBuffer) glCtx.deleteBuffer(tunnelCenterBuffer);
      if (tunnelIndexBuffer) glCtx.deleteBuffer(tunnelIndexBuffer);
      if (tunnelWireframeIndexBuffer) glCtx.deleteBuffer(tunnelWireframeIndexBuffer);

      tunnelVertexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelVertexBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, vertices, glCtx.STATIC_DRAW);

      tunnelColorBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelColorBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, colors, glCtx.STATIC_DRAW);

      tunnelTerrainRadiusBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, terrainRadii, glCtx.STATIC_DRAW);

      tunnelCenterBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelCenterBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, centers, glCtx.STATIC_DRAW);

      tunnelIndexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelIndexBuffer);
      glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, indices, glCtx.STATIC_DRAW);
      tunnelIndicesCount = indices.length;

      const wireframeIndices = useUint32 ? new Uint32Array(indices.length * 2) : new Uint16Array(indices.length * 2);
      let wIdx = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i];
        const i2 = indices[i + 1];
        const i3 = indices[i + 2];
        wireframeIndices[wIdx++] = i1;
        wireframeIndices[wIdx++] = i2;
        wireframeIndices[wIdx++] = i2;
        wireframeIndices[wIdx++] = i3;
        wireframeIndices[wIdx++] = i3;
        wireframeIndices[wIdx++] = i1;
      }

      tunnelWireframeIndexBuffer = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelWireframeIndexBuffer);
      glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, wireframeIndices, glCtx.STATIC_DRAW);
      tunnelWireframeIndicesCount = wireframeIndices.length;

      global.tunnelRawVertices = vertices;
      global.tunnelRawIndices = collisionIndices;

      if (shellIndices.length > 0) {
        if (tunnelShellVertexBuffer) glCtx.deleteBuffer(tunnelShellVertexBuffer);
        if (tunnelShellColorBuffer) glCtx.deleteBuffer(tunnelShellColorBuffer);
        if (tunnelShellTerrainRadiusBuffer) glCtx.deleteBuffer(tunnelShellTerrainRadiusBuffer);
        if (tunnelShellCenterBuffer) glCtx.deleteBuffer(tunnelShellCenterBuffer);
        if (tunnelShellIndexBuffer) glCtx.deleteBuffer(tunnelShellIndexBuffer);

        tunnelShellVertexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellVertexBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, shellVertices, glCtx.STATIC_DRAW);

        tunnelShellColorBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellColorBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, shellColors, glCtx.STATIC_DRAW);

        tunnelShellTerrainRadiusBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellTerrainRadiusBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, shellTerrainRadii, glCtx.STATIC_DRAW);

        tunnelShellCenterBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ARRAY_BUFFER, tunnelShellCenterBuffer);
        glCtx.bufferData(glCtx.ARRAY_BUFFER, shellCenters, glCtx.STATIC_DRAW);

        tunnelShellIndexBuffer = glCtx.createBuffer();
        glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, tunnelShellIndexBuffer);
        glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, shellIndices, glCtx.STATIC_DRAW);
        tunnelShellIndicesCount = shellIndices.length;
      }
    } else {
      tunnelIndicesCount = indices.length;
      global.tunnelRawVertices = vertices;
      global.tunnelRawIndices = collisionIndices;
      tunnelShellIndicesCount = shellIndices.length;
    }

    // Keep spatial collision index grid in sync
    buildTunnelsGrid();
  }

  // --- CaveSystem API Object ---
  const CaveSystem = {
    init: function(gl, supportUint32) {
      _gl = gl;
      _supportUint32 = supportUint32;
      const tunnels = global.tunnels3D || [];
      if (tunnels.length > 0 && !tunnelVertexBuffer) {
        rebuildTunnelBuffers(gl, supportUint32);
      }
    },

    clearCache: function() {
      clearTunnelMeshCache();
    },

    rebuildBuffers: function(gl, supportUint32) {
      rebuildTunnelBuffers(gl || _gl, supportUint32 || _supportUint32);
    },

    getTunnelUniformsData: function(eyePos) {
      f32_tunnelsData.fill(0);
      let count = 0;
      const tunnels = global.tunnels3D || [];
      if (tunnels && tunnels.length > 0) {
        tunnelsWithDistPool.length = 0;
        for (let i = 0; i < tunnels.length; i++) {
          const t = tunnels[i];
          const dx = t.x - eyePos[0];
          const dy = t.y - eyePos[1];
          const dz = t.z - eyePos[2];
          const distSq = dx*dx + dy*dy + dz*dz;
          tunnelsWithDistPool.push({ t: t, distSq: distSq });
        }
        tunnelsWithDistPool.sort((a, b) => a.distSq - b.distSq);
        count = Math.min(64, tunnelsWithDistPool.length);
        for (let i = 0; i < count; i++) {
          const t = tunnelsWithDistPool[i].t;
          f32_tunnelsData[i * 4 + 0] = t.x;
          f32_tunnelsData[i * 4 + 1] = t.y;
          f32_tunnelsData[i * 4 + 2] = t.z;
          f32_tunnelsData[i * 4 + 3] = t.r;
        }
      }
      return { tunnelsData: f32_tunnelsData, count: count };
    },

    drawCave: function(gl, locations) {
      if (!tunnelIndicesCount || !tunnelVertexBuffer || !tunnelColorBuffer || !tunnelIndexBuffer) {
        return;
      }

      const positionLoc = locations.positionLoc;
      const colorLoc = locations.colorLoc;
      const isTunnelMeshLoc = locations.isTunnelMeshLoc;
      const terrainRadiusAttrLoc = locations.terrainRadiusAttrLoc;
      const tunnelCenterAttrLoc = locations.tunnelCenterAttrLoc;
      const useUint32 = locations.supportUint32 && tunnelIndicesCount > 65535;

      gl.disable(gl.CULL_FACE);

      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 1.0);

      // --- 1. Draw Cave Interior & Collar Mesh ---
      if (terrainRadiusAttrLoc !== -1 && tunnelTerrainRadiusBuffer) {
        gl.enableVertexAttribArray(terrainRadiusAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
        gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
      }

      if (tunnelCenterAttrLoc !== -1 && tunnelCenterBuffer) {
        gl.enableVertexAttribArray(tunnelCenterAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelCenterBuffer);
        gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelVertexBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelColorBuffer);
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelIndexBuffer);
      gl.drawElements(gl.TRIANGLES, tunnelIndicesCount, useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);

      // --- 2. Draw Cave Outer Shell (เปลือกถ้ำ) ---
      if (tunnelShellIndicesCount > 0 && tunnelShellVertexBuffer && tunnelShellColorBuffer && tunnelShellIndexBuffer) {
        const useUint32Shell = locations.supportUint32 && tunnelShellIndicesCount > 65535;

        if (terrainRadiusAttrLoc !== -1 && tunnelShellTerrainRadiusBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellTerrainRadiusBuffer);
          gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
        }

        if (tunnelCenterAttrLoc !== -1 && tunnelShellCenterBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellCenterBuffer);
          gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellVertexBuffer);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellColorBuffer);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelShellIndexBuffer);
        gl.drawElements(gl.TRIANGLES, tunnelShellIndicesCount, useUint32Shell ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
      }

      // Restore
      gl.cullFace(gl.BACK);
      if (terrainRadiusAttrLoc !== -1) {
        gl.disableVertexAttribArray(terrainRadiusAttrLoc);
        gl.vertexAttrib1f(terrainRadiusAttrLoc, 99999.0);
      }
      if (tunnelCenterAttrLoc !== -1) {
        gl.disableVertexAttribArray(tunnelCenterAttrLoc);
        gl.vertexAttrib3f(tunnelCenterAttrLoc, 0.0, 0.0, 0.0);
      }

      gl.disable(gl.CULL_FACE);
    },

    drawShell: function(gl, locations) {
      if (!tunnelShellIndicesCount || !tunnelShellVertexBuffer || !tunnelShellColorBuffer || !tunnelShellIndexBuffer) {
        return;
      }
      const positionLoc = locations.positionLoc;
      const colorLoc = locations.colorLoc;
      const isTunnelMeshLoc = locations.isTunnelMeshLoc;
      const terrainRadiusAttrLoc = locations.terrainRadiusAttrLoc;
      const tunnelCenterAttrLoc = locations.tunnelCenterAttrLoc;
      const useUint32Shell = locations.supportUint32 && tunnelShellIndicesCount > 65535;

      gl.disable(gl.CULL_FACE);
      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 1.0);

      if (terrainRadiusAttrLoc !== -1 && tunnelShellTerrainRadiusBuffer) {
        gl.enableVertexAttribArray(terrainRadiusAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellTerrainRadiusBuffer);
        gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
      }
      if (tunnelCenterAttrLoc !== -1 && tunnelShellCenterBuffer) {
        gl.enableVertexAttribArray(tunnelCenterAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellCenterBuffer);
        gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellVertexBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelShellColorBuffer);
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelShellIndexBuffer);
      gl.drawElements(gl.TRIANGLES, tunnelShellIndicesCount, useUint32Shell ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);

      gl.cullFace(gl.BACK);
      if (terrainRadiusAttrLoc !== -1) {
        gl.disableVertexAttribArray(terrainRadiusAttrLoc);
        gl.vertexAttrib1f(terrainRadiusAttrLoc, 99999.0);
      }
      if (tunnelCenterAttrLoc !== -1) {
        gl.disableVertexAttribArray(tunnelCenterAttrLoc);
        gl.vertexAttrib3f(tunnelCenterAttrLoc, 0.0, 0.0, 0.0);
      }
      gl.disable(gl.CULL_FACE);
    },

    drawWireframe: function(gl, locations) {
      if (!tunnelWireframeIndexBuffer || !tunnelWireframeIndicesCount) {
        return;
      }

      const positionLoc = locations.positionLoc;
      const colorLoc = locations.colorLoc;
      const isTunnelMeshLoc = locations.isTunnelMeshLoc;
      const terrainRadiusAttrLoc = locations.terrainRadiusAttrLoc;
      const tunnelCenterAttrLoc = locations.tunnelCenterAttrLoc;
      const useUint32 = locations.supportUint32 && tunnelWireframeIndicesCount > 65535;

      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 1.0);

      if (terrainRadiusAttrLoc !== -1 && tunnelTerrainRadiusBuffer) {
        gl.enableVertexAttribArray(terrainRadiusAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelTerrainRadiusBuffer);
        gl.vertexAttribPointer(terrainRadiusAttrLoc, 1, gl.FLOAT, false, 0, 0);
      }
      if (tunnelCenterAttrLoc !== -1 && tunnelCenterBuffer) {
        gl.enableVertexAttribArray(tunnelCenterAttrLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, tunnelCenterBuffer);
        gl.vertexAttribPointer(tunnelCenterAttrLoc, 3, gl.FLOAT, false, 0, 0);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, tunnelVertexBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.disableVertexAttribArray(colorLoc);
      gl.vertexAttrib3f(colorLoc, 1.0, 0.4, 0.4);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tunnelWireframeIndexBuffer);
      gl.drawElements(gl.LINES, tunnelWireframeIndicesCount, useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);

      if (terrainRadiusAttrLoc !== -1) {
        gl.disableVertexAttribArray(terrainRadiusAttrLoc);
      }
      if (tunnelCenterAttrLoc !== -1) {
        gl.disableVertexAttribArray(tunnelCenterAttrLoc);
        gl.vertexAttrib3f(tunnelCenterAttrLoc, 0.0, 0.0, 0.0);
      }
      if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 0.0);
    }
  };

  // Export to Global window
  global.CaveSystem = CaveSystem;
  global.buildTunnelsGrid = buildTunnelsGrid;
  global.clearTunnelMeshCache = clearTunnelMeshCache;
  global.isPositionInsideCave = isPositionInsideCave;
  global.generateSubterraneanCaves = generateSubterraneanCaves;
  global.rebuildTunnelBuffers = rebuildTunnelBuffers;

})(typeof window !== 'undefined' ? window : this);
