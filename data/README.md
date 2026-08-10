# 단어 데이터 디렉터리

이 폴더에 **`approved_words.json`** 파일을 넣으면 게임이 자동으로 실제 단어 DB를 사용합니다.
게임 코드는 한 줄도 수정할 필요가 없습니다.

## 동작 방식

```
파일 없음  → JSONWordRepository 가 내장 mock 단어로 자동 폴백 (콘솔에 안내 출력)
파일 있음  → JSONWordRepository 가 이 파일을 읽어 사용
```

`src/data/repositories/JSONWordRepository.ts` 가 `import.meta.glob('/data/approved_words.json')`
으로 이 경로를 참조합니다. 파일을 추가한 뒤 개발 서버를 재시작하세요.

## 허용하는 JSON 형태

세 가지 모두 지원합니다.

```json
[ { "id": "wd-000001", "word": "인공지능", ... } ]
```

```json
{ "version": "2026-08-10", "words": [ { ... } ] }
```

```json
{ "data": [ { ... } ] }
```

`version` 을 넣어 두면 공유 링크의 데이터 버전 기록에 사용되어,
나중에 단어 DB가 바뀌었을 때 이용자에게 정확히 안내할 수 있습니다.

## 레코드 구조

```json
{
  "id": "wd-000001",
  "word": "인공지능",
  "normalizedWord": "인공지능",
  "length": 4,
  "category": "일반",
  "subcategory": "기술",
  "difficulty": 2,
  "definition": "인간의 지능적 능력을 컴퓨터로 구현하는 기술",
  "isProperNoun": false,
  "isSlang": false,
  "isNeologism": false,
  "isTrendWord": false,
  "isBrand": false,
  "puzzleSuitable": true,
  "status": "approved"
}
```

### 필드 처리 규칙

| 필드 | 필수 | 누락 시 |
|---|---|---|
| `word` | ✅ | 해당 레코드 제외 |
| `id` | | 순번으로 자동 생성 |
| `normalizedWord` | | `word` 에서 공백·구두점 제거해 생성 |
| `length` | | `normalizedWord` 의 음절 수로 자동 계산 |
| `difficulty` | | `2`, 범위를 벗어나면 1~5로 보정 |
| `category` | | `"기타"` |
| `puzzleSuitable` | | `true` |
| `status` | | `"approved"` |

### 자동으로 제외되는 단어

- 완성형 한글이 아닌 글자가 섞인 단어 (격자에 배치할 수 없음)
- `status !== "approved"`
- `puzzleSuitable === false`

## 데이터 소스 전환

`.env` 파일 또는 환경변수로 강제 지정할 수 있습니다.

```
VITE_WORD_SOURCE=mock   # 항상 내장 mock 사용
VITE_WORD_SOURCE=json   # 기본값
```
