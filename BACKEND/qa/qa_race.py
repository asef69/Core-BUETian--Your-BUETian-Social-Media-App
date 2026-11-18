"""Concurrency, rate-limit, DoS and WebSocket tests."""
import threading, time, json, asyncio
from qa_base import *
from django.db import connections

AREA = "race"
print("== CONCURRENCY / RATE LIMITS / WEBSOCKET")

def par(fn, n, *args):
    out = [None] * n
    def run(i):
        try:
            out[i] = fn(i, *args)
        except Exception as e:
            out[i] = ("EXC", repr(e)[:150])
        finally:
            connections.close_all()
    ts = [threading.Thread(target=run, args=(i,)) for i in range(n)]
    [t.start() for t in ts]; [t.join() for t in ts]
    return out

# ---- duplicate registration race
email = f"race{random.randint(1,10**8) if False else int(time.time())}@qa.test"
import random
def reg(i):
    r = anon().post("/api/users/register/", {"student_id": 9100000 + int(time.time()) % 1000, "name": "Racer", "email": email, "password": "Str0ngPass!word"})
    return r.status_code
res = par(reg, 8)
n = DM.execute_query("select count(*) c from users where email=%s", (email,))[0]["c"]
check(AREA, "parallel registrations of the same email create exactly one account", n == 1, f"{n} accounts, statuses {res}", "high")
check(AREA, "losing registrations get a clean 4xx, never a 5xx", all(isinstance(s, int) and s < 500 for s in res), res, "high")

A = mkuser("rc_a"); B = mkuser("rc_b"); C = mkuser("rc_c")
# ---- follow toggle race
def follow(i): return B.post(f"/api/users/follow/{A.id}/").status_code
res = par(follow, 10)
rows = DM.execute_query("select count(*) c from follows where follower_id=%s and following_id=%s", (B.id, A.id))[0]["c"]
check(AREA, "10 parallel follow toggles leave at most one follow row and no 5xx", rows <= 1 and all(isinstance(s, int) and s < 500 for s in res), f"rows={rows} statuses={res}", "medium")
# ---- like race
post = A.post("/api/posts/create/", {"content": "race post"}).data["post_id"]
def like(i): return C.post(f"/api/posts/{post}/like/").status_code
res = par(like, 12)
rows = DM.execute_query("select count(*) c from likes where post_id=%s", (post,))[0]["c"]
cnt = DM.execute_query("select likes_count from posts where id=%s", (post,))[0]["likes_count"]
check(AREA, "parallel like toggles keep likes_count equal to like rows", rows == cnt, f"rows={rows} likes_count={cnt}", "medium")
check(AREA, "parallel likes never 5xx", all(isinstance(s, int) and s < 500 for s in res), res, "medium")
# ---- comment counter race
def cm(i): return B.post(f"/api/posts/{post}/comments/", {"content": f"c{i}"}).status_code
res = par(cm, 10)
rows = DM.execute_query("select count(*) c from comments where post_id=%s", (post,))[0]["c"]
cnt = DM.execute_query("select comments_count from posts where id=%s", (post,))[0]["comments_count"]
check(AREA, "parallel comments keep comments_count correct", rows == cnt == res.count(201), f"rows={rows} counter={cnt} created={res.count(201)}", "medium")
# ---- group join race
g = A.post("/api/groups/create/", {"name": "RaceG", "is_private": "true"}, fmt="multipart").data["group_id"]
def join(i): return C.post(f"/api/groups/{g}/join/").status_code
res = par(join, 8)
rows = DM.execute_query("select count(*) c from group_members where group_id=%s and user_id=%s", (g, C.id))[0]["c"]
check(AREA, "parallel join requests create one membership row", rows == 1 and all(isinstance(s, int) and s < 500 for s in res), f"rows={rows} {res}", "medium")
nn = DM.execute_query("select count(*) c from notifications where user_id=%s and notification_type='group_join_request'", (A.id,))[0]["c"]
check(AREA, "parallel join requests notify the admin once", nn == 1, f"{nn} notifications", "low")
# ---- double sell / double confirm
pid = A.post("/api/marketplace/products/create/", {"title": "Race item", "price": "5", "condition": "good"}).data["product_id"]
def sell(i): return A.post(f"/api/marketplace/products/{pid}/mark-sold/", {"buyer_id": B.id}).status_code
res = par(sell, 6)
check(AREA, "parallel mark-sold never 5xx", all(isinstance(s, int) and s < 500 for s in res), res, "medium")
def conf(i): return B.post(f"/api/marketplace/transactions/{pid}/confirm/", {"buyer_id": B.id, "role": "buyer"}).status_code
res = par(conf, 6)
n = DM.execute_query("select count(*) c from buyer_seller_transactions where product_id=%s", (pid,))[0]["c"]
check(AREA, "parallel confirmations create a single transaction row", n == 1 and all(isinstance(s, int) and s < 500 for s in res), f"rows={n} {res}", "medium")
# ---- review race (unique buyer/product)
def rev(i): return B.post(f"/api/marketplace/products/{pid}/reviews/", {"rating": 4, "review_text": "x"}).status_code
res = par(rev, 6)
n = DM.execute_query("select count(*) c from product_reviews where product_id=%s", (pid,))[0]["c"]
check(AREA, "parallel reviews by one buyer leave one review", n == 1 and all(isinstance(s, int) and s < 500 for s in res), f"rows={n} {res}", "medium")

# ---- rate limiting
set_rates(dict(PROD_RATES, auth="5/min"))
codes = [anon().post("/api/users/login/", {"email": "nobody@x.com", "password": "bad"}).status_code for _ in range(8)]
check(AREA, "login throttled after 5 attempts/min per client", 429 in codes, codes, "high")
cache.clear()
victim = A.email
codes = []
for i in range(40):
    r = anon().api.post("/api/users/login/", {"email": victim, "password": f"guess{i}"}, format="json", HTTP_X_FORWARDED_FOR=f"10.1.{i}.1")
    codes.append(r.status_code)
check(AREA, "repeated failed logins for ONE account are blocked regardless of IP (account lockout)", 429 in codes or 423 in codes, f"{codes.count(401)} wrong-password attempts accepted for the same account", "medium",
      "Add per-account throttling / lockout")
set_rates(NO_LIMITS)
u = mkuser("spammer")
set_rates(PROD_RATES)
codes = [u.post("/api/posts/create/", {"content": f"spam {i}"}).status_code for i in range(80)]
check(AREA, "post creation is rate limited (80 posts in a burst)", 429 in codes, f"{codes.count(201)} created, 0 throttled", "medium", "Add DRF throttling for write endpoints")
codes = [u.post(f"/api/users/follow/{B.id}/").status_code for _ in range(70)]
check(AREA, "follow/unfollow toggling is rate limited (60/min)", 429 in codes, "70 toggles accepted", "low")
befriend(u, B)
codes = [u.post("/api/chat/send/", {"receiver_id": B.id, "content": "x"}).status_code for _ in range(130)]
check(AREA, "chat sending is rate limited (120/min)", 429 in codes, f"{codes.count(201)} accepted, none throttled", "low")
set_rates(NO_LIMITS)
# search abuse
t0 = time.time()
for _ in range(20): u.get("/api/users/search/?q=a")
check(AREA, "20 searches complete quickly", time.time() - t0 < 10, f"{time.time()-t0:.1f}s", "low")

# ---- load: big tables
print("seeding 4000 posts / 4000 comments for load check ...")
DM.execute_update("INSERT INTO posts(user_id,content,visibility) SELECT %s,'load post '||g,'public' FROM generate_series(1,4000) g", (A.id,))
DM.execute_update("INSERT INTO comments(post_id,user_id,content) SELECT %s,%s,'load c'||g FROM generate_series(1,4000) g", (post, B.id))
befriend(A, u)
for label, url, limit in [("feed", "/api/posts/feed/?limit=200", 3), ("public feed", "/api/posts/public/?limit=200", 3), ("trending", "/api/posts/trending/?limit=200", 3),
                          ("profile posts", f"/api/users/{A.id}/posts/?limit=200", 3), ("comments of a 4000-comment post", f"/api/posts/{post}/comments/", 3),
                          ("search posts", "/api/posts/search/?q=load&limit=200", 3), ("hashtag trending", "/api/posts/hashtags/trending/", 2)]:
    t0 = time.time(); r = u.get(url); dt = time.time() - t0
    check(AREA, f"{label} responds in <{limit}s with large data", r.status_code == 200 and dt < limit, f"{dt:.1f}s status {r.status_code}", "medium")
r = u.get(f"/api/posts/{post}/comments/")
check(AREA, "comment list is paginated/capped (4000 comments returned in one response)", len(r.data) <= 500, f"{len(r.data)} comments in one response", "medium", "Unbounded comment list")
r = u.get("/api/posts/feed/?limit=100000")
check(AREA, "huge limit is capped", len(r.data) <= 200, len(r.data), "medium")

# ---- WebSocket
from channels.testing import WebsocketCommunicator
from chat.consumers import ChatConsumer
from channels.db import database_sync_to_async as dsa
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
W1 = mkuser("ws1"); W2 = mkuser("ws2"); W3 = mkuser("ws3"); befriend(W1, W2)
def tok(i):
    t = AccessToken(); t["user_id"] = i; return str(t)

import chat.consumers as _cc
_cc.ACTIVE_RECHECK_SECONDS = 0   # re-check the account on every frame in this test

async def ws():
    res = {}
    c = WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/")
    ok_, _ = await c.connect(); res["no_token_rejected"] = not ok_
    c = WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/?token=garbage")
    ok_, _ = await c.connect(); res["bad_token_rejected"] = not ok_
    c = WebsocketCommunicator(ChatConsumer.as_asgi(), f"/ws/chat/?token={str(RefreshToken.for_user.__self__) if False else ''}")
    ok_, _ = await c.connect(); res["empty_token_rejected"] = not ok_
    rt = RefreshToken(); rt["user_id"] = W1.id
    c = WebsocketCommunicator(ChatConsumer.as_asgi(), f"/ws/chat/?token={str(rt)}")
    ok_, _ = await c.connect(); res["refresh_token_rejected"] = not ok_
    c1 = WebsocketCommunicator(ChatConsumer.as_asgi(), f"/ws/chat/?token={tok(W1.id)}")
    c2 = WebsocketCommunicator(ChatConsumer.as_asgi(), f"/ws/chat/?token={tok(W2.id)}")
    c3 = WebsocketCommunicator(ChatConsumer.as_asgi(), f"/ws/chat/?token={tok(W3.id)}")
    for c_ in (c1, c2, c3):
        ok_, _ = await c_.connect(); await c_.receive_json_from()
    await c1.send_json_to({"type": "chat_message", "receiver_id": W2.id, "content": "ws hello"})
    m1 = await c1.receive_json_from(); m2 = await c2.receive_json_from()
    res["delivery"] = (m1.get("type"), m2.get("type"), m2.get("message", {}).get("content"))
    await c1.send_json_to({"type": "chat_message", "receiver_id": W3.id, "content": "stranger"})
    res["stranger_blocked"] = (await c1.receive_json_from()).get("type") == "error"
    await c3.send_json_to({"type": "typing", "receiver_id": W1.id, "is_typing": True})
    await asyncio.sleep(0.3); res["typing_to_non_friend_silent"] = await c1.receive_nothing()
    await c1.send_json_to({"type": "typing", "receiver_id": W2.id, "is_typing": True})
    res["typing_delivered"] = (await c2.receive_json_from()).get("type") == "typing"
    c1.scope  # noqa
    await c1.send_to(text_data="{not json")
    res["bad_json"] = (await c1.receive_json_from()).get("type") == "error"
    await c1.send_to(text_data="[1,2,3]")
    res["json_array"] = (await c1.receive_json_from()).get("type") == "error"
    await c1.send_json_to({"type": "chat_message", "receiver_id": W2.id, "content": "x" * 100000})
    res["huge_message"] = (await c1.receive_json_from()).get("type") == "error"
    await c1.send_json_to({"type": "unknown_type"})
    res["unknown_type_ignored"] = await c1.receive_nothing()
    # flooding: 200 messages in a burst
    sent = 0
    for i in range(200):
        await c1.send_json_to({"type": "chat_message", "receiver_id": W2.id, "content": f"flood {i}"})
    await asyncio.sleep(2)
    n = await dsa(lambda: DM.execute_query("select count(*) c from messages where sender_id=%s and content like 'flood%%'", (W1.id,))[0]["c"])()
    res["flood_stored"] = n
    # user switches off after account deactivation while connected
    await dsa(lambda: DM.execute_update("UPDATE users SET is_active=FALSE WHERE id=%s", (W1.id,)))()
    await c1.send_json_to({"type": "chat_message", "receiver_id": W2.id, "content": "after deactivation"})
    out = None
    try:
        while True:   # skip frames queued by the flood above; look for the close frame
            out = await asyncio.wait_for(c1.receive_output(), 3)
            if out.get("type") == "websocket.close":
                break
    except Exception:
        pass
    await dsa(lambda: DM.execute_update("UPDATE users SET is_active=TRUE WHERE id=%s", (W1.id,)))()
    res["deactivated_live_socket_blocked"] = (out or {}).get("type") == "websocket.close" and not await dsa(lambda: DM.execute_query("select 1 from messages where content='after deactivation'"))()
    # a token that expires while the socket is open
    from datetime import timedelta
    short = AccessToken(); short["user_id"] = W2.id; short.set_exp(lifetime=timedelta(seconds=2))
    cx = WebsocketCommunicator(ChatConsumer.as_asgi(), f"/ws/chat/?token={str(short)}")
    ok_, _ = await cx.connect(); await cx.receive_json_from()
    await asyncio.sleep(3)
    await cx.send_json_to({"type": "chat_message", "receiver_id": W1.id, "content": "late"})
    out = {}
    try:
        while True:   # skip chat frames queued earlier
            out = await asyncio.wait_for(cx.receive_output(), 3)
            if out.get("type") == "websocket.close" or "expired" in out.get("text", "").lower():
                break
    except Exception:
        pass
    res["expired_token_socket_closed"] = (out.get("type") == "websocket.send" and "expired" in out.get("text", "").lower()) or out.get("type") == "websocket.close"
    for c_ in (c1, c2, c3):
        await c_.disconnect()
    return res
r = asyncio.run(ws())
check(AREA, "WS: connection without token rejected", r["no_token_rejected"], "", "high")
check(AREA, "WS: garbage token rejected", r["bad_token_rejected"], "", "high")
check(AREA, "WS: refresh token rejected", r["refresh_token_rejected"], "", "high")
check(AREA, "WS: friends exchange messages in real time", r["delivery"] == ("message_sent", "chat_message", "ws hello"), r["delivery"], "high")
check(AREA, "WS: stranger messaging blocked", r["stranger_blocked"], "", "high")
check(AREA, "WS: typing from a non-friend is not delivered", r["typing_to_non_friend_silent"], "", "medium")
check(AREA, "WS: typing delivered between friends", r["typing_delivered"], "", "low")
check(AREA, "WS: malformed JSON answered with an error, socket survives", r["bad_json"], "", "medium")
check(AREA, "WS: JSON array payload handled", r["json_array"], "", "medium")
check(AREA, "WS: 100KB message rejected", r["huge_message"], "", "medium")
check(AREA, "WS: unknown message type ignored safely", r["unknown_type_ignored"], "", "low")
check(AREA, "WS: message flooding is rate limited (200 messages in a burst)", r["flood_stored"] < 100, f"{r['flood_stored']} of 200 stored", "medium", "Add per-connection rate limit")
check(AREA, "WS: account deactivated while connected cannot keep sending", r["deactivated_live_socket_blocked"], "", "medium")
check(AREA, "WS: a socket whose token expired is told so and closed", r["expired_token_socket_closed"], "", "medium")

save_results()
