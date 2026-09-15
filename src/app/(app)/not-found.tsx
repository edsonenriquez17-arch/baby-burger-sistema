import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="text-5xl">🔍</div>
      <h1 className="text-xl font-bold">No encontramos esa página</h1>
      <Link href="/" className="btn btn-secondary">Volver al inicio</Link>
    </div>
  );
}
