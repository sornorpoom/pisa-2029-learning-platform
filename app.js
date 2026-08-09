/* =====================================================
   PISA 2029 – app.js  v3 (Clean Rebuild)
   ─────────────────────────────────────────────────────
   Data pipeline (ลำดับความสำคัญ):
   1. fetch() JSON direct  → real-time, CORS allowed on public sheets
   2. JSONP gviz           → <script> tag, ZERO CORS (works on file://)
   3. Embedded FALLBACK    → always works offline
   ===================================================== */

'use strict';

// ─── Config ──────────────────────────────────────────
const SHEET_ID   = '1vo2anZD6TpFUecCXxQOsAd2AoopzSksWgS7MqWLvjI4';
const SHEET_TAB  = 'PISA 2029';
const API_PATH   = '/api/sheets';   // Vercel serverless proxy (legacy, optional)

// Google Visualization JSONP endpoint
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
const POLL_INTERVAL_MS = 30_000; // ตรวจทุก 30 วินาที

// ─── Embedded Fallback Data ───────────────────────────
// ใช้เมื่อ network ไม่ตอบสนองเลย (เช่น ไม่มีอินเทอร์เน็ต)
// ข้อมูลนี้ sync กับ Google Sheets ณ เวลาที่ deploy ล่าสุด
const FALLBACK_DATA = [
  {
    "id": "1",
    "title": "เตือนภัย Deepfake ปลอมเป็นผู้นำและผู้บริหาร หลอกโอนเงินผ่าน Zoom และสื่อสังเคราะห์",
    "reference": "https://www.thaipbs.or.th/verify/article/content/14211",
    "assessmentTool": "https://docs.google.com/document/d/1k_dNo7BSW6VDSSIL1BW9PSoVbPJ_WIaM1mz8bFvSJag/edit?usp=sharing",
    "activities": "กิจกรรม 'Spot the Fake: จับโป๊ะ AI Deepfake และสแกมเมอร์ไซเบอร์' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดคลิปวิดีโอ/ภาพเปรียบเทียบระหว่างบุคคลจริงกับภาพ Deepfake ที่สร้างโดย AI แล้วให้นักเรียนร่วมกันตั้งคำถามว่า 'ภาพ/เสียงนี้เป็นของจริงหรือไม่? รู้ได้อย่างไร?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวการใช้ AI Deepfake ปลอมแปลงหน้าและเสียง ร่วมกันวิเคราะห์ 3 ด้าน ได้แก่ (1) ข้อบกพร่องทางเทคนิคของ AI (2) เจตนาของผู้สร้าง (Intent) และ (3) ผลกระทบทางสังคมและจริยธรรม\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'คู่มือเช็กลิสต์การตรวจสอบ AI Deepfake' และร่วมกันสร้างสถานการณ์จำลอง (Role-play) การยืนยันตัวตน\n4. ขั้นสะท้อนคิด (Reflect): สรุปบทเรียนในมิติ PISA 2029 MAIL Literacy เกี่ยวกับความรับผิดชอบและการคิดวิจารณญาณ",
    "assessment": "- ประเมินสมรรถนะการวิเคราะห์สื่อสังเคราะห์ (Synthetic Media Analysis)\n- ประเมินการปฏิบัติในสถานการณ์จำลอง (Role-play Assessment)\n- แบบวัดการรู้เท่าทันสื่อและปัญญาประดิษฐ์ (MAIL Literacy Quiz)",
    "materials": "- บทความข่าวเตือนภัย Deepfake จาก Thai PBS Verify\n- ตัวอย่างสื่อสังเคราะห์ (Deepfake Video & Voice Clips)\n- ใบงานวิเคราะห์องค์ประกอบข่าวสารและเจตนาของสื่อ AI\n- สไลด์นำเสนอความรู้เรื่องกรอบแนวคิด PISA 2029 MAIL Literacy\n- แพลตฟอร์มดิจิทัล interactive (เช่น Kahoot / Padlet)"
  },
  {
    "id": "2",
    "title": "เมื่อข่าวปลอมดูจริงกว่าความจริง เท่าทันสงครามข้อมูลและอัลกอริทึมในยุค AI",
    "reference": "https://www.thaipbs.or.th/verify/article/content/6225",
    "assessmentTool": "https://docs.google.com/document/d/1r0Z46fwsBv_HWAihxDiDromiiAP7HvFrmBetSILULP4/edit?usp=sharing",
    "activities": "กิจกรรม 'Decoder of Algorithmic Echo Chamber & AI Slop: ถอดรหัสอัลกอริทึมและขยะดิจิทัล' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูให้นักเรียนเปรียบเทียบหน้าฟีดโซเชียลมีเดียของตนเอง แล้วร่วมกันอภิปรายว่า 'ทำไมเนื้อหาที่ระบบแนะนำให้เราแต่ละคนจึงไม่เหมือนกัน?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนอ่านบทความข่าวเรื่องสงครามข้อมูลและอัลกอริทึม วิเคราะห์การทำงานของ Filter Bubbles และ AI Slop\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'แผนผังผดุงจริยธรรมอัลกอริทึม' และอินโฟกราฟิกแนะนำวิธีฝึกอัลกอริทึมให้ฉลาด\n4. ขั้นสะท้อนคิด (Reflect): อภิปรายในมิติ PISA 2029 MAIL Literacy (Shape AI & Engage with AI) ถึงบทบาทของเยาวชนในการลดมลพิษดิจิทัล",
    "assessment": "- ประเมินสมรรถนะการรู้เท่าทันอัลกอริทึม (Algorithmic Literacy Assessment)\n- ประเมินผลงานการออกแบบ (Creative & Solution-Based Assessment)\n- แบบวัดทักษะการตั้งคำถามเชิงวิพากษ์ (PISA 2029 MAIL Critical Questions Quiz)",
    "materials": "- บทความข่าวจาก Thai PBS Verify เรื่อง 'เมื่อข่าวปลอมดูจริงกว่าความจริง'\n- ตัวอย่างกรณีศึกษาภาพ/คลิป AI Slop และสื่อที่มีการจัดตั้งกระแส\n- ใบงานผังความคิด 'Algorithmic Awareness & Information Disorder Worksheet'\n- สไลด์นำเสนอกรอบ PISA 2029 MAIL Literacy โดเมน Engage with AI และ Shape AI\n- เครื่องมือประเมินออนไลน์ (Interactive Quiz / Padlet)"
  },
  {
    "id": "3",
    "title": "สรุปชัด! ใช้ AI สร้างรูปตามกระแสโซเชียล เสี่ยงละเมิดลิขสิทธิ์หรือไม่? เช็กได้ที่นี่",
    "reference": "https://www.thairath.co.th/lifestyle/tech/2932022",
    "assessmentTool": "https://docs.google.com/document/d/1kbndkQvdx24ELjjojeU8NYFGzkIMeofivRj5YzE_Xzw/edit?usp=sharing",
    "activities": "กิจกรรม 'Generative AI Art & Intellectual Property: สร้างสรรค์อย่างฉลาด ไม่ละเมิดลิขสิทธิ์' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูนำภาพผลงานศิลปะที่สร้างจาก Generative AI มาให้นักเรียนดู แล้วชวนคิดว่า 'ใครคือเจ้าของลิขสิทธิ์ภาพนี้?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนอ่านบทความข้อกฎหมายลิขสิทธิ์ไทยและการใช้ Generative AI วิเคราะห์สิทธิความเป็นเจ้าของ Training Data Ethics และความเสี่ยงทางกฎหมาย\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนทดลองเขียนคำสั่งสร้างภาพ (Prompt Design) โดยยึดหลักจริยธรรม พร้อมจัดทำ 'แนวปฏิบัติการอ้างอิงและให้เกียรติลิขสิทธิ์'\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Create with AI & Shape AI)",
    "assessment": "- ประเมินสมรรถนะการวิเคราะห์จริยธรรมและลิขสิทธิ์ AI (AI Copyright & Ethics Rubric)\n- ประเมินการสร้างสรรค์และการอ้างอิง (Creative & Responsible AI Task)\n- แบบวัดความตระหนักรู้กฎหมายดิจิทัล (Digital Rights & Generative AI Literacy Quiz)",
    "materials": "- บทความข่าวเรื่อง 'สรุปชัด! ใช้ AI สร้างรูปตามกระแสโซเชียล' จาก ไทยรัฐออนไลน์\n- ตัวอย่างเปรียบเทียบภาพผลงานศิลปินจริงและภาพสร้างจาก Generative AI\n- ใบงานวิเคราะห์กรณีศึกษา 'AI Art vs. Copyright & Ethics Case Study'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Create with AI\n- แพลตฟอร์มสร้างสรรค์ภาพ AI (เช่น Canva / Microsoft Designer)"
  },
  {
    "id": "4",
    "title": "PDPC จับมือ UNICEF วางมาตรการป้องกันข้อมูลเด็กหลุด รับมือภัยไซเบอร์และ AI",
    "reference": "https://www.thaipbs.or.th/verify/news/content/12322",
    "assessmentTool": "https://docs.google.com/document/d/1myeTHGBq6Tmhbq7pxzmsFUZjsO743w1Vq_B92uqIwNE/edit?usp=sharing",
    "activities": "กิจกรรม 'AI Data Privacy & Children's Rights Guard: คุ้มครองข้อมูลเด็ก เท่าทันภัยไซเบอร์และ AI' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็น 'ป้อนคำถามหรือการบ้านให้ AI ช่วยทำ เสี่ยงทำข้อมูลส่วนตัวหลุดหรือไม่?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนศึกษาบทความข่าว PDPC จับมือ UNICEF วิเคราะห์ประเภทข้อมูล PII ที่ห้ามป้อนให้ AI และความเสี่ยงการนำไปใช้ฝึกโมเดล\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'ผังความคุ้มครองข้อมูลเด็กยุค AI' (Youth AI Privacy Guardian Checklist)\n4. ขั้นสะท้อนคิด (Reflect): สรุปบทเรียนในมิติ PISA 2029 MAIL Literacy (Engage with AI & Shape AI) เกี่ยวกับสิทธิดิจิทัลของเด็ก",
    "assessment": "- ประเมินสมรรถนะการตระหนักรู้ด้านความเป็นส่วนตัว (AI Data Privacy Literacy)\n- ประเมินผลงานชิ้นงานคู่มือ/เช็กลิสต์ความปลอดภัย (Youth AI Privacy Checklist Assessment)\n- แบบวัดความรู้และวิจารณญาณดิจิทัล (PISA 2029 MAIL Data Privacy Quiz)",
    "materials": "- บทความข่าวจาก Thai PBS Verify เรื่อง 'PDPC จับมือ UNICEF'\n- สื่อตัวอย่างข้อกำหนดความเป็นส่วนตัว (Privacy Policy) ของแอปพลิเคชัน AI\n- ใบงานวิเคราะห์ประเภทข้อมูล 'PII & AI Risk Mapping Worksheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Engage with AI และ Shape AI\n- เครื่องมือประเมินออนไลน์ (เช่น Canva / Padlet / Kahoot)"
  },
  {
    "id": "5",
    "title": "เพียง 30 วินาที ก็ถูกขโมยเสียงได้ รู้ทันภัยใหม่จาก Voice Cloning",
    "reference": "https://www.thaipbs.or.th/verify/article/content/2106",
    "assessmentTool": "https://docs.google.com/document/d/1glRzHCcv84ur6W-j9S62kIeb4_BiYhBr0_HodRgsaWA/edit?usp=sharing",
    "activities": "กิจกรรม 'AI Voice Cloning & Audio Verification: รู้ทันเทคโนโลยีโคลนเสียง ปกป้องอัตลักษณ์ดิจิทัล' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดไฟล์เสียงจริงและไฟล์เสียงสังเคราะห์จาก AI Voice Cloning แล้วให้นักเรียนวิเคราะห์ว่า 'เสียงไหนคือเสียงจริง?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนศึกษาบทความข่าว 'เพียง 30 วินาที ก็ถูกขโมยเสียงได้' วิเคราะห์เทคโนโลยี Audio Deepfake และรูปแบบกลโกงมิจฉาชีพ\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'โปรโตคอลความปลอดภัยประจำครอบครัว' (Family Code Word Protocol)\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI & Engage with AI) ถึงการปกป้อง Biometric Data Privacy",
    "assessment": "- ประเมินสมรรถนะการวิเคราะห์สื่อสังเคราะห์เสียง (Audio Deepfake Literacy Assessment)\n- ประเมินชิ้นงานการออกแบบโปรโตคอลความปลอดภัย (Family Audio Security Protocol)\n- แบบวัดทักษะการตัดสินใจในภาวะวิกฤตดิจิทัล (PISA 2029 MAIL Audio Verification Quiz)",
    "materials": "- บทความข่าวจาก Thai PBS Verify เรื่อง 'เพียง 30 วินาที ก็ถูกขโมยเสียงได้'\n- สื่อตัวอย่างไฟล์เสียงเปรียบเทียบ (Real Voice vs. AI Voice Clone Samples)\n- ใบงานวิเคราะห์ภัยไซเบอร์ 'Audio Biometric Privacy & Verification Worksheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Manage AI และ Engage with AI\n- แพลตฟอร์ม interactive (เช่น Canva / Padlet / Kahoot)"
  },
  {
    "id": "6",
    "title": "เด็กไทยใช้ AI ช่วยทำการบ้าน ขาดการคิดวิเคราะห์ - ผลสำรวจเตือนภัยทักษะการเรียนรู้ถดถอย",
    "reference": "https://news.ch7.com/detail/888022",
    "assessmentTool": "https://docs.google.com/document/d/1RhNp1Jcf2UZCU3Jl45nphZfLUgHxIYwbDPaeSh2ku6o/edit?usp=sharing",
    "activities": "กิจกรรม 'AI Homework Helper vs. Critical Mind: ใช้ AI ช่วยเรียนอย่างมีจริยธรรม ไม่ทำลายทักษะการคิด' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดผลสำรวจ 'เด็กไทยกว่า 94% เคยใช้ AI ช่วยทำการบ้าน' แล้วให้นักเรียนสะท้อนพฤติกรรมตนเอง\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนวิเคราะห์ผลกระทบของการใช้ AI ทำการบ้านต่อทักษะการคิดวิเคราะห์ (Metacognitive Laziness) และ AI Hallucination\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'คู่มือการใช้ AI ช่วยเรียนอย่างมีจริยธรรม' และฝึกทักษะ Fact-Checking\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI & Create with AI) ถึงการรักษา Human Agency",
    "assessment": "- ประเมินสมรรถนะการวิเคราะห์ความน่าเชื่อถือของผลลัพธ์จาก AI (AI Output Verification)\n- ประเมินชิ้นงานคู่มือการใช้งาน AI อย่างมีจริยธรรม (Ethical AI Usage Guide)\n- แบบวัดทักษะการกำกับตนเองในการเรียนรู้ยุค AI (Academic Integrity & Self-Regulation Quiz)",
    "materials": "- บทความข่าวจาก Ch7 News เรื่อง 'เด็กไทยใช้ AI ช่วยทำการบ้าน ขาดการคิดวิเคราะห์'\n- ตัวอย่างเปรียบเทียบคำตอบจาก AI vs. ผลงานการคิดวิเคราะห์ด้วยตนเอง\n- ใบงานวิเคราะห์ข้อมูลและจับผิด AI 'AI Answer Verification & Fact-Checking Sheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Manage AI และ Create with AI\n- แพลตฟอร์มสะท้อนคิดออนไลน์ (เช่น Padlet / Google Forms / Kahoot)"
  },
  {
    "id": "7",
    "title": "แจ้ง ตร.ไซเบอร์เอาผิดกรณีเพื่อนนักเรียนใช้ AI ตัดต่อภาพอนาจารและเผยแพร่ลงโซเชียล",
    "reference": "https://www.pptvhd36.com/news/%E0%B8%AA%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%A1/250101",
    "assessmentTool": "https://docs.google.com/document/d/1ACR9BPCR9EzdttcWXMkdB1cSx9ze9qcp0yVonKyTFcs/edit?usp=sharing",
    "activities": "กิจกรรม 'Non-Consensual AI Media & Digital Citizenship: ยุติการใช้ AI คุกคามและสร้างภูมิคุ้มกันไซเบอร์บูลลี่' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูนำเสนอข่าวการตัดต่อภาพด้วย AI (Non-Consensual Deepfake) แล้วชวนอภิปรายว่า 'การใช้ AI ดัดแปลงภาพคนอื่นโดยไม่ได้รับอนุญาตถือเป็นอาชญากรรมไซเบอร์หรือไม่?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนวิเคราะห์การละเมิดสิทธิในรูปภาพ (Consent & Image Rights) กฎหมายว่าด้วยอาชญากรรมไซเบอร์ และผลกระทบทางจิตใจต่อผู้ตกเป็นเหยื่อ\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนร่วมกันสร้าง 'ข้อตกลงร่วมการใช้สื่อ AI อย่างเคารพสิทธิ' และวางแนวทางรับมือเมื่อถูกคุกคาม\n4. ขั้นสะท้อนคิด (Reflect): สะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Shape AI & Engage with AI) เรื่องความเป็นพลเมืองดิจิทัลที่รับผิดชอบ",
    "assessment": "- ประเมินสมรรถนะการตระหนักรู้กฎหมายและสิทธิดิจิทัล (Digital Rights & AI Law Literacy)\n- ประเมินชิ้นงานข้อตกลงและแนวทางการรับมือภัยไซเบอร์ (Anti-Deepfake Harassment Protocol)\n- แบบวัดทักษะการเป็นพลเมืองดิจิทัล (PISA 2029 MAIL Digital Citizenship Quiz)",
    "materials": "- บทความข่าวจาก PPTV HD36 เรื่อง 'แจ้ง ตร.ไซเบอร์เอาผิดเพื่อนนักเรียนใช้ AI ตัดต่อภาพอนาจาร'\n- ตัวอย่างสื่ออินโฟกราฟิกกฎหมาย พ.ร.บ.คอมพิวเตอร์ และการรับมือ Cyberbullying\n- ใบงานวิเคราะห์กรณีศึกษา 'AI Image Generation & Consent Case Study'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Shape AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิด (เช่น Padlet / Canva / Mentimeter)"
  },
  {
    "id": "8",
    "title": "ปรึกษาปัญหาใจกับ AI Chatbot อาจไม่ปลอดภัยอย่างที่คิด - รู้เท่าทันการพึ่งพาทางอารมณ์กับ AI",
    "reference": "https://www.thaipbs.or.th/now/content/3327",
    "assessmentTool": "https://docs.google.com/document/d/11DVRXMFv1cspxtd1aDKnmGv0QQf0IxJyBEA1vs0UReQ/edit?usp=sharing",
    "activities": "กิจกรรม 'AI Companion & Digital Emotional Well-being: เมื่อ AI กลายเป็นเพื่อนคุย รู้เท่าทันการพึ่งพาทางอารมณ์อย่างปลอดภัย' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็น 'เมื่อเหงา ท้อแท้ หรือมีปัญหาใจ เคยลองระบายกับ AI Chatbot หรือไม่?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนวิเคราะห์กลไกของ AI Chatbot ในการเลียนแบบความรู้สึก (Parasocial Interaction) ความเสี่ยงด้านสุขภาพจิต และ Privacy Risks\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'คู่มือการใช้ AI Chatbot อย่างมีขอบเขตและปลอดภัย'\n4. ขั้นสะท้อนคิด (Reflect): ร่วมกันสะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Manage AI) ถึงการรักษา Human Agency ในการจัดการสุขภาวะทางอารมณ์",
    "assessment": "- ประเมินสมรรถนะการตระหนักรู้ขอบเขต AI กับสุขภาวะทางอารมณ์ (AI & Emotional Well-being Literacy)\n- ประเมินชิ้นงานคู่มือการใช้ AI Chatbot อย่างปลอดภัย (Safe AI Chatbot Usage Guide)\n- แบบวัดทักษะการกำกับตนเองทางอารมณ์ในยุค AI (PISA 2029 MAIL Emotional Self-Regulation Quiz)",
    "materials": "- บทความข่าวจาก Thai PBS เรื่อง 'ปรึกษาปัญหาใจกับ AI Chatbot อาจไม่ปลอดภัยอย่างที่คิด'\n- กรณีศึกษาการใช้ AI Companion และผลกระทบต่อสุขภาพจิตวัยรุ่น\n- ใบงานวิเคราะห์ 'AI Chatbot Boundary Setting & Emotional Well-being Worksheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Manage AI\n- แพลตฟอร์มออนไลน์ (เช่น Padlet / Canva / Kahoot)"
  },
  {
    "id": "9",
    "title": "ส่องความเนียนระดับ Ultra Smooth ของมิจฉาชีพไซเบอร์ยุค AI: รู้ทันก่อนตกเป็นเหยื่อ",
    "reference": "https://www.thaipbs.or.th/verify/article/content/14211",
    "assessmentTool": "https://docs.google.com/document/d/1PWUkdosef3J618WiYA7uzctasGwmW1S24n_0Rz-zfz0/edit?usp=sharing",
    "activities": "กิจกรรม 'AI Scam Detective: ส่องมิจฉาชีพไซเบอร์ยุค AI เท่าทันก่อนตกเป็นเหยื่อ' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดกรณีศึกษามิจฉาชีพที่ใช้ AI สร้าง Persona และบทสนทนาหลอกลวง แล้วให้นักเรียนวิเคราะห์ว่า 'คุณจะสังเกตอะไรได้บ้างเพื่อรู้ว่าคือมิจฉาชีพ?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนวิเคราะห์รูปแบบกลโกงมิจฉาชีพยุค AI เทคนิค Social Engineering และช่องโหว่ทางจิตวิทยาที่ถูกโจมตี\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'แผนที่รู้ทันมิจฉาชีพ AI' (AI Scam Awareness Map) พร้อมแนวทางการรายงานและขอความช่วยเหลือ\n4. ขั้นสะท้อนคิด (Reflect): สะท้อนคิดในมิติ PISA 2029 MAIL Literacy (Engage with AI & Shape AI) ถึงการสร้างภูมิคุ้มกันชุมชนดิจิทัล",
    "assessment": "- ประเมินสมรรถนะการจับสังเกตและวิเคราะห์ AI Scam (Cyber Scam Detection Assessment)\n- ประเมินชิ้นงาน 'AI Scam Awareness Map' ด้วยแบบประเมินรูบริก\n- แบบวัดทักษะการป้องกันภัยไซเบอร์ (PISA 2029 MAIL Cyber Safety Quiz)",
    "materials": "- กรณีศึกษามิจฉาชีพที่ใช้ AI หลอกลวง\n- ใบงานวิเคราะห์ 'AI Scam Patterns & Social Engineering Worksheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy\n- แพลตฟอร์ม interactive (เช่น Kahoot / Padlet)"
  },
  {
    "id": "10",
    "title": "\"AI\" เขย่าตลาดแรงงาน สภาพัฒน์ฯเตือนคนไทย 2.2 ล้านคน \"เสี่ยงตกงาน\" - รู้เท่าทันการปรับตัวและพัฒนาสมรรถนะยุค AI",
    "reference": "https://www.thaipbs.or.th/news/content/506729",
    "assessmentTool": "https://docs.google.com/document/d/136XbVmTbBNhJW7hqcucGsUinfMDWgymRl4Ox5i14bT0/edit?usp=sharing",
    "activities": "กิจกรรม 'AI & Future Skills: ปรับตัวและเรียนรู้ร่วมกับ AI อย่างทรงพลัง' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็นผลสำรวจสภาพัฒน์ฯ 'AI เสี่ยงเข้ามารองรับและแทนที่แรงงานไทย 2.2 ล้านคน' แล้วให้นักเรียนร่วมกันอภิปราย\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนวิเคราะห์ความแตกต่างระหว่าง AI ทำแทน 100% กับ Human-AI Collaboration และทักษะที่ AI ยังแทนที่ไม่ได้\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนออกแบบ 'ผังสมรรถนะมนุษย์ยุค AI' (Human Competency Map for AI Era)\n4. ขั้นสะท้อนคิด (Reflect): อภิปรายในมิติ PISA 2029 MAIL Literacy ถึงการรักษา Human Agency และการวางแผน Lifelong Learning",
    "assessment": "- ประเมินสมรรถนะการวิเคราะห์ผลกระทบของ AI ต่อสังคมและแรงงาน\n- ประเมินชิ้นงานการออกแบบผังสมรรถนะและการปรับตัว (Future Skill Mapping)\n- แบบวัดทักษะการเป็นพลเมืองดิจิทัลและการวางแผนการเรียนรู้ยุค AI",
    "materials": "- บทความข่าวจาก Thai PBS เรื่อง '\"AI\" เขย่าตลาดแรงงาน สภาพัฒน์ฯเตือนคนไทย 2.2 ล้านคน \"เสี่ยงตกงาน\"'\n- ตัวอย่างกรณีศึกษาการประยุกต์ใช้ AI ในอาชีพต่างๆ\n- ใบงานวิเคราะห์ทักษะมนุษย์ vs AI 'Human-AI Competency Mapping Worksheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Manage AI, Create with AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิดและจัดทำชิ้นงานออนไลน์ (เช่น Canva / Padlet / Kahoot)"
  },
  {
    "id": "11",
    "title": "\"AI\" เขย่าตลาดแรงงาน สภาพัฒน์ฯเตือนคนไทย 2.2 ล้านคน \"เสี่ยงตกงาน\" - รู้เท่าทันการปรับตัวและพัฒนาสมรรถนะยุค AI",
    "reference": "https://www.thaipbs.or.th/news/content/506729",
    "assessmentTool": "https://docs.google.com/document/d/136XbVmTbBNhJW7hqcucGsUinfMDWgymRl4Ox5i14bT0/edit?usp=sharing",
    "activities": "กิจกรรม 'AI & Future Skills: ปรับตัวและเรียนรู้ร่วมกับ AI อย่างทรงพลัง' (สำหรับนักเรียน ม.1-ม.3):\n1. ขั้นนำ (Engage): ครูเปิดประเด็นผลสำรวจสภาพัฒน์ฯ 'AI เสี่ยงเข้ามารองรับและแทนที่แรงงานไทย 2.2 ล้านคน' แล้วให้นักเรียนร่วมกันอภิปรายว่า 'อาชีพใดบ้างที่ AI ทำแทนได้?'\n2. ขั้นสำรวจและวิเคราะห์ (Explore & Analyze): นักเรียนแบ่งกลุ่มศึกษาบทความข่าวการเข้าถึงเทคโนโลยี AI ในตลาดแรงงาน วิเคราะห์ 3 ประเด็น: (1) ความแตกต่างระหว่างการใช้ AI ทำแทน 100% กับ Human-AI Collaboration (2) ทักษะเฉพาะของมนุษย์ที่ AI ไม่มี และ (3) แนวทาง Upskill & Reskill\n3. ขั้นสร้างสรรค์และแก้ปัญหา (Create & Manage): นักเรียนสวมบทบาทเป็น 'ที่ปรึกษาการพัฒนาอาชีพยุค AI' ออกแบบ 'ผังสมรรถนะมนุษย์ยุค AI' และอินโฟกราฟิก 'ทักษะที่ต้อง Upskill'\n4. ขั้นสะท้อนคิด (Reflect): อภิปรายในมิติ PISA 2029 MAIL Literacy (Manage AI, Create with AI & Engage with AI) ถึงการรักษา Human Agency และ Lifelong Learning",
    "assessment": "- ประเมินสมรรถนะการวิเคราะห์ผลกระทบของ AI ต่อสังคมและแรงงาน (AI Labor & Social Impact Assessment)\n- ประเมินชิ้นงานการออกแบบผังสมรรถนะและการปรับตัว (Future Skill Mapping & Upskilling Plan Rubric)\n- แบบวัดทักษะการเป็นพลเมืองดิจิทัลและการวางแผนการเรียนรู้ยุค AI (PISA 2029 MAIL Future Skills Quiz)",
    "materials": "- บทความข่าวจาก Thai PBS เรื่อง '\"AI\" เขย่าตลาดแรงงาน สภาพัฒน์ฯเตือนคนไทย 2.2 ล้านคน \"เสี่ยงตกงาน\"'\n- ตัวอย่างกรณีศึกษาการประยุกต์ใช้ AI ในอาชีพต่างๆ\n- ใบงานวิเคราะห์ทักษะมนุษย์ vs AI 'Human-AI Competency Mapping Worksheet'\n- สไลด์กรอบ PISA 2029 MAIL Literacy โดเมน Manage AI, Create with AI และ Engage with AI\n- แพลตฟอร์มสะท้อนคิดและจัดทำชิ้นงานออนไลน์ (เช่น Canva / Padlet / Kahoot)"
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
 * fetch() with manual timeout
 */
function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/**
 * JSONP loader – loads gviz via <script> tag → ZERO CORS restriction
 * ✅ IMPORTANT: Google Visualization API requires tqx=responseHandler:<name>
 *    NOT &callback=<name> (which does not work with gviz)
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

    // ✅ tqx=responseHandler:<cbName> is the correct JSONP parameter for Google Visualization API
    // _t= timestamp prevents all caching layers
    script.src = GVIZ_BASE + '&tq=&tqx=responseHandler:' + cbName + '&_t=' + Date.now();
    document.head.appendChild(script);
  });
}

// ─── Main Fetch Pipeline ─────────────────────────────
async function fetchItems() {
  const ts = Date.now();

  // ── 1. fetch() JSON direct – เร็วสุด, real-time ──
  try {
    const url = `${GVIZ_BASE}&tqx=out:json&_t=${ts}`;
    const r   = await fetchWithTimeout(url, 10000);
    if (r.ok) {
      const text = await r.text();
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

  // ── 3. Vercel proxy fallback (ถ้า deploy บน Vercel) ──
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

  // ── 4. Embedded fallback (รับประกันเสมอ) ──
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

    const header = document.querySelector('.site-header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

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
  loadData();
}

// ─── Change Detection Polling ─────────────────────────
function pollForChanges() {
  if (!currentSig) return;

  const cbName = '__pisaPoll_' + Date.now();
  const script = document.createElement('script');
  let done = false;

  const cleanup = () => {
    done = true;
    delete window[cbName];
    try { if (script.parentNode) document.head.removeChild(script); } catch(_) {}
  };

  const timer = setTimeout(() => { if (!done) cleanup(); }, 20000);

  window[cbName] = function(data) {
    clearTimeout(timer);
    cleanup();

    if (!data || !data.sig) return;

    if (data.sig !== currentSig) {
      console.info('[PISA] 🔔 Data changed! old sig:', currentSig, '→ new sig:', data.sig);
      showUpdateBanner();
      stopPolling();
    }
  };

  script.onerror = function() {
    clearTimeout(timer);
    cleanup();
  };

  // ✅ tqx=responseHandler: is the correct parameter for Google Visualization API JSONP
  script.src = GVIZ_BASE + '&tqlimit=0&tqx=responseHandler:' + cbName + '&_t=' + Date.now();
  document.head.appendChild(script);
}

function startPolling() {
  stopPolling();
  if (!currentSig) return;
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
  setTheme(localStorage.getItem('pisa-theme') || 'light');
  setFont(localStorage.getItem('pisa-font')   || 'medium');

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

  loadData();

  window.addEventListener('beforeunload', stopPolling);
});
