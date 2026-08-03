#!/usr/bin/env python3
"""Optional browser smoke test for AI学习冒险基地.

Requires Python Playwright and a Chromium executable. The test starts the bundled
Node server in mock mode, serves frontend assets through Playwright routing (to
work in restricted CI environments), exercises core interactions, and writes a
JSON report under reports/.
"""
from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"
REPORT_DIR.mkdir(exist_ok=True)
PORT = 4399
BASE = f"http://127.0.0.1:{PORT}"


def wait_for_server(timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(f"{BASE}/api/health", timeout=0.5) as response:
                if response.status == 200:
                    return
        except (URLError, TimeoutError):
            time.sleep(0.15)
    raise RuntimeError("本地测试服务未在规定时间内启动。")


def content_type(path: Path) -> str:
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def main() -> int:
    server_env = os.environ.copy()
    server_env.update({"HOST": "127.0.0.1", "PORT": str(PORT), "API_MODE": "mock"})
    server = subprocess.Popen(
        ["node", "server.mjs"],
        cwd=ROOT,
        env=server_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    result: dict[str, object] = {
        "passed": False,
        "checks": [],
        "consoleErrors": [],
        "viewport": {"desktop": [1440, 1080], "mobile": [390, 844]},
    }

    try:
        wait_for_server()
        index = (ROOT / "index.html").read_text("utf-8").replace(
            "<head>", '<head><base href="https://assets.local/">', 1
        )

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
                args=["--no-sandbox"],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 1080})
            console_errors: list[str] = []
            page.on(
                "console",
                lambda message: console_errors.append(
                    f"console {message.type}: {message.text}"
                )
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: console_errors.append(f"pageerror: {error}"))

            # about:blank does not expose native localStorage in this environment.
            # A standards-compatible in-memory substitute is sufficient for smoke tests.
            page.evaluate(
                """() => {
                  const store = {};
                  Object.defineProperty(window, 'localStorage', {
                    configurable: true,
                    value: {
                      getItem: key => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
                      setItem: (key, value) => { store[key] = String(value); },
                      removeItem: key => { delete store[key]; },
                      clear: () => { Object.keys(store).forEach(key => delete store[key]); }
                    }
                  });
                }"""
            )

            def route_handler(route) -> None:
                parsed = urlparse(route.request.url)
                if parsed.path.startswith("/api/"):
                    payload = (route.request.post_data or "").encode()
                    request = Request(
                        f"{BASE}{parsed.path}",
                        data=payload,
                        method=route.request.method,
                        headers={"Content-Type": "application/json"},
                    )
                    try:
                        with urlopen(request, timeout=10) as response:
                            route.fulfill(
                                status=response.status,
                                body=response.read(),
                                headers={"content-type": "application/json"},
                            )
                    except HTTPError as error:
                        route.fulfill(
                            status=error.code,
                            body=error.read(),
                            headers={"content-type": "application/json"},
                        )
                    return

                relative = unquote(parsed.path.lstrip("/"))
                file_path = (ROOT / relative).resolve()
                if (
                    not str(file_path).startswith(str(ROOT.resolve()))
                    or not file_path.exists()
                    or file_path.is_dir()
                ):
                    route.fulfill(status=404, body="not found")
                    return
                route.fulfill(
                    status=200,
                    body=file_path.read_bytes(),
                    content_type=content_type(file_path),
                )

            page.route("https://assets.local/**", route_handler)
            page.set_content(index, wait_until="networkidle")

            assert page.get_by_text("今天的学习冒险", exact=True).count() == 1
            result["checks"].append("首页加载")

            page.locator('[data-action="open-profile"]').last.click()
            page.locator('input[name="childName"]').fill("小七")
            page.locator('input[name="mascotName"]').fill("星仔")
            page.locator('[data-action="save-profile"]').click()
            assert page.locator("text=小七").count() >= 1
            assert page.locator("text=星仔").count() >= 1
            result["checks"].append("儿童档案与吉祥物名称同步")

            page.locator('.nav-list [data-route="tasks"]').click()
            initial = page.locator(".task-row").count()
            page.locator('[data-action="open-manual-task"]').click()
            page.locator('input[name="title"]').fill("家庭数学口述任务")
            page.locator('input[name="evidenceRule"]').fill(
                "用自己的话解释一道题的数量关系"
            )
            page.locator('[data-action="save-manual-task"]').click()
            assert page.get_by_text("家庭数学口述任务", exact=True).count() >= 1
            result["checks"].append("手动添加任务")
            result["manualTaskCounts"] = {
                "before": initial,
                "after": page.locator(".task-row").count(),
            }

            before_generate = page.locator(".task-row").count()
            page.locator(
                '[data-action="generate-tasks"][data-form="quick-generator-form"]'
            ).click()
            page.wait_for_timeout(650)
            after_generate = page.locator(".task-row").count()
            assert after_generate > before_generate
            result["checks"].append("服务端 Mock 生成任务")

            page.locator('[data-action="open-task"]').first.click()
            page.locator('textarea[name="evidence"]').fill(
                "我完成了任务，并用自己的话解释了关键步骤。"
            )
            page.locator('input[name="progress"]').fill("100")
            page.locator('[data-action="complete-task"]').click()
            result["checks"].append("任务证据与完成奖励")

            page.locator('.nav-list [data-route="preview"]').click()
            page.wait_for_timeout(500)
            preview = page.locator("six-step-preview")
            assert preview.locator("#sixStepNav .step-nav-btn").count() == 6
            assert preview.locator("#knowledgeMap .knowledge-node").count() == 7
            preview.locator("#completeOverviewBtn").click()
            preview.locator("#pretestStage .choice-btn").nth(1).click()
            preview.locator("#pretestStage .btn-primary").click()
            preview.locator("#pretestStage .choice-btn").nth(1).click()
            preview.locator("#pretestStage .btn-primary").click()
            preview.locator("#pretestStage .btn-primary").click()
            preview.locator("#socraticStage .choice-btn").nth(1).click()
            assert preview.locator("#socraticStage .feedback.good").count() == 1
            result["checks"].append("六步预习逐题交互与苏格拉底引导")

            page.locator('.nav-list [data-route="map"]').click()
            page.locator('[data-action="open-region"]').first.click()
            assert page.locator(".modal").count() == 1
            page.locator(".close-button").click()
            result["checks"].append("地图区域交互")

            page.locator('.nav-list [data-route="archive"]').click()
            with page.expect_download() as download_info:
                page.locator('[data-action="export-data"]').first.click()
            assert download_info.value.suggested_filename.endswith(".json")
            result["checks"].append("成长数据导出")

            assert not console_errors, console_errors
            result["consoleErrors"] = console_errors
            result["checks"].append("控制台无错误")

            # Mobile overflow check and first-screen capture.
            mobile = browser.new_page(viewport={"width": 390, "height": 844})
            mobile_errors: list[str] = []
            mobile.on(
                "console",
                lambda message: mobile_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            mobile.evaluate(
                """() => { const store = {}; Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: k => store[k] ?? null, setItem: (k,v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear: () => {} } }); }"""
            )
            mobile.route("https://assets.local/**", route_handler)
            mobile.set_content(index, wait_until="networkidle")
            dimensions = mobile.locator("body").evaluate(
                "el => ({scrollWidth: el.scrollWidth, innerWidth: innerWidth})"
            )
            assert dimensions["scrollWidth"] <= dimensions["innerWidth"]
            assert not mobile_errors
            mobile.screenshot(path=str(ROOT / "screenshots" / "mobile-home.png"))
            result["checks"].append("390px 手机无横向溢出")
            mobile.close()
            browser.close()

        result["passed"] = True
        result["taskCounts"] = {
            "beforeGenerate": before_generate,
            "afterGenerate": after_generate,
        }
        result["mobileDimensions"] = dimensions
        return_code = 0
    except Exception as error:  # noqa: BLE001 - test report should capture any failure
        result["error"] = repr(error)
        return_code = 1
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()
        if server.stdout:
            output = server.stdout.read()
            result["serverOutput"] = output[-2000:]
        (REPORT_DIR / "browser-smoke.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), "utf-8"
        )

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
