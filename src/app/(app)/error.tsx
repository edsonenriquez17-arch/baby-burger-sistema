"use client";

export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="text-5xl">😵</div>
      <h1 className="text-xl font-bold">Algo salió mal</h1>
      <p className="text-sm text-muted">{error.message || "Error inesperado."}{error.digest && <span className="block font-mono text-xs">ref. {error.digest}</span>}</p>
      <button type="button" onClick={reset} className="btn btn-primary">Reintentar</button>
    </div>
  );
}
