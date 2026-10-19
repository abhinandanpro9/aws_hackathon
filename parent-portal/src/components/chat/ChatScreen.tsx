import { useCallback, useEffect, useRef, useState } from "react";
import { askFrontDesk, type AgentId, type AskResponse } from "@/lib/api";
import { CrewStrip } from "@/components/crew/CrewStrip";
import { CrewRail } from "@/components/crew/CrewRail";
import { playVoice } from "@/components/crew/voice";
import { useCenter } from "@/hooks/use-center";
import { SUGGESTIONS } from "./constants";
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
  const [sessionId, setSessionId] = useState<string>(() => `demo-${crypto.randomUUID()}`);
  const [handoff, setHandoff] = useState<AskResponse | null>(null);
  const [stepAgent, setStepAgent] = useState<AgentId | null>(null);
  const [voiceOn, setVoiceOn] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const center = useCenter();
  const centerPhone: string | null = center?.phone ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isWaiting, handoff]);

  // Ava says hello once, on the parent's first tap. Browsers block sound before a tap.
  // Turning the speaker on before that also plays the greeting.
  const greeted = useRef<boolean>(false);
  const greet = useCallback((): void => {
    if (greeted.current) return;
    greeted.current = true;
    playVoice("ava");
  }, []);
  useEffect(() => {
    // A first tap on the Masky card plays Ava there instead, so the mp3 stays quiet.
    const onTap = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (target?.closest("[data-hear-ava]")) greeted.current = true;
      greet();
    };
    window.addEventListener("pointerdown", onTap, { once: true });
    return () => window.removeEventListener("pointerdown", onTap);
  }, [greet]);

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

  // ?autostart=1 sends the fever question after a second, so the crew handoff shows at once.
  // The latest send is read at fire time, so the center phone loading late does not cancel it.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("autostart") !== "1") return;
    const timer = window.setTimeout(() => sendRef.current(SUGGESTIONS[0] ?? ""), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  const startOver = useCallback((): void => {
    setMessages([]);
    setHandoff(null);
    setSessionId(`demo-${crypto.randomUUID()}`);
  }, []);

  return (
    // h-svh, not min-h-svh: with min-h the document itself grows and scrolls, so on a phone
    // the sticky composer sits over the last message and scrollIntoView stops short of it.
    // A fixed-height column makes <main> the only thing that scrolls.
    // On desktop the phone-width chat sits centred on cream, with the crew rail beside it.
    <div className="flex h-svh justify-center gap-10 overflow-hidden bg-[#FFFBF3]">
      <div className="flex h-svh w-full max-w-[480px] flex-col overflow-hidden bg-background lg:shadow-[0_24px_60px_-20px_rgba(31,27,22,0.35)]">
        <ChatHeader />
        <CrewStrip
          active={isWaiting ? "ava" : stepAgent}
          voiceOn={voiceOn}
          onToggleVoice={() => {
            if (!voiceOn) greet();
            setVoiceOn(!voiceOn);
          }}
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
      <CrewRail active={isWaiting ? "ava" : stepAgent} />
    </div>
  );
}
