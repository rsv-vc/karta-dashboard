"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Search box that reports its value after a short pause. It keeps its own text
 * so typing stays responsive while the URL catches up, and tells apart the URL
 * echoing what it sent (keep typing) from an outside change such as "Reset"
 * (replace the text).
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  delay = 250,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  delay?: number;
}) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const [sent, setSent] = useState(value);
  const onChangeRef = useRef(onChange);

  // Adjust state while rendering when the prop changes (no effect needed).
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) setText(value);
  }

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const next = text.trim();
    if (next === value) return;
    const timer = setTimeout(() => {
      setSent(next);
      onChangeRef.current(next);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, value, delay]);

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 pl-8"
      />
    </div>
  );
}
