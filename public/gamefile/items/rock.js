// === SEEDPLANET MODULE: JS/ITEMS/ROCK.JS ===

window.ItemRegistry["rock"] = {
  render: function(item, vertices, colors, indices, targetBuffer) {
    let color = item.color;
    if (item.type === "iron_ore") color = [0.45, 0.22, 0.18];
    else if (item.type === "gold_ore") color = [0.85, 0.68, 0.12];
    else if (item.type === "glow_ore") color = [0.22, 0.95, 0.88];
    const rockPos = [
      item.position[0] - item.normal[0] * (item.size * 0.2),
      item.position[1] - item.normal[1] * (item.size * 0.2),
      item.position[2] - item.normal[2] * (item.size * 0.2),
    ];
    buildRockFormation(
      rockPos,
      item.type === "big_rock" ? item.size * 2.0 : item.size * 1.5,
      color,
      item.seed,
      vertices,
      colors,
      indices
    );
  }
};

window.ItemRegistry["big_rock"] = window.ItemRegistry["rock"];
window.ItemRegistry["iron_ore"] = window.ItemRegistry["rock"];
window.ItemRegistry["gold_ore"] = window.ItemRegistry["rock"];
window.ItemRegistry["glow_ore"] = window.ItemRegistry["rock"];
