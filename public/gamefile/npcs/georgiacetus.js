// === SEEDPLANET MODULE: JS/NPCS/GEORGIACETUS.JS ===

window.buildGeorgiacetusModel = function(
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

  const scale = 0.5 * scaleMultiplier;
  const darkGrey = [0.25, 0.28, 0.32];
  const lightGrey = [0.65, 0.68, 0.72];
  const bellyColor = [0.75, 0.78, 0.82];

  const sagVec = f || (isRagdoll ? F : [0, 0, 0]);

  const p = (x, y, z, wiggleZ = z, sagScale = 0) => {
    let lx = x + getWigX(wiggleZ);
    let ly = y + getWigY(wiggleZ);
    let lz = z;
    if (isRagdoll) {
      lx += sagVec[0] * sagScale;
      ly += sagVec[1] * sagScale;
      lz += sagVec[2] * sagScale;
    }
    return transformPoint(lx * scale, ly * scale, lz * scale);
  };

  const pSnoutBase = p(0, 0.0, 0.4, 0.4, 0.15);
  const pHead = p(0, 0.0, 0.3, 0.3, 0.1);
  const pNeck = p(0, 0.0, 0.15, 0.15, 0.05);
  const pBodyFront = p(0, 0.0, 0.0, 0.0, 0.0);
  const pBodyMid = p(0, 0.0, -0.2, -0.2, 0.0);
  const pBodyBack = p(0, 0.0, -0.4, -0.4, 0.05);
  const pTail1 = p(0, 0.0, -0.6, -0.6, 0.12);
  const pTail2 = p(0, 0.0, -0.8, -0.8, 0.25);
  const pTailTip = p(0, 0.0, -0.9, -0.9, 0.4);

  // Jaws & Head
  const pUpperJawTip = p(0, 0.01, 0.55, 0.4, 0.2);
  const pLowerJawTip = p(
    0,
    isSwimming ? -0.01 : -0.03,
    0.53,
    0.4,
    0.2,
  );

  // Add joints to hide gaps
  const spinePoints = [
    pUpperJawTip,
    pSnoutBase,
    pHead,
    pNeck,
    pBodyFront,
    pBodyMid,
    pBodyBack,
    pTail1,
    pTail2,
    pTailTip,
  ];
  const spineRadii = [
    0.01, 0.03, 0.05, 0.08, 0.12, 0.14, 0.11, 0.07, 0.04, 0.02,
  ].map((r) => r * scale);
  buildContinuousSpine(
    spinePoints,
    spineRadii,
    8,
    darkGrey,
    vertices,
    colors,
    indices,
    N
  );

  // Cap the ends
  buildLowPolySphere(pTailTip, 0.02 * scale, 2, darkGrey, 0, 0, vertices, colors, indices);
  buildLowPolySphere(pUpperJawTip, 0.01 * scale, 2, darkGrey, 0, 0, vertices, colors, indices);

  buildContinuousSpine(
    [pSnoutBase, pLowerJawTip],
    [0.02 * scale, 0.005 * scale],
    4,
    bellyColor,
    vertices,
    colors,
    indices,
    N
  );
  
  buildLowPolySphere(pLowerJawTip, 0.005 * scale, 1, bellyColor, 0, 0, vertices, colors, indices);

  // Teeth (simple cones along the jaw)
  const whiteColor = [0.9, 0.9, 0.9];
  const pTooth1L = p(0.01, -0.005, 0.45, 0.4, 0.2);
  const pTooth1TipL = p(0.01, -0.03, 0.45, 0.4, 0.2);
  const pTooth1R = p(-0.01, -0.005, 0.45, 0.4, 0.2);
  const pTooth1TipR = p(-0.01, -0.03, 0.45, 0.4, 0.2);
  buildTaperedSegment(
    pTooth1L,
    pTooth1TipL,
    0.005 * scale,
    0.001 * scale,
    3,
    whiteColor,
    vertices,
    colors,
    indices,
  );
  buildTaperedSegment(
    pTooth1R,
    pTooth1TipR,
    0.005 * scale,
    0.001 * scale,
    3,
    whiteColor,
    vertices,
    colors,
    indices,
  );

  // Eyes
  const blackColor = [0.1, 0.1, 0.1];
  const pEyeL = p(0.04, 0.02, 0.35, 0.35, 0.1);
  const pEyeR = p(-0.04, 0.02, 0.35, 0.35, 0.1);
  buildLowPolySphere(
    pEyeL,
    0.01 * scale,
    3,
    blackColor,
    0,
    0,
    vertices,
    colors,
    indices,
  );
  buildLowPolySphere(
    pEyeR,
    0.01 * scale,
    3,
    blackColor,
    0,
    0,
    vertices,
    colors,
    indices,
  );

  const pFlukeL = p(0.15, 0, -0.95, -0.95, 0.45);
  const pFlukeR = p(-0.15, 0, -0.95, -0.95, 0.45);
  buildContinuousSpine(
    [pTailTip, pFlukeL],
    [0.02 * scale, 0.005 * scale],
    4,
    darkGrey,
    vertices,
    colors,
    indices,
    N
  );
  buildContinuousSpine(
    [pTailTip, pFlukeR],
    [0.02 * scale, 0.005 * scale],
    4,
    darkGrey,
    vertices,
    colors,
    indices,
    N
  );

  const walkPhase = Math.sin(animPhase * 2.0) * 0.5;
  const swimTuck = isSwimming && !isRagdoll ? 1 : 0;
  const fWigL = isRagdoll ? 0 : isSwimming ? 0 : walkPhase;
  const fWigR = isRagdoll ? 0 : isSwimming ? 0 : -walkPhase;

  // Front Left Leg
  const pFrontBaseL = p(0.04, 0, 0.05, 0.05, 0.02);
  const pFrontHipL = p(0.08, -0.02, 0.05 + fWigL * 0.02, 0.05, 0.05);
  const pFrontKneeL = p(0.12, -0.05, 0.05 + fWigL * 0.08, 0.05, 0.1);
  const pFrontAnkleL = p(
    0.13 + swimTuck * 0.04,
    -0.1 + swimTuck * 0.06,
    0.02 + fWigL * 0.12 - swimTuck * 0.1,
    0.05,
    0.16,
  );
  const pFrontPawL = p(
    0.13 + swimTuck * 0.05,
    -0.15 + swimTuck * 0.13,
    0.0 + fWigL * 0.15 - swimTuck * 0.2,
    0.05,
    0.22,
  );
  buildContinuousSpine(
    [pFrontBaseL, pFrontHipL, pFrontKneeL, pFrontAnkleL, pFrontPawL],
    [
      0.06 * scale,
      0.05 * scale,
      0.04 * scale,
      0.025 * scale,
      0.015 * scale,
    ],
    5,
    lightGrey,
    vertices,
    colors,
    indices,
    N
  );

  // Front Right Leg
  const pFrontBaseR = p(-0.04, 0, 0.05, 0.05, 0.02);
  const pFrontHipR = p(-0.08, -0.02, 0.05 + fWigR * 0.02, 0.05, 0.05);
  const pFrontKneeR = p(-0.12, -0.05, 0.05 + fWigR * 0.08, 0.05, 0.1);
  const pFrontAnkleR = p(
    -0.13 - swimTuck * 0.04,
    -0.1 + swimTuck * 0.06,
    0.02 + fWigR * 0.12 - swimTuck * 0.1,
    0.05,
    0.16,
  );
  const pFrontPawR = p(
    -0.13 - swimTuck * 0.05,
    -0.15 + swimTuck * 0.13,
    0.0 + fWigR * 0.15 - swimTuck * 0.2,
    0.05,
    0.22,
  );
  buildContinuousSpine(
    [pFrontBaseR, pFrontHipR, pFrontKneeR, pFrontAnkleR, pFrontPawR],
    [
      0.06 * scale,
      0.05 * scale,
      0.04 * scale,
      0.025 * scale,
      0.015 * scale,
    ],
    5,
    lightGrey,
    vertices,
    colors,
    indices,
    N
  );

  const bWigL = isRagdoll ? 0 : isSwimming ? 0 : -walkPhase;
  const bWigR = isRagdoll ? 0 : isSwimming ? 0 : walkPhase;

  // Back Left Leg
  const pBackBaseL = p(0.04, 0, -0.35, -0.35, 0.04);
  const pBackHipL = p(0.07, -0.02, -0.35 + bWigL * 0.02, -0.35, 0.08);
  const pBackKneeL = p(0.1, -0.05, -0.35 + bWigL * 0.08, -0.35, 0.13);
  const pBackAnkleL = p(
    0.11 + swimTuck * 0.04,
    -0.1 + swimTuck * 0.06,
    -0.38 + bWigL * 0.12 - swimTuck * 0.1,
    -0.35,
    0.19,
  );
  const pBackPawL = p(
    0.11 + swimTuck * 0.05,
    -0.15 + swimTuck * 0.13,
    -0.4 + bWigL * 0.15 - swimTuck * 0.2,
    -0.35,
    0.25,
  );
  buildContinuousSpine(
    [pBackBaseL, pBackHipL, pBackKneeL, pBackAnkleL, pBackPawL],
    [
      0.05 * scale,
      0.045 * scale,
      0.035 * scale,
      0.025 * scale,
      0.015 * scale,
    ],
    5,
    lightGrey,
    vertices,
    colors,
    indices,
    N
  );

  // Back Right Leg
  const pBackBaseR = p(-0.04, 0, -0.35, -0.35, 0.04);
  const pBackHipR = p(-0.07, -0.02, -0.35 + bWigR * 0.02, -0.35, 0.08);
  const pBackKneeR = p(-0.1, -0.05, -0.35 + bWigR * 0.08, -0.35, 0.13);
  const pBackAnkleR = p(
    -0.11 - swimTuck * 0.04,
    -0.1 + swimTuck * 0.06,
    -0.38 + bWigR * 0.12 - swimTuck * 0.1,
    -0.35,
    0.19,
  );
  const pBackPawR = p(
    -0.11 - swimTuck * 0.05,
    -0.15 + swimTuck * 0.13,
    -0.4 + bWigR * 0.15 - swimTuck * 0.2,
    -0.35,
    0.25,
  );
  buildContinuousSpine(
    [pBackBaseR, pBackHipR, pBackKneeR, pBackAnkleR, pBackPawR],
    [
      0.05 * scale,
      0.045 * scale,
      0.035 * scale,
      0.025 * scale,
      0.015 * scale,
    ],
    5,
    lightGrey,
    vertices,
    colors,
    indices,
    N
  );

  // Set colliders and save values for active NPC inside game
  if (f !== null && c !== null) {
    c.colliders = spinePoints.map((pt, i) => {
      return {
        offset: [
          pt[0] - pos[0],
          pt[1] - pos[1],
          pt[2] - pos[2],
        ],
        radius: spineRadii[i] * 1.5,
      };
    });

    c.colliders.push(
      {
        offset: [
          pFrontHipL[0] - pos[0],
          pFrontHipL[1] - pos[1],
          pFrontHipL[2] - pos[2],
        ],
        radius: 0.05 * scale * 1.5,
      },
      {
        offset: [
          pFrontHipR[0] - pos[0],
          pFrontHipR[1] - pos[1],
          pFrontHipR[2] - pos[2],
        ],
        radius: 0.05 * scale * 1.5,
      },
      {
        offset: [
          pBackHipL[0] - pos[0],
          pBackHipL[1] - pos[1],
          pBackHipL[2] - pos[2],
        ],
        radius: 0.045 * scale * 1.5,
      },
      {
        offset: [
          pBackHipR[0] - pos[0],
          pBackHipR[1] - pos[1],
          pBackHipR[2] - pos[2],
        ],
        radius: 0.045 * scale * 1.5,
      },
    );
  }
};

window.NpcRegistry = window.NpcRegistry || {};
window.NpcRegistry["georgiacetus"] = {
  maxHp: 10,
  updateBehavior: function(c, deltaTime, seed, gRadius, wRadius, npcCaveData) {
    let pTheta, pPhi, pBoat, pMech, pR;
    let distToPlayer = 999;
    let dx = 0, dy = 0, dz = 0;
    try { 
        pTheta = charTheta;
        pPhi = charPhi;
        pBoat = activeRidingBoat;
        pMech = activeRidingMech;
        pR = (typeof RADIUS !== "undefined" ? RADIUS : 200) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(pTheta, pPhi, seed) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 10) : 0);
        
        const px = pR * Math.sin(pTheta) * Math.cos(pPhi);
        const py = pR * Math.cos(pTheta);
        const pz = pR * Math.sin(pTheta) * Math.sin(pPhi);
        
        const cx = c.r * Math.sin(c.theta) * Math.cos(c.phi);
        const cy = c.r * Math.cos(c.theta);
        const cz = c.r * Math.sin(c.theta) * Math.sin(c.phi);
        
        dx = px - cx;
        dy = py - cy;
        dz = pz - cz;
        distToPlayer = Math.sqrt(dx*dx + dy*dy + dz*dz);
    } catch(e) {}

    const isDriving = pBoat || pMech;
    const ignorePlayer = (typeof window !== "undefined" && window.npcIgnorePlayer);

    if (gRadius > wRadius - 0.02) {
      // On land
      c.isSwimming = false;
      if (c.r < gRadius + 0.05) {
        c.r = gRadius + 0.05;
        c.heading += Math.PI * deltaTime * 1.5; // Avoid land a bit or wander
      } else if (c.r > gRadius + 0.06) {
        c.r -= 0.5 * deltaTime;
      }
      // Keep NPC under the cave ceiling if they are inside a cave
      if (npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
        const maxAllowedR = npcCaveData.ceiling - 0.05;
        if (c.r > maxAllowedR) {
          c.r = maxAllowedR;
        }
      }
      c.animPhase -= deltaTime * 2.0; // Slower animation on land
      c.diveDepth = 0.0;
      c.targetDiveDepth = 0.0;
    } else {
      // Swimming
      c.isSwimming = true;
      
      if (distToPlayer < 15.0 && !isDriving && !ignorePlayer) { // Chase player!
        const dot_E = dx * (-Math.sin(c.phi)) + dz * Math.cos(c.phi);
        const dot_N = dx * (-Math.cos(c.theta) * Math.cos(c.phi)) + dy * Math.sin(c.theta) + dz * (-Math.cos(c.theta) * Math.sin(c.phi));
        const targetHeading = Math.atan2(dot_E, dot_N);
        
        let diff = targetHeading - c.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.heading += Math.sign(diff) * Math.min(Math.abs(diff), 3.0 * deltaTime);
        
        const dashSpeed = 1.5 * deltaTime;
        const move_theta = dashSpeed * Math.cos(c.heading) / c.r;
        let move_phi = 0;
        if (Math.sin(c.theta) > 0.01) {
             move_phi = dashSpeed * Math.sin(c.heading) / (c.r * Math.sin(c.theta));
        }
        c.theta += move_theta;
        c.phi += move_phi;
        
        c.animPhase += deltaTime * 20.0; // Fast animation when chasing
        
        if (distToPlayer < 0.8 && !isDriving && !ignorePlayer) {
            try {
                if (typeof damagePlayer === 'function' && typeof playerDamageCooldown !== 'undefined' && playerDamageCooldown <= 0 && typeof playerControlsLocked !== 'undefined' && !playerControlsLocked && typeof playerHP !== 'undefined' && playerHP > 0) {
                    damagePlayer(5);
                }
            } catch(e) {}
        }
      } else {
        // Peaceful wander / patrol swim
        const patrolSpeed = 0.6 * deltaTime;
        const move_theta = patrolSpeed * Math.cos(c.heading) / c.r;
        let move_phi = 0;
        if (Math.sin(c.theta) > 0.01) {
          move_phi = patrolSpeed * Math.sin(c.heading) / (c.r * Math.sin(c.theta));
        }
        c.theta += move_theta;
        c.phi += move_phi;

        if (Math.random() < 0.02) {
          c.heading += (Math.random() - 0.5) * 0.8;
        }

        c.animPhase += deltaTime * 5.0;
      }

      // Initialize diving state if not exists
      if (c.diveDepth === undefined) c.diveDepth = 0.0;
      if (c.targetDiveDepth === undefined) c.targetDiveDepth = 0.0;
      if (c.diveTimer === undefined) c.diveTimer = Math.random() * 5.0;

      c.diveTimer -= deltaTime;
      if (c.diveTimer <= 0) {
        // Reset timer (stay in this diving state for 8 to 15 seconds)
        c.diveTimer = 8.0 + Math.random() * 7.0;

        // 50% chance to dive if depth allows
        if (Math.random() < 0.5) {
          const maxDive = Math.max(
            0.0,
            wRadius - 0.05 - (gRadius + 0.05),
          );
          // Target a random depth between 20% and 80% of max dive depth
          c.targetDiveDepth = (0.2 + Math.random() * 0.6) * maxDive;
        } else {
          c.targetDiveDepth = 0.0; // Float on surface
        }
      }

      // Smoothly transition dive depth
      const diveSpeed = 0.12 * deltaTime; // Smooth descent/ascent rate
      if (c.diveDepth < c.targetDiveDepth) {
        c.diveDepth = Math.min(
          c.targetDiveDepth,
          c.diveDepth + diveSpeed,
        );
      } else if (c.diveDepth > c.targetDiveDepth) {
        c.diveDepth = Math.max(
          c.targetDiveDepth,
          c.diveDepth - diveSpeed,
        );
      }

      let targetR = wRadius - 0.05 - c.diveDepth;
      // Keep swimming NPC under the cave ceiling if they are inside a cave
      if (npcCaveData.insideTunnel && npcCaveData.ceiling !== Infinity) {
        targetR = Math.min(targetR, npcCaveData.ceiling - 0.05);
      }

      // Smoothly adjust actual height towards target height
      if (c.r < targetR) {
        c.r = Math.min(targetR, c.r + 0.2 * deltaTime);
      } else if (c.r > targetR) {
        c.r = Math.max(targetR, c.r - 0.2 * deltaTime);
      }
    }
  },
  render: function(c, allVertices, allColors, allIndices, scale, N, R, F, pos, f, transformPoint, seed) {
    window.buildGeorgiacetusModel(
      c.seed !== undefined ? c.seed : seed,
      c.animPhase,
      c.ragdollEnabled,
      c.isSwimming,
      1.0, // Scale multiplier inside game
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
