// === SEEDPLANET MODULE: JS/ENVIRONMENT/CLOUDS3D.JS ===
(function(global) {
  function pseudoRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  // Precomputed unit icosahedron puff geometry (60 vertices with exact normalized lx, ly, lz)
  const _PUFF_LOCAL_POS = (function() {
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;
    const baseVerts = [
      [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
      [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
      [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1]
    ];
    for (let i = 0; i < baseVerts.length; i++) {
        let len = Math.sqrt(baseVerts[i][0]*baseVerts[i][0] + baseVerts[i][1]*baseVerts[i][1] + baseVerts[i][2]*baseVerts[i][2]);
        baseVerts[i][0] /= len;
        baseVerts[i][1] /= len;
        baseVerts[i][2] /= len;
    }
    const indices = [
      0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
      1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
      3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
      4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
    ];
    const local = new Float32Array(indices.length * 3);
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      local[i * 3]     = baseVerts[idx][0];
      local[i * 3 + 1] = baseVerts[idx][1];
      local[i * 3 + 2] = baseVerts[idx][2];
    }
    return local;
  })();

  // Create an icosahedron (or simple sphere) to use as the base puff (uses precomputed unit geometry)
  function createPuffGeometry(center, radius) {
    let verts = [];
    let localPos = [];
    for (let i = 0; i < 60; i++) {
        let lx = _PUFF_LOCAL_POS[i * 3];
        let ly = _PUFF_LOCAL_POS[i * 3 + 1];
        let lz = _PUFF_LOCAL_POS[i * 3 + 2];
        verts.push(center[0] + lx * radius, center[1] + ly * radius, center[2] + lz * radius);
        localPos.push(lx, ly, lz);
    }
    return { vertices: verts, localPos: localPos };
  }

  function generateClouds(globalSeed, planetRadius, cloudsHeight) {
    let vertices = [];
    let localPositions = [];
    let indices = [];
    let cloudChunks = [];
    
    let currentSeed = globalSeed + 500;
    
    const areaScale = Math.max(1.0, planetRadius / 8.0);
    const numClouds = Math.min(180, Math.floor(30 * Math.pow(areaScale, 1.15)));
    let currentIndex = 0;
    
    // Scale cloud altitude and puff size gracefully with planet size and terrain elevation
    const hScale = typeof global.HEIGHT_SCALE !== 'undefined' ? global.HEIGHT_SCALE : (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6 * Math.pow(areaScale, 0.70));
    const effectiveCloudsHeight = Math.max(12.0, (hScale * 2.6) + planetRadius * 0.22);
    const cloudPuffScale = Math.min(3.2, 1.0 + Math.pow(areaScale, 0.40) * 0.30);
    
    for (let i = 0; i < numClouds; i++) {
        // Random spherical coordinate
        let theta = pseudoRandom(currentSeed++) * Math.PI * 2;
        let phi = Math.acos(2 * pseudoRandom(currentSeed++) - 1); // uniform sphere distribution
        
        let r = planetRadius + effectiveCloudsHeight + pseudoRandom(currentSeed++) * (1.2 * cloudPuffScale);
        
        let cx = r * Math.sin(phi) * Math.cos(theta);
        let cy = r * Math.cos(phi);
        let cz = r * Math.sin(phi) * Math.sin(theta);
        
        // A cloud is made of 3-5 overlapping puffs
        let numPuffs = 3 + Math.floor(pseudoRandom(currentSeed++) * 3);
        
        let chunkStart = currentIndex;
        
        for (let p = 0; p < numPuffs; p++) {
            let pRadius = (0.9 + pseudoRandom(currentSeed++) * 1.3) * cloudPuffScale;
            let ox = (pseudoRandom(currentSeed++) - 0.5) * 2.2 * cloudPuffScale;
            let oy = (pseudoRandom(currentSeed++) - 0.5) * 0.9 * cloudPuffScale;
            let oz = (pseudoRandom(currentSeed++) - 0.5) * 2.2 * cloudPuffScale;
            
            let centerX = cx + ox;
            let centerY = cy + oy;
            let centerZ = cz + oz;
            
            for (let v = 0; v < 60; v++) {
                const lx = _PUFF_LOCAL_POS[v * 3];
                const ly = _PUFF_LOCAL_POS[v * 3 + 1];
                const lz = _PUFF_LOCAL_POS[v * 3 + 2];
                vertices.push(centerX + lx * pRadius, centerY + ly * pRadius, centerZ + lz * pRadius);
                localPositions.push(lx, ly, lz);
                indices.push(currentIndex++);
            }
        }
        
        let chunkEnd = currentIndex;
        cloudChunks.push({
            position: [cx, cy, cz],
            radius: 8.0 * cloudPuffScale, // generous bounding radius to avoid premature frustum culling
            meshStart: chunkStart,
            meshEnd: chunkEnd,
            active: true,
            layer: 4
        });
    }
    
    const useUint32 = typeof supportUint32 !== 'undefined' ? supportUint32 : (typeof global.supportUint32 !== 'undefined' ? global.supportUint32 : false);
    return {
        vertices: new Float32Array(vertices),
        localPos: new Float32Array(localPositions),
        indices: (useUint32 && indices.length > 65535) ? new Uint32Array(indices) : new Uint16Array(indices),
        chunks: cloudChunks
    };
  }

  global.generateClouds3D = generateClouds;
})(typeof window !== 'undefined' ? window : this);
