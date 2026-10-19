const Physics = {
    gravityAccel: 0.00015,
    
    // Apply gravity to a 3D velocity vector along a normal (nx, ny, nz)
    applyGravity: function(vel, nx, ny, nz, dtScale = 1.0, customGravity = 0.00015) {
        const g = customGravity * dtScale;
        vel[0] -= nx * g;
        vel[1] -= ny * g;
        vel[2] -= nz * g;
    },

    // Apply gravity to a 1D vertical velocity
    applyVerticalGravity: function(verticalVel, dtScale = 1.0, customGravity = 0.00015) {
        return verticalVel - (customGravity * dtScale);
    },

    // Apply simple air/water friction
    applyFriction: function(vel, friction = 0.98, dtScale = 1.0) {
        const scaledFriction = Math.pow(friction, dtScale);
        vel[0] *= scaledFriction;
        vel[1] *= scaledFriction;
        vel[2] *= scaledFriction;
    },

    // Apply a buoyant force to a 3D velocity vector
    applyBuoyancyForce: function(vel, nx, ny, nz, buoyancyFactor, dtScale = 1.0, customGravity = 0.00015) {
        const buoyancy = customGravity * buoyancyFactor * dtScale;
        vel[0] += nx * buoyancy;
        vel[1] += ny * buoyancy;
        vel[2] += nz * buoyancy;
    },

    // Resolve collision with a surface
    resolveVelocityCollision: function(vel, nx, ny, nz, bounce = 0.0, friction = 0.8) {
        const dot = vel[0]*nx + vel[1]*ny + vel[2]*nz;
        if (dot < 0) {
            const vnX = nx * dot;
            const vnY = ny * dot;
            const vnZ = nz * dot;

            const vtX = vel[0] - vnX;
            const vtY = vel[1] - vnY;
            const vtZ = vel[2] - vnZ;

            vel[0] = vtX * friction - vnX * bounce;
            vel[1] = vtY * friction - vnY * bounce;
            vel[2] = vtZ * friction - vnZ * bounce;
        }
    },

    resolveSurfaceCollision: function(pos, vel, groundRadius, nx, ny, nz, bounce = 0.0, friction = 0.8) {
        // Impact velocity along normal
        const impactVel = -(vel[0]*nx + vel[1]*ny + vel[2]*nz);
        if (impactVel > 0) {
            // Cancel velocity along normal
            vel[0] += nx * impactVel;
            vel[1] += ny * impactVel;
            vel[2] += nz * impactVel;
            
            // Apply bounce
            if (bounce > 0) {
                vel[0] += nx * impactVel * bounce;
                vel[1] += ny * impactVel * bounce;
                vel[2] += nz * impactVel * bounce;
            }
            
            // Apply surface friction
            this.applyFriction(vel, friction);
            
            // Snap position to surface
            pos[0] = nx * groundRadius;
            pos[1] = ny * groundRadius;
            pos[2] = nz * groundRadius;
        }
    },

    // Precise Bounded Query for constructed floors & roofs at a specific 3D point
    getFloorSurfaceRadiusAt: function(px, py, pz, fallbackTerrainRad) {
        if (typeof collectibles === "undefined" || !Array.isArray(collectibles)) {
            return fallbackTerrainRad;
        }
        let surfaceRad = fallbackTerrainRad;
        let candidates = collectibles;
        if (typeof SpatialGrid !== "undefined" && typeof SpatialGrid.queryRadius === "function") {
            candidates = SpatialGrid.queryRadius(px, py, pz, 4.0, o => o.active && !o.isPreview && (o.type === "wood_floor" || o.type === "thin_wood_floor" || o.type === "stone_floor" || o.type === "wood_roof"));
        }
        for (let o of candidates) {
            if (!o.active || o.isPreview) continue;
            if (o.type !== "wood_floor" && o.type !== "thin_wood_floor" && o.type !== "stone_floor" && o.type !== "wood_roof") continue;
            
            const isStone = o.type === "stone_floor";
            const floorW = o.width !== undefined ? o.width : (isStone ? (o.size || 0.25) * 12.0 : (o.size || 0.25) * 1.2);
            const floorD = o.depth !== undefined ? o.depth : (isStone ? (o.size || 0.25) * 12.0 : (o.size || 0.25) * 1.2);
            const maxBound = Math.max(floorW, floorD) / 2 + 0.5;

            const dx = o.position[0] - px, dy = o.position[1] - py, dz = o.position[2] - pz;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq > maxBound * maxBound) continue;

            const oR = o.R || [1, 0, 0];
            const oF = o.F || [0, 0, 1];
            const oN = o.normal || [0, 1, 0];

            if (o.type === "wood_floor" || o.type === "thin_wood_floor" || o.type === "stone_floor") {
                const halfW = floorW / 2 + 0.03;
                const halfD = floorD / 2 + 0.03;
                
                const lx = (px - o.position[0]) * oR[0] + (py - o.position[1]) * oR[1] + (pz - o.position[2]) * oR[2];
                const lz = (px - o.position[0]) * oF[0] + (py - o.position[1]) * oF[1] + (pz - o.position[2]) * oF[2];
                const ly = (px - o.position[0]) * oN[0] + (py - o.position[1]) * oN[1] + (pz - o.position[2]) * oN[2];

                // Point MUST strictly lie within the rectangular footprint and close to the floor's top surface
                if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfD && ly >= -0.15 && ly <= 0.35) {
                    let fHH = 0;
                    if (o.type === "stone_floor") fHH = (o.size || 0.25) * 0.15;
                    else if (o.type === "wood_floor") fHH = (typeof woodFloorHeight !== "undefined" ? woodFloorHeight : 0.06) + (o.size || 0.25) * 0.12;
                    else if (o.type === "thin_wood_floor") fHH = (o.size || 0.25) * 0.04;
                    const fR = Math.sqrt(o.position[0]**2 + o.position[1]**2 + o.position[2]**2);
                    if (fR > 0) {
                        surfaceRad = Math.max(surfaceRad, fR + fHH / 2);
                    }
                }
            } else if (o.type === "wood_roof") {
                const angle = o.angle || 0;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const roofR = [
                    oR[0] * cosA + oF[0] * sinA,
                    oR[1] * cosA + oF[1] * sinA,
                    oR[2] * cosA + oF[2] * sinA
                ];
                const roofF = [
                    oF[0] * cosA - oR[0] * sinA,
                    oF[1] * cosA - oR[0] * sinA,
                    oF[2] * cosA - oR[0] * sinA
                ];
                const halfW = 0.18;
                const halfD = 0.18;
                const lx = (px - o.position[0]) * roofR[0] + (py - o.position[1]) * roofR[1] + (pz - o.position[2]) * roofR[2];
                const lz = (px - o.position[0]) * roofF[0] + (py - o.position[1]) * roofF[1] + (pz - o.position[2]) * roofF[2];
                const ly = (px - o.position[0]) * oN[0] + (py - o.position[1]) * oN[1] + (pz - o.position[2]) * oN[2];

                if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfD && ly >= -0.05 && ly <= 0.40) {
                    const clampedZ = Math.max(-0.15, Math.min(0.15, lz));
                    const surfH = (0.125 + (clampedZ / 0.30) * 0.25 + 0.04);
                    const fR = Math.sqrt(o.position[0]**2 + o.position[1]**2 + o.position[2]**2);
                    if (fR > 0) {
                        surfaceRad = Math.max(surfaceRad, fR + surfH);
                    }
                }
            }
        }
        return surfaceRad;
    },

    // Unified Land Boat (Wheeled Vehicle & Sled Hull) terrain contact and transform calculation
    calculateLandBoatTransform: function({
        position,
        nx, ny, nz,
        F, R,
        baseRadius = null,
        waterEnabled = false,
        waterLevel = 0,
        waterAnimTime = 0,
        waveStrength = 0,
        hasWheels = true,
        isInWater: isInWaterArg = undefined
    }) {
        const rad = typeof RADIUS !== "undefined" ? RADIUS : 100;
        const hScale = typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 1;
        const seed = typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0;
        const getH = typeof getHeightOnSphere === "function" ? getHeightOnSphere : null;
        
        let pR = Math.sqrt(position[0]*position[0] + position[1]*position[1] + position[2]*position[2]) || 1;
        if (nx === undefined || ny === undefined || nz === undefined) {
            nx = position[0] / pR;
            ny = position[1] / pR;
            nz = position[2] / pR;
        }

        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, ny)));
        const phi = Math.atan2(nz, nx);
        
        let centerTerrainRad = baseRadius;
        if (centerTerrainRad === null) {
            if (typeof getTerrainSurfaceAndCeiling === "function") {
                const cData = getTerrainSurfaceAndCeiling(nx, ny, nz, pR);
                centerTerrainRad = cData.ground;
            } else {
                const centerTerrainH = getH ? getH(theta, phi, seed) : 0;
                centerTerrainRad = rad + centerTerrainH * hScale;
            }
        }

        // Check if sitting on constructed floors with precise bounding check
        centerTerrainRad = this.getFloorSurfaceRadiusAt(nx * centerTerrainRad, ny * centerTerrainRad, nz * centerTerrainRad, centerTerrainRad);
        
        const waterRadius = rad + waterLevel * 0.15;

        let isInWater = false;
        if (typeof isInWaterArg === "boolean") {
            isInWater = isInWaterArg;
        } else if (waterEnabled && centerTerrainRad < waterRadius && (waterRadius - centerTerrainRad > 0.05)) {
            isInWater = true;
        }

        let bF = F ? [F[0], F[1], F[2]] : [0, 0, 1];
        let bR_vec = R ? [R[0], R[1], R[2]] : [1, 0, 0];

        // 1. BOAT IN WATER: Keep exact original sinking depth of 0.04
        if (isInWater) {
            let waterBaseR = (baseRadius !== null && baseRadius >= waterRadius - 0.1) ? baseRadius : waterRadius;
            if (typeof getWaterWave === "function") {
                const wave = getWaterWave(nx * waterRadius, ny * waterRadius, nz * waterRadius, waterAnimTime, waveStrength);
                let depth = waterRadius - centerTerrainRad;
                let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                waterBaseR += wave * fade;
            }
            return {
                targetGroundRadius: waterBaseR - 0.04,
                baseRadius: waterBaseR,
                centerTerrainRad,
                isInWater: true,
                pitchGrade: 0,
                rollGrade: 0,
                normal: [nx, ny, nz],
                F: bF,
                R: bR_vec,
                wheelHeights: []
            };
        }

        // 2. NON-WHEELED BOAT ON LAND: Sits flush touching the ground
        if (!hasWheels) {
            return {
                targetGroundRadius: centerTerrainRad + 0.002,
                baseRadius: centerTerrainRad,
                centerTerrainRad,
                isInWater: false,
                pitchGrade: 0,
                rollGrade: 0,
                normal: [nx, ny, nz],
                F: bF,
                R: bR_vec,
                wheelHeights: []
            };
        }

        // 3. WHEELED BOAT ON LAND: Calculate wheel contact and terrain adaptation
        const fSideOff = typeof window !== "undefined" && typeof window.wheelFrontSideOffset === "number" ? window.wheelFrontSideOffset : 0.18;
        const fFwdOff  = typeof window !== "undefined" && typeof window.wheelFrontFwdOffset  === "number" ? window.wheelFrontFwdOffset  : 0.18;
        const fUpOff   = typeof window !== "undefined" && typeof window.wheelFrontUpOffset === "number" ? window.wheelFrontUpOffset : -0.03;

        const rSideOff = typeof window !== "undefined" && typeof window.wheelRearSideOffset === "number" ? window.wheelRearSideOffset : 0.18;
        const rFwdOff  = typeof window !== "undefined" && typeof window.wheelRearFwdOffset  === "number" ? window.wheelRearFwdOffset  : 0.18;
        const rUpOff   = typeof window !== "undefined" && typeof window.wheelRearUpOffset === "number" ? window.wheelRearUpOffset : -0.03;

        const wheelScale = typeof window !== "undefined" && typeof window.wheelScaleMultiplier === "number" ? window.wheelScaleMultiplier : 1.0;
        const wheelRadius = 0.16 * wheelScale;

        const wheelOffsets = [
            { id: "FL", side: -1, fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
            { id: "FR", side: 1,  fwd: fFwdOff,  sOff: fSideOff, uOff: fUpOff },
            { id: "RL", side: -1, fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff },
            { id: "RR", side: 1,  fwd: -rFwdOff, sOff: rSideOff, uOff: rUpOff }
        ];

        let maxWheelRequiredRadius = -Infinity;
        let reqRadii = [];
        let wHeights = [];

        for (let wo of wheelOffsets) {
            let wOffX = bR_vec[0] * (wo.side * wo.sOff) + nx * wo.uOff + bF[0] * wo.fwd;
            let wOffY = bR_vec[1] * (wo.side * wo.sOff) + ny * wo.uOff + bF[1] * wo.fwd;
            let wOffZ = bR_vec[2] * (wo.side * wo.sOff) + nz * wo.uOff + bF[2] * wo.fwd;

            let wWorldX = centerTerrainRad * nx + wOffX;
            let wWorldY = centerTerrainRad * ny + wOffY;
            let wWorldZ = centerTerrainRad * nz + wOffZ;

            let wR = Math.sqrt(wWorldX*wWorldX + wWorldY*wWorldY + wWorldZ*wWorldZ) || 1;
            let wTheta = Math.acos(Math.max(-1.0, Math.min(1.0, wWorldY / wR)));
            let wPhi = Math.atan2(wWorldZ, wWorldX);

            let wTerrainRad;
            if (typeof getTerrainSurfaceAndCeiling === "function") {
                const wCData = getTerrainSurfaceAndCeiling(wWorldX / wR, wWorldY / wR, wWorldZ / wR, wR);
                wTerrainRad = wCData.ground;
            } else {
                let wTerrainH = getH ? getH(wTheta, wPhi, seed) : 0;
                wTerrainRad = rad + wTerrainH * hScale;
            }

            // Floor check for this sample point with precise bounding
            wTerrainRad = this.getFloorSurfaceRadiusAt(wWorldX, wWorldY, wWorldZ, wTerrainRad);

            let wSurfaceRad = wTerrainRad;
            if (waterEnabled && wTerrainRad < waterRadius && (waterRadius - wTerrainRad > 0.3 * (typeof playerScale !== "undefined" ? playerScale : 1.0))) {
                let waveVal = (typeof getWaterWave === "function") ? getWaterWave(wWorldX, wWorldY, wWorldZ, waterAnimTime, waveStrength) : 0;
                let depth = waterRadius - wTerrainRad;
                let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                wSurfaceRad = waterRadius + waveVal * fade;
            }
            wHeights.push(wSurfaceRad);

            let dSq = (wo.sOff * wo.sOff) + (wo.fwd * wo.fwd);
            let wheelContactRad = wTerrainRad + wheelRadius;
            let requiredBoatRad = (wheelContactRad * wheelContactRad > dSq)
                ? Math.sqrt(wheelContactRad * wheelContactRad - dSq) - wo.uOff
                : wheelContactRad - wo.uOff;

            if (requiredBoatRad > maxWheelRequiredRadius) {
                maxWheelRequiredRadius = requiredBoatRad;
            }
            reqRadii.push(requiredBoatRad);
        }

        let bR_baseline = centerTerrainRad + 0.04;
        let targetGroundRadius = bR_baseline;
        if (reqRadii.length === 4) {
            let avgWheelReq = (reqRadii[0] + reqRadii[1] + reqRadii[2] + reqRadii[3]) / 4;
            const slopeDiff = avgWheelReq - centerTerrainRad;
            const approxWheelDist = 0.35;
            if (slopeDiff > 0.01 && (slopeDiff / approxWheelDist) > 1.0) {
                targetGroundRadius = centerTerrainRad;
            } else {
                targetGroundRadius = Math.max(bR_baseline, avgWheelReq);
            }
        } else if (maxWheelRequiredRadius > -Infinity) {
            if ((maxWheelRequiredRadius - centerTerrainRad) > 0.01 && ((maxWheelRequiredRadius - centerTerrainRad) / 0.35) > 1.0) {
                targetGroundRadius = centerTerrainRad;
            } else {
                targetGroundRadius = Math.max(targetGroundRadius, maxWheelRequiredRadius);
            }
        }

        let pitchGrade = 0;
        let rollGrade = 0;
        let newNx = nx, newNy = ny, newNz = nz;
        let newF = [bF[0], bF[1], bF[2]];
        let newR = [bR_vec[0], bR_vec[1], bR_vec[2]];

        if (wHeights.length === 4 && !isInWater) {
            let fl = wHeights[0], fr = wHeights[1], rl = wHeights[2], rr = wHeights[3];
            let fAvg = (fl + fr) * 0.5;
            let rAvg = (rl + rr) * 0.5;
            let lAvg = (fl + rl) * 0.5;
            let rSideAvg = (fr + rr) * 0.5;

            pitchGrade = (fAvg - rAvg) / (fFwdOff + rFwdOff + 0.001);
            rollGrade  = (rSideAvg - lAvg) / (fSideOff + rSideOff + 0.001);

            pitchGrade = Math.max(-0.5, Math.min(0.5, pitchGrade));
            rollGrade  = Math.max(-0.5, Math.min(0.5, rollGrade));

            let tiltNx = nx - bF[0] * pitchGrade - bR_vec[0] * rollGrade;
            let tiltNy = ny - bF[1] * pitchGrade - bR_vec[1] * rollGrade;
            let tiltNz = nz - bF[2] * pitchGrade - bR_vec[2] * rollGrade;
            let tiltLen = Math.sqrt(tiltNx*tiltNx + tiltNy*tiltNy + tiltNz*tiltNz) || 1;

            newNx = tiltNx / tiltLen;
            newNy = tiltNy / tiltLen;
            newNz = tiltNz / tiltLen;

            let dotFN = bF[0]*newNx + bF[1]*newNy + bF[2]*newNz;
            let alignedF = [bF[0] - newNx*dotFN, bF[1] - newNy*dotFN, bF[2] - newNz*dotFN];
            let fLen = Math.sqrt(alignedF[0]*alignedF[0] + alignedF[1]*alignedF[1] + alignedF[2]*alignedF[2]) || 1;
            newF = [alignedF[0]/fLen, alignedF[1]/fLen, alignedF[2]/fLen];

            newR = [
                newNy*newF[2] - newNz*newF[1],
                newNz*newF[0] - newNx*newF[2],
                newNx*newF[1] - newNy*newF[0]
            ];
        }

        return {
            targetGroundRadius,
            baseRadius,
            centerTerrainRad,
            isInWater,
            pitchGrade,
            rollGrade,
            normal: [newNx, newNy, newNz],
            F: newF,
            R: newR,
            wheelHeights: wHeights
        };
    }
};

window.Physics = Physics;
