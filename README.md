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
