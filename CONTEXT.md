# StackScout

StackScout is a NZ supplement comparison product. This context defines the planning language agents should use when maintaining or evolving the project roadmap.

## Language

**Roadmap Auditor**:
An agent skill that updates the current roadmap from evidence found in the repository, deployment configuration, docs, tests, and recent project state. It preserves strategy unless the user explicitly asks to change it.
_Avoid_: Roadmap updater, status writer

**Evidence-Backed Status Update**:
A roadmap change tied to inspectable evidence such as code, tests, docs, config, analytics exports, or user-provided facts. If evidence is missing or weak, the status should remain uncertain rather than be marked complete.
_Avoid_: Vibe-based update, assumed completion

**Roadmap Strategist**:
An agent skill that reprioritizes what StackScout should build next by weighing goals, constraints, risks, sequencing, and evidence. It may propose roadmap changes but should keep strategic tradeoffs visible for human judgment.
_Avoid_: Roadmap auditor, backlog sorter

**Vision Planning**:
An interview mode used when no roadmap exists, focused on understanding the product vision, target users, constraints, and success criteria before creating an initial roadmap.
_Avoid_: Roadmap audit, implementation planning

**Project Roadmap Skill**:
A generic agent skill intended to work across repositories by discovering local roadmap conventions before acting. It should adapt to the project's existing files and language instead of assuming StackScout-specific structure.
_Avoid_: StackScout-only roadmap skill

**Canonical Roadmap**:
The single roadmap file that represents the project's current plan, status, priorities, blockers, and success criteria. A roadmap auditor updates only this file; other planning documents are treated as supporting context or evidence.
_Avoid_: Multiple roadmaps, roadmap-like docs

**Roadmap Status**:
A controlled vocabulary for roadmap item state: `Done`, `Partial`, `Blocked`, `Unverified`, and `Not Started`. The auditor may map an existing roadmap's icons or labels onto this vocabulary, but should not mark work `Done` unless implementation and verification evidence both support it.
_Avoid_: Complete-ish, probably done

**Conservative Roadmap Edit**:
A roadmap update that preserves the canonical roadmap's existing structure, headings, phase order, and local language while changing only status, blockers, stale claims, or concise verification notes. Reorganizing priorities belongs to roadmap strategy, not roadmap audit.
_Avoid_: Roadmap rewrite, format normalization

**Roadmap Audit Report**:
A separate evidence record for a roadmap audit, usually stored under `docs/roadmap-audits/`. It contains inspected files, commands run, evidence for changed items, uncertainty, skipped checks, and recommendations, while the canonical roadmap receives only concise status or blocker updates.
_Avoid_: Inline evidence dump

**Real Roadmap Audit**:
An audit run that inspects project evidence to evaluate roadmap status. Every real roadmap audit produces a roadmap audit report, even when it makes no roadmap changes.
_Avoid_: Silent audit, invisible no-change audit

**Audit Report Frontmatter**:
A small YAML metadata block at the top of a roadmap audit report that records the canonical roadmap path, audit date, result, and status counts. The report remains human-readable markdown and should not include strategic recommendations.
_Avoid_: Heavy audit schema, recommendations in audit report

**Strategy Proposal**:
A roadmap strategy artifact that recommends priorities, sequencing, scope cuts, or next steps using evidence from the roadmap, audit reports, and project context. It should not change the canonical roadmap unless the user explicitly approves applying it.
_Avoid_: Silent roadmap reprioritization

**Initial Roadmap**:
The first canonical roadmap created after a vision planning interview when no roadmap exists. It should capture vision, target users, project stage, success criteria, constraints, non-goals, first slices, open questions, and risky assumptions without becoming a full PRD.
_Avoid_: Full strategy bible
