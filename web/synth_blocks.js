/**
 * =========================================================================
 * BRACK Unlimited Scratch Modular Synth Blocks (web/synth_blocks.js)
 * Free-Text Buses, Open-Expression Parameters, Math Operators & Chained Sequencer
 * =========================================================================
 */

import { registerAllBlocksToBlockly } from './synth_registry.js';

export function registerSynthBlocks(Blockly) {
    // -------------------------------------------------------------------------
    // 📦 1. VARIÁVEIS & LISTAS (#FF661A)
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
            this.setTooltip("Acumulador: soma o valor à variável a cada execução.");
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
            this.setTooltip("Multiplica o valor da variável por um fator (ganho / atenuação).");
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
            this.setTooltip("Pílula que lê o valor ou sinal da variável.");
        }
    };

    // 📋 Listas / Vetores
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

    // -------------------------------------------------------------------------
    // 📡 2. BARRAMENTOS DE ÁUDIO LIVRES (#FF6680)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_send'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📡 Transmitir para [")
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
                .appendField("📻 [")
                .appendField(new Blockly.FieldTextInput("meu_sinal"), "CHANNEL")
                .appendField("]");
            this.setOutput(true);
            this.setColour("#FF6680");
            this.setTooltip("Pílula de recepção. Lê o sinal do barramento nomeado.");
        }
    };

    // -------------------------------------------------------------------------
    // 🚩 2. EVENTOS & HAT BLOCKS (#FFBF00)
    // -------------------------------------------------------------------------
    Blockly.Blocks['event_whenflagclicked'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚩 quando 🟢 for clicado");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Inicia o motor modular de áudio quando a bandeira verde for clicada.");
        }
    };

    Blockly.Blocks['event_every'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⏱️ a cada")
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
                .appendField("📢 transmitir evento [")
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
                .appendField("👂 quando eu ouvir [")
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
                .appendField("⌨️ quando a tecla [")
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
            this.setTooltip("Dispara a pilha de blocos quando a tecla do teclado for pressionada.");
        }
    };

    Blockly.Blocks['event_whencondition'] = {
        init: function() {
            this.appendValueInput("COND")
                .appendField("🚩 quando");
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
                .appendField("⚡ quando [Clock] pulsar");
            this.appendValueInput("CLK")
                .appendField("Sinal Clock");
            this.setNextStatement(true);
            this.setColour("#FFBF00");
            this.setTooltip("Dispara eventos e modulações a cada pulso do clock.");
        }
    };

    // -------------------------------------------------------------------------
    // 🎹 3. SEQUENCIADOR DE PASSOS ABERTO (#59C059)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_seq'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎹 Sequenciador");
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
            this.setTooltip("Sequenciador aberto. Encaixe quantos blocos de notas quiser dentro!");
        }
    };

    Blockly.Blocks['seq_note'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎵 Nota")
                .appendField(new Blockly.FieldDropdown([
                    ["C (Dó)", "0"], ["C# / Db", "1"], ["D (Ré)", "2"], ["D# / Eb", "3"],
                    ["E (Mi)", "4"], ["F (Fá)", "5"], ["F# / Gb", "6"], ["G (Sol)", "7"],
                    ["G# / Ab", "8"], ["A (Lá)", "9"], ["A# / Bb", "10"], ["B (Si)", "11"]
                ]), "NOTE")
                .appendField("Oitava")
                .appendField(new Blockly.FieldNumber(0, -3, 3, 1), "OCTAVE")
                .appendField("Gate")
                .appendField(new Blockly.FieldDropdown([
                    ["Sim (1)", "1"],
                    ["Tie (Ligar)", "2"],
                    ["Mudo (0)", "0"]
                ]), "GATE");
            this.setPreviousStatement(true, "NOTE");
            this.setNextStatement(true, "NOTE");
            this.setColour("#1dd1a1");
            this.setTooltip("Passo de nota musical. Conecte quantos quiser em sequência!");
        }
    };

    Blockly.Blocks['seq_rest'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🔇 Pausa / Silêncio");
            this.setPreviousStatement(true, "NOTE");
            this.setNextStatement(true, "NOTE");
            this.setColour("#8395a7");
            this.setTooltip("Passo de pausa silenciosa na sequência.");
        }
    };

    // -------------------------------------------------------------------------
    // ➕ 4. OPERADORES MATEMÁTICOS & CV SCRATCH (#59C059)
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
                    ["mod", "MOD"]
                ]), "OP");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Operação aritmética entre dois sinais ou números.");
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
                    ["tanh (saturação)", "TANH"],
                    ["abs", "ABS"],
                    ["inverter (-)", "NEG"],
                    ["raiz quadrada", "SQRT"],
                    ["arredondar", "ROUND"],
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
                    ["<=", "LTE"]
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
            this.setTooltip("Porta lógica NÃO: inverte o sinal de controle (retorna 1 se entrada <= 0.5).");
        }
    };

    Blockly.Blocks['math_list_item'] = {
        init: function() {
            this.appendValueInput("INDEX")
                .appendField("item");
            this.appendDummyInput()
                .appendField("da lista [")
                .appendField(new Blockly.FieldTextInput("0, 3, 7, 10, 12, 10, 7, 3"), "LIST")
                .appendField("]");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Lê um item da lista pelo índice (com wrap circular automático).");
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

    // -------------------------------------------------------------------------
    // 🎛️ 5. REGISTRAR TODOS OS MÓDULOS UNIFICADOS (VCO, VCF, VCA, LFO, ADSR, ETC.)
    // -------------------------------------------------------------------------
    registerAllBlocksToBlockly(Blockly);
}
