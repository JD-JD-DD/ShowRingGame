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
  const pendingId = useId();
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function handleActivate() {
    if (isPending) {
      return;
    }

    if (canBreed) {
      setNoticeMessage(null);
      setIsPending(true);
      router.push(breedHref);
      return;
    }

    setNoticeMessage(unavailableMessage ?? "This dog is not available for breeding.");
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-busy={canBreed ? isPending : undefined}
        aria-disabled={!canBreed || isPending}
        aria-describedby={
          isPending ? pendingId : noticeMessage ? noticeId : undefined
        }
        onClick={handleActivate}
        className={
          canBreed && !isPending
            ? "theme-primary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold"
            : "dog-card dog-copy rounded-2xl px-5 py-3 text-center text-sm font-semibold opacity-60"
        }
      >
        {isPending ? "Loading breeding options..." : "Breed Dog"}
      </button>
      {isPending ? (
        <div
          id={pendingId}
          role="status"
          className="theme-status-info rounded-2xl px-4 py-3 text-center text-xs"
        >
          Loading breeding options...
        </div>
      ) : null}
      {noticeMessage ? (
        <div
          id={noticeId}
          role="status"
          className="theme-status-warning rounded-2xl px-4 py-3 text-center text-xs"
        >
          {noticeMessage}
        </div>
      ) : null}
    </div>
  );
}
