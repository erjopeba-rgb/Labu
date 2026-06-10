/**
 * text-classifier.js
 * Detecta rubro y tarea a partir de texto libre usando diccionario de palabras clave.
 * Labu — sin dependencias externas.
 */

const TextClassifier = (() => {

    // ─── Diccionario de palabras clave por rubro ───────────────────────────────
    // Cada entrada: array de strings. Se soportan frases compuestas (ej: "llave de paso").
    // El score se calcula por coincidencias únicas encontradas en el texto normalizado.
    const RUBROS_DICT = {
        construccion: {
            nombre: 'Construcción',
            icon: '🏗️',
            keywords: [
                // muy específicos (peso alto)
                'revoque', 'revocar', 'albanil', 'albanileria', 'hormigon', 'demolicion',
                'demoler', 'mamposteria', 'escombros', 'cimiento', 'cimientos', 'ladrillo',
                'ladrillos', 'mezcla', 'cemento', 'losa', 'tabique', 'encofrado',
                'contrapiso', 'frente de obra', 'medianera',
                // moderados
                'construccion', 'construir', 'edificar', 'reforma', 'ampliacion',
                'pared', 'muro', 'obra'
            ],
            // Tareas detectables para este rubro
            tasks: {
                reboque:     ['revoque', 'revocar', 'enlucido', 'frente'],
                albanileria: ['albanil', 'albanileria', 'ladrillo', 'mamposteria', 'muro'],
                hormigon:    ['hormigon', 'losa', 'encofrado', 'contrapiso', 'cimiento'],
                demolicion:  ['demolicion', 'demoler', 'escombros', 'tirar', 'derribar']
            }
        },
        electricidad: {
            nombre: 'Electricidad',
            icon: '⚡',
            keywords: [
                'electrico', 'electricista', 'electricidad', 'tablero', 'disyuntor',
                'fusible', 'tomacorriente', 'enchufe', 'cortocircuito', 'cable',
                'cableado', 'luminaria', 'led', 'interruptor', 'luz electrica',
                'instalacion electrica', 'voltaje', 'tension electrica', 'foco',
                'lampara', 'artefacto', 'monofasico', 'trifasico', 'amper',
                // moderados
                'iluminacion', 'luz', 'luces'
            ],
            tasks: {
                instalacion: ['instalacion', 'instalar', 'cableado', 'tablero'],
                reparacion:  ['reparacion', 'reparar', 'arreglar', 'falla', 'cortocircuito'],
                iluminacion: ['iluminacion', 'lampara', 'led', 'luminaria', 'foco'],
                tableros:    ['tablero', 'disyuntor', 'fusible', 'llave termica']
            }
        },
        plomeria: {
            nombre: 'Plomería',
            icon: '🔧',
            keywords: [
                'cano', 'caneria', 'canillas', 'plomero', 'plomeria', 'desague',
                'cloaca', 'inodoro', 'bidet', 'ducha', 'calefon', 'termotanque',
                'perdida de agua', 'goteo', 'destape', 'obstruccion', 'sifon',
                'valvula', 'llave de paso', 'filtracion', 'humedad',
                // moderados
                'canilla', 'agua', 'bano', 'pileta'
            ],
            tasks: {
                instalacion:  ['instalacion', 'instalar', 'caneria', 'cano'],
                reparacion:   ['reparacion', 'reparar', 'arreglar', 'perdida', 'goteo'],
                destapaciones:['destape', 'obstruccion', 'taponado', 'atascado', 'destapar'],
                calefaccion:  ['calefon', 'termotanque', 'calefaccion', 'radiador', 'caldera']
            }
        },
        pintura: {
            nombre: 'Pintura',
            icon: '🎨',
            keywords: [
                'pintura', 'pintar', 'pintor', 'rodillo', 'brocha', 'latex',
                'esmalte', 'empapelar', 'papel tapiz', 'lijar', 'imprimacion',
                'sellador', 'lacado', 'barniz', 'barnizar', 'revestimiento',
                'textura', 'estuco', 'masilla', 'enduido',
                // moderados
                'color', 'fachada', 'pared pintada'
            ],
            tasks: {
                interior:    ['interior', 'adentro', 'habitacion', 'salon', 'latex'],
                exterior:    ['exterior', 'fachada', 'frente', 'afuera'],
                lacado:      ['lacado', 'esmalte', 'barniz', 'barnizar', 'madera'],
                empapelado:  ['empapelar', 'papel tapiz', 'empapelado']
            }
        },
        carpinteria: {
            nombre: 'Carpintería',
            icon: '🪚',
            keywords: [
                'carpintero', 'carpinteria', 'madera', 'placard', 'estante',
                'estanteria', 'deck', 'tarima', 'parquet', 'laminado', 'ropero',
                'biblioteca', 'cajon', 'empotrado', 'bisagra', 'herraje',
                // moderados
                'mueble', 'puerta', 'ventana', 'porton', 'marco'
            ],
            tasks: {
                muebles:  ['mueble', 'mesa', 'silla', 'ropero', 'biblioteca', 'estante'],
                puertas:  ['puerta', 'porton', 'marco', 'bisagra', 'herraje'],
                ventanas: ['ventana', 'ventanal', 'marco'],
                deck:     ['deck', 'tarima', 'parquet', 'laminado']
            }
        },
        jardineria: {
            nombre: 'Jardinería',
            icon: '🌱',
            keywords: [
                'jardinero', 'jardineria', 'cesped', 'pasto', 'poda', 'tala',
                'paisajismo', 'riego', 'plantacion', 'transplante', 'maceta',
                'abono', 'fertilizante', 'hierba', 'maleza', 'huerta', 'arbol',
                // moderados
                'jardin', 'planta', 'flor', 'parque'
            ],
            tasks: {
                mantenimiento: ['mantenimiento', 'mantener', 'limpiar', 'cortar', 'cesped'],
                poda:          ['poda', 'podar', 'tala', 'talar', 'arbol', 'ramas'],
                riego:         ['riego', 'regar', 'sistema de riego', 'aspersor'],
                paisajismo:    ['paisajismo', 'diseño', 'diseno', 'proyecto', 'paisaje']
            }
        },
        limpieza: {
            nombre: 'Limpieza',
            icon: '🧹',
            keywords: [
                'limpieza', 'limpiar', 'mucama', 'empleada', 'domestica',
                'desinfectar', 'desinfeccion', 'alfombra', 'tapizado', 'sillon',
                'vidrios', 'aspirar', 'barrer', 'trapear', 'lustrar',
                // moderados
                'limpio', 'orden', 'ordenar'
            ],
            tasks: {
                domestica:  ['domestica', 'mucama', 'empleada', 'hogar', 'casa'],
                obra:       ['obra', 'escombros', 'polvo', 'construccion'],
                vidrios:    ['vidrio', 'ventana', 'cristal', 'espejo'],
                tapizados:  ['tapizado', 'sillon', 'sofa', 'alfombra', 'tapizeria']
            }
        },
        artista: {
            nombre: 'Artista',
            icon: '🎭',
            keywords: [
                'musico', 'musica', 'cantar', 'cantante', 'fotografo', 'fotografia',
                'disenador', 'ilustrador', 'ilustracion', 'animacion', 'actuacion',
                'teatro', 'edicion de video', 'edicion', 'banda', 'dj', 'sonido',
                // moderados
                'foto', 'diseno', 'dibujo', 'video', 'artista'
            ],
            tasks: {
                musica:      ['musica', 'musico', 'cantar', 'cantante', 'banda', 'dj'],
                fotografia:  ['fotografia', 'fotografo', 'foto', 'sesion'],
                diseno:      ['diseno', 'disenador', 'ilustracion', 'grafico'],
                video:       ['video', 'edicion', 'filmacion', 'animacion']
            }
        }
    };

    // ─── Normalización ─────────────────────────────────────────────────────────
    function normalize(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
            .replace(/[^a-z0-9\s]/g, ' ')      // quitar puntuación
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ─── Scoring ───────────────────────────────────────────────────────────────
    function scoreRubro(normalizedText, rubroKey) {
        const rubro = RUBROS_DICT[rubroKey];
        let score = 0;
        const matched = [];

        for (const kw of rubro.keywords) {
            const normKw = normalize(kw);
            // Coincidencia de frase completa (más seguro con word boundary manual)
            const pattern = new RegExp(`(?:^|\\s)${normKw}(?:\\s|$)`);
            if (pattern.test(normalizedText) || normalizedText.includes(normKw)) {
                score++;
                matched.push(kw);
            }
        }
        return { score, matched };
    }

    function detectTask(normalizedText, rubroKey) {
        const rubro = RUBROS_DICT[rubroKey];
        if (!rubro.tasks) return null;

        let bestTask = null;
        let bestScore = 0;

        for (const [taskKey, taskKws] of Object.entries(rubro.tasks)) {
            let s = 0;
            for (const kw of taskKws) {
                if (normalizedText.includes(normalize(kw))) s++;
            }
            if (s > bestScore) {
                bestScore = s;
                bestTask = taskKey;
            }
        }
        return bestScore > 0 ? bestTask : null;
    }

    // ─── API pública ───────────────────────────────────────────────────────────
    /**
     * Analiza texto y devuelve el rubro más probable.
     * @param {string} text - Texto libre (título + descripción)
     * @returns {{ rubroKey, nombre, icon, score, task } | null}
     */
    function detect(text) {
        if (!text || text.trim().length < 3) return null;

        const norm = normalize(text);
        let best = null;
        let bestScore = 0;

        for (const rubroKey of Object.keys(RUBROS_DICT)) {
            const { score, matched } = scoreRubro(norm, rubroKey);
            if (score > bestScore) {
                bestScore = score;
                best = { rubroKey, matched };
            }
        }

        if (!best || bestScore === 0) return null;

        const rubro = RUBROS_DICT[best.rubroKey];
        const task  = detectTask(norm, best.rubroKey);

        return {
            rubroKey: best.rubroKey,
            nombre:   rubro.nombre,
            icon:     rubro.icon,
            score:    bestScore,
            task
        };
    }

    return { detect, normalize, RUBROS_DICT };
})();

window.TextClassifier = TextClassifier;
