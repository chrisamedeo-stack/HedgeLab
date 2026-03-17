// ─── Option Strategy Detector ────────────────────────────────────────────────
// Detects known option strategy patterns from a set of legs and returns
// the strategy name + key metrics for display.

export interface OptionLeg {
  type: "call" | "put";
  side: "buy" | "sell";
  strike: number;
  premium: number;
}

export interface DetectedStrategy {
  name: string | null;
  metrics: Record<string, string>;
}

function fmt(v: number): string {
  return `$${Math.abs(v).toFixed(2)}`;
}

function fmtSigned(v: number): string {
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

/**
 * Detect a known option strategy from a set of legs.
 * Returns { name, metrics } or { name: null, metrics: {} } if no pattern matches.
 */
export function detectStrategy(legs: OptionLeg[]): DetectedStrategy {
  const none: DetectedStrategy = { name: null, metrics: {} };
  if (legs.length < 2 || legs.some((l) => !l.strike || !l.premium)) return none;

  const buyCalls = legs
    .filter((l) => l.type === "call" && l.side === "buy")
    .sort((a, b) => a.strike - b.strike);
  const sellCalls = legs
    .filter((l) => l.type === "call" && l.side === "sell")
    .sort((a, b) => a.strike - b.strike);
  const buyPuts = legs
    .filter((l) => l.type === "put" && l.side === "buy")
    .sort((a, b) => a.strike - b.strike);
  const sellPuts = legs
    .filter((l) => l.type === "put" && l.side === "sell")
    .sort((a, b) => a.strike - b.strike);

  // Net premium: sell = credit (+), buy = debit (−)
  const net = legs.reduce(
    (s, l) => s + (l.side === "sell" ? l.premium : -l.premium),
    0
  );

  // ═══ 2-leg patterns ═══════════════════════════════════════════════════════

  if (legs.length === 2) {
    // Buy put + Sell call
    if (buyPuts.length === 1 && sellCalls.length === 1) {
      const p = buyPuts[0].strike;
      const c = sellCalls[0].strike;
      if (p === c)
        return { name: "Synthetic short", metrics: { "Effective price": fmt(p) } };
      if (p < c)
        return {
          name: "Producer collar",
          metrics: { Floor: fmt(p), Ceiling: fmt(c), Net: fmtSigned(net) },
        };
      return {
        name: "Risk reversal (short)",
        metrics: { Put: fmt(p), Call: fmt(c), Net: fmtSigned(net) },
      };
    }

    // Buy call + Sell put
    if (buyCalls.length === 1 && sellPuts.length === 1) {
      const c = buyCalls[0].strike;
      const p = sellPuts[0].strike;
      if (c === p)
        return { name: "Synthetic long", metrics: { "Effective price": fmt(c) } };
      if (c > p)
        return {
          name: "Consumer collar",
          metrics: { Ceiling: fmt(c), Floor: fmt(p), Net: fmtSigned(net) },
        };
      return {
        name: "Risk reversal (long)",
        metrics: { Call: fmt(c), Put: fmt(p), Net: fmtSigned(net) },
      };
    }

    // Buy call A + Sell call B → bull call spread
    if (buyCalls.length === 1 && sellCalls.length === 1) {
      const a = buyCalls[0].strike;
      const b = sellCalls[0].strike;
      if (b > a) {
        return {
          name: "Bull call spread",
          metrics: {
            "Max gain": fmt(b - a + net),
            "Max loss": fmt(Math.abs(net)),
            Breakeven: fmt(a - net),
          },
        };
      }
    }

    // Buy put B + Sell put A → bear put spread
    if (buyPuts.length === 1 && sellPuts.length === 1) {
      const a = sellPuts[0].strike;
      const b = buyPuts[0].strike;
      if (b > a) {
        return {
          name: "Bear put spread",
          metrics: {
            "Max gain": fmt(b - a + net),
            "Max loss": fmt(Math.abs(net)),
            Breakeven: fmt(b + net),
          },
        };
      }
    }

    // Buy call + Buy put → straddle or strangle
    if (buyCalls.length === 1 && buyPuts.length === 1) {
      const totalPrem = buyCalls[0].premium + buyPuts[0].premium;
      if (buyCalls[0].strike === buyPuts[0].strike) {
        const k = buyCalls[0].strike;
        return {
          name: "Long straddle",
          metrics: {
            Strike: fmt(k),
            Premium: fmt(totalPrem),
            Breakevens: `${fmt(k - totalPrem)} / ${fmt(k + totalPrem)}`,
          },
        };
      }
      return {
        name: "Long strangle",
        metrics: {
          Strikes: `${fmt(buyPuts[0].strike)} / ${fmt(buyCalls[0].strike)}`,
          Premium: fmt(totalPrem),
          Breakevens: `${fmt(buyPuts[0].strike - totalPrem)} / ${fmt(buyCalls[0].strike + totalPrem)}`,
        },
      };
    }

    // Sell call + Sell put → short straddle or strangle
    if (sellCalls.length === 1 && sellPuts.length === 1) {
      const totalPrem = sellCalls[0].premium + sellPuts[0].premium;
      if (sellCalls[0].strike === sellPuts[0].strike) {
        const k = sellCalls[0].strike;
        return {
          name: "Short straddle",
          metrics: {
            Strike: fmt(k),
            Premium: fmt(totalPrem),
            Breakevens: `${fmt(k - totalPrem)} / ${fmt(k + totalPrem)}`,
          },
        };
      }
      return {
        name: "Short strangle",
        metrics: {
          Strikes: `${fmt(sellPuts[0].strike)} / ${fmt(sellCalls[0].strike)}`,
          Premium: fmt(totalPrem),
          Breakevens: `${fmt(sellPuts[0].strike - totalPrem)} / ${fmt(sellCalls[0].strike + totalPrem)}`,
        },
      };
    }
  }

  // ═══ 3-leg patterns ═══════════════════════════════════════════════════════

  if (legs.length === 3) {
    // 3-way producer: buy put (high) + sell call + sell put (low)
    if (buyPuts.length === 1 && sellCalls.length === 1 && sellPuts.length === 1) {
      const floor = buyPuts[0].strike;
      const subfloor = sellPuts[0].strike;
      const ceiling = sellCalls[0].strike;
      if (subfloor < floor && floor < ceiling) {
        return {
          name: "3-way (producer)",
          metrics: {
            Floor: fmt(floor),
            Subfloor: fmt(subfloor),
            Ceiling: fmt(ceiling),
            Net: fmtSigned(net),
          },
        };
      }
    }

    // 3-way consumer: buy call (low) + sell put + sell call (high)
    if (buyCalls.length === 1 && sellPuts.length === 1 && sellCalls.length === 1) {
      const ceiling = buyCalls[0].strike;
      const floor = sellPuts[0].strike;
      const subceil = sellCalls[0].strike;
      if (floor < ceiling && ceiling < subceil) {
        return {
          name: "3-way (consumer)",
          metrics: {
            Ceiling: fmt(ceiling),
            Floor: fmt(floor),
            Subceil: fmt(subceil),
            Net: fmtSigned(net),
          },
        };
      }
    }

    // Butterfly (3 entries): buy call A + sell call B + buy call C
    if (buyCalls.length === 2 && sellCalls.length === 1) {
      const a = buyCalls[0].strike;
      const b = sellCalls[0].strike;
      const c = buyCalls[1].strike;
      if (a < b && b < c && Math.abs(b - a - (c - b)) < 0.01) {
        return {
          name: "Butterfly (calls)",
          metrics: {
            "Max gain": fmt(b - a + net),
            "Max loss": fmt(Math.abs(net)),
            Strikes: `${fmt(a)} / ${fmt(b)} / ${fmt(c)}`,
          },
        };
      }
    }
  }

  // ═══ 4-leg patterns ═══════════════════════════════════════════════════════

  if (legs.length === 4) {
    // Butterfly (4 entries): buy 1A + sell 2B + buy 1C
    if (buyCalls.length === 2 && sellCalls.length === 2) {
      const ss = sellCalls.map((l) => l.strike);
      if (ss[0] === ss[1]) {
        const a = buyCalls[0].strike;
        const b = ss[0];
        const c = buyCalls[1].strike;
        if (a < b && b < c && Math.abs(b - a - (c - b)) < 0.01) {
          return {
            name: "Butterfly (calls)",
            metrics: {
              "Max gain": fmt(b - a + net),
              "Max loss": fmt(Math.abs(net)),
              Strikes: `${fmt(a)} / ${fmt(b)} / ${fmt(c)}`,
            },
          };
        }
      }
    }

    // Iron butterfly / Iron condor: 1 of each (buy call, sell call, buy put, sell put)
    if (
      buyCalls.length === 1 &&
      sellCalls.length === 1 &&
      buyPuts.length === 1 &&
      sellPuts.length === 1
    ) {
      const sc = sellCalls[0].strike;
      const sp = sellPuts[0].strike;
      const bc = buyCalls[0].strike;
      const bp = buyPuts[0].strike;

      // Iron butterfly: sell straddle (same strike) + buy strangle (outer)
      if (sc === sp && bp < sc && sc < bc) {
        return {
          name: "Iron butterfly",
          metrics: {
            Center: fmt(sc),
            "Max gain": fmtSigned(net),
            "Max loss": fmt(sc - bp - net),
            Breakevens: `${fmt(sc - net)} / ${fmt(sc + net)}`,
          },
        };
      }

      // Iron condor: sell strangle (inner) + buy strangle (outer)
      if (bp < sp && sp < sc && sc < bc) {
        return {
          name: "Iron condor",
          metrics: {
            "Max gain": fmtSigned(net),
            "Max loss": fmt(sp - bp - net),
            Breakevens: `${fmt(sp - net)} / ${fmt(sc + net)}`,
          },
        };
      }
    }
  }

  return none;
}
