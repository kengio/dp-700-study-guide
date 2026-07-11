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

A. Dataflow Gen1 isn't one of Monitor hub's 17 covered item types  
B. Monitor hub only shows the last 100 rows from the past 30 days, and this run is outside that window  
C. The admin lacks the Contributor workspace role, which hides certain item types from Monitor hub  
D. Dataflow Gen1 items only appear in Monitor hub after being migrated to Dataflow Gen2  

> [!success]- Answer
> **A. Dataflow Gen1 isn't one of Monitor hub's 17 covered item types**
>
> Check the dataflow's own refresh history or notifications instead. Monitor hub's Activities page covers 17 item types, and Dataflow Gen1 is explicitly excluded — no filter combination will surface it, because it was never tracked there in the first place.
>
> Option B invents a retention explanation that doesn't fit — the run happened an hour ago, well inside the 30-day window. Option C invents a role-based hiding behavior that isn't documented; Monitor hub visibility depends on item permissions, not a blanket role gate on entire item types. Option D invents a migration requirement that doesn't exist — Dataflow Gen1 simply never appears, migrated or not.

---

## Question 2: A Direct Lake Dashboard That Slows Down After a Large Append

**Question** *(Medium)*:

Immediately after a 200 GB append lands in a lakehouse table feeding a Direct Lake report, users notice dashboard queries have gotten noticeably slower — not broken, just slower. What's the correct sequence: what do you check first to confirm what's actually happening, what's the likely diagnosis, and what's the performance lever if the table turns out to be healthy but under-optimized?

A. Assume the DirectQuery fallback is the cause without checking anything, and switch the model to Import mode  
B. Check the semantic model's refresh history Direct Lake tab to confirm reframing has run  
C. Open the Capacity Metrics app first, since any large data append is inherently a capacity-wide event  
D. Assume query folding was lost during the append and redesign the Dataflow Gen2 query  

> [!success]- Answer
> **B. Check the semantic model's refresh history Direct Lake tab to confirm reframing has run**
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
C. Use the Fabric Data Warehouse SQL query results source (preview), which evaluates a query on a schedule and triggers on the result  
D. Build a KQL queryset against the warehouse table, since KQL querysets can target any Fabric data store including Warehouse tables  

> [!success]- Answer
> **C. Use the Fabric Data Warehouse SQL query results source (preview), which evaluates a query on a schedule and triggers on the result**
>
> Don't attempt to alert from the SQL analytics endpoint directly, which isn't a supported source. The Warehouse SQL query (preview) mechanism exists precisely for this case — alerting on warehouse data on a schedule without a streaming source — while creating alerts directly from a SQL analytics endpoint is explicitly unsupported and a documented distractor.
>
> Option A names the one alert source the guide explicitly flags as unsupported. Option B misapplies the Capacity Metrics app, which can't fire alerts at all regardless of source. Option D misapplies KQL querysets, which are scoped to KQL/Eventhouse data, not arbitrary Warehouse tables.

---

## Question 4: What Activator Can Actually Do When a Rule Fires

**Question** *(Easy)*:

A team wants a single Activator rule to both notify the on-call engineer in Teams and automatically trigger a remediation notebook when a condition is met, without maintaining two separate rules. Is this a valid single-rule configuration?

A. No — a rule can take exactly one action; two separate rules are required for notify-plus-remediate  
B. No — running a Fabric item as an action requires a dedicated, separate Activator item  
C. Yes, but only if the notification action is listed first in the rule's action order  
D. Yes — a single rule can combine multiple actions, such as a notification and running a Fabric item  

> [!success]- Answer
> **D. Yes — a single rule can combine multiple actions, such as a notification and running a Fabric item**
>
> A single rule can be configured to take more than one action when a scenario calls for it — notify and remediate on the same rule is a documented, common pattern. The Fabric-item action covers a notebook, pipeline, SJD, dataflow, UDF, or copy job.
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
B. `DELETE` only cancels refreshes that were themselves triggered via the enhanced refresh API  
C. `DELETE` cancels the refresh but leaves the semantic model permanently locked until a capacity restart  
D. `DELETE` first requires switching the model to Direct Lake mode before it will accept a cancellation request  

> [!success]- Answer
> **B. `DELETE` only cancels refreshes that were themselves triggered via the enhanced refresh API**
>
> A portal-triggered refresh has to run to completion or timeout instead. Refresh cancellation via `DELETE /refreshes/{requestId}` is scoped to refreshes started through the enhanced refresh API itself — a standard portal-button refresh can't be cancelled this way, only let run to completion or timeout.
>
> Option A overstates what `DELETE` can cancel. Option C invents a permanent-lock consequence that isn't documented. Option D invents a Direct Lake precondition for cancellation that has nothing to do with the actual limitation, which is about trigger source, not storage mode.

---

## Question 7: Avoiding Alert Spam on a Flapping Sensor

**Question** *(Hard)*:

A logistics team's Activator rule emails the team every time a vehicle's speed reading exceeds 120 km/h. During one trip, the reading hovers near the threshold and crosses it a dozen times in ten minutes, generating a dozen separate emails. The team wants exactly one alert per genuine "went too fast" episode, resetting only once the speed drops back to normal. What's the fix?

A. Lower the email rate limit on the action so excess sends are silently dropped during a flapping episode  
B. Add a heartbeat/absence-of-data condition in place of the threshold condition  
C. Switch to a stateful condition using `BECOMES`, firing only on the transition into the over-threshold state  
D. Move the rule from an Eventstreams source to a KQL queryset with a 5-minute check frequency  

> [!success]- Answer
> **C. Switch to a stateful condition using BECOMES, firing only on the transition into the over-threshold state**
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
D. `DirectLakeOnly` in development to surface fallback conditions as hard errors, `Automatic` in production  

> [!success]- Answer
> **D. DirectLakeOnly in development to surface fallback conditions as hard errors, Automatic in production**
>
> `DirectLakeOnly` is documented as the development-time setting precisely because it turns a would-be silent fallback into a hard, catchable error, while `Automatic` — the production default — keeps queries functional (just slower) when a fallback condition is met, which is the behavior production users actually want.
>
> Option A would break production queries outright the moment any fallback condition is met, which is worse than the slow-but-functional behavior the scenario wants for production. Option B misapplies `DirectQueryOnly`, which forces every query through DirectQuery regardless of whether Direct Lake conditions hold — it doesn't test whether Direct Lake *would* work, it bypasses the question entirely. Option C is factually wrong: `DirectLakeBehavior` governs Direct Lake on SQL endpoints specifically, since Direct Lake on OneLake has no fallback path to control in the first place.

---

## Question 9: Deciding Whether to Rewrite or Just Retry

**Question** *(Easy)*:

A pipeline activity's Output JSON shows `"failureType": "UserError"` and `errorCode: "InvalidTemplate"`, referencing a dynamic content expression that points at an undefined dataset parameter. What's the correct first action?

A. Fix the dynamic content expression referencing the undefined parameter  
B. Retry the activity — `UserError` failures usually resolve themselves on a second attempt  
C. Escalate directly to Microsoft Support, since `InvalidTemplate` is a platform-side error code  
D. Configure built-in retry with a longer interval so the parameter has time to resolve  

> [!success]- Answer
> **A. Fix the dynamic content expression referencing the undefined parameter**
>
> `UserError` means the pipeline authoring itself needs a correction. `failureType: UserError` signals a pipeline authoring/configuration mistake that a rerun won't fix — the undefined parameter reference has to be corrected in the pipeline itself.
>
> Option B misapplies the retry-worthy behavior that belongs to `SystemError`, not `UserError`. Option C jumps to support before attempting the cheap, obvious fix the error message already points to. Option D configures retry for a class of failure that will simply fail identically on every attempt, since nothing about waiting longer resolves an undefined parameter reference.

---

## Question 10: When You Can't Get the Firewall Rule Approved

**Question** *(Medium)*:

A Dataflow Gen2 using an on-premises gateway writes one query to a Lakehouse successfully, but a second query that references the first query's staged output fails with a TCP-level network error. The team traces the cause to a blocked outbound port on the gateway server, but the network team refuses to open it, calling it "just a workaround." What are the two documented ways around this without opening the port, and why does only the second query fail?

A. Combine the two queries into one, or disable staging — writing uses HTTPS (443), but reading staged data back needs TDS on port 1433  
B. Increase the refresh timeout and shrink the batch size, since the second query transfers more data than the gateway buffer allows  
C. Re-authenticate the gateway's Entra credentials before each refresh, since credentials silently expire mid-run  
D. Move the dataflow off the gateway entirely, since on-premises gateways can't reach OneLake on any other port  

> [!success]- Answer
> **A. Combine the two queries into one, or disable staging — writing uses HTTPS (443), but reading staged data back needs TDS on port 1433**
>
> Writing to the Lakehouse uses HTTPS, so the first query succeeds even through a gateway that blocks port 1433. Reading staged data back for the referencing query specifically needs the TDS protocol on that port, so only the second query fails. When opening the port isn't an option, the two documented workarounds are combining the queries so there's no cross-query staging read, or disabling staging entirely.
>
> Option B misdiagnoses a blocked-port issue as a data-volume issue — no timeout or batch-size change fixes a firewall rule. Option C invents a credential-expiry cause that would fail both queries identically, not just the referencing one. Option D is a disproportionate architecture change when two documented, much smaller workarounds already exist.

---

## Question 11: A Notebook Cell That Displays the Full Result Set

**Question** *(Medium)*:

A notebook cell runs `display(df)` on a 40-million-row DataFrame with no `.limit()` applied first, and the Spark application fails shortly after with exit code 137 reported on the driver. What's the correct diagnosis and fix?

A. This is executor-side data skew — enable `spark.sql.adaptive.skewJoin.enabled`  
B. Exit code 137 here means the JVM crashed from native memory corruption — reduce the number of custom libraries  
C. This is driver OOM from pulling the entire, unlimited result set into the driver process  
D. This is a capacity-queueing issue — the job should have queued instead of failing outright  

> [!success]- Answer
> **C. This is driver OOM from pulling the entire, unlimited result set into the driver process**
>
> Add `.limit(N)` before `display()`, or aggregate first. `display(df)` without a `.limit(N)` first pulls the entire result set into driver memory, exactly like `.collect()`/`.toPandas()` — a documented driver-OOM cause reported as exit code 137 on the driver process.
>
> Option A misattributes a driver-side symptom to executor-side skew — the failure is on the driver, not a specific subset of executor tasks. Option B misreads exit code 137 (`SIGKILL`/OOM) as exit code 134 (`SIGABRT`/JVM crash) — different code, different cause. Option D is unrelated: interactive notebook runs don't queue at all, and nothing in the scenario points to a capacity-admission failure.

---

## Question 12: A Batch UPDATE That Fails Overnight

**Question** *(Medium)*:

Two nightly batch jobs both run large `UPDATE` statements against the same Fabric Warehouse fact table, touching entirely different row ranges. One job fails with error 24556. A developer asks whether switching the session to `READ COMMITTED` isolation would prevent this failure in the future. What should they be told?

A. Yes — switching isolation level avoids table-level write conflicts between non-overlapping updates  
B. No — the real fix is adding a `NOT ENFORCED` primary key so the engine can detect non-overlapping writes  
C. Yes, but only if the isolation-level change is made inside an explicit transaction block  
D. No — Fabric Warehouse only offers snapshot isolation and silently ignores isolation-level changes  

> [!success]- Answer
> **D. No — Fabric Warehouse only offers snapshot isolation and silently ignores isolation-level changes**
>
> Fabric Warehouse enforces snapshot isolation on every transaction; any attempt to set a different isolation level is silently ignored, and write-write conflicts are evaluated at the table level — even non-overlapping row ranges can conflict, and the only documented fix is retry logic with backoff.
>
> Option A and C both assume isolation-level changes take effect in Fabric Warehouse — they don't, regardless of transaction context. Option B misapplies `NOT ENFORCED` constraints, which help the optimizer and BI tools but have no bearing on concurrency conflict detection.

---

## Question 13: Assuming ERRORFILE Behavior Carries Over to Parquet

**Question** *(Medium)*:

A team's nightly CSV `COPY INTO` load reliably tolerates a handful of malformed rows using `MAXERRORS = 25` and a configured `ERRORFILE`. They switch the same source to a Parquet export for efficiency, keeping the same `WITH` options, expecting the same tolerance. The next load, with only 3 bad rows, fails outright. Why?

A. `ERRORFILE`/`MAXERRORS` only apply to CSV and JSONL loads  
B. Parquet sources require a higher default `MAXERRORS` value than CSV sources  
C. Parquet loads need a separate `ERRORFILE_CREDENTIAL` even when the error file targets the same storage account as the source  
D. `MAXERRORS` silently resets to 0 whenever the source `FILE_TYPE` changes between loads  

> [!success]- Answer
> **A. `ERRORFILE`/`MAXERRORS` only apply to CSV and JSONL loads**
>
> Parquet data-type conversion errors always fail the whole `COPY INTO`, regardless of `MAXERRORS`. `ERRORFILE`/`MAXERRORS` are documented to apply only to CSV and JSONL loads in Fabric Data Warehouse — Parquet data-type conversion errors always fail the entire statement, which is exactly why a generously configured `MAXERRORS = 25` didn't save a load with only 3 bad rows.
>
> Option B invents a Parquet-specific default that doesn't exist. Option C misapplies `ERRORFILE_CREDENTIAL`, which is only needed when the error file targets a *different* storage account — nothing in the scenario suggests that. Option D invents a silent-reset behavior that isn't how `MAXERRORS` works; it was explicitly set and stays set regardless of `FILE_TYPE`.

---

## Question 14: Deciding Whether to Retry an Ingestion Failure

**Question** *(Medium)*:

`.show ingestion failures` returns two rows for the same table: one with `ErrorCode = General_ThrottledIngestion`, `FailureKind = Transient`, and another with `ErrorCode = BadRequest_TableNotExist`, `FailureKind = Permanent`. A junior engineer proposes writing one retry loop to resubmit both failed batches. What's wrong with that plan?

A. Nothing — both `FailureKind` values are retry-worthy given enough attempts  
B. Retrying the throttled batch is reasonable, but retrying the table-not-exist batch wastes effort  
C. Neither batch should be retried, since `General_RetryAttemptsExceeded` means the platform already gave up on both  
D. Both failures are actually Permanent despite the differing `FailureKind` label — ingestion failures default to non-retryable  

> [!success]- Answer
> **B. Retrying the throttled batch is reasonable, but retrying the table-not-exist batch wastes effort**
>
> The target table doesn't exist and must be created before that batch can ever succeed. `FailureKind` is the single most important field for exactly this decision: `Transient` (the throttled batch) is worth retrying, while `Permanent` (the missing table) will fail identically on every retry until the underlying data/config issue — here, a nonexistent table — is fixed.
>
> Option A ignores the documented distinction the two rows explicitly carry. Option C misreads the scenario — neither error code shown is `General_RetryAttemptsExceeded`, which is a distinct, separate error category. Option D contradicts the data given; the rows explicitly show two different `FailureKind` values, not a uniform Permanent classification.

---

## Question 15: Choosing Transactional for a Compliance Table

**Question** *(Medium)*:

A compliance team requires that a derived "flagged transactions" table always stay in sync with its raw source table — if the derivation query ever fails, the raw ingestion itself should be rejected too, rather than silently landing raw data with no corresponding flagged-transactions update. Which update-policy configuration fits, and what's the tradeoff?

A. Non-transactional — it's the safer default and requires no extra configuration  
B. Neither — update policies can't guarantee synchronization; use a scheduled pipeline comparison instead  
C. Transactional — the entire source ingestion rolls back if the update-policy query fails, guaranteeing sync  
D. Transactional, but only if the target table is a materialized view rather than a plain table  

> [!success]- Answer
> **C. Transactional — the entire source ingestion rolls back if the update-policy query fails, guaranteeing sync**
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
D. Escalate to a tenant admin for preauthorization  

> [!success]- Answer
> **D. Escalate to a tenant admin for preauthorization**
>
> This is a tenant-level gap that end users can't self-resolve. `AADSTS65002` specifically means the Fabric Eventstream service principal isn't preauthorized against that Event Hubs namespace at the Microsoft Entra tenant level — a fix only a tenant admin can apply, regardless of how correct the connection string or firewall rules look.
>
> Option A and B both retry connection-level fixes that don't touch the actual tenant-level authorization gap. Option C sidesteps the underlying problem rather than fixing it, and changes the architecture for no real reason.

---

## Question 17: Which Permission Change Actually Needs a Workaround

**Question** *(Hard)*:

A security team audits four permission changes made at 9:00 AM against a lakehouse consumed elsewhere through delegated shortcuts: (1) a SQL `REVOKE` issued directly against a consumer-side Warehouse table, (2) the lakehouse owner's OneLake Read permission revoked at the producer, (3) a new OneLake security role/filter created at the producer affecting a shortcut source, and (4) an OneLake security role's membership changed at the producer. Which take effect immediately at the consumer, and which lag behind the cached-token window?

A. All four are subject to the same up-to-30–60-minute lag, since every change ultimately routes through OneLake security  
B. Only (1) applies immediately; (2) and (3) are both subject to the cached-storage-token lag; (4) isn't delayed by the token cache at all  
C. Only (2) is delayed; (1), (3), and (4) all apply immediately since none of them touch the item owner's own storage token  
D. None are delayed — Fabric re-validates every permission on each query regardless of layer  

> [!success]- Answer
> **B. Only (1) applies immediately; (2) and (3) are both subject to the cached-storage-token lag; (4) isn't delayed by the token cache at all**
>
> Four permission layers, four different propagation rules. A SQL `GRANT`/`REVOKE` or security policy at the consumer applies on the very next query — no cache involved. The item owner's OneLake permissions (2) and a new OneLake security role/filter affecting a shortcut source (3) are both gated by the same cached storage access token for the item owner, which can remain valid up to 30–60 minutes after either change. OneLake security role *membership* changes (4) are different again — they aren't delayed by the consumer's token cache and take effect on the normal sync path.
>
> Option A collapses four distinct propagation rules into one, which contradicts the documented table this scenario is built from. Option C gets the SQL-layer change right but wrongly claims (3) and (4) apply immediately — (3) shares the exact same cached-token lag as (2). Option D denies that any caching exists at all, which is the opposite of the documented, expected behavior.

---

## Question 18: RLS That Silently Doesn't Apply

**Question** *(Hard)*:

A data engineer defines a restrictive RLS predicate in a OneLake security role, `RegionalReader`, scoped to a sales table, expecting each regional analyst to see only their own region's rows. `bob@contoso.com` is a member of `RegionalReader` and also a member of `AuditFullAccess`, a separate OneLake security role on the same table granting unrestricted full-row access for compliance auditing. Bob reports seeing every region's rows, not just his own, with no errors from any engine. What explains this, and what's the fix if RLS enforcement for Bob is actually required?

A. This is a bug — OneLake security roles are supposed to intersect, not union, so `RegionalReader`'s RLS should win  
B. Multiple roles on the same table evaluate additively: the most permissive role wins, so RLS appears not to apply  
C. Bob's SQL analytics endpoint is in delegated identity mode, which is bypassing the RLS predicate entirely  
D. RLS predicates only apply to Spark queries, never to roles evaluated through OneLake security directly  

> [!success]- Answer
> **B. Multiple roles on the same table evaluate additively: the most permissive role wins, so RLS appears not to apply**
>
> OneLake security roles union at the table/folder level — a user in *any* role granting access to a table can see it. When one role (`AuditFullAccess`) grants unrestricted full-row access and another (`RegionalReader`) carries a restrictive RLS predicate, the more permissive role wins for that user, and the RLS appears not to apply even though it's configured correctly. If RLS enforcement for Bob is actually required, restrictive and permissive roles need to stay mutually exclusive per user or group — Bob can't be a member of both if the restriction is supposed to hold.
>
> Option A invents an intersect-not-union model that isn't how OneLake security roles evaluate at the table level. Option C reaches for the delegated-identity-mode explanation used elsewhere in this domain, but nothing in the scenario mentions a SQL analytics endpoint or its identity mode — the discrepancy here is role stacking, a different mechanism entirely. Option D invents a Spark-only scope for RLS that contradicts OneLake security's whole cross-engine design.

---

## Question 19: Assuming V-Order Is Already On

**Question** *(Easy)*:

A new team inherits a lakehouse in a recently created workspace and wants faster Direct Lake dashboard reads. They assume V-Order is already active, reasoning that "Fabric optimizes everything by default." What should they check, and what's the actual current default?

A. `spark.databricks.delta.autoCompact.enabled` — this property controls V-Order directly  
B. Nothing needs checking — V-Order has been on by default in every Fabric workspace since GA  
C. `spark.sql.parquet.vorder.default`  
D. The Lakehouse Maintenance pipeline activity's schedule — V-Order only applies when triggered through a scheduled pipeline  

> [!success]- Answer
> **C. `spark.sql.parquet.vorder.default`**
>
> New workspaces default it to `false` under the `writeHeavy` resource profile, so V-Order must be enabled deliberately for read-heavy tables. New Fabric workspaces default to the `writeHeavy` resource profile, meaning `spark.sql.parquet.vorder.default = false` — V-Order is opt-in, not automatic, and read-heavy tables need it enabled deliberately at the session, table, or write-operation level.
>
> Option A misattributes V-Order control to an unrelated auto-compaction property. Option B repeats the exact outdated assumption the scenario is testing against — the current default is off, not on. Option D invents a false dependency on the Lakehouse Maintenance pipeline activity; V-Order can be applied via `OPTIMIZE ... VORDER`, a table property, or a session/write setting, with no pipeline requirement.

---

## Question 20: A VACUUM Command That Won't Run

**Question** *(Easy)*:

A developer runs `VACUUM sales.orders RETAIN 48 HOURS` to reclaim storage faster, and the command fails with a retention-interval error. What's the cause, and what's the correct next step?

A. The syntax is invalid — `RETAIN` must specify a value in `DAYS`, never `HOURS`  
B. `VACUUM` can only be run from the portal's Maintenance dialog, never from a notebook command  
C. The table has active deletion vectors, which block `VACUUM` below a 30-day retention window  
D. The 7-day default retention safety check is blocking a shorter interval  

> [!success]- Answer
> **D. The 7-day default retention safety check is blocking a shorter interval**
>
> `VACUUM`'s default retention is 7 days, and 48 hours falls under that threshold — the portal and API deliberately fail shorter requests by default as a safety guard tied to time-travel history; the documented override is disabling the retention-duration check explicitly, only after confirming no dependency on that history.
>
> Option A invents a units restriction that doesn't exist — `RETAIN` accepts an interval, and the failure is about the *length* of that interval, not its units. Option B invents an execution-surface restriction; `VACUUM` runs from notebooks, the portal, and the API alike. Option C invents a deletion-vector-specific retention floor that isn't documented anywhere.

---

## Question 21: A Cached Query That Never Shows a Cache Hit

**Question** *(Hard)*:

A team designs a Warehouse dashboard query to be a strong result-set caching candidate: a plain `SELECT`, well under 10,000 result rows, no security features, and no runtime constants. `result_cache_hit` still reads `0` on every single run. Before assuming a hidden disqualifier inside the query itself, what should the team check first?

A. `sys.databases.is_result_set_caching_on` for the item  
B. Whether the table has a declared `NOT ENFORCED` primary key, since caching requires one  
C. Whether the query was issued from the Fabric portal instead of SSMS, since caching only applies to portal-issued queries  
D. Whether `queryinsights` has finished its 15-minute ingestion lag before checking `result_cache_hit`  

> [!success]- Answer
> **A. `sys.databases.is_result_set_caching_on` for the item**
>
> Microsoft disabled result-set caching tenant-wide as a known issue (since 2026-02-16), so the feature may simply be off rather than the query tripping a disqualifier. Before hunting for a subtle disqualifier in an already-clean-looking query, check whether result-set caching is even live for the item — it was disabled tenant-wide as a known issue due to a stale-results bug, so a persistent `result_cache_hit = 0` may simply mean the feature is off, not that the query failed some documented rule.
>
> Option B invents a primary-key precondition for caching that isn't documented. Option C invents a client-surface restriction that doesn't exist — caching applies regardless of which client issued the query. Option D addresses a visibility delay in `queryinsights` history, not the underlying cause of a persistent `0` across many runs.

---

## Question 22: Trying to "Turn On" Skew Handling

**Question** *(Medium)*:

A team investigating a slow join wants to "enable Adaptive Query Execution" to fix partition skew, assuming it's an opt-in feature they've somehow been missing. What should they be told, and where should they actually look?

A. AQE must be enabled per-session with `spark.conf.set('spark.sql.adaptive.enabled', 'true')` before every job  
B. AQE is on by default in every Fabric runtime  
C. AQE only activates once autotune has converged on the query shape, after roughly 20–25 iterations  
D. AQE is a preview feature currently limited to Runtime 2.0 and later  

> [!success]- Answer
> **B. AQE is on by default in every Fabric runtime**
>
> No enablement step exists; investigate why AQE's skew-join handling isn't fully absorbing this specific case, such as extreme skew that needs manual salting. AQE ships on by default across every Fabric runtime — there's no enablement action to take. The real question for a still-slow, still-skewed join is why AQE's dynamic skew-join detection isn't fully resolving it, which usually points to skew extreme enough that manual salting or repartitioning is needed on top of AQE's default handling.
>
> Option A invents an enablement step for a feature that's already on. Option C invents a dependency between AQE and autotune that doesn't exist — the two are independent, unrelated accelerators. Option D invents a runtime restriction; AQE is documented as on by default in all Fabric runtimes, not gated to Runtime 2.0+.

---

## Question 23: A Query Plan That Improved After a Constraint Was Added

**Question** *(Medium)*:

A data modeler declares a `NOT ENFORCED FOREIGN KEY` between a fact and dimension table purely for BI-tool convenience, and afterward notices the join plan quality for a large reporting query actually improved. Is this expected, and what's the catch?

A. No — `NOT ENFORCED` constraints are purely cosmetic and can't influence the optimizer; the improvement must come from something else  
B. Yes, but only because declaring any constraint automatically triggers a full statistics rebuild  
C. Yes — the declared relationship gives the optimizer extra cardinality and join-elimination information  
D. No — plan improvements only ever come from a CTAS rebuild, never from a constraint declaration  

> [!success]- Answer
> **C. Yes — the declared relationship gives the optimizer extra cardinality and join-elimination information**
>
> Bad data won't be caught. `NOT ENFORCED` constraints genuinely feed the optimizer additional cardinality and join-elimination information even though the engine never validates them at write time — real plan-quality benefit, real risk: if the declared relationship isn't actually true in the data, nothing catches that, and the optimizer's assumptions (and potentially query results) can be wrong.
>
> Option A denies a documented optimizer benefit that Fabric Warehouse explicitly attributes to declared, unenforced constraints. Option B invents an automatic statistics-rebuild trigger tied to constraint declaration that isn't documented. Option D denies that constraint declaration alone can influence plan quality, which contradicts the documented reason to declare `NOT ENFORCED` constraints at all.

---

## Question 24: Two Direct Lake Models, Two Different Failures

**Question** *(Hard)*:

Two lakehouses both accumulate small files past their Parquet file-count guardrail from unmaintained streaming writes. One feeds a Direct Lake on OneLake semantic model; the other feeds a Direct Lake on SQL semantic model. Both refreshes are attempted the same morning, before any `OPTIMIZE` is run. What should the team expect from each?

A. Both refreshes fail outright with no queryable model, since guardrail behavior is identical across variants  
B. Both models fall back to DirectQuery automatically and keep functioning, just at slower query speed  
C. The Direct Lake on SQL model fails outright, while the Direct Lake on OneLake model silently falls back to DirectQuery  
D. The Direct Lake on OneLake model fails and stays unqueryable until compaction runs; the SQL variant falls back and keeps serving  

> [!success]- Answer
> **D. The Direct Lake on OneLake model fails and stays unqueryable until compaction runs; the SQL variant falls back and keeps serving**
>
> Direct Lake guardrail behavior diverges sharply by variant: Direct Lake on OneLake has no DirectQuery fallback path at all, so exceeding guardrails behaves like Import mode — the refresh fails and the model is unqueryable until the underlying table is compacted back within limits. Direct Lake on SQL, by contrast, falls back to DirectQuery (if enabled), so the refresh succeeds with a warning and queries keep returning results, just at DirectQuery's slower latency.
>
> Option A flattens a documented, meaningful behavioral difference between the two variants into "identical." Option B is wrong for the OneLake variant specifically, which has no fallback mechanism to invoke. Option C reverses the actual pairing of variant to behavior.

---

## Question 25: Choosing Between a Materialized View and an Update Policy

**Question** *(Medium)*:

A team ingests raw sensor readings into an Eventhouse and needs two things: lightly parsing and typing each incoming event as it lands, and maintaining a deduplicated latest-reading-per-device result that dozens of dashboards query throughout the day. Which mechanism fits each need, and why not the other way around?

A. Update policy for the per-event parsing/typing  
B. Update policy for both needs, since it's the lower-cost mechanism in every case  
C. Materialized view for both needs, since dashboards should never query raw update-policy output directly  
D. Materialized view for the parsing, since it can run continuously; update policy for the dedup, since it happens once per ingested batch  

> [!success]- Answer
> **A. Update policy for the per-event parsing/typing**
>
> Its cost is folded into ingestion; materialized view for the deduplicated aggregate, since dozens of dashboards would otherwise each re-run the deduplication. The cost-profile split is exactly this: update policies fold a small, predictable transform cost into every ingested event — ideal for simple parsing/typing with no aggregation state — while materialized views pay an aggregation cost once, continuously, in the background, which is far cheaper than dozens of dashboard refreshes each re-running the same deduplication over raw data.
>
> Option B ignores that a per-event update policy doesn't maintain a queryable rolling aggregate the way a materialized view does — it would leave every dashboard re-deduplicating raw data on each refresh. Option C overstates the restriction; simple per-event transforms are exactly what update policies are for, materialized views aren't required for every downstream read. Option D swaps the two mechanisms' actual execution models — parsing has no aggregation state to maintain continuously, and deduplication is precisely the kind of repeated-read aggregate a materialized view is built for.

---

## Question 26: A Copy Activity That Won't Land in the Warehouse

**Question** *(Medium)*:

A Copy activity moving data from an Azure SQL Database into a Fabric Warehouse fails immediately with an unsupported-write-path error, even though the exact same source connector copies into a Lakehouse without any trouble. Staging is currently disabled on the Copy activity, and the team's first instinct is to raise DIUs from Auto to the 256 maximum. What's the actual cause, and what's the fix?

A. Raise DIUs from Auto to the 256 maximum — a Warehouse sink needs more allocated compute to accept the write than a Lakehouse sink does  
B. Enable staging on the Copy activity — a Fabric Warehouse sink doesn't accept every source type through a direct high-throughput write path the way a Lakehouse sink does  
C. Switch the sink's Write behavior from Insert to Upsert — Warehouse sinks reject a direct-path write unless conflict resolution is made explicit  
D. Configure a Partition option on the source — the same fix that resolves a single-threaded relational read applies here since the sink is a Warehouse  

> [!success]- Answer
> **B. Enable staging on the Copy activity — a Fabric Warehouse sink doesn't accept every source type through a direct high-throughput write path the way a Lakehouse sink does**
>
> Staging is documented as *required*, not optional, when the Copy activity's sink is a Fabric Warehouse — the Warehouse doesn't accept every source type through a direct high-throughput write path, so a Copy activity into it fails outright without staging turned on, regardless of DIU or parallelism settings. That's a different mechanism entirely from a single-threaded source read: this failure is about the sink's write path, not the source's read parallelism.
>
> Option A raises compute that was never the bottleneck — DIUs govern copy throughput once a write path exists, they don't create one. Option C invents a Write-behavior/staging relationship that isn't documented; Insert vs. Upsert governs conflict handling, not whether the write path is supported at all. Option D reaches for the fix that resolves a *different*, unrelated problem — a single-threaded source read from a missing Partition option — which has nothing to do with why a Warehouse-sink write fails without staging.

---

## Question 27: From a Vague "It's Slow" Report to a Fix

**Question** *(Hard)*:

A user reports that a nightly notebook "seems to run forever some nights and just fails on others." Which sequence correctly characterizes the symptom, reaches the likely diagnosis once a pattern of a few tasks running far longer than the rest before the job dies becomes visible, and applies the matching fix?

A. Open the Capacity Metrics app first, since this is a capacity-wide symptom → confirm `CapacityLimitExceeded` → scale up the SKU  
B. Open Dataflow Gen2 refresh history first, since "runs forever" always means query folding loss → redesign the query for folding → no Spark-side change needed  
C. Open Monitor hub's Historical runs first → confirm `SystemError` → rerun from the failed activity → no further action needed  
D. Open the Spark application detail page's Stages/Executors tabs → confirm executor OOM from data skew → enable AQE skew-join handling or repartition  

> [!success]- Answer
> **D. Open the Spark application detail page's Stages/Executors tabs → confirm executor OOM from data skew → enable AQE skew-join handling or repartition**
>
> This is the full monitor → diagnose → optimize chain for a single-item symptom: the Spark application detail page's Stages tab confirms the described pattern (a handful of tasks with far larger input than their peers), the Executors tab's exit code 137 confirms OOM, and data skew is the textbook cause of exactly this shape — a small subset of long-running tasks eventually killed for memory, not a uniform slowdown. Once stabilized with AQE skew-join handling or repartitioning, the native execution engine is a reasonable next lever for the steady-state, computationally heavy workload.
>
> Option A picks a capacity-wide surface for a symptom described on a single item, with no mention of other items being affected. Option B misapplies a Dataflow Gen2-specific performance concept to a Spark notebook entirely, and wrongly claims "runs forever" always means one specific thing. Option C stops at a generic rerun without ever diagnosing *why* the job is failing, and wrongly assumes every failure is a retry-worthy `SystemError`.

---

**[← Back to Practice Questions](./practice-questions.md)**
