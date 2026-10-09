import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { CaromDebugApi, CaromState, PaddleState, Side } from "./game";
import { debug, menuItemRect } from "./debug";
import {
  clamp,
  initialState,
  parkedBall,
  returnTitle,
  startMatch,
} from "./world";
import { fly } from "./physics";

export function initialize(
  api: InitApi<CaromState>,
): [CaromState, CaromDebugApi] {
  for (const name of C.ACTIONS)
    api.input.register(name, { keys: [...C.BINDINGS[name]] });
  api.audio.define(C.CUES.paddleHit, {
    wave: "triangle",
    freq: 680,
    freqTo: 320,
    durationMs: 65,
    gain: 0.18,
  });
  api.audio.define(C.CUES.wallBounce, {
    freq: 260,
    freqTo: 190,
    durationMs: 45,
    gain: 0.12,
  });
  api.audio.define(C.CUES.obstacleBounce, {
    wave: "square",
    freq: 410,
    freqTo: 820,
    durationMs: 50,
    gain: 0.07,
  });
  api.audio.define(C.CUES.score, {
    wave: "triangle",
    freq: 880,
    freqTo: 220,
    durationMs: 240,
    gain: 0.2,
  });
  api.diagnostics.register("screen", (s) => s.screen);
  api.diagnostics.register("mode", (s) => s.mode);
  api.diagnostics.register("p1", (s) => s.score.p1);
  api.diagnostics.register("p2", (s) => s.score.p2);
  api.diagnostics.register("ball position", (s) =>
    s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "none",
  );
  api.diagnostics.register("ball velocity", (s) =>
    s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "none",
  );
  api.diagnostics.register("ball speed", (s) =>
    s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
  );
  api.diagnostics.register("ball spin", (s) => (s.ball ? s.ball.spin : "none"));
  for (const side of ["left", "right"] as const) {
    api.diagnostics.register(`${side} cy`, (s) => s.paddles[side].cy);
    api.diagnostics.register(`${side} vy`, (s) => s.paddles[side].vy);
  }
  return [initialState(), debug];
}
function confirm(s: CaromState): CaromState {
  if (s.screen === "title") {
    s = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...s, screen: "howto", menuIndex: 0 }
      : startMatch(s, s.menuIndex === 0 ? "solo" : "versus");
  }
  if (s.screen === "howto") return returnTitle(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? startMatch(s, s.mode)
        : returnTitle(s);
  if (s.screen === "matchover")
    return s.menuIndex === 0 ? startMatch(s, s.mode) : returnTitle(s);
  return s;
}
// Input history belongs to the state, including contacts spanning frame boundaries.
export interface MenuContact {
  readonly id: number;
  readonly index: number;
  readonly screen: string;
}
export interface InputMemory {
  readonly menuContacts?: readonly MenuContact[];
}
function forgetContacts(s: CaromState): CaromState {
  const { menuContacts: _contacts, ...next } = s as CaromState & InputMemory;
  return next;
}
function readInput(
  state: DeepReadonly<CaromState>,
  api: UpdateApi,
): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  ) as Record<C.ActionName, boolean>;
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let s: CaromState = { ...state };
  if (edges.mute) api.audio.setMuted(!api.audio.muted());
  s = { ...s, muted: api.audio.muted() };
  const active = s.screen === "playing" || s.screen === "countdown";
  if (active)
    return edges.pause
      ? {
          ...forgetContacts(s),
          resumeScreen: s.screen as "playing" | "countdown",
          screen: "paused",
          menuIndex: 0,
        }
      : s;
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...forgetContacts(s), screen: s.resumeScreen };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return returnTitle(s);
  const count =
    s.screen === "title"
      ? C.TITLE_ITEMS.length
      : s.screen === "paused"
        ? C.PAUSE_ITEMS.length
        : s.screen === "matchover"
          ? C.MATCHOVER_ITEMS.length
          : 1;
  const up = edges["p1-up"] || edges["p2-up"],
    down = edges["p1-down"] || edges["p2-down"];
  let keyboardConfirm = false;
  if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
  else if (edges.confirm) {
    s = confirm(s);
    keyboardConfirm = true;
  }
  const hit = (x: number, y: number): number => {
    for (let i = 0; i < count; i++) {
      const r = menuItemRect(state, i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return i;
    }
    return -1;
  };
  const history = [...((state as CaromState & InputMemory).menuContacts ?? [])];
  if (!keyboardConfirm) {
    for (const sample of samples) {
      const index = hit(sample.x, sample.y);
      if (index >= 0) s = { ...s, menuIndex: index };
      if (sample.type === "down" && sample.button === "primary")
        history.push({ id: sample.id, index, screen: state.screen });
      if (sample.type === "up") {
        const press = history.find((p) => p.id === sample.id);
        const pos = history.findIndex((p) => p.id === sample.id);
        if (pos >= 0) history.splice(pos, 1);
        if (
          press &&
          press.index >= 0 &&
          press.index === index &&
          press.screen === s.screen
        ) {
          s = confirm(s);
          break;
        }
      }
    }
    if (s.screen === state.screen)
      for (const contact of contacts) {
        const index = hit(contact.x, contact.y);
        if (index >= 0) s = { ...s, menuIndex: index };
      }
  }
  return {
    ...s,
    menuContacts: s.screen === state.screen ? history : [],
  } as CaromState & InputMemory;
}
function move(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: cy !== raw && dt > 0 ? (cy - p.cy) / dt : vy };
}
function paddles(
  s: CaromState,
  api: UpdateApi,
  dt: number,
): CaromState["paddles"] {
  const v = (name: C.ActionName) => api.input.value(name) > 0;
  const human = (side: Side) => {
    const solo = s.mode === "solo";
    const up =
      side === "left" ? v("p1-up") || (solo && v("p2-up")) : v("p2-up");
    const down =
      side === "left" ? v("p1-down") || (solo && v("p2-down")) : v("p2-down");
    return (Number(down) - Number(up)) * C.PADDLE_SPEED;
  };
  const left = s.paddles.left,
    right = s.paddles.right;
  let rv = human("right");
  if (s.mode === "solo") {
    let target = C.AI_HOME_Y,
      dz = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      dz = C.AI_DEADZONE;
    }
    const diff = target - right.cy;
    rv =
      s.ai.movement && Math.abs(diff) > dz && dt > 0
        ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
        : 0;
  }
  return {
    left: move(left, left.driven ? left.drivenVy : human("left"), dt),
    right: move(right, right.driven ? right.drivenVy : rv, dt),
  };
}
export function update(
  state: DeepReadonly<CaromState>,
  api: UpdateApi,
  dt: number,
): CaromState {
  // Debug poses set the game's mute mirror; apply it to the engine bus before input.
  api.audio.setMuted(state.muted);
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt };
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  s = { ...s, paddles: paddles(s, api, dt) };
  const cues = new Set<C.CueName>();
  if (s.ball) {
    if (s.screen === "countdown") {
      const remaining = s.ball.holdTimer - dt;
      s = { ...s, ball: { ...s.ball, holdTimer: Math.max(0, remaining) } };
      if (remaining <= 0)
        s = {
          ...s,
          screen: "playing",
          ball: {
            ...s.ball!,
            held: false,
            holdTimer: 0,
            trail: [],
            vx:
              (s.receiver === "left" ? -1 : 1) *
              C.SERVE_SPEED *
              Math.cos(C.SERVE_ANGLE),
            vy: s.ball!.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          },
        };
    } else s = { ...s, ball: fly(s, dt, cues) };
    if (s.ball) {
      s = {
        ...s,
        ball: {
          ...s.ball,
          trail: [
            ...s.ball.trail.filter((t) => s.simTime - t.t <= C.TRAIL_TIME),
            { x: s.ball.x, y: s.ball.y, t: s.simTime },
          ],
        },
      };
      const scorer =
        s.ball!.x - C.BALL_R > C.FIELD_W
          ? "left"
          : s.ball!.x + C.BALL_R < 0
            ? "right"
            : null;
      if (scorer) {
        cues.add(C.CUES.score);
        const score = {
          p1: s.score.p1 + Number(scorer === "left"),
          p2: s.score.p2 + Number(scorer === "right"),
        };
        const won =
          scorer === "left"
            ? score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD
            : score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD;
        s = won
          ? { ...s, score, winner: scorer, screen: "matchover", menuIndex: 0 }
          : {
              ...s,
              score,
              receiver: scorer === "left" ? "right" : "left",
              ball: parkedBall(),
              screen: "countdown",
            };
      }
    }
  }
  for (const cue of cues) api.audio.play(cue);
  return s;
}
