import { DISTRICT_1 } from './stages/district1';
import { DISTRICT_2 } from './stages/district2';
import { DISTRICT_3 } from './stages/district3';
import { DISTRICT_4 } from './stages/district4';
import { DISTRICT_5 } from './stages/district5';
import { DISTRICT_6 } from './stages/district6';
import type { StageDef } from './types';

/** All 60 authored stages, in play order: six districts of ten. */
export const STAGE_DEFS: readonly StageDef[] = [
  ...DISTRICT_1,
  ...DISTRICT_2,
  ...DISTRICT_3,
  ...DISTRICT_4,
  ...DISTRICT_5,
  ...DISTRICT_6,
];
