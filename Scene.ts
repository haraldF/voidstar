import RBush from 'rbush';
import { GameConstants } from './GameConstants';
import { Ship } from './Ship';
import { RobotShip } from './RobotShip';
import { GameInterface } from './GameInterface';

const enum GameState {
    BeforeStart,
    Running,
    Respawning,
    GameOver
}

interface TorpedoProperties {
    targetX: number;
    targetY: number;
    destinationMarker?: Phaser.GameObjects.Graphics;
    emitter: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class Scene extends Phaser.Scene implements GameInterface {
    public player!: Ship;
    public readonly torpedoes = new Map<Phaser.GameObjects.Graphics, TorpedoProperties>();

    private readonly robotPlayers = new Array<RobotShip>();
    private starfield!: Phaser.GameObjects.Graphics;
    private asteroids!: Phaser.GameObjects.Graphics;
    private asteroidTree!: RBush<{ minX: number, minY: number, maxX: number, maxY: number, size: number }>;
    private readonly explosions = new Set<Phaser.GameObjects.Graphics>();
    private gameState = GameState.BeforeStart;
    private introText!: Phaser.GameObjects.Text;
    private easyText!: Phaser.GameObjects.Text;
    private hardText!: Phaser.GameObjects.Text;
    private startText!: Phaser.GameObjects.Text;

    public difficulty = 'easy';
    private readonly lastPointerDown = new Phaser.Math.Vector2(-1, -1);

    private static readonly shipDimensions = [7.5, 0, 0, 25, 15, 25]


    constructor() {
        super({
            key: 'main'
        });
    }

    preload() {
        if (!this.textures.exists('red')) {
            const canvas = this.textures.createCanvas('red', 2, 2);
            if (canvas !== null) {
                const context = canvas.getContext();

                // Draw 4 red pixels
                context.fillStyle = '#FF0000';
                context.fillRect(0, 0, 2, 2);

                // Refresh the texture to apply the changes
                canvas.refresh();
            }
        }
    }

    create() {
        this.gameState = GameState.BeforeStart;
        this.physics.pause();

        // Create starfield background
        this.starfield = this.add.graphics();
        for (let i = 0; i < 6000; i++) {
            const x = Phaser.Math.Between(0, GameConstants.boundaryWidth);
            const y = Phaser.Math.Between(0, GameConstants.boundaryHeight);
            const greyValue = Phaser.Math.Between(100, 255); // Random grey value
            this.starfield.fillStyle(Phaser.Display.Color.GetColor(greyValue, greyValue, greyValue), 1);
            this.starfield.fillPoint(x, y, 2);
        }

        this.asteroidTree = new RBush();

        // Create asteroids
        this.asteroids = this.add.graphics();
        for (let i = 0; i < 0; i++) {
            const x = Phaser.Math.Between(0, GameConstants.boundaryWidth);
            const y = Phaser.Math.Between(0, GameConstants.boundaryHeight);
            const size = Phaser.Math.Between(10, 50); // Random size
            this.asteroids.fillStyle(0x888888, 1);
            this.asteroids.fillCircle(x, y, size);
            this.asteroidTree.insert({ minX: x - size, minY: y - size, maxX: x + size, maxY: y + size, size });
        }

        const poly = this.add.polygon(GameConstants.boundaryWidth / 2, GameConstants.boundaryHeight / 2, Scene.shipDimensions, 0xaaaaaa);
        this.physics.add.existing(poly);
        this.player = new Ship(poly, this.add.graphics());

        this.addRobotShips();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.onPointerDown(pointer); });
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => { this.onPointerUp(pointer); });

        // Make the camera follow the player
        this.cameras.main.startFollow(this.player.polygon);
        this.cameras.main.setDeadzone(100, 100);

        // Display "press any key to start" banner
        this.introText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Tap to shoot\nSwipe to fly', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        });
        this.introText.setOrigin(0.5, 0.5);
        this.introText.setScrollFactor(0);

        // Create text objects for "Easy" and "Hard"
        this.easyText = this.add.text(this.scale.width / 2 - 100, this.scale.height / 2 + 100, 'Easy', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 10, y: 10 }
        });
        this.easyText.setOrigin(0.5, 0.5);
        this.easyText.setScrollFactor(0);
        this.easyText.setInteractive();

        this.hardText = this.add.text(this.scale.width / 2 + 100, this.scale.height / 2 + 100, 'Hard', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 10, y: 10 }
        });
        this.hardText.setOrigin(0.5, 0.5);
        this.hardText.setScrollFactor(0);
        this.hardText.setInteractive();

        this.startText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 200, 'Start', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(66, 66, 66, 0.5)',
            padding: { x: 10, y: 10 },

        });
        this.startText.setOrigin(0.5, 0.5);
        this.startText.setScrollFactor(0);
        this.startText.setInteractive();

        // Function to set the difficulty
        const setDifficulty = (difficulty: string) => {
            if (difficulty === 'easy') {
                this.easyText.setStyle({ backgroundColor: 'rgba(0, 255, 0, 0.5)' });
                this.hardText.setStyle({ backgroundColor: 'rgba(0, 0, 0, 0.5)' });
            } else if (difficulty === 'hard') {
                this.easyText.setStyle({ backgroundColor: 'rgba(0, 0, 0, 0.5)' });
                this.hardText.setStyle({ backgroundColor: 'rgba(255, 0, 0, 0.5)' });
            }
            this.difficulty = difficulty;
        };

        // Add interactivity to the text objects
        this.easyText.on('pointerdown', () => {
            setDifficulty('easy');
        });

        this.hardText.on('pointerdown', () => {
            setDifficulty('hard');
        });

        this.startText.on('pointerup', () => {
            this.startGame();
        });

        // highlight the default to easy
        setDifficulty(this.difficulty);

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.introText.setPosition(gameSize.width / 2, gameSize.height / 2);
            this.easyText.setPosition(gameSize.width / 2 - 100, gameSize.height / 2 + 100);
            this.hardText.setPosition(gameSize.width / 2 + 100, gameSize.height / 2 + 100);
            this.startText.setPosition(gameSize.width / 2, gameSize.height / 2 + 200);
        });
    }

    onPointerDown(pointer: Phaser.Input.Pointer) {
        if (this.gameState !== GameState.Running) {
            return;
        }

        this.lastPointerDown.set(pointer.x, pointer.y);
    }

    onPointerUp(pointer: Phaser.Input.Pointer) {
        if (this.gameState !== GameState.Running) {
            return;
        }

        // last pointer down is not from this game
        if (this.lastPointerDown.x === -1 && this.lastPointerDown.y === -1) {
            return;
        }

        const pointerUp = new Phaser.Math.Vector2(pointer.x, pointer.y);
        if (Phaser.Math.Distance.BetweenPointsSquared(this.lastPointerDown, pointerUp) < 225) {
            this.launchTorpedo(this.player, pointer.worldX, pointer.worldY);
            return;
        }

        const angle = Phaser.Math.Angle.BetweenPoints(this.lastPointerDown, pointerUp);
        this.player.desiredRotation = angle + Math.PI / 2;
        const velocity = this.physics.velocityFromRotation(angle, GameConstants.maxShipVelocity);
        this.player.desiredVelocity = new Phaser.Math.Vector2(velocity.x, velocity.y);
    }

    addRobotShips() {
        const center = new Phaser.Math.Vector2(GameConstants.boundaryWidth / 2, GameConstants.boundaryHeight / 2);
        const angleStep = Math.PI * 2 / GameConstants.enemyShipCount;
        const radius = 400;

        const colorPalette = [
            0xFF0000, // Bright Red
            0xFF7F00, // Bright Orange
            0xFFFF00, // Bright Yellow
            0x7FFF00, // Bright Chartreuse Green
            0x00FF00, // Bright Green
            0x00FF7F, // Bright Spring Green
            0x00FFFF, // Bright Cyan
            0x007FFF, // Bright Azure
            0x0000FF, // Bright Blue
            0x7F00FF, // Bright Violet
            0xFF00FF, // Bright Magenta
            0xFF007F, // Bright Rose
            0xFFFFFF, // Bright White
            0xFFFF7F  // Bright Light Yellow
        ];

        for (let i = 0; i < GameConstants.enemyShipCount; i++) {
            const angle = angleStep * i;
            const position = center.clone().setToPolar(angle, radius);
            const color = colorPalette[i % colorPalette.length];
            this.addRobotShip(position.x, position.y, color);
        }
    }

    addRobotShip(x: number, y: number, color: number) {
        const polygon = this.add.polygon(GameConstants.boundaryWidth / 2 + x, GameConstants.boundaryHeight / 2 + y, Scene.shipDimensions, color);
        this.physics.add.existing(polygon);
        const robotPlayer = new RobotShip(polygon, this.add.graphics());
        this.robotPlayers.push(robotPlayer);
    }

    startGame() {
        this.gameState = GameState.Running;
        this.introText.destroy();
        this.easyText.destroy();
        this.hardText.destroy();
        this.startText.destroy();

        for (const robotPlayer of this.robotPlayers) {
            robotPlayer.start(this, this);
        }

        this.physics.resume();
    }

    launchTorpedo(ship: Ship, targetX: number, targetY: number) {

        if (!ship.reloadTorpedoBay()) {
            // No torpedoes left
            return;
        }

        const torpedo = this.add.graphics();
        torpedo.fillStyle(0xff0000, 1);
        torpedo.fillRect(-1, -5, 2, 10);
        torpedo.x = ship.polygon.x;
        torpedo.y = ship.polygon.y;

        let destinationMarker: Phaser.GameObjects.Graphics | undefined = undefined;
        if (ship === this.player) {
            destinationMarker = this.add.graphics();
            destinationMarker.lineStyle(2, 0x770000, 1);
            destinationMarker.beginPath();
            destinationMarker.moveTo(-4, -4);
            destinationMarker.lineTo(4, 4);
            destinationMarker.moveTo(4, -4);
            destinationMarker.lineTo(-4, 4);
            destinationMarker.closePath();
            destinationMarker.strokePath();
            destinationMarker.x = targetX;
            destinationMarker.y = targetY;
        }

        // Add torpedo to the physics system
        this.physics.add.existing(torpedo);
        const torpedoBody = torpedo.body as Phaser.Physics.Arcade.Body;
        torpedoBody.setCollideWorldBounds(false);
        torpedoBody.setMaxSpeed(GameConstants.torpedoSpeed);
        this.physics.moveTo(torpedo, targetX, targetY, GameConstants.torpedoSpeed);

        const angle = Phaser.Math.Angle.Between(torpedo.x, torpedo.y, targetX, targetY);
        torpedo.rotation = angle + Math.PI / 2;

        const emitter = this.add.particles(0, 0, 'red', {
            lifespan: 250,
            speed: 1,
            blendMode: Phaser.BlendModes.ADD,
            tint: { start: 0xff0000, end: 0x000000 }
        });
        emitter.startFollow(torpedo);
        emitter.emitting = true;

        this.torpedoes.set(torpedo, { targetX, targetY, destinationMarker, emitter });

        const timeout = 30 * 1000;
        this.time.delayedCall(timeout, () => {
            if (torpedo.active) {
                this.explodeTorpedo(torpedo);
            }
        }, [], this);
    }

    explodeTorpedo(torpedo: Phaser.GameObjects.Graphics) {
        const explosion = this.add.graphics();
        explosion.fillStyle(0xff0000, 1);
        explosion.fillCircle(0, 0, GameConstants.explosionRadius);
        explosion.x = torpedo.x;
        explosion.y = torpedo.y;

        this.tweens.add({
            targets: { dummy: 0},
            duration: GameConstants.torpedoBlastTime,
            dummy: 1,
            ease: 'Power3',
            onUpdate: tween => {
                const progress = tween.progress;
                const startColor = Phaser.Display.Color.ValueToColor(0xff0000);
                const endColor = Phaser.Display.Color.ValueToColor(0x770000);
                const currentColor = Phaser.Display.Color.Interpolate.ColorWithColor(startColor, endColor, 100, progress * 100);
                const colorValue = Phaser.Display.Color.GetColor(currentColor.r, currentColor.g, currentColor.b);
                explosion.clear();
                explosion.fillStyle(colorValue, 1);
                explosion.fillCircle(0, 0, GameConstants.explosionRadius);
            },
            onComplete: () => {
                explosion.destroy();
                this.explosions.delete(explosion);
            }
        });

        this.explosions.add(explosion);

        torpedo.destroy();

        const { emitter, destinationMarker } = this.torpedoes.get(torpedo) ?? {};
        emitter?.destroy();
        destinationMarker?.destroy();

        this.torpedoes.delete(torpedo);
    }

    updateTorpedoes() {
        for (const [torpedo, { targetX, targetY }] of this.torpedoes) {

            // Check if torpedo reached the target position
            if (Phaser.Math.Distance.Between(torpedo.x, torpedo.y, targetX, targetY) < 2) {
                this.explodeTorpedo(torpedo);
            } else {
                for (const explosions of this.explosions) {
                    if (Phaser.Math.Distance.Between(torpedo.x, torpedo.y, explosions.x, explosions.y) < GameConstants.explosionRadius) {
                        this.explodeTorpedo(torpedo);
                        break;
                    }
                }
            }
        }

        for (const torpedo of this.torpedoes.keys()) {
            const maybeCollidingAsteroids = this.asteroidTree.search({ minX: torpedo.x - 2, minY: torpedo.y - 10, maxX: torpedo.x + 2, maxY: torpedo.y + 10 });
            for (const maybeCollidingAsteroid of maybeCollidingAsteroids) {
                const x = (maybeCollidingAsteroid.minX + maybeCollidingAsteroid.maxX) / 2;
                const y = (maybeCollidingAsteroid.minY + maybeCollidingAsteroid.maxY) / 2;
                if (Phaser.Math.Distance.Between(torpedo.x, torpedo.y, x, y) < maybeCollidingAsteroid.size) {
                    this.explodeTorpedo(torpedo);
                    break;
                }
            }
        }

        for (const explosion of this.explosions) {
            if (this.player.polygon.active && Phaser.Math.Distance.BetweenPointsSquared(this.player.polygon.getCenter(), explosion) < GameConstants.explosionRadius ** 2) {
                this.createDebris(this.player);
                this.player.body.setVelocity(0, 0);
                this.player.desiredVelocity.set(0, 0);
                this.player.polygon.active = false;
                this.player.polygon.visible = false;
            }
            for (const robotPlayer of this.robotPlayers) {
                if (robotPlayer.polygon.active && Phaser.Math.Distance.BetweenPointsSquared(robotPlayer.polygon.getCenter(), explosion) < GameConstants.explosionRadius ** 2) {
                    robotPlayer.destroy();
                    this.createDebris(robotPlayer);
                }
            }
        }
    }

    update() {
        if (this.gameState !== GameState.Running) {
            return;
        }

        this.player.update();
        this.robotPlayers.forEach(robotPlayer => robotPlayer.update());

        this.updateTorpedoes();

        const isGameOver = this.robotPlayers.every(robotPlayer => !robotPlayer.polygon.active);
        if (isGameOver) {
            this.gameOver();
        }

        const respawnRequired = !this.player.polygon.active;
        if (respawnRequired) {
            this.respawnPlayer();
        }

        // Update marker position and visibility
        const camera = this.cameras.main;
        for (const robotPlayer of this.robotPlayers) {
            robotPlayer.updateMarker(camera, this.player);
        }
    }

    private createDebris(ship: Ship) {
        const x = ship.polygon.x;
        const y = ship.polygon.y;

        for (let i = 0; i < 20; i++) {
            const points = [
                { x: Phaser.Math.Between(-5, 5), y: Phaser.Math.Between(-5, 5) },
                { x: Phaser.Math.Between(-5, 5), y: Phaser.Math.Between(-5, 5) },
                { x: Phaser.Math.Between(-5, 5), y: Phaser.Math.Between(-5, 5) }
            ];
            const debris = this.add.polygon(x, y, points, ship.polygon.fillColor);

            const rotationSpeed = Phaser.Math.Between(-180, 180); // degrees per second
            const duration = 3000;
            const velocityScale = 0.4; // Scale down the ship's velocity influence
            const targetX = debris.x + Phaser.Math.Between(-50, 50) + ship.body.velocity.x * velocityScale * (duration / 1000);
            const targetY = debris.y + Phaser.Math.Between(-50, 50) + ship.body.velocity.y * velocityScale * (duration / 1000);

            this.tweens.add({
                targets: debris,
                ease: 'Power2',
                duration: duration,
                x: targetX,
                y: targetY,
                angle: debris.angle + rotationSpeed,
                alpha: 0,
                onComplete: () => {
                    debris.destroy();
                }
            });
        }
    }

    private cleanup() {
        this.player.destroy();
        this.player.body.velocity.set(0, 0);
        this.player.desiredVelocity.set(0, 0);

        for (const robotPlayer of this.robotPlayers) {
            robotPlayer.destroy();
            robotPlayer.body.velocity.set(0, 0);
            this.player.desiredVelocity.set(0, 0);
        }

        for (const [ torpedo, { destinationMarker, emitter } ] of this.torpedoes.entries()) {
            torpedo.destroy();
            destinationMarker?.destroy();
            emitter.destroy();
        }
        this.torpedoes.clear();

        for (const explosion of this.explosions) {
            explosion.destroy();
        }
        this.explosions.clear();

        this.starfield.clear();

        this.lastPointerDown.set(-1, -1);
    }

    private finishRespawn() {
        this.player.polygon.active = true;
        this.player.polygon.visible = true;
        this.gameState = GameState.Running;
    }

    private playRespawnAnimation() {
        // Ensure the player is invisible initially
        this.player.polygon.visible = true;
        this.player.polygon.alpha = 0;

        // Create a fade-in tween animation
        this.tweens.add({
            targets: this.player.polygon,
            alpha: 1,
            duration: 1000, // 1 second duration
            ease: 'Quint.easeIn',
            onComplete: () => {
            }
        });
    }

    private respawnPlayer() {

        if (this.gameState === GameState.Respawning) {
            return;
        }
        this.gameState = GameState.Respawning;

        let countdown = GameConstants.respawnTime;

        const timerText = this.add.text(this.scale.width / 2, this.scale.height / 2, "", {
            fontSize: '64px',
            color: '#ffffff', // Change color to white for better visibility
            wordWrap: { width: this.scale.width - 100 }
        });
        timerText.setOrigin(0.5, 0.5); // Center the text
        timerText.setScrollFactor(0); // Ensure the text is fixed on the screen

        const timerEvent = this.time.addEvent({
            delay: 1000, // 1 second
            callback: () => {
                countdown--;
                timerText.setText(`Respawning in ${countdown}...`);

                if (countdown === 1) {
                    this.playRespawnAnimation();
                }

                if (countdown <= 0) {
                    timerEvent.remove();
                    timerText.destroy();
                    this.finishRespawn();
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    private gameOver() {

        this.gameState = GameState.GameOver;
        this.physics.pause();

        const message = this.player.polygon.active ? 'You win!' : 'You lose!';

        // Add "Game Over" text
        const gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
            fontSize: '64px',
            color: '#ffffff' // Change color to white for better visibility
        });
        gameOverText.setOrigin(0.5, 0.5); // Center the text
        gameOverText.setScrollFactor(0); // Ensure the text is fixed on the screen

        // Fade out the text
        this.tweens.add({
            targets: gameOverText,
            alpha: 0,
            duration: 3000,
            ease: 'Power1',
            onComplete: () => {
                gameOverText.destroy();
                this.cleanup();
                this.scene.restart();
            }
        });
    }
}
