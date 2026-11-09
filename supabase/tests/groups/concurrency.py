"""Local-only, two-connection regression checks for group serialization."""
import os
from pathlib import Path
import re
import subprocess
import sys
import time

psql, port, database = sys.argv[1:]
if not re.fullmatch(r"northstar_groups_[0-9a-f]{32}_(fresh|reset)", database):
    raise SystemExit("Refusing concurrency fixtures outside a disposable group-test database.")
base = [psql, "-X", "-w", "-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", database,
        "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]


def query(sql, *, expected=0, variables=(), app="northstar_probe"):
    command = base + [arg for value in variables for arg in ("-v", value)]
    result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=15,
                            env={**os.environ, "PGAPPNAME": app})
    if result.returncode != expected:
        raise AssertionError(result.stderr)
    return result


expected_dir = Path(__file__).resolve().parents[3] / ".tmp" / "phase2-postgres"
actual_dir = query("show data_directory;").stdout.strip()
if Path(actual_dir).resolve() != expected_dir.resolve():
    raise SystemExit("Refusing a server outside the dedicated workspace cluster.")

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
G = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0"
T = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
I = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3"


def session(user):
    return f"begin; set local role authenticated; select set_config('request.jwt.claim.sub','{user}',true);\n"


query(session(A) + f"""
select public.create_group('Concurrency','{G}');
select public.save_task('{G}','{T}','{{"title":"Original"}}');
select public.send_group_invitation('{G}','{B}','{I}');
select set_config('request.jwt.claim.sub','{B}',true);
select public.respond_group_invitation('{I}',true);
select public.save_task('{G}','{T}','{{}}',array['{B}']::uuid[],null,
  (select updated_at from public.tasks where id='{T}'));
commit;
""")


def race(first_sql, second_sql, *, second_code=0, error_state=None, variables=(), name):
    command = base + [arg for value in variables for arg in ("-v", value)]
    first = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             text=True, env={**os.environ, "PGAPPNAME": name})
    try:
        first.stdin.write(first_sql + "select pg_sleep(0.8); commit;\n")
        first.stdin.close()
        first.stdin = None
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            ready = query(f"select count(*) from pg_stat_activity where application_name='{name}' and wait_event='PgSleep';")
            if ready.stdout.strip() == "1":
                break
            if first.poll() is not None:
                raise AssertionError(first.communicate()[1])
            time.sleep(0.02)
        else:
            raise AssertionError("First transaction never reached the locked checkpoint.")
        second = query(second_sql + "commit;\n", expected=second_code, variables=variables)
        stdout, stderr = first.communicate(timeout=10)
        assert first.returncode == 0, stderr
        if error_state:
            assert error_state in second.stderr, second.stderr
    finally:
        if first.poll() is None:
            first.kill()
            first.communicate()


token = query(f"select updated_at::text from public.tasks where id='{T}';").stdout.strip()
race(session(A) + f"select public.save_task('{G}','{T}','{{\"status\":\"in_progress\"}}',null,null,:'token');\n",
     session(B) + f"select public.save_task('{G}','{T}','{{\"status\":\"done\"}}',null,null,:'token');\n",
     second_code=3, error_state="PT409", variables=(f"token={token}",), name="northstar_conflict")
assert query(f"select status from public.tasks where id='{T}';").stdout.strip() == "in_progress"
assert query(f"select count(*) from public.task_activity where task_id='{T}' and event_type='status_changed';").stdout.strip() == "1"

token = query(f"select updated_at::text from public.tasks where id='{T}';").stdout.strip()
race(session(A) + f"select public.remove_group_member('{G}','{B}');\n",
     session(B) + f"select public.save_task('{G}','{T}','{{\"title\":\"Removed writer\"}}',null,null,:'token');\n",
     second_code=3, error_state="42501", variables=(f"token={token}",), name="northstar_removal")
assert query(f"select title from public.tasks where id='{T}';").stdout.strip() == "Original"
assert query(f"select count(*) from public.task_assignments where group_id='{G}' and assignee_user_id='{B}';").stdout.strip() == "0"

new_invitation = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4"
query(session(A) + f"select public.send_group_invitation('{G}','{B}','{new_invitation}'); commit;")
race(session(A) + f"select public.revoke_group_invitation('{new_invitation}');\n",
     session(B) + f"select public.respond_group_invitation('{new_invitation}',true);\n",
     name="northstar_revoke")
assert query(f"select status from public.group_invitations where id='{new_invitation}';").stdout.strip() == "revoked"
assert query(f"select is_active from public.group_members where group_id='{G}' and user_id='{B}';").stdout.strip() == "f"
print("3 two-connection concurrency checks passed.")
