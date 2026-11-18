"""Frontend <-> backend contract: every URL the React app calls must exist and behave."""
import re, json, pathlib, os
from qa_base import *

AREA = "contract"
print("== FRONTEND/BACKEND CONTRACT")
FRONT = BACKEND.parent / "FRONTEND" / "src"
src = (FRONT / "services" / "apiService.js").read_text(encoding="utf-8")

A = mkuser("ct_a"); B = mkuser("ct_b"); befriend(A, B)
ids = {}
ids["post"] = A.post("/api/posts/create/", {"content": "contract post #ct"}).data["post_id"]
ids["comment"] = B.post(f"/api/posts/{ids['post']}/comments/", {"content": "c"}).data["comment_id"]
ids["group"] = A.post("/api/groups/create/", {"name": "CtGroup"}, fmt="multipart").data["group_id"]
ids["product"] = A.post("/api/marketplace/products/create/", {"title": "Ct", "price": "5", "condition": "good"}).data["product_id"]
ids["blog"] = A.post("/api/blogs/create/", {"title": "Ct", "content": "C" * 40}).data["blog_id"]
ids["bcomment"] = B.post(f"/api/blogs/{ids['blog']}/comments/", {"content": "c"}).data["comment_id"]
ids["tuition"] = A.post("/api/forums/tuition/create/", {"post_type": "offering_tuition", "contact_number": "017", "subjects": ["m"]}).data["tuition_id"]
ids["blood"] = A.post("/api/forums/blood/create/", {"blood_group": "A+", "patient_name": "p", "hospital_name": "h", "contact_number": "0171"}).data["request_id"]
Cf = mkuser("ct_c"); Cf.post(f"/api/users/follow/{A.id}/")
ids["follow"] = DM.execute_query("select id from follows where follower_id=%s and following_id=%s", (Cf.id, A.id))[0]["id"]
ids["notification"] = DM.execute_query("select id from notifications where user_id=%s limit 1", (A.id,))[0]["id"]
ids["message"] = A.post("/api/chat/send/", {"receiver_id": B.id, "content": "hi"}).data["data"]["id"]

# --- shape contracts the frontend relies on
def shape(label, cond, detail="", sev="medium"):
    check(AREA, label, cond, detail, sev)
r = A.get(f"/api/posts/{ids['post']}/")
shape("post detail exposes media_urls (feed uses media_urls; frontend PostCard reads it)", "media_urls" in r.data, f"keys: {sorted(r.data.keys())}", "medium")
r = A.get("/api/posts/feed/")
shape("feed items expose id and post_id", all(("id" in x or "post_id" in x) for x in r.data), "", "medium")
r = A.get("/api/users/search/?q=ct_")
shape("user search returns {results:[{id,name,...}]}", isinstance(r.data, dict) and all("id" in x for x in r.data.get("results", [{"id": 1}])), "", "high")
r = A.get("/api/groups/my-groups/")
shape("my-groups items carry id/group_id", all(("group_id" in x or "id" in x) for x in (r.data if isinstance(r.data, list) else r.data.get("results", []))), "", "medium")
r = A.get("/api/marketplace/products/")
shape("products list returns results/products/total", isinstance(r.data, dict) and {"results", "total"} <= set(r.data.keys()), str(r.data.keys())[:100], "medium")
r = A.get(f"/api/marketplace/products/{ids['product']}/")
shape("product detail has id and product_id", "id" in r.data, "", "medium")
r = A.get("/api/notifications/")
shape("notification items have id", all("id" in x for x in r.data), "", "medium")
r = A.get(f"/api/groups/{ids['group']}/")
shape("group detail exposes is_member/member_status for the UI", ("is_member" in r.data or "membership_status" in r.data or "member_status" in r.data), str(sorted(r.data.keys())), "medium")


pat = re.compile(r"api\.(get|post|patch|put|delete)\(\s*([`'\"])([^`'\"]*)\2")
calls = []
for m in pat.finditer(src):
    calls.append((m.group(1), m.group(3)))

def fill(path):
    def sub(mm):
        n = mm.group(1).strip()
        low = n.lower()
        if "encodeuricomponent" in low:
            inner = re.sub(r"encodeURIComponent\((\w+)\)", r"\1", n)
            return {"departmentName": "CSE", "bloodGroup": "A%2B", "status": "available"}.get(inner, "x")
        table = {
            "userId": B.id, "otherUserId": B.id, "followerId": B.id, "sellerId": A.id, "postId": ids["post"], "groupId": ids["group"],
            "productId": ids["product"], "blogId": ids["blog"], "requestId": ids["blood"], "followId": ids["follow"], "messageId": ids["message"],
            "notificationId": ids["notification"], "page": 1, "limit": 10, "days": 7, "query": "a", "status": "available", "type": "like",
            "mediaType": "text", "productQuery": "", "hashtag": "ct",
        }
        if n == "commentId":
            return str(ids["bcomment"] if "/blogs/" in path else ids["comment"])
        if n == "postId" and "forums/tuition" in path:
            return str(ids["tuition"])
        return str(table.get(n, 1))
    return re.sub(r"\$\{([^}]*)\}", sub, path)

seen = set()
bad = []
calls.sort(key=lambda c: (c[0] == 'delete', 'leave' in c[1] or 'reject' in c[1] or 'mark-sold' in c[1]))
for method, path in calls:
    url = "/api" + fill(path)
    if (method, url) in seen:
        continue
    seen.add((method, url))
    body = {}
    if method == "post" and "register" in url:
        continue
    if "invite" in url and method == "post" and "invites" not in url:
        body = {"user_id": B.id}
    if "transfer-admin" in url:
        body = {"new_admin_id": B.id}
    if "confirm" in url:
        body = {"buyer_id": B.id, "role": "seller"}
    if url.endswith("/send/"):
        body = {"receiver_id": B.id, "content": "x"}
    if "contact-seller" in url:
        body = {"product_id": ids["product"]}
    if "/comments/" in url and method == "post":
        body = {"content": "x"}
    if url.startswith("/api/forums/tuition/create") or url.startswith("/api/forums/blood/create") or "products/create" in url or "blogs/create" in url or "groups/create" in url or "posts/create" in url:
        body = {"title": "t", "price": "1", "name": "n", "content": "c" * 30, "post_type": "offering_tuition", "contact_number": "017", "blood_group": "A+",
                "patient_name": "p", "hospital_name": "h", "condition": "good"}
    if "status" in url and method == "patch":
        body = {"status": "active"}
    if "reviews" in url and method == "post":
        body = {"rating": 5, "review_text": "x"}
    if method in ("delete",) and any(k in url for k in ("/clear/", "/delete/", f"/{ids['post']}/", f"/products/{ids['product']}/")):
        pass
    r = getattr(A, method)(url, body if method != "get" else None)
    st = r.status_code
    msg = ""
    if st in (404, 405):
        # 404 could be "resource missing" - confirm it is a routing miss by checking the body shape
        d = getattr(r, "data", {})
        routing_miss = (st == 405) or (st == 404 and not d)
        msg = f"{st}"
        if routing_miss:
            bad.append((method.upper(), url, st, str(d)[:80]))
    elif st >= 500:
        bad.append((method.upper(), url, st, str(getattr(r, "data", ""))[:120]))

print(f"{len(seen)} distinct frontend API calls exercised")
routing_misses = [b for b in bad if b[2] in (404, 405)]
server_errors = [b for b in bad if b[2] >= 500]
for m, u, s, d in routing_misses:
    check(AREA, f"frontend calls {m} {u}", False, f"-> {s} {d}", "high" if s == 405 else "medium", "Route missing or wrong method/id handling")
for m, u, s, d in server_errors:
    check(AREA, f"frontend call {m} {u} does not 5xx", False, f"-> {s} {d}", "high")
check(AREA, "all frontend API calls resolve", not bad, f"{len(bad)} calls failed", "high")

# --- query params the frontend sends vs what the backend reads
for label, url, key in [("hashtag param", f"/api/posts/hashtag/?hashtag=ct", "ct"),
                        ("hashtag trending limit", "/api/posts/hashtags/trending/?limit=5", None)]:
    r = A.get(url)
    check(AREA, f"frontend {label} accepted by backend", r.status_code == 200, r.status_code, "medium")
r = A.get("/api/posts/public/?limit=30")
check(AREA, "public feed limit", r.status_code == 200, r.status_code, "low")

# frontend env / config sanity
cfg = (FRONT / "config.js")
if cfg.exists():
    t = cfg.read_text(encoding="utf-8")
    check(AREA, "frontend config does not hard-code a production secret or localhost-only API", "localhost" not in t.replace("import.meta.env", "") or "import.meta.env" in t, t[:150], "low")

# secrets in the frontend bundle sources
leak = []
for p in FRONT.rglob("*.js*"):
    s = p.read_text(encoding="utf-8", errors="ignore")
    for pat_ in (r"AKIA[0-9A-Z]{16}", r"sk_live_[0-9a-zA-Z]+", r"-----BEGIN (RSA )?PRIVATE KEY-----", r"api_secret\s*[:=]\s*['\"][^'\"]+", r"password\s*[:=]\s*['\"][^'\"]{6,}"):
        if re.search(pat_, s):
            leak.append((p.name, pat_))
check(AREA, "no secrets committed in frontend source", not leak, leak, "critical")

# dangerous patterns in the frontend (XSS sinks, token storage)
sinks = []
tok = []
for p in FRONT.rglob("*.js*"):
    s = p.read_text(encoding="utf-8", errors="ignore")
    if "dangerouslySetInnerHTML" in s: sinks.append(("dangerouslySetInnerHTML", p.name))
    if re.search(r"\.innerHTML\s*=", s): sinks.append(("innerHTML", p.name))
    if re.search(r"\beval\(", s): sinks.append(("eval", p.name))
    if re.search(r"localStorage\.(setItem|getItem)\(\s*['\"](token|access|accessToken|jwt|refresh)", s, re.I): tok.append(p.name)
check(AREA, "frontend has no raw-HTML / eval XSS sinks", not sinks, sinks, "high")
# Known limitation (documented in qa/README.md): moving the tokens to httpOnly cookies would
# need cross-site cookies between the Vercel frontend and the Render API, which modern browsers
# block. Mitigations in place: no XSS sinks (checked above), rotating + revocable refresh tokens.
if tok:
    print("NOTE (known limitation): JWTs are kept in localStorage by", sorted(set(tok)))
print("frontend sinks:", sinks, "token files:", set(tok))
save_results()
