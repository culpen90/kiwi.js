/**
*  
* @module Kiwi
* @submodule Shaders
* @namespace Kiwi.Shaders
* 
*/

module Kiwi.Shaders {

	/**
	* Base class for shader pairs which encapsulate a GLSL vertex and fragment shader
	* @class ShaderPair
	* @constructor
	* @namespace Kiwi.Shaders
	* @return {Kiwi.Shaders.ShaderPair}
	*/
	export class ShaderPair {

		constructor() {}

		/**
		*
		* @property RENDERER_ID
		* @type string
		* @public
		* @static
		*/
		public static RENDERER_ID: string = "ShaderPair";

		/**
		* Initialise the shader pair.
		* @method init
		* @param gl {WebGLRenderingCotext}
		* @public
		*/
		public init(gl: WebGLRenderingContext) {
			this.vertShader = this.compile(gl, this.vertSource.join("\n"), gl.VERTEX_SHADER);
			this.fragShader = this.compile(gl, this.fragSource.join("\n"), gl.FRAGMENT_SHADER);
			this.shaderProgram = this.attach(gl, this.vertShader, this.fragShader);
			this.initAttributes(gl);
			this.loaded = true;
		}

		/**
		* Returns whether the shader pair has been loaded and compiled.
		* @property loaded
		* @type boolean
		* @public
		*/
		public loaded: boolean = false;

		/**
		* Vertex shader
		* @property vertShader
		* @type WebGLShader
		* @public
		*/
		public vertShader: WebGLShader;

		/**
		* Fragment shader 
		* @property fragShader
		* @type WebGLShader
		* @public
		*/
		public fragShader: WebGLShader;

		/**
		* The WebGl shader program
		* @property shaderProgram
		* @type WebGLProgram
		* @public
		*/
		public shaderProgram: WebGLProgram;

		/**
		* Attaches the shaders to the program and links them
		* @method attach
		* @param gl {WebGLRenderingContext}
		* @param vertShader {WebGLShader}
		* @param fragShader {WebGLShader}
		* @return {WebGLProgram}
		* @public
		*/
		public attach(gl: WebGLRenderingContext, vertShader: WebGLShader, fragShader: WebGLShader): WebGLProgram {
			var shaderProgram: WebGLProgram = gl.createProgram();
			gl.attachShader(shaderProgram, fragShader);
			gl.attachShader(shaderProgram, vertShader);
			gl.linkProgram(shaderProgram);
			return shaderProgram;
		}

		/**
		* Compiles the shaders
		* @method compile
		* @param gl {WebGLRenderingContext}
		* @param src {string}
		* @param shaderType {number}
		* @return {WebGLShader}
		* @public
		*/
		public compile(gl: WebGLRenderingContext, src: string, shaderType: number): WebGLShader {
			var shader: WebGLShader = gl.createShader(shaderType);
			gl.shaderSource(shader, src);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				return null;
			}
			return shader;
		}

		/**
		* Uniform descriptors
		* @property uniforms
		* @type Array
		* @public
		*/
		public uniforms: any;

		/**
		* Attribute locations, keyed by name.
		* @property attributes
		* @type Object
		* @public
		*/
		public attributes: any;


		/**
		* Shader frag source (for override)
		* @property texture2DFrag
		* @type Array
		* @public
		*/
		public fragSource: Array<any>;

		/**
		* Shader vert source (for override)
		* @property texture2DVert
		* @type Array
		* @public
		*/
		public vertSource: Array<any>;

		/**
		* Sets a single uniform value, marking it as dirty when it has changed.
		* @method setParam
		* @param uniformName {string}
		* @param value {*}
		* @public
		*/
		public setParam(uniformName: string, value: any) {
			var uniform = this.uniforms[uniformName];
			uniform.value = value;
			uniform.dirty = !uniform.cacheValid ||
				!this._uniformValueEquals(uniform.cache, value);
		}

		/**
		* Compares uniform values, including array-like values.
		* @method _uniformValueEquals
		* @param valueA {*}
		* @param valueB {*}
		* @return {boolean}
		* @private
		*/
		private _uniformValueEquals(valueA: any, valueB: any): boolean {
			if (valueA === valueB) {
				return true;
			}

			if (!valueA || !valueB ||
				typeof valueA.length !== "number" ||
				typeof valueB.length !== "number" ||
				valueA.length !== valueB.length) {
				return false;
			}

			for (var i = 0; i < valueA.length; i++) {
				if (valueA[i] !== valueB[i]) {
					return false;
				}
			}

			return true;
		}

		/**
		* Copies array-like uniform values so later in-place changes are detected.
		* @method _copyUniformValue
		* @param value {*}
		* @return {*}
		* @private
		*/
		private _copyUniformValue(value: any): any {
			if (!value || typeof value.length !== "number") {
				return value;
			}

			var copy = new Array(value.length);
			for (var i = 0; i < value.length; i++) {
				copy[i] = value[i];
			}
			return copy;
		}

		/**
		* Invalidates cached uniform state so the next assigned value is uploaded.
		* @method invalidateUniforms
		* @public
		*/
		public invalidateUniforms() {
			for (var uniformName in this.uniforms) {
				this.uniforms[uniformName].cacheValid = false;
			}
		}

		/**
		* Applies all uniforms to the uploaded program
		* @method applyUniforms
		* @param gl {WebGLRenderingCotext}
		* @public
		*/
		public applyUniforms(gl: WebGLRenderingContext) {
			for (var u in this.uniforms) {
				this.applyUniform(gl, u);
			}
		}

		/**
		* Applies a single uniforms to the uploaded program
		* @method applyUniform
		* @param gl {WebGLRenderingCotext}
		* @param name {string}
		* @public
		*/
		public applyUniform(gl: WebGLRenderingContext, name: string) {
			var u = this.uniforms[name];
			if (u.dirty) {
				switch (u.type) {
					case "mat2":
						gl.uniformMatrix2fv(u.location, false, u.value);
						break;
					case "mat3":
						gl.uniformMatrix3fv(u.location, false, u.value);
						break;
					case "mat4":
						gl.uniformMatrix4fv(u.location, false, u.value);
						break;
					default:
						gl["uniform" + u.type](u.location, u.value);
				}
				u.cache = this._copyUniformValue(u.value);
				u.cacheValid = true;
				u.dirty = false;
			}
		}

		/**
		* Detects the attributes exposed by the linked shader program.
		* @method initAttributes
		* @param gl {WebGLRenderingContext}
		* @public
		*/
		public initAttributes(gl: WebGLRenderingContext) {
			if (!this.attributes) {
				this.attributes = {};
			}

			for (var attributeName in this.attributes) {
				this.attributes[attributeName] = gl.getAttribLocation(this.shaderProgram, attributeName);
			}

			var attributeCount = gl.getProgramParameter(this.shaderProgram, gl.ACTIVE_ATTRIBUTES);

			for (var i = 0; i < attributeCount; i++) {
				var attribute = gl.getActiveAttrib(this.shaderProgram, i);

				if (attribute && !Object.prototype.hasOwnProperty.call(this.attributes, attribute.name)) {
					this.attributes[attribute.name] = gl.getAttribLocation(this.shaderProgram, attribute.name);
				}
			}
		}

		/**
		* Initialises all uniforms
		* @method initUniforms
		* @param gl {WebGLRenderingCotext}
		* @public
		*/
		public initUniforms(gl: WebGLRenderingContext) {
			for (var uniformName in this.uniforms) {
				var uniform = this.uniforms[uniformName];
				uniform.location = gl.getUniformLocation(this.shaderProgram, uniformName);
				uniform.dirty = false;
				uniform.value = null;
				uniform.cache = undefined;
				uniform.cacheValid = false;

			}
		}

	}

}
