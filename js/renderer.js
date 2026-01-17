/**
 * ============================================================================
 * EXIT VECTOR - RENDERER MODULE
 * ============================================================================
 * Canvas-based rendering for traditional labyrinth-style maze.
 * Clean aesthetic with light background and dark walls.
 * 
 * Features:
 * - Traditional maze rendering (path-based, not grid)
 * - Multi-ball rendering with shadows
 * - Exit zone visualization with scores
 * - Clean, minimal visual style
 * 
 * @module renderer
 * ============================================================================
 */

/**
 * Renderer class
 * Handles all canvas drawing operations
 */
class Renderer {
    /**
     * Create a new Renderer
     */
    constructor() {
        /** @type {HTMLCanvasElement} Canvas element */
        this.canvas = null;

        /** @type {CanvasRenderingContext2D} 2D context */
        this.ctx = null;

        /** @type {number} Canvas width */
        this.width = 0;

        /** @type {number} Canvas height */
        this.height = 0;

        /** @type {number} Maze offset X (for centering) */
        this.offsetX = 0;

        /** @type {number} Maze offset Y */
        this.offsetY = 0;

        /** @type {Object} Maze dimensions */
        this.mazeDimensions = null;

        /** @type {number} Current frame for animations */
        this.frame = 0;

        /** @type {boolean} Whether to show debug info */
        this.showDebug = false;

        // Visual settings matching reference image
        this.colors = {
            background: '#f5f5f0',     // Light cream/beige
            wall: '#1a1a1a',           // Dark black walls
            path: '#f5f5f0',           // Same as background
            ball: '#e74c3c',           // Red ball
            ballShadow: 'rgba(0,0,0,0.3)',
            border: '#333333'
        };
    }

    /**
     * Initialize renderer with canvas element
     * @param {string} canvasId - Canvas element ID
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }

        this.ctx = this.canvas.getContext('2d');

        // Set up canvas sizing
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this._resizeCanvas(), 100);
        });
    }

    /**
     * Resize canvas to fit container
     * @private
     */
    _resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Account for device pixel ratio
        const dpr = window.devicePixelRatio || 1;

        // Set display size
        this.width = rect.width;
        this.height = rect.height;

        // Set canvas buffer size
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;

        // Set display size  
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // Scale context
        this.ctx.scale(dpr, dpr);

        // Recalculate offsets if maze dimensions are set
        if (this.mazeDimensions) {
            this._calculateOffsets();
        }
    }

    /**
     * Set maze dimensions for centering
     * @param {Object} dimensions - Maze dimensions
     */
    setMazeDimensions(dimensions) {
        this.mazeDimensions = dimensions;
        this._calculateOffsets();
    }

    /**
     * Calculate offsets to center maze
     * @private
     */
    _calculateOffsets() {
        if (!this.mazeDimensions) return;

        // Get margins from maze (already calculated based on orientation)
        const marginLeft = this.mazeDimensions.marginLeft || 20;
        const marginTop = this.mazeDimensions.marginTop || 20;

        // Total maze height including exit zones
        const totalHeight = this.mazeDimensions.height + EXIT_CONFIG.zoneHeight;

        // Detect orientation
        const isLandscape = this.width > this.height;

        if (isLandscape) {
            // Landscape: HUD on left, center maze in remaining space
            const availableWidth = this.width - marginLeft;
            this.offsetX = marginLeft + (availableWidth - this.mazeDimensions.width) / 2;
            this.offsetY = (this.height - totalHeight) / 2;
        } else {
            // Portrait: HUD on top, center maze below
            const availableHeight = this.height - marginTop;
            this.offsetX = (this.width - this.mazeDimensions.width) / 2;
            this.offsetY = marginTop + (availableHeight - totalHeight) / 2;
        }

        // Ensure offsets keep maze on screen
        this.offsetX = Math.max(isLandscape ? marginLeft : 10, this.offsetX);
        this.offsetY = Math.max(isLandscape ? 10 : marginTop, this.offsetY);
    }

    /**
     * Clear the canvas with background color
     */
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.frame++;
    }

    /**
     * Render the complete game frame
     * @param {Object} gameState - Current game state
     */
    render(gameState) {
        this.clear();

        const { maze, balls, exitZones } = gameState;

        if (!maze || !this.mazeDimensions) return;

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);

        // Draw maze background (path areas)
        this._drawMazeBackground();

        // Draw walls
        this._drawWalls(maze.getGrid(), maze.getDimensions());

        // Draw maze border
        this._drawMazeBorder();

        // Draw exit zones
        this._drawExitZones(exitZones);

        // Draw balls
        this._drawBalls(balls);

        this.ctx.restore();
    }

    /**
     * Draw maze background
     * @private
     */
    _drawMazeBackground() {
        if (!this.mazeDimensions) return;

        const { width, height } = this.mazeDimensions;

        // Light background for maze area
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, width, height);
    }

    /**
     * Draw maze walls cell by cell
     * @param {number[][]} grid - Maze grid
     * @param {Object} dimensions - Maze dimensions
     * @private
     */
    _drawWalls(grid, dimensions) {
        if (!grid || !dimensions) return;

        const { cellSize, cols, rows } = dimensions;

        this.ctx.fillStyle = this.colors.wall;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (grid[y][x] === CELL_TYPES.WALL) {
                    this.ctx.fillRect(
                        x * cellSize,
                        y * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
    }

    /**
     * Draw border around the maze
     * @private
     */
    _drawMazeBorder() {
        if (!this.mazeDimensions) return;

        const { width, height } = this.mazeDimensions;

        this.ctx.strokeStyle = this.colors.wall;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(0, 0, width, height);
    }

    /**
     * Draw exit zones with scores
     * @param {Object[]} exitZones - Exit zone definitions
     * @private
     */
    _drawExitZones(exitZones) {
        if (!exitZones || !this.mazeDimensions) return;

        const { height } = this.mazeDimensions;

        for (const zone of exitZones) {
            const zoneY = height;

            // Zone background - light with border
            this.ctx.fillStyle = '#f5f0e6';
            this.ctx.fillRect(zone.x, zoneY, zone.width, zone.height);

            // Zone border
            this.ctx.strokeStyle = this.colors.wall;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(zone.x, zoneY, zone.width, zone.height);

            // Divider lines between zones
            this.ctx.beginPath();
            this.ctx.moveTo(zone.x, zoneY);
            this.ctx.lineTo(zone.x, zoneY + zone.height);
            this.ctx.stroke();

            // Score label
            this.ctx.fillStyle = '#8b0000'; // Dark red like reference
            this.ctx.font = 'bold 18px Rajdhani, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                zone.label,
                zone.x + zone.width / 2,
                zoneY + zone.height / 2
            );
        }

        // Draw vertical lines from maze to exit zones
        this.ctx.strokeStyle = this.colors.wall;
        this.ctx.lineWidth = 2;

        // Connection lines to exits
        for (const zone of exitZones) {
            const connectionX = zone.x + zone.width / 2;
            this.ctx.beginPath();
            this.ctx.moveTo(connectionX, height);
            this.ctx.lineTo(connectionX, height + 5);
            this.ctx.stroke();
        }
    }

    /**
     * Draw all balls
     * @param {Ball[]} balls - Array of balls
     * @private
     */
    _drawBalls(balls) {
        if (!balls) return;

        for (const ball of balls) {
            if (!ball.active && !ball.exited) continue;

            // Draw ball trail
            this._drawBallTrail(ball);

            // Draw ball shadow
            this.ctx.fillStyle = this.colors.ballShadow;
            this.ctx.beginPath();
            this.ctx.arc(ball.x + 2, ball.y + 2, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw ball with gradient
            const gradient = this.ctx.createRadialGradient(
                ball.x - ball.radius * 0.3,
                ball.y - ball.radius * 0.3,
                0,
                ball.x,
                ball.y,
                ball.radius
            );

            const color = ball.getColor();
            gradient.addColorStop(0, this._lightenColor(color, 30));
            gradient.addColorStop(0.6, color);
            gradient.addColorStop(1, this._darkenColor(color, 20));

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Ball outline
            this.ctx.strokeStyle = this._darkenColor(color, 30);
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Highlight
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.beginPath();
            this.ctx.arc(
                ball.x - ball.radius * 0.3,
                ball.y - ball.radius * 0.3,
                ball.radius * 0.25,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            // Score popup when exited
            if (ball.exited && ball.score > 0) {
                this.ctx.fillStyle = '#333';
                this.ctx.font = 'bold 14px Rajdhani, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`+${ball.score}`, ball.x, ball.y - ball.radius - 8);
            }
        }
    }

    /**
     * Draw ball trail
     * @param {Ball} ball - Ball with trail
     * @private
     */
    _drawBallTrail(ball) {
        if (!ball.trail || ball.trail.length < 2) return;

        const color = ball.getColor();

        for (let i = 1; i < ball.trail.length; i++) {
            const pos = ball.trail[i];
            const opacity = 0.4 * (1 - i / ball.trail.length);
            const radius = ball.radius * (1 - i / ball.trail.length * 0.6);

            this.ctx.fillStyle = color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Lighten a hex color
     * @param {string} color - Hex color
     * @param {number} percent - Percentage to lighten
     * @returns {string} RGB color string
     * @private
     */
    _lightenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R}, ${G}, ${B})`;
    }

    /**
     * Darken a hex color
     * @param {string} color - Hex color
     * @param {number} percent - Percentage to darken
     * @returns {string} RGB color string
     * @private
     */
    _darkenColor(color, percent) {
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `rgb(${R}, ${G}, ${B})`;
    }

    /**
     * Get canvas dimensions
     * @returns {Object} Width and height
     */
    getDimensions() {
        return { width: this.width, height: this.height };
    }

    /**
     * Toggle debug rendering
     */
    toggleDebug() {
        this.showDebug = !this.showDebug;
    }
}

// Create singleton instance
const renderer = new Renderer();

// Export for use in other modules
window.Renderer = renderer;
