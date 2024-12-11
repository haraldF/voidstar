import 'phaser';
import { GameConstants } from './GameConstants';

export class StartScene extends Phaser.Scene {
    public enemyCount = GameConstants.enemyShipCount;
    public difficulty = 'easy';

    constructor() {
        super({
            key: 'start'
        });
    }

    preload() {
    }

    create() {
        // note - all text objects are created at 0,0 and positioned later
        // to prevent duplication of size computation when resizing the game

        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x000000, 0x000000, 0x000022, 0x000022, 1);
        graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        const introText = this.add.text(0, 0, 'Tap to shoot\nSwipe to fly', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
        });
        introText.setOrigin(0.5, 0.5);
        introText.setScrollFactor(0);

        // Create text objects for "Easy" and "Hard"
        const easyText = this.add.text(0, 0, 'Easy', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 10, y: 10 }
        });
        easyText.setOrigin(0.5, 0.5);
        easyText.setScrollFactor(0);
        easyText.setInteractive();

        const hardText = this.add.text(0, 0, 'Hard', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 10, y: 10 }
        });
        hardText.setOrigin(0.5, 0.5);
        hardText.setScrollFactor(0);
        hardText.setInteractive();

        // Add enemy counter text
        const enemyCountText = this.add.text(0, 0, `Enemies: ${this.enemyCount}`, {
            fontSize: '24px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 10, y: 10 }
        });
        enemyCountText.setOrigin(0.5, 0.5);
        enemyCountText.setScrollFactor(0);

        const updateEnemyCount = (delta: number) => {
            this.enemyCount = Math.max(1, this.enemyCount + delta); // Ensure enemy count is not negative
            enemyCountText.setText(`Enemies: ${this.enemyCount}`);
        }

        // Add + button
        const plusButton = this.add.text(0, 0, '+', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(66, 66, 66, 0.5)',
            padding: { x: 10, y: 10 }
        });
        plusButton.setOrigin(0.5, 0.5);
        plusButton.setScrollFactor(0);
        plusButton.setInteractive();
        plusButton.on('pointerdown', () => updateEnemyCount(1));

        // Add - button
        const minusButton = this.add.text(0, 0, '-', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(66, 66, 66, 0.5)',
            padding: { x: 10, y: 10 }
        });
        minusButton.setOrigin(0.5, 0.5);
        minusButton.setScrollFactor(0);
        minusButton.setInteractive();
        minusButton.on('pointerdown', () => updateEnemyCount(-1));

        const startText = this.add.text(0, 0, 'Start', {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            backgroundColor: 'rgba(66, 66, 66, 0.5)',
            padding: { x: 10, y: 10 },

        });
        startText.setOrigin(0.5, 0.5);
        startText.setScrollFactor(0);
        startText.setInteractive();

        // Function to set the difficulty
        const setDifficulty = (difficulty: string) => {
            if (difficulty === 'easy') {
                easyText.setStyle({ backgroundColor: 'rgba(0, 255, 0, 0.5)' });
                hardText.setStyle({ backgroundColor: 'rgba(0, 0, 0, 0.5)' });
            } else if (difficulty === 'hard') {
                easyText.setStyle({ backgroundColor: 'rgba(0, 0, 0, 0.5)' });
                hardText.setStyle({ backgroundColor: 'rgba(255, 0, 0, 0.5)' });
            }
            this.difficulty = difficulty;
        };

        const copyrightText = this.add.text(0, 0, '© 2024 Harald Fernengel', {
            fontSize: '16px',
            color: '#ffffff',
            align: 'center',
        });
        copyrightText.setOrigin(0.5, 1);
        copyrightText.setPosition(this.cameras.main.width / 2, this.cameras.main.height - 10);

        // Add interactivity to the text objects
        easyText.on('pointerdown', () => {
            setDifficulty('easy');
        });

        hardText.on('pointerdown', () => {
            setDifficulty('hard');
        });

        startText.on('pointerup', () => {
            this.scene.start('game', { difficulty: this.difficulty, enemyCount: this.enemyCount });
        });

        // highlight the default to easy
        setDifficulty(this.difficulty);

        const setTextPosition = (gameSize: Phaser.Structs.Size) => {
            const centerX = gameSize.width / 2;
            const centerY = gameSize.height / 2;

            introText.setPosition(centerX, centerY - 100);
            easyText.setPosition(centerX - 100, centerY + 100);
            hardText.setPosition(centerX + 100, centerY + 100);
            startText.setPosition(centerX, centerY + 200);
            enemyCountText.setPosition(centerX, centerY);
            plusButton.setPosition(centerX + 130, centerY);
            minusButton.setPosition(centerX - 130, centerY);
            copyrightText.setPosition(centerX, gameSize.height - 10);
        }

        setTextPosition(this.scale.gameSize);

        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
            setTextPosition(gameSize);
            graphics.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        });
    }

}
