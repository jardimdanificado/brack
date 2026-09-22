# BRACK — Modular Synthesizer & Block-Based Audio Programming System

BRACK é um ecossistema completo de síntese sonora modular que combina um **microkernel freestanding de alta performance em C / WebAssembly** com um **estúdio visual de programação por blocos (Scratch 3.0 / Blockly)** com compilação e execução de áudio DSP em tempo real a 48kHz.

---

## 1. Visão Geral da Arquitetura

O sistema BRACK é dividido em duas camadas fundamentais:

```
+-----------------------------------------------------------------------------+
|                            BRACK Web Studio (JS/DOM)                         |
|  +-----------------------------------+  +--------------------------------+  |
|  | Blockly Audio Workspace           |  | Live Oscilloscope Engine       |  |
|  | Scratch 3.0 Theme & Dark Palette  |  | 60fps Vector SVG Visualizer    |  |
|  +-----------------------------------+  +--------------------------------+  |
|  +-----------------------------------------------------------------------+  |
|  | BlocklySynthEngine (Real-Time Audio Graph Compiler & Event Scheduler) |  |
|  | - Web Audio API AudioWorklet / ScriptProcessor Node (48kHz Float32)   |  |
|  | - Direct Block AST -> DSP Node Compilation                            |  |
|  | - Projects Manager (10 Factory Presets + LocalStorage User Presets)   |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
|                          BRACK Microkernel (C / WASM)                       |
|  +--------------------+  +-----------------------------------------------+  |
|  | roms/core.wasm     |  | Dynamic Link Matrix (AUDIO, MIDI, VAL)        |  |
|  | Rack Bus & Host    |  | Up to 64 Slots, 256 Dynamic Patch Cords       |  |
|  +--------------------+  +-----------------------------------------------+  |
|  +-----------------------------------------------------------------------+  |
|  | Freestanding WASM Modules (modules/*.wasm)                            |  |
|  | - VCO (PolyBLEP Multi-Wave)    - VCF (State Variable Filter 12/24dB)  |  |
|  | - ADSR (Exponential Envelope)  - VCA (Linear/Exponential Amp)         |  |
|  | - SEQ (16-Step CV/Gate)        - DELAY (Feedback & Filtering)         |  |
|  | - CLOCK (Master Pulse/Divider) - OUT (Master Limiter & Soft-Clip)     |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

---

## 2. Componentes do Sistema

### 2.1 Microkernel em C / WASM (`src/core/` e `include/`)
- **Freestanding (Zero Libc)**: Compilado com `clang --target=wasm32 -nostdlib -msimd128 -O3`.
- **Roteamento Dinâmico de 3 Tipos de Link**:
  - `BRACK_LINK_AUDIO`: Buffers de áudio float32 de 128 amostras por bloco.
  - `BRACK_LINK_MIDI`: Fluxo estruturado de eventos MIDI com precisão de sub-bloco (*sample-accurate frame offset*).
  - `BRACK_LINK_VAL`: Valores escalares contínuos de modulação / CV (Control Voltage).
- **Abstração Modular Isolada**: Cada módulo é um arquivo `.wasm` independente carregado dinamicamente no host.
- **Fast DSP Toolkit (`include/brack_dsp.h`)**:
  - Anti-aliasing com **PolyBLEP** (Square, Saw, Triangle).
  - Conversões rápidas $1\text{V/Oct} \to \text{Hz}$ usando aproximações $2^x$ sem chamadas de biblioteca matemática padrão.
  - Filtros *State Variable* (SVF) e saturação analógica suave (*Padé Approximant* para $\tanh$).

### 2.2 Estúdio Web Blockly (`web/`)
- **Interface Estilo Scratch 3.0**: Blocos com paleta de alto contraste, tipografia legível e cantos arredondados característicos.
- **Compilação Contínua em Tempo Real**: Qualquer alteração, reconexão ou exclusão de blocos recompila instantaneamente o grafo de áudio sem travamentos ou interrupção de reprodução.
- **Osciloscópios Vetoriais Vivos (`synth_scope`)**: Renderização suave a 60fps diretamente sobre os blocos de escopo via SVG, com detector de passagem por zero (*zero-crossing trigger*).
- **Gerenciador Completo de Projetos**:
  - Salvar no navegador (`localStorage`).
  - Salvar como novo patch.
  - Exportar/Importar arquivos `.json`.
  - Modal com busca em tempo real e visualização de data/hora.
  - 10 Presets de Fábrica cobrindo múltiplos gêneros e técnicas de síntese.
- **Controle de Interface Flexível**:
  - Botão na barra superior (`Blocos`) e atalho de teclado `B` para alternar a exibição da barra lateral de blocos, expandindo a área de trabalho para 100% da tela em desktops e dispositivos móveis.
  - Botão unificado de Iniciar/Parar com atalho `Espaço`.

---

## 3. Guia de Uso do Estúdio Web

### 3.1 Controles Principais
| Controle | Ação | Atalho |
| :--- | :--- | :--- |
| **Bandeira / Botão Play** | Inicia ou para a síntese sonora em tempo real | `Espaço` |
| **Botão Blocos** | Oculta ou exibe a barra lateral de categorias/blocos | `B` |
| **Seletor de Projetos** | Carrega rapidamente qualquer projeto de fábrica ou do usuário | — |
| **Salvar** | Salva as modificações no projeto atual (ou cria cópia se for preset de fábrica) | — |
| **Salvar Como** | Salva o patch atual com um novo nome personalizado | — |
| **Novo** | Cria uma área de trabalho limpa para um novo projeto | — |
| **Projetos** | Abre o modal avançado para renomear, duplicar, excluir e pesquisar patches | — |
| **Exportar / Importar** | Salva e carrega arquivos `.json` localmente | — |
| **Limpar** | Esvazia todos os blocos do espaço de trabalho atual | — |
| **Teclas A..K** | Dispara notas/gatilhos em blocos do tipo `Quando a tecla [X] for pressionada` | `A`, `S`, `D`, `F`, `G`, `H`, `J`, `K`, `W`, `E`, `T`, `Y`, `U` |

---

## 4. Biblioteca de Blocos de Áudio

### 4.1 Eventos & Controle
- `event_whenstarted`: Bloco chapéu executado continuamente enquanto a síntese estiver rodando.
- `event_whenkeypressed`: Bloco chapéu disparado quando uma tecla específica do teclado for pressionada ou solta.
- `control_repeat_forever`: Laço de repetição contínua para sequenciadores e loops gerativos.
- `control_wait_seconds`: Pausa a execução daquela trilha de controle por $X$ segundos ou frações de tempo musical.

### 4.2 Geradores & Osciladores
- `synth_oscillator`: Oscilador analógico multi-forma de onda (Sawtooth, Square, Triangle, Sine) com pitch de nota/frequência e ganho individual.
- `synth_noise`: Gerador de ruído branco analógico.
- `synth_drum_voice`: Módulo percussivo completo dedicado para síntese de Bumbo (Kick), Caixa (Snare), Chimbal Fechado/Aberto (Hi-Hat) e Tom.
- `synth_chord_generator`: Gerador polifônico de acordes baseado em tipo (Maior, Menor, 7M, m7, Sus4, etc.) e oitava.

### 4.3 Filtros & Efeitos
- `synth_filter`: Filtro *State Variable* ressonante de 12dB/oitava ou 24dB/oitava com modos Lowpass, Highpass, Bandpass e Notch.
- `synth_envelope`: Gerador de envelope ADSR de 4 estágios com resposta exponencial.
- `synth_delay`: Efeito de atraso com controle de tempo em milissegundos, realimentação (*feedback*) e filtro de corte de agudos (*damping*).
- `synth_gain`: Controle de volume e ganho linear/exponencial.
- `synth_scope`: Mini osciloscópio embutido no próprio bloco com visualização vetorial em tempo real.
- `synth_master_out`: Bloco terminal de saída estéreo com limitador e saturação suave (*soft-clipping*).

### 4.4 Sequenciadores & Notas Musicais
- `synth_note_number`: Macro musical visual (ex: `Dó (C) 3`, `Lá (A) 4`) que converte diretamente para o número MIDI correspondente ou frequência em Hz.
- `synth_step_sequencer`: Sequenciador de até 16 passos com controle individual de afinação, gatilho ativo/mudo e divisão de tempo rítmico.
- `synth_euclidean_generator`: Gerador de polirritmias euclidianas com parâmetros de Passos, Pulsos e Rotação.
- `synth_scale_quantizer`: Quantizador de afinação por escalas (Maior, Menor Natural, Pentatônica, Blues, Dórica, etc.).
- `synth_lfo`: Oscilador de baixa frequência (0.01Hz a 50Hz) para modulação contínua de parâmetros.

---

## 5. Exemplos de Fábrica Incluídos

1. **Acid Bassline (TB-303 Style)**: Linha de baixo ácida clássica com sequenciador de 16 passos, envelope rápido e ressonância de filtro modulada.
2. **Sinfonia Modular Completa**: Arranjo orquestrado com múltiplas vozes independentes (Bateria, Linha de Baixo, Lead melódico e Pad atmosférico com Delay).
3. **Polirritmia Euclidiana**: Ritmos cruzados matemáticos gerados com algoritmos euclidianos controlando vozes percussivas e sintetizador tonal.
4. **Chiptune Arcade 8-Bit**: Trilha sonora estilo jogos retrô com arpeggios rápidos em onda quadrada e percussão de ruído branco.
5. **Ambient Generativo**: Paisagem sonora evolutiva baseada em modulações lentas de LFO, acordes suaves e eco estéreo.
6. **Sinos FM Metálicos**: Síntese por modulação de frequência (FM) gerando timbres metálicos e harmônicos brilhantes.
7. **Lead Duplo Sincronizado**: Dois osciladores afinados em intervalos musicais com filtro e envelope dinâmico.
8. **Drone Cósmico Profundo**: Camadas de graves pesados com modulações cruzadas e filtragem passa-baixa lenta.
9. **Groove Percussivo Analógico**: Ritmo eletrônico completo construído com o módulo `synth_drum_voice`.
10. **Sintetizador Polifônico de Teclado**: Patch configurado para execução interativa via teclas do computador (`A` a `K`).

---

## 6. Compilação e Execução

### 6.1 Pré-requisitos
- `clang` com suporte ao alvo `wasm32`
- `make`
- `node` (para execução dos testes automatizados)

### 6.2 Comandos de Build
```bash
# Compilar todos os módulos WASM e o microkernel do sistema
make all

# Executar suíte de testes de renderização do microkernel
make test

# Limpar binários compilados
make clean
```

### 6.3 Iniciando o Estúdio Web
Inicie qualquer servidor HTTP estático na raiz do repositório:
```bash
python3 -m http.server 8000
```
Acesse no navegador: `http://localhost:8000/web/index.html`.
