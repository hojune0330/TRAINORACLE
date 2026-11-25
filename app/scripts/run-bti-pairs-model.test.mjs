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

test("every animal title uses the two source codes in order or the one supported side", () => {
  const sides = Object.fromEntries(model.axes.flatMap(axis => axis.sides.map(s => [s.id, s.label.slice(0,-1)])));
  assert.equal(Object.keys(model.characters).length,32);
  assert.equal(new Set(Object.values(model.characters).map(c => c.nickname)).size,32);
  for (const [key, character] of Object.entries(model.characters)) {
    const code = key.split("+").map(side => sides[side]).join("·");
    assert.equal(model.names[key], code + " | " + character.nickname);
    assert.ok(character.reading && character.art);
  }
  for (const axis of model.axes) {
    for (const side of axis.sides) {
      const other = axis.sides.find(s => s !== side);
      for (let i=0; i<3; i++) {
        const ratings=[2,2,2]; ratings[i]=0;
        const result = asResult({[side.id]:ratings,[other.id]:0});
        assert.equal(result.defaultKey,side.id);
        assert.ok(!result.evidence.includes(side.id+"-"+(i+1)));
      }
    }
  }
  assert.equal(model.names.senses,"감각 | 손수건 고양이");
  assert.equal(model.names["speed+numbers"],"속도·숫자 | 송골매");
  assert.equal(model.names["senses+explore"],"감각·탐험 | 호랑나비");
  assert.equal(model.items.find(i => i.id === "numbers-3").reading,"뛰면서 중간 기록을 듣는 게 좋아.");
});

// These details belong to one question. Its siblings may support the same
// preference even when the runner expressly dislikes this particular example.
const itemDetails = {
  distance: [/더\s*멀리/, /한\s*바퀴|여유가 있으면/, /(?:오래|길게)\s*(?:달리|달릴|달려|뛰|뛸)|기다려/],
  speed: [/짧은\s*구간/, /속도가?\s*붙|발이\s*빨라|빨라지는\s*순간/, /잠깐|빠르게 달리는 날|기다려/],
  numbers: [/지금\s*페이스/, /구간\s*시간|구간이 끝|걸린 시간/, /중간 기록|기록을 듣/],
  senses: [/숨소리/, /다리가\s*가벼/, /발걸음/],
  familiar: [/같은 길로 다시 돌아/, /자주 가는 코스/, /갈림길/],
  explore: [/골목/, /처음 가는 코스라면 반가/, /늘 뛰던 동네/],
  plan: [/나가기 전/, /다음 주/, /여유 있는 날/],
  improvise: [/일단 나가|뛰며 정/, /다음에 뛸 날/, /내키는 대로/],
};

test("all 32 headline readings keep their meaning when each supporting item is disliked", () => {
  const byId = Object.fromEntries(model.axes.flatMap(axis =>
    axis.sides.map(side => [side.id, axis.sides.find(other => other !== side).id])));
  let cases = 0;
  for (const [key, character] of Object.entries(model.characters)) {
    const sides = key.split("+");
    const ratings = {};
    for (const side of sides) {
      ratings[side] = 2;
      ratings[byId[side]] = 0;
    }
    for (const side of sides) {
      for (const [index, forbidden] of itemDetails[side].entries()) {
        const answers = fillSides(ratings);
        const id = side + "-" + (index + 1);
        answers[id] = 0;
        const result = model.evaluate(answers);
        const label = key + " with " + id + " disliked";
        assert.equal(result.defaultKey, key, label);
        assert.ok(!result.evidence.includes(id), label);
        assert.doesNotMatch(character.reading, forbidden, label);
        assert.ok(!character.reading.includes(model.items.find(item => item.id === id).reading), label);
        if (side === "distance") assert.match(character.reading, /멀리 가/, label);
        if (side === "speed") assert.match(character.reading, /속도(?:를)? 내/, label);
        cases++;
      }
    }
  }
  assert.equal(cases, 168);
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
  assert.equal(fullTie.defaultKey, "distance+numbers");
  assert.equal(fullTie.defaultName, "거리·숫자 | 황제펭귄");
  assert.equal(model.choiceFor(fullTie, "단골길 계획파").key, "familiar+plan");
  assert.equal(model.choiceFor(fullTie, "미리 정하고 길게").key, "distance+plan");
  assert.equal(model.choiceFor(fullTie, "distance+plan").key, "distance+plan");
  assert.equal(model.choiceFor(fullTie, model.names["distance+plan"]).key, "distance+plan");
  assert.equal(model.choiceFor(fullTie, "내키면 한 바퀴 더").key, fullTie.defaultKey);
  const fullAnswers = fillSides({distance:2, speed:0, numbers:2, senses:0, familiar:2, explore:0, plan:2, improvise:0});
  assert.match(model.resultReason(fullTie, fullAnswers, "미리 정하고 길게"), /거리 쪽과 계획 쪽/);
  assert.doesNotMatch(model.resultReason(fullTie, fullAnswers, "distance+plan"), /숫자/);
});

test("distance without another lap and split times without current pace are traced to their own questions", () => {
  const answers = fillSides({
    distance:[2, 0, 2], speed:0, numbers:[0, 2, 2], senses:0,
  });
  const result = model.evaluate(answers);
  assert.equal(result.defaultKey, "distance+numbers");
  assert.deepEqual(result.evidence, ["distance-1", "distance-3", "numbers-2", "numbers-3"]);
  const readings = [result.axes[0].sides[0], result.axes[1].sides[0]].map(side => model.sideReading(side, answers));
  const firstResult = [result.defaultName, model.resultReason(result, answers),
    ...readings.flatMap(row => row.likes.map(claim => claim.text))].join(" ");
  assert.doesNotMatch(firstResult, /한 바퀴 더|지금 페이스를 숫자로/);
  assert.match(firstResult, /조금 더 멀리/);
  assert.match(firstResult, /구간이 끝나면 걸린 시간/);
  for (const row of readings) {
    for (const claim of row.likes) {
      assert.equal(claim.evidence.length, 1);
      const [{id, value}] = claim.evidence;
      assert.equal(value, 2);
      assert.equal(answers[id], value);
      assert.equal(claim.text, model.items.find(item => item.id === id).reading);
    }
  }
});

test("all three low speed ratings remain visible even without a directional nickname", () => {
  const answers = fillSides({distance:[2, 1, 1], speed:0});
  const result = model.evaluate(answers);
  assert.equal(result.defaultKey, "open");
  assert.equal(result.axes[0].state, "middle");
  const low = model.sideReading(result.axes[0].sides[1], answers).summary;
  assert.deepEqual(low.evidence, [
    {id:"speed-1", value:0}, {id:"speed-2", value:0}, {id:"speed-3", value:0},
  ]);
  assert.match(model.resultReason(result, answers), /거리 쪽은 ‘좋아’ 1개, ‘그저 그래’ 2개/);
  assert.ok(model.resultReason(result, answers).includes(low.text));
  assert.match(low.text, /속도 쪽 세 문항에 모두 ‘안 끌려’/);
  assert.doesNotMatch(model.resultReason(result, answers), /한쪽으로 기울지/);
});

test("each specific preference in every nickname combination requires its own positive item", () => {
  const seenNames = new Set();
  for (const [index, axis] of model.axes.entries()) {
    for (const next of model.axes.slice(index + 1)) {
      for (const a of axis.sides) for (const b of next.sides) {
        const key = a.id + "+" + b.id;
        seenNames.add(model.names[key]);
        for (const target of [a, b]) for (const offset of [0, 1, 2]) {
          const specific = model.items.find(item => item.sideId === target.id && item.id.endsWith("-" + (offset + 1)));
          for (const rejected of [0, 1, "unknown", undefined]) {
            const sides = Object.fromEntries([...axis.sides, ...next.sides].map(side =>
              [side.id, side === a || side === b ? 2 : 0]));
            const answers = fillSides(sides);
            if (rejected === undefined) delete answers[specific.id];
            else answers[specific.id] = rejected;
            const result = model.evaluate(answers);
            assert.equal(result.defaultKey, key);
            assert.equal(result.defaultName, model.names[key]);
            assert.ok(!result.evidence.includes(specific.id));
            const side = result.axes.flatMap(row => row.sides).find(part => part.id === target.id);
            const {likes} = model.sideReading(side, answers);
            assert.equal(likes.length, 2);
            const claimIds = new Set(likes.map(claim => claim.evidence[0].id));
            assert.ok(!claimIds.has(specific.id));
            for (const claim of likes) {
              const [{id, value}] = claim.evidence;
              const expectedItem = model.items.find(item => item.id === id);
              assert.equal(value, 2);
              assert.equal(answers[id], value);
              assert.equal(claim.text, expectedItem.reading);
              assert.ok(!claim.text.includes("?"));
            }
            const publicTitleAndReason = result.defaultName + model.resultReason(result, answers);
            assert.doesNotMatch(publicTitleAndReason, /한 바퀴|발걸음|내킬|내키는|뛰며 정|미리 정|조금 더 멀리|페이스를 숫자로|구간 시간|중간 기록|숨소리|갈림길/);
          }
        }
      }
    }
  }
  assert.equal(seenNames.size, 24);
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
