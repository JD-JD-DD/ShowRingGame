"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  message: string;
  disabled?: boolean;
  title?: string;
  className?: string;
};

export default function ConfirmSubmitButton({
  children,
  message,
  disabled = false,
  title,
  className,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      title={title}
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
