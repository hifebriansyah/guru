// The icons are Lucide (https://lucide.dev, ISC License), sized and drawn by the `svg.i` rule in styles/app.css.
import { ArrowUp, Info, Moon, Settings2, Shield, Sun, X } from "lucide-react";

const icons = { send: ArrowUp, info: Info, moon: Moon, settings: Settings2, shield: Shield, sun: Sun, close: X };

export type IconName = keyof typeof icons;

export function Icon({ name }: { name: IconName }) {
  const Lucide = icons[name];
  return <Lucide className="i" aria-hidden="true" />;
}
