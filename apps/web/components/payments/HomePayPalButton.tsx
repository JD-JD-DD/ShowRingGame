"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      HostedButtons?: (options: { hostedButtonId: string }) => {
        render: (selector: string) => Promise<void> | void;
      };
    };
  }
}

const PAYPAL_SDK_SRC =
  "https://www.paypal.com/sdk/js?client-id=BAAx0EEeQLR3nh-r5m1oP9BcMkD6C1YwQJ41CyxcQC6ZrYGZNGnhJaIZH7JtZvqjxpRIxAD5RQ3q3YfwB8&components=hosted-buttons&enable-funding=venmo&currency=USD";
const PAYPAL_CONTAINER_ID = "paypal-container-BYGGBFHY59DN8";
const HOSTED_BUTTON_ID = "BYGGBFHY59DN8";

export function HomePayPalButton() {
  const hasRendered = useRef(false);
  const [hasError, setHasError] = useState(false);

  const renderButton = useCallback(() => {
    if (hasRendered.current) {
      return;
    }

    const hostedButtons = window.paypal?.HostedButtons;

    if (!hostedButtons) {
      return;
    }

    hasRendered.current = true;
    setHasError(false);

    try {
      const renderResult = hostedButtons({
        hostedButtonId: HOSTED_BUTTON_ID,
      }).render(`#${PAYPAL_CONTAINER_ID}`);

      Promise.resolve(renderResult).catch(() => {
        hasRendered.current = false;
        setHasError(true);
      });
    } catch {
      hasRendered.current = false;
      setHasError(true);
    }
  }, []);

  return (
    <>
      <Script
        id="paypal-hosted-buttons-sdk"
        src={PAYPAL_SDK_SRC}
        strategy="afterInteractive"
        onLoad={renderButton}
        onReady={renderButton}
        onError={() => setHasError(true)}
      />
      <div
        id={PAYPAL_CONTAINER_ID}
        className="mt-4 min-h-12"
        aria-label="New Champions PayPal button"
      />
      {hasError ? (
        <p className="mt-3 text-sm text-red-200">
          The New Champions button could not load. Please refresh and try again.
        </p>
      ) : null}
    </>
  );
}
