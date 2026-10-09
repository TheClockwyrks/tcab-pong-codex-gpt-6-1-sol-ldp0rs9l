import type { DeepReadonly } from "ts-essentials";
import type { BallState, CaromState, CaromDebugApi } from "./game";
import {
  CAROM_DEBUG_VERSION,
  TITLE_ITEMS,
  PAUSE_ITEMS,
  MATCHOVER_ITEMS,
} from "./constants";
import { drawSign, initialState, obstacle, parkedBall } from "./world";
export interface MenuRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
type State = DeepReadonly<CaromState>;
export interface Snapshot extends CaromState {
  readonly version: number;
  readonly ball: (BallState & { readonly speed: number }) | null;
}

export function menuItemRect(s: State, index: number): MenuRect | null {
  const count =
    s.screen === "title"
      ? TITLE_ITEMS.length
      : s.screen === "paused"
        ? PAUSE_ITEMS.length
        : s.screen === "matchover"
          ? MATCHOVER_ITEMS.length
          : s.screen === "howto"
            ? 1
            : 0;
  if (!Number.isInteger(index) || index < 0 || index >= count) return null;
  return {
    x: 460,
    y: (s.screen === "howto" ? 590 : 360) + index * 66,
    w: 360,
    h: 54,
  };
}
function ball(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
export const debug: CaromDebugApi = {
  version: CAROM_DEBUG_VERSION,
  clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s) => ({ ...s, ball: parkedBall() }),
  spawnObstacle: (s, index) => ({
    ...s,
    obstacles: [
      ...s.obstacles.filter((o) => o.index !== index),
      obstacle(index),
    ].sort((a, b) => a.index - b.index),
  }),
  reset: (s) => initialState(s.muted),
  reconcile: (s) => ({ ...s }),
  setScreen: (s, screen) => ({ ...s, screen }),
  setMode: (s, mode) => ({ ...s, mode }),
  setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
  setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
  setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
  setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
  setWinner: (s, winner) => ({ ...s, winner }),
  setReceiver: (s, receiver) => ({ ...s, receiver }),
  setPaddleCy: (s, side, cy) => ({
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], cy } },
  }),
  setPaddleVy: (s, side, drivenVy) => ({
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], drivenVy } },
  }),
  setPaddleDriven: (s, side, driven) => ({
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], driven } },
  }),
  setBallPosition: (s, x, y) => ball(s, { x, y }),
  setBallVelocity: (s, vx, vy) => ball(s, { vx, vy }),
  setBallSpin: (s, spin) => ball(s, { spin }),
  setBallHeld: (s, held) => ball(s, { held }),
  setBallHoldTimer: (s, holdTimer) => ball(s, { holdTimer }),
  setBallServeSign: (s, serveSign) => ball(s, { serveSign }),
  drawBallServeSign: (s) => ball(s, { serveSign: drawSign() }),
  setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
  setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
  setMuted: (s, muted) => ({ ...s, muted }),
  snapshot: (s) => ({
    ...declaredState(s),
    version: CAROM_DEBUG_VERSION,
    ball: s.ball
      ? { ...structuredClone(s.ball), speed: Math.hypot(s.ball.vx, s.ball.vy) }
      : null,
  }),
  menuItemRect,
};

function declaredState(s: State): CaromState {
  const copy = structuredClone(s);
  Reflect.deleteProperty(copy, "menuContacts");
  return copy;
}
