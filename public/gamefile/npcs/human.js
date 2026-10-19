// === SEEDPLANET MODULE: JS/NPCS/HUMAN MEDIUM POLY.JS ===
// Enhanced Anatomical Human Model with Proper Joint Articulation
// Realistic wrist rotation, elbow/knee/neck/body joints with natural bending

window.buildHumanModel = function(
  seed,
  animPhase,
  isRagdoll,
  isSwimming,
  scaleMultiplier,
  pos,
  R,
  N,
  F,
  outVertices,
  outColors,
  outIndices,
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

  // Master Scale
  const scale = 0.62 * scaleMultiplier;

  // Colors
  const skinColor = overrideColors ? overrideColors : [0.82, 0.72, 0.63];
  const skinLight = [0.88, 0.80, 0.72];
  const skinDark = [0.70, 0.60, 0.52];
  const muscleColor = [0.75, 0.62, 0.52];
  const jointColor = [0.68, 0.58, 0.50];
  const jointDark = [0.60, 0.50, 0.42];
  const eyeWhite = [0.98, 0.98, 0.98];
  const eyePupil = [0.10, 0.08, 0.06];
  const eyeIris = [0.45, 0.30, 0.20];
  const browColor = [0.30, 0.22, 0.16];
  const lipColor = [0.70, 0.45, 0.40];
  const lipInner = [0.55, 0.30, 0.25];
  const nailColor = [0.88, 0.80, 0.75];
  const nailPink = [0.90, 0.75, 0.70];

  const sagVec = f || (isRagdoll ? F : [0, 0, 0]);

  const mp = (x, y, z) => {
    return transformPoint(x * scale, y * scale, z * scale);
  };

  const breathePhase = (c && c.idleAnimPhase) ? c.idleAnimPhase : 0;
  const breatheExpand = isRagdoll ? 0 : Math.sin(breathePhase) * 0.0020;
  const breatheRaise = isRagdoll ? 0 : Math.sin(breathePhase) * 0.0015;

  const walkBlend = (c && c.walkBlend !== undefined) ? c.walkBlend : 0.0;
  const walkPhase = isRagdoll ? 0 : animPhase * 4.5;
  const moveL = isRagdoll ? 0 : Math.sin(walkPhase) * walkBlend;
  const moveR = isRagdoll ? 0 : Math.sin(walkPhase + Math.PI) * walkBlend;

  // Body sway and head tilt
  const headTilt = isRagdoll ? 0 : Math.sin(breathePhase * 0.5) * 0.005;
  const bodySway = isRagdoll ? 0 : Math.sin(breathePhase * 0.7) * 0.004;

  // Joint bend angles - anatomically synchronized human gait
  // Left arm swings forward when moveR > 0 (opposite to Left leg moveL)
  const elbowBendL = isRagdoll ? 0.08 : (0.12 + Math.max(0, moveR) * 0.38) * walkBlend + 0.10 * (1 - walkBlend);
  const elbowBendR = isRagdoll ? 0.08 : (0.12 + Math.max(0, moveL) * 0.38) * walkBlend + 0.10 * (1 - walkBlend);

  // Knee bending during walk cycle:
  // Knee flexes backward to lift foot clear of ground during swing phase (when leg transitions from back to forward)
  const kneePhaseL = -Math.sin(walkPhase - 0.4);
  const kneeBendL = isRagdoll ? 0.06 : Math.max(0.04, (kneePhaseL * 0.42 + 0.08) * walkBlend);
  
  const kneePhaseR = -Math.sin(walkPhase + Math.PI - 0.4);
  const kneeBendR = isRagdoll ? 0.06 : Math.max(0.04, (kneePhaseR * 0.42 + 0.08) * walkBlend);

  // Body dynamics during gait:
  // Pelvis swivel & shoulder counter-swivel around vertical axis Y
  const pelvisTwist = isRagdoll ? 0 : moveL * 0.08 * walkBlend;
  const shoulderTwist = isRagdoll ? 0 : -moveL * 0.06 * walkBlend;
  
  // Natural vertical bobbing (highest at mid-stance, lowest at double support)
  const walkBob = isRagdoll ? 0 : (Math.cos(walkPhase * 2) * 0.008 - 0.004) * walkBlend;

  const neckTilt = isRagdoll ? 0 : Math.sin(breathePhase * 0.3) * 0.003;
  const spineBend = isRagdoll ? 0 : Math.sin(breathePhase * 0.4) * 0.005;

  // =========================================================================
  // GEOMETRY HELPERS
  // =========================================================================
  function addV(p, color) {
    const idx = outVertices.length / 3;
    outVertices.push(p[0], p[1], p[2]);
    outColors.push(color[0], color[1], color[2]);
    return idx;
  }

  function addQuad(i0, i1, i2, i3) {
    outIndices.push(i0, i2, i1);
    outIndices.push(i0, i3, i2);
  }

  function addTri(i0, i1, i2) {
    outIndices.push(i0, i2, i1);
  }

  function capRing(centerPt, ringIndices, reverse = false, color = skinColor) {
    const cIdx = addV(centerPt, color);
    const n = ringIndices.length;
    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      if (reverse) {
        addTri(cIdx, ringIndices[nextI], ringIndices[i]);
      } else {
        addTri(cIdx, ringIndices[i], ringIndices[nextI]);
      }
    }
  }

  function createRing(center, rx, ry, rz, numSegs, ptTransformFn, colorFn, sagScale = 0) {
    const ring = [];
    for (let i = 0; i < numSegs; i++) {
      const a = (i / numSegs) * Math.PI * 2;
      const lx = center[0] + Math.cos(a) * rx;
      const ly = center[1];
      const lz = center[2] + Math.sin(a) * rz;
      const p = ptTransformFn(lx, ly, lz, sagScale);
      const col = (typeof colorFn === 'function') ? colorFn(i, numSegs, a, lx, ly, lz, p) : colorFn;
      ring.push(addV(p, col));
    }
    return ring;
  }

  function createMuscleRing(center, rx, ry, rz, numSegs, ptTransformFn, colorFn, sagScale = 0, muscleBulk = 0) {
    const ring = [];
    for (let i = 0; i < numSegs; i++) {
      const a = (i / numSegs) * Math.PI * 2;
      let curRx = rx;
      let curRz = rz;

      if (muscleBulk > 0) {
        const muscleAngle = Math.sin(a);
        const muscleWeight = Math.pow(Math.abs(muscleAngle), 0.8);
        const musclePos = (Math.cos(a * 2) * 0.5 + 0.5);
        curRx += muscleBulk * muscleWeight * (0.6 + 0.4 * musclePos);
        curRz += muscleBulk * muscleWeight * 0.3;
      }

      const lx = center[0] + Math.cos(a) * curRx;
      const ly = center[1];
      const lz = center[2] + Math.sin(a) * curRz;
      const p = ptTransformFn(lx, ly, lz, sagScale);
      const col = (typeof colorFn === 'function') ? colorFn(i, numSegs, a, lx, ly, lz, p) : colorFn;
      ring.push(addV(p, col));
    }
    return ring;
  }

  function createFootRing(center, rx, yTop, yBottom, rz, numSegs, ptTransformFn, colorFn, sagScale = 0) {
    const ring = [];
    for (let i = 0; i < numSegs; i++) {
      const a = (i / numSegs) * Math.PI * 2;
      const sinA = Math.sin(a);
      const cosA = Math.cos(a);

      const lx = center[0] + cosA * rx;
      const ly = center[1] + (sinA > 0 ? sinA * yTop : sinA * yBottom);
      const lz = center[2] + sinA * rz;

      const p = ptTransformFn(lx, ly, lz, sagScale);
      const col = (typeof colorFn === 'function') ? colorFn(i, numSegs, a, lx, ly, lz, p) : colorFn;
      ring.push(addV(p, col));
    }
    return ring;
  }

  function createXYFootRing(centerZ, rx, yTop, yBottom, numSegs, ptTransformFn, colorFn, sagScale = 0) {
    const ring = [];
    const yCenter = (yTop + yBottom) * 0.5;
    const ry = (yTop - yBottom) * 0.5;

    for (let i = 0; i < numSegs; i++) {
      const a = (i / numSegs) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);

      const lx = cosA * rx;
      const ly = yCenter + sinA * ry;
      const lz = centerZ;

      const p = ptTransformFn(lx, ly, lz, sagScale);
      const col = (typeof colorFn === 'function') ? colorFn(i, numSegs, a, lx, ly, lz, p) : colorFn;
      ring.push(addV(p, col));
    }
    return ring;
  }

  function bridgeRings(rA, rB) {
    const n = Math.min(rA.length, rB.length);
    for (let i = 0; i < n; i++) {
      const nextI = (i + 1) % n;
      addQuad(rA[i], rA[nextI], rB[nextI], rB[i]);
    }
  }

  function bridgeEdges(loopA, loopB, reverseWinding = false) {
    const nA = loopA.length;
    const nB = loopB.length;
    if (nA === 0 || nB === 0) return;
    const steps = Math.max(nA, nB);
    for (let i = 0; i < steps; i++) {
      const iA1 = Math.floor((i / steps) * nA) % nA;
      const iA2 = Math.floor(((i + 1) / steps) * nA) % nA;
      const iB1 = Math.floor((i / steps) * nB) % nB;
      const iB2 = Math.floor(((i + 1) / steps) * nB) % nB;
      if (reverseWinding) {
        if (iA1 !== iA2 && iB1 !== iB2) {
          addQuad(loopA[iA2], loopA[iA1], loopB[iB1], loopB[iB2]);
        } else if (iA1 !== iA2) {
          addTri(loopA[iA2], loopA[iA1], loopB[iB1]);
        } else if (iB1 !== iB2) {
          addTri(loopA[iA1], loopB[iB1], loopB[iB2]);
        }
      } else {
        if (iA1 !== iA2 && iB1 !== iB2) {
          addQuad(loopA[iA1], loopA[iA2], loopB[iB2], loopB[iB1]);
        } else if (iA1 !== iA2) {
          addTri(loopA[iA1], loopA[iA2], loopB[iB1]);
        } else if (iB1 !== iB2) {
          addTri(loopA[iA1], loopB[iB2], loopB[iB1]);
        }
      }
    }
  }

  // Joint helper - creates a pivot point with natural rotation
  function createJointPivot(basePos, angle, axis, point) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dx = point[0] - basePos[0];
    const dy = point[1] - basePos[1];
    const dz = point[2] - basePos[2];
    
    if (axis === 'x') {
      return [
        basePos[0] + dx,
        basePos[1] + dy * cosA - dz * sinA,
        basePos[2] + dy * sinA + dz * cosA
      ];
    } else if (axis === 'y') {
      return [
        basePos[0] + dx * cosA + dz * sinA,
        basePos[1] + dy,
        basePos[2] - dx * sinA + dz * cosA
      ];
    } else { // z
      return [
        basePos[0] + dx * cosA - dy * sinA,
        basePos[1] + dx * sinA + dy * cosA,
        basePos[2] + dz
      ];
    }
  }

  // =========================================================================
  // FACE COLOR FUNCTION
  // =========================================================================
  const faceColorFn = (i, n, a, lx, ly, lz) => {
    const headY = ly - headTilt; // Invariant head Y coordinate (unaffected by headTilt animation)
    if (lz > 0.018) {
      // Eyebrows (Forehead level ~ 0.44)
      if (headY >= 0.435 && headY <= 0.450 && Math.abs(lx) <= 0.035) {
        if (lz > 0.022 && lz < 0.040) return browColor;
      }
      // Eyes (Eyes level ~ 0.425)
      if (headY >= 0.418 && headY <= 0.432) {
        if (Math.abs(lx) >= 0.010 && Math.abs(lx) <= 0.032) {
          const eyeX = Math.abs(lx);
          const eyeZ = lz;
          if (eyeX >= 0.016 && eyeX <= 0.026 && eyeZ > 0.025) return eyePupil;
          if (eyeX >= 0.012 && eyeX <= 0.030 && eyeZ > 0.020) return eyeIris;
          return eyeWhite;
        }
      }
      // Lips (Mouth level ~ 0.39)
      if (headY >= 0.380 && headY <= 0.400) {
        if (lz > 0.015 && lz < 0.035 && Math.abs(lx) < 0.025) {
          if (headY >= 0.392) return lipInner;
          return lipColor;
        }
      }
      // Cheek (Cheek level ~ 0.41 - 0.425)
      if (headY >= 0.405 && headY <= 0.425 && Math.abs(lx) >= 0.028 && Math.abs(lx) <= 0.045) {
        if (lz > 0.025 && lz < 0.045) return [0.90, 0.75, 0.65];
      }
    }
    return skinColor;
  };

  // =========================================================================
  // 1. TORSO WITH SPINE ARTICULATION
  // =========================================================================
  const N_TORSO = 16;
  
  // Spine articulation - torso bends naturally with shoulder/pelvis counter-rotation
  const torsoPt = (lx, ly, lz, sag) => {
    // Spine bend - more bend in middle of torso
    const spineWeight = Math.max(0, Math.min(1, (ly + 0.15) / 0.45));
    const bendAmount = spineBend * spineWeight * (1 - spineWeight) * 4;
    
    // Twist angle along Y axis (shoulder vs pelvis counter-swivel during gait)
    const twistAngle = ly > 0.05 ? shoulderTwist : pelvisTwist;
    const cosT = Math.cos(twistAngle);
    const sinT = Math.sin(twistAngle);
    
    const rotX = lx * cosT - lz * sinT;
    const rotZ = lx * sinT + lz * cosT + bendAmount * 0.2;
    
    return mp(rotX, ly + bodySway + walkBob, rotZ, sag);
  };

  // Head
  const rSkullCap = createRing([0.0, 0.50 + headTilt, 0.004], 0.032, 0.030, 0.032, N_TORSO, torsoPt, skinColor, 0.30);
  const rCranium = createRing([0.0, 0.47 + headTilt, 0.008], 0.048, 0.045, 0.050, N_TORSO, torsoPt, faceColorFn, 0.30);
  const rForehead = createRing([0.0, 0.44 + headTilt, 0.012], 0.046, 0.043, 0.048, N_TORSO, torsoPt, faceColorFn, 0.30);
  const rEyes = createRing([0.0, 0.425 + headTilt, 0.018], 0.042, 0.038, 0.044, N_TORSO, torsoPt, faceColorFn, 0.30);
  const rNoseBridge = createRing([0.0, 0.41 + headTilt, 0.022], 0.038, 0.035, 0.040, N_TORSO, torsoPt, faceColorFn, 0.28);
  const rMouth = createRing([0.0, 0.39 + headTilt, 0.018], 0.036, 0.033, 0.038, N_TORSO, torsoPt, faceColorFn, 0.28);
  const rChin = createRing([0.0, 0.37 + headTilt, 0.012], 0.030, 0.028, 0.032, N_TORSO, torsoPt, skinColor, 0.25);
  const rJaw = createRing([0.0, 0.35 + headTilt, 0.008], 0.028, 0.026, 0.030, N_TORSO, torsoPt, skinColor, 0.22);
  
  // Neck with articulation
  const rNeckTop = createRing([0.0, 0.33 + headTilt * 0.5 + neckTilt, 0.006], 0.025, 0.024, 0.027, N_TORSO, torsoPt, skinColor, 0.20);
  const rNeckMid = createRing([0.0, 0.315 + headTilt * 0.3 + neckTilt * 0.5, 0.005], 0.028, 0.027, 0.030, N_TORSO, torsoPt, skinColor, 0.20);

  // Torso with muscle
  const rTraps = createMuscleRing([0.0, 0.30 + breatheRaise, 0.010], 0.060, 0.042, 0.048, N_TORSO, torsoPt, skinColor, 0.18, 0.008);
  const rShoulders = createMuscleRing([0.0, 0.27 + breatheRaise, 0.015], 0.110, 0.062, 0.068, N_TORSO, torsoPt, skinColor, 0.15, 0.015);
  const rChest = createMuscleRing([0.0, 0.20 + breatheRaise, 0.020 + breatheExpand], 0.125, 0.070, 0.072, N_TORSO, torsoPt, skinColor, 0.15, 0.020);
  const rPecs = createMuscleRing([0.0, 0.15 + breatheRaise * 0.8, 0.018 + breatheExpand], 0.112, 0.064, 0.068, N_TORSO, torsoPt, skinColor, 0.12, 0.015);
  const rRibs = createRing([0.0, 0.08 + breatheRaise * 0.5, 0.014 + breatheExpand], 0.092, 0.056, 0.058, N_TORSO, torsoPt, skinColor, 0.10);
  const rWaist = createRing([0.0, 0.02, 0.008], 0.082, 0.050, 0.052, N_TORSO, torsoPt, skinColor, 0.08);
  const rAbdomen = createRing([0.0, -0.03, 0.004], 0.086, 0.053, 0.055, N_TORSO, torsoPt, skinColor, 0.06);
  const rPelvisTop = createRing([0.0, -0.06, 0.000], 0.090, 0.058, 0.060, N_TORSO, torsoPt, skinColor, 0.05);
  const rPelvisMid = createRing([0.0, -0.09, -0.003], 0.092, 0.062, 0.062, N_TORSO, torsoPt, skinColor, 0.05);
  const rPelvis = createRing([0.0, -0.12, -0.005], 0.090, 0.060, 0.060, N_TORSO, torsoPt, skinColor, 0.05);
  const rCrotch = createRing([0.0, -0.15, -0.008], 0.082, 0.052, 0.054, N_TORSO, torsoPt, skinColor, 0.05);

  // Head cap
  const pSkullTop = torsoPt(0, 0.52 + headTilt, 0.004, 0.30);
  capRing(pSkullTop, rSkullCap, false, skinColor);

  // Bridge
  bridgeRings(rSkullCap, rCranium);
  bridgeRings(rCranium, rForehead);
  bridgeRings(rForehead, rEyes);
  bridgeRings(rEyes, rNoseBridge);
  bridgeRings(rNoseBridge, rMouth);
  bridgeRings(rMouth, rChin);
  bridgeRings(rChin, rJaw);
  bridgeRings(rJaw, rNeckTop);
  bridgeRings(rNeckTop, rNeckMid);
  bridgeRings(rNeckMid, rTraps);
  bridgeRings(rTraps, rShoulders);
  bridgeRings(rShoulders, rChest);
  bridgeRings(rChest, rPecs);
  bridgeRings(rPecs, rRibs);
  bridgeRings(rRibs, rWaist);
  bridgeRings(rWaist, rAbdomen);
  bridgeRings(rAbdomen, rPelvisTop);
  bridgeRings(rPelvisTop, rPelvisMid);
  bridgeRings(rPelvisMid, rPelvis);
  bridgeRings(rPelvis, rCrotch);

  // =========================================================================
  // 2. ARMS WITH NATURAL ELBOW & SHOULDER KINEMATICS
  // =========================================================================
  const N_ARM = 12;

  // Left arm forward kinematics
  const thetaL = moveR * 0.45;
  const pPivotL = [-0.125, 0.27 + breatheRaise, 0.015];

  const getLArmPt = (lx, ly, lz, sagScale = 0.2) => {
    let px = lx;
    let py = ly;
    let pz = lz;

    // 1. Elbow flexion (for points below elbow ly <= -0.18)
    const elbowY = -0.18;
    if (ly < elbowY) {
      const dy = ly - elbowY;
      const dz = lz;
      const cosE = Math.cos(elbowBendL);
      const sinE = Math.sin(elbowBendL);
      py = elbowY + (dy * cosE + dz * sinE);
      pz = -dy * sinE + dz * cosE;
    }

    // 2. Shoulder swing (pitch rotation around X axis at shoulder)
    const cosS = Math.cos(thetaL);
    const sinS = Math.sin(thetaL);
    const rotY = py * cosS - pz * sinS;
    const rotZ = py * sinS + pz * cosS;

    const wx = pPivotL[0] + px;
    const wy = pPivotL[1] + rotY + walkBob;
    const wz = pPivotL[2] + rotZ;

    return mp(wx, wy, wz, sagScale);
  };

  const rLDeltoid = createMuscleRing([0, 0, 0], 0.044, 0.042, 0.044, N_ARM, getLArmPt, skinColor, 0.15, 0.012);
  const rLBicep   = createMuscleRing([0, -0.07, 0.002], 0.038, 0.036, 0.038, N_ARM, getLArmPt, skinColor, 0.18, 0.010);
  const rLTricep  = createMuscleRing([0, -0.12, 0.001], 0.033, 0.031, 0.033, N_ARM, getLArmPt, skinColor, 0.22, 0.008);
  const rLElbow   = createRing([0, -0.18, -0.004], 0.027, 0.025, 0.027, N_ARM, getLArmPt, jointColor, 0.25);
  const rLForearm = createMuscleRing([0, -0.24, 0.001], 0.024, 0.022, 0.024, N_ARM, getLArmPt, skinColor, 0.28, 0.006);
  const rLWrist   = createRing([0, -0.32, 0.002], 0.016, 0.018, 0.024, N_ARM, getLArmPt, jointColor, 0.32);

  // Seamlessly stitch Left Deltoid to Torso Shoulder Socket
  const torsoL_Top = rTraps[8];
  const torsoL_FrontUpper = rShoulders[7];
  const torsoL_BackUpper = rShoulders[9];
  const torsoL_MidLower = rChest[8];
  const torsoL_FrontLower = rChest[7];
  const torsoL_BackLower = rChest[9];

  addQuad(torsoL_Top, torsoL_FrontUpper, rLDeltoid[2], rLDeltoid[0]);
  addQuad(torsoL_FrontUpper, torsoL_FrontLower, rLDeltoid[4], rLDeltoid[2]);
  addQuad(torsoL_FrontLower, torsoL_MidLower, rLDeltoid[6], rLDeltoid[4]);
  addQuad(torsoL_MidLower, torsoL_BackLower, rLDeltoid[8], rLDeltoid[6]);
  addQuad(torsoL_BackLower, torsoL_BackUpper, rLDeltoid[10], rLDeltoid[8]);
  addQuad(torsoL_BackUpper, torsoL_Top, rLDeltoid[0], rLDeltoid[10]);

  bridgeRings(rLDeltoid, rLBicep);
  bridgeRings(rLBicep, rLTricep);
  bridgeRings(rLTricep, rLElbow);
  bridgeRings(rLElbow, rLForearm);
  bridgeRings(rLForearm, rLWrist);

  // Right arm forward kinematics
  const thetaR = moveL * 0.45;
  const pPivotR = [0.125, 0.27 + breatheRaise, 0.015];

  const getRArmPt = (lx, ly, lz, sagScale = 0.2) => {
    let px = lx;
    let py = ly;
    let pz = lz;

    const elbowY = -0.18;
    if (ly < elbowY) {
      const dy = ly - elbowY;
      const dz = lz;
      const cosE = Math.cos(elbowBendR);
      const sinE = Math.sin(elbowBendR);
      py = elbowY + (dy * cosE + dz * sinE);
      pz = -dy * sinE + dz * cosE;
    }

    const cosS = Math.cos(thetaR);
    const sinS = Math.sin(thetaR);
    const rotY = py * cosS - pz * sinS;
    const rotZ = py * sinS + pz * cosS;

    const wx = pPivotR[0] + px;
    const wy = pPivotR[1] + rotY + walkBob;
    const wz = pPivotR[2] + rotZ;

    return mp(wx, wy, wz, sagScale);
  };

  const rRDeltoid = createMuscleRing([0, 0, 0], 0.044, 0.042, 0.044, N_ARM, getRArmPt, skinColor, 0.15, 0.012);
  const rRBicep   = createMuscleRing([0, -0.07, 0.002], 0.038, 0.036, 0.038, N_ARM, getRArmPt, skinColor, 0.18, 0.010);
  const rRTricep  = createMuscleRing([0, -0.12, 0.001], 0.033, 0.031, 0.033, N_ARM, getRArmPt, skinColor, 0.22, 0.008);
  const rRElbow   = createRing([0, -0.18, -0.004], 0.027, 0.025, 0.027, N_ARM, getRArmPt, jointColor, 0.25);
  const rRForearm = createMuscleRing([0, -0.24, 0.001], 0.024, 0.022, 0.024, N_ARM, getRArmPt, skinColor, 0.28, 0.006);
  const rRWrist   = createRing([0, -0.32, 0.002], 0.016, 0.018, 0.024, N_ARM, getRArmPt, jointColor, 0.32);

  // Seamlessly stitch Right Deltoid to Torso Shoulder Socket
  const torsoR_Top = rTraps[0];
  const torsoR_FrontUpper = rShoulders[1];
  const torsoR_BackUpper = rShoulders[15];
  const torsoR_MidLower = rChest[0];
  const torsoR_FrontLower = rChest[1];
  const torsoR_BackLower = rChest[15];

  addQuad(torsoR_Top, torsoR_FrontUpper, rRDeltoid[2], rRDeltoid[0]);
  addQuad(torsoR_FrontUpper, torsoR_FrontLower, rRDeltoid[4], rRDeltoid[2]);
  addQuad(torsoR_FrontLower, torsoR_MidLower, rRDeltoid[6], rRDeltoid[4]);
  addQuad(torsoR_MidLower, torsoR_BackLower, rRDeltoid[8], rRDeltoid[6]);
  addQuad(torsoR_BackLower, torsoR_BackUpper, rRDeltoid[10], rRDeltoid[8]);
  addQuad(torsoR_BackUpper, torsoR_Top, rRDeltoid[0], rRDeltoid[10]);

  bridgeRings(rRDeltoid, rRBicep);
  bridgeRings(rRBicep, rRTricep);
  bridgeRings(rRTricep, rRElbow);
  bridgeRings(rRElbow, rRForearm);
  bridgeRings(rRForearm, rRWrist);

  // =========================================================================
  // 3. HANDS (Palms face inward towards body, larger realistic fingers)
  // =========================================================================
  function buildHandFingers(getArmPtFn, rWrist, isLeft) {
    // Left hand: inward is +X. Right hand: inward is -X.
    const inwardX = isLeft ? 1 : -1;

    const fingerDefs = [
      // 1. Thumb (sprouts forward +Z and inward +X)
      {
        bx: 0.008 * inwardX, by: -0.338, bz: 0.016,
        tx: 0.016 * inwardX, ty: -0.366, tz: 0.028,
        segments: [
          { y: 0, r: 0.0075 },
          { y: -0.010, r: 0.0068 },
          { y: -0.019, r: 0.0058 },
          { y: -0.027, r: 0.0050 }
        ]
      },
      // 2. Index finger (front of hand)
      {
        bx: 0.002 * inwardX, by: -0.340, bz: 0.016,
        tx: 0.003 * inwardX, ty: -0.388, tz: 0.020,
        segments: [
          { y: 0, r: 0.0065 },
          { y: -0.014, r: 0.0058 },
          { y: -0.026, r: 0.0050 },
          { y: -0.038, r: 0.0042 }
        ]
      },
      // 3. Middle finger (center)
      {
        bx: 0.000, by: -0.340, bz: 0.005,
        tx: 0.000, ty: -0.395, tz: 0.006,
        segments: [
          { y: 0, r: 0.0068 },
          { y: -0.015, r: 0.0060 },
          { y: -0.028, r: 0.0052 },
          { y: -0.042, r: 0.0044 }
        ]
      },
      // 4. Ring finger
      {
        bx: -0.001 * inwardX, by: -0.340, bz: -0.006,
        tx: -0.001 * inwardX, ty: -0.386, tz: -0.007,
        segments: [
          { y: 0, r: 0.0060 },
          { y: -0.013, r: 0.0054 },
          { y: -0.025, r: 0.0046 },
          { y: -0.037, r: 0.0039 }
        ]
      },
      // 5. Pinky finger (back of hand)
      {
        bx: -0.002 * inwardX, by: -0.340, bz: -0.016,
        tx: -0.002 * inwardX, ty: -0.375, tz: -0.018,
        segments: [
          { y: 0, r: 0.0054 },
          { y: -0.011, r: 0.0048 },
          { y: -0.021, r: 0.0040 },
          { y: -0.030, r: 0.0033 }
        ]
      }
    ];

    const N_FINGER = 8;
    const fingerBaseRings = [];

    for (let fIdx = 0; fIdx < fingerDefs.length; fIdx++) {
      const def = fingerDefs[fIdx];
      const segments = def.segments;
      const fingerRings = [];

      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        const yPos = def.by + seg.y;
        const radius = seg.r;
        const ring = [];

        for (let i = 0; i < N_FINGER; i++) {
          const a = (i / N_FINGER) * Math.PI * 2;
          const dx = Math.cos(a);
          const dz = Math.sin(a);

          const xOff = def.bx + (def.tx - def.bx) * (seg.y / (segments[segments.length - 1].y || 1));
          const zOff = def.bz + (def.tz - def.bz) * (seg.y / (segments[segments.length - 1].y || 1));

          const p = getArmPtFn(
            xOff + dx * radius,
            yPos,
            zOff + dz * radius,
            0.38
          );

          const color = (s === segments.length - 1) ? nailPink : skinColor;
          ring.push(addV(p, color));
        }

        fingerRings.push(ring);
      }

      for (let s = 0; s < fingerRings.length - 1; s++) {
        bridgeRings(fingerRings[s], fingerRings[s + 1]);
      }

      if (fingerRings.length > 0) {
        const tipRing = fingerRings[fingerRings.length - 1];
        const pTip = getArmPtFn(def.tx, def.ty - 0.003, def.tz, 0.38);
        capRing(pTip, tipRing, false, nailColor);
      }

      fingerBaseRings.push(fingerRings[0]);
    }

    // Inter-digital webs
    for (let f = 0; f < fingerBaseRings.length - 1; f++) {
      const rA = fingerBaseRings[f];
      const rB = fingerBaseRings[f + 1];
      if (isLeft) {
        // Left hand: rA (+X) is right of rB (-X)
        addQuad(rA[3], rA[4], rB[0], rB[1]);
        addQuad(rA[4], rA[5], rB[7], rB[0]);
      } else {
        // Right hand: rA (-X) is left of rB (+X)
        addQuad(rB[3], rB[4], rA[0], rA[1]);
        addQuad(rB[4], rB[5], rA[7], rA[0]);
      }
    }

    const palmConnection = [];
    if (isLeft) {
      palmConnection.push(
        fingerBaseRings[0][0], fingerBaseRings[0][1], fingerBaseRings[0][2], fingerBaseRings[0][3],
        fingerBaseRings[1][1], fingerBaseRings[1][2], fingerBaseRings[1][3],
        fingerBaseRings[2][1], fingerBaseRings[2][2], fingerBaseRings[2][3],
        fingerBaseRings[3][1], fingerBaseRings[3][2], fingerBaseRings[3][3],
        fingerBaseRings[4][1], fingerBaseRings[4][2], fingerBaseRings[4][3], fingerBaseRings[4][4], fingerBaseRings[4][5], fingerBaseRings[4][6], fingerBaseRings[4][7],
        fingerBaseRings[3][5], fingerBaseRings[3][6], fingerBaseRings[3][7],
        fingerBaseRings[2][5], fingerBaseRings[2][6], fingerBaseRings[2][7],
        fingerBaseRings[1][5], fingerBaseRings[1][6], fingerBaseRings[1][7],
        fingerBaseRings[0][5], fingerBaseRings[0][6], fingerBaseRings[0][7]
      );
    } else {
      palmConnection.push(
        fingerBaseRings[4][0], fingerBaseRings[4][1], fingerBaseRings[4][2], fingerBaseRings[4][3],
        fingerBaseRings[3][1], fingerBaseRings[3][2], fingerBaseRings[3][3],
        fingerBaseRings[2][1], fingerBaseRings[2][2], fingerBaseRings[2][3],
        fingerBaseRings[1][1], fingerBaseRings[1][2], fingerBaseRings[1][3],
        fingerBaseRings[0][1], fingerBaseRings[0][2], fingerBaseRings[0][3], fingerBaseRings[0][4], fingerBaseRings[0][5], fingerBaseRings[0][6], fingerBaseRings[0][7],
        fingerBaseRings[1][5], fingerBaseRings[1][6], fingerBaseRings[1][7],
        fingerBaseRings[2][5], fingerBaseRings[2][6], fingerBaseRings[2][7],
        fingerBaseRings[3][5], fingerBaseRings[3][6], fingerBaseRings[3][7],
        fingerBaseRings[4][5], fingerBaseRings[4][6], fingerBaseRings[4][7]
      );
    }

    // Dynamically align rings based on 3D proximity to prevent twisting
    let bestShift = 0;
    let minDist = Infinity;
    const b0X = outVertices[palmConnection[0] * 3];
    const b0Y = outVertices[palmConnection[0] * 3 + 1];
    const b0Z = outVertices[palmConnection[0] * 3 + 2];
    
    for (let i = 0; i < rWrist.length; i++) {
      const aX = outVertices[rWrist[i] * 3];
      const aY = outVertices[rWrist[i] * 3 + 1];
      const aZ = outVertices[rWrist[i] * 3 + 2];
      const dist = (aX - b0X)**2 + (aY - b0Y)**2 + (aZ - b0Z)**2;
      if (dist < minDist) {
        minDist = dist;
        bestShift = i;
      }
    }
    
    const rWristAligned = rWrist.slice(bestShift).concat(rWrist.slice(0, bestShift));
    bridgeEdges(rWristAligned, palmConnection, false);
  }

  buildHandFingers(getLArmPt, rLWrist, true);
  buildHandFingers(getRArmPt, rRWrist, false);

  // =========================================================================
  // 4. LEGS WITH KNEE & ANKLE ARTICULATION
  // =========================================================================
  const N_LEG = 12;

  // Left leg forward kinematics
  const legThetaL = moveL * 0.50;
  const pPivotLegL = [-0.048, -0.15, 0.0];

  const getLLegPt = (lx, ly, lz, sagScale = 0.1) => {
    let px = lx;
    let py = ly;
    let pz = lz;

    // 1. Ankle pitch flexion (for foot/toes below ankle ly <= -0.540)
    const ankleY = -0.540;
    if (ly < ankleY) {
      const dy = py - ankleY;
      const dz = pz;
      const anklePitch = (moveL * 0.18) * walkBlend;
      const cosA = Math.cos(anklePitch);
      const sinA = Math.sin(anklePitch);
      py = ankleY + (dy * cosA - dz * sinA);
      pz = dy * sinA + dz * cosA;
    }

    // 2. Knee flexion (knee bends BACKWARD -Z, +Y)
    const kneeY = -0.280;
    if (ly < kneeY) {
      const dy = py - kneeY;
      const dz = pz;
      const cosK = Math.cos(kneeBendL);
      const sinK = Math.sin(kneeBendL);
      py = kneeY + (dy * cosK - dz * sinK);
      pz = dy * sinK + dz * cosK;
    }

    // 3. Hip swing (pitch rotation around X axis at hip)
    const cosH = Math.cos(legThetaL);
    const sinH = Math.sin(legThetaL);
    const rotY = py * cosH - pz * sinH;
    const rotZ = py * sinH + pz * cosH;

    const wx = pPivotLegL[0] + px;
    const wy = pPivotLegL[1] + rotY + walkBob;
    const wz = pPivotLegL[2] + rotZ;

    return mp(wx, wy, wz, sagScale);
  };

  const rLThigh    = createMuscleRing([0, -0.04, 0.003], 0.046, 0.043, 0.046, N_LEG, getLLegPt, skinColor, 0.08, 0.018);
  const rLThighLow = createMuscleRing([0, -0.15, 0.002], 0.039, 0.037, 0.039, N_LEG, getLLegPt, skinColor, 0.12, 0.012);
  const rLKnee     = createRing([0, -0.28, 0.000], 0.031, 0.029, 0.031, N_LEG, getLLegPt, jointColor, 0.15);
  const rLCalfTop  = createMuscleRing([0, -0.37, -0.004], 0.029, 0.027, 0.029, N_LEG, getLLegPt, skinColor, 0.18, 0.010);
  const rLCalf     = createMuscleRing([0, -0.45, -0.006], 0.026, 0.024, 0.026, N_LEG, getLLegPt, skinColor, 0.20, 0.008);
  const rLShin     = createRing([0, -0.51, 0.000], 0.023, 0.021, 0.023, N_LEG, getLLegPt, skinColor, 0.22);
  const rLAnkle    = createRing([0, -0.54, -0.002], 0.021, 0.020, 0.021, N_LEG, getLLegPt, jointColor, 0.24);
  const rLHeel     = createRing([0, -0.555, 0.004], 0.022, 0.022, 0.026, N_LEG, getLLegPt, skinColor, 0.25);
  const rLInstep   = createRing([0, -0.565, 0.010], 0.023, 0.023, 0.030, N_LEG, getLLegPt, skinColor, 0.26);
  const rLFootBall = createRing([0, -0.575, 0.012], 0.024, 0.024, 0.032, N_LEG, getLLegPt, skinColor, 0.28);

  // Bridge left and right hips to thigh bases seamlessly (Merge vertices via direct shared hip socket indices)
  const hipSocketL = [
    rCrotch[4], rCrotch[5], rCrotch[6], rCrotch[7],
    rCrotch[8], rCrotch[9], rCrotch[10], rCrotch[11], rCrotch[12]
  ];
  const hipSocketR = [
    rCrotch[0], rCrotch[1], rCrotch[2], rCrotch[3],
    rCrotch[4], rCrotch[12], rCrotch[13], rCrotch[14], rCrotch[15]
  ];

  bridgeEdges(hipSocketL, rLThigh);
  bridgeRings(rLThigh, rLThighLow);
  bridgeRings(rLThighLow, rLKnee);
  bridgeRings(rLKnee, rLCalfTop);
  bridgeRings(rLCalfTop, rLCalf);
  bridgeRings(rLCalf, rLShin);
  bridgeRings(rLShin, rLAnkle);
  bridgeRings(rLAnkle, rLHeel);
  bridgeRings(rLHeel, rLInstep);
  bridgeRings(rLInstep, rLFootBall);

  // Right leg forward kinematics
  const legThetaR = moveR * 0.50;
  const pPivotLegR = [0.048, -0.15, 0.0];

  const getRLegPt = (lx, ly, lz, sagScale = 0.1) => {
    let px = lx;
    let py = ly;
    let pz = lz;

    const ankleY = -0.540;
    if (ly < ankleY) {
      const dy = py - ankleY;
      const dz = pz;
      const anklePitch = (moveR * 0.18) * walkBlend;
      const cosA = Math.cos(anklePitch);
      const sinA = Math.sin(anklePitch);
      py = ankleY + (dy * cosA - dz * sinA);
      pz = dy * sinA + dz * cosA;
    }

    const kneeY = -0.280;
    if (ly < kneeY) {
      const dy = py - kneeY;
      const dz = pz;
      const cosK = Math.cos(kneeBendR);
      const sinK = Math.sin(kneeBendR);
      py = kneeY + (dy * cosK - dz * sinK);
      pz = dy * sinK + dz * cosK;
    }

    const cosH = Math.cos(legThetaR);
    const sinH = Math.sin(legThetaR);
    const rotY = py * cosH - pz * sinH;
    const rotZ = py * sinH + pz * cosH;

    const wx = pPivotLegR[0] + px;
    const wy = pPivotLegR[1] + rotY + walkBob;
    const wz = pPivotLegR[2] + rotZ;

    return mp(wx, wy, wz, sagScale);
  };

  const rRThigh    = createMuscleRing([0, -0.04, 0.003], 0.046, 0.043, 0.046, N_LEG, getRLegPt, skinColor, 0.08, 0.018);
  const rRThighLow = createMuscleRing([0, -0.15, 0.002], 0.039, 0.037, 0.039, N_LEG, getRLegPt, skinColor, 0.12, 0.012);
  const rRKnee     = createRing([0, -0.28, 0.000], 0.031, 0.029, 0.031, N_LEG, getRLegPt, jointColor, 0.15);
  const rRCalfTop  = createMuscleRing([0, -0.37, -0.004], 0.029, 0.027, 0.029, N_LEG, getRLegPt, skinColor, 0.18, 0.010);
  const rRCalf     = createMuscleRing([0, -0.45, -0.006], 0.026, 0.024, 0.026, N_LEG, getRLegPt, skinColor, 0.20, 0.008);
  const rRShin     = createRing([0, -0.51, 0.000], 0.023, 0.021, 0.023, N_LEG, getRLegPt, skinColor, 0.22);
  const rRAnkle    = createRing([0, -0.54, -0.002], 0.021, 0.020, 0.021, N_LEG, getRLegPt, jointColor, 0.24);
  const rRHeel     = createRing([0, -0.555, 0.004], 0.022, 0.022, 0.026, N_LEG, getRLegPt, skinColor, 0.25);
  const rRInstep   = createRing([0, -0.565, 0.010], 0.023, 0.023, 0.030, N_LEG, getRLegPt, skinColor, 0.26);
  const rRFootBall = createRing([0, -0.575, 0.012], 0.024, 0.024, 0.032, N_LEG, getRLegPt, skinColor, 0.28);

  bridgeEdges(hipSocketR, rRThigh);
  bridgeRings(rRThigh, rRThighLow);
  bridgeRings(rRThighLow, rRKnee);
  bridgeRings(rRKnee, rRCalfTop);
  bridgeRings(rRCalfTop, rRCalf);
  bridgeRings(rRCalf, rRShin);
  bridgeRings(rRShin, rRAnkle);
  bridgeRings(rRAnkle, rRHeel);
  bridgeRings(rRHeel, rRInstep);
  bridgeRings(rRInstep, rRFootBall);

  // =========================================================================
  // 5. FEET & 5 ANATOMICAL TOES
  // =========================================================================
  function buildFootToes(getLegPtFn, rFootBall, isLeft) {
    const toeXDir = isLeft ? -1 : 1;

    // 5 Toes matching reference photo: Big toe (medial) to Pinky toe (lateral)
    const toeDefs = [
      // 1. Big Toe (Medial/Inner side - largest & thickest)
      {
        bx: -0.014 * toeXDir, by: -0.573, bz: 0.044,
        tx: -0.015 * toeXDir, ty: -0.573, tz: 0.074,
        r1: 0.0065, r2: 0.0052
      },
      // 2. Index Toe
      {
        bx: -0.007 * toeXDir, by: -0.573, bz: 0.044,
        tx: -0.007 * toeXDir, ty: -0.573, tz: 0.072,
        r1: 0.0058, r2: 0.0045
      },
      // 3. Middle Toe
      {
        bx: 0.000 * toeXDir, by: -0.573, bz: 0.044,
        tx: 0.000 * toeXDir, ty: -0.573, tz: 0.069,
        r1: 0.0052, r2: 0.0040
      },
      // 4. Ring Toe
      {
        bx: 0.007 * toeXDir, by: -0.573, bz: 0.044,
        tx: 0.007 * toeXDir, ty: -0.573, tz: 0.065,
        r1: 0.0046, r2: 0.0035
      },
      // 5. Pinky Toe (Lateral/Outer side)
      {
        bx: 0.014 * toeXDir, by: -0.573, bz: 0.044,
        tx: 0.014 * toeXDir, ty: -0.573, tz: 0.060,
        r1: 0.0040, r2: 0.0030
      }
    ];

    const N_TOE = 8;
    const toeBaseRings = [];

    for (let tIdx = 0; tIdx < toeDefs.length; tIdx++) {
      const def = toeDefs[tIdx];
      const rBase = [];
      const rMid  = [];
      const rTip  = [];

      const midX = (def.bx + def.tx) * 0.5;
      const midY = (def.by + def.ty) * 0.5;
      const midZ = (def.bz + def.tz) * 0.5;
      const rMidRadius = (def.r1 + def.r2) * 0.5;

      for (let i = 0; i < N_TOE; i++) {
        const a = (i / N_TOE) * Math.PI * 2;
        const dx = Math.cos(a);
        const dy = Math.sin(a);

        // Toe cross-section in XY plane extending along +Z
        const p1 = getLegPtFn(def.bx + dx * def.r1, def.by + dy * def.r1 * 1.15, def.bz, 0.25);
        const p2 = getLegPtFn(midX + dx * rMidRadius, midY + dy * rMidRadius * 1.15, midZ, 0.25);
        const p3 = getLegPtFn(def.tx + dx * def.r2, def.ty + dy * def.r2 * 1.15, def.tz, 0.25);

        const color1 = skinColor;
        const color2 = skinColor;
        // Nail highlight on top side (i = 1, 2, 3) of toe tip
        const color3 = (i >= 1 && i <= 3) ? nailColor : skinColor;

        rBase.push(addV(p1, color1));
        rMid.push(addV(p2, color2));
        rTip.push(addV(p3, color3));
      }

      bridgeRings(rBase, rMid);
      bridgeRings(rMid, rTip);

      const pCap = getLegPtFn(def.tx, def.ty, def.tz + 0.002, 0.25);
      capRing(pCap, rTip, false, nailColor);

      toeBaseRings.push(rBase);
    }

    // Inter-toe web bridges between adjacent toe base rings
    for (let t = 0; t < toeBaseRings.length - 1; t++) {
      const rA = toeBaseRings[t];
      const rB = toeBaseRings[t + 1];
      if (isLeft) {
        addQuad(rA[2], rA[3], rB[1], rB[2]);
        addQuad(rA[3], rA[4], rB[0], rB[1]);
        addQuad(rA[4], rA[5], rB[7], rB[0]);
        addQuad(rA[5], rA[6], rB[6], rB[7]);
      } else {
        addQuad(rA[2], rA[1], rB[3], rB[2]);
        addQuad(rA[1], rA[0], rB[4], rB[3]);
        addQuad(rA[0], rA[7], rB[5], rB[4]);
        addQuad(rA[7], rA[6], rB[6], rB[5]);
      }
    }

    // Outer perimeter loop connecting all 5 toe bases
    const t0 = toeBaseRings[0];
    const t1 = toeBaseRings[1];
    const t2 = toeBaseRings[2];
    const t3 = toeBaseRings[3];
    const t4 = toeBaseRings[4];

    let footEdgeLoop = [];
    if (isLeft) {
      footEdgeLoop = [
        t0[7], t0[0], t0[1], t0[2],
        t1[2], t2[2], t3[2], t4[2],
        t4[3], t4[4], t4[5], t4[6],
        t3[6], t2[6], t1[6], t0[6]
      ];
    } else {
      footEdgeLoop = [
        t0[5], t0[4], t0[3], t0[2],
        t1[2], t2[2], t3[2], t4[2],
        t4[1], t4[0], t4[7], t4[6],
        t3[6], t2[6], t1[6], t0[6]
      ];
    }

    // Dynamically align based on 3D proximity to prevent twisting
    let bestShift = 0;
    let minDist = Infinity;
    const b0X = outVertices[footEdgeLoop[0] * 3];
    const b0Y = outVertices[footEdgeLoop[0] * 3 + 1];
    const b0Z = outVertices[footEdgeLoop[0] * 3 + 2];
    
    for (let i = 0; i < rFootBall.length; i++) {
      const aX = outVertices[rFootBall[i] * 3];
      const aY = outVertices[rFootBall[i] * 3 + 1];
      const aZ = outVertices[rFootBall[i] * 3 + 2];
      const dist = (aX - b0X)**2 + (aY - b0Y)**2 + (aZ - b0Z)**2;
      if (dist < minDist) {
        minDist = dist;
        bestShift = i;
      }
    }
    
    const rFootBallAligned = rFootBall.slice(bestShift).concat(rFootBall.slice(0, bestShift));
    bridgeEdges(rFootBallAligned, footEdgeLoop, false);
  }

  buildFootToes(getLLegPt, rLFootBall, true);
  buildFootToes(getRLegPt, rRFootBall, false);

  // =========================================================================
  // 6. COLLIDERS
  // =========================================================================
  if (f !== null && c !== null) {
    const pChest = mp(0, 0.25, 0.020, 0.15);
    const pKneeL = getLLegPt(0, -0.22, 0);
    const pKneeR = getRLegPt(0, -0.22, 0);
    const pHead = mp(0, 0.45, 0.015, 0.30);
    const pShoulderL = getLArmPt(0, 0, 0, 0.15);
    const pShoulderR = getRArmPt(0, 0, 0, 0.15);
    const pElbowL = getLArmPt(0, -0.18, 0, 0.25);
    const pElbowR = getRArmPt(0, -0.18, 0, 0.25);
    
    c.colliders = [
      { offset: [pChest[0] - pos[0], pChest[1] - pos[1], pChest[2] - pos[2]], radius: 0.15 * scale * 1.5 },
      { offset: [pKneeL[0] - pos[0], pKneeL[1] - pos[1], pKneeL[2] - pos[2]], radius: 0.06 * scale * 1.5 },
      { offset: [pKneeR[0] - pos[0], pKneeR[1] - pos[1], pKneeR[2] - pos[2]], radius: 0.06 * scale * 1.5 },
      { offset: [pHead[0] - pos[0], pHead[1] - pos[1], pHead[2] - pos[2]], radius: 0.08 * scale * 1.5 },
      { offset: [pShoulderL[0] - pos[0], pShoulderL[1] - pos[1], pShoulderL[2] - pos[2]], radius: 0.05 * scale * 1.5 },
      { offset: [pShoulderR[0] - pos[0], pShoulderR[1] - pos[1], pShoulderR[2] - pos[2]], radius: 0.05 * scale * 1.5 },
      { offset: [pElbowL[0] - pos[0], pElbowL[1] - pos[1], pElbowL[2] - pos[2]], radius: 0.04 * scale * 1.5 },
      { offset: [pElbowR[0] - pos[0], pElbowR[1] - pos[1], pElbowR[2] - pos[2]], radius: 0.04 * scale * 1.5 },
    ];
  }
};

window.NpcRegistry = window.NpcRegistry || {};
window.NpcRegistry["human"] = {
  disabled: true,
  canSpawn: false,
  maxHp: 10,
  animSpeed: 2.5,
  moveSpeed: 0.05,
  updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
    c.isSwimming = false;
    let h = typeof getHeightOnSphere === "function" ? getHeightOnSphere(c.theta, c.phi, seed) : 0;
    let actualGround = (typeof RADIUS !== "undefined" ? RADIUS : 8.0) + h * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 0.6);
    let targetR = Math.max(actualGround, wRadius) + 0.2325;

    if (c.idleTimer === undefined) c.idleTimer = Math.random() * 5.0;
    if (c.walkTimer === undefined) c.walkTimer = 0;
    if (c.walkBlend === undefined) c.walkBlend = 0.0;
    if (c.idleAnimPhase === undefined) c.idleAnimPhase = Math.random() * Math.PI * 2;

    c.idleAnimPhase += deltaTime * 0.8;

    if (c.isIdle) {
      c.idleTimer -= deltaTime;
      c.walkBlend = Math.max(0, c.walkBlend - deltaTime * 4.0);
      if (c.idleTimer <= 0) {
        c.isIdle = false;
        c.walkTimer = 3.0 + Math.random() * 5.0;
        c.heading += (Math.random() - 0.5) * Math.PI;
      }
    } else {
      c.walkTimer -= deltaTime;
      c.walkBlend = Math.min(1, c.walkBlend + deltaTime * 4.0);
      if (c.walkTimer <= 0) {
        c.isIdle = true;
        c.idleTimer = 2.0 + Math.random() * 4.0;
      }
    }

    if (npcCaveData && npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
      targetR = Math.min(targetR, npcCaveData.ceiling - 0.35);
    }

    if (c.r < targetR) {
      c.r = Math.min(targetR, c.r + 2.0 * deltaTime);
    } else if (c.r > targetR) {
      c.r = Math.max(targetR, c.r - 2.0 * deltaTime);
    }
  },
  render: function(c, allVertices, allColors, allIndices, scale, N, R, F, pos, f, transformPoint, seed) {
    window.buildHumanModel(
      c.seed !== undefined ? c.seed : seed,
      c.animPhase,
      c.ragdollEnabled,
      c.isSwimming,
      scale,
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