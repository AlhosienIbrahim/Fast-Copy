// Application state management
class LineManager {
  constructor() {
    this.lines = [];
    this.index = 0;
    this.isArabic = this.detectArabicMode();
    this.elements = this.cacheElements();
    this.clipboard = new ClipboardManager();
    this.storage = new StorageManager();
    this.ui = new UIManager(this.elements, this.isArabic);
    
    this.init();
  }

  // Cache DOM elements for better performance
  cacheElements() {
    const elements = {};
    const ids = [
      'inputText', 'genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn',
      'status', 'progressFill', 'requestClipboardBtn'
    ];
    
    ids.forEach(id => {
      elements[id] = document.getElementById(id);
    });
    
    return elements;
  }

  detectArabicMode() {
    return document.documentElement.lang === "ar" || document.body.dir === "rtl";
  }

  init() {
    this.elements.inputText.focus();
    this.loadSavedMode();
    this.loadSavedSession();
    this.setupEventListeners();
    this.clipboard.requestPermissionIfNeeded();
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    
    // Button event listeners
    this.elements.requestClipboardBtn?.addEventListener("click", () => {
      this.clipboard.requestPermission();
    });
  }

  handleKeydown(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      e.shiftKey ? this.copyPrev() : this.copyNext();
    }
    if (e.ctrlKey && e.altKey && e.key === 'c') {
      e.preventDefault();
      this.copyAll();
    }
  }

  confirmInput() {
    const text = this.elements.inputText.value.trim();
    if (!text) {
      this.ui.showError('من فضلك أدخل بعض النصوص أولاً.');
      return;
    }

    this.lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    this.index = 0;
    
    if (this.lines.length === 0) {
      this.ui.showError('من فضلك أدخل بعض النصوص أولاً.');
      return;
    }

    this.storage.saveSession(this.lines, this.index);
    this.ui.showButtons();
    this.updateStatus();
  }

  async copyNext() {
    // Skip empty lines efficiently
    while (this.index < this.lines.length && !this.lines[this.index]?.trim()) {
      this.index++;
    }

    if (this.index >= this.lines.length) {
      this.ui.showInfo('انتهت القائمة', 'لا توجد سطور أخرى لنسخها.');
      return;
    }

    try {
      await this.clipboard.copy(this.lines[this.index]);
      this.ui.flashElement('genBtn');
      this.index++;
      this.storage.saveIndex(this.index);
      this.updateStatus();
    } catch (error) {
      this.ui.showClipboardError();
      console.error("Clipboard error:", error);
    }
  }

  copyPrev() {
    if (this.index <= 0) {
      this.ui.showInfo('لا يوجد سابق', 'لا يوجد سطر سابق لنسخه.');
      return;
    }

    this.index = Math.max(0, this.index - 2);
    this.storage.saveIndex(this.index);
    this.copyNext();
  }

  async copyByNumber() {
    if (this.lines.length === 0) return;

    try {
      const result = await this.ui.promptForLineNumber(this.lines.length);
      if (!result.isConfirmed || !result.value) return;

      const lineNum = parseInt(result.value);
      if (isNaN(lineNum) || lineNum < 1 || lineNum > this.lines.length) {
        this.ui.showError('رقم غير صالح.');
        return;
      }

      this.index = lineNum - 1;
      this.storage.saveIndex(this.index);
      this.copyNext();
    } catch (error) {
      console.error("Error in copyByNumber:", error);
    }
  }

  async copyAll() {
    if (this.lines.length === 0) return;

    try {
      await this.clipboard.copy(this.lines.join('\n'));
      this.ui.flashElement('copyAllBtn');
      this.ui.showSuccess('تم النسخ', 'تم نسخ جميع السطور بنجاح.');
    } catch (error) {
      this.ui.showError('حدث خطأ أثناء نسخ الكل.');
      console.error("Copy all error:", error);
    }
  }

  resetAll() {
    this.elements.inputText.value = '';
    this.elements.status.textContent = '';
    this.elements.progressFill.style.width = '0%';
    
    this.ui.hideButtons();
    
    this.lines = [];
    this.index = 0;
    this.storage.clearSession();
  }

  updateStatus() {
    if (this.lines.length === 0) return;
    
    const percent = Math.round((this.index / this.lines.length) * 100);
    this.elements.progressFill.style.width = `${percent}%`;
    this.elements.status.textContent = `📌 تم النسخ: ${this.index} من ${this.lines.length}`;
  }

  toggleMode() {
    document.body.classList.toggle('light-mode');
    const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    this.storage.saveMode(mode);
  }

  resumeSession() {
    const sessionData = this.storage.loadSession();
    if (!sessionData.lines) {
      this.ui.showInfo('لا توجد بيانات', 'لا يوجد بيانات محفوظة للاستئناف.');
      return;
    }

    this.lines = sessionData.lines;
    this.index = sessionData.index;
    this.elements.inputText.value = this.lines.join('\n');
    
    this.ui.showButtons();
    this.elements.resumeBtn.style.display = 'none';
    this.updateStatus();
  }

  loadSavedMode() {
    const savedMode = this.storage.getMode();
    if (savedMode === 'light') {
      document.body.classList.add('light-mode');
    }
  }

  loadSavedSession() {
    const sessionData = this.storage.loadSession();
    if (sessionData.lines) {
      this.elements.resumeBtn.style.display = 'inline-block';
    }
  }
}

// Clipboard management class
class ClipboardManager {
  constructor() {
    this.isArabic = document.documentElement.lang === "ar" || document.body.dir === "rtl";
  }

  async copy(text) {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
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

    throw new Error("لا يدعم المتصفح خاصية النسخ.");
  }

  copyWithClipboardJS(text) {
    return new Promise((resolve, reject) => {
      const tempBtn = document.createElement("button");
      tempBtn.className = "clipboard-btn";
      tempBtn.style.position = 'absolute';
      tempBtn.style.left = '-9999px';
      
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
        reject(new Error(`Clipboard.js failed: ${e.action}`));
      });

      tempBtn.click();
    });
  }

  requestPermissionIfNeeded() {
    const permission = localStorage.getItem("clipboardPermission");
    const requestBtn = document.getElementById("requestClipboardBtn");
    
    if (permission !== "granted" && requestBtn) {
      requestBtn.style.display = "block";
    }
  }

  async requestPermission() {
    const result = await Swal.fire({
      title: this.isArabic ? 'السماح بالوصول إلى الحافظة؟' : 'Allow clipboard access?',
      text: this.isArabic ? "هذا ضروري لتمكين خاصية النسخ التلقائي." : "This is needed for clipboard copy functionality.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.isArabic ? 'نعم، اسمح بذلك' : 'Yes, allow it',
      cancelButtonText: this.isArabic ? 'لا' : 'No',
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
      localStorage.setItem("clipboardPermission", "denied");
      return;
    }

    try {
      await this.copy(" "); // Test copy
      
      Swal.fire({
        title: this.isArabic ? 'تم!' : 'Done!',
        text: this.isArabic ? 'تم منح إذن الوصول بنجاح.' : 'Clipboard access granted.',
        icon: 'success',
        confirmButtonColor: '#3085d6'
      });

      localStorage.setItem("clipboardPermission", "granted");
      document.getElementById("requestClipboardBtn").style.display = "none";
      
    } catch (error) {
      this.handlePermissionError(error);
    }
  }

  async handlePermissionError(error) {
    const result = await Swal.fire({
      title: this.isArabic ? 'خطأ!' : 'Error!',
      text: (this.isArabic ? 'فشل الوصول إلى الحافظة: ' : 'Failed to access clipboard: ') + error.message,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: this.isArabic ? 'حاول مرة أخرى' : 'Try again',
      cancelButtonText: this.isArabic ? 'إلغاء' : 'Cancel',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      this.requestPermission();
    } else {
      localStorage.setItem("clipboardPermission", "denied");
      Swal.fire({
        title: this.isArabic ? 'ملاحظة' : 'Note',
        text: this.isArabic ? 'يمكنك تفعيل الوصول للحافظة من إعدادات المتصفح.' : 'You can enable clipboard access from browser settings.',
        icon: 'info',
        confirmButtonColor: '#3085d6'
      });
    }
  }
}

// Storage management class
class StorageManager {
  saveSession(lines, index) {
    try {
      localStorage.setItem('savedLines', JSON.stringify(lines));
      localStorage.setItem('savedIndex', index.toString());
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  }

  saveIndex(index) {
    try {
      localStorage.setItem('savedIndex', index.toString());
    } catch (error) {
      console.error("Failed to save index:", error);
    }
  }

  saveMode(mode) {
    try {
      localStorage.setItem('mode', mode);
    } catch (error) {
      console.error("Failed to save mode:", error);
    }
  }

  loadSession() {
    try {
      const savedLines = localStorage.getItem('savedLines');
      const savedIndex = localStorage.getItem('savedIndex');
      
      return {
        lines: savedLines ? JSON.parse(savedLines) : null,
        index: savedIndex ? parseInt(savedIndex) : 0
      };
    } catch (error) {
      console.error("Failed to load session:", error);
      return { lines: null, index: 0 };
    }
  }

  getMode() {
    try {
      return localStorage.getItem('mode');
    } catch (error) {
      console.error("Failed to get mode:", error);
      return null;
    }
  }

  clearSession() {
    try {
      localStorage.removeItem('savedLines');
      localStorage.removeItem('savedIndex');
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  }
}

// UI management class
class UIManager {
  constructor(elements, isArabic) {
    this.elements = elements;
    this.isArabic = isArabic;
  }

  showButtons() {
    const buttons = ['genBtn', 'prevBtn', 'copyAllBtn'];
    buttons.forEach(btn => {
      if (this.elements[btn]) {
        this.elements[btn].style.display = 'inline-block';
      }
    });
  }

  hideButtons() {
    const buttons = ['genBtn', 'prevBtn', 'copyAllBtn', 'resumeBtn'];
    buttons.forEach(btn => {
      if (this.elements[btn]) {
        this.elements[btn].style.display = 'none';
      }
    });
  }

  flashElement(id) {
    const element = this.elements[id];
    if (!element) return;

    element.classList.add('flash-effect');
    setTimeout(() => element.classList.remove('flash-effect'), 300);
  }

  async promptForLineNumber(maxLines) {
    return await Swal.fire({
      title: 'نسخ حسب الرقم',
      input: 'number',
      inputLabel: `أدخل رقم السطر (من 1 إلى ${maxLines})`,
      inputAttributes: { min: 1, max: maxLines },
      showCancelButton: true,
      confirmButtonText: 'نسخ',
      cancelButtonText: 'إلغاء',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });
  }

  showError(message) {
    Swal.fire({
      title: 'خطأ',
      text: message,
      icon: 'warning',
      confirmButtonColor: '#3085d6'
    });
  }

  showInfo(title, message) {
    Swal.fire({
      title: title,
      text: message,
      icon: 'info',
      confirmButtonColor: '#3085d6'
    });
  }

  showSuccess(title, message) {
    Swal.fire({
      title: title,
      text: message,
      icon: 'success',
      confirmButtonColor: '#3085d6'
    });
  }

  showClipboardError() {
    Swal.fire({
      title: 'خطأ',
      text: 'فشل النسخ! يرجى السماح بالوصول إلى الحافظة.',
      icon: 'error',
      confirmButtonColor: '#3085d6'
    });
  }
}

// Initialize the application
let lineManager;

// Global functions for HTML integration
function confirmInput() {
  lineManager.confirmInput();
}

function copyNext() {
  lineManager.copyNext();
}

function copyPrev() {
  lineManager.copyPrev();
}

function copyByNumber() {
  lineManager.copyByNumber();
}

function copyAll() {
  lineManager.copyAll();
}

function resetAll() {
  lineManager.resetAll();
}

function toggleMode() {
  lineManager.toggleMode();
}

function resumeSession() {
  lineManager.resumeSession();
}

// Initialize when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  lineManager = new LineManager();
});
