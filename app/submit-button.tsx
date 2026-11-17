"use client";

import { useFormStatus } from "react-dom";

/**
 * A form button that shows it's working. While the form's server action runs,
 * it is disabled (so a second click can't send it twice) and shows a spinner
 * plus `pendingText`, e.g. "Creating your account…".
 */
export function SubmitButton({
  children,
  pendingText,
  className = "rounded bg-slate-900 px-4 py-2 font-medium text-white",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several buttons in one form (Add $0.10 / $0.50 / $1), only the clicked one says it's working.
  const isMe = pending && (!name || data?.get(name) === value);
  return (
    <button name={name} value={value} disabled={pending} className={`${className} disabled:opacity-60`}>
      {isMe ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner() {
  return <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}
