import { wait, anime, setARPCacheInfoText, setRoutingTable, setSwitchTable, setDnsCacheTable } from "./utils.js"
import { getTIME_UNIT } from "./index.js"
import eventBus from "./eventBus.js"
import { receivingARPRequest, receivingARPResponse, frameIsForMe } from "./l2.js"

class AnimatorFactory {

    // Depending on the type type of node of nodeName and the kind of packet, 
    // it returns an instance of an Animator class
    static createAnimator(p, nodeName) {
        const nodeTypes = {
            switch: SwitchAnimator,
            hub: HubAnimator,
            host: HostAnimator,
            dnsServer: DnsServerAnimator,
            server: DnsServerAnimator,
            router: RouterAnimator,
            docker: DockerAnimator,
            "switch-vlan": VLAN_L2Animator,
            "router-vxlan": RouterVXLAN
        };


        // get nodeType
        let nodeList = p.data.network.getNodeList()
        let node = nodeList.find(o => o.nodeName === nodeName)
        let nodeType = node.type

        // If there is an vlan or an vxlan layer in the p packet, return the corresponding kind of Animator
        for (let i = 0; i <= p.el.levels.length - 1; i++)
            if ((nodeType == "switch-vlan" || nodeType == "router-vxlan") && p.el.levels[i]["protocol"] == "vlan") 
                return new nodeTypes["switch-vlan"](p)
            else if ((nodeType == "switch-vlan" || nodeType == "router-vxlan") && p.el.levels[i]["protocol"] == "vxlan")
                return new nodeTypes["router-vxlan"](p)

        // Return an Animator based on the type of node
        if (nodeTypes[nodeType]) {
            return new nodeTypes[nodeType](p);
        } else {
            throw new Error(`Unknown node type: ${nodeType}`);
        }
    }
}
export default AnimatorFactory



class Animator {
    constructor(p) {
        this.p = p
        this.packet = p.el
        this.packetParams = p.data

        this.nodeAnimationTo = document.getElementById(this.packetParams.to).id;
        this.nodeAnimationFrom = document.getElementById(this.packetParams.from);
        this.ethBox = this.packet.querySelector("#ethBox" + this.packet.id)
        this.sphere = this.packet.querySelector("#sphere" + this.packet.id)
        this.finalPackets = this.p.data.network.getFinalPackets()
        this.nodeList = this.p.data.network.getNodeList()
        this.node = this.nodeList.find(o => o.nodeName === this.packetParams.from)
    }

    animatePacketArrives(nodeName) {

        console.log("Animator::animatePacketArrives()")

        let scene = this.packet.sceneEl
        var node = this.nodeList.find(o => o.nodeName === nodeName)
        let promise = Promise.resolve()

        var network = this.p.data.network


        let nodeCoords = { "x": (node.coordX / 15) / this.packetParams.elementsScale, "y": this.packetParams.SHIFT_Y, "z": (node.coordZ / 15) / this.packetParams.elementsScale }
        if (nodeCoords.x == this.packetParams.toXPosition && nodeCoords.z == this.packetParams.toZPosition)
            promise = promise
                .then(() => { return this.p.check_console("receiving", node) })


        promise = promise.then(() => this.p.finish_packet(scene))
        promise = promise.then(() => {
            wait(50 * getTIME_UNIT(), this.p.data.network)
        })

        promise = promise.then(() => this.p.next_packet_anim())

    }

    animateMove() {
        let promise = Promise.resolve()
        var network = this.p.data.network

        if (this.packetParams.e2ePumps == 0) {

            promise = promise
                .then(() => this.animateBirth())
                .then(() => wait(20 * getTIME_UNIT(), network))
                .then(() => this.sphere.setAttribute('visible', true))
                .then(() => this.packet.setAttribute("animation__link", { enabled: 'true' }))
                .then(() => {
                    if (this.packetParams.ip)
                        eventBus.publish(this.p.getKey());
                })
                .then(() => anime(this.packet, 'link'))
                .then(() => this.sphere.setAttribute('visible', true))
                .then(() => {
                    let animator = AnimatorFactory.createAnimator(this.p, this.nodeAnimationTo)
                    animator.animatePacketArrives(this.nodeAnimationTo)
                })

        }
        else {
            promise = promise
                .then(() => {
                    eventBus.subscribe(this.p.getKey(), this.packet)
                    this.packet.addEventListener(this.p.getKey(), this.p.pumpHandler.bind(null, this.p, this.sphere, this.nodeAnimationTo));
                })
                .then(() => this.animateBirth())
                .then(() => this.sphere.setAttribute('visible', true))
                .then(() => this.packet.setAttribute("animation__link", { enabled: 'true' }))
        }
    }

    animateBirth(noEth = false) {
        console.log("Animator::animateBirth()")

        let promise = Promise.resolve()

        this.packet.setAttribute('visible', true)
        for (var i = this.packet.levels.length - 1; i >= 0; i--) {
            let box = this.packet.levels[i]["box"]
            box.setAttribute('visible', true)
            box.setAttribute('class', 'clickable')

        }
        promise = promise
            .then(() => {
                let i = 0
                let protocol = this.packet.levels[i]["protocol"]
                let protocol_content = this.packet.levels[i]["protocol_content"]
                let infoText = this.packet.querySelector("#infotext" + this.packet.id)
                let box = this.packet.levels[i]["box"]

                this.p.setInfoText(protocol, protocol_content, this.packetParams, infoText, box, noEth)
            })

        return promise
    }
}

class L2Animator extends Animator {

}

class L3Animator extends Animator {

    animatePacketArrives(nodeName) {
        let packet = this.p.el
        let packetParams = this.p.data
        let that = this.p


        var network = this.p.data.network
        var finalPackets = network.getFinalPackets()
        var nodeList = network.getNodeList()
        var finalConnectionsLinks = network.getConnectionsLinks()
        var node = nodeList.find(o => o.nodeName === nodeName)
        var scene = this.p.el.sceneEl


        let promise = Promise.resolve()


        //
        // 1. don't blink if 
        //

        console.log("L3Animator::animatePacketArrives() frameIsForMe==", frameIsForMe(packetParams), packetParams)


        // if frame is not for us or it must be lost, fadeout and destroy packet, and return
        if (!frameIsForMe(packetParams) || packetParams.mustBeLostInE2EViews) {
            let fadeoutChildren = function (packet) {
                promise = promise
                    .then(() => {
                        var promises = []
                        for (const child of packet.children) {
                            child.setAttribute('animation__fadeout', { enabled: 'true' })

                            promises.push(anime(child, 'fadeout'))
                        }
                    })
                    .then(() => wait(100 * getTIME_UNIT(), network))
                    .then(() => that.next_packet_anim())


                return promises
            }

            // fadeout packet and children and then destroy packet
            packet.setAttribute('animation__fadeout', { enabled: 'true' })

            var promises = fadeoutChildren(packet)
            anime(packet, 'fadeout')
                .then(() => {
                    this.p.finish_packet(scene)
                })

            return
        }



        //
        // 2. If we reach this point, the frame is for us => consume layers from bottom to top
        //



        promise = Promise.resolve()
        promise = promise
            .then(() => wait(15 * getTIME_UNIT(), network))

        for (var i = 0; i < packet.levels.length; i++) {
            let box = packet.levels[i]["box"]

            let protocol = packet.levels[i]["protocol"]
            let protocol_content = packet.levels[i]["protocol_content"]


            // If it's an IP datagram being routed => don't blink
            // layers above ip, by breaking from the for loop
            if (packetParams.ip
                && !node.ipaddr.includes(packetParams.ip["ip.dst"])
                && packet.levels[i]["protocol"] != "ip"
                && packet.levels[i]["protocol"] != "eth") {

                break
            }

            // 1. make blink the layer box
            promise = promise
                .then(() => {
                    let infoText = packet.querySelector("#infotext" + packet.id)
                    this.p.setInfoText(protocol, protocol_content, packetParams, infoText, box)
                })
                .then(() => box.removeAttribute('blink')) // must reinstall animation because we use it before
                .then(() => box.setAttribute('animation__blink', { property: 'scale', from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale }, to: { x: packetParams.elementsScale, y: packetParams.elementsScale, z: packetParams.elementsScale }, dur: (4 * getTIME_UNIT()).toString(), easing: 'easeInOutQuint', "loop": "4", startEvents: "blink", resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', enabled: 'false' }))
                .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
                .then(() => anime(box, 'blink'))


            let thisIsIPDestination = packetParams.ip && node.ipaddr.includes(packetParams.ip["ip.dst"])

            // 2. make disappear the layer box
            switch (packet.levels[i]["protocol"]) {
                case "eth":
                    promise = promise
                        .then(() => box.setAttribute('visible', false))
                    break;
                case "arp":
                    // Process ARP Cache
                    receivingARPResponse(packetParams)
                    receivingARPRequest(packetParams)

                    let wasVisible = node.ARPCacheInfoText.getAttribute('visible')

                    setARPCacheInfoText(node.nodeName, packetParams.network, node.ARPCacheInfoText, node.ARPCache)
                    packetParams.network.getView() == "ALL" ? wait(25 * getTIME_UNIT(), network) : false
                    if (!wasVisible) node.ARPCacheInfoText.setAttribute('visible', false)
                    break;

                case "ip":
                    if (thisIsIPDestination) {
                        // 
                        promise = promise
                            .then(() => box.setAttribute('visible', false))
                    }
                    else if (packetParams.ip["ip.ttl"] == 1) {
                        // discard whole packet because of ttl
                        promise = promise
                            .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
                            .then(() => anime(box, 'blink'))

                        let fadeoutChildren = function (packet) {
                            let promises = []

                            for (const child of packet.children) {
                                child.setAttribute('animation__fadeout', { enabled: 'true' })


                                // infoText = packet.querySelector("#infotext" + packet.id)
                                // infoText.setAttribute('visible', false)
                                promises.push(anime(child, 'fadeout'))
                            }
                            return promises
                        }

                        packet.setAttribute('animation__fadeout', { enabled: 'true' })
                        promise = promise
                            .then(() => wait(15 * getTIME_UNIT(), network))
                            .then(() => Promise.all([anime(packet, 'fadeout'), fadeoutChildren(packet)]))
                            .then(() => {
                                let infoText = packet.querySelector("#infotext" + packet.id)
                                infoText.setAttribute('visible', false)
                                box.setAttribute('visible', false)
                            })
                    }


                    break;
                default:
                    if (thisIsIPDestination)
                        promise = promise
                            .then(() => {
                                let infoText = packet.querySelector("#infotext" + packet.id)
                                infoText.setAttribute('visible', false)
                                box.setAttribute('visible', false)
                            })
                    break;
            }

        }

        // 
        // 3. Finally, destroy the packet 
        //  
        let isNotIPDestination = packetParams.ip && !node.ipaddr.includes(packetParams.ip["ip.dst"])
        if (isNotIPDestination) {
            // It's an IP datagram being routed => show the next packet
            // before destroying the current packet, so no glitches appear
            // in the image
            promise = promise
                .then(() => wait(15 * getTIME_UNIT(), network))
                .then(() => this.p.next_packet_anim())
                .then(() => wait(5 * getTIME_UNIT(), network))
                .then(() => {
                    this.p.check_console("receiving", node)
                })
                .then(() => wait(10 * getTIME_UNIT(), network))
                .then(() => {
                    return this.p.finish_packet(scene)
                })
        }
        else {
            // it was the destination, thus just destroy it 
            // and then show the next
            promise = promise
                .then(() => wait(25 * getTIME_UNIT(), network))
                .then(() => {
                    return this.p.check_console("receiving", node)
                })
                .then(() => {

                    this.p.finish_packet(scene)
                })
                .then(() => {
                    wait(55 * getTIME_UNIT(), network)
                })
                .then(() => this.p.next_packet_anim())
        }

        return promise

    }

    animatePark() {
        let a_promise = wait(15 * getTIME_UNIT(), this.packetParams.network)
            .then(() => this.animateBirth(true))
            .then(() => this.ethBox.setAttribute('opacity', 0.5))
            .then(() => this.packet.setAttribute("animation__park", { enabled: 'true' }))
            .then(() => anime(this.packet, 'park'))


        return a_promise;
    }



    animateUnPark() {
        console.log("L3Animator::animateUnPark()")

        setARPCacheInfoText(this.node.nodeName, this.packetParams.network, this.node.ARPCacheInfoText, this.node.ARPCache)

        let promise = Promise.resolve()

        promise = promise
            .then(() => {
                //this.packetParams.network.getView() == "ALL" ? wait(45 * getTIME_UNIT(), this.packetParams.network) : false
                this.node.ARPCacheInfoText.setAttribute('visible', true)
            })
            .then(() => wait(25 * getTIME_UNIT(), this.p.data.network))
            .then(() => {
                //this.packetParams.network.getView() == "ALL" ? wait(45 * getTIME_UNIT(), this.packetParams.network) : false
                this.node.ARPCacheInfoText.setAttribute('visible', false)
                this.ethBox.setAttribute('visible', true)
                this.ethBox.setAttribute('opacity', 0.5)
                this.ethBox.removeAttribute('blink') // must reinstall animation because we use it in unpark
                this.ethBox
                    .setAttribute('animation__blink',
                        {
                            property: 'scale',
                            from: { x: 0.5 * this.packetParams.elementsScale, y: 0.5 * this.packetParams.elementsScale, z: 0.5 * this.packetParams.elementsScale },
                            to: { x: this.packetParams.elementsScale, y: this.packetParams.elementsScale, z: this.packetParams.elementsScale },
                            dur: (4 * getTIME_UNIT()).toString(),
                            easing: 'easeInOutQuint', "loop": "4",
                            startEvents: "blink", resumeEvents: 'animation-resume',
                            pauseEvents: 'animation-pause', enabled: 'false'
                        })
            })
            .then(() => wait(25 * getTIME_UNIT(), this.p.data.network))
            .then(() => this.ethBox.setAttribute("animation__blink", { enabled: 'true' }))
            .then(() => anime(this.ethBox, 'blink'))
            .then(() => wait(25 * getTIME_UNIT(), this.p.data.network))
            .then(() => {
                let infoText = this.packet.querySelector("#infotext" + this.packet.id)
                this.p.setInfoText("eth", this.packetParams.eth, this.packetParams, infoText, this.ethBox)
            })

            .then(() => this.ethBox.setAttribute('animation__fadein', { enabled: 'true' }))
            .then(() => anime(this.ethBox, 'fadein'))
            .then(() => this.ethBox.setAttribute('animation__blink', { enabled: 'true' }))
            .then(() => anime(this.ethBox, 'blink'))
            .then(() => this.packet.setAttribute("animation__unpark", { enabled: 'true' }))
            .then(() => anime(this.packet, 'unpark'))
            .then(() => {
                this.sphere.setAttribute('visible', true)
                this.packet.setAttribute("animation__link", { enabled: 'true' })
            })
            .then(() => anime(this.packet, 'link'))
            .then(() => {
                this.sphere.setAttribute('visible', false)
                let animator = AnimatorFactory.createAnimator(this.p, this.nodeAnimationTo)
                animator.animatePacketArrives(this.nodeAnimationTo)
            })
    }

    animateBirth(noEth = false) {
        let promise = Promise.resolve()
        //        promise = promise.then(() => wait(12 * getTIME_UNIT(), this.p.data.network))



        // Show level boxes from top to bottom
        for (var i = this.packet.levels.length - 1; i >= 0; i--) {
            let box = this.packet.levels[i]["box"]
            box.setAttribute('visible', false)


            // if noEth => this is an IP datagram and the hwaddr of
            // net how is not known, so don't show eth box
            if (noEth && this.packet.levels[i]["protocol"] == "eth")
                box.setAttribute('opacity', 0.4)


            if (this.packetParams.ip
                && !this.node.ipaddr.includes(this.packetParams.ip["ip.src"])
                && !this.node.ipaddr.includes(this.packetParams.ip["ip.dst"])
                && !(this.packet.levels[i]["protocol"] == "eth" && i == 0)  // tunneled eth layer must be shown
                && !(this.packet.levels[i]["protocol"] == "ip" && i == 1)) // tunneled ip  layer must be shown
            {   // it's an ip datagram being routed => dont create
                // levels above ip, just draw them. ip is blinked to
                // signify TTL modified
                box.setAttribute("visible", true)
            }
            else {

                let protocol = this.packet.levels[i]["protocol"]
                let protocol_content = this.packet.levels[i]["protocol_content"]

                if (this.packetParams.ip && protocol == "eth") {
                    var newNodeElement = document.querySelector("#" + this.node.nodeName)
                    let wasVisible = this.node.ARPCacheInfoText.getAttribute('visible')

                    promise = promise
                        .then(() => setRoutingTable(this.node.routingTableText, newNodeElement))
                        .then(() => wait(35 * getTIME_UNIT(), this.p.data.network))
                        .then(() => this.packet.setAttribute("animation__route", { enabled: 'true' }))
                        .then(() => anime(this.packet, 'route'))
                        .then(() => wait(35 * getTIME_UNIT(), this.p.data.network))

                        .then(() => {
                            if (!wasVisible) this.node.routingTableText.setAttribute('visible', false)
                        })
                        .then(() => setARPCacheInfoText(this.node.nodeName, this.packetParams.network, this.node.ARPCacheInfoText, this.node.ARPCache))
                        .then(() => (this.packetParams.network.getView() == "ALL") ? wait(25 * getTIME_UNIT(), this.packetParams.network) : false)
                        .then(() => {
                            if (!wasVisible)
                                this.node.ARPCacheInfoText.setAttribute('visible', false)
                        })
                }

                promise = promise
                    .then(() => box.setAttribute("visible", true))
                    .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
                    .then(() => {
                        var infoText = this.packet.querySelector("#infotext" + this.packet.id)
                        this.p.setInfoText(protocol, protocol_content, this.packetParams, infoText, box, noEth)
                    })
                    .then(() => anime(box, 'blink'))
                    .then(() => wait(15 * getTIME_UNIT(), this.packetParams.network))
            }
        }

        return promise
    }
}





class HubAnimator extends L2Animator {

}

class SwitchAnimator extends L2Animator {
    animatePacketArrives(nodeName) {
        console.log("SwitchAnimator::animatePacketArrives()")

        var node = this.nodeList.find(o => o.nodeName === nodeName)


        let promise = Promise.resolve()

        // Make blink the lowest box (eth)
        let box = this.packet.levels[0]["box"]
        box.setAttribute('class', 'clickable')

        let protocol = this.packet.levels[0]["protocol"]
        let protocol_content = this.packet.levels[0]["protocol_content"]
        promise = promise
            .then(() => {
                let infoText = this.packet.querySelector("#infotext" + this.packet.id)
                this.p.setInfoText(protocol, protocol_content, this.packetParams, infoText, box)
            })
            .then(() => box.removeAttribute('blink')) // must reinstall animation because we use it before
            .then(() => box.setAttribute('animation__blink', {
                property: 'scale',
                from: { x: 0.5 * this.packetParams.elementsScale, y: 0.5 * this.packetParams.elementsScale, z: 0.5 * this.packetParams.elementsScale },
                to: { x: this.packetParams.elementsScale, y: this.packetParams.elementsScale, z: this.packetParams.elementsScale },
                dur: (4 * getTIME_UNIT()).toString(), easing: 'easeInOutQuint', "loop": "4",
                startEvents: "blink", resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', enabled: 'false'
            }))
            .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
            .then(() => anime(box, 'blink'))

        //
        // add to switch table the src hwaddr of packet
        //
        let network = this.p.data.network
        let connectionLink = network.getConnectionsLinks().find(o => o.nodeName == this.packetParams.to)
        let eth_src = this.packetParams.eth["eth.src"]
        let inputPort = connectionLink.to.findIndex(o => o == this.packetParams.from)


        // 1. eliminate the entry that is going to be updated it it exists
        const containsArray1 = node.switch_table.some(
            arr => arr[1] == eth_src
        );
        if (containsArray1) {
            // eliminate current
            node.switch_table = node.switch_table.filter(
                arr => arr[1] != eth_src
            );
        }

        // 2. add new entry with 0.0s
        const entry2 = [inputPort + 1, eth_src, "no", "0.0s", this.packetParams.frameTime];
        node.switch_table.push(entry2)



        // show and then hide the switch table
        var newNodeElement = document.querySelector("#" + node.nodeName)
        let wasVisible = node.switchTableText.getAttribute('visible')
        promise = promise
            .then(() => setSwitchTable(node.nodeName, node.switchTableText, node.switch_table))
            .then(() => wait(55 * getTIME_UNIT(), this.p.data.network))
            .then(() => {
                if (!wasVisible) node.switchTableText.setAttribute('visible', false)
            })
            .then(() => wait(15 * getTIME_UNIT(), this.p.data.network))
            .then(() => this.p.finish_packet(this.scene))

        promise = promise.then(() => this.p.next_packet_anim())

    }
}

class HostAnimator extends L3Animator {
    animateBirth(noEth = false) {
        console.log("HostAnimator::animateBirth()")


        let promise = Promise.resolve()
        promise = promise.then(() => wait(12 * getTIME_UNIT(), this.p.data.network))

        // check console of host
        if (this.node.type == 'host' && this.node.console)
            promise = promise.then(
                () => { return this.p.check_console("sending", this.node) }
            )
                .then(() => wait(5 * getTIME_UNIT(), this.p.data.network))

        promise = promise.then(
            () => super.animateBirth(noEth)
        )

        return promise
    }

}

class RouterAnimator extends L3Animator {

}

class DockerAnimator extends HostAnimator {
}

class VLAN_L2Animator extends L2Animator {
    animateBirth(noEth = false) {
        console.log("VLAN_L2Animator::animateBirth()")

        let promise = Promise.resolve()

        let insert_vlan = this.packet.levels[1]["protocol"] == "vlan"
        let delete_vlan = !insert_vlan

        let last_layer_above_vlan
        if (insert_vlan)
            last_layer_above_vlan = 2
        else
            last_layer_above_vlan = 1

        // show all layers except vlan and eth
        this.packet.setAttribute('visible', true)
        for (var i = this.packet.levels.length - 1; i >= last_layer_above_vlan; i--) {
            let box = this.packet.levels[i]["box"]
            box.setAttribute('visible', true)
            box.setAttribute('class', 'clickable')
        }


        // now show vlan and eth layers
        var network = this.p.data.network
        let packet = this.p.el
        let packetParams = this.p.data
        let box

        if (insert_vlan)
            promise = promise
                .then(() => wait(15 * getTIME_UNIT(), network))
                .then(() => {
                    // show vlan layer
                    let i = 1
                    box = this.packet.levels[i]["box"]
                    box.setAttribute('visible', true)
                    box.setAttribute('class', 'clickable')
                })
                .then(() => box.removeAttribute('blink')) // must reinstall animation because we use it before
                .then(() => box.setAttribute('animation__blink', { property: 'scale', from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale }, to: { x: packetParams.elementsScale, y: packetParams.elementsScale, z: packetParams.elementsScale }, dur: (4 * getTIME_UNIT()).toString(), easing: 'easeInOutQuint', "loop": "4", startEvents: "blink", resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', enabled: 'false' }))
                .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
                .then(() => anime(box, 'blink'))
                .then(() => {
                    // show infotext of vlan layer
                    let i = 1
                    let protocol = this.packet.levels[i]["protocol"]
                    let protocol_content = this.packet.levels[i]["protocol_content"]
                    let infoText = this.packet.querySelector("#infotext" + this.packet.id)
                    let box = this.packet.levels[i]["box"]
                    box.setAttribute('class', 'clickable')

                    this.p.setInfoText(protocol, protocol_content, this.packetParams, infoText, box, noEth)
                })
                .then(() => wait(30 * getTIME_UNIT(), network))


        promise = promise
            .then(() => {
                // show eth layer and its infotext 
                let i = 0
                let protocol = this.packet.levels[i]["protocol"]
                let protocol_content = this.packet.levels[i]["protocol_content"]
                let infoText = this.packet.querySelector("#infotext" + this.packet.id)
                let box = this.packet.levels[i]["box"]
                box.setAttribute('class', 'clickable')

                this.p.setInfoText(protocol, protocol_content, this.packetParams, infoText, box, noEth)
            })
            .then(() => {
                // show eth layer
                let i = 0
                box = this.packet.levels[i]["box"]
                box.setAttribute('visible', true)
                box.setAttribute('class', 'clickable')
            })
            .then(() => box.removeAttribute('blink')) // must reinstall animation because we use it before
            .then(() => box.setAttribute('animation__blink', { property: 'scale', from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale }, to: { x: packetParams.elementsScale, y: packetParams.elementsScale, z: packetParams.elementsScale }, dur: (4 * getTIME_UNIT()).toString(), easing: 'easeInOutQuint', "loop": "4", startEvents: "blink", resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', enabled: 'false' }))
            .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
            .then(() => anime(box, 'blink'))
            .then(() => wait(15 * getTIME_UNIT(), network))



        return promise
    }

}

class RouterVXLAN extends L3Animator {
    animatePacketArrives(nodeName) {

        console.log("RouterVXLAN::animatePacketArrives()")

        let scene = this.packet.sceneEl
        var node = this.nodeList.find(o => o.nodeName === nodeName)
        let promise = Promise.resolve()

        var network = this.p.data.network


        let nodeCoords = { "x": (node.coordX / 15) / this.packetParams.elementsScale, "y": this.packetParams.SHIFT_Y, "z": (node.coordZ / 15) / this.packetParams.elementsScale }
        if (nodeCoords.x == this.packetParams.toXPosition && nodeCoords.z == this.packetParams.toZPosition)
            promise = promise
                .then(() => { return this.p.check_console("receiving", node) })


        promise = promise.then(() => this.p.finish_packet(scene))
        promise = promise.then(() => {
            wait(50 * getTIME_UNIT(), this.p.data.network)
        })

        promise = promise.then(() => this.p.next_packet_anim())

    }


    animateBirth(noEth = false) {
        console.log("RouterVXLAN::animateBirth()")


        // show all layers until first eth included
        let next_level_vxlan;
        this.packet.setAttribute('visible', true)
        for (var i = this.packet.levels.length - 1; i >= 0; i--) {
            let box = this.packet.levels[i]["box"]
            box.setAttribute('visible', true)
            box.setAttribute('class', 'clickable')

            if (this.packet.levels[i]["protocol"] == "eth") {
                next_level_vxlan = i - 1;
                break;
            }
        }


        let promise = Promise.resolve()

        let ips_processed = 0
        // Show level boxes from top to bottom
        for (var i = next_level_vxlan; i >= 0; i--) {
            let box = this.packet.levels[i]["box"]
            box.setAttribute('visible', false)
            box.setAttribute('class', 'clickable')

            // if noEth => this is an IP datagram and the hwaddr of
            // net how is not known, so don't show eth box
            if (noEth && this.packet.levels[i]["protocol"] == "eth")
                box.setAttribute('opacity', 0.4)
            let protocol = this.packet.levels[i]["protocol"]
            let protocol_content = this.packet.levels[i]["protocol_content"]


            if (protocol == "ip") ips_processed += 1
            if (this.packetParams.ip && ips_processed == this.packetParams.ip.length-1 && protocol == "eth") {
                var newNodeElement = document.querySelector("#" + this.node.nodeName)
                let wasVisible = this.node.ARPCacheInfoText.getAttribute('visible')


                promise = promise
                    .then(() => setRoutingTable(this.node.routingTableText, newNodeElement))
                    .then(() => wait(35 * getTIME_UNIT(), this.p.data.network))
                    .then(() => this.packet.setAttribute("animation__route", { enabled: 'true' }))
                    .then(() => anime(this.packet, 'route'))
                    .then(() => wait(35 * getTIME_UNIT(), this.p.data.network))

                    .then(() => {
                        if (!wasVisible) this.node.routingTableText.setAttribute('visible', false)
                    })
                    .then(() => setARPCacheInfoText(this.node.nodeName, this.packetParams.network, this.node.ARPCacheInfoText, this.node.ARPCache))
                    .then(() => (this.packetParams.network.getView() == "ALL") ? wait(25 * getTIME_UNIT(), this.packetParams.network) : false)
                    .then(() => {
                        if (!wasVisible)
                            this.node.ARPCacheInfoText.setAttribute('visible', false)
                    })
            }

            promise = promise
                .then(() => box.setAttribute("visible", true))
                .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
                .then(() => {
                    var infoText = this.packet.querySelector("#infotext" + this.packet.id)
                    this.p.setInfoText(protocol, protocol_content, this.packetParams, infoText, box, noEth)
                })
                .then(() => anime(box, 'blink'))
                .then(() => wait(15 * getTIME_UNIT(), this.packetParams.network))

        }

        return promise
    }
}

class DnsServerAnimator extends L3Animator {
    animatePacketArrives(nodeName) {
        console.log("DnsServerAnimator::animatePacketArrives()")

        let packet = this.p.el
        let packetParams = this.p.data
        let that = this.p


        var network = this.p.data.network
        var finalPackets = network.getFinalPackets()
        var nodeList = network.getNodeList()
        var finalConnectionsLinks = network.getConnectionsLinks()
        var node = nodeList.find(o => o.nodeName === nodeName)
        var scene = this.p.el.sceneEl

        let promise = Promise.resolve()


        //
        // 1. don't blink if 
        //



        // if frame is not for us or it must be lost, fadeout and destroy packet, and return
        if (!frameIsForMe(packetParams) || packetParams.mustBeLostInE2EViews) {
            let fadeoutChildren = function (packet) {
                promise = promise
                    .then(() => {
                        var promises = []
                        for (const child of packet.children) {
                            child.setAttribute('animation__fadeout', { enabled: 'true' })

                            promises.push(anime(child, 'fadeout'))
                        }
                    })
                    .then(() => wait(100 * getTIME_UNIT(), network))
                    .then(() => that.next_packet_anim())


                return promises
            }

            // fadeout packet and children and then destroy packet
            packet.setAttribute('animation__fadeout', { enabled: 'true' })

            var promises = fadeoutChildren(packet)
            anime(packet, 'fadeout')
                .then(() => {
                    this.p.finish_packet(scene)
                })

            return
        }



        //
        // 2. If we reach this point, the frame is for us => consume layers from bottom to top
        //



        promise = Promise.resolve()
        promise = promise
            .then(() => wait(15 * getTIME_UNIT(), network))

        for (var i = 0; i < packet.levels.length; i++) {
            let box = packet.levels[i]["box"]
            box.setAttribute('class', 'clickable')


            let protocol = packet.levels[i]["protocol"]
            let protocol_content = packet.levels[i]["protocol_content"]



            // 1. make blink the layer box
            promise = promise
                .then(() => {
                    let infoText = packet.querySelector("#infotext" + packet.id)
                    this.p.setInfoText(protocol, protocol_content, packetParams, infoText, box)
                })
                .then(() => box.removeAttribute('blink')) // must reinstall animation because we use it before
                .then(() => box.setAttribute('animation__blink', { property: 'scale', from: { x: 0.5 * packetParams.elementsScale, y: 0.5 * packetParams.elementsScale, z: 0.5 * packetParams.elementsScale }, to: { x: packetParams.elementsScale, y: packetParams.elementsScale, z: packetParams.elementsScale }, dur: (4 * getTIME_UNIT()).toString(), easing: 'easeInOutQuint', "loop": "4", startEvents: "blink", resumeEvents: 'animation-resume', pauseEvents: 'animation-pause', enabled: 'false' }))
                .then(() => box.setAttribute("animation__blink", { enabled: 'true' }))
                .then(() => anime(box, 'blink'))


            let thisIsIPDestination = packetParams.ip && node.ipaddr.includes(packetParams.ip["ip.dst"])

            // 2. make disappear the layer box
            switch (packet.levels[i]["protocol"]) {
                case "eth":
                    promise = promise
                        .then(() => box.setAttribute('visible', false))
                    break;
                case "arp":
                    // Process ARP Cache
                    receivingARPResponse(packetParams)
                    receivingARPRequest(packetParams)

                    let wasVisible = node.ARPCacheInfoText.getAttribute('visible')

                    setARPCacheInfoText(node.nodeName, packetParams.network, node.ARPCacheInfoText, node.ARPCache)
                    packetParams.network.getView() == "ALL" ? wait(25 * getTIME_UNIT(), network) : false
                    if (!wasVisible) node.ARPCacheInfoText.setAttribute('visible', false)
                    break;

                case "ip":
                    if (thisIsIPDestination) {
                        // 
                        promise = promise
                            .then(() => box.setAttribute('visible', false))
                    }

                    break;
                default:
                    if (thisIsIPDestination)
                        promise = promise
                            .then(() => {
                                let infoText = packet.querySelector("#infotext" + packet.id)
                                infoText.setAttribute('visible', false)
                                box.setAttribute('visible', false)
                            })
                    break;
            }

        }


        const hasDnsAnswer =
            packetParams.dns
            && (packetParams["dns"]["dns.count.answers"] != "0" || packetParams["dns"]["dns.count.auth_rr"] != "0")
            && node.ipaddr.includes(packetParams.ip["ip.dst"])


        if (hasDnsAnswer) {
            //
            // add to dns_cach_table
            //

            var new_rrs = []

            if (packetParams["dns"]["dns.count.add_rr"] != "0") {
                let answers = packetParams["dns"]["Additional records"]
                for (let key in answers) {
                    let name = answers[key]["dns.resp.name"]
                    let addr = answers[key]["dns.a"]
                    let ttl = answers[key]["dns.resp.ttl"]
                    new_rrs.push([name, ttl, "A", addr, this.packetParams.frameTime])
                }
            }

            if (packetParams["dns"]["dns.count.answers"] != "0") {
                let answers = packetParams["dns"]["Answers"]
                for (let key in answers) {
                    let name = answers[key]["dns.resp.name"]
                    let addr = answers[key]["dns.a"]
                    let ttl = answers[key]["dns.resp.ttl"]
                    new_rrs.push([name, ttl, "A", addr, this.packetParams.frameTime])

                }
            }

            if (packetParams["dns"]["dns.count.auth_rr"] != "0") {
                let answers = packetParams["dns"]["Authoritative nameservers"]
                for (let key in answers) {
                    let name = answers[key]["dns.resp.name"]
                    let ns = answers[key]["dns.ns"]
                    let ttl = answers[key]["dns.resp.ttl"]
                    new_rrs.push([name, ttl, "NS", ns, this.packetParams.frameTime])
                }
            }



            for (const rr of new_rrs) {

                // 1. eliminate entries that will be updated with rr 
                node.dns_cache_table = node.dns_cache_table.filter(
                    old_rr => old_rr[0] != rr[0] || old_rr[2] != rr[2]
                );

                // 2. add new rr
                node.dns_cache_table.push(rr)

            }


            // show and then hide the dns cache table
            var newNodeElement = document.querySelector("#" + node.nodeName)
            let wasVisible = node.dnsCacheTableText.getAttribute('visible')
            promise = promise
                .then(() => setDnsCacheTable(node.nodeName, node.dnsCacheTableText, node.dns_cache_table))
                .then(() => wait(100 * getTIME_UNIT(), this.p.data.network))
                .then(() => {
                    if (!wasVisible) node.dnsCacheTableText.setAttribute('visible', false)
                })
                .then(() => wait(100 * getTIME_UNIT(), this.p.data.network))
                .then(() => this.p.finish_packet(this.scene))
                .then(() => this.p.next_packet_anim())

        }


        // 
        // 3. Finally, destroy the packet 
        //  

        // it was the destination, thus just destroy it 
        // and then show the next
        promise = promise
            .then(() => wait(25 * getTIME_UNIT(), network))
            .then(() => {
                return this.p.check_console("receiving", node)
            })
            .then(() => {

                this.p.finish_packet(scene)
            })
            .then(() => {
                wait(55 * getTIME_UNIT(), network)
            })
            .then(() => this.p.next_packet_anim())


        return promise

    }
}







