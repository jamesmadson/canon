/**
 * The hero's timeline, in ticks of TICK milliseconds. The Canon window has to
 * start arriving within two seconds of the hero coming into view: a first
 * visit shouldn't wait on the story to see the point.
 */

export const TICK = 50; // ms
/** Loose cards hold for 0.5 seconds, then the prompt types. */
export const TYPE_AT = 10;
/** About 0.8 seconds of typing. */
export const TYPE_TICKS = 16;
/** The tabs variant: 0.3 seconds with the first tabs readable, then 100ms between squeeze steps. */
export const CROWD_AT = 6;
export const CROWD_STEP = 2;
/** The last card lands and its name fades in. */
export const GLIDE = 18;
/** 4.5 seconds once everything has landed. */
export const HOLD_FILED = 90;
/** Without a prompt, the loose cards are held for 1.5 seconds. */
export const HOLD_LOOSE = 30;
/** A little over the 300ms fade. */
export const FADE = 7;

/** How long the tabs variant waits before typing: the squeeze, then a beat. */
export function lag(variant: string, crowdSteps: number): number {
  return variant === 'tabs' ? Math.max(0, CROWD_AT + crowdSteps * CROWD_STEP + 2 - TYPE_AT) : 0;
}

/** The ticks at which each beat happens, for a variant with or without a prompt. */
export function beats(variant: string, crowdSteps: number, hasPrompt: boolean) {
  const l = lag(variant, crowdSteps);
  const typeAt = TYPE_AT + l;
  const replyAt = typeAt + TYPE_TICKS + 1;
  const filedAt = hasPrompt ? replyAt + 3 : HOLD_LOOSE;
  const outAt = filedAt + GLIDE + HOLD_FILED;
  return { typeAt, replyAt, filedAt, outAt };
}
