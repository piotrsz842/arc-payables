import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { askAction } from "./actions";

// The tutor may make several model calls and payments: allow up to 5 minutes.
export const maxDuration = 300;

const ERRORS: Record<string, React.ReactNode> = {
  topup: (
    <>
      You've used your free questions and your balance is empty. <Link href="/" className="underline">Add money</Link> or upload notes to earn some.
    </>
  ),
  failed: "Something went wrong. Please try again.",
};

export default async function AskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { error } = await searchParams;
  return (
    <form action={askAction} className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-xl font-bold">Ask the tutor</h1>
      <p className="text-sm text-slate-600">
        The tutor looks through notes written by students in your course and uses the best ones to answer.
        {user.freeQuestionsLeft > 0 ? ` You have ${user.freeQuestionsLeft} free questions left.` : " This question uses your balance."}
      </p>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{ERRORS[error]}</p>}
      <textarea
        name="question"
        rows={4}
        required
        placeholder="CPSC 221: why does quicksort take O(n^2) in the worst case?"
        className="w-full rounded border px-3 py-2"
      />
      <button className="rounded bg-slate-900 px-4 py-2 font-medium text-white">Ask</button>
      <p className="text-xs text-slate-400">Answers can take up to a minute.</p>
    </form>
  );
}
