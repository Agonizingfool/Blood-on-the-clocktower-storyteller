// Data for character counts based on the number of players
export const characterCountsData = { // EXPORTED FOR ACCESS IN UI.JS
    5: { Townsfolk: 3, Outsiders: 0, Minions: 1, Demons: 1 },
    6: { Townsfolk: 3, Outsiders: 1, Minions: 1, Demons: 1 },
    7: { Townsfolk: 5, Outsiders: 0, Minions: 1, Demons: 1 },
    8: { Townsfolk: 5, Outsiders: 1, Minions: 1, Demons: 1 },
    9: { Townsfolk: 5, Outsiders: 2, Minions: 1, Demons: 1 },
    10: { Townsfolk: 7, Outsiders: 0, Minions: 2, Demons: 1 },
    11: { Townsfolk: 7, Outsiders: 1, Minions: 2, Demons: 1 },
    12: { Townsfolk: 7, Outsiders: 2, Minions: 2, Demons: 1 },
    13: { Townsfolk: 9, Outsiders: 0, Minions: 3, Demons: 1 },
    14: { Townsfolk: 9, Outsiders: 1, Minions: 3, Demons: 1 },
    15: { Townsfolk: 9, Outsiders: 2, Minions: 3, Demons: 1 }
};

// Function to update the character count display
export function updateCharacterCountDisplay(playerCount) {
    const displayContainer = document.getElementById('character-counts-display');
    if (!displayContainer) return;

    // Determine the counts to use (15+ uses the data for 15)
    const counts = characterCountsData[Math.min(playerCount, 15)];

    if (!counts) {
        displayContainer.innerHTML = ''; // Clear display if no data
        return;
    }

    displayContainer.innerHTML = `
        <div class="count-display-item townsfolk">
            <div class="role-type">Townsfolk</div>
            <div class="role-count">${counts.Townsfolk}</div>
        </div>
        <div class="count-display-item outsiders">
            <div class="role-type">Outsiders</div>
            <div class="role-count">${counts.Outsiders}</div>
        </div>
        <div class="count-display-item minions">
            <div class="role-type">Minions</div>
            <div class="role-count">${counts.Minions}</div>
        </div>
        <div class="count-display-item demons">
            <div class="role-type">Demons</div>
            <div class="role-count">${counts.Demons}</div>
        </div>
    `;
}