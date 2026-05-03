# Migration squash runbook

> 15 numbered migrations consolidated into 4. Cuts the noise from the
> debugging fixups in 0003→0008, drops the dead
> `private.lookup_email_by_username` from 0009, and removes the temporary
> dev-visibility relaxation (0005 + its 0010 reverse).

## What's in here

| File | Replaces | Purpose |
|---|---|---|
| `0001_init.sql` | 0001, 0003, 0004, 0006, 0007, 0008, 0009, 0011, 0012, 0014 | Schema, types, tables, indexes, triggers, grants, auth helpers (in `private`), signup trigger, foro bump trigger |
| `0002_rls.sql` | 0002, 0005, 0010, parts of 0006 | All RLS policies (final state, no dev-visibility detour) |
| `0003_storage.sql` | 0013 | uploads bucket + storage RLS |
| `0004_realtime.sql` | 0015 | Realtime publication on chat + foro tables |

Original migrations stay in `supabase/migrations/` until the cutover —
nothing is deleted until you say so.

## Cutover (run when you're fresh, not at 1am)

The remote DB already has the post-migration schema. The squash files
declare the same final state. We're just rewriting the migration history
so future fresh deploys converge to the same place.

### 1. Verify the squash matches reality

Dump the current schema and diff against the staging files. If anything
differs, the squash is wrong — fix it before swapping.

```bash
cd espectro-fm-web
npx supabase db dump --schema public,private,storage > /tmp/current-schema.sql
# Manual diff/inspection. Pay attention to:
#   - column order and defaults
#   - policy names and definitions
#   - function bodies (especially handle_new_auth_user)
#   - index definitions including WHERE clauses
```

### 2. Mark old migrations as reverted

For each existing migration version, mark it as no-longer-applied in
`supabase_migrations.schema_migrations` *without* actually rolling it
back (the schema stays intact):

```bash
for v in 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015; do
  npx supabase migration repair --status reverted "$v"
done
```

### 3. Swap the files in

```bash
mkdir -p supabase/migrations.bak
mv supabase/migrations/000* supabase/migrations.bak/  # safety net
mv supabase/squash-staging/* supabase/migrations/
rmdir supabase/squash-staging
```

### 4. Mark the new migrations as applied

The schema is already in place — we don't want `db push` to actually run
these. Mark each as applied:

```bash
for v in 0001 0002 0003 0004; do
  npx supabase migration repair --status applied "$v"
done
```

### 5. Verify

```bash
# Should show only 0001-0004 applied.
npx supabase migration list

# Should be no diff between local + remote.
npx supabase db diff
```

### 6. Regenerate types (no-op, but confirms cleanliness)

```bash
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

### 7. Commit

```bash
git add supabase/migrations/
git rm -r supabase/migrations.bak/  # delete the safety net
git commit -m "chore(db): squash 0001-0015 into 4 clean migrations"
```

## What to do if it goes wrong

The remote schema is unchanged throughout. If migration history drifts
(e.g. a `repair` runs the wrong way), you can always restore the original
migration files from `supabase/migrations.bak/` and rerun `repair --status
applied` for each. The DB itself doesn't move.

The only way to corrupt data here is to actually run a destructive SQL
command — none of the steps above do that. `db dump` is read-only;
`migration repair` only edits the history table.

## What's intentionally dropped

- `private.lookup_email_by_username` from 0009 — dead code (the route
  handler at `app/api/auth/login/route.ts` uses `auth.admin.getUserById`
  via the service-role key instead)
- The bootstrap `BOOT-*` admin invite-code seed insert from 0009 — already
  used. New admin invites are generated through `/admin`.
- `notify pgrst, 'reload schema'` from 0008 — one-shot for the function
  rename, no longer applicable
- The `seed=true` visibility relaxation from 0005 — already reverted by
  0010; the squash starts at the final restricted state
- The 0003 EXECUTE revoke + 0006/0007 dance — collapsed into "helpers
  live in private from the start"
