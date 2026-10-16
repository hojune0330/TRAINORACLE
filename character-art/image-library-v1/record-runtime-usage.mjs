import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const plan=JSON.parse(readFileSync(resolve(root,'production-plan.json'),'utf8'));
const prepared=new Set(['world-road-barrier','world-bounce-pad','world-rotating-sweeper','world-respawn-beacon']);
const fallback=new Set(['world-rock-cluster','world-jump-hurdle']);
const worldRoles={
 'world-tree-broadleaf':'Non-Seoul scenery tree; Seoul tree fallback',
 'world-rock-cluster':'Fallback only when existing Tripo rock fails to load',
 'world-jump-hurdle':'Fallback only when existing Tripo hurdle fails to load',
 'world-mud-patch':'Seoul mud ground decoration',
 'world-short-bridge':'Mud-region background bridge, outside the play lane',
 'world-grass-island':'Non-Seoul daytime field background, outside the play lane',
};
const fxRoles={
 'fx-hit-burst':'Tower hit, runner collision, friend push collision',
 'fx-cannon-blast':'Cannon hit in classic tower defense',
 'fx-frost-burst':'Frost hit in classic tower defense',
 'fx-dash-trail':'Runner and friend push dash',
 'fx-upgrade-burst':'Tower construction/upgrade and runner upgrade selection',
 'reward-victory-medal':'Confirmed defense/solo win result',
 'reward-star':'Solo series completion with draw/loss; decorative completion marker, not a star rating',
 'reward-treasure-chest':'Legacy solo defense completion; decorative result marker, no inventory reward granted',
};
const assets=plan.assets.map(a=>({
 id:a.id,
 status:prepared.has(a.id)?'prepared-not-used':fallback.has(a.id)?'fallback-connected':'primary-connected',
 consumer:a.group==='defense'?'TowerDefense.tsx / TowerDefenseBoard.tsx':a.group==='fx'?'party-art.ts / TowerDefenseBoard.tsx / SoloParty.tsx / UpgradeChoice.tsx':'scene-art.ts / city-art.ts',
 role:prepared.has(a.id)?'Runtime file prepared; existing Tripo counterpart retained':worldRoles[a.id]??fxRoles[a.id]??a.role,
 runtimeFile:`app/public/game/image-library-v1/${a.group}/${a.id}.webp`,
}));
const usage={schemaVersion:1,date:'2026-10-16',sourceImages:30,primaryConnected:assets.filter(a=>a.status==='primary-connected').length,fallbackConnected:assets.filter(a=>a.status==='fallback-connected').length,preparedOnly:assets.filter(a=>a.status==='prepared-not-used').length,scope:'Presentation only. Physics, prices, rewards, storage and multiplayer protocol unchanged.',assets};
writeFileSync(resolve(root,'runtime-usage.json'),JSON.stringify(usage,null,2)+'\n');
for(const a of plan.assets){const use=assets.find(x=>x.id===a.id);a.runtimeIntegrated=use.status!=='prepared-not-used';a.runtimeUsage=use.status;}
writeFileSync(resolve(root,'production-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({primary:usage.primaryConnected,fallback:usage.fallbackConnected,prepared:usage.preparedOnly}));
