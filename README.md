# 🌱 CANOPY 스마트 지원단 · 활동 기록 제출 사이트

GitHub Pages(사이트) + Firebase Firestore(저장)로 동작합니다.

- **학생 페이지** `index.html`: 학번·이름 입력 → 활동 선택 → 역할·배운 점 작성 → 제출. 같은 학번·이름으로 다시 들어오면 수정할 수 있어요.
- **교사 페이지** `admin.html`: 구글 로그인 → 학생별 기록 보기, 검색·필터, 엑셀(CSV) 내려받기, 기록 삭제

## 활동 구성 (`lib/activities.js`에서 수정)

| 구분 | 활동 |
|---|---|
| 필수 | 1학기 · 과학탐구 – 시뮬레이션 |
| 필수 | 2학기 · 스마트 IoT 하우스 프로젝트 구상 및 구현 ([프로젝트 사이트](https://quokka-smart-iot-house.vercel.app/) 확인, 조·장치 입력) |
| 선택 | 서울식물원 스마트팜 견학 / 당산중학교 스마트팜 캠프 / 동아리 동료교수 / 학교 일반화 '1학급 1무순' / 구로 청소년 축제 과학부스 |

## 설정 방법

### 1. Firebase
1. [console.firebase.google.com](https://console.firebase.google.com)에서 **프로젝트 추가** (애널리틱스는 꺼도 돼요)
2. **빌드 → Firestore Database → 데이터베이스 만들기**: 위치 `asia-northeast3 (서울)`, **프로덕션 모드**
3. **규칙** 탭에 `firestore.rules` 내용 전체를 붙여넣고, `teacher@example.com`을 선생님 구글 이메일로 바꾼 뒤 **게시**
4. **빌드 → Authentication → 시작하기 → Google** 사용 설정
5. **Authentication → 설정 → 승인된 도메인**에 `techsegu25.github.io` 추가
6. **프로젝트 설정(⚙️) → 내 앱 → 웹(</>)** 앱 등록 → 나오는 `firebaseConfig` 값을 복사

### 2. GitHub
1. 저장소에서 `firebase-config.js`를 열고 ✏️(편집) → 복사한 값으로 바꾸고 **Commit**
2. **Settings → Pages → Branch: `main` / `(root)` → Save**
3. 1~2분 뒤 `https://techsegu25.github.io/26-club-record/` 접속

## 보안 메모
- 학생 기록은 학번+이름을 정확히 알아야 열람·수정할 수 있고, 전체 목록은 규칙에 등록한 교사 계정만 볼 수 있어요.
- 한 학번은 처음 제출한 이름으로 고정돼요. 이름을 잘못 쓴 학생이 있으면 교사 페이지에서 그 기록을 삭제하면 다시 제출할 수 있어요.
- `firebase-config.js`의 apiKey는 공개돼도 괜찮은 값이에요. 데이터 보호는 Firestore 규칙이 담당합니다.
