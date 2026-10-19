// === SEEDPLANET MODULE: JS/ITEMS/WOOD_WHEEL.JS ===

window.drawDetailedWoodenWheel = function(center, radius, thickness, R, N, F, spinAngle, woodColor, darkWoodColor, metalColor, vertices, colors, indices, isPreview, previewColor, steerAngle) {
  const cRim = isPreview ? previewColor : (woodColor || [0.55, 0.38, 0.22]);
  const cSpoke = isPreview ? previewColor : (darkWoodColor || [0.4, 0.26, 0.14]);
  const cHub = isPreview ? previewColor : (metalColor || [0.35, 0.35, 0.35]);
  const cIronBand = isPreview ? previewColor : [0.22, 0.22, 0.25];

  let wheelR = R;
  let wheelF = F;
  if (steerAngle && Math.abs(steerAngle) > 0.001) {
    const cosS = Math.cos(steerAngle), sinS = Math.sin(steerAngle);
    wheelF = [
      F[0] * cosS + R[0] * sinS,
      F[1] * cosS + R[1] * sinS,
      F[2] * cosS + R[2] * sinS
    ];
    wheelR = [
      R[0] * cosS - F[0] * sinS,
      R[1] * cosS - F[1] * sinS,
      R[2] * cosS - F[2] * sinS
    ];
  }

  const segs = 12;
  const rimWidth = radius * 0.24;
  const rOuter = radius;
  const rInner = radius - rimWidth;
  const halfThick = thickness * 0.5;

  const ringBaseIdx = vertices.length / 3;

  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2 + (spinAngle || 0);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const radX = N[0] * cosA + wheelF[0] * sinA;
    const radY = N[1] * cosA + wheelF[1] * sinA;
    const radZ = N[2] * cosA + wheelF[2] * sinA;

    const pOutX = center[0] + radX * rOuter;
    const pOutY = center[1] + radY * rOuter;
    const pOutZ = center[2] + radZ * rOuter;

    const pInX = center[0] + radX * rInner;
    const pInY = center[1] + radY * rInner;
    const pInZ = center[2] + radZ * rInner;

    vertices.push(pOutX + wheelR[0] * halfThick, pOutY + wheelR[1] * halfThick, pOutZ + wheelR[2] * halfThick);
    vertices.push(pOutX - wheelR[0] * halfThick, pOutY - wheelR[1] * halfThick, pOutZ - wheelR[2] * halfThick);
    vertices.push(pInX - wheelR[0] * halfThick, pInY - wheelR[1] * halfThick, pInZ - wheelR[2] * halfThick);
    vertices.push(pInX + wheelR[0] * halfThick, pInY + wheelR[1] * halfThick, pInZ + wheelR[2] * halfThick);

    const woodGrain = isPreview ? 1.0 : (0.92 + 0.16 * Math.sin(i * 1.5));
    for (let c = 0; c < 4; c++) {
      colors.push(cRim[0] * woodGrain, cRim[1] * woodGrain, cRim[2] * woodGrain);
    }
  }

  for (let i = 0; i < segs; i++) {
    const curr = ringBaseIdx + i * 4;
    const next = ringBaseIdx + (i + 1) * 4;

    indices.push(curr + 0, next + 0, next + 1); indices.push(curr + 0, next + 1, next + 0);
    indices.push(curr + 0, next + 1, curr + 1); indices.push(curr + 0, curr + 1, next + 1);

    indices.push(curr + 2, curr + 3, next + 3); indices.push(curr + 2, next + 3, curr + 3);
    indices.push(curr + 2, next + 3, next + 2); indices.push(curr + 2, next + 2, next + 3);

    indices.push(curr + 3, curr + 0, next + 0); indices.push(curr + 3, next + 0, curr + 0);
    indices.push(curr + 3, next + 0, next + 3); indices.push(curr + 3, next + 3, next + 0);

    indices.push(curr + 1, curr + 2, next + 2); indices.push(curr + 1, next + 2, curr + 2);
    indices.push(curr + 1, next + 2, next + 1); indices.push(curr + 1, next + 1, next + 2);
  }

  // Hub
  const hubRadius = radius * 0.28;
  const hubThick = thickness * 1.4;
  const hubSegs = 8;
  const hubHalfThick = hubThick * 0.5;
  const hubBaseIdx = vertices.length / 3;

  for (let i = 0; i <= hubSegs; i++) {
    const angle = (i / hubSegs) * Math.PI * 2 + (spinAngle || 0);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const radX = N[0] * cosA + wheelF[0] * sinA;
    const radY = N[1] * cosA + wheelF[1] * sinA;
    const radZ = N[2] * cosA + wheelF[2] * sinA;

    const hX = center[0] + radX * hubRadius;
    const hY = center[1] + radY * hubRadius;
    const hZ = center[2] + radZ * hubRadius;

    vertices.push(hX + wheelR[0] * hubHalfThick, hY + wheelR[1] * hubHalfThick, hZ + wheelR[2] * hubHalfThick);
    vertices.push(hX - wheelR[0] * hubHalfThick, hY - wheelR[1] * hubHalfThick, hZ - wheelR[2] * hubHalfThick);

    colors.push(cHub[0], cHub[1], cHub[2]);
    colors.push(cHub[0], cHub[1], cHub[2]);
  }

  for (let i = 0; i < hubSegs; i++) {
    const curr = hubBaseIdx + i * 2;
    const next = hubBaseIdx + (i + 1) * 2;

    indices.push(curr + 0, curr + 1, next + 1); indices.push(curr + 0, next + 1, curr + 1);
    indices.push(curr + 0, next + 1, next + 0); indices.push(curr + 0, next + 0, next + 1);
  }

  const capRightIdx = vertices.length / 3;
  vertices.push(center[0] + wheelR[0] * hubHalfThick, center[1] + wheelR[1] * hubHalfThick, center[2] + wheelR[2] * hubHalfThick);
  colors.push(cHub[0] * 1.15, cHub[1] * 1.15, cHub[2] * 1.15);

  const capLeftIdx = vertices.length / 3;
  vertices.push(center[0] - wheelR[0] * hubHalfThick, center[1] - wheelR[1] * hubHalfThick, center[2] - wheelR[2] * hubHalfThick);
  colors.push(cHub[0] * 1.15, cHub[1] * 1.15, cHub[2] * 1.15);

  for (let i = 0; i < hubSegs; i++) {
    const curr = hubBaseIdx + i * 2;
    const next = hubBaseIdx + (i + 1) * 2;

    indices.push(capRightIdx, curr + 0, next + 0); indices.push(capRightIdx, next + 0, curr + 0);
    indices.push(capLeftIdx, next + 1, curr + 1); indices.push(capLeftIdx, curr + 1, next + 1);
  }

  // Spokes
  const spokeCount = 6;
  const spokeThick = thickness * 0.42;
  for (let s = 0; s < spokeCount; s++) {
    const angle = (s / spokeCount) * Math.PI * 2 + (spinAngle || 0);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const dirX = N[0] * cosA + wheelF[0] * sinA;
    const dirY = N[1] * cosA + wheelF[1] * sinA;
    const dirZ = N[2] * cosA + wheelF[2] * sinA;

    const pStart = [
      center[0] + dirX * (hubRadius * 0.85),
      center[1] + dirY * (hubRadius * 0.85),
      center[2] + dirZ * (hubRadius * 0.85)
    ];
    const pEnd = [
      center[0] + dirX * (rInner * 1.02),
      center[1] + dirY * (rInner * 1.02),
      center[2] + dirZ * (rInner * 1.02)
    ];

    if (typeof buildTaperedSegment === "function") {
      buildTaperedSegment(pStart, pEnd, spokeThick, spokeThick * 0.8, 4, cSpoke, vertices, colors, indices, false);
    }
  }

  // Iron outer band
  if (!isPreview) {
    const ironSegs = 12;
    const ironOuter = rOuter + 0.003;
    const ironThick = halfThick * 0.92;
    const ironBaseIdx = vertices.length / 3;

    for (let i = 0; i <= ironSegs; i++) {
      const angle = (i / ironSegs) * Math.PI * 2 + (spinAngle || 0);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const radX = N[0] * cosA + wheelF[0] * sinA;
      const radY = N[1] * cosA + wheelF[1] * sinA;
      const radZ = N[2] * cosA + wheelF[2] * sinA;

      const pX = center[0] + radX * ironOuter;
      const pY = center[1] + radY * ironOuter;
      const pZ = center[2] + radZ * ironOuter;

      vertices.push(pX + wheelR[0] * ironThick, pY + wheelR[1] * ironThick, pZ + wheelR[2] * ironThick);
      vertices.push(pX - wheelR[0] * ironThick, pY - wheelR[1] * ironThick, pZ - wheelR[2] * ironThick);

      colors.push(cIronBand[0], cIronBand[1], cIronBand[2]);
      colors.push(cIronBand[0], cIronBand[1], cIronBand[2]);
    }

    for (let i = 0; i < ironSegs; i++) {
      const curr = ironBaseIdx + i * 2;
      const next = ironBaseIdx + (i + 1) * 2;

      indices.push(curr + 0, next + 0, next + 1); indices.push(curr + 0, next + 1, next + 0);
      indices.push(curr + 0, next + 1, curr + 1); indices.push(curr + 0, curr + 1, next + 1);
    }
  }
};

window.ItemRegistry["wood_wheel"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const woodColor = item.color || [0.55, 0.38, 0.22];
    const darkWoodColor = [0.4, 0.26, 0.14];
    const metalHubColor = [0.35, 0.35, 0.35];

    let n = item.normal || [0, 1, 0];
    let baseR = item.R || [1, 0, 0];
    let baseF = item.F || [0, 0, 1];

    let r = baseR;
    let f = baseF;

    if (item.angle !== undefined && item.angle !== 0) {
      const cosH = Math.cos(item.angle);
      const sinH = Math.sin(item.angle);
      r = [baseR[0] * cosH - baseF[0] * sinH, baseR[1] * cosH - baseF[1] * sinH, baseR[2] * cosH - baseF[2] * sinH];
      f = [baseF[0] * cosH + baseR[0] * sinH, baseF[1] * cosH + baseR[1] * sinH, baseF[2] * cosH + baseR[2] * sinH];
    }

    if (isPreview && item.isBoatSnapped) {
      const wheelScale = typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
      const wheelRadius = 0.16 * wheelScale;
      const wheelThick = 0.04 * wheelScale;

      const fAxleLen = typeof window.wheelFrontAxleLength === "number" ? window.wheelFrontAxleLength : 0.36;
      const fSideOff = typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
      const fFwdOff  = typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
      const fUpOff   = typeof window.wheelFrontUpOffset   === "number" ? window.wheelFrontUpOffset   : -0.03;

      const rAxleLen = typeof window.wheelRearAxleLength === "number" ? window.wheelRearAxleLength : 0.36;
      const rSideOff = typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
      const rFwdOff  = typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
      const rUpOff   = typeof window.wheelRearUpOffset   === "number" ? window.wheelRearUpOffset   : -0.03;

      const wheelOffsets = [
        { side: -1, forward: fFwdOff,  sideOff: fSideOff, upOff: fUpOff, isFront: true },
        { side: 1,  forward: fFwdOff,  sideOff: fSideOff, upOff: fUpOff, isFront: true },
        { side: -1, forward: -rFwdOff, sideOff: rSideOff, upOff: rUpOff, isFront: false },
        { side: 1,  forward: -rFwdOff, sideOff: rSideOff, upOff: rUpOff, isFront: false }
      ];

      // Front axle bar
      const fAxleCenter = [
        p[0] + n[0] * fUpOff + f[0] * fFwdOff,
        p[1] + n[1] * fUpOff + f[1] * fFwdOff,
        p[2] + n[2] * fUpOff + f[2] * fFwdOff
      ];
      addBox(fAxleCenter, fAxleLen, 0.03, 0.03, previewColor, r, n, f, vertices, colors, indices);

      // Rear axle bar
      const rAxleCenter = [
        p[0] + n[0] * rUpOff + f[0] * (-rFwdOff),
        p[1] + n[1] * rUpOff + f[1] * (-rFwdOff),
        p[2] + n[2] * rUpOff + f[2] * (-rFwdOff)
      ];
      addBox(rAxleCenter, rAxleLen, 0.03, 0.03, previewColor, r, n, f, vertices, colors, indices);

      for (let wo of wheelOffsets) {
        const sideOffset = wo.side * wo.sideOff;
        const fwdOffset = wo.forward;
        const upOffset = wo.upOff;

        const wCenter = [
          p[0] + r[0] * sideOffset + n[0] * upOffset + f[0] * fwdOffset,
          p[1] + r[1] * sideOffset + n[1] * upOffset + f[1] * fwdOffset,
          p[2] + r[2] * sideOffset + n[2] * upOffset + f[2] * fwdOffset
        ];

        window.drawDetailedWoodenWheel(
          wCenter, wheelRadius, wheelThick,
          r, n, f, 0,
          woodColor, darkWoodColor, metalHubColor,
          vertices, colors, indices,
          true, previewColor
        );
      }
      return;
    }

    const scale = item.size || 0.25;
    const radius = scale * 0.6;
    const thickness = scale * 0.12;

    window.drawDetailedWoodenWheel(
      p, radius, thickness,
      r, n, f, 0,
      woodColor, darkWoodColor, metalHubColor,
      vertices, colors, indices,
      isPreview, previewColor
    );
  }
};
