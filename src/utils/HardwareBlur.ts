export class HardwareBlurEngine {
  private inited = false;
  private mode: 'webgpu' | 'webgl' | 'none' = 'none';

  // WebGPU
  private device?: GPUDevice;
  private gpuCanvas?: OffscreenCanvas;
  private gpuCtx?: GPUCanvasContext;
  private pipeline?: GPURenderPipeline;
  private sampler?: GPUSampler;
  private uniformBuffer?: GPUBuffer;
  private bindGroupLayout?: GPUBindGroupLayout;

  // WebGL
  private glCanvas?: OffscreenCanvas;
  private gl?: WebGL2RenderingContext | WebGLRenderingContext;
  private glProgram?: WebGLProgram;
  private glPosBuffer?: WebGLBuffer;
  private glTexBuffer?: WebGLBuffer;
  private glLocRadius?: WebGLUniformLocation;
  private glLocResolution?: WebGLUniformLocation;
  private glTexture?: WebGLTexture;

  private static _instance: HardwareBlurEngine | null = null;
  static get instance(): HardwareBlurEngine {
    if (!this._instance) {
      this._instance = new HardwareBlurEngine();
    }
    return this._instance;
  }

  async init() {
    if (this.inited) return;
    this.inited = true;

    try {
      if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          this.device = await adapter.requestDevice();
          this.initWebGPU();
          this.mode = 'webgpu';
          console.log('[HardwareBlur] Initialized with WebGPU');
          return;
        }
      }
    } catch (e) {
      console.warn('[HardwareBlur] WebGPU initialization failed, falling back to WebGL:', e);
    }

    try {
      this.initWebGL();
      if (this.gl) {
        this.mode = 'webgl';
        console.log('[HardwareBlur] Initialized with WebGL');
        return;
      }
    } catch (e) {
      console.warn('[HardwareBlur] WebGL initialization failed:', e);
    }

    this.mode = 'none';
    console.warn('[HardwareBlur] No hardware acceleration available for blur.');
  }

  private initWebGPU() {
    const device = this.device!;
    this.gpuCanvas = new OffscreenCanvas(1, 1);
    this.gpuCtx = this.gpuCanvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.gpuCtx.configure({ device, format, usage: GPUTextureUsage.RENDER_ATTACHMENT });

    const wgsl = `
      struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
      };

      @vertex
      fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
          var pos = array<vec2<f32>, 4>(
              vec2<f32>(-1.0, -1.0),
              vec2<f32>( 1.0, -1.0),
              vec2<f32>(-1.0,  1.0),
              vec2<f32>( 1.0,  1.0)
          );
          var uv = array<vec2<f32>, 4>(
              vec2<f32>(0.0, 1.0),
              vec2<f32>(1.0, 1.0),
              vec2<f32>(0.0, 0.0),
              vec2<f32>(1.0, 0.0)
          );
          var out: VertexOutput;
          out.position = vec4<f32>(pos[vi], 0.0, 1.0);
          out.uv = uv[vi];
          return out;
      }

      @group(0) @binding(0) var mySampler: sampler;
      @group(0) @binding(1) var myTexture: texture_2d<f32>;

      struct Params { radius: f32 };
      @group(0) @binding(2) var<uniform> params: Params;

      @fragment
      fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
          let SAMPLES: i32 = 24;
          let size = textureDimensions(myTexture);
          let texelSize = 1.0 / vec2<f32>(size);
          var color = vec4<f32>(0.0);
          
          for (var i = 0; i < SAMPLES; i++) {
              let f = f32(i) / f32(SAMPLES);
              let theta = 2.399963 * f32(i); 
              let r = sqrt(f) * params.radius;
              let offset = vec2<f32>(cos(theta), sin(theta)) * r * texelSize;
              color += textureSample(myTexture, mySampler, input.uv + offset);
          }
          return color / f32(SAMPLES);
      }
    `;

    const module = device.createShaderModule({ code: wgsl });

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ]
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-strip', stripIndexFormat: 'uint32' }
    });

    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });

    this.uniformBuffer = device.createBuffer({
      size: 4, // 1 f32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  private initWebGL() {
    this.glCanvas = new OffscreenCanvas(1, 1);
    this.gl = (this.glCanvas.getContext('webgl2', { depth: false, antialias: false }) || 
               this.glCanvas.getContext('webgl', { depth: false, antialias: false })) as WebGLRenderingContext;
    if (!this.gl) return;
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform float u_radius;
      uniform vec2 u_resolution;

      void main() {
        vec4 color = vec4(0.0);
        const int SAMPLES = 24;
        vec2 texelSize = 1.0 / u_resolution;
        
        for (int i = 0; i < SAMPLES; i++) {
            float f = float(i) / float(SAMPLES);
            float theta = 2.399963 * float(i);
            float r = sqrt(f) * u_radius;
            vec2 offset = vec2(cos(theta), sin(theta)) * r * texelSize;
            color += texture2D(u_image, v_texCoord + offset);
        }
        gl_FragColor = color / float(SAMPLES);
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    this.glProgram = program;

    this.glPosBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    this.glTexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glTexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);

    this.glTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.glLocRadius = gl.getUniformLocation(program, 'u_radius')!;
    this.glLocResolution = gl.getUniformLocation(program, 'u_resolution')!;
  }

  applyBlur(source: CanvasImageSource, width: number, height: number, blurRadius: number): CanvasImageSource {
    if (blurRadius <= 0) return source;

    if (this.mode === 'webgpu' && this.device && this.gpuCanvas && this.gpuCtx) {
      if (this.gpuCanvas.width !== width || this.gpuCanvas.height !== height) {
        this.gpuCanvas.width = width;
        this.gpuCanvas.height = height;
      }
      
      const device = this.device;
      
      // Upload source to WebGPU texture
      const srcTexture = device.createTexture({
        size: [width, height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      });
      
      device.queue.copyExternalImageToTexture(
        { source: source as any, flipY: true },
        { texture: srcTexture },
        [width, height]
      );

      device.queue.writeBuffer(this.uniformBuffer!, 0, new Float32Array([blurRadius]));

      const bindGroup = device.createBindGroup({
        layout: this.bindGroupLayout!,
        entries: [
          { binding: 0, resource: this.sampler! },
          { binding: 1, resource: srcTexture.createView() },
          { binding: 2, resource: { buffer: this.uniformBuffer! } },
        ]
      });

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: this.gpuCtx.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store'
        }]
      });

      passEncoder.setPipeline(this.pipeline!);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(4, 1, 0, 0);
      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);
      
      return this.gpuCanvas;
    }

    if (this.mode === 'webgl' && this.gl && this.glCanvas) {
      if (this.glCanvas.width !== width || this.glCanvas.height !== height) {
        this.glCanvas.width = width;
        this.glCanvas.height = height;
        this.gl.viewport(0, 0, width, height);
      }

      const gl = this.gl;
      gl.useProgram(this.glProgram!);

      gl.bindTexture(gl.TEXTURE_2D, this.glTexture!);
      // Use texImage2D with the CanvasImageSource
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as any);

      gl.uniform1f(this.glLocRadius!, blurRadius);
      gl.uniform2f(this.glLocResolution!, width, height);

      const posLoc = gl.getAttribLocation(this.glProgram!, 'a_position');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glPosBuffer!);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const texLoc = gl.getAttribLocation(this.glProgram!, 'a_texCoord');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glTexBuffer!);
      gl.enableVertexAttribArray(texLoc);
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      return this.glCanvas;
    }

    // Fallback: CPU OffscreenCanvas (the workaround)
    try {
      const tempCanvas = new OffscreenCanvas(width, height);
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (tempCtx) {
        tempCtx.filter = `blur(${blurRadius}px)`;
        tempCtx.drawImage(source, 0, 0, width, height);
        return tempCanvas;
      }
    } catch (e) {
      // ignore
    }
    return source;
  }
}
