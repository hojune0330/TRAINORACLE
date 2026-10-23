"""Author Mongshil/Bamtol from their actual Tripo meshes, preserving originals.

The bird waddles on separate feet; the hedgehog keeps four short paws. Each has
its own weights and settling pose. No paid stock humanoid rig is used.
"""
import argparse, bmesh, bpy, json, math, sys
from pathlib import Path
from mathutils import Vector, Quaternion

p=argparse.ArgumentParser();p.add_argument('--pet',choices=['penguin','hedgehog'],required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);pet=a.pet;bird=pet=='penguin'
root=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(root/'working'/pet/'prepared-source.blend'),load_ui=False)
scene=bpy.context.scene;scene.render.fps=30
mesh=next(o for o in scene.objects if o.type=='MESH')

def parts():
    adj=[[] for _ in mesh.data.vertices]
    for e in mesh.data.edges:
        i,j=e.vertices;adj[i].append(j);adj[j].append(i)
    left=set(range(len(adj)));groups=[]
    while left:
        stack=[left.pop()];ids=[]
        while stack:
            i=stack.pop();ids.append(i)
            for j in adj[i]:
                if j in left:left.remove(j);stack.append(j)
        groups.append(ids)
    return sorted(groups,key=len,reverse=True)

groups=parts()
if not bird:
    # The 75-point disk is an unwanted support, the small islands are individual
    # quills/tail. Retain the six reviewed back/face/ear/eye components only.
    keep={i for g in groups[:6] for i in g}
    bm=bmesh.new();bm.from_mesh(mesh.data);bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in keep],context='VERTS')
    bm.to_mesh(mesh.data);bm.free()
    # Shorten the lower legs, keeping all contact points on z=0.
    for v in mesh.data.vertices:v.co.z=v.co.z*.48 if v.co.z<.15 else v.co.z-.078
    groups=parts()
sizes={i:len(g) for g in groups for i in g}
eye_groups=[g for g in groups if len(g)==(209 if bird else 111)]
if len(eye_groups)!=2:raise ValueError('Expected two reviewed eye components')
centers=[sum((mesh.data.vertices[i].co for i in g),Vector())/len(g) for g in eye_groups]
eyeids={i for g in eye_groups for i in g}

def rgba(hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
def mat(name,color):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=rgba(color)
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgba(color)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1
    return m
base=mat(pet+' coat','747d90' if bird else 'ad8162');cream=mat(pet+' cream','fff0d8')
dark=mat(pet+' eyes and nose','573a2c');orange=mat(pet+' feet','f5b157');pink=mat(pet+' blush','efb4a6')
mesh.data.materials.clear()
for m in (base,cream,dark,orange,pink):mesh.data.materials.append(m)
rest=mesh.data.attributes.new('pet_rest_position','FLOAT_VECTOR','POINT')
for v,item in zip(mesh.data.vertices,rest.data):item.vector=v.co

def paint(material):
    nodes=material.node_tree.nodes;links=material.node_tree.links
    n=nodes.new('ShaderNodeAttribute');n.attribute_name='pet_rest_position'
    sep=nodes.new('ShaderNodeSeparateXYZ');links.new(n.outputs['Vector'],sep.inputs[0])
    x,y,z=[sep.outputs[k] for k in ('X','Y','Z')]
    def op(kind,*values):
        n=nodes.new('ShaderNodeMath');n.operation=kind
        for i,v in enumerate(values):
            if isinstance(v,(float,int)):n.inputs[i].default_value=v
            else:links.new(v,n.inputs[i])
        return n.outputs[0]
    def oval(cx,cz,rx,rz):
        u=op('DIVIDE',op('SUBTRACT',x,cx),rx);v=op('DIVIDE',op('SUBTRACT',z,cz),rz)
        return op('LESS_THAN',op('ADD',op('MULTIPLY',u,u),op('MULTIPLY',v,v)),1)
    def mix(mask,a,b):
        n=nodes.new('ShaderNodeMixRGB');links.new(mask,n.inputs[0])
        if isinstance(a,str):n.inputs[1].default_value=rgba(a)
        else:links.new(a,n.inputs[1])
        n.inputs[2].default_value=rgba(b);return n.outputs[0]
    if bird:
        face=op('MAXIMUM',oval(-.125,.62,.15,.20),oval(.125,.62,.15,.20))
        body=oval(0,.29,.25,.26)
        mask=op('MULTIPLY',op('MAXIMUM',face,body),op('LESS_THAN',y,-.14))
        color=mix(mask,'747d90','fff0d8')
        cheek=op('MULTIPLY',op('MAXIMUM',oval(-.195,.55,.040,.032),oval(.195,.55,.040,.032)),op('LESS_THAN',y,-.20))
        color=mix(cheek,color,'efb4a6')
        bill=op('MULTIPLY',op('LESS_THAN',y,-.32),op('MULTIPLY',op('GREATER_THAN',z,.48),op('LESS_THAN',z,.64)))
        color=mix(bill,color,'f5b157')
    else:
        color=mix(op('LESS_THAN',z,.058),'fff0d8','ad8162')
        nose=op('MULTIPLY',op('LESS_THAN',y,-.473),oval(.008,.266,.058,.045))
        color=mix(nose,color,'573a2c')
        blush=op('MULTIPLY',op('MAXIMUM',oval(-.177,.273,.040,.029),oval(.194,.273,.040,.029)),op('LESS_THAN',y,-.34))
        color=mix(blush,color,'efb4a6')
    links.new(color,nodes['Principled BSDF'].inputs['Base Color'])
paint(base if bird else cream)
for poly in mesh.data.polygons:
    size=sizes[poly.vertices[0]];poly.use_smooth=True
    poly.material_index=2 if all(i in eyeids for i in poly.vertices) else ((3 if size==388 else 0) if bird else (0 if size==2115 else 1))
for g,c in zip(eye_groups,centers):
    for i in g:
        off=mesh.data.vertices[i].co-c
        mesh.data.vertices[i].co=c+Vector((off.x*.75,off.y*.36,off.z*.86))+Vector((0,-.004,0))

data=bpy.data.armatures.new(pet+' editable skeleton');rig=bpy.data.objects.new(pet+' rig',data)
scene.collection.objects.link(rig);bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
    b=data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=data.edit_bones[parent]
bone('Root',(0,0,0),(0,0,.08))
bone('Body',(0,.02,.12),(0,.02,.40),'Root')
bone('Head',(0,-.10,.49) if bird else (0,-.22,.22),(0,-.10,.78) if bird else (0,-.22,.45),'Body')
for i,c in enumerate(centers):bone('Eye.'+str(i),c,c+Vector((0,0,.05)),'Head')
for side,sign in [('L',1),('R',-1)]:
    if bird:
        bone('Wing.'+side,(sign*.31,-.01,.48),(sign*.46,-.01,.27),'Body')
        bone('Foot.'+side,(sign*.185,-.005,.04),(sign*.185,-.105,.015),'Root')
    else:
        bone('Ear.'+side,(sign*.25,-.29,.45),(sign*.28,-.29,.52),'Head')
        bone('Paw.front.'+side,(sign*.20,-.25,.07),(sign*.20,-.34,.015),'Root')
        bone('Paw.back.'+side,(sign*.25,.20,.07),(sign*.25,.14,.015),'Root')
bpy.ops.object.mode_set(mode='OBJECT')
for b in data.bones:mesh.vertex_groups.new(name=b.name)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def weights(i,w):
    total=sum(w.values())
    for name,value in w.items():
        if value>0:mesh.vertex_groups[name].add([i],value/total,'REPLACE')
for v in mesh.data.vertices:
    if v.index in eyeids:continue
    x,y,z=v.co;size=sizes[v.index];side='L' if x>0 else 'R'
    if bird:
        if size==388:w={'Foot.'+side:1}
        elif abs(x)>.30 and z<.53:
            t=smooth((abs(x)-.30)/.08);w={'Wing.'+side:t,'Body':1-t}
        else:
            t=smooth((z-.30)/.37);w={'Head':t,'Body':1-t}
    else:
        if size==2115:w={'Body':1}
        elif size==142:w={'Ear.'+side:1}
        elif z<.12 and abs(x)>.10:
            t=smooth((.12-z)/.055);w={'Paw.'+('front.' if y<-.08 else 'back.')+side:t,'Body':1-t}
        else:
            t=smooth((-.12-y)/.14)*smooth((z-.10)/.10);w={'Head':t,'Body':1-t}
    weights(v.index,w)
for i,g in enumerate(eye_groups):mesh.vertex_groups['Eye.'+str(i)].add(g,1,'REPLACE')
mesh.parent=rig;mesh.modifiers.new('Pet deformation','ARMATURE').object=rig
sub=mesh.modifiers.new('Soft silhouette','SUBSURF');sub.levels=sub.render_levels=1

def reset():
    for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
def rotate(name,axis,amount):
    b=rig.pose.bones[name];b.rotation_quaternion=Quaternion(b.bone.matrix_local.to_quaternion().inverted()@Vector(axis),amount)
def move(name,v):
    b=rig.pose.bones[name];b.location=b.bone.matrix_local.to_quaternion().inverted()@Vector(v)
def blink(t):
    for i in range(2):rig.pose.bones['Eye.'+str(i)].scale=(1,max(.045,1-t),1)
def key(f):
    for b in rig.pose.bones:
        for channel in ('location','rotation_quaternion','scale'):b.keyframe_insert(data_path=channel,frame=f,group=b.name)
def action(name):
    reset();act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=act
def sides(t):
    for side,sign in [('L',1),('R',-1)]:rotate(('Wing.' if bird else 'Ear.')+side,(0,1,0),sign*t)
def rest(t,breath=0):
    move('Body',(0,0,(-.025 if bird else -.018)*t+breath))
    move('Head',(0,-.018*t,(-.028 if bird else -.045)*t))
    rotate('Head',(1,0,0),(.12 if bird else .10)*t)
    if bird:
        for side in ('L','R'):move('Foot.'+side,(0,.045*t,.004*t))
    sides(.10*t);blink(t)

action('PetIdle')
for f in range(1,122,4):
    reset();ph=(f-1)/120*math.tau;rotate('Head',(0,1,0),.022*math.sin(ph));sides(.022*math.sin(ph));blink(max(0,1-abs(f-85)/5));key(f)
action('PetStroke')
for f,t in [(1,0),(9,.4),(20,1),(36,.80),(48,1),(61,.35),(73,0)]:
    reset();rotate('Head',(0,1,0),-.13*t);sides(.10*t);blink(.98*t);key(f)
for name,seq in [('PetLieDown',[(1,0),(12,.12),(25,.4),(40,.75),(55,1),(73,1)]),('PetWake',[(1,1),(15,1),(25,.8),(40,.3),(58,0),(73,0)])]:
    action(name)
    for f,t in seq:reset();rest(t);key(f)
action('PetSleep')
for f in range(1,98,4):reset();rest(1,.0015*math.sin((f-1)/96*math.tau));key(f)
action('PetEat')
for f,t in [(1,0),(12,.6),(25,1),(34,.83),(43,1),(52,.83),(61,1),(73,0)]:
    reset();rotate('Head',(1,0,0),.20*t);move('Head',(0,-.015*t,-.023*t));blink(.55*t);key(f)
for name in ('PetPlay','PetHello'):
    action(name)
    for f,t in [(1,0),(10,.4),(22,1),(36,.55),(49,1),(61,.2),(73,0)]:
        reset();rotate('Head',(0,1,0),-.07*t);blink(.3*t if name=='PetHello' else 0)
        if bird:rotate('Wing.L',(0,1,0),-.60*t);rotate('Wing.R',(0,1,0),.24*t)
        else:move('Paw.front.L',(0,-.035*t,.040*t));sides(.12*t)
        key(f)
action('PetWalk')
for f in range(1,62,2):
    reset();ph=(f-1)/60*math.tau
    rotate('Body',(0,1,0),(.045 if bird else .018)*math.sin(ph))
    rotate('Head',(0,1,0),-.022*math.sin(ph));sides(.065*math.sin(ph))
    if bird:
        for side,shift in [('L',0),('R',math.pi)]:move('Foot.'+side,(0,.027*math.cos(ph+shift),.024*max(0,math.sin(ph+shift))))
    else:
        for pair,shift in [('front.L',0),('front.R',math.pi),('back.L',math.pi),('back.R',0)]:
            move('Paw.'+pair,(0,.020*math.cos(ph+shift),.016*max(0,math.sin(ph+shift))))
    key(f)
reset();rig.animation_data.action=bpy.data.actions['PetIdle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(1)
out=root/'working'/pet/(pet+'-motion-v1.blend');bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out))
print(json.dumps({'pet':pet,'meshVertices':len(mesh.data.vertices),'bones':len(data.bones),'actions':[a.name for a in bpy.data.actions],'output':str(out)}),flush=True)
