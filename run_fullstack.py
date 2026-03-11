#!/usr/bin/env python3
"""Run backend (Django) and frontend (Vite) together.

Usage:
  python run_fullstack.py
  python run_fullstack.py --backend-cmd "python manage.py runserver 0.0.0.0:8000" --frontend-cmd "npm run dev -- --host"
"""

from __future__ import annotations

import argparse
import os
import shlex
import signal
import subprocess
import sys
import threading
import time
import shutil
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "BACKEND"
FRONTEND_DIR = ROOT_DIR / "FRONTEND"


def split_command(command: str) -> list[str]:
    # Use Windows-friendly splitting when running on Windows.
    return shlex.split(command, posix=(os.name != "nt"))


def resolve_command(command: list[str], cwd: Path) -> list[str]:
    if not command:
        return command

    executable = command[0]
    if os.path.isabs(executable) and Path(executable).exists():
        return command

    resolved = shutil.which(executable)
    if resolved:
        command[0] = resolved
        return command

    if os.name == "nt":
        for ext in (".cmd", ".bat", ".exe"):
            resolved_with_ext = shutil.which(f"{executable}{ext}")
            if resolved_with_ext:
                command[0] = resolved_with_ext
                return command

        # Windows often exposes tools like npm as .cmd/.bat shims.
        # If direct resolution fails, execute via cmd so shell shims work.
        cmdline = subprocess.list2cmdline(command)
        return ["cmd", "/c", cmdline]

    return command


def build_backend_command(raw_command: str) -> list[str]:
    command = split_command(raw_command)

    if not command:
        return command

    # Prefer project venv interpreter when using plain "python ...".
    if command[0].lower() == "python":
        venv_python = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
        if venv_python.exists():
            command[0] = str(venv_python)

    return command


def stream_output(prefix: str, pipe) -> None:
    for line in iter(pipe.readline, ""):
        print(f"[{prefix}] {line.rstrip()}")
    pipe.close()


def start_process(name: str, command: list[str], cwd: Path) -> subprocess.Popen:
    kwargs: dict = {
        "cwd": str(cwd),
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "text": True,
        "bufsize": 1,
    }

    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["preexec_fn"] = os.setsid

    process = subprocess.Popen(command, **kwargs)

    thread = threading.Thread(
        target=stream_output,
        args=(name, process.stdout),
        daemon=True,
    )
    thread.start()

    return process


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return

    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except Exception:
        process.terminate()

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run backend and frontend together")
    parser.add_argument(
        "--backend-cmd",
        default="python manage.py runserver",
        help="Command to start backend from BACKEND directory",
    )
    parser.add_argument(
        "--frontend-cmd",
        default="npm run dev",
        help="Command to start frontend from FRONTEND directory",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not BACKEND_DIR.exists() or not FRONTEND_DIR.exists():
        print("Expected BACKEND/ and FRONTEND/ folders in the project root.")
        return 1

    backend_cmd = build_backend_command(args.backend_cmd)
    frontend_cmd = split_command(args.frontend_cmd)

    backend_cmd = resolve_command(backend_cmd, BACKEND_DIR)
    frontend_cmd = resolve_command(frontend_cmd, FRONTEND_DIR)

    print(f"Starting backend in: {BACKEND_DIR}")
    print(f"Command: {' '.join(backend_cmd)}")
    backend_process = start_process("BACKEND", backend_cmd, BACKEND_DIR)

    print(f"Starting frontend in: {FRONTEND_DIR}")
    print(f"Command: {' '.join(frontend_cmd)}")
    frontend_process = start_process("FRONTEND", frontend_cmd, FRONTEND_DIR)

    processes = [backend_process, frontend_process]

    try:
        while True:
            for process in processes:
                if process.poll() is not None:
                    print("A process exited. Shutting down the other process...")
                    for other in processes:
                        if other is not process:
                            stop_process(other)
                    return process.returncode or 0
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping both services...")
        for process in processes:
            stop_process(process)
        return 0


if __name__ == "__main__":
    sys.exit(main())
