"""Export reviewed Run-BTI atlases. Install Pillow and NumPy, then see FIRST_LAP_ART.md."""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# Each column is one animal, in the same order in the miniature, face and silhouette rows.
ANIMALS = {
    "cdeb2c36-02e5-4ee6-96f7-e969f33931cd": "distance speed numbers senses",
    "ebfd2d2f-7118-44a7-8ed2-b09c0bbbf9de": "familiar explore plan improvise",
    "23d507cf-4d9b-486e-a186-90b38fbef886": "distance-numbers distance-senses speed-numbers speed-senses",
    "cf1abbff-d350-4d50-8a22-1c3d9e267fbd": "distance-familiar distance-explore speed-familiar speed-explore",
    "3a26dcc3-9dbd-4eda-bdf4-778053e4d5c1": "distance-plan distance-improvise speed-plan speed-improvise",
    "36108555-1ac8-4704-a078-3cf3da609ade": "numbers-familiar numbers-explore senses-familiar senses-explore",
    "e389eace-db1c-4ad8-ba03-627c0fbc157b": "numbers-plan numbers-improvise senses-plan senses-improvise",
    "908f920d-a446-4bde-b63f-f141c7c4772f": "familiar-plan familiar-improvise explore-plan explore-improvise",
}
ROOKIE = "3a08b2ba-7792-4375-9e4a-5f01a6999eee"
SCENERY = "3fbb99ac-4246-4658-86f1-d0a9edd3ac38"
BARE_OUTLINES = "54b08228-84c2-4581-8040-c67a628221b2"

def gutters(weights, count):
    length = len(weights)
    cuts = [0]
    for index in range(1, count):
        expected = length * index / count
        radius = int(length / count * 0.17)
        search = range(round(expected) - radius, round(expected) + radius + 1)
        cuts.append(min(search, key=lambda x: (sum(weights[x-2:x+3]), abs(x-expected))))
    return cuts + [length]

def read_cells(sheet, columns, rows):
    ink = np.asarray(sheet.getchannel("A")) > 138
    y_edges = gutters(ink.sum(axis=1), rows)
    cells = []
    for top, bottom in zip(y_edges, y_edges[1:]):
        x_edges = gutters(ink[top:bottom].sum(axis=0), columns)
        for left, right in zip(x_edges, x_edges[1:]):
            cell = sheet.crop((left, top, right, bottom))
            alpha = np.asarray(cell.getchannel("A"), dtype=float)
            alpha = (np.clip((alpha - 30) / 218, 0, 1) * 255).astype("uint8")
            cell.putalpha(Image.fromarray(alpha))
            y, x = np.where(alpha > 100)
            if not len(x):
                raise ValueError("Atlas contains an empty cell.")
            cells.append(cell.crop((max(0,x.min()-3), max(0,y.min()-3),
                                    min(cell.width,x.max()+4), min(cell.height,y.max()+4))))
    return cells

def write_chip(source, folder, name, size, silhouette=False):
    pixels = np.asarray(source)
    rgb = pixels[:,:,:3].astype(float)
    alpha = pixels[:,:,3].astype(float)
    if silhouette:
        coverage = np.clip((140 - rgb.mean(axis=2)) / 40, 0, 1)
        image = Image.new("RGBA", source.size, (43,44,66))
        image.putalpha(Image.fromarray(np.uint8(alpha * coverage)))
    else:
        # Remove only pale or translucent regions connected to the outside.
        # This preserves the penguin's belly and the rookie's blank bib.
        pale = (rgb.min(axis=2) > 158) & (rgb.max(axis=2) - rgb.min(axis=2) < 40)
        floodable = np.pad(pale | (alpha < 140), 1, constant_values=True)
        flood = Image.fromarray(floodable.astype("uint8")).copy()
        ImageDraw.floodfill(flood, (0,0), 2)
        alpha[np.asarray(flood)[1:-1,1:-1] == 2] = 0
        image = source.copy()
        image.putalpha(Image.fromarray(alpha.astype("uint8")))
    box = image.getchannel("A").point(lambda x: 255 if x > 95 else 0).getbbox()
    if box is None:
        raise ValueError(f"No opaque illustration in {name}")
    image = image.crop((max(0,box[0]-2), max(0,box[1]-2),
                        min(image.width,box[2]+2),min(image.height,box[3]+2)))
    inset = round(size * .045)
    image.thumbnail((size - 2*inset, size - 2*inset), Image.Resampling.LANCZOS)
    tile = Image.new("RGBA", (size,size))
    tile.alpha_composite(image, ((size-image.width)//2, (size-image.height)//2))
    tile.save(folder / (name + ".webp"), quality=90, method=5, exact=True)

def export(source, destination):
    destination.mkdir(parents=True, exist_ok=True)
    def load(atlas_id):
        with Image.open(source / ("exec-" + atlas_id + ".png")) as sheet:
            return sheet.convert("RGBA")
    for atlas_id, keys in ANIMALS.items():
        cells = read_cells(load(atlas_id), 4, 3)
        for row,(kind,size) in enumerate([("mini",192), ("face",96), ("silhouette",96)]):
            for index,key in enumerate(keys.split()):
                write_chip(cells[row*4+index], destination, kind+"-"+key, size, kind=="silhouette")
    bare = read_cells(load(BARE_OUTLINES), 4, 1)
    for image,key in zip(bare, ["explore-plan","explore-improvise","senses-improvise","familiar-plan"]):
        write_chip(image, destination, "silhouette-"+key, 96, True)
    poses = "rookie-tie rookie-ready rookie-bag rookie-look rookie-run rookie-give rookie-wave bag"
    for image,pose in zip(read_cells(load(ROOKIE),4,2), poses.split()):
        write_chip(image, destination, pose, 240)
    scenery = load(SCENERY).convert("RGB")
    width, height = scenery.size
    for index,stage in enumerate("door track lap fork turn dusk straight finish".split()):
        x, y = index % 2, index // 2
        scene = scenery.crop((round(width*x/2)+2, round(height*y/4)+2,
                              round(width*(x+1)/2)-2, round(height*(y+1)/4)-2))
        scene.thumbnail((600,300), Image.Resampling.LANCZOS)
        scene.save(destination / ("stage-" + stage + ".webp"), quality=81, method=5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("masters", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    export(args.masters, args.destination)
