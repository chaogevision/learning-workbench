window.APP_CONFIG = Object.freeze({
  // 通过本地 server.mjs 访问时使用 proxy；直接双击 index.html 时自动使用离线模板。
  apiMode: window.location.protocol === 'file:' ? 'mock' : 'proxy',
  apiBaseUrl: '',
  taskEndpoint: '/api/ai/generate-tasks',
  previewEndpoint: '/api/ai/generate-preview',
  requestTimeoutMs: 30000,
  productName: '学习冒险基地',
  storageKey: 'child-learning-adventure-base-v1-5'
});
