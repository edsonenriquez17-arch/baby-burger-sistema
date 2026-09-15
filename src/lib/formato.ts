import type { Prisma } from "@prisma/client";

type Num = number | string | Prisma.Decimal | null | undefined;

export function aNumero(v: Num): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

const moneda = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monedaFina = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const numero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
const fecha = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });
const fechaHora = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" });

/** S/ 12.50 — usa "—" cuando el valor es desconocido. */
export function fmtSoles(v: Num, fino = false): string {
  const n = aNumero(v);
  if (n === null) return "—";
  return `S/ ${(fino ? monedaFina : moneda).format(n)}`;
}

export function fmtNum(v: Num, decimales = 2): string {
  const n = aNumero(v);
  if (n === null) return "—";
  return decimales === 2 ? numero.format(n) : new Intl.NumberFormat("es-PE", { maximumFractionDigits: decimales }).format(n);
}

export function fmtPct(v: Num): string {
  const n = aNumero(v);
  if (n === null) return "—";
  return `${numero.format(n)} %`;
}

export function fmtFecha(d: Date | null | undefined): string {
  return d ? fecha.format(d) : "—";
}

export function fmtFechaHora(d: Date | null | undefined): string {
  return d ? fechaHora.format(d) : "—";
}
