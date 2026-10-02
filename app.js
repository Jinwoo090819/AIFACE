const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");
const analyzeButton = document.getElementById("analyzeButton");
const nameInput = document.getElementById("nameInput");
const ageInput = document.getElementById("ageInput");
const genderInput = document.getElementById("genderInput");
const setupSection = document.getElementById("setupSection");
const loadingSection = document.getElementById("loadingSection");
const resultSection = document.getElementById("resultSection");
const restartButton = document.getElementById("restartButton");
const dropzone = document.getElementById("dropzone");
const canvas = document.getElementById("analysisCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

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
  analyzeButton.disabled = !(hasName && hasAge && hasGender && files.length > 0);
}

nameInput.addEventListener("input", updateAnalyzeState);
ageInput.addEventListener("input", updateAnalyzeState);
genderInput.addEventListener("change", updateAnalyzeState);

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

  // 중앙 영역: 피부/얼굴에 가까운 색 추정을 위한 아주 거친 샘플
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

  // 사진 품질용 점수: 촬영 조건에 대한 휴리스틱
  const brightnessPenalty = Math.abs(brightness - 0.56) * 65;
  const contrastScore = clamp((contrast - 0.06) / 0.22, 0, 1) * 18;
  const edgeScore = clamp((edge - 0.018) / 0.11, 0, 1) * 18;
  const saturationBalance = 12 - Math.abs(saturation - 0.38) * 18;

  const score = clamp(
    72 - brightnessPenalty + contrastScore + edgeScore + saturationBalance,
    35,
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

  // 조명 영향을 크게 받는 매우 단순한 휴리스틱
  const warmth = (avgR - avgB) + (avgG - avgB) * 0.25;
  const isWarm = warmth > 11;
  const isLight = hsv.v > 0.60;
  const isClear = hsv.s > 0.23;

  let type, colors, note;

  if (isWarm && (isLight || isClear)) {
    type = "봄 웜 계열";
    colors = ["#FFD6A5", "#FFADAD", "#FDFFB6", "#CAFFBF"];
    note = "맑고 따뜻한 색감이 비교적 잘 맞는 쪽으로 추정됩니다.";
  } else if (isWarm) {
    type = "가을 웜 계열";
    colors = ["#C97B63", "#D4A373", "#A98467", "#6B705C"];
    note = "차분하고 깊은 웜톤 색감이 비교적 잘 맞는 쪽으로 추정됩니다.";
  } else if (!isWarm && isLight) {
    type = "여름 쿨 계열";
    colors = ["#CDB4DB", "#A2D2FF", "#BDE0FE", "#FFC8DD"];
    note = "부드럽고 밝은 쿨톤 색감이 비교적 잘 맞는 쪽으로 추정됩니다.";
  } else {
    type = "겨울 쿨 계열";
    colors = ["#3A0CA3", "#4361EE", "#7209B7", "#F72585"];
    note = "선명하고 대비가 있는 쿨톤 색감이 비교적 잘 맞는 쪽으로 추정됩니다.";
  }

  // 여러 장 사이 색온도 일관성으로 신뢰도 추정
  const warmSigns = results.map(r => ((r.avgR - r.avgB) + (r.avgG - r.avgB) * 0.25) > 11);
  const same = warmSigns.filter(x => x === warmSigns[0]).length / warmSigns.length;
  const confidence = results.length === 1 ? "낮음" : same >= 0.8 ? "보통" : "낮음";

  return { type, colors, note, confidence };
}

function metricLabelBrightness(v) {
  if (v < 0.38) return "어두움";
  if (v > 0.72) return "밝음";
  return "적정";
}

function metricLabelContrast(v) {
  if (v < 0.10) return "낮음";
  if (v > 0.25) return "높음";
  return "적정";
}

function metricLabelSharpness(v) {
  if (v < 0.035) return "낮음";
  if (v > 0.09) return "높음";
  return "보통";
}

function buildTips(best, color) {
  const tips = [];

  if (best.brightness < 0.42) {
    tips.push("사진이 다소 어둡게 분석됐습니다. 창가나 밝은 실내처럼 얼굴에 빛이 고르게 들어오는 곳에서 촬영해보세요.");
  } else if (best.brightness > 0.72) {
    tips.push("사진이 매우 밝게 분석됐습니다. 강한 직사광선보다 부드러운 자연광에서 촬영하면 디테일이 더 잘 남습니다.");
  } else {
    tips.push("대표 사진의 밝기는 비교적 안정적입니다. 지금과 비슷한 조명 조건을 유지해도 좋습니다.");
  }

  if (best.contrast < 0.11) {
    tips.push("대비가 낮아 사진이 평평해 보일 수 있습니다. 배경과 옷 색을 조금 분리하면 사진이 더 또렷해집니다.");
  } else {
    tips.push("배경을 단순하게 정리하면 인물과 사진 전체의 시선 집중도가 더 좋아질 수 있습니다.");
  }

  if (best.edge < 0.045) {
    tips.push("선명도가 낮게 감지됐습니다. 렌즈를 닦고 흔들림을 줄이거나 조금 더 밝은 환경에서 촬영해보세요.");
  } else {
    tips.push("선명도는 무난합니다. 과한 필터나 뷰티 효과를 줄이면 퍼스널 컬러 추정도 더 안정적입니다.");
  }

  tips.push(`${color.type} 추정은 조명과 카메라 화이트밸런스 영향을 크게 받습니다. 자연광 정면 사진 여러 장을 사용하면 결과가 더 안정적입니다.`);

  return tips;
}

async function runAnalysis() {
  if (analyzeButton.disabled) return;

  setupSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  loadingSection.classList.remove("hidden");

  const loadingText = document.getElementById("loadingText");
  const progressBar = document.getElementById("progressBar");
  const messages = [
    "밝기와 대비를 확인하는 중...",
    "선명도와 색감을 비교하는 중...",
    "사진별 점수를 계산하는 중...",
    "퍼스널 컬러를 간이 추정하는 중..."
  ];

  const results = [];
  for (let i = 0; i < files.length; i++) {
    loadingText.textContent = messages[Math.min(i, messages.length - 1)];
    progressBar.style.width = `${Math.round((i / files.length) * 80)}%`;
    results.push(await analyzeFile(files[i]));
  }

  await new Promise(resolve => setTimeout(resolve, 450));
  progressBar.style.width = "100%";

  renderResults(results);

  await new Promise(resolve => setTimeout(resolve, 250));
  loadingSection.classList.add("hidden");
  resultSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  document.getElementById("percentileBadge").textContent = `사이트 비주얼 인상 기준 상위 ${percentile}%`;

  document.getElementById("personalColor").textContent = `${color.type} · 신뢰도 ${color.confidence}`;
  document.getElementById("colorNote").textContent =
    `${color.note} (간이 추정이며 실제 진단을 대신하지 않습니다.)`;

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
          ${isBest ? '<span class="best-tag">BEST PHOTO</span>' : ''}
        </h3>
        <div class="metric-row">
          <span class="metric">밝기 ${metricLabelBrightness(r.brightness)}</span>
          <span class="metric">대비 ${metricLabelContrast(r.contrast)}</span>
          <span class="metric">선명도 ${metricLabelSharpness(r.edge)}</span>
          <span class="metric">${r.width}×${r.height}</span>
        </div>
      </div>
      <div class="photo-score">${r.score}</div>
    `;
    photoResults.appendChild(row);
  });

  const tipsList = document.getElementById("tipsList");
  tipsList.innerHTML = "";
  buildTips(best, color).forEach(tip => {
    const li = document.createElement("li");
    li.textContent = tip;
    tipsList.appendChild(li);
  });
}

analyzeButton.addEventListener("click", runAnalysis);

restartButton.addEventListener("click", () => {
  resultSection.classList.add("hidden");
  setupSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("beforeunload", cleanupUrls);
