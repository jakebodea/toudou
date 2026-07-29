/** Shared list reflow — ease-in-out, under 300ms. */
export const LIST_LAYOUT_TRANSITION = {
  duration: 0.26,
  ease: [0.77, 0, 0.175, 1] as const,
};

/** New card enter — quick ease-out so composer submit feels instant. */
export const LIST_ENTER_TRANSITION = {
  duration: 0.18,
  ease: [0.23, 1, 0.32, 1] as const,
};

/** Closed-Done exit — snappy ease-out. */
export const LIST_EXIT_TRANSITION = {
  duration: 0.2,
  ease: [0.23, 1, 0.32, 1] as const,
};

/** Clear-all cascade — slightly longer than single exit so the wave reads. */
export const LIST_CLEAR_EXIT_TRANSITION = {
  duration: 0.22,
  ease: [0.23, 1, 0.32, 1] as const,
};

/** Delay between each card in the clear-all stagger. */
export const LIST_CLEAR_STAGGER_S = 0.035;

/** Cap how many cards participate in the stagger (rest exit with the last wave). */
export const LIST_CLEAR_STAGGER_MAX = 12;

export function clearAllAnimationMs(visibleCount: number): number {
  if (visibleCount <= 0) {
    return 0;
  }
  const staggered = Math.min(visibleCount, LIST_CLEAR_STAGGER_MAX);
  return (
    (staggered - 1) * LIST_CLEAR_STAGGER_S * 1000 +
    LIST_CLEAR_EXIT_TRANSITION.duration * 1000
  );
}

export function clearAllStaggerDelay(index: number): number {
  return Math.min(index, LIST_CLEAR_STAGGER_MAX - 1) * LIST_CLEAR_STAGGER_S;
}
