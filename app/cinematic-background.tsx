"use client";

import { useEffect, useRef } from "react";

const vertex = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `
precision mediump float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
uniform float impulse;
uniform float warmth;
uniform float focus;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0., weight = .5;
  for (int i = 0; i < 4; i++) {
    value += weight * noise(p);
    p = mat2(.8, -.6, .6, .8) * p * 2.04 + 7.1;
    weight *= .5;
  }
  return value;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float aspect = resolution.x / resolution.y;
  vec2 p = (uv - .5) * vec2(aspect, 1.);
  vec2 mouse = (pointer - .5) * vec2(aspect, 1.);
  vec2 delta = p - mouse;
  float distance = length(delta);
  float wake = exp(-distance * 4.5);
  p += delta * wake * .38;
  p += normalize(delta + .001) * sin(distance * 24. - time * 1.8) * wake * .018;
  float radius = length(p);
  p += normalize(p + .001) * sin(radius * 15. - impulse * 7.) * impulse * .055;
  float t = time * .045;
  vec2 warp = vec2(fbm(p * 2.2 + vec2(t, -t)), fbm(p * 2.2 + vec2(4.2, t)));
  float field = fbm(p * 3.2 + warp * 3.5 + vec2(t * .4, -t));
  float folds = sin(field * 20. + radius * 4.);
  float ridges = pow(.5 + .5 * folds, 9.);
  float mist = smoothstep(.26, .78, field);
  vec3 black = vec3(.018, .025, .023);
  vec3 moss = mix(vec3(.17, .21, .185), vec3(.27, .245, .16), warmth);
  vec3 silver = mix(vec3(.37, .40, .34), vec3(.46, .41, .27), warmth);
  vec3 color = mix(black, moss, mist * .8);
  color += silver * ridges * (.24 + .48 * wake);
  color += vec3(.13, .14, .1) * wake * .13;
  float vignette = 1. - smoothstep(.2, 1.05, length((uv - .5) * vec2(1.15, 1.)));
  color *= .35 + .65 * vignette;
  color *= 1. - focus * .35;
  color += (hash(gl_FragCoord.xy + mod(time, 100.)) - .5) * .018;
  gl_FragColor = vec4(color, 1.);
}
`;

/** Decorative only: a static CSS backdrop remains if WebGL is unavailable. */
export default function CinematicBackground({ paused, dark, focused, cue }: {
  paused: boolean; dark: boolean; focused: boolean; cue: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ paused, dark, focused, cue });
  useEffect(() => { state.current = { paused, dark, focused, cue }; }, [paused, dark, focused, cue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return;
    let frame = 0, disposed = false, lost = false;
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    const buffer = gl.createBuffer();
    if (!program || !buffer) return;
    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) throw new Error("Shader allocation failed");
      shaders.push(shader);
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error("Shader compilation failed");
      gl!.attachShader(program!, shader);
    }
    function release() {
      cancelAnimationFrame(frame);
      shaders.forEach(shader => gl!.deleteShader(shader));
      gl!.deleteBuffer(buffer);
      gl!.deleteProgram(program);
    }
    try {
      compile(gl.VERTEX_SHADER, vertex);
      compile(gl.FRAGMENT_SHADER, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader link failed");
    } catch {
      release();
      return;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(["resolution", "pointer", "time", "impulse", "warmth", "focus"].map(name => [name, gl.getUniformLocation(program, name)]));
    const target = { x: .5, y: .5 }, pointer = { ...target };
    let elapsed = 0, last = 0, lastDraw = 0, pulse = 0, warmth = state.current.dark ? 0 : 1, focus = 0, lastCue = state.current.cue;
    function resize() {
      // Bound fill rate on large/HiDPI displays; the soft texture needs no full-resolution canvas.
      const scale = Math.min(1, 1400 / window.innerWidth);
      canvas!.width = Math.round(window.innerWidth * scale);
      canvas!.height = Math.round(window.innerHeight * scale);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      wake();
    }
    function move(event: PointerEvent) {
      if (state.current.paused) return;
      target.x = event.clientX / window.innerWidth;
      target.y = 1 - event.clientY / window.innerHeight;
    }
    function render(now: number) {
      frame = 0;
      if (disposed || lost || document.hidden) return;
      if (now - lastDraw < 32 && !state.current.paused) { frame = requestAnimationFrame(render); return; }
      const dt = Math.min((now - (last || now)) / 1000, .05);
      last = now;
      const blend = 1 - Math.exp(-dt * 6);
      if (!state.current.paused) {
        elapsed += dt;
        pointer.x += (target.x - pointer.x) * blend;
        pointer.y += (target.y - pointer.y) * blend;
        if (lastCue !== state.current.cue) { pulse = 1; lastCue = state.current.cue; }
        pulse *= Math.exp(-dt * 2.5);
      } else { pulse = 0; lastCue = state.current.cue; }
      warmth += ((state.current.dark ? 0 : 1) - warmth) * (state.current.paused ? 1 : blend);
      focus += ((state.current.focused ? 1 : 0) - focus) * (state.current.paused ? 1 : blend);
      gl!.uniform2f(uniforms.resolution, canvas!.width, canvas!.height);
      gl!.uniform2f(uniforms.pointer, pointer.x, pointer.y);
      gl!.uniform1f(uniforms.time, elapsed);
      gl!.uniform1f(uniforms.impulse, pulse);
      gl!.uniform1f(uniforms.warmth, warmth);
      gl!.uniform1f(uniforms.focus, focus);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      canvas!.dataset.ready = "true";
      lastDraw = now;
      if (!state.current.paused) frame = requestAnimationFrame(render);
    }
    function wake() {
      if (!frame && !disposed && !lost && !document.hidden) { last = 0; frame = requestAnimationFrame(render); }
    }
    function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); }
    function contextLost() { lost = true; cancelAnimationFrame(frame); frame = 0; delete canvas!.dataset.ready; }
    // Attribute changes wake a paused canvas once, without maintaining an idle render loop.
    const observer = new MutationObserver(wake);
    observer.observe(canvas, { attributes: true, attributeFilter: ["data-paused", "data-dark", "data-focused"] });
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      release();
    };
  }, []);

  return <canvas ref={canvasRef} className="cinematic-canvas" aria-hidden="true" data-paused={paused} data-dark={dark} data-focused={focused} />;
}
