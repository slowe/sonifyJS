/*!
	Sonify - turn images into sounds
	(c) Stuart Lowe
*/
/*
	USAGE:
		<script src="sonify.js" type="text/javascript"></script>
		<script type="text/javascript">
		<!--
			$(document).ready(function(){
				audible = $.sonify({id:'image'});
			});
		// -->
		</script>
		
	OPTIONS (default values in brackets):
*/

if(typeof $==="undefined") $ = {};

// plugin
(function($) {

	// Control and generate the sound.
	function Sonify(inp){
	
		this.baseFreq = 440;
		this.currentSoundSample = 0;
		this.sampleRate = 44100;
		this.halflife = 0.1;
		this.notes = {'Fb': [ 6,-10],'Cb': [ 5,-9],'Gb': [ 5,-8],'Db': [ 4,-7],'Ab': [ 4,-6],'Eb': [ 3,-5],'Bb': [ 3,-4],'F': [ 2,-3],'C': [ 1,-2],'G': [ 1,-1],'D': [ 0, 0],'A': [ 0, 1],'E': [-1, 2],'B': [-1, 3],'F#': [-2, 4],'C#': [-3, 5],'G#': [-3, 6],'D#': [-4, 7],'A#': [-4, 8],'E#': [-5, 9],'B#': [-5,10] };
		this.limit = 1e-4;

		// C Major chord
		this.f = [this.getFrequency('C'),this.getFrequency('E'),this.getFrequency('G')];

		this.events = { load:"", click:"", mousemove:"" };	// Let's define some events

		// Get the image
		this.el = document.getElementById(inp.id);
		this.wide = parseInt(getStyle(inp.id,'width'),10);
		this.tall = parseInt(getStyle(inp.id,'height'),10);
		this.im = new Image();
		// Keep a copy of this so that we can reference it in the onload event
		var _object = this;
		// Define the onload event before setting the source otherwise Opera/IE might get confused
		this.im.onload = function(){ _object.loaded(); if(_object.callback) _object.callback.call(); }
		this.im.src = this.el.src;

		this.canvas = document.createElement("canvas");
		this.canvas.width = this.im.width;
		this.canvas.height = this.im.height;
		this.ctx = this.canvas.getContext("2d");
		this.ctx.drawImage(this.im,0,0,this.im.width,this.im.height);

		this.imageData = this.ctx.getImageData(0,0,this.im.width,this.im.height);


		var _obj = this;
		addEvent(this.el,"mousemove",function(e){
			_obj.getCursor(e);
			_obj.trigger("mousemove",_obj.cursor)
		});
		addEvent(this.el,"mouseout",function(e){
			_obj.volume(0);
		})

		this.bind("mousemove",function(e){
			//console.log(e.r,e.g,e.b,this);
			this.volume(0,e.r/255)
			this.volume(1,e.g/255)
			this.volume(2,e.b/255)
			
		})

		this.init();
		return this;
	}

	Sonify.prototype.loaded = function(){
		console.log('loaded',this.im);
	}

	Sonify.prototype.getCursor = function(e){
		var x;
		var y;
		if (e.pageX != undefined && e.pageY != undefined){
			x = e.pageX;
			y = e.pageY;
		}else{
			x = e.clientX + document.body.scrollLeft + document.body.scrollLeft +document.documentElement.scrollLeft;
			y = e.clientY + document.body.scrollTop + document.body.scrollTop +document.documentElement.scrollTop;
		}
	
		var target = e.target
		while(target){
			x -= target.offsetLeft;
			y -= target.offsetTop;
			target = target.offsetParent;
		}

		var imx = Math.round(this.im.width*x/this.wide);
		var imy = Math.round(this.im.height*y/this.tall);
		p = (imy*this.im.width + imx)*4;

//console.log(imx,imy,this.im.width,x,this.wide)
		this.cursor = { x: x, y: y, imagex: imx, imagey: imy, r:this.imageData.data[p], g: this.imageData.data[p+1], b: this.imageData.data[p+2] };

		return this.cursor;
	}

	
	// Attach a handler to an event for the Canvas object in a style similar to that used by jQuery
	// .bind(eventType[,eventData],handler(eventObject));
	// .bind("resize",function(e){ console.log(e); });
	// .bind("resize",{me:this},function(e){ console.log(e.data.me); });
	Sonify.prototype.bind = function(ev,e,fn){
		if(typeof ev!="string") return this;
		if(typeof fn==="undefined"){
			fn = e;
			e = {};
		}else{
			e = {data:e}
		}
		if(typeof e!="object" || typeof fn!="function") return this;
		if(this.events[ev]) this.events[ev].push({e:e,fn:fn});
		else this.events[ev] = [{e:e,fn:fn}];
		return this;
	}
	// Trigger a defined event with arguments. This is for internal-use to be
	// sure to include the correct arguments for a particular event
	Sonify.prototype.trigger = function(ev,args){
		if(typeof ev != "string") return;
		if(typeof args != "object") args = {};
		var o = [];
		if(typeof this.events[ev]=="object"){
			for(var i = 0 ; i < this.events[ev].length ; i++){
				var e = G.extend(this.events[ev][i].e,args);
				if(typeof this.events[ev][i].fn == "function") o.push(this.events[ev][i].fn.call(this,e))
			}
		}
		if(o.length > 0) return o;
	}

	Sonify.prototype.getFrequency = function(note){
		return (typeof note!=="string" || !this.notes[note]) ? parseFloat(document.getElementById("freq").value,10) : this.baseFreq * Math.pow(2.0, (this.notes[note][0] * 1200 + this.notes[note][1]*700) / 1200);
	}

	Sonify.prototype.start = function(n){
		for(var i = 0 ; i < this.f.length ; i++) this.targetAmplitudes[i] = 0;
		return this;
	}

	Sonify.prototype.stop = function(){
		for(var i = 0 ; i < this.f.length ; i++) this.targetAmplitudes[i] = 0;
		return this;
	}

	Sonify.prototype.volume = function(i,v){
		if(typeof v!=="number"){
			v = i;
			i = undefined;
		}

		if(typeof i==="number") i = [i];
		if(typeof i==="undefined"){
			i = new Array(this.targetAmplitudes.length);
			for(var j = 0; j < i.length ; j++) i[j] = j;
		}
		if(typeof v!=="number") v = 0;
		for(var j = 0; j < i.length ; j++) this.targetAmplitudes[i[j]] = v;
//console.log(i,v)
		return this;
	}
	
	Sonify.prototype.requestSoundData = function(soundData){

		if(this.amplitudes[0]<this.limit && this.amplitudes[1]<this.limit && this.amplitudes[2]<this.limit && this.targetAmplitudes[0]<this.limit && this.targetAmplitudes[1]<this.limit && this.targetAmplitudes[2]<this.limit) return this; // no sound selected

		var i,s,size,k,ks,dt,a,c,f;

		// Set up wavenumbers for each frequency
		k = this.f.length;
		ks = new Array(k);
		for(i = 0; i < ks.length ; i++) ks[i] = 2* Math.PI * this.f[i] / this.sampleRate;
		dt = 1/this.sampleRate;

		a = new Array(this.amplitudes.length);
		c = (this.sampleRate*this.halflife);

		for(s=0, size=soundData.length; s<size; s++){
			soundData[s] = 0;
			f = Math.exp(-s/c);
			for(i = 0; i < k ; i++){
				a[i] = this.setamp(this.amplitudes[i],this.targetAmplitudes[i],f);
				soundData[s] += Math.sin(ks[i] * this.currentSoundSample++)*a[i];
			}
		}

		for(i = 0; i < k ; i++){
			if(a[i] <= this.limit) a[i] = 0;
		}

		this.amplitudes = a;
		//console.log(this.amplitudes)
		return this;
	}

	Sonify.prototype.setamp = function(a,to,f){
		if(a < this.limit) a = this.limit;
		if(to < a){
			a *= f;
			if(a < to) a = to;
		}
		if(to > a){
			a /= f;
			if(a > to) a = to;
		}
		if(a+this.limit > to && a-this.limit < to) a = to;
		if(a > 1) a = 1;
		if(a < this.limit) a = this.limit;
		return a;
	}
	Sonify.prototype.init = function(){

		this.amplitudes = new Array(this.f.length);
		this.targetAmplitudes = new Array(this.f.length);
		
		for(var i = 0 ; i < this.f.length ; i++){
			this.amplitudes[i] = 0;
			this.targetAmplitudes[i] = 0;
		}

		// Initialize the audio output.
		this.audio = new Audio();
		this.audio.mozSetup(1, this.sampleRate);

		this.currentWritePosition = 0;
		this.prebufferSize = this.sampleRate / 2; // buffer 500ms
		this.tail = null;

		var _obj = this;

		// The function called with regular interval to populate 
		// the audio output buffer.
		setInterval(function() {
			var written;
			// Check if some data was not written in previous attempts.
			if(_obj.tail) {	
				written = _obj.audio.mozWriteAudio(tail);
				_obj.currentWritePosition += written;
				if(written < _obj.tail.length) {
					// Not all the data was written, saving the tail...
					_obj.tail = _obj.tail.slice(written);
					return; // ... and exit the function.
				}
				_obj.tail = null;
			}

			// Check if we need add some data to the audio output.
			var currentPosition = _obj.audio.mozCurrentSampleOffset();
			var available = currentPosition + _obj.prebufferSize - _obj.currentWritePosition;
			if(available > 0) {
				// Request some sound data from the callback function.
				var soundData = new Float32Array(available);
				_obj.requestSoundData(soundData);

				// Writting the data.
				written = _obj.audio.mozWriteAudio(soundData);
				if(written < soundData.length) {
					// Not all the data was written, saving the tail.
					_obj.tail = soundData.slice(written);
				}
				_obj.currentWritePosition += written;
			}
		}, 100);

		return this;
	}



/*
	Canvas.prototype.blur = function(imageData, w, h){
	
		var steps = 3;
		var scale = 4;
		// Kernel width 0.9", trades off with alpha channel...
		var smallW = Math.round(w / scale);
		var smallH = Math.round(h / scale);
	
		var canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		var ctx = canvas.getContext("2d");
		ctx.putImageData(imageData,0,0);
	
		var copy = document.createElement("canvas");
		copy.width = smallW;
		copy.height = smallH;
		var copyCtx = copy.getContext("2d");
	
		// Convolution with square top hat kernel, by shifting and redrawing image...
		// Does not get brightness quite right...
		for (var i=0;i<steps;i++) {
			var scaledW = Math.max(1,Math.round(smallW - 2*i));
			var scaledH = Math.max(1,Math.round(smallH - 2*i));
			
			copyCtx.clearRect(0,0,smallW,smallH);
			copyCtx.drawImage(canvas, 0, 0, w, h, 0, 0, scaledW, scaledH);
			ctx.drawImage(copy, 0, 0, scaledW, scaledH, 0, 0, w, h);
		}
	
		return ctx.getImageData(0, 0, w, h);
	
	}
*/
/*	
	// Attach a handler to an event for the Canvas object in a style similar to that used by jQuery
	// .bind(eventType[,eventData],handler(eventObject));
	// .bind("resize",function(e){ console.log(e); });
	// .bind("resize",{me:this},function(e){ console.log(e.data.me); });
	Canvas.prototype.bind = function(ev,e,fn){
		if(typeof ev!="string") return this;
		if(typeof fn==="undefined"){
			fn = e;
			e = {};
		}else{
			e = {data:e}
		}
		if(typeof e!="object" || typeof fn!="function") return this;
		if(this.events[ev]) this.events[ev].push({e:e,fn:fn});
		else this.events[ev] = [{e:e,fn:fn}];
		return this;
	}
	// Trigger a defined event with arguments. This is for internal-use to be
	// sure to include the correct arguments for a particular event
	Canvas.prototype.trigger = function(ev,args){
		if(typeof ev != "string") return;
		if(typeof args != "object") args = {};
		var o = [];
		if(typeof this.events[ev]=="object"){
			for(var i = 0 ; i < this.events[ev].length ; i++){
				var e = G.extend(this.events[ev][i].e,args);
				if(typeof this.events[ev][i].fn == "function") o.push(this.events[ev][i].fn.call(this,e))
			}
		}
		if(o.length > 0) return o;
	}
	*/	


	// Helpful functions
	
	// Cross-browser way to add an event
	if(typeof addEvent!="function"){
		function addEvent(oElement, strEvent, fncHandler){
			if(!oElement) return;
			if(oElement.addEventListener) oElement.addEventListener(strEvent, fncHandler, false);
			else if(oElement.attachEvent) oElement.attachEvent("on" + strEvent, fncHandler);
		}
	}
	
	// A non-jQuery dependent function to get a style
	function getStyle(el, styleProp) {
		if (typeof window === 'undefined') return;
		var style;
		var el = document.getElementById(el);
		if(!el) return null;
		if(el.currentStyle) style = el.currentStyle[styleProp];
		else if (window.getComputedStyle) style = document.defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
		if(style && style.length === 0) style = null;
		return style;
	}

	// Extra mathematical/helper functions that will be useful - inspired by http://alexyoung.github.com/ico/
	var G = {};
	if (typeof Object.extend === 'undefined') {
		G.extend = function(destination, source) {
			for (var property in source) {
				if (source.hasOwnProperty(property)) destination[property] = source[property];
			}
			return destination;
		};
	} else G.extend = Object.extend;

	$.sonify = function(placeholder,input) {
		if(typeof input=="object") input.container = placeholder;
		else {
			if(placeholder){
				if(typeof placeholder=="string") input = { container: placeholder };
				else input = placeholder;
			}else{
				input = {};
			}
		}
		input.plugins = $.sonify.plugins;
		return new Sonify(input);
	};

	$.sonify.plugins = [];

})($);
