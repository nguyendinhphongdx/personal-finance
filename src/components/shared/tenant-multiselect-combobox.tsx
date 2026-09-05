"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  isFamily: boolean;
}

interface TenantMultiselectComboboxProps {
  tenants: Tenant[];
  value: string[];
  onChange: (tenantIds: string[]) => void;
  propertyId: string;
  onTenantCreated?: () => void;
}

export function TenantMultiselectCombobox({ tenants, value, onChange, propertyId, onTenantCreated }: TenantMultiselectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = tenants.filter((t) => value.includes(t.id));
  const filtered = tenants.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const exactMatch = tenants.some((t) => t.name.toLowerCase() === search.toLowerCase());

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function handleCreateNew() {
    if (!search.trim()) return;
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: search.trim(), propertyId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      toast.success(`Đã tạo người thuê "${search.trim()}"`);
      onChange([...value, data.data.id]);
      setSearch("");
      onTenantCreated?.();
    } else {
      toast.error(data.error || "Không thể tạo người thuê");
    }
  }

  const triggerWidth = triggerRef.current?.offsetWidth;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between cursor-pointer font-normal h-10 text-sm"
          >
            {selected.length > 0 ? `${selected.length} người đã chọn` : <span className="text-muted-foreground">Chọn người thuê...</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start" style={triggerWidth ? { minWidth: triggerWidth } : undefined}>
          <Command>
            <CommandInput placeholder="Tìm hoặc nhập tên mới..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>
                {search.trim() ? (
                  <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded" onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 text-primary" />
                    Tạo &quot;{search.trim()}&quot;
                  </button>
                ) : (
                  "Không tìm thấy người thuê"
                )}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((t) => (
                  <CommandItem key={t.id} value={t.name} onSelect={() => toggle(t.id)} className="cursor-pointer">
                    <Check className={cn("mr-2 h-4 w-4", value.includes(t.id) ? "opacity-100" : "opacity-0")} />
                    {t.name}
                    {t.isFamily && <Badge variant="default" className="text-[10px] px-1 py-0 h-4 ml-2">GĐ</Badge>}
                  </CommandItem>
                ))}
              </CommandGroup>
              {search.trim() && !exactMatch && (
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
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <div key={t.id} className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-0.5 text-sm">
              <span>{t.name}</span>
              <button type="button" className="cursor-pointer" onClick={() => toggle(t.id)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
