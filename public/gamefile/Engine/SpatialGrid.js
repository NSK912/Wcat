// === SEEDPLANET ENGINE: SPATIAL HASH GRID SYSTEM ===
// ระบบ Spatial Partitioning แบบ 3D Hash Grid
// ช่วยลดเวลาค้นหาวัตถุ / สิ่งปลูกสร้าง / ไอเทม จาก O(N) เป็น O(1)
// ทำให้รองรับไอเทมและบ้านได้นับหมื่นชิ้นโดยไม่ทำให้ CPU กระตุก

(function(global) {
  'use strict';

  const CELL_SIZE = 4.0; // 4.0 เมตร เหมาะสมที่สุดสำหรับขนาดตัวละครและระยะปฏิสัมพันธ์ (1.0 - 3.5m)
  const INV_CELL_SIZE = 1.0 / CELL_SIZE;

  class SpatialGridSystem {
    constructor() {
      this.cellSize = CELL_SIZE;
      this.invCellSize = INV_CELL_SIZE;
      // Key: "cx,cy,cz" -> Array of items
      this.cells = new Map();
      this.dynamicItems = [];
      this.lastSourceArray = null;
      this.lastLength = -1;
      this.version = 0;
    }

    _getCellCoord(val) {
      return Math.floor(val * this.invCellSize);
    }

    _getCellKey(cx, cy, cz) {
      return `${cx},${cy},${cz}`;
    }

    clear() {
      this.cells.clear();
      this.dynamicItems.length = 0;
      this.lastSourceArray = null;
      this.lastLength = -1;
      this.version++;
    }

    // สร้างตาราง Spatial Grid ใหม่จากรายการของในโลก
    rebuild(sourceArray) {
      this.cells.clear();
      this.dynamicItems.length = 0;

      if (!sourceArray) {
        sourceArray = global.collectibles;
      }
      if (!sourceArray || !Array.isArray(sourceArray)) {
        this.lastSourceArray = null;
        this.lastLength = 0;
        return;
      }

      this.lastSourceArray = sourceArray;
      this.lastLength = sourceArray.length;
      this.version++;

      for (let i = 0; i < sourceArray.length; i++) {
        const item = sourceArray[i];
        if (!item || !item.active || !item.position) continue;

        if (item.isDynamic) {
          this.dynamicItems.push(item);
        }

        const cx = this._getCellCoord(item.position[0]);
        const cy = this._getCellCoord(item.position[1]);
        const cz = this._getCellCoord(item.position[2]);
        const key = this._getCellKey(cx, cy, cz);

        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(item);
      }
    }

    // ตรวจสอบและซิงค์อัตโนมัติหากจำนวนวัตถุมีการเปลี่ยนแปลง
    ensureSynced(sourceArray) {
      if (!sourceArray) {
        sourceArray = global.collectibles;
      }
      if (!sourceArray || !Array.isArray(sourceArray)) return;

      if (sourceArray !== this.lastSourceArray || sourceArray.length !== this.lastLength) {
        this.rebuild(sourceArray);
      }
    }

    // แทรกไอเทมชิ้นใหม่เข้ากริดทันที (เช่น เมื่อวางสิ่งปลูกสร้าง)
    insert(item) {
      if (!item || !item.active || !item.position) return;
      if (item.isDynamic && !this.dynamicItems.includes(item)) {
        this.dynamicItems.push(item);
      }
      const cx = this._getCellCoord(item.position[0]);
      const cy = this._getCellCoord(item.position[1]);
      const cz = this._getCellCoord(item.position[2]);
      const key = this._getCellKey(cx, cy, cz);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = [];
        this.cells.set(key, cell);
      }
      if (!cell.includes(item)) {
        cell.push(item);
      }
      if (this.lastSourceArray && Array.isArray(this.lastSourceArray)) {
        this.lastLength = this.lastSourceArray.length;
      }
      this.version++;
    }

    // ค้นหาวัตถุในรัศมี (x, y, z, radius)
    // สามารถใส่ filterFn(item) เพื่อคัดกรองประเภทที่ต้องการได้ทันที
    queryRadius(x, y, z, radius, filterFn) {
      this.ensureSynced();

      const r = radius > 0 ? radius : 1.0;
      const rSq = r * r;
      const minX = this._getCellCoord(x - r);
      const maxX = this._getCellCoord(x + r);
      const minY = this._getCellCoord(y - r);
      const maxY = this._getCellCoord(y + r);
      const minZ = this._getCellCoord(z - r);
      const maxZ = this._getCellCoord(z + r);

      const results = [];
      const seen = new Set();

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          for (let cz = minZ; cz <= maxZ; cz++) {
            const key = this._getCellKey(cx, cy, cz);
            const cell = this.cells.get(key);
            if (!cell) continue;

            for (let i = 0; i < cell.length; i++) {
              const item = cell[i];
              if (!item.active || seen.has(item) || !item.position) continue;

              const dx = item.position[0] - x;
              const dy = item.position[1] - y;
              const dz = item.position[2] - z;
              if (dx * dx + dy * dy + dz * dz <= rSq) {
                seen.add(item);
                if (!filterFn || filterFn(item)) {
                  results.push(item);
                }
              }
            }
          }
        }
      }

      // ตรวจสอบวัตถุเคลื่อนที่ (Dynamic Objects)
      for (let i = 0; i < this.dynamicItems.length; i++) {
        const item = this.dynamicItems[i];
        if (!item.active || seen.has(item) || !item.position) continue;
        const dx = item.position[0] - x;
        const dy = item.position[1] - y;
        const dz = item.position[2] - z;
        if (dx * dx + dy * dy + dz * dz <= rSq) {
          seen.add(item);
          if (!filterFn || filterFn(item)) {
            results.push(item);
          }
        }
      }

      return results;
    }

    // ค้นหาวัตถุใกล้เส้นสายตา / ลำเส้นกล้อง (Segment between p0 and p1)
    querySegment(p0, p1, radius, filterFn) {
      this.ensureSynced();

      const minX = Math.min(p0[0], p1[0]) - radius;
      const maxX = Math.max(p0[0], p1[0]) + radius;
      const minY = Math.min(p0[1], p1[1]) - radius;
      const maxY = Math.max(p0[1], p1[1]) + radius;
      const minZ = Math.min(p0[2], p1[2]) - radius;
      const maxZ = Math.max(p0[2], p1[2]) + radius;

      const minCX = this._getCellCoord(minX);
      const maxCX = this._getCellCoord(maxX);
      const minCY = this._getCellCoord(minY);
      const maxCY = this._getCellCoord(maxY);
      const minCZ = this._getCellCoord(minZ);
      const maxCZ = this._getCellCoord(maxZ);

      const results = [];
      const seen = new Set();
      const rSq = radius * radius;

      const vx = p1[0] - p0[0];
      const vy = p1[1] - p0[1];
      const vz = p1[2] - p0[2];
      const vLenSq = vx * vx + vy * vy + vz * vz;

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          for (let cz = minCZ; cz <= maxCZ; cz++) {
            const key = this._getCellKey(cx, cy, cz);
            const cell = this.cells.get(key);
            if (!cell) continue;

            for (let i = 0; i < cell.length; i++) {
              const item = cell[i];
              if (!item.active || seen.has(item) || !item.position) continue;

              let distSq;
              if (vLenSq < 1e-6) {
                const dx = item.position[0] - p0[0];
                const dy = item.position[1] - p0[1];
                const dz = item.position[2] - p0[2];
                distSq = dx * dx + dy * dy + dz * dz;
              } else {
                const wx = item.position[0] - p0[0];
                const wy = item.position[1] - p0[1];
                const wz = item.position[2] - p0[2];
                const t = Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / vLenSq));
                const px = p0[0] + t * vx;
                const py = p0[1] + t * vy;
                const pz = p0[2] + t * vz;
                const dx = item.position[0] - px;
                const dy = item.position[1] - py;
                const dz = item.position[2] - pz;
                distSq = dx * dx + dy * dy + dz * dz;
              }

              if (distSq <= rSq) {
                seen.add(item);
                if (!filterFn || filterFn(item)) {
                  results.push(item);
                }
              }
            }
          }
        }
      }

      // วัตถุ Dynamic
      for (let i = 0; i < this.dynamicItems.length; i++) {
        const item = this.dynamicItems[i];
        if (!item.active || seen.has(item) || !item.position) continue;

        let distSq;
        if (vLenSq < 1e-6) {
          const dx = item.position[0] - p0[0];
          const dy = item.position[1] - p0[1];
          const dz = item.position[2] - p0[2];
          distSq = dx * dx + dy * dy + dz * dz;
        } else {
          const wx = item.position[0] - p0[0];
          const wy = item.position[1] - p0[1];
          const wz = item.position[2] - p0[2];
          const t = Math.max(0, Math.min(1, (wx * vx + wy * vy + wz * vz) / vLenSq));
          const px = p0[0] + t * vx;
          const py = p0[1] + t * vy;
          const pz = p0[2] + t * vz;
          const dx = item.position[0] - px;
          const dy = item.position[1] - py;
          const dz = item.position[2] - pz;
          distSq = dx * dx + dy * dy + dz * dz;
        }

        if (distSq <= rSq) {
          seen.add(item);
          if (!filterFn || filterFn(item)) {
            results.push(item);
          }
        }
      }

      return results;
    }
  }

  const SpatialGrid = new SpatialGridSystem();
  global.SpatialGrid = SpatialGrid;

})(typeof window !== 'undefined' ? window : this);
