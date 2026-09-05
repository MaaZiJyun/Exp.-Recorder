"use client";

import { Alert } from "@/components/circo/ui";
import type { RecorderContext } from "@/app/use-recorder";

export function Notice({
  notice,
  onClose,
}: {
  notice: RecorderContext["notice"];
  onClose: () => void;
}) {
  if (!notice) return null;
  return (
    <div className="mt-5">
      <Alert tone={notice.kind === "success" ? "success" : "danger"}>
        <div className="flex items-center justify-between gap-5">
          <span>{notice.text}</span>
          <button
            type="button"
            className="font-semibold"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </Alert>
    </div>
  );
}
