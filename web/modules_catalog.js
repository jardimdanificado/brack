/**
 * =========================================================================
 * BRACK Module Catalog (web/modules_catalog.js)
 * 100% Declarative Eurorack Modules defined via Visual Scratch DSL
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
            { id: 'Freq', name: 'Freq', type: 'KNOB', min: 20, max: 2000, default: 130.81, value: 130.81, unit: 'Hz' },
            { id: 'PW', name: 'PW', type: 'KNOB', min: 0.05, max: 0.95, default: 0.5, value: 0.5 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">VCO Oscilador</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#5F3DC4</field>
    <field name="CATEGORY">Geradores</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                <field name="UNIT">Hz</field>
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
            { id: 'Cutoff', name: 'Cutoff', type: 'KNOB', min: 20, max: 18000, default: 800, value: 800, unit: 'Hz' },
            { id: 'Res', name: 'Res', type: 'KNOB', min: 0, max: 0.95, default: 0.55, value: 0.55 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Moog VCF 24dB</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#E8590C</field>
    <field name="CATEGORY">Filtros</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                    <field name="UNIT">Hz</field>
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
        width: 215,
        height: 340,
        inputs: [
            { id: 'Gate', name: 'Gate', type: 'GATE' }
        ],
        outputs: [
            { id: 'Env', name: 'Env', type: 'VAL' }
        ],
        params: [
            { id: 'Attack', name: 'Attack', type: 'KNOB', min: 0.001, max: 2.0, default: 0.01, value: 0.01, unit: 's' },
            { id: 'Decay', name: 'Decay', type: 'KNOB', min: 0.01, max: 3.0, default: 0.20, value: 0.20, unit: 's' },
            { id: 'Sustain', name: 'Sustain', type: 'KNOB', min: 0, max: 1.0, default: 0.40, value: 0.40 },
            { id: 'Release', name: 'Release', type: 'KNOB', min: 0.01, max: 4.0, default: 0.25, value: 0.25, unit: 's' }
        ],
        visors: [
            { type: 'adsr', attackName: 'Attack', decayName: 'Decay', sustainName: 'Sustain', releaseName: 'Release' }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Envelope ADSR</field>
    <field name="WIDTH">215</field>
    <field name="HEIGHT">340</field>
    <field name="COLOR">#2B8A3E</field>
    <field name="CATEGORY">Moduladores</field>
  </block>
  <block type="module_io_process" x="30" y="160">
    <next>
      <block type="module_visor_adsr">
        <field name="A_NAME">Attack</field>
        <field name="D_NAME">Decay</field>
        <field name="S_NAME">Sustain</field>
        <field name="R_NAME">Release</field>
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
                    <field name="UNIT">s</field>
                  </block>
                </value>
                <value name="D">
                  <block type="module_io_knob">
                    <field name="NAME">Decay</field>
                    <field name="MIN">0.01</field>
                    <field name="MAX">3</field>
                    <field name="DEFAULT">0.2</field>
                    <field name="UNIT">s</field>
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
                    <field name="UNIT">s</field>
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
            { id: 'Rate', name: 'Rate', type: 'KNOB', min: 0.05, max: 25, default: 2.5, value: 2.5, unit: 'Hz' },
            { id: 'Depth', name: 'Depth', type: 'KNOB', min: 0, max: 2, default: 1.0, value: 1.0 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">LFO Modulador</field>
    <field name="WIDTH">180</field>
    <field name="HEIGHT">230</field>
    <field name="COLOR">#2B8A3E</field>
    <field name="CATEGORY">Moduladores</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                <field name="UNIT">Hz</field>
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
                    <field name="UNIT">Hz</field>
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
            { id: 'BPM', name: 'BPM', type: 'KNOB', min: 40, max: 240, default: 120, value: 120, unit: 'BPM' }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Master Clock</field>
    <field name="WIDTH">180</field>
    <field name="HEIGHT">230</field>
    <field name="COLOR">#B45309</field>
    <field name="CATEGORY">Eventos</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                <field name="UNIT">BPM</field>
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
                        <field name="UNIT">BPM</field>
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
            { id: 'Glide', name: 'Glide', type: 'KNOB', min: 0.001, max: 0.5, default: 0.02, value: 0.02, unit: 's' }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Step Sequencer</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#2B8A3E</field>
    <field name="CATEGORY">Moduladores</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                    <field name="UNIT">s</field>
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
        category: 'Efeitos',
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
            { id: 'Time', name: 'Time', type: 'KNOB', min: 0.05, max: 1.5, default: 0.35, value: 0.35, unit: 's' },
            { id: 'Feedback', name: 'Feedback', type: 'KNOB', min: 0, max: 0.92, default: 0.45, value: 0.45 },
            { id: 'Mix', name: 'Mix', type: 'KNOB', min: 0, max: 1.0, default: 0.40, value: 0.40 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Tape Delay</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#1971C2</field>
    <field name="CATEGORY">Efeitos</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                <field name="UNIT">s</field>
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
        category: 'Efeitos',
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
            { id: 'Size', name: 'Size', type: 'KNOB', min: 0.1, max: 0.95, default: 0.75, value: 0.75 },
            { id: 'Damp', name: 'Damp', type: 'KNOB', min: 0.05, max: 0.95, default: 0.35, value: 0.35 },
            { id: 'Mix', name: 'Mix', type: 'KNOB', min: 0, max: 1.0, default: 0.35, value: 0.35 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Reverb Espacial</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#1971C2</field>
    <field name="CATEGORY">Efeitos</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
        category: 'Filtros',
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
            { id: 'Gain', name: 'Gain', type: 'KNOB', min: 0, max: 1.5, default: 0.9, value: 0.9 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Amplificador VCA</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#E8590C</field>
    <field name="CATEGORY">Filtros</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
        category: 'Filtros',
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
            { id: 'Drive', name: 'Drive', type: 'KNOB', min: 1, max: 15, default: 3.5, value: 3.5 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Wavefolder &amp; Drive</field>
    <field name="WIDTH">180</field>
    <field name="HEIGHT">230</field>
    <field name="COLOR">#E8590C</field>
    <field name="CATEGORY">Filtros</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
        category: 'Filtros',
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
            { id: 'Vol 1', name: 'Vol 1', type: 'KNOB', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: 'Vol 2', name: 'Vol 2', type: 'KNOB', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: 'Vol 3', name: 'Vol 3', type: 'KNOB', min: 0, max: 2, default: 0.8, value: 0.8 },
            { id: 'Vol 4', name: 'Vol 4', type: 'KNOB', min: 0, max: 2, default: 0.8, value: 0.8 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Mixer 4 Canais</field>
    <field name="WIDTH">210</field>
    <field name="HEIGHT">270</field>
    <field name="COLOR">#E8590C</field>
    <field name="CATEGORY">Filtros</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
        category: 'Saídas',
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
            { id: 'Master Vol', name: 'Master Vol', type: 'KNOB', min: 0, max: 1.5, default: 0.85, value: 0.85 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Master Output</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#059669</field>
    <field name="CATEGORY">Saídas</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
            { id: 'Gain', name: 'Gain', type: 'KNOB', min: 0, max: 2, default: 1.0, value: 1.0 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Módulo Scratch</field>
    <field name="WIDTH">190</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#059669</field>
    <field name="CATEGORY">Utilidades</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
    },
    {
        type: 'eq5',
        name: 'Equalizador 5-Bandas',
        category: 'Filtros',
        color: '#E8590C',
        width: 250,
        height: 250,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: '80Hz', name: '80Hz', type: 'SLIDER', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: '300Hz', name: '300Hz', type: 'SLIDER', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: '1kHz', name: '1kHz', type: 'SLIDER', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: '3.5k', name: '3.5k', type: 'SLIDER', min: 0, max: 2, default: 1.0, value: 1.0 },
            { id: '10kHz', name: '10kHz', type: 'SLIDER', min: 0, max: 2, default: 1.0, value: 1.0 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Equalizador 5-Bandas</field>
    <field name="WIDTH">250</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#E8590C</field>
    <field name="CATEGORY">Filtros</field>
  </block>
  <block type="module_io_process" x="30" y="160">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out</field>
        <value name="SIGNAL">
          <block type="module_io_input">
            <field name="TYPE">AUDIO</field>
            <field name="PORT">In</field>
          </block>
        </value>
      </block>
    </next>
  </block>
</xml>`;
        }
    },
    {
        type: 'wave_draw_osc',
        name: 'Wavetable Draw',
        category: 'Geradores',
        color: '#5F3DC4',
        width: 230,
        height: 270,
        inputs: [
            { id: 'Pitch CV', name: 'Pitch CV', type: 'VAL' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' }
        ],
        params: [
            { id: 'Freq', name: 'Freq', type: 'KNOB', min: 20, max: 2000, default: 220, value: 220, unit: 'Hz' },
            { id: 'Wave', name: 'Wave', type: 'WAVE_DRAW', waveTable: new Float32Array(128) }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Wavetable Draw</field>
    <field name="WIDTH">230</field>
    <field name="HEIGHT">270</field>
    <field name="COLOR">#5F3DC4</field>
    <field name="CATEGORY">Geradores</field>
  </block>
  <block type="module_io_process" x="30" y="160">
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
                <field name="DEFAULT">220</field>
                <field name="UNIT">Hz</field>
              </block>
            </value>
            <value name="FM">
              <block type="module_io_input">
                <field name="TYPE">VAL</field>
                <field name="PORT">Pitch CV</field>
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
        type: 'xy_filter',
        name: 'Vector XY Pad',
        category: 'Moduladores',
        color: '#087F5B',
        width: 220,
        height: 260,
        inputs: [
            { id: 'In', name: 'In', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out', name: 'Out', type: 'AUDIO' },
            { id: 'X CV', name: 'X CV', type: 'VAL' },
            { id: 'Y CV', name: 'Y CV', type: 'VAL' }
        ],
        params: [
            { id: 'Vector', name: 'Vector', type: 'XY_PAD', valX: 0.5, valY: 0.5 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Vector XY Pad</field>
    <field name="WIDTH">220</field>
    <field name="HEIGHT">260</field>
    <field name="COLOR">#087F5B</field>
    <field name="CATEGORY">Moduladores</field>
  </block>
  <block type="module_io_process" x="30" y="160">
    <next>
      <block type="module_io_output">
        <field name="TYPE">VAL</field>
        <field name="PORT">X CV</field>
        <value name="SIGNAL">
          <block type="module_io_xy">
            <field name="NAME">Vector</field>
            <field name="AXIS">X</field>
          </block>
        </value>
        <next>
          <block type="module_io_output">
            <field name="TYPE">VAL</field>
            <field name="PORT">Y CV</field>
            <value name="SIGNAL">
              <block type="module_io_xy">
                <field name="NAME">Vector</field>
                <field name="AXIS">Y</field>
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
        type: 'switch_router',
        name: 'Toggle Switcher',
        category: 'Controle & Lógica',
        color: '#B45309',
        width: 200,
        height: 250,
        inputs: [
            { id: 'In A', name: 'In A', type: 'AUDIO' },
            { id: 'In B', name: 'In B', type: 'AUDIO' }
        ],
        outputs: [
            { id: 'Out A', name: 'Out A', type: 'AUDIO' },
            { id: 'Out B', name: 'Out B', type: 'AUDIO' }
        ],
        params: [
            { id: 'Mute A', name: 'Mute A', type: 'SWITCH', default: 1, value: 1 },
            { id: 'Mute B', name: 'Mute B', type: 'SWITCH', default: 1, value: 1 }
        ],
        getXml() {
            return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="module_def" x="30" y="30">
    <field name="NAME">Toggle Switcher</field>
    <field name="WIDTH">200</field>
    <field name="HEIGHT">250</field>
    <field name="COLOR">#B45309</field>
    <field name="CATEGORY">Controle</field>
  </block>
  <block type="module_io_process" x="30" y="160">
    <next>
      <block type="module_io_output">
        <field name="TYPE">AUDIO</field>
        <field name="PORT">Out A</field>
        <value name="SIGNAL">
          <block type="math_arithmetic">
            <field name="OP">MULTIPLY</field>
            <value name="A">
              <block type="module_io_input">
                <field name="TYPE">AUDIO</field>
                <field name="PORT">In A</field>
              </block>
            </value>
            <value name="B">
              <block type="module_io_switch">
                <field name="NAME">Mute A</field>
                <field name="DEFAULT">1</field>
              </block>
            </value>
          </block>
        </value>
        <next>
          <block type="module_io_output">
            <field name="TYPE">AUDIO</field>
            <field name="PORT">Out B</field>
            <value name="SIGNAL">
              <block type="math_arithmetic">
                <field name="OP">MULTIPLY</field>
                <value name="A">
                  <block type="module_io_input">
                    <field name="TYPE">AUDIO</field>
                    <field name="PORT">In B</field>
                  </block>
                </value>
                <value name="B">
                  <block type="module_io_switch">
                    <field name="NAME">Mute B</field>
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
    }
];

