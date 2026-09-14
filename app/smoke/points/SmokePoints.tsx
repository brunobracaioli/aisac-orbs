"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createPrng } from "@/core";

const PARTICLE_COUNT = 2_000;

export interface OrbDebugSmoke {
  readonly kind: "smoke";
  readonly frames: number;
  readonly contextCreated: boolean;
  readonly glErrors: number;
  readonly rendererInfo: string;
  readonly fallback: boolean;
  readonly particleCount: 2_000;
}

declare global {
  interface Window {
    readonly __orbDebug?: OrbDebugSmoke;
  }
}

interface SmokePointsProps {
  readonly debug: boolean;
  readonly seed: number;
}

interface DebugState {
  frames: number;
  contextCreated: boolean;
  glErrors: number;
  rendererInfo: string;
  fallback: boolean;
}

const vertexShader = `
  uniform float uTime;
  attribute float aSize;
  void main() {
    vec3 animated = position + vec3(sin(uTime + position.y) * 0.002, 0.0, 0.0);
    gl_Position = vec4(animated, 1.0);
    gl_PointSize = aSize;
  }
`;

const fragmentShader = `
  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    if (length(point) > 0.5) discard;
    gl_FragColor = vec4(0.2, 0.85, 1.0, 0.9);
  }
`;

function snapshot(debug: DebugState): OrbDebugSmoke {
  return Object.freeze({
    kind: "smoke" as const,
    frames: debug.frames,
    contextCreated: debug.contextCreated,
    glErrors: debug.glErrors,
    rendererInfo: debug.rendererInfo,
    fallback: debug.fallback,
    particleCount: PARTICLE_COUNT as 2_000,
  });
}

function exposeDebug(debugEnabled: boolean, state: DebugState): void {
  if (!debugEnabled) {
    return;
  }

  Object.defineProperty(window, "__orbDebug", {
    configurable: true,
    enumerable: false,
    get: () => snapshot(state),
  });
}

function removeDebug(debugEnabled: boolean): void {
  if (debugEnabled) {
    Reflect.deleteProperty(window, "__orbDebug");
  }
}

export default function SmokePoints({ debug, seed }: SmokePointsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const state: DebugState = {
      frames: 0,
      contextCreated: false,
      glErrors: 0,
      rendererInfo: "",
      fallback: false,
    };
    exposeDebug(debug, state);

    const canvas = canvasRef.current;
    if (canvas === null) {
      state.fallback = true;
      setFallback(true);
      return () => removeDebug(debug);
    }

    let renderer: THREE.WebGLRenderer;
    let animationFrame = 0;
    let disposed = false;
    let material: THREE.ShaderMaterial | undefined;
    let geometry: THREE.BufferGeometry | undefined;

    try {
      const availableContext = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (availableContext === null) {
        throw new Error("WebGL context unavailable");
      }

      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      renderer.setPixelRatio(1);
      renderer.setSize(640, 360, false);
      state.contextCreated = true;
      const gl = renderer.getContext();
      const rendererName = gl.getParameter(gl.RENDERER);
      state.rendererInfo = typeof rendererName === "string" ? rendererName : "unknown";

      const prng = createPrng(seed);
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const sizes = new Float32Array(PARTICLE_COUNT);
      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const offset = index * 3;
        positions[offset] = prng.next() * 2 - 1;
        positions[offset + 1] = prng.next() * 2 - 1;
        positions[offset + 2] = prng.next() * 2 - 1;
        sizes[index] = 1.5 + prng.next() * 2;
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      });

      const points = new THREE.Points(geometry, material);
      const scene = new THREE.Scene();
      scene.add(points);
      const camera = new THREE.Camera();
      const startedAt = performance.now();

      const renderFrame = () => {
        if (disposed) {
          return;
        }

        if (material !== undefined) {
          const timeUniform = material.uniforms.uTime;
          if (timeUniform !== undefined) {
            timeUniform.value = (performance.now() - startedAt) / 1_000;
          }
        }
        renderer.render(scene, camera);
        if (gl.getError() !== gl.NO_ERROR) {
          state.glErrors += 1;
        }
        state.frames += 1;
        animationFrame = requestAnimationFrame(renderFrame);
      };

      animationFrame = requestAnimationFrame(renderFrame);
    } catch {
      state.fallback = true;
      setFallback(true);
    }

    return () => {
      disposed = true;
      if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
      }
      material?.dispose();
      geometry?.dispose();
      if (renderer !== undefined) {
        renderer.dispose();
      }
      removeDebug(debug);
    };
  }, [debug, seed]);

  if (fallback) {
    return (
      <section role="status" data-testid="fallback">
        WebGL unavailable — text state remains available
      </section>
    );
  }

  return (
    <main aria-label="AISAC Orbs WebGL smoke test">
      <canvas ref={canvasRef} aria-label="AISAC Orbs particle smoke" />
    </main>
  );
}
