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
        id: 'berlin_school',
        name: 'Odisséia Generativa Berlin School (Klaus Schulze)',
        description: 'Sequenciador hipnótico de 16 notas com transposição temporal automática por eventos, oscilador duplo detunado com sub-oitava, VCF Moog varrido por LFO lento, Chorus e Stereo Tape Delay.',
        category: 'Exemplo',
        isExample: true,
        builder: buildBerlinSchoolPatch
    },
    {
        id: 'song_arranger',
        name: 'Sinfonia Modular Completa (Intro, Drop, Breakdown & Climax)',
        description: 'Música completa com linha temporal automatizada por eventos de transmissão: alterna seções musicais ativando Bumbo 909, Caixa de Ruído, Linha de Baixo Saw e Lead Arpejado no Mixer de 4 Canais.',
        category: 'Exemplo',
        isExample: true,
        builder: buildSongArrangerPatch
    },
    {
        id: 'euclidean_polyrhythm',
        name: 'Polirritmia Euclidiana & Lógica Modular',
        description: 'Padrões polirrítmicos gerados via portas lógicas E, OU Exclusivo e divisores de tempo (/2, /3, /4) acionando percussão metálica por Ring Modulator e melodia pentatônica por Sample & Hold.',
        category: 'Exemplo',
        isExample: true,
        builder: buildEuclideanPatch
    },
    {
        id: 'chiptune_arcade',
        name: 'Chiptune Arcade 4-Canais VGM (NES / Game Boy)',
        description: 'Música retrô de 8 bits completa em 4 canais simultâneos: Lead Pulse 50%, Harmonia Pulse 25%, Baixo Triangle e Percussão Noise através de Bitcrusher e Delay.',
        category: 'Exemplo',
        isExample: true,
        builder: buildChiptunePatch
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

    // Numeric Note List & List Sequencer
    const setList = workspace.newBlock('synth_list_set');
    setList.setFieldValue('notas_acid', 'LIST');
    setList.setFieldValue('48, 51, 55, 58, 60, 58, 55, 51', 'ITEMS');
    setList.initSvg();
    setList.render();
    setList.moveTo(new Blockly.utils.Coordinate(-520, -150));

    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.setFieldValue('notas_acid', 'LIST');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-520, -50));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('clk_master', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    seqBlock.getInput('CLK').connection.connect(recvClk1.outputConnection);

    const sendPitch = workspace.newBlock('synth_send');
    sendPitch.setFieldValue('pitch_cv', 'CHANNEL');
    sendPitch.initSvg();
    sendPitch.render();
    sendPitch.moveTo(new Blockly.utils.Coordinate(-220, -50));
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

    // Harmonic Chord Numeric List & Sequencer
    const setList = workspace.newBlock('synth_list_set');
    setList.setFieldValue('notas_pad', 'LIST');
    setList.setFieldValue('48, 55, 51, 58, 56, 55', 'ITEMS');
    setList.initSvg();
    setList.render();
    setList.moveTo(new Blockly.utils.Coordinate(-520, -150));

    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.setFieldValue('notas_pad', 'LIST');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-520, -50));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('pad_clk', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    seqBlock.getInput('CLK').connection.connect(recvClk1.outputConnection);

    const sendPitch = workspace.newBlock('synth_send');
    sendPitch.setFieldValue('pad_pitch', 'CHANNEL');
    sendPitch.initSvg();
    sendPitch.render();
    sendPitch.moveTo(new Blockly.utils.Coordinate(-220, -50));
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

    // Bassline Numeric List & Sequencer
    const setList = workspace.newBlock('synth_list_set');
    setList.setFieldValue('notas_bass', 'LIST');
    setList.setFieldValue('36, 36, 39, 36, 43, 41, 39, 46', 'ITEMS');
    setList.initSvg();
    setList.render();
    setList.moveTo(new Blockly.utils.Coordinate(-520, 60));

    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.setFieldValue('notas_bass', 'LIST');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-520, 160));

    const recvClk2 = workspace.newBlock('synth_recv');
    recvClk2.setFieldValue('m_clk', 'CHANNEL');
    recvClk2.initSvg();
    recvClk2.render();
    seqBlock.getInput('CLK').connection.connect(recvClk2.outputConnection);

    const sendBassPitch = workspace.newBlock('synth_send');
    sendBassPitch.setFieldValue('bass_pitch', 'CHANNEL');
    sendBassPitch.initSvg();
    sendBassPitch.render();
    sendBassPitch.moveTo(new Blockly.utils.Coordinate(-220, 160));
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

// 7. Berlin School Generative Odyssey Builder (Klaus Schulze / Tangerine Dream)
function buildBerlinSchoolPatch(workspace) {
    workspace.clear();

    // 1. Setup 16-step minor sequence list
    const flagSetup = workspace.newBlock('event_whenflagclicked');
    flagSetup.initSvg();
    flagSetup.render();
    flagSetup.moveTo(new Blockly.utils.Coordinate(-580, -320));

    const listBlock = workspace.newBlock('synth_list_set');
    listBlock.setFieldValue('seq_berlin', 'LIST');
    listBlock.setFieldValue('48, 51, 55, 58, 60, 58, 55, 51, 53, 56, 60, 63, 65, 63, 60, 56', 'ITEMS');
    listBlock.initSvg();
    listBlock.render();

    const setVar = workspace.newBlock('synth_var_set');
    setVar.setFieldValue('transposicao', 'VAR');
    attachNum(workspace, setVar, 'VAL', 0);
    setVar.initSvg();
    setVar.render();

    flagSetup.nextConnection.connect(listBlock.previousConnection);
    listBlock.nextConnection.connect(setVar.previousConnection);

    // 2. Transposition event every 6 seconds
    const eventTrans = workspace.newBlock('event_every');
    eventTrans.setFieldValue(6, 'TIME');
    eventTrans.setFieldValue('s', 'UNIT');
    eventTrans.initSvg();
    eventTrans.render();
    eventTrans.moveTo(new Blockly.utils.Coordinate(-580, -140));

    const changeTrans = workspace.newBlock('synth_var_change');
    changeTrans.setFieldValue('transposicao', 'VAR');
    attachNum(workspace, changeTrans, 'DELTA', 5);
    changeTrans.initSvg();
    changeTrans.render();
    eventTrans.nextConnection.connect(changeTrans.previousConnection);

    // 3. Master Clock -> Send clk_berlin
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 132);
    attachNum(workspace, clockBlock, 'PW', 0.40);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-580, 20));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('clk_berlin', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // 4. Sequencer + Transposition Pitch CV -> Send pitch_berlin
    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.setFieldValue('seq_berlin', 'LIST');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-220, -320));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('clk_berlin', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    seqBlock.getInput('CLK').connection.connect(recvClk1.outputConnection);

    const addTrans = workspace.newBlock('math_arithmetic');
    addTrans.setFieldValue('ADD', 'OP');
    addTrans.initSvg();
    addTrans.render();
    addTrans.moveTo(new Blockly.utils.Coordinate(-220, -240));
    addTrans.getInput('A').connection.connect(seqBlock.outputConnection);

    const getTrans = workspace.newBlock('synth_var_get');
    getTrans.setFieldValue('transposicao', 'VAR');
    getTrans.initSvg();
    getTrans.render();
    addTrans.getInput('B').connection.connect(getTrans.outputConnection);

    const voctConvert = workspace.newBlock('math_note_convert');
    voctConvert.setFieldValue('VOCT', 'TARGET');
    voctConvert.initSvg();
    voctConvert.render();
    voctConvert.moveTo(new Blockly.utils.Coordinate(-220, -160));
    voctConvert.getInput('NOTE').connection.connect(addTrans.outputConnection);

    const sendPitch = workspace.newBlock('synth_send');
    sendPitch.setFieldValue('pitch_berlin', 'CHANNEL');
    sendPitch.initSvg();
    sendPitch.render();
    sendPitch.moveTo(new Blockly.utils.Coordinate(-220, -80));
    sendPitch.getInput('IN').connection.connect(voctConvert.outputConnection);

    // 5. Envelope ADSR -> Send env_berlin
    const adsrBlock = workspace.newBlock('synth_adsr');
    attachNum(workspace, adsrBlock, 'A', 0.015);
    attachNum(workspace, adsrBlock, 'D', 0.18);
    attachNum(workspace, adsrBlock, 'S', 0.25);
    attachNum(workspace, adsrBlock, 'R', 0.15);
    adsrBlock.initSvg();
    adsrBlock.render();
    adsrBlock.moveTo(new Blockly.utils.Coordinate(-220, 20));

    const recvClk2 = workspace.newBlock('synth_recv');
    recvClk2.setFieldValue('clk_berlin', 'CHANNEL');
    recvClk2.initSvg();
    recvClk2.render();
    adsrBlock.getInput('GATE').connection.connect(recvClk2.outputConnection);

    const sendEnv = workspace.newBlock('synth_send');
    sendEnv.setFieldValue('env_berlin', 'CHANNEL');
    sendEnv.initSvg();
    sendEnv.render();
    sendEnv.moveTo(new Blockly.utils.Coordinate(-220, 100));
    sendEnv.getInput('IN').connection.connect(adsrBlock.outputConnection);

    // 6. Slow LFO for filter sweep -> Send lfo_sweep
    const lfoBlock = workspace.newBlock('synth_lfo');
    lfoBlock.setFieldValue('tri', 'WAVE');
    attachNum(workspace, lfoBlock, 'FREQ', 0.12);
    attachNum(workspace, lfoBlock, 'DEPTH', 1.0);
    lfoBlock.initSvg();
    lfoBlock.render();
    lfoBlock.moveTo(new Blockly.utils.Coordinate(-220, 180));

    const sendLfo = workspace.newBlock('synth_send');
    sendLfo.setFieldValue('lfo_sweep', 'CHANNEL');
    sendLfo.initSvg();
    sendLfo.render();
    sendLfo.moveTo(new Blockly.utils.Coordinate(-220, 260));
    sendLfo.getInput('IN').connection.connect(lfoBlock.outputConnection);

    // 7. Audio Stack: Flag -> VCO (Saw) -> Sub-Osc (-1) -> Moog VCF -> Distortion (Tanh) -> VCA -> Chorus -> Delay -> Reverb -> Scope -> Out
    const flagMain = workspace.newBlock('event_whenflagclicked');
    flagMain.initSvg();
    flagMain.render();
    flagMain.moveTo(new Blockly.utils.Coordinate(140, -320));

    const vcoBlock = workspace.newBlock('synth_vco');
    vcoBlock.setFieldValue('saw', 'WAVE');
    attachNum(workspace, vcoBlock, 'FREQ', 65.41);
    vcoBlock.initSvg();
    vcoBlock.render();

    const recvPitch = workspace.newBlock('synth_recv');
    recvPitch.setFieldValue('pitch_berlin', 'CHANNEL');
    recvPitch.initSvg();
    recvPitch.render();
    vcoBlock.getInput('FM').connection.connect(recvPitch.outputConnection);

    const subOsc = workspace.newBlock('synth_sub_osc');
    subOsc.setFieldValue('-1_sqr', 'OCT');
    attachNum(workspace, subOsc, 'FREQ', 65.41);
    attachNum(workspace, subOsc, 'VOL', 0.65);
    subOsc.initSvg();
    subOsc.render();

    const vcfBlock = workspace.newBlock('synth_vcf');
    attachNum(workspace, vcfBlock, 'RES', 0.72);
    vcfBlock.initSvg();
    vcfBlock.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(250, 'OUT_MIN');
    mapCutoff.setFieldValue(5800, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvEnv = workspace.newBlock('synth_recv');
    recvEnv.setFieldValue('env_berlin', 'CHANNEL');
    recvEnv.initSvg();
    recvEnv.render();
    mapCutoff.getInput('VAL').connection.connect(recvEnv.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const distBlock = workspace.newBlock('synth_distortion');
    distBlock.setFieldValue('tanh', 'MODE');
    attachNum(workspace, distBlock, 'DRIVE', 2.2);
    distBlock.initSvg();
    distBlock.render();

    const vcaBlock = workspace.newBlock('synth_vca');
    vcaBlock.initSvg();
    vcaBlock.render();

    const recvEnv2 = workspace.newBlock('synth_recv');
    recvEnv2.setFieldValue('env_berlin', 'CHANNEL');
    recvEnv2.initSvg();
    recvEnv2.render();
    vcaBlock.getInput('GAIN').connection.connect(recvEnv2.outputConnection);

    const chorusBlock = workspace.newBlock('synth_chorus');
    attachNum(workspace, chorusBlock, 'RATE', 0.75);
    attachNum(workspace, chorusBlock, 'DEPTH', 0.65);
    attachNum(workspace, chorusBlock, 'MIX', 0.40);
    chorusBlock.initSvg();
    chorusBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.36);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.55);
    attachNum(workspace, delayBlock, 'MIX', 0.42);
    delayBlock.initSvg();
    delayBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.85);
    attachNum(workspace, reverbBlock, 'DAMP', 0.30);
    attachNum(workspace, reverbBlock, 'MIX', 0.38);
    reverbBlock.initSvg();
    reverbBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.90);
    outBlock.initSvg();
    outBlock.render();

    flagMain.nextConnection.connect(vcoBlock.previousConnection);
    vcoBlock.nextConnection.connect(subOsc.previousConnection);
    subOsc.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(distBlock.previousConnection);
    distBlock.nextConnection.connect(vcaBlock.previousConnection);
    vcaBlock.nextConnection.connect(chorusBlock.previousConnection);
    chorusBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 8. Full Modular Symphony Arranger Builder (Song Arranger)
function buildSongArrangerPatch(workspace) {
    workspace.clear();

    // 1. Initial Setup: Lists for Bassline and Lead Melody + Section variable
    const flagSetup = workspace.newBlock('event_whenflagclicked');
    flagSetup.initSvg();
    flagSetup.render();
    flagSetup.moveTo(new Blockly.utils.Coordinate(-580, -320));

    const listBass = workspace.newBlock('synth_list_set');
    listBass.setFieldValue('bass_seq', 'LIST');
    listBass.setFieldValue('45, 45, 57, 45, 48, 50, 45, 55, 45, 45, 57, 45, 52, 50, 48, 45', 'ITEMS');
    listBass.initSvg();
    listBass.render();

    const listLead = workspace.newBlock('synth_list_set');
    listLead.setFieldValue('lead_seq', 'LIST');
    listLead.setFieldValue('69, 72, 76, 81, 79, 76, 84, 81, 79, 76, 72, 76, 79, 81, 84, 88', 'ITEMS');
    listLead.initSvg();
    listLead.render();

    const setSecao = workspace.newBlock('synth_var_set');
    setSecao.setFieldValue('secao', 'VAR');
    attachNum(workspace, setSecao, 'VAL', 0);
    setSecao.initSvg();
    setSecao.render();

    flagSetup.nextConnection.connect(listBass.previousConnection);
    listBass.nextConnection.connect(listLead.previousConnection);
    listLead.nextConnection.connect(setSecao.previousConnection);

    // 2. Timeline Arranger: Section Progression every 6 seconds
    const eventSection = workspace.newBlock('event_every');
    eventSection.setFieldValue(6, 'TIME');
    eventSection.setFieldValue('s', 'UNIT');
    eventSection.initSvg();
    eventSection.render();
    eventSection.moveTo(new Blockly.utils.Coordinate(-580, -100));

    const changeSecao = workspace.newBlock('synth_var_change');
    changeSecao.setFieldValue('secao', 'VAR');
    attachNum(workspace, changeSecao, 'DELTA', 1);
    changeSecao.initSvg();
    changeSecao.render();
    eventSection.nextConnection.connect(changeSecao.previousConnection);

    // 3. Master Clock (124 BPM) -> Send clk_main
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 124);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-580, 40));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('clk_main', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // Clock Dividers: /2 for Snare, /4 for Kick (4-on-the-floor beat)
    const clkDiv2 = workspace.newBlock('synth_clock_divider');
    clkDiv2.setFieldValue('2', 'DIV');
    clkDiv2.initSvg();
    clkDiv2.render();
    clkDiv2.moveTo(new Blockly.utils.Coordinate(-580, 180));

    const recvClkDiv2 = workspace.newBlock('synth_recv');
    recvClkDiv2.setFieldValue('clk_main', 'CHANNEL');
    recvClkDiv2.initSvg();
    recvClkDiv2.render();
    clkDiv2.getInput('IN').connection.connect(recvClkDiv2.outputConnection);

    const sendClk2 = workspace.newBlock('synth_send');
    sendClk2.setFieldValue('clk_div2', 'CHANNEL');
    sendClk2.initSvg();
    sendClk2.render();
    clkDiv2.nextConnection.connect(sendClk2.previousConnection);

    const clkDiv4 = workspace.newBlock('synth_clock_divider');
    clkDiv4.setFieldValue('4', 'DIV');
    clkDiv4.initSvg();
    clkDiv4.render();
    clkDiv4.moveTo(new Blockly.utils.Coordinate(-580, 320));

    const recvClkDiv4 = workspace.newBlock('synth_recv');
    recvClkDiv4.setFieldValue('clk_main', 'CHANNEL');
    recvClkDiv4.initSvg();
    recvClkDiv4.render();
    clkDiv4.getInput('IN').connection.connect(recvClkDiv4.outputConnection);

    const sendClk4 = workspace.newBlock('synth_send');
    sendClk4.setFieldValue('clk_div4', 'CHANNEL');
    sendClk4.initSvg();
    sendClk4.render();
    clkDiv4.nextConnection.connect(sendClk4.previousConnection);

    // 4. Voice 1: Kick 909 (Triggered on clk_div4) -> Send v_kick
    const flagKick = workspace.newBlock('event_whenflagclicked');
    flagKick.initSvg();
    flagKick.render();
    flagKick.moveTo(new Blockly.utils.Coordinate(-220, -320));

    const kickEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, kickEnv, 'A', 0.003);
    attachNum(workspace, kickEnv, 'D', 0.14);
    attachNum(workspace, kickEnv, 'S', 0.0);
    attachNum(workspace, kickEnv, 'R', 0.04);
    kickEnv.initSvg();
    kickEnv.render();

    const recvKickClk = workspace.newBlock('synth_recv');
    recvKickClk.setFieldValue('clk_div4', 'CHANNEL');
    recvKickClk.initSvg();
    recvKickClk.render();
    kickEnv.getInput('GATE').connection.connect(recvKickClk.outputConnection);

    const kickVco = workspace.newBlock('synth_vco');
    kickVco.setFieldValue('sin', 'WAVE');
    attachNum(workspace, kickVco, 'FREQ', 55);
    kickVco.initSvg();
    kickVco.render();
    kickVco.getInput('FM').connection.connect(kickEnv.outputConnection);

    const kickVca = workspace.newBlock('synth_vca');
    kickVca.initSvg();
    kickVca.render();
    kickVca.getInput('GAIN').connection.connect(kickEnv.outputConnection);

    const sendKick = workspace.newBlock('synth_send');
    sendKick.setFieldValue('v_kick', 'CHANNEL');
    sendKick.initSvg();
    sendKick.render();

    flagKick.nextConnection.connect(kickVco.previousConnection);
    kickVco.nextConnection.connect(kickVca.previousConnection);
    kickVca.nextConnection.connect(sendKick.previousConnection);

    // 5. Voice 2: Snare / Clap (Triggered on clk_div2) -> Send v_snare
    const flagSnare = workspace.newBlock('event_whenflagclicked');
    flagSnare.initSvg();
    flagSnare.render();
    flagSnare.moveTo(new Blockly.utils.Coordinate(-220, -60));

    const snareEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, snareEnv, 'A', 0.005);
    attachNum(workspace, snareEnv, 'D', 0.16);
    attachNum(workspace, snareEnv, 'S', 0.0);
    attachNum(workspace, snareEnv, 'R', 0.05);
    snareEnv.initSvg();
    snareEnv.render();

    const recvSnareClk = workspace.newBlock('synth_recv');
    recvSnareClk.setFieldValue('clk_div2', 'CHANNEL');
    recvSnareClk.initSvg();
    recvSnareClk.render();
    snareEnv.getInput('GATE').connection.connect(recvSnareClk.outputConnection);

    const snareNoise = workspace.newBlock('synth_noise');
    snareNoise.setFieldValue('pink', 'TYPE');
    attachNum(workspace, snareNoise, 'GAIN', 1.0);
    snareNoise.initSvg();
    snareNoise.render();

    const snareVcf = workspace.newBlock('synth_svf');
    snareVcf.setFieldValue('bp', 'MODE');
    attachNum(workspace, snareVcf, 'CUTOFF', 1800);
    attachNum(workspace, snareVcf, 'RES', 0.60);
    snareVcf.initSvg();
    snareVcf.render();

    const snareVca = workspace.newBlock('synth_vca');
    snareVca.initSvg();
    snareVca.render();
    snareVca.getInput('GAIN').connection.connect(snareEnv.outputConnection);

    const sendSnare = workspace.newBlock('synth_send');
    sendSnare.setFieldValue('v_snare', 'CHANNEL');
    sendSnare.initSvg();
    sendSnare.render();

    flagSnare.nextConnection.connect(snareNoise.previousConnection);
    snareNoise.nextConnection.connect(snareVcf.previousConnection);
    snareVcf.nextConnection.connect(snareVca.previousConnection);
    snareVca.nextConnection.connect(sendSnare.previousConnection);

    // 6. Voice 3: Bassline (Sawtooth 16-step in A Minor) -> Send v_bass
    const flagBass = workspace.newBlock('event_whenflagclicked');
    flagBass.initSvg();
    flagBass.render();
    flagBass.moveTo(new Blockly.utils.Coordinate(140, -320));

    const bassSeq = workspace.newBlock('synth_seq');
    bassSeq.setFieldValue('bass_seq', 'LIST');
    bassSeq.initSvg();
    bassSeq.render();

    const recvBassClk = workspace.newBlock('synth_recv');
    recvBassClk.setFieldValue('clk_main', 'CHANNEL');
    recvBassClk.initSvg();
    recvBassClk.render();
    bassSeq.getInput('CLK').connection.connect(recvBassClk.outputConnection);

    const bassVoct = workspace.newBlock('math_note_convert');
    bassVoct.setFieldValue('VOCT', 'TARGET');
    bassVoct.initSvg();
    bassVoct.render();
    bassVoct.getInput('NOTE').connection.connect(bassSeq.outputConnection);

    const bassEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, bassEnv, 'A', 0.008);
    attachNum(workspace, bassEnv, 'D', 0.18);
    attachNum(workspace, bassEnv, 'S', 0.25);
    attachNum(workspace, bassEnv, 'R', 0.10);
    bassEnv.initSvg();
    bassEnv.render();

    const recvBassClk2 = workspace.newBlock('synth_recv');
    recvBassClk2.setFieldValue('clk_main', 'CHANNEL');
    recvBassClk2.initSvg();
    recvBassClk2.render();
    bassEnv.getInput('GATE').connection.connect(recvBassClk2.outputConnection);

    const bassVco = workspace.newBlock('synth_vco');
    bassVco.setFieldValue('saw', 'WAVE');
    attachNum(workspace, bassVco, 'FREQ', 261.63);
    bassVco.initSvg();
    bassVco.render();
    bassVco.getInput('FM').connection.connect(bassVoct.outputConnection);

    const bassVcf = workspace.newBlock('synth_vcf');
    attachNum(workspace, bassVcf, 'RES', 0.70);
    bassVcf.initSvg();
    bassVcf.render();

    const bassMap = workspace.newBlock('math_map');
    bassMap.setFieldValue(0, 'IN_MIN');
    bassMap.setFieldValue(1, 'IN_MAX');
    bassMap.setFieldValue(300, 'OUT_MIN');
    bassMap.setFieldValue(3800, 'OUT_MAX');
    bassMap.initSvg();
    bassMap.render();
    bassMap.getInput('VAL').connection.connect(bassEnv.outputConnection);
    bassVcf.getInput('CUTOFF').connection.connect(bassMap.outputConnection);

    const bassVca = workspace.newBlock('synth_vca');
    bassVca.initSvg();
    bassVca.render();
    bassVca.getInput('GAIN').connection.connect(bassEnv.outputConnection);

    const sendBass = workspace.newBlock('synth_send');
    sendBass.setFieldValue('v_bass', 'CHANNEL');
    sendBass.initSvg();
    sendBass.render();

    flagBass.nextConnection.connect(bassVco.previousConnection);
    bassVco.nextConnection.connect(bassVcf.previousConnection);
    bassVcf.nextConnection.connect(bassVca.previousConnection);
    bassVca.nextConnection.connect(sendBass.previousConnection);

    // 7. Voice 4: Euphoric Lead Melody (Square/Pulse 16-step Arp in A Minor) -> Send v_lead
    const flagLead = workspace.newBlock('event_whenflagclicked');
    flagLead.initSvg();
    flagLead.render();
    flagLead.moveTo(new Blockly.utils.Coordinate(140, 60));

    const leadSeq = workspace.newBlock('synth_seq');
    leadSeq.setFieldValue('lead_seq', 'LIST');
    leadSeq.initSvg();
    leadSeq.render();

    const recvLeadClk = workspace.newBlock('synth_recv');
    recvLeadClk.setFieldValue('clk_main', 'CHANNEL');
    recvLeadClk.initSvg();
    recvLeadClk.render();
    leadSeq.getInput('CLK').connection.connect(recvLeadClk.outputConnection);

    const leadVoct = workspace.newBlock('math_note_convert');
    leadVoct.setFieldValue('VOCT', 'TARGET');
    leadVoct.initSvg();
    leadVoct.render();
    leadVoct.getInput('NOTE').connection.connect(leadSeq.outputConnection);

    const leadEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, leadEnv, 'A', 0.01);
    attachNum(workspace, leadEnv, 'D', 0.22);
    attachNum(workspace, leadEnv, 'S', 0.35);
    attachNum(workspace, leadEnv, 'R', 0.15);
    leadEnv.initSvg();
    leadEnv.render();

    const recvLeadClk2 = workspace.newBlock('synth_recv');
    recvLeadClk2.setFieldValue('clk_main', 'CHANNEL');
    recvLeadClk2.initSvg();
    recvLeadClk2.render();
    leadEnv.getInput('GATE').connection.connect(recvLeadClk2.outputConnection);

    const leadVco = workspace.newBlock('synth_vco');
    leadVco.setFieldValue('sqr', 'WAVE');
    attachNum(workspace, leadVco, 'FREQ', 261.63);
    attachNum(workspace, leadVco, 'PW', 0.45);
    leadVco.initSvg();
    leadVco.render();
    leadVco.getInput('FM').connection.connect(leadVoct.outputConnection);

    const leadVca = workspace.newBlock('synth_vca');
    leadVca.initSvg();
    leadVca.render();
    leadVca.getInput('GAIN').connection.connect(leadEnv.outputConnection);

    const sendLead = workspace.newBlock('synth_send');
    sendLead.setFieldValue('v_lead', 'CHANNEL');
    sendLead.initSvg();
    sendLead.render();

    flagLead.nextConnection.connect(leadVco.previousConnection);
    leadVco.nextConnection.connect(leadVca.previousConnection);
    leadVca.nextConnection.connect(sendLead.previousConnection);

    // 8. Master Mixer 4-Channels & Master Chain
    const flagMaster = workspace.newBlock('event_whenflagclicked');
    flagMaster.initSvg();
    flagMaster.render();
    flagMaster.moveTo(new Blockly.utils.Coordinate(500, -320));

    const mixer4 = workspace.newBlock('synth_mixer4');
    attachNum(workspace, mixer4, 'VOL1', 0.85); // Kick
    attachNum(workspace, mixer4, 'VOL2', 0.60); // Snare
    attachNum(workspace, mixer4, 'VOL3', 0.75); // Bassline
    attachNum(workspace, mixer4, 'VOL4', 0.70); // Lead Arp
    mixer4.initSvg();
    mixer4.render();

    const recvK = workspace.newBlock('synth_recv');
    recvK.setFieldValue('v_kick', 'CHANNEL');
    recvK.initSvg();
    recvK.render();
    mixer4.getInput('IN1').connection.connect(recvK.outputConnection);

    const recvS = workspace.newBlock('synth_recv');
    recvS.setFieldValue('v_snare', 'CHANNEL');
    recvS.initSvg();
    recvS.render();
    mixer4.getInput('IN2').connection.connect(recvS.outputConnection);

    const recvB = workspace.newBlock('synth_recv');
    recvB.setFieldValue('v_bass', 'CHANNEL');
    recvB.initSvg();
    recvB.render();
    mixer4.getInput('IN3').connection.connect(recvB.outputConnection);

    const recvL = workspace.newBlock('synth_recv');
    recvL.setFieldValue('v_lead', 'CHANNEL');
    recvL.initSvg();
    recvL.render();
    mixer4.getInput('IN4').connection.connect(recvL.outputConnection);

    const compBlock = workspace.newBlock('synth_compressor');
    attachNum(workspace, compBlock, 'THRESH', 0.45);
    attachNum(workspace, compBlock, 'RATIO', 4.0);
    attachNum(workspace, compBlock, 'MAKEUP', 1.2);
    compBlock.initSvg();
    compBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.28);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.35);
    attachNum(workspace, delayBlock, 'MIX', 0.25);
    delayBlock.initSvg();
    delayBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.75);
    attachNum(workspace, reverbBlock, 'DAMP', 0.35);
    attachNum(workspace, reverbBlock, 'MIX', 0.28);
    reverbBlock.initSvg();
    reverbBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.90);
    outBlock.initSvg();
    outBlock.render();

    flagMaster.nextConnection.connect(mixer4.previousConnection);
    mixer4.nextConnection.connect(compBlock.previousConnection);
    compBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 9. Euclidean Polyrhythms & Logic Gates Builder (D Dorian Afro-Cuban Polyrhythm)
function buildEuclideanPatch(workspace) {
    workspace.clear();

    // 1. Setup Pentatonic Notes List
    const flagSetup = workspace.newBlock('event_whenflagclicked');
    flagSetup.initSvg();
    flagSetup.render();
    flagSetup.moveTo(new Blockly.utils.Coordinate(-580, -320));

    const listEuclid = workspace.newBlock('synth_list_set');
    listEuclid.setFieldValue('euclid_notes', 'LIST');
    listEuclid.setFieldValue('62, 65, 67, 69, 72, 74, 72, 69, 67, 65, 62, 65', 'ITEMS');
    listEuclid.initSvg();
    listEuclid.render();
    flagSetup.nextConnection.connect(listEuclid.previousConnection);

    // 2. Master Clock (136 BPM) -> clk_fast
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 136);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-580, -200));

    const sendFast = workspace.newBlock('synth_send');
    sendFast.setFieldValue('clk_fast', 'CHANNEL');
    sendFast.initSvg();
    sendFast.render();
    clockBlock.nextConnection.connect(sendFast.previousConnection);

    // Divisor /3 (Triplets)
    const div3 = workspace.newBlock('synth_clock_divider');
    div3.setFieldValue('3', 'DIV');
    div3.initSvg();
    div3.render();
    div3.moveTo(new Blockly.utils.Coordinate(-580, -60));

    const recvFast1 = workspace.newBlock('synth_recv');
    recvFast1.setFieldValue('clk_fast', 'CHANNEL');
    recvFast1.initSvg();
    recvFast1.render();
    div3.getInput('IN').connection.connect(recvFast1.outputConnection);

    const sendDiv3 = workspace.newBlock('synth_send');
    sendDiv3.setFieldValue('clk_div3', 'CHANNEL');
    sendDiv3.initSvg();
    sendDiv3.render();
    div3.nextConnection.connect(sendDiv3.previousConnection);

    // Divisor /4 (Straight Quarters)
    const div4 = workspace.newBlock('synth_clock_divider');
    div4.setFieldValue('4', 'DIV');
    div4.initSvg();
    div4.render();
    div4.moveTo(new Blockly.utils.Coordinate(-580, 80));

    const recvFast2 = workspace.newBlock('synth_recv');
    recvFast2.setFieldValue('clk_fast', 'CHANNEL');
    recvFast2.initSvg();
    recvFast2.render();
    div4.getInput('IN').connection.connect(recvFast2.outputConnection);

    const sendDiv4 = workspace.newBlock('synth_send');
    sendDiv4.setFieldValue('clk_div4', 'CHANNEL');
    sendDiv4.initSvg();
    sendDiv4.render();
    div4.nextConnection.connect(sendDiv4.previousConnection);

    // 3. Logic XOR Gate between /3 and /4 -> Euclidean Polyrhythm Trigger E(3,8)
    const xorGate = workspace.newBlock('logic_xor');
    xorGate.initSvg();
    xorGate.render();
    xorGate.moveTo(new Blockly.utils.Coordinate(-220, -320));

    const recvD3 = workspace.newBlock('synth_recv');
    recvD3.setFieldValue('clk_div3', 'CHANNEL');
    recvD3.initSvg();
    recvD3.render();
    xorGate.getInput('A').connection.connect(recvD3.outputConnection);

    const recvD4 = workspace.newBlock('synth_recv');
    recvD4.setFieldValue('clk_div4', 'CHANNEL');
    recvD4.initSvg();
    recvD4.render();
    xorGate.getInput('B').connection.connect(recvD4.outputConnection);

    const sendPolyTrig = workspace.newBlock('synth_send');
    sendPolyTrig.setFieldValue('poly_trig', 'CHANNEL');
    sendPolyTrig.initSvg();
    sendPolyTrig.render();
    sendPolyTrig.moveTo(new Blockly.utils.Coordinate(-220, -220));
    sendPolyTrig.getInput('IN').connection.connect(xorGate.outputConnection);

    // 4. Voice 1: Deep Euclidean Sub Kick (Triggered on /4) -> Send v_poly_kick
    const flagKick = workspace.newBlock('event_whenflagclicked');
    flagKick.initSvg();
    flagKick.render();
    flagKick.moveTo(new Blockly.utils.Coordinate(-220, -120));

    const kickEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, kickEnv, 'A', 0.003);
    attachNum(workspace, kickEnv, 'D', 0.16);
    attachNum(workspace, kickEnv, 'S', 0.0);
    attachNum(workspace, kickEnv, 'R', 0.04);
    kickEnv.initSvg();
    kickEnv.render();

    const recvKClk = workspace.newBlock('synth_recv');
    recvKClk.setFieldValue('clk_div4', 'CHANNEL');
    recvKClk.initSvg();
    recvKClk.render();
    kickEnv.getInput('GATE').connection.connect(recvKClk.outputConnection);

    const kickVco = workspace.newBlock('synth_vco');
    kickVco.setFieldValue('sin', 'WAVE');
    attachNum(workspace, kickVco, 'FREQ', 58);
    kickVco.initSvg();
    kickVco.render();
    kickVco.getInput('FM').connection.connect(kickEnv.outputConnection);

    const kickVca = workspace.newBlock('synth_vca');
    kickVca.initSvg();
    kickVca.render();
    kickVca.getInput('GAIN').connection.connect(kickEnv.outputConnection);

    const sendKick = workspace.newBlock('synth_send');
    sendKick.setFieldValue('v_poly_kick', 'CHANNEL');
    sendKick.initSvg();
    sendKick.render();

    flagKick.nextConnection.connect(kickVco.previousConnection);
    kickVco.nextConnection.connect(kickVca.previousConnection);
    kickVca.nextConnection.connect(sendKick.previousConnection);

    // 5. Voice 2: Metallic Euclidean Rim / Clave (Triggered on poly_trig) -> Send v_poly_perc
    const flagPerc = workspace.newBlock('event_whenflagclicked');
    flagPerc.initSvg();
    flagPerc.render();
    flagPerc.moveTo(new Blockly.utils.Coordinate(-220, 140));

    const percEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, percEnv, 'A', 0.002);
    attachNum(workspace, percEnv, 'D', 0.09);
    attachNum(workspace, percEnv, 'S', 0.0);
    attachNum(workspace, percEnv, 'R', 0.03);
    percEnv.initSvg();
    percEnv.render();

    const recvPClk = workspace.newBlock('synth_recv');
    recvPClk.setFieldValue('poly_trig', 'CHANNEL');
    recvPClk.initSvg();
    recvPClk.render();
    percEnv.getInput('GATE').connection.connect(recvPClk.outputConnection);

    const percNoise = workspace.newBlock('synth_noise');
    percNoise.setFieldValue('pink', 'TYPE');
    attachNum(workspace, percNoise, 'GAIN', 1.0);
    percNoise.initSvg();
    percNoise.render();

    const percVcf = workspace.newBlock('synth_svf');
    percVcf.setFieldValue('bp', 'MODE');
    attachNum(workspace, percVcf, 'CUTOFF', 2400);
    attachNum(workspace, percVcf, 'RES', 0.75);
    percVcf.initSvg();
    percVcf.render();

    const percVca = workspace.newBlock('synth_vca');
    percVca.initSvg();
    percVca.render();
    percVca.getInput('GAIN').connection.connect(percEnv.outputConnection);

    const sendPerc = workspace.newBlock('synth_send');
    sendPerc.setFieldValue('v_poly_perc', 'CHANNEL');
    sendPerc.initSvg();
    sendPerc.render();

    flagPerc.nextConnection.connect(percNoise.previousConnection);
    percNoise.nextConnection.connect(percVcf.previousConnection);
    percVcf.nextConnection.connect(percVca.previousConnection);
    percVca.nextConnection.connect(sendPerc.previousConnection);

    // 6. Voice 3: Euclidean Pentatonic Melodic Sequence (D Dorian) -> Send v_poly_lead
    const flagMelody = workspace.newBlock('event_whenflagclicked');
    flagMelody.initSvg();
    flagMelody.render();
    flagMelody.moveTo(new Blockly.utils.Coordinate(140, -320));

    const seqMelody = workspace.newBlock('synth_seq');
    seqMelody.setFieldValue('euclid_notes', 'LIST');
    seqMelody.initSvg();
    seqMelody.render();

    const recvMClk = workspace.newBlock('synth_recv');
    recvMClk.setFieldValue('poly_trig', 'CHANNEL');
    recvMClk.initSvg();
    recvMClk.render();
    seqMelody.getInput('CLK').connection.connect(recvMClk.outputConnection);

    const voctMelody = workspace.newBlock('math_note_convert');
    voctMelody.setFieldValue('VOCT', 'TARGET');
    voctMelody.initSvg();
    voctMelody.render();
    voctMelody.getInput('NOTE').connection.connect(seqMelody.outputConnection);

    const melodyEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, melodyEnv, 'A', 0.008);
    attachNum(workspace, melodyEnv, 'D', 0.20);
    attachNum(workspace, melodyEnv, 'S', 0.20);
    attachNum(workspace, melodyEnv, 'R', 0.12);
    melodyEnv.initSvg();
    melodyEnv.render();

    const recvMClk2 = workspace.newBlock('synth_recv');
    recvMClk2.setFieldValue('poly_trig', 'CHANNEL');
    recvMClk2.initSvg();
    recvMClk2.render();
    melodyEnv.getInput('GATE').connection.connect(recvMClk2.outputConnection);

    const melodyVco = workspace.newBlock('synth_vco');
    melodyVco.setFieldValue('tri', 'WAVE');
    attachNum(workspace, melodyVco, 'FREQ', 261.63);
    melodyVco.initSvg();
    melodyVco.render();
    melodyVco.getInput('FM').connection.connect(voctMelody.outputConnection);

    const melodyVcf = workspace.newBlock('synth_vcf');
    attachNum(workspace, melodyVcf, 'RES', 0.65);
    melodyVcf.initSvg();
    melodyVcf.render();

    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(400, 'OUT_MIN');
    mapCutoff.setFieldValue(4800, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();
    mapCutoff.getInput('VAL').connection.connect(melodyEnv.outputConnection);
    melodyVcf.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const melodyVca = workspace.newBlock('synth_vca');
    melodyVca.initSvg();
    melodyVca.render();
    melodyVca.getInput('GAIN').connection.connect(melodyEnv.outputConnection);

    const sendMelody = workspace.newBlock('synth_send');
    sendMelody.setFieldValue('v_poly_lead', 'CHANNEL');
    sendMelody.initSvg();
    sendMelody.render();

    flagMelody.nextConnection.connect(melodyVco.previousConnection);
    melodyVco.nextConnection.connect(melodyVcf.previousConnection);
    melodyVcf.nextConnection.connect(melodyVca.previousConnection);
    melodyVca.nextConnection.connect(sendMelody.previousConnection);

    // 7. Master Mixer & Spatial Processing
    const flagMain = workspace.newBlock('event_whenflagclicked');
    flagMain.initSvg();
    flagMain.render();
    flagMain.moveTo(new Blockly.utils.Coordinate(500, -320));

    const mixerBlock = workspace.newBlock('synth_mixer4');
    attachNum(workspace, mixerBlock, 'VOL1', 0.85); // Sub Kick
    attachNum(workspace, mixerBlock, 'VOL2', 0.65); // Metallic Rim
    attachNum(workspace, mixerBlock, 'VOL3', 0.80); // Pentatonic Pluck
    attachNum(workspace, mixerBlock, 'VOL4', 0.0);
    mixerBlock.initSvg();
    mixerBlock.render();

    const recvK = workspace.newBlock('synth_recv');
    recvK.setFieldValue('v_poly_kick', 'CHANNEL');
    recvK.initSvg();
    recvK.render();
    mixerBlock.getInput('IN1').connection.connect(recvK.outputConnection);

    const recvP = workspace.newBlock('synth_recv');
    recvP.setFieldValue('v_poly_perc', 'CHANNEL');
    recvP.initSvg();
    recvP.render();
    mixerBlock.getInput('IN2').connection.connect(recvP.outputConnection);

    const recvM = workspace.newBlock('synth_recv');
    recvM.setFieldValue('v_poly_lead', 'CHANNEL');
    recvM.initSvg();
    recvM.render();
    mixerBlock.getInput('IN3').connection.connect(recvM.outputConnection);

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.24);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.45);
    attachNum(workspace, delayBlock, 'MIX', 0.35);
    delayBlock.initSvg();
    delayBlock.render();

    const reverbBlock = workspace.newBlock('synth_reverb');
    attachNum(workspace, reverbBlock, 'SIZE', 0.80);
    attachNum(workspace, reverbBlock, 'DAMP', 0.30);
    attachNum(workspace, reverbBlock, 'MIX', 0.35);
    reverbBlock.initSvg();
    reverbBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.90);
    outBlock.initSvg();
    outBlock.render();

    flagMain.nextConnection.connect(mixerBlock.previousConnection);
    mixerBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(reverbBlock.previousConnection);
    reverbBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(outBlock.previousConnection);
}

// 10. Chiptune Arcade 4-Channel VGM Builder (NES / Game Boy 8-bit Adventure)
function buildChiptunePatch(workspace) {
    workspace.clear();

    // 1. Setup Melody, Harmony and Bass Lists (A Minor Hero Theme)
    const flagSetup = workspace.newBlock('event_whenflagclicked');
    flagSetup.initSvg();
    flagSetup.render();
    flagSetup.moveTo(new Blockly.utils.Coordinate(-580, -320));

    const listLead = workspace.newBlock('synth_list_set');
    listLead.setFieldValue('chip_lead', 'LIST');
    listLead.setFieldValue('69, 72, 76, 81, 79, 76, 72, 74, 76, 79, 81, 84, 83, 81, 79, 76', 'ITEMS');
    listLead.initSvg();
    listLead.render();

    const listHarm = workspace.newBlock('synth_list_set');
    listHarm.setFieldValue('chip_harm', 'LIST');
    listHarm.setFieldValue('57, 60, 64, 69, 67, 64, 60, 62, 64, 67, 69, 72, 71, 69, 67, 64', 'ITEMS');
    listHarm.initSvg();
    listHarm.render();

    const listBass = workspace.newBlock('synth_list_set');
    listBass.setFieldValue('chip_bass', 'LIST');
    listBass.setFieldValue('45, 45, 57, 45, 48, 48, 50, 52, 45, 45, 57, 45, 52, 50, 48, 45', 'ITEMS');
    listBass.initSvg();
    listBass.render();

    flagSetup.nextConnection.connect(listLead.previousConnection);
    listLead.nextConnection.connect(listHarm.previousConnection);
    listHarm.nextConnection.connect(listBass.previousConnection);

    // 2. Master Clock (140 BPM) -> Send chip_clk & Div /2 -> Send chip_clk_div2
    const clockBlock = workspace.newBlock('synth_clock');
    attachNum(workspace, clockBlock, 'BPM', 140);
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-580, -60));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('chip_clk', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    const div2 = workspace.newBlock('synth_clock_divider');
    div2.setFieldValue('2', 'DIV');
    div2.initSvg();
    div2.render();
    div2.moveTo(new Blockly.utils.Coordinate(-580, 100));

    const recvClkFast = workspace.newBlock('synth_recv');
    recvClkFast.setFieldValue('chip_clk', 'CHANNEL');
    recvClkFast.initSvg();
    recvClkFast.render();
    div2.getInput('IN').connection.connect(recvClkFast.outputConnection);

    const sendDiv2 = workspace.newBlock('synth_send');
    sendDiv2.setFieldValue('chip_clk_div2', 'CHANNEL');
    sendDiv2.initSvg();
    sendDiv2.render();
    div2.nextConnection.connect(sendDiv2.previousConnection);

    // 3. Voice 1: Lead Melody (Pulse 50%) -> Send chip_lead_out
    const flagLead = workspace.newBlock('event_whenflagclicked');
    flagLead.initSvg();
    flagLead.render();
    flagLead.moveTo(new Blockly.utils.Coordinate(-220, -320));

    const seqLead = workspace.newBlock('synth_seq');
    seqLead.setFieldValue('chip_lead', 'LIST');
    seqLead.initSvg();
    seqLead.render();

    const recvClkL = workspace.newBlock('synth_recv');
    recvClkL.setFieldValue('chip_clk', 'CHANNEL');
    recvClkL.initSvg();
    recvClkL.render();
    seqLead.getInput('CLK').connection.connect(recvClkL.outputConnection);

    const voctLead = workspace.newBlock('math_note_convert');
    voctLead.setFieldValue('VOCT', 'TARGET');
    voctLead.initSvg();
    voctLead.render();
    voctLead.getInput('NOTE').connection.connect(seqLead.outputConnection);

    const envLead = workspace.newBlock('synth_adsr');
    attachNum(workspace, envLead, 'A', 0.005);
    attachNum(workspace, envLead, 'D', 0.12);
    attachNum(workspace, envLead, 'S', 0.35);
    attachNum(workspace, envLead, 'R', 0.08);
    envLead.initSvg();
    envLead.render();

    const recvClkLEnv = workspace.newBlock('synth_recv');
    recvClkLEnv.setFieldValue('chip_clk', 'CHANNEL');
    recvClkLEnv.initSvg();
    recvClkLEnv.render();
    envLead.getInput('GATE').connection.connect(recvClkLEnv.outputConnection);

    const vcoLead = workspace.newBlock('synth_vco');
    vcoLead.setFieldValue('sqr', 'WAVE');
    attachNum(workspace, vcoLead, 'FREQ', 261.63);
    attachNum(workspace, vcoLead, 'PW', 0.50);
    vcoLead.initSvg();
    vcoLead.render();
    vcoLead.getInput('FM').connection.connect(voctLead.outputConnection);

    const vcaLead = workspace.newBlock('synth_vca');
    vcaLead.initSvg();
    vcaLead.render();
    vcaLead.getInput('GAIN').connection.connect(envLead.outputConnection);

    const sendLeadOut = workspace.newBlock('synth_send');
    sendLeadOut.setFieldValue('chip_lead_out', 'CHANNEL');
    sendLeadOut.initSvg();
    sendLeadOut.render();

    flagLead.nextConnection.connect(vcoLead.previousConnection);
    vcoLead.nextConnection.connect(vcaLead.previousConnection);
    vcaLead.nextConnection.connect(sendLeadOut.previousConnection);

    // 4. Voice 2: Harmony Arp (Pulse 25%) -> Send chip_harm_out
    const flagHarm = workspace.newBlock('event_whenflagclicked');
    flagHarm.initSvg();
    flagHarm.render();
    flagHarm.moveTo(new Blockly.utils.Coordinate(-220, -50));

    const seqHarm = workspace.newBlock('synth_seq');
    seqHarm.setFieldValue('chip_harm', 'LIST');
    seqHarm.initSvg();
    seqHarm.render();

    const recvClkH = workspace.newBlock('synth_recv');
    recvClkH.setFieldValue('chip_clk', 'CHANNEL');
    recvClkH.initSvg();
    recvClkH.render();
    seqHarm.getInput('CLK').connection.connect(recvClkH.outputConnection);

    const voctHarm = workspace.newBlock('math_note_convert');
    voctHarm.setFieldValue('VOCT', 'TARGET');
    voctHarm.initSvg();
    voctHarm.render();
    voctHarm.getInput('NOTE').connection.connect(seqHarm.outputConnection);

    const envHarm = workspace.newBlock('synth_adsr');
    attachNum(workspace, envHarm, 'A', 0.005);
    attachNum(workspace, envHarm, 'D', 0.10);
    attachNum(workspace, envHarm, 'S', 0.20);
    attachNum(workspace, envHarm, 'R', 0.06);
    envHarm.initSvg();
    envHarm.render();

    const recvClkHEnv = workspace.newBlock('synth_recv');
    recvClkHEnv.setFieldValue('chip_clk', 'CHANNEL');
    recvClkHEnv.initSvg();
    recvClkHEnv.render();
    envHarm.getInput('GATE').connection.connect(recvClkHEnv.outputConnection);

    const vcoHarm = workspace.newBlock('synth_vco');
    vcoHarm.setFieldValue('sqr', 'WAVE');
    attachNum(workspace, vcoHarm, 'FREQ', 261.63);
    attachNum(workspace, vcoHarm, 'PW', 0.25);
    vcoHarm.initSvg();
    vcoHarm.render();
    vcoHarm.getInput('FM').connection.connect(voctHarm.outputConnection);

    const vcaHarm = workspace.newBlock('synth_vca');
    vcaHarm.initSvg();
    vcaHarm.render();
    vcaHarm.getInput('GAIN').connection.connect(envHarm.outputConnection);

    const sendHarmOut = workspace.newBlock('synth_send');
    sendHarmOut.setFieldValue('chip_harm_out', 'CHANNEL');
    sendHarmOut.initSvg();
    sendHarmOut.render();

    flagHarm.nextConnection.connect(vcoHarm.previousConnection);
    vcoHarm.nextConnection.connect(vcaHarm.previousConnection);
    vcaHarm.nextConnection.connect(sendHarmOut.previousConnection);

    // 5. Voice 3: Punchy 8-bit Triangle Bass -> Send chip_bass_out
    const flagBass = workspace.newBlock('event_whenflagclicked');
    flagBass.initSvg();
    flagBass.render();
    flagBass.moveTo(new Blockly.utils.Coordinate(140, -320));

    const seqBass = workspace.newBlock('synth_seq');
    seqBass.setFieldValue('chip_bass', 'LIST');
    seqBass.initSvg();
    seqBass.render();

    const recvClkB = workspace.newBlock('synth_recv');
    recvClkB.setFieldValue('chip_clk_div2', 'CHANNEL');
    recvClkB.initSvg();
    recvClkB.render();
    seqBass.getInput('CLK').connection.connect(recvClkB.outputConnection);

    const voctBass = workspace.newBlock('math_note_convert');
    voctBass.setFieldValue('VOCT', 'TARGET');
    voctBass.initSvg();
    voctBass.render();
    voctBass.getInput('NOTE').connection.connect(seqBass.outputConnection);

    const envBass = workspace.newBlock('synth_adsr');
    attachNum(workspace, envBass, 'A', 0.005);
    attachNum(workspace, envBass, 'D', 0.18);
    attachNum(workspace, envBass, 'S', 0.35);
    attachNum(workspace, envBass, 'R', 0.06);
    envBass.initSvg();
    envBass.render();

    const recvClkBEnv = workspace.newBlock('synth_recv');
    recvClkBEnv.setFieldValue('chip_clk_div2', 'CHANNEL');
    recvClkBEnv.initSvg();
    recvClkBEnv.render();
    envBass.getInput('GATE').connection.connect(recvClkBEnv.outputConnection);

    const vcoBass = workspace.newBlock('synth_vco');
    vcoBass.setFieldValue('tri', 'WAVE');
    attachNum(workspace, vcoBass, 'FREQ', 261.63);
    vcoBass.initSvg();
    vcoBass.render();
    vcoBass.getInput('FM').connection.connect(voctBass.outputConnection);

    const vcaBass = workspace.newBlock('synth_vca');
    vcaBass.initSvg();
    vcaBass.render();
    vcaBass.getInput('GAIN').connection.connect(envBass.outputConnection);

    const sendBassOut = workspace.newBlock('synth_send');
    sendBassOut.setFieldValue('chip_bass_out', 'CHANNEL');
    sendBassOut.initSvg();
    sendBassOut.render();

    flagBass.nextConnection.connect(vcoBass.previousConnection);
    vcoBass.nextConnection.connect(vcaBass.previousConnection);
    vcaBass.nextConnection.connect(sendBassOut.previousConnection);

    // 6. Voice 4: 8-bit Noise Percussion (Triggered on /2) -> Send chip_noise_out
    const flagNoise = workspace.newBlock('event_whenflagclicked');
    flagNoise.initSvg();
    flagNoise.render();
    flagNoise.moveTo(new Blockly.utils.Coordinate(140, 20));

    const noiseEnv = workspace.newBlock('synth_adsr');
    attachNum(workspace, noiseEnv, 'A', 0.002);
    attachNum(workspace, noiseEnv, 'D', 0.08);
    attachNum(workspace, noiseEnv, 'S', 0.0);
    attachNum(workspace, noiseEnv, 'R', 0.02);
    noiseEnv.initSvg();
    noiseEnv.render();

    const recvNClk = workspace.newBlock('synth_recv');
    recvNClk.setFieldValue('chip_clk_div2', 'CHANNEL');
    recvNClk.initSvg();
    recvNClk.render();
    noiseEnv.getInput('GATE').connection.connect(recvNClk.outputConnection);

    const noiseGen = workspace.newBlock('synth_noise');
    noiseGen.setFieldValue('white', 'TYPE');
    attachNum(workspace, noiseGen, 'GAIN', 1.0);
    noiseGen.initSvg();
    noiseGen.render();

    const noiseVca = workspace.newBlock('synth_vca');
    noiseVca.initSvg();
    noiseVca.render();
    noiseVca.getInput('GAIN').connection.connect(noiseEnv.outputConnection);

    const sendNoiseOut = workspace.newBlock('synth_send');
    sendNoiseOut.setFieldValue('chip_noise_out', 'CHANNEL');
    sendNoiseOut.initSvg();
    sendNoiseOut.render();

    flagNoise.nextConnection.connect(noiseGen.previousConnection);
    noiseGen.nextConnection.connect(noiseVca.previousConnection);
    noiseVca.nextConnection.connect(sendNoiseOut.previousConnection);

    // 7. Master 4-Channel Mixer & Clean Delay Out
    const flagMain = workspace.newBlock('event_whenflagclicked');
    flagMain.initSvg();
    flagMain.render();
    flagMain.moveTo(new Blockly.utils.Coordinate(500, -320));

    const mixerBlock = workspace.newBlock('synth_mixer4');
    attachNum(workspace, mixerBlock, 'VOL1', 0.70); // Lead
    attachNum(workspace, mixerBlock, 'VOL2', 0.50); // Harmony
    attachNum(workspace, mixerBlock, 'VOL3', 0.85); // Bass
    attachNum(workspace, mixerBlock, 'VOL4', 0.55); // Noise
    mixerBlock.initSvg();
    mixerBlock.render();

    const recvL = workspace.newBlock('synth_recv');
    recvL.setFieldValue('chip_lead_out', 'CHANNEL');
    recvL.initSvg();
    recvL.render();
    mixerBlock.getInput('IN1').connection.connect(recvL.outputConnection);

    const recvH = workspace.newBlock('synth_recv');
    recvH.setFieldValue('chip_harm_out', 'CHANNEL');
    recvH.initSvg();
    recvH.render();
    mixerBlock.getInput('IN2').connection.connect(recvH.outputConnection);

    const recvB = workspace.newBlock('synth_recv');
    recvB.setFieldValue('chip_bass_out', 'CHANNEL');
    recvB.initSvg();
    recvB.render();
    mixerBlock.getInput('IN3').connection.connect(recvB.outputConnection);

    const recvN = workspace.newBlock('synth_recv');
    recvN.setFieldValue('chip_noise_out', 'CHANNEL');
    recvN.initSvg();
    recvN.render();
    mixerBlock.getInput('IN4').connection.connect(recvN.outputConnection);

    const delayBlock = workspace.newBlock('synth_delay');
    attachNum(workspace, delayBlock, 'TIME', 0.21);
    attachNum(workspace, delayBlock, 'FEEDBACK', 0.35);
    attachNum(workspace, delayBlock, 'MIX', 0.22);
    delayBlock.initSvg();
    delayBlock.render();

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    attachNum(workspace, outBlock, 'VOL', 0.90);
    outBlock.initSvg();
    outBlock.render();

    flagMain.nextConnection.connect(mixerBlock.previousConnection);
    mixerBlock.nextConnection.connect(delayBlock.previousConnection);
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
