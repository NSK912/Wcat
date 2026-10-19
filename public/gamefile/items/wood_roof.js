// === SEEDPLANET MODULE: JS/ITEMS/WOOD_ROOF.JS ===

window.ItemRegistry["wood_roof"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position || [0, 0, 0];
    const r = item.R || [1, 0, 0];
    const f = item.F || [0, 0, 1];
    const n = item.normal || [0, 1, 0];

    // Compute rotated orientation based on item.angle
    const angle = item.angle || 0.0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const roofR = [
      r[0] * cosA + f[0] * sinA,
      r[1] * cosA + f[1] * sinA,
      r[2] * cosA + f[2] * sinA
    ];
    const roofF = [
      f[0] * cosA - r[0] * sinA,
      f[1] * cosA - r[1] * sinA,
      f[2] * cosA - r[2] * sinA
    ];

    // Standard structural tile dimensions exactly matching wood wall (0.30m wide x 0.30m deep)
    const w = 0.30;
    const d = 0.30;

    // Height profile: starts at 0.0 (sitting flush on top of wall/floor with zero gap),
    // and rises to 0.25 (exactly matching the 0.25m height of wood wall!)
    const hEave = 0.0;
    const hRidge = 0.25;
    const rise = hRidge - hEave; // 0.25m vertical rise

    // Calculate slope vectors
    const slopeLen = Math.sqrt(d * d + rise * rise); // ~0.3905m
    const dirSlope = [
      (roofF[0] * d + n[0] * rise) / slopeLen,
      (roofF[1] * d + n[1] * rise) / slopeLen,
      (roofF[2] * d + n[2] * rise) / slopeLen
    ];

    // Normal vector perpendicular to the inclined roof surface (pointing outward/upward)
    let normSlope = [
      (n[0] * d - roofF[0] * rise) / slopeLen,
      (n[1] * d - roofF[1] * rise) / slopeLen,
      (n[2] * d - roofF[2] * rise) / slopeLen
    ];

    if (normSlope[0] * n[0] + normSlope[1] * n[1] + normSlope[2] * n[2] < 0) {
      normSlope = [-normSlope[0], -normSlope[1], -normSlope[2]];
    }

    // Slope bounds: from eave (-slopeLen/2) to ridge (+slopeLen/2)
    const vMinEff = -slopeLen / 2;
    let vMaxEff = slopeLen / 2;

    const allCollectibles = (typeof window !== "undefined" && window.collectibles) ? window.collectibles : [];
    const colLen = allCollectibles.length;
    if (item._vMaxEff !== undefined && item._colLen === colLen) {
      vMaxEff = item._vMaxEff;
    } else {
      let roofsToCheck;
      if (window._spatialRoofs) {
        roofsToCheck = [];
        const cx = Math.floor(p[0] / 2.0);
        const cy = Math.floor(p[1] / 2.0);
        const cz = Math.floor(p[2] / 2.0);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const k = (cx + dx) + "_" + (cy + dy) + "_" + (cz + dz);
              const bucket = window._spatialRoofs.get(k);
              if (bucket) {
                for (let b = 0; b < bucket.length; b++) roofsToCheck.push(bucket[b]);
              }
            }
          }
        }
      } else {
        roofsToCheck = allCollectibles;
      }
      for (let other of roofsToCheck) {
        if (!other.active || other === item) continue;
        if (other.isPreview && !item.isPreview) continue;
        const oP = other.position || [0, 0, 0];
        const dx = oP[0] - p[0];
        const dy = oP[1] - p[1];
        const dz = oP[2] - p[2];
        if (dx*dx + dy*dy + dz*dz > 2.0) continue;
        if (other.type === "wood_roof") {
          const oR = other.R || [1, 0, 0];
          const oF = other.F || [0, 0, 1];
          const oAngle = other.angle || 0.0;
          const cosOA = Math.cos(oAngle);
          const sinOA = Math.sin(oAngle);
          const otherF = [
            oF[0] * cosOA - oR[0] * sinOA,
            oF[1] * cosOA - oR[1] * sinOA,
            oF[2] * cosOA - oR[2] * sinOA
          ];
          const latDist = Math.abs(dx * roofR[0] + dy * roofR[1] + dz * roofR[2]);
          if (latDist > w * 0.85) continue;
          const dotF = roofF[0] * otherF[0] + roofF[1] * otherF[1] + roofF[2] * otherF[2];
          if (dotF < -0.6) {
            const deltaF = dx * roofF[0] + dy * roofF[1] + dz * roofF[2];
            const deltaN = dx * n[0] + dy * n[1] + dz * n[2];
            const u_int = deltaF * 0.5 + deltaN * (d / (2.0 * rise));
            if (u_int > -d * 0.6 && u_int < d * 0.6) {
              const s_int = u_int * (slopeLen / d);
              if (s_int < vMaxEff) {
                vMaxEff = s_int;
              }
            }
          }
        }
      }
      if (!item.isPreview) { item._vMaxEff = vMaxEff; item._colLen = colLen; }
    }

    if (vMaxEff <= vMinEff + 0.01) {
      return;
    }

    // Effective length of visible roof slope
    const effSlopeLen = vMaxEff - vMinEff;

    // Midpoint distance along slope for the visible portion
    const midDistAlong = (vMinEff + vMaxEff) / 2;
    const centerSlope = [
      p[0] + n[0] * (rise / 2) + dirSlope[0] * midDistAlong,
      p[1] + n[1] * (rise / 2) + dirSlope[1] * midDistAlong,
      p[2] + n[2] * (rise / 2) + dirSlope[2] * midDistAlong
    ];

    // Ridge beam position at the top of the visible slope (vMaxEff)
    const ridgePos = [
      p[0] + n[0] * (rise / 2) + dirSlope[0] * (vMaxEff - 0.012),
      p[1] + n[1] * (rise / 2) + dirSlope[1] * (vMaxEff - 0.012),
      p[2] + n[2] * (rise / 2) + dirSlope[2] * (vMaxEff - 0.012)
    ];

    // Eave beam position at the bottom of the visible slope (vMinEff)
    const eavePos = [
      p[0] + n[0] * (rise / 2) + dirSlope[0] * (vMinEff + 0.012),
      p[1] + n[1] * (rise / 2) + dirSlope[1] * (vMinEff + 0.012),
      p[2] + n[2] * (rise / 2) + dirSlope[2] * (vMinEff + 0.012)
    ];

    if (item.isPreview) {
      const isValid = item.isValidPlacement !== false;
      const col = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

      // Sloped wedge preview representation (clipped to exact visible slope)
      addBox(centerSlope, w, 0.024, effSlopeLen, col, roofR, normSlope, dirSlope, vertices, colors, indices);

      // Support ridge beam on preview (at vMaxEff)
      addBox(ridgePos, w, 0.024, 0.024, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], roofR, n, roofF, vertices, colors, indices);

      // Support eave beam on preview (at vMinEff)
      addBox(eavePos, w, 0.024, 0.024, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], roofR, n, roofF, vertices, colors, indices);
    } else {
      // Seed-based stable pseudo-random generator
      const seedVal = item.seed || (p[0] * 143.7 + p[2] * 71.9);
      function pRand(s) {
        const x = Math.sin(s) * 10000;
        return x - Math.floor(x);
      }

      const baseColor = item.color || [0.65, 0.45, 0.25];
      const rCol = baseColor[0];
      const gCol = baseColor[1];
      const bCol = baseColor[2];

      // 1) Side rafter beams (structural timber frames on left, center, and right)
      const rafterW = 0.022;
      const rafterH = 0.024;
      const rafterLeftPos = [
        centerSlope[0] - roofR[0] * (w / 2 - rafterW / 2),
        centerSlope[1] - roofR[1] * (w / 2 - rafterW / 2),
        centerSlope[2] - roofR[2] * (w / 2 - rafterW / 2)
      ];
      const rafterRightPos = [
        centerSlope[0] + roofR[0] * (w / 2 - rafterW / 2),
        centerSlope[1] + roofR[1] * (w / 2 - rafterW / 2),
        centerSlope[2] + roofR[2] * (w / 2 - rafterW / 2)
      ];
      const rafterCenterPos = [
        centerSlope[0],
        centerSlope[1],
        centerSlope[2]
      ];

      const darkWood = [rCol * 0.72, gCol * 0.72, bCol * 0.72];
      addBox(rafterLeftPos, rafterW, rafterH, effSlopeLen, darkWood, roofR, normSlope, dirSlope, vertices, colors, indices);
      addBox(rafterRightPos, rafterW, rafterH, effSlopeLen, darkWood, roofR, normSlope, dirSlope, vertices, colors, indices);
      addBox(rafterCenterPos, rafterW * 0.9, rafterH, effSlopeLen, darkWood, roofR, normSlope, dirSlope, vertices, colors, indices);

      // 2) Overlapping wooden roof planks (shingle/shake roofing along slope)
      const numPlanks = Math.max(1, Math.round(5 * (effSlopeLen / slopeLen)));
      const plankLen = effSlopeLen / numPlanks + 0.012; // slight overlap
      const plankThick = 0.015;

      for (let i = 0; i < numPlanks; i++) {
        const distAlong = vMinEff + (i + 0.5) * (effSlopeLen / numPlanks);
        const plankCenter = [
          p[0] + n[0] * (rise / 2) + dirSlope[0] * distAlong + normSlope[0] * 0.012,
          p[1] + n[1] * (rise / 2) + dirSlope[1] * distAlong + normSlope[1] * 0.012,
          p[2] + n[2] * (rise / 2) + dirSlope[2] * distAlong + normSlope[2] * 0.012
        ];

        const shadeNoise = pRand(seedVal + i * 19.3);
        const plankColor = [
          rCol * (0.85 + shadeNoise * 0.28),
          gCol * (0.85 + shadeNoise * 0.28),
          bCol * (0.85 + shadeNoise * 0.28)
        ];

        addBox(plankCenter, w, plankThick, plankLen, plankColor, roofR, normSlope, dirSlope, vertices, colors, indices);

        // Subtle dark grain lines along the plank width
        const grainNoiseX = pRand(seedVal + i * 37.1);
        const grainOffsetR = (grainNoiseX - 0.5) * (w * 0.5);
        const grainCenter = [
          plankCenter[0] + roofR[0] * grainOffsetR,
          plankCenter[1] + roofR[1] * grainOffsetR,
          plankCenter[2] + roofR[2] * grainOffsetR
        ];
        addBox(grainCenter, 0.008, plankThick * 1.1, plankLen * 0.85, [rCol * 0.6, gCol * 0.6, bCol * 0.6], roofR, normSlope, dirSlope, vertices, colors, indices);
      }

      // 3) Peak ridge cap / beam at the top of the visible slope (vMaxEff)
      addBox(ridgePos, w, 0.024, 0.024, [rCol * 0.78, gCol * 0.78, bCol * 0.78], roofR, n, roofF, vertices, colors, indices);

      // 4) Bottom eave fascia board at the bottom of the visible slope (vMinEff)
      addBox(eavePos, w, 0.020, 0.024, [rCol * 0.75, gCol * 0.75, bCol * 0.75], roofR, n, roofF, vertices, colors, indices);
    }
  }
};
