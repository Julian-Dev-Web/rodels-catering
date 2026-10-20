# Ingredient-aware allergy warnings — October 20, 2026

## Root cause and real data audit

The previous matcher joined selected dishes to `dish_allergens`. Only 15 dishes had initial Seafood tags, derived from the owner-provided Seafood menu category. Egg, Milk/dairy, Soy and the other categories had no assignments. There were no structured recipe ingredient records, and the client disabled the warning query unless a category checkbox was selected, ignoring custom-only notes.

The live catalog contained **87 dishes, 79 active, zero staff-reviewed allergen lists**. No trustworthy complete recipes were supplied with this task. The new migration deliberately seeds no recipe ingredients and certifies no existing dish as verified. All 87 original dishes therefore need Manager recipe entry/review; their names and availability are listed in `INGREDIENT_REVIEW_QUEUE_2026-10-20.md`.

Green Peas with Quail Eggs now follows the same mechanism as every other dish: an Egg declaration plus a staff-confirmed quail-egg ingredient/tag produces an explicit Egg/ingredient warning. Until that actual recipe is entered, the live dish correctly shows an unverified ingredient warning requiring acknowledgment when an allergy is declared. Its name alone is not used as recipe proof.

## Implemented behavior

- Staff-managed normalized ingredient definitions, aliases and ingredient-to-allergen relationships. Immutable definitions prevent editing one recipe from silently changing another recipe's ingredients.
- Each dish has ingredient review state, revision, update/review timestamps, reviewer, ingredient/component/label notes and separate cross-contact metadata.
- Supports all eight existing categories: Egg, Milk/dairy, Peanut, Seafood, Sesame, Soy, Tree nuts and Wheat/gluten. Existing `milk`/`wheat` booking identifiers remain compatible; standardized ingredient aliases `milk_dairy`/`wheat_gluten` and fish/shellfish tags map to the corresponding existing categories.
- Custom notes use exact normalized ingredient names and staff-provided aliases, separated by commas, semicolons or newlines. Unknown prose/terms generate a staff-verification risk, never a guessed safe result. Whitespace-only notes stay optional.
- Immediate query updates for declarations, notes and selected dishes, with current-recipe refresh on focus and bounded 15-second recipe polling while relevant dishes are selected. Continue/Finalize fail closed if warnings are unavailable or unresolved.
- Separate confirmed ingredient matches, cross-contact, unresolved legacy tags, incomplete ingredients and reviewed-no-match results. Reviewed-no-match includes a clear non-guarantee notice.
- Dish-specific warnings and unchecked acknowledgment controls appear with selected dishes; the selected-dish summary links to those warnings. Selected dishes remain visible even when a search/category filter would otherwise hide them. Warning panels use full-width responsive rows.
- One acknowledgment covers the complete displayed risk set for that dish. Declaration/note/selection changes invalidate context-dependent tokens; a recipe edit invalidates that dish's acknowledgment. Deselecting a dish removes its acknowledgment requirement. No declared allergy requires no acknowledgment.
- Save Draft, Resume and Back/Next retain valid declarations, exact notes, selected dishes and bounded acknowledgment metadata. Recipe changes still require renewed acknowledgment.
- Final submission recomputes risks under database locks and stores a server-generated warning/acknowledgment snapshot with matched evidence, risk set, recipe hash and server timestamp. Existing historical bookings are not reinterpreted as newly acknowledged.
- Authorized reservation details show submission-time evidence separately from current recipe follow-up. Historical prices, payment records and financial snapshots are preserved.

## Manager workflow

1. Open **Manager → Menu Library** (`/manager/menu`), select Dishes, and use the **Ingredient review queue** filter. Search works with the existing table; frequent booking selections appear first.
2. Click **Edit Ingredients & Allergens** for a dish.
3. Enter actual kitchen ingredients, sauces, garnishes and known sub-ingredients. For compound ingredients, use **Part of sauce/mix** and record recipe/product-label evidence. Select only confirmed allergens for each ingredient. Add reliable aliases where useful.
4. Record possible cross-contact separately. Save **Needs Review** when information is incomplete.
5. Choose **Verified** only after entering the actual complete recipe and checking the explicit staff confirmation. An empty list cannot be marked Verified.
6. Customers must review new risks after relevant recipe changes. Acknowledgment permits retaining a dish; it does not make that dish allergen-free. Follow up with the customer about unresolved preparation risks.

## Modified implementation

| File | Purpose |
| --- | --- |
| `src/components/AllergyFields.tsx` | Live matching, dish-specific evidence, summary links and explicit acknowledgment controls. |
| `src/components/DishRecipeEditor.tsx` | Existing Manager modal's ingredient/allergen editor and explicit review confirmation. |
| `src/pages/Admin.tsx` | Review queue/filter, badges, booking-frequency ordering and save feedback. |
| `src/pages/ReservationWizard.tsx` | Inline dish warning placement, stale acknowledgment removal and first-unacknowledged focus. |
| `src/components/BookingDetails.tsx` | Immutable submission snapshot and current-recipe staff follow-up. |
| `src/lib/allergy.ts` | Typed warning, ingredient and acknowledgment models/helpers. |
| `src/lib/booking-validation.ts` | Category/custom-only acknowledgment validation and unavailable-data blocking. |
| `src/lib/booking-draft.ts` | Bounded restoration of acknowledgment evidence fields. |
| `src/types.ts`, `src/booking.css` | Additive types and accessible responsive warning/editor layout. |
| `tests/database.test.ts`, `tests/allergy-ui.test.ts` | Database, authorization, validation and rendered-warning regressions. |
| `supabase/migrations/0034_ingredient_allergy_warnings.sql` | Authoritative ingredient/recipe/warning/snapshot rules. |
| `supabase/updates/0034_ingredient_allergy_warnings.sql` | Generated existing-project incremental transaction. |
| `supabase/setup.sql`, `supabase/functions/_shared/backup-schema.ts` | Regenerated installer and backup schema. |

## Database/security changes

Migration **0034_ingredient_allergy_warnings.sql** adds three tables: `recipe_ingredients`, `ingredient_allergens`, `dish_ingredients`; additive dish review fields; and reservation `allergy_warning_snapshot` / `allergy_acknowledged_at`. It does not seed speculative ingredients, drop historical records or rewrite financial amounts.

New tables enable RLS, revoke anonymous access and ordinary client writes, and allow authenticated catering reads under the existing access checks. `save_dish_recipe` and `recipe_review_queue` enforce staff authorization. Direct catalog insert privileges exclude review metadata, preventing a forged Verified state. Legacy tag editing remains authorized/audited and invalidates complete-recipe review rather than silently certifying ingredients.

`allergy_warnings` requires authenticated catering access and returns only computed results for supplied declarations/selections, never another customer's saved medical/allergy notes. Reservation/draft ownership RLS continues to protect saved declarations and snapshots. Finalization locks the reservation and selected dish rows, recomputes current tokens and rejects missing/forged/stale acknowledgments before submission commits.

The protected application archive now includes all **50 public application tables**, the recipe relationships and schema version 0034. Backup exports remain Super Admin-only through the existing secure function.

## Test evidence

- **198 automated tests passed in 16 files**, including **125 isolated PostgreSQL tests**. Zero remaining automated failures.
- TypeScript, ESLint, production build and the nine configured Edge Function checks passed. Existing bundler annotation/chunk-size warnings remain non-blocking.
- Database cases cover confirmed quail eggs, dairy, soy, peanut, fish/shellfish, sesame, tree nuts, wheat/gluten, multiple allergens, compound evidence, custom garlic/aliases, short-substring rejection, ambiguous notes, whitespace-only optional notes, cross-contact and incomplete recipes.
- Backend tests reject forged/missing/stale acknowledgments, recheck saved drafts after staff edits, capture authoritative snapshots, preserve earlier snapshots after later recipe edits, and deny customer recipe writes/review-queue access. Cross-customer reservation reads and anonymous recipe/warning access remain denied.
- Rendered UI tests verify the named dish/ingredient warning, initially unchecked control, checked explicit acknowledgment, distinct uncertainty/no-match wording, draft metadata preservation and custom-only/unavailable-query validation.
- Browser QA uses an isolated temporary customer and **unpublished inactive recipe fixtures**, with those fixtures injected into that test browser's catalog response only. No invented recipe was published to real visitors. Manager UI saves the fixture recipe with explicit confirmation; customer checks include blocked Continue/focus, mobile overflow, Back/Next, Save/Resume, simultaneous allergies, garlic/ambiguous notes, deselection and stale-recipe acknowledgment invalidation.
- Existing pricing, menu counters, payment/refund, discount, reservation and reporting regressions passed. No real charge, refund or reminder email was initiated for this allergy task.

## Business data still required

**0 of the 87 original dishes have verified structured recipes; all 87 require review (79 active, 8 archived).** Catering staff must enter actual recipes and product-label evidence, including relevant compound ingredients, before those dishes can be marked Verified. The implementation supports all dishes, but it cannot truthfully supply missing business recipe facts.

## Deployment and final QA

- Migration 0034 was applied to the linked Supabase project and the protected backup-export function redeployed. The authenticated archive includes 50 tables and an installer byte-for-byte identical to `supabase/setup.sql`.
- All ten browser acceptance checks passed on the production build: Manager editor/confirmation, unpublished fixture isolation, Egg evidence/blocked Continue/focus, desktop/mobile layout, Back/Save/Reload acknowledgment retention, simultaneous allergies, garlic/ambiguous text, deselection/no-allergy behavior, recipe revision invalidation and denied customer recipe writes.
- Visual QA widened dish warning rows across the menu grid; mobile renders the selected dish above its full-width warning instead of compressing warning text into a narrow food tile.
- Unpublished fixtures, their ingredient definitions and the temporary customer/drafts were cleaned; the audit trail was retained. The final comparison found **no changes to original rows across 11 protected tables**, including the original 87-dish catalog and existing financial/customer/draft records.
- Frontend release verification is appended after the GitHub/Vercel rollout.
