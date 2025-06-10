// Optimized Full Line Manager Code
const CONFIG = {
  STORAGE_KEYS: {
    LINES: 'savedLines', INDEX: 'savedIndex', MODE: 'mode', CLIPBOARD_PERMISSION: 'clipboardPermission'
  },
  ANIMATION_DURATION: 300,
  ELEMENT_IDS: ['inputText', 'genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn', 'status', 'progressFill', 'requestClipboardBtn'],
  MESSAGES: CONFIG_MESSAGES()
};

function CONFIG_MESSAGES() {
  return {
    ENTER_TEXT: 'من فضلك أدخل بعض النصوص أولاً.', LIST_ENDED: 'انتهت القائمة',
    NO_MORE_LINES: 'لا توجد سطور أخرى لنسخها.', NO_PREVIOUS: 'لا يوجد سابق',
    NO_PREVIOUS_LINE: 'لا يوجد سطر سابق لنسخه.', INVALID_NUMBER: 'رقم غير صالح.',
    COPY_ALL_SUCCESS: 'تم نسخ جميع السطور بنجاح.', COPY_ALL_ERROR: 'حدث خطأ أثناء نسخ الكل.',
    CLIPBOARD_ERROR: 'فشل النسخ! يرجى السماح بالوصول إلى الحافظة.', NO_DATA: 'لا توجد بيانات',
    NO_SAVED_DATA: 'لا يوجد بيانات محفوظة للاستئناف.', ALLOW_CLIPBOARD: 'السماح بالوصول إلى الحافظة؟',
    CLIPBOARD_NEEDED: 'هذا ضروري لتمكين خاصية النسخ التلقائي.', YES_ALLOW: 'نعم، اسمح بذلك',
    NO: 'لا', DONE: 'تم!', ACCESS_GRANTED: 'تم منح إذن الوصول بنجاح.', ERROR: 'خطأ!',
    ACCESS_FAILED: 'فشل الوصول إلى الحافظة: ', TRY_AGAIN: 'حاول مرة أخرى', CANCEL: 'إلغاء',
    NOTE: 'ملاحظة', BROWSER_SETTINGS: 'يمكنك تفعيل الوصول للحافظة من إعدادات المتصفح.',
    COPY_BY_NUMBER: 'نسخ حسب الرقم', ENTER_LINE_NUMBER: 'أدخل رقم السطر (من 1 إلى {{max}})',
    COPY: 'نسخ', COPIED_STATUS: '📌 تم النسخ: {{current}} من {{total}}', SUCCESS: 'تم!'
  };
}

const Utils = {
  safeJSONParse: (str, fallback = null) => { try { return JSON.parse(str); } catch { return fallback; } },
  debounce: (fn, wait) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; },
  isEmpty: txt => !txt || !txt.trim(),
  formatMessage: (tpl, params = {}) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in params ? String(params[k]) : `{{${k}}}`))
};

class StorageManager {
  saveSession(lines, index) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.LINES, JSON.stringify({ lines, index }));
    } catch (e) { console.error('Save session error:', e); }
  }
  saveIndex(index) {
    const session = this.loadSession();
    this.saveSession(session.lines || [], index);
  }
  saveMode(mode) {
    try { localStorage.setItem(CONFIG.STORAGE_KEYS.MODE, mode); } catch (e) { console.error('Save mode error:', e); }
  }
  loadSession() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.LINES);
    const data = Utils.safeJSONParse(raw);
    return data?.lines ? { lines: data.lines, index: data.index || 0 } : { lines: null, index: 0 };
  }
  getMode() { return localStorage.getItem(CONFIG.STORAGE_KEYS.MODE); }
  clearSession() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.LINES);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.INDEX);
  }
}

class UIManager {
  constructor(elements, messages) {
    this.elements = elements;
    this.messages = messages;
  }
  toggleButtons(display) {
    ['genBtn', 'prevBtn', 'copyAllBtn'].forEach(id => {
      const el = this.elements[id];
      if (el) el.style.display = display;
    });
  }
  flash(id) {
    const el = this.elements[id];
    if (el) {
      el.classList.add('flash-effect');
      setTimeout(() => el.classList.remove('flash-effect'), CONFIG.ANIMATION_DURATION);
    }
  }
  updateStatus(index, total) {
    const percent = Math.round((index / total) * 100);
    this.elements.status.textContent = Utils.formatMessage(this.messages.COPIED_STATUS, { current: index, total });
    this.elements.progressFill.style.width = `${percent}%`;
  }
  async promptLineNumber(max, message) {
    return await Swal.fire({
      title: this.messages.COPY_BY_NUMBER,
      input: 'number',
      inputLabel: message,
      inputAttributes: { min: 1, max, step: 1 },
      inputValidator: val => (!val || isNaN(val) || val < 1 || val > max) && this.messages.INVALID_NUMBER,
      showCancelButton: true, confirmButtonText: this.messages.COPY, cancelButtonText: this.messages.CANCEL
    });
  }
  alert(type, text, title = '') {
    Swal.fire({ title, text, icon: type, confirmButtonColor: '#3085d6' });
  }
}

class ClipboardManager {
  async copy(text) {
    if (!text) throw new Error('No text to copy');
    if (navigator.clipboard && window.isSecureContext) {
      try { return await navigator.clipboard.writeText(text); }
      catch {}
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    document.body.appendChild(textarea);
    textarea.focus(); textarea.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(textarea); }
  }
}

class LineManager {
  constructor() {
    this.storage = new StorageManager();
    this.ui = new UIManager(this.cacheElements(), CONFIG.MESSAGES);
    this.clipboard = new ClipboardManager();
    this.lines = []; this.index = 0;
    this.init();
  }
  cacheElements() {
    const el = {};
    CONFIG.ELEMENT_IDS.forEach(id => el[id] = document.getElementById(id));
    return el;
  }
  init() {
    const saved = this.storage.loadSession();
    if (saved.lines) {
      this.lines = saved.lines;
      this.index = saved.index;
      this.el().inputText.value = this.lines.join('\n');
      this.ui.toggleButtons('inline-block');
    }
    document.addEventListener('keydown', Utils.debounce(e => this.handleKey(e), 100));
  }
  el() { return this.ui.elements; }
  handleKey(e) {
    if (e.ctrlKey && e.key === 'Enter') e.preventDefault(), e.shiftKey ? this.copyPrev() : this.copyNext();
    if (e.ctrlKey && e.altKey && e.key === 'c') e.preventDefault(), this.copyAll();
    if (e.ctrlKey && e.altKey && e.key === 'r') e.preventDefault(), this.reset();
  }
  parseLines(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  }
  confirmInput() {
    const text = this.el().inputText.value.trim();
    if (Utils.isEmpty(text)) return this.ui.alert('warning', CONFIG.MESSAGES.ENTER_TEXT);
    this.lines = this.parseLines(text);
    this.index = 0;
    this.storage.saveSession(this.lines, this.index);
    this.ui.toggleButtons('inline-block');
    this.updateStatus();
  }
  async copyNext() {
    if (this.index >= this.lines.length) return this.ui.alert('info', CONFIG.MESSAGES.NO_MORE_LINES);
    try {
      await this.clipboard.copy(this.lines[this.index]);
      this.ui.flash('genBtn');
      this.index++;
      this.storage.saveIndex(this.index);
      this.updateStatus();
    } catch (e) { this.ui.alert('error', CONFIG.MESSAGES.CLIPBOARD_ERROR); }
  }
  copyPrev() {
    if (this.index <= 0) return this.ui.alert('info', CONFIG.MESSAGES.NO_PREVIOUS_LINE);
    this.index = Math.max(0, this.index - 2);
    this.storage.saveIndex(this.index);
    this.copyNext();
  }
  async copyByNumber() {
    const result = await this.ui.promptLineNumber(this.lines.length, Utils.formatMessage(CONFIG.MESSAGES.ENTER_LINE_NUMBER, { max: this.lines.length }));
    if (!result.isConfirmed) return;
    const num = parseInt(result.value);
    if (isNaN(num) || num < 1 || num > this.lines.length) return this.ui.alert('warning', CONFIG.MESSAGES.INVALID_NUMBER);
    this.index = num - 1;
    this.storage.saveIndex(this.index);
    await this.copyNext();
  }
  async copyAll() {
    try {
      await this.clipboard.copy(this.lines.join('\n'));
      this.ui.flash('copyAllBtn');
      this.ui.alert('success', CONFIG.MESSAGES.COPY_ALL_SUCCESS);
    } catch (e) {
      this.ui.alert('error', CONFIG.MESSAGES.COPY_ALL_ERROR);
    }
  }
  reset() {
    this.lines = []; this.index = 0;
    this.el().inputText.value = '';
    this.el().status.textContent = '';
    this.el().progressFill.style.width = '0%';
    this.ui.toggleButtons('none');
    this.storage.clearSession();
  }
  updateStatus() {
    if (this.lines.length > 0)
      this.ui.updateStatus(this.index, this.lines.length);
  }
}

const app = new LineManager();
Object.assign(window, {
  confirmInput: () => app.confirmInput(),
  copyNext: () => app.copyNext(),
  copyPrev: () => app.copyPrev(),
  copyByNumber: () => app.copyByNumber(),
  copyAll: () => app.copyAll(),
  resetAll: () => app.reset()
});
