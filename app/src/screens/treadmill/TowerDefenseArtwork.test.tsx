import {cleanup,fireEvent,render} from '@testing-library/react'
import {afterEach,describe,expect,it} from 'vitest'
import {TDArtwork,TDSprite} from './TowerDefenseArtwork'

afterEach(cleanup)
describe('tower defense artwork recovery',()=>{
 it('keeps the previous HTML artwork when the new image fails',()=>{
  const {container}=render(<TDArtwork id="td-rapid-tower" size={64} fallbackTile={249}/>)
  const primary=container.querySelector('img[src*="image-library-v1"]')!
  expect(container.querySelector('img[src*="kenney-td"]')).not.toBeNull()
  fireEvent.error(primary)
  expect(container.querySelector('img[src*="image-library-v1"]')).toBeNull()
  expect(container.querySelector('img[src*="kenney-td"]')).not.toBeNull()
 })
 it('replaces a loaded tower and restores fallback while its upgraded image loads',()=>{
  const {container,rerender}=render(<TDArtwork id="td-rapid-tower" size={64} fallbackTile={249}/>)
  fireEvent.load(container.querySelector('img[src*="image-library-v1"]')!)
  expect(container.querySelector('img[src*="kenney-td"]')).toBeNull()
  rerender(<TDArtwork id="td-rapid-tower-upgraded" size={64} fallbackTile={249}/>)
  expect(container.querySelector('img[src*="kenney-td"]')).not.toBeNull()
  fireEvent.load(container.querySelector('img[src*="image-library-v1"]')!)
  expect(container.querySelector('img[src*="kenney-td"]')).toBeNull()
 })
 it('retains SVG geometry on failure and replaces it only after successful load',()=>{
  const {container,rerender}=render(<svg><TDSprite id="td-enemy-scout" x={0} y={0} width={160} fallback={<circle data-testid="old-geometry" r="22"/>}/></svg>)
  fireEvent.error(container.querySelector('image')!)
  expect(container.querySelector('[data-testid="old-geometry"]')).not.toBeNull()
  rerender(<svg><TDSprite id="td-enemy-armored" x={0} y={0} width={160} fallback={<circle data-testid="old-geometry" r="22"/>}/></svg>)
  fireEvent.load(container.querySelector('image')!)
  expect(container.querySelector('[data-testid="old-geometry"]')).toBeNull()
 })
})
