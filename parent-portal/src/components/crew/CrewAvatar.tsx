import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CrewMember } from "./crew";

interface CrewAvatarProps {
  member: CrewMember;
  size: "sm" | "md";
  glowing?: boolean;
}

// The picture, or a coloured circle with the initial when the picture is missing.
export function CrewAvatar({ member, size, glowing = false }: CrewAvatarProps): React.JSX.Element {
  const [broken, setBroken] = useState<boolean>(false);
  const box: string = size === "md" ? "size-11" : "size-6";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white transition-all duration-300",
        box,
        glowing ? "scale-110 animate-pulse" : "opacity-80",
      )}
      style={{
        backgroundColor: member.color,
        boxShadow: glowing
          ? `0 0 0 3px white, 0 0 0 5px ${member.color}, 0 0 18px 6px ${member.color}`
          : undefined,
      }}
    >
      {broken ? (
        member.name.charAt(0)
      ) : (
        <img
          src={`/avatars/${member.id}.png`}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}
