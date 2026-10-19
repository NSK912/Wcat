// === SEEDPLANET MODULE: JS/ITEMS/FOLDING_LADDER.JS ===
// Death Stranding style Extendable Folding Ladder (บันไดพับ)

(function() {
  function drawBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    if (typeof addBox === "function") {
      addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
      return;
    }
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    let r = right || [1, 0, 0];
    let u = up || [0, 1, 0];
    let f = forward || [0, 0, 1];

    const det = (r[1] * u[2] - r[2] * u[1]) * f[0] + (r[2] * u[0] - r[0] * u[2]) * f[1] + (r[0] * u[1] - r[1] * u[0]) * f[2];
    if (det < 0) {
      r = [-r[0], -r[1], -r[2]];
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
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      2, 3, 7, 2, 7, 6,
      0, 7, 3, 0, 4, 7,
      1, 2, 6, 1, 6, 5,
    ];

    const baseIdx = outVertices.length / 3;
    for (let i = 0; i < 8; i++) {
      const v = cubeVerts[i];
      const rx = r[0] * v[0] + u[0] * v[1] + f[0] * v[2];
      const ry = r[1] * v[0] + u[1] * v[1] + f[1] * v[2];
      const rz = r[2] * v[0] + u[2] * v[1] + f[2] * v[2];
      outVertices.push(center[0] + rx, center[1] + ry, center[2] + rz);
      outColors.push(color[0], color[1], color[2]);
    }

    for (let i = 0; i < cubeIndices.length; i++) {
      outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  window.ItemRegistry = window.ItemRegistry || {};

  window.ItemRegistry["folding_ladder"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position || [0, 0, 0];
      const r = item.R || [1, 0, 0];
      const f = item.F || [0, 0, 1];
      const n = item.normal || [0, 1, 0];

      let P_top = item.stairTop;
      let P_bottom = item.stairBottom;

      if (!P_top || !P_bottom) {
        // Flat forward fallback if not yet positioned
        P_top = [p[0] + f[0] * 1.0, p[1] + f[1] * 1.0, p[2] + f[2] * 1.0];
        P_bottom = [p[0] - f[0] * 1.0, p[1] - f[1] * 1.0, p[2] - f[2] * 1.0];
      }

      const dir_v = [P_top[0] - P_bottom[0], P_top[1] - P_bottom[1], P_top[2] - P_bottom[2]];
      const len_v = Math.sqrt(dir_v[0] * dir_v[0] + dir_v[1] * dir_v[1] + dir_v[2] * dir_v[2]) || 1;
      const dir_un = [dir_v[0] / len_v, dir_v[1] / len_v, dir_v[2] / len_v];

      // N_ladder is normal pointing out from the ladder plane (N = dir_un x r)
      let N_ladder = [
        dir_un[1] * r[2] - dir_un[2] * r[1],
        dir_un[2] * r[0] - dir_un[0] * r[2],
        dir_un[0] * r[1] - dir_un[1] * r[0]
      ];
      let lenN = Math.sqrt(N_ladder[0] * N_ladder[0] + N_ladder[1] * N_ladder[1] + N_ladder[2] * N_ladder[2]);
      if (lenN < 0.001) {
        // Fallback: derive N_ladder from planet normal n
        const dotNDir = n[0] * dir_un[0] + n[1] * dir_un[1] + n[2] * dir_un[2];
        N_ladder = [n[0] - dir_un[0] * dotNDir, n[1] - dir_un[1] * dotNDir, n[2] - dir_un[2] * dotNDir];
        lenN = Math.hypot(N_ladder[0], N_ladder[1], N_ladder[2]) || 1;
      }
      N_ladder = [N_ladder[0] / lenN, N_ladder[1] / lenN, N_ladder[2] / lenN];

      let ladderR = [r[0], r[1], r[2]];

      // Align N_ladder to face outward from planet center
      if (N_ladder[0] * n[0] + N_ladder[1] * n[1] + N_ladder[2] * n[2] < 0) {
        N_ladder[0] = -N_ladder[0];
        N_ladder[1] = -N_ladder[1];
        N_ladder[2] = -N_ladder[2];
        ladderR[0] = -ladderR[0];
        ladderR[1] = -ladderR[1];
        ladderR[2] = -ladderR[2];
      }

      // Re-orthogonalize ladderR = N_ladder x dir_un
      ladderR = [
        N_ladder[1] * dir_un[2] - N_ladder[2] * dir_un[1],
        N_ladder[2] * dir_un[0] - N_ladder[0] * dir_un[2],
        N_ladder[0] * dir_un[1] - N_ladder[1] * dir_un[0]
      ];
      const lenR = Math.sqrt(ladderR[0] * ladderR[0] + ladderR[1] * ladderR[1] + ladderR[2] * ladderR[2]) || 1;
      ladderR = [ladderR[0] / lenR, ladderR[1] / lenR, ladderR[2] / lenR];

      // Death Stranding Styling: High-tech reinforced iron/alloy frame
      const isPreview = item.isPreview === true;
      const isValid = item.isValidPlacement !== false;
      const previewCol = isValid ? [0.2, 0.85, 1.0] : [1.0, 0.25, 0.25]; // Hologram cyan/amber
      
      const railColor = isPreview ? previewCol : [0.38, 0.40, 0.44];       // Metallic alloy steel
      const rungColor = isPreview ? previewCol : [0.72, 0.75, 0.78];       // Bright brushed iron
      const jointColor = isPreview ? previewCol : [0.18, 0.20, 0.22];      // Dark carbon joint locks
      const accentColor = isPreview ? previewCol : [0.98, 0.65, 0.08];     // Hazard yellow/orange caution markers
      const footColor = isPreview ? previewCol : [0.15, 0.16, 0.17];       // Heavy rubber/iron feet

      const ladderWidth = 0.38;
      const railThick = 0.022;
      const railDepth = 0.045;
      const halfW = ladderWidth * 0.45;

      const midP = [
        (P_top[0] + P_bottom[0]) * 0.5,
        (P_top[1] + P_bottom[1]) * 0.5,
        (P_top[2] + P_bottom[2]) * 0.5
      ];

      // 1. Left Side Rail (Full length)
      const leftRailCenter = [
        midP[0] - ladderR[0] * halfW,
        midP[1] - ladderR[1] * halfW,
        midP[2] - ladderR[2] * halfW
      ];
      drawBox(leftRailCenter, railThick, railDepth, len_v, railColor, ladderR, N_ladder, dir_un, vertices, colors, indices);

      // 2. Right Side Rail (Full length)
      const rightRailCenter = [
        midP[0] + ladderR[0] * halfW,
        midP[1] + ladderR[1] * halfW,
        midP[2] + ladderR[2] * halfW
      ];
      drawBox(rightRailCenter, railThick, railDepth, len_v, railColor, ladderR, N_ladder, dir_un, vertices, colors, indices);

      // 3. Foldable Telescopic Joint Sleeves & Latch Hinges (Death Stranding signature)
      const numJoints = Math.max(1, Math.min(3, Math.floor(len_v / 1.0)));
      for (let j = 1; j <= numJoints; j++) {
        const jt = j / (numJoints + 1);
        const jointCenter = [
          P_bottom[0] + dir_v[0] * jt,
          P_bottom[1] + dir_v[1] * jt,
          P_bottom[2] + dir_v[2] * jt
        ];
        
        // Left hinge collar
        const lCollar = [
          jointCenter[0] - ladderR[0] * halfW,
          jointCenter[1] - ladderR[1] * halfW,
          jointCenter[2] - ladderR[2] * halfW
        ];
        drawBox(lCollar, railThick * 1.5, railDepth * 1.25, 0.045, jointColor, ladderR, N_ladder, dir_un, vertices, colors, indices);

        // Right hinge collar
        const rCollar = [
          jointCenter[0] + ladderR[0] * halfW,
          jointCenter[1] + ladderR[1] * halfW,
          jointCenter[2] + ladderR[2] * halfW
        ];
        drawBox(rCollar, railThick * 1.5, railDepth * 1.25, 0.045, jointColor, ladderR, N_ladder, dir_un, vertices, colors, indices);
      }

      // 4. Heavy-duty Rungs (Extending between rails)
      const rungSpacing = 0.18; // Clean, standard 18cm ladder rung spacing
      const numRungs = Math.max(2, Math.floor(len_v / rungSpacing));
      const rungWidth = ladderWidth - railThick * 1.8;
      const rungH = 0.016;
      const rungD = 0.024;

      for (let i = 0; i <= numRungs; i++) {
        const t = i / numRungs;
        const clampedT = 0.04 + t * 0.92;
        const rungCenter = [
          P_bottom[0] + dir_v[0] * clampedT,
          P_bottom[1] + dir_v[1] * clampedT,
          P_bottom[2] + dir_v[2] * clampedT
        ];
        const isHazardRung = (i % 3 === 0);
        drawBox(rungCenter, rungWidth, rungH, rungD, isHazardRung ? accentColor : rungColor, ladderR, N_ladder, dir_un, vertices, colors, indices);
      }

      // 5. Top Cliff / Ledge Anchor Clamp (Head)
      const topHookLength = 0.07;
      const lTopHook = [
        P_top[0] - ladderR[0] * halfW,
        P_top[1] - ladderR[1] * halfW,
        P_top[2] - ladderR[2] * halfW
      ];
      const rTopHook = [
        P_top[0] + ladderR[0] * halfW,
        P_top[1] + ladderR[1] * halfW,
        P_top[2] + ladderR[2] * halfW
      ];
      drawBox(lTopHook, railThick * 1.4, 0.025, topHookLength, jointColor, ladderR, N_ladder, dir_un, vertices, colors, indices);
      drawBox(rTopHook, railThick * 1.4, 0.025, topHookLength, jointColor, ladderR, N_ladder, dir_un, vertices, colors, indices);

      // Top crossbar anchor bar
      const topHandleCenter = [
        P_top[0],
        P_top[1],
        P_top[2]
      ];
      drawBox(topHandleCenter, ladderWidth, 0.018, 0.025, jointColor, ladderR, N_ladder, dir_un, vertices, colors, indices);

      // 6. Bottom Terrain Stabilizer Base Pads (Tail)
      const footW = 0.06;
      const footH = 0.022;
      const footD = 0.07;
      const lFoot = [
        P_bottom[0] - ladderR[0] * halfW,
        P_bottom[1] - ladderR[1] * halfW,
        P_bottom[2] - ladderR[2] * halfW
      ];
      const rFoot = [
        P_bottom[0] + ladderR[0] * halfW,
        P_bottom[1] + ladderR[1] * halfW,
        P_bottom[2] + ladderR[2] * halfW
      ];
      drawBox(lFoot, footW, footH, footD, footColor, ladderR, N_ladder, dir_un, vertices, colors, indices);
      drawBox(rFoot, footW, footH, footD, footColor, ladderR, N_ladder, dir_un, vertices, colors, indices);
    }
  };
})();
