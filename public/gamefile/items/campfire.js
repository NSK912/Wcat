// === SEEDPLANET MODULE: JS/ITEMS/CAMPFIRE.JS ===

window.ItemRegistry["campfire"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R, f = item.F, n = item.normal;
    const s = item.size || 1.0;
    
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    
    // If it is a preview, color the whole thing
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];

    const seedVal = item.seed || (p[0] * 123.4 + p[2] * 56.7);
    function pRand(sd) {
      const x = Math.sin(sd) * 10000;
      return x - Math.floor(x);
    }
    
    // 1) Ring of Rocks
    const numRocks = 8;
    const rockRadius = 0.15 * s;
    for (let i = 0; i < numRocks; i++) {
      const angle = (i / numRocks) * Math.PI * 2;
      
      const rockPos = [
        p[0] + (r[0] * Math.cos(angle) + f[0] * Math.sin(angle)) * rockRadius,
        p[1] + (r[1] * Math.cos(angle) + f[1] * Math.sin(angle)) * rockRadius,
        p[2] + (r[2] * Math.cos(angle) + f[2] * Math.sin(angle)) * rockRadius,
      ];
      
      const pNoise = pRand(seedVal + i * 11);
      const rockSize = (0.03 + pNoise * 0.03) * s;
      const rockColor = isPreview ? previewColor : [0.4 + pNoise*0.1, 0.4 + pNoise*0.1, 0.4 + pNoise*0.1];
      
      addBox(rockPos, rockSize, rockSize, rockSize, rockColor, r, n, f, vertices, colors, indices);
    }
    
    // 2) Crossed Logs
    const numLogs = 4;
    const logLen = 0.25 * s;
    const logW = 0.03 * s;
    for (let i = 0; i < numLogs; i++) {
      const angle = (i / numLogs) * Math.PI + pRand(seedVal + i * 22) * 0.5;
      const r_dir = [
        r[0] * Math.cos(angle) + f[0] * Math.sin(angle),
        r[1] * Math.cos(angle) + f[1] * Math.sin(angle),
        r[2] * Math.cos(angle) + f[2] * Math.sin(angle)
      ];
      const f_dir = [
        -r[0] * Math.sin(angle) + f[0] * Math.cos(angle),
        -r[1] * Math.sin(angle) + f[1] * Math.cos(angle),
        -r[2] * Math.sin(angle) + f[2] * Math.cos(angle)
      ];
      
      const logPos = [
        p[0] + n[0] * 0.02 * s,
        p[1] + n[1] * 0.02 * s,
        p[2] + n[2] * 0.02 * s
      ];
      const logColor = isPreview ? previewColor : [0.45, 0.3, 0.15];
      addBox(logPos, logLen, logW, logW, logColor, r_dir, n, f_dir, vertices, colors, indices);
    }
  }
};
