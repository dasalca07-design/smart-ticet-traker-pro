import { useState, useMemo } from "react";
import {
  useListExpenses, getListExpensesQueryKey,
  useCreateExpense, useUpdateExpense, useDeleteExpense,
  useListCategories, getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2, Edit2, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Expenses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [categoryIdFilter, setCategoryIdFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ amount: "", description: "", categoryId: "", date: format(new Date(), "yyyy-MM-dd") });
  const [editForm, setEditForm] = useState({ amount: "", description: "", categoryId: "", date: "" });

  const params = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (categoryIdFilter !== "all") p.categoryId = Number(categoryIdFilter);
    if (startDateFilter) p.startDate = startDateFilter;
    if (endDateFilter) p.endDate = endDateFilter;
    return p;
  }, [categoryIdFilter, startDateFilter, endDateFilter]);

  const { data: expenses, isLoading } = useListExpenses(params, { query: { enabled: true, queryKey: getListExpensesQueryKey(params) } });
  const { data: categories } = useListCategories({ query: { enabled: true, queryKey: getListCategoriesQueryKey() } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });

  const deleteMutation = useDeleteExpense({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Deleted" }); } } });
  const createMutation = useCreateExpense({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsCreateOpen(false);
        setCreateForm({ amount: "", description: "", categoryId: "", date: format(new Date(), "yyyy-MM-dd") });
        toast({ title: "Expense added" });
      }
    }
  });
  const updateMutation = useUpdateExpense({
    mutation: {
      onSuccess: () => { invalidate(); setEditExpenseId(null); toast({ title: "Updated" }); }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.amount || !createForm.description || !createForm.categoryId || !createForm.date) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    createMutation.mutate({ data: { amount: Number(createForm.amount), description: createForm.description, categoryId: Number(createForm.categoryId), date: new Date(createForm.date).toISOString() } });
  };

  const openEdit = (expense: any) => {
    setEditForm({ amount: expense.amount.toString(), description: expense.description, categoryId: expense.categoryId.toString(), date: format(new Date(expense.date), "yyyy-MM-dd") });
    setEditExpenseId(expense.id);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpenseId || !editForm.amount || !editForm.description || !editForm.categoryId || !editForm.date) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    updateMutation.mutate({ id: editExpenseId, data: { amount: Number(editForm.amount), description: editForm.description, categoryId: Number(editForm.categoryId), date: new Date(editForm.date).toISOString() } });
  };

  const hasFilters = categoryIdFilter !== "all" || startDateFilter || endDateFilter;

  return (
    <div className="h-full flex flex-col gap-3 md:gap-5" data-testid="expenses-page">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-serif text-foreground leading-tight">Journal</h1>
          <p className="text-xs text-muted-foreground">Every transaction recorded.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 font-medium" data-testid="button-add-expense">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif text-xl">New Entry</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-amount">Amount</Label>
                <Input id="c-amount" type="number" step="0.01" placeholder="0.00" value={createForm.amount} onChange={e => setCreateForm({...createForm, amount: e.target.value})} data-testid="input-amount" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-desc">Description</Label>
                <Input id="c-desc" placeholder="Coffee, Groceries..." value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})} data-testid="input-description" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={createForm.categoryId} onValueChange={val => setCreateForm({...createForm, categoryId: val})}>
                  <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-date">Date</Label>
                <Input id="c-date" type="date" value={createForm.date} onChange={e => setCreateForm({...createForm, date: e.target.value})} data-testid="input-date" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-expense">
                {createMutation.isPending ? "Saving…" : "Save Entry"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex flex-wrap gap-2 items-end p-3 rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="flex-1 min-w-[140px] space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
          <Select value={categoryIdFilter} onValueChange={setCategoryIdFilter}>
            <SelectTrigger className="h-8 text-sm" data-testid="filter-category"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</p>
          <Input type="date" className="h-8 text-sm w-32" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} data-testid="filter-start-date" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To</p>
          <Input type="date" className="h-8 text-sm w-32" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} data-testid="filter-end-date" />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setCategoryIdFilter("all"); setStartDateFilter(""); setEndDateFilter(""); }} data-testid="button-clear-filters">
            <FilterX className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* List — scrolls internally */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : expenses?.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No expenses found.
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            {expenses?.map(expense => (
              <div key={expense.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors group" data-testid={`expense-row-${expense.id}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ backgroundColor: expense.category.color + "22", color: expense.category.color }}>
                    {expense.category.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{expense.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(expense.date), "MMM d, yyyy")} · <span style={{ color: expense.category.color }}>{expense.category.name}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <span className="font-serif text-base text-foreground tabular-nums">${expense.amount.toFixed(2)}</span>
                  <div className="hidden group-hover:flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)} data-testid={`button-edit-${expense.id}`}>
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate({ id: expense.id })} data-testid={`button-delete-${expense.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editExpenseId} onOpenChange={open => !open && setEditExpenseId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif text-xl">Edit Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-amount">Amount</Label>
              <Input id="e-amount" type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-desc">Description</Label>
              <Input id="e-desc" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={editForm.categoryId} onValueChange={val => setEditForm({...editForm, categoryId: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating…" : "Update Entry"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
