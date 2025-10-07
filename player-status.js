// ===== player-status.js =====
// Handles rendering of UI components related to player alive/dead status.

// ADDED: Import the cardUrlFor utility to get token image paths
import { cardUrlFor } from './utils.js';

/**
 * Renders the list of players in the Player Pool card, with status indicators.
 * @param {HTMLElement} container - The element to render the list into.
 * @param {Map<string, object>} playerPool - The map of player data.
 */
export function renderPlayerManager(container, playerPool) {
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

        let content = `<span>${player.isAlive ? '' : '☠️ '}${name}</span>`;
        
        // MODIFIED: Instead of text, add an image tag for the assigned role token.
        if (player.assignedRole) {
            content += `<img src="${cardUrlFor(player.assignedRole)}" class="assigned-role-token" alt="${player.assignedRole}" title="${player.assignedRole}">`;
        }
        
        // The remove button is kept separate from the toggle logic
        content += `<button class="remove-player-btn" data-name="${name}" title="Remove ${name}">×</button>`;
        tag.innerHTML = content;
        container.appendChild(tag);
    });
}