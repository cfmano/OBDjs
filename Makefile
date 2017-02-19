default: build run

prebuild:
	# TODO: dokoncit pre inicializaciu pred buildom
	export npm_config_node_gyp=$(shell which nw-gyp)
	ifndef $(npm_config_node_gyp)
		echo ${npm_config_node_gyp}
	endif

build:
	node_modules/.bin/lessc dashboard/dashboard.less dashboard/dashboard.css
	node_modules/.bin/lessc connector/connector.less connector/connector.css

install:
	# Setup target NW.js version
	export npm_config_target=0.20.0
	# Setup build architecture, ia32 or x64
	export npm_config_arch=x64
	export npm_config_target_arch=x64
	# Setup env for modules built with node-pre-gyp
	export npm_config_runtime=node-webkit
	export npm_config_build_from_source=true
	# Setup nw-gyp as node-gyp
	export npm_config_node_gyp=$(shell which nw-gyp)
	# Run npm install
	npm install

run:
	nw .
