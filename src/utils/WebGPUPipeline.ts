/**
 * WebGPU High-Performance Shader Pipeline
 * Executes hardware-accelerated Color-space conversion (YUV -> sRGB, RGBA) and real-time effects
 * using custom WGSL (WebGPU Shading Language) shaders with Canvas 2D fallback.
 */

import { WEngineLogger } from './WEngineDevTools';

export interface VideoShaderParams {
  brightness: number; // 0.0 - 2.0 (default: 1.0)
  contrast: number;   // 0.0 - 2.0 (default: 1.0)
  filterType: number; // 0: None, 1: Grayscale, 2: Sepia, 3: Negative, 4: Vignette
  rotation: number;   // 0, 90, 180, 270 degrees
  flipH: number;      // 0 or 1
  flipV: number;      // 0 or 1
}

export class WebGPUPipeline {
  private canvas: HTMLCanvasElement;
  private adapter: any = null;
  private device: any = null;
  private context: any = null;
  private pipeline: any = null;
  private sampler: any = null;
  private uniformBuffer: any = null;
  private bindGroupLayout: any = null;
  private isSupported = false;

  // Fallback 2D context
  private ctx2d: CanvasRenderingContext2D | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async init(): Promise<boolean> {
    WEngineLogger.log('WebGPU', 'info', 'Initializing WebGPU Shader Pipeline on Canvas element...');
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
      try {
        this.adapter = await (navigator as any).gpu.requestAdapter({
          powerPreference: 'high-performance',
        });

        if (this.adapter) {
          let adapterInfo: any = {};
          try {
            if (this.adapter.requestAdapterInfo) {
              adapterInfo = await this.adapter.requestAdapterInfo();
            } else if (this.adapter.info) {
              adapterInfo = this.adapter.info;
            }
          } catch {}

          this.device = await this.adapter.requestDevice();
          
          // Listen for uncaptured device errors
          if (this.device && this.device.addEventListener) {
            this.device.addEventListener('uncapturederror', (event: any) => {
              WEngineLogger.reportWebGPUError(event.error || 'Uncaptured GPU Error');
            });
          }

          this.context = this.canvas.getContext('webgpu') as any;
          if (this.context && this.device) {
            const format = (navigator as any).gpu.getPreferredCanvasFormat();
            this.context.configure({
              device: this.device,
              format,
              alphaMode: 'opaque',
            });

            this.createPipeline(format);
            this.isSupported = true;

            WEngineLogger.updateWebGPUStatus(true, 'active', adapterInfo, this.device.limits);
            WEngineLogger.log('WebGPU', 'info', 'WebGPU Pipeline successfully initialized and configured.', {
              format,
              vendor: adapterInfo.vendor,
              architecture: adapterInfo.architecture,
              device: adapterInfo.device,
            });
            return true;
          }
        }
      } catch (err) {
        WEngineLogger.reportWebGPUError(err);
        WEngineLogger.log('WebGPU', 'warn', 'WebGPU Init failed, switching to 2D canvas fallback.', err);
      }
    } else {
      WEngineLogger.log('WebGPU', 'warn', 'navigator.gpu not detected in this browser environment. Using 2D canvas fallback.');
    }

    this.ctx2d = this.canvas.getContext('2d');
    this.isSupported = false;
    WEngineLogger.updateWebGPUStatus(false, 'fallback_2d');
    return false;
  }

  private createPipeline(format: string) {
    if (!this.device) return;

    try {
      const wgslShader = `
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        };

        struct UniformParams {
          brightness: f32,
          contrast: f32,
          filterType: f32,
          rotation: f32,
          flipH: f32,
          flipV: f32,
          pad0: f32,
          pad1: f32,
        };

        @group(0) @binding(0) var<uniform> u_params: UniformParams;
        @group(0) @binding(1) var u_sampler: sampler;
        @group(0) @binding(2) var u_texture: texture_2d<f32>;

        @vertex
        fn vs_main(@builtin(vertex_index) v_idx: u32) -> VertexOutput {
          var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>( 1.0,  1.0)
          );

          var uvs = array<vec2<f32>, 6>(
            vec2<f32>(0.0, 1.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(0.0, 0.0),
            vec2<f32>(1.0, 1.0),
            vec2<f32>(1.0, 0.0)
          );

          var out: VertexOutput;
          out.position = vec4<f32>(pos[v_idx], 0.0, 1.0);
          var uv = uvs[v_idx];

          if (u_params.flipH > 0.5) {
            uv.x = 1.0 - uv.x;
          }
          if (u_params.flipV > 0.5) {
            uv.y = 1.0 - uv.y;
          }

          out.uv = uv;
          return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
          var sampleColor = textureSample(u_texture, u_sampler, in.uv);
          var rgb = sampleColor.rgb;

          // Apply Brightness & Contrast
          rgb = (rgb - vec3<f32>(0.5)) * u_params.contrast + vec3<f32>(0.5);
          rgb = rgb * u_params.brightness;

          // Filters
          if (u_params.filterType == 1.0) {
            // Grayscale
            let gray = dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
            rgb = vec3<f32>(gray);
          } else if (u_params.filterType == 2.0) {
            // Sepia
            let r = dot(rgb, vec3<f32>(0.393, 0.769, 0.189));
            let g = dot(rgb, vec3<f32>(0.349, 0.686, 0.168));
            let b = dot(rgb, vec3<f32>(0.272, 0.534, 0.131));
            rgb = vec3<f32>(r, g, b);
          } else if (u_params.filterType == 3.0) {
            // Invert / Negative
            rgb = vec3<f32>(1.0) - rgb;
          } else if (u_params.filterType == 4.0) {
            // Vignette
            let dist = distance(in.uv, vec2<f32>(0.5, 0.5));
            let vig = smoothstep(0.8, 0.2, dist * 1.2);
            rgb = rgb * vig;
          }

          return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
        }
      `;

      const shaderModule = this.device.createShaderModule({ code: wgslShader });

      // GPUShaderStage: VERTEX = 1, FRAGMENT = 2
      this.bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: 1 | 2,
            buffer: { type: 'uniform' },
          },
          {
            binding: 1,
            visibility: 2,
            sampler: { type: 'filtering' },
          },
          {
            binding: 2,
            visibility: 2,
            texture: { sampleType: 'float' },
          },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      });

      this.pipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });

      // 8 floats = 32 bytes
      this.uniformBuffer = this.device.createBuffer({
        size: 32,
        usage: 64 | 8, // UNIFORM | COPY_DST
      });

      WEngineLogger.log('WebGPU', 'info', 'WGSL Shader module and Render Pipeline compiled.');
    } catch (err) {
      WEngineLogger.reportWebGPUError(err);
    }
  }

  /**
   * Render RGBA pixel buffer directly to WebGPU Canvas
   */
  public renderRGBA(
    rgbaData: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    params: VideoShaderParams
  ) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.isSupported && this.device && this.context && this.pipeline) {
      try {
        const texture = this.device.createTexture({
          size: [width, height, 1],
          format: 'rgba8unorm',
          usage: 4 | 2 | 16, // TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT
        });

        this.device.queue.writeTexture(
          { texture },
          rgbaData,
          { bytesPerRow: width * 4, rowsPerImage: height },
          [width, height, 1]
        );

        const uniformArray = new Float32Array([
          params.brightness,
          params.contrast,
          params.filterType,
          params.rotation,
          params.flipH,
          params.flipV,
          0.0,
          0.0,
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

        const bindGroup = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: texture.createView() },
          ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6, 1, 0, 0);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        texture.destroy();
        return;
      } catch (e) {
        WEngineLogger.reportWebGPUError(e);
      }
    }

    // 2D Fallback
    if (!this.ctx2d) {
      this.ctx2d = this.canvas.getContext('2d');
    }
    if (this.ctx2d) {
      try {
        const imgData = this.ctx2d.createImageData(width, height);
        imgData.data.set(rgbaData);
        this.ctx2d.putImageData(imgData, 0, 0);
      } catch (err) {
        WEngineLogger.log('WebGPU', 'error', 'Canvas 2D putImageData error', err);
      }
    }
  }

  /**
   * Render directly from HTMLVideoElement, ImageBitmap, or HTMLCanvasElement
   */
  public renderSource(
    source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement,
    params: VideoShaderParams
  ) {
    let width = 1280;
    let height = 720;

    if (source instanceof HTMLVideoElement) {
      width = source.videoWidth || 1280;
      height = source.videoHeight || 720;
      if (source.readyState < 2) return; // HAVE_CURRENT_DATA or higher
    } else {
      width = source.width || this.canvas.width || 1280;
      height = source.height || this.canvas.height || 720;
    }

    if (width <= 0 || height <= 0) return;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.isSupported && this.device && this.context && this.pipeline) {
      try {
        const texture = this.device.createTexture({
          size: [width, height, 1],
          format: 'rgba8unorm',
          usage: 4 | 2 | 16, // TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT
        });

        this.device.queue.copyExternalImageToTexture(
          { source },
          { texture },
          [width, height]
        );

        const uniformArray = new Float32Array([
          params.brightness,
          params.contrast,
          params.filterType,
          params.rotation,
          params.flipH,
          params.flipV,
          0.0,
          0.0,
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

        const bindGroup = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: texture.createView() },
          ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(6, 1, 0, 0);
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        texture.destroy();
        return;
      } catch (e) {
        WEngineLogger.reportWebGPUError(e);
      }
    }

    // 2D Canvas Fallback
    if (!this.ctx2d) {
      this.ctx2d = this.canvas.getContext('2d');
    }
    if (this.ctx2d) {
      try {
        this.ctx2d.save();
        this.ctx2d.clearRect(0, 0, width, height);

        // Apply 2D Transformations
        this.ctx2d.translate(width / 2, height / 2);
        if (params.rotation !== 0) {
          this.ctx2d.rotate((params.rotation * Math.PI) / 180);
        }
        this.ctx2d.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);

        let filterString = `brightness(${params.brightness}) contrast(${params.contrast})`;
        if (params.filterType === 1) filterString += ' grayscale(100%)';
        else if (params.filterType === 2) filterString += ' sepia(100%)';
        else if (params.filterType === 3) filterString += ' invert(100%)';

        this.ctx2d.filter = filterString;
        this.ctx2d.drawImage(source, -width / 2, -height / 2, width, height);
        this.ctx2d.restore();
      } catch (err) {
        WEngineLogger.log('WebGPU', 'error', 'Canvas 2D drawImage fallback error', err);
      }
    }
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public destroy() {
    WEngineLogger.log('WebGPU', 'info', 'Destroying WebGPU Pipeline resources.');
    if (this.uniformBuffer) {
      try { this.uniformBuffer.destroy(); } catch {}
    }
    if (this.device) {
      try { this.device.destroy(); } catch {}
    }
  }
}
