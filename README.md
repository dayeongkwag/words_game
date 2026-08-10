# 낱말퍼즐 — 한국어 가로세로 낱말퍼즐 웹게임

시작할 때마다 **새로운 퍼즐이 생성되는** 한국어 가로세로 낱말퍼즐입니다.
시드 기반으로 퍼즐을 만들기 때문에, 같은 링크를 연 사람은 항상 같은 퍼즐을 풉니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm test           # 테스트 (57개)
npm run build      # 프로덕션 빌드
npm run typecheck  # 타입 검사
```

개발용 진단 스크립트:

```bash
# 퍼즐 생성 결과를 터미널에서 확인
npx vite-node scripts/preview-puzzle.ts          # 기본 시드 5개
npx vite-node scripts/preview-puzzle.ts myseed   # 특정 시드

# 단어 데이터 점검 (중복·비한글·길이 분포)
npx vite-node scripts/check-words.ts

# 실제 브라우저에서 격자 입력이 동작하는지 측정 (dev 서버가 떠 있어야 함)
node scripts/probe-input.mjs
```

`probe-input.mjs` 는 입력창이 칸과 정확히 겹치는지, 칸을 눌렀을 때 포커스가
입력창으로 가는지, 한글 조합이 격자에 반영되는지를 실제 브라우저에서 측정한다.
입력 관련 버그는 코드만 읽어서는 원인을 알기 어려우므로 이 스크립트로 먼저 확인할 것.

개발 서버에서는 화면 맨 아래에 진단 패널이 접힌 채로 나타난다.
`펼치기` 를 누르면 포커스·조합·입력 이벤트 흐름을 실시간으로 볼 수 있다.
(프로덕션 빌드에는 포함되지 않는다)

## 기술 스택

Vite + React 18 + TypeScript + Vitest. 순수 CSS(변수 기반 토큰).
런타임 의존성은 React 뿐입니다.

---

## 아키텍처

핵심 원칙은 **게임 엔진이 데이터 소스를 모른다**는 것입니다.

```
       UI (components/)
            ↓
   게임 엔진 (game/, hooks/)
            ↓
      WordRepository            ← 게임 엔진이 아는 유일한 데이터 접점
            ↓
  ┌─────────┼──────────┬───────────┐
 Mock     JSON      Supabase      API      ← 교체해도 위쪽은 수정 불필요
```

`JSONWordRepository` 를 `SupabaseWordRepository` 로 바꿔도
`PuzzleGenerator` / `Scoring` / `HintSystem` / `GameState` / UI 는 **한 줄도 바뀌지 않습니다.**

### 디렉터리

```
src/
├── config/          모든 수치·문구·색상 설정 (하드코딩 금지 지점)
│   ├── gameConfig       오답 한도, 힌트 횟수/차감 점수, 단어 수, 타이머
│   ├── scoringConfig    점수 계수
│   ├── puzzleConfig     생성기 튜닝 + GENERATOR_VERSION
│   ├── categoryConfig   카테고리 비율, 고유명사/신조어 상한
│   ├── shareConfig      공유 문구, 링크 방식
│   ├── dataSourceConfig mock | json 선택
│   └── uiConfig         칸 크기, 애니메이션 시간
│
├── types/           WordEntry / Puzzle / GameState 등 데이터 모델
│
├── data/
│   ├── repositories/    WordRepository (인터페이스) + Mock / JSON 구현 + 팩토리
│   └── mock/            테스트용 한국어 단어 214개
│
├── game/            게임 엔진 (순수 로직, React 의존성 없음)
│   ├── wordSelection    후보 단어 선택 (카테고리 비율·난이도·교차 가능성)
│   ├── layout           격자 배치 엔진 (교차 탐색·충돌 검사)
│   ├── puzzleGenerator  후보 생성 → 검증 → 최적 선택 → fallback
│   ├── puzzleValidator  연결성·충돌·모양 품질 평가
│   ├── puzzleAssembly   배치 → Puzzle 자료구조 (번호 부여·체크섬)
│   ├── puzzleView       정답을 제거한 UI 전용 뷰
│   ├── gameState        상태 머신 리듀서 (입력·정오답·종료 판정)
│   ├── scoring          점수 계산
│   ├── hintSystem       힌트 3종 + 차감 점수
│   └── puzzleShare      공유 링크 생성/복원, 스냅샷
│
├── storage/         StorageAdapter → localStorage (기록·테마)
├── hooks/           useGame / useTheme / useHangulInput
├── components/      game / puzzle / clue / hint / result / sharing / common
├── styles/          tokens.css (색상·폰트) + base.css + components.css
├── utils/           hangul / random(시드 RNG) / format / base64 / resultImage
│
├── admin/           ⏳ Phase 3 준비 — 인터페이스만 정의
└── services/        ⏳ Phase 5 준비 — AIService 인터페이스만 정의
```

---

## 퍼즐 생성 알고리즘

`src/game/puzzleGenerator.ts`

1. 시드로 목표 단어 수(9~16, 범위 7~20)와 목표 난이도를 결정
2. `WordRepository` 에서 후보 풀 선택 — 카테고리 가중치, 목표 난이도 근접도,
   음절 교차 가능성, 고유명사/신조어 비율 상한을 종합
3. 씨앗 단어를 중앙에 가로 배치
4. 매 단계 후보 단어들의 **모든 가능한 배치**를 찾아 점수화
   (교차 수 · 중심 근접도 · 바운딩 박스 증가 · 가로세로 균형)
5. 상위 N개 중 시드 RNG로 하나 선택 → 모양이 매번 달라짐
6. 완성된 레이아웃을 검증: 연결성, 글자 충돌, 고립 단어,
   교차 비율, 방향 편중, 종횡비, 밀도
7. 최대 30회 후보를 만들어 **모양 점수가 가장 높은 것** 선택
8. 전부 실패하면 기준 완화 → 그래도 실패하면 fallback 퍼즐 (무한 루프 없음)

### 배치 규칙

- 같은 칸에 다른 글자가 오면 배치 불가
- 단어 앞뒤 칸은 비어 있어야 함 (의도치 않은 단어 생성 방지)
- 교차하지 않는 칸의 직교 이웃은 비어 있어야 함 (나란히 붙는 단어 방지)
- 첫 단어를 제외한 모든 단어는 최소 1개의 교차점 필요

생성 시간은 퍼즐당 **약 25ms** 입니다.

---

## 동일 퍼즐 공유 (요구사항 36·37)

기본은 **seed 링크**입니다. 퍼즐 전체를 URL 에 담지 않습니다.

```
https://example.com/?p=k7m2p9&g=1&d=mock-214&c=1a2b3c
                      seed     생성기  데이터   체크섬
```

링크를 열면 같은 seed 로 퍼즐을 다시 만들고, **체크섬을 대조**합니다.
단어 DB나 생성기가 바뀌어 결과가 달라지면 사용자에게 안내 문구를 보여 줍니다.

링크를 영구히 보존해야 한다면 `shareConfig.linkMode = 'snapshot'` 으로 바꾸세요.
배치 정보 전체를 링크에 담으므로 단어 DB가 어떻게 바뀌어도 그대로 복원됩니다.
(양쪽 경로 모두 구현·테스트되어 있습니다.)

---

## 게임 규칙

모두 `src/config/gameConfig.ts` 에서만 정의됩니다. UI·엔진에 숫자를 직접 쓰지 않습니다.

| 항목 | 기본값 |
|---|---|
| 단어 수 | 7 ~ 20개 (선호 9 ~ 16) |
| 오답 허용 | 5회 — **6번째 오답 시 즉시 게임 오버** |
| 힌트 | 최대 3회, 첫 힌트 무료 |
| 힌트 차감 | 한 글자 30 / 초성 50 / 정답 70 |
| 힌트 배율 | 1번째 ×0, 2번째 ×1.0, 3번째 ×1.6 |

힌트 종류는 **한 글자 공개 / 초성 공개 / 정답 공개** 3종입니다.
(카테고리 공개 힌트는 사용하지 않습니다.)

---

## 실제 단어 DB 연결

`data/approved_words.json` 파일을 넣기만 하면 됩니다. 자세한 내용은
[`data/README.md`](data/README.md) 를 참고하세요.

파일이 없으면 내장 mock 단어로 자동 폴백하므로, 지금 상태로도 게임이 완전히 동작합니다.

---

## 진행 상황

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | 게임 핵심 (생성·플레이·점수·힌트) | ✅ 완료 |
| 2 | UX·기록·공유·이미지 저장 | ✅ 완료 |
| 3 | 관리자 기능 | 🔜 인터페이스만 준비 |
| 4 | 외부 단어 DB 연결 | 🔜 JSON 경로 준비 완료 |
| 5 | AI 기반 단어 업데이트 | 🔜 인터페이스만 준비 |
| 6 | Supabase 등 외부 DB | 🔜 Repository 계층 분리 완료 |

Phase 3~6 은 아직 구현하지 않았습니다. `src/admin/` 과 `src/services/` 에는
**인터페이스 정의만** 있으며 어떤 코드에서도 호출되지 않습니다.
