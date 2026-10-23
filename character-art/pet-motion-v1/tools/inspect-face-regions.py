"""Locate facial color islands in a downloaded textured animal mesh."""
import argparse,json,sys
from pathlib import Path
import bpy
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--texture',required=True);p.add_argument('--out',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=a.source)
m=next(o for o in bpy.context.scene.objects if o.type=='MESH')
img=bpy.data.images.load(a.texture);px=list(img.pixels);w,h=img.size;uv=m.data.uv_layers.active.data
def sample(loop):
    u,v=uv[loop].uv;off=4*(int(v*(h-1))%h*w+int(u*(w-1))%w)
    return px[off:off+3]
dark=set()
for poly in m.data.polygons:
    if sum(max(sample(i)) for i in poly.loop_indices)/len(poly.vertices)<.25:
        dark.update(poly.vertices)
adj=[set() for _ in m.data.vertices]
for e in m.data.edges:
    i,j=e.vertices
    if i in dark and j in dark:adj[i].add(j);adj[j].add(i)
regions=[]
while dark:
    stack=[dark.pop()];part=[]
    while stack:
        i=stack.pop();part.append(i)
        for j in adj[i]:
            if j in dark:dark.remove(j);stack.append(j)
    if len(part)<3:continue
    pts=[m.data.vertices[i].co for i in part];center=sum(pts,Vector())/len(pts)
    regions.append({'vertices':len(part),'center':list(center),'min':[min(v[i] for v in pts) for i in range(3)],'max':[max(v[i] for v in pts) for i in range(3)]})
Path(a.out).write_text(json.dumps(sorted(regions,key=lambda r:-r['vertices']),indent=2))
