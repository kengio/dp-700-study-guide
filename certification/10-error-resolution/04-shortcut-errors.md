---
title: OneLake Shortcut Errors
type: topic
tags:
  - dp-700
  - fabric
  - error-resolution
  - onelake
  - shortcuts
  - onelake-security
  - delegated-authentication
---

# OneLake Shortcut Errors

## Overview

Shortcut errors are almost always **identity and permission** problems wearing a storage-error costume — a 403 that looks like a broken connection is usually a stale delegated credential, and a query that "just returns different data" between engines is usually a security-mode mismatch, not corruption. This topic covers shortcut authentication models, HTTP status semantics, cache staleness, transitive-shortcut limits, and how OneLake security interacts with — and sometimes silently diverges from — Spark, the SQL analytics endpoint, and semantic models.

> [!abstract]
>
> - Shortcuts use two authentication models: **passthrough** (the calling user's identity is passed to the target — default for OneLake-to-OneLake) and **delegated** (a configured connection identity is used instead — required for all external/multicloud shortcuts)
> - The classic exam scenario is **delegated-credential expiry or permission revocation at the producer**, which doesn't take effect immediately at the consumer — cached storage access tokens can remain valid for **30–60 minutes**
> - **401 vs. 403 vs. 404** map to different causes: authentication failure, authorization/permission denial, and a moved/deleted/renamed target, respectively
> - **Transitive shortcuts** (a shortcut pointing at another shortcut) are capped at a maximum of **5 direct shortcut-to-shortcut links**, and a single OneLake path supports at most **10 shortcuts**
> - **OneLake security interplay**: delegated mode **blocks** shortcut access entirely when the source table has RLS/CLS/OLS defined in OneLake security — this is by design, not a bug

> [!tip] What the Exam Tests
>
> - Diagnosing a shortcut access failure as passthrough vs. delegated, and knowing which permissions apply at which hop
> - Distinguishing 401 (auth), 403 (authorization), and 404 (target gone/moved) failure semantics
> - Recognizing cache-staleness windows (30–60 minutes for tokens, up to 5 minutes for OneLake security sync, up to 1 hour for cached query results) as the explanation for "it should be fixed but isn't yet"
> - Knowing why Spark and the SQL analytics endpoint can return **different rows for the same query** against a shortcut-backed table
> - Applying S3/ADLS-specific considerations (firewall, endpoint, caching support) when a cross-cloud shortcut fails

---

## Shortcut Authentication Models

| Shortcut type | Model | Notes |
| :--- | :--- | :--- |
| OneLake → OneLake | **Passthrough** (default) or delegated | Passthrough passes the calling user's identity straight to the target — the source system stays in full control of its own access rules |
| External (S3, ADLS, GCS, Blob, Dataverse, OneDrive/SharePoint) | **Delegated only** | Always uses an intermediate credential (another identity, service principal, or account key) — end users never need direct access to the external system |

In **passthrough** mode, OneLake uses the calling user's own identity to authorize access at the target — if that user doesn't have permission at the target, the shortcut denies them regardless of what permission they have at the shortcut path. In **delegated** mode, the shortcut accesses data through a configured connection identity, and the calling user sees the **intersection** of their own security and whatever security applies to the delegated identity — meaning a delegated shortcut can never grant a user *more* access than the delegated identity itself has, even if the user's own permissions would allow more.

> [!warning] Common Mistake
> Assuming Direct Lake or T-SQL always passes the calling user's identity through a shortcut. **Power BI semantic models using Direct Lake over SQL**, and **T-SQL engines in Delegated identity mode**, both use the **item owner's identity** instead of the end user's — OneLake security roles still filter what the end user sees, but the actual storage access happens as the owner. This exception is exactly why the same shortcut can behave differently depending on which engine and which identity mode is querying it.

## 401 vs. 403 vs. 404 Semantics

| Status | Meaning in a shortcut context | Typical root cause |
| :--- | :--- | :--- |
| **401 Unauthorized** | Authentication itself failed — no valid identity was established | Expired or missing token; malformed Authorization header; SAS token that's expired |
| **403 Forbidden** | Authentication succeeded, but the identity isn't authorized for this operation | Missing Fabric Read permission at the consumer; missing OneLake security Read at the target; `AuthorizationPermissionMismatch` from a revoked storage role; delegated identity lost access at the producer |
| **404 Not Found** | The target path no longer exists at the location the shortcut points to | Target file/folder/table deleted, renamed, or moved without updating the shortcut |

A shortcut query commonly surfaces 403 with messages like *"This request is not authorized to perform this operation using this permission"* or `AuthorizationPermissionMismatch`. If the message says something like *"The SELECT permission or external policy action... was denied on the object"*, that's usually a **user identity mode** Object ID mismatch (see below), not a storage-level permission gap.

> [!note] Mental model — 401 vs. 403 vs. 404
> **401** is a locked door with **no ID shown at all**. **403** is a locked door where you **showed valid ID, but it's not on the guest list**. **404** is the door **isn't even there anymore** — someone moved or tore down the room. Three very different fixes: get a valid credential, get added to the list, or find where the room went.

## Delegated Credential Expiry: The Classic Failure

The most exam-representative shortcut failure: a **delegated** shortcut (or a SQL analytics endpoint in delegated identity mode) keeps working *after* the producer revokes the item owner's access or narrows a OneLake security rule, because the consumer is running against a **cached storage access token** for the item owner — not re-checking permissions on every query.

| Permission layer changed | Propagation delay |
| :--- | :--- |
| SQL `GRANT`/`REVOKE` or a SQL security policy at the consumer | Applies on the **next query** — no cache delay |
| Item owner's OneLake permissions at the producer (shortcut-backed tables) | Cached storage token can remain valid **up to 30–60 minutes** |
| A new OneLake security role/filter created at the producer (affecting a shortcut source) | Only takes effect once the owner's storage token **refreshes** — same 30–60 minute window |
| OneLake security **role membership** changes at the producer | Not delayed by the consumer's token cache — takes effect on the normal sync path |

To force a faster refresh when the 30–60 minute wait is unacceptable: **pause and resume** the Fabric capacity hosting the artifact (safest, clears backend caches), or **switch the consumer endpoint to user identity mode and back to delegated mode** (invalidates cached tokens). Both actions drop existing SQL connections on any SQL analytics endpoints/warehouses in the affected workspace — a real operational tradeoff, not a free fix.

> [!warning] Common Mistake
> Treating "I revoked access but the user can still query the data" as a security bug to escalate immediately. In delegated mode this is **documented, expected caching behavior** — the fix is understanding the cache window (30–60 minutes) and, if needed, forcing a refresh via capacity pause/resume or a mode switch, not assuming OneLake security itself failed.

**Practice Question 1** *(Medium)*

An admin revokes a lakehouse owner's Read access at the producer workspace, expecting all shortcut-based access at consumer workspaces to stop immediately. Twenty minutes later, a consumer using a delegated shortcut to that lakehouse can still read the previously-visible data. What's the most likely explanation?

A. OneLake security roles take up to 24 hours to propagate across workspaces  
B. Delegated shortcuts ignore producer-side permission changes entirely and must be manually recreated  
C. The revocation only applies to Spark access, not SQL access  
D. The consumer's SQL analytics endpoint is caching the item owner's storage access token  

> [!success]- Answer
> **D. The consumer's SQL analytics endpoint is caching the item owner's storage access token**
>
> Delegated-mode shortcuts access OneLake using the item owner's cached storage access token rather than re-authorizing on every request, so a permission revocation at the producer doesn't take effect at the consumer until that cached token expires and is reissued — documented as up to 30–60 minutes after the permission change. There's no 24-hour propagation window (A), the caching behavior applies regardless of engine (C), and delegated shortcuts do eventually honor the change without manual recreation (B) — they just lag behind the change.

## S3 / ADLS-Specific Issues

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Shortcut to ADLS Gen2 fails with 403 despite correct-looking credentials | Missing **Storage Blob Data Reader/Contributor** role assignment on the target storage account for the delegated identity/service principal | Assign the correct role in Azure IAM on the storage account, not just at the Fabric connection level |
| S3/GCS shortcut works initially, then fails after a source-side key rotation | The cloud connection's stored credential (account key, access key) hasn't been updated after rotation | Update the connection's credential; only users with permission on the connection can rebind it |
| Cross-cloud shortcut is slow or times out | Firewall rules on the external storage account/bucket blocking the Fabric-side egress IP ranges, or an incorrectly scoped endpoint (`.blob` vs. `.dfs` for ADLS Gen2) | Allow Fabric's published IP ranges/service tags; use the `.blob` endpoint for ADLS Gen2 when `.dfs`-specific features aren't required, since it currently yields the best performance |
| Creating a new S3/ADLS shortcut fails with "no permission on connection" | The creating user doesn't have permission on the underlying **cloud connection** object, separate from workspace/item permissions | Grant the user permission on the specific connection, or have a connection-permitted user create the shortcut |

## Cache Staleness Beyond Credentials

Shortcut **file caching** (distinct from the credential-token caching above) reduces cross-cloud egress cost: OneLake stores files read through an external shortcut in a per-workspace cache with a configurable **1–28 day retention period**, reset on every access; files over 1 GB aren't cached. Caching currently supports **Google Cloud Storage, S3, S3-compatible, and on-premises data gateway** shortcuts. If the remote source has a newer version of a cached file, OneLake detects this and serves the fresh copy, updating the cache — so caching doesn't cause silently stale *data*, only silently stale *tokens* (covered above) and, separately, briefly stale **query results**: switching between user identity and delegated mode can return cached query results based on the previous security state for up to **1 hour**.

## Transitive Shortcuts and Cross-Region Notes

A **transitive shortcut** is a shortcut whose target is itself another shortcut. Fabric caps this chaining: ==the maximum number of direct shortcuts to shortcut links is 5==, and a single OneLake path supports at most **10 shortcuts** pointing at it. Renaming, moving, or deleting a shortcut *target* can break every shortcut downstream in the chain — and because shortcuts don't support cascading deletes, deleting a shortcut object itself never touches the target data, only the pointer.

Cross-region access through a shortcut works but adds latency proportional to the physical distance between the capacity and the target storage; there's no documented hard limit forcing same-region shortcuts, but query performance degrades with distance — see [11-Performance Optimization](../11-performance-optimization/performance-optimization.md) for tuning guidance once a cross-region shortcut is confirmed to be the bottleneck rather than an error.

> [!note] Mental model — transitive shortcuts
> A transitive shortcut is a **relay race baton pass**. Each shortcut hands off to the next, and the platform limits the relay to **5 handoffs** before it refuses to add another leg — beyond that, chase down the original source and shortcut directly to it instead of extending the chain further.

## OneLake Security Interplay: Delegated Mode Blocks Data-Level Rules

The single highest-yield exam fact in this section: **in delegated mode, a shortcut is blocked outright if the source table has Row-Level Security (RLS), Column-Level Security (CLS), or Object-Level Security (OLS) defined in OneLake security.** This is intentional — it prevents an item owner's delegated identity from silently surfacing filtered data to unauthorized end users through a shortcut that bypasses the intended filtering.

| Scenario | Behavior | Resolution |
| :--- | :--- | :--- |
| Source table has OneLake-level RLS/CLS/OLS; consumer shortcut is in delegated mode | Shortcut query fails | Switch the consumer endpoint to **user identity mode** so the end user's identity is evaluated against the source's rules directly, or remove the OneLake-level rules and reimplement equivalent filtering in SQL (RLS/CLS/DDM) at the consumer |
| Same query, run once through Spark and once through the SQL analytics endpoint in delegated mode | Different row counts/values — Spark enforces OneLake security; delegated-mode SQL doesn't | Switch the endpoint to user identity mode to align results, or replicate the filtering in SQL constructs at the SQL layer |
| Multiple OneLake security roles apply to the same user on one table, one restrictive (RLS) and one permissive (full access) | The **most permissive role wins** — RLS appears not to apply | Keep restrictive and permissive roles mutually exclusive per user/group if RLS enforcement is required |
| Data reached through a shortcut from a Warehouse with SQL-level RLS/CLS | Warehouse SQL security constructs are enforced only in the Warehouse's own SQL execution context (TDS endpoint) — they don't translate into OneLake security policies for shortcut access | Apply equivalent OneLake security rules directly at the source lakehouse, or restrict access to the shortcut consumer |

> [!warning] Common Mistake
> Debugging "my shortcut query returns nothing in delegated mode" as a broken connection. If the source table has any OneLake-level RLS/CLS/OLS, delegated mode **denies the shortcut entirely by design** — there's no partial or filtered result to expect. Check for data-level rules at the source before investigating connectivity, credentials, or the target path.

**Practice Question 2** *(Medium)*

A data engineer queries the same shortcut-backed table twice — once from a Spark notebook, once through the SQL analytics endpoint (confirmed to be in **delegated identity mode**) — and gets different row counts. RLS is defined on the source table in OneLake security. What explains the discrepancy, and what's the fix?

A. The SQL analytics endpoint has a caching bug; clear the cache to resolve it  
B. Delegated identity mode doesn't honor OneLake security roles, so RLS isn't applied through SQL  
C. Spark and SQL analytics endpoints always return different row counts for shortcut-backed tables by design  
D. The shortcut target was moved between the two queries, causing a 404 on one of them  

> [!success]- Answer
> **B. Delegated identity mode doesn't honor OneLake security roles, so RLS isn't applied through SQL**
>
> Spark always enforces OneLake security, but a SQL analytics endpoint running in delegated identity mode does not — it uses the item owner's identity and doesn't evaluate the caller against RLS rules, producing a broader (unfiltered) result set than Spark's; switching the endpoint to user identity mode aligns the two. There's no caching bug (A), the divergence is specific to delegated mode rather than universal (C), and a moved target would produce a 404 error rather than a quietly different row count (D).

## Diagnosing Across Engines

When the same shortcut behaves differently across surfaces, check in this order:

1. **Access mode** — open the SQL analytics endpoint's **Security** tab → **View data access mode** to confirm delegated vs. user identity mode before investigating further
2. **OneLake security sync status** — in Object Explorer, expand **Security → Roles → Database Roles** and look for `OLS_`-prefixed roles; sync can lag up to 5 minutes, and a broken policy reference (a renamed/dropped column referenced by an RLS/CLS rule) can stall sync indefinitely until fixed
3. **Object ID match** — in user identity mode, the identity referenced in the OneLake security role must be **directly** granted Fabric Read at the consumer; nested/effective group membership across the producer→consumer boundary is not resolved
4. **Semantic model mode** — Direct Lake over SQL uses the delegated/owner path; Direct Lake over OneLake passes the calling user through directly — the same discrepancy pattern as Spark vs. delegated SQL applies here too

**Practice Question 3** *(Easy)*

A schema-enabled lakehouse has a shortcut in the `Tables` folder pointing at an ADLS Gen2 location, and a second shortcut is created pointing at the *first* shortcut to expose the same data from another lakehouse. A colleague proposes extending this pattern five more times to reach six total hops. What should you tell them?

A. Fabric caps direct shortcut-to-shortcut links at 5 — a sixth hop will fail; shortcut directly to the original ADLS location instead  
B. There's no limit on shortcut chaining, so this is fine  
C. Transitive shortcuts are unsupported entirely; only one level of shortcut is ever allowed  
D. The limit only applies to external shortcuts, not OneLake-to-OneLake shortcuts, so six hops of OneLake-to-OneLake shortcuts is fine  

> [!success]- Answer
> **A. Fabric caps direct shortcut-to-shortcut links at 5 — a sixth hop will fail; shortcut directly to the original ADLS location instead**
>
> OneLake documents a hard limit of 5 direct shortcut-to-shortcut links; transitive shortcuts are supported up to that cap (ruling out C), but there is a limit (ruling out B), and the cap isn't restricted to external-only chains (ruling out D). The practical fix once a chain gets long is to shortcut directly to the original source rather than continuing to extend the relay.

## Symptom → Likely Cause

| Symptom | Most likely cause | Where to check first |
| :--- | :--- | :--- |
| Shortcut worked yesterday, now returns 404 | Target file/folder/table renamed, moved, or deleted at the source | Confirm the target path still exists at the source system |
| Shortcut returns 403 despite the connection looking correctly configured | Missing Storage Blob Data role at the storage-account level, separate from the Fabric connection | Azure IAM role assignments on the target storage account |
| Revoked access "still works" for a while | Delegated-mode cached storage token hasn't expired | Wait out the 30–60 minute window, or force a refresh |
| Query against a shortcut returns fewer rows than expected in Spark but full rows via SQL | SQL analytics endpoint is in delegated mode and isn't honoring OneLake RLS | Endpoint's Security tab → View data access mode |
| Shortcut creation fails even though the user has Contributor on the workspace | Missing permission on the underlying cloud connection object | Connection-level permissions, not workspace role |

## Same Root Cause, Different Error Per Engine

Because Spark, the SQL analytics endpoint, and Direct Lake semantic models each evaluate shortcut security differently, the *same* underlying producer-side change can surface as a different symptom depending on which engine is queried:

| Underlying change at the producer | Symptom in Spark | Symptom in SQL analytics endpoint (delegated) | Symptom in Direct Lake over SQL |
| :--- | :--- | :--- | :--- |
| RLS/CLS/OLS added to the source table | Query correctly filtered per the caller's identity | Query fails outright (shortcut blocked in delegated mode) | Uses the owner's identity — filtering may not match the caller's own access |
| Owner's OneLake permission revoked | Immediate 403 for any caller relying on that path | Continues to succeed until the cached token expires (30–60 min) | Same caching lag as the SQL delegated path |
| Target renamed/moved | 404 / path-not-found immediately | 404, or up to 5 minutes of "single-user mode" blocking queries while the system validates the new target | Requires a semantic model refresh to pick up the new target |

Use this table as a diagnostic shortcut: if a symptom is inconsistent across engines, suspect a security **mode** difference (delegated vs. user identity, or which identity is doing the reading) before suspecting the shortcut itself is broken.

## Use Cases

- Explaining why a revoked producer permission doesn't immediately block consumer access through a delegated shortcut
- Triaging a shortcut 403 as a missing Storage Blob Data role assignment vs. a OneLake security gap vs. a stale cached token
- Diagnosing divergent query results between Spark and a delegated-mode SQL analytics endpoint against the same shortcut-backed, RLS-protected table
- Recognizing a transitive-shortcut chain has hit its 5-hop limit and redirecting to a direct shortcut instead
- Choosing between forcing a token refresh (capacity pause/resume, mode toggle) and simply waiting out the 30–60 minute cache window

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| Revoked producer access still works at the consumer for up to an hour | Delegated mode's cached storage access token hasn't expired yet | Wait for the 30–60 minute window, or force refresh via capacity pause/resume or a mode toggle (drops existing SQL connections) |
| Shortcut query fails outright in delegated mode with no obvious connectivity problem | Source table has RLS/CLS/OLS defined in OneLake security — delegated mode blocks this by design | Switch to user identity mode, or remove OneLake-level rules and reimplement filtering in SQL at the consumer |
| Same query returns different rows in Spark vs. SQL analytics endpoint | Delegated identity mode doesn't honor OneLake security roles | Switch the endpoint to user identity mode, or replicate filtering with SQL RLS/CLS/DDM |
| User in a OneLake security role still gets "no permission on the artifact" | Nested/effective group membership isn't resolved across the producer→consumer boundary; the exact Object ID must be granted Fabric Read directly at the consumer | Grant the specific user or group (not an individual group member) Fabric Read directly on the consumer item |
| New S3/ADLS shortcut creation fails with a permission error despite correct workspace role | Creating user lacks permission on the underlying cloud **connection** object | Grant connection-level permission, or have a permitted user create the shortcut |

## Best Practices

- Default to **user identity mode** for SQL analytics endpoints whenever OneLake security (RLS/CLS/OLS) must be enforced consistently across engines
- Document the 30–60 minute delegated-token cache window in incident runbooks so a "still visible after revocation" report isn't treated as a security breach by default
- Keep restrictive and permissive OneLake security roles mutually exclusive per principal — the most-permissive-wins behavior otherwise silently defeats RLS
- Avoid building transitive-shortcut chains beyond 2–3 hops even though the platform allows up to 5 — shorter chains are easier to diagnose when a target moves
- Script out inline metadata objects (TVFs, scalar functions) and SQL roles before switching a SQL analytics endpoint between user identity and delegated mode — both are dropped on a mode switch

## Exam Tips

> [!tip] Exam Tips
>
> - **Passthrough** = calling user's identity to the target (OneLake-to-OneLake default); **delegated** = configured connection identity, required for all external shortcuts
> - **401** = no valid auth; **403** = authenticated but not authorized; **404** = target moved/renamed/deleted
> - Delegated credential cache window: **30–60 minutes** for storage tokens; OneLake security sync: **up to 5 minutes**; cached query results across a mode switch: **up to 1 hour**
> - Transitive shortcuts: max **5** direct shortcut-to-shortcut links; max **10** shortcuts per single OneLake path
> - **Delegated mode blocks shortcuts to sources with RLS/CLS/OLS** in OneLake security — by design, not a bug
> - Direct Lake over SQL / T-SQL delegated mode = **item owner's identity**, not the calling user's — the classic Spark-vs-SQL row-count mismatch

## Key Takeaways

- Most shortcut "connectivity" failures are actually identity/permission problems — check auth mode and cached-token timing before chasing network causes
- 401/403/404 map to distinct fixes; don't treat all three as generic "access denied"
- Delegated mode's caching (tokens up to 30–60 min, sync up to 5 min, query results up to 1 hour) explains most "should be fixed but isn't yet" tickets
- OneLake security's RLS/CLS/OLS enforcement diverges by engine and mode — Spark always enforces it, delegated-mode SQL never does, user-identity-mode SQL does
- Transitive-shortcut and per-path shortcut limits (5 hops, 10 shortcuts per path) are hard caps worth memorizing verbatim for the exam

## Related Topics

- [01-Fabric Workspace Settings: OneLake Settings](../01-fabric-workspace-settings/03-onelake-settings.md)
- [03-Security & Governance: OneLake Security](../03-security-governance/03-onelake-security.md)
- [06-Batch Ingestion: OneLake Shortcuts](../06-batch-ingestion/02-onelake-shortcuts.md)
- [03-Real-Time Errors](./03-realtime-errors.md)
- [11-Performance Optimization](../11-performance-optimization/performance-optimization.md)

## Official Documentation

- [Secure and manage OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcut-security)
- [Unify data sources with OneLake shortcuts](https://learn.microsoft.com/en-us/fabric/onelake/onelake-shortcuts)
- [Troubleshoot OneLake security for SQL analytics endpoints](https://learn.microsoft.com/en-us/fabric/onelake/security/troubleshoot-onelake-security-for-sql-analytics-endpoints)
- [Troubleshoot permission and capacity errors in Data Engineering](https://learn.microsoft.com/en-us/fabric/data-engineering/troubleshoot-permissions-capacity)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./03-realtime-errors.md) | [↑ Back to Section](./error-resolution.md) | [Next →](../11-performance-optimization/performance-optimization.md)**
