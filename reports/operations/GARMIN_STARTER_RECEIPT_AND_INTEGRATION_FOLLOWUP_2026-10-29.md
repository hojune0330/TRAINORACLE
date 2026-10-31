# Garmin Starter 신청 접수 및 시계 연동 후속 상태

확인일: 2026-10-29 (KST)

## 실제 완료
- 사용자의 제출 지시에 따라 공식 Business Starter 신청서를 제출했다.
- 양식의 접수 완료 및 추후 연락 안내를 확인했다. 새 티켓번호는 화면에 표시되지 않았다.
- Activity API / Training API, 향후 12개월 예상 연결 100-1000 구간이다. 정확히 1,000명은 사용자 전망이며 실제 이용자 수가 아니다.
- 기존 신청 초안의 무료 베타·향후 가격 미정·Supabase 처리 예정·외부 생성형 AI 전송 제외 범위를 유지했다. 이는 신청 계획이며 구현 완료나 별도 사업정책 확정의 증거가 아니다.
- 공개 상태 endpoint의 접수 근거/확인일을 갱신하고 실제 HTTP 200 응답을 대조했다.
- 사용자 연결은 false, 수신은 FAIL_CLOSED로 유지했다. 기존 사용자 기록·계정 공개·데이터 수신 설정은 변경하지 않았다.

## 접수와 승인 구분
신규 접수는 심사 재개·승인·API 자격증명 발급·실제 OAuth 왕복을 의미하지 않는다. 10월 16일 중단 회신과 이번 새 양식 접수 사실을 구분한다. 과거 메일만으로 지금도 신청 불가라고 단정하지 않는다.

## 후속 구현 후보
- COROS MCP: 별도 OAuth lifecycle / 기본 OFF / 주입 저장소 계약. 실제 DCR·사용자 동의·암호화 DB·HTTP handler·확인함 UI는 미완료.
- WHOOP: 운동 읽기 OAuth lifecycle. 실제 로그인·앱 등록·secret vault·암호화 DB·HTTP handler·확인함 UI는 미완료.
- Apple Health / Health Connect: 별도 모바일 저장소의 읽기 브리지와 명시적 opt-in 후보 빌드. 네이티브 컴파일·실기기·사용자 확인 후 저장은 별도 검증 대상이다.
- Samsung Health 자료는 해당 앱이 Health Connect에 실제 공유한 범위만 대상으로 하며 Samsung 전용 SDK의 모든 데이터 연동이 아니다.

## 공개 차단
제공자 자격·데이터 주체 권한·연결 세대/계정 격리·암호화 보관·철회/삭제·수동 확인·공개 보안 게이트를 모두 검증하기 전 자동 연동을 켜지 않는다. 추가 합성시험은 전체 소스 CI·실 OAuth·실제 운동 수신 성공과 다르다.

공식 신청: https://www.garmin.com/en-US/forms/StarterGarminConnectDeveloperAccess/
상태: https://texspxlpjungyarkvtkc.supabase.co/functions/v1/device-integration-status
