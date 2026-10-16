import React, { useEffect, useState } from 'react';
import { api, Candle, Chart, Market } from '../api';

type Interval = '5m' | '15m' | '1h' | '1d';
const INTERVALS: Interval[] = ['5m', '15m', '1h', '1d'];
const W = 340, H = 190, PAD_L = 34, PAD_R = 6, PAD_T = 8, VOL_H = 26, GAP = 8;
const MAX_CANDLES = 40;
const pct = (bp: number) => (bp / 100).toFixed(1);
const short = (label: string) => label.trim().split(/\s+/).slice(-1)[0];

/** Candlestick chart of one outcome's price (its share of the points pool). Drawn in SVG, no chart library. */
const MarketChart: React.FC<{ market: Market }> = ({ market }) => {
  const [interval, setIntervalKey] = useState<Interval>('15m');
  const [selected, setSelected] = useState<string>(market.outcomes[0]?.id ?? '');
  const [chart, setChart] = useState<Chart | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!market.outcomes.some((o) => o.id === selected)) setSelected(market.outcomes[0]?.id ?? '');
  }, [market.id, market.outcomes, selected]);

  // Reload when the market changes, the interval changes, or the pool total moves (someone just predicted).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const c = await api.chart(market.id, interval);
        if (!cancelled) { setChart(c); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) timer = setTimeout(load, 30000);
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [market.id, interval, market.poolTotalMinor]);

  const live = chart?.outcomes.find((o) => o.id === selected);
  const fallbackBp = market.outcomes.find((o) => o.id === selected)?.priceBp ?? 0;
  const priceBp = live?.priceBp ?? fallbackBp;
  const candles: Candle[] = (live?.candles ?? []).slice(-MAX_CANDLES);

  // Price axis: fit the candles, but never zoom in tighter than 5 points.
  const lows = candles.map((c) => c.l).concat(priceBp);
  const highs = candles.map((c) => c.h).concat(priceBp);
  let lo = Math.min(...lows), hi = Math.max(...highs);
  if (hi - lo < 500) { const mid = (hi + lo) / 2; lo = mid - 250; hi = mid + 250; }
  lo = Math.max(0, lo - (hi - lo) * 0.1); hi = Math.min(10000, hi + (hi - lo) * 0.1);
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - VOL_H - GAP;
  const y = (bp: number) => PAD_T + plotH * (1 - (bp - lo) / (hi - lo));
  const step = plotW / Math.max(candles.length, 1);
  const bodyW = Math.max(2, Math.min(14, step * 0.6));
  const vmax = Math.max(1, ...candles.map((c) => c.v));
  const first = candles[0]?.o ?? priceBp;
  const change = priceBp - first;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4" data-testid="market-chart">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-racing text-[10px] font-black uppercase tracking-widest text-slate-300">Market chart</h3>
        <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
          {INTERVALS.map((i) => (
            <button key={i} onClick={() => setIntervalKey(i)} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${interval === i ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{i}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
        {market.outcomes.map((o) => (
          <button key={o.id} onClick={() => setSelected(o.id)}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide ${selected === o.id ? 'bg-red-600/20 border-red-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
            {short(o.label)} <span className="text-slate-400">{pct(chart?.outcomes.find((x) => x.id === o.id)?.priceBp ?? o.priceBp ?? 0)}%</span>
          </button>
        ))}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-racing text-2xl font-black text-white">{pct(priceBp)}%</span>
        <span className={`text-xs font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>{change >= 0 ? '+' : ''}{(change / 100).toFixed(1)}</span>
        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">chance the crowd gives</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Price candles">
        {[0, 0.5, 1].map((f) => {
          const bp = lo + (hi - lo) * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH * f} y2={PAD_T + plotH * f} stroke="#1e293b" strokeWidth="1" />
              <text x={PAD_L - 4} y={PAD_T + plotH * f + 3} textAnchor="end" fontSize="8" fill="#64748b">{pct(bp)}%</text>
            </g>
          );
        })}
        {candles.length === 0 ? (
          <line x1={PAD_L} x2={W - PAD_R} y1={y(priceBp)} y2={y(priceBp)} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 4" />
        ) : candles.map((c, i) => {
          const cx = PAD_L + step * i + step / 2;
          const up = c.c >= c.o;
          const color = up ? '#22c55e' : '#ef4444';
          const top = y(Math.max(c.o, c.c)), bottom = y(Math.min(c.o, c.c));
          return (
            <g key={c.t} data-candle>
              <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1" />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1.5, bottom - top)} fill={color} />
              <rect x={cx - bodyW / 2} y={H - (c.v / vmax) * VOL_H} width={bodyW} height={(c.v / vmax) * VOL_H} fill="#334155" />
            </g>
          );
        })}
      </svg>

      <p className="text-[9px] text-slate-500 leading-snug mt-2">
        {failed && !chart ? 'Chart offline, retrying... ' : candles.length === 0 ? 'No predictions yet, so this is the opening price. ' : ''}
        Price = share of the points pool{chart ? ` (${Number(chart.total).toLocaleString('en-US', { minimumFractionDigits: 2 })} points in play)` : ''}. Candles show how it moved. Points only, no cash value.
      </p>
    </div>
  );
};

export default MarketChart;
