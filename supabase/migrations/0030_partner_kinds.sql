-- 0030_partner_kinds.sql
-- Extend the partner_kind enum with the scene's real partner categories.
-- Until now content was shoehorned into promo/promoter; the partner registry
-- seed (0031) needs these. New values render through the PARTNER_LABEL /
-- KIND_SLOT maps in the partner UI (PartnersRail, PartnerOverlay, admin).
--
-- 'promotora' is intentionally NOT added — it maps to the existing 'promoter'
-- (the Spanish display label lives in the UI, not the enum).
--
-- These live in their own migration ON PURPOSE: Postgres forbids using a
-- freshly added enum value in the same transaction that adds it, so the values
-- must commit here before 0031 references them.

alter type partner_kind add value if not exists 'colectivo';
alter type partner_kind add value if not exists 'festival';
alter type partner_kind add value if not exists 'club';
alter type partner_kind add value if not exists 'medios';
alter type partner_kind add value if not exists 'mix-series';
