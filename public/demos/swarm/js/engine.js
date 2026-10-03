// ---------------------------------------------------------------------------
// SwarmSim: WebGPU engine
//
// Owns the device, buffers, pipelines and the frame loop. The only per-frame
// CPU work is writing two small uniform buffers (336 + 64 bytes) and recording
// ~9 GPU commands. Boid data never leaves VRAM.
// ---------------------------------------------------------------------------

const Engine = (() => {

  const WG         = 256;              // workgroup size, matches the WGSL
  const TABLE_SIZE = 1 << 18;          // 262,144 hash buckets
  const BLOCKS     = TABLE_SIZE / WG;  // 1024 scan blocks
  const HDR_FORMAT = 'rgba16float';

  let device = null, ctx = null, canvasFormat = null, canvas = null;
  let capacity = 0;
  let seededTo = 0;                    // highest boid index seeded since reset

  const buf   = {};
  const pipe  = {};
  let computeBGL, computeBG, boidBGL, boidBG, postBGL;
  let accum = [], postBG = [], accumCur = 0;
  let texW = 0, texH = 0;

  // Uniform staging. Word offsets are documented in shaders.js; keep in sync.
  const PARAMS_BYTES = 336;
  const pBuf = new ArrayBuffer(PARAMS_BYTES);
  const pF   = new Float32Array(pBuf);
  const pU   = new Uint32Array(pBuf);
  const vBuf = new ArrayBuffer(64);
  const vF   = new Float32Array(vBuf);
  const vU   = new Uint32Array(vBuf);

  const stats = { fps: 0, frameMs: 0, updatesPerSec: 0 };

  // --- setup ---------------------------------------------------------------

  async function init(canvasEl) {
    if (!navigator.gpu) {
      throw new Error("This browser doesn't support WebGPU. " +
        'Try a recent Chrome, Edge, Safari or Firefox on a computer.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) throw new Error('No compatible GPU was found.');

    // Ask for the largest buffers the adapter allows, since the storage
    // buffers grow with boid capacity.
    const want = {};
    for (const k of ['maxStorageBufferBindingSize', 'maxBufferSize']) {
      if (adapter.limits[k]) want[k] = adapter.limits[k];
    }
    device = await adapter.requestDevice({ requiredLimits: want });

    device.lost.then((info) => {
      if (info.reason !== 'destroyed') {
        Engine.onError?.(`GPU device lost: ${info.message || info.reason}`);
      }
    });
    device.addEventListener?.('uncapturederror', (e) => {
      console.error('[SwarmSim] uncaptured GPU error:', e.error);
    });

    canvas = canvasEl;
    ctx = canvas.getContext('webgpu');
    canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format: canvasFormat, alphaMode: 'opaque' });

    await buildPipelines();

    const info = adapter.info || {};
    return {
      adapter: [info.vendor, info.architecture, info.description]
        .filter(Boolean).join(' ') || 'GPU',
    };
  }

  async function buildPipelines() {
    const compMod = device.createShaderModule({ code: SHADERS.compute, label: 'compute' });
    const boidMod = device.createShaderModule({ code: SHADERS.boid,    label: 'boid' });
    const postMod = device.createShaderModule({ code: SHADERS.post,    label: 'post' });
    await Promise.all([compMod, boidMod, postMod].map(checkShader));

    // One layout shared by every compute kernel. Kernels declare only the
    // bindings they use; an explicit layout may be a superset.
    const storage = { buffer: { type: 'storage' } };
    computeBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((binding) => ({
          binding, visibility: GPUShaderStage.COMPUTE, ...storage,
        })),
      ],
    });
    const compLayout = device.createPipelineLayout({ bindGroupLayouts: [computeBGL] });

    for (const entryPoint of
      ['init', 'clearCells', 'countCells', 'scanBlocks',
       'scanSums', 'scanAdd', 'scatter', 'flock']) {
      pipe[entryPoint] = device.createComputePipeline({
        label: entryPoint,
        layout: compLayout,
        compute: { module: compMod, entryPoint },
      });
    }

    boidBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    postBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    // Additive blending: overlapping boids sum, so density becomes brightness.
    pipe.boid = device.createRenderPipeline({
      label: 'boid',
      layout: device.createPipelineLayout({ bindGroupLayouts: [boidBGL] }),
      vertex:   { module: boidMod, entryPoint: 'vsBoid' },
      fragment: {
        module: boidMod, entryPoint: 'fsBoid',
        targets: [{
          format: HDR_FORMAT,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    const postLayout = device.createPipelineLayout({ bindGroupLayouts: [postBGL] });
    pipe.fade = device.createRenderPipeline({
      label: 'fade',
      layout: postLayout,
      vertex:   { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: 'fsFade', targets: [{ format: HDR_FORMAT }] },
      primitive: { topology: 'triangle-list' },
    });
    pipe.tone = device.createRenderPipeline({
      label: 'tone',
      layout: postLayout,
      vertex:   { module: postMod, entryPoint: 'vsFull' },
      fragment: { module: postMod, entryPoint: 'fsTone', targets: [{ format: canvasFormat }] },
      primitive: { topology: 'triangle-list' },
    });

    buf.params = device.createBuffer({
      size: PARAMS_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    buf.view = device.createBuffer({
      size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async function checkShader(mod) {
    const info = await mod.getCompilationInfo();
    const errs = info.messages.filter((m) => m.type === 'error');
    if (errs.length) {
      const text = errs.map((m) => `  line ${m.lineNum}: ${m.message}`).join('\n');
      throw new Error(`Shader "${mod.label}" failed to compile:\n${text}`);
    }
  }

  // --- allocation ----------------------------------------------------------

  function allocate(newCapacity) {
    capacity = newCapacity;
    seededTo = 0;

    for (const k of ['pos', 'vel', 'sortedPos', 'sortedVel',
                     'cellCount', 'cellStart', 'blockSums', 'cellCursor']) {
      buf[k]?.destroy();
    }

    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const vec2 = capacity * 8;
    buf.pos        = device.createBuffer({ size: vec2, usage: S, label: 'pos' });
    buf.vel        = device.createBuffer({ size: vec2, usage: S, label: 'vel' });
    buf.sortedPos  = device.createBuffer({ size: vec2, usage: S, label: 'sortedPos' });
    buf.sortedVel  = device.createBuffer({ size: vec2, usage: S, label: 'sortedVel' });
    buf.cellCount  = device.createBuffer({ size: TABLE_SIZE * 4, usage: S });
    buf.cellStart  = device.createBuffer({ size: TABLE_SIZE * 4, usage: S });
    buf.cellCursor = device.createBuffer({ size: TABLE_SIZE * 4, usage: S });
    buf.blockSums  = device.createBuffer({ size: BLOCKS * 4, usage: S });

    computeBG = device.createBindGroup({
      layout: computeBGL,
      entries: [
        { binding: 0, resource: { buffer: buf.params } },
        { binding: 1, resource: { buffer: buf.pos } },
        { binding: 2, resource: { buffer: buf.vel } },
        { binding: 3, resource: { buffer: buf.sortedPos } },
        { binding: 4, resource: { buffer: buf.sortedVel } },
        { binding: 5, resource: { buffer: buf.cellCount } },
        { binding: 6, resource: { buffer: buf.cellStart } },
        { binding: 7, resource: { buffer: buf.blockSums } },
        { binding: 8, resource: { buffer: buf.cellCursor } },
      ],
    });

    boidBG = device.createBindGroup({
      layout: boidBGL,
      entries: [
        { binding: 0, resource: { buffer: buf.view } },
        { binding: 1, resource: { buffer: buf.pos } },
        { binding: 2, resource: { buffer: buf.vel } },
      ],
    });
  }

  function resize(w, h) {
    if (w === texW && h === texH) return;
    texW = w; texH = h;
    for (const t of accum) t.destroy();
    accum = [0, 1].map(() => device.createTexture({
      size: [w, h],
      format: HDR_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }));
    postBG = accum.map((t) => device.createBindGroup({
      layout: postBGL,
      entries: [
        { binding: 0, resource: { buffer: buf.view } },
        { binding: 1, resource: t.createView() },
      ],
    }));
  }

  // --- uniform packing -----------------------------------------------------

  function writeParams(P, dt, spawnStart, spawnEnd, seed, field) {
    // Cells must be at least as wide as the perception radius so that the 3x3
    // neighbourhood covers everything a boid can see.
    const cellSize = Math.max(P.percepRadius, P.sepRadius, 0.5);

    pU[0]  = P.count;
    pU[1]  = TABLE_SIZE;
    pU[2]  = Math.max(1, P.maxPerCell | 0);
    pU[3]  = 0;
    pF[4]  = cellSize;
    pF[5]  = P.percepRadius;
    pF[6]  = P.sepRadius;
    pF[7]  = P.sepWeight;
    pF[8]  = P.aliWeight;
    pF[9]  = P.cohWeight;
    pF[10] = P.maxSpeed;
    pF[11] = P.maxForce;
    pF[12] = P.gStrength;
    pF[13] = P.gExponent;
    pF[14] = P.gRefScale;
    pF[15] = P.swirl;
    pF[16] = P.drag;
    pF[17] = dt;
    pF[18] = P.mouseStrength;
    pF[19] = P.mouseRadius;
    pF[20] = P.centerX;
    pF[21] = P.centerY;
    pF[22] = P.mouseX;
    pF[23] = P.mouseY;
    pU[24] = seed >>> 0;
    pU[25] = spawnStart >>> 0;
    pU[26] = spawnEnd >>> 0;
    pF[27] = P.spawnRadius;
    pU[28] = field ? field.lureCount : 0;
    pU[29] = field ? field.hawkCount : 0;
    pF[30] = P.minSpeed;
    pF[31] = P.lurePull;
    pF[32] = P.lureInner;
    pF[33] = Math.max(P.lureOuter, P.lureInner + 1);
    pF[34] = P.hawkFear;
    pF[35] = P.hawkRadius;
    if (field) {
      pF.set(field.lures, 36);   // 8 x vec4f
      pF.set(field.hawks, 68);   // 4 x vec4f
    }

    device.queue.writeBuffer(buf.params, 0, pBuf);
  }

  function writeView(P, cam) {
    vF[0]  = cam.x;
    vF[1]  = cam.y;
    vF[2]  = cam.worldPerPixel;
    vF[3]  = P.boidPx;
    vF[4]  = texW;
    vF[5]  = texH;
    vF[6]  = P.intensity;
    vF[7]  = P.maxSpeed;
    vU[8]  = P.colorMode | 0;
    vF[9]  = P.stretch;
    vF[10] = P.exposure;
    vF[11] = P.fade;
    vF[12] = P.minSpeed;
    device.queue.writeBuffer(buf.view, 0, vBuf);
  }

  // --- seeding -------------------------------------------------------------

  function seedRange(P, start, end, seed) {
    if (end <= start) return;
    writeParams(P, 0, start, end, seed);
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe.init);
    pass.setBindGroup(0, computeBG);
    pass.dispatchWorkgroups(Math.ceil((end - start) / WG));
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  function reset(P) {
    seededTo = 0;
    ensureSeeded(P);
  }

  // Raising the count slider only seeds the newly exposed indices, so the
  // existing flock keeps flying undisturbed while new boids fade in.
  function ensureSeeded(P) {
    if (P.count > seededTo) {
      seedRange(P, seededTo, P.count, (Math.random() * 0xffffffff) >>> 0);
      seededTo = P.count;
    }
  }

  // --- frame ---------------------------------------------------------------

  function frame(P, cam, opts) {
    const { paused, dt, substeps, field } = opts;
    ensureSeeded(P);

    const enc = device.createCommandEncoder();

    if (!paused && P.count > 0) {
      const groups     = Math.ceil(P.count / WG);
      const tableGroup = TABLE_SIZE / WG;

      writeParams(P, dt, 0, 0, 0, field);

      for (let s = 0; s < substeps; s++) {
        // WebGPU orders dispatches within a pass and inserts the memory
        // barriers between them, so the whole sort + step is one pass.
        const pass = enc.beginComputePass();
        pass.setBindGroup(0, computeBG);

        pass.setPipeline(pipe.clearCells); pass.dispatchWorkgroups(tableGroup);
        pass.setPipeline(pipe.countCells); pass.dispatchWorkgroups(groups);
        pass.setPipeline(pipe.scanBlocks); pass.dispatchWorkgroups(BLOCKS);
        pass.setPipeline(pipe.scanSums);   pass.dispatchWorkgroups(1);
        pass.setPipeline(pipe.scanAdd);    pass.dispatchWorkgroups(tableGroup);
        pass.setPipeline(pipe.scatter);    pass.dispatchWorkgroups(groups);
        pass.setPipeline(pipe.flock);      pass.dispatchWorkgroups(groups);

        pass.end();
      }
    }

    writeView(P, cam);

    // Pass 1: previous frame (dimmed) + this frame's boids, into HDR.
    const dst = accumCur;
    const src = 1 - accumCur;
    const hdr = enc.beginRenderPass({
      colorAttachments: [{
        view: accum[dst].createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    if (P.fade > 0.001) {
      hdr.setPipeline(pipe.fade);
      hdr.setBindGroup(0, postBG[src]);
      hdr.draw(3);
    }
    if (P.count > 0) {
      hdr.setPipeline(pipe.boid);
      hdr.setBindGroup(0, boidBG);
      hdr.draw(3, P.count);
    }
    hdr.end();

    // Pass 2: tonemap to the swap chain.
    const out = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    out.setPipeline(pipe.tone);
    out.setBindGroup(0, postBG[dst]);
    out.draw(3);
    out.end();

    device.queue.submit([enc.finish()]);
    accumCur = src;
  }

  return {
    init, allocate, resize, frame, reset,
    stats,
    get capacity() { return capacity; },
    get device()   { return device; },
    TABLE_SIZE,
    onError: null,
  };
})();
