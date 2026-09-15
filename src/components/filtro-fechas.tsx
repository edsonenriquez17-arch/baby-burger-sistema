/** Rango de fechas desde query params. Por defecto: hoy o el mes actual (hora de Lima). */
export function rangoDesdeParams(sp: { desde?: string; hasta?: string }, porDefecto: "dia" | "mes" | "semana" = "mes") {
  const hoyLima = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // yyyy-mm-dd
  let desdeTexto = sp.desde;
  let hastaTexto = sp.hasta;
  if (!desdeTexto && !hastaTexto) {
    if (porDefecto === "dia") desdeTexto = hastaTexto = hoyLima;
    else if (porDefecto === "semana") {
      const d = new Date(`${hoyLima}T12:00:00`);
      d.setDate(d.getDate() - 6);
      desdeTexto = d.toISOString().slice(0, 10);
      hastaTexto = hoyLima;
    } else {
      desdeTexto = `${hoyLima.slice(0, 7)}-01`;
      hastaTexto = hoyLima;
    }
  }
  desdeTexto ??= "2000-01-01";
  hastaTexto ??= hoyLima;
  // Lima = UTC-5 sin horario de verano.
  const desde = new Date(`${desdeTexto}T00:00:00-05:00`);
  const hasta = new Date(`${hastaTexto}T23:59:59.999-05:00`);
  return { desde, hasta, desdeTexto, hastaTexto, hoyLima };
}

export function FiltroFechas({ sp, conBusqueda, placeholder, extra }: { sp: { desde?: string; hasta?: string; q?: string }; conBusqueda?: boolean; placeholder?: string; extra?: React.ReactNode }) {
  const { desdeTexto, hastaTexto, hoyLima } = rangoDesdeParams(sp);
  const mes = `${hoyLima.slice(0, 7)}-01`;
  return (
    <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
      <div><label className="label">Desde</label><input type="date" name="desde" defaultValue={desdeTexto} className="input py-1.5 text-sm" /></div>
      <div><label className="label">Hasta</label><input type="date" name="hasta" defaultValue={hastaTexto} className="input py-1.5 text-sm" /></div>
      {conBusqueda && <div><label className="label">Buscar</label><input name="q" defaultValue={sp.q} placeholder={placeholder} className="input w-48 py-1.5 text-sm" /></div>}
      {extra}
      <button className="btn btn-secondary min-h-9 px-3 text-xs">Filtrar</button>
      <a href={`?desde=${hoyLima}&hasta=${hoyLima}`} className="btn btn-secondary min-h-9 px-3 text-xs">Hoy</a>
      <a href={`?desde=${mes}&hasta=${hoyLima}`} className="btn btn-secondary min-h-9 px-3 text-xs">Este mes</a>
    </form>
  );
}
