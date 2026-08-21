"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

function loadKiwi() {
	var context = {
		clearTimeout: clearTimeout,
		console: console,
		Date: Date,
		Math: Math,
		setTimeout: setTimeout
	};

	context.window = context;
	vm.runInNewContext(
		fs.readFileSync(path.join(__dirname, "../build/kiwi.js"), "utf8"),
		context
	);

	return context.Kiwi;
}

function createGL() {
	var calls = [];
	var gl = {
		ELEMENT_ARRAY_BUFFER: 34963,
		FLOAT: 5126,
		TRIANGLES: 4,
		UNSIGNED_SHORT: 5123,
		bindBuffer: function() {},
		drawElements: function() {},
		enableVertexAttribArray: function() {},
		getUniformLocation: function(program, name) {
			return name;
		},
		uniform1i: function(location, value) {
			calls.push({ method: "uniform1i", args: [location, value] });
		},
		uniform1f: function(location, value) {
			calls.push({ method: "uniform1f", args: [location, value] });
		},
		uniform2fv: function(location, value) {
			calls.push({ method: "uniform2fv", args: [location, Array.prototype.slice.call(value)] });
		},
		uniformMatrix3fv: function(location, transpose, value) {
			calls.push({
				method: "uniformMatrix3fv",
				args: [location, transpose, Array.prototype.slice.call(value)]
			});
		},
		vertexAttribPointer: function() {}
	};

	return { calls: calls, gl: gl };
}

function createShader(Kiwi) {
	var shader = new Kiwi.Shaders.TextureAtlasShader();
	var locations = {
		uCamMatrix: "camera",
		uResolution: "resolution",
		uTextureSize: "textureSize",
		uSampler: "sampler"
	};

	Object.keys(shader.uniforms).forEach(function(name) {
		shader.uniforms[name].location = locations[name];
		shader.uniforms[name].dirty = false;
		shader.uniforms[name].value = null;
		shader.uniforms[name].cache = undefined;
		shader.uniforms[name].cacheValid = false;
	});
	shader.attributes.aXYUV = 0;
	shader.attributes.aAlpha = 1;

	return shader;
}

function createRenderer(Kiwi, shader) {
	var renderer = Object.create(Kiwi.Renderers.TextureAtlasRenderer.prototype);

	renderer._shaderPairName = "TextureAtlasShader";
	renderer._vertexBuffer = {
		items: [],
		clear: function() {
			this.items = [];
		},
		uploadBuffer: function() {}
	};
	renderer._indexBuffer = { buffer: {} };
	renderer.shaderManager = {
		requestShader: function() {
			return shader;
		}
	};

	return renderer;
}

var Kiwi = loadKiwi();

(function cachesScalarVectorAndMatrixUniforms() {
	var fake = createGL();
	var shader = createShader(Kiwi);
	var camera = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

	shader.setParam("uSampler", 0);
	shader.setParam("uResolution", new Float32Array([800, 600]));
	shader.setParam("uTextureSize", new Float32Array([64, 32]));
	shader.setParam("uCamMatrix", camera);
	shader.applyUniforms(fake.gl);

	assert.deepStrictEqual(fake.calls.map(function(call) { return call.method; }), [
		"uniformMatrix3fv", "uniform2fv", "uniform2fv", "uniform1i"
	]);
	assert.strictEqual(fake.calls[0].args[1], false);

	fake.calls.length = 0;
	shader.setParam("uSampler", 0);
	shader.setParam("uResolution", new Float32Array([800, 600]));
	shader.setParam("uTextureSize", new Float32Array([64, 32]));
	shader.setParam("uCamMatrix", camera);
	shader.applyUniforms(fake.gl);
	assert.deepStrictEqual(fake.calls, []);

	shader.setParam("uSampler", 1);
	shader.setParam("uSampler", 0);
	shader.applyUniforms(fake.gl);
	assert.deepStrictEqual(fake.calls, []);

	camera[6] = 12;
	shader.setParam("uCamMatrix", camera);
	shader.applyUniforms(fake.gl);
	assert.strictEqual(fake.calls.length, 1);
	assert.strictEqual(fake.calls[0].method, "uniformMatrix3fv");
	assert.deepStrictEqual(fake.calls[0].args, [
		"camera", false, [1, 0, 0, 0, 1, 0, 12, 0, 1]
	]);

	// Relinking a program invalidates cached GPU state.
	fake.calls.length = 0;
	shader.shaderProgram = {};
	shader.initUniforms(fake.gl);
	shader.setParam("uSampler", 0);
	shader.setParam("uResolution", new Float32Array([800, 600]));
	shader.setParam("uTextureSize", new Float32Array([64, 32]));
	shader.setParam("uCamMatrix", camera);
	shader.applyUniforms(fake.gl);
	assert.strictEqual(fake.calls.length, 4);
})();

(function coalescesRendererUniformUpdatesBeforeDrawing() {
	var fake = createGL();
	var shader = createShader(Kiwi);
	var renderer = createRenderer(Kiwi, shader);
	var camera = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
	var params = {
		camMatrix: camera,
		stageResolution: new Float32Array([800, 600])
	};
	shader.uniforms.uUnused = {
		cacheValid: false,
		dirty: false,
		location: "unused",
		type: "1f",
		value: null
	};

	renderer.enable(fake.gl, params);
	renderer.clear(fake.gl, params);
	renderer.updateTextureSize(fake.gl, new Float32Array([64, 32]));
	renderer.draw(fake.gl);
	assert.strictEqual(fake.calls.filter(function(call) {
		return call.method === "uniformMatrix3fv";
	}).length, 1);
	assert.strictEqual(fake.calls.length, 4);

	fake.calls.length = 0;
	renderer.enable(fake.gl, params);
	renderer.clear(fake.gl, params);
	renderer.updateTextureSize(fake.gl, new Float32Array([64, 32]));
	renderer.draw(fake.gl);
	assert.deepStrictEqual(fake.calls, []);

	camera[7] = -5;
	renderer.enable(fake.gl, params);
	renderer.clear(fake.gl, params);
	renderer.updateTextureSize(fake.gl, new Float32Array([64, 32]));
	renderer.draw(fake.gl);
	assert.strictEqual(fake.calls.length, 1);
	assert.strictEqual(fake.calls[0].method, "uniformMatrix3fv");

	fake.calls.length = 0;
	renderer.enable(fake.gl, params);
	renderer.clear(fake.gl, params);
	renderer.updateTextureSize(fake.gl, new Float32Array([128, 32]));
	renderer.draw(fake.gl);
	assert.strictEqual(fake.calls.length, 1);
	assert.strictEqual(fake.calls[0].method, "uniform2fv");
	assert.strictEqual(fake.calls[0].args[0], "textureSize");
})();

(function invalidatesCachesWhenRenderersShareAShader() {
	var fake = createGL();
	var shader = createShader(Kiwi);
	var staleShader = createShader(Kiwi);
	var previousRenderer = {
		disable: function() {},
		shaderPair: shader
	};
	var nextRenderer = {
		disable: function() {},
		enable: function() {
			this.shaderPair = shader;
			shader.setParam("uSampler", 0);
			fake.gl.uniform1f("custom", 2);
		},
		shaderPair: staleShader
	};
	var manager = Object.create(Kiwi.Renderers.GLRenderManager.prototype);
	shader.uniforms.uCustom = {
		cacheValid: false,
		dirty: false,
		location: "custom",
		type: "1f",
		value: null
	};

	shader.setParam("uSampler", 0);
	shader.setParam("uResolution", new Float32Array([800, 600]));
	shader.setParam("uTextureSize", new Float32Array([64, 32]));
	shader.setParam("uCamMatrix", new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
	shader.setParam("uCustom", 1);
	shader.applyUniforms(fake.gl);
	assert.strictEqual(shader.uniforms.uSampler.cacheValid, true);
	fake.calls.length = 0;

	manager._currentRenderer = null;
	manager._lastRenderer = previousRenderer;
	manager._stageResolution = new Float32Array([800, 600]);
	manager.camMatrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
	manager._switchRenderer(fake.gl, { glRenderer: nextRenderer });

	assert.strictEqual(shader.uniforms.uSampler.cacheValid, false);
	assert.strictEqual(shader.uniforms.uSampler.dirty, true);
	shader.applyUniforms(fake.gl);
	assert.deepStrictEqual(fake.calls, [
		{ method: "uniform1f", args: ["custom", 2] },
		{ method: "uniform1i", args: ["sampler", 0] }
	]);
	assert.strictEqual(shader.uniforms.uSampler.cacheValid, true);

	manager._currentRenderer = null;
	manager._switchRenderer(fake.gl, { glRenderer: nextRenderer });
	assert.strictEqual(shader.uniforms.uSampler.cacheValid, true);
	assert.strictEqual(shader.uniforms.uSampler.dirty, false);
})();

console.log("Shader uniform caching tests passed.");
