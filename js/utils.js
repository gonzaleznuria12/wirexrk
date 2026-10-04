import { isFastForwardMode, getTIME_UNIT } from "./index.js"

// Waits the equivalent of ms milliseconds at the speed when called, then resolves.
// Polls every 50ms so that mid-wait changes to TIME_UNIT (speed slider) are respected.
// Paused time does not count toward the wait.
//
// Returns a promise so you can use in a then() chain
export const wait = (ms, network) =>
	new Promise((resolve) => {
		if (isFastForwardMode() || ms <= 0 || getTIME_UNIT() <= 0) { setTimeout(resolve, 0); return; }
		const base_units = ms / getTIME_UNIT()  // normalise: strip out TIME_UNIT so we keep just N
		let accumulated = 0
		let last = Date.now()
		;(function f() {
			setTimeout(() => {
				if (network.getAnimationState() === 'PAUSED') {
					last = Date.now()  // don't count paused time
					f()
					return
				}
				const now = Date.now()
				accumulated += (now - last) / getTIME_UNIT()
				last = now
				if (accumulated >= base_units) resolve()
				else f()
			}, 50)
		})()
	});



export const anime = (target, animation_name) =>
	new Promise((resolve) => {
		target.addEventListener('animationcomplete__' + animation_name, resolve)
		target.emit(animation_name, null, false);
	});


export var TT = 500 // time constant used in controller and network. Eliminate?


export function isEndToEndVIEW(network) {
    let view = network.getView()
    return (view == "APPLICATION" || view == "APPLICATION+TRANSPORT");
}


export const COLORS = {
    dns: "goldenrod",
    http: "gold",
    dataInfo: "yellow",
    data: "yellow",
    tcp: "#A9CCE3",
    udp: "orchid",
    icmp: "red",
    ip: "LightGreen",
    arp: "sandybrown",
    vlan: "yellow",
    vxlan: "LightBlue",
    eth: "khaki"
}
export function getColor(protocol) {
    return COLORS[protocol];
}


export function setRoutingTable(infoText, newBox) {
    infoText.removeAttribute('html');

    var textTemplate = document.getElementById(newBox.id + '-template');

    infoText.setAttribute('html', 'cursor:#cursor;html:'+'#' + newBox.id + "routing_table" + '-template');

    infoText.setAttribute('visible', true);

    newBox.removeAttribute('sound');
    newBox.setAttribute('sound', { src: '#showLevels', volume: 5, autoplay: "true" });
}

export function setSwitchTable(nodeName, infoText, switch_table) {

    var text = formatSwitchTable(nodeName, switch_table)
    infoText.removeAttribute('html')

    var textTemplate = document.getElementById(infoText.id + '-template');
    textTemplate.innerHTML = text

    textTemplate.style = "display: inline-block; background: #5f6a76; color: white; border-radius: 1em; padding: 1em; margin:0;"
    infoText.setAttribute('html', 'cursor:#cursor;html:' + '#' + infoText.id + '-template');

    infoText.setAttribute('visible', true);

}

export function setDnsCacheTable(nodeName, infoText, dns_cache_table) {
    var text = formatDnsCacheTable(nodeName, dns_cache_table)

    infoText.removeAttribute('html')
    var textTemplate = document.getElementById(infoText.id + '-template');
    textTemplate.innerHTML = text

    textTemplate.style = "display: inline-block; background: #5f6a76; color: white; border-radius: 1em; padding: 1em; margin:0;"
    infoText.setAttribute('html', 'cursor:#cursor;html:' + '#' + infoText.id + '-template');

    infoText.setAttribute('visible', true);
}

export function setARPCacheInfoText(nodeName, network, infoText, arpCache) {
    var text = formatARPCache(nodeName, arpCache)

    infoText.removeAttribute('html')
    var textTemplate = document.getElementById(infoText.id + '-template');

    textTemplate.innerHTML = text

    textTemplate.style = "display: inline-block; background: #5f6a76; color: white; border-radius: 1em; padding: 1em; margin:0;"
    infoText.setAttribute('html', 'cursor:#cursor;html:' + '#' + infoText.id + '-template');

    if (network.getView() == "ALL")
        infoText.setAttribute('visible', true);

}

function stripSuffix(nodeName){
    let pos = nodeName.lastIndexOf('_')
    let strippedName = nodeName.slice(0,pos)

    return strippedName
}

export function formatARPCache(nodeName, ARPCache) {
    var color = "white"
    let h1 = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'
    let h2 = '<h2 style="padding: 0rem 1rem; font-size: 1.2rem; font-weight: 800; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'
    let h3 = '<h3 style="padding: 0rem 1rem 0rem 2rem; font-size: 1rem; font-weight: 700; ' +
        'font-family: monospace;  text-align: left; color: ' + color + '">'


    var text = h1 + stripSuffix(nodeName) + ' ARP cache</h1>' + h2 +
        '<table style="border-spacing: 1rem; text-align: center">' +
        '<tr><th>IP address</th>' +
        '<th>hwaddr</th>' +
        '<th>Iface</th>' +
        '</tr>'

    for (const ip in ARPCache) {
        text += "<tr>" +
            "<td>" + ip + "</td> " +
            "<td>" + ARPCache[ip]["hwaddr"] + "</td> " +
            "<td>" + ARPCache[ip]["iface"] + "</td> " +
            "</tr>"
    }

    text += "</h2>"
    text += "</table>"

    return text;
}

export function formatSwitchTable(nodeName, switch_table) {
    let h1 = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; ' +
        'font-family: monospace; text-align: left;">'
    let h2 = '<h2 style="padding: 0rem 1rem; font-size: 1.2rem; font-weight: 800; ' +
        'font-family: monospace; text-align: left;">'
    let h3 = '<h3 style="padding: 0rem 1rem 0rem 2rem; font-size: 1rem; font-weight: 700; ' +
        'font-family: monospace; text-align: left;">'



    var text = h1 + stripSuffix(nodeName) + ' Switch table</h1>' +
        h2 +
        '<table style="border-spacing: 1rem; text-align: center">' +
        '<tr><th>port no</th>' +
        '<th>mac addr</th>' +
        '<th> is local?</th>' +
        '<th>ageing timer</th>' +
        '</tr>'
        + '</h2>'

    text += h2
    for (var i = 0; i < switch_table.length; i++) {
        text += "<tr>" +
            "<td>" + switch_table[i][0] + "</td> " +
            "<td>" + switch_table[i][1] + "</td> " +
            "<td>" + switch_table[i][2] + "</td> " +
            "<td>" + switch_table[i][3] + "</td> " +

            "</tr>"
    }
    text += '</h2>'

    text += "</table>"

    return text;
}

export function formatDnsCacheTable(nodeName, dns_cache_table) {
    let h1 = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; ' +
        'font-family: monospace; text-align: left;">'
    let h2 = '<h2 style="padding: 0rem 1rem; font-size: 1.2rem; font-weight: 800; ' +
        'font-family: monospace; text-align: left;">'
    let h3 = '<h3 style="padding: 0rem 1rem 0rem 2rem; font-size: 1rem; font-weight: 700; ' +
        'font-family: monospace; text-align: left;">'

    var text = h1 + stripSuffix(nodeName) + ' DNS Cache</h1>' +
h2 +
    '<table style="border-spacing: 1rem; text-align: center">' +
'</h2>'


    text += h2 
    for (var i = 0; i < dns_cache_table.length; i++) {
        text += "<tr>" +
            "<td>" + dns_cache_table[i][0] + "</td> " +
            "<td>" + dns_cache_table[i][1] + "</td> " +
            "<td>" + dns_cache_table[i][2] + "</td> " +
            "<td>" + dns_cache_table[i][3] + "</td> " +
            "</tr>"
    }
    text += '</h2>'

    text += "</table>"

    return text;
}


export function formatRoutingTable(nodeName, routing_table) {
    
    let h1 = '<h1 style="padding: 0rem 1rem; font-size: 1.4rem; font-weight: 900; ' +
        'font-family: monospace; text-align: left;">'
    let h2 = '<h2 style="padding: 0rem 1rem; font-size: 1.2rem; font-weight: 800; ' +
        'font-family: monospace; text-align: left;">'
    let h3 = '<h3 style="padding: 0rem 1rem 0rem 2rem; font-size: 1rem; font-weight: 700; ' +
        'font-family: monospace; text-align: left;">'

    var text = h1 + stripSuffix(nodeName) + ' Routing table </h1>' +
        h2 +
        '<table style="border-spacing: 1rem; text-align: center">' +
        '<tr><th>Destination</th>' +
        '<th>Mask</th>' +
        '<th> Gateway</th>' +
        '<th>Iface</th>' +
        '</tr>'
        + '</h2>'

    text += h2
    for (var i = 0; i < routing_table.length; i++) {
        text += "<tr>" +
            "<td>" + routing_table[i][0] + "</td> " +
            "<td>" + routing_table[i][1] + "</td> " +
            "<td>" + routing_table[i][2] + "</td> " +
            "<td>" + routing_table[i][3] + "</td> " +
            "</tr>"
    }
    text += '</h2>'

    text += "</table>"

    return text;
}



export function hex_with_colons_to_ascii(str1) {
    var hex = str1.toString();
    var str = '';
    for (var n = 0; n < hex.length; n += 3) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
}


export function dns_info(packetParams) {
    let color = getColor("dns")
    let h1 = '<h1 style="padding: 0rem ; font-size: 1.4rem; font-weight: 900; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'
    let h2 = '<h2 style="padding: 0rem ; font-size: 1.2rem; font-weight: 800; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'
    let h3 = '<h3 style="padding: 0rem ; font-size: 1rem; font-weight: 700; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'

    let info = h1 + 'DNS Protocol' + ' </h1>'

    // It's a pure query
    if (packetParams.dns["dns.count.add_rr"] == 0 && packetParams.dns["dns.count.answers"] == 0) {
        let query_type = ""

        if (packetParams.dns["dns.flags_tree"]["dns.flags.recdesired"] == "0")
            query_type = "(iterative)"
        else
            query_type = "(recursive)"

        info += h2 + 'Queries ' + query_type + ': </h2>'

        for (const [key, value] of Object.entries(packetParams.dns.Queries))
            info += h3 + 'Query: ' + key + ' </h3>';
    }


    if (packetParams.dns["dns.count.answers"] != 0) {
        info += h2 + 'Answers: <h2>'
        for (const [key, value] of Object.entries(packetParams.dns["Answers"]))
            info += h3 + key + ", TTL " + value["dns.resp.ttl"]  + '</h3>';
    }

    if (packetParams.dns["dns.count.add_rr"] != 0) {

        info += h2 + 'Authoritative nameservers: </h2>'
        for (const [key, value] of Object.entries(packetParams.dns["Authoritative nameservers"]))
            info += h3 + key + ", TTL " + value["dns.resp.ttl"] + ' </h3>';

        info += h2 + 'Additional records: </h2>'
        for (const [key, value] of Object.entries(packetParams.dns["Additional records"]))
            info += h3 + key + ", TTL " + value["dns.resp.ttl"] + '</h3>';
    }
    return info;
}




export function http_info(packetParams) {
    let color = getColor("http")
    let h1 = '<h1 style="padding: 0rem ; font-size: 1.4rem; font-weight: 900; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'
    let h2 = '<h2 style="padding: 0rem ; font-size: 1.2rem; font-weight: 800; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'
    let h3 = '<h3 style="padding: 0rem ; font-size: 1rem; font-weight: 700; ' +
        'font-family: monospace; text-align: left; color: ' + color + '">'

    let info = h1 + 'HTTP Protocol' + ' </h1>'

    // It's a request
    if (packetParams.http["http.request"] == "1") {
     
        info += h2 + 'HTTP REQUEST ' + '</h2>'
        info += h2 + packetParams.http["http.request.full_uri"] + '</h2>'

    }
    
    if (packetParams.http["http.response"] == "1") {
     
        info += h2 + 'HTTP RESPONSE ' + '</h2>'

    }

    return info;
}






// Returns a point in the segment from-to
//
// if shift > 0 return a point close to from, at a distance
// proportional to shift
//
// if shift < 0 return a point close to to, at a distance
// proportional to shift
export function pointInSegment(from, to, shift = 0.2) {
    var coords = {};
    coords.y = from.y

    if (shift >= 0) {
        coords.x = from.x;
        coords.z = from.z;
    }
    else {
        coords.x = to.x;
        coords.z = to.z;
    }

    var slope = Math.abs(to.z - from.z) / Math.abs(to.x - from.x)

    var shift_x = shift * Math.abs(to.x - from.x)



    if (to.x >= from.x && to.z >= from.z) {
        coords.x += shift_x;
    }
    else if (to.x >= from.x && to.z <= from.z) {
        coords.x += shift_x;
    }
    else if (to.x <= from.x && to.z >= from.z) {
        coords.x -= shift_x;
    }
    else if (to.x <= from.x && to.z <= from.z) {
        coords.x -= shift_x;
    }

    var shift_z = (coords.x - from.x) * (to.z - from.z) / (to.x - from.x)
    if (Math.abs(shift_x) < 0.1) {
        // Fix for vertical lines
        if (shift_z < 0)
            shift_z = Math.min(-3, shift_z)
        else
            shift_z = Math.max(3, shift_z)
    }
    coords.z = from.z + shift_z

    return coords;
}