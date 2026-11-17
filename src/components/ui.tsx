"use client";
import type { ReactNode } from "react";
import { Badge } from "@decocms/ui/components/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@decocms/ui/components/breadcrumb";
import { Label } from "@decocms/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@decocms/ui/components/select";
import { SidebarTrigger } from "@decocms/ui/components/sidebar";
import { cn } from "@decocms/ui/lib/utils";
import type { Evaluation, PostStatus, RuleSeverity } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

/* ---------- Página (segue o padrão Page do Studio) ---------- */

const WIDTH = { reading: "max-w-[720px]", standard: "max-w-[1024px]", wide: "max-w-[1200px]", fluid: "max-w-none" } as const;

/** Cabeçalho com breadcrumb (sem h1 repetindo a rota) e ações à direita. */
export function PageHeader({ crumb, actions, toolbar }: { crumb: ReactNode; actions?: ReactNode; toolbar?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:rounded-t-xl">
      <SidebarTrigger className="md:hidden" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{crumb}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {toolbar && <div className="ml-3 hidden sm:block">{toolbar}</div>}
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}

export function PageContainer({ width = "wide", className, children }: { width?: keyof typeof WIDTH; className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full px-4 py-6 md:px-8", WIDTH[width], className)}>{children}</div>;
}

/* ---------- Campos ---------- */

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-meta">{hint}</p>}
    </div>
  );
}

/** Select do design system com uma API simples de opções. */
export function SimpleSelect<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  size,
}: {
  value: T | "";
  onValueChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onValueChange(v as T)} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)} size={size}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------- Nota ---------- */

export function scoreTone(score: number) {
  if (score >= 85) return "success";
  if (score >= 70) return "brand";
  if (score >= 50) return "warning";
  return "destructive";
}

export function scoreColor(score: number) {
  const t = scoreTone(score);
  return t === "brand" ? "var(--brand-soft)" : `var(--${t})`;
}

export function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`Nota ${score} de 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={scoreColor(score)}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.32} className="font-display tnum" fill="var(--foreground)">
        {score}
      </text>
    </svg>
  );
}

/** Barra de nota com a cor da faixa (a Progress do DS é monocromática). */
export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor(score) }} />
    </div>
  );
}

export function ScorePill({ score }: { score?: number }) {
  if (score === undefined) return <Badge variant="muted">sem nota</Badge>;
  return (
    <Badge variant="muted" className="tnum min-w-9" style={{ color: scoreColor(score) }}>
      {score}
    </Badge>
  );
}

/* ---------- Status ---------- */

const STATUS_CLASS: Record<PostStatus, string> = {
  rascunho: "",
  em_aprovacao: "bg-warning/10 text-warning",
  pronto: "bg-notice/10 text-notice",
  agendado: "bg-special/10 text-special",
  publicado: "bg-success/10 text-success",
  arquivado: "opacity-60",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <Badge variant="muted" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const SEV_CLASS: Record<RuleSeverity, string> = {
  bloqueante: "bg-destructive/10 text-destructive",
  forte: "bg-warning/10 text-warning",
  recomendacao: "",
};
const SEV_LABEL: Record<RuleSeverity, string> = { bloqueante: "Bloqueante", forte: "Forte", recomendacao: "Recomendação" };

export function SeverityBadge({ severity }: { severity: RuleSeverity }) {
  return (
    <Badge variant="muted" className={SEV_CLASS[severity]}>
      {SEV_LABEL[severity]}
    </Badge>
  );
}

/* ---------- Utilitários ---------- */

export function latestEvaluation(versions: { evaluation?: Evaluation }[]) {
  for (let i = versions.length - 1; i >= 0; i--) if (versions[i].evaluation) return versions[i].evaluation;
  return undefined;
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Converte ISO para o valor de <input type="datetime-local">. */
export function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
