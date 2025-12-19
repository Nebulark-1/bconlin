import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./src/snake.css";

/**
 * Snake (no Tailwind)
 * - Arrow keys / WASD to move
 * - Space to pause/resume
 * - R to restart
 * - Mobile: swipe on board
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

function App() {
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

  useMemo(() => buildOccupiedSet(state.snake), [state.snake]); // keeps parity w/ old code (not strictly needed)

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
        if (
          next.x < 0 ||
          next.x >= GRID_SIZE ||
          next.y < 0 ||
          next.y >= GRID_SIZE
        ) {
          return { ...s, gameOver: true };
        }

        // Self collision (exclude tail if not growing)
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

  const speedPct =
    ((TICK_MS_BASE - state.tickMs) / (TICK_MS_BASE - MIN_TICK_MS)) * 100;

  return (
    <div className="container">
      <div className="wrap">
        <div className="header">
          <div>
            <div className="title">Snake</div>
            <div className="sub">
              Arrow keys / WASD to move • Space to pause • R to restart
            </div>
          </div>

          <div className="scoreRow">
            <div className="card">
              <div className="cardLabel">Score</div>
              <div className="cardVal">{state.score}</div>
            </div>
            <div className="card">
              <div className="cardLabel">Best</div>
              <div className="cardVal">{state.best}</div>
            </div>
          </div>
        </div>

        <div className="mainGrid">
          {/* Board */}
          <div
            ref={touchRef}
            className="board"
            style={{ width: "100%", aspectRatio: "1 / 1", touchAction: "none" }}
          >
            {/* Subtle grid */}
            <div
              className="gridOverlay"
              style={{
                backgroundSize: `${100 / GRID_SIZE}% ${100 / GRID_SIZE}%`,
              }}
            />

            {/* Cells layer */}
            <div className="layer">
              {/* Food */}
              {state.food && (
                <div
                  style={{
                    position: "absolute",
                    left: `${(state.food.x / GRID_SIZE) * 100}%`,
                    top: `${(state.food.y / GRID_SIZE) * 100}%`,
                    width: `${100 / GRID_SIZE}%`,
                    height: `${100 / GRID_SIZE}%`,
                    borderRadius: 999,
                    boxShadow: "0 0 18px rgba(248,113,113,0.45)",
                    background:
                      "radial-gradient(circle at 30% 30%, rgba(248,113,113,1), rgba(244,63,94,1))",
                  }}
                />
              )}

              {/* Snake */}
              {state.snake.map((p, idx) => {
                const isHead = idx === 0;
                const radius = isHead ? 14 : 12;

                const fill = isHead
                  ? "#34d399"
                  : idx % 2 === 0
                  ? "#6ee7b7"
                  : "#a7f3d0";

                return (
                  <div
                    key={`${p.x},${p.y},${idx}`}
                    style={{
                      position: "absolute",
                      left: `${(p.x / GRID_SIZE) * 100}%`,
                      top: `${(p.y / GRID_SIZE) * 100}%`,
                      width: `${100 / GRID_SIZE}%`,
                      height: `${100 / GRID_SIZE}%`,
                      borderRadius: radius,
                      background: fill,
                      boxShadow: isHead
                        ? "0 10px 20px rgba(16,185,129,0.25)"
                        : "none",
                      opacity: isHead ? 1 : 0.96,
                    }}
                  />
                );
              })}
            </div>

            {/* Overlay */}
            {(state.paused || state.gameOver) && (
              <div className="overlay">
                <div className="overlayInner">
                  <div className="overlayTitle">
                    {state.gameOver ? "Game Over" : "Paused"}
                  </div>
                  <div className="overlaySub">
                    {state.gameOver
                      ? "Press R to restart"
                      : "Press Space to resume"}
                  </div>
                  <div className="btnRow">
                    <button
                      onClick={() =>
                        state.gameOver ? restart() : togglePause()
                      }
                      className="btnPrimary"
                    >
                      {state.gameOver ? "Restart" : "Resume"}
                    </button>
                    <button onClick={restart} className="btnGhost">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="side">
            <div className="panel">
              <div className="panelTitle">Speed</div>
              <div className="barWrap">
                <div
                  className="barFill"
                  style={{ width: `${clamp(speedPct, 0, 100)}%` }}
                />
              </div>
              <div className="muted">Eats speed you up a bit.</div>
            </div>

            <div className="panel">
              <div className="panelTitle">Controls</div>
              <div className="muted">
                • Move: Arrow keys / WASD
                <br />
                • Pause: Space
                <br />
                • Restart: R
                <br />
                • Mobile: swipe on board
              </div>
            </div>

            <div className="panel">
              <div className="panelTitle">Quick actions</div>
              <div className="quickRow">
                <button onClick={togglePause} className="btnPrimary">
                  {state.paused ? "Resume" : "Pause"}
                </button>
                <button onClick={restart} className="btnGhost">
                  Restart
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panelTitle">D-pad</div>
              <div className="dpad">
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
              <div className="muted">Handy on touch devices.</div>
            </div>

            <div className="muted">Tip: avoid 180° turns — the game blocks them.</div>
          </div>
        </div>

        <div className="footer">
          Built as a single React component. Grid: {GRID_SIZE}×{GRID_SIZE}
        </div>
      </div>
    </div>
  );
}

function PadButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="padBtn" aria-label={label} type="button">
      {label}
    </button>
  );
}

createRoot(document.getElementById("root")).render(<App />);
