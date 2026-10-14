# Owner-confirmed catalog and pricing — October 15, 2026

The owner supplied a food-menu image, a suggested set-menu image and current business package text, then confirmed the current rates, guest limits and seating charges in this session. The current message's rates take precedence over the lower historical rates printed in the suggested-menu image.

| Menu | Required chosen dishes | PHP per guest | Guest range |
| --- | --- | --- | --- |
| Set Menu No. 1 | 3 | 320 | 100–1,000 |
| Set Menu No. 2 | 4 | 350 | 100–1,000 |
| Set Menu No. 3 | 5 | 380 | 100–1,000 |
| Set Menu No. 4 | 6 | 420 | 100–1,000 |

Customers can pick their own dishes or load the suggested dishes shown in the supplied set-menu image. Rice, one drink, one dessert, basic tables, Monoblock chairs and a simple buffet setup with flower vase or balloon centerpiece are included. The catalog contains 78 named food choices across six categories, including alternatives explicitly shown in the suggested-menu image; seven drinks and five desserts are available.

| Option | Pricing |
| --- | --- |
| Monoblock chairs | Included |
| Elegant chairs | Additional PHP 10 per guest; applies to all guests |
| Round or long tables | Included, no additional charge |
| Simple buffet setup | Included |
| Birthday setup | Additional PHP 15,000 per event |
| Wedding setup | Additional PHP 30,000 per event |
| Glass dance floor upgrade | Additional PHP 5,000; wedding setup required |
| Trusses | Additional PHP 45,000 per event |

Birthday setup includes stage backdrop, elegant chair and entrance. Wedding setup includes stage backdrop, elegant chair, entrance, presidential table, buffet setup and diamond dance floor. Guest-seating choice and the owner-confirmed per-head surcharge are displayed separately.

For 100 guests on the three-dish menu, basic seating and setup total PHP 32,000. Selecting elegant guest chairs produces PHP 33,000 before event upgrades. With elegant chairs, wedding setup and the glass-floor upgrade, the test quote is PHP 68,000. These are calculation examples, not real transactions.

Implementation: `src/data/rodels-menu.ts` contains the owner-supplied choices; `npm run db:catalog` generates migration `0015_rodels_catalog.sql` and regenerates the SQL bundles. Migration `0014_menu_pricing.sql` adds menu metadata, guest limits, seating calculations, setup prerequisites and policies allowing customers to read archived choices associated with their own bookings. New selections use pricing version 2; legacy menus retain version 1. The live updates archive the illustrative catalog without deleting bookings or repricing stored totals.

Validation: 53 tests passed, including real embedded PostgreSQL quotes, guest boundaries, wedding-only glass floor and legacy payment/refund behavior. Frontend build/lint and Edge Function checks passed. Real browser checks covered four menu cards, all food choices, suggested selections, mobile layout, per-head chair calculation, guest input boundaries and clearing a wedding-only feature when the setup changes. Live Groq answers were verified for the current menu prices/inclusions, elegant-chair surcharge and rejection of an over-limit guest-count estimate. An explicitly labeled temporary test draft was deleted after browser verification; no checkout or payment was made. Existing live reservation amounts/quotes/statuses matched their pre-update aggregate fingerprint.

The technical paper under `docs/final/` describes the earlier audited snapshot. Use this addendum and `docs/ui-chatbot-verification.md` for subsequent presentation revisions; do not describe the old illustrative package prices as current business rates.
