import { z } from "zod";

export const LexiconSchema = z.object({
  weapons: z.array(z.string()).default([]),
  targets: z.array(z.string()).default([]),
  time_hints: z.array(z.string()).default([]),
  location_hints: z.array(z.string()).default([]),
  planning: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
});

export type Lexicon = z.infer<typeof LexiconSchema>;


