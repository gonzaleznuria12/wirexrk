import jseEval from 'https://cdn.jsdelivr.net/npm/jse-eval@1.5.2/+esm'
import {
    pointInSegment, setDnsCacheTable, setSwitchTable, setRoutingTable, setARPCacheInfoText,
    formatARPCache, formatSwitchTable, TT, formatRoutingTable, isEndToEndVIEW,
    formatDnsCacheTable
} from "./utils.js";
import { updateSwitchTables } from './l2.js';
import { updateDnsCacheTable } from './dns.js';
import { TICK, DURATION_LINK } from "./index.js";
import Switches from "./switches.js"
import AnimatorFactory from "./packet_animators.js"

AFRAME.registerComponent('network', {

    schema: {
        height: { type: 'number' },
        position: { type: 'vec3' },
        machineNames: { type: 'string' },
        connectionscolor: { type: 'string', default: 'red' },
        elementsScale: { type: 'number', default: 1 },
        SHIFT_Y: { type: 'number', default: 2 },
        layer_suffix: { type: 'string', default: '_' },
        depends_on: { type: 'string', default: '' },
        viewsMenuFile: { type: 'string' },
        scale: { default: '' }
    },

    getViewsMenuFile() {
        return this.data.viewsMenuFile
    },

    do_animate: function (event) {
        var network = event.target.components["network"]
        var active_network = event.detail.network

        // events sent by a network that depends on us are not processed by us
        if (active_network != network && network.data.depends_on == "") return


        if (network.get_latest_startTime() >= event.detail.startTime) {
            return
        }

        network.set_latest_startTime(event.detail.startTime)

        var finalPackets = network.getFinalPackets()
        var flying = network.getFlying()
        var links = network.getConnectionsLinks()
        var nodeList = network.getNodeList()

        let packets_ready = false

        let deleteARPCache = function (packet_index) {
            // To be called in the sender of an ARP request
            let packet = finalPackets[packet_index]
            let eth_dst = packet.eth["eth.dst"]
            let eth_src = packet.eth["eth.src"]

            if (packet["arp"]
                && packet["arp"]["arp.opcode"] == "1") // ARP request
            {
                var connectionLink = links.find(o => o.hwaddr.includes(eth_src))
                var node = nodeList.find(o => o.nodeName === connectionLink.nodeName)
                var i = connectionLink.hwaddr.findIndex(o => o == eth_src)
                var ipaddr = connectionLink.ipaddr[i]
                if (node.ARPCache && node.ARPCache[ipaddr])
                    delete node.ARPCache[ipaddr]
            }
        }

        var next_packet = network.getNextPacket()

        updateSwitchTables(network)
        updateDnsCacheTable(network)


        while (next_packet < finalPackets.length && !packets_ready) {
            if (network.data.depends_on != "") {

                var othernet = document.querySelector('#' + network.data.depends_on)
                var otherNextPacket = othernet.components["network"].getNextPacket()
                var otherCurrentTime = othernet.components["network"].getCurrentTime()
                var otherFinalPackets = othernet.components["network"].getFinalPackets()

                if (network.getCurrentTime() <= otherFinalPackets[otherNextPacket].startTime) {
                    network.setCurrentTime(network.getCurrentTime() + TT)
                }
                else {
                    return
                }
            }
            else {
                network.setCurrentTime(network.getCurrentTime() + TT)

                if (network.rewindTargetTime !== undefined &&
                    network.getCurrentTime() >= network.rewindTargetTime) {
                    network.rewindTargetTime = undefined
                    let cb = network.onRewindReached
                    network.onRewindReached = undefined
                    if (cb) cb()
                }

                if (network.fastForwardTargetTime !== undefined &&
                    network.getCurrentTime() >= network.fastForwardTargetTime) {
                    network.fastForwardTargetTime = undefined
                    let cb = network.onFastForwardReached
                    network.onFastForwardReached = undefined
                    if (cb) cb()
                }
            }


            while (next_packet < finalPackets.length && finalPackets[next_packet].startTime <= network.getCurrentTime()) {

                // delete from the sender of the ARP request the
                // requested IP
                deleteARPCache(next_packet)

                var next_ip_position = finalPackets[next_packet].next_ip_position

                if (next_ip_position) {
                    // This is an ARP request, so we must first show
                    // the IP datagram that caused it

                    // delete from the sender of the ARP request the
                    // requested IP
                    deleteARPCache(next_packet)

                    let nextIPPacket = finalPackets[next_ip_position].newPacket.components.packet

                    finalPackets[next_ip_position].createdAnimation = true
                    nextIPPacket.createAnimation(network)

                    nextIPPacket.createdAnimation = true

                    let promise = Promise.resolve()
                    let animator = AnimatorFactory.createAnimator(nextIPPacket, nextIPPacket.data.from)
                    promise = animator.animatePark()

                    flying.push(finalPackets[next_ip_position].newPacket)
                    network.setFlying(flying)


                    promise = promise
                        .then(() => {

                            let newPacket = finalPackets[next_packet].newPacket.components.packet
                            finalPackets[next_packet].createdAnimation = true
                            newPacket.createAnimation(network)


                            let animator = AnimatorFactory.createAnimator(newPacket, newPacket.data.from)
                            promise = animator.animateMove()


                            flying.push(finalPackets[next_packet].newPacket)
                            network.setFlying(flying)

                            next_packet += 1
                            network.setNextPacket(next_packet)
                            packets_ready = true

                        })
                    return promise
                }
                else {
                    let newPacket = finalPackets[next_packet].newPacket.components.packet
                    if (!finalPackets[next_packet].createdAnimation) {
                        // Normal packet, first we must create its a-frame
                        finalPackets[next_packet].createdAnimation = true

                        newPacket.createAnimation(network)

                        let animator = AnimatorFactory.createAnimator(newPacket, newPacket.data.from)
                        animator.animateMove()

                    }
                    else {

                        // This is an IP datagram that was created
                        // when the Request ARP appeared in the
                        // capture, so only animate it, don't create
                        // it
                        let animator = AnimatorFactory.createAnimator(newPacket, newPacket.data.from)
                        animator.animateUnPark()
                    }
                    flying.push(finalPackets[next_packet].newPacket)
                    network.setFlying(flying)

                    next_packet += 1
                    network.setNextPacket(next_packet)

                    packets_ready = true

                }
            }
        }
    },

    getCurrentTime: function () {
        return this.CURRENT_TIME
    },
    setCurrentTime: function (currentTime) {
        this.CURRENT_TIME = currentTime
    },
    getStartTime: function (theirIPHeader, theirEthHeader, theirSrcIface, theirDstIface) {
        let ourIndex = this.finalPackets.findIndex((p) =>
            JSON.stringify(p.ip) + JSON.stringify(p.eth) + p.srcIface.node.substring(0, p.srcIface.node.length - 2) + p.dstIface.node.substring(0, p.dstIface.node.length - 2) ===
            JSON.stringify(theirIPHeader) + JSON.stringify(theirEthHeader) + theirSrcIface.node.substring(0, theirSrcIface.node.length - 2) + theirDstIface.node.substring(0, theirDstIface.node.length - 2)
        )
        return this.finalPackets[ourIndex].startTime
    },
    getTimesIP: function (theirIPHeader) {
        let ourIndex = this.finalPackets.findIndex((p) => JSON.stringify(p.ip) === JSON.stringify(theirIPHeader))
        return this.finalPackets[ourIndex].startTime
    },
    get_latest_startTime() {
        return this.latest_startTime
    },
    set_latest_startTime(latest_startTime) {
        this.latest_startTime = latest_startTime
    },
    getView() {
        return this.VIEW
    },
    getNodeFilter() {

        return this.nodeFilter
    },
    getE2ePacketFilter() {
        return this.e2ePacketFilter
    },
    setView(newView) {
        return this.VIEW = newView
    },
    setNodeFilter(nodeFilter) {
        if (!nodeFilter) this.nodeFilter = "true"
        else this.nodeFilter = nodeFilter
    },
    setE2ePacketFilter(e2ePacketFilter) {
        if (!e2ePacketFilter) this.e2ePacketFilter = "false"
        else this.e2ePacketFilter = e2ePacketFilter
    },
    setPacketFilter(packetFilter) {
        if (!packetFilter) this.packetFilter = "true"
        else this.packetFilter = packetFilter
    },
    getPacketFilter() {
        return this.packetFilter
    },
    setAnimationState(animationState) {
        this.animationState = animationState
    },
    getAnimationState() {
        return this.animationState
    },
    setRewindTarget(targetTime, callback) {
        this.rewindTargetTime = targetTime
        this.onRewindReached = callback
    },
    setFastForwardTarget(targetTime, callback) {
        this.fastForwardTargetTime = targetTime
        this.onFastForwardReached = callback
    },
    setNextPacket(next_packet) {
        this.next_packet = next_packet
    },
    getNextPacket() {
        return this.next_packet
    },
    getConnectionsLinks() {
        return this.links
    },
    getNodeList() {
        return this.nodeList
    },
    getFinalPackets() {
        return this.finalPackets
    },
    setFlying(flying) {
        this.flying = flying
    },
    getFlying() {
        return this.flying
    },

    async loadFilters() {
        // load filters
        this.viewsMenuElements = []
        var viewsMenuFile = this.getViewsMenuFile()

        var response = await this.loadFile(viewsMenuFile, 'text')
        this.VIEWS_MENU = JSON.parse(response);

        var network = this
        var parent = this.el

        this.VIEWS = ["APPLICATION", "APPLICATION+TRANSPORT", "APPLICATION+TRANSPORT+NETWORK", "ALL"]
        this.viewsMenuElements = []
        var that = this

        // view config could have been setted through the settings panel in controller.
        // If not, initialize it
        if (network.getView() == "") {
            // configures view with the latest option in VIEWS_MENU
            that.setView(that.VIEWS_MENU[that.VIEWS_MENU.length - 1].view)

            that.setNodeFilter(that.VIEWS_MENU[that.VIEWS_MENU.length - 1].nodeFilter)
            that.setE2ePacketFilter(that.VIEWS_MENU[that.VIEWS_MENU.length - 1].e2ePacketFilter)
            that.setPacketFilter(that.VIEWS_MENU[that.VIEWS_MENU.length - 1].packetFilter)
        }
    },

    async loadTopology(machineNamesFile) {
        // Request and process machineNames.json
        // Associate a name to each machine
        var requestMachineNames = new XMLHttpRequest();
        requestMachineNames.open('GET', machineNamesFile);
        requestMachineNames.responseType = 'text';
        requestMachineNames.send();

        return new Promise((resolve) => {
            requestMachineNames.onload = function () {
                let response = requestMachineNames.response;
                let responseParse = JSON.parse(response);
                resolve(responseParse)
            }
        })
    },

    loadFile: function (url, type) {
        return new Promise((resolve, reject) => {
            var request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = type;

            request.onload = () => {
                if (request.status >= 200 && request.status < 300) {
                    resolve(request.response);
                } else {
                    reject(new Error(`Failed to load ${url}: ${request.statusText}`));
                }
            };

            request.onerror = () => {
                reject(new Error(`Network error while loading ${url}`));
            };

            request.send();
        });
    },

    createNode(nodeJSON) {
        // In end-to-end views draw only hosts (pcs and dns servers)

        var newNode = {
            coordX: nodeJSON.coords.x,
            coordY: nodeJSON.coords.y,
            coordZ: nodeJSON.coords.z,
            nodeName: nodeJSON.id + this.data.layer_suffix,
            type: nodeJSON.type,
            hwaddr: [],
            ipaddr: [],
            mask: [],
            iface: [],
            routing_table: [],
            routingTableText: "",
            cache_table: [],
            switch_table: [],
            switchTableText: "",

            text: "",
            node_a_entity: ""
        }

        const filter = jseEval.compile(this.getNodeFilter());
        if (!filter(newNode)) {
            return null
        }


        newNode.coordX += this.data.position["x"]
        newNode.coordY += this.data.position["y"]
        newNode.coordZ += this.data.position["z"]


        if (newNode.type != "hub") {
            let switch_table = [];
            if (newNode.type != 'hub') {
                let i = 1;
                for (const [iface, data] of Object.entries(nodeJSON.interfaces).sort()) {
                    newNode.hwaddr.push(data.hwaddr)
                    newNode.ipaddr.push(data.ipaddr)
                    newNode.mask.push(data.mask)
                    newNode.iface.push(iface)

                    switch_table.push([i, data.hwaddr, "yes", "0.0s"])
                    i += 1;
                }
            }
            if (newNode.type == 'switch') {
                newNode.switch_table = switch_table
            }
            newNode.routing_table = nodeJSON.routing_table

        }





        return newNode
    },

    displayNode(newNode) {
        let scene = this.el.sceneEl
        let elementsScale = this.data.elementsScale
        let nodeList = this.nodeList

        let newNodeElement = document.createElement('a-entity');
        newNode.node_a_entity = newNodeElement

        newNodeElement.setAttribute('class', 'clickable')

        if (newNode.type == 'host') {
            newNodeElement.setAttribute('gltf-model', '#computer');
            newNodeElement.setAttribute('position', { x: (newNode.coordX / 15) / elementsScale, y: (newNode.coordY / 15) / elementsScale, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 0.006 / elementsScale, y: 0.006 / elementsScale, z: 0.006 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');

        } else if (newNode.type == 'docker') {
            newNodeElement.setAttribute('gltf-model', '#docker');
            newNodeElement.setAttribute('position', { x: (newNode.coordX / 15) / elementsScale, y: (newNode.coordY / 15) / elementsScale - 1, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 0.8 / elementsScale, y: 0.8 / elementsScale, z: 0.8 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');

        } else if (newNode.type == 'hub') {
            newNodeElement.setAttribute('gltf-model', '#hub');
            newNodeElement.setAttribute('position', { x: (((newNode.coordX / 15)) / elementsScale) - 3, y: ((newNode.coordY / 15) / elementsScale) + 0.5, z: ((newNode.coordZ / 15) / elementsScale) + 1.5 });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1 / elementsScale, y: 1 / elementsScale, z: 1 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');

        } else if (newNode.type == 'router') {
            newNodeElement.setAttribute('gltf-model', '#router');
            newNodeElement.setAttribute('position', { x: ((newNode.coordX / 15)) / elementsScale - 1, y: (newNode.coordY / 15) / elementsScale - 0.25, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1 / elementsScale, y: 1 / elementsScale, z: 1 / elementsScale });

        } else if (newNode.type == 'switch') {
            newNodeElement.setAttribute('gltf-model', '#switch');
            newNodeElement.setAttribute('position', { x: ((newNode.coordX / 15)) / elementsScale, y: (newNode.coordY / 15) / elementsScale - 0.25, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1 / elementsScale, y: 1 / elementsScale, z: 1 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');

        } else if (newNode.type == 'switch-vlan') {
            newNodeElement.setAttribute('gltf-model', '#switch-vlan');
            newNodeElement.setAttribute('position', { x: ((newNode.coordX / 15)) / elementsScale, y: (newNode.coordY / 15) / elementsScale, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1.1 / elementsScale, y: 1.1 / elementsScale, z: 1.1 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');
        } else if (newNode.type == 'server') {
            newNodeElement.setAttribute('gltf-model', '#switch-vlan');
            newNodeElement.setAttribute('position', { x: ((newNode.coordX / 15)) / elementsScale, y: (newNode.coordY / 15) / elementsScale, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1.1 / elementsScale, y: 1.1 / elementsScale, z: 1.1 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');
        } else if (newNode.type == 'dnsServer') {
            newNodeElement.setAttribute('gltf-model', '#switch-vlan');
            newNodeElement.setAttribute('position', { x: ((newNode.coordX / 15)) / elementsScale, y: (newNode.coordY / 15) / elementsScale, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1.1 / elementsScale, y: 1.1 / elementsScale, z: 1.1 / elementsScale });
            newNodeElement.setAttribute('rotation', '0 -90 0');


        } else if (newNode.type == 'router-vxlan') {
            newNodeElement.setAttribute('gltf-model', '#router-vxlan');
            newNodeElement.setAttribute('position', { x: ((newNode.coordX / 15)) / elementsScale, y: (newNode.coordY / 15) / elementsScale - 0.25, z: (newNode.coordZ / 15) / elementsScale });
            newNodeElement.setAttribute('id', newNode.nodeName);
            newNodeElement.setAttribute('scale', { x: 1 / elementsScale, y: 1 / elementsScale, z: 1 / elementsScale });
        }

        // Add routing table info
        var isClosedRoutingTableInfo = true;
        let network = this;

        newNodeElement.addEventListener('click', function (event) {
            event.stopPropagation();

            // Check if this click was triggered by fuse timeout
            if (event.detail && event.detail.cursorEl && event.detail.cursorEl.hasAttribute('fuse')) {
                // This appears to be a fuse-triggered click - check if it came from the actual fuse timeout
                if (event.detail.intersection && !event.isTrusted) {
                    console.log('Ignoring fuse-triggered click on', newNodeElement.id);
                    return; // Skip processing for fuse clicks
                }
            }

            let node = nodeList.find(o => o.nodeName === newNodeElement.id)

            if (!isClosedRoutingTableInfo) {
                isClosedRoutingTableInfo = true



                if (node.type == "switch") {
                    node.switchTableText.removeAttribute('html');
                    node.switchTableText.setAttribute('visible', false);
                }
                else if (newNode.type == "dnsServer") {
                    node.dnsCacheTableText.removeAttribute('html');
                    node.dnsCacheTableText.setAttribute('visible', false);
                    node.routingTableText.removeAttribute('html');
                    node.routingTableText.setAttribute('visible', false);

                }
                else {
                    node.routingTableText.removeAttribute('html');
                    node.routingTableText.setAttribute('visible', false);

                    node.ARPCacheInfoText.removeAttribute('html')
                    node.ARPCacheInfoText.setAttribute('visible', false);
                }

                newNodeElement.removeAttribute('sound');

                newNodeElement.setAttribute('sound', { src: '#showLevels', volume: 5, autoplay: "true" });

            } else {
                isClosedRoutingTableInfo = false

                if (newNode.type == "switch") {
                    setSwitchTable(node.nodeName, node.switchTableText, node.switch_table)
                }
                else if (newNode.type == "dnsServer") {
                    setDnsCacheTable(node.nodeName, node.dnsCacheTableText, node.dns_cache_table)
                    setRoutingTable(node.routingTableText, newNodeElement);
                    setARPCacheInfoText(node.nodeName, network, node.ARPCacheInfoText, node.ARPCache)
                }
                else {
                    console.log('Click detected on', newNodeElement.id);
                    console.log('Event source:', event.srcElement);
                    console.log('Event type:', event.type);
                    console.log('Event detail:', event.detail);
                    setRoutingTable(node.routingTableText, newNodeElement);
                    setARPCacheInfoText(node.nodeName, network, node.ARPCacheInfoText, node.ARPCache)
                }
            }
        });

        scene.appendChild(newNodeElement);

        // Machine names
        let nodeName = newNode.nodeName.substring(0, newNode.nodeName.lastIndexOf("_"));


        var htmltemplates = document.getElementById("htmltemplates");
        var newSectionTemplate = document.createElement("section");
        let templateText = '<h1 style="padding: 0rem 1rem; margin:0; font-size: 2rem; font-weight: 700; font-family: monospace">' + nodeName + '</h1>'
        newSectionTemplate.innerHTML = templateText;
        newSectionTemplate.style = "display: inline-block; background: #2471a3; color: white; border-radius: 1em; padding: 0.5em; margin:0;"
        newSectionTemplate.id = newNode.nodeName + '-template'
        htmltemplates.appendChild(newSectionTemplate);

        let newText = document.createElement('a-entity');

        var height
        if (newNode.type == 'host' || newNode.type == 'server' || newNode.type == 'dnsServer' || newNode.type == 'switch-vlan')
            height = 3.0
        else if (newNode.type == 'docker')
            height = 3.5
        else height = 1.5

        newText.setAttribute('position', { x: ((newNode.coordX / 15) - 0.5) / elementsScale, y: height + ((newNode.coordY / 15) - 0.5) / elementsScale, z: (newNode.coordZ / 15) / elementsScale });
        newText.setAttribute('html', 'cursor:#cursor;html:' + '#' + newNode.nodeName + '-template');
        newText.setAttribute('scale', { x: 10 / elementsScale, y: 10 / elementsScale, z: 10 / elementsScale });
        newText.setAttribute('look-at', "[camera]");

        newNode.text = newText

        scene.appendChild(newText);

    },

    createNodes(nodesJSON) {
        nodesJSON.forEach(nodeJSON => {
            let node = this.createNode(nodeJSON)
            if (node != null) {
                this.nodeList.push(node)
            }
        })
    },

    displayNodes() {
        this.nodeList.forEach(node => {
            this.displayNode(node)
        })
    },

    readEdges(linksJSON) {
        let layer_suffix = this.data.layer_suffix

        let connectionsLinks = []
        linksJSON.forEach(linkJSON => {
            let connectionLink = {
                from: linkJSON.source + layer_suffix,
                fromIface: linkJSON.src_iface,
                to: linkJSON.target + layer_suffix,
                toIface: linkJSON.dst_iface
            }
            connectionsLinks.push(connectionLink)
        })
        return connectionsLinks
    },

    createLinks(edges) {
        let links = this.links
        let nodeList = this.nodeList
        let data = this.data
        let scene = this.el.sceneEl

        for (var k = 0; k < nodeList.length; k++) {
            var to = []
            for (var j = 0; j < edges.length; j++) {
                if (nodeList[k].nodeName == edges[j].from)
                    to.push(edges[j].to)

                if (nodeList[k].nodeName == edges[j].to)
                    to.push(edges[j].from)
            }

            let connectionLink = {
                nodeName: nodeList[k].nodeName,
                to: to,
                coordX: nodeList[k].coordX,
                coordY: nodeList[k].coordY,
                coordZ: nodeList[k].coordZ,
                type: nodeList[k].type,
                hwaddr: nodeList[k].hwaddr,
                ipaddr: nodeList[k].ipaddr,
                mask: nodeList[k].mask,
                iface: nodeList[k].iface,
                lines: [],
                ipaddrs: []
            }
            links.push(connectionLink)
        }
    },

    displayLinks() {
        let network = this
        let links = this.links
        let nodeList = this.nodeList
        let data = this.data
        let scene = this.el.sceneEl

        for (var k = 0; k < links.length; k++) {
            var nodeFrom = links[k]


            const filter = jseEval.compile(network.getNodeFilter());
            if (!filter(nodeFrom)) {
                continue;
            }

            for (var j = 0; j < links[k].to.length; j++) {
                var nodeTo = links.find(o => o.nodeName === links[k].to[j])


                const filter = jseEval.compile(network.getNodeFilter());
                if (!nodeTo || !filter(nodeTo)) {
                    continue;
                }



                let newLine = document.createElement('a-tube');

                const points = [
                    { x: (nodeFrom.coordX / 15) / data.elementsScale, y: (nodeFrom.coordY / 15) / data.elementsScale, z: (nodeFrom.coordZ / 15) / data.elementsScale },
                    { x: (nodeTo.coordX / 15) / data.elementsScale, y: (nodeTo.coordY / 15) / data.elementsScale, z: (nodeTo.coordZ / 15) / data.elementsScale },
                ];
                const path = points.map(point => `${point.x} ${point.y} ${point.z}`).join(', ');
                newLine.setAttribute('path', path)

                newLine.setAttribute('radius', 0.2)
                newLine.setAttribute('material', "color: green; side: double;")

                scene.appendChild(newLine);

                links[k].lines.push(newLine)


                // Labels for IP addresses on the link
                nodeFrom = links.find(o => o.nodeName === links[k].nodeName)
                var nFrom = nodeList.find(o => o.nodeName === nodeFrom.nodeName)

                if (nFrom.type == "hub")
                    continue;

                var label_id = links[k].iface[j] + ": "
                if (links[k].ipaddr[j] != "") {
                    label_id += links[k].ipaddr[j] + "/" + links[k].mask[j] + "<br>";
                    label_id += "      " + links[k].hwaddr[j]
                } else
                    label_id += links[k].hwaddr[j]


                var id_text = ""
                // get an id_text from hwaddr id
                if (links[k].hwaddr.length > j)
                    id_text = links[k].hwaddr[j].replace(/\:/g, "_");


                var htmltemplates = document.getElementById("htmltemplates");
                var newSectionTemplate = document.createElement("section");
                var templateText = '<h1 style="padding: 0rem 0rem 0rem 0rem; margin: 0; font-size: 2rem; font-family: monospace; font-weight: 400;">' + label_id + '</h1>'
                newSectionTemplate.innerHTML = templateText;
                newSectionTemplate.style = "display: inline-block; background: #d4e6f1; color: #424949; border-radius: 1em; padding: 1em; margin:0;"

                newSectionTemplate.id = id_text + "-template";
                htmltemplates.appendChild(newSectionTemplate);


                var coords = pointInSegment(
                    { "x": (nodeFrom.coordX / 15) / data.elementsScale, "y": (nodeFrom.coordY / 15) + 0.5 / data.elementsScale, "z": (nodeFrom.coordZ / 15) / data.elementsScale },
                    { "x": (nodeTo.coordX / 15) / data.elementsScale, "y": (nodeTo.coordY / 15) / data.elementsScale, "z": (nodeTo.coordZ / 15) / data.elementsScale }
                )

                let newText = document.createElement('a-entity');

                newText.setAttribute('position', coords)
                newText.setAttribute('html', 'cursor:#cursor;' + 'html:#' + id_text + "-template");
                newText.setAttribute('scale', { x: 10 / data.elementsScale, y: 10 / data.elementsScale, z: 10 / data.elementsScale });
                newText.setAttribute('look-at', "[camera]");

                scene.appendChild(newText);
                links[k].ipaddrs.push(newText)
            }
        }
    },

    async createNodesAndLinks(topology) {
        // create and display nodes
        const nodesJSON = topology.nodes
        this.createNodes(nodesJSON)
        this.displayNodes()


        // create and display links
        var edgesJSON = topology.links
        let edges = this.readEdges(edgesJSON)
        this.createLinks(edges)
        this.displayLinks()
    },

    async loadConsoles(elementsScale) {
        //
        // Request and process consoles.json
        var scene = this.el.sceneEl

        var requestConsoles = new XMLHttpRequest();
        requestConsoles.open('GET', 'consoles.json');
        requestConsoles.responseType = 'text';
        requestConsoles.send();
        var consoles



        return new Promise((resolve) =>
            requestConsoles.onload = function () {
                var response = requestConsoles.response;
                consoles = JSON.parse(response);
                resolve(consoles)
            })
    },

    createARPCacheInfoText(id_text, coords, elementsScale, info, scene) {
        var htmltemplates = document.getElementById("htmltemplates");
        var newSectionTemplate = document.createElement("section");

        var templateText = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; font-family: monospace">' + info + '</h1>'
        newSectionTemplate.innerHTML = templateText;


        newSectionTemplate.style = "display: inline-block; background: black; color: orange; border-radius: 1em; padding: 1em; margin:0;"
        newSectionTemplate.id = id_text + "-template";

        htmltemplates.appendChild(newSectionTemplate);


        let newText = document.createElement('a-entity');

        let c = Object.assign({}, coords)
        newText.setAttribute('position', c)


        newText.setAttribute('scale', { x: 25, y: 25, z: 25 });

        newText.setAttribute('html', '#' + id_text + "-template");
        newText.setAttribute('look-at', "[camera]");
        newText.setAttribute('visible', false);

        newText.setAttribute('id', id_text);


        scene.appendChild(newText);

        return newText;
    },

    createRoutingTableInfo(id_text, coords, elementsScale, info, scene) {
        var htmltemplates = document.getElementById("htmltemplates");
        var newSectionTemplate = document.createElement("section");


        var templateText = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; font-family: monospace">' + info + '</h1>'
        newSectionTemplate.innerHTML = templateText;
        newSectionTemplate.style = "display: inline-block; background: black; color: orange; border-radius: 1em; padding: 1em; margin:0;"
        newSectionTemplate.id = id_text + "-template";
        htmltemplates.appendChild(newSectionTemplate);
        
        let newText = document.createElement('a-entity');

        coords.y += 5

        newText.setAttribute('position', coords);
        newText.setAttribute('scale', { x: 20, y: 20, z: 20 });
        newText.setAttribute('html', 'cursor:#cursor;html:' + '#' + id_text + "-template");
        newText.setAttribute('look-at', "[camera]");
        newText.setAttribute('visible', false);

        scene.appendChild(newText);

        return newText;
    },

    createSwitchTableInfo(id_text, coords, elementsScale, info, scene) {
        var htmltemplates = document.getElementById("htmltemplates");
        var newSectionTemplate = document.createElement("section");

        var templateText = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; font-family: monospace">' + info + '</h1>'
        newSectionTemplate.innerHTML = templateText;

        newSectionTemplate.style = "display: inline-block; background: black; color: orange; border-radius: 1em; padding: 1em; margin:0;"
        newSectionTemplate.id = id_text + "-template";
        htmltemplates.appendChild(newSectionTemplate);


        let newText = document.createElement('a-entity');

        coords.y += 5
        newText.setAttribute('position', coords);
        newText.setAttribute('scale', { x: 20, y: 20, z: 20 });
        newText.setAttribute('html', 'cursor:#cursor;html:' + '#' + id_text + "-template");
        newText.setAttribute('look-at', "[camera]");
        newText.setAttribute('visible', false);
        newText.setAttribute('id', id_text);

        scene.appendChild(newText);

        return newText;
    },

    createDnsCacheTableInfo(id_text, coords, elementsScale, info, scene) {
        var htmltemplates = document.getElementById("htmltemplates");
        var newSectionTemplate = document.createElement("section");
        var templateText = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; font-family: monospace">' + info + '</h1>'
        newSectionTemplate.innerHTML = templateText;

        newSectionTemplate.style = "display: inline-block; background: black; color: orange; border-radius: 1em; padding: 1em; margin:0;"
        newSectionTemplate.id = id_text + "-template";
        htmltemplates.appendChild(newSectionTemplate);

        let newText = document.createElement('a-entity');

        coords.y += 5
        newText.setAttribute('position', coords);

        newText.setAttribute('scale', { x: 20, y: 20, z: 20 });
        newText.setAttribute('html', 'cursor:#cursor;html:' + '#' + id_text + "-template");
        newText.setAttribute('look-at', "[camera]");
        newText.setAttribute('visible', false);
        newText.setAttribute('id', id_text);

        scene.appendChild(newText);

        return newText;
    },

    async createNodePanelsAndConsoles(elementsScale, scene, consoles) {
        // create panels for routing tables + ARPCaches + console
        for (var k = 0; k < this.nodeList.length; k++) {

            var node = this.nodeList[k];

            if (node.type != 'hub') {
                var coords = { x: (node.coordX / 15) / elementsScale, y: (node.coordY / 15) / elementsScale, z: (node.coordZ / 15) / elementsScale };
                coords["y"] += 5
                coords["z"] += 2

                if (node.type == "dnsServer")
                    node.dnsCacheTableText =
                        this.createDnsCacheTableInfo(node.nodeName + "dns_cache_table", coords, this.elementsScale, formatDnsCacheTable(node.nodeName, node.dns_cache_table), scene)

                if (node.type == "switch")
                    node.switchTableText =
                        this.createSwitchTableInfo(node.nodeName + "switch_table", coords, this.elementsScale, formatSwitchTable(node.nodeName, node.switch_table), scene)

                if (node.type != "switch")
                    node.routingTableText =
                        this.createRoutingTableInfo(node.nodeName + "routing_table", coords, this.elementsScale, formatRoutingTable(node.nodeName, node.routing_table), scene)

                // ARPCache contents
                node.ARPCache = {}
                // ARPCache panel
                coords["y"] -= 5

                node.ARPCacheInfoText =
                    this.createARPCacheInfoText("ARPCacheInfoText" + node.nodeName, coords, this.elementsScale, formatARPCache(node.nodeName, node.ARPCache), scene)

                // console
                var nodeName = node.nodeName.substring(0, node.nodeName.search("_"))
                if (consoles[nodeName]) {
                    node.console = consoles[nodeName]
                    node.console_log = " "
                }
            }
        }
    },

    async setTypeOfNodes() {
        // changes type of node to "dnsServer" if it sends a DNS reply message
        this.nodeList.forEach(node => {
            const isDnsServer = this.finalPackets.some(
                packet => packet.dns
                    && (packet["dns"]["dns.count.answers"] != "0" || packet["dns"]["dns.count.auth_rr"] != "0")
                    && node.ipaddr.includes(packet.ip["ip.src"])
            )
            if (isDnsServer) {
                node.type = "dnsServer"
                node.dns_cache_table = []
            }
        })
    },

    async createNetwork(machineNamesFile, elementsScale) {
        try {
            await this.loadFilters()

            let topology = await this.loadTopology(machineNamesFile)


            await this.createNodesAndLinks(topology)

            await this.createPackets();

            await this.setTypeOfNodes();

            const consoles = await this.loadConsoles(elementsScale);
            await this.createNodePanelsAndConsoles(elementsScale, this.el.sceneEl, consoles);
        } catch (error) {
            console.error("Error while creating network: ", error);
        }
    },

    deleteLinks() {
        let links = this.links
        let scene = this.el.sceneEl

        for (var i = 0; i < links.length; i++) {
            for (var j = 0; j < links[i].lines.length; j++)
                scene.removeChild(links[i].lines[j])

            for (var j = 0; j < links[i].ipaddrs.length; j++)
                scene.removeChild(links[i].ipaddrs[j])

        }

        links.length = 0

    },

    deleteNodes() {
        let nodeList = this.nodeList
        let scene = this.el.sceneEl

        for (var i = 0; i < nodeList.length; i++) {
            var nodeFromAnimation = document.getElementById(nodeList[i].nodeName);

            if (!scene.contains(nodeList[i].node_a_entity))
                // Not all nodes are in the scene
                continue

            // Destroy node's text
            if (nodeList[i].text)
                scene.removeChild(nodeList[i].text)

            // Destroy node's routingTableText,  ARPCache and consoleText
            if (nodeList[i].type != 'hub') {
                if (nodeList[i].routingTableText)
                    scene.removeChild(nodeList[i].routingTableText)
                if (nodeList[i].ARPCacheInfoText)
                    scene.removeChild(nodeList[i].ARPCacheInfoText)
                if (nodeList[i].switchTableText)
                    scene.removeChild(nodeList[i].switchTableText)
                if (nodeList[i].dnsCacheTableText)
                    scene.removeChild(nodeList[i].dnsCacheTableText)

                // This works in desktop, not in Oculus: it raises exception
                if (nodeList[i].hasOwnProperty('consoleText')) {
                    nodeFromAnimation.removeChild(nodeList[i].consoleText)
                    nodeList[i].console_log = ""
                }
            }

            // Destroy node
            scene.removeChild(nodeFromAnimation);
        }

        // reset nodeList
        nodeList.length = 0
    },

    update: function () {

        for (let packet of this.flying)
            packet.emit("animation-pause", null, false)

        for (var i = 0; i < this.finalPackets.length; i++) {
            let packet = this.finalPackets[i].newPacket
            let length = packet.children.length

            for (var a = 0; a < length; a++) {
                if (packet.children[0])
                    packet.children[0].remove()
            }
            if (packet.parentNode)
                packet.parentNode.removeChild(packet);
        }

        this.deleteNodes()
        this.deleteLinks()

        this.nodeList = []
        this.links.length = []

        this.finalPackets.length = 0
        this.flying.length = 0

        this.next_packet = 0

        if (this.data.depends_on != "")
            // Need to wait until the network on which we depend has been initialized, so just wait a little bit

            setTimeout(() => {
                this.createNetwork(this.data.machineNames, this.data.elementsScale)
            }, 1000)
        else
            this.createNetwork(this.data.machineNames, this.data.elementsScale)
    },

    init: function () {

        this.latest_startTime = -2
        this.CURRENT_TIME = 0

        this.links = []
        this.nodeList = []
        this.finalPackets = []
        this.flying = []

        this.next_packet = 0
        this.animationState = "INIT"

        this.rewindTargetTime = undefined
        this.onRewindReached = undefined
        this.fastForwardTargetTime = undefined
        this.onFastForwardReached = undefined

        // view
        this.VIEW = ""
        this.nodeFilter = ""

    },

    readPackets(responseParse) {
        // packets from pcap file are in responseParse
        // creates pkt with some fields such as eth.src, eth.dst and pushes to packets
        // returns packets

        let network = this
        let links = this.links
        let layer_suffix = this.data.layer_suffix


        let seen_packets = [];
        let packets = [];


        for (var j = 0; j < responseParse.length; j++) {

            let pkt = {
                src: responseParse[j]._source.layers.eth["eth.src"],
                dst: responseParse[j]._source.layers.eth["eth.dst"],
                time: responseParse[j]._source.layers.frame["frame.time_epoch"],
                id: j,
                e2ePumps: 0
            }

            var frameProtocols = responseParse[j]._source.layers.frame["frame.protocols"]

            if (responseParse[j]._source.layers.hasOwnProperty("tcp") && !responseParse[j]._source.layers.hasOwnProperty("http") && responseParse[j]._source.layers.tcp["tcp.len"] != "0" && !frameProtocols.includes(":data")) {
                // Some tcp segments have data but the pcap frame does not have a data field, so we add it
                // because if we do not do that, the data is not shown for those packets 
                frameProtocols += ":data"
            }

            frameProtocols = frameProtocols.replace(/eth:ethertype/g, "eth")
            frameProtocols = frameProtocols.replace(/vlan:ethertype/g, "vlan")

            const icmp_regex = /icmp:.*/g
            frameProtocols = frameProtocols.replace(icmp_regex, "icmp")
            frameProtocols = frameProtocols.split(":")
            pkt.frameProtocols = frameProtocols


            for (const protocol of frameProtocols)
                pkt[protocol] = responseParse[j]._source.layers[protocol]


            if (frameProtocols.includes("tcp")) {
                if (responseParse[j]._source.layers.tcp["tcp.len"] !== "0") { // TCP segment with data => add data layer
                    pkt.data = responseParse[j]._source.layers.tcp["tcp.payload"];
                }
            }

            // udp and raw data encapsulated
            if (frameProtocols.includes("udp")) {
                if ((frameProtocols.includes("data")) && (responseParse[j]._source.layers.udp["udp.length"] !== "0")) { // UDP segment with data => add data layer
                    pkt.data = responseParse[j]._source.layers.udp["udp.payload"];
                }
            }


            if (responseParse[j]._source["layers"].hasOwnProperty("pkt_comment")) {
                let comment = JSON.parse(responseParse[j]._source.layers.pkt_comment["frame.comment"])
                if (comment.hasOwnProperty("link")) {
                    pkt.srcIface = { node: comment.link.src.node + layer_suffix, iface: comment.link.src.iface }
                    pkt.dstIface = { node: comment.link.dst.node + layer_suffix, iface: comment.link.dst.iface }
                }
            }



            // Filter only packets satisfying getPacketFilter()
            let filter = jseEval.compile(network.getPacketFilter());
            if (filter(responseParse[j]._source.layers)) {

                // Filter only packets satisfying getE2ePacketFilter()
                let filterE2E = jseEval.compile(network.getE2ePacketFilter());
                if (filterE2E(responseParse[j]._source.layers)) {

                    let ip_src, ip_id, ip_dst
                    if (Array.isArray(responseParse[j]._source.layers.ip)) {
                        ip_src = responseParse[j]._source.layers.ip[0]["ip.src"]
                        ip_id = responseParse[j]._source.layers.ip[0]["ip.id"]
                        ip_dst = responseParse[j]._source.layers.ip[0]["ip.dst"]

                    }
                    else {
                        ip_src = responseParse[j]._source.layers.ip["ip.src"]
                        ip_id = responseParse[j]._source.layers.ip["ip.id"]
                        ip_dst = responseParse[j]._source.layers.ip["ip.dst"]

                    }

                    let packet = {
                        ip_src: ip_src,
                        ip_id: ip_id
                    }

                    let to = links.find(o => o.ipaddr.includes(ip_dst))

                    var i = to.ipaddr.findIndex(o => o == ip_dst)
                    let dst_eth = to.hwaddr[i]

                    ////

                    // si el paquete no aparece en la captura llegando al destino, marcarlo para
                    // que en la animación end-to-end no llegue al destino
                    // destinatario del paquete:
                    var i = to.ipaddr.findIndex(o => o == responseParse[j]._source.layers.ip["ip.dst"])
                    dst_eth = to.hwaddr[i]
                    let paqueteLlegandoADestino = responseParse.find(p => p._source.layers.hasOwnProperty("ip") && p._source.layers.ip["ip.id"] == responseParse[j]._source.layers.ip["ip.id"] && p._source.layers.eth["eth.dst"] == dst_eth)
                    if (!paqueteLlegandoADestino) {
                        pkt.mustBeLostInE2EViews = true;
                    }

                    ////


                    // keep only the first IP datagram, discard others
                    if (!seen_packets.some(e => e.ip_src === packet.ip_src && e.ip_id === packet.ip_id)) {
                        packets.push(pkt);
                        seen_packets.push(packet);
                    }


                } else {
                    packets.push(pkt)
                }
            }


        }// for

        return packets;
    },

    async createPackets() {
        let network = this
        let finalPackets = this.finalPackets
        let links = this.links
        let layer_suffix = this.data.layer_suffix
        let data = this.data
        let scene = this.el.sceneEl

        var filePackets = 'merged_capture.json'
        var requestPackets = new XMLHttpRequest();
        requestPackets.open('GET', filePackets);
        requestPackets.responseType = 'text';
        requestPackets.send();



        return new Promise((resolve) => {

            requestPackets.onload = function () {
                let response = requestPackets.response;
                let responseParse = JSON.parse(response);

                let packets = network.readPackets(responseParse)
                network.setPacketsPath(packets)
                network.createAFramePackets()

                resolve()
            }
        })
    },

    setPacketPath(packets, packet, position, latest_arp_requests, switch_msgs_ticks) {
        // calcula nodo origen y destino

        let network = this
        let finalPackets = this.finalPackets
        let links = this.links
        let data = this.data
        let scene = this.el.sceneEl


        this.process_arps(latest_arp_requests, packet, finalPackets.length)
        var from = links.find(o => o.hwaddr.includes(packet.src))

        // annotated packet?
        if (packet.hasOwnProperty("srcIface"))
            from = links.find(o => o.nodeName == packet.srcIface.node)

        if (!from)
            return

        var i = from.hwaddr.findIndex(o => o == packet.src)
        var toNodeName = from.to[i]

        var to = links.find(o => o.nodeName == toNodeName)

        // annotated packet?
        if (packet.hasOwnProperty("srcIface"))
            to = links.find(o => o.nodeName == packet.dstIface.node)

        if (!to)
            return


        // process switches
        var srcNode = links.find(o => o.nodeName === packet.srcIface.node)
        var dstNode = links.find(o => o.nodeName === packet.dstIface.node)
        if (srcNode.type == "switch")
            position = 1 + switch_msgs_ticks.tick_from_switch(packet, packet.srcIface.node)


        if (dstNode.type == "switch") {
            var src_switch
            if (srcNode.type == "switch")
                src_switch = packet.srcIface.node
            else src_switch = "noswitch"
            switch_msgs_ticks.store_in_switch(packet, position, src_switch, packet.dstIface.node)
        }


        let startTime
        if (network.data.depends_on != "") {
            var othernet = document.querySelector('#' + network.data.depends_on)
            startTime = othernet.components["network"].getStartTime(packet.ip, packet.eth, packet.srcIface, packet.dstIface)
        }
        else {
            startTime = TICK * position
        }
        this.push_packet(from, to, packet, startTime, DURATION_LINK, data)


        if (to.type == 'hub') {
            position += 1
            // create packets from hub to all ports except from.nodeName
            for (var d = 0; d < to.to.length; d++) {
                if (to.to[d] != from.nodeName) {
                    var secondFrom = to
                    var secondTo = links.find(o => o.nodeName === to.to[d])

                    let savedSrcIface = packet.srcIface
                    let savedDstIface = packet.dstIface
                    packet.srcIface = { node: packet.dstIface.node, iface: "" }
                    packet.dstIface = { node: secondTo.nodeName, iface: "" }

                    let startTime
                    if (network.data.depends_on != "") {
                        var othernet = document.querySelector('#' + network.data.depends_on)

                        startTime = othernet.components["network"].getStartTime(packet.ip, packet.eth, packet.srcIface, packet.dstIface)
                    }
                    else {
                        startTime = TICK * position
                    }

                    this.push_packet(secondFrom, secondTo, packet, startTime, DURATION_LINK, data)
                    packet.srcIface = savedSrcIface
                    packet.dstIface = savedDstIface

                    // process switches
                    if (secondTo.type == "switch") {
                        var src_switch

                        src_switch = "noswitch"
                        switch_msgs_ticks.store_in_switch(packet, position + 1, src_switch, secondTo.nodeName)
                    }
                }
            }
        }
        return position
    },

    setEndToEndPacketPath(packets, packet, position) {
        let network = this
        let links = this.links
        let data = this.data

        var from

        if (Array.isArray(packet.eth))
            from = links.find(o => o.hwaddr.includes(packet.eth[0]["eth.src"]));
        else
            from = links.find(o => o.hwaddr.includes(packet.eth["eth.src"]));

        var to
        if (Array.isArray(packet.ip))
            to = links.find(o => o.ipaddr.includes(packet.ip[0]["ip.dst"]));
        else
            to = links.find(o => o.ipaddr.includes(packet.ip["ip.dst"]));

        if (!to)
            return


        // check if this packet must be shown as lost in the e2e views
        let toCoordX = to.coordX;
        let toCoordZ = to.coordZ;
        let mustBeLostInE2EViews = false;
        if (isEndToEndVIEW(network) && packet.hasOwnProperty("mustBeLostInE2EViews")) {
            mustBeLostInE2EViews = true;

            var coords = pointInSegment(
                { "x": parseFloat(from.coordX), "y": data.SHIFT_Y, "z": parseFloat(from.coordZ) },
                { "x": parseFloat(to.coordX), "y": data.SHIFT_Y, "z": parseFloat(to.coordZ) },
                0.3
            )
            toCoordX = coords["x"]
            toCoordZ = coords["z"]
        }


        let startTime, linkDuration
        if (network.data.depends_on != "") {
            var othernet = document.querySelector('#' + network.data.depends_on)

            startTime = othernet.components["network"].getTimesIP(packet.ip)
        }
        else {
            startTime = TICK * position
        }

        linkDuration = DURATION_LINK


        if (network.data.depends_on != "") {
            var othernet = document.querySelector('#' + network.data.depends_on)
            var otherFinalPackets = othernet.components["network"].getFinalPackets()


            let dependentPackets = otherFinalPackets.filter(p =>
                p.hasOwnProperty("ip") && ((Array.isArray(p.ip) && Array.isArray(packet.ip) && p.ip[0]["ip.id"] == packet.ip[0]["ip.id"]) ||
                    (!Array.isArray(p.ip) && p.ip["ip.id"] == packet.ip["ip.id"])))
            packet.e2ePumps = dependentPackets.length
        }

        this.push_packet(from, to, packet, startTime, linkDuration, data, toCoordX, toCoordZ, mustBeLostInE2EViews)
    },

    setPacketsPath(packets) {
        // Push to finalPackets each packet, and generate new ones if destination is a hub

        let network = this
        let finalPackets = this.finalPackets
        let links = this.links
        let data = network.data
        let scene = this.el.sceneEl


        let latest_arp_requests = {}
        let switch_msgs_ticks = new Switches()


        let position = -1
        for (var j = 0; j < packets.length; j++) {
            position += 3 // 2

            const e2eFilter = jseEval.compile(network.getE2ePacketFilter());
            if (e2eFilter(packets[j])) {
                this.setEndToEndPacketPath(packets, packets[j], position)
            }
            else {
                position = this.setPacketPath(packets, packets[j], position, latest_arp_requests, switch_msgs_ticks)
            }
        }

        finalPackets = finalPackets.sort((a, b) => (a.startTime > b.startTime) ? 1 : ((b.startTime > a.startTime) ? -1 : 0))
    },

    createAFramePackets() {
        let network = this
        let finalPackets = this.finalPackets
        let data = this.data
        let scene = this.el.sceneEl
        for (var currentPacket = 0; currentPacket < finalPackets.length; currentPacket++) {
            var newPacket = document.createElement('a-entity');
            newPacket.setAttribute('packet', 'network', network);
            newPacket.setAttribute('packet', 'from', finalPackets[currentPacket].from.nodeName);
            newPacket.setAttribute('packet', 'to', finalPackets[currentPacket].to.nodeName);
            newPacket.setAttribute('packet', 'xPosition', finalPackets[currentPacket].xPosition);
            newPacket.setAttribute('packet', 'yPosition', network.data.position.y / 15 + data.SHIFT_Y);
            newPacket.setAttribute('packet', 'zPosition', finalPackets[currentPacket].zPosition);
            newPacket.setAttribute('packet', 'toXPosition', finalPackets[currentPacket].toXPosition);
            newPacket.setAttribute('packet', 'toYPosition', network.data.position.y / 15 + data.SHIFT_Y);
            newPacket.setAttribute('packet', 'toZPosition', finalPackets[currentPacket].toZPosition);
            newPacket.setAttribute('packet', 'elementsScale', data.elementsScale);
            newPacket.setAttribute('packet', 'class', 'packetClass')
            newPacket.setAttribute('packet', 'id', currentPacket);
            newPacket.setAttribute('packet', 'startTime', finalPackets[currentPacket].startTime);
            newPacket.setAttribute('packet', 'frameTime', finalPackets[currentPacket].frameTime);
            newPacket.setAttribute('packet', 'linkDuration', finalPackets[currentPacket].linkDuration);
            newPacket.setAttribute('packet', 'e2ePumps', finalPackets[currentPacket].e2ePumps);
            newPacket.setAttribute('packet', 'mustBeLostInE2EViews', finalPackets[currentPacket].mustBeLostInE2EViews);


            function setProtocolAttribute(currentPacket, protocols) {
                for (const protocol of protocols) {
                    if (finalPackets[currentPacket][protocol]) {
                        newPacket.setAttribute('packet', protocol, finalPackets[currentPacket][protocol]);
                    }
                }
            }

            setProtocolAttribute(currentPacket, ["eth", "ip", "vlan", "vxlan", "arp", "dataInfo", "data", "tcp", "udp", "icmp", "dns", "http", "frameProtocols"]);

            scene.appendChild(newPacket);

            finalPackets[currentPacket].newPacket = newPacket
        }
    },

    process_arps(latest_arp_requests, packet, position) {
        // If arp packet, store it in latest_arp_requests
        // If ip packet, store its id in the ARP request that precedes it 

        let finalPackets = this.finalPackets

        let eth_dst = packet["eth"]["eth.dst"]
        let eth_src = packet["eth"]["eth.src"]

        if ("arp" in packet)
            if (packet["arp"]["arp.opcode"] == "2" && eth_dst in latest_arp_requests)
                // ARP reply
                // store the hwaddr of the sender of the ARP reply
                latest_arp_requests[eth_dst]["arp.dst.hw_mac"] = packet["eth"]["eth.src"]
            else if (packet["arp"]["arp.opcode"] == "1") { // arp request
                if (!latest_arp_requests.hasOwnProperty(eth_src))
                    latest_arp_requests[eth_src] = { "next_ip_position": position }
            }

        if ("ip" in packet && eth_src in latest_arp_requests &&
            eth_dst == latest_arp_requests[eth_src]["arp.dst.hw_mac"]
        ) { // Store in the ARP request packet the position of the IP packet in finalPackets (position)
            let arpPacket = finalPackets[latest_arp_requests[eth_src]["next_ip_position"]]
            arpPacket["next_ip_position"] = position

            delete latest_arp_requests[eth_src]
        }
    },

    push_packet(from, to, packet, startTime, linkDuration, data, toCoordX = to.coordX, toCoordZ = to.coordZ, mustBeLostInE2EViews = false) {
        let finalPackets = this.finalPackets


        finalPackets.push({
            'from': from,
            'to': to,
            'xPosition': (from.coordX / 15) / data.elementsScale,
            'yPosition': (from.coordY / 15) / data.elementsScale,
            'zPosition': (from.coordZ / 15) / data.elementsScale,
            'toXPosition': (toCoordX / 15) / data.elementsScale,
            'toYPosition': (to.coordY / 15) / data.elementsScale,
            'toZPosition': (toCoordZ / 15) / data.elementsScale,
            'startTime': startTime,
            'linkDuration': linkDuration,
            'id': packet.id,
            'frameTime': packet.time,
            'ip': packet.ip,
            'eth': packet.eth,
            'arp': packet.arp,
            'vlan': packet.vlan,
            'vxlan': packet.vxlan,
            'dataInfo': packet.dataInfo,
            'data': packet.data,
            'tcp': packet.tcp,
            'udp': packet.udp,
            'icmp': packet.icmp,
            'dns': packet.dns,
            'http': packet.http,
            'frameProtocols': packet.frameProtocols,
            'e2ePumps': packet.e2ePumps,
            'srcIface': packet.srcIface,
            'dstIface': packet.dstIface,
            'mustBeLostInE2EViews': mustBeLostInE2EViews
        })

    }
});

