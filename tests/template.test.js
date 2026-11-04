import { it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { MATCH_COLUMNS } from "../js/domain/match-contract.js";

const templateUrl = new URL("../templates/matches-template.csv", import.meta.url);

it("template contains exactly the contract header and no data rows", async () => {
  const content = await readFile(templateUrl, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line !== "");
  assert.equal(lines.length, 1, "template must contain only the header row");
  assert.deepEqual(lines[0].split(","), [...MATCH_COLUMNS]);
});
