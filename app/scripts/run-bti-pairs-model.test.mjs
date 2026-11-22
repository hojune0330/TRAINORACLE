import assert from "node:assert/strict";
import { test } from "node:test";
import "../public/run-bti/rb-pairs-model.js";

const model = globalThis.RBPairsModel;

function fillSides(answers) {
  return Object.fromEntries(model.items.flatMap(item => {
    const value = answers[item.sideId];
    if (!Array.isArray(value)) return value === undefined ? [] : [[item.id, value]];
    return [[item.id, value[Number(item.id.slice(-1)) - 1]]];
  }));
}

const asResult = sides => model.evaluate(fillSides(sides));

test("31 fixed questions, 24 combination titles and 12 public prompts", () => {
  assert.equal(new Set([...model.items, ...model.extras].map(item => item.id)).size, 31);
  assert.equal(Object.keys(model.names).filter(key => key.includes("+")).length, 24);
  assert.equal(new Set(model.axes.flatMap(axis => axis.prompts)).size, 12);
  for (const axis of model.axes) {
    for (const side of axis.sides) {
      assert.equal(model.items.filter(item => item.sideId === side.id).length, 3);
    }
  }
  assert.deepEqual(model.extras.flatMap(q => q.options.filter(o => o.sensitive).map(o => o.id)), ["weight", "recognition"]);
});

test("likes, low ratings, middle, unknowns and unavailable experience remain distinct", () => {
  const style = (a, b) => asResult({ distance: a, speed: b }).axes[0];
  assert.equal(style(2, 2).state, "both");
  assert.equal(style(0, 0).state, "neither");
  assert.equal(style(1, 1).state, "middle");
  assert.equal(style([2, 2, 0], [2, 1, 1]).state, "middle");
  assert.equal(style([2, "unknown", 2], [2, 1, null]).state, "direction");
  assert.equal(style([2, "unknown", null], 0).state, "insufficient");
  assert.equal(style(["2", false, -1], 0).sides[0].mean, null);
  assert.equal(asResult({}).defaultKey, "unanswered");
  assert.equal(asResult({ distance: 0, speed: 0 }).defaultKey, "open");
  assert.equal(asResult({ distance: 2, speed: 0 }).defaultKey, "distance");
});

test("a unique first side stays in every candidate at a tied second-place cutoff", () => {
  const result = asResult({
    distance: 2, speed: 0,
    numbers: [2, 2, 1], senses: 0,
    familiar: [2, 2, 1], explore: 0,
    plan: 1, improvise: 0,
  });
  assert.equal(result.defaultKey, "distance+numbers");
  assert.deepEqual(result.choices.map(choice => choice.key), ["distance+numbers", "distance+familiar"]);
  for (const choice of result.choices) {
    for (const item of choice.evidence) assert.ok(choice.key.split("+").includes(item.split("-")[0]));
  }
  const fullTie = asResult({ distance: 2, speed: 0, numbers: 2, senses: 0, familiar: 2, explore: 0, plan: 2, improvise: 0 });
  assert.equal(fullTie.choices.length, 6);
  assert.equal(fullTie.defaultName, "숫자 보며 한 바퀴 더");
});

test("all 24 titles are reachable and traceable; context, goals and property order cannot score", () => {
  const seen = new Set();
  for (let a = 0; a < model.axes.length; a++) {
    for (let b = a + 1; b < model.axes.length; b++) {
      for (const first of model.axes[a].sides) {
        for (const second of model.axes[b].sides) {
          const values = {};
          for (const side of [...model.axes[a].sides, ...model.axes[b].sides]) {
            values[side.id] = side === first || side === second ? 2 : 0;
          }
          const answers = fillSides(values);
          const result = model.evaluate(answers);
          assert.equal(result.defaultKey, first.id + "+" + second.id);
          assert.equal(result.evidence.length, 6);
          assert.ok(result.evidence.every(id => answers[id] === 2));
          const reordered = Object.fromEntries(Object.entries(answers).reverse());
          assert.deepEqual(model.evaluate({ motives: ["recognition"], goal: "speed", coach: "class", ...reordered }), result);
          seen.add(result.defaultKey);
        }
      }
    }
  }
  assert.equal(seen.size, 24);
});

test("compatibility is symmetric, ignores nonpublic or old answers, and only reports shared likes", () => {
  const result = { version: model.version, axes: [{ id: "signals", state: "direction", direction: "numbers" }] };
  const opposite = { version: model.version, axes: [{ id: "signals", state: "direction", direction: "senses" }] };
  assert.deepEqual(model.compare(result, opposite), model.compare(opposite, result));
  assert.equal(model.compare(result, opposite)[0].text, "중간 기록은 뛰면서 알려 줄까? 끝나고 같이 볼까?");
  assert.deepEqual(model.compare(result, { ...opposite, version: "reading-1" }), []);
  assert.deepEqual(model.compare(result, { version: model.version, axes: [] }), []);
  const allLikes = { version: model.version, axes: [{ id: "signals", state: "both" }] };
  assert.equal(model.compare(result, allLikes)[0].kind, "common");
  assert.ok(model.compare(result, allLikes)[0].text.includes("숫자"));
  assert.deepEqual(model.compare(result, { version: model.version, axes: [{ id: "signals", state: "middle" }] }), []);
});

test("one-step sensitivity stays within the frozen synthetic regression budget", t => {
  let seed = 20261122;
  function nextRating() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return Math.floor(3 * seed / 4294967296);
  }
  let moves = 0;
  let changes = 0;
  for (let n = 0; n < 4096; n++) {
    const answers = Object.fromEntries(model.items.map(item => [item.id, nextRating()]));
    const initial = model.evaluate(answers).defaultKey;
    for (const { id } of model.items) {
      const original = answers[id];
      for (const step of [-1, 1]) {
        if (original + step < 0 || original + step > 2) continue;
        answers[id] = original + step;
        moves++;
        if (model.evaluate(answers).defaultKey !== initial) changes++;
      }
      answers[id] = original;
    }
  }
  assert.equal(moves, 130924);
  assert.ok(changes <= 25444, changes + " changed titles exceed the 25444 baseline");
  t.diagnostic(changes + " / " + moves + " one-step changes produced a different default title");
});
