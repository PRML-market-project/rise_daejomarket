import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(scriptDirectory, "..");
const source = path.resolve(adminRoot, "..", "frontend", "ml-test-main", "src", "data", "figma-map-shops.ts");
const destination = path.resolve(adminRoot, "src", "data", "kioskMapShops.generated.ts");

try {
  await access(source);
  await copyFile(source, destination);
  await copyFile(path.join(path.dirname(source), "search-tag-icons.ts"), path.resolve(adminRoot, "src/data/search-tag-icons.ts"));
  const tagSource = path.resolve(adminRoot, "../frontend/ml-test-main/public/search-icons");
  const tagDestination = path.resolve(adminRoot, "public/search-icons");
  await mkdir(tagDestination, { recursive: true });
  for (const file of await readdir(tagSource)) {
    if (file.endsWith(".svg")) await copyFile(path.join(tagSource, file), path.join(tagDestination, file));
  }
  const iconsSource = path.resolve(adminRoot, "../frontend/ml-test-main/public/images");
  const iconsDestination = path.resolve(adminRoot, "public/map-icons");
  await mkdir(iconsDestination, { recursive: true });
  for (const file of await readdir(iconsSource)) {
    if (/^figma-.*-icon\.svg$/.test(file)) await copyFile(path.join(iconsSource, file), path.join(iconsDestination, file));
  }
  const mapDestination = path.resolve(adminRoot, "public/images");
  await mkdir(mapDestination, { recursive: true });
  await copyFile(path.join(iconsSource, "daejomarket-map.svg"), path.join(mapDestination, "daejomarket-map.svg"));
  console.log("[map-data] Synced the kiosk shop map into the admin app.");
} catch {
  // The production Docker context can contain only admin-frontend. In that
  // case the committed snapshot remains available and the build stays valid.
  console.log("[map-data] Kiosk source is outside this build context; using the committed synchronized snapshot.");
}
