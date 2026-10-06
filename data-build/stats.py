import json, sys
def combos(h): return 6 if len(h) == 2 else 4 if h.endswith('s') else 12
t = json.load(open(sys.argv[1]))
for sit in sorted(t):
    r = sum(combos(h) * v['raise'] for h, v in t[sit].items()) / 1326 * 100
    c = sum(combos(h) * v['call'] for h, v in t[sit].items()) / 1326 * 100
    print(f'{sit:20} рейз {r:5.1f} %  колл {c:5.1f} %')
