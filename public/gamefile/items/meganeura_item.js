// === SEEDPLANET MODULE: JS/ITEMS/MEGANEURA_ITEM.JS ===

window.ItemRegistry["meganeura_item"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const itemR = item.R || [1,0,0];
    const itemF = item.F || [0,0,1];
    const itemN = item.normal || [0,1,0];
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    
    let overrideColors = null;
    if (isPreview) {
       overrideColors = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    }
    
    buildMeganeuraModel(
      item.seed || 0, // seed
      0, // animPhase
      false, // isRagdoll
      false, // isSwimming
      1.5, // scaleMultiplier 
      p, // pos
      itemR, itemN, itemF, // R, N, F
      vertices, colors, indices,
      overrideColors
    );
  }
};
