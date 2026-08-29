"use client";

import { useState } from "react";

type Panel = "change" | "cancel" | null;

export default function SupportManagementAffordances() {
  const [panel, setPanel] = useState<Panel>(null);

  return <section aria-label="Support management" className="mt-6">
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => setPanel("change")} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">
        Change support level
      </button>
      <button type="button" onClick={() => setPanel("cancel")} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">
        Cancel support
      </button>
    </div>
    {panel === "change" ? <div role="status" className="theme-card theme-copy mt-4 rounded-xl p-4 text-sm">
      Bronze Supporter, Silver Supporter, and Gold Supporter levels are available. Changing support levels will be available in a future account update; no change has been made.
    </div> : null}
    {panel === "cancel" ? <div role="status" className="theme-card theme-copy mt-4 rounded-xl p-4 text-sm">
      Cancellation will be available in a future account update. Support remains active through the current paid period after cancellation; no cancellation has been scheduled.
    </div> : null}
  </section>;
}
