// === SEEDPLANET MODULE: JS/ITEMS/BOAT_WING.JS ===
// Vintage Biplane Wings Component for Wooden Boat (ปีกประกอบเรือไม้สไตล์เครื่องบินปีกสองชั้นโบราณ)

(function() {
  function drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    
    let r = right || [1, 0, 0], u = up || [0, 1, 0], f = forward || [0, 0, 1];
    if (r && u && f) {
      const det = (r[1]*u[2] - r[2]*u[1])*f[0] + (r[2]*u[0] - r[0]*u[2])*f[1] + (r[0]*u[1] - r[1]*u[0])*f[2];
      if (det < 0) {
        r = [-r[0], -r[1], -r[2]];
      }
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
      0, 2, 1, 0, 3, 2, // bottom (CW outward)
      4, 5, 6, 4, 6, 7, // top (CW outward)
      0, 1, 5, 0, 5, 4, // back (CW outward)
      2, 3, 7, 2, 7, 6, // front (CW outward)
      0, 7, 3, 0, 4, 7, // left (CW outward)
      1, 2, 6, 1, 6, 5, // right (CW outward)
    ];
    
    const baseIdx = outVertices.length / 3;
    
    for (let i = 0; i < 8; i++) {
       const v = cubeVerts[i];
       const rx = r[0]*v[0] + u[0]*v[1] + f[0]*v[2];
       const ry = r[1]*v[0] + u[1]*v[1] + f[1]*v[2];
       const rz = r[2]*v[0] + u[2]*v[1] + f[2]*v[2];
       
       outVertices.push(center[0]+rx, center[1]+ry, center[2]+rz);
       outColors.push(color[0], color[1], color[2]);
    }
    
    for (let i = 0; i < cubeIndices.length; i++) {
        outIndices.push(baseIdx + cubeIndices[i]);
    }
  }

  function addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices) {
    if (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== addBox) {
      window.addBox(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
    } else {
      drawBoxFallback(center, w, h, d, color, right, up, forward, outVertices, outColors, outIndices);
    }
  }

  // Ensure window.addBox is available if not already defined
  if (typeof window !== "undefined" && typeof window.addBox !== "function") {
    window.addBox = drawBoxFallback;
  }

  window.ItemRegistry = window.ItemRegistry || {};

window.drawBoatWings = function(
  center,
  wingSpan,
  chord,
  R,
  N,
  F,
  colors_obj,
  vertices,
  colors,
  indices,
  isPreview,
  previewColor,
  bankAngle
) {
  const cCanvas = isPreview ? previewColor : (colors_obj?.canvas || [0.86, 0.80, 0.68]);
  const cRib = isPreview ? previewColor : (colors_obj?.rib || [0.48, 0.32, 0.18]);
  const cSpar = isPreview ? previewColor : (colors_obj?.spar || [0.55, 0.38, 0.22]);
  const cStrut = isPreview ? previewColor : (colors_obj?.strut || [0.42, 0.30, 0.16]);
  const cWire = isPreview ? previewColor : (colors_obj?.wire || [0.32, 0.32, 0.35]);
  const cMount = isPreview ? previewColor : (colors_obj?.mount || [0.50, 0.35, 0.20]);

  // Apply bank angle roll around F if turning in air
  let r = [...R];
  let n = [...N];
  let f = [...F];
  if (bankAngle && Math.abs(bankAngle) > 0.001) {
    const cosB = Math.cos(bankAngle);
    const sinB = Math.sin(bankAngle);
    r = [
      R[0] * cosB - N[0] * sinB,
      R[1] * cosB - N[1] * sinB,
      R[2] * cosB - N[2] * sinB
    ];
    n = [
      N[0] * cosB + R[0] * sinB,
      N[1] * cosB + R[1] * sinB,
      N[2] * cosB + R[2] * sinB
    ];
  }

  const span = wingSpan || 1.55;
  const cWidth = chord || 0.40;
  const wingThick = 0.012;

  // 1. Base Mounting Beams across boat gunwales (คานไม้พาดขวางกราบเรือ)
  const mountBeamLen = 0.44;
  const mountBeamW = 0.035;
  const mountBeamH = 0.025;
  const frontMountPos = [
    center[0] + n[0] * 0.045 + f[0] * 0.14,
    center[1] + n[1] * 0.045 + f[1] * 0.14,
    center[2] + n[2] * 0.045 + f[2] * 0.14
  ];
  const rearMountPos = [
    center[0] + n[0] * 0.045 - f[0] * 0.14,
    center[1] + n[1] * 0.045 - f[1] * 0.14,
    center[2] + n[2] * 0.045 - f[2] * 0.14
  ];
  addBox(frontMountPos, mountBeamLen, mountBeamH, mountBeamW, cMount, r, n, f, vertices, colors, indices);
  addBox(rearMountPos, mountBeamLen, mountBeamH, mountBeamW, cMount, r, n, f, vertices, colors, indices);

  // 2. Lower Stub Wings (ปีกล่างข้างตัวเรือ ซ้ายและขวา)
  const lowerSpan = 0.34;
  const lowerChord = 0.32;
  const lowerUp = 0.06;
  const lowerYOffset = 0.0;

  // Left stub wing
  const leftLowerCenter = [
    center[0] - r[0] * (0.22 + lowerSpan * 0.5) + n[0] * lowerUp + f[0] * lowerYOffset,
    center[1] - r[1] * (0.22 + lowerSpan * 0.5) + n[1] * lowerUp + f[1] * lowerYOffset,
    center[2] - r[2] * (0.22 + lowerSpan * 0.5) + n[2] * lowerUp + f[2] * lowerYOffset
  ];
  addBox(leftLowerCenter, lowerSpan, wingThick, lowerChord, cCanvas, r, n, f, vertices, colors, indices);
  // Left stub spars & ribs
  addBox([leftLowerCenter[0] + f[0] * (lowerChord * 0.48), leftLowerCenter[1] + f[1] * (lowerChord * 0.48), leftLowerCenter[2] + f[2] * (lowerChord * 0.48)], lowerSpan, wingThick * 1.6, 0.02, cSpar, r, n, f, vertices, colors, indices);
  addBox([leftLowerCenter[0] - f[0] * (lowerChord * 0.48), leftLowerCenter[1] - f[1] * (lowerChord * 0.48), leftLowerCenter[2] - f[2] * (lowerChord * 0.48)], lowerSpan, wingThick * 1.3, 0.015, cRib, r, n, f, vertices, colors, indices);

  // Right stub wing
  const rightLowerCenter = [
    center[0] + r[0] * (0.22 + lowerSpan * 0.5) + n[0] * lowerUp + f[0] * lowerYOffset,
    center[1] + r[1] * (0.22 + lowerSpan * 0.5) + n[1] * lowerUp + f[1] * lowerYOffset,
    center[2] + r[2] * (0.22 + lowerSpan * 0.5) + n[2] * lowerUp + f[2] * lowerYOffset
  ];
  addBox(rightLowerCenter, lowerSpan, wingThick, lowerChord, cCanvas, r, n, f, vertices, colors, indices);
  // Right stub spars & ribs
  addBox([rightLowerCenter[0] + f[0] * (lowerChord * 0.48), rightLowerCenter[1] + f[1] * (lowerChord * 0.48), rightLowerCenter[2] + f[2] * (lowerChord * 0.48)], lowerSpan, wingThick * 1.6, 0.02, cSpar, r, n, f, vertices, colors, indices);
  addBox([rightLowerCenter[0] - f[0] * (lowerChord * 0.48), rightLowerCenter[1] - f[1] * (lowerChord * 0.48), rightLowerCenter[2] - f[2] * (lowerChord * 0.48)], lowerSpan, wingThick * 1.3, 0.015, cRib, r, n, f, vertices, colors, indices);

  // 3. Upper Main Biplane Wing (ปีกบนหลักทรงโค้ง ปลายปีกเชิดขึ้นแบบ Wright Flyer)
  const upperUp = 0.25;
  const numPanels = 10;
  const halfSpan = span * 0.5;
  const panelW = span / numPanels;

  for (let i = 0; i < numPanels; i++) {
    const x0 = -halfSpan + i * panelW;
    const x1 = x0 + panelW;
    const xMid = (x0 + x1) * 0.5;

    // Gentle upward dihedral sweep towards wingtips (โค้งเชิดปลายปีกแบบในรูป)
    const normX = Math.abs(xMid) / halfSpan;
    const sweepUp = Math.pow(normX, 2.2) * 0.065;
    const panelY = upperUp + sweepUp;

    // Small tilt / camber angle
    const camberAngle = (xMid >= 0 ? 1 : -1) * (normX * 0.10);
    const cosC = Math.cos(camberAngle);
    const sinC = Math.sin(camberAngle);
    const rCamber = [
      r[0] * cosC + n[0] * sinC,
      r[1] * cosC + n[1] * sinC,
      r[2] * cosC + n[2] * sinC
    ];
    const nCamber = [
      n[0] * cosC - r[0] * sinC,
      n[1] * cosC - r[1] * sinC,
      n[2] * cosC - r[2] * sinC
    ];

    const pMid = [
      center[0] + r[0] * xMid + n[0] * panelY,
      center[1] + r[1] * xMid + n[1] * panelY,
      center[2] + r[2] * xMid + n[2] * panelY
    ];

    // Wing fabric panel
    addBox(pMid, panelW * 0.99, wingThick, cWidth, cCanvas, rCamber, nCamber, f, vertices, colors, indices);

    // Front Leading Edge Spar (คานขอบหน้าปีก)
    const pFrontSpar = [
      pMid[0] + f[0] * (cWidth * 0.49),
      pMid[1] + f[1] * (cWidth * 0.49),
      pMid[2] + f[2] * (cWidth * 0.49)
    ];
    addBox(pFrontSpar, panelW * 1.01, wingThick * 1.8, 0.022, cSpar, rCamber, nCamber, f, vertices, colors, indices);

    // Rear Trailing Edge Spar (คานขอบหลังปีก)
    const pRearSpar = [
      pMid[0] - f[0] * (cWidth * 0.49),
      pMid[1] - f[1] * (cWidth * 0.49),
      pMid[2] - f[2] * (cWidth * 0.49)
    ];
    addBox(pRearSpar, panelW * 1.01, wingThick * 1.4, 0.016, cRib, rCamber, nCamber, f, vertices, colors, indices);

    // Aerodynamic Rib Battens at panel edges (โครงซี่ไม้ปีก)
    const pRib = [
      center[0] + r[0] * x0 + n[0] * panelY,
      center[1] + r[1] * x0 + n[1] * panelY,
      center[2] + r[2] * x0 + n[2] * panelY
    ];
    addBox(pRib, 0.012, wingThick * 1.6, cWidth * 0.98, cRib, rCamber, nCamber, f, vertices, colors, indices);
  }
  // Far right wing rib tip
  const pRightTipRib = [
    center[0] + r[0] * halfSpan + n[0] * (upperUp + 0.065),
    center[1] + r[1] * halfSpan + n[1] * (upperUp + 0.065),
    center[2] + r[2] * halfSpan + n[2] * (upperUp + 0.065)
  ];
  addBox(pRightTipRib, 0.014, wingThick * 1.6, cWidth * 0.98, cRib, r, n, f, vertices, colors, indices);

  // 4. Biplane Truss Struts (เสาค้ำโครงสร้างระหว่างเรือและปีกบน)
  const strutThick = 0.014;
  const strutXPositions = [-0.46, -0.19, 0.19, 0.46];
  const strutZPositions = [-0.13, 0.13];

  strutXPositions.forEach(sx => {
    const normX = Math.abs(sx) / halfSpan;
    const topY = upperUp + Math.pow(normX, 2.2) * 0.065;
    const botY = (Math.abs(sx) > 0.3) ? lowerUp : 0.045;
    const strutH = topY - botY;
    const midY = (topY + botY) * 0.5;

    strutZPositions.forEach(sz => {
      const sCenter = [
        center[0] + r[0] * sx + n[0] * midY + f[0] * sz,
        center[1] + r[1] * sx + n[1] * midY + f[1] * sz,
        center[2] + r[2] * sx + n[2] * midY + f[2] * sz
      ];
      addBox(sCenter, strutThick, strutH, strutThick, cStrut, r, n, f, vertices, colors, indices);
    });

    // Cross-wire bracing between front and rear struts (โครงลวดไขว้กากบาท)
    const midX = sx;
    const crossCenter = [
      center[0] + r[0] * midX + n[0] * midY,
      center[1] + r[1] * midX + n[1] * midY,
      center[2] + r[2] * midX + n[2] * midY
    ];
    addBox(crossCenter, 0.006, strutH * 0.85, 0.006, cWire, r, n, f, vertices, colors, indices);
  });

  // Diagonal Bay Cross-Wires (ลวดสลิงไขว้ข้ามช่องซ้าย-ขวา สไตล์ไบเพลนคลาสสิก)
  const bayPairs = [
    { x1: -0.46, x2: -0.19 },
    { x1: 0.19, x2: 0.46 }
  ];
  bayPairs.forEach(bay => {
    const midX = (bay.x1 + bay.x2) * 0.5;
    const midY = (upperUp + lowerUp) * 0.5;
    strutZPositions.forEach(sz => {
      const diagCenter = [
        center[0] + r[0] * midX + n[0] * midY + f[0] * sz,
        center[1] + r[1] * midX + n[1] * midY + f[1] * sz,
        center[2] + r[2] * midX + n[2] * midY + f[2] * sz
      ];
      addBox(diagCenter, Math.abs(bay.x2 - bay.x1) * 0.95, 0.006, 0.006, cWire, r, n, f, vertices, colors, indices);
    });
  });
};

window.ItemRegistry["boat_wing"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

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
      // Snapped to boat: render full biplane wings mounted directly onto the boat
      const wingCenter = [
        p[0] + n[0] * 0.06,
        p[1] + n[1] * 0.06,
        p[2] + n[2] * 0.06
      ];
      window.drawBoatWings(
        wingCenter,
        1.55,
        0.40,
        r, n, f,
        null,
        vertices, colors, indices,
        true,
        previewColor,
        0
      );
      return;
    }

    // World Item / Hand / Ground Render: neat compact folded wings assembly
    const scale = item.size || 0.25;
    const cCanvas = isPreview ? previewColor : [0.86, 0.80, 0.68];
    const cWood = isPreview ? previewColor : [0.52, 0.36, 0.20];
    const cMetal = isPreview ? previewColor : [0.35, 0.35, 0.38];

    const center = [
      p[0] + n[0] * (scale * 0.3),
      p[1] + n[1] * (scale * 0.3),
      p[2] + n[2] * (scale * 0.3)
    ];

    // Folded wing spars bundle
    addBox(center, scale * 1.6, scale * 0.12, scale * 0.28, cCanvas, r, n, f, vertices, colors, indices);
    addBox([center[0] + n[0] * (scale * 0.1), center[1] + n[1] * (scale * 0.1), center[2] + n[2] * (scale * 0.1)], scale * 1.62, scale * 0.04, 0.03, cWood, r, n, f, vertices, colors, indices);
    addBox([center[0] - n[0] * (scale * 0.1), center[1] - n[1] * (scale * 0.1), center[2] - n[2] * (scale * 0.1)], scale * 1.62, scale * 0.04, 0.03, cWood, r, n, f, vertices, colors, indices);
    // Support struts tied in package
    addBox([center[0] + f[0] * (scale * 0.18), center[1] + f[1] * (scale * 0.18), center[2] + f[2] * (scale * 0.18)], scale * 0.9, scale * 0.16, scale * 0.08, cWood, r, n, f, vertices, colors, indices);
    addBox(center, scale * 0.15, scale * 0.22, scale * 0.32, cMetal, r, n, f, vertices, colors, indices);
  }
};
})();

