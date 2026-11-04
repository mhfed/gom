export type MacroEvent =
  | { type: "mousePress" | "mouseRelease" | "mouseMove"; x: number; y: number }
  | { type: "mouseWheel"; x: number; y: number; deltaX: number; deltaY: number }
  | {
      type: "mouseDown" | "mouseUp";
      x: number;
      y: number;
      button: "left";
      clickCount: number;
    }
  | {
      type: "keyDown" | "keyUp" | "char";
      keyCode: string;
      modifiers: Array<"shift" | "control" | "alt" | "meta">;
    };
export type MacroStep = { delay: number; event: MacroEvent };
export interface Macro {
  accountId: string;
  url: string;
  width: number;
  height: number;
  steps: MacroStep[];
  repeats?: number;
}
export const MACRO_MAX_STEPS = 500;
export const MACRO_MAX_DURATION = 120_000;
export const MACRO_MAX_PLAY_DURATION = 86_400_000;
export function validMacro(value: unknown): value is Macro {
  if (!value || typeof value !== "object") return false;
  const m = value as Macro;
  if (
    typeof m.accountId !== "string" ||
    !m.accountId ||
    m.accountId.length > 100 ||
    typeof m.url !== "string" ||
    m.url.length > 4096 ||
    !/^https?:\/\//.test(m.url) ||
    !Number.isSafeInteger(m.width) ||
    m.width < 1 ||
    m.width > 10000 ||
    !Number.isSafeInteger(m.height) ||
    m.height < 1 ||
    m.height > 10000 ||
    (m.repeats !== undefined &&
      (!Number.isSafeInteger(m.repeats) ||
        m.repeats < 1 ||
        m.repeats > 10000)) ||
    !Array.isArray(m.steps) ||
    !m.steps.length ||
    m.steps.length > MACRO_MAX_STEPS
  )
    return false;
  let duration = 0;
  let mouseDown = false;
  for (const step of m.steps) {
    if (
      !step ||
      !Number.isSafeInteger(step.delay) ||
      step.delay < 0 ||
      (duration += step.delay) > MACRO_MAX_PLAY_DURATION ||
      !step.event ||
      typeof step.event !== "object"
    )
      return false;
    const e = step.event;
    if (
      ["mousePress", "mouseRelease", "mouseMove", "mouseWheel"].includes(e.type)
    ) {
      const pointer = e as
        | Extract<
            MacroEvent,
            { type: "mousePress" | "mouseRelease" | "mouseMove" }
          >
        | Extract<MacroEvent, { type: "mouseWheel" }>;
      if (
        !Number.isSafeInteger(pointer.x) ||
        pointer.x < 0 ||
        pointer.x >= m.width ||
        !Number.isSafeInteger(pointer.y) ||
        pointer.y < 0 ||
        pointer.y >= m.height
      )
        return false;
      if (pointer.type === "mousePress") {
        if (mouseDown) return false;
        mouseDown = true;
      }
      if (pointer.type === "mouseRelease") {
        if (!mouseDown) return false;
        mouseDown = false;
      }
      if (pointer.type === "mouseMove" && !mouseDown) return false;
      if (
        pointer.type === "mouseWheel" &&
        (!Number.isFinite(pointer.deltaX) ||
          !Number.isFinite(pointer.deltaY) ||
          Math.abs(pointer.deltaX) > 10000 ||
          Math.abs(pointer.deltaY) > 10000)
      )
        return false;
    } else if (e.type === "mouseDown") {
      if (
        !Number.isSafeInteger(e.x) ||
        e.x < 0 ||
        e.x >= m.width ||
        !Number.isSafeInteger(e.y) ||
        e.y < 0 ||
        e.y >= m.height ||
        e.button !== "left" ||
        e.clickCount !== 1
      )
        return false;
    } else if (e.type === "keyDown") {
      if (
        typeof e.keyCode !== "string" ||
        !e.keyCode ||
        e.keyCode.length > 32 ||
        !Array.isArray(e.modifiers) ||
        e.modifiers.length > 4 ||
        !e.modifiers.every((v) =>
          ["shift", "control", "alt", "meta"].includes(v),
        )
      )
        return false;
    } else return false;
  }
  return !mouseDown;
}
export function macroWheelEvent(
  value: unknown,
  width: number,
  height: number,
): Extract<MacroEvent, { type: "mouseWheel" }> | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const { x, y, deltaX, deltaY, deltaMode } = data;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height ||
    typeof deltaX !== "number" ||
    typeof deltaY !== "number" ||
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    ![0, 1, 2].includes(deltaMode as number)
  )
    return null;
  const factor = deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1;
  const dx = -deltaX * factor,
    dy = -deltaY * factor;
  if (Math.abs(dx) > 10000 || Math.abs(dy) > 10000 || (!dx && !dy)) return null;
  return {
    type: "mouseWheel",
    x: Math.floor(x),
    y: Math.floor(y),
    deltaX: dx || 0,
    deltaY: dy || 0,
  };
}
export function withMacroDelays(macro: Macro, delays: unknown): Macro | null {
  if (
    !validMacro(macro) ||
    !Array.isArray(delays) ||
    delays.length !== macro.steps.length ||
    !delays.every((delay) => Number.isSafeInteger(delay) && delay >= 0)
  )
    return null;
  const result = structuredClone(macro);
  result.steps.forEach((step, index) => {
    step.delay = delays[index];
  });
  return validMacro(result) ? result : null;
}
export class MacroRecorder {
  private steps: MacroStep[] = [];
  private started = 0;
  private last = 0;
  private active = false;
  private clock: () => number;
  constructor(clock: () => number) {
    this.clock = clock;
  }
  start() {
    this.steps = [];
    this.started = this.last = this.clock();
    this.active = true;
  }
  record(event: MacroEvent): boolean {
    const now = this.clock();
    if (
      !this.active ||
      now < this.last ||
      now - this.started > MACRO_MAX_DURATION ||
      this.steps.length >= MACRO_MAX_STEPS
    )
      return false;
    this.steps.push({
      delay: Math.floor(now - this.last),
      event: structuredClone(event),
    });
    this.last = now;
    return true;
  }
  finish(): MacroStep[] {
    this.active = false;
    const result = this.steps;
    this.steps = [];
    return result;
  }
  cancel() {
    this.active = false;
    this.steps = [];
  }
}
export class MacroPlayer {
  running = false;
  private generation = 0;
  private timer: unknown;
  private env: {
    schedule(fn: () => void, delay: number): unknown;
    cancel(timer: unknown): void;
    valid(): boolean;
    send(event: MacroEvent): void;
    changed(running: boolean, complete: boolean): void;
  };
  constructor(env: MacroPlayer["env"]) {
    this.env = env;
  }
  start(steps: MacroStep[], repeats: number): boolean {
    if (
      !steps.length ||
      steps.length > MACRO_MAX_STEPS ||
      !Number.isSafeInteger(repeats) ||
      repeats < 1 ||
      repeats > 10000
    )
      return false;
    this.stop();
    const copy = structuredClone(steps);
    let index = 0;
    let round = 0;
    const gen = ++this.generation;
    this.running = true;
    const tick = () => {
      if (!this.running || this.generation !== gen) return;
      if (!this.env.valid()) {
        this.stop();
        return;
      }
      try {
        this.env.send(copy[index].event);
      } catch {
        this.stop();
        return;
      }
      if (++index === copy.length) {
        index = 0;
        if (++round === repeats) {
          this.stop(true);
          return;
        }
      }
      this.timer = this.env.schedule(tick, copy[index].delay);
    };
    this.env.changed(true, false);
    this.timer = this.env.schedule(tick, copy[0].delay);
    return true;
  }
  stop(complete = false) {
    const was = this.running;
    this.running = false;
    this.generation++;
    if (this.timer !== undefined) this.env.cancel(this.timer);
    this.timer = undefined;
    if (was) this.env.changed(false, complete);
  }
}
