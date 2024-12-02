const urlParams = new URLSearchParams(window.location.search);

export const GameConstants = {
    // world size in pixels
    boundaryWidth: 8000,
    boundaryHeight: 6000,
    // ship velocity in pixels per second
    maxShipVelocity: parseFloat(urlParams.get('maxShipVelocity') ?? '140'),
    // radians per frame
    shipTurnRate: parseFloat(urlParams.get('shipTurnRate') ?? '0.1'),
    shipAccelerationRate: parseFloat(urlParams.get('shipAccelerationRate') ?? '2'),
    explosionRadius: parseFloat(urlParams.get('explosionRadius') ?? '40'),
    torpedoSpeed: parseFloat(urlParams.get('torpedoSpeed') ?? '200'),
    // blast time in miliseconds
    torpedoBlastTime: parseFloat(urlParams.get('torpedoBlastTime') ?? '700'),
    enemyShipCount: parseFloat(urlParams.get('enemyShipCount') ?? '4')
}
