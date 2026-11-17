"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen01, Grid01, Stars02 } from "@untitledui/icons";
import { Avatar } from "@decocms/ui/components/avatar";
import { Button } from "@decocms/ui/components/button";
import { Input } from "@decocms/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@decocms/ui/components/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@decocms/ui/components/sidebar";
import { DecoLogo } from "./DecoLogo";
import { Field, SimpleSelect } from "./ui";
import { useProfile, type Profile } from "./useProfile";

const NAV = [
  { href: "/", label: "Avaliador", icon: Stars02 },
  { href: "/biblioteca", label: "Biblioteca", icon: Grid01 },
  { href: "/playbook", label: "Playbook", icon: BookOpen01 },
];

export function AppSidebar() {
  const path = usePathname();
  const { profile, save } = useProfile();
  const [draft, setDraft] = useState<Profile>(profile);
  const [open, setOpen] = useState(false);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <Link href="/" className="flex h-9 items-center gap-2 px-2">
          <DecoLogo className="h-5 w-auto" />
          <span className="text-sm font-medium">build in public</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? path === "/" : path.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setDraft(profile);
          }}
        >
          <PopoverTrigger asChild>
            <SidebarMenuButton size="lg" className="h-11">
              <Avatar shape="circle" size="xs" fallback={profile.name} />
              <span className="min-w-0 text-left leading-tight">
                <span className="block truncate text-sm font-medium">{profile.name}</span>
                <span className="block text-meta">{profile.role === "curador" ? "Curador" : "Autor"}</span>
              </span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-72">
            <div className="flex flex-col gap-3">
              <Field label="Nome">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Headline do LinkedIn" hint="Aparece no preview do post.">
                <Input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
              </Field>
              <Field label="Papel" hint="Só o curador aprova posts e edita o Playbook.">
                <SimpleSelect
                  value={draft.role}
                  onValueChange={(role) => setDraft({ ...draft, role })}
                  options={[
                    { value: "autor", label: "Autor" },
                    { value: "curador", label: "Curador" },
                  ]}
                />
              </Field>
              <Button
                onClick={() => {
                  save(draft);
                  setOpen(false);
                }}
              >
                Salvar perfil
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
}
