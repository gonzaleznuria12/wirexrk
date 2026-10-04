import jseEval from 'https://cdn.jsdelivr.net/npm/jse-eval@1.5.2/+esm'
import {
	wait, anime, pointInSegment, getColor, dns_info, http_info, hex_with_colons_to_ascii
} from "./utils.js";
import { getTIME_UNIT } from "./index.js";
import eventBus from "./eventBus.js"
import AnimatorFactory from "./packet_animators.js"

AFRAME.registerComponent('packet', {
	schema: {
		network: { default: "" },
		from: { default: "" },
		to: { default: "" },
		xPosition: { type: 'number', default: 0 },
		yPosition: { type: 'number', default: 0 },
		SHIFT_Y: { type: 'number', default: 2 },
		zPosition: { type: 'number', default: 0 },
		toXPosition: { type: 'string', default: '' },
		toYPosition: { type: 'string', default: '' },
		toZPosition: { type: 'string', default: '' },
		elementsScale: { type: 'number', default: 0 },
		id: { type: 'number', default: 0 },
		frameTime: { type: 'number' },
		class: { type: 'string' },
		startTime: { type: 'number', default: 0 },
		ip: { default: "" },
		eth: { default: "" },
		arp: { default: "" },
		dataInfo: { default: "" },
		data: { default: "" },
		tcp: { default: "" },
		udp: { default: "" },
		dns: { default: "" },
		http: { default: "" },
		icmp: { default: "" },
		frameProtocols: { default: "" },
		e2ePumps: { default: 0 },
		linkDuration: { default: "" },
		vxlan: { default: "" },
		vlan: { default: "" },
		mustBeLostInE2EViews: { default: false }

	},
	next_packet_anim(notToMyNetwork = false) {
		let packetParams = this.data
		var networks = document.querySelectorAll('a-entity[network]:not([network=""])')
		networks.forEach((network) => {
			if (notToMyNetwork && network.components["network"] == packetParams.network) {
				return
			}
			network.emit("next", { network: packetParams.network, startTime: packetParams.startTime }, false)
		})
	},
	destroy() {
		let packet = this.el

		// Destroy packet element
		let length = packet.children.length

		for (var a = 0; a < length; a++) {
			packet.children[0].remove()
		}
	},
	getKey() {
		let packetParams = this.data
		let ip_src, ip_id, ip_dst


		if (Array.isArray(packetParams.ip)) {
			ip_src = packetParams.ip[0]["ip.src"]
			ip_id = packetParams.ip[0]["ip.id"]
			ip_dst = packetParams.ip[0]["ip.dst"]

		}
		else {
			ip_src = packetParams.ip["ip.src"]
			ip_id = packetParams.ip["ip.id"]
			ip_dst = packetParams.ip["ip.dst"]
		}


		return "" + ip_src + ip_dst + ip_id
	},

	addAnimations() {
		let packet = this.el
		let packetParams = this.data


		packet.setAttribute('animation__fadeout', { property: 'material.opacity', to: 0, dur: (15 * getTIME_UNIT()).toString(), resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', startEvents: "fadeout", enabled: 'false' })
		packet.setAttribute('animation__hide', { property: 'material.opacity', to: 0, dur: 0, resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', startEvents: "hide", enabled: 'false' })
		packet.setAttribute('animation__show', { property: 'material.opacity', to: 1, dur: 0, resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', startEvents: "show", enabled: 'false' })


		packet.setAttribute('animation__park', {
			property: 'position',
			to: { x: packetParams.xPosition, y: packetParams.yPosition + 2.1 * packetParams.SHIFT_Y, z: packetParams.zPosition },
			dur: 5 * getTIME_UNIT(),
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			startEvents: "park",
			easing: 'linear',
			enabled: 'false' // if not false, when resumed it starts. A bug.	    	    
		});

		packet.setAttribute('animation__unpark', {
			property: 'position',
			to: { x: packetParams.xPosition, y: packetParams.yPosition, z: packetParams.zPosition },
			dur: 10 * getTIME_UNIT(),
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			startEvents: "unpark",
			easing: 'linear',
			enabled: 'false' // if not false, when resumed it starts. A bug.	    	    
		});

		packet.setAttribute('animation__out_of_node', {
			property: 'scale',
			from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale },
			//	    to: "2 2 2",
			to: "1 1 1",
			dur: 0,
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			startEvents: "out_of_node",
			easing: 'linear',
			enabled: 'false' // if not false, when resumed it starts. A bug.	    
		});

		packet.setAttribute('animation__out_of_node_immediate', {
			property: 'scale',
			from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale },
			to: "1 1 1",
			dur: 0,
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			startEvents: "out_of_node_immediate",
			easing: 'linear',
			enabled: 'false' // if not false, when resumed it starts. A bug.	    
		});


		packet.setAttribute('animation__link', {
			property: 'position',
			to: { "x": packetParams.toXPosition, "y": packetParams.toYPosition, "z": packetParams.toZPosition },
			dur: 20 * getTIME_UNIT(), // PacketParams.linkDuration
			easing: 'linear', //'easeInOutCubic',
			startEvents: "link",
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			enabled: 'false' // if not false, when resumed it starts. A bug.
		});

		packet.setAttribute('animation__into_node', {
			property: 'position',
			to: { "x": packetParams.toXPosition, "y": packetParams.toYPosition, "z": packetParams.toZPosition },
			dur: 2 * getTIME_UNIT(),
			easing: 'linear',
			startEvents: "into_node",
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			enabled: 'false' // if not false, when resumed it starts. A bug.
		});

		packet.setAttribute('animation__route', {
			property: 'position',
			to: pointInSegment(
				{ "x": packetParams.xPosition, "y": packetParams.yPosition, "z": packetParams.zPosition },
				{ "x": packetParams.toXPosition, "y": packetParams.toYPosition, "z": packetParams.toZPosition },
				0.1
			),
			dur: 5 * getTIME_UNIT(),
			easing: 'easeInOutCubic',
			startEvents: "route",
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			enabled: 'false' // if not false, when resumed it starts. A bug.
		});
	},

	createSphere() {
		let packet = this.el
		let packetParams = this.data

		// The sphere in the link representing a packet
		let sphere = document.createElement('a-sphere');



		sphere.setAttribute('id', 'sphere' + packet.id)
		sphere.setAttribute('position', { x: 0, y: packetParams.yPosition / 15 - 4.6, z: 0 })
		sphere.setAttribute('color', 'yellow')
		sphere.setAttribute('geometry', { primitive: 'sphere', radius: 0.3 / packetParams.elementsScale });
		sphere.setAttribute('visible', false)

		packet.appendChild(sphere)
	},

	setInfoText(protocol, protocol_content, packetParams, infoText, newBox, noEth = false) {
		if (!infoText)
			// If an infoText is scheduled to be shown but reset destroys it, this function
			// will be run but the infoText does not exist 
			return;

		let text = ""
		let color = getColor(protocol)
		let h1 = '<h1 style="padding: 0rem; font-size: 1.4rem; font-weight: 900; ' +
			'font-family: monospace; text-align: left; color: ' + color + '">'
		let h2 = '<h2 style="padding: 0rem; font-size: 1.2rem; font-weight: 800; ' +
			'font-family: monospace; text-align: left; color: ' + color + '">'
		let h3 = '<h3 style="padding: 0rem; font-size: 1rem; font-weight: 700; ' +
			'font-family: monospace;  text-align: left; color: ' + color + '">'

		switch (protocol) {
			case 'dns':
				text += dns_info(packetParams);
				break;

			case 'http':
				text += http_info(packetParams);

				break;

			case 'dataInfo':
				if (packetParams.tcp['tcp.len'] > 10) moreData = " (...)"
				else moreData = "";

				text += h2 +
					'Application Protocol:</h2>' + h3 +
					'Data: ' + hex_with_colons_to_ascii(packetParams.tcp['tcp.payload'].slice(0, 10)) + '<br>' +
					'Len: ' + packetParams.tcp['tcp.len'] + '</h3>'
				break;

			case 'data':
				if (packetParams.tcp != "") {
					let moreData
					if (packetParams.tcp['tcp.len'] > 10) moreData = " (...)"
					else moreData = "";
					text += h2 +
						'Application protocol:</h2>' + h3 +
						'Data: ' + hex_with_colons_to_ascii(packetParams.tcp['tcp.payload'].slice(0, 10)) + moreData + '<br>' +
						'Len: ' + packetParams.tcp['tcp.len'] + '</h3>'
				}
				else if (packetParams.udp != "") {
					let moreData
					if (packetParams.udp['udp.length'] > 10) moreData = " (...)"
					else moreData = "";

					text += h2 +
						'Application protocol:</h2>' + h3 +
						'Data: ' + hex_with_colons_to_ascii(packetParams.data.slice(0, 10)) + moreData + '<br>' +
						'Len: ' + packetParams.udp['udp.length'] + '</h3>'
				}
				break;

			case 'tcp':
				text += h2 +
					'TCP Protocol:</h2><br>' + h3 +
					'Src port: ' + packetParams.tcp['tcp.srcport'] + '<br>' +
					'Dst port: ' + packetParams.tcp['tcp.dstport'] + '<br>'

				let tcp_flags_str = ""

				if (packetParams.tcp["tcp.flags_tree"]["tcp.flags.syn"] == "1")
					tcp_flags_str += "SYN "
				if (packetParams.tcp["tcp.flags_tree"]["tcp.flags.fin"] == "1")
					tcp_flags_str += "FIN "
				if (packetParams.tcp["tcp.flags_tree"]["tcp.flags.ack"] == "1")
					tcp_flags_str += "ACK "
				if (packetParams.tcp["tcp.flags_tree"]["tcp.flags.reset"] == "1")
					tcp_flags_str += "RST "
				if (packetParams.tcp["tcp.flags_tree"]["tcp.flags.push"] == "1")
					tcp_flags_str += "PSH "

				text += 'Flags: ' + tcp_flags_str + '<br>'
				text += 'Seq: ' + packetParams.tcp['tcp.seq'] + '<br>' +
					'Ack: ' + packetParams.tcp['tcp.ack'] + '<br>' +
					'Window Size: ' + packetParams.tcp['tcp.window_size'] + '</h3>'
				break;

			case 'udp':
				text += h2 +
					'UDP Protocol:</h2>' + h3 +
					'Src port: ' + packetParams.udp['udp.srcport'] + '<br>' +
					'Dst port: ' + packetParams.udp['udp.dstport'] + '</h3>'
				break;

			case 'icmp':
				text += h2 +
					'ICMP Protocol:</h2>' + h3 +
					'Type: ' + packetParams.icmp['icmp.type'] + '<br>' +
					'Code: ' + packetParams.icmp['icmp.code'] + '</h3>'
				break;

			case 'ip':
				text += h2 +
					'IP Protocol:</h2>' + h3 +
					'Source: ' + protocol_content['ip.src'] + '<br>' +
					'Destination: ' + protocol_content['ip.dst'] + '<br>' +
					'TTL: ' + protocol_content['ip.ttl'] + '</h3>'
				break;

			case 'arp':
				let operation = ""

				let target_mac
				if (packetParams.arp['arp.opcode'] == "1") {
					operation = "1 (request)"
					target_mac = ""
				}
				else {
					operation = "2 (reply)"
					target_mac = packetParams.arp['arp.dst.hw_mac']
				}

				text += h2 +
					'ARP Protocol:</h2>' + h3 +
					'Opcode: ' + operation + '<br>' +
					'Sender MAC: ' + packetParams.arp['arp.src.hw_mac'] + '<br>' +
					'Sender IP: ' + packetParams.arp['arp.src.proto_ipv4'] + '<br>' +
					'Target MAC: ' + target_mac + '<br>' +
					'Target IP: ' + packetParams.arp['arp.dst.proto_ipv4'] + '</h3>'
				break;
			case 'vlan':
				text += h2 +
					'VLAN Protocol:</h2>' + h3 +
					'id: ' + protocol_content['vlan.id'] + '<br>' +
					'etype: ' + protocol_content['vlan.etype'] + '</h3>'
				break;
			case 'vxlan':
				text += h2 +
					'VXLAN Protocol:</h2>' + h3 +
					'vni: ' + protocol_content['vxlan.vni'] + '</h3>'
				break;

			case 'eth':
				var ethDst
				if (noEth) {
					ethDst = ""
				}
				else
					ethDst = protocol_content['eth.dst']

				var type
				if (protocol_content['eth.type'] == '0x0806')
					type = "ARP"
				else if (protocol_content['eth.type'] == '0x0800')
					type = "IPv4"
				else if (protocol_content['eth.type'] == '0x8100')
					type = "VLAN"

				text += h2 +
					'Ethernet Protocol:</h2>' + h3 +
					'Destination: ' + ethDst + '<br>' +
					'Source: ' + protocol_content['eth.src'] + '<br>' +
					'Type: ' + type + " (" + protocol_content['eth.type'] + ")" + '</h3>'
				break;



		}


		infoText.setAttribute('visible', true);
		infoText.removeAttribute('html');
		var textTemplate = document.getElementById(packetParams.id + '-template');

		textTemplate.innerHTML = text

		textTemplate.style = "display: inline-block; background: #5f6a76; color: purple; border-radius: 0.5em; padding: 0.5em; margin:0;"
		infoText.setAttribute('html', 'cursor:#cursor;html:' + '#' + packetParams.id + '-template');
		infoText.setAttribute('visible', true);
		newBox.removeAttribute('sound');
		newBox.setAttribute('sound', { src: '#showLevels', volume: 5, autoplay: "true" });
		newBox.setAttribute('class', 'clickable')


	},


	createInfoText() {
		let packet = this.el
		let packetParams = this.data

		let infoText = document.createElement('a-entity');

		infoText.setAttribute('position', { x: 3.5, y: packetParams.yPosition / 15, z: 0 });
		infoText.setAttribute('look-at', "[camera]");
		infoText.setAttribute('visible', false);
		infoText.setAttribute('scale', { x: 20, y: 20, z: 20 });
		infoText.setAttribute('isPoster', true);

		infoText.setAttribute('id', "infotext" + packet.id)

		packet.appendChild(infoText)

		return infoText
	},

	createHeaderBox(level, level_index, infoText) {
		let packet = this.el
		let packetParams = this.data
		let that = this

		let newBox = document.createElement('a-box');
		newBox.setAttribute('animation__blink', { property: 'scale', from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale }, to: { x: packetParams.elementsScale, y: packetParams.elementsScale, z: packetParams.elementsScale }, dur: (4 * getTIME_UNIT()).toString(), easing: 'easeInOutQuint', "loop": "4", startEvents: "blink", resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', enabled: 'false' })
		newBox.setAttribute('animation__fadeout', { property: 'material.opacity', to: 0, dur: (15 * getTIME_UNIT()).toString(), resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', startEvents: "fadeout", enabled: 'false' })
		newBox.setAttribute('animation__fadein', { property: 'material.opacity', to: 1, dur: (15 * getTIME_UNIT()).toString(), resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', startEvents: "fadein", enabled: 'false' })
		newBox.setAttribute('id', level.protocol + "Box" + packetParams.id);

		// newBox.setAttribute('position', { x: 0, y: (packetParams.yPosition + (level_index)), z: 0 });
		newBox.setAttribute('position', { x: 0, y: level_index, z: 0 });
		newBox.setAttribute('color', getColor(level.protocol));
		newBox.setAttribute('visible', false);

		packet.appendChild(newBox)

		newBox.addEventListener('mouseenter', function () {
			newBox.setAttribute('scale', { x: 1.2, y: 1.2, z: 1.2 });
		});
		newBox.addEventListener('mouseleave', function () {
			newBox.setAttribute('scale', { x: 1, y: 1, z: 1 })
			newBox.removeAttribute('animation');
			newBox.setAttribute('rotation', { x: 0, y: 0, z: 0 });
		});

		let actualInfoShown = ''
		let isClosedInfo = false
		newBox.addEventListener('click', function () {
			if (isClosedInfo == false && actualInfoShown == level.protocol) {
				isClosedInfo = true
				actualInfoShown = ''
				infoText.setAttribute('visible', false);
				newBox.removeAttribute('sound');
				infoText.removeAttribute('html');
				newBox.setAttribute('sound', { src: '#showLevels', volume: 5, autoplay: "true" });
			} else {
				isClosedInfo = false
				actualInfoShown = level.protocol
				that.setInfoText(level.protocol, level.protocol_content, packetParams, infoText, newBox);
			}

		});

		return newBox
	},

	createAnimation: function (network) {
		let packet = this.el
		let packetParams = this.data

		packet.setAttribute('id', packetParams.id);
		this.createSphere()
		let infoText = this.createInfoText()

		let levels = []
		var already_eliminated_eth_in_e2e_tunnel = false
		var tunnelLevel = {}
		var level_index = 1
		for (const protocol of packetParams.frameProtocols) {
			if (!packetParams[protocol])
				continue

			// if end to end animation of packet, don't show eth
			// if 2 eth headers, only eliminate the first, downmost one
			const filter = jseEval.compile(network.getE2ePacketFilter());
			if (filter(packetParams) && protocol == "eth" && !already_eliminated_eth_in_e2e_tunnel) {
				already_eliminated_eth_in_e2e_tunnel = true
				continue
			}

			let level
			if (Array.isArray(packetParams[protocol])) {
				if (! tunnelLevel.hasOwnProperty(protocol))
					tunnelLevel[protocol] = 0

				level = {
					"protocol": protocol,
					// if same protocol appears > #1 in json capture, the key of the protocol is an array
					// this happens for eth and ip in vxlan packets when json capture is generated with options
					// -T json --no-equal-keys
					"protocol_content": packetParams[protocol][tunnelLevel[protocol]] 
				}
				tunnelLevel[protocol] += 1
			}
			else
				level = {
					"protocol": protocol,
					// if same protocol appears > #1 in json capture, the key of the protocol is an array
					// this happens for eth and ip in vxlan packets when json capture is generated with options
					// -T json --no-equal-keys
					"protocol_content": packetParams[protocol]
				}

			let newBox = this.createHeaderBox(level, level_index, infoText)


			level_index += 1
			level["box"] = newBox

			levels.push(level)
		}

		packet = Object.assign(packet, { "levels": levels });

		let bottommost_protocol = levels[0]["protocol"]
		let packetColor = getColor(bottommost_protocol);

		packet.setAttribute('material', 'color', packetColor);
		packet.setAttribute('position', { x: packetParams.xPosition, y: packetParams.yPosition, z: packetParams.zPosition });
		packet.setAttribute('class', packetParams.class);
		packet.setAttribute('sound', { src: '#packetIn', volume: 5, autoplay: "true" });

		this.addAnimations()
	},


	console: function (nodeName, packetParams, sending_or_receiving) {
		var network = this.data.network
		var finalPackets = network.getFinalPackets()
		var nodeList = network.getNodeList()

		var node = nodeList.find(o => o.nodeName === nodeName)
		let text = ""
		for (let e of node.console[sending_or_receiving]) {
			let pass = true;
			for (let c of e["conditions"]) {
				pass = (pass
					&& packetParams[c.protocol]
					&& packetParams[c.protocol][c.protocol + "." + c.field] == c.value)
			}

			if (!pass) {
				continue
			}
			else {
				for (var i = 0; i < e.actions.length; i++) {
					let protocol = e.actions[i]["protocol"]
					let field = e.actions[i]["field"]
					if (protocol == "null"
						&& field == "null")
						text += e.actions[i]["value"] + "\n"
					else {
						text += packetParams[protocol][protocol + "." + field] + "\n"
					}

				}
			}
		}


		return text

	},


	finish_packet(scene) {
		let packet = this.el
		let packetParams = this.data

		let promise1 = Promise.resolve()

		var network = packetParams.network
		var finalPackets = network.getFinalPackets()


		if (packet.id == finalPackets.length - 1) {
			console.log("Animation is finished")

			promise1 = promise1
				.then(() => wait(120 * getTIME_UNIT(), network)) // Give some time for final
				// animations still in progress
				.then(() => {
					let finishPanel = document.createElement('a-text');
					finishPanel.setAttribute("value", 'FIN: pulse Reset para reiniciar')
					finishPanel.setAttribute('position', "0 10 20")
					finishPanel.setAttribute('width', "100")
					scene.appendChild(finishPanel);

					scene.removeChild(finishPanel)

					// Animation is finished, clean up
					network.setAnimationState("INIT");

					controller = document.querySelector('#controller')
					controller.components["controller"].update()

					network.update()
				})
		}

		promise1.then(() => this.destroy())
	},

	check_console: function (sending_receiving, node) {
		let packetParams = this.data
		var nodeName = node.nodeName
		var nodeFromAnimation = document.getElementById(nodeName);
		let promise = Promise.resolve()

		var network = this.data.network
		var flying = network.getFlying()


		// Process console if it exists
		let showConsole = function (consoleText, the_text, coords, color) {

			node[consoleText] = document.createElement('a-entity');
			node[consoleText].setAttribute("text", "font", "sourcecodepro")
			node[consoleText].setAttribute("text", "value", the_text)
			node[consoleText].setAttribute("text", "color", color)
			node[consoleText].setAttribute("text", "width", 370)
			node[consoleText].setAttribute('rotation', '0 88 0');
			node[consoleText].setAttribute('position', coords)
			node[consoleText].setAttribute('scale', "0.8 0.8 0.8")
			node[consoleText].setAttribute('text', 'wrapCount', 80)
			node[consoleText].setAttribute('text', 'tabSize', 2)


			nodeFromAnimation.appendChild(node[consoleText])
		}


		// Only some pcs have console
		if (node.type == "host" && node.console) {
			let console_data = this.console(nodeName, packetParams, sending_receiving)

			if (console_data != '')

				promise = promise
					.then(() => {
						wait(15 * getTIME_UNIT(), network)
					})
					.then(() => {

						flying.push(nodeFromAnimation)
						nodeFromAnimation.removeAttribute("animation__grow")
						nodeFromAnimation.setAttribute('animation__grow', { property: 'scale', from: { x: 0.006 / packetParams.elementsScale, y: 0.006 / packetParams.elementsScale, z: 0.006 / packetParams.elementsScale }, to: { x: 0.06 / packetParams.elementsScale, y: 0.06 / packetParams.elementsScale, z: 0.06 / packetParams.elementsScale }, dur: (20 * getTIME_UNIT()).toString(), easing: 'linear', pauseEvents: 'animation-pause', resumeEvents: 'animation-resume', 'enabled': false, startEvents: 'grow' })
						nodeFromAnimation.setAttribute('animation__grow', { 'enabled': true })
						return anime(nodeFromAnimation, 'grow')
					})
					.then(() => {
						if (node["consoleText_new"]) {
							nodeFromAnimation.removeChild(node["consoleText_new"])
						}
						return wait(getTIME_UNIT(), network)
					})
					.then(() => {
						if (node["consoleText"]) {
							nodeFromAnimation.removeChild(node["consoleText"])
						}
						return wait(getTIME_UNIT() / 3, network)
					})
					.then(() => {
						showConsole("consoleText", node.console_log, "105.19 220.81 -30.52", "white")
						return wait(15 * getTIME_UNIT(), network)
					})
					.then(() => {
						let new_console_log = this.console(nodeName, packetParams, sending_receiving)

						showConsole("consoleText_new", new_console_log, "105.19 100.81 -30.52", "yellow")

						node.console_log += new_console_log
						return wait(15 * getTIME_UNIT(), network)
					})
					.then(() => {
						nodeFromAnimation.removeAttribute('animation__ungrow')
						nodeFromAnimation.setAttribute('animation__ungrow', { property: 'scale', from: { x: 0.06 / packetParams.elementsScale, y: 0.06 / packetParams.elementsScale, z: 0.06 / packetParams.elementsScale }, to: { x: 0.006 / packetParams.elementsScale, y: 0.006 / packetParams.elementsScale, z: 0.006 / packetParams.elementsScale }, dur: (20 * getTIME_UNIT()).toString(), easing: 'linear', pauseEvents: 'animation-pause', resumeEvents: 'animation-resume', 'enabled': false, startEvents: 'ungrow' })
						nodeFromAnimation.setAttribute('animation__ungrow', { 'enabled': true })
						return anime(nodeFromAnimation, 'ungrow')
					})
		}

		return promise
	},

	pumpHandler(p, sphere, nodeAnimationTo) {
		if (p.data.e2ePumps == 0) return

		p.data.xPosition = p.data.toXPosition
		p.data.zPosition = p.data.toZPosition

		let coords = pointInSegment(
			{ "x": p.data.xPosition, "y": p.data.yPosition, "z": p.data.zPosition },
			{ "x": p.data.origToXPosition, "y": p.data.yPosition, "z": p.data.origToZPosition },
			1 / p.data.e2ePumps
		)

		p.data.toXPosition = coords["x"]
		p.data.toZPosition = coords["z"]


		p.el.setAttribute('animation__link', {
			property: 'position',
			to: { "x": p.data.toXPosition, "y": p.data.toYPosition, "z": p.data.toZPosition },
			dur: 20 * getTIME_UNIT(), // p.data.linkDuration,
			easing: 'linear', //'easeInOutCubic',
			startEvents: "link",
			pauseEvents: 'animation-pause',
			resumeEvents: 'animation-resume',
			enabled: 'false' // if not false, when resumed it starts. A bug.
		});

		var promise = Promise.resolve()
		promise = promise
			.then(() => p.el.setAttribute("animation__link", { enabled: 'true' }))
			.then(() => anime(p.el, 'link'))
			.then(() => sphere.setAttribute('visible', true))

		p.data.e2ePumps -= 1

		if (p.data.e2ePumps == 0) {
			eventBus.unSubscribe(p.getKey())

			let animator = AnimatorFactory.createAnimator(p, p.data.to)
			promise = promise
				.then(() => animator.animatePacketArrives(nodeAnimationTo))
		}
	},


	init: function () {
		var packet = this.el
		let packetParams = this.data


		// Should be called once, note once for each packet 
		// Must move it somewhere else
		var htmltemplates = document.getElementById("htmltemplates");
		var newSectionTemplate = document.createElement("section");
		newSectionTemplate.style = "display: inline-block; background: #EEEEEE; color: purple; border-radius: 1em; padding: 0em; margin:0;"
		newSectionTemplate.id = packetParams.id + '-template'
		htmltemplates.appendChild(newSectionTemplate);


		if (packetParams.e2ePumps > 0) {
			// save destination coordinates and set new ones for the first pump
			let coords = pointInSegment(
				{ "x": packetParams.xPosition, "y": packetParams.yPosition, "z": packetParams.zPosition },
				{ "x": packetParams.toXPosition, "y": packetParams.toYPosition, "z": packetParams.toZPosition },
				1 / packetParams.e2ePumps
			)

			packetParams.origToXPosition = packetParams.toXPosition
			packetParams.origToZPosition = packetParams.toZPosition

			packetParams.toXPosition = coords["x"]
			packetParams.toZPosition = coords["z"]

		}
	}
});