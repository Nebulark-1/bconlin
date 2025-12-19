import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * Snake (single-file React app)
 * - Arrow keys / WASD to move
 * - Space to pause/resume
 * - R to restart
 * - Optional on-screen D-pad for mobile
 *
 * Drop into a Vite + React project as App.jsx and run.
 */

const GRID_SIZE = 20; // 20x20
const TICK_MS_BASE = 110; // starting speed
const MIN_TICK_MS = 55; // fastest

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function keyToDir(e) {
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") return "up";
  if (k === "arrowdown" || k === "s") return "down";
  if (k === "arrowleft" || k === "a") return "left";
  if (k === "arrowright" || k === "d") return "right";
  return null;
}

function randCell(occupiedSet) {
  // Try random samples; fall back to scan.
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    const key = `${x},${y}`;
    if (!occupiedSet.has(key)) return { x, y };
  }
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = `${x},${y}`;
      if (!occupiedSet.has(key)) return { x, y };
    }
  }
  return null;
}

function buildOccupiedSet(snake) {
  const s = new Set();
  for (const p of snake) s.add(`${p.x},${p.y}`);
  return s;
}

function initialState() {
  const mid = Math.floor(GRID_SIZE / 2);
  const snake = [
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
    { x: mid - 3, y: mid },
  ];
  const occupied = buildOccupiedSet(snake);
  const food = randCell(occupied);
  return {
    snake,
    dir: "right",
    queuedDir: null,
    food,
    score: 0,
    best: Number(localStorage.getItem("snake_best") || 0),
    paused: false,
    gameOver: false,
    tickMs: TICK_MS_BASE,
  };
}

export default function App() {
  const [state, setState] = useState(() => initialState());

  const dirRef = useRef(state.dir);
  const queuedRef = useRef(state.queuedDir);
  const pausedRef = useRef(state.paused);
  const overRef = useRef(state.gameOver);

  useEffect(() => {
    dirRef.current = state.dir;
    queuedRef.current = state.queuedDir;
    pausedRef.current = state.paused;
    overRef.current = state.gameOver;
  }, [state.dir, state.queuedDir, state.paused, state.gameOver]);

  const occupied = useMemo(() => buildOccupiedSet(state.snake), [state.snake]);

  const restart = () => setState(() => initialState());

  const togglePause = () => {
    setState((s) => {
      if (s.gameOver) return s;
      return { ...s, paused: !s.paused };
    });
  };

  const requestTurn = (nextDir) => {
    if (!nextDir) return;
    setState((s) => {
      if (s.gameOver) return s;
      // Disallow immediate 180° turns.
      const current = s.dir;
      const queued = s.queuedDir;
      const effective = queued || current;
      if (OPPOSITE[effective] === nextDir) return s;
      return { ...s, queuedDir: nextDir };
    });
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePause();
        return;
      }
      const d = keyToDir(e);
      if (d) {
        e.preventDefault();
        requestTurn(d);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "r") {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Main game loop
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        if (s.paused || s.gameOver) return s;

        const dir = s.queuedDir || s.dir;
        const delta = DIRS[dir];
        const head = s.snake[0];
        const next = { x: head.x + delta.x, y: head.y + delta.y };

        // Wall collision
        if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
          return { ...s, gameOver: true };
        }

        // Build a set excluding the last tail cell IF we are moving without growing
        const willEat = s.food && next.x === s.food.x && next.y === s.food.y;
        const bodyToCheck = willEat ? s.snake : s.snake.slice(0, -1);
        const bodySet = buildOccupiedSet(bodyToCheck);
        if (bodySet.has(`${next.x},${next.y}`)) {
          return { ...s, gameOver: true };
        }

        let newSnake = [next, ...s.snake];
        let newFood = s.food;
        let newScore = s.score;
        let newTick = s.tickMs;

        if (willEat) {
          newScore = s.score + 1;
          // speed up gently
          newTick = clamp(TICK_MS_BASE - newScore * 3, MIN_TICK_MS, TICK_MS_BASE);

          const occ = buildOccupiedSet(newSnake);
          newFood = randCell(occ);
        } else {
          newSnake = newSnake.slice(0, -1);
        }

        let best = s.best;
        if (newScore > best) {
          best = newScore;
          try {
            localStorage.setItem("snake_best", String(best));
          } catch {
            // ignore
          }
        }

        return {
          ...s,
          snake: newSnake,
          dir,
          queuedDir: null,
          food: newFood,
          score: newScore,
          best,
          tickMs: newTick,
        };
      });
    }, state.tickMs);

    return () => clearInterval(id);
  }, [state.tickMs]);

  // Touch swipe controls (mobile)
  const touchRef = useRef(null);
  useEffect(() => {
    const el = touchRef.current;
    if (!el) return;

    let sx = 0,
      sy = 0,
      active = false;

    const onStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      active = true;
      sx = t.clientX;
      sy = t.clientY;
    };

    const onMove = (e) => {
      if (!active) return;
      const t = e.touches?.[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < 16 && ay < 16) return;

      active = false;
      if (ax > ay) requestTurn(dx > 0 ? "right" : "left");
      else requestTurn(dy > 0 ? "down" : "up");
    };

    const onEnd = () => {
      active = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cellSize = 18;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Snake</h1>
            <p className="text-slate-300 mt-1">
              Arrow keys / WASD to move • Space to pause • R to restart
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 px-4 py-2">
              <div className="text-xs text-slate-400">Score</div>
              <div className="text-xl font-semibold tabular-nums">{state.score}</div>
            </div>
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 px-4 py-2">
              <div className="text-xs text-slate-400">Best</div>
              <div className="text-xl font-semibold tabular-nums">{state.best}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
          {/* Board */}
          <div
            ref={touchRef}
            className="relative rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl overflow-hidden"
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              touchAction: "none",
            }}
          >
            {/* Subtle grid */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)",
                backgroundSize: `${100 / GRID_SIZE}% ${100 / GRID_SIZE}%`,
              }}
            />

            {/* Cells layer */}
            <div className="absolute inset-0">
              {/* Food */}
              {state.food && (
                <div
                  className="absolute rounded-full"
                  style={{
                    left: `${(state.food.x / GRID_SIZE) * 100}%`,
                    top: `${(state.food.y / GRID_SIZE) * 100}%`,
                    width: `${100 / GRID_SIZE}%`,
                    height: `${100 / GRID_SIZE}%`,
                    transform: "translate(0, 0)",
                    boxShadow: "0 0 18px rgba(248,113,113,0.45)",
                    background:
                      "radial-gradient(circle at 30% 30%, rgba(248,113,113,1), rgba(244,63,94,1))",
                  }}
                />
              )}

              {/* Snake */}
              {state.snake.map((p, idx) => {
                const isHead = idx === 0;
                const r = isHead ? "rounded-xl" : "rounded-lg";
                const base = isHead
                  ? "bg-emerald-400"
                  : idx % 2 === 0
                  ? "bg-emerald-300"
                  : "bg-emerald-200";

                return (
                  <div
                    key={`${p.x},${p.y},${idx}`}
                    className={`absolute ${r} ${base}`}
                    style={{
                      left: `${(p.x / GRID_SIZE) * 100}%`,
                      top: `${(p.y / GRID_SIZE) * 100}%`,
                      width: `${100 / GRID_SIZE}%`,
                      height: `${100 / GRID_SIZE}%`,
                      boxShadow: isHead
                        ? "0 10px 20px rgba(16,185,129,0.25)"
                        : "none",
                      opacity: isHead ? 1 : 0.95,
                    }}
                  />
                );
              })}
            </div>

            {/* Overlay */}
            {(state.paused || state.gameOver) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                <div className="text-center px-6">
                  <div className="text-2xl font-semibold">
                    {state.gameOver ? "Game Over" : "Paused"}
                  </div>
                  <div className="text-slate-300 mt-2">
                    {state.gameOver
                      ? "Press R to restart"
                      : "Press Space to resume"}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => (state.gameOver ? restart() : togglePause())}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-950 font-semibold hover:bg-white active:scale-[0.99] transition"
                    >
                      {state.gameOver ? "Restart" : "Resume"}
                    </button>
                    <button
                      onClick={restart}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-slate-100 hover:bg-slate-900/60 active:scale-[0.99] transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl p-4 flex flex-col gap-4">
            <div className="rounded-2xl bg-slate-950/40 border border-slate-800 p-4">
              <div className="text-sm text-slate-300">Speed</div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Fast</span>
                  <span>Slow</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-slate-100"
                    style={{
                      width: `${
                        ((TICK_MS_BASE - state.tickMs) / (TICK_MS_BASE - MIN_TICK_MS)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Eats speed you up a bit.
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/40 border border-slate-800 p-4">
              <div className="text-sm text-slate-300">Controls</div>
              <div className="text-xs text-slate-400 mt-2 leading-relaxed">
                • Move: Arrow keys / WASD<br />
                • Pause: Space<br />
                • Restart: R<br />
                • Mobile: swipe on board
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/40 border border-slate-800 p-4">
              <div className="text-sm text-slate-300">Quick actions</div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={togglePause}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-950 font-semibold hover:bg-white active:scale-[0.99] transition"
                >
                  {state.paused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={restart}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-700 text-slate-100 hover:bg-slate-900/60 active:scale-[0.99] transition"
                >
                  Restart
                </button>
              </div>
            </div>

            {/* D-pad */}
            <div className="rounded-2xl bg-slate-950/40 border border-slate-800 p-4">
              <div className="text-sm text-slate-300">D-pad</div>
              <div className="mt-3 grid grid-cols-3 gap-2 place-items-center">
                <div />
                <PadButton label="↑" onClick={() => requestTurn("up")} />
                <div />
                <PadButton label="←" onClick={() => requestTurn("left")} />
                <PadButton
                  label={state.paused ? "▶" : "⏸"}
                  onClick={togglePause}
                />
                <PadButton label="→" onClick={() => requestTurn("right")} />
                <div />
                <PadButton label="↓" onClick={() => requestTurn("down")} />
                <div />
              </div>
              <div className="text-xs text-slate-500 mt-3">
                Handy on touch devices.
              </div>
            </div>

            <div className="text-xs text-slate-600 mt-auto">
              Tip: avoid 180° turns — the game blocks them.
            </div>
          </div>
        </div>

        <footer className="mt-6 text-xs text-slate-500">
          Built as a single React component. Grid: {GRID_SIZE}×{GRID_SIZE} • Cell
          size: {cellSize}px (visual)
        </footer>
      </div>
    </div>
  );
}

function PadButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-12 h-12 rounded-2xl border border-slate-700 bg-slate-900/40 hover:bg-slate-900/70 active:scale-[0.98] transition flex items-center justify-center text-lg"
      aria-label={label}
      type="button"
    >
      {label}
    </button>
  );
}

createRoot(document.getElementById("root")).render(<App />)
