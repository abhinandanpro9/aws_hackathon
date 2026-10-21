import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PersonIcon, PhoneIcon } from "@/lib/icons";
import { parseContacts, toTelHref, type ContactDetails } from "@/lib/api";
import { ANSWER_TEXT } from "./constants";

interface ContactCardProps {
  routeTo: string;
}

// One hand-off can name several people; each gets their own card.
// FLOW: routeTo -> parseContacts -> a card per person, never one card mashing two numbers
export function ContactCard({ routeTo }: ContactCardProps): React.JSX.Element {
  const contacts: ContactDetails[] = parseContacts(routeTo);

  return (
    <div className="flex flex-col gap-2">
      {contacts.map((contact) => (
        <Card
          key={contact.raw}
          className="gap-0 border-handoff-border bg-handoff-surface p-3 shadow-none"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-background/70 text-handoff">
              <PersonIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-handoff-foreground">{contact.name}</p>
              {contact.role ? (
                <p className="text-xs text-muted-foreground">{contact.role}</p>
              ) : null}
            </div>
          </div>

          {contact.phone ? (
            <>
              <Separator className="my-3 bg-handoff-border" />
              <a
                href={toTelHref(contact.phone)}
                className="flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-semibold text-handoff-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <PhoneIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="break-words">
                  {ANSWER_TEXT.callLabel} {contact.phone}
                </span>
              </a>
            </>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
