TSC := ./node_modules/typescript/bin/tsc

info:
	@echo "Webtamp."
	@echo
	@echo "Commands:"
	@echo
	@echo "  * clean -- Remove generated output."
	@echo "  * build -- Compiles Typescript to Javascript."
	@echo

clean:
	rm -rf dist

build:
	$(TSC)
