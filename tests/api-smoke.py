#!/usr/bin/env python3
"""Validate bundled API routes in mock mode without third-party packages."""
from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)
PORT = 4402
BASE = f"http://127.0.0.1:{PORT}"


def request_json(path: str, payload: dict | None = None) -> tuple[int, dict]:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    request = Request(
        f"{BASE}{path}",
        data=data,
        method="GET" if payload is None else "POST",
        headers={"Content-Type": "application/json"},
    )
    with urlopen(request, timeout=10) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def wait_for_server(timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            status, _ = request_json("/api/health")
            if status == 200:
                return
        except (URLError, TimeoutError):
            time.sleep(0.15)
    raise RuntimeError("API 测试服务未在规定时间内启动。")


def main() -> int:
    env = os.environ.copy()
    env.update({"HOST": "127.0.0.1", "PORT": str(PORT), "API_MODE": "mock"})
    server = subprocess.Popen(
        ["node", "server.mjs"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    result: dict[str, object] = {"passed": False, "checks": []}
    try:
        wait_for_server()
        status, health = request_json("/api/health")
        assert status == 200 and health.get("ok") is True and health.get("apiMode") == "mock"
        result["checks"].append("GET /api/health")

        status, task_result = request_json(
            "/api/ai/generate-tasks",
            {"grade": "四年级", "minutes": 60, "focus": ["数学", "阅读"]},
        )
        tasks = task_result.get("tasks", [])
        assert status == 200 and 3 <= len(tasks) <= 5
        assert all(isinstance(item.get("reward"), dict) for item in tasks)
        result["checks"].append("POST /api/ai/generate-tasks")

        status, preview_result = request_json(
            "/api/ai/generate-preview",
            {
                "subject": "数学",
                "grade": "四年级",
                "edition": "人教版",
                "title": "角的度量（1）",
            },
        )
        lesson = preview_result.get("lesson", {})
        steps = lesson.get("steps", [])
        assert status == 200 and len(steps) == 6
        assert [step.get("id") for step in steps] == [
            "overview", "baseline", "understand", "verify", "transfer", "focus"
        ]
        result["checks"].append("POST /api/ai/generate-preview")

        result.update(
            {
                "passed": True,
                "apiMode": health.get("apiMode"),
                "generatedTaskCount": len(tasks),
                "generatedPreviewStepCount": len(steps),
            }
        )
        return_code = 0
    except Exception as error:  # noqa: BLE001
        result["error"] = repr(error)
        return_code = 1
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()
        if server.stdout:
            result["serverOutput"] = server.stdout.read()[-2000:]
        (REPORT_DIR / "api-smoke.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), "utf-8"
        )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
