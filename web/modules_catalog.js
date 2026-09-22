/**
 * =========================================================================
 * BRACK Module Catalog (web/modules_catalog.js)
 * Pre-built Eurorack-style modules with editable internal Scratch code
 * =========================================================================
 */

export const MODULE_CATALOG = [
    {
        type: 'vco',
        name: 'VCO Oscilador',
        category: 'Geradores',
        color: '#5F3DC4',
        width: 190,
        height: 250,
        inputs: [
            { id: 'Pitch CV', name: 'Pitch CV', type: 'VAL' },
            { id: 'FM', name: 'FM', type: 'VAL' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Freq', name: 'Freq', min: 20, max: 2000, default: 130.81, value: 130.81, unit: 'Hz' },
            { id: 'PW', name: 'PW', min: 0.05, max: 0.95, default: 0.5, value: 0.5 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_vco">
            <field name="WAVE">saw</field>
            <value name="FREQ">
              <block type="module_io_knob">
                <field name="NAME">Freq</field>
                <field name="MIN">20</field>
                <field name="MAX">2000</field>
                <field name="DEFAULT">130.81</field>
              </block>
            </value>
            <value name="FM">
              <block type="module_io_input">
                <field name="TYPE">VAL</field>
                <field name="PORT">Pitch CV</field>
              </block>
            </value>
            <value name="PW">
              <block type="module_io_knob">
                <field name="NAME">PW</field>
                <field name="MIN">0.05</field>
                <field name="MAX">0.95</field>
                <field name="DEFAULT">0.5</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'vcf',
        name: 'Moog VCF 24dB',
        category: 'Filtros',
        color: '#E8590C',
        width: 190,
        height: 250,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' },
            { id: 'Cutoff CV', name: 'Cutoff CV', type: 'VAL' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Cutoff', name: 'Cutoff', min: 20, max: 18000, default: 800, value: 800, unit: 'Hz' },
            { id: 'Res', name: 'Res', min: 0, max: 0.95, default: 0.55, value: 0.55 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_vcf">
            <value name="IN">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In</field>
              </block>
            </value>
            <value name="CUTOFF">
              <block type="math_arithmetic">
                <field name="OP">ADD</field>
                <value name="A">
                  <block type="module_io_knob">
                    <field name="NAME">Cutoff</field>
                    <field name="MIN">20</field>
                    <field name="MAX">18000</field>
                    <field name="DEFAULT">800</field>
                  </block>
                </value>
                <value name="B">
                  <block type="math_arithmetic">
                    <field name="OP">MULTIPLY</field>
                    <value name="A">
                      <block type="module_io_input">
                        <field name="TYPE">VAL</field>
                        <field name="PORT">Cutoff CV</field>
                      </block>
                    </value>
                    <value name="B">
                      <block type="math_number">
                        <field name="NUM">1000</field>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <value name="RES">
              <block type="module_io_knob">
                <field name="NAME">Res</field>
                <field name="MIN">0</field>
                <field name="MAX">0.95</field>
                <field name="DEFAULT">0.55</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'adsr',
        name: 'Envelope ADSR',
        category: 'Moduladores',
        color: '#2B8A3E',
        width: 190,
        height: 270,
        inputs: [
            { id: 'Gate', name: 'Gate', type: 'GATE' }
        ],
        outputs: [
            { id: 'Env', name: 'Env', type: 'VAL' }
        ],
        params: [
            { id: 'Attack', name: 'Attack', min: 0.001, max: 2.0, default: 0.01, value: 0.01, unit: 's' },
            { id: 'Decay', name: 'Decay', min: 0.01, max: 3.0, default: 0.20, value: 0.20, unit: 's' },
            { id: 'Sustain', name: 'Sustain', min: 0, max: 1.0, default: 0.40, value: 0.40 },
            { id: 'Release', name: 'Release', min: 0.01, max: 4.0, default: 0.25, value: 0.25, unit: 's' }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">VAL</field>
        <field name="PORT">Env</field>
        <value name="SIGNAL">
          <block type="synth_adsr">
            <value name="GATE">
              <block type="module_io_input">
                <field name="TYPE">GATE</field>
                <field name="PORT">Gate</field>
              </block>
            </value>
            <value name="A">
              <block type="module_io_knob">
                <field name="NAME">Attack</field>
                <field name="MIN">0.001</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">0.01</field>
              </block>
            </value>
            <value name="D">
              <block type="module_io_knob">
                <field name="NAME">Decay</field>
                <field name="MIN">0.01</field>
                <field name="MAX">3</field>
                <field name="DEFAULT">0.2</field>
              </block>
            </value>
            <value name="S">
              <block type="module_io_knob">
                <field name="NAME">Sustain</field>
                <field name="MIN">0</field>
                <field name="MAX">1</field>
                <field name="DEFAULT">0.4</field>
              </block>
            </value>
            <value name="R">
              <block type="module_io_knob">
                <field name="NAME">Release</field>
                <field name="MIN">0.01</field>
                <field name="MAX">4</field>
                <field name="DEFAULT">0.25</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'lfo',
        name: 'LFO Modulador',
        category: 'Moduladores',
        color: '#2B8A3E',
        width: 180,
        height: 230,
        inputs: [],
        outputs: [
            { id: 'Tri', name: 'Tri', type: 'VAL' },
            { id: 'Sine', name: 'Sine', type: 'VAL' }
        ],
        params: [
            { id: 'Rate', name: 'Rate', min: 0.05, max: 25, default: 2.5, value: 2.5, unit: 'Hz' },
            { id: 'Depth', name: 'Depth', min: 0, max: 2, default: 1.0, value: 1.0 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">VAL</field>
        <field name="PORT">Tri</field>
        <value name="SIGNAL">
          <block type="synth_lfo">
            <field name="WAVE">tri</field>
            <value name="FREQ">
              <block type="module_io_knob">
                <field name="NAME">Rate</field>
                <field name="MIN">0.05</field>
                <field name="MAX">25</field>
                <field name="DEFAULT">2.5</field>
              </block>
            </value>
            <value name="DEPTH">
              <block type="module_io_knob">
                <field name="NAME">Depth</field>
                <field name="MIN">0</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">1</field>
              </block>
            </value>
          </block>
        </value>
        <next>
          <block type="module_io_output">
            <field name="TYPE">VAL</field>
            <field name="PORT">Sine</field>
            <value name="SIGNAL">
              <block type="synth_lfo">
                <field name="WAVE">sin</field>
                <value name="FREQ">
                  <block type="module_io_knob">
                    <field name="NAME">Rate</field>
                    <field name="MIN">0.05</field>
                    <field name="MAX">25</field>
                    <field name="DEFAULT">2.5</field>
                  </block>
                </value>
                <value name="DEPTH">
                  <block type="module_io_knob">
                    <field name="NAME">Depth</field>
                    <field name="MIN">0</field>
                    <field name="MAX">2</field>
                    <field name="DEFAULT">1</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </next>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'clock',
        name: 'Master Clock',
        category: 'Eventos & Clock',
        color: '#C67D0A',
        width: 180,
        height: 230,
        inputs: [],
        outputs: [
            { id: 'Clock', name: 'Clock', type: 'GATE' },
            { id: 'Div2', name: 'Div2', type: 'GATE' }
        ],
        params: [
            { id: 'BPM', name: 'BPM', min: 40, max: 240, default: 120, value: 120, unit: 'bpm' }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">GATE</field>
        <field name="PORT">Clock</field>
        <value name="SIGNAL">
          <block type="synth_clock">
            <value name="BPM">
              <block type="module_io_knob">
                <field name="NAME">BPM</field>
                <field name="MIN">40</field>
                <field name="MAX">240</field>
                <field name="DEFAULT">120</field>
              </block>
            </value>
          </block>
        </value>
        <next>
          <block type="module_io_output">
            <field name="TYPE">GATE</field>
            <field name="PORT">Div2</field>
            <value name="SIGNAL">
              <block type="synth_clock_divider">
                <field name="DIV">2</field>
                <value name="IN">
                  <block type="synth_clock">
                    <value name="BPM">
                      <block type="module_io_knob">
                        <field name="NAME">BPM</field>
                        <field name="MIN">40</field>
                        <field name="MAX">240</field>
                        <field name="DEFAULT">120</field>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </next>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'seq',
        name: 'Step Sequencer',
        category: 'Moduladores',
        color: '#2B8A3E',
        width: 190,
        height: 250,
        inputs: [
            { id: 'Clock', name: 'Clock', type: 'GATE' }
        ],
        outputs: [
            { id: 'Pitch CV', name: 'Pitch CV', type: 'VAL' }
        ],
        params: [
            { id: 'Glide', name: 'Glide', min: 0.001, max: 0.5, default: 0.02, value: 0.02, unit: 's' }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="synth_list_set">
        <field name="LIST">seq_notes</field>
        <field name="ITEMS">48, 51, 55, 58, 60, 58, 55, 51</field>
        <next>
          <block type="module_io_output">
            <field name="TYPE">VAL</field>
            <field name="PORT">Pitch CV</field>
            <value name="SIGNAL">
              <block type="synth_slew">
                <value name="IN">
                  <block type="synth_seq">
                    <field name="LIST">seq_notes</field>
                    <value name="CLK">
                      <block type="module_io_input">
                        <field name="TYPE">GATE</field>
                        <field name="PORT">Clock</field>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="TIME">
                  <block type="module_io_knob">
                    <field name="NAME">Glide</field>
                    <field name="MIN">0.001</field>
                    <field name="MAX">0.5</field>
                    <field name="DEFAULT">0.02</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </next>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'delay',
        name: 'Tape Delay',
        category: 'Efeitos & Saída',
        color: '#1971C2',
        width: 190,
        height: 250,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Time', name: 'Time', min: 0.05, max: 1.5, default: 0.35, value: 0.35, unit: 's' },
            { id: 'Feedback', name: 'Feedback', min: 0, max: 0.92, default: 0.45, value: 0.45 },
            { id: 'Mix', name: 'Mix', min: 0, max: 1.0, default: 0.40, value: 0.40 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_delay">
            <value name="IN">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In</field>
              </block>
            </value>
            <value name="TIME">
              <block type="module_io_knob">
                <field name="NAME">Time</field>
                <field name="MIN">0.05</field>
                <field name="MAX">1.5</field>
                <field name="DEFAULT">0.35</field>
              </block>
            </value>
            <value name="FEEDBACK">
              <block type="module_io_knob">
                <field name="NAME">Feedback</field>
                <field name="MIN">0</field>
                <field name="MAX">0.92</field>
                <field name="DEFAULT">0.45</field>
              </block>
            </value>
            <value name="MIX">
              <block type="module_io_knob">
                <field name="NAME">Mix</field>
                <field name="MIN">0</field>
                <field name="MAX">1</field>
                <field name="DEFAULT">0.4</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'reverb',
        name: 'Reverb Espacial',
        category: 'Efeitos & Saída',
        color: '#1971C2',
        width: 190,
        height: 250,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Size', name: 'Size', min: 0.1, max: 0.95, default: 0.75, value: 0.75 },
            { id: 'Damp', name: 'Damp', min: 0.05, max: 0.95, default: 0.35, value: 0.35 },
            { id: 'Mix', name: 'Mix', min: 0, max: 1.0, default: 0.35, value: 0.35 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_reverb">
            <value name="IN">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In</field>
              </block>
            </value>
            <value name="SIZE">
              <block type="module_io_knob">
                <field name="NAME">Size</field>
                <field name="MIN">0.1</field>
                <field name="MAX">0.95</field>
                <field name="DEFAULT">0.75</field>
              </block>
            </value>
            <value name="DAMP">
              <block type="module_io_knob">
                <field name="NAME">Damp</field>
                <field name="MIN">0.05</field>
                <field name="MAX">0.95</field>
                <field name="DEFAULT">0.35</field>
              </block>
            </value>
            <value name="MIX">
              <block type="module_io_knob">
                <field name="NAME">Mix</field>
                <field name="MIN">0</field>
                <field name="MAX">1</field>
                <field name="DEFAULT">0.35</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'vca',
        name: 'Amplificador VCA',
        category: 'Filtros & Dinâmica',
        color: '#E8590C',
        width: 190,
        height: 250,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' },
            { id: 'Gain CV', name: 'Gain CV', type: 'VAL' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Gain', name: 'Gain', min: 0, max: 1.5, default: 0.9, value: 0.9 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_vca">
            <field name="EXP">0</field>
            <value name="IN">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In</field>
              </block>
            </value>
            <value name="GAIN">
              <block type="math_arithmetic">
                <field name="OP">MULTIPLY</field>
                <value name="A">
                  <block type="module_io_knob">
                    <field name="NAME">Gain</field>
                    <field name="MIN">0</field>
                    <field name="MAX">1.5</field>
                    <field name="DEFAULT">0.9</field>
                  </block>
                </value>
                <value name="B">
                  <block type="module_io_input">
                    <field name="TYPE">VAL</field>
                    <field name="PORT">Gain CV</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'distortion',
        name: 'Wavefolder & Drive',
        category: 'Filtros & Dinâmica',
        color: '#E8590C',
        width: 180,
        height: 230,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Drive', name: 'Drive', min: 1, max: 15, default: 3.5, value: 3.5 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_distortion">
            <field name="MODE">tanh</field>
            <value name="IN">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In</field>
              </block>
            </value>
            <value name="DRIVE">
              <block type="module_io_knob">
                <field name="NAME">Drive</field>
                <field name="MIN">1</field>
                <field name="MAX">15</field>
                <field name="DEFAULT">3.5</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'mixer4',
        name: 'Mixer 4 Canais',
        category: 'Filtros & Dinâmica',
        color: '#E8590C',
        width: 210,
        height: 270,
        inputs: [
            { id: 'In 1', name: 'In 1', type: 'AUDIO' },
            { id: 'In 2', name: 'In 2', type: 'AUDIO' },
            { id: 'In 3', name: 'In 3', type: 'AUDIO' },
            { id: 'In 4', name: 'In 4', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Vol 1', name: 'Vol 1', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: 'Vol 2', name: 'Vol 2', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: 'Vol 3', name: 'Vol 3', min: 0, max: 2, default: 0.8, value: 0.8 },
            { id: 'Vol 4', name: 'Vol 4', min: 0, max: 2, default: 0.8, value: 0.8 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="synth_mixer4">
            <value name="IN1">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In 1</field>
              </block>
            </value>
            <value name="VOL1">
              <block type="module_io_knob">
                <field name="NAME">Vol 1</field>
                <field name="MIN">0</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">1</field>
              </block>
            </value>
            <value name="IN2">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In 2</field>
              </block>
            </value>
            <value name="VOL2">
              <block type="module_io_knob">
                <field name="NAME">Vol 2</field>
                <field name="MIN">0</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">1</field>
              </block>
            </value>
            <value name="IN3">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In 3</field>
              </block>
            </value>
            <value name="VOL3">
              <block type="module_io_knob">
                <field name="NAME">Vol 3</field>
                <field name="MIN">0</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">0.8</field>
              </block>
            </value>
            <value name="IN4">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In 4</field>
              </block>
            </value>
            <value name="VOL4">
              <block type="module_io_knob">
                <field name="NAME">Vol 4</field>
                <field name="MIN">0</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">0.8</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'master_out',
        name: 'Master Output',
        category: 'Efeitos & Saída',
        color: '#10B981',
        width: 190,
        height: 250,
        isTerminal: true,
        inputs: [
            { id: 'Left', name: 'Left (L)', type: 'AUDIO' },
            { id: 'Right', name: 'Right (R)', type: 'AUDIO' }
        ],
        outputs: [],
        params: [
            { id: 'Master Vol', name: 'Master Vol', min: 0, max: 1.5, default: 0.85, value: 0.85 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="synth_out">
        <value name="LEFT">
          <block type="module_io_input">
            <field name="TYPE">AUDIO</field>
            <field name="PORT">Left</field>
          </block>
        </value>
        <value name="RIGHT">
          <block type="module_io_input">
            <field name="TYPE">AUDIO</field>
            <field name="PORT">Right</field>
          </block>
        </value>
        <value name="VOL">
          <block type="module_io_knob">
            <field name="NAME">Master Vol</field>
            <field name="MIN">0</field>
            <field name="MAX">1.5</field>
            <field name="DEFAULT">0.85</field>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'custom',
        name: 'Módulo Scratch',
        category: 'Personalizado',
        color: '#059669',
        width: 190,
        height: 250,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Gain', name: 'Gain', min: 0, max: 2, default: 1.0, value: 1.0 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_io_process" x="40" y="40">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="math_arithmetic">
            <field name="OP">MULTIPLY</field>
            <value name="A">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In</field>
              </block>
            </value>
            <value name="B">
              <block type="module_io_knob">
                <field name="NAME">Gain</field>
                <field name="MIN">0</field>
                <field name="MAX">2</field>
                <field name="DEFAULT">1</field>
              </block>
            </value>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    }
];
