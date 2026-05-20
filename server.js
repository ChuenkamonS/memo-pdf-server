const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Cache fonts at startup (read once, never again) ──
let _fontCss = null;
function getFontCss() {
  if (_fontCss !== null) return _fontCss;
  try {
    const b64n = fs.readFileSync(path.join(__dirname, 'THSarabun.ttf')).toString('base64');
    const b64b = fs.readFileSync(path.join(__dirname, 'THSarabun Bold.ttf')).toString('base64');
    _fontCss = `
      @font-face { font-family:'THSarabun'; src:url('data:font/truetype;base64,${b64n}') format('truetype'); font-weight:normal; }
      @font-face { font-family:'THSarabun'; src:url('data:font/truetype;base64,${b64b}') format('truetype'); font-weight:bold; }
    `;
    console.log('Fonts cached OK');
  } catch(e) {
    console.warn('Font load failed:', e.message);
    _fontCss = '';
  }
  return _fontCss;
}

// ── Reuse browser + simple queue to prevent ETXTBSY crash ──
let _browser = null;
let _browserReady = false;
let _queue = 0;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  _browserReady = false;
  _browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  _browserReady = true;
  console.log('Browser launched');
  return _browser;
}

async function waitForBrowser(maxWaitMs = 15000) {
  const start = Date.now();
  while (_queue > 0 && !_browserReady) {
    if (Date.now() - start > maxWaitMs) throw new Error('Browser queue timeout');
    await new Promise(r => setTimeout(r, 200));
  }
  return getBrowser();
}

app.get('/', (req, res) => res.send('PDF Server is running!'));
app.get('/ping', (req, res) => res.send('pong'));

app.post('/generate-pdf', async (req, res) => {
  const { html, filename, logoBase64 } = req.body;
  if (!html) return res.status(400).json({ error: 'Missing html' });

  // FIX 1: sanitize filename — strip non-ASCII to prevent Content-Disposition error
  const safeFilename = (filename || 'memo.pdf').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_') || 'memo.pdf';

  _queue++;
  let page = null;
  try {
    const fontCss = getFontCss();
    const fontFamily = fontCss ? "'THSarabun',sans-serif" : "'Sarabun',sans-serif";
    const googleFonts = fontCss ? '' : '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">';

    const logoTag = logoBase64
      ? `<img src="${logoBase64}" style="height:84px;max-width:330px;object-fit:contain;">`
      : `<span style="font-size:9pt;font-weight:700;">Orbit Digital</span>`;

    const headerHtml = `<html><head><style>${fontCss}</style></head><body style="margin:0;padding:0">
<div style="width:100%;padding:2px 18mm;display:flex;align-items:center;-webkit-print-color-adjust:exact;background:#fff;">
  ${logoTag}
</div></body></html>`;

    const footerHtml = `<html><head><style>${fontCss}</style></head><body style="margin:0;padding:0">
<div style="width:100%;padding:2px 18mm;text-align:center;font-family:${fontFamily};font-size:9pt;font-weight:700;-webkit-print-color-adjust:exact;background:#fff;">
  บริษัท ออร์บิท ดิจิทัล จำกัด<br>
  <span style="font-weight:400;color:#555;font-size:8pt;">51 ถนนนราธิวาสราชนครินทร์ แขวงสีลม เขตบางรัก กรุงเทพมหานคร</span>
</div></body></html>`;

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
${googleFonts}
<style>
  ${fontCss}
  * { box-sizing:border-box; margin:0; padding:0; font-size:14pt; }
  body { font-family:${fontFamily}; font-size:14pt; color:#000; line-height:1.75; padding:0 8px; }
  table { width:100%; border-collapse:collapse; margin:6px 0; font-size:14pt; }
  th { background:#d0d0d0; font-weight:700; text-align:center; padding:4px 8px; border:1px solid #555; font-size:14pt; }
  td { padding:3px 8px; border:1px solid #888; text-align:center; font-size:14pt; }
  td.tdl { text-align:left; }
  tr { page-break-inside:avoid; break-inside:avoid; }
  table { page-break-inside:auto; }
  #pdf-acct-wrap, .mp-acct-wrap { page-break-before:auto; }
  .mp-note + * { page-break-before:auto; }
  tr.tr-total td { font-weight:700; background:#ebebeb; border-top:1.5px solid #333; }
  .mp-title { text-align:center; font-size:20pt; font-weight:700; letter-spacing:1px; margin-bottom:14px; }
  .mp-field { display:flex; margin-bottom:5px; font-size:14pt; }
  .mp-field-label { font-weight:700; min-width:80px; font-size:14pt; }
  .mp-field-value { flex:1; font-size:14pt; }
  .mp-body { margin:8px 0; font-size:14pt; }
  .mp-body p { text-indent:3em; margin-bottom:3px; font-size:14pt; }
  .mp-list { margin:3px 0 3px 3em; font-size:14pt; }
  .mp-note { font-size:14pt; color:#333; margin:3px auto 8px; text-align:center; }
  .mp-closing { margin:8px 0 14px; font-size:14pt; }
  .mp-closing p { text-indent:3em; font-size:14pt; line-height:1.7; }
  .mp-approval { display:grid; grid-template-columns:1fr 1fr; border:1px solid #555; margin-top:10px; page-break-inside:avoid; break-inside:avoid; }
  .mp-appr-cell { padding:6px 12px; display:flex; flex-direction:column; }
  .mp-appr-cell:first-child { border-right:1px solid #555; }
  .mp-appr-head { font-size:14pt; font-weight:700; margin-bottom:4px; }
  .mp-appr-opt { font-size:14pt; margin:2px 0; }
  .mp-sig-space { height:36px; border-bottom:1px solid #333; margin:auto 16px 4px; }
  .mp-sig-name { text-align:center; font-size:14pt; font-weight:700; }
  .mp-sig-role { text-align:center; font-size:14pt; color:#333; }
  .mp-sig-date { text-align:center; font-size:12pt; color:#666; margin-top:2px; }
  .mp-hdr { display:flex; justify-content:flex-end; align-items:flex-start; border-bottom:none; padding-bottom:0; margin-bottom:8px; }
  .mp-logo { display:none !important; }
  .mp-hdr-right { text-align:right; font-size:14pt; line-height:2; }
  .num { font-weight:700; }
  .mp-footer { display:none !important; }
  .preview-wrap { background:transparent; }
</style>
</head><body>${html}</body></html>`;

    // FIX 2: wait for queue, reuse browser, open new page per request
    const browser = await waitForBrowser();
    page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '28mm', right: '18mm', bottom: '18mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: headerHtml,
      footerTemplate: footerHtml,
    });

    res.setHeader('Content-Type', 'application/pdf');
    // FIX 1: use safe ASCII filename in header, keep original in content-disposition utf-8
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename || 'memo.pdf')}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(pdf);

  } catch (err) {
    console.error('PDF error:', err.message);
    // FIX 2: if browser crashed, reset so next request gets a fresh one
    if (err.message.includes('ETXTBSY') || err.message.includes('Protocol error') || err.message.includes('Target closed')) {
      console.log('Browser crashed — resetting');
      _browser = null;
      _browserReady = false;
    }
    res.status(500).json({ error: err.message });
  } finally {
    _queue = Math.max(0, _queue - 1);
    if (page) await page.close().catch(() => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PDF server running on port ${PORT}`);
  getFontCss();
  getBrowser().catch(e => console.warn('Pre-warm failed:', e.message));
});
