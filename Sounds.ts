export class Sounds {

    private explosion: Phaser.Sound.BaseSound | undefined;
    private torpedo: Phaser.Sound.BaseSound | undefined;

    constructor(private readonly gameEvents: Phaser.Events.EventEmitter) {
        gameEvents.on('torpedo-launched', (isPlayer: boolean) => this.onTorpedoLaunched(isPlayer));
        gameEvents.on('player-exploded', () => this.onPlayerExploded());
    }

    public preload(scene: Phaser.Scene) {
        scene.load.audio('explosion', 'assets/sounds/explosion.mp3');
        scene.load.audio('torpedo', 'assets/sounds/torpedo.mp3');
    }

    public create(scene: Phaser.Scene) {
        this.explosion = scene.sound.add('explosion');
        this.torpedo = scene.sound.add('torpedo');
    }

    private onTorpedoLaunched(isPlayer: boolean) {
        if (isPlayer) {
            this.torpedo?.play();
        }
    }

    private onPlayerExploded() {
        this.explosion?.play();
    }
}