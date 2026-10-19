(function() {
  const basePath = (function() {
    if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
      const src = document.currentScript.src.split('?')[0];
      return src.substring(0, src.lastIndexOf('/') + 1);
    }
    return '';
  })();

  const version = '1789149200000';

  if (!document.querySelector('link[href*="style.css"]')) {
    if (document.readyState === 'loading') {
      document.write(`<link rel="stylesheet" href="${basePath}style.css?v=${version}">`);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${basePath}style.css?v=${version}`;
      document.head.appendChild(link);
    }
  }

  const scripts = [
    // --- Seedian System & Localization ---
    'gamefile/gameplay/Seedian.js',
    'gamefile/gameplay/Language.js',
    'gamefile/gameplay/settings.js',

    // --- Audio System ---
    'gamefile/audio/audio.js',
    'gamefile/audio/wooden_wheels_sound.js',

    // --- Core Engine & Utilities ---
    'gamefile/Engine/utils.js',
    'gamefile/Engine/SpacesMap.js',
    'gamefile/Engine/terrain.js',
    'gamefile/Engine/SpatialGrid.js',
    'gamefile/Engine/collision.js',
    'gamefile/Engine/physics.js',
    'gamefile/Engine/camera.js',
    'gamefile/Engine/frustumCulling.js',
    'gamefile/Engine/gamepad.js',
    'gamefile/Engine/3d_ui.js',

    // --- Environment ---
    'gamefile/Environment/surface.js',
    'gamefile/Environment/tree.js',
    'gamefile/Environment/Grass.js',
    'gamefile/Environment/cave.js',
    'gamefile/Environment/water.js',
    'gamefile/Environment/ore.js',
    'gamefile/Environment/Clouds3D.js',
    'gamefile/Environment/UnderwaterPlants.js',

    // --- Gameplay Modules ---
    'gamefile/gameplay/compass.js',

    // --- Items ---
    'gamefile/items/collectibles.js',
    'gamefile/items/rock.js',
    'gamefile/items/branch.js',
    'gamefile/items/arrow.js',
    'gamefile/items/wooden_arm_cannon.js',
    'gamefile/items/stone_floor.js',
    'gamefile/items/wood_floor.js',
    'gamefile/items/wood_stairs.js',
    'gamefile/items/folding_ladder.js',
    'gamefile/items/wood_wall.js',
    'gamefile/items/wood_door.js',
    'gamefile/items/wood_roof.js',
    'gamefile/items/meganeura_item.js',
    'gamefile/items/isopod_item.js',
    'gamefile/items/wood_chest.js',
    'gamefile/items/campfire.js',
    'gamefile/items/wood_boat.js',
    'gamefile/items/wood_wheel.js',
    'gamefile/items/electric_engine.js',
    'gamefile/items/boat_wing.js',
    'gamefile/items/axe.js',
    'gamefile/items/pickaxe.js',
    'gamefile/items/shovel.js',
    'gamefile/items/robot_mk1.js',
    'gamefile/items/robot_stand.js',
    'gamefile/items/fried_bug.js',

    // --- NPCs ---
    'gamefile/npcs/meganeura.js',
    'gamefile/npcs/georgiacetus.js',
    'gamefile/npcs/placoderm.js',
    'gamefile/npcs/isopod.js',
    'gamefile/npcs/human.js',
    'gamefile/npcs/obsidian_cube.js',
    'gamefile/npcs/npc.js',

    // --- Gameplay Core & System ---
    'gamefile/gameplay/GLBLoader.js',
    'gamefile/gameplay/inventory.js',
    'gamefile/gameplay/player.js',
    'gamefile/gameplay/TheCube.js',
    'gamefile/gameplay/PlayerClones.js',
    'gamefile/gameplay/ui.js',
    'gamefile/Engine/renderer.js',
    'devgame.js',
    'gamefile/gameplay/savesgame.js',
    'gamefile/gameplay/Start.js'
  ];

  if (document.readyState === 'loading') {
    scripts.forEach(src => document.write(`<script src="${basePath}${src}?v=${version}"><\/script>`));
  } else {
    scripts.forEach(src => {
      const script = document.createElement('script');
      script.src = `${basePath}${src}?v=${version}`;
      script.async = false;
      document.body.appendChild(script);
    });
  }
})();
