// === SEEDPLANET MODULE: JS/NPC.JS ===

// Global NPC Registry
window.NpcRegistry = window.NpcRegistry || {};

// ==========================================
// Multi-Planet AI Life-Cycle Ecosystem & Dialogue System
// ==========================================
(function() {
  const TRIBAL_NAMES = [
    "Kaelen", "Elora", "Taran", "Sari", "Rolan", "Lyra", "Vael", "Thorne",
    "Boran", "Zephyr", "Aria", "Daren", "Mira", "Orin", "Kael", "Nyra"
  ];

  const TRIBAL_ROLES = [
    { title: "นักล่าพสุธา (Earth Hunter)", icon: "🏹", prefSchedule: "FORAGING" },
    { title: "ผู้เก็บเกี่ยวสมุนไพร (Herb Gatherer)", icon: "🌿", prefSchedule: "FORAGING" },
    { title: "ช่างสร้างและงานไม้ (Wood Craftsman)", icon: "🔨", prefSchedule: "WANDERING" },
    { title: "ผู้พิทักษ์เผ่า (Tribe Guardian)", icon: "🛡️", prefSchedule: "WANDERING" },
    { title: "นักสำรวจถ้ำ (Cave Explorer)", icon: "🧭", prefSchedule: "WANDERING" },
    { title: "ผู้ดูแลแคมป์ไฟ (Fire Keeper)", icon: "🔥", prefSchedule: "COOKING" }
  ];

  function getHumanNpcName(seed = 0) {
    const idx = Math.floor(Math.abs(Math.sin(seed * 999.123)) * TRIBAL_NAMES.length) % TRIBAL_NAMES.length;
    return TRIBAL_NAMES[idx];
  }

  function getHumanNpcRole(seed = 0) {
    const idx = Math.floor(Math.abs(Math.sin(seed * 444.789)) * TRIBAL_ROLES.length) % TRIBAL_ROLES.length;
    return TRIBAL_ROLES[idx];
  }

  // --- Planetary Biome Species Definition for the 5 Extra Planets ---
  const EXTRA_PLANET_SPECIES_DEFS = [
    {
      biomeName: "ทุ่งน้ำแข็งเยือกแข็ง (Glacial Tundra)",
      species: [
        { type: "cryo_isopod", name: "ไอโซพอดน้ำแข็ง (Cryo Isopod)", icon: "❄️", speed: 0.04 },
        { type: "arctic_meganeura", name: "แมลงปอหิมะ (Frost Meganeura)", icon: "🧊", speed: 0.12 },
        { type: "ice_stalker", name: "สิ่งมีชีวิตขั้วโลก (Polar Stalker)", icon: "🐺", speed: 0.08 }
      ]
    },
    {
      biomeName: "ธารลาวาอัคนี (Volcanic Molten)",
      species: [
        { type: "magma_beetle", name: "ด้วงลาวาเกราะหนา (Magma Beetle)", icon: "🔥", speed: 0.05 },
        { type: "pyro_lizard", name: "กิ้งก่าเพลิงใต้พิภพ (Pyro Salamander)", icon: "🦎", speed: 0.09 },
        { type: "ash_strider", name: "ผู้ท่องเถ้าภูเขาไฟ (Ash Strider)", icon: "🌋", speed: 0.06 }
      ]
    },
    {
      biomeName: "ทะเลทรายทองคำ (Golden Dunes)",
      species: [
        { type: "dune_isopod", name: "ไอโซพอดทราย (Dune Scarab)", icon: "🦂", speed: 0.05 },
        { type: "desert_wanderer", name: "ผู้พเนจรแห่งผืนทราย (Nomad Strider)", icon: "🐪", speed: 0.07 },
        { type: "mirage_flyer", name: "วิหคมายาสีทราย (Mirage Flyer)", icon: "🦅", speed: 0.14 }
      ]
    },
    {
      biomeName: "มหาสมุทรดึกดำบรรพ์ (Primordial Ocean)",
      species: [
        { type: "abyssal_placoderm", name: "พลาโคเดิร์มน้ำลึก (Abyssal Placoderm)", icon: "🐟", speed: 0.18 },
        { type: "deep_georgiacetus", name: "จอร์เจียซีตัสทะเลลึก (Deep Georgiacetus)", icon: "🐋", speed: 0.22 },
        { type: "luminescent_jelly", name: "แมงกะพรุนเรืองแสง (Bio Jelly)", icon: "🪼", speed: 0.08 }
      ]
    },
    {
      biomeName: "ป่าเอเลี่ยนสปอร์ (Bioluminescent Xenoflora)",
      species: [
        { type: "spore_mantis", name: "ตั๊กแตนสปอร์เรืองแสง (Spore Mantis)", icon: "🦗", speed: 0.09 },
        { type: "xenomorph_isopod", name: "ไอโซพอดต่างดาว (Xeno Crawler)", icon: "👽", speed: 0.06 },
        { type: "nebula_moth", name: "ผีเสื้อเนบิวลา (Nebula Moth)", icon: "🦋", speed: 0.15 }
      ]
    }
  ];

  const ExtraPlanetsEcosystem = {
    planets: [],
    tickAccumulator: 0,
    initialized: false,

    init: function(seed = 12345) {
      this.planets = [];
      for (let pIdx = 0; pIdx < 5; pIdx++) {
        const def = EXTRA_PLANET_SPECIES_DEFS[pIdx % EXTRA_PLANET_SPECIES_DEFS.length];
        const planetSeed = seed + (pIdx + 1) * 7777;
        const popCount = 10 + Math.floor(Math.abs(Math.sin(planetSeed)) * 6); // 10-15 creatures
        const inhabitants = [];

        for (let i = 0; i < popCount; i++) {
          const specIdx = i % def.species.length;
          const spec = def.species[specIdx];
          const cSeed = planetSeed + i * 123;
          inhabitants.push({
            id: `p${pIdx}_npc_${i}`,
            type: spec.type,
            name: spec.name,
            icon: spec.icon,
            theta: Math.abs(Math.sin(cSeed * 1.7)) * Math.PI,
            phi: (Math.abs(Math.cos(cSeed * 2.3)) * Math.PI * 2),
            heading: Math.abs(Math.sin(cSeed * 3.1)) * Math.PI * 2,
            speed: spec.speed,
            energy: 60 + Math.floor(Math.abs(Math.sin(cSeed * 4.9)) * 40),
            hunger: 20 + Math.floor(Math.abs(Math.cos(cSeed * 5.7)) * 40),
            schedule: (i % 3 === 0) ? "FORAGING" : (i % 3 === 1 ? "WANDERING" : "RESTING"),
            scheduleTimer: 10 + (cSeed % 20),
          });
        }

        this.planets.push({
          planetIndex: pIdx,
          biomeName: def.biomeName,
          populationCount: popCount,
          speciesList: def.species,
          inhabitants: inhabitants,
          lastActivitySummary: "ประชากรกำลังออกหากินและปรับตัวตามสภาพแวดล้อม"
        });
      }
      this.initialized = true;
      console.log("🌌 ExtraPlanetsEcosystem: จำลองระบบนิเวศ 5 ดาวเคราะห์เสร็จสมบูรณ์ (AI Life-Cycle Background Active)");
    },

    tick: function(deltaTime) {
      if (!this.initialized || !this.planets || this.planets.length === 0) return;

      this.tickAccumulator += deltaTime;
      // Tick every 3.0 seconds to keep CPU footprint near 0.001ms while maintaining living worlds
      if (this.tickAccumulator < 3.0) return;
      const stepDt = this.tickAccumulator;
      this.tickAccumulator = 0;

      for (let p of this.planets) {
        let foragingCount = 0;
        let restingCount = 0;
        let wanderingCount = 0;

        for (let creature of p.inhabitants) {
          creature.scheduleTimer -= stepDt;

          // Energy & Hunger dynamics
          if (creature.schedule === "RESTING") {
            creature.energy = Math.min(100, creature.energy + stepDt * 4.0);
            creature.hunger = Math.min(100, creature.hunger + stepDt * 0.4);
            restingCount++;
            if (creature.energy >= 90 || creature.scheduleTimer <= 0) {
              creature.schedule = creature.hunger > 60 ? "FORAGING" : "WANDERING";
              creature.scheduleTimer = 20 + Math.random() * 20;
            }
          } else if (creature.schedule === "FORAGING") {
            creature.energy = Math.max(0, creature.energy - stepDt * 0.6);
            creature.hunger = Math.max(0, creature.hunger - stepDt * 2.0);
            foragingCount++;
            if (creature.hunger <= 15 || creature.energy < 20 || creature.scheduleTimer <= 0) {
              creature.schedule = creature.energy < 20 ? "RESTING" : "WANDERING";
              creature.scheduleTimer = 20 + Math.random() * 20;
            }
          } else {
            // WANDERING / EXPLORING
            creature.energy = Math.max(0, creature.energy - stepDt * 0.8);
            creature.hunger = Math.min(100, creature.hunger + stepDt * 0.5);
            wanderingCount++;

            // Move across extra planet surface using spherical drift
            creature.heading += (Math.random() - 0.5) * 0.6;
            const dStep = creature.speed * stepDt * 0.15;
            creature.theta = Math.max(0.05, Math.min(Math.PI - 0.05, creature.theta + Math.cos(creature.heading) * dStep));
            creature.phi = (creature.phi + Math.sin(creature.heading) * dStep + Math.PI * 2) % (Math.PI * 2);

            if (creature.energy < 25) {
              creature.schedule = "RESTING";
              creature.scheduleTimer = 25 + Math.random() * 15;
            } else if (creature.hunger > 70) {
              creature.schedule = "FORAGING";
              creature.scheduleTimer = 25 + Math.random() * 15;
            }
          }
        }

        p.lastActivitySummary = `กำลังหากิน: ${foragingCount} | พักผ่อน: ${restingCount} | สำรวจ: ${wanderingCount}`;
      }
    },

    getPlanetReport: function(planetIdx) {
      if (!this.planets || !this.planets[planetIdx]) return null;
      return this.planets[planetIdx];
    },

    getAllPopulations: function() {
      return this.planets.map(p => ({
        index: p.planetIndex,
        biome: p.biomeName,
        population: p.populationCount,
        status: p.lastActivitySummary
      }));
    }
  };

  // Human NPC dialogue removed (not normal humans)
  const existingModal = document.getElementById("npc-dialogue-modal");
  if (existingModal) existingModal.remove();

  function showNpcDialogue() {}
  function hideNpcDialogue() {}
  function getNpcDialogue() { return null; }

  window.ExtraPlanetsEcosystem = ExtraPlanetsEcosystem;
  window.getHumanNpcName = getHumanNpcName;
  window.getHumanNpcRole = getHumanNpcRole;
  window.getNpcDialogue = getNpcDialogue;
  window.showNpcDialogue = showNpcDialogue;
  window.hideNpcDialogue = hideNpcDialogue;
})();

// Persistent reusable geometry arrays to eliminate GC garbage spikes completely
const _allNpcVertices = [];
const _allNpcColors = [];
const _allNpcIndices = [];

function calculatePlanetNpcCount(radius) {
  const r = typeof radius === 'number' ? radius : (typeof RADIUS !== 'undefined' ? RADIUS : 8.0);
  // Scales smoothly with sphere surface area:
  // r = 4  => 8 NPCs (minimum to ensure full species diversity + human group)
  // r = 6  => 11 NPCs
  // r = 8  => 16 NPCs (standard planet baseline)
  // r = 12 => 28 NPCs
  // r = 16 => 40 NPCs
  // r = 24 => 68 NPCs
  // r = 32 => max 72 NPCs (performance safe-guard)
  const ratio = Math.pow(r / 8.0, 1.35);
  return Math.min(72, Math.max(8, Math.round(16 * ratio)));
}
window.calculatePlanetNpcCount = calculatePlanetNpcCount;

function initAmphibians(count, seed) { 
  amphibians = []; 
  if (window.DISABLE_NPCS) return;

  // Initialize the 5-planet living background ecosystem
  if (window.ExtraPlanetsEcosystem && typeof window.ExtraPlanetsEcosystem.init === "function") {
    window.ExtraPlanetsEcosystem.init(seed);
  }

  const planetRadius = typeof RADIUS !== 'undefined' ? RADIUS : 8.0;
  if (!count || count <= 0) {
    count = calculatePlanetNpcCount(planetRadius);
  }

  const _origRandom = Math.random;
  Math.random = mulberry32(seed);

  amphibians = [];
  const effectiveWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
  const rRatio = Math.max(0.5, planetRadius / 8.0);

  function checkWaterAtCoord(theta, phi) {
    const h = getHeightOnSphere(theta, phi, seed);
    const gR = RADIUS + h * HEIGHT_SCALE;
    const wR = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 0) * 0.15;
    const isWater = (gR < wR - 0.015);
    return { height: h, gR, wR, isWater };
  }

  // Helper to find a suitable coordinate on the planet sphere
  function findSpawnCoordinate(preferType) {
    // preferType: 'water', 'land', or 'any'
    let bestTheta = Math.random() * Math.PI;
    let bestPhi = Math.random() * Math.PI * 2;
    let initialCheck = checkWaterAtCoord(bestTheta, bestPhi);
    let bestH = initialCheck.height;
    let bestIsLand = !initialCheck.isWater;

    if (preferType === 'any') {
      return { theta: bestTheta, phi: bestPhi, height: bestH, isLand: bestIsLand };
    }

    const wantLand = (preferType === 'land');
    if (bestIsLand === wantLand) {
      return { theta: bestTheta, phi: bestPhi, height: bestH, isLand: bestIsLand };
    }

    let deepestWaterTheta = bestTheta;
    let deepestWaterPhi = bestPhi;
    let deepestWaterH = bestH;
    let maxWaterDepth = -999;

    // Try up to 80 attempts to find desired terrain type
    for (let attempt = 0; attempt < 80; attempt++) {
      const t = Math.random() * Math.PI;
      const p = Math.random() * Math.PI * 2;
      const cCheck = checkWaterAtCoord(t, p);
      const isL = !cCheck.isWater;
      const depth = cCheck.wR - cCheck.gR;
      if (depth > maxWaterDepth) {
        maxWaterDepth = depth;
        deepestWaterTheta = t;
        deepestWaterPhi = p;
        deepestWaterH = cCheck.height;
      }
      if (isL === wantLand) {
        return { theta: t, phi: p, height: cCheck.height, isLand: isL };
      }
    }

    if (!wantLand) {
      return { theta: deepestWaterTheta, phi: deepestWaterPhi, height: deepestWaterH, isLand: (maxWaterDepth <= 0.015) };
    }

    return { theta: bestTheta, phi: bestPhi, height: bestH, isLand: bestIsLand };
  }

  function spawnNpcOfType(type) {
    if (amphibians.length >= count) return 0;

    // Human NPC is disabled from spawning completely (ปิดการใช้งานสปอน)
    if (type === 'human' || (window.NpcRegistry && window.NpcRegistry[type] && window.NpcRegistry[type].disabled)) {
      return 0;
    }

    // All other NPCs spawn in natural packs/flocks of 3-5 individuals (สปอนเป็นฝูง 3-5 ตัว)
    const remainingSlots = count - amphibians.length;
    if (remainingSlots <= 0) return 0;
    const desiredPack = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
    const packSize = Math.max(1, Math.min(desiredPack, remainingSlots));

    const isGeorgiacetus = (type === 'georgiacetus');
    const isPlacoderm = (type === 'placoderm');
    const isMeganeura = (type === 'meganeura');
    const isIsopod = (type === 'isopod');

    // Georgiacetus and Placoderm strictly prefer ocean water; Isopod/Meganeura can be anywhere
    const pref = (isGeorgiacetus || isPlacoderm) ? 'water' : 'any';
    const coord = findSpawnCoordinate(pref);

    const maxHp = (window.NpcRegistry && window.NpcRegistry[type]) ? window.NpcRegistry[type].maxHp : 1;
    const baseHeading = Math.random() * Math.PI * 2;

    for (let j = 0; j < packSize; j++) {
      let offsetTheta = coord.theta;
      let offsetPhi = coord.phi;
      if (j > 0) {
        if (isPlacoderm) {
          // Placoderms strictly require ocean water
          for (let tryOff = 0; tryOff < 25; tryOff++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = (0.015 + Math.random() * 0.04) / rRatio;
            const testT = coord.theta + Math.sin(angle) * dist;
            const testP = coord.phi + Math.cos(angle) * dist;
            const cCheck = checkWaterAtCoord(testT, testP);
            if (cCheck.isWater) {
              offsetTheta = testT;
              offsetPhi = testP;
              break;
            }
          }
        } else {
          // Naturally disperse flock/pack members around center coordinate
          const angle = Math.random() * Math.PI * 2;
          const dist = (0.015 + Math.random() * 0.04) / rRatio;
          offsetTheta += Math.sin(angle) * dist;
          offsetPhi += Math.cos(angle) * dist;
        }
      }

      let cCheck = checkWaterAtCoord(offsetTheta, offsetPhi);
      let oHeight = cCheck.height;
      let oIsLand = !cCheck.isWater;

      if (isPlacoderm && oIsLand) {
        const reCheck = checkWaterAtCoord(coord.theta, coord.phi);
        if (reCheck.isWater) {
          offsetTheta = coord.theta;
          offsetPhi = coord.phi;
          cCheck = reCheck;
          oHeight = reCheck.height;
          oIsLand = false;
        }
      }

      let spawnR;
      let swimming = false;

      if (isMeganeura) {
        // Swarm of dragonflies hovering together over land and water
        const surfaceR = Math.max(cCheck.gR, cCheck.wR);
        spawnR = surfaceR + 0.35 + Math.random() * 0.15;
        swimming = false;
      } else if (isIsopod) {
        // Colony of giant isopods crawling together on ground or seabed
        spawnR = cCheck.gR + 0.02;
        swimming = !oIsLand;
      } else if (isPlacoderm) {
        // Armored fish strictly swimming underwater
        spawnR = Math.max(cCheck.gR + 0.04, cCheck.wR - 0.04);
        swimming = true;
      } else if (isGeorgiacetus) {
        // Amphibious mammal swimming in water or crawling on land
        if (!oIsLand) {
          spawnR = Math.max(cCheck.gR + 0.04, cCheck.wR - 0.04);
          swimming = true;
        } else {
          spawnR = cCheck.gR + 0.05;
          swimming = false;
        }
      } else if (type === 'obsidian_cube') {
        // Cluster of floating gilded obsidian diamond cubes hovering gracefully
        const surfaceR = Math.max(cCheck.gR, cCheck.wR);
        spawnR = surfaceR + 1.25 + Math.random() * 0.35;
        swimming = false;
      } else {
        spawnR = Math.max(cCheck.gR, cCheck.wR) + 0.05;
        swimming = !oIsLand;
      }

      const aSeed = Math.random();
      amphibians.push({
        type: type,
        theta: offsetTheta,
        phi: offsetPhi,
        r: spawnR,
        heading: baseHeading + (Math.random() - 0.5) * 0.6,
        animPhase: Math.random() * Math.PI * 2,
        ragdollEnabled: false,
        ragdollInitialized: false,
        ragdollAxis: [0, 1, 0],
        ragdollAngle: 0,
        ragdollAngularSpeed: 0,
        isSwimming: swimming,
        seed: aSeed,
        hp: maxHp,
        maxHp: maxHp,
        energy: 70 + Math.random() * 30,
        hunger: 20 + Math.random() * 30,
        lifeSchedule: Math.random() < 0.5 ? 'FORAGING' : 'WANDERING',
        scheduleTimer: 15 + Math.random() * 25,
        lodLevel: 0,
      });
    }
    return packSize;
  }

  // 1. GUARANTEED PHASE: Ensure active known NPC types spawn in packs of 3-5 (human is excluded)
  const knownTypes = ['georgiacetus', 'placoderm', 'meganeura', 'isopod', 'obsidian_cube'];
  if (window.NpcRegistry) {
    for (const k in window.NpcRegistry) {
      if (k !== 'human' && !window.NpcRegistry[k].disabled && !knownTypes.includes(k)) {
        knownTypes.push(k);
      }
    }
  }

  // Spawn each registered species in a pack of 3-5
  for (const t of knownTypes) {
    if (amphibians.length < count) {
      spawnNpcOfType(t);
    }
  }

  // 2. PROPORTIONAL FILL PHASE:
  // Distribute remaining slots smoothly across species in packs of 3-5
  let typeIdx = 0;
  while (amphibians.length < count) {
    const t = knownTypes[typeIdx % knownTypes.length];
    spawnNpcOfType(t);
    typeIdx++;
  }

  Math.random = _origRandom;

  if (
    savedAmphibiansState &&
    savedAmphibiansState.length === amphibians.length
  ) {
    for (let i = 0; i < amphibians.length; i++) {
      if (amphibians[i].type !== 'human' && (savedAmphibiansState[i].type === amphibians[i].type || !savedAmphibiansState[i].type)) {
        Object.assign(amphibians[i], savedAmphibiansState[i]);
        if (amphibians[i].type === 'placoderm') {
          const sCheck = checkWaterAtCoord(amphibians[i].theta, amphibians[i].phi);
          if (!sCheck.isWater) {
            const wCoord = findSpawnCoordinate('water');
            amphibians[i].theta = wCoord.theta;
            amphibians[i].phi = wCoord.phi;
            amphibians[i].r = Math.max(RADIUS + wCoord.height * HEIGHT_SCALE + 0.04, RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 0) * 0.15 - 0.04);
            amphibians[i].isSwimming = true;
          }
        }
      }
      if (amphibians[i].hp === undefined) {
        const type = amphibians[i].type;
        const maxHp = window.NpcRegistry[type] ? window.NpcRegistry[type].maxHp : 1;
        amphibians[i].hp = maxHp;
        amphibians[i].maxHp = maxHp;
      }
    }
  }

  // Ensure no human NPCs are present in the active amphibians list
  amphibians = amphibians.filter(a => a.type !== 'human');
}

// === NPC Life-Cycle Simulation State Machine ===
// Simulates daily schedule, energy recovery, hunger and social behavior
function updateNpcLifeCycle(c, deltaTime, seed) {
  if (c.energy === undefined) c.energy = 80;
  if (c.hunger === undefined) c.hunger = 20;
  if (c.lifeSchedule === undefined) c.lifeSchedule = (c.type === 'human') ? 'WANDERING' : (Math.random() < 0.5 ? 'FORAGING' : 'WANDERING');
  if (c.scheduleTimer === undefined) c.scheduleTimer = 15 + Math.random() * 20;

  c.scheduleTimer -= deltaTime;

  // Check if human NPC is resting near a campfire
  let isNearCampfire = false;
  if (c.type === 'human' && typeof SpatialGrid !== "undefined" && SpatialGrid.queryRadius) {
    const nearby = SpatialGrid.queryRadius(c.position || [0, 0, 0], 2.5);
    if (nearby && nearby.some(it => it.type === 'campfire' || it.name === 'CAMPFIRE')) {
      isNearCampfire = true;
    }
  }

  if (isNearCampfire && c.lifeSchedule !== 'SLEEPING' && c.energy < 70) {
    c.lifeSchedule = 'COOKING';
  }

  switch (c.lifeSchedule) {
    case 'SLEEPING':
      c.energy = Math.min(100, c.energy + deltaTime * 4.0);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.25);
      c.walkBlend = Math.max(0, (c.walkBlend || 0) - deltaTime * 3.0);
      c.isIdle = true;
      if (c.energy >= 95 && c.scheduleTimer <= 0) {
        c.lifeSchedule = c.hunger > 60 ? 'FORAGING' : 'WANDERING';
        c.scheduleTimer = 25 + Math.random() * 20;
      }
      break;

    case 'RESTING':
      c.energy = Math.min(100, c.energy + deltaTime * 3.0);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.3);
      c.walkBlend = Math.max(0, (c.walkBlend || 0) - deltaTime * 2.0);
      c.isIdle = true;
      if (c.energy >= 85 && c.scheduleTimer <= 0) {
        c.lifeSchedule = c.hunger > 60 ? 'FORAGING' : 'WANDERING';
        c.scheduleTimer = 20 + Math.random() * 25;
      }
      break;

    case 'COOKING':
      c.energy = Math.min(100, c.energy + deltaTime * 1.5);
      c.hunger = Math.max(0, c.hunger - deltaTime * 2.5);
      c.walkBlend = Math.max(0, (c.walkBlend || 0) - deltaTime * 2.0);
      c.isIdle = true;
      if (c.hunger <= 10 || c.scheduleTimer <= 0) {
        c.lifeSchedule = 'WANDERING';
        c.scheduleTimer = 30 + Math.random() * 20;
      }
      break;

    case 'FORAGING':
      c.isIdle = false;
      c.walkBlend = Math.min(1.0, (c.walkBlend !== undefined ? c.walkBlend : 0.0) + deltaTime * 3.0);
      c.energy = Math.max(0, c.energy - deltaTime * 0.5);
      c.hunger = Math.max(0, c.hunger - deltaTime * 1.8);
      if (c.hunger <= 10) {
        c.lifeSchedule = 'WANDERING';
        c.scheduleTimer = 30 + Math.random() * 20;
      } else if (c.energy < 18) {
        c.lifeSchedule = 'RESTING';
        c.scheduleTimer = 20 + Math.random() * 15;
      }
      break;

    case 'SOCIALIZING':
      c.isIdle = false;
      c.walkBlend = Math.min(1.0, (c.walkBlend !== undefined ? c.walkBlend : 0.0) + deltaTime * 3.0);
      c.energy = Math.max(0, c.energy - deltaTime * 0.4);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.35);
      if (c.scheduleTimer <= 0) {
        c.lifeSchedule = 'WANDERING';
        c.scheduleTimer = 25 + Math.random() * 20;
      }
      break;

    case 'WANDERING':
    default:
      c.isIdle = false;
      c.walkBlend = Math.min(1.0, (c.walkBlend !== undefined ? c.walkBlend : 0.0) + deltaTime * 3.0);
      c.energy = Math.max(0, c.energy - deltaTime * 0.7);
      c.hunger = Math.min(100, c.hunger + deltaTime * 0.4);
      if (c.energy < 18) {
        c.lifeSchedule = 'RESTING';
        c.scheduleTimer = 25 + Math.random() * 15;
      } else if (c.hunger > 70) {
        c.lifeSchedule = 'FORAGING';
        c.scheduleTimer = 25 + Math.random() * 15;
      } else if (c.scheduleTimer <= 0) {
        if (c.type === 'human' && Math.random() < 0.3) {
          c.lifeSchedule = 'SOCIALIZING';
          c.scheduleTimer = 15 + Math.random() * 15;
        } else {
          c.lifeSchedule = Math.random() < 0.4 ? 'FORAGING' : 'WANDERING';
          c.scheduleTimer = 20 + Math.random() * 20;
        }
      }
      break;
  }
}

window.getNPCTransform = function(npc) {
  if (!npc) return null;
  const sinTheta = Math.sin(npc.theta || 0);
  const cosTheta = Math.cos(npc.theta || 0);
  const sinPhi = Math.sin(npc.phi || 0);
  const cosPhi = Math.cos(npc.phi || 0);
  const r = npc.r || (typeof RADIUS !== "undefined" ? RADIUS : 8.0);

  const naturalPos = [r * sinTheta * cosPhi, r * cosTheta, r * sinTheta * sinPhi];
  const pos = (npc.ragdollEnabled && npc.ragdollPos && Array.isArray(npc.ragdollPos) && npc.ragdollPos.length >= 3)
    ? npc.ragdollPos
    : naturalPos;

  let N = [sinTheta * cosPhi, cosTheta, sinTheta * sinPhi];
  const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
  const East = [-sinPhi, 0, cosPhi];

  const h_rad = (npc.heading !== undefined) ? npc.heading : 0;
  const sinH = Math.sin(h_rad);
  const cosH = Math.cos(h_rad);

  let F = [
    North[0] * cosH + East[0] * sinH,
    North[1] * cosH + East[1] * sinH,
    North[2] * cosH + East[2] * sinH,
  ];
  let R = [
    -North[0] * sinH + East[0] * cosH,
    -North[1] * sinH + East[1] * cosH,
    -North[2] * sinH + East[2] * cosH,
  ];

  if (npc.ragdollEnabled && npc.ragdollAxis && Array.isArray(npc.ragdollAxis) && npc.ragdollAxis.length >= 3) {
    const q = npc.ragdollAngle || 0;
    const cosQ = Math.cos(q);
    const sinQ = Math.sin(q);
    const ax = npc.ragdollAxis[0];
    const ay = npc.ragdollAxis[1];
    const az = npc.ragdollAxis[2];

    const rotateVector = (v) => {
      const dot = v[0] * ax + v[1] * ay + v[2] * az;
      const cross = [
        ay * v[2] - az * v[1],
        az * v[0] - ax * v[2],
        ax * v[1] - ay * v[0],
      ];
      return [
        v[0] * cosQ + cross[0] * sinQ + ax * dot * (1.0 - cosQ),
        v[1] * cosQ + cross[1] * sinQ + ay * dot * (1.0 - cosQ),
        v[2] * cosQ + cross[2] * sinQ + az * dot * (1.0 - cosQ),
      ];
    };

    N = rotateVector(N);
    F = rotateVector(F);
    R = rotateVector(R);
  }

  return { pos, N, F, R };
};

function updateAmphibians(deltaTime, seed) {
  if (!amphibians || amphibians.length === 0) return;

  // Background life simulation tick for the 5 extra planets
  if (window.ExtraPlanetsEcosystem && typeof window.ExtraPlanetsEcosystem.tick === "function") {
    window.ExtraPlanetsEcosystem.tick(deltaTime);
  }

  if (playerDamageCooldown > 0) {
    playerDamageCooldown -= deltaTime;
  }

  // Calculate player position in 3D space
  const sinT_player = Math.sin(charTheta);
  const cosT_player = Math.cos(charTheta);
  const sinP_player = Math.sin(charPhi);
  const cosP_player = Math.cos(charPhi);
  const player_nx = sinT_player * cosP_player;
  const player_ny = cosT_player;
  const player_nz = sinT_player * sinP_player;
  const player_h = getHeightOnSphere(charTheta, charPhi, seed);
  const player_r = RADIUS + player_h * HEIGHT_SCALE;
  const player_pos = [player_r * player_nx, player_r * player_ny, player_r * player_nz];

  const isRenderDistOn = (typeof renderDistEnabled !== "undefined"
    ? renderDistEnabled
    : (typeof window !== "undefined" && typeof window.renderDistEnabled !== "undefined" ? window.renderDistEnabled : true));
  const curObjectDist = typeof objectRenderDistValue !== "undefined"
    ? objectRenderDistValue
    : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
      ? window.objectRenderDistValue
      : (typeof renderDistValue !== "undefined" ? renderDistValue : 5.0));
  const refPos = (typeof eyePos !== "undefined" && eyePos && eyePos.length >= 3) ? eyePos : player_pos;
  const maxNpcDistSq = (curObjectDist + 0.6) * (curObjectDist + 0.6);

  // Clear reusable persistent arrays without creating new objects
  _allNpcVertices.length = 0;
  _allNpcColors.length = 0;
  _allNpcIndices.length = 0;

  for (let c of amphibians) {
    // Synchronize NPC 3D orientation basis every frame
    const tf = window.getNPCTransform(c);
    if (tf) {
      c.position = tf.pos;
      c.N = tf.N;
      c.F = tf.F;
      c.R = tf.R;
    }
    const npc_pos = c.position;

    const effPos = (c.ragdollEnabled && c.ragdollPos) ? c.ragdollPos : npc_pos;

    // Distance check to player/camera against object render distance
    const distNpcDx = refPos[0] - effPos[0];
    const distNpcDy = refPos[1] - effPos[1];
    const distNpcDz = refPos[2] - effPos[2];
    const distNpcSq = distNpcDx * distNpcDx + distNpcDy * distNpcDy + distNpcDz * distNpcDz;

    let shouldRender = true;
    let shouldAnimate = true;
    let lodLevel = 0;

    // AI Life-Cycle LOD Tiers:
    // LOD 0 (< 15m): Full skeletal animation, breathing sway, full audio attenuation, full 3D mesh
    // LOD 1 (15m - 35m): Normal skeletal animation, full 3D mesh, sound effects muted
    // LOD 2 (> 35m or outside render distance or frustum culled): 0 3D vertices, 0 mesh calculations,
    //                        simulation runs in lightweight numeric mode (energy, hunger, schedule, drift)
    if (distNpcSq < 225.0) { // 15m * 15m
      lodLevel = 0;
    } else if (distNpcSq < 1225.0 && (!isRenderDistOn || distNpcSq <= maxNpcDistSq)) { // 35m * 35m
      lodLevel = 1;
    } else {
      lodLevel = 2;
      shouldRender = false;
      shouldAnimate = false;
    }

    if (isRenderDistOn && distNpcSq > maxNpcDistSq) {
      shouldRender = false;
      shouldAnimate = false;
      lodLevel = 2;
    }

    if (shouldRender && typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && typeof frustumPlanes !== 'undefined' && frustumPlanes && typeof isSphereInFrustum === 'function') {
      if (!isSphereInFrustum(frustumPlanes, effPos, 2.0)) {
        shouldRender = false;
        lodLevel = 2;
      }
    }
    c.lodLevel = lodLevel;

    if (c.ragdollEnabled) {
      if (c.ragdollPos) {
        const dx = player_pos[0] - c.ragdollPos[0];
        const dy = player_pos[1] - c.ragdollPos[1];
        const dz = player_pos[2] - c.ragdollPos[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist > 5.0) {
          // Recycle dead NPC (ดึงโมเดลเก่ามาใช้ซ้ำ)
          let newTheta = Math.random() * Math.PI;
          let newPhi = Math.random() * Math.PI * 2;
          let newHeight = getHeightOnSphere(newTheta, newPhi, seed);

          if (c.type === 'human') {
            // Find an existing human to group with, or pick a random land spot
            let foundLeader = false;
            const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
            const rRatio = Math.max(0.5, (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) / 8.0);
            for (let other of amphibians) {
               if (other.type === 'human' && other !== c && !other.ragdollEnabled) {
                   if (Math.random() < 0.5) {
                       newTheta = other.theta + (Math.random() - 0.5) * (0.04 / rRatio);
                       newPhi = other.phi + (Math.random() - 0.5) * (0.04 / rRatio);
                       newHeight = getHeightOnSphere(newTheta, newPhi, seed);
                       if (newHeight * HEIGHT_SCALE > effWaterH) {
                           foundLeader = true;
                           break;
                       }
                   }
               }
            }
            
            if (!foundLeader) {
                for(let tries=0; tries<25; tries++) {
                   if (newHeight * HEIGHT_SCALE > effWaterH) break;
                   newTheta = Math.random() * Math.PI;
                   newPhi = Math.random() * Math.PI * 2;
                   newHeight = getHeightOnSphere(newTheta, newPhi, seed);
                }
            }
          } else if (c.type === 'georgiacetus' || c.type === 'placoderm') {
            // Prehistoric aquatic animals: try to find an ocean/water spot for respawn
            const wR = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 0) * 0.15;
            for (let tries = 0; tries < 50; tries++) {
              const testGR = RADIUS + newHeight * HEIGHT_SCALE;
              if (testGR < wR - 0.015) break;
              newTheta = Math.random() * Math.PI;
              newPhi = Math.random() * Math.PI * 2;
              newHeight = getHeightOnSphere(newTheta, newPhi, seed);
            }
          }

          const isMeganeura = c.type === 'meganeura';
          const isIsopod = c.type === 'isopod';
          const isGeorgiacetus = c.type === 'georgiacetus';
          const isPlacoderm = c.type === 'placoderm';
          const effWaterH = (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
          const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
          const wRadius = RADIUS + effWaterH;
          const isWater = (newHeight * HEIGHT_SCALE <= effWaterH);

          let newR = gRadius + 0.05;
          if (isMeganeura) {
            newR = Math.max(gRadius, wRadius) + 0.35 + Math.random() * 0.1;
          } else if (c.type === 'obsidian_cube') {
            newR = Math.max(gRadius, wRadius) + 1.25 + Math.random() * 0.3;
          } else if (isIsopod) {
            newR = gRadius + 0.02;
          } else if (isGeorgiacetus || isPlacoderm) {
            newR = isWater ? Math.max(gRadius, wRadius - 0.04) + 0.04 : gRadius + 0.05;
          } else if (c.type === 'human') {
            newR = Math.max(gRadius, wRadius) + 0.05;
          }

          const maxHp = (window.NpcRegistry && window.NpcRegistry[c.type]) ? window.NpcRegistry[c.type].maxHp : 1;
          
          c.theta = newTheta;
          c.phi = newPhi;
          c.r = newR;
          c.heading = Math.random() * Math.PI * 2;
          c.animPhase = Math.random() * Math.PI * 2;
          c.ragdollEnabled = false;
          c.ragdollInitialized = false;
          c.ragdollPos = null;
          c.ragdollVel = null;
          c.hp = maxHp;
          c.maxHp = maxHp;
          c.isSwimming = ((isGeorgiacetus || isPlacoderm) ? isWater : (isIsopod && isWater));
          
          // Remove arrows attached to this NPC
          for (let coll of collectibles) {
            if (coll.attachedToNPC === c) {
              coll.attachedToNPC = null;
              coll.active = false;
            }
          }
          pendingCollectibleRefresh = true;
          continue;
        }
      }

      let immersion = 0.0;
      let depth = -1.0;
      if (!c.ragdollInitialized) {
        const sinT = Math.sin(c.theta);
        const cosT = Math.cos(c.theta);
        const sinP = Math.sin(c.phi);
        const cosP = Math.cos(c.phi);
        const N_init = [sinT * cosP, cosT, sinT * sinP];
        c.ragdollPos = [
          N_init[0] * c.r,
          N_init[1] * c.r,
          N_init[2] * c.r,
        ];

        // Initial velocity when killed - set to zero (plus small random twitching) to prevent any upward bouncing or popping
        c.ragdollVel = [
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
          (Math.random() - 0.5) * 0.001,
        ];

        if (c.type === 'human') {
          // Human falls flat to ground (lying down naturally like a fallen NPC)
          const heading = c.heading || 0;
          const cosH = Math.cos(heading);
          const sinH = Math.sin(heading);
          const F_init = [-cosT * cosP, sinT, -cosT * sinP];
          const R_init = [sinP, 0, -cosP];
          const R_dir = [
            -F_init[0] * sinH + R_init[0] * cosH,
            -F_init[1] * sinH + R_init[1] * cosH,
            -F_init[2] * sinH + R_init[2] * cosH,
          ];
          const rLen = Math.sqrt(R_dir[0] ** 2 + R_dir[1] ** 2 + R_dir[2] ** 2) || 1;
          c.ragdollAxis = [R_dir[0] / rLen, R_dir[1] / rLen, R_dir[2] / rLen];
          c.ragdollAngle = (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.48);
          c.ragdollAngularSpeed = 0;
          const caveDataInit = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(N_init[0], N_init[1], N_init[2], c.r)
            : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(c.theta, c.phi, seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
          const groundR = caveDataInit.ground + 0.04;
          c.ragdollPos = [N_init[0] * groundR, N_init[1] * groundR, N_init[2] * groundR];
        } else {
          c.ragdollAxis = [
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          ];
          const len = Math.sqrt(
            c.ragdollAxis[0] ** 2 +
              c.ragdollAxis[1] ** 2 +
              c.ragdollAxis[2] ** 2,
          );
          c.ragdollAxis[0] /= len;
          c.ragdollAxis[1] /= len;
          c.ragdollAxis[2] /= len;
          c.ragdollAngle = 0;
          c.ragdollAngularSpeed = (Math.random() - 0.5) * 0.15;
        }

        // Initialize diedOnSurface for NPC
        const waterRadius = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
        const r_dist = Math.sqrt(
          c.ragdollPos[0] ** 2 +
            c.ragdollPos[1] ** 2 +
            c.ragdollPos[2] ** 2,
        );
        const initialDepth = waterRadius - r_dist;
        // If NPC dies while swimming in deep water (initialDepth >= 0.04), they will sink immediately (diedOnSurface = false)
        c.diedOnSurface =
          !waterEnabled || !c.isSwimming || initialDepth < 0.04;

        c.ragdollInitialized = true;
        c.ragdollAsleep = false;
        c.ragdollSleepFrames = 0;
      }

      if (!c.ragdollAsleep) {
        const dtScale = deltaTime / 0.016;
        if (!c.ragdollPos || !Array.isArray(c.ragdollPos) || c.ragdollPos.length < 3) {
          const sinT = Math.sin(c.theta);
          const cosT = Math.cos(c.theta);
          const sinP = Math.sin(c.phi);
          const cosP = Math.cos(c.phi);
          c.ragdollPos = [sinT * cosP * c.r, cosT * c.r, sinT * sinP * c.r];
        }
        const rp = c.ragdollPos;
        const r_dist = Math.sqrt(rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2);
      if (r_dist > 0.001) {
        const nx = rp[0] / r_dist;
        const ny = rp[1] / r_dist;
        const nz = rp[2] / r_dist;

        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, r_dist)
          : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, ny))), Math.atan2(nz, nx), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

        c.ragdollCaveData = caveData; // Save for vertex processing to avoid massive per-vertex terrain lookups

        // Use Physics engine
        Physics.applyGravity(c.ragdollVel, nx, ny, nz, dtScale, Physics.gravityAccel);

        // Friction
        const airFriction = Math.pow(0.98, dtScale);

        const waterRadius = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE * 0.25 : 0.15);
        const hRange = 0.05; // 5cm floating band
        if (waterEnabled && !caveData.insideTunnel) {
          immersion = Math.max(
            0.0,
            Math.min(
              1.0,
              (waterRadius + hRange - r_dist) / (2.0 * hRange),
            ),
          );
          depth = waterRadius - r_dist;
          if (depth < 0.04) {
            c.diedOnSurface = true;
          }
        } else {
          c.diedOnSurface = true;
        }

        const isNearSurface = c.diedOnSurface;
        // Smoothly interpolate friction based on immersion
        // Sinking underwater should have a lot more resistance/drag than floating at surface
        const waterFriction = isNearSurface
          ? Math.pow(0.85, dtScale)
          : Math.pow(0.78, dtScale);
        const friction =
          airFriction * (1.0 - immersion) + waterFriction * immersion;
        Physics.applyFriction(c.ragdollVel, friction);
        c.ragdollAngularSpeed *=
          airFriction * (1.0 - immersion) +
          Math.pow(isNearSurface ? 0.95 : 0.85, dtScale) * immersion;

        if (immersion > 0) {
          let buoyancyFactor = 0.0;
          if (depth > 0) {
            if (c.diedOnSurface) {
              // Near the surface: float!
              const targetSubmersion = 0.5; // Half submerged
              buoyancyFactor =
                immersion * (1.0 + (immersion - targetSubmersion) * 3.0);
              if (buoyancyFactor < 0.1) buoyancyFactor = 0.1;
            } else {
              // Deep underwater: sink slowly! (buoyancy close to gravity, e.g. 0.75 so it sinks very slowly)
              buoyancyFactor = 0.75 * immersion;
            }
          }
          Physics.applyBuoyancyForce(c.ragdollVel, nx, ny, nz, buoyancyFactor, dtScale, Physics.gravityAccel);

          // Gentle underwater drift and swaying to simulate fluid resistance/currents
          const driftPhase = Date.now() * 0.001 * 2.0 + (c.phi || 0);
          const driftAmp = 0.0004 * dtScale * immersion;
          let tx = -ny;
          let ty = nx;
          let tz = 0;
          const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
          if (tlen > 0.001) {
            tx /= tlen;
            ty /= tlen;
            c.ragdollVel[0] += tx * Math.sin(driftPhase) * driftAmp;
            c.ragdollVel[1] += ty * Math.sin(driftPhase) * driftAmp;
            c.ragdollVel[2] += tz * Math.sin(driftPhase) * driftAmp;
          }
          c.ragdollAngularSpeed +=
            Math.sin(driftPhase * 1.5) * 0.001 * dtScale * immersion;

          // Apply vertical damping to completely kill oscillations / jitter for floating bodies at surface
          if (c.diedOnSurface) {
            const v_radial =
              c.ragdollVel[0] * nx +
              c.ragdollVel[1] * ny +
              c.ragdollVel[2] * nz;
            const v_tx = c.ragdollVel[0] - nx * v_radial;
            const v_ty = c.ragdollVel[1] - ny * v_radial;
            const v_tz = c.ragdollVel[2] - nz * v_radial;

            // Reduce vertical speed when floating at surface
            const dampFactor = Math.pow(0.65, dtScale);
            const new_v_radial = v_radial * dampFactor;
            c.ragdollVel[0] = v_tx + nx * new_v_radial;
            c.ragdollVel[1] = v_ty + ny * new_v_radial;
            c.ragdollVel[2] = v_tz + nz * new_v_radial;
          }
        }
      }

      rp[0] += c.ragdollVel[0];
      rp[1] += c.ragdollVel[1];
      rp[2] += c.ragdollVel[2];

      c.ragdollAngle += c.ragdollAngularSpeed * dtScale;

      // Collide with terrain
      const distToCenter = Math.sqrt(
        rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2,
      );
      if (distToCenter > 0.001) {
        const ux = rp[0] / distToCenter;
        const uy = rp[1] / distToCenter;
        const uz = rp[2] / distToCenter;

        c.theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        c.phi = Math.atan2(uz, ux);
        c.r = distToCenter;

        // REUSE caveData (which is c.ragdollCaveData)
        const caveData = c.ragdollCaveData || { ground: RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        const surfaceRadius = caveData.ground;

        const colRadius = c.type === 'human' ? 0.04 : 0.15 * 0.5; // matching NPC model scale
        
        let target = distToCenter;
        let hitSolid = false;
        
        if (caveData.insideTunnel) {
          if (distToCenter < caveData.ground + colRadius) {
            target = caveData.ground + colRadius;
            hitSolid = true;
            const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
            if (v_radial < 0) {
                c.ragdollVel[0] -= ux * v_radial;
                c.ragdollVel[1] -= uy * v_radial;
                c.ragdollVel[2] -= uz * v_radial;
            }
          } else if (caveData.ceiling !== Infinity && distToCenter > caveData.ceiling - colRadius) {
            target = caveData.ceiling - colRadius;
            hitSolid = true;
            const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
            if (v_radial > 0) {
               c.ragdollVel[0] -= ux * v_radial;
               c.ragdollVel[1] -= uy * v_radial;
               c.ragdollVel[2] -= uz * v_radial;
            }
          }
        } else {
          if (distToCenter < surfaceRadius + colRadius) {
            // Only push up to the surface if we are within 0.5 units of it.
            // This prevents teleporting from deep underground caves to the surface.
            if (distToCenter > surfaceRadius - 0.5) {
              target = surfaceRadius + colRadius;
              hitSolid = true;
              const v_radial = c.ragdollVel[0] * ux + c.ragdollVel[1] * uy + c.ragdollVel[2] * uz;
              if (v_radial < 0) {
                  c.ragdollVel[0] -= ux * v_radial;
                  c.ragdollVel[1] -= uy * v_radial;
                  c.ragdollVel[2] -= uz * v_radial;
              }
            } else {
              // Deep underground, clipped through cave floor. Stop velocity to prevent falling forever.
              Physics.applyFriction(c.ragdollVel, 0.5);
            }
          }
        }

        if (hitSolid) {
          rp[0] = ux * target;
          rp[1] = uy * target;
          rp[2] = uz * target;
          c.r = target;

          // Ground friction
          Physics.applyFriction(c.ragdollVel, 0.7);
          c.ragdollAngularSpeed *= 0.7;

          // Ground normal estimation - cached to prevent 3 heavy FBM noise evaluations per frame!
          let snX, snY, snZ;
          if (!c.ragdollNormal || !c.ragdollNormalPos ||
              Math.hypot(rp[0] - c.ragdollNormalPos[0], rp[1] - c.ragdollNormalPos[1], rp[2] - c.ragdollNormalPos[2]) > 0.05) {

            const getT = (t, p) => {
              const rad =
                RADIUS + getHeightOnSphere(t, p, seed) * HEIGHT_SCALE;
              return [
                rad * Math.sin(t) * Math.cos(p),
                rad * Math.cos(t),
                rad * Math.sin(t) * Math.sin(p),
              ];
            };
            const p0 = getT(c.theta, c.phi);
            const p1 = getT(c.theta, c.phi + 0.02);
            const p2 = getT(c.theta - 0.02, c.phi);
            const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            let snX_calc = v1[1] * v2[2] - v1[2] * v2[1];
            let snY_calc = v1[2] * v2[0] - v1[0] * v2[2];
            let snZ_calc = v1[0] * v2[1] - v1[1] * v2[0];
            const snLen = Math.sqrt(snX_calc * snX_calc + snY_calc * snY_calc + snZ_calc * snZ_calc);
            if (snLen > 0.0001) {
              snX_calc /= snLen;
              snY_calc /= snLen;
              snZ_calc /= snLen;
              if (snX_calc * ux + snY_calc * uy + snZ_calc * uz < 0) {
                snX_calc = -snX_calc;
                snY_calc = -snY_calc;
                snZ_calc = -snZ_calc;
              }
            } else {
              snX_calc = ux;
              snY_calc = uy;
              snZ_calc = uz;
            }
            c.ragdollNormal = [snX_calc, snY_calc, snZ_calc];
            c.ragdollNormalPos = [rp[0], rp[1], rp[2]];
          }
          
          snX = c.ragdollNormal[0];
          snY = c.ragdollNormal[1];
          snZ = c.ragdollNormal[2];

          const bounciness = !c.diedOnSurface ? 0.0 : 0.1;
          const friction = !c.diedOnSurface ? 0.9 : 0.95;

          const dot = c.ragdollVel[0] * snX + c.ragdollVel[1] * snY + c.ragdollVel[2] * snZ;
          if (dot < 0) {
            const vnX = snX * dot;
            const vnY = snY * dot;
            const vnZ = snZ * dot;
            const vtX = c.ragdollVel[0] - vnX;
            const vtY = c.ragdollVel[1] - vnY;
            const vtZ = c.ragdollVel[2] - vnZ;
            
            Physics.resolveVelocityCollision(c.ragdollVel, snX, snY, snZ, bounciness, friction);
            
            const speedSq = vtX * vtX + vtY * vtY + vtZ * vtZ;
            if (speedSq > 0.00001) {
              const speed = Math.sqrt(speedSq);
              c.ragdollAngularSpeed = speed * 1.5;

              let cX = snY * vtZ - snZ * vtY;
              let cY = snZ * vtX - snX * vtZ;
              let cZ = snX * vtY - snY * vtX;
              const cLen = Math.sqrt(cX * cX + cY * cY + cZ * cZ);
              if (cLen > 0.0001) {
                c.ragdollAxis = [cX / cLen, cY / cLen, cZ / cLen];
              }
            } else {
              let normalizedAngle = Math.abs(c.ragdollAngle % Math.PI);
              if (
                normalizedAngle < (Math.PI / 2) * 0.8 ||
                normalizedAngle > Math.PI - (Math.PI / 2) * 0.8
              ) {
                c.ragdollAngularSpeed =
                  0.05 * Math.sign(c.ragdollAngularSpeed || 1);
              } else {
                c.ragdollAngularSpeed *= 0.5;
              }
            }
          }
        }
      }

      // Sleep check to put static ragdolls to rest and save 100% of their physics/collision CPU cost!
      const speedSq = c.ragdollVel[0]*c.ragdollVel[0] + c.ragdollVel[1]*c.ragdollVel[1] + c.ragdollVel[2]*c.ragdollVel[2];
      const angSpeed = Math.abs(c.ragdollAngularSpeed);
      if (speedSq < 0.000004 && angSpeed < 0.01) {
        c.ragdollSleepFrames = (c.ragdollSleepFrames || 0) + 1;
        if (c.ragdollSleepFrames > 15) {
          c.ragdollAsleep = true;
        }
      } else {
        c.ragdollSleepFrames = 0;
      }
      }
    } else {
      // Check distance to player and damage if close
      const dx = player_pos[0] - npc_pos[0];
      const dy = player_pos[1] - npc_pos[1];
      const dz = player_pos[2] - npc_pos[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      let pBoat = null;
      let pMech = null;
      try { pBoat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat); } catch(e) {}
      try { pMech = (typeof activeRidingMech !== "undefined" && activeRidingMech) || (typeof window !== "undefined" && window.activeRidingMech); } catch(e) {}
      const isDriving = !!(pBoat || pMech);
      const isPlayerDown = playerHP <= 0 || playerControlsLocked || (typeof ragdollEnabled !== "undefined" && ragdollEnabled);

      if (c.type === 'meganeura' && dist < 0.45 && !isPlayerDown && !isDriving && playerDamageCooldown <= 0) {
        damagePlayer(1);
      }

      // Update living NPC life-cycle state machine (Energy, Hunger, Daily Activities)
      updateNpcLifeCycle(c, deltaTime, seed);

      if (c.lodLevel === 2) {
        // Fast numeric off-screen drift - updates position without heavy 3D math
        if (!c.isIdle && c.lifeSchedule !== 'RESTING' && c.lifeSchedule !== 'SLEEPING') {
          const moveSpeed = (c.isSwimming ? 0.20 : 0.04) * deltaTime;
          c.heading += (Math.random() - 0.5) * 0.4 * deltaTime;
          const dTheta = Math.cos(c.heading) * (moveSpeed / (c.r || RADIUS));
          const dPhi = Math.sin(c.heading) * (moveSpeed / ((c.r || RADIUS) * Math.max(0.1, Math.sin(c.theta))));
          c.theta = Math.max(0.05, Math.min(Math.PI - 0.05, c.theta + dTheta));
          c.phi = (c.phi + dPhi + Math.PI * 2) % (Math.PI * 2);
        }
        continue; // Skip all heavy 3D mesh transformations, trigonometry, and audio raycasts!
      }

      c.ragdollInitialized = false;
      const npcRegConfig = window.NpcRegistry && window.NpcRegistry[c.type];
      const animSpeed = npcRegConfig && npcRegConfig.animSpeed !== undefined ? npcRegConfig.animSpeed : 4.0;
      let moveSpeedBase = (c.isSwimming ? 0.25 : 0.05);
      if (npcRegConfig && npcRegConfig.moveSpeed !== undefined) moveSpeedBase = npcRegConfig.moveSpeed;
      if (c.moveSpeed !== undefined) moveSpeedBase = c.moveSpeed;
      
      const walkBlend = c.walkBlend !== undefined ? c.walkBlend : (c.isIdle ? 0 : 1);
      moveSpeedBase *= walkBlend;
      
      const prevAnimPhase = c.animPhase;
      if (shouldAnimate) {
        c.animPhase += deltaTime * animSpeed * walkBlend;
      }
      const moveSpeed = moveSpeedBase * deltaTime;

      // Great-circle rotation to avoid polar coordinate singularities (walking around the center of the world)
      const sinT = Math.sin(c.theta);
      const cosT = Math.cos(c.theta);
      const sinP = Math.sin(c.phi);
      const cosP = Math.cos(c.phi);

      const North = [-cosT * cosP, sinT, -cosT * sinP];
      const East = [-sinP, 0, cosP];

      const V_move = [
        North[0] * Math.cos(c.heading) + East[0] * Math.sin(c.heading),
        North[1] * Math.cos(c.heading) + East[1] * Math.sin(c.heading),
        North[2] * Math.cos(c.heading) + East[2] * Math.sin(c.heading),
      ];

      const P_curr = [sinT * cosP, cosT, sinT * sinP];
      const speed = moveSpeed / c.r;

      let P_new = [
        P_curr[0] * Math.cos(speed) + V_move[0] * Math.sin(speed),
        P_curr[1] * Math.cos(speed) + V_move[1] * Math.sin(speed),
        P_curr[2] * Math.cos(speed) + V_move[2] * Math.sin(speed),
      ];

      const pLen = Math.sqrt(
        P_new[0] * P_new[0] + P_new[1] * P_new[1] + P_new[2] * P_new[2],
      );
      if (pLen > 0.0001) {
        P_new = [P_new[0] / pLen, P_new[1] / pLen, P_new[2] / pLen];
      }

      c.theta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
      c.theta = Math.max(1e-5, Math.min(Math.PI - 1e-5, c.theta));

      c.phi = Math.atan2(P_new[2], P_new[0]);
      if (c.phi < 0) c.phi += Math.PI * 2;

      // Parallel transport the heading angle to the new position
      const sinT_new = Math.sin(c.theta);
      const cosT_new = Math.cos(c.theta);
      const sinP_new = Math.sin(c.phi);
      const cosP_new = Math.cos(c.phi);

      const North_new = [
        -cosT_new * cosP_new,
        sinT_new,
        -cosT_new * sinP_new,
      ];
      const East_new = [-sinP_new, 0, cosP_new];

      const V_tangent = [
        -P_curr[0] * Math.sin(speed) + V_move[0] * Math.cos(speed),
        -P_curr[1] * Math.sin(speed) + V_move[1] * Math.cos(speed),
        -P_curr[2] * Math.sin(speed) + V_move[2] * Math.cos(speed),
      ];

      const f_comp =
        V_tangent[0] * North_new[0] +
        V_tangent[1] * North_new[1] +
        V_tangent[2] * North_new[2];
      const r_comp =
        V_tangent[0] * East_new[0] +
        V_tangent[1] * East_new[1] +
        V_tangent[2] * East_new[2];
      c.heading = Math.atan2(r_comp, f_comp);

      if (!c.isChasing && (!npcRegConfig || npcRegConfig.disableRandomJitter !== true)) {
        c.heading += (Math.random() - 0.5) * 1.0 * deltaTime;
      }

      const sinT_npc = Math.sin(c.theta);
      const cosT_npc = Math.cos(c.theta);
      const sinP_npc = Math.sin(c.phi);
      const cosP_npc = Math.cos(c.phi);
      const npc_nx = sinT_npc * cosP_npc;
      const npc_ny = cosT_npc;
      const npc_nz = sinT_npc * sinP_npc;

      const npc_r_est = c.r || (RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE);
      
      // Throttled terrain/cave and water lookup to keep the frame rate at solid 120fps!
      if (c.caveCheckAccumulator === undefined) {
        c.caveCheckAccumulator = Math.random() * 0.15; // Jitter the initial timers to spread the load across frames
      }
      c.caveCheckAccumulator += deltaTime;

      if (!c.cachedCaveData || c.caveCheckAccumulator >= 0.15) {
        c.caveCheckAccumulator = 0;
        c.cachedCaveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(npc_nx, npc_ny, npc_nz, npc_r_est)
          : { ground: RADIUS + getHeightOnSphere(c.theta, c.phi, seed) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        
        const gRadiusTemp = c.cachedCaveData.ground;
        const npc_r_temp = c.r || gRadiusTemp;
        c.cachedWaterRadius = getWaterRadiusAt(npc_nx * npc_r_temp, npc_ny * npc_r_temp, npc_nz * npc_r_temp);
      }

      const npcCaveData = c.cachedCaveData;
      const gRadius = npcCaveData.ground;
      const npc_r = c.r || gRadius;
      let wRadius = c.cachedWaterRadius;
      if (npcCaveData.insideTunnel && wRadius === 0) {
          wRadius = (typeof RADIUS !== 'undefined' ? RADIUS : 8.0) + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * 0.15;
      }

      // Update specific NPC type movement behavior
      const npcReg = window.NpcRegistry[c.type];
      if (npcReg && npcReg.updateBehavior) {
        npcReg.updateBehavior(c, deltaTime, seed, gRadius, wRadius, npcCaveData);
      }

      if (c.ragdollEnabled) {
        if (!c.ragdollPos || !Array.isArray(c.ragdollPos) || c.ragdollPos.length < 3) {
          const sinT = Math.sin(c.theta);
          const cosT = Math.cos(c.theta);
          const sinP = Math.sin(c.phi);
          const cosP = Math.cos(c.phi);
          c.ragdollPos = [sinT * cosP * c.r, cosT * c.r, sinT * sinP * c.r];
        }
        if (!c.ragdollAxis || !Array.isArray(c.ragdollAxis) || c.ragdollAxis.length < 3) {
          c.ragdollAxis = [0, 1, 0];
        }
        if (c.ragdollAngle === undefined) {
          c.ragdollAngle = 0;
        }
        if (!c.ragdollVel || !Array.isArray(c.ragdollVel) || c.ragdollVel.length < 3) {
          c.ragdollVel = [0, 0, 0];
        }
        c.ragdollInitialized = true;
      }

      if (!shouldAnimate) {
        c.animPhase = prevAnimPhase;
      }

      if (c.lastAnimPhase === undefined) c.lastAnimPhase = c.animPhase;
      const phaseOffset = c.isSwimming ? 4.05 : 0; // Sync with max tail velocity (z=-0.95)
      const stepPrev = Math.floor(
        (c.lastAnimPhase - phaseOffset) / Math.PI,
      );
      const stepCurr = Math.floor((c.animPhase - phaseOffset) / Math.PI);

      if (c.lodLevel === 0 && stepPrev !== stepCurr) {
        // A step was taken. Calculate distance to player to determine volume
        const distAngle = Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              Math.sin(c.theta) *
                Math.sin(charTheta) *
                Math.cos(c.phi - charPhi) +
                Math.cos(c.theta) * Math.cos(charTheta),
            ),
          ),
        );
        const dist = distAngle * RADIUS;
        if (dist < 2.0) {
          // Quadratic falloff for more realistic sound attenuation
          const volScale =
            Math.pow(Math.max(0, 1.0 - dist / 2.0), 2) * 0.6;
          if (volScale > 0.01) {
            if (c.isSwimming) {
              playSplashSound(volScale);
            } else {
              playFootstepSound(volScale);
            }
          }
        }
      }
      c.lastAnimPhase = c.animPhase;
    }

    if (shouldRender) {
      const sinTheta = Math.sin(c.theta);
      const cosTheta = Math.cos(c.theta);
      const sinPhi = Math.sin(c.phi);
      const cosPhi = Math.cos(c.phi);
      let N = [sinTheta * cosPhi, cosTheta, sinTheta * sinPhi];

      c.position = [N[0] * c.r, N[1] * c.r, N[2] * c.r];
      c.radius = 0.15;

      // Heading local frame
      let h_rad = c.heading;
      const sinH = Math.sin(h_rad);
      const cosH = Math.cos(h_rad);

      let North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
      let East = [-sinPhi, 0, cosPhi];

      let F = [
        North[0] * cosH + East[0] * sinH,
        North[1] * cosH + East[1] * sinH,
        North[2] * cosH + East[2] * sinH,
      ];
      let R = [
        -North[0] * sinH + East[0] * cosH,
        -North[1] * sinH + East[1] * cosH,
        -North[2] * sinH + East[2] * cosH,
      ];

      if (c.ragdollEnabled && c.ragdollAxis && Array.isArray(c.ragdollAxis) && c.ragdollAxis.length >= 3) {
        const q = c.ragdollAngle || 0;
        const cosQ = Math.cos(q);
        const sinQ = Math.sin(q);
        const ax = c.ragdollAxis[0];
        const ay = c.ragdollAxis[1];
        const az = c.ragdollAxis[2];

        const rotateVector = (v) => {
          const dot = v[0] * ax + v[1] * ay + v[2] * az;
          const cross = [
            ay * v[2] - az * v[1],
            az * v[0] - ax * v[2],
            ax * v[1] - ay * v[0],
          ];
          return [
            v[0] * cosQ + cross[0] * sinQ + ax * dot * (1.0 - cosQ),
            v[1] * cosQ + cross[1] * sinQ + ay * dot * (1.0 - cosQ),
            v[2] * cosQ + cross[2] * sinQ + az * dot * (1.0 - cosQ),
          ];
        };

        N = rotateVector(N);
        F = rotateVector(F);
        R = rotateVector(R);
      }

      c.N = N;
      c.F = F;
      c.R = R;

      const pos = (c.ragdollEnabled && c.ragdollPos && Array.isArray(c.ragdollPos) && c.ragdollPos.length >= 3)
        ? c.ragdollPos
        : (c.position || npc_pos || [0, 0, 0]);

      let f = [0, 0, 0];
      if (c.ragdollEnabled && c.ragdollVel && Array.isArray(c.ragdollVel) && c.ragdollVel.length >= 3) {
        const localVel = [
          c.ragdollVel[0] * R[0] + c.ragdollVel[1] * R[1] + c.ragdollVel[2] * R[2],
          c.ragdollVel[0] * N[0] + c.ragdollVel[1] * N[1] + c.ragdollVel[2] * N[2],
          c.ragdollVel[0] * F[0] + c.ragdollVel[1] * F[1] + c.ragdollVel[2] * F[2],
        ];
        const g = [
          -N[0] * R[0] - N[1] * R[1] - N[2] * R[2],
          -N[0] * N[0] - N[1] * N[1] - N[2] * N[2],
          -N[0] * F[0] - N[1] * F[1] - N[2] * F[2],
        ];
        f[0] = g[0] * 1.5 - localVel[0] * 12.0;
        f[1] = g[1] * 1.5 - localVel[1] * 12.0;
        f[2] = g[2] * 1.5 - localVel[2] * 12.0;
      }

      const transformPoint = (px, py, pz) => {
        const basePos = (pos && Array.isArray(pos) && pos.length >= 3) ? pos : (c.position || npc_pos || [0, 0, 0]);
        let worldPos = [
          basePos[0] + (px * R[0] + py * N[0] + pz * F[0]),
          basePos[1] + (px * R[1] + py * N[1] + pz * F[1]),
          basePos[2] + (px * R[2] + py * N[2] + pz * F[2]),
        ];
        if (c.ragdollEnabled) {
          if (c.type === 'human') {
            // Human model: maintain rigid anatomical integrity, only clamp vertices above ground
            const dist = Math.sqrt(
              worldPos[0] ** 2 + worldPos[1] ** 2 + worldPos[2] ** 2,
            );
            if (dist > 0.001) {
              const ux = worldPos[0] / dist;
              const uy = worldPos[1] / dist;
              const uz = worldPos[2] / dist;

              const caveData = c.ragdollCaveData || { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, uy))), Math.atan2(uz, ux), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
              const surfaceRadius = caveData.ground;
              const minRad = surfaceRadius + 0.005;
              if (dist < minRad && dist > surfaceRadius - 0.5) {
                worldPos = [ux * minRad, uy * minRad, uz * minRad];
              }
            }
            return worldPos;
          }

          const dist = Math.sqrt(
            worldPos[0] ** 2 + worldPos[1] ** 2 + worldPos[2] ** 2,
          );
          if (dist > 0.001) {
            const ux = worldPos[0] / dist;
            const uy = worldPos[1] / dist;
            const uz = worldPos[2] / dist;

            const caveData = c.ragdollCaveData || { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, uy))), Math.atan2(uz, ux), seed) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
            const surfaceRadius = caveData.ground;

            // Determine thickness envelope based on local coordinate
            const scale = 0.5; // matching base scale
            const localPx = px / scale;
            const localPz = pz / scale;
            let thickness = 0.06;
            if (Math.abs(localPx) > 0.05) {
              thickness = 0.015;
            } else {
              if (localPz > 0.2) thickness = 0.03;
              else if (localPz > -0.3 && localPz <= 0.2) thickness = 0.12;
              else if (localPz > -0.6 && localPz <= -0.3) thickness = 0.09;
              else if (localPz <= -0.6) thickness = 0.04;
            }

            if (caveData.insideTunnel) {
               const minRad = caveData.ground + thickness * scale;
               const maxRad = caveData.ceiling !== Infinity ? caveData.ceiling - thickness * scale : Infinity;
               if (dist < minRad) {
                 worldPos = [ux * minRad, uy * minRad, uz * minRad];
               } else if (dist > maxRad && maxRad !== Infinity) {
                 worldPos = [ux * maxRad, uy * maxRad, uz * maxRad];
               }
            } else {
               const minRad = surfaceRadius + thickness * scale;
               if (dist < minRad && dist > surfaceRadius - 0.5) {
                 worldPos = [ux * minRad, uy * minRad, uz * minRad];
               }
            }
          }
        }
        return worldPos;
      };

      const scale = c.type === 'meganeura' ? 0.25 : (c.type === 'isopod' ? 0.38 : (c.type === 'obsidian_cube' ? 0.45 : 0.5));

      // Render using the registered NPC implementation
      const npcReg = window.NpcRegistry[c.type];
      if (npcReg && npcReg.render) {
        npcReg.render(
          c,
          _allNpcVertices,
          _allNpcColors,
          _allNpcIndices,
          scale,
          N,
          R,
          F,
          pos,
          f,
          transformPoint,
          seed
        );
      }
    }
  }

  if (_allNpcIndices.length === 0) {
    amphibianIndicesLength = 0;
    return;
  }

  const flatGeom = makeFlatShadedGeometry(
    _allNpcVertices,
    _allNpcColors,
    _allNpcIndices,
    true
  );
  amphibianIndicesLength = flatGeom.indices.length;

  if (!amphibianVertexBuffer) amphibianVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    flatGeom.vertices,
    gl.DYNAMIC_DRAW,
  );

  if (!amphibianColorBuffer) amphibianColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    flatGeom.colors,
    gl.DYNAMIC_DRAW,
  );

  if (!amphibianNormalBuffer) amphibianNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    flatGeom.normals,
    gl.DYNAMIC_DRAW,
  );

  if (!amphibianIndexBuffer) amphibianIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    flatGeom.indices,
    gl.DYNAMIC_DRAW,
  );
}

function clearActiveNPCs() {
  if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
    amphibians.length = 0;
  }
}
window.clearActiveNPCs = clearActiveNPCs;
window.initAmphibians = initAmphibians;
window.rebuildNPCs = function(count, seed) {
  initAmphibians(count, seed || (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345));
};
