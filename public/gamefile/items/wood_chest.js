// === SEEDPLANET MODULE: JS/ITEMS/WOOD_CHEST.JS ===

(function() {
  window.ItemRegistry = window.ItemRegistry || {};

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
      [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd],
      [-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]
    ];
    const cubeIndices = [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      2, 3, 7, 2, 7, 6,
      0, 7, 3, 0, 4, 7,
      1, 2, 6, 1, 6, 5
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

  window.ItemRegistry["wood_chest"] = {
    render: function(item, vertices, colors, indices, targetBuffer) {
      const boxFunc = (typeof window !== "undefined" && typeof window.addBox === "function" && window.addBox !== drawBoxFallback)
        ? window.addBox
        : (typeof addBox === "function" ? addBox : drawBoxFallback);

      const p = item.position;
      const r = item.R || [1,0,0], f = item.F || [0,0,1], n = item.normal || [0,1,0];
      const isPreview = item.isPreview;
      const isValid = item.isValidPlacement !== false;
      const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

      const cs = 0.45; // chest scale factor
      // 1) Base Box
      const basePos = [
        p[0] + n[0] * (0.065 * cs),
        p[1] + n[1] * (0.065 * cs),
        p[2] + n[2] * (0.065 * cs)
      ];
      const baseColor = isPreview ? previewColor : [0.45, 0.3, 0.15];
      boxFunc(basePos, 0.24 * cs, 0.13 * cs, 0.18 * cs, baseColor, r, n, f, vertices, colors, indices);

      // 2) Lid Box
      const lidPos = [
        p[0] + n[0] * (0.16 * cs),
        p[1] + n[1] * (0.16 * cs),
        p[2] + n[2] * (0.16 * cs)
      ];
      const lidColor = isPreview ? previewColor : [0.38, 0.24, 0.12];
      boxFunc(lidPos, 0.25 * cs, 0.06 * cs, 0.19 * cs, lidColor, r, n, f, vertices, colors, indices);

      // 3) Front Clasp / Lock
      const lockPos = [
        p[0] + n[0] * (0.13 * cs) + f[0] * (0.103 * cs),
        p[1] + n[1] * (0.13 * cs) + f[1] * (0.103 * cs),
        p[2] + n[2] * (0.13 * cs) + f[2] * (0.103 * cs)
      ];
      const lockColor = isPreview ? previewColor : [0.85, 0.7, 0.25];
      boxFunc(lockPos, 0.04 * cs, 0.04 * cs, 0.016 * cs, lockColor, r, n, f, vertices, colors, indices);
    }
  };
})();

