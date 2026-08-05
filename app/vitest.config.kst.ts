// KST 전용 테스트 설정.
//
// 왜 이 파일이 따로 있는가:
//  날짜 계산 회귀 중에는 **UTC에서 원리적으로 안 잡히는** 것이 있다.
//  `dates.ts`의 `isoToDate`를 `new Date(iso)`(UTC 파싱)로 바꾸는 결함을
//  주입해 실제로 확인했다:
//    TZ=UTC              -> 통과 (UTC 자정 == 로컬 자정이라 결과가 동일)
//    TZ=Asia/Seoul       -> 실패
//    TZ=America/New_York -> 실패
//  GitHub 러너는 UTC다. 즉 기본 설정만으로는 이 회귀가 main까지 들어온다.
//  사용자는 KST에서 쓰는데, 하루가 밀리면 일지가 다른 주에 붙어 주간
//  합계가 조용히 틀어진다.
//
// 왜 기본 vitest.config.ts에 TZ를 박지 않았는가:
//  설정 파일에 박으면 개발자 로컬 시간대까지 덮어써서, 각자 실제 환경에서
//  뭐가 깨지는지 못 보게 된다. "UTC 한 번 + KST 한 번" 두 번 도는 편이
//  실제 커버리지가 넓다. `npm test`가 둘 다 돌린다.
//
// 왜 cross-env를 안 쓰는가:
//  의존성을 하나 늘리는 대신 vitest의 `-c`(설정 파일 지정)로 해결했다.
//  설치물이 안 늘어나는 쪽이 안전하다.
import base from "./vitest.config"

process.env.TZ = "Asia/Seoul"

export default base
