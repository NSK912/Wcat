// === SEEDPLANET MODULE: JS/ENVIRONMENT/UNDERWATERPLANTS.JS ===

(function (global) {
  "use strict";

  // Helper for generating tapered segments if not passed or available globally
  function localTaperedSegment(
    pStart,
    pEnd,
    rStart,
    rEnd,
    radialSegs,
    baseColor,
    vertices,
    colors,
    indices,
    addCaps = true
  ) {
    if (typeof global.buildTaperedSegment === "function") {
      return global.buildTaperedSegment(
        pStart,
        pEnd,
        rStart,
        rEnd,
        radialSegs,
        baseColor,
        vertices,
        colors,
        indices,
        addCaps
      );
    }

    let dx = pEnd[0] - pStart[0];
    let dy = pEnd[1] - pStart[1];
    let dz = pEnd[2] - pStart[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    let nx = dx / len;
    let ny = dy / len;
    let nz = dz / len;

    let rx = 1.0, ry = 0.0, rz = 0.0;
    if (Math.abs(nx) > 0.9) {
      rx = 0.0; ry = 1.0; rz = 0.0;
    }

    let fx = ny * rz - nz * ry;
    let fy = nz * rx - nx * rz;
    let fz = nx * ry - ny * rx;
    const lenF = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= lenF; fy /= lenF; fz /= lenF;

    rx = fy * nz - fz * ny;
    ry = fz * nx - fx * nz;
    rz = fx * ny - fy * nx;
    const lenR = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= lenR; ry /= lenR; rz /= lenR;

    const baseIdx = vertices.length / 3;

    for (let s = 0; s < radialSegs; s++) {
      const angle = (s / radialSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const sx = pStart[0] + rStart * (cosA * rx + sinA * fx);
      const sy = pStart[1] + rStart * (cosA * ry + sinA * fy);
      const sz = pStart[2] + rStart * (cosA * rz + sinA * fz);

      vertices.push(sx, sy, sz);
      colors.push(baseColor[0], baseColor[1], baseColor[2]);
    }

    for (let s = 0; s < radialSegs; s++) {
      const angle = (s / radialSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const ex = pEnd[0] + rEnd * (cosA * rx + sinA * fx);
      const ey = pEnd[1] + rEnd * (cosA * ry + sinA * fy);
      const ez = pEnd[2] + rEnd * (cosA * rz + sinA * fz);

      vertices.push(ex, ey, ez);
      colors.push(baseColor[0], baseColor[1], baseColor[2]);
    }

    for (let s = 0; s < radialSegs; s++) {
      const nextS = (s + 1) % radialSegs;
      const p0 = baseIdx + s;
      const p1 = baseIdx + nextS;
      const p2 = baseIdx + radialSegs + s;
      const p3 = baseIdx + radialSegs + nextS;

      indices.push(p0, p1, p3);
      indices.push(p0, p3, p2);
    }

    if (addCaps) {
      const bottomCenterIdx = vertices.length / 3;
      vertices.push(pStart[0], pStart[1], pStart[2]);
      colors.push(baseColor[0] * 0.8, baseColor[1] * 0.8, baseColor[2] * 0.8);
      for (let s = 0; s < radialSegs; s++) {
        const nextS = (s + 1) % radialSegs;
        indices.push(bottomCenterIdx, baseIdx + nextS, baseIdx + s);
      }

      const topCenterIdx = vertices.length / 3;
      vertices.push(pEnd[0], pEnd[1], pEnd[2]);
      colors.push(baseColor[0] * 0.8, baseColor[1] * 0.8, baseColor[2] * 0.8);
      for (let s = 0; s < radialSegs; s++) {
        const nextS = (s + 1) % radialSegs;
        indices.push(topCenterIdx, baseIdx + radialSegs + s, baseIdx + radialSegs + nextS);
      }
    }
  }

  function buildSeaweed(
    wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
  ) {
    const segmentFunc = segmentBuilder || localTaperedSegment;
    const stalkCount = 3 + Math.floor(prng() * 3);

    let stalkColor = [0.08, 0.52, 0.38]; // เขียวมรกตน้ำทะเล
    const colorVar = prng();
    if (colorVar > 0.7) {
      stalkColor = [0.42, 0.48, 0.12]; // มะกอกอมเหลืองแบบเคลป์
    } else if (colorVar > 0.4) {
      stalkColor = [0.05, 0.42, 0.45]; // ฟ้าอมเขียวเทอร์ควอยซ์
    }

    for (let sIdx = 0; sIdx < stalkCount; sIdx++) {
      const angle = (sIdx / stalkCount) * Math.PI * 2 + prng() * 0.5;
      const spread = 0.15 + prng() * 0.2;

      const sDirX = nx + (Math.cos(angle) * R[0] + Math.sin(angle) * F[0]) * spread;
      const sDirY = ny + (Math.cos(angle) * R[1] + Math.sin(angle) * F[1]) * spread;
      const sDirZ = nz + (Math.cos(angle) * R[2] + Math.sin(angle) * F[2]) * spread;

      const lenS = Math.sqrt(sDirX * sDirX + sDirY * sDirY + sDirZ * sDirZ) || 1;
      const sDirNorm = [sDirX / lenS, sDirY / lenS, sDirZ / lenS];

      const heightScale = 0.15 + prng() * 0.20;
      const numSegs = 3 + Math.floor(prng() * 2); // 3-4 ข้อต่อ
      const baseRadius = 0.02 + prng() * 0.015;

      let currPoint = [wx, wy, wz];

      for (let j = 1; j <= numSegs; j++) {
        const swayX = Math.sin(j * 0.8 + sIdx * 1.5 + seed) * 0.03 * heightScale;
        const swayZ = Math.cos(j * 0.8 + sIdx * 1.5 + seed) * 0.03 * heightScale;

        const stepDist = heightScale / numSegs;
        const nextPoint = [
          currPoint[0] + sDirNorm[0] * stepDist + R[0] * swayX + F[0] * swayZ,
          currPoint[1] + sDirNorm[1] * stepDist + R[1] * swayX + F[1] * swayZ,
          currPoint[2] + sDirNorm[2] * stepDist + R[2] * swayX + F[2] * swayZ,
        ];

        const rStart = baseRadius * (1.0 - (0.7 * (j - 1)) / numSegs);
        const rEnd = baseRadius * (1.0 - (0.7 * j) / numSegs);

        let segColor = [
          Math.max(0.01, Math.min(0.4, stalkColor[0] + (prng() - 0.5) * 0.04)),
          Math.max(0.38, Math.min(0.95, stalkColor[1] + (prng() - 0.5) * 0.04)),
          Math.max(0.01, Math.min(0.48, stalkColor[2] + (prng() - 0.5) * 0.04)),
        ];

        segmentFunc(
          currPoint,
          nextPoint,
          rStart,
          rEnd,
          3,
          segColor,
          vertices,
          colors,
          indices,
          false
        );

        // ใบสาหร่ายเล็กๆ สองข้าง (Seaweed blades)
        if (j < numSegs) {
          const bAngle = angle + Math.PI / 2;
          const bDirX = Math.cos(bAngle) * R[0] + Math.sin(bAngle) * F[0];
          const bDirY = Math.cos(bAngle) * R[1] + Math.sin(bAngle) * F[1];
          const bDirZ = Math.cos(bAngle) * R[2] + Math.sin(bAngle) * F[2];

          const bLen = Math.sqrt(bDirX * bDirX + bDirY * bDirY + bDirZ * bDirZ) || 1;
          const bNorm = [bDirX / bLen, bDirY / bLen, bDirZ / bLen];

          const bladeLen = heightScale * (0.15 + prng() * 0.15);
          const leafTip = [
            nextPoint[0] + bNorm[0] * bladeLen + sDirNorm[0] * (bladeLen * 0.5),
            nextPoint[1] + bNorm[1] * bladeLen + sDirNorm[1] * (bladeLen * 0.5),
            nextPoint[2] + bNorm[2] * bladeLen + sDirNorm[2] * (bladeLen * 0.5),
          ];

          segmentFunc(
            nextPoint,
            leafTip,
            rEnd,
            0.002,
            3,
            segColor,
            vertices,
            colors,
            indices,
            false
          );

          // ใบอีกข้าง
          const bNormOpp = [-bNorm[0], -bNorm[1], -bNorm[2]];
          const leafTipOpp = [
            nextPoint[0] + bNormOpp[0] * bladeLen + sDirNorm[0] * (bladeLen * 0.5),
            nextPoint[1] + bNormOpp[1] * bladeLen + sDirNorm[1] * (bladeLen * 0.5),
            nextPoint[2] + bNormOpp[2] * bladeLen + sDirNorm[2] * (bladeLen * 0.5),
          ];

          segmentFunc(
            nextPoint,
            leafTipOpp,
            rEnd,
            0.002,
            3,
            segColor,
            vertices,
            colors,
            indices,
            false
          );
        }

        currPoint = nextPoint;
      }
    }
  }

  function buildCoral(
    wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
  ) {
    const segmentFunc = segmentBuilder || localTaperedSegment;

    let coralColor = [0.88, 0.32, 0.45]; // ชมพูฟูเชียปะการัง
    const coralVar = prng();
    if (coralVar > 0.75) {
      coralColor = [0.92, 0.45, 0.22]; // แสดส้มแนวปะการัง
    } else if (coralVar > 0.5) {
      coralColor = [0.55, 0.28, 0.78]; // ม่วงสว่างสวยงาม
    } else if (coralVar > 0.25) {
      coralColor = [0.22, 0.65, 0.88]; // ฟ้าสวรรค์ทะเลลึก
    }

    const branchCount = 3 + Math.floor(prng() * 3);
    const coralScale = 0.08 + prng() * 0.08;

    for (let bIdx = 0; bIdx < branchCount; bIdx++) {
      const bAngle = (bIdx / branchCount) * Math.PI * 2 + prng() * 0.4;
      const bSpread = 0.3 + prng() * 0.4;

      const bDirX = nx + (Math.cos(bAngle) * R[0] + Math.sin(bAngle) * F[0]) * bSpread;
      const bDirY = ny + (Math.cos(bAngle) * R[1] + Math.sin(bAngle) * F[1]) * bSpread;
      const bDirZ = nz + (Math.cos(bAngle) * R[2] + Math.sin(bAngle) * F[2]) * bSpread;

      const lenB = Math.sqrt(bDirX * bDirX + bDirY * bDirY + bDirZ * bDirZ) || 1;
      const bDirNorm = [bDirX / lenB, bDirY / lenB, bDirZ / lenB];

      let bp = [wx, wy, wz];
      const numSegs = 3;
      const baseRadius = coralScale * 0.22;

      for (let j = 1; j <= numSegs; j++) {
        const stepDist = coralScale / numSegs;
        const cxNoise = Math.sin(j * 1.5 + bIdx * 2.3 + seed) * 0.08 * coralScale;
        const czNoise = Math.cos(j * 1.5 + bIdx * 2.3 + seed + 20) * 0.08 * coralScale;

        const nextBp = [
          bp[0] + bDirNorm[0] * stepDist + R[0] * cxNoise + F[0] * czNoise,
          bp[1] + bDirNorm[1] * stepDist + R[1] * cxNoise + F[1] * czNoise,
          bp[2] + bDirNorm[2] * stepDist + R[2] * cxNoise + F[2] * czNoise,
        ];

        const rStart = baseRadius * (1.0 - (0.5 * (j - 1)) / numSegs);
        const rEnd = baseRadius * (1.0 - (0.5 * j) / numSegs);

        segmentFunc(
          bp,
          nextBp,
          rStart,
          rEnd,
          3,
          coralColor,
          vertices,
          colors,
          indices,
          false
        );

        if (j === 2 && prng() > 0.3) {
          const subAngle = bAngle + (prng() > 0.5 ? 1.0 : -1.0) * (0.6 + prng() * 0.4);
          const subDirX = bDirNorm[0] * 0.7 + (Math.cos(subAngle) * R[0] + Math.sin(subAngle) * F[0]) * 0.5;
          const subDirY = bDirNorm[1] * 0.7 + (Math.cos(subAngle) * R[1] + Math.sin(subAngle) * F[1]) * 0.5;
          const subDirZ = bDirNorm[2] * 0.7 + (Math.cos(subAngle) * R[2] + Math.sin(subAngle) * F[2]) * 0.5;

          const lenSub = Math.sqrt(subDirX * subDirX + subDirY * subDirY + subDirZ * subDirZ) || 1;
          const subDirNorm = [subDirX / lenSub, subDirY / lenSub, subDirZ / lenSub];

          const subLength = coralScale * (0.4 + prng() * 0.3);
          const subEnd = [
            nextBp[0] + subDirNorm[0] * subLength,
            nextBp[1] + subDirNorm[1] * subLength,
            nextBp[2] + subDirNorm[2] * subLength,
          ];

          segmentFunc(
            nextBp,
            subEnd,
            rStart * 0.65,
            rEnd * 0.4,
            3,
            coralColor,
            vertices,
            colors,
            indices,
            false
          );
        }

        bp = nextBp;
      }
    }
  }

  function buildAnemone(
    wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
  ) {
    const segmentFunc = segmentBuilder || localTaperedSegment;
    const tentacleCount = 7 + Math.floor(prng() * 5);
    const scale = 0.08 + prng() * 0.08;

    // สีเรืองแสงใต้น้ำ (Bioluminescent colors: Cyan / Neon Magenta / Electric Green / Violet)
    let baseColor = [0.12, 0.85, 0.95]; // สีฟ้าเรืองแสง
    const colorType = prng();
    if (colorType > 0.7) {
      baseColor = [0.95, 0.25, 0.82]; // ชมพูมาเจนต้าเรืองแสง
    } else if (colorType > 0.4) {
      baseColor = [0.25, 0.92, 0.45]; // เขียวนีออน
    } else if (colorType > 0.2) {
      baseColor = [0.72, 0.35, 0.98]; // ม่วงออโรร่า
    }

    // ฐานของดอกไม้ทะเล (Central Pedestal Base)
    const basePStart = [wx, wy, wz];
    const basePEnd = [
      wx + nx * (scale * 0.25),
      wy + ny * (scale * 0.25),
      wz + nz * (scale * 0.25),
    ];
    segmentFunc(
      basePStart,
      basePEnd,
      scale * 0.2,
      scale * 0.25,
      4,
      [baseColor[0] * 0.6, baseColor[1] * 0.6, baseColor[2] * 0.6],
      vertices,
      colors,
      indices,
      false
    );

    // หนวดระโยงระยาง (Tentacles radiating outwards and fanning up)
    for (let t = 0; t < tentacleCount; t++) {
      const angle = (t / tentacleCount) * Math.PI * 2 + prng() * 0.2;
      const spread = 0.4 + prng() * 0.4;

      const tDirX = nx + (Math.cos(angle) * R[0] + Math.sin(angle) * F[0]) * spread;
      const tDirY = ny + (Math.cos(angle) * R[1] + Math.sin(angle) * F[1]) * spread;
      const tDirZ = nz + (Math.cos(angle) * R[2] + Math.sin(angle) * F[2]) * spread;

      const lenT = Math.sqrt(tDirX * tDirX + tDirY * tDirY + tDirZ * tDirZ) || 1;
      const tNorm = [tDirX / lenT, tDirY / lenT, tDirZ / lenT];

      let currP = [basePEnd[0], basePEnd[1], basePEnd[2]];
      const numSegs = 3;

      for (let j = 1; j <= numSegs; j++) {
        const step = scale / numSegs;
        const curveX = Math.sin(j * 1.2 + t * 0.8 + seed) * 0.05 * scale;
        const curveZ = Math.cos(j * 1.2 + t * 0.8 + seed) * 0.05 * scale;

        const nextP = [
          currP[0] + tNorm[0] * step + R[0] * curveX + F[0] * curveZ,
          currP[1] + tNorm[1] * step + R[1] * curveX + F[1] * curveZ,
          currP[2] + tNorm[2] * step + R[2] * curveX + F[2] * curveZ,
        ];

        const rStart = scale * 0.08 * (1.0 - (0.6 * (j - 1)) / numSegs);
        const rEnd = scale * 0.08 * (1.0 - (0.6 * j) / numSegs);

        // ปลายหนวดจะมีสีสว่างขึ้นเสมือนเรืองแสง
        const glowFactor = 0.7 + (j / numSegs) * 0.5;
        const segColor = [
          Math.min(1.0, baseColor[0] * glowFactor),
          Math.min(1.0, baseColor[1] * glowFactor),
          Math.min(1.0, baseColor[2] * glowFactor),
        ];

        segmentFunc(
          currP,
          nextP,
          rStart,
          rEnd,
          3,
          segColor,
          vertices,
          colors,
          indices,
          false
        );

        currP = nextP;
      }
    }
  }

  // ปะการังสมอง/โขดปะการัง (Brain / Dome Coral)
  function buildBrainCoral(
    wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
  ) {
    const segmentFunc = segmentBuilder || localTaperedSegment;
    const scale = 0.09 + prng() * 0.09;

    let baseColor = [0.95, 0.72, 0.18]; // เหลืองทองปะการัง
    const cType = prng();
    if (cType > 0.75) {
      baseColor = [0.92, 0.28, 0.38]; // แดงชาดปะการัง
    } else if (cType > 0.5) {
      baseColor = [0.18, 0.82, 0.65]; // มินต์เทอร์ควอยซ์
    } else if (cType > 0.25) {
      baseColor = [0.68, 0.35, 0.88]; // ม่วงลาเวนเดอร์
    }

    const lobeCount = 4 + Math.floor(prng() * 3);
    const centerStart = [wx, wy, wz];
    const centerEnd = [
      wx + nx * (scale * 0.5),
      wy + ny * (scale * 0.5),
      wz + nz * (scale * 0.5),
    ];

    segmentFunc(
      centerStart,
      centerEnd,
      scale * 0.35,
      scale * 0.45,
      5,
      baseColor,
      vertices,
      colors,
      indices,
      true
    );

    for (let l = 0; l < lobeCount; l++) {
      const angle = (l / lobeCount) * Math.PI * 2 + prng() * 0.3;
      const spread = 0.25 + prng() * 0.25;

      const lStart = [
        centerEnd[0] + (Math.cos(angle) * R[0] + Math.sin(angle) * F[0]) * (scale * 0.15),
        centerEnd[1] + (Math.cos(angle) * R[1] + Math.sin(angle) * F[1]) * (scale * 0.15),
        centerEnd[2] + (Math.cos(angle) * R[2] + Math.sin(angle) * F[2]) * (scale * 0.15),
      ];

      const lEnd = [
        lStart[0] + (nx * 0.7 + (Math.cos(angle) * R[0] + Math.sin(angle) * F[0]) * spread) * (scale * 0.35),
        lStart[1] + (ny * 0.7 + (Math.cos(angle) * R[1] + Math.sin(angle) * F[1]) * spread) * (scale * 0.35),
        lStart[2] + (nz * 0.7 + (Math.cos(angle) * R[2] + Math.sin(angle) * F[2]) * spread) * (scale * 0.35),
      ];

      const lobeColor = [
        Math.min(1.0, baseColor[0] * 1.1),
        Math.min(1.0, baseColor[1] * 1.1),
        Math.min(1.0, baseColor[2] * 1.1),
      ];

      segmentFunc(
        lStart,
        lEnd,
        scale * 0.22,
        scale * 0.12,
        4,
        lobeColor,
        vertices,
        colors,
        indices,
        true
      );
    }
  }

  // ปะการังโต๊ะ/ปะการังพัด (Table / Fan Coral)
  function buildTableCoral(
    wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
  ) {
    const segmentFunc = segmentBuilder || localTaperedSegment;
    const scale = 0.10 + prng() * 0.08;

    let baseColor = [0.22, 0.75, 0.88]; // ฟ้าคราม
    const cType = prng();
    if (cType > 0.7) {
      baseColor = [0.92, 0.42, 0.65]; // ชมพูบานเย็น
    } else if (cType > 0.4) {
      baseColor = [0.95, 0.58, 0.22]; // แสดส้ม
    }

    // ลำต้นหลักทรงกรวย
    const stemStart = [wx, wy, wz];
    const stemEnd = [
      wx + nx * (scale * 0.6),
      wy + ny * (scale * 0.6),
      wz + nz * (scale * 0.6),
    ];

    segmentFunc(
      stemStart,
      stemEnd,
      scale * 0.12,
      scale * 0.25,
      4,
      [baseColor[0] * 0.7, baseColor[1] * 0.7, baseColor[2] * 0.7],
      vertices,
      colors,
      indices,
      false
    );

    // แผ่นโต๊ะปะการังแผ่ขยาย (Radiating Platter)
    const platterSegs = 7;
    for (let p = 0; p < platterSegs; p++) {
      const angle = (p / platterSegs) * Math.PI * 2;
      const pSpread = scale * (0.45 + prng() * 0.2);

      const pTip = [
        stemEnd[0] + (Math.cos(angle) * R[0] + Math.sin(angle) * F[0]) * pSpread + nx * (scale * 0.05),
        stemEnd[1] + (Math.cos(angle) * R[1] + Math.sin(angle) * F[1]) * pSpread + ny * (scale * 0.05),
        stemEnd[2] + (Math.cos(angle) * R[2] + Math.sin(angle) * F[2]) * pSpread + nz * (scale * 0.05),
      ];

      segmentFunc(
        stemEnd,
        pTip,
        scale * 0.20,
        scale * 0.08,
        3,
        baseColor,
        vertices,
        colors,
        indices,
        true
      );
    }
  }

  function buildUnderwaterPlant(
    wx, wy, wz, nx, ny, nz, R, F, N, seed, vertices, colors, indices, segmentBuilder
  ) {
    let prng = (function (s) {
      return function () {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
    })(seed);

    const type = prng();

    if (type < 0.35) {
      buildSeaweed(
        wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
      );
    } else if (type < 0.62) {
      buildCoral(
        wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
      );
    } else if (type < 0.78) {
      buildBrainCoral(
        wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
      );
    } else if (type < 0.90) {
      buildTableCoral(
        wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
      );
    } else {
      buildAnemone(
        wx, wy, wz, nx, ny, nz, R, F, N, seed, prng, vertices, colors, indices, segmentBuilder
      );
    }
  }

  const UnderwaterPlantSystem = {
    buildUnderwaterPlant,
    buildSeaweed,
    buildCoral,
    buildBrainCoral,
    buildTableCoral,
    buildAnemone,
    getWaterPlantSway: function () {
      return typeof global.waterPlantSway === "number" ? global.waterPlantSway : 1.0;
    },
    setWaterPlantSway: function (val) {
      global.waterPlantSway = val;
    }
  };

  global.UnderwaterPlantSystem = UnderwaterPlantSystem;
  global.UnderwaterPlantsSystem = UnderwaterPlantSystem;
  global.buildUnderwaterPlant = buildUnderwaterPlant;

})(typeof window !== "undefined" ? window : this);
