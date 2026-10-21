"use client";

// The name and person shown in both nav surfaces, from the engine only.
// FLOW: /api/center -> app-state -> here -> AppSidebar + MobileTopBar
// 1. the center name is whatever the engine reports, never written into the UI
// 2. the operator line is the director from the live staff list, not a hardcoded name
// 3. no staff list means no operator line, rather than an invented one

import { useAppState } from "@/lib/app-state";
import { LAYOUT_TEXTS } from "./constants";

const DIRECTOR_ROLE = "director";

export interface CenterHeader {
  centerName: string;
  operatorLine: string | null;
}

export function useCenterHeader(): CenterHeader {
  const { centerName, staff } = useAppState();
  const director = staff.find((person) => person.role.toLowerCase().includes(DIRECTOR_ROLE));

  return {
    centerName: centerName ?? LAYOUT_TEXTS.centerNameUnknown,
    operatorLine:
      director === undefined ? null : LAYOUT_TEXTS.signedInAs(director.name, director.role),
  };
}
