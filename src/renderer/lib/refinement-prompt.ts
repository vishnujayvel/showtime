/**
 * Builds the refinement prompt sent to Claude when the user wants to modify an existing lineup.
 * Sends user intent + current lineup state. System prompt handles identity and format.
 */
export function buildRefinementPrompt(
  message: string,
  energy: string,
  acts: Array<{ name: string; sketch: string; durationMinutes: number }>,
): string {
  const currentLineupJSON = JSON.stringify({
    acts: acts.map((a) => ({
      name: a.name,
      sketch: a.sketch,
      durationMinutes: a.durationMinutes,
    })),
  }, null, 2)

  return `I want to adjust my lineup. Energy: ${energy}.

Current lineup:
\`\`\`showtime-lineup
${currentLineupJSON}
\`\`\`

Requested change: ${message}

Respond with the complete updated lineup as a showtime-lineup JSON block.`
}
