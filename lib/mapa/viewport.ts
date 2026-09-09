export interface MapCamera { cx: number; cy: number; z: number }
export interface MapWindow { x: number; y: number; width: number; height: number }

/** World-space coverage. Overscan stays mounted until the camera approaches
 * its edge, instead of churning image nodes on a repeating pan timer. */
export function cameraWindow(camera: MapCamera, w: number, h: number, margin = 0.3): MapWindow {
  const width = w / camera.z * (1 + margin * 2)
  const height = h / camera.z * (1 + margin * 2)
  return { x: camera.cx - width / 2, y: camera.cy - height / 2, width, height }
}

export function needsMapWindow(current: MapWindow | null, camera: MapCamera, w: number, h: number): boolean {
  if (!current) return true
  const next = cameraWindow(camera, w, h, 0.1)
  return next.x < current.x || next.y < current.y ||
    next.x + next.width > current.x + current.width ||
    next.y + next.height > current.y + current.height
}
