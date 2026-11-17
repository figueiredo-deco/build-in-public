"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, Library, Sparkles, UserRound } from "lucide-react";
import { DecoLogo } from "./DecoLogo";
import { initials, useProfile } from "./useProfile";

const NAV = [
  { href: "/", label: "Avaliador", icon: Sparkles },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/playbook", label: "Playbook", icon: BookOpen },
];

export function Sidebar() {
  const path = usePathname();
  const { profile, save } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  return (
    <aside className="flex md:h-screen md:w-60 shrink-0 flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-border bg-sidebar px-3 py-3 md:py-5 md:sticky md:top-0 items-center md:items-stretch">
      <Link href="/" className="flex items-center gap-2 px-2 md:mb-6">
        <DecoLogo />
        <span className="text-sm font-semibold tracking-tight hidden sm:inline">build in public</span>
      </Link>
      <nav className="flex md:flex-col gap-1 ml-auto md:ml-0">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-[0.625rem] px-2.5 py-2 text-sm transition-colors ${
                active ? "bg-secondary-hover font-medium text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden md:block">
        {editing ? (
          <div className="surface p-3 space-y-2">
            <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome" />
            <input className="field" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="Headline do LinkedIn" />
            <select className="field" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as "autor" | "curador" })}>
              <option value="autor">Autor</option>
              <option value="curador">Curador</option>
            </select>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => { save(draft); setEditing(false); }}>Salvar</button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(profile); setEditing(true); }}
            className="flex w-full items-center gap-2.5 rounded-[0.625rem] px-2 py-2 text-left hover:bg-secondary"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">{initials(profile.name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{profile.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound size={11} />{profile.role === "curador" ? "Curador" : "Autor"}</span>
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
