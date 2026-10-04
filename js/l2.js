import { isEndToEndVIEW, setSwitchTable } from "./utils.js"

export function receivingARPResponse(packet) {
    // to be called when an arp response is received:
    // add in the receiver's ARPCache the eth_src
    let eth_dst = packet.eth["eth.dst"]
    let eth_src = packet.eth["eth.src"]

    if (packet["arp"]
        && packet["arp"]["arp.opcode"] == "2") // ARP response
    {
        var connectionLink = packet.network.getConnectionsLinks().find(o => o.hwaddr.includes(eth_dst))
        var node = packet.network.getNodeList().find(o => o.nodeName === connectionLink.nodeName)
        var i = connectionLink.hwaddr.findIndex(o => o == eth_dst)

        var ipaddr = packet["arp"]["arp.src.proto_ipv4"]

        node.ARPCache[ipaddr] = { "iface": "eth" + i, "hwaddr": eth_src }

    }
}

export function receivingARPRequest(packet) {
    // to be called when an arp request is received:
    // add in the receiver's ARPCache the eth_src
    let ip_dst = packet["arp"]["arp.dst.proto_ipv4"]
    let eth_src = packet.eth["eth.src"]

    let nodeName = packet.to
    var nodeList = packet.network.getNodeList()
    var node = nodeList.find(o => o.nodeName === nodeName)

    if (packet["arp"]
        && packet["arp"]["arp.opcode"] == "1" // ARP request
        && node.ipaddr.includes(ip_dst)) {

        var finalConnectionsLinks = packet.network.getConnectionsLinks()

        var connectionLink = finalConnectionsLinks.find(o => o.ipaddr.includes(ip_dst))
        var node = nodeList.find(o => o.nodeName === connectionLink.nodeName)
        var i = connectionLink.ipaddr.findIndex(o => o == ip_dst)

        var ipaddr = packet["arp"]["arp.src.proto_ipv4"]

        node.ARPCache[ipaddr] = { "iface": "eth" + i, "hwaddr": eth_src }

    }
}


export function frameIsForMe(packetParams) {
    // Not isEndToEndVIEW, then look at hwaddresses
    if (isEndToEndVIEW(packetParams.network))
        return true;

    // every bcast is for me
    if (packetParams.eth["eth.dst"] == "ff:ff:ff:ff:ff:ff")
        return true

    // unicast eth frames are for me only if its destination is
    // one of my hwaddrs

    let nodeName = packetParams.to
    var nodeList = packetParams.network.getNodeList()
    var node = nodeList.find(o => o.nodeName === nodeName)

    let dst_eth = Array.isArray(packetParams.eth)?packetParams.eth[0]["eth.dst"]:packetParams.eth["eth.dst"]

    if (node.hwaddr.includes(dst_eth))
        return true

    return false
}


export function updateSwitchTables(network) {
    // add time to learnt addrs of this switch
    let next_packet = network.getNextPacket()
    let currentTime = network.finalPackets[next_packet].frameTime


    network.getNodeList().forEach(node => {
        if (node.type == "switch") {
            node.switch_table = node.switch_table.map(subArray => {
                if (subArray[2] === "no") {
                    // Change the array as needed; for example, set all values to "changed"
                    let time_spent_in_table = Math.max(0.000001, (currentTime - subArray[4]).toFixed(6))
                    return [subArray[0], subArray[1], subArray[2], time_spent_in_table + "s", subArray[4]];
                }
                return subArray;
            });

            node.switch_table = node.switch_table.filter(
                entry => parseFloat(entry[3].substr(0,entry[3].length-1)) > 0.0
            )

            if (node.switchTableText.getAttribute('visible'))
                setSwitchTable(node.nodeName, node.switchTableText, node.switch_table)
        }
    })
}