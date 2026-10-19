import * as React from "react";

import { Input } from "@/components/ui/input";
import { Search, X } from "@/lib/icons";
import { cn } from "@/lib/utils";

// A search field with a leading magnifier and a clear button.
// FLOW: type -> onValueChange -> clear button appears -> click or Escape -> onValueChange("")
// 1. the clear button is only rendered when there is something to clear, never hover-revealed
// 2. Escape clears too, because that is what a keyboard user reaches for first
// 3. focus returns to the field after clearing, so typing can continue immediately

export interface SearchInputProps extends Omit<
  React.ComponentProps<"input">,
  "onChange" | "value" | "type"
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible label for the clear button. */
  clearLabel?: string;
  /** Classes for the wrapper. Layout belongs here: the input inside is always full width. */
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { className, containerClassName, value, onValueChange, clearLabel = "Clear search", ...props },
    forwardedRef,
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    const hasValue = value.length > 0;

    const clear = React.useCallback((): void => {
      onValueChange("");
      innerRef.current?.focus();
    }, [onValueChange]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Escape" && hasValue) {
          event.preventDefault();
          clear();
        }
      },
      [clear, hasValue],
    );

    return (
      <div className={cn("relative w-full", containerClassName)}>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={innerRef}
          type="search"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full pl-10 [&::-webkit-search-cancel-button]:appearance-none",
            hasValue ? "pr-11" : "pr-3",
            className,
          )}
          {...props}
        />
        {hasValue ? (
          <button
            type="button"
            onClick={clear}
            aria-label={clearLabel}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
