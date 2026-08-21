-- ============================================================================
-- 0046_mapa_partner_attribution.sql — enrich Club Japan attribution for /mapa
-- ============================================================================
-- The Spatial Identity Canvas prototype (/mapa) builds partner focus clusters
-- from EXPLICIT items.partner_id attribution only. Prod currently attributes
-- 3 RA events to Club Japan (pa-club-japan-ppur); these stamps attach the
-- Club Japan-related SEED rows that exist in prod so the real focus cluster
-- demonstrates the reflow with more than a sliver of content.
--
-- Two attribution flavors, same mechanism (see wiki/70-Roadmap/Spatial
-- Identity Canvas.md § focus eligibility):
--   · publisher attribution — the venue's own nights (precedence 1/4)
--   · editorial attachment  — a piece explicitly ABOUT the partner,
--     attached by an editor (precedence 5)
--
-- Idempotent: only touches rows that exist, are seed content, and are not
-- yet attributed. APPLY VIA THE SQL EDITOR — never `supabase db push`
-- (migration-history drift; see `migration-history-drift` memory).
-- ============================================================================

-- Publisher attribution — Club Japan's own event nights (seed rows).
update items
set partner_id = 'pa-club-japan-ppur'
where id in (
  'ev-japan-industrial',
  'ev-japan-rat-pack',
  'ev-japan-hardtechno-may'
)
  and seed = true
  and partner_id is null
  and exists (select 1 from items p where p.id = 'pa-club-japan-ppur');

-- Editorial attachment — explicitly about Club Japan (seed row).
-- ar-002 "El sound system mexicano: un linaje oculto" names the venue as the
-- system most oriented to that lineage.
update items
set partner_id = 'pa-club-japan-ppur'
where id = 'ar-002'
  and seed = true
  and partner_id is null
  and exists (select 1 from items p where p.id = 'pa-club-japan-ppur');
