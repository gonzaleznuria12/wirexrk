import { setDnsCacheTable } from "./utils.js";

export function updateDnsCacheTable(network) {
    let next_packet = network.getNextPacket()
    let currentTime = network.finalPackets[next_packet].frameTime

    network.getNodeList().forEach(node => {

        if (node.type == "dnsServer") {

            node.dns_cache_table = node.dns_cache_table.map(rr => {
                    // Change the rr as needed; for example, set all values to "changed"
                    let time_spent_in_table = Math.max(0.000001, (currentTime - rr[4]).toFixed(6))

                    return [rr[0], parseFloat(rr[1]) - time_spent_in_table, rr[2], rr[3], rr[4]];
            });

            node.dns_cache_table = node.dns_cache_table.filter(
                rr => parseFloat(rr[1]) > 0.0
            )

            if (node.dnsCacheTableText.getAttribute('visible'))
                setDnsCacheTable(node.nodeName, node.dnsCacheTableText, node.dns_cache_table)
        }
    })
}