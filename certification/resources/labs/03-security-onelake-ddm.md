---
title: "Lab 03: Security, OneLake & DDM"
type: lab
tags:
  - dp-700
  - fabric
  - hands-on
  - lab
  - security
  - row-level-security
  - column-level-security
  - dynamic-data-masking
  - onelake-security
  - governance
status: complete
---

# Lab 03: Security, OneLake & DDM

## Overview

The highest exam-trap density in the whole guide, made concrete: workspace roles vs. item permissions, OneLake data access roles scoped to a folder, and a complete, runnable RLS + CLS + DDM sequence in a new Warehouse — all against the synthetic PII column (`ssn`) generated in Lab 01. Closes with sensitivity labels, endorsement, and a look at the audit log.

> [!abstract]
>
> - Exercises workspace roles vs. item permissions as two independent access layers (single-user simulation documented if you have no second test account)
> - Creates a **OneLake data access role** scoped to a single folder in `lh_bronze`
> - Creates a Warehouse (`wh_gold`) with a `Customers` table carrying real PII columns, then layers **RLS** (`CREATE SECURITY POLICY`), **CLS** (`GRANT SELECT ON table(cols)`), and **DDM** (`MASKED WITH`) on top — fully runnable T-SQL
> - Applies a sensitivity label and an endorsement tier, then reviews audit log entries

> [!info] Prerequisites
> [Lab 01](./01-workspace-capacity-setup.md) completed — `dp700-labs` workspace with `lh_bronze` and its `customers` table (which includes the `ssn` column this lab masks). A second Microsoft Entra test account is **optional** — a documented single-user fallback covers every step.
>
> **Estimated time:** 50 minutes

---

## Steps

### Step 1: Workspace roles exercise

**If you have a second test account** (recommended — an Entra guest or a second license in your tenant):

1. In `dp700-labs`: **Manage access → Add people or groups**.
2. Add the test account with the **Viewer** role.
3. Sign in as the test account (or use an InPrivate/incognito browser window) and confirm: the account can open `lh_bronze`'s reports and query via the SQL analytics endpoint (ReadData/TDS), but **cannot** browse Lakehouse explorer or read via Spark/OneLake APIs (ReadAll) — Viewer doesn't include ReadAll by default.

**If you don't have a second account** (single-user simulation):

1. Open `dp700-labs` → **Manage access** and simply **read** the current role assignment (you, as Admin/creator) without changing it.
2. Instead of testing Viewer's restrictions live, verify the capability matrix from memory against [01-Workspace & Item Access](../../03-security-governance/01-workspace-item-access.md#workspace-roles): Viewer gets ReadData (TDS/T-SQL) but not ReadAll (OneLake APIs/Spark); Contributor+ gets both.

> [!success] Expected result
> You can state, correctly, which of the four workspace roles gets ReadAll access via OneLake APIs/Spark (Admin/Member/Contributor) and which doesn't (Viewer) — the single most-tested fact in this topic.

### Step 2: Item permissions independent of workspace role

1. In `dp700-labs`, select `lh_bronze` → **Share**.
2. If using a second account: share directly with it, granting **Read** only (leave Reshare/Write unchecked). Confirm the recipient can see `lh_bronze` in their item list even with no workspace role.
3. If solo: read the share dialog's permission checkboxes (Read/Write/Reshare) without completing the share, and note in your own words why removing an **item** share doesn't revoke access for someone who *also* holds a workspace role — the two layers are independent (see [01-Workspace & Item Access § Removing and Auditing Access](../../03-security-governance/01-workspace-item-access.md#removing-and-auditing-access)).

> [!success] Expected result
> You can describe the "two independent doors" mental model without notes: workspace role is the front door to the whole workspace; item sharing is a side door into one specific room.

### Step 3: Create a OneLake data access role scoped to a folder

1. Open `lh_bronze` → **Manage OneLake data access** (or **Security** tab, depending on portal version).
2. Select **+ New role**. Name: `role-customers-reader`.
3. Under **Folders**, scope the role to **`Tables/customers`** only (not the whole lakehouse).
4. Under **Members**, add your test account (or, solo, just note where you'd add one) — and **remove** that account from the `DefaultReader` role if it's a member there, since DefaultReader's virtual membership via `ReadAll` would otherwise grant it access to everything anyway, defeating the folder scope.
5. Select **Publish**.

> [!success] Expected result
> `role-customers-reader` appears in the lakehouse's OneLake security roles list, scoped to exactly one folder. A member of this role (and *not* also in DefaultReader) can read `Tables/customers` via Spark/OneLake APIs but gets an authorization error reading `Tables/products` or any other folder.

> [!warning] Common Mistake
> Forgetting to remove a test member from `DefaultReader` is the most common reason this exercise "doesn't work" — `DefaultReader`'s virtual membership via the `ReadAll` permission grants full access regardless of any narrower role you just created, silently overriding the folder scoping (see [03-OneLake Security](../../03-security-governance/03-onelake-security.md)).

### Step 4: Create the `wh_gold` warehouse and a PII-bearing table

1. In `dp700-labs`, select **+ New item → Warehouse**. Name: `wh_gold`.
2. Open the **New SQL query** editor and run:

```sql
CREATE TABLE dbo.Customers (
    CustomerID   INT,
    CustomerName VARCHAR(100),
    Region       VARCHAR(20),
    Email        VARCHAR(256),
    SSN          CHAR(11)
);
GO

INSERT INTO dbo.Customers (CustomerID, CustomerName, Region, Email, SSN) VALUES
    (1, 'Customer 1',  'EAST',  'customer1@example.com',  '123-45-6001'),
    (2, 'Customer 2',  'WEST',  'customer2@example.com',  '123-45-6002'),
    (3, 'Customer 3',  'NORTH', 'customer3@example.com',  '123-45-6003'),
    (4, 'Customer 4',  'SOUTH', 'customer4@example.com',  '123-45-6004'),
    (5, 'Customer 5',  'EAST',  'customer5@example.com',  '123-45-6005');
GO

SELECT * FROM dbo.Customers ORDER BY CustomerID;
```

> [!success] Expected result
> Five rows return with all columns visible, including plaintext `SSN` and `Email` — no security applied yet. This mirrors the `customers` table's `ssn` column generated in Lab 01, kept self-contained here as ordinary T-SQL so the RLS/CLS/DDM sequence below doesn't depend on a cross-item Spark write.

### Step 5: Row-level security — filter by region

```sql
CREATE SCHEMA Security;
GO

CREATE FUNCTION Security.tvf_regionpredicate(@Region AS varchar(20))
    RETURNS TABLE
WITH SCHEMABINDING
AS
    RETURN SELECT 1 AS tvf_regionpredicate_result
    WHERE @Region = 'EAST' OR USER_NAME() = 'manager@contoso.com';
GO

CREATE SECURITY POLICY CustomerRegionFilter
ADD FILTER PREDICATE Security.tvf_regionpredicate(Region)
ON dbo.Customers
WITH (STATE = ON);
GO

-- Run as yourself (workspace Admin/Member/Contributor) to confirm the policy is active:
SELECT CustomerID, CustomerName, Region FROM dbo.Customers ORDER BY CustomerID;
```

> [!success] Expected result
> Because Fabric Warehouse RLS filters **every** querying principal — including you, even as workspace Admin — the query returns only the `EAST`-region rows (customers 1 and 5) unless your `USER_NAME()` happens to equal `'manager@contoso.com'`. This is the opposite bypass behavior from DDM below: T-SQL RLS has no workspace-role exemption at all (see [02-Granular Access Controls § Who Bypasses What](../../03-security-governance/02-granular-access-controls.md#who-bypasses-what-role--security-mechanism)).

### Step 6: Column-level security — hide SSN from a role

```sql
CREATE ROLE AnalystRole;
GO

GRANT SELECT ON dbo.Customers(CustomerID, CustomerName, Region, Email)
    TO AnalystRole;
GO

-- Add yourself to AnalystRole to feel the CLS block directly (optional — reverse with sp_droprolemember after testing):
-- EXEC sp_addrolemember 'AnalystRole', 'your-upn@yourtenant.onmicrosoft.com';

-- A SELECT * as a member of AnalystRole (with no SELECT grant on SSN) fails outright:
-- SELECT * FROM dbo.Customers;
-- Msg 230: The SELECT permission was denied on the column 'SSN' ...
```

> [!success] Expected result
> `AnalystRole` now has `SELECT` on every `Customers` column except `SSN`. If you add yourself to the role and run `SELECT *`, you get a hard permission error naming the `SSN` column — not a silently dropped column. Query only the granted columns, or don't add yourself to the role, to keep working through the rest of the lab.

### Step 7: Object-level security — schema-level GRANT/DENY

```sql
-- Grant read on the whole dbo schema to AnalystRole (broader than the single-table CLS grant above)
GRANT SELECT ON SCHEMA::dbo TO AnalystRole;
GO

-- DENY always overrides any GRANT, including one inherited through role membership —
-- even the schema-level grant just above.
DENY SELECT ON dbo.Customers TO AnalystRole;
GO

-- Confirm effective permissions for the role/object combination:
SELECT * FROM sys.fn_my_permissions('dbo.Customers', 'Object');

-- Clean up the DENY once you've seen it take effect, so AnalystRole's CLS grant
-- from Step 6 is reachable again:
REVOKE SELECT ON dbo.Customers FROM AnalystRole;
GO
```

> [!success] Expected result
> Even though `AnalystRole` holds a schema-level `SELECT` grant (which would otherwise cover `Customers`), the table-level `DENY` blocks it outright — `DENY` always wins over `GRANT`, at any scope, including one inherited through a broader grant. After the final `REVOKE`, `AnalystRole` returns to exactly the Step 6 state (CLS grant on all columns except `SSN`, no table-level `DENY`).

> [!warning] Common Mistake
> `REVOKE` is not the same as `DENY`. `REVOKE` only erases a specific grant/deny entry — if the principal has access through another path (a different role, a schema-level grant), that access remains. `DENY` is the only mechanism that guarantees access is blocked regardless of any other role membership. See [02-Granular Access Controls § Object-Level Security](../../03-security-governance/02-granular-access-controls.md#object-level-security-ols).

### Step 8: Dynamic data masking — mask SSN and Email

```sql
ALTER TABLE dbo.Customers
ALTER COLUMN SSN ADD MASKED WITH (FUNCTION = 'partial(0,"XXX-XX-",4)');
GO

ALTER TABLE dbo.Customers
ALTER COLUMN Email ADD MASKED WITH (FUNCTION = 'email()');
GO

-- As yourself (Admin/Member/Contributor — implicit CONTROL bypasses DDM):
SELECT CustomerID, Email, SSN FROM dbo.Customers ORDER BY CustomerID;
```

> [!success] Expected result
> `SSN` shows as `XXX-XX-6001` etc. (last four digits visible); `Email` shows as `cXXX@XXXX.com`-style output — **unless** you're querying as Admin/Member/Contributor, in which case you see the real values, because those roles carry implicit `CONTROL` on the Warehouse database, which bundles `UNMASK`. This is the DDM-specific bypass — the opposite of Step 5's RLS, which exempted nobody.

```sql
-- Prove the masking-isn't-encryption trap: a range query still leaks information
-- even though the displayed SSN stays masked.
SELECT CustomerID, SSN FROM dbo.Customers
WHERE SSN = '123-45-6003';
```

> [!success] Expected result
> A matching row returns with `SSN` still shown masked (`XXX-XX-6003`) — but the fact that a row came back at all confirms customer 3's real SSN is exactly `123-45-6003`. This is the inference trap from [04-Dynamic Data Masking](../../03-security-governance/04-dynamic-data-masking.md#exam-trap-masking-is-not-encryption): DDM changes what's *displayed*, never what the `WHERE` clause evaluates against.

### Step 9: Sensitivity label (optional, tenant-dependent)

1. Open `wh_gold` → item settings → **Sensitivity label** (or the label icon in the top toolbar).
2. If your tenant has Microsoft Purview Information Protection labels published, apply one (e.g., "Confidential" or "Highly Confidential").
3. If no labels appear, this feature requires tenant-level Purview licensing and label publishing that a personal trial tenant may not have configured — skip and read [05-Governance § Sensitivity Labels](../../03-security-governance/05-governance.md#sensitivity-labels) instead.

> [!success] Expected result
> Either a label is visibly applied to `wh_gold` (shown next to the item name), or you can explain why none was available and what "downstream inheritance" would mean for it (Fabric → Fabric ✅, Fabric → Power BI ✅, Power BI → Fabric ❌).

### Step 10: Endorsement — Promote the warehouse

1. Open `wh_gold` → item settings → **Endorsement**.
2. Select **Promoted** → **Apply**. This tier requires only write permission on the item, which you have as the creator.
3. Try selecting **Certified** — note that it's greyed out unless you're on your tenant's Fabric-admin-authorized reviewer list, which a personal trial tenant typically has nobody on yet.

> [!success] Expected result
> `wh_gold` shows a **Promoted** badge in the workspace item list. You can explain, without trying it, why **Certified** and **Master data** require tenant-admin authorization on top of write permission — Promoted doesn't.

### Step 11: View audit log entries

1. Navigate to [https://purview.microsoft.com/audit](https://purview.microsoft.com/audit) (requires the Audit Logs or View-Only Audit Logs role — a personal trial tenant admin typically has this by default).
2. Set a date range covering the last hour, leave **Activities** and **Users** blank, and search.
3. Look for entries corresponding to this lab's actions — item creation (`wh_gold`), sharing, or label changes.

> [!success] Expected result
> Either matching entries appear (audit propagation can take up to 30–60 minutes, so an empty result immediately after your actions is expected, not a failure), or you can state where to look and what setting gates it: **Power BI admin portal → Audit logs** must be enabled for Fabric/Power BI-specific activities to appear in unified audit search at all.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Test account in Step 3 can read every folder, not just `Tables/customers` | Still a member of `DefaultReader`, whose virtual `ReadAll` membership overrides the narrower role | Remove the account from `DefaultReader` explicitly — adding it to a scoped role alone isn't enough |
| Step 5's RLS query returns all rows for you, not just `EAST` | You queried as `manager@contoso.com` (the predicate's explicit exemption), or the policy's `STATE` wasn't set to `ON` | Confirm `STATE = ON` on the security policy, and check `USER_NAME()` against the predicate's exemption clause |
| `ALTER FUNCTION` on `tvf_regionpredicate` fails | An active `CREATE SECURITY POLICY` still references it | `DROP SECURITY POLICY CustomerRegionFilter` first, alter the function, then recreate the policy |
| Step 6/7's `SELECT *` unexpectedly succeeds with all columns visible | You're querying as Admin/Member/Contributor, whose implicit `CONTROL` bypasses both CLS's missing grant and DDM's mask | Expected for elevated roles — test the actual restriction with a lower-privileged test account, or trust the T-SQL behavior described in the topic file |
| DDM mask doesn't apply after `ALTER TABLE ... ADD MASKED` | Missing `ALTER ANY MASK` and/or `ALTER` on the table | Grant both permissions to the user applying the mask, or run as Admin/Member/Contributor |
| Certified endorsement option stays greyed out | You're not on the tenant's Fabric-admin-authorized reviewer list — write permission alone isn't sufficient | Expected on a personal trial tenant; use Promoted instead, or have a Fabric admin authorize you as a reviewer |

## Cleanup

**Keep**:

- `wh_gold`, its `dbo.Customers` table, the RLS security policy, the CLS grant, and both DDM masks — [Lab 08](./08-warehouse-tsql.md) builds directly on this warehouse and its security configuration
- The `role-customers-reader` OneLake data access role on `lh_bronze` (harmless to leave; no later lab depends on removing it)

**Clean up if you tested with a live second account**:

- If you added yourself to `AnalystRole` in Step 6 to feel the CLS block, remove yourself afterward so you aren't locked out of `SSN` for later labs: `EXEC sp_droprolemember 'AnalystRole', 'your-upn@yourtenant.onmicrosoft.com';`
- If you shared `lh_bronze` with a test account in Step 2 purely for the exercise, revoke that share if the account was borrowed/temporary

## What the Exam Asks About This

- [01-Workspace & Item Access](../../03-security-governance/01-workspace-item-access.md) — role capability matrix, ReadData vs. ReadAll, item permissions vs. workspace role
- [02-Granular Access Controls](../../03-security-governance/02-granular-access-controls.md) — RLS/CLS/OLS syntax, the role × mechanism bypass matrix
- [03-OneLake Security](../../03-security-governance/03-onelake-security.md) — data access roles, DefaultReader, folder scoping
- [04-Dynamic Data Masking](../../03-security-governance/04-dynamic-data-masking.md) — mask functions, `UNMASK`, masking-is-not-encryption
- [05-Governance](../../03-security-governance/05-governance.md) — sensitivity labels, endorsement tiers, audit logs

---

**[← Previous: Lab 02](./02-lifecycle-git-deployment.md) | [↑ Back to Labs Index](./labs.md) | [Next → Lab 04: Orchestration](./04-orchestration-pipelines-notebooks.md)**
