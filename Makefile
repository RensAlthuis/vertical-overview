build: clean
	glib-compile-schemas ./schemas
	zip -r vertical-overview@RensAlthuis.github.com * -x Makefile
	mkdir _build
	mv vertical-overview@RensAlthuis.github.com _build/

clean:
	if test  -d _build; then rm -r _build; fi

install:
	gnome-extensions install -f ./_build/vertical-overview@RensAlthuis.github.com