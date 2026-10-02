"""Fill missing shop thumbnails through the local kiosk API; keep existing photos.

Download the Pexels photos listed in artifacts/temporary-shop-thumbnails/sources.json
first. Run without arguments to review assignments, then with --apply to save.
"""
import argparse
import json
import re
import subprocess
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "artifacts/temporary-shop-thumbnails"
BASE = "http://localhost:8080"


def request(path, data=None):
    payload = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=payload,
                                 headers={"Content-Type": "application/json"},
                                 method="GET" if data is None else "PUT")
    with urllib.request.urlopen(req, timeout=300) as response:
        return json.load(response)


def photo_for(name, category):
    rules = [
        (r"약국", "pharmacy"), (r"여관", "hotel"),
        (r"문방구", "stationery"), (r"화장품", "cosmetics"),
        (r"금거래|금은", "jewelry"), (r"가구", "furniture"),
        (r"그릇|주방", "kitchenware"), (r"신발|슈즈", "shoes"),
        (r"빈티지|패션|의류|웨이브|메리야스|로맨스|라이온|밍크|씨크", "clothes"),
        (r"닭강정|통닭|치킨", "friedChicken"), (r"만두", "dumplings"),
        (r"김치", "kimchi"), (r"건어물|북어|황태|홍어", "driedFish"),
        (r"약초|한약", "herbs"), (r"고추", "chili"),
        (r"기름|방앗간", "oil"), (r"죽집", "porridge"),
        (r"베이커리", "bread"), (r"손두부", "tofu"),
        (r"칼국수|국수", "noodles"), (r"튀김|돈가스", "friedFood"),
        (r"족발|곱창|떡갈비", "barbecue"), (r"닭", "chicken"),
        (r"과일|청과", "fruit"), (r"야채|농산물", "vegetables"),
        (r"수산|해물|골뱅이|바다", "fish"),
        (r"땅콩|견과", "nuts"), (r"정육|축산|한우", "meat"),
        (r"식당|분식|순대|뷔페|지짐|빈대떡|떡집|떡|어묵", "koreanMeal"),
    ]
    for pattern, key in rules:
        if re.search(pattern, name):
            return key
    return {"청과": "vegetables", "정육": "meat", "수산": "fish",
            "식당": "koreanMeal", "잡화": "kitchenware"}.get(category, "market")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    source = (ROOT / "admin-frontend/src/data/kioskMapShops.generated.ts").read_text(encoding="utf-8")
    shops = [dict(zip(("id", "name", "category"), match)) for match in re.findall(
        r'id: "([^"]+)".*?name: "([^"]+)".*?category: "([^"]+)"', source)]
    config = request("/api/kiosk-experience")
    originals = config["shops"]
    by_id = {shop["id"]: shop for shop in originals}
    canonical_ids = {shop["id"] for shop in shops}
    assignments = []
    merged = [dict(shop) for shop in originals]
    for shop in shops:
        existing = by_id.get(shop["id"])
        if existing is None and sum(item["name"] == shop["name"] for item in shops) == 1:
            existing = next((item for item in originals if item["name"] == shop["name"]
                             and item["id"] not in canonical_ids), None)
        if existing and existing.get("thumbnailUrl"):
            continue
        name = existing["name"] if existing else shop["name"]
        key = photo_for(name, shop["category"])
        if not (ASSETS / (key + ".jpg")).is_file():
            raise RuntimeError("Missing photo: " + key)
        icon = {"식당": "식당", "서비스업": "서비스업", "잡화": "식료품잡화",
                "식품": "식품"}.get(shop["category"], "정육청과수산")
        record = dict(existing) if existing else dict(id=shop["id"], name=name,
            description="", keywords=name, tags=[], thumbnailUrl="", icon=icon)
        assignments.append(dict(id=record["id"], name=name, photo=key))
        if existing:
            merged[originals.index(existing)] = record
        else:
            merged.append(record)
    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / "assignments.json").write_text(json.dumps(assignments, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(dict(canonicalShops=len(shops), missingPhotos=len(assignments),
                         preservedPhotos=sum(bool(s.get("thumbnailUrl")) for s in originals)), ensure_ascii=True))
    if not args.apply:
        return
    backup = ASSETS / ("config-before-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".json")
    backup.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    uploaded = {}
    for key in sorted({item["photo"] for item in assignments}):
        result = subprocess.run(["curl.exe", "--fail", "--silent", "--show-error",
            "--max-time", "30", "-F", "file=@" + str(ASSETS / (key + ".jpg")) + ";type=image/jpeg",
            BASE + "/api/kiosk-experience/media"], capture_output=True, check=True)
        uploaded[key] = json.loads(result.stdout)["url"]
    # Check that another editor has not changed the shop records during uploads.
    if request("/api/kiosk-experience")["shops"] != originals:
        raise RuntimeError("Shop settings changed during upload. Re-run to merge the latest settings.")
    assignment_by_id = {item["id"]: item for item in assignments}
    for record in merged:
        if record["id"] in assignment_by_id:
            record["thumbnailUrl"] = uploaded[assignment_by_id[record["id"]]["photo"]]
    (ASSETS / "shops-applied.json").write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    saved = request("/api/kiosk-experience/shops", {"shops": merged})
    actual = {item["id"]: item for item in request("/api/kiosk-experience")["shops"]}
    for record in merged:
        assert actual[record["id"]] == record, "Saved shop differs: " + record["id"]
    for url in set(uploaded.values()):
        with urllib.request.urlopen(BASE + url, timeout=10) as response:
            assert response.headers.get_content_type() == "image/jpeg"
            assert len(response.read()) > 1000
    print(json.dumps(dict(updated=len(assignments), downloadedPhotos=len(uploaded),
                         savedShops=len(saved["shops"]), verified=True)))


if __name__ == "__main__":
    main()
