#!/usr/bin/env python3
import re, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / 'docs' / 'Santurce_Attribute_Matrix_With_Archetype_System.xlsx'
TS_WEIGHTS = ROOT / 'src' / 'domain' / 'playerRatings.ts'
REPORT = ROOT / 'docs' / 'santurce-ovr-audit.md'

NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RNS = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

def parse_xlsx():
    z = zipfile.ZipFile(XLSX)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        shared = [''.join(t.text or '' for t in si.findall('.//x:t', NS)) for si in root.findall('x:si', NS)]
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels.findall('r:Relationship', RNS)}

    def sheet_rows(name):
        sh = next(s for s in wb.findall('.//x:sheet', NS) if s.attrib['name'] == name)
        rid = sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = rel_map[rid].lstrip('/')
        path = target if target.startswith('xl/') else f'xl/{target}'
        root = ET.fromstring(z.read(path))
        rows = []
        for row in root.findall('.//x:row', NS):
            vals = []
            for c in row.findall('x:c', NS):
                v = c.find('x:v', NS)
                val = ''
                if v is not None:
                    val = v.text or ''
                    if c.attrib.get('t') == 's':
                        val = shared[int(val)]
                vals.append(val)
            rows.append(vals)
        return rows

    matrix = sheet_rows('Santurce Attribute Matrix')
    calib = sheet_rows('OVR Calibration')
    weights = sheet_rows('OVR Weights')
    return matrix, calib, weights

def parse_ts_weights():
    text = TS_WEIGHTS.read_text(encoding='utf-8')
    block = re.search(r'POSITION_OVERALL_WEIGHTS:[\s\S]*?=\s*\{([\s\S]*?)\n\};', text)
    if not block:
        raise RuntimeError('Could not find POSITION_OVERALL_WEIGHTS in playerRatings.ts')
    per_pos = {}
    for pos in POSITIONS:
        m = re.search(rf'{pos}:\s*\{{([^}}]+)\}}', block.group(1))
        if not m:
            continue
        entries = {}
        for attr, value in re.findall(r'(\w+):\s*([0-9.]+)', m.group(1)):
            entries[attr] = float(value)
        per_pos[pos] = entries
    return per_pos

def parse_workbook_weights(rows):
    header = rows[0]
    col = {name: header.index(name) for name in POSITIONS}
    out = {p: {} for p in POSITIONS}
    for r in rows[1:]:
        if not r or not r[0] or r[0] in ('', 'OVR formula notes', 'Total'):
            continue
        attr = r[0]
        for p in POSITIONS:
            if col[p] < len(r) and r[col[p]] not in ('', None):
                out[p][attr] = float(r[col[p]])
    return out

def main():
    matrix, calib, wb_weight_rows = parse_xlsx()
    ts_weights = parse_ts_weights()
    wb_weights = parse_workbook_weights(wb_weight_rows)

    weight_diffs = []
    for p in POSITIONS:
        for attr, wbv in wb_weights[p].items():
            tsv = ts_weights.get(p, {}).get(attr)
            if tsv is None or abs(tsv - wbv) > 1e-9:
                weight_diffs.append((p, attr, wbv, tsv))

    target_row = next(r for r in matrix if r and r[0] == 'Target OVR / reference')
    player_names = matrix[0][1:]
    targets = {name: int(float(target_row[i+1])) for i, name in enumerate(player_names)}

    header = calib[0]
    idx = {h: i for i, h in enumerate(header)}
    gaps = []
    for r in calib[1:]:
        if not r or len(r) < 5 or not r[0] or r[idx['Generated OVR']] in ('', None):
            continue
        player = r[idx['Player']]
        gen = int(float(r[idx['Generated OVR']]))
        target = targets.get(player, int(float(r[idx['Target OVR']])))
        gaps.append((player, target, gen, gen - target, r[idx['Diagnosis']], r[idx['Action']]))

    lines = ['# Santurce OVR Audit', '', 'Source of truth: `docs/Santurce_Attribute_Matrix_With_Archetype_System.xlsx`.', '']
    lines.append('## OVR weights parity (workbook vs in-game code)')
    if weight_diffs:
        lines.append(f'- ❌ Found {len(weight_diffs)} mismatched weight cells between workbook and `src/domain/playerRatings.ts`.')
    else:
        lines.append('- ✅ All position/attribute OVR weights match workbook values exactly.')

    lines += ['', '## Target OVR calibration status (from workbook OVR Calibration sheet)', '', '| Player | Target OVR | Generated OVR | Gap | Diagnosis | Action |', '|---|---:|---:|---:|---|---|']
    for player, target, gen, gap, diagnosis, action in gaps:
        lines.append(f'| {player} | {target} | {gen} | {gap:+d} | {diagnosis} | {action} |')

    off_by_two = [g for g in gaps if abs(g[3]) >= 2]
    lines += ['', f'- Players with absolute gap ≥2: **{len(off_by_two)}**.']
    if off_by_two:
        lines.append('- ' + ', '.join([f"{p} ({gap:+d})" for p,_,_,gap,_,_ in off_by_two]))

    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Wrote {REPORT.relative_to(ROOT)}')

if __name__ == '__main__':
    main()
