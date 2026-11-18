import Link from "next/link";
import { SubmitButton } from "@/app/submit-button";
import { signUp } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Please fill in every field. Passwords need at least 8 characters.",
  taken: "That email can't be used. Try signing in instead.",
  wallet: "Something went wrong setting up your account. Please try again.",
  busy: "Too many new accounts right now. Please try again in a little while.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={signUp} className="mx-auto max-w-sm space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-xl font-bold">Create your account</h1>
      <p className="text-sm text-slate-600">Upload study guides in your own words and get paid when the AI tutor uses them. You also get 3 free questions.</p>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{ERRORS[error] ?? "Please try again."}</p>}
      <label className="block text-sm">
        Name
        <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        Email
        <input name="email" type="email" required className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" minLength={8} required className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <SubmitButton pendingText="Creating your account…" className="w-full rounded bg-slate-900 py-2 font-medium text-white">Sign up</SubmitButton>
      <p className="text-sm text-slate-500">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </form>
  );
}
