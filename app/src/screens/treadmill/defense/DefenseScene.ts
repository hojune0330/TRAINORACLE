import Phaser from 'phaser'
import {TD_PATH, TD_PADS, TD_TOWERS, routePoint, towerStats} from '../../../domain/minigame/tower-defense'
import type {TowerDefense, TowerKind, EnemyKind} from '../../../domain/minigame/tower-defense'
import {FIELD_WIDTH, FIELD_HEIGHT, FIELD_UNIT, FIELD_Y_UNIT, fieldPoint, directionFrame} from './coordinates'
import {readDefensePalette} from './palette'
import type {DefensePalette} from './palette'

export type DefenseBridge = {
 state: () => TowerDefense | null
 selected: () => number
 paused: () => boolean
 reduced: () => boolean
 sound: () => boolean
 ready: (missing: string[]) => void
}
type Actor = {image: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse}
const kinds = ['rapid', 'cannon', 'frost', 'scout', 'swift', 'armored', 'boss'] as const
const base = import.meta.env.BASE_URL
const asset = (name: string) => `${base}game/${name}`

/** Presentation only. The fixed-step domain owns movement, hits, money and victory.
 * Phaser supplies texture sharing, scenes, camera, WebGL/Canvas fallback and sound.
 * The launch/flight/impact/death separation follows the documented Outpost study. */
export class DefenseScene extends Phaser.Scene {
 private bridge: DefenseBridge
 private palette: DefensePalette
 private missing: string[] = []
 private enemies = new Map<number, Actor>()
 private enemyDirections = new Map<number, number>()
 private towers = new Map<number, Actor>()
 private lastBuild = new Map<number, string>()
 private buildAt = new Map<number, number>()
 private effects!: Phaser.GameObjects.Graphics
 private health!: Phaser.GameObjects.Graphics
 private range!: Phaser.GameObjects.Graphics
 private corpse = new Map<number, Phaser.GameObjects.Image>()
 private damageText = new Map<number, Phaser.GameObjects.Text>()
 private seenEvents = new Set<number>()
 private lastSound = 0
 private lastShotSound = new Map<number, number>()
 private frameCount = 0
 private stamp = 0
 private lastState: TowerDefense | null = null
 private endedAt = 0

 constructor(bridge: DefenseBridge, palette: DefensePalette) { super('forest-defense'); this.bridge = bridge; this.palette = palette }
 preload() {
  this.load.on('loaderror', (file: Phaser.Loader.File) => this.missing.push(file.key))
  for (const kind of kinds) {
   this.load.spritesheet(kind, asset(`defense-v5/${kind}-atlas.webp`), {frameWidth: 128, frameHeight: 128})
   this.load.image(`${kind}-fallback`, asset(`kenney-td/tile${kind in TD_TOWERS ? TD_TOWERS[kind as TowerKind].tile : ({scout:245,swift:247,armored:246,boss:248} as const)[kind as EnemyKind]}.png`))
  }
  for (const kind of ['scout','swift','armored','boss']) this.load.spritesheet(`${kind}-reactions`, asset(`defense-v5/${kind}-reactions.webp`), {frameWidth:128,frameHeight:128})
  this.load.image('tree', asset('seoul-v1/tree.webp'))
  this.load.image('rock', asset('seoul-v1/rock.webp'))
  this.load.image('base', asset('defense-v4/base.webp'))
  for (const id of ['shot', 'impact', 'build']) this.load.audio(`sound-${id}`, asset(`defense-audio/${id}.wav`))
 }
 create() {
  this.makeFallbacks()
  this.paintGround()
  this.range = this.add.graphics().setDepth(2)
  this.health = this.add.graphics().setDepth(1500)
  this.effects = this.add.graphics().setDepth(1600)
  this.game.canvas.setAttribute('data-defense-renderer', this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas')
  this.game.canvas.setAttribute('aria-hidden', 'true')
  this.bridge.ready(this.missing)
 }
 private makeFallbacks() {
  for (const kind of kinds) {
   if (this.textures.exists(kind) || this.textures.exists(`${kind}-fallback`)) continue
   const g = this.add.graphics()
   const tower = kind in TD_TOWERS
   g.fillStyle(tower ? this.palette.color[kind as TowerKind] : kind === 'boss' ? this.palette.color.boss : this.palette.color.enemy)
   g.fillRoundedRect(25, 20, 78, 80, tower ? 18 : 35)
   g.lineStyle(5, this.palette.color.outline).strokeRoundedRect(25, 20, 78, 80, tower ? 18 : 35)
   g.fillStyle(this.palette.color.white).fillCircle(48, 48, 8).fillCircle(80, 48, 8)
   g.fillStyle(this.palette.color.outline).fillCircle(50, 48, 4).fillCircle(82, 48, 4)
   g.generateTexture(`${kind}-fallback`, 128, 128); g.destroy()
  }
 }
 private paintGround() {
  const g = this.add.graphics().setDepth(0)
  g.fillStyle(this.palette.color.ground).fillRect(0,0,FIELD_WIDTH,FIELD_HEIGHT)
  g.fillStyle(this.palette.color.grass).fillRoundedRect(24,24,1152,1250,80)
  // Quiet planted islands, not a busy repeated tile texture underneath enemies.
  for (let i = 0; i < 40; i++) {
   const x = (i * 173 + 67) % FIELD_WIDTH, y = (i * 277 + 43) % FIELD_HEIGHT
   g.fillStyle(i % 2 ? this.palette.color.grassLight : this.palette.color.grassShade, .45).fillEllipse(x,y,120+(i%3)*50,60)
  }
  const points = TD_PATH.map(fieldPoint)
  g.lineStyle(108, this.palette.color.pathEdge, 1).strokePoints(points, false)
  g.lineStyle(98, this.palette.color.pathBorder, 1).strokePoints(points, false)
  g.lineStyle(78, this.palette.color.path, 1).strokePoints(points, false)
  g.lineStyle(56, this.palette.color.pathLight, 1).strokePoints(points, false)
  for (let d = 0; d < 27; d += .55) {
   const p = fieldPoint(routePoint(d)); g.fillStyle(this.palette.color.pathDetail, .35).fillEllipse(p.x+Math.sin(d*7)*17,p.y+Math.cos(d*4)*15,9,5)
  }
  for (const [i,p] of TD_PADS.entries()) {
   const f = fieldPoint(p)
   g.fillStyle(this.palette.color.foundationShadow,.32).fillEllipse(f.x,f.y+12,112,68)
   g.fillStyle(this.palette.color.foundation).fillEllipse(f.x,f.y,110,66)
   g.lineStyle(5,this.palette.color.foundationBorder).strokeEllipse(f.x,f.y,110,66)
   this.add.text(f.x, f.y, '+', {fontFamily:this.palette.fontFamily,fontSize:'30px',color:this.palette.css.foundationInk,fontStyle:'bold'}).setOrigin(.5).setDepth(1)
  }
  const decor = [[.7,.5,1.1],[2.2,.5,.8],[4.5,.7,1.2],[6.2,.6,.8],[8,.7,.7],[11.3,.8,1],[.6,4.4,.8],[.7,8.6,1.2],[2.2,9.2,1],[5.8,9,.9],[7.8,8.8,1.1],[9.4,9.2,.7],[11.4,9.6,1]]
  for (const [x,y,s] of decor) {
   const p = fieldPoint({x:x!,y:y!})
   if (this.textures.exists('tree')) this.add.image(p.x,p.y,'tree').setDisplaySize(155*s!,155*s!).setOrigin(.5,.8).setDepth(p.y/2)
  }
  for (const p of [{x:4.4,y:1.3},{x:6,y:3.1},{x:1,y:7.9},{x:9.1,y:8.1}]) {
   const f=fieldPoint(p);if(this.textures.exists('rock'))this.add.image(f.x,f.y,'rock').setDisplaySize(78,78).setOrigin(.5,.8).setDepth(1)
  }
  const exit = fieldPoint({x:11.6,y:8})
  if(this.textures.exists('base'))this.add.image(exit.x,exit.y-25,'base').setDisplaySize(180,180).setOrigin(.5,.75).setDepth(exit.y)
  this.add.text(30,170,'침입 경로 →',{fontFamily:this.palette.fontFamily,fontSize:'25px',color:this.palette.css.label,fontStyle:'bold'}).setDepth(5)
  this.add.text(1060,1110,'기지',{fontFamily:this.palette.fontFamily,fontSize:'25px',color:this.palette.css.label,fontStyle:'bold'}).setDepth(5)
 }
 private actor(kind: TowerKind | EnemyKind, x:number, y:number, size:number): Actor {
  const texture=this.textures.exists(kind)?kind:`${kind}-fallback`
  return {shadow:this.add.ellipse(x,y+8,size*.48,size*.18,this.palette.color.shadow,.22),image:this.add.image(x,y,texture,0).setOrigin(.5,.68).setDisplaySize(size,size)}
 }
 private frame(actor: Actor, kind: TowerKind | EnemyKind, angle:number, row:number) {
  if(this.textures.exists(kind))actor.image.setTexture(kind,row*8+directionFrame(angle))
  else if(kind in TD_TOWERS)actor.image.setRotation(angle+Math.PI/2)
 }
 private playSound(id:string, volume:number) {
  if(!this.bridge.sound()||!this.cache.audio.exists(`sound-${id}`))return
  this.sound.play(`sound-${id}`, {volume})
 }
 update(now:number) {
  const s=this.bridge.state();if(!s)return
  // A fresh run has time 0; remove all retained objects and event IDs from the previous run.
  if(this.lastState && this.lastState!==s) this.clearActors()
  this.lastState=s;this.stamp=s.time
  if(s.phase==='lost'&&!this.endedAt)this.endedAt=now
  const effectTime=s.time+(s.phase==='lost'?(now-this.endedAt)/1000:0)
  this.frameCount++
  if(this.frameCount%30===0){this.game.canvas.dataset.frames=String(this.frameCount);this.game.canvas.dataset.enemies=String(s.enemies.length);this.game.canvas.dataset.projectiles=String(s.shots.length)}
  const reduced=this.bridge.reduced(),paused=this.bridge.paused()
  this.range.clear();this.effects.clear();this.health.clear()
  const selected=this.bridge.selected(),active=s.towers.find(t=>t.pad===selected),pad=fieldPoint(TD_PADS[selected]!)
  if(active) {
   const r=towerStats(active).range*FIELD_UNIT,ry=towerStats(active).range*FIELD_Y_UNIT
   this.range.fillStyle(this.palette.color.range,.12).fillEllipse(pad.x,pad.y,r*2,ry*2).lineStyle(3,this.palette.color.range,.8).strokeEllipse(pad.x,pad.y,r*2,ry*2)
  }
  this.range.lineStyle(8,this.palette.color.selection,1).strokeEllipse(pad.x,pad.y+3,116,72)
  for(const t of s.towers) {
   const p=fieldPoint(TD_PADS[t.pad]!),key=`${t.kind}-${t.level}`
   let a=this.towers.get(t.pad)
   if(!a){a=this.actor(t.kind,p.x,p.y,212);this.towers.set(t.pad,a)}
   if(this.lastBuild.get(t.pad)!==key){this.lastBuild.set(t.pad,key);this.buildAt.set(t.pad,now);if(!paused)this.playSound('build',.18)}
   const since=effectTime-(t.lastFiredAt??-10)
   if(t.lastFiredAt!==undefined && this.lastShotSound.get(t.pad)!==t.lastFiredAt){this.lastShotSound.set(t.pad,t.lastFiredAt);if(!paused&&now-this.lastSound>65){this.playSound('shot',t.kind==='rapid'?.04:.08);this.lastSound=now}}
   const row=since<.07?1:since<.14?2:0
   const aim=Math.atan2(-Math.cos(t.angle)*FIELD_Y_UNIT,Math.sin(t.angle)*FIELD_UNIT)
   this.frame(a,t.kind,aim,reduced?0:row)
   a.image.setDepth(p.y+4);a.shadow.setDepth(p.y-1)
   const recoil=reduced?0:Math.max(0,1-since/.14)*5
   a.image.setPosition(p.x-Math.cos(aim)*recoil,p.y-Math.sin(aim)*recoil)
   if(since<.07) {
    const muzzle={x:p.x+Math.cos(aim)*46,y:p.y+Math.sin(aim)*46}
    this.effects.fillStyle(this.palette.color[t.kind],.9).fillCircle(muzzle.x,muzzle.y,t.kind==='cannon'?18:10)
   }
   // Level pips express an actual upgrade, without covering the silhouette.
   for(let j=0;j<t.level;j++)this.health.fillStyle(this.palette.color.level).fillCircle(p.x+(j-(t.level-1)/2)*14,p.y+29,5)
   const age=(now-(this.buildAt.get(t.pad)??-1000))/600
   if(age<1&&!reduced)this.effects.lineStyle(5,this.palette.color.level,1-age).strokeEllipse(p.x,p.y,100+age*90,60+age*45)
  }
  for(const [id,a] of this.towers)if(!s.towers.some(t=>t.pad===id)){a.image.destroy();a.shadow.destroy();this.towers.delete(id);this.lastBuild.delete(id)}
  for(const e of s.enemies) {
   const p=fieldPoint(routePoint(e.distance)),ahead=fieldPoint(routePoint(e.distance+.08))
   const size=e.kind==='boss'?224:e.kind==='armored'?172:148
   let a=this.enemies.get(e.id);if(!a){a=this.actor(e.kind,p.x,p.y,size);this.enemies.set(e.id,a)}
   const cadence=(e.kind==='swift'?12:e.kind==='boss'?6:e.kind==='armored'?8:10)*(e.slowUntil>s.time?.65:1)
   const row=reduced?0:Math.floor(s.time*cadence+e.id)%6
   const angle=Math.atan2(ahead.y-p.y,ahead.x-p.x),direction=directionFrame(angle)
   this.enemyDirections.set(e.id,direction)
   this.frame(a,e.kind,angle,row)
   a.image.setPosition(p.x,p.y).setDepth(p.y+5);a.shadow.setPosition(p.x,p.y+6).setDepth(p.y-2)
   const hitAge=effectTime-(e.lastHitAt??-10),hit=hitAge<.15
   if(hit&&this.textures.exists(`${e.kind}-reactions`)&&!reduced)a.image.setTexture(`${e.kind}-reactions`,(hitAge<.07?0:1)*8+direction)
   if(hitAge<.06)a.image.setTintFill(this.palette.color.hit);else if(e.slowUntil>s.time)a.image.setTint(this.palette.color.slow);else a.image.clearTint()
   if(e.hp<e.maxHp||e.kind==='boss') {
    const width=e.kind==='boss'?96:60,y=p.y-size*.69
    this.health.fillStyle(this.palette.color.healthBackground,.9).fillRoundedRect(p.x-width/2-2,y-2,width+4,10,4)
    this.health.fillStyle(e.kind==='boss'?this.palette.color.bossHealth:this.palette.color.health).fillRoundedRect(p.x-width/2,y,width*Math.max(0,e.hp/e.maxHp),6,3)
   }
   if(e.slowUntil>s.time)this.effects.lineStyle(3,this.palette.color.slowRing,.75).strokeEllipse(p.x,p.y+5,65,28)
  }
  for(const [id,a] of this.enemies)if(!s.enemies.some(e=>e.id===id)){a.image.destroy();a.shadow.destroy();this.enemies.delete(id)}
  for(const shot of s.shots) {
   const p=fieldPoint(shot.position??shot.from),from=fieldPoint(shot.from),to=fieldPoint(shot.to)
   const fraction=shot.duration?Math.min(1,(shot.elapsed??0)/shot.duration):0
   const lift=shot.kind==='cannon'?Math.sin(fraction*Math.PI)*65:0
   const angle=Math.atan2(to.y-from.y,to.x-from.x)
   // The simulation point is the tower pivot; project the weapon's forward socket
   // into the flight, converging exactly to the domain impact point on arrival.
   p.x+=Math.cos(angle)*46*(1-fraction);p.y+=Math.sin(angle)*46*(1-fraction)
   this.effects.lineStyle(shot.kind==='cannon'?7:5,this.palette.color[shot.kind],.55).lineBetween(p.x-Math.cos(angle)*22,p.y-lift-Math.sin(angle)*22,p.x,p.y-lift)
   this.effects.fillStyle(this.palette.color.white,.95).fillCircle(p.x,p.y-lift,shot.kind==='cannon'?9:5)
   if(shot.kind==='cannon')this.effects.fillStyle(this.palette.color.projectileShadow,.15).fillEllipse(p.x,p.y+4,18,8)
  }
  const liveEvents=new Set<number>()
  for(const ev of s.events??[]) {
   const age=Math.max(0,effectTime-ev.at),fraction=Math.min(1,age/ev.lifetime),p=fieldPoint(ev.position)
   if(age>=ev.lifetime)continue
   liveEvents.add(ev.id)
   if(!this.seenEvents.has(ev.id)) {
    this.seenEvents.add(ev.id)
    if(ev.type==='impact'&&ev.kind==='cannon'&&!paused&&!reduced&&now-this.lastSound>120){this.playSound('impact',.18);this.lastSound=now;this.cameras.main.shake(75,.001)}
    if(ev.type==='kill'&&ev.enemyKind){const image=this.actor(ev.enemyKind,p.x,p.y,ev.enemyKind==='boss'?224:ev.enemyKind==='armored'?172:148);image.shadow.destroy();this.corpse.set(ev.id,image.image)}
    if(ev.type==='kill'||ev.type==='leak')this.damageText.set(ev.id,this.add.text(p.x,p.y-45,ev.type==='kill'?`+${ev.bounty??0}`:`−${ev.amount??1}`,{fontFamily:this.palette.fontFamily,fontSize:'27px',fontStyle:'bold',color:ev.type==='kill'?this.palette.css.bounty:this.palette.css.lossText,stroke:this.palette.css.textOutline,strokeThickness:4}).setOrigin(.5).setDepth(1800))
   }
   if(ev.type==='hit'||ev.type==='impact') {
    const radius=ev.kind==='cannon'?15+fraction*65:8+fraction*24
    this.effects.lineStyle(ev.kind==='cannon'?7:4,ev.kind?this.palette.color[ev.kind]:this.palette.color.impact,1-fraction).strokeCircle(p.x,p.y-8,radius)
    if(!reduced)for(let i=0;i<6;i++){const a=i*Math.PI/3+ev.id;this.effects.fillStyle(ev.kind?this.palette.color[ev.kind]:this.palette.color.impact,1-fraction).fillCircle(p.x+Math.cos(a)*radius,p.y-8+Math.sin(a)*radius,4*(1-fraction))}
   }
   const corpse=this.corpse.get(ev.id)
   if(corpse){
    const reaction=`${ev.enemyKind}-reactions`
    if(this.textures.exists(reaction))corpse.setTexture(reaction,(reduced?5:Math.min(5,2+Math.floor(age/.08)))*8+(this.enemyDirections.get(ev.enemyId??-1)??0))
    else corpse.setAngle(reduced?0:Math.min(75,fraction*110))
    corpse.setAlpha(1-fraction).setPosition(p.x,p.y).setDepth(p.y)
   }
   this.damageText.get(ev.id)?.setPosition(p.x,p.y-45-(reduced?0:fraction*30)).setAlpha(1-fraction)
   if(ev.type==='leak')this.effects.lineStyle(7,this.palette.color.leak,1-fraction).strokeCircle(p.x,p.y,25+fraction*70)
  }
  for(const [id,image] of this.corpse)if(!liveEvents.has(id)){image.destroy();this.corpse.delete(id)}
  for(const [id,label] of this.damageText)if(!liveEvents.has(id)){label.destroy();this.damageText.delete(id)}
  for(const id of this.seenEvents)if(!liveEvents.has(id))this.seenEvents.delete(id)
 }
 private clearActors() {
  for(const a of [...this.enemies.values(),...this.towers.values()]){a.image.destroy();a.shadow.destroy()}
  for(const a of this.corpse.values())a.destroy()
  for(const a of this.damageText.values())a.destroy()
  this.enemies.clear();this.enemyDirections.clear();this.towers.clear();this.corpse.clear();this.damageText.clear();this.seenEvents.clear();this.lastBuild.clear();this.buildAt.clear();this.lastShotSound.clear();this.stamp=0;this.endedAt=0
 }
}

export function createDefenseGame(parent:HTMLElement,bridge:DefenseBridge) {
 const palette=readDefensePalette(parent)
 return new Phaser.Game({type:Phaser.AUTO,parent,width:FIELD_WIDTH,height:FIELD_HEIGHT,backgroundColor:palette.css.ground,banner:false,
  scene:new DefenseScene(bridge,palette),audio:{disableWebAudio:false},render:{antialias:true,roundPixels:false},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},fps:{target:60,min:20},
  input:{mouse:{preventDefaultWheel:false},touch:{capture:false}},disableContextMenu:true})
}
