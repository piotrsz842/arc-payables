import Link from "next/link";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={signIn} className="mx-auto max-w-sm space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-xl font-bold">Sign in</h1>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Wrong email or password.</p>}
      <label className="block text-sm">
        Email
        <input name="email" type="email" required className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" required className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <button className="w-full rounded bg-slate-900 py-2 font-medium text-white">Sign in</button>
      <p className="text-sm text-slate-500">
        New here? <Link href="/signup" className="underline">Create an account</Link>
      </p>
    </form>
  );
}
