import {
	MAX_TIME_UNIT, MIN_TIME_UNIT,
	setTIME_UNIT, INITIAL_TIME_UNIT,
	getTIME_UNIT, setFastForwardMode
} from "./index.js";
import { TT } from "./utils.js"


// Custom Component to handle keyboard controls for desktop
// Compatible with A-Frame 1.7 
AFRAME.registerComponent('my-keyboard-controls', {
	schema: {
		enabled: { default: true }
	},

	init: function () {
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onKeyUp = this.onKeyUp.bind(this);
		this.keys = {};
		this.velocity = new THREE.Vector3(0, 0, 0);
		this.moveSpeed = 0.30;

		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
	},

	onKeyDown: function (event) {
		this.keys[event.code] = true;
	},

	onKeyUp: function (event) {
		this.keys[event.code] = false;
	},

	tick: function (time, delta) {
		// Skip if disabled or in VR mode
		if (!this.data.enabled || AFRAME.utils.device.checkHeadsetConnected()) {
			return;
		}

		const cameraRig = this.el;
		const camera = document.querySelector('#camera');

		// Reset velocity
		this.velocity.set(0, 0, 0);

		// Calculate movement direction based on camera rotation
		const direction = new THREE.Vector3(0, 0, -1);
		direction.applyQuaternion(camera.object3D.quaternion);
		direction.y = 0;
		direction.normalize();

		const sideDirection = new THREE.Vector3(1, 0, 0);
		sideDirection.applyQuaternion(camera.object3D.quaternion);
		sideDirection.y = 0;
		sideDirection.normalize();

		// Apply movement based on keys
		if (this.keys['KeyW'] || this.keys['ArrowUp']) {
			this.velocity.add(direction.clone().multiplyScalar(this.moveSpeed));
		}
		if (this.keys['KeyS'] || this.keys['ArrowDown']) {
			this.velocity.add(direction.clone().multiplyScalar(-this.moveSpeed));
		}
		if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
			this.velocity.add(sideDirection.clone().multiplyScalar(-this.moveSpeed));
		}
		if (this.keys['KeyD'] || this.keys['ArrowRight']) {
			this.velocity.add(sideDirection.clone().multiplyScalar(this.moveSpeed));
		}

		// Update position
		if (this.velocity.length() > 0) {
			cameraRig.object3D.position.add(this.velocity);
			// Debug display of keyboard movement
			const statusEl = document.querySelector('#desktop-status');
			if (statusEl) {
				statusEl.setAttribute('text', 'value', `Keyboard: Moving\nX: ${this.velocity.x.toFixed(2)}\nZ: ${this.velocity.z.toFixed(2)}`);
			}
		}
	},

	remove: function () {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
	}
});

// Component for Meta Quest (Oculus) thumbstick movement
// Compatible with A-Frame 1.7 
AFRAME.registerComponent('thumbstick-movement', {
	schema: {
		speed: { type: 'number', default: 0.05 },
		hand: { type: 'string', default: 'left' }
	},

	init: function () {
		this.velocity = new THREE.Vector3(0, 0, 0);
		this.thumbstickPressed = false;
		this.thumbstickX = 0;
		this.thumbstickY = 0;

		// Listen for thumbstick events
		this.el.addEventListener('thumbstickmoved', this.onThumbstickMoved.bind(this));
		this.el.addEventListener('thumbstickdown', () => { this.thumbstickPressed = true; });
		this.el.addEventListener('thumbstickup', () => { this.thumbstickPressed = false; });

		// Reference to the camera rig
		this.cameraRig = document.querySelector('#cameraRig');
	},

	onThumbstickMoved: function (evt) {
		// Update direction based on thumbstick position
		if (Math.abs(evt.detail.x) > 0.1 || Math.abs(evt.detail.y) > 0.1) {
			this.thumbstickX = evt.detail.x;
			this.thumbstickY = evt.detail.y;
		} else {
			this.thumbstickX = 0;
			this.thumbstickY = 0;
		}

		// Update status display
		const statusEl = document.querySelector('#vr-status');
		if (statusEl) {
			statusEl.setAttribute('text', 'value', `Thumbstick: ${this.data.hand}\nX: ${this.thumbstickX.toFixed(2)}\nY: ${this.thumbstickY.toFixed(2)}`);
		}
	},

	tick: function (time, delta) {
		if (!AFRAME.utils.device.checkHeadsetConnected()) return;

		// Get camera direction
		const cameraEl = document.querySelector('#camera');

		// Calculate forward and right directions based on camera orientation
		const directionMat = new THREE.Matrix4();
		directionMat.extractRotation(cameraEl.object3D.matrixWorld);

		const forward = new THREE.Vector3(0, 0, -1);
		forward.applyMatrix4(directionMat);
		forward.y = 0;
		forward.normalize();

		const right = new THREE.Vector3(1, 0, 0);
		right.applyMatrix4(directionMat);
		right.y = 0;
		right.normalize();

		// Calculate movement vector from thumbstick input
		const moveX = this.thumbstickX || 0;
		const moveY = this.thumbstickY || 0;

		// Reset velocity
		this.velocity.set(0, 0, 0);

		if (moveY) {
			// Forward/backward movement
			const direction = forward.clone().multiplyScalar(moveY * -1 * this.data.speed);
			this.velocity.add(direction);
		}

		if (moveX) {
			// Left/right (strafing) movement
			const direction = right.clone().multiplyScalar(moveX * this.data.speed);
			this.velocity.add(direction);
		}

		// Apply movement to camera rig
		if (this.velocity.length() > 0) {
			this.cameraRig.object3D.position.add(this.velocity);
		}
	}
});

// Component to initialize controllers for VR
// Added to <a-scene>
AFRAME.registerComponent('vr-controller-setup', {
	init: function () {
		this.el.addEventListener('enter-vr', () => {
			console.log('Entered VR mode');

			// Show VR status and hide desktop status
			document.querySelector('#vr-status').setAttribute('visible', true);
			document.querySelector('#desktop-status').setAttribute('visible', false);

			// Make controllers visible in VR
			const controllers = document.querySelectorAll('.controller');
			controllers.forEach(controller => {
				controller.setAttribute('visible', true);
			});
		});

		this.el.addEventListener('exit-vr', () => {
			console.log('Exited VR mode');

			// Show desktop status and hide VR status
			document.querySelector('#vr-status').setAttribute('visible', false);
			document.querySelector('#desktop-status').setAttribute('visible', true);

			// Hide controllers when exiting VR
			const controllers = document.querySelectorAll('.controller');
			controllers.forEach(controller => {
				controller.setAttribute('visible', false);
			});
		});
	}
});

// Component to make objects clickable and respond to interactions
AFRAME.registerComponent('clickable', {
	init: function () {
		const el = this.el;
		const originalColor = el.getAttribute('material').color;
		let clickActive = false;

		// Mouse enter - highlight the object
		el.addEventListener('mouseenter', function () {
			el.setAttribute('material', 'color', '#FFFF00');
		});

		// Mouse leave - return to original color
		el.addEventListener('mouseleave', function () {
			if (!clickActive) {
				el.setAttribute('material', 'color', originalColor);
			}
		});

		// Click interaction
		el.addEventListener('click', function () {
			clickActive = !clickActive;

			if (clickActive) {
				// Change color to indicate active state
				el.setAttribute('material', 'color', '#00FF00');

				// Make the object do something (in this case, spin)
				el.setAttribute('animation', {
					property: 'rotation',
					to: '0 360 0',
					dur: 2000,
					easing: 'linear',
					loop: true
				});

				// Show interaction feedback
				console.log('Clicked on:', el.id);
				document.querySelector('#feedback-text').setAttribute('text',
					'value', 'Clicked: ' + el.id + '\nClick again to deactivate');
			} else {
				// Return to original color
				el.setAttribute('material', 'color', originalColor);

				// Stop animation
				el.removeAttribute('animation');

				// Update feedback
				document.querySelector('#feedback-text').setAttribute('text',
					'value', 'Deactivated: ' + el.id);
			}
		});

		// Handle VR controller interactions (similar to mouse)
		el.addEventListener('raycaster-intersected', function () {
			el.setAttribute('material', 'color', '#FFFF00');
		});

		el.addEventListener('raycaster-intersected-cleared', function () {
			if (!clickActive) {
				el.setAttribute('material', 'color', originalColor);
			}
		});
	}
});


// WireXRk controller: manages state of animation and provides play-back control 
// and layer selection in settings panel
AFRAME.registerComponent('controller', {
	schema: {
		scale: { type: 'vec3' },
		PERIOD: { type: 'int', default: TT },
		position: { type: 'vec3' }
	},

	update: function (event) {
		let playPauseButton = document.querySelector("#playPauseButton");
		playPauseButton.textContent = '▶️';

		var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
		networks.forEach((network) => {
			network.components["network"].set_latest_startTime(-2)
			network.components["network"].setCurrentTime(0)
		})

		var rewindBadge = document.querySelector("#rewindBadge")
		var ffBadge = document.querySelector("#ffBadge")
		if (rewindBadge) rewindBadge.style.display = 'none'
		if (ffBadge) ffBadge.style.display = 'none'

		// Restore speed and clear playback flags if FF/rewind ended without
		// their callbacks firing (animation finished naturally mid-flight)
		if (this._ffOriginalTimeUnit != null) {
			setTIME_UNIT(this._ffOriginalTimeUnit)
			this._ffOriginalTimeUnit = null
		}
		if (this._audioGain) {
			this._audioGain.value = 1
			this._audioGain = null
		}
		if (this._resetPlaybackState) this._resetPlaybackState()
	},
	init: function () {
		let PERIOD = this.data.PERIOD
		const self = this


		var playPauseButton = document.querySelector("#playPauseButton");
		playPauseButton.textContent = '▶️';

		function event_listener_function(event) {
			var networks = document.querySelectorAll('a-entity[network]:not([network=""])')

			// toggle playPauseButton state icon
			var playPauseButton = document.querySelector("#playPauseButton");
			if (playPauseButton.textContent.trim() === '▶️') {
				// Cambiar a Pausa
				playPauseButton.textContent = '⏸️';
			} else {
				// Cambiar a Play
				playPauseButton.textContent = '▶️';
			}


			networks.forEach((network) => {
				var flying = network.components["network"].getFlying()
				var network_id = network.id

				switch (network.components["network"].getAnimationState()) {
					case 'INIT':

						network.components["network"].setNextPacket(0)
						network.components["network"].setCurrentTime(0)
						network.components["network"].setAnimationState("MOVING")
						setTimeout(() => { network.emit("next", { network: network.components["network"], startTime: -1 }, false) }, TT)

						break

					case 'MOVING':
						network.components["network"].setAnimationState("PAUSED")

						// Send to packets flying an animation-pause
						for (const packet of flying) {
							// pause animations of the packet and animations of the children
							packet.emit("animation-pause", null, false)
							for (const child of packet.children) {
								child.emit("animation-pause", null, false)
							}
						}

						break;

					case 'PAUSED':
						network.components["network"].setAnimationState("MOVING")

						// Send to packets flying an animation-resume
						for (const packet of flying) {
							// resume animations of the packet and animations of the children
							packet.emit("animation-resume", null, false)
							for (const child of packet.children) {
								child.emit("animation-resume", null, false)
							}
						}

						break
				} // switch

				network.addEventListener('next', network.components["network"].do_animate)

			}) //forEach

		} // event_listener_function



		var el = this.el
		function reset() {
			el.components["controller"].update()
			// first we start those networks that do not depend on others
			var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
			networks.forEach((network) => {
				if (network.depends_on == "") {
					network.components["network"].update()
					network.components["network"].setAnimationState("INIT")
				}

			})
			// then we start those networks that do depend on others
			networks.forEach((network) => {
				if (network.depends_on != "") {
					network.components["network"].update()
					network.components["network"].setAnimationState("INIT")
				}

			})
		}

		// How many simulation-time units to rewind per button press.
		// TT = 500 is the size of one scheduling slot, so 5*TT goes back ~5 packet dispatches.
		const REWIND_DELTA = 5 * TT

		// How long to wait after the last click before executing the rewind.
		const REWIND_DEBOUNCE_MS = 700

		// Guard to prevent overlapping rewinds
		let rewindInProgress = false
		let pendingSteps = 0
		let rewindDebounceTimer = null

		// Click handler: accumulates clicks and waits for a pause before executing.
		function rewind() {
			if (rewindInProgress) return
			if (ffInProgress || ffStarting) return

			playClickSound()
			pendingSteps++
			rewindBadge.textContent = `×${pendingSteps}`
			rewindBadge.style.display = 'inline'

			clearTimeout(rewindDebounceTimer)
			rewindDebounceTimer = setTimeout(() => executeRewind(pendingSteps), REWIND_DEBOUNCE_MS)
		}

		// Executes the actual rewind after the debounce settles.
		function executeRewind(steps) {
			pendingSteps = 0

			var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
			var mainNetworkEl = [...networks].find(n => n.components["network"].data.depends_on === "")
			if (!mainNetworkEl) { rewindBadge.style.display = 'none'; return }

			var mainNetwork = mainNetworkEl.components["network"]
			if (mainNetwork.getAnimationState() === "INIT") { rewindBadge.style.display = 'none'; return }

			var currentTime = mainNetwork.getCurrentTime()
			var targetTime = Math.max(0, currentTime - steps * REWIND_DELTA)

			var originalTimeUnit = getTIME_UNIT()

			// Show overlay with step count and mute audio during fast-forward
			var overlay = document.getElementById('rewindOverlay')
			if (overlay) {
				overlay.textContent = steps > 1 ? `⏪ Rewinding ×${steps}...` : '⏪ Rewinding...'
				overlay.style.display = 'flex'
			}
			var scene = document.querySelector('a-scene')
			var audioGain = scene.audioListener ? scene.audioListener.gain.gain : null
			if (audioGain) audioGain.value = 0

			// Cancel any pending fast-forward before rewinding
			ffInProgress = false
			ffStarting = false

			setTIME_UNIT(MIN_TIME_UNIT)
			setFastForwardMode(true)

			function restoreNormalMode() {
				setFastForwardMode(false)
				setTIME_UNIT(originalTimeUnit)
				if (overlay) overlay.style.display = 'none'
				if (audioGain) audioGain.value = 1
				rewindBadge.style.display = 'none'
				rewindInProgress = false
			}

			reset()
			rewindInProgress = true

			// Wait for network.update() + createNetwork() to complete.
			// Dependent networks have a hardcoded 1000ms delay before createNetwork(),
			// so we wait slightly longer before setting the rewind target and starting play.
			setTimeout(() => {
				if (targetTime > 0) {
					var callbackFired = false
					networks.forEach(n => {
						if (n.components["network"].data.depends_on === "") {
							n.components["network"].setRewindTarget(targetTime, () => {
								if (!callbackFired) {
									callbackFired = true
									restoreNormalMode()
								}
							})
						}
					})
				} else {
					restoreNormalMode()
				}
				playPauseButton.click()
			}, 1100)
		}

		// Plays the UI click sound without interrupting previous instances.
		// Creates a new Audio node each time so rapid clicks overlap cleanly.
		function playClickSound() {
			var src = document.querySelector('#playPause')?.src
			if (src) new Audio(src).play().catch(() => {})
		}

		let ffInProgress = false
		let ffStarting = false
		let ffPendingSteps = 0  // steps accumulated during the pre-start delay
		let ffOriginalTimeUnit = null

		// Called by update() when the animation ends naturally, to reset any
		// in-flight FF/rewind state that never got a chance to clean up.
		self._resetPlaybackState = function() {
			ffInProgress = false
			ffStarting = false
			ffPendingSteps = 0
			rewindInProgress = false
			pendingSteps = 0
		}

		// Each click either starts a fast-forward or extends an ongoing one by REWIND_DELTA.
		// No debounce: response is immediate and clicks stack naturally while running.
		function fastForward() {
			if (rewindInProgress) return
			if (ffInProgress) return

			playClickSound()

			var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
			var mainNetworkEl = [...networks].find(n => n.components["network"].data.depends_on === "")
			if (!mainNetworkEl) return

			var mainNetwork = mainNetworkEl.components["network"]
			if (mainNetwork.getAnimationState() !== "MOVING") return

			if (ffStarting) {
				// Overlay not shown yet: accumulate steps and show badge
				ffPendingSteps++
				ffBadge.textContent = `×${ffPendingSteps + 1}`
				ffBadge.style.display = 'inline'
				return
			}

			var overlay = document.getElementById('rewindOverlay')

			// Start fast-forward: delay overlay slightly so A-Frame finishes
			// re-rendering the GUI panel after the button click, then show blur.
			ffStarting = true
			ffPendingSteps = 0
			ffBadge.textContent = '×1'
			ffBadge.style.display = 'inline'
			setTimeout(() => {
				ffStarting = false

				// Animation may have ended during the delay
				if (mainNetwork.getAnimationState() !== 'MOVING') {
					ffPendingSteps = 0
					ffBadge.style.display = 'none'
					return
				}

				if (overlay) {
					overlay.textContent = '⏩ Fast Forward...'
					overlay.style.display = 'flex'
				}

				var scene = document.querySelector('a-scene')
				var audioGain = scene.audioListener ? scene.audioListener.gain.gain : null
				if (audioGain) audioGain.value = 0
				self._audioGain = audioGain

				ffOriginalTimeUnit = getTIME_UNIT()
				self._ffOriginalTimeUnit = ffOriginalTimeUnit
				setTIME_UNIT(MIN_TIME_UNIT)
				ffInProgress = true

				var totalSteps = 1 + ffPendingSteps
				ffPendingSteps = 0
				var currentTime = mainNetwork.getCurrentTime()
				networks.forEach(n => {
					if (n.components["network"].data.depends_on === "") {
						n.components["network"].setFastForwardTarget(currentTime + totalSteps * REWIND_DELTA, () => {
							setTIME_UNIT(ffOriginalTimeUnit)
							self._ffOriginalTimeUnit = null
							if (overlay) overlay.style.display = 'none'
							if (audioGain) audioGain.value = 1
							ffBadge.style.display = 'none'
							ffInProgress = false
						})
					}
				})
			}, 500)

		}


		let position = Object.assign({}, this.data.position)

		// prueba gui my-interface
		let guiPanel = document.createElement('a-entity');
		guiPanel.setAttribute('html', 'cursor:#cursor;html:#gui-panel');
		guiPanel.setAttribute('class', 'clickable');
		guiPanel.setAttribute('event-set__mouseenter', "scale: 1.5 1.5 1.5")
		guiPanel.setAttribute('event-set__mouseleave', "scale: 1 1 1")
		guiPanel.setAttribute('event-set__click', "material.color: blue")


		position = Object.assign({}, this.data.position)
		position.x += -0.2
		position.y += 0.6
		position.z += 0.5


		guiPanel.setAttribute('position', position);
		guiPanel.setAttribute('scale', '10 10 10');
		guiPanel.setAttribute('id', 'guiPanel');
		guiPanel.setAttribute('visible', true)
		this.el.appendChild(guiPanel);

		// playPause
		var playPauseButton = document.querySelector("#playPauseButton");
		guiPanel.setAttribute('sound', { on: 'click', src: '#playPause', volume: 5 });
		playPauseButton.addEventListener('click', event_listener_function)


		// stopButton
		var stopButton = document.querySelector("#stopButton");
		stopButton.addEventListener('click', () => {
			ffInProgress = false
			ffStarting = false
			ffPendingSteps = 0
			ffBadge.style.display = 'none'
			rewindBadge.style.display = 'none'
			var overlay = document.getElementById('rewindOverlay')
			if (overlay) overlay.style.display = 'none'
			reset()
		})

		// rewindButton
		var rewindButton = document.querySelector("#rewindButton");
		var rewindBadge = document.querySelector("#rewindBadge");
		rewindButton.addEventListener('click', rewind)

		// ffButton
		var ffButton = document.querySelector("#ffButton");
		var ffBadge = document.querySelector("#ffBadge");
		ffButton.addEventListener('click', fastForward)

		// settingsButton
		var settngsButton = document.querySelector("#settingsButton");
		settingsButton.addEventListener('click', settings)


		// settings panel activated by settingsButton
		var el = this.el
		var that = this
		function settings(event) {
			let fieldset = createSettingsFieldset(el)

			let settingsPanel = document.createElement('a-entity');
			settingsPanel.setAttribute('id', 'settingsPanel');
			settingsPanel.appendChild(fieldset)

			settingsPanel.setAttribute('html', 'cursor:#cursor;html:#settings-panel');
			settingsPanel.setAttribute('sound', { on: 'click', src: '#playPause', volume: 5 });
			settingsPanel.setAttribute('class', 'clickable');
			settingsPanel.setAttribute('event-set__mouseenter', "scale: 1.5 1.5 1.5")
			settingsPanel.setAttribute('event-set__mouseleave', "scale: 1 1 1")
			settingsPanel.setAttribute('event-set__click', "material.color: blue")

			position = Object.assign({}, that.data.position)
			position.x += 1.2
			position.y += 1.1
			position.z += 0.5

			settingsPanel.setAttribute('position', position);
			settingsPanel.setAttribute('scale', '10 10 10');
			settingsPanel.setAttribute('visible', true)


			el.appendChild(settingsPanel);
		}

		// slider speedSelector
		const slider = document.getElementById('slider');
		const sliderValue = document.getElementById('sliderValue');

		slider.addEventListener('input', () => {
			setTIME_UNIT(MAX_TIME_UNIT - Number(slider.value))
		});


		// ==========================================================
		// --- INICIO CÓDIGO PROTOTIPO 1 (MODO RETO) ---
		// ==========================================================

		// 1. Crear el panel HTML dinámicamente y añadirlo a la página
		let panelReto = document.createElement('div');
		panelReto.id = 'panel-reto';
		panelReto.style.cssText = 'display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: white; padding: 30px; border-radius: 12px; text-align: center; border: 4px solid #3498db; font-family: sans-serif; box-shadow: 0px 10px 30px rgba(0,0,0,0.5);';
		panelReto.innerHTML = `
			<h2 style="color: #2c3e50; margin-top: 0; font-size: 24px;">Modo Reto: Intervención Activa</h2>
			<p style="color: #34495e; font-size: 16px; margin-bottom: 25px;">La simulación se ha detenido temporalmente.<br>¿Qué crees que va a pasar a continuación con el paquete enrutado?</p>
			<button id="btn-continuar" style="padding: 12px 24px; background: #2ecc71; color: white; border: none; cursor: pointer; border-radius: 6px; font-size: 16px; font-weight: bold; transition: background 0.3s;">
				Continuar Simulación
			</button>
		`;
		document.body.appendChild(panelReto);

		// 2. Lógica para forzar la pausa y mostrar el panel a los 5 segundos de arrancar
		setTimeout(() => {
			// Mostrar el panel HTML centrado
			document.getElementById('panel-reto').style.display = 'block';

			// Congelar la red simulando que se pulsó el Pause
			var networks = document.querySelectorAll('a-entity[network]:not([network=""])');
			networks.forEach((network) => {
				var flying = network.components["network"].getFlying();
				network.components["network"].setAnimationState("PAUSED");

				// Actualizar el icono del botón de la interfaz por si el usuario lo mira
				var playPauseBtn = document.querySelector("#playPauseButton");
				if (playPauseBtn && playPauseBtn.textContent.trim() === '⏸️') {
					playPauseBtn.textContent = '▶️';
				}

				// Detener todos los paquetes que estén volando por los enlaces
				for (const packet of flying) {
					packet.emit("animation-pause", null, false);
					for (const child of packet.children) {
						child.emit("animation-pause", null, false);
					}
				}
			});
		}, 5000); // 5000ms = 5 segundos desde que carga

		// 3. Lógica para reanudar la simulación al pulsar el botón del panel
		document.getElementById('btn-continuar').addEventListener('click', () => {
			// Ocultar el panel
			document.getElementById('panel-reto').style.display = 'none';

			// Reanudar la animación de la red
			var networks = document.querySelectorAll('a-entity[network]:not([network=""])');
			networks.forEach((network) => {
				var flying = network.components["network"].getFlying();
				network.components["network"].setAnimationState("MOVING");

				// Actualizar el icono del botón a Pause de nuevo
				var playPauseBtn = document.querySelector("#playPauseButton");
				if (playPauseBtn && playPauseBtn.textContent.trim() === '▶️') {
					playPauseBtn.textContent = '⏸️';
				}

				// Volver a emitir la señal de movimiento a los paquetes
				for (const packet of flying) {
					packet.emit("animation-resume", null, false);
					for (const child of packet.children) {
						child.emit("animation-resume", null, false);
					}
				}
			});
		});

		// Añadir un simple efecto visual de hover al botón
		let btnContinuar = document.getElementById('btn-continuar');
		btnContinuar.addEventListener('mouseover', () => btnContinuar.style.backgroundColor = '#27ae60');
		btnContinuar.addEventListener('mouseout', () => btnContinuar.style.backgroundColor = '#2ecc71');

		// ==========================================================
		// --- FIN CÓDIGO PROTOTIPO 1 ---
		// ==========================================================


		console.log("GUI panel added to the scene")

	}
});


// Creates a radio buttons from options and add them to fieldset
function createRadioButtons(network, network_id, options, fieldset) {
	var layer_option = 0;
	options.forEach(option => {
		// Create the radio button
		const radio = document.createElement('input');
		radio.type = 'radio';
		radio.id = `network-${network_id}-radio-${option.value}`;
		radio.name = `network-${network_id}-radio-group`; // Group name for radio buttons
		radio.value = option.value;

		// Preset the radio button if `checked` is true
		if (option.checked) {
			radio.checked = true;
		}

		// event handler
		var that = network.components["network"]
		function eventHandler(newView, viewsMenu) {
			var controller = document.querySelector('#controller')
			controller.components["controller"].update()

			that.setView(newView.view);
			that.setNodeFilter(newView.nodeFilter)
			that.setPacketFilter(newView.packetFilter)
			that.setE2ePacketFilter(newView.e2ePacketFilter)


			var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
			networks.forEach((network) => {
				network.components["network"].update()
				network.components["network"].setAnimationState("INIT");
			})
		}
		radio.addEventListener('click', eventHandler.bind(null, that.VIEWS_MENU[layer_option], that.VIEWS_MENU));

		// Create the label for the radio button
		const label = document.createElement('label');
		label.textContent = option.label;
		label.setAttribute('for', radio.id);

		// Append radio button and label to fieldset
		fieldset.appendChild(radio);
		fieldset.appendChild(label);

		// Add a line break for better layout
		fieldset.appendChild(document.createElement('br'));

		layer_option += 1;
	});
}


// Creates and returns a new fieldset for layers settings.
// Each network has its own radio button for choosing its layers settings.
function createSettingsFieldset(el) {
	const fieldset = document.createElement('field-set');
	fieldset.setAttribute('id', 'settings-panel')
	fieldset.style.display = 'inline-block';
	fieldset.style.background = 'rgb(173, 169, 169)';
	fieldset.style.color = '#333333';
	fieldset.style.borderRadius = '1em';
	fieldset.style.padding = '0.5rem';
	fieldset.style.margin = '0';
	fieldset.style.accentColor = 'rgb(15, 106, 186)';
	fieldset.style.width = '400px'; // Set the width
	fieldset.style.height = '200px'; // Set the height


	// For each network, create the radio buttons for its layers
	var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
	let level = 1;
	networks.forEach((network) => {
		var options = []

		const legend = document.createElement('legend');
		legend.textContent = 'Initialize with new filter for network ' + level;
		fieldset.appendChild(legend);

		// retrieve options for the radio buttons of this network
		network.components["network"].VIEWS_MENU.forEach((entry) => {
			options.push({ value: entry["view"], label: entry["text"], checked: false })
			if (entry["view"] == network.components["network"].getView()) {
				options[options.length - 1].checked = true;
			}
		})
		if (network.components["network"].getView() == "")
			options[options.length - 1].checked = true;

		// Create a radio buttons for this (level) network and add them to fieldset
		createRadioButtons(network, level, options, fieldset)

		fieldset.appendChild(document.createElement('br'));

		level += 1;
	})


	// Create and append the close button
	const closeButton = document.createElement('button');
	closeButton.textContent = 'Close';
	closeButton.className = 'close-btn';
	closeButton.addEventListener('click', (event) => {
		// destroy the panel
		const settingsPanel = document.getElementById("settingsPanel");
		el.removeChild(settingsPanel)
	});
	fieldset.appendChild(closeButton);


	return fieldset;
}