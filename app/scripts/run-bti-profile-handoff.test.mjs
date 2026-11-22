import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

test("profile transfer requires fresh field selections and keeps the results out of the URL", async () => {
  const dom = new JSDOM("<section></section>", {url: "https://example.test/run-bti/", runScripts: "outside-only"});
  const { window } = dom;
  try {
    for (const file of ["rb-pairs-model.js", "rb-pairs-profile.js"]) {
      window.eval(readFileSync(new URL("../public/run-bti/" + file, import.meta.url), "utf8"));
    }
    const opened = [], sent = [];
    let receiver;
    window.open = url => opened.push(new URL(url));
    window.BroadcastChannel = class {
      constructor() { receiver = this; }
      postMessage(message) { sent.push(JSON.parse(JSON.stringify(message))); }
      close() {}
    };
    const host = window.document.querySelector("section");
    const date = "2026-11-01T09:00:00.000Z";
    const story = {snow: "want", restPressure: "worry"};
    window.RBPairsProfile.mount(host, window.RBPairsModel.evaluate({}), {goal:"speed", motives:["weight"]}, date, () => story);
    const details = host.querySelector("details");
    const toggled = new Promise(resolve => details.addEventListener("toggle", resolve, {once: true}));
    details.open = true;
    await toggled;
    const checkbox = label => [...host.querySelectorAll("label")].find(el => el.textContent.includes(label)).querySelector("input");
    const submit = () => host.querySelector("form").dispatchEvent(new window.Event("submit", {cancelable:true}));
    assert.equal(host.querySelectorAll("input:checked").length, 0);
    checkbox("다음 목표").click();
    checkbox("눈 오는 날").click();
    story.snow = "no";
    submit();
    assert.equal(opened.length, 0);
    assert.equal(checkbox("눈 오는 날").checked, false);
    assert.equal(checkbox("다음 목표").checked, true);
    submit();
    assert.equal(opened.length, 1);
    assert.deepEqual([...opened[0].searchParams.keys()], ["run-bti-profile"]);
    assert.equal(sent.length, 0);
    receiver.onmessage({data:"ready"});
    assert.deepEqual(sent[0].data, {version:"pairs-1", source:"self-report", answeredAt:date, goal:"speed"});
    receiver.onmessage({data:"saved"});
  } finally { window.close(); }
});
