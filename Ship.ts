import { GameConstants } from "./GameConstants";
import "phaser";

export class Ship {
    public desiredRotation = 0;
    public readonly _desiredVelocity = new Phaser.Math.Vector2(0, 0);

    public readonly polygon: Phaser.GameObjects.Polygon;
    public readonly body: Phaser.Physics.Arcade.Body;
    public readonly marker: Phaser.GameObjects.Graphics;

    public readyTorpedoBays = GameConstants.torpedoBays;

    constructor(polygon: Phaser.GameObjects.Polygon, marker: Phaser.GameObjects.Graphics) {
        this.polygon = polygon;
        this.body = polygon.body as Phaser.Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setMaxSpeed(GameConstants.maxShipVelocity);
        this.body.setDrag(0.5);
        this.body.setDamping(false);

        this.marker = marker;
        this.marker.fillStyle(this.polygon.fillColor, 1);
        this.marker.fillTriangle(-10, -10, 10, -10, 0, 10);
        this.marker.setDepth(10); // Ensure the marker is on top of other objects
        this.marker.setVisible(false);
    }

    // reloads the first available torpedo bay
    // return false if all torpedo bays are busy
    public reloadTorpedoBay(): boolean {

        if (this.readyTorpedoBays === 0) {
            return false;
        }

        this.readyTorpedoBays--;

        const timer = this.polygon.scene.time.addEvent({
            delay: GameConstants.torpedoReloadTime,
            callback: () => {
                this.readyTorpedoBays++;
                timer.destroy();
            }
        });

        return true;
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
        // Update the ship's desired rotation and velocity
        const currentRotation = this.polygon.rotation;
        const currentVelocity = this.body.velocity;

        // Use lerping to smoothly rotate the ship
        const rotationLerpFactor = 0.1; // Adjust this factor to control the lerp speed
        const newRotation = Phaser.Math.Angle.RotateTo(currentRotation, this.desiredRotation, rotationLerpFactor);
        
        // Use lerping to smoothly accelerate the ship
        const lerpFactor = 0.1; // Adjust this factor to control the lerp speed
        const newVelocity = {
            x: Phaser.Math.Linear(currentVelocity.x, this.desiredVelocity.x, lerpFactor),
            y: Phaser.Math.Linear(currentVelocity.y, this.desiredVelocity.y, lerpFactor)
        };
    
        // Apply the new rotation and velocity to the ship
        this.polygon.rotation = newRotation;
        this.body.setVelocity(newVelocity.x, newVelocity.y);
    }
}
