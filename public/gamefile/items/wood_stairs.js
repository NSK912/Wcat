// === SEEDPLANET MODULE: JS/ITEMS/WOOD_STAIRS.JS ===

window.ItemRegistry["wood_stairs"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0], // sideways vector (tangent along the edge)
      f = item.F || [0, 0, 1],     // forward slope vector
      n = item.normal || [0, 1, 0]; // up vector of the parent floor panel
    
    let P_top = item.stairTop;
    let P_bottom = item.stairBottom;
    
    if (!P_top || !P_bottom) {
      P_top = [p[0] - f[0] * 0.175, p[1] - f[1] * 0.175, p[2] - f[2] * 0.175];
      P_bottom = [p[0] + f[0] * 0.175, p[1] + f[1] * 0.175, p[2] + f[2] * 0.175];
    }
    
    // Shift stairs down and outwards slightly to prevent top step and beams from poking above the snapped floor surface or clipping into it
    const vOffset = 0.01;
    
    const dir_v_initial = [P_top[0] - P_bottom[0], P_top[1] - P_bottom[1], P_top[2] - P_bottom[2]];
    const len_v_initial = Math.sqrt(dir_v_initial[0]*dir_v_initial[0] + dir_v_initial[1]*dir_v_initial[1] + dir_v_initial[2]*dir_v_initial[2]) || 1;
    const dir_un_initial = [dir_v_initial[0] / len_v_initial, dir_v_initial[1] / len_v_initial, dir_v_initial[2] / len_v_initial];
    
    const hOffset = 0.025; // Shift outward along slope
    
    P_top = [
      P_top[0] - n[0] * vOffset - dir_un_initial[0] * hOffset, 
      P_top[1] - n[1] * vOffset - dir_un_initial[1] * hOffset, 
      P_top[2] - n[2] * vOffset - dir_un_initial[2] * hOffset
    ];
    P_bottom = [
      P_bottom[0] - n[0] * vOffset - dir_un_initial[0] * hOffset, 
      P_bottom[1] - n[1] * vOffset - dir_un_initial[1] * hOffset, 
      P_bottom[2] - n[2] * vOffset - dir_un_initial[2] * hOffset
    ];
    
    const dir_v = [P_top[0] - P_bottom[0], P_top[1] - P_bottom[1], P_top[2] - P_bottom[2]];
    const len_v = Math.sqrt(dir_v[0]*dir_v[0] + dir_v[1]*dir_v[1] + dir_v[2]*dir_v[2]) || 1;
    const dir_un = [dir_v[0] / len_v, dir_v[1] / len_v, dir_v[2] / len_v];
    
    // N_stair is the orthogonal up vector of the inclined stair (N_stair = dir_un x r)
    let N_stair = [
      dir_un[1] * r[2] - dir_un[2] * r[1],
      dir_un[2] * r[0] - dir_un[0] * r[2],
      dir_un[0] * r[1] - dir_un[1] * r[0]
    ];
    let stairR = [r[0], r[1], r[2]];
    
    // Ensure N_stair points outwards away from planet center (matching n)
    if (N_stair[0] * n[0] + N_stair[1] * n[1] + N_stair[2] * n[2] < 0) {
      N_stair[0] = -N_stair[0];
      N_stair[1] = -N_stair[1];
      N_stair[2] = -N_stair[2];
      stairR[0] = -stairR[0];
      stairR[1] = -stairR[1];
      stairR[2] = -stairR[2];
    }
    
    // Render 2 side beams/stringers
    const w_stair = 0.3;
    const beamW = 0.02;
    const beamH = 0.035;
    
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0];
    const gCol = baseColor[1];
    const bCol = baseColor[2];
    const beamColor = [rCol * 0.8, gCol * 0.8, bCol * 0.8];
    
    // Left beam
    const pLeft = [
      P_bottom[0] + dir_v[0] * 0.5 - r[0] * (w_stair * 0.42),
      P_bottom[1] + dir_v[1] * 0.5 - r[1] * (w_stair * 0.42),
      P_bottom[2] + dir_v[2] * 0.5 - r[2] * (w_stair * 0.42)
    ];
    addBox(pLeft, beamW, beamH, len_v, beamColor, stairR, N_stair, dir_un, vertices, colors, indices);
    
    // Right beam
    const pRight = [
      P_bottom[0] + dir_v[0] * 0.5 + r[0] * (w_stair * 0.42),
      P_bottom[1] + dir_v[1] * 0.5 + r[1] * (w_stair * 0.42),
      P_bottom[2] + dir_v[2] * 0.5 + r[2] * (w_stair * 0.42)
    ];
    addBox(pRight, beamW, beamH, len_v, beamColor, stairR, N_stair, dir_un, vertices, colors, indices);
    
    // Render multiple stair steps/planks
    // Use standard 0.08 spacing. Roughly 5 steps per standard length stair
    const numSteps = Math.max(2, Math.floor(len_v / 0.08));
    const stepW = w_stair - 0.02;
    const stepH = 0.015;
    const stepD = 0.075;
    
    // Seed-based stable pseudo-random generator
    const seedVal = item.seed || (p[0] * 123.4 + p[2] * 56.7);
    function pRand(s) {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    }
    
    for (let i = 0; i < numSteps; i++) {
      const t = i / (numSteps - 1);
      const stepCenter = [
        P_bottom[0] + dir_v[0] * t,
        P_bottom[1] + dir_v[1] * t,
        P_bottom[2] + dir_v[2] * t
      ];
      
      const shadeNoise = pRand(seedVal + i * 17.3);
      const rStepCol = rCol * (0.85 + shadeNoise * 0.25);
      const gStepCol = gCol * (0.85 + shadeNoise * 0.25);
      const bStepCol = bCol * (0.85 + shadeNoise * 0.25);
      const stepColor = [rStepCol, gStepCol, bStepCol];
      
      // Draw flat horizontal step plank (tread)
      addBox(stepCenter, stepW, stepH, stepD, stepColor, r, n, f, vertices, colors, indices);
    }
  }
};
