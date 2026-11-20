// node check_profile.cjs <public/run-bti> [another/public/run-bti ...]
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function check(root) {
  const scope = { window: {} };
  for (const name of ["rb-content", "rb-motives", "rb-story-catalog", "rb-story-match", "rb-representative"]) {
    const file = path.join(root, name + ".js");
    vm.runInNewContext(fs.readFileSync(file, "utf8"), scope, { filename: file });
  }
  const { RBStoryCatalog: catalog, RBStoryMatch: matcher, RBRepresentative: representative } = scope.window;
  const profile = (chosen = {}, records = {}, stories = catalog) =>
    matcher.profile(stories, records, id => chosen[id] || null);

  assert.equal(profile().direction.status, "none");
  let endings = 0;
  for (const story of catalog) {
    for (const choice of story.choices) {
      endings++;
      const view = profile({ [story.id]: choice.id });
      assert.equal(view.storyCount, 1);
      assert.ok(["sparse", "none"].includes(view.direction.status), story.id + "/" + choice.id);
      for (const evidence of view.direction.evidence) {
        assert.equal(evidence.answer, choice.label);
        assert.equal(evidence.choiceId, choice.id);
      }
      for (const signal of choice.signals || []) {
        if (story.choices.every(c => c.signals?.includes(signal))) {
          assert.ok(!view.direction.signals.includes(signal), story.id + " shares " + signal);
        }
      }
      for (const panel of representative.select(view).panels) {
        assert.equal(panel.evidence.answer, choice.label);
        if (panel.art) assert.ok(fs.statSync(path.join(root, panel.art)).isFile(), panel.art);
      }
    }
  }

  const picks = { "seoul-cheer": "nickname", "bib-night": "cheer-sign" };
  const two = profile(picks);
  const pair = view => view.comparisons.find(c => c.left === "encouragement" && c.right === "photo");
  assert.equal(two.direction.status, "clear");
  assert.equal(pair(two).leftOnly, 2);
  assert.equal(pair(two).rightOnly, 0);
  assert.equal(representative.select(two).panels[0].signal, "encouragement");
  assert.equal(profile(picks, {}, [...catalog].reverse()).direction.title, two.direction.title);

  const switched = profile({ ...picks, "seoul-cheer": "snap" });
  assert.equal(switched.direction.status, "tied");
  assert.equal(pair(switched).leftOnly, 1);
  assert.equal(pair(switched).rightOnly, 1);
  const signals = representative.select(switched).panels.map(p => p.signal);
  assert.ok(signals.includes("photo") && signals.includes("encouragement"));
  assert.equal(profile({ "watch-silent": "mobile" }).rows[0].signal, "log");
  assert.equal(profile({ "missing-story": "archived-choice" }).storyCount, 0);

  // A story and a quiz question can supply opposite halves of the same decision.
  const onePhoto = { record: { mode: "experience", answers: [null, null, [0], null, null, null] } };
  assert.equal(profile({}, onePhoto).direction.status, "sparse");
  const together = profile({ "photo-permission": "shadows" }, onePhoto);
  assert.equal(together.direction.status, "clear");
  assert.equal(together.baseline.status, "sparse");
  const image = representative.select(together).panels.find(p => p.signal === "photo");
  assert.ok(image);
  assert.deepEqual([image.evidence.id, image.moreEvidence.id].sort(), ["photo-permission", "record"]);
  const changed = profile({ "photo-permission": "words" }, onePhoto);
  assert.equal(changed.direction.status, "tied");
  assert.ok(changed.direction.signals.includes("photo") && changed.direction.signals.includes("reflect"));

  const coSelected = [null, null, null, [0, 2], [0, 2], [0, 2], null, null, null];
  const quiz = profile({}, { base: { mode: "experience", answers: coSelected } });
  const focus = quiz.comparisons.find(c => c.left === "numbers" && c.right === "scenery");
  assert.equal(focus.total, 3);
  assert.equal(focus.both, 3);
  assert.equal(focus.winner, null);
  assert.ok(quiz.direction.signals.includes("numbers") && quiz.direction.signals.includes("scenery"));

  const weak = { "free-afternoon": 1, "looking-forward": 1, "usual-hour": 0, "next-week": 0 };
  const motive = answers => profile({}, { motive: { mode: "experience", answers } });
  const low = motive(weak);
  assert.equal(low.quizCount, 1);
  assert.equal(low.motiveComparison.rated.length, 2);
  assert.equal(low.motiveComparison.leaders[0].mean, 1);
  assert.equal(low.direction.status, "sparse");
  assert.equal(representative.select(low).panels.length, 0);
  const unanswered = motive({ "free-afternoon": "na", "looking-forward": "unsure", "next-week": "skip" });
  assert.equal(unanswered.motiveComparison, null);
  assert.equal(unanswered.direction.status, "none");
  console.log(`${root} — ${catalog.length} stories, ${endings} endings, decision and illustration checks passed.`);
}

const roots = process.argv.slice(2);
for (const dir of roots.length ? roots : [path.resolve(__dirname, "../..")]) check(path.resolve(dir));
