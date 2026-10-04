"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function isNegative(value: string, allowNegative: boolean) {
  return allowNegative && value.trim().startsWith("-");
}

function formatNumber(value: string, allowNegative = false): string {
  const sign = isNegative(value, allowNegative) ? "-" : "";
  const num = value.replace(/\D/g, "");
  if (!num) return sign;
  return sign + Number(num).toLocaleString("vi-VN");
}

function parseNumber(formatted: string, allowNegative = false): string {
  const sign = isNegative(formatted, allowNegative) ? "-" : "";
  return sign + formatted.replace(/\D/g, "");
}

interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (raw: string) => void;
  suffix?: string;
  /** Accept a leading "-" and show a ± button (mobile numeric keyboards have no minus key). */
  allowNegative?: boolean;
}

function CurrencyInput({ value, onValueChange, suffix = "₫", allowNegative = false, className, ...props }: CurrencyInputProps) {
  const [display, setDisplay] = React.useState(() => formatNumber(value, allowNegative));

  React.useEffect(() => {
    setDisplay(formatNumber(value, allowNegative));
  }, [value, allowNegative]);

  function update(raw: string) {
    setDisplay(formatNumber(raw, allowNegative));
    onValueChange(raw);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    update(parseNumber(e.target.value, allowNegative));
  }

  function toggleSign() {
    const raw = parseNumber(display, allowNegative);
    update(raw.startsWith("-") ? raw.slice(1) : `-${raw}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow: backspace, delete, tab, escape, enter, arrows
    const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key)) return;
    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
    if (allowNegative && e.key === "-") return;
    // Block non-digit
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  return (
    <div className="relative">
      <input
        inputMode="numeric"
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
          suffix && "pr-8",
          allowNegative && "pl-8",
          className
        )}
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {allowNegative && (
        <button
          type="button"
          onClick={toggleSign}
          disabled={props.disabled}
          className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded text-sm text-muted-foreground hover:bg-muted cursor-pointer disabled:pointer-events-none"
          aria-label="Đổi dấu âm/dương"
          title="Đổi dấu: phụ thu (+) / giảm trừ (−)"
        >
          ±
        </button>
      )}
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export { CurrencyInput };
