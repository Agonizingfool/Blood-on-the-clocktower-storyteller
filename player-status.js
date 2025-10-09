// ===== player-status.js =====
// Handles rendering of UI components related to player alive/dead status.

import { cardUrlFor } from './utils.js';

/**
 * Renders the list of players in the Player Pool card, with status indicators.
 * @param {HTMLElement} container - The element to render the list into.
 * @param {Map<string, object>} playerPool - The map of player data.
 * @param {string|null} [monkProtectedPlayer=null] - The name of the player protected by the Monk.
 */
export function renderPlayerManager(container, playerPool, monkProtectedPlayer = null) {
    container.innerHTML = ''; // Clear existing tags
    if (!playerPool || playerPool.size === 0) return;

    playerPool.forEach((player, name) => {
        const tag = document.createElement('div');
        tag.className = 'player-tag';
        tag.dataset.name = name;
        tag.title = `Click to toggle status for ${name}`;

        if (!player.isAlive) {
            tag.classList.add('dead');
        }

        // Add indicators for Drunk, Dead, and Protected status
        const protectedIndicator = monkProtectedPlayer === name ? '✝️ ' : '';
        const drunkIndicator = player.isDrunk ? '🍺 ' : '';
        const deadIndicator = player.isAlive ? '' : '☠️ ';
        let content = `<span>${protectedIndicator}${drunkIndicator}${deadIndicator}${name}</span>`;

        if (player.assignedRole) {
            content += `<img src="${cardUrlFor(player.assignedRole)}" class="assigned-role-token" alt="${player.assignedRole}" title="${player.assignedRole}">`;
        }

        content += `<button class="remove-player-btn" data-name="${name}" title="Remove ${name}">×</button>`;
        tag.innerHTML = content;
        container.appendChild(tag);
    });
}