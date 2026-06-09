"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  message: string;
  disabled?: boolean;
  className?: string;
};

export default function ConfirmSubmitButton({
  children,
  message,
  disabled = false,
  className,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
