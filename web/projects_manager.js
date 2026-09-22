/**
 * =========================================================================
 * BRACK Projects & Examples Manager (web/projects_manager.js)
 * Persistent Storage for Modular Rack Patches (Modules, Cables, Scratch XMLs)
 * =========================================================================
 */

const STORAGE_KEY = 'brack_rack_projects_v9';
const ACTIVE_PROJECT_KEY = 'brack_active_rack_id_v9';

function sanitizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
        .trim();
}

export const EXAMPLE_RACK_PRESETS = [
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
            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#fed330');
            engine.connectCable(clk.id, 'Clock', adsr.id, 'Gate', '#fed330');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#00f2fe');
            engine.connectCable(vco.id, 'Out', vcf.id, 'In', '#00ff88');
            engine.connectCable(adsr.id, 'Env', vcf.id, 'Cutoff CV', '#00f2fe');
            engine.connectCable(vcf.id, 'Out', vca.id, 'In', '#00ff88');
            engine.connectCable(adsr.id, 'Env', vca.id, 'Gain CV', '#00f2fe');
            engine.connectCable(vca.id, 'Out', delay.id, 'In', '#00ff88');
            engine.connectCable(delay.id, 'Out', reverb.id, 'In', '#00ff88');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#00ff88');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#00ff88');
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

            engine.connectCable(vco1.id, 'Out', mixer.id, 'In 1', '#00ff88');
            engine.connectCable(vco2.id, 'Out', mixer.id, 'In 2', '#00ff88');
            engine.connectCable(mixer.id, 'Out', vcf.id, 'In', '#00ff88');
            engine.connectCable(lfo.id, 'Tri', vcf.id, 'Cutoff CV', '#00f2fe');
            engine.connectCable(vcf.id, 'Out', delay.id, 'In', '#00ff88');
            engine.connectCable(delay.id, 'Out', reverb.id, 'In', '#00ff88');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#00ff88');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#00ff88');
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

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#fed330');
            engine.connectCable(clk.id, 'Clock', adsr.id, 'Gate', '#fed330');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#00f2fe');
            engine.connectCable(vco.id, 'Out', dist.id, 'In', '#00ff88');
            engine.connectCable(dist.id, 'Out', vcf.id, 'In', '#00ff88');
            engine.connectCable(adsr.id, 'Env', vcf.id, 'Cutoff CV', '#00f2fe');
            engine.connectCable(vcf.id, 'Out', vca.id, 'In', '#00ff88');
            engine.connectCable(adsr.id, 'Env', vca.id, 'Gain CV', '#00f2fe');
            engine.connectCable(vca.id, 'Out', delay.id, 'In', '#00ff88');
            engine.connectCable(delay.id, 'Out', master.id, 'Left', '#00ff88');
            engine.connectCable(delay.id, 'Out', master.id, 'Right', '#00ff88');
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

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#fed330');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#00f2fe');
            engine.connectCable(vco.id, 'Out', delay.id, 'In', '#00ff88');
            engine.connectCable(delay.id, 'Out', master.id, 'Left', '#00ff88');
            engine.connectCable(delay.id, 'Out', master.id, 'Right', '#00ff88');
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
            engine.setModuleKnob(vco.id, 'Freq', 220);
            engine.setModuleKnob(vcf.id, 'Cutoff', 520);
            engine.setModuleKnob(vcf.id, 'Res', 0.55);
            engine.setModuleKnob(adsr.id, 'Attack', 0.005);
            engine.setModuleKnob(adsr.id, 'Decay', 0.25);
            engine.setModuleKnob(adsr.id, 'Sustain', 0.0);
            engine.setModuleKnob(adsr.id, 'Release', 0.15);
            engine.setModuleKnob(vca.id, 'Gain', 0.9);
            engine.setModuleKnob(delay.id, 'Time', 0.36);
            engine.setModuleKnob(delay.id, 'Feedback', 0.45);
            engine.setModuleKnob(delay.id, 'Mix', 0.30);
            engine.setModuleKnob(reverb.id, 'Size', 0.85);
            engine.setModuleKnob(reverb.id, 'Mix', 0.35);
            engine.setModuleKnob(master.id, 'Master Vol', 0.85);

            engine.connectCable(clk.id, 'Clock', seq.id, 'Clock', '#fed330');
            engine.connectCable(clk.id, 'Clock', adsr.id, 'Gate', '#fed330');
            engine.connectCable(seq.id, 'Pitch CV', vco.id, 'Pitch CV', '#00f2fe');
            engine.connectCable(vco.id, 'Out', vcf.id, 'In', '#00ff88');
            engine.connectCable(adsr.id, 'Env', vcf.id, 'Cutoff CV', '#00f2fe');
            engine.connectCable(vcf.id, 'Out', vca.id, 'In', '#00ff88');
            engine.connectCable(adsr.id, 'Env', vca.id, 'Gain CV', '#00f2fe');
            engine.connectCable(vca.id, 'Out', delay.id, 'In', '#00ff88');
            engine.connectCable(delay.id, 'Out', reverb.id, 'In', '#00ff88');
            engine.connectCable(reverb.id, 'Out', master.id, 'Left', '#00ff88');
            engine.connectCable(reverb.id, 'Out', master.id, 'Right', '#00ff88');
        }
    }
];

export class ProjectsManager {
    constructor(rackEngine, rackCanvas) {
        this.engine = rackEngine;
        this.canvas = rackCanvas;
        this.activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'acid_303';
        this.initStorage();
    }

    initStorage() {
        if (!localStorage.getItem(STORAGE_KEY)) {
            const initial = EXAMPLE_RACK_PRESETS.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                category: 'Exemplo',
                isExample: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                data: null
            }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
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
