/**
 * Fast Copy Application - Optimized Version
 */

const CONFIG = {
  KEYS: { LINES: 'savedLines', MODE: 'mode', CLIPBOARD: 'clipboardPermission' },
  MSG: {
    ENTER_TEXT: 'من فضلك أدخل بعض النصوص أولاً.',
    LIST_ENDED: 'انتهت القائمة',
    NO_MORE: 'لا توجد سطور أخرى لنسخها.',
    NO_PREVIOUS: 'لا يوجد سطر سابق لنسخه.',
    INVALID_NUM: 'رقم غير صالح.',
    COPY_ALL_OK: 'تم نسخ جميع السطور بنجاح.',
    CLIPBOARD_ERR: 'فشل النسخ! يرجى السماح بالوصول إلى الحافظة.',
    NO_DATA: 'لا يوجد بيانات محفوظة للاستئناف.',
    ALLOW_CLIPBOARD: 'السماح بالوصول إلى الحافظة؟',
    CLIPBOARD_NEEDED: 'هذا ضروري لتمكين خاصية النسخ التلقائي.',
    YES: 'نعم، اسمح بذلك',
    DONE: 'تم!',
    ACCESS_OK: 'تم منح إذن الوصول بنجاح.',
    ERROR: 'خطأ!',
    COPIED: '📌 تم النسخ: {{current}} من {{total}}',
    ENTER_NUM: 'أدخل رقم السطر (من 1 إلى {{max}})',
    COPY_BY_NUM: 'نسخ حسب الرقم',
    COPY: 'نسخ',
    CANCEL: 'إلغاء'
  }
};

// Utility functions
const $ = id => document.getElementById(id);
const isEmpty = text => !text?.trim();
const format = (str, params) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? _);
const safeParse = (str, fallback = null) => { try { return JSON.parse(str); } catch { return fallback; } };

// Storage helpers
const storage = {
  save: (lines, index) => {
    try {
      localStorage.setItem(CONFIG.KEYS.LINES, JSON.stringify({ lines, index, ts: Date.now() }));
    } catch (e) {
      console.error('Save failed:', e);
    }
  },
  load: () => {
    try {
      const data = safeParse(localStorage.getItem(CONFIG.KEYS.LINES));
      return data?.lines ? { lines: data.lines, index: data.index || 0 } : { lines: null, index: 0 };
    } catch { return { lines: null, index: 0 }; }
  },
  clear: () => localStorage.removeItem(CONFIG.KEYS.LINES),
  getMode: () => localStorage.getItem(CONFIG.KEYS.MODE),
  saveMode: mode => localStorage.setItem(CONFIG.KEYS.MODE, mode)
};

// Clipboard manager
const clipboard = {
  async copy(text) {
    if (!text) throw new Error('No text');
    
    // Try modern API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (e) {
        console.warn('Clipboard API failed:', e);
      }
    }
    
    // Fallback to execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    
    try {
      if (!document.execCommand('copy')) throw new Error('execCommand failed');
    } finally {
      ta.remove();
    }
  },
  
  async requestPermission() {
    const result = await Swal.fire({
      title: CONFIG.MSG.ALLOW_CLIPBOARD,
      text: CONFIG.MSG.CLIPBOARD_NEEDED,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: CONFIG.MSG.YES,
      cancelButtonText: CONFIG.MSG.CANCEL,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });

    if (!result.isConfirmed) {
      localStorage.setItem(CONFIG.KEYS.CLIPBOARD, 'denied');
      return;
    }

    try {
      await this.copy(' ');
      await Swal.fire({
        title: CONFIG.MSG.DONE,
        text: CONFIG.MSG.ACCESS_OK,
        icon: 'success',
        confirmButtonColor: '#3085d6'
      });
      localStorage.setItem(CONFIG.KEYS.CLIPBOARD, 'granted');
      const btn = $('requestClipboardBtn');
      if (btn) btn.style.display = 'none';
    } catch (e) {
      await Swal.fire({
        title: CONFIG.MSG.ERROR,
        text: e.message,
        icon: 'error',
        confirmButtonColor: '#3085d6'
      });
    }
  }
};

// UI helpers
const ui = {
  showBtns: () => ['genBtn', 'prevBtn', 'copyAllBtn'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'inline-block';
  }),
  
  hideBtns: () => ['genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  }),
  
  flash: id => {
    const el = $(id);
    if (!el) return;
    el.classList.add('flash-effect');
    setTimeout(() => el.classList.remove('flash-effect'), 300);
  },
  
  showError: msg => Swal.fire({
    title: CONFIG.MSG.ERROR,
    text: msg,
    icon: 'warning',
    confirmButtonColor: '#3085d6'
  }),
  
  showInfo: (title, msg) => Swal.fire({
    title, text: msg, icon: 'info', confirmButtonColor: '#3085d6'
  }),
  
  showSuccess: (title, msg) => Swal.fire({
    title, text: msg, icon: 'success', confirmButtonColor: '#3085d6', timer: 2000
  }),
  
  async promptNum(max) {
    return await Swal.fire({
      title: CONFIG.MSG.COPY_BY_NUM,
      input: 'number',
      inputLabel: format(CONFIG.MSG.ENTER_NUM, { max }),
      inputAttributes: { min: 1, max, step: 1 },
      inputValidator: v => {
        const n = parseInt(v);
        if (!v || isNaN(n) || n < 1 || n > max) return CONFIG.MSG.INVALID_NUM;
      },
      showCancelButton: true,
      confirmButtonText: CONFIG.MSG.COPY,
      cancelButtonText: CONFIG.MSG.CANCEL,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });
  }
};

// Main App
class App {
  constructor() {
    this.lines = [];
    this.index = 0;
    this.init();
  }

  init() {
    this.loadSession();
    this.setupEvents();
    this.checkClipboardPermission();
    $('inputText')?.focus();
    
    // Load theme
    if (storage.getMode() === 'light') {
      document.body.classList.add('light-mode');
    }
  }

  loadSession() {
    const { lines, index } = storage.load();
    if (lines?.length) {
      this.lines = lines;
      this.index = index;
      const input = $('inputText');
      if (input) input.value = lines.join('\n');
      ui.showBtns();
      this.updateStatus();
    }
  }

  setupEvents() {
    document.addEventListener('keydown', e => {
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
        this.reset();
      }
    });

    $('requestClipboardBtn')?.addEventListener('click', () => clipboard.requestPermission());
  }

  checkClipboardPermission() {
    if (localStorage.getItem(CONFIG.KEYS.CLIPBOARD) !== 'granted') {
      const btn = $('requestClipboardBtn');
      if (btn) btn.style.display = 'block';
    }
  }

  parseLines(text) {
    return isEmpty(text) ? [] : text.split('\n').map(l => l.trim()).filter(l => l);
  }

  confirm() {
    const text = $('inputText')?.value?.trim();
    if (isEmpty(text)) {
      ui.showError(CONFIG.MSG.ENTER_TEXT);
      return;
    }

    this.lines = this.parseLines(text);
    if (!this.lines.length) {
      ui.showError(CONFIG.MSG.ENTER_TEXT);
      return;
    }

    this.index = 0;
    storage.save(this.lines, this.index);
    ui.showBtns();
    this.updateStatus();
  }

  skipEmpty() {
    while (this.index < this.lines.length && isEmpty(this.lines[this.index])) {
      this.index++;
    }
  }

  async copyNext() {
    this.skipEmpty();
    
    if (this.index >= this.lines.length) {
      ui.showInfo(CONFIG.MSG.LIST_ENDED, CONFIG.MSG.NO_MORE);
      return;
    }

    try {
      await clipboard.copy(this.lines[this.index]);
      ui.flash('genBtn');
      this.index++;
      storage.save(this.lines, this.index);
      this.updateStatus();
    } catch (e) {
      console.error('Copy error:', e);
      ui.showError(CONFIG.MSG.CLIPBOARD_ERR);
    }
  }

  copyPrev() {
    if (this.index <= 0) {
      ui.showInfo(CONFIG.MSG.ERROR, CONFIG.MSG.NO_PREVIOUS);
      return;
    }
    this.index = Math.max(0, this.index - 2);
    storage.save(this.lines, this.index);
    this.copyNext();
  }

  async copyByNum() {
    if (!this.lines.length) return;

    const result = await ui.promptNum(this.lines.length);
    if (!result.isConfirmed || !result.value) return;

    const num = parseInt(result.value);
    if (isNaN(num) || num < 1 || num > this.lines.length) {
      ui.showError(CONFIG.MSG.INVALID_NUM);
      return;
    }

    this.index = num - 1;
    storage.save(this.lines, this.index);
    await this.copyNext();
  }

  async copyAll() {
    if (!this.lines.length) return;

    try {
      await clipboard.copy(this.lines.join('\n'));
      ui.flash('copyAllBtn');
      ui.showSuccess(CONFIG.MSG.DONE, CONFIG.MSG.COPY_ALL_OK);
    } catch (e) {
      console.error('Copy all error:', e);
      ui.showError(CONFIG.MSG.CLIPBOARD_ERR);
    }
  }

  reset() {
    const input = $('inputText');
    const status = $('status');
    const progress = $('progressFill');
    
    if (input) input.value = '';
    if (status) status.textContent = '';
    if (progress) progress.style.width = '0%';
    
    ui.hideBtns();
    this.lines = [];
    this.index = 0;
    storage.clear();
  }

  updateStatus() {
    if (!this.lines.length) return;
    
    const percent = Math.round((this.index / this.lines.length) * 100);
    const msg = format(CONFIG.MSG.COPIED, { current: this.index, total: this.lines.length });
    
    const progress = $('progressFill');
    const status = $('status');
    
    if (progress) progress.style.width = `${percent}%`;
    if (status) status.textContent = msg;
  }

  toggleMode() {
    document.body.classList.toggle('light-mode');
    storage.saveMode(document.body.classList.contains('light-mode') ? 'light' : 'dark');
  }
}

// Global instance
let app;

// Global functions
window.confirmInput = () => app?.confirm();
window.copyNext = () => app?.copyNext();
window.copyPrev = () => app?.copyPrev();
window.copyByNumber = () => app?.copyByNum();
window.copyAll = () => app?.copyAll();
window.resetAll = () => app?.reset();
window.toggleMode = () => app?.toggleMode();

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  try {
    app = new App();
  } catch (e) {
    console.error('Init error:', e);
    Swal.fire({
      title: 'خطأ في التهيئة',
      text: 'حدث خطأ أثناء تشغيل التطبيق.',
      icon: 'error',
      confirmButtonColor: '#3085d6'
    });
  }
});
