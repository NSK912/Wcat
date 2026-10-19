// === SEEDPLANET MODULE: JS/ITEMS/WOOD_DOOR.JS ===

window.ItemRegistry["wood_door"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    // Compute rotated orientation using item.angle (0.0 if undefined)
    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    const wallR = [
      r[0] * cosA + f[0] * sinA,
      r[1] * cosA + f[1] * sinA,
      r[2] * cosA + f[2] * sinA
    ];
    const wallF = [
      f[0] * cosA - r[0] * sinA,
      f[1] * cosA - r[1] * sinA,
      f[2] * cosA - r[2] * sinA
    ];

    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = item.isPreview ? previewColor : (item.color || [0.65, 0.45, 0.25]);
    const rCol = baseColor[0];
    const gCol = baseColor[1];
    const bCol = baseColor[2];

    // 1) Door Frame (Static side posts and top header beam)
    // Adjusted wider posts to leave absolutely no gap with the wood wall planks!
    // Left post: t = -0.076, height = 0.25, width = 0.026 (spans from -0.089 to -0.063)
    const leftPostCenter = [
      p[0] - wallR[0] * 0.076 + n[0] * 0.125,
      p[1] - wallR[1] * 0.076 + n[1] * 0.125,
      p[2] - wallR[2] * 0.076 + n[2] * 0.125
    ];
    const frameColor = [rCol * 0.55, gCol * 0.4, bCol * 0.4]; // Warm darker wood frame color
    addBox(leftPostCenter, 0.026, 0.25, 0.03, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Right post: t = 0.076, height = 0.25, width = 0.026 (spans from 0.063 to 0.089)
    const rightPostCenter = [
      p[0] + wallR[0] * 0.076 + n[0] * 0.125,
      p[1] + wallR[1] * 0.076 + n[1] * 0.125,
      p[2] + wallR[2] * 0.076 + n[2] * 0.125
    ];
    addBox(rightPostCenter, 0.026, 0.25, 0.03, frameColor, wallR, n, wallF, vertices, colors, indices);

    // Top header beam (spans exactly above the door leaf and connects the two posts)
    const headerCenter = [
      p[0] + n[0] * 0.235,
      p[1] + n[1] * 0.235,
      p[2] + n[2] * 0.235
    ];
    addBox(headerCenter, 0.178, 0.03, 0.032, frameColor, wallR, n, wallF, vertices, colors, indices);

    // 1.5) Front and Back Casing/Trim (ประกับขอบ) to seal the joint between frame and wall perfectly flush!
    const casingColor = [rCol * 0.5, gCol * 0.35, bCol * 0.3]; // slightly darker accent wood
    const casingThick = 0.005;
    const casingWidth = 0.025;
    const casingHeight = 0.25;

    // Front Casing (at +0.016 along wallF)
    const frontLeftCasingCenter = [
      p[0] - wallR[0] * 0.085 + n[0] * 0.125 + wallF[0] * 0.016,
      p[1] - wallR[1] * 0.085 + n[1] * 0.125 + wallF[1] * 0.016,
      p[2] - wallR[2] * 0.085 + n[2] * 0.125 + wallF[2] * 0.016
    ];
    addBox(frontLeftCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const frontRightCasingCenter = [
      p[0] + wallR[0] * 0.085 + n[0] * 0.125 + wallF[0] * 0.016,
      p[1] + wallR[1] * 0.085 + n[1] * 0.125 + wallF[1] * 0.016,
      p[2] + wallR[2] * 0.085 + n[2] * 0.125 + wallF[2] * 0.016
    ];
    addBox(frontRightCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const frontTopCasingCenter = [
      p[0] + n[0] * 0.235 + wallF[0] * 0.016,
      p[1] + n[1] * 0.235 + wallF[1] * 0.016,
      p[2] + n[2] * 0.235 + wallF[2] * 0.016
    ];
    addBox(frontTopCasingCenter, 0.195, 0.03, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    // Back Casing (at -0.016 along wallF)
    const backLeftCasingCenter = [
      p[0] - wallR[0] * 0.085 + n[0] * 0.125 - wallF[0] * 0.016,
      p[1] - wallR[1] * 0.085 + n[1] * 0.125 - wallF[1] * 0.016,
      p[2] - wallR[2] * 0.085 + n[2] * 0.125 - wallF[2] * 0.016
    ];
    addBox(backLeftCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const backRightCasingCenter = [
      p[0] + wallR[0] * 0.085 + n[0] * 0.125 - wallF[0] * 0.016,
      p[1] + wallR[1] * 0.085 + n[1] * 0.125 - wallF[1] * 0.016,
      p[2] + wallR[2] * 0.085 + n[2] * 0.125 - wallF[2] * 0.016
    ];
    addBox(backRightCasingCenter, casingWidth, casingHeight, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    const backTopCasingCenter = [
      p[0] + n[0] * 0.235 - wallF[0] * 0.016,
      p[1] + n[1] * 0.235 - wallF[1] * 0.016,
      p[2] + n[2] * 0.235 - wallF[2] * 0.016
    ];
    addBox(backTopCasingCenter, 0.195, 0.03, casingThick, casingColor, wallR, n, wallF, vertices, colors, indices);

    // 2) Swingable Door Leaf (Half-width)
    const doorAngle = item.doorAngle || 0.0;
    const cosD = Math.cos(doorAngle);
    const sinD = Math.sin(doorAngle);

    // Rotated direction of the door leaf relative to door plane
    const leafR = [
      wallR[0] * cosD + wallF[0] * sinD,
      wallR[1] * cosD + wallF[1] * sinD,
      wallR[2] * cosD + wallF[2] * sinD
    ];
    const leafF = [
      wallF[0] * cosD - wallR[0] * sinD,
      wallF[1] * cosD - wallR[1] * sinD,
      wallF[2] * cosD - wallR[2] * sinD
    ];

    // Hinge is at wallR * -0.063. The door leaf spans 0.124, center is at 0.062 from hinge
    const hingeOffset = -0.063;
    const leafCenterOffset = 0.062;
    const leafCenter = [
      p[0] + wallR[0] * hingeOffset + leafR[0] * leafCenterOffset + n[0] * 0.11,
      p[1] + wallR[1] * hingeOffset + leafR[1] * leafCenterOffset + n[1] * 0.11,
      p[2] + wallR[2] * hingeOffset + leafR[2] * leafCenterOffset + n[2] * 0.11
    ];

    // Draw the wooden door leaf body (Snug fit with a very tight 0.001 gap on each side)
    const leafColor = item.isPreview ? previewColor : [rCol * 0.85, gCol * 0.85, bCol * 0.85];
    addBox(leafCenter, 0.124, 0.22, 0.015, leafColor, leafR, n, leafF, vertices, colors, indices);

    // Draw decorative cross brace boards on the door leaf
    const braceColor = [rCol * 0.65, gCol * 0.65, bCol * 0.65];
    addBox(leafCenter, 0.124, 0.02, 0.02, braceColor, leafR, n, leafF, vertices, colors, indices);

    // Draw shiny door knobs on both sides
    if (!item.isPreview) {
      const knobColor = [0.95, 0.75, 0.2]; // Shiny brass
      const knobOffsetR = 0.105; // Close to the latch edge of the half-width door
      const knobOffsetF = 0.015; // Protruding slightly
      
      // Front knob
      const knobFrontCenter = [
        p[0] + wallR[0] * hingeOffset + leafR[0] * knobOffsetR + leafF[0] * knobOffsetF + n[0] * 0.11,
        p[1] + wallR[1] * hingeOffset + leafR[1] * knobOffsetR + leafF[1] * knobOffsetF + n[1] * 0.11,
        p[2] + wallR[2] * hingeOffset + leafR[2] * knobOffsetR + leafF[2] * knobOffsetF + n[2] * 0.11
      ];
      addBox(knobFrontCenter, 0.015, 0.015, 0.015, knobColor, leafR, n, leafF, vertices, colors, indices);

      // Back knob
      const knobBackCenter = [
        p[0] + wallR[0] * hingeOffset + leafR[0] * knobOffsetR - leafF[0] * knobOffsetF + n[0] * 0.11,
        p[1] + wallR[1] * hingeOffset + leafR[1] * knobOffsetR - leafF[1] * knobOffsetF + n[1] * 0.11,
        p[2] + wallR[2] * hingeOffset + leafR[2] * knobOffsetR - leafF[2] * knobOffsetF + n[2] * 0.11
      ];
      addBox(knobBackCenter, 0.015, 0.015, 0.015, knobColor, leafR, n, leafF, vertices, colors, indices);
    }
  }
};
