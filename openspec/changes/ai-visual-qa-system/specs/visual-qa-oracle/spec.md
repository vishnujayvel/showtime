## ADDED Requirements

### Requirement: Claude Code visual QA skill
The system SHALL provide a `/visual-qa` skill that uses Claude Code runtime (Read tool) to evaluate E2E screenshots against `e2e/visual-spec.json`. Zero Anthropic API cost.

#### Scenario: Full QA pass on all views
- **WHEN** the `/visual-qa` skill is invoked after E2E tests complete
- **THEN** Claude Code SHALL read each screenshot from `e2e/screenshots/` via the Read tool, evaluate it against the corresponding entry in `visual-spec.json`, and report structured pass/fail per view

#### Scenario: Structured output per view
- **WHEN** Claude Code evaluates a screenshot
- **THEN** the output SHALL include: view name, pass/fail status per check item, severity (critical/major/minor), and reason for each finding

#### Scenario: Design drift detection
- **WHEN** a screenshot shows elements that don't match `visual-spec.json` criteria (wrong colors, missing elements, incorrect fonts)
- **THEN** Claude Code SHALL flag the specific deviation with the expected vs observed values

### Requirement: Baseline validation from first principles
No screenshot SHALL become a golden baseline without independent validation by Claude Code against the design spec.

#### Scenario: New baseline proposed
- **WHEN** `--update-snapshots` is run to create new baselines
- **THEN** the `/visual-qa` skill SHALL evaluate each new baseline against `visual-spec.json` before accepting it

#### Scenario: Stale baseline detected
- **WHEN** Claude Code evaluates a baseline screenshot and finds it doesn't match the current `visual-spec.json`
- **THEN** the baseline SHALL be flagged as stale with specific deviations listed

### Requirement: Zero API cost principle
The visual QA oracle SHALL NOT call the Anthropic API, use `@anthropic-ai/sdk`, or incur any cost beyond the Claude Code session.

#### Scenario: No API imports in test code
- **WHEN** scanning the `e2e/` directory for imports
- **THEN** there SHALL be zero imports of `@anthropic-ai/sdk`, `anthropic`, or any LLM client library
