-- Compare application catalog definitions, not database-specific OIDs or user data.
select jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'rls', c.relrowsecurity,
      'acl', c.relacl::text,
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'acl', a.attacl::text
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      )
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind = 'r'
  ),
  'constraints', (
    select jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', k.conname, 'definition', pg_get_constraintdef(k.oid)
    ) order by c.relname, k.conname)
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private')
  ),
  'indexes', (
    select jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', indexname, 'definition', indexdef
    ) order by schemaname, tablename, indexname) from pg_indexes where schemaname in ('public', 'private')
  ),
  'policies', (
    select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname)
    from pg_policies p where schemaname in ('public', 'private')
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'definition', pg_get_functiondef(p.oid), 'acl', p.proacl::text
    ) order by n.nspname, p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f'
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object(
      'table', c.relname, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid)
    ) order by c.relname, t.tgname)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private', 'auth') and not t.tgisinternal
  )
);
