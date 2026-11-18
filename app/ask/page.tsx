import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { AskChat } from "./ask-chat";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "CPSC 221: why is quicksort O(n²) on sorted input?",
  "CPSC 221: how do I build a heap in O(n)?",
  "CPSC 221: what is a hash table load factor?",
];

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Ask the tutor</h1>
        <p className="text-black/55">
          It answers with study guides written by students in your course, and pays them a fraction of a cent for each one it uses.{" "}
          {user.freeQuestionsLeft > 0
            ? `You have ${user.freeQuestionsLeft} free question${user.freeQuestionsLeft === 1 ? "" : "s"} left.`
            : "Each question uses your balance, at most $0.01."}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-black/45">
          <ShieldCheck size={14} aria-hidden /> A separate checker approves every purchase first.
        </p>
      </div>
      <AskChat placeholder="Ask about your course…" initialQuestion={q?.slice(0, 2000)} examples={EXAMPLES} />
    </div>
  );
}
