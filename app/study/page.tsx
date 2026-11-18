import { Layers, ListChecks } from "lucide-react";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Study mode (quizzes and flashcards). Placeholder until the feature lands. */
export default async function StudyPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Study mode</h1>
        <p className="text-black/55">Practice a topic with questions built from your classmates&apos; study guides.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: ListChecks, title: "Practice quiz", body: "Multiple choice, with an explanation and source for every answer." },
          { icon: Layers, title: "Flashcards", body: "Flip to see the answer and which study guide it came from." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card space-y-2 p-5 opacity-70">
            <Icon className="text-brand-600" aria-hidden />
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-black/55">{body}</div>
            <span className="inline-block rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/50">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
