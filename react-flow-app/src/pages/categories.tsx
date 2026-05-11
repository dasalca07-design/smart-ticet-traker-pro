import { useState } from "react";
import {
  useListCategories, getListCategoriesQueryKey,
  useCreateCategory, useDeleteCategory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Categories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", color: "#3b82f6", icon: "tag" });

  const { data: categories, isLoading } = useListCategories({ query: { enabled: true, queryKey: getListCategoriesQueryKey() } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const deleteMutation = useDeleteCategory({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Deleted" }); } } });
  const createMutation = useCreateCategory({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsCreateOpen(false);
        setFormData({ name: "", color: "#3b82f6", icon: "tag" });
        toast({ title: "Category created" });
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    createMutation.mutate({ data: { name: formData.name, color: formData.color, icon: formData.icon } });
  };

  return (
    <div className="h-full flex flex-col gap-3 md:gap-5" data-testid="categories-page">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-serif text-foreground leading-tight">Categories</h1>
          <p className="text-xs text-muted-foreground">Organize your spending.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 font-medium" data-testid="button-new-category">
              <Plus className="w-3.5 h-3.5" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif text-xl">Create Category</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" placeholder="e.g. Utilities, Dining…" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} data-testid="input-cat-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <input id="cat-color" type="color" className="w-10 h-10 rounded cursor-pointer border border-border" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                  <Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="flex-1 font-mono uppercase" data-testid="input-cat-color" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-category">
                {createMutation.isPending ? "Creating…" : "Create Category"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid — scrolls internally */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : categories?.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No categories yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2">
            {categories?.map(cat => (
              <div key={cat.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/50 bg-card group" data-testid={`category-card-${cat.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color + "22", color: cat.color }}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{cat.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground uppercase">{cat.color}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate({ id: cat.id })} data-testid={`button-delete-cat-${cat.id}`}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
