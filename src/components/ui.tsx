"use client";
import type { Evaluation, PostStatus, RuleSeverity } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

export function scoreColor(score: number) {
  if (score >= 85) return "var(--success)";
  if (score >= 70) return "var(--brand-soft)";
  if (score >= 50) return "var(--warning)";
  return "var(--destructive)";
}

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`Nota ${score} de 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={scoreColor(score)}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.32} fontWeight="600" fill="var(--foreground)">
        {score}
      </text>
    </svg>
  );
}

export function ScorePill({ score }: { score?: number }) {
  if (score === undefined) return <span className="chip">sem nota</span>;
  return (
    <span className="chip font-semibold" style={{ color: scoreColor(score), background: "var(--muted)" }}>
      {score}
    </span>
  );
}

const STATUS_STYLE: Record<PostStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_aprovacao: "bg-yellow-tint text-warning",
  pronto: "bg-highlight text-link",
  agendado: "bg-purple-tint text-special",
  publicado: "bg-brand-tint text-brand-foreground",
  arquivado: "bg-muted text-subtle-foreground",
};

export function StatusChip({ status }: { status: PostStatus }) {
  return <span className={`chip ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const SEV_STYLE: Record<RuleSeverity, string> = {
  bloqueante: "bg-[#fde8e8] text-destructive",
  forte: "bg-yellow-tint text-warning",
  recomendacao: "bg-muted text-muted-foreground",
};
const SEV_LABEL: Record<RuleSeverity, string> = { bloqueante: "Bloqueante", forte: "Forte", recomendacao: "Recomendação" };

export function SeverityChip({ severity }: { severity: RuleSeverity }) {
  return <span className={`chip ${SEV_STYLE[severity]}`}>{SEV_LABEL[severity]}</span>;
}

export function latestEvaluation(versions: { evaluation?: Evaluation }[]) {
  for (let i = versions.length - 1; i >= 0; i--) if (versions[i].evaluation) return versions[i].evaluation;
  return undefined;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 md:px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-full bg-secondary p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${value === it.value ? "bg-card text-foreground shadow-edge" : "text-muted-foreground hover:text-foreground"}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Converte <input type="datetime-local"> para ISO e de volta. */
export function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
