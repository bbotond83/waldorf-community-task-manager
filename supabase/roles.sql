-- Applied by the Supabase CLI while it initialises a fresh local database, before the data API
-- starts. The data API refuses to start when a schema named in `[api] schemas` (config.toml) does
-- not exist yet, so the four worker schemas for parallel test runs are created here, with the same
-- API-role rights that `public` has. Migrations are applied later by scripts/db/runner.ts.
-- Keep this list identical to `[api] schemas` (a unit test checks it).
do $$
declare s text;
begin
  foreach s in array array['worker_1', 'worker_2', 'worker_3', 'worker_4'] loop
    execute format('create schema if not exists %I', s);
    execute format('grant usage on schema %I to anon, authenticated, service_role', s);
    execute format('alter default privileges for role postgres in schema %I grant all on tables to anon, authenticated, service_role', s);
    execute format('alter default privileges for role postgres in schema %I grant all on sequences to anon, authenticated, service_role', s);
    execute format('alter default privileges for role postgres in schema %I grant execute on functions to anon, authenticated, service_role', s);
  end loop;
end $$;
