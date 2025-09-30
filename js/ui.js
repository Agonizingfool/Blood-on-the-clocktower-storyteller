// ===== ui.js =====
// Handles all rendering and direct DOM manipulation.

import { qs, qsa } from './utils.js';

/** Renders the initial role selection form. */
export function renderRoleForm(formElement, data) {
    const byTeam = {
        Townsfolk: data.roles.filter(r => r.team === "Townsfolk"),
        Outsider: data.roles.filter(r => r.team === "Outsider"),
        Minion: data.roles.filter(r => r.team === "Minion"),
        Demon: data.roles.filter(r => r.team === "Demon")
    };
    
    // ... (rest of the renderRoleForm logic from your original app.js) ...
    // Note: This function remains largely the same as in your original file.
    // Ensure you copy the complete function logic here.
    const towns = data.roles.filter(r => r.team === "Townsfolk").map(r => r.name);
    const outsiders = data.roles.filter(r => r.team === "Outsider").map(r => r.name);
    const minions = data.roles.filter(r => r.team === "Minion").map(r => r.name);
    
    formElement.innerHTML = ["Townsfolk", "Outsider", "Minion", "Demon"].map(team => `
      <fieldset>
        <legend>${team}</legend>
        ${byTeam[team].map(r => {
            let presetHtml = '';
            
            switch(r.name) {
                case "Washerwoman":
                    presetHtml = `<select id="presetWasherwomanRole" name="presetWasherwomanRole" class="role-preset-select" style="display: none;"><option value="">— select Townsfolk —</option>${towns.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Librarian":
                    presetHtml = `<select id="presetLibrarianRole" name="presetLibrarianRole" class="role-preset-select" style="display: none;"><option value="">— none (show 0) —</option>${outsiders.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Investigator":
                    presetHtml = `<select id="presetInvestigatorRole" name="presetInvestigatorRole" class="role-preset-select" style="display: none;"><option value="">— select Minion —</option>${minions.filter(opt => opt !== r.name).map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case "Chef":
                    presetHtml = `<input type="number" id="presetChefNumber" name="presetChefNumber" class="role-preset-select" style="display: none;" min="0" placeholder="#">`;
                    break;
            }
            
            const nameInputHtml = `<input type="text" class="player-name-input" data-role-name="${r.name}" placeholder="Player Name" style="display: none;">`;

            return `<div class="role-item"><label><input type="checkbox" name="role" value="${r.name}"> ${r.name}</label>${nameInputHtml}${presetHtml}</div>`;
        }).join("")}
      </fieldset>
    `).join("");

    // Set defaults and Imp behavior
    ["Imp", "Poisoner", "Washerwoman", "Librarian", "Investigator", "Chef", "Fortune Teller", "Empath"].forEach(v => {
        const cb = formElement.querySelector(`input[value="${CSS.escape(v)}"]`);
        if (cb) cb.checked = true;
    });

    const impCheckbox = formElement.querySelector(`input[value="Imp"]`);
    if (impCheckbox) {
        impCheckbox.checked = true;
        impCheckbox.disabled = true;
        impCheckbox.parentElement.style.cssText = "cursor: not-allowed; opacity: 0.6;";
        impCheckbox.parentElement.title = "The Imp is always in play.";
    }

    qsa('input[name="role"]', formElement).forEach(checkbox => {
        const parent = checkbox.closest('.role-item');
        const childrenToToggle = parent.querySelectorAll('.role-preset-select, .player-name-input');
        const toggleChildren = (show) => childrenToToggle.forEach(child => child.style.display = show ? 'inline-block' : 'none');
        toggleChildren(checkbox.checked);
        checkbox.addEventListener('change', (e) => toggleChildren(e.target.checked));
    });
}

/** Renders the night script steps into a list. */
export function renderList(listElement, listId, steps, rolesInPlay, playerNames, stepClickHandler) {
    listElement.innerHTML = "";
    steps.forEach((step, idx) => {
        if (!step.role || rolesInPlay.includes(step.role)) {
            const li = document.createElement("li");
            let roleDisplay = step.role;
            if (step.role && playerNames.has(step.role)) {
                roleDisplay = `${step.role} (${playerNames.get(step.role)})`;
            }
            li.innerHTML = (step.role && step.ask) ? `<strong>${roleDisplay}:</strong> ${step.ask}` : (step.text || step.role || "(step)");
            li.dataset.stepKey = `${listId}:${idx}`;
            li.addEventListener("click", () => stepClickHandler(listId, idx, step, li));
            listElement.appendChild(li);
        }
    });
}

// ... Add other UI functions here like:
// - renderValueDisplay
// - renderInfoList
// - buildPicker
// - goFullscreen / exitFullscreen
// - openTextCard / closeTextCard
// - openPicker / closePicker
// You would move the logic from your original file into these exported functions.