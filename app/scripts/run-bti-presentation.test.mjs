import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const files = new URL("../public/run-bti/", import.meta.url);
const sources = await Promise.all(["rb-pairs-model.js", "rb-pairs-art.js", "rb-pairs-extras.js"].map(name => readFile(new URL(name, files), "utf8")));

function setup(t, { answers = {}, state = {} , shared = null } = {}) {
  const dom = new JSDOM("<main></main>", { url:"https://example.test/run-bti/", runScripts:"outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  sources.forEach(source => w.eval(source));
  const host = w.document.querySelector("main");
  const extras = w.RBPairsExtras;
  const result = w.RBPairsModel.evaluate(answers);
  extras.mount(host,{result,answers,storyState:state,shared});
  let copied = null;
  Object.defineProperty(w.navigator,"clipboard",{value:{writeText:async value => {copied=value;}}});
  function click(text, scope = host) {
    const control = [...scope.querySelectorAll("button")].find(node => node.textContent === text);
    assert.ok(control,text);
    control.click();
  }
  function share() {
    click("링크 복사");
    return extras.readShared(new URL(copied).hash);
  }
  return { w,host,extras,click,share, copiedURL:() => new URL(copied) };
}

test("independent story readings cite exactly their own answers and leave other answers visible", t => {
  const {host,click} = setup(t,{ answers:{goal:"speed",learning:"class",eagerness:"reluctant"},
    state:{summer:"less",winter:"outside",snowExperience:"no",snow:"want",rainExperience:"no",rain:"want",
      time:"evening",freeDay:"want",restPressure:"worry",athlete:"now",watch:"after"} });
  const chapters = host.querySelectorAll(".rpx-chapter");
  function proof(chapter) {
    return [...chapter.querySelectorAll(".rpx-reading-line")].map(line =>
      [...line.querySelectorAll("li")].map(li => [li.dataset.question,li.dataset.answer]));
  }
  assert.deepEqual(proof(chapters[0]),[
    [["summer","less"],["winter","outside"]],[["snowExperience","no"],["snow","want"]],
    [["rainExperience","no"],["rain","want"]],
  ]);
  assert.equal(chapters[0].querySelector('.rpx-reading > ul li[data-question="time"]').textContent.includes("저녁이나 밤"),true);
  assert.deepEqual(proof(chapters[2]),[[["athlete","now"],["eagerness","reluctant"]],[["freeDay","want"],["restPressure","worry"]]]);
  assert.deepEqual(proof(chapters[4]),[[["watch","after"],["goal","speed"]]]);
  click("여름엔 덜 뛰고 싶어",chapters[0]);
  assert.equal(proof(chapters[0]).length,2);
  assert.ok(chapters[0].querySelector('.rpx-reading > ul [data-question="winter"]'));
  assert.equal(host.querySelector('.rpx-card-shell option[value*="restPressure"]'),null);
});

test("each story illustration depicts its selected answer and clears when that answer changes", async t => {
  const { host,w } = setup(t);
  const byTopic = id => {
    const chapter=[...host.querySelectorAll(".rpx-chapter")].find(panel=>panel.querySelector('option[value="'+id+'"]'));
    const menu=chapter.querySelector("select");menu.value=id;menu.dispatchEvent(new w.Event("change"));
    return {
      choose(value) { chapter.querySelector('[data-value="'+value+'"]').click(); },
      expectNone() { assert.equal(chapter.querySelector(".rpx-scene"),null); },
      expectScene(file,alt,context,value) {
        const figures=chapter.querySelectorAll(".rpx-scene");
        assert.equal(figures.length,1);
        const image=figures[0].querySelector("img");
        assert.equal(image.getAttribute("src"),"art/"+file+".webp");
        assert.equal(image.alt,alt);
        const answer=chapter.querySelector('[data-value="'+value+'"][aria-pressed="true"]').textContent;
        assert.equal(figures[0].querySelector("figcaption").textContent,context+" · "+answer);
      },
    };
  };
  // Lock the actual reviewed pixels as well as the filenames. A replacement needs a fresh visual review.
  const reviewed = {
    "club-drill-study":["31d0b634299648840e5b7211aa60cf8506171863e79787ac7b7515aa5c903c6a","트랙에 낮은 허들이 놓여 있고 러너가 한쪽 무릎을 들어 첫 허들을 넘고 있어요."],
    "life-travel":["66dfacd3177c6287926a6f4bb53a213e6dc0ff7fb61e5e689b2ca1b34902d2cc","여행 가방을 펼쳐 놓고 옷 옆에 운동화 한 켤레를 넣고 있어요."],
    "life-record":["aac0e8d8e4ecbb9654967fb46e360ee5ef0b13b8985e5acd7a508f89d3aeada7","러너가 트랙 옆 벤치에 앉아 수첩을 펼치고 손목시계를 보고 있어요."],
  };
  for (const [file,[hash]] of Object.entries(reviewed)) {
    assert.equal(createHash("sha256").update(await readFile(new URL("art/"+file+".webp",files))).digest("hex"),hash,file);
  }
  const trips=byTopic("travelRun");
  trips.expectNone();trips.choose("always");
  trips.expectScene("life-travel",reviewed["life-travel"][1],"여행 가방을 쌀 때","always");
  trips.choose("wish");
  trips.expectScene("life-travel",reviewed["life-travel"][1],"다음 여행에 해 보고 싶은 일","wish");
  trips.choose("wish");trips.expectNone();
  for (const option of ["sometimes","rest","limited","disliked"]) { trips.choose(option);trips.expectNone(); }

  const practice=byTopic("training");
  practice.choose("strength");practice.expectNone();
  practice.choose("drills");practice.expectScene("club-drill-study",reviewed["club-drill-study"][1],"배워 보고 싶은 동작","drills");
  practice.choose("drills");practice.expectNone();
  for (const option of ["speed","distance"]) { practice.choose(option);practice.expectNone(); }

  const record=byTopic("watch");
  record.choose("new");record.expectNone();
  record.choose("after");record.expectScene("life-record",reviewed["life-record"][1],"기록을 보고 싶은 때","after");
  record.choose("during");record.expectNone();
  record.choose("after");record.choose("after");record.expectNone();
  record.choose("without");record.expectNone();

  const race=byTopic("ownFinish");race.choose("finish");race.expectNone();
  const friend=byTopic("otherFinish");friend.choose("celebrate");friend.expectNone();
});

test("companion disclosure applies only to the opted-in answer, including all four choices", t => {
  const {host,extras,share} = setup(t);
  const modes = ["chat","own","quiet","solo"];
  const check = () => [...host.querySelectorAll(".rpx-link-area label")]
    .find(label => label.textContent.startsWith("동행 답도 링크에 담기"))?.querySelector("input");
  for (const mode of modes) {
    host.querySelector('.rpx-together [data-value="'+mode+'"]').click();
    assert.equal(share().company,null);
    assert.equal(check().checked,false);
    check().click();
    assert.equal(share().company,mode);
    assert.deepEqual(Array.from(share().axes),[]);
    check().click();
    assert.equal(share().company,null);
    check().click(); // A new selection must revoke the consent for this answer.
  }
  host.querySelector('.rpx-together [data-value="solo"]').click();
  assert.equal(share().company,null);
  assert.equal(check(),undefined);
  assert.equal(extras.readShared("#pairs=pairs-1~unanswered~_~_").company,null);
  assert.equal(extras.readShared("#pairs=card2~pairs-1~unanswered~_~_~typo~_"),null);
  assert.equal(extras.readShared("#pairs=card2~pairs-1~unanswered~uuuu~_~solo~speed"),null);
});

test("each of the sixteen combinations produces the corresponding optional conversation", t => {
  for (const friend of ["chat","own","quiet","solo"]) {
    const {host,click,share} = setup(t,{shared:{axes:[],defaultName:"내 러닝 취향",quote:"",company:friend}});
    const section = host.querySelector(".rpx-company-compare");
    const prompts = new Set();
    for (const mine of ["chat","own","quiet","solo"]) {
      host.querySelector('.rpx-together [data-value="'+mine+'"]').click();
      assert.equal(section.querySelector(".rpx-speech"),null);
      click("내 답도 나란히 보기",section);
      prompts.add(section.querySelector(".rpx-speech").textContent);
      assert.equal(share().company,null);
    }
    assert.equal(prompts.size,4);
  }
});

test("private art and legacy links hide relative strength, including when only the companion answer is disclosed", t => {
  // Explore is stronger than numbers; the two sides' published name has numbers first.
  const ratings = {numbers:[2,2,0],senses:[0,0,0],explore:[2,2,2],familiar:[0,0,0]};
  const { w,host,extras,share,copiedURL } = setup(t);
  const answers = Object.fromEntries(w.RBPairsModel.items.filter(item => ratings[item.sideId])
    .map(item => [item.id,ratings[item.sideId][Number(item.id.slice(-1))-1]]));
  const result = w.RBPairsModel.evaluate(answers);
  extras.mount(host,{result,answers,storyState:{company:"solo"}});
  const art=w.RBPairArt;
  assert.equal(art.select(result).direction,"explore");
  const assertBalanced = shared => {
    assert.equal(shared.art,null);
    assert.equal(art.select(shared).direction,null);
    assert.doesNotMatch(art.select(shared).caption,/더 뚜렷|큰 표식/);
  };
  assertBalanced(share());
  assert.ok(copiedURL().hash.endsWith("~_"));
  host.querySelector('.rpx-link-area input').click();
  const companyOnly=share();
  assert.equal(companyOnly.company,"solo");
  assert.equal(companyOnly.axes.length,0);
  assertBalanced(companyOnly);
  assert.ok(copiedURL().hash.endsWith("~solo~_"));
  assertBalanced(extras.readShared(copiedURL().hash.replace(/~_$/,"~explore")));
  const legacy=extras.readShared("#pairs=pairs-1~"+result.defaultKey+"~_~_");
  assertBalanced(legacy);
  host.querySelector('input[name="sharePairResults"]').click();
  const published=share();
  assert.equal(published.art,"explore");
  assert.equal(published.axes.length,4);
  assert.equal(art.select(published).caption,art.select(result).caption);
  assert.equal(art.select(published).image,art.select(result).image);
});

test("revoking a card while a draw is pending clears every old output, including on retry failure", async t => {
  const {host,w,click,share} = setup(t,{state:{summer:"indoor"}});
  const pending = [];
  w.RBPairArt.load = () => new Promise((resolve,reject) => pending.push({resolve,reject}));
  w.RBPairArt.draw = () => {};
  w.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect(){}, fillText(){}, strokeRect(){}, measureText(){return {width:30};},
  });
  w.HTMLCanvasElement.prototype.toDataURL = function() {
    return "data:image/png;base64,"+Buffer.from(this.getAttribute("aria-label")).toString("base64");
  };
  const tick = () => new Promise(resolve=>setTimeout(resolve,5));
  const shell = host.querySelector(".rpx-card-shell"), dl=shell.querySelector("a");
  const preview=()=>shell.querySelector(".rpx-preview img"), capture=shell.querySelector(".rpx-actions button");
  const changeQuote = value => {
    const menu=shell.querySelector(".rpx-controls > div select");
    menu.value=value;
    menu.dispatchEvent(new w.Event("change"));
  };
  shell.open=true;await tick();
  pending.shift().resolve(null);await tick();
  const base=dl.href;
  changeQuote("s:summer:indoor");
  pending.shift().resolve(null);await tick();
  assert.notEqual(dl.href,base);
  assert.match(share().quote,/실내/);
  changeQuote("s:summer:indoor");
  const obsolete=pending.shift();
  shell.open=false;
  click("실내에서 뛰고 싶어",host.querySelector(".rpx-chapter"));
  assert.equal(preview(),null);
  assert.equal(capture.disabled,true);
  assert.equal(dl.hasAttribute("href"),false);
  assert.equal(share().quote,"");
  shell.open=true;await tick();
  const newest=pending.pop();
  newest.reject(Error("image load failed"));await tick();
  assert.ok([...shell.querySelectorAll("button")].some(node=>node.textContent==="다시 불러오기"));
  obsolete.resolve(null);await tick();
  assert.equal(preview(),null);
  assert.equal(dl.hasAttribute("href"),false);
  assert.equal(capture.disabled,true);
  click("다시 불러오기",shell);
  pending.pop().resolve(null);await tick();
  assert.equal(dl.href,base);
  assert.equal(preview().src,base);
});

// With RUN_BTI_BROWSER=1, also exercise the public quiz, real canvas pixels and downloaded file.
if (process.env.RUN_BTI_BROWSER === "1") test("Chrome: withdrawing either a story sentence or the leading preference clears preview, download, capture and link", async () => {
  const { chromium } = await import("@playwright/test");
  const server = createServer(async (request,response) => {
    try {
      const path = new URL(request.url,"http://localhost").pathname.slice(1) || "index.html";
      const file = new URL(path,files);
      if (!file.href.startsWith(files.href) || !(await stat(file)).isFile()) throw Error();
      const contentType = file.pathname.endsWith(".js") ? "text/javascript" : file.pathname.endsWith(".css") ? "text/css" :
        file.pathname.endsWith(".webp") ? "image/webp" : "text/html";
      response.writeHead(200,{"Content-Type":contentType});response.end(await readFile(file));
    } catch { response.writeHead(404);response.end(); }
  });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser = await chromium.launch({channel:process.env.RUN_BTI_BROWSER_CHANNEL || "chrome"});
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.context().grantPermissions(["clipboard-read","clipboard-write"]);
    await page.goto("http://127.0.0.1:"+server.address().port+"/");
    await page.locator('[data-fp="start"]').click();
    const ratings = {numbers:[2,2,0],senses:[0,0,0],explore:[2,2,2],familiar:[0,0,0]};
    for (let i=0;i<20 && await page.locator('[data-fp="next"]').count();i++) {
      await page.locator(".fp-question input[type=radio]").evaluateAll((inputs,rated) => {
        for (const input of inputs) {
          const [side,number] = input.name.split("-");
          if (String(rated[side]?.[Number(number)-1]) === input.value) input.click();
        }
      },ratings);
      await page.locator('[data-fp="next"]').click();
    }
    const shell=page.locator(".rpx-card-shell"), preview=shell.locator(".rpx-preview img");
    const dl = shell.locator("a[download]");
    const assertSavedFile = async expected => {
      const event=page.waitForEvent("download");
      await dl.click();
      const file=await (await event).path();
      assert.equal((await readFile(file)).toString("base64"),expected.split(",")[1]);
    };
    const theme=page.locator(".rpx-chapter-shell").first(), indoor=theme.locator('[data-value="indoor"]');
    await shell.locator("summary").click();
    await preview.waitFor();
    const baseline = await dl.getAttribute("href");
    await theme.locator("summary").first().click();
    await indoor.click();
    await shell.getByLabel("카드에 넣을 한 줄").selectOption("s:summer:indoor");
    await page.waitForFunction(() => document.querySelector(".rpx-preview img")?.alt.includes("실내에서"));
    const before = await dl.getAttribute("href");
    assert.notEqual(before,baseline);
    const shared = async () => {
      await shell.getByRole("button",{name:"링크 복사"}).click();
      await shell.getByText("복사했어요.",{exact:true}).waitFor();
      return page.evaluate(async () => window.RBPairsExtras.readShared(new URL(await navigator.clipboard.readText()).hash));
    };
    assert.match((await shared()).quote,/실내/);
    await shell.locator("summary").click();
    await indoor.click();
    assert.equal(await preview.count(),0);
    assert.equal(await dl.count(),0);
    await shell.locator("summary").click();
    await preview.waitFor();
    assert.equal(await preview.getAttribute("src"),baseline);
    assert.equal((await shared()).quote,"");
    await assertSavedFile(baseline);
    await shell.getByRole("button",{name:"캡처 화면"}).click();
    assert.equal(await shell.locator("dialog img").getAttribute("src"),baseline);
    await shell.getByRole("button",{name:"돌아가기"}).click();
    // An already open dialog must also drop old pixels on a state change or programmatic update.
    await indoor.click();
    await shell.getByLabel("카드에 넣을 한 줄").selectOption("s:summer:indoor");
    await page.waitForFunction(() => document.querySelector(".rpx-preview img")?.alt.includes("실내에서"));
    await shell.getByRole("button",{name:"캡처 화면"}).click();
    await indoor.evaluate(el=>el.click());
    assert.equal(await shell.locator("dialog").count(),0);
    await preview.waitFor();
    assert.equal(await preview.getAttribute("src"),baseline);
    const visibility=shell.getByRole("checkbox",{name:/네 짝 결과도 공개하기/});
    assert.equal(await visibility.isChecked(),false);
    assert.equal((await shared()).art,null);
    assert.doesNotMatch(await preview.getAttribute("alt"),/더 뚜렷|큰 표식/);
    await visibility.check();
    await preview.waitFor();
    const published=await dl.getAttribute("href");
    assert.notEqual(published,baseline);
    assert.match(await preview.getAttribute("alt"),/탐험파가 더 뚜렷/);
    const publicLink = await shared();
    assert.equal(publicLink.art,"explore");
    assert.equal(publicLink.axes.length,4);
    await assertSavedFile(published);
    await shell.getByRole("button",{name:"캡처 화면"}).click();
    assert.equal(await shell.locator("dialog img").getAttribute("src"),published);
    await visibility.evaluate(input=>input.click());
    assert.equal(await shell.locator("dialog").count(),0);
    await preview.waitFor();
    assert.equal(await preview.getAttribute("src"),baseline);
    assert.doesNotMatch(await preview.getAttribute("alt"),/더 뚜렷|큰 표식/);
    await assertSavedFile(baseline);
    const privateLink = await shared();
    assert.equal(privateLink.axes.length,0);
    assert.equal(privateLink.art,null);
    await shell.getByRole("button",{name:"캡처 화면"}).click();
    assert.equal(await shell.locator("dialog img").getAttribute("src"),baseline);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
