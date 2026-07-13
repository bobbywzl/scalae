/** support namespace — populated as its components adopt t(). */

const en = {} as const;

const zh: Record<keyof typeof en, string> = {};

export const support = { en, zh };
