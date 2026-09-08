/**
 * منصة الناضج — تطبيق سطح المكتب
 * غلاف آمن يحمّل النظام الحي من Railway مع مزايا سطح مكتب كاملة.
 */
const { app, BrowserWindow, Tray, Menu, Notification, shell, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://hr-gov-web-production.up.railway.app';
const ALLOWED_HOSTS = ['hr-gov-web-production.up.railway.app'];
const APP_NAME = 'منصة الناضج';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let autoLaunchEnabled = null; // يُقرأ من النظام عند الإقلاع

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function iconPath() {
  const p = path.join(__dirname, 'icon.png');
  return fs.existsSync(p) ? p : undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    icon: iconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(APP_URL).catch(() => showOffline());

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain) showOffline();
  });
  mainWindow.webContents.on('did-finish-load', () => {
    if (offlineShown) {
      offlineShown = false;
      notify('تم استعادة الاتصال', 'أهلاً بعودتك — النظام يعمل الآن.');
    }
  });

  // منع التنقل لأي نطاق غير مسموح: الروابط الخارجية تفتح في المتصفح
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED_HOSTS.some((h) => url.startsWith('https://' + h))) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!ALLOWED_HOSTS.some((h) => url.startsWith('https://' + h))) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // إغلاق النافذة = تصغير للشريط (الخروج من قائمة الشريط فقط)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

let offlineShown = false;
function showOffline() {
  if (offlineShown) return;
  offlineShown = true;
  notify('تعذر الاتصال', 'تحقق من اتصالك بالإنترنت — سيُعاد الاتصال تلقائياً عند الضغط على إعادة المحاولة.');
  mainWindow.loadFile('offline.html').catch(() => {});
}

function notify(title, body) {
  try {
    if (Notification.isSupported()) new Notification({ title, body, icon: iconPath() }).show();
  } catch (_) {}
}

function autoLaunchActive() {
  return app.getLoginItemSettings().openAtLogin;
}

function buildTray() {
  const ic = nativeImage.createFromPath(iconPath() || '');
  tray = new Tray(ic.isEmpty() ? nativeImage.createEmpty() : ic);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'فتح ' + APP_NAME, click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: 'بدء تلقائي مع تشغيل ويندوز', type: 'checkbox', checked: autoLaunchActive(), click: (item) => {
      app.setLoginItemSettings({ openAtLogin: item.checked });
      notify('البدء التلقائي', item.checked ? 'سيبدأ التطبيق مع تشغيل ويندوز.' : 'أُلغي البدء التلقائي.');
    } },
    { type: 'separator' },
    { label: 'خروج نهائي', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

app.whenReady().then(() => {
  autoLaunchEnabled = autoLaunchActive();
  createWindow();
  buildTray();
  notify('مرحباً بك في ' + APP_NAME, 'التطبيق يعمل الآن. يمكنك تصغيره للشريط وسيتابع العمل.');

  app.on('activate', () => { if (mainWindow === null) createWindow(); });
});

// إعادة المحاولة من شاشة عدم الاتصال
ipcMain.handle('retry-connection', () => {
  offlineShown = false;
  mainWindow.loadURL(APP_URL).catch(() => showOffline());
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { /* يبقى بالشريط — الخروج من قائمته */ });
