/**
 * =========================================================================
 * BRACK Projects & Examples Manager (web/projects_manager.js)
 * Persistent Project Storage (localStorage + JSON import/export)
 * Complex Modular Synth Factory Presets (0 Emojis, Advanced Multi-Voice DSP)
 * =========================================================================
 */

const STORAGE_KEY = 'brack_projects_v3';
const ACTIVE_PROJECT_KEY = 'brack_active_project_id_v3';

/**
 * Remove any unicode emojis or pictorial symbols from text
 */
function sanitizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
        .trim();
}

/**
 * Helper to connect a numeric constant block to a block's value input
 */
function attachNum(workspace, block, inputName, val) {
    if (!block || !workspace) return null;
    const numBlock = workspace.newBlock('math_number');
    numBlock.setFieldValue(val, 'NUM');
    numBlock.initSvg();
    numBlock.render();

    const input = block.getInput(inputName);
    if (input && input.connection) {
        input.connection.connect(numBlock.outputConnection);
    }
    return numBlock;
}

/* =========================================================================
 * 1. Factory Examples Builders
 * Complex, multi-voice, advanced modular synthesizer patches
 * ========================================================================= */

export const EXAMPLE_PRESETS = [
    {
        id: 'acid_bass',
        name: 'Acid 303 Lab (Ladder, Fold, Tape Delay & Reverb)',
        description: 'Sequenciador de 8 passos melódico, VCO Sawtooth e Sub-Oscillator no Mixer, VCF Moog 24dB com envelope ADSR rápido, Distorção Wavefolder, Tape Delay e Reverb Espacial.',
        category: 'Exemplo',
        isExample: true,
        builder: buildAcidBassPatch
    },
    {
        id: 'ambient_pad',
        name: 'Pad Polifônico Shimmer & Drone Espacial',
        description: 'Textura ambiente rica com VCO Sawtooth, Sub-Oscillator e Ruído Rosa no Mixer de 4 Canais, Filtro Multimodo SVF varrido por LFOs cruzados, Chorus Estéreo, Reverb Shimmer e Delay.',
        category: 'Exemplo',
        isExample: true,
        builder: buildAmbientPadPatch
    },
    {
        id: 'percussion_groove',
        name: 'Groovebox Algorítmica (Kick, Snare & Bass FM)',
        description: 'Gerador rítmico autônomo com Divisor de Clock para Bumbo senoidal com pitch-drop, Caixa de ruído metálica com Ring Modulator, e Linha de Baixo FM através de VCF Moog e Tape Delay.',
        category: 'Exemplo',
        isExample: true,
        builder: buildPercussionGroovePatch
    },
    {
        id: 'techno_polyrhythm',
        name: 'S&H Generativo & Microtonal West Coast',
        description: 'Sistema generativo modular com Sample & Hold amostrando Ruído no clock rápido, Distorção Tanh, Filtro Moog com ressonância alta, VCA e Delay rítmico.',
        category: 'Exemplo',
        isExample: true,
        builder: buildTechnoPatch
    },
    {
        id: 'bytebeat_8bit',
        name: 'Bytebeat Explorer & Bitcrusher Symphony',
        description: 'Síntese algorítmica matemática em tempo real de 8 bits com Bitcrusher, modulação contínua por LFO, filtro Moog 24dB ressonante, Delay estéreo e Reverb.',
        category: 'Exemplo',
        isExample: true,
        builder: buildBytebeatPatch
    },
    {
        id: 'keyboard_synth',
        name: 'Sintetizador Interativo de Performance (Teclado PC)',
        description: 'Instrumento tocável ao vivo pelo teclado do computador (A, S, D, F, G, H, J, K / W, E) com VCO Saw, Sub-Oscillator, VCF Moog com envelope dinâmico, Chorus estéreo e Reverb.',
        category: 'Exemplo',
        isExample: true,
        builder: buildKeyboardSynthPatch
    }
];

// 1. Acid 303 Lab Builder
function buildAcidBassPatch(workspace) {
    workspace.clear();

    // Clock Master -> Send [clk_master]
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 132);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-520, -320));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('clk_master', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // 8-Step Sequencer
    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-520, -120));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('clk_master', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    seqBlock.getInput('CLK').connection.connect(recvClk1.outputConnection);

    const notesData = [
        { note: "0", oct: 0 },
        { note: "3", oct: 0 },
        { note: "7", oct: 0 },
        { note: "10", oct: 0 },
        { note: "0", oct: 1 },
        { note: "10", oct: 0 },
        { note: "7", oct: 0 },
        { note: "3", oct: 0 }
    ];

    let prevNoteBlock = null;
    for (let i = 0; i < notesData.length; i++) {
        const noteBlock = workspace.newBlock('seq_note');
        noteBlock.setFieldValue(notesData[i].note, 'NOTE');
        noteBlock.setFieldValue(notesData[i].oct, 'OCTAVE');
        noteBlock.initSvg();
        noteBlock.render();

        if (i === 0) {
            seqBlock.getInput('STEPS').connection.connect(noteBlock.previousConnection);
        } else if (prevNoteBlock) {
            prevNoteBlock.nextConnection.connect(noteBlock.previousConnection);
        }
        prevNoteBlock = noteBlock;
    }

    const sendPitch = workspace.newBlock('synth_send');
    sendPitch.setFieldValue('pitch_cv', 'CHANNEL');
    sendPitch.initSvg();
    sendPitch.render();
    sendPitch.moveTo(new Blockly.utils.Coordinate(-220, -120));
    sendPitch.getInput('IN').connection.connect(seqBlock.outputConnection);

    // ADSR Envelope (Punchy Attack & Decay)
    const adsrBlock = workspace.newBlock('synth_adsr');
    attachNum(workspace, adsrBlock, 'A', 0.005);
    attachNum(workspace, adsrBlock, 'D', 0.20);
    attachNum(workspace, adsrBlock, 'S', 0.15);
    attachNum(workspace, adsrBlock, 'R', 0.12);
    adsrBlock.initSvg();
    adsrBlock.render();
    adsrBlock.moveTo(new Blockly.utils.Coordinate(-520, 240));

    const recvClk2 = workspace.newBlock('synth_recv');
    recvClk2.setFieldValue('clk_master', 'CHANNEL');
    recvClk2.initSvg();
    recvClk2.render();
    adsrBlock.getInput('GATE').connection.connect(recvClk2.outputConnection);

    const sendEnv = workspace.newBlock('synth_send');
    sendEnv.setFieldValue('filter_env', 'CHANNEL');
    sendEnv.initSvg();
    sendEnv.render();
    sendEnv.moveTo(new Blockly.utils.Coordinate(-220, 240));
    sendEnv.getInput('IN').connection.connect(adsrBlock.outputConnection);

    // Audio Stack: Flag -> VCO -> Sub-Osc -> Mixer -> Moog VCF -> Fold -> VCA -> Delay -> Reverb -> Scope -> Out
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(140, -320));

    const vcoBlock = workspace.newBlock('synth_vco');
    vcoBlock.setFieldValue('saw', 'WAVE');
    vcoBlock.initSvg();
    vcoBlock.render();

    const recvPitch = workspace.newBlock('synth_recv');
    recvPitch.setFieldValue('pitch_cv', 'CHANNEL');
    recvPitch.initSvg();
    recvPitch.render();
    vcoBlock.getInput('FM').connection.connect(recvPitch.outputConnection);

    const subOscBlock = workspace.newBlock('synth_sub_osc');
    subOscBlock.setFieldValue('-1_sqr', 'OCT');
    subOscBlock.initSvg();
    subOscBlock.render();

    const mixerBlock = workspace.newBlock('synth_mixer');
    attachNum(workspace, mixerBlock, 'VOL1', 0.85);
    attachNum(workspace, mixerBlock, 'VOL2', 0.45);
    mixerBlock.initSvg();
    mixerBlock.render();

    const vcfBlock = workspace.newBlock('synth_vcf');
    attachNum(workspace, vcfBlock, 'RES', 0.82);
    vcfBlock.initSvg();
    vcfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(200, 'OUT_MIN');
    mapCutoff.setFieldValue(7200, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvEnv1 = workspace.newBlock('synth_recv');
    recvEnv1.setFieldValue('filter_env', 'CHANNEL');
    recvEnv1.initSvg();
    recvEnv1.render();
    mapCutoff.getInput('VAL').connection.connect(recvEnv1.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const distBlock = workspace.newBlock('synth_distortion');
    distBlock.setFieldValue('fold', 'MODE');
    attachNum(workspace, distBlock, 'DRIVE', 2.8);
    distBlock.initSvg();
    distBlock.render();

    const vcaBlock = workspace.newBlock('synth_vca');
    vcaBlock.initSvg();
    vcaBlock.render();

    const recvEnv2 = workspace.newBlock('synth_recv');
    recvEnv2.setFieldValue('filter_env', 'CHANNEL');
    recvEnv2.initSvg();
    recvEnv2.render();
    vcaBlock.getInput('GAIN').connection.connect(recvEnv2.outputConnection);

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.26);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.46);
    attachNum(workspace, delayBlock, 'MIX', 0.35);
    delayBlock.initSvg();
    delayBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.72);
    attachNum(workspace, reverbBlock, 'DAMP', 0.35);
    attachNum(workspace, reverbBlock, 'MIX', 0.30);
    reverbBlock.initSvg();
    reverbBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.85);
    outBlock.initSvg();
    outBlock.render();

    flagBlock.nextConnection.connect(vcoBlock.previousConnection);
    vcoBlock.nextConnection.connect(subOscBlock.previousConnection);
    subOscBlock.nextConnection.connect(mixerBlock.previousConnection);
    mixerBlock.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(distBlock.previousConnection);
    distBlock.nextConnection.connect(vcaBlock.previousConnection);
    vcaBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 2. Ambient Pad & Shimmer Drone Builder
function buildAmbientPadPatch(workspace) {
    workspace.clear();

    // Slow Clock
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 52);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-520, -320));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('pad_clk', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // Harmonic Chord Sequencer
    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-520, -120));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('pad_clk', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    seqBlock.getInput('CLK').connection.connect(recvClk1.outputConnection);

    const notesData = [
        { note: "0", oct: 0 },
        { note: "7", oct: 0 },
        { note: "3", oct: 0 },
        { note: "10", oct: 0 },
        { note: "8", oct: 0 },
        { note: "7", oct: 0 }
    ];

    let prevNoteBlock = null;
    for (let i = 0; i < notesData.length; i++) {
        const noteBlock = workspace.newBlock('seq_note');
        noteBlock.setFieldValue(notesData[i].note, 'NOTE');
        noteBlock.setFieldValue(notesData[i].oct, 'OCTAVE');
        noteBlock.initSvg();
        noteBlock.render();

        if (i === 0) {
            seqBlock.getInput('STEPS').connection.connect(noteBlock.previousConnection);
        } else if (prevNoteBlock) {
            prevNoteBlock.nextConnection.connect(noteBlock.previousConnection);
        }
        prevNoteBlock = noteBlock;
    }

    const sendPitch = workspace.newBlock('synth_send');
    sendPitch.setFieldValue('pad_pitch', 'CHANNEL');
    sendPitch.initSvg();
    sendPitch.render();
    sendPitch.moveTo(new Blockly.utils.Coordinate(-220, -120));
    sendPitch.getInput('IN').connection.connect(seqBlock.outputConnection);

    // Cross-Modulated Dual LFOs
    const lfo1 = workspace.newBlock('synth_lfo');
    lfo1.setFieldValue('sin', 'WAVE');
    attachNum(workspace, lfo1, 'FREQ', 0.15);
    attachNum(workspace, lfo1, 'DEPTH', 1.0);
    lfo1.initSvg();
    lfo1.render();
    lfo1.moveTo(new Blockly.utils.Coordinate(-520, 240));

    const sendLfo1 = workspace.newBlock('synth_send');
    sendLfo1.setFieldValue('lfo_filter', 'CHANNEL');
    sendLfo1.initSvg();
    sendLfo1.render();
    sendLfo1.moveTo(new Blockly.utils.Coordinate(-220, 240));
    sendLfo1.getInput('IN').connection.connect(lfo1.outputConnection);

    // Audio Stack: Flag -> VCO 1 (Saw) -> Sub-Osc -> Noise -> Mixer 4 -> SVF -> Chorus -> Reverb -> Delay -> Scope -> Out
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(140, -320));

    const vco1 = workspace.newBlock('synth_vco');
    vco1.setFieldValue('saw', 'WAVE');
    vco1.initSvg();
    vco1.render();

    const recvPitch1 = workspace.newBlock('synth_recv');
    recvPitch1.setFieldValue('pad_pitch', 'CHANNEL');
    recvPitch1.initSvg();
    recvPitch1.render();
    vco1.getInput('FM').connection.connect(recvPitch1.outputConnection);

    const subOsc = workspace.newBlock('synth_sub_osc');
    subOsc.setFieldValue('-1_sin', 'OCT');
    subOsc.initSvg();
    subOsc.render();

    const noiseBlock = workspace.newBlock('synth_noise');
    noiseBlock.setFieldValue('pink', 'TYPE');
    noiseBlock.initSvg();
    noiseBlock.render();

    const mixer4 = workspace.newBlock('synth_mixer4');
    attachNum(workspace, mixer4, 'VOL1', 0.75);
    attachNum(workspace, mixer4, 'VOL2', 0.50);
    attachNum(workspace, mixer4, 'VOL3', 0.12);
    attachNum(workspace, mixer4, 'VOL4', 0.0);
    mixer4.initSvg();
    mixer4.render();

    const svfBlock = workspace.newBlock('synth_svf');
    svfBlock.setFieldValue('bp', 'MODE');
    attachNum(workspace, svfBlock, 'RES', 0.65);
    svfBlock.initSvg();
    svfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(-1, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(350, 'OUT_MIN');
    mapCutoff.setFieldValue(3600, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvLfoFilter = workspace.newBlock('synth_recv');
    recvLfoFilter.setFieldValue('lfo_filter', 'CHANNEL');
    recvLfoFilter.initSvg();
    recvLfoFilter.render();
    mapCutoff.getInput('VAL').connection.connect(recvLfoFilter.outputConnection);
    svfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const chorusBlock = workspace.newBlock('synth_chorus');
    attachNum(workspace, chorusBlock, 'RATE', 0.65);
    attachNum(workspace, chorusBlock, 'DEPTH', 0.85);
    attachNum(workspace, chorusBlock, 'MIX', 0.60);
    chorusBlock.initSvg();
    chorusBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.92);
    attachNum(workspace, reverbBlock, 'DAMP', 0.22);
    attachNum(workspace, reverbBlock, 'MIX', 0.55);
    reverbBlock.initSvg();
    reverbBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.52);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.60);
    attachNum(workspace, delayBlock, 'MIX', 0.40);
    delayBlock.initSvg();
    delayBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.90);
    outBlock.initSvg();
    outBlock.render();

    flagBlock.nextConnection.connect(vco1.previousConnection);
    vco1.nextConnection.connect(subOsc.previousConnection);
    subOsc.nextConnection.connect(noiseBlock.previousConnection);
    noiseBlock.nextConnection.connect(mixer4.previousConnection);
    mixer4.nextConnection.connect(svfBlock.previousConnection);
    svfBlock.nextConnection.connect(chorusBlock.previousConnection);
    chorusBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 3. Algorithmic Percussion & FM Groovebox Builder
function buildPercussionGroovePatch(workspace) {
    workspace.clear();

    // Fast Master Clock (BPM 130)
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 130);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-520, -320));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('m_clk', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // Clock Divider (/2 for Snare / Offbeats)
    const clkDiv = workspace.newBlock('synth_clock_divider');
    clkDiv.setFieldValue('2', 'DIV');
    clkDiv.initSvg();
    clkDiv.render();
    clkDiv.moveTo(new Blockly.utils.Coordinate(-520, -120));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('m_clk', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    clkDiv.getInput('IN').connection.connect(recvClk1.outputConnection);

    const sendClkHalf = workspace.newBlock('synth_send');
    sendClkHalf.setFieldValue('clk_half', 'CHANNEL');
    sendClkHalf.initSvg();
    sendClkHalf.render();
    clkDiv.nextConnection.connect(sendClkHalf.previousConnection);

    // Bassline Sequencer
    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-520, 80));

    const recvClk2 = workspace.newBlock('synth_recv');
    recvClk2.setFieldValue('m_clk', 'CHANNEL');
    recvClk2.initSvg();
    recvClk2.render();
    seqBlock.getInput('CLK').connection.connect(recvClk2.outputConnection);

    const notesData = [
        { note: "0", oct: -1 },
        { note: "0", oct: -1 },
        { note: "3", oct: -1 },
        { note: "0", oct: -1 },
        { note: "7", oct: -1 },
        { note: "5", oct: -1 },
        { note: "3", oct: -1 },
        { note: "10", oct: -1 }
    ];

    let prevNoteBlock = null;
    for (let i = 0; i < notesData.length; i++) {
        const noteBlock = workspace.newBlock('seq_note');
        noteBlock.setFieldValue(notesData[i].note, 'NOTE');
        noteBlock.setFieldValue(notesData[i].oct, 'OCTAVE');
        noteBlock.initSvg();
        noteBlock.render();

        if (i === 0) {
            seqBlock.getInput('STEPS').connection.connect(noteBlock.previousConnection);
        } else if (prevNoteBlock) {
            prevNoteBlock.nextConnection.connect(noteBlock.previousConnection);
        }
        prevNoteBlock = noteBlock;
    }

    const sendBassPitch = workspace.newBlock('synth_send');
    sendBassPitch.setFieldValue('bass_pitch', 'CHANNEL');
    sendBassPitch.initSvg();
    sendBassPitch.render();
    sendBassPitch.moveTo(new Blockly.utils.Coordinate(-220, 80));
    sendBassPitch.getInput('IN').connection.connect(seqBlock.outputConnection);

    // Fast Exponential Envelope for Kick Pitch Drop & Gain
    const kickAdsr = workspace.newBlock('synth_adsr');
    attachNum(workspace, kickAdsr, 'A', 0.002);
    attachNum(workspace, kickAdsr, 'D', 0.12);
    attachNum(workspace, kickAdsr, 'S', 0.0);
    attachNum(workspace, kickAdsr, 'R', 0.03);
    kickAdsr.initSvg();
    kickAdsr.render();
    kickAdsr.moveTo(new Blockly.utils.Coordinate(-520, 380));

    const recvClk3 = workspace.newBlock('synth_recv');
    recvClk3.setFieldValue('m_clk', 'CHANNEL');
    recvClk3.initSvg();
    recvClk3.render();
    kickAdsr.getInput('GATE').connection.connect(recvClk3.outputConnection);

    const sendKickEnv = workspace.newBlock('synth_send');
    sendKickEnv.setFieldValue('kick_env', 'CHANNEL');
    sendKickEnv.initSvg();
    sendKickEnv.render();
    sendKickEnv.moveTo(new Blockly.utils.Coordinate(-220, 380));
    sendKickEnv.getInput('IN').connection.connect(kickAdsr.outputConnection);

    // Audio Stack: Flag -> VCO (FM Bass) -> Sub-Osc -> Ringmod -> Moog VCF -> Distortion -> Delay -> Scope -> Out
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(140, -320));

    const vcoBass = workspace.newBlock('synth_vco');
    vcoBass.setFieldValue('saw', 'WAVE');
    vcoBass.initSvg();
    vcoBass.render();

    const recvBassPitch = workspace.newBlock('synth_recv');
    recvBassPitch.setFieldValue('bass_pitch', 'CHANNEL');
    recvBassPitch.initSvg();
    recvBassPitch.render();
    vcoBass.getInput('FM').connection.connect(recvBassPitch.outputConnection);

    const subOsc = workspace.newBlock('synth_sub_osc');
    subOsc.setFieldValue('-1_sqr', 'OCT');
    subOsc.initSvg();
    subOsc.render();

    const ringMod = workspace.newBlock('synth_ringmod');
    ringMod.initSvg();
    ringMod.render();

    const vcfBlock = workspace.newBlock('synth_vcf');
    attachNum(workspace, vcfBlock, 'RES', 0.70);
    vcfBlock.initSvg();
    vcfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(180, 'OUT_MIN');
    mapCutoff.setFieldValue(5500, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvKickEnv = workspace.newBlock('synth_recv');
    recvKickEnv.setFieldValue('kick_env', 'CHANNEL');
    recvKickEnv.initSvg();
    recvKickEnv.render();
    mapCutoff.getInput('VAL').connection.connect(recvKickEnv.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const distBlock = workspace.newBlock('synth_distortion');
    distBlock.setFieldValue('tanh', 'MODE');
    attachNum(workspace, distBlock, 'DRIVE', 3.2);
    distBlock.initSvg();
    distBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.23);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.44);
    attachNum(workspace, delayBlock, 'MIX', 0.32);
    delayBlock.initSvg();
    delayBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.88);
    outBlock.initSvg();
    outBlock.render();

    flagBlock.nextConnection.connect(vcoBass.previousConnection);
    vcoBass.nextConnection.connect(subOsc.previousConnection);
    subOsc.nextConnection.connect(ringMod.previousConnection);
    ringMod.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(distBlock.previousConnection);
    distBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 4. Sample & Hold Generative West Coast Synth Builder
function buildTechnoPatch(workspace) {
    workspace.clear();

    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 138);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-520, -320));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('fast_clk', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // Clock Divider (/2 for S&H Trigger)
    const clkDiv = workspace.newBlock('synth_clock_divider');
    clkDiv.setFieldValue('2', 'DIV');
    clkDiv.initSvg();
    clkDiv.render();
    clkDiv.moveTo(new Blockly.utils.Coordinate(-520, -120));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('fast_clk', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    clkDiv.getInput('IN').connection.connect(recvClk1.outputConnection);

    const sendClkDiv = workspace.newBlock('synth_send');
    sendClkDiv.setFieldValue('sh_clk', 'CHANNEL');
    sendClkDiv.initSvg();
    sendClkDiv.render();
    clkDiv.nextConnection.connect(sendClkDiv.previousConnection);

    // Sample & Hold Sampling White Noise
    const shBlock = workspace.newBlock('synth_sample_hold');
    shBlock.initSvg();
    shBlock.render();
    shBlock.moveTo(new Blockly.utils.Coordinate(-520, 80));

    const rndBlock = workspace.newBlock('math_random');
    rndBlock.setFieldValue(-1.5, 'FROM');
    rndBlock.setFieldValue(1.5, 'TO');
    rndBlock.initSvg();
    rndBlock.render();
    shBlock.getInput('SIG').connection.connect(rndBlock.outputConnection);

    const recvShClk = workspace.newBlock('synth_recv');
    recvShClk.setFieldValue('sh_clk', 'CHANNEL');
    recvShClk.initSvg();
    recvShClk.render();
    shBlock.getInput('TRIG').connection.connect(recvShClk.outputConnection);

    const sendSh = workspace.newBlock('synth_send');
    sendSh.setFieldValue('sh_pitch', 'CHANNEL');
    sendSh.initSvg();
    sendSh.render();
    sendSh.moveTo(new Blockly.utils.Coordinate(-220, 80));
    sendSh.getInput('IN').connection.connect(shBlock.outputConnection);

    // ADSR Envelope
    const adsrBlock = workspace.newBlock('synth_adsr');
    attachNum(workspace, adsrBlock, 'A', 0.005);
    attachNum(workspace, adsrBlock, 'D', 0.12);
    attachNum(workspace, adsrBlock, 'S', 0.10);
    attachNum(workspace, adsrBlock, 'R', 0.06);
    adsrBlock.initSvg();
    adsrBlock.render();
    adsrBlock.moveTo(new Blockly.utils.Coordinate(-520, 360));

    const recvClk2 = workspace.newBlock('synth_recv');
    recvClk2.setFieldValue('fast_clk', 'CHANNEL');
    recvClk2.initSvg();
    recvClk2.render();
    adsrBlock.getInput('GATE').connection.connect(recvClk2.outputConnection);

    const sendEnv = workspace.newBlock('synth_send');
    sendEnv.setFieldValue('perc_env', 'CHANNEL');
    sendEnv.initSvg();
    sendEnv.render();
    sendEnv.moveTo(new Blockly.utils.Coordinate(-220, 360));
    sendEnv.getInput('IN').connection.connect(adsrBlock.outputConnection);

    // Audio Stack: Flag -> VCO (Square) -> Ringmod -> Distortion (Tanh) -> VCF (Moog) -> VCA -> Scope -> Delay -> Reverb -> Out
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(140, -320));

    const vcoBlock = workspace.newBlock('synth_vco');
    vcoBlock.setFieldValue('sqr', 'WAVE');
    vcoBlock.initSvg();
    vcoBlock.render();

    const recvSh = workspace.newBlock('synth_recv');
    recvSh.setFieldValue('sh_pitch', 'CHANNEL');
    recvSh.initSvg();
    recvSh.render();
    vcoBlock.getInput('FM').connection.connect(recvSh.outputConnection);

    const distBlock = workspace.newBlock('synth_distortion');
    distBlock.setFieldValue('tanh', 'MODE');
    attachNum(workspace, distBlock, 'DRIVE', 4.5);
    distBlock.initSvg();
    distBlock.render();

    const vcfBlock = workspace.newBlock('synth_vcf');
    attachNum(workspace, vcfBlock, 'RES', 0.82);
    vcfBlock.initSvg();
    vcfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(150, 'OUT_MIN');
    mapCutoff.setFieldValue(6800, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvEnv1 = workspace.newBlock('synth_recv');
    recvEnv1.setFieldValue('perc_env', 'CHANNEL');
    recvEnv1.initSvg();
    recvEnv1.render();
    mapCutoff.getInput('VAL').connection.connect(recvEnv1.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const vcaBlock = workspace.newBlock('synth_vca');
    vcaBlock.initSvg();
    vcaBlock.render();

    const recvEnv2 = workspace.newBlock('synth_recv');
    recvEnv2.setFieldValue('perc_env', 'CHANNEL');
    recvEnv2.initSvg();
    recvEnv2.render();
    vcaBlock.getInput('GAIN').connection.connect(recvEnv2.outputConnection);

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.33);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.55);
    attachNum(workspace, delayBlock, 'MIX', 0.40);
    delayBlock.initSvg();
    delayBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.75);
    attachNum(workspace, reverbBlock, 'DAMP', 0.30);
    attachNum(workspace, reverbBlock, 'MIX', 0.35);
    reverbBlock.initSvg();
    reverbBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.85);
    outBlock.initSvg();
    outBlock.render();

    flagBlock.nextConnection.connect(vcoBlock.previousConnection);
    vcoBlock.nextConnection.connect(distBlock.previousConnection);
    distBlock.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(vcaBlock.previousConnection);
    vcaBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 5. Bytebeat Explorer & Bitcrusher Symphony Builder
function buildBytebeatPatch(workspace) {
    workspace.clear();

    const lfoBlock = workspace.newBlock('synth_lfo');
    lfoBlock.setFieldValue('sin', 'WAVE');
    attachNum(workspace, lfoBlock, 'FREQ', 0.22);
    attachNum(workspace, lfoBlock, 'DEPTH', 1.0);
    lfoBlock.initSvg();
    lfoBlock.render();
    lfoBlock.moveTo(new Blockly.utils.Coordinate(-520, -280));

    const sendLfo = workspace.newBlock('synth_send');
    sendLfo.setFieldValue('byte_sweep', 'CHANNEL');
    sendLfo.initSvg();
    sendLfo.render();
    sendLfo.moveTo(new Blockly.utils.Coordinate(-220, -280));
    sendLfo.getInput('IN').connection.connect(lfoBlock.outputConnection);

    // Audio Stack: Flag -> Bytebeat -> Bitcrusher -> Moog VCF -> Chorus -> Delay -> Reverb -> Scope -> Out
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(100, -280));

    const bytebeatBlock = workspace.newBlock('synth_bytebeat');
    bytebeatBlock.setFieldValue('0', 'FORMULA');
    attachNum(workspace, bytebeatBlock, 'SPEED', 8000);
    bytebeatBlock.initSvg();
    bytebeatBlock.render();

    const distBlock = workspace.newBlock('synth_distortion');
    distBlock.setFieldValue('crush', 'MODE');
    attachNum(workspace, distBlock, 'DRIVE', 3.2);
    distBlock.initSvg();
    distBlock.render();

    const vcfBlock = workspace.newBlock('synth_vcf');
    attachNum(workspace, vcfBlock, 'RES', 0.65);
    vcfBlock.initSvg();
    vcfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(-1, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(300, 'OUT_MIN');
    mapCutoff.setFieldValue(5800, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvLfo = workspace.newBlock('synth_recv');
    recvLfo.setFieldValue('byte_sweep', 'CHANNEL');
    recvLfo.initSvg();
    recvLfo.render();
    mapCutoff.getInput('VAL').connection.connect(recvLfo.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const chorusBlock = workspace.newBlock('synth_chorus');
    attachNum(workspace, chorusBlock, 'RATE', 0.85);
    attachNum(workspace, chorusBlock, 'DEPTH', 0.70);
    attachNum(workspace, chorusBlock, 'MIX', 0.45);
    chorusBlock.initSvg();
    chorusBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.24);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.48);
    attachNum(workspace, delayBlock, 'MIX', 0.35);
    delayBlock.initSvg();
    delayBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.80);
    attachNum(workspace, reverbBlock, 'DAMP', 0.30);
    attachNum(workspace, reverbBlock, 'MIX', 0.32);
    reverbBlock.initSvg();
    reverbBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.85);
    outBlock.initSvg();
    outBlock.render();

    flagBlock.nextConnection.connect(bytebeatBlock.previousConnection);
    bytebeatBlock.nextConnection.connect(distBlock.previousConnection);
    distBlock.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(chorusBlock.previousConnection);
    chorusBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 6. Interactive Keyboard Performance Synth Builder
function buildKeyboardSynthPatch(workspace) {
    workspace.clear();

    const keys = [
        { key: 'KeyA', note: 60 }, // C4
        { key: 'KeyW', note: 61 }, // C#4
        { key: 'KeyS', note: 62 }, // D4
        { key: 'KeyE', note: 63 }, // D#4
        { key: 'KeyD', note: 64 }, // E4
        { key: 'KeyF', note: 65 }, // F4
        { key: 'KeyG', note: 67 }, // G4
        { key: 'KeyH', note: 69 }, // A4
        { key: 'KeyJ', note: 71 }, // B4
        { key: 'KeyK', note: 72 }  // C5
    ];

    let startY = -320;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const keyBlock = workspace.newBlock('event_whenkeypressed');
        keyBlock.setFieldValue(k.key, 'KEY');
        keyBlock.initSvg();
        keyBlock.render();
        keyBlock.moveTo(new Blockly.utils.Coordinate(-540, startY + i * 85));

        const setVar = workspace.newBlock('synth_var_set');
        setVar.setFieldValue('nota_teclado', 'VAR');
        setVar.initSvg();
        setVar.render();

        const numBlock = workspace.newBlock('math_number');
        numBlock.setFieldValue(k.note, 'NUM');
        numBlock.initSvg();
        numBlock.render();
        setVar.getInput('VAL').connection.connect(numBlock.outputConnection);

        const bcast = workspace.newBlock('event_broadcast');
        bcast.setFieldValue('tocar_tecla', 'EVENT');
        bcast.initSvg();
        bcast.render();

        keyBlock.nextConnection.connect(setVar.previousConnection);
        setVar.nextConnection.connect(bcast.previousConnection);
    }

    const listenBlock = workspace.newBlock('event_whenbroadcastreceived');
    listenBlock.setFieldValue('tocar_tecla', 'EVENT');
    listenBlock.initSvg();
    listenBlock.render();
    listenBlock.moveTo(new Blockly.utils.Coordinate(-180, -320));

    const adsrBlock = workspace.newBlock('synth_adsr');
    attachNum(workspace, adsrBlock, 'A', 0.012);
    attachNum(workspace, adsrBlock, 'D', 0.30);
    attachNum(workspace, adsrBlock, 'S', 0.25);
    attachNum(workspace, adsrBlock, 'R', 0.35);
    adsrBlock.initSvg();
    adsrBlock.render();
    adsrBlock.moveTo(new Blockly.utils.Coordinate(-180, -220));

    attachNum(workspace, adsrBlock, 'GATE', 1);

    const sendEnv = workspace.newBlock('synth_send');
    sendEnv.setFieldValue('env_tecla', 'CHANNEL');
    sendEnv.initSvg();
    sendEnv.render();
    sendEnv.moveTo(new Blockly.utils.Coordinate(60, -220));
    sendEnv.getInput('IN').connection.connect(adsrBlock.outputConnection);

    // Vibrato LFO
    const vibratoLfo = workspace.newBlock('synth_lfo');
    vibratoLfo.setFieldValue('sin', 'WAVE');
    attachNum(workspace, vibratoLfo, 'FREQ', 4.5);
    attachNum(workspace, vibratoLfo, 'DEPTH', 0.04);
    vibratoLfo.initSvg();
    vibratoLfo.render();
    vibratoLfo.moveTo(new Blockly.utils.Coordinate(-180, 40));

    const sendVibrato = workspace.newBlock('synth_send');
    sendVibrato.setFieldValue('vibrato_lfo', 'CHANNEL');
    sendVibrato.initSvg();
    sendVibrato.render();
    sendVibrato.moveTo(new Blockly.utils.Coordinate(60, 40));
    sendVibrato.getInput('IN').connection.connect(vibratoLfo.outputConnection);

    // Audio Stack: Flag -> VCO (Saw) -> Sub-Osc -> Mixer -> Moog VCF -> Fold -> VCA -> Chorus -> Reverb -> Delay -> Scope -> Out
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(260, -320));

    const vcoBlock = workspace.newBlock('synth_vco');
    vcoBlock.setFieldValue('saw', 'WAVE');
    vcoBlock.initSvg();
    vcoBlock.render();

    const noteToHz = workspace.newBlock('math_note_to_hz');
    noteToHz.initSvg();
    noteToHz.render();

    const getVar = workspace.newBlock('synth_var_get');
    getVar.setFieldValue('nota_teclado', 'VAR');
    getVar.initSvg();
    getVar.render();
    noteToHz.getInput('NOTE').connection.connect(getVar.outputConnection);
    vcoBlock.getInput('FREQ').connection.connect(noteToHz.outputConnection);

    const recvVib = workspace.newBlock('synth_recv');
    recvVib.setFieldValue('vibrato_lfo', 'CHANNEL');
    recvVib.initSvg();
    recvVib.render();
    vcoBlock.getInput('FM').connection.connect(recvVib.outputConnection);

    const subOscBlock = workspace.newBlock('synth_sub_osc');
    subOscBlock.setFieldValue('-1_sqr', 'OCT');
    subOscBlock.initSvg();
    subOscBlock.render();

    const mixerBlock = workspace.newBlock('synth_mixer');
    attachNum(workspace, mixerBlock, 'VOL1', 0.80);
    attachNum(workspace, mixerBlock, 'VOL2', 0.40);
    mixerBlock.initSvg();
    mixerBlock.render();

    const vcfBlock = workspace.newBlock('synth_vcf');
    attachNum(workspace, vcfBlock, 'RES', 0.55);
    vcfBlock.initSvg();
    vcfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(350, 'OUT_MIN');
    mapCutoff.setFieldValue(6500, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvEnv1 = workspace.newBlock('synth_recv');
    recvEnv1.setFieldValue('env_tecla', 'CHANNEL');
    recvEnv1.initSvg();
    recvEnv1.render();
    mapCutoff.getInput('VAL').connection.connect(recvEnv1.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const distBlock = workspace.newBlock('synth_distortion');
    distBlock.setFieldValue('tanh', 'MODE');
    attachNum(workspace, distBlock, 'DRIVE', 2.0);
    distBlock.initSvg();
    distBlock.render();

    const vcaBlock = workspace.newBlock('synth_vca');
    vcaBlock.initSvg();
    vcaBlock.render();

    const recvEnv2 = workspace.newBlock('synth_recv');
    recvEnv2.setFieldValue('env_tecla', 'CHANNEL');
    recvEnv2.initSvg();
    recvEnv2.render();
    vcaBlock.getInput('GAIN').connection.connect(recvEnv2.outputConnection);

    const chorusBlock = workspace.newBlock('synth_chorus');
    attachNum(workspace, chorusBlock, 'RATE', 1.1);
    attachNum(workspace, chorusBlock, 'DEPTH', 0.65);
    attachNum(workspace, chorusBlock, 'MIX', 0.55);
    chorusBlock.initSvg();
    chorusBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.75);
    attachNum(workspace, reverbBlock, 'DAMP', 0.30);
    attachNum(workspace, reverbBlock, 'MIX', 0.35);
    reverbBlock.initSvg();
    reverbBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.35);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.38);
    attachNum(workspace, delayBlock, 'MIX', 0.28);
    delayBlock.initSvg();
    delayBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.90);
    outBlock.initSvg();
    outBlock.render();

    flagBlock.nextConnection.connect(vcoBlock.previousConnection);
    vcoBlock.nextConnection.connect(subOscBlock.previousConnection);
    subOscBlock.nextConnection.connect(mixerBlock.previousConnection);
    mixerBlock.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(distBlock.previousConnection);
    distBlock.nextConnection.connect(vcaBlock.previousConnection);
    vcaBlock.nextConnection.connect(chorusBlock.previousConnection);
    chorusBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

/* =========================================================================
 * 2. Persistent Project Storage Management (localStorage & JSON)
 * ========================================================================= */

export class ProjectsManager {
    constructor(workspace, synthEngine) {
        this.workspace = workspace;
        this.synthEngine = synthEngine;
        this.activeProjectId = null;
        this.initStorage();
    }

    initStorage() {
        try {
            // Also check old storage keys to migrate any user-created custom projects
            let oldProjects = [];
            for (const oldKey of ['brack_projects_v2', 'brack_projects_v1']) {
                const oldRaw = localStorage.getItem(oldKey);
                if (oldRaw) {
                    try {
                        const parsed = JSON.parse(oldRaw);
                        if (Array.isArray(parsed)) {
                            oldProjects.push(...parsed.filter(p => !p.isExample));
                        }
                    } catch (e) {}
                }
            }

            const raw = localStorage.getItem(STORAGE_KEY);
            let projects = raw ? JSON.parse(raw) : [];

            // Add migrated user projects
            for (const op of oldProjects) {
                if (!projects.find(p => p.id === op.id)) {
                    projects.push({
                        ...op,
                        name: sanitizeText(op.name) || 'Projeto do Usuario',
                        description: sanitizeText(op.description),
                        isExample: false
                    });
                }
            }

            // Sync factory examples
            for (const preset of EXAMPLE_PRESETS) {
                const idx = projects.findIndex(p => p.id === preset.id);
                const cleanPresetObj = {
                    id: preset.id,
                    name: sanitizeText(preset.name),
                    description: sanitizeText(preset.description),
                    category: 'Exemplo',
                    isExample: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    data: null
                };

                if (idx >= 0) {
                    // Update metadata for factory preset
                    projects[idx].name = cleanPresetObj.name;
                    projects[idx].description = cleanPresetObj.description;
                    projects[idx].isExample = true;
                } else {
                    projects.push(cleanPresetObj);
                }
            }

            // Clean any emojis from all project names
            for (const p of projects) {
                p.name = sanitizeText(p.name);
                p.description = sanitizeText(p.description);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));

            this.activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'acid_bass';
            if (!projects.find(p => p.id === this.activeProjectId)) {
                this.activeProjectId = 'acid_bass';
            }
        } catch (e) {
            console.error('Failed to init projects storage:', e);
        }
    }

    getAllProjects() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    getProject(id) {
        const projects = this.getAllProjects();
        return projects.find(p => p.id === id) || null;
    }

    getActiveProjectId() {
        return this.activeProjectId || 'acid_bass';
    }

    setActiveProjectId(id) {
        this.activeProjectId = id;
        try {
            localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        } catch (e) {}
    }

    loadProject(id) {
        const project = this.getProject(id);
        if (!project) return false;

        const preset = EXAMPLE_PRESETS.find(p => p.id === id);

        if (preset && (!project.data || Object.keys(project.data).length === 0)) {
            preset.builder(this.workspace);
        } else if (project.data && window.Blockly && Blockly.serialization) {
            this.workspace.clear();
            try {
                Blockly.serialization.workspaces.load(project.data, this.workspace);
            } catch (err) {
                console.warn('Serialization load failed, falling back to preset builder if available:', err);
                if (preset) preset.builder(this.workspace);
            }
        } else if (preset) {
            preset.builder(this.workspace);
        }

        this.setActiveProjectId(id);
        this.workspace.scrollCenter();
        if (this.synthEngine) this.synthEngine.compile();
        return true;
    }

    saveCurrentProject() {
        if (!this.workspace || !window.Blockly || !Blockly.serialization) return null;

        const currentId = this.getActiveProjectId();
        const current = this.getProject(currentId);

        if (current && current.isExample) {
            // Can't overwrite original example directly without prompt or copy
            return null;
        }

        const workspaceState = Blockly.serialization.workspaces.save(this.workspace);
        const projects = this.getAllProjects();
        const idx = projects.findIndex(p => p.id === currentId);

        if (idx >= 0) {
            projects[idx].data = workspaceState;
            projects[idx].updatedAt = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
            return projects[idx];
        }

        return null;
    }

    saveAsNewProject(name, description = '') {
        if (!this.workspace || !window.Blockly || !Blockly.serialization) return null;

        const cleanName = sanitizeText(name) || 'Projeto Sem Titulo';
        const cleanDesc = sanitizeText(description);
        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const workspaceState = Blockly.serialization.workspaces.save(this.workspace);

        const newProject = {
            id: newId,
            name: cleanName,
            description: cleanDesc,
            category: 'Usuario',
            isExample: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: workspaceState
        };

        const projects = this.getAllProjects();
        projects.push(newProject);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));

        this.setActiveProjectId(newId);
        return newProject;
    }

    duplicateProject(id) {
        const source = this.getProject(id);
        if (!source) return null;

        const cleanSource = sanitizeText(source.name);
        const copyName = `${cleanSource} (Copia)`;
        let projectData = source.data;

        // If source is a factory example without saved state, build and serialize it
        if (!projectData || Object.keys(projectData).length === 0) {
            const preset = EXAMPLE_PRESETS.find(p => p.id === id);
            if (preset) {
                const tempDiv = document.createElement('div');
                tempDiv.style.display = 'none';
                document.body.appendChild(tempDiv);
                const tempWs = Blockly.inject(tempDiv, {});
                preset.builder(tempWs);
                projectData = Blockly.serialization.workspaces.save(tempWs);
                tempWs.dispose();
                tempDiv.remove();
            }
        }

        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newProject = {
            id: newId,
            name: copyName,
            description: source.description || '',
            category: 'Usuario',
            isExample: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: projectData
        };

        const projects = this.getAllProjects();
        projects.push(newProject);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        return newProject;
    }

    renameProject(id, newName) {
        const cleanName = sanitizeText(newName);
        if (!cleanName) return false;

        const projects = this.getAllProjects();
        const idx = projects.findIndex(p => p.id === id);
        if (idx >= 0 && !projects[idx].isExample) {
            projects[idx].name = cleanName;
            projects[idx].updatedAt = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
            return true;
        }
        return false;
    }

    deleteProject(id) {
        const projects = this.getAllProjects();
        const project = projects.find(p => p.id === id);
        if (!project || project.isExample) return false;

        const filtered = projects.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

        if (this.activeProjectId === id) {
            this.loadProject('acid_bass');
        }
        return true;
    }

    exportProjectJson(id) {
        const project = this.getProject(id);
        if (!project) return;

        let exportData = { ...project };
        if (!exportData.data || Object.keys(exportData.data).length === 0) {
            const preset = EXAMPLE_PRESETS.find(p => p.id === id);
            if (preset) {
                const tempDiv = document.createElement('div');
                tempDiv.style.display = 'none';
                document.body.appendChild(tempDiv);
                const tempWs = Blockly.inject(tempDiv, {});
                preset.builder(tempWs);
                exportData.data = Blockly.serialization.workspaces.save(tempWs);
                tempWs.dispose();
                tempDiv.remove();
            }
        }

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = sanitizeText(project.name).toLowerCase().replace(/[^a-z0-9]/g, '_') || 'brack_project';
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importProjectJson(input) {
        if (typeof input === 'string' || (input && typeof input === 'object' && !(input instanceof Blob))) {
            const parsed = typeof input === 'string' ? JSON.parse(input) : input;
            let projData = null;
            let name = "Projeto Importado";
            let description = "Importado via arquivo JSON";

            if (parsed.app === "BRACK_MODULAR_SYNTH" && parsed.project) {
                projData = parsed.project.data;
                name = parsed.project.name || name;
                description = parsed.project.description || description;
            } else if (parsed.data) {
                projData = parsed.data;
                name = parsed.name || name;
                description = parsed.description || description;
            } else if (parsed.blocks) {
                projData = parsed;
            } else {
                throw new Error('Arquivo de projeto BRACK invalido.');
            }

            const cleanName = sanitizeText(name) || 'Projeto Importado';
            const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const newProject = {
                id: newId,
                name: cleanName,
                description: sanitizeText(description),
                category: 'Usuario',
                isExample: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                data: projData
            };

            const projects = this.getAllProjects();
            projects.push(newProject);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));

            this.loadProject(newId);
            return newProject;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = this.importProjectJson(e.target.result);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(input);
        });
    }

    resetFactoryExamples() {
        const currentProjects = this.getAllProjects();
        const userProjects = currentProjects.filter(p => !p.isExample);

        const freshExamples = EXAMPLE_PRESETS.map(preset => ({
            id: preset.id,
            name: sanitizeText(preset.name),
            description: sanitizeText(preset.description),
            category: 'Exemplo',
            isExample: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: null
        }));

        const all = [...freshExamples, ...userProjects];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        this.loadProject('acid_bass');
        return true;
    }
}
