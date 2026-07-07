require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const app = express();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "reports",
    allowed_formats: ["jpg", "png", "jpeg"]
  }
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* 폴더 생성 */
if (!fs.existsSync("data")) fs.mkdirSync("data");

const DB_FILE = "./data/reports.json";

/* 초기 파일 */
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

/* 데이터 읽기 */
function getReports() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

/* 데이터 저장 */
function saveReports(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ⭐ 중요: 서버 주소 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/* 신고 등록 */
app.post("/report", upload.array("photos", 10), (req, res) => {
  try {
    const { building, location, content } = req.body;
    const files = req.files;

    const reports = getReports();

    /* ⭐ 수정된 부분 (핵심) */
    let imageUrls = [];

    if (files) {
      files.forEach(file => {
        imageUrls.push(file.path);
      });
    }

    const newReport = {
      id: Date.now(),
      building,
      location,
      content,
      imageUrls,
      status: "접수전",
      time: new Date().toISOString().slice(0, 16).replace("T", " ")
    };

    reports.push(newReport);
    saveReports(reports);

    res.json({ ok: true });

  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

/* 신고 목록 */
app.get("/reports", (req, res) => {
  const reports = getReports();
  res.json(reports.reverse());
});

/* 상태 변경 */
app.post("/status", (req, res) => {
  const { id, status } = req.body;

  const reports = getReports();

  const updated = reports.map(r =>
    r.id == id ? { ...r, status } : r
  );

  saveReports(updated);

  res.json({ ok: true });
});

/* 신고 삭제 */
app.delete("/report/:id", (req, res) => {
  const id = Number(req.params.id);

  const reports = getReports();

  const filtered = reports.filter(r => r.id !== id);

  saveReports(filtered);

  res.json({ ok: true });
});


/* 서버 실행 */
app.listen(3000, () => {
  console.log("서버 실행: http://localhost:3000");
});