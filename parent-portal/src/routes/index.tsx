import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing/Landing";

const TITLE = "Sunflower Grove Front Desk · run by an AI crew";
const DESCRIPTION =
  "A preschool front desk run by an AI crew. Parents get cited answers in seconds; anything sensitive goes to a named person.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Landing,
});
