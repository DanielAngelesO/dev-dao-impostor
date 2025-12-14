const apiKey = ""; // API Key injected by environment

// ==================== DATOS ====================
const HOUSE_DATA = {
    'Objetos Cotidianos': ['Cepillo de dientes', 'Microondas', 'Calcetín', 'Control remoto', 'Sartén', 'Inodoro', 'Espejo', 'Cargador'],
    'Famosos': ['Lionel Messi', 'Shakira', 'Elon Musk', 'Will Smith', 'Taylor Swift', 'Cristiano Ronaldo', 'La Roca', 'Donald Trump'],
    'Cantantes Cristianos': ['Marcos Witt', 'Jesús Adrián Romero', 'Lilly Goodman', 'Marcela Gándara', 'Alex Campos', 'Miel San Marcos', 'Redimi2', 'Barak'],
    'Personajes Bíblicos': ['Moisés', 'David', 'Pedro', 'Noé', 'Jonás', 'Sansón', 'Pablo', 'Eva', 'Judas', 'Goliat'],
    'Comida Callejera': ['Tacos', 'Hot Dog', 'Hamburguesa', 'Kebab', 'Empanada', 'Pizza', 'Churros', 'Arepa'],
    'Lugares': ['Hospital', 'Aeropuerto', 'Cimematógrafo', 'Iglesia', 'Cementerio', 'Gimnasio', 'Playa', 'Cárcel'],
    'Excusas para llegar tarde': ['Había tráfico', 'Se murió mi pez', 'No sonó la alarma', 'Me sentía mal', 'Perdí las llaves'],
    'Superhéroes': ['Batman', 'Spiderman', 'Iron Man', 'Hulk', 'Wonder Woman', 'Thor', 'Superman']
};

const START_RULES = [
    "El jugador más joven empieza.",
    "El que tenga menos batería en el celular empieza.",
    "El que tenga los pies más grandes empieza.",
    "El último que haya ido al baño empieza.",
    "El que haya dormido más horas hoy empieza.",
    "El que tenga más monedas en el bolsillo empieza.",
    "El que tenga la foto de perfil más rara empieza.",
    "El que esté usando más colores en su ropa empieza."
];

// ==================== ESTADO GLOBAL ====================
const GameState = {
    players: [], // { id, name, isImpostor, isLost, seenRole }
    config: {
        mode: null, // 'house', 'custom', 'mixed', 'ai'
        selectedCategory: null,
        customWords: [],
        impostorCount: 1,
        mixPercentage: 50,
        hasLostCharacter: false
    },
    currentSecretWord: '',
    currentCategoryName: '',
    startRule: ''
};

// ==================== HELPER API GEMINI ====================
async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Error en API');
        
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
        console.error("Gemini Error:", error);
        return null;
    }
}

// ==================== LÓGICA DE LA APP ====================
const App = {
    init: () => {
        App.renderCategories();
        App.renderPlayerInputs(3);
    },

    // --- NAVEGACIÓN ---
    showScreen: (screenId) => {
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        window.scrollTo(0, 0);
    },

    goToConfig: () => {
        App.showScreen('screen-config');
    },

    backToModeSelect: () => {
        document.getElementById('config-step-1').classList.remove('hidden');
        document.getElementById('config-step-custom').classList.add('hidden');
        document.getElementById('config-step-categories').classList.add('hidden');
        document.getElementById('config-step-players').classList.add('hidden');
        document.getElementById('config-step-ai').classList.add('hidden');
    },

    // --- CONFIGURACIÓN ---
    selectMode: (mode) => {
        GameState.config.mode = mode;
        document.getElementById('config-step-1').classList.add('hidden');
        document.getElementById('mixed-slider-container').classList.add('hidden');

        if (mode === 'custom') {
            document.getElementById('config-step-custom').classList.remove('hidden');
        } else if (mode === 'mixed') {
            document.getElementById('config-step-custom').classList.remove('hidden');
            document.getElementById('mixed-slider-container').classList.remove('hidden');
        } else if (mode === 'house') {
            document.getElementById('config-step-categories').classList.remove('hidden');
        } else if (mode === 'ai') {
            document.getElementById('config-step-ai').classList.remove('hidden');
        }
    },

    updateMixDisplay: (val) => {
        GameState.config.mixPercentage = parseInt(val);
        document.getElementById('mix-percent-display').innerText = `${val}% Mías`;
    },

    // --- GEMINI: GENERACIÓN DE PALABRAS ---
    generateAIWords: async () => {
        const topic = document.getElementById('ai-topic-input').value.trim();
        const btn = document.getElementById('btn-generate-ai');
        const errorMsg = document.getElementById('ai-error-msg');
        
        if (topic.length < 3) {
            errorMsg.innerText = "Por favor escribe un tema más largo.";
            errorMsg.classList.remove('hidden');
            return;
        }

        // Loading State
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="loader"></span> Generando...`;
        btn.disabled = true;
        errorMsg.classList.add('hidden');

        const prompt = `Genera una lista JSON de 12 palabras o conceptos cortos relacionados con la temática: "${topic}". La lista debe estar en español. Formato estrictamente JSON array de strings: ["Palabra1", "Palabra2"...]. No uses markdown.`;

        const result = await callGemini(prompt);

        // Reset button
        btn.innerHTML = originalText;
        btn.disabled = false;

        if (result) {
            try {
                const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
                const words = JSON.parse(cleanJson);
                
                if (Array.isArray(words) && words.length > 0) {
                    GameState.config.customWords = words;
                    GameState.config.selectedCategory = `✨ IA: ${topic}`;
                    document.getElementById('config-step-ai').classList.add('hidden');
                    App.showPlayerSetup();
                } else {
                    throw new Error("Formato inválido");
                }
            } catch (e) {
                errorMsg.innerText = "La IA se confundió. Intenta otro tema.";
                errorMsg.classList.remove('hidden');
            }
        } else {
            errorMsg.innerText = "Error de conexión con la IA.";
            errorMsg.classList.remove('hidden');
        }
    },

    confirmCustomWords: () => {
        const input = document.getElementById('custom-words-input').value;
        const words = input.split(',').map(w => w.trim()).filter(w => w.length > 0);
        
        if (words.length < 2) {
            alert("Por favor ingresa al menos 2 palabras o conceptos.");
            return;
        }

        GameState.config.customWords = words;
        App.showPlayerSetup();
    },

    renderCategories: () => {
        const list = document.getElementById('categories-list');
        list.innerHTML = '';
        Object.keys(HOUSE_DATA).forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'bg-gray-800 p-3 rounded-lg text-sm font-bold hover:bg-purple-900 border border-gray-700 text-left transition-colors';
            btn.innerText = cat;
            btn.onclick = () => App.selectCategory(cat);
            list.appendChild(btn);
        });
        
        // Botón Aleatorio
        const randomBtn = document.createElement('button');
        randomBtn.className = 'bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-lg text-sm font-bold text-white col-span-2 text-center';
        randomBtn.innerText = '🎲 Aleatorio';
        randomBtn.onclick = () => App.selectCategory('random');
        list.appendChild(randomBtn);
    },

    selectCategory: (catKey) => {
        if (catKey === 'random') {
            const keys = Object.keys(HOUSE_DATA);
            catKey = keys[Math.floor(Math.random() * keys.length)];
        }
        GameState.config.selectedCategory = catKey;
        
        document.getElementById('config-step-categories').classList.add('hidden');
        document.getElementById('config-step-custom').classList.add('hidden');
        App.showPlayerSetup();
    },

    showPlayerSetup: () => {
        document.getElementById('config-step-players').classList.remove('hidden');
        document.getElementById('config-step-players').style.display = 'flex';
    },

    // --- GESTIÓN DE JUGADORES ---
    playerCount: 3,
    
    adjustPlayerCount: (delta) => {
        const newVal = App.playerCount + delta;
        if (newVal >= 3 && newVal <= 12) {
            App.playerCount = newVal;
            document.getElementById('player-count-display').innerText = newVal;
            App.renderPlayerInputs(newVal);
            
            // Ajustar slider de impostores si excede max
            const maxImpostors = Math.floor(newVal / 2);
            const slider = document.getElementById('impostor-slider');
            slider.max = maxImpostors;
            if (slider.value > maxImpostors) {
                slider.value = maxImpostors;
                App.updateImpostorCount(maxImpostors);
            }
        }
    },

    updateImpostorCount: (val) => {
        GameState.config.impostorCount = parseInt(val);
        document.getElementById('impostor-count-display').innerText = val;
    },

    renderPlayerInputs: (count) => {
        const container = document.getElementById('players-inputs');
        const currentInputs = container.querySelectorAll('input');
        const existingNames = Array.from(currentInputs).map(i => i.value);

        container.innerHTML = '';
        
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'flex items-center';
            const icon = document.createElement('span');
            icon.className = 'mr-3 text-gray-500';
            icon.innerText = `👤 ${i + 1}`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none';
            input.placeholder = `Jugador ${i + 1}`;
            input.value = existingNames[i] || '';
            input.id = `player-input-${i}`;

            div.appendChild(icon);
            div.appendChild(input);
            container.appendChild(div);
        }
    },

    // --- LÓGICA DE PARTIDA ---
    startGame: () => {
        // 1. Recolectar nombres
        GameState.players = [];
        const hasLostChar = document.getElementById('lost-mode-toggle').checked;
        GameState.config.hasLostCharacter = hasLostChar;

        // Validación de cantidad de jugadores para Lost mode
        // Necesitamos: Impostores + 1 Lost + 1 Ciudadano mínimo
        const minForLost = GameState.config.impostorCount + 2;
        if (hasLostChar && App.playerCount < minForLost) {
            alert(`Para jugar con "Personaje Perdido" necesitas al menos ${minForLost} jugadores.`);
            return;
        }

        for (let i = 0; i < App.playerCount; i++) {
            const nameInput = document.getElementById(`player-input-${i}`).value.trim();
            GameState.players.push({
                id: i,
                name: nameInput || `Jugador ${i + 1}`,
                isImpostor: false,
                isLost: false,
                seenRole: false
            });
        }

        // 2. Seleccionar palabra
        let wordPool = [];
        let categoryDisplay = '';

        if (GameState.config.mode === 'house') {
            wordPool = HOUSE_DATA[GameState.config.selectedCategory];
            categoryDisplay = GameState.config.selectedCategory;
        } else if (GameState.config.mode === 'custom' || GameState.config.mode === 'ai') {
            wordPool = GameState.config.customWords;
            categoryDisplay = GameState.config.selectedCategory || 'Personalizada';
        } else if (GameState.config.mode === 'mixed') {
            // Lógica de porcentaje
            const useMyWords = Math.random() * 100 < GameState.config.mixPercentage;
            
            if (useMyWords) {
                wordPool = GameState.config.customWords;
                categoryDisplay = 'Mix: Personalizada';
            } else {
                const houseCatKeys = Object.keys(HOUSE_DATA);
                const randomCat = houseCatKeys[Math.floor(Math.random() * houseCatKeys.length)];
                wordPool = HOUSE_DATA[randomCat];
                categoryDisplay = `Mix: ${randomCat}`;
            }
        }

        const secretWord = wordPool[Math.floor(Math.random() * wordPool.length)];
        GameState.currentSecretWord = secretWord;
        GameState.currentCategoryName = categoryDisplay;
        GameState.startRule = START_RULES[Math.floor(Math.random() * START_RULES.length)];

        // 3. Asignar Roles (Impostor y Perdido)
        const indices = Array.from({length: App.playerCount}, (_, i) => i);
        // Shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // Asignar Impostores
        const impostorIndices = indices.slice(0, GameState.config.impostorCount);
        impostorIndices.forEach(idx => {
            GameState.players[idx].isImpostor = true;
        });

        // Asignar Perdido (si aplica)
        if (hasLostChar) {
            // El siguiente índice después de los impostores
            const lostIndex = indices[GameState.config.impostorCount];
            GameState.players[lostIndex].isLost = true;
        }

        App.renderRoleCards();
        // Actualizar regla de inicio en UI
        document.getElementById('start-rule-text').innerText = GameState.startRule;
        App.showScreen('screen-roles');
    },

    renderRoleCards: () => {
        const container = document.getElementById('cards-container');
        container.innerHTML = '';

        const allSeen = GameState.players.every(p => p.seenRole);
        
        if (allSeen) {
            const btn = document.createElement('button');
            btn.className = 'col-span-2 mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg animate-pulse';
            btn.innerText = '¡Todos listos! Iniciar >>';
            btn.onclick = () => App.showScreen('screen-round-start');
            container.appendChild(btn);
            return;
        }

        GameState.players.forEach(p => {
            const card = document.createElement('button');
            card.className = `player-card w-full aspect-square rounded-2xl flex flex-col items-center justify-center p-4 border-2 shadow-lg relative overflow-hidden ${p.seenRole ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-indigo-900 to-purple-900 border-purple-500 text-white cursor-pointer'}`;
            
            if (p.seenRole) {
                card.innerHTML = `<span class="text-3xl mb-2">✅</span><span class="font-bold text-sm line-through">${p.name}</span>`;
                card.disabled = true;
            } else {
                card.innerHTML = `<span class="text-4xl mb-2">🃏</span><span class="font-bold text-lg">${p.name}</span><span class="text-xs text-purple-300 mt-1">Toca para ver</span>`;
                card.onclick = () => App.openRevealOverlay(p.id);
            }
            
            container.appendChild(card);
        });
    },

    // --- REVELACIÓN INDIVIDUAL ---
    currentRevealId: null,
    timerInterval: null,

    openRevealOverlay: (playerId) => {
        App.currentRevealId = playerId;
        const player = GameState.players[playerId];
        
        document.getElementById('reveal-player-name').innerText = player.name;
        document.getElementById('role-reveal-overlay').classList.remove('hidden');
        document.getElementById('role-reveal-overlay').classList.add('flex');
        
        document.getElementById('reveal-step-confirm').classList.remove('hidden');
        document.getElementById('reveal-step-content').classList.add('hidden');
    },

    closeRevealOverlay: () => {
        document.getElementById('role-reveal-overlay').classList.add('hidden');
        document.getElementById('role-reveal-overlay').classList.remove('flex');
        if (App.timerInterval) clearInterval(App.timerInterval);
    },

    showSecretRole: () => {
        document.getElementById('reveal-step-confirm').classList.add('hidden');
        document.getElementById('reveal-step-content').classList.remove('hidden');
        document.getElementById('reveal-step-content').classList.add('flex');

        const player = GameState.players[App.currentRevealId];
        const titleEl = document.getElementById('role-title');
        const wordEl = document.getElementById('role-word');
        const subtitleEl = document.getElementById('role-subtitle');
        const iconEl = document.getElementById('role-icon');

        if (player.isImpostor) {
            titleEl.innerText = "¡ERES EL IMPOSTOR!";
            titleEl.className = "text-3xl font-black mb-4 uppercase text-red-500 animate-pulse";
            wordEl.innerText = "🤫 Finge que sabes.";
            wordEl.className = "text-xl font-bold text-gray-400";
            subtitleEl.innerText = "TU MISIÓN: ENGAÑARLOS";
            iconEl.innerText = "😈";
        } else if (player.isLost) {
            titleEl.innerText = "¡ESTÁS PERDIDO!";
            titleEl.className = "text-3xl font-black mb-4 uppercase text-yellow-400 animate-bounce";
            wordEl.innerText = "😵‍💫 No sabes nada.";
            wordEl.className = "text-xl font-bold text-gray-400";
            subtitleEl.innerText = "NO ERES IMPOSTOR, PERO...";
            iconEl.innerText = "😵‍💫";
        } else {
            titleEl.innerText = "¡CONFIRMADO!";
            titleEl.className = "text-3xl font-black mb-4 uppercase text-green-400";
            wordEl.innerText = GameState.currentSecretWord;
            wordEl.className = "text-3xl font-bold text-white";
            subtitleEl.innerText = "ERES UNO DE LOS BUENOS";
            iconEl.innerText = "😇";
        }

        const bar = document.getElementById('role-timer-bar');
        bar.style.width = '100%';
        
        let timeLeft = 5;
        setTimeout(() => { bar.style.width = '0%'; }, 100);

        App.timerInterval = setTimeout(() => {
            App.hideSecretRole();
        }, 5000);
    },

    hideSecretRole: () => {
        if (App.timerInterval) clearTimeout(App.timerInterval);
        GameState.players[App.currentRevealId].seenRole = true;
        App.closeRevealOverlay();
        App.renderRoleCards();
    },

    // --- IN GAME & AI HINT ---
    goToGame: () => {
        App.showScreen('screen-game');
    },

    generateInGameQuestion: async () => {
        const btn = document.getElementById('btn-ai-hint');
        const contentDiv = document.getElementById('ai-hint-content');
        const modal = document.getElementById('ai-hint-modal');
        
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="loader"></span> Pensando...`;
        btn.disabled = true;

        const category = GameState.currentCategoryName;
        const prompt = `Juego: Spyfall/Impostor. Categoría: "${category}". Genera una sola pregunta corta, divertida e intrigante en español que un jugador podría hacerle a otro para ver si es el impostor. No digas la palabra secreta. La pregunta debe ser ambigua.`;

        const question = await callGemini(prompt);

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (question) {
            contentDiv.innerText = `"${question.trim()}"`;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            alert("La IA está durmiendo. Intenta de nuevo.");
        }
    },

    revealImpostor: () => {
        const impostors = GameState.players.filter(p => p.isImpostor).map(p => p.name).join(' y ');
        const lostOnes = GameState.players.filter(p => p.isLost).map(p => p.name);
        
        let resultText = impostors;
        if (lostOnes.length > 0) {
            // Si hubo personaje perdido, lo mostramos también en un mensaje aparte o junto
            // Simple por ahora:
        }
        
        document.getElementById('result-impostor-name').innerText = impostors;
        document.getElementById('result-secret-word').innerText = GameState.currentSecretWord;
        document.getElementById('result-category').innerText = `Categoría: ${GameState.currentCategoryName}`;
        
        App.showScreen('screen-reveal');
    },

    restartGame: (sameConfig) => {
        if (sameConfig) {
            // Si estamos en modo AI, usar la misma lista generada
            App.startGame();
        } else {
            App.goToConfig();
            document.getElementById('config-step-players').classList.add('hidden');
            document.getElementById('config-step-1').classList.remove('hidden');
            // Reset inputs
            document.getElementById('ai-topic-input').value = '';
        }
    }
};

window.onload = App.init;