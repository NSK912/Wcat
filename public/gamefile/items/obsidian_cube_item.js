// === SEEDPLANET MODULE: JS/ITEMS/OBSIDIAN_CUBE_ITEM.JS ===
window.ItemRegistry = window.ItemRegistry || {};
window.ItemRegistry["obsidian_cube_item"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    const p = item.position || [0, 0, 0];
    const itemR = item.R || [1, 0, 0];
    const itemF = item.F || [0, 0, 1];
    const itemN = item.normal || [0, 1, 0];
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    
    let overrideColors = null;
    if (isPreview) {
       overrideColors = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    }
    
    if (typeof window.buildObsidianCubeModel === "function") {
      window.buildObsidianCubeModel(
        item.seed || 1234,
        0,
        false,
        false,
        1.0,
        p,
        itemR, itemN, itemF,
        vertices, colors, indices,
        overrideColors,
        null,
        null
      );
    }
  }
};
