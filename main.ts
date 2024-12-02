import 'phaser';

import { GameConstants } from './GameConstants';
import { Scene } from './Scene';

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';
document.addEventListener('contextmenu', event => event.preventDefault());

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scene: new Scene(),
    scale: {
        mode: Phaser.Scale.EXPAND,
        autoCenter: Phaser.Scale.RESIZE,
        expandParent: true
    },
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
