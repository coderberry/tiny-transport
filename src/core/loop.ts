/**
 * Fixed-timestep game loop. Simulation ticks at TICK_RATE regardless of
 * frame rate; rendering interpolates between the last two tick states via
 * `alpha` ∈ [0, 1].
 */
export const TICK_RATE = 10
export const TICK_DT = 1 / TICK_RATE

/** Backlog cap: beyond this we drop time instead of spiraling. */
const MAX_TICKS_PER_FRAME = 50

export interface LoopHooks {
  tick(dt: number): void
  render(alpha: number, fps: number): void
}

export interface GameLoop {
  getSpeed(): number
  setSpeed(speed: number): void
}

export function startLoop(hooks: LoopHooks): GameLoop {
  let speed = 1
  let acc = 0
  let last = performance.now()
  let fps = 60

  const frame = (now: number) => {
    // Hidden tabs throttle timers to ~1 fire/sec; a 1s clamp keeps the sim
    // real-time there while still refusing to fast-forward longer gaps.
    const elapsed = Math.min((now - last) / 1000, 1)
    last = now
    if (elapsed > 0) fps = fps * 0.95 + (1 / elapsed) * 0.05

    acc += elapsed * speed
    let ticks = 0
    while (acc >= TICK_DT && ticks < MAX_TICKS_PER_FRAME) {
      hooks.tick(TICK_DT)
      acc -= TICK_DT
      ticks++
    }
    if (ticks === MAX_TICKS_PER_FRAME) acc = 0

    hooks.render(speed === 0 ? 1 : Math.min(acc / TICK_DT, 1), fps)
    schedule()
  }

  // rAF stalls in hidden tabs and headless contexts, so race it against a
  // timer; whichever fires first drives the frame and cancels the other.
  const schedule = () => {
    let done = false
    const run = () => {
      if (done) return
      done = true
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
      frame(performance.now())
    }
    const rafId = requestAnimationFrame(run)
    const timerId = setTimeout(run, 50)
  }

  schedule()

  return {
    getSpeed: () => speed,
    setSpeed: (s: number) => {
      speed = s
    },
  }
}
