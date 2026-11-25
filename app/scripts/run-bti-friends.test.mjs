import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import {JSDOM} from "jsdom";

const root = new URL("../public/run-bti/",import.meta.url);
const scripts = await Promise.all(["rb-pairs-model.js","rb-pairs-art.js","rb-pairs-extras.js"]
  .map(name => readFile(new URL(name,root),"utf8")));

function runner(t) {
  const page = new JSDOM("<main></main>",{url:"https://example.test/run-bti/",runScripts:"outside-only"});
  t.after(() => page.window.close());
  const w = page.window, host = w.document.querySelector("main");
  scripts.forEach(script => w.eval(script));
  let url;
  Object.defineProperty(w.navigator,"clipboard",{value:{writeText:async value => {url=value;}}});
  const helpers = w.RBPairsExtras, model = w.RBPairsModel;
  function mount(answers, options={}) {
    helpers.mount(host,{result:model.evaluate(answers), answers, storyState:{}, ...options});
  }
  function copied() {
    [...host.querySelectorAll("button")].find(n=>n.textContent==="링크 복사").click();
    return new URL(url).hash;
  }
  return {w,host,helpers,model,mount,copied};
}

test("issued links keep their own wording when the live quiz is edited", t => {
  const {model,helpers} = runner(t);
  const old = "#pairs=pairs-1~distance~_~i:distance-2";
  const card2 = "#pairs=card2~pairs-1~distance~_~s:summer:indoor~solo~_";
  model.items.find(item=>item.id==="distance-2").reading = "바뀐 문장";
  model.names.distance = "바뀐 이름";
  assert.equal(helpers.readShared(old).quote,"여유가 있으면 한 바퀴 더 돌고 싶어.");
  assert.equal(helpers.readShared(old).defaultName,"거리 | 성큼성큼 코끼리");
  assert.equal(helpers.readShared(card2).quote,"여름 · 실내에서 뛰고 싶어");
  assert.equal(helpers.readShared(card2).companyText,"혼자 뛰고 나중에 얘기하는 게 좋아");
  assert.equal(helpers.readShared(card2).bag.length,0);
});

test("new link readers reproduce the current public copy exactly", t => {
  const {w,host,model,helpers,mount,copied} = runner(t);
  const answers = Object.fromEntries(model.items.map(item=>[item.id,2]));
  const checked = new Set();
  function verify(menu,option) {
    menu.value=option.value; menu.dispatchEvent(new w.Event("change"));
    assert.equal(helpers.readShared(copied()).quote,option.textContent,option.value);
    checked.add(option.value);
  }
  for (let index=0;index<6;index++) {
    for (const id of ["goal","learning","strength"]) {
      const q = model.extras.find(q=>q.id===id);
      answers[id] = q.options[index % q.options.length].id;
    }
    mount(answers);
    const menu = host.querySelector(".rpx-studio .rpx-controls > div select");
    for (const option of menu.options) {
      if (!option.value.startsWith("i:") && !option.value.startsWith("e:")) continue;
      verify(menu,option);
    }
  }
  for (const chapter of host.querySelectorAll(".rpx-chapter")) {
    const topics=chapter.querySelector("select");
    for (const topic of topics.options) {
      topics.value=topic.value; topics.dispatchEvent(new w.Event("change"));
      for (const button of chapter.querySelectorAll(".rpx-choices [data-value]")) {
        button.click();
        const quoteId="s:"+topic.value+":"+button.dataset.value;
        const menu=host.querySelector(".rpx-studio .rpx-controls > div select");
        const option=[...menu.options].find(opt=>opt.value===quoteId);
        if (["restPressure","pride","embarrassed","soreness"].includes(topic.value)) assert.equal(option,undefined,quoteId);
        else { assert.ok(option,quoteId); verify(menu,option); }
      }
    }
  }
  assert.equal(checked.size,106);
});

test("only explicitly opened, liked bag notes reach a friend; old links remain snapshots", t => {
  const {host,helpers,model,mount,copied} = runner(t);
  const answers = {"distance-1":2,"distance-2":0,"distance-3":0,"speed-1":0,"speed-2":2,"speed-3":0};
  assert.equal(model.evaluate(answers).axes[0].state,"neither");
  mount(answers,{storyState:{pride:"yes",embarrassed:"uneasy",soreness:"continued",restPressure:"worry"}});
  const inputs = [...host.querySelectorAll("input[name=shareBag]")];
  assert.deepEqual(inputs.map(input=>input.value),["distance-1","speed-2"]);
  assert.ok(inputs.every(input=>!input.checked));
  assert.equal(helpers.readShared(copied()).bag.length,0);
  inputs[0].click(); inputs[1].click();
  const opened = copied();
  assert.match(opened,/^#pairs=card3~w2~/);
  assert.deepEqual(Array.from(helpers.readShared(opened).bag,entry=>entry.key),["distance-1","speed-2"]);
  inputs[1].click();
  assert.equal(helpers.readShared(copied()).bag.length,1);
  assert.equal(helpers.readShared(opened).bag.length,2);
  mount({"distance-1":2,"familiar-1":2},{shared:helpers.readShared(opened)});
  const compare=host.querySelector(".rpx-shared-bag");
  compare.querySelector("button").click();
  assert.match(compare.querySelector("h5 + ul").textContent,/조금 더 멀리/);
  assert.equal(compare.querySelectorAll(".rpx-pouch").length,2);
  assert.match(compare.querySelector(".rpx-pouch:last-child .rpx-bag-notes").textContent,/발이 빨라지는/);
  assert.equal(helpers.readShared(copied()).bag.length,0);
  for (const mutation of [opened.replace("~w2~","~future~"),opened.replace("~open~","~unanswered~"),
    opened.replace("~11~","~1000001~"),opened.replace("~11~","~s:embarrassed:uneasy~")])
    assert.equal(helpers.readShared(mutation),null);
});

test("the encounter collection keeps only the linked animal, once; an open name never fills a slot", t => {
  const {w,host,helpers,model,mount,copied} = runner(t);
  const answers = Object.fromEntries(model.items.map(item=>[item.id,
    ["distance","numbers","explore"].includes(item.sideId) ? 2 : 0]));
  const chosen = model.names["numbers+explore"];
  mount(answers,{selectedName:chosen});
  const friend = helpers.readShared(copied());
  assert.equal(friend.defaultKey,"distance+numbers");
  assert.match(host.querySelector(".rpx-link-area").textContent,/기린.+친구 도감.+황제펭귄/);
  w.RBPairArt.mount=()=>{};
  helpers.mountReceived(host,friend);
  helpers.mountReceived(host,friend);
  helpers.mountReceived(host,helpers.readShared("#pairs=pairs-1~unanswered~_~_"));
  helpers.mountReceived(host,helpers.readShared("#pairs=pairs-1~open~_~_"));
  assert.deepEqual(Object.keys(w.localStorage),["runbti.friends.animal.distance+numbers"]);
  const grid = helpers.collectionView();
  assert.equal(grid.querySelectorAll("li").length,32);
  assert.equal(grid.querySelectorAll(".rpx-met").length,1);
  assert.match(grid.querySelector(".rpx-met summary").textContent,/황제펭귄/);
  assert.equal(w.localStorage.getItem("runbti.friends.animal.distance+numbers"),"1");
});

test("story stickers are rebuilt only from archivable choices, including both answers in a multi-select", t => {
  const {host,helpers,mount} = runner(t);
  const state={restPressure:"worry",soreness:"continued",pride:"yes",embarrassed:"uneasy"};
  mount({}, {storyState:state});
  assert.equal(host.querySelector(".rpx-chapter-sticker"),null);
  const answers={"distance-1":2,"distance-2":2,"speed-2":0,"speed-3":0};
  Object.assign(state,{training:["drills","strength"],snowExperience:"no",snow:"want"});
  mount(answers,{storyState:state});
  const sheets=()=>[...host.querySelectorAll(".rpx-chapter-sticker")];
  function stampState() {
    return sheets().map(sheet=>({
      src:sheet.querySelector("img").getAttribute("src"),
      answers:[...sheet.querySelectorAll("[data-question]")].map(row=>[row.dataset.question,row.dataset.answer]),
    }));
  }
  const safe=stampState();
  assert.deepEqual(safe,[
    {src:"assets/lap/mini-distance.webp",answers:[["snowExperience","no"],["snow","want"]]},
    {src:"assets/lap/mini-distance.webp",answers:[["training","drills"],["training","strength"]]},
  ]);
  mount(answers,{storyState:helpers.archiveStories(state)});
  assert.deepEqual(stampState(),safe);
  mount(answers,{storyState:{...state,training:[]}});
  assert.deepEqual(stampState(),[safe[0]]);
  mount({},{storyState:{summer:"indoor"}});
  assert.equal(sheets()[0].querySelector("img"),null);
  assert.equal(sheets()[0].querySelector('[aria-label="빈 이름표"]').getAttribute("role"),"img");
});
