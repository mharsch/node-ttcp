#!/usr/bin/env node

var net = require('net');
var dgram = require('dgram');
var ns = require('numscale');

var opt_map = {
    't' : {
	alias: 'transmit',
	describe: 'Transmit mode',
	boolean: true },
    'r' : {
	alias: 'receive',
	describe: 'Receive mode',
	boolean: true },
    'u' : {
	alias: 'udp',
	describe: 'Use UDP instead of TCP',
	boolean: true,
	default: false },
    'p' : {
	alias: 'port',
	describe: 'Port number to send to or listen on',
	default: 5001 },
    'l' : {
	alias: 'buflen',
	describe: 'size of buffers to be written-to / read-from socket',
	default: 8192},
    'n' : {
	alias: 'nbuf',
	describe: 'number of buffers to be written to the socket',
	default: 2048 * 1024},
    'f' : {
	alias: 'format',
	describe: 'report throughput in terms of either "bytes" or "bits"',
	default: 'bytes'},
    'D' : {
	alias: 'nodelay',
	describe: 'set TCP_NODELAY socket option',
	boolean: true,
	default: false },
    'T' : {
	alias: 'touchdata',
	describe: 'touch received data as it is read',
	boolean: true,
	default: false }
};

var target = '';

var argv = require('optimist')
	.options(opt_map)
	.check(function (argv) {
		if (argv.transmit && !argv.receive) {
			// transmit mode
			if (argv._.length > 0) {
				target = argv._[0];
			} else {
				target = 'localhost';
			}
		} else if (argv.receive && !argv.transmit) {
			// receive mode
		} else {
			throw new Error('must specify either transmit ' +
			    'or receive mode');
		}

		if ((argv.format.toLowerCase() != 'bytes') &&
		    (argv.format.toLowerCase() != 'bits')) {
			throw new Error('invalid format specified - must use' +
			    ' either bits or bytes');
		}
	})
	.argv;

var buf = new Buffer(argv.buflen);

var pattern =
    '\040\041\042\043\044\045\046\047\050\051\052\053\054\055\056\057\160\161' +
    '\062\063\064\065\066\067\070\071\072\073\074\075\076\077\100\101\102\103' +
    '\104\105\106\107\110\111\112\113\114\115\116\117\120\121\122\123\124\125' +
    '\126\127\130\131\132\133\134\135\136\137\140\141\142\143\144\145\146\147' +
    '\150\151\152\153\154\155\156\157\160\161\162\163\164\165\166\167\170\171' +
    '\172\173\174\175\176';

var start_time = 0;
var end_time = 0;
var elapsed_sec = 0;

if (argv.receive) {

	console.log('ttcp-r: buflen=%d, port=%d  %s',
	    argv.buflen, argv.port,
	    argv.udp?'udp':'tcp');

	if (argv.udp) {
		// udp receive
		var running = false;
		var bytes_received = 0;
		var msg_received = 0;

		var udp_server = dgram.createSocket('udp4', function (msg) {
			if (running && msg.length < 5) {
				// received closing sentinel
				running = false;
				udp_server.close();
			} else if (!running && msg.length < 5) {
				// received start sentinel
				start_time = Date.now();
				running = true;
			} else {
				msg.copy(buf);
				bytes_received += msg.length;
				msg_received++;
			}
		});
		udp_server.on('listening', function () {
			console.log('ttcp-r: socket');
		});
		udp_server.on('close', function () {
			end_time = Date.now();
			elapsed_sec = (end_time - start_time) / 1000;
			print_throughput('r', bytes_received, elapsed_sec);
		});
		udp_server.on('error', function () {
			console.log('udp receive socket error');
		});
		udp_server.bind(argv.port);
	} else {
		// tcp receive
		var tcp_server = net.createServer(function (socket) {
			socket.on('data', function (data) {
				data.copy(buf);
				if (argv.touchdata) {
					var sum = 0;
					for (var i = 0; i < data.length; i++) {
						// slooooww!
						sum += buf[i];
					}
				}
			});
			socket.on('end', function () {
				end_time = Date.now();
				elapsed_sec = (end_time - start_time) / 1000;
				print_throughput('r', socket.bytesRead,
				    elapsed_sec);
				tcp_server.close();
			});
		});
		tcp_server.listen(argv.port, function () {
			console.log('ttcp-r: socket');
		});
		tcp_server.on('connection', function (socket) {
			start_time = Date.now();
			console.log('ttcp-r: accept from %s',
			    socket.address().address);
		})
	}
} else if (argv.transmit) {

	console.log('ttcp-t: buflen=%d, nbuf=%d, port=%d  %s  -> %s',
	    argv.buflen, argv.nbuf, argv.port,
	    argv.udp?'udp':'tcp', target);

	start_time = Date.now();

	// fill buf with pattern
	var i = buf.length;
	var off = 0;
	var len = 0;
	while (i > pattern.length) {
		len = buf.write(pattern, off, pattern.length, 'ascii');
		i -= len;
		off += len;
	}
	buf.write(pattern, off, i, 'ascii');

	if (argv.udp) {
		// udp transmit
		var bytes_sent = 0;
		var msg_sent = 0;

		if (buf.length < 5) {
			throw new Error('UDP buffer size must be ' +
			    'at least 5 bytes');
		}

		var udp_client = dgram.createSocket('udp4');
		var bytes_left = argv.nbuf * argv.buflen;

		// start with sentinel msg (size == 4)
		udp_client.send(buf, 0, 4, argv.port, target);

		for (var k = 0; k < argv.nbuf; k++) {
			// console.log('sending msg...');
			udp_client.send(buf, argv.bufoffset, buf.length,
			    argv.port, target, function (err, bytes) {
				bytes_sent += bytes;
				bytes_left -= bytes;
				msg_sent++;
				if (bytes_left <= 0) {
					// send sentinal msg (size == 4)
					udp_client.send(buf, 0, 4, argv.port,
					    target, function (err, bytes) {
						udp_client.close();
					});
				}
			});
		}

		udp_client.on('close', function () {
			end_time = Date.now();
			elapsed_sec = (end_time - start_time) / 1000;
			print_throughput('t', bytes_sent, elapsed_sec);
		});
	} else {
		// tcp transmit
		var tcp_client = net.createConnection(argv.port, target,
		    function () {
			console.log('ttcp-t: socket');
			tcp_client.setNoDelay(argv.nodelay);
			if (argv.nodelay == true) {
				console.log('ttcp-t: nodelay')
			}
			for (var j = 0; j < argv.nbuf; j++) {
				tcp_client.write(buf, 'ascii');
				// throttling would go here?
			}
			tcp_client.end();
		});
		tcp_client.on('connect', function () {
			console.log('ttcp-t: connect');
		});
		tcp_client.on('end', function () {
			end_time = Date.now();
			elapsed_sec = (end_time - start_time) / 1000;
			print_throughput('t', tcp_client.bytesWritten,
			    elapsed_sec);
		});
	}
}

function print_throughput(snd_recv, bytes, seconds) {

	var datavalue = 0;
	var unit_base = 0;
	var unit_suffix = '';

	if (argv.format == 'bits') {
		datavalue = bytes * 8;
		unit_base = 10;
		unit_suffix = 'b';
	} else {
		datavalue = bytes;
		unit_base = 2;
		unit_suffix = 'B';
	}

	console.log('ttcp-%s: %s in %d seconds = %s +++',
	    snd_recv,
	    ns.scale({ value: datavalue, powerOf: unit_base, maxLen: 6 }) +
	        unit_suffix,
	    seconds,
	    ns.scale({ value: datavalue / seconds, powerOf: unit_base,
	        maxLen: 6 }) + unit_suffix + '/sec');
};