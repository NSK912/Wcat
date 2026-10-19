// === SEEDPLANET MODULE: JS/3D_UI.JS ===
// Genuine 3D UI rendered in WebGL or WebGPU as textured billboards

const World3DUI = {
  // Centralized theme colors for 3D UI buttons (เรือ, หุ่น, ทุกปุ่ม E)
  BORDER_COLOR: 'rgba(255, 255, 255, 0.65)',    // ขอบขาว
  BG_COLOR: 'rgba(60, 60, 60, 0.88)',            // พื้นหลังเทา
  PROGRESS_COLOR: 'rgba(255, 255, 255, 0.45)',   // Progress bar ขาว
  BUTTON_COLOR: '#dfb76c',                       // ปุ่ม E ทอง
  BUTTON_PROGRESS_COLOR: 'rgba(255, 255, 255, 0.45)',

  backend: null,
  signs: new Map(),
  hoveredSlotIndex: -1,
  _interactionsInitialized: false,
  
  // API matching the old World3DUI structure for compatibility
  init(context, type) {
    if (this.backend) return;
    
    this.type = type;
    if (type === 'webgl') {
      this.backend = this.createWebGLBackend(context);
    } else if (type === 'webgpu') {
      this.backend = this.createWebGPUBackend(context);
    }

    this.setupInteractions();
  },

  setupInteractions() {
    if (this._interactionsInitialized) return;
    this._interactionsInitialized = true;

    const getCursorPos = (e) => {
      let cx = e.clientX;
      let cy = e.clientY;
      if (typeof virtualCursorX === "number" && typeof virtualCursorY === "number" && (document.pointerLockElement || (typeof simulatedPointerLock !== "undefined" && simulatedPointerLock))) {
        cx = virtualCursorX;
        cy = virtualCursorY;
      }
      return { x: cx, y: cy };
    };

    window.addEventListener("pointermove", (e) => {
      const pos = getCursorPos(e);
      World3DUI.handlePointerMove(pos.x, pos.y);
    }, { passive: true });

    window.addEventListener("pointerdown", (e) => {
      const pos = getCursorPos(e);
      if (World3DUI.handleClick(pos.x, pos.y)) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
      }
    }, { capture: true });
  },

  transformVec4(mat, v) {
    return [
      mat[0] * v[0] + mat[4] * v[1] + mat[8] * v[2] + mat[12] * v[3],
      mat[1] * v[0] + mat[5] * v[1] + mat[9] * v[2] + mat[13] * v[3],
      mat[2] * v[0] + mat[6] * v[1] + mat[10] * v[2] + mat[14] * v[3],
      mat[3] * v[0] + mat[7] * v[1] + mat[11] * v[2] + mat[15] * v[3]
    ];
  },

  getScreenRay(screenX, screenY) {
    const W = window.innerWidth || (window.canvas ? window.canvas.width : 1);
    const H = window.innerHeight || (window.canvas ? window.canvas.height : 1);
    const invMat = window.invViewProj;
    if (!invMat) return null;

    const ndcX = (screenX / W) * 2.0 - 1.0;
    const ndcY = 1.0 - (screenY / H) * 2.0;

    const pNearHom = this.transformVec4(invMat, [ndcX, ndcY, -1.0, 1.0]);
    const pFarHom = this.transformVec4(invMat, [ndcX, ndcY, 1.0, 1.0]);
    if (Math.abs(pNearHom[3]) < 1e-7 || Math.abs(pFarHom[3]) < 1e-7) return null;

    const pNear = [pNearHom[0] / pNearHom[3], pNearHom[1] / pNearHom[3], pNearHom[2] / pNearHom[3]];
    const pFar = [pFarHom[0] / pFarHom[3], pFarHom[1] / pFarHom[3], pFarHom[2] / pFarHom[3]];

    const dir = [pFar[0] - pNear[0], pFar[1] - pNear[1], pFar[2] - pNear[2]];
    const dLen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    dir[0] /= dLen;
    dir[1] /= dLen;
    dir[2] /= dLen;

    return { origin: pNear, dir: dir };
  },

  raycastSign(signId, screenX, screenY) {
    const sign = this.signs.get(signId);
    if (!sign || !sign.visible) return null;

    const ray = this.getScreenRay(screenX, screenY);
    if (!ray) return null;

    const fwd = [-sign.normal[0], -sign.normal[1], -sign.normal[2]];
    const up = sign.up;
    const right = [
      up[1] * fwd[2] - up[2] * fwd[1],
      up[2] * fwd[0] - up[0] * fwd[2],
      up[0] * fwd[1] - up[1] * fwd[0]
    ];
    const rLen = Math.hypot(right[0], right[1], right[2]) || 1;
    right[0] /= rLen; right[1] /= rLen; right[2] /= rLen;

    const trueUp = [
      fwd[1] * right[2] - fwd[2] * right[1],
      fwd[2] * right[0] - fwd[0] * right[2],
      fwd[0] * right[1] - fwd[1] * right[0]
    ];
    const uLen = Math.hypot(trueUp[0], trueUp[1], trueUp[2]) || 1;
    trueUp[0] /= uLen; trueUp[1] /= uLen; trueUp[2] /= uLen;

    const sx = sign.scale[0] || 1;
    const sy = sign.scale[1] || 1;

    // Plane intersection
    const planeNormal = fwd;
    const denom = ray.dir[0] * planeNormal[0] + ray.dir[1] * planeNormal[1] + ray.dir[2] * planeNormal[2];
    if (Math.abs(denom) < 1e-6) return null;

    const p0 = sign.position;
    const t = ((p0[0] - ray.origin[0]) * planeNormal[0] +
               (p0[1] - ray.origin[1]) * planeNormal[1] +
               (p0[2] - ray.origin[2]) * planeNormal[2]) / denom;

    if (t < 0) return null;

    const hitP = [
      ray.origin[0] + t * ray.dir[0],
      ray.origin[1] + t * ray.dir[1],
      ray.origin[2] + t * ray.dir[2]
    ];

    const rel = [hitP[0] - p0[0], hitP[1] - p0[1], hitP[2] - p0[2]];
    const localX = (rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2]) / sx;
    const localY = (rel[0] * trueUp[0] + rel[1] * trueUp[1] + rel[2] * trueUp[2]) / sy;

    if (Math.abs(localX) > 0.5 || Math.abs(localY) > 0.5) return null;

    const u = localX + 0.5;
    const v = 0.5 - localY;

    return {
      hit: true,
      u: u,
      v: v,
      worldPos: hitP,
      distance: t,
      canvasW: sign.canvas.width,
      canvasH: sign.canvas.height
    };
  },

  raycastMechStandSlot(screenX, screenY) {
    const hitInfo = this.raycastSign("mech_stand_world_sign", screenX, screenY);
    if (!hitInfo) return null;

    const w = hitInfo.canvasW;
    const h = hitInfo.canvasH;
    const scale = w / 1024;

    // Canvas coordinate (taking into account horizontal flip ctx.scale(-1, 1))
    const canvasX = (1.0 - hitInfo.u) * w;
    const canvasY = hitInfo.v * h;

    const startX = 30 * scale;
    const startY = 88 * scale;
    const slotW = 226 * scale;
    const slotH = 236 * scale;
    const gapX = 18 * scale;
    const gapY = 16 * scale;

    let hitSlotIndex = -1;
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const sx = startX + col * (slotW + gapX);
      const sy = startY + row * (slotH + gapY);
      if (canvasX >= sx && canvasX <= sx + slotW && canvasY >= sy && canvasY <= sy + slotH) {
        hitSlotIndex = i;
        break;
      }
    }

    return {
      ...hitInfo,
      canvasX,
      canvasY,
      slotIndex: hitSlotIndex
    };
  },

  handleClick(screenX, screenY) {
    const hit = this.raycastMechStandSlot(screenX, screenY);
    if (hit && hit.slotIndex >= 0) {
      if (typeof window.triggerMechStandSlotAction === "function") {
        const success = window.triggerMechStandSlotAction(hit.slotIndex);
        const sign = this.signs.get("mech_stand_world_sign");
        if (sign) sign.needsTextureUpdate = true;
        return true;
      }
    }
    return false;
  },

  handlePointerMove(screenX, screenY) {
    const hit = this.raycastMechStandSlot(screenX, screenY);
    const newHover = (hit && hit.slotIndex >= 0) ? hit.slotIndex : -1;
    if (newHover !== this.hoveredSlotIndex) {
      this.hoveredSlotIndex = newHover;
      const sign = this.signs.get("mech_stand_world_sign");
      if (sign) sign.needsTextureUpdate = true;
    }
    return hit && hit.slotIndex >= 0;
  },

  createSign(options) {
    if (!this.backend) return null;
    return this.backend.createSign(options);
  },

  hasSign(id) {
    return this.signs.has(id);
  },

  removeSign(id) {
    if (!this.backend) return;
    this.backend.removeSign(id);
  },

  updateSign(id, options) {
    if (!this.backend) return;
    this.backend.updateSign(id, options);
  },

  updateAll(cameraPos = null) {
    if (!this.backend) return;
    this.backend.updateAll(cameraPos);
  },

  render(ctx, viewProjMatrix, cameraPos) {
    if (!this.backend) return;
    this.backend.render(ctx, viewProjMatrix, cameraPos);
  },

  // --- WebGL Backend ---
  createWebGLBackend(gl) {
    const backend = {
      gl: gl,
      program: null,
      positionBuffer: null,
      uvBuffer: null,
      locations: {},
      parent: this,
      
      init() {
        const vsSource = `
          attribute vec3 aPosition;
          attribute vec2 aUV;
          uniform mat4 uViewProj;
          uniform mat4 uModel;
          varying vec2 vUV;
          void main() {
            vUV = aUV;
            gl_Position = uViewProj * uModel * vec4(aPosition, 1.0);
          }
        `;
        const fsSource = `
          precision mediump float;
          varying vec2 vUV;
          uniform sampler2D uSampler;
          uniform vec4 uColor;
          void main() {
            vec4 texColor = texture2D(uSampler, vUV);
            if (texColor.a < 0.05) {
              discard;
            }
            gl_FragColor = texColor * uColor;
          }
        `;
        const vertexShader = this.loadShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fsSource);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        const positions = new Float32Array([
          -0.5,  0.5, 0.0,
          -0.5, -0.5, 0.0,
           0.5, -0.5, 0.0,
          -0.5,  0.5, 0.0,
           0.5, -0.5, 0.0,
           0.5,  0.5, 0.0,
        ]);
        const uvs = new Float32Array([
          0.0, 0.0,
          0.0, 1.0,
          1.0, 1.0,
          0.0, 0.0,
          1.0, 1.0,
          1.0, 0.0,
        ]);
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this.uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

        this.locations = {
          aPosition: gl.getAttribLocation(this.program, 'aPosition'),
          aUV: gl.getAttribLocation(this.program, 'aUV'),
          uViewProj: gl.getUniformLocation(this.program, 'uViewProj'),
          uModel: gl.getUniformLocation(this.program, 'uModel'),
          uSampler: gl.getUniformLocation(this.program, 'uSampler'),
          uColor: gl.getUniformLocation(this.program, 'uColor'),
        };
      },
      loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        return shader;
      },
      createSign(options) {
        const id = options.id;
        const width = options.resolution?.[0] || 256;
        const height = options.resolution?.[1] || 256;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        const ext = this.gl.getExtension('EXT_texture_filter_anisotropic') ||
                    this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') ||
                    this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
        if (ext) {
          const maxAniso = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
          this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, maxAniso));
        }

        const isPOT = (width & (width - 1)) === 0 && (height & (height - 1)) === 0;
        const isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext);
        if (isPOT || isWebGL2) {
          try {
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
          } catch(e) {
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
          }
        } else {
          this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        }
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        const sign = {
          id, canvas, ctx, texture,
          position: options.position || [0, 0, 0],
          scale: options.size || options.scale || [1, 1, 1],
          normal: options.normal || [0, 0, 1],
          up: options.up || [0, 1, 0],
          color: options.color || [1, 1, 1, 1],
          needsTextureUpdate: true,
          drawFn: options.drawFn || null,
          visible: true
        };
        this.parent.signs.set(id, sign);
        return sign;
      },
      removeSign(id) {
        const sign = this.parent.signs.get(id);
        if (sign && this.gl) this.gl.deleteTexture(sign.texture);
        this.parent.signs.delete(id);
      },
      updateSign(id, options) {
        const sign = this.parent.signs.get(id);
        if (!sign) return;
        if (options.position !== undefined) sign.position = options.position;
        if (options.size !== undefined) sign.scale = options.size;
        if (options.scale !== undefined) sign.scale = options.scale;
        if (options.normal !== undefined) sign.normal = options.normal;
        if (options.up !== undefined) sign.up = options.up;
        if (options.visible !== undefined) sign.visible = options.visible;
        if (options.drawFn !== undefined) {
          sign.drawFn = options.drawFn;
          sign.needsTextureUpdate = true;
        }
      },
      updateAll() {
        for (const [id, sign] of this.parent.signs) {
          if (!sign.visible) continue;
          if (sign.needsTextureUpdate && sign.drawFn) {
            sign.ctx.clearRect(0, 0, sign.canvas.width, sign.canvas.height);
            sign.drawFn(sign.ctx, sign.canvas.width, sign.canvas.height);
            this.gl.bindTexture(this.gl.TEXTURE_2D, sign.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sign.canvas);

            const w = sign.canvas.width;
            const h = sign.canvas.height;
            const isPOT = (w & (w - 1)) === 0 && (h & (h - 1)) === 0;
            const isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext);
            if (isPOT || isWebGL2) {
              try {
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
              } catch(e) {}
            }
            sign.needsTextureUpdate = false;
          }
        }
      },
      render(glContext, viewProjMatrix) {
        if (this.parent.signs.size === 0) return;
        this.updateAll();
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.locations.aPosition);
        gl.vertexAttribPointer(this.locations.aPosition, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.enableVertexAttribArray(this.locations.aUV);
        gl.vertexAttribPointer(this.locations.aUV, 2, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix4fv(this.locations.uViewProj, false, viewProjMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.locations.uSampler, 0);

        for (const [id, sign] of this.parent.signs) {
          if (!sign.visible) continue;
          if (sign.noDepthTest || id === "bow_aim_reticle") {
            gl.disable(gl.DEPTH_TEST);
            gl.depthMask(false);
          } else {
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);
          }
          const fwd = [-sign.normal[0], -sign.normal[1], -sign.normal[2]];
          const up = sign.up;
          const right = [
            up[1]*fwd[2] - up[2]*fwd[1],
            up[2]*fwd[0] - up[0]*fwd[2],
            up[0]*fwd[1] - up[1]*fwd[0]
          ];
          const rLen = Math.sqrt(right[0]*right[0] + right[1]*right[1] + right[2]*right[2]) || 1;
          right[0]/=rLen; right[1]/=rLen; right[2]/=rLen;
          const trueUp = [
            fwd[1]*right[2] - fwd[2]*right[1],
            fwd[2]*right[0] - fwd[0]*right[2],
            fwd[0]*right[1] - fwd[1]*right[0]
          ];
          const sx = sign.scale[0] || 1;
          const sy = sign.scale[1] || 1;
          const sz = 1.0;
          const modelMatrix = new Float32Array([
            right[0]*sx, right[1]*sx, right[2]*sx, 0,
            trueUp[0]*sy, trueUp[1]*sy, trueUp[2]*sy, 0,
            fwd[0]*sz, fwd[1]*sz, fwd[2]*sz, 0,
            sign.position[0], sign.position[1], sign.position[2], 1
          ]);
          gl.uniformMatrix4fv(this.locations.uModel, false, modelMatrix);
          gl.uniform4fv(this.locations.uColor, sign.color);
          gl.bindTexture(gl.TEXTURE_2D, sign.texture);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    };
    backend.init();
    return backend;
  },

  // --- High-level 3D UI Management Helpers ---
  updateBoatUI(options) {
    if (!this.backend) return;
    const {
      boat,
      isRiding = false,
      playerScale = 0.1,
      isEngineBoat = false,
      batteryPercent = 100,
      holdPercent = 0
    } = options;

    if (!boat || !boat.position || !boat.F || !boat.normal) {
      this.hideBoatUI();
      return;
    }

    // Fixed base scale (0.1) so 3D UI offsets remain constant regardless of player character scale
    const UI_BASE_SCALE = 0.1;
    const backOffset = (typeof window.boatUiBackOffset !== 'undefined' ? window.boatUiBackOffset : 2.47) * UI_BASE_SCALE;
    const upOffset = (typeof window.boatUiUpOffset !== 'undefined' ? window.boatUiUpOffset : 0.43) * UI_BASE_SCALE;
    const rightOffset = (typeof window.boatUiRightOffset !== 'undefined' ? window.boatUiRightOffset : 0.0) * UI_BASE_SCALE;
    const yawOffsetDeg = (typeof window.boatUiYawOffset !== 'undefined' ? window.boatUiYawOffset : 0.0);
    const pitchOffsetDeg = (typeof window.boatUiPitchOffset !== 'undefined' ? window.boatUiPitchOffset : -22.0);

    let bf = boat.F || [0, 0, 1];
    let bn = boat.normal || [0, 1, 0];
    let br = boat.R || [1, 0, 0];

    if (boat.angle !== undefined && boat.angle !== 0 && boat.R) {
      const cosH = Math.cos(boat.angle);
      const sinH = Math.sin(boat.angle);
      bf = [
        boat.F[0] * cosH + boat.R[0] * sinH,
        boat.F[1] * cosH + boat.R[1] * sinH,
        boat.F[2] * cosH + boat.R[2] * sinH
      ];
      br = [
        boat.R[0] * cosH - boat.F[0] * sinH,
        boat.R[1] * cosH - boat.F[1] * sinH,
        boat.R[2] * cosH - boat.F[2] * sinH
      ];
    }

    if (boat.bankAngle && Math.abs(boat.bankAngle) > 0.0001) {
      const cosB = Math.cos(boat.bankAngle);
      const sinB = Math.sin(boat.bankAngle);
      const bR = [
        br[0] * cosB - bn[0] * sinB,
        br[1] * cosB - bn[1] * sinB,
        br[2] * cosB - bn[2] * sinB
      ];
      const bN = [
        bn[0] * cosB + br[0] * sinB,
        bn[1] * cosB + br[1] * sinB,
        bn[2] * cosB + br[2] * sinB
      ];
      br = bR;
      bn = bN;
    }

    let targetWorldPos = [
      boat.position[0] - bf[0] * backOffset + bn[0] * upOffset + br[0] * rightOffset,
      boat.position[1] - bf[1] * backOffset + bn[1] * upOffset + br[1] * rightOffset,
      boat.position[2] - bf[2] * backOffset + bn[2] * upOffset + br[2] * rightOffset
    ];

    if (yawOffsetDeg !== 0) {
      const yawRad = yawOffsetDeg * (Math.PI / 180);
      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const bf_old = [...bf];
      bf = [
        bf_old[0] * cosY + br[0] * sinY,
        bf_old[1] * cosY + br[1] * sinY,
        bf_old[2] * cosY + br[2] * sinY
      ];
      br = [
        br[0] * cosY - bf_old[0] * sinY,
        br[1] * cosY - bf_old[1] * sinY,
        br[2] * cosY - bf_old[2] * sinY
      ];
    }

    if (pitchOffsetDeg !== 0) {
      const pitchRad = pitchOffsetDeg * (Math.PI / 180);
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const bf_old = [...bf];
      bf = [
        bf_old[0] * cosP + bn[0] * sinP,
        bf_old[1] * cosP + bn[1] * sinP,
        bf_old[2] * cosP + bn[2] * sinP
      ];
      bn = [
        bn[0] * cosP - bf_old[0] * sinP,
        bn[1] * cosP - bf_old[1] * sinP,
        bn[2] * cosP - bf_old[2] * sinP
      ];
    }

    const signNormal = [-bf[0], -bf[1], -bf[2]];
    const signUp = [bn[0], bn[1], bn[2]];
    const boatScale = (typeof window.boatUiScale === 'number' ? window.boatUiScale : 0.47);
    const signW = 0.18 * boatScale;
    const signH = 0.18 * boatScale;
    const boatSignId = "boat_world_sign";

    const drawBoatUI = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      // สลับด้าน (Flip horizontally) to fix mirrored 3D UI
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      const p = 4; // padding
      const innerW = w - p * 2;
      const innerH = h - p * 2;

      // Draw outer border (ขอบขาว)
      ctx.fillStyle = World3DUI.BORDER_COLOR;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w - 20, 0);
      ctx.lineTo(w, 20);
      ctx.lineTo(w, h);
      ctx.lineTo(20, h);
      ctx.lineTo(0, h - 20);
      ctx.closePath();
      ctx.fill();

      // Draw inner background (พื้นหลังเทา)
      ctx.fillStyle = World3DUI.BG_COLOR;
      ctx.beginPath();
      ctx.moveTo(p, p);
      ctx.lineTo(w - 20, p);
      ctx.lineTo(w - p, 20);
      ctx.lineTo(w - p, h - p);
      ctx.lineTo(20, h - p);
      ctx.lineTo(p, h - 20);
      ctx.closePath();
      ctx.fill();

      // Draw progress bars (Progress bar ขาว)
      if (holdPercent > 0) {
        ctx.fillStyle = World3DUI.PROGRESS_COLOR;
        ctx.fillRect(p, p, innerW * (holdPercent / 100), innerH);
      }

      // Draw text or icon
      if (isEngineBoat) {
        if (typeof create3DIconCanvas === 'function') {
           const c = create3DIconCanvas("GLOW_BATTERY", 128, 128);
           if (c) {
              const imgSize = w * 0.75;
              ctx.drawImage(c, (w - imgSize) / 2, (h - imgSize) / 2, imgSize, imgSize);
           } else {
             ctx.fillStyle = '#fff';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.font = 'bold 120px "Google Sans", sans-serif';
             ctx.fillText('🔋', w / 2, h / 2);
           }
        } else {
           ctx.fillStyle = '#fff';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.font = 'bold 120px "Google Sans", sans-serif';
           ctx.fillText('🔋', w / 2, h / 2);
        }
      } else {
        const isGp = (typeof isCurrentlyGamepadMode === 'function' ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
        let btnText = 'E';
        if (isGp && window.GamepadController && typeof window.GamepadController.getButtonLabel === 'function') {
          btnText = window.GamepadController.getButtonLabel('interact');
        }
        ctx.fillStyle = World3DUI.BUTTON_COLOR || '#dfb76c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = btnText.length > 1 ? 'bold 96px "Google Sans", sans-serif' : 'bold 120px "Google Sans", sans-serif';
        ctx.fillText(btnText, w / 2, h / 2);
      }

      ctx.restore();
    };

    if (!this.hasSign(boatSignId)) {
      this.createSign({
        id: boatSignId,
        position: targetWorldPos,
        normal: signNormal,
        up: signUp,
        size: [signW, signH],
        resolution: [256, 256],
        drawFn: drawBoatUI,
        visible: true
      });
    } else {
      this.updateSign(boatSignId, {
        position: targetWorldPos,
        normal: signNormal,
        up: signUp,
        size: [signW, signH],
        drawFn: drawBoatUI,
        visible: true
      });
    }
  },

  hideBoatUI() {
    if (this.hasSign("boat_world_sign")) {
      this.removeSign("boat_world_sign");
    }
  },

  
  updateMechRideUI(options) {
    if (!this.backend) return;
    const {
      mech,
      playerScale = 0.1,
      holdPercent = 0,
      isDismount = false,
      extraStatus = "",
      batteryPercent = 100,
      hasBattery = false,
      targetPos
    } = options;

    if (!mech || !mech.position) {
      this.hideMechRideUI();
      return;
    }


    const isFps = (window.cameraMode === 'fps' || window.cameraMode === 'firstperson');
    const isRiding = isDismount; // isDismount is true when player is ON the mech (showing E to dismount)

    // 1. FPS Offsets (Riding)
    const fpsForward = (typeof window.devgame?.mechRideUiFpsForwardOffset !== 'undefined') ? window.devgame.mechRideUiFpsForwardOffset : 1.41;
    const fpsUp = (typeof window.devgame?.mechRideUiFpsUpOffset !== 'undefined') ? window.devgame.mechRideUiFpsUpOffset : 1.10;
    const fpsRight = (typeof window.devgame?.mechRideUiFpsRightOffset !== 'undefined') ? window.devgame.mechRideUiFpsRightOffset : 0.0;
    const fpsScale = (typeof window.devgame?.mechRideUiFpsScale !== 'undefined') ? window.devgame.mechRideUiFpsScale : 0.47;
    const fpsYaw = (typeof window.devgame?.mechRideUiFpsYawOffset !== 'undefined') ? window.devgame.mechRideUiFpsYawOffset : 0.0;
    const fpsPitch = (typeof window.devgame?.mechRideUiFpsPitchOffset !== 'undefined') ? window.devgame.mechRideUiFpsPitchOffset : 0;
    
    // 2. TPS Offsets (Riding)
    const tpsForward = (typeof window.devgame?.mechRideUiTpsForwardOffset !== 'undefined') ? window.devgame.mechRideUiTpsForwardOffset : -2.01;
    const tpsUp = (typeof window.devgame?.mechRideUiTpsUpOffset !== 'undefined') ? window.devgame.mechRideUiTpsUpOffset : 1.68;
    const tpsRight = (typeof window.devgame?.mechRideUiTpsRightOffset !== 'undefined') ? window.devgame.mechRideUiTpsRightOffset : 0.0;
    const tpsScale = (typeof window.devgame?.mechRideUiTpsScale !== 'undefined') ? window.devgame.mechRideUiTpsScale : 0.47;
    const tpsYaw = (typeof window.devgame?.mechRideUiTpsYawOffset !== 'undefined') ? window.devgame.mechRideUiTpsYawOffset : 0.0;
    const tpsPitch = (typeof window.devgame?.mechRideUiTpsPitchOffset !== 'undefined') ? window.devgame.mechRideUiTpsPitchOffset : 0;

    // 3. OUT Offsets (Not Riding / Mounting - Anchored on the Mech Leg)
    const outForward = (typeof window.devgame?.mechRideUiOutForwardOffset !== 'undefined') ? window.devgame.mechRideUiOutForwardOffset : 0.35;
    const outUp = (typeof window.devgame?.mechRideUiOutUpOffset !== 'undefined') ? window.devgame.mechRideUiOutUpOffset : 0.0;
    const outRight = (typeof window.devgame?.mechRideUiOutRightOffset !== 'undefined') ? window.devgame.mechRideUiOutRightOffset : 0.0;
    const outScale = (typeof window.devgame?.mechRideUiOutScale !== 'undefined') ? window.devgame.mechRideUiOutScale : 0.47;
    const outYaw = (typeof window.devgame?.mechRideUiOutYawOffset !== 'undefined') ? window.devgame.mechRideUiOutYawOffset : 0.0;
    const outPitch = (typeof window.devgame?.mechRideUiOutPitchOffset !== 'undefined') ? window.devgame.mechRideUiOutPitchOffset : 0;

    // Fixed base scale (0.1) so 3D UI offsets remain constant regardless of player character scale
    const UI_BASE_SCALE = 0.1;
    const forwardOffset = (!isRiding ? outForward : (isFps ? fpsForward : tpsForward)) * UI_BASE_SCALE;
    const upOffset = (!isRiding ? outUp : (isFps ? fpsUp : tpsUp)) * UI_BASE_SCALE;
    const rightOffset = (!isRiding ? outRight : (isFps ? fpsRight : tpsRight)) * UI_BASE_SCALE;
    const yawOffsetDeg = (!isRiding ? outYaw : (isFps ? fpsYaw : tpsYaw));
    const pitchOffsetDeg = (!isRiding ? outPitch : (isFps ? fpsPitch : tpsPitch));
    const scale = (!isRiding ? outScale : (isFps ? fpsScale : tpsScale));

    let mf = mech.F || [0, 0, 1];
    let mn = mech.normal || [0, 1, 0];
    let mr = mech.R || [1, 0, 0];

    // If mech has rotation/angle, apply it to vectors
    if (mech.angle !== undefined && mech.angle !== 0) {
      const baseF = mech.F || [0, 0, 1];
      const baseR = mech.R || [1, 0, 0];
      const cosH = Math.cos(mech.angle);
      const sinH = Math.sin(mech.angle);
      mf = [
        baseF[0] * cosH + baseR[0] * sinH,
        baseF[1] * cosH + baseR[1] * sinH,
        baseF[2] * cosH + baseR[2] * sinH
      ];
      mr = [
        baseR[0] * cosH - baseF[0] * sinH,
        baseR[1] * cosH - baseF[1] * sinH,
        baseR[2] * cosH - baseF[2] * sinH
      ];
    }

    const basePos = targetPos || mech.position;
    let targetWorldPos = [
      basePos[0] + mf[0] * forwardOffset + mn[0] * upOffset + mr[0] * rightOffset,
      basePos[1] + mf[1] * forwardOffset + mn[1] * upOffset + mr[1] * rightOffset,
      basePos[2] + mf[2] * forwardOffset + mn[2] * upOffset + mr[2] * rightOffset
    ];

    if (yawOffsetDeg !== 0) {
      const yawRad = yawOffsetDeg * (Math.PI / 180);
      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const mf_old = [...mf];
      mf = [
        mf_old[0] * cosY + mr[0] * sinY,
        mf_old[1] * cosY + mr[1] * sinY,
        mf_old[2] * cosY + mr[2] * sinY
      ];
      mr = [
        mr[0] * cosY - mf_old[0] * sinY,
        mr[1] * cosY - mf_old[1] * sinY,
        mr[2] * cosY - mf_old[2] * sinY
      ];
    }

    if (pitchOffsetDeg !== 0) {
      const pitchRad = pitchOffsetDeg * (Math.PI / 180);
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const mf_old = [...mf];
      mf = [
        mf_old[0] * cosP + mn[0] * sinP,
        mf_old[1] * cosP + mn[1] * sinP,
        mf_old[2] * cosP + mn[2] * sinP
      ];
      mn = [
        mn[0] * cosP - mf_old[0] * sinP,
        mn[1] * cosP - mf_old[1] * sinP,
        mn[2] * cosP - mf_old[2] * sinP
      ];
    }


    const signNormal = [-mf[0], -mf[1], -mf[2]];
    const signUp = [mn[0], mn[1], mn[2]];
    
    // Use the viewport scale we calculated above (independent of playerScale)
    const signW = 0.18 * scale;
    const signH = 0.18 * scale;
    const signId = "mech_ride_world_sign";


    const drawMechRideUI = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      // สลับด้าน (Flip horizontally) to fix mirrored 3D UI
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      const p = 4; // padding
      const innerW = w - p * 2;
      const innerH = h - p * 2;

      // Draw outer border (ขอบขาว)
      ctx.fillStyle = World3DUI.BORDER_COLOR;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w - 20, 0);
      ctx.lineTo(w, 20);
      ctx.lineTo(w, h);
      ctx.lineTo(20, h);
      ctx.lineTo(0, h - 20);
      ctx.closePath();
      ctx.fill();

      // Draw inner background (พื้นหลังเทา)
      ctx.fillStyle = World3DUI.BG_COLOR;
      ctx.beginPath();
      ctx.moveTo(p, p);
      ctx.lineTo(w - 20, p);
      ctx.lineTo(w - p, 20);
      ctx.lineTo(w - p, h - p);
      ctx.lineTo(20, h - p);
      ctx.lineTo(p, h - 20);
      ctx.closePath();
      ctx.fill();

      // Draw progress bars (Progress bar ขาว)
      if (holdPercent > 0) {
        ctx.fillStyle = World3DUI.PROGRESS_COLOR;
        ctx.fillRect(p, p, innerW * (holdPercent / 100), innerH);
      }

      // If riding the mech and has battery, show battery icon; when mounting (before getting on) or without battery, show 'E'
      if (isDismount && hasBattery) {
        if (typeof create3DIconCanvas === 'function') {
           const c = create3DIconCanvas("GLOW_BATTERY", 128, 128);
           if (c) {
              const imgSize = w * 0.75;
              ctx.drawImage(c, (w - imgSize) / 2, (h - imgSize) / 2, imgSize, imgSize);
           } else {
             ctx.fillStyle = '#fff';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.font = 'bold 120px "Google Sans", sans-serif';
             ctx.fillText('🔋', w / 2, h / 2);
           }
        } else {
           ctx.fillStyle = '#fff';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.font = 'bold 120px "Google Sans", sans-serif';
           ctx.fillText('🔋', w / 2, h / 2);
        }
      } else {
        const isGp = (typeof isCurrentlyGamepadMode === 'function' ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
        let btnText = 'E';
        if (isGp && window.GamepadController && typeof window.GamepadController.getButtonLabel === 'function') {
          btnText = window.GamepadController.getButtonLabel('interact');
        }
        ctx.fillStyle = World3DUI.BUTTON_COLOR || '#dfb76c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = btnText.length > 1 ? 'bold 96px "Google Sans", sans-serif' : 'bold 120px "Google Sans", sans-serif';
        ctx.fillText(btnText, w / 2, h / 2);
      }

      ctx.restore();
    };

    if (!this.hasSign(signId)) {
      this.createSign({
        id: signId,
        position: targetWorldPos,
        normal: signNormal,
        up: signUp,
        size: [signW, signH],
        resolution: [256, 256],
        drawFn: drawMechRideUI,
        visible: true
      });
    } else {
      this.updateSign(signId, {
        position: targetWorldPos,
        normal: signNormal,
        up: signUp,
        size: [signW, signH],
        drawFn: drawMechRideUI,
        visible: true
      });
    }
  },

  hideMechRideUI() {
    if (this.hasSign("mech_ride_world_sign")) {
      this.removeSign("mech_ride_world_sign");
    }
  },

  updateMechStandUI(options) {
    if (!this.backend) return;
    const { stand, parts = [], playerScale = 0.1, holdPercent = 0 } = options;

    if (!stand || !stand.position) {
      this.hideMechStandUI();
      return;
    }

    let sn = stand.normal ? [...stand.normal] : [0, 1, 0];
    let sf = stand.F ? [...stand.F] : [0, 0, 1];
    let sr = stand.R ? [...stand.R] : [1, 0, 0];

    // Fixed UI offsets independent of player character scale
    const upOffset = (typeof window.mechStandUiUpOffset === "number" ? window.mechStandUiUpOffset : 0.16);
    const rightOffset = (typeof window.mechStandUiRightOffset === "number" ? window.mechStandUiRightOffset : 0.0);
    const forwardOffset = (typeof window.mechStandUiForwardOffset === "number" ? window.mechStandUiForwardOffset : 0.22);
    const yawOffsetDeg = (typeof window.mechStandUiYawOffset === "number" ? window.mechStandUiYawOffset : 180.0);
    const pitchOffsetDeg = (typeof window.mechStandUiPitchOffset === "number" ? window.mechStandUiPitchOffset : 0.0);
    const scaleVal = (typeof window.mechStandUiScale === "number" ? window.mechStandUiScale : 0.34);

    let targetWorldPos = [
      stand.position[0] + sn[0] * upOffset + sr[0] * rightOffset + sf[0] * forwardOffset,
      stand.position[1] + sn[1] * upOffset + sr[1] * rightOffset + sf[1] * forwardOffset,
      stand.position[2] + sn[2] * upOffset + sr[2] * rightOffset + sf[2] * forwardOffset
    ];

    if (yawOffsetDeg !== 0) {
      const yawRad = yawOffsetDeg * (Math.PI / 180);
      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const sf_old = [...sf];
      sf = [
        sf_old[0] * cosY + sr[0] * sinY,
        sf_old[1] * cosY + sr[1] * sinY,
        sf_old[2] * cosY + sr[2] * sinY
      ];
      sr = [
        sr[0] * cosY - sf_old[0] * sinY,
        sr[1] * cosY - sf_old[1] * sinY,
        sr[2] * cosY - sf_old[2] * sinY
      ];
    }

    if (pitchOffsetDeg !== 0) {
      const pitchRad = pitchOffsetDeg * (Math.PI / 180);
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const sf_old = [...sf];
      sf = [
        sf_old[0] * cosP + sn[0] * sinP,
        sf_old[1] * cosP + sn[1] * sinP,
        sf_old[2] * cosP + sn[2] * sinP
      ];
      sn = [
        sn[0] * cosP - sf_old[0] * sinP,
        sn[1] * cosP - sf_old[1] * sinP,
        sn[2] * cosP - sf_old[2] * sinP
      ];
    }

    // World3DUI sign faces -normal, so to face towards +sf:
    const signNormal = [-sf[0], -sf[1], -sf[2]];
    const signUp = [sn[0], sn[1], sn[2]];
    const signW = 0.68 * scaleVal;
    const signH = 0.40 * scaleVal;
    const standSignId = "mech_stand_world_sign";

    // Gather equipped parts
    const equippedItems = [];
    equippedItems.push({
      item: stand,
      type: "robot_stand",
      label: (typeof t === "function") ? t("mech_part_stand") : "Stand"
    });

    const partsList = Array.isArray(parts) ? parts : [];
    function getPartLabel(typeOrName) {
      const tKey = (typeOrName || "").toLowerCase();
      if (tKey.includes("cockpit")) return (typeof t === "function") ? t("mech_part_cockpit") : "Cockpit";
      if (tKey.includes("left_arm")) return (typeof t === "function") ? t("mech_part_left_arm") : "Left Arm";
      if (tKey.includes("right_arm")) return (typeof t === "function") ? t("mech_part_right_arm") : "Right Arm";
      if (tKey.includes("left_leg")) return (typeof t === "function") ? t("mech_part_left_leg") : "Left Leg";
      if (tKey.includes("right_leg")) return (typeof t === "function") ? t("mech_part_right_leg") : "Right Leg";
      if (tKey.includes("stand")) return (typeof t === "function") ? t("mech_part_stand") : "Stand";
      if (tKey.includes("core")) return (typeof t === "function") ? t("mech_part_core") : "Power Core";
      if (tKey.includes("module")) return (typeof t === "function") ? t("mech_part_module") : "Module";
      if (typeof getItemDisplayName === "function") return getItemDisplayName(typeOrName);
      return typeOrName || "Robot Part";
    }

    partsList.forEach(p => {
      if (p && p.active && !p.isPreview && p.type && p.type !== "robot_stand") {
        equippedItems.push({
          item: p,
          type: p.type,
          label: getPartLabel(p.type)
        });
      }
    });

    if (!window._mech3dIconCache) window._mech3dIconCache = {};
    const getCachedIcon = (type, size = 192) => {
      if (!type) return null;
      const cacheKey = `${type}_${size}`;
      if (window._mech3dIconCache[cacheKey]) return window._mech3dIconCache[cacheKey];
      if (typeof create3DIconCanvas === "function") {
        const c = create3DIconCanvas(type, size, size);
        if (c) {
          window._mech3dIconCache[cacheKey] = c;
          return c;
        }
      }
      return null;
    };

    const drawMechStandUI = (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const scale = w / 1024;

      ctx.save();
      // Flip horizontally for 3D Quad rendering
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      const cut = 24 * scale;
      // Outer golden cyber border (2 cuts: Top-Right & Bottom-Left)
      ctx.fillStyle = 'rgba(223, 183, 108, 0.55)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w - cut, 0);
      ctx.lineTo(w, cut);
      ctx.lineTo(w, h);
      ctx.lineTo(cut, h);
      ctx.lineTo(0, h - cut);
      ctx.closePath();
      ctx.fill();

      // Inner glassy dark background (2 cuts: Top-Right & Bottom-Left)
      const pad = 5 * scale;
      ctx.fillStyle = 'rgba(10, 12, 18, 0.94)';
      ctx.beginPath();
      ctx.moveTo(pad, pad);
      ctx.lineTo(w - cut, pad);
      ctx.lineTo(w - pad, cut);
      ctx.lineTo(w - pad, h - pad);
      ctx.lineTo(cut, h - pad);
      ctx.lineTo(pad, h - cut);
      ctx.closePath();
      ctx.fill();

      // Title & Header
      ctx.fillStyle = '#dfb76c';
      ctx.font = `bold ${Math.round(24 * scale)}px "Google Sans", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const titleText = (typeof t === "function") ? t("robot_stand_title") : "ROBOT STAND SYSTEM";
      ctx.fillText('⚙ ' + titleText, 36 * scale, 42 * scale);


      
      // Header Separator Line
      ctx.strokeStyle = 'rgba(223, 183, 108, 0.3)';
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath();
      ctx.moveTo(24 * scale, 70 * scale);
      ctx.lineTo(w - 24 * scale, 70 * scale);
      ctx.stroke();

      // 8 Slots (4 columns x 2 rows)
      const startX = 30 * scale;
      const startY = 88 * scale;
      const slotW = 226 * scale;
      const slotH = 236 * scale;
      const gapX = 18 * scale;
      const gapY = 16 * scale;
      const slotCut = 12 * scale;

      for (let i = 0; i < 8; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const sx = startX + col * (slotW + gapX);
        const sy = startY + row * (slotH + gapY);
        const equippedData = equippedItems[i] || null;
        const isEquipped = !!equippedData;
        const isHovered = (World3DUI.hoveredSlotIndex === i);

        // Slot Border (2 cuts: Top-Right & Bottom-Left)
        if (isHovered) {
          ctx.fillStyle = isEquipped ? '#ffe58f' : '#38bdf8';
        } else {
          ctx.fillStyle = isEquipped ? 'rgba(223, 183, 108, 0.75)' : 'rgba(255, 255, 255, 0.14)';
        }
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + slotW - slotCut, sy);
        ctx.lineTo(sx + slotW, sy + slotCut);
        ctx.lineTo(sx + slotW, sy + slotH);
        ctx.lineTo(sx + slotCut, sy + slotH);
        ctx.lineTo(sx, sy + slotH - slotCut);
        ctx.closePath();
        ctx.fill();

        // Slot Background (2 cuts: Top-Right & Bottom-Left)
        const sPad = 2 * scale;
        if (isHovered) {
          ctx.fillStyle = isEquipped ? 'rgba(42, 52, 76, 0.98)' : 'rgba(24, 38, 58, 0.95)';
        } else {
          ctx.fillStyle = isEquipped ? 'rgba(24, 28, 40, 0.95)' : 'rgba(12, 14, 20, 0.85)';
        }
        ctx.beginPath();
        ctx.moveTo(sx + sPad, sy + sPad);
        ctx.lineTo(sx + slotW - slotCut, sy + sPad);
        ctx.lineTo(sx + slotW - sPad, sy + slotCut);
        ctx.lineTo(sx + slotW - sPad, sy + slotH - sPad);
        ctx.lineTo(sx + slotCut, sy + slotH - sPad);
        ctx.lineTo(sx + sPad, sy + slotH - slotCut);
        ctx.closePath();
        ctx.fill();

        // Top-left slot number
        ctx.fillStyle = isHovered ? (isEquipped ? '#ffe58f' : '#38bdf8') : (isEquipped ? '#dfb76c' : 'rgba(255, 255, 255, 0.35)');
        ctx.font = `bold ${Math.round(15 * scale)}px "Google Sans", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`#0${i + 1}`, sx + 12 * scale, sy + 10 * scale);

        // Center Icon
        if (isEquipped) {
          const iconCanvas = getCachedIcon(equippedData.type, Math.round(96 * scale));
          if (iconCanvas) {
            const iconSize = 100 * scale;
            ctx.drawImage(iconCanvas, sx + (slotW - iconSize) / 2, sy + 38 * scale, iconSize, iconSize);
          } else {
            ctx.fillStyle = '#dfb76c';
            ctx.font = `${Math.round(36 * scale)}px "Google Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🤖', sx + slotW / 2, sy + 88 * scale);
          }

          // Part Label
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(16 * scale)}px "Google Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(equippedData.label, sx + slotW / 2, sy + 164 * scale);

          // Status Badge
          if (isHovered) {
            ctx.fillStyle = (equippedData.type === "robot_stand") ? '#94a3b8' : '#f59e0b';
            ctx.font = `bold ${Math.round(14 * scale)}px "Google Sans", sans-serif`;
            ctx.fillText((equippedData.type === "robot_stand") ? '🔒 LOCKED' : '⚡ DISMANTLE', sx + slotW / 2, sy + 200 * scale);
          } else {
            ctx.fillStyle = '#4ade80';
            ctx.font = `bold ${Math.round(14 * scale)}px "Google Sans", sans-serif`;
            ctx.fillText('✔ EQUIPPED', sx + slotW / 2, sy + 200 * scale);
          }
        } else {
          // Empty slot representation
          ctx.strokeStyle = isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = isHovered ? (2.5 * scale) : (1.5 * scale);
          ctx.beginPath();
          ctx.arc(sx + slotW / 2, sy + 88 * scale, 28 * scale, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)';
          ctx.font = isHovered ? `bold ${Math.round(30 * scale)}px "Google Sans", sans-serif` : `${Math.round(28 * scale)}px "Google Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+', sx + slotW / 2, sy + 88 * scale);

          // Status
          if (isHovered) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = `bold ${Math.round(14 * scale)}px "Google Sans", sans-serif`;
            ctx.fillText('✚ EQUIP PART', sx + slotW / 2, sy + 200 * scale);
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.font = `${Math.round(14 * scale)}px "Google Sans", sans-serif`;
            ctx.fillText('✚ EMPTY', sx + slotW / 2, sy + 200 * scale);
          }
        }
      }

      ctx.restore();
    };

    if (!this.hasSign(standSignId)) {
      this.createSign({
        id: standSignId,
        position: targetWorldPos,
        normal: signNormal,
        up: signUp,
        size: [signW, signH],
        resolution: [2048, 1200],
        drawFn: drawMechStandUI,
        visible: true
      });
    } else {
      this.updateSign(standSignId, {
        position: targetWorldPos,
        normal: signNormal,
        up: signUp,
        size: [signW, signH],
        drawFn: drawMechStandUI,
        visible: true
      });
    }
  },

  hideMechStandUI() {
    if (this.hasSign("mech_stand_world_sign")) {
      this.removeSign("mech_stand_world_sign");
    }
  },

  // --- 3D Aim Reticle System (Bow, Arm Cannon & Demolish Mode) ---
  _drawAimReticleCanvas(ctx, w, h, isLocked, isDemolish = false, demolishProgress = 0, demolishLabel = "") {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.36;

    // Subtle drop shadow for clarity on all terrain
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 6;

    const mainColor = isDemolish
      ? (isLocked ? "#ff3b30" : "#ffffff")
      : (isLocked ? "#ff3b30" : "#ffffff");

    // Circular ring (the same 3D crosshair circle as gun)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = isLocked ? 6.5 : 5.5;
    ctx.strokeStyle = mainColor;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();

    // Corner brackets when locked (precision target reticle)
    if (isLocked) {
      const bDist = r + 7;
      const bLen = 9;
      ctx.lineWidth = 4;
      ctx.strokeStyle = mainColor;

      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(cx - bDist, cy - bDist + bLen);
      ctx.lineTo(cx - bDist, cy - bDist);
      ctx.lineTo(cx - bDist + bLen, cy - bDist);
      ctx.stroke();

      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(cx + bDist - bLen, cy - bDist);
      ctx.lineTo(cx + bDist, cy - bDist);
      ctx.lineTo(cx + bDist, cy - bDist + bLen);
      ctx.stroke();

      // Bottom-Left corner
      ctx.beginPath();
      ctx.moveTo(cx - bDist, cy + bDist - bLen);
      ctx.lineTo(cx - bDist, cy + bDist);
      ctx.lineTo(cx - bDist + bLen, cy + bDist);
      ctx.stroke();

      // Bottom-Right corner
      ctx.beginPath();
      ctx.moveTo(cx + bDist - bLen, cy + bDist);
      ctx.lineTo(cx + bDist, cy + bDist);
      ctx.lineTo(cx + bDist, cy + bDist - bLen);
      ctx.stroke();

      // Circular progress bar when holding to demolish (e.g. stone floor)
      if (demolishProgress > 0) {
        ctx.beginPath();
        const startAng = -Math.PI / 2;
        const endAng = startAng + Math.PI * 2 * Math.min(1.0, demolishProgress);
        ctx.arc(cx, cy, r + 4, startAng, endAng);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }
  },

  updateAimReticle(options) {
    if (!this.backend) return;
    const {
      targetPos,
      isLocked = false,
      cameraPos = null,
      cameraUp = null,
      isDemolish = false,
      demolishProgress = 0,
      demolishLabel = ""
    } = options;

    if (!targetPos || !Array.isArray(targetPos) || targetPos.length < 3) {
      this.hideAimReticle();
      return;
    }

    const signId = "bow_aim_reticle";
    const camP = cameraPos || (window.cameraPos || [0, 10, 0]);

    // Vector pointing towards camera
    const dx = camP[0] - targetPos[0];
    const dy = camP[1] - targetPos[1];
    const dz = camP[2] - targetPos[2];
    const dist = Math.hypot(dx, dy, dz) || 1.0;
    const normal = [dx / dist, dy / dist, dz / dist];

    // Offset slightly towards camera to stay clearly in front of surfaces without clipping into camera
    const offsetDist = Math.min(0.15, Math.max(0.005, dist * 0.03));
    const displayPos = [
      targetPos[0] + normal[0] * offsetDist,
      targetPos[1] + normal[1] * offsetDist,
      targetPos[2] + normal[2] * offsetDist
    ];

    let up = cameraUp || [0, 1, 0];
    // Keep apparent screen pixel size 100% constant across all distances (no minimum clamp explosion when close)
    const targetScreenFactor = isDemolish ? 0.028 : 0.034;
    const scaleSize = Math.max(0.002, dist * targetScreenFactor);

    const stateKey = `${isLocked}_${isDemolish}_${Math.round(demolishProgress * 25)}_${demolishLabel}`;

    if (!this.hasSign(signId)) {
      const sign = this.createSign({
        id: signId,
        position: displayPos,
        normal: normal,
        up: up,
        size: [scaleSize, scaleSize],
        resolution: [256, 256],
        drawFn: (ctx, w, h) => {
          this._drawAimReticleCanvas(ctx, w, h, isLocked, isDemolish, demolishProgress, demolishLabel);
        },
        visible: true
      });
      if (sign) {
        sign.noDepthTest = true;
        sign._lastStateKey = stateKey;
      }
    } else {
      const sign = this.signs.get(signId);
      if (sign) {
        sign.position = displayPos;
        sign.normal = normal;
        sign.up = up;
        sign.scale = [scaleSize, scaleSize, 1];
        sign.noDepthTest = true;
        sign.visible = true;
        if (sign._lastStateKey !== stateKey) {
          sign._lastStateKey = stateKey;
          sign.drawFn = (ctx, w, h) => {
            this._drawAimReticleCanvas(ctx, w, h, isLocked, isDemolish, demolishProgress, demolishLabel);
          };
          sign.needsTextureUpdate = true;
        }
      }
    }
  },

  hideAimReticle() {
    const sign = this.signs.get("bow_aim_reticle");
    if (sign && sign.visible) {
      sign.visible = false;
    }
  },
  createWebGPUBackend(device) {
    // Left as placeholder since game uses WebGL mode by default
    // If WebGPU mode is needed, port the WGSL code here.
    return {
      device: device,
      parent: this,
      createSign(options) { return null; },
      removeSign(id) {},
      updateSign(id, options) {},
      updateAll(cameraPos) {},
      render(passEncoder, viewProjMatrix, cameraPos) {}
    };
  }
};

window.World3DUI = World3DUI;
