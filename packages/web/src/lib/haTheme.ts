import { useEffect, useState } from "react";

/**
 * Bridges the Home Assistant theme into Notionish when running as an ingress
 * panel. Ingress iframes are same-origin with Home Assistant, so we can read the
 * parent's resolved theme variables and map them onto our own design tokens.
 */

type Rgba = [number, number, number, number];

/** Maps our tokens (globals.css, "H S% L%" format) to Home Assistant theme variables. */
const TOKEN_MAP: Record<string, string> = {
  background: "--primary-background-color",
  foreground: "--primary-text-color",
  card: "--card-background-color",
  "card-foreground": "--primary-text-color",
  primary: "--primary-color",
  "primary-foreground": "--text-primary-color",
  secondary: "--secondary-background-color",
  "secondary-foreground": "--primary-text-color",
  muted: "--secondary-background-color",
  "muted-foreground": "--secondary-text-color",
  accent: "--secondary-background-color",
  "accent-foreground": "--primary-text-color",
  destructive: "--error-color",
  "destructive-foreground": "--text-primary-color",
  border: "--divider-color",
  input: "--divider-color",
  ring: "--primary-color",
  sidebar: "--sidebar-background-color",
  "sidebar-foreground": "--sidebar-text-color",
};

/** Used when a theme does not define the preferred variable. */
const FALLBACKS: Record<string, string> = {
  "--sidebar-background-color": "--card-background-color",
  "--sidebar-text-color": "--primary-text-color",
  "--text-primary-color": "--primary-background-color",
};

/** The Home Assistant root element when we are embedded in its frontend, else null. */
export function homeAssistantParent(): HTMLElement | null {
  try {
    if (window.parent === window) return null;
    return window.parent.document.querySelector<HTMLElement>("home-assistant");
  } catch {
    // Cross-origin parent: not an ingress panel.
    return null;
  }
}

function parseColor(value: string): Rgba | null {
  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r, g, b, a = "1"] = rgb[1].split(/[\s,/]+/).filter(Boolean);
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  // Chrome reports color-mix() results as color(srgb r g b [/ a]) with 0..1 channels.
  const srgb = value.match(/^color\(srgb ([^)]+)\)$/);
  if (srgb) {
    const [r, g, b, a = "1"] = srgb[1].split(/[\s/]+/).filter(Boolean);
    return [Number(r) * 255, Number(g) * 255, Number(b) * 255, Number(a)];
  }
  return null;
}

/** Blends a translucent color over an opaque one; our tokens have no alpha channel. */
function flatten([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function toHslToken([r, g, b]: Rgba): string {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

function luminance([r, g, b]: Rgba): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function applyTheme(haRoot: HTMLElement): "light" | "dark" {
  const parentDoc = haRoot.ownerDocument;
  // Resolve each variable through a probe element so var()/color-mix() chains
  // come back as concrete rgb values.
  const probe = parentDoc.createElement("div");
  probe.style.display = "none";
  parentDoc.body.appendChild(probe);
  const resolve = (cssVar: string): Rgba | null => {
    const computed = parentDoc.defaultView!.getComputedStyle(probe);
    if (!computed.getPropertyValue(cssVar).trim()) {
      return FALLBACKS[cssVar] ? resolve(FALLBACKS[cssVar]) : null;
    }
    probe.style.color = `var(${cssVar})`;
    return parseColor(computed.color);
  };

  const root = document.documentElement;
  try {
    const background = resolve("--primary-background-color") ?? [255, 255, 255, 1];
    for (const [token, cssVar] of Object.entries(TOKEN_MAP)) {
      const color = resolve(cssVar);
      if (color) root.style.setProperty(`--${token}`, toHslToken(flatten(color, background)));
      else root.style.removeProperty(`--${token}`);
    }

    const parentStyle = parentDoc.defaultView!.getComputedStyle(parentDoc.body);
    document.body.style.fontFamily = parentStyle.fontFamily;
    const radius = parseFloat(parentDoc.defaultView!.getComputedStyle(parentDoc.documentElement).getPropertyValue("--ha-card-border-radius"));
    if (!Number.isNaN(radius)) root.style.setProperty("--radius", `${Math.min(radius, 12)}px`);

    const darkMode = (haRoot as any).hass?.themes?.darkMode;
    return typeof darkMode === "boolean" ? (darkMode ? "dark" : "light") : luminance(background) < 0.5 ? "dark" : "light";
  } finally {
    probe.remove();
  }
}

/**
 * When embedded in Home Assistant, keeps our tokens in sync with its theme and
 * returns the active color scheme. Returns null when running standalone.
 */
export function useHomeAssistantTheme(): "light" | "dark" | null {
  const [scheme, setScheme] = useState<"light" | "dark" | null>(() => {
    const haRoot = homeAssistantParent();
    return haRoot ? applyTheme(haRoot) : null;
  });

  useEffect(() => {
    const haRoot = homeAssistantParent();
    if (!haRoot) return;
    document.documentElement.classList.add("ha");

    const sync = () => setScheme(applyTheme(haRoot));
    // Home Assistant re-applies theme variables on <html> when the theme or dark mode changes.
    const observer = new MutationObserver(sync);
    observer.observe(haRoot.ownerDocument.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    const media = haRoot.ownerDocument.defaultView!.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    window.addEventListener("focus", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return scheme;
}
