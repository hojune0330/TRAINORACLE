// This loader does not need a DOM. Use Node's runner to avoid starting jsdom workers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

test('scene art shares loads, isolates failures, and anchors to the floor', async () => {
  const source = await readFile(new URL('../src/screens/treadmill/scene-art.ts', import.meta.url), 'utf8')
  const code = stripTypeScriptTypes(source.replace('import.meta.env.BASE_URL', '"/"'))
  const original = globalThis.Image, images = [], calls = []
  globalThis.Image = class {
    naturalWidth = 200; naturalHeight = 300; src = ''
    onload = () => {}; onerror = () => {}
    constructor() { images.push(this) }
  }
  try {
    const art = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const pending = art.loadSceneArt(), ctx = { drawImage: (...args) => calls.push(args) }
    assert.equal(art.loadSceneArt(), pending)
    assert.equal(art.drawSceneProp(ctx, 'tree', 30, 80, 20, 40), false)
    images[0].onload()
    images[1].naturalWidth = 0; images[1].onload()
    images.slice(2).forEach(image => image.onerror())
    await pending
    assert.equal(art.drawSceneProp(ctx, 'tree', 30, 80, 20, 40), true)
    assert.deepEqual(calls[0], [images[0], 20, 40, 20, 40])
    assert.equal(art.drawSceneProp(ctx, 'rock', 30, 80, 20, 40), false)
    assert.equal(art.drawSceneProp(ctx, 'hurdle', 30, 80, 20, 40), false)
  } finally {
    if (original === undefined) delete globalThis.Image
    else globalThis.Image = original
  }
})
