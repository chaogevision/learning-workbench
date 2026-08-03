# AI学习冒险基地｜轻量 API 接入说明

## 1. 接口范围

首版只接入两个生成类能力：

1. 根据孩子年级、可用时间和今日重点生成任务；
2. 根据课题和教材要点生成结构化课前预习单。

不接入 OCR、作业批改、错题诊断或实时语音，以控制普通家庭的部署成本和隐私风险。

## 2. 三种运行模式

### 2.1 完全离线

前端根据协议自动判断：

```js
apiMode: window.location.protocol === 'file:' ? 'mock' : 'proxy'
```

直接打开 `START_HERE.html` 时，协议为 `file:`，因此自动进入离线模式。浏览器不会请求 API，页面使用 `assets/js/app.js` 中的本地模板。

### 2.2 服务端 Mock

服务端 `.env`：

```text
API_MODE=mock
```

通过 `node server.mjs` 打开页面时，协议为 `http:`，前端会自动进入 `proxy` 模式并请求同源 HTTP 路由，但服务端返回本地演示 JSON。适合视频录制和接口联调，不消耗模型额度。

### 2.3 Compatible 模型接口

服务端 `.env`：

```text
API_MODE=compatible
AI_API_BASE_URL=https://your-provider.example/v1
AI_API_PATH=/chat/completions
AI_API_KEY=replace_with_server_side_key
AI_MODEL=replace_with_lightweight_model
```

前端仍由协议自动进入 `proxy` 模式，无需再改配置。服务端使用 OpenAI-compatible Chat Completions 形态调用模型。若供应商路径不同，可以通过 `AI_API_PATH` 覆盖。


### 2.4 前后端分离部署

若静态页面和 Node 服务不在同一域名，将 `assets/js/config.js` 中的 `apiBaseUrl` 设置为受信任的代理服务地址，并在服务端精确配置 `CORS_ORIGIN`。不要把模型供应商地址或密钥直接暴露给浏览器。

## 3. 启动

```bash
node server.mjs
```

健康检查：

```bash
curl http://127.0.0.1:4173/api/health
```

返回示例：

```json
{
  "ok": true,
  "apiMode": "mock",
  "model": null
}
```

## 4. 任务生成接口

### 4.1 请求

```http
POST /api/ai/generate-tasks
Content-Type: application/json
```

```json
{
  "grade": "四年级",
  "minutes": 60,
  "focus": ["数学", "英语"],
  "goal": "数学重点理解分数应用题，英语重点开口表达",
  "childProfile": {
    "childName": "小明",
    "grade": "四年级"
  }
}
```

### 4.2 响应

```json
{
  "mode": "api",
  "parentTip": "先让孩子完成最容易启动的一项。",
  "tasks": [
    {
      "id": "api-task-1",
      "subject": "数学",
      "icon": "math",
      "group": "required",
      "title": "分数关系解释与两题练习",
      "description": "先用自己的话说清数量关系，再完成一道基础题和一道迁移题。",
      "minutes": 20,
      "difficulty": 2,
      "focus": "数量关系",
      "reward": {
        "stars": 15,
        "coins": 20,
        "xp": 24,
        "mapEnergy": 8
      }
    }
  ]
}
```

### 4.3 约束

- 3—5 个任务；
- 单项 5—30 分钟；
- 总时长不超过可用时间；
- `difficulty` 为 1—3；
- `group` 只能是 `required`、`optional`、`adventure`；
- `icon` 只能来自白名单；
- 每项必须写明可观察的完成证据；
- 不生成惩罚和排名。

## 5. 预习单生成接口

### 5.1 请求

```http
POST /api/ai/generate-preview
Content-Type: application/json
```

```json
{
  "grade": "四年级",
  "subject": "数学",
  "edition": "人教版",
  "title": "角的度量（2）",
  "sourceText": "本课学习用量角器画指定度数的角，并检查读数方向。",
  "childProfile": {
    "childName": "小明",
    "grade": "四年级"
  }
}
```

### 5.2 响应结构

```json
{
  "mode": "api",
  "lesson": {
    "id": "api-preview-1",
    "subject": "数学",
    "grade": "四年级",
    "edition": "人教版",
    "title": "角的度量（2）",
    "textbookPages": "待家长核对",
    "estimatedMinutes": 25,
    "goal": "先理解画角的基本顺序，并带着一个读数问题进入课堂。",
    "sourceNote": "基于家长提供的本课要点生成，请核对教材图示和页码。",
    "knowledgeCards": [
      {
        "title": "画角从哪一步开始",
        "core": "先画一条射线，再让量角器中心和射线端点重合。",
        "keyword": "中心与零线",
        "pitfall": "先读错内外圈刻度。",
        "question": "为什么必须先确认零刻度线方向？"
      }
    ],
    "steps": [
      {
        "id": "overview",
        "title": "看全貌",
        "subtitle": "我已经知道什么",
        "instruction": "回忆量角的三个关键动作。",
        "placeholder": "我已经知道……",
        "icon": "book",
        "reward": 8
      }
    ],
    "challenges": {
      "recognize": {
        "label": "认一认",
        "question": "画角时最先应该做什么？",
        "options": ["画一条射线", "直接读刻度", "延长两条边"],
        "answer": 0
      },
      "explain": {
        "label": "说一说",
        "prompt": "用自己的话说明怎样判断读内圈还是外圈。"
      },
      "apply": {
        "label": "用一用",
        "prompt": "画一个生活中可能出现的锐角，并说明估计度数。"
      }
    }
  }
}
```

服务端必须返回完整 6 步，顺序与 ID 固定：

```text
overview → baseline → understand → verify → transfer → focus
```

## 6. 浏览器端回退

`assets/js/api-client.js` 只负责请求。业务层在 `assets/js/app.js` 中包裹 `try/catch`：

```text
尝试代理接口
→ 成功：规范化并写入状态
→ 失败：调用本地 mockTasks / mockPreview
→ Toast 提醒当前使用本地模板
```

因此 API 故障不会阻断演示。

## 7. 服务端模型输出校验

服务端不能直接信任模型 JSON，必须：

- 限制任务数量；
- 限制时间、奖励和难度范围；
- 限制 icon 和 group 白名单；
- 截断过长文本；
- 强制补齐六步预习；
- 强制挑战结构；
- 缺少教材来源时将页码标记为“待家长核对”；
- 只返回 JSON，不返回 HTML。

当前实现位于 `server.mjs` 的：

- `normalizeTaskResult`；
- `normalizePreviewResult`。

## 8. 密钥与隐私

### 必须

- 密钥只放 `.env`；
- `.env` 不提交到公开仓库；
- 前端只请求自己的服务端；
- 传给模型的儿童信息只保留昵称、年级和学习目标；
- 不传学校、住址、精确生日或家长联系方式；
- 生产环境使用 HTTPS；
- 日志不记录完整儿童输入和密钥。

### 禁止

- 在 `assets/js/config.js` 写入 API Key；
- 浏览器直接请求供应商并暴露密钥；
- 让模型返回任意 HTML 后直接插入页面；
- 把模型生成内容当成已核验教材答案；
- 把任务生成接口扩展成任意系统命令执行器。

## 9. 错误码

| code | 含义 |
|---|---|
| `INVALID_INPUT` | 缺少年级、时间、学科或课题 |
| `RATE_LIMITED` | 单分钟请求过多 |
| `API_NOT_CONFIGURED` | compatible 模式缺少环境变量 |
| `METHOD_NOT_ALLOWED` | 请求方法不支持 |
| `NOT_FOUND` | 路由或文件不存在 |
| `SERVER_ERROR` | 服务端或模型返回异常 |

前端对所有异常都应回退，不向孩子展示技术堆栈。

## 10. 生产部署建议

- Node 服务放在反向代理之后；
- 只开放必要端口；
- 设置请求超时；
- 设置按用户或 IP 的限流；
- API 结果可做短时缓存，但不要缓存完整儿童隐私信息；
- 为生成内容增加家长审批状态；
- 定期抽查数学公式、图示、语文原文和答案；
- 若启用跨域，精准设置 `CORS_ORIGIN`，不要长期使用 `*`。
