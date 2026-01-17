/**
 * ============================================================================
 * EXIT VECTOR - PHYSICS MODULE
 * ============================================================================
 * Multi-ball physics simulation with gravity, friction, and collision.
 * 
 * Features:
 * - Multiple simultaneous balls
 * - Shared gravity from IMU/controls
 * - Wall collision with bounce
 * - Exit zone detection and scoring
 * - Ball trails for visual effect
 * 
 * @module physics
 * ============================================================================
 */

/**
 * Ball class
 * Represents a single ball with position, velocity, and trail
 */
class Ball {
    /**
     * Create a new Ball
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {number} index - Ball index for color assignment
     * @param {number} radius - Ball radius
     */
    constructor(x = 0, y = 0, index = 0, radius = null) {
        /** @type {number} X position */
        this.x = x;

        /** @type {number} Y position */
        this.y = y;

        /** @type {number} X velocity */
        this.vx = 0;

        /** @type {number} Y velocity */
        this.vy = 0;

        /** @type {number} Ball radius */
        this.radius = radius || PHYSICS_CONFIG.ballRadius;

        /** @type {number} Ball index for color */
        this.index = index;

        /** @type {boolean} Whether ball is still active */
        this.active = true;

        /** @type {boolean} Whether ball has exited */
        this.exited = false;

        /** @type {number} Score earned by this ball */
        this.score = 0;

        /** @type {Object[]} Trail positions */
        this.trail = [];
    }

    /**
     * Reset ball to new position
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
        this.exited = false;
        this.score = 0;
        this.trail = [];
    }

    /**
     * Get current speed
     * @returns {number} Speed magnitude
     */
    getSpeed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    /**
     * Update trail with current position
     */
    updateTrail() {
        this.trail.unshift({ x: this.x, y: this.y });

        // Limit trail length
        while (this.trail.length > VISUAL_CONFIG.trailLength) {
            this.trail.pop();
        }
    }

    /**
     * Get color for this ball
     * @returns {string} CSS color
     */
    getColor() {
        return VISUAL_CONFIG.ballColors[this.index % VISUAL_CONFIG.ballColors.length];
    }
}

/**
 * PhysicsEngine class
 * Manages multiple balls and physics simulation
 */
class PhysicsEngine {
    /**
     * Create a new PhysicsEngine
     */
    constructor() {
        /** @type {Ball[]} Array of balls */
        this.balls = [];

        /** @type {Object} Current gravity vector */
        this.gravity = { x: 0, y: 0 };

        /** @type {boolean} Whether physics is paused */
        this.paused = false;

        /** @type {number} Total score for current level */
        this.score = 0;

        /** @type {Object[]} Wall rectangles for collision */
        this.walls = [];

        /** @type {Object[]} Exit zones */
        this.exitZones = [];

        /** @type {number} Maze width */
        this.mazeWidth = 0;

        /** @type {number} Maze height */
        this.mazeHeight = 0;

        /** @type {Function} Callback for ball exit */
        this.onBallExit = null;

        /** @type {Function} Callback for wall hit */
        this.onWallHit = null;
    }

    /**
     * Initialize physics for a new level
     * @param {Object[]} spawnPositions - Ball spawn positions
     * @param {Object[]} walls - Wall rectangles
     * @param {Object[]} exitZones - Exit zones
     * @param {number} mazeWidth - Maze width
     * @param {number} mazeHeight - Maze height
     * @param {number} ballRadius - Ball radius for this level
     */
    init(spawnPositions, walls, exitZones, mazeWidth, mazeHeight, ballRadius = null) {
        this.balls = [];
        this.score = 0;
        this.walls = walls;
        this.exitZones = exitZones;
        this.mazeWidth = mazeWidth;
        this.mazeHeight = mazeHeight;
        this.ballRadius = ballRadius || PHYSICS_CONFIG.ballRadius;

        // Create balls at spawn positions
        spawnPositions.forEach((pos, index) => {
            this.balls.push(new Ball(pos.x, pos.y, index, this.ballRadius));
        });
    }

    /**
     * Set gravity from controls
     * @param {Object} gravity - Gravity vector { x, y }
     */
    setGravity(gravity) {
        this.gravity.x = gravity.x;
        this.gravity.y = gravity.y;
    }

    /**
     * Update physics simulation for one frame
     */
    update() {
        if (this.paused) return;

        // Constant downward gravity - the ball naturally falls
        const baseGravityY = 0.12;

        for (const ball of this.balls) {
            if (!ball.active) continue;

            // Store previous position
            const prevX = ball.x;
            const prevY = ball.y;

            // Apply base gravity (constant downward pull)
            ball.vy += baseGravityY;

            // Apply player controls (tilt/keyboard) on top of gravity
            // Pressing up works AGAINST gravity, down accelerates with gravity
            ball.vx += this.gravity.x * PHYSICS_CONFIG.gravityMultiplier;
            ball.vy += this.gravity.y * PHYSICS_CONFIG.gravityMultiplier;

            // Apply friction
            ball.vx *= PHYSICS_CONFIG.friction;
            ball.vy *= PHYSICS_CONFIG.friction;

            // Clamp velocity
            const speed = ball.getSpeed();
            if (speed > PHYSICS_CONFIG.maxVelocity) {
                const scale = PHYSICS_CONFIG.maxVelocity / speed;
                ball.vx *= scale;
                ball.vy *= scale;
            }

            // Apply velocity threshold
            if (Math.abs(ball.vx) < PHYSICS_CONFIG.velocityThreshold) ball.vx = 0;
            if (Math.abs(ball.vy) < PHYSICS_CONFIG.velocityThreshold) ball.vy = 0;

            // Update position
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Handle wall collisions
            this._handleWallCollisions(ball, prevX, prevY);

            // Handle boundary collisions
            this._handleBoundaries(ball);

            // Check exit zones
            this._checkExitZones(ball);

            // Update trail
            ball.updateTrail();
        }
    }

    /**
     * Handle collisions with walls
     * @param {Ball} ball - Ball to check
     * @param {number} prevX - Previous X position
     * @param {number} prevY - Previous Y position
     * @private
     */
    _handleWallCollisions(ball, prevX, prevY) {
        for (const wall of this.walls) {
            // Check if ball intersects wall
            const closestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.width));
            const closestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.height));

            const distX = ball.x - closestX;
            const distY = ball.y - closestY;
            const distance = Math.sqrt(distX * distX + distY * distY);

            if (distance < ball.radius) {
                // Collision detected
                const overlap = ball.radius - distance;

                if (distance > 0) {
                    // Push ball out of wall
                    const nx = distX / distance;
                    const ny = distY / distance;

                    ball.x += nx * overlap;
                    ball.y += ny * overlap;

                    // Reflect velocity
                    const dot = ball.vx * nx + ball.vy * ny;
                    ball.vx -= 2 * dot * nx * (1 - PHYSICS_CONFIG.bounceFactor);
                    ball.vy -= 2 * dot * ny * (1 - PHYSICS_CONFIG.bounceFactor);
                } else {
                    // Ball center is inside wall, push out based on entry direction
                    ball.x = prevX;
                    ball.y = prevY;
                    ball.vx *= -PHYSICS_CONFIG.bounceFactor;
                    ball.vy *= -PHYSICS_CONFIG.bounceFactor;
                }

                // Trigger wall hit callback
                if (this.onWallHit) {
                    const intensity = Math.min(ball.getSpeed() / 10, 1);
                    this.onWallHit(intensity);
                }
            }
        }
    }

    /**
     * Handle maze boundary collisions
     * @param {Ball} ball - Ball to check
     * @private
     */
    _handleBoundaries(ball) {
        // Left boundary
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = Math.abs(ball.vx) * PHYSICS_CONFIG.bounceFactor;
        }

        // Right boundary
        if (ball.x + ball.radius > this.mazeWidth) {
            ball.x = this.mazeWidth - ball.radius;
            ball.vx = -Math.abs(ball.vx) * PHYSICS_CONFIG.bounceFactor;
        }

        // Top boundary
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = Math.abs(ball.vy) * PHYSICS_CONFIG.bounceFactor;
        }
    }

    /**
     * Check if ball has entered an exit zone
     * @param {Ball} ball - Ball to check
     * @private
     */
    _checkExitZones(ball) {
        if (ball.exited) return;

        // Check if ball has passed maze bottom
        if (ball.y > this.mazeHeight) {
            ball.exited = true;

            // Find which exit zone ball is in
            let exitZone = null;
            for (const zone of this.exitZones) {
                if (ball.x >= zone.x && ball.x <= zone.x + zone.width) {
                    exitZone = zone;
                    break;
                }
            }

            if (exitZone) {
                ball.score = exitZone.score;
                this.score += exitZone.score;
            } else {
                // Missed all exit zones, minimum score
                ball.score = 50;
                this.score += 50;
            }

            // Deactivate ball after delay for visual
            setTimeout(() => {
                ball.active = false;
                if (this.onBallExit) {
                    this.onBallExit(ball);
                }
            }, 300);
        }
    }

    /**
     * Check if all balls have exited
     * @returns {boolean} Whether all balls are inactive
     */
    allBallsExited() {
        return this.balls.every(ball => !ball.active);
    }

    /**
     * Get active ball count
     * @returns {number} Number of active balls
     */
    getActiveBallCount() {
        return this.balls.filter(ball => ball.active).length;
    }

    /**
     * Get all balls
     * @returns {Ball[]} Array of balls
     */
    getBalls() {
        return this.balls;
    }

    /**
     * Get current score
     * @returns {number} Total score
     */
    getScore() {
        return this.score;
    }

    /**
     * Pause physics
     * @param {boolean} paused - Whether to pause
     */
    setPaused(paused) {
        this.paused = paused;
    }

    /**
     * Check if physics is paused
     * @returns {boolean} Whether paused
     */
    isPaused() {
        return this.paused;
    }

    /**
     * Set ball exit callback
     * @param {Function} callback - Callback function
     */
    setOnBallExit(callback) {
        this.onBallExit = callback;
    }

    /**
     * Set wall hit callback
     * @param {Function} callback - Callback function
     */
    setOnWallHit(callback) {
        this.onWallHit = callback;
    }

    /**
     * Get debug information
     * @returns {Object} Debug data
     */
    getDebugInfo() {
        const activeBalls = this.balls.filter(b => b.active);
        return {
            totalBalls: this.balls.length,
            activeBalls: activeBalls.length,
            score: this.score,
            paused: this.paused,
            gravity: `${this.gravity.x.toFixed(2)}, ${this.gravity.y.toFixed(2)}`
        };
    }

    /**
     * Reset physics engine
     */
    reset() {
        this.balls = [];
        this.score = 0;
        this.paused = false;
        this.walls = [];
        this.exitZones = [];
    }
}

// Create singleton instance
const physicsEngine = new PhysicsEngine();

// Export for use in other modules
window.PhysicsEngine = physicsEngine;
window.Ball = Ball;
