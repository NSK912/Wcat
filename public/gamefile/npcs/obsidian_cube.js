// === SEEDPLANET MODULE: JS/NPCS/OBSIDIAN_CUBE.JS ===
// Gilded Obsidian Monolith / Black Gold Floating Diamond Cube (ศิลาออบซิเดียนลายทองคำ)
// Inspired by black obsidian marble with rich glowing Kintsugi gold veins,
// oriented as a diamond square standing on its vertex, gently floating in the air.
// Fully immune to arrow attacks!

(function() {
  window.buildObsidianCubeModel = function(
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

    const scale = 0.42 * (scaleMultiplier || 1.0);
    const phase = animPhase || 0;

    // Levitation vertical floating bob (rests on ground if ragdoll/dead)
    const levitateY = isRagdoll ? -0.25 : Math.sin(phase * 2.2) * 0.08;

    // Rotation around normal (Y axis) for mysterious hovering spin
    const spinAngle = isRagdoll ? 0 : phase * 0.65;
    const cosS = Math.cos(spinAngle);
    const sinS = Math.sin(spinAngle);

    // Subtle tilting oscillation
    const tiltX = isRagdoll ? 0.35 : Math.sin(phase * 1.3) * 0.06;
    const tiltZ = isRagdoll ? 0.15 : Math.cos(phase * 1.7) * 0.06;

    // Helper: transform local point with spin and hover
    const p = (x, y, z) => {
      // 1. Tilt
      let tx = x;
      let ty = y - z * tiltX;
      let tz = z + y * tiltX;

      tx = tx + tz * tiltZ;

      // 2. Spin around Y (normal)
      const rx = tx * cosS - tz * sinS;
      const ry = ty + levitateY;
      const rz = tx * sinS + tz * cosS;

      return transformPoint(rx * scale, ry * scale, rz * scale);
    };

    // Helper: add quadrilateral
    const addQuad = (p0, p1, p2, p3, col) => {
      const idx = vertices.length / 3;
      vertices.push(
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
      );
      const cFinal = overrideColors || col;
      for (let i = 0; i < 4; i++) {
        colors.push(cFinal[0], cFinal[1], cFinal[2]);
      }
      indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
      indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2); // double sided
    };

    // Helper: add triangle
    const addTri = (p0, p1, p2, col) => {
      const idx = vertices.length / 3;
      vertices.push(
        p0[0], p0[1], p0[2],
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2]
      );
      const cFinal = overrideColors || col;
      for (let i = 0; i < 3; i++) {
        colors.push(cFinal[0], cFinal[1], cFinal[2]);
      }
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx, idx + 2, idx + 1); // double sided
    };

    // Color Palette: Deep black obsidian marble with radiant Kintsugi gold veins
    const colObsidianDark  = [0.03, 0.03, 0.04];
    const colObsidianMid   = [0.08, 0.08, 0.10];
    const colObsidianSheen = [0.14, 0.14, 0.17];
    const colGoldBright    = [1.00, 0.88, 0.28];
    const colGoldDeep      = [0.88, 0.68, 0.14];
    const colGoldGlow      = [1.00, 0.95, 0.60];
    const colGoldAccent    = [0.96, 0.76, 0.20];

    // ========================================================
    // 1. MAIN DIAMOND MONOLITH (Rotated Regular Square Profile)
    // As in Image 2: A square standing at 45° with 90° corners
    // In 3D: A regular diamond octahedron bipyramid with beveled facets
    // ========================================================
    const H = 0.92; // Apex height (Top & Bottom points)
    const W = 0.72; // Equatorial width (4 corners at 90 degrees)

    // Primary Equatorial Points (forming a regular square in XZ plane, standing upright)
    const eq0 = [ W,  0.0,  0.0];
    const eq1 = [ 0.0, 0.0,  W];
    const eq2 = [-W,  0.0,  0.0];
    const eq3 = [ 0.0, 0.0, -W];

    // Top and Bottom Apex Points
    const topApex = [0.0,  H, 0.0];
    const btmApex = [0.0, -H, 0.0];

    // Midpoint fissure nodes for Kintsugi gold veins across faces
    // Each of the 8 main faces is subdivided into fractured obsidian plates with gold veins
    const eqList = [eq0, eq1, eq2, eq3];
    for (let i = 0; i < 4; i++) {
      const pA = eqList[i];
      const pB = eqList[(i + 1) % 4];

      // Midpoints along the outer edge
      const midEdge = [(pA[0] + pB[0]) * 0.5, 0.0, (pA[2] + pB[2]) * 0.5];

      // Top face fracture center
      const midTop = [(pA[0] + pB[0]) * 0.35, H * 0.42, (pA[2] + pB[2]) * 0.35];
      // Bottom face fracture center
      const midBtm = [(pA[0] + pB[0]) * 0.35, -H * 0.42, (pA[2] + pB[2]) * 0.35];

      // --- Upper Diamond Facets (Obsidian Plates) ---
      addTri(p(topApex[0], topApex[1], topApex[2]), p(pA[0], pA[1], pA[2]), p(midTop[0], midTop[1], midTop[2]), i % 2 === 0 ? colObsidianDark : colObsidianMid);
      addTri(p(topApex[0], topApex[1], topApex[2]), p(midTop[0], midTop[1], midTop[2]), p(pB[0], pB[1], pB[2]), (i % 2 === 1) ? colObsidianSheen : colObsidianDark);
      addTri(p(pA[0], pA[1], pA[2]), p(midEdge[0], midEdge[1], midEdge[2]), p(midTop[0], midTop[1], midTop[2]), colObsidianMid);
      addTri(p(midEdge[0], midEdge[1], midEdge[2]), p(pB[0], pB[1], pB[2]), p(midTop[0], midTop[1], midTop[2]), colObsidianDark);

      // --- Lower Diamond Facets (Obsidian Plates) ---
      addTri(p(btmApex[0], btmApex[1], btmApex[2]), p(midBtm[0], midBtm[1], midBtm[2]), p(pA[0], pA[1], pA[2]), (i % 2 === 0) ? colObsidianSheen : colObsidianDark);
      addTri(p(btmApex[0], btmApex[1], btmApex[2]), p(pB[0], pB[1], pB[2]), p(midBtm[0], midBtm[1], midBtm[2]), colObsidianDark);
      addTri(p(pA[0], pA[1], pA[2]), p(midBtm[0], midBtm[1], midBtm[2]), p(midEdge[0], midEdge[1], midEdge[2]), colObsidianDark);
      addTri(p(midEdge[0], midEdge[1], midEdge[2]), p(midBtm[0], midBtm[1], midBtm[2]), p(pB[0], pB[1], pB[2]), colObsidianMid);

      // --- Golden Kintsugi Veins & Seams along fractures ---
      const veinW = 0.024;
      const vTop1 = [midTop[0] * 1.01, midTop[1], midTop[2] * 1.01];
      const vTop2 = [midTop[0] * 1.01 + veinW, midTop[1] - veinW, midTop[2] * 1.01];
      addTri(p(topApex[0], topApex[1], topApex[2]), p(vTop1[0], vTop1[1], vTop1[2]), p(vTop2[0], vTop2[1], vTop2[2]), colGoldBright);

      const vBtm1 = [midBtm[0] * 1.01, midBtm[1], midBtm[2] * 1.01];
      const vBtm2 = [midBtm[0] * 1.01 - veinW, midBtm[1] + veinW, midBtm[2] * 1.01];
      addTri(p(btmApex[0], btmApex[1], btmApex[2]), p(vBtm1[0], vBtm1[1], vBtm1[2]), p(vBtm2[0], vBtm2[1], vBtm2[2]), colGoldBright);

      // Equatorial Golden Band Segment
      addQuad(
        p(pA[0] * 1.01, -0.018, pA[2] * 1.01),
        p(pB[0] * 1.01, -0.018, pB[2] * 1.01),
        p(pB[0] * 1.01,  0.018, pB[2] * 1.01),
        p(pA[0] * 1.01,  0.018, pA[2] * 1.01),
        colGoldDeep
      );
    }

    // ========================================================
    // 2. FOUR 90° CORNER GOLDEN BRACKETS (Image 2 Corner Accents)
    // Golden metal caps highlighting the 4 diamond points
    // ========================================================
    const capSize = 0.09;
    for (let i = 0; i < 4; i++) {
      const cp = eqList[i];
      const dirX = Math.sign(cp[0]);
      const dirZ = Math.sign(cp[2]);

      const cOuter = [cp[0] + dirX * 0.035, 0.0, cp[2] + dirZ * 0.035];
      const cTop   = [cp[0] * 0.85,  capSize, cp[2] * 0.85];
      const cBtm   = [cp[0] * 0.85, -capSize, cp[2] * 0.85];
      const cLeft  = [cp[0] * 0.85 - dirZ * capSize, 0.0, cp[2] * 0.85 + dirX * capSize];
      const cRight = [cp[0] * 0.85 + dirZ * capSize, 0.0, cp[2] * 0.85 - dirX * capSize];

      addTri(p(cOuter[0], cOuter[1], cOuter[2]), p(cTop[0], cTop[1], cTop[2]), p(cLeft[0], cLeft[1], cLeft[2]), colGoldBright);
      addTri(p(cOuter[0], cOuter[1], cOuter[2]), p(cRight[0], cRight[1], cRight[2]), p(cTop[0], cTop[1], cTop[2]), colGoldBright);
      addTri(p(cOuter[0], cOuter[1], cOuter[2]), p(cBtm[0], cBtm[1], cBtm[2]), p(cRight[0], cRight[1], cRight[2]), colGoldDeep);
      addTri(p(cOuter[0], cOuter[1], cOuter[2]), p(cLeft[0], cLeft[1], cLeft[2]), p(cBtm[0], cBtm[1], cBtm[2]), colGoldDeep);
    }

    // Top & Bottom Gold Finial Caps
    const finialH = 0.08;
    const finialW = 0.05;
    // Top Finial
    addTri(p(0, H + finialH, 0), p(-finialW, H - 0.03, -finialW), p( finialW, H - 0.03, -finialW), colGoldGlow);
    addTri(p(0, H + finialH, 0), p( finialW, H - 0.03, -finialW), p( finialW, H - 0.03,  finialW), colGoldBright);
    addTri(p(0, H + finialH, 0), p( finialW, H - 0.03,  finialW), p(-finialW, H - 0.03,  finialW), colGoldGlow);
    addTri(p(0, H + finialH, 0), p(-finialW, H - 0.03,  finialW), p(-finialW, H - 0.03, -finialW), colGoldBright);

    // Bottom Finial
    addTri(p(0, -H - finialH, 0), p( finialW, -H + 0.03, -finialW), p(-finialW, -H + 0.03, -finialW), colGoldDeep);
    addTri(p(0, -H - finialH, 0), p( finialW, -H + 0.03,  finialW), p( finialW, -H + 0.03, -finialW), colGoldBright);
    addTri(p(0, -H - finialH, 0), p(-finialW, -H + 0.03,  finialW), p( finialW, -H + 0.03,  finialW), colGoldDeep);
    addTri(p(0, -H - finialH, 0), p(-finialW, -H + 0.03, -finialW), p(-finialW, -H + 0.03,  finialW), colGoldBright);

    // ========================================================
    // 3. INNER RADIANT GOLDEN CORE
    // Pulsating gold core glowing through internal geometry
    // ========================================================
    const corePulse = 0.16 + Math.sin(phase * 4.0) * 0.025;
    const cT = [0,  corePulse, 0];
    const cB = [0, -corePulse, 0];
    const c0 = [ corePulse, 0, 0];
    const c1 = [0, 0,  corePulse];
    const c2 = [-corePulse, 0, 0];
    const c3 = [0, 0, -corePulse];

    addTri(p(cT[0], cT[1], cT[2]), p(c0[0], c0[1], c0[2]), p(c1[0], c1[1], c1[2]), colGoldGlow);
    addTri(p(cT[0], cT[1], cT[2]), p(c1[0], c1[1], c1[2]), p(c2[0], c2[1], c2[2]), colGoldBright);
    addTri(p(cT[0], cT[1], cT[2]), p(c2[0], c2[1], c2[2]), p(c3[0], c3[1], c3[2]), colGoldGlow);
    addTri(p(cT[0], cT[1], cT[2]), p(c3[0], c3[1], c3[2]), p(c0[0], c0[1], c0[2]), colGoldBright);

    addTri(p(cB[0], cB[1], cB[2]), p(c1[0], c1[1], c1[2]), p(c0[0], c0[1], c0[2]), colGoldDeep);
    addTri(p(cB[0], cB[1], cB[2]), p(c2[0], c2[1], c2[2]), p(c1[0], c1[1], c1[2]), colGoldAccent);
    addTri(p(cB[0], cB[1], cB[2]), p(c3[0], c3[1], c3[2]), p(c2[0], c2[1], c2[2]), colGoldDeep);
    addTri(p(cB[0], cB[1], cB[2]), p(c0[0], c0[1], c0[2]), p(c3[0], c3[1], c3[2]), colGoldAccent);

    // ========================================================
    // 4. FOUR ORBITING SATELLITE SHARDS (Levitating Fragments)
    // Small diamond shards orbiting around the monolith
    // ========================================================
    const orbitRadius = 1.15;
    for (let s = 0; s < 4; s++) {
      const sAngle = phase * 1.4 + (s * Math.PI * 0.5);
      const sBob = Math.sin(phase * 3.0 + s * 1.5) * 0.12;
      const sx = Math.cos(sAngle) * orbitRadius;
      const sy = sBob;
      const sz = Math.sin(sAngle) * orbitRadius;

      const shW = 0.08;
      const shH = 0.13;

      // Small diamond shard vertices
      const shTop = [sx, sy + shH, sz];
      const shBtm = [sx, sy - shH, sz];
      const shE0  = [sx + shW, sy, sz];
      const shE1  = [sx, sy, sz + shW];
      const shE2  = [sx - shW, sy, sz];
      const shE3  = [sx, sy, sz - shW];

      addTri(p(shTop[0], shTop[1], shTop[2]), p(shE0[0], shE0[1], shE0[2]), p(shE1[0], shE1[1], shE1[2]), colObsidianDark);
      addTri(p(shTop[0], shTop[1], shTop[2]), p(shE1[0], shE1[1], shE1[2]), p(shE2[0], shE2[1], shE2[2]), colGoldBright);
      addTri(p(shTop[0], shTop[1], shTop[2]), p(shE2[0], shE2[1], shE2[2]), p(shE3[0], shE3[1], shE3[2]), colObsidianDark);
      addTri(p(shTop[0], shTop[1], shTop[2]), p(shE3[0], shE3[1], shE3[2]), p(shE0[0], shE0[1], shE0[2]), colGoldBright);

      addTri(p(shBtm[0], shBtm[1], shBtm[2]), p(shE1[0], shE1[1], shE1[2]), p(shE0[0], shE0[1], shE0[2]), colGoldDeep);
      addTri(p(shBtm[0], shBtm[1], shBtm[2]), p(shE2[0], shE2[1], shE2[2]), p(shE1[0], shE1[1], shE1[2]), colObsidianDark);
      addTri(p(shBtm[0], shBtm[1], shBtm[2]), p(shE3[0], shE3[1], shE3[2]), p(shE2[0], shE2[1], shE2[2]), colGoldDeep);
      addTri(p(shBtm[0], shBtm[1], shBtm[2]), p(shE0[0], shE0[1], shE0[2]), p(shE3[0], shE3[1], shE3[2]), colObsidianDark);
    }
  };

  // Register in Global NPC Registry
  window.NpcRegistry = window.NpcRegistry || {};
  window.NpcRegistry["obsidian_cube"] = {
    maxHp: 6,
    immuneToArrows: true,
    name: "ศิลาออบซิเดียนลายทอง (Gilded Obsidian Cube)",
    icon: "🔶",
    moveSpeed: 0.25,
    disableRandomJitter: false,

    // Smooth floating navigation behavior using standard NPC movement system
    updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
      if (c.ragdollEnabled || (c.hp !== undefined && c.hp <= 0)) {
        const baseR = Math.max(gRadius, wRadius);
        c.r = baseR + 0.12;
        return;
      }

      if (c.animPhase === undefined) c.animPhase = Math.random() * Math.PI * 2;
      c.animPhase += deltaTime * 1.6;

      // Keep NPC hovering serenely above ground or water
      const baseR = Math.max(gRadius, wRadius);
      let targetR = baseR + 1.25 + Math.sin(c.animPhase * 2.0) * 0.22;

      // If inside cave, limit height below ceiling
      if (npcCaveData && npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
        targetR = Math.min(targetR, npcCaveData.ceiling - 0.35);
      }

      // Smooth vertical lerp
      if (c.r === undefined) c.r = targetR;
      c.r += (targetR - c.r) * Math.min(1.0, deltaTime * 3.5);

      c.isSwimming = false;
    },

    render: function(c, allVertices, allColors, allIndices, scale, N, R, F, pos, f, transformPoint, seed) {
      window.buildObsidianCubeModel(
        c.seed !== undefined ? c.seed : seed,
        c.animPhase,
        c.ragdollEnabled,
        false,
        1.0,
        pos,
        R,
        N,
        F,
        allVertices,
        allColors,
        allIndices,
        null,
        f,
        transformPoint,
        c
      );
    }
  };

  console.log("🔶 Obsidian Cube NPC Module Initialized: Gilded Obsidian Monolith Loaded");
})();
