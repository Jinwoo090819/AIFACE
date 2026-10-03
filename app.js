const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");
const faceAnalyzeButton = document.getElementById("faceAnalyzeButton");
const styleAnalyzeButton = document.getElementById("styleAnalyzeButton");
const nameInput = document.getElementById("nameInput");
const ageInput = document.getElementById("ageInput");
const genderInput = document.getElementById("genderInput");
const setupSection = document.getElementById("setupSection");
const loadingSection = document.getElementById("loadingSection");
const resultSection = document.getElementById("resultSection");
const restartButton = document.getElementById("restartButton");
const copyLinkButton = document.getElementById("copyLinkButton");
const shareButton = document.getElementById("shareButton");
const styleResultSection = document.getElementById("styleResultSection");
const styleRestartButton = document.getElementById("styleRestartButton");
const styleCopyLinkButton = document.getElementById("styleCopyLinkButton");
const styleShareButton = document.getElementById("styleShareButton");
const dropzone = document.getElementById("dropzone");
const canvas = document.getElementById("analysisCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
// const saveConsent = document.getElementById("saveConsent"); // Removed for auto-consent

const SUPABASE_URL = "https://gdxkntjlrpbzvibpzvpx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GJWYshkJ3jDRwL1gN65_ng_rYOr-suI";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const MAX_FILES = 5;
let files = [];
let objectUrls = [];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round(n) {
  return Math.round(n);
}

function updateAnalyzeState() {
  const hasName = nameInput.value.trim().length > 0;
  const hasAge = Number(ageInput.value) > 0;
  const hasGender = genderInput.value.length > 0;
  const hasConsent = true; // Always consent
  const ready = hasName && hasAge && hasGender && hasConsent && files.length > 0;
  faceAnalyzeButton.disabled = !ready;
  styleAnalyzeButton.disabled = !ready;
}

nameInput.addEventListener("input", updateAnalyzeState);
ageInput.addEventListener("input", updateAnalyzeState);
genderInput.addEventListener("change", updateAnalyzeState);
// saveConsent.addEventListener("change", updateAnalyzeState); // Removed since checkbox is gone

fileInput.addEventListener("change", (e) => {
  addFiles([...e.target.files]);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  addFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
});

function addFiles(newFiles) {
  const remaining = MAX_FILES - files.length;
  if (remaining <= 0) {
    alert("사진은 최대 5장까지 올릴 수 있습니다.");
    return;
  }
  files = [...files, ...newFiles.slice(0, remaining)];
  renderPreviews();

  if (newFiles.length > remaining) {
    alert("사진은 최대 5장까지 올릴 수 있어 일부 파일만 추가했습니다.");
  }
}

function cleanupUrls() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}

function renderPreviews() {
  cleanupUrls();
  previewGrid.innerHTML = "";

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);

    const card = document.createElement("div");
    card.className = "preview-card";
    card.innerHTML = `
      <img src="${url}" alt="업로드 사진 ${index + 1}">
      <button type="button" class="remove-photo" aria-label="사진 삭제">×</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      files.splice(index, 1);
      renderPreviews();
    });
    previewGrid.appendChild(card);
  });

  updateAnalyzeState();
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    img.src = url;
  });
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function analyzeImageData(data, width, height) {
  let lumSum = 0;
  let lumSqSum = 0;
  let satSum = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  let edgeSum = 0;
  let count = 0;
  let edgeCount = 0;

  // 전 영역: 사진 품질 분석
  const step = 4;
  const luminance = new Float32Array(width * height);

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      luminance[y * width + x] = lum;

      const hsv = rgbToHsv(r, g, b);
      lumSum += lum;
      lumSqSum += lum * lum;
      satSum += hsv.s;
      count++;

      if (x >= step) {
        const left = luminance[y * width + (x - step)];
        if (left > 0) {
          edgeSum += Math.abs(lum - left);
          edgeCount++;
        }
      }
      if (y >= step) {
        const up = luminance[(y - step) * width + x];
        if (up > 0) {
          edgeSum += Math.abs(lum - up);
          edgeCount++;
        }
      }
    }
  }

  const brightness = count ? lumSum / count : 0;
  const variance = count ? Math.max(0, lumSqSum / count - brightness * brightness) : 0;
  const contrast = Math.sqrt(variance);
  const saturation = count ? satSum / count : 0;
  const edge = edgeCount ? edgeSum / edgeCount : 0;

  // 중앙 영역 색상 샘플
  const x0 = Math.floor(width * 0.28);
  const x1 = Math.floor(width * 0.72);
  const y0 = Math.floor(height * 0.20);
  const y1 = Math.floor(height * 0.72);
  let centerCount = 0;

  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const hsv = rgbToHsv(r, g, b);

      // 너무 어둡거나 지나치게 밝은 픽셀, 배경색 가능성이 큰 극단값은 제외
      if (hsv.v < 0.16 || hsv.v > 0.97) continue;

      rSum += r;
      gSum += g;
      bSum += b;
      centerCount++;
    }
  }

  const avgR = centerCount ? rSum / centerCount : 127;
  const avgG = centerCount ? gSum / centerCount : 127;
  const avgB = centerCount ? bSum / centerCount : 127;
  const centerHsv = rgbToHsv(avgR, avgG, avgB);

  // 점수 계산
  const brightnessPenalty = Math.abs(brightness - 0.56) * 65;
  const contrastScore = clamp((contrast - 0.06) / 0.22, 0, 1) * 18;
  const edgeScore = clamp((edge - 0.018) / 0.11, 0, 1) * 18;
  const saturationBalance = 12 - Math.abs(saturation - 0.38) * 18;

  const score = clamp(
    72 - brightnessPenalty + contrastScore + edgeScore + saturationBalance,
    40,
    98
  );

  return {
    score: round(score),
    brightness,
    contrast,
    saturation,
    edge,
    avgR,
    avgG,
    avgB,
    centerHsv
  };
}

async function analyzeFile(file) {
  const img = await loadImageFromFile(file);

  const maxSide = 360;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const analysis = analyzeImageData(imageData.data, width, height);

  return {
    ...analysis,
    file,
    width: img.width,
    height: img.height,
    previewUrl: URL.createObjectURL(file)
  };
}

function getFullBodyStyleScores(results) {
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const avgContrast = results.reduce((sum, r) => sum + r.contrast, 0) / results.length;
  const avgEdge = results.reduce((sum, r) => sum + r.edge, 0) / results.length;
  const avgBrightness = results.reduce((sum, r) => sum + r.brightness, 0) / results.length;

  const pose = Math.round(clamp(avgScore * 0.78 + avgEdge * 120, 45, 98));
  const outfit = Math.round(clamp(avgScore * 0.72 + avgContrast * 90, 45, 98));
  const balance = Math.round(clamp(avgScore * 0.74 + (1 - Math.abs(avgBrightness - 0.56)) * 20, 45, 98));
  const total = Math.round((pose + outfit + balance) / 3);

  return { total, pose, outfit, balance };
}

function percentileFromScore(score) {
  if (score >= 95) return 1;
  if (score >= 90) return 5;
  if (score >= 85) return 10;
  if (score >= 80) return 20;
  if (score >= 75) return 30;
  if (score >= 70) return 40;
  if (score >= 60) return 50;
  if (score >= 50) return 70;
  return 90;
}

function getPersonalColor(results) {
  const avgR = results.reduce((s, x) => s + x.avgR, 0) / results.length;
  const avgG = results.reduce((s, x) => s + x.avgG, 0) / results.length;
  const avgB = results.reduce((s, x) => s + x.avgB, 0) / results.length;
  const hsv = rgbToHsv(avgR, avgG, avgB);

  const warmth = (avgR - avgB) + (avgG - avgB) * 0.25;
  const isWarm = warmth > 11;
  const isLight = hsv.v > 0.60;
  const isClear = hsv.s > 0.23;

  if (isWarm && (isLight || isClear)) {
    return { type: "봄 웜", colors: ["#FFD6A5", "#FFADAD", "#FDFFB6", "#CAFFBF"] };
  }
  if (isWarm) {
    return { type: "가을 웜", colors: ["#C97B63", "#D4A373", "#A98467", "#6B705C"] };
  }
  if (isLight) {
    return { type: "여름 쿨", colors: ["#CDB4DB", "#A2D2FF", "#BDE0FE", "#FFC8DD"] };
  }
  return { type: "겨울 쿨", colors: ["#3A0CA3", "#4361EE", "#7209B7", "#F72585"] };
}


function getFileExtension(file) {
  const byName = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (byName) return byName;
  const byMime = (file.type.split("/")[1] || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return byMime || "jpg";
}

async function saveToDatabase(results, saveStyleScore = false) {
  const submissionId = crypto.randomUUID();
  const name = nameInput.value.trim();
  const age = Number(ageInput.value);
  const gender = genderInput.value;

  const { error: submissionError } = await db
    .from("submissions")
    .insert({
      id: submissionId,
      name,
      age,
      gender
    });

  if (submissionError) {
    throw new Error("기본 정보 저장 실패: " + submissionError.message);
  }

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const ext = getFileExtension(item.file);
    const storagePath = `${submissionId}/${String(i + 1).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await db.storage
      .from("faces")
      .upload(storagePath, item.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: item.file.type || undefined
      });

    if (uploadError) {
      throw new Error("사진 저장 실패: " + uploadError.message);
    }

    const { error: photoError } = await db
      .from("photos")
      .insert({
        submission_id: submissionId,
        storage_path: storagePath,
        score: item.score
      });

    if (photoError) {
      throw new Error("사진 기록 저장 실패: " + photoError.message);
    }
  }

  if (saveStyleScore) {
    const bodyStyle = getFullBodyStyleScores(results);

    const { error: styleError } = await db
      .from("style_scores")
      .insert({
        submission_id: submissionId,
        total_score: bodyStyle.total,
        pose_score: bodyStyle.pose,
        outfit_score: bodyStyle.outfit,
        balance_score: bodyStyle.balance
      });

    if (styleError) {
      throw new Error("전신 스타일 점수 저장 실패: " + styleError.message);
    }
  }

  return submissionId;
}

async function runFaceAnalysis() {
  if (faceAnalyzeButton.disabled) return;

  setupSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  styleResultSection.classList.add("hidden");
  loadingSection.classList.remove("hidden");

  const loadingText = document.getElementById("loadingText");
  const progressBar = document.getElementById("progressBar");

  try {
    const results = [];

    for (let i = 0; i < files.length; i++) {
      loadingText.textContent = `사진 분석 중 ${i + 1}/${files.length}`;
      progressBar.style.width = `${Math.round((i / files.length) * 65)}%`;
      results.push(await analyzeFile(files[i]));
    }

    loadingText.textContent = "사진 분석중";
    progressBar.style.width = "75%";
    await saveToDatabase(results, false);

    progressBar.style.width = "100%";
    renderResults(results);

    await new Promise(resolve => setTimeout(resolve, 200));
    loadingSection.classList.add("hidden");
    resultSection.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    loadingSection.classList.add("hidden");
    setupSection.classList.remove("hidden");
    alert("저장 중 오류가 발생했습니다.\n" + error.message);
  }
}

async function runStyleAnalysis() {
  if (styleAnalyzeButton.disabled) return;

  setupSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  styleResultSection.classList.add("hidden");
  loadingSection.classList.remove("hidden");

  const loadingText = document.getElementById("loadingText");
  const progressBar = document.getElementById("progressBar");

  try {
    const results = [];

    for (let i = 0; i < files.length; i++) {
      loadingText.textContent = `전신 스타일 분석 중 ${i + 1}/${files.length}`;
      progressBar.style.width = `${Math.round((i / files.length) * 65)}%`;
      results.push(await analyzeFile(files[i]));
    }

    loadingText.textContent = "결과 저장 중";
    progressBar.style.width = "75%";
    await saveToDatabase(results, true);

    progressBar.style.width = "100%";
    renderStyleResults(results);

    await new Promise(resolve => setTimeout(resolve, 200));
    loadingSection.classList.add("hidden");
    styleResultSection.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    loadingSection.classList.add("hidden");
    setupSection.classList.remove("hidden");
    alert("저장 중 오류가 발생했습니다.\n" + error.message);
  }
}

function renderStyleResults(results) {
  const name = nameInput.value.trim();
  const age = Number(ageInput.value);
  const gender = genderInput.value;
  const bodyStyle = getFullBodyStyleScores(results);

  document.getElementById("styleResultTitle").textContent = `${name}님의 전신 스타일`;
  document.getElementById("styleResultMeta").textContent = `${age}세 · ${gender} · ${results.length}장 분석 완료`;

  document.getElementById("bodyStyleScore").textContent = bodyStyle.total;
  document.getElementById("poseScore").textContent = `포즈 ${bodyStyle.pose}`;
  document.getElementById("outfitScore").textContent = `코디 ${bodyStyle.outfit}`;
  document.getElementById("balanceScore").textContent = `사진 밸런스 ${bodyStyle.balance}`;

  const stylePhotoResults = document.getElementById("stylePhotoResults");
  stylePhotoResults.innerHTML = "";

  results.forEach((r, index) => {
    const row = document.createElement("div");
    row.className = "photo-result";
    row.innerHTML = `
      <img src="${r.previewUrl}" alt="전신 스타일 분석 사진 ${index + 1}">
      <div>
        <h3>${index + 1}번 사진</h3>
      </div>
      <div class="photo-score">${r.score}</div>
    `;
    stylePhotoResults.appendChild(row);
  });
}

function renderResults(results) {
  const name = nameInput.value.trim();
  const age = Number(ageInput.value);
  const gender = genderInput.value;

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const average = round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  const representative = results.length === 1 ? best.score : round(best.score * 0.65 + average * 0.35);
  const percentile = percentileFromScore(representative);
  const color = getPersonalColor(results);

  document.getElementById("resultTitle").textContent = `${name} // VISUAL SCAN`;
  document.getElementById("resultMeta").textContent = `${age}세 · ${gender} · ${results.length}장 분석 완료`;
  document.getElementById("mainScore").textContent = representative;
  document.getElementById("percentileBadge").textContent = `사이트 기준 상위 ${percentile}%`;

  document.getElementById("personalColor").textContent = color.type;


  const swatches = document.getElementById("colorSwatches");
  swatches.innerHTML = "";
  color.colors.forEach(c => {
    const span = document.createElement("span");
    span.className = "swatch";
    span.style.background = c;
    span.title = c;
    swatches.appendChild(span);
  });

  const photoResults = document.getElementById("photoResults");
  photoResults.innerHTML = "";

  results.forEach((r, index) => {
    const row = document.createElement("div");
    row.className = "photo-result";
    const isBest = r === best;
    row.innerHTML = `
      <img src="${r.previewUrl}" alt="분석 사진 ${index + 1}">
      <div>
        <h3>
          ${index + 1}번 사진
          ${isBest ? '<span class="best-tag">BEST</span>' : ''}
        </h3>
      </div>
      <div class="photo-score">${r.score}</div>
    `;
    photoResults.appendChild(row);
  });

}


function getShareUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return window.location.href;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (error) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }
}

async function copyCurrentLink(button) {
  await copyText(getShareUrl());
  const original = button.textContent;
  button.textContent = "복사 완료";
  setTimeout(() => {
    button.textContent = original;
  }, 1500);
}

function roundedRect(ctx2d, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx2d.beginPath();
  ctx2d.moveTo(x + r, y);
  ctx2d.arcTo(x + w, y, x + w, y + h, r);
  ctx2d.arcTo(x + w, y + h, x, y + h, r);
  ctx2d.arcTo(x, y + h, x, y, r);
  ctx2d.arcTo(x, y, x + w, y, r);
  ctx2d.closePath();
}

function fitText(ctx2d, text, maxWidth, startSize, minSize, family) {
  let size = startSize;
  do {
    ctx2d.font = `900 ${size}px ${family}`;
    if (ctx2d.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size >= minSize);
  return minSize;
}

function drawRetroBackground(ctx2d, width, height) {
  ctx2d.fillStyle = "#f4efdf";
  ctx2d.fillRect(0, 0, width, height);

  ctx2d.strokeStyle = "rgba(17,17,17,0.08)";
  ctx2d.lineWidth = 2;
  for (let x = 0; x <= width; x += 40) {
    ctx2d.beginPath();
    ctx2d.moveTo(x, 0);
    ctx2d.lineTo(x, height);
    ctx2d.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    ctx2d.beginPath();
    ctx2d.moveTo(0, y);
    ctx2d.lineTo(width, y);
    ctx2d.stroke();
  }
}

function drawCardBox(ctx2d, x, y, w, h, fill = "#fffaf0") {
  ctx2d.fillStyle = "#111111";
  ctx2d.fillRect(x + 12, y + 12, w, h);
  ctx2d.fillStyle = fill;
  ctx2d.fillRect(x, y, w, h);
  ctx2d.strokeStyle = "#111111";
  ctx2d.lineWidth = 8;
  ctx2d.strokeRect(x, y, w, h);
}

function canvasToBlob(canvasEl) {
  return new Promise((resolve, reject) => {
    canvasEl.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("결과 이미지 생성 실패"));
    }, "image/png", 0.95);
  });
}

async function createFaceResultCard() {
  const width = 1080;
  const height = 1350;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  drawRetroBackground(g, width, height);

  const score = document.getElementById("mainScore").textContent.trim();
  const percentile = document.getElementById("percentileBadge").textContent.trim();
  const color = document.getElementById("personalColor").textContent.trim();
  const shareUrl = getShareUrl();

  g.fillStyle = "#f5c842";
  g.strokeStyle = "#111111";
  g.lineWidth = 7;
  g.fillRect(72, 72, 360, 72);
  g.strokeRect(72, 72, 360, 72);
  g.fillStyle = "#111111";
  g.font = '900 31px "Courier New", monospace';
  g.fillText("AIFACE // 결과", 94, 119);

  g.font = '900 56px "Arial Black", sans-serif';
  g.fillText("내 사진 점수", 72, 245);

  drawCardBox(g, 72, 300, 936, 465);
  g.fillStyle = "#111111";
  g.font = '900 36px "Arial Black", sans-serif';
  g.fillText("종합 사진 점수", 116, 365);

  const scoreSize = fitText(g, score, 560, 230, 150, '"Arial Black", sans-serif');
  g.font = `900 ${scoreSize}px "Arial Black", sans-serif`;
  g.fillText(score, 112, 610);
  g.font = '900 52px "Arial Black", sans-serif';
  g.fillText("/ 100", 560, 610);

  g.fillStyle = "#78b8ff";
  g.strokeStyle = "#111111";
  g.lineWidth = 6;
  g.fillRect(112, 650, 620, 72);
  g.strokeRect(112, 650, 620, 72);
  g.fillStyle = "#111111";
  g.font = '900 30px "Arial Black", sans-serif';
  g.fillText(percentile, 136, 699);

  drawCardBox(g, 72, 810, 936, 205);
  g.font = '900 31px "Arial Black", sans-serif';
  g.fillText("퍼스널 컬러", 112, 875);
  const colorSize = fitText(g, color, 820, 62, 40, '"Arial Black", sans-serif');
  g.font = `900 ${colorSize}px "Arial Black", sans-serif`;
  g.fillText(color, 112, 963);

  g.fillStyle = "#111111";
  g.font = '900 29px "Arial Black", sans-serif';
  g.fillText("너도 해보기", 72, 1115);
  g.font = '700 25px "Courier New", monospace';
  const urlText = shareUrl.replace(/^https?:\/\//, "");
  g.fillText(urlText, 72, 1165);

  g.fillStyle = "#ef5b4d";
  g.fillRect(72, 1220, 936, 54);
  g.strokeStyle = "#111111";
  g.lineWidth = 6;
  g.strokeRect(72, 1220, 936, 54);
  g.fillStyle = "#111111";
  g.font = '900 23px "Courier New", monospace';
  g.fillText("AIFACE // SHARE YOUR SCORE", 106, 1257);

  return canvasToBlob(c);
}

async function createStyleResultCard() {
  const width = 1080;
  const height = 1350;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  drawRetroBackground(g, width, height);

  const total = document.getElementById("bodyStyleScore").textContent.trim();
  const pose = document.getElementById("poseScore").textContent.trim();
  const outfit = document.getElementById("outfitScore").textContent.trim();
  const balance = document.getElementById("balanceScore").textContent.trim();
  const shareUrl = getShareUrl();

  g.fillStyle = "#78b8ff";
  g.strokeStyle = "#111111";
  g.lineWidth = 7;
  g.fillRect(72, 72, 500, 72);
  g.strokeRect(72, 72, 500, 72);
  g.fillStyle = "#111111";
  g.font = '900 29px "Courier New", monospace';
  g.fillText("AIFACE // 전신 스타일", 94, 119);

  g.font = '900 54px "Arial Black", sans-serif';
  g.fillText("전신 스타일 결과", 72, 245);

  drawCardBox(g, 72, 300, 936, 430);
  g.font = '900 34px "Arial Black", sans-serif';
  g.fillText("전신 스타일 점수", 116, 365);
  const totalSize = fitText(g, total, 560, 220, 150, '"Arial Black", sans-serif');
  g.font = `900 ${totalSize}px "Arial Black", sans-serif`;
  g.fillText(total, 112, 610);
  g.font = '900 52px "Arial Black", sans-serif';
  g.fillText("/ 100", 560, 610);

  drawCardBox(g, 72, 780, 936, 290);
  const rows = [pose, outfit, balance];
  const fills = ["#f5c842", "#9fcd7a", "#78b8ff"];
  rows.forEach((text, i) => {
    const yy = 824 + i * 78;
    g.fillStyle = fills[i];
    g.fillRect(112, yy, 770, 58);
    g.strokeStyle = "#111111";
    g.lineWidth = 5;
    g.strokeRect(112, yy, 770, 58);
    g.fillStyle = "#111111";
    g.font = '900 27px "Arial Black", sans-serif';
    g.fillText(text, 136, yy + 40);
  });

  g.fillStyle = "#111111";
  g.font = '900 29px "Arial Black", sans-serif';
  g.fillText("너도 해보기", 72, 1155);
  g.font = '700 25px "Courier New", monospace';
  const urlText = shareUrl.replace(/^https?:\/\//, "");
  g.fillText(urlText, 72, 1205);

  g.fillStyle = "#ef5b4d";
  g.fillRect(72, 1250, 936, 54);
  g.strokeStyle = "#111111";
  g.lineWidth = 6;
  g.strokeRect(72, 1250, 936, 54);
  g.fillStyle = "#111111";
  g.font = '900 23px "Courier New", monospace';
  g.fillText("AIFACE // SHARE YOUR STYLE", 106, 1287);

  return canvasToBlob(c);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

async function shareResult(mode, button) {
  const siteUrl = getShareUrl();
  const isFace = mode === "face";
  const blob = isFace ? await createFaceResultCard() : await createStyleResultCard();
  const filename = isFace ? "aiface-result.png" : "aiface-style-result.png";

  // 공유 버튼 한 번으로 결과 이미지를 기기에 저장.
  downloadBlob(blob, filename);

  let shareText;
  if (isFace) {
    const score = document.getElementById("mainScore").textContent.trim();
    const percentile = document.getElementById("percentileBadge").textContent.trim();
    const color = document.getElementById("personalColor").textContent.trim();
    shareText = `AIFACE 결과: ${score}점 · ${percentile} · 퍼스널 컬러 ${color}\n너도 해봐: ${siteUrl}`;
  } else {
    const total = document.getElementById("bodyStyleScore").textContent.trim();
    const pose = document.getElementById("poseScore").textContent.trim();
    const outfit = document.getElementById("outfitScore").textContent.trim();
    const balance = document.getElementById("balanceScore").textContent.trim();
    shareText = `AIFACE 전신 스타일: ${total}점 · ${pose} · ${outfit} · ${balance}\n너도 해봐: ${siteUrl}`;
  }

  const file = new File([blob], filename, { type: "image/png" });
  const original = button.textContent;

  try {
    if (navigator.share) {
      const fileShare = { files: [file], title: "AIFACE", text: shareText, url: siteUrl };
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share(fileShare);
      } else {
        await navigator.share({ title: "AIFACE", text: shareText, url: siteUrl });
      }
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;
    console.error(error);
  }

  // 공유 API가 없으면 이미지는 저장되어 있고, 결과 + 링크를 클립보드에 복사.
  await copyText(shareText);
  button.textContent = "이미지 저장 + 링크 복사 완료";
  setTimeout(() => {
    button.textContent = original;
  }, 1800);
}

faceAnalyzeButton.addEventListener("click", runFaceAnalysis);
styleAnalyzeButton.addEventListener("click", runStyleAnalysis);

copyLinkButton.addEventListener("click", () => copyCurrentLink(copyLinkButton));
shareButton.addEventListener("click", () => shareResult("face", shareButton));

styleCopyLinkButton.addEventListener("click", () => copyCurrentLink(styleCopyLinkButton));
styleShareButton.addEventListener("click", () => shareResult("style", styleShareButton));

restartButton.addEventListener("click", () => {
  resultSection.classList.add("hidden");
  setupSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

styleRestartButton.addEventListener("click", () => {
  styleResultSection.classList.add("hidden");
  setupSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("beforeunload", cleanupUrls);
