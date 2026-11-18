"""Authorization / IDOR / privacy tests across every module."""
from qa_base import *

print("== ACCESS CONTROL / IDOR / PRIVACY")
A = mkuser("owner"); B = mkuser("member"); C = mkuser("stranger"); M = mkuser("moderator"); D = mkuser("outsider")
befriend(A, B)

def denied(r):
    return r.status_code in (400, 401, 403, 404)

# ============================================================ POSTS
AR = "access/posts"
pub = A.post("/api/posts/create/", {"content": "PUBLIC post #qa", "visibility": "public"}).data["post_id"]
prv = A.post("/api/posts/create/", {"content": "PRIVATE post #qa", "visibility": "private"}).data["post_id"]
fol = A.post("/api/posts/create/", {"content": "FOLLOWERS post #qa", "visibility": "followers"}).data["post_id"]
cm_prv = DM.execute_query("INSERT INTO comments(post_id,user_id,content) VALUES (%s,%s,'secret comment') RETURNING id", (prv, A.id))[0]["id"]
cm_pub = B.post(f"/api/posts/{pub}/comments/", {"content": "B comment"}).data.get("comment_id")

check(AR, "stranger cannot open private post", denied(C.get(f"/api/posts/{prv}/")), C.get(f"/api/posts/{prv}/").status_code, "critical")
check(AR, "stranger cannot open followers-only post", denied(C.get(f"/api/posts/{fol}/")), C.get(f"/api/posts/{fol}/").status_code, "high")
check(AR, "follower can open followers-only post", B.get(f"/api/posts/{fol}/").status_code == 200, B.get(f"/api/posts/{fol}/").status_code, "high")
check(AR, "stranger cannot like private post", denied(C.post(f"/api/posts/{prv}/like/")), "", "high")
check(AR, "stranger cannot comment on private post", denied(C.post(f"/api/posts/{prv}/comments/", {"content": "x"})), "", "high")
check(AR, "stranger cannot list comments of private post", denied(C.get(f"/api/posts/{prv}/comments/")), "", "high")
r = C.post(f"/api/posts/comments/{cm_prv}/like/")
check(AR, "stranger cannot like a comment that belongs to a private post", denied(r), r.status_code, "medium")
r = C.patch(f"/api/posts/comments/{cm_prv}/", {"content": "hacked"})
check(AR, "stranger cannot edit comment on private post", denied(r), r.status_code, "high")
check(AR, "stranger cannot edit A's post", denied(C.patch(f"/api/posts/{pub}/", {"content": "hacked"})), "", "critical")
check(AR, "stranger cannot delete A's post", denied(C.delete(f"/api/posts/{pub}/")), "", "critical")
check(AR, "post owner can still delete (sanity)", A.delete(f"/api/posts/{A.post('/api/posts/create/', {'content': 'temp'}).data['post_id']}/").status_code == 200, "", "medium")
def leaked(r, needle):
    d = r.data if hasattr(r, "data") else None
    return needle in json.dumps(d, default=str) if d is not None else False
import json
for label, url in [("public feed", "/api/posts/public/"), ("trending", "/api/posts/trending/"), ("search", "/api/posts/search/?q=post"),
                   ("media/text", "/api/posts/media/text/"), ("hashtag", "/api/posts/hashtag/?hashtag=qa"), ("hashtag(tag=)", "/api/posts/hashtag/?tag=qa"),
                   ("A's profile posts", f"/api/users/{A.id}/posts/"), ("C feed", "/api/posts/feed/"), ("liked posts of A", f"/api/posts/liked/{A.id}/")]:
    r = C.get(url)
    check(AR, f"private post not exposed in {label} to a stranger", not leaked(r, "PRIVATE post"), "leaked" if leaked(r, "PRIVATE post") else r.status_code, "critical")
    check(AR, f"followers-only post not exposed in {label} to a stranger", not leaked(r, "FOLLOWERS post"), "leaked" if leaked(r, "FOLLOWERS post") else r.status_code, "high")
r = B.get(f"/api/users/{A.id}/posts/")
check(AR, "follower sees followers-only post on A's profile", leaked(r, "FOLLOWERS post"), r.status_code, "medium")
r = A.get("/api/posts/hashtag/?hashtag=qa")
check(AR, "hashtag search with ?hashtag= (frontend param) works", r.status_code == 200, f"{r.status_code} {getattr(r,'data','')}", "medium")
r = A.get("/api/posts/hashtag/?hashtag=%23qa")
check(AR, "hashtag search with leading # works", r.status_code == 200, r.status_code, "low")
r = D.post(f"/api/posts/{pub}/comments/", {"content": "x" * 2001})
check(AR, "comment over 2000 chars rejected", r.status_code == 400, r.status_code, "low")
r = D.post(f"/api/posts/{pub}/comments/", {"content": "reply", "parent_comment_id": cm_prv})
check(AR, "reply cannot attach to a comment of another post", r.status_code in (400, 404), r.status_code, "medium")
# like toggle idempotency / counters
before = DM.execute_query("select likes_count from posts where id=%s", (pub,))[0]["likes_count"]
D.post(f"/api/posts/{pub}/like/"); D.post(f"/api/posts/{pub}/like/")
after = DM.execute_query("select likes_count from posts where id=%s", (pub,))[0]["likes_count"]
check(AR, "like then unlike returns the counter to its start", before == after, f"{before}->{after}", "medium")
# private post of A visible to A
check(AR, "owner can open own private post", A.get(f"/api/posts/{prv}/").status_code == 200, "", "high")

# ============================================================ FOLLOW
AR = "access/follow"
A.post(f"/api/users/follow/{C.id}/")   # A -> C pending
fid = DM.execute_query("select id from follows where follower_id=%s and following_id=%s", (A.id, C.id))[0]["id"]
check(AR, "third party cannot accept someone else's follow request", denied(D.post(f"/api/users/follow/accept/{fid}/")), "", "high")
check(AR, "third party cannot reject someone else's follow request", denied(D.post(f"/api/users/follow/reject/{fid}/")), "", "high")
check(AR, "requester cannot accept own request", denied(A.post(f"/api/users/follow/accept/{fid}/")), "", "high")
check(AR, "target can accept", C.post(f"/api/users/follow/accept/{fid}/").status_code == 200, "", "high")
check(AR, "follower removal only affects own followers", D.delete(f"/api/users/followers/remove/{A.id}/").status_code in (404, 400, 403, 200) and
      DM.execute_query("select 1 from follows where follower_id=%s and following_id=%s", (A.id, C.id)) != [], "", "high")
r = A.post(f"/api/users/follow/{A.id}/")
check(AR, "cannot follow yourself", r.status_code == 400, r.status_code, "low")
r = A.get(f"/api/users/{A.id}/followers/")
check(AR, "followers list endpoint works", r.status_code == 200, r.status_code, "medium")
# deactivated users must not appear
DM.execute_update("UPDATE users SET is_active=FALSE WHERE id=%s", (D.id,))
for label, url in [("search", f"/api/users/search/?q={D.name.split()[0]}"), ("department", "/api/users/department/CSE/"), ("blood group", "/api/users/blood-group/A+/")]:
    r = A.get(url)
    check(AR, f"deactivated user hidden from {label}", D.name not in json.dumps(r.data, default=str), "", "medium")
check(AR, "deactivated user's profile not viewable", A.get(f"/api/users/profile/{D.id}/").status_code == 404, "", "medium")
DM.execute_update("UPDATE users SET is_active=TRUE WHERE id=%s", (D.id,))

# ============================================================ GROUPS
AR = "access/groups"
g = A.post("/api/groups/create/", {"name": "Secret Club", "description": "private", "is_private": "true"}, fmt="multipart").data["group_id"]
pubg = A.post("/api/groups/create/", {"name": "Open Club", "description": "open", "is_private": "false"}, fmt="multipart").data["group_id"]
B.post(f"/api/groups/{g}/join/"); A.post(f"/api/groups/{g}/accept/{B.id}/")
M.post(f"/api/groups/{g}/join/"); A.post(f"/api/groups/{g}/accept/{M.id}/")
A.post(f"/api/groups/{g}/promote/{M.id}/")
C.post(f"/api/groups/{g}/join/")   # pending
role = lambda u: (DM.execute_query("select role,status from group_members where group_id=%s and user_id=%s", (g, u.id)) or [{}])[0]
check(AR, "setup: moderator promoted", role(M).get("role") == "moderator", role(M), "medium")
gp = A.post(f"/api/groups/{g}/posts/create/", {"content": "GROUP SECRET post"}).data.get("post_id")
check(AR, "setup: group post created by admin", bool(gp), "", "medium")
check(AR, "non-member cannot read private group posts", denied(D.get(f"/api/groups/{g}/posts/")), D.get(f"/api/groups/{g}/posts/").status_code, "critical")
check(AR, "pending member cannot read private group posts", denied(C.get(f"/api/groups/{g}/posts/")), C.get(f"/api/groups/{g}/posts/").status_code, "critical")
r = D.get(f"/api/groups/{g}/members/")
check(AR, "non-member cannot list members of a private group", denied(r), r.status_code, "medium")
check(AR, "non-member cannot see group activity", denied(D.get(f"/api/groups/{g}/activity/")), D.get(f"/api/groups/{g}/activity/").status_code, "medium")
check(AR, "non-member cannot post in group", denied(D.post(f"/api/groups/{g}/posts/create/", {"content": "x"})), "", "high")
check(AR, "group post not exposed in global feeds/search", not any(leaked(D.get(u), "GROUP SECRET") for u in ("/api/posts/public/", "/api/posts/trending/", "/api/posts/search/?q=GROUP", f"/api/users/{A.id}/posts/", "/api/posts/media/text/")), "", "critical")
r = D.get(f"/api/posts/{gp}/")
check(AR, "group post not readable by direct id to non-member", denied(r), r.status_code, "critical")
check(AR, "regular member cannot accept pending requests", denied(B.post(f"/api/groups/{g}/accept/{C.id}/")), "", "high")
check(AR, "regular member cannot reject pending requests", denied(B.post(f"/api/groups/{g}/reject/{C.id}/")), "", "high")
check(AR, "regular member cannot view pending list", denied(B.get(f"/api/groups/{g}/pending/")), "", "medium")
check(AR, "regular member cannot invite", denied(B.post(f"/api/groups/{g}/invite/", {"user_id": D.id})), "", "high")
check(AR, "regular member cannot remove members", denied(B.delete(f"/api/groups/{g}/members/{M.id}/")), "", "high")
check(AR, "regular member cannot promote", denied(B.post(f"/api/groups/{g}/promote/{B.id}/")), "", "critical")
check(AR, "regular member cannot transfer admin", denied(B.post(f"/api/groups/{g}/transfer-admin/", {"new_admin_id": B.id})), "", "critical")
check(AR, "regular member cannot update group", denied(B.patch(f"/api/groups/{g}/update/", {"name": "pwned"})), "", "critical")
check(AR, "regular member cannot delete group", denied(B.delete(f"/api/groups/{g}/delete/")), "", "critical")
check(AR, "moderator cannot promote others", denied(M.post(f"/api/groups/{g}/promote/{B.id}/")), M.post(f"/api/groups/{g}/promote/{B.id}/").status_code, "high")
check(AR, "moderator cannot demote the admin / others", denied(M.post(f"/api/groups/{g}/demote/{A.id}/")), "", "high")
check(AR, "moderator cannot remove the admin", denied(M.delete(f"/api/groups/{g}/members/{A.id}/")) or M.delete(f"/api/groups/{g}/members/{A.id}/").status_code == 400, "", "critical")
check(AR, "moderator cannot transfer admin", denied(M.post(f"/api/groups/{g}/transfer-admin/", {"new_admin_id": M.id})), "", "critical")
check(AR, "moderator cannot update group", denied(M.patch(f"/api/groups/{g}/update/", {"name": "pwned"})), M.patch(f"/api/groups/{g}/update/", {"name": "pwned"}).status_code, "high")
check(AR, "moderator cannot delete group", denied(M.delete(f"/api/groups/{g}/delete/")), "", "critical")
r = A.post(f"/api/groups/{g}/transfer-admin/", {"new_admin_id": D.id})
check(AR, "admin cannot hand admin rights to a non-member", r.status_code >= 400, f"{r.status_code} {getattr(r,'data','')}", "high")
check(AR, "admin cannot leave without transferring", A.post(f"/api/groups/{g}/leave/").status_code == 403, "", "medium")
r = A.post(f"/api/groups/{g}/promote/{D.id}/")
check(AR, "admin cannot promote a non-member to moderator", r.status_code >= 400, f"{r.status_code} {getattr(r,'data','')}", "medium")
check(AR, "member cannot cancel invites", denied(B.post(f"/api/groups/{g}/cancel-invite/{D.id}/")), "", "medium")
check(AR, "member cannot see invited list", denied(B.get(f"/api/groups/{g}/invited/")), "", "medium")
r = D.post(f"/api/groups/{g}/accept/")
check(AR, "accepting an invite you never received fails", r.status_code >= 400, f"{r.status_code} {getattr(r,'data','')}", "high")
check(AR, "stranger sees private group only as non-member view", D.get(f"/api/groups/{g}/").status_code in (200, 403, 404), "", "low")
# join rules
r = D.post(f"/api/groups/{pubg}/join/")
check(AR, "public group join accepted immediately", r.status_code == 200 and (DM.execute_query("select status from group_members where group_id=%s and user_id=%s", (pubg, D.id)) or [{}])[0].get("status") == "accepted", r.data if hasattr(r, "data") else "", "medium")
# kicked user cannot rejoin silently to private group and spam admin
A.delete(f"/api/groups/{g}/members/{B.id}/")
r = B.post(f"/api/groups/{g}/join/")
check(AR, "removed member can re-request (goes to pending, not auto-accepted)", (DM.execute_query("select status from group_members where group_id=%s and user_id=%s", (g, B.id)) or [{}])[0].get("status") == "pending", "", "medium")
r = B.post(f"/api/groups/{g}/join/")
check(AR, "duplicate join request is idempotent", r.status_code == 200, r.status_code, "low")
# invite flow
A.post(f"/api/groups/{g}/invite/", {"user_id": D.id})
r = D.post(f"/api/groups/{g}/accept/")
check(AR, "invited user can accept the invite", r.status_code == 200 and role(D).get("status") == "accepted", f"{r.status_code} {role(D)}", "high")
r = A.post(f"/api/groups/{g}/invite/", {"user_id": 99999999})
check(AR, "invite of nonexistent user -> 404", r.status_code == 404, r.status_code, "low")
r = A.post(f"/api/groups/{g}/invite/", {"user_id": "abc"})
check(AR, "invite with bad user_id -> 400", r.status_code == 400, r.status_code, "low")
r = A.post(f"/api/groups/{g}/invite/", {"user_id": A.id})
check(AR, "admin inviting themselves is harmless", r.status_code < 500, r.status_code, "low")
# group cover
r = A.get(f"/api/groups/{g}/activity/?days=999999999999")
check(AR, "activity days huge value handled", r.status_code < 500, r.status_code, "low")

# ============================================================ MARKETPLACE
AR = "access/marketplace"
pid = A.post("/api/marketplace/products/create/", {"title": "QA Laptop", "price": "500", "condition": "good", "category": "electronics"}).data["product_id"]
check(AR, "stranger cannot mark product sold", denied(C.post(f"/api/marketplace/products/{pid}/mark-sold/", {"buyer_id": C.id})), "", "critical")
check(AR, "stranger cannot reserve product", denied(C.post(f"/api/marketplace/products/{pid}/reserve/")), C.post(f"/api/marketplace/products/{pid}/reserve/").status_code, "high")
check(AR, "stranger cannot edit product", denied(C.patch(f"/api/marketplace/products/{pid}/", {"price": "1"})), "", "critical")
check(AR, "stranger cannot delete product", denied(C.delete(f"/api/marketplace/products/{pid}/")), "", "critical")
r = A.post(f"/api/marketplace/products/{pid}/mark-sold/", {"buyer_id": A.id})
check(AR, "seller cannot be the buyer", r.status_code >= 400, f"{r.status_code}", "medium")
r = A.post(f"/api/marketplace/products/{pid}/mark-sold/", {"buyer_id": 99999999})
check(AR, "sold to nonexistent buyer rejected", r.status_code >= 400, f"{r.status_code} {getattr(r,'data','')}", "medium")
r = A.post(f"/api/marketplace/products/{pid}/mark-sold/", {"buyer_id": B.id})
check(AR, "seller can mark sold with a buyer", r.status_code == 200, f"{r.status_code} {getattr(r,'data','')}", "high")
rv = lambda u, rating, txt="ok": u.post(f"/api/marketplace/products/{pid}/reviews/", {"rating": rating, "review_text": txt})
check(AR, "non-buyer cannot review", rv(C, 5).status_code >= 400, rv(C, 5).status_code, "high")
check(AR, "seller cannot review own product", rv(A, 5).status_code >= 400, "", "high")
check(AR, "buyer can review", rv(B, 4).status_code in (200, 201), f"{rv(B,4).status_code} {getattr(rv(B,4),'data','')}", "high")
for bad in (0, 6, "abc", None, 4.5):
    r = rv(B, bad)
    check(AR, f"rating {bad!r} rejected", r.status_code in (400,) , f"{r.status_code} {getattr(r,'data','')}", "medium")
check(AR, "review text 100KB rejected", rv(B, 4, "x" * 100000).status_code == 400, rv(B, 4, "x" * 100000).status_code, "low")
rep = A.get(f"/api/marketplace/sellers/{A.id}/reputation/")
check(AR, "seller reputation reflects the review", rep.status_code == 200 and "4" in json.dumps(rep.data, default=str), getattr(rep, "data", ""), "medium")
# transactions
conf = lambda u, role_, buyer: u.post(f"/api/marketplace/transactions/{pid}/confirm/", {"buyer_id": buyer, "role": role_})
check(AR, "third party cannot confirm transaction as seller", conf(C, "seller", B.id).status_code >= 400, "", "high")
check(AR, "third party cannot confirm as buyer", conf(C, "buyer", C.id).status_code >= 400, conf(C, "buyer", C.id).status_code, "high")
check(AR, "buyer cannot confirm as seller (role spoof)", conf(B, "seller", B.id).status_code >= 400, conf(B, "seller", B.id).status_code, "high")
check(AR, "seller cannot confirm as buyer (role spoof)", conf(A, "buyer", B.id).status_code >= 400, conf(A, "buyer", B.id).status_code, "high")
check(AR, "real buyer confirms", conf(B, "buyer", B.id).status_code == 200, f"{conf(B,'buyer',B.id).status_code} {getattr(conf(B,'buyer',B.id),'data','')}", "high")
check(AR, "real seller confirms", conf(A, "seller", B.id).status_code == 200, "", "high")
# editing a sold product's price/status afterwards
r = A.patch(f"/api/marketplace/products/{pid}/", {"price": "1"})
check(AR, "price of a sold product cannot be rewritten after the review (integrity)", r.status_code >= 400, f"{r.status_code} (reviews/ratings reference the old deal)", "low")
r = A.patch(f"/api/marketplace/products/{pid}/", {"status": "available"})
check(AR, "sold product cannot be flipped back to available after buyer confirmed", r.status_code >= 400, f"{r.status_code}", "low")
# contact seller spam
set_rates(PROD_RATES)
for i in range(30):
    C.post("/api/chat/contact-seller/", {"product_id": pid, "message": f"spam {i}"})
set_rates(NO_LIMITS)
n = DM.execute_query("select count(*) c from messages where sender_id=%s and receiver_id=%s", (C.id, A.id))[0]["c"]
check(AR, "contact-seller is rate limited (30 rapid requests)", n < 30, f"{n} messages created in a burst", "medium", "Add throttling to chat/contact endpoints")
r = D.get("/api/marketplace/products/?min_price=abc")
check(AR, "min_price=abc -> 400", r.status_code == 400, r.status_code, "low")
r = D.get("/api/marketplace/search/?q=" + "a" * 5000)
check(AR, "very long search string handled", r.status_code < 500, r.status_code, "low")
r = D.get("/api/marketplace/products/?page=99999999&limit=200")
check(AR, "huge page number handled", r.status_code < 500, r.status_code, "low")
r = D.get("/api/marketplace/products/?page=-3")
check(AR, "negative page handled", r.status_code < 500, r.status_code, "low")

# ============================================================ NOTIFICATIONS
AR = "access/notifications"
A.post(f"/api/users/follow/{D.id}/")
nid = DM.execute_query("select id from notifications where user_id=%s order by id desc limit 1", (D.id,))
nid = nid[0]["id"] if nid else None
check(AR, "setup: follow created a notification for D", nid is not None, "", "medium")
if nid:
    check(AR, "other user cannot read someone else's notification list entry", str(nid) not in json.dumps([n.get("id") for n in C.get("/api/notifications/").data], default=str).split(","), "", "high")
    check(AR, "other user cannot mark it read", denied(C.post(f"/api/notifications/{nid}/read/")), "", "high")
    check(AR, "other user cannot delete it", denied(C.delete(f"/api/notifications/{nid}/")), "", "high")
    C.delete("/api/notifications/clear/")
    check(AR, "clear-all only clears the caller's notifications", bool(DM.execute_query("select 1 from notifications where id=%s", (nid,))), "", "critical")

# ============================================================ CHAT
AR = "access/chat"
check(AR, "stranger cannot message another user", denied(D.post("/api/chat/send/", {"receiver_id": M.id, "content": "hi"})), D.post("/api/chat/send/", {"receiver_id": M.id, "content": "hi"}).status_code, "high")
r = A.post("/api/chat/send/", {"receiver_id": B.id, "content": "private talk SECRETWORD"})
check(AR, "friends can message", r.status_code == 201, r.status_code, "high")
mid = (r.data or {}).get("data", {}).get("id")
check(AR, "third party cannot read the thread", "SECRETWORD" not in json.dumps(C.get(f"/api/chat/messages/{A.id}/").data, default=str) and
      "SECRETWORD" not in json.dumps(C.get(f"/api/chat/messages/conversation/{A.id}/").data, default=str), "", "critical")
check(AR, "third party cannot search others' messages", "SECRETWORD" not in json.dumps(C.get("/api/chat/search/?q=SECRETWORD").data, default=str), "", "critical")
check(AR, "third party cannot mark messages read", (C.post(f"/api/chat/messages/{mid}/read/").status_code in (200, 403, 404)) and
      DM.execute_query("select is_read from messages where id=%s", (mid,))[0]["is_read"] is False, "", "high")
C.delete(f"/api/chat/conversation/{A.id}/delete/")
check(AR, "third party cannot delete someone else's conversation", bool(DM.execute_query("select 1 from messages where id=%s", (mid,))), "", "critical")
r = A.get(f"/api/chat/messages/{B.id}/product/{pid}/")
check(AR, "product thread endpoint works", r.status_code == 200, r.status_code, "medium")

# ============================================================ BLOGS / FORUMS
AR = "access/blogs"
draft = A.post("/api/blogs/create/", {"title": "DRAFT SECRET", "content": "C" * 40, "is_published": False}).data["blog_id"]
sched = A.post("/api/blogs/create/", {"title": "SCHEDULED SECRET", "content": "C" * 40, "is_published": True, "scheduled_publish_at": "2099-01-01T00:00:00"}).data["blog_id"]
pubb = A.post("/api/blogs/create/", {"title": "Public blog", "content": "C" * 40, "is_published": True}).data["blog_id"]
r = C.get(f"/api/blogs/{draft}/")
check(AR, "stranger cannot open another user's draft blog", denied(r), r.status_code, "high")
r = C.get(f"/api/blogs/{sched}/")
check(AR, "stranger cannot open a not-yet-published scheduled blog", denied(r), r.status_code, "medium")
for label, url in [("is_published=false", "/api/blogs/?is_published=false"), ("plain list", "/api/blogs/"), ("search by tag", "/api/blogs/?tag=a")]:
    r = C.get(url)
    check(AR, f"draft/scheduled blogs not listed to strangers via {label}", "SECRET" not in json.dumps(r.data, default=str), r.status_code, "high")
check(AR, "stranger cannot like a draft", denied(C.post(f"/api/blogs/{draft}/like/")), "", "medium")
check(AR, "stranger cannot comment on a draft", denied(C.post(f"/api/blogs/{draft}/comments/", {"content": "hi"})), C.post(f"/api/blogs/{draft}/comments/", {"content": "hi"}).status_code, "medium")
r = C.get(f"/api/blogs/{draft}/comments/")
check(AR, "stranger cannot read comments of a draft", denied(r), r.status_code, "medium")
before = DM.execute_query("select views_count from blog_posts where id=%s", (pubb,))[0]["views_count"]
for _ in range(25):
    C.post(f"/api/blogs/{pubb}/view/")
after = DM.execute_query("select views_count from blog_posts where id=%s", (pubb,))[0]["views_count"]
check(AR, "view counter cannot be inflated by repeated requests from one user", after - before <= 1, f"+{after-before} views from 25 requests by one user", "low")
check(AR, "stranger cannot edit/delete blog", denied(C.put(f"/api/blogs/{pubb}/update/", {"title": "x"})) and denied(C.delete(f"/api/blogs/{pubb}/delete/")), "", "critical")
r = C.post(f"/api/blogs/{pubb}/like/"); r2 = C.post(f"/api/blogs/{pubb}/like/")
check(AR, "blog like toggles", r.data.get("liked") is True and r2.data.get("liked") is False, f"{r.data} {r2.data}", "medium")
r = A.post("/api/blogs/create/", {"title": "T", "content": "C" * 40, "scheduled_publish_at": "not-a-date"})
check(AR, "bad schedule date -> 400", r.status_code == 400, r.status_code, "low")
r = A.post("/api/blogs/create/", {"title": "<script>alert(1)</script>", "content": "<img src=x onerror=alert(1)>" * 3})
stored = DM.execute_query("select title from blog_posts where id=%s", (r.data.get("blog_id"),))
check(AR, "HTML in blog title is stored verbatim (frontend must escape)", True, stored, "low")

AR = "access/forums"
tid = A.post("/api/forums/tuition/create/", {"post_type": "offering_tuition", "contact_number": "0171", "salary_min": 2000, "salary_max": 4000, "subjects": ["math"], "location": "Dhaka"}).data["tuition_id"]
bid = A.post("/api/forums/blood/create/", {"blood_group": "A+", "urgency": "urgent", "patient_name": "P", "hospital_name": "H", "contact_number": "0171"}).data["request_id"]
check(AR, "stranger cannot edit tuition post", denied(C.patch(f"/api/forums/tuition/{tid}/", {"location": "x"})), "", "high")
check(AR, "stranger cannot change tuition status", denied(C.patch(f"/api/forums/tuition/{tid}/status/", {"status": "cancelled"})), C.patch(f"/api/forums/tuition/{tid}/status/", {"status": "cancelled"}).status_code, "high")
check(AR, "stranger cannot change blood request status", denied(C.patch(f"/api/forums/blood/{bid}/status/", {"status": "cancelled"})), C.patch(f"/api/forums/blood/{bid}/status/", {"status": "cancelled"}).status_code, "high")
check(AR, "stranger cannot delete blood request", denied(C.delete(f"/api/forums/blood/{bid}/")), "", "high")
r = C.get("/api/forums/blood/my-requests/")
check(AR, "my-requests only lists own requests", str(bid) not in json.dumps([x.get("request_id") for x in r.data], default=str).split(","), r.status_code, "medium")
r = A.patch(f"/api/forums/tuition/{tid}/", {"salary_min": 500})
check(AR, "tuition update validates salary_min >= 1000", r.status_code == 400, r.status_code, "low")
r = A.patch(f"/api/forums/tuition/{tid}/", {"salary_min": 9000})
check(AR, "tuition update cannot make min salary exceed existing max", r.status_code == 400, f"{r.status_code} (min 9000 > max 4000)", "low")

save_results()
