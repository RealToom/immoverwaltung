import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Branding {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
}

interface BrandingContextValue {
  branding: Branding | null;
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({ branding: null, loading: true });

export function useBranding() {
  return useContext(BrandingContext);
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "221 83% 53%";

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyBrandingCssVars(primaryColor: string) {
  const hsl = hexToHsl(primaryColor);
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
  const lightness = parseInt(hsl.split(" ")[2]);
  const fg = lightness > 60 ? "0 0% 10%" : "0 0% 100%";
  document.documentElement.style.setProperty("--primary-foreground", fg);

  const meta = document.getElementById("theme-color-meta");
  if (meta) meta.setAttribute("content", primaryColor);
}

export function BrandingProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Branding }>(`/api/tenant/company/${slug}`)
      .then((res) => {
        setBranding(res.data);
        applyBrandingCssVars(res.data.primaryColor);
        document.title = res.data.name;
      })
      .catch(() => {
        applyBrandingCssVars("#2563eb");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <BrandingContext.Provider value={{ branding, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}
