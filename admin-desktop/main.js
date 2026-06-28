const { app, BrowserWindow, Menu, net, Notification, session } = require('electron');
const path = require('path');

function createWindow (urlToLoad = 'https://aboakbr.com/abo1stor3hlaa2kbr8-47') {
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

  // التعامل مع فتح الروابط في نوافذ جديدة (target="_blank")
  win.webContents.setWindowOpenHandler(({ url }) => {
    createWindow(url);
    return { action: 'deny' };
  });

  // تفعيل التحديث عند سحب عتلة الماوس للأعلى وهو في بداية الصفحة
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      if (!window.hasMouseWheelReloadListener) {
        window.hasMouseWheelReloadListener = true;
        window.addEventListener('wheel', (e) => {
          const mainEl = document.querySelector('main');
          const isAtTop = (!mainEl || mainEl.scrollTop <= 5) && window.scrollY === 0;
          if (isAtTop && e.deltaY < -50) {
            window.location.reload();
          }
        }, { passive: true });
      }
    `).catch(err => console.log('Error injecting reload script:', err));
  });

  // تحميل رابط لوحة التحكم
  win.loadURL(urlToLoad);
}

// سيتم استدعاء هذه الطريقة عندما تنتهي Electron من التهيئة
app.whenReady().then(async () => {
  // استخدام Dynamic Import لأن electron-context-menu هي إضافة بصيغة ES Module
  const contextMenu = (await import('electron-context-menu')).default;

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
    },
    append: (defaultActions, parameters, browserWindow) => [
      {
        label: 'فتح الرابط في نافذة جديدة',
        visible: parameters.linkURL.trim().length > 0,
        click: () => {
          createWindow(parameters.linkURL);
        }
      }
    ]
  });

  createWindow();

  // --- إعداد إشعارات فحص الطلبات بالخلفية ---
  let lastSeenOrderNumber = 0;
  
  setInterval(async () => {
    try {
      // جلب الكوكيز لتطبيق الإدارة لمعرفة إذا كان المدير مسجلاً دخوله
      const cookies = await session.defaultSession.cookies.get({ url: 'https://aboakbr.com' });
      const tokenCookie = cookies.find(c => c.name === 'admin_token');
      
      if (!tokenCookie) return; // غير مسجل الدخول، لا نفعل شيئاً
      
      const token = tokenCookie.value;
      
      const request = net.request({
        method: 'GET',
        url: `https://aboakbr.com/api/notifications/admin-pending?token=${token}`,
        useSessionCookies: true
      });

      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              const latestOrderNumber = json.latestOrderNumber || 0;
              const details = json.latestOrderDetails || {};
              
              if (latestOrderNumber > 0 && lastSeenOrderNumber > 0 && latestOrderNumber > lastSeenOrderNumber) {
                lastSeenOrderNumber = latestOrderNumber;
                
                const shopName = details.shopName || '—';
                const regionName = details.regionName || '—';
                const orderType = details.orderType || '—';
                const subtotal = details.subtotal || 0;
                
                // عرض الإشعار على نظام ويندوز
                new Notification({
                  title: `${shopName} — ${regionName}`,
                  body: `طلب جديد: ${orderType} | المجموع: ${subtotal} د.ع`,
                  icon: path.join(__dirname, 'build/icon.ico')
                }).show();
                
              } else if (latestOrderNumber > 0 && lastSeenOrderNumber === 0) {
                // أول مرة نقرأ فيها الرقم، لا نعرض إشعار للطلبات القديمة
                lastSeenOrderNumber = latestOrderNumber;
              }
            } catch (err) {}
          }
        });
      });
      
      request.end();
    } catch (error) {
      // صمت الأخطاء
    }
  }, 15000); // فحص كل 15 ثانية
  // ----------------------------------------

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
