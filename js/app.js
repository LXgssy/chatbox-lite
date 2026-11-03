/* =====================================================
   轻聊 Chatbox · 主逻辑
   —— 移植自 Chatbox 的核心交互，纯浏览器本地运行
   所有数据仅保存在 localStorage：记录不会被远程撤回
   ===================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'chatboxlite.v1';
  var MD = window.MD;

  /* ---------------- 状态 ---------------- */
  var DEFAULT_SETTINGS = {
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.7,
    system: '',
    contextCount: 12,
    stream: true,
    aiName: 'AI 助手',
    aiAvatar: '🤖',
    userName: '我',
    userAvatar: '🙂'
  };

  /* 各大模型服务商预设（仅接口地址与推荐模型，不内置任何密钥） */
  var PRESETS = [
    { id: 'deepseek', emoji: '🐋', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'openai', emoji: '🌍', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'o4-mini'] },
    { id: 'kimi', emoji: '🌙', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
    { id: 'qwen', emoji: '🐰', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
    { id: 'glm', emoji: '💡', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus'] },
    { id: 'siliconflow', emoji: '⚡', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'] },
    { id: 'doubao', emoji: '🔥', name: '火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-1-5-pro-32k-250115', 'doubao-1-5-lite-32k-250115'] },
    { id: 'openrouter', emoji: '🧭', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001'] },
    { id: 'ollama', emoji: '🦙', name: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', models: ['llama3.1', 'qwen2.5', 'deepseek-r1'] }
  ];

  var state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    chats: [],
    activeId: null,
    theme: 'light'
  };

  var streaming = false;          // 是否正在生成
  var abortCtrl = null;           // 中止控制器
  var stickBottom = true;         // 是否吸附底部

  /* ---------------- 工具 ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('保存失败：浏览器存储空间不足');
    }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
          state.chats = Array.isArray(data.chats) ? data.chats : [];
          state.activeId = data.activeId || null;
          state.theme = data.theme === 'dark' ? 'dark' : 'light';
        }
      }
    } catch (e) { /* 数据损坏则重新开始 */ }
  }

  var toastTimer = null;
  function toast(text) {
    var el = $('#toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 2600);
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d.toDateString() === now.toDateString()) return hm;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }

  function activeChat() {
    for (var i = 0; i < state.chats.length; i++) {
      if (state.chats[i].id === state.activeId) return state.chats[i];
    }
    return null;
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
  }

  /* ---------------- 会话管理 ---------------- */
  function createChat(switchTo) {
    var chat = {
      id: uid(),
      title: '新会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    state.chats.unshift(chat);
    if (switchTo !== false) state.activeId = chat.id;
    save();
    renderChatList();
    renderMessages();
    if (window.innerWidth <= 768) closeSidebar();
    return chat;
  }

  function deleteChat(id) {
    var chat = null;
    state.chats = state.chats.filter(function (c) {
      if (c.id === id) { chat = c; return false; }
      return true;
    });
    if (chat && chat.id === state.activeId) {
      state.activeId = state.chats.length ? state.chats[0].id : null;
    }
    if (!state.chats.length) createChat(false);
    save();
    renderChatList();
    renderMessages();
    toast('会话已删除');
  }

  function renameChat(id) {
    var chat = null;
    state.chats.forEach(function (c) { if (c.id === id) chat = c; });
    if (!chat) return;
    var name = prompt('修改会话名称：', chat.title);
    if (name === null) return;
    chat.title = name.trim() || chat.title;
    chat.updatedAt = Date.now();
    save();
    renderChatList();
    renderHeader();
  }

  function clearActiveChat() {
    var chat = activeChat();
    if (!chat || !chat.messages.length) { toast('当前会话没有消息'); return; }
    if (!confirm('确定清空当前会话的全部消息吗？此操作不可恢复。')) return;
    chat.messages = [];
    chat.updatedAt = Date.now();
    save();
    renderMessages();
    renderChatList();
  }

  /* ---------------- 渲染：侧边栏 ---------------- */
  function renderChatList() {
    var list = $('#chatList');
    list.innerHTML = '';
    state.chats.forEach(function (chat) {
      var item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === state.activeId ? ' active' : '');
      item.setAttribute('role', 'button');
      item.innerHTML =
        '<span class="chat-name"></span>' +
        '<span class="chat-item-btns">' +
        '<button class="mini-btn" data-act="rename" title="重命名">✎</button>' +
        '<button class="mini-btn" data-act="del" title="删除">✕</button>' +
        '</span>';
      item.querySelector('.chat-name').textContent = chat.title;
      item.addEventListener('click', function (e) {
        var btn = e.target.closest('.mini-btn');
        if (btn) {
          e.stopPropagation();
          if (btn.dataset.act === 'del') {
            if (confirm('删除会话「' + chat.title + '」？')) deleteChat(chat.id);
          } else {
            renameChat(chat.id);
          }
          return;
        }
        state.activeId = chat.id;
        save();
        renderChatList();
        renderMessages();
        if (window.innerWidth <= 768) closeSidebar();
      });
      list.appendChild(item);
    });
  }

  /* ---------------- 渲染：消息 ---------------- */
  function renderHeader() {
    var chat = activeChat();
    $('#chatTitle').textContent = chat ? chat.title : '轻聊 Chatbox';
  }

  function buildMessageEl(msg) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (msg.role === 'user' ? 'user' : 'assistant');
    wrap.dataset.id = msg.id;

    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    var s = state.settings;
    var whoName = msg.role === 'user' ? (s.userName || '我') : (s.aiName || 'AI 助手');
    avatar.textContent = msg.role === 'user' ? (s.userAvatar || '🙂') : (s.aiAvatar || '🤖');
    avatar.title = whoName;

    var body = document.createElement('div');
    body.className = 'msg-body';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (msg.role === 'user') {
      bubble.textContent = msg.content;
    } else {
      bubble.appendChild(buildAssistantContent(msg));
    }
    body.appendChild(bubble);

    // 操作条
    var meta = document.createElement('div');
    meta.className = 'msg-meta';
    var name = document.createElement('span');
    name.textContent = whoName;
    name.style.fontWeight = '600';
    meta.appendChild(name);
    var t = document.createElement('span');
    t.textContent = fmtTime(msg.ts || Date.now());
    meta.appendChild(t);

    var actCopy = document.createElement('button');
    actCopy.className = 'msg-act';
    actCopy.textContent = '复制';
    actCopy.addEventListener('click', function () {
      copyText(msg.content);
    });
    meta.appendChild(actCopy);

    if (msg.role === 'assistant' && msg.error) {
      var errTag = document.createElement('span');
      errTag.textContent = '请求失败';
      errTag.style.color = 'var(--danger)';
      meta.appendChild(errTag);
    }

    if (msg.role === 'assistant' && !msg.streaming) {
      var actRe = document.createElement('button');
      actRe.className = 'msg-act';
      actRe.textContent = '重新生成';
      actRe.addEventListener('click', function () { regenerate(msg.id); });
      meta.appendChild(actRe);
    }

    var actDel = document.createElement('button');
    actDel.className = 'msg-act';
    actDel.textContent = '删除';
    actDel.addEventListener('click', function () {
      var chat = activeChat();
      if (!chat) return;
      chat.messages = chat.messages.filter(function (m) { return m.id !== msg.id; });
      save();
      renderMessages();
    });
    meta.appendChild(actDel);

    body.appendChild(meta);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    return wrap;
  }

  function buildAssistantContent(msg) {
    var frag = document.createDocumentFragment();

    if (msg.reasoning) {
      var det = document.createElement('details');
      det.className = 'reasoning';
      var sum = document.createElement('summary');
      sum.textContent = '思考过程';
      det.appendChild(sum);
      var rbody = document.createElement('div');
      rbody.className = 'reasoning-body';
      rbody.textContent = msg.reasoning;
      det.appendChild(rbody);
      frag.appendChild(det);
    }

    var mdDiv = document.createElement('div');
    mdDiv.className = 'md';
    if (msg.content) {
      mdDiv.innerHTML = MD.render(msg.content);
    } else if (msg.streaming) {
      mdDiv.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>';
    }
    if (msg.error && msg.errorText) {
      var err = document.createElement('div');
      err.className = 'error-text';
      err.textContent = msg.errorText;
      mdDiv.appendChild(err);
    }
    if (msg.stopped) {
      var tag = document.createElement('span');
      tag.className = 'stopped-tag';
      tag.textContent = '已停止生成';
      mdDiv.appendChild(tag);
    }
    frag.appendChild(mdDiv);
    return frag;
  }

  function renderMessages() {
    var box = $('#messages');
    var chat = activeChat();
    box.innerHTML = '';
    renderHeader();

    var inner = document.createElement('div');
    inner.className = 'messages-inner';

    if (!chat || !chat.messages.length) {
      var s = state.settings;
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML =
        '<div class="empty-logo">' + MD.escapeHtml(s.aiAvatar || '🤖') + '</div>' +
        '<h2>向 ' + MD.escapeHtml(s.aiName || 'AI 助手') + ' 发送第一条消息</h2>' +
        '<p>点击下方按钮选择常用服务商预设（或手动填写），再填入你自己的 API 密钥即可开始。所有记录仅保存在本设备，无法被远程撤回。</p>';
      var goSet = document.createElement('button');
      goSet.className = 'primary-btn';
      goSet.type = 'button';
      goSet.textContent = '去设置接口';
      goSet.addEventListener('click', openSettings);
      empty.appendChild(goSet);
      inner.appendChild(empty);
    } else {
      chat.messages.forEach(function (msg) {
        inner.appendChild(buildMessageEl(msg));
      });
    }

    box.appendChild(inner);
    scrollToBottom(true);
  }

  function updateStreamingBubble(msg) {
    var el = document.querySelector('.msg[data-id="' + msg.id + '"] .bubble');
    if (!el) { renderMessages(); return; }
    el.innerHTML = '';
    el.appendChild(buildAssistantContent(msg));
    if (stickBottom) scrollToBottom(false);
  }

  function scrollToBottom() {
    var box = $('#messages');
    box.style.scrollBehavior = 'auto';
    box.scrollTop = box.scrollHeight;
  }

  /* ---------------- 发送与流式请求 ---------------- */
  function endpointUrl(base) {
    var b = (base || '').trim().replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(b)) return b;
    return b + '/chat/completions';
  }

  function friendlyError(status, bodyText) {
    var detail = '';
    try {
      var j = JSON.parse(bodyText);
      detail = (j.error && (j.error.message || j.error.code)) || j.message || '';
    } catch (e) {
      detail = (bodyText || '').slice(0, 160);
    }
    var hint = '';
    if (status === 401 || status === 403) hint = 'API 密钥无效或没有权限，请检查设置中的密钥。';
    else if (status === 404) hint = '接口路径或模型不存在，请检查 Base URL（通常需要以 /v1 结尾）和模型名称。';
    else if (status === 429) hint = '请求过于频繁或额度不足，请稍后再试或检查账户余额。';
    else if (status >= 500) hint = '模型服务端暂时出错，请稍后再试。';
    else hint = '请求失败（HTTP ' + status + '）。';
    return detail ? hint + '\n服务返回：' + detail : hint;
  }

  function buildPayloadMessages(chat) {
    var msgs = [];
    if (state.settings.system && state.settings.system.trim()) {
      msgs.push({ role: 'system', content: state.settings.system.trim() });
    }
    var history = chat.messages.filter(function (m) { return !m.error; });
    var n = Math.max(2, +state.settings.contextCount || 12);
    var tail = history.slice(-n);
    tail.forEach(function (m) {
      msgs.push({ role: m.role, content: m.content });
    });
    return msgs;
  }

  function setStreamingUI(on) {
    streaming = on;
    var btn = $('#sendBtn');
    if (on) {
      btn.textContent = '停止';
      btn.classList.add('stop');
    } else {
      btn.textContent = '发送';
      btn.classList.remove('stop');
    }
  }

  function sendMessage() {
    if (streaming) { stopStreaming(); return; }

    var inputEl = $('#input');
    var text = inputEl.value.trim();
    if (!text) return;

    var s = state.settings;
    if (!s.baseUrl || !s.apiKey || !s.model) {
      toast('请先在设置中填写接口地址、API 密钥和模型名称');
      openSettings();
      return;
    }

    var chat = activeChat() || createChat(true);

    var userMsg = { id: uid(), role: 'user', content: text, ts: Date.now() };
    chat.messages.push(userMsg);
    if (chat.title === '新会话') {
      chat.title = text.replace(/\s+/g, ' ').slice(0, 18) || '新会话';
    }
    chat.updatedAt = Date.now();
    inputEl.value = '';
    autoResize();
    save();
    renderChatList();
    renderHeader();
    renderMessages();

    requestCompletion(chat);
  }

  function requestCompletion(chat) {
    var aiMsg = { id: uid(), role: 'assistant', content: '', reasoning: '', ts: Date.now(), streaming: true };
    chat.messages.push(aiMsg);
    var holder = document.createElement('div');
    holder.className = 'messages-inner';
    // 只追加这一条消息的 DOM，避免整列表重绘
    var box = $('#messages');
    box.appendChild(holder);
    var el = buildMessageEl(aiMsg);
    holder.replaceWith(el);
    scrollToBottom(true);

    var payload = {
      model: state.settings.model,
      messages: buildPayloadMessages(chat).filter(function (m) { return m.content !== ''; }),
      temperature: +state.settings.temperature
    };
    if (state.settings.stream) payload.stream = true;

    abortCtrl = new AbortController();
    setStreamingUI(true);
    stickBottom = true;

    var useStream = !!state.settings.stream;

    fetch(endpointUrl(state.settings.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + state.settings.apiKey
      },
      body: JSON.stringify(payload),
      signal: abortCtrl.signal
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error(friendlyError(res.status, t));
        });
      }
      if (!useStream) {
        return res.json().then(function (j) {
          var choice = j.choices && j.choices[0] && j.choices[0].message;
          if (choice) {
            aiMsg.content = choice.content || '';
            aiMsg.reasoning = choice.reasoning_content || choice.reasoning || '';
          } else {
            aiMsg.content = '(服务返回了无法解析的内容)';
          }
          finish(aiMsg, chat, false);
        });
      }
      // ---- 流式 ----
      var reader = res.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buf = '';
      var pendingRender = false;

      function scheduleRender() {
        if (pendingRender) return;
        pendingRender = true;
        requestAnimationFrame(function () {
          pendingRender = false;
          updateStreamingBubble(aiMsg);
        });
      }

      function processLine(line) {
        line = line.trim();
        if (!line || line.charAt(0) === ':') return;
        if (line.indexOf('data:') !== 0) return;
        var data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          var j = JSON.parse(data);
          var delta = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
          if (delta) {
            var r = delta.reasoning_content || delta.reasoning || '';
            if (r) { aiMsg.reasoning += r; }
            if (delta.content) { aiMsg.content += delta.content; }
            if (r || delta.content) scheduleRender();
          }
        } catch (e) { /* 忽略无法解析的行 */ }
      }

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            if (buf) processLine(buf);
            finish(aiMsg, chat, false);
            return;
          }
          buf += decoder.decode(r.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n')) !== -1) {
            processLine(buf.slice(0, idx));
            buf = buf.slice(idx + 1);
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        aiMsg.stopped = true;
        finish(aiMsg, chat, true);
        return;
      }
      aiMsg.error = true;
      if (!aiMsg.content) aiMsg.content = '';
      aiMsg.errorText = (err && err.message) || '网络错误：无法连接到接口。请检查网络、接口地址，或确认该接口允许浏览器直接（CORS）调用。';
      finish(aiMsg, chat, true);
    });

    function finish(msg, chat2, failed) {
      msg.streaming = false;
      delete msg.streaming;
      chat2.updatedAt = Date.now();
      save();
      setStreamingUI(false);
      abortCtrl = null;
      renderMessages();
      renderChatList();
    }
  }

  function stopStreaming() {
    if (abortCtrl) {
      abortCtrl.abort();
      toast('已停止生成（已收到的内容会保留）');
    }
  }

  function regenerate(msgId) {
    if (streaming) { toast('正在生成中，请先停止'); return; }
    var chat = activeChat();
    if (!chat) return;
    var idx = -1;
    chat.messages.forEach(function (m, i) { if (m.id === msgId) idx = i; });
    if (idx === -1) return;
    // 删除这条 AI 回复及其之后的所有内容，重新请求
    chat.messages = chat.messages.slice(0, idx);
    save();
    renderMessages();
    requestCompletion(chat);
  }

  /* ---------------- 导出 ---------------- */
  function exportMarkdown() {
    var chat = activeChat();
    if (!chat || !chat.messages.length) { toast('当前会话没有可导出的消息'); return; }
    var s = state.settings;
    var lines = ['# ' + chat.title, '', '> 导出时间：' + new Date().toLocaleString('zh-CN'), ''];
    chat.messages.forEach(function (m) {
      lines.push('**' + (m.role === 'user' ? (s.userName || '我') : (s.aiName || 'AI 助手')) + '：**', '', m.content, '', '---', '');
    });
    var safe = chat.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
    download(safe + '.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    toast('已导出为 Markdown');
  }

  function backupAll() {
    download('chatbox-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify({ app: 'chatbox-lite', version: 1, exportedAt: new Date().toISOString(), settings: state.settings, chats: state.chats, activeId: state.activeId, theme: state.theme }, null, 2),
      'application/json;charset=utf-8');
    toast('备份已下载');
  }

  /* ---------------- 导入备份 ---------------- */
  function importBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        toast('导入失败：不是有效的 JSON 文件');
        return;
      }
      if (!data || !Array.isArray(data.chats)) {
        toast('导入失败：备份文件格式不正确');
        return;
      }
      var incoming = data.chats.filter(function (c) {
        return c && typeof c === 'object' && Array.isArray(c.messages);
      });
      if (!incoming.length) { toast('备份中没有可导入的会话'); return; }

      var existingIds = {};
      state.chats.forEach(function (c) { existingIds[c.id] = true; });
      var added = 0;
      incoming.forEach(function (c) {
        if (c.id && existingIds[c.id]) return; // 按 id 去重，避免重复导入
        state.chats.push({
          id: c.id || uid(),
          title: (typeof c.title === 'string' && c.title) ? c.title : '导入的会话',
          createdAt: c.createdAt || Date.now(),
          updatedAt: c.updatedAt || Date.now(),
          messages: c.messages
        });
        added++;
      });
      state.chats.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

      if (data.settings && typeof data.settings === 'object') {
        if (confirm('备份中包含接口配置，是否一并恢复（覆盖当前设置）？\n点「取消」则只导入会话。')) {
          state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
          renderTheme();
        }
      }

      if (!activeChat()) state.activeId = state.chats.length ? state.chats[0].id : null;
      save();
      renderChatList();
      renderMessages();
      closeSettings();
      toast('导入完成：新增 ' + added + ' 个会话');
    };
    reader.readAsText(file, 'utf-8');
  }

  function wipeAll() {
    if (!confirm('将删除本设备上保存的全部会话与设置，且无法恢复。确定继续吗？')) return;
    if (!confirm('再次确认：真的要清空全部数据吗？')) return;
    localStorage.removeItem(STORE_KEY);
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    state.chats = [];
    state.activeId = null;
    createChat(true);
    renderTheme();
    toast('已清空全部数据');
    closeSettings();
    renderMessages();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制到剪贴板');
      }, function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('已复制到剪贴板');
    } catch (e) {
      toast('复制失败，请手动复制');
    }
    ta.remove();
  }

  /* ---------------- 设置弹窗 ---------------- */
  function setModelSuggestions(models) {
    var dl = $('#modelSuggestions');
    dl.innerHTML = '';
    (models || []).forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      dl.appendChild(opt);
    });
  }

  function renderPresets() {
    var row = $('#presetRow');
    row.innerHTML = '';
    var current = (state.settings.baseUrl || '').replace(/\/+$/, '');
    PRESETS.forEach(function (p) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'preset-chip' + (current && current === p.baseUrl.replace(/\/+$/, '') ? ' active' : '');
      chip.textContent = p.emoji + ' ' + p.name;
      chip.addEventListener('click', function () {
        $('#setBaseUrl').value = p.baseUrl;
        setModelSuggestions(p.models);
        if (!$('#setModel').value) $('#setModel').value = p.models[0];
        row.querySelectorAll('.preset-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        toast('已填入 ' + p.name + ' 预设，请填入你自己的 API 密钥');
      });
      row.appendChild(chip);
    });
  }

  function openSettings() {
    var s = state.settings;
    $('#setBaseUrl').value = s.baseUrl;
    $('#setApiKey').value = s.apiKey;
    $('#setModel').value = s.model;
    $('#setSystem').value = s.system;
    $('#setTemp').value = s.temperature;
    $('#tempVal').textContent = s.temperature;
    $('#setContext').value = s.contextCount;
    $('#setStream').checked = !!s.stream;
    $('#setAiName').value = s.aiName || '';
    $('#setAiAvatar').value = s.aiAvatar || '';
    $('#setUserName').value = s.userName || '';
    $('#setUserAvatar').value = s.userAvatar || '';
    renderPresets();
    var cur = (s.baseUrl || '').replace(/\/+$/, '');
    var hit = null;
    PRESETS.forEach(function (p) { if (p.baseUrl.replace(/\/+$/, '') === cur) hit = p; });
    setModelSuggestions(hit ? hit.models : null);
    $('#settingsModal').classList.remove('hidden');
  }
  function closeSettings() {
    $('#settingsModal').classList.add('hidden');
  }
  function saveSettings() {
    var s = state.settings;
    s.baseUrl = $('#setBaseUrl').value.trim();
    s.apiKey = $('#setApiKey').value.trim();
    s.model = $('#setModel').value.trim();
    s.system = $('#setSystem').value;
    s.temperature = +$('#setTemp').value;
    s.contextCount = Math.max(2, Math.min(100, +$('#setContext').value || 12));
    s.stream = $('#setStream').checked;
    s.aiName = $('#setAiName').value.trim() || 'AI 助手';
    s.aiAvatar = $('#setAiAvatar').value.trim() || '🤖';
    s.userName = $('#setUserName').value.trim() || '我';
    s.userAvatar = $('#setUserAvatar').value.trim() || '🙂';
    save();
    closeSettings();
    toast('设置已保存');
    renderMessages();
  }

  /* ---------------- 主题 ---------------- */
  function renderTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    $('#themeBtn').textContent = state.theme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save();
    renderTheme();
  }

  /* ---------------- 侧边栏（移动端） ---------------- */
  function openSidebar() {
    $('#sidebar').classList.add('open');
    $('#overlay').classList.add('show');
  }
  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#overlay').classList.remove('show');
  }

  /* ---------------- 输入框 ---------------- */
  function autoResize() {
    var el = $('#input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    $('#newChatBtn').addEventListener('click', function () { createChat(true); });
    $('#settingsBtn').addEventListener('click', function () { closeSidebar(); openSettings(); });
    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#exportMdBtn').addEventListener('click', exportMarkdown);
    $('#clearChatBtn').addEventListener('click', clearActiveChat);
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#overlay').addEventListener('click', closeSidebar);

    $('#sendBtn').addEventListener('click', sendMessage);
    $('#input').addEventListener('input', autoResize);
    $('#input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
        e.preventDefault();
        sendMessage();
      }
    });

    $('#closeSettingsBtn').addEventListener('click', closeSettings);
    document.querySelectorAll('[data-close-settings]').forEach(function (el) {
      el.addEventListener('click', closeSettings);
    });
    $('#saveSettingsBtn').addEventListener('click', saveSettings);
    $('#toggleKeyBtn').addEventListener('click', function () {
      var inp = $('#setApiKey');
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      this.textContent = show ? '隐藏' : '显示';
    });
    $('#setTemp').addEventListener('input', function () {
      $('#tempVal').textContent = this.value;
    });
    $('#backupBtn').addEventListener('click', backupAll);
    $('#importBtn').addEventListener('click', function () { $('#importFile').click(); });
    $('#importFile').addEventListener('change', function () {
      if (this.files && this.files[0]) importBackup(this.files[0]);
      this.value = '';
    });
    $('#wipeBtn').addEventListener('click', wipeAll);

    // 代码块复制（事件委托）
    $('#messages').addEventListener('click', function (e) {
      var btn = e.target.closest('.copy-code-btn');
      if (btn) copyText(btn.dataset.code || '');
    });

    // 用户手动上滑时暂停自动吸附底部
    $('#messages').addEventListener('scroll', function () {
      var box = this;
      stickBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    load();
    if (!state.chats.length) {
      createChat(false);
    }
    if (!state.activeId || !activeChat()) {
      state.activeId = state.chats[0].id;
    }
    renderTheme();
    renderChatList();
    renderMessages();
    bindEvents();
    autoResize();
  }

  init();
})();
