# System administration and gallery update — October 15, 2026

The super-admin landing route now uses a dedicated system overview: registered profiles by role, active menus, published/featured photos, maintenance state and recent audit activity. The manager landing route retains reservation and revenue operations. Super admins retain access to the manager workspace for oversight. No unverified historical defense comments or former administrator responsibilities are asserted.

## Backup scope

The `export-application-data` Edge Function verifies the Supabase Auth identity and current `super_admin` role before calling a service-role-only snapshot function. It exports 34 allowlisted public application tables, refuses oversized datasets rather than truncating them, provides a SHA-256 checksum and records generation metadata in the immutable audit log. It excludes Auth login accounts/credentials, Storage object contents, schema/roles and server secrets. A browser download is an application-data archive, not a self-contained PostgreSQL backup or evidence of a completed off-site backup. Restore requires matching migrations and operator review. There is no automatic restore or scheduled backup implementation in this release.

Full database recovery remains an operator task in Supabase. Verify plan coverage and backup availability, maintain an off-site database backup and a separate copy of Storage objects, and test recovery in an isolated project. The app links to the actual project's backup dashboard and [Supabase's official backup documentation](https://supabase.com/docs/guides/platform/backups), consulted October 15, 2026. Managed daily backups depend on plan; the vendor recommends regular CLI exports for free-tier projects. Database backups do not contain Storage file contents.

## Photo provenance and captions

| Asset | Source / inspection | Publication description |
|---|---|---|
| `public/images/facebook-showcase.jpg` | One 960 × 466 public image visible from the user-provided [Rodel’s Catering Facebook page](https://www.facebook.com/profile.php?id=100069001067978), accessed October 15, 2026 without signing in | Outdoor evening celebration; tables, buffet and lighting are visible. No client name, exact occasion or event date is asserted. |
| `public/images/celebration.jpg` | Existing project asset, visually inspected | Floral birthday setup; birthday signage is visible. |
| `public/images/table.jpg` | Existing project asset, visually inspected; original watermark preserved | Green and ivory event setup; exact event type is not verified. |
| `public/images/food.jpg` | Existing project asset, visually inspected | School recognition ceremony styling; school-event signage is visible. The old corporate caption was corrected. |

Facebook required sign-in for the larger photo collection. No private photo access was attempted. The gallery supports occasion filters, original-photo viewing, featured landing-page showcases and super-admin batch uploads with source links/descriptions. Managers cannot publish or edit gallery records. The four set-menu cards use original SVG food illustrations, explicitly labeled as illustrations, representing the verified 3/4/5/6 dish counts; they are not photographs of actual served menu sets.
