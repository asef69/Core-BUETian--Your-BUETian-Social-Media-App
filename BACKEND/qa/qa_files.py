"""File-upload security and functionality tests on every upload entry point."""
import io, os, struct, zlib, tempfile, glob
from qa_base import *
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings

AREA = "uploads"
print("== FILE UPLOADS")
tmp = tempfile.mkdtemp(prefix="qa_media_")
settings.MEDIA_ROOT = tmp
settings.CLOUDINARY_ENABLED = False

A = mkuser("up_a"); B = mkuser("up_b"); befriend(A, B)

def png():
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    raw = b"\x00\xff\x00\x00"
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 60 + b"\xff\xd9"
GIF = b"GIF89a" + b"\x00" * 30
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 20
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 40
HTML = b"<html><script>alert(1)</script></html>"
PHP = b"<?php system($_GET['c']); ?>"
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'
EXE = b"MZ\x90\x00" + b"\x00" * 60

def f(name, data, ct="image/png"):
    return SimpleUploadedFile(name, data, content_type=ct)

ENDPOINTS = [
    ("profile picture", lambda fl: A.post("/api/users/profile/upload-picture/", {"profile_picture": fl}, fmt="multipart"), "image"),
    ("chat image", lambda fl: A.post("/api/chat/upload-image/", {"image": fl}, fmt="multipart"), "image"),
    ("marketplace upload-image", lambda fl: A.post("/api/marketplace/upload-image/", {"image": fl}, fmt="multipart"), "image"),
    ("post upload-media", lambda fl: A.post("/api/posts/upload-media/", {"media": fl}, fmt="multipart"), "image"),
    ("post media_files", lambda fl: A.post("/api/posts/create/", {"content": "pic", "media_files": fl}, fmt="multipart"), "image"),
    ("group cover", lambda fl: A.post("/api/groups/create/", {"name": "CoverG", "cover_image": fl}, fmt="multipart"), "image"),
    ("product images", lambda fl: A.post("/api/marketplace/products/create/", {"title": "Img", "price": "5", "images": fl}, fmt="multipart"), "image"),
    ("registration picture", lambda fl: anon().post("/api/users/register/", {"student_id": random.randint(30000000, 39999999), "name": "Reg", "email": f"reg{random.randint(1,10**9)}@qa.test",
                                                                           "password": "Str0ngPass!word", "profile_picture": fl}, fmt="multipart"), "image"),
]
import random

def accepted(r):
    return r.status_code in (200, 201) and not (isinstance(r.data, dict) and r.data.get("errors"))

def stored_urls(r):
    d = json.dumps(r.data, default=str) if hasattr(r, "data") else ""
    return d
import json

SILENT = []
for label, call, kind in ENDPOINTS:
    ok = call(f("ok.png", png()))
    check(AREA, f"{label}: valid PNG accepted", accepted(ok), f"{ok.status_code} {str(getattr(ok,'data',''))[:120]}", "high")
    for case, name, data, ct, must_reject, sev in [
        ("HTML renamed .png", "x.png", HTML, "image/png", True, "high"),
        ("PHP renamed .jpg", "shell.jpg", PHP, "image/jpeg", True, "critical"),
        ("SVG with script as .png", "a.png", SVG, "image/png", True, "high"),
        ("executable renamed .png", "a.png", EXE, "image/png", True, "high"),
        (".svg extension", "a.svg", SVG, "image/svg+xml", True, "high"),
        (".html extension", "a.html", HTML, "text/html", True, "high"),
        (".php extension", "a.php", PHP, "application/x-php", True, "high"),
        ("no extension", "noext", png(), "image/png", True, "low"),
        ("empty file", "empty.png", b"", "image/png", True, "low"),
        ("double extension shell.php.png with PHP body", "shell.php.png", PHP, "image/png", True, "high"),
        ("extension/content mismatch (GIF body as .png)", "m.png", GIF, "image/png", False, "low"),
        ("uppercase extension", "UP.PNG", png(), "image/png", False, "low"),
    ]:
        r = call(f(name, data, ct))
        acc = accepted(r)
        if label == "post media_files":
            pid_ = (r.data or {}).get("post_id") if hasattr(r, "data") and isinstance(r.data, dict) else None
            stored = DM.execute_query("select count(*) c from media_urls where post_id=%s", (pid_,))[0]["c"] if pid_ else 0
            if r.status_code in (200, 201) and not stored:
                SILENT.append(case)
            acc = stored > 0
        if must_reject:
            check(AREA, f"{label}: rejects {case}", not acc and r.status_code < 500, f"{r.status_code} {str(getattr(r,'data',''))[:100]}", sev)
        else:
            check(AREA, f"{label}: handles {case} (no 5xx)", r.status_code < 500, r.status_code, sev)
    for case, name in [("path traversal filename", "../../../evil.png"), ("backslash traversal", "..\\..\\evil.png"), ("null byte in name", "a\x00.php.png"),
                       ("500-char filename", "a" * 500 + ".png"), ("unicode/RTL name", "‮gnp.png")]:
        r = call(f(name, png()))
        check(AREA, f"{label}: {case} handled safely (no 5xx)", r.status_code < 500, f"{r.status_code} {str(getattr(r,'data',''))[:100]}", "medium")
        escaped = glob.glob(os.path.join(os.path.dirname(tmp), "evil*")) + glob.glob(os.path.join(tmp, "..", "evil*"))
        check(AREA, f"{label}: {case} cannot write outside media dir", not escaped, escaped, "critical")
    big = call(f("big.png", png() + b"\x00" * (6 * 1024 * 1024)))
    check(AREA, f"{label}: oversize (6MB) image rejected", not accepted(big) and big.status_code < 500, f"{big.status_code}", "medium")

check(AREA, "post create reports an error when an attachment is rejected (instead of silently creating a post without it)", not SILENT, f"{len(SILENT)} rejected attachments were silently dropped, post still returned 201 (e.g. {SILENT[:3]})", "medium")
# videos
vid_endpoints = [("chat video", lambda fl: A.post("/api/chat/upload-video/", {"video": fl}, fmt="multipart"))]
for label, call in vid_endpoints:
    check(AREA, f"{label}: valid MP4 accepted", accepted(call(f("v.mp4", MP4, "video/mp4"))), "", "medium")
    check(AREA, f"{label}: HTML as .mp4 rejected", not accepted(call(f("v.mp4", HTML, "video/mp4"))), "", "high")
    check(AREA, f"{label}: .exe rejected", not accepted(call(f("v.exe", EXE, "application/octet-stream"))), "", "high")
    r = call(f("big.mp4", MP4 + b"\x00" * (51 * 1024 * 1024), "video/mp4"))
    check(AREA, f"{label}: oversize (51MB) video rejected", not accepted(r) and r.status_code < 500, r.status_code, "medium")

# multi-file abuse
files = [f(f"m{i}.png", png()) for i in range(60)]
r = A.post("/api/posts/create/", {"content": "many files", "media_files": files}, fmt="multipart")
n = DM.execute_query("select count(*) c from media_urls m join posts p on p.id=m.post_id where p.content='many files'")[0]["c"]
check(AREA, "post accepts a sane maximum number of media files (60 uploaded in one request)", n <= 20, f"{n} media rows stored for one post", "medium", "Cap files per post")
r = A.post("/api/marketplace/products/create/", {"title": "ManyImg", "price": "5", "images": [f(f"i{i}.png", png()) for i in range(30)]}, fmt="multipart")
check(AREA, "product rejects >10 images", r.status_code == 400, r.status_code, "low")

# upload authorization / ownership
check(AREA, "upload endpoints require login", all(anon().post(u, {}, fmt="multipart").status_code in (401, 403) for u in
      ("/api/users/profile/upload-picture/", "/api/chat/upload-image/", "/api/chat/upload-video/", "/api/marketplace/upload-image/", "/api/posts/upload-media/")), "", "high")
# media_url (pre-uploaded urls) validation on posts / chat
for label, url, body in [("post media_urls", "/api/posts/create/", {"content": "x", "media_urls": ["javascript:alert(1)"]}),
                         ("post media_urls data:", "/api/posts/create/", {"content": "x", "media_urls": ["data:text/html,<script>alert(1)</script>"]}),
                         ("chat media_url", "/api/chat/send/", {"receiver_id": B.id, "content": "x", "media_url": "javascript:alert(1)"}),
                         ("group post media_urls", "/api/groups/1/posts/create/", {"content": "x", "media_urls": ["javascript:alert(1)"]}),
                         ("profile_picture url", "/api/users/profile/update/", {"profile_picture": "javascript:alert(1)"})]:
    r = A.post(url, body) if "update" not in url else A.patch(url, body)
    check(AREA, f"{label}: javascript:/data: URL rejected", r.status_code in (400, 403, 404), r.status_code, "high")
# external URL allowed -> tracking pixel / SSRF-free; informational
r = A.patch("/api/users/profile/update/", {"profile_picture": "http://169.254.169.254/latest/meta-data/"})
check(AREA, "profile_picture may point at arbitrary external/internal URLs (tracking pixel risk)", r.status_code in (400,), f"{r.status_code} accepted", "low",
      "Restrict to the app's own storage host (Cloudinary / MEDIA_URL)")
# files really not served from the app server in production
r = A.api.get("/media/profile_pictures/anything.png")
check(AREA, "uploaded media is not served by Django in production (use Cloudinary/CDN)", r.status_code == 404, r.status_code, "low")

import shutil
leftover = sum(len(files) for _, _, files in os.walk(tmp))
shutil.rmtree(tmp, ignore_errors=True)
save_results()
