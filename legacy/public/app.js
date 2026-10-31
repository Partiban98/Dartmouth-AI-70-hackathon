// Shell: loads seeds, wires tabs, mounts the journeys. Student and Staff tabs are later stretch beats on the same core.
import { makeIdeas } from "/lib/ideas.js";
import { HONEST_LIMIT } from "/lib/gate.js";
import { mountGrade } from "/grade.js";

const get = (path) => fetch(path).then((r) => r.json());
const [course, gradeStandards, companion, upskillStandards, submissions] = await Promise.all([
  get("/data/course.json"), get("/data/grade-q5.v1.0.json"), get("/data/companion-ch3.json"), get("/data/upskill-email.v1.0.json"), get("/data/grade-q5.submissions.json")]);
const ideas = makeIdeas({ gradeStandards, companion, upskillStandards });
document.getElementById("honest-limit").textContent = HONEST_LIMIT;

const tabs = [...document.querySelectorAll('[role="tab"]')];
for (const t of tabs) t.addEventListener("click", () => {
  for (const x of tabs) { x.setAttribute("aria-selected", String(x === t)); document.getElementById(x.getAttribute("aria-controls")).hidden = x !== t; }
});

mountGrade({
  ideas, course, submissions,
  modelLabel: document.getElementById("model-label"),
  mounts: { rubric: document.getElementById("mount-rubric"), queue: document.getElementById("mount-queue"), flow: document.getElementById("mount-flow"), insights: document.getElementById("mount-insights") },
});
