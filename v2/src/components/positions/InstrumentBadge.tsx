"use client";

import type { TradeInstrument } from "@/types/pm";

const BADGE_STYLES: Record<TradeInstrument, { bg: string; text: string; border: string; label: string }> = {
  futures:     { bg: "#0A2540", text: "#5BB0FF", border: "#1A3D6A", label: "Futures" },
  swap_otc:    { bg: "#1A1040", text: "#9A80FF", border: "#302060", label: "Swap OTC" },
  call_option: { bg: "#2A1030", text: "#FF80C0", border: "#501840", label: "Call" },
  put_option:  { bg: "#301015", text: "#FF6090", border: "#601828", label: "Put" },
  fixed_price: { bg: "#0A2A18", text: "#4ACA94", border: "#155030", label: "Fixed Price" },
  hta:         { bg: "#1A2810", text: "#90C840", border: "#304010", label: "HTA" },
  basis:       { bg: "#2A1408", text: "#E08050", border: "#502010", label: "Basis" },
  index:       { bg: "#2A2010", text: "#D4A840", border: "#504010", label: "Index" },
};

export function InstrumentBadge({ instrument }: { instrument: TradeInstrument }) {
  const style = BADGE_STYLES[instrument] ?? BADGE_STYLES.futures;

  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {style.label}
    </span>
  );
}
