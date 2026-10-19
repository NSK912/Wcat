// === SEEDPLANET MODULE: JS/CAMERA.JS ===

// Helper to compute the squared distance between a 3D line segment SE and a point C
function distanceSegmentToPointSq(S, E, C) {
  const vx = E[0] - S[0];
  const vy = E[1] - S[1];
  const vz = E[2] - S[2];
  
  const wx = C[0] - S[0];
  const wy = C[1] - S[1];
  const wz = C[2] - S[2];
  
  const lenSq = vx*vx + vy*vy + vz*vz;
  if (lenSq < 0.0001) {
    return wx*wx + wy*wy + wz*wz;
  }
  
  let t = (wx*vx + wy*vy + wz*vz) / lenSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment
  
  const projx = S[0] + t * vx;
  const projy = S[1] + t * vy;
  const projz = S[2] + t * vz;
  
  const dx = C[0] - projx;
  const dy = C[1] - projy;
  const dz = C[2] - projz;
  
  return dx*dx + dy*dy + dz*dz;
}

// Helper to check if a swept camera sphere of radius r_cam along segment SE intersects an obstacle (including its multiple colliders if any)
function intersectsSweptObstacle(S, E, obs, r_cam) {
  if (obs.colliders && obs.colliders.length > 0) {
    for (let col of obs.colliders) {
      const cx = obs.position[0] + (col.offset[0] || 0);
      const cy = obs.position[1] + (col.offset[1] || 0);
      const cz = obs.position[2] + (col.offset[2] || 0);
      const maxRad = col.radius + r_cam;
      const distSq = distanceSegmentToPointSq(S, E, [cx, cy, cz]);
      if (distSq < maxRad * maxRad) return true;
    }
    return false;
  } else {
    const maxRad = (obs.radius || 0.5) + r_cam;
    const distSq = distanceSegmentToPointSq(S, E, obs.position);
    return distSq < maxRad * maxRad;
  }
}

class CameraSpringArm {
  constructor() {
    this.mode = 'tps'; // Default camera mode

    // Configure distinct settings and state layers for each camera mode (ทำงานแบบแยก layer)
    this.layers = {
      tps: {
        smoothTargetPos: [0, 0, 0],
        currentSmoothDistance: 3.0,
        shoulderOffset: -0.9,     // Offset sideways (character on left, camera looks over right shoulder)
        verticalOffset: 0.15,     // Offset upward relative to localUp
        cameraLag: 0.15,          // Position spring lag (0 to 1, lower = smoother/slower tracking)
        distanceLag: 0.45,        // Fast contraction lag
        extendLag: 0.08,          // Softer extension lag
        pitchMin: -0.55,          // Max looking down pitch (radians)
        pitchMax: 1.2,            // Max looking up pitch (radians)
        collisionMask: ~(COLLISION_LAYERS.TREE | COLLISION_LAYERS.ROCK) // COLLISION LAYER: Collide with all except trees and rocks/ores
      },
      thirdperson: {
        smoothTargetPos: [0, 0, 0],
        currentSmoothDistance: 3.0,
        shoulderOffset: 0.0,      // No sideways offset (perfectly centered behind character)
        verticalOffset: 0.25,     // Offset upward for standard third-person centered view
        cameraLag: 0.10,          // Position spring lag (more cinematic trailing)
        distanceLag: 0.45,        // Fast contraction lag
        extendLag: 0.06,          // Softer, smoother extension lag
        pitchMin: -0.55,
        pitchMax: 1.2,
        collisionMask: ~(COLLISION_LAYERS.TREE | COLLISION_LAYERS.ROCK) // COLLISION LAYER: Collide with all except trees and rocks/ores
      },
      fps: {
        smoothTargetPos: [0, 0, 0],
        currentSmoothDistance: 0.0,
        shoulderOffset: 0.0,      // No sideways offset
        verticalOffset: 0.35,     // Offset to match eye level
        cameraLag: 1.0,           // Instant tracking
        distanceLag: 1.0,
        extendLag: 1.0,
        pitchMin: -1.4,
        pitchMax: 1.5,
        collisionMask: 0          // No collision needed for FPS
      },
      planet: {
        smoothTargetPos: [0, 0, 0],
        currentSmoothDistance: 24.0,
        shoulderOffset: 0.0,
        verticalOffset: 0.0,
        cameraLag: 0.15,
        distanceLag: 0.45,
        extendLag: 0.08,
        pitchMin: -Math.PI / 2.1,
        pitchMax: Math.PI / 2.1,
        collisionMask: 0          // No collision needed for Planet Overview
      },
      sun: {
        smoothTargetPos: [0, 0, 0],
        currentSmoothDistance: 3500.0,
        shoulderOffset: 0.0,
        verticalOffset: 0.0,
        cameraLag: 0.15,
        distanceLag: 0.45,
        extendLag: 0.08,
        pitchMin: -Math.PI / 2.1,
        pitchMax: Math.PI / 2.1,
        collisionMask: 0          // No collision needed for Sun Tracking
      },
      satellite: {
        smoothTargetPos: [0, 0, 0],
        currentSmoothDistance: 15.0,
        shoulderOffset: 0.0,
        verticalOffset: 0.0,
        cameraLag: 0.15,
        distanceLag: 0.45,
        extendLag: 0.08,
        pitchMin: -Math.PI / 2.1,
        pitchMax: Math.PI / 2.1,
        collisionMask: 0          // No collision needed for Satellite Overview
      }
    };

    this.eyePos = [0, 0, 0];
    this.targetPos = [0, 0, 0];
    this.camUp = [0, 1, 0];
    this.viewMatrix = null;
    this.initialized = false;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }

  update(dt, playerPos, localUp, currentNorth, currentEast, inputRotationX, inputRotationY, zoom, charScale, waterRadius, cameraCollisionEnabled) {
    // 0. Free Flying Camera (FreeCam / กล้องฟรี)
    if (this.mode === "freecam" || window.cameraMode === "freecam") {
      if (!window.freeCamPos || (window.freeCamPos[0] === 0 && window.freeCamPos[1] === 0 && window.freeCamPos[2] === 0)) {
        window.freeCamPos = [
          playerPos[0] + (localUp[0] || 0) * 2.0,
          playerPos[1] + (localUp[1] || 1) * 2.0,
          playerPos[2] + (localUp[2] || 0) * 2.0
        ];
        window.freeCamYaw = (typeof inputRotationY === "number") ? inputRotationY : 0.0;
        window.freeCamPitch = (typeof inputRotationX === "number") ? inputRotationX : 0.0;
      }
      if (typeof window.freeCamSpeed !== "number") {
        window.freeCamSpeed = 15.0;
      }
      if (typeof window.freeCamYaw !== "number") window.freeCamYaw = 0.0;
      if (typeof window.freeCamPitch !== "number") window.freeCamPitch = 0.0;

      const isBoost = (typeof keysPressed !== "undefined" && keysPressed && (keysPressed["ShiftLeft"] || keysPressed["ShiftRight"]));
      const speed = (window.freeCamSpeed || 15.0) * (isBoost ? 3.0 : 1.0);
      const yaw = window.freeCamYaw;
      const pitch = Math.max(-1.52, Math.min(1.52, window.freeCamPitch));

      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      // Direction pointing forward
      const forward = [-sinY * cosP, -sinP, -cosY * cosP];
      // Direction pointing right
      const right = [cosY, 0, -sinY];
      // Direction pointing up
      const up = [0, 1, 0];

      let moveX = 0, moveY = 0, moveZ = 0;
      if (typeof keysPressed !== "undefined" && keysPressed) {
        if (keysPressed["KeyW"] || keysPressed["ArrowUp"]) {
          moveX += forward[0]; moveY += forward[1]; moveZ += forward[2];
        }
        if (keysPressed["KeyS"] || keysPressed["ArrowDown"]) {
          moveX -= forward[0]; moveY -= forward[1]; moveZ -= forward[2];
        }
        if (keysPressed["KeyD"] || keysPressed["ArrowRight"]) {
          moveX += right[0]; moveY += right[1]; moveZ += right[2];
        }
        if (keysPressed["KeyA"] || keysPressed["ArrowLeft"]) {
          moveX -= right[0]; moveY -= right[1]; moveZ -= right[2];
        }
        if (keysPressed["KeyE"] || keysPressed["Space"]) {
          moveX += up[0]; moveY += up[1]; moveZ += up[2];
        }
        if (keysPressed["KeyQ"] || keysPressed["ControlLeft"] || keysPressed["KeyC"]) {
          moveX -= up[0]; moveY -= up[1]; moveZ -= up[2];
        }
      }

      const moveLen = Math.sqrt(moveX * moveX + moveY * moveY + moveZ * moveZ);
      if (moveLen > 0.001) {
        const step = (speed * (dt || 0.016)) / moveLen;
        window.freeCamPos[0] += moveX * step;
        window.freeCamPos[1] += moveY * step;
        window.freeCamPos[2] += moveZ * step;
      }

      this.eyePos = [window.freeCamPos[0], window.freeCamPos[1], window.freeCamPos[2]];
      this.targetPos = [
        this.eyePos[0] + forward[0],
        this.eyePos[1] + forward[1],
        this.eyePos[2] + forward[2]
      ];
      this.camUp = [0, 1, 0];

      window.cameraNearPlane = 0.08;

      if (typeof createLookAt === "function") {
        this.viewMatrix = createLookAt(this.eyePos, this.targetPos, this.camUp);
      } else {
        this.viewMatrix = null;
      }
      return;
    }

    if (this.mode === "sun") {
      // Orbital camera view around the real 3D Satellite Sun
      let satPos = [-800.0, 0.0, 0.0];
      let satScaleVal = 70.0;
      if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
        const cel = window.SpacesMap.getCelestialTransform("sun");
        if (cel) {
          satPos = cel.pos;
          satScaleVal = cel.scale;
        }
      } else if (typeof window.getSunWorldPosition === "function") {
        satPos = window.getSunWorldPosition();
      }

      const sunRad = satScaleVal * 1.5;
      
      const pitch = Math.max(-1.45, Math.min(1.45, inputRotationX || 0));
      const yaw = inputRotationY || 0;
      const zoomVal = (typeof zoom === "number" && !isNaN(zoom) && zoom > 0) ? zoom : 1.0;
      const dist = Math.max(sunRad * 1.5, (sunRad * 4.0) * zoomVal);

      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      this.targetPos = [satPos[0], satPos[1], satPos[2]];
      
      this.eyePos = [
        this.targetPos[0] + dist * cosP * Math.sin(yaw),
        this.targetPos[1] + dist * sinP,
        this.targetPos[2] + dist * cosP * Math.cos(yaw)
      ];

      let upVec = [0.0, 1.0, 0.0];
      if (Math.abs(sinP) > 0.98) {
        upVec = [0.0, 0.0, sinP > 0 ? -1.0 : 1.0];
      }
      this.camUp = upVec;
      window.cameraNearPlane = 1.0;

      if (typeof createLookAt === "function") {
        this.viewMatrix = createLookAt(this.eyePos, this.targetPos, this.camUp);
      } else {
        this.viewMatrix = null;
      }
      return;
    }

    const layer = this.layers[this.mode] || this.layers["thirdperson"];

    // 1. Calculate head position of the character
    const headHeight = 0.45 * charScale;
    const rawTargetPos = [
      playerPos[0] + localUp[0] * headHeight,
      playerPos[1] + localUp[1] * headHeight,
      playerPos[2] + localUp[2] * headHeight
    ];

    // Initialize smoothTargetPos if not initialized yet to prevent starting at [0,0,0]
    if (!this.initialized || (layer.smoothTargetPos[0] === 0 && layer.smoothTargetPos[1] === 0 && layer.smoothTargetPos[2] === 0)) {
      layer.smoothTargetPos[0] = rawTargetPos[0];
      layer.smoothTargetPos[1] = rawTargetPos[1];
      layer.smoothTargetPos[2] = rawTargetPos[2];
      this.initialized = true;
    }

    // 2. Track raw player head position instantly to prevent trailing lag when running on the planet surface
    layer.smoothTargetPos[0] = rawTargetPos[0];
    layer.smoothTargetPos[1] = rawTargetPos[1];
    layer.smoothTargetPos[2] = rawTargetPos[2];

    // 3. Compute pitch/yaw orientations relative to localUp on spherical planet
    const clampedPitch = Math.max(layer.pitchMin, Math.min(layer.pitchMax, inputRotationX));
    const cosP = Math.cos(clampedPitch);
    const sinP = Math.sin(clampedPitch);
    const cosY = Math.cos(inputRotationY);
    const sinY = Math.sin(inputRotationY);

    // 4. Compute camera local axes (Right, Forward, Up) in the tangent space of the planet
    // camRight points rightwards in camera view
    const camRight = [
      currentEast[0] * cosY - currentNorth[0] * sinY,
      currentEast[1] * cosY - currentNorth[1] * sinY,
      currentEast[2] * cosY - currentNorth[2] * sinY
    ];

    // Horizontal direction tangent to planet sphere
    const camDirOnPlane = [
      -currentNorth[0] * cosY - currentEast[0] * sinY,
      -currentNorth[1] * cosY - currentEast[1] * sinY,
      -currentNorth[2] * cosY - currentEast[2] * sinY,
    ];

    // 3D Direction pointing from target to camera (camera back vector)
    const camDir = [
      camDirOnPlane[0] * cosP + localUp[0] * sinP,
      camDirOnPlane[1] * cosP + localUp[1] * sinP,
      camDirOnPlane[2] * cosP + localUp[2] * sinP,
    ];

    // 5. Apply offsets to target position to position the Camera Shoulder or Center (ทำงานแบบแยก layer)
    const shoulderOffsetDistance = layer.shoulderOffset * charScale;
    const verticalOffsetDistance = layer.verticalOffset * charScale;

    const shoulderOffsetPos = [
      layer.smoothTargetPos[0] + camRight[0] * shoulderOffsetDistance + localUp[0] * verticalOffsetDistance,
      layer.smoothTargetPos[1] + camRight[1] * shoulderOffsetDistance + localUp[1] * verticalOffsetDistance,
      layer.smoothTargetPos[2] + camRight[2] * shoulderOffsetDistance + localUp[2] * verticalOffsetDistance
    ];

    // Dynamic camera calculation based on aspect ratio and character scale to prevent clipping on ultrawide and mobile screens
    const canvasElement = typeof canvas !== 'undefined' ? canvas : document.getElementById("mapCanvas");
    const aspect = canvasElement ? (canvasElement.width / canvasElement.height) : (16 / 9);
    
    // Near plane dynamically adjusted for character scale (min 0.015, max 0.05)
    const nearPlane = Math.max(0.015, Math.min(0.05, 0.05 * (charScale / 0.22)));
    window.cameraNearPlane = nearPlane;

    // Corner of near clipping plane formula:
    const fovFactor = 0.171572; // tan^2(Math.PI / 8)
    const dCorner = nearPlane * Math.sqrt(1.0 + fovFactor * (aspect * aspect + 1.0));
    const safeCushion = dCorner + 0.01;
    window.dynamicCameraCushion = safeCushion;

    // 6. Calculate desired spring arm distance
    let targetDistance = this.mode === 'fps' ? 0.0 : (1.0 + (zoom - 3.5) * 0.4) * (charScale / 0.22);
    if (this.mode !== 'fps' && typeof activeRidingMech !== "undefined" && activeRidingMech) {
      const mechCamDist = (typeof window.mechCameraDistance === "number") ? window.mechCameraDistance : 0.5;
      targetDistance += mechCamDist;
    }
    if (this.mode !== 'fps' && typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
      const boatCamDist = (typeof window.boatCameraDistance === "number") ? window.boatCameraDistance : 0.0;
      targetDistance += boatCamDist;
    }

    // 7. Perform collision check against separate layer masks (ทำงานแบบแยก layer)
    let actualDistance = targetDistance;
    let S = [shoulderOffsetPos[0], shoulderOffsetPos[1], shoulderOffsetPos[2]];
    let prefiltered = null;

    if (cameraCollisionEnabled) {
      prefiltered = {
        nature: [],
        cubes: [],
        amphibians: [],
        collectibles: []
      };

      const r_cam = Math.max(0.12 * (charScale / 0.22), window.dynamicCameraCushion || 0.06); // Dynamic camera collision radius cushion

      // 7a. Pre-populate prefiltered arrays using shoulderOffsetPos as initial anchor to run high-precision check on anchor itself
      const E_initial = [
        shoulderOffsetPos[0] + camDir[0] * targetDistance,
        shoulderOffsetPos[1] + camDir[1] * targetDistance,
        shoulderOffsetPos[2] + camDir[2] * targetDistance
      ];

      const filterArraySwept = (source, target, mask) => {
        for (let i = 0; i < source.length; i++) {
          const obs = source[i];
          if (mask !== undefined && obs.layer !== undefined && !(mask & obs.layer)) continue;
          if (!obs.position) continue;
          if (intersectsSweptObstacle(shoulderOffsetPos, E_initial, obs, r_cam)) {
            target.push(obs);
          }
        }
      };

      filterArraySwept(natureObstacles, prefiltered.nature, layer.collisionMask);
      filterArraySwept(cubeObstacles, prefiltered.cubes, layer.collisionMask);
      filterArraySwept(amphibians, prefiltered.amphibians, layer.collisionMask);

      // Collectibles prefiltering (Accelerated by SpatialGrid)
      if (typeof SpatialGrid !== "undefined") {
        const maxRad = 3.0;
        const nearItems = SpatialGrid.querySegment(shoulderOffsetPos, E_initial, maxRad, other => other.active && !other.isPreview);
        for (let i = 0; i < nearItems.length; i++) {
          prefiltered.collectibles.push(nearItems[i]);
        }
      } else {
        for (let i = 0; i < collectibles.length; i++) {
          const other = collectibles[i];
          if (other.active && !other.isPreview) {
            const maxRad = 3.0; // Safe bounding radius for player-built structures
            const distSq = distanceSegmentToPointSq(shoulderOffsetPos, E_initial, other.position);
            if (distSq < maxRad * maxRad) {
              prefiltered.collectibles.push(other);
            }
          }
        }
      }

      // 7b. Check if the raw desired shoulder offset is colliding
      let isSColliding = false;
      if (checkCameraCollision) {
        isSColliding = checkCameraCollision(shoulderOffsetPos, layer.smoothTargetPos, waterRadius, prefiltered);
      }

      // Smoothly blend the shoulder offset blend factor to slide camera to the center behind character on collision
      if (layer.shoulderOffsetBlend === undefined) {
        layer.shoulderOffsetBlend = 1.0;
      }
      const targetBlend = isSColliding ? 0.0 : 1.0;
      const blendSpeed = isSColliding ? 20.0 : 5.0; // Contract rapidly into center, slide slowly back out
      layer.shoulderOffsetBlend += (targetBlend - layer.shoulderOffsetBlend) * Math.min(1.0, blendSpeed * dt);

      // Re-evaluate S with the smoothly blended shoulder offset
      const activeShoulderOffsetDistance = shoulderOffsetDistance * layer.shoulderOffsetBlend;
      S = [
        layer.smoothTargetPos[0] + camRight[0] * activeShoulderOffsetDistance + localUp[0] * verticalOffsetDistance,
        layer.smoothTargetPos[1] + camRight[1] * activeShoulderOffsetDistance + localUp[1] * verticalOffsetDistance,
        layer.smoothTargetPos[2] + camRight[2] * activeShoulderOffsetDistance + localUp[2] * verticalOffsetDistance
      ];

      // End point of the camera spring arm sweep
      const E = [
        S[0] + camDir[0] * targetDistance,
        S[1] + camDir[1] * targetDistance,
        S[2] + camDir[2] * targetDistance
      ];

      let hit = false;
      let hitMid = targetDistance;

      // SphereCast Sweep along the camera spring arm - high-precision 4cm steps
      const stepSize = 0.04;
      const steps = Math.ceil(targetDistance / stepSize);
      for (let i = 1; i <= steps; i++) {
        let mid = (i === steps) ? targetDistance : (i / steps) * targetDistance;
        let testPos = [
          S[0] + camDir[0] * mid,
          S[1] + camDir[1] * mid,
          S[2] + camDir[2] * mid,
        ];
        if (checkCameraCollision && checkCameraCollision(testPos, layer.smoothTargetPos, waterRadius, prefiltered)) {
          hit = true;
          hitMid = mid;
          break;
        }
      }

      // Binary search to find precise collision point
      if (hit) {
        let low = Math.max(0, hitMid - stepSize);
        let high = hitMid;
        for (let step = 0; step < 8; step++) {
          let mid = (low + high) * 0.5;
          let testPos = [
            S[0] + camDir[0] * mid,
            S[1] + camDir[1] * mid,
            S[2] + camDir[2] * mid,
          ];
          if (checkCameraCollision && checkCameraCollision(testPos, layer.smoothTargetPos, waterRadius, prefiltered)) {
            high = mid;
          } else {
            low = mid;
          }
        }
        actualDistance = low;
      }
    }

    // Ensure minimum distance from target
    // Adjusted dynamically based on character scale and the dynamic near plane (nearPlane + 0.01)
    // to prevent the camera from entering the player's head and causing ugly clipping.
    const minCamDist = this.mode === 'fps' ? 0.0 : Math.max(0.02 * (charScale / 0.22), (window.cameraNearPlane || 0.05) + 0.01);
    if (actualDistance < minCamDist) {
      actualDistance = minCamDist;
    }

    // Throttled spring arm contract/extend cave log
    if (cameraCollisionEnabled) {
      const now = performance.now();
      if (!window.lastCameraSpringArmLogTime) window.lastCameraSpringArmLogTime = 0;
      if (now - window.lastCameraSpringArmLogTime > 1000) {
        let isPlayerInCaveLocal = false;
        if (playerPos) {
          if (typeof tunnels3D !== "undefined" && tunnels3D && tunnels3D.length > 0) {
            for (let i = 0; i < tunnels3D.length; i++) {
              const t = tunnels3D[i];
              const dx = playerPos[0] - t.x;
              const dy = playerPos[1] - t.y;
              const dz = playerPos[2] - t.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
              if (dist < t.r * 1.5) {
                isPlayerInCaveLocal = true;
                break;
              }
            }
          }
          if (!isPlayerInCaveLocal && typeof getTerrainSurfaceAndCeiling === "function") {
            const planetCore = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
            const relPx = playerPos[0] - planetCore[0];
            const relPy = playerPos[1] - planetCore[1];
            const relPz = playerPos[2] - planetCore[2];
            const pDist = Math.sqrt(relPx * relPx + relPy * relPy + relPz * relPz);
            if (pDist > 0.001) {
              const pCave = getTerrainSurfaceAndCeiling(relPx / pDist, relPy / pDist, relPz / pDist, pDist);
              if (pCave && pCave.insideTunnel) {
                isPlayerInCaveLocal = true;
              }
            }
          }
        }

        if (isPlayerInCaveLocal) {
          window.lastCameraSpringArmLogTime = now;
          // console.log(`📹 [SPRING ARM] Cave Camera Distance Update: mode = ${this.mode}, targetDist = ${targetDistance.toFixed(3)}m, actualDist = ${actualDistance.toFixed(3)}m, smoothed = ${layer.currentSmoothDistance.toFixed(3)}m, isColliding = ${actualDistance < targetDistance - 0.01}`);
        }
      }
    }

    // 8. Apply spring physics to distance (smooth rapid retract on hit, smooth extend on release, smooth zoom in/out)
    if (actualDistance < layer.currentSmoothDistance) {
      const diff = layer.currentSmoothDistance - actualDistance;
      if (diff > 0.15) {
        // Large collision hit: snap close to prevent clipping through wall
        layer.currentSmoothDistance = actualDistance + 0.05;
      } else {
        // Small collision / grazing: smoothly damp to eliminate micro-vibrations
        const retractFactor = Math.min(1.0, 25.0 * dt);
        layer.currentSmoothDistance += (actualDistance - layer.currentSmoothDistance) * retractFactor;
      }
    } else {
      // Extend smoothly (or zoom out smoothly)
      const extendFactor = Math.min(1.0, layer.extendLag * (dt * 60));
      layer.currentSmoothDistance += (actualDistance - layer.currentSmoothDistance) * extendFactor;
    }

    if (layer.currentSmoothDistance < minCamDist) {
      layer.currentSmoothDistance = minCamDist;
    }

    // 9. Final camera position, target lookat position, and up vector
    const rawEyePos = [
      S[0] + camDir[0] * layer.currentSmoothDistance,
      S[1] + camDir[1] * layer.currentSmoothDistance,
      S[2] + camDir[2] * layer.currentSmoothDistance,
    ];

    this.eyePos = rawEyePos;
    this.targetPos = [
      this.eyePos[0] - camDir[0],
      this.eyePos[1] - camDir[1],
      this.eyePos[2] - camDir[2]
    ];

    this.camUp = [
      localUp[0] * cosP - camDirOnPlane[0] * sinP,
      localUp[1] * cosP - camDirOnPlane[1] * sinP,
      localUp[2] * cosP - camDirOnPlane[2] * sinP,
    ];

    // 10. Generate view matrix using createLookAt
    if (typeof createLookAt === "function") {
      this.viewMatrix = createLookAt(this.eyePos, this.targetPos, this.camUp);
    } else {
      this.viewMatrix = null;
    }
  }
}

// Attach instance to window
cameraSpringArm = new CameraSpringArm();
window.cameraSpringArm = cameraSpringArm;

// Global Camera Settings and Zoom Parameters
var zoom = 3.5;

// Shared setCameraMode function
window.setCameraMode = function(mode) {
  const validModes = ["tps", "thirdperson", "fps", "freecam", "sun"];
  if (!validModes.includes(mode)) {
    mode = "thirdperson";
  }
  cameraMode = mode;
  window.cameraMode = mode;
  if (typeof cameraSpringArm !== "undefined" && cameraSpringArm) {
    cameraSpringArm.setMode(cameraMode);
  }

  // If entering freecam, sync initial camera position to current player or eye pos
  if (mode === "freecam") {
    if (window.player3DPos) {
      window.freeCamPos = [
        window.player3DPos[0] + 1.0,
        window.player3DPos[1] + 2.0,
        window.player3DPos[2] + 2.0
      ];
    } else if (cameraSpringArm && cameraSpringArm.eyePos) {
      window.freeCamPos = [...cameraSpringArm.eyePos];
    }
    if (typeof rotationY === "number") window.freeCamYaw = rotationY;
    if (typeof rotationX === "number") window.freeCamPitch = rotationX;
    if (typeof window.freeCamSpeed !== "number") window.freeCamSpeed = 15.0;
  }

  // Show visual notification popup
  let modeLabel = "🎥 TPS (ข้างไหล่)";
  if (cameraMode === "thirdperson") modeLabel = "🎥 มุมมองที่ 3 (ตรงกลาง)";
  else if (cameraMode === "fps") modeLabel = "🎥 FPS (บุคคลที่ 1)";
  else if (cameraMode === "freecam") modeLabel = "🚁 โหมดกล้องฟรี (Free Camera)";
  else if (cameraMode === "sun") modeLabel = "☀️ กล้องส่อง Satellite Sun (ดวงอาทิตย์)";

  if (typeof showNotification === "function") {
    showNotification(`📷 สลับกล้อง: ${modeLabel}`);
  } else if (typeof showNotice === "function") {
    showNotice(`📷 สลับกล้อง: ${modeLabel}`);
  }

  const invFollowBtn = document.getElementById("invCameraFollowToggle");
  if (invFollowBtn) {
    if (cameraMode === "fps") {
      invFollowBtn.textContent = "FPS (บุคคลที่ 1)";
    } else if (cameraMode === "freecam") {
      invFollowBtn.textContent = "กล้องฟรี (FreeCam)";
    } else {
      invFollowBtn.textContent = cameraMode === "tps" ? "TPS ข้างไหล่" : "มุมมองที่ 3 (ตรงกลาง)";
    }
  }
};
var setCameraMode = window.setCameraMode;

// Helper functions for Free Camera
window.toggleFreeCamera = function() {
  if (window.cameraMode === "freecam") {
    const prev = window.freeCamPreviousMode || "thirdperson";
    window.setCameraMode(prev);
    return false;
  } else {
    window.freeCamPreviousMode = window.cameraMode || "thirdperson";
    window.setCameraMode("freecam");
    return true;
  }
};

// ============================================
// Vehicle Camera (เรือ & หุ่นยนต์)
// เรือ: สลับใช้มุมมองที่ 3 (thirdperson) พอเลิกขับก็คืนค่าเดิม
// หุ่นยนต์: สลับแค่ tps มาเป็นมุมมองที่ 3 (thirdperson) ส่วน fps ไม่เกี่ยว
// ============================================
window._prevBoatCameraMode = null;
window._prevMechCameraMode = null;

window.enterBoatCamera = function() {
  const curMode = window.cameraMode || (typeof cameraMode !== "undefined" ? cameraMode : "thirdperson");
  if (curMode !== "thirdperson") {
    window._prevBoatCameraMode = curMode;
    if (typeof window.setCameraMode === "function") {
      window.setCameraMode("thirdperson");
    }
  }
};

window.exitBoatCamera = function() {
  if (window._prevBoatCameraMode) {
    const restoreMode = window._prevBoatCameraMode;
    window._prevBoatCameraMode = null;
    if (typeof window.setCameraMode === "function") {
      window.setCameraMode(restoreMode);
    }
  }
};

window.enterMechCamera = function() {
  const curMode = window.cameraMode || (typeof cameraMode !== "undefined" ? cameraMode : "thirdperson");
  // สลับเฉพาะ tps มาเป็นมุมมองที่ 3 (fps ไม่เกี่ยว)
  if (curMode === "tps") {
    window._prevMechCameraMode = "tps";
    if (typeof window.setCameraMode === "function") {
      window.setCameraMode("thirdperson");
    }
  }
};

window.exitMechCamera = function() {
  if (window._prevMechCameraMode === "tps") {
    window._prevMechCameraMode = null;
    if (typeof window.setCameraMode === "function") {
      window.setCameraMode("tps");
    }
  }
};

window.teleportFreeCamToPlayer = function() {
  if (window.player3DPos) {
    window.freeCamPos = [
      window.player3DPos[0] + 1.0,
      window.player3DPos[1] + 2.0,
      window.player3DPos[2] + 2.0
    ];
    if (typeof rotationY === "number") window.freeCamYaw = rotationY;
    if (typeof rotationX === "number") window.freeCamPitch = rotationX;
    if (typeof showNotice === "function") showNotice("📍 วาร์ปกล้องฟรีมาที่ตัวละครเรียบร้อย");
  }
};

// DOMContentLoaded Event Listener for Wheel Zoom and Buttons Click Setup
document.addEventListener("DOMContentLoaded", () => {
  const canvasElement = document.getElementById("mapCanvas") || (typeof canvas !== "undefined" ? canvas : null);
  if (canvasElement) {
    canvasElement?.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (window.cameraMode === "freecam") {
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        window.freeCamSpeed = Math.max(1.0, Math.min(250.0, (window.freeCamSpeed || 15.0) * factor));
      }
    }, { passive: false });
  }

  // Global event delegation for camera buttons
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!target) return;

    const btnTPS = target.closest("#btnCameraModeTPS");
    if (btnTPS) {
      setCameraMode("tps");
      return;
    }

    const btnThirdPerson = target.closest("#btnCameraModeThirdPerson");
    if (btnThirdPerson) {
      setCameraMode("thirdperson");
      return;
    }

    const btnFPS = target.closest("#btnCameraModeFPS");
    if (btnFPS) {
      setCameraMode("fps");
      return;
    }

    const btnFreeCam = target.closest("#btnCameraModeFreeCam");
    if (btnFreeCam) {
      window.toggleFreeCamera();
      return;
    }
  });
});
