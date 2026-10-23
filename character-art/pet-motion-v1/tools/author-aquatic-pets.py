"""Author a belly-slide seal and four-paw otter from their preserved Tripo FBX.

Species-specific weights, two-part tails, facial controls and floor contact.
No source file is overwritten; source textures are packed into the derivative.
"""
import argparse,json,math,shutil,sys
from pathlib import Path
import bpy
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree

def rgba(s):
    v=[int(s[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in v)+(1,)
def smooth(v):
    v=max(0,min(1,v));return v*v*(3-2*v)
def parts(data):
    adj=[[] for _ in data.vertices]
    for e in data.edges:
        i,j=e.vertices;adj[i].append(j);adj[j].append(i)
    unseen=set(range(len(adj)));result=[]
    while unseen:
        todo=[unseen.pop()];group=[]
        while todo:
            i=todo.pop();group.append(i)
            for j in adj[i]:
                if j in unseen:unseen.remove(j);todo.append(j)
        result.append(group)
    return sorted(result,key=len,reverse=True)

p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--texture',type=Path,required=True);p.add_argument('--pet',choices=['seal','otter'],required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);seal=a.pet=='seal'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(a.source.resolve()))
scene=bpy.context.scene;scene.render.fps=30
m=next(o for o in scene.objects if o.type=='MESH');m.parent=None
if len(m.data.vertices)!=(5224 if seal else 5251):raise ValueError('Source differs from the reviewed Tripo mesh')
a.output.parent.mkdir(parents=True,exist_ok=True)
local=a.output.parent/'source-texture.jpg';shutil.copyfile(a.texture,local)
for img in bpy.data.images:
    if img.source=='FILE':img.filepath=str(local.resolve());img.reload()
source_image=next(n.image for mat in m.data.materials for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
groups=parts(m.data);eye_groups=[] if seal else groups[1:]
if not seal and sorted(map(len,eye_groups))!=[130,133]:raise ValueError('Otter eyes missing')
eye_centers=[Vector((-.1117,-.4312,.4037)),Vector((.1096,-.4328,.4035))] if seal else [sum((m.data.vertices[i].co for i in g),Vector())/len(g) for g in eye_groups]
# Compact the long tail slightly while keeping every source vertex and UV.
if not seal:
    for v in m.data.vertices:
        if v.co.y>.12:v.co.y=.12+(v.co.y-.12)*.78
        if v.co.y>-.26 and v.co.z<.23:v.co.x*=1.08

mat=bpy.data.materials.new(a.pet+' approved flat palette');mat.use_nodes=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links
base=rgba('b6c9d0' if seal else 'c8976d');cream=rgba('fff0d8');pink=rgba('efb4a6');dark=rgba('573a2c')
mat.diffuse_color=base
tex=nodes.new('ShaderNodeTexImage');tex.image=source_image
rgb=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],rgb.inputs[0]);r,g,b=[rgb.outputs[n] for n in ('Red','Green','Blue')]
rest=m.data.attributes.new('pet_rest_position','FLOAT_VECTOR','POINT')
for v,item in zip(m.data.vertices,rest.data):item.vector=v.co
attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='pet_rest_position';sep=nodes.new('ShaderNodeSeparateXYZ');links.new(attr.outputs['Vector'],sep.inputs[0]);x,y,z=[sep.outputs[n] for n in ('X','Y','Z')]
def op(kind,*values):
    n=nodes.new('ShaderNodeMath');n.operation=kind
    for i,v in enumerate(values):
        if isinstance(v,(int,float)):n.inputs[i].default_value=v
        else:links.new(v,n.inputs[i])
    return n.outputs[0]
def mix(mask,color1,color2):
    n=nodes.new('ShaderNodeMixRGB');links.new(mask,n.inputs[0])
    for index,value in ((1,color1),(2,color2)):
        if isinstance(value,tuple):n.inputs[index].default_value=value
        else:links.new(value,n.inputs[index])
    return n.outputs[0]
def oval(cx,cz,rx,rz):
    u=op('DIVIDE',op('SUBTRACT',x,cx),rx);v=op('DIVIDE',op('SUBTRACT',z,cz),rz)
    return op('LESS_THAN',op('ADD',op('MULTIPLY',u,u),op('MULTIPLY',v,v)),1)
cream_mask=op('MULTIPLY',oval(0,.27,.17,.18),op('LESS_THAN',y,-.30)) if seal else op('MULTIPLY',op('GREATER_THAN',g,.50),op('GREATER_THAN',r,.60))
color=mix(cream_mask,base,cream)
blush=op('MULTIPLY',op('MAXIMUM',oval(-.145 if seal else -.109,.350 if seal else .308,.026,.022),oval(.145 if seal else .109,.350 if seal else .308,.026,.022)),op('LESS_THAN',y,-.35 if seal else -.40))
color=mix(blush,color,pink)
# Keep only the small nose/mouth from the original dark face texture; eyes get
# their own bones so closing them cannot pinch a large patch of facial skin.
face=op('MULTIPLY',op('LESS_THAN',op('ABSOLUTE',x),.055),op('LESS_THAN',y,-.43))
darkmask=op('MULTIPLY',op('LESS_THAN',op('MAXIMUM',r,op('MAXIMUM',g,b)),.15),face)
color=mix(darkmask,color,dark)
if not seal:
    paw=op('MULTIPLY',op('LESS_THAN',z,.05),op('MULTIPLY',op('GREATER_THAN',op('ABSOLUTE',x),.045),op('LESS_THAN',y,.10)))
    color=mix(paw,color,rgba('8c624e'))
links.new(color,nodes['Principled BSDF'].inputs['Base Color']);nodes['Principled BSDF'].inputs['Roughness'].default_value=1
m.data.materials.clear();m.data.materials.append(mat)
for poly in m.data.polygons:poly.use_smooth=True;poly.material_index=0
face_mat=bpy.data.materials.new('Soft brown facial features');face_mat.use_nodes=True;face_mat.diffuse_color=dark;face_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=dark
if not seal:
    m.data.materials.append(face_mat);eyes={i for group in eye_groups for i in group}
    for poly in m.data.polygons:
        if all(i in eyes for i in poly.vertices):poly.material_index=1
    for group,c in zip(eye_groups,eye_centers):
        for i in group:
            off=m.data.vertices[i].co-c;m.data.vertices[i].co=c+Vector((off.x*.72,off.y*.40,off.z*.83))+Vector((0,-.003,0))

bpy.ops.object.select_all(action='DESELECT');data=bpy.data.armatures.new(a.pet+' editable skeleton');rig=bpy.data.objects.new(a.pet+' rig',data);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    bb=data.edit_bones.new(name);bb.head=head;bb.tail=tail
    if parent:bb.parent=data.edit_bones[parent]
bone('Root',(0,0,0),(0,0,.06));bone('Body',(0,0,.08),(0,0,.22),'Root')
bone('Head',(0,-.18,.23) if seal else (0,-.27,.18),(0,-.23,.43) if seal else (0,-.32,.37),'Body')
for i,c in enumerate(eye_centers):bone('Eye.'+str(i),c,c+Vector((0,0,.035)),'Head')
bone('Tail',(0,.15,.07),(0,.30,.06),'Body');bone('Tail.tip',(0,.30,.06),(0,.42,.035),'Tail')
for side,sign in [('L',1),('R',-1)]:
    if seal:bone('Flipper.'+side,(sign*.16,-.10,.095),(sign*.31,-.13,.04),'Root')
    else:
        bone('Paw.front.'+side,(sign*.08,-.25,.12),(sign*.09,-.28,.025),'Root')
        bone('Paw.back.'+side,(sign*.075,.0,.10),(sign*.075,-.02,.025),'Root')
        bone('Ear.'+side,(sign*.13,-.27,.38),(sign*.15,-.26,.42),'Head')
bpy.ops.object.mode_set(mode='OBJECT');m.vertex_groups.clear()
for bb in data.bones:m.vertex_groups.new(name=bb.name)
eyes=set() if seal else {i for group in eye_groups for i in group}
for v in m.data.vertices:
    xx,yy,zz=v.co;side='L' if xx>0 else 'R'
    if v.index in eyes:continue
    if yy>.14:
        t=smooth((yy-.14)/.10);tip=smooth((yy-.27)/.09);weights={'Body':1-t,'Tail':t*(1-tip),'Tail.tip':t*tip}
    elif seal:
        flipper=smooth((abs(xx)-.16)/.09)*smooth((.18-zz)/.055)
        head=smooth((-.04-yy)/.17)*smooth((zz-.12)/.09)
        floor=smooth(zz/.035)
        weights={'Flipper.'+side:flipper,'Head':(1-flipper)*head,'Body':(1-flipper)*(1-head)*floor,'Root':(1-flipper)*(1-head)*(1-floor)}
    elif zz<.14 and abs(xx)>.035:
        t=smooth((.14-zz)/.075)*smooth((abs(xx)-.035)/.025)
        weights={'Paw.'+('front.' if yy<-.14 else 'back.')+side:t,'Body':1-t}
    else:
        head=smooth((-.17-yy)/.12)*smooth((zz-.15)/.08);ear=smooth((abs(xx)-.105)/.035)*smooth((zz-.34)/.045) if yy<-.18 else 0
        weights={'Ear.'+side:head*ear,'Head':head*(1-ear),'Body':1-head}
    total=sum(weights.values())
    for name,value in weights.items():
        if value>0:m.vertex_groups[name].add([v.index],value/total,'REPLACE')
for i,group in enumerate(eye_groups):m.vertex_groups['Eye.'+str(i)].add(group,1,'REPLACE')
def skin(obj):
    obj.parent=rig;obj.modifiers.new('Editable pet deformation','ARMATURE').object=rig
skin(m);sub=m.modifiers.new('Soft outline','SUBSURF');sub.levels=sub.render_levels=1
if seal:
    surface=BVHTree.FromPolygons([v.co for v in m.data.vertices],[p.vertices[:] for p in m.data.polygons])
    for i,c in enumerate(eye_centers):
        hit,normal,_,_=surface.ray_cast(Vector((c.x,-2,c.z)),Vector((0,1,0)))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=hit+normal*.003)
        eye=bpy.context.object;eye.name='Seal eye '+str(i);eye.scale=(.012,.005,.021)
        eye.rotation_mode='QUATERNION';eye.rotation_quaternion=normal.to_track_quat('Y','Z')
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        eye.data.materials.append(face_mat)
        for poly in eye.data.polygons:poly.use_smooth=True
        eye.vertex_groups.new(name='Eye.'+str(i)).add(list(range(len(eye.data.vertices))),1,'REPLACE');skin(eye)

def reset():
    for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
def rot(name,axis,angle):
    pb=rig.pose.bones[name];pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@Vector(axis),angle)
def move(name,vec):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_quaternion().inverted()@Vector(vec)
def blink(t):
    for i in range(2):rig.pose.bones['Eye.'+str(i)].scale=(1,max(.05,1-t),1)
def key(f):
    for pb in rig.pose.bones:
        for channel in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=channel,frame=f,group=pb.name)
def action(name):
    reset();act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=act
def tail(angle):rot('Tail',(0,0,1),angle);rot('Tail.tip',(0,0,1),angle*.65)
def rest(t,breath=0):
    move('Body',(0,0,(-.004 if seal else -.035)*t+breath));move('Head',(0,-.005*t,(-.080 if seal else -.045)*t));rot('Head',(1,0,0),(.20 if seal else .16)*t);blink(t)
    if seal:
        for side,sign in [('L',1),('R',-1)]:rot('Flipper.'+side,(0,0,1),.12*sign*t)
    else:
        move('Tail',(0,0,.025*t))
        for side,sign in [('L',1),('R',-1)]:move('Paw.front.'+side,(sign*.012*t,-.018*t,.002*t));move('Paw.back.'+side,(0,.008*t,.004*t))
action('PetIdle')
for f in range(1,122,4):
    reset();ph=(f-1)/120*math.tau;rot('Head',(0,1,0),.025*math.sin(ph));tail(.035*math.sin(ph));blink(max(0,1-abs(f-85)/5));key(f)
action('PetStroke')
for f,t in [(1,0),(9,.45),(20,1),(36,.85),(48,1),(60,.4),(73,0)]:
    reset();rot('Head',(0,1,0),-.13*t);move('Head',(0,0,-.008*t));tail(.12*math.sin(f*.13)*t);blink(.97*t);key(f)
for name,sequence in [('PetLieDown',[(1,0),(12,.12),(25,.4),(40,.75),(55,1),(73,1)]),('PetWake',[(1,1),(15,1),(25,.8),(40,.3),(58,0),(73,0)])]:
    action(name)
    for f,t in sequence:reset();rest(t);key(f)
action('PetSleep')
for f in range(1,98,4):reset();rest(1,.001*(1+math.sin((f-1)/96*math.tau)));key(f)
action('PetEat')
for f,t in [(1,0),(12,.6),(25,1),(34,.85),(43,1),(52,.85),(61,1),(73,0)]:
    reset();rot('Head',(1,0,0),.22*t);move('Head',(0,-.015*t,-.018*t));blink(.65*t);key(f)
for name in ('PetPlay','PetHello'):
    action(name)
    for f,t in [(1,0),(10,.45),(22,1),(36,.65),(49,1),(61,.2),(73,0)]:
        reset();rot('Head',(0,1,0),-.06*t);tail(.13*t);blink(.30*t if name=='PetHello' else 0)
        if seal:rot('Flipper.L',(0,1,0),(-.48 if name=='PetHello' else -.20)*t);move('Flipper.L',(0,-.025*t,.01*t))
        else:move('Paw.front.L',(0,-.025*t,.035*t));rot('Paw.front.L',(1,0,0),-.25*t)
        key(f)
action('PetWalk')
for f in range(1,62,2):
    reset();ph=(f-1)/60*math.tau;tail(.10*math.sin(ph))
    if seal:
        move('Head',(0,0,.009*(1+math.sin(ph))));move('Body',(0,0,.003*(1+math.sin(ph-.5))))
        for side,sign in [('L',1),('R',-1)]:rot('Flipper.'+side,(0,0,1),.16*sign*math.cos(ph));move('Flipper.'+side,(0,.015*math.sin(ph),.006*max(0,math.sin(ph))))
    else:
        move('Body',(0,0,.002*(1+math.sin(ph*2))));rot('Head',(1,0,0),.02*math.sin(ph*2))
        for pair,shift in [('front.L',0),('back.R',0),('front.R',math.pi),('back.L',math.pi)]:move('Paw.'+pair,(0,.020*math.cos(ph+shift),.015*max(0,math.sin(ph+shift))))
    key(f)
reset();rig.animation_data.action=bpy.data.actions['PetIdle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(1)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(a.output.resolve()))
print(json.dumps({'pet':a.pet,'bones':len(data.bones),'actions':[v.name for v in bpy.data.actions]}))
