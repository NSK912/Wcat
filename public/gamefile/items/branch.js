// === SEEDPLANET MODULE: JS/ITEMS/BRANCH.JS ===

window.ItemRegistry["branch"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const bColor = item.color; // brown

    const p = item.position;
    const r = item.R,
      f = item.F,
      n = item.normal;
    const s = item.size;

    const thickness = s * 0.12;
    const length = s * 0.8;

    const rotAngle = item.seed % (Math.PI * 2);
    const cosA = Math.cos(rotAngle);
    const sinA = Math.sin(rotAngle);

    // Direction of the branch on the surface
    const dirX = r[0] * cosA + f[0] * sinA;
    const dirY = r[1] * cosA + f[1] * sinA;
    const dirZ = r[2] * cosA + f[2] * sinA;

    // Slight elevation so it rests nicely on the ground
    const elevation = thickness * 0.6;
    const center = [
      p[0] + n[0] * elevation,
      p[1] + n[1] * elevation,
      p[2] + n[2] * elevation,
    ];

    const pStart = [
      center[0] - dirX * length,
      center[1] - dirY * length,
      center[2] - dirZ * length,
    ];
    const pEnd = [
      center[0] + dirX * length,
      center[1] + dirY * length,
      center[2] + dirZ * length,
    ];

    buildTaperedSegment(
      pStart,
      pEnd,
      thickness,
      thickness * 0.5,
      5,
      bColor,
      vertices,
      colors,
      indices
    );
  }
};
