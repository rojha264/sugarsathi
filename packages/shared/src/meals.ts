/** Breakfast, lunch and dinner are logged once a day (logging again edits that entry). Snacks can repeat. */
export const ONCE_A_DAY = ['breakfast', 'lunch', 'dinner'] as const;
export const onceADay = (slot: string) => (ONCE_A_DAY as readonly string[]).includes(slot);
