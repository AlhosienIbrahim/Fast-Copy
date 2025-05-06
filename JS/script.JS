
    let lines = [];
    let index = 0;
    const isArabic = document.documentElement.lang === "ar" || document.body.dir === "rtl";

    function confirmInput() {
      const text = document.getElementById('inputText').value;
      lines = text.split('\n').map(line => line.trim()).filter(line => line);
      index = 0;
      if (lines.length > 0) {
        localStorage.setItem('savedLines', JSON.stringify(lines));
        localStorage.setItem('savedIndex', index);
        document.getElementById('genBtn').style.display = 'inline-block';
        document.getElementById('prevBtn').style.display = 'inline-block';
        document.getElementById('copyAllBtn').style.display = 'inline-block';
        updateStatus();
      } else {
        Swal.fire({
          title: 'خطأ',
          text: 'من فضلك أدخل بعض النصوص أولاً.',
          icon: 'warning',
          confirmButtonColor: '#3085d6'
        });
      }
    }

    function copyNext() {
      while (index < lines.length && !lines[index].trim()) index++;
      if (index < lines.length) {
        copyToClipboard(lines[index]).then(() => {
          flashElement('genBtn');
          index++;
          localStorage.setItem('savedIndex', index);
          updateStatus();
        }).catch((err) => {
          Swal.fire({
            title: 'خطأ',
            text: 'فشل النسخ! يرجى السماح بالوصول إلى الحافظة.',
            icon: 'error',
            confirmButtonColor: '#3085d6'
          });
          console.error("Clipboard error:", err);
        });
      } else {
        Swal.fire({
          title: 'انتهت القائمة',
          text: 'لا توجد سطور أخرى لنسخها.',
          icon: 'info',
          confirmButtonColor: '#3085d6'
        });
      }
    }

    function copyPrev() {
      if (index > 1) {
        index -= 2;
        localStorage.setItem('savedIndex', index);
        copyNext();
      } else if (index === 1) {
        index = 0;
        localStorage.setItem('savedIndex', index);
        copyNext();
      } else {
        Swal.fire({
          title: 'لا يوجد سابق',
          text: 'لا يوجد سطر سابق لنسخه.',
          icon: 'info',
          confirmButtonColor: '#3085d6'
        });
      }
    }

    function copyByNumber() {
      Swal.fire({
        title: 'نسخ حسب الرقم',
        input: 'number',
        inputLabel: `أدخل رقم السطر (من 1 إلى ${lines.length})`,
        inputAttributes: { min: 1, max: lines.length },
        showCancelButton: true,
        confirmButtonText: 'نسخ',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33'
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const lineNum = parseInt(result.value);
          if (!isNaN(lineNum) && lineNum >= 1 && lineNum <= lines.length) {
            index = lineNum - 1;
            localStorage.setItem('savedIndex', index);
            copyNext();
          } else {
            Swal.fire({
              title: 'خطأ',
              text: 'رقم غير صالح.',
              icon: 'error',
              confirmButtonColor: '#3085d6'
            });
          }
        }
      });
    }

    function copyAll() {
      if (lines.length > 0) {
        copyToClipboard(lines.join('\n')).then(() => {
          flashElement('copyAllBtn');
          Swal.fire({
            title: 'تم النسخ',
            text: 'تم نسخ جميع السطور بنجاح.',
            icon: 'success',
            confirmButtonColor: '#3085d6'
          });
        }).catch(() => {
          Swal.fire({
            title: 'خطأ',
            text: 'حدث خطأ أثناء نسخ الكل.',
            icon: 'error',
            confirmButtonColor: '#3085d6'
          });
        });
      }
    }

    function resetAll() {
      document.getElementById('inputText').value = '';
      document.getElementById('status').innerText = '';
      document.getElementById('genBtn').style.display = 'none';
      document.getElementById('prevBtn').style.display = 'none';
      document.getElementById('copyAllBtn').style.display = 'none';
      document.getElementById('resumeBtn').style.display = 'none';
      document.getElementById('progressFill').style.width = '0%';
      lines = [];
      index = 0;
      localStorage.removeItem('savedLines');
      localStorage.removeItem('savedIndex');
    }

    function updateStatus() {
      const percent = (index / lines.length) * 100;
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('status').innerText = `📌 تم النسخ: ${index} من ${lines.length}`;
    }

    function toggleMode() {
      document.body.classList.toggle('light-mode');
      const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
      localStorage.setItem('mode', mode);
    }

    function resumeSession() {
      const saved = localStorage.getItem('savedLines');
      const savedIdx = localStorage.getItem('savedIndex');
      if (saved) {
        lines = JSON.parse(saved);
        index = savedIdx !== null ? parseInt(savedIdx) : 0;
        document.getElementById('inputText').value = lines.join('\n');
        document.getElementById('genBtn').style.display = 'inline-block';
        document.getElementById('prevBtn').style.display = 'inline-block';
        document.getElementById('copyAllBtn').style.display = 'inline-block';
        document.getElementById('resumeBtn').style.display = 'none';
        updateStatus();
      } else {
        Swal.fire({
          title: 'لا توجد بيانات',
          text: 'لا يوجد بيانات محفوظة للاستئناف.',
          icon: 'info',
          confirmButtonColor: '#3085d6'
        });
      }
    }

    function flashElement(id) {
      const el = document.getElementById(id);
      el.classList.add('flash-effect');
      setTimeout(() => el.classList.remove('flash-effect'), 300);
    }

    async function copyToClipboard(text) {
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch (err) {
          console.warn("Clipboard API failed:", err);
        }
      }
      if (typeof ClipboardJS !== "undefined") {
        return new Promise((resolve, reject) => {
          const tempBtn = document.createElement("button");
          tempBtn.className = "clipboard-btn";
          document.body.appendChild(tempBtn);
          const clipboard = new ClipboardJS(tempBtn, { text: () => text });
          clipboard.on('success', () => {
            clipboard.destroy();
            tempBtn.remove();
            resolve();
          });
          clipboard.on('error', (e) => {
            clipboard.destroy();
            tempBtn.remove();
            reject(new Error("Clipboard.js failed: " + e.action));
          });
          tempBtn.click();
        });
      }
      throw new Error("لا يدعم المتصفح خاصية النسخ.");
    }

    function requestClipboardPermission() {
      const clipboardPermission = localStorage.getItem("clipboardPermission");
      if (clipboardPermission === "granted") {
        document.getElementById("requestClipboardBtn").style.display = "none";
        return;
      }

      Swal.fire({
        title: isArabic ? 'السماح بالوصول إلى الحافظة؟' : 'Allow clipboard access?',
        text: isArabic ? "هذا ضروري لتمكين خاصية النسخ التلقائي." : "This is needed for clipboard copy functionality.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: isArabic ? 'نعم، اسمح بذلك' : 'Yes, allow it',
        cancelButtonText: isArabic ? 'لا' : 'No',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        didOpen: () => {
          if (isArabic) {
            const swal = document.querySelector('.swal2-popup');
            if (swal) swal.setAttribute("dir", "rtl");
          }
        }
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            let success = false;
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(" ");
              success = true;
            } else if (typeof ClipboardJS !== "undefined") {
              await new Promise((resolve, reject) => {
                const tempBtn = document.createElement("button");
                tempBtn.className = "clipboard-btn";
                document.body.appendChild(tempBtn);
                const clipboard = new ClipboardJS(tempBtn, { text: () => " " });
                clipboard.on('success', () => {
                  clipboard.destroy();
                  tempBtn.remove();
                  resolve();
                });
                clipboard.on('error', (e) => {
                  clipboard.destroy();
                  tempBtn.remove();
                  reject(new Error("Clipboard.js failed"));
                });
                tempBtn.click();
              });
              success = true;
            }
            if (success) {
              Swal.fire({
                title: isArabic ? 'تم!' : 'Done!',
                text: isArabic ? 'تم منح إذن الوصول بنجاح.' : 'Clipboard access granted.',
                icon: 'success',
                confirmButtonColor: '#3085d6'
              });
              localStorage.setItem("clipboardPermission", "granted");
              document.getElementById("requestClipboardBtn").style.display = "none";
            } else {
              throw new Error("فشل الوصول إلى الحافظة.");
            }
          } catch (err) {
            Swal.fire({
              title: isArabic ? 'خطأ!' : 'Error!',
              text: (isArabic ? 'فشل الوصول إلى الحافظة: ' : 'Failed to access clipboard: ') + err.message,
              icon: 'error',
              showCancelButton: true,
              confirmButtonText: isArabic ? 'حاول مرة أخرى' : 'Try again',
              cancelButtonText: isArabic ? 'إلغاء' : 'Cancel',
              confirmButtonColor: '#3085d6',
              cancelButtonColor: '#d33',
              didOpen: () => {
                if (isArabic) {
                  const swal = document.querySelector('.swal2-popup');
                  if (swal) swal.setAttribute("dir", "rtl");
                }
              }
            }).then((retryResult) => {
              if (retryResult.isConfirmed) {
                requestClipboardPermission();
              } else {
                localStorage.setItem("clipboardPermission", "denied");
                Swal.fire({
                  title: isArabic ? 'ملاحظة' : 'Note',
                  text: isArabic ? 'يمكنك تفعيل الوصول للحافظة من إعدادات المتصفح.' : 'You can enable clipboard access from browser settings.',
                  icon: 'info',
                  confirmButtonColor: '#3085d6'
                });
              }
            });
          }
        } else {
          localStorage.setItem("clipboardPermission", "denied");
        }
      });
    }

    window.onload = function () {
      document.getElementById('inputText').focus();
      const savedMode = localStorage.getItem('mode');
      if (savedMode === 'light') {
        document.body.classList.add('light-mode');
      }
      const saved = localStorage.getItem('savedLines');
      if (saved) {
        document.getElementById('resumeBtn').style.display = 'inline-block';
      }
      if (localStorage.getItem("clipboardPermission") !== "granted") {
        document.getElementById("requestClipboardBtn").style.display = "block";
      }
      document.getElementById("requestClipboardBtn").addEventListener("click", requestClipboardPermission);
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          if (e.shiftKey) copyPrev();
          else copyNext();
        }
        if (e.ctrlKey && e.altKey && e.key === 'c') copyAll();
      });
    };
