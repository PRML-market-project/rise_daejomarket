import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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
  const mapComponentDestination = path.resolve(adminRoot, "src/components/market");
  await mkdir(mapComponentDestination, { recursive: true });
  const mapSource = path.resolve(adminRoot, "../frontend/ml-test-main/src/components/market");
  const mapCode = (await readFile(path.join(mapSource, "MapView.tsx"), "utf8"))
    .replace('import { useKioskLocale } from "@/features/kiosk/i18n";', '')
    .replace('const { t } = useKioskLocale();', 'const t = (text: string) => text;');
  await writeFile(path.join(mapComponentDestination, "MapView.tsx"), mapCode);
  await copyFile(path.join(mapSource, "locationMarker.ts"), path.join(mapComponentDestination, "locationMarker.ts"));
  await copyFile(path.join(path.dirname(source), "mapShopLabels.ts"), path.resolve(adminRoot, "src/data/mapShopLabels.ts"));
  const fontsSource = path.resolve(adminRoot, "../frontend/ml-test-main/public/fonts");
  const fontsDestination = path.resolve(adminRoot, "public/fonts");
  await mkdir(fontsDestination, { recursive: true });
  for (const file of ["Pretendard-Bold.woff2", "Pretendard-OFL.txt"]) {
    await copyFile(path.join(fontsSource, file), path.join(fontsDestination, file));
  }
  const tagSource = path.resolve(adminRoot, "../frontend/ml-test-main/public/search-icons");
  const tagDestination = path.resolve(adminRoot, "public/search-icons");
  await mkdir(tagDestination, { recursive: true });
  for (const file of await readdir(tagSource)) {
    if (file.endsWith(".svg")) await copyFile(path.join(tagSource, file), path.join(tagDestination, file));
  }
  const iconsSource = path.resolve(adminRoot, "../frontend/ml-test-main/public/images");
  const iconsDestination = path.resolve(adminRoot, "public/map-icons");
  const mapDestination = path.resolve(adminRoot, "public/images");
  await mkdir(iconsDestination, { recursive: true });
  await mkdir(mapDestination, { recursive: true });
  for (const file of await readdir(iconsSource)) {
    if (/^figma-.*-icon\.svg$/.test(file)) {
      await copyFile(path.join(iconsSource, file), path.join(iconsDestination, file));
      await copyFile(path.join(iconsSource, file), path.join(mapDestination, file));
    }
  }
  await copyFile(path.join(iconsSource, "daejomarket-map.svg"), path.join(mapDestination, "daejomarket-map.svg"));
  await copyFile(path.join(iconsSource, "daejomarket-shop-labels.svg"), path.join(mapDestination, "daejomarket-shop-labels.svg"));
  const designSource = path.resolve(adminRoot, "../frontend/ml-test-main/public/figma");
  const designDestination = path.resolve(adminRoot, "public/figma");
  await mkdir(designDestination, { recursive: true });
  for (const file of ["daecho-logo.svg", "search-result-food.png"]) {
    await copyFile(path.join(designSource, file), path.join(designDestination, file));
  }
  const resultsDestination = path.join(designDestination, "results");
  await mkdir(resultsDestination, { recursive: true });
  for (const file of ["current-location-tail.svg", "current-location-tail-left.svg", "map-zoom-in.svg", "map-zoom-out.svg"]) {
    await copyFile(path.join(designSource, "results", file), path.join(resultsDestination, file));
  }
  console.log("[map-data] Synced the kiosk shop map into the admin app.");
} catch (error) {
  // Only fall back when the sibling kiosk project is absent. A missing file
  // inside an available source project must fail instead of serving old data.
  try {
    await access(path.resolve(adminRoot, "../frontend/ml-test-main"));
  } catch (sourceError) {
    if (sourceError.code !== "ENOENT") throw sourceError;
    console.log("[map-data] Kiosk source is outside this build context; using the committed synchronized snapshot.");
    process.exit(0);
  }
  throw error;
}
