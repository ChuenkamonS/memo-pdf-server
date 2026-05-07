const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.send('PDF Server is running!'));

app.post('/generate-pdf', async (req, res) => {
  const { html, filename, logoBase64 } = req.body;
  if (!html) return res.status(400).json({ error: 'Missing html' });

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: 'new'
    });

    const page = await browser.newPage();

    const logoTag = logoBase64
      ? `<img src="${logoBase64}" style="height:40px;object-fit:contain;">`
      : `<span style="font-weight:700;color:#185FA5;font-size:12pt;">Orbit Digital</span>`;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* Fixed header - appears on every printed page */
  .pdf-page-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 22mm;
    padding: 6px 18mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #aaa;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-page-header-right {
    font-size: 8pt;
    color: #555;
    font-family: 'Sarabun', sans-serif;
  }

  /* Fixed footer - appears on every printed page */
  .pdf-page-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 18mm;
    padding: 6px 18mm;
    text-align: center;
    border-top: 1px solid #aaa;
    background: #fff;
    font-family: 'Sarabun', sans-serif;
    font-size: 9pt;
    font-weight: 700;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-page-footer-sub {
    font-weight: 400;
    font-size: 8pt;
    color: #555;
    display: block;
    margin-top: 2px;
  }

  /* Main content - padded to not overlap header/footer */
  body {
    font-family: 'Sarabun', serif;
    font-size: 10pt;
    color: #000;
    line-height: 1.75;
    padding: 26mm 18mm 22mm 18mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Memo styles */
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10pt; }
  th { background: #d0d0d0; font-weight: 700; text-align: center; padding: 4px 8px; border: 1px solid #555; -webkit-print-color-adjust: exact; }
  td { padding: 3px 8px; border: 1px solid #888; text-align: center; }
  td.tdl { text-align: left; }
  tr.tr-total td { font-weight: 700; background: #ebebeb; border-top: 1.5px solid #333; -webkit-print-color-adjust: exact; }
  .mp-title { text-align: center; font-size: 16pt; font-weight: 700; letter-spacing: 1px; margin-bottom: 14px; }
  .mp-field { display: flex; margin-bottom: 5px; }
  .mp-field-label { font-weight: 700; min-width: 80px; }
  .mp-field-value { flex: 1; }
  .mp-body { margin: 8px 0; }
  .mp-body p { text-indent: 3em; margin-bottom: 3px; }
  .mp-list { margin: 3px 0 3px 3em; }
  .mp-note { font-size: 9pt; color: #333; margin: 3px auto 8px; text-align: center; }
  .mp-closing { margin: 8px 0 14px; }
  .mp-closing p { text-indent: 3em; font-size: 9.5pt; line-height: 1.7; }
  .mp-approval { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #555; margin-top: 10px; page-break-inside: avoid; break-inside: avoid; }
  .mp-appr-cell { padding: 6px 12px; display: flex; flex-direction: column; }
  .mp-appr-cell:first-child { border-right: 1px solid #555; }
  .mp-appr-head { font-size: 10pt; font-weight: 700; margin-bottom: 4px; }
  .mp-appr-opt { font-size: 10pt; margin: 2px 0; }
  .mp-sig-space { height: 36px; border-bottom: 1px solid #333; margin: auto 16px 4px; }
  .mp-sig-name { text-align: center; font-size: 10pt; font-weight: 700; }
  .mp-sig-role { text-align: center; font-size: 10pt; color: #333; }
  .mp-sig-date { text-align: center; font-size: 9pt; color: #666; margin-top: 2px; }
  .mp-hdr { display: none !important; }
  .mp-footer { display: none !important; }
  .preview-wrap { background: transparent; }
  .num { font-weight: 700; }
</style>
</head>
<body>

<!-- Static header on every page -->
<div class="pdf-page-header">
  <div>${logoTag}</div>
  <div class="pdf-page-header-right">บริษัท ออร์บิท ดิจิทัล จำกัด</div>
</div>

<!-- Static footer on every page -->
<div class="pdf-page-footer">
  บริษัท ออร์บิท ดิจิทัล จำกัด
  <span class="pdf-page-footer-sub">51 ถนนนราธิวาสราชนครินทร์ แขวงสีลม เขตบางรัก กรุงเทพมหานคร</span>
</div>

<!-- Memo content -->
${html}

</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 20000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '25mm', right: '18mm', bottom: '22mm', left: '18mm' },
      displayHeaderFooter: false,  // Using CSS fixed positioning instead
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
