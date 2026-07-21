export type TourAdvance = "next" | "routeReached" | "targetClick";
export type TourStep = { advanceOn: TourAdvance; body: string; id: string; route: string; targetSelector: string; title: string };
export type TourState = { startedAt: string; stepId: string };
export const tourStorageKey = "suno.tour.state";
export function currentTourStep(steps: readonly TourStep[], state: TourState | null) { return state ? steps.find((step) => step.id === state.stepId) ?? null : null; }
export function startTour(steps: readonly TourStep[], now: string): TourState | null { const first = steps[0]; return first ? { startedAt: now, stepId: first.id } : null; }
export function advanceTour(steps: readonly TourStep[], state: TourState): TourState | null { const index = steps.findIndex((step) => step.id === state.stepId); const next = steps[index + 1]; return next ? { ...state, stepId: next.id } : null; }
export function backTour(steps: readonly TourStep[], state: TourState): TourState { const index = steps.findIndex((step) => step.id === state.stepId); return index > 0 ? { ...state, stepId: steps[index - 1]!.id } : state; }
export function skipMissingTourStep(steps: readonly TourStep[], state: TourState, targetFound: boolean) { return targetFound ? state : advanceTour(steps, state); }
