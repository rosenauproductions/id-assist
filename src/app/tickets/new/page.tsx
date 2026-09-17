import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketBot } from "@/components/ticket-bot";
import { isTicketType } from "@/lib/tickets/scripts";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  if (!isTicketType(type)) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/tickets" className="text-sm text-muted hover:text-foreground">
        ← Help
      </Link>
      <div className="mt-4">
        <TicketBot type={type} />
      </div>
    </main>
  );
}
