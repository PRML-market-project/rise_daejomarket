import { access, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(scriptDirectory, "..");
const source = path.resolve(adminRoot, "..", "frontend", "ml-test-main", "src", "data", "figma-map-shops.ts");
const destination = path.resolve(adminRoot, "src", "data", "kioskMapShops.generated.ts");

try {
  await access(source);
  await copyFile(source, destination);
  console.log("[map-data] Synced the kiosk shop map into the admin app.");
} catch {
  // The production Docker context can contain only admin-frontend. In that
  // case the committed snapshot remains available and the build stays valid.
  console.log("[map-data] Kiosk source is outside this build context; using the committed synchronized snapshot.");
}
