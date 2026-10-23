"""Measure contact on this cat's authored poses; no automatic body bob correction."""
import argparse,json,sys
from pathlib import Path
import bpy

p=argparse.ArgumentParser()
p.add_argument('--source',type=Path,required=True)
p.add_argument('--report',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(a.source.resolve()),load_ui=False)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('tripo_node'))
# Disable only subdivision during measurement to preserve original vertex ids.
for mod in mesh.modifiers:
    if mod.type=='SUBSURF':mod.show_viewport=False
groups={}
for vertex in mesh.data.vertices:
    if vertex.co.z>.09:continue
    label=('front' if vertex.co.y<-.05 else 'back')+('-left' if vertex.co.x>0 else '-right')
    groups.setdefault(label,[]).append(vertex.index)
report={}
for name,frames in [('PetIdle',[1]),('PetLieDown',[1,25,40,55,73]),('TripoOriginalWalk',[1,20,40,60,78])]:
    rig.animation_data.action=None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
        for constraint in bone.constraints:
            if constraint.type=='IK':constraint.influence=0
    act=bpy.data.actions[name]
    rig.animation_data.action=act
    rig.animation_data.action_slot=act.slots[0]
    samples=[]
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        vertices=ev.data.vertices
        samples.append({'frame':frame,'minZ':min((ev.matrix_world@v.co).z for v in vertices),'paws':{label: min((ev.matrix_world@vertices[i].co).z for i in indices) for label,indices in groups.items()}})
        if name=='PetLieDown' and frame==55:
            samples[-1]['lowest']=[{'id':v.index,'rest':list(mesh.data.vertices[v.index].co),'posed':list(ev.matrix_world@v.co),'weights':[(mesh.vertex_groups[g.group].name,round(g.weight,3)) for g in mesh.data.vertices[v.index].groups if g.weight>.1]} for v in sorted(vertices,key=lambda v:(ev.matrix_world@v.co).z)[:4]]
    report[name]=samples
a.report.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
