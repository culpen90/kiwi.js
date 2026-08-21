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

function skipShaderCompilation(shader, program) {
	shader.compile = function() {
		return {};
	};
	shader.attach = function() {
		return program;
	};
}

function createGL(program, activeAttributes, locations) {
	var calls = {
		activeAttributes: [],
		locations: []
	};
	var gl = {
		ACTIVE_ATTRIBUTES: 35721,
		FRAGMENT_SHADER: 35632,
		VERTEX_SHADER: 35633,
		getActiveAttrib: function(actualProgram, index) {
			assert.strictEqual(actualProgram, program);
			calls.activeAttributes.push(index);
			return { name: activeAttributes[index] };
		},
		getAttribLocation: function(actualProgram, name) {
			assert.strictEqual(actualProgram, program);
			calls.locations.push(name);
			return Object.prototype.hasOwnProperty.call(locations, name) ?
				locations[name] : -1;
		},
		getProgramParameter: function(actualProgram, parameter) {
			assert.strictEqual(actualProgram, program);
			assert.strictEqual(parameter, gl.ACTIVE_ATTRIBUTES);
			return activeAttributes.length;
		},
		getUniformLocation: function(actualProgram, name) {
			assert.strictEqual(actualProgram, program);
			return name;
		}
	};

	return { calls: calls, gl: gl };
}

var Kiwi = loadKiwi();

(function detectsEveryActiveAttribute() {
	var program = {};
	var fake = createGL(
		program,
		["aXYUV", "aAlpha", "aCustom"],
		{ aXYUV: 0, aAlpha: 4, aCustom: 7 }
	);
	var shader = new Kiwi.Shaders.TextureAtlasShader();
	var attributes = shader.attributes;

	skipShaderCompilation(shader, program);
	shader.init(fake.gl);

	assert.strictEqual(shader.attributes, attributes);
	assert.strictEqual(shader.attributes.aXYUV, 0);
	assert.strictEqual(shader.attributes.aAlpha, 4);
	assert.strictEqual(shader.attributes.aCustom, 7);
	assert.deepStrictEqual(fake.calls.activeAttributes, [0, 1, 2]);
	assert.deepStrictEqual(fake.calls.locations, ["aXYUV", "aAlpha", "aCustom"]);

	program = {};
	fake = createGL(program, ["aAlpha"], { aAlpha: 2 });
	skipShaderCompilation(shader, program);
	shader.init(fake.gl);

	assert.strictEqual(shader.attributes, attributes);
	assert.strictEqual(shader.attributes.aXYUV, -1);
	assert.strictEqual(shader.attributes.aAlpha, 2);
	assert.strictEqual(shader.attributes.aCustom, -1);
	assert.deepStrictEqual(fake.calls.activeAttributes, [0]);
	assert.deepStrictEqual(fake.calls.locations, ["aXYUV", "aAlpha", "aCustom"]);
})();

(function acceptsProgramsWithoutAttributes() {
	var program = {};
	var fake = createGL(program, [], {});
	var shader = new Kiwi.Shaders.ShaderPair();

	shader.vertSource = [];
	shader.fragSource = [];
	assert.strictEqual(shader.attributes, undefined);
	skipShaderCompilation(shader, program);
	shader.init(fake.gl);

	assert.strictEqual(shader.loaded, true);
	assert.deepStrictEqual(Object.keys(shader.attributes), []);
	assert.deepStrictEqual(fake.calls.activeAttributes, []);
	assert.deepStrictEqual(fake.calls.locations, []);
})();

console.log("Shader attribute detection tests passed.");
