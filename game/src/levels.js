// levels.js — the three floors of the Meridian Bank, their maps, patrols,
// cameras and loot. A map is 16 rows of 24 characters:
//
//   # wall            D desk (solid cover, blocks sight)
//   P planter (solid cover)   . open floor
//   S your spawn      E the back door / getaway van
//   L vault gold (the main loot)   c a cash stack (small loot)
//   T a tool pickup   K a keycard terminal (hold E beside it to hack)
//   X a locked keycard door (opens once its terminal is hacked)
//   Z a laser grid tile (live on a timer; crossing it live fills the meter)
//
// Guards and cameras are defined per level below the maps. Every route and
// camera mount is checked by the node smoke test (row lengths, walkable
// route tiles, reachability from spawn to loot to exit).

export const LEVELS = [
  {
    name: 'Floor 1 — The Lobby',
    briefing: 'Cross the lobby, lift the vault gold, reach the van.',
    vanTime: 75,
    map: [
      '########################',
      '#S....D......P......c..#',
      '#.....D................#',
      '#.....D......D.........#',
      '#..........D...........#',
      '#..D.....D......D......#',
      '#..D...........D...T...#',
      '#.......####...........#',
      '#.......#LL#......D....#',
      '#.......#..#......D....#',
      '#..P........D..........#',
      '#.....D............D...#',
      '#..c..D......P.........#',
      '#......................#',
      '#..D......D.......D..E.#',
      '########################',
    ],
    guards: [
      { name: 'Rook', route: [[5, 3], [18, 3], [18, 11], [5, 11]] },
      { name: 'Bishop', route: [[13, 5], [13, 11], [10, 11], [10, 5]] },
    ],
    cameras: [
      { tx: 11, ty: 0, angle: Math.PI / 2 },
      { tx: 21, ty: 0, angle: Math.PI / 2 },
    ],
  },
  {
    name: 'Floor 2 — The Vault Hall',
    briefing: 'Hack the terminal, slip the laser grid, empty the vault.',
    vanTime: 60,
    map: [
      '########################',
      '#S.....D.......P....c..#',
      '#......D...............#',
      '#..c...D....ZZZ....D...#',
      '#..........ZZZ.........#',
      '#...D...##########.....#',
      '#...D...#........#.....#',
      '#.......#.LL...T.#..D..#',
      '#..P....#.LL.....#..D..#',
      '#.......#...ZZ...#.....#',
      '#...D...#...ZZ...#..c..#',
      '#...D...#####X####.....#',
      '#..........D...........#',
      '#..D.....K....D....D...#',
      '#..D....T.......D...E..#',
      '########################',
    ],
    guards: [
      { name: 'Rook', route: [[4, 2], [19, 2], [18, 13], [4, 13]] },
      { name: 'Knight', route: [[8, 13], [8, 3], [16, 3], [16, 13]] },
      { name: 'Pawn', route: [[12, 7], [15, 7], [15, 9], [12, 9]] },
    ],
    cameras: [
      { tx: 5, ty: 0, angle: Math.PI / 2 },
      { tx: 18, ty: 0, angle: Math.PI / 2 },
      { tx: 23, ty: 7, angle: Math.PI },
    ],
  },
  {
    name: 'Floor 3 — The Strongroom',
    briefing: 'The gold is doubled, the patrols are doubled. Be quick.',
    vanTime: 50,
    map: [
      '########################',
      '#S....D......P......c..#',
      '#.....D....ZZZ.........#',
      '#.....D....ZZZ....D....#',
      '#..c......D........D...#',
      '#...D..###########.....#',
      '#...D..#....ZZ...#..T..#',
      '#......#.LL.ZZ...#..D..#',
      '#..P...#.LL......#..D..#',
      '#......#....ZZ...#.....#',
      '#...D..#....ZZ...#..c..#',
      '#...D..#####X#####.....#',
      '#......D......P........#',
      '#..D.....K....D....D...#',
      '#..D....T.......D...E..#',
      '########################',
    ],
    guards: [
      { name: 'Rook', route: [[4, 2], [19, 2], [18, 13], [4, 13]] },
      { name: 'Knight', route: [[7, 13], [7, 3], [16, 3], [16, 13]] },
      { name: 'Queen', route: [[12, 7], [15, 7], [15, 10], [12, 10]] },
      { name: 'King', route: [[2, 6], [2, 12], [6, 12], [6, 6]] },
    ],
    cameras: [
      { tx: 5, ty: 0, angle: Math.PI / 2 },
      { tx: 12, ty: 0, angle: Math.PI / 2 },
      { tx: 19, ty: 0, angle: Math.PI / 2 },
      { tx: 23, ty: 7, angle: Math.PI },
    ],
  },
];

// Tiles a body can never stand on (doors X are solid until hacked, and are
// listed separately so the smoke test can treat them as open).
export const SOLID = new Set(['#', 'D', 'P', 'K']);
export const DOOR = 'X';
export const LASER = 'Z';
export const KNOWN_TILES = new Set(['#', '.', 'D', 'P', 'S', 'E', 'L', 'c', 'T', 'K', 'X', 'Z']);

export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  const find = (ch) => {
    const out = [];
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] === ch) out.push([x, y]);
      }
    }
    return out;
  };
  return {
    def,
    grid,
    spawn: find('S')[0],
    exit: find('E')[0],
    mainLoot: find('L'),
    cash: find('c'),
    tools: find('T'),
    terminals: find('K'),
    doors: find('X'),
    lasers: find('Z'),
  };
}

export function tileAt(grid, x, y) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return '#';
  return grid[y][x];
}

// A tile is walkable when it is not a solid object and not a locked door.
export function walkable(grid, x, y, openDoors) {
  const t = tileAt(grid, x, y);
  if (SOLID.has(t)) return false;
  if (t === DOOR && !openDoors.has(x + ',' + y)) return false;
  return true;
}

// Breadth-first pathfinding over tiles; doors are treated as open when
// openDoors names them, so the self-test driver can route through a door it
// plans to hack. Returns a list of [x, y] tiles from start to goal.
export function findPath(grid, sx, sy, tx, ty, openDoors = new Set()) {
  if (sx === tx && sy === ty) return [[sx, sy]];
  const key = (x, y) => x + ',' + y;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(grid, nx, ny, openDoors) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      if (nx === tx && ny === ty) {
        const path = [[tx, ty]];
        let cur = [nx, ny];
        while (prev.get(key(cur[0], cur[1]))) {
          cur = prev.get(key(cur[0], cur[1]));
          path.unshift(cur);
        }
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}
