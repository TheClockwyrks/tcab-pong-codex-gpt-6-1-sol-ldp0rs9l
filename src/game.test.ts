import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import {
  ConstantClock,
  createEngine,
  type Engine,
} from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type CaromState, type CaromDebugApi } from "./game";
import * as C from "./constants";
const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup(ms = 8) {
  const target = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const e = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(e);
  await e.initialize();
  const key = (code: string, type = "keydown") => {
    const event = new Event(type);
    Object.assign(event, { code, repeat: false });
    target.dispatchEvent(event);
  };
  const tap = async (code: string) => {
    key(code);
    await e.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) => {
    const event = new Event(type);
    Object.assign(event, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: device,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    target.dispatchEvent(event);
  };
  const pose = (f: (s: CaromState, d: CaromDebugApi) => CaromState) =>
    e.apply((s) => f(s, e.debug));
  const rally = (x: number, y: number, vx: number, vy: number, spin = 0) =>
    pose((s, d) =>
      d.setBallSpin(
        d.setBallVelocity(
          d.setBallPosition(
            d.setBallHeld(
              d.setScreen(d.spawnBall(d.clearWorld(s)), "playing"),
              false,
            ),
            x,
            y,
          ),
          vx,
          vy,
        ),
        spin,
      ),
    );
  return { e, key, tap, pointer, pose, rally, canvas };
}
describe("Carom through the engine", () => {
  it("initializes a complete world and pure diagnostic sources", async () => {
    const { e } = await setup();
    expect(e.state.screen).toBe("title");
    expect(e.state.ball?.held).toBe(true);
    expect(e.state.obstacles).toHaveLength(2);
    expect(e.debug.snapshot(e.state).version).toBe(C.CAROM_DEBUG_VERSION);
    expect(e.diagnostics().every((r) => r.error === undefined)).toBe(true);
    const old = structuredClone(e.state);
    await e.advance(4);
    expect(old.simTime).toBe(0);
    expect(e.state.simTime).toBeCloseTo(0.032);
  });
  it("starts, moves during countdown, serves without travel, and pauses once on Escape", async () => {
    const { e, tap, key } = await setup(10);
    await tap("Enter");
    expect(e.state.screen).toBe("countdown");
    key("KeyW");
    await e.advance(10);
    expect(e.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY - C.PADDLE_SPEED * 0.1,
    );
    key("KeyW", "keyup");
    e.apply((s) => e.debug.setBallHoldTimer(s, 0));
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    expect(e.state.ball?.vx).toBeLessThan(0);
    await tap("Escape");
    expect(e.state.screen).toBe("paused");
    const b = structuredClone(e.state.ball);
    await e.advance(20);
    expect(e.state.ball).toEqual(b);
    await tap("Escape");
    expect(e.state.screen).toBe("playing");
  });
  it("prioritizes menu movement and remembers the confirmed title item", async () => {
    const { e, key, tap } = await setup();
    key("KeyS");
    key("KeyW");
    key("Enter");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(2);
    expect(e.state.screen).toBe("title");
    key("Enter", "keyup");
    key("KeyW", "keyup");
    key("KeyS", "keyup");
    await tap("Enter");
    expect(e.state.screen).toBe("howto");
    expect(e.state.titleIndex).toBe(2);
    await tap("Escape");
    expect(e.state.menuIndex).toBe(2);
  });
  it("confirms same-frame clicks but rejects releases in a different item", async () => {
    const { e, pointer } = await setup();
    const a = e.debug.menuItemRect(e.state, 0)!,
      b = e.debug.menuItemRect(e.state, 1)!;
    pointer("pointerdown", a.x + 10, a.y + 10);
    await e.advance(1);
    pointer("pointerup", b.x + 10, b.y + 10);
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(1);
    pointer("pointerdown", b.x + 10, b.y + 10);
    pointer("pointerup", b.x + 10, b.y + 10);
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    expect(e.state.titleIndex).toBe(1);
  });
  it("forgets a menu press when keyboard input leaves that screen", async () => {
    const { e, tap, pointer } = await setup();
    await tap("Enter");
    await tap("Escape");
    const r = e.debug.menuItemRect(e.state, 1)!;
    pointer("pointerdown", r.x + 20, r.y + 20);
    await e.advance(1);
    await tap("Escape");
    await tap("Escape");
    pointer("pointerup", r.x + 20, r.y + 20);
    await e.advance(1);
    expect(e.state.screen).toBe("paused");
    expect(e.state.ball!.holdTimer).toBeLessThan(C.HOLD_TIME);
  });

  it("supports touch selection, cancellation of an outside press, and valid taps", async () => {
    const { e, pointer } = await setup();
    const r = e.debug.menuItemRect(e.state, 2)!;
    pointer("pointerdown", 0, 0, 4, "touch");
    pointer("pointermove", r.x + 20, r.y + 20, 4, "touch");
    await e.advance(1);
    expect(e.state.menuIndex).toBe(2);
    pointer("pointerup", r.x + 20, r.y + 20, 4, "touch");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", r.x + 20, r.y + 20, 5, "touch");
    pointer("pointerup", r.x + 20, r.y + 20, 5, "touch");
    await e.advance(1);
    expect(e.state.screen).toBe("howto");
  });
  it("uses both key sets in Solo, separate sides in Versus, and clamps actual velocity", async () => {
    const { e, key, pose } = await setup(10);
    pose((s, d) => d.setScreen(s, "playing"));
    key("ArrowDown");
    await e.advance(1);
    expect(e.state.paddles.left.cy).toBeCloseTo(C.FIELD_CY + 7.2);
    expect(e.state.paddles.right.cy).toBe(C.FIELD_CY);
    pose((s, d) =>
      d.setMode(d.setPaddleCy(s, "right", C.PADDLE_MAX_CY), "versus"),
    );
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
    pose((s, d) => d.setPaddleCy(s, "right", C.PADDLE_MAX_CY - 2));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBeCloseTo(200);
  });
  it("keeps driven velocity separate and retains flags across match starts", async () => {
    const { e, pose, tap } = await setup(10);
    pose((s, d) =>
      d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", 100),
    );
    expect(e.state.paddles.left.vy).toBe(0);
    await tap("Enter");
    expect(e.state.paddles.left.driven).toBe(true);
    expect(e.state.paddles.left.vy).toBe(100);
    expect(e.state.paddles.left.cy).toBe(C.FIELD_CY + 1);
  });
  it("adds spin and speed on a paddle face, preserving the previous state", async () => {
    const { e, rally, pose } = await setup(8);
    rally(C.P1_X1 + C.BALL_R + 2, C.FIELD_CY, -600, 0);
    pose((s, d) =>
      d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", 200),
    );
    const old = structuredClone(e.state);
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(624);
    expect(e.state.ball!.spin).toBeGreaterThan(160);
    expect(old.ball!.vx).toBe(-600);
  });
  it("resolves end caps as walls with no speed increase", async () => {
    const { e, rally } = await setup(4);
    rally(C.P1_X0 + 8, C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1, 0, 500);
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-500);
    expect(e.state.ball!.y).toBe(C.FIELD_CY - C.PADDLE_HALF - C.BALL_R);
  });
  it("reflects walls and obstacles without losing spin or speed except decay", async () => {
    const { e, rally, pose } = await setup(8);
    const cues: string[] = [];
    e.events.on("cue:played", (v) => cues.push(v.cue));
    rally(200, C.BALL_R + 1, 100, -600, 80);
    await e.advance(1);
    expect(e.state.ball!.vy).toBeGreaterThan(0);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      Math.hypot(100, 600),
    );
    expect(cues).toContain(C.CUES.wallBounce);
    rally(
      C.OBSTACLES[0].x0 - C.BALL_R - 1,
      C.OBSTACLE_CENTERS[0].y,
      600,
      0,
      80,
    );
    pose((s, d) => d.spawnObstacle(s, 0));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeLessThan(0);
    expect(cues).toContain(C.CUES.obstacleBounce);
    expect(e.state.ball!.spin).toBeCloseTo(
      80 * Math.pow(0.5, 0.008 / C.SPIN_HALFLIFE),
    );
  });
  it.each([
    [469, 220, 980, 0, -1, 0],
    [511, 220, -980, 0, 1, 0],
    [490, 139, 0, 980, 0, -1],
    [490, 301, 0, -980, 0, 1],
  ])(
    "resolves obstacle face at speed cap (%s, %s)",
    async (x, y, vx, vy, sx, sy) => {
      const { e, rally, pose } = await setup(16);
      rally(x, y, vx, vy);
      pose((s, d) => d.spawnObstacle(s, 0));
      await e.advance(1);
      expect(Math.sign(e.state.ball!.vx)).toBe(sx);
      expect(Math.sign(e.state.ball!.vy)).toBe(sy);
      expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
        C.SPEED_CAP,
      );
    },
  );

  it("reflects the bottom wall and the right paddle", async () => {
    const { e, rally } = await setup(8);
    rally(1100, C.FIELD_H - C.BALL_R - 1, 0, 800);
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-800);
    rally(C.P2_X0 - C.BALL_R - 1, C.FIELD_CY, 800, 0);
    await e.advance(1);
    expect(e.state.ball!.vx).toBeCloseTo(-800 * C.SPEED_MULT);
  });

  it("caps paddle speed and spin", async () => {
    const { e, rally, pose } = await setup(4);
    rally(C.P1_X1 + C.BALL_R + 1, C.FIELD_CY, -C.SPEED_CAP, 0, 850);
    pose((s, d) =>
      d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", C.PADDLE_SPEED),
    );
    await e.advance(1);
    expect(Math.hypot(e.state.ball!.vx, e.state.ball!.vy)).toBeCloseTo(
      C.SPEED_CAP,
    );
    expect(e.state.ball!.spin).toBeLessThanOrEqual(C.SPIN_CLAMP);
    expect(e.state.ball!.spin).toBeGreaterThan(890);
  });
  it("scores only beyond the full ball and parks toward the conceding side", async () => {
    const { e, rally } = await setup(4);
    rally(C.FIELD_W + C.BALL_R - 2, 100, 500, 0);
    await e.advance(1);
    expect(e.state.score.p1).toBe(0);
    await e.advance(1);
    expect(e.state.score.p1).toBe(1);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.receiver).toBe("right");
    expect(e.state.ball!.trail).toHaveLength(0);
  });
  it("requires a two-point lead and leaves the winning ball at the goal", async () => {
    const { e, rally, pose } = await setup();
    pose((s, d) => d.setScore(s, 10, 10));
    rally(C.FIELD_W + 20, 120, 500, 0);
    await e.advance(1);
    expect(e.state.score).toEqual({ p1: 11, p2: 10 });
    expect(e.state.screen).toBe("countdown");
    rally(C.FIELD_W + 20, 120, 500, 0);
    await e.advance(1);
    expect(e.state.screen).toBe("matchover");
    expect(e.state.winner).toBe("left");
    expect(e.state.ball!.x).toBeGreaterThan(C.FIELD_W);
  });
  it("scores for the right side and supports restart and quit", async () => {
    const { e, rally, pose, tap } = await setup();
    pose((s, d) => d.setScore(s, 0, 10));
    rally(-20, 120, -500, 0);
    await e.advance(1);
    expect(e.state.winner).toBe("right");
    await tap("Enter");
    expect(e.state.score.p2).toBe(0);
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(e.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(e.state.screen).toBe("title");
  });
  it("gates AI sensing and movement independently", async () => {
    const { e, rally, pose } = await setup(10);
    rally(900, 150, 500, 0);
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(-C.AI_SPEED);
    pose((s, d) => d.setAiTracking(s, false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
    pose((s, d) => d.setAiMovement(d.setAiTracking(s, true), false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
  });
  it("records a time-based curved trail, while held balls never fly", async () => {
    const { e, rally, pose } = await setup(10);
    rally(300, 300, 500, 0, 500);
    await e.advance(20);
    expect(e.state.ball!.trail.length).toBeLessThanOrEqual(14);
    expect(e.state.ball!.vy).toBeGreaterThan(0);
    expect(e.state.ball!.trail[0].t).toBeGreaterThanOrEqual(
      e.state.simTime - C.TRAIL_TIME - 1e-9,
    );
    pose((s, d) => d.setBallHeld(s, true));
    const x = e.state.ball!.x;
    await e.advance(10);
    expect(e.state.ball!.x).toBe(x);
  });
  it("poses every debug field, rejects missing entities, and reconciles purely", async () => {
    const { e, pose } = await setup();
    pose((s, d) =>
      d.setResumeScreen(
        d.setReceiver(
          d.setWinner(
            d.setTitleIndex(d.setMenuIndex(d.setMode(s, "versus"), 2), 1),
            "right",
          ),
          "right",
        ),
        "countdown",
      ),
    );
    pose((s, d) =>
      d.setBallServeSign(
        d.setBallHoldTimer(
          d.setBallSpin(
            d.setBallVelocity(d.setBallPosition(s, 10, 20), 3, 4),
            12,
          ),
          0.2,
        ),
        -1,
      ),
    );
    const snap = e.debug.snapshot(e.state);
    expect(snap.ball!.speed).toBe(5);
    expect(snap.ball!.serveSign).toBe(-1);
    expect(snap.resumeScreen).toBe("countdown");
    expect(e.debug.reconcile(e.state)).toEqual(e.state);
    pose((s, d) => d.clearWorld(s));
    expect(e.debug.snapshot(e.state).ball).toBeNull();
    expect(() => pose((s, d) => d.setBallSpin(s, 1))).toThrow("No ball");
    expect(() => pose((s, d) => d.spawnObstacle(s, 9))).toThrow(
      "Unknown obstacle",
    );
    pose((s, d) => d.spawnObstacle(d.spawnObstacle(d.spawnBall(s), 1), 0));
    expect(e.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
    pose((s, d) => d.drawBallServeSign(s));
    expect([-1, 1]).toContain(e.state.ball!.serveSign);
    pose((s, d) => d.reset(s));
    expect(e.state.simTime).toBe(0);
    expect(e.debug.menuItemRect(e.state, 99)).toBeNull();
  });
  it("mirrors mute poses and keyboard toggles, with cues still observable", async () => {
    const { e, pose, tap, rally } = await setup();
    pose((s, d) => d.setMuted(s, true));
    await e.advance(1);
    expect(e.state.muted).toBe(true);
    await tap("KeyM");
    expect(e.state.muted).toBe(false);
    await tap("KeyM");
    const gains: number[] = [];
    e.events.on("cue:played", (v) => gains.push(v.gain));
    rally(-30, 100, -500, 0);
    await e.advance(1);
    expect(gains).toEqual([0]);
    pose((s, d) => d.reset(s));
    expect(e.state.muted).toBe(true);
  });
  it("agrees on free-flight speed, spin and direction at 2ms and 16ms", async () => {
    const a = await setup(2),
      b = await setup(16);
    for (const f of [a, b]) f.rally(400, 350, 700, 50, 240);
    await a.e.advance(400);
    await b.e.advance(50);
    const x = a.e.state.ball!,
      y = b.e.state.ball!;
    expect(Math.hypot(x.vx, x.vy)).toBeCloseTo(Math.hypot(y.vx, y.vy));
    expect(x.spin).toBeCloseTo(y.spin);
    expect(Math.sign(x.vx)).toBe(Math.sign(y.vx));
    expect(Math.sign(x.vy)).toBe(Math.sign(y.vy));
    expect(Math.abs(x.y - y.y)).toBeLessThan(4);
  });
  it("renders each screen and absent entities without advancing state", async () => {
    const { e, pose } = await setup();
    for (const screen of [
      "title",
      "howto",
      "paused",
      "matchover",
      "countdown",
      "playing",
    ] as const) {
      pose((s, d) => d.setScreen(s, screen));
      await e.advance(1);
    }
    pose((s, d) => d.clearWorld(s));
    await e.advance(1);
    expect(e.state.ball).toBeNull();
    expect(e.debug.menuItemRect(e.state, 0)).toBeNull();
  });
});
