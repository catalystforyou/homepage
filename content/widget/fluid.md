---
title: "Fluid"
date: 2026-05-19
draft: false
---

<p>
Drag your mouse (or finger) across the canvas below. You're stirring a real-time 2D Navier–Stokes solver that runs entirely on your GPU — no server, no library, just a few hundred lines of GLSL.
</p>

<div id="fluid-app">
  <canvas id="fluid-canvas"></canvas>
  <div id="fluid-error" class="fluid-error" style="display:none;"></div>
  <div class="fluid-controls">
    <button id="fluid-clear" type="button">Clear</button>
    <label class="fluid-toggle">
      <input id="fluid-auto" type="checkbox" checked>
      <span>auto-stir when idle</span>
    </label>
    <span class="fluid-hint" id="fluid-info"></span>
  </div>
</div>

<style>
#fluid-app { margin-top: 1.5em; max-width: 900px; }
#fluid-canvas {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: #000;
  border-radius: 6px;
  touch-action: none;
  cursor: crosshair;
}
.fluid-controls {
  display: flex;
  gap: 1em;
  align-items: center;
  margin-top: 0.6em;
  flex-wrap: wrap;
}
.fluid-controls button {
  padding: 0.4em 0.9em;
  background: var(--primary, #1a1a1a);
  color: var(--theme, #fff);
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9em;
}
.fluid-toggle {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.9em;
  color: var(--secondary, #666);
  cursor: pointer;
}
.fluid-hint {
  font-size: 0.8em;
  color: var(--secondary, #999);
  margin-left: auto;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
}
.fluid-error {
  margin-top: 0.8em;
  padding: 0.8em 1em;
  border-radius: 4px;
  background: #ffebee;
  color: #b71c1c;
  font-size: 0.9em;
}
@media (prefers-color-scheme: dark) {
  .fluid-error { background: #4a1f23; color: #f3b0b5; }
}
</style>

<script>
(function () {
  const canvas = document.getElementById("fluid-canvas");
  const errEl = document.getElementById("fluid-error");
  const infoEl = document.getElementById("fluid-info");
  const autoEl = document.getElementById("fluid-auto");

  function fail(msg) {
    errEl.style.display = "block";
    errEl.textContent = msg;
  }

  const gl = canvas.getContext("webgl2", { alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, antialias: false });
  if (!gl) { fail("Your browser doesn't support WebGL2."); return; }
  if (!gl.getExtension("EXT_color_buffer_float")) { fail("Your GPU/driver doesn't support float-buffer rendering (EXT_color_buffer_float)."); return; }
  gl.getExtension("OES_texture_float_linear"); // optional: nicer filtering

  // ── Config ───────────────────────────────────────────────
  const SIM_RES = 256;        // velocity / pressure grid (square-ish, scaled to aspect)
  const DYE_RES = 1024;       // color buffer (visual quality)
  const PRESSURE_ITERS = 24;
  const VELOCITY_DISSIPATION = 0.2;   // per second
  const DYE_DISSIPATION = 1.0;        // per second
  const SPLAT_RADIUS = 0.0025;        // ~radius² in normalized space
  const SPLAT_FORCE = 6000;
  const CURL = 30;            // vorticity confinement strength
  const FRAME_DT_CAP = 0.016667;

  // ── Shaders ──────────────────────────────────────────────
  const VS = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    out vec2 v_L; out vec2 v_R; out vec2 v_T; out vec2 v_B;
    uniform vec2 u_texelSize;
    void main () {
      v_uv = a_pos * 0.5 + 0.5;
      v_L = v_uv - vec2(u_texelSize.x, 0.0);
      v_R = v_uv + vec2(u_texelSize.x, 0.0);
      v_T = v_uv + vec2(0.0, u_texelSize.y);
      v_B = v_uv - vec2(0.0, u_texelSize.y);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  const FS_HEAD = `#version 300 es
    precision highp float; precision highp sampler2D;
    in vec2 v_uv;
    in vec2 v_L; in vec2 v_R; in vec2 v_T; in vec2 v_B;
    out vec4 fragColor;
  `;

  const FS_CLEAR = FS_HEAD + `
    uniform sampler2D u_tex;
    uniform float u_value;
    void main () { fragColor = u_value * texture(u_tex, v_uv); }`;

  const FS_SPLAT = FS_HEAD + `
    uniform sampler2D u_target;
    uniform float u_aspectRatio;
    uniform vec3 u_color;
    uniform vec2 u_point;
    uniform float u_radius;
    void main () {
      vec2 p = v_uv - u_point;
      p.x *= u_aspectRatio;
      vec3 splat = exp(-dot(p, p) / u_radius) * u_color;
      vec3 base = texture(u_target, v_uv).xyz;
      fragColor = vec4(base + splat, 1.0);
    }`;

  const FS_ADVECTION = FS_HEAD + `
    uniform sampler2D u_velocity;
    uniform sampler2D u_source;
    uniform vec2 u_texelSize;
    uniform float u_dt;
    uniform float u_dissipation;
    void main () {
      vec2 coord = v_uv - u_dt * texture(u_velocity, v_uv).xy * u_texelSize;
      vec4 result = texture(u_source, coord);
      float decay = 1.0 + u_dissipation * u_dt;
      fragColor = result / decay;
    }`;

  const FS_DIVERGENCE = FS_HEAD + `
    uniform sampler2D u_velocity;
    void main () {
      float L = texture(u_velocity, v_L).x;
      float R = texture(u_velocity, v_R).x;
      float T = texture(u_velocity, v_T).y;
      float B = texture(u_velocity, v_B).y;
      vec2 C = texture(u_velocity, v_uv).xy;
      if (v_L.x < 0.0) L = -C.x;
      if (v_R.x > 1.0) R = -C.x;
      if (v_T.y > 1.0) T = -C.y;
      if (v_B.y < 0.0) B = -C.y;
      float div = 0.5 * (R - L + T - B);
      fragColor = vec4(div, 0.0, 0.0, 1.0);
    }`;

  const FS_CURL = FS_HEAD + `
    uniform sampler2D u_velocity;
    void main () {
      float L = texture(u_velocity, v_L).y;
      float R = texture(u_velocity, v_R).y;
      float T = texture(u_velocity, v_T).x;
      float B = texture(u_velocity, v_B).x;
      float vorticity = R - L - T + B;
      fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }`;

  const FS_VORTICITY = FS_HEAD + `
    uniform sampler2D u_velocity;
    uniform sampler2D u_curl;
    uniform float u_curlStrength;
    uniform float u_dt;
    void main () {
      float L = texture(u_curl, v_L).x;
      float R = texture(u_curl, v_R).x;
      float T = texture(u_curl, v_T).x;
      float B = texture(u_curl, v_B).x;
      float C = texture(u_curl, v_uv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= u_curlStrength * C;
      force.y *= -1.0;
      vec2 vel = texture(u_velocity, v_uv).xy;
      vel += force * u_dt;
      vel = clamp(vel, vec2(-1000.0), vec2(1000.0));
      fragColor = vec4(vel, 0.0, 1.0);
    }`;

  const FS_PRESSURE = FS_HEAD + `
    uniform sampler2D u_pressure;
    uniform sampler2D u_divergence;
    void main () {
      float L = texture(u_pressure, v_L).x;
      float R = texture(u_pressure, v_R).x;
      float T = texture(u_pressure, v_T).x;
      float B = texture(u_pressure, v_B).x;
      float div = texture(u_divergence, v_uv).x;
      float p = (L + R + B + T - div) * 0.25;
      fragColor = vec4(p, 0.0, 0.0, 1.0);
    }`;

  const FS_GRADIENT_SUB = FS_HEAD + `
    uniform sampler2D u_pressure;
    uniform sampler2D u_velocity;
    void main () {
      float L = texture(u_pressure, v_L).x;
      float R = texture(u_pressure, v_R).x;
      float T = texture(u_pressure, v_T).x;
      float B = texture(u_pressure, v_B).x;
      vec2 vel = texture(u_velocity, v_uv).xy;
      vel -= 0.5 * vec2(R - L, T - B);
      fragColor = vec4(vel, 0.0, 1.0);
    }`;

  const FS_DISPLAY = FS_HEAD + `
    uniform sampler2D u_dye;
    void main () {
      vec3 c = texture(u_dye, v_uv).rgb;
      // gentle tone mapping so very bright dye doesn't clip ugly
      c = c / (1.0 + c);
      fragColor = vec4(c, 1.0);
    }`;

  // ── GL helpers ───────────────────────────────────────────
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Shader compile error: " + log);
    }
    return s;
  }
  function makeProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(p));
    }
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      uniforms[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { program: p, uniforms };
  }

  let progs;
  try {
    progs = {
      clear:        makeProgram(VS, FS_CLEAR),
      splat:        makeProgram(VS, FS_SPLAT),
      advection:    makeProgram(VS, FS_ADVECTION),
      divergence:   makeProgram(VS, FS_DIVERGENCE),
      curl:         makeProgram(VS, FS_CURL),
      vorticity:    makeProgram(VS, FS_VORTICITY),
      pressure:     makeProgram(VS, FS_PRESSURE),
      gradientSub:  makeProgram(VS, FS_GRADIENT_SUB),
      display:      makeProgram(VS, FS_DISPLAY),
    };
  } catch (e) {
    fail("Shader setup failed: " + e.message);
    return;
  }

  // Fullscreen quad
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1,
  ]), gl.STATIC_DRAW);
  function bindQuad(program) {
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  function createFBO(w, h, internalFmt, fmt, type, filter) {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h, texelSize: [1 / w, 1 / h] };
  }
  function createDoubleFBO(w, h, internalFmt, fmt, type, filter) {
    let a = createFBO(w, h, internalFmt, fmt, type, filter);
    let b = createFBO(w, h, internalFmt, fmt, type, filter);
    return {
      get read() { return a; },
      get write() { return b; },
      get w() { return w; },
      get h() { return h; },
      get texelSize() { return a.texelSize; },
      swap() { const t = a; a = b; b = t; },
    };
  }

  // Determine sim/dye sizes that respect canvas aspect ratio
  function computeRes(target) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    let w, h;
    if (aspect >= 1) { w = Math.round(target * aspect); h = target; }
    else { w = target; h = Math.round(target / aspect); }
    return { w, h };
  }

  let dye, velocity, pressure, divergence, curl;
  function initBuffers() {
    const sR = computeRes(SIM_RES);
    const dR = computeRes(DYE_RES);
    const linear  = (gl.getExtension("OES_texture_float_linear")) ? gl.LINEAR : gl.NEAREST;
    velocity   = createDoubleFBO(sR.w, sR.h, gl.RG16F,   gl.RG,  gl.HALF_FLOAT, linear);
    dye        = createDoubleFBO(dR.w, dR.h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, linear);
    pressure   = createDoubleFBO(sR.w, sR.h, gl.R16F,    gl.RED, gl.HALF_FLOAT, gl.NEAREST);
    divergence = createFBO(sR.w, sR.h, gl.R16F,    gl.RED, gl.HALF_FLOAT, gl.NEAREST);
    curl       = createFBO(sR.w, sR.h, gl.R16F,    gl.RED, gl.HALF_FLOAT, gl.NEAREST);
  }

  function blit(target) {
    if (target == null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Canvas sizing ────────────────────────────────────────
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      initBuffers();
    }
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ── Splats ───────────────────────────────────────────────
  function splat(x, y, dx, dy, color) {
    const aspect = canvas.width / canvas.height;
    // velocity splat
    gl.useProgram(progs.splat.program);
    bindQuad(progs.splat.program);
    gl.uniform2f(progs.splat.uniforms.u_texelSize, velocity.texelSize[0], velocity.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.splat.uniforms.u_target, 0);
    gl.uniform1f(progs.splat.uniforms.u_aspectRatio, aspect);
    gl.uniform2f(progs.splat.uniforms.u_point, x, y);
    gl.uniform3f(progs.splat.uniforms.u_color, dx, dy, 0);
    gl.uniform1f(progs.splat.uniforms.u_radius, SPLAT_RADIUS);
    blit(velocity.write);
    velocity.swap();
    // dye splat
    gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
    gl.uniform2f(progs.splat.uniforms.u_texelSize, dye.texelSize[0], dye.texelSize[1]);
    gl.uniform3f(progs.splat.uniforms.u_color, color[0], color[1], color[2]);
    blit(dye.write);
    dye.swap();
  }

  function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p];
      case 1: return [q, v, p];
      case 2: return [p, v, t];
      case 3: return [p, q, v];
      case 4: return [t, p, v];
      case 5: return [v, p, q];
    }
    return [v, v, v];
  }
  let hueCounter = Math.random();
  function nextColor() {
    hueCounter = (hueCounter + 0.06) % 1;
    return hsvToRgb(hueCounter, 0.85, 1.0).map((c) => c * 0.18);
  }

  // ── Input ────────────────────────────────────────────────
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, down: false, moved: false, color: nextColor() };
  // Negative so auto-stir kicks in immediately on first load; bumps forward once user interacts.
  let lastUserInputMs = -1e9;
  const AUTO_STIR_COOLDOWN_MS = 4000;

  function pointerToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    return { x, y };
  }
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = pointerToCanvas(e);
    pointer.down = true;
    pointer.moved = false;
    pointer.x = p.x; pointer.y = p.y; pointer.dx = 0; pointer.dy = 0;
    pointer.color = nextColor();
    lastUserInputMs = performance.now();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointer.down) return;
    const p = pointerToCanvas(e);
    pointer.dx = (p.x - pointer.x) * SPLAT_FORCE;
    pointer.dy = (p.y - pointer.y) * SPLAT_FORCE;
    pointer.x = p.x; pointer.y = p.y;
    pointer.moved = true;
    lastUserInputMs = performance.now();
  });
  canvas.addEventListener("pointerup", (e) => {
    pointer.down = false;
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointercancel", () => { pointer.down = false; });

  document.getElementById("fluid-clear").addEventListener("click", () => {
    // Fill dye + velocity with zeros by binding their FBOs and clearing.
    [velocity.read, velocity.write, dye.read, dye.write, pressure.read, pressure.write, divergence, curl].forEach((b) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
  });

  // ── Main step ────────────────────────────────────────────
  function step(dt) {
    gl.disable(gl.BLEND);

    // 1. Curl
    gl.useProgram(progs.curl.program); bindQuad(progs.curl.program);
    gl.uniform2f(progs.curl.uniforms.u_texelSize, velocity.texelSize[0], velocity.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.curl.uniforms.u_velocity, 0);
    blit(curl);

    // 2. Vorticity confinement
    gl.useProgram(progs.vorticity.program); bindQuad(progs.vorticity.program);
    gl.uniform2f(progs.vorticity.uniforms.u_texelSize, velocity.texelSize[0], velocity.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.vorticity.uniforms.u_velocity, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, curl.tex);
    gl.uniform1i(progs.vorticity.uniforms.u_curl, 1);
    gl.uniform1f(progs.vorticity.uniforms.u_curlStrength, CURL);
    gl.uniform1f(progs.vorticity.uniforms.u_dt, dt);
    blit(velocity.write); velocity.swap();

    // 3. Divergence
    gl.useProgram(progs.divergence.program); bindQuad(progs.divergence.program);
    gl.uniform2f(progs.divergence.uniforms.u_texelSize, velocity.texelSize[0], velocity.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.divergence.uniforms.u_velocity, 0);
    blit(divergence);

    // 4. Clear pressure (decay by 0.8 for stability/look)
    gl.useProgram(progs.clear.program); bindQuad(progs.clear.program);
    gl.uniform2f(progs.clear.uniforms.u_texelSize, pressure.texelSize[0], pressure.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
    gl.uniform1i(progs.clear.uniforms.u_tex, 0);
    gl.uniform1f(progs.clear.uniforms.u_value, 0.8);
    blit(pressure.write); pressure.swap();

    // 5. Pressure solve (Jacobi iterations)
    gl.useProgram(progs.pressure.program); bindQuad(progs.pressure.program);
    gl.uniform2f(progs.pressure.uniforms.u_texelSize, pressure.texelSize[0], pressure.texelSize[1]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, divergence.tex);
    gl.uniform1i(progs.pressure.uniforms.u_divergence, 1);
    for (let i = 0; i < PRESSURE_ITERS; i++) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
      gl.uniform1i(progs.pressure.uniforms.u_pressure, 0);
      blit(pressure.write); pressure.swap();
    }

    // 6. Subtract pressure gradient
    gl.useProgram(progs.gradientSub.program); bindQuad(progs.gradientSub.program);
    gl.uniform2f(progs.gradientSub.uniforms.u_texelSize, velocity.texelSize[0], velocity.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
    gl.uniform1i(progs.gradientSub.uniforms.u_pressure, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.gradientSub.uniforms.u_velocity, 1);
    blit(velocity.write); velocity.swap();

    // 7. Advect velocity
    gl.useProgram(progs.advection.program); bindQuad(progs.advection.program);
    gl.uniform2f(progs.advection.uniforms.u_texelSize, velocity.texelSize[0], velocity.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.advection.uniforms.u_velocity, 0);
    gl.uniform1i(progs.advection.uniforms.u_source, 0);
    gl.uniform1f(progs.advection.uniforms.u_dt, dt);
    gl.uniform1f(progs.advection.uniforms.u_dissipation, VELOCITY_DISSIPATION);
    blit(velocity.write); velocity.swap();

    // 8. Advect dye
    gl.useProgram(progs.advection.program); bindQuad(progs.advection.program);
    gl.uniform2f(progs.advection.uniforms.u_texelSize, dye.texelSize[0], dye.texelSize[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
    gl.uniform1i(progs.advection.uniforms.u_velocity, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
    gl.uniform1i(progs.advection.uniforms.u_source, 1);
    gl.uniform1f(progs.advection.uniforms.u_dt, dt);
    gl.uniform1f(progs.advection.uniforms.u_dissipation, DYE_DISSIPATION);
    blit(dye.write); dye.swap();
  }

  function display() {
    gl.useProgram(progs.display.program); bindQuad(progs.display.program);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
    gl.uniform1i(progs.display.uniforms.u_dye, 0);
    blit(null);
  }

  // ── Auto-stir ────────────────────────────────────────────
  let autoSplatTimer = 0;
  function maybeAutoSplat(dt, now) {
    if (!autoEl.checked) return;
    if (now - lastUserInputMs < AUTO_STIR_COOLDOWN_MS) return;
    autoSplatTimer -= dt;
    if (autoSplatTimer > 0) return;
    autoSplatTimer = 0.3 + Math.random() * 1.0;
    const x = 0.2 + Math.random() * 0.6;
    const y = 0.2 + Math.random() * 0.6;
    const ang = Math.random() * Math.PI * 2;
    const mag = 800 + Math.random() * 1200;
    const dx = Math.cos(ang) * mag;
    const dy = Math.sin(ang) * mag;
    splat(x, y, dx, dy, nextColor());
  }

  function handlePointer() {
    if (pointer.down && (pointer.dx !== 0 || pointer.dy !== 0)) {
      splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
      pointer.dx = 0; pointer.dy = 0;
    }
  }

  // ── Loop ─────────────────────────────────────────────────
  let lastTime = performance.now();
  let frames = 0;
  let lastFpsT = lastTime;
  function frame(now) {
    let dt = (now - lastTime) / 1000;
    if (dt > FRAME_DT_CAP * 4) dt = FRAME_DT_CAP * 4;
    lastTime = now;
    resizeCanvas();
    handlePointer();
    maybeAutoSplat(dt, now);
    step(dt);
    display();
    frames++;
    if (now - lastFpsT > 1000) {
      const fps = (frames * 1000 / (now - lastFpsT)) | 0;
      infoEl.textContent = `${canvas.width}×${canvas.height} · ${fps} fps`;
      frames = 0; lastFpsT = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
</script>
