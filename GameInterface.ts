import type { Ship } from "./Ship";
import "phaser";

export interface GameInterface
{
    launchTorpedo: (ship: Ship, targetX: number, targetY: number) => void;
    player: Ship;
    torpedoes: Map<Phaser.GameObjects.Graphics, { velocity: Phaser.Math.Vector2, targetX: number, targetY: number }>;
}