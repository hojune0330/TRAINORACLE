import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {JSDOM} from "jsdom";

function runner(t,draft) {
  const dom = new JSDOM('<header id="mast"></header><main id="main"></main><footer id="foot"></footer><div id="toast"></div>',
    {url:"https://example.test/run-bti/",runScripts:"outside-only"});
  const w=dom.window,doc=w.document;
  t.after(()=>w.close());
  w.scrollTo=()=>{};
  w.RBScene={assetURL:path=>path,audio:{enabled:()=>false}};
  w.RBPairArt={select(){},mount(){}};
  for (const file of ["rb-pairs-model.js","rb-pairs-journey.js","rb-pairs-ui.js"]) {
    w.eval(readFileSync(new URL("../public/run-bti/"+file,import.meta.url),"utf8"));
  }
  if (draft) w.sessionStorage.setItem("runbti.pairs-1.draft",JSON.stringify(draft));
  w.RBPairsUI.start();
  const click = action=>doc.querySelector('[data-fp="'+action+'"]').click();
  click(draft?"resume":"start");
  function pick(answers) {
    for (const input of doc.querySelectorAll(".fp-question input[name]")) {
      if (Object.hasOwn(answers,input.name) && input.value===String(answers[input.name])) input.click();
    }
  }
  return {w,doc,click,pick};
}

test("a station appears only after its last question page; its bag contains only the actual likes",t=>{
  const r=runner(t);
  const answers={"distance-1":2,"distance-2":0,"distance-3":0,"speed-1":0,"speed-2":2,"speed-3":0};
  r.click("next");r.pick(answers);r.click("next");r.pick(answers);
  assert.equal(r.doc.querySelector("[data-lap-branch]"),null);
  assert.equal(r.doc.querySelector("[data-lap-item]"),null);
  r.click("next");
  assert.equal(r.doc.querySelector("[data-lap-branch]").dataset.lapBranch,"neutral");
  assert.deepEqual([...r.doc.querySelectorAll("[data-lap-item]")].map(li=>li.dataset.lapItem),["distance-1","speed-2"]);
  assert.doesNotMatch(r.doc.querySelector(".lap-trip").textContent,/걷듯|콧노래|가득|개 모/);
});

test("partial, both-liked and all-skipped routes share a finish without extra rewards or early mascot reveal",t=>{
  for (const state of ["partial","both","empty","unknown"]) {
    const r=runner(t),answers={};
    const seen=new Set();
    if (state==="partial") Object.assign(answers,{"distance-1":2,"distance-2":2,"speed-1":0,"speed-2":0});
    if (state==="both") {
      for (const side of ["distance","speed"]) for (let n=1;n<=3;n++) answers[side+"-"+n]=2;
    }
    if (state==="unknown") {
      for (const item of r.w.RBPairsModel.items) answers[item.id]="unknown";
    }
    for (let page=0;page<12;page++) {
      const quiz=r.doc.querySelector(".fp-quiz");
      seen.add(quiz.querySelector("[data-lap-stage]").dataset.lapStage);
      assert.equal(quiz.querySelector('img[src*="mini-"],[data-result-art]'),null);
      assert.ok(!Object.keys(r.w.RBPairsModel.characters).some(key=>quiz.textContent.includes(r.w.RBPairsModel.characters[key].nickname)));
      if (page===3) {
        assert.equal(quiz.querySelector("[data-lap-branch]").dataset.lapBranch,{partial:"distance",both:"both",empty:"neutral",unknown:"neutral"}[state]);
        assert.equal(quiz.querySelectorAll(".lap-sign").length,1);
      }
      r.pick(answers);r.click("next");
    }
    assert.equal(seen.size,7);
    assert.equal(r.doc.querySelector("[data-lap-stage]").dataset.lapStage,"finish");
    if (state==="partial") assert.equal(r.doc.querySelector("h1").textContent,r.w.RBPairsModel.names.distance);
    else assert.equal(r.doc.querySelector(".lap-finish .lap-mate"),null);
    if (state==="unknown" || state==="empty") assert.equal(r.doc.querySelector(".lap-finish [data-lap-item]"),null);
  }
});

test("one revised answer changes the finish mascot while the other preferences remain true",t=>{
  const r=runner(t);
  const answers=Object.fromEntries(r.w.RBPairsModel.items.map(i=>[i.id,
    ["distance","numbers","explore"].includes(i.sideId)?2:["speed","senses","familiar"].includes(i.sideId)?0:1]));
  Object.assign(answers,{strength:"endurance",goal:"speed"});
  for (let page=0;page<12;page++) { r.pick(answers);r.click("next"); }
  assert.match(r.doc.querySelector(".lap-mate").src,/mini-distance-numbers/);
  assert.match(r.doc.querySelector(".lap-finish-facts").textContent,/자신 있는 것오래 달리기/);
  assert.match(r.doc.querySelector(".lap-goal-flag").textContent,/다음 목표속도 내기/);
  r.click("edit");r.click("next");r.click("next");
  r.pick({"distance-3":1});r.click("return-result");
  assert.match(r.doc.querySelector(".lap-mate").src,/mini-numbers-explore/);
  assert.match(r.doc.querySelector(".lap-change").textContent,/거리 쪽도 여전히 좋아해요/);
  assert.equal(r.doc.querySelector('.lap-finish [data-lap-item="distance-3"]'),null);
});

test("an old interleaved draft retains each choice and resumes on the new pair pages",t=>{
  const r=runner(t,{id:"old-run",version:"pairs-1",page:2,at:"2026-11-22T00:00:00.000Z",
    answers:{"distance-1":2,"speed-1":0,"numbers-1":2}});
  assert.ok(r.doc.querySelector('input[name="distance-1"][value="2"]:checked'));
  assert.equal(r.doc.querySelector("[data-lap-branch]"),null);
  r.click("next");r.click("next");
  assert.ok(r.doc.querySelector('input[name="numbers-1"][value="2"]:checked'));
});
