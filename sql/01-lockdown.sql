-- RUN THIS ONLY AT CUTOVER, when the new app is live and the old app is retired.
-- It makes every table and function private to the server. The browser's public key can no longer read or write anything,
-- so password hashes, session tokens and payment fields can no longer be downloaded by strangers.
-- (Your server uses the service key, which ignores these rules.)

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

