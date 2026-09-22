#ifndef NODE_GRAPH_H
#define NODE_GRAPH_H

/**
 * =========================================================================
 * BRACK SunVox / PureData Node Graph Interface (include/node_graph.h)
 * Pure C / Quadro-based Infinite Modular Node Canvas & Vector Wire Engine
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>
#include "quadro.h"

#define MAX_GRAPH_NODES   64
#define MAX_GRAPH_SLIDERS 16
#define MAX_GRAPH_INLETS  8
#define MAX_GRAPH_OUTLETS 8
#define MAX_GRAPH_WIRES   128

/* Node Categories / Themes */
enum {
    NODE_CAT_GENERATOR = 0, // VCO, Noise, Sampler (Cyan)
    NODE_CAT_FILTER    = 1, // VCF, SVF, EQ (Orange)
    NODE_CAT_MODULATOR = 2, // ADSR, LFO, Env (Purple)
    NODE_CAT_CONTROL   = 3, // Sequencer, Clock, Arp (Yellow)
    NODE_CAT_EFFECT    = 4, // Delay, Reverb, Distortion (Green)
    NODE_CAT_OUTPUT    = 5  // Master, Scope, Mixer (Red)
};

enum {
    PORT_AUDIO = 0,
    PORT_CV    = 1,
    PORT_GATE  = 2
};

typedef struct {
    int32_t id;
    int32_t param_id;
    char    name[12];
    float   value;        /* Normalized 0.0 .. 1.0 */
    float   min_val;
    float   max_val;
    int32_t is_log;
} graph_slider_t;

typedef struct {
    int32_t port_id;
    int32_t sig_type;
    char    name[8];
} graph_port_t;

typedef struct {
    int32_t  id;
    int32_t  slot_id;
    char     name[20];
    int32_t  category;
    uint32_t header_color;
    
    // Position & Size on Canvas
    int32_t  x;
    int32_t  y;
    int32_t  w;
    int32_t  h;
    
    // Inlets (Top) & Outlets (Bottom)
    graph_port_t inlets[MAX_GRAPH_INLETS];
    int32_t      inlet_count;
    graph_port_t outlets[MAX_GRAPH_OUTLETS];
    int32_t      outlet_count;
    
    // Parameters (Sliders)
    graph_slider_t sliders[MAX_GRAPH_SLIDERS];
    int32_t        slider_count;

    // Mini Display / Waveform Scope Buffer
    float    scope_data[64];
    int32_t  has_scope;
    uint8_t  active;
} graph_node_t;

typedef struct {
    int32_t  src_node;
    int32_t  src_outlet;
    int32_t  dst_node;
    int32_t  dst_inlet;
    uint32_t color;
    uint8_t  active;
} graph_wire_t;

typedef struct {
    int32_t       view_w;
    int32_t       view_h;
    int32_t       cam_x;
    int32_t       cam_y;
    float         zoom;
    
    graph_node_t  nodes[MAX_GRAPH_NODES];
    int32_t       node_count;
    
    graph_wire_t  wires[MAX_GRAPH_WIRES];
    int32_t       wire_count;
    
    // Interaction State
    int32_t       drag_mode;      // 0=None, 1=Node, 2=Wire, 3=Slider, 4=Pan
    int32_t       active_node_id;
    int32_t       active_slider_id;
    int32_t       wire_src_node;
    int32_t       wire_src_outlet;
    int32_t       mouse_screen_x;
    int32_t       mouse_screen_y;
    int32_t       drag_offset_x;
    int32_t       drag_offset_y;
    
    // Animation tick for wire pulse signals
    uint32_t      anim_tick;
} graph_canvas_state_t;

/* C / WASM ABI Exports */
W_EXPORT void     node_graph_init(int32_t width, int32_t height);
W_EXPORT uint32_t* node_graph_get_framebuffer(void);
W_EXPORT void     node_graph_resize(int32_t width, int32_t height);

// Node Creation
W_EXPORT int32_t  node_graph_add_node(int32_t slot_id, const char *name, int32_t category, int32_t x, int32_t y, int32_t w, int32_t h);
W_EXPORT void     node_graph_add_inlet(int32_t node_id, int32_t port_id, int32_t sig_type, const char *name);
W_EXPORT void     node_graph_add_outlet(int32_t node_id, int32_t port_id, int32_t sig_type, const char *name);
W_EXPORT int32_t  node_graph_add_slider(int32_t node_id, int32_t param_id, const char *name, float def_v, float min_v, float max_v);
W_EXPORT void     node_graph_set_scope_active(int32_t node_id, int32_t active);

// Wire Management
W_EXPORT int32_t  node_graph_connect_wire(int32_t src_node, int32_t src_out, int32_t dst_node, int32_t dst_in, uint32_t color);
W_EXPORT void     node_graph_disconnect_wire(int32_t wire_id);
W_EXPORT void     node_graph_clear_wires(void);

// Interaction & Mouse
W_EXPORT void     node_graph_mouse_down(int32_t screen_x, int32_t screen_y, int32_t button);
W_EXPORT int32_t  node_graph_mouse_move(int32_t screen_x, int32_t screen_y, int32_t *out_node_id, int32_t *out_param_id, float *out_val);
W_EXPORT int32_t  node_graph_mouse_up(int32_t screen_x, int32_t screen_y, int32_t *out_src_node, int32_t *out_src_out, int32_t *out_dst_node, int32_t *out_dst_in);

// Audio Scope Feeder per node
W_EXPORT void     node_graph_feed_scope(int32_t node_id, const float *samples, uint32_t count);

// Frame Render Loop (Quadro Engine)
W_EXPORT void     node_graph_render(void);

#endif /* NODE_GRAPH_H */
