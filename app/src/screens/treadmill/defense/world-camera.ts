/** A shared transform for Phaser, the DOM hit targets and the minimap. */
export const VIEW_WIDTH = 900
export const VIEW_HEIGHT = 1100
export type WorldSize = {width:number;height:number}
export type WorldCamera = {x:number;y:number;zoom:number;follow:boolean}
export const overviewZoom = (world:WorldSize) => Math.min(VIEW_WIDTH/world.width,VIEW_HEIGHT/world.height)
export function constrainCamera(camera:WorldCamera,world:WorldSize):WorldCamera {
 const zoom=Math.max(overviewZoom(world),Math.min(1.65,camera.zoom))
 const halfX=VIEW_WIDTH/(2*zoom),halfY=VIEW_HEIGHT/(2*zoom)
 return {...camera,zoom,x:world.width<=halfX*2?world.width/2:Math.max(halfX,Math.min(world.width-halfX,camera.x)),y:world.height<=halfY*2?world.height/2:Math.max(halfY,Math.min(world.height-halfY,camera.y))}
}
export function cameraRect(c:WorldCamera){return {x:c.x-VIEW_WIDTH/(2*c.zoom),y:c.y-VIEW_HEIGHT/(2*c.zoom),width:VIEW_WIDTH/c.zoom,height:VIEW_HEIGHT/c.zoom}}
export function worldToView(p:{x:number;y:number},c:WorldCamera){const r=cameraRect(c);return {x:(p.x-r.x)*c.zoom,y:(p.y-r.y)*c.zoom}}
export function viewToWorld(p:{x:number;y:number},c:WorldCamera){const r=cameraRect(c);return {x:r.x+p.x/c.zoom,y:r.y+p.y/c.zoom}}
export function zoomAt(c:WorldCamera,world:WorldSize,zoom:number,anchor={x:VIEW_WIDTH/2,y:VIEW_HEIGHT/2}){
 const before=viewToWorld(anchor,c),next=constrainCamera({...c,zoom,follow:false},world)
 const after=viewToWorld(anchor,next)
 return constrainCamera({...next,x:next.x+before.x-after.x,y:next.y+before.y-after.y},world)
}
