import { AnswerBubble } from "@/components/answer/AnswerBubble";
import { HearAvaCard } from "@/components/crew/HearAvaCard";
import type { AgentId } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhoneIcon } from "@/lib/icons";
import { CHAT_TEXT } from "./constants";
import { OpeningState } from "./OpeningState";
import { ThinkingBubble } from "./ThinkingBubble";
import type { ChatMessage } from "./types";

interface MessageListProps {
  messages: readonly ChatMessage[];
  isWaiting: boolean;
  onPickSuggestion: (question: string) => void;
  voiceOn: boolean;
  onActive: (agent: AgentId | null) => void;
}

export function MessageList({
  messages,
  isWaiting,
  onPickSuggestion,
  voiceOn,
  onActive,
}: MessageListProps): React.JSX.Element {
  return (
    <div
      aria-label={CHAT_TEXT.listLabel}
      className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 py-4"
    >
      <HearAvaCard className="mx-auto" />

      <OpeningState
        onPick={onPickSuggestion}
        disabled={isWaiting}
        showSuggestions={messages.length === 0}
      />

      {messages.map((message: ChatMessage) => {
        if (message.role === "parent") {
          return (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-base leading-relaxed text-primary-foreground">
                {message.text}
              </p>
            </div>
          );
        }
        if (message.role === "offline") {
          return (
            <Alert key={message.id} className="max-w-[92%] border-border bg-card">
              <PhoneIcon className="size-4" aria-hidden="true" />
              <AlertDescription className="text-base leading-relaxed text-card-foreground">
                {message.text}
              </AlertDescription>
            </Alert>
          );
        }
        return (
          <div key={message.id} className="flex justify-start">
            <AnswerBubble reply={message.reply} voiceOn={voiceOn} onActive={onActive} />
          </div>
        );
      })}

      {isWaiting ? (
        <div className="flex justify-start">
          <ThinkingBubble />
        </div>
      ) : null}
    </div>
  );
}
