"""Fuzz every endpoint with hostile values: SQL injection, type confusion, oversize, unicode."""
import re, json, time
from qa_base import *
from django.urls import get_resolver
from django.urls.resolvers import URLResolver

AREA = "fuzz"
print("== FUZZ / INJECTION")
A = mkuser("fz_owner"); B = mkuser("fz_other"); Cf = mkuser("fz_follower")

# ---------- fixtures with real ids
ids = {}
ids["post"] = A.post("/api/posts/create/", {"content": "fuzz post #fuzz"}).data["post_id"]
ids["comment"] = B.post(f"/api/posts/{ids['post']}/comments/", {"content": "c"}).data["comment_id"]
ids["group"] = A.post("/api/groups/create/", {"name": "FzGroup", "is_private": "false"}, fmt="multipart").data["group_id"]
ids["product"] = A.post("/api/marketplace/products/create/", {"title": "Fz", "price": "5", "condition": "good"}).data["product_id"]
ids["blog"] = A.post("/api/blogs/create/", {"title": "Fz", "content": "C" * 40}).data["blog_id"]
ids["tuition"] = A.post("/api/forums/tuition/create/", {"post_type": "offering_tuition", "contact_number": "017", "subjects": ["m"]}).data["tuition_id"]
ids["blood"] = A.post("/api/forums/blood/create/", {"blood_group": "A+", "patient_name": "p", "hospital_name": "h", "contact_number": "0171"}).data["request_id"]
Cf.post(f"/api/users/follow/{A.id}/")
ids["follow"] = DM.execute_query("select id from follows where follower_id=%s and following_id=%s", (Cf.id, A.id))[0]["id"]
befriend(A, B)
ids["notification"] = DM.execute_query("select id from notifications where user_id=%s limit 1", (A.id,))[0]["id"]
msg = A.post("/api/chat/send/", {"receiver_id": B.id, "content": "hi"}).data["data"]["id"]
ids["message"] = msg

def walk(patterns, prefix=""):
    for p in patterns:
        if isinstance(p, URLResolver):
            yield from walk(p.url_patterns, prefix + str(p.pattern))
        else:
            yield prefix + str(p.pattern), p

def fill(route):
    def sub(mm):
        n = mm.group(1)
        if n == "user_id": return str(B.id)
        if n in ("other_user_id", "follower_id"): return str(B.id)
        if n == "media_type": return "text"
        if n == "department_name": return "CSE"
        if n == "blood_group": return "A+"
        if n == "notification_type": return "like"
        if n == "follow_id": return str(ids["follow"])
        if n == "message_id": return str(ids["message"])
        if n == "notification_id": return str(ids["notification"])
        if n == "comment_id":
            return str(ids["comment"]) if "/blogs/" not in route else "1"
        if n == "post_id":
            return str(ids["tuition"] if "forums/tuition" in route else ids["post"])
        if n == "request_id": return str(ids["blood"])
        if n == "group_id": return str(ids["group"])
        if n == "product_id": return str(ids["product"])
        if n == "blog_id": return str(ids["blog"])
        if n == "seller_id": return str(A.id)
        return "1"
    return "/" + re.sub(r"<(?:\w+:)?(\w+)>", sub, route)

routes = []
for route, p in walk(get_resolver().url_patterns):
    cls = getattr(p.callback, "cls", None)
    if not cls or route.startswith(("admin", "swagger", "redoc", "health")):
        continue
    methods = [m.upper() for m in cls.http_method_names if hasattr(cls, m) and m != "options"]
    routes.append((fill(route), methods, cls.__name__, route))

FIELDS = ["content", "title", "name", "description", "message", "q", "query", "search", "email", "password", "bio", "category", "condition", "location",
          "status", "price", "rating", "review_text", "role", "buyer_id", "user_id", "receiver_id", "product_id", "post_id", "group_id", "new_admin_id",
          "media_url", "media_urls", "images", "tags", "subjects", "visibility", "media_type", "is_private", "is_published", "scheduled_publish_at",
          "parent_comment_id", "blood_group", "urgency", "patient_name", "hospital_name", "contact_number", "needed_date", "salary_min", "salary_max",
          "days_per_week", "duration_hours", "post_type", "class_level", "preferred_gender", "requirements", "excerpt", "cover_image", "hall_name",
          "hall_attachement", "department_name", "profile_picture", "batch", "student_id", "limit", "offset", "page", "refresh"]
HOSTILE = [
    ("sqli-quote", "' OR '1'='1' --"),
    ("sqli-drop", "'; DROP TABLE users; --"),
    ("sqli-union", "' UNION SELECT password,email,1,1,1 FROM users --"),
    ("sqli-stacked-%", "%' ; SELECT pg_sleep(0) --"),
    ("xss", "<script>alert(document.cookie)</script>"),
    ("null-byte", "abc\x00def"),
    ("path-traversal", "../../../../etc/passwd"),
    ("template", "{{7*7}}${7*7}%s%s%s%n"),
    ("huge-string", "A" * 20000),
    ("emoji-long", "💥" * 700),
    ("neg-int", -1),
    ("huge-int", 2 ** 70),
    ("float", 1e308),
    ("nan-str", "NaN"),
    ("none", None),
    ("bool", True),
    ("empty-list", []),
    ("list-of-str", ["a", "b"]),
    ("nested-obj", {"a": {"b": [1, 2, {"c": 3}]}}),
    ("digit-string", "9" * 400),
]
LEAK_PATTERNS = re.compile(r"psycopg|Traceback|syntax error at|relation \"|column \"|django\.db|File \"|ProgrammingError|DataError|IntegrityError", re.S)

users_before = DM.execute_query("select count(*) c from users")[0]["c"]
five = {}
leaks = {}
slow = {}
total = 0
for url, methods, cname, route in routes:
    for method in methods:
        for label, val in HOSTILE:
            body = {f: val for f in FIELDS}
            t0 = time.time()
            if method == "GET":
                if isinstance(val, (list, dict)) or val is None or val == "":
                    continue
                r = A.get(url, {k: val for k in ("q", "query", "search", "limit", "offset", "page", "status", "category", "min_price", "max_price", "department", "batch",
                                               "blood_group", "days", "type", "subject", "location", "hashtag", "tag", "mine", "is_published", "preferred_gender",
                                               "min_salary", "max_salary", "post_type", "product_id")})
            elif method == "DELETE":
                if label != "sqli-quote":
                    continue
                r = A.delete(url)
            else:
                r = getattr(A, method.lower())(url, body)
            dt = time.time() - t0
            total += 1
            key = f"{method} {route}"
            if r.status_code >= 500:
                five.setdefault(key, []).append((label, r.status_code, getattr(r, "data", {}).get("crash") if isinstance(getattr(r, "data", None), dict) else ""))
            txt = ""
            try:
                txt = json.dumps(r.data, default=str)
            except Exception:
                pass
            if LEAK_PATTERNS.search(txt):
                leaks.setdefault(key, []).append((label, LEAK_PATTERNS.search(txt).group(0)[:40]))
            if dt > 3:
                slow.setdefault(key, []).append((label, round(dt, 1)))

print(f"{total} fuzz requests sent")
users_after = DM.execute_query("select count(*) c from users")[0]["c"]
tables = [r["tablename"] for r in DM.execute_query("select tablename from pg_tables where schemaname='public'")]
check(AREA, "SQL injection payloads did not drop/alter tables or users", "users" in tables and "posts" in tables and users_after >= users_before, f"users {users_before}->{users_after}", "critical")
pw = DM.execute_query("select count(*) c from users where password like 'pbkdf2%%'")[0]["c"]
tot = DM.execute_query("select count(*) c from users")[0]["c"]
check(AREA, "no user password was overwritten by fuzzing", pw == tot, f"{pw}/{tot} hashed", "critical")

for key, items in sorted(five.items()):
    labels = sorted({i[0] for i in items})
    crash = next((i[2] for i in items if i[2]), "")
    check(AREA, f"no 5xx on {key}", False, f"{len(labels)} hostile inputs cause 5xx: {', '.join(labels[:8])}  {crash[:140]}", "high" if len(labels) > 3 else "medium")
for key, items in sorted(leaks.items()):
    check(AREA, f"no internal error details in responses of {key}", False, f"{items[0][1]} via {items[0][0]}", "medium")
for key, items in sorted(slow.items()):
    check(AREA, f"{key} stays fast under hostile input", False, f"{items[0][1]}s with {items[0][0]}", "medium")
check(AREA, "fuzz run completed with 0 server errors", not five, f"{len(five)} endpoints produced 5xx", "high")

# ---- explicit injection probes with state verification
def one(label, cond, detail="", sev="critical"):
    check(AREA, label, cond, detail, sev)

# login bypass attempts
for p in ({"email": "' OR 1=1 --", "password": "x"}, {"email": A.email + "' --", "password": "x"}, {"email": A.email, "password": "' OR '1'='1"}):
    r = anon().post("/api/users/login/", p)
    one(f"login injection {p['email'][:25]!r} does not authenticate", r.status_code in (400, 401), r.status_code)
# search injection must return no extra rows
r = A.get("/api/users/search/", {"q": "' OR '1'='1"})
one("user search injection returns nothing extra", r.status_code == 200 and len(r.data.get("results", [])) == 0, r.status_code, "high")
r = A.get("/api/users/search/", {"q": "%"})
n = len(r.data.get("results", [])) if r.status_code == 200 else -1
one("user search '%' wildcard does not dump every user (LIKE metacharacter not escaped)", n == 0, f"{n} users returned for q='%' (limit {20})", "low")
r = A.get("/api/marketplace/search/", {"q": "%"})
one("product search '%' wildcard does not match everything", r.status_code == 200 and len(r.data.get("results", r.data if isinstance(r.data, list) else [])) == 0,
    "LIKE metacharacters are not escaped", "low")
# stored XSS is returned JSON-encoded with correct content type (browser will not execute)
A.post("/api/posts/create/", {"content": "<img src=x onerror=alert(1)>"})
r = A.api.get("/api/posts/public/")
ct = r["Content-Type"] if r.has_header("Content-Type") else ""
one("API responses are application/json (not html)", "application/json" in ct, ct, "medium")
# markup in names is stored raw -> escaping is the frontend's job; verify the API does not echo input into HTML
r = anon().api.get("/api/users/profile/<script>/")
one("404 pages do not reflect input as HTML", b"<script>" not in getattr(r, "content", b""), "", "medium")

save_results()
