import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { stampServiceWorker } from './stamp-service-worker.mjs'

test('changed app entry updates the worker, identical rebuilds and repeated stamping stay stable', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'trainoracle-sw-'))
  try {
    const worker = 'self.addEventListener("fetch", () => {});\n'
    await writeFile(join(dist, 'sw.js'), worker)
    await writeFile(join(dist, 'index.html'), '<script src="assets/app-one.js"></script>')
    const first = await stampServiceWorker(dist)
    const firstBytes = await readFile(join(dist, 'sw.js'), 'utf8')
    assert.equal(await stampServiceWorker(dist), first)
    assert.equal(await readFile(join(dist, 'sw.js'), 'utf8'), firstBytes)
    await writeFile(join(dist, 'sw.js'), worker) // normal Vite public/ copy
    assert.equal(await stampServiceWorker(dist), first)
    assert.equal(await readFile(join(dist, 'sw.js'), 'utf8'), firstBytes)
    await writeFile(join(dist, 'index.html'), '<script src="assets/app-two.js"></script>')
    assert.notEqual(await stampServiceWorker(dist), first)
    assert.notEqual(await readFile(join(dist, 'sw.js'), 'utf8'), firstBytes)
  } finally {
    assert.equal(dirname(resolve(dist)), resolve(tmpdir()))
    assert.ok(basename(dist).startsWith('trainoracle-sw-'))
    await rm(dist, { recursive: true, force: true })
  }
})
