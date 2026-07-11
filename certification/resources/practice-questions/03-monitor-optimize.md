---
title: "Practice Questions: Monitor and Optimize an Analytics Solution"
type: practice-questions
tags:
  - dp-700
  - practice-questions
  - monitor-optimize
---

# Practice Questions: Monitor and Optimize an Analytics Solution

Domain 3 covers 30–35% of the DP-700 exam and spans three sections: monitoring & alerting, error resolution, and performance optimization. Most of these 27 questions are scenario-driven — a symptom, a monitoring surface, an error code, or a performance trap — because that's how the exam actually tests this domain: less "define the term," more "given what you're seeing, what do you do next." A handful walk the full monitor → diagnose → optimize chain in one question, mirroring [09-Monitoring & Alerting's Triage Spine](../../09-monitoring-alerting/monitoring-alerting.md#the-domain-3-triage-spine-symptom--surface--diagnosis--lever). None of them repeat the inline practice questions already embedded in the topic files, so treat a miss here as a signal to go re-read the linked section.

---

## Question 1: Looking for a Dataflow Gen1 Refresh in Monitor Hub

**Question** *(Easy)*:

A workspace admin filters Monitor hub's Activities view by every available Item type trying to find a legacy Dataflow Gen1's refresh status, but it never appears — even though the dataflow refreshed successfully an hour ago. What explains this, and where should the admin look instead?

A. Dataflow Gen1 isn't one of Monitor hub's 17 covered item types — check the dataflow's own refresh history or notifications instead  
B. Monitor hub only shows the last 100 rows from the past 30 days, and this run is outside that window  
C. The admin lacks the Contributor workspace role, which hides certain item types from Monitor hub  
D. Dataflow Gen1 items only appear in Monitor hub after being migrated to Dataflow Gen2  

> [!success]- Answer
> **A. Dataflow Gen1 isn't one of Monitor hub's 17 covered item types — check the dataflow's own refresh history or notifications instead**
>
> Monitor hub's Activities page covers 17 item types, and Dataflow Gen1 is explicitly excluded — no filter combination will surface it, because it was never tracked there in the first place.
>
> Option B invents a retention explanation that doesn't fit — the run happened an hour ago, well inside the 30-day window. Option C invents a role-based hiding behavior that isn't documented; Monitor hub visibility depends on item permissions, not a blanket role gate on entire item types. Option D invents a migration requirement that doesn't exist — Dataflow Gen1 simply never appears, migrated or not.

---

## Question 2: A Direct Lake Dashboard That Slows Down After a Large Append

**Question** *(Medium)*:

Immediately after a 200 GB append lands in a lakehouse table feeding a Direct Lake report, users notice dashboard queries have gotten noticeably slower — not broken, just slower. What's the correct sequence: what do you check first to confirm what's actually happening, what's the likely diagnosis, and what's the performance lever if the table turns out to be healthy but under-optimized?

A. Assume the DirectQuery fallback is the cause without checking anything, and switch the model to Import mode  
B. Check the semantic model's refresh history Direct Lake tab to confirm reframing has run since the append and the table hasn't fallen back to DirectQuery; if it's genuinely healthy but slow, apply V-Order (and `OPTIMIZE`) to the newly appended files for faster cold-cache reads  
C. Open the Capacity Metrics app first, since any large data append is inherently a capacity-wide event  
D. Assume query folding was lost during the append and redesign the Dataflow Gen2 query  

> [!success]- Answer
> **B. Check the semantic model's refresh history Direct Lake tab to confirm reframing has run since the append and the table hasn't fallen back to DirectQuery; if it's genuinely healthy but slow, apply V-Order (and OPTIMIZE) to the newly appended files for faster cold-cache reads**
>
> This is the monitor → diagnose → optimize chain in miniature: confirm via the refresh history's Direct Lake tab (and `EVALUATE TABLETRAITS()` if needed) that the model actually reframed and isn't silently falling back to DirectQuery, and only once that's ruled out reach for a performance lever — V-Order trades write cost for the read-side compression and cold-cache speedup that a large, un-V-Ordered append specifically lacks.
>
> Option A skips the diagnostic step entirely and proposes a disproportionate architectural change (a full Import-mode migration) before confirming the actual cause. Option C jumps to a capacity-wide surface for what's described as a single item's symptom, not a scattered, capacity-wide one. Option D reaches for a Dataflow Gen2-specific performance concept (query folding) that has nothing to do with a Spark-written lakehouse append feeding Direct Lake.

---

## Question 3: Alerting on a Warehouse Threshold Without a Streaming Source

**Question** *(Medium)*:

A finance team wants an alert when a specific aggregate value in a Fabric Warehouse table crosses a threshold. There's no eventstream involved — just a value in a table that changes periodically. Which Activator alert source fits, and what's the mistake to avoid?

A. Create the alert directly against the SQL analytics endpoint, since Activator can query any SQL surface live  
B. Route it through the Capacity Metrics app, since it already tracks warehouse-level compute  
C. Use the Fabric Data Warehouse SQL query results source (preview), which evaluates a query on a schedule and triggers on the result — don't attempt to alert from the SQL analytics endpoint directly, which isn't a supported source  
D. Build a KQL queryset against the warehouse table, since KQL querysets can target any Fabric data store including Warehouse tables  

> [!success]- Answer
> **C. Use the Fabric Data Warehouse SQL query results source (preview), which evaluates a query on a schedule and triggers on the result — don't attempt to alert from the SQL analytics endpoint directly, which isn't a supported source**
>
> The Warehouse SQL query (preview) mechanism exists precisely for this case — alerting on warehouse data on a schedule without a streaming source — while creating alerts directly from a SQL analytics endpoint is explicitly unsupported and a documented distractor.
>
> Option A names the one alert source the guide explicitly flags as unsupported. Option B misapplies the Capacity Metrics app, which can't fire alerts at all regardless of source. Option D misapplies KQL querysets, which are scoped to KQL/Eventhouse data, not arbitrary Warehouse tables.

---

## Question 4: What Activator Can Actually Do When a Rule Fires

**Question** *(Easy)*:

A team wants a single Activator rule to both notify the on-call engineer in Teams and automatically trigger a remediation notebook when a condition is met, without maintaining two separate rules. Is this a valid single-rule configuration?

A. No — a rule can take exactly one action; two separate rules are required for notify-plus-remediate  
B. No — running a Fabric item as an action requires a dedicated, separate Activator item  
C. Yes, but only if the notification action is listed first in the rule's action order  
D. Yes — a single rule can combine multiple actions, such as a Teams notification and running a Fabric item (notebook, pipeline, SJD, dataflow, UDF, or copy job)  

> [!success]- Answer
> **D. Yes — a single rule can combine multiple actions, such as a Teams notification and running a Fabric item (notebook, pipeline, SJD, dataflow, UDF, or copy job)**
>
> A single rule can be configured to take more than one action when a scenario calls for it — notify and remediate on the same rule is a documented, common pattern.
>
> Option A invents a one-action-per-rule limit that doesn't exist. Option B invents a separation requirement between notification actions and Fabric-item actions that isn't documented. Option C invents an action-ordering constraint with no basis in how Activator rules are configured.

---

## Question 5: Getting Paged Before the Capacity Throttles

**Question** *(Medium)*:

A capacity administrator wants to be notified automatically the moment a capacity approaches a throttling state, instead of checking the Capacity Metrics app manually every morning. What's the correct approach?

A. Set an Activator alert on Fabric capacity overview events in Real-Time hub  
B. Configure an alert directly inside the Capacity Metrics app's Health page  
C. Enable workspace monitoring and build an Activator rule against the `ItemJobEventLogs` table  
D. Schedule the Capacity Metrics app's own semantic model to email a status screenshot daily  

> [!success]- Answer
> **A. Set an Activator alert on Fabric capacity overview events in Real-Time hub**
>
> The Capacity Metrics app can't fire alerts on its own — capacity-condition alerting is explicitly routed through Fabric capacity overview events in Real-Time hub instead.
>
> Option B names an action the Capacity Metrics app doesn't support at all. Option C misapplies `ItemJobEventLogs`, which tracks pipeline/item job events, not capacity-wide throttling conditions. Option D invents an automated-screenshot mechanism that doesn't exist and wouldn't be proactive even if it did.

---

## Question 6: Cancelling a Refresh That's Run Too Long

**Question** *(Medium)*:

A large semantic model's refresh has been running far longer than usual, and the team wants to stop it immediately rather than wait for a timeout. The refresh was started from the portal's manual **Refresh** button, not the enhanced refresh API. What happens if they call `DELETE` on a `requestId` for this refresh?

A. The refresh cancels immediately — `DELETE` works on any in-progress refresh regardless of how it was triggered  
B. `DELETE` only cancels refreshes that were themselves triggered via the enhanced refresh API — a portal-triggered refresh has to run to completion or timeout instead  
C. `DELETE` cancels the refresh but leaves the semantic model permanently locked until a capacity restart  
D. `DELETE` first requires switching the model to Direct Lake mode before it will accept a cancellation request  

> [!success]- Answer
> **B. DELETE only cancels refreshes that were themselves triggered via the enhanced refresh API — a portal-triggered refresh has to run to completion or timeout instead**
>
> Refresh cancellation via `DELETE /refreshes/{requestId}` is scoped to refreshes started through the enhanced refresh API itself — a standard portal-button refresh can't be cancelled this way, only let run to completion or timeout.
>
> Option A overstates what `DELETE` can cancel. Option C invents a permanent-lock consequence that isn't documented. Option D invents a Direct Lake precondition for cancellation that has nothing to do with the actual limitation, which is about trigger source, not storage mode.

---

## Question 7: Avoiding Alert Spam on a Flapping Sensor

**Question** *(Hard)*:

A logistics team's Activator rule emails the team every time a vehicle's speed reading exceeds 120 km/h. During one trip, the reading hovers near the threshold and crosses it a dozen times in ten minutes, generating a dozen separate emails. The team wants exactly one alert per genuine "went too fast" episode, resetting only once the speed drops back to normal. What's the fix?

A. Lower the email rate limit on the action so excess sends are silently dropped during a flapping episode  
B. Add a heartbeat/absence-of-data condition in place of the threshold condition  
C. Switch to a stateful condition using `BECOMES`, so the rule fires only on the transition into the over-threshold state rather than on every qualifying event  
D. Move the rule from an Eventstreams source to a KQL queryset with a 5-minute check frequency  

> [!success]- Answer
> **C. Switch to a stateful condition using BECOMES, so the rule fires only on the transition into the over-threshold state rather than on every qualifying event**
>
> `BECOMES` is exactly the transition-only vocabulary Activator provides for this: it fires once on entry into the "too fast" state and stays quiet until a transition back to normal and a subsequent re-entry, which is precisely the "one alert per episode" behavior the team wants — this is the same state-transition mechanism that keeps a threshold breach from spamming one alert per incoming event.
>
> Option A treats rate-limit throttling as a design choice rather than the safety-net it actually is — it would silently drop legitimate alerts rather than intelligently grouping them into one per episode. Option B misapplies heartbeat/absence-of-data logic, which detects the *lack* of events, not repeated crossing of a present, fluctuating value. Option D changes the alert source and check frequency without addressing the underlying stateless-vs-stateful condition problem — a KQL queryset rule with a raw threshold would still fire on every qualifying check.

---

## Question 8: Surfacing Fallback Problems Before They Reach Production

**Question** *(Hard)*:

A development team wants any Direct Lake query that would silently fall back to DirectQuery to instead throw a hard error during testing, so fallback conditions get caught before the model ships — while production should keep functioning smoothly even if a table temporarily falls back. Which `DirectLakeBehavior` configuration fits development, and which fits production?

A. `DirectLakeOnly` in both environments, since production should never tolerate a fallback either  
B. `DirectQueryOnly` in development to force every query through the fallback path, `Automatic` in production  
C. `Automatic` in both environments, since `DirectLakeBehavior` only governs Direct Lake on OneLake models  
D. `DirectLakeOnly` in development to surface fallback conditions as hard errors, `Automatic` (the default) in production for silent, functional fallback  

> [!success]- Answer
> **D. DirectLakeOnly in development to surface fallback conditions as hard errors, Automatic (the default) in production for silent, functional fallback**
>
> `DirectLakeOnly` is documented as the development-time setting precisely because it turns a would-be silent fallback into a hard, catchable error, while `Automatic` — the production default — keeps queries functional (just slower) when a fallback condition is met, which is the behavior production users actually want.
>
> Option A would break production queries outright the moment any fallback condition is met, which is worse than the slow-but-functional behavior the scenario wants for production. Option B misapplies `DirectQueryOnly`, which forces every query through DirectQuery regardless of whether Direct Lake conditions hold — it doesn't test whether Direct Lake *would* work, it bypasses the question entirely. Option C is factually wrong: `DirectLakeBehavior` governs Direct Lake on SQL endpoints specifically, since Direct Lake on OneLake has no fallback path to control in the first place.

---

## Question 9: Deciding Whether to Rewrite or Just Retry

**Question** *(Easy)*:

A pipeline activity's Output JSON shows `"failureType": "UserError"` and `errorCode: "InvalidTemplate"`, referencing a dynamic content expression that points at an undefined dataset parameter. What's the correct first action?

A. Fix the dynamic content expression referencing the undefined parameter — `UserError` means the pipeline authoring itself needs a correction  
B. Retry the activity — `UserError` failures usually resolve themselves on a second attempt  
C. Escalate directly to Microsoft Support, since `InvalidTemplate` is a platform-side error code  
D. Configure built-in retry with a longer interval so the parameter has time to resolve  

> [!success]- Answer
> **A. Fix the dynamic content expression referencing the undefined parameter — UserError means the pipeline authoring itself needs a correction**
>
> `failureType: UserError` signals a pipeline authoring/configuration mistake that a rerun won't fix — the undefined parameter reference has to be corrected in the pipeline itself.
>
> Option B misapplies the retry-worthy behavior that belongs to `SystemError`, not `UserError`. Option C jumps to support before attempting the cheap, obvious fix the error message already points to. Option D configures retry for a class of failure that will simply fail identically on every attempt, since nothing about waiting longer resolves an undefined parameter reference.

---

## Question 10: One Query Succeeds, the Next One Fails

**Question** *(Easy)*:

A gateway-based Dataflow Gen2 query that writes directly to a Lakehouse succeeds every night, but a second query in the same dataflow — one that references the first query's staged output — consistently fails with a TCP-level network error, even though both point at the same OneLake instance. What's the most likely fix?

A. Re-enter the gateway's stored credentials, since they've likely expired between the two queries  
B. Open outbound TCP port 1433 on the gateway server, which the referencing query needs for the TDS read-back of staged data  
C. Increase the dataflow's refresh timeout, since the second query is simply processing more data  
D. Disable the on-premises gateway entirely and switch the connection to a cloud-only path  

> [!success]- Answer
> **B. Open outbound TCP port 1433 on the gateway server, which the referencing query needs for the TDS read-back of staged data**
>
> Writing to a Lakehouse uses HTTPS (443), but reading staged data back for a referencing query uses the TDS protocol over port 1433 — exactly why the first (writing) query can succeed while the second (referencing) query fails with a TCP-level error at the same gateway.
>
> Option A would fail both queries identically rather than just the referencing one, since both share the same gateway credentials. Option C misdiagnoses a protocol/port issue as a data-volume issue — no amount of extra timeout fixes a blocked port. Option D is a disproportionate fix that abandons the gateway architecture instead of opening the one missing port.

---

## Question 11: A Notebook Cell That Displays the Full Result Set

**Question** *(Medium)*:

A notebook cell runs `display(df)` on a 40-million-row DataFrame with no `.limit()` applied first, and the Spark application fails shortly after with exit code 137 reported on the driver. What's the correct diagnosis and fix?

A. This is executor-side data skew — enable `spark.sql.adaptive.skewJoin.enabled`  
B. Exit code 137 here means the JVM crashed from native memory corruption — reduce the number of custom libraries  
C. This is driver OOM from pulling the entire, unlimited result set into the driver process — add `.limit(N)` before `display()`, or aggregate first  
D. This is a capacity-queueing issue — the job should have queued instead of failing outright  

> [!success]- Answer
> **C. This is driver OOM from pulling the entire, unlimited result set into the driver process — add .limit(N) before display(), or aggregate first**
>
> `display(df)` without a `.limit(N)` first pulls the entire result set into driver memory, exactly like `.collect()`/`.toPandas()` — a documented driver-OOM cause reported as exit code 137 on the driver process.
>
> Option A misattributes a driver-side symptom to executor-side skew — the failure is on the driver, not a specific subset of executor tasks. Option B misreads exit code 137 (`SIGKILL`/OOM) as exit code 134 (`SIGABRT`/JVM crash) — different code, different cause. Option D is unrelated: interactive notebook runs don't queue at all, and nothing in the scenario points to a capacity-admission failure.

---

## Question 12: A Batch UPDATE That Fails Overnight

**Question** *(Medium)*:

Two nightly batch jobs both run large `UPDATE` statements against the same Fabric Warehouse fact table, touching entirely different row ranges. One job fails with error 24556. A developer asks whether switching the session to `READ COMMITTED` isolation would prevent this failure in the future. What should they be told?

A. Yes — switching isolation level avoids table-level write conflicts between non-overlapping updates  
B. No — the real fix is adding a `NOT ENFORCED` primary key so the engine can detect non-overlapping writes  
C. Yes, but only if the isolation-level change is made inside an explicit transaction block  
D. No — Fabric Warehouse only offers snapshot isolation and silently ignores `SET TRANSACTION ISOLATION LEVEL`; conflicts are evaluated at the table level regardless of row overlap, so retry logic with backoff is the only fix  

> [!success]- Answer
> **D. No — Fabric Warehouse only offers snapshot isolation and silently ignores SET TRANSACTION ISOLATION LEVEL; conflicts are evaluated at the table level regardless of row overlap, so retry logic with backoff is the only fix**
>
> Fabric Warehouse enforces snapshot isolation on every transaction; any attempt to set a different isolation level is silently ignored, and write-write conflicts are evaluated at the table level — even non-overlapping row ranges can conflict, and the only documented fix is retry logic with backoff.
>
> Option A and C both assume isolation-level changes take effect in Fabric Warehouse — they don't, regardless of transaction context. Option B misapplies `NOT ENFORCED` constraints, which help the optimizer and BI tools but have no bearing on concurrency conflict detection.

---

## Question 13: Assuming ERRORFILE Behavior Carries Over to Parquet

**Question** *(Medium)*:

A team's nightly CSV `COPY INTO` load reliably tolerates a handful of malformed rows using `MAXERRORS = 25` and a configured `ERRORFILE`. They switch the same source to a Parquet export for efficiency, keeping the same `WITH` options, expecting the same tolerance. The next load, with only 3 bad rows, fails outright. Why?

A. `ERRORFILE`/`MAXERRORS` only apply to CSV and JSONL loads — Parquet data-type conversion errors always fail the whole `COPY INTO`, regardless of `MAXERRORS`  
B. Parquet sources require a higher default `MAXERRORS` value than CSV sources  
C. Parquet loads need a separate `ERRORFILE_CREDENTIAL` even when the error file targets the same storage account as the source  
D. `MAXERRORS` silently resets to 0 whenever the source `FILE_TYPE` changes between loads  

> [!success]- Answer
> **A. ERRORFILE/MAXERRORS only apply to CSV and JSONL loads — Parquet data-type conversion errors always fail the whole COPY INTO, regardless of MAXERRORS**
>
> `ERRORFILE`/`MAXERRORS` are documented to apply only to CSV and JSONL loads in Fabric Data Warehouse — Parquet data-type conversion errors always fail the entire statement, which is exactly why a generously configured `MAXERRORS = 25` didn't save a load with only 3 bad rows.
>
> Option B invents a Parquet-specific default that doesn't exist. Option C misapplies `ERRORFILE_CREDENTIAL`, which is only needed when the error file targets a *different* storage account — nothing in the scenario suggests that. Option D invents a silent-reset behavior that isn't how `MAXERRORS` works; it was explicitly set and stays set regardless of `FILE_TYPE`.

---

## Question 14: Deciding Whether to Retry an Ingestion Failure

**Question** *(Medium)*:

`.show ingestion failures` returns two rows for the same table: one with `ErrorCode = General_ThrottledIngestion`, `FailureKind = Transient`, and another with `ErrorCode = BadRequest_TableNotExist`, `FailureKind = Permanent`. A junior engineer proposes writing one retry loop to resubmit both failed batches. What's wrong with that plan?

A. Nothing — both `FailureKind` values are retry-worthy given enough attempts  
B. Retrying the throttled batch is reasonable, but retrying the table-not-exist batch wastes effort — the target table doesn't exist and must be created before that batch can ever succeed  
C. Neither batch should be retried, since `General_RetryAttemptsExceeded` means the platform already gave up on both  
D. Both failures are actually Permanent despite the differing `FailureKind` label — ingestion failures default to non-retryable  

> [!success]- Answer
> **B. Retrying the throttled batch is reasonable, but retrying the table-not-exist batch wastes effort — the target table doesn't exist and must be created before that batch can ever succeed**
>
> `FailureKind` is the single most important field for exactly this decision: `Transient` (the throttled batch) is worth retrying, while `Permanent` (the missing table) will fail identically on every retry until the underlying data/config issue — here, a nonexistent table — is fixed.
>
> Option A ignores the documented distinction the two rows explicitly carry. Option C misreads the scenario — neither error code shown is `General_RetryAttemptsExceeded`, which is a distinct, separate error category. Option D contradicts the data given; the rows explicitly show two different `FailureKind` values, not a uniform Permanent classification.

---

## Question 15: Choosing Transactional for a Compliance Table

**Question** *(Medium)*:

A compliance team requires that a derived "flagged transactions" table always stay in sync with its raw source table — if the derivation query ever fails, the raw ingestion itself should be rejected too, rather than silently landing raw data with no corresponding flagged-transactions update. Which update-policy configuration fits, and what's the tradeoff?

A. Non-transactional — it's the safer default and requires no extra configuration  
B. Neither — update policies can't guarantee synchronization; use a scheduled pipeline comparison instead  
C. Transactional — the entire source ingestion rolls back if the update-policy query fails, guaranteeing sync, at the cost of blocking otherwise-healthy raw data whenever the derivation fails  
D. Transactional, but only if the target table is a materialized view rather than a plain table  

> [!success]- Answer
> **C. Transactional — the entire source ingestion rolls back if the update-policy query fails, guaranteeing sync, at the cost of blocking otherwise-healthy raw data whenever the derivation fails**
>
> A transactional update policy is the documented mechanism for exactly this requirement — if the update-policy query fails, the entire ingestion into the source table rolls back too, so the raw and derived tables can never drift out of sync — at the real cost of blocking perfectly good raw data whenever the derivation query has a problem.
>
> Option A describes the default, safer-for-most-cases behavior, which is precisely what this compliance requirement rules out. Option B understates what update policies can guarantee — transactional configuration is built for exactly this sync requirement. Option D invents a materialized-view precondition that doesn't apply to update-policy transactionality.

---

## Question 16: An Eventstream That Can't Reach Its Event Hub

**Question** *(Easy)*:

An eventstream fails to connect to an Azure Event Hub with error `AADSTS65002`, stating the eventstream isn't preauthorized to access the Event Hub through Azure AD. The connection string and firewall rules all look correct. What's the correct next step?

A. Regenerate the Event Hub's shared access key and update the eventstream's connection  
B. Recreate the eventstream item from scratch, since the connection object itself is likely corrupted  
C. Switch the eventstream's source from Event Hubs to a custom endpoint to bypass the error  
D. Escalate to a tenant admin for preauthorization — this is a tenant-level gap that end users can't self-resolve  

> [!success]- Answer
> **D. Escalate to a tenant admin for preauthorization — this is a tenant-level gap that end users can't self-resolve**
>
> `AADSTS65002` specifically means the Fabric Eventstream service principal isn't preauthorized against that Event Hubs namespace at the Microsoft Entra tenant level — a fix only a tenant admin can apply, regardless of how correct the connection string or firewall rules look.
>
> Option A and B both retry connection-level fixes that don't touch the actual tenant-level authorization gap. Option C sidesteps the underlying problem rather than fixing it, and changes the architecture for no real reason.

---

## Question 17: Revoked Access That Still Seems to Work

**Question** *(Hard)*:

A security team revokes a lakehouse owner's OneLake permissions at 9:00 AM, expecting every delegated shortcut pointing at that lakehouse to stop working immediately. At 9:15 AM, a consumer workspace's delegated shortcut still returns data successfully, and the security team escalates it as a possible OneLake security bypass. What's the accurate explanation, and what would actually force an immediate cutoff?

A. Delegated shortcuts use a cached storage access token for the item owner that can remain valid for 30–60 minutes after revocation; forcing an immediate cutoff requires pausing/resuming the capacity or toggling the endpoint's identity mode, both of which drop existing SQL connections  
B. This is a genuine security bypass — OneLake security roles have failed and must be reapplied  
C. The revocation only propagates to Spark, never to delegated SQL access, so it will never take effect until the shortcut is recreated  
D. OneLake security sync always takes a fixed 24 hours regardless of which access layer changed  

> [!success]- Answer
> **A. Delegated shortcuts use a cached storage access token for the item owner that can remain valid for 30–60 minutes after revocation; forcing an immediate cutoff requires pausing/resuming the capacity or toggling the endpoint's identity mode, both of which drop existing SQL connections**
>
> This is documented, expected caching behavior, not a bypass: delegated mode runs against a cached storage access token for the item owner rather than re-authorizing on every request, so a producer-side revocation can lag by up to 30–60 minutes at the consumer — and forcing an earlier cutoff means pausing/resuming the capacity or switching identity modes, both real operational tradeoffs since they drop existing SQL connections.
>
> Option B escalates documented caching behavior as if OneLake security itself had failed. Option C overstates the gap — the change does eventually take effect at the consumer, it just lags rather than never applying. Option D invents a fixed 24-hour figure that doesn't match any documented delegated-mode cache window.

---

## Question 18: Same Query, Different Row Counts, No Errors

**Question** *(Hard)*:

A source table has Row-Level Security defined in OneLake security. A data engineer queries a shortcut to that table from a Spark notebook and gets a filtered result matching their own permissions. A colleague queries the exact same shortcut through a SQL analytics endpoint currently in delegated identity mode and gets every row, unfiltered — no errors from either engine. What explains the discrepancy, and how would you align the two?

A. Spark's result is the wrong one — OneLake security only applies at the SQL layer, not to Spark queries  
B. The SQL analytics endpoint's delegated identity mode doesn't evaluate the caller against OneLake RLS, while Spark always enforces it — switch the endpoint to user identity mode to align results  
C. The shortcut's transitive-hop limit (5) was silently exceeded on the SQL path, causing it to skip RLS evaluation  
D. Both engines are serving cached query results from before the RLS rule existed — wait up to an hour for both to refresh  

> [!success]- Answer
> **B. The SQL analytics endpoint's delegated identity mode doesn't evaluate the caller against OneLake RLS, while Spark always enforces it — switch the endpoint to user identity mode to align results**
>
> Spark always enforces OneLake security, but a SQL analytics endpoint in delegated identity mode uses the item owner's identity and never evaluates the caller against RLS rules — producing exactly this pattern of a broader, unfiltered result via SQL and a correctly filtered result via Spark. Switching the endpoint to user identity mode aligns the two.
>
> Option A gets the direction backward — Spark's filtered result is the one correctly enforcing OneLake security. Option C invents an unrelated transitive-shortcut mechanism with no connection to RLS enforcement. Option D misapplies the cached-query-results window, which applies specifically to switching between identity modes, not to a steady-state discrepancy between two engines.

---

## Question 19: Assuming V-Order Is Already On

**Question** *(Easy)*:

A new team inherits a lakehouse in a recently created workspace and wants faster Direct Lake dashboard reads. They assume V-Order is already active, reasoning that "Fabric optimizes everything by default." What should they check, and what's the actual current default?

A. `spark.databricks.delta.autoCompact.enabled` — this property controls V-Order directly  
B. Nothing needs checking — V-Order has been on by default in every Fabric workspace since GA  
C. `spark.sql.parquet.vorder.default` — new workspaces default it to `false` under the `writeHeavy` resource profile, so V-Order must be enabled deliberately for read-heavy tables  
D. The Lakehouse Maintenance pipeline activity's schedule — V-Order only applies when triggered through a scheduled pipeline  

> [!success]- Answer
> **C. spark.sql.parquet.vorder.default — new workspaces default it to false under the writeHeavy resource profile, so V-Order must be enabled deliberately for read-heavy tables**
>
> New Fabric workspaces default to the `writeHeavy` resource profile, meaning `spark.sql.parquet.vorder.default = false` — V-Order is opt-in, not automatic, and read-heavy tables need it enabled deliberately at the session, table, or write-operation level.
>
> Option A misattributes V-Order control to an unrelated auto-compaction property. Option B repeats the exact outdated assumption the scenario is testing against — the current default is off, not on. Option D invents a false dependency on the Lakehouse Maintenance pipeline activity; V-Order can be applied via `OPTIMIZE ... VORDER`, a table property, or a session/write setting, with no pipeline requirement.

---

## Question 20: A VACUUM Command That Won't Run

**Question** *(Easy)*:

A developer runs `VACUUM sales.orders RETAIN 48 HOURS` to reclaim storage faster, and the command fails with a retention-interval error. What's the cause, and what's the correct next step?

A. The syntax is invalid — `RETAIN` must specify a value in `DAYS`, never `HOURS`  
B. `VACUUM` can only be run from the portal's Maintenance dialog, never from a notebook command  
C. The table has active deletion vectors, which block `VACUUM` below a 30-day retention window  
D. The 7-day default retention safety check is blocking a shorter interval; use 7+ days, or explicitly set `spark.databricks.delta.retentionDurationCheck.enabled = false` after confirming no reader/writer needs the shorter history  

> [!success]- Answer
> **D. The 7-day default retention safety check is blocking a shorter interval; use 7+ days, or explicitly set spark.databricks.delta.retentionDurationCheck.enabled = false after confirming no reader/writer needs the shorter history**
>
> `VACUUM`'s default retention is 7 days, and 48 hours falls under that threshold — the portal and API deliberately fail shorter requests by default as a safety guard tied to time-travel history; the documented override is disabling the retention-duration check explicitly, only after confirming no dependency on that history.
>
> Option A invents a units restriction that doesn't exist — `RETAIN` accepts an interval, and the failure is about the *length* of that interval, not its units. Option B invents an execution-surface restriction; `VACUUM` runs from notebooks, the portal, and the API alike. Option C invents a deletion-vector-specific retention floor that isn't documented anywhere.

---

## Question 21: A Cached Query That Never Shows a Cache Hit

**Question** *(Hard)*:

A team designs a Warehouse dashboard query to be a strong result-set caching candidate: a plain `SELECT`, well under 10,000 result rows, no security features, and no runtime constants. `result_cache_hit` still reads `0` on every single run. Before assuming a hidden disqualifier inside the query itself, what should the team check first?

A. `sys.databases.is_result_set_caching_on` for the item — Microsoft disabled result-set caching tenant-wide as a known issue (since 2026-02-16), so the feature may simply be off rather than the query tripping a disqualifier  
B. Whether the table has a declared `NOT ENFORCED` primary key, since caching requires one  
C. Whether the query was issued from the Fabric portal instead of SSMS, since caching only applies to portal-issued queries  
D. Whether `queryinsights` has finished its 15-minute ingestion lag before checking `result_cache_hit`  

> [!success]- Answer
> **A. sys.databases.is_result_set_caching_on for the item — Microsoft disabled result-set caching tenant-wide as a known issue (since 2026-02-16), so the feature may simply be off rather than the query tripping a disqualifier**
>
> Before hunting for a subtle disqualifier in an already-clean-looking query, check whether result-set caching is even live for the item — it was disabled tenant-wide as a known issue due to a stale-results bug, so a persistent `result_cache_hit = 0` may simply mean the feature is off, not that the query failed some documented rule.
>
> Option B invents a primary-key precondition for caching that isn't documented. Option C invents a client-surface restriction that doesn't exist — caching applies regardless of which client issued the query. Option D addresses a visibility delay in `queryinsights` history, not the underlying cause of a persistent `0` across many runs.

---

## Question 22: Trying to "Turn On" Skew Handling

**Question** *(Medium)*:

A team investigating a slow join wants to "enable Adaptive Query Execution" to fix partition skew, assuming it's an opt-in feature they've somehow been missing. What should they be told, and where should they actually look?

A. AQE must be enabled per-session with `spark.conf.set('spark.sql.adaptive.enabled', 'true')` before every job  
B. AQE is on by default in every Fabric runtime — no enablement step exists; investigate why AQE's skew-join handling isn't fully absorbing this specific case, such as extreme skew that needs manual salting  
C. AQE only activates once autotune has converged on the query shape, after roughly 20–25 iterations  
D. AQE is a preview feature currently limited to Runtime 2.0 and later  

> [!success]- Answer
> **B. AQE is on by default in every Fabric runtime — no enablement step exists; investigate why AQE's skew-join handling isn't fully absorbing this specific case, such as extreme skew that needs manual salting**
>
> AQE ships on by default across every Fabric runtime — there's no enablement action to take. The real question for a still-slow, still-skewed join is why AQE's dynamic skew-join detection isn't fully resolving it, which usually points to skew extreme enough that manual salting or repartitioning is needed on top of AQE's default handling.
>
> Option A invents an enablement step for a feature that's already on. Option C invents a dependency between AQE and autotune that doesn't exist — the two are independent, unrelated accelerators. Option D invents a runtime restriction; AQE is documented as on by default in all Fabric runtimes, not gated to Runtime 2.0+.

---

## Question 23: A Query Plan That Improved After a Constraint Was Added

**Question** *(Medium)*:

A data modeler declares a `NOT ENFORCED FOREIGN KEY` between a fact and dimension table purely for BI-tool convenience, and afterward notices the join plan quality for a large reporting query actually improved. Is this expected, and what's the catch?

A. No — `NOT ENFORCED` constraints are purely cosmetic and can't influence the optimizer; the improvement must come from something else  
B. Yes, but only because declaring any constraint automatically triggers a full statistics rebuild  
C. Yes — the declared relationship gives the optimizer extra cardinality and join-elimination information even though it's unenforced; the catch is the benefit only holds if the relationship is actually true in the data, since bad data won't be caught  
D. No — plan improvements only ever come from a CTAS rebuild, never from a constraint declaration  

> [!success]- Answer
> **C. Yes — the declared relationship gives the optimizer extra cardinality and join-elimination information even though it's unenforced; the catch is the benefit only holds if the relationship is actually true in the data, since bad data won't be caught**
>
> `NOT ENFORCED` constraints genuinely feed the optimizer additional cardinality and join-elimination information even though the engine never validates them at write time — real plan-quality benefit, real risk: if the declared relationship isn't actually true in the data, nothing catches that, and the optimizer's assumptions (and potentially query results) can be wrong.
>
> Option A denies a documented optimizer benefit that Fabric Warehouse explicitly attributes to declared, unenforced constraints. Option B invents an automatic statistics-rebuild trigger tied to constraint declaration that isn't documented. Option D denies that constraint declaration alone can influence plan quality, which contradicts the documented reason to declare `NOT ENFORCED` constraints at all.

---

## Question 24: Two Direct Lake Models, Two Different Failures

**Question** *(Hard)*:

Two lakehouses both accumulate small files past their Parquet file-count guardrail from unmaintained streaming writes. One feeds a Direct Lake on OneLake semantic model; the other feeds a Direct Lake on SQL semantic model. Both refreshes are attempted the same morning, before any `OPTIMIZE` is run. What should the team expect from each?

A. Both refreshes fail outright with no queryable model, since guardrail behavior is identical across variants  
B. Both models fall back to DirectQuery automatically and keep functioning, just at slower query speed  
C. The Direct Lake on SQL model fails outright, while the Direct Lake on OneLake model silently falls back to DirectQuery  
D. The Direct Lake on OneLake model's refresh fails and the model is unqueryable until compaction runs; the Direct Lake on SQL model's refresh succeeds with a fallback warning and keeps serving queries via DirectQuery  

> [!success]- Answer
> **D. The Direct Lake on OneLake model's refresh fails and the model is unqueryable until compaction runs; the Direct Lake on SQL model's refresh succeeds with a fallback warning and keeps serving queries via DirectQuery**
>
> Direct Lake guardrail behavior diverges sharply by variant: Direct Lake on OneLake has no DirectQuery fallback path at all, so exceeding guardrails behaves like Import mode — the refresh fails and the model is unqueryable until the underlying table is compacted back within limits. Direct Lake on SQL, by contrast, falls back to DirectQuery (if enabled), so the refresh succeeds with a warning and queries keep returning results, just at DirectQuery's slower latency.
>
> Option A flattens a documented, meaningful behavioral difference between the two variants into "identical." Option B is wrong for the OneLake variant specifically, which has no fallback mechanism to invoke. Option C reverses the actual pairing of variant to behavior.

---

## Question 25: Choosing Between a Materialized View and an Update Policy

**Question** *(Medium)*:

A team ingests raw sensor readings into an Eventhouse and needs two things: lightly parsing and typing each incoming event as it lands, and maintaining a deduplicated latest-reading-per-device result that dozens of dashboards query throughout the day. Which mechanism fits each need, and why not the other way around?

A. Update policy for the per-event parsing/typing, since its cost is folded into ingestion; materialized view for the deduplicated aggregate, since dozens of dashboards would otherwise each re-run the deduplication  
B. Update policy for both needs, since it's the lower-cost mechanism in every case  
C. Materialized view for both needs, since dashboards should never query raw update-policy output directly  
D. Materialized view for the parsing, since it can run continuously; update policy for the dedup, since it happens once per ingested batch  

> [!success]- Answer
> **A. Update policy for the per-event parsing/typing, since its cost is folded into ingestion; materialized view for the deduplicated aggregate, since dozens of dashboards would otherwise each re-run the deduplication**
>
> The cost-profile split is exactly this: update policies fold a small, predictable transform cost into every ingested event — ideal for simple parsing/typing with no aggregation state — while materialized views pay an aggregation cost once, continuously, in the background, which is far cheaper than dozens of dashboard refreshes each re-running the same deduplication over raw data.
>
> Option B ignores that a per-event update policy doesn't maintain a queryable rolling aggregate the way a materialized view does — it would leave every dashboard re-deduplicating raw data on each refresh. Option C overstates the restriction; simple per-event transforms are exactly what update policies are for, materialized views aren't required for every downstream read. Option D swaps the two mechanisms' actual execution models — parsing has no aggregation state to maintain continuously, and deduplication is precisely the kind of repeated-read aggregate a materialized view is built for.

---

## Question 26: Maxing Out DIUs Without Any Speedup

**Question** *(Medium)*:

A Copy activity moving a 5 TB on-premises SQL Server table into a Fabric Warehouse has its DIUs manually set to 256 (the maximum) and degree of copy parallelism set to 32, but throughput hasn't improved over the Auto defaults. The source table has no Partition option configured. What's the most likely explanation?

A. 256 DIUs already exceeds what a single Copy activity can use effectively — lower it back to Auto  
B. The source read itself is still single-threaded because no Partition option is configured on the source — parallelism settings have nothing to parallelize until the source read is split  
C. Fabric Warehouse sinks cap effective copy throughput regardless of DIU or parallelism settings, by design  
D. Staging wasn't enabled on the Copy activity, which silently overrides both DIU and parallelism settings  

> [!success]- Answer
> **B. The source read itself is still single-threaded because no Partition option is configured on the source — parallelism settings have nothing to parallelize until the source read is split**
>
> Degree of copy parallelism and DIUs are downstream of the source read itself — without a Partition option (Physical partitions of table, or Dynamic range) configured on the source, the read runs through a single connection regardless of how high DIUs or parallelism are set, since there's nothing yet to parallelize.
>
> Option A doubles down on a setting that isn't the actual bottleneck. Option C invents a Warehouse-sink throughput cap that isn't documented. Option D invents a silent override relationship between staging and DIU/parallelism settings that doesn't exist — staging is required for Warehouse sinks regardless, and doesn't govern source-read parallelism.

---

## Question 27: From a Vague "It's Slow" Report to a Fix

**Question** *(Hard)*:

A user reports that a nightly notebook "seems to run forever some nights and just fails on others." Which sequence correctly characterizes the symptom, reaches the likely diagnosis once a pattern of a few tasks running far longer than the rest before the job dies becomes visible, and applies the matching fix?

A. Open the Capacity Metrics app first, since this is a capacity-wide symptom → confirm `CapacityLimitExceeded` → scale up the SKU  
B. Open Dataflow Gen2 refresh history first, since "runs forever" always means query folding loss → redesign the query for folding → no Spark-side change needed  
C. Open Monitor hub's Historical runs first → confirm `SystemError` → rerun from the failed activity → no further action needed  
D. Open the Spark application detail page's Stages/Executors tabs first → confirm executor OOM from data skew (exit code 137), evidenced by a handful of tasks with disproportionately larger input → enable AQE skew-join handling or repartition the skewed keys, then consider the native execution engine for the steady-state workload  

> [!success]- Answer
> **D. Open the Spark application detail page's Stages/Executors tabs first → confirm executor OOM from data skew (exit code 137), evidenced by a handful of tasks with disproportionately larger input → enable AQE skew-join handling or repartition the skewed keys, then consider the native execution engine for the steady-state workload**
>
> This is the full monitor → diagnose → optimize chain for a single-item symptom: the Spark application detail page's Stages tab confirms the described pattern (a handful of tasks with far larger input than their peers), the Executors tab's exit code 137 confirms OOM, and data skew is the textbook cause of exactly this shape — a small subset of long-running tasks eventually killed for memory, not a uniform slowdown. Once stabilized with AQE skew-join handling or repartitioning, the native execution engine is a reasonable next lever for the steady-state, computationally heavy workload.
>
> Option A picks a capacity-wide surface for a symptom described on a single item, with no mention of other items being affected. Option B misapplies a Dataflow Gen2-specific performance concept to a Spark notebook entirely, and wrongly claims "runs forever" always means one specific thing. Option C stops at a generic rerun without ever diagnosing *why* the job is failing, and wrongly assumes every failure is a retry-worthy `SystemError`.

---

**[← Back to Practice Questions](./practice-questions.md)**
