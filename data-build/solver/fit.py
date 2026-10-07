"""Подбор порогов советов после флопа по решениям солвера (dataset.jsonl).
Оценка правила = средняя доля, которую солвер отдаёт действию приложения (1.0 — полностью как солвер).
Перебираем пороги отдельно для каждой точки решения и печатаем лучшие."""
import json, sys, itertools
rows = [json.loads(l) for l in open(sys.argv[1])]
STACK, POT = 975, 55

def score(rs, decide):
    return sum(r['mix'].get(decide(r), 0) for r in rs) / max(1, len(rs))

def current(r):
    a = r['app']
    if a == 'allin': return 'call' if r['bet'] >= STACK else ('raise' if r['bet'] else 'bet')
    return a

out = {}
# A: ББ ходит первым против повысившего
A = [r for r in rows if r['kind'] == 'A']
best = max(((score(A, lambda r, t=t: 'bet' if r['eq'] >= t else 'check'), t) for t in [0.6, 0.7, 0.8, 0.9, 0.95, 1.01]))
print(f"A сейчас {score(A, current):.3f} → лучше всего: ставка при шансе ≥ {best[1]} (оценка {best[0]:.3f})")

# B: баттон после чека — ставка с сильными, блеф со слабыми (с дро или без), чек — середина
B = [r for r in rows if r['kind'] == 'B']
cands = []
for hi, lo, outs in itertools.product([0.6, 0.7, 0.75, 0.8, 0.85, 0.9], [0.0, 0.2, 0.3, 0.35, 0.4], [0, 4, 8, 99]):
    def d(r, hi=hi, lo=lo, outs=outs):
        if r['eq'] >= hi: return 'bet'
        if r['eq'] < lo and (r['outs'] >= outs or outs == 0): return 'bet'
        return 'check'
    cands.append((score(B, d), hi, lo, outs))
s, hi, lo, outs = max(cands)
print(f"B сейчас {score(B, current):.3f} → ставка при шансе ≥ {hi}; блеф при шансе < {lo} (если аутов ≥ {outs}) (оценка {s:.3f})")

# C/D: против ставки — колл, если шанс ≥ цена колла + запас; рейз, если против рук «по делу» ≥ R
for kind in 'CD':
    K = [r for r in rows if r['kind'] == kind]
    normal = [r for r in K if r['bet'] < STACK]
    allin = [r for r in K if r['bet'] >= STACK]
    cands = []
    for m, R in itertools.product([0, 0.03, 0.06, 0.08, 0.10, 0.12, 0.15], [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 1.1]):
        def d(r, m=m, R=R):
            price = r['bet'] / (POT + 2 * r['bet'])
            if r['vv'] is not None and r['vv'] >= R: return 'raise'
            return 'call' if r['eq'] >= price + m else 'fold'
        cands.append((score(normal, d), m, R))
    s, m, R = max(cands)
    print(f"{kind} обычные ставки: сейчас {score(normal, current):.3f} → колл при шансе ≥ цена + {m}, рейз при «по делу» ≥ {R} (оценка {s:.3f})")
    ca = []
    for m in [0, 0.03, 0.06, 0.1, 0.15, 0.2, 0.25, 0.3]:
        ca.append((score(allin, lambda r, m=m: 'call' if r['eq'] >= r['bet'] / (POT + 2 * r['bet']) + m else 'fold'), m))
    s, m = max(ca)
    print(f"{kind} против ва-банка: сейчас {score(allin, current):.3f} → колл при шансе ≥ цена + {m} (оценка {s:.3f})")
