# Garmin 데이터와 회사 자체 호스팅 AI: 권고와 문의 접수

기준일: 2026-10-30, Asia/Seoul. 사용자 결정: **회사 관리 서버에서 자체 호스팅**.

## 최종 권고

사전 학습 모델을 회사 관리 서버에서 실행하고, Garmin의 **해당 용도에 대한 서면 허용**을 받은 범위 안에서 개인 기록을 추론하는 구성을 권고한다. 자체 호스팅은 외부 모델 사업자에게 보내는 경로를 줄이는 운영 선택이며, Garmin 데이터의 AI 사용 권한을 자동으로 만들지 않는다.

첫 운영 범위는 사용자가 고른 계정 기록의 구조화된 운동 사실과 출처를 바탕으로 한 설명이다. 훈련 추천·계획 조정은 기존 결정론적 훈련 엔진의 후보와 안전 판정을 재사용하고, 별도의 제공자 허용 범위에 연결한다. 모델의 문장이나 선택으로 훈련량·페이스·안전 통과·계획 활성화 권한을 만들지 않는다.

- 요청별 최소 자료만 처리한다. 사적 일지 원문·통증 서술·GPS·인증정보는 모델 입력에서 제외한다.
- Garmin 자료와 그 파생 입력·출력·요약·추천을 학습, 파인튜닝, 평가, 벤치마크, 모델 개선, 공용 벡터 저장소나 AI 지식베이스에 재사용하지 않는다.
- 최초 구현은 요청 중 처리만 허용한다. 결과 영구 저장, 검색 기억, 모델 평가를 나중에 켜는 것은 이번 동의의 확장이며 별도 검토가 필요하다.
- 직접 업로드, HealthKit/Health Connect 경유, 혼합 자료에서도 원래 제공자와 사용한 원천 필드를 유지한다. 내보낸 파일이라는 이유로 Garmin 제한이 사라진다고 보지 않는다.
- 계정의 명시적 선택·목적 동의와 제공자 사용 허용을 따로 검사한다. 사용자가 파일을 확인했다는 사실은 제공자 허용이나 출처 검증이 아니다.
- 서버의 운영 승인, 계정 권한, 동의, 정확한 기록 수정번호, 출처, 유효한 제공자 허용을 모두 확인한다. 추론이 끝난 뒤 다시 확인하고 달라졌으면 결과를 반환하지 않는다.
- 실제 서버·모델·호스팅 업체와 처리 지역은 아직 선택되지 않았다. 계약·보안·비용 검토 후 정하고 제공자에게 필요한 공개를 마친다.

## 검토 근거와 해석의 범위

로그인 후 제시된 Garmin Connect Developer Program v9 원문을 검토했다. 기밀 전문은 저장소에 복제하지 않는다. §15.10/15.11의 AI 동의·제한 및 서면 예외, §5.1(m)/(n)·§5.2(t)·§15.11(d)의 승인 용도·경쟁 관련 범위 때문에 추론 전용 자체 호스팅을 허용으로 단정하지 않았다. 이 문서는 구현 권고이며 Garmin의 유권해석이나 법률 의견이 아니다.

공개 절차 확인 자료:

- [개발자 프로그램 개요](https://developer.garmin.com/gc-developer-program/overview/)
- [Activity API](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/)
- [Training API](https://developer.garmin.com/gc-developer-program/enterprise/training-api/)
- [개발자 프로그램 FAQ](https://developer.garmin.com/gc-developer-program/enterprise/program-faq/)
- [출처 표시 지침](https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf)

프로그램 환영/신청 승인, API별 권한, AI 사용 허용, 실계정 OAuth, 실제 운동기록 수신은 각각 다른 확인 단계다. 공개 소개나 출처 표시 지침만으로 AI 권한을 판정하지 않는다.

## 실제 문의 접수

- 채널: [Garmin 공식 개발자 문의 양식](https://www.garmin.com/en-US/forms/developercontactus/)
- 제출 계정 연락처: 회사 도메인의 기존 신청 연락처. 개인 Gmail로 재신청하지 않았다.
- 제목: `TrainOracle - written permission for company-hosted LLM inference and coaching scope`
- 확인: 제출 후 **“Your information has been sent successfully. We'll be in touch soon.”** 화면을 직접 확인했다.
- 새 접수 번호는 화면에 표시되지 않았다. 기존 문의 번호와 10월 29일 신청을 연결해 달라고 요청했다.
- [보낸 전문](../verification/self-hosted-coaching-20261030/garmin-inquiry.txt)
- [접수 완료 화면](../verification/self-hosted-coaching-20261030/garmin-submitted.jpg)

문의는 다음 항목별로 답변 또는 명시적 서면 예외를 요청했다.

1. 자체 호스팅 추론 및 요청별 최근 기록 선택의 허용 여부와 조건.
2. 사실 설명, 개인화 피드백, 추천·계획 조정 각각의 허용 범위.
3. 사용 필드·파생지표·저장·호스팅/지역 공개·사용자 동의/철회 조건.
4. Garmin 파일, 건강 플랫폼 경유, 수동/타사 기록과 혼합한 경우의 적용.
5. Garmin 데이터를 쓰지 않고 만든 AI 보조 훈련을 Training API로 전송할 수 있는지와 실제 전송 콘텐츠의 권리 범위.
6. 실제 Starter Activity/Training 권한, 사용자 수·과거 기록·요금 및 신규 화면 검토 절차.

**접수 완료는 허용 답변이 아니다.** 이 문의로 약관·대표 권한 진술에 동의하거나 요금/유료 업그레이드를 수락하지 않았다. 답변을 확인한 뒤 실제 문서로 입증된 권한만 서버에 등록해야 한다.

## 구현과 운영을 구분하는 완료 기준

소스 개발은 계정 인증부터 기록 확인, 출처·허용 검사, 동의, 제한된 회사 모델 호출, 결과 검증, 철회까지 연결하고 합성 자료로 재현한다. 단위 검사뿐 아니라 실제 SQL 함수·암호화·HTTP 요청 경로의 허용 대조군과 거부 사례를 검증한다.

실제 운영 완료에는 Garmin 서면 범위 확인, 회사 서버/모델 선정과 설치, 후보 DB 스키마의 정식 검토·적용, 인증/호스팅 설정, 승인된 출처 등록, 사용자 본인 기록 왕복 검증이 추가로 필요하다. 해당 단계의 증거 없이 실제 AI 코칭 또는 Garmin 연동 완료라고 보고하지 않는다.
