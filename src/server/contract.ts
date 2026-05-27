// Compile-time only. This file is NOT pushed to GAS (it lives outside dist).
// It exists so `npm run typecheck` can assert the hand-written .js server API
// in this folder stays structurally compatible with the shared contract.
//
// If you change ServerFunctions in src/shared/types.ts, update api.js to match.
import type { ServerFunctions } from '@shared/types';

declare const _api: ServerFunctions;
export {};
