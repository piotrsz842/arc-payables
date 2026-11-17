import { requireUser } from "@/lib/auth";
import { AskChat } from "./ask-chat";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-bold">Ask the tutor</h1>
        <p className="mt-1 text-sm text-slate-600">
          The tutor looks through notes written by students in your course and pays a fraction of a cent for the ones it uses.
          A separate checker reviews every purchase first, and you&apos;ll see each one here as it happens.
          {user.freeQuestionsLeft > 0
            ? ` You have ${user.freeQuestionsLeft} free question${user.freeQuestionsLeft === 1 ? "" : "s"} left.`
            : " This question uses your balance (at most $0.01)."}
        </p>
      </div>
      <AskChat placeholder="CPSC 221: why does quicksort take O(n^2) in the worst case?" />
    </div>
  );
}
