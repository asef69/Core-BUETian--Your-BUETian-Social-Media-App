"""Regression checks for fixes made after the first QA round."""
import time
from qa_base import *
import json

AREA = "regress"
print("== REGRESSION")
A = mkuser("rg_a"); B = mkuser("rg_b"); C = mkuser("rg_c"); befriend(A, B)

# ---- logout / refresh rotation
u = mkuser("rg_tok")
r = anon().post("/api/users/token/refresh/", {"refresh": u.refresh})
check(AREA, "refresh rotates: new access AND new refresh token returned", r.status_code == 200 and r.data.get("refresh") and r.data["refresh"] != u.refresh, getattr(r, "data", ""), "high")
new_refresh = r.data.get("refresh")
time.sleep(0)
DM.execute_update("UPDATE revoked_tokens SET revoked_at = NOW() - INTERVAL '5 minutes'")
check(AREA, "a rotated (old) refresh token is rejected after the grace window", anon().post("/api/users/token/refresh/", {"refresh": u.refresh}).status_code == 401, "", "high")
r = anon().post("/api/users/token/refresh/", {"refresh": new_refresh})
check(AREA, "the new refresh token works", r.status_code == 200, r.status_code, "high")
newest = r.data.get("refresh")
anon().post("/api/users/token/refresh/", {"refresh": newest}) if False else None
r = anon().post("/api/users/logout/", {"refresh": newest})
check(AREA, "logout returns 200", r.status_code == 200, r.status_code, "medium")
DM.execute_update("UPDATE revoked_tokens SET revoked_at = NOW() - INTERVAL '5 minutes'")
check(AREA, "refresh token cannot be used after logout", anon().post("/api/users/token/refresh/", {"refresh": newest}).status_code == 401, "", "high")
check(AREA, "logout with garbage token is harmless", anon().post("/api/users/logout/", {"refresh": "junk"}).status_code == 200, "", "low")
v = mkuser("rg_par")
r1 = anon().post("/api/users/token/refresh/", {"refresh": v.refresh}); r2 = anon().post("/api/users/token/refresh/", {"refresh": v.refresh})
check(AREA, "parallel refresh within the grace window still gets an access token", r1.status_code == 200 and r2.status_code == 200 and "access" in r2.data, f"{r1.status_code}/{r2.status_code}", "medium")

# ---- login lockout is per account
w = mkuser("rg_lock")
set_rates(NO_LIMITS)
codes = [anon().post("/api/users/login/", {"email": w.email, "password": f"wrong{i}x"}).status_code for i in range(12)]
check(AREA, "8+ failed logins lock the account (429)", 429 in codes and codes.index(429) <= 9, codes, "high")
check(AREA, "even the correct password is refused while locked", anon().post("/api/users/login/", {"email": w.email, "password": w.body["password"]}).status_code == 429, "", "medium")
cache.clear()
check(AREA, "lockout clears (cache reset) and a correct login works again", anon().post("/api/users/login/", {"email": w.email, "password": w.body["password"]}).status_code == 200, "", "medium")

# ---- hostile input
for label, body in [("NUL in email", {"email": "a\x00b@x.com", "password": "x" * 9}), ("NUL in password", {"email": "a@x.com", "password": "x\x00y"})]:
    check(AREA, f"login {label} -> 4xx", anon().post("/api/users/login/", body).status_code in (400, 401), "", "medium")
check(AREA, "NUL in search term -> 400", A.get("/api/users/search/?q=a%00b").status_code == 400, A.get("/api/users/search/?q=a%00b").status_code, "medium")
check(AREA, "NUL in group name -> 400", A.post("/api/groups/create/", {"name": "a\x00b"}, fmt="multipart").status_code == 400, "", "medium")
check(AREA, "login with a JSON array body -> 400", anon().api.post("/api/users/login/", data="[]", content_type="application/json").status_code == 400, "", "medium")
check(AREA, "huge offset is clamped, not a 500", A.get("/api/posts/feed/?offset=99999999999999999999").status_code == 200, A.get("/api/posts/feed/?offset=99999999999999999999").status_code, "medium")
check(AREA, "huge batch filter -> no 500", A.get("/api/users/search/?q=a&batch=9999999999999").status_code < 500, "", "medium")
check(AREA, "path id above int32 -> 404", A.get("/api/users/profile/2147483648/").status_code == 404, A.get("/api/users/profile/2147483648/").status_code, "medium")
check(AREA, "comment edit with non-string content -> 400", A.put("/api/posts/comments/1/", {"content": 123}).status_code in (400, 403, 404), "", "medium")
p = A.post("/api/posts/create/", {"content": "types"}).data["post_id"]
check(AREA, "post create with numeric media_urls -> 400", A.post("/api/posts/create/", {"content": "x", "media_urls": 5}).status_code == 400, "", "medium")
check(AREA, "tuition salary 'NaN' -> 400", A.post("/api/forums/tuition/create/", {"post_type": "offering_tuition", "contact_number": "017", "salary_min": "NaN"}).status_code == 400, "", "medium")
check(AREA, "hashtag with regex characters is harmless", A.get("/api/posts/hashtag/?hashtag=(a%7Cb)*").status_code == 200, A.get("/api/posts/hashtag/?hashtag=(a%7Cb)*").status_code, "medium")

# ---- LIKE wildcards are literal
check(AREA, "user search '%' matches nothing", A.get("/api/users/search/?q=%25").data.get("results") == [], "", "low")
check(AREA, "product search '_' matches nothing", all(False for _ in A.get("/api/marketplace/search/?q=_").data.get("results", [])), "", "low")

# ---- media URL host allow-list
for url in ("https://evil.example/x.png", "http://res.cloudinary.com/x.png", "//evil.example/x.png", "https://res.cloudinary.com.evil.example/x.png"):
    check(AREA, f"profile_picture {url} rejected", A.patch("/api/users/profile/update/", {"profile_picture": url}).status_code == 400, "", "medium")
check(AREA, "profile_picture on the Cloudinary host accepted", A.patch("/api/users/profile/update/", {"profile_picture": "https://res.cloudinary.com/demo/image/upload/a.png"}).status_code == 200, "", "medium")
check(AREA, "profile_picture local /media path accepted", A.patch("/api/users/profile/update/", {"profile_picture": "/media/profile_pictures/a.png"}).status_code == 200, "", "low")

# ---- marketplace needs login
check(AREA, "marketplace listing requires login", anon().get("/api/marketplace/products/").status_code == 401, "", "low")
check(AREA, "product detail requires login", anon().get("/api/marketplace/products/1/").status_code == 401, "", "low")

# ---- per-user chat deletion, both directions
befriend(A, C)
A.post("/api/chat/send/", {"receiver_id": C.id, "content": "keep me"}); C.post("/api/chat/send/", {"receiver_id": A.id, "content": "reply"})
A.delete(f"/api/chat/conversation/{C.id}/delete/")
check(AREA, "after A deletes, A sees nothing", A.get(f"/api/chat/messages/{C.id}/").data == [] and not any(x.get("other_user_id") == C.id for x in A.get("/api/chat/conversations/").data), "", "medium")
check(AREA, "after A deletes, C still sees both messages", len(C.get(f"/api/chat/messages/{A.id}/").data) == 2, "", "high")
check(AREA, "search no longer finds A's deleted messages", "keep me" not in json.dumps(A.get("/api/chat/search/?q=keep").data, default=str), "", "medium")
check(AREA, "A can still message C afterwards (relationship kept)", A.post("/api/chat/send/", {"receiver_id": C.id, "content": "new"}).status_code == 201, "", "medium")
C.delete(f"/api/chat/conversation/{A.id}/delete/"); A.delete(f"/api/chat/conversation/{C.id}/delete/")
check(AREA, "rows are physically removed once both sides deleted", DM.execute_query("select count(*) c from messages where (sender_id=%s and receiver_id=%s) or (sender_id=%s and receiver_id=%s)", (A.id, C.id, C.id, A.id))[0]["c"] == 0, "", "low")

# ---- comments are paginated
pid = A.post("/api/posts/create/", {"content": "many comments"}).data["post_id"]
DM.execute_update("INSERT INTO comments(post_id,user_id,content) SELECT %s,%s,'c'||g FROM generate_series(1,700) g", (pid, B.id))
check(AREA, "comments default page is capped at 500", len(B.get(f"/api/posts/{pid}/comments/").data) == 500, "", "medium")
check(AREA, "comments honour limit/offset", len(B.get(f"/api/posts/{pid}/comments/?limit=10&offset=695").data) == 5, "", "low")

# ---- group post by direct id
g = A.post("/api/groups/create/", {"name": "Priv", "is_private": "true"}, fmt="multipart").data["group_id"]
gp = A.post(f"/api/groups/{g}/posts/create/", {"content": "inside"}).data["post_id"]
check(AREA, "group post hidden from outsiders by direct id", C.get(f"/api/posts/{gp}/").status_code == 404, C.get(f"/api/posts/{gp}/").status_code, "critical")
check(AREA, "group post visible to its author", A.get(f"/api/posts/{gp}/").status_code == 200, "", "high")
check(AREA, "post detail exposes media_urls", "media_urls" in A.get(f"/api/posts/{pid}/").data and "group_id" not in A.get(f"/api/posts/{pid}/").data, "", "low")

save_results()
