// Keyboard + mouse state, in world coordinates. The stage letterboxes the
// canvas, so main.ts supplies a screen→world transform via setViewport().

export interface InputState {
  mouseX: number
  mouseY: number
  mouseInside: boolean
  /** the player moved the mouse recently — mouse steering active */
  mouseFresh: boolean
  lmb: boolean
  rmb: boolean
  keys: Set<string>
  pressed: Set<string> // edge: cleared each frame
}

const state: InputState = {
  mouseX: 0,
  mouseY: 0,
  mouseInside: false,
  mouseFresh: false,
  lmb: false,
  rmb: false,
  keys: new Set(),
  pressed: new Set(),
}

let toWorld = (sx: number, sy: number) => ({ x: sx, y: sy })
let lastMouseMove = -1e9
let now = 0

export function setViewport(fn: (sx: number, sy: number) => { x: number; y: number }) {
  toWorld = fn
}

export function initInput(canvas: HTMLCanvasElement) {
  window.addEventListener('keydown', (e) => {
    // avoid hijacking browser shortcuts with modifiers
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.toLowerCase()
    if (!state.keys.has(k)) state.pressed.add(k)
    state.keys.add(k)
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
  })
  window.addEventListener('keyup', (e) => {
    state.keys.delete(e.key.toLowerCase())
  })
  window.addEventListener('blur', () => {
    state.keys.clear()
    state.lmb = false
    state.rmb = false
  })

  const onMove = (e: MouseEvent) => {
    const p = toWorld(e.clientX, e.clientY)
    state.mouseX = p.x
    state.mouseY = p.y
    state.mouseInside = true
    lastMouseMove = now
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mousedown', (e) => {
    onMove(e)
    if (e.button === 0) state.lmb = true
    if (e.button === 2) state.rmb = true
  })
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.lmb = false
    if (e.button === 2) state.rmb = false
  })
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  window.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) state.mouseInside = false
  })
}

/** call once per frame with game time; computes mouse freshness + clears edges at frame end */
export function tickInput(t: number) {
  now = t
  // keyboard steering takes over when used; mouse re-takes on movement
  state.mouseFresh = t - lastMouseMove < 2.0
}

export function endFrame() {
  state.pressed.clear()
}

export function input(): InputState {
  return state
}

export const keyDown = (...keys: string[]) => keys.some((k) => state.keys.has(k))
export const keyPressed = (...keys: string[]) => keys.some((k) => state.pressed.has(k))
