// === SEEDPLANET MODULE: JS/NPCS/MEGANEURA.JS ===

window.buildMeganeuraModel = function(
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
  overrideColors = null, // For preview color replacement
  f = null,              // Sag force vector for ragdoll
  transformPoint = null, // Custom terrain-clipping transform
  c = null               // Active NPC object
) {
  // Use custom transformPoint if provided, otherwise default to a simple rotation/translation
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

  const getWigY = (z) => {
    if (isRagdoll || !isSwimming) return 0;
    const phase = animPhase - (0.4 - z) * 3.0;
    const amp = z < 0.4 ? (0.4 - z) * 0.08 : 0;
    return Math.sin(phase) * amp;
  };
  const getWigX = (z) => {
    if (isRagdoll || isSwimming) return 0;
    const phase = animPhase - (0.4 - z) * 3.0;
    const amp = z < 0.4 ? (0.4 - z) * 0.08 : 0;
    return Math.sin(phase) * amp;
  };

  const scale = 0.25 * scaleMultiplier;

  // Variant color indexing
  const variantIdx = Math.floor(Math.abs(Math.sin((seed || 0) * 9876.54)) * 100) % 5;
  let baseBodyColor = [0.4, 0.5, 0.2];
  let stripeColor = [0.1, 0.08, 0.08];
  let eyeColor = [0.1, 0.0, 0.0];
  let wingColor = [0.85, 0.9, 0.95, 0.35];
  let stigmaColor = [0.1, 0.08, 0.08];
  let headColor = [0.4, 0.45, 0.25];

  if (variantIdx === 0) {
    baseBodyColor = [0.95, 0.4, 0.1]; stripeColor = [0.15, 0.12, 0.1]; eyeColor = [0.65, 0.05, 0.12]; wingColor = [0.95, 0.85, 0.6, 0.38]; stigmaColor = [0.8, 0.1, 0.1]; headColor = [0.8, 0.3, 0.1];
  } else if (variantIdx === 1) {
    baseBodyColor = [0.1, 0.65, 0.25]; stripeColor = [0.65, 0.55, 0.15]; eyeColor = [0.5, 0.6, 0.2]; wingColor = [0.85, 0.95, 0.9, 0.35]; stigmaColor = [0.1, 0.1, 0.1]; headColor = [0.2, 0.7, 0.3];
  } else if (variantIdx === 2) {
    baseBodyColor = [0.05, 0.55, 0.75]; stripeColor = [0.05, 0.1, 0.3]; eyeColor = [0.0, 0.45, 0.55]; wingColor = [0.8, 0.95, 0.95, 0.35]; stigmaColor = [0.05, 0.1, 0.35]; headColor = [0.05, 0.6, 0.8];
  } else if (variantIdx === 3) {
    baseBodyColor = [0.8, 0.08, 0.15]; stripeColor = [0.05, 0.05, 0.05]; eyeColor = [0.15, 0.05, 0.08]; wingColor = [0.9, 0.85, 0.85, 0.35]; stigmaColor = [0.6, 0.05, 0.1]; headColor = [0.85, 0.1, 0.2];
  } else {
    baseBodyColor = [0.75, 0.5, 0.15]; stripeColor = [0.08, 0.06, 0.04]; eyeColor = [0.35, 0.2, 0.08]; wingColor = [0.92, 0.8, 0.65, 0.4]; stigmaColor = [0.4, 0.2, 0.05]; headColor = [0.8, 0.55, 0.2];
  }

  if (overrideColors) {
    baseBodyColor = overrideColors; stripeColor = overrideColors; eyeColor = overrideColors; wingColor = [overrideColors[0], overrideColors[1], overrideColors[2], 0.35]; stigmaColor = overrideColors; headColor = overrideColors;
  }

  const legColor = [0.1, 0.1, 0.1];
  const sagVec = f || (isRagdoll ? F : [0, 0, 0]);

  const mp = (x, y, z, sagScale = 0) => {
    let lx = x + getWigX(z);
    let ly = y + getWigY(z);
    let lz = z;
    if (isRagdoll) {
      lx += sagVec[0] * sagScale;
      ly += sagVec[1] * sagScale;
      lz += sagVec[2] * sagScale;
    }
    return transformPoint(lx * scale, ly * scale, lz * scale);
  };

  const pushQuad = (p1, p2, p3, p4, color) => {
    const idx = vertices.length / 3;
    vertices.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], p4[0], p4[1], p4[2]);
    colors.push(color[0], color[1], color[2], color[0], color[1], color[2], color[0], color[1], color[2], color[0], color[1], color[2]);
    indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
    indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
  };

  const pHead = mp(0, 0.02, 0.25, 0.1);
  const pNeck = mp(0, 0.02, 0.15, 0.07);
  const pThorax1 = mp(0, 0.02, 0.1, 0.05);
  const pThorax2 = mp(0, 0.02, 0.0, 0.0);

  const pointsList = [pHead, pNeck, pThorax1, pThorax2];
  const radiiList = [0.06, 0.08, 0.1, 0.08].map(r => r * scale);
  const colorsList = [headColor, headColor, headColor, headColor];

  const numAbdomenSegments = 10;
  const abdPoints = [];
  const abdRadii = [];
  for (let i = 0; i <= numAbdomenSegments; i++) {
    const t = i / numAbdomenSegments;
    const z = 0.0 * (1 - t) + (-0.7) * t;
    const y = 0.02 * (1 - t) + 0.0 * t;
    const sag = 0.0 * (1 - t) + 0.3 * t;
    const r = (0.08 * (1 - t) + 0.015 * t) * scale;
    abdPoints.push(mp(0, y, z, sag));
    abdRadii.push(r);
  }

  for (let i = 1; i <= numAbdomenSegments; i++) {
    pointsList.push(abdPoints[i]);
    radiiList.push(abdRadii[i]);
    const segmentColor = (i % 2 === 0) ? stripeColor : baseBodyColor;
    colorsList.push(segmentColor);
  }

  buildContinuousSpine(pointsList, radiiList, 5, colorsList, vertices, colors, indices, N);

  const pTail = abdPoints[numAbdomenSegments];
  const tailCapColor = (numAbdomenSegments % 2 === 0) ? baseBodyColor : stripeColor;
  buildLowPolySphere(pTail, 0.02 * scale, 4, tailCapColor, 0, 0, vertices, colors, indices);

  buildLowPolySphere(pHead, 0.08 * scale, 4, headColor, 0, 0, vertices, colors, indices);
  buildLowPolySphere(mp(0.06, 0.05, 0.28, 0.1), 0.05 * scale, 4, eyeColor, 0, 0, vertices, colors, indices);
  buildLowPolySphere(mp(-0.06, 0.05, 0.28, 0.1), 0.05 * scale, 4, eyeColor, 0, 0, vertices, colors, indices);

  // Legs (6 legs, jointed)
  const addLeg = (bx, bz, tx, ty, tz) => {
    const base = mp(bx, -0.02, bz, 0.05);
    const mid = mp(bx + tx * 0.4, 0.02, bz + tz * 0.4, 0.05);
    const tip = mp(bx + tx, ty, bz + tz, 0.05);
    const thick = 0.01 * scale;
    buildTaperedSegment(base, mid, thick, thick * 0.8, 3, legColor, vertices, colors, indices);
    buildTaperedSegment(mid, tip, thick * 0.8, thick * 0.2, 3, legColor, vertices, colors, indices);
  };

  addLeg(0.04, 0.1, 0.15, -0.15, 0.1);   // Front Right
  addLeg(-0.04, 0.1, -0.15, -0.15, 0.1); // Front Left
  addLeg(0.05, 0.05, 0.18, -0.15, 0.0);  // Mid Right
  addLeg(-0.05, 0.05, -0.18, -0.15, 0.0); // Mid Left
  addLeg(0.04, 0.0, 0.15, -0.15, -0.1);  // Back Right
  addLeg(-0.04, 0.0, -0.15, -0.15, -0.1); // Back Left

  const flapSpeed = isRagdoll ? 0 : 3.5;
  const wingPhase = animPhase * flapSpeed;
  const wingY = isRagdoll ? -0.2 : Math.sin(wingPhase) * 0.3;
  const wingZSweep = isRagdoll ? -0.1 : Math.cos(wingPhase) * 0.05;

  const drawDragonflyWing = (baseFront, baseBack, tipBack, tipFront, wingCol, stigmaCol) => {
    pushQuad(baseFront, baseBack, tipBack, tipFront, wingCol);
    const edgeThick = 0.003 * scale;
    buildTaperedSegment(baseFront, tipFront, edgeThick, edgeThick, 3, [0.1, 0.1, 0.1], vertices, colors, indices);
    buildTaperedSegment(baseBack, tipBack, edgeThick * 0.5, edgeThick * 0.5, 3, [0.15, 0.15, 0.15], vertices, colors, indices);
    const baseMid = [(baseFront[0] + baseBack[0]) * 0.5, (baseFront[1] + baseBack[1]) * 0.5, (baseFront[2] + baseBack[2]) * 0.5];
    const tipMid = [(tipFront[0] + tipBack[0]) * 0.5, (tipFront[1] + tipBack[1]) * 0.5, (tipFront[2] + tipBack[2]) * 0.5];
    buildTaperedSegment(baseMid, tipMid, edgeThick * 0.4, edgeThick * 0.15, 3, [0.12, 0.12, 0.12], vertices, colors, indices);
    
    // Cross veins
    const baseQuarter = [baseFront[0] * 0.75 + baseBack[0] * 0.25, baseFront[1] * 0.75 + baseBack[1] * 0.25, baseFront[2] * 0.75 + baseBack[2] * 0.25];
    const tipThreeQuarter = [tipFront[0] * 0.25 + tipBack[0] * 0.75, tipFront[1] * 0.25 + tipBack[1] * 0.75, tipFront[2] * 0.25 + tipBack[2] * 0.75];
    buildTaperedSegment(baseQuarter, tipThreeQuarter, edgeThick * 0.3, edgeThick * 0.1, 3, [0.15, 0.15, 0.15], vertices, colors, indices);

    const stigmaStart = [baseFront[0] * 0.2 + tipFront[0] * 0.8, baseFront[1] * 0.2 + tipFront[1] * 0.8, baseFront[2] * 0.2 + tipFront[2] * 0.8];
    const stigmaEnd = [baseFront[0] * 0.05 + tipFront[0] * 0.95, baseFront[1] * 0.05 + tipFront[1] * 0.95, baseFront[2] * 0.05 + tipFront[2] * 0.95];
    const stigmaBackStart = [baseBack[0] * 0.2 + tipBack[0] * 0.8, baseBack[1] * 0.2 + tipBack[1] * 0.8, baseBack[2] * 0.2 + tipBack[2] * 0.8];
    const stigmaBackEnd = [baseBack[0] * 0.05 + tipBack[0] * 0.95, baseBack[1] * 0.05 + tipBack[1] * 0.95, baseBack[2] * 0.05 + tipBack[2] * 0.95];
    const s1 = stigmaStart;
    const s4 = stigmaEnd;
    const s2 = [stigmaStart[0] * 0.8 + stigmaBackStart[0] * 0.2, stigmaStart[1] * 0.8 + stigmaBackStart[1] * 0.2, stigmaStart[2] * 0.8 + stigmaBackStart[2] * 0.2];
    const s3 = [stigmaEnd[0] * 0.8 + stigmaBackEnd[0] * 0.2, stigmaEnd[1] * 0.8 + stigmaBackEnd[1] * 0.2, stigmaEnd[2] * 0.8 + stigmaBackEnd[2] * 0.2];
    pushQuad(s1, s2, s3, s4, stigmaCol);
  };

  // Front Right Wing
  const frBaseFront = mp(0.08, 0.06, 0.15, 0.05);
  const frBaseBack = mp(0.08, 0.06, 0.08, 0.05);
  const frTipBack = mp(0.7, 0.06 + wingY, 0.1 + wingZSweep, 0.05);
  const frTipFront = mp(0.65, 0.06 + wingY, 0.2 + wingZSweep, 0.05);
  drawDragonflyWing(frBaseFront, frBaseBack, frTipBack, frTipFront, wingColor, stigmaColor);

  // Front Left Wing
  const flBaseFront = mp(-0.08, 0.06, 0.15, 0.05);
  const flBaseBack = mp(-0.08, 0.06, 0.08, 0.05);
  const flTipBack = mp(-0.7, 0.06 + wingY, 0.1 + wingZSweep, 0.05);
  const flTipFront = mp(-0.65, 0.06 + wingY, 0.2 + wingZSweep, 0.05);
  drawDragonflyWing(flBaseFront, flBaseBack, flTipBack, flTipFront, wingColor, stigmaColor);

  // Back Right Wing
  const wingY2 = isRagdoll ? -0.2 : Math.sin(wingPhase - 1.0) * 0.3;
  const brBaseFront = mp(0.07, 0.06, 0.05, 0.05);
  const brBaseBack = mp(0.07, 0.06, -0.02, 0.05);
  const brTipBack = mp(0.6, 0.06 + wingY2, -0.15 + wingZSweep, 0.05);
  const brTipFront = mp(0.55, 0.06 + wingY2, -0.05 + wingZSweep, 0.05);
  drawDragonflyWing(brBaseFront, brBaseBack, brTipBack, brTipFront, wingColor, stigmaColor);

  // Back Left Wing
  const blBaseFront = mp(-0.07, 0.06, 0.05, 0.05);
  const blBaseBack = mp(-0.07, 0.06, -0.02, 0.05);
  const blTipBack = mp(-0.6, 0.06 + wingY2, -0.15 + wingZSweep, 0.05);
  const blTipFront = mp(-0.55, 0.06 + wingY2, -0.05 + wingZSweep, 0.05);
  drawDragonflyWing(blBaseFront, blBaseBack, blTipBack, blTipFront, wingColor, stigmaColor);

  // Set colliders if we are rendering for an active NPC
  if (f !== null && c !== null) {
    c.colliders = [
      {
        offset: [pThorax1[0] - pos[0], pThorax1[1] - pos[1], pThorax1[2] - pos[2]],
        radius: 0.12 * scale
      },
      {
        offset: [pHead[0] - pos[0], pHead[1] - pos[1], pHead[2] - pos[2]],
        radius: 0.08 * scale
      }
    ];
  }
};

window.NpcRegistry = window.NpcRegistry || {};
window.NpcRegistry["meganeura"] = {
  maxHp: 3,
  updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
    let pTheta, pPhi, pBoat, pMech;
    try { pTheta = charTheta; } catch(e) {}
    try { pPhi = charPhi; } catch(e) {}
    try { pBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat); } catch(e) {}
    try { pMech = (typeof activeRidingMech !== "undefined" && activeRidingMech) || (typeof window !== "undefined" && window.activeRidingMech); } catch(e) {}
    
    const isDriving = !!(pBoat || pMech);
    const ignorePlayer = (typeof window !== "undefined" && window.npcIgnorePlayer);

    let isUnconscious = false;
    try {
      if (typeof playerHP !== "undefined" && playerHP <= 0) isUnconscious = true;
      if (typeof ragdollEnabled !== "undefined" && ragdollEnabled) isUnconscious = true;
      if (typeof playerControlsLocked !== "undefined" && playerControlsLocked) isUnconscious = true;
      if (typeof window !== "undefined" && (window.isPlayerUnconscious || (window.playerHP !== undefined && window.playerHP <= 0))) isUnconscious = true;
    } catch(e) {}

    // ถ้าตัวละครหมดสติ กำลังขับเรือ/ขับหุ่นยนต์ หรือเปิดโหมด NPC ไม่สนใจตัวละคร จะไม่สามารถเกาะตัวละครได้ และหากเกาะอยู่ให้ปล่อยทันที
    if (c.attachedToPlayer) {
      if (isDriving || isUnconscious || ignorePlayer) {
        c.attachedToPlayer = false; // ปล่อยจากการเกาะทันที
      } else if (pTheta !== undefined && pPhi !== undefined) {
        // Attach to player and attack
        c.theta = pTheta;
        c.phi = pPhi;
        let pr = gRadius;
        try { 
            pr = (typeof RADIUS !== "undefined" ? RADIUS : 200) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(pTheta, pPhi, seed) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 10) : 0);
        } catch(e) {}
        c.r = pr + 0.15; // Position slightly above player center
        c.isSwimming = false;
        c.animPhase += deltaTime * 25.0; // Frantic wing flap
        
        // Attack logic
        try {
            if (!isUnconscious && !isDriving && !ignorePlayer && typeof damagePlayer === 'function') {
              damagePlayer(1);
            }
        } catch(e) {}
        
        return; // Skip normal wandering behavior
      } else {
        c.attachedToPlayer = false;
      }
    } else {
      // Attempt to attach only if close AND not driving AND not unconscious AND not ignorePlayer
      if (pTheta !== undefined && pPhi !== undefined && !isDriving && !isUnconscious && !ignorePlayer) {
        let pr = gRadius;
        try { 
            pr = (typeof RADIUS !== "undefined" ? RADIUS : 200) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(pTheta, pPhi, seed) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 10) : 0);
        } catch(e) {}
        
        const px = pr * Math.sin(pTheta) * Math.cos(pPhi);
        const py = pr * Math.cos(pTheta);
        const pz = pr * Math.sin(pTheta) * Math.sin(pPhi);
        
        const cx = c.r * Math.sin(c.theta) * Math.cos(c.phi);
        const cy = c.r * Math.cos(c.theta);
        const cz = c.r * Math.sin(c.theta) * Math.sin(c.phi);
        
        const distSq = (px-cx)**2 + (py-cy)**2 + (pz-cz)**2;
        
        if (distSq < 0.25) { // distance < 0.5
            c.attachedToPlayer = true;
            return;
        }
      }
    }

    c.isSwimming = false;
    const baseR = Math.max(gRadius, wRadius);
    let targetR = baseR + 0.3 + Math.sin(c.animPhase * 2.0) * 0.05;
    if (npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
      targetR = Math.min(targetR, npcCaveData.ceiling - 0.1);
    }
    c.r = targetR;
    c.animPhase += deltaTime * 10.0; // Fast wing flap
  },
  render: function(c, allVertices, allColors, allIndices, scale, N, R, F, pos, f, transformPoint, seed) {
    window.buildMeganeuraModel(
      c.seed !== undefined ? c.seed : seed,
      c.animPhase,
      c.ragdollEnabled,
      c.isSwimming,
      1.0, // Scale multiplier of 1.0 inside game
      pos,
      R,
      N,
      F,
      allVertices,
      allColors,
      allIndices,
      null, // overrideColors
      f,
      transformPoint,
      c
    );
  }
};
