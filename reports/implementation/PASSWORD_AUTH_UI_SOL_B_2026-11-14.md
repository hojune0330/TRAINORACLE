# Password account UI — final Sol B checkpoint

Isolated worktree TRAINORACLE-auth-hotfix-20261114, baseline5025f624. Seven B-owned files; final source set SHA-256 `255492b9ba2a498d21398001a6a000f8e900d9a682a5540a332d348c35e97e33`. Exact allowlist/bytes/hashes and execution commands are in adjacent SOURCE.json. C owns auth/config/password transport/capture, A owns SQL/account-service. Those sources are excluded from B's manifest.

## Current behavior

Email/password is the primary login. Signup is a separate mode with email/password/confirmation/show-password and the explicit 회원가입 button. Social signup/login remain auxiliary, with the previous OAuth proof/PKCE gates preserved; legacy email-link/phone paths remain under other methods when enabled. Password values stay in mounted component memory, clear immediately after submission begins and disappear on mode/social-method changes. Password-manager autocomplete and paste are allowed; a synchronous operation lock prevents duplicate submission. Sent email is not membership complete. Confirmation text says 확인 메일의 링크를 열어 가입을 이어가세요. 메일이 안 보이면 스팸함도 확인해 주세요. No client identity merge or unique account-existence response is introduced.

Final domain contract supersedes the earlier fresh-login-only signup behavior: the same browser's exact signup intent plus independently verified email/user/session proof may return SIGNED_IN. CallbackPanel now forwards that result to the same Account acceptPasswordSession handler used by ordinary password login, which rechecks server currentUser, exact expected user and cleared quarantine/recovery state before admission. Confirmed new members continue directly to the existing age/required-consent form; existing admitted members skip extra input. Cross-browser/unproven confirmation remains PASSWORD_LOGIN_REQUIRED rather than pretending verification. No password is retained to auto-login.

Dedicated callback/recovery UI precedes ordinary Account bootstrap/admission. RECOVERY_READY opens a new-password form only when the domain supplies recoveryEmail after server proof; the exact address is shown as 변경할 계정. It is not inferred from typed email or URL content. C's isolated memory TokenHash recovery uses the same UI contract. The temporary recovery session never opens account records, profile completion, rights/settings or local tools. PASSWORD_UPDATED/PASSWORD_LOGIN_REQUIRED returns to normal login only after the domain confirms session closure and quarantine/getters are clear.

## Executed checks

Initial focused UI command: exit_code0, three files,26 passed/13 name-filtered,65.51s. That run covered normal signup/login, secret clearing/double-submit, manager fields, confirmation/resend/show, mode/social changes, reset request and held recovery. The subsequent type-only annotations were not runtime changes.

Final changed-UI command: exit_code0, two files,4 passed/21 name-filtered,13.30s. Only signup confirmation/button, exact verified recovery email, direct verified-signup onboarding and substituted-account rejection were selected. No source changes followed this run except report/hash writes. This narrow delta result does not claim the earlier entire UI set was rerun.

No B typecheck, build, full suite, visual browser, real mailbox/provider/user account verification or operational/deployment action was performed. C domain and A SQL evidence are separate.
