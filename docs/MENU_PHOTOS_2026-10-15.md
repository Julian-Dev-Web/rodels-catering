# Menu photographs — October 15, 2026

The owner-approved food library has local representative photographs for all 78 dishes, seven drinks and five desserts. These are reusable Wikimedia Commons references, not actual Rodel’s serving photographs. Uncommon variants sometimes share a related-food reference; the registry and public credits explicitly identify those cases. Current active catalog rows are matched by normalized name, so the existing duplicate legacy `Beef caldereta` row also receives the reference photo without changing that catalog record.

## Customer and public views

- `/packages` and `/customer/packages`: photo menu browser with dish/drink/dessert tabs, search, dish category filter, and incremental “Show more” loading.
- Reservation menu step: dish checkbox cards preserve the selected package’s exact dish-count rule. Drink and dessert photo cards are radio groups, one included selection each. Existing draft persistence also retains these selections after Back/reload.
- `/food-photo-credits`: author, Commons source, individual license and related-food notes for every mapped item, plus supplied custom-image credits. The footer and menu link to this page.
- Photos use local size-limited thumbnails, lazy loading and responsive cards. An unavailable custom image falls back to the known item’s representative photo. New/unknown items without supplied photos show an honest placeholder until an operator adds one.

## Replacing photos

Super Admin → **Menu photos** → Dishes / Drinks / Desserts → **Photo**. Upload a permitted JPG, PNG or WebP up to 10 MB, or use a public HTTPS image URL. Add photographer/owner credit and an optional HTTPS source link, then Save. Preview the selected upload before saving. “Use representative photo instead” clears the custom URL/upload and metadata when saved.

The dedicated Super Admin page manages photographs only. Manager → Menu library also offers authorized image URL/credit editing; direct Storage uploads retain the existing Super Admin-only gallery-bucket rule. Uploaded menu files live under `gallery/menu/`; saving a food image does **not** create a `gallery_images` row or change landing event slides. Replaced files are retained for recovery; an operator can later review unused Storage files.

## Schema and implementation

- `0021_catalog_food_images.sql` adds optional `image_url`, `image_credit` and `image_source_url` columns to dishes, drinks and desserts. Existing staff RLS and catalog auditing apply. URL/credit constraints reject unsafe schemes, local traversal and oversize metadata.
- No catalog IDs, prices, dish counts, booking selections or historical financial fields are backfilled or repriced.
- The hosted incremental 0021 update and matching `export-application-data` function were applied. The application archive remains 38 public tables and now identifies schema 0021. Auth credentials and actual Storage bytes still require separate recovery.
- `src/data/menu-photo-manifest.json` is the item/author/source/license registry. `public/images/menu/ATTRIBUTION.md` ships attribution alongside the 84 distinct image files used by the 90 mappings. Individual image licenses, including share-alike terms where applicable, remain in force.
- Shared components: `FoodPhoto`, `FoodMenu`, `CatalogPhotoEditor`; route: `FoodPhotoCredits`; lookup/URL checks: `src/lib/menu-photos.ts`.

## Verification

Lint, TypeScript/production build, all seven Edge checks, and 104 automated tests passed. Tests execute the real fresh-project SQL installer in isolated PostgreSQL and cover photo-write authorization, unsafe metadata rejection, archive version access, complete known-item image coverage, image signatures and attribution. Browser acceptance and final deployment results are recorded below after verification. Never use a passing unit test as evidence of an actual business photograph or a real paid transaction.

Existing provider/payment/refund, legal-review, Wedding component-price and full disaster-recovery acceptance gaps are unaffected. The technical documentation PDF/DOCX remains its earlier evidence snapshot; use this handoff for the current photo feature when updating slides or documentation.

Local browser acceptance passed ten checks using the local frontend with the hosted backend: coverage of all active catalog rows; actual Super Admin export with matching schema 0021/38-table scope; menu search/category/pagination; loading drink/dessert images; mobile fit; complete source/license links; booking single-choice/dish-count guards and Back retention; safe image metadata and upload-reset behavior; isolated upload/save requests affecting only photo fields and no event-gallery rows; and successful requests for all 84 local image assets. Admin writes/uploads and a synthetic draft were intercepted in Chrome, so genuine catalog and booking rows were not changed for these tests. Photo contact sheets and public desktop/mobile screens were visually inspected. The known main-bundle size and pre-existing legal-page mixed-import advisories remain build advisories.

Photograph reuse reference consulted: [Wikimedia Commons — Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia), accessed October 15, 2026. Each image’s author/source/license comes from its own Commons file metadata, preserved in the shipped attribution registry.
