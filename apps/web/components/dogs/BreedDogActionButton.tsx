"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Props = {
  canBreed: boolean;
  breedHref: string;
  unavailableMessage: string | null;
};

export default function BreedDogActionButton({
  canBreed,
  breedHref,
  unavailableMessage,
}: Props) {
  const router = useRouter();
  const noticeId = useId();
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  function handleActivate() {
    if (canBreed) {
      setNoticeMessage(null);
      router.push(breedHref);
      return;
    }

    setNoticeMessage(unavailableMessage ?? "This dog is not available for breeding.");
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-disabled={!canBreed}
        aria-describedby={noticeMessage ? noticeId : undefined}
        onClick={handleActivate}
        className={
          canBreed
            ? "rounded-2xl bg-purple-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
            : "dog-card dog-copy rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60"
        }
      >
        Breed Dog
      </button>
      {noticeMessage ? (
        <div
          id={noticeId}
          role="status"
          className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-100"
        >
          {noticeMessage}
        </div>
      ) : null}
    </div>
  );
}
