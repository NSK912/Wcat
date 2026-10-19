// === SEEDPLANET MODULE: JS/ITEMS/SHOVEL.JS ===

window.ItemRegistry["shovel"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const s = item.size || 0.25;
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;

    const rotAngle = item.seed % (Math.PI * 2);
    const cosA = Math.cos(rotAngle);
    const sinA = Math.sin(rotAngle);

    const dirX = r[0] * cosA + f[0] * sinA;
    const dirY = r[1] * cosA + f[1] * sinA;
    const dirZ = r[2] * cosA + f[2] * sinA;

    const perpX = r[0] * -sinA + f[0] * cosA;
    const perpY = r[1] * -sinA + f[1] * cosA;
    const perpZ = r[2] * -sinA + f[2] * cosA;

    // Center elevation to float slightly above terrain
    const elevation = s * 0.05;
    const center = [
      p[0] + n[0] * elevation,
      p[1] + n[1] * elevation,
      p[2] + n[2] * elevation,
    ];

    // Helper to map a relative coordinate to a world point
    const getPoint = (dOffset, pOffset, nOffset) => {
      return [
        center[0] + dirX * dOffset * s + perpX * pOffset * s + n[0] * nOffset * s,
        center[1] + dirY * dOffset * s + perpY * pOffset * s + n[1] * nOffset * s,
        center[2] + dirZ * dOffset * s + perpZ * pOffset * s + n[2] * nOffset * s,
      ];
    };

    // Shovel Handle: brown stick
    const handleStart = getPoint(-1.2, 0, 0);
    const handleEnd = getPoint(0.72, 0, 0);
    const handleColor = [0.4, 0.25, 0.15];
    buildTaperedSegment(handleStart, handleEnd, 0.08 * s, 0.08 * s, 5, handleColor, vertices, colors, indices);

    // Shovel Blade (scoop): silver gray
    const socketStart = getPoint(0.72, 0, 0);
    const socketEnd = getPoint(0.88, 0, 0);
    buildTaperedSegment(socketStart, socketEnd, 0.1 * s, 0.1 * s, 5, [0.55, 0.55, 0.55], vertices, colors, indices);

    const scoopStart = getPoint(0.88, 0, 0);
    const scoopEnd = getPoint(1.52, 0, 0);
    buildTaperedSegment(scoopStart, scoopEnd, 0.28 * s, 0.26 * s, 5, [0.65, 0.65, 0.65], vertices, colors, indices);

    const scoopTipStart = getPoint(1.52, 0, 0);
    const scoopTipEnd = getPoint(1.84, 0, 0);
    buildTaperedSegment(scoopTipStart, scoopTipEnd, 0.26 * s, 0.04 * s, 5, [0.6, 0.6, 0.6], vertices, colors, indices);

    // Shovel D-Handle at the back
    const partsColor = [0.25, 0.25, 0.25]; // Dark charcoal
    const stemStart = getPoint(-1.2, 0, 0);
    const stemEnd = getPoint(-1.4, 0, 0);
    buildTaperedSegment(stemStart, stemEnd, 0.08 * s, 0.08 * s, 5, partsColor, vertices, colors, indices);

    const leftLoopStart = getPoint(-1.4, 0, 0);
    const leftLoopEnd = getPoint(-1.68, -0.2, 0);
    buildTaperedSegment(leftLoopStart, leftLoopEnd, 0.06 * s, 0.06 * s, 4, partsColor, vertices, colors, indices);

    const rightLoopStart = getPoint(-1.4, 0, 0);
    const rightLoopEnd = getPoint(-1.68, 0.2, 0);
    buildTaperedSegment(rightLoopStart, rightLoopEnd, 0.06 * s, 0.06 * s, 4, partsColor, vertices, colors, indices);

    const gripStart = getPoint(-1.68, -0.2, 0);
    const gripEnd = getPoint(-1.68, 0.2, 0);
    buildTaperedSegment(gripStart, gripEnd, 0.064 * s, 0.064 * s, 5, partsColor, vertices, colors, indices);
  }
};
