// === SEEDPLANET ENGINE: SPACESMAP & SATELLITE SUN ORBITS SYSTEM ===
// =============================================================================
// โมดูลระบบแผนที่อวกาศ (SpacesMap), ดวงอาทิตย์บริวาร (Satellite Sun) และวงโคจรดาวเคราะห์ (Planetary Orbits)
// จัดการพิกัดจักรวาล (Celestial Coordinates), การคำนวณการโคจร, โมเดลทรงกลม และการสลับดาวเคราะห์
// =============================================================================

(function(global) {
  "use strict";

  const SpacesMap = {
    // รหัสประจำตัวดาวเคราะห์ที่ผู้เล่นกำลังยืนอยู่ (Active Planet)
    activePlanetId: "planet_1",

    // การกำหนดค่าดวงอาทิตย์หลัก (Satellite Sun Configuration)
    sun: {
      id: "sun",
      name: "☀️ ดวงอาทิตย์บริวาร (Satellite Sun)",
      radius: 1.0,
      visualScale: 70.0,
      baseDistance: 800.0,
      basePos: [-800.0, 0.0, 0.0],
      color: [1.0, 0.65, 0.15],
      ambientIntensity: 1.0,
      rotationSpeed: 0.02
    },

    // ฐานข้อมูลดาวเคราะห์หลักในระบบสุริยะ (Solar System Planets)
    allPlanets: {
      planet_1: {
        id: "planet_1",
        name: "🌱 ดาวแม่พันธุ์พืชหลัก (Genesis)",
        type: "habitable_flora",
        orbitRadius: 800.0,
        orbitSpeed: 0.0,
        orbitAngle: 0.0,
        orbitTilt: 0.0,
        visualScale: 1.0,
        baseColor: [0.25, 0.75, 0.35],
        systems: ["terrain", "nature", "water", "caves", "clouds", "npcs", "physics", "player", "collectibles"]
      },
      planet_2: {
        id: "planet_2",
        name: "🌊 ดาวมหาสมุทรสีคราม (Oceania)",
        type: "ocean_world",
        orbitRadius: 1200.0,
        orbitSpeed: 0.012,
        orbitAngle: 1.25,
        orbitTilt: -0.06,
        visualScale: 0.85,
        baseColor: [0.15, 0.55, 0.95],
        systems: ["terrain", "water", "caves", "clouds", "physics", "player"]
      },
      planet_3: {
        id: "planet_3",
        name: "🌲 ดาวป่าดงดิบดึกดำบรรพ์ (Verdant)",
        type: "ancient_forest",
        orbitRadius: 1600.0,
        orbitSpeed: 0.008,
        orbitAngle: 2.80,
        orbitTilt: 0.08,
        visualScale: 0.92,
        baseColor: [0.18, 0.62, 0.28],
        systems: ["terrain", "nature", "water", "caves", "clouds", "physics", "player"]
      },
      planet_4: {
        id: "planet_4",
        name: "🌸 ดาวพฤกษศาสตร์ต่างดาว (Botanical)",
        type: "alien_flora",
        orbitRadius: 2000.0,
        orbitSpeed: 0.006,
        orbitAngle: 4.10,
        orbitTilt: -0.10,
        visualScale: 0.78,
        baseColor: [0.85, 0.25, 0.65],
        systems: ["terrain", "nature", "water", "clouds", "physics", "player"]
      },
      planet_5: {
        id: "planet_5",
        name: "⚡ ดาวสนามพลังงานชีวภาพ (Bio-Flux)",
        type: "energy_flux",
        orbitRadius: 2450.0,
        orbitSpeed: 0.004,
        orbitAngle: 5.40,
        orbitTilt: 0.12,
        visualScale: 1.15,
        baseColor: [0.95, 0.55, 0.15],
        systems: ["terrain", "water", "caves", "clouds", "physics", "player"]
      }
    },

    // ไบโอมดาวเคราะห์เพื่อนบ้านภายนอก (Neighbor Extra Planet Biomes)
    extraPlanetBiomes: [
      { name: "🧊 ดาวน้ำแข็ง (Ice World)", baseColor: [0.75, 0.88, 1.0], noiseCol: [0.4, 0.65, 0.95] },
      { name: "🌋 ดาวลาวา (Volcanic Planet)", baseColor: [0.85, 0.28, 0.12], noiseCol: [0.35, 0.12, 0.05] },
      { name: "🏜️ ดาวทะเลทราย (Desert World)", baseColor: [0.88, 0.68, 0.38], noiseCol: [0.58, 0.40, 0.22] },
      { name: "🟣 ดาวพลาสม่า (Alien Plasma)", baseColor: [0.55, 0.22, 0.85], noiseCol: [0.82, 0.42, 0.92] },
      { name: "🌔 ดาวหินอุกกาบาต (Meteorite Moon)", baseColor: [0.62, 0.64, 0.68], noiseCol: [0.38, 0.39, 0.42] },
      { name: "🟢 ดาวมรกต (Emerald World)", baseColor: [0.22, 0.72, 0.42], noiseCol: [0.12, 0.42, 0.22] },
      { name: "🪐 ดาวแร่แดง (Rust Planet)", baseColor: [0.78, 0.42, 0.22], noiseCol: [0.48, 0.22, 0.12] }
    ],

    // =========================================================================
    // 1. การสุ่มและคำนวณวงโคจร (Orbit Randomization & Mechanics)
    // =========================================================================
    randomizeOrbits: function(seed = 12345) {
      const pseudoRand = (offset) => {
        let x = Math.sin(seed + offset * 12.345) * 43758.5453;
        return x - Math.floor(x);
      };

      // กำหนดตำแหน่งดวงอาทิตย์บนระนาบสุริยะหลักที่ระยะ 800 หน่วย
      this.sun.basePos = [-800.0, 0.0, 0.0];

      // สุ่มมุมและระนาบวงโคจรของดาวเคราะห์บริวาร (ยกเว้นดาวแม่ planet_1)
      let planetIndex = 0;
      for (const id in this.allPlanets) {
        const planet = this.allPlanets[id];
        if (id === this.activePlanetId || id === "planet_1") {
          planet.orbitRadius = 800.0;
          planet.orbitAngle = 0.0;
          planet.orbitSpeed = 0.0;
          planet.orbitTilt = 0.0;
        } else {
          planet.orbitAngle = (planetIndex / 5.0) * Math.PI * 2 + pseudoRand(planetIndex * 10 + 4) * 0.8;
          planet.orbitSpeed = 0.003 + (1.0 / (planetIndex + 1.5)) * 0.010;
          planet.orbitTilt = ((planetIndex % 2 === 0 ? 1 : -1) * (0.05 + (planetIndex * 0.03)));
        }
        planetIndex++;
      }

      console.log("🌌 SpacesMap: คำนวณระบบสุริยะและวงโคจรระนาบดวงอาทิตย์เรียบร้อยแล้ว");
    },

    // =========================================================================
    // 2. การดึงข้อมูลและพิกัดบนท้องฟ้า (Celestial Coordinates & Transformations)
    // =========================================================================
    getTime: function(time) {
      if (typeof time === "number") return time;
      if (typeof global.waterTime === "number") return global.waterTime;
      if (typeof global.globalTime === "number") return global.globalTime;
      return (typeof performance !== "undefined" ? performance.now() / 1000 : 0);
    },

    getActivePlanet: function() {
      return this.allPlanets[this.activePlanetId] || this.allPlanets["planet_1"];
    },

    getSunWorldPosition: function() {
      if (this.sun && this.sun.basePos) {
        return [this.sun.basePos[0], this.sun.basePos[1], this.sun.basePos[2]];
      }
      return [-800.0, 0.0, 0.0];
    },

    getCelestialTransform: function(targetId, time) {
      const t = this.getTime(time);

      // 1. กรณีเป้าหมายคือดวงอาทิตย์
      if (targetId === "sun") {
        const sunPos = this.getSunWorldPosition();
        return {
          pos: sunPos,
          scale: this.sun.visualScale || 70.0,
          rotation: [0, 0, 0],
          orbitRadius: 0,
          orbitTilt: 0,
          orbitAngle: 0
        };
      }

      // 2. กรณีเป้าหมายคือดาวเคราะห์ที่ผู้เล่นกำลังยืนอยู่ (Active Planet - จุดศูนย์กลาง [0, 0, 0])
      if (targetId === this.activePlanetId) {
        const p = this.allPlanets[targetId] || {};
        return {
          pos: [0.0, 0.0, 0.0],
          scale: (p.visualScale || 1.0) * 30.0,
          rotation: [0, 0, 0],
          orbitRadius: p.orbitRadius || 800.0,
          orbitTilt: 0.0,
          orbitAngle: 0.0,
          orbitSpeed: 0.0
        };
      }

      // 3. กรณีเป้าหมายคือดาวเคราะห์หลักดวงอื่นในระบบสุริยะ
      if (this.allPlanets[targetId]) {
        const p = this.allPlanets[targetId];
        const sunPos = this.getSunWorldPosition();
        
        // คำนวณตำแหน่งตามวงโคจรหมุนรอบดวงอาทิตย์ (Orbit Rings)
        const rad = p.orbitRadius || 800.0;
        const speed = (typeof p.orbitSpeed === "number") ? p.orbitSpeed : 0.008;
        const ang = (p.orbitAngle || 0.0) + t * speed;
        const tilt = (typeof p.orbitTilt === "number") ? p.orbitTilt : 0.0;

        const posX = sunPos[0] + Math.cos(ang) * rad;
        const posY = sunPos[1] + Math.sin(ang) * (rad * tilt);
        const posZ = sunPos[2] + Math.sin(ang) * rad;

        return {
          pos: [posX, posY, posZ],
          scale: (p.visualScale || 1.0) * 30.0,
          rotation: [0, ang * 2.0, 0],
          orbitRadius: rad,
          orbitTilt: tilt,
          orbitAngle: ang,
          orbitSpeed: speed
        };
      }

      // 3. กรณีเป้าหมายคือดาวเคราะห์เพื่อนบ้านภายนอก (Extra Neighbor Planet)
      const numMatch = targetId && String(targetId).match(/\d+/);
      const extraIdx = numMatch ? (parseInt(numMatch[0], 10) - 1) : 0;
      
      if (global.EXTRA_PLANETS && global.EXTRA_PLANETS[extraIdx % global.EXTRA_PLANETS.length]) {
        const ep = global.EXTRA_PLANETS[extraIdx % global.EXTRA_PLANETS.length];
        const sunPos = this.getSunWorldPosition();
        const rad = ep.orbitRadius || (800.0 + (extraIdx + 1) * 360.0);
        const speed = ep.orbitSpeed || (0.004 + (1.0 / (extraIdx + 2.0)) * 0.008);
        const ang = (ep.orbitAngle || (extraIdx * 1.25)) + t * speed;
        const tilt = ep.orbitTilt || ((((extraIdx % 2) === 0 ? 1 : -1) * 0.08) * (extraIdx + 1) * 0.5);

        const posX = sunPos[0] + Math.cos(ang) * rad;
        const posY = sunPos[1] + Math.sin(ang) * (rad * tilt);
        const posZ = sunPos[2] + Math.sin(ang) * rad;
        
        return {
          pos: [posX, posY, posZ],
          scale: (ep.radius ? ep.radius * 2.8 : 25.0),
          rotation: [0, ang * 2.0, 0],
          orbitRadius: rad,
          orbitTilt: tilt,
          orbitAngle: ang,
          orbitSpeed: speed
        };
      }

      return {
        pos: [800.0, 0.0, 0.0],
        scale: 25.0,
        rotation: [0, 0, 0],
        orbitRadius: 800.0,
        orbitTilt: 0.0,
        orbitAngle: 0.0,
        orbitSpeed: 0.005
      };
    },

    getRelativeRenderPosition: function(planetId, time) {
      const transform = this.getCelestialTransform(planetId, time);
      return transform ? transform.pos : [800.0, 0.0, 0.0];
    },

    // =========================================================================
    // 3. การสร้างโมเดล 3D (3D Sphere Geometry & GPU Buffers)
    // =========================================================================
    
    // สร้างโมเดลดวงอาทิตย์บริวาร 3D (Satellite Sun VBO/CBO/IBO)
    buildSatelliteSun: function(seed = 12345) {
      const gl = global.gl;
      if (!gl) return;

      const latSeg = 48;
      const longSeg = 48;
      const vertices = [];
      const colors = [];
      const indices = [];

      const sunRadius = this.sun.radius || 1.0;

      for (let lat = 0; lat <= latSeg; lat++) {
        const theta = (lat / latSeg) * Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let long = 0; long <= longSeg; long++) {
          const phi = (long / longSeg) * Math.PI * 2;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          const nx = sinTheta * cosPhi;
          const ny = cosTheta;
          const nz = sinTheta * sinPhi;

          vertices.push(nx * sunRadius, ny * sunRadius, nz * sunRadius);

          // สีเปลวเพลิงพลาสม่าสุริยะ: โทนสีทองส้ม เปล่งประกายอบอุ่น
          const solarNoise = Math.sin(phi * 4 + lat * 0.25) * Math.cos(theta * 4) * 0.08;
          const factor = 0.8 + solarNoise;
          
          const r = 1.0;
          const g = Math.min(0.9, Math.max(0.48, 0.72 * factor));
          const b = Math.min(0.4, Math.max(0.04, 0.14 * factor));

          colors.push(r, g, b);
        }
      }

      for (let lat = 0; lat < latSeg; lat++) {
        for (let long = 0; long < longSeg; long++) {
          const a = lat * (longSeg + 1) + long;
          const b = a + longSeg + 1;
          const c = a + 1;
          const d = b + 1;
          indices.push(a, b, c);
          indices.push(c, b, d);
        }
      }

      global.satelliteIndicesLength = indices.length;

      if (global.satelliteVertexBuffer) gl.deleteBuffer(global.satelliteVertexBuffer);
      if (global.satelliteColorBuffer) gl.deleteBuffer(global.satelliteColorBuffer);
      if (global.satelliteIndexBuffer) gl.deleteBuffer(global.satelliteIndexBuffer);

      global.satelliteVertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, global.satelliteVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

      global.satelliteColorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, global.satelliteColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

      global.satelliteIndexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, global.satelliteIndexBuffer);
      
      const supportUint32 = global.supportUint32;
      if (supportUint32 && indices.length > 65535) {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
      } else {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      }

      global.SATELLITE_PLANET_POS = this.getSunWorldPosition();
      console.log("☀️ SpacesMap: สร้างโมเดล 3D Satellite Sun สำเร็จเรียบร้อย");
    },

    // สร้างดาวเคราะห์เปล่าแบบสุ่มรอบระบบสุริยะ (5 Procedural Extra Planets)
    buildExtraPlanets: function(seed = 12345) {
      const gl = global.gl;
      if (!gl) return;

      const mainRad = typeof global.RADIUS !== "undefined" ? global.RADIUS : 8.0;

      this.randomizeOrbits(seed);

      if (global.EXTRA_PLANETS && Array.isArray(global.EXTRA_PLANETS)) {
        global.EXTRA_PLANETS.forEach(p => {
          if (p.vbo) gl.deleteBuffer(p.vbo);
          if (p.cbo) gl.deleteBuffer(p.cbo);
          if (p.ibo) gl.deleteBuffer(p.ibo);
        });
      }
      global.EXTRA_PLANETS = [];

      const biomes = this.extraPlanetBiomes;
      const latSeg = 20;
      const longSeg = 20;
      const numPlanets = 5;

      const getNoise = (typeof global.fbmNoise === "function")
        ? global.fbmNoise
        : (x, y, z, s, oct) => (Math.sin(x*2) * Math.cos(y*2) + 1.0) * 0.5;

      for (let pIdx = 0; pIdx < numPlanets; pIdx++) {
        const pSeed = seed + (pIdx + 1) * 8888;
        const pseudoRand = (offset) => {
          let x = Math.sin(pSeed + offset * 12.345) * 43758.5453;
          return x - Math.floor(x);
        };

        const radScale = 0.35 + pseudoRand(1) * 0.45;
        const pRadius = mainRad * radScale;

        // วงโคจร 3D รอบดวงอาทิตย์
        const orbitRadius = 800.0 + (pIdx + 1) * 360.0 + pseudoRand(4) * 120.0;
        const orbitSpeed = 0.003 + (1.0 / (pIdx + 2.0)) * 0.008;
        const orbitTilt = (pseudoRand(5) - 0.5) * 0.25;
        const orbitAngle = (pIdx / numPlanets) * Math.PI * 2 + pseudoRand(3) * 0.8;

        const relX = Math.cos(orbitAngle) * orbitRadius;
        const relY = Math.sin(orbitAngle) * (orbitRadius * orbitTilt);
        const relZ = Math.sin(orbitAngle) * orbitRadius;

        const biomeIdx = Math.floor(pseudoRand(6) * biomes.length);
        const biome = biomes[biomeIdx];

        const vertices = [];
        const colors = [];
        const indices = [];

        for (let lat = 0; lat <= latSeg; lat++) {
          const theta = (lat / latSeg) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);

          for (let long = 0; long <= longSeg; long++) {
            const phi = (long / longSeg) * Math.PI * 2;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;

            const n1 = getNoise(nx * 3.2, ny * 3.2, nz * 3.2, pSeed + 111, 4);
            const n2 = getNoise(nx * 8.5, ny * 8.5, nz * 8.5, pSeed + 333, 3);
            const crater = getNoise(nx * 14.0, ny * 14.0, nz * 14.0, pSeed + 777, 2);

            const hVal = (n1 * 0.65 + n2 * 0.35) - 0.48;
            const curRad = 1.0 + hVal * 0.12;

            vertices.push(nx * curRad, ny * curRad, nz * curRad);

            const colMix = n1 * 0.75 + crater * 0.25;
            const r = biome.baseColor[0] * (0.6 + colMix * 0.5) + biome.noiseCol[0] * (0.4 - colMix * 0.3);
            const g = biome.baseColor[1] * (0.6 + colMix * 0.5) + biome.noiseCol[1] * (0.4 - colMix * 0.3);
            const b = biome.baseColor[2] * (0.6 + colMix * 0.5) + biome.noiseCol[2] * (0.4 - colMix * 0.3);

            colors.push(Math.min(1.0, Math.max(0.0, r)), Math.min(1.0, Math.max(0.0, g)), Math.min(1.0, Math.max(0.0, b)));
          }
        }

        for (let lat = 0; lat < latSeg; lat++) {
          for (let long = 0; long < longSeg; long++) {
            const a = lat * (longSeg + 1) + long;
            const b = a + longSeg + 1;
            const c = a + 1;
            const d = b + 1;
            indices.push(a, b, c);
            indices.push(c, b, d);
          }
        }

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        const cbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        const supportUint32 = global.supportUint32;
        if (supportUint32 && indices.length > 65535) {
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
        } else {
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        }

        const self = this;
        global.EXTRA_PLANETS.push({
          id: pIdx + 1,
          name: `ดาวที่ ${pIdx + 1} (${biome.name})`,
          biomeName: biome.name,
          radius: pRadius,
          orbitRadius: orbitRadius,
          orbitSpeed: orbitSpeed,
          orbitTilt: orbitTilt,
          orbitAngle: orbitAngle,
          relPos: [relX, relY, relZ],
          get pos() {
            const pId = `planet_${pIdx + 6}`;
            const rel = self.getRelativeRenderPosition(pId);
            return [rel[0], rel[1], rel[2]];
          },
          vbo: vbo,
          cbo: cbo,
          ibo: ibo,
          indicesLength: indices.length
        });
      }

      console.log("🪐 SpacesMap: สร้างดาวเคราะห์บริวาร 3D ทั้งหมด 5 ดวง สำเร็จ");
    },

    // =========================================================================
    // 4. การสลับดาวเคราะห์ (Active Planet Switching)
    // =========================================================================
    switchActivePlanet: function(planetId) {
      if (!this.allPlanets[planetId]) {
        console.warn("⚠️ SpacesMap: ไม่พบข้อมูลดาวเคราะห์รหัส:", planetId);
        return;
      }

      this.activePlanetId = planetId;
      const targetPlanet = this.allPlanets[planetId];

      if (typeof global.showNotice === "function") {
        global.showNotice(`🪐 สลับเข้าสู่ ${targetPlanet.name} เรียบร้อยแล้ว!`);
      }

      // รีเซ็ตการสร้างพื้นผิวดาวดวงใหม่มาวางที่พิกัด [0, 0, 0] ของเครื่องเล่น
      if (typeof global.buildPlanetAsync === "function") {
        const curGrid = typeof global.currentGridSize !== "undefined" ? global.currentGridSize : 400;
        const curSeed = typeof global.globalSeed !== "undefined" ? global.globalSeed : 13585;
        
        global.buildPlanetAsync(curGrid, curSeed, function(percent, statusText, logLine) {
          if (typeof global.updateAaaLoading === "function") {
            global.updateAaaLoading(percent, statusText, logLine);
          }
        });
      }
    }
  };

  // Export ไปยัง window / global scope
  global.SpacesMap = SpacesMap;
  global.getSunWorldPosition = () => SpacesMap.getSunWorldPosition();
  global.buildSatellitePlanet = (seed) => SpacesMap.buildSatelliteSun(seed);
  global.buildExtraPlanets = (seed) => SpacesMap.buildExtraPlanets(seed);

})(typeof window !== "undefined" ? window : globalThis);
