import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { resolve,join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Run from app: node scripts/run-bti-art-check.mjs [--out path/to/contact-sheets]
// All results are produced from fabricated answers. The renderer and portraits are the product's.
const root=fileURLToPath(new URL("../public/run-bti/",import.meta.url));
// Reviewed animal portraits: a replacement or duplicated image needs visual checking.
const reviewedPortraits={
  "distance":"84223fd92634fc5d3f83a424b0be7afdef057b3966794f79dc9f753cfe781a34",
  "speed":"91f3242fe81f02d0aa8c54115acd3df0bfdbd66b144603aaa6e6653b592ec749",
  "numbers":"07d5b4774a9479960f05a35e700b3cbb97a213fbe170209a8ce1f62fe8dec211",
  "senses":"40acf7d76c8350eef1b8eb096136b2c53d38fc99b9136dbd31d5f55dc1a35396",
  "familiar":"8473a6c969e495394211d656ccfd18b504994cd8badd0a016f19ffa43839eb86",
  "explore":"a758975d592b8dfcc766b55a0aec8acf3cbf9cc1346f6458fd0411eca30ed7e0",
  "plan":"7a34d0b6b1d37de6bc3d6895b9235801fac62b9ed891facf40a655ba1baf78a6",
  "improvise":"47171eabb37314b054f60b3821e1495acae0414f13b218b528bf2c04f8900335",
  "distance-numbers":"5931937db83b8ca0dc191f7b9aecf45ffe141c8792ad32dff72fb54fef63ea29",
  "distance-senses":"c2b8c0fb4d1416d747fe51a6985d398d3ca02b8ef7a7434ef08cd7d956dd7a22",
  "speed-numbers":"f53323a8d2dc3407239246fa6e21b6628b928e0685663452cf3b86f02f0a5086",
  "speed-senses":"7a865f104d3f2a6ace49bf1df2f7eb521c3ec49aeccc9e935df723bba82ee300",
  "distance-familiar":"e3550aa9a8d1605628c3628948ea7d7b3144470929cbd3969c4d2e7ba3176662",
  "distance-explore":"c51009db1e95229e8405c1f481a6a261dd3225d609c74ba7486e03c577d4c611",
  "speed-familiar":"fffe78d1f9f3fc957d6e298a9ca0f5e4b4347194021d2d82f381054477dac48a",
  "speed-explore":"16e2d9ef2c3fba24786a7e4511bbb590646492e6b11d4a1c2daecc92501b7352",
  "distance-plan":"e47bfa7c732c492dad1fe83287975717ff77edf9fe6f641160f7b358e9f5624b",
  "distance-improvise":"1c80a60232a34e14e0acea6dd69b4c2ea57fa93ab2c5e46ebf50aa9a1921bf30",
  "speed-plan":"96004d1b34ce72b2f4278e75a15fc6f408294b497f7365bce8ff854487b2a7f5",
  "speed-improvise":"196169c4c754638aeaeb6aad1e212613f9852713f2b4e5ca7ebf89b9d297ed84",
  "numbers-familiar":"e2e6047253c616cc5c89a2bf3b509aa98894efffba643de3c581fe187a527193",
  "numbers-explore":"3c90a811ed225f3b91e6161ec3df4548c1b2a172c1819dbbc6258591652c691e",
  "senses-familiar":"c89951234ff650e92aa27ebd07aa4d25821712ab6242d8db0cc028553a67c600",
  "senses-explore":"36060b5dc28951774f3ba2b14711d853aaae8c5fe1d16c9020493f92f04d71db",
  "numbers-plan":"7cad34806f730e1679e34a1d1b9152b77f5327790ab8d25274fa7a24dfad6435",
  "numbers-improvise":"9a006c7fc848db8fd6d34b5e12c3deb391cfdd03fcfd74a3226b1b6bc7900d4a",
  "senses-plan":"ab798de4b9335ec8e8285343c1aaa55ce64eff91621516c443eed0967f4083ab",
  "senses-improvise":"c36ae279931c3fe45efd0e2ccd3ad702366c9548f1cc02110c149b0339fe47ac",
  "familiar-plan":"beb7db4e342a1f477983e343ef58d5ec21027da08e6353275bea20e5ee9e5730",
  "familiar-improvise":"789b4ba8ed466dcdb00a6bcfd585a1ad044860d5651d2db6f0ed43378f740199",
  "explore-plan":"8aed0f6b56a4b53bd48643ace5a4fcc8d74770e14e4f2a9d9a8ed9b727b115a9",
  "explore-improvise":"faaafc98090114076cccdb817ec96fa01338f9ff5e0a4c529feb3592ba98affc",
};
assert.equal(new Set(Object.values(reviewedPortraits)).size,32);
for(const [key,sha] of Object.entries(reviewedPortraits)) {
  const file="club-animal-"+key+".webp";
  const actual=createHash("sha256").update(await readFile(join(root,"art",file))).digest("hex");
  assert.equal(actual,sha,file+" 그림이 바뀌었어요. 동물과 소품을 다시 확인해 주세요.");
}
const out=process.argv.includes("--out") ? resolve(process.argv[process.argv.indexOf("--out")+1]) : null;
if(out)await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.RUN_BTI_BROWSER_CHANNEL});
try {
  const page=await browser.newPage();
  await page.route("http://art.test/**",async route=>{
    const file=new URL(route.request().url()).pathname.slice(1);
    if(!file)return route.fulfill({contentType:"text/html",body:'<!doctype html><meta charset="utf-8"><script src="/rb-pairs-model.js"></script><script src="/rb-pairs-art.js"></script><script src="/rb-pairs-extras.js"></script>'});
    if(!/^(rb-pairs-(model|art|extras)\.js|art\/club-animal-[a-z-]+\.webp)$/.test(file))return route.abort();
    return route.fulfill({contentType:file.endsWith(".js")?"text/javascript":"image/webp",body:await readFile(join(root,file))});
  });
  await page.goto("http://art.test/");
  const results=await page.evaluate(async()=>{
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
          check(plate.image==="art/club-animal-"+left.id+"-"+right.id+".webp","순위가 바뀌어도 별명의 얼굴이 같아야 합니다 "+key);
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
      check(plate.image==="art/club-animal-"+side.id+".webp","검수한 단일 성향 원본 "+side.id);
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
    check(plate.key==="distance+numbers" && plate.image==="art/club-animal-distance-numbers.webp","개별 행동을 거절해도 같은 별명의 캐릭터 유지");
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
  });
  assert.equal(results.count,24);assert.equal(results.faces,24);assert.equal(results.renders,72);assert.equal(results.directions,8);
  if(out)for (const [i,name] of ["대표그림-24개","대표그림-순위반전","대표그림-동점","대표그림-예외","대표그림-공유카드"].entries())
    await writeFile(join(out,name+".webp"),Buffer.from(results.sheets[i],"base64"));
  console.log("대표 그림 24조합 × 우세 양방향·동점 = 72장, 여덟 방향, 열린 결과·무응답·예전 공유·개인 별명·거부 행동·민감 응답·파일 누락 통과");
} finally {await browser.close();}
