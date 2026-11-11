# 🌱 CANOPY 스마트 지원단 · 활동 기록 제출 사이트

학생들이 동아리 활동별로 **내가 맡은 역할**과 **배운 점**을 제출하고, 교사가 모아 보며 생기부 작성에 활용하는 사이트입니다.

- **학생 페이지** `/` — 학번·이름 입력 → 활동 선택 → 작성 → 제출 (같은 학번·이름으로 다시 들어오면 수정 가능)
- **교사 페이지** `/admin` — 비밀번호 입력 → 학생별 기록 보기, 검색·필터, 엑셀(CSV) 내려받기

## 활동 구성

| 구분 | 활동 | 비고 |
|---|---|---|
| 필수 | 1학기 · 과학탐구 – 시뮬레이션 | |
| 필수 | 2학기 · 스마트 IoT 하우스 프로젝트 구상 및 구현 | [프로젝트 사이트](https://quokka-smart-iot-house.vercel.app/) 확인 체크, 조(1~15조)·장치 입력 |
| 선택 | 서울식물원 스마트팜 견학 | |
| 선택 | 당산중학교 스마트팜 캠프 참여 | |
| 선택 | 동아리 동료교수 활동 | |
| 선택 | 학교 일반화 – '1학급 1무순' 행사 | |
| 선택 | 구로 청소년 축제 과학부스 운영 | |

각 활동마다 ① 역할 태그(복수 선택) ② 내가 한 역할(필수) ③ 배운 점·느낀 점(필수) ④ 어려웠던 점·기억에 남는 장면(선택)을 적습니다.
활동 이름·안내 문구·역할 태그는 `lib/activities.js`에서 수정하면 됩니다.

## 배포 방법 (Vercel + Neon Postgres, 약 5분)

1. [vercel.com/new](https://vercel.com/new) → 이 GitHub 저장소 **Import** → Framework는 `Other` 그대로 → **Deploy**
2. 배포된 프로젝트 → **Storage** 탭 → **Create Database** → **Neon (Serverless Postgres)** → 무료 플랜으로 생성 → 이 프로젝트에 **Connect**
   (환경변수 `DATABASE_URL`이 자동으로 추가됩니다. 테이블은 첫 접속 때 자동 생성돼요.)
3. **Settings → Environment Variables** → `ADMIN_PASSWORD` = 교사용 비밀번호 추가
4. **Deployments** → 최신 배포 `⋯` → **Redeploy** (환경변수 반영)
5. 학생에게 `https://<프로젝트>.vercel.app` 주소 공유, 교사는 `/admin` 접속

> Supabase 등 다른 Postgres를 써도 됩니다. 접속 주소를 `DATABASE_URL`(또는 `POSTGRES_URL`)에 넣으면 됩니다.

## 참고

- 학번은 숫자 4~6자리. 한 학번은 처음 제출한 이름으로 고정되고, 다른 이름으로는 열람·수정할 수 없습니다.
- 학번·이름만 알면 수정할 수 있으므로, 교사 페이지에서 마지막 수정 시간을 확인하세요.
- 작성 중인 내용은 학생 기기에 임시 저장되어 새로고침해도 사라지지 않습니다.

## 로컬 실행

```bash
npm install
DATABASE_URL=postgres://... ADMIN_PASSWORD=test node dev-server.js
```
