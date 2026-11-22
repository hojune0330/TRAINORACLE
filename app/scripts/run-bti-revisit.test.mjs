import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

test("opening and editing a saved run preserves its identity, stories and eligible chosen name", () => {
  const dom = new JSDOM('<header id="mast"></header><main id="main"></main><footer id="foot"></footer><div id="toast"></div>', {
    url:"https://example.test/run-bti/", runScripts:"outside-only",
  });
  const {window} = dom;
  try {
    const {document, localStorage, sessionStorage} = window;
    const load = name => window.eval(readFileSync(new URL("../public/run-bti/" + name, import.meta.url), "utf8"));
    window.scrollTo = () => {};
    window.RBScene = {assetURL: path => path, audio:{enabled:() => false, effect:() => {}}};
    window.RBPairArt = {select() {}, mount() {}};
    load("rb-pairs-model.js");
    // Capture the UI's handoff. Each mounted story and image has its own real-renderer checks.
    let mounted;
    window.RBPairsExtras = {readShared:() => null, archiveStories: state => ({...state}),
      mount:(_host, options) => { mounted = options; }};
    load("rb-pairs-ui.js");
    const model = window.RBPairsModel;
    const answers = Object.fromEntries(model.axes.flatMap(axis => axis.sides.flatMap((side, index) =>
      [1, 2, 3].map(n => [side.id + "-" + n, index === 0 ? 2 : 0]))));
    const choices = model.evaluate(answers).choices;
    assert.ok(choices.length > 1);
    const selected = choices.at(-1);
    const key = "runbti." + model.version + ".saved.runner-42";
    const saved = {id:"runner-42",version:model.version,at:"2026-10-15T01:02:03.000Z",
      personalName:selected.name, answers, stories:{snow:"want",summer:"less"}};
    localStorage.setItem(key, JSON.stringify(saved));
    const click = action => document.querySelector('[data-fp="' + action + '"]').click();
    const select = (id, value) => document.querySelector('input[name="' + id + '"][value="' + value + '"]').click();
    const nextUntil = selector => {
      for (let n = 0; n < 12 && !document.querySelector(selector); n++) click("next");
      assert.ok(document.querySelector(selector), selector);
    };
    window.RBPairsUI.start();
    click("archive"); click("open");
    assert.equal(document.querySelector("h1").textContent, selected.name);
    click("edit");
    nextUntil(".fp-result-top");
    assert.equal(mounted.selectedName, selected.name);
    assert.deepEqual({...mounted.storyState}, saved.stories);
    click("save");
    let record = JSON.parse(localStorage.getItem(key));
    assert.equal(localStorage.length, 1);
    assert.equal(record.at, saved.at);
    assert.deepEqual(record.answers, answers);
    assert.equal(record.personalKey, selected.key);
    assert.equal(sessionStorage.length, 0);
    click("edit");
    select("learning", "class");
    nextUntil('input[name="strength"]');
    select("strength", "other");
    const note = document.querySelector('[data-note="strength"]');
    const privateText = "마지막 언덕에서 <힘> 아껴 쓰기";
    note.value = privateText;
    note.dispatchEvent(new window.Event("input", {bubbles:true}));
    click("return-result");
    assert.ok(document.querySelector(".fp-facts").textContent.includes(privateText));
    assert.equal(mounted.selectedName, selected.name);
    click("save");
    record = JSON.parse(localStorage.getItem(key));
    assert.equal(localStorage.length, 1);
    assert.equal(record.at, saved.at);
    assert.equal(record.answers.learning, "class");
    assert.equal(record.answers.strength, "other");
    assert.deepEqual(record.stories, saved.stories);
    assert.equal(record.personalKey, selected.key);
    assert.equal(localStorage.getItem(key).includes(privateText), false);
    assert.equal(JSON.stringify(mounted).includes(privateText), false);
    click("edit");
    nextUntil('input[name="strength"]');
    assert.equal(document.querySelector('[data-note="strength"]').value, privateText);
    select("strength","speed");
    select("strength","other");
    assert.equal(document.querySelector('[data-note="strength"]').value, "");
    click("return-result");
    click("home"); click("start");
    nextUntil(".fp-result-top");
    click("save");
    assert.equal(localStorage.length, 2, "starting a separate test still creates a separate record");
  } finally { window.close(); }
});
