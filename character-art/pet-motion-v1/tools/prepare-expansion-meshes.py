"""Prepare new Tripo exports for local editing; originals remain untouched."""
import bpy, bmesh, json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent.parent
for pet,filename in [('penguin','original-textured.glb'),('hedgehog','original-mesh.glb')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root/'sources/tripo'/pet/filename))
    mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.context.view_layer.objects.active=mesh;mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # GLB duplicates vertices at UV seams. Merge only coincident seam points,
    # before any rig, weights, or actions exist; loop UVs remain on the faces.
    if pet=='penguin':
        bm=bmesh.new();bm.from_mesh(mesh.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
        bm.to_mesh(mesh.data);bm.free()
    adj=[[] for _ in mesh.data.vertices]
    for e in mesh.data.edges:
        i,j=e.vertices;adj[i].append(j);adj[j].append(i)
    unseen=set(range(len(adj)));parts=[]
    while unseen:
        stack=[unseen.pop()];ids=[]
        while stack:
            i=stack.pop();ids.append(i)
            for j in adj[i]:
                if j in unseen:unseen.remove(j);stack.append(j)
        coords=[mesh.data.vertices[i].co for i in ids]
        parts.append({'vertices':len(ids),'min':[round(min(v[k] for v in coords),5) for k in range(3)],'max':[round(max(v[k] for v in coords),5) for k in range(3)]})
    parts.sort(key=lambda p:-p['vertices'])
    out=root/'working'/pet;out.mkdir(parents=True,exist_ok=True)
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'prepared-source.blend'))
    (out/'parts.json').write_text(json.dumps(parts,indent=2))
    print(pet,json.dumps(parts),flush=True)
