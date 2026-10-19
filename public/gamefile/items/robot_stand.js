// === SEEDPLANET MODULE: JS/ITEMS/ROBOT_STAND.JS ===
function drawRobotStand(item, vertices, colors, indices, targetBuffer) {
    const p = item.position;
    const r = item.R || [1,0,0], f = item.F || [0,0,1], n = item.normal || [0,1,0];
    const isPreview = item.isPreview;
    const isValid = item.isValidPlacement !== false;

    // Palette matching reference image (Dark charcoal action base with metallic pin highlights and clamp pads)
    const previewColor = isValid ? [0.95, 0.85, 0.45] : [0.9, 0.2, 0.2];
    const baseColor = isPreview ? previewColor : [0.16, 0.16, 0.18];       // Main dark charcoal / black base plate
    const bevelColor = isPreview ? previewColor : [0.12, 0.12, 0.14];      // Slightly darker sloped rim and cuts
    const armColor = isPreview ? previewColor : [0.20, 0.20, 0.23];        // Arm shafts
    const jointColor = isPreview ? previewColor : [0.10, 0.10, 0.12];      // Hinge hubs & sockets
    const pinColor = isPreview ? previewColor : [0.50, 0.52, 0.55];        // Silver metallic screw pin accents
    const accentColor = isPreview ? previewColor : [0.28, 0.28, 0.32];     // Joint collars & clamp pads

    // Absolute metric scale (1.0 = 1 meter)
    const scale = typeof item.size === "number" ? item.size : 1.0;

    function addLocalBox(cx, cy, cz, w, h, d, color) {
        const boxPos = [
            p[0] + r[0]*cx + n[0]*cy + f[0]*cz,
            p[1] + r[1]*cx + n[1]*cy + f[1]*cz,
            p[2] + r[2]*cx + n[2]*cy + f[2]*cz
        ];
        window.addBox(boxPos, w, h, d, color, r, n, f, vertices, colors, indices);
    }

    function addCylinderJoint(cx, cy, cz, radius, length, axis = "x", color = jointColor, numSegs = 6) {
        for (let i = 0; i < numSegs; i++) {
            const ang = (i / numSegs) * Math.PI;
            const w = Math.sin(Math.PI / numSegs) * radius * 2.1;
            const d = radius * 2.0;
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);
            const boxPos = [
                p[0] + r[0]*cx + n[0]*cy + f[0]*cz,
                p[1] + r[1]*cx + n[1]*cy + f[1]*cz,
                p[2] + r[2]*cx + n[2]*cy + f[2]*cz
            ];
            if (axis === "x") {
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
                window.addBox(boxPos, length, w, d, color, r, nRot, fRot, vertices, colors, indices);
            }
        }
    }

    // --- 1. BASE PLATE (ฐานตั้งวางแนบพื้น) ---
    // Bottom bevel base rim
    addLocalBox(0, 0.015, 0, 0.72, 0.03, 0.72, bevelColor);
    // Main stepped base body
    addLocalBox(0, 0.035, 0, 0.66, 0.03, 0.66, baseColor);
    // Top surface plate
    addLocalBox(0, 0.052, 0, 0.60, 0.015, 0.60, bevelColor);
    // Beveled corner feet (4 corners)
    addLocalBox(-0.30, 0.025, -0.30, 0.10, 0.04, 0.10, bevelColor);
    addLocalBox( 0.30, 0.025, -0.30, 0.10, 0.04, 0.10, bevelColor);
    addLocalBox(-0.30, 0.025,  0.30, 0.10, 0.04, 0.10, bevelColor);
    addLocalBox( 0.30, 0.025,  0.30, 0.10, 0.04, 0.10, bevelColor);
    // Circular corner mounting sockets
    addLocalBox(-0.24, 0.060, -0.24, 0.08, 0.01, 0.08, jointColor);
    addLocalBox( 0.24, 0.060, -0.24, 0.08, 0.01, 0.08, jointColor);
    addLocalBox(-0.24, 0.060,  0.24, 0.08, 0.01, 0.08, jointColor);
    addLocalBox( 0.24, 0.060,  0.24, 0.08, 0.01, 0.08, jointColor);
    // Center-back mounting socket block
    addLocalBox(0, 0.08, -0.16, 0.20, 0.04, 0.18, baseColor);

    // --- 2. LOWER BASE HINGE (ข้อต่อฐาน) ---
    // Twin vertical brackets
    addLocalBox(-0.07, 0.14, -0.16, 0.03, 0.08, 0.14, jointColor);
    addLocalBox( 0.07, 0.14, -0.16, 0.03, 0.08, 0.14, jointColor);
    // Pivot cylinder axle pin across x-axis
    addCylinderJoint(0, 0.15, -0.16, 0.05, 0.16, "x", jointColor);
    // Screw pin caps
    addLocalBox(-0.09, 0.15, -0.16, 0.02, 0.06, 0.06, pinColor);
    addLocalBox( 0.09, 0.15, -0.16, 0.02, 0.06, 0.06, pinColor);

    // --- 3. LOWER ARM SHAFT (แขนส่วนล่าง) ---
    addLocalBox(0, 0.27, -0.13, 0.10, 0.26, 0.10, armColor);
    // Lower collar and upper collar
    addLocalBox(0, 0.18, -0.15, 0.12, 0.03, 0.12, accentColor);
    addLocalBox(0, 0.35, -0.11, 0.12, 0.03, 0.12, accentColor);

    // --- 4. MIDDLE ELBOW JOINT (ข้อต่อกลาง) ---
    addCylinderJoint(0, 0.39, -0.10, 0.06, 0.16, "x", jointColor);
    // Pin caps
    addLocalBox(-0.09, 0.39, -0.10, 0.02, 0.07, 0.07, pinColor);
    addLocalBox( 0.09, 0.39, -0.10, 0.02, 0.07, 0.07, pinColor);

    // --- 5. UPPER ARM SHAFT (แขนส่วนบน) ---
    addLocalBox(0, 0.53, -0.06, 0.09, 0.28, 0.09, armColor);
    // Lower collar and upper collar
    addLocalBox(0, 0.44, -0.09, 0.11, 0.03, 0.11, accentColor);
    addLocalBox(0, 0.62, -0.03, 0.11, 0.03, 0.11, accentColor);

    // --- 6. TOP WRIST JOINT (ข้อต่อบน) ---
    addCylinderJoint(0, 0.65, -0.02, 0.05, 0.14, "x", jointColor);
    addLocalBox(0, 0.66, -0.02, 0.12, 0.05, 0.10, jointColor);

    // --- 7. HOLDING CLAMP / GRIPPING CRADLE (โอบรับห้องนักบิน Cockpit ที่ความสูง 0.66m พอดี) ---
    // Transverse mounting bar
    addLocalBox(0, 0.64, -0.02, 0.34, 0.04, 0.08, armColor);

    // A. Bottom Pelvis Saddle Pad (ฐานรองรับก้นห้องนักบิน)
    addLocalBox(0, 0.60, 0.02, 0.22, 0.04, 0.16, baseColor);
    addLocalBox(0, 0.625, 0.02, 0.18, 0.02, 0.14, jointColor);

    // B. Back Spine Bracket (ฉากยึดด้านหลัง)
    addLocalBox(0, 0.66, -0.17, 0.18, 0.16, 0.04, baseColor);
    addLocalBox(0, 0.66, -0.15, 0.14, 0.12, 0.02, jointColor);

    // C. Left & Right Side Gripping Claws (ก้ามจับประคองลำตัวข้างซ้าย-ขวา)
    // Left claw arm
    addLocalBox(-0.17, 0.65, -0.02, 0.05, 0.06, 0.08, baseColor);
    addLocalBox(-0.18, 0.68,  0.05, 0.04, 0.08, 0.16, armColor);
    addLocalBox(-0.15, 0.69,  0.12, 0.06, 0.06, 0.06, accentColor);
    addLocalBox(-0.155, 0.68, 0.05, 0.02, 0.06, 0.12, jointColor); // Inner soft grip pad

    // Right claw arm
    addLocalBox( 0.17, 0.65, -0.02, 0.05, 0.06, 0.08, baseColor);
    addLocalBox( 0.18, 0.68,  0.05, 0.04, 0.08, 0.16, armColor);
    addLocalBox( 0.15, 0.69,  0.12, 0.06, 0.06, 0.06, accentColor);
    addLocalBox( 0.155, 0.68, 0.05, 0.02, 0.06, 0.12, jointColor); // Inner soft grip pad
}

window.ItemRegistry["robot_stand"] = { render: drawRobotStand };

