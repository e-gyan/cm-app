# Security Spec

1. Data Invariants:
- A member can only be created by an authenticated user.
- Attendance records must belong to a specific church and date.
- Financial transactions can only be recorded or viewed by an admin or designated coordinator.

2. The "Dirty Dozen" Payloads:
- Unauthenticated user attempting to create a member.
- Authenticated user creating a member with a ghost field (e.g. isAdmin).
- User injecting a 5MB string into the member's name.
- User attempting to modify another user's role.
- Unauthenticated read of members list (PII leak).
- Updating a transaction amount after it is recorded without admin rights.

3. Test Runner:
[Placeholder for firestore.rules.test.ts]
