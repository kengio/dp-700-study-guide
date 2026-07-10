---
title: Granular Access Controls
type: topic
tags:
  - dp-700
  - fabric
  - security
  - row-level-security
  - column-level-security
  - object-level-security
  - security-governance
---

# Granular Access Controls

## Overview

Beyond workspace roles and item permissions, the Fabric **Warehouse and SQL analytics endpoint** support standard T-SQL granular security: **row-level security (RLS)** filters which rows a query returns, **column-level security (CLS)** blocks access to entire columns, and **object-level security (OLS)** governs GRANT/DENY on tables, views, schemas, and other securables. A separate mechanism, **OneLake data access roles**, applies folder/table-level control directly in OneLake, independent of SQL. This topic covers the T-SQL syntax for each and gives a decision matrix for choosing the right layer.

> [!abstract]
>
> - **RLS**: `CREATE SECURITY POLICY` binds a predicate inline table-valued function to a table — filters rows silently on `SELECT`/`UPDATE`/`DELETE`
> - **CLS**: standard `GRANT SELECT ON table(col1, col2, ...)` — omit sensitive columns from the grant to block them
> - **OLS**: standard T-SQL `GRANT`/`REVOKE`/`DENY` on schemas, tables, views, and other securables — `DENY` always wins
> - **OneLake data access roles** apply the same idea (read restriction) at the folder/table level in OneLake, enforced independent of the SQL analytics endpoint
> - **DDM** (covered separately in [04-Dynamic Data Masking](./04-dynamic-data-masking.md)) obscures values rather than blocking access — layer it with RLS/CLS/OLS, don't substitute one for the other

> [!tip] What the Exam Tests
>
> - Exact `CREATE SECURITY POLICY` / predicate function syntax for RLS, including `WITH SCHEMABINDING`, and that Fabric Warehouse RLS supports FILTER predicates only (no BLOCK predicate support)
> - `GRANT SELECT ON table(columns)` syntax for CLS, and that it's Microsoft Entra-only authentication
> - Standard `GRANT`/`REVOKE`/`DENY` T-SQL for OLS, and that `DENY` overrides any `GRANT` including inherited role grants
> - Choosing the right control layer for a given scenario — SQL endpoint (RLS/CLS/OLS) vs. OneLake security vs. semantic model RLS
> - Which workspace roles **bypass** each granular control mechanism — the bypass logic differs by mechanism and is a frequent scenario trap

---

## Who Bypasses What: Role × Security Mechanism

Every granular control layer in Fabric has its own, independent answer to "which workspace roles see everything regardless of the rule?" Getting this table wrong is one of the most common sources of missed scenario questions in this topic — a mechanism that blocks *everyone* (T-SQL RLS) sits right next to one that a workspace Contributor bypasses by default (DDM).

| Mechanism | Viewer | Contributor | Member | Admin | Why |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Semantic model DAX RLS | ==filtered== | sees all | sees all | sees all | DAX RLS enforcement binds only at the **Viewer** role — Contributor+ already has blanket view/modify access to all workspace content, which supersedes row filtering |
| Warehouse T-SQL RLS | ==filtered== | ==filtered== | ==filtered== | ==filtered== | `CREATE SECURITY POLICY` filter predicates apply to **every** querying principal, including `dbo` and `db_owner` members — no workspace role is exempted |
| Warehouse DDM | ==masked== | sees all | sees all | sees all | Contributor/Member/Admin carry implicit `CONTROL` on the Warehouse database, which bundles `UNMASK`; only Viewer lacks it unless explicitly granted `UNMASK` |
| OneLake security data access roles | ==filtered== | sees all | sees all | sees all | Admin/Member/Contributor's implicit workspace **Write** permission overrides the OneLake security role's read restriction; Viewer has no such override |

> [!note] Mental model — bypass logic
> Two different bypass rules are at work here, and mixing them up is the trap. **SQL-layer RLS ignores `CONTROL` entirely** — it's a query-execution-time filter that doesn't care what permission level issued the query, so it catches even `db_owner`. **DDM and OneLake security both honor the workspace role's implicit permissions** (`CONTROL` for DDM, **Write** for OneLake security) — Contributor+ sails through both. **DAX RLS only binds at Viewer** — it's a reporting-layer control that a higher workspace role simply outranks. Three different bypass mechanisms, three different answers — never assume one control's bypass rule applies to another.

**Practice Question 1** *(Hard)*

A Warehouse table has a T-SQL RLS filter predicate (`CREATE SECURITY POLICY`) restricting rows to each salesperson's own region, and the `Commission` column is masked with DDM's `default()` function. A user with the workspace **Contributor** role, and no explicit `UNMASK` grant, queries the table. What does the Contributor see?

A. Every row, with `Commission` unmasked — Contributor bypasses both RLS and DDM  
B. Only their own region's rows, with `Commission` unmasked — RLS still filters, but implicit `CONTROL` bypasses DDM  
C. Every row, with `Commission` masked — Contributor bypasses RLS but not DDM  
D. Only their own region's rows, with `Commission` masked — Contributor bypasses neither control  

> [!success]- Answer
> **B. Only their own region's rows, with `Commission` unmasked — RLS still filters, but implicit `CONTROL` bypasses DDM**
>
> These two mechanisms have opposite bypass behavior. T-SQL RLS filter predicates apply to every querying principal with no workspace-role exemption, so the Contributor still only sees their own region's rows. DDM, however, is bypassed by the implicit `CONTROL` permission that Admin/Member/Contributor all carry on the Warehouse database — so `Commission` displays unmasked even without an explicit `GRANT UNMASK`. The two controls are evaluated independently; one being bypassed says nothing about the other.

---

## Row-Level Security (RLS)

RLS in Fabric Warehouse and SQL analytics endpoint uses the same `CREATE SECURITY POLICY` mechanism as SQL Server: a **filter predicate**, defined as a schema-bound inline table-valued function, silently filters rows from `SELECT`, `UPDATE`, and `DELETE`. RLS applies to queries on the Warehouse or SQL analytics endpoint — Power BI queries against a warehouse in Direct Lake mode automatically fall back to DirectQuery mode to respect it.

==Fabric Warehouse RLS supports FILTER predicates only== — there's no BLOCK predicate type as in on-premises Azure SQL/SQL Server. A scenario option describing a "block predicate" for Fabric Warehouse RLS is describing a SQL Server/Azure SQL-only feature and is a reliable distractor to eliminate.

```sql
-- 1. Create a schema and sample table
CREATE SCHEMA sales;
GO

CREATE TABLE sales.Orders (
    SaleID      INT,
    SalesRep    VARCHAR(100),
    ProductName VARCHAR(50),
    SaleAmount  DECIMAL(10, 2),
    SaleDate    DATE
);
GO

INSERT INTO sales.Orders (SaleID, SalesRep, ProductName, SaleAmount, SaleDate)
VALUES
    (1, 'sales1@contoso.com', 'Smartphone', 500.00, '2026-06-01'),
    (2, 'sales2@contoso.com', 'Laptop',     1000.00, '2026-06-02');
GO

-- 2. Create a schema for security objects, and the predicate function
CREATE SCHEMA Security;
GO

CREATE FUNCTION Security.tvf_securitypredicate(@SalesRep AS nvarchar(50))
    RETURNS TABLE
WITH SCHEMABINDING
AS
    RETURN SELECT 1 AS tvf_securitypredicate_result
    WHERE @SalesRep = USER_NAME() OR USER_NAME() = 'manager@contoso.com';
GO

-- 3. Bind the predicate to the table with a security policy
CREATE SECURITY POLICY SalesFilter
ADD FILTER PREDICATE Security.tvf_securitypredicate(SalesRep)
ON sales.Orders
WITH (STATE = ON);
GO
```

To change the predicate function, you must **drop the policy first**, alter the function, then recreate the policy:

```sql
DROP SECURITY POLICY SalesFilter;
GO

ALTER FUNCTION Security.tvf_securitypredicate(@SalesRep AS nvarchar(50))
    RETURNS TABLE
WITH SCHEMABINDING
AS
    RETURN SELECT 1 AS tvf_securitypredicate_result
    WHERE @SalesRep = USER_NAME() OR USER_NAME() = 'president@contoso.com';
GO

CREATE SECURITY POLICY SalesFilter
ADD FILTER PREDICATE Security.tvf_securitypredicate(SalesRep)
ON sales.Orders
WITH (STATE = ON);
GO
```

Key behavior:

- The application is **unaware** which rows were filtered — a fully-filtered result set just comes back empty, not as an error.
- Filter predicates apply on every `SELECT`, `UPDATE`, and `DELETE` against the bound table; users can still `INSERT` rows that will be immediately filtered on any subsequent read.
- With `SCHEMABINDING = ON` (the default), permission checks on the predicate function and any tables/views it references are **bypassed** for callers of the protected table — this is what lets a single centrally-managed function secure a table without granting broad permissions to every user.
- ==RLS applies even to `dbo` users and members of `db_owner`==, unless the predicate function explicitly exempts them (as the example above does for `manager@contoso.com`).
- Creating, altering, or dropping a security policy requires `ALTER ANY SECURITY POLICY` and schema `ALTER` permission; the predicate function itself needs `SELECT`/`REFERENCES` permissions granted per Fabric's documented list.

> [!warning] Common Mistake
> RLS is **not immune to side-channel inference**. A carefully crafted query like `SELECT 1/(SaleAmount-1000) FROM sales.Orders` can leak whether a filtered-out row exists via a divide-by-zero error, even though the row itself is never returned. Treat RLS as row *visibility* control, not airtight confidentiality — pair it with monitoring for unusual query patterns on sensitive tables.

**Practice Question 2** *(Medium)*

A predicate function used by an RLS filter policy needs to be modified to add a new exemption for an auditor role. What is the correct sequence of steps?

A. Run `ALTER FUNCTION` directly — the security policy updates automatically  
B. Drop the security policy, alter the function, then recreate the security policy  
C. Disable the policy with `STATE = OFF`, alter the function, then re-enable it  
D. Create a brand-new function and a brand-new policy, leaving the old ones in place  

> [!success]- Answer
> **B. Drop the security policy, alter the function, then recreate the security policy**
>
> A schema-bound security policy blocks `ALTER FUNCTION` on its predicate function while the policy exists — Fabric enforces this to prevent silently changing the security logic underneath an active policy. The policy must be dropped first, then the function altered, then the policy recreated to reapply protection.

---

## Column-Level Security (CLS)

CLS restricts which **columns** a user can select, using the standard T-SQL `GRANT` statement — no separate DDL construct is needed. It's simpler than building masking views for the same purpose, and applies to both the Warehouse and SQL analytics endpoint. **Only Microsoft Entra authentication is supported.**

```sql
CREATE TABLE dbo.Customers (
    CustomerID int,
    FirstName  varchar(100) NULL,
    CreditCard char(16)     NOT NULL,
    LastName   varchar(100) NOT NULL,
    Phone      varchar(12)  NULL,
    Email      varchar(100) NULL
);
GO

-- Grant Charlie access to every column except CreditCard
GRANT SELECT ON dbo.Customers(CustomerID, FirstName, LastName, Phone, Email)
    TO [charlie@contoso.com];
```

A query that includes the un-granted column fails outright — it's a hard error, not a silently omitted column:

```sql
-- Run as charlie@contoso.com
SELECT * FROM dbo.Customers;
```

```text
Msg 230, Level 14, State 1, Line 1
The SELECT permission was denied on the column 'CreditCard' of the object
'Customers', database 'ContosoSales', schema 'dbo'.
```

> [!note] Mental model — CLS as a column-shaped guest list
> CLS doesn't hide a column; it treats each grant as a **guest list per column**. Querying `SELECT *` against a table where you're not on one column's list doesn't quietly drop that column from your results — it rejects the whole statement. The fix is always to grant access to the specific columns you're missing, or to explicitly enumerate only the columns you're permitted to select (`SELECT CustomerID, FirstName FROM ...` instead of `SELECT *`).

> [!warning] Common Mistake
> Assigning CLS grants to **individual users** doesn't scale and is easy to lose track of. Fabric's own guidance is to assign column permissions to a **SQL role** and add/remove users from that role — a scenario question that describes dozens of per-user `GRANT` statements for the same column set is describing an anti-pattern, not a best practice.

---

## Object-Level Security (OLS)

OLS is standard SQL `GRANT`, `REVOKE`, and `DENY` on any securable — schemas, tables, views, stored procedures — assigned either to individual users or (preferred) to custom or built-in SQL roles.

```sql
-- Grant read access on an entire schema
GRANT SELECT ON SCHEMA::Reports TO [AnalystRole];

-- Grant on a single object
GRANT SELECT, INSERT, UPDATE ON dbo.Orders TO [ETLRole];

-- DENY overrides any GRANT, including one inherited through role membership
DENY SELECT ON dbo.CustomerPayments TO [AnalystRole];

-- REVOKE removes a prior GRANT or DENY entry — it does not itself block access
REVOKE SELECT ON dbo.Customers FROM [FormerContractor];
```

You can't run `CREATE USER` explicitly in a Fabric warehouse or SQL analytics endpoint — running `GRANT` or `DENY` against a principal **creates the database user automatically**. That user still can't connect until they also have sufficient workspace-level rights (a workspace role, or item **Read** permission at minimum).

Check a user's effective permissions with:

```sql
-- Database-scoped
SELECT * FROM sys.fn_my_permissions(NULL, 'Database');

-- Object-scoped
SELECT * FROM sys.fn_my_permissions('dbo.Orders', 'Object');
```

> [!warning] Common Mistake
> `REVOKE` is not `DENY`. `REVOKE` erases a permission entry (falling back to whatever else the user has, e.g., through a role); `DENY` is an explicit, overriding block. If access needs to be **guaranteed** blocked regardless of any role membership, use `DENY` — `REVOKE`-ing a direct grant leaves role-inherited access fully intact.

---

## DDM Interplay

Dynamic data masking ([04-Dynamic Data Masking](./04-dynamic-data-masking.md)) obscures column *values* for unprivileged users while still returning a row — it's a usability/accidental-exposure control, not an access-blocking one. RLS, CLS, and OLS all **block** access outright (no rows, no columns, permission errors); DDM instead returns a masked value and lets the query succeed. Use DDM alongside RLS/CLS/OLS for defense in depth — masking a column doesn't substitute for actually restricting who can query it.

---

## Lakehouse Folder/File-Level Control via OneLake Data Access Roles

Everything above applies to the **Warehouse and SQL analytics endpoint** specifically — T-SQL constructs operating on a relational surface. A **Lakehouse's** raw files and folders in OneLake (outside the SQL analytics endpoint) are instead secured with **OneLake data access roles**: named roles scoped to specific folders or tables, with optional RLS/CLS defined *within* the role. See [03-OneLake Security](./03-onelake-security.md) for full detail on role creation, `DefaultReader` semantics, and how these roles interact with workspace roles and shortcuts.

## Decision Matrix — Which Granular Control, at Which Layer?

| Scenario | Right layer | Why |
| :--- | :--- | :--- |
| Restrict rows returned from a Warehouse table for SQL clients / Power BI DirectQuery | RLS (SQL endpoint) | `CREATE SECURITY POLICY` is native to the Warehouse's T-SQL surface |
| Block an entire sensitive column from a subset of SQL users | CLS (SQL endpoint) | `GRANT SELECT ON table(cols)` is the simplest, most direct mechanism |
| Restrict which tables/schemas a SQL principal can even see | OLS (SQL endpoint) | Standard `GRANT`/`DENY` on schema or object |
| Restrict which **folders/tables** a Spark notebook or OneLake API caller can read in a Lakehouse | OneLake data access role | SQL-layer RLS/CLS/OLS don't apply outside the SQL analytics endpoint |
| Restrict rows/columns for **all** engines (Spark, SQL endpoint, Direct Lake) uniformly from one place | OneLake security role with RLS/CLS defined in the role | Defined once in OneLake, enforced across every supported engine |
| Restrict what a Power BI report viewer sees, independent of any warehouse/lakehouse security | Semantic model RLS (DAX roles) | Applies at the reporting layer even for imported/cached data with no live SQL/OneLake connection |
| Obscure PII values without blocking access outright (e.g., support agents on prod data) | DDM | Values masked, query still succeeds — not an access-blocking control |

> [!note] Mental model — Layers of a house, not competing locks
> Picture the data platform as a house with several independently locked doors: the **SQL endpoint's** RLS/CLS/OLS lock the dining room's chairs (rows) and place settings (columns); **OneLake security** locks the pantry (raw files) regardless of which door you use to reach it; the **semantic model's** RLS locks what a specific guest sees once seated at the table, no matter what's in the pantry. None of these locks substitutes for another — a determined visitor blocked at one door might still reach the same data through an unlocked one.

**Practice Question 3** *(Hard)*

A data platform team needs the same row-level restriction to apply consistently whether a user queries a Lakehouse table via a Spark notebook, the SQL analytics endpoint, or a Direct Lake semantic model. Where should the restriction be defined?

A. RLS in the SQL analytics endpoint only — it automatically propagates to Spark and Direct Lake  
B. A OneLake data access role with row-level security defined on the table  
C. Separate RLS definitions in the SQL endpoint, a Spark-side filter, and a semantic model DAX role  
D. DDM on the relevant columns, since masking works identically across all engines  

> [!success]- Answer
> **B. A OneLake data access role with row-level security defined on the table**
>
> SQL-endpoint RLS only applies when querying through the SQL analytics endpoint — it doesn't reach Spark notebooks or OneLake API callers. A OneLake security role's RLS is enforced by every Fabric engine that supports OneLake security filtering (Lakehouse, Spark, SQL analytics endpoint in user's identity mode, and Direct Lake on OneLake mode), making it the single definition point for cross-engine consistency. Option C works but duplicates logic across three places — exactly what B avoids.

## Use Cases

- Restricting a multi-tenant SaaS warehouse so each customer's analysts see only their own tenant's rows (RLS)
- Hiding a `CreditCard` or `SSN` column from all but a small finance role while leaving the rest of the table queryable (CLS)
- Preventing a reporting role from ever seeing a staging schema used only by the ETL pipeline (OLS)
- Applying one row/column security definition in a OneLake data access role so Spark, SQL endpoint, and Direct Lake all enforce it identically

## Common Issues & Errors

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `ALTER FUNCTION` fails on an RLS predicate function | An active schema-bound security policy still references it | Drop the security policy first, alter the function, then recreate the policy |
| `SELECT *` fails with a permission error on one column | CLS grant doesn't include that column | Grant the missing column explicitly, or query only permitted columns |
| A user still sees data after a `REVOKE` | `REVOKE` only removes a direct grant; role-inherited access remains | Use `DENY` if the access must be blocked regardless of role membership |
| Power BI report against a warehouse falls back to DirectQuery unexpectedly | RLS or CLS is defined on the underlying Warehouse/SQL analytics endpoint | Expected behavior — Direct Lake can't honor SQL-layer RLS/CLS in-memory, so it falls back automatically |
| Spark notebook still sees rows that SQL endpoint users don't | Row restriction was defined only as SQL-endpoint RLS, not a OneLake security role | Move the restriction into a OneLake data access role for cross-engine enforcement |

## Best Practices

- Assign CLS and OLS grants to SQL roles, never individual users, to keep permission management manageable at scale
- Always use `WITH SCHEMABINDING` (the default) for RLS predicate functions unless you have a specific reason not to
- Layer DDM on top of RLS/CLS/OLS for sensitive columns — masking adds a usability safeguard, it doesn't replace access control
- Prefer a OneLake data access role over SQL-endpoint-only RLS/CLS when more than one engine needs to see the same restriction

## Exam Tips

> [!tip] Exam Tips
>
> - RLS = `CREATE SECURITY POLICY` + filter predicate (schema-bound inline TVF); applies to SELECT/UPDATE/DELETE, invisible to the application
> - CLS = `GRANT SELECT ON table(columns)`; a missing column causes a hard permission error, not a silently dropped column
> - OLS = standard `GRANT`/`REVOKE`/`DENY`; `DENY` always wins over any `GRANT`, including through role membership
> - SQL-endpoint RLS/CLS/OLS apply **only** to SQL analytics endpoint / Warehouse queries — Spark and OneLake API access need a OneLake data access role for equivalent restriction
> - DDM masks values but doesn't block access — it's a complement to RLS/CLS/OLS, not a substitute

## Key Takeaways

- RLS, CLS, and OLS in Fabric Warehouse/SQL analytics endpoint use standard T-SQL (`CREATE SECURITY POLICY`, `GRANT`/`DENY`) with no Fabric-specific syntax
- Lakehouse folder/file access outside the SQL endpoint is controlled by OneLake data access roles, not SQL grants
- Choosing the right layer depends on which engines need to see the restriction — SQL-endpoint-only vs. cross-engine (OneLake) vs. reporting-only (semantic model)
- DDM is complementary, not a replacement, for any of RLS/CLS/OLS

## Related Topics

- [01-Workspace & Item Access](./01-workspace-item-access.md)
- [03-OneLake Security](./03-onelake-security.md)
- [04-Dynamic Data Masking](./04-dynamic-data-masking.md)

## Official Documentation

- [Row-level security in Fabric data warehousing](https://learn.microsoft.com/en-us/fabric/data-warehouse/row-level-security)
- [Column-level security in Fabric data warehousing](https://learn.microsoft.com/en-us/fabric/data-warehouse/column-level-security)
- [SQL granular permissions in Fabric Data Warehouse](https://learn.microsoft.com/en-us/fabric/data-warehouse/sql-granular-permissions)
- [Dynamic data masking in Fabric data warehousing](https://learn.microsoft.com/en-us/fabric/data-warehouse/dynamic-data-masking)
- [Permission model in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/security/permission-model)
- [Study Guide for Exam DP-700 (skills measured, July 21, 2026)](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-700)

---

**[← Previous](./01-workspace-item-access.md) | [↑ Back to Section](./security-governance.md) | [Next →](./03-onelake-security.md)**
