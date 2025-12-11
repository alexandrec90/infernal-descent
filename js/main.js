import { Game } from './game.js';

// Wait for DOM
window.addEventListener('DOMContentLoaded', () => {
    console.log("System: Initializing...");
    
    // Create the Game instance (which initializes the Engine)
    const game = new Game();
    
    // Start logic
    game.init().then(() => {
        console.log("System: Assets Loaded. Starting Loop.");
        game.start();
    }).catch(err => {
        console.error("CRITICAL FAILURE:", err);
    });
});