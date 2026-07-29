/** Shared list reflow — ease-in-out, under 300ms. */
export const LIST_LAYOUT_TRANSITION = {
  duration: 0.26,
  ease: [0.77, 0, 0.175, 1] as const,
};

/** Closed-Done exit — snappy ease-out. */
export const LIST_EXIT_TRANSITION = {
  duration: 0.2,
  ease: [0.23, 1, 0.32, 1] as const,
};
