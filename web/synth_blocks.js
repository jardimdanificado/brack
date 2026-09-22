/**
 * =========================================================================
 * BRACK Modular Synth Blocks Definition (web/synth_blocks.js)
 * Clean Visual Blocks, Full List Operations, Math, Logic & Event Triggers
 * =========================================================================
 */

import { registerAllBlocksToBlockly } from './synth_registry.js';

export function registerSynthBlocks(Blockly) {
    // -------------------------------------------------------------------------
    // 1. VARIÁVEIS & LISTAS (#FF661A)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_var_set'] = {
        init: function() {
            this.appendValueInput("VAL")
                .appendField("definir [")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField("] para");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Armazena um sinal ou número na variável.");
        }
    };

    Blockly.Blocks['synth_var_change'] = {
        init: function() {
            this.appendValueInput("DELTA")
                .appendField("mudar [")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField("] por");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Acumulador: soma o valor à variável.");
        }
    };

    Blockly.Blocks['synth_var_mult'] = {
        init: function() {
            this.appendValueInput("FACTOR")
                .appendField("multiplicar [")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField("] por");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Multiplica o valor da variável por um fator.");
        }
    };

    Blockly.Blocks['synth_var_reset'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("zerar [")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour("#FF661A");
            this.setTooltip("Zera o valor da variável.");
        }
    };

    Blockly.Blocks['synth_var_get'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("(")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField(")");
            this.setOutput(true);
            this.setColour("#FF661A");
            this.setTooltip("Lê o valor ou sinal da variável.");
        }
    };

    // List Operations
    Blockly.Blocks['synth_list_set'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("definir lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("] para [")
                .appendField(new Blockly.FieldTextInput("0, 3, 7, 10, 12, 10, 7, 3"), "ITEMS")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour("#FF661A");
            this.setTooltip("Define todos os itens numéricos de uma lista.");
        }
    };

    Blockly.Blocks['synth_list_add'] = {
        init: function() {
            this.appendValueInput("ITEM")
                .appendField("adicionar");
            this.appendDummyInput()
                .appendField("à lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Adiciona um número ao final da lista.");
        }
    };

    Blockly.Blocks['synth_list_remove'] = {
        init: function() {
            this.appendValueInput("INDEX")
                .appendField("remover item");
            this.appendDummyInput()
                .appendField("da lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Remove um item da lista na posição do índice especificado.");
        }
    };

    Blockly.Blocks['synth_list_insert'] = {
        init: function() {
            this.appendValueInput("ITEM")
                .appendField("inserir");
            this.appendValueInput("INDEX")
                .appendField("na posição");
            this.appendDummyInput()
                .appendField("da lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Insere um elemento em uma posição específica da lista.");
        }
    };

    Blockly.Blocks['synth_list_replace'] = {
        init: function() {
            this.appendValueInput("INDEX")
                .appendField("substituir item");
            this.appendValueInput("ITEM")
                .appendField("da lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("] por");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Substitui o item da lista na posição especificada por um novo valor.");
        }
    };

    Blockly.Blocks['synth_list_clear'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("limpar lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour("#FF661A");
            this.setTooltip("Apaga todos os itens da lista.");
        }
    };

    Blockly.Blocks['synth_list_get_item'] = {
        init: function() {
            this.appendValueInput("INDEX")
                .appendField("item");
            this.appendDummyInput()
                .appendField("de [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Lê um item da lista pelo índice numérico (wrap circular automático).");
        }
    };

    Blockly.Blocks['synth_list_length'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("tamanho de [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setOutput(true);
            this.setColour("#FF661A");
            this.setTooltip("Retorna a quantidade de itens na lista.");
        }
    };

    Blockly.Blocks['synth_list_contains'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("] contém");
            this.appendValueInput("ITEM");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Retorna 1 se a lista contém o item, ou 0 caso contrário.");
        }
    };

    Blockly.Blocks['synth_list_find'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("posição de");
            this.appendValueInput("ITEM");
            this.appendDummyInput()
                .appendField("na lista [")
                .appendField(new Blockly.FieldTextInput("notas"), "LIST")
                .appendField("]");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#FF661A");
            this.setTooltip("Retorna o primeiro índice numérico onde o item aparece na lista.");
        }
    };

    // -------------------------------------------------------------------------
    // 2. BARRAMENTOS DE ÁUDIO LIVRES (#FF6680)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_send'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Transmitir para [")
                .appendField(new Blockly.FieldTextInput("meu_sinal"), "CHANNEL")
                .appendField("]");
            this.appendValueInput("IN")
                .appendField("Sinal (ou fluxo acima)");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(false);
            this.setColour("#FF6680");
            this.setTooltip("Transmite o sinal para um barramento livre nomeado (1-para-muitos).");
        }
    };

    Blockly.Blocks['synth_recv'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Barramento [")
                .appendField(new Blockly.FieldTextInput("meu_sinal"), "CHANNEL")
                .appendField("]");
            this.setOutput(true);
            this.setColour("#FF6680");
            this.setTooltip("Pílula de recepção. Lê o sinal do barramento nomeado.");
        }
    };

    // -------------------------------------------------------------------------
    // 3. EVENTOS & CLOCK (#FFBF00)
    // -------------------------------------------------------------------------
    Blockly.Blocks['event_whenflagclicked'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("quando Iniciar");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Inicia o motor modular de áudio quando a reprodução for acionada.");
        }
    };

    Blockly.Blocks['event_every'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("a cada")
                .appendField(new Blockly.FieldNumber(500, 1), "TIME")
                .appendField(new Blockly.FieldDropdown([
                    ["milissegundos (ms)", "ms"],
                    ["segundos (s)", "s"],
                    ["batidas (beats @ 120bpm)", "beats"],
                    ["pulsos de clock", "clocks"]
                ]), "UNIT");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Executa a pilha de blocos periodicamente a cada X tempo.");
        }
    };

    Blockly.Blocks['event_broadcast'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("transmitir evento [")
                .appendField(new Blockly.FieldTextInput("virada"), "EVENT")
                .appendField("]");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Dispara um evento nomeado para todos os blocos 'quando eu ouvir'.");
        }
    };

    Blockly.Blocks['event_whenbroadcastreceived'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("quando eu ouvir [")
                .appendField(new Blockly.FieldTextInput("virada"), "EVENT")
                .appendField("]");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Executa a pilha de blocos quando o evento for transmitido.");
        }
    };

    Blockly.Blocks['event_whenkeypressed'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("quando a tecla [")
                .appendField(new Blockly.FieldDropdown([
                    ["Espaço", "Space"],
                    ["Enter", "Enter"],
                    ["A (Dó / C)", "KeyA"],
                    ["W (Dó# / C#)", "KeyW"],
                    ["S (Ré / D)", "KeyS"],
                    ["E (Ré# / D#)", "KeyE"],
                    ["D (Mi / E)", "KeyD"],
                    ["F (Fá / F)", "KeyF"],
                    ["T (Fá# / F#)", "KeyT"],
                    ["G (Sol / G)", "KeyG"],
                    ["Y (Sol# / G#)", "KeyY"],
                    ["H (Lá / A)", "KeyH"],
                    ["U (Lá# / A#)", "KeyU"],
                    ["J (Si / B)", "KeyJ"],
                    ["K (Dó+1 / C5)", "KeyK"],
                    ["Qualquer Tecla", "any"]
                ]), "KEY")
                .appendField("] for pressionada");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Dispara a pilha de blocos quando a tecla for pressionada no teclado.");
        }
    };

    Blockly.Blocks['event_whencondition'] = {
        init: function() {
            this.appendValueInput("COND")
                .appendField("quando");
            this.appendDummyInput()
                .appendField("se tornar verdadeiro");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Dispara a pilha quando a condição passar de falso para verdadeiro.");
        }
    };

    Blockly.Blocks['event_whenclockpulse'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("quando Clock pulsar");
            this.appendValueInput("CLK")
                .appendField("Sinal Clock");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Dispara eventos e modulações a cada pulso do clock.");
        }
    };

    // -------------------------------------------------------------------------
    // 4. SEQUENCIADOR DE PASSOS (#59C059)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_seq'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Sequenciador de Passos");
            this.appendValueInput("CLK")
                .appendField("Clock Trigger (CV)");
            this.appendStatementInput("STEPS")
                .setCheck("NOTE")
                .appendField("Passos / Notas:");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setOutput(true, "VAL");
            this.setInputsInline(false);
            this.setColour("#59C059");
            this.setTooltip("Sequenciador modular aberto. Encaixe quantos blocos de notas desejar.");
        }
    };

    Blockly.Blocks['seq_note'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Nota")
                .appendField(new Blockly.FieldDropdown([
                    ["C (Dó)", "0"], ["C# / Db", "1"], ["D (Ré)", "2"], ["D# / Eb", "3"],
                    ["E (Mi)", "4"], ["F (Fá)", "5"], ["F# / Gb", "6"], ["G (Sol)", "7"],
                    ["G# / Ab", "8"], ["A (Lá)", "9"], ["A# / Bb", "10"], ["B (Si)", "11"]
                ]), "NOTE")
                .appendField("Oitava")
                .appendField(new Blockly.FieldNumber(0, -3, 3, 1), "OCTAVE")
                .appendField("Gate")
                .appendField(new Blockly.FieldDropdown([
                    ["Ativo (1)", "1"],
                    ["Tie (Ligado)", "2"],
                    ["Mudo (0)", "0"]
                ]), "GATE");
            this.setPreviousStatement(true, "NOTE");
            this.setNextStatement(true, "NOTE");
            this.setColour("#1dd1a1");
            this.setTooltip("Passo de nota musical. Conecte em sequência.");
        }
    };

    Blockly.Blocks['seq_rest'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("Pausa / Silêncio");
            this.setPreviousStatement(true, "NOTE");
            this.setNextStatement(true, "NOTE");
            this.setColour("#8395a7");
            this.setTooltip("Passo de pausa silenciosa na sequência.");
        }
    };

    // -------------------------------------------------------------------------
    // 5. OPERADORES MATEMÁTICOS & CV (#59C059)
    // -------------------------------------------------------------------------
    Blockly.Blocks['math_number'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldNumber(0), "NUM");
            this.setOutput(true);
            this.setColour("#59C059");
            this.setTooltip("Número ou voltagem constante.");
        }
    };

    Blockly.Blocks['math_arithmetic'] = {
        init: function() {
            this.appendValueInput("A");
            this.appendDummyInput()
                .appendField(new Blockly.FieldDropdown([
                    ["+", "ADD"],
                    ["-", "MINUS"],
                    ["*", "MULTIPLY"],
                    ["/", "DIVIDE"],
                    ["mod", "MOD"],
                    ["^ (potência)", "POW"],
                    ["min", "MIN"],
                    ["max", "MAX"]
                ]), "OP");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Operação matemática entre dois sinais ou valores.");
        }
    };

    Blockly.Blocks['math_map'] = {
        init: function() {
            this.appendValueInput("VAL")
                .appendField("mapear");
            this.appendDummyInput()
                .appendField("de [")
                .appendField(new Blockly.FieldNumber(0), "IN_MIN")
                .appendField("..")
                .appendField(new Blockly.FieldNumber(1), "IN_MAX")
                .appendField("] para [")
                .appendField(new Blockly.FieldNumber(200), "OUT_MIN")
                .appendField("..")
                .appendField(new Blockly.FieldNumber(2000), "OUT_MAX")
                .appendField("]");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Mapeia a escala de um sinal de entrada para um intervalo de saída.");
        }
    };

    Blockly.Blocks['math_single'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldDropdown([
                    ["sen", "SIN"],
                    ["cos", "COS"],
                    ["tan", "TAN"],
                    ["tanh (saturação)", "TANH"],
                    ["abs", "ABS"],
                    ["inverter (-)", "NEG"],
                    ["raiz quadrada", "SQRT"],
                    ["arredondar", "ROUND"],
                    ["piso (floor)", "FLOOR"],
                    ["teto (ceil)", "CEIL"],
                    ["limitar [0..1]", "CLAMP01"]
                ]), "OP");
            this.appendValueInput("NUM")
                .appendField("de");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Função matemática avançada sobre um sinal.");
        }
    };

    Blockly.Blocks['math_random'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("número aleatório entre")
                .appendField(new Blockly.FieldNumber(0), "FROM")
                .appendField("e")
                .appendField(new Blockly.FieldNumber(1), "TO");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Gera um número aleatório (ruído de controle).");
        }
    };

    Blockly.Blocks['logic_compare_cv'] = {
        init: function() {
            this.appendValueInput("A");
            this.appendDummyInput()
                .appendField(new Blockly.FieldDropdown([
                    [">", "GT"],
                    ["<", "LT"],
                    ["=", "EQ"],
                    [">=", "GTE"],
                    ["<=", "LTE"],
                    ["!=", "NEQ"]
                ]), "OP");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Compara dois sinais e gera um Gate (1 ou 0).");
        }
    };

    Blockly.Blocks['control_if_else'] = {
        init: function() {
            this.appendValueInput("COND")
                .appendField("se");
            this.appendValueInput("THEN")
                .appendField("então");
            this.appendValueInput("ELSE")
                .appendField("senão");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#FFAB19");
            this.setTooltip("Seletor condicional: se a condição for verdadeira (> 0.5), emite o sinal 'então', senão o sinal 'senão'.");
        }
    };

    Blockly.Blocks['logic_and'] = {
        init: function() {
            this.appendValueInput("A");
            this.appendDummyInput().appendField("e");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Porta lógica E: retorna 1 se ambos os sinais forem ativos (> 0.5).");
        }
    };

    Blockly.Blocks['logic_or'] = {
        init: function() {
            this.appendValueInput("A");
            this.appendDummyInput().appendField("ou");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Porta lógica OU: retorna 1 se pelo menos um dos sinais for ativo (> 0.5).");
        }
    };

    Blockly.Blocks['logic_not'] = {
        init: function() {
            this.appendValueInput("A").appendField("não");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Porta lógica NÃO: inverte o sinal de controle.");
        }
    };

    Blockly.Blocks['logic_xor'] = {
        init: function() {
            this.appendValueInput("A");
            this.appendDummyInput().appendField("xor");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Porta lógica OU Exclusivo (XOR).");
        }
    };

    Blockly.Blocks['math_note_to_hz'] = {
        init: function() {
            this.appendValueInput("NOTE")
                .appendField("nota MIDI");
            this.appendDummyInput()
                .appendField("para Hz");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#40C057");
            this.setTooltip("Converte número de nota MIDI (ex: 60 = Dó4) em Hertz.");
        }
    };

    Blockly.Blocks['math_note_name'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("nota musical [")
                .appendField(new Blockly.FieldTextInput("C4"), "NOTE")
                .appendField("]");
            this.setOutput(true);
            this.setColour("#40C057");
            this.setTooltip("Nota musical (ex: C4, Eb3, F#4, Sol4). Converte para valor numérico MIDI.");
        }
    };

    Blockly.Blocks['math_note_convert'] = {
        init: function() {
            this.appendValueInput("NOTE")
                .appendField("converter nota");
            this.appendDummyInput()
                .appendField("para")
                .appendField(new Blockly.FieldDropdown([
                    ["Frequência (Hz)", "HZ"],
                    ["Número MIDI (0..127)", "MIDI"],
                    ["Volts V/Oct (1V/8va)", "VOCT"]
                ]), "TARGET");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#40C057");
            this.setTooltip("Converte notas musicais em Hertz, MIDI ou V/Oct para osciladores e filtros.");
        }
    };

    Blockly.Blocks['math_transpose'] = {
        init: function() {
            this.appendValueInput("NOTE")
                .appendField("transpor");
            this.appendDummyInput()
                .appendField("por")
                .appendField(new Blockly.FieldNumber(0, -48, 48, 1), "SEMITONES")
                .appendField("semitons");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#40C057");
            this.setTooltip("Transpõe uma nota musical ou voltagem por semitons.");
        }
    };

    // -------------------------------------------------------------------------
    // 6. REGISTRAR TODOS OS MÓDULOS UNIFICADOS (VCO, VCF, VCA, LFO, ADSR, ETC.)
    // -------------------------------------------------------------------------
    registerAllBlocksToBlockly(Blockly);
}
