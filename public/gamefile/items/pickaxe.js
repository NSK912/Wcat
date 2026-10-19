// === SEEDPLANET MODULE: JS/ITEMS/PICKAXE.JS ===

window.ItemRegistry["pickaxe"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    // Pickaxe model
    const s = item.size;
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

    const thickness = s * 0.12;
    const length = s * 1.5;
    const elevation = thickness * 0.6;
    const center = [
      p[0] + n[0] * elevation,
      p[1] + n[1] * elevation,
      p[2] + n[2] * elevation,
    ];

    const handleStart = [
      center[0] - dirX * length * 0.5,
      center[1] - dirY * length * 0.5,
      center[2] - dirZ * length * 0.5,
    ];
    const handleEnd = [
      center[0] + dirX * length * 0.5,
      center[1] + dirY * length * 0.5,
      center[2] + dirZ * length * 0.5,
    ];
    const handleColor = [0.4, 0.25, 0.15]; // brown wood
    buildTaperedSegment(
      handleStart,
      handleEnd,
      thickness,
      thickness,
      5,
      handleColor,
      vertices,
      colors,
      indices
    );

    // Blade (Pickaxe has two sharp ends)
    const bladeColor = [0.6, 0.6, 0.6]; // grey stone/metal
    const bladeCenter = [
      handleEnd[0] - dirX * length * 0.15 + n[0] * (s * 0.1),
      handleEnd[1] - dirY * length * 0.15 + n[1] * (s * 0.1),
      handleEnd[2] - dirZ * length * 0.15 + n[2] * (s * 0.1),
    ];

    const bladeStart = [
      bladeCenter[0] - perpX * (s * 0.5),
      bladeCenter[1] - perpY * (s * 0.5),
      bladeCenter[2] - perpZ * (s * 0.5),
    ];

    const bladeEnd = [
      bladeCenter[0] + perpX * (s * 0.5),
      bladeCenter[1] + perpY * (s * 0.5),
      bladeCenter[2] + perpZ * (s * 0.5),
    ];

    // Render two halves of the blade tapering out from the center
    buildTaperedSegment(bladeCenter, bladeStart, thickness * 1.2, thickness * 0.1, 4, bladeColor, vertices, colors, indices);
    buildTaperedSegment(bladeCenter, bladeEnd, thickness * 1.2, thickness * 0.1, 4, bladeColor, vertices, colors, indices);
  }
};
