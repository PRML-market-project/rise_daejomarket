"""Separate the original outlined shop names without moving any SVG geometry."""
import json
import re
import hashlib
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

root = Path(__file__).resolve().parents[1]
map_path = root / 'public/images/daejomarket-map.svg'
source = map_path.read_text(encoding='utf-8')
shop_source = (root / 'src/data/figma-map-shops.ts').read_text(encoding='utf-8')
shops = []
for line in shop_source.splitlines():
    match = re.search(r'id: "([^"]+)".*?name: "([^"]+)".*? x: ([\d.]+), y: ([\d.]+), width: ([\d.]+), height: ([\d.]+)', line)
    if match:
        shop_id, name, x, y, width, height = match.groups()
        shops.append(dict(id=shop_id, name=name, x=float(x), y=float(y), width=float(width), height=float(height)))

labels = {shop['id']: [] for shop in shops}
fills = Counter()
remaining = []
for line in source.splitlines(keepends=True):
    match = re.match(r'<path\b[^>]*\bd="([^"]+)"', line)
    # Shop-name outlines use this fill. Other paths inside the same bounds
    # can be white icons or clipping geometry and must stay in the base map.
    if not match or 'fill="#7A7A7A"' not in line:
        remaining.append(line)
        continue
    pen = BoundsPen(None)
    parse_path(match.group(1), pen)
    if not pen.bounds:
        remaining.append(line)
        continue
    x1, y1, x2, y2 = pen.bounds
    candidates = [shop for shop in shops if
                  x1 >= shop['x'] - 0.5 and y1 >= shop['y'] - 0.5 and
                  x2 <= shop['x'] + shop['width'] + 0.5 and
                  y2 <= shop['y'] + shop['height'] + 0.5]
    if len(candidates) > 1:
        raise RuntimeError(f'Ambiguous label geometry: {[shop["name"] for shop in candidates]}')
    if candidates:
        labels[candidates[0]['id']].append(line)
        fills.update(re.findall(r'fill="([^"]+)"', line))
    else:
        remaining.append(line)

missing = [shop['name'] for shop in shops if not labels[shop['id']]]

# Support repairing an already separated map: recover its original grey paths.
atlas_path = root / 'public/images/daejomarket-shop-labels.svg'
old_atlas = atlas_path.read_text(encoding='utf-8') if atlas_path.exists() else ''
for shop in shops:
    if labels[shop['id']]:
        continue
    symbol_id = 'shop-label-' + shop['id'].replace(':', '-')
    old_group = re.search(r'<g id="' + symbol_id + r'">(.*?)</g>', old_atlas, re.S)
    if old_group:
        labels[shop['id']] = old_group.group(1).strip().splitlines(keepends=True)

def owner_of_path(path):
    pen = BoundsPen(None)
    parse_path(path, pen)
    if not pen.bounds:
        return None
    x1, y1, x2, y2 = pen.bounds
    owners = [shop for shop in shops if
              x1 >= shop['x'] - 0.5 and y1 >= shop['y'] - 0.5 and
              x2 <= shop['x'] + shop['width'] + 0.5 and
              y2 <= shop['y'] + shop['height'] + 0.5]
    return owners[0]['id'] if len(owners) == 1 else None

# Figma outlines have TWO visible layers: a white halo with a mask, followed
# by the grey lettering. Move both, including their mask definitions.
mask_owners = {}
mask_definitions = {}
for mask_xml in re.findall(r'<mask\b.*?</mask>', source + old_atlas, re.S):
    mask = ET.fromstring(mask_xml)
    path = next((node for node in mask if node.tag == 'path'), None)
    if path is not None:
        owner = owner_of_path(path.attrib['d'])
        if owner:
            mask_owners[mask.attrib['id']] = owner
            mask_definitions[mask.attrib['id']] = mask_xml

background = ''.join(remaining)
for mask_id, owner in mask_owners.items():
    halo_pattern = r'<path\b[^>]*mask="url\(#' + re.escape(mask_id) + r'\)"[^>]*/>\r?\n?'
    halos = re.findall(halo_pattern, background)
    if halos:
        labels[owner] = halos + labels[owner]
        background = re.sub(halo_pattern, '', background)
    mask_pattern = r'<mask\b[^>]*id="' + re.escape(mask_id) + r'"[^>]*>.*?</mask>\r?\n?'
    background = re.sub(mask_pattern, '', background, flags=re.S)

missing = [shop['name'] for shop in shops if not labels[shop['id']]]
print(f'Shops: {len(shops)}, label layers: {sum(map(len, labels.values()))}, masks: {len(mask_owners)}, missing: {missing}')

if '--write' in __import__('sys').argv:
    if missing:
        raise RuntimeError('Some shop labels could not be separated')
    atlas = ['<svg xmlns="http://www.w3.org/2000/svg" width="6807" height="10577" viewBox="0 0 6807 10577">\n<defs>\n']
    atlas.extend(mask + '\n' for mask in mask_definitions.values())
    ids = []
    for shop in shops:
        symbol_id = 'shop-label-' + shop['id'].replace(':', '-')
        ids.append(dict(shopId=shop['id'], symbolId=symbol_id))
        atlas.append(f'<g id="{symbol_id}">\n')
        atlas.extend(line.rstrip() + '\n' for line in labels[shop['id']])
        atlas.append('</g>\n')
    atlas.append('</defs>\n</svg>\n')
    atlas_text = ''.join(atlas)
    atlas_path.write_text(atlas_text, encoding='utf-8')
    background_version = hashlib.sha256(background.encode()).hexdigest()[:12]
    labels_version = hashlib.sha256(atlas_text.encode()).hexdigest()[:12]
    (root / 'src/data/mapShopLabels.ts').write_text(
        '// Original Figma outlines, kept at their original map coordinates.\n'
        + f'export const mapBackgroundUrl = "/images/daejomarket-map.svg?v={background_version}";\n'
        + f'export const mapLabelsUrl = "/images/daejomarket-shop-labels.svg?v={labels_version}";\n'
        + 'export const mapShopLabels = ' + json.dumps(ids, ensure_ascii=False, indent=2) + ' as const;\n', encoding='utf-8')
    map_path.write_text(background, encoding='utf-8')
