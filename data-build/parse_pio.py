"""Разбор дерева PioRanges (6-max, 100 ББ) в таблицу ситуаций.
Путь к файлу = история действий: 'LJ2bets' — LJ поставил 2-ю ставку (открыл),
'HJ3bets' — 3-бет, 'COfolds' — сбросил, 'BBcalls' — уравнял. Файл 'B_call.txt' — частота
колла каждой руки в этой точке, 'B_raise.txt' — частота повышения.
Выход: JSON {ситуация: {рука: {raise: p, call: p}}}, ситуации только «первые»:
open:<поз>, vsopen:<герой>:<открывший>, vs3bet:<открывший>:<3-бетор>."""
import json, os, re, sys

POS = {'LJ': 'LJ', 'HJ': 'HJ', 'CO': 'CO', 'B': 'BTN', 'BTN': 'BTN', 'SB': 'SB', 'BB': 'BB'}

def read_range(path):
    out = {}
    for part in open(path).read().replace('\n', ',').split(','):
        part = part.strip()
        if ':' in part:
            hand, freq = part.split(':')
            out[hand.strip()] = float(freq)
    return out

def parse_step(step):
    m = re.fullmatch(r'(LJ|HJ|CO|BB|SB|B)(\d)bets', step)
    if m: return POS[m.group(1)], f'{m.group(2)}bet'
    m = re.fullmatch(r'(LJ|HJ|CO|BB|SB|B)(folds|calls)', step)
    if m: return POS[m.group(1)], m.group(2)[:-1]
    return None

def situation(history, player):
    bets = [(p, a) for p, a in history if a.endswith('bet')]
    calls = [p for p, a in history if a == 'call']
    if calls: return None  # только банки без колдколлов до героя
    if not bets: return f'open:{player}'
    if len(bets) == 1: return f'vsopen:{player}:{bets[0][0]}'
    if len(bets) == 2 and bets[0][0] == player: return f'vs3bet:{player}:{bets[1][0]}'
    return None

def main(root, out):
    table = {}
    for dirpath, _, files in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        steps = [] if rel == '.' else rel.split(os.sep)
        history = [parse_step(s) for s in steps]
        if any(h is None for h in history): continue
        for f in files:
            m = re.fullmatch(r'(LJ|HJ|CO|BB|SB|B)_(raise|call)\.txt', f)
            if not m: continue
            player, act = POS[m.group(1)], m.group(2)
            sit = situation(history, player)
            if not sit: continue
            for hand, freq in read_range(os.path.join(dirpath, f)).items():
                table.setdefault(sit, {}).setdefault(hand, {'raise': 0.0, 'call': 0.0})[act] = freq
    json.dump(table, open(out, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
    print(len(table), 'ситуаций:', ', '.join(sorted(table)))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
