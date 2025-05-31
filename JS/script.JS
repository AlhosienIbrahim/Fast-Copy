/**
 * Enhanced Line Manager Application
 * Improved version with better error handling, performance, and code organization
 */

// Configuration constants
const CONFIG = {
  STORAGE_KEYS: {
    LINES: 'savedLines',
    INDEX: 'savedIndex',
    MODE: 'mode',
    CLIPBOARD_PERMISSION: 'clipboardPermission'
  },
  ANIMATION_DURATION: 300,
  ELEMENT_IDS: [
    'inputText', 'genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn',
    'status', 'progressFill', 'requestClipboardBtn'
  ],
  MESSAGES: {
    AR: {
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
  }
};

// Utility functions
const Utils = {
  /**
   * Safely parse JSON with fallback
   */
  safeJSONParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  },

  /**
   * Debounce function to limit rapid function calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Check if text is empty or only whitespace
   */
  isEmpty(text) {
    return !text || !text.trim();
  },

  /**
   * Format message with placeholders
   */
  formatMessage(template, params = {}) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => params[key] || match);
  }
};

// Application state management with improved error handling
class LineManager {
  constructor() {
    this.lines = [];
    this.index = 0;
    this.isArabic = this.detectArabicMode();
    this.messages = CONFIG.MESSAGES.AR; // Currently supports Arabic

    // Initialize components
    this.elements = this.cacheElements();
    this.clipboard = new ClipboardManager(this.isArabic, this.messages);
    this.storage = new StorageManager();
    this.ui = new UIManager(this.elements, this.isArabic, this.messages);

    this.init();
  }

  /**
   * Cache DOM elements with error handling
   */
  cacheElements() {
    const elements = {};

    CONFIG.ELEMENT_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (!element) {
        console.warn(`Element with ID '${id}' not found`);
      }
      elements[id] = element;
    });

    return elements;
  }

  /**
   * Detect Arabic/RTL mode
   */
  detectArabicMode() {
    return document.documentElement.lang === "ar" ||
      document.body.dir === "rtl" ||
      document.documentElement.dir === "rtl";
  }

  /**
   * Initialize the application
   */
  init() {
    try {
      this.elements.inputText?.focus();
      this.loadSavedMode();
      this.loadSavedSession();
      this.setupEventListeners();
      this.clipboard.requestPermissionIfNeeded();
    } catch (error) {
      console.error('Initialization error:', error);
      this.ui.showError('حدث خطأ أثناء تهيئة التطبيق.');
    }
  }

  /**
   * Setup event listeners with improved keyboard handling
   */
  setupEventListeners() {
    // Keyboard shortcuts with debouncing
    const debouncedKeyHandler = Utils.debounce(this.handleKeydown.bind(this), 100);
    document.addEventListener('keydown', debouncedKeyHandler);

    // Button event listeners
    this.elements.requestClipboardBtn?.addEventListener("click", () => {
      this.clipboard.requestPermission();
    });

    // Input validation on paste
    this.elements.inputText?.addEventListener('paste', (e) => {
      setTimeout(() => this.validateInput(), 10);
    });
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeydown(e) {
    const { ctrlKey, altKey, shiftKey, key } = e;

    if (ctrlKey && key === 'Enter') {
      e.preventDefault();
      shiftKey ? this.copyPrev() : this.copyNext();
    }

    if (ctrlKey && altKey && key === 'c') {
      e.preventDefault();
      this.copyAll();
    }

    // Additional shortcuts
    if (ctrlKey && altKey && key === 'r') {
      e.preventDefault();
      this.resetAll();
    }
  }

  /**
   * Validate input text
   */
  validateInput() {
    const text = this.elements.inputText?.value;
    if (!text) return false;

    const lines = this.parseLines(text);
    return lines.length > 0;
  }

  /**
   * Parse and clean input lines
   */
  parseLines(text) {
    if (Utils.isEmpty(text)) return [];

    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Confirm and process input
   */
  confirmInput() {
    const text = this.elements.inputText?.value?.trim();

    if (Utils.isEmpty(text)) {
      this.ui.showError(this.messages.ENTER_TEXT);
      return;
    }

    this.lines = this.parseLines(text);

    if (this.lines.length === 0) {
      this.ui.showError(this.messages.ENTER_TEXT);
      return;
    }

    this.index = 0;
    this.storage.saveSession(this.lines, this.index);
    this.ui.showButtons();
    this.updateStatus();
  }

  /**
   * Copy next line with improved error handling
   */
  async copyNext() {
    // Skip empty lines efficiently
    this.skipEmptyLines();

    if (this.index >= this.lines.length) {
      this.ui.showInfo(this.messages.LIST_ENDED, this.messages.NO_MORE_LINES);
      return;
    }

    try {
      const currentLine = this.lines[this.index];
      await this.clipboard.copy(currentLine);

      this.ui.flashElement('genBtn');
      this.index++;
      this.storage.saveIndex(this.index);
      this.updateStatus();

    } catch (error) {
      this.handleCopyError(error);
    }
  }

  /**
   * Skip empty lines helper
   */
  skipEmptyLines() {
    while (this.index < this.lines.length && Utils.isEmpty(this.lines[this.index])) {
      this.index++;
    }
  }

  /**
   * Copy previous line
   */
  copyPrev() {
    if (this.index <= 0) {
      this.ui.showInfo(this.messages.NO_PREVIOUS, this.messages.NO_PREVIOUS_LINE);
      return;
    }

    this.index = Math.max(0, this.index - 2);
    this.storage.saveIndex(this.index);
    this.copyNext();
  }

  /**
   * Copy line by number with validation
   */
  async copyByNumber() {
    if (this.lines.length === 0) return;

    try {
      const message = Utils.formatMessage(this.messages.ENTER_LINE_NUMBER, {
        max: this.lines.length
      });

      const result = await this.ui.promptForLineNumber(this.lines.length, message);

      if (!result.isConfirmed || !result.value) return;

      const lineNum = parseInt(result.value);

      if (!this.isValidLineNumber(lineNum)) {
        this.ui.showError(this.messages.INVALID_NUMBER);
        return;
      }

      this.index = lineNum - 1;
      this.storage.saveIndex(this.index);
      await this.copyNext();

    } catch (error) {
      console.error("Error in copyByNumber:", error);
      this.ui.showError('حدث خطأ أثناء نسخ السطر.');
    }
  }

  /**
   * Validate line number
   */
  isValidLineNumber(lineNum) {
    return !isNaN(lineNum) && lineNum >= 1 && lineNum <= this.lines.length;
  }

  /**
   * Copy all lines
   */
  async copyAll() {
    if (this.lines.length === 0) return;

    try {
      const allText = this.lines.join('\n');
      await this.clipboard.copy(allText);

      this.ui.flashElement('copyAllBtn');
      this.ui.showSuccess(this.messages.SUCCESS, this.messages.COPY_ALL_SUCCESS);

    } catch (error) {
      this.handleCopyError(error);
    }
  }

  /**
   * Handle copy errors consistently
   */
  handleCopyError(error) {
    console.error("Copy error:", error);

    if (error.message.includes('clipboard') || error.message.includes('permission')) {
      this.ui.showClipboardError();
    } else {
      this.ui.showError(this.messages.COPY_ALL_ERROR);
    }
  }

  /**
   * Reset application state
   */
  resetAll() {
    // Clear UI
    if (this.elements.inputText) this.elements.inputText.value = '';
    if (this.elements.status) this.elements.status.textContent = '';
    if (this.elements.progressFill) this.elements.progressFill.style.width = '0%';

    this.ui.hideButtons();

    // Reset state
    this.lines = [];
    this.index = 0;
    this.storage.clearSession();
  }

  /**
   * Update status with progress - FIXED: Shows correct current line number
   */
  updateStatus() {
    if (this.lines.length === 0) return;

    // عرض عدد السطور التي تم نسخها (index) من إجمالي السطور
    const percent = Math.round((this.index / this.lines.length) * 100);
    const message = Utils.formatMessage(this.messages.COPIED_STATUS, {
      current: this.index, // هذا يُظهر عدد السطور المنسوخة، وليس السطر التالي
      total: this.lines.length
    });

    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${percent}%`;
    }

    if (this.elements.status) {
      this.elements.status.textContent = message;
    }
  }

  /**
   * Toggle theme mode
   */
  toggleMode() {
    document.body.classList.toggle('light-mode');
    const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    this.storage.saveMode(mode);
  }

  /**
   * Resume saved session
   */
  resumeSession() {
    const sessionData = this.storage.loadSession();

    if (!sessionData.lines || sessionData.lines.length === 0) {
      this.ui.showInfo(this.messages.NO_DATA, this.messages.NO_SAVED_DATA);
      return;
    }

    this.lines = sessionData.lines;
    this.index = sessionData.index || 0;

    if (this.elements.inputText) {
      this.elements.inputText.value = this.lines.join('\n');
    }

    this.ui.showButtons();

    if (this.elements.resumeBtn) {
      this.elements.resumeBtn.style.display = 'none';
    }

    this.updateStatus();
  }

  /**
   * Load saved theme mode
   */
  loadSavedMode() {
    const savedMode = this.storage.getMode();
    if (savedMode === 'light') {
      document.body.classList.add('light-mode');
    }
  }

  /**
   * Load saved session and show resume button if available
   */
  loadSavedSession() {
    const sessionData = this.storage.loadSession();
    if (sessionData.lines && sessionData.lines.length > 0 && this.elements.resumeBtn) {
      this.elements.resumeBtn.style.display = 'inline-block';
    }
  }
}

// Enhanced Clipboard management
class ClipboardManager {
  constructor(isArabic = false, messages = {}) {
    this.isArabic = isArabic;
    this.messages = messages;
    this.hasNativeSupport = this.checkNativeSupport();
  }

  /**
   * Check for native clipboard support
   */
  checkNativeSupport() {
    return navigator.clipboard && window.isSecureContext;
  }

  /**
   * Copy text with multiple fallback methods
   */
  async copy(text) {
    if (!text) throw new Error('No text to copy');

    // Try modern Clipboard API first
    if (this.hasNativeSupport) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        console.warn("Clipboard API failed, falling back:", error);
      }
    }

    // Fallback to ClipboardJS if available
    if (typeof ClipboardJS !== "undefined") {
      return this.copyWithClipboardJS(text);
    }

    // Last resort: execCommand (deprecated but widely supported)
    return this.copyWithExecCommand(text);
  }

  /**
   * Copy using ClipboardJS library
   */
  copyWithClipboardJS(text) {
    return new Promise((resolve, reject) => {
      const tempBtn = this.createTemporaryButton();
      document.body.appendChild(tempBtn);

      const clipboard = new ClipboardJS(tempBtn, { text: () => text });

      const cleanup = () => {
        clipboard.destroy();
        tempBtn.remove();
      };

      clipboard.on('success', () => {
        cleanup();
        resolve();
      });

      clipboard.on('error', (e) => {
        cleanup();
        reject(new Error(`ClipboardJS failed: ${e.action}`));
      });

      tempBtn.click();
    });
  }

  /**
   * Copy using deprecated execCommand (fallback)
   */
  copyWithExecCommand(text) {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          resolve();
        } else {
          reject(new Error('execCommand copy failed'));
        }
      } catch (error) {
        document.body.removeChild(textArea);
        reject(error);
      }
    });
  }

  /**
   * Create temporary button for clipboard operations
   */
  createTemporaryButton() {
    const tempBtn = document.createElement("button");
    tempBtn.className = "clipboard-btn";
    tempBtn.style.cssText = `
      position: absolute;
      left: -9999px;
      opacity: 0;
      pointer-events: none;
    `;
    return tempBtn;
  }

  /**
   * Request clipboard permission if needed
   */
  requestPermissionIfNeeded() {
    const permission = localStorage.getItem(CONFIG.STORAGE_KEYS.CLIPBOARD_PERMISSION);
    const requestBtn = document.getElementById("requestClipboardBtn");

    if (permission !== "granted" && requestBtn) {
      requestBtn.style.display = "block";
    }
  }

  /**
   * Request clipboard permission with improved UX
   */
  async requestPermission() {
    const result = await Swal.fire({
      title: this.messages.ALLOW_CLIPBOARD || 'Allow clipboard access?',
      text: this.messages.CLIPBOARD_NEEDED || "This is needed for clipboard copy functionality.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.messages.YES_ALLOW || 'Yes, allow it',
      cancelButtonText: this.messages.NO || 'No',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      didOpen: () => {
        if (this.isArabic) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute("dir", "rtl");
        }
      }
    });

    if (!result.isConfirmed) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CLIPBOARD_PERMISSION, "denied");
      return;
    }

    try {
      await this.copy(" "); // Test copy

      await Swal.fire({
        title: this.messages.DONE || 'Done!',
        text: this.messages.ACCESS_GRANTED || 'Clipboard access granted.',
        icon: 'success',
        confirmButtonColor: '#3085d6'
      });

      localStorage.setItem(CONFIG.STORAGE_KEYS.CLIPBOARD_PERMISSION, "granted");
      const requestBtn = document.getElementById("requestClipboardBtn");
      if (requestBtn) requestBtn.style.display = "none";

    } catch (error) {
      await this.handlePermissionError(error);
    }
  }

  /**
   * Handle permission errors with retry option
   */
  async handlePermissionError(error) {
    const result = await Swal.fire({
      title: this.messages.ERROR || 'Error!',
      text: (this.messages.ACCESS_FAILED || 'Failed to access clipboard: ') + error.message,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: this.messages.TRY_AGAIN || 'Try again',
      cancelButtonText: this.messages.CANCEL || 'Cancel',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      await this.requestPermission();
    } else {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CLIPBOARD_PERMISSION, "denied");
      await Swal.fire({
        title: this.messages.NOTE || 'Note',
        text: this.messages.BROWSER_SETTINGS || 'You can enable clipboard access from browser settings.',
        icon: 'info',
        confirmButtonColor: '#3085d6'
      });
    }
  }
}

// Enhanced Storage management with error recovery
class StorageManager {
  /**
   * Save session data with error handling
   */
  saveSession(lines, index) {
    try {
      const sessionData = { lines, index, timestamp: Date.now() };
      localStorage.setItem(CONFIG.STORAGE_KEYS.LINES, JSON.stringify(sessionData));
    } catch (error) {
      console.error("Failed to save session:", error);
      this.handleStorageError(error);
    }
  }

  /**
   * Save current index
   */
  saveIndex(index) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.INDEX, index.toString());
    } catch (error) {
      console.error("Failed to save index:", error);
    }
  }

  /**
   * Save theme mode
   */
  saveMode(mode) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.MODE, mode);
    } catch (error) {
      console.error("Failed to save mode:", error);
    }
  }

  /**
   * Load session data with validation
   */
  loadSession() {
    try {
      const savedData = localStorage.getItem(CONFIG.STORAGE_KEYS.LINES);

      if (!savedData) {
        return { lines: null, index: 0 };
      }

      const sessionData = Utils.safeJSONParse(savedData);

      // Handle legacy format
      if (Array.isArray(sessionData)) {
        const savedIndex = localStorage.getItem(CONFIG.STORAGE_KEYS.INDEX);
        return {
          lines: sessionData,
          index: savedIndex ? parseInt(savedIndex) : 0
        };
      }

      // Handle new format
      if (sessionData && sessionData.lines) {
        return {
          lines: sessionData.lines,
          index: sessionData.index || 0
        };
      }

      return { lines: null, index: 0 };

    } catch (error) {
      console.error("Failed to load session:", error);
      return { lines: null, index: 0 };
    }
  }

  /**
   * Get saved theme mode
   */
  getMode() {
    try {
      return localStorage.getItem(CONFIG.STORAGE_KEYS.MODE);
    } catch (error) {
      console.error("Failed to get mode:", error);
      return null;
    }
  }

  /**
   * Clear session data
   */
  clearSession() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.LINES);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.INDEX);
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  }

  /**
   * Handle storage errors (e.g., quota exceeded)
   */
  handleStorageError(error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded, clearing old data');
      try {
        this.clearSession();
      } catch (clearError) {
        console.error('Failed to clear storage:', clearError);
      }
    }
  }
}

// Enhanced UI management
class UIManager {
  constructor(elements, isArabic = false, messages = {}) {
    this.elements = elements;
    this.isArabic = isArabic;
    this.messages = messages;
  }

  /**
   * Show control buttons
   */
  showButtons() {
    const buttons = ['genBtn', 'prevBtn', 'copyAllBtn'];
    buttons.forEach(btnId => {
      const btn = this.elements[btnId];
      if (btn) btn.style.display = 'inline-block';
    });
  }

  /**
   * Hide control buttons
   */
  hideButtons() {
    const buttons = ['genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn'];
    buttons.forEach(btnId => {
      const btn = this.elements[btnId];
      if (btn) btn.style.display = 'none';
    });
  }

  /**
   * Flash element with animation
   */
  flashElement(id) {
    const element = this.elements[id];
    if (!element) return;

    element.classList.add('flash-effect');
    setTimeout(() => {
      element.classList.remove('flash-effect');
    }, CONFIG.ANIMATION_DURATION);
  }

  /**
   * Prompt for line number with validation
   */
  async promptForLineNumber(maxLines, message) {
    return await Swal.fire({
      title: this.messages.COPY_BY_NUMBER || 'Copy by Number',
      input: 'number',
      inputLabel: message,
      inputAttributes: {
        min: 1,
        max: maxLines,
        step: 1
      },
      inputValidator: (value) => {
        const num = parseInt(value);
        if (!value || isNaN(num) || num < 1 || num > maxLines) {
          return this.messages.INVALID_NUMBER || 'Invalid number';
        }
      },
      showCancelButton: true,
      confirmButtonText: this.messages.COPY || 'Copy',
      cancelButtonText: this.messages.CANCEL || 'Cancel',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      didOpen: () => {
        if (this.isArabic) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute("dir", "rtl");
        }
      }
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    Swal.fire({
      title: this.messages.ERROR || 'Error',
      text: message,
      icon: 'warning',
      confirmButtonColor: '#3085d6',
      didOpen: () => {
        if (this.isArabic) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute("dir", "rtl");
        }
      }
    });
  }

  /**
   * Show info message
   */
  showInfo(title, message) {
    Swal.fire({
      title: title,
      text: message,
      icon: 'info',
      confirmButtonColor: '#3085d6',
      didOpen: () => {
        if (this.isArabic) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute("dir", "rtl");
        }
      }
    });
  }

  /**
   * Show success message
   */
  showSuccess(title, message) {
    Swal.fire({
      title: title,
      text: message,
      icon: 'success',
      confirmButtonColor: '#3085d6',
      timer: 2000,
      didOpen: () => {
        if (this.isArabic) {
          const swal = document.querySelector('.swal2-popup');
          if (swal) swal.setAttribute("dir", "rtl");
        }
      }
    });
  }

  /**
   * Show clipboard error
   */
  showClipboardError() {
    this.showError(this.messages.CLIPBOARD_ERROR || 'Clipboard access failed!');
  }
}

// Global instance
let lineManager;

// Global functions for HTML integration (with error handling)
const globalFunctions = {
  confirmInput: () => lineManager?.confirmInput(),
  copyNext: () => lineManager?.copyNext(),
  copyPrev: () => lineManager?.copyPrev(),
  copyByNumber: () => lineManager?.copyByNumber(),
  copyAll: () => lineManager?.copyAll(),
  resetAll: () => lineManager?.resetAll(),
  toggleMode: () => lineManager?.toggleMode(),
  resumeSession: () => lineManager?.resumeSession()
};

// Attach global functions
Object.assign(window, globalFunctions);

// Initialize application with error handling
window.addEventListener('DOMContentLoaded', () => {
  try {
    lineManager = new LineManager();
  } catch (error) {
    console.error('Failed to initialize LineManager:', error);
    // Show fallback error message
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

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LineManager, ClipboardManager, StorageManager, UIManager };
}
