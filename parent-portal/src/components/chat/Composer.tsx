import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendIcon } from "@/lib/icons";
import { CHAT_TEXT } from "./constants";

interface ComposerProps {
  onSend: (question: string) => void;
  isWaiting: boolean;
}

const MAX_HEIGHT_PX: number = 112;

export function Composer({ onSend, isWaiting }: ComposerProps): React.JSX.Element {
  const [value, setValue] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend: boolean = value.trim().length > 0 && !isWaiting;

  useEffect(() => {
    const element: HTMLTextAreaElement | null = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  function submit(): void {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[480px] items-end gap-2 px-4 py-3">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={CHAT_TEXT.composerPlaceholder}
          aria-label={CHAT_TEXT.composerPlaceholder}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-card py-3 text-base"
        />
        <Button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={CHAT_TEXT.sendLabel}
          className="size-11 shrink-0 rounded-full p-0"
        >
          <SendIcon className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
