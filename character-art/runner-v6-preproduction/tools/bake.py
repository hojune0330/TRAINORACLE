"""Preserve Tori's source performance. Bake two cameras, fixed scale and ground.

--probe renders nine phase samples of each full source clip. Normal mode uses
the explicit CLIPS excerpts. No network, mesh/skin edits or source writes.
"""
import bpy, json, math, hashlib, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]; REPO=ROOT.parent.parent
SOURCE=ROOT.parent/'tori/tripo/2026-10-12/motion/tori-game-motions.fbx'
LEGACY=ROOT.parent/'tori/tripo/2026-10-12/tools/bake-motion.py'
PROBE='--probe' in sys.argv
SIZE=256; PPU=180; BASELINE=218
VIEWS={'side':{'offset':[-8,-5,0],'elevation':0},'diagonal':{'offset':[-7.698,-5.391,3.420],'elevation':20}}
CLIPS={
 'run':{'source':'run','start':1,'end':31,'fps':12,'loop':True},
 'idle':{'source':'idle','start':1,'end':369,'fps':6,'loop':True},
 'jump':{'source':'jump','start':1,'end':54,'fps':12,'loop':False},
 'hit':{'source':'hit_to_body_01','start':1,'end':32,'fps':12,'loop':False},
 'fall':{'source':'fall','start':1,'end':73,'fps':12,'loop':False},
 'cheer':{'source':'cheer','start':1,'end':291,'fps':8,'loop':False},
}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH')
for track in rig.animation_data.nla_tracks: track.mute=True
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=8
scene.render.threads_mode='FIXED'; scene.render.threads=3
scene.render.resolution_x=SIZE; scene.render.resolution_y=SIZE; scene.render.resolution_percentage=100
scene.render.film_transparent=True; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard'
# Adopt precisely the existing approved texture repair, without copying geometry.
# This fragment only authors material nodes / rest-space color attributes.
recipe=LEGACY.read_text(encoding='utf-8')
fragment=recipe[recipe.index('col=mesh.data.color_attributes.new'):recipe.index('camera_data=bpy.data.cameras.new')]
exec(compile(fragment,str(LEGACY),'exec'))
camera_data=bpy.data.cameras.new('ReviewCamera'); camera=bpy.data.objects.new('ReviewCamera',camera_data)
scene.collection.objects.link(camera); scene.camera=camera; camera_data.type='ORTHO'; camera_data.ortho_scale=SIZE/PPU
def pose(name,frame):
    action=bpy.data.actions['Armature|'+name]
    rig.animation_data.action=action; rig.animation_data.action_slot=action.slots[0]
    scene.frame_set(int(frame),subframe=frame%1)
    ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    pts=[ev.matrix_world@v.co for v in ev.data.vertices]
    hip=rig.matrix_world@rig.pose.bones['mixamorig:Hips'].head
    feet={n:list(rig.matrix_world@rig.pose.bones['mixamorig:'+n].head) for n in ['LeftFoot','RightFoot']}
    return {'hip':list(hip),'minZ':min(p.z for p in pts),'maxZ':max(p.z for p in pts),'feet':feet,'points':pts}
report={'version':'runner-v6-preproduction','source':str(SOURCE.relative_to(REPO)).replace('\\','/'),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'materialRecipe':str(LEGACY.relative_to(REPO)).replace('\\','/'),'materialRecipeSha256':hashlib.sha256(LEGACY.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'sourceFps':scene.render.fps,'cell':[SIZE,SIZE],'pixelsPerWorldUnit':PPU,'groundAnchor':[SIZE/2,BASELINE],'origin':[.5,BASELINE/SIZE],'preserveSourceKeys':True,'mode':'probe' if PROBE else 'full','clips':[]}
out=ROOT/('probe' if PROBE else 'frames');out.mkdir(parents=True,exist_ok=True)
for name,cfg in CLIPS.items():
    action=bpy.data.actions['Armature|'+cfg['source']]
    start,end=map(float,action.frame_range)
    if PROBE: frames=[start+(end-start)*i/8 for i in range(9)]
    else:
        start,end=cfg['start'],cfg['end']; step=scene.render.fps/cfg['fps']
        frames=[start+i*step for i in range(math.ceil((end-start)/step))]
        if not cfg['loop']: frames.append(end)
    initial=pose(cfg['source'],start)
    # Fix each clip's horizontal root and original first-frame contact. Do not
    # chase the sole every frame: preserve original bounce, hit recovery and fall.
    anchor=Vector((initial['hip'][0],initial['hip'][1],initial['minZ']))
    entry={'id':name,'sourceAction':action.name,'sourceFrameRange':list(action.frame_range),'sourceDurationSeconds':(action.frame_range[1]-action.frame_range[0])/scene.render.fps,'excerptFrameRange':[start,end],'durationSeconds':(end-start)/scene.render.fps,'loop':cfg['loop'],'anchorWorld':list(anchor),'views':{}}
    for view,view_cfg in VIEWS.items():
        folder=out/view/name;folder.mkdir(parents=True,exist_ok=True)
        offset=Vector(view_cfg['offset']);elevation=math.atan2(offset.z,math.hypot(offset.x,offset.y))
        target=anchor+Vector((0,0,(BASELINE-SIZE/2)/PPU/math.cos(elevation)))
        camera.location=target+offset;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.view_layers.update()
        records=[]
        for i,frame in enumerate(frames):
            data=pose(cfg['source'],frame)
            filename=folder/f'{name}-{i:03d}.png'
            scene.render.filepath=str(filename)
            bpy.ops.render.render(write_still=True)
            ndc=[world_to_camera_view(scene,camera,p) for p in data['points']]
            dur=((frames[i+1] if i+1<len(frames) else end)-frame)/scene.render.fps
            # For endpoint inspection retain a small final hold, outside clip time.
            next_frame=frames[i+1] if i+1<len(frames) else end
            duration_ms=round((next_frame-start)/scene.render.fps*1000)-round((frame-start)/scene.render.fps*1000) if dur>0 else 100
            records.append({'index':i,'file':str(filename.relative_to(ROOT)).replace('\\','/'),'sourceFrame':frame,'sourceTimeSeconds':(frame-action.frame_range[0])/scene.render.fps,'durationMs':duration_ms,'endpointHold':dur<=0,'hipWorld':data['hip'],'soleMinZ':data['minZ'],'groundDeltaPx':(data['minZ']-anchor.z)*PPU,'feetWorld':data['feet'],'projectedBounds':[min(p.x for p in ndc)*SIZE,(1-max(p.y for p in ndc))*SIZE,max(p.x for p in ndc)*SIZE,(1-min(p.y for p in ndc))*SIZE]})
            print('RENDERED',view,name,i,len(frames),flush=True)
        entry['views'][view]={'offset':view_cfg['offset'],'elevationDegrees':math.degrees(elevation),'cameraTarget':list(target),'records':records}
    report['clips'].append(entry)
    (ROOT/('probe-manifest.json' if PROBE else 'bake-manifest.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
if not PROBE:
    pose('idle',1)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tori-two-view-authoring.blend'),compress=True)
print('COMPLETE',report['mode'],flush=True)
