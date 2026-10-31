// Marking a paper by hand when suggestions did not arrive. The TA picks the mistakes from the scheme, the scheme computes the
// mark, the TA types the final mark. It is an ordinary decision record: no suggestions were proposed, so `proposed` is empty.
import { decisionRecord } from "../../lib/logshape.js";
import { score } from "../../lib/engine.js";

export function manualRecord({ idea, itemId, codes, grade, decidedBy, feedback, table }) {
  return decisionRecord(idea, itemId, { decidedBy, proposed: [], confirmed: codes, overrides: [], computedScore: score(codes, table), grade, receipt: "Assigned by you (TA)", feedback, rubricVersion: table.version });
}
