# 폰트 (요구사항 18)

현재는 **웹폰트를 번들하지 않고 시스템 폰트 스택**을 사용합니다.
한국어 웹폰트를 확정하면 아래 절차대로 교체하세요. UI 전체가 한 번에 바뀝니다.

## 현재 스택

`src/styles/tokens.css` 의 `--font-sans` 한 곳에서만 정의합니다.

```css
--font-sans: 'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic',
  'Noto Sans KR', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

- macOS/iOS → Apple SD Gothic Neo
- Windows → 맑은 고딕
- Pretendard 가 설치되어 있으면 그것을 우선 사용

## 웹폰트로 교체하는 방법

1. 폰트 파일(`.woff2`)을 `public/fonts/` 에 넣습니다.
2. `src/styles/tokens.css` 맨 위에 `@font-face` 를 추가합니다.

```css
@font-face {
  font-family: 'Pretendard Variable';
  src: url('/fonts/PretendardVariable.woff2') format('woff2-variations');
  font-weight: 400 800;
  font-display: swap;
  /* 한글 + 기본 라틴만 서브셋하면 용량을 크게 줄일 수 있습니다. */
}
```

3. `--font-sans` 맨 앞에 폰트 이름이 이미 들어 있으므로 다른 수정은 필요 없습니다.

## 후보 폰트와 라이선스

실제 배포 전에 아래 표를 채우고, 폰트 파일과 함께 라이선스 원문을
`public/fonts/LICENSE-<폰트명>.txt` 로 보관하세요.

| 폰트 | 라이선스 | 상업적 이용 | 웹폰트 임베딩 | 출처 |
|---|---|---|---|---|
| Pretendard | SIL Open Font License 1.1 | 가능 | 가능 | https://github.com/orioncactus/pretendard |
| 나눔스퀘어 네오 | 나눔글꼴 라이선스 | 가능 | 가능 | https://hangeul.naver.com/fonts |
| 본고딕 (Noto Sans KR) | SIL Open Font License 1.1 | 가능 | 가능 | https://fonts.google.com/noto |

> 위 표는 참고용 초안입니다. **채택 전에 각 배포처의 최신 라이선스 원문을 직접 확인**하고
> 이 문서와 `public/fonts/` 의 라이선스 파일을 갱신하세요.

## 숫자 폰트

점수와 시간에는 `--font-numeric`(고정폭)을 사용합니다.
자릿수가 바뀌어도 레이아웃이 흔들리지 않도록 `font-variant-numeric: tabular-nums` 를 함께 적용합니다.
