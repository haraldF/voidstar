import 'phaser';

import { GameConstants } from './GameConstants';
import { Scene } from './Scene';
import { StartScene } from './StartScene';

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';
document.body.style.backgroundColor = '#000000';
document.addEventListener('contextmenu', event => event.preventDefault());

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scene: [ StartScene, Scene ],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
    });
}