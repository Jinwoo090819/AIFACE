# AIFACE RETRO MVP

비상업용 사진 분석 사이트의 정적 MVP입니다.

## 포함 기능

- 이름 / 닉네임 입력
- 나이 입력
- 사진 최대 5장 업로드
- 사진 미리보기 및 삭제
- 브라우저 내부 사진 분석
  - 밝기
  - 대비
  - 선명도
  - 색감
- 사진별 완성도 점수
- 가장 잘 나온 사진 선택
- 사이트 자체 점수 구간에 따른 상위 % 표시
- 간이 퍼스널 컬러 추정
- 개선 팁

## 중요한 점

이 프로젝트는 얼굴 외모의 우열을 평가하지 않습니다.
점수와 상위 %는 사진의 밝기, 대비, 선명도 등 촬영 품질을 바탕으로 한
엔터테인먼트용 지표입니다.

퍼스널 컬러도 조명과 카메라 설정 영향을 크게 받는 간이 추정입니다.

사진은 서버로 업로드되지 않으며 브라우저 안에서만 처리됩니다.

## Vercel 배포

### 가장 쉬운 방법

1. 이 폴더의 파일을 GitHub 저장소에 올립니다.
2. Vercel에 로그인합니다.
3. `Add New → Project`를 선택합니다.
4. GitHub 저장소를 선택합니다.
5. Framework Preset은 `Other` 또는 자동 감지 상태로 둡니다.
6. Build Command는 비워둡니다.
7. Output Directory도 비워둡니다.
8. Deploy를 누릅니다.

정적 파일이라 별도 서버 설정이 필요 없습니다.

## 로컬에서 실행

그냥 `index.html`을 열어도 되지만 브라우저 보안 정책 때문에
간단한 로컬 서버를 쓰는 것을 권장합니다.

Python이 있다면:

```bash
python -m http.server 8080
```

그다음 브라우저에서:

```text
http://localhost:8080
```

## 파일 구조

```text
photo-score-mvp/
├─ index.html
├─ style.css
├─ app.js
├─ vercel.json
└─ README.md
```

## 다음 단계

실제 AI 분석을 붙이고 싶다면 `app.js`의 `analyzeFile()` 또는 `renderResults()`
부분을 API 호출 방식으로 교체하면 됩니다.


## Retro redesign
- Off-white paper background
- Heavy black borders and offset shadows
- Yellow / red / blue accents
- Monospace / poster-style typography
- Visual impression score framing instead of inherent attractiveness ranking

## v2 changes
- Added custom AIFACE retro favicon
- Added gender field to profile
- Gender is displayed in result metadata
- Gender does not change the visual-impression score


## v4 visual refresh
- Added 8-bit headline/UI styling using Press Start 2P
- Improved readability with larger body typography and clearer spacing
- Removed the analysis-criteria notice block
- Tightened hero text and simplified call-to-action labels
