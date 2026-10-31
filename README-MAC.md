# Remain Core, on your Mac

This folder is the Mac source of truth for Kishore's core build. Do NOT use the VM folder ~/workspace/remain-core. The VM Claude Code run was stopped on Oct 30, 2026, before it created a handoff or any code, and it must not be used.

Files in this folder:
- final-spec-remain-2026-10-30.md: final agreed product spec, core preserved.
- work-split-remain-2026-10-30.md: work split for all four teammates, Kishore first.
- claude-code-prompt-kishore-core-2026-10-30.md: Prompt A (plan, fable) and Prompt B (implement, Opus), in order.
- README-MAC.md: this file.

Working title: Remain. Final product name is to be decided later by the team. Do not rename code or files until the team decides.

How to run, on your Mac, in this folder:
1. Open Terminal in this folder, or cd to it: cd ~/Documents/Remain-Core
2. Start Claude Code, with model fable, in plan mode if you can. Paste Prompt A from the prompt file. Approve only the HANDOFF-CORE.md write. Do not let it write code, commit, or push in this step.
3. Read HANDOFF-CORE.md, fix anything wrong in it.
4. Start a fresh Claude Code session with model Opus, in the same folder, with HANDOFF-CORE.md present. Paste Prompt B. Let Opus implement the core fully, module by module, with tests after each module.
5. Review the diff and test output yourself. Only then tell Opus to commit and push to GitHub, so Rineetha, Partiban, and Xinyan can pull the core.

Scope: core only. No full persona journeys, no demo video, no submission in this build. Those are teammates' items, built later on this core.
Hard deadline: submissions due Sat Oct 31, 2026, 10:00 AM ET. Demo video target 2:27, hard max 2:29.
