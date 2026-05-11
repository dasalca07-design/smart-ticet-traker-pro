import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable, categoriesTable } from "@workspace/db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import {
  CreateExpenseBody,
  UpdateExpenseBody,
} from "@workspace/api-zod";

const router = Router();

// GET /expenses/summary — must be before /:id
router.get("/summary", async (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  const conditions = [];
  if (startDate) conditions.push(gte(expensesTable.date, startDate));
  if (endDate) conditions.push(lte(expensesTable.date, endDate));
  const where = conditions.length ? and(...conditions) : undefined;

  const expensesWithCategory = await db
    .select({
      id: expensesTable.id,
      amount: expensesTable.amount,
      description: expensesTable.description,
      categoryId: expensesTable.categoryId,
      date: expensesTable.date,
      notes: expensesTable.notes,
      createdAt: expensesTable.createdAt,
      category: {
        id: categoriesTable.id,
        name: categoriesTable.name,
        color: categoriesTable.color,
        icon: categoriesTable.icon,
        createdAt: categoriesTable.createdAt,
      },
    })
    .from(expensesTable)
    .innerJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(where)
    .orderBy(desc(expensesTable.date));

  const totalAmount = expensesWithCategory.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCount = expensesWithCategory.length;
  const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

  // Find top category by total spend
  const categoryTotals: Record<string, number> = {};
  for (const e of expensesWithCategory) {
    categoryTotals[e.category.name] = (categoryTotals[e.category.name] ?? 0) + Number(e.amount);
  }
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const recentExpenses = expensesWithCategory.slice(0, 5).map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));

  res.json({
    totalAmount,
    totalCount,
    averageAmount,
    topCategory,
    recentExpenses,
  });
});

// GET /expenses/by-category
router.get("/by-category", async (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  const conditions = [];
  if (startDate) conditions.push(gte(expensesTable.date, startDate));
  if (endDate) conditions.push(lte(expensesTable.date, endDate));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      categoryId: categoriesTable.id,
      categoryName: categoriesTable.name,
      color: categoriesTable.color,
      icon: categoriesTable.icon,
      total: sql<string>`COALESCE(SUM(${expensesTable.amount}), 0)`,
      count: sql<number>`COUNT(${expensesTable.id})::int`,
    })
    .from(categoriesTable)
    .leftJoin(expensesTable, and(eq(expensesTable.categoryId, categoriesTable.id), where))
    .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.color, categoriesTable.icon)
    .orderBy(desc(sql`SUM(${expensesTable.amount})`));

  const grandTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);

  const result = rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    color: r.color,
    icon: r.icon,
    total: Number(r.total),
    count: r.count,
    percentage: grandTotal > 0 ? (Number(r.total) / grandTotal) * 100 : 0,
  }));

  res.json(result);
});

// GET /expenses
router.get("/", async (req, res) => {
  const { categoryId, startDate, endDate, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions = [];
  if (categoryId) conditions.push(eq(expensesTable.categoryId, Number(categoryId)));
  if (startDate) conditions.push(gte(expensesTable.date, startDate));
  if (endDate) conditions.push(lte(expensesTable.date, endDate));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: expensesTable.id,
      amount: expensesTable.amount,
      description: expensesTable.description,
      categoryId: expensesTable.categoryId,
      date: expensesTable.date,
      notes: expensesTable.notes,
      createdAt: expensesTable.createdAt,
      category: {
        id: categoriesTable.id,
        name: categoriesTable.name,
        color: categoriesTable.color,
        icon: categoriesTable.icon,
        createdAt: categoriesTable.createdAt,
      },
    })
    .from(expensesTable)
    .innerJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(where)
    .orderBy(desc(expensesTable.date))
    .limit(Number(limit))
    .offset(Number(offset));

  res.json(rows.map((r) => ({ ...r, amount: Number(r.amount) })));
});

// POST /expenses
router.post("/", async (req, res) => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const data = parsed.data;
  const [inserted] = await db
    .insert(expensesTable)
    .values({
      amount: String(data.amount),
      description: data.description,
      categoryId: data.categoryId,
      date: data.date instanceof Date ? data.date.toISOString().split("T")[0] : String(data.date),
      notes: data.notes ?? null,
    })
    .returning();

  const [expense] = await db
    .select({
      id: expensesTable.id,
      amount: expensesTable.amount,
      description: expensesTable.description,
      categoryId: expensesTable.categoryId,
      date: expensesTable.date,
      notes: expensesTable.notes,
      createdAt: expensesTable.createdAt,
      category: {
        id: categoriesTable.id,
        name: categoriesTable.name,
        color: categoriesTable.color,
        icon: categoriesTable.icon,
        createdAt: categoriesTable.createdAt,
      },
    })
    .from(expensesTable)
    .innerJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(eq(expensesTable.id, inserted.id));

  res.status(201).json({ ...expense, amount: Number(expense.amount) });
});

// GET /expenses/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [expense] = await db
    .select({
      id: expensesTable.id,
      amount: expensesTable.amount,
      description: expensesTable.description,
      categoryId: expensesTable.categoryId,
      date: expensesTable.date,
      notes: expensesTable.notes,
      createdAt: expensesTable.createdAt,
      category: {
        id: categoriesTable.id,
        name: categoriesTable.name,
        color: categoriesTable.color,
        icon: categoriesTable.icon,
        createdAt: categoriesTable.createdAt,
      },
    })
    .from(expensesTable)
    .innerJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(eq(expensesTable.id, id));

  if (!expense) { res.status(404).json({ error: "Expense not found" }); return; }
  res.json({ ...expense, amount: Number(expense.amount) });
});

// PUT /expenses/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const data = parsed.data;
  const updates: Record<string, unknown> = {};
  if (data.amount !== undefined) updates.amount = String(data.amount);
  if (data.description !== undefined) updates.description = data.description;
  if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
  if (data.date !== undefined) {
    updates.date = data.date instanceof Date ? data.date.toISOString().split("T")[0] : String(data.date);
  }
  if (data.notes !== undefined) updates.notes = data.notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  await db.update(expensesTable).set(updates).where(eq(expensesTable.id, id));

  const [expense] = await db
    .select({
      id: expensesTable.id,
      amount: expensesTable.amount,
      description: expensesTable.description,
      categoryId: expensesTable.categoryId,
      date: expensesTable.date,
      notes: expensesTable.notes,
      createdAt: expensesTable.createdAt,
      category: {
        id: categoriesTable.id,
        name: categoriesTable.name,
        color: categoriesTable.color,
        icon: categoriesTable.icon,
        createdAt: categoriesTable.createdAt,
      },
    })
    .from(expensesTable)
    .innerJoin(categoriesTable, eq(expensesTable.categoryId, categoriesTable.id))
    .where(eq(expensesTable.id, id));

  if (!expense) { res.status(404).json({ error: "Expense not found" }); return; }
  res.json({ ...expense, amount: Number(expense.amount) });
});

// DELETE /expenses/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.status(204).end();
});

export default router;
