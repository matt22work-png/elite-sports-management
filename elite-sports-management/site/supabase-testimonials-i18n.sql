-- ============================================================================
-- ESM — Testimonials: translatable quote/role held as {en,es,it} JSON
-- migration: testimonials_trilingual_jsonb   (applied 2026-09-18)
-- ============================================================================
-- The homepage has always read these two fields through loc():
--
--   const loc = v => (v && typeof v === "object")
--     ? (v[lang] || v.en || Object.values(v)[0] || "")
--     : (v || "");
--
-- ...which accepts EITHER a plain string OR an {en,es,it} object. The embedded
-- TESTIMONIALS array in index.html already used the object form, so the embedded
-- quotes translated. The three CMS rows in this table did not: they were single
-- `text` columns, so every language rendered the same English string.
--
-- Holding them as jsonb is what makes supabase-js hand the browser a real object
-- instead of a JSON-looking string, which is what lets loc() pick a language.
--
-- NO NEW COLUMNS (per Matt's choice): quote and role change type in place and are
-- seeded with the existing English text under the "en" key. es/it are filled in
-- later from the admin panel, which now edits all three languages per field.
--
-- `name` is deliberately left as text — it's a proper noun and does not translate.
--
-- Backwards compatible in BOTH directions. jsonb also holds a bare JSON string,
-- supabase-js deserialises that to a JS string, and loc() returns strings
-- untouched — so a row written the old way still renders correctly rather than
-- showing raw JSON to a visitor.
-- ============================================================================

alter table public.testimonials
  alter column quote type jsonb using
    case when quote is null then null else jsonb_build_object('en', quote) end,
  alter column role type jsonb using
    case when role is null then null else jsonb_build_object('en', role) end;

comment on column public.testimonials.quote is
  'Translatable. {"en":"…","es":"…","it":"…"} — read through loc() on the homepage. A bare JSON string is still accepted and renders as-is in every language.';
comment on column public.testimonials.role is
  'Translatable. {"en":"…","es":"…","it":"…"} — read through loc(). name is deliberately NOT translatable (proper noun).';

-- Verify after applying (all three rows should report "object"):
--   select id, jsonb_typeof(quote), jsonb_typeof(role) from public.testimonials;

-- ----------------------------------------------------------------------------
-- ROLLBACK (collapses back to the English string; any es/it text is LOST):
--   alter table public.testimonials
--     alter column quote type text using coalesce(quote->>'en', quote #>> '{}'),
--     alter column role  type text using coalesce(role->>'en',  role  #>> '{}');
-- ----------------------------------------------------------------------------
