"""Pack Blender frames without per-frame cropping; register only reviewed clips.

No input painting or image generation happens here. The same 256px cell preserves
the camera and ground line of every authored frame. Original PNGs remain intact.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from PIL import Image

MOTIONS = {'idle', 'walk', 'walk-left', 'walk-right', 'pet', 'eat', 'play', 'lie-down', 'sleep', 'wake', 'hello'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--frames', type=Path, required=True)
    parser.add_argument('--pet', required=True)
    parser.add_argument('--motion', choices=sorted(MOTIONS), required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--cell', type=int, default=256)
    parser.add_argument('--columns', type=int, default=8)
    parser.add_argument('--quality', type=int, default=90)
    parser.add_argument('--rest-frame', type=int)
    parser.add_argument('--loop', action='store_true')
    parser.add_argument('--register-reviewed', type=Path, metavar='REPO_ROOT')
    args = parser.parse_args()
    if not re.fullmatch('[a-z][a-z0-9-]*', args.pet):
        raise ValueError('Invalid pet ID')
    metadata = json.loads((args.frames / 'render.json').read_text(encoding='utf-8'))
    if args.loop != metadata.get('loop', False):
        raise ValueError('The render and player must agree on whether this is a loop')
    frame_count = metadata['frames']
    if not 2 <= frame_count <= 96 or not 1 <= args.columns <= 8 or not 64 <= args.cell <= 512 or not 80 <= args.quality <= 100:
        raise ValueError('Invalid atlas dimensions')
    frames = []
    bounds = []
    hashes = []
    for index in range(frame_count):
        path = args.frames / f'{index:03}.png'
        frame = Image.open(path).convert('RGBA')
        if frame.width != metadata['size'] or frame.height != metadata['size']:
            raise ValueError(f'Frame size changed: {path}')
        bounds.append(frame.getchannel('A').getbbox())
        if bounds[-1] is None:
            raise ValueError(f'Empty frame: {path}')
        if min(bounds[-1][:2]) <= 1 or max(bounds[-1][2:]) >= frame.width - 1:
            raise ValueError(f'Art touches the frame edge: {path}')
        hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
        frames.append(frame.resize((args.cell, args.cell), Image.Resampling.LANCZOS))
    if len(set(hashes)) < 2:
        raise ValueError('Every frame is identical; this is not an animation')
    columns = min(args.columns, frame_count)
    rows = math.ceil(frame_count / columns)
    atlas = Image.new('RGBA', (columns * args.cell, rows * args.cell))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, ((index % columns) * args.cell, (index // columns) * args.cell))
    args.output.mkdir(parents=True, exist_ok=True)
    name = f'{args.pet}-{args.motion}'
    destination = args.output / f'{name}.webp'
    atlas.save(destination, 'WEBP', quality=args.quality, alpha_quality=100, method=4)
    review_output = (args.register_reviewed.resolve() / 'character-art/pet-motion-v1/review/approved' / args.pet) if args.register_reviewed else args.output
    review_output.mkdir(parents=True, exist_ok=True)
    frames[0].save(review_output / f'{name}.preview.webp', 'WEBP', save_all=True, append_images=frames[1:], duration=round(1000 / metadata['fps']), loop=0, quality=args.quality, alpha_quality=100, method=4)
    rest = args.rest_frame if args.rest_frame is not None else (0 if args.loop else frame_count - 1)
    if not 0 <= rest < frame_count:
        raise ValueError('Reduced-motion rest pose is outside the clip')
    clip = {'sheet': f'{name}.webp', 'columns': columns, 'rows': rows, 'frames': frame_count,
            'fps': metadata['fps'], 'loop': args.loop, 'restFrame': rest}
    audit = {'pet': args.pet, 'motion': args.motion, 'render': metadata, 'clip': clip,
             'frameBounds': bounds, 'uniqueFrames': len(set(hashes)),
             'sheetBytes': destination.stat().st_size, 'quality': args.quality, 'sheetSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
             'registered': bool(args.register_reviewed)}
    (review_output / f'{name}.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    if args.register_reviewed:
        root = args.register_reviewed.resolve()
        public = root / 'app/public/games/pet-motion-v1'
        if args.output.resolve() != public:
            raise ValueError('Reviewed clips must be written into the game asset directory')
        catalog_path = public / 'catalog.json'
        catalog = json.loads(catalog_path.read_text(encoding='utf-8')) if catalog_path.exists() else {}
        catalog.setdefault(args.pet, {})[args.motion] = clip
        catalog_path.write_text(json.dumps(catalog, indent=2, sort_keys=True) + '\n', encoding='utf-8')
        module = root / 'app/src/screens/pet-room/pet-motion-catalog.ts'
        module.write_text("import type { PetMotionCatalog } from './pet-motion'\n\n"
                          '// Generated from visually reviewed Blender clips; see character-art/pet-motion-v1.\n'
                          'export const PET_MOTION_CATALOG: PetMotionCatalog = '
                          + json.dumps(catalog, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({'file': str(destination), 'frames': frame_count, 'bytes': destination.stat().st_size,
                      'registered': bool(args.register_reviewed)}))


if __name__ == '__main__':
    main()
