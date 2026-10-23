"""Append the reviewed penguin and hedgehog, preserving the six earlier pets.

Run after visual review and pack-motion.py --register-reviewed. This records
actual files and charges; it does not claim a deployment or user study.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
repo = root.parent.parent
public = repo / 'app/public/games/pet-motion-v1'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
read = lambda path: json.loads(path.read_text(encoding='utf-8'))


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


generation = read(root / 'expansion-generation.json')
catalog = read(public / 'catalog.json')
manifest = read(root / 'DELIVERY.json')
motions = ['idle', 'pet', 'lie-down', 'sleep', 'wake', 'eat', 'play', 'hello', 'walk-left', 'walk-right']
prepared = []

# Check every new file before changing the aggregate receipt or credit ledger.
for task in generation['tasks']:
    pet = task['pet']
    master = root / 'working' / pet / f'{pet}-motion-v1.blend'
    rows = []
    for motion in motions:
        clip = catalog[pet][motion]
        audit = read(root / 'review/approved' / pet / f'{pet}-{motion}.json')
        sheet = public / clip['sheet']
        if sha(sheet) != audit['sheetSha256'] or sha(master) != audit['render']['sourceSha256']:
            raise ValueError(f'Changed reviewed input: {pet}/{motion}')
        if clip != audit['clip'] or audit['uniqueFrames'] < 2:
            raise ValueError(f'Changed clip metadata: {pet}/{motion}')
        with Image.open(sheet) as image:
            if image.size != (clip['columns'] * 256, clip['rows'] * 256):
                raise ValueError(f'Wrong atlas dimensions: {sheet}')
        rows.append({'motion': motion, 'sheet': clip['sheet'], 'frames': clip['frames'],
                     'bytes': sheet.stat().st_size, 'sha256': sha(sheet), 'source': master.name})
    source = root / task['source']
    prepared.append((task, master, rows, source, sha(source)))

for task, master, rows, source, source_hash in prepared:
    pet = task['pet']
    destination = root / 'masters' / pet / master.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(master, destination)
    cost = sum(operation['observedCharge'] for operation in task['operations'])
    provenance = {
        'date': generation['date'], 'tool': 'Tripo Studio Pro + Blender 4.5.14 LTS',
        'modelId': task['modelId'],
        'sourceUrl': 'https://studio.tripo3d.ai/ko/workspace/generate/' + task['modelId'],
        'visibility': 'private', 'seed': None, 'route': 'text-to-model',
        'referenceWasUploaded': False, 'reference': f'references/{pet}-master.png',
        'promptRecord': 'expansion-generation.json', 'creditsIncludingRejectedAttempts': cost,
        'exports': [{'file': source.name, 'sha256': source_hash, 'bytes': source.stat().st_size}],
        'editableMasters': [{'path': destination.relative_to(root).as_posix(),
                             'sha256': sha(destination), 'bytes': destination.stat().st_size}],
        'gameClips': rows,
        'runtimeStatus': 'registered in source; not published by this task',
        'sourcePolicy': 'Original GLB exports retained unchanged. Mesh repairs, flat materials and rig authored in separate Blender derivatives.',
        'motionSource': 'Locally authored species-specific rig and nine actions, rendered as ten clips with two walking views. No paid rig or stock humanoid animation.',
        'licenseEvidence': 'Created under the observed Pro plan/private setting; provider evidence is recorded in PRODUCTION.md.',
        'renderMethod': 'Orthographic flat colors and inverted hull outline; 512px PNG to fixed 256px WebP cells.',
    }
    save(source.parent / 'PROVENANCE.json', provenance)
    catalog[pet]['walk'] = dict(catalog[pet]['walk-right'])
    manifest['pets'][pet] = {'latestMaster': destination.relative_to(root).as_posix(),
                             'clips': rows, 'credits': cost}

if 'previousBatchChecks' not in manifest:
    manifest['previousBatchChecks'] = {'date': manifest['date'], **manifest['checks']}
manifest.update(date=generation['date'], status='eight-pets-integrated-in-source', published=False)
manifest['checks'] = {
    'assetIntegrity': 'passed: reviewed hashes, dimensions, distinct frames and render masters',
    'artReview': 'new petting, settling, feeding, greeting and walking key poses reviewed before registration',
    'typecheck': 'pending', 'browserReview': 'pending',
    'previousTestScope': 'Earlier batch tests are preserved separately and are not a fresh test run.',
}
manifest['limits'][0] = '40 other catalog pets still use their existing static art.'
manifest['uniqueSheets'] = sum(len(pet['clips']) for pet in manifest['pets'].values())
manifest['frames'] = sum(clip['frames'] for pet in manifest['pets'].values() for clip in pet['clips'])
manifest['sheetBytes'] = sum(clip['bytes'] for pet in manifest['pets'].values() for clip in pet['clips'])
manifest['expansion'] = {'pets': ['penguin', 'hedgehog'], 'uniqueSheets': 20, 'frames': 648,
                         'spentCredits': generation['spent'], 'observedBalance': generation['lastObservedBalance']}
save(root / 'DELIVERY.json', manifest)
save(public / 'catalog.json', catalog)
(repo / 'app/src/screens/pet-room/pet-motion-catalog.ts').write_text(
    "import type { PetMotionCatalog } from './pet-motion'\n\n"
    '// Generated from visually reviewed Blender clips; see character-art/pet-motion-v1.\n'
    'export const PET_MOTION_CATALOG: PetMotionCatalog = ' + json.dumps(catalog, indent=2, sort_keys=True) + '\n',
    encoding='utf-8')

ledger = read(root / 'credit-ledger.json')
old_keys = {(entry.get('taskId'), entry['operation']) for entry in ledger['tasks']}
new_entries = []
for task in generation['tasks']:
    for operation in task['operations']:
        if (task['modelId'], operation['name']) in old_keys:
            continue
        new_entries.append({'taskId': task['modelId'], 'pet': task['pet'], 'operation': operation['name'],
                            'model': 'P2.0', 'visibility': 'private', 'date': generation['date'],
                            'quotedCredits': operation['quotedCredits'], 'observedCharge': operation['observedCharge'],
                            'observedBalanceAfterSubmission': operation['balanceAfter'], 'state': 'completed-exported',
                            'input': 'expansion-generation.json'})
# Charges occurred in descending balance order, even though the prompt file groups by pet.
ledger['tasks'].extend(sorted(new_entries, key=lambda entry: -entry['observedBalanceAfterSubmission']))
ledger['checkedOn'] = generation['date']
ledger['lastObservedBalance'] = generation['lastObservedBalance']
ledger['spentThisBatch'] = ledger['startingObservedBalance'] - ledger['lastObservedBalance']
ledger['latestExpansionSpent'] = generation['spent']
ledger['status'] = 'eight-models-exported-80-reviewed-game-sheets-registered'
ledger['latestQuote'] = {'model': 'P2.0', 'count': 1, 'displayedCredits': 100, 'visibility': 'private'}
ledger['note'] = '1,000 credits used across both batches, including 200 for rejected rabbit meshes. Latest expansion used 220; observed balance 1,060. Eight species with ten unique sheets each are source-integrated. No new subscription, API purchase or production publication.'
save(root / 'credit-ledger.json', ledger)
print(json.dumps({key: manifest[key] for key in ('uniqueSheets', 'frames', 'sheetBytes', 'published')}))
