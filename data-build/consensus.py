"""Сведение префлоп-таблиц из нескольких солверных источников в одну «золотую середину».
Для каждой ситуации и руки: средняя частота рейза и колла по источникам, где ситуация есть;
решение = действие с наибольшей средней частотой; «спорно», если за него меньше двух третей
(то есть источники заметно расходятся или сами солверы смешивают действия).
Выход: src/preflopData.js — компактная таблица для приложения + отчёт о расхождениях."""
import json, sys

def load(path): return json.load(open(path))

def normalize_vs3bet(t):
    """У Pio в ответе на 3-бет записано «открыть × ответить» — делим на частоту открытия."""
    out = dict(t)
    for sit, hands in t.items():
        if not sit.startswith('vs3bet:'): continue
        opener = sit.split(':')[1]
        open_t = t.get(f'open:{opener}', {})
        fixed = {}
        for h, v in hands.items():
            o = open_t.get(h, {}).get('raise', 0)
            fixed[h] = {k: (min(1.0, x / o) if o > 0.02 else 0.0) for k, x in v.items()}
        out[sit] = fixed
    return out

ACTS = ('fold', 'call', 'raise')

def best(v):
    return max(ACTS, key=lambda a: v[a])

R = 'AKQJT98765432'
ALL = [R[i] * 2 for i in range(13)] + [R[i] + R[j] + t for i in range(13) for j in range(i + 1, 13) for t in 'so']

SPEC = set()
for i, a in enumerate(R):
    for j in range(i + 1, 13):
        b = R[j]
        if j - i <= 2 and i >= 3: SPEC.add(a + b + 's')   # одномастные связки и с одним пропуском: QJs…43s
    if i == 0:
        for b in R[5:]: SPEC.add('A' + b + 's')             # тузы одной масти A9s…A2s
for p in '65432': SPEC.add(p + p)                           # маленькие пары 66…22

def is_speculative(h): return h in SPEC

def main(out_js, out_report, *sources):
    tables = [(name, t) for name, t in sources]
    sits = sorted({s for _, t in tables for s in t})
    data, report = {}, []
    for sit in sits:
        have = [(n, t[sit]) for n, t in tables if sit in t]
        # Источник «умеет» коллировать в этой точке, если хоть одна рука у него коллирует.
        can_call = [n for n, t in have if any(v.get('call', 0) > 0.001 for v in t.values())]
        row = {}
        for h in ALL:
            per = []
            for n, t in have:
                # gto-solver сам пишет, что занижает руки «на попадание» (не доигрывает постфлоп) —
                # если он для такой руки осторожнее остальных, его голос не берём.
                if n == 'gtosolver' and is_speculative(h) and len(have) > 1:
                    v0 = t.get(h, {})
                    others = [o[h].get('raise', 0) + o[h].get('call', 0) if h in o else 0.0 for m, o in have if m != n]
                    if v0.get('raise', 0) + v0.get('call', 0) < sum(others) / len(others): continue
                v = t.get(h, {})  # руки нет в файле — значит, её не играют (0 %)
                r, c = v.get('raise', 0.0), v.get('call', 0.0)
                per.append((n, r, c))
            # Шаг 1: играть или пас — голосуют все.
            cont = sum(r + c for _, r, c in per) / len(per)
            # Шаг 2: колл или рейз — только те, у кого колл вообще разрешён.
            split_src = [(r, c) for n, r, c in per if n in can_call and r + c > 0.001] or [(r, c) for _, r, c in per if r + c > 0.001]
            share_raise = (sum(r / (r + c) for r, c in split_src) / len(split_src)) if split_src else 1.0
            raise_ = cont * share_raise
            call = cont - raise_
            close = 0.34 < cont < 0.66 or (cont >= 0.5 and 0.35 < share_raise < 0.65)
            row[h] = [round(raise_ * 100), round(call * 100), 1 if close else 0]
            votes = {('play' if r + c >= 0.5 else 'fold') for _, r, c in per}
            if len(votes) > 1:
                report.append(f'{sit:18} {h:4} ' + ' | '.join(f'{n}: р{r:.0%} к{c:.0%}' for n, r, c in per))
        data[sit] = {'sources': [n for n, _ in have], 'hands': row}
    with open(out_js, 'w') as f:
        f.write('// Создано data-build/consensus.py: средние частоты префлоп-решений по нескольким\n')
        f.write('// солверным источникам (6-max, 100 ББ). Для каждой руки: [рейз %, колл %, спорно].\n')
        f.write('// Ситуации: open:<место>, vsopen:<герой>:<открывший>, vs3bet:<открывший>:<3-бетор>.\n')
        f.write('export const PREFLOP_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(out_report, 'w').write('\n'.join(report) + '\n')
    print(len(data), 'ситуаций,', sum(len(v['hands']) for v in data.values()), 'строк; расхождений (не пас):', len(report))

if __name__ == '__main__':
    out_js, out_report = sys.argv[1], sys.argv[2]
    srcs = []
    for arg in sys.argv[3:]:
        name, path = arg.split('=')
        t = load(path)
        if name == 'pio': t = normalize_vs3bet(t)
        srcs.append((name, t))
    main(out_js, out_report, *srcs)
