import { requireUser } from "@/lib/auth";
import { StudyClient } from "./study-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Study mode: practice quizzes and flashcards built from classmates' study guides. */
export default async function StudyPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Study mode</h1>
        <p className="text-black/55">Practice a topic with questions built from your classmates&apos; study guides. Every item shows where it came from.</p>
      </div>
      <StudyClient freeLeft={user.freeQuestionsLeft} />
    </div>
  );
}
