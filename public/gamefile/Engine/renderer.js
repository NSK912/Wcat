

      // --- Shaders ---
      const modelVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute vec3 aNormal;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uLightSpaceMatrix;
            uniform vec3 uTint;
            uniform float uTime;
            uniform float uSwayFactor;
            uniform float uWaterSwayFactor;
            uniform float uPlanetRadius;
            uniform float uWaterRadius;
            uniform float uRenderDistEnabled;
            uniform float uMaxRenderDist;
            
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vIsGrass;
            
            void main() {
                vec3 pos = aPosition;
                
                vec3 actualColor = aColor * (length(uTint) > 0.001 ? uTint : vec3(1.0));
                bool isGrass = false;
                float vertexType = 1.0;
                if (aColor.r < 0.0) {
                    isGrass = true;
                    if (aColor.r < -9.0) {
                        actualColor.r = -aColor.r - 10.0;
                        vertexType = 0.0;
                    } else {
                        actualColor.r = -aColor.r;
                        vertexType = 1.0;
                    }
                }
                bool isTree = false;
                bool isTreeLeaf = false;
                float treeSwayWeight = 0.0;
                if (aColor.b < -0.5) {
                    isTree = true;
                    float encoded = -aColor.b;
                    actualColor.b = mod(encoded, 2.0);
                    float rawSway = floor(encoded / 2.0) - 10.0;
                    if (rawSway >= 500.0) {
                        isTreeLeaf = true;
                        rawSway -= 1000.0;
                    }
                    treeSwayWeight = max(0.0, rawSway / 100.0);
                }
                bool isLeaf = isGrass || isTreeLeaf;
                float distToCenter = length(pos);
                bool isSeaweed = !isTree && !isGrass && (distToCenter < uWaterRadius) && (actualColor.g > 0.38 && actualColor.g > actualColor.r * 1.35 && actualColor.g > actualColor.b * 1.15);
                
                vec4 baseMvPos = uModelViewMatrix * vec4(pos, 1.0);
                float vertexCamDist = length(baseMvPos.xyz);
                bool outsideRenderRange = (uRenderDistEnabled > 0.5 && vertexCamDist > uMaxRenderDist);

                if ((isLeaf || isTree) && uSwayFactor > 0.0 && !outsideRenderRange) {
                    float h = distToCenter - uPlanetRadius;
                    
                    if (isGrass || isTree || h > 0.01) {
                        vec3 up = normalize(pos);
                        vec3 tangent = vec3(1.0, 0.0, 0.0);
                        if (abs(up.x) > 0.9) {
                            tangent = vec3(0.0, 1.0, 0.0);
                        }
                        vec3 bitangent = cross(up, tangent);
                        tangent = cross(bitangent, up);

                        if (isTree) {
                            // Very gentle branch/trunk sway. Note that treeSwayWeight is 0.0 for trunks (meaning no sway!)
                            float swayAmount = treeSwayWeight * 0.03 * uSwayFactor;
                            
                            // Slower time scaling for calm, organic motion
                            float windPhase = uTime * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                            float branchWind = sin(windPhase);

                            // We want a pure linear displacement along a fixed wind direction vector in the tangent plane.
                            // This completely eliminates any circular orbital rotation/spinning around the trunk.
                            vec3 windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                            pos += windDir * branchWind * swayAmount;

                            if (isTreeLeaf) {
                                // Leaf flutter (gentle fluttering, base of leaf is anchored)
                                float leafPhase = uTime * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                                float leafWind = sin(leafPhase);
                                float lSway = 0.0025 * treeSwayWeight * uSwayFactor; // Very subtle fluttering

                                // Pure linear flutter direction in the tangent plane to prevent spinning
                                vec3 flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                                pos += flutterDir * leafWind * lSway;
                            }
                        } else {
                            // Grass sway
                            float swayAmount = isGrass ? (vertexType * 0.15 * uSwayFactor) : 0.0;

                            float windX = sin(uTime * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                            float windZ = cos(uTime * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                            float macroWindX = sin(uTime * 0.15) * 0.5 - 1.5;
                            float macroWindZ = cos(uTime * 0.15) * 0.5 + 1.2;
                            pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                            pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
                        }
                    }
                } else if (isSeaweed && uWaterSwayFactor > 0.0 && !outsideRenderRange) {
                    // Seaweed/Kelp: Sway with fluid water viscosity
                    float h = max(0.0, distToCenter - uPlanetRadius);
                    // Pivot anchor: base doesn't sway, sway increases with height
                    float swayAmount = max(0.0, h - 0.015) * 0.9 * uWaterSwayFactor;
                    
                    // Fluid physics: Slower frequencies & high-density phase shifts (waves)
                    float waterSwayX = sin(uTime * 0.7 + pos.y * 14.0 + pos.x * 5.0);
                    float waterSwayZ = cos(uTime * 0.7 + pos.y * 14.0 + pos.z * 5.0);
                    
                    // Slower background current drift
                    float currentX = sin(uTime * 0.15) * 0.5;
                    float currentZ = cos(uTime * 0.15) * 0.5;
                    
                    pos.x += (waterSwayX * 0.14 + currentX * 0.15) * swayAmount;
                    pos.z += (waterSwayZ * 0.14 + currentZ * 0.15) * swayAmount;
                }
                
                vec4 mvPosition = uModelViewMatrix * vec4(pos, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vColor = actualColor;
                vNormal = mat3(uModelViewMatrix) * aNormal;
                
                if (isGrass) {
                    vWorldNormal = normalize(pos);
                    vIsGrass = 1.0;
                } else {
                    vWorldNormal = aNormal;
                    vIsGrass = 0.0;
                }

                vViewPos = mvPosition.xyz;
                vWorldPos = pos;
                vPositionLightSpace = uLightSpaceMatrix * vec4(pos, 1.0);
                vDist = length(mvPosition.xyz);
            }
        `;

      const modelFragmentShaderSource = `
            precision highp float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewPos;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vIsGrass;
            uniform vec3 uLightDir;
            uniform sampler2D uShadowMap;
            
            uniform float uRenderDistEnabled;
            uniform float uMaxRenderDist;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform vec3 uCameraPos;
            uniform float uTime;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;

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
                if (uRenderDistEnabled > 0.5 && vDist > uMaxRenderDist) {
                    discard;
                }
                vec3 normal = normalize(vWorldNormal);
                vec3 lightDir = normalize(uLightDir);
                
                // Diffuse
                float diffuseVal = max(dot(normal, lightDir), 0.0);
                
                // Shadow
                float shadow = calculateShadow(vPositionLightSpace, normalize(vWorldNormal), normalize(uLightDir));
                if (diffuseVal <= 0.0) {
                    shadow = 0.0;
                }
                float lit = mix(0.3, 1.0, shadow);
                float diffuse = diffuseVal * lit * 0.8 + 0.2;
                
                // Specular
                vec3 viewDir = normalize(uCameraPos - vWorldPos);
                vec3 halfDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.25 * shadow;
                
                // Fresnel
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.15;
                
                vec3 finalColor = vColor * diffuse + vec3(1.0) * spec + vec3(0.95, 0.97, 1.0) * fresnel;
                 if (vIsGrass > 0.5) {
                     // Grass is slightly brighter and doesn't get fully shadowed to stand out
                     finalColor = vColor * diffuseVal * 1.2 + vec3(0.1, 0.2, 0.05);
                 }

                 // Glowing Ore & Obsidian Pad (White Core & Gold Accents Glow)
                 bool isGlowingOre = (abs(vColor.r - 0.22) < 0.08 && abs(vColor.g - 0.95) < 0.08 && abs(vColor.b - 0.88) < 0.08);
                 bool isWhiteGlow = (abs(vColor.r - 0.98) < 0.03 && abs(vColor.g - 0.98) < 0.03 && abs(vColor.b - 1.0) < 0.03);
                 bool isGoldGlow = (abs(vColor.r - 0.95) < 0.04 && abs(vColor.g - 0.78) < 0.04 && abs(vColor.b - 0.23) < 0.04);
                 if (isGlowingOre || isWhiteGlow) {
                     float pulse = 0.94 + 0.12 * sin(uTime * 3.0 + vWorldPos.x * 2.8 + vWorldPos.y * 2.8 + vWorldPos.z * 2.8);
                     float rimFactor = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
                     float crystalGlint = pow(max(dot(normal, halfDir), 0.0), 32.0) * 0.4;
                     vec3 glowColor = vColor * pulse;
                     vec3 rimGlow = vColor * (rimFactor * 0.35);
                     vec3 glintColor = vColor * crystalGlint;
                     finalColor = clamp(glowColor * 1.15 + rimGlow + glintColor, 0.0, 1.0);
                 } else if (isGoldGlow) {
                     // Ratio-locked 24K Gold Glow: keeps G/R ratio strictly at ~0.82 so it never shifts to yellow (G/R > 0.9) or orange (G/R < 0.7)
                     float pulse = 0.96 + 0.04 * sin(uTime * 2.8 + vWorldPos.x * 2.5 + vWorldPos.y * 2.5 + vWorldPos.z * 2.5);
                     float rimFactor = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);
                     float goldGlint = pow(max(dot(normal, halfDir), 0.0), 28.0) * 0.45;
                     float lum = clamp(0.88 + 0.07 * diffuseVal + 0.05 * rimFactor, 0.86, 1.0) * pulse;
                     vec3 baseGold = vec3(0.95, 0.78, 0.23) * lum;
                     finalColor = mix(baseGold, vec3(1.0, 0.90, 0.48), clamp(goldGlint, 0.0, 0.42));
                 }

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                float glassAlpha = 1.0;
                bool isGlass = (abs(vColor.r - 0.6) < 0.01 && abs(vColor.g - 0.8) < 0.01 && abs(vColor.b - 1.0) < 0.01);
                if (isGlass) {
                    // Base opacity of the glass is low (translucent), but increases at grazing/Fresnel angles
                    glassAlpha = mix(0.35, 0.75, fresnel);

                    // Proximity factor to only show strong reflections when close to the window
                    // Extended distance range (from 15.0m to 1.0m) so reflection is beautiful at normal play distance
                    float reflectionProximity = smoothstep(15.0, 1.0, vDist);

                    // Compute world-space reflection ray
                    vec3 viewDirWorld = normalize(vWorldPos - uCameraPos);
                    vec3 normalWorld = normalize(vWorldNormal);
                    vec3 reflVecWorld = reflect(viewDirWorld, normalWorld);

                    // local coordinate frame for the window pane
                    vec3 localUp = normalize(vWorldPos); // Radially outward from planet center
                    vec3 localTangent = normalize(cross(localUp, normalWorld));

                    // Project reflection ray onto the local frame
                    float reflUp = dot(reflVecWorld, localUp);
                    float reflTangent = dot(reflVecWorld, localTangent);
                    float reflNormal = dot(reflVecWorld, normalWorld);

                    vec3 reflectedColor = vec3(0.0);

                    // 1. SKY / ATMOSPHERE REFLECTION (Upwards direction)
                    vec3 skyColor = mix(vec3(0.12, 0.18, 0.35), vec3(0.55, 0.75, 1.0), max(0.0, dot(reflVecWorld, lightDir)) * 0.4 + 0.6);
                    // Add soft clouds
                    float cloudPattern = sin(reflVecWorld.x * 3.5 + uTime * 0.05) * cos(reflVecWorld.z * 3.5 + uTime * 0.04) * 0.5 + 0.5;
                    if (cloudPattern > 0.58) {
                        skyColor = mix(skyColor, vec3(0.96, 0.98, 1.0), (cloudPattern - 0.58) * 1.6);
                    }

                    // 2. GROUND / TERRAIN / WATER REFLECTION (Downwards direction)
                    vec3 groundColor = vec3(0.48, 0.32, 0.18); // Wood floor / earth brown
                    // Check if it's below water level (ocean reflection)
                    float reflectDistToCenter = length(vWorldPos + reflVecWorld * 2.0);
                    if (reflectDistToCenter < uWaterRadius) {
                        groundColor = mix(groundColor, vec3(0.12, 0.48, 0.58), 0.85); // Beautiful turquoise water reflection
                    } else {
                        // Procedural wood/grass tiles on ground reflection
                        float grassTile = sin(vWorldPos.x * 2.0 + reflVecWorld.x * 4.0) * cos(vWorldPos.z * 2.0 + reflVecWorld.z * 4.0);
                        if (grassTile > 0.1) {
                            groundColor = mix(groundColor, vec3(0.28, 0.46, 0.16), 0.75); // Grass/tree reflection
                        }
                    }

                    // 3. ADJACENT WOOD WALLS / COLUMNS / WINDOW FRAMES (Horizontal sides)
                    // We project virtual adjacent walls at regular intervals along the wall direction
                    float wallU = reflTangent / (abs(reflNormal) + 0.01);
                    float wallV = reflUp / (abs(reflNormal) + 0.01);

                    // Wooden walls have vertical planks (wood panels) and horizontal joints
                    float verticalPlanks = step(0.88, abs(sin(wallU * 6.28)));
                    float horizontalPlanks = step(0.93, abs(sin(wallV * 3.14)));
                    
                    // Dark brown wood structure reflection
                    vec3 structureColor = mix(vec3(0.38, 0.22, 0.12), vec3(0.20, 0.11, 0.06), max(verticalPlanks, horizontalPlanks));
                    
                    // Add some natural green wood moss / forest reflection spots
                    float leafSpots = sin(wallU * 1.5 + wallV * 2.0) * cos(wallV * 1.2 - wallU * 0.8);
                    if (leafSpots > 0.4) {
                        structureColor = mix(structureColor, vec3(0.18, 0.38, 0.12), 0.65); // Surrounding leaves / bushes
                    }

                    // Blend different components based on reflection ray angles
                    if (reflUp >= 0.0) {
                        // Upper half: blend sky with adjacent walls
                        float skyFactor = smoothstep(0.0, 0.4, reflUp);
                        reflectedColor = mix(structureColor, skyColor, skyFactor);
                    } else {
                        // Lower half: blend ground/water with structures
                        float groundFactor = smoothstep(0.0, -0.4, reflUp);
                        reflectedColor = mix(structureColor, groundColor, groundFactor);
                    }

                    // Soft specular glow on the reflection
                    reflectedColor += vec3(1.0, 1.0, 1.0) * spec * 0.5;

                    // Blend final color with reflection based on proximity and Fresnel angle
                    finalColor = mix(finalColor, reflectedColor, reflectionProximity * (0.50 + 0.45 * fresnel));

                    // Boost specular glare when standing close (reflection highlight)
                    finalColor += vec3(1.0, 1.0, 1.0) * spec * (1.2 + 2.8 * reflectionProximity);

                    // Add a gorgeous stylized diagonal reflection shine/stripe
                    float diagLine = fract((vWorldPos.x + vWorldPos.y + vWorldPos.z) * 6.0);
                    float shineStripe = smoothstep(0.85, 0.92, diagLine) * smoothstep(0.99, 0.92, diagLine);
                    finalColor += vec3(1.0, 1.0, 1.0) * shineStripe * 0.38;
                }

                // Atmospheric Fog / Mist at Terrain Max Render Distance
                if (uRenderDistEnabled > 0.5) {
                    float fogStart = uMaxRenderDist * 0.55;
                    float fogFactor = smoothstep(fogStart, uMaxRenderDist, vDist);
                    vec3 fogDir = normalize(vWorldPos - uCameraPos);
                    float sunDot = max(dot(fogDir, lightDir), 0.0);
                    vec3 baseSkyFog = vec3(0.012, 0.035, 0.09);
                    vec3 litSkyFog = vec3(0.08, 0.14, 0.24);
                    vec3 atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
                    if (length(uCameraPos) < uWaterRadius || dist < uWaterRadius) {
                        atmosphericFog = mix(atmosphericFog, uWaterColor * 0.6, 0.85);
                    }
                    finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
                }

                gl_FragColor = vec4(finalColor, glassAlpha);
            }
        `;

      const depthVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            uniform mat4 uModelMatrix;
            uniform mat4 uLightSpaceMatrix;
            uniform float uTime;
            uniform float uSwayFactor;
            uniform float uWaterSwayFactor;
            uniform float uPlanetRadius;
            uniform float uWaterRadius;
            void main() {
                if (length(aPosition) < 0.01) {
                    gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
                    return;
                }
                vec3 pos = aPosition;
                
                vec3 actualColor = aColor;
                bool isGrass = false;
                float vertexType = 1.0;
                if (aColor.r < 0.0) {
                    isGrass = true;
                    if (aColor.r < -9.0) {
                        actualColor.r = -aColor.r - 10.0;
                        vertexType = 0.0;
                    } else {
                        actualColor.r = -aColor.r;
                        vertexType = 1.0;
                    }
                }
                bool isTree = false;
                bool isTreeLeaf = false;
                float treeSwayWeight = 0.0;
                if (aColor.b < -0.5) {
                    isTree = true;
                    float encoded = -aColor.b;
                    actualColor.b = mod(encoded, 2.0);
                    float rawSway = floor(encoded / 2.0) - 10.0;
                    if (rawSway >= 500.0) {
                        isTreeLeaf = true;
                        rawSway -= 1000.0;
                    }
                    treeSwayWeight = max(0.0, rawSway / 100.0);
                }
                bool isLeaf = isGrass || isTreeLeaf;
                float distToCenter = length(pos);
                bool isSeaweed = !isTree && !isGrass && (distToCenter < uWaterRadius) && (actualColor.g > 0.38 && actualColor.g > actualColor.r * 1.35 && actualColor.g > actualColor.b * 1.15);
                
                if ((isLeaf || isTree) && uSwayFactor > 0.0) {
                    float h = distToCenter - uPlanetRadius;
                    
                    if (isGrass || isTree || h > 0.01) {
                        vec3 up = normalize(pos);
                        vec3 tangent = vec3(1.0, 0.0, 0.0);
                        if (abs(up.x) > 0.9) {
                            tangent = vec3(0.0, 1.0, 0.0);
                        }
                        vec3 bitangent = cross(up, tangent);
                        tangent = cross(bitangent, up);

                        if (isTree) {
                            // Very gentle branch/trunk sway. Note that treeSwayWeight is 0.0 for trunks (meaning no sway!)
                            float swayAmount = treeSwayWeight * 0.03 * uSwayFactor;
                            
                            // Slower time scaling for calm, organic motion
                            float windPhase = uTime * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                            float branchWind = sin(windPhase);

                            // We want a pure linear displacement along a fixed wind direction vector in the tangent plane.
                            // This completely eliminates any circular orbital rotation/spinning around the trunk.
                            vec3 windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                            pos += windDir * branchWind * swayAmount;

                            if (isTreeLeaf) {
                                // Leaf flutter (gentle fluttering, base of leaf is anchored)
                                float leafPhase = uTime * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                                float leafWind = sin(leafPhase);
                                float lSway = 0.0025 * treeSwayWeight * uSwayFactor; // Very subtle fluttering

                                // Pure linear flutter direction in the tangent plane to prevent spinning
                                vec3 flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                                pos += flutterDir * leafWind * lSway;
                            }
                        } else {
                            // Grass sway
                            float swayAmount = isGrass ? (vertexType * 0.15 * uSwayFactor) : 0.0;

                            float windX = sin(uTime * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                            float windZ = cos(uTime * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                            float macroWindX = sin(uTime * 0.15) * 0.5 - 1.5;
                            float macroWindZ = cos(uTime * 0.15) * 0.5 + 1.2;
                            pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                            pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
                        }
                    }
                } else if (isSeaweed && uWaterSwayFactor > 0.0) {
                    // Seaweed/Kelp: Sway with fluid water viscosity
                    float h = max(0.0, distToCenter - uPlanetRadius);
                    float swayAmount = max(0.0, h - 0.015) * 0.9 * uWaterSwayFactor;
                    
                    float waterSwayX = sin(uTime * 0.7 + pos.y * 14.0 + pos.x * 5.0);
                    float waterSwayZ = cos(uTime * 0.7 + pos.y * 14.0 + pos.z * 5.0);
                    
                    float currentX = sin(uTime * 0.15) * 0.5;
                    float currentZ = cos(uTime * 0.15) * 0.5;
                    
                    pos.x += (waterSwayX * 0.14 + currentX * 0.15) * swayAmount;
                    pos.z += (waterSwayZ * 0.14 + currentZ * 0.15) * swayAmount;
                }
                gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(pos, 1.0);
            }
        `;

      const depthFragmentShaderSource = `
            precision highp float;
            void main() {
                gl_FragColor = vec4(gl_FragCoord.z, gl_FragCoord.z, gl_FragCoord.z, 1.0);
            }
        `;

      const vertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            attribute float aTerrainRadius;
            attribute vec3 aTunnelCenter;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uLightSpaceMatrix;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vTerrainRadius;
            varying vec3 vTunnelCenter;
            
            void main() {
                if (length(aPosition) < 0.01) {
                    gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
                    return;
                }
                vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * mvPosition;
                vColor = aColor;
                vNormal = normalize(aPosition);
                vWorldPos = aPosition;
                vPositionLightSpace = uLightSpaceMatrix * vec4(aPosition, 1.0);
                vDist = length(mvPosition.xyz);
                vTerrainRadius = aTerrainRadius;
                vTunnelCenter = aTunnelCenter;
            }
        `;

      const fragmentShaderSource = `
            precision highp float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec4 vPositionLightSpace;
            varying float vDist;
            varying float vTerrainRadius;
            varying vec3 vTunnelCenter;
            uniform vec3 uLightDir;
            uniform float uUseLighting;
            uniform sampler2D uShadowMap;
            
            uniform float uRenderDistEnabled;
            uniform float uMaxRenderDist;
            
            uniform float uWaterRadius;
            uniform vec3 uWaterColor;
            uniform float uWaterOpacity;
            uniform sampler2D uWaterMaskTex;
            uniform vec3 uCameraPos;

            // Tunnel parameters
            uniform vec4 uTunnels[64];
            uniform int uTunnelCount;
            uniform float uIsTunnelMesh;
            uniform float uShadowsEnabled;
            uniform vec2 uShadowTexelSize;

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
                // Hole cutting or cave clipping
                if (uIsTunnelMesh > 0.5) {
                    float distToCenter = length(vWorldPos);
                    float actualTerrainRadius = abs(vTerrainRadius);
                    bool isCollar = vTerrainRadius < 0.0;
                    
                    // Discard only the clamped flat roof of the cave sphere (which is exactly at actualTerrainRadius)
                    if (!isCollar && distToCenter > actualTerrainRadius - 0.02) {
                        discard;
                    }
                    // If overlapping with another tunnel, discard the inner wall so tunnels connect smoothly
                    for (int i = 0; i < 64; i++) {
                        if (i < uTunnelCount) {
                            vec4 t = uTunnels[i];
                            // Skip the owner tunnel sphere of this vertex
                            if (length(t.xyz - vTunnelCenter) < 0.05) continue;
                            vec3 diff = vWorldPos - t.xyz;
                            if (dot(diff, diff) < (t.w * 0.94) * (t.w * 0.94)) {
                                discard;
                            }
                        }
                    }
                } else {
                    for (int i = 0; i < 64; i++) {
                        if (i < uTunnelCount) {
                            vec4 t = uTunnels[i];
                            vec3 diff = vWorldPos - t.xyz;
                            if (dot(diff, diff) < (t.w * 0.96) * (t.w * 0.96)) {
                                discard;
                            }
                        }
                    }
                }

                if (uRenderDistEnabled > 0.5 && vDist > uMaxRenderDist) {
                    discard;
                }
                vec3 finalColor;
                if (uUseLighting > 0.5) {
                    vec3 normal = normalize(vNormal);
                    vec3 lightDir = normalize(uLightDir);
                    float diffuseVal = max(dot(normal, lightDir), 0.0);
                    
                    // Shadow
                    float shadow = calculateShadow(vPositionLightSpace, normal, lightDir);
                    if (diffuseVal <= 0.0) {
                        shadow = 0.0;
                    }
                    float lit = mix(0.3, 1.0, shadow);
                    float diffuse = diffuseVal * lit * 0.8 + 0.2;
                    finalColor = vColor * diffuse;
                } else {
                    finalColor = vColor;
                }

                // Glowing Ore Emissive Radiance - คงสีเดิม (Cyan/Teal) ไม่ฟอกขาว
                bool isGlowingOre = (abs(vColor.r - 0.22) < 0.08 && abs(vColor.g - 0.95) < 0.08 && abs(vColor.b - 0.88) < 0.08);
                if (isGlowingOre) {
                    vec3 normalGlow = normalize(vNormal);
                    vec3 viewDirGlow = normalize(uCameraPos - vWorldPos);
                    float rim = pow(1.0 - max(dot(normalGlow, viewDirGlow), 0.0), 2.5);
                    finalColor = clamp(vColor * 1.15 + vColor * (rim * 0.35), 0.0, 1.0);
                }

                // Apply Water Volume Tint & Fog
                float dist = length(vWorldPos);
                if (dist < uWaterRadius) {
                    float depth = uWaterRadius - dist;
                    float tintFactor = 1.0 - exp(-depth * 5.0);
                    tintFactor = clamp(tintFactor * uWaterOpacity, 0.0, 0.85);
                    finalColor = mix(finalColor, uWaterColor, tintFactor);
                }

                // Atmospheric Fog / Mist at Object Max Render Distance
                if (uRenderDistEnabled > 0.5) {
                    float fogStart = uMaxRenderDist * 0.60;
                    float fogFactor = smoothstep(fogStart, uMaxRenderDist, vDist);
                    vec3 fogDir = normalize(vWorldPos - uCameraPos);
                    vec3 lightDir = normalize(uLightDir);
                    float sunDot = max(dot(fogDir, lightDir), 0.0);
                    vec3 baseSkyFog = vec3(0.012, 0.035, 0.09);
                    vec3 litSkyFog = vec3(0.08, 0.14, 0.24);
                    vec3 atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
                    if (length(uCameraPos) < uWaterRadius || dist < uWaterRadius) {
                        atmosphericFog = mix(atmosphericFog, uWaterColor * 0.6, 0.85);
                    }
                    finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

      
const skyVertexShaderSource = `
            attribute vec3 aPosition;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vWorldDir;
            void main() {
                vec4 pos = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = pos.xyww;
                vWorldDir = normalize(aPosition);
            }
        `;

      const skyFragmentShaderSource = `
            precision highp float;
            varying vec3 vWorldDir;
            uniform float uTime;
            uniform float uGasIntensity;
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
                for (int i = 0; i < 4; ++i) {
                    v += a * noise(p);
                    p = p * 2.0 + shift;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec3 dir = normalize(vWorldDir);
                
                // ดาวระยิบระยับ
                float starPattern = hash(floor(dir * 160.0));
                float stars = 0.0;
                if (starPattern > 0.995) {
                    float intensity = sin(uTime * 1.8 + starPattern * 100.0) * 0.4 + 0.6;
                    stars = pow(fract(starPattern * 1234.56), 25.0) * intensity * 2.0;
                }
                
                // กลุ่มก๊าซในอวกาศเนบิวลา (Nebula Gas)
                vec3 gasCoords = dir * 2.8 + vec3(0.0, uTime * 0.003, uTime * 0.0015);
                float n1 = fbm(gasCoords);
                float n2 = fbm(gasCoords + vec3(3.2, 1.5, -2.1));
                
                vec3 colorNebula1 = vec3(0.01, 0.005, 0.04);  // อวกาศมืดลึก
                vec3 colorNebula2 = vec3(0.08, 0.03, 0.22);   // สีม่วงแก๊สดั้งเดิม
                vec3 colorNebula3 = vec3(0.01, 0.12, 0.25);   // สีฟ้าแก๊สเรืองรอง
                vec3 colorNebula4 = vec3(0.28, 0.04, 0.16);   // สีแดงแก๊สรังสีดาวฤกษ์
                
                vec3 skyColor = mix(colorNebula1, colorNebula2, n1);
                skyColor = mix(skyColor, colorNebula3, n2 * 0.7);
                skyColor += colorNebula4 * max(n1 * n2 - 0.08, 0.0) * 1.5;
                
                skyColor *= uGasIntensity;
                vec3 finalColor = skyColor + vec3(stars);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

      // --- Sun & Celestial Shader ---
      const sunVertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aColor;
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewNormal;
            varying vec3 vLocalPos;
            
            void main() {
                vColor = aColor;
                vNormal = normalize(aPosition);
                vViewNormal = normalize((uModelViewMatrix * vec4(aPosition, 0.0)).xyz);
                vLocalPos = aPosition;
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
            }
      `;

      const sunFragmentShaderSource = `
            precision highp float;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vViewNormal;
            varying vec3 vLocalPos;
            uniform float uTime;
            uniform vec3 uTint;
            uniform float uIsSun; // 1.0 = Glowing Sun, 0.0 = Shaded Planet
            uniform vec3 uLightDir;

            float hash(vec3 p) {
                p = fract(p * vec3(443.897, 441.423, 437.195));
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }

            float snoise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(mix(hash(p + vec3(0.0, 0.0, 0.0)), hash(p + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(p + vec3(0.0, 1.0, 0.0)), hash(p + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                    mix(mix(hash(p + vec3(0.0, 0.0, 1.0)), hash(p + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(p + vec3(0.0, 1.0, 1.0)), hash(p + vec3(1.0, 1.0, 1.0)), f.x), f.y),
                    f.z
                );
            }

            void main() {
                if (uIsSun > 0.5) {
                    vec3 n = normalize(vNormal);
                    float pulse = sin(uTime * 1.5) * 0.03 + 1.0;

                    // View-facing limb darkening (Fresnel / Rim Corona)
                    float facing = abs(vViewNormal.z); // 1.0 at center, 0.0 at rim
                    float limb = pow(1.0 - clamp(facing, 0.0, 1.0), 1.5);

                    // Solar plasma flares / convection granulation
                    vec3 plasmaCoord = n * 6.5 + vec3(uTime * 0.06, uTime * 0.03, sin(uTime * 0.04));
                    float noise1 = snoise(plasmaCoord);
                    float noise2 = snoise(plasmaCoord * 2.4 - vec3(uTime * 0.09, uTime * 0.04, 0.0));
                    float plasma = noise1 * 0.65 + noise2 * 0.35; // 0.0 to 1.0

                    // Realistic Sun Palette:
                    // Core: Brilliant Warm Solar Gold (ไม่ใช่สีขาวล้วน)
                    vec3 coreColor = vec3(1.0, 0.88, 0.25);
                    // Mid Solar Surface: Rich Golden-Amber / Tangerine
                    vec3 midColor = vec3(1.0, 0.55, 0.04);
                    // Outer Rim & Coronal Flares: Deep Fiery Orange-Red
                    vec3 rimColor = vec3(0.92, 0.20, 0.02);

                    // Mix core to mid with dynamic solar granules
                    vec3 sunCol = mix(midColor, coreColor, clamp(plasma * 0.7 + (1.0 - limb) * 0.5, 0.0, 1.0));
                    // Mix fiery orange-red rim on edges
                    sunCol = mix(sunCol, rimColor, clamp(limb * 1.2 + (1.0 - plasma) * 0.25, 0.0, 1.0));

                    // Multiply vertex color subtly
                    sunCol *= mix(vec3(1.0), vColor, 0.4);

                    vec3 tint = (length(uTint) > 0.01) ? uTint : vec3(1.0);
                    gl_FragColor = vec4(clamp(sunCol * tint * pulse, 0.0, 1.0), 1.0);
                } else {
                    // Shaded background planet
                    vec3 normal = normalize(vNormal);
                    vec3 lDir = length(uLightDir) > 0.01 ? normalize(uLightDir) : vec3(0.0, 1.0, 0.0);
                    float diff = max(dot(normal, lDir), 0.0);
                    float ambient = 0.18;
                    float lit = diff * 0.82 + ambient;
                    
                    vec3 baseCol = (length(uTint) > 0.01) ? uTint : vColor;
                    gl_FragColor = vec4(baseCol * lit, 1.0);
                }
            }
      `;

      window.sunVertexShaderSource = sunVertexShaderSource;
      window.sunFragmentShaderSource = sunFragmentShaderSource;


      


let frustumPlanes = null;

window.isMechFullyAssembled = function(mech) {
  if (!mech) return false;
  const attached = mech.attachedParts || [];
  const hasLeftLeg = attached.some(p => p.item && p.item.active && p.item.type === "robot_left_leg");
  const hasRightLeg = attached.some(p => p.item && p.item.active && p.item.type === "robot_right_leg");
  const hasLeftArm = attached.some(p => p.item && p.item.active && p.item.type === "robot_left_arm");
  const hasRightArm = attached.some(p => p.item && p.item.active && p.item.type === "robot_right_arm");
  return hasLeftLeg && hasRightLeg && hasLeftArm && hasRightArm;
};

window.tryAutoAssembleMechParts = function(mech) {
  // Auto-assembly disabled as per player preference for manual assembly
};

// Pre-allocated Float32Arrays for uniforms to avoid GC allocations and stutters inside the render loop
const f32_finalLightDir = new Float32Array(3);
const f32_eyePos = new Float32Array(3);
const f32_waterColor = new Float32Array(3);
const f32_atmosphereColor = new Float32Array(3);
const f32_cloudsColor = new Float32Array(3);

const f32_viewMatrix = new Float32Array(16);
const f32_projMatrix = new Float32Array(16);
const f32_lightSpaceMatrix = new Float32Array(16);
const f32_modelMatrix = new Float32Array(16);
const f32_modelViewMatrix = new Float32Array(16);
const f32_reflectedModelViewMatrixStatic = new Float32Array(16);
const f32_reflectedModelViewMatrix = new Float32Array(16);
const f32_reflectedModelMatrix = new Float32Array(16);
const f32_charModelViewMatrix = new Float32Array(16);
const f32_charModelMatrix = new Float32Array(16);

const f32_identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const f32_forceZFarProj = new Float32Array(16);
const f32_gpuViewProj = new Float32Array(16);
const f32_invViewProj = new Float32Array(16);
const f32_cloudOrbitMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

const f32_boatPositions = new Float32Array(4 * 3);
const f32_boatRights = new Float32Array(4 * 3);
const f32_boatNormals = new Float32Array(4 * 3);
const f32_boatForwards = new Float32Array(4 * 3);
const f32_boatSizes = new Float32Array(4 * 3);
const f32_boatOffsets = new Float32Array(4 * 3);

const f32_waterTunnelsData = new Float32Array(64 * 4);
const f32_monkeyUData = new Float32Array(84);
const f32_webgpuSkyUniforms = new Float32Array(28);
const f32_webgpuWaterUData = new Float32Array(512);
const tunnelsWithDistPool = [];

function setF32(target, source) {
  for (let i = 0; i < source.length; i++) {
    target[i] = source[i];
  }
  return target;
}

// === SEEDPLANET MODULE: JS/RENDERER.JS ===

// ============================================
// Graphics API Manager (WebGPU + WebGL Fallback)
// ============================================
const Graphics = {
  mode: 'unknown', // 'webgpu', 'webgl', or 'hybrid'
  webgpu: {
    device: null,
    context: null,
    format: 'bgra8unorm',
    ready: false,
    skyPipeline: null,
    skyBindGroup: null,
    skyUniformBuffer: null,
    terrainPipeline: null,
    terrainShadowPipeline: null,
    terrainBindGroup: null,
    terrainUniformBuffer: null,
    terrainShadowBindGroup: null,
    terrainVertexBuffer: null,
    terrainColorBuffer: null,
    terrainIndexBuffer: null,
    terrainIndicesLength: 0,
    mainDepthTexture: null,
    mainDepthTextureView: null,
    shadowDepthTexture: null,
    shadowDepthTextureView: null,
    shadowSampler: null,
  },
  webgl: {
    gl: null,
    isWebGL2: false,
    supportUint32: false
  },

  multiplyMatrices4(a, b, out) {
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }
    return out;
  },

  invertMatrix4(a, out) {
    let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    let b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    let b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    let b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },

  async init(gpuCanvas, glCanvas) {
    console.log("Graphics API: Initializing...");
    
    // 1. Try to initialize WebGPU (Primary Target)
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (adapter) {
          this.webgpu.device = await adapter.requestDevice();
          this.webgpu.context = gpuCanvas.getContext('webgpu');
          if (this.webgpu.context) {
            this.webgpu.format = navigator.gpu.getPreferredCanvasFormat();
            this.webgpu.context.configure({
              device: this.webgpu.device,
              format: this.webgpu.format,
              alphaMode: 'opaque'
            });

            
            const modelWGSL = `
struct ModelUniforms {
    modelViewMatrix : mat4x4<f32>,
    projMatrix : mat4x4<f32>,
    lightSpaceMatrix : mat4x4<f32>,
    cameraPos : vec4<f32>,
    lightDir : vec4<f32>,
    waterColor : vec4<f32>,
    params : vec4<f32>,
    params2 : vec4<f32>,
    shadowTexelSize : vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : ModelUniforms;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>,
    @location(2) normal : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) viewPos : vec3<f32>,
    @location(3) worldNormal : vec3<f32>,
    @location(4) worldPos : vec3<f32>,
    @location(5) lightSpacePos : vec4<f32>,
    @location(6) dist : f32,
    @location(7) isGrass : f32,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    var pos = in.position;
    var actualColor = in.color;
    var isGrass = 0.0;
    var vertexType = 1.0;
    
    if (in.color.r < 0.0) {
        isGrass = 1.0;
        if (in.color.r < -9.0) {
            actualColor.r = -in.color.r - 10.0;
            vertexType = 0.0;
        } else {
            actualColor.r = -in.color.r;
            vertexType = 1.0;
        }
    }
    
    var isTree = false;
    var isTreeLeaf = false;
    var treeSwayWeight = 0.0;
    if (in.color.b < -0.5) {
        isTree = true;
        let encoded = -in.color.b;
        actualColor.b = encoded - 2.0 * floor(encoded / 2.0);
        var rawSway = floor(encoded / 2.0) - 10.0;
        if (rawSway >= 500.0) {
            isTreeLeaf = true;
            rawSway -= 1000.0;
        }
        treeSwayWeight = max(0.0, rawSway / 100.0);
    }
    
    let isLeaf = (isGrass > 0.5) || isTreeLeaf;
    let distToCenter = length(pos);
    let isSeaweed = (isTree == false) && (isGrass < 0.5) && (distToCenter < uniforms.params2.y) && (actualColor.g > 0.38 && actualColor.g > actualColor.r * 1.35 && actualColor.g > actualColor.b * 1.15);
    
    if ((isLeaf || isTree) && uniforms.params.y > 0.0) {
        let h = distToCenter - uniforms.params2.x;
        if (isGrass > 0.5 || isTree || h > 0.01) {
            let up = normalize(pos);
            var tangent = vec3<f32>(1.0, 0.0, 0.0);
            if (abs(up.x) > 0.9) { tangent = vec3<f32>(0.0, 1.0, 0.0); }
            let bitangent = cross(up, tangent);
            tangent = cross(bitangent, up);
            
            if (isTree) {
                let swayAmount = treeSwayWeight * 0.03 * uniforms.params.y;
                let windPhase = uniforms.params.x * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                let branchWind = sin(windPhase);
                let windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                pos += windDir * branchWind * swayAmount;
                
                if (isTreeLeaf) {
                    let leafPhase = uniforms.params.x * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                    let leafWind = sin(leafPhase);
                    let lSway = 0.0025 * treeSwayWeight * uniforms.params.y;
                    let flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                    pos += flutterDir * leafWind * lSway;
                }
            } else {
                var swayAmount = 0.0;
                if (isGrass > 0.5) {
                    swayAmount = vertexType * 0.15 * uniforms.params.y;
                }
                let windX = sin(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                let windZ = cos(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                let macroWindX = sin(uniforms.params.x * 0.15) * 0.5 - 1.5;
                let macroWindZ = cos(uniforms.params.x * 0.15) * 0.5 + 1.2;
                pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
            }
        }
    } else if (isSeaweed && uniforms.params.z > 0.0) {
        let h = max(0.0, distToCenter - uniforms.params2.x);
        let swayAmount = max(0.0, h - 0.015) * 0.9 * uniforms.params.z;
        let waterSwayX = sin(uniforms.params.x * 0.7 + pos.y * 14.0 + pos.x * 5.0);
        let waterSwayZ = cos(uniforms.params.x * 0.7 + pos.y * 14.0 + pos.z * 5.0);
        let currentX = sin(uniforms.params.x * 0.15) * 0.5;
        let currentZ = cos(uniforms.params.x * 0.15) * 0.5;
        pos.x += (waterSwayX * 0.14 + currentX * 0.15) * swayAmount;
        pos.z += (waterSwayZ * 0.14 + currentZ * 0.15) * swayAmount;
    }
    
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(pos, 1.0);
    out.position = uniforms.projMatrix * mvPosition;
    out.color = actualColor;
    
    let normalMatrix = mat3x3<f32>(
        uniforms.modelViewMatrix[0].xyz,
        uniforms.modelViewMatrix[1].xyz,
        uniforms.modelViewMatrix[2].xyz
    );
    out.normal = normalMatrix * in.normal;
    
    if (isGrass > 0.5) {
        out.worldNormal = normalize(pos);
        out.isGrass = 1.0;
    } else {
        out.worldNormal = in.normal;
        out.isGrass = 0.0;
    }
    
    out.viewPos = mvPosition.xyz;
    out.worldPos = pos;
    out.lightSpacePos = uniforms.lightSpaceMatrix * vec4<f32>(pos, 1.0);
    out.dist = length(mvPosition.xyz);
    
    return out;
}

fn calculateShadow(lightSpacePos: vec4<f32>, normal: vec3<f32>, lightDir: vec3<f32>) -> f32 {
    if (uniforms.params.w < 0.5) { return 1.0; }
    var projCoords = lightSpacePos.xyz / lightSpacePos.w;
    projCoords = projCoords * 0.5 + vec3<f32>(0.5);
    projCoords.y = 1.0 - projCoords.y;
    
    if (projCoords.z > 1.0 || projCoords.z < 0.0) { return 1.0; }
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) { return 1.0; }
    
    let cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
    let slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
    let bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
    
    var texelSize = uniforms.shadowTexelSize;
    if (texelSize.x <= 0.0) { texelSize = vec2<f32>(1.0 / 1024.0); }
    
    var shadow = 0.0;
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            shadow += textureSampleCompare(shadowMap, shadowSampler, projCoords.xy + offset, projCoords.z - bias);
        }
    }
    shadow = shadow / 9.0;
    
    let distFromCenter = length(projCoords.xy - vec2<f32>(0.5));
    let edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);
    return mix(1.0, shadow, edgeFade);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (uniforms.params2.z > 0.5 && in.dist > uniforms.params2.w) {
        discard;
    }
    
    let normal = normalize(in.worldNormal);
    let lightDir = normalize(uniforms.lightDir.xyz);
    let diffuseVal = max(dot(normal, lightDir), 0.0);
    
    var shadow = calculateShadow(in.lightSpacePos, normalize(in.worldNormal), normalize(uniforms.lightDir.xyz));
    if (diffuseVal <= 0.0) { shadow = 0.0; }
    let lit = mix(0.3, 1.0, shadow);
    let diffuse = diffuseVal * lit * 0.8 + 0.2;
    
    let viewDir = normalize(uniforms.cameraPos.xyz - in.worldPos);
    let halfDir = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.25 * shadow;
    
    let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.15;
    
    var finalColor = in.color * diffuse + vec3<f32>(1.0) * spec + vec3<f32>(0.95, 0.97, 1.0) * fresnel;
    if (in.isGrass > 0.5) {
        finalColor = in.color * diffuseVal * 1.2 + vec3<f32>(0.1, 0.2, 0.05);
    }
    
    let isGlowingOre = (abs(in.color.r - 0.22) < 0.08 && abs(in.color.g - 0.95) < 0.08 && abs(in.color.b - 0.88) < 0.08);
    if (isGlowingOre) {
        let pulse = 0.94 + 0.12 * sin(in.worldPos.x * 2.8 + in.worldPos.y * 2.8 + in.worldPos.z * 2.8);
        let rimFactor = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        let crystalGlint = pow(max(dot(normal, halfDir), 0.0), 32.0) * 0.4;
        let glowColor = in.color * pulse;
        let rimGlow = in.color * (rimFactor * 0.35);
        let glintColor = in.color * crystalGlint;
        finalColor = clamp(glowColor * 1.15 + rimGlow + glintColor, vec3<f32>(0.0), vec3<f32>(1.0));
    }
    
    let dist = length(in.worldPos);
    if (dist < uniforms.params2.y) {
        let depth = uniforms.params2.y - dist;
        var tintFactor = 1.0 - exp(-depth * 5.0);
        tintFactor = clamp(tintFactor * uniforms.waterColor.w, 0.0, 0.85);
        finalColor = mix(finalColor, uniforms.waterColor.xyz, tintFactor);
    }
    
    var glassAlpha = 1.0;
    let isGlass = (abs(in.color.r - 0.6) < 0.01 && abs(in.color.g - 0.8) < 0.01 && abs(in.color.b - 1.0) < 0.01);
    
    if (isGlass) {
        glassAlpha = mix(0.35, 0.75, fresnel);
        let reflectionProximity = smoothstep(15.0, 1.0, in.dist);
        let viewDirWorld = normalize(in.worldPos - uniforms.cameraPos.xyz);
        let normalWorld = normalize(in.worldNormal);
        let reflVecWorld = reflect(viewDirWorld, normalWorld);
        
        let localUp = normalize(in.worldPos);
        let localTangent = normalize(cross(localUp, normalWorld));
        let reflUp = dot(reflVecWorld, localUp);
        let reflTangent = dot(reflVecWorld, localTangent);
        let reflNormal = dot(reflVecWorld, normalWorld);
        
        var skyColor = mix(vec3<f32>(0.12, 0.18, 0.35), vec3<f32>(0.55, 0.75, 1.0), max(0.0, dot(reflVecWorld, lightDir)) * 0.4 + 0.6);
        let cloudPattern = sin(reflVecWorld.x * 3.5 + uniforms.params.x * 0.05) * cos(reflVecWorld.z * 3.5 + uniforms.params.x * 0.04) * 0.5 + 0.5;
        if (cloudPattern > 0.58) {
            skyColor = mix(skyColor, vec3<f32>(0.96, 0.98, 1.0), (cloudPattern - 0.58) * 1.6);
        }
        
        var groundColor = vec3<f32>(0.48, 0.32, 0.18);
        let reflectDistToCenter = length(in.worldPos + reflVecWorld * 2.0);
        if (reflectDistToCenter < uniforms.params2.y) {
            groundColor = mix(groundColor, vec3<f32>(0.12, 0.48, 0.58), 0.85);
        } else {
            let grassTile = sin(in.worldPos.x * 2.0 + reflVecWorld.x * 4.0) * cos(in.worldPos.z * 2.0 + reflVecWorld.z * 4.0);
            if (grassTile > 0.1) {
                groundColor = mix(groundColor, vec3<f32>(0.28, 0.46, 0.16), 0.75);
            }
        }
        
        let wallU = reflTangent / (abs(reflNormal) + 0.01);
        let wallV = reflUp / (abs(reflNormal) + 0.01);
        
        let verticalPlanks = step(0.88, abs(sin(wallU * 6.28)));
        let horizontalPlanks = step(0.93, abs(sin(wallV * 3.14)));
        var structureColor = mix(vec3<f32>(0.38, 0.22, 0.12), vec3<f32>(0.20, 0.11, 0.06), max(verticalPlanks, horizontalPlanks));
        
        let leafSpots = sin(wallU * 1.5 + wallV * 2.0) * cos(wallV * 1.2 - wallU * 0.8);
        if (leafSpots > 0.4) {
            structureColor = mix(structureColor, vec3<f32>(0.18, 0.38, 0.12), 0.65);
        }
        
        var reflectedColor = vec3<f32>(0.0);
        if (reflUp >= 0.0) {
            let skyFactor = smoothstep(0.0, 0.4, reflUp);
            reflectedColor = mix(structureColor, skyColor, skyFactor);
        } else {
            let groundFactor = smoothstep(0.0, 0.4, -reflUp);
            reflectedColor = mix(structureColor, groundColor, groundFactor);
        }
        
        finalColor = mix(finalColor, reflectedColor, reflectionProximity * 0.8);
    }
    
    return vec4<f32>(finalColor, glassAlpha);
}
`;

            const charWGSL = `
struct CharUniforms {
    modelViewMatrix : mat4x4<f32>,
    projMatrix : mat4x4<f32>,
    modelMatrix : mat4x4<f32>,
    lightSpaceMatrix : mat4x4<f32>,
    cameraPos : vec4<f32>,
    lightDir : vec4<f32>,
    waterColor : vec4<f32>,
    params : vec4<f32>,
    shadowTexelSize : vec2<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : CharUniforms;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) localPos : vec3<f32>,
    @location(2) normal : vec3<f32>,
    @location(3) color : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) localPos : vec3<f32>,
    @location(3) worldNormal : vec3<f32>,
    @location(4) worldPos : vec3<f32>,
    @location(5) lightSpacePos : vec4<f32>,
    @location(6) viewPos : vec3<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(in.position, 1.0);
    out.position = uniforms.projMatrix * mvPosition;
    
    let normalMatrix = mat3x3<f32>(
        uniforms.modelViewMatrix[0].xyz,
        uniforms.modelViewMatrix[1].xyz,
        uniforms.modelViewMatrix[2].xyz
    );
    out.normal = normalMatrix * in.normal;
    out.localPos = in.localPos;
    out.color = in.color;
    
    let worldPos = uniforms.modelMatrix * vec4<f32>(in.position, 1.0);
    
    let worldNormalMatrix = mat3x3<f32>(
        uniforms.modelMatrix[0].xyz,
        uniforms.modelMatrix[1].xyz,
        uniforms.modelMatrix[2].xyz
    );
    out.worldNormal = normalize(worldNormalMatrix * in.normal);
    out.worldPos = worldPos.xyz;
    out.lightSpacePos = uniforms.lightSpaceMatrix * worldPos;
    out.viewPos = mvPosition.xyz;
    return out;
}

fn distToSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    return length(pa - ba*h);
}

fn calculateShadow(lightSpacePos: vec4<f32>, normal: vec3<f32>, lightDir: vec3<f32>) -> f32 {
    if (uniforms.params.z < 0.5) { return 1.0; }
    var projCoords = lightSpacePos.xyz / lightSpacePos.w;
    projCoords = projCoords * 0.5 + vec3<f32>(0.5);
    projCoords.y = 1.0 - projCoords.y;
    
    if (projCoords.z > 1.0 || projCoords.z < 0.0) { return 1.0; }
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) { return 1.0; }
    
    let cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
    let slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
    let bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
    
    var texelSize = uniforms.shadowTexelSize;
    if (texelSize.x <= 0.0) { texelSize = vec2<f32>(1.0 / 1024.0); }
    
    var shadow = 0.0;
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            shadow += textureSampleCompare(shadowMap, shadowSampler, projCoords.xy + offset, projCoords.z - bias);
        }
    }
    shadow = shadow / 9.0;
    
    let distFromCenter = length(projCoords.xy - vec2<f32>(0.5));
    let edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);
    return mix(1.0, shadow, edgeFade);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.worldNormal);
    let viewDir = normalize(uniforms.cameraPos.xyz - in.worldPos);
    let lightDir = normalize(uniforms.lightDir.xyz);
    
    let diffuseVal = max(dot(normal, lightDir), 0.0);
    var shadow = calculateShadow(in.lightSpacePos, normal, lightDir);
    if (diffuseVal <= 0.0) { shadow = 0.0; }
    let lit = mix(0.3, 1.0, shadow);
    let diffuse = diffuseVal * lit * 0.75 + 0.25;
    
    let halfDir = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfDir), 0.0), 38.0) * 0.75 * shadow;
    
    let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0) * 0.25;
    var baseColor = in.color;
    
    if (in.localPos.y > 0.22 && in.localPos.y < 0.67 && in.localPos.z > 0.04 && in.localPos.z < 0.28) {
        let uv = vec2<f32>(in.localPos.x, in.localPos.y - 0.43) / 0.24;
        
        let dLeftCheek = length(vec2<f32>(uv.x - (-0.38), (uv.y - (-0.18)) * 1.3));
        let dRightCheek = length(vec2<f32>(uv.x - 0.38, (uv.y - (-0.18)) * 1.3));
        let sCheeks = max(smoothstep(0.14, 0.02, dLeftCheek), smoothstep(0.14, 0.02, dRightCheek)) * 0.55;
        let cheekColor = vec3<f32>(1.0, 0.52, 0.60);
        
        let leftEyeUv = vec2<f32>(uv.x - (-0.23), (uv.y - 0.01) * 0.75);
        let rightEyeUv = vec2<f32>(uv.x - 0.23, (uv.y - 0.01) * 0.75);
        let dLeftEye = length(leftEyeUv);
        let dRightEye = length(rightEyeUv);
        
        let eyeRadius = 0.125;
        let sEyeWhite = max(smoothstep(eyeRadius, eyeRadius - 0.015, dLeftEye), smoothstep(eyeRadius, eyeRadius - 0.015, dRightEye));
        
        let dLeftIris = length(vec2<f32>(leftEyeUv.x, leftEyeUv.y * 0.88));
        let dRightIris = length(vec2<f32>(rightEyeUv.x, rightEyeUv.y * 0.88));
        let irisRadius = 0.098;
        let sIris = max(smoothstep(irisRadius, irisRadius - 0.015, dLeftIris), smoothstep(irisRadius, irisRadius - 0.015, dRightIris));
        
        let irisY = clamp((uv.y - 0.01) / 0.12, -1.0, 1.0);
        let irisColor = mix(vec3<f32>(0.85, 0.52, 0.18), vec3<f32>(0.24, 0.11, 0.05), irisY * 0.5 + 0.5);
        
        let dLeftPupil = length(vec2<f32>(leftEyeUv.x, leftEyeUv.y - 0.01));
        let dRightPupil = length(vec2<f32>(rightEyeUv.x, rightEyeUv.y - 0.01));
        let sPupil = max(smoothstep(0.045, 0.028, dLeftPupil), smoothstep(0.045, 0.028, dRightPupil));
        let pupilColor = vec3<f32>(0.08, 0.04, 0.02);
        
        let dLeftH1 = length(leftEyeUv - vec2<f32>(-0.038, 0.038));
        let dRightH1 = length(rightEyeUv - vec2<f32>(-0.038, 0.038));
        let sH1 = max(smoothstep(0.035, 0.018, dLeftH1), smoothstep(0.035, 0.018, dRightH1));
        
        let dLeftH2 = length(leftEyeUv - vec2<f32>(0.032, -0.038));
        let dRightH2 = length(rightEyeUv - vec2<f32>(0.032, -0.038));
        let sH2 = max(smoothstep(0.020, 0.008, dLeftH2), smoothstep(0.020, 0.008, dRightH2));
        
        let dLeftLash = distToSegment(uv, vec2<f32>(-0.35, 0.08), vec2<f32>(-0.11, 0.13));
        let dRightLash = distToSegment(uv, vec2<f32>(0.11, 0.13), vec2<f32>(0.35, 0.08));
        let sEyelash = max(smoothstep(0.032, 0.010, dLeftLash), smoothstep(0.032, 0.010, dRightLash));
        
        let dLeftBrow = distToSegment(uv, vec2<f32>(-0.32, 0.18), vec2<f32>(-0.14, 0.22));
        let dRightBrow = distToSegment(uv, vec2<f32>(0.14, 0.22), vec2<f32>(0.32, 0.18));
        let sEyebrow = max(smoothstep(0.020, 0.006, dLeftBrow), smoothstep(0.020, 0.006, dRightBrow));
        let browColor = vec3<f32>(0.32, 0.18, 0.10);
        
        let mouthUv = vec2<f32>(uv.x, (uv.y - (-0.17)) * 1.3);
        let dMouthOpen = length(vec2<f32>(mouthUv.x, max(0.0, mouthUv.y)));
        let sMouthOutline = smoothstep(0.060, 0.042, dMouthOpen) * step(-0.035, mouthUv.y);
        let sMouthInner = smoothstep(0.042, 0.028, dMouthOpen) * step(-0.025, mouthUv.y);
        
        let dTongue = length(vec2<f32>(mouthUv.x, mouthUv.y - (-0.015)));
        let sTongue = smoothstep(0.032, 0.015, dTongue) * sMouthInner;
        
        let mouthBorderColor = vec3<f32>(0.22, 0.08, 0.08);
        let mouthInnerColor = vec3<f32>(0.88, 0.32, 0.38);
        let tongueColor = vec3<f32>(0.98, 0.58, 0.65);
        
        baseColor = mix(baseColor, cheekColor, sCheeks);
        baseColor = mix(baseColor, vec3<f32>(1.0, 1.0, 1.0), sEyeWhite);
        baseColor = mix(baseColor, irisColor, sIris);
        baseColor = mix(baseColor, pupilColor, sPupil);
        baseColor = mix(baseColor, vec3<f32>(1.0, 1.0, 1.0), max(sH1, sH2));
        baseColor = mix(baseColor, vec3<f32>(0.08, 0.04, 0.04), sEyelash);
        baseColor = mix(baseColor, browColor, sEyebrow);
        baseColor = mix(baseColor, mouthBorderColor, sMouthOutline);
        baseColor = mix(baseColor, mouthInnerColor, sMouthInner);
        baseColor = mix(baseColor, tongueColor, sTongue);
    }
    
    var finalColor = baseColor * diffuse + vec3<f32>(1.0) * spec + vec3<f32>(0.9, 0.95, 1.0) * fresnel;
    
    let dist = length(in.worldPos);
    if (dist < uniforms.params.x) {
        let depth = uniforms.params.x - dist;
        var tintFactor = 1.0 - exp(-depth * 5.0);
        tintFactor = clamp(tintFactor * uniforms.params.y, 0.0, 0.85);
        finalColor = mix(finalColor, uniforms.waterColor.xyz, tintFactor);
    }
    
    return vec4<f32>(finalColor, 1.0);
}
`;

            Graphics.webgpu.modelShaderModule = this.webgpu.device.createShaderModule({ code: modelWGSL });
            Graphics.webgpu.charShaderModule = this.webgpu.device.createShaderModule({ code: charWGSL });
            Graphics.webgpu.depthShaderModule = this.webgpu.device.createShaderModule({ code: `
struct DepthUniforms {
    modelViewMatrix : mat4x4<f32>,
    projMatrix : mat4x4<f32>,
    modelMatrix : mat4x4<f32>,
    params : vec4<f32>, // x: time, y: swayFactor, z: isChar, w: 0
};
@group(0) @binding(0) var<uniform> uniforms : DepthUniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    var pos = in.position;
    
    if (uniforms.params.z < 0.5 && uniforms.params.y > 0.0) {
        var actualColor = in.color;
        var isGrass = 0.0;
        var vertexType = 1.0;
        if (in.color.r < 0.0) {
            isGrass = 1.0;
            if (in.color.r < -9.0) {
                vertexType = 0.0;
            }
        }
        var isTree = false;
        var isTreeLeaf = false;
        var treeSwayWeight = 0.0;
        if (in.color.b < -0.5) {
            isTree = true;
            let encoded = -in.color.b;
            var rawSway = floor(encoded / 2.0) - 10.0;
            if (rawSway >= 500.0) {
                isTreeLeaf = true;
                rawSway -= 1000.0;
            }
            treeSwayWeight = max(0.0, rawSway / 100.0);
        }
        let isLeaf = (isGrass > 0.5) || isTreeLeaf;
        let distToCenter = length(pos);
        if (isLeaf || isTree) {
            let up = normalize(pos);
            var tangent = vec3<f32>(1.0, 0.0, 0.0);
            if (abs(up.x) > 0.9) { tangent = vec3<f32>(0.0, 1.0, 0.0); }
            let bitangent = cross(up, tangent);
            tangent = cross(bitangent, up);
            if (isTree) {
                let swayAmount = treeSwayWeight * 0.03 * uniforms.params.y;
                let windPhase = uniforms.params.x * 0.45 + (pos.x + pos.y + pos.z) * 0.05;
                let branchWind = sin(windPhase);
                let windDir = normalize(tangent * 1.0 + bitangent * 0.3);
                pos += windDir * branchWind * swayAmount;
                if (isTreeLeaf) {
                    let leafPhase = uniforms.params.x * 1.4 + (pos.x + pos.y + pos.z) * 0.1;
                    let leafWind = sin(leafPhase);
                    let lSway = 0.0025 * treeSwayWeight * uniforms.params.y;
                    let flutterDir = normalize(tangent * -0.3 + bitangent * 1.0);
                    pos += flutterDir * leafWind * lSway;
                }
            } else {
                let swayAmount = isGrass > 0.5 ? (vertexType * 0.15 * uniforms.params.y) : 0.0; // simple grass sway
                let windX = sin(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.x * 2.0);
                let windZ = cos(uniforms.params.x * 1.5 + pos.y * 5.0 + pos.z * 2.0);
                let macroWindX = sin(uniforms.params.x * 0.15) * 0.5 - 1.5;
                let macroWindZ = cos(uniforms.params.x * 0.15) * 0.5 + 1.2;
                pos.x += (windX * 0.2 + macroWindX * 0.3) * swayAmount;
                pos.z += (windZ * 0.2 + macroWindZ * 0.3) * swayAmount;
            }
        }
    }
    
    var mvPosition : vec4<f32>;
    if (uniforms.params.z > 0.5) { // isChar
        mvPosition = uniforms.modelViewMatrix * vec4<f32>(in.position, 1.0);
    } else { // isModel
        mvPosition = uniforms.modelViewMatrix * vec4<f32>(pos, 1.0);
    }
    
    out.position = uniforms.projMatrix * mvPosition;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) {
    // Write depth automatically
}
` });
            
            Graphics.webgpu.depthBindGroupLayout = this.webgpu.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 208 } }
                ]
            });

            
            Graphics.webgpu.monkeyUniformBuffer = this.webgpu.device.createBuffer({
                size: 512 * 2000,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            Graphics.webgpu.monkeyUniformOffset = 0;
            
            Graphics.webgpu.monkeyBindGroupLayout = this.webgpu.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 288 } },
                    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } }
                ]
            });
            
            Graphics.webgpu.pipelineCache = {};
            
            Graphics.webgpu.getMonkeyPipeline = function(progName, state) {
                const key = `${progName}_${state.cullEnabled}_${state.cullFace}_${state.frontFace}_${state.depthTest}_${state.depthMask}`;
                if (this.pipelineCache[key]) return this.pipelineCache[key];
                
                const module = progName === 'depth' ? this.depthShaderModule : (progName === 'model' ? this.modelShaderModule : this.charShaderModule);
                const desc = {
                    layout: this.device.createPipelineLayout({ bindGroupLayouts: [progName === 'depth' ? this.depthBindGroupLayout : this.monkeyBindGroupLayout] }),
                    vertex: {
                        module: module,
                        entryPoint: 'vs_main',
                        buffers: (progName === 'depth') ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                        ] : (progName === 'atmosphere' || progName === 'water' || progName === 'sky' ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }
                        ] : (progName === 'cloud3D' ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                        ] : (progName === 'model' ? [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }] }
                        ] : [
                            { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x3' }] },
                            { arrayStride: 12, attributes: [{ shaderLocation: 3, offset: 0, format: 'float32x3' }] }
                        ])))
                    },
                    fragment: progName === 'depth' ? { module: module, entryPoint: 'fs_main', targets: [] } : {
                        module: module,
                        entryPoint: 'fs_main',
                        targets: [{ format: this.format, blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        } }]
                    },
                    primitive: {
                        topology: 'triangle-list',
                        cullMode: state.cullEnabled ? (state.cullFace === 1028 ? 'front' : 'back') : 'none', // 1028 is gl.FRONT
                        frontFace: state.frontFace === 2304 ? 'cw' : 'ccw' // 2304 is gl.CW
                    },
                    depthStencil: {
                        depthWriteEnabled: progName === 'sky' ? false : state.depthMask, // Sky always depthWrite false
                        depthCompare: progName === 'depth' ? 'less' : (state.depthTest ? 'less' : 'always'),
                        format: progName === 'depth' ? 'depth32float' : 'depth24plus' 
                    }
                };
                
                this.pipelineCache[key] = this.device.createRenderPipeline(desc);
                return this.pipelineCache[key];
            };
            
            Graphics.webgpu.executeMonkeyDraw = function(gl, count, type, offset) {
                const prog = gl._currentProgram;
                const isModel = prog._name === 'model';
                const isChar = prog._name === 'char';
                const vals = prog._uniformValues;
                
                if (this.monkeyUniformOffset >= 512 * 1900) this.monkeyUniformOffset = 0;
                const currentOffset = this.monkeyUniformOffset;
                this.monkeyUniformOffset += 512;
                
                f32_monkeyUData.fill(0);
                const uData = f32_monkeyUData;
                const setMat4 = (name, arrOff) => { if(vals[name]) uData.set(vals[name], arrOff); };
                const setVec3 = (name, arrOff) => { if(vals[name]) { uData[arrOff] = vals[name][0]; uData[arrOff+1] = vals[name][1]; uData[arrOff+2] = vals[name][2]; } };
                const setFloat = (name, arrOff) => { if(vals[name]) uData[arrOff] = vals[name][0]; };
                const setVec2 = (name, arrOff) => { if(vals[name]) { uData[arrOff] = vals[name][0]; uData[arrOff+1] = vals[name][1]; } };
                
                const isDepth = prog._name === 'depth';
                if (isModel) {
                    setMat4("uModelViewMatrix", 0); setMat4("uProjectionMatrix", 16); setMat4("uLightSpaceMatrix", 32);
                    setVec3("uCameraPos", 48); setVec3("uLightDir", 52); uData[55] = 1.0;
                    setVec3("uWaterColor", 56); uData[59] = vals["uWaterOpacity"] ? vals["uWaterOpacity"][0] : 0.0;
                    setFloat("uTime", 60); setFloat("uSwayFactor", 61); setFloat("uWaterSwayFactor", 62); setFloat("uShadowsEnabled", 63);
                    setFloat("uPlanetRadius", 64); setFloat("uWaterRadius", 65); setFloat("uRenderDistEnabled", 66); setFloat("uMaxRenderDist", 67);
                    setVec2("uShadowTexelSize", 68);
                } else if (isChar) {
                    setMat4("uModelViewMatrix", 0); setMat4("uProjectionMatrix", 16); setMat4("uModelMatrix", 32); setMat4("uLightSpaceMatrix", 48);
                    setVec3("uCameraPos", 64); setVec3("uLightDir", 68); uData[71] = 1.0;
                    setVec3("uWaterColor", 72); uData[75] = vals["uWaterOpacity"] ? vals["uWaterOpacity"][0] : 0.0;
                    setFloat("uWaterRadius", 76); setFloat("uShadowsEnabled", 78);
                    setVec2("uShadowTexelSize", 80);
                }
                const isAtmosphere = prog._name === 'atmosphere';
                const isWater = prog._name === 'water';
                const isCloud3D = prog._name === 'cloud3D';
                const isSky = prog._name === 'sky';
                if (isSky) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uTime"]) { uData[32] = vals["uTime"][0]; }
                    if(vals["uGasIntensity"]) { uData[33] = vals["uGasIntensity"][0]; }
                    if(vals["uWaterRadius"]) { uData[34] = vals["uWaterRadius"][0]; }
                    setVec3("uCameraPos", 36);
                } else if (isCloud3D) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uCloudOrbitMatrix"]) { uData.set(vals["uCloudOrbitMatrix"], 32); } // Correctly map matrix array
                    if(vals["uColor"]) { uData[48] = vals["uColor"][0]; uData[49] = vals["uColor"][1]; uData[50] = vals["uColor"][2]; }
                    if(vals["uAlpha"]) { uData[51] = vals["uAlpha"][0]; }
                    if(vals["uAnimTime"]) { uData[52] = vals["uAnimTime"][0]; }
                    if(vals["uTime"]) { uData[53] = vals["uTime"][0]; }
                    if(vals["uWaterRadius"]) { uData[54] = vals["uWaterRadius"][0]; }
                    setVec3("uLightDir", 56);
                    setVec3("uCameraPos", 60);
                } else if (isWater) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uWaterColor"]) { uData[32] = vals["uWaterColor"][0]; uData[33] = vals["uWaterColor"][1]; uData[34] = vals["uWaterColor"][2]; }
                    if(vals["uOpacity"]) { uData[36] = vals["uOpacity"][0]; }
                    if(vals["uTime"]) { uData[37] = vals["uTime"][0]; }
                    if(vals["uWaveStrength"]) { uData[38] = vals["uWaveStrength"][0]; }
                    if(vals["uWaterLevel"]) { uData[39] = vals["uWaterLevel"][0]; }
                    setVec3("uLightDir", 40);
                    setVec3("uCameraPos", 44);
                    if(vals["uRenderDistEnabled"]) { uData[48] = vals["uRenderDistEnabled"][0]; }
                    if(vals["uMaxRenderDist"]) { uData[49] = vals["uMaxRenderDist"][0]; }
                    if(vals["uBoatCount"]) { uData[52] = vals["uBoatCount"][0]; }
                    // Ignore boats to save space as it's not strictly needed yet
                } else if (isAtmosphere) {
                    setMat4("uModelViewMatrix", 0);
                    setMat4("uProjectionMatrix", 16);
                    if(vals["uColor"]) { uData[32] = vals["uColor"][0]; uData[33] = vals["uColor"][1]; uData[34] = vals["uColor"][2]; }
                    if(vals["uAlpha"]) { uData[35] = vals["uAlpha"][0]; }
                    setVec3("uLightDir", 36);
                    setVec3("uCameraPos", 40);
                } else if (isDepth) {
                    setMat4("uModelMatrix", 0); // mapped to modelViewMatrix in WGSL
                    setMat4("uLightSpaceMatrix", 16); // mapped to projMatrix in WGSL
                    setMat4("uModelMatrix", 32); 
                    setFloat("uTime", 48); 
                    setFloat("uSwayFactor", 49); 
                    
                    let isCharVBO = false;
                    const aPosLoc = prog._attribNamesInv ? prog._attribNamesInv["aPosition"] : -1;
                    if (aPosLoc >= 0 && gl._activeAttributes[aPosLoc]) {
                        const vbo = gl._activeAttributes[aPosLoc].buffer;
                        if (vbo === window.charVertexBuffer || (typeof window.equipVertexBuffer !== 'undefined' && vbo === window.equipVertexBuffer)) {
                            isCharVBO = true;
                        }
                    }
                    uData[50] = isCharVBO ? 1.0 : 0.0;
                    setFloat("uWaterSwayFactor", 51);
                    setFloat("uPlanetRadius", 52);
                    setFloat("uWaterRadius", 53);
                }
                
                this.device.queue.writeBuffer(this.monkeyUniformBuffer, currentOffset, uData.buffer);
                
                const bgl = isDepth ? this.depthBindGroupLayout : (isAtmosphere ? this.atmosphereBindGroupLayout : (isWater ? this.waterBindGroupLayout : (isCloud3D ? this.cloud3DBindGroupLayout : (isSky ? this.skyBindGroupLayout : this.monkeyBindGroupLayout))));
                let entries;
                if (isDepth || isAtmosphere || isCloud3D || isSky) {
                    entries = [
                        { binding: 0, resource: { buffer: this.monkeyUniformBuffer, offset: currentOffset, size: 512 } }
                    ];
                } else if (isWater) {
                    entries = [
                        { binding: 0, resource: { buffer: this.monkeyUniformBuffer, offset: currentOffset, size: 512 } },
                        { binding: 1, resource: this.waterMaskTextureView },
                        { binding: 2, resource: this.waterMaskSampler }
                    ];
                } else {
                    entries = [
                    { binding: 0, resource: { buffer: this.monkeyUniformBuffer, offset: currentOffset, size: 512 } },
                    { binding: 1, resource: this.shadowDepthTextureView },
                    { binding: 2, resource: this.shadowSampler }
                ];
                }
                const bindGroup = this.device.createBindGroup({
                    layout: bgl,
                    entries: entries
                });
                
                const pipeline = this.getMonkeyPipeline(prog._name, {
                    cullEnabled: gl._cullEnabled, cullFace: gl._cullFace, frontFace: gl._frontFace, depthTest: gl._depthTest, depthMask: gl._depthMask
                });
                
                const encoder = this.currentPassEncoder;
                encoder.setPipeline(pipeline);
                encoder.setBindGroup(0, bindGroup);
                
                const aPosLoc = prog._attribNamesInv ? prog._attribNamesInv["aPosition"] : -1;
                const aColorLoc = prog._attribNamesInv ? prog._attribNamesInv["aColor"] : -1;
                const aNormLoc = prog._attribNamesInv ? prog._attribNamesInv["aNormal"] : -1;
                const aLocalPosLoc = (isChar || isCloud3D) && prog._attribNamesInv ? prog._attribNamesInv["aLocalPos"] : -1;
                
                if (aPosLoc >= 0 && gl._activeAttributes[aPosLoc] && gl._activeAttributes[aPosLoc].buffer._webgpuBuffer)
                    encoder.setVertexBuffer(0, gl._activeAttributes[aPosLoc].buffer._webgpuBuffer);
                    
                if (isModel) {
                    if (aColorLoc >= 0 && gl._activeAttributes[aColorLoc] && gl._activeAttributes[aColorLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(1, gl._activeAttributes[aColorLoc].buffer._webgpuBuffer);
                    if (aNormLoc >= 0 && gl._activeAttributes[aNormLoc] && gl._activeAttributes[aNormLoc].buffer && gl._activeAttributes[aNormLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(2, gl._activeAttributes[aNormLoc].buffer._webgpuBuffer);
                    else
                        encoder.setVertexBuffer(2, this.dummyNormalBuffer || this.dummyColorBuffer);
                } else if (isCloud3D) {
                    if (aLocalPosLoc >= 0 && gl._activeAttributes[aLocalPosLoc] && gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(1, gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer);
                } else if (isChar) {
                    if (aLocalPosLoc >= 0 && gl._activeAttributes[aLocalPosLoc] && gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(1, gl._activeAttributes[aLocalPosLoc].buffer._webgpuBuffer);
                    if (aNormLoc >= 0 && gl._activeAttributes[aNormLoc] && gl._activeAttributes[aNormLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(2, gl._activeAttributes[aNormLoc].buffer._webgpuBuffer);
                    if (aColorLoc >= 0 && gl._activeAttributes[aColorLoc] && gl._activeAttributes[aColorLoc].buffer._webgpuBuffer)
                        encoder.setVertexBuffer(3, gl._activeAttributes[aColorLoc].buffer._webgpuBuffer);
                } else if (isDepth) {
                    if (aColorLoc >= 0 && gl._activeAttributes[aColorLoc] && gl._activeAttributes[aColorLoc].buffer && gl._activeAttributes[aColorLoc].buffer._webgpuBuffer) {
                        encoder.setVertexBuffer(1, gl._activeAttributes[aColorLoc].buffer._webgpuBuffer);
                    } else {
                        encoder.setVertexBuffer(1, this.dummyColorBuffer);
                    }
                }
                
                const indexBuf = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
                if (indexBuf && indexBuf._webgpuBuffer) {
                    encoder.setIndexBuffer(indexBuf._webgpuBuffer, type === gl.UNSIGNED_INT ? 'uint32' : 'uint16');
                    encoder.drawIndexed(count, 1, offset / (type === gl.UNSIGNED_INT ? 4 : 2), 0, 0);
                }
            };

            
            
            
            
            // --- Compile WebGPU Cloud 3D Pipeline ---
            const cloud3DWGSL = `
struct Cloud3DUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    cloudOrbitMatrix : mat4x4<f32>,
    colorParams : vec4<f32>, // rgb: color, a: alpha
    timeParams : vec4<f32>, // x: animTime, y: time, z: waterRadius, w: 0
    lightDir : vec4<f32>,
    cameraPos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Cloud3DUniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) localPos : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vWorldPos : vec3<f32>,
    @location(1) vLocalPos : vec3<f32>,
};

fn puffNoise(p : vec3<f32>, t : f32) -> f32 {
    return sin(p.x * 0.8 + t * 1.5) * cos(p.y * 1.1 + t * 1.2) * sin(p.z * 0.9 + t * 1.7);
}

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    out.vLocalPos = in.localPos;
    
    var animatedPos = in.position;
    var normLocal = vec3<f32>(0.0, 1.0, 0.0);
    if (length(in.localPos) > 0.001) {
        normLocal = normalize(in.localPos);
    }
    
    let puff = puffNoise(in.position * 0.5, uniforms.timeParams.x) * 0.35;
    animatedPos = animatedPos + normLocal * puff;
    
    let rotatedPos = uniforms.cloudOrbitMatrix * vec4<f32>(animatedPos, 1.0);
    out.vWorldPos = rotatedPos.xyz;
    out.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * rotatedPos;
    
    return out;
}

fn hash(p_in : vec3<f32>) -> f32 {
    var p = fract(p_in * vec3<f32>(443.897, 441.423, 437.195));
    p = p + dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

fn noise(x : vec3<f32>) -> f32 {
    let p = floor(x);
    var f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p+vec3<f32>(0.0,0.0,0.0)), hash(p+vec3<f32>(1.0,0.0,0.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,0.0)), hash(p+vec3<f32>(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash(p+vec3<f32>(0.0,0.0,1.0)), hash(p+vec3<f32>(1.0,0.0,1.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,1.0)), hash(p+vec3<f32>(1.0,1.0,1.0)), f.x), f.y), f.z);
}

fn fbm(p_in : vec3<f32>) -> f32 {
    var p = p_in;
    var v = 0.0;
    var a = 0.5;
    let shift = vec3<f32>(100.0);
    for (var i = 0; i < 3; i++) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let waterRadius = uniforms.timeParams.z;
    if (waterRadius > 0.0) {
        let rayDir = normalize(in.vWorldPos - uniforms.cameraPos.xyz);
        let cloudDist = length(in.vWorldPos - uniforms.cameraPos.xyz);
        let b = dot(uniforms.cameraPos.xyz, rayDir);
        let c = dot(uniforms.cameraPos.xyz, uniforms.cameraPos.xyz) - waterRadius * waterRadius;
        let h = b * b - c;
        if (h >= 0.0) {
            let tNear = -b - sqrt(h);
            if (c > 0.0) {
                if (tNear > 0.0 && tNear < cloudDist) {
                    discard;
                }
            } else {
                discard;
            }
        }
    }
    
    let viewDir = normalize(uniforms.cameraPos.xyz - in.vWorldPos);
    let normal = normalize(in.vLocalPos);
    
    let rim = max(0.0, dot(normal, viewDir));
    let env = smoothstep(0.0, 0.6, rim);
    
    let time = uniforms.timeParams.y;
    let coord = in.vWorldPos * 0.8 + vec3<f32>(time * 0.25, time * 0.1, time * 0.18);
    
    let n = fbm(coord);
    let fluffy = smoothstep(0.2, 0.65, n);
    
    let density = clamp(fluffy * 1.6 * env, 0.0, 1.0);
    if (density < 0.02) {
        discard;
    }
    
    let lightDir = normalize(uniforms.lightDir.xyz);
    let shadowNoise = fbm(coord + lightDir * 0.5);
    let shadow = smoothstep(0.2, 0.8, shadowNoise);
    
    let baseColor = uniforms.colorParams.rgb;
    let shadowColor = mix(baseColor * 0.6, vec3<f32>(0.55, 0.65, 0.8), 0.6);
    
    let lightDot = dot(normal, lightDir);
    let lightIntensity = smoothstep(-0.2, 0.8, lightDot);
    
    let finalColor = mix(shadowColor, baseColor, lightIntensity * shadow);
    
    return vec4<f32>(finalColor, density * uniforms.colorParams.a);
}
`;
            this.cloud3DShaderModule = this.device.createShaderModule({ code: cloud3DWGSL });
            
            this.cloud3DBindGroupLayout = this.device.createBindGroupLayout({
                entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
            });

            // --- Compile WebGPU Water Pipeline ---
            const waterWGSL = `
struct WaterUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    waterColor : vec4<f32>,
    opacityTimeWaveLevel : vec4<f32>, // x: opacity, y: time, z: waveStrength, w: waterLevel
    lightDir : vec4<f32>,
    cameraPos : vec4<f32>,
    renderDist : vec4<f32>, // x: enabled, y: maxDist, z: 0, w: 0
    boatCount : vec4<f32>,  // x: count, yzw: 0
    boatPos0 : vec4<f32>, boatPos1 : vec4<f32>, boatPos2 : vec4<f32>, boatPos3 : vec4<f32>,
    boatRight0 : vec4<f32>, boatRight1 : vec4<f32>, boatRight2 : vec4<f32>, boatRight3 : vec4<f32>,
    boatNormal0 : vec4<f32>, boatNormal1 : vec4<f32>, boatNormal2 : vec4<f32>, boatNormal3 : vec4<f32>,
    boatForward0 : vec4<f32>, boatForward1 : vec4<f32>, boatForward2 : vec4<f32>, boatForward3 : vec4<f32>,
    boatSize0 : vec4<f32>, boatSize1 : vec4<f32>, boatSize2 : vec4<f32>, boatSize3 : vec4<f32>,
    boatOffset0 : vec4<f32>, boatOffset1 : vec4<f32>, boatOffset2 : vec4<f32>, boatOffset3 : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : WaterUniforms;
@group(0) @binding(1) var waterMaskTex : texture_2d<f32>;
@group(0) @binding(2) var waterSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vPosition : vec3<f32>,
    @location(1) vNormal : vec3<f32>,
    @location(2) vDist : f32,
};

@vertex
fn vs_main(@location(0) aPosition : vec3<f32>) -> VertexOutput {
    var out : VertexOutput;
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(aPosition, 1.0);
    out.position = uniforms.projectionMatrix * mvPosition;
    out.vPosition = aPosition;
    out.vNormal = normalize(aPosition);
    out.vDist = length(mvPosition.xyz);
    return out;
}

fn hash(p : vec3<f32>) -> f32 {
    let pf = fract(p * vec3<f32>(127.1, 311.7, 74.7));
    return fract(sin(dot(pf, vec3<f32>(12.9898, 78.233, 37.719))) * 43758.5453);
}

fn noise3D(p : vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i + vec3<f32>(0.0,0.0,0.0)), hash(i + vec3<f32>(1.0,0.0,0.0)), u.x),
            mix(hash(i + vec3<f32>(0.0,1.0,0.0)), hash(i + vec3<f32>(1.0,1.0,0.0)), u.x), u.y),
        mix(mix(hash(i + vec3<f32>(0.0,0.0,1.0)), hash(i + vec3<f32>(1.0,0.0,1.0)), u.x),
            mix(hash(i + vec3<f32>(0.0,1.0,1.0)), hash(i + vec3<f32>(1.0,1.0,1.0)), u.x), u.y), u.z
    );
}

fn fbm(p : vec3<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 1.0;
    var frequency = 1.0;
    var maxVal = 0.0;
    for (var i = 0; i < 3; i++) {
        value += amplitude * noise3D(p * frequency);
        maxVal += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value / maxVal;
}

fn getBoatPos(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatPos0.xyz; }
    if (i == 1) { return uniforms.boatPos1.xyz; }
    if (i == 2) { return uniforms.boatPos2.xyz; }
    return uniforms.boatPos3.xyz;
}
fn getBoatRight(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatRight0.xyz; }
    if (i == 1) { return uniforms.boatRight1.xyz; }
    if (i == 2) { return uniforms.boatRight2.xyz; }
    return uniforms.boatRight3.xyz;
}
fn getBoatNormal(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatNormal0.xyz; }
    if (i == 1) { return uniforms.boatNormal1.xyz; }
    if (i == 2) { return uniforms.boatNormal2.xyz; }
    return uniforms.boatNormal3.xyz;
}
fn getBoatForward(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatForward0.xyz; }
    if (i == 1) { return uniforms.boatForward1.xyz; }
    if (i == 2) { return uniforms.boatForward2.xyz; }
    return uniforms.boatForward3.xyz;
}
fn getBoatSize(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatSize0.xyz; }
    if (i == 1) { return uniforms.boatSize1.xyz; }
    if (i == 2) { return uniforms.boatSize2.xyz; }
    return uniforms.boatSize3.xyz;
}
fn getBoatOffset(i : i32) -> vec3<f32> {
    if (i == 0) { return uniforms.boatOffset0.xyz; }
    if (i == 1) { return uniforms.boatOffset1.xyz; }
    if (i == 2) { return uniforms.boatOffset2.xyz; }
    return uniforms.boatOffset3.xyz;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    if (uniforms.renderDist.x > 0.5 && in.vDist > uniforms.renderDist.y) {
        discard;
    }
    
    let nPos = normalize(in.vPosition);
    let theta = acos(clamp(nPos.y, -1.0, 1.0));
    var phi = atan2(nPos.z, nPos.x);
    if (phi < 0.0) { phi += 2.0 * 3.14159265359; }
    let uv = vec2<f32>(phi / (2.0 * 3.14159265359), theta / 3.14159265359);
    
    let isWater = textureSample(waterMaskTex, waterSampler, uv).r;
    if (isWater <= 0.001) {
        discard;
    }

    // Boat hull clipping
    let bCount = i32(uniforms.boatCount.x);
    for (var i = 0; i < 4; i++) {
        if (i >= bCount) { break; }
        let rel = in.vPosition - getBoatPos(i);
        let localX = dot(rel, getBoatRight(i));
        let localY = dot(rel, getBoatNormal(i));
        let localZ = dot(rel, getBoatForward(i));
        
        let size = getBoatSize(i);
        let offset = getBoatOffset(i);
        let offsetY = offset.x;
        let shapeType = offset.y;
        
        let dy = localY - offsetY;
        if (abs(dy) < size.y) {
            var halfWidth = size.x;
            let halfLength = size.z;
            let t = abs(localZ) / halfLength;
            if (t <= 1.0) {
                if (shapeType > 0.5) {
                    halfWidth = halfWidth * (1.0 - t * t * 0.85);
                }
                if (abs(localX) < halfWidth) {
                    discard;
                }
            }
        }
    }
    
    let time = uniforms.opacityTimeWaveLevel.y;
    var normal = normalize(in.vNormal);
    
    let ripple = sin(in.vPosition.x * 25.0 + time * 4.0) * 0.02
               + cos(in.vPosition.z * 20.0 + time * 3.5) * 0.02
               + sin(in.vPosition.y * 15.0 + time * 5.0) * 0.015;
    normal = normalize(normal + vec3<f32>(ripple, ripple * 0.5, ripple * 0.7));
    
    let viewDir = normalize(in.vPosition - uniforms.cameraPos.xyz);
    let reflectDir = reflect(viewDir, normal);
    
    var skyColor = vec3<f32>(0.02, 0.03, 0.07) * (1.0 - max(0.0, reflectDir.y));
    let starPattern = hash(floor(reflectDir * 160.0));
    if (starPattern > 0.993) {
        skyColor += vec3<f32>(1.0, 1.0, 1.0) * (sin(time * 3.0 + starPattern * 10.0) * 0.5 + 0.5);
    }
    
    let landNoise = fbm(reflectDir * 4.5);
    let treeNoise = fbm(reflectDir * 12.0 + vec3<f32>(1.2, 3.4, 5.6));
    
    let horizonFactor = smoothstep(-0.25, 0.35, 0.5 - dot(reflectDir, normalize(in.vPosition)));
    let landFactor = smoothstep(0.38, 0.65, landNoise) * horizonFactor;
    
    var landReflColor = mix(vec3<f32>(0.12, 0.35, 0.15), vec3<f32>(0.38, 0.32, 0.22), smoothstep(0.4, 0.7, landNoise));
    if (treeNoise > 0.55 && landNoise > 0.42) {
        landReflColor = mix(landReflColor, vec3<f32>(0.06, 0.22, 0.08), 0.7);
    }
    
    var reflectedScene = mix(skyColor, landReflColor, landFactor);
    
    let lightDir = normalize(uniforms.lightDir.xyz);
    let sunSpec = pow(max(dot(reflectDir, lightDir), 0.0), 120.0);
    reflectedScene += vec3<f32>(1.0, 0.96, 0.85) * sunSpec * 2.0;
    
    var fresnel = pow(1.0 - abs(dot(normal, viewDir)), 4.0);
    fresnel = clamp(fresnel * 0.75 + 0.12, 0.0, 1.0);
    
    let deepNavyColor = vec3<f32>(0.01, 0.08, 0.32);
    var baseSeaColor = uniforms.waterColor.rgb;
    if (isWater > 0.35) {
        let t = clamp((isWater - 0.35) / 0.65, 0.0, 1.0);
        baseSeaColor = mix(uniforms.waterColor.rgb, deepNavyColor, t);
    }
    
    let spec = pow(max(dot(reflect(-lightDir, normal), -viewDir), 0.0), 32.0) * 0.35;
    let baseWaterColor = baseSeaColor * (0.85 + 0.15 * spec);
    
    var finalColor = mix(baseWaterColor, reflectedScene, fresnel);
    
    // Caustics in shallow water
    if (isWater < 0.40) {
        let cPos = in.vPosition * 22.0 + vec3<f32>(time * 0.9, time * 0.7, time * 0.8);
        let c1 = noise3D(cPos);
        let c2 = noise3D(cPos * 1.4 + vec3<f32>(2.3, 1.7, 4.1));
        let caustic = pow(min(c1, c2), 2.2) * 1.5;
        let causticMask = (1.0 - smoothstep(0.05, 0.40, isWater)) * smoothstep(0.01, 0.05, isWater);
        finalColor += vec3<f32>(0.08, 0.10, 0.12) * caustic * causticMask;
    }
    
    // Shoreline animated foam
    let edgeFade = smoothstep(0.0, 0.08, isWater);
    let foamFactor = smoothstep(0.0, 0.03, edgeFade) * (1.0 - smoothstep(0.03, 0.18, edgeFade));
    var foamNoise = sin(in.vPosition.x * 65.0 + in.vPosition.z * 55.0 + time * 3.8) * 0.5 + 0.5;
    foamNoise += cos(in.vPosition.y * 110.0 - time * 3.5) * 0.25;
    foamNoise = clamp(foamNoise, 0.0, 1.0);
    let foamColor = vec3<f32>(0.96, 0.98, 1.0);
    finalColor = mix(finalColor, foamColor, foamFactor * 0.75 * foamNoise);
    
    // Depth opacity & fresnel alpha
    let depthOpacity = smoothstep(0.0, 0.40, isWater);
    var alpha = mix(uniforms.opacityTimeWaveLevel.x * depthOpacity, 0.96, fresnel);
    alpha += ripple * 0.10;
    alpha = clamp(alpha, 0.0, 0.98);
    alpha *= edgeFade;

    // Atmospheric Fog
    if (uniforms.renderDist.x > 0.5) {
        let fogStart = uniforms.renderDist.y * 0.55;
        let fogFactor = smoothstep(fogStart, uniforms.renderDist.y, in.vDist);
        let fogDir = normalize(in.vPosition - uniforms.cameraPos.xyz);
        let sunDot = max(dot(fogDir, lightDir), 0.0);
        let baseSkyFog = vec3<f32>(0.012, 0.035, 0.09);
        let litSkyFog = vec3<f32>(0.08, 0.14, 0.24);
        let atmosphericFog = mix(baseSkyFog, litSkyFog, sunDot * 0.5 + 0.1);
        finalColor = mix(finalColor, atmosphericFog, fogFactor * 0.98);
        alpha = mix(alpha, 0.0, fogFactor * 0.95);
    }

    return vec4<f32>(finalColor, alpha);
}
`;
            this.waterShaderModule = this.device.createShaderModule({ code: waterWGSL });
            
            this.waterBindGroupLayout = this.device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
                    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }
                ]
            });

            // --- Compile WebGPU Atmosphere Pipeline ---
            const atmosphereWGSL = `
struct AtmosphereUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    color : vec4<f32>,
    lightDir : vec4<f32>,
    cameraPos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : AtmosphereUniforms;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vNormal : vec3<f32>,
    @location(1) vPosition : vec3<f32>,
};

@vertex
fn vs_main(@location(0) aPosition : vec3<f32>) -> VertexOutput {
    var out : VertexOutput;
    out.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * vec4<f32>(aPosition, 1.0);
    out.vNormal = normalize(aPosition);
    out.vPosition = aPosition;
    return out;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.vNormal);
    let viewDir = normalize(uniforms.cameraPos.xyz - in.vPosition);
    let lightDir = normalize(uniforms.lightDir.xyz);
    
    let cosTheta = dot(normal, viewDir);
    let fresnel = 1.0 - abs(cosTheta);
    
    var rim : f32;
    if (cosTheta < 0.0) {
        rim = mix(0.42, 1.0, fresnel);
    } else {
        rim = pow(fresnel, 3.5) * smoothstep(0.0, 0.20, cosTheta);
    }
    
    let lightInfluence = dot(normal, lightDir);
    let intensity = smoothstep(-0.4, 0.4, lightInfluence);
    
    let finalAlpha = rim * uniforms.color.a * (0.15 + 0.85 * intensity);
    return vec4<f32>(uniforms.color.rgb, finalAlpha);
}
`;
            this.atmosphereShaderModule = this.device.createShaderModule({ code: atmosphereWGSL });
            
            this.atmosphereBindGroupLayout = this.device.createBindGroupLayout({
                entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
            });

            
            // --- Compile WebGPU Sky Pipeline ---
            const skyWGSL2 = `
struct SkyUniforms {
    modelViewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    timeParams : vec4<f32>, // x: time, y: gasIntensity, z: waterRadius, w: 0
    cameraPos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : SkyUniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vWorldDir : vec3<f32>,
};

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    out.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * vec4<f32>(in.position, 1.0);
    out.vWorldDir = normalize(in.position);
    return out;
}

fn hash(p_in : vec3<f32>) -> f32 {
    var p = fract(p_in * vec3<f32>(443.897, 441.423, 437.195));
    p = p + dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

fn noise(x : vec3<f32>) -> f32 {
    let p = floor(x);
    var f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p+vec3<f32>(0.0,0.0,0.0)), hash(p+vec3<f32>(1.0,0.0,0.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,0.0)), hash(p+vec3<f32>(1.0,1.0,0.0)), f.x), f.y),
               mix(mix(hash(p+vec3<f32>(0.0,0.0,1.0)), hash(p+vec3<f32>(1.0,0.0,1.0)), f.x),
                   mix(hash(p+vec3<f32>(0.0,1.0,1.0)), hash(p+vec3<f32>(1.0,1.0,1.0)), f.x), f.y), f.z);
}

fn fbm(p_in : vec3<f32>) -> f32 {
    var p = p_in;
    var v = 0.0;
    var a = 0.5;
    let shift = vec3<f32>(100.0);
    for (var i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(in.vWorldDir);
    let waterRadius = uniforms.timeParams.z;
    if (waterRadius > 0.0) {
        let b = dot(uniforms.cameraPos.xyz, dir);
        let c = dot(uniforms.cameraPos.xyz, uniforms.cameraPos.xyz) - waterRadius * waterRadius;
        let h = b * b - c;
        if (h >= 0.0) {
            let tNear = -b - sqrt(h);
            if (c > 0.0) {
                if (tNear > 0.0) {
                    discard;
                }
            } else {
                discard;
            }
        }
    }
    
    let starPattern = hash(floor(dir * 160.0));
    var stars = 0.0;
    if (starPattern > 0.995) {
        let intensity = sin(uniforms.timeParams.x * 1.8 + starPattern * 100.0) * 0.4 + 0.6;
        stars = pow(fract(starPattern * 1234.56), 25.0) * intensity * 2.0;
    }
    
    let gasCoords = dir * 2.8 + vec3<f32>(0.0, uniforms.timeParams.x * 0.003, uniforms.timeParams.x * 0.0015);
    let n1 = fbm(gasCoords);
    let n2 = fbm(gasCoords + vec3<f32>(3.2, 1.5, -2.1));
    
    let colorNebula1 = vec3<f32>(0.01, 0.005, 0.04);
    let colorNebula2 = vec3<f32>(0.08, 0.03, 0.22);
    let colorNebula3 = vec3<f32>(0.01, 0.12, 0.25);
    
    let blend1 = smoothstep(0.2, 0.7, n1);
    let blend2 = smoothstep(0.4, 0.8, n2);
    var gasColor = mix(colorNebula1, colorNebula2, blend1);
    gasColor = mix(gasColor, colorNebula3, blend2);
    
    gasColor = gasColor * uniforms.timeParams.y;
    
    let finalColor = gasColor + vec3<f32>(stars, stars, stars);
    return vec4<f32>(finalColor, 1.0);
}
`;
            this.skyShaderModule = this.device.createShaderModule({ code: skyWGSL2 });
            
            this.skyBindGroupLayout = this.device.createBindGroupLayout({
                entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }]
            });

            // --- Compile WebGPU Sky Pipeline ---
            const skyWGSL = `
struct SkyUniforms {
    viewProjInverse : mat4x4<f32>,
    cameraPos : vec4<f32>,
    params : vec4<f32>, // x: time, y: gasIntensity, z: waterRadius, w: 0
    sunDir : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : SkyUniforms;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) worldDir : vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    let xy = pos[vertexIndex];
    var out : VertexOutput;
    out.position = vec4<f32>(xy, 1.0, 1.0);
    
    let clipPos = vec4<f32>(xy, 1.0, 1.0);
    var worldPos = uniforms.viewProjInverse * clipPos;
    worldPos = worldPos / worldPos.w;
    
    out.worldDir = normalize(worldPos.xyz - uniforms.cameraPos.xyz);
    return out;
}

fn hash(p_in: vec3<f32>) -> f32 {
    var p = fract(p_in * vec3<f32>(443.897, 441.423, 437.195));
    let d = dot(p, p.yzx + vec3<f32>(19.19, 19.19, 19.19));
    p += vec3<f32>(d, d, d);
    return fract((p.x + p.y) * p.z);
}

fn noise(x: vec3<f32>) -> f32 {
    let p = floor(x);
    var f = fract(x);
    f = f * f * (vec3<f32>(3.0, 3.0, 3.0) - vec3<f32>(2.0, 2.0, 2.0) * f);
    return mix(
        mix(
            mix(hash(p + vec3<f32>(0.0,0.0,0.0)), hash(p + vec3<f32>(1.0,0.0,0.0)), f.x),
            mix(hash(p + vec3<f32>(0.0,1.0,0.0)), hash(p + vec3<f32>(1.0,1.0,0.0)), f.x),
            f.y
        ),
        mix(
            mix(hash(p + vec3<f32>(0.0,0.0,1.0)), hash(p + vec3<f32>(1.0,0.0,1.0)), f.x),
            mix(hash(p + vec3<f32>(0.0,1.0,1.0)), hash(p + vec3<f32>(1.0,1.0,1.0)), f.x),
            f.y
        ),
        f.z
    );
}

fn fbm(p_in: vec3<f32>) -> f32 {
    var v = 0.0;
    var a = 0.5;
    let shift = vec3<f32>(100.0, 100.0, 100.0);
    var p = p_in;
    for (var i = 0u; i < 4u; i++) {
        v += a * noise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

@fragment
fn fs_main(@location(0) worldDir : vec3<f32>) -> @location(0) vec4<f32> {
    let dir = normalize(worldDir);
    let uWaterRadius = uniforms.params.z;
    let uCameraPos = uniforms.cameraPos.xyz;
    let uTime = uniforms.params.x;
    let uGasIntensity = uniforms.params.y;
    let uSunDir = normalize(uniforms.sunDir.xyz);

    if (uWaterRadius > 0.0) {
        let b = dot(uCameraPos, dir);
        let c = dot(uCameraPos, uCameraPos) - uWaterRadius * uWaterRadius;
        let h = b * b - c;
        if (h >= 0.0) {
            let tNear = -b - sqrt(h);
            if (c > 0.0) {
                if (tNear > 0.0) {
                    discard;
                }
            } else {
                discard;
            }
        }
    }
    
    // Draw Sun
    let sunDot = dot(dir, uSunDir);
    var sunColor = vec3<f32>(0.0);
    if (sunDot > 0.9998) {
        sunColor = vec3<f32>(2.0, 1.9, 1.8); // Core bright white-yellow
    } else if (sunDot > 0.998) {
        let glow = (sunDot - 0.998) / (0.9998 - 0.998);
        sunColor = vec3<f32>(1.0, 0.8, 0.5) * glow;
    }
    
    let starPattern = hash(floor(dir * 160.0));
    var stars = 0.0;
    if (starPattern > 0.995) {
        let intensity = sin(uTime * 1.8 + starPattern * 100.0) * 0.4 + 0.6;
        stars = pow(fract(starPattern * 1234.56), 25.0) * intensity * 2.0;
    }
    
    let gasCoords = dir * 2.8 + vec3<f32>(0.0, uTime * 0.003, uTime * 0.0015);
    let n1 = fbm(gasCoords);
    let n2 = fbm(gasCoords + vec3<f32>(3.2, 1.5, -2.1));
    
    let colorNebula1 = vec3<f32>(0.01, 0.005, 0.04);
    let colorNebula2 = vec3<f32>(0.08, 0.03, 0.22);
    let colorNebula3 = vec3<f32>(0.01, 0.12, 0.25);
    let colorNebula4 = vec3<f32>(0.28, 0.04, 0.16);
    
    var skyColor = mix(colorNebula1, colorNebula2, n1);
    skyColor = mix(skyColor, colorNebula3, n2 * 0.7);
    skyColor += colorNebula4 * max(n1 * n2 - 0.08, 0.0) * 1.5;
    
    skyColor *= uGasIntensity;
    let finalColor = skyColor + vec3<f32>(stars, stars, stars) + sunColor;
    
    return vec4<f32>(finalColor, 1.0);
}
            `;

            const shaderModule = this.webgpu.device.createShaderModule({ code: skyWGSL });

            this.webgpu.skyPipeline = this.webgpu.device.createRenderPipeline({
              layout: 'auto',
              vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
              },
              fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: this.webgpu.format }],
              },
              primitive: {
                topology: 'triangle-list',
              },
              depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'always',
                format: 'depth24plus',
              },
            });

            
            // --- Compile WebGPU Terrain Pipeline ---
            const terrainWGSL = `
struct TerrainUniforms {
    viewProj : mat4x4<f32>,
    lightSpaceMatrix : mat4x4<f32>,
    cameraPos : vec4<f32>,
    lightDir : vec4<f32>,
    waterColor : vec4<f32>,
    params : vec4<f32>, // x: waterRadius, y: renderDistEnabled, z: maxRenderDist, w: shadowsEnabled
    shadowTexelSize : vec2<f32>,
    tunnelCount : u32,
    isTunnelMesh : f32,
    tunnels : array<vec4<f32>, 64>,
};

@group(0) @binding(0) var<uniform> uniforms : TerrainUniforms;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) color : vec3<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) worldPos : vec3<f32>,
    @location(3) lightSpacePos : vec4<f32>,
    @location(4) dist : f32,
};

@vertex
fn vs_main(in : VertexInput) -> VertexOutput {
    var out : VertexOutput;
    if (length(in.position) < 0.01) {
        out.position = vec4<f32>(9999.0, 9999.0, 9999.0, 1.0);
        return out;
    }
    
    out.worldPos = in.position;
    out.normal = normalize(in.position);
    out.color = in.color;
    out.dist = length(in.position - uniforms.cameraPos.xyz);
    
    out.position = uniforms.viewProj * vec4<f32>(in.position, 1.0);
    out.lightSpacePos = uniforms.lightSpaceMatrix * vec4<f32>(in.position, 1.0);
    
    return out;
}

fn calculateShadow(lightSpacePos : vec4<f32>, normal : vec3<f32>, lightDir : vec3<f32>) -> f32 {
    if (uniforms.params.w < 0.5) { return 1.0; }
    
    var projCoords = lightSpacePos.xyz / lightSpacePos.w;
    projCoords = projCoords * 0.5 + vec3<f32>(0.5, 0.5, 0.5); // convert to 0-1 range
    projCoords.y = 1.0 - projCoords.y; // Flip Y for WebGPU shadow map lookup
    
    if (projCoords.z > 1.0 || projCoords.z < 0.0) { return 1.0; }
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) { return 1.0; }
    
    let cosTheta = clamp(dot(normal, lightDir), 0.0, 1.0);
    let slope = sqrt(max(0.0, 1.0 - cosTheta * cosTheta)) / max(cosTheta, 0.05);
    let bias = clamp(0.0005 + 0.0012 * slope, 0.0005, 0.0022);
    
    var shadow = 0.0;
    for (var x = -1; x <= 1; x++) {
        for (var y = -1; y <= 1; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * uniforms.shadowTexelSize;
            shadow += textureSampleCompare(shadowMap, shadowSampler, projCoords.xy + offset, projCoords.z - bias);
        }
    }
    shadow = shadow / 9.0;
    
    let distFromCenter = length(projCoords.xy - vec2<f32>(0.5));
    let edgeFade = 1.0 - smoothstep(0.36, 0.49, distFromCenter);
    
    return mix(1.0, shadow, edgeFade);
}

@fragment
fn fs_main(in : VertexOutput) -> @location(0) vec4<f32> {
    if (uniforms.isTunnelMesh > 0.5) {
        let distToCenter = length(in.worldPos);
    } else {
        for (var i = 0u; i < 64u; i++) {
            if (i < uniforms.tunnelCount) {
                let t = uniforms.tunnels[i];
                let diff = in.worldPos - t.xyz;
                if (dot(diff, diff) < (t.w * 0.96) * (t.w * 0.96)) {
                    discard;
                }
            }
        }
    }
    
    if (uniforms.params.y > 0.5 && in.dist > uniforms.params.z) {
        discard;
    }
    
    var finalColor = in.color;
    if (uniforms.lightDir.w > 0.5) {
        let normal = normalize(in.normal);
        let lightDir = normalize(uniforms.lightDir.xyz);
        let diffuseVal = max(dot(normal, lightDir), 0.0);
        
        var shadow = calculateShadow(in.lightSpacePos, normal, lightDir);
        if (diffuseVal <= 0.0) { shadow = 0.0; }
        let lit = mix(0.3, 1.0, shadow);
        let diffuse = diffuseVal * lit * 0.8 + 0.2;
        finalColor = in.color * diffuse;
    }
    
    let dist = length(in.worldPos);
    if (dist < uniforms.params.x) {
        let depth = uniforms.params.x - dist;
        var tintFactor = 1.0 - exp(-depth * 5.0);
        tintFactor = clamp(tintFactor * uniforms.waterColor.w, 0.0, 0.85);
        finalColor = mix(finalColor, uniforms.waterColor.xyz, tintFactor);
    }
    
    return vec4<f32>(finalColor, 1.0);
}
`;
            const terrainModule = this.webgpu.device.createShaderModule({ label: 'Terrain Shader', code: terrainWGSL });
            
            this.webgpu.terrainPipeline = this.webgpu.device.createRenderPipeline({
                label: 'Terrain Pipeline',
                layout: 'auto',
                vertex: {
                    module: terrainModule,
                    entryPoint: 'vs_main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                    ]
                },
                fragment: {
                    module: terrainModule,
                    entryPoint: 'fs_main',
                    targets: [{ format: this.webgpu.format }]
                },
                primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' },
                depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
            });

            const shadowSize = 1024;
            this.webgpu.shadowDepthTexture = this.webgpu.device.createTexture({
                size: [shadowSize, shadowSize, 1],
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                format: 'depth32float',
            });
            this.webgpu.shadowDepthTextureView = this.webgpu.shadowDepthTexture.createView();
            
            this.webgpu.shadowSampler = this.webgpu.device.createSampler({
                compare: 'less',
                magFilter: 'linear',
                minFilter: 'linear',
            });

            this.webgpu.terrainShadowPipeline = this.webgpu.device.createRenderPipeline({
                label: 'Terrain Shadow Pipeline',
                layout: 'auto',
                vertex: {
                    module: terrainModule,
                    entryPoint: 'vs_main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                    ]
                },
                primitive: { topology: 'triangle-list', cullMode: 'none', frontFace: 'cw' },
                depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth32float' }
            });

            this.webgpu.terrainUniformBuffer = this.webgpu.device.createBuffer({
                size: 1232,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            this.webgpu.terrainBindGroup = this.webgpu.device.createBindGroup({
                layout: this.webgpu.terrainPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.webgpu.terrainUniformBuffer } },
                    { binding: 1, resource: this.webgpu.shadowDepthTextureView },
                    { binding: 2, resource: this.webgpu.shadowSampler }
                ]
            });
            
            this.webgpu.terrainShadowBindGroup = this.webgpu.device.createBindGroup({
                layout: this.webgpu.terrainShadowPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.webgpu.terrainUniformBuffer } },
                    { binding: 1, resource: this.webgpu.shadowDepthTextureView },
                    { binding: 2, resource: this.webgpu.shadowSampler }
                ]
            });

            // Uniform buffer size: 
            // viewProjInverse (mat4x4 = 64 bytes)
            // cameraPos (vec4 = 16 bytes)
            // params (vec4 = 16 bytes)
            // sunDir (vec4 = 16 bytes)
            // Total = 112 bytes
            this.webgpu.skyUniformBuffer = this.webgpu.device.createBuffer({
              size: 112,
              usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            this.webgpu.skyBindGroup = this.webgpu.device.createBindGroup({
              layout: this.webgpu.skyPipeline.getBindGroupLayout(0),
              entries: [
                {
                  binding: 0,
                  resource: {
                    buffer: this.webgpu.skyUniformBuffer,
                  },
                },
              ],
            });

    
            // Water Uniform Buffer & Dummy Water Mask
            this.webgpu.waterUniformBuffer = this.webgpu.device.createBuffer({
                size: 2048,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const dummyWaterTex = this.webgpu.device.createTexture({
                size: [1, 1, 1],
                format: 'r8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
            });
            this.webgpu.device.queue.writeTexture(
                { texture: dummyWaterTex },
                new Uint8Array([255]),
                { bytesPerRow: 1 },
                [1, 1, 1]
            );
            this.webgpu.dummyWaterMaskTextureView = dummyWaterTex.createView();
            this.webgpu.dummyWaterMaskSampler = this.webgpu.device.createSampler({
                magFilter: 'linear',
                minFilter: 'linear'
            });

            this.webgpu.waterPipeline = this.webgpu.device.createRenderPipeline({
                label: 'Native Water Pipeline',
                layout: 'auto',
                vertex: {
                    module: this.waterShaderModule,
                    entryPoint: 'vs_main',
                    buffers: [
                        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }
                    ]
                },
                fragment: {
                    module: this.waterShaderModule,
                    entryPoint: 'fs_main',
                    targets: [{
                        format: this.format,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        }
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'none'
                },
                depthStencil: {
                    depthWriteEnabled: false,
                    depthCompare: 'less',
                    format: 'depth24plus'
                }
            });

        this.webgpu.dummyNormalBuffer = this.webgpu.device.createBuffer({
            size: 12,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.webgpu.device.queue.writeBuffer(this.webgpu.dummyNormalBuffer, 0, new Float32Array([0, 1, 0]));
        this.webgpu.dummyColorBuffer = this.webgpu.device.createBuffer({
            size: 12,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.webgpu.device.queue.writeBuffer(this.webgpu.dummyColorBuffer, 0, new Float32Array([0, 0, 0]));
        
        if (typeof WebGPU3DUI !== "undefined") {
            WebGPU3DUI.init(this.webgpu.device, this.webgpu.format);
        }

        this.webgpu.ready = true;
            this.mode = 'webgl'; // Set primary high-performance WebGL mode
            console.log("Graphics API: Operating in Native WebGL High-Performance Mode.");
          }
        }
      } catch (e) {
        console.warn("Graphics API: WebGPU initialization check complete, using WebGL.", e);
      }
    } else {
      console.warn("Graphics API: Using WebGL Engine.");
    }

    this.mode = 'webgl';
    console.log("Graphics API: Operating in Native WebGL Engine Mode.");
  },

  renderWebGPU_MigratedParts(params) {
    if (!this.webgpu.ready) return;
    const { isUnderwater, invViewProj: viewProjInv, cameraPos, time, gasIntensity, waterRadius, finalLightDir, viewMatrix, projMatrix, lightSpaceMatrix, waterColor, waterOpacity, renderDistEnabled, maxRenderDist, shadowMapEnabled, shadowTexelSize } = params;
    const commandEncoder = this.webgpu.currentCommandEncoder || this.webgpu.device.createCommandEncoder();
    this.webgpu.currentCommandEncoder = commandEncoder;
    
    

    // --- Main Color Pass ---
    const textureView = this.webgpu.context.getCurrentTexture().createView();
    const clearColor = isUnderwater 
      ? { r: 0.01, g: 0.08, b: 0.16, a: 1.0 }
      : { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };

    const renderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.webgpu.mainDepthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    };
    
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    this.webgpu.currentPassEncoder = passEncoder;
    this.webgpu.currentCommandEncoder = commandEncoder;


    
    // Render Sky natively if available
    const isSkyOn = params.skyEnabled !== undefined ? params.skyEnabled : (typeof skyEnabled !== 'undefined' ? skyEnabled : true);
    if (this.webgpu.skyPipeline && isSkyOn) {
        passEncoder.setPipeline(this.webgpu.skyPipeline);
        passEncoder.setBindGroup(0, this.webgpu.skyBindGroup);
        
        const skyUniforms = f32_webgpuSkyUniforms; // 16 (inv) + 4 (camPos) + 4 (params) + 4 (sunDir) = 28
        if (viewProjInv) skyUniforms.set(viewProjInv, 0);
        if (cameraPos) skyUniforms.set(cameraPos, 16);
        skyUniforms[20] = (time || 0) * 0.05; // Time
        skyUniforms[21] = gasIntensity !== undefined ? gasIntensity : (typeof skyGasIntensity !== 'undefined' ? skyGasIntensity : 1.0); // GasIntensity
        skyUniforms[22] = (typeof window.isSpaceCameraMode !== 'undefined' && window.isSpaceCameraMode) ? 0.0 : (waterRadius || 0.0); // WaterRadius
        skyUniforms[23] = 0.0;
        if (finalLightDir) {
            skyUniforms.set(finalLightDir, 24);
        }
        this.webgpu.device.queue.writeBuffer(this.webgpu.skyUniformBuffer, 0, skyUniforms);
        
        passEncoder.draw(3, 1, 0, 0);
    }
    
    // Render Terrain
    if (this.webgpu.terrainPipeline && this.webgpu.terrainVertexBuffer) {
        passEncoder.setPipeline(this.webgpu.terrainPipeline);
        passEncoder.setBindGroup(0, this.webgpu.terrainBindGroup);
        passEncoder.setVertexBuffer(0, this.webgpu.terrainVertexBuffer);
        passEncoder.setVertexBuffer(1, this.webgpu.terrainColorBuffer);
        passEncoder.setIndexBuffer(this.webgpu.terrainIndexBuffer, this.webgpu.terrainUseUint32 ? 'uint32' : 'uint16');
        passEncoder.drawIndexed(this.webgpu.terrainIndicesLength, 1, 0, 0, 0);
    }

    // --- Render Water (Native WebGPU) ---
    if (this.webgpu.waterPipeline && this.webgpu.waterVertexBuffer && this.webgpu.waterIndicesLength > 0 && (typeof waterEnabled === 'undefined' || waterEnabled)) {
        const timeVal = time || 0;
        const wColor = waterColor || (typeof window.waterColor !== 'undefined' ? window.waterColor : [0.1, 0.4, 0.8]);
        const wOpacity = waterOpacity !== undefined ? waterOpacity : (typeof window.waterOpacity !== 'undefined' ? window.waterOpacity : 0.8);
        const wAnimTime = typeof window.waterAnimTime !== 'undefined' ? window.waterAnimTime : timeVal;
        const wWaveStrength = typeof window.waveStrength !== 'undefined' ? window.waveStrength : 1.0;
        const wLevel = typeof window.waterLevel !== 'undefined' ? window.waterLevel : 1.0;
        const lightDir = finalLightDir || [0, 1, 0];
        const camPos = cameraPos || [0, 0, 0];
        const renderDistE = renderDistEnabled ? 1.0 : 0.0;
        const renderDistVal = maxRenderDist !== undefined ? maxRenderDist : 100.0;
        const colls = typeof collectibles !== 'undefined' ? collectibles : [];

        // Collect top 4 boats for clipping
        let boatCount = 0;
        const topBoats = [null, null, null, null];
        const topBoatsDistSq = [Infinity, Infinity, Infinity, Infinity];

        const CLIPPING_MODELS = { "wood_boat": { size: [0.115, 0.055, 0.27], offset: [0.035, 1.0, 0.0] } };

        for (let i = 0; i < colls.length; i++) {
          const c = colls[i];
          if (c && c.active && (c.type in CLIPPING_MODELS) && !c.isPreview) {
            const dx = c.position[0] - camPos[0];
            const dy = c.position[1] - camPos[1];
            const dz = c.position[2] - camPos[2];
            const distSq = dx*dx + dy*dy + dz*dz;
            for (let j = 0; j < 4; j++) {
              if (distSq < topBoatsDistSq[j]) {
                for (let k = 3; k > j; k--) {
                  topBoats[k] = topBoats[k - 1];
                  topBoatsDistSq[k] = topBoatsDistSq[k - 1];
                }
                topBoats[j] = c;
                topBoatsDistSq[j] = distSq;
                break;
              }
            }
          }
        }
        for (let j = 0; j < 4; j++) {
          if (topBoats[j] !== null) boatCount++;
        }

        f32_webgpuWaterUData.fill(0);
        const uData = f32_webgpuWaterUData; // 2048 bytes
        if (viewMatrix) uData.set(viewMatrix, 0);
        if (projMatrix) uData.set(projMatrix, 16);
        uData[32] = wColor[0]; uData[33] = wColor[1]; uData[34] = wColor[2]; uData[35] = 1.0;
        uData[36] = wOpacity; uData[37] = wAnimTime; uData[38] = wWaveStrength; uData[39] = wLevel;
        uData[40] = lightDir[0]; uData[41] = lightDir[1]; uData[42] = lightDir[2]; uData[43] = 0.0;
        uData[44] = camPos[0]; uData[45] = camPos[1]; uData[46] = camPos[2]; uData[47] = 0.0;
        uData[48] = renderDistE; uData[49] = renderDistVal; uData[50] = 0.0; uData[51] = 0.0;
        uData[52] = boatCount; uData[53] = 0.0; uData[54] = 0.0; uData[55] = 0.0;

        for (let i = 0; i < boatCount; i++) {
          const item = topBoats[i];
          const pPos = item.position;
          let n = item.normal || [0, 1, 0];
          let r = item.R || [1, 0, 0];
          let f = item.F || [0, 0, 1];
          const lenR = Math.hypot(r[0], r[1], r[2]) || 1;
          const lenN = Math.hypot(n[0], n[1], n[2]) || 1;
          const lenF = Math.hypot(f[0], f[1], f[2]) || 1;
          const cfg = CLIPPING_MODELS[item.type];

          const offP = 56 + i * 4;
          const offR = 72 + i * 4;
          const offN = 88 + i * 4;
          const offF = 104 + i * 4;
          const offS = 120 + i * 4;
          const offO = 136 + i * 4;

          uData[offP] = pPos[0]; uData[offP+1] = pPos[1]; uData[offP+2] = pPos[2]; uData[offP+3] = 0;
          uData[offR] = r[0]/lenR; uData[offR+1] = r[1]/lenR; uData[offR+2] = r[2]/lenR; uData[offR+3] = 0;
          uData[offN] = n[0]/lenN; uData[offN+1] = n[1]/lenN; uData[offN+2] = n[2]/lenN; uData[offN+3] = 0;
          uData[offF] = f[0]/lenF; uData[offF+1] = f[1]/lenF; uData[offF+2] = f[2]/lenF; uData[offF+3] = 0;
          uData[offS] = cfg.size[0]; uData[offS+1] = cfg.size[1]; uData[offS+2] = cfg.size[2]; uData[offS+3] = 0;
          uData[offO] = cfg.offset[0]; uData[offO+1] = cfg.offset[1]; uData[offO+2] = cfg.offset[2]; uData[offO+3] = 0;
        }

        this.webgpu.device.queue.writeBuffer(this.webgpu.waterUniformBuffer, 0, uData.buffer);

        const maskTexView = this.webgpu.waterMaskTextureView || this.webgpu.dummyWaterMaskTextureView;
        const maskSampler = this.webgpu.waterMaskSampler || this.webgpu.dummyWaterMaskSampler;

        const waterBindGroup = this.webgpu.device.createBindGroup({
            layout: this.webgpu.waterPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.webgpu.waterUniformBuffer } },
                { binding: 1, resource: maskTexView },
                { binding: 2, resource: maskSampler }
            ]
        });

        passEncoder.setPipeline(this.webgpu.waterPipeline);
        passEncoder.setBindGroup(0, waterBindGroup);
        passEncoder.setVertexBuffer(0, this.webgpu.waterVertexBuffer);
        passEncoder.setIndexBuffer(this.webgpu.waterIndexBuffer, this.webgpu.waterUseUint32 ? 'uint32' : 'uint16');
        passEncoder.drawIndexed(this.webgpu.waterIndicesLength, 1, 0, 0, 0);
    }

  },
};

// Expose legacy globals for the rest of the engine during migration
let isWebGPUReady = false; 

// Setup canvases
canvas = document.getElementById("mapCanvas"); // Primary Canvas (WebGPU)
let glCanvas = document.getElementById("glCanvas"); // Secondary Canvas (WebGL Overlay)

// Initialize WebGPU asynchronously
Graphics.init(canvas, glCanvas).then(() => {
  isWebGPUReady = Graphics.webgpu.ready;
});

// Initialize WebGL synchronously (Legacy requirement)
const initialAntialias = (typeof antialiasEnabled !== "undefined" && antialiasEnabled) || 
                         (typeof fxaaEnabled !== "undefined" && fxaaEnabled) || 
                         (typeof window.fxaaEnabled !== "undefined" && window.fxaaEnabled) || 
                         (typeof taauEnabled !== "undefined" && taauEnabled) || 
                         (typeof window.taauEnabled !== "undefined" && window.taauEnabled);
gl =
  glCanvas.getContext("webgl2", { antialias: initialAntialias, stencil: true, alpha: true, premultipliedAlpha: false }) ||
  glCanvas.getContext("webgl", { antialias: initialAntialias, stencil: true, alpha: true, premultipliedAlpha: false });

if (!gl) {
  // If overlay fails, try the primary canvas (legacy fallback path)
  gl = canvas.getContext("webgl2", { antialias: initialAntialias, stencil: true }) ||
       canvas.getContext("webgl", { antialias: initialAntialias, stencil: true });
}

if (!gl) {
  alert("เบราว์เซอร์ของคุณไม่รองรับ WebGL");
}

Graphics.webgl.gl = gl;
if (typeof window !== "undefined") {
  window.gl = gl;
}
if (typeof Graphics !== "undefined") {
  Graphics.gl = gl;
}
isWebGL2 = gl instanceof WebGL2RenderingContext;
Graphics.webgl.isWebGL2 = isWebGL2;
supportUint32 = isWebGL2 || gl.getExtension("OES_element_index_uint");

Graphics.webgl.supportUint32 = supportUint32;

if (!gl._patchedForWebGPU) {
    gl._patchedForWebGPU = true;
    gl._activeAttributes = {};
    gl._uniformValues = {};
    gl._colorMask = [true, true, true, true];
    gl._depthMask = true;
    gl._cullFace = gl.BACK;
    gl._frontFace = gl.CCW;
    gl._cullEnabled = false;
    gl._depthTest = false;
    gl._stencilEnabled = false;

    const origColorMask = gl.colorMask;
    gl.colorMask = function(r, g, b, a) { origColorMask.apply(this, arguments); gl._colorMask = [r, g, b, a]; };
    const origDepthMask = gl.depthMask;
    gl.depthMask = function(flag) { origDepthMask.apply(this, arguments); gl._depthMask = flag; };
    const origEnable = gl.enable;
    gl.enable = function(cap) { origEnable.apply(this, arguments); if (cap === gl.CULL_FACE) gl._cullEnabled = true; if (cap === gl.DEPTH_TEST) gl._depthTest = true; if (cap === gl.STENCIL_TEST) gl._stencilEnabled = true; };
    const origDisable = gl.disable;
    gl.disable = function(cap) { origDisable.apply(this, arguments); if (cap === gl.CULL_FACE) gl._cullEnabled = false; if (cap === gl.DEPTH_TEST) gl._depthTest = false; if (cap === gl.STENCIL_TEST) gl._stencilEnabled = false; };
    const origCullFace = gl.cullFace;
    gl.cullFace = function(mode) { origCullFace.apply(this, arguments); gl._cullFace = mode; };
    const origFrontFace = gl.frontFace;
    gl.frontFace = function(mode) { origFrontFace.apply(this, arguments); gl._frontFace = mode; };

    const origGetAttribLocation = gl.getAttribLocation;
    gl.getAttribLocation = function(prog, name) {
        if (!prog) return -1;
        if (!prog._attribLocCache) prog._attribLocCache = {};
        if (prog._attribLocCache[name] !== undefined) return prog._attribLocCache[name];
        const loc = origGetAttribLocation.call(this, prog, name);
        if (!prog._attribNamesInv) prog._attribNamesInv = {};
        prog._attribNamesInv[name] = loc;
        prog._attribLocCache[name] = loc;
        return loc;
    };

    const origGetUniformLocation = gl.getUniformLocation;
    gl.getUniformLocation = function(prog, name) {
        if (!prog) return null;
        if (!prog._uniformLocCache) prog._uniformLocCache = {};
        if (prog._uniformLocCache[name] !== undefined) return prog._uniformLocCache[name];
        const loc = origGetUniformLocation.call(this, prog, name);
        if (loc) { loc._name = name; loc._prog = prog; }
        prog._uniformLocCache[name] = loc;
        return loc;
    };

    const origUseProgram = gl.useProgram;
    gl.useProgram = function(prog) {
        origUseProgram.apply(this, arguments);
        gl._currentProgram = prog;
        if (prog === window.modelProgram) prog._name = 'model';
        if (prog === window.charProgram) prog._name = 'char';
        if (!prog._uniformValues) prog._uniformValues = {};
    };

    function trackUniform(loc, value) {
        if (loc && loc._name && loc._prog) loc._prog._uniformValues[loc._name] = value;
    }

    const origUniform1f = gl.uniform1f; gl.uniform1f = function(loc, v0) { origUniform1f.apply(this, arguments); trackUniform(loc, [v0]); };
    const origUniform2f = gl.uniform2f; gl.uniform2f = function(loc, v0, v1) { origUniform2f.apply(this, arguments); trackUniform(loc, [v0, v1]); };
    const origUniform3f = gl.uniform3f; gl.uniform3f = function(loc, v0, v1, v2) { origUniform3f.apply(this, arguments); trackUniform(loc, [v0, v1, v2]); };
    const origUniform1i = gl.uniform1i; gl.uniform1i = function(loc, v0) { origUniform1i.apply(this, arguments); trackUniform(loc, [v0]); };
    const origUniform3fv = gl.uniform3fv; gl.uniform3fv = function(loc, v) { origUniform3fv.apply(this, arguments); trackUniform(loc, v); };
    const origUniformMatrix4fv = gl.uniformMatrix4fv; gl.uniformMatrix4fv = function(loc, trans, v) { origUniformMatrix4fv.apply(this, arguments); trackUniform(loc, v); };
}


      function resizeCanvas() {
        const w = Math.max(1, Math.round(window.innerWidth * renderScale));
        const h = Math.max(1, Math.round(window.innerHeight * renderScale));
        canvas.width = w;
        canvas.height = h;
        if (Graphics.webgpu.device && Graphics.webgpu.context) {
          const device = Graphics.webgpu.device;
          if (Graphics.webgpu.mainDepthTexture) Graphics.webgpu.mainDepthTexture.destroy();
          Graphics.webgpu.mainDepthTexture = device.createTexture({
            size: [w, h, 1],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
          });
          Graphics.webgpu.mainDepthTextureView = Graphics.webgpu.mainDepthTexture.createView();
        }
        if (glCanvas) {
          glCanvas.width = w;
          glCanvas.height = h;
        }
        gl.viewport(0, 0, w, h);

        if (
          typeof render === "function" &&
          typeof gameStarted !== "undefined" &&
          gameStarted
        ) {
          render(performance.now(), true);
        }
      }
      resizeCanvas();
      window.addEventListener("resize", () => {
        resizeCanvas();
        updateActionSlotsPosition();
      });


      function createShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error("Shader error:", gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vertexShader = createShader(vertexShaderSource, gl.VERTEX_SHADER);
      const fragmentShader = createShader(
        fragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.useProgram(program);
      program._name = 'model'; // Route to model WGSL in hybrid mode
      window.surfaceProgram = program;

      const positionLoc = gl.getAttribLocation(program, "aPosition");
      const colorLoc = gl.getAttribLocation(program, "aColor");
      const terrainRadiusAttrLoc = gl.getAttribLocation(program, "aTerrainRadius");
      const tunnelCenterAttrLoc = gl.getAttribLocation(program, "aTunnelCenter");
      const modelViewLoc = gl.getUniformLocation(program, "uModelViewMatrix");
      const projectionLoc = gl.getUniformLocation(program, "uProjectionMatrix");
      const lightDirLoc = gl.getUniformLocation(program, "uLightDir");
      const useLightingLoc = gl.getUniformLocation(program, "uUseLighting");

      const tunnelsLoc = gl.getUniformLocation(program, "uTunnels");
      const tunnelCountLoc = gl.getUniformLocation(program, "uTunnelCount");
      const isTunnelMeshLoc = gl.getUniformLocation(program, "uIsTunnelMesh");

      const terrainWaterRadiusLoc = gl.getUniformLocation(
        program,
        "uWaterRadius",
      );
      const terrainWaterColorLoc = gl.getUniformLocation(
        program,
        "uWaterColor",
      );
      const terrainWaterOpacityLoc = gl.getUniformLocation(
        program,
        "uWaterOpacity",
      );

      const terrainRenderDistEnabledLoc = gl.getUniformLocation(
        program,
        "uRenderDistEnabled",
      );
      const terrainMaxRenderDistLoc = gl.getUniformLocation(
        program,
        "uMaxRenderDist",
      );
      const terrainCameraPosLoc = gl.getUniformLocation(
        program,
        "uCameraPos",
      );

      // --- Model Program Setup ---
      const modelVS = createShader(modelVertexShaderSource, gl.VERTEX_SHADER);
      const modelFS = createShader(
        modelFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const modelProgram = gl.createProgram();
      gl.attachShader(modelProgram, modelVS);
      gl.attachShader(modelProgram, modelFS);
      gl.linkProgram(modelProgram);

      const modelPosLoc = gl.getAttribLocation(modelProgram, "aPosition");
      const modelColorLoc = gl.getAttribLocation(modelProgram, "aColor");
      const modelNormalLoc = gl.getAttribLocation(modelProgram, "aNormal");
      const modelMVLoc = gl.getUniformLocation(
        modelProgram,
        "uModelViewMatrix",
      );
      const modelProjLoc = gl.getUniformLocation(
        modelProgram,
        "uProjectionMatrix",
      );
      const modelLightDirLoc = gl.getUniformLocation(modelProgram, "uLightDir");
      const modelTintLoc = gl.getUniformLocation(modelProgram, "uTint");
      window.modelTintLoc = modelTintLoc;

      const modelWaterRadiusLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterRadius",
      );
      const modelWaterColorLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterColor",
      );
      const modelWaterOpacityLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterOpacity",
      );

      const modelTimeLoc = gl.getUniformLocation(modelProgram, "uTime");
      const modelSwayFactorLoc = gl.getUniformLocation(
        modelProgram,
        "uSwayFactor",
      );
      const modelWaterSwayFactorLoc = gl.getUniformLocation(
        modelProgram,
        "uWaterSwayFactor",
      );
      const modelPlanetRadiusLoc = gl.getUniformLocation(
        modelProgram,
        "uPlanetRadius",
      );
      const modelCameraPosLoc = gl.getUniformLocation(
        modelProgram,
        "uCameraPos",
      );
      const modelRenderDistEnabledLoc = gl.getUniformLocation(
        modelProgram,
        "uRenderDistEnabled",
      );
      const modelMaxRenderDistLoc = gl.getUniformLocation(
        modelProgram,
        "uMaxRenderDist",
      );

      let charLocalPosLoc, charColorLoc, charTexCoordLoc;
      let charMainTexLoc, charHasMainTexLoc;
      let charFaceTexLoc, charUseFaceTexLoc;

      const charVS = createShader(
        window.characterVertexShaderSource,
        gl.VERTEX_SHADER,
      );
      const charFS = createShader(
        window.characterFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const charProgram = gl.createProgram();
      gl.attachShader(charProgram, charVS);
      gl.attachShader(charProgram, charFS);
      gl.linkProgram(charProgram);

      const charPosLoc = gl.getAttribLocation(charProgram, "aPosition");
      charLocalPosLoc = gl.getAttribLocation(charProgram, "aLocalPos");
      const charNormLoc = gl.getAttribLocation(charProgram, "aNormal");
      charColorLoc = gl.getAttribLocation(charProgram, "aColor");
      charTexCoordLoc = gl.getAttribLocation(charProgram, "aTexCoord");
      charMainTexLoc = gl.getUniformLocation(charProgram, "uMainTex");
      charHasMainTexLoc = gl.getUniformLocation(charProgram, "uHasMainTex");
      charFaceTexLoc = gl.getUniformLocation(charProgram, "uFaceTex");
      charUseFaceTexLoc = gl.getUniformLocation(charProgram, "uUseFaceTex");
      const charMVLoc = gl.getUniformLocation(charProgram, "uModelViewMatrix");
      const charProjLoc = gl.getUniformLocation(
        charProgram,
        "uProjectionMatrix",
      );
      const charLightDirLoc = gl.getUniformLocation(charProgram, "uLightDir");
      const charCameraPosLoc = gl.getUniformLocation(charProgram, "uCameraPos");

      const charWaterRadiusLoc = gl.getUniformLocation(
        charProgram,
        "uWaterRadius",
      );
      const charWaterColorLoc = gl.getUniformLocation(
        charProgram,
        "uWaterColor",
      );
      const charWaterOpacityLoc = gl.getUniformLocation(
        charProgram,
        "uWaterOpacity",
      );

      if (typeof WaterSystem !== "undefined" && WaterSystem.init) {
        WaterSystem.init(gl, supportUint32);
      }
      if (typeof CaveSystem !== "undefined" && CaveSystem.init) {
        CaveSystem.init(gl, supportUint32);
      }

      // --- Atmosphere Program Setup ---
      const atmosphereVS = createShader(
        atmosphereVertexShaderSource,
        gl.VERTEX_SHADER,
      );
      const atmosphereFS = createShader(
        atmosphereFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const atmosphereProgram = gl.createProgram();
      gl.attachShader(atmosphereProgram, atmosphereVS);
      gl.attachShader(atmosphereProgram, atmosphereFS);
      gl.linkProgram(atmosphereProgram);
atmosphereProgram._name = 'atmosphere';
window.atmosphereProgram = atmosphereProgram;

      const atmospherePosLoc = gl.getAttribLocation(
        atmosphereProgram,
        "aPosition",
      );
      const atmosphereMVLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uModelViewMatrix",
      );
      const atmosphereProjLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uProjectionMatrix",
      );
      const atmosphereColorLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uColor",
      );
      const atmosphereAlphaLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uAlpha",
      );
      const atmosphereLightDirLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uLightDir",
      );
      const atmosphereCameraPosLoc = gl.getUniformLocation(
        atmosphereProgram,
        "uCameraPos",
      );

      // --- Sky (Space Background) Program Setup ---
      const skyVS = createShader(skyVertexShaderSource, gl.VERTEX_SHADER);
      const skyFS = createShader(skyFragmentShaderSource, gl.FRAGMENT_SHADER);
      const skyProgram = gl.createProgram();
      gl.attachShader(skyProgram, skyVS);
      gl.attachShader(skyProgram, skyFS);
      gl.linkProgram(skyProgram);
skyProgram._name = 'sky';
window.skyProgram = skyProgram;

      const skyPosLoc = gl.getAttribLocation(skyProgram, "aPosition");
      const skyMVLoc = gl.getUniformLocation(skyProgram, "uModelViewMatrix");
      const skyProjLoc = gl.getUniformLocation(skyProgram, "uProjectionMatrix");
      const skyTimeLoc = gl.getUniformLocation(skyProgram, "uTime");
      const skyGasIntensityLoc = gl.getUniformLocation(
        skyProgram,
        "uGasIntensity",
      );
      const skyCameraPosLoc = gl.getUniformLocation(skyProgram, "uCameraPos");
      const skyWaterRadiusLoc = gl.getUniformLocation(skyProgram, "uWaterRadius");

      // --- Clouds 3D Program Setup ---
      const cloud3DVS = createShader(window.cloud3DVertexShaderSource || cloud3DVertexShaderSource, gl.VERTEX_SHADER);
      const cloud3DFS = createShader(window.cloud3DFragmentShaderSource || cloud3DFragmentShaderSource, gl.FRAGMENT_SHADER);
      const cloud3DProgram = gl.createProgram();
      gl.attachShader(cloud3DProgram, cloud3DVS);
      gl.attachShader(cloud3DProgram, cloud3DFS);
      gl.linkProgram(cloud3DProgram);
cloud3DProgram._name = 'cloud3D';
window.cloud3DProgram = cloud3DProgram;
      const cloud3DPosLoc = gl.getAttribLocation(cloud3DProgram, "aPosition");
      const cloud3DLocalPosLoc = gl.getAttribLocation(cloud3DProgram, "aLocalPos");
      const cloud3DMVLoc = gl.getUniformLocation(cloud3DProgram, "uModelViewMatrix");
      const cloud3DProjLoc = gl.getUniformLocation(cloud3DProgram, "uProjectionMatrix");
      const cloud3DColorLoc = gl.getUniformLocation(cloud3DProgram, "uColor");
      const cloud3DAlphaLoc = gl.getUniformLocation(cloud3DProgram, "uAlpha");
      const cloud3DTimeLoc = gl.getUniformLocation(cloud3DProgram, "uTime");
      const cloud3DAnimTimeLoc = gl.getUniformLocation(cloud3DProgram, "uAnimTime");
      const cloud3DOrbitMatrixLoc = gl.getUniformLocation(cloud3DProgram, "uCloudOrbitMatrix");
      const cloud3DLightDirLoc = gl.getUniformLocation(cloud3DProgram, "uLightDir");
      const cloud3DCameraPosLoc = gl.getUniformLocation(cloud3DProgram, "uCameraPos");
      const cloud3DWaterRadiusLoc = gl.getUniformLocation(cloud3DProgram, "uWaterRadius");

      // --- Sun & Celestial Program Setup ---
      let sunProgram = null;
      let sunPosLoc = -1, sunColorLoc = -1;
      let sunMVLoc = null, sunProjLoc = null, sunTimeLoc = null, sunTintLoc = null, sunIsSunLoc = null, sunLightDirLoc = null;
      try {
        const sunVS = createShader(window.sunVertexShaderSource || sunVertexShaderSource, gl.VERTEX_SHADER);
        const sunFS = createShader(window.sunFragmentShaderSource || sunFragmentShaderSource, gl.FRAGMENT_SHADER);
        if (sunVS && sunFS) {
          sunProgram = gl.createProgram();
          gl.attachShader(sunProgram, sunVS);
          gl.attachShader(sunProgram, sunFS);
          gl.linkProgram(sunProgram);
          if (gl.getProgramParameter(sunProgram, gl.LINK_STATUS)) {
            sunProgram._name = 'sun';
            window.sunProgram = sunProgram;
            sunPosLoc = gl.getAttribLocation(sunProgram, "aPosition");
            sunColorLoc = gl.getAttribLocation(sunProgram, "aColor");
            sunMVLoc = gl.getUniformLocation(sunProgram, "uModelViewMatrix");
            sunProjLoc = gl.getUniformLocation(sunProgram, "uProjectionMatrix");
            sunTimeLoc = gl.getUniformLocation(sunProgram, "uTime");
            sunTintLoc = gl.getUniformLocation(sunProgram, "uTint");
            sunIsSunLoc = gl.getUniformLocation(sunProgram, "uIsSun");
            sunLightDirLoc = gl.getUniformLocation(sunProgram, "uLightDir");
          } else {
            console.error("Sun program link error:", gl.getProgramInfoLog(sunProgram));
          }
        }
      } catch(e) {
        console.warn("Sun shader initialization error:", e);
      }

      // Global buffers
      let cloud3DVertexBuffer = null;
      let cloud3DLocalPosBuffer = null;
      let cloud3DIndexBuffer = null;

      window.resetCloud3DBuffers = function() {
        if (cloud3DVertexBuffer && typeof gl !== "undefined" && gl) {
          try {
            gl.deleteBuffer(cloud3DVertexBuffer);
            gl.deleteBuffer(cloud3DLocalPosBuffer);
            gl.deleteBuffer(cloud3DIndexBuffer);
          } catch(e) {}
        }
        cloud3DVertexBuffer = null;
        cloud3DLocalPosBuffer = null;
        cloud3DIndexBuffer = null;
      };

      window.rebuildClouds3D = function(newHeight) {
        if (typeof newHeight === "number") {
          if (typeof cloudsHeight !== "undefined") cloudsHeight = newHeight;
        }
        const h = typeof cloudsHeight !== "undefined" ? cloudsHeight : (typeof newHeight === "number" ? newHeight : 12.0);
        if (typeof window.generateClouds3D === "function") {
          const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345);
          const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
          window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, h);
          if (typeof window.resetCloud3DBuffers === "function") {
            window.resetCloud3DBuffers();
          }
        }
      };

      // --- Depth Program Setup for Shadow Mapping ---
      const depthVS = createShader(depthVertexShaderSource, gl.VERTEX_SHADER);
      const depthFS = createShader(
        depthFragmentShaderSource,
        gl.FRAGMENT_SHADER,
      );
      const depthProgram = gl.createProgram();
      gl.attachShader(depthProgram, depthVS);
      gl.attachShader(depthProgram, depthFS);
      gl.linkProgram(depthProgram);

      const depthPosLoc = gl.getAttribLocation(depthProgram, "aPosition");
      const depthColorLoc = gl.getAttribLocation(depthProgram, "aColor");
      const depthModelLoc = gl.getUniformLocation(depthProgram, "uModelMatrix");
      const depthLightSpaceLoc = gl.getUniformLocation(
        depthProgram,
        "uLightSpaceMatrix",
      );
      const depthTimeLoc = gl.getUniformLocation(depthProgram, "uTime");
      const depthSwayFactorLoc = gl.getUniformLocation(
        depthProgram,
        "uSwayFactor",
      );
      const depthWaterSwayFactorLoc = gl.getUniformLocation(
        depthProgram,
        "uWaterSwayFactor",
      );
      const depthPlanetRadiusLoc = gl.getUniformLocation(
        depthProgram,
        "uPlanetRadius",
      );
      const depthWaterRadiusLoc = gl.getUniformLocation(
        depthProgram,
        "uWaterRadius",
      );

      // Shadow Map Framebuffer initialization
      let shadowFramebuffer;
      let shadowDepthTexture;
      let dummyColorTex = null;
      
      function computeShadowMapSize() {
        if (typeof shadowMapQuality === "number" && shadowMapQuality > 0) {
          if (shadowMapQuality === 1) return 1024; // Low: 1024x1024
          if (shadowMapQuality === 2) return 2048; // Medium: 2048x2048
          if (shadowMapQuality === 3) return 2048; // High: 2048x2048
          if (shadowMapQuality >= 4) return 4096; // Ultra: 4096x4096
        }
        return 1024;
      }
      let SHADOW_WIDTH = computeShadowMapSize();
      let SHADOW_HEIGHT = computeShadowMapSize();

      function initShadowMap() {
        if (!isWebGL2) {
          const ext = gl.getExtension("WEBGL_depth_texture");
          if (!ext) {
            console.error("WEBGL_depth_texture extension is not supported.");
          }
        }

        shadowFramebuffer = gl.createFramebuffer();
        shadowDepthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);

        if (isWebGL2) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT24,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        } else {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          shadowDepthTexture,
          0,
        );

        // Dummy color texture to ensure framebuffer completeness on all platforms
        dummyColorTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, dummyColorTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          SHADOW_WIDTH,
          SHADOW_HEIGHT,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          dummyColorTex,
          0,
        );

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          console.error("Shadow Framebuffer incomplete: " + status);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      initShadowMap();
      window.resizeShadowMap = function() {
        if (typeof shadowMapQuality === "number" && shadowMapQuality > 0) {
          SHADOW_WIDTH = computeShadowMapSize();
          SHADOW_HEIGHT = SHADOW_WIDTH;
        }
        if (!shadowDepthTexture || !shadowFramebuffer) return;

        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
        if (isWebGL2) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT24,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        } else {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_INT,
            null,
          );
        }

        if (dummyColorTex) {
          gl.bindTexture(gl.TEXTURE_2D, dummyColorTex);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            SHADOW_WIDTH,
            SHADOW_HEIGHT,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
          );
        }
      };


      // ============================================
      // Post-Processing Anti-Aliasing (FXAA / TAAU Edge Smoothing)
      // ============================================
      let fxaaProgram = null;
      let fxaaQuadBuffer = null;
      let fxaaPosLoc = -1;
      let fxaaTexLoc = null;
      let fxaaResolutionLoc = null;
      let fxaaCopyTex = null;
      let fxaaCopyWidth = 0;
      let fxaaCopyHeight = 0;

      const fxaaVS = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const fxaaFS = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;

        #define FXAA_REDUCE_MIN   (1.0 / 128.0)
        #define FXAA_REDUCE_MUL   (1.0 / 8.0)
        #define FXAA_SPAN_MAX     8.0

        void main() {
          vec2 inverseVP = 1.0 / uResolution;
          vec3 rgbNW = texture2D(uTexture, vUv + vec2(-1.0, -1.0) * inverseVP).rgb;
          vec3 rgbNE = texture2D(uTexture, vUv + vec2( 1.0, -1.0) * inverseVP).rgb;
          vec3 rgbSW = texture2D(uTexture, vUv + vec2(-1.0,  1.0) * inverseVP).rgb;
          vec3 rgbSE = texture2D(uTexture, vUv + vec2( 1.0,  1.0) * inverseVP).rgb;
          vec3 rgbM  = texture2D(uTexture, vUv).rgb;

          vec3 luma = vec3(0.299, 0.587, 0.114);
          float lumaNW = dot(rgbNW, luma);
          float lumaNE = dot(rgbNE, luma);
          float lumaSW = dot(rgbSW, luma);
          float lumaSE = dot(rgbSE, luma);
          float lumaM  = dot(rgbM,  luma);

          float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
          float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

          vec2 dir;
          dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
          dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

          float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
          float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
          dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * inverseVP;

          vec3 rgbA = 0.5 * (
            texture2D(uTexture, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
            texture2D(uTexture, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
          );
          vec3 rgbB = rgbA * 0.5 + 0.25 * (
            texture2D(uTexture, vUv + dir * -0.5).rgb +
            texture2D(uTexture, vUv + dir *  0.5).rgb
          );

          float lumaB = dot(rgbB, luma);
          if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
            gl_FragColor = vec4(rgbA, 1.0);
          } else {
            gl_FragColor = vec4(rgbB, 1.0);
          }
        }
      `;

      function initFXAASystem() {
        if (fxaaProgram) return;
        const vs = createShader(fxaaVS, gl.VERTEX_SHADER);
        const fs = createShader(fxaaFS, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return;
        fxaaProgram = gl.createProgram();
        gl.attachShader(fxaaProgram, vs);
        gl.attachShader(fxaaProgram, fs);
        gl.linkProgram(fxaaProgram);

        fxaaPosLoc = gl.getAttribLocation(fxaaProgram, "aPosition");
        fxaaTexLoc = gl.getUniformLocation(fxaaProgram, "uTexture");
        fxaaResolutionLoc = gl.getUniformLocation(fxaaProgram, "uResolution");

        fxaaQuadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, fxaaQuadBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
          ]),
          gl.STATIC_DRAW
        );

        fxaaCopyTex = gl.createTexture();
      }

      // ============================================
      // Wireframe
      // ============================================
      function buildWireframe(gridSize) {
        const maxSegments = 24;
        const segments = Math.min(Math.floor(gridSize / 2), maxSegments);
        const longCount = segments * 2;
        const r = RADIUS * 1.002;

        const totalPoints = ((segments + 1) * (longCount + 1) + (longCount + 1) * (segments + 1)) * 3;
        const points = new Float32Array(totalPoints);

        const sinLat = new Float64Array(segments + 1);
        const cosLat = new Float64Array(segments + 1);
        for (let lat = 0; lat <= segments; lat++) {
          const theta = (lat / segments) * Math.PI;
          sinLat[lat] = Math.sin(theta);
          cosLat[lat] = Math.cos(theta);
        }

        const sinLong = new Float64Array(longCount + 1);
        const cosLong = new Float64Array(longCount + 1);
        for (let long = 0; long <= longCount; long++) {
          const phi = (long / longCount) * Math.PI * 2;
          sinLong[long] = Math.sin(phi);
          cosLong[long] = Math.cos(phi);
        }

        let pIdx = 0;
        for (let lat = 0; lat <= segments; lat++) {
          const rSin = r * sinLat[lat];
          const rCos = r * cosLat[lat];
          for (let long = 0; long <= longCount; long++) {
            points[pIdx++] = rSin * cosLong[long];
            points[pIdx++] = rCos;
            points[pIdx++] = rSin * sinLong[long];
          }
        }
        for (let long = 0; long <= longCount; long++) {
          const cLong = cosLong[long];
          const sLong = sinLong[long];
          for (let lat = 0; lat <= segments; lat++) {
            const rSin = r * sinLat[lat];
            points[pIdx++] = rSin * cLong;
            points[pIdx++] = r * cosLat[lat];
            points[pIdx++] = rSin * sLong;
          }
        }

        wireframePointCount = pIdx / 3;

        if (wireframeBuffer) gl.deleteBuffer(wireframeBuffer);
        wireframeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, wireframeBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          points,
          gl.STATIC_DRAW,
        );

        const wireColors = new Float32Array(pIdx);
        for (let i = 0; i < wireframePointCount; i++) {
          wireColors[i * 3] = 0.15 + (i % 3) * 0.05;
          wireColors[i * 3 + 1] = 0.35 + (i % 2) * 0.05;
          wireColors[i * 3 + 2] = 0.25 + (i % 4) * 0.03;
        }
        if (wireColorBuffer) gl.deleteBuffer(wireColorBuffer);
        wireColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, wireColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, wireColors, gl.STATIC_DRAW);
      }

      // ============================================
      // Dots
      // ============================================
      function createDots(radius, count) {
        const positions = [];
        for (let i = 0; i < count; i++) {
          const theta = Math.random() * Math.PI;
          const phi = Math.random() * Math.PI * 2;
          const r = radius * 1.003;
          positions.push(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.cos(theta),
            r * Math.sin(theta) * Math.sin(phi),
          );
        }
        return positions;
      }

      const dotPositions = createDots(RADIUS, 400);
      dotBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(dotPositions),
        gl.STATIC_DRAW,
      );

      const dotColors = new Float32Array(dotPositions.length);
      for (let i = 0; i < dotPositions.length / 3; i++) {
        dotColors[i * 3] = 0.3 + Math.random() * 0.4;
        dotColors[i * 3 + 1] = 0.6 + Math.random() * 0.3;
        dotColors[i * 3 + 2] = 0.4 + Math.random() * 0.4;
      }
      dotColorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, dotColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, dotColors, gl.STATIC_DRAW);


      function closestPointOnTriangle(p, a, b, c) {
        const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
        const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
        const ap = [p[0]-a[0], p[1]-a[1], p[2]-a[2]];

        const d1 = ab[0]*ap[0] + ab[1]*ap[1] + ab[2]*ap[2];
        const d2 = ac[0]*ap[0] + ac[1]*ap[1] + ac[2]*ap[2];
        if (d1 <= 0.0 && d2 <= 0.0) return a;

        const bp = [p[0]-b[0], p[1]-b[1], p[2]-b[2]];
        const d3 = ab[0]*bp[0] + ab[1]*bp[1] + ab[2]*bp[2];
        const d4 = ac[0]*bp[0] + ac[1]*bp[1] + ac[2]*bp[2];
        if (d3 >= 0.0 && d4 <= d3) return b;

        const vc = d1*d4 - d3*d2;
        if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
            const v = d1 / (d1 - d3);
            return [a[0] + v*ab[0], a[1] + v*ab[1], a[2] + v*ab[2]];
        }

        const cp = [p[0]-c[0], p[1]-c[1], p[2]-c[2]];
        const d5 = ab[0]*cp[0] + ab[1]*cp[1] + ab[2]*cp[2];
        const d6 = ac[0]*cp[0] + ac[1]*cp[1] + ac[2]*cp[2];
        if (d6 >= 0.0 && d5 <= d6) return c;

        const vb = d5*d2 - d1*d6;
        if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
            const w = d2 / (d2 - d6);
            return [a[0] + w*ac[0], a[1] + w*ac[1], a[2] + w*ac[2]];
        }

        const va = d3*d6 - d5*d4;
        if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0) {
            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            return [b[0] + w*(c[0]-b[0]), b[1] + w*(c[1]-b[1]), b[2] + w*(c[2]-b[2])];
        }

        const denom = 1.0 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        return [
            a[0] + ab[0]*v + ac[0]*w,
            a[1] + ab[1]*v + ac[1]*w,
            a[2] + ab[2]*v + ac[2]*w
        ];
      }

      const _closestPtOut = [0, 0, 0];
      function closestPointOnTriangleFast(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
        const abX = bx - ax, abY = by - ay, abZ = bz - az;
        const acX = cx - ax, acY = cy - ay, acZ = cz - az;
        const apX = px - ax, apY = py - ay, apZ = pz - az;

        const d1 = abX * apX + abY * apY + abZ * apZ;
        const d2 = acX * apX + acY * apY + acZ * apZ;
        if (d1 <= 0.0 && d2 <= 0.0) {
          _closestPtOut[0] = ax; _closestPtOut[1] = ay; _closestPtOut[2] = az;
          return _closestPtOut;
        }

        const bpX = px - bx, bpY = py - by, bpZ = pz - bz;
        const d3 = abX * bpX + abY * bpY + abZ * bpZ;
        const d4 = acX * bpX + acY * bpY + acZ * bpZ;
        if (d3 >= 0.0 && d4 <= d3) {
          _closestPtOut[0] = bx; _closestPtOut[1] = by; _closestPtOut[2] = bz;
          return _closestPtOut;
        }

        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
          const v = d1 / (d1 - d3);
          _closestPtOut[0] = ax + v * abX; _closestPtOut[1] = ay + v * abY; _closestPtOut[2] = az + v * abZ;
          return _closestPtOut;
        }

        const cpX = px - cx, cpY = py - cy, cpZ = pz - cz;
        const d5 = abX * cpX + abY * cpY + abZ * cpZ;
        const d6 = acX * cpX + acY * cpY + acZ * cpZ;
        if (d6 >= 0.0 && d5 <= d6) {
          _closestPtOut[0] = cx; _closestPtOut[1] = cy; _closestPtOut[2] = cz;
          return _closestPtOut;
        }

        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
          const w = d2 / (d2 - d6);
          _closestPtOut[0] = ax + w * acX; _closestPtOut[1] = ay + w * acY; _closestPtOut[2] = az + w * acZ;
          return _closestPtOut;
        }

        const va = d3 * d6 - d5 * d4;
        if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0) {
          const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
          _closestPtOut[0] = bx + w * (cx - bx); _closestPtOut[1] = by + w * (cy - by); _closestPtOut[2] = bz + w * (cz - bz);
          return _closestPtOut;
        }

        const denom = 1.0 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        _closestPtOut[0] = ax + abX * v + acX * w;
        _closestPtOut[1] = ay + abY * v + acY * w;
        _closestPtOut[2] = az + abZ * v + acZ * w;
        return _closestPtOut;
      }

      function projectWorldToScreen(worldPos, viewMat, projMat, width, height) {
        if (!worldPos || !Array.isArray(worldPos) || worldPos.length < 3 || !viewMat || !projMat) return null;
        const vx =
          worldPos[0] * viewMat[0] +
          worldPos[1] * viewMat[4] +
          worldPos[2] * viewMat[8] +
          viewMat[12];
        const vy =
          worldPos[0] * viewMat[1] +
          worldPos[1] * viewMat[5] +
          worldPos[2] * viewMat[9] +
          viewMat[13];
        const vz =
          worldPos[0] * viewMat[2] +
          worldPos[1] * viewMat[6] +
          worldPos[2] * viewMat[10] +
          viewMat[14];
        const vw =
          worldPos[0] * viewMat[3] +
          worldPos[1] * viewMat[7] +
          worldPos[2] * viewMat[11] +
          viewMat[15];

        const cx =
          vx * projMat[0] +
          vy * projMat[4] +
          vz * projMat[8] +
          vw * projMat[12];
        const cy =
          vx * projMat[1] +
          vy * projMat[5] +
          vz * projMat[9] +
          vw * projMat[13];
        const cz =
          vx * projMat[2] +
          vy * projMat[6] +
          vz * projMat[10] +
          vw * projMat[14];
        const cw =
          vx * projMat[3] +
          vy * projMat[7] +
          vz * projMat[11] +
          vw * projMat[15];

        if (cw <= 0) return null;

        const ndcX = cx / cw;
        const ndcY = cy / cw;
        const ndcZ = cz / cw;

        if (ndcZ < -1.0 || ndcZ > 1.0) return null;

        const screenX = (ndcX * 0.5 + 0.5) * width;
        const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * height;

        return { x: screenX, y: screenY, w: cw };
      }

      function checkPlanetOcclusion(camPos, targetPos, r) {
        if (!camPos || !targetPos) return false;
        const dx = targetPos[0] - camPos[0];
        const dy = targetPos[1] - camPos[1];
        const dz = targetPos[2] - camPos[2];
        const dLenSq = dx*dx + dy*dy + dz*dz;
        if (dLenSq < 1e-6) return false;
        
        // Parameter t of projection of sphere center (origin [0,0,0]) onto the line segment camPos -> targetPos
        const dotCD = camPos[0]*dx + camPos[1]*dy + camPos[2]*dz;
        const t = -dotCD / dLenSq;
        
        if (t > 0.0 && t < 1.0) {
          const closestX = camPos[0] + t * dx;
          const closestY = camPos[1] + t * dy;
          const closestZ = camPos[2] + t * dz;
          const distSq = closestX*closestX + closestY*closestY + closestZ*closestZ;
          
          // Use a threshold safely below the minimum terrain height to account for surface elevations and valleys
          const baseR = r || (typeof RADIUS !== "undefined" ? RADIUS : 8.0);
          const threshold = baseR * 0.88;
          if (distSq < threshold * threshold) {
            return true;
          }
        }
        return false;
      }

      function getNPCTargetPoint(npc) {
        if (!npc) return null;
        const basePos = (npc.ragdollEnabled && npc.ragdollPos) ? npc.ragdollPos : (npc.position || [0, 0, 0]);
        const npcLen = Math.hypot(basePos[0], basePos[1], basePos[2]);
        const n_up = npcLen > 0.1 ? [basePos[0]/npcLen, basePos[1]/npcLen, basePos[2]/npcLen] : [0, 1, 0];
        const N = (npc.N && Array.isArray(npc.N) && npc.N.length >= 3) ? npc.N : n_up;

        let F = npc.F;
        if (!F || !Array.isArray(F) || F.length < 3) {
          const theta = (typeof npc.theta === "number") ? npc.theta : 0;
          const phi = (typeof npc.phi === "number") ? npc.phi : 0;
          const heading = (typeof npc.heading === "number") ? npc.heading : 0;
          const cosTheta = Math.cos(theta), sinTheta = Math.sin(theta);
          const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
          const cosH = Math.cos(heading), sinH = Math.sin(heading);
          const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
          const East = [-sinPhi, 0, cosPhi];
          F = [
            North[0] * cosH + East[0] * sinH,
            North[1] * cosH + East[1] * sinH,
            North[2] * cosH + East[2] * sinH
          ];
        }

        let upH = 0.0;
        let fwdH = 0.0;

        if (npc.ragdollEnabled) {
          upH = (npc.type === "human") ? 0.02 : 0.01;
        } else if (npc.type === "human") {
          // Standing human: center of body (mid-torso/waist, halfway between feet and head)
          upH = -0.045;
        } else if (npc.type === "placoderm") {
          // Placoderm fish: center of body (halfway between snout and tail)
          upH = 0.025;
          fwdH = -0.25;
        } else if (npc.type === "meganeura") {
          // Dragonfly: center of thorax/body
          upH = 0.003;
          fwdH = -0.06;
        } else if (npc.type === "isopod") {
          // Giant isopod: center of carapace shell
          upH = 0.028;
          fwdH = 0.007;
        } else if (npc.type === "georgiacetus") {
          // Prehistoric whale: center of body
          upH = 0.0;
          fwdH = -0.10;
        }

        return [
          basePos[0] + N[0] * upH + F[0] * fwdH,
          basePos[1] + N[1] * upH + F[1] * fwdH,
          basePos[2] + N[2] * upH + F[2] * fwdH
        ];
      }


      // ============================================
      // Frustum Culling Functions (Separated to /public/js/frustumCulling.js)
      // ============================================

      // ============================================
      // Dedicated Active Vehicle Renderer (Boat & 3D UI Synchronization)
      // ============================================
      let activeBoatVBO = null;
      let activeBoatColorBuffer = null;
      let activeBoatNormalBuffer = null;
      let activeBoatIndexBuffer = null;
      let activeBoatIndicesLength = 0;

      function drawDedicatedActiveBoat(gl, posLoc, colorLoc, normalLoc) {
        const boat = (typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof window !== "undefined" && window.activeRidingBoat);
        if (!boat || !boat.position) return;

        if (!activeBoatVBO) {
          activeBoatVBO = gl.createBuffer();
          activeBoatColorBuffer = gl.createBuffer();
          activeBoatNormalBuffer = gl.createBuffer();
          activeBoatIndexBuffer = gl.createBuffer();
        }

        const rawVerts = [];
        const rawColors = [];
        const rawIndices = [];

        if (window.ItemRegistry && window.ItemRegistry["wood_boat"] && window.ItemRegistry["wood_boat"].render) {
          window.ItemRegistry["wood_boat"].render(boat, rawVerts, rawColors, rawIndices, 'dynamic');
        }

        if (rawIndices.length === 0) {
          activeBoatIndicesLength = 0;
          return;
        }

        const makeFlat = (typeof makeFlatShadedGeometry === "function") 
          ? makeFlatShadedGeometry 
          : (typeof window !== "undefined" ? window.makeFlatShadedGeometry : null);
        if (!makeFlat) return;

        const flat = makeFlat(rawVerts, rawColors, rawIndices, true);
        if (!flat || !flat.indices) return;

        activeBoatIndicesLength = flat.indices.length;

        gl.bindBuffer(gl.ARRAY_BUFFER, activeBoatVBO);
        gl.bufferData(gl.ARRAY_BUFFER, flat.vertices, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, activeBoatColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flat.colors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

        if (normalLoc !== -1 && activeBoatNormalBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, activeBoatNormalBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, flat.normals, gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(normalLoc);
          gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, activeBoatIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, flat.indices, gl.DYNAMIC_DRAW);

        const isUint32 = (typeof supportUint32 !== 'undefined' && supportUint32) && activeBoatIndicesLength > 65535;
        gl.drawElements(gl.TRIANGLES, activeBoatIndicesLength, isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
      }
      window.drawDedicatedActiveBoat = drawDedicatedActiveBoat;

      function drawDedicatedActiveBoatShadow(gl, depthPosLoc) {
        if (!activeBoatVBO || !activeBoatIndexBuffer || activeBoatIndicesLength <= 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, activeBoatVBO);
        gl.enableVertexAttribArray(depthPosLoc);
        gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, activeBoatIndexBuffer);
        const isUint32 = (typeof supportUint32 !== 'undefined' && supportUint32) && activeBoatIndicesLength > 65535;
        gl.drawElements(gl.TRIANGLES, activeBoatIndicesLength, isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
      }
      window.drawDedicatedActiveBoatShadow = drawDedicatedActiveBoatShadow;

      // ============================================
      // Render - พร้อม FPS Counter และ Lock
      // ============================================
      let _cachedBowCrosshair = null;
      let _cachedDistanceInfo = null;
      let _cachedInvOverlay = null;
      let _cachedChestOverlay = null;
      let _cachedInteractPrompt = null;
      let _cachedNpcPrompt = null;
      let _cachedTargetCircle = null;

      let _displayInterval = 0;
      let _cadenceAccumulator = 0;
      let _lastRafTimestamp = 0;

      // In Electron desktop app, query primary display hardware refresh rate directly
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getDisplayHz === 'function') {
        window.electronAPI.getDisplayHz().then(hz => {
          if (hz && hz >= 30) {
            _displayInterval = 1000.0 / hz;
          }
        }).catch(() => {});
      }

      function render(timestamp, forceDraw = false) {
        if (lastFrameTime === 0) {
          lastFrameTime = timestamp;
          lastWaterAnimTime = timestamp;
          lastLeafAnimTime = timestamp;
          lastCloudAnimTime = timestamp;
          lastCharAnimTime = timestamp;
          lastFpsUpdate = timestamp;
          _lastRafTimestamp = timestamp;
        }

        const rafDelta = _lastRafTimestamp > 0 ? (timestamp - _lastRafTimestamp) : 16.666;
        _lastRafTimestamp = timestamp;

        // Continuously calibrate actual display VSync interval dynamically (no hardcoded Hz list)
        if (rafDelta > 0.5 && rafDelta < 200) {
          if (_displayInterval === 0) {
            _displayInterval = rafDelta;
          } else {
            // Smooth running average to absorb any micro-jitter from OS compositor
            _displayInterval = _displayInterval * 0.9 + rafDelta * 0.1;
          }
        }

        // Universal cadence-based frame limiter for high-refresh monitors (e.g. 144Hz, 240Hz, 250Hz, 360Hz, 500Hz+)
        if (targetFps > 0 && !forceDraw && _displayInterval > 0) {
          const targetInterval = 1000.0 / targetFps;
          // If display refresh rate is faster than target FPS:
          if (targetInterval > _displayInterval * 1.05) {
            _cadenceAccumulator += rafDelta;
            // Half-VSync window tolerance ensures every frame aligns precisely with display VSync without tearing or dropped frame aliasing
            if (_cadenceAccumulator < targetInterval - (_displayInterval * 0.45)) {
              if (Graphics.mode === 'hybrid' && Graphics.webgpu.currentPassEncoder) {
                Graphics.webgpu.currentPassEncoder.end();
                Graphics.webgpu.device.queue.submit([Graphics.webgpu.currentCommandEncoder.finish()]);
                Graphics.webgpu.currentPassEncoder = null;
                Graphics.webgpu.currentCommandEncoder = null;
              }
              requestAnimationFrame(render);
              return;
            }
            _cadenceAccumulator -= targetInterval;
            if (_cadenceAccumulator > targetInterval) _cadenceAccumulator = 0;
          } else {
            _cadenceAccumulator = 0;
          }
        }

        const delta = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        const frameDelta = (targetFps > 0) ? (1000.0 / targetFps) : delta;
        const dt = Math.max(0.001, Math.min(0.05, frameDelta / 1000.0));
        const timeScale = dt / 0.016666;

        // FPS Counter
        if (!forceDraw) {
          frameCount++;
          if (timestamp - lastFpsUpdate >= 1000) {
            currentFps = frameCount;
            frameCount = 0;
            lastFpsUpdate = timestamp;
            if (fpsDisplay) {
              fpsDisplay.textContent = currentFps;
            }
          }
        }
        // Throttled Auto-Save (Every 20 seconds, if game started)
        if (gameStarted && !forceDraw) {
          if (timestamp - lastAutoSaveTime >= 20000) {
            lastAutoSaveTime = timestamp;
            saveSettingsToLocalStorage();
          }
        }

        // Glow Battery Power & Regeneration System Update
        if (typeof window.BatterySystem !== "undefined" && typeof window.BatterySystem.update === "function") {
          window.BatterySystem.update(dt);
        }

        // Gamepad Controller Polling & Update (Xbox & PlayStation)
        if (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.update === "function") {
          try {
            window.GamepadController.update(dt);
          } catch (gpErr) {
            console.error("GamepadController.update error:", gpErr);
          }
        }

        // --- Throttled Animation Updates ---
        const now = timestamp;

        if (!_cachedBowCrosshair) _cachedBowCrosshair = document.getElementById("bowCrosshair");
        if (_cachedBowCrosshair && _cachedBowCrosshair.style.display !== "none") {
          _cachedBowCrosshair.style.display = "none";
        }

        // Synchronize active action slot with floor placement mode
        const selectedItem = (selectedActionSlotIndex !== -1) ? actionSlotsItems[selectedActionSlotIndex] : null;
        
        let isPlacementItem = selectedItem && (
          (typeof isPlaceableItem === "function" ? isPlaceableItem(selectedItem.name) : (window.isPlaceableItem ? window.isPlaceableItem(selectedItem.name) : false)) ||
          selectedItem.name === "STONE_FLOOR" || selectedItem.name === "WOOD_FLOOR" || selectedItem.name === "THIN_WOOD_FLOOR" || selectedItem.name === "WOOD_ROOF" || selectedItem.name === "WOOD_STAIRS" || selectedItem.name === "FOLDING_LADDER" || selectedItem.name === "CAMPFIRE" || selectedItem.name === "WOOD_BOAT" || selectedItem.name === "WOOD_WHEEL" || selectedItem.name === "ELECTRIC_ENGINE" || selectedItem.name === "BOAT_WING" || selectedItem.name === "WOOD_WALL" || selectedItem.name === "WOOD_WINDOW" || selectedItem.name === "WOOD_DOOR" || selectedItem.name === "WOOD_CHEST" || selectedItem.name.startsWith("ROBOT_")
        );
        
        // บังคับไม่ให้เข้าโหมดวางไอเทม ถ้านั่งอยู่บนเรือหรือหุ่นยนต์ หรือกำลังว่ายน้ำในกรณีบันไดพับ
        if (isPlacementItem && ((typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech) || (selectedItem && selectedItem.name === "FOLDING_LADDER" && typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.05))) {
          isPlacementItem = false;
        }

        if (isPlacementItem) {
          if (!isPlacingFloor || floorPlacementInfo?.index !== selectedActionSlotIndex) {
            isPlacingFloor = true;
            placementRotationAngle = 0.0;
            floorPlacementInfo = { item: selectedItem, index: selectedActionSlotIndex, source: "action" };
            }
          } else {
          if (isPlacingFloor && floorPlacementInfo && floorPlacementInfo.source === "action") {
            cancelFloorPlacement();
          }
        }

        // Cancel BOW / ARM_CANNON if the selected item is NOT a ranged weapon, or if the slot is empty / selection is toggled off
        if (!selectedItem || (selectedItem.name !== "BOW" && selectedItem.name !== "WOODEN_ARM_CANNON" && selectedItem.name !== "ARM_CANNON")) {
          if (activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON")) {
            useAnimTimer = 0;
            isUsingItem = false;
            activeItem = null;
          }
        }
        
        if (useAnimTimer > 0) {
            const isRangedWeapon = activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON");
            if (isRangedWeapon && !arrowShotInCurrentAnim) {
                const isCannon = (activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON");
                let drawPower = 1.0;
                if (!isCannon) {
                    drawPower = Math.min(1.0, Math.max(0.0, (1.4 - useAnimTimer) / 1.1));
                    if (bowComboActive) {
                        drawPower = Math.min(1.0, Math.max(0.0, (1.2 - useAnimTimer) / 0.9));
                    }
                } else {
                    // Arm cannon animation: 1.40s to 2.47s (duration 1.07s)
                    drawPower = Math.min(1.0, Math.max(0.3, (1.07 - useAnimTimer) / 0.45));
                }
                const isClicking = isActionDown && (document.pointerLockElement === canvas || window.simulatedPointerLock);
                const holdThreshold = isCannon ? 0.35 : 0.15;
                if (isClicking || drawPower < holdThreshold) {
                    const minHold = isCannon ? 0.45 : 0.3;
                    useAnimTimer = Math.max(minHold, useAnimTimer - delta / 1000);
                } else {
                    const arrRef = findArrowInInventory();
                    if (arrRef) {
                        const ammoName = arrRef.item ? arrRef.item.name : null;
                        consumeArrow(arrRef);
                        shootArrowProjectile(isCannon ? drawPower * 1.3 : drawPower, ammoName);
                        if (typeof playBowShootSound === "function") {
                            playBowShootSound();
                        }
                    }
                    arrowShotInCurrentAnim = true;
                    lastBowShootTime = Date.now();
                    lastBowDrawPower = drawPower;
                    bowComboActive = false;
                    useAnimTimer = isCannon ? 0.32 : bowHoldArmTimer;
                }
            } else {
                useAnimTimer -= delta / 1000;
            }

            if (useAnimTimer <= 0) {
                useAnimTimer = 0;
                isUsingItem = false;
                activeItem = null;
                
                // If action button is still held down, trigger again (but not for BOW or ARM_CANNON to prevent auto-fire)
                if (isActionDown && (document.pointerLockElement === canvas || window.simulatedPointerLock)) {
                    if (selectedActionSlotIndex !== -1 && actionSlotsItems[selectedActionSlotIndex]) {
                        const slotItem = actionSlotsItems[selectedActionSlotIndex];
                        if (slotItem && slotItem.name !== "BOW" && slotItem.name !== "WOODEN_ARM_CANNON" && slotItem.name !== "ARM_CANNON") {
                            useItem(slotItem, selectedActionSlotIndex, "action");
                        }
                    }
                }
            }
        }

        // Update Distance Display
        if (distanceDisplayEnabled) {
            if (!_cachedDistanceInfo) _cachedDistanceInfo = document.getElementById("distanceInfo");
            const distanceInfo = _cachedDistanceInfo;
            if (distanceInfo && (!window._lastDistUpdate || now - window._lastDistUpdate > 80)) {
                window._lastDistUpdate = now;
                const sinTheta = Math.sin(charTheta);
                const cosTheta = Math.cos(charTheta);
                const sinPhi = Math.sin(charPhi);
                const cosPhi = Math.cos(charPhi);
                const nx = sinTheta * cosPhi;
                const ny = cosTheta;
                const nz = sinTheta * sinPhi;
                const height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                const terrainRadius = RADIUS + height * HEIGHT_SCALE;
                const posX = terrainRadius * nx;
                const posY = terrainRadius * ny;
                const posZ = terrainRadius * nz;

                let minDistanceSq = Infinity;
                for (let i = 0; i < natureObstacles.length; i++) {
                    const obs = natureObstacles[i];
                    if (obs.type === "tree" || obs.type === "rock") {
                        const dx = posX - obs.position[0];
                        const dy = posY - obs.position[1];
                        const dz = posZ - obs.position[2];
                        const distSq = dx * dx + dy * dy + dz * dz;
                        if (distSq < minDistanceSq) minDistanceSq = distSq;
                    }
                }
                const minDistance = minDistanceSq === Infinity ? Infinity : Math.sqrt(minDistanceSq);
                distanceInfo.textContent = `ระยะห่าง: ${minDistance === Infinity ? "ไม่มีใกล้เคียง" : minDistance.toFixed(2)}`;
            }
        }

        // 1. Water Update Check
        const waterInterval = 1000 / waterAnimFps;
        if (now - lastWaterAnimTime >= waterInterval) {
          const elapsed = (now - lastWaterAnimTime) / 1000;
          waterAnimTime += elapsed;
          lastWaterAnimTime = now - ((now - lastWaterAnimTime) % waterInterval);
          if (waterEnabled) {
            updateWaterVertices(waterAnimTime);
          }
        }

        // 2. Leaf Update Check
        const leafInterval = 1000 / leafAnimFps;
        if (now - lastLeafAnimTime >= leafInterval) {
          const elapsed = (now - lastLeafAnimTime) / 1000;
          leafAnimTime += elapsed;
          lastLeafAnimTime = now - ((now - lastLeafAnimTime) % leafInterval);
        }

        // 3. Cloud Update Check
        const cloudInterval = 1000 / cloudAnimFps;
        if (now - lastCloudAnimTime >= cloudInterval) {
          const elapsed = (now - lastCloudAnimTime) / 1000;
          cloudAnimTime += elapsed * cloudsSpeed;
          cloudShapeAnimTime += elapsed * 0.06;

          // Clouds3D animation & orbital rotation update
          const animSpd = typeof window.cloud3DAnimSpeed === "number" ? window.cloud3DAnimSpeed : 0.1;
          const orbSpd = typeof window.cloud3DOrbitSpeed === "number" ? window.cloud3DOrbitSpeed : 0.1;
          if (typeof window.cloud3DAnimTime !== "number") window.cloud3DAnimTime = 0.0;
          if (typeof window.cloud3DOrbitAngle !== "number") window.cloud3DOrbitAngle = 0.0;
          
          window.cloud3DAnimTime += elapsed * animSpd * 1.5;
          window.cloud3DOrbitAngle += elapsed * orbSpd * 0.04; // base ~0.04 rad/s orbital motion

          lastCloudAnimTime = now - ((now - lastCloudAnimTime) % cloudInterval);
        }

        // Door swinging physics simulation (Accelerated with SpatialGrid)
        let doorActiveSwinging = false;
        const pRadius = playerCenterRadius || RADIUS;
        const pX = Math.sin(charTheta) * Math.cos(charPhi) * pRadius;
        const pY = Math.cos(charTheta) * pRadius;
        const pZ = Math.sin(charTheta) * Math.sin(charPhi) * pRadius;

        let doorsToCheck = [];
        if (typeof SpatialGrid !== "undefined") {
          doorsToCheck = SpatialGrid.queryRadius(pX, pY, pZ, 2.5, item => item.type === "wood_door" && !item.isPreview);
          if (!window._activeSwingingDoors) window._activeSwingingDoors = new Set();
          for (const d of window._activeSwingingDoors) {
            if (!doorsToCheck.includes(d)) doorsToCheck.push(d);
          }
        } else {
          doorsToCheck = collectibles;
        }

        const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];

        let activeInteractDoor = null;
        let bestT_door = Infinity;

        for (let other of doorsToCheck) {
          if (other.active && other.type === "wood_door" && !other.isPreview) {
            // Only locked doors have manual interaction prompt
            if (other.isLocked) {
              const reachInfo = isTargetWithinReach(other.position, Math.max(actionReachDistance, 0.25 * (playerScale / 0.1)) + 0.8);
              if (reachInfo.valid && reachInfo.t < bestT_door) {
                bestT_door = reachInfo.t;
                activeInteractDoor = other;
              }
            }
          }
        }

        for (let other of doorsToCheck) {
          if (other.active && other.type === "wood_door" && !other.isPreview) {
            if (other.doorAngle === undefined) other.doorAngle = 0.0;
            if (other.doorTargetAngle === undefined) other.doorTargetAngle = 0.0;
            if (other.doorOpenTimer === undefined) other.doorOpenTimer = 0.0;

            // Distance check to player
            const dx = pX - other.position[0];
            const dy = pY - other.position[1];
            const dz = pZ - other.position[2];
            const distSq = dx*dx + dy*dy + dz*dz;
            const playerIsNear = (distSq <= 0.36); // ~0.6m

            // Auto-open when walking near/through doorway (unlocked doors)
            if (!other.isLocked && playerIsNear) {
              if (other._wallR === undefined) {
                const angle = other.angle || 0.0;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                other._wallR = [
                  other.R[0] * cosA + other.F[0] * sinA,
                  other.R[1] * cosA + other.F[1] * sinA,
                  other.R[2] * cosA + other.F[2] * sinA
                ];
                other._wallF = [
                  other.F[0] * cosA - other.R[0] * sinA,
                  other.F[1] * cosA - other.R[1] * sinA,
                  other.F[2] * cosA - other.R[2] * sinA
                ];
              }
              const local_dx = dx * other._wallR[0] + dy * other._wallR[1] + dz * other._wallR[2];
              const local_dz = dx * other._wallF[0] + dy * other._wallF[1] + dz * other._wallF[2];

              // If player is in front of or inside doorway
              if (Math.abs(local_dx) < 0.09 && Math.abs(local_dz) < 0.22) {
                other.doorOpenTimer = 1.0; // Keep open while player is near doorway
                if (Math.abs(other.doorTargetAngle) < 0.2) {
                  const openDir = (local_dz >= 0) ? -1.57 : 1.57;
                  other.doorTargetAngle = openDir;
                  if (Math.abs(other.doorAngle) < 0.35) {
                    other.doorAngle = openDir * 0.4;
                  }
                  if (typeof playPlaceSound === "function") playPlaceSound(other.position);
                }
              }
            }

            // Auto-close: when door is open, countdown timer and close automatically once player has cleared doorway
            if (Math.abs(other.doorTargetAngle) > 0.1 || Math.abs(other.doorAngle) > 0.1) {
              if (other.doorOpenTimer > 0) {
                other.doorOpenTimer -= dt;
              }

              // Check if player has stepped away from doorway
              const isClearingDoor = (distSq > 0.18);
              if (other.doorOpenTimer <= 0 || (isClearingDoor && other.doorOpenTimer <= 0.6)) {
                other.doorTargetAngle = 0.0;
                other.doorOpenTimer = 0.0;
              }
            }

            // Animate door towards target angle smoothly
            const swingSpeed = 4.5; // rads/sec
            if (Math.abs(other.doorAngle - other.doorTargetAngle) > 0.01) {
              if (other.doorAngle < other.doorTargetAngle) {
                other.doorAngle = Math.min(other.doorTargetAngle, other.doorAngle + swingSpeed * dt);
              } else {
                other.doorAngle = Math.max(other.doorTargetAngle, other.doorAngle - swingSpeed * dt);
              }
              doorActiveSwinging = true;
              if (window._activeSwingingDoors) window._activeSwingingDoors.add(other);
            } else {
              other.doorAngle = other.doorTargetAngle;
              if (other.doorTargetAngle === 0.0 && window._activeSwingingDoors) {
                window._activeSwingingDoors.delete(other);
              }
            }
          }
        }

        // Window swinging physics and "E" holding interaction (Accelerated with SpatialGrid)
        let windowActiveSwinging = false;
        let activeInteractWindow = null;
        let bestT_window = Infinity;

        let windowsToCheck = [];
        if (typeof SpatialGrid !== "undefined") {
          const maxWinReach = Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)) + 1.5;
          windowsToCheck = SpatialGrid.queryRadius(pX, pY, pZ, maxWinReach, item => item.type === "wood_window" && !item.isPreview);
          if (!window._activeSwingingWindows) window._activeSwingingWindows = new Set();
          for (const w of window._activeSwingingWindows) {
            if (!windowsToCheck.includes(w)) windowsToCheck.push(w);
          }
        } else {
          windowsToCheck = collectibles;
        }

        for (let other of windowsToCheck) {
          if (other.active && other.type === "wood_window" && !other.isPreview) {
            const reachInfo = isTargetWithinReach(other.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
            if (reachInfo.valid) {
              if (reachInfo.t < bestT_window) {
                bestT_window = reachInfo.t;
                activeInteractWindow = other;
              }
            }
          }
        }

        for (let other of windowsToCheck) {
          if (other.active && other.type === "wood_window" && !other.isPreview) {
            if (other.windowAngle === undefined) other.windowAngle = 0.0;
            if (other.windowTargetAngle === undefined) other.windowTargetAngle = 0.0;

            if (other === activeInteractWindow && isInteractHeld) {
              if (other.isBeingHeld === undefined || other.isBeingHeld === false) {
                other.isBeingHeld = true;
                other.windowTargetAngle = (other.windowAngle < 0.78) ? 1.57 : 0.0;
              }

              const speed = 2.0; // swing speed in rads/sec
              if (other.windowAngle < other.windowTargetAngle) {
                other.windowAngle = Math.min(other.windowTargetAngle, other.windowAngle + speed * dt);
                windowActiveSwinging = true;
                if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
              } else if (other.windowAngle > other.windowTargetAngle) {
                other.windowAngle = Math.max(other.windowTargetAngle, other.windowAngle - speed * dt);
                windowActiveSwinging = true;
                if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
              } else {
                if (window._activeSwingingWindows) window._activeSwingingWindows.delete(other);
              }
            } else {
              if (other === activeInteractWindow) {
                other.isBeingHeld = false;
              }
              // If still animating to target angle
              if (Math.abs(other.windowAngle - other.windowTargetAngle) > 0.005) {
                const speed = 2.0;
                if (other.windowAngle < other.windowTargetAngle) {
                  other.windowAngle = Math.min(other.windowTargetAngle, other.windowAngle + speed * dt);
                  windowActiveSwinging = true;
                  if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
                } else {
                  other.windowAngle = Math.max(other.windowTargetAngle, other.windowAngle - speed * dt);
                  windowActiveSwinging = true;
                  if (window._activeSwingingWindows) window._activeSwingingWindows.add(other);
                }
              } else {
                if (window._activeSwingingWindows) window._activeSwingingWindows.delete(other);
              }
            }
          }
        }

        let pendingDynamicRefresh = false;
        if (doorActiveSwinging || windowActiveSwinging || (typeof pendingDynamicCollectibleRefresh !== 'undefined' && pendingDynamicCollectibleRefresh)) {
          let shouldRefresh = true;
          const isRenderDistOn = (typeof renderDistEnabled !== "undefined"
            ? renderDistEnabled
            : (typeof window !== "undefined" && typeof window.renderDistEnabled !== "undefined" ? window.renderDistEnabled : true));

          if (isRenderDistOn && !doorActiveSwinging && !windowActiveSwinging && (typeof activeRidingBoat === "undefined" || !activeRidingBoat)) {
            const curObjectDist = typeof objectRenderDistValue !== "undefined"
              ? objectRenderDistValue
              : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
                ? window.objectRenderDistValue
                : 5.0);
            const maxDistSq = (curObjectDist + 1.0) * (curObjectDist + 1.0);
            const pX = Math.sin(charTheta) * Math.cos(charPhi) * (playerCenterRadius || RADIUS);
            const pY = Math.cos(charTheta) * (playerCenterRadius || RADIUS);
            const pZ = Math.sin(charTheta) * Math.sin(charPhi) * (playerCenterRadius || RADIUS);

            let hasNearDynamicItem = false;
            // Always refresh dynamic VBO if any arrow is active or attached to an NPC
            if (typeof collectibles !== "undefined" && collectibles) {
              for (let i = 0; i < collectibles.length; i++) {
                const c = collectibles[i];
                if (c.active && (c.type === "arrow" || c.attachedToNPC)) {
                  hasNearDynamicItem = true;
                  break;
                }
              }
            }
            if (!hasNearDynamicItem) {
              if (typeof SpatialGrid !== "undefined") {
                const nearDyn = SpatialGrid.queryRadius(pX, pY, pZ, curObjectDist + 1.0, c => (c.isDynamic || c.type === "wood_door" || c.type === "wood_window"));
                hasNearDynamicItem = nearDyn.length > 0;
              } else if (typeof collectibles !== "undefined" && collectibles) {
                for (let i = 0; i < collectibles.length; i++) {
                  const c = collectibles[i];
                  if (c.active && (c.isDynamic || c.type === "wood_door" || c.type === "wood_window") && c.position) {
                    const dx = c.position[0] - pX;
                    const dy = c.position[1] - pY;
                    const dz = c.position[2] - pZ;
                    if (dx * dx + dy * dy + dz * dz <= maxDistSq) {
                      hasNearDynamicItem = true;
                      break;
                    }
                  }
                }
              }
            }
            if (!hasNearDynamicItem) {
              shouldRefresh = false;
            }
          }

          if (shouldRefresh) {
            pendingDynamicRefresh = true;
          }
          if (typeof pendingDynamicCollectibleRefresh !== 'undefined') window.pendingDynamicCollectibleRefresh = false;
        }

        if (pendingCollectibleRefresh) {
          pendingCollectibleRefresh = false;
          refreshCollectiblesVBO(); // Rebuild both main and dynamic
          if (typeof SpatialGrid !== "undefined" && typeof collectibles !== "undefined") {
            SpatialGrid.rebuild(collectibles);
          }
        } else if (pendingDynamicRefresh) {
          refreshCollectiblesVBO('dynamic'); // Only rebuild dynamic
        }

        // --- Render Loop ---
        if (typeof World3DUI !== "undefined" && gl) {
            if (!World3DUI.backend) World3DUI.init(gl, 'webgl');
            World3DUI.updateAll();
        }

        if (Graphics.mode === 'hybrid') {
          // Clear WebGL with transparent color so WebGPU is visible
          gl.clearColor(0.0, 0.0, 0.0, 0.0);
        } else {
          if (lastIsCameraUnderwater) {
            gl.clearColor(0.01, 0.08, 0.16, 1.0);
          } else {
            gl.clearColor(0, 0, 0, 1);
          }
        }
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // 1. Get movement inputs first
        let moveForwardInput = 0;
        let moveSidewaysInput = 0;

        if (!_cachedInvOverlay) _cachedInvOverlay = document.getElementById("inventoryOverlay");
        if (!_cachedChestOverlay) _cachedChestOverlay = document.getElementById("chestOverlay");
        const _cachedWarpOverlay = document.getElementById("warpOverlay");
        const isInvOpen = _cachedInvOverlay?.classList.contains("open");
        const isCstOpen = _cachedChestOverlay?.classList.contains("open");
        const isWrpOpen = _cachedWarpOverlay?.classList.contains("open");
        const isFreeCamActive = (cameraMode === "freecam" || (typeof window.cameraMode !== "undefined" && window.cameraMode === "freecam"));
        const isUIOpen = isInvOpen || isCstOpen || isWrpOpen || isFreeCamActive;

        // Keyboard input
        if (!isUIOpen && (keysPressed[currentKeyBindings.forward] || keysPressed["ArrowUp"]))
          moveForwardInput = 1;
        if (
          !isUIOpen && (keysPressed[currentKeyBindings.backward] ||
          keysPressed["ArrowDown"])
        )
          moveForwardInput = -1;
        if (!isUIOpen && (keysPressed[currentKeyBindings.right] || keysPressed["ArrowRight"]))
          moveSidewaysInput = 1;
        if (!isUIOpen && (keysPressed[currentKeyBindings.left] || keysPressed["ArrowLeft"]))
          moveSidewaysInput = -1;

        // Joystick input
        const joyLen = Math.sqrt(joystickX * joystickX + joystickY * joystickY);
        if (!isUIOpen && joyLen > 0.05) {
          moveForwardInput = joystickY;
          moveSidewaysInput = joystickX;

          const speedFactor = Math.min(1.0, joyLen * 1.2);
          moveForwardInput *= speedFactor;
          moveSidewaysInput *= speedFactor;
        }

        // Gamepad Left Stick Movement & Vehicle / Flight Controls
        let gpThrottle = 0;
        let gpFlightPitch = 0;
        const isRidingBoat = !!(typeof activeRidingBoat !== "undefined" && activeRidingBoat);
        const isBoatFlying = !!(isRidingBoat && activeRidingBoat.isFlying);

        if (!isUIOpen && typeof window.GamepadController !== "undefined") {
          if (typeof window.GamepadController.getFlightControls === "function") {
            const flightCtrl = window.GamepadController.getFlightControls();
            gpThrottle = flightCtrl.throttle || 0;
            gpFlightPitch = flightCtrl.pitch || 0;
          }

          if (typeof window.GamepadController.getMovement === "function") {
            const gpMove = window.GamepadController.getMovement();
            if (gpMove.active) {
              if (isBoatFlying) {
                // In flight mode:
                // Left Stick X = Steering (ซ้ายขวาเหมือนเดิมไม่แก้)
                // Left Stick Y is Pitch (ดันขึ้นคือบินขึ้น ดันลงคือบินลง)
                moveSidewaysInput = gpMove.x;
              } else {
                moveForwardInput = gpMove.y;
                moveSidewaysInput = gpMove.x;
              }
            }
          }

          // In vehicle mode OR flight mode: RT acts as vehicle throttle (เดินหน้า / เร่งเครื่อง)
          if (isRidingBoat && gpThrottle > 0.05) {
            moveForwardInput = Math.max(moveForwardInput, gpThrottle);
          }
        }
        window.boatGamepadFlightPitch = gpFlightPitch;

        moveForwardInput = Math.max(-1, Math.min(1, moveForwardInput));
        moveSidewaysInput = Math.max(-1, Math.min(1, moveSidewaysInput));

        // Gamepad Right Stick Camera Look / Rotate
        if (!isUIOpen && typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getLook === "function") {
          const gpLook = window.GamepadController.getLook(dt);
          if (gpLook.active) {
            rotationY -= gpLook.x;
            rotationX += gpLook.y;
            const maxPitch = (typeof cameraMode !== "undefined" && (cameraMode === "sun" || cameraMode === "overview" || cameraMode === "freecam")) ? 1.45 : 1.2;
            const minPitch = -0.55;
            rotationX = Math.max(minPitch, Math.min(maxPitch, rotationX));
            window.rotationY = rotationY;
            window.rotationX = rotationX;
            if (window.cameraMode === "freecam" || (typeof cameraSpringArm !== "undefined" && cameraSpringArm && cameraSpringArm.mode === "freecam")) {
              if (typeof window.freeCamYaw !== "number") window.freeCamYaw = 0.0;
              if (typeof window.freeCamPitch !== "number") window.freeCamPitch = 0.0;
              window.freeCamYaw -= gpLook.x;
              window.freeCamPitch += gpLook.y;
              window.freeCamPitch = Math.max(-1.52, Math.min(1.52, window.freeCamPitch));
            }
          }
        }
        
        // Jump input handling
        const isGpJump = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.isJumpJustPressed === "function" && window.GamepadController.isJumpJustPressed());
        if (!isUIOpen && (keysPressed["Space"] || isGpJump)) {
          if (isPlayerGrounded && !ragdollEnabled && !activeRidingBoat && currentSwimFactor === 0.0) {
            playerVerticalVel = 0.008; // Initial jump velocity
            isPlayerGrounded = false;
            isJumping = true;
          }
        }
        
        lastMoveForwardInput = moveForwardInput;

        if (typeof updateAmphibians === "function") {
          updateAmphibians(dt, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        }
        if (typeof updateFireParticles === "function") {
          updateFireParticles(timestamp / 1000);
        }

        if (ragdollEnabled) {
          if (!ragdollInitialized) {
            const sinTheta_init = Math.sin(charTheta);
            const cosTheta_init = Math.cos(charTheta);
            const sinPhi_init = Math.sin(charPhi);
            const cosPhi_init = Math.cos(charPhi);

            const nx_init = sinTheta_init * cosPhi_init;
            const ny_init = cosTheta_init;
            const nz_init = sinTheta_init * sinPhi_init;

            let groundRadius_init = playerCenterRadius;
            if (groundRadius_init === null) {
              const charHeight_init = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              groundRadius_init = RADIUS + charHeight_init * HEIGHT_SCALE + 0.46 * playerScale;
            }

            const px_init = groundRadius_init * nx_init;
            const py_init = groundRadius_init * ny_init;
            const pz_init = groundRadius_init * nz_init;

            let N_init = [nx_init, ny_init, nz_init];
            const East_init = [-sinPhi_init, 0, cosPhi_init];
            const North_init = [
              -cosTheta_init * cosPhi_init,
              sinTheta_init,
              -cosTheta_init * sinPhi_init,
            ];

            const cosH_init = Math.cos(charHeading);
            const sinH_init = Math.sin(charHeading);

            const R_init = [
              East_init[0] * cosH_init - North_init[0] * sinH_init,
              East_init[1] * cosH_init - North_init[1] * sinH_init,
              East_init[2] * cosH_init - North_init[2] * sinH_init,
            ];
            let F_init = [
              North_init[0] * cosH_init + East_init[0] * sinH_init,
              North_init[1] * cosH_init + East_init[1] * sinH_init,
              North_init[2] * cosH_init + East_init[2] * sinH_init,
            ];

            let swimFactor_init = currentSwimFactor || 0.0;
            if (swimFactor_init > 0.0) {
              const swimPitch =
                Math.PI / 2 - swimMovementFactor * 0.3 - playerDiveDepth * 3.0;
              const cosPitch = Math.cos(swimPitch);
              const sinPitch = Math.sin(swimPitch);

              const tempN = [
                N_init[0] * cosPitch + F_init[0] * sinPitch,
                N_init[1] * cosPitch + F_init[1] * sinPitch,
                N_init[2] * cosPitch + F_init[2] * sinPitch,
              ];

              const tempF = [
                F_init[0] * cosPitch - N_init[0] * sinPitch,
                F_init[1] * cosPitch - N_init[1] * sinPitch,
                F_init[2] * cosPitch - N_init[2] * sinPitch,
              ];

              N_init = tempN;
              F_init = tempF;
            }

            initRagdoll(
              px_init,
              py_init,
              pz_init,
              R_init,
              N_init,
              F_init,
              walkPhase,
            );
          }

          // Update physical simulation
          updateRagdoll(dt);

          const pelvisPos = ragdollPos;
          const dLen = Math.sqrt(
            pelvisPos[0] * pelvisPos[0] +
              pelvisPos[1] * pelvisPos[1] +
              pelvisPos[2] * pelvisPos[2],
          );
          if (dLen > 0.001) {
            const ux = pelvisPos[0] / dLen;
            const uy = pelvisPos[1] / dLen;
            const uz = pelvisPos[2] / dLen;
            charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
            charPhi = Math.atan2(uz, ux);
            if (charPhi < 0) charPhi += Math.PI * 2;

            const charScale_sync = playerScale;
            const terrainRadius_sync = getFloorTopRadiusAt(
              ux, uy, uz,
              RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE
            );
            const waterRadius_sync = RADIUS + waterLevel * 0.15;
            if (waterEnabled && terrainRadius_sync < waterRadius_sync) {
              const targetSwimRadius_sync =
                waterRadius_sync +
                (-0.22 + swimMovementFactor * 0.27) * charScale_sync;
              playerDiveDepth = Math.max(0, targetSwimRadius_sync - dLen);
            }
          }

          moveForwardInput = 0;
          moveSidewaysInput = 0;
          isWalking = false;
        } else {
          ragdollInitialized = false;
        }
        
        updateCollectibles(dt);

        let sinTheta = Math.sin(charTheta);
        let cosTheta = Math.cos(charTheta);
        let sinPhi = Math.sin(charPhi);
        let cosPhi = Math.cos(charPhi);

        let nx = sinTheta * cosPhi;
        let ny = cosTheta;
        let nz = sinTheta * sinPhi;
        let localUp = [nx, ny, nz];

        let charHeight = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
        const charScale = playerScale;

        const mechOffset = typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71;
        let feetRadiusBefore = (playerCenterRadius !== null) ? (playerCenterRadius - (activeRidingMech ? mechOffset : 0.46 * charScale)) : (RADIUS + charHeight * HEIGHT_SCALE);
        const caveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore) : { ground: RADIUS + charHeight * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
        let terrainRadius = caveData.ground;
        const waterRadius = RADIUS + waterLevel * 0.15;
        let wRadiusLocal = getWaterRadiusAt(nx * feetRadiusBefore, ny * feetRadiusBefore, nz * feetRadiusBefore);
        if (caveData.insideTunnel && wRadiusLocal === 0) {
            wRadiusLocal = waterRadius;
        }
        
        // if (caveData.insideTunnel) { wRadiusLocal = 0; } // Disabled: allow water in caves
        
        let currentFeetRadius = (playerCenterRadius !== null) ? (playerCenterRadius - (activeRidingMech ? mechOffset : 0.46 * charScale)) : terrainRadius;

        // เรียกใช้ฟังก์ชันควบคุมการว่ายน้ำและดำน้ำจาก ui.js เพื่อลดความซ้ำซ้อนของโค้ด
        updatePlayerSwimmingAndDiving(
          currentFeetRadius,
          wRadiusLocal,
          waterRadius,
          terrainRadius,
          charScale,
          rotationX,
          moveForwardInput
        );

        // Initialize playerCenterRadius if null
        if (playerCenterRadius === null) {
          playerCenterRadius = terrainRadius + (activeRidingMech ? mechOffset : 0.46 * charScale);
          playerVerticalVel = 0.0;
        }

        let floorTerrainRad = terrainRadius;
        if (typeof getFloorTopRadiusAt === "function") {
          floorTerrainRad = getFloorTopRadiusAt(nx, ny, nz, terrainRadius);
        }
        let standGroundRadius = floorTerrainRad + (activeRidingMech ? mechOffset : 0.46 * charScale);
        if (activeRidingBoat) {
          const tRadius = terrainRadius;
          const baseRadius = (waterEnabled && tRadius < waterRadius) ? waterRadius : tRadius;
          let bR = activeRidingBoat.currentRadius !== undefined ? activeRidingBoat.currentRadius : (baseRadius - 0.04);
          standGroundRadius = bR + 0.46 * charScale;
        } else if (activeRidingMech) {
          standGroundRadius = terrainRadius + mechOffset;
        } else if (currentSwimFactor > 0.0) {
          const targetSwimRadius =
            waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const subSwimRadius = targetSwimRadius - playerDiveDepth;
          standGroundRadius =
            standGroundRadius * (1.0 - currentSwimFactor) +
            subSwimRadius * currentSwimFactor;

          // Enforce floor/ceiling limits on the standGroundRadius
          if (typeof caveData !== 'undefined' && caveData) {
            if (caveData.insideTunnel) {
              const minCenter = caveData.ground + 0.46 * charScale;
              const maxCenter = (caveData.ceiling !== Infinity) ? (caveData.ceiling - 0.46 * charScale) : Infinity;
              if (standGroundRadius < minCenter) {
                standGroundRadius = minCenter;
              }
              if (standGroundRadius > maxCenter) {
                standGroundRadius = maxCenter;
              }
            } else {
              const minCenter = terrainRadius + 0.46 * charScale;
              if (standGroundRadius < minCenter) {
                standGroundRadius = minCenter;
              }
            }
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
          standGroundRadius += bobbing;
        }

        // Simulate vertical physics (gravity/falling)
        if (ragdollEnabled && ragdollInitialized) {
          playerCenterRadius = Math.sqrt(
            ragdollPos[0] * ragdollPos[0] +
            ragdollPos[1] * ragdollPos[1] +
            ragdollPos[2] * ragdollPos[2]
          );
          playerVerticalVel = 0.0;
          isPlayerGrounded = true;
        } else {
          if ((currentSwimFactor > 0.0 && playerVerticalVel <= 0) || activeRidingBoat || activeRidingMech) {
            // Swimming or riding - lock to stand radius
            playerCenterRadius = standGroundRadius;
            playerVerticalVel = 0.0;
            isPlayerGrounded = true;
          } else {
            const minGroundRadius = (typeof caveData !== 'undefined' && caveData && caveData.insideTunnel)
              ? (caveData.ground + 0.46 * charScale)
              : standGroundRadius;

            // Ground snapping: allow smooth steps on slopes/stairs (up to 0.15 * charScale, ~3.3cm)
            const groundSnapThreshold = 0.15 * charScale;
            const diffFromGround = playerCenterRadius - minGroundRadius;
            if (isPlayerGrounded && playerVerticalVel <= 0.0 && diffFromGround >= -0.02 && diffFromGround <= groundSnapThreshold) {
              playerCenterRadius = minGroundRadius;
              playerVerticalVel = 0.0;
              window._playerHighestAirRadius = null;
            } else {
              // Track highest point during airborne phase
              if (window._playerHighestAirRadius === null || typeof window._playerHighestAirRadius === "undefined") {
                window._playerHighestAirRadius = playerCenterRadius;
              } else if (playerCenterRadius > window._playerHighestAirRadius) {
                window._playerHighestAirRadius = playerCenterRadius;
              }

              // Air physics - apply gravity
              playerVerticalVel = Physics.applyVerticalGravity(playerVerticalVel, 1.0, Physics.gravityAccel);
              playerCenterRadius += playerVerticalVel;

              if (playerCenterRadius <= minGroundRadius) {
                const impactVelocity = -playerVerticalVel;
                const fallDistance = (window._playerHighestAirRadius !== null && typeof window._playerHighestAirRadius !== "undefined")
                  ? Math.max(0, window._playerHighestAirRadius - minGroundRadius)
                  : 0;
                window._playerHighestAirRadius = null;

                playerCenterRadius = minGroundRadius;
                playerVerticalVel = 0.0;
                isPlayerGrounded = true;

                // High fall check & Fall Damage:
                // Only trigger Fall Damage and Ragdoll if the character genuinely fell from a significant height:
                // at least 1.8 units (~8-9 times the player's height) AND impactVelocity >= 0.030.
                // Low drops (< 1.8 units, like jumping off a rock or running down a slope) will NEVER trigger Ragdoll or Damage!
                const minFallHeightForRagdoll = 1.8 * (charScale / 0.22);
                if (fallDistance >= minFallHeightForRagdoll && impactVelocity >= 0.030) {
                  const isInWater = (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.3);
                  if (!isInWater) {
                    // Fall Damage scaling based on height fallen:
                    // 1.8 - 3.0 units: 1 DMG (ตกจากที่สูงเล็กน้อย)
                    // 3.0 - 5.0 units: 2 DMG (ตกจากที่สูงปานกลาง)
                    // 5.0 - 7.5 units: 3 DMG (ตกจากหน้าผา/ยอดไม้สูง)
                    // >= 7.5 units: 5 DMG (ตกจากที่สูงมาก/ยานบินบนฟ้าจนหมดสติ)
                    let fallDamage = 1;
                    const scaleRatio = (charScale / 0.22);
                    if (fallDistance >= 7.5 * scaleRatio) {
                      fallDamage = 5;
                    } else if (fallDistance >= 5.0 * scaleRatio) {
                      fallDamage = 3;
                    } else if (fallDistance >= 3.0 * scaleRatio) {
                      fallDamage = 2;
                    }

                    if (typeof applyPlayerFallDamage === "function") {
                      applyPlayerFallDamage(fallDamage, fallDistance);
                    } else if (typeof window.applyPlayerFallDamage === "function") {
                      window.applyPlayerFallDamage(fallDamage, fallDistance);
                    } else if (typeof damagePlayer === "function") {
                      damagePlayer(fallDamage, `⚠️ ตกจากที่สูง! (-${fallDamage} HP)`);
                    } else if (typeof window.damagePlayer === "function") {
                      window.damagePlayer(fallDamage, `⚠️ ตกจากที่สูง! (-${fallDamage} HP)`);
                    }

                    const ragDuration = fallDamage >= 3 ? 2200 : 1500;
                    if (typeof triggerFallRagdoll === "function") {
                      triggerFallRagdoll(ragDuration);
                    } else {
                      setRagdoll(true);
                    }
                  }

                  if (typeof playSplashSound === "function") {
                    playSplashSound(0.5);
                  }
                }
              } else if (typeof caveData !== 'undefined' && caveData && caveData.insideTunnel && caveData.ceiling !== Infinity && playerCenterRadius > (caveData.ceiling - 0.46 * charScale)) {
                playerCenterRadius = caveData.ceiling - 0.46 * charScale;
                playerVerticalVel = Math.min(0.0, -playerVerticalVel * 0.2); // Ceiling bump bounce
              } else {
                isPlayerGrounded = false;
              }
            }
          }
        }



        // Synchronize playerDiveDepth with actual position to prevent sudden snapping/springing
        if (currentSwimFactor >= 0.99 && typeof caveData !== 'undefined' && caveData && playerCenterRadius !== null) {
          const targetSwimRadius = waterRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
          const actualDepth = targetSwimRadius - playerCenterRadius;
          const currentExpectedRadius = targetSwimRadius - playerDiveDepth;
          // Synchronize anytime we are in a cave tunnel, or when physical position differs significantly from expected depth.
          // We use a larger threshold on the surface (0.3) than in caves (0.05) to prevent false-positive dive triggers
          // during swimMovementFactor transitions or water wave bobbing.
          const syncThreshold = (caveData.insideTunnel ? 0.05 : 0.3) * charScale;
          if (caveData.insideTunnel || Math.abs(playerCenterRadius - currentExpectedRadius) > syncThreshold) {
            const bottomRadius = terrainRadius + 0.46 * charScale;
            const maxDiveDepth = Math.max(0, targetSwimRadius - bottomRadius);
            playerDiveDepth = Math.max(0.0, Math.min(maxDiveDepth, actualDepth));
            isDivingMode = playerDiveDepth > 0.015 * charScale;
          }
        }

        let groundRadius = playerCenterRadius;

        let px = groundRadius * nx;
        let py = groundRadius * ny;
        let pz = groundRadius * nz;

        if (ragdollEnabled && ragdollInitialized) {
          const pelvisPos = ragdollPos;
          px = pelvisPos[0];
          py = pelvisPos[1];
          pz = pelvisPos[2];
        }

        let North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
        let East = [-sinPhi, 0, cosPhi];

        if (typeof window !== "undefined") {
          window.isVehicleDriveable = function(vehicle, inWater = false, hasBattery = true) {
            if (!vehicle || !vehicle.active || vehicle.isPreview) return false;
            const hasWheels = !!(vehicle.hasWheel || vehicle.hasWheels || (vehicle.wheelCount && vehicle.wheelCount > 0));
            const hasEngine = !!vehicle.hasEngine;
            if (hasWheels) {
              return hasEngine && hasBattery;
            }
            return !!inWater;
          };
        }

        let boatControlResult = null;
        if (activeRidingBoat) {
          let boatDepth = waterRadius - terrainRadius;
          let isInWater = activeRidingBoat.isInWater !== undefined ? activeRidingBoat.isInWater : (waterEnabled && boatDepth > 0.35 * charScale);
          const isShiftHeld = !!(typeof keysPressed !== "undefined" && (keysPressed["ShiftLeft"] || keysPressed["ShiftRight"] || keysPressed["Shift"])) || !!(typeof window.boatFlyButtonHeld !== "undefined" && window.boatFlyButtonHeld);
          const isHandbrake = !activeRidingBoat.isFlying && (typeof keys !== "undefined" && (keys["Space"] || keys[" "]));
          const pSpeed = typeof playerSpeed !== "undefined" ? playerSpeed : 0.005;

          if (typeof window.updateWheeledBoatControls === "function") {
            boatControlResult = window.updateWheeledBoatControls(activeRidingBoat, {
              moveForwardInput,
              moveSidewaysInput,
              isShiftHeld,
              isHandbrake,
              playerSpeed: pSpeed,
              isInWater,
              waterEnabled,
              charScale,
              charHeading,
              pitchGrade: activeRidingBoat.pitchGrade || 0
            }, timeScale);

            if (boatControlResult) {
              charHeading = boatControlResult.heading;
            }
          }
        }

        const F_3d = [
          North[0] * Math.cos(charHeading) + East[0] * Math.sin(charHeading),
          North[1] * Math.cos(charHeading) + East[1] * Math.sin(charHeading),
          North[2] * Math.cos(charHeading) + East[2] * Math.sin(charHeading),
        ];

        const C_3d = [
          North[0] * Math.cos(rotationY) + East[0] * Math.sin(rotationY),
          North[1] * Math.cos(rotationY) + East[1] * Math.sin(rotationY),
          North[2] * Math.cos(rotationY) + East[2] * Math.sin(rotationY),
        ];

        let moveNorthFactor = 0;
        let moveEastFactor = 0;
        
        if (activeRidingBoat) {
          if (boatControlResult) {
            moveNorthFactor = boatControlResult.moveNorthFactor;
            moveEastFactor = boatControlResult.moveEastFactor;
          } else {
            moveNorthFactor = Math.cos(charHeading) * moveForwardInput;
            moveEastFactor = Math.sin(charHeading) * moveForwardInput;
          }
        } else if (activeRidingMech) {
          if (!window.isMechFullyAssembled(activeRidingMech)) {
            moveNorthFactor = 0;
            moveEastFactor = 0;
            if (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1) {
              const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
              if (typeof showNotice === "function" && (!activeRidingMech._lastAssembledNotice || nowTime - activeRidingMech._lastAssembledNotice > 3000)) {
                activeRidingMech._lastAssembledNotice = nowTime;
                const noticeMsg = (typeof window.t === "function") ? window.t("mech_need_4_parts") : "⚠️ Must assemble all 4 parts (Left Leg, Right Leg, Left Arm, Right Arm) before piloting!";
                showNotice(noticeMsg);
              }
            }
          } else {
            // Mech is fully assembled!
            if (activeRidingMech.dockedStand) {
              // Currently docked on Robot Stand
              const isHoldingForwardOnly = (moveForwardInput > 0.2) && (Math.abs(moveSidewaysInput) < 0.3);
              if (isHoldingForwardOnly) {
                activeRidingMech._undockHoldTimer = (activeRidingMech._undockHoldTimer || 0) + dt;
                if (activeRidingMech._undockHoldTimer >= 0.35) {
                  // Undock / Break away from stand!
                  const prevStand = activeRidingMech.dockedStand;
                  activeRidingMech.dockedStand = null;
                  activeRidingMech._undockedFromStand = prevStand;
                  activeRidingMech._hasLeftStand = false;
                  if (prevStand) {
                    prevStand.isDynamic = false;
                    if (prevStand.vel) prevStand.vel = [0, 0, 0];
                  }
                  if (activeRidingMech.attachedParts) {
                    activeRidingMech.attachedParts = activeRidingMech.attachedParts.filter(entry => entry.item && entry.item.type !== "robot_stand");
                  }
                  activeRidingMech._undockHoldTimer = 0;
                  activeRidingMech._redockCooldown = 3.0; // 3 seconds cooldown before can re-dock
                  if (typeof showNotice === "function") {
                    showNotice("🔓 ปลดล็อคออกจากฐานตั้งแล้ว! / Undocked from Stand!");
                  }
                  moveNorthFactor = Math.cos(rotationY) * moveForwardInput + Math.sin(rotationY) * moveSidewaysInput;
                  moveEastFactor  = Math.sin(rotationY) * moveForwardInput - Math.cos(rotationY) * moveSidewaysInput;
                } else {
                  moveNorthFactor = 0;
                  moveEastFactor = 0;
                }
              } else {
                activeRidingMech._undockHoldTimer = 0;
                moveNorthFactor = 0;
                moveEastFactor = 0;

                // Anchor position & orientation smoothly to stand
                const stand = activeRidingMech.dockedStand;
                if (stand && stand.position) {
                  const sPos = stand.position;
                  const sLen = Math.sqrt(sPos[0]*sPos[0] + sPos[1]*sPos[1] + sPos[2]*sPos[2]) || 1;
                  const snx = sPos[0]/sLen, sny = sPos[1]/sLen, snz = sPos[2]/sLen;
                  charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, sny)));
                  charPhi = Math.atan2(snz, snx);
                  if (charPhi < 0) charPhi += Math.PI * 2;
                  if (stand.F) {
                    const North = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
                    const East = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
                    const fNorth = stand.F[0]*North[0] + stand.F[1]*North[1] + stand.F[2]*North[2];
                    const fEast = stand.F[0]*East[0] + stand.F[1]*East[1] + stand.F[2]*East[2];
                    charHeading = Math.atan2(fEast, fNorth);
                  }
                }
              }
            } else {
              // Undocked, driving freely!
              const hasBattery = typeof window.BatterySystem !== "undefined" && window.BatterySystem.hasActiveBattery();
              
              if (!hasBattery) {
                 moveNorthFactor = 0;
                 moveEastFactor = 0;
                 if (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1) {
                   if (typeof window.BatterySystem !== "undefined") {
                     window.BatterySystem.showEmptyNotice();
                   }
                 }
              } else {
                 moveNorthFactor = Math.cos(rotationY) * moveForwardInput + Math.sin(rotationY) * moveSidewaysInput;
                 moveEastFactor  = Math.sin(rotationY) * moveForwardInput - Math.cos(rotationY) * moveSidewaysInput;
                 if (Math.abs(moveForwardInput) > 0.1 || Math.abs(moveSidewaysInput) > 0.1) {
                   if (typeof window.BatterySystem !== "undefined") {
                     window.BatterySystem.consumePower(dt);
                   }
                 }
              }

              // Check proximity to Robot Stand for manual re-docking via holding [E]
              let closestStand = null;
              let minStandDistSq = 0.81; // within 0.9 meters (close proximity)
              if (typeof SpatialGrid !== "undefined") {
                const nearStands = SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 0.95, item => item.active && !item.isPreview && item.type === "robot_stand");
                for (let item of nearStands) {
                  const dx = item.position[0] - activeRidingMech.position[0];
                  const dy = item.position[1] - activeRidingMech.position[1];
                  const dz = item.position[2] - activeRidingMech.position[2];
                  const distSq = dx*dx + dy*dy + dz*dz;
                  if (distSq < minStandDistSq) {
                    minStandDistSq = distSq;
                    closestStand = item;
                  }
                }
              } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
                for (let item of collectibles) {
                  if (item.active && !item.isPreview && item.type === "robot_stand") {
                    const dx = item.position[0] - activeRidingMech.position[0];
                    const dy = item.position[1] - activeRidingMech.position[1];
                    const dz = item.position[2] - activeRidingMech.position[2];
                    const distSq = dx*dx + dy*dy + dz*dz;
                    if (distSq < minStandDistSq) {
                      minStandDistSq = distSq;
                      closestStand = item;
                    }
                  }
                }
              }
              activeRidingMech._nearbyStand = closestStand;
            }
          }
        } else if (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") {
          moveNorthFactor = Math.cos(rotationY) * moveForwardInput + Math.sin(rotationY) * moveSidewaysInput;
          moveEastFactor  = Math.sin(rotationY) * moveForwardInput - Math.cos(rotationY) * moveSidewaysInput;
        } else {
          moveNorthFactor = moveForwardInput;
          moveEastFactor = -moveSidewaysInput;
        }

        const moveLen = Math.sqrt(
          moveNorthFactor * moveNorthFactor + moveEastFactor * moveEastFactor,
        );
        if (moveLen > 0.001) {
          const moveNorthNorm = moveNorthFactor / moveLen;
          const moveEastNorm = moveEastFactor / moveLen;

          const currentRadius = RADIUS + charHeight * HEIGHT_SCALE;
          let pSpeed = typeof playerSpeed !== "undefined" ? playerSpeed : 0.005;
          let currentSpeedVal = pSpeed * (1.0 - 0.4 * currentSwimFactor);
          if (activeRidingBoat) {
            if (boatControlResult && typeof boatControlResult.currentSpeedVal === "number") {
              currentSpeedVal = boatControlResult.currentSpeedVal;
            } else {
              currentSpeedVal = Math.abs(activeRidingBoat.vehicleSpeed || 0);
            }
          }
          const speed = currentSpeedVal / currentRadius;
          if (activeRidingBoat) {
            let isMotorBoat = activeRidingBoat.hasEngine && !(activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0));
            if (!isMotorBoat) boatRowTimer += speed * 50.0;
          }

          const V_move = [
            North[0] * moveNorthNorm + East[0] * moveEastNorm,
            North[1] * moveNorthNorm + East[1] * moveEastNorm,
            North[2] * moveNorthNorm + East[2] * moveEastNorm,
          ];

          const P_curr = [nx, ny, nz];
          let P_new = [
            P_curr[0] * Math.cos(speed) + V_move[0] * Math.sin(speed),
            P_curr[1] * Math.cos(speed) + V_move[1] * Math.sin(speed),
            P_curr[2] * Math.cos(speed) + V_move[2] * Math.sin(speed),
          ];

          const pLen = Math.sqrt(
            P_new[0] * P_new[0] + P_new[1] * P_new[1] + P_new[2] * P_new[2],
          );
          P_new = [P_new[0] / pLen, P_new[1] / pLen, P_new[2] / pLen];

          const nearbyObstacles = [];
          const playerPos3D = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
          const filterDistSq = (maxColliderDistance + 1.5) * (maxColliderDistance + 1.5);
          const filterObstacles = (list) => {
            if (!list) return;
            for (let i = 0; i < list.length; i++) {
              const obs = list[i];
              if (!obs || !obs.position) continue;
              const dx = playerPos3D[0] - obs.position[0];
              const dy = playerPos3D[1] - obs.position[1];
              const dz = playerPos3D[2] - obs.position[2];
              if (dx*dx + dy*dy + dz*dz < filterDistSq) {
                nearbyObstacles.push(obs);
              }
            }
          };
          filterObstacles(natureObstacles);
          filterObstacles(cubeObstacles);
          filterObstacles(amphibians);

          // --- ระบบป้องกันการเดินชนต้นไม้ หิน และสี่เหลี่ยม (ใช้ Simplified Mesh/Capsule Collider) ---
          const maxDistSq = maxColliderDistance * maxColliderDistance;
          for (let iter = 0; iter < 3; iter++) {
            for (let obs of nearbyObstacles) {
              if (!obs.position) continue;
              
              const C = [P_new[0] * groundRadius, P_new[1] * groundRadius, P_new[2] * groundRadius];
              const dx = C[0] - obs.position[0];
              const dy = C[1] - obs.position[1];
              const dz = C[2] - obs.position[2];
              
              if (dx*dx + dy*dy + dz*dz > maxDistSq) continue;
              
              const charCollisionRadius = playerScale * 0.38;

              if (obs.meshStart !== undefined && obs.meshEnd !== undefined) {
                  if (dx*dx + dy*dy + dz*dz > (obs.radius + charCollisionRadius)*(obs.radius + charCollisionRadius)) {
                      continue;
                  }

                  const collisionEnd = obs.collisionMeshEnd !== undefined ? obs.collisionMeshEnd : obs.meshEnd;
                  const count = collisionEnd - obs.meshStart;

                  for(let j=0; j<count; j+=3) {
                      const vIdx = obs.meshStart + j;
                      const v0 = vIdx * 3;
                      const v1 = (vIdx + 1) * 3;
                      const v2 = (vIdx + 2) * 3;
                      
                      const closest = closestPointOnTriangleFast(
                          C[0], C[1], C[2],
                          natureRawVertices[v0], natureRawVertices[v0+1], natureRawVertices[v0+2],
                          natureRawVertices[v1], natureRawVertices[v1+1], natureRawVertices[v1+2],
                          natureRawVertices[v2], natureRawVertices[v2+1], natureRawVertices[v2+2]
                      );
                      const px = C[0] - closest[0];
                      const py = C[1] - closest[1];
                      const pz = C[2] - closest[2];
                      const pLenSq = px*px + py*py + pz*pz;
                      
                      if (pLenSq < charCollisionRadius * charCollisionRadius && pLenSq > 0.0001) {
                          const pLen = Math.sqrt(pLenSq);
                          const pushDist = charCollisionRadius - pLen;
                          C[0] += (px / pLen) * pushDist;
                          C[1] += (py / pLen) * pushDist;
                          C[2] += (pz / pLen) * pushDist;
                      }
                  }
                  
                  const newLen = Math.sqrt(C[0]*C[0] + C[1]*C[1] + C[2]*C[2]);
                  if (newLen > 0.001) {
                      P_new[0] = C[0] / newLen;
                      P_new[1] = C[1] / newLen;
                      P_new[2] = C[2] / newLen;
                  }
              } else if (obs.colliders && obs.colliders.length > 0) {
                for (let col of obs.colliders) {
                  const cx = obs.position[0] + (col.offset[0] || 0);
                  const cy = obs.position[1] + (col.offset[1] || 0);
                  const cz = obs.position[2] + (col.offset[2] || 0);
                  const clen = Math.sqrt(cx * cx + cy * cy + cz * cz);
                  const obsNormalX = cx / clen;
                  const obsNormalY = cy / clen;
                  const obsNormalZ = cz / clen;

                  const charCollisionRadius = playerScale * 0.38;
                  const minDistance = col.radius + charCollisionRadius;

                  // 3D Distance check using player's 3D groundRadius and joint's 3D height clen
                  const vertical_diff = Math.abs(groundRadius - clen);

                  if (vertical_diff < minDistance) {
                    // Required horizontal distance on the sphere to clear collision in 3D
                    const h_req = Math.sqrt(
                      minDistance * minDistance - vertical_diff * vertical_diff,
                    );

                    const dx = P_new[0] - obsNormalX;
                    const dy = P_new[1] - obsNormalY;
                    const dz = P_new[2] - obsNormalZ;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const h_actual = dist * groundRadius; // current horizontal distance

                    if (h_actual < h_req && dist > 0.001) {
                      let pushX = P_new[0] - obsNormalX;
                      let pushY = P_new[1] - obsNormalY;
                      let pushZ = P_new[2] - obsNormalZ;
                      let pushLen = Math.sqrt(
                        pushX * pushX + pushY * pushY + pushZ * pushZ,
                      );
                      if (pushLen < 1e-6) {
                        pushX = 1;
                        pushY = 0;
                        pushZ = 0;
                        pushLen = 1;
                      }
                      pushX /= pushLen;
                      pushY /= pushLen;
                      pushZ /= pushLen;

                      const targetUnitDist = h_req / groundRadius;
                      P_new[0] = obsNormalX + pushX * targetUnitDist;
                      P_new[1] = obsNormalY + pushY * targetUnitDist;
                      P_new[2] = obsNormalZ + pushZ * targetUnitDist;

                      const pLen2 = Math.sqrt(
                        P_new[0] * P_new[0] +
                          P_new[1] * P_new[1] +
                          P_new[2] * P_new[2],
                      );
                      if (pLen2 > 0.001) {
                        P_new[0] /= pLen2;
                        P_new[1] /= pLen2;
                        P_new[2] /= pLen2;
                      }
                    }
                  }
            }
          } else {
                // คำนวณระยะห่างบนผิวทรงกลม 3D
                // ใช้ position จาก obs ที่เก็บจากโมเดลจริง
                const obsLen = Math.sqrt(
                  obs.position[0] * obs.position[0] +
                    obs.position[1] * obs.position[1] +
                    obs.position[2] * obs.position[2],
                );
                if (obsLen > 0.001) {
                  const obsNormalX = obs.position[0] / obsLen;
                  const obsNormalY = obs.position[1] / obsLen;
                  const obsNormalZ = obs.position[2] / obsLen;

                  const charCollisionRadius = playerScale * 0.38;
                  let minDistance = obs.radius + charCollisionRadius;

                  const vertical_diff = Math.abs(groundRadius - obsLen);
                  if (vertical_diff < minDistance) {
                    const h_req = Math.sqrt(
                      minDistance * minDistance - vertical_diff * vertical_diff,
                    );

                    const dx = P_new[0] - obsNormalX;
                    const dy = P_new[1] - obsNormalY;
                    const dz = P_new[2] - obsNormalZ;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const h_actual = dist * groundRadius;

                    if (h_actual < h_req && dist > 0.001) {
                      let pushX = P_new[0] - obsNormalX;
                      let pushY = P_new[1] - obsNormalY;
                      let pushZ = P_new[2] - obsNormalZ;
                      let pushLen = Math.sqrt(
                        pushX * pushX + pushY * pushY + pushZ * pushZ,
                      );
                      if (pushLen < 1e-6) {
                        pushX = 1;
                        pushY = 0;
                        pushZ = 0;
                        pushLen = 1;
                      }
                      pushX /= pushLen;
                      pushY /= pushLen;
                      pushZ /= pushLen;

                      const targetUnitDist = h_req / groundRadius;
                      P_new[0] = obsNormalX + pushX * targetUnitDist;
                      P_new[1] = obsNormalY + pushY * targetUnitDist;
                      P_new[2] = obsNormalZ + pushZ * targetUnitDist;

                      const pLen2 = Math.sqrt(
                        P_new[0] * P_new[0] +
                          P_new[1] * P_new[1] +
                          P_new[2] * P_new[2],
                      );
                      if (pLen2 > 0.001) {
                        P_new[0] /= pLen2;
                        P_new[1] /= pLen2;
                        P_new[2] /= pLen2;
                      }
                    }
                  }
                }
              }
            }
          }

            // --- COLLISION WITH WOOD FLOORS & STONE FLOORS (horizontal blocking disabled to prevent redundant/overlapping collision) ---
            // Wood floors and stone floors are flat surfaces and should not block the player horizontally.
            // This prevents the player from floating unusually high due to conflicting/overlapping horizontal wall and floor collisions.

            // Structure Collision (wood_wall, wood_roof, wood_window, wood_door)
            // Prevents both on-foot player and wheeled land boat from passing through walls and roofs
            if (typeof resolveStructureCollisions === "function") {
              resolveStructureCollisions({
                P_new,
                P_curr,
                groundRadius,
                playerScale,
                activeRidingBoat,
                collectibles,
                F_3d,
                East,
                North,
                charTheta,
                charPhi,
                charHeading
              });
            }

            // Renormalize P_new after physics
            const pLenTemp = Math.sqrt(P_new[0]*P_new[0] + P_new[1]*P_new[1] + P_new[2]*P_new[2]) || 1;
            P_new[0] /= pLenTemp;
            P_new[1] /= pLenTemp;
            P_new[2] /= pLenTemp;

            // Step-height / Cave-wall and low ceiling blocking check to prevent clipping/teleporting to surface
            let collisionSwimFactor = currentSwimFactor;
            if (activeRidingBoat && (activeRidingBoat.isInWater || (waterEnabled && waterRadius > terrainRadius))) {
              collisionSwimFactor = 1.0;
            }
            const collisionResult = checkCaveAndTerrainCollision(
              P_new,
              P_curr,
              playerCenterRadius,
              charScale,
              collisionSwimFactor,
              waterRadius,
              playerDiveDepth,
              swimMovementFactor,
              charHeight
            );
            
            if (collisionResult.playerCenterRadius > playerCenterRadius + 0.0001 && playerVerticalVel < 0) {
               if (playerCenterRadius <= collisionResult.playerCenterRadius + 0.05) {
                 playerVerticalVel = 0;
                 isPlayerGrounded = true;
               }
            } else if (collisionResult.playerCenterRadius < playerCenterRadius - 0.0001 && playerVerticalVel > 0) {
               playerVerticalVel = 0;
            }

            P_new = collisionResult.P_new;
            playerCenterRadius = collisionResult.playerCenterRadius;
            playerDiveDepth = collisionResult.playerDiveDepth;
            isDivingMode = collisionResult.isDivingMode;

            charTheta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
            charTheta = Math.max(1e-5, Math.min(Math.PI - 1e-5, charTheta));

            charPhi = Math.atan2(P_new[2], P_new[0]);
            if (charPhi < 0) charPhi += Math.PI * 2;

            sinTheta = Math.sin(charTheta);
            cosTheta = Math.cos(charTheta);
            sinPhi = Math.sin(charPhi);
            cosPhi = Math.cos(charPhi);

            nx = sinTheta * cosPhi;
            ny = cosTheta;
            nz = sinTheta * sinPhi;
            localUp = [nx, ny, nz];

            North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
            East = [-sinPhi, 0, cosPhi];

            const C_proj_North =
              C_3d[0] * North[0] + C_3d[1] * North[1] + C_3d[2] * North[2];
            const C_proj_East =
              C_3d[0] * East[0] + C_3d[1] * East[1] + C_3d[2] * East[2];
            rotationY = Math.atan2(C_proj_East, C_proj_North);

            const F_proj_North =
              F_3d[0] * North[0] + F_3d[1] * North[1] + F_3d[2] * North[2];
            const F_proj_East =
              F_3d[0] * East[0] + F_3d[1] * East[1] + F_3d[2] * East[2];
            charHeading = Math.atan2(F_proj_East, F_proj_North);

            const V_proj_North =
              V_move[0] * North[0] + V_move[1] * North[1] + V_move[2] * North[2];
            const V_proj_East =
              V_move[0] * East[0] + V_move[1] * East[1] + V_move[2] * East[2];
            const moveHeading = Math.atan2(V_proj_East, V_proj_North);

            let diffHeading = moveHeading - charHeading;
            while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
            while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
            
            let isAimingBow = (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && isUsingItem && activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON");
            if (typeof window !== "undefined") window.isAimingBow = isAimingBow;
            
            if (!activeRidingBoat && !isAimingBow) {
              charHeading += diffHeading * 0.22 * timeScale;
            }

            isWalking = !activeRidingBoat;
            if (!activeRidingBoat) {
              const walkSpeed = activeRidingMech ? 0.12 : 0.24;
              walkPhase += walkSpeed * timeScale;
            }

            charHeight = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));

            const mechOffsetMoving = typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71;
            let feetRadiusBeforeForSwim = (playerCenterRadius !== null) ? (playerCenterRadius - (activeRidingMech ? mechOffsetMoving : 0.46 * charScale)) : (RADIUS + charHeight * HEIGHT_SCALE);
            const caveDataForSwim = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBeforeForSwim) : { ground: RADIUS + charHeight * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataForSwim.ground;
            let wRadius = getWaterRadiusAt(nx * feetRadiusBeforeForSwim, ny * feetRadiusBeforeForSwim, nz * feetRadiusBeforeForSwim);
            if (caveDataForSwim.insideTunnel && wRadius === 0) {
                wRadius = waterRadius;
            }
            
            updatePlayerSwimmingAndDiving(
              feetRadiusBeforeForSwim,
              wRadius,
              waterRadius,
              tRadius,
              charScale,
              rotationX,
              moveForwardInput
            );

            if (activeRidingBoat) {
              let baseRadius = (waterEnabled && tRadius < wRadius) ? wRadius : tRadius;
              if (waterEnabled && tRadius < wRadius) {
                  const wave = getWaterWave(nx * wRadius, ny * wRadius, nz * wRadius, waterAnimTime, waveStrength);
                  let depth = wRadius - tRadius;
                  let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                  baseRadius += wave * fade;
              }
              let bR = activeRidingBoat.currentRadius !== undefined ? (activeRidingBoat.currentRadius + 0.01) : (baseRadius - 0.03);
              groundRadius = bR + 0.46 * charScale;
            } else if (activeRidingMech) {
              const isMechWalking = typeof isWalking !== "undefined" && isWalking;
              const wPhase = typeof walkPhase !== "undefined" ? walkPhase : 0.0;
              const stepBob = 0.0; // Steady camera when driving mech
              groundRadius = tRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71) + stepBob;
            } else {
              groundRadius = tRadius + 0.46 * charScale;
            }
            
            if (currentSwimFactor > 0.0) {
              const targetSwimRadius =
                wRadius + (-0.22 + swimMovementFactor * 0.27) * charScale;
              const subSwimRadius = targetSwimRadius - playerDiveDepth;
              groundRadius =
                groundRadius * (1.0 - currentSwimFactor) +
                subSwimRadius * currentSwimFactor;

              // Add gentle water bobbing (only if not diving deeply)
              const bobSpeed = isWalking ? 4.0 : 2.0;
              const bobAmp = isWalking ? 0.02 : 0.04;
              const bobFactor = Math.max(
                0,
                1.0 - playerDiveDepth / (0.1 * charScale),
              );
              const bobbing =
                Math.sin(waterAnimTime * bobSpeed) *
                bobAmp *
                charScale *
                bobFactor;
              groundRadius += bobbing;
            }

            const maxStepDown = 0.20 * charScale;
            if (activeRidingBoat || activeRidingMech || currentSwimFactor > 0.0) {
              playerCenterRadius = groundRadius;
              isPlayerGrounded = true;
            } else if (isPlayerGrounded) {
              if (groundRadius < standGroundRadius - maxStepDown) {
                // Stepped off a ledge or cliff! Become airborne and fall.
                isPlayerGrounded = false;
              } else {
                // Stepping on slope/ground/stairs smoothly
                playerCenterRadius = groundRadius;
              }
            }

            const planetCore = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
            px = planetCore[0] + playerCenterRadius * nx;
            py = planetCore[1] + playerCenterRadius * ny;
            pz = planetCore[2] + playerCenterRadius * nz;
          
        } else {
          isWalking = false;
          const phaseWrap = walkPhase % (Math.PI * 2);
          if (phaseWrap !== 0) {
            const targetAngle = Math.round(walkPhase / Math.PI) * Math.PI;
            walkPhase += (targetAngle - walkPhase) * 0.18 * timeScale;
          }

          if (activeRidingBoat || activeRidingMech) {
            const rawH = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            const feetRadiusBefore = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + rawH * HEIGHT_SCALE);
            const caveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetRadiusBefore) : { ground: RADIUS + rawH * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            const tRadius = caveData.ground;
            if (activeRidingMech) {
              playerCenterRadius = tRadius + (typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71);
            } else if (activeRidingBoat) {
              const baseRadius = (waterEnabled && tRadius < waterRadius) ? waterRadius : tRadius;
              let bR = activeRidingBoat.currentRadius !== undefined ? activeRidingBoat.currentRadius : (baseRadius - 0.04);
              playerCenterRadius = bR + 0.46 * charScale;
            }
            isPlayerGrounded = true;
            playerVerticalVel = 0.0;
          } else {
            // Enforce cave & terrain collision checks even when horizontally stationary,
            // so manual diving (Shift / Z) or water bobbing respects cave ceilings/floors and 3D mesh collisions.
            const P_curr = [nx, ny, nz];
            let collisionSwimFactor = currentSwimFactor;
            if (activeRidingBoat && (activeRidingBoat.isInWater || (waterEnabled && waterRadius > (typeof tRadius !== 'undefined' ? tRadius : 0)))) {
              collisionSwimFactor = 1.0;
            }
            const collisionResult = checkCaveAndTerrainCollision(
              P_curr,
              P_curr,
              playerCenterRadius,
              charScale,
              collisionSwimFactor,
              waterRadius,
              playerDiveDepth,
              swimMovementFactor,
              charHeight
            );
            
            playerCenterRadius = collisionResult.playerCenterRadius;
            playerDiveDepth = collisionResult.playerDiveDepth;
            isDivingMode = collisionResult.isDivingMode;

            // Apply horizontal push from 3D mesh cave colliders if applicable
            const P_new = collisionResult.P_new;
            if (Math.abs(P_new[0] - P_curr[0]) > 0.000001 || 
                Math.abs(P_new[1] - P_curr[1]) > 0.000001 || 
                Math.abs(P_new[2] - P_curr[2]) > 0.000001) {
              
              charTheta = Math.acos(Math.max(-1, Math.min(1, P_new[1])));
              charTheta = Math.max(1e-5, Math.min(Math.PI - 1e-5, charTheta));

              charPhi = Math.atan2(P_new[2], P_new[0]);
              if (charPhi < 0) charPhi += Math.PI * 2;

              sinTheta = Math.sin(charTheta);
              cosTheta = Math.cos(charTheta);
              sinPhi = Math.sin(charPhi);
              cosPhi = Math.cos(charPhi);

              nx = sinTheta * cosPhi;
              ny = cosTheta;
              nz = sinTheta * sinPhi;
            }
          }

          localUp = [nx, ny, nz];

          North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
          East = [-sinPhi, 0, cosPhi];

          const planetCoreStationary = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
          px = planetCoreStationary[0] + playerCenterRadius * nx;
          py = planetCoreStationary[1] + playerCenterRadius * ny;
          pz = planetCoreStationary[2] + playerCenterRadius * nz;

          if (activeRidingBoat && typeof boatRowTimer !== "undefined") {
            let target = Math.round(boatRowTimer / Math.PI) * Math.PI;
            boatRowTimer += (target - boatRowTimer) * 0.1;
          }
        }
        
        if ((cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") && isUsingItem && activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON")) {
          let targetHeading = rotationY;
          if (activeTargetNPC) {
              const target_world = window.currentAimTargetPos || getNPCTargetPoint(activeTargetNPC);
              if (target_world) {
                  const dx = target_world[0] - px;
                  const dy = target_world[1] - py;
                  const dz = target_world[2] - pz;
                  
                  // Project relative vector to target onto North/East tangent plane
                  const t_proj_North = dx * North[0] + dy * North[1] + dz * North[2];
                  const t_proj_East = dx * East[0] + dy * East[1] + dz * East[2];
                  targetHeading = Math.atan2(t_proj_East, t_proj_North);

                  // Smoothly auto-rotate camera (both rotationY and rotationX) to track the target NPC!
                  const d_up = dx * nx + dy * ny + dz * nz;
                  const d_dist_planar = Math.sqrt(dx**2 + dy**2 + dz**2 - d_up**2);
                  if (d_dist_planar > 0.05) {
                      const targetCamX = -Math.atan2(d_up, d_dist_planar);
                      let diffCamY = targetHeading - rotationY;
                      while (diffCamY < -Math.PI) diffCamY += Math.PI * 2;
                      while (diffCamY > Math.PI) diffCamY -= Math.PI * 2;
                      
                      // Smoothly guide camera to face the target
                      rotationY += diffCamY * 0.35 * timeScale;
                      rotationX += (targetCamX - rotationX) * 0.35 * timeScale;
                      rotationX = Math.max(-0.55, Math.min(1.2, rotationX));
                  }
              }
          }
          
          let diffHeading = targetHeading - charHeading;
          while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
          while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
          // When aiming, character quickly turns to face target
          charHeading += diffHeading * 0.4 * timeScale;
        } else {
            activeTargetNPC = null;
        }

        if (activeRidingBoat) {
            const wRadius = RADIUS + waterLevel * 0.15;
            let height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            let feetBeforeBoat = activeRidingBoat.currentRadius || (playerCenterRadius ? (playerCenterRadius - 0.46 * charScale) : (RADIUS + height * HEIGHT_SCALE));
            const caveDataBoat = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetBeforeBoat) : { ground: RADIUS + height * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataBoat.ground;
            
            // If water is disabled or terrain is higher than water, float on terrain instead of water
            let isBoatInWater = waterEnabled && (tRadius < wRadius) && ((wRadius - tRadius) > 0.3 * charScale);
            activeRidingBoat.isInWater = isBoatInWater;
            let baseRadius = (waterEnabled && tRadius < wRadius) ? wRadius : tRadius;
            if (waterEnabled && tRadius < wRadius) {
                const wave = getWaterWave(nx * wRadius, ny * wRadius, nz * wRadius, waterAnimTime, waveStrength);
                let depth = wRadius - tRadius;
                let fade = Math.min(1.0, Math.max(0.0, depth / 0.1));
                baseRadius += wave * fade;
            }
            
            let hasWing = !!(activeRidingBoat.hasWing || activeRidingBoat.hasWings);
            let isLandVehicle = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0) || hasWing;
            const isShiftHeld = !!(typeof keysPressed !== "undefined" && (keysPressed["ShiftLeft"] || keysPressed["ShiftRight"] || keysPressed["Shift"])) || (typeof keys !== "undefined" && (keys["ShiftLeft"] || keys["ShiftRight"] || keys["Shift"])) || !!(typeof window.boatFlyButtonHeld !== "undefined" && window.boatFlyButtonHeld);
            const gpPitch = (typeof window.boatGamepadFlightPitch === "number") ? window.boatGamepadFlightPitch : 0;
            const isGamepadClimb = gpPitch > 0.15;
            const isGamepadDive = gpPitch < -0.15;

            if (hasWing && !activeRidingBoat._hasShownFlightNotice) {
                activeRidingBoat._hasShownFlightNotice = true;
                if (typeof showNotice === "function") {
                    if (activeRidingBoat.hasEngine) {
                        const isGp = (typeof isCurrentlyGamepadMode === "function" ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
                        if (isGp) {
                            const rtBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") ? window.GamepadController.getButtonLabel("throttle") : "RT";
                            const stickUp = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") ? window.GamepadController.getButtonLabel("flightClimb") : "LS ⬆️";
                            const stickDown = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") ? window.GamepadController.getButtonLabel("flightDive") : "LS ⬇️";
                            showNotice(`🪽 เรือติดปีก: เร่งเครื่อง [${rtBtn}] ดันอนาล็อกซ้ายขึ้นเพื่อบินขึ้น [${stickUp}] | ดันลงเพื่อบินลง [${stickDown}]`);
                        } else {
                            showNotice("🪽 เรือติดปีก: วิ่งเร่งความเร็ว [W] ~3 วิ หรือลอยตัวในอากาศ แล้วกด [Shift] เพื่อเปิดโหมดบิน | [Z] ดิ่งลง");
                        }
                    } else {
                        showNotice("🪽 เรือติดปีก: ต้องติดตั้งเครื่องยนต์ไฟฟ้าและใส่แบตเตอรี่ก่อนจึงจะบินได้!");
                    }
                }
            }

            // Recalculate F_3d and R for the boat based on the updated charHeading and nx,ny,nz
            let cNorth = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
            let cEast = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
            let bF = [
                cNorth[0] * Math.cos(charHeading) + cEast[0] * Math.sin(charHeading),
                cNorth[1] * Math.cos(charHeading) + cEast[1] * Math.sin(charHeading),
                cNorth[2] * Math.cos(charHeading) + cEast[2] * Math.sin(charHeading)
            ];
            let bR_vec = [
                cEast[0] * Math.cos(charHeading) - cNorth[0] * Math.sin(charHeading),
                cEast[1] * Math.cos(charHeading) - cNorth[1] * Math.sin(charHeading),
                cEast[2] * Math.cos(charHeading) - cNorth[2] * Math.sin(charHeading)
            ];

            let bR;
            if (isLandVehicle) {
                // === GTA PS2 STYLE AMPHIBIOUS WHEELED BOAT PHYSICS ===
                // Calculates wheel contacts with ground terrain
                const vehicleTransform = Physics.calculateLandBoatTransform({
                    position: [tRadius * nx, tRadius * ny, tRadius * nz],
                    nx, ny, nz,
                    F: bF,
                    R: bR_vec,
                    baseRadius: tRadius,
                    waterEnabled,
                    waterLevel,
                    waterAnimTime,
                    waveStrength,
                    hasWheels: true,
                    isInWater: false
                });

                const targetGroundRadius = vehicleTransform.targetGroundRadius;
                
                // Calculate floating water radius
                const waterDepth = (waterEnabled && tRadius < wRadius) ? (wRadius - tRadius) : 0;
                let targetWaterRadius = -Infinity;
                if (waterEnabled && waterDepth > 0) {
                    targetWaterRadius = baseRadius - 0.04;
                }

                // Seamless Amphibious Buoyancy Blend (GTA PS2 feel):
                // On land: wheels support the vehicle at targetGroundRadius.
                // In shallow water: wheels roll on seabed until water lifts the boat.
                // In deep water: water buoyancy lifts the vehicle smoothly at targetWaterRadius.
                // targetSupportRadius smoothly transitions between seabed and water surface without any height jumps!
                const targetSupportRadius = Math.max(targetGroundRadius, targetWaterRadius);
                
                // Continuous buoyancy factor (0.0 = full land wheels, 1.0 = fully floating on water)
                let buoyancyFactor = 0.0;
                if (targetWaterRadius > -Infinity) {
                    const buoyancyRange = 0.20 * charScale;
                    buoyancyFactor = Math.min(1.0, Math.max(0.0, (targetWaterRadius - (targetGroundRadius - buoyancyRange)) / (buoyancyRange + 0.0001)));
                }

                if (activeRidingBoat.currentRadius === undefined) {
                    activeRidingBoat.currentRadius = targetSupportRadius;
                    activeRidingBoat.verticalVel = 0;
                    activeRidingBoat.isAirborne = false;
                    activeRidingBoat.pitchGrade = 0;
                    activeRidingBoat.normal = [nx, ny, nz];
                }

                if (activeRidingBoat.airborneCooldown === undefined) {
                    activeRidingBoat.airborneCooldown = 0;
                }
                if (activeRidingBoat.airborneCooldown > 0) {
                    activeRidingBoat.airborneCooldown -= timeScale;
                }

                // Blend orientation smoothly between terrain slope normal/pitch and level water normal/pitch
                const landPitch = vehicleTransform.pitchGrade || 0;
                const landNormal = vehicleTransform.normal || [nx, ny, nz];
                const groundedTargetPitch = (1.0 - buoyancyFactor) * landPitch;
                const blendedNx = (1.0 - buoyancyFactor) * landNormal[0] + buoyancyFactor * nx;
                const blendedNy = (1.0 - buoyancyFactor) * landNormal[1] + buoyancyFactor * ny;
                const blendedNz = (1.0 - buoyancyFactor) * landNormal[2] + buoyancyFactor * nz;
                const bLen = Math.sqrt(blendedNx*blendedNx + blendedNy*blendedNy + blendedNz*blendedNz) || 1;
                const groundedTargetNormal = [blendedNx / bLen, blendedNy / bLen, blendedNz / bLen];

                // GTA PS2 Suspension Travel & Airborne Check:
                const suspensionTravel = 0.16 * charScale;
                const distAboveSupport = activeRidingBoat.currentRadius - targetSupportRadius;

                if (hasWing) {
                    if (activeRidingBoat.isFlying) {
                        // === IN FLIGHT MODE (โหมดบินเปิดอยู่: บินและร่อนบนฟ้าได้อย่างต่อเนื่องโดยไม่ต้องกด Shift ค้าง) ===
                        activeRidingBoat.isAirborne = true;
                        activeRidingBoat.airborneCooldown = 0;

                        if (activeRidingBoat.takeoffGrace === undefined) {
                            activeRidingBoat.takeoffGrace = 0;
                        }
                        if (activeRidingBoat.takeoffGrace > 0) {
                            activeRidingBoat.takeoffGrace -= timeScale;
                        }

                        // คำนวณเพดานความสูงตามขอบเขตชั้นบรรยากาศของดวงดาว (Atmosphere Radius)
                        const atmScale = typeof atmosphereScale !== "undefined" ? atmosphereScale : 2.5;
                        const atmosphereCeiling = RADIUS + Math.max(RADIUS * (atmScale - 1.0), (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE * 2.0 : 1.2) + 2.0);
                        const maxAltitude = atmosphereCeiling - 0.2;
                        const canClimb = activeRidingBoat.currentRadius < maxAltitude;

                        // Check dive key (Z key: กดปุ่ม Z เพื่อดิ่งลง)
                        const isDiveInput = !!(
                            (typeof keysPressed !== "undefined" && (keysPressed["KeyZ"] || keysPressed["Keyz"] || keysPressed["z"] || keysPressed["Z"])) || 
                            (typeof keys !== "undefined" && (keys["KeyZ"] || keys["Keyz"] || keys["z"] || keys["Z"])) || 
                            (typeof window.boatDiveButtonHeld !== "undefined" && window.boatDiveButtonHeld)
                        );

                        const hasFlightBattery = typeof window.BatterySystem !== "undefined" && window.BatterySystem.hasActiveBattery();

                        const climbMag = isGamepadClimb ? Math.min(1.0, gpPitch) : (isShiftHeld ? 1.0 : 0.0);
                        const diveMag = isGamepadDive ? Math.min(1.0, Math.abs(gpPitch)) : (isDiveInput ? 1.0 : 0.0);

                        if (isDiveInput || isGamepadDive) {
                            // Pitch down & dive down rapidly to land on ground or water (กดปุ่ม Z หรือ ดันอนาล็อกซ้ายลง)
                            const divePower = 0.0035 * timeScale * diveMag;
                            activeRidingBoat.verticalVel = Math.max(-0.030 * diveMag, (activeRidingBoat.verticalVel || 0) - divePower);
                            activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) * 0.92 - (0.16 * diveMag) * Math.min(1.0, 0.14 * timeScale);
                        } else if ((isShiftHeld || isGamepadClimb) && canClimb && hasFlightBattery) {
                            // Hold Shift while flying or push Left Stick UP to climb higher (กด Shift หรือ ดันอนาล็อกซ้ายขึ้น - ต้องมีแบตเตอรี่)
                            const climbPower = 0.0035 * timeScale * climbMag;
                            const maxClimbVel = 0.035 * climbMag;
                            activeRidingBoat.verticalVel = Math.min(maxClimbVel, Math.max(0.015 * climbMag, (activeRidingBoat.verticalVel || 0) + climbPower));
                            activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) * 0.94 + (0.12 * climbMag) * Math.min(1.0, 0.12 * timeScale);
                        } else if (moveForwardInput > 0.1 && hasFlightBattery) {
                            // Pressing forward (W หรือ กดปุ่ม RT เร่งเครื่อง) with active battery: generates engine thrust & aerodynamic lift to maintain cruise altitude
                            activeRidingBoat.verticalVel = (activeRidingBoat.verticalVel || 0) * Math.pow(0.85, timeScale);
                            if (Math.abs(activeRidingBoat.verticalVel) < 0.0003) activeRidingBoat.verticalVel = 0;
                            activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) * Math.pow(0.90, timeScale);
                        } else {
                            // Not pressing forward OR battery empty (ไม่มีแบต/แบตหมด): engine cuts off, vehicle glides & gradually drops down on its own to land
                            const glideSinkRate = -0.010;
                            activeRidingBoat.verticalVel = Math.max(glideSinkRate, (activeRidingBoat.verticalVel || 0) - 0.0008 * timeScale);
                            activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) * 0.95 - 0.04 * Math.min(1.0, 0.06 * timeScale);
                        }

                        activeRidingBoat.currentRadius += activeRidingBoat.verticalVel;
                        if (activeRidingBoat.currentRadius > maxAltitude) {
                            activeRidingBoat.currentRadius = maxAltitude;
                            activeRidingBoat.verticalVel = 0;
                        }

                        // Bank angle into air turns (เอนเอียงทั้งเรือไม่ใช่แค่ปีก)
                        const maxBankAngle = 0.65; // ~37 degrees visible bank
                        const targetBank = moveSidewaysInput * maxBankAngle;
                        activeRidingBoat.bankAngle = (activeRidingBoat.bankAngle || 0) + (targetBank - (activeRidingBoat.bankAngle || 0)) * Math.min(1.0, 0.18 * timeScale);

                        // Aerodynamic attitude stabilization relative to sphere normal
                        let currN = activeRidingBoat.normal || [nx, ny, nz];
                        let airNx = currN[0] + (nx - currN[0]) * Math.min(1.0, 0.06 * timeScale);
                        let airNy = currN[1] + (ny - currN[1]) * Math.min(1.0, 0.06 * timeScale);
                        let airNz = currN[2] + (nz - currN[2]) * Math.min(1.0, 0.06 * timeScale);
                        let airLen = Math.sqrt(airNx*airNx + airNy*airNy + airNz*airNz) || 1;
                        activeRidingBoat.normal = [airNx / airLen, airNy / airLen, airNz / airLen];

                        // Landing check (ถ้าตกลงพื้นและน้ำ ก็คือปิดแค่นั้น: เมื่อสัมผัสพื้นดินหรือน้ำ จะปิดโหมดบินทันที)
                        if (activeRidingBoat.takeoffGrace <= 0 && activeRidingBoat.currentRadius <= targetSupportRadius + 0.015) {
                            activeRidingBoat.currentRadius = targetSupportRadius;
                            activeRidingBoat.verticalVel = 0;
                            activeRidingBoat.isAirborne = false;
                            activeRidingBoat.isFlying = false; // Closed when landing on ground or water!
                            activeRidingBoat.bankAngle = 0;
                            activeRidingBoat.pitchGrade = groundedTargetPitch;
                            activeRidingBoat.airborneCooldown = 15;
                        }
                    } else {
                        // === GROUNDED / FLOATING / NATURAL AIRBORNE (โหมดบินยังไม่เปิด) ===
                        activeRidingBoat.isFlying = false;
                        activeRidingBoat.bankAngle = 0;

                        const hasEngineBoat = !!activeRidingBoat.hasEngine;
                        const hasBatteryBoat = typeof window.BatterySystem !== "undefined" && window.BatterySystem.hasActiveBattery();

                        // สถานะลอยตัวบนพื้นธรรมชาติ (เช่น วิ่งตกขอบเนิน/หน้าผา/คลื่นน้ำ)
                        const isNaturallyAirborne = (distAboveSupport > suspensionTravel && buoyancyFactor < 0.5) || ((activeRidingBoat.verticalVel || 0) > 0.015 && buoyancyFactor < 0.5);

                        // สะสมระยะเวลาวิ่งเดินหน้าเพื่อสร้างความเร็วเทคออฟ (วิ่งเร่งเครื่อง ~3 วินาที ถึงจะบินขึ้นจากพื้นได้)
                        const isRollingForward = (moveForwardInput > 0.1) && hasEngineBoat && hasBatteryBoat;
                        if (isRollingForward) {
                            activeRidingBoat.takeoffRunProgress = (activeRidingBoat.takeoffRunProgress || 0) + (timeScale / 60);
                        } else {
                            activeRidingBoat.takeoffRunProgress = Math.max(0, (activeRidingBoat.takeoffRunProgress || 0) - (timeScale / 30));
                        }

                        const hasTakeoffSpeed = (activeRidingBoat.takeoffRunProgress || 0) >= 2.8; // ~3 seconds of forward roll
                        // สามารถเปิดโหมดบินได้เมื่อ: วิ่งเดินหน้าครบ ~3 วินาที หรือ อยู่ในสถานะลอยตัวในอากาศ
                        const canEngageFlight = (hasTakeoffSpeed || isNaturallyAirborne) && (activeRidingBoat.airborneCooldown || 0) <= 0;

                        const wantsTakeoff = isShiftHeld || isGamepadClimb;
                        if (wantsTakeoff && canEngageFlight) {
                            if (!hasEngineBoat) {
                                const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                                if (typeof showNotice === "function" && (!activeRidingBoat._lastWingNotice || nowTime - activeRidingBoat._lastWingNotice > 2500)) {
                                    activeRidingBoat._lastWingNotice = nowTime;
                                    showNotice("เรือติดปีกต้องติดตั้งเครื่องยนต์ไฟฟ้าก่อนจึงจะบินได้! (Must attach Electric Engine to fly)");
                                }
                            } else if (!hasBatteryBoat) {
                                if (typeof window.BatterySystem !== "undefined") {
                                    window.BatterySystem.showEmptyNotice();
                                }
                            } else {
                                activeRidingBoat.isFlying = true;
                                activeRidingBoat.isAirborne = true;
                                activeRidingBoat.takeoffGrace = 25; // Grace period so it takes off smoothly before landing check
                                activeRidingBoat.verticalVel = Math.max(activeRidingBoat.verticalVel || 0, 0.028);
                                activeRidingBoat.airborneCooldown = 0;
                                activeRidingBoat.takeoffRunProgress = 0;
                            }
                        } else {
                            if (wantsTakeoff && !canEngageFlight && hasEngineBoat && hasBatteryBoat && !isNaturallyAirborne && moveForwardInput <= 0.1) {
                                const nowTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                                if (typeof showNotice === "function" && (!activeRidingBoat._lastTaxiNotice || nowTime - activeRidingBoat._lastTaxiNotice > 3000)) {
                                    activeRidingBoat._lastTaxiNotice = nowTime;
                                    const isGp = (typeof isCurrentlyGamepadMode === "function" ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
                                    if (isGp) {
                                        const rtBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") ? window.GamepadController.getButtonLabel("throttle") : "RT";
                                        const stickUp = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") ? window.GamepadController.getButtonLabel("flightClimb") : "LS ⬆️";
                                        showNotice(`🪽 กดเร่งเครื่อง [${rtBtn}] วิ่งเร่งความเร็ว ~3 วินาที ดันอนาล็อกซ้ายขึ้น [${stickUp}] เพื่อเทคออฟ!`);
                                    } else {
                                        showNotice("🪽 กดเดินหน้า [W] วิ่งเร่งความเร็ว ~3 วินาที เพื่อเทคออฟเปิดโหมดบิน!");
                                    }
                                }
                            }

                            if (isNaturallyAirborne) {
                                // Airborne over a hill/ledge/jump before activating wings
                                activeRidingBoat.isAirborne = true;
                                activeRidingBoat.verticalVel = Physics.applyVerticalGravity(activeRidingBoat.verticalVel || 0, timeScale, Physics.gravityAccel);
                                activeRidingBoat.currentRadius += activeRidingBoat.verticalVel;
                                activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) * Math.pow(0.96, timeScale);

                                let currN = activeRidingBoat.normal || [nx, ny, nz];
                                let airNx = currN[0] + (nx - currN[0]) * Math.min(1.0, 0.05 * timeScale);
                                let airNy = currN[1] + (ny - currN[1]) * Math.min(1.0, 0.05 * timeScale);
                                let airNz = currN[2] + (nz - currN[2]) * Math.min(1.0, 0.05 * timeScale);
                                let airLen = Math.sqrt(airNx*airNx + airNy*airNy + airNz*airNz) || 1;
                                activeRidingBoat.normal = [airNx / airLen, airNy / airLen, airNz / airLen];

                                if (activeRidingBoat.currentRadius <= targetSupportRadius) {
                                    activeRidingBoat.currentRadius = targetSupportRadius;
                                    activeRidingBoat.verticalVel = 0;
                                    activeRidingBoat.isAirborne = false;
                                }
                            } else {
                                // Stay firmly grounded on land or floating on water!
                                activeRidingBoat.isAirborne = false;
                                activeRidingBoat.verticalVel = 0;

                                const suspensionRate = (distAboveSupport < 0) ? 0.38 : 0.25;
                                activeRidingBoat.currentRadius += (targetSupportRadius - activeRidingBoat.currentRadius) * Math.min(1.0, suspensionRate * timeScale);

                                const orientLerp = Math.min(1.0, 0.22 * timeScale);
                                activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) + (groundedTargetPitch - (activeRidingBoat.pitchGrade || 0)) * orientLerp;

                                let currN = activeRidingBoat.normal || [nx, ny, nz];
                                let blendNx = currN[0] + (groundedTargetNormal[0] - currN[0]) * orientLerp;
                                let blendNy = currN[1] + (groundedTargetNormal[1] - currN[1]) * orientLerp;
                                let blendNz = currN[2] + (groundedTargetNormal[2] - currN[2]) * orientLerp;
                                let blendLen = Math.sqrt(blendNx*blendNx + blendNy*blendNy + blendNz*blendNz) || 1;
                                activeRidingBoat.normal = [blendNx / blendLen, blendNy / blendLen, blendNz / blendLen];
                            }
                        }
                    }
                } else if (activeRidingBoat.isAirborne) {
                    // Standard wheeled vehicle airborne (without wings)
                    const isOverLedge = distAboveSupport > suspensionTravel && buoyancyFactor < 0.5;
                    const isLaunchedUp = (activeRidingBoat.verticalVel || 0) > 0.02 && buoyancyFactor < 0.5;

                    activeRidingBoat.verticalVel = Physics.applyVerticalGravity(activeRidingBoat.verticalVel || 0, timeScale, Physics.gravityAccel);
                    activeRidingBoat.currentRadius += activeRidingBoat.verticalVel;
                    activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) * Math.pow(0.96, timeScale);

                    let currN = activeRidingBoat.normal || [nx, ny, nz];
                    let airNx = currN[0] + (nx - currN[0]) * Math.min(1.0, 0.05 * timeScale);
                    let airNy = currN[1] + (ny - currN[1]) * Math.min(1.0, 0.05 * timeScale);
                    let airNz = currN[2] + (nz - currN[2]) * Math.min(1.0, 0.05 * timeScale);
                    let airLen = Math.sqrt(airNx*airNx + airNy*airNy + airNz*airNz) || 1;
                    activeRidingBoat.normal = [airNx / airLen, airNy / airLen, airNz / airLen];

                    if (activeRidingBoat.currentRadius <= targetSupportRadius) {
                        activeRidingBoat.currentRadius = targetSupportRadius;
                        activeRidingBoat.verticalVel = 0;
                        activeRidingBoat.isAirborne = false;
                        activeRidingBoat.airborneCooldown = 8;
                        activeRidingBoat.bankAngle = 0;
                    }
                } else {
                    // Standard wheeled vehicle grounded (without wings)
                    const isOverLedge = distAboveSupport > suspensionTravel && buoyancyFactor < 0.5;
                    const isLaunchedUp = (activeRidingBoat.verticalVel || 0) > 0.02 && buoyancyFactor < 0.5;

                    if ((isOverLedge || isLaunchedUp) && activeRidingBoat.airborneCooldown <= 0) {
                        activeRidingBoat.isAirborne = true;
                        activeRidingBoat.verticalVel = isLaunchedUp ? activeRidingBoat.verticalVel : 0;
                        activeRidingBoat.airborneCooldown = 0;
                    } else {
                        activeRidingBoat.isAirborne = false;
                        activeRidingBoat.verticalVel = 0;

                        const suspensionRate = (distAboveSupport < 0) ? 0.35 : 0.22;
                        activeRidingBoat.currentRadius += (targetSupportRadius - activeRidingBoat.currentRadius) * Math.min(1.0, suspensionRate * timeScale);

                        const orientLerp = Math.min(1.0, 0.22 * timeScale);
                        activeRidingBoat.pitchGrade = (activeRidingBoat.pitchGrade || 0) + (groundedTargetPitch - (activeRidingBoat.pitchGrade || 0)) * orientLerp;

                        let currN = activeRidingBoat.normal || [nx, ny, nz];
                        let blendNx = currN[0] + (groundedTargetNormal[0] - currN[0]) * orientLerp;
                        let blendNy = currN[1] + (groundedTargetNormal[1] - currN[1]) * orientLerp;
                        let blendNz = currN[2] + (groundedTargetNormal[2] - currN[2]) * orientLerp;
                        let blendLen = Math.sqrt(blendNx*blendNx + blendNy*blendNy + blendNz*blendNz) || 1;
                        activeRidingBoat.normal = [blendNx / blendLen, blendNy / blendLen, blendNz / blendLen];
                    }
                }

                // Align boat forward and right axes with the boat normal
                let currNorm = activeRidingBoat.normal || [nx, ny, nz];
                let dotFN = bF[0]*currNorm[0] + bF[1]*currNorm[1] + bF[2]*currNorm[2];
                let alignedF = [bF[0] - currNorm[0]*dotFN, bF[1] - currNorm[1]*dotFN, bF[2] - currNorm[2]*dotFN];
                let aFLen = Math.sqrt(alignedF[0]*alignedF[0] + alignedF[1]*alignedF[1] + alignedF[2]*alignedF[2]) || 1;
                bF = [alignedF[0]/aFLen, alignedF[1]/aFLen, alignedF[2]/aFLen];

                bR_vec = [
                    currNorm[1]*bF[2] - currNorm[2]*bF[1],
                    currNorm[2]*bF[0] - currNorm[0]*bF[2],
                    currNorm[0]*bF[1] - currNorm[1]*bF[0]
                ];

                // Set isInWater state with clean hysteresis (only true when floating on water buoyancy)
                activeRidingBoat.isInWater = (buoyancyFactor > 0.5 && waterDepth > 0.25 * charScale);
                bR = activeRidingBoat.currentRadius;
            } else if (isBoatInWater) {
                // NON-WHEELED BOAT IN WATER: Keep exact original water submersion depth (-0.04)
                bR = baseRadius - 0.04;
                activeRidingBoat.currentRadius = bR;
                activeRidingBoat.verticalVel = 0;
                activeRidingBoat.pitchGrade = 0;
                activeRidingBoat.normal = [nx, ny, nz];
                activeRidingBoat.isAirborne = false;
                activeRidingBoat.isInWater = true;
            } else {
                // NON-WHEELED BOAT ON LAND: sits flush touching the ground / floor
                let landGroundRad = tRadius;
                if (typeof Physics !== "undefined" && typeof Physics.getFloorSurfaceRadiusAt === "function") {
                    landGroundRad = Physics.getFloorSurfaceRadiusAt(nx * tRadius, ny * tRadius, nz * tRadius, tRadius);
                }
                bR = landGroundRad + 0.002;
                activeRidingBoat.currentRadius = bR;
                activeRidingBoat.verticalVel = 0;
                activeRidingBoat.pitchGrade = 0;
                activeRidingBoat.normal = [nx, ny, nz];
                activeRidingBoat.isAirborne = false;
                activeRidingBoat.isInWater = false;
            }

            activeRidingBoat.position = [bR * nx, bR * ny, bR * nz];
            playerCenterRadius = bR + 0.46 * charScale;
            px = playerCenterRadius * nx;
            py = playerCenterRadius * ny;
            pz = playerCenterRadius * nz;

            activeRidingBoat.angle = undefined; // clear fixed placement angle
            activeRidingBoat.F = bF;
            activeRidingBoat.R = bR_vec;
            
            const boatMoved = (
                Math.abs(activeRidingBoat.vehicleSpeed || 0) > 0.0001 ||
                Math.abs(moveForwardInput || 0) > 0.01 ||
                Math.abs(moveSidewaysInput || 0) > 0.01 ||
                (activeRidingBoat._prevPx !== undefined && (
                    Math.abs(activeRidingBoat.position[0] - activeRidingBoat._prevPx) > 1e-5 ||
                    Math.abs(activeRidingBoat.position[1] - activeRidingBoat._prevPy) > 1e-5 ||
                    Math.abs(activeRidingBoat.position[2] - activeRidingBoat._prevPz) > 1e-5
                ))
            );
            activeRidingBoat._prevPx = activeRidingBoat.position[0];
            activeRidingBoat._prevPy = activeRidingBoat.position[1];
            activeRidingBoat._prevPz = activeRidingBoat.position[2];

            if (activeRidingBoat) {
                if (typeof window !== "undefined") window.activeRidingBoat = activeRidingBoat;
            }
        } else if (activeRidingMech) {
            let height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            const mechOffsetRendering = typeof window.mechSeatOffset !== "undefined" ? window.mechSeatOffset : 0.71;
            let feetBeforeMech = (playerCenterRadius !== null) ? (playerCenterRadius - mechOffsetRendering) : (RADIUS + height * HEIGHT_SCALE);
            const caveDataMech = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(nx, ny, nz, feetBeforeMech) : { ground: RADIUS + height * HEIGHT_SCALE, ceiling: Infinity, insideTunnel: false };
            let tRadius = caveDataMech.ground;
            const isMechWalking = typeof isWalking !== "undefined" && isWalking;
            const wPhase = typeof walkPhase !== "undefined" ? walkPhase : 0.0;
            const stepBob = 0.0; // Steady mech height to keep camera smooth
            const hasLegs = activeRidingMech.attachedParts && activeRidingMech.attachedParts.some(entry =>
              entry.item && entry.item.active && entry.item.type && entry.item.type.includes("leg")
            );
            const mechHeight = (activeRidingMech.dockedStand || hasLegs) ? 0.66 : 0.20;
            const mR = tRadius + mechHeight + stepBob;
            activeRidingMech.position = [mR * nx, mR * ny, mR * nz];
            activeRidingMech.normal = [nx, ny, nz];
            activeRidingMech.angle = undefined;

            let cNorth = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
            let cEast = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
            activeRidingMech.F = [
                cNorth[0] * Math.cos(charHeading) + cEast[0] * Math.sin(charHeading),
                cNorth[1] * Math.cos(charHeading) + cEast[1] * Math.sin(charHeading),
                cNorth[2] * Math.cos(charHeading) + cEast[2] * Math.sin(charHeading)
            ];
            activeRidingMech.R = [
                cEast[0] * Math.cos(charHeading) - cNorth[0] * Math.sin(charHeading),
                cEast[1] * Math.cos(charHeading) - cNorth[1] * Math.sin(charHeading),
                cEast[2] * Math.cos(charHeading) - cNorth[2] * Math.sin(charHeading)
            ];

            if (activeRidingMech.attachedParts) {
                // Ensure robot_stand is never in attachedParts
                activeRidingMech.attachedParts = activeRidingMech.attachedParts.filter(entry => entry.item && entry.item.type !== "robot_stand");

                const candidateParts = (typeof SpatialGrid !== "undefined")
                  ? SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 1.75, p => p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech)
                  : (typeof collectibles !== "undefined" && collectibles ? collectibles : []);

                for (let p of candidateParts) {
                    if (p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech) {
                            if (!activeRidingMech.attachedParts.some(entry => entry.item === p)) {
                                const dx = p.position[0] - activeRidingMech.position[0];
                                const dy = p.position[1] - activeRidingMech.position[1];
                                const dz = p.position[2] - activeRidingMech.position[2];
                                if (dx*dx + dy*dy + dz*dz < 3.0) {
                                    p.isDynamic = true;
                                    const cR = activeRidingMech.R || [1,0,0];
                                    const cN = activeRidingMech.normal || activeRidingMech.U || [0,1,0];
                                    const cF = activeRidingMech.F || [0,0,1];

                                    let localR = dx * cR[0] + dy * cR[1] + dz * cR[2];
                                    let localN = dx * cN[0] + dy * cN[1] + dz * cN[2];
                                    let localF = dx * cF[0] + dy * cF[1] + dz * cF[2];

                                    activeRidingMech.attachedParts.push({
                                        item: p,
                                        localR: localR,
                                        localN: localN,
                                        localF: localF
                                    });
                                }
                            }
                        }
                    }

                for (let entry of activeRidingMech.attachedParts) {
                    let p = entry.item;
                    if (!p || !p.active) continue;

                    let pitchAngle = 0.0;
                    let kneeAngle = 0.0;
                    let elbowAngle = 0.20;

                    if (isMechWalking) {
                        if (p.type === "robot_left_leg") {
                            pitchAngle = Math.sin(wPhase) * 0.38;
                            let rawBend = Math.max(0, -Math.sin(wPhase + 0.2));
                            kneeAngle = Math.pow(rawBend, 1.2) * 0.65;
                        } else if (p.type === "robot_right_leg") {
                            pitchAngle = Math.sin(wPhase + Math.PI) * 0.38;
                            let rawBend = Math.max(0, -Math.sin(wPhase + Math.PI + 0.2));
                            kneeAngle = Math.pow(rawBend, 1.2) * 0.65;
                        } else if (p.type === "robot_left_arm") {
                            pitchAngle = Math.sin(wPhase + Math.PI) * 0.42;
                            let swingFwd = Math.sin(wPhase + Math.PI);
                            elbowAngle = 0.20 + Math.max(0, swingFwd) * 0.55;
                        } else if (p.type === "robot_right_arm") {
                            pitchAngle = Math.sin(wPhase) * 0.42;
                            let swingFwd = Math.sin(wPhase);
                            elbowAngle = 0.20 + Math.max(0, swingFwd) * 0.55;
                        }
                    }

                    p.kneeAngle = kneeAngle;
                    p.elbowAngle = elbowAngle;

                    const isLeg = p.type.includes("leg");
                    const isArm = p.type.includes("arm");

                    const csScale = (typeof p.size === "number" ? p.size : 1.0) * 1.5;

                    let curR = entry.localR;
                    let curN = entry.localN;
                    let curF = entry.localF;

                    const cosP = Math.cos(pitchAngle);
                    const sinP = Math.sin(pitchAngle);

                    if (isLeg || isArm) {
                        const jointOffN = isLeg ? 0.85 * csScale : 0.90 * csScale;
                        curN = entry.localN + jointOffN * (1.0 - cosP);
                        curF = entry.localF - jointOffN * sinP;
                    }

                    p.position = [
                        activeRidingMech.position[0] + activeRidingMech.R[0]*curR + activeRidingMech.normal[0]*curN + activeRidingMech.F[0]*curF,
                        activeRidingMech.position[1] + activeRidingMech.R[1]*curR + activeRidingMech.normal[1]*curN + activeRidingMech.F[1]*curF,
                        activeRidingMech.position[2] + activeRidingMech.R[2]*curR + activeRidingMech.normal[2]*curN + activeRidingMech.F[2]*curF
                    ];

                    const mN = activeRidingMech.normal;
                    const mF = activeRidingMech.F;
                    const mR = activeRidingMech.R;

                    p.R = [mR[0], mR[1], mR[2]];
                    p.normal = [
                        mN[0] * cosP + mF[0] * sinP,
                        mN[1] * cosP + mF[1] * sinP,
                        mN[2] * cosP + mF[2] * sinP
                    ];
                    p.F = [
                        -mN[0] * sinP + mF[0] * cosP,
                        -mN[1] * sinP + mF[1] * cosP,
                        -mN[2] * sinP + mF[2] * cosP
                    ];
                }

                let poseChanged = isMechWalking || activeRidingMech._lastWalkPhase !== wPhase;
                if (activeRidingMech._lastWalkState !== isMechWalking) {
                    poseChanged = true;
                    activeRidingMech._lastWalkState = isMechWalking;
                }
                activeRidingMech._lastWalkPhase = isMechWalking ? wPhase : null;

                if (poseChanged || activeRidingMech._forceVBORefresh) {
                    activeRidingMech._forceVBORefresh = false;
                    if (typeof refreshCollectiblesVBO === "function") {
                        refreshCollectiblesVBO('dynamic');
                    }
                }
            }
        }

        // Smoothly update swimMovementFactor based on current state
        if (currentSwimFactor > 0.0) {
          if (isWalking) {
            swimMovementFactor += (1.0 - swimMovementFactor) * 0.08 * timeScale;
          } else {
            swimMovementFactor += (0.0 - swimMovementFactor) * 0.08 * timeScale;
            }
          } else {
          swimMovementFactor += (0.0 - swimMovementFactor) * 0.12 * timeScale;
        }

        // Update swim sound
        if (isSwimAudioInitialized) {
          updateSwimSound(
            currentSwimFactor,
            swimMovementFactor,
            walkPhase,
            lastIsCameraUnderwater,
          );
        }

        // Update wheeled boat rolling sound (only on land, not on water)
        if (typeof updateWheeledBoatSound === "function") {
          let isBoatOnWater = activeRidingBoat ? (activeRidingBoat.isInWater !== undefined ? activeRidingBoat.isInWater : (waterEnabled && (waterRadius - terrainRadius) > 0.35 * charScale)) : false;
          updateWheeledBoatSound(activeRidingBoat, timeScale, isBoatOnWater);
        }

        // Update mech walking sound
        if (typeof updateMechWalkSound === "function") {
          updateMechWalkSound((typeof activeRidingMech !== "undefined" ? activeRidingMech : null), timeScale);
        }

        // Update footstep / splash sound
        if (isWalking) {
          if (currentSwimFactor === 0.0) {
            if (walkPhase - lastFootstepPhase >= Math.PI / 2) {
              playFootstepSound(1.0, true);
              lastFootstepPhase = walkPhase;
            }
          } else {
            // Swimming or wading
            // For swimming, the arms move at phase * 1.5
            const swimPhase = walkPhase * 1.5;
            const lastSwimPhase = lastFootstepPhase * 1.5;
            if (swimPhase - lastSwimPhase >= Math.PI) {
              if (!lastIsCameraUnderwater) {
                playSplashSound(0.5 + currentSwimFactor * 0.5, true);
              } else {
                playUnderwaterSwimSound(0.5 + currentSwimFactor * 0.5, true);
              }
              lastFootstepPhase = walkPhase;
            }
            }
          } else {
          lastFootstepPhase = walkPhase;
        }

        const charInterval = 1000 / charAnimFps;
        const needsEveryFrame = ragdollEnabled;
        
        if (!isPlayerGrounded && !ragdollEnabled && !activeRidingBoat && !activeRidingMech && currentSwimFactor === 0.0) {
            jumpBlend = Math.min(1.0, jumpBlend + 10.0 * dt);
        } else {
            jumpBlend = Math.max(0.0, jumpBlend - 15.0 * dt);
        }
        
        if (needsEveryFrame || timestamp - lastCharAnimTime >= charInterval) {
          updateCharacterMesh(walkPhase);
          if (typeof window.playerClonesState !== "undefined" && window.playerClonesState && window.playerClonesState.length > 0) {
              const clonePhase = window.performance.now() * 0.005;
              let anyCloneSwim = 0.0;
              let anyCloneSwimMove = 0.0;
              for (let ci = 0; ci < window.playerClonesState.length; ci++) {
                const cs = window.playerClonesState[ci];
                if (cs && (cs.currentSwimFactor || 0) > anyCloneSwim) {
                  anyCloneSwim = cs.currentSwimFactor || 0.0;
                  anyCloneSwimMove = cs.swimMovementFactor || 0.0;
                }
              }
              updateCharacterMesh(clonePhase, true, 1.0, anyCloneSwim, anyCloneSwimMove);
          }
          if (!needsEveryFrame) {
            lastCharAnimTime =
              timestamp - ((timestamp - lastCharAnimTime) % charInterval);
          }
        }

        // Update independent player clones wandering AI and face signs
        if (typeof window.updatePlayerClones === "function") {
          window.updatePlayerClones(dt);
        }

        let eyePos;
        let viewMatrix;

        // Vehicle camera auto-restoration safety check:
        const isRidingBoatNow = !!activeRidingBoat;
        if (!isRidingBoatNow && window._wasRidingBoat) {
          if (typeof window.exitBoatCamera === "function") {
            window.exitBoatCamera();
          }
        }
        window._wasRidingBoat = isRidingBoatNow;

        const isRidingMechNow = !!activeRidingMech;
        if (!isRidingMechNow && window._wasRidingMech) {
          if (typeof window.exitMechCamera === "function") {
            window.exitMechCamera();
          }
        }
        window._wasRidingMech = isRidingMechNow;

        if (typeof window.cameraMode === "string" && window.cameraMode !== cameraMode) {
          cameraMode = window.cameraMode;
        }

        if (cameraMode !== "tps" && cameraMode !== "thirdperson" && cameraMode !== "fps" && cameraMode !== "freecam" && cameraMode !== "planet" && cameraMode !== "sun" && cameraMode !== "satellite" && cameraMode !== "overview" && cameraMode !== "solarsystem" && cameraMode !== "spacesmap_overview" && !(cameraMode && (cameraMode.startsWith("extra_planet_") || cameraMode.startsWith("planet_")))) {
          cameraMode = "thirdperson";
        }

        if (cameraSpringArm) {
          const currentNorth = [
            -cosTheta * cosPhi,
            sinTheta,
            -cosTheta * sinPhi,
          ];
          const currentEast = [-sinPhi, 0, cosPhi];

          cameraSpringArm.setMode(cameraMode);
          cameraSpringArm.update(
            dt,
            [px, py, pz],
            localUp,
            currentNorth,
            currentEast,
            rotationX,
            rotationY,
            zoom,
            charScale,
            waterRadius,
            cameraCollisionEnabled
          );
          eyePos = cameraSpringArm.eyePos;
          viewMatrix = cameraSpringArm.viewMatrix;
        } else {
          eyePos = [px, py, pz];
          const planetCoreFallback = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
          viewMatrix = createLookAt(eyePos, planetCoreFallback, [0, 1, 0]);
        }

        window.eyePos = eyePos;
        window.viewMatrix = viewMatrix;
        window.player3DPos = [px, py, pz];
        window.rotationY = rotationY;

        const activePlanetCore = (typeof window.getPlanetCorePosition === "function") ? window.getPlanetCorePosition() : (window.PLANET_CORE_POS || [0, 0, 0]);
        const relCamX = eyePos[0] - activePlanetCore[0];
        const relCamY = eyePos[1] - activePlanetCore[1];
        const relCamZ = eyePos[2] - activePlanetCore[2];
        const camDist = Math.sqrt(relCamX * relCamX + relCamY * relCamY + relCamZ * relCamZ);
        let isCameraUnderwater = camDist < waterRadius;
        lastIsCameraUnderwater = isCameraUnderwater;

        // คำนวณทิศทางแสงตรงตามพิกัดดวงอาทิตย์ 3D ในระบบสุริยะจริง (SpacesMap 3D Satellite Sun Position)
        let actualSunPos = [-800.0, 0.0, 0.0];
        if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
          const cel = window.SpacesMap.getCelestialTransform("sun");
          if (cel && cel.pos) actualSunPos = cel.pos;
        } else if (typeof window.getSunWorldPosition === "function") {
          actualSunPos = window.getSunWorldPosition();
        }

        const sunLen = Math.sqrt(
          actualSunPos[0] * actualSunPos[0] +
            actualSunPos[1] * actualSunPos[1] +
            actualSunPos[2] * actualSunPos[2],
        ) || 1.0;

        const finalLightDir = [
          actualSunPos[0] / sunLen,
          actualSunPos[1] / sunLen,
          actualSunPos[2] / sunLen,
        ];
        window.finalLightDir = finalLightDir;
        window.sunDistance = sunLen;
        window.sunPosition = [
          actualSunPos[0],
          actualSunPos[1],
          actualSunPos[2],
        ];

        // อัปเดตตำแหน่งและรูปทรงเงามืดตามวงโคจรของแสงดวงอาทิตย์ (ใช้ระบบเงาคำนวณสดบน GPU ไม่ต้องรันฝั่ง CPU แล้ว)

        const aspect = canvas.width / canvas.height;
        const modelMatrix = createIdentity();
        const modelViewMatrix = multiplyMatrices(viewMatrix, modelMatrix);
        const isFreeCam = cameraMode === "freecam";
        const dynamicNear = isFreeCam ? 0.08 : (window.cameraNearPlane || 0.05);
        const dynamicFar = isFreeCam ? 50000.0 : Math.max(2500, (typeof RADIUS !== "undefined" ? RADIUS : 8.0) * 30.0);
        const projMatrix = createPerspective(Math.PI / 4, aspect, dynamicNear, dynamicFar);

        // TAAU (Temporal Anti-Aliasing Upsampling) sub-pixel temporal jittering
        // Only apply sub-pixel jitter when a temporal history accumulation pass is actively resolving frames,
        // otherwise raw jitter causes continuous 60fps screen vibration/shaking.
        if (typeof taauEnabled !== "undefined" && taauEnabled && typeof window.taauHistoryResolveReady !== "undefined" && window.taauHistoryResolveReady) {
          if (typeof window.taauJitterFrame === "undefined") window.taauJitterFrame = 0;
          window.taauJitterFrame = (window.taauJitterFrame + 1) % 8;
          const halton2 = [0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0];
          const halton3 = [0.333, 0.666, 0.111, 0.444, 0.777, 0.222, 0.555, 0.0];
          const jx = ((halton2[window.taauJitterFrame] - 0.5) / Math.max(1, canvas.width)) * 2.0;
          const jy = ((halton3[window.taauJitterFrame] - 0.5) / Math.max(1, canvas.height)) * 2.0;
          projMatrix[8] += jx;
          projMatrix[9] += jy;
        }

        // Extract frustum planes for Frustum Culling
        frustumPlanes = null;
        if (typeof FrustumCullingSystem !== "undefined" && FrustumCullingSystem.updateFrustumPlanesFromPV) {
          frustumPlanes = FrustumCullingSystem.updateFrustumPlanesFromPV(projMatrix, viewMatrix, frustumCullingEnabled);
        } else if (typeof FrustumCullingSystem !== "undefined" && FrustumCullingSystem.updateFrustumPlanes) {
          const vp = typeof FrustumCullingSystem.multiplyMat4 === "function" ? FrustumCullingSystem.multiplyMat4(projMatrix, viewMatrix) : multiplyMatrices(projMatrix, viewMatrix);
          frustumPlanes = FrustumCullingSystem.updateFrustumPlanes(vp, frustumCullingEnabled);
        } else if (frustumCullingEnabled && typeof getFrustumPlanes === "function") {
          const vp = multiplyMatrices(projMatrix, viewMatrix);
          frustumPlanes = getFrustumPlanes(vp);
        }
        
        // Render WebGPU Migrated Parts
        // Old WebGPU hook removed

        // Check interaction distance for UI prompt
        if (!_cachedInteractPrompt) _cachedInteractPrompt = document.getElementById("interactPrompt");
        const prompt = _cachedInteractPrompt;
        if (prompt) {
          const px = charTheta;
          const py = charPhi;
          const r_terrain = RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          const r = typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null ? playerCenterRadius - 0.46 * playerScale : r_terrain;
          const pVec = [
            r * Math.sin(px) * Math.cos(py),
            r * Math.cos(px),
            r * Math.sin(px) * Math.sin(py),
          ];
          if (isDemolishModeEnabled) {
            const demolishableTypes = [
              "wood_floor", "thin_wood_floor", "stone_floor", "wood_stairs", "folding_ladder",
              "campfire", "wood_boat", "wood_wheel", "electric_engine", "boat_wing",
              "wood_wall", "wood_window", "wood_door", "wood_roof", "wood_chest",
              "meganeura_item", "isopod_item", "obsidian_pad_warp_item", "obsidian_compass_pad_item",
              "robot_stand", "robot_cockpit",
              "robot_left_arm", "robot_right_arm", "robot_left_leg", "robot_right_leg"
            ];
            const maxDemolishReach = 0.50 * (playerScale / 0.1);
            const camLookDir = [-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]];
            const halfW = window.innerWidth / 2;
            const halfH = window.innerHeight / 2;
            const maxScreenRadius = 55; // Precise 3D crosshair radius in pixels

            const candidates = (typeof SpatialGrid !== "undefined")
              ? SpatialGrid.queryRadius(pVec[0], pVec[1], pVec[2], maxDemolishReach + 1.0, item => item.active && !item.isPreview && item.position && demolishableTypes.includes(item.type))
              : collectibles;

            let closestDemolishItem = null;
            let bestEffectiveDepth = Infinity;
            let bestItemCenter = null;
            let currentBestDist = Infinity;

            for (let item of candidates) {
              if (!item.active || item.isPreview || !item.position) continue;
              if (item.type === "planet_core") continue;
              if (!demolishableTypes.includes(item.type)) continue;

              const n = (item.normal && item.normal.length === 3) ? item.normal : [0, 1, 0];
              let itemCenter = item.position;
              if (item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door") {
                // Elevate visual center to middle of the wall so eye-level crosshair hits it directly
                itemCenter = [
                  item.position[0] + n[0] * 0.12,
                  item.position[1] + n[1] * 0.12,
                  item.position[2] + n[2] * 0.12
                ];
              } else if (item.type === "wood_roof") {
                itemCenter = [
                  item.position[0] + n[0] * 0.10,
                  item.position[1] + n[1] * 0.10,
                  item.position[2] + n[2] * 0.10
                ];
              } else if (item.type === "wood_stairs") {
                itemCenter = [
                  item.position[0] + n[0] * 0.12,
                  item.position[1] + n[1] * 0.12,
                  item.position[2] + n[2] * 0.12
                ];
              } else if (item.type === "folding_ladder") {
                itemCenter = [
                  item.position[0] + n[0] * 0.17,
                  item.position[1] + n[1] * 0.17,
                  item.position[2] + n[2] * 0.17
                ];
              } else if (item.type === "wood_chest") {
                // Elevate visual center to center of chest mass
                itemCenter = [
                  item.position[0] + n[0] * 0.055,
                  item.position[1] + n[1] * 0.055,
                  item.position[2] + n[2] * 0.055
                ];
              } else if (item.type === "campfire") {
                itemCenter = [
                  item.position[0] + n[0] * 0.06,
                  item.position[1] + n[1] * 0.06,
                  item.position[2] + n[2] * 0.06
                ];
              } else if (item.type === "wood_boat" || item.type.includes("boat")) {
                itemCenter = [
                  item.position[0] + n[0] * 0.20,
                  item.position[1] + n[1] * 0.20,
                  item.position[2] + n[2] * 0.20
                ];
              } else if (item.type === "wood_wheel" || item.type === "electric_engine" || item.type === "boat_wing") {
                itemCenter = [
                  item.position[0] + n[0] * 0.10,
                  item.position[1] + n[1] * 0.10,
                  item.position[2] + n[2] * 0.10
                ];
              } else if (item.type.startsWith("robot_")) {
                itemCenter = [
                  item.position[0] + n[0] * 0.15,
                  item.position[1] + n[1] * 0.15,
                  item.position[2] + n[2] * 0.15
                ];
              } else if (item.type.includes("floor") || item.type === "obsidian_pad_warp_item" || item.type === "obsidian_compass_pad_item") {
                itemCenter = [
                  item.position[0] + n[0] * 0.02,
                  item.position[1] + n[1] * 0.02,
                  item.position[2] + n[2] * 0.02
                ];
              }

              let meshRadius = 0.20;
              if (item.type === "wood_boat" || item.type.includes("boat")) {
                meshRadius = 0.85;
              } else if (item.type.includes("wall") || item.type.includes("window") || item.type.includes("door")) {
                meshRadius = 0.26;
              } else if (item.type.includes("floor") || item.type === "obsidian_pad_warp_item" || item.type === "obsidian_compass_pad_item" || item.type.includes("roof") || item.type.includes("stairs") || item.type.includes("ladder")) {
                meshRadius = 0.26;
              } else if (item.type === "wood_chest") {
                meshRadius = 0.18;
              } else if (item.type.startsWith("robot_")) {
                meshRadius = 0.25;
              }

              const dx = itemCenter[0] - pVec[0];
              const dy = itemCenter[1] - pVec[1];
              const dz = itemCenter[2] - pVec[2];
              const distToPlayer = Math.hypot(dx, dy, dz);
              const itemReach = (item.type === "wood_boat" || item.type.includes("boat")) ? (maxDemolishReach + 0.65) : maxDemolishReach;
              const effectiveDistToPlayer = Math.max(0, distToPlayer - Math.min(0.18, meshRadius * 0.6));
              if (effectiveDistToPlayer > itemReach) continue;

              // Forward orientation check: item must NOT be behind the player's view
              const fwdDot = dx * camLookDir[0] + dy * camLookDir[1] + dz * camLookDir[2];
              if (fwdDot < -0.20) continue;

              // Camera ray test
              const vx = itemCenter[0] - eyePos[0];
              const vy = itemCenter[1] - eyePos[1];
              const vz = itemCenter[2] - eyePos[2];
              const distToCam = Math.hypot(vx, vy, vz);
              if (distToCam < 0.05) continue;

              const t_proj = vx * camLookDir[0] + vy * camLookDir[1] + vz * camLookDir[2];
              if (t_proj <= 0.05) continue; // Behind camera

              const perpDistSq = (vx - camLookDir[0] * t_proj)**2 + (vy - camLookDir[1] * t_proj)**2 + (vz - camLookDir[2] * t_proj)**2;
              const perpDist = Math.sqrt(Math.max(0, perpDistSq));

              const screenPos = projectWorldToScreen(
                itemCenter,
                viewMatrix,
                projMatrix,
                window.innerWidth,
                window.innerHeight
              );
              if (!screenPos) continue;

              const sdx = screenPos.x - halfW;
              const sdy = screenPos.y - halfH;
              const sDist = Math.hypot(sdx, sdy);

              // Angular radius of item mesh on screen (in pixels)
              const meshPixels = Math.max(30, Math.min(85, (meshRadius / distToCam) * (window.innerHeight * 0.65)));

              // Does the 3D crosshair at screen center hit the item's mesh/mass?
              const isDirectMeshHit = perpDist <= meshRadius * 1.15;
              const isScreenMeshHit = sDist <= meshPixels;

              if (!isDirectMeshHit && !isScreenMeshHit) continue;
              // Guard against off-crosshair peripheral objects
              if (sDist > 110) continue;

              // TRUE FIRST-HIT RAYCASTING & OCCLUSION:
              // Calculate the physical entrance distance t_hit along the camera ray where the ray strikes the front surface
              const t_hit = t_proj - Math.sqrt(Math.max(0, meshRadius * meshRadius - Math.min(meshRadius * meshRadius, perpDist * perpDist)));

              // Priority for fixtures co-located with walls (doors/windows inside a wall frame)
              let fixturePriority = 0;
              if (item.type === "wood_door" || item.type === "wood_window") {
                fixturePriority = -0.15;
              }

              // Direct 3D intersection on the object's mass is prioritized over loose peripheral hits
              const hitBonus = isDirectMeshHit ? 0 : 0.20;

              // Depth dominates completely: the front-most object along the camera ray is chosen first!
              // Obscured objects behind are occluded because their t_hit is deeper.
              // Tiny sDist weight (0.0008) acts only as a tie-breaker when two items are at the exact same depth (< 1cm).
              const effectiveDepth = t_hit + hitBonus + fixturePriority + (sDist * 0.0008);

              if (effectiveDepth < bestEffectiveDepth) {
                bestEffectiveDepth = effectiveDepth;
                closestDemolishItem = item;
                bestItemCenter = itemCenter;
                currentBestDist = distToPlayer;
              }
            }

            window.activeDemolishTarget = closestDemolishItem;

            let aimTargetWorld = null;
            let isLocked = false;
            let targetLabel = "";

            if (closestDemolishItem) {
              // Magnetically snap directly onto the true 3D visual center of the model!
              aimTargetWorld = bestItemCenter || [
                closestDemolishItem.position[0],
                closestDemolishItem.position[1],
                closestDemolishItem.position[2]
              ];
              isLocked = true;
              targetLabel = closestDemolishItem.type.toUpperCase().replace(/_/g, " ");
            } else {
              // Free aim raymarch in demolish mode (keeps reticle right within demolish reach)
              let curD = 0.1;
              const maxD = Math.min(maxDemolishReach + 0.35, 1.8);
              const step = 0.08;
              while (curD < maxD) {
                const testP = [
                  eyePos[0] + camLookDir[0] * curD,
                  eyePos[1] + camLookDir[1] * curD,
                  eyePos[2] + camLookDir[2] * curD
                ];
                const dC = Math.hypot(testP[0], testP[1], testP[2]);
                if (dC > 0.01) {
                  const ux = testP[0] / dC, uy = testP[1] / dC, uz = testP[2] / dC;
                  const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
                  const phi = Math.atan2(uz, ux);
                  const h = getHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                  const tRad = RADIUS + h * HEIGHT_SCALE;
                  const wRad = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel * 0.15 : 0);
                  const checkR = (typeof waterEnabled !== "undefined" && waterEnabled) ? Math.max(tRad, wRad) : tRad;
                  if (dC <= checkR + 0.08) {
                    aimTargetWorld = testP;
                    break;
                  }
                }
                curD += step;
              }
              if (!aimTargetWorld) {
                const freeReach = Math.max(0.25, maxDemolishReach + 0.05);
                aimTargetWorld = [
                  eyePos[0] + camLookDir[0] * freeReach,
                  eyePos[1] + camLookDir[1] * freeReach,
                  eyePos[2] + camLookDir[2] * freeReach
                ];
              }
              isLocked = false;
            }

            // Handle Stone Floor Hold-to-Demolish
            let holdPercent = 0;
            if (closestDemolishItem) {
              const isStoneFloor = closestDemolishItem.type === "stone_floor";
              if (isStoneFloor) {
                const isHeld = isActionDown && (document.pointerLockElement === canvas || window.simulatedPointerLock);
                if (isHeld) {
                  demolishHoldTimer += delta / 1000;
                  if (demolishHoldTimer >= 1.0) {
                    demolishHoldTimer = 0.0;
                    tryDemolishItem(closestDemolishItem);
                    window.activeDemolishTarget = null;
                    closestDemolishItem = null;
                  }
                } else {
                  demolishHoldTimer = 0.0;
                }
                holdPercent = Math.min(100, Math.floor((demolishHoldTimer / 1.0) * 100));
              } else {
                demolishHoldTimer = 0.0;
              }
            } else {
              demolishHoldTimer = 0.0;
            }

            // Update Genuine 3D Target Reticle via World3DUI (exact same 3D crosshair system as gun)
            if (typeof World3DUI !== "undefined") {
              World3DUI.updateAimReticle({
                targetPos: aimTargetWorld,
                isLocked: isLocked,
                cameraPos: eyePos,
                cameraUp: [viewMatrix[1], viewMatrix[5], viewMatrix[9]],
                isDemolish: true,
                demolishProgress: demolishHoldTimer / 1.0,
                demolishLabel: targetLabel
              });
            }

            if (closestDemolishItem) {
              const isStoneFloor = closestDemolishItem.type === "stone_floor";
              const screenPos = projectWorldToScreen(
                aimTargetWorld || closestDemolishItem.position,
                viewMatrix,
                projMatrix,
                window.innerWidth,
                window.innerHeight,
              );
              if (screenPos) {
                let instructionsHTML = "";
                const isGp = (typeof isCurrentlyGamepadMode === "function" ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
                const attackBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") 
                  ? window.GamepadController.getButtonLabel("attack") 
                  : "L-Click";
                const clickActionHold = isGp ? `กด [${attackBtn}] ค้าง` : "กดคลิกซ้ายค้าง";
                const clickActionHoldEn = isGp ? `Hold [${attackBtn}]` : "Hold Left-click";
                const clickActionSingle = isGp ? `กด [${attackBtn}]` : "คลิกซ้าย";
                const clickActionSingleEn = isGp ? `Press [${attackBtn}]` : "Left-click";

                if (isStoneFloor) {
                  instructionsHTML = `
                    <strong>🔨 โหมดรื้อถอน (DEMOLISH MODE)</strong><br/>
                    ${clickActionHold} เพื่อรื้อถอน STONE FLOOR<br/>
                    <span style="font-size: 10px; opacity: 0.9; display: block; margin-top: 2px;">${clickActionHoldEn} to demolish STONE FLOOR</span>
                  `;
                } else {
                  instructionsHTML = `
                    <strong>🔨 โหมดรื้อถอน (DEMOLISH MODE)</strong><br/>
                    ${clickActionSingle} เพื่อรื้อถอน ${closestDemolishItem.type.toUpperCase().replace(/_/g, " ")}<br/>
                    <span style="font-size: 10px; opacity: 0.9; display: block; margin-top: 2px;">${clickActionSingleEn} to demolish ${closestDemolishItem.type.toUpperCase().replace(/_/g, " ")}</span>
                  `;
                }

                const _newHtml_1 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(220, 38, 38, 0.95); border: 1px solid #ff4d4d; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  ${isStoneFloor ? `<div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(255, 255, 255, 0.35); pointer-events: none; transition: width 0.05s ease-out;"></div>` : ""}
                  <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'Google Sans', sans-serif; color: #ffffff;">
                    ${instructionsHTML}
                    <span style="font-size: 9px; opacity: 0.8; display: block; margin-top: 4px;">ระยะห่าง / Distance: ${currentBestDist.toFixed(2)}m</span>
                  </div>
                </div>`;
                if (prompt._lastHTML !== _newHtml_1) {
                  prompt.innerHTML = _newHtml_1;
                  prompt._lastHTML = _newHtml_1;
                }
                if (prompt.style.display !== "block") prompt.style.display = "block";
                const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                if (prompt._lastT !== newT) {
                  prompt.style.transform = newT;
                  prompt._lastT = newT;
                }
              } else {
                if (prompt.style.display !== "none") prompt.style.display = "none";
              }
            } else {
              demolishHoldTimer = 0.0;
              if (prompt.style.display !== "none") prompt.style.display = "none";
            }
          } else if (false) {
            // Disabled orange terrain mod banner
            demolishHoldTimer = 0.0;
            const _newHtml_2 = `<div style="margin: -8px -16px; padding: 10px 20px; position: relative; overflow: hidden; border-radius: 8px; background: rgba(230, 81, 0, 0.95); border: 1px solid #ff9800; box-shadow: 0 4px 12px rgba(0,0,0,0.5); text-align: center; font-size: 11px; font-family: 'Google Sans', sans-serif; color: #ffffff;">
              <strong>⛏️ โหมดปรับแต่งพื้นผิวดาว (TERRAIN MOD MODE)</strong><br/>
              คลิกซ้าย: ขุดหลุม / Left-click: Dig<br/>
              คลิกขวา: ถมดิน / Right-click: Raise
            </div>`;
if (prompt._lastHTML !== _newHtml_2) {
    prompt.innerHTML = _newHtml_2;
    prompt._lastHTML = _newHtml_2;
}
            if (prompt.style.display !== "block") prompt.style.display = "block";
            const newT = `translate(50vw, 80vh) translate(-50%, -100%)`;
            if (prompt._lastT !== newT) {
                prompt.style.transform = newT;
                prompt._lastT = newT;
            }
          } else {
            demolishHoldTimer = 0.0;
            if (activeRidingBoat) {
              let rLen = Math.sqrt(activeRidingBoat.position[0]**2 + activeRidingBoat.position[1]**2 + activeRidingBoat.position[2]**2) || 1;
              let bTheta = Math.acos(Math.max(-1, Math.min(1, activeRidingBoat.position[1] / rLen)));
              let bPhi = Math.atan2(activeRidingBoat.position[2], activeRidingBoat.position[0]);
              let bHeight = getHeightOnSphere(bTheta, bPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
              let bTerrainRadius = RADIUS + bHeight * HEIGHT_SCALE;
              const bWaterRadius = RADIUS + waterLevel * 0.15;
              const bDepth = bWaterRadius - bTerrainRadius;
              const hasWheels = activeRidingBoat.hasWheel || activeRidingBoat.hasWheels || (activeRidingBoat.wheelCount && activeRidingBoat.wheelCount > 0);
              const canRideBoat = (waterEnabled && bDepth > 0.48 * playerScale) || hasWheels;

              const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
              if (isInteractHeld) {
                chestHoldTimer += delta / 1000;
                if (chestHoldTimer >= 0.8) {
                  chestHoldTimer = 0.0;
                  const boatToDismount = activeRidingBoat;
                  let isMidAir = false;
                  // Dismounting - place player slightly to the right side of the boat to prevent collision trapping
                  if (boatToDismount.R) {
                     const sideOffset = 0.65;
                     const p3d = [
                       boatToDismount.position[0] + boatToDismount.R[0] * sideOffset,
                       boatToDismount.position[1] + boatToDismount.R[1] * sideOffset,
                       boatToDismount.position[2] + boatToDismount.R[2] * sideOffset
                     ];
                     const pLen = Math.sqrt(p3d[0]*p3d[0] + p3d[1]*p3d[1] + p3d[2]*p3d[2]) || 1;
                     charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, p3d[1] / pLen)));
                     charPhi = Math.atan2(p3d[2], p3d[0]);
                     if (charPhi < 0) charPhi += Math.PI * 2;

                     const pnx = p3d[0] / pLen, pny = p3d[1] / pLen, pnz = p3d[2] / pLen;
                     const pFeetRad = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : (pLen - 0.46 * playerScale);
                     const pCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(pnx, pny, pnz, pFeetRad) : null;
                     const actualGroundHeight = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                     const pGroundRad = pCaveData ? pCaveData.ground : (RADIUS + actualGroundHeight * HEIGHT_SCALE);
                     const effectiveHScale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow(RADIUS / 8.0, 0.70));
                     const currentWaterRad = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (effectiveHScale * 0.25);
                     const isWaterSurface = (typeof waterEnabled === "undefined" || waterEnabled) && currentWaterRad > (pGroundRad + 0.1) && (!pCaveData || !pCaveData.insideTunnel);

                     const surfaceRad = isWaterSurface ? currentWaterRad : pGroundRad;
                     const normalLandRad = isWaterSurface ? (currentWaterRad - 0.10 * playerScale) : (pGroundRad + 0.46 * playerScale);

                     // Check if the boat is dismounting in mid-air (winged boat flight or airborne)
                     const boatAltitude = (boatToDismount.currentRadius !== undefined && boatToDismount.currentRadius > 0) ? boatToDismount.currentRadius : pLen;
                     isMidAir = (boatAltitude - surfaceRad) > (0.45 * playerScale);

                     if (isMidAir) {
                       // Remain at high altitude alongside the boat to free-fall from the sky
                       playerCenterRadius = boatAltitude + 0.46 * playerScale;
                       isPlayerGrounded = false;
                       playerVerticalVel = (typeof boatToDismount.verticalVel === "number") ? boatToDismount.verticalVel : 0.0;
                       jumpBlend = 1.0;
                     } else if (isWaterSurface) {
                       playerCenterRadius = normalLandRad;
                       isPlayerGrounded = false;
                       playerVerticalVel = 0.0;
                     } else {
                       playerCenterRadius = normalLandRad;
                       isPlayerGrounded = true;
                       playerVerticalVel = 0.0;
                     }

                     if (typeof planetCore !== "undefined") {
                       const curNx = Math.sin(charTheta) * Math.cos(charPhi);
                       const curNy = Math.cos(charTheta);
                       const curNz = Math.sin(charTheta) * Math.sin(charPhi);
                       px = planetCore[0] + playerCenterRadius * curNx;
                       py = planetCore[1] + playerCenterRadius * curNy;
                       pz = planetCore[2] + playerCenterRadius * curNz;
                       if (typeof window !== "undefined") window.player3DPos = [px, py, pz];
                     }
                  }
                  boatToDismount.isDynamic = true;
                  boatToDismount._isSleeping = false;
                  boatToDismount._cachedCollisionRadius = null;
                  const hasWingDismount = !!(boatToDismount.hasWing || boatToDismount.hasWings);
                  const wasFlyingDismount = !!(boatToDismount.isFlying || isMidAir);
                  const currentVehSpeed = boatToDismount.vehicleSpeed || 0;

                  if (hasWingDismount && wasFlyingDismount) {
                    // Winged boat dismounting in flight mode / mid-air:
                    // Keep gliding forward and sinking down realistically (matching the condition when not pressing W)
                    boatToDismount.isFlying = true;
                    boatToDismount.isGliding = true;
                    boatToDismount.isAirborne = true;
                    boatToDismount.vehicleSpeed = currentVehSpeed; // Preserve forward cruising speed
                    boatToDismount.verticalVel = (typeof boatToDismount.verticalVel === "number" && boatToDismount.verticalVel < 0)
                      ? boatToDismount.verticalVel
                      : -0.002;
                    boatToDismount.pitchGrade = (typeof boatToDismount.pitchGrade === "number") ? boatToDismount.pitchGrade : 0;
                    if (boatToDismount.F) {
                      boatToDismount.vel = [
                        boatToDismount.F[0] * boatToDismount.vehicleSpeed,
                        boatToDismount.F[1] * boatToDismount.vehicleSpeed,
                        boatToDismount.F[2] * boatToDismount.vehicleSpeed
                      ];
                    } else {
                      boatToDismount.vel = [0, 0, 0];
                    }
                  } else {
                    boatToDismount.isFlying = false;
                    boatToDismount.isGliding = false;
                    boatToDismount.vehicleSpeed = currentVehSpeed * 0.35;
                    if (boatToDismount.F) {
                      boatToDismount.vel = [
                        boatToDismount.F[0] * boatToDismount.vehicleSpeed,
                        boatToDismount.F[1] * boatToDismount.vehicleSpeed,
                        boatToDismount.F[2] * boatToDismount.vehicleSpeed
                      ];
                    } else {
                      boatToDismount.vel = [0, 0, 0];
                    }
                    boatToDismount.verticalVel = 0;
                  }
                  boatToDismount.spinSpeed = 0;
                  boatToDismount.spinAxis = [0, 1, 0];
                  activeRidingBoat = null;
                  window.activeRidingBoat = null;
                  if (typeof window.exitBoatCamera === "function") {
                    window.exitBoatCamera();
                  }
                  if (typeof SpatialGrid !== "undefined" && typeof collectibles !== "undefined") {
                    SpatialGrid.rebuild(collectibles);
                  }
                  if (typeof updateCharacterMesh === "function") {
                    updateCharacterMesh(walkPhase);
                  }
                  if (typeof refreshCollectiblesVBO === "function") {
                    refreshCollectiblesVBO('dynamic');
                  }
                  if (typeof World3DUI !== "undefined") {
                    World3DUI.hideBoatUI();
                  }
                  if (typeof stopWheeledBoatSound === "function") stopWheeledBoatSound();
            }
          } else {
                chestHoldTimer = 0.0;
              }
              if (activeRidingBoat) {
                const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
                
                const isEngineBoat_3 = !!(activeRidingBoat && activeRidingBoat.hasEngine);
                let batteryPercent = 0;
                if (isEngineBoat_3 && typeof window.BatterySystem !== "undefined") {
                  const stats = window.BatterySystem.getStats();
                  if (stats.readyCount > 0 && stats.activeBattery) {
                    batteryPercent = Math.max(0, Math.min(100, (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100));
                  } else if (stats.rechargingCount > 0) {
                    const firstRecharging = window.BatterySystem.batteries.find(b => b.isRecharging);
                    batteryPercent = firstRecharging ? Math.max(0, Math.min(100, (firstRecharging.rechargeTime / window.BatterySystem.REGEN_TIME) * 100)) : 0;
                  }
                }

                if (prompt && prompt.style.display !== "none") prompt.style.display = "none";
                
                if (typeof World3DUI !== "undefined") {
                  World3DUI.updateBoatUI({
                    boat: activeRidingBoat,
                    isRiding: true,
                    playerScale: playerScale,
                    isEngineBoat: isEngineBoat_3,
                    batteryPercent: batteryPercent,
                    holdPercent: holdPercent
                  });
                }
              } else if (typeof World3DUI !== "undefined") {
                World3DUI.hideBoatUI();
              }
            } else if (activeRidingMech) {
              window.tryAutoAssembleMechParts(activeRidingMech);
              const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];

              if (activeRidingMech._nearbyStand && !activeRidingMech.dockedStand) {
                // Holding [E] near a robot stand re-docks the mech
                if (isInteractHeld) {
                  activeRidingMech._dockingTimer = (activeRidingMech._dockingTimer || 0) + delta / 1000;
                  chestHoldTimer = 0.0;
                  if (activeRidingMech._dockingTimer >= 0.8) {
                    activeRidingMech.dockedStand = activeRidingMech._nearbyStand;
                    activeRidingMech._undockedFromStand = null;
                    activeRidingMech._dockingTimer = 0.0;
                    activeRidingMech._nearbyStand = null;
                    if (typeof showNotice === "function") {
                      showNotice("⚙️ กลับเข้าสู่โหมดประกอบกับฐานตั้งแล้ว / Docked to Stand");
                    }
                  }
                } else {
                  activeRidingMech._dockingTimer = 0.0;
                  chestHoldTimer = 0.0;
                }
              } else {
                activeRidingMech._dockingTimer = 0.0;
                if (isInteractHeld) {
                  chestHoldTimer += delta / 1000;
                  if (chestHoldTimer >= 0.8) {
                    chestHoldTimer = 0.0;
                    const mechToDismount = activeRidingMech;
                    if (mechToDismount.R) {
                       const sideOffset = 0.65;
                       const p3d = [
                         mechToDismount.position[0] + mechToDismount.R[0] * sideOffset,
                         mechToDismount.position[1] + mechToDismount.R[1] * sideOffset,
                         mechToDismount.position[2] + mechToDismount.R[2] * sideOffset
                       ];
                       const pLen = Math.sqrt(p3d[0]*p3d[0] + p3d[1]*p3d[1] + p3d[2]*p3d[2]) || 1;
                       charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, p3d[1] / pLen)));
                       charPhi = Math.atan2(p3d[2], p3d[0]);
                       if (charPhi < 0) charPhi += Math.PI * 2;

                       const pnx = p3d[0] / pLen, pny = p3d[1] / pLen, pnz = p3d[2] / pLen;
                       const pFeetRad = (playerCenterRadius !== null) ? (playerCenterRadius - 0.46 * playerScale) : (pLen - 0.46 * playerScale);
                       const pCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(pnx, pny, pnz, pFeetRad) : null;
                       const pGroundRad = pCaveData ? pCaveData.ground : (RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE);
                       const effectiveHScale = typeof HEIGHT_SCALE !== 'undefined' ? HEIGHT_SCALE : (0.6 * Math.pow(RADIUS / 8.0, 0.70));
                       const currentWaterRad = RADIUS + (typeof waterLevel !== 'undefined' ? waterLevel : 1.0) * (effectiveHScale * 0.25);
                       const isWaterSurface = (typeof waterEnabled === "undefined" || waterEnabled) && currentWaterRad > (pGroundRad + 0.1) && (!pCaveData || !pCaveData.insideTunnel);

                       const surfaceRad = isWaterSurface ? currentWaterRad : pGroundRad;
                       const normalLandRad = isWaterSurface ? (currentWaterRad - 0.10 * playerScale) : (pGroundRad + 0.46 * playerScale);
                       const isMidAir = (pLen - surfaceRad) > (0.45 * playerScale);

                       if (isMidAir) {
                         playerCenterRadius = pLen + 0.46 * playerScale;
                         isPlayerGrounded = false;
                         playerVerticalVel = 0.0;
                         jumpBlend = 1.0;
                       } else if (isWaterSurface) {
                         playerCenterRadius = normalLandRad;
                         isPlayerGrounded = false;
                         playerVerticalVel = 0.0;
                       } else {
                         playerCenterRadius = normalLandRad;
                         isPlayerGrounded = true;
                         playerVerticalVel = 0.0;
                       }
                    }
                    mechToDismount.isDynamic = false;
                    mechToDismount.vel = [0, 0, 0];

                    if (mechToDismount.position) {
                      const mPos = mechToDismount.position;
                      const mLen = Math.sqrt(mPos[0]*mPos[0] + mPos[1]*mPos[1] + mPos[2]*mPos[2]) || 1;
                      const mnx = mPos[0] / mLen, mny = mPos[1] / mLen, mnz = mPos[2] / mLen;
                      let mTheta = Math.acos(Math.max(-1.0, Math.min(1.0, mny)));
                      let mPhi = Math.atan2(mnz, mnx);
                      let mFeetRad = mLen - 0.66;
                      const mCaveData = typeof getTerrainSurfaceAndCeiling === "function" ? getTerrainSurfaceAndCeiling(mnx, mny, mnz, mFeetRad) : null;
                      let mGroundRad = mCaveData ? mCaveData.ground : (RADIUS + getHeightOnSphere(mTheta, mPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE);
                      const wRad = RADIUS + waterLevel * 0.15;
                      if (waterEnabled && mGroundRad < wRad && (!mCaveData || !mCaveData.insideTunnel)) mGroundRad = wRad;

                      // Check if mech has legs or stand attached
                      const hasLegsOrStand = mechToDismount.attachedParts && mechToDismount.attachedParts.some(entry =>
                        entry.item && entry.item.active && entry.item.type && (
                          entry.item.type.includes("leg") ||
                          entry.item.type.includes("stand")
                        )
                      );

                      const unmountedRad = hasLegsOrStand ? (mGroundRad + 0.66) : (mGroundRad + 0.20);
                      mechToDismount.position = [mnx * unmountedRad, mny * unmountedRad, mnz * unmountedRad];
                    }

                    if (mechToDismount.attachedParts) {
                      for (let entry of mechToDismount.attachedParts) {
                        if (entry.item) {
                          entry.item.isDynamic = false;
                          entry.item.vel = [0, 0, 0];
                          const mR = mechToDismount.R || [1, 0, 0];
                          const mN = mechToDismount.normal || mechToDismount.U || [0, 1, 0];
                          const mF = mechToDismount.F || [0, 0, 1];
                          entry.item.position = [
                            mechToDismount.position[0] + mR[0]*entry.localR + mN[0]*entry.localN + mF[0]*entry.localF,
                            mechToDismount.position[1] + mR[1]*entry.localR + mN[1]*entry.localN + mF[1]*entry.localF,
                            mechToDismount.position[2] + mR[2]*entry.localR + mN[2]*entry.localN + mF[2]*entry.localF
                          ];
                        }
                      }
                    }
                    activeRidingMech = null;
                    window.activeRidingMech = null;
                    if (typeof window.exitMechCamera === "function") {
                      window.exitMechCamera();
                    }
                    if (typeof SpatialGrid !== "undefined" && typeof collectibles !== "undefined") {
                      SpatialGrid.rebuild(collectibles);
                    }
                    pendingCollectibleRefresh = true;
                  }
                } else {
                  chestHoldTimer = 0.0;
                }
              }

              let holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
              let actionText = "ลงจากหุ่นยนต์<br>Dismount Mech";
              
              if (activeRidingMech && activeRidingMech._nearbyStand && !activeRidingMech.dockedStand) {
                const dockPct = Math.min(100, Math.floor(((activeRidingMech._dockingTimer || 0) / 0.8) * 100));
                holdPercent = dockPct;
                actionText = "ยึดหุ่นเข้ากับฐานตั้ง<br>Dock Mech to Stand";
              }

              const fullyAssembled = window.isMechFullyAssembled(activeRidingMech);
              let extraStatus = "";
              const isGp = (typeof isCurrentlyGamepadMode === "function" ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
              const interactBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") 
                ? window.GamepadController.getButtonLabel("interact") 
                : "E";
              const throttleBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") 
                ? window.GamepadController.getButtonLabel("flightThrottle") 
                : "W";

              if (activeRidingMech && activeRidingMech._nearbyStand && !activeRidingMech.dockedStand) {
                const dockPct = Math.min(100, Math.floor(((activeRidingMech._dockingTimer || 0) / 0.8) * 100));
                extraStatus = `<br><span style="color: #6cebdf; font-size: 10px;">⚙️ อยู่ใกล้ฐานตั้ง! กด [${interactBtn}] ค้าง เพื่อยึดหุ่นเข้ากับฐาน ${dockPct > 0 ? '(' + dockPct + '%)' : ''}</span>`;
              } else if (!fullyAssembled && activeRidingMech) {
                let missing = [];
                const attached = activeRidingMech.attachedParts || [];
                const getLabel = (type) => {
                  if (typeof window.t === "function") {
                    if (type === "robot_left_leg") return window.t("mech_part_left_leg");
                    if (type === "robot_right_leg") return window.t("mech_part_right_leg");
                    if (type === "robot_left_arm") return window.t("mech_part_left_arm");
                    if (type === "robot_right_arm") return window.t("mech_part_right_arm");
                  }
                  return type;
                };
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_left_leg")) missing.push(getLabel("robot_left_leg"));
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_right_leg")) missing.push(getLabel("robot_right_leg"));
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_left_arm")) missing.push(getLabel("robot_left_arm"));
                if (!attached.some(p => p.item && p.item.active && p.item.type === "robot_right_arm")) missing.push(getLabel("robot_right_arm"));
                const warnMsg = (typeof window.t === "function") ? window.t("mech_missing_parts_warn", { missing: missing.join(", ") }) : `⚠️ Mech incomplete (Missing: ${missing.join(", ")}) — Assemble all 4 parts before piloting`;
                extraStatus = `<br><span style="color: #ff8888; font-size: 10px;">${warnMsg}</span>`;
              } else if (activeRidingMech && activeRidingMech.dockedStand) {
                let holdPct = Math.min(100, Math.floor(((activeRidingMech._undockHoldTimer || 0) / 0.35) * 100));
                extraStatus = `<br><span style="color: #6cebdf; font-size: 10px;">🏗️ กด [${isGp ? throttleBtn : 'W'}] ค้าง (เดินหน้าอย่างเดียว) เพื่อปลดล็อคออกจากฐานตั้ง ${holdPct > 0 ? '(' + holdPct + '%)' : ''}</span>`;
              }

              if (prompt.style.display !== "none") {
                  prompt.style.display = "none";
              }
              if (typeof World3DUI !== "undefined") {
                  
                  let batteryPercent = 0;
                  if (typeof window.BatterySystem !== "undefined") {
                    const stats = window.BatterySystem.getStats();
                    if (stats.readyCount > 0 && stats.activeBattery) {
                      batteryPercent = Math.max(0, Math.min(100, (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100));
                    }
                  }
                  
                  World3DUI.updateMechRideUI({
                    mech: activeRidingMech,
                    playerScale: playerScale,
                    holdPercent: holdPercent,
                    isDismount: true,
                    extraStatus: extraStatus,
                    batteryPercent: batteryPercent,
                    hasBattery: (typeof window.BatterySystem !== "undefined")
                  });
              }
            } else {
              let closestItem = null;
              let bestItemDistSq = Infinity;

              const nearbyCandidates = (typeof SpatialGrid !== "undefined")
                ? SpatialGrid.queryRadius(pVec[0], pVec[1], pVec[2], 4.0)
                : collectibles;

              for (let item of nearbyCandidates) {
                if (!item.active) continue;
                if (item.type === "wood_stairs" || item.type === "folding_ladder" || item.type === "wood_floor" || item.type === "thin_wood_floor" || item.type === "stone_floor" || item.type === "obsidian_pad_warp_item" || item.type === "obsidian_compass_pad_item" || item.type === "campfire" || item.type === "wood_boat" || item.type === "boat" || (typeof item.type === "string" && item.type.toLowerCase().includes("boat")) || item.type === "wood_wheel" || item.type === "electric_engine" || item.type === "boat_wing" || item.type === "wood_wall" || item.type === "wood_window" || item.type === "wood_door" || item.type === "wood_chest" || item.type === "axe" || item.type === "pickaxe" || item.type.startsWith("robot_")) continue;
                
                const reachInfo = isTargetWithinReach(item.position, actionReachDistance);
                if (reachInfo.valid) {
                  const distSq = reachInfo.perpSq;
                  if (distSq < bestItemDistSq) {
                    bestItemDistSq = distSq;
                    closestItem = item;
                  }
                }
              }

              // Check line-based Axe and Pickaxe items!
              let closestLineItem = null;
              let bestLineItemT = Infinity;
              if (!closestItem) {
                for (let item of nearbyCandidates) {
                  if (item.active && (item.type === "axe" || item.type === "pickaxe")) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestLineItemT) {
                        bestLineItemT = reachInfo.t;
                        closestLineItem = item;
                      }
                    }
                  }
                }
                if (closestLineItem) {
                  closestItem = closestLineItem;
                }
              }

              // Check boat FIRST so 2D item UI is never pulled in for a boat
              let bestBoatT = Infinity;
              let candidateBoat = null;
              for (let item of nearbyCandidates) {
                if (item.active && (item.type === "wood_boat" || item.type === "boat" || (typeof item.type === "string" && item.type.toLowerCase().includes("boat"))) && !item.isPreview) {
                  const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.22 * (playerScale / 0.1)));
                  if (reachInfo.valid) {
                    if (reachInfo.t < bestBoatT) {
                      bestBoatT = reachInfo.t;
                      candidateBoat = item;
                    }
                  }
                }
              }

              let closestChest = null;
              let closestCampfire = null;
              let closestBoat = null;
              let closestMech = null;
              let closestMechTargetPos = null;

              if (candidateBoat) {
                // When aiming at a boat: boat ONLY uses 3D UI, completely eliminate 2D UI for the boat
                closestBoat = candidateBoat;
                closestItem = null;
              } else if (!closestItem) {
                let bestMechT = Infinity;
                let candidateMech = null;
                let candidateMechTargetPos = null;
                const cockpitsToCheck = [];
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "robot_cockpit" && !item.isPreview) {
                    cockpitsToCheck.push(item);
                  }
                }
                if (cockpitsToCheck.length === 0 && typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
                  for (let item of collectibles) {
                    if (item.active && item.type === "robot_cockpit" && !item.isPreview) {
                      const dx = item.position[0] - pVec[0];
                      const dy = item.position[1] - pVec[1];
                      const dz = item.position[2] - pVec[2];
                      if (dx*dx + dy*dy + dz*dz < 36.0) {
                        cockpitsToCheck.push(item);
                      }
                    }
                  }
                }

                for (let item of cockpitsToCheck) {
                  let mechParts = [item];
                  if (item.attachedParts && Array.isArray(item.attachedParts)) {
                    for (let entry of item.attachedParts) {
                      if (entry && entry.item && entry.item.active && !entry.item.isPreview && !mechParts.includes(entry.item)) {
                        mechParts.push(entry.item);
                      }
                    }
                  }
                  if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
                    for (let p of collectibles) {
                      if (p.active && !p.isPreview && p !== item && p.type.startsWith("robot_") && p.type !== "robot_stand" && !mechParts.includes(p)) {
                        const dx = p.position[0] - item.position[0];
                        const dy = p.position[1] - item.position[1];
                        const dz = p.position[2] - item.position[2];
                        if (dx*dx + dy*dy + dz*dz < 4.0) {
                          mechParts.push(p);
                        }
                      }
                    }
                  }

                  // Mounting interaction must ONLY be accessible at the legs when legs are attached
                  // Arms, cockpit and upper body parts are completely excluded from mounting reach
                  const legParts = mechParts.filter(p => p && p.type && (p.type === "robot_left_leg" || p.type === "robot_right_leg"));
                  const targetPartsToCheck = legParts.length > 0 ? legParts : [item];

                  const legReachDist = Math.max(actionReachDistance, 0.45 * (playerScale / 0.1));
                  for (let part of targetPartsToCheck) {
                    const reachInfo = isTargetWithinReach(part.position, legReachDist);
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestMechT) {
                        bestMechT = reachInfo.t;
                        candidateMech = item;
                        candidateMechTargetPos = part.position;
                      }
                    }
                  }
                }

                let bestChestT = Infinity;
                let candidateChest = null;
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "wood_chest" && !item.isPreview) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestChestT) {
                        bestChestT = reachInfo.t;
                        candidateChest = item;
                      }
                    }
                  }
                }

                let bestCampfireT = Infinity;
                let candidateCampfire = null;
                for (let item of nearbyCandidates) {
                  if (item.active && item.type === "campfire" && !item.isPreview) {
                    const reachInfo = isTargetWithinReach(item.position, Math.max(actionReachDistance, 0.15 * (playerScale / 0.1)));
                    if (reachInfo.valid) {
                      if (reachInfo.t < bestCampfireT) {
                        bestCampfireT = reachInfo.t;
                        candidateCampfire = item;
                      }
                    }
                  }
                }
                
                if (candidateChest) {
                  closestChest = candidateChest;
                  closestMech = null;
                  closestBoat = null;
                  closestCampfire = null;
                } else if (candidateMech) {
                  closestMech = candidateMech;
                  closestMechTargetPos = candidateMechTargetPos || candidateMech.position;
                  closestChest = null;
                  closestBoat = null;
                  closestCampfire = null;
                } else if (candidateCampfire) {
                  closestCampfire = candidateCampfire;
                  closestChest = null;
                  closestBoat = null;
                  closestMech = null;
                }

              }

              if (closestItem) {
                if (typeof World3DUI !== "undefined") { World3DUI.hideBoatUI(); World3DUI.hideMechRideUI(); }
                chestHoldTimer = 0.0;
                const screenPos = projectWorldToScreen(
                  closestItem.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const _newText_1 = `[${currentKeyBindings.interact.replace("Key", "").replace("Arrow", "")}]`;
if (prompt._lastText !== _newText_1) {
    prompt.textContent = _newText_1;
    prompt._lastText = _newText_1;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 20 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                }
              } else if (closestChest) {
                if (typeof World3DUI !== "undefined") { World3DUI.hideBoatUI(); World3DUI.hideMechRideUI(); }
                const screenPos = projectWorldToScreen(
                  closestChest.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                  if (isInteractHeld) {
                    chestHoldTimer += delta / 1000;
                    if (chestHoldTimer >= 0.8) {
                      chestHoldTimer = 0.0;
                      openChest(closestChest);
            }
          } else {
                    chestHoldTimer = 0.0;
                  }

                  const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
                  const interactBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") 
                    ? window.GamepadController.getButtonLabel("interact") 
                    : "E";
                  const _newHtml_5 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 183, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'Google Sans', sans-serif; color: #dfb76c;">
                      กด [${interactBtn}] ค้าง เพื่อเปิดกล่องไม้<br/>
                      (HOLD [${interactBtn}] TO OPEN CHEST)
                    </div>
                  </div>`;
if (prompt._lastHTML !== _newHtml_5) {
    prompt.innerHTML = _newHtml_5;
    prompt._lastHTML = _newHtml_5;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                  chestHoldTimer = 0.0;
                }
              
              } else if (closestCampfire) {
                if (typeof World3DUI !== "undefined") { World3DUI.hideBoatUI(); World3DUI.hideMechRideUI(); }
                const screenPos = projectWorldToScreen(
                  closestCampfire.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                  if (isInteractHeld) {
                    campfireHoldTimer += delta / 1000;
                    if (campfireHoldTimer >= 0.5) {
                      campfireHoldTimer = 0.0;
                      openCookingUI();
            }
          } else {
                    campfireHoldTimer = 0.0;
                  }
                  const holdPercent = Math.min(100, Math.floor((campfireHoldTimer / 0.5) * 100));
                  const interactBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") 
                    ? window.GamepadController.getButtonLabel("interact") 
                    : "E";
                  const _newHtml_6 = `<div style="margin: -8px -16px; padding: 8px 16px; position: relative; overflow: hidden; border-radius: 8px;">
                    <div style="position: absolute; bottom: 0; left: 0; height: 100%; width: ${holdPercent}%; background: rgba(223, 108, 108, 0.4); pointer-events: none; transition: width 0.05s ease-out;"></div>
                    <div style="position: relative; z-index: 1; text-align: center; font-size: 11px; font-family: 'Google Sans', sans-serif; color: #df6c6c;">
                      กด [${interactBtn}] ค้าง เพื่อทำอาหาร<br/>
                      (HOLD [${interactBtn}] TO COOK)
                    </div>
                  </div>`;
if (prompt._lastHTML !== _newHtml_6) {
    prompt.innerHTML = _newHtml_6;
    prompt._lastHTML = _newHtml_6;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 45 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                  campfireHoldTimer = 0.0;
                }
} else if (closestBoat) {
                if (typeof World3DUI !== "undefined") World3DUI.hideMechRideUI();
                if (prompt && prompt.style.display !== "none") prompt.style.display = "none";

                let rLen = Math.sqrt(closestBoat.position[0]**2 + closestBoat.position[1]**2 + closestBoat.position[2]**2) || 1;
                let bTheta = Math.acos(Math.max(-1, Math.min(1, closestBoat.position[1] / rLen)));
                let bPhi = Math.atan2(closestBoat.position[2], closestBoat.position[0]);
                let bHeight = getHeightOnSphere(bTheta, bPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                let bTerrainRadius = RADIUS + bHeight * HEIGHT_SCALE;
                const bWaterRadius = RADIUS + waterLevel * 0.15;
                const bDepth = bWaterRadius - bTerrainRadius;
                const canRideBoat = (waterEnabled && bDepth > 0.48 * playerScale) || closestBoat.hasWheel || closestBoat.hasWheels;

                const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                if (isInteractHeld) {
                    chestHoldTimer += delta / 1000;
                    if (chestHoldTimer >= 0.8) {
                      chestHoldTimer = 0.0;
                      activeRidingBoat = closestBoat;
                      window.activeRidingBoat = activeRidingBoat;
                      if (typeof window.enterBoatCamera === "function") {
                        window.enterBoatCamera();
                      }
                      activeRidingBoat.isDynamic = true;
                      pendingCollectibleRefresh = true;
                      if (typeof refreshCollectiblesVBO === "function") {
                        refreshCollectiblesVBO('dynamic');
                      }
                      // Teleport player to the boat's exact position on boarding so the boat doesn't jump
                      if (activeRidingBoat.position) {
                          const bPos = activeRidingBoat.position;
                          const bLen = Math.sqrt(bPos[0]*bPos[0] + bPos[1]*bPos[1] + bPos[2]*bPos[2]) || 1;
                          const bnx = bPos[0] / bLen;
                          const bny = bPos[1] / bLen;
                          const bnz = bPos[2] / bLen;
                          charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, bny)));
                          charPhi = Math.atan2(bnz, bnx);
                          if (charPhi < 0) charPhi += Math.PI * 2;
                      }
                      if (activeRidingBoat.F && activeRidingBoat.normal) {
                          const North = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
                          const East = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
                          const fNorth = activeRidingBoat.F[0]*North[0] + activeRidingBoat.F[1]*North[1] + activeRidingBoat.F[2]*North[2];
                          const fEast = activeRidingBoat.F[0]*East[0] + activeRidingBoat.F[1]*East[1] + activeRidingBoat.F[2]*East[2];
                          charHeading = Math.atan2(fEast, fNorth);
                      }
                    }
                } else {
                    chestHoldTimer = 0.0;
                }
                const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));

                if (typeof World3DUI !== "undefined") {
                  World3DUI.updateBoatUI({
                    boat: closestBoat,
                    isRiding: false,
                    playerScale: playerScale,
                    isEngineBoat: false,
                    holdPercent: holdPercent
                  });
                }
              } else if (closestMech) {
                if (typeof World3DUI !== "undefined") {
                  World3DUI.hideBoatUI();
                }
                const isInteractHeld = keysPressed[currentKeyBindings.interact] || keysPressed["KeyE"];
                if (isInteractHeld) {
                  chestHoldTimer += delta / 1000;
                  if (chestHoldTimer >= 0.8) {
                    chestHoldTimer = 0.0;
                    activeRidingMech = closestMech;
                    window.activeRidingMech = activeRidingMech;
                    if (typeof window.enterMechCamera === "function") {
                      window.enterMechCamera();
                    }
                    activeRidingMech.isDynamic = true;

                    let mStand = null;
                    if (typeof SpatialGrid !== "undefined") {
                      const nearStands = SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 1.0, item => item.active && !item.isPreview && item.type === "robot_stand");
                      if (nearStands.length > 0) mStand = nearStands[0];
                    } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
                      for (let item of collectibles) {
                        if (item.active && !item.isPreview && item.type === "robot_stand") {
                          const dx = item.position[0] - activeRidingMech.position[0];
                          const dy = item.position[1] - activeRidingMech.position[1];
                          const dz = item.position[2] - activeRidingMech.position[2];
                          if (dx*dx + dy*dy + dz*dz < 1.0) {
                            mStand = item;
                            break;
                          }
                        }
                      }
                    }
                    activeRidingMech.dockedStand = mStand;
                    activeRidingMech._undockedFromStand = null;
                    activeRidingMech._undockHoldTimer = 0;
                    activeRidingMech._dockingTimer = 0;
                    activeRidingMech._redockCooldown = 0;

                    activeRidingMech.attachedParts = [];
                    const nearbyRobotParts = (typeof SpatialGrid !== "undefined")
                      ? SpatialGrid.queryRadius(activeRidingMech.position[0], activeRidingMech.position[1], activeRidingMech.position[2], 1.75, p => p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech)
                      : (typeof collectibles !== "undefined" ? collectibles : []);
                    for (let p of nearbyRobotParts) {
                      if (p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand" && p !== activeRidingMech) {
                        const dx = p.position[0] - activeRidingMech.position[0];
                        const dy = p.position[1] - activeRidingMech.position[1];
                        const dz = p.position[2] - activeRidingMech.position[2];
                        if (dx*dx + dy*dy + dz*dz < 3.0) {
                          p.isDynamic = true;
                          const cR = activeRidingMech.R || [1,0,0];
                          const cN = activeRidingMech.normal || activeRidingMech.U || [0,1,0];
                          const cF = activeRidingMech.F || [0,0,1];

                          const localR = dx * cR[0] + dy * cR[1] + dz * cR[2];
                          const localN = dx * cN[0] + dy * cN[1] + dz * cN[2];
                          const localF = dx * cF[0] + dy * cF[1] + dz * cF[2];

                          activeRidingMech.attachedParts.push({
                            item: p,
                            localR: localR,
                            localN: localN,
                            localF: localF
                          });
                        }
                      }
                    }

                    window.tryAutoAssembleMechParts(activeRidingMech);

                    pendingCollectibleRefresh = true;

                    if (activeRidingMech.position) {
                        const mPos = activeRidingMech.position;
                        const mLen = Math.sqrt(mPos[0]*mPos[0] + mPos[1]*mPos[1] + mPos[2]*mPos[2]) || 1;
                        const mnx = mPos[0] / mLen;
                        const mny = mPos[1] / mLen;
                        const mnz = mPos[2] / mLen;
                        charTheta = Math.acos(Math.max(-1.0, Math.min(1.0, mny)));
                        charPhi = Math.atan2(mnz, mnx);
                        if (charPhi < 0) charPhi += Math.PI * 2;
                    }
                    if (activeRidingMech.F && activeRidingMech.normal) {
                        const North = [-Math.cos(charTheta) * Math.cos(charPhi), Math.sin(charTheta), -Math.cos(charTheta) * Math.sin(charPhi)];
                        const East = [-Math.sin(charPhi), 0, Math.cos(charPhi)];
                        const fNorth = activeRidingMech.F[0]*North[0] + activeRidingMech.F[1]*North[1] + activeRidingMech.F[2]*North[2];
                        const fEast = activeRidingMech.F[0]*East[0] + activeRidingMech.F[1]*East[1] + activeRidingMech.F[2]*East[2];
                        charHeading = Math.atan2(fEast, fNorth);
                    }
                  }
                } else {
                  chestHoldTimer = 0.0;
                }
                const holdPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
                if (prompt.style.display !== "none") {
                    prompt.style.display = "none";
                }
                if (typeof World3DUI !== "undefined") {
                    let batteryPercent = 0;
                    if (typeof window.BatterySystem !== "undefined") {
                      const stats = window.BatterySystem.getStats();
                      if (stats.readyCount > 0 && stats.activeBattery) {
                        batteryPercent = Math.max(0, Math.min(100, (stats.activeBattery.charge / window.BatterySystem.MAX_CHARGE) * 100));
                      }
                    }

                    World3DUI.updateMechRideUI({
                      mech: closestMech,
                      targetPos: closestMechTargetPos,
                      playerScale: playerScale,
                      holdPercent: holdPercent,
                      isDismount: false,
                      batteryPercent: batteryPercent,
                      hasBattery: false
                    });
                }
              } else if (activeInteractDoor && activeInteractDoor.isLocked) {
                if (typeof World3DUI !== "undefined") { World3DUI.hideBoatUI(); World3DUI.hideMechRideUI(); }
                chestHoldTimer = 0.0;
                const dNorm = activeInteractDoor.normal || [0, 1, 0];
                const doorTargetPos = [
                  activeInteractDoor.position[0] + dNorm[0] * 0.12,
                  activeInteractDoor.position[1] + dNorm[1] * 0.12,
                  activeInteractDoor.position[2] + dNorm[2] * 0.12
                ];
                const screenPos = projectWorldToScreen(
                  doorTargetPos,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const actionName = "🔒 ประตูล็อคอยู่ (DOOR LOCKED)";
                  if (prompt._lastText !== actionName) {
                    prompt.textContent = actionName;
                    prompt._lastText = actionName;
                  }
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 20 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                    prompt.style.transform = newT;
                    prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
                }
              } else if (activeInteractWindow) {
                if (typeof World3DUI !== "undefined") { World3DUI.hideBoatUI(); World3DUI.hideMechRideUI(); }
                chestHoldTimer = 0.0;
                const screenPos = projectWorldToScreen(
                  activeInteractWindow.position,
                  viewMatrix,
                  projMatrix,
                  window.innerWidth,
                  window.innerHeight,
                );
                if (screenPos) {
                  const interactBtn = (typeof window.GamepadController !== "undefined" && typeof window.GamepadController.getButtonLabel === "function") 
                    ? window.GamepadController.getButtonLabel("interact") 
                    : "LB";
                  const currentAngle = activeInteractWindow.windowAngle || 0.0;
                  const actionName = (currentAngle < 0.78) ? `เปิดหน้าต่าง (Hold ${interactBtn})` : `ปิดหน้าต่าง (Hold ${interactBtn})`;
                  const _newText_2 = actionName;
if (prompt._lastText !== _newText_2) {
    prompt.textContent = _newText_2;
    prompt._lastText = _newText_2;
}
                  if (prompt.style.display !== "block") prompt.style.display = "block";
                  const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 20 )}px) translate(-50%, -100%)`;
                  if (prompt._lastT !== newT) {
                      prompt.style.transform = newT;
                      prompt._lastT = newT;
                  }
                } else {
                  if (prompt.style.display !== "none") prompt.style.display = "none";
            }
          } else {
                chestHoldTimer = 0.0;
                if (prompt.style.display !== "none") prompt.style.display = "none";
                if (typeof World3DUI !== "undefined" && !activeRidingBoat && !closestBoat) {
                    World3DUI.hideBoatUI();
                }
                if (typeof World3DUI !== "undefined" && !activeRidingMech && !closestMech) {
                    World3DUI.hideMechRideUI();
                }
              }
            }
          }
        }

        // Mech Stand System 8-Slot UI Update
        let nearbyStand = null;
        let standParts = [];
        let bestStandDistSq = 0.64; // within 0.8 meters

        if (activeRidingMech) {
          if (activeRidingMech.dockedStand) {
            nearbyStand = activeRidingMech.dockedStand;
          } else {
            nearbyStand = null; // Undocked mech walking freely -> hide stand UI
          }
        } else if (typeof collectibles !== "undefined" && Array.isArray(collectibles)) {
          let player3D = [0, 0, 0];
          if (typeof charTheta !== "undefined" && typeof charPhi !== "undefined") {
            const pRad = (typeof RADIUS !== "undefined" ? RADIUS : 100) + (typeof getHeightOnSphere === "function" ? getHeightOnSphere(charTheta, charPhi, typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0) * (typeof HEIGHT_SCALE !== "undefined" ? HEIGHT_SCALE : 1) : 0);
            player3D = [
              Math.sin(charTheta) * Math.cos(charPhi) * pRad,
              Math.cos(charTheta) * pRad,
              Math.sin(charTheta) * Math.sin(charPhi) * pRad
            ];
          }

          const candidateStands = (typeof SpatialGrid !== "undefined")
            ? SpatialGrid.queryRadius(player3D[0], player3D[1], player3D[2], 1.5, item => item.active && !item.isPreview && item.type === "robot_stand")
            : collectibles;

          for (let item of candidateStands) {
            if (item.active && !item.isPreview && item.type === "robot_stand") {
              
              // [PATCH] Lock stand if a mech is currently undocked from it
              let isLocked = false;
              if (typeof collectibles !== "undefined") {
                 isLocked = collectibles.some(c => c.active && c.type === "robot_cockpit" && c._undockedFromStand === item && !c.dockedStand);
              }
              if (isLocked) continue;

              const dx = item.position[0] - player3D[0];
              const dy = item.position[1] - player3D[1];
              const dz = item.position[2] - player3D[2];
              const distSq = dx*dx + dy*dy + dz*dz;
              if (distSq < bestStandDistSq) {
                bestStandDistSq = distSq;
                nearbyStand = item;
              }
            }
          }
        }

        if (nearbyStand) {
          const candidateParts = (typeof SpatialGrid !== "undefined")
            ? SpatialGrid.queryRadius(nearbyStand.position[0], nearbyStand.position[1], nearbyStand.position[2], 2.45, p => p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand")
            : collectibles;
          for (let p of candidateParts) {
            if (p.active && !p.isPreview && p.type.startsWith("robot_") && p.type !== "robot_stand") {
              const dx = p.position[0] - nearbyStand.position[0];
              const dy = p.position[1] - nearbyStand.position[1];
              const dz = p.position[2] - nearbyStand.position[2];
              if (dx*dx + dy*dy + dz*dz < 6.0) {
                standParts.push(p);
              }
            }
          }

          // If riding a docked mech, guarantee cockpit and attached parts are included in UI
          if (activeRidingMech && activeRidingMech.dockedStand === nearbyStand) {
            if (activeRidingMech.active && !activeRidingMech.isPreview && !standParts.includes(activeRidingMech)) {
              standParts.push(activeRidingMech);
            }
            if (activeRidingMech.attachedParts) {
              for (let entry of activeRidingMech.attachedParts) {
                if (entry && entry.item && entry.item.active && !entry.item.isPreview && !standParts.includes(entry.item)) {
                  standParts.push(entry.item);
                }
              }
            }
          }
        }


        let standHoldPercent = 0;
        if (activeRidingMech && activeRidingMech.dockedStand) {
           standHoldPercent = Math.min(100, Math.floor(((activeRidingMech._undockHoldTimer || 0) / 0.35) * 100));
        } else if (activeRidingMech && activeRidingMech._nearbyStand) {
           standHoldPercent = Math.min(100, Math.floor(((activeRidingMech._dockingTimer || 0) / 0.8) * 100));
        } else if (typeof chestHoldTimer !== "undefined" && chestHoldTimer > 0) {
           standHoldPercent = Math.min(100, Math.floor((chestHoldTimer / 0.8) * 100));
        }

        if (nearbyStand || window._hadNearbyStand !== false) {
          if (typeof window.updateMechStandUI === "function") {
            window.updateMechStandUI(nearbyStand, standParts);
          }
          if (typeof World3DUI !== "undefined") {
            if (nearbyStand) {
              World3DUI.updateMechStandUI({
                stand: nearbyStand,
                parts: standParts,
                playerScale: playerScale,
                holdPercent: standHoldPercent
              });

              
              // Switch to FPS camera when near the stand
              if (window._prevCameraModeForStand === undefined) {
                window._prevCameraModeForStand = window.cameraMode || "thirdperson";
                if (typeof window.setCameraMode === "function") {
                  window.setCameraMode("fps");
                }
              }
            } else {
              World3DUI.hideMechStandUI();
              
              // Revert to previous camera mode when leaving the stand
              if (window._prevCameraModeForStand !== undefined) {
                const prevStandMode = window._prevCameraModeForStand;
                window._prevCameraModeForStand = undefined;
                if (activeRidingMech) {
                  // ถ้ากำลังขับหุ่นยนต์ แล้วเดิมเป็น tps ให้สลับเป็นมุมมองที่ 3 (fps ไม่เกี่ยว)
                  if (prevStandMode === "tps") {
                    window._prevMechCameraMode = "tps";
                    if (typeof window.setCameraMode === "function") {
                      window.setCameraMode("thirdperson");
                    }
                  } else if (typeof window.setCameraMode === "function") {
                    window.setCameraMode(prevStandMode);
                  }
                } else {
                  if (typeof window.setCameraMode === "function") {
                    window.setCameraMode(prevStandMode);
                  }
                }
              }
            }
          }
          window._hadNearbyStand = !!nearbyStand;
        }

        // Check distance to closest alive NPC for Kill Prompt
        if (!_cachedNpcPrompt) _cachedNpcPrompt = document.getElementById("npcKillPrompt");
        const npcPrompt = _cachedNpcPrompt;
        if (npcPrompt) {
          const px = charTheta;
          const py = charPhi;
          const r_terrain = RADIUS + getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0)) * HEIGHT_SCALE;
          const r = typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null ? playerCenterRadius - 0.46 * playerScale : r_terrain;
          const pVec = [
            r * Math.sin(px) * Math.cos(py),
            r * Math.cos(px),
            r * Math.sin(px) * Math.sin(py),
          ];

          let closestNPCLocal = null;
          let minDistSq = Infinity;
          if (amphibians && amphibians.length > 0) {
            for (let npc of amphibians) {
              if ((npc.type === 'meganeura' || npc.type === 'isopod' || npc.type === 'obsidian_cube') && !npc.ragdollEnabled) continue;
              if (npc.type !== 'meganeura' && npc.type !== 'isopod' && npc.type !== 'obsidian_cube' && npc.type !== 'human' && !isDevMode) continue;
              if (npc.type !== 'meganeura' && npc.type !== 'isopod' && npc.type !== 'obsidian_cube' && npc.ragdollEnabled) continue;

              const pos = npc.ragdollPos || npc.position;
              if (!pos) continue;
              const dx = pVec[0] - pos[0];
              const dy = pVec[1] - pos[1];
              const dz = pVec[2] - pos[2];
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < 0.25) {
                if (distSq < minDistSq) {
                  minDistSq = distSq;
                  closestNPCLocal = npc;
                }
              }
            }
          }

          if (closestNPCLocal) {
            activeInteractNPC = closestNPCLocal;
            const screenPos = projectWorldToScreen(
              closestNPCLocal.ragdollPos || closestNPCLocal.position,
              viewMatrix,
              projMatrix,
              window.innerWidth,
              window.innerHeight,
            );
            if (screenPos) {
              const keyText = currentKeyBindings.interact
                .replace("Key", "")
                .replace("Arrow", "");
              if (closestNPCLocal.type === 'meganeura') {
                const _newHtml_9 = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>[${keyText}] เก็บแมลง (Pick up bug)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_9) {
    npcPrompt.innerHTML = _newHtml_9;
    npcPrompt._lastHTML = _newHtml_9;
}
              } else if (closestNPCLocal.type === 'isopod') {
                const _newHtml_10 = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>[${keyText}] เก็บไอโซพอด (Pick up Isopod)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_10) {
    npcPrompt.innerHTML = _newHtml_10;
    npcPrompt._lastHTML = _newHtml_10;
}
              } else if (closestNPCLocal.type === 'obsidian_cube') {
                const _newHtml_obsidian = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>[${keyText}] เก็บศิลาออบซิเดียน (Pick up Obsidian Cube)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_obsidian) {
    npcPrompt.innerHTML = _newHtml_obsidian;
    npcPrompt._lastHTML = _newHtml_obsidian;
}
              } else {
                const _newHtml_11 = `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <path d="M9 10h.01M15 10h.01"></path>
                      <path d="M12 2a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z"></path>
                      <path d="M10 17v3M14 17v3"></path>
                    </svg>
                    <span>[${keyText}] กำจัด NPC (Kill NPC)</span>
                  </span>
                `;
if (npcPrompt._lastHTML !== _newHtml_11) {
    npcPrompt.innerHTML = _newHtml_11;
    npcPrompt._lastHTML = _newHtml_11;
}
              }
              if (npcPrompt.style.display !== "block") npcPrompt.style.display = "block";
              const newT = `translate(${Math.round(screenPos.x)}px, ${Math.round(screenPos.y - 40 )}px) translate(-50%, -100%)`;
              if (npcPrompt._lastT !== newT) {
                  npcPrompt.style.transform = newT;
                  npcPrompt._lastT = newT;
              }
            } else {
              if (npcPrompt.style.display !== "none") npcPrompt.style.display = "none";
            }
          } else {
            if (npcPrompt.style.display !== "none") npcPrompt.style.display = "none";
            activeInteractNPC = null;
          }
        }

        // Update Bow / Arm Cannon 3D Aiming & Target Lock via World3DUI
        const isAimingRanged = (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") &&
          isUsingItem && activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON");

        if (isAimingRanged) {
            const p_x = playerCenterRadius * nx;
            const p_y = playerCenterRadius * ny;
            const p_z = playerCenterRadius * nz;

            let currentTargetStillValid = false;

            // 1. If we already have a locked target, check if it's still valid
            if (activeTargetNPC) {
                const npc = activeTargetNPC;
                const exists = typeof amphibians !== 'undefined' && amphibians.includes(npc);
                if (exists && !npc.ragdollEnabled && npc.position) {
                    const tPos = getNPCTargetPoint(npc);
                    const dx = p_x - tPos[0];
                    const dy = p_y - tPos[1];
                    const dz = p_z - tPos[2];
                    const distSq = dx * dx + dy * dy + dz * dz;

                    const maxBreakDist = bowLockDistance * 1.15;
                    const isWithinRange = distSq < maxBreakDist * maxBreakDist;
                    const isOccluded = typeof checkPlanetOcclusion === "function" && checkPlanetOcclusion(eyePos, tPos, RADIUS);

                    if (isWithinRange && !isOccluded) {
                        currentTargetStillValid = true;
                    }
                }
            }

            if (!currentTargetStillValid) {
                activeTargetNPC = null;
            }

            // 2. Look for closest target to screen center using true 3D chest position
            if (!activeTargetNPC && typeof amphibians !== 'undefined' && amphibians.length > 0) {
                let minScreenDistSq = Infinity;
                let closest = null;
                const halfW = window.innerWidth / 2;
                const halfH = window.innerHeight / 2;
                const maxScreenRadius = Math.min(window.innerWidth, window.innerHeight) * 0.45;

                for (let npc of amphibians) {
                    if (npc.ragdollEnabled || !npc.position) continue;

                    const tPos = getNPCTargetPoint(npc);
                    const dx = p_x - tPos[0];
                    const dy = p_y - tPos[1];
                    const dz = p_z - tPos[2];
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < bowLockDistance * bowLockDistance) {
                        if (typeof checkPlanetOcclusion === "function" && checkPlanetOcclusion(eyePos, tPos, RADIUS)) {
                            continue;
                        }
                        const screenPos = projectWorldToScreen(
                            tPos,
                            viewMatrix,
                            projMatrix,
                            window.innerWidth,
                            window.innerHeight
                        );
                        if (screenPos) {
                            const sdx = screenPos.x - halfW;
                            const sdy = screenPos.y - halfH;
                            const sDistSq = sdx * sdx + sdy * sdy;
                            if (sDistSq < maxScreenRadius * maxScreenRadius && sDistSq < minScreenDistSq) {
                                minScreenDistSq = sDistSq;
                                closest = npc;
                            }
                        }
                    }
                }
                activeTargetNPC = closest;
            }

            // 3. Compute 3D target point in world space
            let aimTargetWorld = null;
            let isLocked = false;

            if (activeTargetNPC) {
                aimTargetWorld = getNPCTargetPoint(activeTargetNPC);
                isLocked = true;
            } else {
                // Free aim: raymarch forward along camera look vector to find terrain hit point
                const camLookDir = [-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]];
                let curD = 0.5;
                const maxD = 40.0;
                const step = 0.4;
                while (curD < maxD) {
                    const testP = [
                        eyePos[0] + camLookDir[0] * curD,
                        eyePos[1] + camLookDir[1] * curD,
                        eyePos[2] + camLookDir[2] * curD
                    ];
                    const dC = Math.hypot(testP[0], testP[1], testP[2]);
                    if (dC > 0.01) {
                        const ux = testP[0] / dC, uy = testP[1] / dC, uz = testP[2] / dC;
                        const theta = Math.acos(Math.max(-1.0, Math.min(1.0, uy)));
                        const phi = Math.atan2(uz, ux);
                        const h = getHeightOnSphere(theta, phi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
                        const tRad = RADIUS + h * HEIGHT_SCALE;
                        const wRad = RADIUS + (typeof waterLevel !== "undefined" ? waterLevel * 0.15 : 0);
                        const checkR = (typeof waterEnabled !== "undefined" && waterEnabled) ? Math.max(tRad, wRad) : tRad;
                        if (dC <= checkR + 0.08) {
                            aimTargetWorld = testP;
                            break;
                        }
                    }
                    curD += step;
                }
                if (!aimTargetWorld) {
                    aimTargetWorld = [
                        eyePos[0] + camLookDir[0] * 25.0,
                        eyePos[1] + camLookDir[1] * 25.0,
                        eyePos[2] + camLookDir[2] * 25.0
                    ];
                }
                isLocked = false;
            }

            window.currentAimTargetPos = aimTargetWorld;
            window.isAimTargetLocked = isLocked;

            // Update Genuine 3D Target Reticle in World3DUI (3d_ui.js)
            if (typeof World3DUI !== "undefined") {
                World3DUI.updateAimReticle({
                    targetPos: aimTargetWorld,
                    isLocked: isLocked,
                    cameraPos: eyePos,
                    cameraUp: [viewMatrix[1], viewMatrix[5], viewMatrix[9]]
                });
            }

            // Hide legacy 2D HTML target elements
            if (!_cachedTargetCircle) _cachedTargetCircle = document.getElementById("targetCircle");
            if (_cachedTargetCircle && _cachedTargetCircle.style.display !== "none") {
                _cachedTargetCircle.style.display = "none";
            }
            if (!_cachedBowCrosshair) _cachedBowCrosshair = document.getElementById("bowCrosshair");
            if (_cachedBowCrosshair && _cachedBowCrosshair.style.display !== "none") {
                _cachedBowCrosshair.style.display = "none";
            }
        } else {
            activeTargetNPC = null;
            if (!isDemolishModeEnabled) {
                window.currentAimTargetPos = null;
                window.isAimTargetLocked = false;
                if (typeof World3DUI !== "undefined") {
                    World3DUI.hideAimReticle();
                }
            }
            if (!_cachedTargetCircle) _cachedTargetCircle = document.getElementById("targetCircle");
            if (_cachedTargetCircle && _cachedTargetCircle.style.display !== "none") {
                _cachedTargetCircle.style.display = "none";
            }
            if (!_cachedBowCrosshair) _cachedBowCrosshair = document.getElementById("bowCrosshair");
            if (_cachedBowCrosshair && _cachedBowCrosshair.style.display !== "none") {
                _cachedBowCrosshair.style.display = "none";
            }
        }

        // ==========================================
        // PASS 1: SHADOW DEPTH MAP RENDER
        // ==========================================
        const curTerrainDist = typeof terrainRenderDistValue !== "undefined"
          ? terrainRenderDistValue
          : (typeof window !== "undefined" && typeof window.terrainRenderDistValue !== "undefined"
            ? window.terrainRenderDistValue
            : renderDistValue);

        const curObjectDist = typeof objectRenderDistValue !== "undefined"
          ? objectRenderDistValue
          : (typeof window !== "undefined" && typeof window.objectRenderDistValue !== "undefined"
            ? window.objectRenderDistValue
            : renderDistValue);

        let shadowTargetX = px, shadowTargetY = py, shadowTargetZ = pz;
        let camPlayerDist = 10.0;
        if (typeof eyePos !== "undefined" && eyePos) {
          const dx = eyePos[0] - px;
          const dy = eyePos[1] - py;
          const dz = eyePos[2] - pz;
          camPlayerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        let orthoSize = Math.min(22.0, Math.max(5.0, Math.min(curObjectDist + 2.0, camPlayerDist * 0.5 + 2.5)));

        const lightTarget = [shadowTargetX, shadowTargetY, shadowTargetZ];
        let lightDistance = RADIUS + 8.0;
        let lightFarPlane = RADIUS * 2.5 + 8.0;
        if (cameraMode !== "planet" && cameraMode !== "sun") {
            lightDistance = 30.0;
            lightFarPlane = 60.0;
        }
        const lightEye = [
          shadowTargetX + finalLightDir[0] * lightDistance,
          shadowTargetY + finalLightDir[1] * lightDistance,
          shadowTargetZ + finalLightDir[2] * lightDistance,
        ];
        const lightUp =
          Math.abs(finalLightDir[1]) > 0.99 ? [0.0, 0.0, 1.0] : [0.0, 1.0, 0.0];
        const lightViewMatrix = createLookAt(lightEye, lightTarget, lightUp);
        const lightProjMatrix = createOrtho(-orthoSize, orthoSize, -orthoSize, orthoSize, 0.1, lightFarPlane);
        const lightSpaceMatrix = multiplyMatrices(
          lightProjMatrix,
          lightViewMatrix,
        );

                const timeVal = typeof cloudAnimTime !== 'undefined' ? cloudAnimTime * 0.05 : 0;
        const waterRad = typeof waterRadius !== 'undefined' ? waterRadius : 0.0;
        const gasVal = typeof skyGasIntensity !== 'undefined' ? skyGasIntensity : 0.75;
        
        Graphics.multiplyMatrices4(projMatrix, viewMatrix, f32_gpuViewProj);
        Graphics.invertMatrix4(f32_gpuViewProj, f32_invViewProj);
        window.gpuViewProj = f32_gpuViewProj;
        window.invViewProj = f32_invViewProj;
        
        if (shadowMapEnabled) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFramebuffer);
          gl.viewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
          gl.clearColor(1.0, 1.0, 1.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          gl.enable(gl.DEPTH_TEST);
          gl.disable(gl.BLEND);
          gl.disable(gl.CULL_FACE); // Draw both faces into shadow map to prevent missing shadows from wrong windings

          gl.useProgram(depthProgram);
        gl.uniformMatrix4fv(
          depthLightSpaceLoc,
          false,
          setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
        );
        gl.uniform1f(depthTimeLoc, leafAnimTime);
        gl.uniform1f(depthPlanetRadiusLoc, RADIUS);
        gl.uniform1f(depthWaterRadiusLoc, RADIUS + waterLevel * 0.15);

        // Terrain to depth
        if (typeof SurfaceSystem !== "undefined" && SurfaceSystem.drawSurfaceDepth) {
          SurfaceSystem.drawSurfaceDepth(gl, {
            vertexBuffer,
            indexBuffer,
            indicesLength,
            supportUint32,
            depthSwayFactorLoc,
            depthWaterSwayFactorLoc,
            depthModelLoc,
            depthPosLoc,
            createIdentity
          });
        }

        // Cubes to depth (Cull by object render distance)
        if (cubeVertexBuffer && cubeIndexBuffer && cubeIndicesLength > 0) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            f32_identity,
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
          const isUint32 = supportUint32 && cubeIndicesLength > 65535;
          const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          const bytesPerIndex = isUint32 ? 4 : 2;

          if (cubeObstacles && cubeObstacles.length > 0 && typeof getVisibleIndexRanges === "function" && eyePos) {
            const shadowRanges = getVisibleIndexRanges(cubeObstacles, null, curObjectDist, eyePos);
            for (let i = 0; i < shadowRanges.length; i++) {
              const range = shadowRanges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            if (isUint32) {
              gl.drawElements(
                gl.TRIANGLES,
                cubeIndicesLength,
                gl.UNSIGNED_INT,
                0,
              );
            } else {
              gl.drawElements(
                gl.TRIANGLES,
                cubeIndicesLength,
                gl.UNSIGNED_SHORT,
                0,
              );
            }
          }
        }

        // Nature / tree objects to depth (Cull by object render distance)
        if (typeof TreeSystem !== "undefined" && TreeSystem.drawTreeDepth) {
          TreeSystem.drawTreeDepth(gl, {
            natureVertexBuffer,
            natureIndexBuffer,
            natureColorBuffer,
            natureIndicesLength,
            natureGrassStartIndex,
            supportUint32,
            depthSwayFactorLoc,
            depthWaterSwayFactorLoc,
            depthModelLoc,
            depthPosLoc,
            depthColorLoc,
            natureSway,
            waterPlantSway,
            createIdentity,
            natureObstacles,
            grassChunks,
            eyePos,
            renderDistValue: curObjectDist
          });
          if (depthColorLoc >= 0) {
            gl.disableVertexAttribArray(depthColorLoc);
          }
        }
        
        if (typeof GrassSystem !== "undefined" && GrassSystem.drawGrassDepth) {
          GrassSystem.drawGrassDepth(gl, {
            natureVertexBuffer,
            natureIndexBuffer,
            natureColorBuffer,
            natureIndicesLength,
            natureGrassStartIndex,
            supportUint32,
            grassChunks,
            eyePos,
            renderDistValue: curObjectDist
          });
        }

        // Collectibles to depth (Cull by object render distance)
        if (
          collectibleVertexBuffer &&
          collectibleIndexBuffer &&
          collectibleIndicesLength > 0
        ) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            f32_identity,
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
          const isUint32 = supportUint32 && collectibleIndicesLength > 65535;
          const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          const bytesPerIndex = isUint32 ? 4 : 2;

          if (collectibles && collectibles.length > 0 && typeof getVisibleIndexRanges === "function" && eyePos) {
            const shadowRanges = getVisibleIndexRanges(collectibles, null, curObjectDist, eyePos);
            for (let i = 0; i < shadowRanges.length; i++) {
              const range = shadowRanges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              collectibleIndicesLength,
              type,
              0,
            );
          }
        }

        // Dynamic Collectibles to depth (Cull by object render distance)
        if (
          dynamicCollectibleVertexBuffer &&
          dynamicCollectibleIndexBuffer &&
          dynamicCollectibleIndicesLength > 0
        ) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            f32_identity,
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
          const isUint32 = supportUint32 && dynamicCollectibleIndicesLength > 65535;
          const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          const bytesPerIndex = isUint32 ? 4 : 2;

          const dynList = (typeof dynamicCollectiblesList !== "undefined" && dynamicCollectiblesList) ? dynamicCollectiblesList : (window.dynamicCollectiblesList || []);
          if (dynList && dynList.length > 0 && typeof getVisibleIndexRanges === "function" && eyePos) {
            const shadowRanges = getVisibleIndexRanges(dynList, null, curObjectDist, eyePos);
            for (let i = 0; i < shadowRanges.length; i++) {
              const range = shadowRanges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              dynamicCollectibleIndicesLength,
              type,
              0,
            );
          }
        }

        if (activeRidingBoat && typeof drawDedicatedActiveBoatShadow === "function") {
          drawDedicatedActiveBoatShadow(gl, depthPosLoc);
        }

        // Amphibians to depth (Cull creatures if outside object render distance)
        if (
          amphibianVertexBuffer &&
          amphibianIndexBuffer &&
          amphibianIndicesLength > 0
        ) {
          let hasNearbyAmphibians = true;
          if (typeof amphibians !== "undefined" && amphibians && amphibians.length > 0 && eyePos) {
            const maxSq = (curObjectDist + 1.0) * (curObjectDist + 1.0);
            hasNearbyAmphibians = amphibians.some(npc => {
              if (npc.hp !== undefined && npc.hp <= 0) return false;
              const pos = npc.position || npc.pos;
              if (!pos) return true;
              const dx = pos[0] - eyePos[0], dy = pos[1] - eyePos[1], dz = pos[2] - eyePos[2];
              return (dx * dx + dy * dy + dz * dz) <= maxSq;
            });
          }

          if (hasNearbyAmphibians) {
            gl.uniform1f(depthSwayFactorLoc, 0.0);
            gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
            gl.uniformMatrix4fv(
              depthModelLoc,
              false,
              f32_identity,
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
            gl.enableVertexAttribArray(depthPosLoc);
            gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
            if (supportUint32 && amphibianIndicesLength > 65535) {
               gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
               gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_SHORT, 0);
            }
          }
        }
        
        // Fire to depth (Cull by object render distance)
        if (
          fireVertexBuffer &&
          fireIndexBuffer &&
          fireIndicesLength > 0
        ) {
          let hasNearbyFire = true;
          if (typeof fireObstacles !== "undefined" && fireObstacles && fireObstacles.length > 0 && eyePos) {
            const maxSq = (curObjectDist + 1.0) * (curObjectDist + 1.0);
            hasNearbyFire = fireObstacles.some(f => {
              const pos = f.position || f.pos;
              if (!pos) return true;
              const dx = pos[0] - eyePos[0], dy = pos[1] - eyePos[1], dz = pos[2] - eyePos[2];
              return (dx * dx + dy * dy + dz * dz) <= maxSq;
            });
          }

          if (hasNearbyFire) {
            gl.uniform1f(depthSwayFactorLoc, 0.0);
            gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
            gl.uniformMatrix4fv(
              depthModelLoc,
              false,
              f32_identity,
            );
            gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
            gl.enableVertexAttribArray(depthPosLoc);
            gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);
            if (supportUint32 && fireIndicesLength > 65535) {
               gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
               gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_SHORT, 0);
            }
          }
        }

        // Character to depth
        if (charVertexBuffer && charIndexBuffer && charIndicesLength > 0) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          const charModelMatrix = getCharacterMatrix();
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            setF32(f32_charModelMatrix, charModelMatrix),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);
          if (supportUint32 && charIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              charIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              charIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }

          // Player clones depth shadow pass
          if (typeof window.renderPlayerClonesShadow === "function") {
            window.renderPlayerClonesShadow(gl, depthModelLoc, charIndicesLength, supportUint32, depthPosLoc);
          }
        }

        // Equip to depth
        if (equipVertexBuffer && equipIndexBuffer && equipIndicesLength > 0) {
          gl.uniform1f(depthSwayFactorLoc, 0.0);
          gl.uniform1f(depthWaterSwayFactorLoc, 0.0);
          const isClassicRag = (ragdollEnabled && ragdollInitialized && (typeof window === "undefined" || window.characterModel !== "chibi"));
          const equipCharModelMatrix = isClassicRag ? createIdentity() : getCharacterMatrix();
          gl.uniformMatrix4fv(
            depthModelLoc,
            false,
            setF32(f32_charModelMatrix, equipCharModelMatrix),
          );
          gl.bindBuffer(gl.ARRAY_BUFFER, equipVertexBuffer);
          gl.enableVertexAttribArray(depthPosLoc);
          gl.vertexAttribPointer(depthPosLoc, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);
          if (supportUint32 && equipIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Bind shadow depth texture to TEXTURE1 for main render pass
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, shadowDepthTexture);
        
        // Bind water mask texture to TEXTURE2 for main render pass
        gl.activeTexture(gl.TEXTURE2);
        const activeWaterMaskTex = typeof WaterSystem !== 'undefined' ? WaterSystem.getMaskTexture() : (typeof waterMaskTex !== 'undefined' ? waterMaskTex : null);
        if (activeWaterMaskTex) {
            gl.bindTexture(gl.TEXTURE_2D, activeWaterMaskTex);
        } else if (dummyColorTex) {
            gl.bindTexture(gl.TEXTURE_2D, dummyColorTex);
        }

        // ==========================================
        // PASS 2: MAIN SCENE RENDER
        // ==========================================

        // สกัดเฉพาะเมทริกซ์การหมุนของกล้อง (Pure 3x3 Rotation View Matrix)
        // ตัด Translation ทิ้งทั้งหมด เพื่อให้ Skybox และวัตถุท้องฟ้าเป็น Infinite Celestial Dome ครอบคลุม 360 องศาทั้งระบบ SpacesMap
        const skyViewMatrix = [
          viewMatrix[0], viewMatrix[1], viewMatrix[2], 0,
          viewMatrix[4], viewMatrix[5], viewMatrix[6], 0,
          viewMatrix[8], viewMatrix[9], viewMatrix[10], 0,
          0, 0, 0, 1
        ];

        // วาดท้องฟ้าอวกาศเนบิวลากลุ่มก๊าซ (Cosmic Deep Space Skybox)
        if (
          skyEnabled &&
          skyVertexBuffer &&
          skyIndexBuffer &&
          skyIndicesLength > 0
        ) {
            gl.useProgram(skyProgram);

            gl.uniformMatrix4fv(
              skyMVLoc,
              false,
              setF32(f32_modelViewMatrix, skyViewMatrix),
            );
            gl.uniformMatrix4fv(skyProjLoc, false, setF32(f32_projMatrix, projMatrix));
            gl.uniform1f(skyTimeLoc, cloudAnimTime * 0.05);
            gl.uniform1f(skyGasIntensityLoc, skyGasIntensity);
            if (skyCameraPosLoc) gl.uniform3fv(skyCameraPosLoc, setF32(f32_eyePos, eyePos));
            if (skyWaterRadiusLoc) gl.uniform1f(skyWaterRadiusLoc, isSpaceCameraMode ? 0.0 : waterRadius);

            gl.depthMask(false);
            const prevDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
            gl.depthFunc(gl.LEQUAL);
            const prevCull = gl.isEnabled(gl.CULL_FACE);
            if (prevCull) gl.disable(gl.CULL_FACE);

            gl.bindBuffer(gl.ARRAY_BUFFER, skyVertexBuffer);
            gl.enableVertexAttribArray(skyPosLoc);
            gl.vertexAttribPointer(skyPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);

            if (supportUint32 && skyIndicesLength > 65535) {
              gl.drawElements(gl.TRIANGLES, skyIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
              gl.drawElements(
                gl.TRIANGLES,
                skyIndicesLength,
                gl.UNSIGNED_SHORT,
                0,
              );
            }

            if (prevCull) gl.enable(gl.CULL_FACE);
            gl.depthFunc(prevDepthFunc || gl.LESS);
            gl.depthMask(true);
        }

        // ============================================
        // วาดดาวบริวาร (ดวงจันทร์ 3D Noise) เด่นชัดกลางท้องฟ้าดาวหลัก มองเห็นด้วยตาเปล่าทันที
        // ============================================
        const satVBO = window.satelliteVertexBuffer;
        const satCBO = window.satelliteColorBuffer;
        const satIBO = window.satelliteIndexBuffer;
        const satLen = window.satelliteIndicesLength || 0;

        if (satVBO && satCBO && satIBO && satLen > 0) {
          const satProg = sunProgram || modelProgram;
          if (satProg) {
            gl.useProgram(satProg);
            const posLoc = (satProg === sunProgram && sunPosLoc !== -1) ? sunPosLoc : modelPosLoc;
            const colLoc = (satProg === sunProgram && sunColorLoc !== -1) ? sunColorLoc : modelColorLoc;
            const mvLoc = (satProg === sunProgram && sunMVLoc) ? sunMVLoc : modelMVLoc;
            const projLoc = (satProg === sunProgram && sunProjLoc) ? sunProjLoc : modelProjLoc;

            const sunTime = typeof globalTime !== "undefined" ? globalTime : (waterTime || performance.now() / 1000);
            if (satProg === sunProgram) {
              if (sunIsSunLoc) gl.uniform1f(sunIsSunLoc, 1.0);
              if (sunTimeLoc) gl.uniform1f(sunTimeLoc, sunTime);
              if (sunTintLoc) gl.uniform3f(sunTintLoc, 1.0, 1.0, 1.0);
            } else if (modelLightDirLoc) {
              setF32(f32_finalLightDir, finalLightDir);
              gl.uniform3fv(modelLightDirLoc, f32_finalLightDir);
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, satVBO);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, satCBO);
            gl.enableVertexAttribArray(colLoc);
            gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, satIBO);

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

            const makeScale = (typeof createScale === "function") ? createScale : (sx, sy, sz) => [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
            const sScaleMat = makeScale(satScaleVal, satScaleVal, satScaleVal);
            const sTransMat = createTranslation(satPos[0], satPos[1], satPos[2]);
            const satModelMatrix = multiplyMatrices(sTransMat, sScaleMat);
            
            // ใช้ viewMatrix ในโหมดกล้องพระอาทิตย์ เพื่อให้กล้องสามารถเข้าใกล้/โคจรรอบโมเดลของจริงได้
            const activeSatViewMatrix = cameraMode === "sun" ? viewMatrix : skyViewMatrix;
            const satMV = multiplyMatrices(activeSatViewMatrix, satModelMatrix);

            setF32(f32_modelViewMatrix, satMV);
            setF32(f32_projMatrix, projMatrix);
            gl.uniformMatrix4fv(mvLoc, false, f32_modelViewMatrix);
            gl.uniformMatrix4fv(projLoc, false, f32_projMatrix);

            gl.enable(gl.CULL_FACE);
            gl.frontFace(gl.CW);
            gl.cullFace(gl.BACK);

            if (supportUint32 && satLen > 65535) {
              gl.drawElements(gl.TRIANGLES, satLen, gl.UNSIGNED_INT, 0);
            } else {
              gl.drawElements(gl.TRIANGLES, satLen, gl.UNSIGNED_SHORT, 0);
            }
          }
        }

        // ============================================
        // วาดดาวบริวารดวงอื่นๆ ในระบบสุริยะ SpacesMap ( Celestial Neighbor Planets - ไม่ล็อคตามกล้อง )
        // ============================================
        if (window.EXTRA_PLANETS && Array.isArray(window.EXTRA_PLANETS) && window.EXTRA_PLANETS.length > 0) {
          const extraProg = modelProgram || sunProgram;
          if (extraProg) {
            gl.useProgram(extraProg);
            const posLoc = (modelPosLoc !== -1) ? modelPosLoc : sunPosLoc;
            const colLoc = (modelColorLoc !== -1) ? modelColorLoc : sunColorLoc;
            const mvLoc = modelMVLoc || sunMVLoc;
            const projLoc = modelProjLoc || sunProjLoc;

            if (modelLightDirLoc) {
              setF32(f32_finalLightDir, finalLightDir);
              gl.uniform3fv(modelLightDirLoc, f32_finalLightDir);
            }

            setF32(f32_projMatrix, projMatrix);
            gl.uniformMatrix4fv(projLoc, false, f32_projMatrix);

            gl.enable(gl.CULL_FACE);
            gl.frontFace(gl.CW);
            gl.cullFace(gl.BACK);

            // ดึงรายชื่อดาวบริวารที่ไม่ใช่ดาว Active ปัจจุบันเพื่อวาดขึ้นท้องฟ้า
            const nonActivePlanetIds = (window.SpacesMap && window.SpacesMap.allPlanets)
              ? Object.keys(window.SpacesMap.allPlanets).filter(id => id !== window.SpacesMap.activePlanetId)
              : [6, 7, 8, 9, 10].map(n => `planet_${n}`);

            for (let i = 0; i < nonActivePlanetIds.length; i++) {
              const targetPlanetId = nonActivePlanetIds[i];
              const epMesh = window.EXTRA_PLANETS[i % window.EXTRA_PLANETS.length];

              if (epMesh && epMesh.vbo && epMesh.cbo && epMesh.ibo && epMesh.indicesLength > 0) {
                let epPos = [800.0, 0.0, 0.0];
                let epScaleVal = 25.0;

                if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
                  const cel = window.SpacesMap.getCelestialTransform(targetPlanetId);
                  if (cel) {
                    epPos = cel.pos;
                    epScaleVal = cel.scale;
                  }
                } else if (epMesh.pos) {
                  epPos = epMesh.pos;
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, epMesh.vbo);
                gl.enableVertexAttribArray(posLoc);
                gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ARRAY_BUFFER, epMesh.cbo);
                gl.enableVertexAttribArray(colLoc);
                gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, epMesh.ibo);

                const makeScale = (typeof createScale === "function") ? createScale : (sx, sy, sz) => [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
                const scaleMat = makeScale(epScaleVal, epScaleVal, epScaleVal);
                const transMat = createTranslation(epPos[0], epPos[1], epPos[2]);
                const epModelMatrix = multiplyMatrices(transMat, scaleMat);
                
                const activeEpViewMatrix = cameraMode === "sun" ? viewMatrix : skyViewMatrix;
                const epMV = multiplyMatrices(activeEpViewMatrix, epModelMatrix);

                setF32(f32_modelViewMatrix, epMV);
                gl.uniformMatrix4fv(mvLoc, false, f32_modelViewMatrix);

                if (supportUint32 && epMesh.indicesLength > 65535) {
                  gl.drawElements(gl.TRIANGLES, epMesh.indicesLength, gl.UNSIGNED_INT, 0);
                } else {
                  gl.drawElements(gl.TRIANGLES, epMesh.indicesLength, gl.UNSIGNED_SHORT, 0);
                }
              }
            }
          }
        }
        
        // ---- DISABLE BLENDING FOR OPAQUE PASSES ----
        // To maximize GPU performance, disable alpha blending when rendering opaque geometry
        gl.disable(gl.BLEND);

        // วาดพื้นผิวโลก (Planet) - มีการคำนวณแสงเงาเคลื่อนที่ตามดวงอาทิตย์อย่างสวยงาม
        if (cameraMode !== "sun" && vertexBuffer && colorBuffer && indexBuffer && indicesLength > 0) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);

          gl.useProgram(program);
          gl.uniform1f(gl.getUniformLocation(program, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);
          gl.uniform1f(useLightingLoc, 1.0); // เปิดแสงเงาดิฟฟิวส์
          gl.uniform3fv(lightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniformMatrix4fv(
            modelViewLoc,
            false,
            setF32(f32_modelViewMatrix, modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            projectionLoc,
            false,
            setF32(f32_projMatrix, projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(program, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(program, "uShadowMap"), 1);
          gl.uniform2f(gl.getUniformLocation(program, "uShadowTexelSize"), 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);
          gl.uniform1i(gl.getUniformLocation(program, "uWaterMaskTex"), 2);

          if (Graphics.mode === 'hybrid') { gl.colorMask(false, false, false, false); }
          if (typeof SurfaceSystem !== "undefined" && SurfaceSystem.drawSurface) {
            SurfaceSystem.drawSurface(gl, {
              vertexBuffer,
              colorBuffer,
              indexBuffer,
              indicesLength,
              supportUint32,
              terrainWaterRadiusLoc,
              terrainWaterColorLoc,
              terrainWaterOpacityLoc,
              terrainRenderDistEnabledLoc,
              terrainMaxRenderDistLoc,
              terrainCameraPosLoc,
              waterRadius: RADIUS + waterLevel * 0.15,
              waterColor,
              waterOpacity,
              renderDistEnabled,
              renderDistValue: curTerrainDist,
              positionLoc,
              colorLoc,
              terrainRadiusAttrLoc,
              tunnelCenterAttrLoc,
              tunnelsLoc,
              tunnelCountLoc,
              isTunnelMeshLoc,
              eyePos
            });
          }
          if (Graphics.mode === 'hybrid') { gl.colorMask(true, true, true, true); }

          // Draw 3D Tunnel Spheres (Voxel Mesh & Shell)
          if (typeof CaveSystem !== "undefined" && CaveSystem.drawCave) {
            CaveSystem.drawCave(gl, {
              positionLoc,
              colorLoc,
              isTunnelMeshLoc,
              terrainRadiusAttrLoc,
              tunnelCenterAttrLoc,
              supportUint32
            });
          }

          gl.disable(gl.CULL_FACE);
        }

        // วาดตัวละคร (Character) - คำนวณแสงเงาเคลื่อนตามดวงอาทิตย์
        let springDistance = 3.0;
        if (cameraSpringArm && cameraSpringArm.layers[cameraSpringArm.mode]) {
          springDistance = cameraSpringArm.layers[cameraSpringArm.mode].currentSmoothDistance;
        }
        const minSpringDistToHide = 0.08 * (typeof playerScale !== "undefined" ? (playerScale / 0.22) : 1.0);
        const hideCharacter = (springDistance < minSpringDistToHide);
        if (
          charProgram &&
          charVertexBuffer &&
          charNormalBuffer &&
          charIndexBuffer &&
          charIndicesLength > 0 &&
          cameraMode !== "sun"
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CCW);
          gl.cullFace(gl.BACK);

          gl.useProgram(charProgram);
          gl.uniform1f(gl.getUniformLocation(charProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);

          gl.uniformMatrix4fv(charProjLoc, false, setF32(f32_projMatrix, projMatrix));
          gl.uniform3fv(charLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniform3fv(charCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniformMatrix4fv(
            gl.getUniformLocation(charProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(charProgram, "uShadowMap"), 1);
          gl.uniform2f(gl.getUniformLocation(charProgram, "uShadowTexelSize"), 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);
          gl.uniform1i(gl.getUniformLocation(charProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(charWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(charWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(charWaterOpacityLoc, waterOpacity);

          gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
          gl.enableVertexAttribArray(charPosLoc);
          gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);

          if (charLocalPosLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
            gl.enableVertexAttribArray(charLocalPosLoc);
            gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
          gl.enableVertexAttribArray(charNormLoc);
          gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);

          if (charColorLoc !== -1 && typeof charColorBuffer !== "undefined" && charColorBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
            gl.enableVertexAttribArray(charColorLoc);
            gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
          }
          if (charTexCoordLoc !== -1 && typeof window.charTexCoordBuffer !== "undefined" && window.charTexCoordBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, window.charTexCoordBuffer);
            gl.enableVertexAttribArray(charTexCoordLoc);
            gl.vertexAttribPointer(charTexCoordLoc, 2, gl.FLOAT, false, 0, 0);
          } else if (charTexCoordLoc !== -1) {
            gl.disableVertexAttribArray(charTexCoordLoc);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);

          const charModelMatrix = getCharacterMatrix();

          // Draw main player ONLY if not hidden by player's own camera (FPS mode / camera zoom)
          if (!hideCharacter) {
            if (charUseFaceTexLoc) {
              gl.uniform1f(charUseFaceTexLoc, 0.0);
            }
            if (window.characterModel === "chibi") {
              if ((!window.chibiGlbTexture || typeof window.chibiGlbTexture === "undefined") && typeof window.createChibiGlbTexture === "function") {
                window.createChibiGlbTexture(gl);
              }
            }
            const isDevColorOrBone = !!(typeof window !== "undefined" && (window.devColorByParts || window.devSelectedBone));
            if (window.characterModel === "chibi" && typeof window.chibiGlbTexture !== "undefined" && window.chibiGlbTexture && !isDevColorOrBone) {
              gl.activeTexture(gl.TEXTURE5);
              gl.bindTexture(gl.TEXTURE_2D, window.chibiGlbTexture);
              gl.uniform1i(charMainTexLoc, 5);
              gl.uniform1f(charHasMainTexLoc, 1.0);
            } else {
              gl.uniform1f(charHasMainTexLoc, 0.0);
            }
            const charModelViewMatrix = multiplyMatrices(
              viewMatrix,
              charModelMatrix,
            );

            gl.uniformMatrix4fv(
              charMVLoc,
              false,
              setF32(f32_charModelViewMatrix, charModelViewMatrix),
            );
            gl.uniformMatrix4fv(
              gl.getUniformLocation(charProgram, "uModelMatrix"),
              false,
              setF32(f32_charModelMatrix, charModelMatrix),
            );

            if (supportUint32 && charIndicesLength > 65535) {
              gl.drawElements(
                gl.TRIANGLES,
                charIndicesLength,
                gl.UNSIGNED_INT,
                0,
              );
            } else {
              gl.drawElements(
                gl.TRIANGLES,
                charIndicesLength,
                gl.UNSIGNED_SHORT,
                0,
              );
            }
          }

          // Render independent player clones (Separated from player's camera mode & hideCharacter)
          if (typeof window.renderPlayerClones === "function") {
            window.renderPlayerClones(gl, {
              viewMatrix,
              eyePos,
              charProgram,
              charMVLoc,
              charModelMatrixLoc: gl.getUniformLocation(charProgram, "uModelMatrix"),
              charPosLoc,
              charNormLoc,
              charColorLoc,
              charLocalPosLoc,
              charFaceTexLoc,
              charUseFaceTexLoc,
              charIndicesLength,
              supportUint32
            });
          }

           // Object Cloning: Render a mirrored clone of the player, static structures, trees, rocks, and creatures for each nearby active wood_window (disabled as wood_window is now solid wood)
          const px = charModelMatrix[12];
          const py = charModelMatrix[13];
          const pz = charModelMatrix[14];

          const mirrorCandidates = (typeof SpatialGrid !== "undefined")
            ? SpatialGrid.queryRadius(px, py, pz, 3.0, item => item.active && !item.isPreview && item.type === "wood_window_mirror_disabled")
            : collectibles;

          for (let i = 0; i < mirrorCandidates.length; i++) {
            const item = mirrorCandidates[i];
            if (item.active && item.type === "wood_window_mirror_disabled" && !item.isPreview) {
              const dx = px - item.position[0];
              const dy = py - item.position[1];
              const dz = pz - item.position[2];
              const distSq = dx * dx + dy * dy + dz * dz;

              // Draw clone only if player is within 3.0 meters of the window (distSq < 9.0)
              if (distSq < 9.0) {
                const p = item.position;
                const r = item.R, f = item.F, n = item.normal;
                if (!r || !f || !n) continue;

                const angle = item.angle || 0.0;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);

                // Compute R (right) and F (forward) directions of the window wall
                const wallR = [
                  r[0] * cosA + f[0] * sinA,
                  r[1] * cosA + f[1] * sinA,
                  r[2] * cosA + f[2] * sinA
                ];
                const wallF = [
                  f[0] * cosA - r[0] * sinA,
                  f[1] * cosA - r[1] * sinA,
                  f[2] * cosA - r[2] * sinA
                ];

                const len = Math.hypot(wallF[0], wallF[1], wallF[2]);
                if (len < 0.0001) continue;
                const nx_plane = wallF[0] / len;
                const ny_plane = wallF[1] / len;
                const nz_plane = wallF[2] / len;

                // Center of the glass
                const cx = p[0] + n[0] * 0.125;
                const cy = p[1] + n[1] * 0.125;
                const cz = p[2] + n[2] * 0.125;

                const dot_c_n = cx * nx_plane + cy * ny_plane + cz * nz_plane;

                // Build 4x4 reflection matrix (column-major)
                const R_refl = [
                  1 - 2 * nx_plane * nx_plane,     -2 * nx_plane * ny_plane,        -2 * nx_plane * nz_plane,        0,
                  -2 * nx_plane * ny_plane,        1 - 2 * ny_plane * ny_plane,     -2 * ny_plane * nz_plane,        0,
                  -2 * nx_plane * nz_plane,        -2 * ny_plane * nz_plane,        1 - 2 * nz_plane * nz_plane,     0,
                  2 * dot_c_n * nx_plane,          2 * dot_c_n * ny_plane,          2 * dot_c_n * nz_plane,          1
                ];

                // -------------------------------------------------------------------------
                // A) Use Stencil Buffer to mask the reflections strictly to the window glass!
                // -------------------------------------------------------------------------
                
                if (!windowGlassVertexBuffer) {
                  windowGlassVertexBuffer = gl.createBuffer();
                }
                if (!windowGlassIndexBuffer) {
                  windowGlassIndexBuffer = gl.createBuffer();
                  const cubeIndices = new Uint16Array([
                    0, 2, 1, 0, 3, 2, // bottom
                    4, 5, 6, 4, 6, 7, // top
                    0, 1, 5, 0, 5, 4, // back
                    2, 3, 7, 2, 7, 6, // front
                    0, 7, 3, 0, 4, 7, // left
                    1, 2, 6, 1, 6, 5, // right
                  ]);
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, windowGlassIndexBuffer);
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);
                }

                // Compute 8 corners of the glass pane
                const hw = 0.17 / 2;
                const hh = 0.08 / 2;
                const hd = 0.005 / 2;
                const glassVerts = [];
                const cubeVerts = [
                  [-hw, -hh, -hd],
                  [hw, -hh, -hd],
                  [hw, -hh, hd],
                  [-hw, -hh, hd],
                  [-hw, hh, -hd],
                  [hw, hh, -hd],
                  [hw, hh, hd],
                  [-hw, hh, hd],
                ];
                for (let vi = 0; vi < 8; vi++) {
                  const cv = cubeVerts[vi];
                  const rx = wallR[0] * cv[0] + n[0] * cv[1] + wallF[0] * cv[2];
                  const ry = wallR[1] * cv[0] + n[1] * cv[1] + wallF[1] * cv[2];
                  const rz = wallR[2] * cv[0] + n[2] * cv[1] + wallF[2] * cv[2];
                  glassVerts.push(cx + rx, cy + ry, cz + rz);
                }

                // Upload glass corners
                gl.bindBuffer(gl.ARRAY_BUFFER, windowGlassVertexBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(glassVerts), gl.DYNAMIC_DRAW);

                // Configure stencil to WRITE 1s to the stencil buffer, disabling color/depth writes
                gl.enable(gl.STENCIL_TEST);
                gl.clear(gl.STENCIL_BUFFER_BIT);
                gl.colorMask(false, false, false, false);
                gl.depthMask(false);

                gl.stencilFunc(gl.ALWAYS, 1, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
                gl.stencilMask(0xFF);

                // Draw the glass pane box to the stencil buffer
                gl.useProgram(modelProgram);
                gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_modelViewMatrix, viewMatrix));
                gl.uniformMatrix4fv(modelProjLoc, false, setF32(f32_projMatrix, projMatrix));

                gl.bindBuffer(gl.ARRAY_BUFFER, windowGlassVertexBuffer);
                gl.enableVertexAttribArray(modelPosLoc);
                gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                // Disable color attribute and use a constant (0.0, 0.0, 0.0) so no wind/seaweed sway is applied
                gl.disableVertexAttribArray(modelColorLoc);
                gl.vertexAttrib3f(modelColorLoc, 0.0, 0.0, 0.0);

                if (modelNormalLoc !== -1) {
                  gl.disableVertexAttribArray(modelNormalLoc);
                  gl.vertexAttrib3f(modelNormalLoc, 0.0, 1.0, 0.0);
                }

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, windowGlassIndexBuffer);
                gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

                // Overwrite depth of glass pixels to 1.0 (far plane) in the stencil area so reflections pass depth test
                gl.depthMask(true);
                gl.depthFunc(gl.ALWAYS);
                gl.stencilFunc(gl.EQUAL, 1, 0xFF);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

                // Force projected Z to be 1.0 (far plane)
                setF32(f32_forceZFarProj, projMatrix);
                f32_forceZFarProj[2] = projMatrix[3];
                f32_forceZFarProj[6] = projMatrix[7];
                f32_forceZFarProj[10] = projMatrix[11];
                f32_forceZFarProj[14] = projMatrix[15];

                gl.uniformMatrix4fv(modelProjLoc, false, f32_forceZFarProj);
                gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

                // Re-enable color/depth writes, configure stencil to ONLY pass where stencil is 1
                gl.colorMask(true, true, true, true);
                gl.depthFunc(gl.LEQUAL);

                if (modelNormalLoc !== -1) {
                  gl.enableVertexAttribArray(modelNormalLoc);
                }

                // -------------------------------------------------------------------------
                // B) Draw the Mirrored Scenes
                // -------------------------------------------------------------------------
                // Compute correct mirrored matrices using proper multiplication order (viewMatrix * reflectedMatrix)
                const reflectedModelMatrix = multiplyMatrices(R_refl, charModelMatrix);
                const reflectedModelViewMatrix = multiplyMatrices(viewMatrix, reflectedModelMatrix);
                const reflectedModelViewMatrixStatic = multiplyMatrices(viewMatrix, R_refl);

                // 1) Draw Mirrored Player
                gl.useProgram(charProgram);
                gl.uniform1f(gl.getUniformLocation(charProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);
                gl.uniformMatrix4fv(
                  charMVLoc,
                  false,
                  setF32(f32_reflectedModelViewMatrix, reflectedModelViewMatrix),
                );
                gl.uniformMatrix4fv(
                  gl.getUniformLocation(charProgram, "uModelMatrix"),
                  false,
                  setF32(f32_reflectedModelMatrix, reflectedModelMatrix),
                );
                gl.uniformMatrix4fv(charProjLoc, false, setF32(f32_projMatrix, projMatrix));
                gl.uniform3fv(charLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
                gl.uniformMatrix4fv(
                  gl.getUniformLocation(charProgram, "uLightSpaceMatrix"),
                  false,
                  setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
                );
                gl.uniform1i(gl.getUniformLocation(charProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(charProgram, "uWaterMaskTex"), 2);
                gl.uniform1f(charWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                gl.uniform3fv(charWaterColorLoc, setF32(f32_waterColor, waterColor));
                gl.uniform1f(charWaterOpacityLoc, waterOpacity);
                if (charUseFaceTexLoc) {
              gl.uniform1f(charUseFaceTexLoc, 0.0);
            }
            if (window.characterModel === "chibi") {
              if ((!window.chibiGlbTexture || typeof window.chibiGlbTexture === "undefined") && typeof window.createChibiGlbTexture === "function") {
                window.createChibiGlbTexture(gl);
              }
            }
            const isDevColorOrBoneRefl = !!(typeof window !== "undefined" && (window.devColorByParts || window.devSelectedBone));
            if (window.characterModel === "chibi" && typeof window.chibiGlbTexture !== "undefined" && window.chibiGlbTexture && !isDevColorOrBoneRefl) {
              gl.activeTexture(gl.TEXTURE5);
              gl.bindTexture(gl.TEXTURE_2D, window.chibiGlbTexture);
              gl.uniform1i(charMainTexLoc, 5);
              gl.uniform1f(charHasMainTexLoc, 1.0);
            } else {
              gl.uniform1f(charHasMainTexLoc, 0.0);
            }

                gl.bindBuffer(gl.ARRAY_BUFFER, charVertexBuffer);
                gl.enableVertexAttribArray(charPosLoc);
                gl.vertexAttribPointer(charPosLoc, 3, gl.FLOAT, false, 0, 0);

                if (charLocalPosLoc !== -1) {
                  gl.bindBuffer(gl.ARRAY_BUFFER, charLocalVertexBuffer);
                  gl.enableVertexAttribArray(charLocalPosLoc);
                  gl.vertexAttribPointer(charLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, charNormalBuffer);
                gl.enableVertexAttribArray(charNormLoc);
                gl.vertexAttribPointer(charNormLoc, 3, gl.FLOAT, false, 0, 0);

                if (charColorLoc !== -1 && typeof charColorBuffer !== "undefined" && charColorBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, charColorBuffer);
            gl.enableVertexAttribArray(charColorLoc);
            gl.vertexAttribPointer(charColorLoc, 3, gl.FLOAT, false, 0, 0);
          }
          if (charTexCoordLoc !== -1 && typeof window.charTexCoordBuffer !== "undefined" && window.charTexCoordBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, window.charTexCoordBuffer);
            gl.enableVertexAttribArray(charTexCoordLoc);
            gl.vertexAttribPointer(charTexCoordLoc, 2, gl.FLOAT, false, 0, 0);
          } else if (charTexCoordLoc !== -1) {
            gl.disableVertexAttribArray(charTexCoordLoc);
          }

                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, charIndexBuffer);

                // Reflection inverts vertex winding order!
                gl.frontFace(gl.CW);

                if (supportUint32 && charIndicesLength > 65535) {
                  gl.drawElements(gl.TRIANGLES, charIndicesLength, gl.UNSIGNED_INT, 0);
                } else {
                  gl.drawElements(gl.TRIANGLES, charIndicesLength, gl.UNSIGNED_SHORT, 0);
                }

                gl.frontFace(gl.CCW);

                // 2) Draw Mirrored Placed Cubes/Structures
                if (cubeVertexBuffer && cubeIndicesLength > 0) {
                  gl.useProgram(modelProgram);
                  gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
                  gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_reflectedModelViewMatrixStatic, reflectedModelViewMatrixStatic));
                  gl.uniformMatrix4fv(modelProjLoc, false, setF32(f32_projMatrix, projMatrix));
                  gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                  gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
                  gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
                  gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
                  gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
                  gl.uniform1f(modelTimeLoc, leafAnimTime);
                  gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
                  gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
                  gl.uniform1f(modelSwayFactorLoc, 0.0);
                  gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
                  gl.enableVertexAttribArray(modelPosLoc);
                  gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, cubeColorBuffer);
                  gl.enableVertexAttribArray(modelColorLoc);
                  gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

                  if (modelNormalLoc !== -1 && cubeNormalBuffer) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer);
                    gl.enableVertexAttribArray(modelNormalLoc);
                    gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
                  }

                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);
                  
                  gl.disable(gl.CULL_FACE);

                  if (supportUint32 && cubeIndicesLength > 65535) {
                    gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_INT, 0);
                  } else {
                    gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_SHORT, 0);
                  }
                }

                // 3) Draw Mirrored Trees & Rocks
                if (typeof TreeSystem !== "undefined" && TreeSystem.drawTreeMirrored) {
                  TreeSystem.drawTreeMirrored(gl, {
                    natureVertexBuffer,
                    natureColorBuffer,
                    natureNormalBuffer,
                    natureIndexBuffer,
                    natureIndicesLength,
                    supportUint32,
                    modelProgram,
                    modelLightDirLoc,
                    modelMVLoc,
                    modelProjLoc,
                    modelWaterRadiusLoc,
                    modelWaterColorLoc,
                    modelWaterOpacityLoc,
                    modelRenderDistEnabledLoc,
                    modelMaxRenderDistLoc,
                    modelTimeLoc,
                    modelPlanetRadiusLoc,
                    modelCameraPosLoc,
                    modelSwayFactorLoc,
                    modelWaterSwayFactorLoc,
                    modelPosLoc,
                    modelColorLoc,
                    modelNormalLoc,
                    finalLightDir,
                    reflectedModelViewMatrixStatic,
                    projMatrix,
                    RADIUS,
                    waterLevel,
                    waterColor,
                    waterOpacity,
                    renderDistEnabled,
                    renderDistValue: curObjectDist,
                    leafAnimTime,
                    eyePos,
                    natureSway,
                    waterPlantSway
                  });
                }

                // 4) Draw Mirrored Creatures (Amphibians)
                if (amphibianVertexBuffer && amphibianIndicesLength > 0) {
                  gl.useProgram(modelProgram);
                  gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
                  gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_reflectedModelViewMatrixStatic, reflectedModelViewMatrixStatic));
                  gl.uniformMatrix4fv(modelProjLoc, false, setF32(f32_projMatrix, projMatrix));
                  gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                  gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
                  gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
                  gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
                  gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
                  gl.uniform1f(modelTimeLoc, waterAnimTime);
                  gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
                  gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
                  gl.uniform1f(modelSwayFactorLoc, 0.0);
                  gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
                  gl.enableVertexAttribArray(modelPosLoc);
                  gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
                  gl.enableVertexAttribArray(modelColorLoc);
                  gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

                  if (modelNormalLoc !== -1 && amphibianNormalBuffer) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
                    gl.enableVertexAttribArray(modelNormalLoc);
                    gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
                  }

                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);

                  // Creatures use CW winding order normally, so mirrored is CCW
                  gl.enable(gl.CULL_FACE);
                  gl.frontFace(gl.CCW);
                  gl.cullFace(gl.BACK);

                  if (supportUint32 && amphibianIndicesLength > 65535) {
                    gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_INT, 0);
                  } else {
                    gl.drawElements(gl.TRIANGLES, amphibianIndicesLength, gl.UNSIGNED_SHORT, 0);
                  }
                  gl.disable(gl.CULL_FACE);
                }

                // 5) Draw Mirrored Fire Particles
                if (fireVertexBuffer && fireIndicesLength > 0) {
                  gl.useProgram(modelProgram);
                  gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
                  gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_reflectedModelViewMatrixStatic, reflectedModelViewMatrixStatic));
                  gl.uniformMatrix4fv(modelProjLoc, false, setF32(f32_projMatrix, projMatrix));
                  gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
                  gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
                  gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
                  gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
                  gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
                  gl.uniform1f(modelTimeLoc, waterAnimTime);
                  gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
                  gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
                  gl.uniform1f(modelSwayFactorLoc, 0.0);
                  gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
                  gl.enableVertexAttribArray(modelPosLoc);
                  gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

                  gl.bindBuffer(gl.ARRAY_BUFFER, fireColorBuffer);
                  gl.enableVertexAttribArray(modelColorLoc);
                  gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

                  if (modelNormalLoc !== -1 && fireNormalBuffer) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, fireNormalBuffer);
                    gl.enableVertexAttribArray(modelNormalLoc);
                    gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
                  }

                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);

                  if (supportUint32 && fireIndicesLength > 65535) {
                    gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_INT, 0);
                  } else {
                    gl.drawElements(gl.TRIANGLES, fireIndicesLength, gl.UNSIGNED_SHORT, 0);
                  }
                }

                // Restore stencil and winding order
                gl.disable(gl.STENCIL_TEST);
                gl.frontFace(gl.CCW);
              }
            }
          }

          gl.disable(gl.CULL_FACE);
        }

        // วาดสิ่งก่อสร้าง/กล่องสี่เหลี่ยม (Cubes) - คำนวณแสงเงาเคลื่อนตามดวงอาทิตย์อย่างเหมาะสมด้วย modelProgram
        if (
          cubeVertexBuffer &&
          cubeColorBuffer &&
          cubeIndexBuffer &&
          cubeIndicesLength > 0
        ) {
          gl.useProgram(modelProgram);
          gl.uniform1f(gl.getUniformLocation(modelProgram, "uShadowsEnabled"), shadowMapEnabled ? 1.0 : 0.0);
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            setF32(f32_modelViewMatrix, modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            setF32(f32_projMatrix, projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform2f(gl.getUniformLocation(modelProgram, "uShadowTexelSize"), 1.0 / SHADOW_WIDTH, 1.0 / SHADOW_HEIGHT);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, leafAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, cubeColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && cubeNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer);

          const isUint32 = supportUint32 && cubeIndicesLength > 65535;
          if (frustumCullingEnabled && frustumPlanes) {
            const ranges = getVisibleIndexRanges(cubeObstacles, frustumPlanes);
            const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            const bytesPerIndex = isUint32 ? 4 : 2;
            for (let i = 0; i < ranges.length; i++) {
              const range = ranges[i];
              const count = range.end - range.start;
              if (count > 0) {
                gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
              }
            }
          } else {
            if (isUint32) {
              gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_INT, 0);
            } else {
              gl.drawElements(gl.TRIANGLES, cubeIndicesLength, gl.UNSIGNED_SHORT, 0);
            }
          }
        }

        // วาดวัตถุธรรมชาติ (Trees & Rocks) - คำนวณแสงเงาเคลื่อนตามดวงอาทิตย์อย่างเหมาะสมด้วย modelProgram
        if (cameraMode !== "sun" && typeof TreeSystem !== "undefined" && TreeSystem.drawTrees) {
          TreeSystem.drawTrees(gl, {
            natureVertexBuffer,
            natureColorBuffer,
            natureNormalBuffer,
            natureIndexBuffer,
            natureIndicesLength,
            supportUint32,
            modelProgram,
            modelLightDirLoc,
            modelMVLoc,
            modelProjLoc,
            modelWaterRadiusLoc,
            modelWaterColorLoc,
            modelWaterOpacityLoc,
            modelRenderDistEnabledLoc,
            modelMaxRenderDistLoc,
            modelTimeLoc,
            modelPlanetRadiusLoc,
            modelCameraPosLoc,
            modelSwayFactorLoc,
            modelWaterSwayFactorLoc,
            modelPosLoc,
            modelColorLoc,
            modelNormalLoc,
            finalLightDir,
            modelViewMatrix,
            projMatrix,
            lightSpaceMatrix,
            RADIUS,
            waterLevel,
            waterColor,
            waterOpacity,
            renderDistEnabled,
            renderDistValue: curObjectDist,
            leafAnimTime,
            eyePos,
            natureSway,
            waterPlantSway,
            frustumCullingEnabled,
            frustumPlanes,
            natureObstacles,
            natureGrassStartIndex
          });
        }

        if (typeof GrassSystem !== "undefined" && GrassSystem.drawGrass) {
          GrassSystem.drawGrass(gl, {
            natureVertexBuffer,
            natureColorBuffer,
            natureNormalBuffer,
            natureIndexBuffer,
            natureIndicesLength,
            natureGrassStartIndex,
            supportUint32,
            renderDistEnabled,
            renderDistValue: curObjectDist,
            frustumCullingEnabled,
            frustumPlanes,
            grassChunks,
            eyePos
          });
        }

        // วาดกล่องชน (Hitboxes)
        if (showHitboxes && hitboxVertexBuffer && hitboxColorBuffer && hitboxIndexBuffer && hitboxIndicesLength > 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, hitboxColorBuffer);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, hitboxVertexBuffer); // just binding same buffer for normal for simplicity or better zero out? Hitboxes don't have normals yet, so we could bind color just to avoid crash, but wait, addBox does not generate normals if not requested? Oh wait, addBox generates vertices, colors, indices. It does not generate normals array directly but if I used addBox I only passed vertices, colors, indices!
            // Wait, addBox has `vertices, colors, indices`. It pushes to those arrays. It does not push normals!
            // Let's check `addBox` signature: `addBox(p, w, h, d, color, r, n, f, vertices, colors, indices)`
            // So there are no normals for hitboxes!
            // We should probably just disable modelNormalLoc
            gl.disableVertexAttribArray(modelNormalLoc);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, hitboxIndexBuffer);

          if (supportUint32 && hitboxIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              hitboxIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              hitboxIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
          
          if (modelNormalLoc !== -1) {
              gl.enableVertexAttribArray(modelNormalLoc);
          }
        }

        const hasStaticCollectibles = collectibleVertexBuffer && collectibleColorBuffer && collectibleIndexBuffer && collectibleIndicesLength > 0;
        const hasDynamicCollectibles = dynamicCollectibleVertexBuffer && dynamicCollectibleColorBuffer && dynamicCollectibleIndexBuffer && dynamicCollectibleIndicesLength > 0;
        const hasActiveBoat = !!activeRidingBoat;

        // วาดไอเทมสวมใส่ (Collectibles)
        if (hasStaticCollectibles || hasDynamicCollectibles || hasActiveBoat) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);

          gl.useProgram(modelProgram);
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            setF32(f32_modelViewMatrix, modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            setF32(f32_projMatrix, projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, leafAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          if (hasStaticCollectibles) {
            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleVertexBuffer);
            gl.enableVertexAttribArray(modelPosLoc);
            gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, collectibleColorBuffer);
            gl.enableVertexAttribArray(modelColorLoc);
            gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

            if (modelNormalLoc !== -1 && collectibleNormalBuffer) {
              gl.bindBuffer(gl.ARRAY_BUFFER, collectibleNormalBuffer);
              gl.enableVertexAttribArray(modelNormalLoc);
              gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, collectibleIndexBuffer);
            const isUint32 = supportUint32 && collectibleIndicesLength > 65535;
            if (frustumCullingEnabled && frustumPlanes) {
              const ranges = getVisibleIndexRanges(collectibles, frustumPlanes);
              const type = isUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
              const bytesPerIndex = isUint32 ? 4 : 2;
              for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                const count = range.end - range.start;
                if (count > 0) {
                  gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
                }
            }
          } else {
              if (isUint32) {
                gl.drawElements(gl.TRIANGLES, collectibleIndicesLength, gl.UNSIGNED_INT, 0);
              } else {
                gl.drawElements(gl.TRIANGLES, collectibleIndicesLength, gl.UNSIGNED_SHORT, 0);
              }
            }
          }

          if (hasDynamicCollectibles) {
            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleVertexBuffer);
            gl.enableVertexAttribArray(modelPosLoc);
            gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleColorBuffer);
            gl.enableVertexAttribArray(modelColorLoc);
            gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

            if (modelNormalLoc !== -1 && dynamicCollectibleNormalBuffer) {
              gl.bindBuffer(gl.ARRAY_BUFFER, dynamicCollectibleNormalBuffer);
              gl.enableVertexAttribArray(modelNormalLoc);
              gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
            }

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dynamicCollectibleIndexBuffer);
            const isUint32Dynamic = supportUint32 && dynamicCollectibleIndicesLength > 65535;
            if (frustumCullingEnabled && frustumPlanes && window.dynamicCollectiblesList && window.dynamicCollectiblesList.length > 0) {
              const ranges = getVisibleIndexRanges(window.dynamicCollectiblesList, frustumPlanes);
              const type = isUint32Dynamic ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
              const bytesPerIndex = isUint32Dynamic ? 4 : 2;
              for (let i = 0; i < ranges.length; i++) {
                const range = ranges[i];
                const count = range.end - range.start;
                if (count > 0) {
                  gl.drawElements(gl.TRIANGLES, count, type, range.start * bytesPerIndex);
                }
              }
            } else {
              if (isUint32Dynamic) {
                gl.drawElements(gl.TRIANGLES, dynamicCollectibleIndicesLength, gl.UNSIGNED_INT, 0);
              } else {
                gl.drawElements(gl.TRIANGLES, dynamicCollectibleIndicesLength, gl.UNSIGNED_SHORT, 0);
              }
            }
          }

          if (hasActiveBoat && typeof drawDedicatedActiveBoat === "function") {
            drawDedicatedActiveBoat(gl, modelPosLoc, modelColorLoc, modelNormalLoc);
          }
          
          gl.disable(gl.CULL_FACE);
        }
        
        // Render preview collectible
        if (
          previewVertexBuffer &&
          previewColorBuffer &&
          previewIndexBuffer &&
          previewIndicesLength > 0
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);
          gl.useProgram(modelProgram);

          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_modelViewMatrix, modelViewMatrix));
          gl.uniformMatrix4fv(modelProjLoc, false, setF32(f32_projMatrix, projMatrix));
          gl.uniformMatrix4fv(gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"), false, setF32(f32_lightSpaceMatrix, lightSpaceMatrix));
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);
          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(modelRenderDistEnabledLoc, renderDistEnabled ? 1.0 : 0.0);
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, leafAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, previewVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, previewColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && previewNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, previewNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previewIndexBuffer);
          if (supportUint32 && previewIndicesLength > 65535) {
            gl.drawElements(gl.TRIANGLES, previewIndicesLength, gl.UNSIGNED_INT, 0);
          } else {
            gl.drawElements(gl.TRIANGLES, previewIndicesLength, gl.UNSIGNED_SHORT, 0);
          }
          gl.disable(gl.CULL_FACE);
        }

        // วาดขวาน/ไอเทมที่ถืออยู่ (Equipped Item)
        if (
          !hideCharacter &&
          !isSmashing &&
          equipVertexBuffer &&
          equipColorBuffer &&
          equipNormalBuffer &&
          equipIndexBuffer &&
          equipIndicesLength > 0
        ) {
          gl.useProgram(modelProgram);

          const isRag = (ragdollEnabled && ragdollInitialized && (typeof window === "undefined" || window.characterModel !== "chibi"));
          const equipCharModelMatrix = isRag ? createIdentity() : getCharacterMatrix();
          const equipModelViewMatrix = multiplyMatrices(viewMatrix, equipCharModelMatrix);

          gl.uniformMatrix4fv(modelMVLoc, false, setF32(f32_modelViewMatrix, equipModelViewMatrix));
          gl.uniformMatrix4fv(modelProjLoc, false, setF32(f32_projMatrix, projMatrix));
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);
          gl.uniform1f(gl.getUniformLocation(modelProgram, "uShadowsEnabled"), 0.0);

          // For local space vertices, prevent underwater fog unless player is actually underwater
          const isPlayerUnderwater = (typeof currentSwimFactor !== "undefined" && currentSwimFactor > 0.5);
          gl.uniform1f(modelWaterRadiusLoc, isRag ? (RADIUS + waterLevel * 0.15) : (isPlayerUnderwater ? 999.0 : -999.0));
          gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(modelRenderDistEnabledLoc, 0.0);
          gl.uniform1f(modelMaxRenderDistLoc, 9999.0);
          gl.uniform1f(modelTimeLoc, 0.0);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          // Rotate light direction to local model space so lighting on item is bright and consistent
          let localLightDir = finalLightDir;
          if (!isRag) {
            const m = equipCharModelMatrix;
            const lx = (m[0]*finalLightDir[0] + m[1]*finalLightDir[1] + m[2]*finalLightDir[2]);
            const ly = (m[4]*finalLightDir[0] + m[5]*finalLightDir[1] + m[6]*finalLightDir[2]);
            const lz = (m[8]*finalLightDir[0] + m[9]*finalLightDir[1] + m[10]*finalLightDir[2]);
            const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz) || 1.0;
            localLightDir = [lx / lLen, ly / lLen, lz / lLen];
          }
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, localLightDir));

          gl.bindBuffer(gl.ARRAY_BUFFER, equipVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, equipColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, equipNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, equipIndexBuffer);

          if (supportUint32 && equipIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              equipIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }

        // วาดสัตว์ครึ่งบกครึ่งน้ำ (Amphibians)
        if (
          amphibianVertexBuffer &&
          amphibianColorBuffer &&
          amphibianIndexBuffer &&
          amphibianIndicesLength > 0
        ) {
          gl.enable(gl.CULL_FACE);
          gl.frontFace(gl.CW);
          gl.cullFace(gl.BACK);

          gl.useProgram(modelProgram);
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            setF32(f32_modelViewMatrix, modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            setF32(f32_projMatrix, projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, waterAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, amphibianVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, amphibianColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && amphibianNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, amphibianNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, amphibianIndexBuffer);
          if (supportUint32 && amphibianIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              amphibianIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              amphibianIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
          gl.disable(gl.CULL_FACE);
        }
        
        // วาดกองไฟ (Fire Particles)
        if (
          fireVertexBuffer &&
          fireColorBuffer &&
          fireIndexBuffer &&
          fireIndicesLength > 0
        ) {
          gl.useProgram(modelProgram);
          gl.uniform3fv(modelLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniformMatrix4fv(
            modelMVLoc,
            false,
            setF32(f32_modelViewMatrix, modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            modelProjLoc,
            false,
            setF32(f32_projMatrix, projMatrix),
          );
          gl.uniformMatrix4fv(
            gl.getUniformLocation(modelProgram, "uLightSpaceMatrix"),
            false,
            setF32(f32_lightSpaceMatrix, lightSpaceMatrix),
          );
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uShadowMap"), 1);
          gl.uniform1i(gl.getUniformLocation(modelProgram, "uWaterMaskTex"), 2);

          gl.uniform1f(modelWaterRadiusLoc, RADIUS + waterLevel * 0.15);
          gl.uniform3fv(modelWaterColorLoc, setF32(f32_waterColor, waterColor));
          gl.uniform1f(modelWaterOpacityLoc, waterOpacity);
          gl.uniform1f(
            modelRenderDistEnabledLoc,
            renderDistEnabled ? 1.0 : 0.0,
          );
          gl.uniform1f(modelMaxRenderDistLoc, curObjectDist);
          gl.uniform1f(modelTimeLoc, waterAnimTime);
          gl.uniform1f(modelPlanetRadiusLoc, RADIUS);
          gl.uniform3fv(modelCameraPosLoc, setF32(f32_eyePos, eyePos));
          gl.uniform1f(modelSwayFactorLoc, 0.0);
          gl.uniform1f(modelWaterSwayFactorLoc, 0.0);

          gl.bindBuffer(gl.ARRAY_BUFFER, fireVertexBuffer);
          gl.enableVertexAttribArray(modelPosLoc);
          gl.vertexAttribPointer(modelPosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, fireColorBuffer);
          gl.enableVertexAttribArray(modelColorLoc);
          gl.vertexAttribPointer(modelColorLoc, 3, gl.FLOAT, false, 0, 0);

          if (modelNormalLoc !== -1 && fireNormalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, fireNormalBuffer);
            gl.enableVertexAttribArray(modelNormalLoc);
            gl.vertexAttribPointer(modelNormalLoc, 3, gl.FLOAT, false, 0, 0);
          }

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fireIndexBuffer);
          if (supportUint32 && fireIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              fireIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              fireIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }
        }

        // วาดเส้นกริดภูมิประเทศ (Wireframe) - ไม่รับแสงเงา (Unlit)
        gl.useProgram(program);
        gl.uniform1f(useLightingLoc, 0.0); // ปิดแสงเงาบนเส้น wireframe
        if (typeof SurfaceSystem !== "undefined" && SurfaceSystem.drawWireframe) {
          SurfaceSystem.drawWireframe(gl, {
            wireframeBuffer,
            wireColorBuffer,
            wireframePointCount,
            positionLoc,
            colorLoc
          });
        }

        // วาดโครงสร้างการชนระบบถ้ำทุกจุด (Cave Collision Wireframe Everywhere)
        if (showHitboxes && typeof CaveSystem !== "undefined" && CaveSystem.drawWireframe) {
          CaveSystem.drawWireframe(gl, {
            positionLoc,
            colorLoc,
            isTunnelMeshLoc,
            terrainRadiusAttrLoc,
            tunnelCenterAttrLoc,
            supportUint32
          });
        }
        
        if (showActionReach && isDevMode) {
            const numSegments = 32;
            const arVerts = [];
            const arCols = [];
            
            const sinTheta = Math.sin(charTheta);
            const cosTheta = Math.cos(charTheta);
            const sinPhi = Math.sin(charPhi);
            const cosPhi = Math.cos(charPhi);
            const nx = sinTheta * cosPhi;
            const ny = cosTheta;
            const nz = sinTheta * sinPhi;
            
            const height = getHeightOnSphere(charTheta, charPhi, (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 0));
            const terrainRadius = RADIUS + height * HEIGHT_SCALE;
            const currentRadius = (typeof playerCenterRadius !== 'undefined' && playerCenterRadius !== null) 
              ? (playerCenterRadius - 0.46 * playerScale) 
              : terrainRadius;
            
            const center = [currentRadius * nx, currentRadius * ny, currentRadius * nz];
            const up = [nx, ny, nz]; // character normal
            
            let right = [0, 1, 0];
            if (Math.abs(up[1]) > 0.99) right = [1, 0, 0];
            let rightLen = Math.sqrt( (up[1]*right[2] - up[2]*right[1])**2 + (up[2]*right[0] - up[0]*right[2])**2 + (up[0]*right[1] - up[1]*right[0])**2 );
            const fwd = [
                (up[1]*right[2] - up[2]*right[1])/rightLen,
                (up[2]*right[0] - up[0]*right[2])/rightLen,
                (up[0]*right[1] - up[1]*right[0])/rightLen
            ];
            right = [
                fwd[1]*up[2] - fwd[2]*up[1],
                fwd[2]*up[0] - fwd[0]*up[2],
                fwd[0]*up[1] - fwd[1]*up[0]
            ];
            
            const East = [-sinPhi, 0, cosPhi];
            const North = [-cosTheta * cosPhi, sinTheta, -cosTheta * sinPhi];
            const cosH = Math.cos(charHeading);
            const sinH = Math.sin(charHeading);
            const F = [
              North[0] * cosH + East[0] * sinH,
              North[1] * cosH + East[1] * sinH,
              North[2] * cosH + East[2] * sinH,
            ];

            // Add a small offset to the center along the normal vector so the circle doesn't clip into the ground
            const circleCenter = [
                center[0] + up[0] * 0.05,
                center[1] + up[1] * 0.05,
                center[2] + up[2] * 0.05
            ];

            // Draw a line pointing forward (แบบเส้น)
            const p1 = [
                circleCenter[0],
                circleCenter[1],
                circleCenter[2]
            ];
            const p2 = [
                circleCenter[0] + F[0] * actionReachDistance,
                circleCenter[1] + F[1] * actionReachDistance,
                circleCenter[2] + F[2] * actionReachDistance
            ];
            arVerts.push(...p1, ...p2);
            arCols.push(1.0, 1.0, 1.0, 1.0, 1.0, 1.0); // White line for aim reach

            // Draw a circle on the ground (แบบวง)
            for (let i = 0; i < numSegments; i++) {
                const a1 = (i / numSegments) * Math.PI * 2;
                const a2 = ((i + 1) / numSegments) * Math.PI * 2;
                
                const c1 = Math.cos(a1);
                const s1 = Math.sin(a1);
                const c2 = Math.cos(a2);
                const s2 = Math.sin(a2);
                
                const pStart = [
                    circleCenter[0] + (right[0] * c1 + fwd[0] * s1) * actionReachDistance,
                    circleCenter[1] + (right[1] * c1 + fwd[1] * s1) * actionReachDistance,
                    circleCenter[2] + (right[2] * c1 + fwd[2] * s1) * actionReachDistance
                ];
                
                const pEnd = [
                    circleCenter[0] + (right[0] * c2 + fwd[0] * s2) * actionReachDistance,
                    circleCenter[1] + (right[1] * c2 + fwd[1] * s2) * actionReachDistance,
                    circleCenter[2] + (right[2] * c2 + fwd[2] * s2) * actionReachDistance
                ];
                
                arVerts.push(...pStart, ...pEnd);
                arCols.push(0.3, 0.9, 0.3, 0.3, 0.9, 0.3); // Soft green color for circular reach
            }
            
            if (!actionReachLineBuffer) actionReachLineBuffer = gl.createBuffer();
            if (!actionReachColorBuffer) actionReachColorBuffer = gl.createBuffer();
            
            gl.bindBuffer(gl.ARRAY_BUFFER, actionReachLineBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arVerts), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, actionReachColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arCols), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.drawArrays(gl.LINES, 0, arVerts.length / 3);
        }

        // Red Laser Guide Beam for Bow and Wooden Arm Cannon (Direct 3D Line from Weapon to Target)
        const isLaserGuideActive = (typeof window !== "undefined") && (
          window.isDevMode || window.devLaserGuideEnabled || (window.devgame && window.devgame.laserGuideEnabled)
        );
        const isAimingRangedForLaser = (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps") &&
          isUsingItem && activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON");

        if (isLaserGuideActive && isAimingRangedForLaser && window.lastBowGripPos && window.currentAimTargetPos) {
            const startP = window.lastBowGripPos;
            const endP = window.currentAimTargetPos;
            const laserVerts = [startP[0], startP[1], startP[2], endP[0], endP[1], endP[2]];
            // Bright neon red glowing laser beam
            const laserCols = [1.0, 0.12, 0.18, 1.0, 0.05, 0.08];

            if (!window.laserLineBuffer) window.laserLineBuffer = gl.createBuffer();
            if (!window.laserColorBuffer) window.laserColorBuffer = gl.createBuffer();

            gl.bindBuffer(gl.ARRAY_BUFFER, window.laserLineBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(laserVerts), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, window.laserColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(laserCols), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.LINES, 0, 2);
        }

        // วาดจุดดาวเล็กๆ (Dots/Stars) - ไม่รับแสงเงา (Unlit)
        if (dotBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
          gl.enableVertexAttribArray(positionLoc);
          gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, dotColorBuffer);
          gl.enableVertexAttribArray(colorLoc);
          gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.POINTS, 0, dotPositions.length / 3);
        }

        // ============================================
        // วาดโครงกระดูก 3D, ตาข่าย Wireframe และป้ายชื่อกระดูก (GLB Skeleton & Parts Inspector)
        // ============================================
        if (typeof window.renderDevSkeletonAndParts === "function") {
          gl.useProgram(program);
          if (useLightingLoc) gl.uniform1f(useLightingLoc, 0.0);
          if (terrainRenderDistEnabledLoc) gl.uniform1f(terrainRenderDistEnabledLoc, 0.0);
          if (terrainWaterRadiusLoc) gl.uniform1f(terrainWaterRadiusLoc, 0.0);
          if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 0.0);
          if (tunnelCountLoc) gl.uniform1i(tunnelCountLoc, 0);
          if (terrainRadiusAttrLoc !== -1) gl.disableVertexAttribArray(terrainRadiusAttrLoc);
          if (tunnelCenterAttrLoc !== -1) gl.disableVertexAttribArray(tunnelCenterAttrLoc);

          setF32(f32_modelViewMatrix, viewMatrix);
          gl.uniformMatrix4fv(modelViewLoc, false, f32_modelViewMatrix);
          setF32(f32_projMatrix, projMatrix);
          gl.uniformMatrix4fv(projectionLoc, false, f32_projMatrix);

          window.renderDevSkeletonAndParts(gl, {
            positionLoc,
            colorLoc,
            viewMatrix,
            projMatrix,
            charModelMatrix: (typeof getCharacterMatrix === "function") ? getCharacterMatrix() : null
          });
        }
        
        // ============================================
        // วาดวงโคจรรอบดวงอาทิตย์ (Orbit Rings) - แสดงผลเฉพาะเมื่ออยู่ในโหมดกล้องอวกาศ/พระอาทิตย์/Freecam ไม่แสดงในกล้องตัวละคร
        // ============================================
        const isCharCam = (cameraMode === "tps" || cameraMode === "thirdperson" || cameraMode === "fps");
        if (program && !isCharCam) {
          gl.useProgram(program);
          if (useLightingLoc) gl.uniform1f(useLightingLoc, 0.0);
          if (terrainRenderDistEnabledLoc) gl.uniform1f(terrainRenderDistEnabledLoc, 0.0);
          if (terrainWaterRadiusLoc) gl.uniform1f(terrainWaterRadiusLoc, 0.0);
          if (isTunnelMeshLoc) gl.uniform1f(isTunnelMeshLoc, 0.0);
          if (tunnelCountLoc) gl.uniform1i(tunnelCountLoc, 0);

          if (terrainRadiusAttrLoc !== -1) gl.disableVertexAttribArray(terrainRadiusAttrLoc);
          if (tunnelCenterAttrLoc !== -1) gl.disableVertexAttribArray(tunnelCenterAttrLoc);
          
          let sunPos = [-800.0, 0.0, 0.0];
          if (window.SpacesMap && typeof window.SpacesMap.getCelestialTransform === "function") {
            const cel = window.SpacesMap.getCelestialTransform("sun");
            if (cel && cel.pos) sunPos = cel.pos;
          } else if (typeof window.getSunWorldPosition === "function") {
            sunPos = window.getSunWorldPosition();
          }

          const orbitVerts = [];
          const orbitCols = [];
          const numSegments = 128;
          const activePlanetId = (window.SpacesMap && window.SpacesMap.activePlanetId) ? window.SpacesMap.activePlanetId : "planet_1";

          // รวบรวมข้อมูลวงโคจรของดาวเคราะห์ในระบบสุริยะ SpacesMap (5 วงโคจรหลัก)
          const orbitsToDraw = [];

          if (window.SpacesMap && window.SpacesMap.allPlanets) {
            Object.keys(window.SpacesMap.allPlanets).forEach(pId => {
              const p = window.SpacesMap.allPlanets[pId];
              const isActive = (pId === activePlanetId);
              let rad = p.orbitRadius || 800.0;
              let tilt = isActive ? 0.0 : ((typeof p.orbitTilt === "number") ? p.orbitTilt : 0.0);

              if (typeof window.SpacesMap.getCelestialTransform === "function") {
                const cel = window.SpacesMap.getCelestialTransform(pId);
                if (cel) {
                  rad = cel.orbitRadius || rad;
                  tilt = (typeof cel.orbitTilt === "number") ? cel.orbitTilt : tilt;
                }
              }

              // วงโคจรของดาวแม่ (Genesis/Active Planet) รัศมี 800 หน่วยบนระนาบ 0 เพื่อให้ผ่านศูนย์กลาง [0, 0, 0] พอดี
              if (isActive) {
                const dx = 0.0 - sunPos[0];
                const dy = 0.0 - sunPos[1];
                const dz = 0.0 - sunPos[2];
                rad = Math.sqrt(dx * dx + dy * dy + dz * dz);
                tilt = 0.0;
              }

              orbitsToDraw.push({
                id: pId,
                radius: rad,
                tilt: tilt,
                isActive: isActive
              });
            });
          }

          // สร้างเส้นเวกเตอร์สำหรับ Orbit Rings
          for (let i = 0; i < orbitsToDraw.length; i++) {
            const orbit = orbitsToDraw[i];
            const radius = orbit.radius;
            const tilt = orbit.tilt;

            if (radius > 10.0) {
              const col = orbit.isActive
                ? [1.0, 1.0, 1.0]          // เส้นสีขาวสว่างชัดเจนสำหรับดาวหลักที่ผู้เล่นอยู่
                : [0.75, 0.85, 1.0];        // เส้นสีขาวนวลประกายเงิน/ฟ้าสำหรับดาวบริวารดวงอื่น

              if (orbit.isActive) {
                // คำนวณระนาบวงโคจรของดาวหลัก (Active Planet) ให้ผ่านจุดศูนย์กลาง [0, 0, 0] ของดาวแม่ 100%
                const ux = -sunPos[0];
                const uy = -sunPos[1];
                const uz = -sunPos[2];
                const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz);
                let vx = -uz;
                let vy = 0.0;
                let vz = ux;
                const vLen = Math.sqrt(vx * vx + vz * vz);
                if (vLen > 0.0001) {
                  vx = (vx / vLen) * uLen;
                  vz = (vz / vLen) * uLen;
                } else {
                  vx = 0.0;
                  vy = 0.0;
                  vz = uLen;
                }

                for (let s = 0; s < numSegments; s++) {
                  const a1 = (s / numSegments) * Math.PI * 2;
                  const a2 = ((s + 1) / numSegments) * Math.PI * 2;

                  const p1x = sunPos[0] + ux * Math.cos(a1) + vx * Math.sin(a1);
                  const p1y = sunPos[1] + uy * Math.cos(a1) + vy * Math.sin(a1);
                  const p1z = sunPos[2] + uz * Math.cos(a1) + vz * Math.sin(a1);

                  const p2x = sunPos[0] + ux * Math.cos(a2) + vx * Math.sin(a2);
                  const p2y = sunPos[1] + uy * Math.cos(a2) + vy * Math.sin(a2);
                  const p2z = sunPos[2] + uz * Math.cos(a2) + vz * Math.sin(a2);

                  orbitVerts.push(p1x, p1y, p1z, p2x, p2y, p2z);
                  orbitCols.push(col[0], col[1], col[2], col[0], col[1], col[2]);
                }
              } else {
                for (let s = 0; s < numSegments; s++) {
                  const a1 = (s / numSegments) * Math.PI * 2;
                  const a2 = ((s + 1) / numSegments) * Math.PI * 2;

                  orbitVerts.push(
                    sunPos[0] + Math.cos(a1) * radius,
                    sunPos[1] + Math.sin(a1) * (radius * tilt),
                    sunPos[2] + Math.sin(a1) * radius,

                    sunPos[0] + Math.cos(a2) * radius,
                    sunPos[1] + Math.sin(a2) * (radius * tilt),
                    sunPos[2] + Math.sin(a2) * radius
                  );

                  orbitCols.push(col[0], col[1], col[2], col[0], col[1], col[2]);
                }
              }
            }
          }

          if (orbitVerts.length > 0) {
            if (!window.orbitLineBuffer) window.orbitLineBuffer = gl.createBuffer();
            if (!window.orbitColorBuffer) window.orbitColorBuffer = gl.createBuffer();

            gl.disable(gl.CULL_FACE);
            
            setF32(f32_modelViewMatrix, viewMatrix);
            gl.uniformMatrix4fv(modelViewLoc, false, f32_modelViewMatrix);
            setF32(f32_projMatrix, projMatrix);
            gl.uniformMatrix4fv(projectionLoc, false, f32_projMatrix);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, window.orbitLineBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(orbitVerts), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, window.orbitColorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(orbitCols), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
            
            gl.drawArrays(gl.LINES, 0, orbitVerts.length / 3);
          }
        }
        
        // วาด 3D UI (ป้ายในโลก 3D เช่น UI เรือ/NPC) ก่อนวาดผิวน้ำ เพื่อให้จมน้ำ/ลอยน้ำเป็นเนื้อเดียวกับโลกแบบเดียวกับเรือและ NPC
        if (typeof World3DUI !== "undefined" && World3DUI.backend) {
          World3DUI.render(gl, f32_gpuViewProj);
        }

        // ---- ENABLE BLENDING FOR TRANSPARENT PASSES ----
        gl.enable(gl.BLEND);

        // วาดผิวน้ำ (Water)
        if (cameraMode !== "sun" && typeof WaterSystem !== "undefined" && WaterSystem.drawWater) {
          WaterSystem.drawWater(gl, {
            waterEnabled: waterEnabled,
            modelViewMatrix: modelViewMatrix,
            projMatrix: projMatrix,
            waterColor: waterColor,
            waterOpacity: waterOpacity,
            waterAnimTime: waterAnimTime,
            waveStrength: waveStrength,
            waterLevel: waterLevel,
            finalLightDir: finalLightDir,
            eyePos: eyePos,
            renderDistEnabled: renderDistEnabled,
            renderDistValue: curTerrainDist,
            collectibles: collectibles,
            tunnels3D: tunnels3D,
            supportUint32: supportUint32
          });
        }

        // วาดชั้นบรรยากาศ (Atmosphere) - เรืองแสงฟิสิกส์ Fresnel สวยงามรอบดวงดาว
        if (
          atmosphereEnabled &&
          atmosphereVertexBuffer &&
          atmosphereIndexBuffer &&
          atmosphereIndicesLength > 0
        ) {
          gl.useProgram(atmosphereProgram);
          gl.uniformMatrix4fv(
            atmosphereMVLoc,
            false,
            setF32(f32_modelViewMatrix, modelViewMatrix),
          );
          gl.uniformMatrix4fv(
            atmosphereProjLoc,
            false,
            setF32(f32_projMatrix, projMatrix),
          );
          gl.uniform3fv(atmosphereColorLoc, setF32(f32_atmosphereColor, atmosphereColor));
          gl.uniform1f(atmosphereAlphaLoc, atmosphereAlpha);
          gl.uniform3fv(atmosphereLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
          gl.uniform3fv(atmosphereCameraPosLoc, setF32(f32_eyePos, eyePos));

          // ปิดเขียนลง Depth Buffer ชั่วคราวเพื่อให้เบลนด์กับเบื้องหลังได้อย่างสมบูรณ์แบบ
          gl.depthMask(false);

          gl.bindBuffer(gl.ARRAY_BUFFER, atmosphereVertexBuffer);
          gl.enableVertexAttribArray(atmospherePosLoc);
          gl.vertexAttribPointer(atmospherePosLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, atmosphereIndexBuffer);

          if (supportUint32 && atmosphereIndicesLength > 65535) {
            gl.drawElements(
              gl.TRIANGLES,
              atmosphereIndicesLength,
              gl.UNSIGNED_INT,
              0,
            );
          } else {
            gl.drawElements(
              gl.TRIANGLES,
              atmosphereIndicesLength,
              gl.UNSIGNED_SHORT,
              0,
            );
          }

          gl.depthMask(true);
        }

        
        // วาดเมฆแก๊สลอยตัว (Gaseous Clouds)
        if (cloudsEnabled) {
          if (typeof window.cloud3DData === "undefined" && typeof window.generateClouds3D === "function") {
              const currentSeed = typeof seedVal !== "undefined" ? seedVal : (typeof window !== "undefined" && typeof window.globalSeed !== "undefined" ? window.globalSeed : 12345);
              const currentRadius = typeof RADIUS !== "undefined" ? RADIUS : 8.0;
              const currentHeight = typeof cloudsHeight !== "undefined" ? cloudsHeight : 12.0;
              window.cloud3DData = window.generateClouds3D(currentSeed, currentRadius, currentHeight);
          }
          if (typeof window.cloud3DData !== "undefined" && window.cloud3DData) {
              if (!cloud3DVertexBuffer) {
                  cloud3DVertexBuffer = gl.createBuffer();
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DVertexBuffer);
                  gl.bufferData(gl.ARRAY_BUFFER, window.cloud3DData.vertices, gl.STATIC_DRAW);
                  
                  cloud3DLocalPosBuffer = gl.createBuffer();
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DLocalPosBuffer);
                  gl.bufferData(gl.ARRAY_BUFFER, window.cloud3DData.localPos, gl.STATIC_DRAW);
                  
                  cloud3DIndexBuffer = gl.createBuffer();
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cloud3DIndexBuffer);
                  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, window.cloud3DData.indices, gl.STATIC_DRAW);
              }

              if (cloud3DVertexBuffer) {
                  gl.useProgram(cloud3DProgram);
                  gl.uniformMatrix4fv(cloud3DMVLoc, false, setF32(f32_modelViewMatrix, modelViewMatrix));
                  gl.uniformMatrix4fv(cloud3DProjLoc, false, setF32(f32_projMatrix, projMatrix));
                  
                  // Calculate Clouds3D Orbital Rotation Matrix around planet
                  const orbAngle = typeof window.cloud3DOrbitAngle === "number" ? window.cloud3DOrbitAngle : 0.0;
                  const cosA = Math.cos(orbAngle);
                  const sinA = Math.sin(orbAngle);
                  const cosT = Math.cos(0.21); // ~12 degree orbital tilt
                  const sinT = Math.sin(0.21);
                  f32_cloudOrbitMatrix[0] = cosA;
                  f32_cloudOrbitMatrix[1] = sinA * sinT;
                  f32_cloudOrbitMatrix[2] = sinA * cosT;
                  f32_cloudOrbitMatrix[3] = 0;
                  f32_cloudOrbitMatrix[4] = 0;
                  f32_cloudOrbitMatrix[5] = cosT;
                  f32_cloudOrbitMatrix[6] = -sinT;
                  f32_cloudOrbitMatrix[7] = 0;
                  f32_cloudOrbitMatrix[8] = -sinA;
                  f32_cloudOrbitMatrix[9] = cosA * sinT;
                  f32_cloudOrbitMatrix[10] = cosA * cosT;
                  f32_cloudOrbitMatrix[11] = 0;
                  f32_cloudOrbitMatrix[12] = 0;
                  f32_cloudOrbitMatrix[13] = 0;
                  f32_cloudOrbitMatrix[14] = 0;
                  f32_cloudOrbitMatrix[15] = 1;
                  if (cloud3DOrbitMatrixLoc) {
                    gl.uniformMatrix4fv(cloud3DOrbitMatrixLoc, false, f32_cloudOrbitMatrix);
                  }

                  gl.uniform3fv(cloud3DColorLoc, setF32(f32_cloudsColor, cloudsColor));
                  gl.uniform1f(cloud3DAlphaLoc, cloudsAlpha);

                  const c3dAnimT = typeof window.cloud3DAnimTime === "number" ? window.cloud3DAnimTime : cloudAnimTime * 0.01;
                  gl.uniform1f(cloud3DTimeLoc, c3dAnimT);
                  if (cloud3DAnimTimeLoc) {
                    gl.uniform1f(cloud3DAnimTimeLoc, c3dAnimT);
                  }

                  gl.uniform3fv(cloud3DLightDirLoc, setF32(f32_finalLightDir, finalLightDir));
                  gl.uniform3fv(cloud3DCameraPosLoc, setF32(f32_eyePos, eyePos));
                  if (cloud3DWaterRadiusLoc) {
                    gl.uniform1f(cloud3DWaterRadiusLoc, waterRadius);
                  }
                  
                  gl.depthMask(false);
                  
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DVertexBuffer);
                  gl.enableVertexAttribArray(cloud3DPosLoc);
                  gl.vertexAttribPointer(cloud3DPosLoc, 3, gl.FLOAT, false, 0, 0);
                  
                  gl.bindBuffer(gl.ARRAY_BUFFER, cloud3DLocalPosBuffer);
                  gl.enableVertexAttribArray(cloud3DLocalPosLoc);
                  gl.vertexAttribPointer(cloud3DLocalPosLoc, 3, gl.FLOAT, false, 0, 0);
                  
                  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cloud3DIndexBuffer);
                  
                  // Frustum Culling with rotated cloud chunks
                  let ranges = [];
                  const fPlanes = typeof frustumPlanes !== 'undefined' ? frustumPlanes : null;
                  if (window.FrustumCullingSystem && typeof window.FrustumCullingSystem.getVisibleCloudRanges === 'function' && fPlanes && typeof frustumCullingEnabled !== 'undefined' && frustumCullingEnabled && window.cloud3DData.chunks) {
                      ranges = window.FrustumCullingSystem.getVisibleCloudRanges(window.cloud3DData.chunks, f32_cloudOrbitMatrix, fPlanes);
                  }
                  if (!ranges || ranges.length === 0) {
                      ranges = [{ start: 0, end: window.cloud3DData.indices.length }];
                  }
                  
                  for (let r = 0; r < ranges.length; r++) {
                      const range = ranges[r];
                      if (range.end > range.start) {
                          gl.drawElements(
                              gl.TRIANGLES,
                              range.end - range.start,
                              gl.UNSIGNED_SHORT,
                              range.start * 2 // 2 bytes per index
                          );
                      }
                  }
                  
                  gl.disableVertexAttribArray(cloud3DLocalPosLoc);
                  gl.depthMask(true);
              }
          }
        }

        waterTime += dt;
        cloudTime += dt * cloudsSpeed;
        cloudShapeTime += 0.06 * dt;

        // Anti-Aliasing (FXAA) Post-Processing Pass
        const isAAPostProcess = !!((typeof fxaaEnabled !== "undefined" && fxaaEnabled) || 
                                   (typeof window.fxaaEnabled !== "undefined" && window.fxaaEnabled) || 
                                   (typeof taauEnabled !== "undefined" && taauEnabled) || 
                                   (typeof window.taauEnabled !== "undefined" && window.taauEnabled) || 
                                   (typeof antialiasEnabled !== "undefined" && antialiasEnabled));
        if (isAAPostProcess && gl) {
          initFXAASystem();
          if (fxaaProgram && fxaaCopyTex) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, fxaaCopyTex);
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);

            gl.useProgram(fxaaProgram);
            gl.uniform1i(fxaaTexLoc, 0);
            gl.uniform2f(fxaaResolutionLoc, canvas.width, canvas.height);

            gl.bindBuffer(gl.ARRAY_BUFFER, fxaaQuadBuffer);
            gl.enableVertexAttribArray(fxaaPosLoc);
            gl.vertexAttribPointer(fxaaPosLoc, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.disableVertexAttribArray(fxaaPosLoc);

            gl.enable(gl.DEPTH_TEST);
          }
        }

        if (typeof updateFloatingNpcHpBars === "function") {
          updateFloatingNpcHpBars(viewMatrix, projMatrix, eyePos);
        }

        if (typeof updateCompassHUD === "function") {
          updateCompassHUD();
        }

        // Next frame
        if (!forceDraw) {
          requestAnimationFrame(render);
        }
      }



