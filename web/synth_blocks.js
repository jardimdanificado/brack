/**
 * =========================================================================
 * BRACK Unlimited Scratch Modular Synth Blocks (web/synth_blocks.js)
 * Free-Text Buses, Open-Expression Parameters, Math Operators & Chained Sequencer
 * =========================================================================
 */

export function registerSynthBlocks(Blockly) {
    // -------------------------------------------------------------------------
    // 📡 1. BARRAMENTOS & TAGS LIVRES (#FF6680)
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

    Blockly.Blocks['synth_var_set'] = {
        init: function() {
            this.appendValueInput("VAL")
                .appendField("definir sinal [")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField("] para");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setInputsInline(true);
            this.setColour("#FF6680");
            this.setTooltip("Armazena um sinal ou voltagem em uma variável.");
        }
    };

    Blockly.Blocks['synth_var_get'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("(")
                .appendField(new Blockly.FieldTextInput("voltagem"), "VAR")
                .appendField(")");
            this.setOutput(true);
            this.setColour("#FF6680");
            this.setTooltip("Pílula que lê o valor da variável.");
        }
    };

    // -------------------------------------------------------------------------
    // 🚩 2. EVENTOS & HAT BLOCKS (#FFAB19)
    // -------------------------------------------------------------------------
    Blockly.Blocks['event_whenflagclicked'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🚩 quando 🟢 for clicado");
            this.setNextStatement(true);
            this.setColour("#FFAB19");
            this.setTooltip("Inicia o motor modular de áudio quando a bandeira verde for clicada.");
        }
    };

    Blockly.Blocks['event_whenclockpulse'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚡ quando [Clock] pulsar");
            this.appendValueInput("CLK")
                .appendField("Sinal Clock");
            this.setNextStatement(true);
            this.setColour("#FFAB19");
            this.setTooltip("Dispara eventos e modulações a cada pulso do clock.");
        }
    };

    // -------------------------------------------------------------------------
    // 〰️ 3. GERADORES & OSCILADORES (#9966FF)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_vco'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("〰️ VCO Oscilador")
                .appendField(new Blockly.FieldDropdown([
                    ["SAW (Dente de Serra)", "saw"],
                    ["SQUARE (Quadrada)", "sqr"],
                    ["TRIANGLE (Triangular)", "tri"],
                    ["SINE (Senoidal)", "sin"],
                    ["NOISE (Ruído)", "noise"]
                ]), "WAVE");
            this.appendValueInput("FREQ")
                .appendField("Frequência (Hz)")
                .setCheck(null);
            this.appendValueInput("FM")
                .appendField("Modulação FM (CV)")
                .setCheck(null);
            this.appendValueInput("PW")
                .appendField("Largura Pulso (0..1)")
                .setCheck(null);
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#9966FF");
            this.setTooltip("Oscilador analógico PolyBLEP anti-aliased. Aceita pílulas em qualquer entrada.");
        }
    };

    Blockly.Blocks['synth_bytebeat'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("👾 Bytebeat 8-Bit")
                .appendField(new Blockly.FieldDropdown([
                    ["t * ((t>>12|t>>8)&63&t>>4)", "0"],
                    ["(t>>7|t|t>>6)*10", "1"],
                    ["(t*(t>>5|t>>8))>>(t>>16)", "2"],
                    ["(t*5&t>>7)|(t*3&t>>10)", "3"]
                ]), "FORMULA");
            this.appendValueInput("SPEED")
                .appendField("Velocidade (Hz)")
                .setCheck(null);
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#9966FF");
            this.setTooltip("Síntese algorítmica matemática 8-bit.");
        }
    };

    // -------------------------------------------------------------------------
    // 🎛️ 4. FILTROS, AMPS & DINÂMICA (#FF8C1A)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_vcf'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎛️ Filtro Moog 24dB VCF");
            this.appendValueInput("IN")
                .appendField("Áudio In (ou fluxo acima)");
            this.appendValueInput("CUTOFF")
                .appendField("Corte (Hz ou CV)")
                .setCheck(null);
            this.appendValueInput("RES")
                .appendField("Ressonância (0..0.95)")
                .setCheck(null);
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#FF8C1A");
            this.setTooltip("Filtro transistor ladder 4-polos com saturação analógica.");
        }
    };

    Blockly.Blocks['synth_vca'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🔊 Amplificador VCA")
                .appendField(new Blockly.FieldDropdown([
                    ["EXPONENCIAL", "1"],
                    ["LINEAR", "0"]
                ]), "EXP");
            this.appendValueInput("IN")
                .appendField("Áudio In (ou fluxo acima)");
            this.appendValueInput("GAIN")
                .appendField("Ganho / Modulação (CV)")
                .setCheck(null);
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#FF8C1A");
            this.setTooltip("Amplificador controlado por voltagem com curva exponencial ou linear.");
        }
    };

    Blockly.Blocks['synth_distortion'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🔥 Distorção & Wavefolder")
                .appendField(new Blockly.FieldDropdown([
                    ["TANH (Saturação Quente)", "tanh"],
                    ["HARD CLIP (Digital)", "hard"],
                    ["BITCRUSH (8-Bit Lo-Fi)", "crush"],
                    ["WAVEFOLDER (Dobra Harmônica)", "fold"]
                ]), "MODE");
            this.appendValueInput("IN")
                .appendField("Áudio In (ou fluxo acima)");
            this.appendValueInput("DRIVE")
                .appendField("Drive / Ganho (1..20)")
                .setCheck(null);
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#FF8C1A");
            this.setTooltip("Efeito de distorção, saturação analógica e wavefolding harmônico.");
        }
    };

    Blockly.Blocks['synth_mixer'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎚️ Mixer 2 Canais");
            this.appendValueInput("IN1")
                .appendField("Canal 1");
            this.appendValueInput("VOL1")
                .appendField("  Volume 1 (0..2)");
            this.appendValueInput("IN2")
                .appendField("Canal 2");
            this.appendValueInput("VOL2")
                .appendField("  Volume 2 (0..2)");
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#FF8C1A");
            this.setTooltip("Soma e mistura 2 sinais de áudio ou voltagens de controle.");
        }
    };

    // -------------------------------------------------------------------------
    // 📈 5. MODULADORES & SEQUENCIADORES (#59C059)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_clock'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("⚡ Clock Mestre");
            this.appendValueInput("BPM")
                .appendField("Tempo (BPM)")
                .setCheck(null);
            this.appendValueInput("PW")
                .appendField("Largura Pulso (0..1)")
                .setCheck(null);
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setOutput(true, "VAL");
            this.setInputsInline(false);
            this.setColour("#59C059");
            this.setTooltip("Gerador de pulso de clock mestre.");
        }
    };

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

    Blockly.Blocks['synth_adsr'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📈 Envelope ADSR");
            this.appendValueInput("GATE")
                .appendField("Gate Trigger (CV)");
            this.appendValueInput("ATTACK")
                .appendField("  Ataque (s)");
            this.appendValueInput("DECAY")
                .appendField("  Decaimento (s)");
            this.appendValueInput("SUSTAIN")
                .appendField("  Sustentação (0..1)");
            this.appendValueInput("RELEASE")
                .appendField("  Relaxamento (s)");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setOutput(true, "VAL");
            this.setInputsInline(false);
            this.setColour("#59C059");
            this.setTooltip("Envelope analógico Attack-Decay-Sustain-Release.");
        }
    };

    Blockly.Blocks['synth_lfo'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("〰️ LFO Modulador")
                .appendField(new Blockly.FieldDropdown([
                    ["TRIÂNGULO", "tri"],
                    ["SENO", "sin"],
                    ["QUADRADA", "sqr"],
                    ["SAW", "saw"],
                    ["RANDOM (S&H)", "rnd"]
                ]), "WAVE");
            this.appendValueInput("FREQ")
                .appendField("Frequência (Hz)");
            this.appendValueInput("DEPTH")
                .appendField("Intensidade (0..5)");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setOutput(true, "VAL");
            this.setInputsInline(false);
            this.setColour("#59C059");
            this.setTooltip("Oscilador de baixa frequência para modulação contínua.");
        }
    };

    Blockly.Blocks['synth_sample_hold'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎲 Sample & Hold");
            this.appendValueInput("IN")
                .appendField("Sinal In");
            this.appendValueInput("TRIG")
                .appendField("Trigger (CV)");
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setOutput(true, "VAL");
            this.setInputsInline(false);
            this.setColour("#59C059");
            this.setTooltip("Amostra o valor de entrada a cada pulso do trigger.");
        }
    };

    // -------------------------------------------------------------------------
    // ➕ 6. OPERADORES MATEMÁTICOS & FUNÇÕES SCRATCH (#59C059)
    // -------------------------------------------------------------------------
    Blockly.Blocks['math_arithmetic'] = {
        init: function() {
            this.appendValueInput("A");
            this.appendDummyInput()
                .appendField(new Blockly.FieldDropdown([
                    ["+", "ADD"],
                    ["-", "MINUS"],
                    ["×", "MULTIPLY"],
                    ["÷", "DIVIDE"],
                    ["mod", "MOD"]
                ]), "OP");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Operação aritmética entre dois sinais.");
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
                .appendField(new Blockly.FieldNumber(100), "OUT_MIN")
                .appendField("..")
                .appendField(new Blockly.FieldNumber(8000), "OUT_MAX")
                .appendField("]");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Mapeia proporcionalmente um sinal de uma faixa para outra.");
        }
    };

    Blockly.Blocks['math_single'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldDropdown([
                    ["seno", "SIN"],
                    ["cosseno", "COS"],
                    ["tanh (saturação)", "TANH"],
                    ["abs (positivo)", "ABS"],
                    ["inverter (-)", "NEG"],
                    ["raiz quadrada", "SQRT"],
                    ["arredondar", "ROUND"],
                    ["travar [0..1]", "CLAMP01"]
                ]), "OP");
            this.appendValueInput("NUM");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Função matemática unária.");
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
            this.setTooltip("Gera um número aleatório.");
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
                    ["≥", "GTE"],
                    ["≤", "LTE"]
                ]), "OP");
            this.appendValueInput("B");
            this.setOutput(true);
            this.setInputsInline(true);
            this.setColour("#59C059");
            this.setTooltip("Compara dois sinais e gera 1 (Gate On) ou 0 (Gate Off).");
        }
    };

    Blockly.Blocks['math_number'] = {
        init: function() {
            this.appendDummyInput()
                .appendField(new Blockly.FieldNumber(130.81), "NUM");
            this.setOutput(true);
            this.setColour("#59C059");
            this.setTooltip("Número ou constante de voltagem.");
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
            this.setColour("#59C059");
            this.setTooltip("Converte número de nota MIDI (0..127) em frequência em Hertz.");
        }
    };

    // -------------------------------------------------------------------------
    // 📼 7. EFEITOS & SAÍDA MASTER (#4C97FF)
    // -------------------------------------------------------------------------
    Blockly.Blocks['synth_delay'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("📼 Tape Delay / Eco");
            this.appendValueInput("IN")
                .appendField("Áudio In (ou fluxo acima)");
            this.appendValueInput("TIME")
                .appendField("Tempo (s)");
            this.appendValueInput("FB")
                .appendField("Feedback (0..0.95)");
            this.appendValueInput("MIX")
                .appendField("Mix (0..1)");
            this.setPreviousStatement(true, "AUDIO");
            this.setNextStatement(true, "AUDIO");
            this.setOutput(true);
            this.setInputsInline(false);
            this.setColour("#4C97FF");
            this.setTooltip("Efeito de delay analógico com saturação quente.");
        }
    };

    Blockly.Blocks['synth_out'] = {
        init: function() {
            this.appendDummyInput()
                .appendField("🎚️ Saída Estéreo Master");
            this.appendValueInput("LEFT")
                .appendField("Áudio L (opcional)");
            this.appendValueInput("RIGHT")
                .appendField("Áudio R (opcional)");
            this.appendValueInput("VOL")
                .appendField("Volume Master (0..1.5)");
            this.setPreviousStatement(true, "AUDIO");
            this.setInputsInline(false);
            this.setColour("#4C97FF");
            this.setTooltip("Saída final para os alto-falantes.");
        }
    };
}
