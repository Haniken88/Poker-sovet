"""Разбор public/preflop/100bb.json из omeregepeksari/gto-solver (6-max, 100 ББ, без рейка).
Узел решения: p — игрок (0=UTG…5=BB), a — действия ('F','C','R2.5'…), ch — дети,
s — частоты ×1000, s[действие*169 + класс]; класс: строка/столбец 0 = туз,
одномастные выше диагонали (hi*13+lo), разномастные ниже (lo*13+hi)."""
import json, sys

POS = ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
R = 'AKQJT98765432'

def class_name(idx):
    row, col = divmod(idx, 13)
    if row == col: return R[row] * 2
    if row < col: return R[row] + R[col] + 's'
    return R[col] + R[row] + 'o'

def main(src, out):
    d = json.load(open(src))
    nodes = d['nodes']
    table = {}
    def visit(i, history):
        n = nodes[i]
        if 'p' not in n: return
        player = POS[n['p']]
        bets = [p for p, a in history if a == 'R']
        calls = [p for p, a in history if a == 'C']
        sit = None
        if not calls:
            if not bets: sit = f'open:{player}'
            elif len(bets) == 1: sit = f'vsopen:{player}:{bets[0]}'
            elif len(bets) == 2 and bets[0] == player: sit = f'vs3bet:{player}:{bets[1]}'
        if sit and sit not in table:
            t = table[sit] = {}
            for c in range(169):
                row = {'raise': 0.0, 'call': 0.0}
                for k, act in enumerate(n['a']):
                    f = n['s'][k * 169 + c] / 1000
                    if act.startswith('R') or act == 'A': row['raise'] += f
                    elif act == 'C': row['call'] += f
                t[class_name(c)] = row
        if len(bets) >= 3: return
        for act, child in zip(n['a'], n['ch']):
            kind = 'R' if act.startswith('R') or act == 'A' else act
            visit(child, history + [(player, kind)])
    visit(0, [])
    json.dump(table, open(out, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
    print(len(table), 'ситуаций')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
