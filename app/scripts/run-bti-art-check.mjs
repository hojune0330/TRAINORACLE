import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Run from app: node scripts/run-bti-art-check.mjs [--out path/to/contact-sheets]
// All results are produced from fabricated answers. The renderer and portraits are the product's.
const root=fileURLToPath(new URL("../public/run-bti/",import.meta.url));
// These exact originals were visually checked for phones, watches, maps, equipment and gestures.
const reviewed={
  distance:["portrait-09","276cc967cd2bed73d9250eb871b1fd208cc34b8b4edb908f56db0ee511afb14d"],
  speed:["portrait-26","5597b2028dc0295503621a253b2661c9c1720e26cd0fa4e278ad160f4c1102e3"],
  numbers:["portrait-24","276c30062cb940de6a2319785a37e9cfcb783963bbbb3600308721c0d9c0ef26"],
  senses:["portrait-31","f7afff76b6e378549c7ae89b244cb61299c4e81d3360e87f2ed6ea8f1e26b32e"],
  familiar:["portrait-25","9c82149f8b6bd06a1fbd994fb470d9e8ecaea415062009d7b777533e4461b7e2"],
  explore:["club-solo-explore","dc6198aff15343ecf82b64f2b52e3c2a59af0e959bed7b69d0f2835e6cab9984"],
  plan:["club-solo-plan","61c2405e30acb882e6f7169f31df5f7503f38cf851de9fd39b75ea843a224d33"],
  improvise:["club-solo-improvise","061aa66c31ccb832896bb8294d4357ae53b984efa42799c3dce714beff60273b"]
};
// A swapped or re-used pair illustration must prompt a new visual review even if names still match.
const reviewedPairs={
  "distance-explore":"f026a1d772f499292f45e504186f5d311e885344afad0dfcddd3954019cf2dfa",
  "distance-familiar":"8df82556084684273cd0d46ca22b1720f5bf6f3f0943280ff39ec039242f1a08",
  "distance-improvise":"1e4b601465061643965ac253c19eacf695d11f6a7b23b13cb08e740404e0c543",
  "distance-numbers":"f34407396353488d826ac91c3afb7464d2b1264e4096e27c191928e6c6621b1b",
  "distance-plan":"0060bef17a93fb500744316771bb59e25be73a0abc5dc99c433974d23dc5f89c",
  "distance-senses":"7672aa9888ac1f1cc4bf6ea70196d36047e78dea170728294357877cc55c257e",
  "explore-improvise":"2a68e35a59a24d4fa981ab8757df71c866d90ffb0372ce67540cf9b7b9a781e5",
  "explore-plan":"572546aab31c498c1f987c1227b9f880cded3f35a7739be042e4eb73783bac47",
  "familiar-improvise":"1eb1b3e218f629752101c00667ef292c172cca5f53f7e55e8ab5fd3c7ccaa393",
  "familiar-plan":"2a62ccf0a8bbd1cf9717527b308699889ffc21e4f3f766edf5649f616dd36973",
  "numbers-explore":"5e9662ce392d91f5b028f5059139839e05b0d512df19fe1f5651855779d991c7",
  "numbers-familiar":"af0cbd3ffcb279ebd53579dfd436fbb07b22af0223c26103378429afe5e0324d",
  "numbers-improvise":"0f2ca063666072d9713b405ee9235a03077a59de26169e2a1fcd6d4e5b181f94",
  "numbers-plan":"15d9453af85999d351f5a7915b6215243641ef62f3cc5470b2605c522a8b1e94",
  "senses-explore":"7ce8a105b3b1bb6af5b00868b705dd9a259d6416e8a587528c7ebdbed2493204",
  "senses-familiar":"bf25d96a4ab45c6a994b119b3f6aa0d1bcd8403b06676a5023b59c65bdc7f375",
  "senses-improvise":"7c3a1440ba6187310dee04a22e2b7f47f8301bc34e5a25937b2b649a0779dad2",
  "senses-plan":"db5a61fa18b8462099330a7a86c97675ea30ab78fa4959d5337b048685d0c6a8",
  "speed-explore":"415fd76c4dcf8bc1c975138bc81286adffe1d7b5057c1284621dcb0650095c91",
  "speed-familiar":"52f2521580b743a87bd60a545882981fe72a40455707e33c7d06a2d6997c6530",
  "speed-improvise":"22040b936887215ebdf9ff112aa2416ce9c3e3a9309e1db30b4ca904cbb04e5d",
  "speed-numbers":"2914852856299654bd6e35338eee589a4e1b81ab7ceab3e602b133a3dbc4ea0b",
  "speed-plan":"25552d663f503e4547f5824183145dbd01737e0f782e958c35186439e170cf93",
  "speed-senses":"530352c2f638f1d0036c0e8c8f3b5a859ec5197aa59d15447ed900f66fabef08",
};
assert.equal(new Set(Object.values(reviewedPairs)).size,24);
const pairFiles=Object.entries(reviewedPairs).map(([key,sha])=>["club-pair-"+key,sha]);
for(const [file,sha] of [...Object.values(reviewed),...pairFiles]) {
  const actual=createHash("sha256").update(await readFile(join(root,"art",file+".webp"))).digest("hex");
  assert.equal(actual,sha,file+" 그림이 바뀌었어요. 원본의 자세와 소품을 다시 확인해 주세요.");
}
const out=process.argv.includes("--out") ? resolve(process.argv[process.argv.indexOf("--out")+1]) : null;
if(out)await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try {
  const page=await browser.newPage();
  await page.route("http://art.test/**",async route=>{
    const file=new URL(route.request().url()).pathname.slice(1);
    if(!file)return route.fulfill({contentType:"text/html",body:'<!doctype html><meta charset="utf-8"><script src="/rb-pairs-model.js"></script><script src="/rb-pairs-art.js"></script><script src="/rb-pairs-extras.js"></script>'});
    if(!/^(rb-pairs-(model|art|extras)\.js|art\/(portrait-\d{2}|club-(pair|solo)-[a-z-]+)\.webp)$/.test(file))return route.abort();
    return route.fulfill({contentType:file.endsWith(".js")?"text/javascript":"image/webp",body:await readFile(join(root,file))});
  });
  await page.goto("http://art.test/");
  const results=await page.evaluate(async(reviewed)=>{
    const m=window.RBPairsModel,a=window.RBPairArt,extras=window.RBPairsExtras,axes=m.axes;
    const check=(condition,message)=>{if(!condition)throw new Error(message);};
    const categories=[[],[],[],[]],keys=new Set(),cast=new Set(),pairImages=new Set(),fingerprints=new Set();
    const canvas=(w,h)=>Object.assign(document.createElement("canvas"),{width:w,height:h});
    function answers(pairs) {
      const response={};
      for(const [axis,side,gap] of pairs) for(const id of axis.sides) for(let n=1;n<=3;n++){
        response[id.id+"-"+n]=id.id===side ? 2 : (gap===2 ? 0 : 1);
      }
      return response;
    }
    async function render(plate) {
      const img=await a.load(plate.image);
      check(!plate.image || img?.naturalWidth>0,"포스터 원본 파일 누락 "+plate.image);
      const c=canvas(350,250);a.draw(c.getContext("2d"),plate,img,0,0,c.width,c.height);
      return c;
    }
    for(let l=0;l<axes.length;l++)for(let r=l+1;r<axes.length;r++)
      for(const left of axes[l].sides)for(const right of axes[r].sides){
        const first=keys.size%2;
        for(let k=0;k<3;k++){
          const leading=k===2 ? -1 : (first+k)%2;
          const response=answers([[axes[l],left.id,leading!==1?2:1],[axes[r],right.id,leading!==0?2:1]]);
          const result=m.evaluate(response),key=left.id+"+"+right.id;
          check(result.defaultKey===key,"점수와 별명이 일치해야 합니다: "+key);
          const plate=a.select(result,result.defaultName);
          check(plate.direction===(leading===0?left.id:leading===1?right.id:null),"그림 우선순위 "+key);
          check(plate.image==="art/club-pair-"+left.id+"-"+right.id+".webp","순위가 바뀌어도 별명의 얼굴이 같아야 합니다 "+key);
          pairImages.add(plate.image);
          check(plate.sides.length===2 && plate.sides.includes(left.id) && plate.sides.includes(right.id),"두 번째 표식 누락 "+key);
          if(plate.direction)cast.add(plate.direction);
          const art=a.shareKey(result,result.defaultName)||"_";
          const states=result.axes.map(axis=>axis.direction ? (axes.find(ax=>ax.id===axis.id).sides[0].id===axis.direction?"l":"r") : "u").join("");
          const shared=extras.readShared("#pairs=card2~"+m.version+"~"+key+"~"+states+"~_~_~"+art);
          check(shared?.axes.length===4 && !shared.quote,"공개한 네 짝 읽기");
          const other=a.select(shared),image=await render(plate);
          const sameImage=(await render(other)).toDataURL();
          check(image.toDataURL()===sameImage,"수신 장면 불일치 "+key);
          check(!fingerprints.has(sameImage),"서로 다른 조합에서 동일한 그림 "+key);
          fingerprints.add(sameImage);
          const both=plate.sides.map(id=>m.axes.flatMap(ax=>ax.sides).find(s=>s.id===id).label);
          categories[k].push({image,title:result.defaultName,sub:plate.direction ? both.join("  ›  ") : both.join("  +  ")});
        }
        keys.add(left.id+"+"+right.id);
      }
    for(const axis of axes)for(const side of axis.sides){
      const result=m.evaluate(answers([[axis,side.id,2]])),plate=a.select(result);
      check(plate.direction===side.id && plate.sides.length===1,"단일 성향");
      check(plate.image==="art/"+reviewed[side.id][0]+".webp","검수한 단일 성향 원본");
      categories[3].push({image:await render(plate),title:result.defaultName,sub:"한 방향만 뚜렷"});
    }
    const open=m.evaluate(Object.fromEntries(m.items.map(i=>[i.id,1]))), empty=m.evaluate({});
    for(const [result,key] of [[open,"open"],[empty,"unanswered"]]){
      const plate=a.select(result);check(plate.key===key && !plate.direction && !plate.image,"열린 결과가 캐릭터를 단정함");
      categories[3].push({image:await render(plate),title:result.defaultName,sub:key==="open"?"중간 응답":"답하지 않음"});
    }
    const legacy=extras.readShared("#pairs="+m.version+"~distance+numbers~_~_");
    check(legacy && !a.select(legacy).direction,"예전 링크의 순위 추측");
    const hidden=extras.readShared("#pairs=card2~"+m.version+"~distance+numbers~_~_~_~_");
    check(hidden?.axes.length===0 && !a.select(hidden).direction,"비공개 링크의 순위 추측");
    categories[3].push({image:await render(a.select(legacy)),title:legacy.defaultName,sub:"예전 링크 · 순위 비공개"});
    const personal=m.evaluate(answers([[axes[0],"distance",2],[axes[1],"numbers",2],[axes[2],"explore",2]]));
    const chosen=personal.choices.at(-1),chosenArt=a.select(personal,chosen.key);
    check(chosenArt.key===chosen.key && chosenArt.key!==personal.defaultKey,"개인이 선택한 별명의 그림");
    categories[3].push({image:await render(chosenArt),title:chosen.name,sub:"동점에서 직접 고른 별명"});
    // A negative item, unknown item or sensitive answer on its own must not change the portrait.
    const sample=answers([[axes[0],"distance",2],[axes[1],"numbers",2]]);
    sample["numbers-1"]=0;sample["distance-2"]=0;sample["speed-1"]=1;
    const plate=a.select(m.evaluate(sample));
    check(plate.key==="distance+numbers" && plate.image==="art/club-pair-distance-numbers.webp","거부한 자세 사용");
    const privateArt=a.select(m.evaluate({...sample,motives:["weight"],pride:"yes",embarrassed:"uneasy"}));
    check(JSON.stringify(plate)===JSON.stringify(privateArt),"민감 응답이 공개 그림을 바꿈");
    categories[3].push({image:await render(plate),title:"손목 확인 · 한 바퀴 더",sub:"두 행동에 ‘별로’라고 답함"});
    const missing=canvas(350,250);a.draw(missing.getContext("2d"),plate,null,0,0,350,250);
    categories[3].push({image:missing,title:"그림 파일이 없을 때",sub:"같은 표식과 이름을 유지"});
    const names=["별명 24개 · 대표 표식","별명 24개 · 반대쪽 표식이 더 뚜렷한 답","별명 24개 · 두 쪽이 동점인 답","한쪽만 뚜렷하거나 이름을 열어 둔 경우"];
    const sheets=categories.map((group,k)=>{
      const width=1480,cols=4,margin=28,gap=14,cw=Math.floor((width-margin*2-gap*(cols-1))/cols),imageH=Math.round(cw*5/7),ch=imageH+74;
      const c=canvas(width,115+Math.ceil(group.length/cols)*(ch+gap)+margin),ctx=c.getContext("2d");
      ctx.fillStyle="#f6f2e8";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#242d37";ctx.font='bold 34px "Malgun Gothic",sans-serif';ctx.fillText(names[k],margin,57);
      ctx.font='19px "Malgun Gothic",sans-serif';ctx.fillText("런비티아이  /  가상 응답으로 그린 실제 결과 그림",margin,89);
      group.forEach((entry,n)=>{
        const x=margin+(n%cols)*(cw+gap),y=115+Math.floor(n/cols)*(ch+gap);
        ctx.fillStyle="#fffdf7";ctx.fillRect(x,y,cw,ch);ctx.drawImage(entry.image,x,y,cw,imageH);
        ctx.strokeStyle="#bdbaae";ctx.lineWidth=1;ctx.strokeRect(x,y,cw,ch);
        ctx.fillStyle="#26313d";ctx.font='bold 20px "Malgun Gothic",sans-serif';ctx.fillText(entry.title,x+10,y+imageH+29,cw-20);
        ctx.fillStyle="#51545d";ctx.font='17px "Malgun Gothic",sans-serif';ctx.fillText(entry.sub,x+10,y+imageH+55,cw-20);
      });
      return c.toDataURL("image/webp",.84).split(",")[1];
    });
    // Open the product studio and obtain its actual downloadable PNGs for both formats.
    async function exportImage(response,format,quote,includeOrder=false) {
      const host=document.createElement("div");document.body.append(host);
      extras.mount(host,{result:m.evaluate(response),answers:response,storyState:{}});
      const shell=host.querySelector(".rpx-card-shell"),[size,detail]=shell.querySelectorAll("select");
      for(const [control,value] of [[size,format],[detail,quote]]) {
        control.value=value;control.dispatchEvent(new Event("change"));
      }
      if(includeOrder)shell.querySelector(".rpx-consent input").click();
      shell.open=true;
      const im=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{ob.disconnect();reject(new Error("저장 이미지 대기 시간 초과"));},10000);
        const ob=new MutationObserver(()=>{
          const im=shell.querySelector(".rpx-preview img");
          if(im){ob.disconnect();clearTimeout(timer);resolve(im);}
        });
        ob.observe(shell,{childList:true,subtree:true});
      });
      await im.decode();
      check(im.naturalWidth===1080 && im.naturalHeight===(format==="feed"?1350:1920),"PNG 크기");
      check(im.alt.includes("더 뚜렷")===includeOrder,"공개할 성향 순서와 PNG 설명이 다름");
      check(im.src===shell.querySelector("a[download]").href,"다운로드와 미리보기 불일치");
      const capture=Array.from(shell.querySelectorAll("button")).find(b=>b.textContent==="캡처 화면");
      capture.click();check(host.querySelector("dialog img")?.src===im.src,"캡처와 미리보기 불일치");
      host.querySelector("dialog button").click();host.remove();
      return im;
    }
    const exported=await Promise.all([
      exportImage(sample,"feed","_"),exportImage(sample,"story","i:numbers-2",true),exportImage({},"story","_")
    ]);
    const proof=canvas(1450,875),ctx=proof.getContext("2d");ctx.fillStyle="#e8e4d9";ctx.fillRect(0,0,proof.width,proof.height);
    ctx.fillStyle="#26313d";ctx.font='bold 35px "Malgun Gothic",sans-serif';ctx.fillText("실제 저장 카드",32,56);
    const labels=["4:5 피드 · 별명만 공개","9:16 스토리 · 취향 순서와 한 줄 공개","9:16 스토리 · 무응답"];
    exported.forEach((im,i)=>{
      const slot=462,h=720,w=h*im.naturalWidth/im.naturalHeight,scale=Math.min(1,slot/w);
      const x=16+i*478+(slot-w*scale)/2,y=93+(h-h*scale)/2;
      ctx.drawImage(im,x,y,w*scale,h*scale);ctx.fillStyle="#293440";
      ctx.font='bold 20px "Malgun Gothic",sans-serif';ctx.fillText(labels[i],20+i*478,848);
    });
    sheets.push(proof.toDataURL("image/webp",.9).split(",")[1]);
    return {sheets,count:keys.size,faces:pairImages.size,renders:fingerprints.size,directions:cast.size};
  },reviewed);
  assert.equal(results.count,24);assert.equal(results.faces,24);assert.equal(results.renders,72);assert.equal(results.directions,8);
  if(out)for (const [i,name] of ["대표그림-24개","대표그림-순위반전","대표그림-동점","대표그림-예외","대표그림-공유카드"].entries())
    await writeFile(join(out,name+".webp"),Buffer.from(results.sheets[i],"base64"));
  console.log("대표 그림 24조합 × 우세 양방향·동점 = 72장, 여덟 방향, 열린 결과·무응답·예전 공유·개인 별명·거부 행동·민감 응답·파일 누락 통과");
} finally {await browser.close();}
