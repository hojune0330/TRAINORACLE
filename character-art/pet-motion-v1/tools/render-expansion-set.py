"""Render the new pets in one Blender process; never auto-approve art."""
import argparse, hashlib, json, runpy, sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--pet',choices=['penguin','hedgehog'],required=True);p.add_argument('--proof',action='store_true')
p.add_argument('--resume', action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(__file__).resolve().parent.parent
clips=[('idle','PetIdle',48,True),('pet','PetStroke',30,False),('lie-down','PetLieDown',30,False),
       ('sleep','PetSleep',36,True),('wake','PetWake',30,False),('eat','PetEat',30,False),
       ('play','PetPlay',30,False),('hello','PetHello',30,False),('walk-left','PetWalk',30,True),('walk-right','PetWalk',30,True)]
for motion,action,count,loop in clips:
    if a.proof and motion not in ('pet','lie-down','walk-left','hello','eat'):continue
    out=root/('review/expansion-poses' if a.proof else 'renders')/a.pet/motion
    source=root/'working'/a.pet/(a.pet+'-motion-v1.blend')
    total=5 if a.proof else count
    if a.resume and (out/'render.json').exists():
        previous=json.loads((out/'render.json').read_text(encoding='utf-8'))
        if previous['sourceSha256']==hashlib.sha256(source.read_bytes()).hexdigest() and previous['frames']==total and previous.get('outline')=='inverted-hull' and all((out/f'{i:03}.png').exists() for i in range(total)):
            print(a.pet,motion,'already rendered',flush=True)
            continue
    yaw=65 if motion=='walk-left' else -65 if motion=='walk-right' else 25
    sys.argv=['render-clip.py','--','--source',str(root/'working'/a.pet/(a.pet+'-motion-v1.blend')),
              '--action',action,'--output',str(out),'--frames',str(5 if a.proof else count),
              '--fps','12','--size',str(256 if a.proof else 512),'--flat','--outline-hull','--azimuth',str(yaw),
              '--elevation','10','--ortho','1.65','--target-height','.50']+(['--loop'] if loop else [])
    runpy.run_path(str(root/'tools/render-clip.py'),run_name='__main__')
    print(a.pet,motion,'rendered',flush=True)
