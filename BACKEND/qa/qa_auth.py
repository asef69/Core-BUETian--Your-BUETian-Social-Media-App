"""Authentication, JWT, headers and exposure tests."""
import re, time, base64, json
from qa_base import *
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from django.urls import get_resolver
from django.urls.resolvers import URLResolver
from django.conf import settings

AREA = "auth"
print("== AUTH / JWT / EXPOSURE")

u1 = mkuser("alice")
u2 = mkuser("bob")

# --------------------------------------------------------------- 1. unauthenticated sweep
def walk(patterns, prefix=""):
    for p in patterns:
        if isinstance(p, URLResolver):
            yield from walk(p.url_patterns, prefix + str(p.pattern))
        else:
            yield prefix + str(p.pattern), p

names = {"media_type": "text", "department_name": "CSE", "blood_group": "A+", "notification_type": "like"}
PUBLIC_OK = ("api/users/register/", "api/users/login/", "api/users/token/refresh/", "api/users/logout/", "health/", "swagger/", "redoc/", "admin/")
unauth_leaks = []
anon_client = anon()
routes = []
for route, p in walk(get_resolver().url_patterns):
    url = "/" + re.sub(r"<(?:\w+:)?(\w+)>", lambda mm: names.get(mm.group(1), "1"), route)
    cls = getattr(p.callback, "cls", None)
    if not cls:
        continue
    methods = [mth.upper() for mth in cls.http_method_names if hasattr(cls, mth) and mth != "options"]
    routes.append((url, methods, cls.__name__, route))
for url, methods, cname, route in routes:
    if route.startswith(PUBLIC_OK):
        continue
    for mth in methods:
        r = getattr(anon_client, mth.lower())(url)
        if r.status_code not in (401, 403):
            unauth_leaks.append((mth, url, cname, r.status_code))
# marketplace has intentionally public GETs; report them as one grouped finding, others individually
public_market = [x for x in unauth_leaks if x[1].startswith("/api/marketplace/") and x[0] == "GET"]
other_leaks = [x for x in unauth_leaks if x not in public_market]
check(AREA, "every non-public endpoint rejects anonymous requests (401)", not other_leaks,
      f"{len(other_leaks)} endpoints answered anonymous requests: " + "; ".join(f"{m} {u}->{s}" for m, u, c, s in other_leaks[:12]), "high")
check(AREA, "marketplace GET endpoints are public (information)", not public_market,
      f"{len(public_market)} marketplace GET endpoints work without login: " + ", ".join(sorted({u.split('/')[3] for m,u,c,s in public_market})), "low",
      "Decide whether anonymous browsing is intended")

# --------------------------------------------------------------- 2. JWT attacks
SECRET = settings.SECRET_KEY
def mk_token(payload, key=SECRET, alg="HS256", headers=None):
    return pyjwt.encode(payload, key, algorithm=alg, headers=headers)
now = datetime.now(timezone.utc)
base = {"token_type": "access", "exp": int((now + timedelta(hours=1)).timestamp()), "iat": int(now.timestamp()), "jti": "x" * 8, "user_id": u1.id}

def status_with(tok, url="/api/users/profile/%d/" % u1.id):
    c = Client(token=tok)
    return c.get(url).status_code

check(AREA, "valid token accepted (sanity)", status_with(mk_token(base)) == 200, status_with(mk_token(base)), "high")
check(AREA, "token signed with wrong key rejected", status_with(mk_token(base, key="not-the-secret-key-xxxxxxxxxxxxxxxxxxxxxxx")) == 401, "", "critical")
check(AREA, "alg=none token rejected", status_with(base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode() + "." +
      base64.urlsafe_b64encode(json.dumps(base).encode()).rstrip(b"=").decode() + ".") == 401, "", "critical")
exp = dict(base, exp=int((now - timedelta(hours=1)).timestamp()))
check(AREA, "expired token rejected", status_with(mk_token(exp)) == 401, "", "high")
check(AREA, "refresh token cannot be used as access token", status_with(u1.refresh) == 401, status_with(u1.refresh), "high")
check(AREA, "access token cannot be used to refresh", anon().post("/api/users/token/refresh/", {"refresh": u1.token}).status_code == 401,
      anon().post("/api/users/token/refresh/", {"refresh": u1.token}).status_code, "high")
check(AREA, "token without user_id rejected", status_with(mk_token({k: v for k, v in base.items() if k != "user_id"})) == 401, "", "high")
check(AREA, "token for non-existent user rejected", status_with(mk_token(dict(base, user_id=99999999))) == 401, "", "high")
check(AREA, "token with string user_id handled (no 500)", status_with(mk_token(dict(base, user_id="1 OR 1=1"))) in (401, 403, 400), status_with(mk_token(dict(base, user_id="1 OR 1=1"))), "medium")
check(AREA, "garbage bearer value rejected", status_with("garbage") == 401, "", "medium")
check(AREA, "empty bearer rejected", Client(token="").get("/api/users/suggestions/").status_code == 401, "", "medium")
r = anon().api.get("/api/users/suggestions/", HTTP_AUTHORIZATION="Token abc")
check(AREA, "wrong auth scheme rejected", r.status_code == 401, r.status_code, "medium")
r = anon().api.get(f"/api/users/suggestions/?token={u1.token}&access={u1.token}")
check(AREA, "token in query string is NOT accepted for REST", r.status_code == 401, r.status_code, "medium")
# deactivated user's still-valid access token
u3 = mkuser("carol")
DM.execute_update("UPDATE users SET is_active=FALSE WHERE id=%s", (u3.id,))
check(AREA, "deactivated user's existing access token stops working", u3.get("/api/users/suggestions/").status_code == 401, u3.get("/api/users/suggestions/").status_code, "high")
DM.execute_update("DELETE FROM users WHERE id=%s", (u3.id,))
u4 = mkuser("dave")
DM.execute_update("DELETE FROM users WHERE id=%s", (u4.id,))
check(AREA, "deleted user's token stops working", u4.get("/api/users/suggestions/").status_code == 401, "", "high")

# --------------------------------------------------------------- 3. login behaviour
a = anon()
r_bad_user = a.post("/api/users/login/", {"email": "nobody@qa.test", "password": "whatever123"})
r_bad_pw = a.post("/api/users/login/", {"email": u1.email, "password": "wrongpassword1"})
check(AREA, "login does not reveal whether the email exists (same status+message)",
      r_bad_user.status_code == r_bad_pw.status_code and r_bad_user.data.get("error") == r_bad_pw.data.get("error"),
      f"{r_bad_user.status_code}/{r_bad_user.data} vs {r_bad_pw.status_code}/{r_bad_pw.data}", "low")
for payload in ({"email": ["a@b.c"], "password": "x"}, {"email": "a@b.c", "password": {"$ne": 1}}, {"email": None, "password": None}, "notjson", []):
    r = a.post("/api/users/login/", payload)
    check(AREA, f"login with odd payload {str(payload)[:40]} -> 4xx not 5xx", r.status_code < 500, r.status_code, "medium")
r = a.post("/api/users/login/", {"email": "' OR '1'='1", "password": "' OR '1'='1"})
check(AREA, "login SQL injection string rejected", r.status_code in (400, 401), r.status_code, "critical")
r = a.post("/api/users/login/", {"email": "a" * 100000 + "@x.com", "password": "p" * 100000})
check(AREA, "login with 100KB values handled quickly without 5xx", r.status_code < 500, r.status_code, "medium")
long_pw_register = a.post("/api/users/register/", {"student_id": 8800001, "name": "Long", "email": "longpw@qa.test", "password": "A1b2c3d4" * 5000})
check(AREA, "register with 40KB password rejected (hash DoS)", long_pw_register.status_code == 400, long_pw_register.status_code, "medium")

# register mass assignment
r = a.post("/api/users/register/", {"student_id": 8800002, "name": "Mass", "email": "mass@qa.test", "password": "Str0ngPass!word", "is_active": False,
                                      "id": 424242, "bio": "hi", "password_hash": "x", "is_staff": True})
row = DM.execute_query("select id,is_active from users where email='mass@qa.test'")
check(AREA, "register ignores id/is_active mass-assignment", bool(row) and row[0]["id"] != 424242 and row[0]["is_active"] is True, row, "high")
r = u1.patch("/api/users/profile/update/", {"email": "hijack@qa.test", "is_active": False, "student_id": 1, "password": "hacked12345", "id": 5, "name": "Alice Renamed"})
row = DM.execute_query("select email,is_active,student_id from users where id=%s", (u1.id,))[0]
check(AREA, "profile update ignores email/is_active/student_id/password", row["email"] == u1.email and row["is_active"] and row["student_id"] != 1,
      row, "critical")
check(AREA, "profile update still applies allowed fields", DM.execute_query("select name from users where id=%s", (u1.id,))[0]["name"] == "Alice Renamed", "", "medium")

# --------------------------------------------------------------- 4. headers / exposure
r = anon().api.get("/api/users/suggestions/")
hdr = lambda r, k: r[k] if hasattr(r, "has_header") and r.has_header(k) else None
check(AREA, "X-Content-Type-Options: nosniff", hdr(r, "X-Content-Type-Options") == "nosniff", hdr(r, "X-Content-Type-Options"), "low")
check(AREA, "X-Frame-Options present", hdr(r, "X-Frame-Options") is not None, hdr(r, "X-Frame-Options"), "low")
check(AREA, "Referrer-Policy present", hdr(r, "Referrer-Policy") is not None, hdr(r, "Referrer-Policy"), "low")
check(AREA, "Strict-Transport-Security configured for production", getattr(settings, "SECURE_HSTS_SECONDS", 0) > 0, getattr(settings, "SECURE_HSTS_SECONDS", 0), "medium",
      "Set SECURE_HSTS_SECONDS (e.g. 31536000) in production")
check(AREA, "SECURE_SSL_REDIRECT / secure cookies in production", getattr(settings, "SESSION_COOKIE_SECURE", False) and getattr(settings, "CSRF_COOKIE_SECURE", False), "", "low")
r = anon().api.get("/swagger/")
check(AREA, "Swagger UI not publicly readable in production", r.status_code in (401, 403, 404), r.status_code, "medium")
r = anon().api.get("/redoc/")
check(AREA, "ReDoc not publicly readable in production", r.status_code in (401, 403, 404), r.status_code, "medium")
r = anon().api.get("/swagger/?format=openapi")
check(AREA, "OpenAPI JSON not publicly readable in production", r.status_code in (401, 403, 404), r.status_code, "medium")
r = anon().api.get("/admin/login/")
check(AREA, "Django admin login page reachable (information)", r.status_code in (404,), r.status_code, "low", "Admin is exposed at /admin/ although no models are registered")
r = anon().api.get("/does/not/exist/")
check(AREA, "unknown URL returns clean 404 (no debug page)", r.status_code == 404 and b"Traceback" not in getattr(r, "content", b"") and b"DEBUG" not in getattr(r, "content", b""), r.status_code, "medium")
r = anon().api.get("/api/users/profile/abc/")
check(AREA, "non-integer id in path returns 404 not 500", r.status_code in (401, 404), r.status_code, "low")
r = u1.get("/api/users/profile/99999999999999999999/")
check(AREA, "integer overflow in path id handled (no 500)", r.status_code < 500, r.status_code, "medium")
r = u1.get("/api/users/profile/2147483648/")
check(AREA, "id just above int32 handled (no 500)", r.status_code < 500, r.status_code, "medium")
r = u1.get("/api/posts/-1/")
check(AREA, "negative id handled", r.status_code in (404, 400), r.status_code, "low")

# CORS
r = anon().api.options("/api/users/login/", HTTP_ORIGIN="https://evil.example", HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST")
acao = hdr(r, "Access-Control-Allow-Origin"); acac = hdr(r, "Access-Control-Allow-Credentials")
check(AREA, "CORS does not allow credentialed requests from arbitrary origins", not (acao in ("*", "https://evil.example") and acac == "true"),
      f"ACAO={acao} ACAC={acac}", "medium", "Set CORS_ALLOWED_ORIGINS in production")
check(AREA, "CORS does not reflect arbitrary origins", acao not in ("*", "https://evil.example"), f"ACAO={acao}", "medium", "Set CORS_ALLOWED_ORIGINS in production")

# HTTP method handling
for m in ("put", "delete", "patch"):
    r = getattr(u1, m)("/api/users/suggestions/")
    check(AREA, f"{m.upper()} on a GET-only endpoint -> 405", r.status_code == 405, r.status_code, "low")
r = u1.api.post("/api/posts/create/", data="not multipart at all", content_type="multipart/form-data; boundary=xx")
check(AREA, "malformed multipart handled (no 5xx)", r.status_code < 500, r.status_code, "medium")
r = u1.api.post("/api/posts/create/", data=b"{bad json", content_type="application/json")
check(AREA, "malformed JSON body -> 400", r.status_code == 400, r.status_code, "medium")
r = u1.api.post("/api/posts/create/", data=b"x=1", content_type="text/plain")
check(AREA, "unsupported content-type -> 415", r.status_code == 415, r.status_code, "low")
big = u1.api.post("/api/posts/create/", data=json.dumps({"content": "x" * 3_000_000}), content_type="application/json")
check(AREA, "3MB JSON body rejected or handled (no 5xx)", big.status_code < 500, big.status_code, "medium")

# token refresh
r = anon().post("/api/users/token/refresh/", {"refresh": u1.refresh})
check(AREA, "refresh works (sanity)", r.status_code == 200 and "access" in r.data, r.status_code, "high")
check(AREA, "refresh token rotation/blacklist absent (information)", False if r.status_code == 200 and not r.data.get("refresh") else True,
      "Refresh tokens are valid for 7 days, are not rotated and cannot be revoked (no logout endpoint)", "medium",
      "Enable rotation + blacklist, add logout")
r = anon().post("/api/users/token/refresh/", {})
check(AREA, "refresh without token -> 400", r.status_code == 400, r.status_code, "low")
r = anon().post("/api/users/token/refresh/", {"refresh": {"a": 1}})
check(AREA, "refresh with object value -> 4xx", r.status_code < 500, r.status_code, "medium")

save_results()
