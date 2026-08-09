// =====================================================
// code.gs  –  Google Apps Script Backend
// PISA 2029 Learning Activities Web App
// =====================================================
// 
// วิธีใช้งาน:
// 1. ไปที่ https://script.google.com → สร้างโปรเจกต์ใหม่
// 2. วาง code.gs และ index.html ในโปรเจกต์
// 3. Deploy → Web App → Execute as: Me, Who has access: Anyone
// 4. คัดลอก URL ที่ได้ไปแชร์
// =====================================================

const SPREADSHEET_ID = '1vo2anZD6TpFUecCXxQOsAd2AoopzSksWgS7MqWLvjI4';
const SHEET_NAME     = 'PISA 2029';

/**
 * Entry point – serves the HTML web app
 */
function doGet(e) {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('PISA 2029 | กิจกรรมการเรียนรู้เพื่อเตรียมพร้อมรับการประเมิน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetch data from the Sheet and return as JSON string
 * Called from the client via google.script.run.getData()
 */
function getData() {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return JSON.stringify({ error: `ไม่พบ Sheet ชื่อ "${SHEET_NAME}" – ตรวจสอบชื่อ Tab ใน Spreadsheet` });
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return JSON.stringify([]);

    const raw = sheet.getRange(1, 1, lastRow, Math.max(lastCol, 7)).getValues();

    const items = raw.slice(1)   // skip header
      .map((row, i) => ({
        id:             String(row[0] || i + 1).replace(/\.0$/, '').trim(),
        title:          String(row[1] || '').trim(),
        reference:      String(row[2] || '').trim(),
        activities:     String(row[3] || '').trim(),
        assessment:     String(row[4] || '').trim(),
        materials:      String(row[5] || '').trim(),
        assessmentTool: String(row[6] || '').trim(),
      }))
      .filter(it => it.title);

    return JSON.stringify(items);

  } catch (err) {
    Logger.log('getData error: ' + err.message);
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Helper – include another HTML file in a template
 * Usage in HTML: <?!= include('style') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
