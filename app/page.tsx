import { ArrowRight, BookOpen, ChevronRight, Layers, MessageCircle, Sparkles, ThumbsUp, Upload } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { authorRatings } from "@/lib/integrity";
import { toMicro, toUsd, totalsFor } from "@/lib/ledger";
import { db } from "@/lib/supabase/admin";
import { Landing } from "./ui/landing";
import { Notice, usd } from "./ui/notice";

export const dynamic = "force-dynamic";

/** Signed out: the landing page. Signed in: home (ask box, quick actions, earnings, your guides). */
export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <Landing />;
  const { deleted } = await searchParams;

  const totals = await totalsFor(db, user.id);
  const myRating = (await authorRatings(db)).get(user.id);
  const { data: notes } = await db.from("notes").select("id, course, title, deleted_at").eq("author_id", user.id).order("created_at", { ascending: false });
  const { data: snippets } = await db.from("snippets").select("id, note_id").eq("author_id", user.id);
  const { data: sales } = await db.from("ledger_entries").select("snippet_id, amount_usd, created_at").eq("user_id", user.id).eq("kind", "sale");
  const noteOf = new Map((snippets ?? []).map((s) => [s.id, s.note_id]));
  const uses = new Map<string, number>();
  const earned = new Map<string, bigint>();
  let today = 0n;
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  for (const s of sales ?? []) {
    const n = noteOf.get(s.snippet_id);
    if (n) {
      uses.set(n, (uses.get(n) ?? 0) + 1);
      earned.set(n, (earned.get(n) ?? 0n) + toMicro(s.amount_usd));
    }
    if (Date.parse(s.created_at) > dayAgo) today += toMicro(s.amount_usd);
  }
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {deleted && <Notice>Study guide deleted. It's no longer sold, and what it earned stays yours.</Notice>}

      <section className="space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Hi {firstName}, what are you studying?</h1>
        {/* Ask straight from home: goes to the chat and starts right away. */}
        <form action="/ask" method="get" className="card flex items-center gap-2 p-2 pl-4">
          <MessageCircle size={18} className="shrink-0 text-black/40" aria-hidden />
          <input name="q" required placeholder="Ask about your course, e.g. CPSC 221 quicksort" className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-black/35" />
          <button className="btn-primary px-3" aria-label="Ask"><ArrowRight size={18} aria-hidden /></button>
        </form>
        <p className="text-sm text-black/50">
          {user.freeQuestionsLeft > 0
            ? `${user.freeQuestionsLeft} free question${user.freeQuestionsLeft === 1 ? "" : "s"} left`
            : `Questions use your balance (${usd(toUsd(totals.balance))}), at most $0.01 each`}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <QuickAction href="/ask" icon={MessageCircle} label="Ask the tutor" />
        <QuickAction href="/study" icon={Layers} label="Quiz & flashcards" />
        <QuickAction href="/notes/new" icon={Upload} label="Upload a guide" />
      </section>

      <Link href="/earnings" className="card flex items-center justify-between gap-4 p-5 transition hover:border-brand-200">
        <div>
          <div className="text-sm text-black/55">Your study guides earned</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">{usd(toUsd(totals.earnings))}</span>
            {today > 0n && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">+{usd(toUsd(today))} today</span>}
          </div>
          <div className="text-sm text-black/55">Pays for your questions, or cash it out</div>
        </div>
        <ChevronRight className="text-black/30" aria-hidden />
      </Link>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-bold">Your study guides</h2>
          {myRating && (
            <span className="flex items-center gap-1 text-sm text-black/55">
              <ThumbsUp size={14} aria-hidden /> {myRating.up} helpful · {myRating.down} not
            </span>
          )}
        </div>
        {(notes ?? []).length === 0 ? (
          <Link href="/notes/new" className="card flex items-center gap-4 p-5 hover:border-brand-200">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Sparkles size={20} aria-hidden /></span>
            <div>
              <div className="font-semibold">Share your first study guide</div>
              <div className="text-sm text-black/55">Explanations, worked examples and exam tips in your own words. You earn every time the tutor uses it.</div>
            </div>
          </Link>
        ) : (
          <ul className="card divide-y divide-black/5">
            {(notes ?? []).map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02]">
                  <div className="min-w-0">
                    <div className={`truncate font-medium ${n.deleted_at ? "text-black/35 line-through" : ""}`}>{n.title}</div>
                    <div className="text-xs text-black/50">
                      {n.course} · {uses.get(n.id) ?? 0} {uses.get(n.id) === 1 ? "use" : "uses"}
                      {n.deleted_at && " · deleted"}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold text-emerald-700">{usd(toUsd(earned.get(n.id) ?? 0n))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/study" className="card flex items-center gap-4 p-5 hover:border-brand-200">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><BookOpen size={20} aria-hidden /></span>
        <div>
          <div className="font-semibold">Study mode</div>
          <div className="text-sm text-black/55">Practice quizzes and flashcards built from your classmates' study guides.</div>
        </div>
      </Link>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof MessageCircle; label: string }) {
  return (
    <Link href={href} className="card flex flex-col items-center gap-2 p-4 text-center text-sm font-semibold transition hover:border-brand-200">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={20} aria-hidden /></span>
      {label}
    </Link>
  );
}
