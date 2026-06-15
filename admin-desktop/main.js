const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

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
