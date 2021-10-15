build: clean
	glib-compile-schemas ./schemas
	zip -r vertical-overview@RensAlthuis.github.com * -x Makefile
	mkdir _build
	mv vertical-overview@RensAlthuis.github.com _build/

clean:
	if test  -d _build; then rm -r _build; fi
	-rm schemas/gschemas.compiled

install:
	gnome-extensions install -f ./_build/vertical-overview@RensAlthuis.github.com

install-dev:
	rm -rf ${HOME}/.local/share/gnome-shell/extensions/vertical-overview@RensAlthuis.github.com
	ln -s $(shell pwd) ${HOME}/.local/share/gnome-shell/extensions/vertical-overview@RensAlthuis.github.com