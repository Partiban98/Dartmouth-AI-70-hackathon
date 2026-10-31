// Three ideaConfigs. One pipeline, one gate, one engine, one review pattern.
export function makeIdeas({ gradeStandards, companion, upskillStandards }) {
  const companionStandards = {
    id: companion.id, version: companion.version, owner: companion.owner, status: companion.status, max: 0,
    codes: [...companion.keyPoints.map((k) => ({ code: k.code, deduction: 0, label: k.label })),
      { code: "OK", deduction: 0, label: "No gap" }, { code: "UNSURE", deduction: 0, label: "Ask the teacher" }],
  };
  const codesOf = (t) => t.codes.map((c) => c.code).filter((c) => c !== "OK" && c !== "UNSURE");
  return {
    grade: {
      id: "grade", title: "Teacher and TA: Grading", owner: "Partiban Anathurai",
      allowlistFields: ["steps", "finalAnswer"], standards: gradeStandards, promptName: "grade-propose",
      allowedCodes: codesOf(gradeStandards), ruleCandidates: ["methodSignatures", "answerCheck"],
      verifyAgainst: ["steps"], receiptText: "Assigned by you (TA)", requiresGradeInput: true,
    },
    companion: {
      id: "companion", title: "Student: Course Companion", owner: "Rineetha Gunasekaran",
      allowlistFields: ["answer", "source"], standards: companionStandards, companion, promptName: "companion-gap",
      allowedCodes: codesOf(companionStandards), ruleCandidates: ["keyPoints"],
      verifyAgainst: ["source"], receiptText: "Fixed by you",
      lockRule: (input) => (companion.lockedItems ?? []).some((l) => l.item === input.item),
    },
    upskill: {
      id: "upskill", title: "Academic Staff: Upskilling", owner: "Xinyan Huang",
      allowlistFields: ["text", "facts", "draft"], standards: upskillStandards, promptName: "upskill-coach",
      allowedCodes: codesOf(upskillStandards), ruleCandidates: ["factsCheck"], allowSuggestion: true,
      verifyAgainst: ["text", "draft"], receiptText: "Approved by you", requiresReviewedAllCheckbox: true,
    },
  };
}
