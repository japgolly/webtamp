.PHONY: test

MOCHA   := ./node_modules/mocha/bin/mocha
NODEMON := ./node_modules/nodemon/bin/nodemon.js
TSC     := ./node_modules/typescript/bin/tsc

info:
	@echo "Webtamp."
	@echo
	@echo "Commands:"
	@echo
	@echo "  * clean -- Remove generated output."
	@echo "  * build -- Compiles Typescript to Javascript."
	@echo "  * test  -- Run tests."
	@echo "  * watch -- Watches for changes, compiles and runs tests."
	@echo

clean:
	rm -rf dist

build:
	$(TSC) --pretty

test: build
	$(MOCHA) --inline-diffs --trace-deprecation 'test/**/*Test.js'

watch:
	find src test yarn.lock Makefile | entr -cr make build test
