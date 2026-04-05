"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { Delete, Check, X } from "lucide-react";

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
  onCancel?: () => void;
}

export function Numpad({ value, onChange, onDone, onCancel }: NumpadProps) {
  const [expression, setExpression] = useState(value || "0");
  const [hasOperator, setHasOperator] = useState(false);

  function display() {
    // Show formatted number or expression
    if (hasOperator) return expression;
    const num = parseInt(expression.replace(/[^0-9]/g, "") || "0");
    return formatNumber(num);
  }

  function handleDigit(d: string) {
    if (expression === "0") {
      setExpression(d);
    } else {
      setExpression(expression + d);
    }
  }

  function handleOperator(op: string) {
    setHasOperator(true);
    setExpression(expression + ` ${op} `);
  }

  function handleClear() {
    setExpression("0");
    setHasOperator(false);
  }

  function handleDelete() {
    if (expression.length <= 1) {
      setExpression("0");
    } else {
      const newExpr = expression.trimEnd();
      // Remove last char or operator
      if (newExpr.endsWith(" ")) {
        setExpression(newExpr.slice(0, -3)); // remove " + " etc
        setHasOperator(false);
      } else {
        setExpression(newExpr.slice(0, -1));
      }
    }
  }

  function handleTripleZero() {
    if (expression !== "0") {
      setExpression(expression + "000");
    }
  }

  function handleEquals() {
    if (!hasOperator) return;
    try {
      // Safe eval: only allow digits and basic operators
      const sanitized = expression.replace(/[^0-9+\-*/. ]/g, "");
      const result = Function(`"use strict"; return (${sanitized})`)();
      const rounded = Math.round(result);
      setExpression(rounded > 0 ? rounded.toString() : "0");
      setHasOperator(false);
    } catch {
      // invalid expression, ignore
    }
  }

  function handleDone() {
    // Evaluate if there's a pending expression
    if (hasOperator) handleEquals();

    const cleanNum = expression.replace(/[^0-9]/g, "");
    onChange(cleanNum || "0");
    onDone();
  }

  const keys = [
    { label: "C", action: handleClear, className: "text-muted-foreground" },
    { label: "÷", action: () => handleOperator("/"), className: "text-muted-foreground" },
    { label: "×", action: () => handleOperator("*"), className: "text-muted-foreground" },
    { label: "DEL", action: handleDelete, className: "text-muted-foreground", icon: Delete },

    { label: "7", action: () => handleDigit("7") },
    { label: "8", action: () => handleDigit("8") },
    { label: "9", action: () => handleDigit("9") },
    { label: "−", action: () => handleOperator("-"), className: "text-muted-foreground" },

    { label: "4", action: () => handleDigit("4") },
    { label: "5", action: () => handleDigit("5") },
    { label: "6", action: () => handleDigit("6") },
    { label: "+", action: () => handleOperator("+"), className: "text-muted-foreground" },

    { label: "1", action: () => handleDigit("1") },
    { label: "2", action: () => handleDigit("2") },
    { label: "3", action: () => handleDigit("3") },
    { label: "done", action: handleDone, className: "bg-primary text-primary-foreground font-bold row-span-2", rowSpan: true },

    { label: "0", action: () => handleDigit("0") },
    { label: "000", action: handleTripleZero, className: "text-primary font-medium" },
    { label: "=", action: handleEquals, className: "text-muted-foreground" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-background border-t shadow-2xl animate-in slide-in-from-bottom duration-200">
      {/* Display */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex-1 min-w-0">
          {hasOperator && (
            <p className="text-xs text-muted-foreground truncate">{expression}</p>
          )}
          <p className="text-2xl font-bold truncate">{display()} <span className="text-sm text-muted-foreground font-normal">đ</span></p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-4 gap-px bg-border">
        {keys.map((key, i) => (
          <button
            key={i}
            onClick={key.action}
            className={`flex items-center justify-center py-3.5 text-lg font-medium bg-background active:bg-muted transition-colors cursor-pointer ${
              key.rowSpan ? "row-span-2" : ""
            } ${key.className || ""}`}
          >
            {key.icon ? <key.icon className="h-5 w-5" /> : key.label === "done" ? <Check className="h-6 w-6" /> : key.label}
          </button>
        ))}
      </div>

      {/* Safe area */}
      <div className="h-[env(safe-area-inset-bottom)] bg-background" />
    </div>
  );
}
