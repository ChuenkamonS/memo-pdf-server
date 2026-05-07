const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('PDF Server is running!'));

app.post('/generate-pdf', async (req, res) => {
  const { html, filename } = req.body;
  if (!html) return res.status(400).json({ error: 'Missing html' });

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: 'new'
    });

    const page = await browser.newPage();

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'TH Sarabun New', Sarabun, serif; font-size: 10pt; color: #000; line-height: 1.75; padding: 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10pt; }
  th { background: #d0d0d0; font-weight: 700; text-align: center; padding: 4px 8px; border: 1px solid #555; }
  td { padding: 3px 8px; border: 1px solid #888; text-align: center; }
  td.tdl { text-align: left; }
  tr.tr-total td { font-weight: 700; background: #ebebeb; border-top: 1.5px solid #333; }
  .mp-title { text-align: center; font-size: 16pt; font-weight: 700; letter-spacing: 1px; margin-bottom: 14px; }
  .mp-field { display: flex; margin-bottom: 5px; }
  .mp-field-label { font-weight: 700; min-width: 80px; }
  .mp-body p { text-indent: 3em; margin-bottom: 3px; }
  .mp-list { margin: 3px 0 3px 3em; }
  .mp-note { font-size: 9pt; color: #333; margin: 3px auto 8px; text-align: center; }
  .mp-closing p { text-indent: 3em; font-size: 9.5pt; line-height: 1.7; }
  .mp-approval { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #555; margin-top: 10px; page-break-inside: avoid; }
  .mp-appr-cell { padding: 6px 12px; display: flex; flex-direction: column; }
  .mp-appr-cell:first-child { border-right: 1px solid #555; }
  .mp-appr-head { font-size: 10pt; font-weight: 700; margin-bottom: 4px; }
  .mp-appr-opt { font-size: 10pt; margin: 2px 0; }
  .mp-sig-space { height: 36px; border-bottom: 1px solid #333; margin: auto 16px 4px; }
  .mp-sig-name { text-align: center; font-size: 10pt; font-weight: 700; }
  .mp-sig-role { text-align: center; font-size: 10pt; color: #333; }
  .mp-sig-date { text-align: center; font-size: 9pt; color: #666; margin-top: 2px; }
  .mp-hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #888; padding-bottom: 10px; margin-bottom: 14px; }
  .mp-logo { max-height: 55px; max-width: 140px; object-fit: contain; }
  .mp-hdr-right { text-align: right; font-size: 10pt; line-height: 2; }
  .num { text-decoration: underline; font-weight: 700; }
  .mp-footer { display: none; }
  .preview-wrap { background: transparent; }
</style>
</head>
<body>${html}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 15000 });

    const logoTag = `<div style="display:flex;align-items:center;padding:6px 0">
      <span style="font-size:9pt;font-weight:700;color:#185FA5">Orbit Digital</span>
    </div>`;

    const headerHtml = `<div style="width:100%;padding:4px 20mm;display:flex;justify-content:space-between;align-items:center;font-family:'TH Sarabun New',Sarabun,serif;font-size:8pt;border-bottom:0.5px solid #aaa;-webkit-print-color-adjust:exact">
      ${logoTag}
      <span style="color:#555">บริษัท ออร์บิท ดิจิทัล จำกัด</span>
    </div>`;

    const footerHtml = `<div style="width:100%;padding:4px 20mm;text-align:center;font-family:'TH Sarabun New',Sarabun,serif;font-size:8pt;font-weight:700;border-top:0.5px solid #aaa;-webkit-print-color-adjust:exact">
      บริษัท ออร์บิท ดิจิทัล จำกัด<br>
      <span style="font-weight:400;color:#555;font-size:7.5pt">51 ถนนนราธิวาสราชนครินทร์ แขวงสีลม เขตบางรัก กรุงเทพมหานคร</span>
    </div>`;

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '28mm', right: '18mm', bottom: '28mm', left: '18mm' },
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
