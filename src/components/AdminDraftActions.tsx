"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Labels = {
  approve: string;
  reject: string;
  pending: string;
  error: string;
};

const SANS = "var(--pp-font-sans)";

const baseBtn: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  fontWeight: 500,
  border: "0.5px solid",
  borderRadius: "4px",
  padding: "10px 18px",
  cursor: "pointer",
  background: "transparent",
};

export function AdminDraftActions({
  draftId,
  labels,
}: {
  draftId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState(false);

  async function submit(action: "approve" | "reject") {
    if (pending) return;
    setPending(action);
    setError(false);
    try {
      const res = await fetch(`/api/admin/drafts/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setError(true);
        setPending(null);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
      setPending(null);
    }
  }

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void submit("approve")}
          disabled={pending !== null}
          style={{
            ...baseBtn,
            color: "#7c9968",
            borderColor: "#7c9968",
            opacity: pending !== null && pending !== "approve" ? 0.4 : 1,
          }}
        >
          {pending === "approve" ? labels.pending : labels.approve}
        </button>
        <button
          type="button"
          onClick={() => void submit("reject")}
          disabled={pending !== null}
          style={{
            ...baseBtn,
            color: "#c0735c",
            borderColor: "#c0735c",
            opacity: pending !== null && pending !== "reject" ? 0.4 : 1,
          }}
        >
          {pending === "reject" ? labels.pending : labels.reject}
        </button>
      </div>
      {error && (
        <p
          style={{
            fontFamily: SANS,
            fontSize: "12px",
            color: "#c0735c",
            marginTop: "0.5rem",
            marginBottom: 0,
          }}
        >
          {labels.error}
        </p>
      )}
    </div>
  );
}
