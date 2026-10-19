window.GLBLoader = class GLBLoader {
    constructor() {}
    
    async load(url) {
        let decoded = url;
        try {
            decoded = decodeURI(url);
        } catch (_) {
            decoded = url;
        }
        const encoded = encodeURI(decoded);

        const candidates = [
            encoded,
            decoded,
            encoded.startsWith('/') ? encoded.slice(1) : '/' + encoded,
            decoded.startsWith('/') ? decoded.slice(1) : '/' + decoded
        ];
        // Deduplicate candidates
        const uniquePaths = Array.from(new Set(candidates));

        let response = null;
        let arrayBuffer = null;
        let lastErr = null;

        for (const path of uniquePaths) {
            try {
                const res = await fetch(path);
                const contentType = res.headers.get('content-type') || '';
                // Skip if server returned HTML fallback (e.g. 404 falling back to index.html with 200 OK)
                if (res.ok && !contentType.includes('text/html')) {
                    const buf = await res.arrayBuffer();
                    if (buf && buf.byteLength >= 12) {
                        const dv = new DataView(buf);
                        const magic = dv.getUint32(0, true);
                        if (magic === 0x46546C67) { // 'glTF' in Little Endian
                            response = res;
                            arrayBuffer = buf;
                            break;
                        }
                    }
                }
            } catch (e) {
                lastErr = e;
            }
        }

        if (!arrayBuffer) {
            throw new Error(`Failed to fetch valid GLB from [${url}]. ${lastErr ? lastErr.message : (response ? response.statusText : 'Invalid or missing GLB data')}`);
        }

        this.parse(arrayBuffer);
    }

    parse(arrayBuffer) {
        if (!arrayBuffer || arrayBuffer.byteLength < 20) {
            throw new Error(`Invalid GLB buffer: buffer length too short (${arrayBuffer ? arrayBuffer.byteLength : 0} bytes)`);
        }
        const dataView = new DataView(arrayBuffer);
        let offset = 0;
        
        const magic = dataView.getUint32(offset, true); offset += 4;
        if (magic !== 0x46546C67) {
            throw new Error(`Invalid GLB file: invalid magic header 0x${magic.toString(16)} (expected 0x46546c67 'glTF')`);
        }
        const version = dataView.getUint32(offset, true); offset += 4;
        const length = dataView.getUint32(offset, true); offset += 4;
        
        const jsonChunkLength = dataView.getUint32(offset, true); offset += 4;
        const jsonChunkType = dataView.getUint32(offset, true); offset += 4;
        
        if (offset + jsonChunkLength > arrayBuffer.byteLength) {
            throw new Error(`Invalid GLB file: jsonChunkLength (${jsonChunkLength}) exceeds buffer size (${arrayBuffer.byteLength})`);
        }
        
        const jsonString = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer, offset, jsonChunkLength));
        this.json = JSON.parse(jsonString);
        
        // Chunk boundary alignment to 4 bytes
        offset += (jsonChunkLength + 3) & ~3;
        
        if (offset < arrayBuffer.byteLength) {
            const binChunkLength = dataView.getUint32(offset, true); offset += 4;
            const binChunkType = dataView.getUint32(offset, true); offset += 4;
            
            this.binBuffer = arrayBuffer.slice(offset, offset + binChunkLength);
        } else {
            this.binBuffer = new ArrayBuffer(0);
        }
        
        this._prepareData();
    }

    _prepareData() {
        // Resolve accessors
        this.accessors = this.json.accessors.map(acc => {
            const bv = this.json.bufferViews[acc.bufferView];
            const byteOffset = (acc.byteOffset || 0) + (bv.byteOffset || 0);
            
            let array;
            if (acc.componentType === 5126) { // FLOAT
                array = new Float32Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            } else if (acc.componentType === 5123) { // UNSIGNED_SHORT
                array = new Uint16Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            } else if (acc.componentType === 5125) { // UNSIGNED_INT
                array = new Uint32Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            } else if (acc.componentType === 5121) { // UNSIGNED_BYTE
                array = new Uint8Array(this.binBuffer, byteOffset, acc.count * this._getComponentCount(acc.type));
            }
            return array;
        });

        // Images
        if (this.json.images && this.json.images.length > 0) {
            this.images = [];
            this.json.images.forEach(img => {
                const bv = this.json.bufferViews[img.bufferView];
                const slice = this.binBuffer.slice(bv.byteOffset, bv.byteOffset + bv.byteLength);
                const blob = new Blob([slice], { type: img.mimeType });
                const url = URL.createObjectURL(blob);
                const image = new Image();
                image.src = url;
                this.images.push(image);
            });
        }
        
        // Hierarchy
        this.nodes = this.json.nodes.map(n => ({
            name: n.name,
            translation: (n.translation || [0,0,0]).slice(),
            rotation: (n.rotation || [0,0,0,1]).slice(),
            scale: (n.scale || [1,1,1]).slice(),
            baseTranslation: (n.translation || [0,0,0]).slice(),
            baseRotation: (n.rotation || [0,0,0,1]).slice(),
            baseScale: (n.scale || [1,1,1]).slice(),
            children: n.children || [],
            matrix: new Float32Array(16),
            localMatrix: new Float32Array(16)
        }));

        this.blendCacheState = this.nodes.map(() => ({
            t: [0, 0, 0],
            r: [0, 0, 0, 1],
            s: [1, 1, 1]
        }));
        this.layerCacheState = this.nodes.map(() => ({
            t: [0, 0, 0],
            r: [0, 0, 0, 1],
            s: [1, 1, 1]
        }));
        this._tmpQ0 = [0, 0, 0, 0];
        this._tmpQ1 = [0, 0, 0, 0];

        this.nodes.forEach((n, i) => {
            n.children.forEach(c => {
                this.nodes[c].parent = i;
            });
        });
        
        this.rootNodes = [];
        this.nodes.forEach((n, i) => {
            if (n.parent === undefined) this.rootNodes.push(i);
        });

        // Setup Body Part Masks (Upper Body, Lower Body, Pelvis/Hips)
        this.upperBodyNodes = new Uint8Array(this.nodes.length);
        this.lowerBodyNodes = new Uint8Array(this.nodes.length);
        this.hipsNodeIndex = -1;

        const markDescendants = (idx, maskArray) => {
            maskArray[idx] = 1;
            const node = this.nodes[idx];
            if (node && node.children) {
                for (let c = 0; c < node.children.length; c++) {
                    markDescendants(node.children[c], maskArray);
                }
            }
        };

        this.nodes.forEach((n, i) => {
            const name = (n.name || "").toLowerCase();
            if (name === "hips" || name === "pelvis" || name.includes("hips")) {
                this.hipsNodeIndex = i;
            }
            if (name === "spine02" || name === "spine" || (name.startsWith("spine") && !name.includes("01"))) {
                markDescendants(i, this.upperBodyNodes);
            }
            if (name.includes("upleg") || name === "leftupleg" || name === "rightupleg") {
                markDescendants(i, this.lowerBodyNodes);
            }
        });

        // Heuristic keyword backup to guarantee 100% bone assignment
        this.nodes.forEach((n, i) => {
            const name = (n.name || "").toLowerCase();
            if (name === "hips" || name === "pelvis" || name.includes("hips")) return;
            if (name.includes("spine") || name.includes("neck") || name.includes("head") ||
                name.includes("shoulder") || name.includes("arm") || name.includes("hand")) {
                this.upperBodyNodes[i] = 1;
            } else if (name.includes("leg") || name.includes("foot") || name.includes("toe")) {
                this.lowerBodyNodes[i] = 1;
            }
        });

        // Animations
        if (this.json.animations) {
            this.animations = this.json.animations.map(anim => {
                return {
                    name: anim.name,
                    duration: this._calcDuration(anim),
                    channels: anim.channels.map(ch => {
                        const sampler = anim.samplers[ch.sampler];
                        return {
                            node: ch.target.node,
                            path: ch.target.path,
                            input: this.accessors[sampler.input],
                            output: this.accessors[sampler.output]
                        };
                    })
                };
            });
        }

        // Skin
        if (this.json.skins && this.json.skins.length > 0) {
            const skin = this.json.skins[0];
            this.skin = {
                joints: skin.joints,
                inverseBindMatrices: this.accessors[skin.inverseBindMatrices]
            };
            this.jointMatrices = new Float32Array(skin.joints.length * 16);
        }

        // Mesh
        const mesh = this.json.meshes[0];
        const prim = mesh.primitives[0];
        
        this.basePositions = this.accessors[prim.attributes.POSITION];
        this.baseNormals = this.accessors[prim.attributes.NORMAL];
        if(prim.attributes.COLOR_0) {
            this.baseColors = this.accessors[prim.attributes.COLOR_0];
        } else {
            this.baseColors = new Float32Array(this.basePositions.length);
            for(let i=0; i<this.baseColors.length; i++) this.baseColors[i] = 1.0;
        }
        
        if (prim.attributes.TEXCOORD_0 !== undefined) {
            this.baseTexCoords = this.accessors[prim.attributes.TEXCOORD_0];
        } else {
            this.baseTexCoords = new Float32Array((this.basePositions.length / 3) * 2);
        }
        
        this.joints = this.accessors[prim.attributes.JOINTS_0];
        this.weights = this.accessors[prim.attributes.WEIGHTS_0];
        this.indices = this.accessors[prim.indices];
        this.vertexCount = this.basePositions.length / 3;

        this.outPositions = new Float32Array(this.basePositions.length);
        this.outNormals = new Float32Array(this.baseNormals.length);

        // Precalculate vertex dominant bone index and body part group for inspector & diagnostics
        this.vertexDominantBones = new Int16Array(this.vertexCount);
        this.vertexPartGroups = new Uint8Array(this.vertexCount); // 0: head, 1: torso, 2: left_arm, 3: right_arm, 4: left_leg, 5: right_leg
        this.dominantBoneVertexCounts = {};

        const getPartGroupIndex = (boneName) => {
            const n = (boneName || "").toLowerCase();
            if (n.includes("head") || n.includes("neck")) return 0;
            if (n.includes("spine") || n.includes("hips") || n.includes("pelvis")) return 1;
            if (n.includes("left") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) return 2;
            if (n.includes("right") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) return 3;
            if (n.includes("left") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) return 4;
            if (n.includes("right") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) return 5;
            return 1;
        };

        if (this.joints && this.weights && this.skin) {
            for (let i = 0; i < this.vertexCount; i++) {
                let maxW = -1;
                let maxJ = 0;
                const i4 = i * 4;
                for (let j = 0; j < 4; j++) {
                    const w = this.weights[i4 + j];
                    if (w > maxW) {
                        maxW = w;
                        maxJ = this.joints[i4 + j];
                    }
                }
                const boneNodeIdx = this.skin.joints[maxJ];
                this.vertexDominantBones[i] = boneNodeIdx;
                this.dominantBoneVertexCounts[boneNodeIdx] = (this.dominantBoneVertexCounts[boneNodeIdx] || 0) + 1;
                const bName = this.nodes[boneNodeIdx] ? this.nodes[boneNodeIdx].name : "";
                this.vertexPartGroups[i] = getPartGroupIndex(bName);
            }
        }

        // Setup Virtual Bone for Ponytail Hair (แนวทางที่ 3: Virtual Bone Skinning)
        this._setupVirtualPonytailBone();

        // Refine Hand & Finger Geometry: chubby 3D volume, natural relaxed resting curve, smooth normals
        this._refineHandGeometry();

        // Setup Virtual Finger Bones for Left & Right Hands
        this._setupVirtualFingerBones();
    }

    _invertMat4(out, a) {
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
    }

    _setupVirtualPonytailBone() {
        if (!this.basePositions || !this.indices || !this.skin || !this.skin.joints) return;
        const vCount = this.vertexCount;
        const pos = this.basePositions;
        const ind = this.indices;

        // Disjoint-set union on triangles to find connected components
        const parent = new Int32Array(vCount);
        for (let i = 0; i < vCount; i++) parent[i] = i;
        function find(i) {
            let root = i;
            while (root !== parent[root]) root = parent[root];
            let cur = i;
            while (cur !== root) {
                const next = parent[cur];
                parent[cur] = root;
                cur = next;
            }
            return root;
        }
        function union(i, j) {
            const ri = find(i), rj = find(j);
            if (ri !== rj) parent[ri] = rj;
        }

        const indLen = ind.length;
        for (let i = 0; i < indLen; i += 3) {
            union(ind[i], ind[i + 1]);
            union(ind[i + 1], ind[i + 2]);
        }

        // Identify connected components belonging specifically to the hanging ponytail bunch (ช่อผมหางม้า 823 จุด)
        // Keeps the side of the head hair strictly attached to the head bone
        const ponytailRoots = new Set();
        for (let i = 0; i < vCount; i++) {
            const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
            if (x > 0.05 && y > 0.80 && y < 0.95 && z < -0.10) {
                ponytailRoots.add(find(i));
            }
        }

        if (ponytailRoots.size === 0) return;

        // Find root (highest Y) and tip (lowest Y) of the full ponytail
        let rootY = -Infinity;
        let tipY = Infinity;
        let rootVertexIdx = 0;
        for (let i = 0; i < vCount; i++) {
            if (ponytailRoots.has(find(i))) {
                const y = pos[i * 3 + 1];
                if (y > rootY) {
                    rootY = y;
                    rootVertexIdx = i;
                }
                if (y < tipY) {
                    tipY = y;
                }
            }
        }
        const heightSpan = Math.max(0.01, rootY - tipY);

        const ponytailIndices = [];
        const ponytailWeights = new Float32Array(vCount);

        for (let i = 0; i < vCount; i++) {
            if (ponytailRoots.has(find(i))) {
                ponytailIndices.push(i);
                this.vertexPartGroups[i] = 6; // Hair
                const y = pos[i * 3 + 1];
                let t = (rootY - y) / heightSpan;
                if (t < 0) t = 0;
                if (t > 1) t = 1;
                // Smooth progressive bending curve: root follows head tightly, tip swings with virtual bone
                ponytailWeights[i] = t * t * (3 - 2 * t);
            }
        }

        this.ponytailIndices = new Int32Array(ponytailIndices);
        this.ponytailWeights = ponytailWeights;
        this.ponytailRootVertex = rootVertexIdx;

        // Find Head Node and Head Joint in the loaded skeleton
        const headNodeIdx = this.nodes.findIndex(n => n && n.name && n.name.toLowerCase() === "head");
        if (headNodeIdx === -1) return;
        const headJointIdx = this.skin.joints.indexOf(headNodeIdx);
        if (headJointIdx === -1) return;

        // Compute root vertex local position in Head coordinate space
        const headInvBind = this.skin.inverseBindMatrices.subarray(headJointIdx * 16, headJointIdx * 16 + 16);
        const px = pos[rootVertexIdx * 3];
        const py = pos[rootVertexIdx * 3 + 1];
        const pz = pos[rootVertexIdx * 3 + 2];

        const localX = headInvBind[0]*px + headInvBind[4]*py + headInvBind[8]*pz + headInvBind[12];
        const localY = headInvBind[1]*px + headInvBind[5]*py + headInvBind[9]*pz + headInvBind[13];
        const localZ = headInvBind[2]*px + headInvBind[6]*py + headInvBind[10]*pz + headInvBind[14];

        // 1. Create Virtual Bone Node in memory as child of Head
        const virtualNodeIdx = this.nodes.length;
        const virtualNode = {
            name: "Virtual_Ponytail",
            translation: [localX, localY, localZ],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            baseTranslation: [localX, localY, localZ],
            baseRotation: [0, 0, 0, 1],
            baseScale: [1, 1, 1],
            children: [],
            parent: headNodeIdx,
            matrix: new Float32Array(16),
            localMatrix: new Float32Array(16)
        };
        this.nodes.push(virtualNode);
        this.nodes[headNodeIdx].children.push(virtualNodeIdx);

        // Update animation layer & blending cache arrays
        this.blendCacheState.push({ t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
        this.layerCacheState.push({ t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
        if (this.upperBodyNodes) {
            const newUpper = new Uint8Array(this.nodes.length);
            newUpper.set(this.upperBodyNodes);
            newUpper[virtualNodeIdx] = 1;
            this.upperBodyNodes = newUpper;
        }
        if (this.lowerBodyNodes) {
            const newLower = new Uint8Array(this.nodes.length);
            newLower.set(this.lowerBodyNodes);
            this.lowerBodyNodes = newLower;
        }

        // 2. Compute Virtual Bone inverseBindMatrix
        const headBindWorld = new Float32Array(16);
        this._invertMat4(headBindWorld, headInvBind);

        const virtualLocalBind = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            localX, localY, localZ, 1
        ]);
        const virtualWorldBind = new Float32Array(16);
        this._multiplyMat4(virtualWorldBind, headBindWorld, virtualLocalBind);

        const virtualInvBind = new Float32Array(16);
        this._invertMat4(virtualInvBind, virtualWorldBind);

        // 3. Register Virtual Bone into skin.joints and skin.inverseBindMatrices
        const virtualJointIdx = this.skin.joints.length;
        this.skin.joints = [...this.skin.joints, virtualNodeIdx];

        const newInvBind = new Float32Array(this.skin.joints.length * 16);
        newInvBind.set(this.skin.inverseBindMatrices);
        newInvBind.set(virtualInvBind, virtualJointIdx * 16);
        this.skin.inverseBindMatrices = newInvBind;

        this.jointMatrices = new Float32Array(this.skin.joints.length * 16);

        // 4. Re-weight ponytail vertices to blend between Head and Virtual Bone
        this.joints = new Uint8Array(this.joints);
        this.weights = new Float32Array(this.weights);

        const pLen = ponytailIndices.length;
        for (let k = 0; k < pLen; k++) {
            const vi = ponytailIndices[k];
            const wi = ponytailWeights[vi];
            const i4 = vi * 4;

            // Slot 0 was Head with weight ~1.0. Re-route weight into Virtual Bone at slot 2:
            const origHeadW = this.weights[i4];
            this.joints[i4 + 2] = virtualJointIdx;
            this.weights[i4] = origHeadW * (1.0 - wi);
            this.weights[i4 + 2] = origHeadW * wi;

            // Update dominant bone count for Dev Inspector
            if (wi >= 0.5) {
                this.vertexDominantBones[vi] = virtualNodeIdx;
                this.dominantBoneVertexCounts[virtualNodeIdx] = (this.dominantBoneVertexCounts[virtualNodeIdx] || 0) + 1;
                if (this.dominantBoneVertexCounts[headNodeIdx]) {
                    this.dominantBoneVertexCounts[headNodeIdx]--;
                }
            }
        }

        this.virtualPonytailNodeIdx = virtualNodeIdx;
        this.virtualPonytailJointIdx = virtualJointIdx;
        this.virtualPonytailRotation = [0, 0, 0, 1];
    }

    _refineHandGeometry() {
        if (!this.basePositions || !this.indices || !this.skin || !this.skin.joints || !this.skin.inverseBindMatrices) return;

        const findJoint = (name) => {
            const nodeIdx = this.nodes.findIndex(n => n && n.name && n.name.toLowerCase() === name.toLowerCase());
            return nodeIdx !== -1 ? this.skin.joints.indexOf(nodeIdx) : -1;
        };

        const rHandJoint = findJoint("RightHand");
        const rEndJoint = findJoint("RightHand_End");
        const lHandJoint = findJoint("LeftHand");
        const lEndJoint = findJoint("LeftHand_End");

        if (rHandJoint === -1 && lHandJoint === -1) return;

        this.basePositions = new Float32Array(this.basePositions);
        this.baseNormals = new Float32Array(this.baseNormals);
        const pos = this.basePositions;
        const bind = new Float32Array(16);

        const getFingerCenter = (lz, isRight) => {
            if (isRight) {
                if (lz > 0.04) return 0.002;
                return 0.35 * lz + 0.006;
            } else {
                if (lz > 0.04) return -0.002;
                return -0.35 * lz - 0.006;
            }
        };

        const refineOne = (handJointIdx, endJointIdx, isRight) => {
            if (handJointIdx === -1) return;
            const inv = this.skin.inverseBindMatrices.subarray(handJointIdx * 16, handJointIdx * 16 + 16);
            this._invertMat4(bind, inv);
            const palmDir = isRight ? -1.0 : 1.0;

            for (let i = 0; i < this.vertexCount; i++) {
                let w = 0;
                const i4 = i * 4;
                for (let j = 0; j < 4; j++) {
                    const jt = this.joints[i4 + j];
                    if (jt === handJointIdx || (endJointIdx !== -1 && jt === endJointIdx)) {
                        w += this.weights[i4 + j];
                    }
                }
                if (w < 0.2) continue;

                const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
                let lx = inv[0]*px + inv[4]*py + inv[8]*pz + inv[12];
                let ly = inv[1]*px + inv[5]*py + inv[9]*pz + inv[13];
                let lz = inv[2]*px + inv[6]*py + inv[10]*pz + inv[14];

                // Hand influence ramp (wrist ly ~ 0.02 to knuckles ly ~ 0.08 to fingertips ly ~ 0.15)
                const handT = Math.min(1.0, Math.max(0.0, (ly - 0.02) / 0.05)) * Math.min(1.0, w * 1.25);
                if (handT <= 0.0) continue;

                const centerLx = getFingerCenter(lz, isRight);
                let dLx = lx - centerLx;

                const isFinger = ly > 0.075;
                const isThumb = lz >= 0.040;

                // 1. Give plump, rounded 3D volume to thin fingers
                let plump = 1.0;
                if (isFinger) {
                    const fProg = Math.min(1.0, (ly - 0.075) / 0.045);
                    if (isThumb) {
                        plump = 1.0 + 0.35 * fProg;
                    } else {
                        // Increase thickness of fingers (especially pinky, ring, middle which were 0.010 - 0.018)
                        plump = 1.0 + 0.85 * fProg;
                    }
                } else {
                    // Palm gentle plumpness
                    plump = 1.0 + 0.25 * Math.min(1.0, Math.max(0.0, (ly - 0.03) / 0.04));
                }

                let targetLx = centerLx + dLx * plump;
                let targetLy = ly;
                let targetLz = lz;

                // 2. Relaxed Natural Finger Curling
                if (isFinger) {
                    if (isThumb) {
                        if (ly > 0.072) {
                            const tProg = Math.min(1.0, (ly - 0.072) / 0.055);
                            // Thumb relaxes inwards towards palm and towards index finger
                            targetLx += palmDir * 0.012 * (tProg * tProg);
                            targetLz -= 0.007 * tProg;
                            targetLy -= 0.003 * (tProg * tProg);
                        }
                    } else {
                        const fProg = Math.min(1.0, (ly - 0.075) / 0.065);
                        // Fingers curl progressively into gentle, natural resting curve
                        const curl = 0.018 * (fProg * fProg + 0.2 * fProg);
                        targetLx += palmDir * curl;
                        targetLy -= 0.005 * (fProg * fProg);
                        // Softly draw outer fingers slightly together
                        if (lz < -0.02) targetLz += 0.004 * fProg;
                        if (lz > 0.01 && lz < 0.035) targetLz -= 0.003 * fProg;
                    }
                }

                // Smooth blend
                const finalLx = lx + (targetLx - lx) * handT;
                const finalLy = ly + (targetLy - ly) * handT;
                const finalLz = lz + (targetLz - lz) * handT;

                pos[i * 3] = bind[0]*finalLx + bind[4]*finalLy + bind[8]*finalLz + bind[12];
                pos[i * 3 + 1] = bind[1]*finalLx + bind[5]*finalLy + bind[9]*finalLz + bind[13];
                pos[i * 3 + 2] = bind[2]*finalLx + bind[6]*finalLy + bind[10]*finalLz + bind[14];
            }
        };

        refineOne(rHandJoint, rEndJoint, true);
        refineOne(lHandJoint, lEndJoint, false);

        // Recompute smooth normals for hand vertices
        const ind = this.indices;
        const norms = new Float32Array(this.vertexCount * 3);
        const handVertMask = new Uint8Array(this.vertexCount);

        for (let i = 0; i < this.vertexCount; i++) {
            let w = 0;
            const i4 = i * 4;
            for (let j = 0; j < 4; j++) {
                const jt = this.joints[i4 + j];
                if (jt === rHandJoint || jt === lHandJoint || jt === rEndJoint || jt === lEndJoint) {
                    w += this.weights[i4 + j];
                }
            }
            if (w > 0.15) handVertMask[i] = 1;
        }

        for (let t = 0; t < ind.length; t += 3) {
            const i0 = ind[t], i1 = ind[t+1], i2 = ind[t+2];
            if (!handVertMask[i0] && !handVertMask[i1] && !handVertMask[i2]) continue;

            const p0x = pos[i0*3], p0y = pos[i0*3+1], p0z = pos[i0*3+2];
            const p1x = pos[i1*3], p1y = pos[i1*3+1], p1z = pos[i1*3+2];
            const p2x = pos[i2*3], p2y = pos[i2*3+1], p2z = pos[i2*3+2];

            const e1x = p1x - p0x, e1y = p1y - p0y, e1z = p1z - p0z;
            const e2x = p2x - p0x, e2y = p2y - p0y, e2z = p2z - p0z;
            const fnx = e1y * e2z - e1z * e2y;
            const fny = e1z * e2x - e1x * e2z;
            const fnz = e1x * e2y - e1y * e2x;

            if (handVertMask[i0]) { norms[i0*3] += fnx; norms[i0*3+1] += fny; norms[i0*3+2] += fnz; }
            if (handVertMask[i1]) { norms[i1*3] += fnx; norms[i1*3+1] += fny; norms[i1*3+2] += fnz; }
            if (handVertMask[i2]) { norms[i2*3] += fnx; norms[i2*3+1] += fny; norms[i2*3+2] += fnz; }
        }

        const baseN = this.baseNormals;
        for (let i = 0; i < this.vertexCount; i++) {
            if (handVertMask[i]) {
                const nx = norms[i*3], ny = norms[i*3+1], nz = norms[i*3+2];
                const len = Math.hypot(nx, ny, nz);
                if (len > 1e-6) {
                    baseN[i*3] = nx / len;
                    baseN[i*3+1] = ny / len;
                    baseN[i*3+2] = nz / len;
                }
            }
        }
    }

    _setupVirtualFingerBones() {
        if (!this.skin || !this.skin.joints || !this.skin.inverseBindMatrices) return;

        const findNode = (name) => this.nodes.findIndex(n => n && n.name && n.name.toLowerCase() === name.toLowerCase());
        const rHandNodeIdx = findNode("RightHand");
        const lHandNodeIdx = findNode("LeftHand");
        if (rHandNodeIdx === -1 || lHandNodeIdx === -1) return;

        const rHandJoint = this.skin.joints.indexOf(rHandNodeIdx);
        const lHandJoint = this.skin.joints.indexOf(lHandNodeIdx);
        if (rHandJoint === -1 || lHandJoint === -1) return;

        const rEndNodeIdx = findNode("RightHand_End");
        const lEndNodeIdx = findNode("LeftHand_End");
        const rEndJoint = rEndNodeIdx !== -1 ? this.skin.joints.indexOf(rEndNodeIdx) : -1;
        const lEndJoint = lEndNodeIdx !== -1 ? this.skin.joints.indexOf(lEndNodeIdx) : -1;

        // Helper to dynamically insert virtual bones into the armature and skinning pipeline
        const addVirtualBone = (name, parentNodeIdx, parentJointIdx, localX, localY, localZ) => {
            const parentInvBind = this.skin.inverseBindMatrices.subarray(parentJointIdx * 16, parentJointIdx * 16 + 16);
            const parentBindWorld = new Float32Array(16);
            this._invertMat4(parentBindWorld, parentInvBind);

            const virtualNodeIdx = this.nodes.length;
            const virtualNode = {
                name: name,
                translation: [localX, localY, localZ],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
                baseTranslation: [localX, localY, localZ],
                baseRotation: [0, 0, 0, 1],
                baseScale: [1, 1, 1],
                children: [],
                parent: parentNodeIdx,
                matrix: new Float32Array(16),
                localMatrix: new Float32Array(16)
            };
            this.nodes.push(virtualNode);
            this.nodes[parentNodeIdx].children.push(virtualNodeIdx);

            this.blendCacheState.push({ t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
            this.layerCacheState.push({ t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] });
            if (this.upperBodyNodes) {
                const newUpper = new Uint8Array(this.nodes.length);
                newUpper.set(this.upperBodyNodes);
                newUpper[virtualNodeIdx] = 1;
                this.upperBodyNodes = newUpper;
            }
            if (this.lowerBodyNodes) {
                const newLower = new Uint8Array(this.nodes.length);
                newLower.set(this.lowerBodyNodes);
                this.lowerBodyNodes = newLower;
            }

            const virtualLocalBind = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                localX, localY, localZ, 1
            ]);
            const virtualWorldBind = new Float32Array(16);
            this._multiplyMat4(virtualWorldBind, parentBindWorld, virtualLocalBind);
            const virtualInvBind = new Float32Array(16);
            this._invertMat4(virtualInvBind, virtualWorldBind);

            const virtualJointIdx = this.skin.joints.length;
            this.skin.joints = [...this.skin.joints, virtualNodeIdx];
            const newInvBind = new Float32Array(this.skin.joints.length * 16);
            newInvBind.set(this.skin.inverseBindMatrices);
            newInvBind.set(virtualInvBind, virtualJointIdx * 16);
            this.skin.inverseBindMatrices = newInvBind;
            this.jointMatrices = new Float32Array(this.skin.joints.length * 16);

            return { nodeIdx: virtualNodeIdx, jointIdx: virtualJointIdx };
        };

        // 1. Right Hand: 3-Joint Anatomical Chain (MCP Base -> PIP Mid -> DIP Tip)
        const rBase = addVirtualBone("Virtual_RightFingers", rHandNodeIdx, rHandJoint, 0.0, 0.068, 0.0);
        const rMid = addVirtualBone("Virtual_RightFingers_Mid", rBase.nodeIdx, rBase.jointIdx, 0.0, 0.030, 0.0);
        const rTip = addVirtualBone("Virtual_RightFingers_Tip", rMid.nodeIdx, rMid.jointIdx, 0.0, 0.024, 0.0);

        // 2. Left Hand: 3-Joint Anatomical Chain (MCP Base -> PIP Mid -> DIP Tip)
        const lBase = addVirtualBone("Virtual_LeftFingers", lHandNodeIdx, lHandJoint, 0.0, 0.068, 0.0);
        const lMid = addVirtualBone("Virtual_LeftFingers_Mid", lBase.nodeIdx, lBase.jointIdx, 0.0, 0.030, 0.0);
        const lTip = addVirtualBone("Virtual_LeftFingers_Tip", lMid.nodeIdx, lMid.jointIdx, 0.0, 0.024, 0.0);

        this.virtualRightFingersNodeIdx = rBase.nodeIdx;
        this.virtualRightFingersJointIdx = rBase.jointIdx;
        this.virtualRightFingersMidNodeIdx = rMid.nodeIdx;
        this.virtualRightFingersMidJointIdx = rMid.jointIdx;
        this.virtualRightFingersTipNodeIdx = rTip.nodeIdx;
        this.virtualRightFingersTipJointIdx = rTip.jointIdx;

        this.virtualLeftFingersNodeIdx = lBase.nodeIdx;
        this.virtualLeftFingersJointIdx = lBase.jointIdx;
        this.virtualLeftFingersMidNodeIdx = lMid.nodeIdx;
        this.virtualLeftFingersMidJointIdx = lMid.jointIdx;
        this.virtualLeftFingersTipNodeIdx = lTip.nodeIdx;
        this.virtualLeftFingersTipJointIdx = lTip.jointIdx;

        this.virtualRightFingersRotation = [0, 0, 0, 1];
        this.virtualRightFingersMidRotation = [0, 0, 0, 1];
        this.virtualRightFingersTipRotation = [0, 0, 0, 1];
        this.virtualLeftFingersRotation = [0, 0, 0, 1];
        this.virtualLeftFingersMidRotation = [0, 0, 0, 1];
        this.virtualLeftFingersTipRotation = [0, 0, 0, 1];

        this.joints = new Uint8Array(this.joints);
        this.weights = new Float32Array(this.weights);

        // Hierarchical Skinning Weight Distribution across Hand -> MCP Base -> PIP Mid -> DIP Tip
        const assignHandWeights = (hJoint, endJoint, baseJoint, midJoint, tipJoint, baseNodeIdx, midNodeIdx, tipNodeIdx, hNodeIdx, isRight) => {
            const invH = this.skin.inverseBindMatrices.subarray(hJoint * 16, hJoint * 16 + 16);
            for (let i = 0; i < this.vertexCount; i++) {
                let handSlot = -1;
                let endSlot = -1;
                let totalHandW = 0;
                const i4 = i * 4;
                for (let j = 0; j < 4; j++) {
                    const jt = this.joints[i4 + j];
                    const w = this.weights[i4 + j];
                    if (jt === hJoint) {
                        handSlot = j;
                        totalHandW += w;
                    } else if (endJoint !== -1 && jt === endJoint) {
                        endSlot = j;
                        totalHandW += w;
                    }
                }
                if (totalHandW < 0.15) continue;

                const px = this.basePositions[i*3], py = this.basePositions[i*3+1], pz = this.basePositions[i*3+2];
                const lx = invH[0]*px + invH[4]*py + invH[8]*pz + invH[12];
                const ly = invH[1]*px + invH[5]*py + invH[9]*pz + invH[13];
                const lz = invH[2]*px + invH[6]*py + invH[10]*pz + invH[14];

                // Detect finger type to apply anatomical knuckle thresholds
                const isThumb = ly <= 0.098 && lz > 0.040 && (isRight ? lx < -0.005 : lx > 0.005);

                let fHand = 0, fBase = 0, fMid = 0, fTip = 0;

                if (isThumb) {
                    const baseThresh = 0.052;
                    const midThresh = 0.075;
                    const tipThresh = 0.098;
                    if (ly <= baseThresh) {
                        fHand = 1.0;
                    } else if (ly <= midThresh) {
                        const t = (ly - baseThresh) / (midThresh - baseThresh);
                        fBase = t;
                        fHand = 1.0 - t;
                    } else {
                        const t = Math.min(1.0, (ly - midThresh) / (tipThresh - midThresh));
                        fMid = t;
                        fBase = 1.0 - t;
                    }
                } else {
                    let baseThresh = 0.066;
                    let midThresh = 0.096;
                    let tipThresh = 0.122;
                    let endThresh = 0.146;
                    if (lz < -0.026) {
                        // Pinky finger is shorter
                        baseThresh = 0.058; midThresh = 0.086; tipThresh = 0.108; endThresh = 0.122;
                    } else if (lz > 0.026) {
                        // Index finger
                        baseThresh = 0.064; midThresh = 0.094; tipThresh = 0.118; endThresh = 0.142;
                    }

                    // Continuous C1 Hermite smooth blending to ensure a curved, natural organic arch (ไม่หักมุมเป็นตัว L)
                    if (ly <= baseThresh) {
                        const t = Math.max(0.0, (ly - (baseThresh - 0.012)) / 0.012);
                        const s = t * t * (3.0 - 2.0 * t);
                        fHand = 1.0 - 0.25 * s;
                        fBase = 0.25 * s;
                        fMid = 0.0;
                        fTip = 0.0;
                    } else if (ly <= midThresh) {
                        const t = (ly - baseThresh) / (midThresh - baseThresh);
                        const s = t * t * (3.0 - 2.0 * t);
                        fHand = (1.0 - s) * 0.75;
                        fBase = (1.0 - s) * 0.25 + s * (1.0 - 0.5 * s);
                        fMid = s * 0.5 * s;
                        fTip = 0.0;
                    } else if (ly <= tipThresh) {
                        const t = (ly - midThresh) / (tipThresh - midThresh);
                        const s = t * t * (3.0 - 2.0 * t);
                        fHand = 0.0;
                        fBase = (1.0 - s) * 0.35;
                        fMid = (1.0 - s) * 0.65 + s * (1.0 - 0.7 * s);
                        fTip = s * 0.7 * s;
                    } else {
                        const t = Math.min(1.0, (ly - tipThresh) / (endThresh - tipThresh));
                        const s = t * t * (3.0 - 2.0 * t);
                        fHand = 0.0;
                        fBase = 0.0;
                        fMid = (1.0 - s) * 0.30;
                        fTip = 0.70 + 0.30 * s;
                    }
                }

                const sumF = fHand + fBase + fMid + fTip;
                if (sumF > 0.0001) {
                    fHand /= sumF; fBase /= sumF; fMid /= sumF; fTip /= sumF;
                }

                if (fHand < 0.999) {
                    const wBase = totalHandW * fBase;
                    const wMid = totalHandW * fMid;
                    const wTip = totalHandW * fTip;
                    const wHand = totalHandW * fHand;

                    if (handSlot !== -1) this.weights[i4 + handSlot] = 0;
                    if (endSlot !== -1) this.weights[i4 + endSlot] = 0;

                    const getFreeSlot = (avoid) => {
                        for (let j = 0; j < 4; j++) {
                            if (!avoid.includes(j) && this.weights[i4 + j] < 0.001) return j;
                        }
                        let minW = 999, s = -1;
                        for (let j = 0; j < 4; j++) {
                            if (!avoid.includes(j) && this.weights[i4 + j] < minW) { minW = this.weights[i4 + j]; s = j; }
                        }
                        return s;
                    };

                    const assigned = [];
                    const assignJoint = (jIdx, weight) => {
                        if (weight <= 0.005) return;
                        const s = getFreeSlot(assigned);
                        if (s !== -1) {
                            assigned.push(s);
                            this.joints[i4 + s] = jIdx;
                            this.weights[i4 + s] = weight;
                        }
                    };

                    if (wHand > 0.005) assignJoint(hJoint, wHand);
                    if (wBase > 0.005) assignJoint(baseJoint, wBase);
                    if (wMid > 0.005) assignJoint(midJoint, wMid);
                    if (wTip > 0.005) assignJoint(tipJoint, wTip);

                    let dominantIdx = hNodeIdx;
                    let maxWeight = wHand;
                    if (wBase > maxWeight) { maxWeight = wBase; dominantIdx = baseNodeIdx; }
                    if (wMid > maxWeight) { maxWeight = wMid; dominantIdx = midNodeIdx; }
                    if (wTip > maxWeight) { maxWeight = wTip; dominantIdx = tipNodeIdx; }

                    if (this.vertexDominantBones) this.vertexDominantBones[i] = dominantIdx;
                    this.dominantBoneVertexCounts[dominantIdx] = (this.dominantBoneVertexCounts[dominantIdx] || 0) + 1;
                    if (this.dominantBoneVertexCounts[hNodeIdx]) this.dominantBoneVertexCounts[hNodeIdx]--;

                    let totalW = 0;
                    for (let j = 0; j < 4; j++) totalW += this.weights[i4 + j];
                    if (totalW > 0.0001) {
                        for (let j = 0; j < 4; j++) this.weights[i4 + j] /= totalW;
                    }
                }
            }
        };

        assignHandWeights(rHandJoint, rEndJoint, rBase.jointIdx, rMid.jointIdx, rTip.jointIdx, rBase.nodeIdx, rMid.nodeIdx, rTip.nodeIdx, rHandNodeIdx, true);
        assignHandWeights(lHandJoint, lEndJoint, lBase.jointIdx, lMid.jointIdx, lTip.jointIdx, lBase.nodeIdx, lMid.nodeIdx, lTip.nodeIdx, lHandNodeIdx, false);

        // Precompute per-vertex finger spread mapping for both hands
        this.fingerSpreadMap = [];
        const findJoint = (name) => {
            const nodeIdx = this.nodes.findIndex(n => n && n.name && n.name.toLowerCase() === name.toLowerCase());
            return nodeIdx !== -1 ? this.skin.joints.indexOf(nodeIdx) : -1;
        };
        const rHandJ = findJoint("RightHand");
        const rEndJ = findJoint("RightHand_End");
        const lHandJ = findJoint("LeftHand");
        const lEndJ = findJoint("LeftHand_End");
        const invBind = this.skin.inverseBindMatrices;

        const collectHandFingers = (handJoint, endJoint, virtJoint, virtMidJoint, virtTipJoint, isRight) => {
            if (handJoint === -1) return;
            const inv = invBind.subarray(handJoint * 16, handJoint * 16 + 16);
            for (let i = 0; i < this.vertexCount; i++) {
                let w = 0;
                const i4 = i * 4;
                for (let j = 0; j < 4; j++) {
                    const jt = this.joints[i4 + j];
                    if (jt === handJoint || jt === endJoint || 
                        (virtJoint !== undefined && jt === virtJoint) || 
                        (virtMidJoint !== undefined && jt === virtMidJoint) ||
                        (virtTipJoint !== undefined && jt === virtTipJoint)) {
                        w += this.weights[i4 + j];
                    }
                }
                if (w < 0.20) continue;
                const px = this.basePositions[i*3], py = this.basePositions[i*3+1], pz = this.basePositions[i*3+2];
                const lx = inv[0]*px + inv[4]*py + inv[8]*pz + inv[12];
                const ly = inv[1]*px + inv[5]*py + inv[9]*pz + inv[13];
                const lz = inv[2]*px + inv[6]*py + inv[10]*pz + inv[14];

                // Classify each of the 5 fingers accurately in hand-local space
                // Thumb is distinctly shorter (ly <= 0.098m), at lateral side (lx < -0.005 on Right, lx > 0.005 on Left), with lz > 0.040m
                const isThumb = ly <= 0.098 && lz > 0.040 && (isRight ? lx < -0.005 : lx > 0.005);

                let fingerBaseLy = 0.070;
                let fingerTipLy = 0.145;
                let sDirZ = 0;
                let sDirX = 0;

                if (isThumb) {
                    fingerBaseLy = 0.052;
                    fingerTipLy = 0.095;
                    // Thumb spreads forward (+Z) and outward in X
                    sDirZ = 1.70;
                    sDirX = isRight ? -0.85 : 0.85;
                } else if (lz > 0.028) {
                    fingerBaseLy = 0.068;
                    fingerTipLy = 0.140;
                    // Index finger: spreads outward towards +Z
                    sDirZ = 0.95;
                    sDirX = isRight ? 0.25 : -0.25;
                } else if (lz > 0.000) {
                    fingerBaseLy = 0.070;
                    fingerTipLy = 0.147;
                    // Middle finger: central anchor
                    sDirZ = 0.0;
                    sDirX = 0.0;
                } else if (lz > -0.026) {
                    fingerBaseLy = 0.068;
                    fingerTipLy = 0.132;
                    // Ring finger: spreads outward towards -Z
                    sDirZ = -0.95;
                    sDirX = isRight ? 0.05 : -0.05;
                } else {
                    fingerBaseLy = 0.058;
                    fingerTipLy = 0.116;
                    // Pinky finger: spreads strongly outward towards -Z
                    sDirZ = -1.80;
                    sDirX = isRight ? -0.20 : 0.20;
                }

                if (ly > fingerBaseLy) {
                    const prog = Math.min(1.0, Math.max(0.0, (ly - fingerBaseLy) / (fingerTipLy - fingerBaseLy)));

                    this.fingerSpreadMap.push({
                        i,
                        handJoint,
                        isRight,
                        isThumb,
                        prog,
                        sDirZ,
                        sDirX,
                        weight: Math.min(1.0, w)
                    });
                }
            }
        };

        collectHandFingers(rHandJ, rEndJ, this.virtualRightFingersJointIdx, this.virtualRightFingersMidJointIdx, this.virtualRightFingersTipJointIdx, true);
        collectHandFingers(lHandJ, lEndJ, this.virtualLeftFingersJointIdx, this.virtualLeftFingersMidJointIdx, this.virtualLeftFingersTipJointIdx, false);

        this.handPose = {
            rightCurl: 0.0,
            leftCurl: 0.0,
            rightSpread: 0.0,
            leftSpread: 0.0
        };
    }

    /**
     * Set Hand Pose:
     * - curl: 0.0 (open/flat palm) to 1.0 (closed fist กำมือ) or negative (bent back)
     * - spread: 0.0 (natural) to 1.0 (wide spread finger fan แยกนิ้ว) or -1.0 (tightly grouped fingers หุบนิ้ว)
     */
    setHandPose(options = {}) {
        if (!this.handPose) {
            this.handPose = { rightCurl: 0.0, leftCurl: 0.0, rightSpread: 0.0, leftSpread: 0.0 };
        }
        if (options.curl !== undefined) {
            this.handPose.rightCurl = options.curl;
            this.handPose.leftCurl = options.curl;
        }
        if (options.rightCurl !== undefined) this.handPose.rightCurl = options.rightCurl;
        if (options.leftCurl !== undefined) this.handPose.leftCurl = options.leftCurl;

        if (options.spread !== undefined) {
            this.handPose.rightSpread = options.spread;
            this.handPose.leftSpread = options.spread;
        }
        if (options.rightSpread !== undefined) this.handPose.rightSpread = options.rightSpread;
        if (options.leftSpread !== undefined) this.handPose.leftSpread = options.leftSpread;

        // Apply to virtual finger bone rotations:
        // In the chibi model's skeletal coordinate system:
        // - Right Hand: positive Z rotation (+qz) rotates fingers (+ly) inward towards the body/palm.
        // - Left Hand: negative Z rotation (-qz) rotates fingers (+ly) inward towards the body/palm.
        //
        // Anatomical 3-joint curling for natural human fist (โค้งมนเข้าอุ้งมือแบบคนปกติ ไม่พับเป็นตัว L):
        // When curling into a fist, fingers must curl smoothly around ~245 deg total into a tight cylindrical fist,
        // so fingertips tuck cleanly back against the palm rather than sticking out as a 90-degree L shelf.
        const computeCurlAngles = (curl) => {
            if (curl >= 0.0) {
                // Non-linear anatomical progression:
                // Base knuckle (MCP) flexes smoothly: ~74 deg (1.30 rad)
                const baseRad = Math.pow(curl, 1.2) * 1.30;
                // Mid knuckle (PIP) flexes the deepest: ~95 deg (1.65 rad)
                const midRad = curl * 1.65;
                // Tip knuckle (DIP) flexes to roll the pad into the palm: ~77 deg (1.35 rad)
                const tipRad = Math.pow(curl, 0.85) * 1.35;
                return { baseRad, midRad, tipRad };
            } else {
                // Negative curl: gentle natural open hand flattening
                return {
                    baseRad: curl * 0.35,
                    midRad: curl * 0.20,
                    tipRad: curl * 0.10
                };
            }
        };

        const rAngles = computeCurlAngles(this.handPose.rightCurl);
        const lAngles = computeCurlAngles(this.handPose.leftCurl);

        // 1. Base Knuckle Bone (MCP joint - โคนนิ้ว)
        const sinR_base = Math.sin(rAngles.baseRad * 0.5), cosR_base = Math.cos(rAngles.baseRad * 0.5);
        const sinL_base = Math.sin(-lAngles.baseRad * 0.5), cosL_base = Math.cos(-lAngles.baseRad * 0.5);
        this.setRightFingersRotation(0, 0, sinR_base, cosR_base);
        this.setLeftFingersRotation(0, 0, sinL_base, cosL_base);

        // 2. Mid Knuckle Bone (PIP joint - ข้อพับกลางนิ้ว)
        const sinR_mid = Math.sin(rAngles.midRad * 0.5), cosR_mid = Math.cos(rAngles.midRad * 0.5);
        const sinL_mid = Math.sin(-lAngles.midRad * 0.5), cosL_mid = Math.cos(-lAngles.midRad * 0.5);
        this.setRightFingersMidRotation(0, 0, sinR_mid, cosR_mid);
        this.setLeftFingersMidRotation(0, 0, sinL_mid, cosL_mid);

        // 3. Tip Knuckle Bone (DIP joint - ข้อพับปลายนิ้ว)
        const sinR_tip = Math.sin(rAngles.tipRad * 0.5), cosR_tip = Math.cos(rAngles.tipRad * 0.5);
        const sinL_tip = Math.sin(-lAngles.tipRad * 0.5), cosL_tip = Math.cos(-lAngles.tipRad * 0.5);
        this.setRightFingersTipRotation(0, 0, sinR_tip, cosR_tip);
        this.setLeftFingersTipRotation(0, 0, sinL_tip, cosL_tip);
    }

    setRightFingersRotation(qx, qy, qz, qw) {
        if (!this.virtualRightFingersRotation) this.virtualRightFingersRotation = [0, 0, 0, 1];
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualRightFingersRotation[0] = qx[0];
            this.virtualRightFingersRotation[1] = qx[1];
            this.virtualRightFingersRotation[2] = qx[2];
            this.virtualRightFingersRotation[3] = qx[3];
        } else {
            this.virtualRightFingersRotation[0] = qx || 0;
            this.virtualRightFingersRotation[1] = qy || 0;
            this.virtualRightFingersRotation[2] = qz || 0;
            this.virtualRightFingersRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    setRightFingersMidRotation(qx, qy, qz, qw) {
        if (!this.virtualRightFingersMidRotation) this.virtualRightFingersMidRotation = [0, 0, 0, 1];
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualRightFingersMidRotation[0] = qx[0];
            this.virtualRightFingersMidRotation[1] = qx[1];
            this.virtualRightFingersMidRotation[2] = qx[2];
            this.virtualRightFingersMidRotation[3] = qx[3];
        } else {
            this.virtualRightFingersMidRotation[0] = qx || 0;
            this.virtualRightFingersMidRotation[1] = qy || 0;
            this.virtualRightFingersMidRotation[2] = qz || 0;
            this.virtualRightFingersMidRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    setRightFingersTipRotation(qx, qy, qz, qw) {
        if (!this.virtualRightFingersTipRotation) this.virtualRightFingersTipRotation = [0, 0, 0, 1];
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualRightFingersTipRotation[0] = qx[0];
            this.virtualRightFingersTipRotation[1] = qx[1];
            this.virtualRightFingersTipRotation[2] = qx[2];
            this.virtualRightFingersTipRotation[3] = qx[3];
        } else {
            this.virtualRightFingersTipRotation[0] = qx || 0;
            this.virtualRightFingersTipRotation[1] = qy || 0;
            this.virtualRightFingersTipRotation[2] = qz || 0;
            this.virtualRightFingersTipRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    setLeftFingersRotation(qx, qy, qz, qw) {
        if (!this.virtualLeftFingersRotation) this.virtualLeftFingersRotation = [0, 0, 0, 1];
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualLeftFingersRotation[0] = qx[0];
            this.virtualLeftFingersRotation[1] = qx[1];
            this.virtualLeftFingersRotation[2] = qx[2];
            this.virtualLeftFingersRotation[3] = qx[3];
        } else {
            this.virtualLeftFingersRotation[0] = qx || 0;
            this.virtualLeftFingersRotation[1] = qy || 0;
            this.virtualLeftFingersRotation[2] = qz || 0;
            this.virtualLeftFingersRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    setLeftFingersMidRotation(qx, qy, qz, qw) {
        if (!this.virtualLeftFingersMidRotation) this.virtualLeftFingersMidRotation = [0, 0, 0, 1];
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualLeftFingersMidRotation[0] = qx[0];
            this.virtualLeftFingersMidRotation[1] = qx[1];
            this.virtualLeftFingersMidRotation[2] = qx[2];
            this.virtualLeftFingersMidRotation[3] = qx[3];
        } else {
            this.virtualLeftFingersMidRotation[0] = qx || 0;
            this.virtualLeftFingersMidRotation[1] = qy || 0;
            this.virtualLeftFingersMidRotation[2] = qz || 0;
            this.virtualLeftFingersMidRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    setLeftFingersTipRotation(qx, qy, qz, qw) {
        if (!this.virtualLeftFingersTipRotation) this.virtualLeftFingersTipRotation = [0, 0, 0, 1];
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualLeftFingersTipRotation[0] = qx[0];
            this.virtualLeftFingersTipRotation[1] = qx[1];
            this.virtualLeftFingersTipRotation[2] = qx[2];
            this.virtualLeftFingersTipRotation[3] = qx[3];
        } else {
            this.virtualLeftFingersTipRotation[0] = qx || 0;
            this.virtualLeftFingersTipRotation[1] = qy || 0;
            this.virtualLeftFingersTipRotation[2] = qz || 0;
            this.virtualLeftFingersTipRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    setFingersCurl(angleRad) {
        const halfAngle1 = (angleRad || 0) * 0.30 * 0.5;
        const halfAngle2 = (angleRad || 0) * 0.38 * 0.5;
        const halfAngle3 = (angleRad || 0) * 0.32 * 0.5;
        const sin1 = Math.sin(halfAngle1), cos1 = Math.cos(halfAngle1);
        const sin2 = Math.sin(halfAngle2), cos2 = Math.cos(halfAngle2);
        const sin3 = Math.sin(halfAngle3), cos3 = Math.cos(halfAngle3);
        this.setRightFingersRotation(0, 0, sin1, cos1);
        this.setLeftFingersRotation(0, 0, -sin1, cos1);
        this.setRightFingersMidRotation(0, 0, sin2, cos2);
        this.setLeftFingersMidRotation(0, 0, -sin2, cos2);
        this.setRightFingersTipRotation(0, 0, sin3, cos3);
        this.setLeftFingersTipRotation(0, 0, -sin3, cos3);
    }

    setPonytailRotation(qx, qy, qz, qw) {
        if (Array.isArray(qx) || (qx && typeof qx[0] === "number")) {
            this.virtualPonytailRotation[0] = qx[0];
            this.virtualPonytailRotation[1] = qx[1];
            this.virtualPonytailRotation[2] = qx[2];
            this.virtualPonytailRotation[3] = qx[3];
        } else {
            this.virtualPonytailRotation[0] = qx || 0;
            this.virtualPonytailRotation[1] = qy || 0;
            this.virtualPonytailRotation[2] = qz || 0;
            this.virtualPonytailRotation[3] = (qw !== undefined) ? qw : 1;
        }
    }

    getBonesInfo() {
        if (!this.skin || !this.skin.joints) return [];
        return this.skin.joints.map((nodeIdx, jIdx) => {
            const node = this.nodes[nodeIdx] || {};
            const parentNode = (node.parent !== undefined) ? this.nodes[node.parent] : null;
            const isArmatureParent = parentNode && parentNode.name === "Armature";
            const effectiveParent = isArmatureParent ? null : parentNode;
            
            const bName = node.name || ("Bone_" + jIdx);
            const n = bName.toLowerCase();
            let part = "torso";
            let partColor = "#00b0ff";
            let partTh = "ลำตัว (Torso)";
            if (n.includes("virtual_ponytail") || n.includes("ponytail") || n.includes("hair")) {
                part = "hair";
                partColor = "#e040fb";
                partTh = "ผมรวบ (Virtual Ponytail)";
            } else if (n.includes("head") || n.includes("neck")) {
                part = "head";
                partColor = "#ff6e40";
                partTh = "ศีรษะ (Head)";
            } else if (n.includes("virtual_rightfingers_mid") || (n.includes("right") && n.includes("mid") && n.includes("finger"))) {
                part = "right_arm";
                partColor = "#ffd54f";
                partTh = "ข้อพับนิ้วมือขวา (Right Mid Knuckle)";
            } else if (n.includes("virtual_rightfingers") || (n.includes("right") && n.includes("finger"))) {
                part = "right_arm";
                partColor = "#ffca28";
                partTh = "โคนนิ้วมือขวา (Right Base Fingers)";
            } else if (n.includes("virtual_leftfingers_mid") || (n.includes("left") && n.includes("mid") && n.includes("finger"))) {
                part = "left_arm";
                partColor = "#b9f6ca";
                partTh = "ข้อพับนิ้วมือซ้าย (Left Mid Knuckle)";
            } else if (n.includes("virtual_leftfingers") || (n.includes("left") && n.includes("finger"))) {
                part = "left_arm";
                partColor = "#69f0ae";
                partTh = "โคนนิ้วมือซ้าย (Left Base Fingers)";
            } else if (n.includes("left") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) {
                part = "left_arm";
                partColor = "#00e676";
                partTh = "แขนซ้าย (Left Arm)";
            } else if (n.includes("right") && (n.includes("shoulder") || n.includes("arm") || n.includes("hand"))) {
                part = "right_arm";
                partColor = "#ffab00";
                partTh = "แขนขวา (Right Arm)";
            } else if (n.includes("left") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) {
                part = "left_leg";
                partColor = "#d500f9";
                partTh = "ขาซ้าย (Left Leg)";
            } else if (n.includes("right") && (n.includes("leg") || n.includes("foot") || n.includes("toe"))) {
                part = "right_leg";
                partColor = "#ff1744";
                partTh = "ขาขวา (Right Leg)";
            }

            return {
                jointIndex: jIdx,
                nodeIndex: nodeIdx,
                name: bName,
                parentName: effectiveParent ? effectiveParent.name : null,
                parentNodeIndex: effectiveParent ? node.parent : null,
                childCount: (node.children || []).length,
                childNames: (node.children || []).map(cIdx => this.nodes[cIdx] ? this.nodes[cIdx].name : "").filter(Boolean),
                dominantVertexCount: this.dominantBoneVertexCounts[nodeIdx] || 0,
                part: part,
                partTh: partTh,
                partColor: partColor,
                translation: node.translation ? Array.from(node.translation) : [0, 0, 0],
                rotation: node.rotation ? Array.from(node.rotation) : [0, 0, 0, 1],
                scale: node.scale ? Array.from(node.scale) : [1, 1, 1],
                matrixPos: node.matrix ? [node.matrix[12], node.matrix[13], node.matrix[14]] : [0, 0, 0]
            };
        });
    }

    getPartsSummary() {
        const parts = [
            { id: "head", nameTh: "ศีรษะ (Head)", color: "#ff6e40", rgb: [1.0, 0.43, 0.25], count: 0 },
            { id: "torso", nameTh: "ลำตัว (Torso)", color: "#00b0ff", rgb: [0.0, 0.69, 1.0], count: 0 },
            { id: "left_arm", nameTh: "แขนซ้าย (Left Arm)", color: "#00e676", rgb: [0.0, 0.90, 0.46], count: 0 },
            { id: "right_arm", nameTh: "แขนขวา (Right Arm)", color: "#ffab00", rgb: [1.0, 0.67, 0.0], count: 0 },
            { id: "left_leg", nameTh: "ขาซ้าย (Left Leg)", color: "#d500f9", rgb: [0.83, 0.0, 0.98], count: 0 },
            { id: "right_leg", nameTh: "ขาขวา (Right Leg)", color: "#ff1744", rgb: [1.0, 0.09, 0.27], count: 0 },
            { id: "hair", nameTh: "ผมรวบ (Ponytail Hair)", color: "#e040fb", rgb: [0.88, 0.25, 0.98], count: 0 }
        ];

        if (this.vertexPartGroups) {
            for (let i = 0; i < this.vertexCount; i++) {
                const g = this.vertexPartGroups[i];
                if (parts[g]) parts[g].count++;
            }
        }
        return parts.map(p => ({
            ...p,
            percent: ((p.count / (this.vertexCount || 1)) * 100).toFixed(1) + "%"
        }));
    }

    _getComponentCount(type) {
        if (type === 'SCALAR') return 1;
        if (type === 'VEC2') return 2;
        if (type === 'VEC3') return 3;
        if (type === 'VEC4') return 4;
        if (type === 'MAT4') return 16;
        return 1;
    }

    _calcDuration(anim) {
        let maxT = 0;
        anim.samplers.forEach(s => {
            const input = this.accessors[s.input];
            if (input[input.length-1] > maxT) maxT = input[input.length-1];
        });
        return maxT;
    }

    getAnimation(name) {
        if (!this.animations || this.animations.length === 0) return null;
        if (!name) return this.animations[0];
        // 1. Exact match
        let found = this.animations.find(a => a.name === name);
        if (found) return found;
        // 2. Normalized match (ignoring case, spaces, underscores, dashes)
        const normName = String(name).toLowerCase().replace(/[\s\-_]/g, "");
        found = this.animations.find(a => a.name.toLowerCase().replace(/[\s\-_]/g, "") === normName);
        if (found) return found;
        // 3. Substring match
        found = this.animations.find(a => a.name.toLowerCase().replace(/[\s\-_]/g, "").includes(normName));
        if (found) return found;
        return this.animations[0];
    }

    _slerp(out, a, b, t) {
        let ax = a[0], ay = a[1], az = a[2], aw = a[3];
        let bx = b[0], by = b[1], bz = b[2], bw = b[3];
        let omega, cosom, sinom, scale0, scale1;

        cosom = ax * bx + ay * by + az * bz + aw * bw;
        if (cosom < 0.0) {
            cosom = -cosom;
            bx = -bx; by = -by; bz = -bz; bw = -bw;
        }
        if ((1.0 - cosom) > 0.000001) {
            omega = Math.acos(cosom);
            sinom = Math.sin(omega);
            scale0 = Math.sin((1.0 - t) * omega) / sinom;
            scale1 = Math.sin(t * omega) / sinom;
        } else {
            scale0 = 1.0 - t;
            scale1 = t;
        }
        out[0] = scale0 * ax + scale1 * bx;
        out[1] = scale0 * ay + scale1 * by;
        out[2] = scale0 * az + scale1 * bz;
        out[3] = scale0 * aw + scale1 * bw;
    }

    _lerpVec3(out, a, b, t, aOff=0, bOff=0) {
        out[0] = a[aOff] + (b[bOff] - a[aOff]) * t;
        out[1] = a[aOff+1] + (b[bOff+1] - a[aOff+1]) * t;
        out[2] = a[aOff+2] + (b[bOff+2] - a[aOff+2]) * t;
    }

    _fromRTS(out, q, v, s) {
        let x = q[0], y = q[1], z = q[2], w = q[3];
        let x2 = x + x, y2 = y + y, z2 = z + z;
        let xx = x * x2, xy = x * y2, xz = x * z2;
        let yy = y * y2, yz = y * z2, zz = z * z2;
        let wx = w * x2, wy = w * y2, wz = w * z2;
        let sx = s[0], sy = s[1], sz = s[2];
        out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
        out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
        out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
        out[12] = v[0]; out[13] = v[1]; out[14] = v[2]; out[15] = 1;
    }

    _multiplyMat4(out, a, b) {
        let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        let b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
        let b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
        let b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
        let b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];
        out[0] = b00*a00 + b01*a10 + b02*a20 + b03*a30;
        out[1] = b00*a01 + b01*a11 + b02*a21 + b03*a31;
        out[2] = b00*a02 + b01*a12 + b02*a22 + b03*a32;
        out[3] = b00*a03 + b01*a13 + b02*a23 + b03*a33;
        out[4] = b10*a00 + b11*a10 + b12*a20 + b13*a30;
        out[5] = b10*a01 + b11*a11 + b12*a21 + b13*a31;
        out[6] = b10*a02 + b11*a12 + b12*a22 + b13*a32;
        out[7] = b10*a03 + b11*a13 + b12*a23 + b13*a33;
        out[8] = b20*a00 + b21*a10 + b22*a20 + b23*a30;
        out[9] = b20*a01 + b21*a11 + b22*a21 + b23*a31;
        out[10] = b20*a02 + b21*a12 + b22*a22 + b23*a32;
        out[11] = b20*a03 + b21*a13 + b22*a23 + b23*a33;
        out[12] = b30*a00 + b31*a10 + b32*a20 + b33*a30;
        out[13] = b30*a01 + b31*a11 + b32*a21 + b33*a31;
        out[14] = b30*a02 + b31*a12 + b32*a22 + b33*a32;
        out[15] = b30*a03 + b31*a13 + b32*a23 + b33*a33;
    }

    _multiplyMat4Offset(out, outOff, a, aOff, b, bOff) {
        let a00 = a[aOff], a01 = a[aOff+1], a02 = a[aOff+2], a03 = a[aOff+3];
        let a10 = a[aOff+4], a11 = a[aOff+5], a12 = a[aOff+6], a13 = a[aOff+7];
        let a20 = a[aOff+8], a21 = a[aOff+9], a22 = a[aOff+10], a23 = a[aOff+11];
        let a30 = a[aOff+12], a31 = a[aOff+13], a32 = a[aOff+14], a33 = a[aOff+15];
        let b00 = b[bOff], b01 = b[bOff+1], b02 = b[bOff+2], b03 = b[bOff+3];
        let b10 = b[bOff+4], b11 = b[bOff+5], b12 = b[bOff+6], b13 = b[bOff+7];
        let b20 = b[bOff+8], b21 = b[bOff+9], b22 = b[bOff+10], b23 = b[bOff+11];
        let b30 = b[bOff+12], b31 = b[bOff+13], b32 = b[bOff+14], b33 = b[bOff+15];
        out[outOff] = b00*a00 + b01*a10 + b02*a20 + b03*a30;
        out[outOff+1] = b00*a01 + b01*a11 + b02*a21 + b03*a31;
        out[outOff+2] = b00*a02 + b01*a12 + b02*a22 + b03*a32;
        out[outOff+3] = b00*a03 + b01*a13 + b02*a23 + b03*a33;
        out[outOff+4] = b10*a00 + b11*a10 + b12*a20 + b13*a30;
        out[outOff+5] = b10*a01 + b11*a11 + b12*a21 + b13*a31;
        out[outOff+6] = b10*a02 + b11*a12 + b12*a22 + b13*a32;
        out[outOff+7] = b10*a03 + b11*a13 + b12*a23 + b13*a33;
        out[outOff+8] = b20*a00 + b21*a10 + b22*a20 + b23*a30;
        out[outOff+9] = b20*a01 + b21*a11 + b22*a21 + b23*a31;
        out[outOff+10] = b20*a02 + b21*a12 + b22*a22 + b23*a32;
        out[outOff+11] = b20*a03 + b21*a13 + b22*a23 + b23*a33;
        out[outOff+12] = b30*a00 + b31*a10 + b32*a20 + b33*a30;
        out[outOff+13] = b30*a01 + b31*a11 + b32*a21 + b33*a31;
        out[outOff+14] = b30*a02 + b31*a12 + b32*a22 + b33*a32;
        out[outOff+15] = b30*a03 + b31*a13 + b32*a23 + b33*a33;
    }

    _updateHierarchy(nodeIdx, parentMatrix) {
        const n = this.nodes[nodeIdx];
        this._fromRTS(n.localMatrix, n.rotation, n.translation, n.scale);
        if (parentMatrix) {
            this._multiplyMat4(n.matrix, parentMatrix, n.localMatrix);
        } else {
            for(let i=0;i<16;i++) n.matrix[i] = n.localMatrix[i];
        }
        for (let i = 0; i < n.children.length; i++) {
            this._updateHierarchy(n.children[i], n.matrix);
        }
    }

    _resetNodeTransforms() {
        const nodes = this.nodes;
        const len = nodes.length;
        for (let i = 0; i < len; i++) {
            const n = nodes[i];
            const bt = n.baseTranslation;
            n.translation[0] = bt[0]; n.translation[1] = bt[1]; n.translation[2] = bt[2];
            const br = n.baseRotation;
            n.rotation[0] = br[0]; n.rotation[1] = br[1]; n.rotation[2] = br[2]; n.rotation[3] = br[3];
            const bs = n.baseScale;
            n.scale[0] = bs[0]; n.scale[1] = bs[1]; n.scale[2] = bs[2];
        }
    }

    _sampleAnimation(anim, time, loop) {
        let t = time;
        if (loop && anim.duration > 0) t = t % anim.duration;
        if (t < 0) t += anim.duration;

        const animNameLower = (anim && anim.name) ? anim.name.toLowerCase() : '';
        const isRootLocked = animNameLower.includes('swim_forward') || animNameLower.includes('swim forward') || animNameLower.includes('jump');

        const channels = anim.channels;
        const numChannels = channels.length;
        const q0 = this._tmpQ0;
        const q1 = this._tmpQ1;

        for (let c = 0; c < numChannels; c++) {
            const ch = channels[c];
            const times = ch.input;
            const values = ch.output;
            let frame = 0;
            const len1 = times.length - 1;
            while (frame < len1 && times[frame + 1] <= t) frame++;

            const n = this.nodes[ch.node];
            const isHipsNode = isRootLocked && ch.path === 'translation' && (n.name === 'Hips' || n.name === 'mixamorigHips' || n.name === 'Root' || ch.node === 27);

            if (frame >= len1) {
                if (loop && anim.duration > times[frame]) {
                    const t0 = times[frame];
                    const t1 = anim.duration;
                    const f = (t - t0) / (t1 - t0);
                    if (ch.path === 'translation') {
                        this._lerpVec3(n.translation, values, values, f, frame * 3, 0);
                        if (isHipsNode) n.translation[2] = values[2];
                    } else if (ch.path === 'rotation') {
                        const f4 = frame * 4;
                        q0[0] = values[f4]; q0[1] = values[f4 + 1]; q0[2] = values[f4 + 2]; q0[3] = values[f4 + 3];
                        q1[0] = values[0]; q1[1] = values[1]; q1[2] = values[2]; q1[3] = values[3];
                        this._slerp(n.rotation, q0, q1, f);
                    } else if (ch.path === 'scale') {
                        this._lerpVec3(n.scale, values, values, f, frame * 3, 0);
                    }
                } else {
                    if (ch.path === 'translation') {
                        const f3 = frame * 3;
                        n.translation[0] = values[f3]; n.translation[1] = values[f3 + 1]; n.translation[2] = values[f3 + 2];
                        if (isHipsNode) n.translation[2] = values[2];
                    } else if (ch.path === 'rotation') {
                        const f4 = frame * 4;
                        n.rotation[0] = values[f4]; n.rotation[1] = values[f4 + 1]; n.rotation[2] = values[f4 + 2]; n.rotation[3] = values[f4 + 3];
                    } else if (ch.path === 'scale') {
                        const f3 = frame * 3;
                        n.scale[0] = values[f3]; n.scale[1] = values[f3 + 1]; n.scale[2] = values[f3 + 2];
                    }
                }
            } else {
                const t0 = times[frame];
                const t1 = times[frame + 1];
                const factor = (t - t0) / (t1 - t0);
                if (ch.path === 'translation') {
                    this._lerpVec3(n.translation, values, values, factor, frame * 3, (frame + 1) * 3);
                    if (isHipsNode) n.translation[2] = values[2];
                } else if (ch.path === 'rotation') {
                    const f4 = frame * 4;
                    const next4 = (frame + 1) * 4;
                    q0[0] = values[f4]; q0[1] = values[f4 + 1]; q0[2] = values[f4 + 2]; q0[3] = values[f4 + 3];
                    q1[0] = values[next4]; q1[1] = values[next4 + 1]; q1[2] = values[next4 + 2]; q1[3] = values[next4 + 3];
                    this._slerp(n.rotation, q0, q1, factor);
                } else if (ch.path === 'scale') {
                    this._lerpVec3(n.scale, values, values, factor, frame * 3, (frame + 1) * 3);
                }
            }
        }
    }

    _applySkinningAndFinalize() {
        // Apply Virtual Ponytail rotation before hierarchy update
        if (this.virtualPonytailNodeIdx !== undefined && this.nodes[this.virtualPonytailNodeIdx]) {
            const vn = this.nodes[this.virtualPonytailNodeIdx];
            vn.rotation[0] = this.virtualPonytailRotation[0];
            vn.rotation[1] = this.virtualPonytailRotation[1];
            vn.rotation[2] = this.virtualPonytailRotation[2];
            vn.rotation[3] = this.virtualPonytailRotation[3];
        }

        // Apply Virtual Finger rotations before hierarchy update
        if (this.virtualRightFingersNodeIdx !== undefined && this.nodes[this.virtualRightFingersNodeIdx]) {
            const vn = this.nodes[this.virtualRightFingersNodeIdx];
            vn.rotation[0] = this.virtualRightFingersRotation[0];
            vn.rotation[1] = this.virtualRightFingersRotation[1];
            vn.rotation[2] = this.virtualRightFingersRotation[2];
            vn.rotation[3] = this.virtualRightFingersRotation[3];
        }
        if (this.virtualRightFingersMidNodeIdx !== undefined && this.nodes[this.virtualRightFingersMidNodeIdx]) {
            const vn = this.nodes[this.virtualRightFingersMidNodeIdx];
            vn.rotation[0] = this.virtualRightFingersMidRotation[0];
            vn.rotation[1] = this.virtualRightFingersMidRotation[1];
            vn.rotation[2] = this.virtualRightFingersMidRotation[2];
            vn.rotation[3] = this.virtualRightFingersMidRotation[3];
        }
        if (this.virtualRightFingersTipNodeIdx !== undefined && this.nodes[this.virtualRightFingersTipNodeIdx]) {
            const vn = this.nodes[this.virtualRightFingersTipNodeIdx];
            vn.rotation[0] = this.virtualRightFingersTipRotation[0];
            vn.rotation[1] = this.virtualRightFingersTipRotation[1];
            vn.rotation[2] = this.virtualRightFingersTipRotation[2];
            vn.rotation[3] = this.virtualRightFingersTipRotation[3];
        }
        if (this.virtualLeftFingersNodeIdx !== undefined && this.nodes[this.virtualLeftFingersNodeIdx]) {
            const vn = this.nodes[this.virtualLeftFingersNodeIdx];
            vn.rotation[0] = this.virtualLeftFingersRotation[0];
            vn.rotation[1] = this.virtualLeftFingersRotation[1];
            vn.rotation[2] = this.virtualLeftFingersRotation[2];
            vn.rotation[3] = this.virtualLeftFingersRotation[3];
        }
        if (this.virtualLeftFingersMidNodeIdx !== undefined && this.nodes[this.virtualLeftFingersMidNodeIdx]) {
            const vn = this.nodes[this.virtualLeftFingersMidNodeIdx];
            vn.rotation[0] = this.virtualLeftFingersMidRotation[0];
            vn.rotation[1] = this.virtualLeftFingersMidRotation[1];
            vn.rotation[2] = this.virtualLeftFingersMidRotation[2];
            vn.rotation[3] = this.virtualLeftFingersMidRotation[3];
        }
        if (this.virtualLeftFingersTipNodeIdx !== undefined && this.nodes[this.virtualLeftFingersTipNodeIdx]) {
            const vn = this.nodes[this.virtualLeftFingersTipNodeIdx];
            vn.rotation[0] = this.virtualLeftFingersTipRotation[0];
            vn.rotation[1] = this.virtualLeftFingersTipRotation[1];
            vn.rotation[2] = this.virtualLeftFingersTipRotation[2];
            vn.rotation[3] = this.virtualLeftFingersTipRotation[3];
        }

        // Update hierarchy
        const rootNodes = this.rootNodes;
        for (let i = 0; i < rootNodes.length; i++) {
            this._updateHierarchy(rootNodes[i], null);
        }

        // Compute joint matrices
        if (this.skin) {
            const joints = this.skin.joints;
            const invBindMats = this.skin.inverseBindMatrices;
            const jointMats = this.jointMatrices;
            const nodes = this.nodes;
            const jLen = joints.length;

            for (let i = 0; i < jLen; i++) {
                const jointNodeIdx = joints[i];
                const invBindOffset = i * 16;
                this._multiplyMat4Offset(jointMats, invBindOffset, nodes[jointNodeIdx].matrix, 0, invBindMats, invBindOffset);
            }
        }

        // Apply skinning
        const bp = this.basePositions;
        const bn = this.baseNormals;
        const op = this.outPositions;
        const on = this.outNormals;
        const jts = this.joints;
        const wts = this.weights;
        const jm = this.jointMatrices;
        const vCount = this.vertexCount;

        for (let i = 0; i < vCount; i++) {
            const i3 = i * 3;
            const i4 = i * 4;

            let px = 0, py = 0, pz = 0;
            let nx = 0, ny = 0, nz = 0;

            const bx = bp[i3], by = bp[i3 + 1], bz = bp[i3 + 2];
            const bnx = bn[i3], bny = bn[i3 + 1], bnz = bn[i3 + 2];

            for (let j = 0; j < 4; j++) {
                const weight = wts[i4 + j];
                if (weight > 0.0) {
                    const jointIdx = jts[i4 + j] * 16;

                    const m00 = jm[jointIdx], m01 = jm[jointIdx + 4], m02 = jm[jointIdx + 8], m03 = jm[jointIdx + 12];
                    const m10 = jm[jointIdx + 1], m11 = jm[jointIdx + 5], m12 = jm[jointIdx + 9], m13 = jm[jointIdx + 13];
                    const m20 = jm[jointIdx + 2], m21 = jm[jointIdx + 6], m22 = jm[jointIdx + 10], m23 = jm[jointIdx + 14];

                    px += weight * (m00 * bx + m01 * by + m02 * bz + m03);
                    py += weight * (m10 * bx + m11 * by + m12 * bz + m13);
                    pz += weight * (m20 * bx + m21 * by + m22 * bz + m23);

                    nx += weight * (m00 * bnx + m01 * bny + m02 * bnz);
                    ny += weight * (m10 * bnx + m11 * bny + m12 * bnz);
                    nz += weight * (m20 * bnx + m21 * bny + m22 * bnz);
                }
            }

            op[i3] = px; op[i3 + 1] = py; op[i3 + 2] = pz;

            const nlen = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nlen > 0.00001) {
                on[i3] = nx / nlen;
                on[i3 + 1] = ny / nlen;
                on[i3 + 2] = nz / nlen;
            } else {
                on[i3] = bnx; on[i3 + 1] = bny; on[i3 + 2] = bnz;
            }
        }

        // Apply Finger Spread (แยกนิ้ว/หุบนิ้ว) and Thumb Opposition (กำนิ้วโป้งทาบบนนิ้วกำ) in hand coordinate space
        if (this.handPose && this.fingerSpreadMap) {
            const spreadMap = this.fingerSpreadMap;
            const rSpread = this.handPose.rightSpread || 0.0;
            const lSpread = this.handPose.leftSpread || 0.0;
            const rCurl = this.handPose.rightCurl || 0.0;
            const lCurl = this.handPose.leftCurl || 0.0;
            const hasSpread = Math.abs(rSpread) > 0.001 || Math.abs(lSpread) > 0.001;
            const hasCurl = Math.abs(rCurl) > 0.001 || Math.abs(lCurl) > 0.001;

            if (hasSpread || hasCurl) {
                const jm = this.jointMatrices;

                for (let k = 0; k < spreadMap.length; k++) {
                    const item = spreadMap[k];
                    const isRight = item.isRight;
                    const spreadVal = isRight ? rSpread : lSpread;
                    const curlVal = isRight ? rCurl : lCurl;

                    let dlx = 0.0;
                    let dly = 0.0;
                    let dlz = 0.0;

                    // 1. Finger spread displacement
                    if (Math.abs(spreadVal) > 0.001) {
                        const factor = spreadVal * item.prog * item.weight;
                        dlz += item.sDirZ * factor * 0.024;
                        dlx += item.sDirX * factor * 0.015;
                    }

                    // 2. Thumb opposition when curling into a fist (พับนิ้วโป้งแนบข้ามไปหานิ้วชี้ตามแกน Z และกระชับเข้าอุ้งมือ)
                    if (item.isThumb && curlVal > 0.001) {
                        // Smooth cubic weighting to prevent sharp shearing at joint boundary
                        const p = item.prog;
                        const smoothP = p * p * (3.0 - 2.0 * p);
                        const thumbFactor = curlVal * smoothP * item.weight;
                        // Z opposition towards index finger (~18mm)
                        dlz += -0.018 * thumbFactor;
                        // Inward X tuck towards palm
                        dlx += (isRight ? -0.008 : 0.008) * thumbFactor;
                    }

                    if (Math.abs(dlx) > 0.0001 || Math.abs(dly) > 0.0001 || Math.abs(dlz) > 0.0001) {
                        const handMatIdx = item.handJoint * 16;
                        // Column 0 of hand joint matrix: transformed X axis
                        const m00 = jm[handMatIdx];
                        const m10 = jm[handMatIdx + 1];
                        const m20 = jm[handMatIdx + 2];
                        // Column 1 of hand joint matrix: transformed Y axis
                        const m01 = jm[handMatIdx + 4];
                        const m11 = jm[handMatIdx + 5];
                        const m21 = jm[handMatIdx + 6];
                        // Column 2 of hand joint matrix: transformed Z axis
                        const m02 = jm[handMatIdx + 8];
                        const m12 = jm[handMatIdx + 9];
                        const m22 = jm[handMatIdx + 10];

                        const i3 = item.i * 3;
                        op[i3]     += dlx * m00 + dly * m01 + dlz * m02;
                        op[i3 + 1] += dlx * m10 + dly * m11 + dlz * m12;
                        op[i3 + 2] += dlx * m20 + dly * m21 + dlz * m22;
                    }
                }
            }
        }

        return {
            positions: this.outPositions,
            normals: this.outNormals,
            colors: this.baseColors,
            texcoords: this.baseTexCoords,
            indices: this.indices
        };
    }

    getSkinnedMeshBlended(animName1, time1, animName2, time2, factor, loop = true) {
        if (factor <= 0.0) return this.getSkinnedMesh(animName1, time1, loop);
        if (factor >= 1.0) return this.getSkinnedMesh(animName2, time2, loop);

        // 1. Reset and sample Animation 1
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const anim1 = this.getAnimation(animName1);
            if (anim1) this._sampleAnimation(anim1, time1, loop);
        }

        // Save Anim1 state into preallocated cache
        const cache = this.blendCacheState;
        const nodes = this.nodes;
        const nLen = nodes.length;
        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const c = cache[i];
            c.t[0] = n.translation[0]; c.t[1] = n.translation[1]; c.t[2] = n.translation[2];
            c.r[0] = n.rotation[0]; c.r[1] = n.rotation[1]; c.r[2] = n.rotation[2]; c.r[3] = n.rotation[3];
            c.s[0] = n.scale[0]; c.s[1] = n.scale[1]; c.s[2] = n.scale[2];
        }

        // 2. Reset and sample Animation 2
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const anim2 = this.getAnimation(animName2);
            if (anim2) this._sampleAnimation(anim2, time2, loop);
        }

        // 3. Blend Anim1 and Anim2
        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const s1 = cache[i];

            n.translation[0] = s1.t[0] + (n.translation[0] - s1.t[0]) * factor;
            n.translation[1] = s1.t[1] + (n.translation[1] - s1.t[1]) * factor;
            n.translation[2] = s1.t[2] + (n.translation[2] - s1.t[2]) * factor;

            n.scale[0] = s1.s[0] + (n.scale[0] - s1.s[0]) * factor;
            n.scale[1] = s1.s[1] + (n.scale[1] - s1.s[1]) * factor;
            n.scale[2] = s1.s[2] + (n.scale[2] - s1.s[2]) * factor;

            this._slerp(n.rotation, s1.r, n.rotation, factor);
        }

        return this._applySkinningAndFinalize();
    }

    getSkinnedMesh(animName, time, loop = true) {
        this._resetNodeTransforms();

        if (this.animations && this.animations.length > 0) {
            const anim = this.getAnimation(animName);
            if (anim) this._sampleAnimation(anim, time, loop);
        }

        return this._applySkinningAndFinalize();
    }

    isUpperBodyNode(nodeIdx) {
        return !!(this.upperBodyNodes && this.upperBodyNodes[nodeIdx]);
    }

    isLowerBodyNode(nodeIdx) {
        return !!(this.lowerBodyNodes && this.lowerBodyNodes[nodeIdx]);
    }

    /**
     * Layered animation mixing between lower body (legs, locomotion, hips)
     * and upper body (spine, arms, hands, neck, head).
     *
     * @param {string} lowerAnimName - Animation name for lower body / locomotion
     * @param {number} lowerTime - Playback time for lower body animation
     * @param {string} upperAnimName - Animation name for upper body / action
     * @param {number} upperTime - Playback time for upper body animation
     * @param {number} upperWeight - Blend weight for upper body (0.0 = 100% lower, 1.0 = 100% upper on upper bones)
     * @param {boolean} loop - Whether to loop
     * @param {number} hipsBlend - Blend weight for hips rotation/position (0.0 = hips follow lowerAnim, 1.0 = hips follow upperAnim)
     */
    getSkinnedMeshLayered(lowerAnimName, lowerTime, upperAnimName, upperTime, upperWeight = 1.0, loop = true, hipsBlend = 0.0) {
        if (upperWeight <= 0.001 || !upperAnimName) {
            return this.getSkinnedMesh(lowerAnimName, lowerTime, loop);
        }
        if (upperWeight >= 0.999 && (!lowerAnimName || lowerAnimName === upperAnimName)) {
            return this.getSkinnedMesh(upperAnimName, upperTime, loop);
        }

        const nodes = this.nodes;
        const nLen = nodes.length;

        // 1. Reset and sample lower body animation into layerCacheState
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const lowerAnim = this.getAnimation(lowerAnimName);
            if (lowerAnim) this._sampleAnimation(lowerAnim, lowerTime, loop);
        }
        const lowerCache = this.layerCacheState;
        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const c = lowerCache[i];
            c.t[0] = n.translation[0]; c.t[1] = n.translation[1]; c.t[2] = n.translation[2];
            c.r[0] = n.rotation[0]; c.r[1] = n.rotation[1]; c.r[2] = n.rotation[2]; c.r[3] = n.rotation[3];
            c.s[0] = n.scale[0]; c.s[1] = n.scale[1]; c.s[2] = n.scale[2];
        }

        // 2. Reset and sample upper body action animation into nodes
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const upperAnim = this.getAnimation(upperAnimName);
            if (upperAnim) this._sampleAnimation(upperAnim, upperTime, loop);
        }

        // 3. Mask transforms: lower body from lowerCache, upper body blended by upperWeight
        const isUpper = this.upperBodyNodes;
        const isLower = this.lowerBodyNodes;
        const hipsIdx = this.hipsNodeIndex;

        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const l = lowerCache[i];

            if (i === hipsIdx) {
                // Hips node
                if (hipsBlend <= 0.001) {
                    n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                    n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                    n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
                } else if (hipsBlend < 0.999) {
                    const hb = hipsBlend * upperWeight;
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * hb;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * hb;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * hb;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * hb;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * hb;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * hb;
                    this._slerp(n.rotation, l.r, n.rotation, hb);
                }
            } else if (isUpper && isUpper[i]) {
                // Upper body node
                if (upperWeight < 0.999) {
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * upperWeight;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * upperWeight;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * upperWeight;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * upperWeight;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * upperWeight;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * upperWeight;
                    this._slerp(n.rotation, l.r, n.rotation, upperWeight);
                }
            } else if (isLower && isLower[i]) {
                // Lower body node - always takes 100% from lower body animation
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            } else {
                // Root / mesh armature nodes
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            }
        }

        return this._applySkinningAndFinalize();
    }

    /**
     * Advanced layered blending where lower body can also transition between two locomotion states
     * (e.g. Walk -> Run or Idle -> Walk while swinging tool).
     */
    getSkinnedMeshMixed(options) {
        const {
            lowerAnim1, lowerTime1,
            lowerAnim2, lowerTime2,
            lowerBlend = 0.0,
            upperAnim, upperTime,
            upperWeight = 1.0,
            hipsBlend = 0.0,
            loop = true
        } = options;

        if (upperWeight <= 0.001 || !upperAnim) {
            if (lowerBlend > 0.001 && lowerAnim2) {
                return this.getSkinnedMeshBlended(lowerAnim1, lowerTime1, lowerAnim2, lowerTime2, lowerBlend, loop);
            }
            return this.getSkinnedMesh(lowerAnim1, lowerTime1, loop);
        }

        const nodes = this.nodes;
        const nLen = nodes.length;

        // 1. Prepare lower body layer
        if (lowerBlend > 0.001 && lowerAnim2) {
            this._resetNodeTransforms();
            if (this.animations && this.animations.length > 0) {
                const a1 = this.getAnimation(lowerAnim1);
                if (a1) this._sampleAnimation(a1, lowerTime1, loop);
            }
            const bCache = this.blendCacheState;
            for (let i = 0; i < nLen; i++) {
                const n = nodes[i];
                const c = bCache[i];
                c.t[0] = n.translation[0]; c.t[1] = n.translation[1]; c.t[2] = n.translation[2];
                c.r[0] = n.rotation[0]; c.r[1] = n.rotation[1]; c.r[2] = n.rotation[2]; c.r[3] = n.rotation[3];
                c.s[0] = n.scale[0]; c.s[1] = n.scale[1]; c.s[2] = n.scale[2];
            }

            this._resetNodeTransforms();
            if (this.animations && this.animations.length > 0) {
                const a2 = this.getAnimation(lowerAnim2);
                if (a2) this._sampleAnimation(a2, lowerTime2, loop);
            }

            const lCache = this.layerCacheState;
            for (let i = 0; i < nLen; i++) {
                const n = nodes[i];
                const b = bCache[i];
                const l = lCache[i];
                l.t[0] = b.t[0] + (n.translation[0] - b.t[0]) * lowerBlend;
                l.t[1] = b.t[1] + (n.translation[1] - b.t[1]) * lowerBlend;
                l.t[2] = b.t[2] + (n.translation[2] - b.t[2]) * lowerBlend;
                l.s[0] = b.s[0] + (n.scale[0] - b.s[0]) * lowerBlend;
                l.s[1] = b.s[1] + (n.scale[1] - b.s[1]) * lowerBlend;
                l.s[2] = b.s[2] + (n.scale[2] - b.s[2]) * lowerBlend;
                this._slerp(l.r, b.r, n.rotation, lowerBlend);
            }
        } else {
            this._resetNodeTransforms();
            if (this.animations && this.animations.length > 0) {
                const lowerAnim = this.getAnimation(lowerAnim1);
                if (lowerAnim) this._sampleAnimation(lowerAnim, lowerTime1, loop);
            }
            const lCache = this.layerCacheState;
            for (let i = 0; i < nLen; i++) {
                const n = nodes[i];
                const l = lCache[i];
                l.t[0] = n.translation[0]; l.t[1] = n.translation[1]; l.t[2] = n.translation[2];
                l.r[0] = n.rotation[0]; l.r[1] = n.rotation[1]; l.r[2] = n.rotation[2]; l.r[3] = n.rotation[3];
                l.s[0] = n.scale[0]; l.s[1] = n.scale[1]; l.s[2] = n.scale[2];
            }
        }

        // 2. Sample upper body animation into nodes
        this._resetNodeTransforms();
        if (this.animations && this.animations.length > 0) {
            const uAnim = this.getAnimation(upperAnim);
            if (uAnim) this._sampleAnimation(uAnim, upperTime, loop);
        }

        // 3. Mask transforms
        const isUpper = this.upperBodyNodes;
        const isLower = this.lowerBodyNodes;
        const hipsIdx = this.hipsNodeIndex;
        const lCache = this.layerCacheState;

        for (let i = 0; i < nLen; i++) {
            const n = nodes[i];
            const l = lCache[i];

            if (i === hipsIdx) {
                if (hipsBlend <= 0.001) {
                    n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                    n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                    n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
                } else if (hipsBlend < 0.999) {
                    const hb = hipsBlend * upperWeight;
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * hb;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * hb;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * hb;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * hb;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * hb;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * hb;
                    this._slerp(n.rotation, l.r, n.rotation, hb);
                }
            } else if (isUpper && isUpper[i]) {
                if (upperWeight < 0.999) {
                    n.translation[0] = l.t[0] + (n.translation[0] - l.t[0]) * upperWeight;
                    n.translation[1] = l.t[1] + (n.translation[1] - l.t[1]) * upperWeight;
                    n.translation[2] = l.t[2] + (n.translation[2] - l.t[2]) * upperWeight;
                    n.scale[0] = l.s[0] + (n.scale[0] - l.s[0]) * upperWeight;
                    n.scale[1] = l.s[1] + (n.scale[1] - l.s[1]) * upperWeight;
                    n.scale[2] = l.s[2] + (n.scale[2] - l.s[2]) * upperWeight;
                    this._slerp(n.rotation, l.r, n.rotation, upperWeight);
                }
            } else if (isLower && isLower[i]) {
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            } else {
                n.translation[0] = l.t[0]; n.translation[1] = l.t[1]; n.translation[2] = l.t[2];
                n.rotation[0] = l.r[0]; n.rotation[1] = l.r[1]; n.rotation[2] = l.r[2]; n.rotation[3] = l.r[3];
                n.scale[0] = l.s[0]; n.scale[1] = l.s[1]; n.scale[2] = l.s[2];
            }
        }

        return this._applySkinningAndFinalize();
    }
};
