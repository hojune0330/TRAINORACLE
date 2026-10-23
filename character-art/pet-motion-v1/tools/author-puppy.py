"""Author Dubu from the preserved Tripo puppy, using its actual 21-bone rig.

Keeps the downloaded walk, adds ear/expression controls and paw contacts, and
stores editable actions. No source file or existing cat performance is changed.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Quaternion

def color(code):
    vals=[int(code[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)+(1,)

def material(name, code):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=color(code)
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color(code)
    m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1
    return m

def components(mesh):
    adj=[[] for _ in mesh.vertices]
    for e in mesh.edges:
        i,j=e.vertices;adj[i].append(j);adj[j].append(i)
    unseen=set(range(len(adj)));groups=[]
    while unseen:
        stack=[unseen.pop()];group=[]
        while stack:
            i=stack.pop();group.append(i)
            for j in adj[i]:
                if j in unseen:unseen.remove(j);stack.append(j)
        groups.append(group)
    return sorted(groups,key=len,reverse=True)

p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(a.source.resolve()))
scene=bpy.context.scene;scene.render.fps=30
rig=next(o for o in scene.objects if o.type=='ARMATURE')
mesh=next(o for o in scene.objects if o.type=='MESH')
original=rig.animation_data.action;original.name='TripoOriginalWalk';original.use_fake_user=True
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for pb in rig.pose.bones:pb.matrix_basis.identity()
scene.frame_set(1);bpy.context.view_layer.update()
groups=components(mesh.data)
eyes=[g for g in groups if len(g)==97]
ears=[g for g in groups if 500<=len(g)<=520]
if len(eyes)!=2 or len(ears)!=2:raise ValueError('This authoring file requires the reviewed puppy source')
center=lambda g:sum((mesh.data.vertices[i].co for i in g),Vector())/len(g)
eye_centers=[center(g) for g in eyes];face=sum(eye_centers,Vector())/2
up=Vector((0,0,1));across=Vector((1,0,0));front=Vector((0,-1,0))
tan=material('Dubu warm tan','d3a06e');cream=material('Dubu cream','fff0d2')
earmat=material('Dubu floppy ears','9c6a46');brown=material('Dubu face','573b2c');pink=material('Dubu cheeks','efb4a0')
mesh.data.materials.clear()
for m in (tan,cream,earmat,brown,pink):mesh.data.materials.append(m)
rest=mesh.data.attributes.new('pet_rest_position','FLOAT_VECTOR','POINT')
for v,item in zip(mesh.data.vertices,rest.data):item.vector=v.co
nodes=tan.node_tree.nodes;links=tan.node_tree.links
attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='pet_rest_position'
sep=nodes.new('ShaderNodeSeparateXYZ');links.new(attr.outputs['Vector'],sep.inputs[0]);x,y,z=[sep.outputs[k] for k in ('X','Y','Z')]
def op(kind,*values):
    n=nodes.new('ShaderNodeMath');n.operation=kind
    for i,v in enumerate(values):
        if isinstance(v,(int,float)):n.inputs[i].default_value=v
        else:links.new(v,n.inputs[i])
    return n.outputs[0]
def ellipse(cx,cz,rx,rz):
    u=op('DIVIDE',op('SUBTRACT',x,cx),rx);v=op('DIVIDE',op('SUBTRACT',z,cz),rz)
    return op('LESS_THAN',op('ADD',op('MULTIPLY',u,u),op('MULTIPLY',v,v)),1)
# A smooth forehead blaze, a broad cream muzzle/chest, and four cream socks.
blaze=op('MULTIPLY',ellipse(.01,.80,.061,.23),op('LESS_THAN',y,-.24))
muzzle=op('MULTIPLY',ellipse(.012,.555,.15,.105),op('LESS_THAN',y,-.30))
chest=op('MULTIPLY',ellipse(.015,.335,.13,.17),op('LESS_THAN',y,-.17))
socks=op('LESS_THAN',z,.095)
mask=op('MAXIMUM',op('MAXIMUM',blaze,muzzle),op('MAXIMUM',chest,socks))
mix=nodes.new('ShaderNodeMixRGB');mix.inputs[1].default_value=color('d3a06e');mix.inputs[2].default_value=color('fff0d2');links.new(mask,mix.inputs[0])
cheeks=[]
for u in (-.12,.12):cheeks.append(op('MULTIPLY',ellipse(face.x+u,.58,.027,.020),op('LESS_THAN',y,-.34)))
blush=nodes.new('ShaderNodeMixRGB');links.new(op('MAXIMUM',*cheeks),blush.inputs[0]);links.new(mix.outputs[0],blush.inputs[1]);blush.inputs[2].default_value=color('efb4a0')
links.new(blush.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
eye_ids={i for g in eyes for i in g};ear_ids={i for g in ears for i in g}
for poly in mesh.data.polygons:
    poly.use_smooth=True
    poly.material_index=3 if all(i in eye_ids for i in poly.vertices) else 2 if all(i in ear_ids for i in poly.vertices) else 0
for g,c in zip(eyes,eye_centers):
    for i in g:
        off=mesh.data.vertices[i].co-c
        mesh.data.vertices[i].co=c+Vector((off.x*.62,off.y*.3,off.z*.8))+front*.005
bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
for i,c in enumerate(eye_centers):
    b=rig.data.edit_bones.new('PetEye.'+str(i));b.head=c;b.tail=c+up*.05;b.parent=rig.data.edit_bones['tripo::Head_3']
ear_pivots=[]
for i,g in enumerate(ears):
    high=sorted((mesh.data.vertices[j].co.copy() for j in g),key=lambda v:v.z,reverse=True)[:30]
    pivot=sum(high,Vector())/len(high);tip=center(g);tip.z-=.10;ear_pivots.append(pivot)
    b=rig.data.edit_bones.new('PetEar.'+str(i));b.head=pivot;b.tail=tip;b.parent=rig.data.edit_bones['tripo::Head_3']
ik_defs=[('front-left','tripo::0_Left_Limb_2',3),('front-right','tripo::0_Right_Limb_1',2),('back-left','tripo::1_Left_Limb_2',2),('back-right','bone_7',2)]
for label,end,count in ik_defs:
    b=rig.data.edit_bones.new('PetPaw.'+label);b.head=rig.data.edit_bones[end].tail.copy();b.tail=b.head+up*.06;b.use_deform=False
# The generated right foreleg has no paw joint, unlike the other three legs.
# Add the missing joint so bending the forearm does not rotate its whole sole.
b=rig.data.edit_bones.new('PetFoot.front-right');b.head=rig.data.edit_bones['tripo::0_Right_Limb_1'].tail.copy();b.tail=b.head+front*.08;b.parent=rig.data.edit_bones['tripo::0_Right_Limb_1']
bpy.ops.object.mode_set(mode='OBJECT');iks=[]
for label,end,count in ik_defs:
    ik=rig.pose.bones[end].constraints.new('IK');ik.name='Dubu paw contact';ik.target=rig;ik.subtarget='PetPaw.'+label;ik.chain_count=count;ik.iterations=64;ik.influence=0;iks.append(ik)
for prefix,collection in [('PetEye.',eyes),('PetEar.',ears)]:
    for i,g in enumerate(collection):
        for vg in mesh.vertex_groups:vg.remove(g)
        mesh.vertex_groups.new(name=prefix+str(i)).add(g,1,'REPLACE')
foot=mesh.vertex_groups.new(name='PetFoot.front-right')
forearm=mesh.vertex_groups['tripo::0_Right_Limb_1'].index
for v in mesh.data.vertices:
    weight=sum(g.weight for g in v.groups if g.group==forearm)
    if weight<.2 or v.co.z>=.145:continue
    amount=min(1,max(0,(.145-v.co.z)/.055))
    old=[(g.group,g.weight) for g in v.groups]
    for index,w in old:mesh.vertex_groups[index].add([v.index],w*(1-amount),'REPLACE')
    foot.add([v.index],amount,'REPLACE')
# The source added a small dangling collar-like island despite the no-collar
# prompt. Remove just that identified island from this derivative, not the FBX.
tag=[g for g in groups if len(g)==117]
if tag:
    bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in tag[0]],context='VERTS');bm.to_mesh(mesh.data);bm.free()
bpy.context.view_layer.update()
def surface(u,h,offset=.004):
    point=Vector((face.x+u,face.y,h));ok,hit,norm,_=mesh.ray_cast(point+front*2,-front)
    if not ok:raise ValueError('Face ray misses '+str((u,h)))
    return hit+front*offset
def bind(obj):
    obj.parent=rig;obj.matrix_parent_inverse=rig.matrix_world.inverted()
    obj.vertex_groups.new(name='tripo::Head_3').add(list(range(len(obj.data.vertices))),1,'REPLACE')
    obj.modifiers.new('Follow head','ARMATURE').object=rig
def mouth(name,points):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=.003;d.bevel_resolution=3
    sp=d.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for bp,(u,h) in zip(sp.bezier_points,points):bp.co=surface(u,h);bp.handle_left_type=bp.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,d);scene.collection.objects.link(obj);bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');obj.data.materials.append(brown);bind(obj)
mouth('Dubu smile left',[(-.038,.537),(-.025,.527),(-.01,.533),(0,.55)])
mouth('Dubu smile right',[(0,.55),(.01,.533),(.025,.527),(.038,.537)])
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=surface(0,.565,.007))
nose=bpy.context.object;nose.name='Dubu button nose';nose.scale=(.019,.009,.013);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);nose.data.materials.append(brown);bind(nose)
for poly in nose.data.polygons:poly.use_smooth=True
sub=mesh.modifiers.new('Smooth puppy joints','SUBSURF');sub.levels=sub.render_levels=1
def reset():
    for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
    for ik in iks:ik.influence=0
def rotate(name,axis,angle):
    pb=rig.pose.bones[name];pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@axis,angle)
def move(name,delta):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_quaternion().inverted()@delta
def blink(v):
    for i in range(2):rig.pose.bones['PetEye.'+str(i)].scale=(1,max(.045,1-v),1)
def ear_sway(v):
    for i in range(2):rotate('PetEar.'+str(i),front,v*(-1 if i else 1))
def key(frame):
    for pb in rig.pose.bones:
        for channel in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=channel,frame=frame,group=pb.name)
    for ik in iks:ik.keyframe_insert(data_path='influence',frame=frame)
def action(name):
    reset();act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data.action=act
def resting(t,breath=0):
    move('tripo::Root',up*(-.10*t+breath))
    # Head_2 also owns both shoulders. Lower the face through Head_3 so the
    # forelegs retain enough room to fold without their elbows flipping.
    move('tripo::Head_2',up*(-.02*t));move('tripo::Head_3',up*(-.10*t));rotate('tripo::Head_3',across,.15*t)
    rotate('tripo::0_Left_Limb_0',across,-.7*t);rotate('tripo::0_Left_Limb_1',across,1.0*t)
    rotate('tripo::0_Right_Limb_0',across,-.5*t)
    rotate('tripo::1_Left_Limb_1',across,.6*t);rotate('tripo::1_Left_Limb_2',across,-1.0*t)
    rotate('bone_6',across,.6*t);rotate('bone_7',across,-1.0*t)
    rotate('bone_9',up,-.7*t);rotate('bone_10',across,.5*t)
    for (label,end,count),ik in zip(ik_defs,iks):
        ik.influence=1;move('PetPaw.'+label,front*(.09 if label.startswith('front') else .025)*t+up*(.003 if label.startswith('front') else .025)*t)
    bpy.context.view_layer.update()
    for name in ('tripo::0_Left_Limb_3','PetFoot.front-right','tripo::1_Left_Limb_3','bone_8'):
        pb=rig.pose.bones[name]
        pb.rotation_quaternion=(pb.bone.matrix_local.inverted() @ pb.parent.bone.matrix_local @ pb.parent.matrix.inverted() @ pb.bone.matrix_local).to_quaternion()
    ear_sway(.08*t);blink(t)
action('PetIdle')
for f in range(1,122,4):
    reset();phase=(f-1)/120*math.tau;rotate('tripo::Head_3',front,.025*math.sin(phase));rotate('bone_9',up,.17*math.sin(phase));ear_sway(.035*math.sin(phase));blink(max(0,1-abs(f-85)/5));key(f)
action('PetStroke')
for f,t in [(1,0),(9,.45),(20,1),(36,.85),(48,1),(60,.4),(73,0)]:
    reset();rotate('tripo::Head_3',front,-.19*t);rotate('tripo::Head_2',across,-.06*t);rotate('bone_9',up,.35*math.sin(f*.18)*t);ear_sway(.12*t);blink(.97*t);key(f)
for name,frames in [('PetLieDown',[(1,0),(12,.12),(25,.4),(40,.75),(55,1),(73,1)]),('PetWake',[(1,1),(15,1),(25,.8),(40,.3),(58,0),(73,0)])]:
    action(name)
    for f,t in frames:reset();resting(t);key(f)
action('PetSleep')
for f in range(1,98,4):reset();resting(1,.002*math.sin((f-1)/96*math.tau));key(f)
action('PetEat')
for f,t in [(1,0),(12,.6),(25,1),(34,.85),(43,1),(52,.85),(61,1),(73,0)]:
    reset();rotate('tripo::Head_2',across,.18*t);rotate('tripo::Head_3',across,.2*t);move('tripo::Head_2',up*(-.03*t));blink(.7*t);ear_sway(-.07*t);rotate('bone_9',up,.15*math.sin(f*.2));key(f)
for name,reach,lift in [('PetPlay',.10,.09),('PetHello',.04,.15)]:
    action(name)
    for f,t in [(1,0),(10,.45),(22,1),(36,.65),(49,1),(61,.2),(73,0)]:
        reset();iks[0].influence=1;move('PetPaw.front-left',front*reach*t+up*lift*t);rotate('tripo::Head_3',front,-.08*t);rotate('bone_9',up,.28*math.sin(f*.13)*t);ear_sway(.08*t);blink(.3*t if name=='PetHello' else 0);key(f)
# Use the provider's actual gait phase, reducing stride and torso motion.
reset();rig.animation_data.action=original;rig.animation_data.action_slot=original.slots[0];samples=[]
for f in range(1,79):
    scene.frame_set(f);samples.append({pb.name:(pb.location.copy(),pb.rotation_quaternion.copy(),pb.scale.copy()) for pb in rig.pose.bones})
action('PetWalk')
for f,sample in enumerate(samples,1):
    reset()
    for pb in rig.pose.bones:
        loc,rot,scale=sample[pb.name];amount=.52 if 'Limb' in pb.name or pb.name in ('bone_6','bone_7','bone_8') else .26
        pb.location=loc*amount;pb.rotation_quaternion=Quaternion((1,0,0,0)).slerp(rot,amount);pb.scale=Vector((1,1,1)).lerp(scale,amount)
    ear_sway(.06*math.sin(f/78*math.tau));key(f)
reset();rig.animation_data.action=bpy.data.actions['PetIdle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(1)
a.output.parent.mkdir(parents=True,exist_ok=True);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(a.output.resolve()))
print(json.dumps({'source':str(a.output),'actions':[act.name for act in bpy.data.actions],'eyeCenters':[list(v) for v in eye_centers]}))
