# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Identity Integrity**: A user may only create `/users/{userId}` where `userId == request.auth.uid` and `incoming().uid == request.auth.uid`.
2. **Privilege Escalation Prevention**: Non-admin users MUST create profiles with `role == 'student'`, `membershipStatus == 'free'`, `membershipPlan == 'none'`, `membershipExpiresAt == ''`, `subscribedLessonIds == []`, and empty optional course/practice entitlement lists (`subscribedCourses`, `practiceLessonIds`, `practiceCourses`), and may NEVER mutate those fields on update.
3. **PII Isolation**: `/users/{userId}` contains PII (`email`, `phoneNumber`, `dob`). Single-document `get` is restricted to `isOwner(userId) || isAdmin()`. Collection `list` is restricted solely to verified admins.
4. **Subscription Request Integrity**: A `/subscriptionRequests/{requestId}` document requires an existing `/users/{request.auth.uid}` profile (`exists(...)`), must have `userId == request.auth.uid`, `status == 'pending'`, and `adminNote == ''` at creation.
5. **Terminal State Locking**: Once a subscription request moves to `approved` or `rejected`, non-admin owners can no longer edit or delete it. Only verified admins may update `status` and `adminNote`.
6. **Admin Verification (Anti-Email Spoofing)**: Token-based admin checks (`syndkyaw@gmail.com`) strictly enforce `request.auth.token.email_verified == true`.
7. **Catalog Integrity**: Only verified admins can create, update, or delete `/lessonCatalog/{lessonId}` pricing records.
8. **User Progress Ownership**: `/userProgress/{userId}` stores authenticated learner streak, completed lessons, and daily reminder settings. Only `isOwner(userId) || isAdmin()` may read or write a user's progress doc, with bounded list sizes (`streakDates <= 366`, `completedLessonIds <= 200`), strict time strings, and server-validated `updatedAt == request.time`.
9. **Site Content, Branding & Worker Bootstrap Integrity**: `/siteConfig/{configId}` stores homepage copy, `siteLogoUrl` (max 2000 chars), `workerApiBaseUrl` (max 300 chars), section headers, course pricing maps, Contact Us details, and featured showcase IDs. Publicly readable, but only verified admins (`isAdmin()`) may create, update, or delete records, with strict schema/size bounds and `updatedBy == request.auth.uid`.

## 2. The "Dirty Dozen+" Attack Payloads (All Must Fail with `PERMISSION_DENIED`)
1. **Self-Role Escalation**: Student creates `/users/{uid}` with `"role": "admin"`.
2. **Free Membership Injection**: Student creates `/users/{uid}` with `"membershipStatus": "active"`, `"membershipPlan": "annual"`, or non-empty `subscribedCourses` / `practiceCourses`.
3. **Membership Hijack Update**: Student updates own `/users/{uid}` adding `"hsk2-01"` to `subscribedLessonIds`, `practiceLessonIds`, `subscribedCourses`, or `practiceCourses`.
4. **Shadow Field Injection**: Student updates `/users/{uid}` or `/userProgress/{uid}` with extra ghost key `"isVerified": true`.
5. **PII & Progress Cross-Read Attack**: Authenticated User A attempts `get(/users/{userB})`, `get(/userProgress/{userB})`, or `list(/users)`.
6. **Spoofed Admin Email**: Unverified token (`email: "syndkyaw@gmail.com", email_verified: false`) attempts `list(/users)` or `approve` request.
7. **Request Identity Spoofing**: User A creates `/subscriptionRequests/req1` with `"userId": "userB"`.
8. **Auto-Approve Bypass**: User A creates `/subscriptionRequests/req1` with `"status": "approved"`.
9. **Post-Approval Tampering**: User A updates a previously `approved` or `rejected` request note or status.
10. **Orphan Request Creation**: Unregistered UID without `/users/{uid}` doc attempts to create `/subscriptionRequests/req1`.
11. **ID Poisoning Attack**: User creates doc with 500-char or invalid-character ID (`"req/../admin"`).
12. **Unauthorized Catalog Mutation**: Non-admin student attempts to set `/lessonCatalog/hsk2-01` to `"accessType": "free"`.
13. **Unauthorized Site Config / Logo / Worker Hijack**: Non-admin student or anonymous user attempts to overwrite `/siteConfig/homepage` `siteLogoUrl`, `workerApiBaseUrl`, contact email, or hero text.
