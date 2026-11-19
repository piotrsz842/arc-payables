import Link from "next/link";
import { SubmitButton } from "@/app/submit-button";
import { Notice } from "@/app/ui/notice";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={signIn} className="card mx-auto max-w-sm space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="text-sm text-black/55">Sign in to ask, study and see your earnings.</p>
      </div>
      {error && <Notice kind="error">Wrong email or password.</Notice>}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="field" />
      </label>
      <SubmitButton pendingText="Signing in…" className="btn-primary w-full">Sign in</SubmitButton>
      <p className="text-center text-sm text-black/55">
        New here? <Link href="/signup" className="font-semibold text-brand-700">Create an account</Link>
      </p>
    </form>
  );
}
