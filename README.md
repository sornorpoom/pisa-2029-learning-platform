# PISA 2029 – กิจกรรมการเรียนรู้ MAIL Literacy

> **แพลตฟอร์ม Interactive** นำเสนอการออกแบบกิจกรรมการเรียนรู้เพื่อเตรียมพร้อมรับการประเมิน PISA 2029  
> ข้อมูล Real-time จาก Google Sheets · Deploy บน Vercel · รองรับทุกอุปกรณ์

---

## 📁 โครงสร้างไฟล์

```
PISA 2029/
├── index.html        ← หน้าหลัก (Vercel & standalone)
├── style.css         ← สไตล์ (3 ธีม · 3 ขนาด font · Responsive)
├── app.js            ← JavaScript หลัก (fetch, parse, render, search)
├── code.gs           ← Google Apps Script backend
├── api/
│   └── sheets.js     ← Vercel Serverless Function (proxy Google Sheets)
├── vercel.json       ← Vercel deployment config
└── README.md
```

---

## 🚀 Deploy บน Vercel (แนะนำ)

### วิธีที่ 1 – ผ่าน GitHub (อัตโนมัติ Real-time)

1. **Push ไฟล์ขึ้น GitHub**
   ```bash
   git init
   git add .
   git commit -m "initial: PISA 2029 web app"
   git remote add origin https://github.com/YOUR_USER/pisa-2029.git
   git push -u origin main
   ```

2. **เชื่อมต่อ Vercel**
   - ไปที่ [vercel.com](https://vercel.com) → **New Project**
   - Import จาก GitHub repository ที่สร้างไว้
   - **Framework Preset**: Other
   - คลิก **Deploy**

3. **ผลลัพธ์**: Vercel จะ Deploy อัตโนมัติทุกครั้งที่ Push ไป GitHub

### วิธีที่ 2 – Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

---

## 📊 การเชื่อมต่อ Google Sheets

### ✅ ข้อกำหนด

Google Sheet **ต้องเปิดเป็น Public** เพื่อให้ดึงข้อมูลได้:

1. เปิด [Google Sheets](https://docs.google.com/spreadsheets/d/1vo2anZD6TpFUecCXxQOsAd2AoopzSksWgS7MqWLvjI4)
2. คลิก **แชร์** (Share)
3. ตั้งค่า → **Anyone with the link** → **Viewer**
4. คลิก **Done**

### ✅ โครงสร้าง Sheet

Sheet Tab ชื่อ **`PISA 2029`** ต้องมีคอลัมน์ดังนี้:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Sequence number | Article title | References | Learning activities | Assessment of learning outcomes | Teaching materials |

### ✅ การอัปเดตข้อมูล

- แก้ไขข้อมูลใน Google Sheets
- กด **🔄 รีเฟรช** บนหน้าเว็บ หรือรอ 60 วินาที (Vercel cache)
- ข้อมูลจะอัปเดต Real-time

---

## 🎨 Features

| Feature | รายละเอียด |
|---------|-----------|
| **ธีม** | 3 ธีม: ☀️ สว่าง · 🌅 อบอุ่น · 🌙 มืด |
| **Font Size** | 3 ขนาด: เล็ก / กลาง / ใหญ่ |
| **ค้นหา** | Real-time search ใน title, กิจกรรม, การประเมิน, สื่อการสอน |
| **Refresh** | ดึงข้อมูลใหม่จาก Google Sheets ทันที |
| **Responsive** | Mobile / Tablet / Desktop |
| **Highlight** | ไฮไลต์คำที่ค้นหา |
| **Persistence** | จำธีมและขนาดตัวอักษรไว้ใน localStorage |
| **Accessibility** | ARIA labels, semantic HTML, role attributes |

---

## 🤝 Google Apps Script Version

หากต้องการ Deploy บน Google Apps Script:

1. ไปที่ [script.google.com](https://script.google.com)
2. สร้างโปรเจกต์ใหม่
3. วางเนื้อหา `code.gs` ในไฟล์ `Code.gs`
4. สร้างไฟล์ HTML ชื่อ `index` และวางเนื้อหา `index.html`  
   _(ใส่ CSS/JS แบบ inline หรือใช้ `<?!= include('style') ?>`_)
5. **Deploy** → **New deployment** → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (หรือ Anyone with Google account)
6. คลิก **Deploy** → คัดลอก URL

---

## 🔧 การแก้ไขปัญหา

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| โหลดข้อมูลไม่ได้ | Sheet ไม่เป็น Public | เปิด Share → Anyone with link → Viewer |
| ข้อมูลไม่อัปเดต | Cache 60 วินาที | รอ 60 วินาที หรือกด Refresh |
| `/api/sheets` error | ยังไม่ Deploy บน Vercel | Deploy ก่อน หรือใช้ Direct URL |
| ภาษาไทยไม่แสดง | Font ไม่โหลด | ตรวจสอบการเชื่อมต่อ fonts.googleapis.com |

---

## 📝 License

MIT License – ใช้และแก้ไขได้อย่างอิสระเพื่อการศึกษา

---

*สร้างขึ้นเพื่อสนับสนุนการพัฒนาการเรียนรู้ PISA 2029 ในประเทศไทย 🇹🇭*
