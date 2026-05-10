"use client";

import type { ReactNode } from "react";

export function ConfirmActionForm({
  action,
  message,
  children,
  className,
}: {
  action: (payload: FormData) => void;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
