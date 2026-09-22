CLANG ?= clang
CFLAGS = --target=wasm32 -nostdlib -fno-builtin -fno-delete-null-pointer-checks -O3 -msimd128 -flto -w -Iinclude
LDFLAGS = -Wl,--no-entry -Wl,--export-all -Wl,--allow-undefined -Wl,--stack-first -Wl,-z,stack-size=65536 -Wl,--initial-memory=16777216 -Wl,--max-memory=67108864 -Wl,--lto-O3

MODULE_SRCS = $(wildcard src/modules/*/main.c)
MODULE_WASM = $(patsubst src/modules/%/main.c,modules/%.wasm,$(MODULE_SRCS))

all: roms/core.wasm roms/quadro_chalk.wasm $(MODULE_WASM) modules/manifest.json

roms/core.wasm: src/core/engine.c include/brack_core.h include/brack_dsp.h
	mkdir -p roms
	$(CLANG) $(CFLAGS) $(LDFLAGS) -o $@ $<

roms/quadro_chalk.wasm: src/ui/quadro_chalk.c src/ui/quadro.c include/quadro_chalk.h include/quadro.h include/chalk_font.h include/brack_dsp.h
	mkdir -p roms
	$(CLANG) $(CFLAGS) $(LDFLAGS) -o $@ src/ui/quadro_chalk.c src/ui/quadro.c

modules/%.wasm: src/modules/%/main.c include/brack_core.h include/brack_dsp.h
	mkdir -p modules
	$(CLANG) $(CFLAGS) $(LDFLAGS) -o $@ $<

modules/manifest.json: $(MODULE_WASM)
	@mkdir -p modules
	@node -e "const fs=require('fs'); const files=fs.readdirSync('modules').filter(f=>f.endsWith('.wasm')).sort(); fs.writeFileSync('modules/manifest.json', JSON.stringify(files, null, 2));"

test: all
	node tests/test_microkernel.js

clean:
	rm -rf roms/*.wasm modules/*.wasm modules/manifest.json tests/output_microkernel.wav

.PHONY: all test clean
