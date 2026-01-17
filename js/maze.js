/**
 * ============================================================================
 * EXIT VECTOR - MAZE MODULE
 * ============================================================================
 * Traditional labyrinth-style maze generation with proper corridors.
 * Uses recursive backtracking algorithm for authentic maze paths.
 * 
 * Features:
 * - Recursive backtracking maze generation
 * - Proper corridors and dead ends
 * - Exit zones with varying scores at bottom
 * - Difficulty scaling per level
 * 
 * @module maze
 * ============================================================================
 */

/**
 * Cell types in the maze grid
 * @constant {Object}
 */
const CELL_TYPES = {
    WALL: 0,
    PATH: 1,
    ENTRY: 2,
    EXIT: 3
};

/**
 * Direction vectors for maze generation
 * @constant {Object[]}
 */
const DIRECTIONS = [
    { dx: 0, dy: -1, name: 'up' },     // Up
    { dx: 1, dy: 0, name: 'right' },   // Right
    { dx: 0, dy: 1, name: 'down' },    // Down
    { dx: -1, dy: 0, name: 'left' }    // Left
];

/**
 * Seeded random number generator
 * Provides reproducible randomness for maze generation
 */
class SeededRandom {
    /**
     * Create a seeded RNG
     * @param {number} seed - Initial seed value
     */
    constructor(seed = Date.now()) {
        this.seed = seed;
    }

    /**
     * Get next random number (0-1)
     * @returns {number} Random number between 0 and 1
     */
    next() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    /**
     * Get random integer in range [min, max)
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (exclusive)
     * @returns {number} Random integer
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }

    /**
     * Shuffle array in place (Fisher-Yates)
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

/**
 * MazeGenerator class
 * Generates traditional labyrinth-style mazes using recursive backtracking
 */
class MazeGenerator {
    /**
     * Create a new MazeGenerator
     */
    constructor() {
        /** @type {number[][]} 2D grid of cell types */
        this.grid = [];

        /** @type {number} Number of columns (cells) */
        this.cols = 15;

        /** @type {number} Number of rows (cells) */
        this.rows = 15;

        /** @type {number} Cell size in pixels */
        this.cellSize = 30;

        /** @type {number} Wall thickness in pixels */
        this.wallThickness = 4;

        /** @type {number} Current level */
        this.level = 1;

        /** @type {SeededRandom} Random number generator */
        this.rng = new SeededRandom();

        /** @type {Object[]} Exit zone definitions */
        this.exitZones = [];

        /** @type {Object[]} Wall rectangles for collision */
        this.wallRects = [];

        /** @type {number} Entry X position in pixels */
        this.entryX = 0;

        /** @type {number} Entry Y position in pixels */
        this.entryY = 0;

        /** @type {number} Maze width in pixels */
        this.width = 0;

        /** @type {number} Maze height in pixels */
        this.height = 0;

        /** @type {number[]} Exit column positions */
        this.exitColumns = [];
    }

    /**
     * Initialize maze for a specific level
     * @param {number} level - Level number (1-10)
     * @param {number} canvasWidth - Canvas width for scaling
     * @param {number} canvasHeight - Canvas height for scaling
     */
    init(level, canvasWidth, canvasHeight) {
        this.level = level;

        // Detect orientation
        const isLandscape = canvasWidth > canvasHeight;

        // Calculate margins based on orientation
        const exitZoneHeight = EXIT_CONFIG.zoneHeight;
        let marginLeft, marginRight, marginTop, marginBottom;

        if (isLandscape) {
            // Landscape: HUD on left side
            marginLeft = 120;  // Space for HUD on left
            marginRight = 20;
            marginTop = 20;
            marginBottom = 100; // Space for buttons at bottom
        } else {
            // Portrait: HUD on top
            marginLeft = 20;
            marginRight = 20;
            marginTop = 100;   // Space for HUD at top
            marginBottom = 100; // Space for buttons at bottom
        }

        // Calculate available space
        const availableWidth = canvasWidth - marginLeft - marginRight;
        const availableHeight = canvasHeight - marginTop - marginBottom - exitZoneHeight;

        // Scale maze complexity based on level, but cap it
        let targetCols = Math.min(21, 11 + Math.floor(level / 3) * 2); // Cap at 21 cols
        let targetRows = Math.min(25, 13 + Math.floor(level / 4) * 2); // Cap at 25 rows

        // Ensure odd dimensions for maze algorithm
        if (targetCols % 2 === 0) targetCols++;
        if (targetRows % 2 === 0) targetRows++;

        // Calculate cell size that would fit target dimensions
        const minCellSize = 16; // Minimum for playability
        let cellSize = Math.floor(Math.min(
            availableWidth / targetCols,
            availableHeight / targetRows
        ));

        // If cell size is too small, reduce grid size to fit
        if (cellSize < minCellSize) {
            cellSize = minCellSize;
            // Reduce cols/rows to fit within available space
            targetCols = Math.floor(availableWidth / cellSize);
            targetRows = Math.floor(availableHeight / cellSize);
            // Ensure odd and minimum
            if (targetCols % 2 === 0) targetCols--;
            if (targetRows % 2 === 0) targetRows--;
            targetCols = Math.max(9, targetCols);
            targetRows = Math.max(9, targetRows);
        }

        this.cols = targetCols;
        this.rows = targetRows;
        this.cellSize = cellSize;

        // Calculate maze dimensions (MUST fit within available space)
        this.width = this.cols * this.cellSize;
        this.height = this.rows * this.cellSize;

        // Store margins for renderer to use
        this.marginLeft = marginLeft;
        this.marginTop = marginTop;

        // Generate maze
        this.rng = new SeededRandom(Date.now());
        this._generateMaze();
        this._createEntryAndExits();
        this._buildExitZones();
        this._buildWallRects();

        // Set entry position (center top of maze)
        this.entryX = this.width / 2;
        this.entryY = this.cellSize * 1.5;
    }

    /**
     * Generate maze using recursive backtracking
     * @private
     */
    _generateMaze() {
        // Initialize grid with all walls
        this.grid = [];
        for (let y = 0; y < this.rows; y++) {
            const row = [];
            for (let x = 0; x < this.cols; x++) {
                row.push(CELL_TYPES.WALL);
            }
            this.grid.push(row);
        }

        // Start carving from top-center (must be odd position)
        const startX = Math.floor(this.cols / 2);
        const startY = 1;

        // Make start position odd if needed
        const actualStartX = startX % 2 === 0 ? startX + 1 : startX;

        // Recursive backtracking
        this._carve(actualStartX, startY);
    }

    /**
     * Carve paths recursively using backtracking
     * @param {number} x - Current X position
     * @param {number} y - Current Y position
     * @private
     */
    _carve(x, y) {
        // Mark current cell as path
        this.grid[y][x] = CELL_TYPES.PATH;

        // Shuffle directions for randomness
        const directions = this.rng.shuffle([...DIRECTIONS]);

        for (const dir of directions) {
            // Calculate new position (2 cells away for proper maze)
            const nx = x + dir.dx * 2;
            const ny = y + dir.dy * 2;

            // Check bounds and if cell is unvisited (still a wall)
            if (nx > 0 && nx < this.cols - 1 &&
                ny > 0 && ny < this.rows - 1 &&
                this.grid[ny][nx] === CELL_TYPES.WALL) {

                // Carve through the wall between cells
                this.grid[y + dir.dy][x + dir.dx] = CELL_TYPES.PATH;

                // Recursively carve from new position
                this._carve(nx, ny);
            }
        }
    }

    /**
     * Create entry at top and exits at bottom
     * @private
     */
    _createEntryAndExits() {
        // Create entry at top center
        const centerX = Math.floor(this.cols / 2);
        this.grid[0][centerX] = CELL_TYPES.ENTRY;
        this.grid[1][centerX] = CELL_TYPES.PATH;

        // Find path cells in the second-to-last row to create exits
        this.exitColumns = [];

        // Create 5 exit openings at bottom
        const exitPositions = [0.1, 0.3, 0.5, 0.7, 0.9];

        for (const pos of exitPositions) {
            let targetCol = Math.floor(pos * this.cols);

            // Find nearest path cell
            let bestCol = targetCol;
            let minDist = Infinity;

            for (let x = 1; x < this.cols - 1; x++) {
                if (this.grid[this.rows - 2][x] === CELL_TYPES.PATH) {
                    const dist = Math.abs(x - targetCol);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCol = x;
                    }
                }
            }

            // Create exit path
            this.grid[this.rows - 1][bestCol] = CELL_TYPES.EXIT;
            this.exitColumns.push(bestCol);
        }

        // Ensure paths connect to exits
        for (const col of this.exitColumns) {
            // Carve down to the exit
            if (this.grid[this.rows - 2][col] === CELL_TYPES.WALL) {
                // Find nearest path above and connect
                for (let y = this.rows - 2; y >= 0; y--) {
                    if (this.grid[y][col] === CELL_TYPES.PATH) break;
                    this.grid[y][col] = CELL_TYPES.PATH;
                }
            }
        }
    }

    /**
     * Build exit zones at bottom of maze
     * @private
     */
    _buildExitZones() {
        this.exitZones = [];

        // Exit scores matching reference: 500, 100, 1000, 0, 250
        const exitScores = [
            { score: 500, color: '#4ade80', label: '500' },
            { score: 100, color: '#60a5fa', label: '100' },
            { score: 1000, color: '#facc15', label: '1000' },
            { score: 0, color: '#94a3b8', label: '0' },
            { score: 250, color: '#f472b6', label: '250' }
        ];

        // Create zones based on exit columns
        const zoneWidth = this.width / 5;

        for (let i = 0; i < 5; i++) {
            const zoneX = i * zoneWidth;

            this.exitZones.push({
                x: zoneX,
                y: this.height,
                width: zoneWidth,
                height: EXIT_CONFIG.zoneHeight,
                score: exitScores[i].score,
                color: exitScores[i].color,
                label: exitScores[i].label,
                column: this.exitColumns[i] || Math.floor((i + 0.5) * this.cols / 5)
            });
        }
    }

    /**
     * Build wall rectangles for collision detection
     * @private
     */
    _buildWallRects() {
        this.wallRects = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === CELL_TYPES.WALL) {
                    this.wallRects.push({
                        x: x * this.cellSize,
                        y: y * this.cellSize,
                        width: this.cellSize,
                        height: this.cellSize,
                        isWall: true
                    });
                }
            }
        }
    }

    /**
     * Get spawn positions for balls at the entry
     * @param {number} ballCount - Number of balls to spawn
     * @returns {Object[]} Array of spawn positions
     */
    getSpawnPositions(ballCount) {
        const positions = [];
        const spacing = PHYSICS_CONFIG.ballRadius * 2.2;

        // Find entry column
        const entryCol = Math.floor(this.cols / 2);
        const entryPixelX = (entryCol + 0.5) * this.cellSize;
        const entryPixelY = this.cellSize * 1.5;

        for (let i = 0; i < ballCount; i++) {
            const offset = (i - (ballCount - 1) / 2) * spacing;
            positions.push({
                x: entryPixelX + offset * 0.3, // Tighter grouping
                y: entryPixelY + i * (PHYSICS_CONFIG.ballRadius * 0.5)
            });
        }

        return positions;
    }

    /**
     * Get exit zone for X position
     * @param {number} x - X position in pixels
     * @returns {Object|null} Exit zone or null
     */
    getExitZoneForX(x) {
        for (const zone of this.exitZones) {
            if (x >= zone.x && x <= zone.x + zone.width) {
                return zone;
            }
        }
        return null;
    }

    /**
     * Get wall rectangles for collision
     * @returns {Object[]} Wall rectangles
     */
    getWallRects() {
        return this.wallRects;
    }

    /**
     * Get exit zones
     * @returns {Object[]} Exit zones
     */
    getExitZones() {
        return this.exitZones;
    }

    /**
     * Get maze dimensions
     * @returns {Object} Width, height, cell size, and ball radius
     */
    getDimensions() {
        // Ball radius should be about 35% of cell size to fit through corridors
        const ballRadius = Math.max(5, Math.floor(this.cellSize * 0.35));

        return {
            width: this.width,
            height: this.height,
            cellSize: this.cellSize,
            cols: this.cols,
            rows: this.rows,
            ballRadius: ballRadius,
            marginLeft: this.marginLeft || 20,
            marginTop: this.marginTop || 20
        };
    }

    /**
     * Get grid for rendering
     * @returns {number[][]} 2D grid
     */
    getGrid() {
        return this.grid;
    }

    /**
     * Check if position is inside a wall
     * @param {number} x - X position in pixels
     * @param {number} y - Y position in pixels
     * @returns {boolean} Whether position is in a wall
     */
    isWall(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);

        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return true; // Outside bounds is wall
        }

        return this.grid[row][col] === CELL_TYPES.WALL;
    }
}

// Create singleton instance
const mazeGenerator = new MazeGenerator();

// Export for use in other modules
window.MazeGenerator = mazeGenerator;
window.CELL_TYPES = CELL_TYPES;
