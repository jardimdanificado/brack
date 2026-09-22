CLANG ?= clang
CFLAGS = --target=wasm32 -nostdlib -fno-builtin -fno-delete-null-pointer-checks -O3 -msimd128 -flto -w -Iinclude
LDFLAGS = -Wl,--no-entry -Wl,--export-all -Wl,--allow-undefined -Wl,--stack-first -Wl,-z,stack-size=65536 -Wl,--initial-memory=4194304 -Wl,--max-memory=67108864 -Wl,--lto-O3

all: roms/brack.wasm

roms/brack.wasm: src/brack.c include/brack.h
	mkdir -p roms
	$(CLANG) $(CFLAGS) $(LDFLAGS) -o $@ $<

test: all
	node tests/test_synth.js

clean:
	rm -rf roms/*.wasm tests/output.wav

.PHONY: all test clean
