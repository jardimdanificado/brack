# BRACK — Manual Completo do Estúdio Web

O **BRACK Web Studio** é um ambiente de programação visual baseado em blocos no estilo Scratch 3.0, com tema escuro de alto contraste, projetado para composição musical, experimentação sonora, síntese analógica modular e áudio generativo em tempo real a 48kHz.

---

## 1. Interface do Usuário

A interface é composta por três áreas principais:

```
+------------------------------------------------------------------------------------+
|  [BRACK]  [Play/Stop]  [Seletor de Projetos] [Blocos] [Salvar] [Salvar Como] ...   |
+--------------------------+---------------------------------------------------------+
|                          |                                                         |
|  BARRA LATERAL           |  ÁREA DE TRABALHO (CANVAS BLOCKLY)                      |
|  DE BLOCOS               |                                                         |
|  (Ocultável via botão    |  [Quando iniciar síntese]                               |
|   "Blocos" ou tecla 'B') |    |                                                    |
|                          |    v                                                    |
|  - Eventos               |  [Tocar Oscilador (Sawtooth, Dó 3)]                     |
|  - Síntese & Geradores   |    |                                                    |
|  - Filtros & Efeitos     |    v                                                    |
|  - Sequenciadores        |  [Passar por Filtro (Lowpass, 1200Hz, Q=3.0)]           |
|  - Controle & Variáveis  |    |                                                    |
|                          |    v                                                    |
|                          |  [Envelope ADSR (A=0.01, D=0.2, S=0.5, R=0.4)]          |
|                          |    |                                                    |
|                          |    v                                                    |
|                          |  [Mini Osciloscópio Vetorial em Tempo Real]             |
|                          |    |                                                    |
|                          |    v                                                    |
|                          |  [Saída Master Estéreo (Volume 80%)]                    |
|                          |                                                         |
+--------------------------+---------------------------------------------------------+
|  RODAPÉ DE STATUS: Informações de DSP a 48kHz e atalhos de teclado                  |
+------------------------------------------------------------------------------------+
```

---

## 2. Conceito de Pilha de Áudio (Audio Stacks)

No BRACK, as cadeias de áudio são formadas por conexões verticais diretas entre blocos de processamento:

1. **Bloco Chapéu (Header)**:
   - `Quando iniciar síntese`: Inicia a cadeia assim que a síntese for ativada no botão Play ou atalho `Espaço`.
   - `Quando a tecla [A..K] for pressionada`: Cria um instrumento interativo acionado pelo teclado do computador.
2. **Geradores (Sound Sources)**:
   - `Oscilador`: Gera ondas contínuas de áudio (*Sawtooth*, *Square*, *Triangle*, *Sine*).
   - `Voz de Bateria`: Sintetizador percussivo analógico para Bumbo, Caixa, Prato e Tom.
   - `Gerador de Acordes`: Gera blocos harmônicos polifônicos.
   - `Ruído Branco`: Fonte aleatória para efeitos, caixas e percussões chiptune.
3. **Processadores (Filters, Envelopes & Effects)**:
   - `Filtro`: Esculpe o timbre cortando frequências graves ou agudas com ressonância.
   - `Envelope ADSR`: Molda a dinâmica temporal do som (Ataque, Decaimento, Sustentação e Liberação).
   - `Delay`: Adiciona ecos com tempo de atraso em milissegundos e feedback.
   - `Osciloscópio`: Permite inspecionar a forma de onda do sinal naquele ponto exato da cadeia em tempo real.
4. **Terminal de Saída (Master Out)**:
   - Envia o sinal final daquela pilha para os alto-falantes com proteção de limite e saturação analógica.

---

## 3. Notas Musicais e Escalas

Para manter a compatibilidade tanto com números MIDI quanto com a intuição musical:
- O bloco `Nota Musical` possui um seletor visual com nomes de notas (Dó, Ré, Mi, Fá, Sol, Lá, Si) e oitavas (1 a 8).
- Internamente, o bloco gera o número MIDI exato (ex: Dó 4 = 60, Lá 4 = 69).
- O compilador DSP converte automaticamente números de nota em frequência através da fórmula:

$$f = 440 \times 2^{\frac{\text{MIDI} - 69}{12}}$$

- O bloco `Quantizador de Escalas` permite forçar qualquer número para notas dentro de escalas consagradas (Maior, Menor, Pentatônica, Blues, Dórica, etc.), garantindo que melodias geradas aleatoriamente soem sempre afinadas.

---

## 4. Sequenciadores e Polirritmias Euclidianas

### 4.1 Sequenciador de Passos (`synth_step_sequencer`)
- Permite programar até 16 passos com notas e ativação de gatilho individual.
- Pode ser controlado por um pulso de relógio (*Clock*) ou por laços de repetição com `espere (X) segundos`.

### 4.2 Gerador Euclidiano (`synth_euclidean_generator`)
- Distribui $K$ pulsos de forma o mais uniforme possível ao longo de $N$ passos (Algoritmo de Bjorklund).
- Ideal para ritmos africanos, cubanos, techno e música minimalista contemporânea.

---

## 5. Atalhos de Teclado

| Tecla | Função |
| :--- | :--- |
| `Espaço` | Iniciar / Parar a síntese de áudio |
| `B` | Ocultar / Mostrar a barra lateral de blocos |
| `A`, `S`, `D`, `F`, `G`, `H`, `J`, `K` | Tocar notas brancas (Dó 4 até Dó 5) |
| `W`, `E`, `T`, `Y`, `U` | Tocar notas pretas (Dó#, Ré#, Fá#, Sol#, Lá#) |
| `Scroll do Mouse` / `Pinça` | Zoom in / Zoom out no espaço de trabalho |
