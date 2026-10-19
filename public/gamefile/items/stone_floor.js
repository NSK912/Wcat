// === SEEDPLANET MODULE: JS/ITEMS/STONE_FLOOR.JS ===

window.ItemRegistry["stone_floor"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;
    
    // "พื้นหิน" 300x300 stone floor
    const w = item.width !== undefined ? item.width : item.size * 12.0;
    const h = item.size * 0.15;
    const d = item.depth !== undefined ? item.depth : item.size * 12.0;
    
    // Position at the bottom of the main floor slab
    const pBottom = [
      p[0] - n[0] * (h / 2),
      p[1] - n[1] * (h / 2),
      p[2] - n[2] * (h / 2)
    ];

    // Calculate distance to terrain across center and 4 corners to ensure solid foundation seals into the planet surface
    const halfW = w / 2;
    const halfD = d / 2;
    const sampleOffsets = [
      [0, 0],
      [halfW, halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [-halfW, -halfD]
    ];

    let maxBaseLen = 0.05;

    if (targetBuffer === 'preview' || item.isIconPreview) {
      maxBaseLen = 0.03;
    } else {
      for (let offset of sampleOffsets) {
        const sampleP = [
          pBottom[0] + r[0] * offset[0] + f[0] * offset[1],
          pBottom[1] + r[1] * offset[0] + f[1] * offset[1],
          pBottom[2] + r[2] * offset[0] + f[2] * offset[1]
        ];
        const sampleDist = Math.sqrt(sampleP[0] * sampleP[0] + sampleP[1] * sampleP[1] + sampleP[2] * sampleP[2]) || 1;
        const nx_s = sampleP[0] / sampleDist;
        const ny_s = sampleP[1] / sampleDist;
        const nz_s = sampleP[2] / sampleDist;
        
        let groundRad_s = RADIUS;
        if (typeof getTerrainSurfaceAndCeiling === "function") {
          const caveData = getTerrainSurfaceAndCeiling(nx_s, ny_s, nz_s, sampleDist);
          if (caveData && caveData.ground !== undefined && caveData.insideTunnel) {
            groundRad_s = caveData.ground;
          } else {
            const theta_s = Math.acos(Math.max(-1.0, Math.min(1.0, ny_s)));
            const phi_s = Math.atan2(nz_s, nx_s);
            groundRad_s = RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_s, phi_s, typeof globalSeed !== "undefined" ? globalSeed : 0) : 0) * HEIGHT_SCALE;
          }
        } else {
          const theta_s = Math.acos(Math.max(-1.0, Math.min(1.0, ny_s)));
          const phi_s = Math.atan2(nz_s, nx_s);
          groundRad_s = RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(theta_s, phi_s, typeof globalSeed !== "undefined" ? globalSeed : 0) : 0) * HEIGHT_SCALE;
        }
        
        const waterRadius = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel : 0) * 0.15;
        if (typeof waterEnabled !== "undefined" && waterEnabled && groundRad_s < waterRadius) {
          groundRad_s = waterRadius;
        }
        
        const extraDepth = 0.10; // penetrate slightly into terrain for seamless fit
        const reqLen = sampleDist - groundRad_s + extraDepth;
        if (reqLen > maxBaseLen) {
          maxBaseLen = reqLen;
        }
      }
    }

    const basePos = [
      pBottom[0] - n[0] * (maxBaseLen / 2),
      pBottom[1] - n[1] * (maxBaseLen / 2),
      pBottom[2] - n[2] * (maxBaseLen / 2)
    ];
    
    if (item.isPreview) {
      const isValid = item.isValidPlacement !== false;
      const col = isValid ? [0.6, 0.6, 0.6] : [0.9, 0.2, 0.2];
      addBox(p, w, h, d, col, r, n, f, vertices, colors, indices);
      addBox(basePos, w * 0.98, maxBaseLen, d * 0.98, col, r, n, f, vertices, colors, indices);
    } else {
      // Placed stone floor with solid foundation & irregular stone slabs
      const gravelCol = [0.35, 0.35, 0.37]; // Dark grey gravel/foundation
      const baseH = h * 0.8;
      
      // Solid base foundation box extending down to planet surface
      addBox(basePos, w * 0.98, maxBaseLen, d * 0.98, gravelCol, r, n, f, vertices, colors, indices);

      // Base gravel floor
      addBox(p, w, baseH, d, gravelCol, r, n, f, vertices, colors, indices);
      
      // Stone slabs on top - packed grid
      const seedVal = item.seed || (item.position[0] * 123.4 + item.position[2] * 56.7);
      function pRand(s) {
        let x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }
      
      const gridCols = 5;
      const gridRows = 5;
      const cellW = w / gridCols;
      const cellD = d / gridRows;
      
      for (let i = 0; i < gridCols; i++) {
        for (let j = 0; j < gridRows; j++) {
          const stoneSeed = seedVal + i * 13.1 + j * 7.9;
          
          const gapX = cellW * 0.15; // gap for gravel
          const gapZ = cellD * 0.15;
          
          const cx = -w/2 + cellW/2 + i * cellW;
          const cz = -d/2 + cellD/2 + j * cellD;
          
          const ox = (pRand(stoneSeed) - 0.5) * (gapX);
          const oz = (pRand(stoneSeed + 1) - 0.5) * (gapZ);
          
          const sw = cellW - gapX + (pRand(stoneSeed + 2) - 0.5) * gapX;
          const sd = cellD - gapZ + (pRand(stoneSeed + 3) - 0.5) * gapZ;
          const sh = h * 0.4 + pRand(stoneSeed + 4) * (h * 0.2);
          
          const shade = 0.65 + pRand(stoneSeed + 5) * 0.1;
          const stoneCol = [shade, shade, shade - 0.02];
          
          const sp = [
            p[0] + r[0]*(cx+ox) + f[0]*(cz+oz) + n[0]*(baseH/2 + sh/2),
            p[1] + r[1]*(cx+ox) + f[1]*(cz+oz) + n[1]*(baseH/2 + sh/2),
            p[2] + r[2]*(cx+ox) + f[2]*(cz+oz) + n[2]*(baseH/2 + sh/2)
          ];
          
          const angle = (pRand(stoneSeed + 6) - 0.5) * Math.PI * 0.1;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          
          const stoneR = [
            r[0] * cosA + f[0] * sinA,
            r[1] * cosA + f[1] * sinA,
            r[2] * cosA + f[2] * sinA
          ];
          const stoneF = [
            f[0] * cosA - r[0] * sinA,
            f[1] * cosA - r[1] * sinA,
            f[2] * cosA - r[2] * sinA
          ];
          
          addBox(sp, sw, sh, sd, stoneCol, stoneR, n, stoneF, vertices, colors, indices);
        }
      }
    }
  }
};

