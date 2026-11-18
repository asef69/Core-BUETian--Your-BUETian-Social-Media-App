# Backend QA suite

End-to-end security, abuse, feature and concurrency tests. They run the **real Django app** against a
**throw-away PostgreSQL** built from `sql/` (an embedded server, never your Supabase database).

## Run

```bash
pip install -r qa/requirements-qa.txt      # Python 3.10-3.12 (pgserver has no wheels for newer versions)
python qa/run_all.py                       # all modules, ~10 minutes
python qa/run_all.py auth regress          # a subset
```

Delete `qa/.pgdata` to start from an empty database. `qa/results.json` holds the last run.

| module | covers |
| --- | --- |
| `qa_auth` | JWT forgery/expiry, anonymous access sweep, mass assignment, headers, CORS, malformed bodies |
| `qa_idor` | who may read/change what: posts, follows, groups, marketplace, notifications, chat, blogs, forums |
| `qa_fuzz` | ~2,600 hostile requests (SQL injection, type confusion, NUL bytes, huge numbers) against every route |
| `qa_files` | every upload endpoint: fake extensions, path traversal, oversize, URL allow-list |
| `qa_features` | every feature end to end |
| `qa_contract` | each URL the React app calls exists and answers; frontend security smells |
| `qa_regress` | one check per fixed bug (rotation, lockout, privacy, pagination ...) |
| `qa_race` | parallel requests, rate limits, load, WebSockets |

The rate limits are switched off for functional modules (`NO_LIMITS`) and on (`PROD_RATES`) only
where a test is about throttling.

## Known limitations (deliberately not "fixed")

* **JWT in localStorage.** An XSS bug would expose the tokens. Moving to httpOnly cookies needs cross-site
  cookies between the Vercel frontend and the Render API, which browsers block, so it is not done.
  Mitigations: no raw-HTML/`eval` sinks (checked by `qa_contract`), rotating refresh tokens, logout revocation.
* **Account lockout can be abused** to lock a known email out for 15 minutes (8 wrong passwords). That is the
  usual trade-off against password guessing; tune `LOGIN_MAX_FAILURES` / `LOGIN_LOCKOUT_SECONDS`.
* **In-memory counters.** Rate limits and lockouts are per process unless `REDIS_URL` is set.
