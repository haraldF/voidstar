import RBush from 'rbush';
import { GameConstants } from './GameConstants';
import { Ship } from './Ship';
import { RobotShip } from './RobotShip';
import { GameInterface } from './GameInterface';

const enum GameState {
    BeforeStart,
    Running,
    GameOver
}

export class Scene extends Phaser.Scene implements GameInterface {
    public player!: Ship;
    public readonly torpedoes = new Map<Phaser.GameObjects.Graphics, { targetX: number, targetY: number, destinationMarker?: Phaser.GameObjects.Graphics }>();

    private readonly robotPlayers = new Array<RobotShip>();
    private starfield!: Phaser.GameObjects.Graphics;
    private asteroids!: Phaser.GameObjects.Graphics;
    private asteroidTree!: RBush<{ minX: number, minY: number, maxX: number, maxY: number, size: number }>;
    private readonly explosions = new Set<Phaser.GameObjects.Graphics>();
    private gameState = GameState.BeforeStart;
    private startText!: Phaser.GameObjects.Text;
    private readonly lastPointerDown = new Phaser.Math.Vector2(-1, -1);

    private static readonly shipDimensions = [7.5, 0, 0, 25, 15, 25]


    constructor() {
        super({
            key: 'main'
        });
    }

    preload() {
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
        this.startText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Tap to shoot\nSwipe to fly\nTap to start', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        });
        this.startText.setOrigin(0.5, 0.5);
        this.startText.setScrollFactor(0);

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            this.startText.setPosition(gameSize.width / 2, gameSize.height / 2);
        });
    }

    onPointerDown(pointer: Phaser.Input.Pointer) {
        if (this.gameState !== GameState.Running) {
            return;
        }

        this.lastPointerDown.set(pointer.x, pointer.y);
    }

    onPointerUp(pointer: Phaser.Input.Pointer) {
        if (this.gameState === GameState.BeforeStart) {
            this.startGame();
            this.physics.resume();
            return;
        }

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
        this.startText.destroy();

        for (const robotPlayer of this.robotPlayers) {
            robotPlayer.start(this, this);
        }
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

        this.torpedoes.set(torpedo, { targetX, targetY, destinationMarker });

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

        this.torpedoes.get(torpedo)?.destinationMarker?.destroy();
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
                this.player.destroy();
                this.createDebris(this.player);
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

        const isGameOver = !this.player.polygon.active || this.robotPlayers.every(robotPlayer => !robotPlayer.polygon.active);
        if (isGameOver) {
            this.gameOver();
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
            this.tweens.add({
                targets: debris,
                ease: 'Power2',
                duration: 3000,
                x: debris.x + Phaser.Math.Between(-50, 50),
                y: debris.y + Phaser.Math.Between(-50, 50),
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

        for (const [ torpedo, { destinationMarker} ] of this.torpedoes.entries()) {
            torpedo.destroy();
            destinationMarker?.destroy();
        }
        this.torpedoes.clear();

        for (const explosion of this.explosions) {
            explosion.destroy();
        }
        this.explosions.clear();

        this.starfield.clear();

        this.lastPointerDown.set(-1, -1);
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
