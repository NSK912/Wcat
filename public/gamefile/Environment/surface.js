// === SEEDPLANET MODULE: JS/ENVIRONMENT/SURFACE.JS ===

(function(global) {
  // Shared color array to avoid GC allocations
  const sharedColor = new Float32Array(3);
  const f32_identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const f32_waterColor = new Float32Array(3);
  const f32_cameraPos = new Float32Array(3);
  function setF32(target, source) {
    for (let i = 0; i < source.length; i++) target[i] = source[i];
    return target;
  }

  // Terrain cache data structures
  const TERRAIN_CACHE_SIZE = 32768;
  const TERRAIN_CACHE_MASK = TERRAIN_CACHE_SIZE - 1;
  const terrainCacheT = new Int32Array(TERRAIN_CACHE_SIZE);
  const terrainCacheP = new Int32Array(TERRAIN_CACHE_SIZE);
  const terrainCacheSeed = new Float32Array(TERRAIN_CACHE_SIZE);
  const terrainCacheVals = new Float32Array(TERRAIN_CACHE_SIZE);
  const terrainCacheValid = new Uint8Array(TERRAIN_CACHE_SIZE);

  function clearCache() {
    terrainCacheValid.fill(0);
    if (global && typeof global.clearVisualCache === 'function') {
      global.clearVisualCache();
    }
  }
  if (typeof window !== 'undefined') {
    window.clearCache = clearCache;
  }

  function getTerrainHeightAndColor(theta, phi, seed, out = null) {
    const rawX = Math.sin(theta) * Math.cos(phi);
    const rawY = Math.cos(theta);
    const rawZ = Math.sin(theta) * Math.sin(phi);

    // Planet Radius scaling:
    // When RADIUS = 8.0 (standard baseline), freqScale = 1.0 (100% original baseline math)
    // When RADIUS = 32, 64, 96, 128, 160, scales organic noise frequency appropriately
    const currentR = typeof global.RADIUS !== 'undefined' ? global.RADIUS : (typeof window !== 'undefined' && window.RADIUS ? window.RADIUS : 8.0);
    const rRatio = Math.max(0.1, currentR / 8.0);
    const freqScale = Math.pow(rRatio, 0.52);

    const x = rawX * freqScale;
    const y = rawY * freqScale;
    const z = rawZ * freqScale;

    const fbm = typeof global.fbmNoise === "function" 
      ? global.fbmNoise 
      : (x, y, z, s, oct) => 0;

    // 1. Domain warping for organic twists, tropical bay coves, and curving island chains
    const warpX = fbm(x * 1.5, y * 1.5, z * 1.5, seed + 801, 3) * 0.32;
    const warpY = fbm(y * 1.5, z * 1.5, x * 1.5, seed + 802, 3) * 0.32;
    const warpZ = fbm(z * 1.5, x * 1.5, y * 1.5, seed + 803, 3) * 0.32;

    const wx = x + warpX;
    const wy = y + warpY;
    const wz = z + warpZ;

    // 2. Continental macro distribution (Tropical Archipelago / Islands vs Ocean)
    const continentNoise = fbm(wx * 0.85, wy * 0.85, wz * 0.85, seed + 100, 4);
    const continent = (continentNoise + 1.0) * 0.5; // 0.0 to 1.0

    // 3. Sandbars & Sand spits (ทะเลแหวก) connecting islets
    const sandbarNoise = fbm(wx * 2.4, wy * 2.4, wz * 2.4, seed + 888, 3);
    const sandbarVal = (sandbarNoise + 1.0) * 0.5;

    let height = 0.0;

    // Water surface level in height space is 0.25 (since 0.25 * 0.6 = 0.15 = waterLevel * 0.15)
    const SEA_LEVEL = 0.25;

    if (continent < 0.36) {
      // Deep abyssal ocean bed
      const depthFactor = (0.36 - continent) / 0.36;
      const oceanDrop = Math.pow(depthFactor, 1.2) * 2.4;
      const trenchNoise = fbm(x * 2.5, y * 2.5, z * 2.5, seed + 777, 3);
      const trenchVal = Math.pow(1.0 - Math.abs(trenchNoise), 3.5) * 1.2;
      height = -0.35 - oceanDrop - trenchVal * depthFactor;
    } else if (continent < 0.50) {
      // Coastal Lagoon, Sandbar & Gentle Beach Slope (แนวหาดทรายค่อย ๆ ลาดลงทะเล)
      const t = (continent - 0.36) / 0.14; // 0.0 (shallow sea) -> 1.0 (beach upper crest)
      const smoothT = t * t * (3.0 - 2.0 * t);
      
      // Slope transitions smoothly from underwater sandbed (-0.25) up through water level (0.25) to upper beach (0.38)
      let beachSlope = -0.25 + smoothT * 0.63; // -0.25 -> +0.38

      // Add sandbars / sand spits (ทะเลแหวก) connecting islets
      if (sandbarVal > 0.58) {
        const spitLift = Math.pow((sandbarVal - 0.58) / 0.42, 1.5) * 0.32;
        beachSlope = Math.max(beachSlope, SEA_LEVEL - 0.08 + spitLift);
      }

      // Fine sand ripples
      const sandRipple = (fbm(wx * 10.0, wy * 10.0, wz * 10.0, seed + 555, 2) + 1.0) * 0.02;
      height = beachSlope + sandRipple;
    } else {
      // Inland Island Mass (Hills, Granite Peaks, Lush Valleys)
      const landFactor = (continent - 0.50) / 0.50; // 0.0 to 1.0
      const baseIslandHeight = 0.38 + landFactor * 0.20; // Starts above beach level

      // Biome Distribution Noise (sharp alpine ridges vs rounded domes vs terraced canyons)
      const biomeNoise = fbm(wx * 1.2, wy * 1.2, wz * 1.2, seed + 999, 3);
      const biomeVal = (biomeNoise + 1.0) * 0.5;

      // A) Sharp Alpine / Granite Island Peaks & Valleys
      const ridgeBase1 = 1.0 - Math.abs(fbm(wx * 2.8, wy * 2.8, wz * 2.8, seed + 200, 5));
      const ridgeBase2 = 1.0 - Math.abs(fbm(wx * 5.8, wy * 5.8, wz * 5.8, seed + 201, 4));
      const sharpPeaks = Math.pow(ridgeBase1, 2.4) * 2.6 + Math.pow(ridgeBase2, 2.0) * 0.8;
      const valleyNoise = Math.abs(fbm(wx * 2.2, wy * 2.2, wz * 2.2, seed + 350, 4));
      const vValleyDrop = Math.pow(1.0 - valleyNoise, 2.2) * 1.0;
      const alpineHeight = sharpPeaks - vValleyDrop;

      // B) Rounded Domes & Tropical Knolls
      const roundedNoise1 = (fbm(x * 1.8, y * 1.8, z * 1.8, seed + 400, 4) + 1.0) * 0.5;
      const roundedNoise2 = (fbm(x * 3.8, y * 3.8, z * 3.8, seed + 401, 3) + 1.0) * 0.5;
      const roundedDomes = Math.sin(roundedNoise1 * Math.PI * 0.85) * 1.6 + roundedNoise2 * 0.5;

      // C) Terraced Cliffs
      const canyonBase = fbm(wx * 1.8, wy * 1.8, wz * 1.8, seed + 600, 4);
      const rawCanyon = (canyonBase + 1.0) * 0.5;
      const terraceSteps = 6.0;
      const terracedCanyon = Math.floor(rawCanyon * terraceSteps) / terraceSteps + 
        Math.pow(Math.max(0.0, (rawCanyon * terraceSteps) % 1.0), 3.0) / terraceSteps;
      const canyonHeight = (terracedCanyon - 0.5) * 2.2;

      let mountainStyleHeight = 0;
      if (biomeVal < 0.45) {
        const bt = biomeVal / 0.45;
        const smoothBt = bt * bt * (3.0 - 2.0 * bt);
        mountainStyleHeight = alpineHeight * (1.0 - smoothBt) + roundedDomes * smoothBt;
      } else {
        const bt = (biomeVal - 0.45) / 0.55;
        const smoothBt = bt * bt * (3.0 - 2.0 * bt);
        mountainStyleHeight = roundedDomes * (1.0 - smoothBt) + canyonHeight * smoothBt;
      }

      const mountainFactor = Math.pow(landFactor, 1.1) * 1.8;
      height = baseIslandHeight + mountainStyleHeight * mountainFactor;

      // Steep Cliffs & Precipices
      if (height > 0.6) {
        const cliffSteepness = fbm(wx * 3.5, wy * 3.5, wz * 3.5, seed + 520, 3);
        if (cliffSteepness > 0.08) {
          height += Math.pow((cliffSteepness - 0.08) * 1.8, 1.8) * 1.0;
        }
      }

      // Erosion Gullies
      if (height > 0.4) {
        const erosionNoise = 1.0 - Math.abs(fbm(wx * 7.5, wy * 7.5, wz * 7.5, seed + 880, 4));
        height -= Math.pow(erosionNoise, 3.5) * 0.40 * Math.min(1.5, height - 0.3);
      }

      const detail = (fbm(x * 12.0, y * 12.0, z * 12.0, seed + 300, 3) + 1.0) * 0.5;
      height += (detail - 0.5) * 0.08;
    }

    // Natural island sand & ocean bed palette
    const detailForColor = (fbm(x * 10.0, y * 10.0, z * 10.0, seed + 300, 2) + 1.0) * 0.5;

    const currentBiome = typeof window !== "undefined" ? (window.CURRENT_BIOME || (RADIUS < 8.0 ? 'moon' : 'normal')) : 'normal';

    if (currentBiome === 'moon') {
      // Moon / Lunar regolith cratered palette
      const craterNoise = (fbm(x * 6.0, y * 6.0, z * 6.0, seed + 420, 3) + 1.0) * 0.5;
      const baseGray = 0.42 + detailForColor * 0.22 + craterNoise * 0.18;
      sharedColor[0] = baseGray * 0.94;
      sharedColor[1] = baseGray * 0.96;
      sharedColor[2] = baseGray * 1.00;
    } else if (currentBiome === 'desert') {
      // Endless dunes, terracotta sandstones, golden arid desert
      if (height < 0.20) {
        // Deep sand basins & dunes
        const sandVar = 0.92 + detailForColor * 0.16;
        sharedColor[0] = 0.94 * sandVar;
        sharedColor[1] = 0.78 * sandVar;
        sharedColor[2] = 0.42 * sandVar;
      } else if (height < 0.85) {
        // Terracotta red sandstone plateaus
        const blend = (height - 0.20) / 0.65;
        const rockVar = 0.88 + detailForColor * 0.24;
        sharedColor[0] = (0.94 * (1 - blend) + 0.82 * blend) * rockVar;
        sharedColor[1] = (0.78 * (1 - blend) + 0.52 * blend) * rockVar;
        sharedColor[2] = (0.42 * (1 - blend) + 0.28 * blend) * rockVar;
      } else {
        // Sun-baked canyon peaks
        const canyonVar = 0.85 + detailForColor * 0.30;
        sharedColor[0] = 0.75 * canyonVar;
        sharedColor[1] = 0.45 * canyonVar;
        sharedColor[2] = 0.25 * canyonVar;
      }
    } else if (currentBiome === 'jungle') {
      // Hyper-dense emerald canopy & tropical rain-forest
      if (height < 0.15) {
        // Riverbed / shoreline loam
        sharedColor[0] = 0.28;
        sharedColor[1] = 0.38;
        sharedColor[2] = 0.18;
      } else if (height < 0.75) {
        // Vibrant emerald canopy & mossy rainforest
        const blend = (height - 0.15) / 0.60;
        const jungleVar = 0.90 + detailForColor * 0.20;
        sharedColor[0] = (0.12 * (1 - blend) + 0.08 * blend) * jungleVar;
        sharedColor[1] = (0.68 * (1 - blend) + 0.58 * blend) * jungleVar;
        sharedColor[2] = (0.22 * (1 - blend) + 0.16 * blend) * jungleVar;
      } else {
        // Overgrown mossy cliffs
        const cliffVar = 0.85 + detailForColor * 0.30;
        sharedColor[0] = 0.20 * cliffVar;
        sharedColor[1] = 0.42 * cliffVar;
        sharedColor[2] = 0.18 * cliffVar;
      }
    } else if (currentBiome === 'water') {
      // Ocean Planet: mostly turquoise waters, coral beds, and minimal wet sandbars
      if (height < 0.20) {
        const depthVar = detailForColor * 0.2 + 0.8;
        sharedColor[0] = 0.04 * depthVar;
        sharedColor[1] = 0.18 * depthVar;
        sharedColor[2] = 0.38 * depthVar;
      } else {
        const sandVar = 0.90 + detailForColor * 0.15;
        sharedColor[0] = 0.82 * sandVar;
        sharedColor[1] = 0.85 * sandVar;
        sharedColor[2] = 0.75 * sandVar;
      }
    } else {
      // Normal / Earth-like Planet
      if (height < -0.80) {
        // Abyssal deep navy seabed
        const depthVar = detailForColor * 0.2 + 0.8;
        sharedColor[0] = 0.05 * depthVar;
        sharedColor[1] = 0.08 * depthVar;
        sharedColor[2] = 0.18 * depthVar;
      } else if (height < -0.15) {
        // Deep sea sandy bed & coral reef floor
        const blend = (height + 0.80) / 0.65;
        sharedColor[0] = 0.05 * (1 - blend) + 0.52 * blend;
        sharedColor[1] = 0.08 * (1 - blend) + 0.48 * blend;
        sharedColor[2] = 0.18 * (1 - blend) + 0.40 * blend;
      } else if (height < 0.25) {
        // Underwater sand bed leading to shore line
        const blend = (height + 0.15) / 0.40;
        const sandVar = 0.9 + detailForColor * 0.15;
        sharedColor[0] = (0.52 * (1 - blend) + 0.88 * blend) * sandVar;
        sharedColor[1] = (0.48 * (1 - blend) + 0.82 * blend) * sandVar;
        sharedColor[2] = (0.40 * (1 - blend) + 0.68 * blend) * sandVar;
      } else if (height < 0.45) {
        // Pristine, expansive white/golden powder sand beach
        const blend = (height - 0.25) / 0.20;
        const sandVar = 0.95 + detailForColor * 0.1;
        sharedColor[0] = (0.88 * (1 - blend) + 0.95 * blend) * sandVar;
        sharedColor[1] = (0.82 * (1 - blend) + 0.90 * blend) * sandVar;
        sharedColor[2] = (0.68 * (1 - blend) + 0.80 * blend) * sandVar;
      } else if (height < 0.95) {
        // Lush tropical island coastal jungle & palm greenery
        const blend = (height - 0.45) / 0.50;
        sharedColor[0] = 0.95 * (1 - blend) + 0.18 * blend;
        sharedColor[1] = 0.92 * (1 - blend) + 0.58 * blend;
        sharedColor[2] = 0.82 * (1 - blend) + 0.22 * blend;
      } else if (height < 1.60) {
        // Tropical island granite rocks & limestone cliffs
        const blend = (height - 0.95) / 0.65;
        const rockVar = 0.85 + detailForColor * 0.3;
        sharedColor[0] = (0.18 * (1 - blend) + 0.48 * blend) * rockVar;
        sharedColor[1] = (0.58 * (1 - blend) + 0.44 * blend) * rockVar;
        sharedColor[2] = (0.22 * (1 - blend) + 0.38 * blend) * rockVar;
      } else {
        // Mountain crests / snow peaks
        const snowVar = 0.9 + detailForColor * 0.2;
        sharedColor[0] = 0.92 * snowVar;
        sharedColor[1] = 0.95 * snowVar;
        sharedColor[2] = 1.00 * snowVar;
      }
    }

    // Color noise variation
    let colorNoise = fbm(x * 12.0, y * 12.0, z * 12.0, seed + 700, 2) * 0.05;
    sharedColor[0] += colorNoise;
    sharedColor[1] += colorNoise * 0.8;
    sharedColor[2] += colorNoise * 0.6;

    sharedColor[0] = Math.max(0.04, Math.min(1.0, sharedColor[0]));
    sharedColor[1] = Math.max(0.04, Math.min(1.0, sharedColor[1]));
    sharedColor[2] = Math.max(0.04, Math.min(1.0, sharedColor[2]));

    // Terrain modifications (digging/building by player)
    const mods = global.terrainMods;
    if (mods && mods.length > 0) {
      for (let i = 0; i < mods.length; i++) {
        const mod = mods[i];
        const dx = x - mod.x;
        const dy = y - mod.y;
        const dz = z - mod.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        if (distSq < mod.rSq) {
          const dist = Math.sqrt(distSq);
          const factor = 1.0 - (dist / mod.r);
          const smoothFactor = factor * factor * (3 - 2 * factor);
          height += mod.delta * smoothFactor;
        }
      }
    }

    if (out) {
      out.height = height;
      out.color[0] = sharedColor[0];
      out.color[1] = sharedColor[1];
      out.color[2] = sharedColor[2];
      return out;
    }

    return { height, color: [sharedColor[0], sharedColor[1], sharedColor[2]] };
  }

  function getHeightOnSphere(theta, phi, seed) {
    const tVal = Math.round(theta * 80000);
    const pVal = Math.round(phi * 80000);
    const hash = ((tVal * 73856093) ^ (pVal * 19349663) ^ (Math.round(seed * 83492791))) & TERRAIN_CACHE_MASK;

    if (terrainCacheValid[hash] && terrainCacheT[hash] === tVal && terrainCacheP[hash] === pVal && terrainCacheSeed[hash] === seed) {
      return terrainCacheVals[hash];
    }

    const result = getTerrainHeightAndColor(theta, phi, seed);
    terrainCacheValid[hash] = 1;
    terrainCacheT[hash] = tVal;
    terrainCacheP[hash] = pVal;
    terrainCacheSeed[hash] = seed;
    terrainCacheVals[hash] = result.height;
    return result.height;
  }

  // --- Surface Rendering Methods ---
  function drawSurfaceDepth(gl, opts = {}) {
    const vBuf = opts.vertexBuffer !== undefined ? opts.vertexBuffer : global.vertexBuffer;
    const iBuf = opts.indexBuffer !== undefined ? opts.indexBuffer : global.indexBuffer;
    const idxLen = opts.indicesLength !== undefined ? opts.indicesLength : global.indicesLength;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;

    if (!vBuf || !iBuf || !idxLen || idxLen <= 0) return;

    if (opts.depthSwayFactorLoc) gl.uniform1f(opts.depthSwayFactorLoc, 0.0);
    if (opts.depthWaterSwayFactorLoc) gl.uniform1f(opts.depthWaterSwayFactorLoc, 0.0);
    if (opts.depthModelLoc) {
      gl.uniformMatrix4fv(
        opts.depthModelLoc,
        false,
        f32_identity,
      );
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.enableVertexAttribArray(opts.depthPosLoc);
    gl.vertexAttribPointer(opts.depthPosLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    if (useUint32 && idxLen > 65535) {
      gl.drawElements(gl.TRIANGLES, idxLen, gl.UNSIGNED_INT, 0);
    } else {
      gl.drawElements(gl.TRIANGLES, idxLen, gl.UNSIGNED_SHORT, 0);
    }
  }

  function drawSurface(gl, opts = {}) {
    const vBuf = opts.vertexBuffer !== undefined ? opts.vertexBuffer : global.vertexBuffer;
    const cBuf = opts.colorBuffer !== undefined ? opts.colorBuffer : global.colorBuffer;
    const iBuf = opts.indexBuffer !== undefined ? opts.indexBuffer : global.indexBuffer;
    const idxLen = opts.indicesLength !== undefined ? opts.indicesLength : global.indicesLength;
    const useUint32 = opts.supportUint32 !== undefined ? opts.supportUint32 : global.supportUint32;

    if (!vBuf || !cBuf || !iBuf || !idxLen || idxLen <= 0) return;

    if (opts.terrainWaterRadiusLoc) gl.uniform1f(opts.terrainWaterRadiusLoc, opts.waterRadius);
    if (opts.terrainWaterColorLoc && opts.waterColor) {
      gl.uniform3fv(opts.terrainWaterColorLoc, setF32(f32_waterColor, opts.waterColor));
    }
    if (opts.terrainWaterOpacityLoc) gl.uniform1f(opts.terrainWaterOpacityLoc, opts.waterOpacity);

    if (opts.terrainRenderDistEnabledLoc) {
      gl.uniform1f(
        opts.terrainRenderDistEnabledLoc,
        opts.renderDistEnabled ? 1.0 : 0.0,
      );
    }
    if (opts.terrainMaxRenderDistLoc) gl.uniform1f(opts.terrainMaxRenderDistLoc, opts.renderDistValue);
    if (opts.terrainCameraPosLoc && opts.eyePos) {
      gl.uniform3fv(opts.terrainCameraPosLoc, setF32(f32_cameraPos, opts.eyePos));
    }

    // Setup tunnels data and count (sorted by distance to camera)
    if (typeof global.CaveSystem !== "undefined" && global.CaveSystem.getTunnelUniformsData && opts.eyePos) {
      const { tunnelsData, count } = global.CaveSystem.getTunnelUniformsData(opts.eyePos);
      if (opts.tunnelsLoc) gl.uniform4fv(opts.tunnelsLoc, tunnelsData);
      if (opts.tunnelCountLoc) gl.uniform1i(opts.tunnelCountLoc, count);
    }
    if (opts.isTunnelMeshLoc) gl.uniform1f(opts.isTunnelMeshLoc, 0.0); // Not tunnel mesh

    // Disable attribute for terrain draw, set default large radius
    if (opts.terrainRadiusAttrLoc !== undefined && opts.terrainRadiusAttrLoc !== -1) {
      gl.disableVertexAttribArray(opts.terrainRadiusAttrLoc);
      gl.vertexAttrib1f(opts.terrainRadiusAttrLoc, 99999.0);
    }
    if (opts.tunnelCenterAttrLoc !== undefined && opts.tunnelCenterAttrLoc !== -1) {
      gl.disableVertexAttribArray(opts.tunnelCenterAttrLoc);
      gl.vertexAttrib3f(opts.tunnelCenterAttrLoc, 0.0, 0.0, 0.0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.enableVertexAttribArray(opts.positionLoc);
    gl.vertexAttribPointer(opts.positionLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.enableVertexAttribArray(opts.colorLoc);
    gl.vertexAttribPointer(opts.colorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);

    if (useUint32 && idxLen > 65535) {
      gl.drawElements(gl.TRIANGLES, idxLen, gl.UNSIGNED_INT, 0);
    } else {
      gl.drawElements(gl.TRIANGLES, idxLen, gl.UNSIGNED_SHORT, 0);
    }
  }

  function drawWireframe(gl, opts = {}) {
    const wfBuf = opts.wireframeBuffer !== undefined ? opts.wireframeBuffer : global.wireframeBuffer;
    const wcBuf = opts.wireColorBuffer !== undefined ? opts.wireColorBuffer : global.wireColorBuffer;
    const count = opts.wireframePointCount !== undefined ? opts.wireframePointCount : global.wireframePointCount;

    if (!wfBuf || !wcBuf || !count || count <= 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, wfBuf);
    gl.enableVertexAttribArray(opts.positionLoc);
    gl.vertexAttribPointer(opts.positionLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, wcBuf);
    gl.enableVertexAttribArray(opts.colorLoc);
    gl.vertexAttribPointer(opts.colorLoc, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, count);
  }

  // --- SurfaceSystem API Object ---
  const SurfaceSystem = {
    getTerrainHeightAndColor: getTerrainHeightAndColor,
    getHeightOnSphere: getHeightOnSphere,
    clearCache: clearCache,
    drawSurfaceDepth: drawSurfaceDepth,
    drawSurface: drawSurface,
    drawWireframe: drawWireframe,
    sharedColor: sharedColor,
    terrainCacheValid: terrainCacheValid,
    terrainCacheT: terrainCacheT,
    terrainCacheP: terrainCacheP,
    terrainCacheSeed: terrainCacheSeed,
    terrainCacheVals: terrainCacheVals
  };

  // Export to Global window
  global.SurfaceSystem = SurfaceSystem;
  global.getTerrainHeightAndColor = getTerrainHeightAndColor;
  global.getHeightOnSphere = getHeightOnSphere;
  global.sharedColor = sharedColor;
  global.terrainCacheValid = terrainCacheValid;
  global.terrainCacheT = terrainCacheT;
  global.terrainCacheP = terrainCacheP;
  global.terrainCacheSeed = terrainCacheSeed;
  global.terrainCacheVals = terrainCacheVals;

})(typeof window !== 'undefined' ? window : this);

  // --- Visual Height on Mesh (Optimized with zero GC allocations, deduplicated trig, and query cache) ---
  const VCACHE_SIZE = 16;
  const _vCacheTheta = new Float64Array(VCACHE_SIZE);
  const _vCachePhi = new Float64Array(VCACHE_SIZE);
  const _vCacheSeed = new Float64Array(VCACHE_SIZE);
  const _vCacheGrid = new Float64Array(VCACHE_SIZE);
  const _vCacheRes = new Float64Array(VCACHE_SIZE);
  const _vCacheValid = new Uint8Array(VCACHE_SIZE);
  let _vCachePtr = 0;

  function clearVisualCache() {
    _vCacheValid.fill(0);
  }
  if (typeof window !== 'undefined') {
    window.clearVisualCache = clearVisualCache;
  }

  // Preallocated scratch array for 3 triangle vertices (pA, pB, pC) - zero GC allocations
  const _scratchPos = new Float64Array(9);

  function _fillVisualVertex(idx, l_idx, lg_idx, latSeg, longSeg, seed, currentR, currentHScale) {
    const t = (l_idx / latSeg) * Math.PI;
    const p = (lg_idx / longSeg) * (2 * Math.PI);
    const h = getHeightOnSphere(t, p, seed);
    const r = currentR + h * currentHScale;
    const sinT = Math.sin(t);
    const rSinT = r * sinT;
    const offset = idx * 3;
    _scratchPos[offset] = rSinT * Math.cos(p);
    _scratchPos[offset + 1] = r * Math.cos(t);
    _scratchPos[offset + 2] = rSinT * Math.sin(p);
  }

  function getVisualHeightOnSphere(theta, phi, seed) {
    const grid = typeof window !== 'undefined' && window.currentGridSize ? window.currentGridSize : (typeof currentGridSize !== 'undefined' ? currentGridSize : 0);
    if (!grid) {
      return (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta, phi, seed) : 0);
    }

    // Check recent cache for exact matching parameters (identical queries within frame)
    for (let i = 0; i < VCACHE_SIZE; i++) {
      if (_vCacheValid[i] === 1 &&
          _vCacheTheta[i] === theta &&
          _vCachePhi[i] === phi &&
          _vCacheSeed[i] === seed &&
          _vCacheGrid[i] === grid) {
        return _vCacheRes[i];
      }
    }

    const currentR = (typeof window !== 'undefined' && typeof window.RADIUS === 'number') ? window.RADIUS : (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);
    const currentHScale = (typeof window !== 'undefined' && typeof window.HEIGHT_SCALE === 'number') ? window.HEIGHT_SCALE : (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6);

    const safeTheta = Math.max(0.00001, Math.min(Math.PI - 0.00001, theta));
    let normPhi = phi % (2 * Math.PI);
    if (normPhi < 0) normPhi += 2 * Math.PI;
    
    const latSeg = grid;
    const longSeg = grid;
    
    const lat = (safeTheta / Math.PI) * latSeg;
    let long = (normPhi / (2 * Math.PI)) * longSeg;
    if (long < 0) long += longSeg;
    long = long % longSeg;
    
    const lat0 = Math.max(0, Math.min(latSeg - 1, Math.floor(lat)));
    const long0 = Math.floor(long);
    const lat1 = Math.min(latSeg, lat0 + 1);
    const long1 = (long0 + 1) % longSeg;
    
    const u = lat - lat0;
    const v = long - long0;
    
    if (u + v <= 1) {
      _fillVisualVertex(0, lat0, long0, latSeg, longSeg, seed, currentR, currentHScale);
      _fillVisualVertex(1, lat1, long0, latSeg, longSeg, seed, currentR, currentHScale);
      _fillVisualVertex(2, lat0, long1, latSeg, longSeg, seed, currentR, currentHScale);
    } else {
      _fillVisualVertex(0, lat1, long1, latSeg, longSeg, seed, currentR, currentHScale);
      _fillVisualVertex(1, lat0, long1, latSeg, longSeg, seed, currentR, currentHScale);
      _fillVisualVertex(2, lat1, long0, latSeg, longSeg, seed, currentR, currentHScale);
    }

    const pAx = _scratchPos[0], pAy = _scratchPos[1], pAz = _scratchPos[2];
    const pBx = _scratchPos[3], pBy = _scratchPos[4], pBz = _scratchPos[5];
    const pCx = _scratchPos[6], pCy = _scratchPos[7], pCz = _scratchPos[8];

    const sinSafeTheta = Math.sin(safeTheta);
    const Dx = sinSafeTheta * Math.cos(normPhi);
    const Dy = Math.cos(safeTheta);
    const Dz = sinSafeTheta * Math.sin(normPhi);
    
    const ABx = pBx - pAx, ABy = pBy - pAy, ABz = pBz - pAz;
    const ACx = pCx - pAx, ACy = pCy - pAy, ACz = pCz - pAz;
    
    const Nx = ABy * ACz - ABz * ACy;
    const Ny = ABz * ACx - ABx * ACz;
    const Nz = ABx * ACy - ABy * ACx;
    
    const dotNA = Nx * pAx + Ny * pAy + Nz * pAz;
    const dotND = Nx * Dx + Ny * Dy + Nz * Dz;
    
    let result;
    if (Math.abs(dotND) < 1e-6) {
      result = getHeightOnSphere(safeTheta, normPhi, seed);
    } else {
      const rIntersect = dotNA / dotND;
      if (!isFinite(rIntersect) || rIntersect <= 0) {
        result = getHeightOnSphere(safeTheta, normPhi, seed);
      } else {
        const hIntersect = (rIntersect - currentR) / (currentHScale || 0.6);
        result = isFinite(hIntersect) ? hIntersect : getHeightOnSphere(safeTheta, normPhi, seed);
      }
    }

    // Save to cache
    _vCacheTheta[_vCachePtr] = theta;
    _vCachePhi[_vCachePtr] = phi;
    _vCacheSeed[_vCachePtr] = seed;
    _vCacheGrid[_vCachePtr] = grid;
    _vCacheRes[_vCachePtr] = result;
    _vCacheValid[_vCachePtr] = 1;
    _vCachePtr = (_vCachePtr + 1) % VCACHE_SIZE;

    return result;
  }
  window.getVisualHeightOnSphere = getVisualHeightOnSphere;

  function getVisualPositionOnSphere(theta, phi, seed) {
    const currentR = (typeof window !== 'undefined' && typeof window.RADIUS === 'number') ? window.RADIUS : (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);
    const currentHScale = (typeof window !== 'undefined' && typeof window.HEIGHT_SCALE === 'number') ? window.HEIGHT_SCALE : (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6);
    const h = getVisualHeightOnSphere(theta, phi, seed);
    const r = currentR + h * currentHScale;
    const safeTheta = Math.max(0.00001, Math.min(Math.PI - 0.00001, theta));
    const sinT = Math.sin(safeTheta);
    const rSinT = r * sinT;
    return [
        rSinT * Math.cos(phi),
        r * Math.cos(safeTheta),
        rSinT * Math.sin(phi),
        h,
        r
    ];
  }
  window.getVisualPositionOnSphere = getVisualPositionOnSphere;

  
