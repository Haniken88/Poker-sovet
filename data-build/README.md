# Откуда префлоп-таблицы (src/preflopData.js)

Сводка трёх бесплатных солверных источников (6-max, 100 ББ). Сами файлы источников в репозиторий
не кладём: у части из них не указана лицензия на распространение. В приложении — только наша
усреднённая таблица.

| Источник | Что это | Особенности |
|---|---|---|
| github.com/bupticybee/TexasSolverGPU → ranges/qb_ranges/PioRanges_nlhe_100bb_3x_NL200 | вывод PioSolver, полное дерево | открытие 3 ББ, с рейком NL200; в ответе на 3-бет записано «открыть × ответить» |
| github.com/bupticybee/TexasSolverGPU → ranges/6max_range | линии розыгрыша TexasSolver | открытие 2,5 ББ; руки с 0 % не записаны |
| github.com/omeregepeksari/gto-solver → public/preflop/100bb.json | любительский солвер без рейка | уравнивать может только ББ (иначе 3-бет или пас) |

Сведение (consensus.py): для каждой ситуации и руки — сначала «играть или пас» (голосуют все),
потом «колл или рейз» (голосуют только источники, где колл разрешён). «Спорно» — если за
решение меньше двух третей. Обновить:

```
git clone --depth 1 https://github.com/bupticybee/TexasSolverGPU.git src-data/TexasSolverGPU
git clone --depth 1 https://github.com/omeregepeksari/gto-solver.git src-data/gto-solver
python3 parse_pio.py src-data/TexasSolverGPU/ranges/qb_ranges/PioRanges_nlhe_100bb_3x_NL200 pio.json
python3 parse_6max.py src-data/TexasSolverGPU/ranges/6max_range g6.json
python3 parse_gtosolver.py src-data/gto-solver/public/preflop/100bb.json gs.json
python3 consensus.py ../src/preflopData.js disagree.txt pio=pio.json ts6max=g6.json gtosolver=gs.json
```
