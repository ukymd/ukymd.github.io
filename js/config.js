/**
 * ============================================================================
 * EXIT VECTOR - CONFIGURATION MODULE
 * ============================================================================
 * Game configuration constants, level settings, and physics parameters.
 * All tunable values are centralized here for easy adjustment.
 * 
 * @module config
 * ============================================================================
 */

/**
 * Physics configuration
 * Controls ball movement, gravity, and collision behavior
 * @constant {Object}
 */
const PHYSICS_CONFIG = {
    /** Gravity multiplier applied to IMU input */
    gravityMultiplier: 0.8,

    /** Friction applied each frame (velocity *= friction) */
    friction: 0.97,

    /** Ball radius in pixels */
    ballRadius: 10,

    /** Maximum velocity to prevent tunneling */
    maxVelocity: 12,

    /** Bounce factor when hitting walls (0-1) */
    bounceFactor: 0.3,

    /** Minimum velocity threshold to stop jittering */
    velocityThreshold: 0.01
};

/**
 * Level configuration
 * Defines ball counts, target scores, and difficulty scaling
 * @constant {Object}
 */
const LEVEL_CONFIG = {
    /** Maximum level number (Infinity for endless mode) */
    maxLevel: Infinity,

    /** Ball count by level range */
    ballCounts: {
        low: 1,      // All levels use 1 ball
        high: 1
    },

    /** Level at which ball count increases */
    ballCountThreshold: 5,

    /** Target score (constant for all levels) */
    targetScore: 1000,

    /** Base maze height in rows */
    baseMazeHeight: 10,

    /** Additional rows per level */
    heightPerLevel: 2,

    /** Base wall density (0-1) */
    baseWallDensity: 0.15,

    /** Additional wall density per level */
    densityPerLevel: 0.03
};

/**
 * Exit zone configuration
 * Defines scoring zones at the bottom of the maze
 * Scores match reference image: 500, 100, 1000, 0, 250
 * @constant {Object}
 */
const EXIT_CONFIG = {
    /** Exit zone height in pixels */
    zoneHeight: 45,

    /** Number of exit zones */
    zoneCount: 5
};

/**
 * Maze configuration
 * Controls procedural generation parameters
 * @constant {Object}
 */
const MAZE_CONFIG = {
    /** Base number of columns (should be odd) */
    baseCols: 11,

    /** Base number of rows (should be odd) */
    baseRows: 13,

    /** Wall thickness ratio */
    wallRatio: 1
};

/**
 * Visual configuration
 * Colors, effects, and rendering settings
 * @constant {Object}
 */
const VISUAL_CONFIG = {
    /** Ball colors for multi-ball rendering */
    ballColors: [
        '#e74c3c',  // Red
        '#3498db',  // Blue
        '#2ecc71',  // Green
        '#f39c12',  // Orange
        '#9b59b6',  // Purple
        '#1abc9c',  // Teal
        '#e91e63'   // Pink
    ],

    /** Trail length in frames */
    trailLength: 6,

    /** Trail opacity */
    trailOpacity: 0.3
};

/**
 * Control configuration
 * Input handling and sensitivity settings
 * @constant {Object}
 */
const CONTROL_CONFIG = {
    /** Tilt/keyboard sensitivity multiplier (must be > base gravity / gravityMultiplier) */
    tiltSensitivity: 0.25,

    /** Maximum tilt angle to consider (degrees) */
    maxTiltAngle: 45,

    /** Touch joystick radius */
    joystickRadius: 60,

    /** Input smoothing factor (0-1, lower = more smoothing) */
    smoothing: 0.15,

    /** Dead zone for tilt input */
    deadZone: 2
};

/**
 * Game state enumeration
 * @constant {Object}
 */
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_COMPLETE: 'level_complete',
    LEVEL_FAILED: 'level_failed',
    GAME_COMPLETE: 'game_complete'
};

/**
 * Control method enumeration
 * @constant {Object}
 */
const CONTROL_METHOD = {
    TILT: 'tilt',
    TOUCH: 'touch',
    KEYBOARD: 'keyboard'
};

/**
 * Get ball count for a specific level
 * @param {number} level - Current level (1-10)
 * @returns {number} Number of balls to spawn
 */
function getBallCount(level) {
    return level <= LEVEL_CONFIG.ballCountThreshold
        ? LEVEL_CONFIG.ballCounts.low
        : LEVEL_CONFIG.ballCounts.high;
}

/**
 * Get target score for any level
 * @param {number} level - Current level (any number)
 * @returns {number} Target score (always 1000)
 */
function getTargetScore(level) {
    return LEVEL_CONFIG.targetScore;
}

/**
 * Get wall density for a specific level
 * @param {number} level - Current level (1-10)
 * @returns {number} Wall density (0-1)
 */
function getWallDensity(level) {
    return Math.min(
        LEVEL_CONFIG.baseWallDensity + (level - 1) * LEVEL_CONFIG.densityPerLevel,
        0.5
    );
}

/**
 * Get maze height for a specific level
 * @param {number} level - Current level (1-10)
 * @returns {number} Maze height in rows
 */
function getMazeHeight(level) {
    return LEVEL_CONFIG.baseMazeHeight + (level - 1) * LEVEL_CONFIG.heightPerLevel;
}

// Export configuration for use in other modules
window.PHYSICS_CONFIG = PHYSICS_CONFIG;
window.LEVEL_CONFIG = LEVEL_CONFIG;
window.EXIT_CONFIG = EXIT_CONFIG;
window.MAZE_CONFIG = MAZE_CONFIG;
window.VISUAL_CONFIG = VISUAL_CONFIG;
window.CONTROL_CONFIG = CONTROL_CONFIG;
window.GAME_STATE = GAME_STATE;
window.CONTROL_METHOD = CONTROL_METHOD;
window.getBallCount = getBallCount;
window.getTargetScore = getTargetScore;
window.getWallDensity = getWallDensity;
window.getMazeHeight = getMazeHeight;
