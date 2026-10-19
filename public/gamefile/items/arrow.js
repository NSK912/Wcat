// === SEEDPLANET MODULE: JS/ITEMS/ARROW.JS ===

window.ItemRegistry["arrow"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const f = item.F;
    const s = typeof playerScale !== 'undefined' ? playerScale : 0.1;
    
    const shaftColor = [0.55, 0.4, 0.25];
    const flintColor = [0.35, 0.35, 0.35];
    const featherColor = [0.9, 0.2, 0.2];
    
    const L = 1.12 * s; // total length of the arrow
    const hL = L / 2.0;
    
    const pNock = [
      p[0] - f[0] * hL,
      p[1] - f[1] * hL,
      p[2] - f[2] * hL
    ];
    const pTipBase = [
      p[0] + f[0] * hL,
      p[1] + f[1] * hL,
      p[2] + f[2] * hL
    ];
    const pFeatherEnd = [
      pNock[0] + f[0] * 0.05 * s,
      pNock[1] + f[1] * 0.05 * s,
      pNock[2] + f[2] * 0.05 * s
    ];
    const pTipEnd = [
      pTipBase[0] + f[0] * 0.04 * s,
      pTipBase[1] + f[1] * 0.04 * s,
      pTipBase[2] + f[2] * 0.04 * s
    ];

    const th = 0.005 * s;

    // Shaft
    buildTaperedSegment(pNock, pTipBase, th, th, 4, shaftColor, vertices, colors, indices);
    // Feathers
    buildTaperedSegment(pNock, pFeatherEnd, 0.015 * s, 0.006 * s, 4, featherColor, vertices, colors, indices);
    // Tip
    buildTaperedSegment(pTipBase, pTipEnd, 0.012 * s, 0.001 * s, 4, flintColor, vertices, colors, indices);
  }
};
