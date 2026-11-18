"""Shared QA harness: throwaway PostgreSQL + the real Django app + result recording."""
import os, sys, re, json, pathlib, traceback, shutil

HERE = pathlib.Path(__file__).resolve().parent
SP = HERE
BACKEND = pathlib.Path(os.environ.get("QA_BACKEND") or HERE.parent)
RESULTS = HERE / "results.json"

sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

import pgserver, psycopg2

PGDATA = HERE / ".pgdata"   # throw-away PostgreSQL cluster (git-ignored); delete it for a clean run
fresh = not PGDATA.exists()
srv = pgserver.get_server(PGDATA, cleanup_mode="stop")
URI = srv.get_uri()
if fresh:
    conn = psycopg2.connect(URI); conn.autocommit = False
    cur = conn.cursor()
    for f in ["DB_SCHEMA.sql", "functions/functions.sql", "functions/post_functions.sql", "functions/group_functions.sql",
              "functions/marketplace_functions.sql", "functions/forum_functions.sql", "procedures/procedures.sql",
              "triggers/triggers.sql", "views/views.sql", "indexes.sql"]:
        cur.execute((BACKEND / "sql" / f).read_text(encoding="utf-8-sig"))
    conn.commit(); conn.close()

m = re.match(r"postgresql://(\w+):?(.*)@([\d.]+):(\d+)/(\w+)", URI)
os.environ.update(DB_USER=m.group(1), DB_PASSWORD="x", DB_HOST=m.group(3), DB_PORT=m.group(4), DB_NAME=m.group(5),
                  DB_SSLMODE="disable", DEBUG="False", SECRET_KEY="qa-secret-key-qa-secret-key-qa-secret-key-1234567890",
                  AUTH_THROTTLE_RATE="100000/min", DJANGO_SETTINGS_MODULE="core_buetians.settings")
# Production rate limits (what the app ships with) and a "no limit" set used by the functional tests.
PROD_RATES = {"auth": "20/min", "posts": "30/min", "comments": "60/min", "likes": "120/min", "follow": "60/min", "chat": "120/min",
              "contact": "10/min", "uploads": "30/min", "groups": "20/min", "market": "30/min", "reviews": "20/min", "forums": "20/min",
              "blogs": "20/min", "profile": "30/min"}
for _scope in PROD_RATES:
    os.environ["AUTH_THROTTLE_RATE" if _scope == "auth" else f"THROTTLE_{_scope.upper()}"] = "100000/min"

import django
django.setup()
from django.conf import settings
settings.ALLOWED_HOSTS = ["*"]
# embedded test Postgres has no tz database
from django.db.backends.postgresql.base import DatabaseWrapper
DatabaseWrapper.ensure_timezone = lambda self: False
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle
from django.core.cache import cache
from utils.database import DatabaseManager as DM

NO_LIMITS = {k: "100000/min" for k in PROD_RATES}


def set_rates(rates):
    """Switch the rate limits used by the throttles (and reset their counters)."""
    ScopedRateThrottle.THROTTLE_RATES = dict(rates)
    cache.clear()

FAILS = []
PASSES = []
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def check(area, name, cond, detail="", sev="medium", expect=""):
    rec = {"area": area, "name": name, "detail": str(detail)[:400], "sev": sev, "expect": expect}
    if cond:
        PASSES.append(rec)
    else:
        FAILS.append(rec)
        print(f"  FAIL [{sev}] {area}: {name} :: {str(detail)[:200]}")
    return cond


class Client:
    """Authenticated API client using real JWTs issued by the login endpoint."""
    def __init__(self, name=None, email=None, token=None, uid=None):
        self.api = APIClient(raise_request_exception=True)
        self.name, self.email, self.id, self.token = name, email, uid, token
        if token:
            self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _do(self, method, url, data=None, fmt="json", **kw):
        try:
            fn = getattr(self.api, method)
            if method == "get":
                r = fn(url, data or {}, **kw)
            else:
                r = fn(url, data if data is not None else {}, format=fmt, **kw)
            return r
        except Exception as e:
            tb = traceback.extract_tb(e.__traceback__)
            last = [t for t in tb if "BACKEND" in t.filename and "site-packages" not in t.filename]
            where = (last[-1].filename.split("BACKEND")[-1] + ":" + str(last[-1].lineno)) if last else ""

            class Crash:
                status_code = 599
                data = {"crash": f"{type(e).__name__}: {str(e)[:150]} @ {where}"}
                content = b""
                headers = {}
                def __getitem__(self, k): return None
                def has_header(self, k): return False
            return Crash()

    def get(self, url, data=None, **kw): return self._do("get", url, data, **kw)
    def post(self, url, data=None, fmt="json", **kw): return self._do("post", url, data, fmt, **kw)
    def put(self, url, data=None, fmt="json", **kw): return self._do("put", url, data, fmt, **kw)
    def patch(self, url, data=None, fmt="json", **kw): return self._do("patch", url, data, fmt, **kw)
    def delete(self, url, data=None, fmt="json", **kw): return self._do("delete", url, data, fmt, **kw)
    def options(self, url, **kw): return self._do("options", url, None, "json", **kw)


import random
_counter = [random.randint(1, 900) * 1000]


def anon():
    return Client()


def mkuser(prefix="user", **extra):
    _counter[0] += 1
    n = _counter[0]
    email = f"{prefix}{n}@qa.test"
    body = {"student_id": 7000000 + n, "name": f"{prefix.title()} {n}", "email": email, "password": "Str0ngPass!word",
            "batch": 20, "department_name": "CSE", "blood_group": "A+"}
    body.update(extra)
    a = anon()
    r = a.post("/api/users/register/", body)
    uid = r.data.get("user", {}).get("id") if hasattr(r, "data") and isinstance(r.data, dict) else None
    r2 = a.post("/api/users/login/", {"email": email, "password": body["password"]})
    tok = r2.data.get("tokens", {}).get("access") if isinstance(r2.data, dict) else None
    c = Client(body["name"], email, tok, uid)
    c.refresh = r2.data.get("tokens", {}).get("refresh") if isinstance(r2.data, dict) else None
    c.body = body
    return c


def befriend(a, b):
    """Make a and b mutual accepted followers (direct DB, for test setup)."""
    DM.execute_update("DELETE FROM follows WHERE (follower_id,following_id) IN ((%s,%s),(%s,%s))", (a.id, b.id, b.id, a.id))
    DM.execute_update("INSERT INTO follows(follower_id,following_id,status) VALUES (%s,%s,'accepted'),(%s,%s,'accepted')", (a.id, b.id, b.id, a.id))


def save_results(extra=None):
    out = {"fails": FAILS, "passes": len(PASSES), "extra": extra or {}}
    prev = {}
    if RESULTS.exists():
        try:
            prev = json.loads(RESULTS.read_text())
        except Exception:
            prev = {}
    allf = prev.get("fails", []) + FAILS
    allp = prev.get("passes", 0) + len(PASSES)
    RESULTS.write_text(json.dumps({"fails": allf, "passes": allp}, indent=1))
    print(f"\n[{len(FAILS)} failed, {len(PASSES)} passed in this module; totals {len(allf)} failed / {allp} passed]")
