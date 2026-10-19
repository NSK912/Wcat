
// --- Character Shaders ---
window.characterVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aLocalPos;
            attribute vec3 aNormal;
            attribute vec3 aColor;
            attribute vec2 aTexCoord;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uModelMatrix;
            uniform mat4 uLightSpaceMatrix;
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec3 vLocalPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying vec3 vColor;
            varying vec2 vTexCoord;
            void main() {
                vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vPosition = mvPosition.xyz;
                vNormal = mat3(uModelViewMatrix) * aNormal;
                vLocalPos = aLocalPos;
                vColor = aColor;
                vTexCoord = aTexCoord;
                
                vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
                vWorldNormal = normalize(mat3(uModelMatrix) * aNormal);
                vWorldPos = worldPos.xyz;
                vPositionLightSpace = uLightSpaceMatrix * worldPos;
                            }
        `;

      window.characterFragmentShaderSource = `
            precision highp float;
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec3 vLocalPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying vec3 vColor;
            varying vec2 vTexCoord;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform sampler2D uShadowMap;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;
            uniform sampler2D uFaceTex;
            uniform float uUseFaceTex;
            uniform sampler2D uMainTex;
            uniform float uHasMainTex;

            float distToSegment(vec2 p, vec2 a, vec2 b) {
                vec2 pa = p - a, ba = b - a;
                float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
                return length(pa - ba*h);
            }

            float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
                if (uShadowsEnabled < 0.5) return 1.0;
                vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
                projCoords = projCoords * 0.5 + 0.5;
                
                if (projCoords.z > 1.0 || projCoords.z < 0.0) return 1.0;
                if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;

                float currentDepth = projCoords.z;
                float cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
                float slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
                float bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
                
                vec2 texelSize = (uShadowTexelSize.x > 0.0) ? uShadowTexelSize : vec2(1.0 / 1024.0);
                float shadow = 0.0;

                for (int x = -1; x <= 1; x++) {
                    for (int y = -1; y <= 1; y++) {
                        float pcfDepth = texture2D(uShadowMap, projCoords.xy + vec2(float(x), float(y)) * texelSize).r;
                        shadow += (currentDepth - bias) > pcfDepth ? 0.0 : 1.0;
                    }
                }
                shadow /= 9.0;

                float distFromCenter = length(projCoords.xy - vec2(0.5));
                float edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);

                return mix(1.0, shadow, edgeFade);
            }

            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 lightDir = normalize(uLightDir);
                
                float diffuseVal = max(dot(normal, lightDir), 0.0);
                
                // Shadow
                float shadow = calculateShadow(vPositionLightSpace, normalize(vWorldNormal), normalize(uLightDir));
                if (diffuseVal <= 0.0) {
                    shadow = 0.0;
                }
                float lit = mix(0.3, 1.0, shadow);
                float diffuse = diffuseVal * lit * 0.75 + 0.25;
                
                // Character does not reflect light (matte surface, no specular or fresnel reflection)
                vec3 baseColor = vColor;
                if (uHasMainTex > 0.5) {
                    baseColor = texture2D(uMainTex, vTexCoord).rgb;
                }

                if (uHasMainTex < 0.5 && vLocalPos.y > 0.22 && vLocalPos.y < 0.67 && vLocalPos.z > 0.04 && vLocalPos.z < 0.28) {
                    vec2 uv = vec2(vLocalPos.x, vLocalPos.y - 0.43) / 0.24;
                    
                    if (uUseFaceTex > 0.5) {
                        float halfW = 0.56;
                        float halfH = 0.28;
                        float texU = (uv.x / (halfW * 2.0)) + 0.5;
                        float texV = 0.5 - ((uv.y - (-0.01)) / (halfH * 2.0));
                        if (texU >= 0.0 && texU <= 1.0 && texV >= 0.0 && texV <= 1.0) {
                            vec4 faceCol = texture2D(uFaceTex, vec2(texU, texV));
                            baseColor = mix(baseColor, faceCol.rgb, faceCol.a);
                        }
                    } else {
                        // --- 1. Rosy ChiBi Blush Cheeks ---
                    float dLeftCheek = length(vec2(uv.x - (-0.38), (uv.y - (-0.18)) * 1.3));
                    float dRightCheek = length(vec2(uv.x - 0.38, (uv.y - (-0.18)) * 1.3));
                    float sCheeks = max(smoothstep(0.14, 0.02, dLeftCheek), smoothstep(0.14, 0.02, dRightCheek)) * 0.55;
                    vec3 cheekColor = vec3(1.0, 0.52, 0.60);
                    
                    // --- 2. Large Anime Chibi Eyes ---
                    vec2 leftEyeUv = vec2(uv.x - (-0.23), (uv.y - 0.01) * 0.75);
                    vec2 rightEyeUv = vec2(uv.x - 0.23, (uv.y - 0.01) * 0.75);
                    float dLeftEye = length(leftEyeUv);
                    float dRightEye = length(rightEyeUv);
                    
                    // Sclera / Eye White
                    float eyeRadius = 0.125;
                    float sEyeWhite = max(smoothstep(eyeRadius, eyeRadius - 0.015, dLeftEye),
                                          smoothstep(eyeRadius, eyeRadius - 0.015, dRightEye));
                    
                    // Large Warm Amber Gradient Iris
                    float dLeftIris = length(vec2(leftEyeUv.x, leftEyeUv.y * 0.88));
                    float dRightIris = length(vec2(rightEyeUv.x, rightEyeUv.y * 0.88));
                    float irisRadius = 0.098;
                    float sIris = max(smoothstep(irisRadius, irisRadius - 0.015, dLeftIris),
                                      smoothstep(irisRadius, irisRadius - 0.015, dRightIris));
                    
                    float irisY = clamp((uv.y - 0.01) / 0.12, -1.0, 1.0);
                    vec3 irisColor = mix(vec3(0.85, 0.52, 0.18), vec3(0.24, 0.11, 0.05), irisY * 0.5 + 0.5);
                    
                    // Dark Pupil
                    float dLeftPupil = length(vec2(leftEyeUv.x, leftEyeUv.y - 0.01));
                    float dRightPupil = length(vec2(rightEyeUv.x, rightEyeUv.y - 0.01));
                    float sPupil = max(smoothstep(0.045, 0.028, dLeftPupil),
                                       smoothstep(0.045, 0.028, dRightPupil));
                    vec3 pupilColor = vec3(0.08, 0.04, 0.02);
                    
                    // Dual Glossy White Sparkle Catchlights
                    float dLeftH1 = length(leftEyeUv - vec2(-0.038, 0.038));
                    float dRightH1 = length(rightEyeUv - vec2(-0.038, 0.038));
                    float sH1 = max(smoothstep(0.035, 0.018, dLeftH1),
                                    smoothstep(0.035, 0.018, dRightH1));
                                    
                    float dLeftH2 = length(leftEyeUv - vec2(0.032, -0.038));
                    float dRightH2 = length(rightEyeUv - vec2(0.032, -0.038));
                    float sH2 = max(smoothstep(0.020, 0.008, dLeftH2),
                                    smoothstep(0.020, 0.008, dRightH2));
                                    
                    // Eyelashes & Eyeliner
                    float dLeftLash = distToSegment(uv, vec2(-0.35, 0.08), vec2(-0.11, 0.13));
                    float dRightLash = distToSegment(uv, vec2(0.11, 0.13), vec2(0.35, 0.08));
                    float sEyelash = max(smoothstep(0.032, 0.010, dLeftLash),
                                         smoothstep(0.032, 0.010, dRightLash));
                    
                    // --- 3. Anime Eyebrows ---
                    float dLeftBrow = distToSegment(uv, vec2(-0.32, 0.18), vec2(-0.14, 0.22));
                    float dRightBrow = distToSegment(uv, vec2(0.14, 0.22), vec2(0.32, 0.18));
                    float sEyebrow = max(smoothstep(0.020, 0.006, dLeftBrow),
                                         smoothstep(0.020, 0.006, dRightBrow));
                    vec3 browColor = vec3(0.32, 0.18, 0.10);
                    
                    // --- 4. Cute Open Chibi Mouth ---
                    vec2 mouthUv = vec2(uv.x, (uv.y - (-0.17)) * 1.3);
                    float dMouthOpen = length(vec2(mouthUv.x, max(0.0, mouthUv.y)));
                    float sMouthOutline = smoothstep(0.060, 0.042, dMouthOpen) * step(-0.035, mouthUv.y);
                    float sMouthInner = smoothstep(0.042, 0.028, dMouthOpen) * step(-0.025, mouthUv.y);
                    
                    float dTongue = length(vec2(mouthUv.x, mouthUv.y - (-0.015)));
                    float sTongue = smoothstep(0.032, 0.015, dTongue) * sMouthInner;
                    
                    vec3 mouthBorderColor = vec3(0.22, 0.08, 0.08);
                    vec3 mouthInnerColor = vec3(0.88, 0.32, 0.38);
                    vec3 tongueColor = vec3(0.98, 0.58, 0.65);
                    
                    // Apply Face Composite Layers
                    baseColor = mix(baseColor, cheekColor, sCheeks);
                    
                    if (sEyeWhite > 0.01) {
                        vec3 eyeCol = vec3(0.98, 0.98, 0.98);
                        eyeCol = mix(eyeCol, irisColor, sIris);
                        eyeCol = mix(eyeCol, pupilColor, sPupil);
                        eyeCol = mix(eyeCol, vec3(1.0), max(sH1, sH2));
                        baseColor = mix(baseColor, eyeCol, sEyeWhite);
                    }
                    
                    baseColor = mix(baseColor, vec3(0.15, 0.10, 0.08), sEyelash);
                    baseColor = mix(baseColor, browColor, sEyebrow);
                    
                    if (sMouthOutline > 0.01) {
                        vec3 mCol = mix(mouthBorderColor, mouthInnerColor, clamp(sMouthInner / max(0.001, sMouthOutline), 0.0, 1.0));
                        mCol = mix(mCol, tongueColor, sTongue);
                        baseColor = mix(baseColor, mCol, sMouthOutline);
                    }
                    }
                }
                vec3 finalColor = baseColor * diffuse;

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

      const atmosphereVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                vNormal = normalize(aPosition);
                vPosition = aPosition;
            }
        `;

      const atmosphereFragmentShaderSource = `
            precision highp float;
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform vec3 uColor;
            uniform float uAlpha;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(uCameraPos - vPosition);
                vec3 lightDir = normalize(uLightDir);
                
                float cosTheta = dot(normal, viewDir);
                float fresnel = 1.0 - abs(cosTheta);
                
                float rim;
                if (cosTheta < 0.0) {
                    // CAMERA IS INSIDE: Beautiful ambient sky looking from inside out
                    rim = mix(0.42, 1.0, fresnel);
                } else {
                    // CAMERA IS OUTSIDE: Standard glowing rim that fades to 0 smoothly at the very edge to prevent sharp outlines
                    rim = pow(fresnel, 3.5) * smoothstep(0.0, 0.20, cosTheta);
                }
                
                // Sunlight influence
                float lightInfluence = dot(normal, lightDir);
                float intensity = smoothstep(-0.4, 0.4, lightInfluence);
                
                // Allow ambient scattering glow even on the shadow/night side
                float finalAlpha = rim * uAlpha * (0.15 + 0.85 * intensity);
                
                gl_FragColor = vec4(uColor, finalAlpha);
            }
        `;

      
      // --- Clouds 3D Shaders ---
      window.cloud3DVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aLocalPos;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uCloudOrbitMatrix;
            uniform float uAnimTime;

            varying vec3 vWorldPos;
            varying vec3 vLocalPos;

            // Procedural sine/cosine noise for organic cloud puff animation
            float puffNoise(vec3 p, float t) {
                return sin(p.x * 0.8 + t * 1.5) * cos(p.y * 1.1 + t * 1.2) * sin(p.z * 0.9 + t * 1.7);
            }

            void main() {
                vLocalPos = aLocalPos;
                
                // Animated swelling & puffing morphing on cloud geometry
                vec3 animatedPos = aPosition;
                vec3 normLocal = length(aLocalPos) > 0.001 ? normalize(aLocalPos) : vec3(0.0, 1.0, 0.0);
                float puff = puffNoise(aPosition * 0.5, uAnimTime) * 0.35;
                animatedPos += normLocal * puff;

                // Apply orbital rotation around planet
                vec4 rotatedPos = uCloudOrbitMatrix * vec4(animatedPos, 1.0);
                
                vWorldPos = rotatedPos.xyz;
                gl_Position = uProjectionMatrix * uModelViewMatrix * rotatedPos;
            }
      `;

      window.cloud3DFragmentShaderSource = `
            precision highp float;
            varying vec3 vWorldPos;
            varying vec3 vLocalPos;

            uniform vec3 uColor;
            uniform float uAlpha;
            uniform float uTime;
            uniform vec3 uLightDir;
            uniform vec3 uCameraPos;
            uniform float uWaterRadius;
            
            float hash(vec3 p) {
                p = fract(p * vec3(443.897, 441.423, 437.195));
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }
            float noise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f*f*(3.0-2.0*f);
                return mix(mix(mix(hash(p+vec3(0,0,0)), hash(p+vec3(1,0,0)), f.x),
                               mix(hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)), f.x), f.y),
                           mix(mix(hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)), f.x),
                               mix(hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)), f.x), f.y), f.z);
            }
            float fbm(vec3 p) {
                float v = 0.0;
                float a = 0.5;
                vec3 shift = vec3(100.0);
                for (int i = 0; i < 3; ++i) {
                    v += a * noise(p);
                    p = p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                if (uWaterRadius > 0.0) {
                    vec3 rayDir = normalize(vWorldPos - uCameraPos);
                    float cloudDist = length(vWorldPos - uCameraPos);
                    float b = dot(uCameraPos, rayDir);
                    float c = dot(uCameraPos, uCameraPos) - uWaterRadius * uWaterRadius;
                    float h = b * b - c;
                    if (h >= 0.0) {
                        float tNear = -b - sqrt(h);
                        if (c > 0.0) {
                            if (tNear > 0.0 && tNear < cloudDist) {
                                discard;
                            }
                        } else {
                            discard;
                        }
                    }
                }
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 normal = normalize(vLocalPos); // For a sphere at origin, localPos is the normal
                
                // Rim fade (so the spheres look soft at the edges instead of hard geometry)
                float rim = max(0.0, dot(normal, viewDir));
                float env = smoothstep(0.0, 0.6, rim); // Fade out near the grazing angles
                
                // Add wind displacement using animated time
                vec3 coord = vWorldPos * 0.8 + vec3(uTime * 0.25, uTime * 0.1, uTime * 0.18);
                
                // Fluffy noise
                float n = fbm(coord);
                float fluffy = smoothstep(0.2, 0.65, n);
                
                float density = clamp(fluffy * 1.6 * env, 0.0, 1.0);
                if (density < 0.02) discard;
                
                // Self-shadowing approximation
                float shadowNoise = fbm(coord + uLightDir * 0.5);
                float shadow = smoothstep(0.2, 0.8, shadowNoise);
                
                // Dual tone lighting
                vec3 baseColor = uColor;
                vec3 shadowColor = mix(uColor * 0.6, vec3(0.55, 0.65, 0.8), 0.6);
                
                // Side light contribution
                float lightDot = dot(normal, uLightDir);
                float lightIntensity = smoothstep(-0.2, 0.8, lightDot);
                
                vec3 finalColor = mix(shadowColor, baseColor, lightIntensity * shadow);
                
                gl_FragColor = vec4(finalColor, density * uAlpha);
            }
`;

      
// === SEEDPLANET MODULE: JS/PLAYER.JS ===

      function getHeldItem() {
        if (typeof isPlacingFloor !== "undefined" && isPlacingFloor) {
          return null; // When in PRE_PLACE preview/placement mode, never hold any item in hand
        }
        if (typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
          return null; // When riding boat/vehicle, hands steer or row
        }
        if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
          return null; // When piloting mech, hands are on cockpit controls
        }
        let item = null;
        if (typeof selectedActionSlotIndex !== "undefined" && selectedActionSlotIndex !== -1 && typeof actionSlotsItems !== "undefined" && actionSlotsItems && actionSlotsItems[selectedActionSlotIndex]) {
          const candidate = actionSlotsItems[selectedActionSlotIndex];
          if (candidate && (candidate.count === undefined || candidate.count > 0)) {
            item = candidate;
          }
        } else if (typeof activeItem !== "undefined" && activeItem && activeItem.name !== "HAND") {
          item = activeItem;
        }

        if (!item) return null;

        const itemName = item.name || item.label || "";

        // PRE_PLACE and NONE category items must NEVER be held in hand
        const isPlaceable = (typeof isPlaceableItem === "function") ? isPlaceableItem(itemName) : (window.isPlaceableItem ? window.isPlaceableItem(itemName) : false);
        if (isPlaceable || itemName.startsWith("ROBOT_")) {
          return null;
        }

        const isNone = (typeof isNoneItem === "function") ? isNoneItem(itemName) : (window.isNoneItem ? window.isNoneItem(itemName) : false);
        if (isNone) {
          return null;
        }

        const isHoldable = (typeof isHoldableItem === "function") ? isHoldableItem(itemName) : (window.isHoldableItem ? window.isHoldableItem(itemName) : false);
        if (isHoldable) {
          return item;
        }

        const def = (typeof getItemDefinition === "function") ? getItemDefinition(itemName) : (window.getItemDefinition ? window.getItemDefinition(itemName) : null);
        if (def) {
          if (def.category === "HOLDABLE") return item;
          return null;
        }

        // Specific whitelist for holdable tools/weapons
        const holdableNames = ["AXE", "PICKAXE", "SHOVEL", "BOW", "WOODEN_ARM_CANNON", "ARM_CANNON", "BRANCH", "branch", "FRIED_BUG", "GLOW_BATTERY"];
        if (holdableNames.includes(itemName)) {
          return item;
        }

        return null;
      }
      window.getHeldItem = getHeldItem;

      function updatePlayerHPUI() {
        const hpContainer = document.getElementById("playerHpVerticalContainer");
        if (!hpContainer) return;
        
        hpContainer.innerHTML = "";
        
        const totalSlots = playerMaxHP;
        const filledSlots = playerHP;
        
        for (let s = 0; s < totalSlots; s++) {
          const slotDiv = document.createElement("div");
          slotDiv.className = "player-hp-slot-minimal";
          if (s < filledSlots) {
            slotDiv.className += " filled";
          }
          hpContainer.appendChild(slotDiv);
        }
      }

      function project3DTo2D(pos3D, viewProj, width, height) {
        const x = pos3D[0], y = pos3D[1], z = pos3D[2];
        const m = viewProj;
        const rx = m[0]*x + m[4]*y + m[8]*z + m[12];
        const ry = m[1]*x + m[5]*y + m[9]*z + m[13];
        const rz = m[2]*x + m[6]*y + m[10]*z + m[14];
        const rw = m[3]*x + m[7]*y + m[11]*z + m[15];
        
        if (rw <= 0) return null; // Behind camera
        
        const ndcX = rx / rw;
        const ndcY = ry / rw;
        const ndcZ = rz / rw;
        
        if (ndcZ < -1 || ndcZ > 1) return null; // Outside depth bounds
        
        const screenX = (ndcX * 0.5 + 0.5) * width;
        const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * height;
        
        return { x: screenX, y: screenY, z: ndcZ };
      }

      let _cachedHpOverlay = null;

      function updateFloatingNpcHpBars(vMat, pMat, eyePos) {
        if (!_cachedHpOverlay) _cachedHpOverlay = document.getElementById("npcHpOverlay");
        const overlay = _cachedHpOverlay;
        if (!overlay) return;
        
        if (!gameStarted || !amphibians || amphibians.length === 0 || !activeTargetNPC) {
          if (overlay._lastHtml !== "") {
            overlay._lastHtml = "";
            overlay.innerHTML = "";
          }
          return;
        }
        
        const c = activeTargetNPC;
        if (c.ragdollEnabled || !c.hp || c.hp <= 0) {
          if (overlay._lastHtml !== "") {
            overlay._lastHtml = "";
            overlay.innerHTML = "";
          }
          return;
        }

        const viewProj = multiplyMatrices(pMat, vMat);
        let htmlContent = "";

        const sinT = Math.sin(c.theta);
        const cosT = Math.cos(c.theta);
        const sinP = Math.sin(c.phi);
        const cosP = Math.cos(c.phi);
        
        const nx = sinT * cosP;
        const ny = cosT;
        const nz = sinT * sinP;
          
          // Offset above the NPC's center so it floats perfectly above their head/body
          const floatOffset = 0.22; 
          const pos3D = [
            (c.r + floatOffset) * nx,
            (c.r + floatOffset) * ny,
            (c.r + floatOffset) * nz
          ];
          
          // Check planet occlusion to prevent showing through the planet geometry
          if (eyePos && typeof checkPlanetOcclusion === "function") {
            const isOccluded = checkPlanetOcclusion(eyePos, [c.r * nx, c.r * ny, c.r * nz], RADIUS);
            if (isOccluded) {
              if (overlay._lastHtml !== "") {
                overlay._lastHtml = "";
                overlay.innerHTML = "";
              }
              return;
            }
          }
          
          const screenPos = project3DTo2D(pos3D, viewProj, canvas.width, canvas.height);
          
          if (screenPos) {
            let slotsHtml = "";
            for (let s = 0; s < c.maxHp; s++) {
              const isFilled = s < c.hp;
              slotsHtml += `<div class="npc-hp-slot${isFilled ? ' filled' : ''}"></div>`;
            }
            
            const rect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
            const cssX = rect.left + (screenPos.x / window.innerWidth) * rect.width;
            const cssY = rect.top + (screenPos.y / window.innerHeight) * rect.height;
            
            htmlContent = `
              <div class="npc-hp-bar" style="transform: translate(${Math.round(cssX)}px, ${Math.round(cssY)}px) translate(-50%, -100%); left: 0; top: 0;">
                ${slotsHtml}
              </div>
            `;
          }
        
        if (overlay._lastHtml !== htmlContent) {
          overlay._lastHtml = htmlContent;
          overlay.innerHTML = htmlContent;
        }
      }

      function damagePlayer(amount = 1, customNotice = null) {
        if (playerHP <= 0 || playerDamageCooldown > 0) return;
        
        playerHP = Math.max(0, playerHP - amount);
        updatePlayerHPUI();
        
        // Show flash effect
        const flash = document.getElementById("damageFlash");
        if (flash) {
          flash.style.display = "block";
          flash.style.opacity = "1";
          let op = 1.0;
          const fadeInterval = setInterval(() => {
            op -= 0.05;
            if (op <= 0) {
              clearInterval(fadeInterval);
              flash.style.display = "none";
            } else {
              flash.style.opacity = op;
            }
          }, 20);
        }
        
        if (typeof playSplashSound === "function") {
          playSplashSound(1.2);
        }
        
        if (playerHP <= 0) {
          triggerUnconscious();
          if (customNotice) {
            showNotice(`💀 ${customNotice}`);
          }
        } else {
          playerDamageCooldown = 1.5; // 1.5 seconds invincibility
          showNotice(customNotice || `⚠️ คุณถูกทำร้าย! HP: ${playerHP}/${playerMaxHP}`);
        }
      }
      window.damagePlayer = damagePlayer;

      function applyPlayerFallDamage(amount = 1, height = 0) {
        if (playerHP <= 0) return;
        const msg = (playerHP - amount <= 0)
          ? `ตกจากที่สูงจนหมดสติ! (-${amount} HP)`
          : `⚠️ ตกจากที่สูง! (-${amount} HP) เหลือ ${Math.max(0, playerHP - amount)}/${playerMaxHP}`;
        damagePlayer(amount, msg);
      }
      window.applyPlayerFallDamage = applyPlayerFallDamage;

      function triggerUnconscious() {
        playerControlsLocked = true;
        setRagdoll(true);
        
        // ปล่อย Meganeura ทุกตัวที่เกาะตัวละครอยู่ทันทีเมื่อหมดสติ
        if (typeof amphibians !== "undefined" && Array.isArray(amphibians)) {
          for (let i = 0; i < amphibians.length; i++) {
            if (amphibians[i] && amphibians[i].type === "meganeura") {
              amphibians[i].attachedToPlayer = false;
            }
          }
        }

        // Wait 3 seconds in ragdoll mode before respawning (No black screen fade)
        setTimeout(() => {
          let spawned = false;
          if (typeof window.getHouseSpawnLocation === "function") {
            const houseSpawn = window.getHouseSpawnLocation();
            if (houseSpawn && typeof houseSpawn.theta === "number") {
              charTheta = houseSpawn.theta;
              charPhi = houseSpawn.phi;
              spawned = true;
            }
          }

          if (!spawned) {
            let foundSpot = false;
            let newTheta = charTheta;
            let newPhi = charPhi;
            for (let attempts = 0; attempts < 30; attempts++) {
              const distOffset = 0.15 + Math.random() * 0.20;
              const angleDir = Math.random() * Math.PI * 2;
              
              const testTheta = Math.max(0.1, Math.min(Math.PI - 0.1, charTheta + Math.cos(angleDir) * distOffset));
              let testPhi = charPhi + Math.sin(angleDir) * distOffset;
              if (testPhi < 0) testPhi += Math.PI * 2;
              if (testPhi > Math.PI * 2) testPhi -= Math.PI * 2;
              
              const height = getVisualHeightOnSphere(testTheta, testPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              const terrainRad = RADIUS + height * HEIGHT_SCALE;
              const waterRadius = RADIUS + waterLevel * 0.15;
              if (!waterEnabled || terrainRad > waterRadius) {
                newTheta = testTheta;
                newPhi = testPhi;
                foundSpot = true;
                break;
              }
            }
            if (!foundSpot) {
              const distOffset = 0.15 + Math.random() * 0.20;
              const angleDir = Math.random() * Math.PI * 2;
              newTheta = Math.max(0.1, Math.min(Math.PI - 0.1, charTheta + Math.cos(angleDir) * distOffset));
              newPhi = charPhi + Math.sin(angleDir) * distOffset;
              if (newPhi < 0) newPhi += Math.PI * 2;
              if (newPhi > Math.PI * 2) newPhi -= Math.PI * 2;
            }
            charTheta = newTheta;
            charPhi = newPhi;
          }
          
          playerHP = playerMaxHP;
          updatePlayerHPUI();
          if (typeof window.warpPlayerToCoords === "function") {
            window.warpPlayerToCoords(charTheta, charPhi);
          } else {
            playerDamageCooldown = 2.0;
            playerControlsLocked = false;
            setRagdoll(false);
            playerCenterRadius = null;
            playerVerticalVel = 0.0;
            saveSettingsToLocalStorage();
          }
        }, 3000); // 3 seconds ragdoll
      }

      // ระบบวาร์ปพิกัดตัวละคร (ใช้ระบบเดียวกับตอนสุ่มตื่นจากตอนที่หมดสติ)
      window.warpPlayerToCoords = function(targetTheta, targetPhi) {
        charTheta = targetTheta;
        charPhi = targetPhi;
        playerDamageCooldown = 2.0;
        playerControlsLocked = false;
        if (typeof setRagdoll === "function") {
          setRagdoll(false);
        }
        playerCenterRadius = null;
        playerVerticalVel = 0.0;
        isPlayerGrounded = true;
        if (typeof pendingCollectibleRefresh !== "undefined") {
          pendingCollectibleRefresh = true;
        }
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      };
      let playerScale = 0.1;
      let playerCenterRadius = null;
      let playerVerticalVel = 0.0;
      let isPlayerGrounded = true;
      let ragdollInitialized = false;
      let ragdollDiedOnSurface = false;
      let ragdollPos = [0, 0, 0];
      let ragdollVel = [0, 0, 0];
      let ragdollAxis = [1, 0, 0];
      let ragdollAngle = 0;
      let ragdollAngularSpeed = 0.1;
      let ragdollBaseMatrix = null;
      let ragdollLimbs = {
        aL: 0,
        aR: 0,
        eL: 0.1,
        eR: 0.1,
        lL: 0,
        lR: 0,
        kL: 0.1,
        kR: 0.1,
        vaL: 0,
        vaR: 0,
        veL: 0,
        veR: 0,
        vlL: 0,
        vlR: 0,
        vkL: 0,
        vkR: 0,
      };

      var RADIUS = 8.0;
      var HEIGHT_SCALE = 0.6;
      var globalSeed = 0;

      // COLLISION_LAYERS is already declared globally in collision.js

      let waterEnabled = true;
      let caveWaterEnabled = true;
      let waterLevel = 0.0;
      let waterOpacity = 0.4;
      let waveStrength = 0.02;
      let waterColor = [0.0, 0.4, 0.667];
      let waterTime = 0;
      let waterVerticesCache = null;

      let atmosphereEnabled = true;
      let atmosphereAlpha = 0.6;
      let atmosphereScale = 2.5;
      let atmosphereColor = [0.3, 0.46, 1.0]; // hex #4d94ff
      let atmosphereVertexBuffer = null;
      let atmosphereIndexBuffer = null;
      let atmosphereIndicesLength = 0;

      let skyEnabled = true;
      let skyGasIntensity = 0.75;
      let skyVertexBuffer = null;
      let skyIndexBuffer = null;
      let skyIndicesLength = 0;

      let cloudsEnabled = true;
      let cloudsAlpha = 0.55;
      let cloudsColor = [1.0, 1.0, 1.0]; // hex #ffffff
      let cloudsHeight = 12.0;
      let cloudsThickness = 0.93;
      let cloudsSpeed = 0.2;
      let cloudsShape = 1.0;
      let cloudTime = 0;
      let cloudShapeTime = 0;

      // God Rays (Disabled / Safe Fallback Globals)
      let godRaysEnabled = false;
      let godRaysAlpha = 0.0;
      let godRaysColor = [1.0, 0.92, 0.75];
      let godRaysCount = 0;
      let godRaysVertexBuffer = null;
      let godRaysIndexBuffer = null;
      let godRaysIndicesLength = 0;
      const godRaysList = [];

      let natureSway = 1.0;
      let waterPlantSway = 1.0;
      let showHitboxes = false;
      let frustumCullingEnabled = true;
      let maxColliderDistance = 20.0;
      let actionReachDistance = 0.15; // Auto-scales with playerScale * 1.5
      let showActionReach = true;
      let actionReachMode = 3; // 1 = Line, 2 = Circle, 3 = Capsule (Default is 3: Capsule)
      let woodFloorHeight = 0.05;
      if (typeof window !== "undefined") {
        window.woodFloorHeight = woodFloorHeight;
      }
      let campfireSize = 0.25;
      let voxelHoleRadiusMultiplier = 2.0;

      // --- Render Distance State (Split: 1. Terrain: 15.0, 2. Objects: 5.0) ---
      let renderDistEnabled = true;
      let terrainRenderDistValue = 15.0;
      let objectRenderDistValue = 5.0;
      let renderDistValue = 15.0; // for backwards compatibility

      // Expose to window for global access and devgame.js integration
      if (typeof window !== "undefined") {
        window.renderDistEnabled = renderDistEnabled;
        window.terrainRenderDistValue = terrainRenderDistValue;
        window.objectRenderDistValue = objectRenderDistValue;
        window.renderDistValue = renderDistValue;
      }

      // --- Throttled Animation FPS Limits & State ---
      let charAnimFps = 30;
      let lastCharAnimTime = 0;

      let waterAnimFps = 30;
      let lastWaterAnimTime = 0;
      let waterAnimTime = 0;

      let leafAnimFps = 30;
      let lastLeafAnimTime = 0;
      let leafAnimTime = 0;

      let cloudAnimFps = 30;
      let lastCloudAnimTime = 0;
      let cloudAnimTime = 0;
      let cloudShapeAnimTime = 0;


      // ============================================
      // ฟังก์ชันระบบสร้างเชิงลึกของตัวละครสามมิติดินปั้นขาวเงา
      // ============================================
      function rotatePointX(pivot, point, theta) {
        if (theta === 0) return point;
        const dy = point[1] - pivot[1];
        const dz = point[2] - pivot[2];
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const ry = dy * cosT - dz * sinT;
        const rz = dy * sinT + dz * cosT;
        return [point[0], pivot[1] + ry, pivot[2] + rz];
      }

      function rotatePointY(pivot, point, theta) {
        if (theta === 0) return point;
        const dx = point[0] - pivot[0];
        const dz = point[2] - pivot[2];
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rx = dx * cosT + dz * sinT;
        const rz = -dx * sinT + dz * cosT;
        return [pivot[0] + rx, point[1], pivot[2] + rz];
      }

      function rotatePointZ(pivot, point, theta) {
        if (theta === 0) return point;
        const dx = point[0] - pivot[0];
        const dy = point[1] - pivot[1];
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rx = dx * cosT - dy * sinT;
        const ry = dx * sinT + dy * cosT;
        return [pivot[0] + rx, pivot[1] + ry, point[2]];
      }

      const _capsuleIndexCache = {};

      function getCapsuleIndices(radialSegments, axialSegments) {
        const key = radialSegments + "_" + axialSegments;
        if (_capsuleIndexCache[key]) return _capsuleIndexCache[key];
        const indices = [];
        for (let i = 0; i < axialSegments; i++) {
          for (let j = 0; j < radialSegments; j++) {
            const row1 = i * (radialSegments + 1);
            const row2 = (i + 1) * (radialSegments + 1);

            const a = row1 + j;
            const b = row1 + j + 1;
            const c = row2 + j;
            const d = row2 + j + 1;

            indices.push(a, b, c);
            indices.push(c, b, d);
          }
        }
        _capsuleIndexCache[key] = indices;
        return indices;
      }

      const _capsuleBufferPool = [];
      let _capsulePoolIndex = 0;
      function resetCapsuleBufferPool() {
        _capsulePoolIndex = 0;
      }
      function getPooledCapsuleBuffers(totalVerts) {
        const reqLen = totalVerts * 3;
        if (_capsulePoolIndex >= _capsuleBufferPool.length) {
          _capsuleBufferPool.push({
            vertices: new Float32Array(reqLen),
            normals: new Float32Array(reqLen),
          });
        }
        const item = _capsuleBufferPool[_capsulePoolIndex++];
        if (item.vertices.length < reqLen) {
          item.vertices = new Float32Array(reqLen);
          item.normals = new Float32Array(reqLen);
        }
        return item;
      }

      function generateCapsule(
        p1,
        p2,
        r,
        radialSegments = 16,
        axialSegments = 24,
      ) {
        const totalSlices = axialSegments;
        const totalVerts = (totalSlices + 1) * (radialSegments + 1);
        const pooled = getPooledCapsuleBuffers(totalVerts);
        const vertices = pooled.vertices.subarray(0, totalVerts * 3);
        const normals = pooled.normals.subarray(0, totalVerts * 3);

        const dX = p2[0] - p1[0];
        const dY = p2[1] - p1[1];
        const dZ = p2[2] - p1[2];
        const L = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

        let zAxis = [0, 1, 0];
        if (L > 0.00001) {
          zAxis = [dX / L, dY / L, dZ / L];
        }

        let up = [0, 1, 0];
        if (Math.abs(zAxis[1]) > 0.99) {
          up = [1, 0, 0];
        }

        let xAxis = [
          up[1] * zAxis[2] - up[2] * zAxis[1],
          up[2] * zAxis[0] - up[0] * zAxis[2],
          up[0] * zAxis[1] - up[1] * zAxis[0],
        ];
        let lenX = Math.sqrt(
          xAxis[0] * xAxis[0] + xAxis[1] * xAxis[1] + xAxis[2] * xAxis[2],
        );
        xAxis = [xAxis[0] / lenX, xAxis[1] / lenX, xAxis[2] / lenX];

        let yAxis = [
          zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
          zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
          zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
        ];

        let vIdx = 0;
        for (let i = 0; i <= totalSlices; i++) {
          const angle = -Math.PI / 2 + Math.PI * (i / totalSlices);
          const sinA = Math.sin(angle);
          const cosA = Math.cos(angle);

          let zPos = 0;
          let ringRadius = r * cosA;

          if (sinA < 0) {
            zPos = sinA * r;
          } else {
            zPos = L + sinA * r;
          }

          for (let j = 0; j <= radialSegments; j++) {
            const phi = (j / radialSegments) * Math.PI * 2;
            const cosP = Math.cos(phi);
            const sinP = Math.sin(phi);

            const ringX = xAxis[0] * cosP + yAxis[0] * sinP;
            const ringY = xAxis[1] * cosP + yAxis[1] * sinP;
            const ringZ = xAxis[2] * cosP + yAxis[2] * sinP;

            vertices[vIdx] = p1[0] + zAxis[0] * zPos + ringX * ringRadius;
            vertices[vIdx + 1] = p1[1] + zAxis[1] * zPos + ringY * ringRadius;
            vertices[vIdx + 2] = p1[2] + zAxis[2] * zPos + ringZ * ringRadius;

            normals[vIdx] = ringX * cosA + zAxis[0] * sinA;
            normals[vIdx + 1] = ringY * cosA + zAxis[1] * sinA;
            normals[vIdx + 2] = ringZ * cosA + zAxis[2] * sinA;

            vIdx += 3;
          }
        }

        const indices = getCapsuleIndices(radialSegments, axialSegments);
        return { vertices, normals, indices };
      }

      const _mergeBufferPool = [];
      let _mergePoolIndex = 0;
      function resetMergeBufferPool() {
        _mergePoolIndex = 0;
      }
      function getPooledMergeBuffers(totalVerts, totalIndices) {
        const vLen = totalVerts * 3;
        const tLen = totalVerts * 2;
        const iLen = totalIndices;
        if (_mergePoolIndex >= _mergeBufferPool.length) {
          _mergeBufferPool.push({
            vertices: new Float32Array(Math.max(vLen, 1024)),
            normals: new Float32Array(Math.max(vLen, 1024)),
            colors: new Float32Array(Math.max(vLen, 1024)),
            texcoords: new Float32Array(Math.max(tLen, 1024)),
            indices16: new Uint16Array(Math.max(iLen, 1024)),
            indices32: new Uint32Array(Math.max(iLen, 1024)),
          });
        }
        const item = _mergeBufferPool[_mergePoolIndex++];
        if (item.vertices.length < vLen) {
          item.vertices = new Float32Array(vLen);
          item.normals = new Float32Array(vLen);
          item.colors = new Float32Array(vLen);
        }
        if (item.texcoords.length < tLen) {
          item.texcoords = new Float32Array(tLen);
        }
        if (item.indices16.length < iLen) {
          item.indices16 = new Uint16Array(iLen);
          item.indices32 = new Uint32Array(iLen);
        }
        return item;
      }

      function mergeMeshes(meshes) {
        let totalVerts = 0;
        let totalIndices = 0;
        for (let k = 0; k < meshes.length; k++) {
          const m = meshes[k];
          if (!m || !m.vertices) continue;
          totalVerts += (m.vertices.length / 3) | 0;
          if (m.indices) totalIndices += m.indices.length;
        }

        const pool = getPooledMergeBuffers(totalVerts, totalIndices);
        const combinedVertices = pool.vertices.subarray(0, totalVerts * 3);
        const combinedNormals = pool.normals.subarray(0, totalVerts * 3);
        const combinedColors = pool.colors.subarray(0, totalVerts * 3);
        const combinedTexCoords = pool.texcoords.subarray(0, totalVerts * 2);
        const combinedIndices = totalVerts > 65535 ? pool.indices32.subarray(0, totalIndices) : pool.indices16.subarray(0, totalIndices);

        let vertexOffset = 0;
        let vOffset = 0;
        let cOffset = 0;
        let tOffset = 0;
        let iOffset = 0;

        for (let k = 0; k < meshes.length; k++) {
          const mesh = meshes[k];
          if (!mesh || !mesh.vertices) continue;
          const mv = mesh.vertices;
          const mn = mesh.normals;
          const mc = mesh.colors;
          const mt = mesh.texcoords;
          const mi = mesh.indices;
          const vertCount = (mv.length / 3) | 0;

          if (mv instanceof Float32Array) {
            combinedVertices.set(mv, vOffset);
          } else {
            for (let i = 0; i < mv.length; i++) combinedVertices[vOffset + i] = mv[i];
          }

          if (mn instanceof Float32Array) {
            combinedNormals.set(mn, vOffset);
          } else {
            for (let i = 0; i < mn.length; i++) combinedNormals[vOffset + i] = mn[i];
          }

          if (mt && mt.length >= vertCount * 2) {
            if (mt instanceof Float32Array) {
              combinedTexCoords.set(mt.subarray(0, vertCount * 2), tOffset);
            } else {
              for (let i = 0; i < vertCount * 2; i++) combinedTexCoords[tOffset + i] = mt[i];
            }
          }

          if (mc && mc.length >= vertCount * 3) {
            if (mc instanceof Float32Array) {
              combinedColors.set(mc.subarray(0, vertCount * 3), cOffset);
            } else {
              for (let i = 0; i < vertCount * 3; i++) combinedColors[cOffset + i] = mc[i];
            }
          } else {
            for (let i = 0; i < vertCount; i++) {
              const base = cOffset + i * 3;
              combinedColors[base] = 0.96;
              combinedColors[base + 1] = 0.96;
              combinedColors[base + 2] = 0.96;
            }
          }

          if (mi) {
            for (let i = 0; i < mi.length; i++) {
              combinedIndices[iOffset++] = mi[i] + vertexOffset;
            }
          }

          vOffset += mv.length;
          cOffset += vertCount * 3;
          tOffset += vertCount * 2;
          vertexOffset += vertCount;
        }

        return {
          vertices: combinedVertices,
          normals: combinedNormals,
          colors: combinedColors,
          texcoords: combinedTexCoords,
          indices: combinedIndices,
        };
      }

      function buildHandAndFingers(pElbow, pHand, isLeft, scaleFactor) {
        const dX = pHand[0] - pElbow[0];
        const dY = pHand[1] - pElbow[1];
        const dZ = pHand[2] - pElbow[2];
        let len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
        let dArm = len > 1e-4 ? [dX / len, dY / len, dZ / len] : [0, -1, 0];

        const sideVec = isLeft ? [-1, 0, 0] : [1, 0, 0];
        let rArm = [
          dArm[1] * sideVec[2] - dArm[2] * sideVec[1],
          dArm[2] * sideVec[0] - dArm[0] * sideVec[2],
          dArm[0] * sideVec[1] - dArm[1] * sideVec[0],
        ];
        let rLen = Math.sqrt(rArm[0] * rArm[0] + rArm[1] * rArm[1] + rArm[2] * rArm[2]);
        if (rLen < 1e-3) {
          rArm = isLeft ? [0, 0, -1] : [0, 0, 1];
        } else {
          rArm = [rArm[0] / rLen, rArm[1] / rLen, rArm[2] / rLen];
        }

        const sf = scaleFactor;
        const palmTip = [
          pHand[0] + dArm[0] * 0.02 * sf,
          pHand[1] + dArm[1] * 0.02 * sf,
          pHand[2] + dArm[2] * 0.02 * sf,
        ];

        const palm = generateCapsule(pHand, palmTip, 0.022 * sf, 8, 8);
        const parts = [palm];

        // 5 Chibi Fingers (Thumb, Index, Middle, Ring, Pinky)
        const fingerOffsets = isLeft ? [-0.012, -0.005, 0.002, 0.008, 0.014] : [0.012, 0.005, -0.002, -0.008, -0.014];
        const fingerLengths = [0.015, 0.019, 0.021, 0.018, 0.014];
        const fingerRadii = [0.0075, 0.007, 0.007, 0.0065, 0.0055];

        for (let f = 0; f < 5; f++) {
          const off = fingerOffsets[f] * sf;
          const flen = fingerLengths[f] * sf;
          const frad = fingerRadii[f] * sf;

          let fBase, fTip;
          if (f === 0) { // Thumb
            fBase = [
              pHand[0] + dArm[0] * 0.008 * sf + rArm[0] * off,
              pHand[1] + dArm[1] * 0.008 * sf + rArm[1] * off,
              pHand[2] + dArm[2] * 0.008 * sf + rArm[2] * off,
            ];
            fTip = [
              fBase[0] + dArm[0] * flen + rArm[0] * (isLeft ? -0.008 : 0.008) * sf,
              fBase[1] + dArm[1] * flen + rArm[1] * (isLeft ? -0.008 : 0.008) * sf,
              fBase[2] + dArm[2] * flen + rArm[2] * (isLeft ? -0.008 : 0.008) * sf,
            ];
          } else {
            fBase = [
              palmTip[0] + rArm[0] * off,
              palmTip[1] + rArm[1] * off,
              palmTip[2] + rArm[2] * off,
            ];
            fTip = [
              fBase[0] + dArm[0] * flen,
              fBase[1] + dArm[1] * flen,
              fBase[2] + dArm[2] * flen,
            ];
          }
          parts.push(generateCapsule(fBase, fTip, frad, 6, 6));
        }
        return parts;
      }

      function buildFootAnkleToes(pKnee, pFoot, isLeft, scaleFactor) {
        const sf = scaleFactor;
        // 1. Ankle Joint
        const ankle = generateCapsule(pFoot, [pFoot[0], pFoot[1] - 0.008 * sf, pFoot[2]], 0.032 * sf, 8, 8);

        // 2. Foot Body
        const footTip = [
          pFoot[0],
          pFoot[1] - 0.012 * sf,
          pFoot[2] + 0.040 * sf,
        ];
        const footBody = generateCapsule([pFoot[0], pFoot[1] - 0.008 * sf, pFoot[2]], footTip, 0.026 * sf, 8, 8);

        const parts = [ankle, footBody];

        // 3. 5 Chibi Toes
        const toeXOffsets = isLeft ? [0.012, 0.006, 0.0, -0.006, -0.011] : [-0.012, -0.006, 0.0, 0.006, 0.011];
        const toeLengths = [0.014, 0.013, 0.012, 0.010, 0.008];
        const toeRadii = [0.008, 0.007, 0.007, 0.006, 0.005];

        for (let t = 0; t < 5; t++) {
          const tx = toeXOffsets[t] * sf;
          const tlen = toeLengths[t] * sf;
          const trad = toeRadii[t] * sf;

          const tBase = [footTip[0] + tx, footTip[1], footTip[2]];
          const tTip = [tBase[0], tBase[1] - 0.002 * sf, tBase[2] + tlen];
          parts.push(generateCapsule(tBase, tTip, trad, 6, 6));
        }
        return parts;
      }

      function initRagdoll(px, py, pz, rx_scaled, ry_scaled, rz_scaled, phase) {
        ragdollPos = [px, py, pz];

        const r_len = Math.sqrt(
          rx_scaled[0] ** 2 + rx_scaled[1] ** 2 + rx_scaled[2] ** 2,
        ) || 1.0;
        const ry_len = Math.sqrt(
          ry_scaled[0] ** 2 + ry_scaled[1] ** 2 + ry_scaled[2] ** 2,
        ) || 1.0;
        const rz_len = Math.sqrt(
          rz_scaled[0] ** 2 + rz_scaled[1] ** 2 + rz_scaled[2] ** 2,
        ) || 1.0;

        // Check if underwater to avoid huge pushes
        const dist = Math.sqrt(px * px + py * py + pz * pz);
        let inWater = false;
        if (waterEnabled && dist > 0.001) {
          const wRadius = typeof getWaterRadiusAt === "function"
            ? getWaterRadiusAt(px, py, pz)
            : RADIUS + waterLevel * 0.15;
          inWater = dist < wRadius + 0.05;
        }

        // Zero push/launch velocity to collapse in-place, same as NPC
        let push = 0.0;
        let sidePush = 0.0;

        ragdollVel = [0.0, 0.0, 0.0];

        const rx = [
          rx_scaled[0] / r_len,
          rx_scaled[1] / r_len,
          rx_scaled[2] / r_len,
        ];
        const ry = [
          ry_scaled[0] / ry_len,
          ry_scaled[1] / ry_len,
          ry_scaled[2] / ry_len,
        ];
        const rz = [
          rz_scaled[0] / rz_len,
          rz_scaled[1] / rz_len,
          rz_scaled[2] / rz_len,
        ];

        ragdollAxis = [rx[0], rx[1], rx[2]];
        ragdollAngle = 0;
        // Gentle tip-over speed to make character slide naturally onto shoulders/floor
        ragdollAngularSpeed = inWater ? 0.02 : 0.03;

        ragdollLimbs = {
          aL: Math.sin(phase) * 0.8,
          aR: Math.sin(phase + Math.PI) * 0.8,
          eL: 0.1,
          eR: 0.1,
          lL: Math.sin(phase + Math.PI) * 0.6,
          lR: Math.sin(phase) * 0.6,
          kL: 0.1,
          kR: 0.1,
          vaL: 0,
          vaR: 0,
          veL: 0,
          veR: 0,
          vlL: 0,
          vlR: 0,
          vkL: 0,
          vkR: 0,
        };

        ragdollBaseMatrix = [
          rx[0],
          rx[1],
          rx[2],
          0,
          ry[0],
          ry[1],
          ry[2],
          0,
          rz[0],
          rz[1],
          rz[2],
          0,
          0,
          0,
          0,
          1,
        ];

        // Check if player died on surface or underwater
        const height = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const feetRadiusBefore = RADIUS + height * HEIGHT_SCALE;
        const terrainRadius = feetRadiusBefore;
        
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);
        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;
        const waterRadius = RADIUS + waterLevel * 0.15;

        let wRadiusLocal = typeof getWaterRadiusAt === "function"
          ? getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore)
          : waterRadius;
        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, dist)
          : { ground: RADIUS + height * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

        if (caveData.insideTunnel && wRadiusLocal === 0) {
            wRadiusLocal = waterRadius;
        }

        if (typeof getWaterRadiusAt !== "function") {
          const latCharForSwim = Math.round((charTheta / Math.PI) * Math.min(currentGridSize, 200));
          let phiCharForSwim = charPhi;
          if (phiCharForSwim < 0) phiCharForSwim += Math.PI * 2;
          const longCharForSwim = Math.round((phiCharForSwim / (Math.PI * 2)) * Math.min(currentGridSize, 200));
          const gridIdxCharSwim = latCharForSwim * (Math.min(currentGridSize, 200) + 1) + longCharForSwim;
          if (typeof waterMask !== 'undefined' && waterMask && waterMask[gridIdxCharSwim] === 0) {
             if (!caveData.insideTunnel) {
                 wRadiusLocal = 0;
             }
          }
        }

        let swimFactor = 0.0;
        if (false) { // Disabled: allow water in caves
          swimFactor = 0.0;
        } else if (waterEnabled && terrainRadius < wRadiusLocal) {
          const wDepth = wRadiusLocal - terrainRadius;
          const swimThreshold = 0.48 * playerScale;
          if (wDepth > swimThreshold) {
            swimFactor = Math.min(
              1.0,
              (wDepth - swimThreshold) / (0.15 * playerScale),
            );
          }
        }
        const initialDepth = waterRadius - dist;
        ragdollDiedOnSurface =
          !waterEnabled ||
          swimFactor <= 0.0 ||
          playerDiveDepth < 0.03 * playerScale ||
          initialDepth < 0.04 * playerScale;

        ragdollInitialized = true;
      }

      function updateRagdoll(dt) {
        if (!ragdollInitialized) return;
        const dtScale = dt / 0.016666;

        let immersion = 0.0;
        let depth = -1.0;

        const r = Math.sqrt(
          ragdollPos[0] ** 2 + ragdollPos[1] ** 2 + ragdollPos[2] ** 2,
        );
        if (r > 0.001) {
          const nx = ragdollPos[0] / r;
          const ny = ragdollPos[1] / r;
          const nz = ragdollPos[2] / r;

          const caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(nx, ny, nz, r)
            : { ground: RADIUS + (typeof getHeightOnSphere === "function" ? getVisualHeightOnSphere(Math.acos(Math.max(-1.0, Math.min(1.0, ny))), Math.atan2(nz, nx), (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) : 0) * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };

          // Use Physics engine
          Physics.applyGravity(ragdollVel, nx, ny, nz, dtScale);
          Physics.applyFriction(ragdollVel, 0.98, dtScale);
          ragdollAngularSpeed *= Math.pow(0.98, dtScale);

          let wRadius = typeof getWaterRadiusAt === "function"
            ? getWaterRadiusAt(ragdollPos[0], ragdollPos[1], ragdollPos[2])
            : RADIUS + waterLevel * 0.15;
            
          if (caveData.insideTunnel && wRadius === 0) {
              wRadius = RADIUS + waterLevel * 0.15;
          }
          const hRange = 0.05; // 5cm floating band
          if (waterEnabled && wRadius > 0) {
            immersion = Math.max(
              0.0,
              Math.min(1.0, (wRadius + hRange - r) / (2.0 * hRange)),
            );
            depth = wRadius - r;
            if (depth < 0.04) {
              ragdollDiedOnSurface = true;
            }
          } else {
            ragdollDiedOnSurface = true;
          }

          const isNearSurface = ragdollDiedOnSurface;
          // Smoothly interpolate friction based on immersion
          // Sinking underwater should have a lot more resistance/drag than floating at surface
          const waterFriction = isNearSurface ? 0.85 : 0.78;
          const friction = 0.98 * (1.0 - immersion) + waterFriction * immersion;
          Physics.applyFriction(ragdollVel, friction, dtScale);
          ragdollAngularSpeed *= Math.pow(
            0.98 * (1.0 - immersion) +
            (isNearSurface ? 0.95 : 0.85) * immersion, dtScale);

          if (immersion > 0) {
            let buoyancyFactor = 0.0;
            if (depth > 0) {
              if (ragdollDiedOnSurface) {
                // Near the surface: float!
                const targetSubmersion = 0.5; // Half submerged
                buoyancyFactor =
                  immersion * (1.0 + (immersion - targetSubmersion) * 3.0);
                if (buoyancyFactor < 0.1) buoyancyFactor = 0.1;
              } else {
                // Deep underwater: sink slowly! (buoyancy close to gravity, e.g. 0.75 so it sinks very slowly)
                buoyancyFactor = 0.75 * immersion;
              }
            }
            Physics.applyBuoyancyForce(ragdollVel, nx, ny, nz, buoyancyFactor, dtScale);

            // Gentle underwater drift and swaying to simulate fluid resistance/currents
            const driftPhase = Date.now() * 0.001 * 2.0;
            const driftAmp = 0.0004 * immersion;
            let tx = -ny;
            let ty = nx;
            let tz = 0;
            const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tlen > 0.001) {
              tx /= tlen;
              ty /= tlen;
              ragdollVel[0] += tx * Math.sin(driftPhase) * driftAmp;
              ragdollVel[1] += ty * Math.sin(driftPhase) * driftAmp;
              ragdollVel[2] += tz * Math.sin(driftPhase) * driftAmp;
            }
            ragdollAngularSpeed +=
              Math.sin(driftPhase * 1.5) * 0.001 * immersion;

            // Apply vertical damping to completely kill oscillations / jitter for floating bodies at surface
            if (ragdollDiedOnSurface) {
              const v_radial =
                ragdollVel[0] * nx + ragdollVel[1] * ny + ragdollVel[2] * nz;
              const v_tx = ragdollVel[0] - nx * v_radial;
              const v_ty = ragdollVel[1] - ny * v_radial;
              const v_tz = ragdollVel[2] - nz * v_radial;

              const dampFactor = 0.65;
              const new_v_radial = v_radial * dampFactor;
              ragdollVel[0] = v_tx + nx * new_v_radial;
              ragdollVel[1] = v_ty + ny * new_v_radial;
              ragdollVel[2] = v_tz + nz * new_v_radial;
            }
          }
        }

        ragdollPos[0] += ragdollVel[0] * dtScale;
        ragdollPos[1] += ragdollVel[1] * dtScale;
        ragdollPos[2] += ragdollVel[2] * dtScale;

        ragdollAngle += ragdollAngularSpeed * dtScale;
        if (Math.abs(ragdollAngle) > Math.PI * 0.5) {
          ragdollAngle = Math.PI * 0.5 * Math.sign(ragdollAngle);
          ragdollAngularSpeed *= 0.5;
        }

        const distToCenter = Math.sqrt(
          ragdollPos[0] ** 2 + ragdollPos[1] ** 2 + ragdollPos[2] ** 2,
        );
        if (distToCenter > 0.001) {
          const ux = ragdollPos[0] / distToCenter;
          const uy = ragdollPos[1] / distToCenter;
          const uz = ragdollPos[2] / distToCenter;

          const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
          const phi = Math.atan2(uz, ux);
          
          const surfaceRadius = RADIUS + getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          const caveData = typeof getTerrainSurfaceAndCeiling === "function"
            ? getTerrainSurfaceAndCeiling(ux, uy, uz, distToCenter)
            : { ground: surfaceRadius, insideTunnel: false, ceiling: Infinity };

          // Dynamic collision radius based on rotation
          // When standing (angle ~ 0), radius is 0.46 to keep legs above ground
          // When lying flat (angle ~ PI/2), radius is 0.15 so body touches ground
          const angleFactor = Math.abs(Math.cos(ragdollAngle));
          const colRadius = playerScale * (0.15 + 0.43 * angleFactor);
          
          let target = distToCenter;
          let hitSolid = false;

          if (caveData.insideTunnel) {
            if (distToCenter < caveData.ground + colRadius) {
              target = caveData.ground + colRadius;
              hitSolid = true;
              const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
              if (v_radial < 0) {
                  ragdollVel[0] -= ux * v_radial;
                  ragdollVel[1] -= uy * v_radial;
                  ragdollVel[2] -= uz * v_radial;
              }
            } else if (caveData.ceiling !== Infinity && distToCenter > caveData.ceiling - colRadius) {
              target = caveData.ceiling - colRadius;
              hitSolid = true;
              const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
              if (v_radial > 0) {
                 ragdollVel[0] -= ux * v_radial;
                 ragdollVel[1] -= uy * v_radial;
                 ragdollVel[2] -= uz * v_radial;
              }
            }
          } else {
            if (distToCenter < surfaceRadius + colRadius) {
              target = surfaceRadius + colRadius;
              hitSolid = true;
              const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
              if (v_radial < 0) {
                  ragdollVel[0] -= ux * v_radial;
                  ragdollVel[1] -= uy * v_radial;
                  ragdollVel[2] -= uz * v_radial;
              }
            }
          }

          const coreCollectible = collectibles.find(c => c.type === "planet_core");
          const coreRadius = coreCollectible ? coreCollectible.radius : 2.0;
          if (distToCenter < coreRadius + colRadius) {
            target = coreRadius + colRadius;
            hitSolid = true;
            const v_radial = ragdollVel[0] * ux + ragdollVel[1] * uy + ragdollVel[2] * uz;
            if (v_radial < 0) {
              ragdollVel[0] -= ux * v_radial;
              ragdollVel[1] -= uy * v_radial;
              ragdollVel[2] -= uz * v_radial;
            }
          }

          if (hitSolid) {
            ragdollPos[0] = ux * target;
            ragdollPos[1] = uy * target;
            ragdollPos[2] = uz * target;

            // Ground friction
            Physics.applyFriction(ragdollVel, 0.7, dtScale);
            ragdollAngularSpeed *= Math.pow(0.7, dtScale);

            // compute surface normal
            const getT = (t, p) => {
              const r =
                RADIUS + getVisualHeightOnSphere(t, p, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
              return [
                r * Math.sin(t) * Math.cos(p),
                r * Math.cos(t),
                r * Math.sin(t) * Math.sin(p),
              ];
            };
            const p0 = getT(theta, phi);
            const p1 = getT(theta, phi + 0.02);
            const p2 = getT(theta - 0.02, phi);
            const v1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const v2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
            let snX = v1[1] * v2[2] - v1[2] * v2[1];
            let snY = v1[2] * v2[0] - v1[0] * v2[2];
            let snZ = v1[0] * v2[1] - v1[1] * v2[0];
            const snLen = Math.sqrt(snX * snX + snY * snY + snZ * snZ);
            if (snLen > 0.0001) {
              snX /= snLen;
              snY /= snLen;
              snZ /= snLen;
              if (snX * ux + snY * uy + snZ * uz < 0) {
                snX = -snX;
                snY = -snY;
                snZ = -snZ;
            }
          } else {
              snX = ux;
              snY = uy;
              snZ = uz;
            }

            const dot =
              ragdollVel[0] * snX + ragdollVel[1] * snY + ragdollVel[2] * snZ;
            if (dot < 0) {
              // Sinking bodies have zero bounciness on landing and settle gracefully
              const bounciness = !ragdollDiedOnSurface ? 0.0 : 0.1;
              const friction = !ragdollDiedOnSurface ? 0.9 : 0.95; // Less friction for more sliding

              const vnX = snX * dot;
              const vnY = snY * dot;
              const vnZ = snZ * dot;

              const vtX = ragdollVel[0] - vnX;
              const vtY = ragdollVel[1] - vnY;
              const vtZ = ragdollVel[2] - vnZ;

              ragdollVel[0] = vtX * friction - vnX * bounciness;
              ragdollVel[1] = vtY * friction - vnY * bounciness;
              ragdollVel[2] = vtZ * friction - vnZ * bounciness;

              const speedSq = vtX * vtX + vtY * vtY + vtZ * vtZ;
              if (speedSq > 0.00001) {
                const speed = Math.sqrt(speedSq);
                ragdollAngularSpeed = speed * 1.5; // Rotate based on speed

                // Axis is cross product of surface normal and velocity direction
                let cX = snY * vtZ - snZ * vtY;
                let cY = snZ * vtX - snX * vtZ;
                let cZ = snX * vtY - snY * vtX;
                const cLen = Math.sqrt(cX * cX + cY * cY + cZ * cZ);
                if (cLen > 0.0001) {
                  ragdollAxis = [cX / cLen, cY / cLen, cZ / cLen];
            }
          } else {
                let normalizedAngle = Math.abs(ragdollAngle % Math.PI);
                if (
                  normalizedAngle < (Math.PI / 2) * 0.8 ||
                  normalizedAngle > Math.PI - (Math.PI / 2) * 0.8
                ) {
                  ragdollAngularSpeed =
                    0.05 * Math.sign(ragdollAngularSpeed || 1);
                } else {
                  ragdollAngularSpeed *= 0.5;
                }
              }
            }
          }
        }
        
        // Collision with chests and boats for ragdoll
        for (let item of collectibles) {
          if (item.active && (item.type === "wood_chest" || item.type === "wood_boat") && !item.isPreview) {
            const sP = item.position;
            const sR = item.R;
            const sN = item.normal;
            const sF = item.F;
            
            const dx_vec = [
              ragdollPos[0] - sP[0],
              ragdollPos[1] - sP[1],
              ragdollPos[2] - sP[2]
            ];
            
            const localX = dx_vec[0] * sR[0] + dx_vec[1] * sR[1] + dx_vec[2] * sR[2];
            const localY = dx_vec[0] * sN[0] + dx_vec[1] * sN[1] + dx_vec[2] * sN[2];
            const localZ = dx_vec[0] * sF[0] + dx_vec[1] * sF[1] + dx_vec[2] * sF[2];
            
            let hw, hh, hd;
            if (item.type === "wood_chest") {
              const cs = 0.45; 
              hw = 0.12 * cs; 
              hh = 0.13 * cs; 
              hd = 0.09 * cs; 
            } else {
              const bs = 0.4;
              hw = 0.25 * bs; 
              hh = 0.1 * bs; 
              hd = 0.6 * bs; 
            }
            
            const angleFactor = Math.abs(Math.cos(ragdollAngle));
            const rRad = playerScale * (0.15 + 0.43 * angleFactor);
            if (Math.abs(localX) < hw + rRad && Math.abs(localZ) < hd + rRad && localY > -0.1 && localY < hh * 2 + rRad) {
              const pushX = (hw + rRad) - Math.abs(localX);
              const pushZ = (hd + rRad) - Math.abs(localZ);
              if (pushX < pushZ) {
                const sign = localX > 0 ? 1 : -1;
                ragdollPos[0] += sR[0] * sign * pushX;
                ragdollPos[1] += sR[1] * sign * pushX;
                ragdollPos[2] += sR[2] * sign * pushX;
                // bounce vel
                const dot = ragdollVel[0] * sR[0] + ragdollVel[1] * sR[1] + ragdollVel[2] * sR[2];
                if (dot * sign < 0) {
                  ragdollVel[0] -= sR[0] * dot * 1.5;
                  ragdollVel[1] -= sR[1] * dot * 1.5;
                  ragdollVel[2] -= sR[2] * dot * 1.5;
            }
          } else {
                const sign = localZ > 0 ? 1 : -1;
                ragdollPos[0] += sF[0] * sign * pushZ;
                ragdollPos[1] += sF[1] * sign * pushZ;
                ragdollPos[2] += sF[2] * sign * pushZ;
                // bounce vel
                const dot = ragdollVel[0] * sF[0] + ragdollVel[1] * sF[1] + ragdollVel[2] * sF[2];
                if (dot * sign < 0) {
                  ragdollVel[0] -= sF[0] * dot * 1.5;
                  ragdollVel[1] -= sF[1] * dot * 1.5;
                  ragdollVel[2] -= sF[2] * dot * 1.5;
                }
              }
            }
          }
        }

        // Update limbs
        if (ragdollLimbs) {
          const s = Math.abs(ragdollAngularSpeed) * 3.0;
          const updateLimb = (angle, vel, target, stiffness, damping) => {
            const force = (target - angle) * stiffness;
            let v = vel + force;
            // Remove random jitter to make it floppy, lifeless, and prevent active-like animation twitching
            v *= damping;
            return { a: angle + v, v: v };
          };

          let r;
          // Soft, limp targets with very low stiffness to make limbs completely floppy/loose like NPC
          r = updateLimb(ragdollLimbs.aL, ragdollLimbs.vaL, 0.1, 0.008, 0.9);
          ragdollLimbs.aL = r.a;
          ragdollLimbs.vaL = r.v;

          r = updateLimb(ragdollLimbs.aR, ragdollLimbs.vaR, 0.1, 0.008, 0.9);
          ragdollLimbs.aR = r.a;
          ragdollLimbs.vaR = r.v;

          r = updateLimb(ragdollLimbs.eL, ragdollLimbs.veL, 0.15, 0.008, 0.9);
          ragdollLimbs.eL = Math.max(0, r.a);
          ragdollLimbs.veL = r.v;

          r = updateLimb(ragdollLimbs.eR, ragdollLimbs.veR, 0.15, 0.008, 0.9);
          ragdollLimbs.eR = Math.max(0, r.a);
          ragdollLimbs.veR = r.v;

          r = updateLimb(ragdollLimbs.lL, ragdollLimbs.vlL, 0.0, 0.008, 0.9);
          ragdollLimbs.lL = r.a;
          ragdollLimbs.vlL = r.v;

          r = updateLimb(ragdollLimbs.lR, ragdollLimbs.vlR, 0.0, 0.008, 0.9);
          ragdollLimbs.lR = r.a;
          ragdollLimbs.vlR = r.v;

          r = updateLimb(ragdollLimbs.kL, ragdollLimbs.vkL, 0.15, 0.008, 0.9);
          ragdollLimbs.kL = Math.max(0, r.a);
          ragdollLimbs.vkL = r.v;

          r = updateLimb(ragdollLimbs.kR, ragdollLimbs.vkR, 0.15, 0.008, 0.9);
          ragdollLimbs.kR = Math.max(0, r.a);
          ragdollLimbs.vkR = r.v;
        }
      }

      // =========================================================================
      // 3D Stylized Anime Hair Generator (Merged from hairstyles.js)
      // Provides 100% full scalp coverage with 10+ dense staggered 3D hair strand layers covering 360° of the skull.
      // =========================================================================
      window.ANIME_HAIR_COLORS = [
        [0.85, 0.90, 0.96], // 0: Platinum Silver / Ice Blue
        [0.18, 0.18, 0.22], // 1: Jet Black / Raven
        [0.88, 0.72, 0.52], // 2: Blonde Gold
        [0.72, 0.35, 0.22], // 3: Chestnut Brown
        [0.85, 0.45, 0.55], // 4: Sakura Pink
        [0.45, 0.65, 0.85], // 5: Sky Blue
        [0.55, 0.40, 0.70], // 6: Deep Purple
      ];

      window.NUM_HAIR_STYLES = 1;

      window.HAIR_STYLE_NAMES = [
        "Anime Stylized Hair (ทรงผมอนิเมะ 3D ละเอียด 10 ชั้น)",
      ];

      window.build3DAnimeHair = function(
        styleIdx,
        color,
        scale,
        ptTransformFn,
        headTilt,
        outV,
        outC,
        outI
      ) {
        // 1. UNIFORM HAIR COLOR ACCURACY
        const colBase = (color && Array.isArray(color) && color.length >= 3)
          ? [color[0], color[1], color[2]]
          : [0.85, 0.90, 0.96]; // Default Silver/Platinum

        const bo = headTilt || 0;

        // Add vertex with light shading factor
        const addVertex = (localP, shadeFactor = 1.0) => {
          const p = ptTransformFn(localP[0], localP[1] + bo, localP[2]);
          const vIdx = outV.length / 3;
          outV.push(p[0], p[1], p[2]);
          outC.push(
            Math.min(1.0, Math.max(0.0, colBase[0] * shadeFactor)),
            Math.min(1.0, Math.max(0.0, colBase[1] * shadeFactor)),
            Math.min(1.0, Math.max(0.0, colBase[2] * shadeFactor))
          );
          return vIdx;
        };

        const addTri = (v1, v2, v3) => {
          outI.push(v1, v2, v3);
        };

        // Double-sided quad (renders both CCW & CW to guarantee 360° visibility)
        const addTwoSidedQuad = (v1, v2, v3, v4) => {
          // Front face
          outI.push(v1, v2, v3);
          outI.push(v1, v3, v4);
          // Back face
          outI.push(v1, v4, v3);
          outI.push(v1, v3, v2);
        };

        // ----------------------------------------------------
        // 2. HAIRLINE BOUNDARY FUNCTION (ขอบไรผมรอบศีรษะ)
        // Head sphere radius R_HEAD = 0.240
        // Hair dome sits outside head sphere at R = 0.255
        // ----------------------------------------------------
        const getHairlineMinElevation = (azDeg) => {
          let az = azDeg;
          while (az > 180) az -= 360;
          while (az < -180) az += 360;
          const absAz = Math.abs(az);

          if (absAz < 60) {
            // Forehead hairline (Above eyebrows)
            const t = absAz / 60;
            return 28.0 - 14.0 * (t * t); // 28° center -> 14° temples
          } else if (absAz < 95) {
            // Temples down to sideburns
            const t = (absAz - 60) / 35;
            return 14.0 - 46.0 * t; // 14° -> -32°
          } else {
            // Back of head & deep nape (ท้ายทอย คลุมลึกลงถึงระดับลำคอ)
            const t = (absAz - 95) / 85;
            return -32.0 - 28.0 * t; // -32° -> -60°
          }
        };

        // Calculates scalp root coordinates and normal on hair dome
        const getHairRoot = (azimuthDeg, elevationDeg, radiusOffset = 0.015) => {
          const minEl = getHairlineMinElevation(azimuthDeg);
          const safeEl = Math.max(elevationDeg, minEl);

          const az = (azimuthDeg * Math.PI) / 180;
          const el = (safeEl * Math.PI) / 180;

          const cosEl = Math.cos(el);
          const sinEl = Math.sin(el);
          const sinAz = Math.sin(az);
          const cosAz = Math.cos(az);

          const r = 0.240 + radiusOffset; // Hair sits outside head sphere (R=0.240)

          const x = r * sinAz * cosEl;
          const y = r * sinEl;
          const z = r * cosAz * cosEl;

          return {
            p: [x, y, z],
            n: [sinAz * cosEl, sinEl, cosAz * cosEl],
            azDeg: azimuthDeg,
            elDeg: safeEl,
          };
        };

        // ----------------------------------------------------
        // 3. SOLID 3D BASE HAIR DOME CAP (หมวกทรงผมรองพื้นปิดศีรษะ 100% ไร้รอยโหว่)
        // High-density grid that fully encloses the head sphere
        // ----------------------------------------------------
        const addSolidHairDome = () => {
          const nLon = 24;
          const nLat = 10;
          const grid = [];

          for (let lon = 0; lon <= nLon; lon++) {
            const azDeg = -180 + (lon / nLon) * 360;
            const minEl = getHairlineMinElevation(azDeg);
            const maxEl = 88.0;

            const col = [];
            for (let lat = 0; lat <= nLat; lat++) {
              const u = lat / nLat;
              const elDeg = minEl + u * (maxEl - minEl);
              // Base Cap radius R = 0.255 (0.240 + 0.015 offset)
              const root = getHairRoot(azDeg, elDeg, 0.015);
              // Subtle vertical lighting gradient
              const shade = 0.86 + 0.14 * u;
              col.push(addVertex(root.p, shade));
            }
            grid.push(col);
          }

          // Connect dome grid cells with double-sided quads
          for (let lon = 0; lon < nLon; lon++) {
            for (let lat = 0; lat < nLat; lat++) {
              const v1 = grid[lon][lat];
              const v2 = grid[lon + 1][lat];
              const v3 = grid[lon + 1][lat + 1];
              const v4 = grid[lon][lat + 1];
              addTwoSidedQuad(v1, v2, v3, v4);
            }
          }

          // Seal top crown zenith cap
          const vZenith = addVertex([0, 0.256, 0], 1.00);
          for (let lon = 0; lon < nLon; lon++) {
            const v1 = grid[lon][nLat];
            const v2 = grid[lon + 1][nLat];
            addTri(vZenith, v2, v1);
            addTri(vZenith, v1, v2);
          }
        };

        // ----------------------------------------------------
        // 4. HIGH-PRECISION 3D ANIME HAIR STRAND GENERATOR
        // Creates voluminous 3D anime hair locks with natural gravity droop & Bezier curvature
        // ----------------------------------------------------
        const addHairStrand = (
          rootAz, rootEl,            // Scalp Root Angles
          length,                    // Strand Length
          archOut,                   // Bulge distance from scalp
          dirX, dirY, dirZ,          // Direction vector
          wStart = 0.038,            // Broad root width
          wMid = 0.065,              // Volumetric mid width
          thick = 0.016,             // 3D Volume thickness
          steps = 6,                 // Smooth organic curve divisions
          shadeRoot = 0.86,
          shadeTip = 1.00,
          radiusOffset = 0.018,
          gravity = 0.06             // Soft natural gravity droop on hair tips
        ) => {
          // Root on scalp hair layer
          const root = getHairRoot(rootAz, rootEl, radiusOffset);
          const P0 = root.p;
          const N = root.n;

          const fLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
          const D = [dirX / fLen, dirY / fLen, dirZ / fLen];

          // Bezier control points sprouting out from scalp normal N and curving with graceful natural gravity
          const P1 = [
            P0[0] + N[0] * (archOut * 1.25) + D[0] * (length * 0.42),
            P0[1] + N[1] * (archOut * 1.25) + D[1] * (length * 0.42) - gravity * 0.4,
            P0[2] + N[2] * (archOut * 1.25) + D[2] * (length * 0.42),
          ];
          const P2 = [
            P0[0] + N[0] * (archOut * 0.25) + D[0] * length,
            P0[1] + N[1] * (archOut * 0.25) + D[1] * length - gravity * 1.1,
            P0[2] + N[2] * (archOut * 0.25) + D[2] * length,
          ];

          const rings = [];

          for (let s = 0; s <= steps; s++) {
            const u = s / steps;
            const invU = 1 - u;

            // Quadratic Bezier curve point P(u)
            const px = invU * invU * P0[0] + 2 * invU * u * P1[0] + u * u * P2[0];
            const py = invU * invU * P0[1] + 2 * invU * u * P1[1] + u * u * P2[1];
            const pz = invU * invU * P0[2] + 2 * invU * u * P1[2] + u * u * P2[2];
            const currP = [px, py, pz];

            // Local tangent vector T(u) = dP/du along Bezier curve
            let tx = 2 * (invU * (P1[0] - P0[0]) + u * (P2[0] - P1[0]));
            let ty = 2 * (invU * (P1[1] - P0[1]) + u * (P2[1] - P1[1]));
            let tz = 2 * (invU * (P1[2] - P0[2]) + u * (P2[2] - P1[2]));
            let tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen < 0.0001) {
              tx = D[0]; ty = D[1]; tz = D[2]; tLen = 1;
            }
            const T = [tx / tLen, ty / tLen, tz / tLen];

            // Binormal vector across hair strand width
            let bx = N[1] * T[2] - N[2] * T[1];
            let by = N[2] * T[0] - N[0] * T[2];
            let bz = N[0] * T[1] - N[1] * T[0];
            let bLen = Math.sqrt(bx * bx + by * by + bz * bz);
            if (bLen < 0.001) {
              bx = 1; by = 0; bz = 0; bLen = 1;
            }
            const B = [bx / bLen, by / bLen, bz / bLen];

            // Strand Normal vector
            const StrandN = [
              B[1] * T[2] - B[2] * T[1],
              B[2] * T[0] - B[0] * T[2],
              B[0] * T[1] - B[1] * T[0],
            ];

            let w = (u < 0.25) ? (1 - u / 0.25) * wStart + (u / 0.25) * wMid : (1 - (u - 0.25) / 0.75) * wMid;
            let t = (1 - u * 0.75) * thick;

            const curShade = shadeRoot + u * (shadeTip - shadeRoot);

            if (s === steps || w <= 0.002) {
              // Tapered sharp tip point
              const vTip = addVertex(currP, curShade);
              rings.push([vTip, vTip, vTip, vTip]);
            } else {
              const vTop   = addVertex([currP[0] + StrandN[0] * t, currP[1] + StrandN[1] * t, currP[2] + StrandN[2] * t], curShade);
              const vRight = addVertex([currP[0] + B[0] * w, currP[1] + B[1] * w, currP[2] + B[2] * w], curShade * 0.96);
              const vBot   = addVertex([currP[0] - StrandN[0] * t, currP[1] - StrandN[1] * t, currP[2] - StrandN[2] * t], curShade * 0.92);
              const vLeft  = addVertex([currP[0] - B[0] * w, currP[1] - B[1] * w, currP[2] - B[2] * w], curShade * 0.96);

              rings.push([vTop, vRight, vBot, vLeft]);
            }
          }

          // Connect rings into 3D volume mesh with double-sided quads
          for (let s = 0; s < steps; s++) {
            const r1 = rings[s];
            const r2 = rings[s + 1];

            if (s === steps - 1) {
              const vTip = r2[0];
              addTwoSidedQuad(r1[0], r1[1], vTip, r1[0]);
              addTwoSidedQuad(r1[1], r1[2], vTip, r1[1]);
              addTwoSidedQuad(r1[2], r1[3], vTip, r1[2]);
              addTwoSidedQuad(r1[3], r1[0], vTip, r1[3]);
            } else {
              addTwoSidedQuad(r1[0], r1[1], r2[1], r2[0]);
              addTwoSidedQuad(r1[1], r1[2], r2[2], r2[1]);
              addTwoSidedQuad(r1[2], r1[3], r2[3], r2[2]);
              addTwoSidedQuad(r1[3], r1[0], r2[0], r2[3]);
            }
          }
        };

        // Helper function to render a full circular ring of staggered strands around the skull
        const addStrandRing = (
          numStrands,
          elevationDeg,
          azimuthOffsetDeg,
          length,
          archOut,
          wStart,
          wMid,
          thick,
          radiusOffset,
          downSlope = 0.80
        ) => {
          for (let i = 0; i < numStrands; i++) {
            const az = -180 + (i / numStrands) * 360 + azimuthOffsetDeg;
            const isFront = Math.abs(az) < 55;
            const rad = (az * Math.PI) / 180;

            // Flow direction outwards and downwards
            const fx = Math.sin(rad) * 0.80;
            const fy = -downSlope;
            const fz = Math.cos(rad) * 0.80;

            const actualLen = isFront && elevationDeg < 45 ? length * 0.60 : length;

            addHairStrand(
              az, elevationDeg,
              actualLen, archOut,
              fx, fy, fz,
              wStart, wMid, thick, 6, 0.86, 0.98, radiusOffset
            );
          }
        };

        // ----------------------------------------------------
        // 5. BUILD COMPLETE 10-LAYER DENSE 360° ANIME HAIR MESH
        // ----------------------------------------------------

        // Layer 0: Solid base cap (100% full scalp seal)
        addSolidHairDome();

        // Layer 1: Top Crown Zenith (elevation = +80°, 12 strands)
        addStrandRing(12, 80, 0, 0.22, 0.040, 0.035, 0.055, 0.014, 0.018, 0.65);

        // Layer 2: Upper Crown Ring (elevation = +68°, 20 strands, staggered offset)
        addStrandRing(20, 68, (360 / 20) / 2, 0.25, 0.038, 0.038, 0.062, 0.015, 0.020, 0.70);

        // Layer 3: High Skull Ring (elevation = +54°, 26 strands)
        addStrandRing(26, 54, 0, 0.28, 0.036, 0.040, 0.065, 0.015, 0.022, 0.75);

        // Layer 4: Mid-Upper Skull Ring (elevation = +40°, 30 strands, staggered offset)
        addStrandRing(30, 40, (360 / 30) / 2, 0.32, 0.034, 0.042, 0.068, 0.016, 0.024, 0.80);

        // Layer 5: Mid Skull Ring (elevation = +26°, 32 strands)
        addStrandRing(32, 26, 0, 0.35, 0.032, 0.042, 0.070, 0.016, 0.026, 0.82);

        // Layer 6: Lower Skull Ring (elevation = +12°, 30 strands, staggered offset)
        addStrandRing(30, 12, (360 / 30) / 2, 0.36, 0.030, 0.044, 0.070, 0.016, 0.028, 0.85);

        // Layer 7: Lower Head & Ear Line (elevation = -2°, 28 strands)
        addStrandRing(28, -2, 0, 0.38, 0.028, 0.044, 0.068, 0.016, 0.030, 0.88);

        // Layer 8: Upper Nape & Neck Coverage (elevation = -16°, 24 strands, staggered offset)
        addStrandRing(24, -16, (360 / 24) / 2, 0.36, 0.025, 0.042, 0.065, 0.015, 0.032, 0.90);

        // Layer 9: Deep Nape & Lower Neck Coverage (elevation = -30°, 20 strands)
        addStrandRing(20, -30, 0, 0.32, 0.022, 0.040, 0.060, 0.015, 0.034, 0.92);

        // Layer 10: Lowest Neck Boundary (elevation = -44°, 16 strands)
        addStrandRing(16, -44, (360 / 16) / 2, 0.28, 0.018, 0.038, 0.055, 0.014, 0.036, 0.95);

        // ----------------------------------------------------
        // 6. SPECIALIZED FACE FRAMING, BANGS & ANIME STYLES
        // ----------------------------------------------------

        // Layer 11: Inner Forehead Bangs (15 overlapping close bangs)
        for (let i = 0; i <= 14; i++) {
          const az = -56 + (i / 14) * 112; // -56° to +56°
          const t = Math.abs(az) / 56;
          const bangLen = 0.15 + 0.06 * t;
          const rad = (az * Math.PI) / 180;
          addHairStrand(
            az, 36,
            bangLen, 0.028,
            Math.sin(rad) * 0.35, -0.85, Math.cos(rad) * 0.65,
            0.028, 0.052, 0.014, 6, 0.94, 1.00, 0.032
          );
        }

        // Layer 12: Outer Swept Bangs (13 layered outer bangs)
        for (let i = 0; i <= 12; i++) {
          const az = -50 + (i / 12) * 100;
          const t = Math.abs(az) / 50;
          const bangLen = 0.18 + 0.07 * t;
          const rad = (az * Math.PI) / 180;
          addHairStrand(
            az, 46,
            bangLen, 0.038,
            Math.sin(rad) * 0.45, -0.80, Math.cos(rad) * 0.70,
            0.032, 0.058, 0.015, 6, 0.96, 1.00, 0.038
          );
        }

        // Layer 13: Sideburns & Cheek Framing Locks (ปอยผมข้างแก้มและจรไทร)
        addHairStrand(-68, 18, 0.28, 0.032, -0.75, -0.85, 0.10, 0.036, 0.055, 0.015, 7, 0.92, 0.98, 0.035);
        addHairStrand( 68, 18, 0.28, 0.032,  0.75, -0.85, 0.10, 0.036, 0.055, 0.015, 7, 0.92, 0.98, 0.035);

        addHairStrand(-82, 8, 0.32, 0.034, -0.82, -0.85, -0.15, 0.038, 0.058, 0.015, 7, 0.90, 0.96, 0.035);
        addHairStrand( 82, 8, 0.32, 0.034,  0.82, -0.85, -0.15, 0.038, 0.058, 0.015, 7, 0.90, 0.96, 0.035);

        // Layer 14: Volumetric Crown Anime Spikes & Ahoge (ปอยผมชี้อนิเมะ)
        addHairStrand(-35, 62, 0.20, 0.048, -0.5, -0.65, 0.2, 0.032, 0.050, 0.014, 6, 0.98, 1.00, 0.040);
        addHairStrand( 35, 62, 0.20, 0.048,  0.5, -0.65, 0.2, 0.032, 0.050, 0.014, 6, 0.98, 1.00, 0.040);

        addHairStrand(-72, 54, 0.26, 0.050, -0.8, -0.55, -0.1, 0.034, 0.052, 0.015, 6, 0.96, 1.00, 0.040);
        addHairStrand( 72, 54, 0.26, 0.050,  0.8, -0.55, -0.1, 0.034, 0.052, 0.015, 6, 0.96, 1.00, 0.040);

        // Ahoge (ขวัญผมชี้อนิเมะยอดหัว)
        addHairStrand(0, 84, 0.22, 0.065, -0.2, 0.65, 0.35, 0.020, 0.035, 0.012, 6, 1.00, 1.00, 0.042);
      };

      // =========================================================================
      // ระบบโมเดลตัวละคร: Classic (Procedural) & Chibi White (GLB)
      // =========================================================================
      if (typeof window !== "undefined") {
        if (!window.characterModel) {
          window.characterModel = "chibi"; // ค่าเริ่มต้น: Chibi
        }

        window.switchCharacterModel = function(modelName) {
          if (modelName === "chibi" || modelName === "chibi_white") {
            window.characterModel = "chibi";
          } else {
            window.characterModel = "classic";
          }
          if (typeof updateCharacterMesh === "function") {
            updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
          }
          if (typeof window.updateDevCharacterModelUI === "function") {
            window.updateDevCharacterModelUI();
          }
          if (typeof showNotice === "function") {
            let msg = window.characterModel === "chibi" ? "✨ Chibi White Model (GLB)" : "🧑 Classic Model (Procedural)";
            showNotice("👤 สลับโมเดลตัวละคร: " + msg);
          }
          return window.characterModel;
        };

        window.toggleCharacterModel = function() {
          let next = window.characterModel === "classic" ? "chibi" : "classic";
          return window.switchCharacterModel(next);
        };

        // Load GLB
        window.chibiGlbModel = null;
        window.createChibiGlbTexture = function(targetGl) {
          if (typeof window === "undefined") return null;
          if (window.chibiGlbTexture) return window.chibiGlbTexture;
          const model = window.chibiGlbModel;
          if (!model || !model.images || model.images.length === 0) return null;
          const img = model.images[0];
          if (!img) return null;

          const activeGl = targetGl ||
            (typeof gl !== "undefined" && gl ? gl : null) ||
            (window.gl ? window.gl : null) ||
            (window.Graphics && window.Graphics.webgl && window.Graphics.webgl.gl ? window.Graphics.webgl.gl : null) ||
            (window.Graphics && window.Graphics.gl ? window.Graphics.gl : null);

          if (!activeGl) return null;

          const uploadTex = () => {
            if (window.chibiGlbTexture) return;
            try {
              const tex = activeGl.createTexture();
              activeGl.bindTexture(activeGl.TEXTURE_2D, tex);
              activeGl.pixelStorei(activeGl.UNPACK_FLIP_Y_WEBGL, false); // GLTF doesn't flip Y
              activeGl.texImage2D(activeGl.TEXTURE_2D, 0, activeGl.RGBA, activeGl.RGBA, activeGl.UNSIGNED_BYTE, img);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_MIN_FILTER, activeGl.LINEAR);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_MAG_FILTER, activeGl.LINEAR);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_WRAP_S, activeGl.CLAMP_TO_EDGE);
              activeGl.texParameteri(activeGl.TEXTURE_2D, activeGl.TEXTURE_WRAP_T, activeGl.CLAMP_TO_EDGE);
              window.chibiGlbTexture = tex;
              console.log("Chibi GLB Texture created successfully");
            } catch (err) {
              console.error("Error creating Chibi GLB texture:", err);
            }
          };

          if (img.complete && img.naturalWidth > 0) {
            uploadTex();
          } else {
            img.onload = uploadTex;
          }
          return window.chibiGlbTexture;
        };

        if (window.GLBLoader) {
          const loader = new window.GLBLoader();
          loader.load('gamefile/gameplay/chibi%20white.glb').then(() => {
            window.chibiGlbModel = loader;
            if (typeof window.updateDevAnimationList === "function") window.updateDevAnimationList();
            if (typeof window.updateDevCharacterModelUI === "function") window.updateDevCharacterModelUI();
            if (typeof window.updateDevBonesAndParts === "function") window.updateDevBonesAndParts();
            console.log("Chibi GLB loaded successfully");
            
            // Create texture if gl is available
            const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
            if (activeGl) {
              window.createChibiGlbTexture(activeGl);
              if (window.characterModel === "chibi") {
                if (typeof updateCharacterMesh === "function") updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
              }
            }
          }).catch(e => console.error("Failed to load Chibi GLB:", e));
        }
      }

      let _glbCachedVertices = null;
      let _glbCachedNormals = null;
      let _glbCachedColors = null;

      // =========================================================================
      // Procedural Virtual Bone Hair Spring Physics (แนวทางที่ 3: Virtual Bone Skinning)
      // =========================================================================
      // PROCEDURAL PONYTAIL SPRING PHYSICS (Virtual Bone Injection)
      // =========================================================================
      const chibiHairPhysics = {
        enabled: true,
        stiffness: 85.0,     // Spring tension (bouncy & responsive)
        damping: 9.0,        // Damping (fluid oscillation)
        inertia: 1.0,        // Movement & turning sensitivity
        maxAngle: 0.85,      // Max rotation radians (~49 deg)
        pitch: 0.0,
        pitchVel: 0.0,
        yaw: 0.0,
        yawVel: 0.0,
        roll: 0.0,
        rollVel: 0.0,
        lastHeading: 0.0,
        _lastTime: 0.0
      };

      if (typeof window !== "undefined") {
        window.chibiHairPhysics = chibiHairPhysics;
        window.triggerHairJiggle = function(impulsePitch = 40.0, impulseYaw = 50.0, impulseRoll = 25.0) {
          chibiHairPhysics.pitchVel += impulsePitch;
          chibiHairPhysics.yawVel += impulseYaw;
          chibiHairPhysics.rollVel += impulseRoll;
        };
      }

      function updateChibiVirtualHair(model, isMovingActive, isSprintingActive, phase) {
        if (!model || typeof model.setPonytailRotation !== "function") return;
        if (!chibiHairPhysics.enabled) {
          model.setPonytailRotation(0, 0, 0, 1);
          return;
        }

        const hairPhys = chibiHairPhysics;
        const nowSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.001;
        if (!hairPhys._lastTime) hairPhys._lastTime = nowSec;
        const clampedDt = Math.min(0.05, Math.max(0.001, nowSec - hairPhys._lastTime));
        hairPhys._lastTime = nowSec;

        let forcePitch = 0.0;
        let forceYaw = 0.0;
        let forceRoll = 0.0;

        const inertia = hairPhys.inertia;

        if (isMovingActive) {
          // Bobbing from footsteps (twice per stride)
          const bounce = Math.sin(phase * 2.0);
          forcePitch += bounce * (isSprintingActive ? 42.0 : 24.0) * inertia;
          // Air resistance / forward inertia tilts ponytail backward
          forcePitch += (isSprintingActive ? 36.0 : 18.0) * inertia;
          // Lateral sway from side-to-side weight transfer
          const sway = Math.cos(phase);
          forceYaw += sway * (isSprintingActive ? 30.0 : 18.0) * inertia;
          forceRoll += sway * (isSprintingActive ? 22.0 : 12.0) * inertia;
        } else {
          // Organic breathing & gentle ambient breeze when standing still
          forcePitch += Math.sin(nowSec * 2.8) * 8.0 * inertia;
          forceYaw += Math.cos(nowSec * 1.8) * 12.0 * inertia;
          forceRoll += Math.sin(nowSec * 2.2 + 0.6) * 7.0 * inertia;
        }

        // Turning / Angular velocity centrifugal inertia
        const currentHeading = (typeof charHeading !== "undefined") ? charHeading : 0.0;
        let dHeading = currentHeading - hairPhys.lastHeading;
        while (dHeading < -Math.PI) dHeading += Math.PI * 2;
        while (dHeading > Math.PI) dHeading -= Math.PI * 2;
        hairPhys.lastHeading = currentHeading;

        const turnRate = Math.max(-10.0, Math.min(10.0, dHeading / clampedDt));
        forceYaw -= turnRate * 2.2 * inertia;
        forceRoll -= turnRate * 1.4 * inertia;

        // Spring-damper integration
        const stiffness = hairPhys.stiffness;
        const damping = hairPhys.damping;

        const accPitch = -stiffness * hairPhys.pitch - damping * hairPhys.pitchVel + forcePitch;
        const accYaw   = -stiffness * hairPhys.yaw   - damping * hairPhys.yawVel   + forceYaw;
        const accRoll  = -stiffness * hairPhys.roll  - damping * hairPhys.rollVel  + forceRoll;

        hairPhys.pitchVel += accPitch * clampedDt;
        hairPhys.yawVel   += accYaw   * clampedDt;
        hairPhys.rollVel  += accRoll  * clampedDt;

        hairPhys.pitch += hairPhys.pitchVel * clampedDt;
        hairPhys.yaw   += hairPhys.yawVel   * clampedDt;
        hairPhys.roll  += hairPhys.rollVel  * clampedDt;

        const maxA = hairPhys.maxAngle;
        hairPhys.pitch = Math.max(-maxA, Math.min(maxA, hairPhys.pitch));
        hairPhys.yaw   = Math.max(-maxA, Math.min(maxA, hairPhys.yaw));
        hairPhys.roll  = Math.max(-maxA, Math.min(maxA, hairPhys.roll));

        // Convert (pitch, yaw, roll) into Quaternion
        const p = hairPhys.pitch, y = hairPhys.yaw, r = hairPhys.roll;
        const cp = Math.cos(p * 0.5), sp = Math.sin(p * 0.5);
        const cy = Math.cos(y * 0.5), sy = Math.sin(y * 0.5);
        const cr = Math.cos(r * 0.5), sr = Math.sin(r * 0.5);

        const qx = sp * cy * cr + cp * sy * sr;
        const qy = cp * sy * cr - sp * cy * sr;
        const qz = cp * cy * sr + sp * sy * cr;
        const qw = cp * cy * cr - sp * sy * sr;

        model.setPonytailRotation(qx, qy, qz, qw);
      }

      // =========================================================================
      // Chibi Hand Pose & Finger Controls (กำมือ, แบมือ, แยกนิ้ว)
      // =========================================================================
      const chibiHandState = {
        rightCurl: 0.0,    // -0.5 (แบมือกางสุด) to 0.0 (ธรรมชาติ) to 1.0 (กำมือ)
        leftCurl: 0.0,
        rightSpread: 0.0,  // -1.0 (หุบนิ้วชิดกัน) to 0.0 (ธรรมชาติ) to 1.0 (แยกนิ้วกว้าง)
        leftSpread: 0.0,
        syncBoth: true
      };

      if (typeof window !== "undefined") {
        window.chibiHandState = chibiHandState;
        window.setChibiHandCurl = function(val, hand = "both") {
          if (hand === "both" || hand === "right") chibiHandState.rightCurl = val;
          if (hand === "both" || hand === "left") chibiHandState.leftCurl = val;
          if (window.chibiGlbModel && typeof window.chibiGlbModel.setHandPose === "function") {
            window.chibiGlbModel.setHandPose(chibiHandState);
          }
          if (typeof window.updateCharacterMesh === "function") {
            window.updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
          }
        };
        window.setChibiHandSpread = function(val, hand = "both") {
          if (hand === "both" || hand === "right") chibiHandState.rightSpread = val;
          if (hand === "both" || hand === "left") chibiHandState.leftSpread = val;
          if (window.chibiGlbModel && typeof window.chibiGlbModel.setHandPose === "function") {
            window.chibiGlbModel.setHandPose(chibiHandState);
          }
          if (typeof window.updateCharacterMesh === "function") {
            window.updateCharacterMesh(typeof walkPhase !== "undefined" ? walkPhase : 0.0);
          }
        };
      }

      function updateChibiHandPose(model, heldItem, isItemAction) {
        if (!model || typeof model.setHandPose !== "function") return;

        // Base values from dev sliders
        let rCurl = chibiHandState.rightCurl;
        let lCurl = chibiHandState.leftCurl;
        let rSpread = chibiHandState.rightSpread;
        let lSpread = chibiHandState.leftSpread;

        // If character is holding a tool/item and no manual override is active, naturally grip hand
        if (heldItem && rCurl === 0.0) {
          rCurl = 0.85; // Natural firm grip on tool handle
        }

        model.setHandPose({
          rightCurl: rCurl,
          leftCurl: lCurl,
          rightSpread: rSpread,
          leftSpread: lSpread
        });
      }

      function getGlbCharacterMeshData(phase, isClone = false, cloneWalkBlend = 1.0) {
        if (typeof window === "undefined" || !window.chibiGlbModel) return null;
        if (isClone) return null; // Force clones to use procedural classic model
        if (window.characterModel !== "chibi") return null;
        const model = window.chibiGlbModel;

        const isSprintingActive = !isClone && typeof isSprinting !== "undefined" && isSprinting;
        const isWalkingActive = isClone ? (cloneWalkBlend > 0.05) : (typeof isWalking !== "undefined" && isWalking);
        const isMovingActive = isClone ? (cloneWalkBlend > 0.05) : (typeof isMoving !== "undefined" ? isMoving : isWalkingActive);
        const isRiding = !isClone && ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech));
        const inWater = !isClone && typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.05;
        const isAirborne = !isClone && !inWater && !isRiding && typeof jumpBlend !== "undefined" && jumpBlend > 0.15;

        const dt = 1.0 / 60.0;

        // Track Airborne / Jump animation playback timeline (takeoff @ 1.35s -> peak spread @ 1.85s -> fall @ 2.30s -> land @ 2.65s)
        if (typeof window.charJumpAnimTime === "undefined") window.charJumpAnimTime = 1.35;
        if (typeof window.charWasAirborne === "undefined") window.charWasAirborne = false;
        if (typeof window.charLandingTimer === "undefined") window.charLandingTimer = 0.0;

        if (isAirborne) {
          if (!window.charWasAirborne) {
            // Jump takeoff start
            window.charJumpAnimTime = 1.35;
            window.charWasAirborne = true;
            window.charLandingTimer = 0.0;
          } else {
            // Smoothly advance jump animation forward through flight
            window.charJumpAnimTime += dt * 1.6;
            if (window.charJumpAnimTime > 2.30) {
              window.charJumpAnimTime = 2.30; // Hold airborne pose during long descent/fall
            }
          }
        } else {
          if (window.charWasAirborne) {
            // Landing compression on touchdown
            window.charLandingTimer += dt;
            window.charJumpAnimTime += dt * 2.0;
            if (window.charLandingTimer > 0.18 || window.charJumpAnimTime >= 2.65) {
              window.charWasAirborne = false;
              window.charLandingTimer = 0.0;
              window.charJumpAnimTime = 1.35;
            }
          } else {
            window.charJumpAnimTime = 1.35;
          }
        }

        const heldItem = isClone ? null : (typeof window.getHeldItem === "function" ? window.getHeldItem() : (typeof getHeldItem === "function" ? getHeldItem() : null));
        const isItemAction = !isClone && typeof isUsingItem !== "undefined" && isUsingItem && typeof useAnimTimer !== "undefined" && useAnimTimer > 0;
        const isDevMixMode = !isClone && typeof window.devMixMode !== "undefined" && window.devMixMode;
        const isDevOverride = !isClone && !isDevMixMode && typeof window.devForceAnimation === "string" && window.devForceAnimation !== "Auto" && window.devForceAnimation !== "";

        const isRagdoll = !isClone && typeof ragdollEnabled !== "undefined" && ragdollEnabled && typeof ragdollInitialized !== "undefined" && ragdollInitialized;
        if (!isRagdoll && typeof window.charRagdollTime !== "undefined") {
          window.charRagdollTime = 0;
        }

        // 1. Determine Lower Body / Locomotion Animation
        let lowerAnimName = "01a090e9-3d6d-7643-a07b-75e0e18cdc29"; // Default idle
        if (isDevOverride) {
          lowerAnimName = window.devForceAnimation;
        } else if (isDevMixMode && window.devMixLowerAnim) {
          lowerAnimName = window.devMixLowerAnim;
        } else if (isRagdoll) {
          lowerAnimName = model.getAnimation("01a09186-787b-771f-b4ee-5b234572bcef") ? "01a09186-787b-771f-b4ee-5b234572bcef" : "Jump_with_Arms_Open";
        } else if (isRiding) {
          lowerAnimName = "01a090f9-e47a-7144-abc9-bc9fcc7af00e";
        } else if (inWater) {
          // Default Swimming Animations for Chibi White: Swim_Forward when moving, Swim_Idle when floating
          if (isMovingActive || (typeof swimMovementFactor !== "undefined" && swimMovementFactor > 0.15)) {
            lowerAnimName = "Swim_Forward";
          } else {
            lowerAnimName = "Swim_Idle";
          }
        } else if (isAirborne) {
          lowerAnimName = "Jump_with_Arms_Open";
        } else if (isMovingActive || (isClone && cloneWalkBlend > 0.05)) {
          lowerAnimName = isSprintingActive ? "Running" : "Walking";
        }

        // 2. Determine Upper Body Animation & Target Weight
        let upperAnimName = null;
        let targetUpperWeight = 0.0;
        if (isDevMixMode) {
          upperAnimName = window.devMixUpperAnim || "01a090f8-8c8f-75dc-8693-155f9574dac7";
          targetUpperWeight = typeof window.devMixUpperWeight === "number" ? window.devMixUpperWeight : 1.0;
        } else if (isItemAction) {
          if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
            upperAnimName = "01a09186-787b-771f-b4ee-5b234572bcef";
          } else {
            upperAnimName = "01a090f8-8c8f-75dc-8693-155f9574dac7";
          }
          targetUpperWeight = 1.0;
        }

        if (isRagdoll) {
          upperAnimName = null;
          targetUpperWeight = 0.0;
        }

        // 3. Smooth blend weight for upper body (immediate attack, 150ms decay)
        if (typeof window.chibiUpperWeight === "undefined") window.chibiUpperWeight = 0.0;
        if (isItemAction) {
          window.chibiUpperWeight = 1.0;
        } else if (isDevMixMode) {
          window.chibiUpperWeight = targetUpperWeight;
        } else if (window.chibiUpperWeight > 0.0) {
          window.chibiUpperWeight = Math.max(0.0, window.chibiUpperWeight - dt / 0.15);
        }

        const isLayerMixing = !isClone && window.chibiUpperWeight > 0.001 && upperAnimName;

        // 4. Calculate Lower Body Playback Time
        const lowerAnim = model.getAnimation(lowerAnimName) || model.getAnimation("01a090e9-3d6d-7643-a07b-75e0e18cdc29") || model.getAnimation("restpose");
        let lowerAnimTime = 0.0;
        
        if (lowerAnim && lowerAnim.duration > 0) {
          if (isDevOverride) {
            // Apply custom animation player logic
            if (window.devAnimIsPlaying && !isClone) {
              const now = performance.now() / 1000.0;
              if (!window.devAnimLastUpdate) window.devAnimLastUpdate = now;
              
              if (now !== window.devAnimLastUpdate) {
                const deltaT = now - window.devAnimLastUpdate;
                window.devAnimLastUpdate = now;
                
                window.devAnimCurrentTime += Math.min(deltaT, 0.1);
                
                if (window.devAnimCurrentTime >= window.devAnimEndTime) {
                  window.devLoopCrossfadeFactor = 0.0;
                  window.devAnimCurrentTime = window.devAnimStartTime + (window.devAnimCurrentTime - window.devAnimEndTime);
                }
                
                if (typeof document !== "undefined") {
                  const lbl = document.getElementById("devAnimTimeLabel");
                  const sldr = document.getElementById("devAnimScrubSlider");
                  if (lbl) lbl.innerText = window.devAnimCurrentTime.toFixed(2) + "s / " + window.devAnimDuration.toFixed(2) + "s";
                  if (sldr && window.devAnimDuration > 0) {
                    sldr.value = (window.devAnimCurrentTime / window.devAnimDuration) * 1000;
                  }
                }
              }
            }
            lowerAnimTime = window.devAnimCurrentTime;
          } else if (lowerAnimName === "Swim_Idle") {
            const idleDur = lowerAnim.duration || 3.067;
            if (typeof window.charSwimIdleTime === "undefined") window.charSwimIdleTime = 0;
            if (typeof window.charSwimIdleLastUpdate === "undefined") window.charSwimIdleLastUpdate = performance.now() * 0.001;
            
            if (typeof window.charLastAnimName === "undefined") window.charLastAnimName = lowerAnimName;
            if (window.charLastAnimName !== lowerAnimName) {
              window.charSwimIdleTime = 0;
              window.charLastAnimName = lowerAnimName;
            }
            
            const now = performance.now() * 0.001;
            const deltaT = now - window.charSwimIdleLastUpdate;
            window.charSwimIdleLastUpdate = now;
            
            window.charSwimIdleTime = (window.charSwimIdleTime + Math.min(deltaT, 0.1)) % idleDur;
            lowerAnimTime = window.charSwimIdleTime;
          } else if (lowerAnimName === "Swim_Forward") {
            // Forward swim stroke speed
            lowerAnimTime = ((phase / (Math.PI * 2)) * lowerAnim.duration) % lowerAnim.duration;
            if (lowerAnimTime < 0) lowerAnimTime += lowerAnim.duration;
          } else if (lowerAnimName === "01a09186-787b-771f-b4ee-5b234572bcef") {
            if (typeof window.charRagdollTime === "undefined") window.charRagdollTime = 0;
            window.charRagdollTime = Math.min(lowerAnim.duration - 0.05, window.charRagdollTime + dt * 1.5);
            lowerAnimTime = window.charRagdollTime;
          } else if (lowerAnimName === "Jump_with_Arms_Open") {
            lowerAnimTime = Math.min(lowerAnim.duration, window.charJumpAnimTime || 1.35);
          } else if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29" || lowerAnimName === "restpose" || lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") {
            let idleDur = lowerAnim.duration;
            if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29") idleDur = Math.min(2.98, lowerAnim.duration);
            if (lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") idleDur = Math.min(1.10, lowerAnim.duration);
            
            if (typeof window.charIdleTime === "undefined") window.charIdleTime = 0;
            if (typeof window.charIdleLastUpdate === "undefined") window.charIdleLastUpdate = performance.now() * 0.001;
            
            if (typeof window.charLastAnimName === "undefined") window.charLastAnimName = lowerAnimName;
            if (window.charLastAnimName !== lowerAnimName) {
              window.charIdleTime = 0;
              window.charLastAnimName = lowerAnimName;
            }
            
            const now = performance.now() * 0.001;
            const deltaT = now - window.charIdleLastUpdate;
            window.charIdleLastUpdate = now;
            
            window.charIdleTime = (window.charIdleTime + Math.min(deltaT, 0.1)) % idleDur;
            lowerAnimTime = window.charIdleTime;
          } else {
            lowerAnimTime = ((phase / (Math.PI * 2)) * lowerAnim.duration) % lowerAnim.duration;
            if (lowerAnimTime < 0) lowerAnimTime += lowerAnim.duration;
          }
        }

        // 5. Calculate Upper Body Playback Time
        let upperAnimTime = 0.0;
        if (upperAnimName) {
          const uAnim = model.getAnimation(upperAnimName);
          if (uAnim && uAnim.duration > 0) {
            if (isDevMixMode) {
              if (typeof window.devMixUpperTime === "number") {
                upperAnimTime = window.devMixUpperTime % uAnim.duration;
              } else {
                upperAnimTime = ((performance.now() * 0.001) % uAnim.duration);
              }
            } else if (isItemAction) {
              if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
                // Animation 01a09186-787b-771f-b4ee-5b234572bcef trimmed Start: 1.40s, End: 2.47s (duration 1.07s)
                const animDuration = 2.47 - 1.40;
                const p = Math.max(0.0, Math.min(1.0, 1.0 - (useAnimTimer / animDuration)));
                upperAnimTime = 1.40 + p * (2.47 - 1.40);
              } else {
                const toolDur = Math.min(2.98, uAnim.duration);
                upperAnimTime = Math.max(0.0, Math.min(1.0, 1.0 - useAnimTimer)) * toolDur;
              }
              window.chibiLastUpperAnimTime = upperAnimTime;
            } else if (upperAnimName === "Jump_with_Arms_Open") {
              upperAnimTime = Math.min(uAnim.duration, window.charJumpAnimTime || 1.35);
            } else {
              upperAnimTime = window.chibiLastUpperAnimTime || Math.min(2.98, uAnim.duration);
            }
          }
        }

        // 6. Handle Locomotion Crossfade State on Lower Body
        if (!isClone) {
          if (typeof window.charTargetAnimName === "undefined") window.charTargetAnimName = lowerAnimName;
          
          if (window.charTargetAnimName !== lowerAnimName) {
            window.charPrevAnimName = window.charTargetAnimName;
            window.charPrevAnimTime = window.charTargetAnimTime || lowerAnimTime;
            window.charTargetAnimName = lowerAnimName;
            window.charCrossfadeFactor = 0.0;
          }
          window.charTargetAnimTime = lowerAnimTime;
        }

        // 7. Update Procedural Virtual Bone Hair Spring Physics before skinning
        if (!isClone && typeof updateChibiVirtualHair === "function") {
          updateChibiVirtualHair(model, isMovingActive, isSprintingActive, phase, dt);
        }

        // 7.1 Update Hand Pose & Finger Controls (กำมือ, แบมือ, แยกนิ้ว)
        if (!isClone && typeof updateChibiHandPose === "function") {
          updateChibiHandPose(model, heldItem, isItemAction);
        }

        // 8. Sample and Mesh Skinning
        let skinned = null;

        if (isLayerMixing) {
          // Layered mixing: legs & locomotion stay on lowerAnim, upper body blends into upperAnim
          const hipsBlend = (upperAnimName === "Jump_with_Arms_Open") ? 0.0 : (isMovingActive ? 0.0 : 0.35);

          if (!isClone && typeof window.charCrossfadeFactor !== "undefined" && window.charCrossfadeFactor < 1.0 && window.charPrevAnimName) {
            skinned = model.getSkinnedMeshMixed({
              lowerAnim1: window.charPrevAnimName,
              lowerTime1: window.charPrevAnimTime,
              lowerAnim2: lowerAnimName,
              lowerTime2: lowerAnimTime,
              lowerBlend: window.charCrossfadeFactor,
              upperAnim: upperAnimName,
              upperTime: upperAnimTime,
              upperWeight: window.chibiUpperWeight,
              hipsBlend: hipsBlend,
              loop: true
            });
            window.charCrossfadeFactor += dt / 0.15;
            window.charPrevAnimTime += dt;
          } else {
            skinned = model.getSkinnedMeshLayered(
              lowerAnimName,
              lowerAnimTime,
              upperAnimName,
              upperAnimTime,
              window.chibiUpperWeight,
              true,
              hipsBlend
            );
          }
        } 
        else if (!isClone && typeof window.charCrossfadeFactor !== "undefined" && window.charCrossfadeFactor < 1.0) {
          skinned = model.getSkinnedMeshBlended(window.charPrevAnimName, window.charPrevAnimTime, lowerAnimName, lowerAnimTime, window.charCrossfadeFactor, true);
          window.charCrossfadeFactor += dt / 0.15; // 150ms crossfade
          window.charPrevAnimTime += dt;
        } 
        else if (!isClone && isDevOverride && typeof window.devLoopCrossfadeFactor !== "undefined" && window.devLoopCrossfadeFactor < 1.0) {
          // Trim loop crossfading (blend End -> Start)
          const prevTime = window.devAnimEndTime; // hold at end pose
          skinned = model.getSkinnedMeshBlended(lowerAnimName, prevTime, lowerAnimName, lowerAnimTime, window.devLoopCrossfadeFactor, true);
          window.devLoopCrossfadeFactor += dt / 0.2; // 200ms crossfade
        } 
        else if (!isClone && (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29" || lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e" || lowerAnimName === "Swim_Idle") && typeof window.charIdleCrossfade !== "undefined" && window.charIdleCrossfade < 1.0) {
          let idleDur = lowerAnim.duration;
          if (lowerAnimName === "01a090e9-3d6d-7643-a07b-75e0e18cdc29") idleDur = Math.min(2.98, lowerAnim.duration);
          if (lowerAnimName === "01a090f9-e47a-7144-abc9-bc9fcc7af00e") idleDur = Math.min(1.10, lowerAnim.duration);
          if (lowerAnimName === "Swim_Idle") idleDur = lowerAnim.duration;
          skinned = model.getSkinnedMeshBlended(lowerAnimName, idleDur, lowerAnimName, lowerAnimTime, window.charIdleCrossfade, true);
          window.charIdleCrossfade += dt / 0.2; // 200ms crossfade
        }
        else {
          skinned = model.getSkinnedMesh(lowerAnimName, lowerAnimTime, true);
        }

        if (!skinned || !skinned.positions) return null;

        const vCount = skinned.positions.length / 3;
        const positions = skinned.positions;
        const normals = skinned.normals;
        const modelColors = skinned.colors;

        const scale = 0.59;
        let yOffset = -0.46;

        if (!isClone && typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
          yOffset = -0.15;
        } else if (!isClone && typeof activeRidingMech !== "undefined" && activeRidingMech) {
          yOffset = -0.15;
        } else if (!isClone && typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) {
          yOffset = -0.46 - currentSwimFactor * 0.12;
        }

        if (!_glbCachedVertices || _glbCachedVertices.length !== vCount * 3) {
          _glbCachedVertices = new Float32Array(vCount * 3);
          _glbCachedNormals = new Float32Array(vCount * 3);
          _glbCachedColors = new Float32Array(vCount * 3);
        }
        const outVertices = _glbCachedVertices;
        const outNormals = _glbCachedNormals;
        const outColors = _glbCachedColors;
        const outTexCoords = skinned.texcoords;

        const colorByParts = typeof window !== "undefined" && !!window.devColorByParts;
        const partVis = (typeof window !== "undefined" && window.devPartVisibility) ? window.devPartVisibility : null;
        const selectedBone = (typeof window !== "undefined") ? window.devSelectedBone : null;
        const hasHiddenParts = partVis ? Object.values(partVis).some(v => v === false) : false;
        const partGroups = model.vertexPartGroups;
        const dominantBones = model.vertexDominantBones;
        const selectedBoneNodeIdx = (selectedBone && model.nodes)
          ? model.nodes.findIndex(n => n && n.name === selectedBone)
          : -1;

        if (!colorByParts && !hasHiddenParts && selectedBoneNodeIdx === -1) {
          // Fast-path for production gameplay: direct flat transforms without dev branching
          for (let i = 0; i < vCount; i++) {
            const i3 = i * 3;
            outVertices[i3] = positions[i3] * scale;
            outVertices[i3 + 1] = positions[i3 + 1] * scale + yOffset;
            outVertices[i3 + 2] = positions[i3 + 2] * scale;
            outNormals[i3] = normals[i3];
            outNormals[i3 + 1] = normals[i3 + 1];
            outNormals[i3 + 2] = normals[i3 + 2];
            if (modelColors && modelColors.length >= (i + 1) * 3) {
              outColors[i3] = modelColors[i3];
              outColors[i3 + 1] = modelColors[i3 + 1];
              outColors[i3 + 2] = modelColors[i3 + 2];
            } else {
              outColors[i3] = 1.0;
              outColors[i3 + 1] = 1.0;
              outColors[i3 + 2] = 1.0;
            }
          }
        } else {
          // Debug / Dev visualizer path
          const partPalette = [
            [1.0, 0.43, 0.25], // 0: Head (Coral)
            [0.0, 0.69, 1.0],  // 1: Torso (Cyan)
            [0.0, 0.90, 0.46], // 2: Left Arm (Green)
            [1.0, 0.67, 0.0],  // 3: Right Arm (Gold)
            [0.83, 0.0, 0.98], // 4: Left Leg (Purple)
            [1.0, 0.09, 0.27], // 5: Right Leg (Pink/Red)
            [0.88, 0.25, 0.98]  // 6: Ponytail Hair (Magenta/Violet)
          ];
          const partKeys = ["head", "torso", "left_arm", "right_arm", "left_leg", "right_leg", "hair"];

          for (let i = 0; i < vCount; i++) {
            const i3 = i * 3;
            const pGroup = partGroups ? partGroups[i] : 1;
            const pKey = partKeys[pGroup] || "torso";

            if (partVis && partVis[pKey] === false) {
              outVertices[i3] = 0;
              outVertices[i3 + 1] = -9999;
              outVertices[i3 + 2] = 0;
            } else {
              outVertices[i3] = positions[i3] * scale;
              outVertices[i3 + 1] = positions[i3 + 1] * scale + yOffset;
              outVertices[i3 + 2] = positions[i3 + 2] * scale;
            }

            outNormals[i3] = normals[i3];
            outNormals[i3 + 1] = normals[i3 + 1];
            outNormals[i3 + 2] = normals[i3 + 2];

            if (selectedBoneNodeIdx !== -1 && dominantBones && dominantBones[i] === selectedBoneNodeIdx) {
              outColors[i3] = 1.0;
              outColors[i3 + 1] = 0.95;
              outColors[i3 + 2] = 0.15;
            } else if (colorByParts && partGroups) {
              const col = partPalette[pGroup] || [0.9, 0.9, 0.9];
              const shade = 0.85 + Math.max(0, normals[i3 + 1]) * 0.15;
              outColors[i3] = col[0] * shade;
              outColors[i3 + 1] = col[1] * shade;
              outColors[i3 + 2] = col[2] * shade;
            } else if (selectedBoneNodeIdx !== -1) {
              outColors[i3] = 0.35;
              outColors[i3 + 1] = 0.38;
              outColors[i3 + 2] = 0.42;
            } else if (modelColors && modelColors.length >= (i + 1) * 3) {
              outColors[i3] = modelColors[i3];
              outColors[i3 + 1] = modelColors[i3 + 1];
              outColors[i3 + 2] = modelColors[i3 + 2];
            } else {
              outColors[i3] = 1.0;
              outColors[i3 + 1] = 1.0;
              outColors[i3 + 2] = 1.0;
            }
          }
        }

        return {
          vertices: outVertices,
          normals: outNormals,
          colors: outColors,
          texcoords: outTexCoords,
          indices: skinned.indices
        };
      }

      function uploadDynamicBuffer(targetGl, buf, target, data) {
        targetGl.bindBuffer(target, buf);
        if (buf._allocByteLength === data.byteLength) {
          targetGl.bufferSubData(target, 0, data);
        } else {
          targetGl.bufferData(target, data, targetGl.DYNAMIC_DRAW);
          buf._allocByteLength = data.byteLength;
        }
      }

      function buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale = 1.0) {
        const dir = [pHand[0] - pElbow[0], pHand[1] - pElbow[1], pHand[2] - pElbow[2]];
        const armLen = Math.hypot(dir[0], dir[1], dir[2]) || 0.1;
        dir[0] /= armLen; dir[1] /= armLen; dir[2] /= armLen;

        const pRear = [pElbow[0] + dir[0] * 0.015, pElbow[1] + dir[1] * 0.015, pElbow[2] + dir[2] * 0.015];
        const pMid = [pElbow[0] + dir[0] * (armLen * 0.75), pElbow[1] + dir[1] * (armLen * 0.75), pElbow[2] + dir[2] * (armLen * 0.75)];
        const pMuzzle = [pHand[0] + dir[0] * 0.065, pHand[1] + dir[1] * 0.065, pHand[2] + dir[2] * 0.065];
        const pBoreIn = [pMuzzle[0] - dir[0] * 0.035, pMuzzle[1] - dir[1] * 0.035, pMuzzle[2] - dir[2] * 0.035];

        const woodColorMain = [0.55, 0.38, 0.22];
        const woodColorDark = [0.42, 0.28, 0.15];
        const ironColor = [0.28, 0.28, 0.30];
        const darkMuzzleColor = [0.22, 0.22, 0.24];
        const innerBoreColor = [0.10, 0.10, 0.10];

        // 1. Main wooden forearm sleeve and barrel body (faceted 6-sided low-poly cylinder)
        buildTaperedSegment(pRear, pMid, 0.037 * itemScale, 0.033 * itemScale, 6, woodColorMain, rawV, rawC, rawI);
        buildTaperedSegment(pMid, pMuzzle, 0.033 * itemScale, 0.036 * itemScale, 6, woodColorDark, rawV, rawC, rawI);

        // 2. Rear reinforcement iron ring
        const pRearBand = [pRear[0] + dir[0] * 0.015, pRear[1] + dir[1] * 0.015, pRear[2] + dir[2] * 0.015];
        buildTaperedSegment(pRear, pRearBand, 0.040 * itemScale, 0.039 * itemScale, 6, ironColor, rawV, rawC, rawI);

        // 3. Mid reinforcement iron ring clamp
        const pMidBand1 = [pMid[0] - dir[0] * 0.008, pMid[1] - dir[1] * 0.008, pMid[2] - dir[2] * 0.008];
        const pMidBand2 = [pMid[0] + dir[0] * 0.008, pMid[1] + dir[1] * 0.008, pMid[2] + dir[2] * 0.008];
        buildTaperedSegment(pMidBand1, pMidBand2, 0.036 * itemScale, 0.036 * itemScale, 6, ironColor, rawV, rawC, rawI);

        // 4. Front iron muzzle collar
        const pMuzzleRing = [pMuzzle[0] - dir[0] * 0.012, pMuzzle[1] - dir[1] * 0.012, pMuzzle[2] - dir[2] * 0.012];
        buildTaperedSegment(pMuzzleRing, pMuzzle, 0.039 * itemScale, 0.039 * itemScale, 6, darkMuzzleColor, rawV, rawC, rawI);

        // 5. Inner dark hollow cannon bore
        buildTaperedSegment(pBoreIn, pMuzzle, 0.022 * itemScale, 0.024 * itemScale, 6, innerBoreColor, rawV, rawC, rawI);

        // 6. Arrow in barrel when aiming/ready
        if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
          const arrowTip = [pMuzzle[0] + dir[0] * 0.04 * itemScale, pMuzzle[1] + dir[1] * 0.04 * itemScale, pMuzzle[2] + dir[2] * 0.04 * itemScale];
          const arrowShaftEnd = [pMuzzle[0] - dir[0] * 0.06 * itemScale, pMuzzle[1] - dir[1] * 0.06 * itemScale, pMuzzle[2] - dir[2] * 0.06 * itemScale];
          buildTaperedSegment(arrowShaftEnd, arrowTip, 0.005 * itemScale, 0.005 * itemScale, 4, [0.55, 0.4, 0.25], rawV, rawC, rawI);

          const arrowHeadTip = [arrowTip[0] + dir[0] * 0.025 * itemScale, arrowTip[1] + dir[1] * 0.025 * itemScale, arrowTip[2] + dir[2] * 0.025 * itemScale];
          buildTaperedSegment(arrowTip, arrowHeadTip, 0.012 * itemScale, 0.001 * itemScale, 4, [0.35, 0.35, 0.35], rawV, rawC, rawI);
        }

        // Set firing origin and direction in world space
        if (typeof getCharacterMatrix === "function") {
          const charMat = getCharacterMatrix();
          window.lastBowGripPos = [
            charMat[0] * pMuzzle[0] + charMat[4] * pMuzzle[1] + charMat[8] * pMuzzle[2] + charMat[12],
            charMat[1] * pMuzzle[0] + charMat[5] * pMuzzle[1] + charMat[9] * pMuzzle[2] + charMat[13],
            charMat[2] * pMuzzle[0] + charMat[6] * pMuzzle[1] + charMat[10] * pMuzzle[2] + charMat[14]
          ];
          const aimX = charMat[0] * dir[0] + charMat[4] * dir[1] + charMat[8] * dir[2];
          const aimY = charMat[1] * dir[0] + charMat[5] * dir[1] + charMat[9] * dir[2];
          const aimZ = charMat[2] * dir[0] + charMat[6] * dir[1] + charMat[10] * dir[2];
          const aLen = Math.hypot(aimX, aimY, aimZ);
          if (aLen > 1e-4) {
            window.lastBowAimDir = [aimX / aLen, aimY / aLen, aimZ / aLen];
          } else {
            window.lastBowAimDir = [aimX, aimY, aimZ];
          }
        }
      }

      function updateChibiEquipMesh() {
        const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
        if (!activeGl) return;
        if (typeof gl === "undefined" || !gl) gl = activeGl;
        const heldItem = (typeof window.getHeldItem === "function" ? window.getHeldItem() : (typeof getHeldItem === "function" ? getHeldItem() : null));
        if (!heldItem || !window.chibiGlbModel || !window.chibiGlbModel.nodes) {
          equipIndicesLength = 0;
          return;
        }
        const model = window.chibiGlbModel;
        const rawV = [], rawC = [], rawI = [];
        const itemScale = (typeof playerScale !== 'undefined' ? playerScale : 0.1) / 0.1;
        const scale = 0.59;
        let yOffset = -0.46;
        if (typeof activeRidingBoat !== "undefined" && activeRidingBoat) yOffset = -0.15;
        else if (typeof activeRidingMech !== "undefined" && activeRidingMech) yOffset = -0.15;
        else if (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0) yOffset = -0.46 - currentSwimFactor * 0.12;

        if (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON") {
          const rFA = model.nodes.find(n => n && n.name === "RightForeArm");
          const rH = model.nodes.find(n => n && n.name === "RightHand");
          if (rFA && rH && rFA.matrix && rH.matrix) {
            const pElbow = [ rFA.matrix[12] * scale, rFA.matrix[13] * scale + yOffset, rFA.matrix[14] * scale ];
            let pHand  = [ rH.matrix[12] * scale,  rH.matrix[13] * scale + yOffset,  rH.matrix[14] * scale ];

            // When aiming, align arm cannon direction precisely towards window.currentAimTargetPos
            const isAimingRanged = (typeof isUsingItem !== "undefined" && isUsingItem) && (typeof window.isAimingBow !== "undefined" && window.isAimingBow);
            if (isAimingRanged && window.currentAimTargetPos && typeof getCharacterMatrix === "function") {
              const charMat = getCharacterMatrix();
              const pElbowWorld = [
                charMat[0] * pElbow[0] + charMat[4] * pElbow[1] + charMat[8] * pElbow[2] + charMat[12],
                charMat[1] * pElbow[0] + charMat[5] * pElbow[1] + charMat[9] * pElbow[2] + charMat[13],
                charMat[2] * pElbow[0] + charMat[6] * pElbow[1] + charMat[10] * pElbow[2] + charMat[14]
              ];
              const tPos = window.currentAimTargetPos;
              const dW = [tPos[0] - pElbowWorld[0], tPos[1] - pElbowWorld[1], tPos[2] - pElbowWorld[2]];
              const dDist = Math.hypot(dW[0], dW[1], dW[2]);
              if (dDist > 0.01) {
                const normW = [dW[0] / dDist, dW[1] / dDist, dW[2] / dDist];
                const cScale = (typeof playerScale === "number") ? playerScale : 0.1;
                const cR = [charMat[0] / cScale, charMat[1] / cScale, charMat[2] / cScale];
                const cUp = [charMat[4] / cScale, charMat[5] / cScale, charMat[6] / cScale];
                const cFwd = [charMat[8] / cScale, charMat[9] / cScale, charMat[10] / cScale];

                const aimLocal = [
                  normW[0] * cR[0] + normW[1] * cR[1] + normW[2] * cR[2],
                  normW[0] * cUp[0] + normW[1] * cUp[1] + normW[2] * cUp[2],
                  normW[0] * cFwd[0] + normW[1] * cFwd[1] + normW[2] * cFwd[2]
                ];
                const aL = Math.hypot(aimLocal[0], aimLocal[1], aimLocal[2]);
                if (aL > 0.001) {
                  aimLocal[0] /= aL; aimLocal[1] /= aL; aimLocal[2] /= aL;
                  const armLen = Math.hypot(rH.matrix[12] * scale - rFA.matrix[12] * scale, rH.matrix[13] * scale - rFA.matrix[13] * scale, rH.matrix[14] * scale - rFA.matrix[14] * scale) || (0.13 * scale);
                  pHand = [
                    pElbow[0] + aimLocal[0] * armLen,
                    pElbow[1] + aimLocal[1] * armLen,
                    pElbow[2] + aimLocal[2] * armLen
                  ];
                }
              }
            }

            buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale);
          }
        }

        if (rawI.length > 0) {
          const flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
          equipIndicesLength = flatEquip.indices.length;

          if (!equipVertexBuffer) equipVertexBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, equipVertexBuffer, gl.ARRAY_BUFFER, flatEquip.vertices instanceof Float32Array ? flatEquip.vertices : new Float32Array(flatEquip.vertices));

          if (!equipColorBuffer) equipColorBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, equipColorBuffer, gl.ARRAY_BUFFER, flatEquip.colors instanceof Float32Array ? flatEquip.colors : new Float32Array(flatEquip.colors));

          if (!equipNormalBuffer) equipNormalBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, equipNormalBuffer, gl.ARRAY_BUFFER, flatEquip.normals instanceof Float32Array ? flatEquip.normals : new Float32Array(flatEquip.normals));

          if (!equipIndexBuffer) equipIndexBuffer = gl.createBuffer();
          if (equipIndexBuffer._uploadedCount !== equipIndicesLength) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
            const idxData = (supportUint32 && equipIndicesLength > 65535)
              ? (flatEquip.indices instanceof Uint32Array ? flatEquip.indices : new Uint32Array(flatEquip.indices))
              : (flatEquip.indices instanceof Uint16Array ? flatEquip.indices : new Uint16Array(flatEquip.indices));
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
            equipIndexBuffer._uploadedCount = equipIndicesLength;
          }
        } else {
          equipIndicesLength = 0;
        }
      }

      function updateCharacterMesh(phase, isClone = false, cloneWalkBlend = 1.0, cloneSwimFactor = 0.0, cloneSwimMove = 0.0) {
        const activeGl = (typeof gl !== "undefined" && gl) || (typeof window !== "undefined" && window.gl ? window.gl : null);
        if (!activeGl) return;
        if (typeof gl === "undefined" || !gl) gl = activeGl;
        if (typeof window !== "undefined" && window.characterModel === "chibi" && !isClone) {
          if (!window.chibiGlbTexture && typeof window.createChibiGlbTexture === "function") {
            window.createChibiGlbTexture(activeGl);
          }
          const glbData = getGlbCharacterMeshData(phase, isClone, cloneWalkBlend);
          if (glbData) {
            if (typeof window !== 'undefined') {
              window.charIndicesLength = glbData.indices.length;
              charIndicesLength = window.charIndicesLength;
            }
            charRawVertices = glbData.vertices;

            if (!charVertexBuffer) charVertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, charVertexBuffer, gl.ARRAY_BUFFER, glbData.vertices);

            if (!charLocalVertexBuffer) charLocalVertexBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, charLocalVertexBuffer, gl.ARRAY_BUFFER, glbData.vertices);

            if (!charNormalBuffer) charNormalBuffer = gl.createBuffer();
            uploadDynamicBuffer(gl, charNormalBuffer, gl.ARRAY_BUFFER, glbData.normals);

            const isDevColorOrBone = !!(typeof window !== "undefined" && (window.devColorByParts || window.devSelectedBone));
            if (!charColorBuffer) charColorBuffer = gl.createBuffer();
            if (charColorBuffer._sourceType !== "chibi" || isDevColorOrBone || charColorBuffer._lastIsDevColor) {
              uploadDynamicBuffer(gl, charColorBuffer, gl.ARRAY_BUFFER, glbData.colors);
              charColorBuffer._sourceType = "chibi";
              charColorBuffer._lastIsDevColor = isDevColorOrBone;
            }

            if (glbData.texcoords) {
              if (typeof window.charTexCoordBuffer === "undefined" || !window.charTexCoordBuffer) {
                window.charTexCoordBuffer = gl.createBuffer();
              }
              if (window.charTexCoordBuffer._sourceType !== "chibi") {
                gl.bindBuffer(gl.ARRAY_BUFFER, window.charTexCoordBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, glbData.texcoords, gl.STATIC_DRAW);
                window.charTexCoordBuffer._sourceType = "chibi";
              }
            }

            if (!charIndexBuffer) charIndexBuffer = gl.createBuffer();
            if (charIndexBuffer._uploadedCount !== charIndicesLength || charIndexBuffer._sourceType !== "chibi") {
              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
              const idxData = (supportUint32 && charIndicesLength > 65535)
                ? (glbData.indices instanceof Uint32Array ? glbData.indices : new Uint32Array(glbData.indices))
                : (glbData.indices instanceof Uint16Array ? glbData.indices : new Uint16Array(glbData.indices));
              gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
              charIndexBuffer._uploadedCount = charIndicesLength;
              charIndexBuffer._sourceType = "chibi";
            }
            updateChibiEquipMesh();
            return;
          }
        }

        resetCapsuleBufferPool();
        resetMergeBufferPool();

        const heldItem = isClone ? null : getHeldItem();
        let chestP1,
          chestP2,
          pelvisP1,
          pelvisP2,
          neckP1,
          neckP2,
          headP1,
          headP2,
          leftEarP1,
          leftEarP2,
          rightEarP1,
          rightEarP2;
        let leftArmPivot, leftElbowRot, leftHandRot;
        let rightArmPivot, rightElbowRot, rightHandRot;
        let leftLegPivot, leftKneeRot, leftFootRot;
        let rightLegPivot, rightKneeRot, rightFootRot;

        const bOffset = ragdollEnabled
          ? 0.0
          : Math.sin(waterAnimTime * 2.5) * 0.006;
        const bRadius = ragdollEnabled
          ? 0.0
          : Math.sin(waterAnimTime * 2.5) * 0.002;

        let torsoTilt = 0.0;
        const walkScale = isClone ? cloneWalkBlend : 1.0;
        let armAngle = Math.sin(phase) * 0.8 * walkScale;
        let leftElbowFlex = 0.1 + Math.max(0, -armAngle * 0.5);
        let rightArmAngle = Math.sin(phase + Math.PI) * 0.8 * walkScale;
        let rightElbowFlex = 0.1 + Math.max(0, -rightArmAngle * 0.5);

        let legAngle = Math.sin(phase + Math.PI) * 0.6 * walkScale;
        let leftKneeFlex = 0.1 + Math.max(0, legAngle * 0.5);
        let rightLegAngle = Math.sin(phase) * 0.6 * walkScale;
        let rightKneeFlex = 0.1 + Math.max(0, rightLegAngle * 0.5);

        if (!isClone && typeof activeRidingBoat !== "undefined" && activeRidingBoat) {
          // Sitting and rowing pose
          let isLandVehicle = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
          if (isLandVehicle) {
            armAngle = -0.4;
            leftElbowFlex = 0.5;
            rightArmAngle = -0.4;
            rightElbowFlex = 0.5;
            torsoTilt = 0;
          } else {
            const rowPhase = typeof boatRowTimer !== "undefined" ? boatRowTimer : 0;
            armAngle = Math.sin(rowPhase) * 0.5 - 0.5; // Arms forward and back
            leftElbowFlex = 0.3 + Math.cos(rowPhase) * 0.2;
            rightArmAngle = Math.sin(rowPhase) * 0.5 - 0.5; // Synchronized in-phase pull
            rightElbowFlex = 0.3 + Math.cos(rowPhase) * 0.2;
            torsoTilt = Math.sin(rowPhase) * 0.25; // Leaning forward and backward with rowing phase
          }
          
          legAngle = -1.5; // Legs forward (sitting)
          leftKneeFlex = 1.0; // Knees bent
          rightLegAngle = -1.5;
          rightKneeFlex = 1.0;
        } else if (!isClone && typeof activeRidingMech !== "undefined" && activeRidingMech) {
          // Pilot sitting pose inside Mech Cockpit
          armAngle = -0.4;
          leftElbowFlex = 0.5;
          rightArmAngle = -0.4;
          rightElbowFlex = 0.5;
          
          torsoTilt = 0.05;
          
          legAngle = -1.5; // Legs forward (sitting)
          leftKneeFlex = 1.1; // Knees bent down inside cockpit
          rightLegAngle = -1.5;
          rightKneeFlex = 1.1;
        } else if (!isClone && typeof ragdollEnabled !== "undefined" && ragdollEnabled && typeof ragdollLimbs !== "undefined" && ragdollLimbs) {
          armAngle = ragdollLimbs.aL;
          leftElbowFlex = ragdollLimbs.eL;
          rightArmAngle = ragdollLimbs.aR;
          rightElbowFlex = ragdollLimbs.eR;

          legAngle = ragdollLimbs.lL;
          leftKneeFlex = ragdollLimbs.kL;
          rightLegAngle = ragdollLimbs.lR;
          rightKneeFlex = ragdollLimbs.kR;
        } else {
          const effectiveSwimFactor = isClone
            ? (typeof cloneSwimFactor !== "undefined" ? cloneSwimFactor : (window.clonesGlobalSwimFactor || 0.0))
            : (typeof currentSwimFactor !== "undefined" ? currentSwimFactor : 0.0);
          const effectiveSwimMovement = isClone
            ? (typeof cloneSwimMove !== "undefined" ? cloneSwimMove : (window.clonesGlobalSwimMove || 0.0))
            : (typeof swimMovementFactor !== "undefined" ? swimMovementFactor : 0.0);

          if (effectiveSwimFactor > 0.0) {
            // --- LEFT ARM ---
            const treadLeftArm = 0.45 + Math.sin(waterAnimTime * 3.5) * 0.15;
            const treadLeftElbow = 0.55 + Math.cos(waterAnimTime * 3.5) * 0.1;

            const swimArm = Math.sin(phase * 1.5) * 1.0 + 1.2;
            const swimElbow = 0.2 + Math.cos(phase * 1.5) * 0.2;

            const combinedArm =
              treadLeftArm * (1.0 - effectiveSwimMovement) +
              swimArm * effectiveSwimMovement;
            const combinedElbow =
              treadLeftElbow * (1.0 - effectiveSwimMovement) +
              swimElbow * effectiveSwimMovement;

            armAngle =
              armAngle * (1.0 - effectiveSwimFactor) +
              combinedArm * effectiveSwimFactor;
            leftElbowFlex =
              leftElbowFlex * (1.0 - effectiveSwimFactor) +
              combinedElbow * effectiveSwimFactor;

            // --- RIGHT ARM ---
            const treadRightArm = 0.45 + Math.cos(waterAnimTime * 3.5) * 0.15;
            const treadRightElbow = 0.55 + Math.sin(waterAnimTime * 3.5) * 0.1;

            const swimRightArm = Math.sin(phase * 1.5 + Math.PI) * 1.0 + 1.2;
            const swimRightElbow = 0.2 + Math.cos(phase * 1.5 + Math.PI) * 0.2;

            const combinedRightArm =
              treadRightArm * (1.0 - effectiveSwimMovement) +
              swimRightArm * effectiveSwimMovement;
            const combinedRightElbow =
              treadRightElbow * (1.0 - effectiveSwimMovement) +
              swimRightElbow * effectiveSwimMovement;

            rightArmAngle =
              rightArmAngle * (1.0 - effectiveSwimFactor) +
              combinedRightArm * effectiveSwimFactor;
            rightElbowFlex =
              rightElbowFlex * (1.0 - effectiveSwimFactor) +
              combinedRightElbow * effectiveSwimFactor;

            // --- LEFT LEG ---
            const treadLeftLeg = 0.3 + Math.sin(waterAnimTime * 3.5) * 0.25;
            const treadLeftKnee = 0.5 + Math.cos(waterAnimTime * 3.5) * 0.2;

            const swimLeg = Math.sin(phase * 2.5) * 0.4;
            const swimKnee = 0.1 + Math.max(0, -swimLeg * 0.3);

            const combinedLeftLeg =
              treadLeftLeg * (1.0 - effectiveSwimMovement) +
              swimLeg * effectiveSwimMovement;
            const combinedLeftKnee =
              treadLeftKnee * (1.0 - effectiveSwimMovement) +
              swimKnee * effectiveSwimMovement;

            legAngle =
              legAngle * (1.0 - effectiveSwimFactor) +
              combinedLeftLeg * effectiveSwimFactor;
            leftKneeFlex =
              leftKneeFlex * (1.0 - effectiveSwimFactor) +
              combinedLeftKnee * effectiveSwimFactor;

            // --- RIGHT LEG ---
            const treadRightLeg = 0.3 - Math.sin(waterAnimTime * 3.5) * 0.25;
            const treadRightKnee = 0.5 - Math.cos(waterAnimTime * 3.5) * 0.2;

            const swimRightLeg = Math.sin(phase * 2.5 + Math.PI) * 0.4;
            const swimRightKnee = 0.1 + Math.max(0, -swimRightLeg * 0.3);

            const combinedRightLeg =
              treadRightLeg * (1.0 - effectiveSwimMovement) +
              swimRightLeg * effectiveSwimMovement;
            const combinedRightKnee =
              treadRightKnee * (1.0 - effectiveSwimMovement) +
              swimRightKnee * effectiveSwimMovement;

            rightLegAngle =
              rightLegAngle * (1.0 - effectiveSwimFactor) +
              combinedRightLeg * effectiveSwimFactor;
            rightKneeFlex =
              rightKneeFlex * (1.0 - effectiveSwimFactor) +
              combinedRightKnee * effectiveSwimFactor;
          }
        }
        
        if (!isClone && typeof jumpBlend !== "undefined" && jumpBlend > 0.0) {
            // Jumping or falling animation targets
            const targetArmAngle = Math.PI / 4;
            const targetLeftElbowFlex = 0.5;
            const targetRightArmAngle = Math.PI / 4;
            const targetRightElbowFlex = 0.5;
            
            // Map vertical velocity to leg extension (-0.02 to 0.02 approx)
            const velFactor = Math.max(-1.0, Math.min(1.0, playerVerticalVel * 50));
            const targetLegAngle = 0.05 + velFactor * 0.25;
            const targetLeftKneeFlex = 0.2 + (1 - velFactor) * 0.1;
            const targetRightLegAngle = -0.3 + velFactor * 0.2;
            const targetRightKneeFlex = 0.4 - velFactor * 0.2;
            
            // Interpolate
            armAngle = armAngle * (1.0 - jumpBlend) + targetArmAngle * jumpBlend;
            leftElbowFlex = leftElbowFlex * (1.0 - jumpBlend) + targetLeftElbowFlex * jumpBlend;
            rightArmAngle = rightArmAngle * (1.0 - jumpBlend) + targetRightArmAngle * jumpBlend;
            rightElbowFlex = rightElbowFlex * (1.0 - jumpBlend) + targetRightElbowFlex * jumpBlend;
            
            legAngle = legAngle * (1.0 - jumpBlend) + targetLegAngle * jumpBlend;
            leftKneeFlex = leftKneeFlex * (1.0 - jumpBlend) + targetLeftKneeFlex * jumpBlend;
            rightLegAngle = rightLegAngle * (1.0 - jumpBlend) + targetRightLegAngle * jumpBlend;
            rightKneeFlex = rightKneeFlex * (1.0 - jumpBlend) + targetRightKneeFlex * jumpBlend;
            
            torsoTilt = torsoTilt * (1.0 - jumpBlend) + (velFactor * 0.1) * jumpBlend;
        }
        
        if (heldItem) {
             if (heldItem.name === "BOW") {
                 if (isUsingItem && useAnimTimer > 0) {
                     armAngle = -1.57;
                     leftElbowFlex = 0.0;
                     rightArmAngle = 0;
                     rightElbowFlex = 0;
                 } else {
                     armAngle = -0.8;
                     leftElbowFlex = 0.3;
                     rightArmAngle = 0.2;
                     rightElbowFlex = 0.2;
                 }
             } else {
                 if (isUsingItem && useAnimTimer > 0) {
                     // Swing animation for axe / pickaxe / shovel / items
                     let swingPhase = useAnimTimer;
                     let targetArmAngle = 0;
                     let targetElbowFlex = 0;
                     if (swingPhase > 0.8) {
                         let t = (1.0 - swingPhase) / 0.2;
                         targetArmAngle = -1.5 * t;
                         targetElbowFlex = 0.5 * t;
                     } else if (swingPhase > 0.4) {
                         let t = (0.8 - swingPhase) / 0.4;
                         targetArmAngle = -1.5 + 2.5 * t;
                         targetElbowFlex = 0.5 - 0.4 * t;
                     } else {
                         let t = (0.4 - swingPhase) / 0.4;
                         targetArmAngle = 1.0 * (1.0 - t);
                         targetElbowFlex = 0.1 * (1.0 - t);
                     }
                     rightArmAngle = targetArmAngle;
                     rightElbowFlex = targetElbowFlex;
                 } else {
                     rightArmAngle = -0.3;
                     rightElbowFlex = 0.5;
                 }
             }
        }

        const isRiding = activeRidingBoat || (typeof activeRidingMech !== "undefined" && activeRidingMech);

        chestP1 = [0, 0.02 + bOffset, 0];
        let defaultChestP2 = [0, 0.17 + bOffset, 0];
        chestP2 = isRiding ? rotatePointX(chestP1, defaultChestP2, torsoTilt) : defaultChestP2;
        
        pelvisP1 = [0, -0.15, 0];
        pelvisP2 = [0, 0.02 + bOffset, 0];
        
        let defaultNeckP1 = [0, 0.17 + bOffset, 0];
        let defaultNeckP2 = [0, 0.23 + bOffset, 0];
        let defaultHeadP1 = [0, 0.43 + bOffset, 0];
        let defaultHeadP2 = [0, 0.43 + bOffset, 0];
        
        neckP1 = isRiding ? rotatePointX(chestP1, defaultNeckP1, torsoTilt) : defaultNeckP1;
        neckP2 = isRiding ? rotatePointX(chestP1, defaultNeckP2, torsoTilt) : defaultNeckP2;
        headP1 = isRiding ? rotatePointX(chestP1, defaultHeadP1, torsoTilt) : defaultHeadP1;
        headP2 = headP1;
        
        let defaultLeftEarP1 = [-0.21, 0.41 + bOffset, -0.01];
        let defaultLeftEarP2 = [-0.23, 0.408 + bOffset, -0.01];
        let defaultRightEarP1 = [0.21, 0.41 + bOffset, -0.01];
        let defaultRightEarP2 = [0.23, 0.408 + bOffset, -0.01];
        
        leftEarP1 = isRiding ? rotatePointX(chestP1, defaultLeftEarP1, torsoTilt) : defaultLeftEarP1;
        leftEarP2 = isRiding ? rotatePointX(chestP1, defaultLeftEarP2, torsoTilt) : defaultLeftEarP2;
        rightEarP1 = isRiding ? rotatePointX(chestP1, defaultRightEarP1, torsoTilt) : defaultRightEarP1;
        rightEarP2 = isRiding ? rotatePointX(chestP1, defaultRightEarP2, torsoTilt) : defaultRightEarP2;

        let defaultLeftArmPivot = [-0.09, 0.11 + bOffset, 0];
        let defaultLeftElbowBase = [-0.15, 0.01 + bOffset, -0.01];
        let defaultLeftHandBase = [-0.18, -0.09 + bOffset, 0.04];

        let defaultRightArmPivot = [0.09, 0.11 + bOffset, 0];
        let defaultRightElbowBase = [0.15, 0.01 + bOffset, -0.01];
        let defaultRightHandBase = [0.18, -0.09 + bOffset, 0.04];

        leftArmPivot = isRiding ? rotatePointX(chestP1, defaultLeftArmPivot, torsoTilt) : defaultLeftArmPivot;
        const leftElbowBase = isRiding ? rotatePointX(chestP1, defaultLeftElbowBase, torsoTilt) : defaultLeftElbowBase;
        const leftHandBase = isRiding ? rotatePointX(chestP1, defaultLeftHandBase, torsoTilt) : defaultLeftHandBase;

        rightArmPivot = isRiding ? rotatePointX(chestP1, defaultRightArmPivot, torsoTilt) : defaultRightArmPivot;
        const rightElbowBase = isRiding ? rotatePointX(chestP1, defaultRightElbowBase, torsoTilt) : defaultRightElbowBase;
        const rightHandBase = isRiding ? rotatePointX(chestP1, defaultRightHandBase, torsoTilt) : defaultRightHandBase;

        leftLegPivot = [-0.055, -0.12, 0];
        const leftKneeBase = [-0.055, -0.27, 0.015];
        const leftFootBase = [-0.055, -0.42, 0.0];

        rightLegPivot = [0.055, -0.12, 0];
        const rightKneeBase = [0.055, -0.27, 0.015];
        const rightFootBase = [0.055, -0.42, 0.0];

        leftElbowRot = rotatePointX(leftArmPivot, leftElbowBase, armAngle);
        const leftHandLocal = rotatePointX(
          leftElbowBase,
          leftHandBase,
          -leftElbowFlex,
        );
        leftHandRot = rotatePointX(leftArmPivot, leftHandLocal, armAngle);

        rightElbowRot = rotatePointX(
          rightArmPivot,
          rightElbowBase,
          rightArmAngle,
        );
        const rightHandLocal = rotatePointX(
          rightElbowBase,
          rightHandBase,
          -rightElbowFlex,
        );
        rightHandRot = rotatePointX(
          rightArmPivot,
          rightHandLocal,
          rightArmAngle,
        );

        let legAngleFwd = legAngle;
        let rightLegAngleFwd = rightLegAngle;
        let legAngleSide = 0;
        let rightLegAngleSide = 0;
        
        let isAimingBow = (typeof window !== "undefined" && !!window.isAimingBow);
        
        if (!isClone && isAimingBow && typeof keysPressed !== 'undefined') {
            let moveF = 0, moveS = 0;
            if (keysPressed[currentKeyBindings.forward]) moveF += 1;
            if (keysPressed[currentKeyBindings.backward]) moveF -= 1;
            if (keysPressed[currentKeyBindings.left]) moveS += 1;
            if (keysPressed[currentKeyBindings.right]) moveS -= 1;
            if (false) moveF += 1;
            if (false) moveF -= 1;
            if (false) moveS += 1;
            if (false) moveS -= 1;
            
            legAngleFwd = Math.sin(phase + Math.PI) * 0.6 * moveF;
            rightLegAngleFwd = Math.sin(phase) * 0.6 * moveF;
            
            legAngleSide = Math.sin(phase + Math.PI) * 0.3 * moveS;
            rightLegAngleSide = Math.sin(phase) * 0.3 * moveS;
            
            leftKneeFlex = 0.1 + Math.max(0, legAngleFwd * 0.5);
            rightKneeFlex = 0.1 + Math.max(0, rightLegAngleFwd * 0.5);
        }

        let lk = rotatePointX(leftLegPivot, leftKneeBase, legAngleFwd);
        const leftFootLocal = rotatePointX(
          leftKneeBase,
          leftFootBase,
          leftKneeFlex,
        );
        let lf = rotatePointX(leftLegPivot, leftFootLocal, legAngleFwd);
        
        leftKneeRot = rotatePointZ(leftLegPivot, lk, legAngleSide);
        leftFootRot = rotatePointZ(leftLegPivot, lf, legAngleSide);

        let rk = rotatePointX(
          rightLegPivot,
          rightKneeBase,
          rightLegAngleFwd,
        );
        const rightFootLocal = rotatePointX(
          rightKneeBase,
          rightFootBase,
          rightKneeFlex,
        );
        let rf = rotatePointX(
          rightLegPivot,
          rightFootLocal,
          rightLegAngleFwd,
        );
        
        rightKneeRot = rotatePointZ(rightLegPivot, rk, rightLegAngleSide);
        rightFootRot = rotatePointZ(rightLegPivot, rf, rightLegAngleSide);

        // Backup unmodified coordinates for clean face local coordinates mapping
        const localChestP1 = [chestP1[0], chestP1[1], chestP1[2]];
        const localChestP2 = [chestP2[0], chestP2[1], chestP2[2]];
        const localPelvisP1 = [pelvisP1[0], pelvisP1[1], pelvisP1[2]];
        const localPelvisP2 = [pelvisP2[0], pelvisP2[1], pelvisP2[2]];
        const localNeckP1 = [neckP1[0], neckP1[1], neckP1[2]];
        const localNeckP2 = [neckP2[0], neckP2[1], neckP2[2]];
        const localHeadP1 = [headP1[0], headP1[1], headP1[2]];
        const localHeadP2 = [headP2[0], headP2[1], headP2[2]];
        const localLeftEarP1 = [leftEarP1[0], leftEarP1[1], leftEarP1[2]];
        const localLeftEarP2 = [leftEarP2[0], leftEarP2[1], leftEarP2[2]];
        const localRightEarP1 = [rightEarP1[0], rightEarP1[1], rightEarP1[2]];
        const localRightEarP2 = [rightEarP2[0], rightEarP2[1], rightEarP2[2]];

        let axeHandleP1Rot, axeHandleP2Rot, axeBladeP1Rot, axeBladeP2Rot, axeBlade2P1Rot, axeBlade2P2Rot;
        let shovelD1Rot, shovelD2Rot, shovelLeftBranchRot, shovelRightBranchRot;
        let bowGripRot, bowUpperTipRot, bowLowerTipRot;
        
        if (heldItem) {
             if (heldItem.name === "BOW") {
                 let t = 0.0;
                 let drawT = 0.0;
                 if (arrowShotInCurrentAnim) {
                     if (useAnimTimer > 0.3) {
                         t = 1.0;
                         const holdStart = bowHoldArmTimer - 0.3;
                         if (useAnimTimer > holdStart) {
                             const p = lastBowDrawPower !== undefined ? lastBowDrawPower : 1.0;
                             drawT = ((useAnimTimer - holdStart) / 0.3) * p;
                         } else {
                             drawT = 0.0;
            }
          } else {
                         t = useAnimTimer / 0.3;
                         drawT = 0.0;
            }
          } else {
                     t = Math.min(1.0, Math.max(0.0, (1.4 - useAnimTimer) / 1.1));
                     if (bowComboActive) {
                         t = 1.0;
                         drawT = Math.min(1.0, Math.max(0.0, (1.2 - useAnimTimer) / 0.9));
                     } else {
                         drawT = t;
                     }
                 }

                 // Torso rotates right so the character stands sideways like an archer
                 let currentYaw = 1.1 * t; 

                 const transformTorso = (pt) => {
                     return rotatePointY(chestP1, pt, currentYaw);
                 };

                 const originalLeftArmPivot = [leftArmPivot[0], leftArmPivot[1], leftArmPivot[2]];

                 chestP2 = transformTorso(chestP2);
                 leftArmPivot = transformTorso(leftArmPivot);
                 rightArmPivot = transformTorso(rightArmPivot);

                 // Head stays in place so face and ears align correctly
                 // (No transformHead applied to neck, head, and ears)

                 // Arm segment lengths
                 const l_upper = 0.155;
                 const l_lower = 0.145;

                 // LEFT ARM (Holding the bow)
                 // Direction of the left arm (straight forward, slightly left, mostly horizontal)
                 let lDir = [-0.15, 0.02, 1.0];
                 let lDirLen = Math.sqrt(lDir[0]**2 + lDir[1]**2 + lDir[2]**2);
                 lDir = [lDir[0]/lDirLen, lDir[1]/lDirLen, lDir[2]/lDirLen];

                 let targetLeftElbow = [
                     leftArmPivot[0] + lDir[0] * l_upper,
                     leftArmPivot[1] + lDir[1] * l_upper,
                     leftArmPivot[2] + lDir[2] * l_upper
                 ];
                 let targetLeftHand = [
                     targetLeftElbow[0] + lDir[0] * l_lower,
                     targetLeftElbow[1] + lDir[1] * l_lower,
                     targetLeftElbow[2] + lDir[2] * l_lower
                 ];

                 let leftHandStart = leftHandRot;
                 let leftElbowStart = leftElbowRot;

                 leftHandRot = [
                     leftHandStart[0] + (targetLeftHand[0] - leftHandStart[0]) * t,
                     leftHandStart[1] + (targetLeftHand[1] - leftHandStart[1]) * t,
                     leftHandStart[2] + (targetLeftHand[2] - leftHandStart[2]) * t
                 ];
                 leftElbowRot = [
                     leftElbowStart[0] + (targetLeftElbow[0] - leftElbowStart[0]) * t,
                     leftElbowStart[1] + (targetLeftElbow[1] - leftElbowStart[1]) * t,
                     leftElbowStart[2] + (targetLeftElbow[2] - leftElbowStart[2]) * t
                 ];
                 
                 // Enforce left arm lengths
                 let lElbowDir = [leftElbowRot[0]-leftArmPivot[0], leftElbowRot[1]-leftArmPivot[1], leftElbowRot[2]-leftArmPivot[2]];
                 let lElbowLen = Math.sqrt(lElbowDir[0]**2 + lElbowDir[1]**2 + lElbowDir[2]**2);
                 if(lElbowLen > 0.001) { lElbowDir = [lElbowDir[0]/lElbowLen, lElbowDir[1]/lElbowLen, lElbowDir[2]/lElbowLen]; }
                 leftElbowRot = [leftArmPivot[0] + lElbowDir[0]*l_upper, leftArmPivot[1] + lElbowDir[1]*l_upper, leftArmPivot[2] + lElbowDir[2]*l_upper];
                 
                 let lHandDir = [leftHandRot[0]-leftElbowRot[0], leftHandRot[1]-leftElbowRot[1], leftHandRot[2]-leftElbowRot[2]];
                 let lHandLen = Math.sqrt(lHandDir[0]**2 + lHandDir[1]**2 + lHandDir[2]**2);
                 if(lHandLen > 0.001) { lHandDir = [lHandDir[0]/lHandLen, lHandDir[1]/lHandLen, lHandDir[2]/lHandLen]; }
                 leftHandRot = [leftElbowRot[0] + lHandDir[0]*l_lower, leftElbowRot[1] + lHandDir[1]*l_lower, leftElbowRot[2] + lHandDir[2]*l_lower];

                 // RIGHT ARM (Pulling the string)
                 // Hand should be near the cheek/chin
                 let pullHandTarget = [leftArmPivot[0] + 0.15, leftArmPivot[1] + 0.02, leftArmPivot[2] - 0.02];
                 
                 // Elbow points outward and backwards
                 let rElbowDir = [1.0, 0.2, -0.6]; 
                 let rElbowDirLen = Math.sqrt(rElbowDir[0]**2 + rElbowDir[1]**2 + rElbowDir[2]**2);
                 rElbowDir = [rElbowDir[0]/rElbowDirLen, rElbowDir[1]/rElbowDirLen, rElbowDir[2]/rElbowDirLen];

                 let targetRightElbow = [
                     rightArmPivot[0] + rElbowDir[0] * l_upper,
                     rightArmPivot[1] + rElbowDir[1] * l_upper,
                     rightArmPivot[2] + rElbowDir[2] * l_upper
                 ];

                 // Recalculate right hand exactly at distance l_lower from right elbow towards pullHandTarget
                 let rHandDir = [
                     pullHandTarget[0] - targetRightElbow[0],
                     pullHandTarget[1] - targetRightElbow[1],
                     pullHandTarget[2] - targetRightElbow[2]
                 ];
                 let rHandDirLen = Math.sqrt(rHandDir[0]**2 + rHandDir[1]**2 + rHandDir[2]**2);
                 rHandDir = [rHandDir[0]/rHandDirLen, rHandDir[1]/rHandDirLen, rHandDir[2]/rHandDirLen];

                 let targetRightHand = [
                     targetRightElbow[0] + rHandDir[0] * l_lower,
                     targetRightElbow[1] + rHandDir[1] * l_lower,
                     targetRightElbow[2] + rHandDir[2] * l_lower
                 ];

                 let rightHandStart = transformTorso(rightHandRot); 
                 let rightElbowStart = transformTorso(rightElbowRot);
                 if (bowComboActive) {
                     // Reach for the bow string instead of dropping to hip
                     rightHandStart = [targetLeftHand[0] + 0.05, targetLeftHand[1], targetLeftHand[2]];
                     rightElbowStart = [
                         rightArmPivot[0] + rElbowDir[0] * l_upper * 0.5,
                         rightArmPivot[1] + rElbowDir[1] * l_upper * 0.5,
                         rightArmPivot[2] + rElbowDir[2] * l_upper * 0.5
                     ];
                 }
                 
                 rightHandRot = [
                     rightHandStart[0] + (targetRightHand[0] - rightHandStart[0]) * drawT,
                     rightHandStart[1] + (targetRightHand[1] - rightHandStart[1]) * drawT,
                     rightHandStart[2] + (targetRightHand[2] - rightHandStart[2]) * drawT
                 ];

                 rightElbowRot = [
                     rightElbowStart[0] + (targetRightElbow[0] - rightElbowStart[0]) * drawT,
                     rightElbowStart[1] + (targetRightElbow[1] - rightElbowStart[1]) * drawT,
                     rightElbowStart[2] + (targetRightElbow[2] - rightElbowStart[2]) * drawT
                 ];
                 
                 // Enforce right arm lengths
                 let rE_Dir = [rightElbowRot[0]-rightArmPivot[0], rightElbowRot[1]-rightArmPivot[1], rightElbowRot[2]-rightArmPivot[2]];
                 let rE_Len = Math.sqrt(rE_Dir[0]**2 + rE_Dir[1]**2 + rE_Dir[2]**2);
                 if(rE_Len > 0.001) { rE_Dir = [rE_Dir[0]/rE_Len, rE_Dir[1]/rE_Len, rE_Dir[2]/rE_Len]; }
                 rightElbowRot = [rightArmPivot[0] + rE_Dir[0]*l_upper, rightArmPivot[1] + rE_Dir[1]*l_upper, rightArmPivot[2] + rE_Dir[2]*l_upper];
                 
                 let rH_Dir = [rightHandRot[0]-rightElbowRot[0], rightHandRot[1]-rightElbowRot[1], rightHandRot[2]-rightElbowRot[2]];
                 let rH_Len = Math.sqrt(rH_Dir[0]**2 + rH_Dir[1]**2 + rH_Dir[2]**2);
                 if(rH_Len > 0.001) { rH_Dir = [rH_Dir[0]/rH_Len, rH_Dir[1]/rH_Len, rH_Dir[2]/rH_Len]; }
                 rightHandRot = [rightElbowRot[0] + rH_Dir[0]*l_lower, rightElbowRot[1] + rH_Dir[1]*l_lower, rightElbowRot[2] + rH_Dir[2]*l_lower];

                 // BOW PLACEMENT
                 let upVec = [-0.1, 1, 0.1]; 
                 let lenU = Math.sqrt(upVec[0]**2 + upVec[1]**2 + upVec[2]**2);
                 upVec = [upVec[0]/lenU, upVec[1]/lenU, upVec[2]/lenU];

                 let bowLength = 0.45;
                 let targetBowGrip = [leftHandRot[0], leftHandRot[1], leftHandRot[2]];
                 let targetBowUpper = [
                     targetBowGrip[0] + upVec[0] * bowLength,
                     targetBowGrip[1] + upVec[1] * bowLength,
                     targetBowGrip[2] + upVec[2] * bowLength
                 ];
                 let targetBowLower = [
                     targetBowGrip[0] - upVec[0] * bowLength * 0.8,
                     targetBowGrip[1] - upVec[1] * bowLength * 0.8,
                     targetBowGrip[2] - upVec[2] * bowLength * 0.8
                 ];

                 const bowGripBase = [-0.18, -0.09 + bOffset, 0.04];
                 const bowUpperTipBase = [-0.18, -0.05 + bOffset, 0.49];
                 const bowLowerTipBase = [-0.18, -0.05 + bOffset, -0.32];
                 
                 const bgL = rotatePointX(leftElbowBase, bowGripBase, -leftElbowFlex);
                 const butL = rotatePointX(leftElbowBase, bowUpperTipBase, -leftElbowFlex);
                 const bltL = rotatePointX(leftElbowBase, bowLowerTipBase, -leftElbowFlex);
                 
                 let bowGripStart = rotatePointX(originalLeftArmPivot, bgL, armAngle);
                 let bowUpperStart = rotatePointX(originalLeftArmPivot, butL, armAngle);
                 let bowLowerStart = rotatePointX(originalLeftArmPivot, bltL, armAngle);

                 bowGripRot = [
                     bowGripStart[0] + (targetBowGrip[0] - bowGripStart[0]) * t,
                     bowGripStart[1] + (targetBowGrip[1] - bowGripStart[1]) * t,
                     bowGripStart[2] + (targetBowGrip[2] - bowGripStart[2]) * t
                 ];
                 bowUpperTipRot = [
                     bowUpperStart[0] + (targetBowUpper[0] - bowUpperStart[0]) * t,
                     bowUpperStart[1] + (targetBowUpper[1] - bowUpperStart[1]) * t,
                     bowUpperStart[2] + (targetBowUpper[2] - bowUpperStart[2]) * t
                 ];
                 bowLowerTipRot = [
                     bowLowerStart[0] + (targetBowLower[0] - bowLowerStart[0]) * t,
                     bowLowerStart[1] + (targetBowLower[1] - bowLowerStart[1]) * t,
                     bowLowerStart[2] + (targetBowLower[2] - bowLowerStart[2]) * t
                 ];
                 
                 if (typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationX !== "undefined") {
                      // Pitch the whole upper body to aim at the target NPC if locked, else fallback to rotationX
                      let currentPitch = rotationX;
                      if (activeTargetNPC && activeTargetNPC.position) {
                          const sinT_g = Math.sin(charTheta);
                          const cosT_g = Math.cos(charTheta);
                          const sinP_g = Math.sin(charPhi);
                          const cosP_g = Math.cos(charPhi);
                          const nx_g = sinT_g * cosP_g;
                          const ny_g = cosT_g;
                          const nz_g = sinT_g * sinP_g;
                          const h_g = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                          const r_terrain_g = RADIUS + h_g * HEIGHT_SCALE;
                          let r_g = r_terrain_g + 0.46 * playerScale;
                          if (typeof playerCenterRadius !== "undefined" && playerCenterRadius !== null) {
                              r_g = playerCenterRadius;
                          }
                          const player_world_x = r_g * nx_g;
                          const player_world_y = r_g * ny_g;
                          const player_world_z = r_g * nz_g;

                          const East_g = [-sinP_g, 0, cosP_g];
                          const North_g = [-cosT_g * cosP_g, sinT_g, -cosT_g * sinP_g];
                          const cosH_g = Math.cos(charHeading);
                          const sinH_g = Math.sin(charHeading);
                          const F_g = [
                              North_g[0] * cosH_g + East_g[0] * sinH_g,
                              North_g[1] * cosH_g + East_g[1] * sinH_g,
                              North_g[2] * cosH_g + East_g[2] * sinH_g,
                          ];

                          const npc = activeTargetNPC;
                          const npc_pos = npc.position;
                          const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
                          const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [nx_g, ny_g, nz_g];
                          const N = npc.N || n_npc;
                          const F = npc.F || [0, 0, 0];
                          let upOffset = 0.0;
                          let forwardOffset = 0.0;
                          if (npc.type === "meganeura") {
                              upOffset = 0.0;
                              forwardOffset = -0.06;
                          } else {
                              upOffset = -0.02;
                              forwardOffset = -0.12;
                          }
                          const target_g = [
                              npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
                              npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
                              npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
                          ];

                          const dVec = [
                              target_g[0] - player_world_x,
                              target_g[1] - player_world_y,
                              target_g[2] - player_world_z
                          ];
                          const d_up = dVec[0] * nx_g + dVec[1] * ny_g + dVec[2] * nz_g;
                          const d_fwd = dVec[0] * F_g[0] + dVec[1] * F_g[1] + dVec[2] * F_g[2];
                          const d_dist_planar = Math.sqrt(dVec[0]**2 + dVec[1]**2 + dVec[2]**2 - d_up**2);
                          if (d_dist_planar > 0.05) {
                              currentPitch = -Math.atan2(d_up, d_dist_planar);
                          }
                      }
                      const pitchAngle = currentPitch * t;
                      const applyPitch = (pt) => rotatePointX(chestP1, pt, pitchAngle);
                      
                      chestP2 = applyPitch(chestP2);
                      neckP1 = applyPitch(neckP1);
                      neckP2 = applyPitch(neckP2);
                      headP1 = applyPitch(headP1);
                      headP2 = applyPitch(headP2);
                      leftEarP1 = applyPitch(leftEarP1);
                      leftEarP2 = applyPitch(leftEarP2);
                      rightEarP1 = applyPitch(rightEarP1);
                      rightEarP2 = applyPitch(rightEarP2);
                      
                      leftArmPivot = applyPitch(leftArmPivot);
                      rightArmPivot = applyPitch(rightArmPivot);
                      leftElbowRot = applyPitch(leftElbowRot);
                      leftHandRot = applyPitch(leftHandRot);
                      rightElbowRot = applyPitch(rightElbowRot);
                      rightHandRot = applyPitch(rightHandRot);
                      
                      bowGripRot = applyPitch(bowGripRot);
                      bowUpperTipRot = applyPitch(bowUpperTipRot);
                      bowLowerTipRot = applyPitch(bowLowerTipRot);
            }
          } else if (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON") {
                 // Classic humanoid model: Raise the right arm horizontally forward and hold it in place continuously
                 const l_upper = 0.155;
                 const l_lower = 0.145;

                 // Calculate vertical aim pitch (from TPS camera rotationX or locked target NPC)
                 let currentPitch = 0.0;
                 if (typeof cameraMode !== "undefined" && (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && typeof rotationX !== "undefined") {
                     currentPitch = rotationX;
                     if (activeTargetNPC && activeTargetNPC.position) {
                         const sinT_g = Math.sin(charTheta);
                         const cosT_g = Math.cos(charTheta);
                         const sinP_g = Math.sin(charPhi);
                         const cosP_g = Math.cos(charPhi);
                         const nx_g = sinT_g * cosP_g;
                         const ny_g = cosT_g;
                         const nz_g = sinT_g * sinP_g;
                         const h_g = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                         const r_terrain_g = RADIUS + h_g * HEIGHT_SCALE;
                         let r_g = r_terrain_g + 0.46 * playerScale;
                         if (typeof playerCenterRadius !== "undefined" && playerCenterRadius !== null) {
                             r_g = playerCenterRadius;
                         }
                         const player_world_x = r_g * nx_g;
                         const player_world_y = r_g * ny_g;
                         const player_world_z = r_g * nz_g;

                         const East_g = [-sinP_g, 0, cosP_g];
                         const North_g = [-cosT_g * cosP_g, sinT_g, -cosT_g * sinP_g];
                         const cosH_g = Math.cos(charHeading);
                         const sinH_g = Math.sin(charHeading);
                         const F_g = [
                             North_g[0] * cosH_g + East_g[0] * sinH_g,
                             North_g[1] * cosH_g + East_g[1] * sinH_g,
                             North_g[2] * cosH_g + East_g[2] * sinH_g,
                         ];

                         const npc = activeTargetNPC;
                         const npc_pos = npc.position;
                         const npcLen = Math.sqrt(npc_pos[0]**2 + npc_pos[1]**2 + npc_pos[2]**2);
                         const n_npc = npcLen > 0.1 ? [npc_pos[0]/npcLen, npc_pos[1]/npcLen, npc_pos[2]/npcLen] : [nx_g, ny_g, nz_g];
                         const N = npc.N || n_npc;
                         const F = npc.F || [0, 0, 0];
                         let upOffset = (npc.type === "meganeura") ? 0.0 : -0.02;
                         let forwardOffset = (npc.type === "meganeura") ? -0.06 : -0.12;
                         const target_g = [
                             npc_pos[0] + N[0] * upOffset + F[0] * forwardOffset,
                             npc_pos[1] + N[1] * upOffset + F[1] * forwardOffset,
                             npc_pos[2] + N[2] * upOffset + F[2] * forwardOffset
                         ];

                         const dVec = [
                             target_g[0] - player_world_x,
                             target_g[1] - player_world_y,
                             target_g[2] - player_world_z
                         ];
                         const d_up = dVec[0] * nx_g + dVec[1] * ny_g + dVec[2] * nz_g;
                         const d_dist_planar = Math.sqrt(dVec[0]**2 + dVec[1]**2 + dVec[2]**2 - d_up**2);
                         if (d_dist_planar > 0.05) {
                             currentPitch = -Math.atan2(d_up, d_dist_planar);
                         }
                     }
                 }

                 // Recoil kickback during firing recovery
                 let recoilZ = 0.0;
                 if (arrowShotInCurrentAnim && useAnimTimer > 0) {
                     const rP = Math.max(0.0, Math.min(1.0, useAnimTimer / 0.32));
                     recoilZ = Math.sin(rP * Math.PI) * 0.035;
                 }

                 // Right arm raised horizontally forward along +Z with slight inward convergence towards centerline
                 const targetRightElbow = [
                     rightArmPivot[0] - 0.015,
                     rightArmPivot[1],
                     rightArmPivot[2] + l_upper - recoilZ * 0.4
                 ];
                 const targetRightHand = [
                     targetRightElbow[0] - 0.015,
                     targetRightElbow[1],
                     targetRightElbow[2] + l_lower - recoilZ * 0.6
                 ];

                 // Apply vertical pitch tilt so cannon aims up/down with camera
                 rightElbowRot = rotatePointX(rightArmPivot, targetRightElbow, currentPitch);
                 rightHandRot = rotatePointX(rightArmPivot, targetRightHand, currentPitch);

                 // Apply slight upper body tilt if looking up/down
                 const applyCannonPitch = (pt) => rotatePointX(chestP1, pt, currentPitch * 0.35);
                 neckP1 = applyCannonPitch(neckP1);
                 neckP2 = applyCannonPitch(neckP2);
                 headP1 = applyCannonPitch(headP1);
                 headP2 = applyCannonPitch(headP2);
                 leftEarP1 = applyCannonPitch(leftEarP1);
                 leftEarP2 = applyCannonPitch(leftEarP2);
                 rightEarP1 = applyCannonPitch(rightEarP1);
                 rightEarP2 = applyCannonPitch(rightEarP2);
          } else {
                 // Hand is at [0.18, -0.09 + bOffset, 0.04]
                 // Handle goes forward (along Z axis) so it's perpendicular to the arm
                 let axeHandleP1Base, axeHandleP2Base, axeBladeP1Base, axeBladeP2Base;
                 if (heldItem.name === "SHOVEL") {
                     // Shovel stick: continuous from Z = -0.04 to Z = 0.28
                     axeHandleP1Base = [0.18, -0.09 + bOffset, -0.04];
                     axeHandleP2Base = [0.18, -0.09 + bOffset, 0.28];
                     // Shovel blade (scoop): extends forward from the handle along Z axis! (Z = 0.28 to Z = 0.44)
                     axeBladeP1Base = [0.18, -0.09 + bOffset, 0.28];
                     axeBladeP2Base = [0.18, -0.09 + bOffset, 0.44];

                     // Handle D-Loop points at the back:
                     const shovelD1Base = [0.18, -0.09 + bOffset, -0.04];
                     const shovelD2Base = [0.18, -0.09 + bOffset, -0.08];
                     const shovelLeftBase = [0.18 - 0.04, -0.09 + bOffset, -0.12];
                     const shovelRightBase = [0.18 + 0.04, -0.09 + bOffset, -0.12];
                     
                     const d1L = rotatePointX(rightElbowBase, shovelD1Base, -rightElbowFlex);
                     const d2L = rotatePointX(rightElbowBase, shovelD2Base, -rightElbowFlex);
                     const dlL = rotatePointX(rightElbowBase, shovelLeftBase, -rightElbowFlex);
                     const drL = rotatePointX(rightElbowBase, shovelRightBase, -rightElbowFlex);
                     
                     shovelD1Rot = rotatePointX(rightArmPivot, d1L, rightArmAngle);
                     shovelD2Rot = rotatePointX(rightArmPivot, d2L, rightArmAngle);
                      shovelLeftBranchRot = rotatePointX(rightArmPivot, dlL, rightArmAngle);
                      shovelRightBranchRot = rotatePointX(rightArmPivot, drL, rightArmAngle);
                  } else if (heldItem.name === "BRANCH" || heldItem.name === "branch") {
                      // Natural branch in hand: extends slightly behind the grip and forward
                      axeHandleP1Base = [0.18, -0.09 + bOffset, -0.08];
                      axeHandleP2Base = [0.18, -0.09 + bOffset, 0.32];
                      axeBladeP1Base = [0.18, -0.09 + bOffset, 0.32];
                      axeBladeP2Base = [0.18, -0.09 + bOffset, 0.32];
                  } else {
                      axeHandleP1Base = [0.18, -0.09 + bOffset, -0.04];
                      axeHandleP2Base = [0.18, -0.09 + bOffset, 0.26];
                      axeBladeP1Base = [0.18, -0.09 + bOffset, 0.21];
                      axeBladeP2Base = [0.18, -0.21 + bOffset, 0.21];
                  }
                 
                 const p1L = rotatePointX(rightElbowBase, axeHandleP1Base, -rightElbowFlex);
                 const p2L = rotatePointX(rightElbowBase, axeHandleP2Base, -rightElbowFlex);
                 const b1L = rotatePointX(rightElbowBase, axeBladeP1Base, -rightElbowFlex);
                 const b2L = rotatePointX(rightElbowBase, axeBladeP2Base, -rightElbowFlex);
                 
                 axeHandleP1Rot = rotatePointX(rightArmPivot, p1L, rightArmAngle);
                 axeHandleP2Rot = rotatePointX(rightArmPivot, p2L, rightArmAngle);
                 axeBladeP1Rot = rotatePointX(rightArmPivot, b1L, rightArmAngle);
                 axeBladeP2Rot = rotatePointX(rightArmPivot, b2L, rightArmAngle);

                 if (heldItem.name === "PICKAXE") {
                     const axeBlade2P1Base = [0.18, -0.09 + bOffset, 0.21]; // Base of blade (same)
                     const axeBlade2P2Base = [0.18, 0.03 + bOffset, 0.21]; // Tip of blade (other side, UP)
                     const b2_1L = rotatePointX(rightElbowBase, axeBlade2P1Base, -rightElbowFlex);
                     const b2_2L = rotatePointX(rightElbowBase, axeBlade2P2Base, -rightElbowFlex);
                     axeBlade2P1Rot = rotatePointX(rightArmPivot, b2_1L, rightArmAngle);
                     axeBlade2P2Rot = rotatePointX(rightArmPivot, b2_2L, rightArmAngle);
                 }
             }
        }

        let R_rot = null, N_rot = null, F_rot = null;

        if (ragdollEnabled && ragdollInitialized) {
          const rx = ragdollAxis[0],
            ry = ragdollAxis[1],
            rz = ragdollAxis[2];
          const angle = ragdollAngle;
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const t = 1 - c;

          const m00 = t * rx * rx + c;
          const m01 = t * rx * ry - s * rz;
          const m02 = t * rx * rz + s * ry;

          const m10 = t * rx * ry + s * rz;
          const m11 = t * ry * ry + c;
          const m12 = t * ry * rz - s * rx;

          const m20 = t * rx * rz - s * ry;
          const m21 = t * ry * rz + s * rx;
          const m22 = t * rz * rz + c;

          const b = ragdollBaseMatrix;
          R_rot = [
            m00 * b[0] + m01 * b[1] + m02 * b[2],
            m10 * b[0] + m11 * b[1] + m12 * b[2],
            m20 * b[0] + m21 * b[1] + m22 * b[2],
          ];
          N_rot = [
            m00 * b[4] + m01 * b[5] + m02 * b[6],
            m10 * b[4] + m11 * b[5] + m12 * b[6],
            m20 * b[4] + m21 * b[5] + m22 * b[6],
          ];
          F_rot = [
            m00 * b[8] + m01 * b[9] + m02 * b[10],
            m10 * b[8] + m11 * b[9] + m12 * b[10],
            m20 * b[8] + m21 * b[9] + m22 * b[10],
          ];

          const rp = ragdollPos;
          const r_len = Math.sqrt(rp[0] ** 2 + rp[1] ** 2 + rp[2] ** 2);
          const gravityDir =
            r_len > 0.001
              ? [-rp[0] / r_len, -rp[1] / r_len, -rp[2] / r_len]
              : [0, -1, 0];

          const toWorld = (pt, thickness, sagScale) => {
            let px =
              rp[0] +
              playerScale *
                (pt[0] * R_rot[0] + pt[1] * N_rot[0] + pt[2] * F_rot[0]);
            let py =
              rp[1] +
              playerScale *
                (pt[0] * R_rot[1] + pt[1] * N_rot[1] + pt[2] * F_rot[1]);
            let pz =
              rp[2] +
              playerScale *
                (pt[0] * R_rot[2] + pt[1] * N_rot[2] + pt[2] * F_rot[2]);

            // Apply gravity sag
            px += gravityDir[0] * sagScale * playerScale;
            py += gravityDir[1] * sagScale * playerScale;
            pz += gravityDir[2] * sagScale * playerScale;

            // Clamping to terrain to make it floppy and perfectly aligned with floor
            const dist = Math.sqrt(px * px + py * py + pz * pz);
            if (dist > 0.001) {
              const ux = px / dist;
              const uy = py / dist;
              const uz = pz / dist;

              const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
              const phi = Math.atan2(uz, ux);
              const surfaceRadius = RADIUS + getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
              const caveData = typeof getTerrainSurfaceAndCeiling === "function"
                ? getTerrainSurfaceAndCeiling(ux, uy, uz, dist)
                : { ground: surfaceRadius, insideTunnel: false, ceiling: Infinity };

              if (caveData.insideTunnel) {
                  const minRad = caveData.ground + thickness * playerScale;
                  const maxRad = caveData.ceiling !== Infinity ? caveData.ceiling - thickness * playerScale : Infinity;
                  if (dist < minRad) {
                      px = ux * minRad;
                      py = uy * minRad;
                      pz = uz * minRad;
                  } else if (dist > maxRad && maxRad !== Infinity) {
                      px = ux * maxRad;
                      py = uy * maxRad;
                      pz = uz * maxRad;
                  }
              } else {
                  const minRad = surfaceRadius + thickness * playerScale;
                  if (dist < minRad) {
                      px = ux * minRad;
                      py = uy * minRad;
                      pz = uz * minRad;
                  }
              }
            }
            return [px, py, pz];
          };

          chestP1 = toWorld(chestP1, 0.09, 0.02);
          chestP2 = toWorld(chestP2, 0.09, 0.04);
          pelvisP1 = toWorld(pelvisP1, 0.085, 0.0);
          pelvisP2 = toWorld(pelvisP2, 0.085, 0.0);
          neckP1 = toWorld(neckP1, 0.045, 0.04);
          neckP2 = toWorld(neckP2, 0.045, 0.05);
          headP1 = toWorld(headP1, 0.16, 0.06);
          headP2 = toWorld(headP2, 0.16, 0.06);
          leftEarP1 = toWorld(leftEarP1, 0.035, 0.07);
          leftEarP2 = toWorld(leftEarP2, 0.035, 0.07);
          rightEarP1 = toWorld(rightEarP1, 0.035, 0.07);
          rightEarP2 = toWorld(rightEarP2, 0.035, 0.07);

          leftArmPivot = toWorld(leftArmPivot, 0.038, 0.02);
          leftElbowRot = toWorld(leftElbowRot, 0.038, 0.05);
          leftHandRot = toWorld(leftHandRot, 0.032, 0.1);

          rightArmPivot = toWorld(rightArmPivot, 0.038, 0.02);
          rightElbowRot = toWorld(rightElbowRot, 0.038, 0.05);
          rightHandRot = toWorld(rightHandRot, 0.032, 0.1);

          leftLegPivot = toWorld(leftLegPivot, 0.048, 0.02);
          leftKneeRot = toWorld(leftKneeRot, 0.048, 0.05);
          leftFootRot = toWorld(leftFootRot, 0.04, 0.1);

          rightLegPivot = toWorld(rightLegPivot, 0.048, 0.02);
          rightKneeRot = toWorld(rightKneeRot, 0.048, 0.05);
          rightFootRot = toWorld(rightFootRot, 0.04, 0.1);
          
          if (heldItem) {
              if (heldItem.name === "BOW") {
                  bowGripRot = toWorld(bowGripRot, 0.03, 0.1);
                  bowUpperTipRot = toWorld(bowUpperTipRot, 0.03, 0.1);
                  bowLowerTipRot = toWorld(bowLowerTipRot, 0.03, 0.1);
              } else {
                  axeHandleP1Rot = toWorld(axeHandleP1Rot, 0.03, 0.1);
                  axeHandleP2Rot = toWorld(axeHandleP2Rot, 0.03, 0.1);
                  axeBladeP1Rot = toWorld(axeBladeP1Rot, 0.04, 0.1);
                  axeBladeP2Rot = toWorld(axeBladeP2Rot, 0.04, 0.1);
                  if (heldItem.name === "PICKAXE") {
                      axeBlade2P1Rot = toWorld(axeBlade2P1Rot, 0.04, 0.1);
                      axeBlade2P2Rot = toWorld(axeBlade2P2Rot, 0.04, 0.1);
                  }
              }
          }
        }

        const scaleFactor = ragdollEnabled ? playerScale : 1.0;
        const chest = generateCapsule(
          chestP1,
          chestP2,
          (0.09 + bRadius) * scaleFactor,
          8,
          8,
        );
        const pelvis = generateCapsule(
          pelvisP1,
          pelvisP2,
          0.085 * scaleFactor,
          8,
          8,
        );
        const neck = generateCapsule(
          neckP1,
          neckP2,
          0.045 * scaleFactor,
          6,
          6,
        );
        const head = generateCapsule(
          headP1,
          headP2,
          0.24 * scaleFactor,
          8,
          8,
        );
        const leftEar = generateCapsule(
          leftEarP1,
          leftEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );
        const rightEar = generateCapsule(
          rightEarP1,
          rightEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );

        // Generate unpitched, un-yawed counterparts for local coordinate face mapping
        const localChest = generateCapsule(
          localChestP1,
          localChestP2,
          (0.09 + bRadius) * scaleFactor,
          8,
          8,
        );
        const localPelvis = generateCapsule(
          localPelvisP1,
          localPelvisP2,
          0.085 * scaleFactor,
          8,
          8,
        );
        const localNeck = generateCapsule(
          localNeckP1,
          localNeckP2,
          0.045 * scaleFactor,
          6,
          6,
        );
        const localHead = generateCapsule(
          localHeadP1,
          localHeadP2,
          0.24 * scaleFactor,
          8,
          8,
        );
        const localLeftEar = generateCapsule(
          localLeftEarP1,
          localLeftEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );
        const localRightEar = generateCapsule(
          localRightEarP1,
          localRightEarP2,
          0.035 * scaleFactor,
          6,
          6,
        );

        const leftArmUpper = generateCapsule(
          leftArmPivot,
          leftElbowRot,
          0.038 * scaleFactor,
          6,
          6,
        );
        const leftArmLower = generateCapsule(
          leftElbowRot,
          leftHandRot,
          0.032 * scaleFactor,
          6,
          6,
        );

        const rightArmUpper = generateCapsule(
          rightArmPivot,
          rightElbowRot,
          0.038 * scaleFactor,
          6,
          6,
        );
        const rightArmLower = generateCapsule(
          rightElbowRot,
          rightHandRot,
          0.032 * scaleFactor,
          6,
          6,
        );

        const leftLegUpper = generateCapsule(
          leftLegPivot,
          leftKneeRot,
          0.048 * scaleFactor,
          6,
          6,
        );
        const leftLegLower = generateCapsule(
          leftKneeRot,
          leftFootRot,
          0.04 * scaleFactor,
          6,
          6,
        );

        const rightLegUpper = generateCapsule(
          rightLegPivot,
          rightKneeRot,
          0.048 * scaleFactor,
          6,
          6,
        );
        const rightLegLower = generateCapsule(
          rightKneeRot,
          rightFootRot,
          0.04 * scaleFactor,
          6,
          6,
        );

        // Build Chibi detailed hands, fingers, ankles, feet, toes
        const leftHandParts = buildHandAndFingers(leftElbowRot, leftHandRot, true, scaleFactor);
        const rightHandParts = buildHandAndFingers(rightElbowRot, rightHandRot, false, scaleFactor);
        const leftFootParts = buildFootAnkleToes(leftKneeRot, leftFootRot, true, scaleFactor);
        const rightFootParts = buildFootAnkleToes(rightKneeRot, rightFootRot, false, scaleFactor);

        // === Build 3D Anime Hair for Player Character (High Performance Cached) ===
        if (!window._cachedHairState) {
          window._cachedHairState = { key: "", baseMesh: null, localDummyV: null };
        }

        function getBaseLocalHairMesh() {
          const style = window.playerHairStyle !== undefined ? window.playerHairStyle : 0;
          if (!window.playerHairColor) {
            const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
            window.playerHairColor = colors[0];
          }
          const color = window.playerHairColor;
          const key = `${style}_${color.join(",")}_${scaleFactor}`;

          if (window._cachedHairState.baseMesh && window._cachedHairState.key === key) {
            return window._cachedHairState;
          }

          const localV = [], c = [], i = [];
          if (typeof window.build3DAnimeHair === "function") {
            const identityPtFn = (lx, ly, lz) => [lx, ly, lz];
            window.build3DAnimeHair(
              style,
              color,
              scaleFactor,
              identityPtFn,
              0, // headTilt
              localV,
              c,
              i
            );
          }

          if (localV.length === 0) {
            window._cachedHairState = {
              key,
              baseMesh: { localV: [], colors: [], normals: [], indices: [] },
              localDummyV: []
            };
            return window._cachedHairState;
          }

          const normals = new Float32Array(localV.length);
          for (let k = 0; k < i.length; k += 3) {
            const i0 = i[k], i1 = i[k+1], i2 = i[k+2];
            if (i0 * 3 + 2 >= localV.length || i1 * 3 + 2 >= localV.length || i2 * 3 + 2 >= localV.length) continue;
            const p0 = [localV[i0*3], localV[i0*3+1], localV[i0*3+2]];
            const p1 = [localV[i1*3], localV[i1*3+1], localV[i1*3+2]];
            const p2 = [localV[i2*3], localV[i2*3+1], localV[i2*3+2]];

            const ux = p1[0]-p0[0], uy = p1[1]-p0[1], uz = p1[2]-p0[2];
            const wx = p2[0]-p0[0], wy = p2[1]-p0[1], wz = p2[2]-p0[2];

            const nx = uy*wz - uz*wy;
            const ny = uz*wx - ux*wz;
            const nz = ux*wy - uy*wx;

            normals[i0*3] += nx; normals[i0*3+1] += ny; normals[i0*3+2] += nz;
            normals[i1*3] += nx; normals[i1*3+1] += ny; normals[i1*3+2] += nz;
            normals[i2*3] += nx; normals[i2*3+1] += ny; normals[i2*3+2] += nz;
          }

          for (let k = 0; k < normals.length; k += 3) {
            const len = Math.sqrt(normals[k]**2 + normals[k+1]**2 + normals[k+2]**2);
            if (len > 0.0001) {
              normals[k] /= len;
              normals[k+1] /= len;
              normals[k+2] /= len;
            } else {
              normals[k+1] = 1.0;
            }
          }

          const localDummyV = new Array(localV.length);
          for (let k = 0; k < localV.length; k += 3) {
            localDummyV[k] = 0;
            localDummyV[k+1] = -999.0;
            localDummyV[k+2] = 0;
          }

          window._cachedHairState = {
            key,
            baseMesh: {
              localV,
              colors: c,
              normals: Array.from(normals),
              indices: i
            },
            localDummyV
          };

          return window._cachedHairState;
        }

        function createHairMesh(isLocal) {
          const cached = getBaseLocalHairMesh();
          const bm = cached.baseMesh;
          if (!bm || !bm.localV || bm.localV.length === 0) {
            return { vertices: [], colors: [], normals: [], indices: [] };
          }

          if (isLocal) {
            return {
              vertices: cached.localDummyV,
              colors: bm.colors,
              normals: bm.normals,
              indices: bm.indices
            };
          }

          const isRag = !!(ragdollEnabled && ragdollInitialized && R_rot && N_rot && F_rot);
          const targetHeadP = headP1;
          const numCoords = bm.localV.length;
          const worldV = new Array(numCoords);
          const worldNormals = isRag ? new Array(numCoords) : bm.normals;
          const hx = targetHeadP[0];
          const hy = targetHeadP[1];
          const hz = targetHeadP[2];
          const scale = scaleFactor;

          const timeSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.0028;

          // Action & Jump physics parameters
          const vertVel = (typeof playerVerticalVel !== "undefined") ? playerVerticalVel : 0.0;
          const isGrounded = (typeof isPlayerGrounded !== "undefined") ? isPlayerGrounded : true;

          // Landing spring simulation
          if (!window._hairSpring) {
            window._hairSpring = { y: 0.0, vy: 0.0, lastGrounded: true };
          }
          const spring = window._hairSpring;

          if (isGrounded && !spring.lastGrounded) {
            // Landing impact
            spring.vy = -0.016;
          }
          spring.lastGrounded = isGrounded;

          // Update spring oscillator (harmonic damping)
          spring.vy += (-180.0 * spring.y - 12.0 * spring.vy) * 0.016;
          spring.y += spring.vy * 0.016;
          const bounceY = spring.y;

          // Air displacement from vertical jump velocity
          let airY = 0.0;
          let airFlare = 0.0;
          if (vertVel > 0.0005) {
            // Ascending jump (lag downward)
            airY = -vertVel * 6.5;
            airFlare = vertVel * 2.5;
          } else if (vertVel < -0.0005) {
            // Descending / falling (float upward & flare outward)
            const fallSpeed = Math.abs(vertVel);
            airY = fallSpeed * 9.0;
            airFlare = fallSpeed * 5.0;
          }

          // Walk / Run cycle sway
          const walkX = Math.sin(phase) * 0.014;
          const walkZ = Math.cos(phase * 2.0) * 0.010;
          const walkY = -Math.abs(Math.sin(phase)) * 0.006;

          // Item / Tool swing action whip
          let actionZ = 0.0;
          let actionY = 0.0;
          if (typeof isUsingItem !== "undefined" && isUsingItem && typeof useAnimTimer !== "undefined") {
            const swingFactor = Math.sin((1.0 - useAnimTimer) * Math.PI);
            actionZ = swingFactor * 0.024;
            actionY = -Math.abs(swingFactor) * 0.008;
          }

          for (let k = 0; k < numCoords; k += 3) {
            const lx = bm.localV[k];
            const ly = bm.localV[k+1];
            const lz = bm.localV[k+2];

            // Flex factor increases naturally towards hair tips (scalp root lx,ly is anchored)
            const flex = Math.max(0.0, (0.24 - ly) * 1.5);
            const flexSq = flex * flex;

            // Outward direction vector from skull center for flare outwards during jump
            const distXZ = Math.sqrt(lx * lx + lz * lz) || 0.001;
            const dirX = lx / distXZ;
            const dirZ = lz / distXZ;

            // Gentle organic ambient breeze
            const breezeX = Math.sin(timeSec * 2.6 + ly * 12.0 + lx * 5.0) * 0.006 * flexSq;
            const breezeZ = Math.cos(timeSec * 2.1 + ly * 10.0 + lz * 5.0) * 0.006 * flexSq;

            // Combine all physical forces
            const totalDx = breezeX + (isRag ? 0.0 : (walkX * flexSq + dirX * airFlare * flexSq));
            const totalDy = (isRag ? 0.0 : ((walkY + actionY + airY + bounceY) * flexSq - Math.abs(totalDx) * 0.12));
            const totalDz = breezeZ + (isRag ? 0.0 : (walkZ * flexSq + actionZ * flexSq + dirZ * airFlare * flexSq));

            const offX = (lx + totalDx) * scale;
            const offY = (ly + totalDy) * scale;
            const offZ = (lz + totalDz) * scale;

            if (isRag) {
              worldV[k]   = hx + (offX * R_rot[0] + offY * N_rot[0] + offZ * F_rot[0]);
              worldV[k+1] = hy + (offX * R_rot[1] + offY * N_rot[1] + offZ * F_rot[1]);
              worldV[k+2] = hz + (offX * R_rot[2] + offY * N_rot[2] + offZ * F_rot[2]);

              const nx = bm.normals[k];
              const ny = bm.normals[k+1];
              const nz = bm.normals[k+2];
              worldNormals[k]   = nx * R_rot[0] + ny * N_rot[0] + nz * F_rot[0];
              worldNormals[k+1] = nx * R_rot[1] + ny * N_rot[1] + nz * F_rot[1];
              worldNormals[k+2] = nx * R_rot[2] + ny * N_rot[2] + nz * F_rot[2];
            } else {
              worldV[k]   = hx + offX;
              worldV[k+1] = hy + offY;
              worldV[k+2] = hz + offZ;
            }
          }

          return {
            vertices: worldV,
            colors: bm.colors,
            normals: worldNormals,
            indices: bm.indices
          };
        }

        const playerHairMesh = createHairMesh(false);
        window._lastPlayerHairMesh = playerHairMesh;
        const playerLocalHairMesh = createHairMesh(true);

        let meshesToMerge = [
          chest,
          pelvis,
          neck,
          head,
          playerHairMesh,
          leftEar,
          rightEar,
          leftArmUpper,
          leftArmLower,
          rightArmUpper,
          rightArmLower,
          leftLegUpper,
          leftLegLower,
          rightLegUpper,
          rightLegLower,
          ...leftHandParts,
          ...rightHandParts,
          ...leftFootParts,
          ...rightFootParts,
        ];

        let localMeshesToMerge = [
          localChest,
          localPelvis,
          localNeck,
          localHead,
          playerLocalHairMesh,
          localLeftEar,
          localRightEar,
          leftArmUpper,
          leftArmLower,
          rightArmUpper,
          rightArmLower,
          leftLegUpper,
          leftLegLower,
          rightLegUpper,
          rightLegLower,
          ...leftHandParts,
          ...rightHandParts,
          ...leftFootParts,
          ...rightFootParts,
        ];
        
        if (heldItem) {
            const charMat = getCharacterMatrix();
            const transformPt = (p) => {
                if (!p) return [0, 0, 0];
                return [p[0], p[1], p[2]];
            };

            const rawV = [], rawC = [], rawI = [];
            
            const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
            const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
            const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
            const normalize = (v) => {
                const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
                if (l < 1e-5) return [1,0,0];
                return [v[0]/l, v[1]/l, v[2]/l];
            };
            const scale = (v, s) => [v[0]*s, v[1]*s, v[2]*s];

            const isRag = (ragdollEnabled && ragdollInitialized);
            const itemScale = isRag ? playerScale : 1.0;

            const addWedge = (pBase, pTip, widthBase, widthTip, thickness, color) => {
                const dir = sub(pTip, pBase);
                const f = normalize(dir); // points from base to tip
                const charX = isRag ? [charMat[0], charMat[1], charMat[2]] : [1, 0, 0];
                
                // let's use charX as thickness direction
                const right = normalize(charX); 
                const forward = normalize(cross(right, f)); // perpendicular to thickness and blade direction

                const sx = scale(right, thickness * 0.5);
                const wBase = scale(forward, widthBase * 0.5);
                const wTip = scale(forward, widthTip * 0.5);

                const vBaseIdx = rawV.length / 3;
                
                // 4 points at base
                const b1 = add(add(pBase, sx), wBase);
                const b2 = add(sub(pBase, sx), wBase);
                const b3 = sub(sub(pBase, sx), wBase);
                const b4 = add(sub(pBase, wBase), sx);

                // 4 points at tip (wedge shape)
                const t1 = add(add(pTip, scale(sx, 0.1)), wTip); // sharper at tip
                const t2 = add(sub(pTip, scale(sx, 0.1)), wTip);
                const t3 = sub(sub(pTip, scale(sx, 0.1)), wTip);
                const t4 = add(sub(pTip, wTip), scale(sx, 0.1));

                const pts = [b1, b2, b3, b4, t1, t2, t3, t4];
                for (let p of pts) {
                    rawV.push(...p);
                    rawC.push(...color);
                }
                
                const indices = [
                    0,3,2, 0,2,1, // base (-Z)
                    4,5,6, 4,6,7, // tip (+Z)
                    0,1,5, 0,5,4, // top (+Y)
                    3,7,6, 3,6,2, // bottom (-Y)
                    0,4,7, 0,7,3, // right (+X)
                    1,2,6, 1,6,5  // left (-X)
                ];
                for (let idx of indices) {
                    rawI.push(vBaseIdx + idx);
                }
            };

            if (heldItem && (heldItem.name === "WOODEN_ARM_CANNON" || heldItem.name === "ARM_CANNON")) {
                const pElbow = isRag ? rightElbowRot : transformPt(rightElbowRot);
                const pHand = isRag ? rightHandRot : transformPt(rightHandRot);
                buildWoodenArmCannonMesh(pElbow, pHand, rawV, rawC, rawI, itemScale);
            } else if (heldItem && heldItem.name === "BOW") {
                const wGrip = isRag ? bowGripRot : transformPt(bowGripRot);
                const wUpperTip = isRag ? bowUpperTipRot : transformPt(bowUpperTipRot);
                const wLowerTip = isRag ? bowLowerTipRot : transformPt(bowLowerTipRot);
                
                const bowScale = itemScale;
                let wNock;
                if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
                    wNock = isRag ? rightHandRot : transformPt(rightHandRot);
                } else {
                    const wGripVal = wGrip;
                    const wHandVal = isRag ? rightHandRot : transformPt(rightHandRot);
                    const pullVec = [wHandVal[0] - wGripVal[0], wHandVal[1] - wGripVal[1], wHandVal[2] - wGripVal[2]];
                    const dist = Math.sqrt(pullVec[0]**2 + pullVec[1]**2 + pullVec[2]**2);
                    if (dist > 0.001) {
                        const pullDir = [pullVec[0] / dist, pullVec[1] / dist, pullVec[2] / dist];
                        let t_rel = 0;
                        if (lastBowShootTime) {
                            t_rel = (Date.now() - lastBowShootTime) / 1000.0;
                        }
                        const drawP = typeof lastBowDrawPower !== "undefined" ? lastBowDrawPower : 1.0;
                        const vibeAmp = 0.15 * bowScale * drawP * Math.cos(t_rel * 40.0) * Math.exp(-t_rel * 6.0);
                        wNock = [wGripVal[0] + pullDir[0] * vibeAmp, wGripVal[1] + pullDir[1] * vibeAmp, wGripVal[2] + pullDir[2] * vibeAmp];
                    } else {
                        wNock = wGripVal;
                    }
                }

                const bowColor = [0.55, 0.38, 0.22];
                
                // Calculate permanent bow bend shape
                let bUp = [wUpperTip[0] - wLowerTip[0], wUpperTip[1] - wLowerTip[1], wUpperTip[2] - wLowerTip[2]];
                let bUpLen = Math.sqrt(bUp[0]**2 + bUp[1]**2 + bUp[2]**2);
                if (bUpLen > 0.001) { bUp[0]/=bUpLen; bUp[1]/=bUpLen; bUp[2]/=bUpLen; }
                
                const chestW = isRag ? chestP1 : transformPt(chestP1);
                let bOut = [wGrip[0] - chestW[0], wGrip[1] - chestW[1], wGrip[2] - chestW[2]];
                
                let bRight = [
                     bUp[1]*bOut[2] - bUp[2]*bOut[1],
                     bUp[2]*bOut[0] - bUp[0]*bOut[2],
                     bUp[0]*bOut[1] - bUp[1]*bOut[0]
                ];
                let bRightLen = Math.sqrt(bRight[0]**2 + bRight[1]**2 + bRight[2]**2);
                if (bRightLen > 0.001) { bRight[0]/=bRightLen; bRight[1]/=bRightLen; bRight[2]/=bRightLen; }
                else { bRight = [1,0,0]; }
                
                let bFwd = [
                     bRight[1]*bUp[2] - bRight[2]*bUp[1],
                     bRight[2]*bUp[0] - bRight[0]*bUp[2],
                     bRight[0]*bUp[1] - bRight[1]*bUp[0]
                ];
                let dotFwdOut = bFwd[0]*bOut[0] + bFwd[1]*bOut[1] + bFwd[2]*bOut[2];
                if (dotFwdOut < 0) { bFwd[0]*=-1; bFwd[1]*=-1; bFwd[2]*=-1; }
                
                const bendMag = 0.16 * bowScale;
                const wUpperMid = [
                    (wGrip[0] + wUpperTip[0]) * 0.5 + bFwd[0] * bendMag,
                    (wGrip[1] + wUpperTip[1]) * 0.5 + bFwd[1] * bendMag,
                    (wGrip[2] + wUpperTip[2]) * 0.5 + bFwd[2] * bendMag
                ];
                const wLowerMid = [
                    (wGrip[0] + wLowerTip[0]) * 0.5 + bFwd[0] * bendMag,
                    (wGrip[1] + wLowerTip[1]) * 0.5 + bFwd[1] * bendMag,
                    (wGrip[2] + wLowerTip[2]) * 0.5 + bFwd[2] * bendMag
                ];

                buildTaperedSegment(wGrip, wUpperMid, 0.02 * bowScale, 0.014 * bowScale, 5, bowColor, rawV, rawC, rawI);
                buildTaperedSegment(wUpperMid, wUpperTip, 0.014 * bowScale, 0.008 * bowScale, 5, bowColor, rawV, rawC, rawI);
                
                buildTaperedSegment(wGrip, wLowerMid, 0.02 * bowScale, 0.014 * bowScale, 5, bowColor, rawV, rawC, rawI);
                buildTaperedSegment(wLowerMid, wLowerTip, 0.014 * bowScale, 0.008 * bowScale, 5, bowColor, rawV, rawC, rawI);

                const stringColor = [0.95, 0.95, 0.95];
                buildTaperedSegment(wUpperTip, wNock, 0.003 * bowScale, 0.003 * bowScale, 4, stringColor, rawV, rawC, rawI);
                buildTaperedSegment(wLowerTip, wNock, 0.003 * bowScale, 0.003 * bowScale, 4, stringColor, rawV, rawC, rawI);

                if (!arrowShotInCurrentAnim && useAnimTimer > 0) {
                    const arrowDir = [wGrip[0] - wNock[0], wGrip[1] - wNock[1], wGrip[2] - wNock[2]];
                    const arrowLen = Math.sqrt(arrowDir[0]**2 + arrowDir[1]**2 + arrowDir[2]**2);
                    if (arrowLen > 0.001) {
                        arrowDir[0] /= arrowLen;
                        arrowDir[1] /= arrowLen;
                        arrowDir[2] /= arrowLen;
                        if (!ragdollEnabled || !ragdollInitialized) {
                            window.lastBowGripPos = [
                                charMat[0]*wGrip[0] + charMat[4]*wGrip[1] + charMat[8]*wGrip[2] + charMat[12],
                                charMat[1]*wGrip[0] + charMat[5]*wGrip[1] + charMat[9]*wGrip[2] + charMat[13],
                                charMat[2]*wGrip[0] + charMat[6]*wGrip[1] + charMat[10]*wGrip[2] + charMat[14]
                            ];
                            window.lastBowAimDir = [
                                charMat[0]*arrowDir[0] + charMat[4]*arrowDir[1] + charMat[8]*arrowDir[2],
                                charMat[1]*arrowDir[0] + charMat[5]*arrowDir[1] + charMat[9]*arrowDir[2],
                                charMat[2]*arrowDir[0] + charMat[6]*arrowDir[1] + charMat[10]*arrowDir[2]
                            ];
                        } else {
                            window.lastBowGripPos = [wGrip[0], wGrip[1], wGrip[2]];
                            window.lastBowAimDir = [arrowDir[0], arrowDir[1], arrowDir[2]];
                        }
                    }
                    const arrowTipPos = [
                        wGrip[0] + arrowDir[0] * 0.12 * bowScale,
                        wGrip[1] + arrowDir[1] * 0.12 * bowScale,
                        wGrip[2] + arrowDir[2] * 0.12 * bowScale
                    ];
                    
                    const shaftColor = [0.55, 0.4, 0.25];
                    buildTaperedSegment(wNock, arrowTipPos, 0.005 * bowScale, 0.005 * bowScale, 4, shaftColor, rawV, rawC, rawI);

                    const featherColor = [0.9, 0.2, 0.2];
                    const fletchEnd = [
                        wNock[0] + arrowDir[0] * 0.05 * bowScale,
                        wNock[1] + arrowDir[1] * 0.05 * bowScale,
                        wNock[2] + arrowDir[2] * 0.05 * bowScale
                    ];
                    buildTaperedSegment(wNock, fletchEnd, 0.015 * bowScale, 0.006 * bowScale, 4, featherColor, rawV, rawC, rawI);

                    const flintColor = [0.35, 0.35, 0.35];
                    const headEnd = [
                        arrowTipPos[0] + arrowDir[0] * 0.02 * bowScale,
                        arrowTipPos[1] + arrowDir[1] * 0.02 * bowScale,
                        arrowTipPos[2] + arrowDir[2] * 0.02 * bowScale
                    ];
                    addWedge(arrowTipPos, headEnd, 0.025 * bowScale, 0.002 * bowScale, 0.006 * bowScale, flintColor);
            }
          } else if (heldItem.name === "GLOW_BATTERY" || heldItem.name === "GLOW_BATTERY_EMPTY") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                
                let fillPercent = 0;
                if (heldItem.name === "GLOW_BATTERY") {
                   if (window.BatterySystem) {
                      const stats = window.BatterySystem.getStats();
                      fillPercent = (stats.activeBattery && stats.activeBattery.charge) ? (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100 : 100;
                   } else {
                      fillPercent = 100;
                   }
                } else {
                   if (heldItem.rechargeTime !== undefined && window.BatterySystem) {
                      fillPercent = (heldItem.rechargeTime / window.BatterySystem.REGEN_TIME) * 100;
                   } else {
                      fillPercent = 0;
                   }
                }

                const isLow = fillPercent <= 20;
                const batteryColor = isLow ? [0.88, 0.1, 0.1] : [0.22, 0.95, 0.88];
                const emptyColor = [0.3, 0.3, 0.3];
                
                // Pure rectangular glowing rock rod
                const startT = 0.05;
                const endT = 0.95;
                const fillT = startT + (endT - startT) * (fillPercent / 100);

                const rodP1 = [
                    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * startT,
                    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * startT,
                    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * startT
                ];
                const rodFillEnd = [
                    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * fillT,
                    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * fillT,
                    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * fillT
                ];
                const rodP2 = [
                    wHandleP1[0] + (wHandleP2[0] - wHandleP1[0]) * endT,
                    wHandleP1[1] + (wHandleP2[1] - wHandleP1[1]) * endT,
                    wHandleP1[2] + (wHandleP2[2] - wHandleP1[2]) * endT
                ];
                
                if (fillPercent > 0) {
                   buildTaperedSegment(rodP1, rodFillEnd, 0.036 * itemScale, 0.036 * itemScale, 4, batteryColor, rawV, rawC, rawI, true);
                }
                if (fillPercent < 100) {
                   buildTaperedSegment(rodFillEnd, rodP2, 0.036 * itemScale, 0.036 * itemScale, 4, emptyColor, rawV, rawC, rawI, true);
                }
          } else if (heldItem.name === "BRANCH" || heldItem.name === "branch") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const branchColor = [0.45, 0.3, 0.15];
                // Match inventory preview: buildTaperedSegment([-0.35, -0.1, 0], [0.35, 0.1, 0], 0.04, 0.02, 5, [0.45, 0.3, 0.15])
                // Natural tapered wooden branch (5-sided cylindrical cross-section, tapered base to tip, capped ends)
                buildTaperedSegment(
                    wHandleP1,
                    wHandleP2,
                    0.024 * itemScale,
                    0.012 * itemScale,
                    5,
                    branchColor,
                    rawV,
                    rawC,
                    rawI,
                    true
                );
          } else if (heldItem.name === "AXE" || heldItem.name === "PICKAXE" || heldItem.name === "SHOVEL") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const wBladeBase = transformPt(axeBladeP1Rot);
                const wBladeTip = transformPt(axeBladeP2Rot);

                const handleColor = [0.4, 0.25, 0.15];
                buildTaperedSegment(wHandleP1, wHandleP2, 0.015 * itemScale, 0.015 * itemScale, 5, handleColor, rawV, rawC, rawI);
                
                const bladeColor = [0.65, 0.65, 0.65];
                
                if (heldItem.name === "AXE") {
                    // The wedge is wide at tip, narrow at base for axe
                    addWedge(wBladeBase, wBladeTip, 0.04 * itemScale, 0.08 * itemScale, 0.01 * itemScale, bladeColor);
                } else if (heldItem.name === "PICKAXE") {
                    // The wedge is pointy for pickaxe (narrow at tip)
                    addWedge(wBladeBase, wBladeTip, 0.03 * itemScale, 0.005 * itemScale, 0.01 * itemScale, bladeColor);
                    
                    const wBlade2Base = transformPt(axeBlade2P1Rot);
                    const wBlade2Tip = transformPt(axeBlade2P2Rot);
                    addWedge(wBlade2Base, wBlade2Tip, 0.03 * itemScale, 0.005 * itemScale, 0.01 * itemScale, bladeColor);
                } else if (heldItem.name === "SHOVEL") {
                    // 1. Draw D-handle components at the back of the handle
                    const wD1 = transformPt(shovelD1Rot);
                    const wD2 = transformPt(shovelD2Rot);
                    const wLeft = transformPt(shovelLeftBranchRot);
                    const wRight = transformPt(shovelRightBranchRot);
                    
                    const shovelPartsColor = [0.25, 0.25, 0.25]; // Charcoal/dark metal
                    // Stem of D-handle
                    buildTaperedSegment(wD1, wD2, 0.012 * itemScale, 0.012 * itemScale, 5, shovelPartsColor, rawV, rawC, rawI);
                    // Left and right loop branches
                    buildTaperedSegment(wD2, wLeft, 0.01 * itemScale, 0.01 * itemScale, 4, shovelPartsColor, rawV, rawC, rawI);
                    buildTaperedSegment(wD2, wRight, 0.01 * itemScale, 0.01 * itemScale, 4, shovelPartsColor, rawV, rawC, rawI);
                    // Grip bar
                    buildTaperedSegment(wLeft, wRight, 0.011 * itemScale, 0.011 * itemScale, 5, shovelPartsColor, rawV, rawC, rawI);

                    // 2. Draw shovel blade scoop
                    const wBladeSocketEnd = [
                        wBladeBase[0] + (wBladeTip[0] - wBladeBase[0]) * 0.2,
                        wBladeBase[1] + (wBladeTip[1] - wBladeBase[1]) * 0.2,
                        wBladeBase[2] + (wBladeTip[2] - wBladeBase[2]) * 0.2
                    ];
                    const wBladeMid = [
                        wBladeBase[0] + (wBladeTip[0] - wBladeBase[0]) * 0.65,
                        wBladeBase[1] + (wBladeTip[1] - wBladeBase[1]) * 0.65,
                        wBladeBase[2] + (wBladeTip[2] - wBladeBase[2]) * 0.65
                    ];

                    // Scoop neck/socket
                    buildTaperedSegment(wBladeBase, wBladeSocketEnd, 0.016 * itemScale, 0.016 * itemScale, 5, [0.35, 0.35, 0.35], rawV, rawC, rawI);
                    // Scoop main plate
                    addWedge(wBladeSocketEnd, wBladeMid, 0.07 * itemScale, 0.065 * itemScale, 0.012 * itemScale, bladeColor);
                    // Scoop pointy tip
                    addWedge(wBladeMid, wBladeTip, 0.065 * itemScale, 0.01 * itemScale, 0.01 * itemScale, bladeColor);
                }
            } else if ((heldItem.name === "OBSIDIAN_FLUX" || heldItem.name === "OBSIDIAN_BALL") && typeof window.buildObsidianBallModel === "function") {
                const wHandleP1 = transformPt(axeHandleP1Rot);
                const wHandleP2 = transformPt(axeHandleP2Rot);
                const handPos = [
                    (wHandleP1[0] + wHandleP2[0]) * 0.5,
                    (wHandleP1[1] + wHandleP2[1]) * 0.5,
                    (wHandleP1[2] + wHandleP2[2]) * 0.5
                ];
                window.buildObsidianBallModel(
                    1234,
                    0,
                    false,
                    false,
                    0.18 * itemScale,
                    handPos,
                    [1, 0, 0],
                    [0, 1, 0],
                    [0, 0, 1],
                    rawV,
                    rawC,
                    rawI
                );
            }
            
            if (!isClone) {
                const flatEquip = makeFlatShadedGeometry(rawV, rawC, rawI);
                equipIndicesLength = flatEquip.indices.length;

                if (!equipVertexBuffer) equipVertexBuffer = gl.createBuffer();
                uploadDynamicBuffer(gl, equipVertexBuffer, gl.ARRAY_BUFFER, flatEquip.vertices instanceof Float32Array ? flatEquip.vertices : new Float32Array(flatEquip.vertices));

                if (!equipColorBuffer) equipColorBuffer = gl.createBuffer();
                uploadDynamicBuffer(gl, equipColorBuffer, gl.ARRAY_BUFFER, flatEquip.colors instanceof Float32Array ? flatEquip.colors : new Float32Array(flatEquip.colors));

                if (!equipNormalBuffer) equipNormalBuffer = gl.createBuffer();
                uploadDynamicBuffer(gl, equipNormalBuffer, gl.ARRAY_BUFFER, flatEquip.normals instanceof Float32Array ? flatEquip.normals : new Float32Array(flatEquip.normals));

                if (!equipIndexBuffer) equipIndexBuffer = gl.createBuffer();
                if (equipIndexBuffer._uploadedCount !== equipIndicesLength) {
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
                  const idxData = (supportUint32 && equipIndicesLength > 65535)
                    ? (flatEquip.indices instanceof Uint32Array ? flatEquip.indices : new Uint32Array(flatEquip.indices))
                    : (flatEquip.indices instanceof Uint16Array ? flatEquip.indices : new Uint16Array(flatEquip.indices));
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
                  equipIndexBuffer._uploadedCount = equipIndicesLength;
                }
            }
        } else {
            if (!isClone) {
                equipIndicesLength = 0;
            }
        }

        const merged = mergeMeshes(meshesToMerge);
        const localMerged = mergeMeshes(localMeshesToMerge);
        if (isClone) {
          if (!window.cloneMeshBuffers) window.cloneMeshBuffers = {};
          const cb = window.cloneMeshBuffers;
          cb.indicesLength = merged.indices.length;

          const vertData = merged.vertices instanceof Float32Array ? merged.vertices : new Float32Array(merged.vertices);
          const localVertData = localMerged.vertices instanceof Float32Array ? localMerged.vertices : new Float32Array(localMerged.vertices);
          const normData = merged.normals instanceof Float32Array ? merged.normals : new Float32Array(merged.normals);
          const colData = merged.colors instanceof Float32Array ? merged.colors : new Float32Array(merged.colors);

          if (!cb.vertexBuffer) cb.vertexBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, cb.vertexBuffer, gl.ARRAY_BUFFER, vertData);

          if (!cb.localVertexBuffer) cb.localVertexBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, cb.localVertexBuffer, gl.ARRAY_BUFFER, localVertData);

          if (!cb.normalBuffer) cb.normalBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, cb.normalBuffer, gl.ARRAY_BUFFER, normData);

          if (!cb.colorBuffer) cb.colorBuffer = gl.createBuffer();
          uploadDynamicBuffer(gl, cb.colorBuffer, gl.ARRAY_BUFFER, colData);

          if (merged.texcoords) {
            if (!cb.texCoordBuffer) {
              cb.texCoordBuffer = gl.createBuffer();
            }
            uploadDynamicBuffer(gl, cb.texCoordBuffer, gl.ARRAY_BUFFER, merged.texcoords instanceof Float32Array ? merged.texcoords : new Float32Array(merged.texcoords));
          }

          if (!cb.indexBuffer) cb.indexBuffer = gl.createBuffer();
          if (cb.indexBuffer._uploadedCount !== cb.indicesLength) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cb.indexBuffer);
            const idxData = (supportUint32 && cb.indicesLength > 65535)
              ? (merged.indices instanceof Uint32Array ? merged.indices : new Uint32Array(merged.indices))
              : (merged.indices instanceof Uint16Array ? merged.indices : new Uint16Array(merged.indices));
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
            cb.indexBuffer._uploadedCount = cb.indicesLength;
          }
          return;
        }

        charIndicesLength = merged.indices.length;
        charRawVertices = merged.vertices;

        const vertData = merged.vertices instanceof Float32Array ? merged.vertices : new Float32Array(merged.vertices);
        const localVertData = localMerged.vertices instanceof Float32Array ? localMerged.vertices : new Float32Array(localMerged.vertices);
        const normData = merged.normals instanceof Float32Array ? merged.normals : new Float32Array(merged.normals);
        const colData = merged.colors instanceof Float32Array ? merged.colors : new Float32Array(merged.colors);

        if (!charVertexBuffer) charVertexBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charVertexBuffer, gl.ARRAY_BUFFER, vertData);

        if (!charLocalVertexBuffer) charLocalVertexBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charLocalVertexBuffer, gl.ARRAY_BUFFER, localVertData);

        if (!charNormalBuffer) charNormalBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charNormalBuffer, gl.ARRAY_BUFFER, normData);

        if (!charColorBuffer) charColorBuffer = gl.createBuffer();
        uploadDynamicBuffer(gl, charColorBuffer, gl.ARRAY_BUFFER, colData);

        if (merged.texcoords) {
          if (typeof window.charTexCoordBuffer === "undefined" || !window.charTexCoordBuffer) {
            window.charTexCoordBuffer = gl.createBuffer();
          }
          uploadDynamicBuffer(gl, window.charTexCoordBuffer, gl.ARRAY_BUFFER, merged.texcoords instanceof Float32Array ? merged.texcoords : new Float32Array(merged.texcoords));
          window.charTexCoordBuffer._sourceType = "classic";
        }

        if (!charIndexBuffer) charIndexBuffer = gl.createBuffer();
        if (charIndexBuffer._uploadedCount !== charIndicesLength || charIndexBuffer._sourceType !== "classic") {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
          const idxData = (supportUint32 && charIndicesLength > 65535)
            ? (merged.indices instanceof Uint32Array ? merged.indices : new Uint32Array(merged.indices))
            : (merged.indices instanceof Uint16Array ? merged.indices : new Uint16Array(merged.indices));
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.DYNAMIC_DRAW);
          charIndexBuffer._uploadedCount = charIndicesLength;
          charIndexBuffer._sourceType = "classic";
        }
      }

      function getCharacterMatrix() {
        if (ragdollEnabled && ragdollInitialized) {
          if (typeof window !== "undefined" && window.characterModel === "chibi") {
            const rx = (typeof ragdollAxis !== "undefined" && ragdollAxis && !isNaN(ragdollAxis[0])) ? ragdollAxis[0] : 1;
            const ry = (typeof ragdollAxis !== "undefined" && ragdollAxis && !isNaN(ragdollAxis[1])) ? ragdollAxis[1] : 0;
            const rz = (typeof ragdollAxis !== "undefined" && ragdollAxis && !isNaN(ragdollAxis[2])) ? ragdollAxis[2] : 0;
            const angle = (typeof ragdollAngle === "number" && !isNaN(ragdollAngle)) ? ragdollAngle : 0;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const t = 1 - c;

            const m00 = t * rx * rx + c;
            const m01 = t * rx * ry - s * rz;
            const m02 = t * rx * rz + s * ry;

            const m10 = t * rx * ry + s * rz;
            const m11 = t * ry * ry + c;
            const m12 = t * ry * rz - s * rx;

            const m20 = t * rx * rz - s * ry;
            const m21 = t * ry * rz + s * rx;
            const m22 = t * rz * rz + c;

            const b = (typeof ragdollBaseMatrix !== "undefined" && ragdollBaseMatrix && ragdollBaseMatrix.length >= 16 && !isNaN(ragdollBaseMatrix[0]))
              ? ragdollBaseMatrix
              : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

            const R_rot = [
              m00 * b[0] + m01 * b[1] + m02 * b[2],
              m10 * b[0] + m11 * b[1] + m12 * b[2],
              m20 * b[0] + m21 * b[1] + m22 * b[2],
            ];
            const N_rot = [
              m00 * b[4] + m01 * b[5] + m02 * b[6],
              m10 * b[4] + m11 * b[5] + m12 * b[6],
              m20 * b[4] + m21 * b[5] + m22 * b[6],
            ];
            const F_rot = [
              m00 * b[8] + m01 * b[9] + m02 * b[10],
              m10 * b[8] + m11 * b[9] + m12 * b[10],
              m20 * b[8] + m21 * b[9] + m22 * b[10],
            ];

            const rp = (typeof ragdollPos !== "undefined" && ragdollPos && !isNaN(ragdollPos[0])) ? ragdollPos : [0, 0, 0];
            const scale = (typeof playerScale === "number") ? playerScale : 1.0;
            return [
              R_rot[0] * scale, R_rot[1] * scale, R_rot[2] * scale, 0,
              N_rot[0] * scale, N_rot[1] * scale, N_rot[2] * scale, 0,
              F_rot[0] * scale, F_rot[1] * scale, F_rot[2] * scale, 0,
              rp[0], rp[1], rp[2], 1
            ];
          }
          return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        }
        const sinTheta = Math.sin(charTheta);
        const cosTheta = Math.cos(charTheta);
        const sinPhi = Math.sin(charPhi);
        const cosPhi = Math.cos(charPhi);

        const nx = sinTheta * cosPhi;
        const ny = cosTheta;
        const nz = sinTheta * sinPhi;

        const height = getVisualHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const charScale = playerScale;

        let feetRadiusBefore = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + height * HEIGHT_SCALE);
        const caveData = typeof getTerrainSurfaceAndCeiling === "function"
          ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore)
          : { ground: RADIUS + height * HEIGHT_SCALE, insideTunnel: false, ceiling: Infinity };
        let terrainRadius = caveData.ground;
        const waterRadius = RADIUS + waterLevel * 0.15;
        let wRadiusLocal = typeof getWaterRadiusAt === "function"
          ? getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore)
          : waterRadius;
        
        if (caveData.insideTunnel && wRadiusLocal === 0) {
            wRadiusLocal = waterRadius;
        }

        if (typeof getWaterRadiusAt !== "function") {
          const latCharForSwim = Math.round((charTheta / Math.PI) * Math.min(currentGridSize, 200));
          let phiCharForSwim = charPhi;
          if (phiCharForSwim < 0) phiCharForSwim += Math.PI * 2;
          const longCharForSwim = Math.round((phiCharForSwim / (Math.PI * 2)) * Math.min(currentGridSize, 200));
          const gridIdxCharSwim = latCharForSwim * (Math.min(currentGridSize, 200) + 1) + longCharForSwim;
          if (typeof waterMask !== 'undefined' && waterMask && waterMask[gridIdxCharSwim] === 0) {
             if (!caveData.insideTunnel) {
                 wRadiusLocal = 0;
             }
          }
        }

        let swimFactor = 0.0;
        
        let currentFeetRadius = terrainRadius;

        if (false) { // Disabled: allow water in caves
            swimFactor = 0.0;
        } else if (activeRidingBoat) {
            swimFactor = 0.0;
        } else if (waterEnabled && currentFeetRadius < wRadiusLocal) {
          const depth = wRadiusLocal - currentFeetRadius;
          const swimThreshold = 0.48 * charScale;
          if (depth > swimThreshold) {
            swimFactor = Math.min(
              1.0,
              (depth - swimThreshold) / (0.15 * charScale),
            );
          }
        }

        const standOffset = ragdollEnabled
          ? 0.08 * charScale
          : 0.46 * charScale;
        let groundRadius = terrainRadius + standOffset;
        if (playerCenterRadius !== null) {
            groundRadius = playerCenterRadius;
        } else {
          if (activeRidingBoat) {
            let boatRad = activeRidingBoat.position ? Math.sqrt(activeRidingBoat.position[0]**2 + activeRidingBoat.position[1]**2 + activeRidingBoat.position[2]**2) : 0;
            if (boatRad > 1.0) {
              groundRadius = boatRad + 0.46 * charScale;
            } else {
              let baseRadius = (waterEnabled && terrainRadius < waterRadius) ? waterRadius : terrainRadius;
              if (waterEnabled && terrainRadius < waterRadius) {
                const wave = getWaterWave(nx * waterRadius, ny * waterRadius, nz * waterRadius, waterAnimTime, waveStrength);
                baseRadius += wave;
              }
              // Since the boat sits at baseRadius - 0.04, the player stands at baseRadius - 0.04 + 0.46 * charScale
              groundRadius = baseRadius - 0.04 + 0.46 * charScale;
            }
          } else if (typeof activeRidingMech !== "undefined" && activeRidingMech) {
            groundRadius = terrainRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71);
          } else if (swimFactor > 0.0) {

            const targetSwimRadius =
              waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
            const subSwimRadius = targetSwimRadius - playerDiveDepth;
            groundRadius =
              groundRadius * (1.0 - swimFactor) + subSwimRadius * swimFactor;

            // Enforce surface limits only when not inside a cave tunnel
            if (typeof caveData !== 'undefined' && caveData && !caveData.insideTunnel) {
              // No ceiling checks needed on the surface
            }
  
            // Add gentle water bobbing (only if not diving deeply)
            const bobSpeed = isWalking ? 4.0 : 2.0;
            const bobAmp = isWalking ? 0.02 : 0.04;
            const bobFactor = Math.max(
              0,
              1.0 - playerDiveDepth / (0.1 * charScale),
            );
            const bobbing =
              Math.sin(waterTime * bobSpeed) * bobAmp * charScale * bobFactor;
            groundRadius += bobbing;
          }
        }

        let px = groundRadius * nx;
        let py = groundRadius * ny;
        let pz = groundRadius * nz;

        const N = [nx, ny, nz];

        const East = [-sinPhi, 0, cosPhi];
        const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];

        const cosH = Math.cos(charHeading);
        const sinH = Math.sin(charHeading);

        const R = [
          East[0] * cosH - North[0] * sinH,
          East[1] * cosH - North[1] * sinH,
          East[2] * cosH - North[2] * sinH,
        ];
        const F = [
          North[0] * cosH + East[0] * sinH,
          North[1] * cosH + East[1] * sinH,
          North[2] * cosH + East[2] * sinH,
        ];

        let finalN = [N[0], N[1], N[2]];
        let finalF = [F[0], F[1], F[2]];
        let finalR = [R[0], R[1], R[2]];

        if (ragdollEnabled) {
          // Lay flat on back: Rotate -90 degrees around the right axis R
          // So local Y (up) becomes -F (facing backward along ground), and local Z (forward/chest) becomes N (pointing away from planet)
          finalN = [-F[0], -F[1], -F[2]];
          finalF = [N[0], N[1], N[2]];

          // Add a slight roll/twist to make the ragdoll look beautifully imperfect
          const angleRoll = 0.35;
          const cosRoll = Math.cos(angleRoll);
          const sinRoll = Math.sin(angleRoll);

          // rotate finalR and finalF around finalN:
          const r0 = finalR[0] * cosRoll - finalF[0] * sinRoll;
          const r1 = finalR[1] * cosRoll - finalF[1] * sinRoll;
          const r2 = finalR[2] * cosRoll - finalF[2] * sinRoll;

          const f0 = finalR[0] * sinRoll + finalF[0] * cosRoll;
          const f1 = finalR[1] * sinRoll + finalF[1] * cosRoll;
          const f2 = finalR[2] * sinRoll + finalF[2] * cosRoll;

          finalR = [r0, r1, r2];
          finalF = [f0, f1, f2];
        } else if (activeRidingBoat && activeRidingBoat.normal && activeRidingBoat.F && activeRidingBoat.R) {
          finalN = [activeRidingBoat.normal[0], activeRidingBoat.normal[1], activeRidingBoat.normal[2]];
          finalF = [activeRidingBoat.F[0], activeRidingBoat.F[1], activeRidingBoat.F[2]];
          finalR = [activeRidingBoat.R[0], activeRidingBoat.R[1], activeRidingBoat.R[2]];

          // Bank the player model with the boat hull in flight
          if (activeRidingBoat.bankAngle && Math.abs(activeRidingBoat.bankAngle) > 0.0001) {
            const cosB = Math.cos(activeRidingBoat.bankAngle);
            const sinB = Math.sin(activeRidingBoat.bankAngle);
            const bR = [
              finalR[0] * cosB - finalN[0] * sinB,
              finalR[1] * cosB - finalN[1] * sinB,
              finalR[2] * cosB - finalN[2] * sinB
            ];
            const bN = [
              finalN[0] * cosB + finalR[0] * sinB,
              finalN[1] * cosB + finalR[1] * sinB,
              finalN[2] * cosB + finalR[2] * sinB
            ];
            finalR = bR;
            finalN = bN;
          }

          if (activeRidingBoat.position) {
            px = activeRidingBoat.position[0] + finalN[0] * 0.46 * charScale;
            py = activeRidingBoat.position[1] + finalN[1] * 0.46 * charScale;
            pz = activeRidingBoat.position[2] + finalN[2] * 0.46 * charScale;
          }
        } else if (swimFactor > 0.0) {
          const isChibi = typeof window !== "undefined" && window.characterModel === "chibi";
          // Sinks neck-deep when stationary, tilts forward smoothly when swimming (for classic procedural model)
          // For GLB models (Chibi), Swim_Forward and Swim_Idle already have the body pitch baked into the skeletal animation,
          // so we don't add the procedural ~75-degree body tilt.
          let tiltAngle = isChibi ? 0.0 : (
            swimFactor *
            (Math.PI * 0.03 + swimMovementFactor * (Math.PI * 0.39))
          );

          // Add additional pitch/tilt based on diving depth change rate or camera pitch when moving (only when submerged)
          if (
            isWalking &&
            lastMoveForwardInput !== 0 &&
            playerDiveDepth > 0.05 * charScale
          ) {
            // rotationX is positive when looking down, so moving forward tilts nose-down (positive tilt)
            // and moving backward tilts nose-up (negative tilt)
            tiltAngle += lastMoveForwardInput * rotationX * 0.6 * swimFactor;
          }

          const cosT = Math.cos(tiltAngle);
          const sinT = Math.sin(tiltAngle);

          finalN = [
            N[0] * cosT + F[0] * sinT,
            N[1] * cosT + F[1] * sinT,
            N[2] * cosT + F[2] * sinT,
          ];
          finalF = [
            -N[0] * sinT + F[0] * cosT,
            -N[1] * sinT + F[1] * cosT,
            -N[2] * sinT + F[2] * cosT,
          ];
        }

        const rx = [
          finalR[0] * charScale,
          finalR[1] * charScale,
          finalR[2] * charScale,
        ];
        const ry = [
          finalN[0] * charScale,
          finalN[1] * charScale,
          finalN[2] * charScale,
        ];
        const rz = [
          finalF[0] * charScale,
          finalF[1] * charScale,
          finalF[2] * charScale,
        ];

        return [
          rx[0],
          rx[1],
          rx[2],
          0,
          ry[0],
          ry[1],
          ry[2],
          0,
          rz[0],
          rz[1],
          rz[2],
          0,
          px,
          py,
          pz,
          1,
        ];
      }
      // Central shared swimming transform computation (Used by Player and PlayerClones)
      window.computeSwimmingTransform = function(opts) {
        const {
          swimFactor = 0.0,
          swimMovementFactor = 0.0,
          diveDepth = 0.0,
          waterRadius = 20.0,
          terrainRadius = 20.0,
          charScale = 0.1,
          isWalking = false,
          waterTime = 0,
          N = [0, 1, 0],
          F = [0, 0, 1],
          R = [1, 0, 0],
          baseGroundRadius = 20.0
        } = opts;

        let groundRadius = baseGroundRadius;
        let finalN = [N[0], N[1], N[2]];
        let finalF = [F[0], F[1], F[2]];
        let finalR = [R[0], R[1], R[2]];

        if (swimFactor > 0.0) {
          const targetSwimRadius = waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const subSwimRadius = targetSwimRadius - diveDepth;
          groundRadius = groundRadius * (1.0 - swimFactor) + subSwimRadius * swimFactor;

          // Gentle water bobbing
          const bobSpeed = isWalking ? 4.0 : 2.0;
          const bobAmp = isWalking ? 0.02 : 0.04;
          const bobFactor = Math.max(0, 1.0 - diveDepth / (0.1 * charScale));
          const bobbing = Math.sin(waterTime * bobSpeed) * bobAmp * charScale * bobFactor;
          groundRadius += bobbing;

          // Forward swimming horizontal tilt
          const tiltAngle = swimFactor * (Math.PI * 0.03 + swimMovementFactor * (Math.PI * 0.39));
          const cosT = Math.cos(tiltAngle);
          const sinT = Math.sin(tiltAngle);

          finalN = [
            N[0] * cosT + F[0] * sinT,
            N[1] * cosT + F[1] * sinT,
            N[2] * cosT + F[2] * sinT,
          ];
          finalF = [
            -N[0] * sinT + F[0] * cosT,
            -N[1] * sinT + F[1] * cosT,
            -N[2] * sinT + F[2] * cosT,
          ];
        }

        return { groundRadius, finalN, finalF, finalR };
      };

      if (typeof window !== "undefined") {
        window.getCharacterMatrix = getCharacterMatrix;
        window.updateCharacterMesh = updateCharacterMesh;
        window.computeSwimmingTransform = computeSwimmingTransform;
      }

      let reusableWaterFloat32Array = null;

      // Hair style cycle handler
      window.cyclePlayerHair = function() {
        const numStyles = window.NUM_HAIR_STYLES || 8;
        if (window.playerHairStyle === undefined) {
          window.playerHairStyle = 0;
        } else {
          window.playerHairStyle = (window.playerHairStyle + 1) % numStyles;
        }
        const colors = window.ANIME_HAIR_COLORS || [[0.85, 0.90, 0.96]];
        window.playerHairColor = colors[window.playerHairStyle % colors.length];
        const name = window.HAIR_STYLE_NAMES ? window.HAIR_STYLE_NAMES[window.playerHairStyle] : `Style #${window.playerHairStyle + 1}`;
        if (typeof showNotice === "function") {
          showNotice(`💇‍♀️ เปลี่ยนทรงผมแล้ว: ${name}`);
        }
      };

      // ============================================
      // ระบบควบคุมตัวละครและกล้องติดตาม
      // ============================================
      const keysPressed = {};
      window.keysPressed = keysPressed;
      window.clearKeysPressed = () => { for (let k in keysPressed) keysPressed[k] = false; };
      window.addEventListener("keydown", (e) => {
        if (window.isWaitingForKey) return;
        initAudio();
        if (e.code === "KeyH") {
          window.cyclePlayerHair();
        }
        if (e.code === currentKeyBindings.demolish || e.code === "CapsLock") {
          isDemolishModeEnabled = !isDemolishModeEnabled;
          if (isDemolishModeEnabled) {
            isTerrainModModeEnabled = false;
            cancelFloorPlacement();
          } else {
            window.activeDemolishTarget = null;
            if (typeof World3DUI !== "undefined") {
              World3DUI.hideAimReticle();
            }
            const prompt = document.getElementById("interactPrompt");
            if (prompt) prompt.style.display = "none";
          }
          showNotice("โหมดรื้อถอน: " + (isDemolishModeEnabled ? "เปิด" : "ปิด") + " / Demolish Mode: " + (isDemolishModeEnabled ? "ON" : "OFF"));
          updateDemolishBanner();
          updateTerrainModBanner();
        }
        // Terrain modification mode (V key) has been disabled.
        /*
        if (e.code === currentKeyBindings.terrainMod || e.code === "KeyV") {
          isTerrainModModeEnabled = !isTerrainModModeEnabled;
          if (isTerrainModModeEnabled) {
            isDemolishModeEnabled = false;
            cancelFloorPlacement();
          }
          showNotice("โหมดขุด/ถมดิน: " + (isTerrainModModeEnabled ? "เปิด" : "ปิด") + " / Terrain Mod Mode: " + (isTerrainModModeEnabled ? "ON" : "OFF"));
          updateDemolishBanner();
          updateTerrainModBanner();
        }
        */
        if (e.code === (typeof currentKeyBindings !== "undefined" && currentKeyBindings.rotate ? currentKeyBindings.rotate : "KeyQ") || e.code === "KeyQ" || e.key === "q" || e.key === "Q") {
          if (isPlacingFloor) {
            placementRotationAngle = (placementRotationAngle + Math.PI / 2) % (Math.PI * 2);
            if (typeof window !== "undefined") {
              window.placementRotationAngle = placementRotationAngle;
            }
            if (floorPreviewCollectible) {
              floorPreviewCollectible.angle = placementRotationAngle;
            }
            if (typeof playPlaceSound === "function") {
              playPlaceSound();
            }
            showNotice("หมุนหลังคา/โมเดลแล้ว (Rotated) [Q]");
            pendingCollectibleRefresh = true;
            if (typeof refreshCollectiblesVBO === "function") {
              refreshCollectiblesVBO('preview');
            }
          }
        }
        if (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight" || (typeof currentKeyBindings !== "undefined" && e.code === currentKeyBindings.toggleMouse)) {
          e.preventDefault();
          if (!e.repeat) {
            if (typeof window.toggleVirtualCursorVisibility === "function") {
              window.toggleVirtualCursorVisibility();
            }
          }
        }
        if (e.code === currentKeyBindings.interact) {
          if (activeInteractNPC) {
            if (activeInteractNPC.type === 'meganeura') {
              const itemsFound = [{ name: "MEGANEURA", count: 1, icon: "🦟", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บแมลงแล้ว! (Bug picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  activeInteractNPC.r = RADIUS + newHeight * HEIGHT_SCALE + 0.3;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 3;
                  activeInteractNPC.maxHp = 3;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'isopod') {
              const itemsFound = [{ name: "ISOPOD", count: 1, icon: "🦐", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บไอโซพอดแล้ว! (Isopod picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius - 0.02) + 0.02;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 2;
                  activeInteractNPC.maxHp = 2;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'obsidian_cube') {
              const itemsFound = [{ name: "OBSIDIAN_CUBE", count: 1, icon: "🔶", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บศิลาออบซิเดียนแล้ว! (Obsidian Cube picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius) + 1.25;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 6;
                  activeInteractNPC.maxHp = 6;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else {
              activeInteractNPC.hp = 0;
              activeInteractNPC.ragdollEnabled = true;
              if (typeof playSplashSound === "function") {
                playSplashSound(0.8);
              }
            }
            const npcPrompt = document.getElementById("npcKillPrompt");
            if (npcPrompt) npcPrompt.style.display = "none";
            activeInteractNPC = null;
          } else {
            // 1. Action Reach check for Axe and Pickaxe
            let bestLineItemT = Infinity;
            let bestLineItem = null;
            for (let item of collectibles) {
              if (item.active && (item.type === "axe" || item.type === "pickaxe")) {
                const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                if (reachInfo.valid) {
                  if (reachInfo.t < bestLineItemT) {
                    bestLineItemT = reachInfo.t;
                    bestLineItem = item;
                  }
                }
              }
            }

            let found = false;
            let bestDistSq = Infinity;
            let bestItem = null;

            if (bestLineItem) {
              bestItem = bestLineItem;
            } else {
              // 2. Action Reach check for other collectibles
              for (let item of collectibles) {
                if (!item.active) continue;
                if (item.type === "planet_core" || item.type === "wood_stairs" || item.type === "wood_floor" || item.type === "thin_wood_floor" || item.type === "stone_floor" || item.type === "obsidian_pad_warp_item" || item.type === "obsidian_compass_pad_item" || item.type === "campfire" || item.type === "wood_boat" || item.type === "boat" || (typeof item.type === "string" && item.type.toLowerCase().includes("boat")) || item.type === "wood_wheel" || item.type === "electric_engine" || item.type === "boat_wing" || item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door" || item.type === "wood_chest" || item.type === "axe" || item.type === "pickaxe" || item.type.startsWith("robot_")) continue;
                
                const reachInfo = isTargetWithinReach(item.position, actionReachDistance);
                if (reachInfo.valid) {
                  const distSq = reachInfo.perpSq;
                  if (distSq < bestDistSq) {
                    bestDistSq = distSq;
                    bestItem = item;
                  }
                }
              }
            }

            if (bestItem) {
              let item = bestItem;
              let icon = "🌿";
              let label = "BRANCH";
              if (item.type === "rock") { icon = "🪨"; label = "ROCK"; }
              else if (item.type === "big_rock") { icon = "🪨"; label = "BIG_ROCK"; }
              else if (item.type === "iron_ore") { icon = "🟥"; label = "IRON_ORE"; }
              else if (item.type === "gold_ore") { icon = "🪙"; label = "GOLD_ORE"; }
              else if (item.type === "glow_ore") { icon = "✨"; label = "GLOW_ORE"; }
              else if (item.type === "glow_battery") { icon = "🔋"; label = "GLOW_BATTERY"; }
              else if (item.type === "log") { icon = "🪵"; label = "LOG"; }
              else if (item.type === "axe") { icon = "🪓"; label = "AXE"; }
              else if (item.type === "pickaxe") { icon = "⛏️"; label = "PICKAXE"; }
              else if (item.type === "plank" || item.type === "wood_floor" || item.type === "thin_wood_floor") { icon = "🪵"; label = item.type === "thin_wood_floor" ? "THIN_WOOD_FLOOR" : "WOOD_FLOOR"; }
              else if (item.type === "stone_floor") { icon = "🪨"; label = "STONE_FLOOR"; }
              else if (item.type === "campfire") { icon = "🔥"; label = "CAMPFIRE"; }
              else if (item.type === "wood_boat") { icon = "🛶"; label = "WOOD_BOAT"; }
              else if (item.type === "robot_stand") { icon = "🏗️"; label = "ROBOT_STAND"; }
              else if (item.type === "robot_cockpit") { icon = "🤖"; label = "ROBOT_COCKPIT"; }
              else if (item.type === "robot_left_arm") { icon = "🦾"; label = "ROBOT_LEFT_ARM"; }
              else if (item.type === "robot_right_arm") { icon = "🦾"; label = "ROBOT_RIGHT_ARM"; }
              else if (item.type === "robot_left_leg") { icon = "🦿"; label = "ROBOT_LEFT_LEG"; }
              else if (item.type === "robot_right_leg") { icon = "🦿"; label = "ROBOT_RIGHT_LEG"; }
              else if (item.type === "wood_wheel") { icon = "🛞"; label = "WOOD_WHEEL"; }
              else if (item.type === "electric_engine") { icon = "🔋"; label = "ELECTRIC_ENGINE"; }
              else if (item.type === "boat_wing") { icon = "🪽"; label = "BOAT_WING"; }
              else if (item.type === "meganeura_item") { icon = "🦟"; label = "MEGANEURA"; }
              else if (item.type === "isopod_item") { icon = "🦐"; label = "ISOPOD"; }
              else if (item.type === "wooden_arm_cannon") { icon = "🪵🦾"; label = "WOODEN_ARM_CANNON"; }
              
              const itemData = {
                icon: icon,
                label: label,
                name: label
              };

              if (addItemToInventory(itemData)) {
                item.active = false;
                collectedCount[item.type] = (collectedCount[item.type] || 0) + 1;
                if (item.isDynamic) {
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  pendingCollectibleRefresh = true;
                }
                found = true;
              }
            }
          }
        }
        keysPressed[e.code] = true;
      });
      window.addEventListener("keyup", (e) => {
        if (window.isWaitingForKey) return;
        if (e.key === "Alt" || e.code === "AltLeft" || e.code === "AltRight" || (typeof currentKeyBindings !== "undefined" && e.code === currentKeyBindings.toggleMouse)) {
          e.preventDefault();
        }
        keysPressed[e.code] = false;
      });


      // ============================================
      // ระบบป้องการชนของกล้อง (Camera Collision Avoidance)
      // ============================================
      let currentSmoothDistance = 2.0;

      const cameraCollisionToggle = document.getElementById(
        "cameraCollisionToggle",
      );
      if (cameraCollisionToggle) {
        cameraCollisionToggle?.addEventListener("click", () => {
          cameraCollisionEnabled = !cameraCollisionEnabled;
          if (cameraCollisionEnabled) {
            cameraCollisionToggle.textContent = "🛡️ ระบบกันกล้องชนวัตถุ: เปิด";
            cameraCollisionToggle.classList.add("active");
          } else {
            cameraCollisionToggle.textContent = "🛡️ ระบบกันกล้องชนวัตถุ: ปิด";
            cameraCollisionToggle.classList.remove("active");
          }
        });
      }

      const zoomLimitToggle = document.getElementById("zoomLimitToggle");
      if (zoomLimitToggle) {
        zoomLimitToggle?.addEventListener("click", () => {
          zoomLimitEnabled = !zoomLimitEnabled;
          if (zoomLimitEnabled) {
            zoomLimitToggle.textContent = "🔍 จำกัดระยะซูมออก: เปิด";
            zoomLimitToggle.classList.add("active");
            zoom = Math.min(7.5, zoom);
          } else {
            zoomLimitToggle.textContent = "🔍 จำกัดระยะซูมออก: ปิด";
            zoomLimitToggle.classList.remove("active");
          }
        });
      }

      const ragdollToggle = document.getElementById("ragdollToggle");
      if (ragdollToggle) {
        ragdollToggle?.addEventListener("click", () => {
          setRagdoll(!ragdollEnabled);
        });
      }

      const npcSummonBtn = document.getElementById("npcSummonBtn");
      if (npcSummonBtn) {
        npcSummonBtn?.addEventListener("click", () => {
          if (amphibians && amphibians.length > 0) {
            // Spread amphibians around the player
            for (let i = 0; i < amphibians.length; i++) {
              let a = amphibians[i];

              // Spawn close to the player
              const distance = 0.05 + Math.random() * 0.02; // Close distance
              const angle = Math.random() * Math.PI * 2;
              const offsetTheta = distance * Math.cos(angle);
              const offsetPhi =
                (distance * Math.sin(angle)) /
                Math.max(0.1, Math.sin(charTheta));

              a.theta = charTheta + offsetTheta;
              a.phi = charPhi + offsetPhi;
              a.heading = Math.random() * Math.PI * 2;

              const height = getVisualHeightOnSphere(a.theta, a.phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              const gRadius = RADIUS + height * HEIGHT_SCALE;
              const sinT = Math.sin(a.theta);
              const cosT = Math.cos(a.theta);
              const sinP = Math.sin(a.phi);
              const cosP = Math.cos(a.phi);
              const ax = sinT * cosP * gRadius;
              const ay = cosT * gRadius;
              const az = sinT * sinP * gRadius;
              let wRadius = getWaterRadiusAt(ax, ay, az, false);

              // Set r properly based on where they land
              if (gRadius > wRadius - 0.02) {
                a.r = gRadius + 0.05; // Drop on land
                a.isSwimming = false;
              } else {
                a.r = wRadius - 0.05; // Drop in water
                a.isSwimming = true;
              }
            }

            // Show some visual feedback or alert? No alert needed.
          }
        });
      }

      const npcKillPromptBtn = document.getElementById("npcKillPrompt");
      if (npcKillPromptBtn) {
        npcKillPromptBtn?.addEventListener("click", () => {
          if (activeInteractNPC) {
            if (activeInteractNPC.type === 'meganeura') {
              const itemsFound = [{ name: "MEGANEURA", count: 1, icon: "🦟", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บแมลงแล้ว! (Bug picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  activeInteractNPC.r = RADIUS + newHeight * HEIGHT_SCALE + 0.3;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 3;
                  activeInteractNPC.maxHp = 3;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'isopod') {
              const itemsFound = [{ name: "ISOPOD", count: 1, icon: "🦐", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บไอโซพอดแล้ว! (Isopod picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius - 0.02) + 0.02;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 2;
                  activeInteractNPC.maxHp = 2;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else if (activeInteractNPC.type === 'obsidian_cube') {
              const itemsFound = [{ name: "OBSIDIAN_CUBE", count: 1, icon: "🔶", seed: activeInteractNPC.seed }];
              if (typeof addItemToInventory === "function") {
                const success = addItemToInventory(itemsFound[0]);
                if (success) {
                  showNotice("เก็บศิลาออบซิเดียนแล้ว! (Obsidian Cube picked up)");
                  if (typeof playCollectSound === "function") playCollectSound();
                  
                  // Force respawn it immediately
                  activeInteractNPC.theta = Math.random() * Math.PI;
                  activeInteractNPC.phi = Math.random() * Math.PI * 2;
                  const seed = globalSeed || 1234.5;
                  const newHeight = getVisualHeightOnSphere(activeInteractNPC.theta, activeInteractNPC.phi, seed);
                  const wRadius = RADIUS + waterLevel * 0.15;
                  const gRadius = RADIUS + newHeight * HEIGHT_SCALE;
                  activeInteractNPC.r = Math.max(gRadius, wRadius) + 1.25;
                  activeInteractNPC.ragdollEnabled = false;
                  activeInteractNPC.ragdollInitialized = false;
                  activeInteractNPC.ragdollPos = null;
                  activeInteractNPC.ragdollVel = null;
                  activeInteractNPC.ragdollAsleep = false;
                  activeInteractNPC.ragdollSleepFrames = 0;
                  activeInteractNPC.ragdollAngle = 0;
                  activeInteractNPC.ragdollAngularSpeed = 0;
                  activeInteractNPC.hp = 6;
                  activeInteractNPC.maxHp = 6;

                  const sinT = Math.sin(activeInteractNPC.theta);
                  const cosT = Math.cos(activeInteractNPC.theta);
                  const sinP = Math.sin(activeInteractNPC.phi);
                  const cosP = Math.cos(activeInteractNPC.phi);
                  activeInteractNPC.position = [sinT * cosP * activeInteractNPC.r, cosT * activeInteractNPC.r, sinT * sinP * activeInteractNPC.r];

                  // Remove arrows attached to this NPC
                  for (let coll of collectibles) {
                    if (coll.attachedToNPC === activeInteractNPC) {
                      coll.attachedToNPC = null;
                      coll.active = false;
                    }
                  }
                  window.pendingCollectibleRefresh = true;
                  window.pendingDynamicCollectibleRefresh = true;
                } else {
                  showNotice("กระเป๋าเต็ม! (Inventory full)");
                }
              }
            } else {
              activeInteractNPC.hp = 0;
              activeInteractNPC.ragdollEnabled = true;
              if (typeof playSplashSound === "function") {
                playSplashSound(0.8);
              }
            }
            npcKillPromptBtn.style.display = "none";
            activeInteractNPC = null;
          }
        });
      }

      function checkCameraCollision(p, playerHeadPos, waterRadius, prefiltered = null) {
        return CollisionCore.checkCameraCollision(p, playerHeadPos, waterRadius, prefiltered);
        /*
        const distToCenter = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        if (distToCenter < 0.001) return true;

        // 1. ชนพื้นผิวของดาว (Planet Terrain) หรือฝาถ้ำ/พื้นถ้ำ (Cave Floor/Ceiling)
        const ux = p[0] / distToCenter;
        const uy = p[1] / distToCenter;
        const uz = p[2] / distToCenter;
        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
        const phi = Math.atan2(uz, ux);
        const h = getVisualHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const terrainRadius = RADIUS + h * HEIGHT_SCALE;

        const playerFeetRadius = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : terrainRadius;
        const camCaveData = { insideTunnel: false };

        if (camCaveData.insideTunnel) {
          // ในถ้ำ: ชนพื้นถ้ำ หรือ ชนเพดานถ้ำ (มีระยะเผื่อปลอดภัย)
          const buffer = 0.08;
          if (distToCenter < camCaveData.ground + buffer) {
            return true;
          }
          if (camCaveData.ceiling !== Infinity && distToCenter > camCaveData.ceiling - buffer) {
            return true;
          }
        } else {
          // นอกถ้ำ: ชนพื้นผิวปกติ
          if (distToCenter < terrainRadius + 0.08) {
            return true;
          }
        }

        // 2. ชนผิวน้ำ (Water Surface)
        if (waterEnabled) {
          const playerHeadDist = Math.sqrt(
            playerHeadPos[0] * playerHeadPos[0] +
              playerHeadPos[1] * playerHeadPos[1] +
              playerHeadPos[2] * playerHeadPos[2],
          );
          if (playerHeadDist > waterRadius) {
            // หากตัวผู้เล่นอยู่เหนือน้ำ ไม่ให้กล้องตกอยู่ใต้น้ำ
            if (distToCenter < waterRadius + 0.04) {
              return true;
            }
          } else {
            // หากตัวผู้เล่นอยู่ใต้น้ำ ไม่ให้กล้องทะลุขึ้นเหนือน้ำ
            if (distToCenter > waterRadius - 0.04) {
              return true;
            }
          }
        }

        // 3. ชนวัตถุอื่นๆ (Obstacles: nature & cubes)
        const checkObstacleCollisions = (obstacles, extraCushion, mask) => {
          const maxDistSq = maxColliderDistance * maxColliderDistance;
          for (let obs of obstacles) {
            if (mask !== undefined && obs.layer !== undefined && !(mask & obs.layer)) continue;
            if (!obs.position) continue;
            
            const dx = p[0] - obs.position[0];
            const dy = p[1] - obs.position[1];
            const dz = p[2] - obs.position[2];
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq > maxDistSq) continue;

            if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
              const checkDist = obs.radius + extraCushion;
              if (distSq > checkDist * checkDist) continue;
              
              const collisionEnd = obs.collisionMeshEnd !== undefined ? obs.collisionMeshEnd : obs.meshEnd;
              const count = collisionEnd - obs.meshStart;
              let hit = false;

              for (let j = 0; j < count; j += 3) {
                const vIdx = obs.meshStart + j;
                const a = [natureRawVertices[vIdx*3], natureRawVertices[vIdx*3+1], natureRawVertices[vIdx*3+2]];
                const b = [natureRawVertices[(vIdx+1)*3], natureRawVertices[(vIdx+1)*3+1], natureRawVertices[(vIdx+1)*3+2]];
                const c = [natureRawVertices[(vIdx+2)*3], natureRawVertices[(vIdx+2)*3+1], natureRawVertices[(vIdx+2)*3+2]];
                const closest = closestPointOnTriangle(p, a, b, c);
                const ctx = p[0] - closest[0];
                const cty = p[1] - closest[1];
                const ctz = p[2] - closest[2];
                if (ctx*ctx + cty*cty + ctz*ctz < extraCushion * extraCushion) {
                    hit = true;
                    break;
                }
              }
              if (hit) return true;
            } else if (obs.colliders && obs.colliders.length > 0) {
              for (let col of obs.colliders) {
                const cx = obs.position[0] + (col.offset[0] || 0);
                const cy = obs.position[1] + (col.offset[1] || 0);
                const cz = obs.position[2] + (col.offset[2] || 0);
                const cdx = p[0] - cx;
                const cdy = p[1] - cy;
                const cdz = p[2] - cz;
                const cdistSq = cdx * cdx + cdy * cdy + cdz * cdz;
                const colRad = col.radius + extraCushion;
                if (cdistSq < colRad * colRad) return true;
            }
          } else {
              const collisionRadius = obs.radius + extraCushion;
              if (distSq < collisionRadius * collisionRadius) {
                return true;
              }
            }
          }
          return false;
        };

        if (prefiltered) {
          if (checkObstacleCollisions(prefiltered.nature, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(prefiltered.cubes, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(prefiltered.amphibians, 0.12, ~COLLISION_LAYERS.TREE)) return true;
        } else {
          if (checkObstacleCollisions(natureObstacles, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(cubeObstacles, 0.12, ~COLLISION_LAYERS.TREE)) return true;
          if (checkObstacleCollisions(amphibians, 0.12, ~COLLISION_LAYERS.TREE)) return true;
        }

        const itemsToCheck = prefiltered ? prefiltered.collectibles : collectibles;

        // 4. ชนกำแพงไม้และพื้นไม้ที่ผู้เล่นสร้างไว้
        for (let other of itemsToCheck) {
          if (other.active && !other.isPreview) {
            if (other.type === "wood_wall" || other.type === "wood_window" || other.type === "wood_door") {
              const wallCenterRadius = Math.sqrt(
                other.position[0] * other.position[0] +
                other.position[1] * other.position[1] +
                other.position[2] * other.position[2]
              );
              
              const wallHeight = 0.25;
              
              // ตรวจสอบระยะรัศมีของตำแหน่งทดสอบของกล้อง
              const camRadius = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
              const cushionHeight = 0.05;
              
              if (camRadius > wallCenterRadius - cushionHeight && camRadius < wallCenterRadius + wallHeight + cushionHeight) {
                // คำนวณแกนหมุนของกำแพง
                const angle = other.angle || 0.0;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                
                const wallR = [
                  other.R[0] * cosA + other.F[0] * sinA,
                  other.R[1] * cosA + other.F[1] * sinA,
                  other.R[2] * cosA + other.F[2] * sinA
                ];
                const wallF = [
                  other.F[0] * cosA - other.R[0] * sinA,
                  other.F[1] * cosA - other.R[1] * sinA,
                  other.F[2] * cosA - other.R[2] * sinA
                ];
                const wallN = other.normal || [0, 1, 0];
                
                // เวกเตอร์จากจุดศูนย์กลางกำแพงไปยังตำแหน่งกล้อง p
                const dx_vec = [
                  p[0] - other.position[0],
                  p[1] - other.position[1],
                  p[2] - other.position[2]
                ];
                
                // โปรเจกต์ลงบนแกนของกำแพง
                const dx = dx_vec[0] * wallR[0] + dx_vec[1] * wallR[1] + dx_vec[2] * wallR[2];
                const dz = dx_vec[0] * wallF[0] + dx_vec[1] * wallF[1] + dx_vec[2] * wallF[2];
                const dy = dx_vec[0] * wallN[0] + dx_vec[1] * wallN[1] + dx_vec[2] * wallN[2];
                
                const halfD = 0.025; // ครึ่งความหนากำแพง
  
                // Check if there is an active wood_door or wood_window sharing the same snapped position (or very close)
                let hasCoLocatedDoor = false;
                let hasCoLocatedWindow = false;
                if (other.type === "wood_wall") {
                  for (let d of itemsToCheck) {
                    if (d.active && (d.type === "wood_door" || d.type === "wood_window")) {
                      const ox = d.position[0] - other.position[0];
                      const oy = d.position[1] - other.position[1];
                      const oz = d.position[2] - other.position[2];
                      if (ox*ox + oy*oy + oz*oz < 0.005) {
                        if (d.type === "wood_door") hasCoLocatedDoor = true;
                        if (d.type === "wood_window") hasCoLocatedWindow = true;
                      }
                    }
                  }
                }
  
                let segments = [];
                if (hasCoLocatedDoor) {
                  segments.push({ cx: -0.1095, hw: 0.0405 });
                  segments.push({ cx: 0.1095, hw: 0.0405 });
                } else if (hasCoLocatedWindow) {
                  // Window is solid frame, leaves hole in middle
                  if (dy >= 0.075 && dy < 0.185) {
                    segments.push({ cx: -0.1175, hw: 0.0325 });
                    segments.push({ cx: 0.1175, hw: 0.0325 });
                  } else {
                    segments.push({ cx: 0.0, hw: 0.15 });
                  }
                } else {
                  segments.push({ cx: 0.0, hw: 0.15 });
                }
  
                let inCollision = false;
                for (let seg of segments) {
                  const ldx = dx - seg.cx;
                  const cushionR = seg.hw + 0.1; // รัศมีกันกล้องชนตามแนวขวาง
                  const cushionF = halfD + 0.1; // รัศมีกันกล้องชนตามความหนา
                  const cushionUp = 0.05;
  
                  if (Math.abs(ldx) < cushionR && Math.abs(dz) < cushionF && dy >= -cushionUp && dy <= wallHeight + cushionUp) {
                    inCollision = true;
                    break;
                  }
                }
  
                if (inCollision) {
                  return true;
                }
              }
            } else if (other.type === "wood_floor" || other.type === "thin_wood_floor" || other.type === "stone_floor" || other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item") {
              const dx_vec = [
                p[0] - other.position[0],
                p[1] - other.position[1],
                p[2] - other.position[2]
              ];
              
              const dx = dx_vec[0] * other.R[0] + dx_vec[1] * other.R[1] + dx_vec[2] * other.R[2];
              const dz = dx_vec[0] * other.F[0] + dx_vec[1] * other.F[1] + dx_vec[2] * other.F[2];
              const dy = dx_vec[0] * other.normal[0] + dx_vec[1] * other.normal[1] + dx_vec[2] * other.normal[2];
              
              const isStone = other.type === "stone_floor";
              const isObsidianPad = other.type === "obsidian_pad_warp_item" || other.type === "obsidian_compass_pad_item";
              const hw = isStone ? other.size * 6.0 : 0.15;
              const h = isObsidianPad ? 0.033 : (isStone ? other.size * 0.15 : (other.type === "wood_floor" ? woodFloorHeight + 0.25 * 0.12 : 0.25 * 0.04));
              
              const cushionR = hw + 0.1;
              const cushionUp = 0.1;
              const cushionDown = h/2 + cushionUp;
              
              if (Math.abs(dx) < cushionR && Math.abs(dz) < cushionR && dy >= -cushionDown && dy <= h/2 + cushionUp) {
                return true;
              }
            }
          }
        }
        */
        return false;
      }