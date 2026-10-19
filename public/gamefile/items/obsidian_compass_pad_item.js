// === SEEDPLANET MODULE: JS/ITEMS/OBSIDIAN_COMPASS_PAD_ITEM.JS ===
// Gilded Obsidian Warp Pad / Platform (OBSIDIAN PAD Warp)
// Crafted from 1x Obsidian Cube + 1x Glow Ore.

(function() {
  window.buildObsidianCompassPadModel = function(
    seed,
    animPhase,
    isRagdoll,
    isSwimming,
    scaleMultiplier,
    pos,
    R,
    N,
    F,
    vertices,
    colors,
    indices,
    overrideColors = null,
    f = null,
    transformPoint = null,
    c = null
  ) {
    if (!transformPoint) {
      transformPoint = (px, py, pz) => {
        const basePos = (pos && Array.isArray(pos) && pos.length >= 3) ? pos : ((c && c.position) || [0, 0, 0]);
        return [
          basePos[0] + (px * R[0] + py * N[0] + pz * F[0]),
          basePos[1] + (px * R[1] + py * N[1] + pz * F[1]),
          basePos[2] + (px * R[2] + py * N[2] + pz * F[2]),
        ];
      };
    }

    const scale = 0.275 * (scaleMultiplier || 1.0);
    const colObsidian = overrideColors || [0.12, 0.13, 0.16];
    const colGold = overrideColors || [0.95, 0.78, 0.23]; // Calibrated 24K metallic gold
    const colGlow = overrideColors || [0.98, 0.98, 1.0]; // Bright white glowing energy core from Glow Ore

    const p = (x, y, z) => transformPoint(x * scale, y * scale, z * scale);

    function addQuad(p0, p1, p2, p3, col) {
      const idx = vertices.length / 3;
      vertices.push(
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
      );
      for (let i = 0; i < 4; i++) {
        colors.push(col[0], col[1], col[2]);
      }
      indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
      indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2); // double sided
    }

    function addTri(p0, p1, p2, col) {
      const idx = vertices.length / 3;
      vertices.push(
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2]
      );
      for (let i = 0; i < 3; i++) {
        colors.push(col[0], col[1], col[2]);
      }
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx, idx + 2, idx + 1); // double sided
    }

    function buildCylinderSegment(y1, y2, r1, r2, segs, col) {
      const v1 = [];
      const v2 = [];
      for (let i = 0; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        v1.push([r1 * cosA, y1, r1 * sinA]);
        v2.push([r2 * cosA, y2, r2 * sinA]);
      }

      for (let i = 0; i < segs; i++) {
        addQuad(
          p(v1[i][0], v1[i][1], v1[i][2]),
          p(v1[i + 1][0], v1[i + 1][1], v1[i + 1][2]),
          p(v2[i + 1][0], v2[i + 1][1], v2[i + 1][2]),
          p(v2[i][0], v2[i][1], v2[i][2]),
          col
        );
      }
    }

    // 1. Disc Base Body (Symmetrical top and bottom)
    const segs = 28;
    const radius = 0.55;
    const height = 0.12;

    // Beveled bottom rim
    buildCylinderSegment(0, height * 0.12, radius * 0.92, radius * 0.98, segs, colObsidian);
    // Lower side section
    buildCylinderSegment(height * 0.12, height * 0.44, radius * 0.98, radius, segs, colObsidian);
    // Gold side trim band in middle
    buildCylinderSegment(height * 0.44, height * 0.56, radius, radius, segs, colGold);
    // Upper side section
    buildCylinderSegment(height * 0.56, height * 0.88, radius, radius * 0.98, segs, colObsidian);
    // Beveled top rim
    buildCylinderSegment(height * 0.88, height, radius * 0.98, radius * 0.92, segs, colObsidian);

    // Bottom surface disc
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * Math.PI * 2;
      const a2 = ((i + 1) / segs) * Math.PI * 2;
      const rOuter = radius * 0.92;

      const p1 = [rOuter * Math.cos(a1), 0, rOuter * Math.sin(a1)];
      const p2 = [rOuter * Math.cos(a2), 0, rOuter * Math.sin(a2)];

      addTri(p(0, 0, 0), p(p2[0], p2[1], p2[2]), p(p1[0], p1[1], p1[2]), colObsidian);
    }

    // Top surface disc
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * Math.PI * 2;
      const a2 = ((i + 1) / segs) * Math.PI * 2;
      const rOuter = radius * 0.92;

      const p1 = [rOuter * Math.cos(a1), height, rOuter * Math.sin(a1)];
      const p2 = [rOuter * Math.cos(a2), height, rOuter * Math.sin(a2)];

      addTri(p(0, height, 0), p(p1[0], p1[1], p1[2]), p(p2[0], p2[1], p2[2]), colObsidian);
    }

    // 2. Gold Ring Inlay on BOTH Top and Bottom
    const ringR1 = radius * 0.72;
    const ringR2 = radius * 0.76;
    const hTop = height + 0.003;
    const hBot = -0.003;

    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * Math.PI * 2;
      const a2 = ((i + 1) / segs) * Math.PI * 2;

      const o1Top = [ringR2 * Math.cos(a1), hTop, ringR2 * Math.sin(a1)];
      const o2Top = [ringR2 * Math.cos(a2), hTop, ringR2 * Math.sin(a2)];
      const i1Top = [ringR1 * Math.cos(a1), hTop, ringR1 * Math.sin(a1)];
      const i2Top = [ringR1 * Math.cos(a2), hTop, ringR1 * Math.sin(a2)];

      addQuad(p(i1Top[0], i1Top[1], i1Top[2]), p(o1Top[0], o1Top[1], o1Top[2]), p(o2Top[0], o2Top[1], o2Top[2]), p(i2Top[0], i2Top[1], i2Top[2]), colGold);

      const o1Bot = [ringR2 * Math.cos(a1), hBot, ringR2 * Math.sin(a1)];
      const o2Bot = [ringR2 * Math.cos(a2), hBot, ringR2 * Math.sin(a2)];
      const i1Bot = [ringR1 * Math.cos(a1), hBot, ringR1 * Math.sin(a1)];
      const i2Bot = [ringR1 * Math.cos(a2), hBot, ringR1 * Math.sin(a2)];

      addQuad(p(i1Bot[0], i1Bot[1], i1Bot[2]), p(i2Bot[0], i2Bot[1], i2Bot[2]), p(o2Bot[0], o2Bot[1], o2Bot[2]), p(o1Bot[0], o1Bot[1], o1Bot[2]), colGold);
    }

    // 3. Central glowing WHITE bars & compass ticks (N, S, E, W) on BOTH Top and Bottom
    const hMarkTop = height + 0.005;
    const hMarkBot = -0.005;

    // --- TOP FACE ---
    // Center glowing white bars
    addQuad(p(-0.015, hMarkTop, -0.08), p(0.015, hMarkTop, -0.08), p(0.015, hMarkTop, 0.08), p(-0.015, hMarkTop, 0.08), colGlow);
    addQuad(p(-0.045, hMarkTop, -0.05), p(-0.025, hMarkTop, -0.05), p(-0.025, hMarkTop, 0.05), p(-0.045, hMarkTop, 0.05), colGlow);
    addQuad(p(0.025, hMarkTop, -0.05), p(0.045, hMarkTop, -0.05), p(0.045, hMarkTop, 0.05), p(0.025, hMarkTop, 0.05), colGlow);

    // N S E W Tick marks
    const tickR1 = ringR2 + 0.01;
    const tickR2 = ringR2 + 0.05;
    addQuad(p(-0.02, hMarkTop, -tickR2), p(0.02, hMarkTop, -tickR2), p(0.02, hMarkTop, -tickR1), p(-0.02, hMarkTop, -tickR1), colGold);
    addQuad(p(-0.02, hMarkTop, tickR1), p(0.02, hMarkTop, tickR1), p(0.02, hMarkTop, tickR2), p(-0.02, hMarkTop, tickR2), colGold);
    addQuad(p(tickR1, hMarkTop, -0.02), p(tickR2, hMarkTop, -0.02), p(tickR2, hMarkTop, 0.02), p(tickR1, hMarkTop, 0.02), colGold);
    addQuad(p(-tickR2, hMarkTop, -0.02), p(-tickR1, hMarkTop, -0.02), p(-tickR1, hMarkTop, 0.02), p(-tickR2, hMarkTop, 0.02), colGold);

    // --- BOTTOM FACE ---
    // Center glowing white bars
    addQuad(p(-0.015, hMarkBot, -0.08), p(-0.015, hMarkBot, 0.08), p(0.015, hMarkBot, 0.08), p(0.015, hMarkBot, -0.08), colGlow);
    addQuad(p(-0.045, hMarkBot, -0.05), p(-0.045, hMarkBot, 0.05), p(-0.025, hMarkBot, 0.05), p(-0.025, hMarkBot, -0.05), colGlow);
    addQuad(p(0.025, hMarkBot, -0.05), p(0.025, hMarkBot, 0.05), p(0.045, hMarkBot, 0.05), p(0.045, hMarkBot, -0.05), colGlow);

    // N S E W Tick marks
    addQuad(p(-0.02, hMarkBot, -tickR2), p(-0.02, hMarkBot, -tickR1), p(0.02, hMarkBot, -tickR1), p(0.02, hMarkBot, -tickR2), colGold);
    addQuad(p(-0.02, hMarkBot, tickR1), p(-0.02, hMarkBot, tickR2), p(0.02, hMarkBot, tickR2), p(0.02, hMarkBot, tickR1), colGold);
    addQuad(p(tickR1, hMarkBot, -0.02), p(tickR1, hMarkBot, 0.02), p(tickR2, hMarkBot, 0.02), p(tickR2, hMarkBot, -0.02), colGold);
    addQuad(p(-tickR2, hMarkBot, -0.02), p(-tickR2, hMarkBot, 0.02), p(-tickR1, hMarkBot, 0.02), p(-tickR1, hMarkBot, -0.02), colGold);
  };

  const renderHandler = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const p = item.position || [0, 0, 0];
      const itemR = item.R || [1, 0, 0];
      const itemF = item.F || [0, 0, 1];
      const itemN = item.normal || [0, 1, 0];
      const isPreview = item.isPreview;
      const isValid = item.isValidPlacement !== false;

      let overrideColors = null;
      if (isPreview) {
         overrideColors = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
      }

      window.buildObsidianCompassPadModel(
        item.seed || 1234,
        0,
        false,
        false,
        1.0,
        p,
        itemR, itemN, itemF,
        vertices, colors, indices,
        overrideColors,
        null,
        null
      );
    }
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["obsidian_pad_warp_item"] = renderHandler;
  window.ItemRegistry["obsidian_compass_pad_item"] = renderHandler;
})();
