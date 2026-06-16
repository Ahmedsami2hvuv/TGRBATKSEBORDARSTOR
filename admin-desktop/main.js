const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const contextMenu = require('electron-context-menu');

// تفعيل قائمة الكليك الأيمن (النسخ، اللصق، إلخ) وتعريبها
contextMenu({
  showSaveImageAs: true,
  showCopyImage: true,
  showInspectElement: false,
  labels: {
    copy: 'نسخ',
    paste: 'لصق',
    cut: 'قص',
    copyImage: 'نسخ الصورة',
    saveImageAs: 'حفظ الصورة كـ...',
    copyLink: 'نسخ الرابط',
    selectAll: 'تحديد الكل',
    learnSpelling: 'تعلم التهجئة',
    lookUpSelection: 'البحث عن التحديد',
    searchWithGoogle: 'البحث في جوجل',
    services: 'الخدمات'
  }
});

function createWindow () {
  // إنشاء نافذة المتصفح
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // إخفاء شريط القوائم العلوي للحصول على مظهر تطبيق حقيقي
  Menu.setApplicationMenu(null);

  // إعداد مُعرف التطبيق للإشعارات على ويندوز
  app.setAppUserModelId('com.aboakbar.admin');

  // الموافقة تلقائياً على صلاحية الإشعارات القادمة من موقع الإدارة
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true);
    } else {
      callback(true);
    }
  });

  // تحميل رابط لوحة التحكم
  win.loadURL('https://aboakbr.com/abo1stor3hlaa2kbr8-47');
  
  // يمكنك فتح أدوات المطور إذا أردت بتفعيل السطر التالي:
  // win.webContents.openDevTools();
}

// سيتم استدعاء هذه الطريقة عندما تنتهي Electron من التهيئة
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // على macOS من المعتاد إعادة إنشاء نافذة في التطبيق عندما
    // يتم النقر على أيقونة الدوك ولا توجد نوافذ أخرى مفتوحة.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// إنهاء التطبيق عندما يتم إغلاق جميع النوافذ، باستثناء macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
