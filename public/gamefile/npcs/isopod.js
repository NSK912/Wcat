// === SEEDPLANET MODULE: JS/NPCS/ISOPOD.JS ===
// Giant Isopod (Bathynomus giganteus - ~30 inches / ~0.76m)
// Features realistic overlapping layered tergite armor (shingled plates) and anatomically accurate tucked legs.

window.buildIsopodModel = function(
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
  f = null,              // Sag force vector for ragdoll
  transformPoint = null, // Custom terrain-clipping transform
  c = null               // Active NPC object
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

  // 30 inches (~0.76m) in world scale
  const scale = 0.32 * (scaleMultiplier || 1.0);

  // Crawling undulation
  const getCrawlWiggle = (z) => {
    if (isRagdoll) return 0;
    const phase = animPhase * 2.8 - z * 3.5;
    return Math.sin(phase) * 0.012;
  };

  const sagVec = f || (isRagdoll ? F : [0, 0, 0]);
  const p = (x, y, z, sagScale = 0) => {
    let lx = x + getCrawlWiggle(z);
    let ly = y;
    let lz = z;
    if (isRagdoll) {
      lx += sagVec[0] * sagScale;
      ly += sagVec[1] * sagScale;
      lz += sagVec[2] * sagScale;
    }
    return transformPoint(lx * scale, ly * scale, lz * scale);
  };

  // Color variants based on deep-sea Bathynomus specimens:
  // 0: Classic Pale Lavender / Lilac Pearl (with bright translucent margins)
  // 1: Ivory Alabaster / Translucent White
  // 2: Pale Sandy Grey-Rose
  const variantIdx = Math.floor(Math.abs(Math.sin((seed || 0) * 8371.19)) * 100) % 3;
  let shellColor, shellLight, shellDark, underColor, eyeColor, legColor;

  if (variantIdx === 0) {
    shellColor = [0.72, 0.67, 0.76];      // Lavender / Lilac Chitin
    shellLight = [0.86, 0.83, 0.90];      // Overlap edge / rim highlight
    shellDark  = [0.58, 0.53, 0.62];      // Under-lip shadow
    underColor = [0.65, 0.60, 0.68];      // Ventral plate
    eyeColor   = [0.08, 0.08, 0.12];      // Large dark triangular eye
    legColor   = [0.75, 0.70, 0.78];      // Articulated legs
  } else if (variantIdx === 1) {
    shellColor = [0.80, 0.82, 0.80];      // Ivory Pearl
    shellLight = [0.93, 0.94, 0.92];
    shellDark  = [0.66, 0.68, 0.66];
    underColor = [0.72, 0.72, 0.70];
    eyeColor   = [0.09, 0.09, 0.13];
    legColor   = [0.82, 0.82, 0.80];
  } else {
    shellColor = [0.72, 0.66, 0.64];      // Sandy Rose
    shellLight = [0.86, 0.81, 0.79];
    shellDark  = [0.58, 0.52, 0.50];
    underColor = [0.65, 0.58, 0.56];
    eyeColor   = [0.08, 0.07, 0.08];
    legColor   = [0.75, 0.69, 0.67];
  }

  // Helpers to push quads and triangles with lighting shading
  const pushQuad = (p1, p2, p3, p4, col) => {
    const idx = vertices.length / 3;
    vertices.push(
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2],
      p4[0], p4[1], p4[2]
    );
    colors.push(
      col[0], col[1], col[2],
      col[0], col[1], col[2],
      col[0], col[1], col[2],
      col[0], col[1], col[2]
    );
    indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
    indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2); // Double-sided
  };

  const pushTri = (p1, p2, p3, col) => {
    const idx = vertices.length / 3;
    vertices.push(
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2]
    );
    colors.push(
      col[0], col[1], col[2],
      col[0], col[1], col[2],
      col[0], col[1], col[2]
    );
    indices.push(idx, idx + 1, idx + 2);
    indices.push(idx, idx + 2, idx + 1);
  };

  // =========================================================================
  // 1. CEPHALON (HEAD SHIELD)
  // Broad, convex shield with frontal rostrum and lateral eye notches
  // =========================================================================
  const zHeadApex  = 0.44;
  const zHeadFront = 0.58;
  const hHeight = 0.13;
  const hWidth  = 0.26;

  // Key head vertices
  const hDorsalApex = p(0.0, hHeight, zHeadApex, 0.05);
  const hNoseCenter = p(0.0, 0.03, zHeadFront, 0.05);
  const hNoseL      = p(-0.10, 0.03, zHeadFront - 0.03, 0.05);
  const hNoseR      = p( 0.10, 0.03, zHeadFront - 0.03, 0.05);
  const hDorsalL    = p(-hWidth * 0.65, hHeight * 0.85, zHeadApex, 0.05);
  const hDorsalR    = p( hWidth * 0.65, hHeight * 0.85, zHeadApex, 0.05);
  const hFlangeL    = p(-hWidth, 0.03, zHeadApex - 0.02, 0.05);
  const hFlangeR    = p( hWidth, 0.03, zHeadApex - 0.02, 0.05);

  // Front dome facets
  pushTri(hDorsalApex, hNoseCenter, hNoseL, shellColor);
  pushTri(hDorsalApex, hNoseR, hNoseCenter, shellColor);
  pushTri(hDorsalApex, hNoseL, hDorsalL, shellColor);
  pushTri(hDorsalApex, hDorsalR, hNoseR, shellColor);
  pushQuad(hDorsalL, hNoseL, hFlangeL, hFlangeL, shellLight);
  pushQuad(hDorsalR, hFlangeR, hNoseR, hNoseR, shellLight);

  // Front rostrum ridge
  pushTri(hNoseL, hNoseCenter, p(0, 0.015, zHeadFront + 0.02, 0.05), shellLight);
  pushTri(hNoseCenter, hNoseR, p(0, 0.015, zHeadFront + 0.02, 0.05), shellLight);

  // Large Compound Eyes (Flat dark triangular facets on lateral head shield)
  const eyeTopL   = p(-hWidth * 0.58, hHeight * 0.70, zHeadApex + 0.04, 0.05);
  const eyeFrontL = p(-hWidth * 0.80, 0.04,           zHeadApex + 0.06, 0.05);
  const eyeBackL  = p(-hWidth * 0.85, 0.04,           zHeadApex - 0.01, 0.05);
  pushTri(eyeTopL, eyeFrontL, eyeBackL, eyeColor);

  const eyeTopR   = p( hWidth * 0.58, hHeight * 0.70, zHeadApex + 0.04, 0.05);
  const eyeFrontR = p( hWidth * 0.80, 0.04,           zHeadApex + 0.06, 0.05);
  const eyeBackR  = p( hWidth * 0.85, 0.04,           zHeadApex - 0.01, 0.05);
  pushTri(eyeTopR, eyeBackR, eyeFrontR, eyeColor);

  // Antennae (Two long sensory whips projecting from under the head shield)
  const antTwitch = isRagdoll ? 0 : Math.sin(animPhase * 3.5) * 0.04;
  const antBaseL = p(-0.06, 0.02, zHeadFront - 0.01, 0.05);
  const antMidL  = p(-0.20 + antTwitch, 0.04, zHeadFront + 0.18, 0.06);
  const antTipL  = p(-0.35 + antTwitch * 1.8, 0.02, zHeadFront + 0.38, 0.08);

  const antBaseR = p( 0.06, 0.02, zHeadFront - 0.01, 0.05);
  const antMidR  = p( 0.20 - antTwitch, 0.04, zHeadFront + 0.18, 0.06);
  const antTipR  = p( 0.35 - antTwitch * 1.8, 0.02, zHeadFront + 0.38, 0.08);

  if (typeof buildContinuousSpine === 'function') {
    const antRad = [0.012, 0.007, 0.002].map(r => r * scale);
    buildContinuousSpine([antBaseL, antMidL, antTipL], antRad, 3, shellLight, vertices, colors, indices, N);
    buildContinuousSpine([antBaseR, antMidR, antTipR], antRad, 3, shellLight, vertices, colors, indices, N);
  }

  // =========================================================================
  // 2. LAYERED OVERLAPPING TERGITE CARAPACE PLATES (8 Shingled Segments)
  // Each plate is an arched band that overlaps the plate behind it.
  // =========================================================================
  // Profile parameters along the body axis (from anterior to posterior)
  const segments = [
    { z: 0.36, w: 0.30, h: 0.155, sag: 0.06 }, // Pereonite 1
    { z: 0.26, w: 0.34, h: 0.170, sag: 0.07 }, // Pereonite 2
    { z: 0.15, w: 0.37, h: 0.180, sag: 0.08 }, // Pereonite 3 (widest)
    { z: 0.04, w: 0.38, h: 0.180, sag: 0.09 }, // Pereonite 4 (widest center)
    { z:-0.07, w: 0.37, h: 0.175, sag: 0.11 }, // Pereonite 5
    { z:-0.18, w: 0.34, h: 0.160, sag: 0.13 }, // Pereonite 6
    { z:-0.29, w: 0.30, h: 0.140, sag: 0.15 }, // Pereonite 7
    { z:-0.39, w: 0.25, h: 0.115, sag: 0.17 }, // Pleonite
  ];

  // We connect the head rear edge to the first segment
  let prevFrontLip = {
    top: hDorsalApex,
    midL: hDorsalL,
    midR: hDorsalR,
    sideL: hFlangeL,
    sideR: hFlangeR,
  };

  const plateDepth = 0.14; // How long each segment plate extends along Z
  const overlapAmount = 0.035; // Extends over the next segment like roof tiles

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const sag = s.sag;
    const zFront = s.z + 0.04;
    const zRear  = s.z - plateDepth + 0.04;
    const zOverlap = zRear - overlapAmount; // Overlapping posterior lip

    const w = s.w;
    const h = s.h;

    // Segment Front points (seated slightly below/within the carapace)
    const fTop   = p( 0.0,      h * 0.96, zFront, sag);
    const fMidL  = p(-w * 0.65, h * 0.78, zFront, sag);
    const fMidR  = p( w * 0.65, h * 0.78, zFront, sag);
    const fSideL = p(-w * 0.95, 0.04,     zFront, sag);
    const fSideR = p( w * 0.95, 0.04,     zFront, sag);

    // Segment Main Dorsal Shell Surface
    const rTop   = p( 0.0,      h,        zRear, sag + 0.01);
    const rMidL  = p(-w * 0.68, h * 0.82, zRear, sag + 0.01);
    const rMidR  = p( w * 0.68, h * 0.82, zRear, sag + 0.01);
    const rSideL = p(-w,        0.03,     zRear - 0.01, sag + 0.01); // Epimeral flange flares backward
    const rSideR = p( w,        0.03,     zRear - 0.01, sag + 0.01);

    // Segment Overlapping Shingle Lip (Overhangs the following segment)
    const lipTop   = p( 0.0,      h * 1.02, zOverlap, sag + 0.015);
    const lipMidL  = p(-w * 0.70, h * 0.84, zOverlap, sag + 0.015);
    const lipMidR  = p( w * 0.70, h * 0.84, zOverlap, sag + 0.015);
    const lipSideL = p(-w * 1.03, 0.02,     zOverlap - 0.02, sag + 0.015); // Pointed rear skirt tip
    const lipSideR = p( w * 1.03, 0.02,     zOverlap - 0.02, sag + 0.015);

    // --- Connect previous segment rear to this segment's front ---
    pushQuad(prevFrontLip.top, fTop, fMidL, prevFrontLip.midL, shellDark);
    pushQuad(prevFrontLip.top, prevFrontLip.midR, fMidR, fTop, shellDark);
    pushQuad(prevFrontLip.midL, fMidL, fSideL, prevFrontLip.sideL, shellDark);
    pushQuad(prevFrontLip.midR, prevFrontLip.sideR, fSideR, fMidR, shellDark);

    // --- Render This Segment's Dorsal Armor Plate ---
    pushQuad(fTop, rTop, rMidL, fMidL, shellColor);
    pushQuad(fTop, fMidR, rMidR, rTop, shellColor);
    pushQuad(fMidL, rMidL, rSideL, fSideL, shellColor);
    pushQuad(fMidR, fSideR, rSideR, rMidR, shellColor);

    // --- Overlapping Raised Lip / Highlight Edge ---
    pushQuad(rTop, lipTop, lipMidL, rMidL, shellLight);
    pushQuad(rTop, rMidR, lipMidR, lipTop, shellLight);
    pushQuad(rMidL, lipMidL, lipSideL, rSideL, shellLight);
    pushQuad(rMidR, rSideR, lipSideR, lipMidR, shellLight);

    // --- Ventral Underbody (Tucked flat belly under the armor) ---
    const bellyL = p(-w * 0.50, 0.02, s.z, sag);
    const bellyR = p( w * 0.50, 0.02, s.z, sag);
    pushQuad(fSideL, bellyL, bellyR, fSideR, underColor);

    // --- 7 Pairs of Tucked Walking Legs (Attached under the belly, peaking below side skirt) ---
    if (i < 7) {
      const legPhase = isRagdoll ? 0 : animPhase * 4.5 + i * 0.85;
      const legStep  = Math.sin(legPhase) * 0.025;
      const legLift  = Math.max(0, Math.cos(legPhase)) * 0.018;

      // Leg Base inside the ventral plate
      const lBaseL = p(-w * 0.45, 0.015, s.z - 0.02, sag);
      const lKneeL = p(-w * 0.85, 0.010 + legLift, s.z + legStep, sag);
      const lTipL  = p(-w * 1.08, -0.04, s.z + legStep * 1.2 - 0.02, sag); // Peeks right below the side skirt

      const lBaseR = p( w * 0.45, 0.015, s.z - 0.02, sag);
      const lKneeR = p( w * 0.85, 0.010 + legLift, s.z - legStep, sag);
      const lTipR  = p( w * 1.08, -0.04, s.z - legStep * 1.2 - 0.02, sag);

      if (typeof buildContinuousSpine === 'function') {
        const legRad = [0.018, 0.014, 0.005].map(r => r * scale);
        buildContinuousSpine([lBaseL, lKneeL, lTipL], legRad, 3, legColor, vertices, colors, indices, N);
        buildContinuousSpine([lBaseR, lKneeR, lTipR], legRad, 3, legColor, vertices, colors, indices, N);
      }
    }

    prevFrontLip = {
      top: lipTop,
      midL: lipMidL,
      midR: lipMidR,
      sideL: lipSideL,
      sideR: lipSideR,
    };
  }

  // =========================================================================
  // 3. TELSON (BROAD ARMORED TAIL SHIELD FAN)
  // Large spade-shaped caudal fan plate with marginal serrations/spines
  // =========================================================================
  const zTelsonRear = -0.62;
  const tSag = 0.22;

  const tApex = prevFrontLip.top;
  const tMidL = prevFrontLip.midL;
  const tMidR = prevFrontLip.midR;
  const tSideL = prevFrontLip.sideL;
  const tSideR = prevFrontLip.sideR;

  const tEndCenter = p( 0.0,      0.02, zTelsonRear, tSag);
  const tEndL      = p(-0.11,     0.02, zTelsonRear + 0.04, tSag);
  const tEndR      = p( 0.11,     0.02, zTelsonRear + 0.04, tSag);
  const tSpurL     = p(-0.18,     0.02, zTelsonRear + 0.10, tSag);
  const tSpurR     = p( 0.18,     0.02, zTelsonRear + 0.10, tSag);

  // Telson dorsal fan
  pushTri(tApex, tMidL, tEndL, shellColor);
  pushTri(tApex, tEndL, tEndCenter, shellColor);
  pushTri(tApex, tEndCenter, tEndR, shellColor);
  pushTri(tApex, tEndR, tMidR, shellColor);

  pushTri(tMidL, tSideL, tSpurL, shellColor);
  pushTri(tMidL, tSpurL, tEndL, shellLight);
  pushTri(tMidR, tEndR, tSpurR, shellLight);
  pushTri(tMidR, tSpurR, tSideR, shellColor);

  // Swimming Pleopods under abdomen (Fan gills)
  if (isSwimming) {
    const pleoWave = Math.sin(animPhase * 5.0) * 0.02;
    const pleoL = p(-0.08, -0.02 + pleoWave, -0.44, 0.18);
    const pleoR = p( 0.08, -0.02 + pleoWave, -0.44, 0.18);
    const pleoTipL = p(-0.12, -0.04, -0.52, 0.20);
    const pleoTipR = p( 0.12, -0.04, -0.52, 0.20);
    pushQuad(tEndCenter, pleoL, pleoTipL, tEndL, underColor);
    pushQuad(tEndCenter, tEndR, pleoTipR, pleoR, underColor);
  }

  // Set colliders for collision and damage
  if (f !== null && c !== null) {
    c.colliders = [
      {
        offset: [hDorsalApex[0] - pos[0], hDorsalApex[1] - pos[1], hDorsalApex[2] - pos[2]],
        radius: 0.14 * scale * 1.5,
      },
      {
        offset: [segments[2].z * F[0], segments[2].z * F[1], segments[2].z * F[2]],
        radius: 0.18 * scale * 1.5,
      },
      {
        offset: [segments[5].z * F[0], segments[5].z * F[1], segments[5].z * F[2]],
        radius: 0.17 * scale * 1.5,
      },
      {
        offset: [tEndCenter[0] - pos[0], tEndCenter[1] - pos[1], tEndCenter[2] - pos[2]],
        radius: 0.13 * scale * 1.5,
      }
    ];
  }
};

// Register in NpcRegistry
window.NpcRegistry = window.NpcRegistry || {};
window.NpcRegistry["isopod"] = {
  maxHp: 2,
  moveSpeed: 0.04,
  animSpeed: 3.2,

  updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
    // Bottom-dwelling benthic scavenger:
    // Crawls along the seabed underwater and along terrain on land
    c.isSwimming = (gRadius < wRadius - 0.02);

    let targetR = gRadius + 0.015;

    if (npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
      targetR = Math.min(targetR, npcCaveData.ceiling - 0.06);
    }

    if (c.r === undefined) c.r = targetR;
    const adjustSpeed = 0.4 * deltaTime;
    if (c.r < targetR) {
      c.r = Math.min(targetR, c.r + adjustSpeed);
    } else if (c.r > targetR) {
      c.r = Math.max(targetR, c.r - adjustSpeed);
    }

    // Wandering heading adjustments
    if (Math.random() < 0.02) {
      c.heading += (Math.random() - 0.5) * 1.5;
    }
  },

  render: function(c, allVertices, allColors, allIndices, scale, N, R, F, pos, f, transformPoint, seed) {
    window.buildIsopodModel(
      c.seed !== undefined ? c.seed : seed,
      c.animPhase,
      c.ragdollEnabled,
      c.isSwimming,
      1.0,
      pos,
      R,
      N,
      F,
      allVertices,
      allColors,
      allIndices,
      f,
      transformPoint,
      c
    );
  }
};
