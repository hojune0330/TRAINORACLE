"""Render the ten reviewed per-species actions without changing their master.

This batch does not approve/register outputs. Review key poses first, then use
pack-motion.py --register-reviewed to publish the resulting sprite atlases.
"""
import argparse, subprocess, sys
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--blender',required=True)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--pet',required=True)
p.add_argument('--azimuth',type=float,default=35)
p.add_argument('--ortho',type=float,default=1.65)
p.add_argument('--target-height',type=float,default=.50)
p.add_argument('--only',nargs='*')
a=p.parse_args()
root=Path(__file__).resolve().parent.parent
clips=[('pet','PetStroke',30,False),('lie-down','PetLieDown',30,False),
       ('idle','PetIdle',48,True),('sleep','PetSleep',36,True),
       ('wake','PetWake',30,False),('eat','PetEat',30,False),
       ('play','PetPlay',30,False),('hello','PetHello',30,False),
       ('walk-left','PetWalk',30,True),('walk-right','PetWalk',30,True)]
for motion,action,frames,loop in clips:
    if a.only and motion not in a.only:continue
    destination=root/'renders'/a.pet/motion
    destination.mkdir(parents=True,exist_ok=True)
    cam=65 if motion=='walk-left' else -65 if motion=='walk-right' else a.azimuth
    command=[a.blender,'--background','--factory-startup','--disable-autoexec','--python-exit-code','1',
             '--python',str(root/'tools/render-clip.py'),'--','--source',str(a.source.resolve()),
             '--action',action,'--output',str(destination),'--frames',str(frames),'--fps','12',
             '--flat','--azimuth',str(cam),'--elevation','10','--ortho',str(a.ortho),
             '--target-height',str(a.target_height)]+(['--loop'] if loop else [])
    with (destination/'blender.log').open('w',encoding='utf-8') as log:
        subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,check=True)
    print(a.pet,motion,frames,'rendered',flush=True)
