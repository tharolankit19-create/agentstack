import { z } from "zod";
// Recording contract is separate from executable Skills. A recorded workflow starts as DRAFT.
export const teachingRecording = z.object({
  name: z.string().max(120),
  pages: z
    .array(
      z.object({
        url: z.url(),
        steps: z
          .array(
            z.object({
              action: z.enum([
                "navigate",
                "click",
                "type",
                "choose",
                "wait",
                "read",
              ]),
              semantic_target: z.string().max(500),
              input_reference: z.string().optional(),
              decision: z.string().optional(),
              expected_output: z.string().max(2000),
            }),
          )
          .max(100),
      }),
    )
    .max(30),
  tested: z.literal(false).default(false),
});
export function draftTeachingSkill(recording: unknown) {
  const r = teachingRecording.parse(recording);
  return {
    name: r.name,
    state: "DRAFT",
    source: { type: "browser-recording" },
    instructions: r,
    validation_steps: [
      "Run in sandbox",
      "Review semantic targets and inputs",
      "Verify expected output",
      "Obtain user review before enabling",
    ],
  };
}
