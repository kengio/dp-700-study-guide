---
title: Dynamic Data Masking
type: topic
tags:
  - dp-700
  - fabric
  - security
  - dynamic-data-masking
  - ddm
  - security-governance
---

# Dynamic Data Masking

## Overview

**Dynamic data masking (DDM)** obfuscates sensitive column values in query results for unprivileged users, without changing the underlying stored data. It works on the Fabric Warehouse and SQL analytics endpoint using standard `MASKED WITH` column syntax and `UNMASK` permission grants. This topic covers the four mask functions, applying and removing masks, the `UNMASK` permission model (including its Fabric-specific workspace-role interaction), and why DDM is a usability control, not a security boundary.

> [!abstract]
>
> - Four mask functions: **default()**, **email()**, **random(m,n)**, and **custom string** (`partial()`)
> - Apply masks with `MASKED WITH (FUNCTION = '...')` at table creation, or `ALTER TABLE ... ALTER COLUMN ... ADD MASKED WITH (...)` on an existing column
> - `GRANT UNMASK` reveals real values to a specific user, role, or (per the permission table) at column granularity
> - ==DDM is not encryption== and does not prevent inference attacks — a user with query access can still guess masked values through crafted queries
> - Fabric-specific trap: workspace **Admin/Member/Contributor** roles (and anyone with `CONTROL` on the database) see unmasked data **by default**, with no explicit `UNMASK` grant needed

> [!tip] What the Exam Tests
>
> - Exact syntax for each of the four mask functions and their output format
> - `ALTER TABLE ... ALTER COLUMN ... ADD MASKED WITH` / `DROP MASKED` syntax
> - Which permission reveals unmasked data (`UNMASK`, or `CONTROL` on the database) and who has it implicitly
> - The exam's core trap: masking ≠ encryption, and doesn't block inference via crafted range queries

---

## Masking Functions

| Function | Description | Example |
| :--- | :--- | :--- |
| ==default()== | Full masking by data type: strings → `XXXX` (or shorter); numerics → `0`; dates → `1900-01-01 00:00:00.0000000`; binary → a single zero byte | `Gender char(1) MASKED WITH (FUNCTION = 'default()')` |
| ==email()== | Exposes the first letter and a constant `.com` suffix, in email shape | `aXXX@XXXX.com` |
| ==random(m, n)== | Random numeric value in a specified range — numeric types only | `MASKED WITH (FUNCTION = 'random(1, 100)')` |
| ==partial(prefix, "padding", suffix)== ("Custom String") | Exposes a configurable number of leading/trailing characters, with a custom padding string in between | `partial(1,"XXXXXXX",0)` turns `555.123.1234` into `5XXXXXXX` |

If the underlying value is too short to satisfy the full prefix/suffix length, `partial()` exposes what it can and pads the rest.

> [!warning] Common Mistake
> On-premises SQL Server also documents a `datetime()` masking function for partial date reveal — **Fabric Data Warehouse's own masking-functions reference lists only four**: `default()`, `email()`, `random(m,n)`, and `partial()`. Don't port a `datetime()` example from generic SQL Server training material into a Fabric scenario without checking Fabric's own function list first; date columns in Fabric are masked with `default()` (which fully replaces the value with a fixed date) rather than a dedicated partial-date function.

## Applying Masks

```sql
-- Define masks when creating the table
CREATE TABLE dbo.EmployeeData (
    EmployeeID  INT,
    FirstName   VARCHAR(50)  MASKED WITH (FUNCTION = 'partial(1,"-",2)') NULL,
    LastName    VARCHAR(50)  MASKED WITH (FUNCTION = 'default()') NULL,
    SSN         CHAR(11)     MASKED WITH (FUNCTION = 'partial(0,"XXX-XX-",4)') NULL,
    Email       VARCHAR(256) NULL
);
GO

INSERT INTO dbo.EmployeeData
VALUES (1, 'TestFirstName', 'TestLastName', '123-45-6789', 'email@youremail.com');
GO
```

`FirstName` shows only the first and last two characters with `-` in between; `LastName` shows `XXXX`; `SSN` shows `XXX-XX-` followed by the last four digits. `Email` has no mask applied yet.

Add or remove a mask on an existing column with `ALTER TABLE`:

```sql
-- Add a mask to an existing (previously unmasked) column
ALTER TABLE dbo.EmployeeData
ALTER COLUMN Email ADD MASKED WITH (FUNCTION = 'email()');
GO

-- Remove a mask
ALTER TABLE dbo.EmployeeData
ALTER COLUMN Email DROP MASKED;
GO
```

## Permissions and `UNMASK`

| Operation | Required permission |
| :--- | :--- |
| Create a table with masked columns | `CREATE TABLE` + `ALTER` on the schema |
| Add, replace, or remove a mask on a column | `ALTER ANY MASK` + `ALTER` on the table |
| View masked data (default behavior) | `SELECT` on the table |
| ==View unmasked data== | `UNMASK` on the column, or `CONTROL` on the database |

```sql
-- Grant a specific user the ability to see real values on this table
GRANT UNMASK ON dbo.EmployeeData TO [TestUser@contoso.com];

-- Revoke it again
REVOKE UNMASK ON dbo.EmployeeData FROM [TestUser@contoso.com];

-- Grant/revoke to a role instead of an individual user (preferred at scale)
GRANT UNMASK ON dbo.EmployeeData TO [TestRole];
REVOKE UNMASK ON dbo.EmployeeData FROM [TestRole];
```

`CONTROL` on the database bundles both `ALTER ANY MASK` and `UNMASK` — anyone with `CONTROL` sees unmasked data automatically, with no separate `UNMASK` grant required.

> [!warning] Common Mistake
> **Fabric workspace Admin, Member, and Contributor roles carry `CONTROL` permission on the Warehouse database by design** — they see unmasked data by default, without ever being explicitly granted `UNMASK`. This differs from a plain on-premises SQL Server mental model where only `db_owner`/`sysadmin` bypass masking. A scenario asking "does a workspace Contributor need `GRANT UNMASK` to see real values" has one answer: **no** — they already have it implicitly through their workspace role. Only users **without** Admin/Member/Contributor and without elevated Warehouse permissions actually see masked output.

**Practice Question 1** *(Easy)*

A column is masked with `email()`. A user with the Contributor workspace role queries the table. What do they see?

A. The masked value, `aXXX@XXXX.com`  
B. The real, unmasked email address — Contributor has implicit CONTROL  
C. An access-denied error, since Contributor lacks explicit UNMASK  
D. NULL, because Contributor's queries bypass the column entirely  

> [!success]- Answer
> **B. The real, unmasked email address — Contributor has implicit CONTROL**
>
> Admin, Member, and Contributor workspace roles automatically carry `CONTROL` permission on the Warehouse database, which includes `UNMASK`. They see real values without any explicit `GRANT UNMASK` — DDM only masks data for users **without** those elevated roles/permissions.

---

## Exam Trap: Masking Is Not Encryption

DDM changes what a **query result** displays — it never touches the bytes stored on disk. Any user with `SELECT` access (masked or not) can still run crafted queries to infer real values through **inference/brute-force**, because the underlying comparison still operates on real data even though the returned value is masked:

```sql
-- Salary is MASKED WITH (FUNCTION = 'default()') — displays as 0 to unprivileged users
SELECT ID, Name, Salary FROM Employees
WHERE Salary > 99999 AND Salary < 100001;
```

```text
ID     Name        Salary
62543  Jane Doe    0
91245  John Smith  0
```

The `Salary` column still shows `0`, but the `WHERE` clause narrowed the result to only employees earning between $99,999 and $100,001 — confirming both employees' salaries fall in that exact range, without ever displaying the real number. Repeating this with narrower ranges eventually pins down the exact value.

> [!warning] Common Mistake
> A question describing "DDM fully protects sensitive data from users with query access" is describing something DDM explicitly does **not** do. Microsoft's own guidance: *"Don't use dynamic data masking alone to fully secure sensitive data from users with query access to the Warehouse or SQL analytics endpoint."* Pair DDM with RLS, CLS, or OLS ([02-Granular Access Controls](./02-granular-access-controls.md)) for actual access control — DDM only helps against **accidental** exposure, not a determined or malicious query author.

> [!note] Mental model — Frosted glass, not a locked door
> DDM is frosted glass on a window, not a locked door. Someone on the other side can't read the fine print directly (the masked value), but they can still shine a bright, precisely-aimed light through it (a crafted range query) and infer roughly what's behind the glass through trial and error. A locked door (RLS/CLS/OLS) prevents entry outright; frosted glass just makes casual glancing harder.

**Practice Question 2** *(Medium)*

A security team wants to fully prevent analysts from ever determining a specific employee's exact salary, even through repeated targeted queries. Is applying DDM's `default()` mask on the `Salary` column sufficient on its own?

A. Yes — `default()` fully hides all numeric values with no inference risk  
B. No — DDM only obscures displayed values; a range-based WHERE clause can still narrow down the real value through repeated queries  
C. Yes, but only if combined with the `random()` function instead of `default()`  
D. No — DDM doesn't apply to numeric columns at all  

> [!success]- Answer
> **B. No — DDM only obscures displayed values; a range-based WHERE clause can still narrow down the real value through repeated queries**
>
> DDM never restricts *which rows* satisfy a `WHERE` predicate — it only changes what's displayed in the result set. An analyst with ongoing `SELECT` access can iteratively narrow a range filter to infer the real salary regardless of which mask function is applied. Actual prevention requires blocking access to the column/row via CLS, RLS, or OLS — DDM is not a substitute.

---

## DDM vs. RLS/CLS at a Glance

| Aspect | Dynamic Data Masking | RLS / CLS / OLS |
| :--- | :--- | :--- |
| What's hidden | Column **values** (row still returned) | Entire **rows** (RLS) or **columns** (CLS), or object access outright (OLS) |
| Enforcement point | Presentation of query results | Query execution itself — restricted data is never retrieved |
| Blocks inference? | ==No== | Yes — a blocked row/column simply isn't queryable at all |
| Bypassed by | `UNMASK` grant, or database `CONTROL` (implicit for Admin/Member/Contributor) | Explicit `GRANT`, or exemption logic in the RLS predicate function |
| Typical pairing | Layered **on top of** RLS/CLS/OLS for defense in depth | The actual access-blocking layer DDM complements |

**Practice Question 3** *(Hard)*

A Warehouse table has `SSN` masked with `partial(0,"XXX-XX-",4)`. A support analyst without `UNMASK` runs `SELECT SSN FROM Customers WHERE SSN = '123-45-6789'`. What does the query return?

A. An error, because the WHERE clause can't reference a masked column  
B. `NULL` for every matching row  
C. The masked value `XXX-XX-6789` for any row where the underlying SSN actually equals `'123-45-6789'` — confirming that exact SSN exists in the table  
D. The full unmasked SSN, since equality predicates bypass masking  

> [!success]- Answer
> **C. The masked value `XXX-XX-6789` for any row where the underlying SSN actually equals `'123-45-6789'` — confirming that exact SSN exists in the table**
>
> The `WHERE` clause evaluates against the real, unmasked stored value — masking only changes what's *displayed* in the result set. A match confirms the guessed SSN is correct even though the displayed value is still masked; this is the exact inference mechanism the "Exam Trap" section above describes, just with an equality predicate instead of a range. Options A and D describe protections DDM doesn't actually provide, and B is simply incorrect — a matching row is still returned, just with a masked (not null) value.

## Managing and Cleaning Up Masks

```sql
-- View which columns are currently masked
SELECT * FROM sys.masked_columns;

-- Drop the demo table used in these examples
DROP TABLE dbo.EmployeeData;
```

Prerequisites worth remembering for a hands-on scenario: masking rules are defined via ordinary SQL script in the Warehouse's **New SQL query** editor; testing requires two accounts — an "admin" account (Admin/Member/Contributor, or elevated Warehouse permission) to configure masks and grant/revoke `UNMASK`, and a "test user" account *without* those roles to actually observe masked vs. unmasked behavior.

### End-to-End Test Walkthrough

```sql
-- 1. (admin account) Create and populate a table with masked columns
CREATE TABLE dbo.EmployeeData (
    EmployeeID INT,
    FirstName  VARCHAR(50) MASKED WITH (FUNCTION = 'partial(1,"-",2)') NULL,
    LastName   VARCHAR(50) MASKED WITH (FUNCTION = 'default()') NULL,
    SSN        CHAR(11)    MASKED WITH (FUNCTION = 'partial(0,"XXX-XX-",4)') NULL,
    email      VARCHAR(256) NULL
);
GO
INSERT INTO dbo.EmployeeData VALUES (1, 'TestFirstName', 'TestLastName', '123-45-6789', 'email@youremail.com');
GO

-- 2. (test user account, no elevated role) Confirm masked output
SELECT * FROM dbo.EmployeeData;
-- FirstName: T-------e | LastName: XXXX | SSN: XXX-XX-6789

-- 3. (admin account) Grant UNMASK to the test user
GRANT UNMASK ON dbo.EmployeeData TO [TestUser@contoso.com];

-- 4. (test user account) Confirm real values are now visible
SELECT * FROM dbo.EmployeeData;

-- 5. (admin account) Revoke UNMASK again
REVOKE UNMASK ON dbo.EmployeeData FROM [TestUser@contoso.com];

-- 6. (test user account) Confirm masked output has returned
SELECT * FROM dbo.EmployeeData;
```

This six-step sequence — configure as admin, verify masked as test user, grant `UNMASK`, verify unmasked, revoke, verify masked again — is the canonical way Microsoft's own documentation demonstrates DDM behavior, and mirrors how a scenario question is likely to walk through a masking configuration.

## Fabric vs. On-Premises SQL Server DDM

Fabric's DDM builds on the same T-SQL feature as on-premises SQL Server, but a few Fabric-specific differences are worth isolating for the exam:

| Aspect | On-premises SQL Server | Fabric Warehouse / SQL analytics endpoint |
| :--- | :--- | :--- |
| Mask functions available | `default()`, `email()`, `random()`, `partial()`, plus `datetime()` on some versions | `default()`, `email()`, `random()`, `partial()` only |
| Who bypasses masking by default | `db_owner` members, `sysadmin` | Workspace Admin/Member/Contributor (via implicit `CONTROL`), or anyone with elevated Warehouse permission |
| `CREATE USER` for a masked-table principal | Explicit `CREATE USER` statement | Not supported directly — `GRANT`/`DENY` auto-creates the database user |
| Applies to | Any SQL Server database | Only Warehouse and SQL analytics endpoint — not Lakehouse files accessed via Spark/OneLake APIs |

> [!note]
> DDM has **no OneLake-security equivalent** — masking only exists at the T-SQL layer. A Spark notebook reading the same underlying Delta table directly through OneLake sees the real, unmasked values regardless of any DDM configured on the Warehouse/SQL analytics endpoint surface. If masking-equivalent protection is needed for Spark consumers, it has to be implemented in the notebook logic itself or via a governed, pre-masked copy of the data.

## Use Cases

- Masking customer PII (SSN, credit card, phone) in a shared analytics Warehouse used by both privileged data engineers and lower-trust business analysts
- Giving customer support agents access to a masked `Email` column so they can confirm an account exists without seeing the full address
- Letting developers run realistic queries against masked production data copies without exposing real values in query results or screenshots

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| A Contributor sees unmasked data despite no explicit UNMASK grant | Admin/Member/Contributor carry implicit `CONTROL` on the database | Expected behavior — restrict via workspace role assignment, not DDM, if this user shouldn't see real values |
| `ALTER COLUMN ... ADD MASKED` fails | Missing `ALTER ANY MASK` and/or `ALTER` on the table | Grant both permissions to the user applying the mask |
| A "restricted" user can still infer real values | DDM doesn't prevent inference via crafted range queries | Layer RLS/CLS/OLS on the column/table; don't rely on DDM alone |
| `GRANT UNMASK` doesn't seem to apply | Grant targeted the wrong principal (user vs. role) or the user still lacks basic `SELECT` | Confirm the grantee and that base `SELECT` on the table is also present |

## Best Practices

- Grant `UNMASK` to **roles**, not individual users, for the same manageability reasons as CLS
- Always combine DDM with RLS/CLS/OLS for genuinely sensitive columns — treat DDM as a UX safeguard against accidental exposure, never as the sole control
- Remember Admin/Member/Contributor bypass masking implicitly — if a workspace-level role shouldn't see real values, the fix is the workspace role assignment, not a DDM configuration change
- Use `sys.masked_columns` to audit which columns currently carry a mask before assuming coverage

## Exam Tips

> [!tip] Exam Tips
>
> - Four mask functions: `default()`, `email()`, `random(m,n)`, `partial()` (a.k.a. Custom String)
> - `ALTER TABLE ... ALTER COLUMN ... ADD MASKED WITH (FUNCTION = '...')` adds a mask to an existing column; `DROP MASKED` removes it
> - `UNMASK` permission (or `CONTROL` on the database) reveals real values; Admin/Member/Contributor workspace roles have `CONTROL` implicitly
> - DDM is **not encryption** and does **not** prevent inference via crafted `WHERE`-clause range queries — the single most tested fact in this topic
> - Combine DDM with RLS/CLS/OLS for genuine data protection; DDM alone only guards against accidental exposure

## Key Takeaways

- DDM masks column *values* at query time without altering stored data — four mask functions cover strings, emails, numerics, and partial reveals
- `GRANT UNMASK` (or database `CONTROL`) reveals real values; Fabric workspace Admin/Member/Contributor have this implicitly
- DDM does not block inference attacks via range queries — it is a usability control, not encryption or access control
- Pair DDM with RLS/CLS/OLS from [02-Granular Access Controls](./02-granular-access-controls.md) for actual protection against a determined user

## Related Topics

- [02-Granular Access Controls](./02-granular-access-controls.md)
- [05-Governance](./05-governance.md)

## Official Documentation

- [Dynamic data masking in Fabric data warehousing](https://learn.microsoft.com/en-us/fabric/data-warehouse/dynamic-data-masking)
- [How to implement dynamic data masking in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/howto-dynamic-data-masking)
- [SQL granular permissions in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/sql-granular-permissions)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./03-onelake-security.md) | [↑ Back to Section](./security-governance.md) | [Next →](./05-governance.md)**
