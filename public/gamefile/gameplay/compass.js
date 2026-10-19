// === SEEDPLANET MODULE: JS/ENGINE/COMPASS.JS ===

(function(global) {
  let compassCanvas = null;
  let ctx = null;

  // Tracked custom waypoints
  let customWaypoints = [];
  
  // Angle smoothing
  let currentSmoothAngle = 0;
  let isAngleInit = false;

  // กลุ่มหมวดหมู่ของเข็มทิศ (Compass Groups)
  // สร้างกลุ่ม 'แมพดาว' (planet_map) ที่จะไม่แสดงผลไอคอนใดๆ เลย
  const COMPASS_GROUPS = {
    planet_map: {
      id: 'planet_map',
      name: 'แมพดาว',
      showIcons: false, // ไม่แสดงผลไอคอนใดๆ เลย
      types: [
        'wood_floor', 'thin_wood_floor', 'stone_floor',
        'wood_wall', 'wood_window', 'wood_door', 'wood_roof',
        'wood_stairs', 'folding_ladder', 'wood_wheel', 'boat_wing',
        'electric_engine', 'wood_chest', 'chest', 'campfire',
        'wood_boat', 'robot_stand', 'meganeura_item', 'isopod_item'
      ]
    }
  };

  // ล้าง Key เดิมออกทั้งหมดตามคำสั่ง
  const CRAFTED_UTILITY_MAP = {};

  function initCompassUI() {
    compassCanvas = document.getElementById('compassCanvas');
    let container = document.getElementById('compassContainer');

    if (!container) {
      container = document.createElement('div');
      container.id = 'compassContainer';
      container.className = 'game-ui visible';
      container.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 560px;
        max-width: 90vw;
        height: 56px;
        z-index: 10000;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        background: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: none !important;
        box-shadow: none !important;
        clip-path: none !important;
      `;
      document.body.appendChild(container);
    }

    if (!compassCanvas) {
      compassCanvas = document.createElement('canvas');
      compassCanvas.id = 'compassCanvas';
      compassCanvas.width = 1120; // High DPI 2x
      compassCanvas.height = 112;
      compassCanvas.style.cssText = `
        width: 560px;
        height: 56px;
        display: block;
        background: transparent;
      `;

      container.appendChild(compassCanvas);
    }

    if (compassCanvas) {
      ctx = compassCanvas.getContext('2d');
    }
  }

  function addWaypoint(pos, label = 'Waypoint', icon = '❇️', color = '#55ff99') {
    customWaypoints.push({
      id: Date.now() + Math.random(),
      position: pos,
      label,
      icon,
      color
    });
  }

  function removeWaypoint(id) {
    customWaypoints = customWaypoints.filter(w => w.id !== id);
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function updateCompassHUD() {
    if (!compassCanvas || !ctx) {
      initCompassUI();
      if (!ctx) return;
    }

    // Clear canvas every frame
    const w = compassCanvas.width;
    const h = compassCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const container = document.getElementById('compassContainer');
    const startOverlay = document.getElementById('gameStartOverlay');
    const saveSelectOverlay = document.getElementById('saveSelectOverlay');
    
    // Hide overlay if start menu or save slot select is open
    const isStartOpen = startOverlay && startOverlay.style.display !== 'none' && startOverlay.style.display !== '';
    const isSaveOpen = saveSelectOverlay && saveSelectOverlay.style.display !== 'none' && saveSelectOverlay.style.display !== '';
    
    // Fallback logic if style.display is empty but it's logically open
    const effectivelyStartOpen = isStartOpen || (typeof gameStarted !== 'undefined' && !gameStarted);
    
    if (effectivelyStartOpen || isSaveOpen) {
      if (container && container.style.display !== 'none') container.style.display = 'none';
      return;
    }

    if (container && container.style.display === 'none') {
      container.style.display = 'flex';
    }

    // Target Camera Heading Angle (rotationY)
    const targetAngle = typeof window.rotationY !== 'undefined' ? window.rotationY : (typeof global.rotationY !== 'undefined' ? global.rotationY : 0);

    if (!isAngleInit) {
      currentSmoothAngle = targetAngle;
      isAngleInit = true;
    } else {
      let diff = normalizeAngle(targetAngle - currentSmoothAngle);
      currentSmoothAngle = normalizeAngle(currentSmoothAngle + diff * 0.25); // Smooth lerp
    }

    const centerX = w / 2;
    const compassLineY = 62;
    const barHalfWidth = w * 0.44; // FOV width on tape
    const fovDeg = 120;
    const pxPerDeg = (barHalfWidth * 2) / fovDeg;

    ctx.save();

    // 1. Draw Horizontal Line
    const lineGrad = ctx.createLinearGradient(centerX - barHalfWidth, 0, centerX + barHalfWidth, 0);
    lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    lineGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.35)');
    lineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
    lineGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.35)');
    lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(centerX - barHalfWidth, compassLineY);
    ctx.lineTo(centerX + barHalfWidth, compassLineY);
    ctx.stroke();

    // 2. Draw Center Diamond Pointer (Indicator)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(centerX, compassLineY - 9);
    ctx.lineTo(centerX + 6, compassLineY - 1);
    ctx.lineTo(centerX, compassLineY + 7);
    ctx.lineTo(centerX - 6, compassLineY - 1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#dfb76c';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 3. Clip to compass region for smooth edge fade
    ctx.beginPath();
    ctx.rect(centerX - barHalfWidth - 10, 0, barHalfWidth * 2 + 20, h);
    ctx.clip();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const camAngleDeg = (currentSmoothAngle * 180 / Math.PI + 360) % 360;

    // STRICTLY N, E, S, W ONLY
    const cardinalLabels = {
      0: { text: 'N', color: '#ff4d4d', font: 'bold 26px "Google Sans", sans-serif' },
      90: { text: 'E', color: '#ffffff', font: 'bold 24px "Google Sans", sans-serif' },
      180: { text: 'S', color: '#ffffff', font: 'bold 24px "Google Sans", sans-serif' },
      270: { text: 'W', color: '#ffffff', font: 'bold 24px "Google Sans", sans-serif' }
    };

    const minDeg = Math.floor((camAngleDeg - fovDeg / 2) / 5) * 5;
    const maxDeg = Math.ceil((camAngleDeg + fovDeg / 2) / 5) * 5;

    for (let deg = minDeg; deg <= maxDeg; deg += 5) {
      const normDeg = (deg + 360) % 360;
      const deltaDeg = deg - camAngleDeg;
      const x = centerX + deltaDeg * pxPerDeg;

      const distFromCenter = Math.abs(x - centerX);
      const alpha = Math.max(0, 1 - Math.pow(distFromCenter / barHalfWidth, 2.2));
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = alpha;

      const isMainCardinal = (normDeg === 0 || normDeg === 90 || normDeg === 180 || normDeg === 270);
      const isSubCardinal = (normDeg % 45 === 0);
      const isMajor = (normDeg % 15 === 0);

      if (isMainCardinal) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x, compassLineY - 10);
        ctx.lineTo(x, compassLineY + 10);
        ctx.stroke();

        const card = cardinalLabels[normDeg];
        ctx.font = card.font;
        ctx.fillStyle = card.color;
        ctx.fillText(card.text, x, compassLineY + 24);
      } else if (isSubCardinal) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x, compassLineY - 6);
        ctx.lineTo(x, compassLineY + 6);
        ctx.stroke();
      } else if (isMajor) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, compassLineY - 4);
        ctx.lineTo(x, compassLineY + 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x, compassLineY - 2.5);
        ctx.lineTo(x, compassLineY + 2.5);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. DRAW WORLD MARKERS / OBJECTIVES ABOVE COMPASS TAPE
    const playerPos = (typeof window !== 'undefined' && window.player3DPos) ? window.player3DPos : null;

    if (playerPos && playerPos.length >= 3) {
      const px = playerPos[0], py = playerPos[1], pz = playerPos[2];

      // Calculate local Up, North, East vectors at player position
      const distP = Math.sqrt(px * px + py * py + pz * pz);
      if (distP > 0.1) {
        const ux = px / distP, uy = py / distP, uz = pz / distP;

        const cosTheta = Math.max(-1, Math.min(1, uy));
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
        const phi = Math.atan2(pz, px);
        const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

        const nx = -cosTheta * cosPhi;
        const ny = sinTheta;
        const nz = -cosTheta * sinPhi;

        const ex = -sinPhi;
        const ey = 0;
        const ez = cosPhi;

        const markersToDraw = [];

        // Collect placed craftable structures in the scene
        const collectiblesList = (typeof window !== 'undefined' && window.collectibles) ? window.collectibles : ((typeof collectibles !== 'undefined') ? collectibles : []);

        for (let c of collectiblesList) {
          if (!c || c.active === false || c.isPreview || !c.position) continue;
          
          // 1. กลุ่มของ 'แมพดาว' (planet_map): ไม่แสดงผลไอคอนใดๆ เลย
          if (COMPASS_GROUPS.planet_map && !COMPASS_GROUPS.planet_map.showIcons) {
            if (COMPASS_GROUPS.planet_map.types.includes(c.type) || c.hideFromCompass || c.isHouse || c.isProceduralHouse || c.isRuin || c.isWorldGenerated || c.isRandomBoat) {
              continue;
            }
          }

          // 2. ตรวจสอบจาก Utility Map (ล้าง key ออกทั้งหมดแล้ว)
          const utilMeta = CRAFTED_UTILITY_MAP[c.type];
          if (utilMeta && utilMeta.show !== false) {
            const dx = c.position[0] - px;
            const dy = c.position[1] - py;
            const dz = c.position[2] - pz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            markersToDraw.push({
              position: c.position,
              icon: utilMeta.icon,
              label: utilMeta.label,
              color: utilMeta.color,
              priority: utilMeta.priority || 50,
              itemType: utilMeta.itemType,
              dist
            });
            continue;
          }
        }

        // Custom Waypoints
        for (let wp of customWaypoints) {
          if (!wp || !wp.position) continue;
          const dx = wp.position[0] - px;
          const dy = wp.position[1] - py;
          const dz = wp.position[2] - pz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          markersToDraw.push({
            position: wp.position,
            icon: wp.icon || '❇️',
            label: wp.label || 'Waypoint',
            color: wp.color || '#55ff99',
            priority: 110,
            dist
          });
        }

        // Sort markers by priority (highest first), then by distance (closest first)
        markersToDraw.sort((a, b) => (b.priority - a.priority) || (a.dist - b.dist));

        const drawnIconsX = [];

        // Render icons on compass
        for (let m of markersToDraw) {
          const targetPos = m.position;
          const dx = targetPos[0] - px;
          const dy = targetPos[1] - py;
          const dz = targetPos[2] - pz;
          const dist = m.dist;
          if (dist < 0.05 || dist > 350) continue; // Distance filter

          // Project displacement vector onto North & East local axes
          const dN = dx * nx + dy * ny + dz * nz;
          const dE = dx * ex + dy * ey + dz * ez;

          const markerAngle = Math.atan2(dE, dN);
          const deltaAngle = normalizeAngle(markerAngle - currentSmoothAngle);
          const deltaDeg = deltaAngle * 180 / Math.PI;

          if (Math.abs(deltaDeg) > fovDeg / 2) continue; // Outside field of view

          const x = centerX + deltaDeg * pxPerDeg;

          // Deduplicate overlapping markers on screen (minimum 28px separation between any icons)
          const isTooClose = drawnIconsX.some(p => Math.abs(p.x - x) < 28);
          if (isTooClose) continue;

          drawnIconsX.push({ x, icon: m.icon });

          const distFromCenter = Math.abs(x - centerX);
          const alpha = Math.max(0, 1 - Math.pow(distFromCenter / barHalfWidth, 2));

          ctx.save();
          ctx.globalAlpha = alpha;

          const markerY = compassLineY - 26;

          // Render 3D icon or fallback to emoji symbol
          let drawn3D = false;
          if (m.itemType && typeof window !== 'undefined' && typeof window.create3DIconCanvas === 'function') {
            const iconSize = 40;
            
            if (!window._compassImgCache) window._compassImgCache = {};
            const cacheKey = m.itemType + '_' + iconSize;
            
            if (!window._compassImgCache[cacheKey]) {
                // Returns an HTMLImageElement or HTMLCanvasElement
                const generatedImg = window.create3DIconCanvas(m.itemType, iconSize, iconSize);
                if (generatedImg) {
                    window._compassImgCache[cacheKey] = generatedImg;
                }
            }
            
            const cachedImg = window._compassImgCache[cacheKey];
            if (cachedImg) {
              try {
                // Draw only if loaded (if it's an img tag) or if it's a canvas
                if ((cachedImg.tagName === 'IMG' && cachedImg.complete && cachedImg.naturalWidth > 0) || cachedImg.tagName === 'CANVAS') {
                  ctx.drawImage(cachedImg, x - iconSize / 2, markerY - 32, iconSize, iconSize);
                  drawn3D = true;
                }
              } catch (e) {}
            }
          }

          if (!drawn3D) {
            ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText(m.icon, x, markerY - 4);
          }

          // Distance tag
          ctx.font = 'bold 10px "Google Sans", sans-serif';
          ctx.fillStyle = m.color;
          ctx.fillText(`${Math.round(dist)}m`, x, markerY + 11);

          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  // Export to Global
  global.CompassSystem = {
    initCompassUI,
    updateCompassHUD,
    addWaypoint,
    removeWaypoint,
    COMPASS_GROUPS
  };
  global.updateCompassHUD = updateCompassHUD;

})(typeof window !== 'undefined' ? window : this);
