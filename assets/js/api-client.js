(function () {
  const cfg = window.APP_CONFIG;

  function runtimeSettings() {
    return typeof window.getRuntimeAiSettings === 'function' ? window.getRuntimeAiSettings() : {};
  }

  async function request(endpoint, payload) {
    const settings = runtimeSettings();
    const mode = settings.mode || cfg.apiMode || 'mock';
    if (mode === 'mock') throw new Error('MOCK_MODE');
    if (mode === 'compatible') throw new Error('DIRECT_BROWSER_MODE_NOT_SUPPORTED');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
    const base = String(settings.baseUrl || cfg.apiBaseUrl || '').replace(/\/$/, '');
    try {
      const response = await fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.message || `接口请求失败：${response.status}`);
        error.code = data.code || 'API_ERROR';
        throw error;
      }
      return data;
    } finally { clearTimeout(timeout); }
  }

  window.ApiClient = {
    generateTasks(payload) { return request(cfg.taskEndpoint, payload); },
    generatePreview(payload) { return request(cfg.previewEndpoint, payload); }
  };
})();
