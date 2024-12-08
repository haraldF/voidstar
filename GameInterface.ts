import type { Ship } from "./Ship";
import "phaser";

interface TorpedoProperties {
    targetX: number;
    targetY: number;
}

export interface GameInterface
{
    launchTorpedo: (ship: Ship, targetX: number, targetY: number) => void;
    player: Ship;
    torpedoes: Map<Phaser.GameObjects.Graphics, TorpedoProperties>;
    difficulty: string;
}