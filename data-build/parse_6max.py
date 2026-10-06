"""Разбор 6max_range (TexasSolverGPU): путь = линия розыгрыша, файл X_range.txt — с какой
частотой каждая рука игрока X доходит до этой точки. UTG здесь = LJ, MP = HJ (как в Pio).
Выход — та же таблица, что у parse_pio.py: {ситуация: {рука: {raise, call}}}."""
import json, os, re, sys

NAME = {'UTG': 'LJ', 'MP': 'HJ', 'CO': 'CO', 'BTN': 'BTN', 'SB': 'SB', 'BB': 'BB'}
ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']

def read_range(path):
    out = {}
    for part in open(path).read().replace('\n', ',').split(','):
        if ':' in part:
            h, f = part.split(':')
            out[h.strip()] = float(f)
    return out

def find(root, *parts):
    p = os.path.join(root, *parts)
    return read_range(p) if os.path.exists(p) else None

def subdirs(path):
    return sorted(d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))) if os.path.isdir(path) else []

def any_range(path, player):
    """Ближайший к началу файл player_range.txt: глубже игрок мог действовать снова,
    и там частота уже умножена на его следующие решения."""
    best = None
    for dirpath, _, files in os.walk(path):
        if f'{player}_range.txt' in files:
            depth = dirpath.count(os.sep)
            if best is None or depth < best[0]:
                best = (depth, os.path.join(dirpath, f'{player}_range.txt'))
    return read_range(best[1]) if best else None

def main(root, out):
    table = {}
    def put(sit, rng, act):
        if rng is None: return
        for h, f in rng.items():
            table.setdefault(sit, {}).setdefault(h, {'raise': 0.0, 'call': 0.0})[act] = round(min(1.0, f), 4)
    for opener in ORDER[:-1]:
        for size in subdirs(os.path.join(root, opener)):
            base = os.path.join(root, opener, size)
            open_rng = any_range(base, opener)
            put(f'open:{NAME[opener]}', open_rng, 'raise')
            for hero in subdirs(base):
                if hero not in ORDER: continue
                put(f'vsopen:{NAME[hero]}:{NAME[opener]}', find(base, hero, 'Call', f'{hero}_range.txt'), 'call')
                for size3 in subdirs(os.path.join(base, hero)):
                    if size3 == 'Call': continue
                    three = os.path.join(base, hero, size3)
                    put(f'vsopen:{NAME[hero]}:{NAME[opener]}', any_range(three, hero), 'raise')
                    # Ответ открывшего на 3-бет: делим на частоту открытия.
                    def cond(rng):
                        if rng is None or open_rng is None: return None
                        return {h: (f / open_rng[h] if open_rng.get(h, 0) > 0.001 else 0.0) for h, f in rng.items()}
                    put(f'vs3bet:{NAME[opener]}:{NAME[hero]}', cond(find(three, opener, 'Call', f'{opener}_range.txt')), 'call')
                    for size4 in subdirs(os.path.join(three, opener)):
                        if size4 in ('Call', 'Fold'): continue
                        put(f'vs3bet:{NAME[opener]}:{NAME[hero]}', cond(any_range(os.path.join(three, opener, size4), opener)), 'raise')
                        break
                    break
    json.dump(table, open(out, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
    print(len(table), 'ситуаций')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
