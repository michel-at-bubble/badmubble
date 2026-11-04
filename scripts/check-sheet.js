// Development helper: loads the live `Matches` worksheet and prints validation issues.
// Usage: npm run check-sheet

import { MATCHES_SHEET } from "../js/config.js";
import { loadMatches } from "../js/data/matches-source.js";
import { RESULT_STATUS } from "../js/domain/match-contract.js";

try {
  const { matches, issues } = await loadMatches(MATCHES_SHEET);

  const count = (status) => matches.filter((match) => match.resultStatus === status).length;
  console.log(
    `${matches.length} matches: ${count(RESULT_STATUS.COMPLETE)} complete, ` +
      `${count(RESULT_STATUS.PARTIAL)} partial, ${count(RESULT_STATUS.NONE)} without result.`,
  );

  if (issues.length === 0) {
    console.log("No issues found.");
  } else {
    console.log(`${issues.length} issue(s):`);
    for (const entry of issues) {
      const where = entry.row === null ? "header" : `row ${entry.row}`;
      const id = entry.matchId ? ` (${entry.matchId})` : "";
      console.log(`  ${where}${id}: ${entry.message} [${entry.code}]`);
    }
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`${error.message}${error.cause ? ` (${error.cause.message})` : ""}`);
  process.exitCode = 2;
}
