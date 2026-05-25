// Shared TypeScript types for the P3 Judging app.
// Track 1 populates the DB-row types (e.g. `Participant`, `Scoresheet`) via
// `InferSelectModel` from $lib/server/db/schema.ts once that schema is filled in.

export type Role = 'super_admin' | 'judge' | 'viewer';
export type Category = 'A' | 'B' | 'C';
export type Section = 'A' | 'B';
export type PerfLevel = 'Excellent' | 'Proficient' | 'Developing' | 'Insufficient';
export type Theme = 'Eco-Warriors' | 'Smart Cities' | 'Space Pioneers';
export type ScoresheetStatus = 'draft' | 'submitted' | 'finalised';
