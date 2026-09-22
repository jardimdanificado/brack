/**
 * =========================================================================
 * BRACK Projects & Examples Manager (web/projects_manager.js)
 * Persistent Storage for Modular Rack Patches (Modules, Cables, Scratch XMLs)
 * =========================================================================
 */

const STORAGE_KEY = 'brack_rack_projects_v10';
const ACTIVE_PROJECT_KEY = 'brack_active_rack_id_v10';

function sanitizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
        .trim();
}

export const EXAMPLE_RACK_PRESETS = [
    {
        id: 'fl_trap_beat',
        name: 'FL Studio 16-Step Trap Beat (Drum Grid, Soundgoodizer & Soft Clipper)',
        description: 'Bateria eletrônica visual de 16 passos disparando Kick sub, Snare crisp, HiHat e Percussão, saturados pelo Soundgoodizer e limitados pelo Fruity Soft Clipper.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Master Clock');
            const drums = engine.addModule('drum_machine_16', 230, 40, '16-Step Drums');
            const mixer = engine.addModule('mixer4', 530, 40, 'Drum Mixer');
            const sg = engine.addModule('soundgoodizer', 760, 40, 'Soundgoodizer');
            const sc = engine.addModule('soft_clipper', 960, 40, 'Soft Clipper');
            const master = engine.addModule('master_out', 1160, 40, 'Master Output');

            engine.setModuleKnob(clk.id, 'BPM', 140);
            engine.setModuleKnob(mixer.id, 'Vol 1', 1.0); // Kick
            engine.setModuleKnob(mixer.id, 'Vol 2', 0.9); // Snare
            engine.setModuleKnob(mixer.id, 'Vol 3', 0.75); // Hat
            engine.setModuleKnob(mixer.id, 'Vol 4', 0.7); // Perc
            engine.setModuleKnob(sg.id, 'Amount', 0.70);
            engine.setModuleKnob(sc.id, 'Threshold', 0.75);
            engine.setModuleKnob(sc.id, 'Post Gain', 1.1);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', drums.id, 'Clock', '#f59e0b');
            engine.connectCable(drums.id, 'Kick', mixer.id, 'In 1', '#22c55e');
            engine.connectCable(drums.id, 'Snare', mixer.id, 'In 2', '#22c55e');
            engine.connectCable(drums.id, 'HiHat', mixer.id, 'In 3', '#22c55e');
            engine.connectCable(drums.id, 'Perc', mixer.id, 'In 4', '#22c55e');
            engine.connectCable(mixer.id, 'Out', sg.id, 'In', '#22c55e');
            engine.connectCable(sg.id, 'Out', sc.id, 'In', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'fl_gross_glitch',
        name: 'Gross Beat Glitch & 3xOsc Lead (Stutter 1/8 & Chorus)',
        description: 'Triplo oscilador 3xOsc polifônico com detune, fatiado e rearranjado no tempo pelo Gross Beat, ampliado pelo Stereo Chorus e limitado no Soft Clipper.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Sync Clock');
            const seq = engine.addModule('seq', 230, 40, 'Lead Sequencer');
            const osc = engine.addModule('3xosc', 440, 40, '3xOsc Synth');
            const gb = engine.addModule('gross_beat', 670, 40, 'Gross Beat');
            const chorus = engine.addModule('chorus_flanger', 880, 40, 'Stereo Chorus');
            const sc = engine.addModule('soft_clipper', 1080, 40, 'Soft Clipper');
            const master = engine.addModule('master_out', 1280, 40, 'Master Output');

            engine.setModuleKnob(clk.id, 'BPM', 128);
            engine.setModuleKnob(osc.id, 'Freq', 220);
            engine.setModuleKnob(osc.id, 'Detune 2', 0.2);
            engine.setModuleKnob(osc.id, 'Detune 3', -12);
            engine.setModuleKnob(osc.id, 'Mix 1', 0.85);
            engine.setModuleKnob(osc.id, 'Mix 2', 0.6);
            engine.setModuleKnob(osc.id, 'Mix 3', 0.35);
            engine.setModuleKnob(gb.id, 'Mix', 0.95);
            engine.setModuleKnob(chorus.id, 'Rate', 1.2);
            engine.setModuleKnob(chorus.id, 'Depth', 4.0);
            engine.setModuleKnob(chorus.id, 'Mix', 0.45);
            engine.setModuleKnob(sc.id, 'Threshold', 0.8);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(clk.id, 'Clock', gb.id, 'Clock', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', osc.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(osc.id, 'Out', gb.id, 'In', '#22c55e');
            engine.connectCable(gb.id, 'Out', chorus.id, 'In', '#22c55e');
            engine.connectCable(chorus.id, 'Out', sc.id, 'In', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'fl_808_sub_bass',
        name: '808 Sub Bass & Parametric EQ7 (Overdrive & Limiter)',
        description: 'Voz analógica 808 com punch sweep e saturação de overdrive, equalizada cirurgicamente no EQ de 7 bandas e protegida no Soft Clipper.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Beat Clock');
            const seq = engine.addModule('seq', 230, 40, 'Bass Note Seq');
            const drum808 = engine.addModule('drum_808', 440, 40, '808 Drum Voice');
            const eq7 = engine.addModule('parametric_eq7', 640, 40, 'Parametric EQ7');
            const sc = engine.addModule('soft_clipper', 900, 40, 'Soft Clipper');
            const master = engine.addModule('master_out', 1100, 40, 'Master Output');

            engine.setModuleKnob(clk.id, 'BPM', 136);
            engine.setModuleKnob(drum808.id, 'Tune', 50);
            engine.setModuleKnob(drum808.id, 'Decay', 0.65);
            engine.setModuleKnob(drum808.id, 'Snap', 0.85);
            engine.setModuleKnob(drum808.id, 'Drive', 0.45);
            engine.setModuleKnob(eq7.id, '60Hz', 4.0); // Boost sub
            engine.setModuleKnob(eq7.id, '150Hz', 2.0);
            engine.setModuleKnob(eq7.id, '400Hz', -3.0); // Clean mud
            engine.setModuleKnob(eq7.id, '2.5kHz', 3.0); // Click presence
            engine.setModuleKnob(sc.id, 'Threshold', 0.7);
            engine.setModuleKnob(sc.id, 'Post Gain', 1.15);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(clk.id, 'Clock', drum808.id, 'Trig', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', drum808.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(drum808.id, 'Out', eq7.id, 'In', '#22c55e');
            engine.connectCable(eq7.id, 'Out', sc.id, 'In', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'sytrus_fm_bells',
        name: 'Sytrus FM Space Bells (2-Op FM, Haas Widener & Reverb)',
        description: 'Síntese FM estilo Sytrus com ratio harmônico 3.5x e modulação em anel, expandida pelo Stereo Shaper (efeito Haas) e imersa em Reverb.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Bells Clock');
            const seq = engine.addModule('seq', 230, 40, 'Melody Seq');
            const sytrus = engine.addModule('sytrus_fm', 440, 40, 'Sytrus 2-Op FM');
            const shaper = engine.addModule('stereo_shaper', 650, 40, 'Stereo Shaper');
            const reverb = engine.addModule('reverb', 850, 40, 'Space Reverb');
            const master = engine.addModule('master_out', 1060, 40, 'Master Output');

            engine.setModuleKnob(clk.id, 'BPM', 120);
            engine.setModuleKnob(sytrus.id, 'Freq', 440);
            engine.setModuleKnob(sytrus.id, 'Ratio', 3.5);
            engine.setModuleKnob(sytrus.id, 'FM Amt', 2.2);
            engine.setModuleKnob(sytrus.id, 'Feedback', 0.25);
            engine.setModuleKnob(shaper.id, 'Width', 1.8);
            engine.setModuleKnob(shaper.id, 'Haas Delay', 10.0);
            engine.setModuleKnob(reverb.id, 'Size', 0.85);
            engine.setModuleKnob(reverb.id, 'Mix', 0.40);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', sytrus.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(sytrus.id, 'Out', shaper.id, 'In', '#22c55e');
            engine.connectCable(shaper.id, 'Out', reverb.id, 'In', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'vocoder_robot_voice',
        name: 'Vocoder & Formant Robot Talk (Vowel Filter & Bitcrusher)',
        description: 'Oscilador 3xOsc em forma Saw alimentando o Filtro Formante (vogais humanas A-E-I-O-U) modulado por LFO, passado por Bitcrusher e Delay.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const lfo = engine.addModule('lfo', 30, 40, 'Vowel LFO');
            const osc = engine.addModule('3xosc', 230, 40, '3xOsc Saw Core');
            const formant = engine.addModule('vocoder_formant', 460, 40, 'Vocoder Formant');
            const crush = engine.addModule('bitcrusher', 660, 40, 'Bitcrusher 8-Bit');
            const delay = engine.addModule('delay', 860, 40, 'Robot Echo');
            const master = engine.addModule('master_out', 1070, 40, 'Master Output');

            engine.setModuleKnob(lfo.id, 'Rate', 0.45);
            engine.setModuleKnob(osc.id, 'Freq', 110);
            engine.setModuleKnob(osc.id, 'Detune 2', 0.1);
            engine.setModuleKnob(osc.id, 'Detune 3', 7.0);
            engine.setModuleKnob(formant.id, 'Morph', 0.5);
            engine.setModuleKnob(formant.id, 'Res', 0.90);
            engine.setModuleKnob(crush.id, 'Bits', 6);
            engine.setModuleKnob(crush.id, 'Decimate', 3);
            engine.setModuleKnob(delay.id, 'Time', 0.28);
            engine.setModuleKnob(delay.id, 'Feedback', 0.40);
            engine.setModuleKnob(delay.id, 'Mix', 0.30);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(osc.id, 'Out', formant.id, 'In', '#22c55e');
            engine.connectCable(lfo.id, 'Tri', formant.id, 'Morph CV', '#06b6d4');
            engine.connectCable(formant.id, 'Out', crush.id, 'In', '#22c55e');
            engine.connectCable(crush.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'granular_ambient_drift',
        name: 'Granular Pitch Shifter & 8-Stage Phaser (Space Ambient)',
        description: 'Síntese granular transpondo o timbre em +7 semitons em tempo real, com modulação de fase do 8-Stage Phaser e Delay expansivo.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const osc = engine.addModule('3xosc', 30, 40, '3xOsc Pad');
            const pitch = engine.addModule('granular_pitch', 260, 40, 'Granular Pitch');
            const phaser = engine.addModule('phaser8', 460, 40, '8-Stage Phaser');
            const delay = engine.addModule('delay', 660, 40, 'Space Delay');
            const master = engine.addModule('master_out', 870, 40, 'Master Output');

            engine.setModuleKnob(osc.id, 'Freq', 164.81); // E3
            engine.setModuleKnob(osc.id, 'Mix 1', 0.7);
            engine.setModuleKnob(osc.id, 'Mix 2', 0.6);
            engine.setModuleKnob(osc.id, 'Mix 3', 0.4);
            engine.setModuleKnob(pitch.id, 'Semitones', 7); // Quinta perfeita
            engine.setModuleKnob(pitch.id, 'Grain Size', 60);
            engine.setModuleKnob(pitch.id, 'Mix', 0.75);
            engine.setModuleKnob(phaser.id, 'Rate', 0.35);
            engine.setModuleKnob(phaser.id, 'Depth', 0.85);
            engine.setModuleKnob(phaser.id, 'Feedback', 0.65);
            engine.setModuleKnob(delay.id, 'Time', 0.45);
            engine.setModuleKnob(delay.id, 'Feedback', 0.50);
            engine.setModuleKnob(delay.id, 'Mix', 0.40);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(osc.id, 'Out', pitch.id, 'In', '#22c55e');
            engine.connectCable(pitch.id, 'Out', phaser.id, 'In', '#22c55e');
            engine.connectCable(phaser.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'mastering_eq7_chain',
        name: 'Multiband Mastering & EQ7 Chain (Soundgoodizer, Shaper & Soft Clipper)',
        description: 'Cadeia completa de masterização profissional: Equalização cirúrgica de 7 bandas, saturação Soundgoodizer, abertura estéreo Haas e limitação analógica.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const osc = engine.addModule('3xosc', 30, 40, 'Audio Source');
            const eq7 = engine.addModule('parametric_eq7', 260, 40, 'Parametric EQ7');
            const sg = engine.addModule('soundgoodizer', 520, 40, 'Soundgoodizer');
            const shaper = engine.addModule('stereo_shaper', 720, 40, 'Stereo Shaper');
            const sc = engine.addModule('soft_clipper', 920, 40, 'Soft Clipper');
            const master = engine.addModule('master_out', 1120, 40, 'Master Out');

            engine.setModuleKnob(osc.id, 'Freq', 130.81);
            engine.setModuleKnob(eq7.id, '60Hz', 3.0);
            engine.setModuleKnob(eq7.id, '400Hz', -2.0);
            engine.setModuleKnob(eq7.id, '6kHz', 2.5);
            engine.setModuleKnob(eq7.id, '15kHz', 3.5);
            engine.setModuleKnob(sg.id, 'Amount', 0.60);
            engine.setModuleKnob(shaper.id, 'Width', 1.6);
            engine.setModuleKnob(shaper.id, 'Haas Delay', 8.0);
            engine.setModuleKnob(sc.id, 'Threshold', 0.85);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(osc.id, 'Out', eq7.id, 'In', '#22c55e');
            engine.connectCable(eq7.id, 'Out', sg.id, 'In', '#22c55e');
            engine.connectCable(sg.id, 'Out', shaper.id, 'In', '#22c55e');
            engine.connectCable(shaper.id, 'Out', sc.id, 'In', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(sc.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'acid_303',
        name: 'Acid 303 Lab (Seq, Moog VCF, VCA, Delay & Reverb)',
        description: 'Sequenciador clássico de 8 notas, VCO Dente de Serra, Envelope ADSR articulando Filtro Moog 24dB e Amplificador VCA, Tape Delay e Reverb estéreo.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Master Clock');
            const seq = engine.addModule('seq', 230, 40, '303 Sequencer');
            const adsr = engine.addModule('adsr', 440, 40, 'ADSR Env');
            const vco = engine.addModule('vco', 650, 40, 'VCO Lead');
            const vcf = engine.addModule('vcf', 860, 40, 'Moog VCF 24dB');
            const vca = engine.addModule('vca', 1070, 40, 'VCA Amp');
            const delay = engine.addModule('delay', 1280, 40, 'Tape Delay');
            const reverb = engine.addModule('reverb', 1490, 40, 'Reverb Espacial');
            const master = engine.addModule('master_out', 1700, 40, 'Master Output');

            // Presets
            engine.setModuleKnob(clk.id, 'BPM', 132);
            engine.setModuleKnob(vco.id, 'Freq', 130.81);
            engine.setModuleKnob(vcf.id, 'Cutoff', 450);
            engine.setModuleKnob(vcf.id, 'Res', 0.65);
            engine.setModuleKnob(adsr.id, 'Attack', 0.005);
            engine.setModuleKnob(adsr.id, 'Decay', 0.22);
            engine.setModuleKnob(adsr.id, 'Sustain', 0.0);
            engine.setModuleKnob(adsr.id, 'Release', 0.12);
            engine.setModuleKnob(vca.id, 'Gain', 0.9);
            engine.setModuleKnob(delay.id, 'Time', 0.30);
            engine.setModuleKnob(delay.id, 'Feedback', 0.40);
            engine.setModuleKnob(delay.id, 'Mix', 0.28);
            engine.setModuleKnob(reverb.id, 'Size', 0.70);
            engine.setModuleKnob(reverb.id, 'Mix', 0.22);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            // Connect cables
            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(clk.id, 'Clock', adsr.id, 'Gate', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(vco.id, 'Out', vcf.id, 'In', '#22c55e');
            engine.connectCable(adsr.id, 'Env', vcf.id, 'Cutoff CV', '#06b6d4');
            engine.connectCable(vcf.id, 'Out', vca.id, 'In', '#22c55e');
            engine.connectCable(adsr.id, 'Env', vca.id, 'Gain CV', '#06b6d4');
            engine.connectCable(vca.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', reverb.id, 'In', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'ambient_drone',
        name: 'Pad & Drone Shimmer (LFO, Dual VCO, Moog VCF & Reverb)',
        description: 'Duo de osciladores Saw e Sine com modulação lenta de LFO, somados no Mixer, filtrados pelo Moog VCF e imersos em Tape Delay e Reverb infinito.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const lfo = engine.addModule('lfo', 30, 40, 'LFO Sweep');
            const vco1 = engine.addModule('vco', 230, 40, 'VCO 1 (Saw)');
            const vco2 = engine.addModule('vco', 440, 40, 'VCO 2 (Sine)');
            const mixer = engine.addModule('mixer4', 650, 40, 'Mixer');
            const vcf = engine.addModule('vcf', 880, 40, 'Moog VCF');
            const delay = engine.addModule('delay', 1090, 40, 'Tape Delay');
            const reverb = engine.addModule('reverb', 1300, 40, 'Reverb Shimmer');
            const master = engine.addModule('master_out', 1510, 40, 'Master Output');

            engine.setModuleKnob(lfo.id, 'Rate', 0.18);
            engine.setModuleKnob(vco1.id, 'Freq', 65.4); // C2
            engine.setModuleKnob(vco2.id, 'Freq', 130.81); // C3
            engine.setModuleKnob(mixer.id, 'Vol 1', 0.6);
            engine.setModuleKnob(mixer.id, 'Vol 2', 0.7);
            engine.setModuleKnob(vcf.id, 'Cutoff', 750);
            engine.setModuleKnob(vcf.id, 'Res', 0.40);
            engine.setModuleKnob(delay.id, 'Time', 0.42);
            engine.setModuleKnob(delay.id, 'Feedback', 0.48);
            engine.setModuleKnob(delay.id, 'Mix', 0.32);
            engine.setModuleKnob(reverb.id, 'Size', 0.88);
            engine.setModuleKnob(reverb.id, 'Mix', 0.42);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(vco1.id, 'Out', mixer.id, 'In 1', '#22c55e');
            engine.connectCable(vco2.id, 'Out', mixer.id, 'In 2', '#22c55e');
            engine.connectCable(mixer.id, 'Out', vcf.id, 'In', '#22c55e');
            engine.connectCable(lfo.id, 'Tri', vcf.id, 'Cutoff CV', '#06b6d4');
            engine.connectCable(vcf.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', reverb.id, 'In', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'techno_groove',
        name: 'Techno Modular & Wavefolding (Polirritmo & Drive)',
        description: 'Master Clock disparando Sequenciador de baixo, VCO Square com Wavefolder Drive analógico, corte de filtro Moog e VCA percussivo.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Clock Mestre');
            const seq = engine.addModule('seq', 230, 40, 'Bassline Seq');
            const adsr = engine.addModule('adsr', 440, 40, 'ADSR Punch');
            const vco = engine.addModule('vco', 650, 40, 'VCO Square');
            const dist = engine.addModule('distortion', 860, 40, 'Wavefolder');
            const vcf = engine.addModule('vcf', 1070, 40, 'Moog VCF');
            const vca = engine.addModule('vca', 1280, 40, 'VCA Gate');
            const delay = engine.addModule('delay', 1490, 40, 'Stereo Delay');
            const master = engine.addModule('master_out', 1700, 40, 'Master Output');

            engine.setModuleKnob(clk.id, 'BPM', 138);
            engine.setModuleKnob(vco.id, 'Freq', 65.4);
            engine.setModuleKnob(vco.id, 'PW', 0.40);
            engine.setModuleKnob(dist.id, 'Drive', 4.0);
            engine.setModuleKnob(vcf.id, 'Cutoff', 380);
            engine.setModuleKnob(vcf.id, 'Res', 0.60);
            engine.setModuleKnob(adsr.id, 'Attack', 0.003);
            engine.setModuleKnob(adsr.id, 'Decay', 0.18);
            engine.setModuleKnob(adsr.id, 'Sustain', 0.0);
            engine.setModuleKnob(adsr.id, 'Release', 0.08);
            engine.setModuleKnob(vca.id, 'Gain', 0.9);
            engine.setModuleKnob(delay.id, 'Time', 0.22);
            engine.setModuleKnob(delay.id, 'Feedback', 0.35);
            engine.setModuleKnob(delay.id, 'Mix', 0.25);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(clk.id, 'Clock', adsr.id, 'Gate', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(vco.id, 'Out', dist.id, 'In', '#22c55e');
            engine.connectCable(dist.id, 'Out', vcf.id, 'In', '#22c55e');
            engine.connectCable(adsr.id, 'Env', vcf.id, 'Cutoff CV', '#06b6d4');
            engine.connectCable(vcf.id, 'Out', vca.id, 'In', '#22c55e');
            engine.connectCable(adsr.id, 'Env', vca.id, 'Gain CV', '#06b6d4');
            engine.connectCable(vca.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'chiptune_arcade',
        name: 'Chiptune Arcade 8-Bit (Pulse Arp & Delay)',
        description: 'Sons de jogos retrô de 8 bits gerados com oscilador de largura de pulso estreita, sequenciador rápido e delay rítmico.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 40, 40, 'Chiptune Clock');
            const seq = engine.addModule('seq', 250, 40, 'Arpeggio Seq');
            const vco = engine.addModule('vco', 470, 40, 'Square Lead');
            const delay = engine.addModule('delay', 690, 40, 'Arcade Echo');
            const master = engine.addModule('master_out', 910, 40, 'Master Out');

            engine.setModuleKnob(clk.id, 'BPM', 150);
            engine.setModuleKnob(vco.id, 'Freq', 261.63);
            engine.setModuleKnob(vco.id, 'PW', 0.20);
            engine.setModuleKnob(delay.id, 'Time', 0.20);
            engine.setModuleKnob(delay.id, 'Feedback', 0.50);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(vco.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(delay.id, 'Out', master.id, 'Right', '#22c55e');
        }
    },
    {
        id: 'dreamy_arp',
        name: 'Dreamy Arp & Shimmer (Melodic Pluck & Space Reverb)',
        description: 'Sequência melódica sonhadora de 8 notas, oscilador Saw com filtro Moog e envelope de pluck rápido, enviado para Tape Delay e Reverb espacial.',
        category: 'Exemplo',
        isExample: true,
        buildRack(engine) {
            engine.clear();
            const clk = engine.addModule('clock', 30, 40, 'Arp Clock');
            const seq = engine.addModule('seq', 230, 40, 'Dream Seq');
            const adsr = engine.addModule('adsr', 440, 40, 'Pluck Env');
            const vco = engine.addModule('vco', 650, 40, 'Saw Voice');
            const vcf = engine.addModule('vcf', 860, 40, 'Moog VCF');
            const vca = engine.addModule('vca', 1070, 40, 'VCA Pluck');
            const delay = engine.addModule('delay', 1280, 40, 'Ethereal Delay');
            const reverb = engine.addModule('reverb', 1490, 40, 'Space Reverb');
            const master = engine.addModule('master_out', 1700, 40, 'Master Out');

            engine.setModuleKnob(clk.id, 'BPM', 124);
            engine.setModuleKnob(vco.id, 'Freq', 261.63);
            engine.setModuleKnob(vcf.id, 'Cutoff', 800);
            engine.setModuleKnob(vcf.id, 'Res', 0.50);
            engine.setModuleKnob(adsr.id, 'Attack', 0.005);
            engine.setModuleKnob(adsr.id, 'Decay', 0.28);
            engine.setModuleKnob(adsr.id, 'Sustain', 0.0);
            engine.setModuleKnob(adsr.id, 'Release', 0.15);
            engine.setModuleKnob(vca.id, 'Gain', 0.85);
            engine.setModuleKnob(delay.id, 'Time', 0.36);
            engine.setModuleKnob(delay.id, 'Feedback', 0.45);
            engine.setModuleKnob(delay.id, 'Mix', 0.35);
            engine.setModuleKnob(reverb.id, 'Size', 0.82);
            engine.setModuleKnob(reverb.id, 'Mix', 0.35);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#f59e0b');
            engine.connectCable(clk.id, 'Clock', adsr.id, 'Gate', '#f59e0b');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#06b6d4');
            engine.connectCable(vco.id, 'Out', vcf.id, 'In', '#22c55e');
            engine.connectCable(adsr.id, 'Env', vcf.id, 'Cutoff CV', '#06b6d4');
            engine.connectCable(vcf.id, 'Out', vca.id, 'In', '#22c55e');
            engine.connectCable(adsr.id, 'Env', vca.id, 'Gain CV', '#06b6d4');
            engine.connectCable(vca.id, 'Out', delay.id, 'In', '#22c55e');
            engine.connectCable(delay.id, 'Out', reverb.id, 'In', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#22c55e');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#22c55e');
        }
    }
];

export class ProjectsManager {
    constructor(rackEngine, rackCanvas) {
        this.engine = rackEngine;
        this.canvas = rackCanvas;
        this.activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'fl_trap_beat';
        this.initStorage();
    }

    initStorage() {
        let current = [];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) current = JSON.parse(raw);
        } catch (e) {
            current = [];
        }

        const existingIds = new Set(current.map(p => p.id));
        let added = false;

        for (const p of EXAMPLE_RACK_PRESETS) {
            if (!existingIds.has(p.id)) {
                current.push({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    category: 'Exemplo',
                    isExample: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    data: null
                });
                added = true;
            }
        }

        if (added || !localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }
    }

    resetExamples() {
        const userProjects = this.getAllProjects().filter(p => !p.isExample);
        const freshExamples = EXAMPLE_RACK_PRESETS.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            category: 'Exemplo',
            isExample: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: null
        }));
        const combined = [...freshExamples, ...userProjects];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
        return freshExamples.length;
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
        return this.getAllProjects().find(p => p.id === id) || null;
    }

    getActiveProjectId() {
        return this.activeProjectId;
    }

    setActiveProjectId(id) {
        this.activeProjectId = id;
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }

    loadProject(id) {
        const project = this.getProject(id);
        const preset = EXAMPLE_RACK_PRESETS.find(p => p.id === id);

        if (preset && (!project || !project.data)) {
            preset.buildRack(this.engine);
            this.setActiveProjectId(id);
            if (this.canvas) this.canvas.render();
            return true;
        }

        if (project && project.data) {
            this.engine.fromJSON(project.data);
            this.setActiveProjectId(id);
            if (this.canvas) this.canvas.render();
            return true;
        }

        // Fallback to first preset
        if (EXAMPLE_RACK_PRESETS[0]) {
            EXAMPLE_RACK_PRESETS[0].buildRack(this.engine);
            this.setActiveProjectId(EXAMPLE_RACK_PRESETS[0].id);
            if (this.canvas) this.canvas.render();
            return true;
        }

        return false;
    }

    saveCurrentProject() {
        const activeId = this.getActiveProjectId();
        const projects = this.getAllProjects();
        const project = projects.find(p => p.id === activeId);
        const rackData = this.engine.toJSON();

        if (project && !project.isExample) {
            project.data = rackData;
            project.updatedAt = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
            return project;
        }

        // If editing an example, save as a new user project
        const name = project ? `${project.name} (Minha Cópia)` : 'Novo Patch';
        return this.saveAsNewProject(name);
    }

    saveAsNewProject(name) {
        const cleanName = sanitizeText(name) || 'Meu Patch';
        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const rackData = this.engine.toJSON();

        const newProject = {
            id: newId,
            name: cleanName,
            description: 'Patch salvo pelo usuário',
            category: 'Usuario',
            isExample: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: rackData
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

        const copyName = `${source.name} (Cópia)`;
        let rackData = source.data;

        if (!rackData) {
            const preset = EXAMPLE_RACK_PRESETS.find(p => p.id === id);
            if (preset) {
                preset.buildRack(this.engine);
                rackData = this.engine.toJSON();
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
            data: rackData
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
            this.loadProject('acid_303');
        }
        return true;
    }

    exportProjectJson(id) {
        const project = this.getProject(id);
        if (!project) return;

        let exportData = { ...project };
        if (!exportData.data) {
            const preset = EXAMPLE_RACK_PRESETS.find(p => p.id === id);
            if (preset) {
                preset.buildRack(this.engine);
                exportData.data = this.engine.toJSON();
            }
        }

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = sanitizeText(project.name).toLowerCase().replace(/[^a-z0-9]/g, '_') || 'brack_rack';
        a.download = `${filename}.brack.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importProjectJson(input) {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        let projData = null;
        let name = "Patch Importado";
        let description = "Importado via arquivo JSON";

        if (parsed.data && parsed.data.modules) {
            projData = parsed.data;
            name = parsed.name || name;
            description = parsed.description || description;
        } else if (parsed.modules && parsed.cables) {
            projData = parsed;
        } else {
            throw new Error('Arquivo de projeto BRACK Rack inválido.');
        }

        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newProject = {
            id: newId,
            name: sanitizeText(name) || 'Patch Importado',
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

    resetFactoryExamples() {
        const currentProjects = this.getAllProjects();
        const userProjects = currentProjects.filter(p => !p.isExample);

        const freshExamples = EXAMPLE_RACK_PRESETS.map(preset => ({
            id: preset.id,
            name: preset.name,
            description: preset.description,
            category: 'Exemplo',
            isExample: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: null
        }));

        const all = [...freshExamples, ...userProjects];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        this.loadProject('acid_303');
        return true;
    }
}
