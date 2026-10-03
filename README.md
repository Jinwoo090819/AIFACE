# AIFACE

레트로 8BIT 스타일 사진 분석 웹사이트입니다.

## 기능

- 이름 / 나이 / 성별 입력
- 사진 최대 5장 업로드
- FACE SCORE
- 사이트 기준 상위 %
- 퍼스널 컬러
- 사진별 점수
- Supabase Database 저장
- Supabase private Storage 사진 저장

## 저장 구조

`submissions`
- id
- name
- age
- gender
- created_at

`photos`
- id
- submission_id
- storage_path
- score
- created_at

사진은 `faces` private bucket에 다음 형태로 저장됩니다.

```text
faces/<submission UUID>/<photo file>
```

이름으로 사용자를 찾을 때는 `submissions.name`을 검색하고, 사진은 `submission_id`로 연결합니다.

## Supabase 연결

Project URL:
`https://gdxkntjlrpbzvibpzvpx.supabase.co`

프런트엔드에는 Publishable key만 사용합니다.
Secret / service-role key는 브라우저 코드에 넣지 않습니다.

## 배포

GitHub에 파일을 덮어쓴 뒤 Commit하면 연결된 Vercel이 자동 재배포합니다.

## v6
- Added full-body photo style scoring
- Scores pose, outfit coordination, and overall photo balance
- Does not score or rank body shape or physical body traits
- Main interface labels are now mostly Korean


## v7 - 전신 스타일 점수 DB 저장

새 테이블 `style_scores`:

- submission_id
- total_score
- pose_score
- outfit_score
- balance_score
- created_at

Supabase SQL Editor에서 `supabase-style-scores.sql` 내용을 한 번 실행해야 합니다.

저장 흐름:

```text
submissions
  ↓
photos
  ↓
style_scores
```

`submission_id`로 한 사용자의 기본 정보, 사진, 전신 스타일 점수를 연결합니다.


## v8 - 얼굴 분석 / 전신 스타일 분석 분리

메인 화면에서 두 버튼을 각각 사용할 수 있습니다.

- `얼굴 / 사진 분석`
  - FACE SCORE
  - 상위 %
  - 퍼스널 컬러
  - 사진별 점수
  - `submissions`, `photos` 저장

- `전신 스타일 분석`
  - 전신 스타일 점수
  - 포즈
  - 코디
  - 사진 밸런스
  - `submissions`, `photos`, `style_scores` 저장

전신 스타일 분석을 실행할 때만 `style_scores` 테이블에 데이터가 추가됩니다.


## v9 - 공유 기능

결과 화면에 다음 버튼이 추가되었습니다.

- 링크 복사
- 공유하기
- 다시 분석

`공유하기`는 휴대폰/지원 브라우저에서 시스템 공유창을 엽니다.
지원하지 않는 브라우저에서는 현재 사이트 링크를 복사합니다.


## v10
- 얼굴/사진 점수의 최소값을 40점으로 조정


## v11 - 결과 이미지 + 링크 공유
- 얼굴 결과 공유 시 PNG 결과 카드를 자동 저장합니다.
- 전신 스타일 결과 공유 시 PNG 결과 카드를 자동 저장합니다.
- 지원 기기에서는 공유창에 결과 이미지 파일과 AIFACE 사이트 링크를 함께 전달합니다.
- 공유 API가 없으면 결과 이미지를 저장하고 결과 요약 + 링크를 클립보드에 복사합니다.
