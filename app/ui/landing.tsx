import { BadgeCheck, BookOpen, Coins, MessageCircle, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";

/** What a first-time visitor sees: what this is, how it works, how to start. */
export function Landing() {
  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-2xl space-y-5 pt-4 text-center md:pt-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Coins size={14} aria-hidden /> Your notes pay for your tutoring
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          An AI tutor that knows <span className="text-brand-600">your</span> course
        </h1>
        <p className="text-lg text-black/60">
          It learns from study guides written by students in your class, and pays them a fraction of a cent every time it uses one.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">Get started free</Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">Sign in</Link>
        </div>
        <p className="text-sm text-black/45">3 free questions. No card, no wallet, no setup.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Upload, title: "Share what you know", body: "Upload a study guide in your own words: explanations, worked examples, exam tips." },
          { icon: MessageCircle, title: "Ask the tutor", body: "It finds the most useful study guides from your course and answers with them, citing each one." },
          { icon: Coins, title: "Get paid, every time", body: "Each time the tutor uses your guide, you earn. Spend it on your own questions or cash it out." },
        ].map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="card space-y-2 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50"><Icon size={16} aria-hidden /></span>
              Step {i + 1}
            </div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-sm text-black/60">{body}</p>
          </div>
        ))}
      </section>

      <section className="card grid gap-5 p-6 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Every purchase is checked", body: "A separate reviewer approves each guide before the tutor pays: on topic, worth it, within budget." },
          { icon: BadgeCheck, title: "Students' own work", body: "Authors confirm guides are in their own words. Copies are caught, and anything can be reported." },
          { icon: BookOpen, title: "Quizzes and flashcards", body: "Practice a topic with questions built from your classmates' best explanations." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <Icon className="mt-0.5 shrink-0 text-brand-600" size={20} aria-hidden />
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-black/60">{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
