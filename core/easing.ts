export type EasingId =
  "linear" | "easeInOutCubic" | "easeOutCubic" | "easeInOutSine" | "smoothstep";

function clamp(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

const linear = (t: number): number => clamp(t);
const easeInOutCubic = (t: number): number => {
  const value = clamp(t);
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
};
const easeOutCubic = (t: number): number => {
  const value = clamp(t);
  return 1 - Math.pow(1 - value, 3);
};
const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
const smoothstep = (t: number): number => {
  const value = clamp(t);
  return value * value * (3 - 2 * value);
};

export const EASINGS: Readonly<Record<EasingId, (t: number) => number>> = Object.freeze({
  linear,
  easeInOutCubic,
  easeOutCubic,
  easeInOutSine,
  smoothstep,
});

export const EASING_INDEX: Readonly<Record<EasingId, 0 | 1 | 2 | 3 | 4>> = Object.freeze({
  linear: 0,
  easeInOutCubic: 1,
  easeOutCubic: 2,
  easeInOutSine: 3,
  smoothstep: 4,
});

export function ease(id: EasingId, t: number): number {
  const value = EASINGS[id](t);
  return value === 0 ? 0 : value;
}
