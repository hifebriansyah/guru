// A short hash of a file in public/: the ?v= that app/root.tsx puts after the name of the share image, the favicon and the touch icon.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function assetVersion(name: string): string {
  return createHash("sha256").update(readFileSync(new URL(`../public/${name}`, import.meta.url))).digest("hex").slice(0, 8);
}
