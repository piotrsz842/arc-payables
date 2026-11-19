import { Check } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/app/submit-button";
import { Notice } from "@/app/ui/notice";
import { signUp } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Fill in every field. Passwords need at least 8 characters.",
  taken: "That email can't be used. Try signing in instead.",
  wallet: "Something went wrong setting up your account. Please try again.",
  busy: "Too many new accounts right now. Try again in a little while.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={signUp} className="card mx-auto max-w-sm space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
        <ul className="mt-2 space-y-1 text-sm text-black/60">
          {["3 free questions to start", "Earn when the tutor uses your study guides", "No card, no wallet, no setup"].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check size={15} className="text-emerald-600" aria-hidden /> {t}</li>
          ))}
        </ul>
      </div>
      {error && <Notice kind="error">{ERRORS[error] ?? "Please try again."}</Notice>}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <input name="name" required autoComplete="name" className="field" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className="field" />
        <span className="mt-1 block text-xs text-black/45">At least 8 characters.</span>
      </label>
      <SubmitButton pendingText="Creating your account…" className="btn-primary w-full">Create account</SubmitButton>
      <Link href="/" className="btn-secondary w-full">Cancel</Link>
      <p className="text-center text-sm text-black/55">
        Already have an account? <Link href="/login" className="font-semibold text-brand-700">Sign in</Link>
      </p>
    </form>
  );
}
