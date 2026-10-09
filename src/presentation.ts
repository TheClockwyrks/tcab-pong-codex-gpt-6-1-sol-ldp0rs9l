import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import * as C from "./constants";
import { menuItemRect } from "./debug";
const INK = "#eef5f6",
  MUTED = "#788a9a",
  CYAN = "#69eee0",
  CORAL = "#ff8078",
  GOLD = "#eeb85d";
type State = DeepReadonly<CaromState>;
function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size: number,
  color = INK,
  align: CanvasTextAlign = "center",
  weight = 500,
): void {
  ctx.font = `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  glow = false,
): void {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow ? 18 : 0;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 6));
  ctx.fill();
  ctx.shadowBlur = 0;
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function court(s: State, ctx: CanvasRenderingContext2D, dim: boolean): void {
  ctx.save();
  ctx.globalAlpha = dim ? 0.25 : 1;
  // A quiet etched grid anchors the luminous bodies without competing with play.
  for (let x = 80; x < C.FIELD_W; x += 80)
    line(ctx, x, 0, x, C.FIELD_H, "#121e2a");
  for (let y = 80; y < C.FIELD_H; y += 80)
    line(ctx, 0, y, C.FIELD_W, y, "#121e2a");
  line(ctx, 24, 2, C.FIELD_W - 24, 2, "#304251", 2);
  line(ctx, 24, C.FIELD_H - 2, C.FIELD_W - 24, C.FIELD_H - 2, "#304251", 2);
  ctx.setLineDash([7, 15]);
  line(ctx, C.NET_X, 100, C.NET_X, C.FIELD_H - 55, "#2b3a46");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#243442";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 68, 0, Math.PI * 2);
  ctx.stroke();
  for (const o of s.obstacles) {
    bar(
      ctx,
      o.cx - C.OBSTACLE_HW - 6,
      o.cy - C.OBSTACLE_HH - 6,
      C.OBSTACLE_W + 12,
      C.OBSTACLE_H + 12,
      "#3c3020",
    );
    bar(
      ctx,
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      GOLD,
      true,
    );
    text(
      ctx,
      o.index === 0 ? "A" : "B",
      o.cx,
      o.cy + C.OBSTACLE_HH + 22,
      10,
      GOLD,
    );
  }
  bar(
    ctx,
    C.P1_X0,
    s.paddles.left.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CYAN,
    true,
  );
  bar(
    ctx,
    C.P2_X0,
    s.paddles.right.cy - C.PADDLE_HALF,
    C.PADDLE_W,
    C.PADDLE_H,
    CORAL,
    true,
  );
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      ctx.globalAlpha = (dim ? 0.25 : 1) * (i / b.trail.length) * 0.5;
      line(ctx, a.x, a.y, p.x, p.y, CYAN, 2 + (C.BALL_R * i) / b.trail.length);
    }
    ctx.globalAlpha = dim ? 0.25 : 1;
    ctx.fillStyle = INK;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function hud(s: State, ctx: CanvasRenderingContext2D): void {
  text(ctx, "PLAYER 01", C.FIELD_CX - 155, 33, 11, CYAN);
  text(
    ctx,
    s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
    C.FIELD_CX + 155,
    33,
    11,
    CORAL,
  );
  text(ctx, String(s.score.p1), C.FIELD_CX - 155, 76, 50, CYAN, "center", 650);
  text(ctx, String(s.score.p2), C.FIELD_CX + 155, 76, 50, CORAL, "center", 650);
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN VS MACHINE" : "VERSUS / LOCAL DUEL",
    32,
    30,
    11,
    MUTED,
    "left",
  );
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    28,
    10,
    MUTED,
  );
  text(ctx, "P / ESC  PAUSE", C.FIELD_W - 32, 30, 11, MUTED, "right");
  text(ctx, "W / S", (C.P1_X0 + C.P1_X1) / 2, C.FIELD_H - 28, 11, CYAN);
  text(
    ctx,
    s.mode === "solo" ? "AI" : "↑ / ↓",
    (C.P2_X0 + C.P2_X1) / 2,
    C.FIELD_H - 52,
    11,
    CORAL,
  );
  text(
    ctx,
    "MOVE AT CONTACT TO BEND THE FLIGHT",
    C.FIELD_CX,
    C.FIELD_H - 24,
    10,
    MUTED,
  );
}
function menu(
  s: State,
  ctx: CanvasRenderingContext2D,
  items: readonly string[],
): void {
  items.forEach((item, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const selected = s.menuIndex === i;
    bar(ctx, r.x, r.y, r.w, r.h, selected ? "#69eee0" : "#14212d");
    if (!selected) {
      ctx.strokeStyle = "#2c3b48";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 6);
      ctx.stroke();
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 25,
      r.y + r.h / 2,
      10,
      selected ? "#22675f" : MUTED,
      "left",
    );
    text(
      ctx,
      item,
      r.x + r.w / 2,
      r.y + r.h / 2,
      15,
      selected ? "#0b2427" : INK,
      "center",
      650,
    );
    if (selected) text(ctx, "→", r.x + r.w - 27, r.y + r.h / 2, 20, "#0b2427");
  });
}
export function render(s: State, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  const live = s.screen === "playing" || s.screen === "countdown";
  court(s, ctx, !live);
  if (s.screen !== "title" && s.screen !== "howto") hud(s, ctx);
  if (live && s.screen === "countdown" && s.ball) {
    text(
      ctx,
      "GET READY",
      C.FIELD_CX,
      C.FIELD_CY - 93,
      13,
      CYAN,
      "center",
      650,
    );
    text(
      ctx,
      s.receiver === "left"
        ? "← SERVING TO PLAYER 01"
        : "SERVING TO PLAYER 02 →",
      C.FIELD_CX,
      C.FIELD_CY + 90,
      11,
      MUTED,
    );
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      C.FIELD_CX,
      C.FIELD_CY,
      34,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.max(0, s.ball.holdTimer / C.HOLD_TIME),
    );
    ctx.stroke();
  }
  if (s.screen === "title") {
    // Framed title panel lets the whole original court remain visible at the edges.
    bar(ctx, 390, 120, 500, 466, "#0b121bf2");
    text(
      ctx,
      "A GAME OF ANGLES & MOMENTUM",
      C.FIELD_CX,
      162,
      11,
      GOLD,
      "center",
      600,
    );
    text(ctx, C.TITLE_TEXT, C.FIELD_CX, 245, 100, INK, "center", 800);
    line(ctx, 485, 307, 795, 307, "#304251");
    text(ctx, "BEND THE RALLY. FIND YOUR ANGLE.", C.FIELD_CX, 329, 11, MUTED);
    menu(s, ctx, C.TITLE_ITEMS);
    text(ctx, "ONE PLAYER", 850, 387, 10, MUTED, "left");
    text(ctx, "TWO PLAYERS", 850, 453, 10, MUTED, "left");
    text(
      ctx,
      "W / S OR ↑ / ↓  SELECT     ENTER  PLAY",
      C.FIELD_CX,
      593,
      11,
      MUTED,
    );
    text(ctx, "01 / PADDLE DUEL", 32, 35, 11, CYAN, "left");
    text(ctx, "SPIN CHANGES EVERYTHING", 1248, 35, 11, MUTED, "right");
  }
  if (s.screen === "howto") {
    bar(ctx, 250, 95, 780, 565, "#0b121bf5");
    text(ctx, "LEARN THE ANGLES", C.FIELD_CX, 149, 12, GOLD);
    text(ctx, "HOW TO PLAY", C.FIELD_CX, 206, 44, INK, "center", 700);
    const rows = [
      [
        "01",
        "CONTROL THE COURT",
        "Solo: W / S or ↑ / ↓. Versus: left W / S, right ↑ / ↓.",
      ],
      [
        "02",
        "PUT SPIN ON IT",
        "Move your paddle as you strike. Up bends up; down bends down.",
      ],
      [
        "03",
        "PLAY THE BANK SHOT",
        "Amber obstacles reflect the ball. Turn a block into an opening.",
      ],
      [
        "04",
        "TAKE THE MATCH",
        `Score past the other paddle. First to ${C.WIN_SCORE}, with a ${C.WIN_LEAD}-point lead.`,
      ],
    ];
    rows.forEach(([n, title, copy], i) => {
      const y = 287 + i * 68;
      text(ctx, n, 302, y, 13, CYAN, "left");
      text(ctx, title, 348, y, 14, INK, "left", 650);
      text(ctx, copy, 348, y + 23, 13, MUTED, "left");
    });
    text(
      ctx,
      "P / ESC  PAUSE     M  SOUND     `  DIAGNOSTICS",
      C.FIELD_CX,
      564,
      11,
      MUTED,
    );
    menu(s, ctx, ["BACK TO MENU"]);
  }
  if (s.screen === "paused" || s.screen === "matchover") {
    bar(ctx, 390, 155, 500, 435, "#0b121bf5");
    text(
      ctx,
      s.screen === "paused" ? "TAKE A BREATHER" : "THE FINAL ANGLE",
      C.FIELD_CX,
      207,
      11,
      GOLD,
    );
    text(
      ctx,
      s.screen === "paused"
        ? "PAUSED"
        : s.winner === "left"
          ? "PLAYER 01 WINS"
          : s.mode === "solo"
            ? "COMPUTER WINS"
            : "PLAYER 02 WINS",
      C.FIELD_CX,
      267,
      s.screen === "paused" ? 62 : 35,
      INK,
      "center",
      750,
    );
    text(
      ctx,
      s.screen === "paused"
        ? "Your rally is right where you left it."
        : `${s.score.p1}  —  ${s.score.p2}`,
      C.FIELD_CX,
      317,
      16,
      MUTED,
    );
    menu(s, ctx, s.screen === "paused" ? C.PAUSE_ITEMS : C.MATCHOVER_ITEMS);
  }
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    C.FIELD_W - 32,
    C.FIELD_H - 24,
    10,
    MUTED,
    "right",
  );
  if (s.screen === "title" || s.screen === "howto")
    text(ctx, "CAROM / ORIGINAL ARCADE", 32, C.FIELD_H - 24, 10, MUTED, "left");
  ctx.restore();
}
