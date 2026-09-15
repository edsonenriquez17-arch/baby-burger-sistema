import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="damero flex flex-col items-center justify-center px-6 py-10 text-brand-contrast">
        <h1 className="text-4xl font-black tracking-tight">BABY BURGER</h1>
        <p className="mt-1 text-sm font-medium opacity-90">Sistema de gestión</p>
      </div>
      <div className="mx-auto w-full max-w-sm flex-1 px-6 py-8">
        <LoginForm />
      </div>
    </main>
  );
}
