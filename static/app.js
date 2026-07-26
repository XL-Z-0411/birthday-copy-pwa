// ===== 每日生日文案 PWA =====

const App = {
  currentTab: 'forOthers',
  currentPage: 'home',
  todayData: { forOthers: [], forSelf: [] },
  favorites: [],
  history: {},

  // ===== 初始化 =====
  async init() {
    this.loadFavorites();
    this.updateDate();
    this.bindEvents();
    this.registerSW();
    await this.loadTodayData();
  },

  // ===== 更新日期显示 =====
  updateDate() {
    const now = new Date();
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weeks[now.getDay()]}`;
    document.getElementById('todayDate').textContent = dateStr;
  },

  // ===== 绑定事件 =====
  bindEvents() {
    // 分类切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        this.renderCopyList();
      });
    });

    // 底部导航
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        this.switchPage(page);
      });
    });

    // 返回按钮
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchPage('home');
      });
    });
  },

  // ===== 加载今日数据 =====
  async loadTodayData() {
    try {
      const today = this.getTodayKey();
      let data = null;

      // 检查今天是否已缓存
      const cached = localStorage.getItem(`data_${today}`);
      if (cached) {
        data = JSON.parse(cached);
      }

      if (!data) {
        // 今天第一次打开：从文案库选今日文案
        data = await this.loadBuiltinData();
        // 标记日期并缓存
        data.date = today;
        data.isNew = true;
        localStorage.setItem(`data_${today}`, JSON.stringify(data));
        
        // 累积到总库（往期文案）
        this.addToAccumulated(data);
      }

      this.todayData = data;
      this.updateCounts();
      this.renderCopyList();
      this.hideLoading();
    } catch (e) {
      console.error('加载数据失败:', e);
      // 使用内置数据
      this.todayData = await this.loadBuiltinData();
      this.updateCounts();
      this.renderCopyList();
      this.hideLoading();
    }
  },

  // ===== 累积到往期文案库 =====
  addToAccumulated(dailyData) {
    let acc = JSON.parse(localStorage.getItem('accumulated') || '{"records":[]}');
    // 避免重复添加同一天
    const exists = acc.records.find(r => r.date === dailyData.date);
    if (!exists) {
      acc.records.push({
        date: dailyData.date,
        forOthers: dailyData.forOthers || [],
        forSelf: dailyData.forSelf || []
      });
      localStorage.setItem('accumulated', JSON.stringify(acc));
    }
  },

  // ===== 加载内置数据 =====
  async loadBuiltinData() {
    try {
      const res = await fetch('./data/copywriting.json');
      if (res.ok) {
        const allData = await res.json();
        // 按日期选取当日文案
        return this.selectDailyData(allData);
      }
    } catch (e) {
      console.error('加载内置数据失败:', e);
    }
    return { forOthers: [], forSelf: [] };
  },

  // ===== 按日期选取每日数据（轮换） =====
  selectDailyData(allData) {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    
    const others = allData.forOthers || [];
    const selfs = allData.forSelf || [];

    // 每天轮换选取 20 条
    const selectDaily = (arr, count) => {
      if (arr.length <= count) return arr;
      const start = (dayOfYear * count) % arr.length;
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(arr[(start + i) % arr.length]);
      }
      return result;
    };

    return {
      forOthers: selectDaily(others, 20),
      forSelf: selectDaily(selfs, 20)
    };
  },

  // ===== 获取今日日期 key =====
  getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  },

  // ===== 更新数量 =====
  updateCounts() {
    document.getElementById('countOthers').textContent = this.todayData.forOthers.length;
    document.getElementById('countSelf').textContent = this.todayData.forSelf.length;
  },

  // ===== 隐藏加载状态 =====
  hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  },

  // ===== 渲染文案列表 =====
  renderCopyList() {
    const list = this.todayData[this.currentTab] || [];
    const container = document.getElementById('copyList');
    
    if (list.length === 0) {
      const emptyIcon = this.currentTab === 'forOthers' ? '礼' : '我';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${emptyIcon}</div>
          <p>暂无文案</p>
        </div>
      `;
      return;
    }

    const isSelf = this.currentTab === 'forSelf';
    const tagText = isSelf ? '自己生日' : '祝他人';
    
    container.innerHTML = list.map((item, idx) => {
      const text = typeof item === 'string' ? item : item.text;
      const tag = typeof item === 'object' && item.tag ? item.tag : tagText;
      const favKey = this.getFavKey(text);
      const isFav = this.favorites.includes(favKey);
      
      return `
        <div class="copy-card">
          <div class="copy-card-header">
            <span class="copy-tag ${isSelf ? 'for-self' : ''}">${tag}</span>
            <span class="copy-number">#${idx + 1}</span>
          </div>
          <div class="copy-text">${this.escapeHtml(text)}</div>
          <div class="copy-actions">
            <button class="action-btn fav-btn ${isFav ? 'active' : ''}" data-action="fav" data-text="${this.escapeAttr(text)}" data-key="${favKey}">
              <span>${isFav ? '★' : '☆'}</span>
              <span>${isFav ? '已收藏' : '收藏'}</span>
            </button>
            <button class="action-btn copy-btn" data-action="copy" data-text="${this.escapeAttr(text)}">
              <span>复制</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定卡片事件
    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const text = btn.dataset.text;
        const key = btn.dataset.key;
        if (action === 'copy') {
          this.copyText(text, btn);
        } else if (action === 'fav') {
          this.toggleFav(text, key, btn);
        }
      });
    });
  },

  // ===== 复制文案 =====
  async copyText(text, btn) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // 兼容方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = 0;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showToast('已复制到剪贴板');
      btn.style.transform = 'scale(0.9)';
      setTimeout(() => btn.style.transform = '', 200);
    } catch (e) {
      this.showToast('复制失败，请长按选择');
    }
  },

  // ===== 收藏相关 =====
  getFavKey(text) {
    return btoa(unescape(encodeURIComponent(text))).slice(0, 20);
  },

  toggleFav(text, key, btn) {
    const idx = this.favorites.indexOf(key);
    if (idx > -1) {
      // 取消收藏
      this.favorites.splice(idx, 1);
      localStorage.removeItem(`fav_${key}`);
      btn.classList.remove('active');
      btn.innerHTML = '<span>☆</span><span>收藏</span>';
      this.showToast('已取消收藏');
    } else {
      // 收藏
      this.favorites.push(key);
      localStorage.setItem(`fav_${key}`, JSON.stringify({
        text,
        time: Date.now(),
        type: this.currentTab
      }));
      btn.classList.add('active');
      btn.innerHTML = '<span>★</span><span>已收藏</span>';
      this.showToast('已收藏');
    }
    this.updateFavBadge();
  },

  loadFavorites() {
    this.favorites = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('fav_')) {
        this.favorites.push(k.replace('fav_', ''));
      }
    }
    this.updateFavBadge();
  },

  updateFavBadge() {
    const badge = document.getElementById('favBadge');
    if (this.favorites.length > 0) {
      badge.style.display = 'flex';
      badge.textContent = this.favorites.length;
    } else {
      badge.style.display = 'none';
    }
  },

  renderFavorites() {
    const container = document.getElementById('favList');
    const favs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('fav_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k));
          favs.push(item);
        } catch (e) {}
      }
    }
    favs.sort((a, b) => b.time - a.time);

    if (favs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">★</div>
          <p>还没有收藏的文案</p>
          <p class="empty-hint">点击文案右下角的星标即可收藏</p>
        </div>
      `;
      return;
    }

    container.innerHTML = favs.map((item, idx) => {
      const tagText = item.type === 'forSelf' ? '自己生日' : '祝他人';
      const tagClass = item.type === 'forSelf' ? 'for-self' : '';
      return `
        <div class="copy-card">
          <div class="copy-card-header">
            <span class="copy-tag ${tagClass}">${tagText}</span>
            <span class="copy-number">${this.formatDate(item.time)}</span>
          </div>
          <div class="copy-text">${this.escapeHtml(item.text)}</div>
          <div class="copy-actions">
            <button class="action-btn copy-btn" data-action="copy" data-text="${this.escapeAttr(item.text)}">
              <span>复制</span>
            </button>
            <button class="action-btn fav-btn active" data-action="delfav" data-text="${this.escapeAttr(item.text)}">
              <span>移除</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const text = btn.dataset.text;
        if (action === 'copy') {
          this.copyText(text, btn);
        } else if (action === 'delfav') {
          const key = this.getFavKey(text);
          const idx = this.favorites.indexOf(key);
          if (idx > -1) this.favorites.splice(idx, 1);
          localStorage.removeItem(`fav_${key}`);
          this.updateFavBadge();
          this.renderFavorites();
          this.showToast('已移除');
        }
      });
    });
  },

  // ===== 往期文案 =====
  renderHistory() {
    const container = document.getElementById('historyList');
    
    // 优先从累积库读取
    let histories = [];
    const acc = JSON.parse(localStorage.getItem('accumulated') || '{"records":[]}');
    if (acc.records && acc.records.length > 0) {
      histories = acc.records.map(r => ({ date: r.date, data: r }));
    } else {
      // 兼容旧版：从 data_ 缓存读取
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('data_')) {
          try {
            const data = JSON.parse(localStorage.getItem(k));
            const date = k.replace('data_', '');
            histories.push({ date, data });
          } catch (e) {}
        }
      }
    }

    histories.sort((a, b) => b.date.localeCompare(a.date));

    if (histories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">往</div>
          <p>往期文案将在这里展示</p>
          <p class="empty-hint">每天打开 App 后会自动保存当日文案</p>
        </div>
      `;
      return;
    }

    container.innerHTML = histories.map(h => {
      const others = h.data.forOthers || [];
      const selfs = h.data.forSelf || [];
      const preview = others[0] ? (typeof others[0] === 'string' ? others[0] : others[0].text) : 
                       (selfs[0] ? (typeof selfs[0] === 'string' ? selfs[0] : selfs[0].text) : '');
      const total = others.length + selfs.length;
      return `
        <div class="history-item" data-date="${h.date}">
          <div class="history-date">${h.date} <span class="history-count">共 ${total} 条</span></div>
          <div class="history-preview">${this.escapeHtml(preview)}</div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const date = item.dataset.date;
        // 先从累积库找
        const acc = JSON.parse(localStorage.getItem('accumulated') || '{"records":[]}');
        const record = acc.records.find(r => r.date === date);
        let data;
        if (record) {
          data = record;
        } else {
          data = JSON.parse(localStorage.getItem(`data_${date}`));
        }
        if (data) {
          this.todayData = data;
          this.updateCounts();
          this.switchPage('home');
          this.renderCopyList();
          this.showToast(`已切换到 ${date} 的文案`);
        }
      });
    });
  },

  // ===== 页面切换 =====
  switchPage(page) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');
    
    // 隐藏所有页面
    document.getElementById('app').style.display = 'none';
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    
    if (page === 'home') {
      document.getElementById('app').style.display = 'block';
    } else {
      document.getElementById(`page-${page}`).style.display = 'block';
      if (page === 'favorites') this.renderFavorites();
      if (page === 'history') this.renderHistory();
    }
    
    this.currentPage = page;
    window.scrollTo(0, 0);
  },

  // ===== 注册 Service Worker =====
  async registerSW() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (e) {
        console.log('SW 注册失败:', e);
      }
    }
  },

  // ===== Toast =====
  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  },

  // ===== 工具函数 =====
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  formatDate(timestamp) {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
};

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
