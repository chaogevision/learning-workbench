#!/usr/bin/env python3
from __future__ import annotations
import json, mimetypes, os, subprocess, time
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 4417
BASE = f"http://127.0.0.1:{PORT}"
REPORT = ROOT / "reports" / "GROWTH_INCENTIVE_V2_VALIDATION.json"


def wait_for_server() -> None:
    for _ in range(60):
        try:
            with urlopen(f"{BASE}/api/health", timeout=0.5) as response:
                if response.status == 200: return
        except (URLError, TimeoutError): time.sleep(0.15)
    raise RuntimeError("server timeout")


def content_type(path: Path) -> str:
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def main() -> int:
    env = os.environ.copy(); env.update({"HOST":"127.0.0.1","PORT":str(PORT),"API_MODE":"mock"})
    server = subprocess.Popen(["node","server.mjs"],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    result: dict[str, object] = {"passed":False,"checks":[],"consoleErrors":[]}
    try:
        wait_for_server()
        index = (ROOT / "index.html").read_text("utf-8").replace("<head>", '<head><base href="https://assets.local/">', 1)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium"), args=["--no-sandbox"])
            page = browser.new_page(viewport={"width":1440,"height":1080})
            page.set_default_timeout(5000)
            errors: list[str] = []
            page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.evaluate("""() => { const store={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},clear:()=>Object.keys(store).forEach(k=>delete store[k])}}); }""")

            def route_handler(route) -> None:
                parsed = urlparse(route.request.url)
                if parsed.path.startswith('/api/'):
                    payload=(route.request.post_data or '').encode()
                    request=Request(f"{BASE}{parsed.path}",data=payload,method=route.request.method,headers={'Content-Type':'application/json'})
                    try:
                        with urlopen(request,timeout=10) as response:
                            route.fulfill(status=response.status,body=response.read(),headers={'content-type':'application/json'})
                    except HTTPError as error:
                        route.fulfill(status=error.code,body=error.read(),headers={'content-type':'application/json'})
                    return
                relative=unquote(parsed.path.lstrip('/'))
                file_path=(ROOT/relative).resolve()
                if not str(file_path).startswith(str(ROOT.resolve())) or not file_path.exists() or file_path.is_dir():
                    route.fulfill(status=404,body='not found'); return
                route.fulfill(status=200,body=file_path.read_bytes(),content_type=content_type(file_path))

            page.route('https://assets.local/**',route_handler)
            page.set_content(index,wait_until='networkidle')
            assert page.get_by_text('成长星',exact=True).count() >= 1
            assert page.get_by_text('探索币',exact=True).count() >= 1
            assert page.get_by_text('今日可点亮能力',exact=True).count() >= 1
            result['checks'].append('首页成长资源与能力目标')
            page.locator('.nav-list [data-route="tasks"]').click()
            page.locator('[data-action="open-manual-task"]').click()
            assert page.locator('select[name="primaryAbility"]').count() == 1
            assert page.locator('input[name="rewardStars"]').count() == 0
            page.locator('input[name="title"]').fill('V2能力证据测试任务')
            page.locator('select[name="subject"]').select_option(label='思维')
            page.locator('select[name="primaryAbility"]').select_option('question-detective')
            page.locator('input[name="evidenceRule"]').fill('提出一个有价值的问题并记录思考')
            page.locator('[data-action="save-manual-task"]').click()
            page.locator('.task-row').filter(has_text='V2能力证据测试任务').locator('[data-action="open-task"]').click()
            page.locator('textarea[name="evidence"]').fill('我提出了一个关于规律为什么成立的问题，并写下了我的猜想。')
            page.locator('input[name="progress"]').fill('100')
            page.locator('[data-action="complete-task"]').click()
            result['checks'].append('任务能力选择与V2奖励发放')
            page.locator('.nav-list [data-route="archive"]').click()
            page.wait_for_timeout(150)
            assert page.get_by_text('我的能力徽章',exact=True).count() == 1
            assert page.get_by_text('能力徽章墙',exact=True).count() == 1
            page.locator('[data-action="filter-badge-category"][data-category="thinking"]').click()
            assert page.get_by_text('提问小侦探',exact=True).count() >= 1
            result['checks'].append('分类徽章墙与成长阶段')

            state=page.evaluate("JSON.parse(localStorage.getItem('child-learning-adventure-base-v1-5'))")
            assert state['version']==3
            assert 'growthStars' in state['wallet'] and 'exploreCoins' in state['wallet']
            question=next(b for b in state['badges'] if b['id']=='question-detective')
            assert question['progress']>=11
            assert any(item.get('title')=='完成V2能力证据测试任务' for item in state['rewardLedger'])
            result['checks'].append('数据模型、能力进度与奖励流水')
            page.locator('.nav-list [data-route="map"]').click()
            page.wait_for_timeout(150)
            page.locator('[data-action="show-rewards"]').click()
            assert page.get_by_text('探索币奖励商店',exact=True).count()>=1
            balance_before=state['wallet']['exploreCoins']
            first_button=page.locator('[data-action="redeem-reward"]').first
            if first_button.is_enabled():
                first_button.click()
                updated=page.evaluate("JSON.parse(localStorage.getItem('child-learning-adventure-base-v1-5'))")
                assert updated['wallet']['exploreCoins']<balance_before
            page.locator('[data-action="close-modal"]').first.click()
            result['checks'].append('探索币奖励商店')
            page.locator('.nav-list [data-route="preview"]').click()
            page.wait_for_timeout(150)
            page.evaluate("document.dispatchEvent(new CustomEvent('sixstep-progress',{detail:{unitId:'unit-test',completedSteps:6,stars:7,finished:true,level:'green',errors:0}}))")
            page.wait_for_timeout(100)
            preview_state=page.evaluate("JSON.parse(localStorage.getItem('child-learning-adventure-base-v1-5'))")
            assert preview_state['previewSkill']['rewardGranted'] is True
            assert any(item.get('claimId')=='preview-skill:unit-test' for item in preview_state['rewardLedger'])
            result['checks'].append('六步预习推动能力与完整奖励')
            assert not errors, errors
            result['consoleErrors']=errors
            page.locator('.nav-list [data-route="archive"]').click()
            page.screenshot(path=str(ROOT/'screenshots'/'growth-v2-archive.png'),full_page=True)
            browser.close()
        result['passed']=True; code=0
    except Exception as exc:
        result['error']=repr(exc); code=1
    finally:
        server.terminate()
        try: server.wait(timeout=3)
        except subprocess.TimeoutExpired: server.kill()
        result['serverOutput']=server.stdout.read() if server.stdout else ''
        REPORT.parent.mkdir(parents=True,exist_ok=True)
        REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False,indent=2))
    return code

if __name__=='__main__': raise SystemExit(main())
