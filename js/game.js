/**
 * ============================================================================
 * EXIT VECTOR - GAME MODULE
 * ============================================================================
 * Main game controller handling state management, game loop, and UI.
 * 
 * Features:
 * - Game state machine (menu, playing, paused, level complete)
 * - Level progression with target scores
 * - Pause/resume functionality
 * - Score tracking and display
 * - FPS monitoring
 * 
 * @module game
 * ============================================================================
 */

/**
 * Game class
 * Main game controller and loop manager
 */
class Game {
    /**
     * Create a new Game instance
     */
    constructor() {
        /** @type {string} Current game state */
        this.state = GAME_STATE.MENU;

        /** @type {number} Current level (1-10) */
        this.level = 1;

        /** @type {number} Current score */
        this.score = 0;

        /** @type {number} Total score across all levels */
        this.totalScore = 0;

        /** @type {number} Target score for current level */
        this.targetScore = 0;

        /** @type {number} Last frame timestamp */
        this.lastTime = 0;

        /** @type {number} Delta time */
        this.deltaTime = 0;

        /** @type {number} FPS counter */
        this.fps = 0;

        /** @type {number} Frame count for FPS */
        this.frameCount = 0;

        /** @type {number} FPS timer */
        this.fpsTime = 0;

        /** @type {boolean} Animation frame ID */
        this.animationId = null;

        /** @type {Object[]} Score popup animations */
        this.scorePopups = [];

        /** @type {boolean} Whether game is initialized */
        this.initialized = false;

        // Bind methods
        this._gameLoop = this._gameLoop.bind(this);
    }

    /**
     * Initialize the game
     * Sets up all systems and event listeners
     */
    async init() {
        if (this.initialized) return;

        // Initialize renderer
        window.Renderer.init('game-canvas');

        // Initialize controls
        await window.ControlsManager.init();

        // Set up UI event listeners
        this._setupEventListeners();

        this.initialized = true;
        console.log('Exit Vector initialized');
    }

    /**
     * Set up UI event listeners
     * @private
     */
    _setupEventListeners() {
        // Start button - support both click and touch
        const startButton = document.getElementById('start-button');
        if (startButton) {
            const handleStart = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Request motion permission on iOS
                await window.ControlsManager.requestPermission();
                this.startGame();
            };
            startButton.addEventListener('click', handleStart);
            startButton.addEventListener('touchend', handleStart);
        }
        // Helper to add both click and touch events
        const addTouchHandler = (element, handler) => {
            if (!element) return;
            const wrappedHandler = (e) => {
                e.preventDefault();
                handler();
            };
            element.addEventListener('click', wrappedHandler);
            element.addEventListener('touchend', wrappedHandler);
        };

        // Pause button
        const pauseButton = document.getElementById('pause-button');
        addTouchHandler(pauseButton, () => this.togglePause());

        // Resume button
        const resumeButton = document.getElementById('resume-button');
        addTouchHandler(resumeButton, () => this.resumeGame());

        // Restart buttons
        const restartButton = document.getElementById('restart-button');
        addTouchHandler(restartButton, () => this.restartLevel());

        const restartFromPause = document.getElementById('restart-from-pause-button');
        addTouchHandler(restartFromPause, () => {
            this.hidePauseOverlay();
            this.restartLevel();
        });

        // Next level button
        const nextLevelButton = document.getElementById('next-level-button');
        addTouchHandler(nextLevelButton, () => this.nextLevel());

        // Retry button
        const retryButton = document.getElementById('retry-button');
        addTouchHandler(retryButton, () => this.restartLevel());

        // Play again button
        const playAgainButton = document.getElementById('play-again-button');
        addTouchHandler(playAgainButton, () => this.restartGame());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.state === GAME_STATE.PLAYING) {
                    this.togglePause();
                } else if (this.state === GAME_STATE.PAUSED) {
                    this.resumeGame();
                }
            }
            if (e.key === 'r' || e.key === 'R') {
                if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED) {
                    this.restartLevel();
                }
            }
        });
    }

    /**
     * Start a new game
     */
    startGame() {
        this.level = 1;
        this.totalScore = 0;
        this.hidePermissionOverlay();
        this.startLevel();
    }

    /**
     * Start the current level
     */
    startLevel() {
        // Get target score for level
        this.targetScore = getTargetScore(this.level);
        this.score = 0;
        this.scorePopups = [];

        // Get ball count for level
        const ballCount = getBallCount(this.level);

        // Get canvas dimensions
        const { width, height } = window.Renderer.getDimensions();

        // Initialize maze with full screen dimensions (maze centered on screen)
        window.MazeGenerator.init(this.level, width, height);
        const mazeDimensions = window.MazeGenerator.getDimensions();

        // Set maze dimensions in renderer
        window.Renderer.setMazeDimensions(mazeDimensions);

        // Get spawn positions
        const spawnPositions = window.MazeGenerator.getSpawnPositions(ballCount);

        // Initialize physics
        window.PhysicsEngine.init(
            spawnPositions,
            window.MazeGenerator.getWallRects(),
            window.MazeGenerator.getExitZones(),
            mazeDimensions.width,
            mazeDimensions.height,
            mazeDimensions.ballRadius
        );

        // Set physics callbacks
        window.PhysicsEngine.setOnBallExit((ball) => {
            this._onBallExit(ball);
        });

        // Update HUD
        this._updateHUD();

        // Show level notification
        this._showLevelNotification();

        // Set state and start loop
        this.state = GAME_STATE.PLAYING;
        this.lastTime = performance.now();

        // Enable touch controls for gameplay
        const touchArea = document.getElementById('touch-area');
        if (touchArea) touchArea.classList.add('active');

        if (!this.animationId) {
            this._gameLoop();
        }
    }

    /**
     * Main game loop
     * @private
     */
    _gameLoop(currentTime = performance.now()) {
        this.animationId = requestAnimationFrame(this._gameLoop);

        // Calculate delta time
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap delta time to prevent huge jumps
        this.deltaTime = Math.min(this.deltaTime, 0.1);

        // Update FPS
        this._updateFPS();

        // Only update if playing
        if (this.state === GAME_STATE.PLAYING) {
            // Update controls
            window.ControlsManager.update();

            // Set gravity in physics
            window.PhysicsEngine.setGravity(window.ControlsManager.getGravity());

            // Update physics
            window.PhysicsEngine.update();

            // Update score popups
            this._updateScorePopups();

            // Update HUD
            this._updateHUD();

            // Check if level is complete
            if (window.PhysicsEngine.allBallsExited()) {
                this._onLevelComplete();
            }
        }

        // Always render
        this._render();
    }

    /**
     * Render the game
     * @private
     */
    _render() {
        window.Renderer.render({
            maze: window.MazeGenerator,
            balls: window.PhysicsEngine.getBalls(),
            exitZones: window.MazeGenerator.getExitZones(),
            score: this.score,
            level: this.level,
            targetScore: this.targetScore,
            scorePopups: this.scorePopups
        });
    }

    /**
     * Update FPS counter
     * @private
     */
    _updateFPS() {
        this.frameCount++;
        this.fpsTime += this.deltaTime;

        if (this.fpsTime >= 1) {
            this.fps = Math.round(this.frameCount / this.fpsTime);
            this.frameCount = 0;
            this.fpsTime = 0;

            // Update debug display
            const fpsElement = document.getElementById('debug-fps');
            if (fpsElement) {
                fpsElement.textContent = this.fps;
            }
        }
    }

    /**
     * Update score popup animations
     * @private
     */
    _updateScorePopups() {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            this.scorePopups[i].progress += this.deltaTime * 2;
            if (this.scorePopups[i].progress >= 1) {
                this.scorePopups.splice(i, 1);
            }
        }
    }

    /**
     * Handle ball exit event
     * @param {Ball} ball - Ball that exited
     * @private
     */
    _onBallExit(ball) {
        this.score = window.PhysicsEngine.getScore();

        // Add score popup
        this.scorePopups.push({
            x: ball.x,
            y: ball.y,
            score: ball.score,
            progress: 0
        });

        // Update HUD
        this._updateHUD();
    }

    /**
     * Handle level completion
     * @private
     */
    _onLevelComplete() {
        this.score = window.PhysicsEngine.getScore();
        this.totalScore += this.score;

        // Disable touch area so overlay buttons work
        const touchArea = document.getElementById('touch-area');
        if (touchArea) touchArea.classList.remove('active');

        if (this.score >= this.targetScore) {
            // Level passed
            if (this.level >= LEVEL_CONFIG.maxLevel) {
                // Game complete
                this.state = GAME_STATE.GAME_COMPLETE;
                this._showGameCompleteOverlay();
            } else {
                // Show level complete overlay
                this.state = GAME_STATE.LEVEL_COMPLETE;
                this._showLevelCompleteOverlay();
            }
        } else {
            // Level failed
            this.state = GAME_STATE.LEVEL_FAILED;
            this._showLevelFailedOverlay();
        }
    }

    /**
     * Update HUD elements
     * @private
     */
    _updateHUD() {
        // Update score
        const scoreValue = document.getElementById('score-value');
        if (scoreValue) {
            scoreValue.textContent = this.score;
        }

        // Update level
        const levelValue = document.getElementById('level-value');
        if (levelValue) {
            levelValue.textContent = this.level;
        }

        // Update target
        const targetValue = document.getElementById('target-value');
        if (targetValue) {
            targetValue.textContent = this.targetScore;
        }

        // Update active balls
        const ballsValue = document.getElementById('balls-value');
        if (ballsValue) {
            ballsValue.textContent = window.PhysicsEngine.getActiveBallCount();
        }

        // Update progress bar (vertical - uses height)
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            const progress = Math.min(100, (this.score / this.targetScore) * 100);

            // Responsive: horizontal progress bar in portrait, vertical in landscape
            const isPortrait = window.innerHeight > window.innerWidth;
            if (isPortrait) {
                progressFill.style.width = `${progress}%`;
                progressFill.style.height = '100%';
            } else {
                progressFill.style.height = `${progress}%`;
                progressFill.style.width = '100%';
            }

            // Change color based on progress (gradient direction matches orientation)
            const gradientDir = isPortrait ? '90deg' : '180deg';
            if (progress >= 100) {
                progressFill.style.background = `linear-gradient(${gradientDir}, #4ade80, #22c55e)`;
            } else if (progress >= 70) {
                progressFill.style.background = `linear-gradient(${gradientDir}, #facc15, #eab308)`;
            } else {
                progressFill.style.background = `linear-gradient(${gradientDir}, #60a5fa, #3b82f6)`;
            }
        }
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        if (this.state === GAME_STATE.PLAYING) {
            this.pauseGame();
        } else if (this.state === GAME_STATE.PAUSED) {
            this.resumeGame();
        }
    }

    /**
     * Pause the game
     */
    pauseGame() {
        if (this.state !== GAME_STATE.PLAYING) return;

        this.state = GAME_STATE.PAUSED;
        window.PhysicsEngine.setPaused(true);

        // Disable touch area so overlay buttons work
        const touchArea = document.getElementById('touch-area');
        if (touchArea) touchArea.classList.remove('active');

        this.showPauseOverlay();
    }

    /**
     * Resume the game
     */
    resumeGame() {
        if (this.state !== GAME_STATE.PAUSED) return;

        this.state = GAME_STATE.PLAYING;
        window.PhysicsEngine.setPaused(false);
        this.hidePauseOverlay();

        // Re-enable touch area for gameplay
        const touchArea = document.getElementById('touch-area');
        if (touchArea) touchArea.classList.add('active');

        this.lastTime = performance.now();
    }

    /**
     * Restart current level
     */
    restartLevel() {
        this.hidePauseOverlay();
        this.hideLevelCompleteOverlay();
        this.hideLevelFailedOverlay();
        window.ControlsManager.reset();
        this.startLevel();
    }

    /**
     * Proceed to next level
     */
    nextLevel() {
        this.level++;
        this.hideLevelCompleteOverlay();
        window.ControlsManager.reset();
        this.startLevel();
    }

    /**
     * Restart entire game
     */
    restartGame() {
        this.hideGameCompleteOverlay();
        this.startGame();
    }

    /**
     * Show level notification
     * @private
     */
    _showLevelNotification() {
        const notification = document.getElementById('level-notification');
        const levelText = document.getElementById('notification-level');
        const ballsText = document.getElementById('notification-balls');

        if (notification && levelText) {
            levelText.textContent = `Level ${this.level}`;
            if (ballsText) {
                ballsText.textContent = `${getBallCount(this.level)} balls`;
            }

            notification.classList.remove('hidden');
            setTimeout(() => {
                notification.classList.add('hidden');
            }, 2000);
        }
    }

    /**
     * Show/hide permission overlay
     */
    hidePermissionOverlay() {
        const overlay = document.getElementById('permission-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Show/hide pause overlay
     */
    showPauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    hidePauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Show level complete overlay
     * @private
     */
    _showLevelCompleteOverlay() {
        const overlay = document.getElementById('level-complete-overlay');
        const scoreText = document.getElementById('complete-score');
        const targetText = document.getElementById('complete-target');

        if (overlay) {
            if (scoreText) scoreText.textContent = this.score;
            if (targetText) targetText.textContent = this.targetScore;
            overlay.classList.remove('hidden');
        }
    }

    hideLevelCompleteOverlay() {
        const overlay = document.getElementById('level-complete-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Show level failed overlay
     * @private
     */
    _showLevelFailedOverlay() {
        const overlay = document.getElementById('level-failed-overlay');
        const scoreText = document.getElementById('failed-score');
        const targetText = document.getElementById('failed-target');

        if (overlay) {
            if (scoreText) scoreText.textContent = this.score;
            if (targetText) targetText.textContent = this.targetScore;
            overlay.classList.remove('hidden');
        }
    }

    hideLevelFailedOverlay() {
        const overlay = document.getElementById('level-failed-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Show game complete overlay
     * @private
     */
    _showGameCompleteOverlay() {
        const overlay = document.getElementById('game-complete-overlay');
        const totalText = document.getElementById('total-score');

        if (overlay) {
            if (totalText) totalText.textContent = this.totalScore;
            overlay.classList.remove('hidden');
        }
    }

    hideGameCompleteOverlay() {
        const overlay = document.getElementById('game-complete-overlay');
        if (overlay) overlay.classList.add('hidden');
    }
}

// Create singleton instance
const game = new Game();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    game.init();
});

// Export for use in other modules
window.Game = game;
