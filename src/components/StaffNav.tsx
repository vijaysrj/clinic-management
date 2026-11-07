"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarClock, ClipboardList, NotebookPen, Search, UserPlus, Users } from "lucide-react";
import { cx } from "./ui";

const ICONS = { queue: ClipboardList, book: UserPlus, schedules: CalendarClock, team: Users, pad: NotebookPen, patients: Search, reports: BarChart3 };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function StaffNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cx(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-600 text-white" : "text-muted hover:bg-white hover:text-ink",
            )}
          >
            <Icon className="size-4.5" /> {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
