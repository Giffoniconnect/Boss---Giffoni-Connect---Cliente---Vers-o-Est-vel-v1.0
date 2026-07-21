# Security Specification - BOSS Giffoni Connect

## 1. Data Invariants
- A client must have a unique slug.
- A client portal link (slug mapping) must point to a valid client ID.
- Cases, documents, and invoices must point to a valid client ID.
- Access to client data in the portal is restricted to users with the 'client' role whose `clientId` matches the resource's `clientId`.
- Only 'boss_admin' can create or modify client structural data.
- 'client' role users can ONLY read data where `visibleToClient` is true.

## 2. The "Dirty Dozen" Payloads (Denial Expected)
1. **Client Spoofing**: User A (client) tries to read `clients/{clientIdB}`.
2. **Admin Escalation**: User A (client) tries to update their own role in `users/{uid}` to `boss_admin`.
3. **Ghost Field**: Admin tries to create a client with an undocumented field `isSuperVip: true` (if strict schema is enforced).
4. **Invalid Slug**: Admin tries to create a client with slug `!!!invalid!!!`.
5. **Unauthorized Case Read**: User A (client) tries to read a case where `visibleToClient` is `false`.
6. **Cross-Client Access**: User A (client) tries to read a document belonging to `clientIdB` even if `visibleToClient` is `true`.
7. **Identity Poisoning**: Hacker tries to use a 2KB string as a document ID.
8. **Orphaned Case**: Creating a case for a non-existent `clientId`.
9. **Bypassing Visibility**: Client tries to list ALL cases without the `visibleToClient` filter.
10. **Admin Lockout**: Client tries to delete the admin record (if rules allow).
11. **Timestamp Spoofing**: Client tries to set `createdAt` to a date in the past.
12. **Slug Hijacking**: Trying to create a `clientPortals` entry for an existing slug pointing to a different client.

## 3. Test Runner Definition
(This would be implemented in `firestore.rules.test.ts` using the Firebase Rules Unit Testing library).
