import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { HandwrittenClient } from "./handwritten-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function HandwrittenPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Upload handwritten notes</h1>
        <p className="text-black/55">
          Snap your pages. We read them for you, and you check the text before anything is published. Prefer typing?{" "}
          <Link href="/notes/new" className="font-semibold text-brand-700">Type or paste instead</Link>
        </p>
      </div>
      <HandwrittenClient />
    </div>
  );
}
