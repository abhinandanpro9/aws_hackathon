import { useCallback, useEffect, useRef, useState } from "react";
import { askFrontDesk, type AgentId, type AskResponse } from "@/lib/api";
import { CrewStrip } from "@/components/crew/CrewStrip";
import { playVoice } from "@/components/crew/voice";
import { useCenter } from "@/hooks/use-center";
import { ChatHeader } from "./ChatHeader";
import { ClosingPanel } from "./ClosingPanel";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "./types";

// The chat, and the point at which it ends.
// FLOW: parent sends -> engine answers -> handedOff true -> composer replaced by a closing panel
// 1. a session id groups a parent's questions so the operator sees one conversation
// 2. once a person owns the question the composer is REMOVED, not disabled: inviting more
//    typing right after saying "someone will get back to you" undermines the handoff
// 3. "Ask a new question" starts a genuinely new conversation, with a new session id

function makeId(): string {
  return crypto.randomUUID();
}

export function ChatScreen(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [handoff, setHandoff] = useState<AskResponse | null>(null);
  const [stepAgent, setStepAgent] = useState<AgentId | null>(null);
  const [voiceOn, setVoiceOn] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const center = useCenter();
  const centerPhone: string | null = center?.phone ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isWaiting, handoff]);

  // Ava says hello on the parent's first tap. Browsers block sound before a tap.
  useEffect(() => {
    const greet = (): void => playVoice("ava");
    window.addEventListener("pointerdown", greet, { once: true });
    return () => window.removeEventListener("pointerdown", greet);
  }, []);

  const send = useCallback(
    (question: string): void => {
      const trimmed: string = question.trim();
      if (trimmed.length === 0) return;

      setMessages((current: ChatMessage[]) => [
        ...current,
        { id: makeId(), role: "parent", text: trimmed },
      ]);
      setIsWaiting(true);

      void askFrontDesk(trimmed, sessionId, centerPhone)
        .then((reply: AskResponse) => {
          setMessages((current: ChatMessage[]) => [
            ...current,
            { id: makeId(), role: "front-desk", reply },
          ]);
          if (reply.handedOff) setHandoff(reply);
        })
        .finally(() => setIsWaiting(false));
    },
    [sessionId, centerPhone],
  );

  const startOver = useCallback((): void => {
    setMessages([]);
    setHandoff(null);
    setSessionId(crypto.randomUUID());
  }, []);

  return (
    // h-svh, not min-h-svh: with min-h the document itself grows and scrolls, so on a phone
    // the sticky composer sits over the last message and scrollIntoView stops short of it.
    // A fixed-height column makes <main> the only thing that scrolls.
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <ChatHeader />
      <CrewStrip
        active={isWaiting ? "ava" : stepAgent}
        voiceOn={voiceOn}
        onToggleVoice={() => setVoiceOn((on: boolean) => !on)}
      />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <MessageList
          messages={messages}
          isWaiting={isWaiting}
          onPickSuggestion={send}
          voiceOn={voiceOn}
          onActive={setStepAgent}
        />
        {/* Height, not a zero-size node: a 0px anchor at the very bottom can be clipped and
            scrollIntoView then lands just above the last message. */}
        <div ref={bottomRef} className="h-4" />
      </main>
      {handoff === null ? (
        <Composer onSend={send} isWaiting={isWaiting} />
      ) : (
        <ClosingPanel reply={handoff} onStartOver={startOver} />
      )}
    </div>
  );
}
