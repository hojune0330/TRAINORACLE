"""Read-only delivery checks; no image editing and no network calls."""
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image

art = Path(__file__).resolve().parents[1]
repo = art.parents[2]
runtime = repo / 'app/public/games/sleep-inn/tripo'
reports = []
for manifest_file in sorted(art.glob('*-manifest.json')):
    manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
    glb = runtime / manifest['runtime']['file']
    blob = glb.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', blob)
    assert magic == b'glTF' and version == 2 and length == len(blob)
    chunk_length, chunk_type = struct.unpack_from('<II', blob, 12)
    assert chunk_type == 0x4e4f534a
    document = json.loads(blob[20:20 + chunk_length])
    binary_header = 20 + chunk_length
    binary_length, binary_type = struct.unpack_from('<II', blob, binary_header)
    assert binary_type == 0x004e4942
    binary = blob[binary_header + 8:binary_header + 8 + binary_length]
    triangles = sum(document['accessors'][primitive['indices']]['count'] // 3
        for mesh in document['meshes'] for primitive in mesh['primitives'])
    assert triangles <= 6000, triangles
    assert triangles == manifest['runtime']['triangles']
    assert hashlib.sha256(blob).hexdigest() == manifest['runtime']['sha256']
    assert len(blob) < 1024 * 1024
    for texture in document.get('images', []):
        view = document['bufferViews'][texture['bufferView']]
        start = view.get('byteOffset', 0)
        with Image.open(io.BytesIO(binary[start:start + view['byteLength']])) as image:
            assert max(image.size) <= 512
    renders = []
    pixel_digests = set()
    for entry in manifest['sprites']['directions']:
        png = runtime / entry['file']
        assert hashlib.sha256(png.read_bytes()).hexdigest() == entry['sha256']
        with Image.open(png) as image:
            assert image.size == (512, 512) and image.mode == 'RGBA'
            alpha = image.getchannel('A')
            assert alpha.getextrema() == (0, 255)
            bounds = alpha.getbbox()
            assert bounds and min(bounds[:2]) > 0 and max(bounds[2:]) < 512
            # Raw pixels, rather than PNG metadata, must change with direction.
            pixel_digests.add(hashlib.sha256(image.tobytes()).hexdigest())
            renders.append({'file': png.name, 'bytes': png.stat().st_size,
                'alphaBounds': list(bounds), 'transparent': True})
    assert len(pixel_digests) == len(renders)
    source = art / 'sources' / manifest['source']['file']
    if source.exists():
        assert hashlib.sha256(source.read_bytes()).hexdigest() == manifest['source']['sha256']
    reports.append({'id': manifest['id'], 'triangles': triangles,
        'glbBytes': len(blob), 'renders': renders, 'sourceHashMatches': True if source.exists() else None})
print(json.dumps(reports, ensure_ascii=False, indent=2))
