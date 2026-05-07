const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('PDF Server is running!'));

app.post('/generate-pdf', async (req, res) => {
  const { html, filename, logoBase64 } = req.body;
  if (!html) return res.status(400).json({ error: 'Missing html' });

  let browser = null;
  try {
    // 1. Load fonts as base64
    let fontCss = '';
    try {
      const fontNormal = fs.readFileSync(path.join(__dirname, 'THSarabun.ttf'));
      const fontBold   = fs.readFileSync(path.join(__dirname, 'THSarabun Bold.ttf'));
      const b64n = fontNormal.toString('base64');
      const b64b = fontBold.toString('base64');
      fontCss = `
        @font-face { font-family:'THSarabun'; src:url('data:font/truetype;base64,${b64n}') format('truetype'); font-weight:normal; }
        @font-face { font-family:'THSarabun'; src:url('data:font/truetype;base64,${b64b}') format('truetype'); font-weight:bold; }
      `;
      console.log('Fonts loaded OK');
    } catch(e) {
      console.warn('Font load failed:', e.message);
    }

    const fontFamily = fontCss ? "'THSarabun',sans-serif" : "'Sarabun',sans-serif";
    const googleFonts = fontCss ? '' : '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">';

    // 2. Logo tag
    const logoTag = logoBase64
      ? `<img src="${logoBase64}" style="height:28px;max-width:110px;object-fit:contain;">`
      : `<span style="font-size:9pt;font-weight:700;">Orbit Digital</span>`;

    // 3. Header/Footer templates (must embed font)
    const headerHtml = `<html><head><style>${fontCss}</style></head><body style="margin:0;padding:0">
<div style="width:100%;padding:2px 18mm;display:flex;justify-content:space-between;align-items:center;font-family:${fontFamily};font-size:9pt;border-bottom:0.5px solid #aaa;-webkit-print-color-adjust:exact;background:#fff;">
  ${logoTag}
  <div style="color:#555;">บริษัท ออร์บิท ดิจิทัล จำกัด</div>
</div></body></html>`;

    const footerHtml = `<html><head><style>${fontCss}</style></head><body style="margin:0;padding:0">
<div style="width:100%;padding:2px 18mm;text-align:center;font-family:${fontFamily};font-size:9pt;font-weight:700;border-top:0.5px solid #aaa;-webkit-print-color-adjust:exact;background:#fff;">
  บริษัท ออร์บิท ดิจิทัล จำกัด<br>
  <span style="font-weight:400;color:#555;font-size:8pt;">51 ถนนนราธิวาสราชนครินทร์ แขวงสีลม เขตบางรัก กรุงเทพมหานคร</span>
</div></body></html>`;

    // 4. Full HTML
    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
${googleFonts}
<style>
  ${fontCss}
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:${fontFamily}; font-size:14pt; color:#000; line-height:1.75; padding:0 8px; }
  table { width:100%; border-collapse:collapse; margin:6px 0; font-size:10pt; }
  th { background:#d0d0d0; font-weight:700; text-align:center; padding:4px 8px; border:1px solid #555; }
  td { padding:3px 8px; border:1px solid #888; text-align:center; }
  td.tdl { text-align:left; }
  tr { page-break-inside:avoid; break-inside:avoid; }
  tr.tr-total td { font-weight:700; background:#ebebeb; border-top:1.5px solid #333; }
  .mp-title { text-align:center; font-size:16pt; font-weight:700; letter-spacing:1px; margin-bottom:14px; }
  .mp-field { display:flex; margin-bottom:5px; }
  .mp-field-label { font-weight:700; min-width:80px; }
  .mp-field-value { flex:1; }
  .mp-body { margin:8px 0; }
  .mp-body p { text-indent:3em; margin-bottom:3px; }
  .mp-list { margin:3px 0 3px 3em; }
  .mp-note { font-size:9pt; color:#333; margin:3px auto 8px; text-align:center; }
  .mp-closing { margin:8px 0 14px; }
  .mp-closing p { text-indent:3em; font-size:9.5pt; line-height:1.7; }
  .mp-approval { display:grid; grid-template-columns:1fr 1fr; border:1px solid #555; margin-top:10px; page-break-inside:avoid; break-inside:avoid; }
  .mp-appr-cell { padding:6px 12px; display:flex; flex-direction:column; }
  .mp-appr-cell:first-child { border-right:1px solid #555; }
  .mp-appr-head { font-size:10pt; font-weight:700; margin-bottom:4px; }
  .mp-appr-opt { font-size:10pt; margin:2px 0; }
  .mp-sig-space { height:36px; border-bottom:1px solid #333; margin:auto 16px 4px; }
  .mp-sig-name { text-align:center; font-size:10pt; font-weight:700; }
  .mp-sig-role { text-align:center; font-size:10pt; color:#333; }
  .mp-sig-date { text-align:center; font-size:9pt; color:#666; margin-top:2px; }
  .mp-hdr { display:flex; justify-content:flex-end; align-items:flex-start; border-bottom:none; padding-bottom:0; margin-bottom:8px; }
  .mp-logo { display:none !important; }
  .mp-hdr-right { text-align:right; font-size:10pt; line-height:2; }
  .num { font-weight:700; }
  .mp-footer { display:none !important; }
  .preview-wrap { background:transparent; }
</style>
</head><body>${html}</body></html>`;

    // 5. Launch browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 20000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '18mm', bottom: '15mm', left: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: headerHtml,
      footerTemplate: footerHtml,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'memo.pdf'}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(pdf);

  } catch (err) {
    console.error('PDF error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF server running on port ${PORT}`));
