## ADDED Requirements

### Requirement: Machine-readable visual specification
The system SHALL maintain `e2e/visual-spec.json` containing the expected visual properties for every view, derived from `docs/plans/design-system.md` and `CLAUDE.md`.

#### Scenario: Spec covers all 12 views
- **WHEN** reading `visual-spec.json`
- **THEN** it SHALL contain entries for: DarkStudioView, WritersRoomView (energy, chat, lineup), ExpandedView, CompactView, DashboardView, PillView, Intermission, StrikeView (all 4 verdicts), GoingLiveTransition, ColdOpenTransition

#### Scenario: Each view entry has required fields
- **WHEN** reading a view entry in `visual-spec.json`
- **THEN** it SHALL contain: dimensions (width, height), background color, required_elements (array with id, description, region), and constraints (array of structural rules)

#### Scenario: Spec matches design-system.md tokens
- **WHEN** comparing `visual-spec.json` color values against `@theme` tokens in `src/renderer/index.css`
- **THEN** all color references SHALL match exactly (e.g., studio-bg = #0d0d0f, accent = #d97757)

### Requirement: Spec is version-controlled alongside code
The `visual-spec.json` file SHALL be committed to the repository and updated in the same PR as any UI change that affects visual expectations.

#### Scenario: UI change without spec update detected
- **WHEN** a PR modifies view components but does not update `visual-spec.json`
- **THEN** the visual QA pass SHALL flag the potential drift
