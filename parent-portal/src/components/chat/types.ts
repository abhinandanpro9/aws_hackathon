import type { AskResponse } from "@/lib/api";

export interface ParentMessage {
  id: string;
  role: "parent";
  text: string;
}

export interface FrontDeskMessage {
  id: string;
  role: "front-desk";
  reply: AskResponse;
}

export interface OfflineMessage {
  id: string;
  role: "offline";
  text: string;
}

export type ChatMessage = ParentMessage | FrontDeskMessage | OfflineMessage;
