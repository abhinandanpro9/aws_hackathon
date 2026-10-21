import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCenter, type CenterInfo } from "@/lib/api";

// The center's own name and number, read from the API rather than written into the UI.
// FLOW: mount -> GET /api/center -> context -> header + offline copy
// 1. null until it arrives, and null forever if it never does -- no invented fallback name
// 2. one fetch for the whole app: the header and the offline message read the same value
// 3. a missing number changes the wording rather than printing a number we cannot vouch for

const CenterContext = createContext<CenterInfo | null>(null);

export function CenterProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [center, setCenter] = useState<CenterInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCenter().then((info: CenterInfo | null) => {
      if (!cancelled) setCenter(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <CenterContext.Provider value={center}>{children}</CenterContext.Provider>;
}

export function useCenter(): CenterInfo | null {
  return useContext(CenterContext);
}
