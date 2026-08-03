#!/usr/bin/env python3
"""Capture deterministic delivery screenshots without external network access."""
from __future__ import annotations

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
SCREENSHOTS = ROOT / "screenshots"
PORT = 4401
BASE = f"http://127.0.0.1:{PORT}"
ROUTES = {
    "home": "#/home",
    "tasks": "#/tasks",
    "preview": "#/preview",
    "map": "#/map",
    "archive": "#/archive",
}


def wait_for_server(timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(f"{BASE}/api/health", timeout=0.5) as response:
                if response.status == 200:
                    return
        except (URLError, TimeoutError):
            time.sleep(0.15)
    raise RuntimeError("截图服务未在规定时间内启动。")


def content_type(path: Path) -> str:
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def make_route_handler():
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

    return route_handler


def install_memory_storage(page) -> None:
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


def main() -> None:
    SCREENSHOTS.mkdir(exist_ok=True)
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
    try:
        wait_for_server()
        index = (ROOT / "index.html").read_text("utf-8").replace(
            "<head>", '<head><base href="https://assets.local/">', 1
        )
        handler = make_route_handler()
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
                args=["--no-sandbox"],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 1080})
            install_memory_storage(page)
            page.route("https://assets.local/**", handler)
            page.set_content(index, wait_until="networkidle")
            page.wait_for_timeout(250)

            for name, route in ROUTES.items():
                page.evaluate("route => { window.location.hash = route; }", route)
                page.wait_for_timeout(300)
                page.screenshot(path=str(SCREENSHOTS / f"{name}.png"), full_page=True)

            mobile = browser.new_page(viewport={"width": 390, "height": 844})
            install_memory_storage(mobile)
            mobile.route("https://assets.local/**", handler)
            mobile.set_content(index, wait_until="networkidle")
            mobile.evaluate("window.location.hash = '#/home'")
            mobile.wait_for_timeout(300)
            mobile.screenshot(path=str(SCREENSHOTS / "mobile-home.png"), full_page=False)
            mobile.close()
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    main()
