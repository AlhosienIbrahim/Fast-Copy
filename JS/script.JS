
let lines = [];
let index = 0;

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
    alert('من فضلك أدخل بعض النصوص أولاً.');
  }
}

function copyNext() {
  while (index < lines.length && !lines[index].trim()) index++; // Skip empty lines
  if (index < lines.length) {
    navigator.clipboard.writeText(lines[index]).then(() => {
      flashElement('genBtn');
      index++;
      localStorage.setItem('savedIndex', index);
      updateStatus();
    }).catch((err) => {
      alert("فشل النسخ! يرجى منح إذن الوصول إلى الحافظة.");
      console.error("Clipboard error:", err);
    });
  } else {
    alert('انتهت القائمة.');
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
    alert('لا يوجد سطر سابق.');
  }
}

function copyByNumber() {
  const userInput = prompt(`أدخل رقم السطر (من 1 إلى ${lines.length}):`);
  const lineNum = parseInt(userInput);
  if (!isNaN(lineNum) && lineNum >= 1 && lineNum <= lines.length) {
    index = lineNum - 1;
    localStorage.setItem('savedIndex', index);
    copyNext();
  } else {
    alert("رقم غير صالح.");
  }
}

function copyAll() {
  if (lines.length > 0) {
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      flashElement('copyAllBtn');
      alert('تم نسخ جميع السطور بنجاح.');
    }).catch(() => {
      alert('حدث خطأ في نسخ الكل.');
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
    alert("لا يوجد بيانات محفوظة.");
  }
}

function flashElement(id) {
  const el = document.getElementById(id);
  el.classList.add('flash-effect');
  setTimeout(() => el.classList.remove('flash-effect'), 300);
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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      if (e.shiftKey) copyPrev();
      else copyNext();
    }
    if (e.ctrlKey && e.altKey && e.key === 'c') copyAll();
  });
};




document.addEventListener("DOMContentLoaded", () => {
  const isArabic = document.documentElement.lang === "ar" || document.body.dir === "rtl";
  const clipboardPermission = localStorage.getItem("clipboardPermission");

  if (!clipboardPermission) {
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
          if (navigator.permissions && navigator.permissions.query) {
            const permissionStatus = await navigator.permissions.query({ name: 'clipboard-write' });

            if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
              await navigator.clipboard.writeText(" ");
              Swal.fire(isArabic ? 'تم!' : 'Done!', isArabic ? 'تم منح إذن الوصول بنجاح.' : 'Clipboard access granted.', 'success');
              localStorage.setItem("clipboardPermission", "granted");
              return;
            }
          }

          // إذا لم يكن navigator.permissions مدعومًا، نحاول مباشرة الكتابة
          await navigator.clipboard.writeText(" ");
          Swal.fire(isArabic ? 'تم!' : 'Done!', isArabic ? 'تم منح إذن الوصول بنجاح.' : 'Clipboard access granted.', 'success');
          localStorage.setItem("clipboardPermission", "granted");

        } catch (err) {
          Swal.fire(isArabic ? 'خطأ!' : 'Error!', (isArabic ? 'حدث خطأ: ' : 'An error occurred: ') + err.message, 'error');
          localStorage.setItem("clipboardPermission", "denied");
        }
      } else {
        localStorage.setItem("clipboardPermission", "denied");
      }
    });
  }
});