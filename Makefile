build: clean
	glib-compile-schemas ./schemas
	zip -r vertical-overview@RensAlthuis.github.com *
	mkdir _build
	mv vertical-overview@RensAlthuis.github.com _build/

clean:
	rm -r _build

install:
	gnome-extensions install -f ./_build/vertical-overview@RensAlthuis.github.com