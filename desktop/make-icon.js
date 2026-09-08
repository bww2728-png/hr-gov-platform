/* توليد أيقونة المنصة 512×512 من SVG — يشغَّل بمحرك Electron ثم يُحذف */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#312E81'/><stop offset='1' stop-color='#4338CA'/>
  </linearGradient></defs>
  <rect x='16' y='16' width='480' height='480' rx='96' fill='url(#g)'/>
  <text x='256' y='330' font-family='Segoe UI, Tahoma' font-size='300' font-weight='800' fill='#ffffff' text-anchor='middle'>ن</text>
  <g opacity='0.95'>
    <rect x='216' y='388' width='80' height='16' rx='8' fill='#A5B4FC'/>
    <path d='M 226 372 L 256 344 L 286 372' stroke='#A5B4FC' stroke-width='16' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  </g>
</svg>`;

app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 512, height: 512 });
  await win.loadURL('data:text/html,<html><body></body></html>');
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(SVG).toString('base64');
  const b64 = await win.webContents.executeJavaScript(`(async () => {
    const i = new Image();
    i.src = ${JSON.stringify(dataUrl)};
    await new Promise((r) => { i.onload = r; i.onerror = r; });
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    c.getContext('2d').drawImage(i, 0, 0, 512, 512);
    return c.toDataURL('image/png').split(',')[1];
  })()`);
  fs.writeFileSync(path.join(__dirname, 'icon.png'), Buffer.from(b64, 'base64'));
  console.log('ICON-OK', fs.statSync(path.join(__dirname, 'icon.png')).size, 'bytes');
  app.quit();
});

const path = require('path');
