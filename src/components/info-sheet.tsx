"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function InfoSheet({
  body,
  href,
  label,
  title,
}: {
  body: string;
  href: string;
  label: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return <><button aria-label={label} className="info-button" onClick={() => setOpen(true)} type="button">ⓘ</button>{open ? <div className="info-sheet-layer" role="presentation"><button aria-label="Close information" className="info-sheet-backdrop" onClick={() => setOpen(false)} type="button" /><section aria-labelledby="info-sheet-title" aria-modal="true" className="info-sheet" role="dialog"><button aria-label="Close" className="info-sheet-close" onClick={() => setOpen(false)} type="button">×</button><p className="info-sheet-kicker">How Suno works</p><h2 id="info-sheet-title">{title}</h2><p>{body}</p><Link href={href} onClick={() => setOpen(false)}>Read the evidence →</Link></section></div> : null}</>;
}
