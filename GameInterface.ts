import type { Ship } from "./Ship";
import "phaser";

export interface GameInterface
{
    launchTorpedo: (ship: Ship, targetX: number, targetY: number) => void;
    player: Ship;
    torpedoes: Map<Phaser.GameObjects.Graphics, { targetX: number, targetY: number, destinationMarker?: Phaser.GameObjects.Graphics }>;
    difficulty: string;
}