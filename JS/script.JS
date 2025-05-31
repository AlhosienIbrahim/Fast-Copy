/**
 * Enhanced Line Manager - Optimized Version
 * Improved performance, reduced size, better error handling
 */

// Core configuration
const CFG = {
  STORAGE: { LINES: 'savedLines', INDEX: 'savedIndex', MODE: 'mode', CLIPBOARD: 'clipboardPermission' },
  ANIMATION_MS: 300,
  ELEMENTS: ['inputText', 'genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn', 'status', 'progressFill', 'requestClipboardBtn'],
  MSG: {
    ENTER_TEXT: 'من فضلك أدخل بعض النصوص أولاً.',
    LIST_ENDED: 'انتهت القائمة',
    NO_MORE_LINES: 'لا توجد سطور أخرى لنسخها.',
    NO_PREVIOUS: 'لا يوجد سابق',
    NO_PREVIOUS_LINE: 'لا يوجد سطر سابق لنسخه.',
    INVALID_NUMBER: 'رقم غير صالح.',
    COPY_ALL_SUCCESS: 'تم نسخ جميع السطور بنجاح.',
    COPY_ALL_ERROR: 'حدث خطأ أثناء نسخ الكل.',
    CLIPBOARD_ERROR: 'فشل النسخ! يرجى السماح بالوصول إلى الحافظة.',
    NO_DATA: 'لا توجد بيانات',
    NO_SAVED_DATA: 'لا يوجد بيانات محفوظة للاستئناف.',
    ALLOW_CLIPBOARD: 'السماح بالوصول إلى الحافظة؟',
    CLIPBOARD_NEEDED: 'هذا ضروري لتمكين خاصية النسخ التلقائي.',
    YES_ALLOW: 'نعم، اسمح بذلك',
    NO: 'لا',
    DONE: 'تم!',
    ACCESS_GRANTED: 'تم منح إذن الوصول بنجاح.',
    ERROR: 'خطأ!',
    ACCESS_FAILED: 'فشل الوصول إلى الحافظة: ',
    TRY_AGAIN: 'حاول مرة أخرى',
    CANCEL: 'إلغاء',
    NOTE: 'ملاحظة',
    BROWSER_SETTINGS: 'يمكنك تفعيل الوصول للحافظة من إعدادات المتصفح.',
    COPY_BY_NUMBER: 'نسخ حسب الرقم',
    ENTER_LINE_NUMBER: 'أدخل رقم السطر (من 1 إلى {{max}})',
    COPY: 'نسخ',
    COPIED_STATUS: '📌 تم النسخ: {{current}} من {{total}}',
    SUCCESS: 'تم!'
  }
};

// Utilities
const utils = {
  safeJSON: (str, fallback = null) => {
    try { return JSON.parse(str); } catch { return fallback; }
  },
  
  debounce: (fn, ms) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), ms);
    };
  },
  
  isEmpty: text => !text?.trim(),
  
  format: (template, params = {}) => 
    template.replace(/\{\{(\w+)\}\}/g, (match, key) => params[key] || match)
};

// Storage Manager
class Storage {
  static save(key, data) {
    try {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
    } catch (e) {
      console.error('Storage save failed:', e);
      if (e.name === 'QuotaExceededError') this.clear();
    }
  }
  
  static get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? (fallback === null ? item : utils.safeJSON(item, fallback)) : fallback;
    } catch { return fallback; }
  }
  
  static remove(key) {
    try { localStorage.removeItem(key); } catch (e) { console.error('Storage remove failed:', e); }
  }
  
  static clear() {
    Object.values(CFG.STORAGE).forEach(key => this.remove(key));
  }
}

// Clipboard Manager
class Clipboard {
  constructor() {
    this.native = navigator.clipboard && window.isSecureContext;
  }
  
  async copy(text) {
    if (!text) throw new Error('No text');
    
    if (this.native) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (e) {
        console.warn('Clipboard API failed:', e);
      }
    }
    
    // Fallback methods
    if (typeof ClipboardJS !== 'undefined') {
      return this.copyJS(text);
    }
    
    return this.copyExec(text);
  }
  
  copyJS(text) {
    return new Promise((resolve, reject) => {
      const btn = this.createTempBtn();
      document.body.appendChild(btn);
      
      const cb = new ClipboardJS(btn, { text: () => text });
      
      const cleanup = () => {
        cb.destroy();
        btn.remove();
      };
      
      cb.on('success', () => { cleanup(); resolve(); });
      cb.on('error', e => { cleanup(); reject(new Error(`ClipboardJS: ${e.action}`)); });
      
      btn.click();
    });
  }
  
  copyExec(text) {
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      
      try {
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand failed'));
      } catch (e) {
        document.body.removeChild(ta);
        reject(e);
      }
    });
  }
  
  createTempBtn() {
    const btn = document.createElement('button');
    btn.style.cssText = 'position:absolute;left:-9999px;opacity:0;pointer-events:none';
    return btn;
  }
  
  async requestPermission() {
    const result = await Swal.fire({
      title: CFG.MSG.ALLOW_CLIPBOARD,
      text: CFG.MSG.CLIPBOARD_NEEDED,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: CFG.MSG.YES_ALLOW,
      cancelButtonText: CFG.MSG.NO,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      didOpen: () => {
        const swal = document.querySelector('.swal2-popup');
        if (swal && document.documentElement.dir === 'rtl') swal.setAttribute('dir', 'rtl');
      }
    });
    
    if (!result.isConfirmed) {
      Storage.save(CFG.STORAGE.CLIPBOARD, 'denied');
      return;
    }
    
    try {
      await this.copy(' ');
      await Swal.fire({
        title: CFG.MSG.DONE,
        text: CFG.MSG.ACCESS_GRANTED,
        icon: 'success',
        confirmButtonColor: '#3085d6'
      });
      
      Storage.save(CFG.STORAGE.CLIPBOARD, 'granted');
      const btn = document.getElementById('requestClipboardBtn');
      if (btn) btn.style.display = 'none';
      
    } catch (e) {
      await this.handleError(e);
    }
  }
  
  async handleError(error) {
    const result = await Swal.fire({
      title: CFG.MSG.ERROR,
      text: CFG.MSG.ACCESS_FAILED + error.message,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: CFG.MSG.TRY_AGAIN,
      cancelButtonText: CFG.MSG.CANCEL,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });
    
    if (result.isConfirmed) {
      await this.requestPermission();
    } else {
      Storage.save(CFG.STORAGE.CLIPBOARD, 'denied');
      await Swal.fire({
        title: CFG.MSG.NOTE,
        text: CFG.MSG.BROWSER_SETTINGS,
        icon: 'info',
        confirmButtonColor: '#3085d6'
      });
    }
  }
}

// UI Manager
class UI {
  constructor(elements) {
    this.el = elements;
    this.isRTL = document.documentElement.dir === 'rtl';
  }
  
  show(ids) {
    ids.forEach(id => {
      if (this.el[id]) this.el[id].style.display = 'inline-block';
    });
  }
  
  hide(ids) {
    ids.forEach(id => {
      if (this.el[id]) this.el[id].style.display = 'none';
    });
  }
  
  flash(id) {
    const el = this.el[id];
    if (!el) return;
    
    el.classList.add('flash-effect');
    setTimeout(() => el.classList.remove('flash-effect'), CFG.ANIMATION_MS);
  }
  
  async prompt(maxLines, message) {
    return await Swal.fire({
      title: CFG.MSG.COPY_BY_NUMBER,
      input: 'number',
      inputLabel: message,
      inputAttributes: { min: 1, max: maxLines, step: 1 },
      inputValidator: value => {
        const n = parseInt(value);
        if (!value || isNaN(n) || n < 1 || n > maxLines) return CFG.MSG.INVALID_NUMBER;
      },
      showCancelButton: true,
      confirmButtonText: CFG.MSG.COPY,
      cancelButtonText: CFG.MSG.CANCEL,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      didOpen: () => {
        if (this.isRTL) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute('dir', 'rtl');
        }
      }
    });
  }
  
  alert(title, text, icon = 'warning', timer = 0) {
    const config = {
      title, text, icon,
      confirmButtonColor: '#3085d6',
      didOpen: () => {
        if (this.isRTL) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute('dir', 'rtl');
        }
      }
    };
    
    if (timer) config.timer = timer;
    return Swal.fire(config);
  }
}

// Main Line Manager
class LineManager {
  constructor() {
    this.lines = [];
    this.index = 0;
    this.el = this.cacheElements();
    this.clipboard = new Clipboard();
    this.ui = new UI(this.el);
    this.init();
  }
  
  cacheElements() {
    const el = {};
    CFG.ELEMENTS.forEach(id => {
      el[id] = document.getElementById(id);
      if (!el[id]) console.warn(`Element ${id} not found`);
    });
    return el;
  }
  
  init() {
    try {
      this.el.inputText?.focus();
      this.loadSavedMode();
      this.loadSavedSession();
      this.setupEvents();
      this.checkClipboardPermission();
    } catch (e) {
      console.error('Init error:', e);
      this.ui.alert(CFG.MSG.ERROR, 'حدث خطأ أثناء تهيئة التطبيق.');
    }
  }
  
  setupEvents() {
    const debouncedKey = utils.debounce(this.handleKey.bind(this), 100);
    document.addEventListener('keydown', debouncedKey);
    
    this.el.requestClipboardBtn?.addEventListener('click', () => this.clipboard.requestPermission());
    this.el.inputText?.addEventListener('paste', () => setTimeout(() => this.validateInput(), 10));
  }
  
  handleKey(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      e.shiftKey ? this.copyPrev() : this.copyNext();
    }
    if (e.ctrlKey && e.altKey && e.key === 'c') {
      e.preventDefault();
      this.copyAll();
    }
    if (e.ctrlKey && e.altKey && e.key === 'r') {
      e.preventDefault();
      this.resetAll();
    }
  }
  
  validateInput() {
    const text = this.el.inputText?.value;
    return text && this.parseLines(text).length > 0;
  }
  
  parseLines(text) {
    return utils.isEmpty(text) ? [] : text.split('\n').map(l => l.trim()).filter(l => l);
  }
  
  confirmInput() {
    const text = this.el.inputText?.value?.trim();
    
    if (utils.isEmpty(text)) {
      this.ui.alert(CFG.MSG.ERROR, CFG.MSG.ENTER_TEXT);
      return;
    }
    
    this.lines = this.parseLines(text);
    if (this.lines.length === 0) {
      this.ui.alert(CFG.MSG.ERROR, CFG.MSG.ENTER_TEXT);
      return;
    }
    
    this.index = 0;
    this.saveSession();
    this.ui.show(['genBtn', 'prevBtn', 'copyAllBtn']);
    this.updateStatus();
  }
  
  async copyNext() {
    this.skipEmpty();
    
    if (this.index >= this.lines.length) {
      this.ui.alert(CFG.MSG.LIST_ENDED, CFG.MSG.NO_MORE_LINES, 'info');
      return;
    }
    
    try {
      await this.clipboard.copy(this.lines[this.index]);
      this.ui.flash('genBtn');
      this.index++;
      Storage.save(CFG.STORAGE.INDEX, this.index);
      this.updateStatus();
    } catch (e) {
      this.handleCopyError(e);
    }
  }
  
  skipEmpty() {
    while (this.index < this.lines.length && utils.isEmpty(this.lines[this.index])) {
      this.index++;
    }
  }
  
  copyPrev() {
    if (this.index <= 0) {
      this.ui.alert(CFG.MSG.NO_PREVIOUS, CFG.MSG.NO_PREVIOUS_LINE, 'info');
      return;
    }
    
    this.index = Math.max(0, this.index - 2);
    Storage.save(CFG.STORAGE.INDEX, this.index);
    this.copyNext();
  }
  
  async copyByNumber() {
    if (this.lines.length === 0) return;
    
    try {
      const msg = utils.format(CFG.MSG.ENTER_LINE_NUMBER, { max: this.lines.length });
      const result = await this.ui.prompt(this.lines.length, msg);
      
      if (!result.isConfirmed || !result.value) return;
      
      const n = parseInt(result.value);
      if (isNaN(n) || n < 1 || n > this.lines.length) {
        this.ui.alert(CFG.MSG.ERROR, CFG.MSG.INVALID_NUMBER);
        return;
      }
      
      this.index = n - 1;
      Storage.save(CFG.STORAGE.INDEX, this.index);
      await this.copyNext();
    } catch (e) {
      console.error('copyByNumber error:', e);
      this.ui.alert(CFG.MSG.ERROR, 'حدث خطأ أثناء نسخ السطر.');
    }
  }
  
  async copyAll() {
    if (this.lines.length === 0) return;
    
    try {
      await this.clipboard.copy(this.lines.join('\n'));
      this.ui.flash('copyAllBtn');
      this.ui.alert(CFG.MSG.SUCCESS, CFG.MSG.COPY_ALL_SUCCESS, 'success', 2000);
    } catch (e) {
      this.handleCopyError(e);
    }
  }
  
  handleCopyError(e) {
    console.error('Copy error:', e);
    const isClipboard = e.message.includes('clipboard') || e.message.includes('permission');
    this.ui.alert(CFG.MSG.ERROR, isClipboard ? CFG.MSG.CLIPBOARD_ERROR : CFG.MSG.COPY_ALL_ERROR);
  }
  
  resetAll() {
    if (this.el.inputText) this.el.inputText.value = '';
    if (this.el.status) this.el.status.textContent = '';
    if (this.el.progressFill) this.el.progressFill.style.width = '0%';
    
    this.ui.hide(['genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn']);
    this.lines = [];
    this.index = 0;
    Storage.clear();
  }
  
  updateStatus() {
    if (this.lines.length === 0) return;
    
    const percent = Math.round((this.index / this.lines.length) * 100);
    const msg = utils.format(CFG.MSG.COPIED_STATUS, { current: this.index, total: this.lines.length });
    
    if (this.el.progressFill) this.el.progressFill.style.width = `${percent}%`;
    if (this.el.status) this.el.status.textContent = msg;
  }
  
  toggleMode() {
    document.body.classList.toggle('light-mode');
    const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    Storage.save(CFG.STORAGE.MODE, mode);
  }
  
  resumeSession() {
    const data = this.loadSession();
    
    if (!data.lines?.length) {
      this.ui.alert(CFG.MSG.NO_DATA, CFG.MSG.NO_SAVED_DATA, 'info');
      return;
    }
    
    this.lines = data.lines;
    this.index = data.index || 0;
    
    if (this.el.inputText) this.el.inputText.value = this.lines.join('\n');
    this.ui.show(['genBtn', 'prevBtn', 'copyAllBtn']);
    this.ui.hide(['resumeBtn']);
    this.updateStatus();
  }
  
  loadSavedMode() {
    const mode = Storage.get(CFG.STORAGE.MODE);
    if (mode === 'light') document.body.classList.add('light-mode');
  }
  
  loadSavedSession() {
    const data = this.loadSession();
    if (data.lines?.length && this.el.resumeBtn) {
      this.el.resumeBtn.style.display = 'inline-block';
    }
  }
  
  loadSession() {
    const saved = Storage.get(CFG.STORAGE.LINES);
    if (!saved) return { lines: null, index: 0 };
    
    const data = utils.safeJSON(saved);
    
    // Handle legacy format
    if (Array.isArray(data)) {
      const idx = Storage.get(CFG.STORAGE.INDEX, '0');
      return { lines: data, index: parseInt(idx) };
    }
    
    // Handle new format
    if (data?.lines) return { lines: data.lines, index: data.index || 0 };
    
    return { lines: null, index: 0 };
  }
  
  saveSession() {
    Storage.save(CFG.STORAGE.LINES, { lines: this.lines, index: this.index, timestamp: Date.now() });
  }
  
  checkClipboardPermission() {
    const permission = Storage.get(CFG.STORAGE.CLIPBOARD);
    if (permission !== 'granted' && this.el.requestClipboardBtn) {
      this.el.requestClipboardBtn.style.display = 'block';
    }
  }
}

// Global functions
let lineManager;

const globalFns = {
  confirmInput: () => lineManager?.confirmInput(),
  copyNext: () => lineManager?.copyNext(),
  copyPrev: () => lineManager?.copyPrev(),
  copyByNumber: () => lineManager?.copyByNumber(),
  copyAll: () => lineManager?.copyAll(),
  resetAll: () => lineManager?.resetAll(),
  toggleMode: () => lineManager?.toggleMode(),
  resumeSession: () => lineManager?.resumeSession()
};

Object.assign(window, globalFns);

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  try {
    lineManager = new LineManager();
  } catch (e) {
    console.error('Init failed:', e);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'خطأ في التهيئة',
        text: 'حدث خطأ أثناء تشغيل التطبيق. يرجى إعادة تحميل الصفحة.',
        icon: 'error',
        confirmButtonColor: '#3085d6'
      });
    }
  }
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LineManager, Clipboard, Storage, UI };
}
