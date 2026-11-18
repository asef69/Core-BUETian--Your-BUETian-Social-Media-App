"""Run every QA module in a fresh process and print the combined result.

    python qa/run_all.py            # from BACKEND/
    python qa/run_all.py auth idor  # only some modules
"""
import json, pathlib, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
MODULES = ["auth", "idor", "fuzz", "files", "features", "contract", "regress", "race"]
wanted = sys.argv[1:] or MODULES
results = HERE / "results.json"
if not sys.argv[1:] and results.exists():
    results.unlink()
for name in wanted:
    print(f"\n##### qa_{name}")
    subprocess.run([sys.executable, str(HERE / f"qa_{name}.py")], cwd=HERE, env={**__import__("os").environ, "PYTHONPATH": str(HERE)})
data = json.loads(results.read_text()) if results.exists() else {"fails": [], "passes": 0}
print(f"\n==== {data['passes']} passed, {len(data['fails'])} failed")
for f in sorted(data["fails"], key=lambda f: ("critical high medium low".split().index(f["sev"]), f["area"])):
    print(f"[{f['sev']}] {f['area']}: {f['name']} :: {f['detail'][:160]}")
sys.exit(1 if data["fails"] else 0)
