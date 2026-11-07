No Canon record (`.strata/`) exists in this project, so nothing below is checked against a prior team decision.

## 1 · The job

Lets an owner of a small field-service crew pick one of three plans and start the free trial. Most visitors meet it once, at the moment they decide, so every repeated line costs them time during that one decision.

## 2 · Removals

1. **Table rows that are identical across all three plans: Jobs, Quotes, Scheduling and invoices, 14-day free trial.** A row that reads the same in every column cannot help anyone choose, and the Jobs and Quotes rows repeat what the cards already say. Four of the eleven rows are noise, and they sit among the six that do separate the plans (People, Dispatch board, Team calendar, Custom invoice branding, QuickBooks sync, Priority support). Drop the **Price per month** row as well. The prices are already in the cards, and the script that rewrites that row on the monthly/yearly toggle goes with it. This leaves a table with only differences in it.

2. **The trial-note line under the cards ("Every plan starts with a 14-day free trial. No card needed.").** The trial is stated in the lede, on every button ("Start free trial"), in this line, in the table, and in the FAQ. The lede and the buttons already settle it for someone about to click, and the FAQ answers the "after the trial" worry. The extra line adds nothing at the point of decision.

3. **The "Most popular" badge on Crew.** The Crew card already has a heavier border, and its column is tinted in the table. The badge is a third signal for the same thing. It also pushes Crew's name and price about 1.5rem lower than Solo's and Company's, so the three prices no longer sit on one line. Comparing those prices side by side is the main thing the cards are for. It is also an unsupported claim that a skeptical buyer will notice.

4. **The footer sentence about yearly billing.** "Yearly plans are billed once a year and cost ten months, not twelve" repeats the "Pay yearly and get two months free" note and the per-card "billed once a year" line, both of which sit right next to the toggle where someone would act on them. Keep "Prices are in US dollars" if you want a footer.

5. **FAQ "Do you charge per job?"** Every card says "Unlimited jobs," and the FAQ answer says only that. A question whose answer is already in the plan lists is a second place to read the same fact.

## 3 · Kept

- **The monthly/yearly toggle, with the per-card "billed" line that changes with it.** It is the only element that changes what a visitor pays, and it states the real charge ("$190 billed once a year") right next to the lower monthly figure. That keeps the discount honest. The 44px targets and the `aria-pressed` state make it dependable on a phone in a truck cab.
- **The remaining comparison rows once the identical ones are gone.** They show exactly where Solo, Crew and Company differ, which is what makes the second step of choosing possible. The sticky row labels and the scroll region keep that readable on narrow screens.

## 4 · Missing

All three "Start free trial" buttons link to `href="#"`. The page's whole job ends at that click, and today the click goes nowhere. This needs a real signup destination, ideally one that knows which plan was picked.

## 5 · The smallest next step

Delete the four identical rows (Jobs, Quotes, Scheduling and invoices, 14-day free trial) from the comparison table, since they are the largest block of text that can't help anyone choose.

Say which cut to make and I will make only that one.
