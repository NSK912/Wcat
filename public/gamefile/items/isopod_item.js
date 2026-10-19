// === SEEDPLANET MODULE: JS/ITEMS/ISOPOD_ITEM.JS ===
window.ItemRegistry["isopod_item"] = {
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
    
    if (typeof window.buildIsopodModel === "function") {
      window.buildIsopodModel(
        item.seed || 1234,
        0,
        false,
        false,
        1.1,
        p,
        itemR, itemN, itemF,
        vertices, colors, indices,
        null,
        null,
        null
      );
    }
  }
};
