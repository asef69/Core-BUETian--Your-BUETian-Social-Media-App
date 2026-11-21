"""Password hashing tuned for small servers.

Django's default (PBKDF2-SHA256, 600,000 rounds) takes ~0.4 s of CPU on a desktop and several
seconds on a shared / serverless CPU, which is what made login and sign-up feel slow.
Argon2id with OWASP's recommended minimum settings (19 MiB, 2 passes, 1 lane) is both a
stronger algorithm and ~20x cheaper. Old PBKDF2 hashes keep working and are re-hashed to
Argon2 automatically the next time their owner logs in (see users/auth_views.py).
"""
from django.contrib.auth.hashers import Argon2PasswordHasher


class FastArgon2PasswordHasher(Argon2PasswordHasher):
    time_cost = 2
    memory_cost = 19456   # KiB (19 MiB)
    parallelism = 1
