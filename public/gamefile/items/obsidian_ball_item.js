// === SEEDPLANET MODULE: JS/ITEMS/OBSIDIAN_BALL_ITEM.JS ===
// Gilded Obsidian Sphere / Ball (OBSIDIAN_BALL)
// Crafted from 1x Obsidian Cube + 1x Glow Ore -> 5x Obsidian Ball

(function() {
  window.buildObsidianBallModel = function(
    seed,
    animPhase,
    isRagdoll,
    isSwimming,
    scaleMultiplier,
    pos,
    R,
    N,
    F,
    vertices,
    colors,
    indices,
    overrideColors = null,
    f = null,
    transformPoint = null,
    c = null
  ) {
    const basePos = (pos && Array.isArray(pos) && pos.length >= 3)
      ? pos
      : ((c && c.position) || [0, 0, 0]);
    const itemR = R || [1, 0, 0];
    const itemN = N || [0, 1, 0];
    const itemF = F || [0, 0, 1];
    const isIconPreview = Boolean(c && c.isIconPreview);

    if (!transformPoint) {
      transformPoint = (px, py, pz) => [
        basePos[0] + (px * itemR[0] + py * itemN[0] + pz * itemF[0]),
        basePos[1] + (px * itemR[1] + py * itemN[1] + pz * itemF[1]),
        basePos[2] + (px * itemR[2] + py * itemN[2] + pz * itemF[2]),
      ];
    }

    const radius = 0.26 * (scaleMultiplier || 1.0);

    // Inverse of create3DIconCanvas static preview rotation (ry = 2.0, rx = 0.53407)
    // so that in UI icons and in-world, the diagonal pole axis and curved gold frame match the reference art
    const cosRy = Math.cos(2.0);
    const sinRy = Math.sin(2.0);
    const cosRx = Math.cos(0.53407);
    const sinRx = Math.sin(0.53407);

    function screenToLocal(sx, sy, sz) {
      const y = sy * cosRx + sz * sinRx;
      const z1 = -sy * sinRx + sz * cosRx;
      const x = sx * cosRy + z1 * sinRy;
      const z = -sx * sinRy + z1 * cosRy;
      return [x, y, z];
    }

    // Orthonormal basis in screen-aligned space:
    // Axis A: points toward top-left obsidian cap (+1) and bottom-right gold cap (-1)
    let ax = -0.61, ay = 0.75, az = -0.25;
    const aLen = Math.hypot(ax, ay, az) || 1;
    ax /= aLen; ay /= aLen; az /= aLen;

    // Axis B: points toward viewer front (-Z in screen space), orthogonalized to A
    let bx = 0.0, by = 0.0, bz = -1.0;
    const dotAB = bx * ax + by * ay + bz * az;
    bx -= dotAB * ax;
    by -= dotAB * ay;
    bz -= dotAB * az;
    const bLen = Math.hypot(bx, by, bz) || 1;
    bx /= bLen; by /= bLen; bz /= bLen;

    // Axis C = A x B (points along equator from bottom-left to top-right)
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;

    const segsLat = 40;
    const segsLon = 48;

    // Studio light direction in screen space (upper-left-front for sleek satin + metallic specular)
    const lx = -0.35, ly = 0.62, lz = -0.70;

    for (let lat = 0; lat < segsLat; lat++) {
      const theta0 = (lat / segsLat) * Math.PI;
      const theta1 = ((lat + 1) / segsLat) * Math.PI;
      const tMid = Math.cos((theta0 + theta1) * 0.5);

      for (let lon = 0; lon < segsLon; lon++) {
        const phi0 = (lon / segsLon) * Math.PI * 2 - Math.PI;
        const phi1 = ((lon + 1) / segsLon) * Math.PI * 2 - Math.PI;
        const phiMid = (phi0 + phi1) * 0.5;

        // Determine material zone and subtle 3D groove depth at (tMid, phiMid)
        let matType = "obsidian"; // "obsidian" | "gold" | "groove" | "rib"
        let rScale0 = 1.0;
        let rScale1 = 1.0;

        if (tMid > 0.355) {
          // Top-left matte obsidian cap
          matType = "obsidian";
          if (Math.abs(phiMid + 0.62) < 0.055 && tMid < 0.88) {
            matType = "groove";
            rScale0 = 0.990;
            rScale1 = 0.990;
          }
        } else if (tMid > 0.245) {
          // Upper double black groove ring
          if (tMid > 0.285 && tMid < 0.315) {
            matType = "rib";
            rScale0 = 0.994;
            rScale1 = 0.994;
          } else {
            matType = "groove";
            rScale0 = 0.970;
            rScale1 = 0.970;
          }
        } else if (tMid >= -0.245) {
          // Central equatorial band: gold collar rims + curved side gold bridges + central matte black panel
          const absSinPhi = Math.abs(Math.sin(phiMid));
          const sideCurve = Math.pow(absSinPhi, 2.2);
          const panelLimitT = 0.188 * Math.max(0.0, 1.0 - 1.18 * sideCurve);
          const absT = Math.abs(tMid);

          if (absSinPhi > 0.88 || absT > panelLimitT) {
            matType = "gold";
            rScale0 = 1.004;
            rScale1 = 1.004;
          } else if (absT > panelLimitT - 0.016) {
            matType = "groove";
            rScale0 = 0.992;
            rScale1 = 0.992;
          } else {
            matType = "obsidian";
          }
        } else if (tMid >= -0.355) {
          // Lower double black groove ring
          if (tMid < -0.285 && tMid > -0.315) {
            matType = "rib";
            rScale0 = 0.994;
            rScale1 = 0.994;
          } else {
            matType = "groove";
            rScale0 = 0.970;
            rScale1 = 0.970;
          }
        } else {
          // Bottom-right metallic gold cap
          matType = "gold";
          rScale0 = 1.003;
          rScale1 = 1.003;
          if (Math.abs(phiMid - 0.48) < 0.05 && tMid > -0.90) {
            matType = "groove";
            rScale0 = 0.990;
            rScale1 = 0.990;
          }
        }

        // Compute face normal at center of quad in screen space for studio shading
        const sinTM = Math.sin((theta0 + theta1) * 0.5);
        const cosPM = Math.cos(phiMid);
        const sinPM = Math.sin(phiMid);
        const nsx = ax * tMid + (bx * cosPM + cx * sinPM) * sinTM;
        const nsy = ay * tMid + (by * cosPM + cy * sinPM) * sinTM;
        const nsz = az * tMid + (bz * cosPM + cz * sinPM) * sinTM;

        const ndotl = Math.max(0.0, nsx * lx + nsy * ly + nsz * lz);
        let hx = lx, hy = ly, hz = lz - 1.0;
        const hLen = Math.hypot(hx, hy, hz) || 1;
        hx /= hLen; hy /= hLen; hz /= hLen;
        const ndoth = Math.max(0.0, nsx * hx + nsy * hy + nsz * hz);

        // Secondary reflection lobe on lower-right for realistic metallic gold environment reflection
        const envDot = Math.max(0.0, nsx * 0.55 - nsy * 0.45 - nsz * 0.70);
        const envSpec = Math.pow(envDot, 6.0) * 0.35;

        let faceCol;
        if (overrideColors) {
          faceCol = overrideColors;
        } else if (matType === "gold") {
          if (isIconPreview) {
            const spec = Math.pow(ndoth, 16.0) * 0.45 + envSpec;
            const diff = 0.68 + 0.36 * ndotl;
            faceCol = [
              Math.min(1.0, 0.96 * diff + spec * 0.45),
              Math.min(1.0, 0.79 * diff + spec * 0.42),
              Math.min(1.0, 0.26 * diff + spec * 0.55)
            ];
          } else {
            // Exact calibrated 24K gold color so WebGL shader applies isGoldGlow
            faceCol = [0.95, 0.78, 0.23];
          }
        } else if (matType === "groove") {
          faceCol = [0.04, 0.04, 0.06];
        } else if (matType === "rib") {
          const diff = 0.55 + 0.45 * ndotl;
          faceCol = [0.18 * diff, 0.19 * diff, 0.22 * diff];
        } else {
          // Satin matte dark obsidian with soft studio highlight on upper-left
          const spec = Math.pow(ndoth, 9.0) * 0.24;
          const diff = 0.48 + 0.62 * ndotl;
          faceCol = [
            Math.min(1.0, 0.19 * diff + spec),
            Math.min(1.0, 0.20 * diff + spec),
            Math.min(1.0, 0.23 * diff + spec * 1.05)
          ];
        }

        function makeVertex(theta, phi, rScale) {
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);

          const sx = ax * cosT + (bx * cosP + cx * sinP) * sinT;
          const sy = ay * cosT + (by * cosP + cy * sinP) * sinT;
          const sz = az * cosT + (bz * cosP + cz * sinP) * sinT;

          const loc = screenToLocal(sx * radius * rScale, sy * radius * rScale, sz * radius * rScale);
          return transformPoint(loc[0], loc[1], loc[2]);
        }

        const p00 = makeVertex(theta0, phi0, rScale0);
        const p10 = makeVertex(theta1, phi0, rScale1);
        const p11 = makeVertex(theta1, phi1, rScale1);
        const p01 = makeVertex(theta0, phi1, rScale0);

        const baseIdx = vertices.length / 3;
        vertices.push(
          p00[0], p00[1], p00[2],
          p01[0], p01[1], p01[2],
          p11[0], p11[1], p11[2],
          p10[0], p10[1], p10[2]
        );
        for (let k = 0; k < 4; k++) {
          colors.push(faceCol[0], faceCol[1], faceCol[2]);
        }
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    }
  };

  const renderHandler = {
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

      window.buildObsidianBallModel(
        item.seed || 1234,
        0,
        false,
        false,
        item.scaleMultiplier || 1.0,
        p,
        itemR, itemN, itemF,
        vertices, colors, indices,
        overrideColors,
        null,
        null,
        item
      );
    }
  };

  window.ItemRegistry = window.ItemRegistry || {};
  window.ItemRegistry["obsidian_ball_item"] = renderHandler;
  window.ItemRegistry["obsidian_ball"] = renderHandler;
  window.ItemRegistry["OBSIDIAN_BALL"] = renderHandler;
  window.ItemRegistry["obsidian_flux_item"] = renderHandler;
  window.ItemRegistry["obsidian_flux"] = renderHandler;
  window.ItemRegistry["OBSIDIAN_FLUX"] = renderHandler;
})();
