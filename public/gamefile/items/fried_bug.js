// === SEEDPLANET MODULE: JS/ITEMS/FRIED_BUG.JS ===

window.buildFriedBugModel = function(
  seed,
  scaleMultiplier,
  offset,
  r, n, f,
  rawVertices, rawColors, rawIndices
) {
  const crispyCol1 = [0.45, 0.25, 0.08]; // Dark golden brown
  const crispyCol2 = [0.30, 0.15, 0.05]; // Dark brown
  const crispyCol3 = [0.60, 0.35, 0.10]; // Light crispy
  
  const S = scaleMultiplier;
  const ox = offset[0];
  const oy = offset[1];
  const oz = offset[2];

  function _addBox(c, w, h, d, color) {
    addBox([c[0]*S+ox, c[1]*S+oy, c[2]*S+oz], w*S, h*S, d*S, color, r, n, f, rawVertices, rawColors, rawIndices);
  }

  // Head
  _addBox([0, 0.05, 0.2], 0.08, 0.08, 0.08, crispyCol2);
  // Eyes
  _addBox([-0.05, 0.06, 0.22], 0.05, 0.05, 0.05, crispyCol3);
  _addBox([0.05, 0.06, 0.22], 0.05, 0.05, 0.05, crispyCol3);
  
  // Thorax
  _addBox([0, 0.02, 0.1], 0.1, 0.1, 0.15, crispyCol1);
  
  // Abdomen (Long tail)
  _addBox([0, 0, -0.1], 0.05, 0.05, 0.15, crispyCol2);
  _addBox([0, -0.01, -0.25], 0.04, 0.04, 0.15, crispyCol1);
  _addBox([0, -0.02, -0.4], 0.03, 0.03, 0.15, crispyCol2);
  
  // Leg parts extending up to look like fried insect legs
  _addBox([-0.1, 0.1, 0.1], 0.08, 0.02, 0.02, crispyCol2);
  _addBox([0.1, 0.1, 0.1], 0.08, 0.02, 0.02, crispyCol2);
  _addBox([-0.08, 0.08, -0.05], 0.08, 0.02, 0.02, crispyCol3);
  _addBox([0.08, 0.08, -0.05], 0.08, 0.02, 0.02, crispyCol3);
};

// Also export as a global function directly
window.buildFriedBugModel = window.buildFriedBugModel;
