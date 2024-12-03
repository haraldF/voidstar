const urlParams = new URLSearchParams(window.location.search);

export const GameConstants = {
    // world size in pixels
    boundaryWidth: 8000,
    boundaryHeight: 6000,
    // ship velocity in pixels per second
    maxShipVelocity: parseFloat(urlParams.get('maxShipVelocity') ?? '70'),
    // radians per frame
    shipTurnRate: parseFloat(urlParams.get('shipTurnRate') ?? '0.1'),
    shipAccelerationRate: parseFloat(urlParams.get('shipAccelerationRate') ?? '1'),
    explosionRadius: parseFloat(urlParams.get('explosionRadius') ?? '20'),
    torpedoSpeed: parseFloat(urlParams.get('torpedoSpeed') ?? '100'),
    // blast time in miliseconds
    torpedoBlastTime: parseFloat(urlParams.get('torpedoBlastTime') ?? '700'),
    torpedoBays: parseFloat(urlParams.get('torpedoBays') ?? '5'),
    // torpedo reload time in miliseconds
    torpedoReloadTime: parseFloat(urlParams.get('torpedoReloadTime') ?? '1000'),
    enemyShipCount: parseFloat(urlParams.get('enemyShipCount') ?? '4'),
}
