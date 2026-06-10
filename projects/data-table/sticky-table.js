/**
 * StickyTable — 通用表头吸顶插件
 *
 * 原理：页面滚动时克隆一份 <thead>，用 position: fixed 固定在视口顶部。
 * 宽度同步由 ResizeObserver 驱动（不在 scroll 中触发布局），
 * scroll 只做显隐判断和 left 位置同步。
 *
 * 使用:
 *   new StickyTable('.table-wrapper');
 *   new StickyTable(element, { top: 60, zIndex: 100 });
 *
 * 方法:
 *   update()  — 列结构变化后手动重同步
 *   destroy() — 清理事件与 DOM
 */
class StickyTable {
  constructor(el, options) {
    if (typeof el === 'string') {
      el = document.querySelector(el);
    }
    if (!el) {
      throw new Error(`[StickyTable] element not found: ${el}`);
    }

    this.wrapper = el;
    this.options = {
      top: 0,
      zIndex: 1000,
      containerSelector: '.table-container',
      className: 'sticky-header-wrapper',
      ...options,
    };

    this._init();
  }

  // ==================== 内部方法 ====================

  _init() {
    // 1. 查找关键元素
    this.container = this.wrapper.querySelector(this.options.containerSelector);
    if (!this.container) {
      throw new Error('[StickyTable] .table-container not found');
    }

    this.table = this.container.querySelector('table');
    if (!this.table) {
      throw new Error('[StickyTable] <table> not found');
    }

    // 缓存 thead 引用，update() 时重新获取
    this._cacheThead();

    // 2. 创建克隆 DOM
    this._createClone();

    // 3. 绑定事件（先 bind 再注册，保证可移除）
    this._boundOnScroll = this._onScroll.bind(this);
    this._boundOnContainerScroll = this._onContainerScroll.bind(this);

    window.addEventListener('scroll', this._boundOnScroll, { passive: true });
    window.addEventListener('resize', this._boundOnScroll);
    this.container.addEventListener('scroll', this._boundOnContainerScroll);

    // 4. ResizeObserver：容器尺寸变化时同步宽度
    this._resizeObserver = new ResizeObserver(() => this._syncWidths());
    this._resizeObserver.observe(this.container);

    // 5. 首次检查
    this._onScroll();
  }

  /** 缓存原始 thead 引用 */
  _cacheThead() {
    this.thead = this.table.querySelector('thead');
    if (!this.thead) {
      throw new Error('[StickyTable] <thead> not found');
    }
  }

  /** 创建克隆 DOM（插入到 .table-container 前面） */
  _createClone() {
    this._removeClone();

    this.cloneWrapper = document.createElement('div');
    this.cloneWrapper.className = this.options.className;
    this.cloneWrapper.style.cssText = [
      'position:fixed',
      `top:${this.options.top}px`,
      `z-index:${this.options.zIndex}`,
      'overflow:hidden',
      'display:none',
    ].join(';');

    this.cloneTable = document.createElement('table');
    this.cloneTable.style.cssText = 'border-collapse:collapse;margin:0';
    this.cloneTable.appendChild(this.thead.cloneNode(true));
    this.cloneWrapper.appendChild(this.cloneTable);

    this.wrapper.insertBefore(this.cloneWrapper, this.container);
  }

  /** 移除克隆 DOM */
  _removeClone() {
    if (this.cloneWrapper && this.cloneWrapper.parentNode) {
      this.cloneWrapper.parentNode.removeChild(this.cloneWrapper);
    }
    this.cloneWrapper = null;
    this.cloneTable = null;
  }

  /** scroll / resize 事件处理：显隐判断 + left 位置同步 */
  _onScroll() {
    const rect = this.wrapper.getBoundingClientRect();
    const offset = this.options.top;
    const active = rect.top < offset && rect.bottom > offset;

    // 状态切换 → 触发宽度同步
    if (active !== this._lastActive) {
      if (active) {
        this._syncWidths();
      }
      this._lastActive = active;
    }

    this.cloneWrapper.style.display = active ? 'block' : 'none';

    if (active) {
      this.cloneWrapper.style.left = rect.left + 'px';
    }
  }

  /** 横向滚动同步（不检查 active，确保隐藏时位置也被记录） */
  _onContainerScroll() {
    this.cloneWrapper.scrollLeft = this.container.scrollLeft;
  }

  /** 同步宽度与列宽（可能触发布局，仅 ResizeObserver / update 时调用） */
  _syncWidths() {
    if (!this.cloneWrapper || !this.cloneTable) return;

    const containerRect = this.container.getBoundingClientRect();
    this.cloneWrapper.style.width = containerRect.width + 'px';
    this.cloneTable.style.width = this.table.offsetWidth + 'px';

    const originalThs = this.thead.querySelectorAll('th');
    const cloneThs = this.cloneTable.querySelectorAll('th');
    for (let i = 0; i < originalThs.length; i++) {
      if (cloneThs[i]) {
        const w = originalThs[i].offsetWidth;
        cloneThs[i].style.width = w + 'px';
        cloneThs[i].style.minWidth = w + 'px';
      }
    }
  }

  // ==================== 公开方法 ====================

  /** 列结构变化后手动重同步（如列显隐、列宽拖拽） */
  update() {
    this._cacheThead();
    // 替换克隆表中的 thead
    const oldCloneThead = this.cloneTable.querySelector('thead');
    if (oldCloneThead) {
      oldCloneThead.remove();
    }
    this.cloneTable.appendChild(this.thead.cloneNode(true));
    this._syncWidths();
  }

  /** 清理事件、Observer、DOM */
  destroy() {
    window.removeEventListener('scroll', this._boundOnScroll);
    window.removeEventListener('resize', this._boundOnScroll);
    if (this.container) {
      this.container.removeEventListener('scroll', this._boundOnContainerScroll);
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    this._removeClone();
    this.wrapper = null;
    this.container = null;
    this.table = null;
    this.thead = null;
  }
}
