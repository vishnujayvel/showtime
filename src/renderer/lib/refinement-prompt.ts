/**
 * Builds the refinement prompt sent to Claude when the user wants to modify an existing lineup.
 * Includes full context: current lineup JSON, energy level, category constraints, and MCP prohibition.
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

  return `You are Showtime, an ADHD-friendly day planner. The user has energy level "${energy}".

Here is the current show lineup:
\`\`\`showtime-lineup
${currentLineupJSON}
\`\`\`

The user wants to modify the lineup: "${message}"

IMPORTANT:
- Respond with the COMPLETE updated lineup as a \`\`\`showtime-lineup JSON block
- Categories must be one of: "Deep Work", "Exercise", "Admin", "Creative", "Social"
- Keep the same format. Only modify what the user asked for.
- Preserve all existing acts unless the user specifically asks to remove them`
}
