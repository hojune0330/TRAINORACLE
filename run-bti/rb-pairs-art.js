/* The same plate is drawn in the result, the shared link and both PNG formats. */
(() => {
  "use strict";
  // These portraits contain no clock-reading, phone, medal, map or training action.
  // Only the printed emblems depict preferences. Wardrobe and facial features are casting.
  const styles = {
    distance:  {face:"portrait-09", label:"거리파", ink:"#284d70", paper:"#d7e5ec"},
    speed:     {face:"portrait-26", label:"속도파", ink:"#963a34", paper:"#f4d7c6"},
    numbers:   {face:"portrait-24", label:"숫자파", ink:"#58376c", paper:"#e9ddec"},
    senses:    {face:"portrait-31", label:"감각파", ink:"#794753", paper:"#f5dfe0"},
    familiar:  {face:"portrait-25", label:"단골파", ink:"#2e6158", paper:"#d9e9db"},
    explore:   {face:"club-solo-explore", label:"탐험파", ink:"#7c4e2b", paper:"#f3e2b9"},
    plan:      {face:"club-solo-plan", label:"계획파", ink:"#42567a", paper:"#dce3f2"},
    improvise: {face:"club-solo-improvise", label:"즉흥파", ink:"#346665", paper:"#d5e9e7"},
  };
  const neutral = {ink:"#5a5c67", paper:"#eceae3"};
  const paper="#fff9ea", outline="#25323e";
  const font=size=>"700 "+size+'px "Pretendard", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  function select(result, name) {
    const choice = result.choices?.find(choice => choice.key === name || choice.name === name);
    const key = choice?.key || result.defaultKey;
    const sides = String(key).split("+").filter(side => Object.hasOwn(styles,side));
    let primary = sides.length === 1 ? sides[0] : null;
    if (sides.length === 2) {
      const gaps = sides.map(side => result.axes?.find(axis => axis.direction === side)?.gap);
      if (gaps.every(Number.isFinite)) {
        if (gaps[0] !== gaps[1]) primary = sides[gaps[0] > gaps[1] ? 0 : 1];
      } else if (sides.includes(result.art)) primary = result.art;
    }
    const ordered = primary ? [primary,...sides.filter(side=>side!==primary)] : sides;
    // The nickname owns its portrait. Reversing the two margins changes the emblems only.
    const cast = sides.length===2 ? "club-pair-"+sides.join("-") : primary ? styles[primary].face : null;
    const image = cast ? "art/"+cast+".webp" : null;
    let caption;
    if (ordered.length === 2) {
      const [a,b] = ordered.map(side=>styles[side].label);
      caption = primary ? a+"가 더 뚜렷해서 큰 표식에 담았어요. 작은 표식은 "+b+"예요." : a+"와 "+b+"를 함께 담았어요.";
    } else if (primary) caption=styles[primary].label+"를 캐릭터의 표식에 담았어요.";
    else caption=key==="unanswered" ? "유니폼의 이름표를 비워 뒀어요." : "이번 유니폼엔 취향 표식을 달지 않았어요.";
    return {key,sides:ordered,direction:primary,image,caption,alt:image ? "러닝 캐릭터와 취향 표식. "+caption : "러닝 유니폼. "+caption};
  }
  const imageCache=new Map();
  function load(path) {
    if (!path) return Promise.resolve(null);
    const url=window.RBAssets?.[path] || path;
    if (!imageCache.has(url)) imageCache.set(url,new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>{ imageCache.delete(url); resolve(null); };
      img.src=url;
    }));
    return imageCache.get(url);
  }
  function path(ctx,points,close=false) {
    ctx.beginPath();
    points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    if(close) ctx.closePath();
  }
  // Preference signs use geometry, so "numbers" never depicts the user looking at a watch.
  function emblem(ctx,side,x,y,size,color) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);
    ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=6;ctx.strokeStyle=color;ctx.fillStyle=color;
    const stroke=points=>{path(ctx,points);ctx.stroke();};
    switch (side) {
      case "distance":
        stroke([[9,68],[38,47],[86,47]]);stroke([[12,83],[46,60],[91,60]]);stroke([[7,52],[31,34],[82,34]]);break;
      case "speed":
        stroke([[13,74],[39,51],[23,32]]);stroke([[41,74],[67,51],[51,32]]);stroke([[70,74],[92,51],[76,32]]);break;
      case "numbers":
        stroke([[12,75],[88,75]]);
        [24,49,74].forEach((n,i)=>{ctx.fillRect(n-5,49-i*13,10,20+i*13);});break;
      case "senses":
        [38,62].forEach(n=>{ctx.beginPath();ctx.moveTo(8,n+5);ctx.bezierCurveTo(24,n+5,29,n-16,43,n-10);ctx.bezierCurveTo(58,n-5,66,n+20,90,n);ctx.stroke();});break;
      case "familiar":
        ctx.beginPath();ctx.arc(65,51,22,-Math.PI/2,Math.PI/2);ctx.arc(35,51,22,Math.PI/2,Math.PI*1.5);
        ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(51,29,7,0,Math.PI*2);ctx.fill();break;
      case "explore":
        stroke([[12,78],[35,60],[48,45],[84,26]]);stroke([[36,60],[62,67],[85,57]]);
        [[84,26],[85,57]].forEach(([a,b])=>{ctx.beginPath();ctx.arc(a,b,6,0,2*Math.PI);ctx.fill();});break;
      case "plan":
        [22,49,76].forEach((n,i)=>{ctx.strokeRect(13,n-8,15,13);stroke([[40,n],[i===2?69:86,n]]);});break;
      case "improvise":
        ctx.beginPath();ctx.moveTo(12,76);ctx.bezierCurveTo(35,61,6,35,35,33);ctx.bezierCurveTo(65,30,42,85,69,66);ctx.quadraticCurveTo(83,55,88,21);ctx.stroke();break;
    }
    ctx.restore();
  }
  function jersey(ctx,x,y,size,open) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/250,size/250);
    ctx.lineJoin="round";ctx.lineWidth=5;ctx.strokeStyle=outline;ctx.fillStyle=open?"#e4ede9":"#f2efe4";
    path(ctx,[[34,38],[78,18],[101,27],[148,27],[171,18],[215,38],[241,91],[205,110],[185,88],[188,224],[62,224],[65,88],[45,110],[9,91]],true);
    ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(80,20);ctx.quadraticCurveTo(126,83,170,20);ctx.stroke();
    ctx.fillStyle=paper;ctx.fillRect(92,107,66,38);ctx.strokeRect(92,107,66,38);
    ctx.setLineDash([5,5]);ctx.lineWidth=2;ctx.strokeRect(98,113,54,26);ctx.restore();
  }
  const WIDTH=700,HEIGHT=500;
  const matteColors=new WeakMap();
  function paperAtEdge(img) {
    if(matteColors.has(img))return matteColors.get(img);
    const sample=document.createElement("canvas");
    sample.width=4;sample.height=1;
    const ctx=sample.getContext("2d",{willReadFrequently:true});
    const edge=3, xs=[edge,img.naturalWidth-1-edge],ys=[edge,img.naturalHeight-1-edge];
    let index=0;
    for(const y of ys)for(const x of xs)ctx.drawImage(img,x,y,1,1,index++,0,1,1);
    const bytes=ctx.getImageData(0,0,4,1).data,colors=[];
    for(let i=0;i<bytes.length;i+=4){
      if(bytes[i+3]>245 && Math.min(bytes[i],bytes[i+1],bytes[i+2])>165)colors.push(bytes.slice(i,i+3));
    }
    const color=colors.length ? "rgb("+[0,1,2].map(k=>Math.round(colors.reduce((n,c)=>n+c[k],0)/colors.length)).join(",")+")" : null;
    matteColors.set(img,color);return color;
  }
  function layout(ctx,plate,img,height) {
    const ids=plate.sides;
    const theme=styles[ids[0]] || neutral, second=styles[ids[1]];
    const split=second ? (plate.direction ? 420 : 350) : WIDTH;
    const dividerY=height-107;
    const scale=img ? Math.min((WIDTH-52)/img.naturalWidth,(dividerY-22)/img.naturalHeight) : 0;
    const iw=img ? img.naturalWidth*scale : 0,ih=img ? img.naturalHeight*scale : 0;
    const gutter=(WIDTH-iw)/2,above=dividerY-ih;
    const matte=img && second ? paperAtEdge(img) : null;
    ctx.fillStyle=theme.paper;ctx.fillRect(0,0,WIDTH,height);
    if(matte) {
      const field=ctx.createLinearGradient(0,0,WIDTH,0);
      field.addColorStop(0,theme.paper);field.addColorStop(gutter/WIDTH,matte);
      field.addColorStop(1-gutter/WIDTH,matte);field.addColorStop(1,second.paper);
      ctx.fillStyle=field;ctx.fillRect(0,0,WIDTH,dividerY);
    } else if(second) {
      ctx.fillStyle=second.paper;path(ctx,[[split+40,0],[WIDTH,0],[WIDTH,dividerY],[split-40,dividerY]],true);ctx.fill();
    }
    ctx.save();ctx.globalAlpha=.17;
    if(matte) {
      // Keep the signs in the margin so they never cut across a face or end abruptly at a square edge.
      const beside=gutter>=110;
      const room=beside ? gutter-16 : above-18;
      const big=Math.max(0,Math.min(166,room)),small=plate.direction ? big*.76 : big;
      if(big>=38) {
        const left=beside ? gutter/2 : WIDTH*.22,right=WIDTH-left;
        const mid=beside ? dividerY*.48 : above/2;
        emblem(ctx,ids[0],left-big/2,mid-big/2,big,theme.ink);
        emblem(ctx,ids[1],right-small/2,mid-small/2,small,second.ink);
      }
    } else if(ids.length) {
      const balanced=second && !plate.direction;
      emblem(ctx,ids[0],12,balanced?94:49,balanced?158:184,theme.ink);
      if(second)emblem(ctx,ids[1],balanced?WIDTH-170:WIDTH-177,balanced?94:117,balanced?158:161,second.ink);
    } else {
      ctx.strokeStyle=neutral.ink;ctx.lineWidth=4;
      for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(0,270+n*19);ctx.bezierCurveTo(145,340,465,120,WIDTH,170+n*19);ctx.stroke();}
    }
    ctx.restore();
    if(img) {
      // The solo bust originals have a square shoulder boundary. Show their full print frame.
      if(!second){
        ctx.fillStyle="rgba(255,252,239,.45)";ctx.fillRect(gutter,above,iw,ih);
        ctx.lineWidth=2;ctx.strokeStyle="rgba(38,48,55,.35)";ctx.strokeRect(gutter,above,iw,ih);
      }
      ctx.drawImage(img,gutter,above,iw,ih);
    } else {
      const size=Math.min(520,dividerY-54);
      jersey(ctx,(WIDTH-size)/2,(dividerY-size)/2,size,plate.key!=="unanswered");
    }
    ctx.fillStyle=paper;ctx.fillRect(0,dividerY,WIDTH,height-dividerY);ctx.strokeStyle=outline;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(0,dividerY);ctx.lineTo(WIDTH,dividerY);ctx.stroke();
    function label(id,start,end) {
      const info=styles[id], w=end-start;
      const diameter = ids.length===2 && plate.direction ? (start===0 ? 80 : 58) : 70;
      const cx=start+w/2-59, cy=dividerY+54;
      ctx.fillStyle=info.paper;ctx.beginPath();ctx.arc(cx,cy,diameter/2,0,Math.PI*2);ctx.fill();
      emblem(ctx,id,cx-diameter/2,cy-diameter/2,diameter,info.ink);
      ctx.fillStyle=outline;ctx.font=font(diameter>70?42:38);ctx.textAlign="left";ctx.textBaseline="middle";
      ctx.fillText(info.label,cx+diameter/2+10,cy+2);
    }
    if(ids.length) {
      label(ids[0],0,split);
      if(second) {ctx.fillStyle="#beb9a9";ctx.fillRect(split,dividerY+17,2,75);label(ids[1],split,WIDTH);}
    } else {
      ctx.fillStyle=outline;ctx.font=font(36);ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(plate.key==="unanswered"?"아직 정해진 별명이 없어요":"내 러닝 취향",WIDTH/2,dividerY+56);
    }
  }
  function draw(ctx,plate,img,x,y,w,h) {
    ctx.save();
    ctx.fillStyle=styles[plate.sides[0]]?.paper||neutral.paper;ctx.fillRect(x,y,w,h);
    const scale=Math.min(w/WIDTH,h/HEIGHT),height=h/scale;
    ctx.translate(x+(w-WIDTH*scale)/2,y);ctx.scale(scale,scale);
    layout(ctx,plate,img,height);ctx.restore();
  }
  function mount(host,plate) {
    const canvas=document.createElement("canvas"), caption=document.createElement("figcaption");
    canvas.width=WIDTH;canvas.height=HEIGHT;canvas.setAttribute("role","img");canvas.setAttribute("aria-label",plate.alt);
    caption.textContent=plate.caption;host.classList.add("rb-pair-art");host.replaceChildren(canvas,caption);
    const ctx=canvas.getContext("2d");
    if (!ctx) {canvas.remove();return;}
    draw(ctx,plate,null,0,0,WIDTH,HEIGHT);
    if(!plate.image){canvas.dataset.render="uniform";return;}
    host.setAttribute("aria-busy","true");
    load(plate.image).then(img=>{
      host.removeAttribute("aria-busy");
      canvas.dataset.render=img?"portrait":"emblems";
      if(img){draw(ctx,plate,img,0,0,WIDTH,HEIGHT);return;}
      canvas.setAttribute("aria-label","유니폼과 취향 표식. "+plate.caption);
      const retry=document.createElement("button");retry.type="button";retry.className="rpx-btn";
      retry.textContent="캐릭터 그림 다시 불러오기";
      retry.onclick=()=>mount(host,plate);
      caption.append(" ",retry);
    });
  }
  window.RBPairArt={select,load,draw,mount,shareKey:(result,name)=>select(result,name).direction};
})();
