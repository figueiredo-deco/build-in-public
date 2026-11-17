"use client";
import { useEffect, useState } from "react";

export interface Profile {
  name: string;
  headline: string;
  role: "autor" | "curador";
}

const DEFAULT: Profile = { name: "Seu nome", headline: "Building in public na deco", role: "autor" };
const KEY = "bip-profile";

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProfile({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {}
    const onChange = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) setProfile({ ...DEFAULT, ...JSON.parse(raw) });
      } catch {}
    };
    window.addEventListener("bip-profile", onChange);
    return () => window.removeEventListener("bip-profile", onChange);
  }, []);
  const save = (p: Profile) => {
    setProfile(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
    window.dispatchEvent(new Event("bip-profile"));
  };
  return { profile, save };
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}
