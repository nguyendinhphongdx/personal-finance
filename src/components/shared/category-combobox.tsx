"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  icon?: string;
  color?: string;
}

interface CategoryComboboxProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  type: "INCOME" | "EXPENSE";
  onCategoryCreated?: () => void;
}

export function CategoryCombobox({ categories, value, onChange, type, onCategoryCreated }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = categories.find((c) => c.id === value);
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = categories.some((c) => c.name.toLowerCase() === search.toLowerCase());

  async function handleCreateNew() {
    if (!search.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: search.trim(), type }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      toast.success(`Đã tạo danh mục "${search.trim()}"`);
      onChange(data.data.id);
      setSearch("");
      setOpen(false);
      onCategoryCreated?.();
    } else {
      toast.error(data.error || "Không thể tạo danh mục");
    }
  }

  const triggerWidth = triggerRef.current?.offsetWidth;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between cursor-pointer font-normal h-10 text-sm"
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color ?? "#6b7280" }} />
              <span>{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Chọn hoặc tạo danh mục...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={triggerWidth ? { minWidth: triggerWidth } : undefined}
      >
        <Command>
          <CommandInput placeholder="Tìm hoặc nhập tên mới..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
                  onClick={handleCreateNew}
                >
                  <Plus className="h-4 w-4 text-primary" />
                  Tạo &quot;{search.trim()}&quot;
                </button>
              ) : (
                "Không tìm thấy danh mục"
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onChange(c.id); setOpen(false); setSearch(""); }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: c.color ?? "#6b7280" }} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {search.trim() && !exactMatch && filtered.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCreateNew} className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4 text-primary" />
                    Tạo &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
