import { Badge } from "@/components/ui/badge";
import type { Outcome } from "@/lib/domain";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  answered: "Answered",
  person: "Sent to a person",
  none: "No answer",
};

interface OutcomeBadgeProps {
  outcome: Outcome;
}

export function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  if (outcome === "answered") {
    return (
      <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
        {OUTCOME_LABELS.answered}
      </Badge>
    );
  }
  if (outcome === "person") {
    return (
      <Badge variant="outline" className="shrink-0 whitespace-nowrap">
        {OUTCOME_LABELS.person}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="shrink-0 whitespace-nowrap">
      {OUTCOME_LABELS.none}
    </Badge>
  );
}
