import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cameraWindow, needsMapWindow } from '@/lib/mapa/viewport'

test('a long sequence of small pan frames reuses coverage until the edge approaches', () => {
  const camera = { cx: 0, cy: 0, z: 0.25 }
  const covered = cameraWindow(camera, 1200, 800)
  for (let dx = 0; dx <= 230; dx++) {
    assert.equal(needsMapWindow(covered, { ...camera, cx: dx / camera.z }, 1200, 800), false)
  }
  assert.equal(needsMapWindow(covered, { ...camera, cx: 250 / camera.z }, 1200, 800), true)
})

test('coverage replenishes for every pan direction, zoom-out, and viewport enlargement', () => {
  const camera = { cx: -2000, cy: 1400, z: 0.5 }
  const covered = cameraWindow(camera, 1200, 800)
  for (const [dx, dy] of [[500, 0], [-500, 0], [0, 340], [0, -340]]) {
    assert.equal(needsMapWindow(covered, { ...camera, cx: camera.cx + dx, cy: camera.cy + dy }, 1200, 800), true)
  }
  assert.equal(needsMapWindow(covered, { ...camera, z: 0.2 }, 1200, 800), true)
  assert.equal(needsMapWindow(covered, { ...camera, z: 1 }, 1200, 800), false)
  assert.equal(needsMapWindow(covered, camera, 2000, 1200), true)
  assert.equal(needsMapWindow(null, camera, 1200, 800), true)
})

test('every replenished window contains the actual viewport and its look-ahead band', () => {
  for (const z of [0.06, 0.22, 0.5, 1, 1.6]) {
    const camera = { cx: -9200, cy: 1800, z }
    assert.equal(needsMapWindow(cameraWindow(camera, 1512, 890), camera, 1512, 890), false)
  }
})
