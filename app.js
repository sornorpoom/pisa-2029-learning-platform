/* =====================================================
   PISA 2029 – app.js  v2 (JSONP Fix)
   ─────────────────────────────────────────────────────
   Data pipeline (ลำดับความสำคัญ):
   1. /api/sheets   → Vercel serverless proxy  (fastest on Vercel)
   2. JSONP gviz    → <script> tag, ZERO CORS  (works on file://)
   3. Embedded data → always works offline
   ===================================================== */

'use strict';

// ─── Config ──────────────────────────────────────────
const SHEET_ID   = '1vo2anZD6TpFUecCXxQOsAd2AoopzSksWgS7MqWLvjI4';
const SHEET_TAB  = 'PISA 2029';
const API_PATH   = '/api/sheets';   // Vercel serverless proxy

// Google Visualization JSONP endpoint
// ✅ No CORS: loaded via <script> tag, works from file://, localhost, any domain
const GVIZ_BASE  =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?sheet=${encodeURIComponent(SHEET_TAB)}`;

// Detect Google Apps Script environment
const IS_GAS = typeof google !== 'undefined' && typeof google.script !== 'undefined';

// ─── State ───────────────────────────────────────────
let allItems      = [];
let filteredItems = [];
let searchTimer   = null;
let toastTimer    = null;
let lastUpdated   = null;
let currentSig    = '';    // Google Sheets data signature (for change detection)
let pollTimer     = null;  // Polling interval reference
const POLL_INTERVAL_MS = 30_000; // ตรวจทุก 30 วินาที ( Real-time check )

// ─── Embedded Fallback Data ──────────────────────────
// ใช้เมื่อ network ไม่ตอบสนองเลย (เช่น ไม่มีอินเทอร์เน็ต)
const FALLBACK_DATA = [
  {
    id: '1',
    title: 'เตือนภัย Deepfake ปลอมเป็นผู้นำและผู้บริหาร หลอกโอนเงินผ่าน Zoom และสื่อสังเคราะห์',
    reference: 'https://www.thaipbs.or.th/verify/article/content/14211',
    activities: `กิจกรรม 'Spot the Fake: จับโป๊ะ AI Deepfake และสแกมเมอร์ไซเบอร์' (สำหรับนักเรียน ม.1-ม.3):
1. ขั้นนำ (Engage): ครูเปิดคลิปวิดีโอ/ภาพเปรียบเทียบระหว่างบุคคลจริงกับภาพ Deepfake ที่สร้างโดย AI แล้วให้นักเรียนร่วมกันตั้งคำถามว่า 'ภาพ/เสียงนี้เป็นของจริงหรือไม่? รู้ได้อย่างไร?'
2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวการใช้ AI Deepfake ปลอมแปลงหน้าและเสียงในเหตุการณ์หลอกโอนเงิน ร่วมกันวิเคราะห์องค์ประกอบ 3 ด้าน ได้แก่ (1) ข้อบกพร่องทางเทคนิคของ AI (เช่น กะพริบตาผิดธรรมชาติ เสียงไม่มีน้ำหนัก แสงเงาผิดปกติ) (2) เจตนาของผู้สร้าง (Intent) และ (3) ผลกระทบทางสังคมและจริยธรรม
3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'คู่มือเช็กลิสต์การตรวจสอบ AI Deepfake' (AI Verification Checklist) และร่วมกันสร้างสถานการณ์จำลอง (Role-play) การตั้งคำถามเพื่อยืนยันตัวตน (Human Verification Protocol)
4. ขั้นสะท้อนคิด (Reflect): สรุปบทเรียนในมิติ PISA 2029 MAIL Literacy เกี่ยวกับความรับผิดชอบ การตั้งคำถามอย่างมีวิจารณญาณก่อนเชื่อหรือแชร์ข้อมูล (Critical Thinking & Human Agency)`,
    assessment: `- ประเมินสมรรถนะการวิเคราะห์สื่อสังเคราะห์ (Synthetic Media Analysis): ตรวจสอบความถูกต้องของคู่มือเช็กลิสต์การจับสังเกต AI Deepfake โดยใช้แบบประเมินรูบริก (Rubric) ด้านการคิดเชิงวิพากษ์ (Critical Thinking)
- ประเมินการปฏิบัติในสถานการณ์จำลอง (Role-play Assessment): ประเมินความสามารถในการใช้โปรโตคอลยืนยันตัวตนและการแก้ปัญหาเฉพาะหน้าเมื่อเผชิญภัยไซเบอร์จาก AI
- แบบวัดการรู้เท่าทันสื่อและปัญญาประดิษฐ์ (MAIL Literacy Quiz): แบบทดสอบปรนัยและอัตนัยประเมินความเข้าใจเกี่ยวกับเจตนา สิทธิความเป็นส่วนตัว (Privacy) และผลกระทบทางจริยธรรมของ AI ตามกรอบ PISA 2029`,
    materials: `- บทความข่าวเตือนภัย Deepfake จาก Thai PBS Verify (https://www.thaipbs.or.th/verify/article/content/14211)
- ตัวอย่างสื่อสังเคราะห์ (Deepfake Video & Voice Clips) สำหรับฝึกจับโป๊ะ
- ใบงานวิเคราะห์องค์ประกอบข่าวสารและเจตนาของสื่อ AI (AI Media Analysis Worksheet)
- สไลด์นำเสนอความรู้เรื่องกรอบแนวคิด PISA 2029 MAIL Literacy
- แพลตฟอร์มดิจิทัล interactive (เช่น Kahoot / Padlet) สำหรับระดมความคิดและทำแบบทดสอบ`
  },
  {
    id: '2',
    title: 'เมื่อข่าวปลอมดูจริงกว่าความจริง เท่าทันสงครามข้อมูลและอัลกอริทึมในยุค AI',
    reference: 'https://www.thaipbs.or.th/verify/article/content/6225',
    activities: `กิจกรรม 'Decoder of Algorithmic Echo Chamber & AI Slop: ถอดรหัสอัลกอริทึมและขยะดิจิทัล' (สำหรับนักเรียน ม.1-ม.3):
1. ขั้นนำ (Engage): ครูให้นักเรียนเปรียบเทียบหน้าฟีดโซเชียลมีเดียของตนเอง แล้วร่วมกันอภิปรายว่า 'ทำไมเนื้อหาที่ระบบแนะนำให้เราแต่ละคนจึงไม่เหมือนกัน? และเนื้อหาคุณภาพต่ำที่สร้างจาก AI (AI Slop) ถูกดันขึ้นมาได้อย่างไร?'
2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนอ่านบทความข่าวเรื่องสงครามข้อมูลและอัลกอริทึม ร่วมกันวิเคราะห์ 3 ประเด็นหลัก: (1) การทำงานของอัลกอริทึมในการจัดลำดับเนื้อหา (Algorithmic Curation/Filter Bubbles) (2) ลักษณะของคอนเทนต์ขยะ AI (AI Slop) ที่เน้นยอดคลิก (Clickbait) แต่ขาดความถูกต้อง และ (3) ผลกระทบต่อความคิดเห็นและการตัดสินใจในสังคม
3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนทดลองออกแบบ 'แผนผังผดุงจริยธรรมอัลกอริทึม' (Ethical Feed Design) และจัดทำอินโฟกราฟิกแนะนำวิธี 'ฝึกอัลกอริทึมให้ฉลาด' (Algorithmic Literacy & Curation)
4. ขั้นสะท้อนคิด (Reflect): ร่วมกันอภิปรายถกแถลงในมิติ PISA 2029 MAIL Literacy (Shape AI & Engage with AI) ถึงบทบาทของเยาวชนในการลดมลพิษดิจิทัลและการใช้โซเชียลมีเดียอย่างตระหนักรู้`,
    assessment: `- ประเมินสมรรถนะการรู้เท่าทันอัลกอริทึม (Algorithmic Literacy Assessment): ประเมินความเข้าใจเรื่องโครงสร้างอัลกอริทึมและห้องสะท้อนเสียง (Echo Chambers) ผ่านใบงานวิเคราะห์กรณีศึกษา
- ประเมินผลงานการออกแบบ (Creative & Solution-Based Assessment): ประเมินชิ้นงานอินโฟกราฟิก 'การฝึกอัลกอริทึมและคัดกรอง AI Slop' ด้วยแบบประเมินรูบริก (Rubric) ด้านการสื่อสารและความเป็นพลเมืองดิจิทัล
- แบบวัดทักษะการตั้งคำถามเชิงวิพากษ์ (PISA 2029 MAIL Critical Questions Quiz): แบบทดสอบประเมินความสามารถในการจำแนกเจตนาของสื่อและการประเมินความน่าเชื่อถือของเนื้อหาที่แนะนำโดย AI`,
    materials: `- บทความข่าวจาก Thai PBS Verify เรื่อง 'เมื่อข่าวปลอมดูจริงกว่าความจริง เท่าทันสงครามข้อมูลและอัลกอริทึมในยุค AI' (https://www.thaipbs.or.th/verify/article/content/6225)
- ตัวอย่างกรณีศึกษาภาพ/คลิป AI Slop และสื่อที่มีการจัดตั้งกระแส (Astroturfing) ในโซเชียลมีเดีย
- ใบงานผังความคิด 'Algorithmic Awareness & Information Disorder Worksheet'
- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Engage with AI และ Shape AI
- เครื่องมือประเมินออนไลน์ (Interactive Quiz / Padlet) สำหรับการนำเสนอชิ้นงานและการสะท้อนความคิดเห็น`
  },
  {
    id: '3',
    title: 'สรุปชัด! ใช้ AI สร้างรูปตามกระแสโซเชียล เสี่ยงละเมิดลิขสิทธิ์หรือไม่? เช็กได้ที่นี่',
    reference: 'https://www.thairath.co.th/lifestyle/tech/2932022',
    activities: `กิจกรรม 'Generative AI Art & Intellectual Property: สร้างสรรค์อย่างฉลาด ไม่ละเมิดลิขสิทธิ์' (สำหรับนักเรียน ม.1-ม.3):
1. ขั้นนำ (Engage): ครูนำภาพผลงานศิลปะที่สร้างจาก Generative AI (เช่น ภาพสไตล์สตูดิโอจิบลิ ภาพสไตล์ศิลปินชื่อดัง) มาให้นักเรียนดู แล้วชวนคิดว่า 'ใครคือเจ้าของลิขสิทธิ์ภาพนี้? AI, ผู้ป้อนคำสั่ง (Prompter) หรือศิลปินต้นฉบับที่ AI ใช้เรียนรู้?'
2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนแบ่งกลุ่มอ่านบทความข้อกฎหมายลิขสิทธิ์ไทยและการใช้ Generative AI สร้างภาพตามกระแส ร่วมกันวิเคราะห์ 3 ประเด็น: (1) สิทธิความเป็นเจ้าของผลงานจาก AI (Human Authorship) (2) การนำผลงานศิลปินไปเทรนโมเดล AI (Training Data Ethics) และ (3) ความเสี่ยงทางกฎหมายจริยธรรมเมื่อนำภาพ AI ไปใช้ในเชิงพาณิชย์
3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนทดลองเขียนคำสั่งสร้างภาพ (Prompt Design) โดยยึดหลัก 'การสร้างสรรค์ร่วมกับ AI อย่างมีจริยธรรม' (Ethical Human-AI Collaboration) พร้อมจัดทำ 'แนวปฏิบัติการอ้างอิงและให้เกียรติลิขสิทธิ์' (AI Attribution & Ethics Guideline)
4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Create with AI & Shape AI) เกี่ยวกับบทบาทของมนุษย์ในฐานะผู้ควบคุมการสร้างสรรค์ (Human Agency) และการเคารพสิทธิทรัพย์สินทางปัญญาในยุคดิจิทัล`,
    assessment: `- ประเมินสมรรถนะการวิเคราะห์จริยธรรมและลิขสิทธิ์ AI (AI Copyright & Ethics Rubric): ประเมินความเข้าใจเรื่องสิทธิทรัพย์สินทางปัญญาและการใช้งานที่ชอบธรรม (Fair Use) ผ่านแบบบันทึกการวิเคราะห์กรณีศึกษา
- ประเมินการสร้างสรรค์และการอ้างอิง (Creative & Responsible AI Task): ประเมินการออกแบบชิ้นงานสื่อสร้างสรรค์ร่วมกับ AI พร้อมการแสดงข้อความอ้างอิงสิทธิ (Attribution Statement) และคำอธิบายเจตนาการสร้างสรรค์
- แบบวัดความตระหนักรู้กฎหมายดิจิทัล (Digital Rights & Generative AI Literacy Quiz): แบบทดสอบปรนัยและสถานการณ์จำลองประเมินการตัดสินใจเชิงจริยธรรมเมื่อใช้เครื่องมือ Generative AI`,
    materials: `- บทความข่าวเรื่อง 'สรุปชัด! ใช้ AI สร้างรูปตามกระแสโซเชียล เสี่ยงละเมิดลิขสิทธิ์หรือไม่?' จาก ไทยรัฐออนไลน์ (https://www.thairath.co.th/lifestyle/tech/2932022)
- ตัวอย่างเปรียบเทียบภาพผลงานศิลปินจริงและภาพผลงานสร้างจาก Generative AI Prompt
- ใบงานวิเคราะห์กรณีศึกษา 'AI Art vs. Copyright & Ethics Case Study'
- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Create with AI (Human Agency & Intellectual Property)
- แพลตฟอร์มสร้างสรรค์ภาพ AI แบบเปิดกว้าง (เช่น Canva / Microsoft Designer) สำหรับการทดลองเขียนคำสั่งอย่างมีจริยธรรม`
  }
];

// ─── CSV Parser (multiline-safe) ─────────────────────
function parseCSV(raw) {
  const rows = [];
  let pos = 0, len = raw.length;
  while (pos < len) {
    const row = [];
    while (pos < len) {
      if (raw[pos] === '"') {
        pos++;
        let cell = '';
        while (pos < len) {
          if (raw[pos] === '"') {
            if (raw[pos + 1] === '"') { cell += '"'; pos += 2; }
            else { pos++; break; }
          } else { cell += raw[pos++]; }
        }
        row.push(cell.trim());
      } else {
        let cell = '';
        while (pos < len && raw[pos] !== ',' && raw[pos] !== '\r' && raw[pos] !== '\n') {
          cell += raw[pos++];
        }
        row.push(cell.trim());
      }
      if (pos < len && raw[pos] === ',') { pos++; continue; }
      break;
    }
    if (pos < len && raw[pos] === '\r') pos++;
    if (pos < len && raw[pos] === '\n') pos++;
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

// ─── Data Transforms ─────────────────────────────────
function rowsToItems(rows) {
  return rows.slice(1)
    .map((r, i) => ({
      id:         String(r[0] || i + 1),
      title:      (r[1] || '').trim(),
      reference:  (r[2] || '').trim(),
      activities: (r[3] || '').trim(),
      assessment: (r[4] || '').trim(),
      materials:  (r[5] || '').trim(),
    }))
    .filter(it => it.title);
}

function gvizTableToItems(table) {
  const rows = table.rows ?? [];
  return rows
    .map((row, i) => ({
      id:         String(row.c?.[0]?.v ?? i + 1),
      title:      String(row.c?.[1]?.v ?? '').trim(),
      reference:  String(row.c?.[2]?.v ?? '').trim(),
      activities: String(row.c?.[3]?.v ?? '').trim(),
      assessment: String(row.c?.[4]?.v ?? '').trim(),
      materials:  String(row.c?.[5]?.v ?? '').trim(),
    }))
    .filter(it => it.title);
}

// ─── Step Parser ─────────────────────────────────────
function parseSteps(text) {
  if (!text) return [];
  const results = [];
  const lines   = text.split('\n');
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(\d+)\.\s+(.+)/);
    if (m) {
      if (cur) results.push(cur);
      const rest     = m[2].trim();
      const colonIdx = rest.search(/[：:]/);
      if (colonIdx > 0) {
        cur = { num: +m[1], label: rest.slice(0, colonIdx).trim(), text: rest.slice(colonIdx + 1).trim() };
      } else {
        cur = { num: +m[1], label: '', text: rest };
      }
    } else if (cur && line) {
      cur.text += ' ' + line;
    }
  }
  if (cur) results.push(cur);
  return results;
}

function parseBullets(text) {
  if (!text) return [];
  return text.split(/\n-\s*/)
    .map(s => s.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

// ─── HTML Helpers ────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlight(text, q) {
  if (!q) return esc(text);
  const safe = esc(text);
  const escQ  = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(escQ, 'gi'), m => `<mark class="hl">${m}</mark>`);
}

// ─── Render ──────────────────────────────────────────
const STEP_EMOJIS = ['🎯','🔍','🛠️','💡'];

function renderSteps(activitiesText, q) {
  const steps = parseSteps(activitiesText);
  const firstNumLine = activitiesText.search(/\n?\d+\.\s/);
  const titleBlock   = firstNumLine > 0 ? activitiesText.slice(0, firstNumLine).trim() : '';

  let html = '';
  if (titleBlock) {
    html += `<div class="activity-header-label"><span>📋</span>${highlight(titleBlock, q)}</div>`;
  }

  if (!steps.length) {
    html += `<div class="step-text">${highlight(activitiesText, q)}</div>`;
    return html;
  }

  html += `<div class="steps">` + steps.map((s, i) => `
    <div class="step">
      <div class="step-badge">${s.num || i + 1}</div>
      <div class="step-body">
        ${s.label ? `<div class="step-label">${STEP_EMOJIS[i]||''} ${esc(s.label)}</div>` : ''}
        <div class="step-text">${highlight(s.text, q)}</div>
      </div>
    </div>`).join('') + `</div>`;
  return html;
}

function renderBullets(text, q) {
  const items = parseBullets(text);
  if (!items.length) return `<div class="bullet-item">${highlight(text, q)}</div>`;
  return `<div class="bullets">` +
    items.map(it => `<div class="bullet">
      <div class="bullet-dot"></div>
      <div>${highlight(it, q)}</div>
    </div>`).join('') +
  `</div>`;
}

function cardHTML(item, idx, q) {
  const cid = `card-${item.id}`;
  return `
<div class="activity-card" id="${cid}" style="animation-delay:${Math.min(idx * 0.06, 0.5)}s">
  <div class="card-head">
    <div class="card-num">${esc(item.id)}</div>
    <div class="card-meta">
      <div class="card-title">${highlight(item.title, q)}</div>
      ${item.reference
        ? `<a href="${esc(item.reference)}" target="_blank" rel="noopener noreferrer" class="card-ref">
             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
               <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
               <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
             </svg>อ้างอิงบทความ
           </a>`
        : ''}
    </div>
  </div>
  <div class="card-tabs" role="tablist">
    <button class="tab-btn active" role="tab" aria-selected="true"
      onclick="switchTab('${cid}','activities',this)">📋 กิจกรรม</button>
    <button class="tab-btn" role="tab" aria-selected="false"
      onclick="switchTab('${cid}','assessment',this)">📊 การประเมิน</button>
    <button class="tab-btn" role="tab" aria-selected="false"
      onclick="switchTab('${cid}','materials',this)">📚 สื่อการสอน</button>
  </div>
  <div class="tab-panels">
    <div class="tab-panel active" id="${cid}-activities" role="tabpanel">
      ${renderSteps(item.activities, q)}
    </div>
    <div class="tab-panel" id="${cid}-assessment" role="tabpanel">
      ${renderBullets(item.assessment, q)}
    </div>
    <div class="tab-panel" id="${cid}-materials" role="tabpanel">
      ${renderBullets(item.materials, q)}
    </div>
  </div>
</div>`;
}

// ─── Tab Switch ──────────────────────────────────────
function switchTab(cid, panel, btn) {
  const card = document.getElementById(cid);
  if (!card) return;
  card.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected','false');
  });
  card.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  btn.setAttribute('aria-selected','true');
  const p = document.getElementById(`${cid}-${panel}`);
  if (p) p.classList.add('active');
}

// ─── Render Grid ─────────────────────────────────────
function renderGrid(items, q = '') {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `
      <div class="state-empty">
        <div class="ico">🔍</div>
        <h3>ไม่พบกิจกรรมที่ตรงกับ "${esc(q)}"</h3>
        <p>ลองค้นหาด้วยคำอื่น หรือล้างตัวกรองเพื่อดูทั้งหมด</p>
      </div>`;
  } else {
    grid.innerHTML = items.map((it, i) => cardHTML(it, i, q)).join('');
  }
  updateStats(items.length);
}

function updateStats(n) {
  const el = document.getElementById('statCount');
  if (el) el.innerHTML = `แสดง <strong>${n}</strong> จาก <strong>${allItems.length}</strong> กิจกรรม`;
  const upd = document.getElementById('lastUpdated');
  if (upd && lastUpdated) {
    upd.innerHTML = `<span class="update-dot"></span> อัปเดต ${lastUpdated}`;
  }
}

// ─── Search ──────────────────────────────────────────
function doSearch(q) {
  const lq = q.toLowerCase().trim();
  filteredItems = lq
    ? allItems.filter(it =>
        it.title.toLowerCase().includes(lq)      ||
        it.activities.toLowerCase().includes(lq) ||
        it.assessment.toLowerCase().includes(lq) ||
        it.materials.toLowerCase().includes(lq)  ||
        it.reference.toLowerCase().includes(lq)
      )
    : [...allItems];
  renderGrid(filteredItems, q.trim());
}

// ─── Theme & Font ────────────────────────────────────
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('pisa-theme', t);
  document.querySelectorAll('[data-theme-btn]').forEach(b =>
    b.classList.toggle('active', b.dataset.themeBtn === t));
}

function setFont(f) {
  document.documentElement.setAttribute('data-font', f);
  localStorage.setItem('pisa-font', f);
  document.querySelectorAll('[data-font-btn]').forEach(b =>
    b.classList.toggle('active', b.dataset.fontBtn === f));
}

// ─── Toast ───────────────────────────────────────────
function toast(msg, icon = '✅') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── Fetch Helpers ───────────────────────────────────

/**
 * fetch() with manual timeout (no AbortSignal.timeout — max browser compat)
 */
function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/**
 * JSONP loader – loads gviz via <script> tag → ZERO CORS restriction
 * Works from file://, localhost, any domain, any protocol
 */
function fetchViaJSONP(timeoutMs) {
  return new Promise((resolve, reject) => {
    const cbName = '__pisaGviz_' + Date.now();
    const script = document.createElement('script');

    const cleanup = () => {
      try { if (script.parentNode) document.head.removeChild(script); } catch(_) {}
      delete window[cbName];
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs || 15000);

    window[cbName] = function(data) {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = function() {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Script load error – ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'));
    };

    // Use &tq= to select all rows; callback= for JSONP; _t= timestamp to bypass all caches
    script.src = GVIZ_BASE + '&tq=&callback=' + cbName + '&_t=' + Date.now();
    document.head.appendChild(script);
  });
}

// ─── Main Fetch Pipeline ─────────────────────────────
async function fetchItems() {
  // ── 1. JSONP via Google Visualization API (Direct, Real-time, Zero Cache) ──
  // <script> tags bypass CORS entirely + _t= timestamp forces 100% fresh data from Google
  try {
    const data = await fetchViaJSONP(12000);
    if (data && data.table) {
      if (data.sig) currentSig = data.sig;
      const items = gvizTableToItems(data.table);
      if (items.length) {
        console.log('[PISA] loaded via JSONP (fresh)', items.length, 'items | sig:', currentSig);
        return items;
      }
    }
  } catch (e) {
    console.warn('[PISA] JSONP failed, trying Vercel proxy fallback:', e.message);
  }

  // ── 2. Vercel serverless proxy fallback ──
  if (window.location.protocol !== 'file:') {
    try {
      const r = await fetchWithTimeout(`${API_PATH}?_t=${Date.now()}`, 6000);
      if (r.ok) {
        const csv = await r.text();
        if (csv && csv.trim().length > 10) {
          const items = rowsToItems(parseCSV(csv));
          if (items.length) {
            console.log('[PISA] loaded via Vercel proxy', items.length, 'items');
            return items;
          }
        }
      }
    } catch (_) { /* proxy unavailable */ }
  }

  // ── 3. Embedded fallback (always available) ──
  console.info('[PISA] using embedded fallback data');
  toast('แสดงข้อมูล Offline (กด Refresh เพื่อลองใหม่เมื่อมีอินเทอร์เน็ต)', 'ℹ️');
  return FALLBACK_DATA;
}

// ─── Load Data ───────────────────────────────────────
async function loadData() {
  const grid       = document.getElementById('cardsGrid');
  const refreshBtn = document.getElementById('refreshBtn');

  grid.innerHTML = `
    <div class="state-loading">
      <div class="spinner" role="status" aria-label="กำลังโหลด"></div>
      <p>กำลังโหลดข้อมูลจาก Google Sheets…</p>
    </div>`;

  if (refreshBtn) { refreshBtn.classList.add('spinning'); refreshBtn.disabled = true; }

  try {
    let items;

    if (IS_GAS) {
      // Google Apps Script path
      items = await new Promise((res, rej) => {
        google.script.run
          .withSuccessHandler(json => {
            const data = JSON.parse(json);
            if (data.error) rej(new Error(data.error));
            else res(data);
          })
          .withFailureHandler(e => rej(new Error(e.message)))
          .getData();
      });
    } else {
      items = await fetchItems();
    }

    if (!items || !items.length) {
      throw new Error('ไม่พบข้อมูลใน Sheet "PISA 2029" – ตรวจสอบชื่อ Tab และสิทธิ์การเข้าถึง');
    }

    allItems      = items;
    filteredItems = [...items];
    lastUpdated   = new Date().toLocaleTimeString('th-TH');

    const qEl = document.getElementById('searchInput');
    doSearch(qEl ? qEl.value : '');

    toast(`โหลดข้อมูลสำเร็จ ${items.length} กิจกรรม ✨`);

    // ✅ เริ่ม polling ตรวจจับการเปลี่ยนแปลง
    hideUpdateBanner();
    startPolling();

  } catch (err) {
    console.error('[PISA 2029]', err);
    grid.innerHTML = `
      <div class="state-error">
        <div class="ico">⚠️</div>
        <h3>ไม่สามารถโหลดข้อมูลได้</h3>
        <p>${esc(err.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ')}</p>
        <button class="btn-retry" onclick="loadData()">🔄 ลองอีกครั้ง</button>
      </div>`;
    toast('โหลดข้อมูลไม่สำเร็จ', '❌');
  } finally {
    if (refreshBtn) { refreshBtn.classList.remove('spinning'); refreshBtn.disabled = false; }
  }
}

// ─── Update Notification Banner ──────────────────────

/**
 * สร้าง / แสดงแบนเนอร์แจ้งเตือนมีข้อมูลใหม่
 */
function showUpdateBanner() {
  let banner = document.getElementById('updateBanner');

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span class="banner-ico">📢</span>
      <span class="banner-msg">
        <strong>มีข้อมูลใหม่ใน Google Sheets</strong>
        <span class="banner-sub">ข้อมูลถูกแก้ไขแล้ว กดอัปเดตเมื่อพร้อม</span>
      </span>
      <div class="banner-actions">
        <button class="banner-btn-refresh" onclick="refreshAndHide()">🔄 อัปเดตเดี๋ยวนี้</button>
        <button class="banner-btn-dismiss" onclick="hideUpdateBanner()" aria-label="ปิด">✕</button>
      </div>`;

    // แทรกหลัง header
    const header = document.querySelector('.site-header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  // Force reflow ก่อน animate
  banner.classList.remove('banner-visible');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add('banner-visible'));
  });
}

function hideUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (banner) {
    banner.classList.remove('banner-visible');
    setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
  }
}

function refreshAndHide() {
  hideUpdateBanner();
  stopPolling();
  loadData(); // loadData จะเรียก startPolling() ใหม่หลังโหลดสำเร็จ
}

// ─── Change Detection Polling ─────────────────────────

/**
 * ดึง sig เดียวจาก gviz โดยไม่ parse เนื้อหาทั้งหมด
 * เพื่อตรวจว่า Sheet มีการเปลี่ยนแปลงหรือไม่
 */
function pollForChanges() {
  if (!currentSig) return; // ยังไม่เคยโหลดข้อมูลจริง

  const cbName = '__pisaPoll_' + Date.now();
  const script = document.createElement('script');
  let done = false;

  const cleanup = () => {
    done = true;
    delete window[cbName];
    try { if (script.parentNode) document.head.removeChild(script); } catch(_) {}
  };

  // Timeout 20 วินาที
  const timer = setTimeout(() => { if (!done) cleanup(); }, 20000);

  window[cbName] = function(data) {
    clearTimeout(timer);
    cleanup();

    if (!data || !data.sig) return;

    if (data.sig !== currentSig) {
      console.info('[PISA] 🔔 Data changed! old sig:', currentSig, '→ new sig:', data.sig);
      showUpdateBanner();
      stopPolling(); // หยุด poll จนกว่าผู้ใช้จะกด refresh
    }
  };

  script.onerror = function() {
    clearTimeout(timer);
    cleanup();
  };

  // ดึงเฉพาะ metadata (limit=0 → ไม่ดึงข้อมูล rows จริง แต่ได้ sig) + _t= timestamp กันแคช
  script.src = GVIZ_BASE + '&tqlimit=0&callback=' + cbName + '&_t=' + Date.now();
  document.head.appendChild(script);
}

function startPolling() {
  stopPolling(); // ล้างของเก่าก่อน
  if (!currentSig) return; // มี sig ถึงจะ poll ได้
  pollTimer = setInterval(pollForChanges, POLL_INTERVAL_MS);
  console.log('[PISA] 🕐 Polling started – interval:', POLL_INTERVAL_MS / 1000, 's');
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved preferences
  setTheme(localStorage.getItem('pisa-theme') || 'light');
  setFont(localStorage.getItem('pisa-font')   || 'medium');

  // Search
  const searchEl = document.getElementById('searchInput');
  const clearEl  = document.getElementById('clearSearch');

  searchEl && searchEl.addEventListener('input', e => {
    const v = e.target.value;
    clearEl && clearEl.classList.toggle('show', v.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(v), 280);
  });

  clearEl && clearEl.addEventListener('click', () => {
    searchEl.value = '';
    clearEl.classList.remove('show');
    doSearch('');
    searchEl.focus();
  });

  // Load data
  loadData();

  // หยุด poll เมื่อปิดแท็บ
  window.addEventListener('beforeunload', stopPolling);
});
