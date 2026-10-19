// === SEEDPLANET MODULE: JS/ITEMS/ELECTRIC_ENGINE.JS ===

window.drawElectricEngine = function(center, engWid, engHei, engLen, r, n, f, cMain, cDark, cAccent, gearColor, vertices, colors, indices) {
  if (typeof addBox !== "function") return;
  
  // Calculate relative scale multiplier based on standard length
  const s = engLen / 0.45; 

  // Main metal casing
  addBox(center, engWid, engHei, engLen, cMain, r, n, f, vertices, colors, indices);
  
  // Black side panels
  const sideCenter1 = [
    center[0] + r[0] * (engWid/2 + 0.01 * s),
    center[1] + r[1] * (engWid/2 + 0.01 * s),
    center[2] + r[2] * (engWid/2 + 0.01 * s)
  ];
  addBox(sideCenter1, 0.01 * s, engHei * 0.7, engLen * 0.8, cDark, r, n, f, vertices, colors, indices);
  
  const sideCenter2 = [
    center[0] - r[0] * (engWid/2 + 0.01 * s),
    center[1] - r[1] * (engWid/2 + 0.01 * s),
    center[2] - r[2] * (engWid/2 + 0.01 * s)
  ];
  addBox(sideCenter2, 0.01 * s, engHei * 0.7, engLen * 0.8, cDark, r, n, f, vertices, colors, indices);
  
  // Top battery/capacitor ridges
  for(let i = -2; i <= 2; i++) {
    const ridgeCenter = [
      center[0] + n[0] * (engHei/2 + 0.02 * s) + f[0] * (i * engLen * 0.15),
      center[1] + n[1] * (engHei/2 + 0.02 * s) + f[1] * (i * engLen * 0.15),
      center[2] + n[2] * (engHei/2 + 0.02 * s) + f[2] * (i * engLen * 0.15)
    ];
    addBox(ridgeCenter, engWid * 0.9, 0.04 * s, engLen * 0.05, cAccent, r, n, f, vertices, colors, indices);
  }
  
  // Front connector interface
  const frontCenter = [
    center[0] + f[0] * (engLen/2 + 0.02 * s),
    center[1] + f[1] * (engLen/2 + 0.02 * s),
    center[2] + f[2] * (engLen/2 + 0.02 * s)
  ];
  addBox(frontCenter, engWid * 0.5, engHei * 0.5, 0.04 * s, cDark, r, n, f, vertices, colors, indices);
  
  // Side gear/wheel made of intersecting boxes
  const gearCenter = [
    center[0] + r[0] * (engWid/2 + 0.06 * s),
    center[1] + r[1] * (engWid/2 + 0.06 * s),
    center[2] + r[2] * (engWid/2 + 0.06 * s)
  ];
  const gearRadius = engHei * 0.6;
  const gearThick = 0.06 * s;
  
  // Cross pieces to make an 8-sided star/gear
  addBox(gearCenter, gearThick, gearRadius, gearRadius, gearColor, r, n, f, vertices, colors, indices);
  
  const diagR = [r[0], r[1], r[2]];
  const diagN = [
    n[0] * 0.707 - f[0] * 0.707,
    n[1] * 0.707 - f[1] * 0.707,
    n[2] * 0.707 - f[2] * 0.707
  ];
  const diagF = [
    n[0] * 0.707 + f[0] * 0.707,
    n[1] * 0.707 + f[1] * 0.707,
    n[2] * 0.707 + f[2] * 0.707
  ];
  addBox(gearCenter, gearThick, gearRadius, gearRadius, gearColor, diagR, diagN, diagF, vertices, colors, indices);
};

window.ItemRegistry["electric_engine"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    
    const cMain = isPreview ? previewColor : [0.75, 0.75, 0.78];
    const cDark = isPreview ? previewColor : [0.2, 0.2, 0.22];
    const cAccent = isPreview ? previewColor : [0.85, 0.85, 0.85];
    const gearColor = isPreview ? previewColor : [0.4, 0.4, 0.4];
    
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
      const bs = 0.4;
      const engScale = typeof window.electricEngineScaleMultiplier !== "number" ? 0.36 : window.electricEngineScaleMultiplier;
      const engLen = 0.3 * 1.5 * engScale;
      const engWid = 0.3 * 0.8 * engScale;
      const engHei = 0.3 * 0.8 * engScale;
      
      const upOff = typeof window.electricEngineUpOffset !== "number" ? 0.05 : window.electricEngineUpOffset;
      const fwdOff = typeof window.electricEngineFwdOffset !== "number" ? -0.11 : window.electricEngineFwdOffset;
      const engPitch = typeof window.electricEnginePitch !== "number" ? 0 : window.electricEnginePitch;
      const engYaw = typeof window.electricEngineYaw !== "number" ? 1.57 : window.electricEngineYaw;
      const engRoll = typeof window.electricEngineRoll !== "number" ? 0 : window.electricEngineRoll;
      
      const center = [
        p[0] + n[0] * upOff + f[0] * fwdOff,
        p[1] + n[1] * upOff + f[1] * fwdOff,
        p[2] + n[2] * upOff + f[2] * fwdOff
      ];

      let engR = [...r];
      let engN = [...n];
      let engF = [...f];

      if (engYaw !== 0) {
        const cy = Math.cos(engYaw); const sy = Math.sin(engYaw);
        const tempR = [engR[0]*cy - engF[0]*sy, engR[1]*cy - engF[1]*sy, engR[2]*cy - engF[2]*sy];
        const tempF = [engF[0]*cy + engR[0]*sy, engF[1]*cy + engR[1]*sy, engF[2]*cy + engR[2]*sy];
        engR = tempR; engF = tempF;
      }
      if (engPitch !== 0) {
        const cp = Math.cos(engPitch); const sp = Math.sin(engPitch);
        const tempF = [engF[0]*cp - engN[0]*sp, engF[1]*cp - engN[1]*sp, engF[2]*cp - engN[2]*sp];
        const tempN = [engN[0]*cp + engF[0]*sp, engN[1]*cp + engF[1]*sp, engN[2]*cp + engF[2]*sp];
        engF = tempF; engN = tempN;
      }
      if (engRoll !== 0) {
        const cr = Math.cos(engRoll); const sr = Math.sin(engRoll);
        const tempR = [engR[0]*cr - engN[0]*sr, engR[1]*cr - engN[1]*sr, engR[2]*cr - engN[2]*sr];
        const tempN = [engN[0]*cr + engR[0]*sr, engN[1]*cr + engR[1]*sr, engN[2]*cr + engR[2]*sr];
        engR = tempR; engN = tempN;
      }
      
      window.drawElectricEngine(center, engWid, engHei, engLen, engR, engN, engF, previewColor, previewColor, previewColor, previewColor, vertices, colors, indices);
      return;
    }

    const scale = item.size || 0.3;
    const engLen = scale * 1.5;
    const engWid = scale * 0.8;
    const engHei = scale * 0.8;
    
    const center = [
      p[0] + n[0] * (engHei / 2),
      p[1] + n[1] * (engHei / 2),
      p[2] + n[2] * (engHei / 2)
    ];

    window.drawElectricEngine(center, engWid, engHei, engLen, r, n, f, cMain, cDark, cAccent, gearColor, vertices, colors, indices);
  }
};
