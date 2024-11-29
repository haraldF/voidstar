import 'phaser';
import RBush from 'rbush';

const enum GameConstants {
    // world size in pixels
    boundaryWidth = 8000,
    boundaryHeight = 6000,
    maxShipVelocity = 140,
    shipTurnRate = 0.05,
    shipAccelerationRate = 2,
    explosionRadius = 40,
    torpedoSpeed = 200,
    // blast time in miliseconds
    torpedoBlastTime = 700
}

const enum GameState {
    BeforeStart,
    Running,
    GameOver
}

class Ship {
    public desiredRotation = 0;
    public readonly _desiredVelocity = new Phaser.Math.Vector2(0, 0);

    public readonly polygon: Phaser.GameObjects.Polygon;
    public readonly body: Phaser.Physics.Arcade.Body;
    public readonly marker: Phaser.GameObjects.Graphics;

    constructor(polygon: Phaser.GameObjects.Polygon, marker: Phaser.GameObjects.Graphics) {
        this.polygon = polygon;
        this.body = polygon.body as Phaser.Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setMaxSpeed(GameConstants.maxShipVelocity);

        this.marker = marker;
        this.marker.fillStyle(this.polygon.fillColor, 1);
        this.marker.fillTriangle(-10, -10, 10, -10, 0, 10);
        this.marker.setDepth(10); // Ensure the marker is on top of other objects
        this.marker.setVisible(false);
    }

    set desiredVelocity(value: Phaser.Math.Vector2) {
        const magnitude = this._desiredVelocity.length();
        const clampedMagnitude = Phaser.Math.Clamp(magnitude, -GameConstants.maxShipVelocity, GameConstants.maxShipVelocity);
        if (magnitude != clampedMagnitude) {
            this._desiredVelocity.normalize().scale(clampedMagnitude);
        }
        this._desiredVelocity.set(value.x, value.y);
    }

    get desiredVelocity() {
        return this._desiredVelocity.clone();
    }

    destroy() {
        this.polygon.destroy();
        this.marker.destroy();
    }

    updateMarker(camera: Phaser.Cameras.Scene2D.Camera, player: Ship) {

        const robotInView = camera.worldView.contains(this.polygon.x, this.polygon.y);
        if (!this.polygon.active || robotInView) {
            this.marker.setVisible(false);
            return;
        }

        const angle = Phaser.Math.Angle.Between(player.polygon.x, player.polygon.y, this.polygon.x, this.polygon.y);
        const cameraBounds = camera.worldView;

        const playerX = player.polygon.x;
        const playerY = player.polygon.y;
        const robotX = this.polygon.x;
        const robotY = this.polygon.y;

        const line = new Phaser.Geom.Line(playerX, playerY, robotX, robotY);
        const intersectionPoints = Phaser.Geom.Intersects.GetLineToRectangle(line, cameraBounds);

        if (intersectionPoints.length > 0) {
            this.marker.x = intersectionPoints[0].x;
            this.marker.y = intersectionPoints[0].y;
            this.marker.rotation = angle - Math.PI / 2; // Adjust rotation
            this.marker.setVisible(true);
        } else {
            this.marker.setVisible(false);
        }
    }

    update() {
        // Gradually adjust the velocity towards the desired velocity
        const currentVelocity = this.body.velocity;
        const desiredVelocity = this._desiredVelocity;

        if (!desiredVelocity.equals(currentVelocity)) {
            currentVelocity.lerp(desiredVelocity, GameConstants.shipAccelerationRate);
            if (currentVelocity.distanceSq(desiredVelocity) < GameConstants.shipAccelerationRate ** 2) {
                currentVelocity.copy(desiredVelocity);
            }
        }

        if (this.desiredRotation !== this.polygon.rotation) {
            let deltaRotation = this.desiredRotation - this.polygon.rotation;
            deltaRotation = Phaser.Math.Angle.Wrap(deltaRotation);
            this.polygon.rotation += deltaRotation * GameConstants.shipTurnRate;

            if (Math.abs(this.polygon.rotation - this.desiredRotation) < GameConstants.shipTurnRate) {
                this.polygon.rotation = this.desiredRotation;
            }
        }
    }
}

class RobotShip extends Ship {

    private timers = new Array<Phaser.Time.TimerEvent>();

    constructor(polygon: Phaser.GameObjects.Polygon, marker: Phaser.GameObjects.Graphics) {
        super(polygon, marker);
    }

    destroy() {
        super.destroy();
        this.timers.forEach(timer => timer.destroy());
        this.timers.length = 0;
    }

    start(scene: Scene) {
        this.changeCourse(scene);

        // Add timer event to update robot player's rotation and velocity randomly
        const changeCourseTimer = scene.time.addEvent({
            delay: 4000 + Phaser.Math.FloatBetween(-500, 500),
            callback: () => this.changeCourse(scene),
            loop: true
        });

        const fireTorpedoTimer = scene.time.addEvent({
            delay: 6000 + Phaser.Math.FloatBetween(-500, 500),
            callback: () => {
                if (!this.polygon.active) {
                    return;
                }
                const targetCoordinates = this.torpedoDestination(scene.player.polygon.getCenter(), scene.player.body.velocity);
                scene.launchTorpedo(this, targetCoordinates.x, targetCoordinates.y);
            },
            loop: true
        });

        const fireDefensiveTorpedoTimer = scene.time.addEvent({
            delay: 2000,
            callback: () => {
                if (!this.polygon.active) {
                    return;
                }

                for (const [torpedo, { velocity }] of scene.torpedoes) {

                    // distance between the robot player and the torpedo
                    const distance = Phaser.Math.Distance.BetweenPointsSquared(this.polygon.getCenter(), torpedo);
                    if (distance > (500 ** 2) || distance < (100 ** 2)) {
                        continue;
                    }

                    // Step 1: Calculate the relative position vector
                    const torpedoPosition = new Phaser.Math.Vector2(torpedo.x, torpedo.y);
                    const relativePosition = torpedoPosition.clone().subtract(this.polygon.getCenter());

                    // Step 2: Calculate the relative velocity vector
                    const relativeVelocity = velocity.clone().subtract(this.body.velocity);

                    // Step 3: Project the relative velocity onto the relative position vector
                    const projection = relativeVelocity.dot(relativePosition);

                    // Step 4: Check if the projection is negative
                    if (projection < 0) {
                        // fire a defensive torpedo
                        const targetCoordinates = this.torpedoDestination(torpedoPosition, velocity);
                        scene.launchTorpedo(this, targetCoordinates.x, targetCoordinates.y);
                        return;
                    }
                }
            },
            loop: true
        });

        this.timers.push(changeCourseTimer, fireTorpedoTimer, fireDefensiveTorpedoTimer);
    }

    torpedoDestination(targetPos: Phaser.Math.Vector2, targetVelocity: Phaser.Math.Vector2) {
        const torpedoSpeed = GameConstants.torpedoSpeed;

        const currentPos = this.polygon.getCenter();
        const distanceVec = targetPos.clone().subtract(currentPos);
        const distance = distanceVec.length();

        const targetSpeed = targetVelocity.length();
        const a = targetSpeed * targetSpeed - torpedoSpeed * torpedoSpeed;
        const b = 2 * distanceVec.dot(targetVelocity);
        const c = distance * distance;

        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            // No real solution, return current target position
            return { x: targetPos.x, y: targetPos.y };
        }

        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / (2 * a);
        const t2 = (-b + sqrtDiscriminant) / (2 * a);

        // Choose the smallest positive time
        let timeToIntercept = Math.min(t1, t2);
        if (timeToIntercept < 0) {
            timeToIntercept = Math.max(t1, t2);
        }

        if (timeToIntercept < 0) {
            // Both times are negative, no valid time to intercept, return current target position
            return { x: targetPos.x, y: targetPos.y };
        }

        const futureTargetPos = targetPos.clone().add(targetVelocity.clone().scale(timeToIntercept));

        return { x: futureTargetPos.x, y: futureTargetPos.y };
    }

    changeCourse(scene: Phaser.Scene) {
        if (!this.polygon.active) {
            return;
        }

        // Set random target rotation
        this.desiredRotation = Phaser.Math.FloatBetween(0, 2 * Math.PI);
        const newVelocity = new Phaser.Math.Vector2();
        newVelocity.setToPolar(this.desiredRotation - Math.PI / 2, Phaser.Math.FloatBetween(GameConstants.maxShipVelocity / 2, GameConstants.maxShipVelocity));
        this.desiredVelocity = newVelocity;
    }
}

class Scene extends Phaser.Scene {
    public player!: Ship;
    public torpedoes = new Map<Phaser.GameObjects.Graphics, { velocity: Phaser.Math.Vector2, targetX: number, targetY: number }>();

    private robotPlayers = new Array<RobotShip>();
    private starfield!: Phaser.GameObjects.Graphics;
    private asteroids!: Phaser.GameObjects.Graphics;
    private asteroidTree!: RBush<{ minX: number, minY: number, maxX: number, maxY: number, size: number }>;
    private stars: { x: number, y: number, greyValue: number }[] = [];
    private explosions = new Set<Phaser.GameObjects.Graphics>();
    private gameState = GameState.BeforeStart;
    private startText!: Phaser.GameObjects.Text;

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
            this.stars.push({ x, y, greyValue });
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

        const coords = [15, 0, 0, 50, 30, 50]
        const poly = this.add.polygon(GameConstants.boundaryWidth / 2, GameConstants.boundaryHeight / 2, coords, 0xaaaaaa);
        this.physics.add.existing(poly);
        this.player = new Ship(poly, this.add.graphics());

        this.addRobotShip(-250, -250, 0x990000);
        this.addRobotShip(250, -250, 0x994444);
        this.addRobotShip(-250, 250, 0x990044);
        this.addRobotShip(250, 250, 0x994400);

        // Add input listener for pointer events
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.gameState === GameState.Running) {
                this.launchTorpedo(this.player, pointer.worldX, pointer.worldY);
            } else if (this.gameState === GameState.BeforeStart) {
                this.startGame();
                this.physics.resume();
            }
        });

        // Make the camera follow the player
        this.cameras.main.startFollow(this.player.polygon);
        this.cameras.main.setDeadzone(100, 100);

        // Display "press any key to start" banner
        this.startText = this.add.text(window.innerWidth / 2, window.innerHeight / 2, 'Tap screen to start\nCursor keys to rotate, accelerate\nSpace to break\nTap anywhere to shoot', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        });
        this.startText.setOrigin(0.5, 0.5);
        this.startText.setScrollFactor(0);
    }

    addRobotShip(x: number, y: number, color: number) {
        const coords = [15, 0, 0, 50, 30, 50]
        const polygon = this.add.polygon(GameConstants.boundaryWidth / 2 + x, GameConstants.boundaryHeight / 2 + y, coords, color);
        this.physics.add.existing(polygon);
        const robotPlayer = new RobotShip(polygon, this.add.graphics());
        this.robotPlayers.push(robotPlayer);
    }

    startGame() {
        this.gameState = GameState.Running;
        this.startText.destroy();

        for (const robotPlayer of this.robotPlayers) {
            robotPlayer.start(this);
        }
    }

    launchTorpedo(ship: Ship, targetX: number, targetY: number) {
        const torpedo = this.add.graphics();

        torpedo.fillStyle(0xff0000, 1);
        torpedo.fillRect(-2, -10, 4, 20);
        torpedo.x = ship.polygon.x;
        torpedo.y = ship.polygon.y;

        // Add torpedo to the physics system
        this.physics.add.existing(torpedo);
        const torpedoBody = torpedo.body as Phaser.Physics.Arcade.Body;
        torpedoBody.setCollideWorldBounds(false);
        torpedoBody.setMaxSpeed(GameConstants.torpedoSpeed);
        this.physics.moveTo(torpedo, targetX, targetY, GameConstants.torpedoSpeed);

        const angle = Phaser.Math.Angle.Between(torpedo.x, torpedo.y, targetX, targetY);
        torpedo.rotation = angle + Math.PI / 2;

        this.torpedoes.set(torpedo, { velocity: new Phaser.Math.Vector2(), targetX, targetY });

        const timeout = 30 * 1000;
        this.time.delayedCall(timeout, () => {
            if (torpedo.active) {
                torpedo.destroy();
                this.torpedoes.delete(torpedo);
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
    }

    updateCursorKeys() {
        const cursors = this.input.keyboard!.createCursorKeys();

        if (cursors.left.isDown) {
            this.player.desiredRotation -= GameConstants.shipTurnRate;
        }
        if (cursors.right.isDown) {
            this.player.desiredRotation += GameConstants.shipTurnRate;
        }
        if (cursors.up.isDown) {
            // increase the velocity in the direction of the ship by GameConstants.shipAccelerationRate
            const angle = this.player.polygon.rotation - Math.PI / 2;
            const newVelocity = this.player.body.velocity.clone();
            newVelocity.x += Math.cos(angle) * GameConstants.shipAccelerationRate;
            newVelocity.y += Math.sin(angle) * GameConstants.shipAccelerationRate;
            this.player.desiredVelocity = newVelocity;
        }
        if (cursors.down.isDown) {
            const angle = this.player.polygon.rotation - Math.PI / 2;
            const newVelocity = this.player.body.velocity.clone();
            newVelocity.x -= Math.cos(angle) * GameConstants.shipAccelerationRate;
            newVelocity.y -= Math.sin(angle) * GameConstants.shipAccelerationRate;
            this.player.desiredVelocity = newVelocity;
        }
        if (cursors.space.isDown) {
            // Gradually reduce the player's velocity towards zero
            const decelerationRate = GameConstants.shipAccelerationRate;
            const newVelocity = this.player.body.velocity.clone();

            const currentSpeed = newVelocity.length();
            const newSpeed = Math.max(0, currentSpeed - decelerationRate);

            if (currentSpeed > 0) {
                newVelocity.normalize().scale(newSpeed);
            }

            this.player.desiredVelocity = newVelocity;
        }
    }

    updateTorpedoes() {
        for (const [torpedo, { velocity, targetX, targetY }] of this.torpedoes) {

            // Check if torpedo reached the target position
            if (Phaser.Math.Distance.Between(torpedo.x, torpedo.y, targetX, targetY) < 2) {
                torpedo.destroy();
                this.torpedoes.delete(torpedo);
                this.explodeTorpedo(torpedo);
            } else {
                for (const explosions of this.explosions) {
                    if (Phaser.Math.Distance.Between(torpedo.x, torpedo.y, explosions.x, explosions.y) < GameConstants.explosionRadius) {
                        torpedo.destroy();
                        this.torpedoes.delete(torpedo);
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
                    torpedo.destroy();
                    this.torpedoes.delete(torpedo);
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

        this.updateCursorKeys();

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
                { x: Phaser.Math.Between(-10, 10), y: Phaser.Math.Between(-10, 10) },
                { x: Phaser.Math.Between(-10, 10), y: Phaser.Math.Between(-10, 10) },
                { x: Phaser.Math.Between(-10, 10), y: Phaser.Math.Between(-10, 10) }
            ];
            const debris = this.add.polygon(x, y, points, ship.polygon.fillColor);

            const rotationSpeed = Phaser.Math.Between(-180, 180); // degrees per second
            this.tweens.add({
                targets: debris,
                ease: 'Power2',
                duration: 3000,
                x: debris.x + Phaser.Math.Between(-100, 100),
                y: debris.y + Phaser.Math.Between(-100, 100),
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

        for (const torpedo of this.torpedoes.keys()) {
            torpedo.destroy();
        }
        this.torpedoes.clear();

        for (const explosion of this.explosions) {
            explosion.destroy();
        }
        this.explosions.clear();

        this.starfield.clear();
    }

    private gameOver() {

        this.gameState = GameState.GameOver;
        this.physics.pause();

        const message = this.player.polygon.active ? 'You win!' : 'You lose!';

        // Add "Game Over" text
        const gameOverText = this.add.text(window.innerWidth / 2, window.innerHeight / 2, message, {
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

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scene: new Scene(),
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            // debugShowVelocity: true,
            x: 0,
            y: 0,
            width: GameConstants.boundaryWidth,
            height: GameConstants.boundaryHeight,

        }
    }
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
