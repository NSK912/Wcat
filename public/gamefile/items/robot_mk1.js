// === SEEDPLANET MODULE: JS/ITEMS/ROBOT_PARTS.JS ===

function drawRobotPart(item, vertices, colors, indices, targetBuffer, partType) {
    const p = item.position;
    const r = item.R || [1,0,0], f = item.F || [0,0,1], n = item.normal || [0,1,0];
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;
    
    // Base colors matching carved oak wood from reference image
    const woodColor = isPreview ? (isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2]) : [0.52, 0.35, 0.18];
    const darkWood = isPreview ? (isValid ? [0.8, 0.7, 0.3] : [0.7, 0.1, 0.1]) : [0.38, 0.24, 0.11];
    const lightWood = isPreview ? (isValid ? [1.0, 0.9, 0.5] : [1.0, 0.3, 0.3]) : [0.65, 0.45, 0.25];
    const accentWood = isPreview ? (isValid ? [0.85, 0.75, 0.35] : [0.8, 0.15, 0.15]) : [0.44, 0.28, 0.14];

    // Scale factor
    let cs = typeof item.size === "number" ? item.size : 1.0;
    cs *= 1.5;

    function addLocalBox(cx, cy, cz, w, h, d, color) {
        const boxPos = [
            p[0] + r[0]*(cx*cs) + n[0]*(cy*cs) + f[0]*(cz*cs),
            p[1] + r[1]*(cx*cs) + n[1]*(cy*cs) + f[1]*(cz*cs),
            p[2] + r[2]*(cx*cs) + n[2]*(cy*cs) + f[2]*(cz*cs)
        ];
        window.addBox(boxPos, w*cs, h*cs, d*cs, color, r, n, f, vertices, colors, indices);
    }

    function addRotatedLocalBox(cx, cy, cz, w, h, d, color, yawAngle = 0) {
        const cosY = Math.cos(yawAngle);
        const sinY = Math.sin(yawAngle);
        
        const boxPos = [
            p[0] + r[0]*(cx*cs) + n[0]*(cy*cs) + f[0]*(cz*cs),
            p[1] + r[1]*(cx*cs) + n[1]*(cy*cs) + f[1]*(cz*cs),
            p[2] + r[2]*(cx*cs) + n[2]*(cy*cs) + f[2]*(cz*cs)
        ];

        const rVec = [
            r[0]*cosY - f[0]*sinY,
            r[1]*cosY - f[1]*sinY,
            r[2]*cosY - f[2]*sinY
        ];
        const fVec = [
            r[0]*sinY + f[0]*cosY,
            r[1]*sinY + f[1]*cosY,
            r[2]*sinY + f[2]*cosY
        ];

        window.addBox(boxPos, w*cs, h*cs, d*cs, color, rVec, n, fVec, vertices, colors, indices);
    }

    // Helper to render cylindrical joint hubs / pegs
    function addCylinderJoint(cx, cy, cz, radius, length, axis = "x", color = darkWood, numSegs = 5) {
        for (let i = 0; i < numSegs; i++) {
            const ang = (i / numSegs) * Math.PI;
            const w = Math.sin(Math.PI / numSegs) * radius * 2.2;
            const d = radius * 2.0;

            const boxPos = [
                p[0] + r[0]*(cx*cs) + n[0]*(cy*cs) + f[0]*(cz*cs),
                p[1] + r[1]*(cx*cs) + n[1]*(cy*cs) + f[1]*(cz*cs),
                p[2] + r[2]*(cx*cs) + n[2]*(cy*cs) + f[2]*(cz*cs)
            ];

            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);

            if (axis === "x") {
                // Cylinder axis along 'r' (horizontal X-axis hinge). Cross-section in Y-Z plane.
                const nRot = [
                    n[0]*cosA - f[0]*sinA,
                    n[1]*cosA - f[1]*sinA,
                    n[2]*cosA - f[2]*sinA
                ];
                const fRot = [
                    n[0]*sinA + f[0]*cosA,
                    n[1]*sinA + f[1]*cosA,
                    n[2]*sinA + f[2]*cosA
                ];
                window.addBox(boxPos, length*cs, w*cs, d*cs, color, r, nRot, fRot, vertices, colors, indices);
            } else if (axis === "y") {
                // Cylinder axis along 'n' (vertical Y-axis). Cross-section in X-Z plane.
                const rRot = [
                    r[0]*cosA - f[0]*sinA,
                    r[1]*cosA - f[1]*sinA,
                    r[2]*cosA - f[2]*sinA
                ];
                const fRot = [
                    r[0]*sinA + f[0]*cosA,
                    r[1]*sinA + f[1]*cosA,
                    r[2]*sinA + f[2]*cosA
                ];
                window.addBox(boxPos, w*cs, length*cs, d*cs, color, rRot, n, fRot, vertices, colors, indices);
            } else if (axis === "z") {
                // Cylinder axis along 'f' (depth Z-axis). Cross-section in X-Y plane.
                const rRot = [
                    r[0]*cosA - n[0]*sinA,
                    r[1]*cosA - n[1]*sinA,
                    r[2]*cosA - n[2]*sinA
                ];
                const nRot = [
                    r[0]*sinA + n[0]*cosA,
                    r[1]*sinA + n[1]*cosA,
                    r[2]*sinA + n[2]*cosA
                ];
                window.addBox(boxPos, w*cs, d*cs, length*cs, color, rRot, nRot, f, vertices, colors, indices);
            }
        }
    }

    if (partType === "cockpit") {
        // --- 1. ROUNDED CYLINDRICAL COCKPIT POD ---
        // Base floor disk
        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI / 2;
            addRotatedLocalBox(0, 0.05, 0, 0.85, 0.1, 0.85, darkWood, ang);
        }

        // Circular Outer Wall (10 vertical staves forming rounded barrel)
        const radius = 0.46;
        const numStaves = 10;
        for (let i = 0; i < numStaves; i++) {
            const ang = (i / numStaves) * Math.PI * 2;
            const cx = Math.sin(ang) * radius;
            const cz = Math.cos(ang) * radius;

            // Front staves are shorter (opening for pilot), back/side are tall
            const isFront = (cz > 0.15);
            const isFrontCenter = (cz > 0.3 && Math.abs(cx) < 0.25);
            
            let h = 0.75;
            let cy = 0.425;

            if (isFrontCenter) {
                h = 0.25;
                cy = 0.175;
            } else if (isFront) {
                h = 0.45;
                cy = 0.275;
            }

            // Outer wooden stave
            addRotatedLocalBox(cx, cy, cz, 0.32, h, 0.12, woodColor, ang);
        }

        // Thick Top Rim / Collar Ring around the top opening
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const cx = Math.sin(ang) * (radius + 0.02);
            const cz = Math.cos(ang) * (radius + 0.02);
            // Leave front open
            if (cz > 0.25 && Math.abs(cx) < 0.2) continue;
            
            const cy = (cz > 0.15) ? 0.48 : 0.78;
            addRotatedLocalBox(cx, cy, cz, 0.34, 0.1, 0.14, lightWood, ang);
        }

        // Front Upper Collar Guard / Bumper
        for (let i = -2; i <= 2; i++) {
            const ang = (i / 8) * (Math.PI / 2);
            const cx = Math.sin(ang) * (radius + 0.05);
            const cz = Math.cos(ang) * (radius + 0.05);
            addRotatedLocalBox(cx, 0.22, cz, 0.22, 0.15, 0.12, accentWood, ang);
        }

        // Front Chest Armor Plate (Chunky carved chest section from photo)
        addLocalBox(0, 0.12, 0.48, 0.42, 0.2, 0.12, woodColor);
        addLocalBox(0, 0.12, 0.52, 0.28, 0.16, 0.08, lightWood); // Center emblem plate

        // Interior Pilot Seat
        addLocalBox(0, 0.08, -0.05, 0.42, 0.1, 0.4, lightWood);
        addLocalBox(0, 0.28, -0.22, 0.38, 0.32, 0.1, lightWood);
        addLocalBox(0, 0.48, -0.22, 0.28, 0.14, 0.1, woodColor);
        addLocalBox(-0.22, 0.16, -0.05, 0.08, 0.12, 0.35, darkWood);
        addLocalBox(0.22, 0.16, -0.05, 0.08, 0.12, 0.35, darkWood);
        addLocalBox(-0.18, 0.20, 0.12, 0.04, 0.10, 0.04, lightWood);
        addLocalBox(0.18, 0.20, 0.12, 0.04, 0.10, 0.04, lightWood);

        // --- 2. ARM ATTACHMENT SOCKETS & PEGS (ส่วนต่อแขนด้านข้าง) ---
        // Left Arm Shoulder Mount
        addCylinderJoint(-0.52, 0.45, 0.0, 0.18, 0.18, "x", darkWood); // Base socket hub
        addCylinderJoint(-0.62, 0.45, 0.0, 0.12, 0.14, "x", lightWood); // Inner joint ring
        addLocalBox(-0.70, 0.45, 0.0, 0.12, 0.1, 0.1, accentWood);     // Arm connection peg shaft
        addLocalBox(-0.76, 0.45, 0.0, 0.04, 0.14, 0.14, darkWood);     // End locking cap

        // Right Arm Shoulder Mount
        addCylinderJoint(0.52, 0.45, 0.0, 0.18, 0.18, "x", darkWood);  // Base socket hub
        addCylinderJoint(0.62, 0.45, 0.0, 0.12, 0.14, "x", lightWood);  // Inner joint ring
        addLocalBox(0.70, 0.45, 0.0, 0.12, 0.1, 0.1, accentWood);      // Arm connection peg shaft
        addLocalBox(0.76, 0.45, 0.0, 0.04, 0.14, 0.14, darkWood);      // End locking cap

        // --- 3. MID-SECTION WAIST & BELT RING ---
        // Waist Column (Torso core extending downward)
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI / 2;
            addRotatedLocalBox(0, -0.12, 0, 0.65, 0.24, 0.65, darkWood, ang);
        }
        // Belt Ring with decorative wooden pegs/latches
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const cx = Math.sin(ang) * 0.38;
            const cz = Math.cos(ang) * 0.38;
            addRotatedLocalBox(cx, -0.12, cz, 0.14, 0.12, 0.1, accentWood, ang);
        }

        // --- 4. BOTTOM LEG ATTACHMENT FRAME & PELVIS (ส่วนต่อขาด้านล่าง) ---
        // Central Pelvis Core Block
        addLocalBox(0, -0.32, 0.0, 0.52, 0.2, 0.42, woodColor);
        // Front Center Codpiece / Pelvis Armor Flap
        addLocalBox(0, -0.34, 0.22, 0.2, 0.25, 0.1, accentWood);
        addLocalBox(0, -0.32, 0.26, 0.14, 0.18, 0.04, lightWood);

        // Left & Right Hip Connection Sockets / Joints (where legs attach)
        // Left Hip Joint Hub
        addCylinderJoint(-0.28, -0.35, 0.0, 0.16, 0.22, "x", darkWood);
        addCylinderJoint(-0.28, -0.44, 0.0, 0.12, 0.14, "z", lightWood); // Downward leg peg socket
        addLocalBox(-0.38, -0.35, 0.0, 0.1, 0.14, 0.14, accentWood);     // Side hip cap

        // Right Hip Joint Hub
        addCylinderJoint(0.28, -0.35, 0.0, 0.16, 0.22, "x", darkWood);
        addCylinderJoint(0.28, -0.44, 0.0, 0.12, 0.14, "z", lightWood);  // Downward leg peg socket
        addLocalBox(0.38, -0.35, 0.0, 0.1, 0.14, 0.14, accentWood);      // Side hip cap

    } else if (partType === "left_arm" || partType === "right_arm") {
        // --- DETAILED ROBOT ARM MATCHING REFERENCE IMAGE ---
        const isLeft = (partType === "left_arm");
        const dir = isLeft ? -1 : 1;
        const xOff = dir * 0.2;

        const elbowBend = item.elbowAngle || 0.0;
        const cosE = Math.cos(elbowBend);
        const sinE = Math.sin(elbowBend);

        const elbowY = 0.38;
        const elbowZ = 0.0;

        function addArmBox(cx, cy, cz, w, h, d, color, isLowerArm = false) {
            if (!isLowerArm) {
                addLocalBox(cx, cy, cz, w, h, d, color);
            } else {
                const relY = cy - elbowY;
                const relZ = cz - elbowZ;

                const nVec = [
                    n[0] * cosE - f[0] * sinE,
                    n[1] * cosE - f[1] * sinE,
                    n[2] * cosE - f[2] * sinE
                ];
                const fVec = [
                    n[0] * sinE + f[0] * cosE,
                    n[1] * sinE + f[1] * cosE,
                    n[2] * sinE + f[2] * cosE
                ];

                const boxPos = [
                    p[0] + r[0]*(cx*cs) + n[0]*(elbowY*cs) + f[0]*(elbowZ*cs) + nVec[0]*(relY*cs) + fVec[0]*(relZ*cs),
                    p[1] + r[1]*(cx*cs) + n[1]*(elbowY*cs) + f[1]*(elbowZ*cs) + nVec[1]*(relY*cs) + fVec[1]*(relZ*cs),
                    p[2] + r[2]*(cx*cs) + n[2]*(elbowY*cs) + f[2]*(elbowZ*cs) + nVec[2]*(relY*cs) + fVec[2]*(relZ*cs)
                ];
                window.addBox(boxPos, w*cs, h*cs, d*cs, color, r, nVec, fVec, vertices, colors, indices);
            }
        }

        function addArmCylinderJoint(cx, cy, cz, radius, length, axis = "x", color = darkWood, numSegs = 4, isLowerArm = false) {
            let nVec = n, fVec = f;
            let relY = cy - elbowY;
            let relZ = cz - elbowZ;
            let boxPos;

            if (isLowerArm) {
                nVec = [
                    n[0] * cosE - f[0] * sinE,
                    n[1] * cosE - f[1] * sinE,
                    n[2] * cosE - f[2] * sinE
                ];
                fVec = [
                    n[0] * sinE + f[0] * cosE,
                    n[1] * sinE + f[1] * cosE,
                    n[2] * sinE + f[2] * cosE
                ];
                boxPos = [
                    p[0] + r[0]*(cx*cs) + n[0]*(elbowY*cs) + f[0]*(elbowZ*cs) + nVec[0]*(relY*cs) + fVec[0]*(relZ*cs),
                    p[1] + r[1]*(cx*cs) + n[1]*(elbowY*cs) + f[1]*(elbowZ*cs) + nVec[1]*(relY*cs) + fVec[1]*(relZ*cs),
                    p[2] + r[2]*(cx*cs) + n[2]*(elbowY*cs) + f[2]*(elbowZ*cs) + nVec[2]*(relY*cs) + fVec[2]*(relZ*cs)
                ];
            } else {
                boxPos = [
                    p[0] + r[0]*(cx*cs) + n[0]*(cy*cs) + f[0]*(cz*cs),
                    p[1] + r[1]*(cx*cs) + n[1]*(cy*cs) + f[1]*(cz*cs),
                    p[2] + r[2]*(cx*cs) + n[2]*(cy*cs) + f[2]*(cz*cs)
                ];
            }

            for (let i = 0; i < numSegs; i++) {
                const ang = (i / numSegs) * Math.PI;
                const w = Math.sin(Math.PI / numSegs) * radius * 2.2;
                const d = radius * 2.0;

                const cosA = Math.cos(ang);
                const sinA = Math.sin(ang);

                if (axis === "x") {
                    const nRot = [
                        nVec[0]*cosA - fVec[0]*sinA,
                        nVec[1]*cosA - fVec[1]*sinA,
                        nVec[2]*cosA - fVec[2]*sinA
                    ];
                    const fRot = [
                        nVec[0]*sinA + fVec[0]*cosA,
                        nVec[1]*sinA + fVec[1]*cosA,
                        nVec[2]*sinA + fVec[2]*cosA
                    ];
                    window.addBox(boxPos, length*cs, w*cs, d*cs, color, r, nRot, fRot, vertices, colors, indices);
                }
            }
        }

        // 1. Shoulder Joint Hub & Peg Shaft
        addCylinderJoint(xOff, 0.9, 0.0, 0.20, 0.24, "x", darkWood);
        addArmBox(xOff - dir * 0.12, 0.9, 0.0, 0.1, 0.14, 0.14, accentWood); // Connection shaft peg
        addArmBox(xOff - dir * 0.16, 0.9, 0.0, 0.04, 0.18, 0.18, darkWood);  // End cap

        // 2. Upper Arm (Cylindrical carved oak sleeve)
        addArmBox(xOff, 0.65, 0.0, 0.30, 0.38, 0.30, woodColor);
        addArmBox(xOff, 0.76, 0.0, 0.34, 0.12, 0.34, lightWood); // Upper shoulder armor collar

        // 3. Elbow Joint (Prominent circular wooden cylinder/disc hinge)
        addCylinderJoint(xOff, 0.38, 0.0, 0.18, 0.30, "x", darkWood);
        addArmBox(xOff + dir * 0.16, 0.38, 0.0, 0.06, 0.14, 0.14, accentWood); // Side pin cap

        // 4. Forearm (Chunky carved wooden forearm with dark wrist cuff)
        addArmBox(xOff, 0.12, 0.05, 0.28, 0.38, 0.30, woodColor, true);
        addArmBox(xOff, -0.02, 0.05, 0.31, 0.10, 0.32, darkWood, true); // Wrist cuff ring

        // 5. Hand with carved articulated wooden fingers
        // Palm
        addArmBox(xOff, -0.16, 0.05, 0.16, 0.12, 0.26, lightWood, true);
        // Articulated Fingers (rotated to face parallel to body)
        for (let fIdx = -1; fIdx <= 1; fIdx++) {
            const fZ = 0.05 + fIdx * 0.075;
            addArmBox(xOff, -0.28, fZ, 0.06, 0.14, 0.05, darkWood, true); // Finger segment 1
            addArmBox(xOff, -0.34, fZ, 0.05, 0.06, 0.04, lightWood, true); // Knuckle joint
            addArmBox(xOff, -0.40, fZ, 0.06, 0.10, 0.05, woodColor, true); // Fingertip tip
        }
        // Thumb (Pointing forward)
        addArmBox(xOff, -0.22, 0.05 - 0.13, 0.06, 0.14, 0.06, accentWood, true);

    } else if (partType === "left_leg" || partType === "right_leg") {
        // --- DETAILED ROBOT LEG MATCHING REFERENCE IMAGE ---
        const isLeft = (partType === "left_leg");
        const dir = isLeft ? -1 : 1;
        const xOff = dir * 0.2;

        const kneeBend = item.kneeAngle || 0.0;
        const cosK = Math.cos(kneeBend);
        const sinK = Math.sin(kneeBend);

        const kneeY = 0.35;
        const kneeZ = 0.08;

        function addLegBox(cx, cy, cz, w, h, d, color, isLowerLeg = false) {
            if (!isLowerLeg) {
                addLocalBox(cx, cy, cz, w, h, d, color);
            } else {
                const relY = cy - kneeY;
                const relZ = cz - kneeZ;
                const bentY = kneeY + (relY * cosK - relZ * sinK);
                const bentZ = kneeZ + (relY * sinK + relZ * cosK);

                const nVec = [
                    n[0] * cosK + f[0] * sinK,
                    n[1] * cosK + f[1] * sinK,
                    n[2] * cosK + f[2] * sinK
                ];
                const fVec = [
                    -n[0] * sinK + f[0] * cosK,
                    -n[1] * sinK + f[1] * cosK,
                    -n[2] * sinK + f[2] * cosK
                ];

                const boxPos = [
                    p[0] + r[0]*(cx*cs) + nVec[0]*(bentY*cs) + fVec[0]*(bentZ*cs),
                    p[1] + r[1]*(cx*cs) + nVec[1]*(bentY*cs) + fVec[1]*(bentZ*cs),
                    p[2] + r[2]*(cx*cs) + nVec[2]*(bentY*cs) + fVec[2]*(bentZ*cs)
                ];
                window.addBox(boxPos, w*cs, h*cs, d*cs, color, r, nVec, fVec, vertices, colors, indices);
            }
        }

        function addLegCylinderJoint(cx, cy, cz, radius, length, axis = "x", color = darkWood, numSegs = 4, isLowerLeg = false) {
            let nVec = n, fVec = f, posY = cy, posZ = cz;
            if (isLowerLeg) {
                const relY = cy - kneeY;
                const relZ = cz - kneeZ;
                posY = kneeY + (relY * cosK - relZ * sinK);
                posZ = kneeZ + (relY * sinK + relZ * cosK);
                nVec = [
                    n[0] * cosK + f[0] * sinK,
                    n[1] * cosK + f[1] * sinK,
                    n[2] * cosK + f[2] * sinK
                ];
                fVec = [
                    -n[0] * sinK + f[0] * cosK,
                    -n[1] * sinK + f[1] * cosK,
                    -n[2] * sinK + f[2] * cosK
                ];
            }

            for (let i = 0; i < numSegs; i++) {
                const ang = (i / numSegs) * Math.PI;
                const w = Math.sin(Math.PI / numSegs) * radius * 2.2;
                const d = radius * 2.0;

                const cosY = Math.cos(ang);
                const sinY = Math.sin(ang);

                const boxPos = [
                    p[0] + r[0]*(cx*cs) + nVec[0]*(posY*cs) + fVec[0]*(posZ*cs),
                    p[1] + r[1]*(cx*cs) + nVec[1]*(posY*cs) + fVec[1]*(posZ*cs),
                    p[2] + r[2]*(cx*cs) + nVec[2]*(posY*cs) + fVec[2]*(posZ*cs)
                ];

                const cosA = Math.cos(ang);
                const sinA = Math.sin(ang);

                if (axis === "x") {
                    const nRot = [
                        nVec[0]*cosA - fVec[0]*sinA,
                        nVec[1]*cosA - fVec[1]*sinA,
                        nVec[2]*cosA - fVec[2]*sinA
                    ];
                    const fRot = [
                        nVec[0]*sinA + fVec[0]*cosA,
                        nVec[1]*sinA + fVec[1]*cosA,
                        nVec[2]*sinA + fVec[2]*cosA
                    ];
                    window.addBox(boxPos, length*cs, w*cs, d*cs, color, r, nRot, fRot, vertices, colors, indices);
                }
            }
        }

        // 1. Hip Joint Hub & Side Axle Pin Cap
        addCylinderJoint(xOff, 0.9, 0.0, 0.20, 0.24, "x", darkWood);
        addLegBox(xOff + dir * 0.14, 0.9, 0.0, 0.10, 0.14, 0.14, accentWood);

        // 2. Thigh (Heavy carved wooden thigh block)
        addLegBox(xOff, 0.62, 0.05, 0.34, 0.42, 0.34, woodColor);
        addLegBox(xOff, 0.72, 0.05, 0.38, 0.12, 0.38, lightWood); // Top thigh collar plate

        // 3. Knee Pivot Joint (Prominent circular cylinder/disc hinge matching image)
        addCylinderJoint(xOff, 0.35, 0.08, 0.20, 0.32, "x", darkWood);
        addLegBox(xOff, 0.35, 0.24, 0.28, 0.20, 0.08, accentWood); // Front knee-cap armor guard

        // 4. Lower Leg / Calf (Heavy shin block)
        addLegBox(xOff, 0.08, 0.08, 0.36, 0.42, 0.36, woodColor, true);
        addLegBox(xOff, 0.14, 0.24, 0.30, 0.22, 0.08, darkWood, true); // Front shin armor plate

        // 5. Ankle Joint (Cylindrical hinge axle)
        addLegCylinderJoint(xOff, -0.16, 0.08, 0.16, 0.30, "x", darkWood, 8, true);

        // 6. Large Blocky Wooden Foot (Toe & Heel sections from reference photo)
        // Main foot base
        addLegBox(xOff, -0.28, 0.12, 0.40, 0.14, 0.54, lightWood, true);
        // Split toe front blocks
        addLegBox(xOff - 0.09, -0.26, 0.38, 0.18, 0.12, 0.24, woodColor, true);
        addLegBox(xOff + 0.09, -0.26, 0.38, 0.18, 0.12, 0.24, woodColor, true);
        // Heel block
        addLegBox(xOff, -0.26, -0.10, 0.38, 0.14, 0.18, darkWood, true);
    }
}

window.ItemRegistry["robot_cockpit"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "cockpit") };
window.ItemRegistry["robot_left_arm"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "left_arm") };
window.ItemRegistry["robot_right_arm"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "right_arm") };
window.ItemRegistry["robot_left_leg"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "left_leg") };
window.ItemRegistry["robot_right_leg"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "right_leg") };
window.ItemRegistry["robot_core"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "core") };
window.ItemRegistry["robot_module"] = { render: (i, v, c, idx, t) => drawRobotPart(i, v, c, idx, t, "module") };
