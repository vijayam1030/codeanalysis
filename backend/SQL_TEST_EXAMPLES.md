# SQL Test Examples for Enhanced Analysis

## Test Case 1: Oracle SQL with Outer Join
```sql
SELECT PH.PH_ID, PH.PH_ADR_ID, ADR.ADR_NAME
FROM PHONES PH, ADDRESSES ADR
WHERE PH.PH_ADR_ID (+) = ADR.ADR_ID
  AND (PH.PH_ID IS NULL OR PH.PH_ID IN (SELECT MAX(PH_ID) FROM PHONES WHERE PH_ADR_ID (+) = ADR_ID))
ORDER BY ADR.ADR_NAME;
```

**Expected Detection Results:**
- **Language**: Should be detected as `sql`
- **Oracle Features**: `(+)` outer join syntax, `IS NULL` checks
- **Performance Issues**: Cartesian product risk, missing table aliases
- **Optimization Suggestions**: Use explicit JOIN syntax, add proper indexes

## Test Case 2: Complex SQL with Subqueries
```sql
SELECT 
    c.customer_id,
    c.customer_name,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) as order_count,
    (SELECT MAX(order_date) FROM orders WHERE customer_id = c.customer_id) as last_order_date
FROM customers c
WHERE c.status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM orders WHERE customer_id = c.customer_id AND order_date > '2023-01-01')
ORDER BY c.customer_name;
```

**Expected Analysis:**
- **Performance Issues**: Multiple subqueries, N+1 query problem
- **Optimization**: Use JOINs instead of subqueries
- **Index Recommendations**: `orders(customer_id, order_date)`, `customers(status, customer_name)`

## Test Case 3: SQL Server Specific
```sql
DECLARE @StartDate DATETIME = '2023-01-01';
DECLARE @EndDate DATETIME = GETDATE();

SELECT TOP 100
    p.ProductID,
    p.ProductName,
    ISNULL(SUM(od.Quantity), 0) as TotalQuantity,
    @@ROWCOUNT as ProcessedRows
FROM Products p
LEFT JOIN OrderDetails od ON p.ProductID = od.ProductID
LEFT JOIN Orders o ON od.OrderID = o.OrderID
WHERE o.OrderDate BETWEEN @StartDate AND @EndDate
GROUP BY p.ProductID, p.ProductName
ORDER BY TotalQuantity DESC;
```

**Expected Detection:**
- **SQL Server Features**: `DECLARE`, `@@ROWCOUNT`, `GETDATE()`, `ISNULL`
- **Query Type**: `SELECT` with aggregation
- **Performance**: Consider indexes on join columns

## Test Case 4: MySQL Specific
```sql
SELECT 
    u.user_id,
    u.username,
    COUNT(p.post_id) as post_count,
    DATE_FORMAT(MAX(p.created_at), '%Y-%m-%d') as last_post_date
FROM users u
LEFT JOIN posts p ON u.user_id = p.user_id
WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
GROUP BY u.user_id, u.username
HAVING COUNT(p.post_id) > 0
ORDER BY post_count DESC
LIMIT 50;
```

**Expected Analysis:**
- **MySQL Features**: `DATE_FORMAT`, `DATE_SUB`, `NOW()`, `INTERVAL`, `LIMIT`
- **Performance**: Good use of HAVING clause
- **Optimization**: Index on `users(created_at)` and `posts(user_id, created_at)`

## Test Case 5: PostgreSQL Specific
```sql
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', order_date) as month,
        SUM(total_amount) as monthly_total
    FROM orders
    WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', order_date)
),
avg_monthly AS (
    SELECT AVG(monthly_total) as avg_total
    FROM monthly_sales
)
SELECT 
    ms.month,
    ms.monthly_total,
    ms.monthly_total - am.avg_total as difference_from_avg,
    CASE 
        WHEN ms.monthly_total > am.avg_total THEN 'Above Average'
        ELSE 'Below Average'
    END as performance
FROM monthly_sales ms
CROSS JOIN avg_monthly am
ORDER BY ms.month;
```

**Expected Analysis:**
- **PostgreSQL Features**: `WITH` clause (CTE), `DATE_TRUNC`, `CURRENT_DATE`, `INTERVAL`
- **Query Complexity**: Complex (uses CTE, window functions, CASE)
- **Performance**: Efficient use of CTE, good partitioning

## Test Case 6: Common SQL Mistakes
```sql
SELECT *
FROM users u, orders o, products p
WHERE u.user_id = o.user_id
  AND o.product_id = p.product_id
  AND u.status = 'active'
  AND o.order_date LIKE '2023%'
ORDER BY o.order_date;
```

**Expected Issues:**
- **Performance**: Cartesian product risk, `SELECT *`, `LIKE` on date
- **Best Practices**: Use explicit JOINs, specify columns, proper date comparison
- **Security**: Potential for large result sets

## Expected Detailed Analysis Format

For the line: `WHERE PH.PH_ADR_ID (+) = ADR.ADR_ID`

**Expected Output:**
```json
{
  "lineNumber": 3,
  "originalCode": "WHERE PH.PH_ADR_ID (+) = ADR.ADR_ID",
  "explanation": "Oracle-specific outer join syntax using (+) operator. This creates a LEFT OUTER JOIN where all records from ADR (ADDRESSES) table are included, even if there's no matching record in PH (PHONES) table. The (+) on the left side means 'include nulls from the left table when no match exists'.",
  "suggestions": [
    "Replace Oracle-specific (+) syntax with standard LEFT JOIN for better portability",
    "Use explicit JOIN syntax: 'FROM ADDRESSES ADR LEFT JOIN PHONES PH ON PH.PH_ADR_ID = ADR.ADR_ID'",
    "Consider adding indexes on PH_ADR_ID and ADR_ID for better performance"
  ],
  "severity": "warning",
  "category": "best-practice|portability|joins"
}
```

This enhanced system should now:
1. ✅ Properly detect SQL language (with 40+ SQL patterns)
2. ✅ Provide detailed, SQL-specific line analysis
3. ✅ Identify Oracle, SQL Server, MySQL, PostgreSQL specific features
4. ✅ Suggest performance optimizations and index recommendations
5. ✅ Explain complex SQL concepts like outer joins, subqueries, CTEs
6. ✅ Provide security analysis for SQL injection risks