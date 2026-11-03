/* =====================================================
   轻聊 Chatbox · 纯绘制 SVG 图标库
   —— 所有图形均为代码手写的矢量路径（stroke/fill）
   不使用任何第三方图标库、图片文件或 emoji
   ===================================================== */
(function () {
  'use strict';

  /* 线性图标：24x24 视窗，跟随文字颜色（currentColor） */
  var S = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
          'stroke-linejoin="round" aria-hidden="true"';

  window.ICONS = {
    /* 三横线（打开会话列表） */
    menu: '<svg ' + S + '><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>',
    /* 加号（新建） */
    plus: '<svg ' + S + '><path d="M12 5v14M5 12h14"/></svg>',
    /* 叉号（关闭） */
    x: '<svg ' + S + '><path d="M6 6l12 12M18 6L6 18"/></svg>',
    /* 滑杆（设置） */
    gear: '<svg ' + S + '><path d="M5 7h4.6M14.4 7H19M5 17h7.6M17.4 17H19"/>' +
          '<circle cx="12" cy="7" r="2.4"/><circle cx="15" cy="17" r="2.4"/></svg>',
    /* 月牙（深色模式） */
    moon: '<svg ' + S + '><path d="M20.9 13.1A8.3 8.3 0 1 1 10.9 3.1a6.6 6.6 0 0 0 10 10z"/></svg>',
    /* 太阳（浅色模式） */
    sun: '<svg ' + S + '><circle cx="12" cy="12" r="4.2"/>' +
         '<path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5"/></svg>',
    /* 托盘向上箭头（导出） */
    export: '<svg ' + S + '><path d="M12 14.5V4M8 7.5l4-4 4 4M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/></svg>',
    /* 托盘向下箭头（导入） */
    'import': '<svg ' + S + '><path d="M12 3.5V14M8 10.5l4 4 4-4M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/></svg>',
    /* 垃圾桶（删除会话） */
    trash: '<svg ' + S + '><path d="M4 6.5h16M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/>' +
           '<path d="M6.2 6.5l.9 12.2a1.8 1.8 0 0 0 1.8 1.7h6.2a1.8 1.8 0 0 0 1.8-1.7l.9-12.2M10 10.5v6M14 10.5v6"/></svg>',
    /* 铅笔（重命名） */
    pencil: '<svg ' + S + '><path d="M4.5 19.5l.9-3.6L15.9 5.4a2.1 2.1 0 0 1 3 3L8.4 18.9l-3.9.6zM13.8 7.5l2.7 2.7"/></svg>',
    /* 对话气泡（空状态等） */
    chat: '<svg ' + S + '><path d="M12 3.8c-4.6 0-8.2 3-8.2 6.7 0 2 1 3.7 2.7 4.9l-.7 3.4 3.6-1.7c.8.2 1.7.3 2.6.3 4.6 0 8.2-3 8.2-6.9s-3.6-6.7-8.2-6.7z"/></svg>',
    /* 双矩形（复制） */
    copy: '<svg ' + S + '><rect x="9" y="9" width="11.5" height="11.5" rx="2.2"/>' +
          '<path d="M5.5 14.8h-1a2.3 2.3 0 0 1-2.3-2.3V5.2a2.3 2.3 0 0 1 2.3-2.3h7.3a2.3 2.3 0 0 1 2.3 2.3v1"/></svg>'
  };

  /* 头像图形：填充路径，{fg}=前景（图形主体），{bg}=背景色（透出反色细节） */
  var AVATAR_SHAPES = {
    /* 机器人 */
    bot: '<rect x="5.4" y="8.6" width="13.2" height="10.2" rx="3" fill="{fg}"/>' +
         '<rect x="11.4" y="5.6" width="1.2" height="2.6" fill="{fg}"/>' +
         '<circle cx="12" cy="4.6" r="1.6" fill="{fg}"/>' +
         '<rect x="8.5" y="11.8" width="2.3" height="2.7" rx="1.1" fill="{bg}"/>' +
         '<rect x="13.2" y="11.8" width="2.3" height="2.7" rx="1.1" fill="{bg}"/>' +
         '<rect x="10" y="16.1" width="4" height="1.2" rx=".6" fill="{bg}"/>',
    /* 人像 */
    user: '<circle cx="12" cy="8.8" r="3.7" fill="{fg}"/>' +
          '<path d="M4.9 20.4a7.1 7.1 0 0 1 14.2 0v.2H4.9z" fill="{fg}"/>',
    /* 猫 */
    cat: '<circle cx="12" cy="13.4" r="7" fill="{fg}"/>' +
         '<path d="M6.6 9.7 5 4.4l4.6 2.1zM17.4 9.7 19 4.4l-4.6 2.1z" fill="{fg}"/>' +
         '<circle cx="9.5" cy="12.9" r="1" fill="{bg}"/>' +
         '<circle cx="14.5" cy="12.9" r="1" fill="{bg}"/>' +
         '<path d="M11 15.4h2l-1 1.6z" fill="{bg}"/>',
    /* 星星 */
    star: '<path d="M12 3.4l2.6 5.2 5.8.9-4.2 4.1 1 5.7L12 16.6l-5.2 2.7 1-5.7-4.2-4.1 5.8-.9z" fill="{fg}"/>',
    /* 月亮 */
    moon: '<path d="M14.9 3.6a8.7 8.7 0 1 0 5.7 12A7.1 7.1 0 0 1 14.9 3.6z" fill="{fg}"/>',
    /* 爱心 */
    heart: '<path d="M12 20.1l-1.4-1.3C5.9 14.6 3.2 12 3.2 8.8c0-2.6 2-4.6 4.6-4.6 1.5 0 3 .7 4.2 2 1.2-1.3 2.7-2 4.2-2 2.6 0 4.6 2 4.6 4.6 0 3.2-2.7 5.8-7.4 10z" fill="{fg}"/>',
    /* 小幽灵 */
    ghost: '<path d="M12 3.4a7 7 0 0 0-7 7v9.4l2.33-1.8 2.34 1.8 2.33-1.8 2.33 1.8 2.34-1.8L19 19.8v-9.4a7 7 0 0 0-7-7z" fill="{fg}"/>' +
           '<circle cx="9.4" cy="10.3" r="1.05" fill="{bg}"/>' +
           '<circle cx="14.6" cy="10.3" r="1.05" fill="{bg}"/>',
    /* 闪电 */
    bolt: '<path d="M13.2 2.6 5 13.6h5.4l-.4 7.8L19 10.4h-5.4z" fill="{fg}"/>'
  };

  var ORDER = ['bot', 'user', 'cat', 'star', 'moon', 'heart', 'ghost', 'bolt'];
  var NAMES = { bot: '机器人', user: '人像', cat: '小猫', star: '星星', moon: '月亮', heart: '爱心', ghost: '小幽灵', bolt: '闪电' };

  /* 生成彩色圆形头像 SVG（消息、空状态使用） */
  function avatarSvg(shape, color) {
    var body = (AVATAR_SHAPES[shape] || AVATAR_SHAPES.bot)
      .replace(/\{fg\}/g, '#ffffff')
      .replace(/\{bg\}/g, color);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="12" fill="' + color + '"/>' + body + '</svg>';
  }

  /* 生成中性色图形预览（设置面板的图形选择按钮使用） */
  function shapePreviewSvg(shape) {
    var body = (AVATAR_SHAPES[shape] || AVATAR_SHAPES.bot)
      .replace(/\{fg\}/g, 'currentColor')
      .replace(/\{bg\}/g, 'var(--panel-2)');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  window.AVATARS = {
    order: ORDER,
    names: NAMES,
    avatarSvg: avatarSvg,
    shapePreviewSvg: shapePreviewSvg
  };
})();
