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

// ─── Embedded Fallback Data ───
// ใช้เมื่อ network ไม่ตอบสนองเลย (เช่น ไม่มีอินเทอร์เน็ต)
const FALLBACK_DATA = [
    {
        "id":  "1",
        "reference":  "https://www.thaipbs.or.th/verify/article/content/14211",
        "assessmentTool":  "https://docs.google.com/document/d/1k_dNo7BSW6VDSSIL1BW9PSoVbPJ_WIaM1mz8bFvSJag/edit?usp=sharing",
        "activities":  "กิจกรรม \u0027Spot the Fake: จับโป๊ะ AI Deepfake และสแกมเมอร์ไซเบอร์\u0027 (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดคลิปวิดีโอ/ภาพเปรียบเทียบระหว่างบุคคลจริงกับภาพ Deepfake ที่สร้างโดย AI แล้วให้นักเรียนร่วมกันตั้งคำถามว่า \u0027ภาพ/เสียงนี้เป็นของจริงหรือไม่? รู้ได้อย่างไร?\u0027\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวการใช้ AI Deepfake ปลอมแปลงหน้าและเสียงในเหตุการณ์หลอกโอนเงิน ร่วมกันวิเคราะห์องค์ประกอบ 3 ด้าน ได้แก่ (1) ข้อบกพร่องทางเทคนิคของ AI (เช่น กะพริบตาผิดธรรมชาติ เสียงไม่มีน้ำหนัก แสงเงาผิดปกติ) (2) เจตนาของผู้สร้าง (Intent) และ (3) ผลกระทบทางสังคมและจริยธรรม\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนออกแบบ \u0027คู่มือเช็กลิสต์การตรวจสอบ AI Deepfake\u0027 (AI Verification Checklist) และร่วมกันสร้างสถานการณ์จำลอง (Role-play) การตั้งคำถามเพื่อยืนยันตัวตน (Human Verification Protocol) เมื่อพบเจอการติดต่อผ่านวิดีโอคอลหรือสื่อสังเคราะห์\n4. ขั้นสะท้อนคิด (Reflect): สรุปบทเรียนในมิติ PISA 2029 MAIL Literacy เกี่ยวกับความรับผิดชอบ การตั้งคำถามอย่างมีวิจารณญาณก่อนเชื่อหรือแชร์ข้อมูล (Critical Thinking \u0026 Human Agency)",
        "assessment":  "- ประเมินสมรรถนะการวิเคราะห์สื่อสังเคราะห์ (Synthetic Media Analysis): ตรวจสอบความถูกต้องของคู่มือเช็กลิสต์การจับสังเกต AI Deepfake โดยใช้แบบประเมินรูบริก (Rubric) ด้านการคิดเชิงวิพากษ์ (Critical Thinking)\n- ประเมินการปฏิบัติในสถานการณ์จำลอง (Role-play Assessment): ประเมินความสามารถในการใช้โปรโตคอลยืนยันตัวตนและการแก้ปัญหาเฉพาะหน้าเมื่อเผชิญภัยไซเบอร์จาก AI\n- แบบวัดการรู้เท่าทันสื่อและปัญญาประดิษฐ์ (MAIL Literacy Quiz): แบบทดสอบปรนัยและอัตนัยประเมินความเข้าใจเกี่ยวกับเจตนา สิทธิความเป็นส่วนตัว (Privacy) และผลกระทบทางจริยธรรมของ AI ตามกรอบ PISA 2029",
        "materials":  "- บทความข่าวเตือนภัย Deepfake จาก Thai PBS Verify (https://www.thaipbs.or.th/verify/article/content/14211)\n- ตัวอย่างสื่อสังเคราะห์ (Deepfake Video \u0026 Voice Clips) สำหรับฝึกจับโป๊ะ\n- ใบงานวิเคราะห์องค์ประกอบข่าวสารและเจตนาของสื่อ AI (AI Media Analysis Worksheet)\n- สไลด์นำเสนอความรู้เรื่องกรอบแนวคิด PISA 2029 MAIL Literacy\n- แพลตฟอร์มดิจิทัล interactive (เช่น Kahoot / Padlet) สำหรับระดมความคิดและทำแบบทดสอบ",
        "title":  "เตือนภัย Deepfake ปลอมเป็นผู้นำและผู้บริหาร หลอกโอนเงินผ่าน Zoom และสื่อสังเคราะห์"
    },
    {
        "id":  "2",
        "reference":  "https://www.thaipbs.or.th/verify/article/content/6225",
        "assessmentTool":  "https://docs.google.com/document/d/1r0Z46fwsBv_HWAihxDiDromiiAP7HvFrmBetSILULP4/edit?usp=sharing",
        "activities":  "กิจกรรม \u0027Decoder of Algorithmic Echo Chamber \u0026 AI Slop: ถอดรหัสอัลกอริทึมและขยะดิจิทัล\u0027 (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูให้นักเรียนเปรียบเทียบหน้าฟีดโซเชียลมีเดียของตนเอง แล้วร่วมกันอภิปรายว่า \u0027ทำไมเนื้อหาที่ระบบแนะนำให้เราแต่ละคนจึงไม่เหมือนกัน? และเนื้อหาคุณภาพต่ำที่สร้างจาก AI (AI Slop) ถูกดันขึ้นมาได้อย่างไร?\u0027\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนอ่านบทความข่าวเรื่องสงครามข้อมูลและอัลกอริทึม ร่วมกันวิเคราะห์ 3 ประเด็นหลัก: (1) การทำงานของอัลกอริทึมในการจัดลำดับเนื้อหา (Algorithmic Curation/Filter Bubbles) (2) ลักษณะของคอนเทนต์ขยะ AI (AI Slop) ที่เน้นยอดคลิก (Clickbait) แต่ขาดความถูกต้อง และ (3) ผลกระทบต่อความคิดเห็นและการตัดสินใจในสังคม\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนทดลองออกแบบ \u0027แผนผังผดุงจริยธรรมอัลกอริทึม\u0027 (Ethical Feed Design) และจัดทำอินโฟกราฟิกแนะนำวิธี \u0027ฝึกอัลกอริทึมให้ฉลาด\u0027 (Algorithmic Literacy \u0026 Curation) เช่น การตรวจสอบแหล่งข่าว การป้อนข้อมูลป้อนกลับเชิงบวกแก่เนื้อหาที่มีคุณภาพ และการรายงานเนื้อหาบิดเบือน\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันอภิปรายถกแถลงในมิติ PISA 2029 MAIL Literacy (Shape AI \u0026 Engage with AI) ถึงบทบาทของเยาวชนในการลดมลพิษดิจิทัลและการใช้โซเชียลมีเดียอย่างตระหนักรู้",
        "assessment":  "- ประเมินสมรรถนะการรู้เท่าทันอัลกอริทึม (Algorithmic Literacy Assessment): ประเมินความเข้าใจเรื่องโครงสร้างอัลกอริทึมและห้องสะท้อนเสียง (Echo Chambers) ผ่านใบงานวิเคราะห์กรณีศึกษา\n- ประเมินผลงานการออกแบบ (Creative \u0026 Solution-Based Assessment): ประเมินชิ้นงานอินโฟกราฟิก \u0027การฝึกอัลกอริทึมและคัดกรอง AI Slop\u0027 ด้วยแบบประเมินรูบริก (Rubric) ด้านการสื่อสารและความเป็นพลเมืองดิจิทัล\n- แบบวัดทักษะการตั้งคำถามเชิงวิพากษ์ (PISA 2029 MAIL Critical Questions Quiz): แบบทดสอบประเมินความสามารถในการจำแนกเจตนาของสื่อและการประเมินความน่าเชื่อถือของเนื้อหาที่แนะนำโดย AI",
        "materials":  "- บทความข่าวจาก Thai PBS Verify เรื่อง \u0027เมื่อข่าวปลอมดูจริงกว่าความจริง เท่าทันสงครามข้อมูลและอัลกอริทึมในยุค AI\u0027 (https://www.thaipbs.or.th/verify/article/content/6225)\n- ตัวอย่างกรณีศึกษาภาพ/คลิป AI Slop และสื่อที่มีการจัดตั้งกระแส (Astroturfing) ในโซเชียลมีเดีย\n- ใบงานผังความคิด \u0027Algorithmic Awareness \u0026 Information Disorder Worksheet\u0027\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Engage with AI และ Shape AI\n- เครื่องมือประเมินออนไลน์ (Interactive Quiz / Padlet) สำหรับการนำเสนอชิ้นงานและการสะท้อนความคิดเห็น",
        "title":  "เมื่อข่าวปลอมดูจริงกว่าความจริง เท่าทันสงครามข้อมูลและอัลกอริทึมในยุค AI"
    },
    {
        "id":  "3",
        "reference":  "https://www.thairath.co.th/lifestyle/tech/2932022",
        "assessmentTool":  "https://docs.google.com/document/d/1kbndkQvdx24ELjjojeU8NYFGzkIMeofivRj5YzE_Xzw/edit?usp=sharing",
        "activities":  "กิจกรรม \u0027Generative AI Art \u0026 Intellectual Property: สร้างสรรค์อย่างฉลาด ไม่ละเมิดลิขสิทธิ์\u0027 (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูนำภาพผลงานศิลปะที่สร้างจาก Generative AI (เช่น ภาพสไตล์สตูดิโอจิบลิ ภาพสไตล์ศิลปินชื่อดัง) มาให้นักเรียนดู แล้วชวนคิดว่า \u0027ใครคือเจ้าของลิขสิทธิ์ภาพนี้? AI, ผู้ป้อนคำสั่ง (Prompter) หรือศิลปินต้นฉบับที่ AI ใช้เรียนรู้?\u0027\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มอ่านบทความข้อกฎหมายลิขสิทธิ์ไทยและการใช้ Generative AI สร้างภาพตามกระแส ร่วมกันวิเคราะห์ 3 ประเด็น: (1) สิทธิความเป็นเจ้าของผลงานจาก AI (Human Authorship) (2) การนำผลงานศิลปินไปเทรนโมเดล AI (Training Data Ethics) และ (3) ความเสี่ยงทางกฎหมายจริยธรรมเมื่อนำภาพ AI ไปใช้ในเชิงพาณิชย์หรืออ้างว่าเป็นผลงานตนเอง\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนทดลองเขียนคำสั่งสร้างภาพ (Prompt Design) โดยยึดหลัก \u0027การสร้างสรรค์ร่วมกับ AI อย่างมีจริยธรรม\u0027 (Ethical Human-AI Collaboration) พร้อมจัดทำ \u0027แนวปฏิบัติการอ้างอิงและให้เกียรติลิขสิทธิ์\u0027 (AI Attribution \u0026 Ethics Guideline)\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Create with AI \u0026 Shape AI) เกี่ยวกับบทบาทของมนุษย์ในฐานะผู้ควบคุมการสร้างสรรค์ (Human Agency) และการเคารพสิทธิทรัพย์สินทางปัญญาในยุคดิจิทัล",
        "assessment":  "- ประเมินสมรรถนะการวิเคราะห์จริยธรรมและลิขสิทธิ์ AI (AI Copyright \u0026 Ethics Rubric): ประเมินความเข้าใจเรื่องสิทธิทรัพย์สินทางปัญญาและการใช้งานที่ชอบธรรม (Fair Use) ผ่านแบบบันทึกการวิเคราะห์กรณีศึกษา\n- ประเมินการสร้างสรรค์และการอ้างอิง (Creative \u0026 Responsible AI Task): ประเมินการออกแบบชิ้นงานสื่อสร้างสรรค์ร่วมกับ AI พร้อมการแสดงข้อความอ้างอิงสิทธิ (Attribution Statement) และคำอธิบายเจตนาการสร้างสรรค์\n- แบบวัดความตระหนักรู้กฎหมายดิจิทัล (Digital Rights \u0026 Generative AI Literacy Quiz): แบบทดสอบปรนัยและสถานการณ์จำลองประเมินการตัดสินใจเชิงจริยธรรมเมื่อใช้เครื่องมือ Generative AI ในชีวิตประจำวันและการเรียน",
        "materials":  "- บทความข่าวเรื่อง \u0027สรุปชัด! ใช้ AI สร้างรูปตามกระแสโซเชียล เสี่ยงละเมิดลิขสิทธิ์หรือไม่?\u0027 จาก ไทยรัฐออนไลน์ (https://www.thairath.co.th/lifestyle/tech/2932022)\n- ตัวอย่างเปรียบเทียบภาพผลงานศิลปินจริงและภาพผลงานสร้างจาก Generative AI Prompt\n- ใบงานวิเคราะห์กรณีศึกษา \u0027AI Art vs. Copyright \u0026 Ethics Case Study\u0027\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Create with AI (Human Agency \u0026 Intellectual Property)\n- แพลตฟอร์มสร้างสรรค์ภาพ AI แบบเปิดกว้าง (เช่น Canva / Microsoft Designer) สำหรับการทดลองเขียนคำสั่งอย่างมีจริยธรรม",
        "title":  "สรุปชัด! ใช้ AI สร้างรูปตามกระแสโซเชียล เสี่ยงละเมิดลิขสิทธิ์หรือไม่? เช็กได้ที่นี่"
    },
    {
        "id":  "4",
        "reference":  "https://www.thaipbs.or.th/verify/news/content/12322",
        "assessmentTool":  "https://docs.google.com/document/d/1myeTHGBq6Tmhbq7pxzmsFUZjsO743w1Vq_B92uqIwNE/edit?usp=sharing",
        "activities":  "กิจกรรม \"AI Data Privacy \u0026 Children\u0027s Rights Guard: คุ้มครองข้อมูลเด็ก เท่าทันภัยไซเบอร์และ AI\" (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็น \"ป้อนคำถามหรือการบ้านให้ AI ช่วยทำ เสี่ยงทำข้อมูลส่วนตัวหลุดหรือไม่?\" และชวนนักเรียนอภิปรายประสบการณ์การใช้งานแอปพลิเคชัน AI แชทบอทและโซเชียลมีเดีย\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าว \"PDPC จับมือ UNICEF วางมาตรการป้องกันข้อมูลเด็กหลุด รับมือภัยไซเบอร์และ AI\" วิเคราะห์ประเภทข้อมูลส่วนบุคคล (PII) ที่ห้ามป้อนให้ AI (เช่น เลขบัตรประชาชน ภาพถ่าย/ชีวมิติ พฤติกรรมส่วนตัว ที่อยู่ และข้อมูลสุขภาพ) พร้อมจำแนกความเสี่ยงจากการถูก AI นำข้อมูลไปใช้ฝึกโมเดล (AI Data Training) หรือถูกแฮก\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนออกแบบ \"ผังความคุ้มครองข้อมูลเด็กยุค AI\" (Youth AI Privacy Guardian Checklist) และร่วมกันจำลองสถานการณ์การปรับปรุงเงื่อนไขความเป็นส่วนตัว (Privacy Settings) ก่อนใช้งานเครื่องมือ AI\n4. ขั้นสะท้อนคิด (Reflect): สรุปบทเรียนในมิติ PISA 2029 MAIL Literacy (Engage with AI \u0026 Shape AI) เกี่ยวกับสิทธิดิจิทัลของเด็ก (Children\u0027s Digital Rights) และการสร้างภูมิคุ้มกันในการใช้งาน AI อย่างปลอดภัยและรับผิดชอบ",
        "assessment":  "- ประเมินสมรรถนะการตระหนักรู้ด้านความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคล (AI Data Privacy Literacy): ตรวจสอบความถูกต้องของการจำแนกประเภทข้อมูล PII และข้อบกพร่องในเงื่อนไขการใช้งาน AI ผ่านแบบประเมินรูบริก (Rubric)\n- ประเมินผลงานชิ้นงานคู่มือ/เช็กลิสต์ความปลอดภัย (Youth AI Privacy Checklist Assessment): ประเมินการสร้างสรรค์คู่มือและแนวปฏิบัติการใช้งาน AI อย่างปลอดภัยด้วยแบบประเมินการสื่อสารและพลเมืองดิจิทัล\n- แบบวัดความรู้และวิจารณญาณดิจิทัล (PISA 2029 MAIL Data Privacy Quiz): แบบทดสอบประเมินสถานการณ์จำลองเกี่ยวกับการตัดสินใจเปิดเผยหรือปกป้องข้อมูลส่วนบุคคลเมื่อโต้ตอบกับ AI แชทบอท",
        "materials":  "- บทความข่าวจาก Thai PBS Verify เรื่อง \"PDPC จับมือ UNICEF วางมาตรการป้องกันข้อมูลเด็กหลุด รับมือภัยไซเบอร์และ AI\" (https://www.thaipbs.or.th/verify/news/content/12322)\n- สื่อตัวอย่างข้อกำหนดความเป็นส่วนตัว (Terms of Service / Privacy Policy) ของแอปพลิเคชัน AI ที่นิยมในกลุ่มวัยรุ่น\n- ใบงานวิเคราะห์ประเภทข้อมูล \"PII \u0026 AI Risk Mapping Worksheet\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Engage with AI และ Shape AI\n- เครื่องมือประเมินและสะท้อนคิดออนไลน์ (เช่น Canva / Padlet / Kahoot)",
        "title":  "PDPC จับมือ UNICEF วางมาตรการป้องกันข้อมูลเด็กหลุด รับมือภัยไซเบอร์และ AI"
    },
    {
        "id":  "5",
        "reference":  "https://www.thaipbs.or.th/verify/article/content/2106",
        "assessmentTool":  "https://docs.google.com/document/d/1glRzHCcv84ur6W-j9S62kIeb4_BiYhBr0_HodRgsaWA/edit?usp=sharing",
        "activities":  "กิจกรรม \"AI Voice Cloning \u0026 Audio Verification: รู้ทันเทคโนโลยีโคลนเสียง ปกป้องอัตลักษณ์ดิจิทัล\" (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดไฟล์เสียงจริงและไฟล์เสียงสังเคราะห์จาก AI Voice Cloning ที่เลียนเสียงบุคคลคุ้นเคย แล้วให้นักเรียนร่วมกันฟังและวิเคราะห์ว่า \"เสียงไหนคือเสียงจริง เสียงไหนคือ AI? และคิดว่า AI ใช้เวลาสกัดไฟล์เสียงกี่วินาทีเพื่อเลียนแบบเสียงเรา?\"\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าว \"เพียง 30 วินาที ก็ถูกขโมยเสียงได้ รู้ทันภัยใหม่จาก Voice Cloning\" วิเคราะห์เทคโนโลยีคลื่นเสียงอัตโนมัติ (Audio Deepfake) ความเสี่ยงของการโพสต์คลิปเสียง/วิดีโอส่วนตัวบนโซเชียลมีเดีย และรูปแบบกลโกงมิจฉาชีพ (เช่น การปลอมเป็นญาติหลอกโอนเงิน/เรียกค่าไถ่)\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนร่วมกันออกแบบ \"โปรโตคอลความปลอดภัยประจำครอบครัว\" (Family Code Word Protocol) และแนวปฏิบัติการตรวจสอบยืนยันเสียงดิจิทัล (Audio Verification Checklist) เช่น การโทรกลับเบอร์ส่วนตัว การถามคำถามลับเฉพาะ และการชะลอการโอนเงิน\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI \u0026 Engage with AI) ถึงการใช้อัตลักษณ์เสียงอย่างมีความรับผิดชอบ การป้องกันรอยเท้าทางเสียง (Biometric Data Privacy) และการสร้างภูมิคุ้มกันทางเทคโนโลยี",
        "assessment":  "- ประเมินสมรรถนะการวิเคราะห์สื่อสังเคราะห์เสียง (Audio Deepfake Literacy Assessment): ประเมินความถูกต้องในการแยกแยะข้อบกพร่องทางเทคนิคของ AI Voice Clone และการจำแนกเจตนาของมิจฉาชีพผ่านแบบบันทึกกิจกรรม\n- ประเมินชิ้นงานการออกแบบโปรโตคอลความปลอดภัย (Family Audio Security Protocol Assessment): ประเมินคู่มือและโค้ดลับยืนยันตัวตนในครอบครัวด้วยแบบประเมินรูบริก (Rubric) ด้านการแก้ปัญหาทางเทคโนโลยีและการทำงานร่วมกัน\n- แบบวัดทักษะการตัดสินใจในภาวะวิกฤตดิจิทัล (PISA 2029 MAIL Audio Verification Quiz): แบบทดสอบประเมินสถานการณ์จำลองเมื่อได้รับสายโทรศัพท์ปลอมเสียงจาก AI",
        "materials":  "- บทความข่าวจาก Thai PBS Verify เรื่อง \"เพียง 30 วินาที ก็ถูกขโมยเสียงได้ รู้ทันภัยใหม่จาก Voice Cloning\" (https://www.thaipbs.or.th/verify/article/content/2106)\n- สื่อตัวอย่างไฟล์เสียงเปรียบเทียบ (Real Voice vs. AI Voice Clone Samples)\n- ใบงานวิเคราะห์ภัยไซเบอร์ \"Audio Biometric Privacy \u0026 Verification Worksheet\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Manage AI และ Engage with AI\n- แพลตฟอร์ม interactive (เช่น Canva / Padlet / Kahoot) สำหรับการสรุปและประเมินผล",
        "title":  "เพียง 30 วินาที ก็ถูกขโมยเสียงได้ รู้ทันภัยใหม่จาก Voice Cloning"
    },
    {
        "id":  "6",
        "reference":  "https://news.ch7.com/detail/888022",
        "assessmentTool":  "https://docs.google.com/document/d/1RhNp1Jcf2UZCU3Jl45nphZfLUgHxIYwbDPaeSh2ku6o/edit?usp=sharing",
        "activities":  "กิจกรรม \"AI Homework Helper vs. Critical Mind: ใช้ AI ช่วยเรียนอย่างมีจริยธรรม ไม่ทำลายทักษะการคิด\" (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดผลสำรวจ \"เด็กไทยกว่า 94% เคยใช้ AI ช่วยทำการบ้าน\" แล้วให้นักเรียนร่วมกันสะท้อนพฤติกรรมตนเองว่า \"การใช้ AI ช่วยทำการบ้าน คือ \u0027เครื่องมือช่วยเรียน\u0027 หรือ \u0027ทางลัดหลีกเลี่ยงการคิด\u0027?\"\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวเรื่องผลกระทบของการใช้ AI ทำการบ้านต่อทักษะการคิดวิเคราะห์ (Metacognitive Laziness) ร่วมกันวิเคราะห์ 3 ประเด็น: (1) ความแตกต่างระหว่างการป้อนคำสั่งให้ AI คิดแทน 100% กับการใช้ AI เป็นโค้ชการเรียนรู้ (2) ข้อผิดพลาดของข้อมูลจาก AI (AI Hallucination) และ (3) ผลกระทบระยะยาวต่อสมรรถนะการแก้ปัญหา\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนทดลองออกแบบ \"คู่มือการใช้ AI ช่วยเรียนอย่างมีจริยธรรม\" (Ethical AI Homework Companion Guide) และฝึกทักษะการตรวจสอบความถูกต้องของคำตอบจาก AI ด้วยการค้นคว้าอ้างอิงจากแหล่งข้อมูลจริง (Fact-Checking Protocol)\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI \u0026 Create with AI) ถึงการรักษาอำนาจการตัดสินใจของมนุษย์ (Human Agency) และการสร้างวัฒนธรรมความซื่อสัตย์ทางวิชาการ (Academic Integrity)",
        "assessment":  "- ประเมินสมรรถนะการวิเคราะห์ความน่าเชื่อถือของผลลัพธ์จาก AI (AI Output Verification Assessment): ประเมินความสามารถในการจับผิดข้อมูลบิดเบือนหรือข้อผิดพลาด (Hallucination) จากคำตอบของ AI ผ่านใบงาน Fact-Checking\n- ประเมินชิ้นงานคู่มือการใช้งาน AI อย่างมีจริยธรรม (Ethical AI Usage Guide Assessment): ประเมินการจัดทำแนวทางการใช้ AI ช่วยเรียนด้วยแบบประเมินรูบริก (Rubric) ด้านความซื่อสัตย์ทางวิชาการและการคิดเชิงวิพากษ์\n- แบบวัดทักษะการกำกับตนเองในการเรียนรู้ยุค AI (PISA 2029 MAIL Academic Integrity \u0026 Self-Regulation Quiz): แบบทดสอบประเมินสถานการณ์จำลองเมื่อต้องใช้เครื่องมือ Generative AI ในการทำรายงานและการบ้าน",
        "materials":  "- บทความข่าวจาก Ch7 News เรื่อง \"เด็กไทยใช้ AI ช่วยทำการบ้าน ขาดการคิดวิเคราะห์\" (https://news.ch7.com/detail/888022)\n- ตัวอย่างเปรียบเทียบคำตอบการบ้านที่สร้างจาก AI vs. ผลงานการคิดวิเคราะห์ด้วยตนเองของนักเรียน\n- ใบงานวิเคราะห์ข้อมูลและจับผิด AI \"AI Answer Verification \u0026 Fact-Checking Sheet\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Manage AI และ Create with AI\n- แพลตฟอร์มสะท้อนคิดและประเมินผลออนไลน์ (เช่น Padlet / Google Forms / Kahoot)",
        "title":  "เด็กไทยใช้ AI ช่วยทำการบ้าน ขาดการคิดวิเคราะห์ - ผลสำรวจเตือนภัยทักษะการเรียนรู้ถดถอย"
    },
    {
        "id":  "7",
        "reference":  "https://www.pptvhd36.com/news/%E0%B8%AA%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%A1/250101",
        "assessmentTool":  "https://docs.google.com/document/d/1ACR9BPCR9EzdttcWXMkdB1cSx9ze9qcp0yVonKyTFcs/edit?usp=sharing",
        "activities":  "กิจกรรม \"Non-Consensual AI Media \u0026 Digital Citizenship: ยุติการใช้ AI คุกคามและสร้างภูมิคุ้มกันไซเบอร์บูลลี่\" (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูนำเสนอข่าวการตัดต่อภาพตัดต่อด้วย AI (Non-Consensual Deepfake) ในกลุ่มนักเรียน แล้วชวนอภิปรายว่า \"การใช้ AI ดัดแปลงภาพคนอื่นโดยไม่ได้รับอนุญาตถือเป็นเรื่องตลกหรือเป็นอาชญากรรมทางไซเบอร์?\"\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวกรณีการใช้ AI ตัดต่อภาพอนาจารเพื่อนร่วมชั้น ร่วมกันวิเคราะห์ 3 ประเด็นหลัก: (1) การละเมิดสิทธิในรูปภาพและร่างกาย (Consent \u0026 Image Rights) (2) กฎหมายว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์และอาชญากรรมไซเบอร์ และ (3) ผลกระทบทางจิตใจและสังคมต่อผู้ตกเป็นเหยื่อ\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนร่วมกันสร้าง \"ข้อตกลงร่วมการใช้สื่อ AI อย่างเคารพสิทธิ\" (School AI Ethical Agreement) และวางแนวทางการรับมือเมื่อตนเองหรือเพื่อนถูกคุกคามด้วยสื่อ AI (Report \u0026 Support Protocol) เช่น การแคปหน้าจอหลักฐาน การแจ้งครู/ผู้ปกครอง และการร้องเรียนศูนย์ต่อต้านอาชญากรรมออนไลน์\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Shape AI \u0026 Engage with AI) เกี่ยวกับการเป็นพลเมืองดิจิทัลที่มีความรับผิดชอบ (Responsible Digital Citizen) และการร่วมสร้างสังคมออนไลน์ที่ปลอดภัย",
        "assessment":  "- ประเมินสมรรถนะการตระหนักรู้กฎหมายและสิทธิดิจิทัล (Digital Rights \u0026 AI Law Literacy Assessment): ประเมินความเข้าใจเรื่องสิทธิในภาพถ่าย ข้อกฎหมายไซเบอร์ และจริยธรรมการใช้งาน AI ผ่านการวิเคราะห์กรณีศึกษา\n- ประเมินชิ้นงานข้อตกลงและแนวทางการรับมือภัยไซเบอร์ (Anti-Deepfake Harassment Protocol Assessment): ประเมินการออกแบบคู่มือ/ข้อตกลงการป้องกันการคุกคามทางไซเบอร์ด้วยแบบประเมินรูบริก (Rubric) ด้านจริยธรรมและการแก้ปัญหา\n- แบบวัดทักษะการเป็นพลเมืองดิจิทัลและการตัดสินใจเชิงจริยธรรม (PISA 2029 MAIL Digital Citizenship Quiz): แบบทดสอบประเมินสถานการณ์จำลองเกี่ยวกับการรับมือและการหยุดส่งต่อสื่อ AI ที่ละเมิดสิทธิผู้อื่น",
        "materials":  "- บทความข่าวจาก PPTV HD36 เรื่อง \"แจ้ง ตร.ไซเบอร์เอาผิดเพื่อนนักเรียนใช้ AI ตัดต่อภาพอนาจาร\" (https://www.pptvhd36.com/news/สังคม/250101)\n- ตัวอย่างสื่ออินโฟกราฟิกกฎหมาย พ.ร.บ.คอมพิวเตอร์ และการรับมือภัย Cyberbullying\n- ใบงานวิเคราะห์กรณีศึกษา \"AI Image Generation \u0026 Consent Case Study\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Shape AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิดและจัดทำข้อตกลงออนไลน์ (เช่น Padlet / Canva / Mentimeter)",
        "title":  "แจ้ง ตร.ไซเบอร์เอาผิดกรณีเพื่อนนักเรียนใช้ AI ตัดต่อภาพอนาจารและเผยแพร่ลงโซเชียล"
    },
    {
        "id":  "8",
        "reference":  "https://www.thaipbs.or.th/now/content/3327",
        "assessmentTool":  "https://docs.google.com/document/d/11DVRXMFv1cspxtd1aDKnmGv0QQf0IxJyBEA1vs0UReQ/edit?usp=sharing",
        "activities":  "กิจกรรม \"AI Companion \u0026 Digital Emotional Well-being: เมื่อ AI กลายเป็นเพื่อนคุย รู้เท่าทันการพึ่งพาทางอารมณ์อย่างปลอดภัย\" (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็น \"เมื่อเหงา ท้อแท้ หรือมีปัญหาใจ เคยลองระบายกับ AI Chatbot หรือไม่? และ AI ให้คำตอบที่เข้าใจเราจริงหรือแค่ประมวลผลตามอัลกอริทึม?\"\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าว \"ปรึกษาปัญหาใจกับ AI Chatbot อาจไม่ปลอดภัยอย่างที่คิด\" ร่วมกันวิเคราะห์ 3 ประเด็น: (1) กลไกของ Generative AI Chatbot ในการเลียนแบบความรู้สึกและสร้างความผูกพันทางอารมณ์ (Parasocial Interaction) (2) ความเสี่ยงของการได้รับคำแนะนำที่ผิดพลาดทางสุขภาพจิต (Lack of Clinical Judgement) และ (3) ข้อจำกัดเรื่องการคุ้มครองข้อมูลความลับส่วนบุคคล (Privacy Risks)\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนทดลองออกแบบ \"คู่มือการใช้ AI Chatbot อย่างมีขอบเขตและปลอดภัย\" (Boundaries \u0026 Ethical Guidelines for AI Chatbots) พร้อมสร้างผังจำลองการขอความช่วยเหลือเมื่อเผชิญวิกฤตทางอารมณ์ (Human Connection \u0026 Mental Health Support Network)\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI \u0026 Engage with AI) ถึงการรักษาสมดุลระหว่างการใช้เทคโนโลยีกับการสร้างสัมพันธภาพที่แท้จริงในโลกจริง (Human-to-Human Connection)",
        "assessment":  "- ประเมินสมรรถนะการตระหนักรู้ข้อจำกัดและขอบเขตของ AI Chatbot (AI Emotional Companion Boundaries Assessment): ประเมินความเข้าใจเรื่องข้อจำกัดด้านความรู้สึก การประมวลผลเชิงอัลกอริทึม และความเสี่ยงทางสุขภาพจิตผ่านแบบบันทึกกิจกรรม\n- ประเมินชิ้นงานคู่มือการใช้งาน AI อย่างมีขอบเขต (Ethical AI Chatbot Guidelines Assessment): ประเมินการออกแบบคู่มือและผังเครือข่ายความช่วยเหลือด้วยแบบประเมินรูบริก (Rubric) ด้านสุขภาวะดิจิทัลและการแก้ปัญหา\n- แบบวัดทักษะการตัดสินใจและการดูแลสุขภาวะจิตใจยุคดิจิทัล (PISA 2029 MAIL Emotional Well-being \u0026 AI Quiz): แบบทดสอบประเมินสถานการณ์จำลองเกี่ยวกับการรับมือเมื่อเผชิญสภาวะอารมณ์และการโต้ตอบกับ AI Chatbot",
        "materials":  "- บทความข่าวจาก Thai PBS NOW เรื่อง \"ปรึกษาปัญหาใจกับ AI Chatbot อาจไม่ปลอดภัยอย่างที่คิด\" (https://www.thaipbs.or.th/now/content/3327)\n- ตัวอย่างบทสนทนาเปรียบเทียบระหว่าง AI Chatbot กับผู้เชี่ยวชาญด้านสุขภาพจิต/สายด่วนปรึกษาปัญหา\n- ใบงานวิเคราะห์ความเสี่ยงและขอบเขต \"AI Chatbot Boundaries \u0026 Mental Health Worksheet\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Manage AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิดและจัดทำชิ้นงานออนไลน์ (เช่น Padlet / Canva / Kahoot)",
        "title":  "ปรึกษาปัญหาใจกับ AI Chatbot อาจไม่ปลอดภัยอย่างที่คิด - รู้เท่าทันการพึ่งพาทางอารมณ์และสุขภาวะจิตดิจิทัล"
    },
    {
        "id":  "9",
        "reference":  "https://www.thaipbs.or.th/verify/article/content/14657",
        "assessmentTool":  "https://docs.google.com/document/d/1PWUkdosef3J618WiYA7uzctasGwmW1S24n_0Rz-zfz0/edit?usp=sharing",
        "activities":  "กิจกรรม \"Ultra Smooth AI Scams \u0026 Digital Financial Literacy: ส่องความเนียนสแกมเมอร์ยุค AI และการสร้างภูมิคุ้มกันทางการเงินดิจิทัล\" (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดตัวอย่างคลิปวิดีโอ/โฆษณาชวนลงทุนสแกมยุค AI ที่ใช้รูป เสียง และบทสนทนาเนียนระดับ \"Ultra Smooth\" แล้วให้นักเรียนร่วมกันตั้งข้อสังเกตว่า \"มิจฉาชีพยุคใหม่ใช้ AI ทำอย่างไรถึงหลอกคนให้เชื่อได้อย่างแนบเนียน?\"\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าว \"ส่องความเนียนระดับ Ultra Smooth ของมิจฉาชีพยุค AI\" ร่วมกันวิเคราะห์ 3 เทคนิคกลโกง: (1) การใช้ Deepfake ปลอมตัวเป็นคนดัง/เจ้าหน้าที่ (2) การยิงโฆษณาลิงก์ปลอมและเว็บทิพย์ (Fake Websites \u0026 Phishing Links) และ (3) การใช้ AI บทสนทนาปั่นหัวเร่งรัดให้โอนเงิน (High-Pressure Tactics)\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนร่วมกันออกแบบ \"คู่มือสแกนภัยสแกมเมอร์ AI\" (AI Scam Detection \u0026 Fact-Checking Guide) และจำลองสถานการณ์การตรวจสอบลิงก์/บัญชีปลอม (Phishing Link Verification Protocol) ก่อนคลิกหรือโอนเงิน\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI \u0026 Engage with AI) ถึงการไม่ด่วนตัดสินใจเพียงเพราะเห็นภาพหรือเสียงสมจริง (Do Not Trust at First Sight) และการสร้างภูมิคุ้มกันความปลอดภัยทางการเงินดิจิทัล",
        "assessment":  "- ประเมินสมรรถนะการตรวจสอบกลโกงสแกมเมอร์ AI (AI Scam Detection Assessment): ประเมินความสามารถในการสังเกตจุดผิดปกติของ Deepfake ภาพ/เสียง และการจำแนกเว็บปลอมPhishing ผ่านแบบบันทึกกิจกรรม\n- ประเมินชิ้นงานคู่มือสแกนภัยสแกมเมอร์ AI (Phishing \u0026 Deepfake Prevention Protocol Assessment): ประเมินการออกแบบคู่มือตรวจสอบความปลอดภัยทางการเงินดิจิทัลด้วยแบบประเมินรูบริก (Rubric) ด้านการคิดเชิงวิพากษ์และการแก้ปัญหา\n- แบบวัดทักษะการตัดสินใจในภาวะเสี่ยงภัยไซเบอร์ (PISA 2029 MAIL Digital Scam \u0026 Financial Security Quiz): แบบทดสอบประเมินสถานการณ์จำลองเมื่อพบโฆษณาชวนลงทุนหรือข้อความเร่งรัดโอนเงินจากมิจฉาชีพ AI",
        "materials":  "- บทความข่าวจาก Thai PBS Verify เรื่อง \"ส่องความเนียนระดับ Ultra Smooth ของมิจฉาชีพยุค AI หลอกอย่างไรให้เหยื่อหลงเชื่อโดยไม่รู้ตัว\" (https://www.thaipbs.or.th/verify/article/content/14657)\n- ตัวอย่างเปรียบเทียบเว็บไซต์จริง vs. เว็บไซต์ปลอม Phishing Link ของมิจฉาชีพ\n- ใบงานวิเคราะห์กลโกงและเช็กลิสต์ความปลอดภัย \"Ultra Smooth AI Scam Analysis Worksheet\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Manage AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิดและจัดทำชิ้นงานออนไลน์ (เช่น Padlet / Canva / Kahoot)",
        "title":  "ส่องความเนียนระดับ Ultra Smooth ของมิจฉาชีพยุค AI หลอกอย่างไรให้เหยื่อหลงเชื่อโดยไม่รู้ตัว"
    },
    {
        "id":  "10",
        "reference":  "https://www.thaipbs.or.th/news/content/506729",
        "assessmentTool":  "https://docs.google.com/document/d/136XbVmTbBNhJW7hqcucGsUinfMDWgymRl4Ox5i14bT0/edit?usp=sharing",
        "activities":  "กิจกรรม \u0027AI \u0026 Future Skills: ปรับตัวและเรียนรู้ร่วมกับ AI อย่างทรงพลัง\u0027 (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็นผลสำรวจสภาพัฒน์ฯ \"AI เสี่ยงเข้ามารองรับและแทนที่แรงงานไทย 2.2 ล้านคน\" แล้วให้นักเรียนร่วมกันอภิปรายว่า \"อาชีพใดบ้างที่ AI ทำแทนได้ และทักษะใดของมนุษย์ที่ AI ยังไม่สามารถแทนที่ได้?\"\n2. ขั้นสำรวจและวิเคราะห์ (Explore \u0026 Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวการเข้าถึงเทคโนโลยี AI ในตลาดแรงงาน ร่วมกันวิเคราะห์ 3 ประเด็นหลัก: (1) ความแตกต่างระหว่างการใช้ AI ทำแทน 100% กับการใช้ AI เป็นผู้ช่วยเพิ่มประสิทธิภาพ (Human-AI Collaboration) (2) ทักษะเฉพาะของมนุษย์ที่ AI ไม่มี (เช่น ความเห็นอกเห็นใจ จริยธรรม การคิดเชิงวิพากษ์ และการแก้ปัญหาซับซ้อน) และ (3) แนวทางการพัฒนาตนเอง (Upskill \u0026 Reskill) ของเยาวชนเพื่อรับมือกับโลกอนาคต\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create \u0026 Manage): นักเรียนทดลองสวมบทบาทเป็น \"ที่ปรึกษาการพัฒนาอาชีพยุค AI\" ออกแบบ \u0027ผังสมรรถนะมนุษย์ยุค AI\u0027 (Human Competency Map for AI Era) และจัดทำอินโฟกราฟิกแนะนำ \u0027ทักษะที่ต้อง Upskill เพื่อเรียนรู้ร่วมกับ AI อย่างเท่าทัน\u0027\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันอภิปรายสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI, Create with AI \u0026 Engage sequence with AI) ถึงการรักษาอำนาจการตัดสินใจของมนุษย์ (Human Agency) และการวางแผนการเรียนรู้ตลอดชีวิต (Lifelong Learning)",
        "assessment":  "- ประเมินสมรรถนะการวิเคราะห์ผลกระทบของ AI ต่อสังคมและแรงงาน (AI Labor \u0026 Social Impact Assessment): ประเมินความเข้าใจเรื่องข้อจำกัดของ AI และทักษะเฉพาะของมนุษย์ผ่านแบบบันทึกกิจกรรมและการวิเคราะห์กรณีศึกษา\n- ประเมินชิ้นงานการออกแบบผังสมรรถนะและการปรับตัว (Future Skill Mapping \u0026 Upskilling Plan Rubric): ประเมินการจัดทำแนวทางการ Upskill ตนเองและการใช้ AI เพิ่มประสิทธิภาพการเรียนรู้ด้วยแบบประเมินรูบริกด้านการคิดเชิงวิพากษ์และการปรับตัว\n- แบบวัดทักษะการเป็นพลเมืองดิจิทัลและการวางแผนการเรียนรู้ยุค AI (PISA 2029 MAIL Future Skills Quiz): แบบทดสอบประเมินสถานการณ์จำลองเกี่ยวกับการตัดสินใจเลือกใช้เครื่องมือ AI ในการทำงานและการศึกษาอย่างรับผิดชอบ",
        "materials":  "- บทความข่าวจาก Thai PBS เรื่อง \u0027\"AI\" เขย่าตลาดแรงงาน สภาพัฒน์ฯเตือนคนไทย 2.2 ล้านคน \"เสี่ยงตกงาน\"\u0027 (https://www.thaipbs.or.th/news/content/506729)\n- ตัวอย่างกรณีศึกษาการประยุกต์ใช้ AI ในอาชีพต่างๆ (เช่น การใช้ AI ช่วยวิเคราะห์ข้อมูล งานออกแบบ งานเขียน)\n- ใบงานวิเคราะห์ทักษะมนุษย์ vs AI \"Human-AI Competency Mapping Worksheet\"\n- สไลด์นำเสนอความรู้เรื่องกรอบ PISA 2029 MAIL Literacy โดเมน Manage AI, Create with AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิดและจัดทำชิ้นงานออนไลน์ (เช่น Canva / Padlet / Kahoot)",
        "title":  "\"AI\" เขย่าตลาดแรงงาน สภาพัฒน์ฯเตือนคนไทย 2.2 ล้านคน \"เสี่ยงตกงาน\" - รู้เท่าทันการปรับตัวและพัฒนาสมรรถนะยุค AI"
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
      id:             String(r[0] || i + 1).replace(/\.0$/, '').trim(),
      title:          (r[1] || '').trim(),
      reference:      (r[2] || '').trim(),
      activities:     (r[3] || '').trim(),
      assessment:     (r[4] || '').trim(),
      materials:      (r[5] || '').trim(),
      assessmentTool: (r[6] || '').trim(),
    }))
    .filter(it => it.title);
}

function gvizTableToItems(table) {
  const rows = table.rows ?? [];
  return rows
    .map((row, i) => {
      const rawId = row.c?.[0]?.f ?? row.c?.[0]?.v ?? (i + 1);
      const cleanId = String(rawId).replace(/\.0$/, '').trim();
      return {
        id:             cleanId || String(i + 1),
        title:          String(row.c?.[1]?.v ?? '').trim(),
        reference:      String(row.c?.[2]?.v ?? '').trim(),
        activities:     String(row.c?.[3]?.v ?? '').trim(),
        assessment:     String(row.c?.[4]?.v ?? '').trim(),
        materials:      String(row.c?.[5]?.v ?? '').trim(),
        assessmentTool: String(row.c?.[6]?.v ?? '').trim(),
      };
    })
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
      <div class="card-ref-group">
        ${item.reference
          ? `<a href="${esc(item.reference)}" target="_blank" rel="noopener noreferrer" class="card-ref" title="ดูบทความอ้างอิง">
               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                 <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                 <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
               </svg>อ้างอิงบทความ
             </a>`
          : ''}
        ${item.assessmentTool
          ? `<a href="${esc(item.assessmentTool)}" target="_blank" rel="noopener noreferrer" class="card-ref card-doc" title="ตัวอย่างเครื่องมือประเมิน (Google Docs)">
               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                 <polyline points="14 2 14 8 20 8"/>
                 <line x1="16" y1="13" x2="8" y2="13"/>
                 <line x1="16" y1="17" x2="8" y2="17"/>
                 <polyline points="10 9 9 9 8 9"/>
               </svg>เครื่องมือประเมิน
             </a>`
          : ''}
      </div>
    </div>
  </div>
  <div class="card-tabs" role="tablist">
    <button class="tab-btn active" role="tab" aria-selected="true"
      onclick="switchTab('${cid}','activities',this)">📋 กิจกรรม</button>
    <button class="tab-btn" role="tab" aria-selected="false"
      onclick="switchTab('${cid}','assessment',this)">📊 การประเมิน ${item.assessmentTool ? '📝' : ''}</button>
    <button class="tab-btn" role="tab" aria-selected="false"
      onclick="switchTab('${cid}','materials',this)">📚 สื่อการสอน</button>
  </div>
  <div class="tab-panels">
    <div class="tab-panel active" id="${cid}-activities" role="tabpanel">
      ${renderSteps(item.activities, q)}
    </div>
    <div class="tab-panel" id="${cid}-assessment" role="tabpanel">
      ${item.assessmentTool
        ? `<div class="assessment-tool-banner">
             <div class="tool-info">
               <span class="tool-icon">📝</span>
               <div>
                 <div class="tool-title">เครื่องมือประเมินผลการเรียนรู้</div>
                 <div class="tool-desc">ตัวอย่างเครื่องมือประเมินนักเรียน (Google Docs) ที่สอดคล้องกับกิจกรรม</div>
               </div>
             </div>
             <a href="${esc(item.assessmentTool)}" target="_blank" rel="noopener noreferrer" class="btn-open-tool">
               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                 <polyline points="14 2 14 8 20 8"/>
                 <line x1="16" y1="13" x2="8" y2="13"/>
                 <line x1="16" y1="17" x2="8" y2="17"/>
               </svg>
               เปิด Google Doc
             </a>
           </div>`
        : ''}
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
        it.title.toLowerCase().includes(lq)          ||
        it.activities.toLowerCase().includes(lq)     ||
        it.assessment.toLowerCase().includes(lq)     ||
        it.materials.toLowerCase().includes(lq)      ||
        it.reference.toLowerCase().includes(lq)      ||
        (it.assessmentTool && it.assessmentTool.toLowerCase().includes(lq))
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
  const ts = Date.now(); // timestamp กันแคชทุกรอบ

  // ── 1. fetch() JSON direct – เร็วสุด, real-time ──
  // Google Visualization JSON endpoint อนุญาต CORS สำหรับ Public Sheet
  try {
    const url = `${GVIZ_BASE}&tqx=out:json&_t=${ts}`;
    const r   = await fetchWithTimeout(url, 10000);
    if (r.ok) {
      const text = await r.text();
      // Google wraps response in: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
      const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
      if (m) {
        const data = JSON.parse(m[1]);
        if (data.status === 'ok' && data.table?.rows?.length) {
          if (data.sig) currentSig = data.sig;
          const items = gvizTableToItems(data.table);
          if (items.length) {
            console.log('[PISA] ✅ fetch() JSON direct', items.length, 'items | sig:', currentSig);
            return items;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[PISA] fetch JSON failed:', e.message);
  }

  // ── 2. JSONP via <script> tag – Zero CORS, works on file:// ──
  try {
    const data = await fetchViaJSONP(12000);
    if (data?.table?.rows?.length) {
      if (data.sig) currentSig = data.sig;
      const items = gvizTableToItems(data.table);
      if (items.length) {
        console.log('[PISA] ✅ JSONP', items.length, 'items | sig:', currentSig);
        return items;
      }
    }
  } catch (e) {
    console.warn('[PISA] JSONP failed:', e.message);
  }

  // ── 3. Vercel proxy fallback ──
  if (window.location.protocol !== 'file:') {
    try {
      const r = await fetchWithTimeout(`${API_PATH}?_t=${ts}`, 8000);
      if (r.ok) {
        const csv = await r.text();
        if (csv?.trim().length > 10) {
          const items = rowsToItems(parseCSV(csv));
          if (items.length) {
            console.log('[PISA] ✅ Vercel proxy', items.length, 'items');
            return items;
          }
        }
      }
    } catch (_) {}
  }

  // ── 4. Embedded fallback (รับประกันเสมอ 4 รายการ) ──
  console.info('[PISA] ℹ️ using embedded fallback data (', FALLBACK_DATA.length, 'items)');
  toast('แสดงข้อมูล Offline – กด Refresh เมื่อมีอินเทอร์เน็ต', 'ℹ️');
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

