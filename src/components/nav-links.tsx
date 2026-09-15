"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ItemNav } from "@/lib/navegacion";

type Props = { items: ItemNav[]; variante: "lateral" | "inferior" };

export function NavLinks({ items, variante }: Props) {
  const pathname = usePathname();

  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  if (variante === "inferior") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border bg-surface md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              activo(item.href) ? "text-brand" : "text-muted"
            }`}
          >
            <span className="text-2xl leading-none">{item.icono}</span>
            {item.etiqueta}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const deshabilitado = item.fase !== undefined;
        const clases = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
          deshabilitado
            ? "cursor-not-allowed text-muted/60"
            : activo(item.href)
              ? "bg-brand-light text-brand"
              : "text-foreground hover:bg-brand-light/60"
        }`;
        const contenido = (
          <>
            <span className="text-lg leading-none">{item.icono}</span>
            <span className="flex-1">{item.etiqueta}</span>
            {deshabilitado && <span className="badge bg-border text-muted">Fase {item.fase}</span>}
          </>
        );
        return deshabilitado ? (
          <span key={item.href} className={clases} title={`Disponible en la fase ${item.fase}`}>
            {contenido}
          </span>
        ) : (
          <Link key={item.href} href={item.href} className={clases}>
            {contenido}
          </Link>
        );
      })}
    </nav>
  );
}
