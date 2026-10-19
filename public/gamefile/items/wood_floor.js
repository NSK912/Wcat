// === SEEDPLANET MODULE: JS/ITEMS/WOOD_FLOOR.JS ===

window.getFloorThickness = function(item) {
  const size = (item && item.size) || 0.25;
  const wfH = (typeof window !== "undefined" && typeof window.woodFloorHeight === "number") ? window.woodFloorHeight : 0.05;
  if (!item || item.type === "wood_floor") {
    return wfH + size * 0.12;
  } else if (item.type === "stone_floor") {
    return size * 0.15;
  } else if (item.type === "thin_wood_floor") {
    return size * 0.04;
  }
  return size * 0.08;
};

window.ItemRegistry["wood_floor"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R,
      f = item.F,
      n = item.normal;
        
    // "พื้นไม้" - A flat square platform/floor panel
    const w = item.width !== undefined ? item.width : item.size * 1.2; 
    const h = window.getFloorThickness(item); 
    const d = item.depth !== undefined ? item.depth : item.size * 1.2;
        
    if (item.isPreview) {
      const isValid = item.isValidPlacement !== false;
      const col = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
      addBox(p, w, h, d, col, r, n, f, vertices, colors, indices);
    } else {
      // Placed wood floor - render individual planks with wood grain shades
      const numPlanks = Math.max(1, Math.round((w / (item.size * 1.2)) * 4));
      const pw = w / numPlanks;
      const gap = 0.0; // no gap between planks
      const plankW = pw;
            
      // Seed-based stable pseudo-random generator
      const seedVal = item.seed || (item.position[0] * 123.4 + item.position[2] * 56.7);
      function pRand(s) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }
            
      const baseColor = item.color || [0.65, 0.45, 0.25];
            
      for (let i = 0; i < numPlanks; i++) {
        const t = -w / 2 + pw / 2 + i * pw;
        const plankCenter = [
          p[0] + r[0] * t,
          p[1] + r[1] * t,
          p[2] + r[2] * t
        ];
                
        const shadeNoise = pRand(seedVal + i * 17.3);
        // Vary base wooden color slightly to give authentic plank variation
        const rCol = baseColor[0] * (0.85 + shadeNoise * 0.3);
        const gCol = baseColor[1] * (0.85 + shadeNoise * 0.3);
        const bCol = baseColor[2] * (0.85 + shadeNoise * 0.3);
        const plankColor = [rCol, gCol, bCol];
                
        // Draw individual plank board
        addBox(plankCenter, plankW, h, d, plankColor, r, n, f, vertices, colors, indices);
                
        // Add dark wood grain lines on top of the plank
        const numGrainLines = 2;
        for (let j = 0; j < numGrainLines; j++) {
          const grainNoiseX = pRand(seedVal + i * 31.4 + j * 45.1);
          const grainNoiseL = pRand(seedVal + i * 19.8 + j * 73.2);
          const grainW = 0.005; 
          const grainH = h * 1.05; 
          const grainD = d * (0.3 + grainNoiseL * 0.6); 
                    
          const grainT = (grainNoiseX - 0.5) * (plankW * 0.65);
          const grainOffsetF = (pRand(seedVal + j * 91.3) - 0.5) * (d - grainD);
                    
          const grainCenter = [
            plankCenter[0] + r[0] * grainT + f[0] * grainOffsetF,
            plankCenter[1] + r[1] * grainT + f[1] * grainOffsetF,
            plankCenter[2] + r[2] * grainT + f[2] * grainOffsetF
          ];
                    
          // Dark brown color for the grain lines
          const grainColor = [rCol * 0.65, gCol * 0.65, bCol * 0.65];
          addBox(grainCenter, grainW, grainH, grainD, grainColor, r, n, f, vertices, colors, indices);
        }
      }
    }
  }
};

window.ItemRegistry["plank"] = window.ItemRegistry["wood_floor"];
window.ItemRegistry["thin_wood_floor"] = window.ItemRegistry["wood_floor"];
