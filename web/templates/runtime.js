/*
 * ShowMe 模板运行时：构建时内联进每个模板（替换 showme:runtime 占位标记）。
 * - 文本工具：esc / has / lines / period / rich / list
 * - A4 分页：模板声明纸张骨架与内容流，运行时按槽位高度把内容逐页排开
 * - 渲染契约：SM.mount(build) 定义 window.__showme_render(data)
 *
 * 分页标记（写在模板生成的 HTML 上）：
 *   data-flow="名称"  每页纸张中的内容槽位，高度固定
 *   data-u            分页单元（叶子级，单元内部不再断开）
 *   data-keep         与下一个单元同页（分节标题、条目抬头）
 *   data-avoid        较短时整体不拆分（单条经历）
 *   data-cont         运行时标在续页的克隆容器上，模板可据此去掉续页的分隔线等
 */
(function () {
  var SM = {};
  var MAX_PAGES = 50;
  /* 条目高度不超过槽位的这个比例时整条移到下一页，更长的条目按行拆分 */
  var AVOID_RATIO = 0.4;
  var BULLET = /^\s*(?:[•·●▪◦]|[-*](?!\d))\s*/;

  SM.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  SM.has = function (s) { return s != null && String(s).trim() !== ''; };
  SM.lines = function (arr) { return (arr || []).filter(SM.has); };
  SM.period = function (a, b) {
    if (SM.has(a) && SM.has(b)) return a + ' – ' + b;
    return SM.has(a) ? a : (SM.has(b) ? b : '');
  };

  /* 多行文本：回车换行，空行分段，以 - • · 开头的行显示为圆点列表；每行是一个分页单元 */
  SM.rich = function (text, cls) {
    var rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var out = '', items = '', listGap = '', gap = false, any = false;
    function flush() {
      if (items) out += '<ul class="rt-ul' + listGap + '">' + items + '</ul>';
      items = '';
    }
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i].replace(/\s+$/, '');
      if (!row.trim()) { flush(); gap = any; continue; }
      var g = gap ? ' rt-gap' : '';
      var m = BULLET.exec(row);
      if (m) {
        var body = row.slice(m[0].length);
        if (!body) continue;
        if (!items) listGap = g;
        items += '<li data-u>' + SM.esc(body) + '</li>';
      } else {
        flush();
        out += '<p class="rt-p' + g + '" data-u>' + SM.esc(row) + '</p>';
      }
      gap = false;
      any = true;
    }
    flush();
    return out ? '<div class="rt' + (cls ? ' ' + cls : '') + '">' + out + '</div>' : '';
  };

  /* 每项一条的列表（工作亮点）：去掉用户自己输入的圆点前缀 */
  SM.list = function (arr, cls) {
    var items = SM.lines(arr).map(function (x) {
      return '<li data-u>' + SM.esc(String(x).replace(BULLET, '')) + '</li>';
    }).join('');
    return items ? '<ul class="rt-ul' + (cls ? ' ' + cls : '') + '">' + items + '</ul>' : '';
  };

  function isFirst(node) {
    for (var p = node.previousSibling; p; p = p.previousSibling) {
      if (p.nodeType === 1 || (p.nodeType === 3 && p.nodeValue.trim())) return false;
    }
    return true;
  }

  function closestIn(node, selector, slot) {
    for (var n = node; n && n !== slot; n = n.parentNode) {
      if (n.nodeType === 1 && n.matches(selector)) return n;
    }
    return null;
  }

  /* 找到本页放不下的第一个单元，按 keep / avoid 规则回退，返回应移到下一页的起点单元。
     只用 getBoundingClientRect 比较，页面被 zoom / transform 缩放时结果不变 */
  function findBreak(slot) {
    var units = slot.querySelectorAll('[data-u]');
    var box = slot.getBoundingClientRect();
    var tol = box.height / 1000;
    var idx = -1;
    for (var i = 0; i < units.length; i++) {
      if (units[i].getBoundingClientRect().bottom > box.bottom + tol) { idx = i; break; }
    }
    if (idx < 0) return null;
    var b = idx;
    var block = closestIn(units[idx], '[data-avoid]', slot);
    if (block && block.getBoundingClientRect().height <= box.height * AVOID_RATIO) {
      var first = block.querySelector('[data-u]');
      for (var j = 0; j < units.length; j++) if (units[j] === first) { b = j; break; }
    }
    while (b > 0 && units[b - 1].hasAttribute('data-keep')) b--;
    if (b === 0) b = idx;
    if (b === 0) b = 1;
    return b < units.length ? units[b] : null;
  }

  /* 把 node 及其后的全部内容移到 target：沿祖先链克隆外层容器，保证续页结构与样式不变 */
  function splitAt(slot, node, target) {
    while (node.parentNode !== slot && isFirst(node)) node = node.parentNode;
    var cur = node, carry = null;
    for (;;) {
      var parent = cur.parentNode;
      var holder = target;
      if (parent !== slot) {
        holder = parent.cloneNode(false);
        holder.removeAttribute('id');
        holder.setAttribute('data-cont', '');
      }
      var n = cur;
      if (carry) { holder.appendChild(carry); n = cur.nextSibling; }
      while (n) { var next = n.nextSibling; holder.appendChild(n); n = next; }
      if (parent === slot) return;
      carry = holder;
      cur = parent;
    }
  }

  /*
   * 分页：opt.sheet(i) 返回第 i 页纸张骨架 HTML（含各 data-flow 槽位），opt.flows 为 { 槽位名: 内容 HTML }。
   * 返回 false 表示当前文档不可见、无法测量（此时内容全部留在第 1 页，待可见后重排）。
   */
  SM.paginate = function (root, opt) {
    var pages = [];
    root.innerHTML = '';
    function page(i) {
      while (pages.length <= i) {
        var wrap = document.createElement('div');
        wrap.innerHTML = opt.sheet(pages.length);
        var sheet = wrap.firstElementChild;
        root.appendChild(sheet);
        pages.push(sheet);
      }
      return pages[i];
    }
    function slotOf(i, name) { return page(i).querySelector('[data-flow="' + name + '"]'); }

    var ok = true;
    page(0);
    Object.keys(opt.flows).forEach(function (name) {
      var slot = slotOf(0, name);
      if (!slot) return;
      slot.innerHTML = opt.flows[name] || '';
      if (!ok || !slot.getBoundingClientRect().height) { ok = false; return; }
      for (var i = 1; i < MAX_PAGES; i++) {
        var cut = findBreak(slot);
        if (!cut) break;
        var next = slotOf(i, name);
        splitAt(slot, cut, next);
        slot = next;
      }
    });
    root.setAttribute('data-pages', String(pages.length));
    return ok;
  };

  /* build(data) 返回 { sheet, flows }；不可见时记为待重排，尺寸变化或字体就绪后重排 */
  SM.mount = function (build) {
    var last = null, dirty = false;
    function render(data) {
      last = data || {};
      /* 主题：数据顶层可选 showmeTheme（变量定义见 runtime.css 的 html[data-theme]） */
      var theme = typeof last.showmeTheme === 'string' ? last.showmeTheme : '';
      if (theme) document.documentElement.setAttribute('data-theme', theme);
      else document.documentElement.removeAttribute('data-theme');
      dirty = !SM.paginate(document.getElementById('app'), build(last));
    }
    window.__showme_render = render;
    window.addEventListener('resize', function () { if (dirty && last) render(last); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (last) render(last); });
    }
    if (window.__SHOWME_DATA__) render(window.__SHOWME_DATA__);
  };

  window.SM = SM;
})();
