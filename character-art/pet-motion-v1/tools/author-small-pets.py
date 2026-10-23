"""Species-specific editable rigs for the reviewed rabbit and duck Tripo meshes.

The source downloads stay untouched. Rabbit ears, duck wings, feet, eyes and
beak move on their own bones; actions never scale a whole sprite as a substitute.
"""
import argparse,json,math,sys,shutil
from pathlib import Path
import bpy
from mathutils import Vector,Quaternion

def rgba(s):
    v=[int(s[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in v)+(1,)
def material(name,hex):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=rgba(hex)
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgba(hex)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1
    return m
def connected(data):
    adj=[[] for _ in data.vertices]
    for e in data.edges:
        i,j=e.vertices;adj[i].append(j);adj[j].append(i)
    unseen=set(range(len(adj)));parts=[]
    while unseen:
        stack=[unseen.pop()];part=[]
        while stack:
            i=stack.pop();part.append(i)
            for j in adj[i]:
                if j in unseen:unseen.remove(j);stack.append(j)
        parts.append(part)
    return sorted(parts,key=len,reverse=True)
def smooth(v):return max(0,min(1,v))**2*(3-2*max(0,min(1,v)))

p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--pet',choices=['rabbit','duck'],required=True);p.add_argument('--output',type=Path,required=True)
p.add_argument('--texture',type=Path,help='Same source texture at a short Windows path when the FBM path is 260+ characters')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(a.source.resolve()))
a.output.parent.mkdir(parents=True,exist_ok=True)
# Blender's file packer on Windows cannot resolve some long exported FBM paths.
# Copy texture bytes to this derivative's short directory, then embed them.
for i,img in enumerate(bpy.data.images):
    original=a.texture or Path(bpy.path.abspath(img.filepath))
    if img.source=='FILE' and original.is_file():
        local=a.output.parent/('source-texture-'+str(i)+original.suffix)
        shutil.copyfile(original,local);img.filepath=str(local.resolve());img.reload()
scene=bpy.context.scene;scene.render.fps=30
mesh=next(o for o in scene.objects if o.type=='MESH');mesh.parent=None
for mod in list(mesh.modifiers):
    if mod.type=='ARMATURE':mesh.modifiers.remove(mod)
for ob in list(scene.objects):
    if ob.type=='ARMATURE':
        if ob.animation_data and ob.animation_data.action:ob.animation_data.action.name='TripoOriginalWalk';ob.animation_data.action.use_fake_user=True
        bpy.data.objects.remove(ob,do_unlink=True)
mesh.vertex_groups.clear();parts=connected(mesh.data)
mean=lambda g:sum((mesh.data.vertices[i].co for i in g),Vector())/len(g)
partof={i:len(g) for g in parts for i in g}
source_image=next((n.image for m in mesh.data.materials for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None)
pet=a.pet;isduck=pet=='duck'
expected=5380 if isduck else 5373
if len(mesh.data.vertices)!=expected:raise ValueError('Use the reviewed source mesh for '+pet)
base=material(pet+' base','ffea9c' if isduck else 'b4a397');cream=material(pet+' cream','fff0d8');brown=material(pet+' face','573a2c');pink=material(pet+' blush','efb4a6');orange=material('Ppiyak bill and feet','f6ac50')
mesh.data.materials.clear()
for m in (base,cream,brown,pink,orange):mesh.data.materials.append(m)
eye_parts=[g for g in parts if len(g) in ((224,222) if isduck else (130,))]
if len(eye_parts)!=2:raise ValueError('Separate eyes were not found')
eye_centers=[mean(g) for g in eye_parts]
rest=mesh.data.attributes.new('pet_rest_position','FLOAT_VECTOR','POINT')
for v,item in zip(mesh.data.vertices,rest.data):item.vector=v.co
nodes=base.node_tree.nodes;links=base.node_tree.links
n=nodes.new('ShaderNodeAttribute');n.attribute_name='pet_rest_position';sep=nodes.new('ShaderNodeSeparateXYZ');links.new(n.outputs['Vector'],sep.inputs[0]);x,y,z=[sep.outputs[k] for k in ('X','Y','Z')]
def op(kind,*values):
    n=nodes.new('ShaderNodeMath');n.operation=kind
    for i,v in enumerate(values):
        if isinstance(v,(int,float)):n.inputs[i].default_value=v
        else:links.new(v,n.inputs[i])
    return n.outputs[0]
def oval(cx,cz,rx,rz):
    u=op('DIVIDE',op('SUBTRACT',x,cx),rx);v=op('DIVIDE',op('SUBTRACT',z,cz),rz)
    return op('LESS_THAN',op('ADD',op('MULTIPLY',u,u),op('MULTIPLY',v,v)),1)
if isduck:
    cheeks=[op('MULTIPLY',oval(cx,.625,.038,.028),op('LESS_THAN',y,-.19)) for cx in (-.18,.18)]
    mix=nodes.new('ShaderNodeMixRGB');links.new(op('MAXIMUM',*cheeks),mix.inputs[0]);mix.inputs[1].default_value=rgba('ffea9c');mix.inputs[2].default_value=rgba('efb4a6');links.new(mix.outputs[0],nodes['Principled BSDF'].inputs['Base Color'])
else:
    muzzle=op('MULTIPLY',oval(.002,.29,.15,.095),op('LESS_THAN',y,-.37))
    chest=op('MULTIPLY',oval(0,.17,.12,.10),op('LESS_THAN',y,-.24))
    mask=op('MAXIMUM',muzzle,op('MAXIMUM',chest,op('LESS_THAN',z,.061)))
    mix=nodes.new('ShaderNodeMixRGB');links.new(mask,mix.inputs[0]);mix.inputs[1].default_value=rgba('b4a397');mix.inputs[2].default_value=rgba('fff0d8')
    if source_image:
        tex=nodes.new('ShaderNodeTexImage');tex.image=source_image;ch=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],ch.inputs['Color']);r,g,b=[ch.outputs[n] for n in ('Red','Green','Blue')]
        ear=op('MULTIPLY',op('GREATER_THAN',op('DIVIDE',r,op('MAXIMUM',g,.001)),1.20),op('GREATER_THAN',op('ABSOLUTE',x),.20))
        ear=op('MULTIPLY',ear,op('MULTIPLY',op('LESS_THAN',y,-.14),op('GREATER_THAN',z,.15)))
        emix=nodes.new('ShaderNodeMixRGB');links.new(ear,emix.inputs[0]);links.new(mix.outputs[0],emix.inputs[1]);emix.inputs[2].default_value=rgba('efb4a6');links.new(emix.outputs[0],nodes['Principled BSDF'].inputs['Base Color'])
    else:links.new(mix.outputs[0],nodes['Principled BSDF'].inputs['Base Color'])
eyeset={i for g in eye_parts for i in g}
for poly in mesh.data.polygons:
    size=partof[poly.vertices[0]];poly.use_smooth=True
    poly.material_index=2 if all(i in eyeset for i in poly.vertices) else (4 if isduck and size in (493,205,248,247) else (3 if not isduck and size==141 else 2 if not isduck and size in (170,270) else 0))
for group,c in zip(eye_parts,eye_centers):
    for i in group:
        off=mesh.data.vertices[i].co-c;mesh.data.vertices[i].co=c+Vector((off.x*.70,off.y*.30,off.z*.82))+Vector((0,-.004,0))
bpy.ops.object.select_all(action='DESELECT');data=bpy.data.armatures.new(pet+' editable skeleton');rig=bpy.data.objects.new(pet+' rig',data);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=data.edit_bones[parent]
    return b
bone('Root',(0,0,0),(0,0,.08))
bone('Body',(0,.05,.12 if isduck else .09),(0,.05,.38 if isduck else .25),'Root')
bone('Head',(0,-.03,.49) if isduck else (0,-.20,.23),(0,-.03,.80) if isduck else (0,-.20,.46),'Body')
for i,c in enumerate(eye_centers):bone('Eye.'+str(i),c,c+Vector((0,0,.05)),'Head')
if isduck:
    for side,sign in [('L',1),('R',-1)]:
        bone('Wing.'+side,(sign*.16,-.01,.38),(sign*.29,-.04,.25),'Body')
        bone('Foot.'+side,(sign*.12,-.02,.10),(sign*.12,-.12,.025),'Root')
    bone('Beak.lower',(0,-.25,.60),(0,-.34,.58),'Head');bone('Tail',(0,.19,.29),(0,.34,.37),'Body')
else:
    for side,sign in [('L',1),('R',-1)]:
        bone('Ear.'+side,(sign*.22,-.20,.49),(sign*.29,-.22,.20),'Head')
        bone('Paw.front.'+side,(sign*.125,-.24,.105),(sign*.125,-.32,.035),'Root')
        bone('Paw.back.'+side,(sign*.24,.14,.095),(sign*.26,.10,.035),'Root')
    bone('Tail',(0,.32,.28),(0,.44,.34),'Body')
bpy.ops.object.mode_set(mode='OBJECT')
for b in data.bones:mesh.vertex_groups.new(name=b.name)
def weights(index,values):
    total=sum(values.values())
    for name,v in values.items():
        if v>0:mesh.vertex_groups[name].add([index],v/total,'REPLACE')
for v in mesh.data.vertices:
    x0,y0,z0=v.co;size=partof[v.index];side='L' if x0>0 else 'R'
    if v.index in eyeset:continue
    if isduck:
        if size==1080 or size in (493,213,198):w={'Head':1}
        elif size==205:w={'Beak.lower':1}
        elif size in (248,247):w={'Foot.'+side:1}
        elif size==671:w={'Wing.R':1}
        elif x0>.17 and -.21<y0<.07 and .23<z0<.44:
            t=smooth((x0-.16)/.06);w={'Wing.L':t,'Body':1-t}
        elif y0>.22:
            t=smooth((y0-.22)/.10);w={'Tail':t,'Body':1-t}
        elif z0<.20:
            t=smooth((.20-z0)/.10);w={'Foot.'+side:t,'Body':1-t}
        else:w={'Body':1}
    else:
        if size==1591:
            t=smooth((abs(x0)-.195)/.06)*smooth((.51-z0)/.10)
            w={'Ear.'+side:t,'Head':1-t}
        elif size in (170,270,141):w={'Head':1}
        elif size==315:w={'Tail':1}
        elif z0<.13:
            t=smooth((.13-z0)/.055)*smooth((abs(x0)-.05)/.05);w={'Paw.'+('front.' if y0<-.12 else 'back.')+side:t,'Body':1-t}
        else:w={'Body':1}
    weights(v.index,w)
for i,g in enumerate(eye_parts):mesh.vertex_groups['Eye.'+str(i)].add(g,1,'REPLACE')
mesh.parent=rig;mesh.modifiers.new('Editable pet deformation','ARMATURE').object=rig
sub=mesh.modifiers.new('Soft pet silhouette','SUBSURF');sub.levels=sub.render_levels=1
def reset():
    for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
def rotate(name,axis,angle):
    pb=rig.pose.bones[name];pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@Vector(axis),angle)
def move(name,v):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_quaternion().inverted()@Vector(v)
def blink(t):
    for i in range(2):rig.pose.bones['Eye.'+str(i)].scale=(1,max(.045,1-t),1)
def sway(t):
    for side,sign in [('L',1),('R',-1)]:rotate(('Wing.' if isduck else 'Ear.')+side,(0,1,0),t*sign)
def key(f):
    for pb in rig.pose.bones:
        for channel in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=channel,frame=f,group=pb.name)
def action(name):
    reset();act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=act
def rest(t,breath=0):
    if isduck:
        # A duck settles on its belly: feet tuck backward, then the head rests
        # toward one wing. The belly stays just above the fixed floor plane.
        move('Body',(0,0,-.070*t+breath))
        move('Head',(0,-.015*t,-.10*t));rotate('Head',(1,0,0),.30*t)
        for side in ('L','R'):
            move('Foot.'+side,(0,.075*t,.016*t));rotate('Foot.'+side,(1,0,0),-.20*t)
    else:
        move('Body',(0,0,-.015*t+breath));move('Head',(0,-.008*t,-.035*t));rotate('Head',(1,0,0),.12*t)
    sway(.08*t);blink(t)
action('PetIdle')
for f in range(1,122,4):
    reset();ph=(f-1)/120*math.tau;rotate('Head',(0,1,0),.025*math.sin(ph));sway(.035*math.sin(ph));blink(max(0,1-abs(f-85)/5));key(f)
action('PetStroke')
for f,t in [(1,0),(9,.45),(20,1),(36,.85),(48,1),(60,.4),(73,0)]:
    reset();rotate('Head',(0,1,0),-.16*t);sway(.12*t);rotate('Tail',(0,0,1),.15*math.sin(f*.13)*t);blink(.97*t);key(f)
for name,sequence in [('PetLieDown',[(1,0),(12,.12),(25,.4),(40,.75),(55,1),(73,1)]),('PetWake',[(1,1),(15,1),(25,.8),(40,.3),(58,0),(73,0)])]:
    action(name)
    for f,t in sequence:reset();rest(t);key(f)
action('PetSleep')
for f in range(1,98,4):reset();rest(1,.0015*math.sin((f-1)/96*math.tau));key(f)
action('PetEat')
for f,t in [(1,0),(12,.6),(25,1),(34,.85),(43,1),(52,.85),(61,1),(73,0)]:
    reset();rotate('Head',(1,0,0),.17*t);move('Head',(0,-.01*t,-.018*t));blink(.6*t)
    if isduck:rotate('Beak.lower',(1,0,0),.14*math.sin(f*.24)*t)
    key(f)
for name in ('PetPlay','PetHello'):
    action(name)
    for f,t in [(1,0),(10,.45),(22,1),(36,.65),(49,1),(61,.2),(73,0)]:
        reset();rotate('Head',(0,1,0),-.07*t);blink(.3*t if name=='PetHello' else 0)
        if isduck:rotate('Wing.L',(0,1,0),-.65*t);rotate('Wing.R',(0,1,0),.25*t)
        else:move('Paw.front.L',(0,-.025*t,.04*t));sway(.16*t)
        key(f)
action('PetWalk')
for f in range(1,62,2):
    reset();ph=(f-1)/60*math.tau
    if isduck:
        rotate('Body',(0,1,0),.035*math.sin(ph));sway(.08*math.sin(ph));move('Head',(0,0,.004*math.sin(ph*2)))
        for side,shift in [('L',0),('R',math.pi)]:move('Foot.'+side,(0,.025*math.cos(ph+shift),.025*max(0,math.sin(ph+shift))))
    else:
        hop=max(0,math.sin(ph));move('Body',(0,0,.022*hop));rotate('Head',(1,0,0),.04*math.sin(ph));sway(.10*math.sin(ph))
        for side in ('L','R'):
            move('Paw.front.'+side,(0,.018*math.cos(ph),.025*max(0,math.sin(ph))))
            move('Paw.back.'+side,(0,.020*math.cos(ph-.6),.018*max(0,math.sin(ph-.6))))
    key(f)
reset();rig.animation_data.action=bpy.data.actions['PetIdle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(1)
a.output.parent.mkdir(parents=True,exist_ok=True);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(a.output.resolve()))
print(json.dumps({'pet':pet,'source':str(a.output),'bones':len(data.bones),'actions':[act.name for act in bpy.data.actions]}))
