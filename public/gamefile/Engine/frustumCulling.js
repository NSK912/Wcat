// === STANDARD GEOMETRIC FRUSTUM CULLING ===
// ระบบ Frustum Culling แบบมาตรฐานเรขาคณิต 3D บริสุทธิ์
// คำนวณจากมุมกล้องและ Bounding Sphere ตรงไปตรงมา ไม่ขึ้นกับขนาดดาว ความโค้ง หรือรูปทรงของวัตถุ

(function(global) {
  'use strict';

  // Config มาตรฐาน
  const CFG = {
    radiusPadding: 1.0,      // เผื่อขอบจอ +1.0 หน่วย ป้องกันวัตถุกะพริบ/หายที่ริมจอ
    defaultRadius: 2.0,      // รัศมีมาตรฐานสำหรับวัตถุทั่วไป (เรือ, ต้นไม้, หิน, กล่อง, ฯลฯ)
    nearPlaneOffset: 0.5     // ผ่อนปรน Near Plane ป้องกันวัตถุที่อยู่ใกล้กล้องมากๆ โดนตัด
  };

  let cachedPlanes = null;
  let lastVP = null;

  // ==================== COLUMN-MAJOR MATRIX MULTIPLICATION ====================
  // คูณ Matrix 4x4 แบบ Column-Major ที่ถูกต้องสำหรับ WebGL/WebGPU
  function multiplyMat4(A, B) {
    if (!A || !B) return null;
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          A[0 * 4 + r] * B[c * 4 + 0] +
          A[1 * 4 + r] * B[c * 4 + 1] +
          A[2 * 4 + r] * B[c * 4 + 2] +
          A[3 * 4 + r] * B[c * 4 + 3];
      }
    }
    return out;
  }

  // ==================== GRIBB-HARTMANN PLANE EXTRACTION ====================
  // สกัดระนาบ 6 ระนาบจาก View-Projection Matrix (Column-Major)
  function getFrustumPlanes(vp) {
    if (!vp || vp.length < 16) return null;
    
    if (lastVP === vp && cachedPlanes) {
      return cachedPlanes;
    }
    lastVP = vp;
    
    const m = vp;
    const planes = new Float32Array(24);
    
    // Left:   col3 + col0 (Row3 + Row0 in column-major index: m[3+i*4] + m[0+i*4]) -> m[3]+m[0], m[7]+m[4], m[11]+m[8], m[15]+m[12]
    planes[0] = m[3] + m[0];
    planes[1] = m[7] + m[4];
    planes[2] = m[11] + m[8];
    planes[3] = m[15] + m[12];
    
    // Right:  col3 - col0
    planes[4] = m[3] - m[0];
    planes[5] = m[7] - m[4];
    planes[6] = m[11] - m[8];
    planes[7] = m[15] - m[12];
    
    // Bottom: col3 + col1
    planes[8] = m[3] + m[1];
    planes[9] = m[7] + m[5];
    planes[10] = m[11] + m[9];
    planes[11] = m[15] + m[13];
    
    // Top:    col3 - col1
    planes[12] = m[3] - m[1];
    planes[13] = m[7] - m[5];
    planes[14] = m[11] - m[9];
    planes[15] = m[15] - m[13];
    
    // Near:   col3 + col2 (OpenGL) หรือ col2 (WebGPU 0..1)
    // ใช้ col3 + col2 พร้อมผ่อนปรน offset ป้องกันวัตถุจ่อหน้ากล้องหาย
    planes[16] = m[3] + m[2];
    planes[17] = m[7] + m[6];
    planes[18] = m[11] + m[10];
    planes[19] = m[15] + m[14];
    
    // Far:    col3 - col2
    planes[20] = m[3] - m[2];
    planes[21] = m[7] - m[6];
    planes[22] = m[11] - m[10];
    planes[23] = m[15] - m[14];
    
    // Normalize each plane normal (A, B, C)
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      const a = planes[o];
      const b = planes[o + 1];
      const c = planes[o + 2];
      const len = Math.sqrt(a * a + b * b + c * c);
      if (len > 0.00001) {
        planes[o]     /= len;
        planes[o + 1] /= len;
        planes[o + 2] /= len;
        planes[o + 3] /= len;
      }
    }
    
    cachedPlanes = planes;
    return planes;
  }

  // ==================== UPDATE FRUSTUM PLANES ====================
  function updateFrustumPlanes(viewProj, cullingEnabled = true) {
    if (cullingEnabled && viewProj) {
      cachedPlanes = getFrustumPlanes(viewProj);
    } else {
      cachedPlanes = null;
    }
    global.frustumPlanes = cachedPlanes;
    return cachedPlanes;
  }

  function updateFrustumPlanesFromPV(projMatrix, viewMatrix, cullingEnabled = true) {
    if (cullingEnabled && projMatrix && viewMatrix) {
      // คูณ Proj x View ตามหลัก Column-Major ที่ถูกต้อง
      const vp = multiplyMat4(projMatrix, viewMatrix);
      cachedPlanes = getFrustumPlanes(vp);
    } else {
      cachedPlanes = null;
    }
    global.frustumPlanes = cachedPlanes;
    return cachedPlanes;
  }

  // ==================== BOUNDING RADIUS ====================
  // คืนค่ารัศมีทรงกลมล้อมรอบของวัตถุอย่างตรงไปตรงมา
  function getBoundingRadius(obs) {
    if (!obs) return CFG.defaultRadius;
    
    let r = 0;
    if (typeof obs.boundingRadius === 'number' && obs.boundingRadius > 0) {
      r = obs.boundingRadius;
    } else if (typeof obs.radius === 'number' && obs.radius > 0) {
      r = obs.radius;
    } else if (typeof obs.size === 'number' && obs.size > 0) {
      r = obs.size * 2.0;
    } else if (typeof obs.scale === 'number' && obs.scale > 0) {
      r = obs.scale * 2.0;
    } else if (Array.isArray(obs.extents) && obs.extents.length > 0) {
      r = Math.max(...obs.extents.map(Math.abs));
    }
    
    if (r <= 0) {
      // ค่ามาตรฐานตามประเภทวัตถุ
      if (obs.type === "wood_boat" || obs.type === "boat") r = 4.0;
      else if (obs.type === "wood_wall" || obs.type === "wood_floor") r = 3.0;
      else if (obs.isCloud || obs.type === "cloud") r = 15.0;
      else r = CFG.defaultRadius;
    }
    
    return Math.max(r, 1.0);
  }

  // ==================== SPHERE IN FRUSTUM CHECK ====================
  // ตรวจสอบว่าทรงกลม (จุดศูนย์กลาง pos, รัศมี radius) อยู่ใน Frustum หรือไม่
  function isSphereInFrustum(planes, pos, radius) {
    if (!planes || !pos || pos.length < 3) return true;
    
    const x = pos[0];
    const y = pos[1];
    const z = pos[2];
    const r = (radius !== undefined ? radius : CFG.defaultRadius) + CFG.radiusPadding;
    
    // ตรวจสอบกับระนาบทั้ง 6 ระนาบ
    // ถ้าจุดศูนย์กลางอยู่ห่างจากระนาบเกินกว่ารัศมี (ด้านนอก) แสดงว่าอยู่นอก Frustum แน่นอน
    const p = planes;
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      const dist = p[o] * x + p[o + 1] * y + p[o + 2] * z + p[o + 3];
      
      // สำหรับระนาบ Near (i === 4) เผื่อระยะพิเศษเพื่อไม่ให้วัตถุใกล้กล้องถูกตัด
      const margin = (i === 4) ? (r + CFG.nearPlaneOffset) : r;
      if (dist < -margin) {
        return false;
      }
    }
    
    return true;
  }

  // ==================== VISIBLE INDEX RANGES ====================
  // คัดกรองช่วง Index ของ Mesh ที่อยู่ในมุมมองกล้อง
  function getVisibleIndexRanges(obstacles, planes, maxDistance, eyePos) {
    if (!obstacles || !obstacles.length) return [];
    
    // หากไม่มี planes และไม่มีการจำกัดระยะทาง ให้แสดงทั้งหมด
    if (!planes && (!maxDistance || !eyePos || eyePos.length < 3)) {
      let minStart = Infinity, maxEnd = -Infinity;
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (!obs) continue;
        const start = obs.meshStart ?? obs.start ?? obs.offset;
        const end = obs.meshEnd ?? obs.end ?? (start + (obs.count || obs.length || 0));
        if (start !== undefined && end !== undefined && end > start) {
          if (start < minStart) minStart = start;
          if (end > maxEnd) maxEnd = end;
        }
      }
      if (minStart < maxEnd) return [{ start: minStart, end: maxEnd }];
      return [];
    }
    
    const ranges = [];
    const maxDistSq = (typeof maxDistance === "number" && maxDistance > 0) ? (maxDistance * maxDistance) : 0;
    
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (!obs) continue;
      
      const start = obs.meshStart ?? obs.start ?? obs.offset;
      const end = obs.meshEnd ?? obs.end ?? (start + (obs.count || obs.length || 0));
      if (start === undefined || end === undefined || end <= start) continue;
      
      const pos = obs.position || obs.pos;
      if (!pos || pos.length < 3) {
        // ไม่มีพิกัด -> วาดเสมอเพื่อความปลอดภัย
        ranges.push({ start, end });
        continue;
      }
      
      // วัตถุที่ผู้เล่นกำลังขับขี่ หรือกำลังถือ/ดูพรีวิว ห้าม Cull เด็ดขาด
      if (obs.isRiding || obs.activeRiding || (typeof global.activeRidingBoat !== "undefined" && global.activeRidingBoat === obs)) {
        ranges.push({ start, end });
        continue;
      }
      
      const radius = getBoundingRadius(obs);
      
      // Distance culling check (ถ้ามี)
      if (maxDistSq > 0 && eyePos && eyePos.length >= 3) {
        const dx = pos[0] - eyePos[0];
        const dy = pos[1] - eyePos[1];
        const dz = pos[2] - eyePos[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        const maxThreshold = maxDistance + radius;
        if (distSq > maxThreshold * maxThreshold) {
          continue;
        }
      }
      
      // Frustum culling check
      if (!planes || isSphereInFrustum(planes, pos, radius)) {
        ranges.push({ start, end });
      }
    }
    
    if (!ranges.length) return [];
    
    // รวมช่วงที่ต่อเนื่องหรือใกล้เคียงกันเพื่อลด Draw Calls
    ranges.sort((a, b) => a.start - b.start);
    
    const merged = [];
    let cur = { start: ranges[0].start, end: ranges[0].end };
    const GAP = 72; // รวมช่วงที่ห่างกันไม่เกิน 72 indices
    
    for (let i = 1; i < ranges.length; i++) {
      const next = ranges[i];
      if (next.start <= cur.end + GAP) {
        cur.end = Math.max(cur.end, next.end);
      } else {
        merged.push(cur);
        cur = { start: next.start, end: next.end };
      }
    }
    merged.push(cur);
    
    return merged;
  }

  // ==================== CLOUD CHUNKS CULLING ====================
  function getVisibleCloudRanges(chunks, orbitMatrix, planes) {
    if (!chunks || !chunks.length) return [];
    if (!planes) {
      return [{ start: 0, end: chunks[chunks.length - 1]?.meshEnd || 0 }];
    }

    const rotatedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const cx = chunk.position[0];
      const cy = chunk.position[1];
      const cz = chunk.position[2];
      
      if (orbitMatrix && orbitMatrix.length >= 16) {
        const rx = cx * orbitMatrix[0] + cy * orbitMatrix[4] + cz * orbitMatrix[8];
        const ry = cx * orbitMatrix[1] + cy * orbitMatrix[5] + cz * orbitMatrix[9];
        const rz = cx * orbitMatrix[2] + cy * orbitMatrix[6] + cz * orbitMatrix[10];
        rotatedChunks.push({
          position: [rx, ry, rz],
          radius: chunk.radius || 15.0,
          meshStart: chunk.meshStart,
          meshEnd: chunk.meshEnd,
          active: chunk.active,
          layer: chunk.layer
        });
      } else {
        rotatedChunks.push(chunk);
      }
    }
    return getVisibleIndexRanges(rotatedChunks, planes);
  }

  // ==================== SINGLE OBJECT VISIBILITY ====================
  function isObjectVisible(pos, radius = 1.0, options = {}) {
    if (!pos || pos.length < 3) return true;
    
    const enabled = options.frustumCullingEnabled !== undefined 
      ? options.frustumCullingEnabled 
      : (typeof global.frustumCullingEnabled !== 'undefined' ? global.frustumCullingEnabled : true);
      
    if (!enabled) return true;

    const planes = options.frustumPlanes || cachedPlanes || global.frustumPlanes;
    if (!planes) return true;

    if (options.maxDistance && options.eyePos) {
      const dx = pos[0] - options.eyePos[0];
      const dy = pos[1] - options.eyePos[1];
      const dz = pos[2] - options.eyePos[2];
      const distSq = dx*dx + dy*dy + dz*dz;
      if (distSq > options.maxDistance * options.maxDistance) {
        return false;
      }
    }

    return isSphereInFrustum(planes, pos, radius);
  }

  // ==================== API EXPORT ====================
  const API = {
    getFrustumPlanes,
    isSphereInFrustum,
    getBoundingRadius,
    getVisibleIndexRanges,
    getVisibleCloudRanges,
    isObjectVisible,
    updateFrustumPlanes,
    updateFrustumPlanesFromPV,
    multiplyMat4,
    config: CFG,
    setRadiusPadding: (v) => { CFG.radiusPadding = v; },
    setDefaultRadius: (v) => { CFG.defaultRadius = v; }
  };

  global.FrustumCullingSystem = API;
  global.getFrustumPlanes = getFrustumPlanes;
  global.isSphereInFrustum = isSphereInFrustum;
  global.getBoundingRadius = getBoundingRadius;
  global.getVisibleIndexRanges = getVisibleIndexRanges;
  global.getVisibleCloudRanges = getVisibleCloudRanges;
  global.isObjectVisible = isObjectVisible;
  global.updateFrustumPlanes = updateFrustumPlanes;

})(typeof window !== 'undefined' ? window : this);

