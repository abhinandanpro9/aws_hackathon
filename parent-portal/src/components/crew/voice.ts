// Optional crew voices. A clip plays only if public/voice/<id>.mp3 exists; a missing file
// is skipped silently. One HEAD check per clip per page load.

const known = new Map<string, Promise<boolean>>();

function clipExists(src: string): Promise<boolean> {
  let check = known.get(src);
  if (check === undefined) {
    check = fetch(src, { method: "HEAD" })
      .then((response: Response) => {
        const type: string = response.headers.get("content-type") ?? "";
        return response.ok && !type.includes("text/html");
      })
      .catch(() => false);
    known.set(src, check);
  }
  return check;
}

export function playVoice(agentId: string): void {
  const src = `/voice/${agentId}.mp3`;
  void clipExists(src).then((exists: boolean) => {
    if (!exists) return;
    void new Audio(src).play().catch(() => {
      // The browser refused to play (no tap yet). Nothing to tell the parent.
    });
  });
}
