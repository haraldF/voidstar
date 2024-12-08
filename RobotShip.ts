import { GameConstants } from "./GameConstants";
import { GameInterface } from "./GameInterface";
import { Ship } from "./Ship";

export class RobotShip extends Ship {

    private timers = new Array<Phaser.Time.TimerEvent>();

    constructor(polygon: Phaser.GameObjects.Polygon, marker: Phaser.GameObjects.Graphics) {
        super(polygon, marker);
    }

    destroy() {
        super.destroy();
        this.timers.forEach(timer => timer.destroy());
        this.timers.length = 0;
    }

    start(scene: Phaser.Scene, gameInterface: GameInterface) {
        this.changeCourse(gameInterface);

        const difficultyModifier = gameInterface.difficulty === 'easy' ? 2 : 1;

        // Add timer event to update robot player's rotation and velocity randomly
        const changeCourseTimer = scene.time.addEvent({
            delay: (4000 * difficultyModifier) + Phaser.Math.FloatBetween(-500, 500),
            callback: () => this.changeCourse(gameInterface),
            loop: true
        });

        const fireTorpedoTimer = scene.time.addEvent({
            delay: (6000 * difficultyModifier) + Phaser.Math.FloatBetween(-500, 500),
            callback: () => {
                if (!this.polygon.active || !gameInterface.player.polygon.active) {
                    return;
                }
                const targetCoordinates = this.torpedoDestination(gameInterface.player.polygon.getCenter(), gameInterface.player.body.velocity);
                const slackX = gameInterface.difficulty === 'easy' ? Phaser.Math.FloatBetween(-100, 100) : 0;
                const slackY = gameInterface.difficulty === 'easy' ? Phaser.Math.FloatBetween(-100, 100) : 0;
                gameInterface.launchTorpedo(this, targetCoordinates.x + slackX, targetCoordinates.y + slackY);
            },
            loop: true
        });

        const fireDefensiveTorpedoTimer = scene.time.addEvent({
            delay: 2000 * difficultyModifier,
            callback: () => {
                if (!this.polygon.active) {
                    return;
                }

                for (const [torpedo, { targetX, targetY }] of gameInterface.torpedoes) {

                    // distance between the robot player and the torpedo
                    const distance = Phaser.Math.Distance.BetweenPointsSquared(this.polygon.getCenter(), torpedo);
                    if (distance > (500 ** 2) || distance < (100 ** 2)) {
                         continue;
                    }

                    // Step 1: Calculate the relative position vector
                    const torpedoPosition = new Phaser.Math.Vector2(torpedo.x, torpedo.y);
                    const relativePosition = torpedoPosition.clone().subtract(this.polygon.getCenter());

                    const torpedoVelocity = new Phaser.Math.Vector2(targetX - torpedo.x, targetY - torpedo.y).normalize().scale(GameConstants.torpedoSpeed);

                    // Step 2: Calculate the relative velocity vector
                    const relativeVelocity = torpedoVelocity.clone().subtract(this.body.velocity);

                    // Step 3: Project the relative velocity onto the relative position vector
                    const projection = relativeVelocity.dot(relativePosition);

                    // Step 4: Check if the projection is negative
                    if (projection < 0) {
                        // fire a defensive torpedo
                        const targetCoordinates = this.torpedoDestination(torpedoPosition, torpedoVelocity);
                        gameInterface.launchTorpedo(this, targetCoordinates.x, targetCoordinates.y);
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

    changeCourse(gameInterface: GameInterface) {
        if (!this.polygon.active) {
            return;
        }

        if (Phaser.Math.Distance.BetweenPointsSquared(gameInterface.player.polygon, this.polygon) > 250000) {
            // Set target rotation to face the player
            this.desiredRotation = Phaser.Math.Angle.Between(this.polygon.x, this.polygon.y, gameInterface.player.polygon.x, gameInterface.player.polygon.y) + Math.PI / 2;
            // Don't head straight to the player or the robots might all lump together
            this.desiredRotation += Phaser.Math.FloatBetween(-Math.PI / 3, Math.PI / 3);
            const newVelocity = new Phaser.Math.Vector2();
            newVelocity.setToPolar(this.desiredRotation - Math.PI / 2, GameConstants.maxShipVelocity);
            this.desiredVelocity = newVelocity;
            return;
        }

        // Set random target rotation
        this.desiredRotation = Phaser.Math.FloatBetween(0, 2 * Math.PI);
        const newVelocity = new Phaser.Math.Vector2();
        newVelocity.setToPolar(this.desiredRotation - Math.PI / 2, Phaser.Math.FloatBetween(GameConstants.maxShipVelocity / 2, GameConstants.maxShipVelocity));
        this.desiredVelocity = newVelocity;
    }
}

