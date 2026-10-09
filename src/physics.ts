import * as C from "./constants";
import type { BallState, CaromState } from "./game";
import { clamp } from "./world";

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
/** Expanded rectangle collision; face priority is left, right, top, bottom. */
function contact(b: MovingBall, r: C.Rect): number {
  const depths = [
    b.x - (r.x0 - C.BALL_R),
    r.x1 + C.BALL_R - b.x,
    b.y - (r.y0 - C.BALL_R),
    r.y1 + C.BALL_R - b.y,
  ];
  if (depths.some((d) => d <= 0)) return -1;
  const face = depths.indexOf(Math.min(...depths));
  if (face === 0) b.x = r.x0 - C.BALL_R;
  if (face === 1) b.x = r.x1 + C.BALL_R;
  if (face === 2) b.y = r.y0 - C.BALL_R;
  if (face === 3) b.y = r.y1 + C.BALL_R;
  return face;
}
function reflect(b: MovingBall, face: number): boolean {
  if ((face === 0 && b.vx > 0) || (face === 1 && b.vx < 0)) {
    b.vx = -b.vx;
    return true;
  }
  if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
    b.vy = -b.vy;
    return true;
  }
  return false;
}
export function fly(
  s: CaromState,
  dt: number,
  cues: Set<C.CueName>,
): BallState | null {
  if (!s.ball) return null;
  if (s.ball.held) return s.ball;
  const b: MovingBall = { ...s.ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      const vx = b.vx * cos - b.vy * sin;
      b.vy = b.vx * sin + b.vy * cos;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    for (const side of ["left", "right"] as const) {
      const p = s.paddles[side];
      const r = {
        x0: side === "left" ? C.P1_X0 : C.P2_X0,
        x1: side === "left" ? C.P1_X1 : C.P2_X1,
        y0: p.cy - C.PADDLE_HALF,
        y1: p.cy + C.PADDLE_HALF,
      };
      const face = contact(b, r);
      if (face === 0 || face === 1) {
        const theta =
          clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
        const speed = Math.min(
          Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
          C.SPEED_CAP,
        );
        b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(theta);
        b.vy = speed * Math.sin(theta);
        b.spin = clamp(
          b.spin + p.vy * C.SPIN_FROM_PADDLE,
          -C.SPIN_CLAMP,
          C.SPIN_CLAMP,
        );
        b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
        cues.add(C.CUES.paddleHit);
      } else if (reflect(b, face)) cues.add(C.CUES.wallBounce);
    }
    for (const o of s.obstacles)
      if (reflect(b, contact(b, C.OBSTACLES[o.index])))
        cues.add(C.CUES.obstacleBounce);
  }
  return b;
}
