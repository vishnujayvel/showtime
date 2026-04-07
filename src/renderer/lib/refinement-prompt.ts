/** Builds the refinement prompt sent to Claude to modify an existing lineup based on user intent. */
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
