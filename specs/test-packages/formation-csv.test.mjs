import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv } from "./formation-csv.mjs";

test("strict CSV accepts escaped quotes and embedded newlines", () => {
  const parsed = parseCsv('id,note\n1,"line one\nline ""two"""\n', "valid.csv");
  assert.deepEqual(parsed.headers, ["id", "note"]);
  assert.deepEqual(parsed.rows, [{ id: "1", note: 'line one\nline "two"' }]);
});

for (const [name, csv, message] of [
  ["unterminated quote", 'id,note\n1,"open\n', /unterminated quoted field/u],
  ["illegal quote", 'id,note\n1,bad"quote\n', /illegal quote/u],
  ["extra cell", "id,note\n1,ok,extra\n", /row 2 has 3 columns; expected 2/u],
  ["missing cell", "id,note\n1\n", /row 2 has 1 columns; expected 2/u],
  ["duplicate header", "id,id\n1,2\n", /duplicate header id/u],
  ["blank header", "id,\n1,2\n", /blank header/u],
]) {
  test(`strict CSV rejects ${name}`, () => {
    assert.throws(() => parseCsv(csv, `${name}.csv`), message);
  });
}
