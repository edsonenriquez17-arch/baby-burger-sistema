import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baby Burger — Gestión",
    short_name: "Baby Burger",
    description: "Pedidos, costos, inventario y caja de Baby Burger",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#1f3fd8",
    lang: "es",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
