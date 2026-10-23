"""Read-only inventory of downloaded rigs. Run Blender with --disable-autoexec."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def mesh_parts(obj):
    adjacency = [[] for _ in obj.data.vertices]
    for edge in obj.data.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)
    unseen = set(range(len(adjacency)))
    parts = []
    while unseen:
        pending = [unseen.pop()]
        indices = []
        while pending:
            index = pending.pop()
            indices.append(index)
            for other in adjacency[index]:
                if other in unseen:
                    unseen.remove(other)
                    pending.append(other)
        points = [obj.matrix_world @ obj.data.vertices[index].co for index in indices]
        low = [min(p[i] for p in points) for i in range(3)]
        high = [max(p[i] for p in points) for i in range(3)]
        parts.append({'vertices': len(indices), 'min': low, 'max': high})
    return sorted(parts, key=lambda part: -part['vertices'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if args.source.suffix.lower() in {".glb", ".gltf"}:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
    elif args.source.suffix.lower() == '.fbx':
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=str(args.source.resolve()))
    else:
        bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()), load_ui=False)
    rigs = []
    for obj in bpy.data.objects:
        if obj.type != "ARMATURE":
            continue
        rigs.append({
            "name": obj.name,
            "library": obj.library.filepath if obj.library else None,
            "scale": list(obj.scale),
            "bones": [{"name": bone.name, "parent": bone.parent.name if bone.parent else None,
                       "head": list(bone.head_local), "tail": list(bone.tail_local),
                       "deform": bone.use_deform} for bone in obj.data.bones],
            "action": obj.animation_data.action.name if obj.animation_data and obj.animation_data.action else None,
        })
    report = {
        "source": str(args.source), "blender": bpy.app.version_string,
        "frameRange": [bpy.context.scene.frame_start, bpy.context.scene.frame_end],
        "fps": bpy.context.scene.render.fps, "rigs": rigs,
        "actions": [{"name": action.name, "frames": list(action.frame_range),
                     "slots": [slot.identifier for slot in action.slots]} for action in bpy.data.actions],
        "meshes": [{"name": obj.name, "vertices": len(obj.data.vertices),
                    "faces": len(obj.data.polygons), "dimensions": list(obj.dimensions),
                    "materials": [material.name for material in obj.data.materials],
                    "parts": mesh_parts(obj)}
                   for obj in bpy.data.objects if obj.type == "MESH"],
        "missingLibraries": [lib.filepath for lib in bpy.data.libraries
                             if not Path(bpy.path.abspath(lib.filepath)).exists()],
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"rigs": len(rigs), "actions": len(report["actions"]),
                      "missingLibraries": report["missingLibraries"], "report": str(args.report)}))


main()
