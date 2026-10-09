import * as C from "./constants";
import type { BallState, CaromState, Mode, ObstacleState } from "./game";
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export const drawSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export const parkedBall = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: drawSign(),
  trail: [],
});
export function obstacle(index: number): ObstacleState {
  const c = C.OBSTACLE_CENTERS[index];
  if (!c) throw new RangeError(`Unknown obstacle ${index}`);
  return { index, cx: c.x, cy: c.y };
}
export function initialState(muted = false): CaromState {
  const paddle = { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: { ...paddle }, right: { ...paddle } },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i)),
    simTime: 0,
    muted,
  };
}
export function startMatch(s: CaromState, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
  };
}
export function returnTitle(s: CaromState): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
