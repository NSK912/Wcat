// === SEEDPLANET MODULE: JS/NPCS/PLACODERM.JS ===
// Placoderms (Armored prehistoric fish / Dunkleosteus-inspired)
// Features heavy articulated cranial & thoracic armor plates, sharp shearing bone-blade jaws,
// large pectoral fins with warm orange tips, ribbed dorsal fin, lateral armored scute ridges,
// and realistic serpentine swimming undulation.

window.buildPlacodermModel = function(
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

  // S-wave body undulation while swimming - smooth, heavy, majestic for large armored fish
  const getWigX = (z) => {
    if (isRagdoll) return 0;
    const wavePhase = (animPhase || 0) * 1.5 - (0.25 - z) * 2.8;
    // Head & heavy cranial shield (z > 0.1) remain completely rigid; spine and caudal fin undulate smoothly
    const amp = z < 0.12 ? (0.12 - z) * 0.17 : (z < 0.22 ? (0.22 - z) * 0.03 : 0);
    return Math.sin(wavePhase) * amp;
  };

  const getWigY = (z) => {
    if (isRagdoll) return 0;
    // Subtle vertical pitch undulation
    const wavePhase = (animPhase || 0) * 1.5 - (0.25 - z) * 2.8;
    const amp = z < 0.08 ? (0.08 - z) * 0.03 : 0;
    return Math.cos(wavePhase) * amp;
  };

  const scale = 1.10 * (scaleMultiplier || 1.0);

  // Placoderm color scheme:
  // - Slate & stone grey armored head and thoracic shields
  // - Shearing bone-blade teeth with ivory tint
  // - Warm copper/ochre orange-brown textured back
  // - Charcoal grey belly & underbelly
  // - Warm orange fin fringes & edges
  // - Dark lateral scute ridges
  const variantIdx = Math.floor(Math.abs(Math.sin((seed || 0) * 7654.32)) * 100) % 3;

  let armorPlateBase, armorPlateHighlight, armorPlateDark;
  let skinBack, skinMid, skinBelly;
  let finOrange, finOrangeDark, finBaseGrey;
  let boneBladeColor, boneBladeEdge, mouthInside;
  let eyeScleroticRing, eyePupil;
  let lateralRidgeColor;

  if (variantIdx === 0) {
    // Classic Slate Armor + Warm Ochre Back
    armorPlateBase      = [0.62, 0.65, 0.68];
    armorPlateHighlight = [0.76, 0.79, 0.82];
    armorPlateDark      = [0.44, 0.47, 0.50];
    skinBack            = [0.68, 0.44, 0.28];
    skinMid             = [0.55, 0.42, 0.32];
    skinBelly           = [0.38, 0.40, 0.42];
    finOrange           = [0.90, 0.52, 0.22];
    finOrangeDark       = [0.72, 0.36, 0.16];
    finBaseGrey         = [0.46, 0.48, 0.50];
    boneBladeColor      = [0.86, 0.88, 0.86];
    boneBladeEdge       = [0.95, 0.96, 0.95];
    mouthInside         = [0.12, 0.12, 0.14];
    eyeScleroticRing    = [0.70, 0.72, 0.74];
    eyePupil            = [0.08, 0.08, 0.10];
    lateralRidgeColor   = [0.26, 0.28, 0.30];
  } else if (variantIdx === 1) {
    // Deep Ocean Ironclad
    armorPlateBase      = [0.54, 0.58, 0.62];
    armorPlateHighlight = [0.70, 0.74, 0.78];
    armorPlateDark      = [0.36, 0.39, 0.43];
    skinBack            = [0.60, 0.38, 0.24];
    skinMid             = [0.48, 0.36, 0.28];
    skinBelly           = [0.32, 0.35, 0.38];
    finOrange           = [0.92, 0.58, 0.18];
    finOrangeDark       = [0.70, 0.40, 0.12];
    finBaseGrey         = [0.40, 0.43, 0.46];
    boneBladeColor      = [0.88, 0.90, 0.88];
    boneBladeEdge       = [0.96, 0.97, 0.96];
    mouthInside         = [0.10, 0.10, 0.12];
    eyeScleroticRing    = [0.64, 0.67, 0.70];
    eyePupil            = [0.06, 0.06, 0.08];
    lateralRidgeColor   = [0.22, 0.24, 0.26];
  } else {
    // Ancient Fossil Terracotta
    armorPlateBase      = [0.65, 0.66, 0.67];
    armorPlateHighlight = [0.80, 0.82, 0.84];
    armorPlateDark      = [0.46, 0.48, 0.50];
    skinBack            = [0.72, 0.46, 0.30];
    skinMid             = [0.58, 0.44, 0.34];
    skinBelly           = [0.40, 0.42, 0.44];
    finOrange           = [0.94, 0.48, 0.20];
    finOrangeDark       = [0.75, 0.32, 0.14];
    finBaseGrey         = [0.48, 0.50, 0.52];
    boneBladeColor      = [0.90, 0.91, 0.89];
    boneBladeEdge       = [0.98, 0.98, 0.96];
    mouthInside         = [0.13, 0.13, 0.15];
    eyeScleroticRing    = [0.72, 0.74, 0.76];
    eyePupil            = [0.08, 0.08, 0.10];
    lateralRidgeColor   = [0.28, 0.30, 0.32];
  }

  if (overrideColors) {
    armorPlateBase = overrideColors;
    armorPlateHighlight = overrideColors;
    skinBack = overrideColors;
    finOrange = overrideColors;
  }

  const sagVec = f || (isRagdoll ? F : [0, 0, 0]);

  const p = (x, y, z, sagScale = 0) => {
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
    indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2); // Double-sided rendering
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
    indices.push(idx, idx + 2, idx + 1); // Double-sided rendering
  };

  // Jaw articulation: placoderms have a dynamic hinge between the head shield and lower jaw
  const jawChomp = isRagdoll ? 0.05 : (Math.sin((animPhase || 0) * 0.8) > 0.65 ? 0.03 : 0.01);

  // =========================================================================
  // 1. FULL-LENGTH CONTINUOUS MUSCULAR & FLESHY BODY CORE (100% GAP-FREE)
  // Continuous articulated spine from snout to caudal fin tip
  // =========================================================================
  const pSnoutCore   = p(0.0, 0.02,  0.54, 0.02);
  const pHeadCore    = p(0.0, 0.04,  0.38, 0.02);
  const pNuchalCore  = p(0.0, 0.05,  0.22, 0.02);
  const pThoraxCore  = p(0.0, 0.04,  0.06, 0.02);
  const pTorsoFront  = p(0.0, 0.03, -0.08, 0.04);
  const pTorsoMid    = p(0.0, 0.02, -0.25, 0.10);
  const pTorsoBack   = p(0.0, 0.01, -0.45, 0.18);
  const pTailMid     = p(0.0, 0.00, -0.65, 0.28);
  const pTailPed     = p(0.0, -0.01, -0.82, 0.38);
  const pTailTip     = p(0.0, -0.02, -0.95, 0.45);

  const corePoints = [
    pSnoutCore,
    pHeadCore,
    pNuchalCore,
    pThoraxCore,
    pTorsoFront,
    pTorsoMid,
    pTorsoBack,
    pTailMid,
    pTailPed,
    pTailTip
  ];

  const coreRadii = [
    0.050, // Snout
    0.115, // Head
    0.145, // Nuchal collar
    0.150, // Thorax
    0.146, // Front torso
    0.132, // Mid torso
    0.100, // Rear torso
    0.065, // Mid tail
    0.038, // Tail peduncle
    0.018  // Tail tip
  ].map(r => r * scale);

  const coreColors = [
    armorPlateDark,
    armorPlateBase,
    armorPlateBase,
    skinBack,
    skinBack,
    skinMid,
    skinMid,
    skinBelly,
    skinBelly,
    skinBelly
  ];

  buildContinuousSpine(
    corePoints,
    coreRadii,
    8,
    coreColors,
    vertices,
    colors,
    indices,
    N
  );

  // Cap both extremities of the spine to ensure 100% watertight ends
  buildLowPolySphere(pTailTip, 0.018 * scale, 2, skinBelly, 0, 0, vertices, colors, indices);
  buildLowPolySphere(pSnoutCore, 0.045 * scale, 2, armorPlateDark, 0, 0, vertices, colors, indices);

  // =========================================================================
  // 2. ARMORED HEAD & THORACIC SHIELDS (SEAMLESS WATERTIGHT CRANIAL PLATES)
  // =========================================================================
  const zRostrum     = 0.58; // Snout apex
  const zCranialApex = 0.36; // Top dome of head shield
  const zNuchalPlate = 0.20; // Articulated neck collar junction
  const zThoracicMid = 0.08; // Massive thoracic collar armor plate
  const zArmorRear   = -0.02; // Trailing edge of thoracic shield

  // Head Shield Vertices
  const vSnoutApex     = p(0.0, 0.035, zRostrum, 0.02);
  const vSnoutL        = p(0.085, 0.015, zRostrum - 0.04, 0.02);
  const vSnoutR        = p(-0.085, 0.015, zRostrum - 0.04, 0.02);

  const vCranialCrest  = p(0.0, 0.12, zCranialApex, 0.02);
  const vCranialMidL   = p(0.125, 0.075, zCranialApex + 0.04, 0.02);
  const vCranialMidR   = p(-0.125, 0.075, zCranialApex + 0.04, 0.02);
  const vCheekL        = p(0.145, -0.01, zCranialApex, 0.02);
  const vCheekR        = p(-0.145, -0.01, zCranialApex, 0.02);

  const vNuchalCrest   = p(0.0, 0.14, zNuchalPlate, 0.02);
  const vNuchalFlangeL = p(0.155, 0.06, zNuchalPlate, 0.02);
  const vNuchalFlangeR = p(-0.155, 0.06, zNuchalPlate, 0.02);
  const vOpercularL    = p(0.16, -0.025, zNuchalPlate, 0.02);
  const vOpercularR    = p(-0.16, -0.025, zNuchalPlate, 0.02);
  const vNuchalThroat  = p(0.0, -0.08, zNuchalPlate, 0.02);

  // Thoracic Collar Armor Plates (Massive overlapping shield around anterior body)
  const vThoraxDorsal  = p(0.0, 0.15, zThoracicMid, 0.02);
  const vThoraxSideL   = p(0.165, 0.05, zThoracicMid, 0.02);
  const vThoraxSideR   = p(-0.165, 0.05, zThoracicMid, 0.02);
  const vThoraxVentL   = p(0.135, -0.065, zThoracicMid, 0.02);
  const vThoraxVentR   = p(-0.135, -0.065, zThoracicMid, 0.02);
  const vThoraxKeel    = p(0.0, -0.085, zThoracicMid, 0.02);

  const vArmorRearDorsal = p(0.0, 0.145, zArmorRear, 0.03);
  const vArmorRearL      = p(0.15, 0.035, zArmorRear, 0.03);
  const vArmorRearR      = p(-0.15, 0.035, zArmorRear, 0.03);
  const vArmorRearVentL  = p(0.12, -0.065, zArmorRear, 0.03);
  const vArmorRearVentR  = p(-0.12, -0.065, zArmorRear, 0.03);
  const vArmorRearKeel   = p(0.0, -0.085, zArmorRear, 0.03);

  // Lower Jaw (Mandible) vertices
  const jawDrop = -0.035 - jawChomp;
  const vMandibleTip   = p(0.0, jawDrop + 0.03, zRostrum - 0.03, 0.02);
  const vLowerFangL    = p(0.06, jawDrop + 0.05, zRostrum - 0.02, 0.02);
  const vLowerFangR    = p(-0.06, jawDrop + 0.05, zRostrum - 0.02, 0.02);
  const vMandibleChin  = p(0.0, jawDrop - 0.03, zRostrum - 0.05, 0.02);
  const vMandibleBaseL = p(0.11, jawDrop + 0.01, zCranialApex + 0.02, 0.02);
  const vMandibleBaseR = p(-0.11, jawDrop + 0.01, zCranialApex + 0.02, 0.02);

  // Upper Jaw Bone Blade vertices
  const vUpperJawBaseL = p(0.075, 0.01, zRostrum - 0.02, 0.02);
  const vUpperJawBaseR = p(-0.075, 0.01, zRostrum - 0.02, 0.02);
  const vUpperFangTipL = p(0.065, -0.045, zRostrum - 0.01, 0.02);
  const vUpperFangTipR = p(-0.065, -0.045, zRostrum - 0.01, 0.02);
  const vUpperBladeMid = p(0.0, -0.025, zRostrum - 0.015, 0.02);

  // --- Frontal & Cranial Shield Facets ---
  pushTri(vSnoutApex, vCranialCrest, vCranialMidL, armorPlateHighlight);
  pushTri(vSnoutApex, vCranialMidR, vCranialCrest, armorPlateHighlight);
  pushTri(vSnoutApex, vCranialMidL, vSnoutL, armorPlateBase);
  pushTri(vSnoutApex, vSnoutR, vCranialMidR, armorPlateBase);

  // Cheek & Temporal Plates
  pushQuad(vCranialCrest, vNuchalCrest, vNuchalFlangeL, vCranialMidL, armorPlateBase);
  pushQuad(vCranialCrest, vCranialMidR, vNuchalFlangeR, vNuchalCrest, armorPlateBase);
  pushQuad(vCranialMidL, vNuchalFlangeL, vOpercularL, vCheekL, armorPlateDark);
  pushQuad(vCranialMidR, vCheekR, vOpercularR, vNuchalFlangeR, armorPlateDark);
  pushTri(vSnoutL, vCranialMidL, vCheekL, armorPlateDark);
  pushTri(vSnoutR, vCheekR, vCranialMidR, armorPlateDark);

  // Ventral throat plate sealing between head and nuchal collar
  pushQuad(vCheekL, vOpercularL, vNuchalThroat, vMandibleChin, armorPlateDark);
  pushQuad(vCheekR, vMandibleChin, vNuchalThroat, vOpercularR, armorPlateDark);

  // --- Thoracic Collar Shield Facets (Overlapping armor plates) ---
  pushQuad(vNuchalCrest, vThoraxDorsal, vThoraxSideL, vNuchalFlangeL, armorPlateHighlight);
  pushQuad(vNuchalCrest, vNuchalFlangeR, vThoraxSideR, vThoraxDorsal, armorPlateHighlight);
  pushQuad(vNuchalFlangeL, vThoraxSideL, vThoraxVentL, vOpercularL, armorPlateBase);
  pushQuad(vNuchalFlangeR, vOpercularR, vThoraxVentR, vThoraxSideR, armorPlateBase);
  pushQuad(vOpercularL, vThoraxVentL, vThoraxKeel, vNuchalThroat, armorPlateDark);
  pushQuad(vOpercularR, vNuchalThroat, vThoraxKeel, vThoraxVentR, armorPlateDark);

  // Trailing thoracic collar plates
  pushQuad(vThoraxDorsal, vArmorRearDorsal, vArmorRearL, vThoraxSideL, armorPlateBase);
  pushQuad(vThoraxDorsal, vThoraxSideR, vArmorRearR, vArmorRearDorsal, armorPlateBase);
  pushQuad(vThoraxSideL, vArmorRearL, vArmorRearVentL, vThoraxVentL, armorPlateDark);
  pushQuad(vThoraxSideR, vThoraxVentR, vArmorRearVentR, vArmorRearR, armorPlateDark);
  pushQuad(vThoraxVentL, vArmorRearVentL, vArmorRearKeel, vThoraxKeel, armorPlateDark);
  pushQuad(vThoraxVentR, vThoraxKeel, vArmorRearKeel, vArmorRearVentR, armorPlateDark);

  // Rear armor rim bevel (blending into the skin back seamlessly)
  pushTri(vArmorRearDorsal, pTorsoFront, vArmorRearL, skinBack);
  pushTri(vArmorRearDorsal, vArmorRearR, pTorsoFront, skinBack);
  pushTri(vArmorRearL, pTorsoFront, vArmorRearVentL, skinMid);
  pushTri(vArmorRearR, vArmorRearVentR, pTorsoFront, skinMid);
  pushTri(vArmorRearVentL, pTorsoFront, vArmorRearKeel, skinBelly);
  pushTri(vArmorRearVentR, vArmorRearKeel, pTorsoFront, skinBelly);

  // =========================================================================
  // 3. SHEARING GNATHAL BONE BLADES (PLACODERM TEETH & JAWS)
  // =========================================================================
  pushTri(vSnoutApex, vUpperJawBaseL, vUpperFangTipL, boneBladeColor);
  pushTri(vSnoutApex, vUpperFangTipR, vUpperJawBaseR, boneBladeColor);
  pushTri(vSnoutApex, vUpperFangTipL, vUpperBladeMid, boneBladeEdge);
  pushTri(vSnoutApex, vUpperBladeMid, vUpperFangTipR, boneBladeEdge);

  // Lower jaw outer shell & cutting edge
  pushTri(vMandibleTip, vLowerFangL, vMandibleChin, boneBladeEdge);
  pushTri(vMandibleTip, vMandibleChin, vLowerFangR, boneBladeEdge);
  pushQuad(vLowerFangL, vMandibleBaseL, vCheekL, vSnoutL, boneBladeColor);
  pushQuad(vLowerFangR, vSnoutR, vCheekR, vMandibleBaseR, boneBladeColor);
  pushTri(vMandibleChin, vMandibleBaseL, vNuchalThroat, armorPlateDark);
  pushTri(vMandibleChin, vNuchalThroat, vMandibleBaseR, armorPlateDark);

  // Mouth Interior (Dark cavity inside)
  const vMouthThroat = p(0.0, -0.01, zCranialApex + 0.05, 0.02);
  pushTri(vUpperBladeMid, vMouthThroat, vUpperFangTipL, mouthInside);
  pushTri(vUpperBladeMid, vUpperFangTipR, vMouthThroat, mouthInside);
  pushTri(vMandibleTip, vLowerFangL, vMouthThroat, mouthInside);
  pushTri(vMandibleTip, vMouthThroat, vLowerFangR, mouthInside);

  // =========================================================================
  // 4. EYES WITH BONY SCLEROTIC RINGS
  // =========================================================================
  const eyeOffsetZ = zCranialApex + 0.07;
  const eyeRadius = 0.022 * scale;
  const pEyeL = p(0.125, 0.035, eyeOffsetZ, 0.02);
  const pEyeR = p(-0.125, 0.035, eyeOffsetZ, 0.02);

  // Sclerotic bone rings (raised circular eye shield)
  buildLowPolySphere(pEyeL, eyeRadius * 1.35, 3, eyeScleroticRing, 0, 0, vertices, colors, indices);
  buildLowPolySphere(pEyeR, eyeRadius * 1.35, 3, eyeScleroticRing, 0, 0, vertices, colors, indices);
  // Dark predatory pupils
  buildLowPolySphere(p(0.138, 0.035, eyeOffsetZ, 0.02), eyeRadius * 0.85, 3, eyePupil, 0, 0, vertices, colors, indices);
  buildLowPolySphere(p(-0.138, 0.035, eyeOffsetZ, 0.02), eyeRadius * 0.85, 3, eyePupil, 0, 0, vertices, colors, indices);

  // =========================================================================
  // 5. LATERAL ARMORED SCUTE RIDGES (ROW OF SHARP SCUTES ALONG BODY SIDES)
  // =========================================================================
  const numScutes = 7;
  for (let s = 0; s < numScutes; s++) {
    const st = s / (numScutes - 1);
    const sz = (-0.08) * (1 - st) + (-0.68) * st;
    const sy = (-0.01) * (1 - st) + (-0.02) * st;
    const sw = (0.13) * (1 - st) + (0.05) * st;
    const sag = 0.05 * (1 - st) + 0.35 * st;

    const pBaseL  = p(sw, sy, sz, sag);
    const pPeakL  = p(sw + 0.028 * (1 - st * 0.4), sy, sz - 0.02, sag);
    const pRearL  = p(sw * 0.95, sy - 0.005, sz - 0.04, sag);

    const pBaseR  = p(-sw, sy, sz, sag);
    const pPeakR  = p(-sw - 0.028 * (1 - st * 0.4), sy, sz - 0.02, sag);
    const pRearR  = p(-sw * 0.95, sy - 0.005, sz - 0.04, sag);

    // Left lateral scute spine
    pushTri(pBaseL, pPeakL, pRearL, lateralRidgeColor);
    // Right lateral scute spine
    pushTri(pBaseR, pRearR, pPeakR, lateralRidgeColor);
  }

  // =========================================================================
  // 6. LARGE PAIRED PECTORAL FINS (WIDE WINGS WITH ORANGE FRINGES)
  // Smooth, slow, majestic fin strokes
  // =========================================================================
  const finStroke = isRagdoll ? 0 : Math.sin((animPhase || 0) * 1.2) * 0.13;
  const finRoll   = isRagdoll ? 0 : Math.cos((animPhase || 0) * 1.2) * 0.08;

  // Left Pectoral Fin Vertices
  const vPectRootFrontL = p(0.145, -0.03, 0.06, 0.04);
  const vPectRootRearL  = p(0.125, -0.05, -0.06, 0.06);
  const vPectMidLeadL   = p(0.24 + finRoll * 0.04, -0.08 + finStroke * 0.08, 0.02, 0.08);
  const vPectMidTrailL  = p(0.20 + finRoll * 0.03, -0.10 + finStroke * 0.06, -0.10, 0.10);
  const vPectTipLeadL   = p(0.35 + finRoll * 0.06, -0.13 + finStroke * 0.14, -0.04, 0.12);
  const vPectTipApexL   = p(0.38 + finRoll * 0.08, -0.15 + finStroke * 0.16, -0.12, 0.14);
  const vPectTipTrailL  = p(0.28 + finRoll * 0.05, -0.14 + finStroke * 0.12, -0.18, 0.15);

  // Left Pectoral Fin Facets
  pushQuad(vPectRootFrontL, vPectMidLeadL, vPectMidTrailL, vPectRootRearL, finBaseGrey);
  pushQuad(vPectMidLeadL, vPectTipLeadL, vPectTipApexL, vPectMidTrailL, finOrangeDark);
  pushTri(vPectMidTrailL, vPectTipApexL, vPectTipTrailL, finOrange);
  pushTri(vPectTipLeadL, vPectTipApexL, p(0.39, -0.16 + finStroke * 0.17, -0.09, 0.14), finOrange);

  // Right Pectoral Fin Vertices
  const vPectRootFrontR = p(-0.145, -0.03, 0.06, 0.04);
  const vPectRootRearR  = p(-0.125, -0.05, -0.06, 0.06);
  const vPectMidLeadR   = p(-0.24 - finRoll * 0.04, -0.08 - finStroke * 0.08, 0.02, 0.08);
  const vPectMidTrailR  = p(-0.20 - finRoll * 0.03, -0.10 - finStroke * 0.06, -0.10, 0.10);
  const vPectTipLeadR   = p(-0.35 - finRoll * 0.06, -0.13 - finStroke * 0.14, -0.04, 0.12);
  const vPectTipApexR   = p(-0.38 - finRoll * 0.08, -0.15 - finStroke * 0.16, -0.12, 0.14);
  const vPectTipTrailR  = p(-0.28 - finRoll * 0.05, -0.14 - finStroke * 0.12, -0.18, 0.15);

  // Right Pectoral Fin Facets
  pushQuad(vPectRootFrontR, vPectRootRearR, vPectMidTrailR, vPectMidLeadR, finBaseGrey);
  pushQuad(vPectMidLeadR, vPectMidTrailR, vPectTipApexR, vPectTipLeadR, finOrangeDark);
  pushTri(vPectMidTrailR, vPectTipTrailR, vPectTipApexR, finOrange);
  pushTri(vPectTipLeadR, p(-0.39, -0.16 - finStroke * 0.17, -0.09, 0.14), vPectTipApexR, finOrange);

  // =========================================================================
  // 7. HIGH-SAILED DORSAL FIN (TRIANGULAR FIN WITH DETAILED RAYS)
  // =========================================================================
  const dorsalZLead  = -0.18;
  const dorsalZApex  = -0.28;
  const dorsalZTrail = -0.44;

  const vDorsalBaseFront = p(0.0, 0.13, dorsalZLead, 0.10);
  const vDorsalBaseMid   = p(0.0, 0.11, dorsalZApex, 0.16);
  const vDorsalBaseRear  = p(0.0, 0.07, dorsalZTrail, 0.24);

  const vDorsalApex      = p(0.0, 0.28, dorsalZApex + 0.03, 0.16);
  const vDorsalCrestMid  = p(0.0, 0.23, dorsalZApex - 0.06, 0.20);
  const vDorsalCrestRear = p(0.0, 0.14, dorsalZTrail + 0.03, 0.24);

  // Dorsal fin webbed membrane
  pushTri(vDorsalBaseFront, vDorsalApex, vDorsalBaseMid, finOrangeDark);
  pushQuad(vDorsalBaseMid, vDorsalApex, vDorsalCrestMid, vDorsalBaseRear, finOrange);
  pushTri(vDorsalBaseRear, vDorsalCrestMid, vDorsalCrestRear, finOrange);

  // Dorsal fin ray rib highlights
  const numDorsalRays = 5;
  for (let r = 1; r < numDorsalRays; r++) {
    const rt = r / numDorsalRays;
    const rBase = p(0.0, 0.12 * (1 - rt) + 0.08 * rt, dorsalZLead * (1 - rt) + dorsalZTrail * rt, 0.18);
    const rTip  = p(0.0, 0.28 * (1 - rt * 0.5), dorsalZApex * (1 - rt) + dorsalZTrail * rt, 0.20);
    buildTaperedSegment(rBase, rTip, 0.006 * scale, 0.002 * scale, 3, armorPlateHighlight, vertices, colors, indices);
  }

  // =========================================================================
  // 8. PAIRED PELVIC FINS & ANAL FIN
  // =========================================================================
  // Pelvic Fins (Smaller paired fins on lower belly)
  const pelvicZ = -0.42;
  const vPelvicRootL = p(0.065, -0.06, pelvicZ, 0.22);
  const vPelvicTipL  = p(0.14, -0.11, pelvicZ - 0.08, 0.26);
  const vPelvicRearL = p(0.05, -0.055, pelvicZ - 0.12, 0.28);
  pushTri(vPelvicRootL, vPelvicTipL, vPelvicRearL, finOrange);

  const vPelvicRootR = p(-0.065, -0.06, pelvicZ, 0.22);
  const vPelvicTipR  = p(-0.14, -0.11, pelvicZ - 0.08, 0.26);
  const vPelvicRearR = p(-0.05, -0.055, pelvicZ - 0.12, 0.28);
  pushTri(vPelvicRootR, vPelvicRearR, vPelvicTipR, finOrange);

  // Anal Fin (Single ventral fin near caudal peduncle)
  const vAnalBaseFront = p(0.0, -0.045, -0.62, 0.32);
  const vAnalTip       = p(0.0, -0.13, -0.72, 0.38);
  const vAnalBaseRear  = p(0.0, -0.025, -0.76, 0.40);
  pushTri(vAnalBaseFront, vAnalTip, vAnalBaseRear, finOrange);

  // =========================================================================
  // 9. POWERFUL HETEROCERCAL CAUDAL FIN (DEVONIAN ARMORED FISH TAIL)
  // Large upper lobe with vertebral axis support + sweeping ventral lobe
  // =========================================================================
  const zTailBase = -0.90;
  const zTailTipU = -1.18; // Elongated dorsal lobe tip
  const zTailTipL = -1.06; // Ventral lobe tip

  const vTailPeduncleTop = p(0.0, 0.025, zTailBase, 0.42);
  const vTailPeduncleMid = p(0.0, 0.0, zTailBase, 0.44);
  const vTailPeduncleBot = p(0.0, -0.02, zTailBase, 0.46);

  const vCaudalDorsalApex  = p(0.0, 0.18, zTailTipU, 0.50);
  const vCaudalDorsalEdge  = p(0.0, 0.11, zTailTipU + 0.08, 0.48);
  const vCaudalFork        = p(0.0, 0.01, zTailBase - 0.16, 0.46);
  const vCaudalVentralApex = p(0.0, -0.12, zTailTipL, 0.48);
  const vCaudalVentralEdge = p(0.0, -0.06, zTailTipL + 0.06, 0.46);

  // Upper caudal lobe (Epicercal shark-like dorsal sweep)
  pushTri(vTailPeduncleTop, vCaudalDorsalApex, vCaudalDorsalEdge, finOrangeDark);
  pushTri(vTailPeduncleTop, vCaudalDorsalEdge, vCaudalFork, finOrange);
  // Lower caudal lobe
  pushTri(vTailPeduncleBot, vCaudalFork, vCaudalVentralEdge, finOrangeDark);
  pushTri(vTailPeduncleBot, vCaudalVentralEdge, vCaudalVentralApex, finOrange);
  // Central fin connection
  pushTri(vTailPeduncleMid, vTailPeduncleTop, vCaudalFork, skinBelly);
  pushTri(vTailPeduncleMid, vCaudalFork, vTailPeduncleBot, skinBelly);

  // Caudal fin ray ribs
  const pTailCap = p(0.0, 0.0, zTailBase - 0.02, 0.45);
  buildLowPolySphere(pTailCap, 0.018 * scale, 3, skinBelly, 0, 0, vertices, colors, indices);

  // Set colliders for collision and damage
  if (f !== null && c !== null) {
    const pHeadCol = p(0.0, 0.04, 0.20, 0.0);
    const pBodyCol = p(0.0, 0.03, -0.22, 0.15);
    const pMidCol = p(0.0, 0.01, -0.55, 0.30);
    const pTailCol = p(0.0, 0.0, -0.85, 0.45);
    c.colliders = [
      { offset: [pHeadCol[0] - pos[0], pHeadCol[1] - pos[1], pHeadCol[2] - pos[2]], radius: 0.18 * scale * 1.5 },
      { offset: [pBodyCol[0] - pos[0], pBodyCol[1] - pos[1], pBodyCol[2] - pos[2]], radius: 0.22 * scale * 1.5 },
      { offset: [pMidCol[0] - pos[0], pMidCol[1] - pos[1], pMidCol[2] - pos[2]], radius: 0.16 * scale * 1.5 },
      { offset: [pTailCol[0] - pos[0], pTailCol[1] - pos[1], pTailCol[2] - pos[2]], radius: 0.12 * scale * 1.5 },
    ];
  }
};

// Register Placoderm in global NpcRegistry
window.NpcRegistry = window.NpcRegistry || {};
window.NpcRegistry["placoderm"] = {
  maxHp: 12, // High endurance prehistoric armored fish
  moveSpeed: 0.22,
  animSpeed: 1.5,
  disableRandomJitter: true,
  updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
    if (c.ragdollEnabled || (c.hp !== undefined && c.hp <= 0)) {
      return;
    }

    if (c.hp === undefined) {
      c.hp = 12;
      c.maxHp = 12;
    }

    let px = 0, py = 0, pz = 0;
    let distToPlayer = 999;
    let dx = 0, dy = 0, dz = 0;

    try {
      if (typeof player_pos !== "undefined" && player_pos && player_pos.length >= 3) {
        px = player_pos[0];
        py = player_pos[1];
        pz = player_pos[2];
      } else {
        const pTheta = typeof charTheta !== "undefined" ? charTheta : 0;
        const pPhi = typeof charPhi !== "undefined" ? charPhi : 0;
        const pR = (typeof RADIUS !== "undefined" ? RADIUS : 8.0) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(pTheta, pPhi, seed) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 0.6) : 0);
        px = pR * Math.sin(pTheta) * Math.cos(pPhi);
        py = pR * Math.cos(pTheta);
        pz = pR * Math.sin(pTheta) * Math.sin(pPhi);
      }

      const sinT = Math.sin(c.theta);
      const cosT = Math.cos(c.theta);
      const sinP = Math.sin(c.phi);
      const cosP = Math.cos(c.phi);

      const cx = c.r * sinT * cosP;
      const cy = c.r * cosT;
      const cz = c.r * sinT * sinP;

      dx = px - cx;
      dy = py - cy;
      dz = pz - cz;
      distToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);
    } catch (e) {}

    const isDriving = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech);
    const ignorePlayer = (typeof window !== "undefined" && window.npcIgnorePlayer);

    const isWaterDisabled = (typeof waterEnabled !== "undefined" && !waterEnabled);
    const isOnGround = isWaterDisabled || !wRadius || (wRadius <= 0) || (gRadius > wRadius - 0.02) || (c.r > wRadius + 0.03);

    if (isOnGround) {
      // Placoderm strictly lives in water: try to relocate to valid ocean water immediately
      let relocated = false;
      const wR_target = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 0) * 0.15;
      if (!isWaterDisabled && wR_target > RADIUS + 0.01) {
        for (let tries = 0; tries < 40; tries++) {
          const testT = Math.random() * Math.PI;
          const testP = Math.random() * Math.PI * 2;
          const testH = (typeof getHeightOnSphere === "function") ? getHeightOnSphere(testT, testP, seed) : 0;
          const testGR = RADIUS + testH * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : 0.6);
          if (testGR < wR_target - 0.02) {
            c.theta = testT;
            c.phi = testP;
            c.r = Math.max(testGR + 0.04, wR_target - 0.04);
            c.isSwimming = true;
            relocated = true;
            break;
          }
        }
      }

      if (!relocated) {
        // Stranded on dry land without water access: Placoderm flops toward water
        c.isSwimming = false;
        c.moveSpeed = 0.0;
        c.walkBlend = 0.0;
        c.isChasing = false;
        c.isTurningFromShore = false;
        if (c.r < gRadius + 0.04) {
          c.r = gRadius + 0.04;
          c.heading += Math.sin(c.animPhase * 3.0) * deltaTime * 0.5; // Natural flopping back and forth on land
        } else if (c.r > gRadius + 0.05) {
          c.r -= 0.6 * deltaTime;
        }
        if (npcCaveData && npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
          const maxAllowedR = npcCaveData.ceiling - 0.05;
          if (c.r > maxAllowedR) {
            c.r = maxAllowedR;
          }
        }
        c.animPhase += deltaTime * 1.8; // Heavy slow flopping animation on land
        c.diveDepth = 0.0;
        c.targetDiveDepth = 0.0;

        // Placoderm is out of water on the ground: HP continuously decreases until it dies
        const suffocateDmgRate = 1.2; // ~10 seconds from full health (12 HP) to death
        c.hp -= suffocateDmgRate * deltaTime;

        if (c.hp <= 0) {
          c.hp = 0;
          c.ragdollEnabled = true;
          c.isSwimming = false;
          c.moveSpeed = 0.0;
          c.walkBlend = 0.0;
          const sinT = Math.sin(c.theta);
          const cosT = Math.cos(c.theta);
          const sinP = Math.sin(c.phi);
          const cosP = Math.cos(c.phi);
          const N_init = [sinT * cosP, cosT, sinT * sinP];
          c.ragdollPos = [
            N_init[0] * c.r,
            N_init[1] * c.r,
            N_init[2] * c.r
          ];
          c.position = [c.ragdollPos[0], c.ragdollPos[1], c.ragdollPos[2]];
          c.ragdollVel = [0, 0, 0];
          c.ragdollAxis = c.ragdollAxis && Array.isArray(c.ragdollAxis) && c.ragdollAxis.length >= 3 ? c.ragdollAxis : [0, 1, 0];
          c.ragdollAngle = Math.PI * 0.48; // Lies flat on its side when dead on land
          c.ragdollAngularSpeed = 0;
          c.ragdollInitialized = true;
          c.ragdollAsleep = false;
          c.diedOnSurface = true;
          return;
        }
      }
    } else {
      // In ocean / water: Active apex predator swimming
      c.isSwimming = true;

      // Check if player is actually in the water (swimming, diving, but NOT driving a vehicle)
      const pR_est = Math.sqrt(px * px + py * py + pz * pz);
      const pwRadius = (typeof getWaterRadiusAt === "function") ? getWaterRadiusAt(px, py, pz, false) : wRadius;
      const isPlayerInWater = !isDriving && (pR_est < pwRadius + 0.04 && (typeof currentSwimFactor !== "undefined" ? currentSwimFactor > 0.05 : true));

      // Aggressive predator behavior: Only chases player when the player is in water and NOT driving!
      if (distToPlayer < 12.0 && isPlayerInWater && !isDriving && !ignorePlayer) {
        c.isChasing = true;
        c.isTurningFromShore = false;
        c.moveSpeed = 0.46; // Fast, powerful swim speed when pursuing

        const sinT = Math.sin(c.theta);
        const cosT = Math.cos(c.theta);
        const sinP = Math.sin(c.phi);
        const cosP = Math.cos(c.phi);

        // Vector pointing to player projected on local spherical coordinate frame (East, North)
        const dot_E = dx * (-sinP) + dz * cosP;
        const dot_N = dx * (-cosT * cosP) + dy * sinT + dz * (-cosT * sinP);
        const targetHeading = Math.atan2(dot_E, dot_N);

        let diff = targetHeading - c.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnSpeed = 2.4 * deltaTime;
        if (Math.abs(diff) <= turnSpeed) {
          c.heading = targetHeading;
        } else {
          c.heading += Math.sign(diff) * turnSpeed;
        }

        c.animPhase += deltaTime * 2.8;

        // Depth tracking: match player's depth while keeping within water boundaries
        const targetR = Math.max(gRadius + 0.05, Math.min(wRadius - 0.04, pR_est));
        if (c.r < targetR) {
          c.r = Math.min(targetR, c.r + 0.35 * deltaTime);
        } else if (c.r > targetR) {
          c.r = Math.max(targetR, c.r - 0.35 * deltaTime);
        }

        // Shearing bite attack when within striking distance and NOT driving
        if (distToPlayer < 1.6 && !isDriving && !ignorePlayer) {
          try {
            if (
              typeof damagePlayer === 'function' &&
              typeof playerDamageCooldown !== 'undefined' &&
              playerDamageCooldown <= 0 &&
              typeof playerControlsLocked !== 'undefined' &&
              !playerControlsLocked &&
              typeof playerHP !== 'undefined' &&
              playerHP > 0
            ) {
              damagePlayer(6); // Powerful shearing bite (6 DMG)
            }
          } catch (e) {}
        }
      } else {
        // Peaceful / patrolling swim - calm, slow, majestic cruising
        c.isChasing = false;
        c.moveSpeed = 0.22; // Smooth, stately cruising speed

        // Shore avoidance: When hitting shallow waters near the shore, smoothly turn around 180 deg towards the deep ocean
        if (gRadius > wRadius - 0.16) {
          if (!c.isTurningFromShore) {
            c.isTurningFromShore = true;
            // Turn around 180 degrees with slight random variance to head straight back out to sea
            c.shoreTurnTarget = c.heading + Math.PI + (Math.random() - 0.5) * 0.4;
            while (c.shoreTurnTarget > Math.PI) c.shoreTurnTarget -= Math.PI * 2;
            while (c.shoreTurnTarget < -Math.PI) c.shoreTurnTarget += Math.PI * 2;
          }

          let shoreDiff = c.shoreTurnTarget - c.heading;
          while (shoreDiff > Math.PI) shoreDiff -= Math.PI * 2;
          while (shoreDiff < -Math.PI) shoreDiff += Math.PI * 2;

          const shoreTurnSpeed = 2.2 * deltaTime;
          if (Math.abs(shoreDiff) <= shoreTurnSpeed) {
            c.heading = c.shoreTurnTarget;
          } else {
            c.heading += Math.sign(shoreDiff) * shoreTurnSpeed;
          }

          c.animPhase += deltaTime * 1.6;
        } else {
          // Safe in deep water: Reset shore turn flag
          c.isTurningFromShore = false;

          // Normal natural straight cruising with occasional gentle wander curves
          if (c.turnTimer === undefined) c.turnTimer = 3.0 + Math.random() * 4.0;
          if (c.targetTurnRate === undefined) c.targetTurnRate = 0;
          if (c.currentTurnRate === undefined) c.currentTurnRate = 0;

          c.turnTimer -= deltaTime;
          if (c.turnTimer <= 0) {
            c.turnTimer = 4.0 + Math.random() * 6.0;
            // 70% straight swim, 30% gentle turn curve
            if (Math.random() < 0.3) {
              c.targetTurnRate = (Math.random() - 0.5) * 0.35;
            } else {
              c.targetTurnRate = 0; // Pure straight cruising
            }
          }

          c.currentTurnRate += (c.targetTurnRate - c.currentTurnRate) * Math.min(1.0, 1.5 * deltaTime);
          c.heading += c.currentTurnRate * deltaTime;

          c.animPhase += deltaTime * 1.4; // Very smooth, calm undulating swim
        }
      }

      // Smooth diving & ocean depth cycling
      if (c.diveDepth === undefined) c.diveDepth = 0.0;
      if (c.targetDiveDepth === undefined) c.targetDiveDepth = 0.0;
      if (c.diveTimer === undefined) c.diveTimer = Math.random() * 6.0;

      c.diveTimer -= deltaTime;
      if (c.diveTimer <= 0) {
        c.diveTimer = 9.0 + Math.random() * 8.0;
        // Placoderms love patrolling mid-to-deep ocean waters
        if (Math.random() < 0.7) {
          const maxDive = Math.max(0.0, wRadius - 0.06 - (gRadius + 0.06));
          c.targetDiveDepth = (0.25 + Math.random() * 0.65) * maxDive;
        } else {
          c.targetDiveDepth = 0.02; // Near water surface
        }
      }

      const diveRate = 0.15 * deltaTime;
      if (c.diveDepth < c.targetDiveDepth) {
        c.diveDepth = Math.min(c.targetDiveDepth, c.diveDepth + diveRate);
      } else if (c.diveDepth > c.targetDiveDepth) {
        c.diveDepth = Math.max(c.targetDiveDepth, c.diveDepth - diveRate);
      }

      let targetR = wRadius - 0.05 - c.diveDepth;
      if (npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
        targetR = Math.min(targetR, npcCaveData.ceiling - 0.05);
      }

      if (c.r < targetR) {
        c.r = Math.min(targetR, c.r + 0.25 * deltaTime);
      } else if (c.r > targetR) {
        c.r = Math.max(targetR, c.r - 0.25 * deltaTime);
      }
    }
  },
  render: function(
    c,
    allVertices,
    allColors,
    allIndices,
    scale,
    N,
    R,
    F,
    pos,
    f,
    transformPoint,
    seed
  ) {
    window.buildPlacodermModel(
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
      null,
      f,
      transformPoint,
      c
    );
  }
};
