create table test.results (name text primary key);
create function test.assert_true(condition boolean, test_name text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAIL: %', test_name; end if;
  insert into test.results values (test_name);
end;
$$;
create function test.expect_error(statement text, expected_state text, test_name text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> expected_state then
      raise exception 'FAIL: % (expected %, received %: %)', test_name, expected_state, sqlstate, sqlerrm;
    end if;
    insert into test.results values (test_name);
    return;
  end;
  raise exception 'FAIL: % (expected error %)', test_name, expected_state;
end;
$$;
grant usage on schema test to authenticated, anon;
grant execute on all functions in schema test to authenticated, anon;
grant insert on test.results to authenticated, anon;
