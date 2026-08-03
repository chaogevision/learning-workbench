#!/usr/bin/env python3
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
PORT = 4415
BASE = f"http://127.0.0.1:{PORT}"
REPORT = ROOT / "reports" / "V1.5_PRODUCT_VALIDATION.json"


def wait_for_server(timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(f"{BASE}/api/health", timeout=0.5) as response:
                if response.status == 200:
                    return
        except (URLError, TimeoutError):
            time.sleep(0.15)
    raise RuntimeError("测试服务未启动。")


def content_type(path: Path) -> str:
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def install_storage(page) -> None:
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


def main() -> int:
    env = os.environ.copy()
    env.update({"HOST": "127.0.0.1", "PORT": str(PORT), "API_MODE": "mock"})
    server = subprocess.Popen(
        ["node", "server.mjs"], cwd=ROOT, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    result = {"passed": False, "checks": [], "consoleErrors": []}
    try:
        wait_for_server()
        index = (ROOT / "index.html").read_text("utf-8").replace(
            "<head>", '<head><base href="https://assets.local/">', 1
        )
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
                args=["--no-sandbox"],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 1080})
            errors: list[str] = []
            page.on("console", lambda msg: errors.append(f"console {msg.type}: {msg.text}") if msg.type == "error" else None)
            page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
            install_storage(page)

            def route_handler(route) -> None:
                parsed = urlparse(route.request.url)
                if parsed.path.startswith("/api/"):
                    data = (route.request.post_data or "").encode()
                    req = Request(
                        f"{BASE}{parsed.path}", data=data,
                        method=route.request.method,
                        headers={"Content-Type": "application/json"},
                    )
                    try:
                        with urlopen(req, timeout=10) as response:
                            route.fulfill(status=response.status, body=response.read(), headers={"content-type": "application/json"})
                    except HTTPError as error:
                        route.fulfill(status=error.code, body=error.read(), headers={"content-type": "application/json"})
                    return
                rel = unquote(parsed.path.lstrip("/"))
                file_path = (ROOT / rel).resolve()
                if not str(file_path).startswith(str(ROOT.resolve())) or not file_path.exists() or file_path.is_dir():
                    route.fulfill(status=404, body="not found")
                    return
                route.fulfill(status=200, body=file_path.read_bytes(), content_type=content_type(file_path))

            page.route("https://assets.local/**", route_handler)
            page.set_content(index, wait_until="networkidle")
            assert page.get_by_text("今天的学习冒险", exact=True).count() == 1
            assert page.locator(".learning-calendar-card").count() == 1
            result["checks"].append("首页冒险摘要与真实学习日历")

            # Avatar upload
            page.locator('[data-action="open-profile"]').last.click()
            avatar_file = ROOT / "assets" / "characters" / "child-welcome.png"
            page.locator('input[data-action="avatar-file"]').set_input_files(str(avatar_file))
            page.wait_for_timeout(250)
            page.locator('[data-action="save-profile"]').click()
            src = page.locator(".avatar-button img").get_attribute("src") or ""
            assert src.startswith("data:image/jpeg")
            result["checks"].append("头像上传、压缩与个人信息保存")

            # Calendar detail and future parent task
            page.locator('[data-action="open-calendar-day"][data-date="2026-08-02"]').first.click()
            assert page.get_by_text("角的度量", exact=False).count() >= 1
            page.locator('[data-action="open-manual-task-date"]').click()
            page.locator('input[name="scheduledDate"]').fill("2026-08-05")
            page.locator('input[name="title"]').fill("家庭阅读分享")
            page.locator('textarea[name="description"]').fill("阅读20分钟，并把最有趣的一段讲给家长听。")
            page.locator('input[name="evidenceRule"]').fill("说出一个喜欢的情节和原因")
            page.locator('[data-action="save-manual-task"]').click()
            result["checks"].append("家长提前安排未来任务")

            page.locator('.nav-list [data-route="home"]').click()
            page.locator('[data-action="open-calendar-day"][data-date="2026-08-05"]').first.click()
            assert page.get_by_text("家庭阅读分享", exact=True).count() >= 1
            page.locator('[data-action="close-modal"]').first.click()
            result["checks"].append("任务计划自动同步学习日历")

            # API settings in archive
            page.locator('.nav-list [data-route="archive"]').click()
            page.locator('select[name="mode"]').select_option("mock")
            page.locator('input[name="model"]').fill("demo-light-model")
            page.locator('[data-action="save-api-settings"]').click()
            page.locator('[data-action="test-api-settings"]').click()
            page.wait_for_timeout(200)
            assert page.get_by_text("连接成功", exact=False).count() >= 1
            result["checks"].append("家长中心前端 API 配置与测试")

            # Preview stays fully interactive
            page.locator('.nav-list [data-route="preview"]').click()
            page.wait_for_timeout(300)
            preview = page.locator("six-step-preview")
            assert preview.locator("#sixStepNav .step-nav-btn").count() == 6
            assert preview.locator("#knowledgeMap .knowledge-node").count() == 7
            result["checks"].append("完整六步交互式预习单保留")

            # Mobile overflow
            mobile = browser.new_page(viewport={"width": 390, "height": 844})
            install_storage(mobile)
            mobile.route("https://assets.local/**", route_handler)
            mobile.set_content(index, wait_until="networkidle")
            dimensions = mobile.evaluate("() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth})")
            assert dimensions["scrollWidth"] <= dimensions["innerWidth"] + 1
            result["mobileDimensions"] = dimensions
            result["checks"].append("390px 手机端无横向溢出")
            mobile.close()

            assert not errors, errors
            result["consoleErrors"] = errors
            result["checks"].append("控制台无错误")
            result["passed"] = True
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()
        result["serverOutput"] = server.stdout.read() if server.stdout else ""
        REPORT.parent.mkdir(exist_ok=True)
        REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
