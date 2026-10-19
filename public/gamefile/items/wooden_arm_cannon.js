// === SEEDPLANET MODULE: JS/ITEMS/WOODEN_ARM_CANNON.JS ===

window.ItemRegistry = window.ItemRegistry || {};

window.ItemRegistry["wooden_arm_cannon"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const f = item.F || [0, 0, 1];
    const r = item.R || [1, 0, 0];
    const n = item.normal || [0, 1, 0];
    const s = (typeof playerScale !== 'undefined' ? playerScale : 0.1) * 1.2;

    const woodColor = [0.55, 0.38, 0.22];
    const woodDark = [0.42, 0.28, 0.15];
    const ironColor = [0.28, 0.28, 0.30];
    const boreColor = [0.10, 0.10, 0.10];

    // Rear and front centers of the arm cannon
    const length = 0.24 * s;
    const pRear = [
      p[0] - f[0] * (length * 0.45) + n[0] * (0.04 * s),
      p[1] - f[1] * (length * 0.45) + n[1] * (0.04 * s),
      p[2] - f[2] * (length * 0.45) + n[2] * (0.04 * s)
    ];
    const pMid = [
      p[0] + n[0] * (0.04 * s),
      p[1] + n[1] * (0.04 * s),
      p[2] + n[2] * (0.04 * s)
    ];
    const pMuzzle = [
      p[0] + f[0] * (length * 0.55) + n[0] * (0.04 * s),
      p[1] + f[1] * (length * 0.55) + n[1] * (0.04 * s),
      p[2] + f[2] * (length * 0.55) + n[2] * (0.04 * s)
    ];

    // Wooden cannon main body (tapered low-poly cylinder)
    buildTaperedSegment(pRear, pMid, 0.042 * s, 0.038 * s, 6, woodColor, vertices, colors, indices);
    buildTaperedSegment(pMid, pMuzzle, 0.038 * s, 0.040 * s, 6, woodDark, vertices, colors, indices);

    // Iron bands
    const pRearBand = [
      pRear[0] + f[0] * 0.02 * s,
      pRear[1] + f[1] * 0.02 * s,
      pRear[2] + f[2] * 0.02 * s
    ];
    buildTaperedSegment(pRear, pRearBand, 0.045 * s, 0.045 * s, 6, ironColor, vertices, colors, indices);

    const pMidBand1 = [
      pMid[0] - f[0] * 0.012 * s,
      pMid[1] - f[1] * 0.012 * s,
      pMid[2] - f[2] * 0.012 * s
    ];
    const pMidBand2 = [
      pMid[0] + f[0] * 0.012 * s,
      pMid[1] + f[1] * 0.012 * s,
      pMid[2] + f[2] * 0.012 * s
    ];
    buildTaperedSegment(pMidBand1, pMidBand2, 0.041 * s, 0.041 * s, 6, ironColor, vertices, colors, indices);

    // Front muzzle collar and inner dark bore
    const pMuzzleRing = [
      pMuzzle[0] - f[0] * 0.015 * s,
      pMuzzle[1] - f[1] * 0.015 * s,
      pMuzzle[2] - f[2] * 0.015 * s
    ];
    buildTaperedSegment(pMuzzleRing, pMuzzle, 0.043 * s, 0.043 * s, 6, ironColor, vertices, colors, indices);

    const pBoreIn = [
      pMuzzle[0] - f[0] * 0.04 * s,
      pMuzzle[1] - f[1] * 0.04 * s,
      pMuzzle[2] - f[2] * 0.04 * s
    ];
    buildTaperedSegment(pBoreIn, pMuzzle, 0.024 * s, 0.026 * s, 6, boreColor, vertices, colors, indices);
  }
};
