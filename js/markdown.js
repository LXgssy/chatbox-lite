/* =====================================================
   轻量 Markdown 渲染器（零依赖，安全转义）
   支持：标题 / 粗斜体 / 删除线 / 行内代码 / 代码块(高亮+复制)
        列表 / 引用 / 表格 / 链接 / 分隔线
   ===================================================== */
(function (global) {
  'use strict';

  var ST = '\u0000'; // 占位符分隔字符

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------------- 代码高亮（极简） ---------------- */
  var KEYWORDS = {
    js: 'const let var function return if else for while do break continue new class extends super this typeof instanceof null undefined true false async await try catch finally throw switch case default import export from delete in of void yield static get set',
    python: 'def return if elif else for while break continue class import from as pass None True False and or not in is lambda try except finally raise with yield global nonlocal assert del async await match case',
    json: 'true false null',
    generic: 'if else for while return break continue function var let const class new this null true false import export from def end do then fi esac in is not and or public private protected static void int float double string bool char struct enum switch case default try catch finally throw package interface implements extends'
  };
  var HASH_COMMENT_LANGS = { python: 1, py: 1, sh: 1, bash: 1, shell: 1, yaml: 1, yml: 1, toml: 1, ruby: 1, rb: 1, r: 1, perl: 1, ini: 1, conf: 1, makefile: 1 };

  function keywordsFor(lang) {
    var l = (lang || '').toLowerCase();
    if (l === 'javascript' || l === 'js' || l === 'typescript' || l === 'ts' || l === 'jsx' || l === 'tsx' || l === 'node' || l === 'nodejs') return KEYWORDS.js;
    if (l === 'python' || l === 'py') return KEYWORDS.python;
    if (l === 'json') return KEYWORDS.json;
    return KEYWORDS.generic;
  }

  function highlightCode(raw, lang) {
    var l = (lang || '').toLowerCase();
    var kw = keywordsFor(lang).split(/\s+/).join('|');
    // 捕获组顺序恒定：1=注释 2=#注释 3=字符串 4=关键字 5=数字
    var hashGroup = HASH_COMMENT_LANGS[l] ? '((?:^|\\s)#[^\\n]*)' : '(\u0000\u0000nope)';
    var re = new RegExp(
      '(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)' +
      '|' + hashGroup +
      '|("(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`)' +
      '|\\b(' + kw + ')\\b' +
      '|\\b(\\d+(?:\\.\\d+)?)\\b', 'g');
    var parts = [];
    var last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) parts.push(escapeHtml(raw.slice(last, m.index)));
      var cls;
      if (m[1] != null) cls = 'tok-com';
      else if (m[2] != null) cls = 'tok-com';
      else if (m[3] != null) cls = 'tok-str';
      else if (m[4] != null) cls = 'tok-key';
      else cls = 'tok-num';
      parts.push('<span class="' + cls + '">' + escapeHtml(m[0]) + '</span>');
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < raw.length) parts.push(escapeHtml(raw.slice(last)));
    return parts.join('');
  }

  /* ---------------- 主渲染函数 ---------------- */
  function renderMarkdown(src) {
    if (src == null) return '';
    src = String(src).replace(/\r\n?/g, '\n');

    // 流式输出时，未闭合的代码块自动补闭合围栏
    var fences = (src.match(/```/g) || []).length;
    if (fences % 2 === 1) src += '\n```';

    /* 1. 摘出代码块 */
    var codeBlocks = [];
    src = src.replace(/```([\w+#.-]*)[^\S\n]*\n?([\s\S]*?)(?:```|$)/g, function (_, lang, code) {
      var i = codeBlocks.length;
      codeBlocks.push({ lang: lang || '', code: code.replace(/\n$/, '') });
      return ST + 'CB' + i + ST;
    });

    /* 2. 转义其余文本 */
    src = escapeHtml(src);

    /* 3. 摘出行内代码 */
    var inlineCodes = [];
    src = src.replace(/`([^`\n]+)`/g, function (_, c) {
      var i = inlineCodes.length;
      inlineCodes.push('<code class="inline">' + c + '</code>');
      return ST + 'IC' + i + ST;
    });

    /* 4. 摘出链接与裸链接 */
    var links = [];
    src = src.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, text, url) {
      var i = links.length;
      links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>');
      return ST + 'LK' + i + ST;
    });
    src = src.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, function (_, pre, url) {
      var i = links.length;
      links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
      return pre + ST + 'LK' + i + ST;
    });

    /* 5. 行内格式 */
    src = src.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    src = src.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    src = src.replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1<em>$2</em>');
    src = src.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

    /* 6. 逐行解析块级结构 */
    var lines = src.split('\n');
    var out = [];
    var para = [];
    var listStack = [];   // {type:'ul'|'ol', indent}
    var inQuote = [];

    function flushPara() {
      if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; }
    }
    function closeListsTo(level) {
      while (listStack.length > level) {
        out.push('</li></' + listStack.pop().type + '>');
      }
    }
    function flushQuote() {
      if (inQuote.length) { out.push('<blockquote><p>' + inQuote.join('<br>') + '</p></blockquote>'); inQuote = []; }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // 代码块占位行
      var cbMatch = line.match(new RegExp('^' + ST + 'CB(\\d+)' + ST + '$'));
      if (cbMatch) {
        flushPara(); closeListsTo(0); flushQuote();
        var cb = codeBlocks[+cbMatch[1]];
        var langLabel = cb.lang ? escapeHtml(cb.lang) : '代码';
        out.push(
          '<div class="codeblock"><div class="codebar"><span>' + langLabel +
          '</span><button class="copy-code-btn" type="button" data-code="' + escapeHtml(cb.code) + '">复制</button></div>' +
          '<pre><code>' + highlightCode(cb.code, cb.lang) + '</code></pre></div>'
        );
        continue;
      }

      // 空行
      if (/^\s*$/.test(line)) { flushPara(); closeListsTo(0); flushQuote(); continue; }

      // 标题
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara(); closeListsTo(0); flushQuote();
        var lvl = h[1].length;
        out.push('<h' + lvl + '>' + h[2] + '</h' + lvl + '>');
        continue;
      }

      // 分隔线
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushPara(); closeListsTo(0); flushQuote();
        out.push('<hr>');
        continue;
      }

      // 引用
      var q = line.match(/^\s*&gt;\s?(.*)$/);
      if (q) {
        flushPara(); closeListsTo(0);
        inQuote.push(q[1]);
        continue;
      }

      // 表格
      if (line.indexOf('|') !== -1 && i + 1 < lines.length &&
          /^\s*\|?\s*:?-{2,}[-:\s|]*$/.test(lines[i + 1]) && lines[i + 1].indexOf('|') !== -1) {
        flushPara(); closeListsTo(0); flushQuote();
        var parseRow = function (row) {
          var cells = row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
          return cells.map(function (c) { return c.trim(); });
        };
        var thead = parseRow(lines[i]);
        var html = '<table><thead><tr>';
        thead.forEach(function (c) { html += '<th>' + c + '</th>'; });
        html += '</tr></thead><tbody>';
        i += 2; // 跳过表头与分隔行
        while (i < lines.length && lines[i].indexOf('|') !== -1 && !/^\s*$/.test(lines[i])) {
          html += '<tr>';
          parseRow(lines[i]).forEach(function (c) { html += '<td>' + c + '</td>'; });
          html += '</tr>';
          i++;
        }
        i--;
        html += '</tbody></table>';
        out.push(html);
        continue;
      }

      // 列表
      var li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushPara(); flushQuote();
        var indent = li[1].replace(/\t/g, '  ').length;
        var level = Math.min(Math.floor(indent / 2), 4);
        var ordered = /\d/.test(li[2]);
        var type = ordered ? 'ol' : 'ul';

        while (listStack.length > level) out.push('</li></' + listStack.pop().type + '>');
        if (listStack.length === level + 1 && listStack[level] && listStack[level].type !== type) {
          out.push('</li></' + listStack.pop().type + '>');
        }
        if (listStack.length < level + 1) {
          out.push('<' + type + '><li>' + li[3]);
          listStack.push({ type: type });
        } else {
          out.push('</li><li>' + li[3]);
        }
        continue;
      }

      // 普通段落行
      closeListsTo(0); flushQuote();
      para.push(line);
    }
    flushPara(); closeListsTo(0); flushQuote();

    /* 7. 还原占位符 */
    var html2 = out.join('');
    html2 = html2.replace(new RegExp(ST + 'IC(\\d+)' + ST, 'g'), function (_, i) { return inlineCodes[+i]; });
    html2 = html2.replace(new RegExp(ST + 'LK(\\d+)' + ST, 'g'), function (_, i) { return links[+i]; });
    return html2;
  }

  global.MD = { render: renderMarkdown, escapeHtml: escapeHtml, highlight: highlightCode };
})(window);
