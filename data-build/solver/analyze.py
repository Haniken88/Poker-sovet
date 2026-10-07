"""Разбор dataset.jsonl: как солвер действует в зависимости от того, что видит приложение.
Печатает по каждой точке решения таблицу «шанс приложения (корзины по 10 %) → доли действий солвера»
и долю совпадений текущего приложения с главным действием солвера."""
import json, sys
from collections import defaultdict

rows = [json.loads(l) for l in open(sys.argv[1])]
KINDS = {'A': 'ББ первым (чек/ставка)', 'B': 'баттон после чека (ставка/чек)',
         'C': 'ББ против ставки баттона', 'D': 'баттон против ставки ББ'}

def top(mix): return max(mix, key=mix.get)

def app_group(r):
    a = r['app']
    if a == 'allin': return 'call' if r['bet'] >= 975 else ('raise' if r['bet'] else 'bet')
    return a

for kind, title in KINDS.items():
    rs = [r for r in rows if r['kind'] == kind]
    if not rs: continue
    match = sum(app_group(r) == top(r['mix']) for r in rs) / len(rs)
    print(f'\n== {kind}: {title} — рук {len(rs)}, приложение совпадает с солвером: {match:.0%}')
    sizes = sorted({r['ratio'] for r in rs}) if kind in 'CD' else [None]
    for size in sizes:
        sub = [r for r in rs if size is None or r['ratio'] == size]
        if size is not None: print(f'  ставка {size} банка')
        buckets = defaultdict(list)
        for r in sub: buckets[min(9, int(r['eq'] * 10))].append(r)
        for b in sorted(buckets):
            g = buckets[b]
            acts = defaultdict(float)
            for r in g:
                for k, v in r['mix'].items(): acts[k] += v / len(g)
            app = defaultdict(int)
            for r in g: app[app_group(r)] += 1
            print(f'    шанс {b*10:2d}–{b*10+9:2d} %: n={len(g):4d} | солвер ' +
                  ', '.join(f'{k} {v:.0%}' for k, v in sorted(acts.items(), key=lambda x: -x[1])) +
                  ' | приложение ' + ', '.join(f'{k} {v/len(g):.0%}' for k, v in sorted(app.items(), key=lambda x: -x[1])))
