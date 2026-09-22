# BRACK — Guia de Desenvolvimento de Módulos C / WASM

Este guia explica como criar um novo módulo de áudio para o microkernel BRACK em C puro, compilá-lo para WebAssembly e registrá-lo no ecossistema.

---

## 1. Estrutura de um Módulo

Cada módulo reside em seu próprio diretório dentro de `src/modules/<nome_modulo>/main.c`.

Um módulo mínimo deve incluir:
1. `include/brack_core.h` e `include/brack_dsp.h`.
2. Uma estrutura de estado interna para a instância do módulo.
3. As funções padrão da ABI exportadas com `B_EXPORT`.

---

## 2. Exemplo Passo a Passo: Criando um Módulo Gain/Attenuator

Crie o arquivo `src/modules/gain/main.c`:

```c
#include "brack_core.h"
#include "brack_dsp.h"

// 1. Definição do Descritor JSON Estático
static const char* GAIN_DESCRIPTOR = 
"{"
  "\"name\":\"Gain\","
  "\"category\":\"EFFECT\","
  "\"inputs\":["
    "{\"name\":\"In\",\"type\":\"AUDIO\"},"
    "{\"name\":\"CV Gain\",\"type\":\"VAL\"}"
  "],"
  "\"outputs\":["
    "{\"name\":\"Out\",\"type\":\"AUDIO\"}"
  "],"
  "\"params\":["
    "{\"id\":0,\"name\":\"Gain Level\",\"min\":0.0,\"max\":2.0,\"default\":1.0}"
  "]"
"}";

// 2. Estrutura de Estado
typedef struct {
    float sample_rate;
    float gain_param;
} gain_module_t;

// Alocação de memória estática para freestanding (ou buffer pré-alocado)
static gain_module_t g_instances[BRACK_MAX_SLOTS];
static uint32_t g_instance_count = 0;

// 3. Funções da ABI Exportadas

B_EXPORT const char* brack_get_descriptor(void) {
    return GAIN_DESCRIPTOR;
}

B_EXPORT void* brack_init(float sample_rate) {
    if (g_instance_count >= BRACK_MAX_SLOTS) return NULL;
    gain_module_t *mod = &g_instances[g_instance_count++];
    mod->sample_rate = sample_rate;
    mod->gain_param = 1.0f;
    return mod;
}

B_EXPORT void brack_destroy(void *instance) {
    // Limpeza de recursos se necessário
}

B_EXPORT void brack_reset(void *instance) {
    gain_module_t *mod = (gain_module_t*)instance;
    if (mod) mod->gain_param = 1.0f;
}

B_EXPORT void brack_set_param(void *instance, uint32_t param_id, float value) {
    gain_module_t *mod = (gain_module_t*)instance;
    if (!mod) return;
    if (param_id == 0) mod->gain_param = b_clamp(value, 0.0f, 2.0f);
}

B_EXPORT float brack_get_param(void *instance, uint32_t param_id) {
    gain_module_t *mod = (gain_module_t*)instance;
    if (!mod) return 0.0f;
    if (param_id == 0) return mod->gain_param;
    return 0.0f;
}

// 4. Loop de Processamento em Tempo Real (128 Amostras)
B_EXPORT void brack_process_block(void *instance,
                                  const brack_in_link_t *in_links,
                                  uint32_t in_count,
                                  brack_out_link_t *out_links,
                                  uint32_t out_count,
                                  const brack_transport_t *transport) {
    gain_module_t *mod = (gain_module_t*)instance;
    if (!mod || out_count == 0) return;

    float *out_buf = out_links[0].audio;
    if (!out_buf) return;

    // Buscar entrada de áudio conectada (se houver)
    const float *in_buf = NULL;
    for (uint32_t i = 0; i < in_count; i++) {
        if (in_links[i].type == BRACK_LINK_AUDIO && in_links[i].audio) {
            in_buf = in_links[i].audio;
            break;
        }
    }

    // Buscar modulação de CV Gain conectada
    float cv_gain = 0.0f;
    for (uint32_t i = 0; i < in_count; i++) {
        if (in_links[i].type == BRACK_LINK_VAL) {
            cv_gain += in_links[i].val;
        }
    }

    float total_gain = b_clamp(mod->gain_param + cv_gain, 0.0f, 4.0f);

    if (in_buf) {
        for (int i = 0; i < BRACK_BLOCK_SIZE; i++) {
            out_buf[i] = in_buf[i] * total_gain;
        }
    } else {
        for (int i = 0; i < BRACK_BLOCK_SIZE; i++) {
            out_buf[i] = 0.0f;
        }
    }
}
```

---

## 3. Compilação do Módulo

O `Makefile` principal compila automaticamente qualquer diretório em `src/modules/*/main.c` para `modules/*.wasm`:

```bash
make all
```

Isso gera `modules/gain.wasm` e atualiza `modules/manifest.json`.

---

## 4. Diretrizes de Otimização DSP

1. **Evite Divisões no Loop Interno**: Multiplique pelo inverso pré-calculado:
   ```c
   // Ruim:
   float sample = val / sample_rate;
   // Bom:
   float inv_sr = 1.0f / sample_rate;
   float sample = val * inv_sr;
   ```
2. **Use Funções Inline de `include/brack_dsp.h`**:
   - `b_sin_norm(phase)`: Seno rápido normalizado com aproximação parabólica.
   - `b_exp2(x)`: Exponencial rápido em ponto flutuante.
   - `b_tanh(x)`: Saturação suave analógica via aproximação de Padé.
   - `b_polyblep(t, dt)`: Correção de descontinuidade para osciladores analógicos.
