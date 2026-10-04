class Switches {
    constructor() {
        this.switch_msgs_ticks = {}

    }

    get_key(packet) {

        var key = JSON.stringify(packet.eth["eth.src"] + packet.eth["eth.dst"])

        if (packet.hasOwnProperty("arp"))
            key += JSON.stringify(packet.arp)
        if (packet.hasOwnProperty("ip"))
            key += JSON.stringify(packet.ip)

        return key
    }

    tick_from_switch(packet, a_switch) {
        return this.switch_msgs_ticks[a_switch + this.get_key(packet)]
    }

    store_in_switch(packet, position, src_switch, dst_switch) {
        var new_tick
        if (src_switch != "noswitch")
            new_tick = 1 + this.tick_from_switch(packet, src_switch)
        else new_tick = position

        this.switch_msgs_ticks[dst_switch + this.get_key(packet)] = new_tick
    }
}

export default Switches;

