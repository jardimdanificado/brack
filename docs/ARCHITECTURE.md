# BRACK — Arquitetura do Sistema e Microkernel

Este documento detalha o funcionamento interno do ecossistema BRACK, desde o microkernel em C freestanding até o pipeline de compilação em tempo real no navegador.

---

## 1. Princípios de Design

1. **Zero Libc / Freestanding**: O núcleo do sintetizador e todos os módulos WASM não dependem de biblioteca padrão C, alocações dinâmicas em tempo de execução de áudio (`malloc`/`free`) ou chamadas de sistema operacional.
2. **Processamento em Blocos de 128 Amostras**: Alinhado nativamente com o padrão do Web Audio API AudioWorklet e processadores SIMD modernos.
3. **Isolamento de Módulos**: Cada módulo de áudio (VCO, VCF, ADSR, etc.) é compilado como um arquivo `.wasm` independente que expõe a ABI padrão do BRACK.
4. **Matriz de Conexão Dinâmica de 3 Tipos**: Suporte a links de Áudio (`float32[128]`), MIDI (eventos com deslocamento de amostra) e CV/Valores escalares.

---

## 2. Estrutura de Memória e ABI do Host (`include/brack_core.h`)

### 2.1 Estrutura do Host Rack
O rack gerencia até 64 slots de módulos e até 256 conexões dinâmicas:

```c
#define BRACK_BLOCK_SIZE       128   /* 128 amostras por bloco */
#define BRACK_MAX_SLOTS        64    /* Máximo de slots no rack */
#define BRACK_MAX_OUT_LINKS    16    /* Saídas por slot */
#define BRACK_MAX_IN_LINKS     32    /* Entradas dinâmicas por slot */
#define BRACK_MAX_LINKS        256   /* Conexões totais no barramento */
```

### 2.2 Os Três Tipos de Conexão (`brack_link_type_t`)

```c
typedef enum {
    BRACK_LINK_AUDIO = 0, /* Buffer de áudio contínuo float[128] */
    BRACK_LINK_MIDI  = 1, /* Array de eventos MIDI com offset de amostra */
    BRACK_LINK_VAL   = 2  /* Modulação escalar contínua / Control Voltage (float) */
} brack_link_type_t;
```

#### Evento MIDI com Precisão de Amostra:
```c
typedef struct {
    uint8_t  status;       /* 0x90 (Note On), 0x80 (Note Off), 0xB0 (CC) */
    uint8_t  data1;        /* Nota MIDI / Número do CC */
    uint8_t  data2;        /* Velocity / Valor do CC */
    uint8_t  channel;      /* Canal MIDI (0..15) */
    uint32_t frame_offset; /* Amostra exata dentro do bloco de 128 amostras */
} brack_midi_event_t;
```

---

## 3. ABI dos Módulos WASM

Cada módulo `.wasm` exporta funções de ciclo de vida e processamento de áudio:

```c
typedef struct {
    const char* (*get_descriptor)(void);
    void*       (*init)(float sample_rate);
    void        (*destroy)(void *instance);
    void        (*reset)(void *instance);
    void        (*set_param)(void *instance, uint32_t param_id, float value);
    float       (*get_param)(void *instance, uint32_t param_id);
    void        (*process_block)(void *instance,
                                 const brack_in_link_t *in_links,
                                 uint32_t in_count,
                                 brack_out_link_t *out_links,
                                 uint32_t out_count,
                                 const brack_transport_t *transport);
} brack_module_abi_t;
```

### 3.1 Descritor JSON Estático
Ao inicializar, o host interroga `get_descriptor()`, que retorna uma string JSON estática descrevendo portas de entrada, saída e parâmetros:

```json
{
  "name": "VCO",
  "category": "GEN",
  "inputs": [
    {"name": "Pitch CV", "type": "VAL"},
    {"name": "FM Audio", "type": "AUDIO"}
  ],
  "outputs": [
    {"name": "Out", "type": "AUDIO"}
  ],
  "params": [
    {"id": 0, "name": "Waveform", "min": 0, "max": 3, "default": 0},
    {"id": 1, "name": "Base Freq", "min": 20, "max": 20000, "default": 440}
  ]
}
```

---

## 4. Biblioteca de DSP Rápido (`include/brack_dsp.h`)

### 4.1 Anti-Aliasing com PolyBLEP
Para eliminar *aliasing* harmônico em osciladores digitais analógicos:

$$\text{PolyBLEP}(t, dt) = \begin{cases}
\frac{t}{dt} + \frac{t}{dt} - \left(\frac{t}{dt}\right)^2 - 1.0, & 0 \le t < dt \\
\left(\frac{t-1.0}{dt}\right)^2 + \frac{t-1.0}{dt} + 1.0, & 1.0 - dt < t \le 1.0 \\
0.0, & \text{caso contrário}
\end{cases}$$

### 4.2 Exponencial Rápido $2^x$ (Zero Libc)
O cálculo de conversão de Volt por Oitava ($1\text{V/Oct} \to \text{Hz}$) e curvas de envelope utiliza manipulação direta dos bits de ponto flutuante IEEE 754:

```c
static inline float b_exp2(float x) {
    if (x < -126.0f) return 0.0f;
    if (x > 126.0f) x = 126.0f;
    float clip = (x < -126.0f) ? -126.0f : x;
    int32_t i = (int32_t)(clip);
    float f = clip - (float)i;
    float p = 1.0f + f * (0.693017f + f * (0.241404f + f * 0.052032f));
    union { int32_t i; float f; } u;
    u.i = (i + 127) << 23;
    return p * u.f;
}
```

---

## 5. Pipeline do Estúdio Web (`web/`)

```
[Área de Trabalho Blockly] 
           |
           v
[AST / Conexões de Blocos] 
           |
           v
[BlocklySynthEngine.compile()]
           |
   +-------+-------+
   |               |
   v               v
[Vozes DSP]   [Sequenciadores & Triggers]
   |               |
   +-------+-------+
           |
           v
[AudioWorklet / ScriptProcessor Node @ 48kHz]
           |
           v
[Saída Master / Web Audio Destination + Oscilloscope SVG]
```

1. Quando blocos são conectados na UI, o listener `workspace.addChangeListener` detecta mudanças estruturais.
2. `BlocklySynthEngine.compile()` percorre os blocos raíz (`event_whenstarted`, `event_whenkeypressed`), resolvendo as árvores de dependência de áudio.
3. Para cada bloco de áudio (ex: oscilador conectado em filtro e envelope), uma cadeia DSP direta em JavaScript de alta performance é gerada e mantida em memória.
4. A cada bloco de 128 amostras, o buffer de áudio é preenchido e transmitido para os alto-falantes e osciloscópios com latência sub-milissegundo.
